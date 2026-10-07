import type { CollectionBeforeChangeHook, PayloadRequest, Where } from "payload";
import {
  ACTIVE_STATUSES,
  effectiveLimit,
  isActiveStatus,
  isReleasedStatus,
  nextSeat,
  relationId,
} from "@/lib/booking-rules";
import type { Booking } from "@/payload-types";
import { BookingError } from "./errors";

type Draft = Partial<Booking>;
type Scope = { data: Draft; isPublic: boolean; excludeId?: number; req: PayloadRequest };

/**
 * Applies the booking rules on every save, from the website and from the admin alike: an active
 * booking holds a free slot and one of its design's seats, and gives both back when it is rejected
 * or cancelled. The unique indexes on `slot` and `design + seat` settle simultaneous requests.
 */
export const prepareBooking: CollectionBeforeChangeHook<Booking> = async ({
  data,
  originalDoc,
  operation,
  req,
  context,
}) => {
  const isPublic = context.publicBooking === true;
  const previous = operation === "update" ? originalDoc : undefined;
  if (isPublic && operation === "create") data.status = "pending";
  const status = data.status ?? previous?.status ?? "pending";

  if (!previous && isReleasedStatus(status)) throw new BookingError("create_released");
  if (previous && isReleasedStatus(previous.status) && isActiveStatus(status)) throw new BookingError("reactivate");

  if (isReleasedStatus(status)) {
    data.slot = null;
    data.seat = null;
  } else {
    const designId = relationId(data.design ?? previous?.design);
    if (designId === null) throw new BookingError("design_unavailable");
    if (!previous || relationId(previous.design) !== designId) {
      await takeSeat(designId, { data, isPublic, excludeId: previous?.id, req });
    }

    const slotId = relationId(data.slot === undefined ? previous?.slot : data.slot);
    if (slotId === null) throw new BookingError("slot_required");
    if (!previous || relationId(previous.slot) !== slotId) {
      await takeSlot(slotId, { data, isPublic, excludeId: previous?.id, req });
    }
  }

  const name = (data.name ?? previous?.name ?? "").trim();
  data.title = `${name} — ${data.designName ?? previous?.designName ?? ""}`;
  return data;
};

async function takeSeat(designId: number, { data, isPublic, excludeId, req }: Scope) {
  const design = await req.payload.findByID({
    collection: "designs",
    id: designId,
    depth: 1,
    disableErrors: true,
    overrideAccess: true,
    req,
  });
  if (!design || (isPublic && !design.visible)) throw new BookingError("design_unavailable");
  const category =
    typeof design.category === "object"
      ? design.category
      : await req.payload.findByID({ collection: "categories", id: design.category, overrideAccess: true, req });

  const limit = effectiveLimit(category);
  if (limit === null) {
    data.seat = null;
  } else {
    // One read gives both the count and the free seat, so two requests that see the same state
    // pick the same seat and the unique index turns one of them away (see nextSeat).
    const conditions: Where[] = [{ design: { equals: designId } }, { status: { in: [...ACTIVE_STATUSES] } }];
    if (excludeId) conditions.push({ id: { not_equals: excludeId } });
    const active = await req.payload.find({
      collection: "bookings",
      where: { and: conditions },
      select: { seat: true },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      req,
    });
    const seat = nextSeat(active.docs.map((b) => b.seat), limit);
    if (seat === null) throw new BookingError("sold_out");
    data.seat = seat;
  }
  data.designName = `${category.name} #${design.number}`;
  data.price = design.price;
}

async function takeSlot(slotId: number, { data, isPublic, excludeId, req }: Scope) {
  const slot = await req.payload.findByID({
    collection: "slots",
    id: slotId,
    select: { startsAt: true },
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
  });
  if (!slot) throw new BookingError("slot_taken");
  if (isPublic && new Date(slot.startsAt).getTime() <= Date.now()) throw new BookingError("slot_past");

  const conditions: Where[] = [{ slot: { equals: slotId } }];
  if (excludeId) conditions.push({ id: { not_equals: excludeId } });
  const { totalDocs } = await req.payload.count({
    collection: "bookings",
    where: { and: conditions },
    overrideAccess: true,
    req,
  });
  if (totalDocs > 0) throw new BookingError("slot_taken");
  data.slotStartsAt = slot.startsAt;
}
