import type { Where } from "payload";
import { formatAdminURL } from "payload/shared";
import { type Availability, isActiveStatus, relationId } from "./booking-rules";
import { formatReceivedAt, formatSlotDay, formatSlotTime } from "./time";

/** The four booking lists on the admin dashboard; each is its own widget (cms/dashboard/widgets.ts). */
export type BookingView = "pending" | "unscheduled" | "upcoming" | "recent";

/** What a row's date is made from: when the booking came in, and its copy of the slot's start. */
type RowTimes = { createdAt: string; slotStartsAt?: string | null };

export type BookingViewSpec = {
  /** The widget's heading, and its name in the dashboard's add-widget list. */
  title: string;
  /** The bookings the list shows. The overview counts the same ones, so its numbers match the lists. */
  where: (now: Date) => Where;
  /** A Payload sort: the field, "-" in front for newest first. */
  sort: string;
  /** The date a row shows after the customer's name. */
  when: (booking: RowTimes, now: Date) => string;
  /** What the widget says when no booking fits. */
  empty: string;
};

const received = (booking: RowTimes, now: Date) => `beérkezett ${formatReceivedAt(booking.createdAt, now)}`;

/** Every condition at once. Typed arguments, so TypeScript reads each condition as a Where of its own. */
const allOf = (...conditions: Where[]): Where => ({ and: conditions });

export const BOOKING_VIEWS: Record<BookingView, BookingViewSpec> = {
  pending: {
    title: "Jóváhagyásra vár",
    where: () => ({ status: { equals: "pending" } }),
    // Oldest first, in both to-do lists: they are worked through in order.
    sort: "createdAt",
    when: received,
    empty: "Nincs jóváhagyásra váró foglalás.",
  },
  unscheduled: {
    title: "Időpontra vár",
    // Pending bookings have no slot yet either; they wait in the list above, so nothing is counted twice.
    where: () => allOf({ status: { equals: "confirmed" } }, { slot: { exists: false } }),
    sort: "createdAt",
    when: received,
    empty: "Minden jóváhagyott foglalásnak van időpontja.",
  },
  upcoming: {
    title: "Közelgő időpontok",
    // An active booking that loses its slot loses slotStartsAt too, so a future slotStartsAt means a held slot.
    where: (now) =>
      allOf({ status: { in: ["pending", "confirmed"] } }, { slotStartsAt: { greater_than: now.toISOString() } }),
    sort: "slotStartsAt",
    when: ({ slotStartsAt }) => (slotStartsAt ? `${formatSlotDay(slotStartsAt)} ${formatSlotTime(slotStartsAt)}` : ""),
    empty: "Nincs közelgő időpont.",
  },
  recent: {
    title: "Legutóbbi foglalások",
    where: () => ({}),
    sort: "-createdAt",
    when: (booking, now) => formatReceivedAt(booking.createdAt, now),
    empty: "Még nincs foglalás.",
  },
};

/** How many designs the "Lefoglalt minták" widget shows. */
export const BOOKED_DESIGNS_SHOWN = 12;

export type BookedDesign = { id: number; active: number; lastBookedAt: string };

/**
 * The designs with active bookings, the most recently booked first, at most `max`: each with its number of active
 * bookings and when the latest of them came in. Released bookings don't count.
 */
export function rankBookedDesigns(
  bookings: Iterable<{ design: unknown; status: string | null | undefined; createdAt: string }>,
  max = BOOKED_DESIGNS_SHOWN,
): BookedDesign[] {
  const byDesign = new Map<number, BookedDesign>();
  for (const { design, status, createdAt } of bookings) {
    const id = relationId(design);
    if (id === null || !isActiveStatus(status)) continue;
    const seen = byDesign.get(id);
    if (!seen) {
      byDesign.set(id, { id, active: 1, lastBookedAt: createdAt });
      continue;
    }
    seen.active += 1;
    if (Date.parse(createdAt) > Date.parse(seen.lastBookedAt)) seen.lastBookedAt = createdAt;
  }
  return [...byDesign.values()]
    .sort((a, b) => Date.parse(b.lastBookedAt) - Date.parse(a.lastBookedAt) || b.id - a.id)
    .slice(0, max);
}

/**
 * The tag on a booked design's card: "Elkelt · 1/1" once its rule is full (the true count even when the limit was
 * lowered under it, "Elkelt · 4/3"), "2 / 3 alkalom" while a limited design has room, "4 foglalás" when unlimited.
 */
export function bookedLabel({ limit, soldOut }: Availability, active: number) {
  if (limit === null) return { text: `${active} foglalás`, soldOut: false };
  if (soldOut) return { text: `Elkelt · ${active}/${limit}`, soldOut: true };
  return { text: `${active} / ${limit} alkalom`, soldOut: false };
}

/** Writes a value into the query the way the admin's list view reads it back: where[status][equals]=pending. */
function appendQuery(params: URLSearchParams, key: string, value: unknown) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendQuery(params, `${key}[${index}]`, item));
  } else if (typeof value === "object" && value !== null) {
    for (const [name, item] of Object.entries(value)) appendQuery(params, `${key}[${name}]`, item);
  } else if (value !== undefined) {
    params.append(key, String(value));
  }
}

/** An admin list view, filtered and sorted. */
export function adminListUrl(
  adminRoute: string,
  collection: "bookings" | "designs",
  { where, sort }: { where?: Where; sort?: string } = {},
) {
  const params = new URLSearchParams();
  if (where) appendQuery(params, "where", where);
  if (sort) params.set("sort", sort);
  const list = formatAdminURL({ adminRoute, path: `/collections/${collection}` });
  const query = params.toString();
  return query ? `${list}?${query}` : list;
}

/** The bookings list filtered and sorted like one of the dashboard's lists: its "Mind (N)" link and its counter. */
export function viewListUrl(adminRoute: string, view: BookingView, now: Date) {
  const { where, sort } = BOOKING_VIEWS[view];
  return adminListUrl(adminRoute, "bookings", { where: where(now), sort });
}

/** A design's bookings, newest first: where a "Lefoglalt minták" card leads. */
export function designBookingsUrl(adminRoute: string, designId: number) {
  return adminListUrl(adminRoute, "bookings", { where: { design: { equals: designId } }, sort: "-createdAt" });
}

/** The designs list narrowed to these designs: where the "Elkelt minta" number leads. */
export function designsUrl(adminRoute: string, ids: number[]) {
  return adminListUrl(adminRoute, "designs", { where: { id: { in: ids } } });
}

/** A booking's page in the admin. */
export function bookingUrl(adminRoute: string, id: number) {
  return formatAdminURL({ adminRoute, path: `/collections/bookings/${id}` });
}
