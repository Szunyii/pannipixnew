import type { PayloadRequest } from "payload";
import { cache } from "react";
import { ACTIVE_STATUSES, type BookingStatus, availability, countActiveByDesign } from "@/lib/booking-rules";
import { categoryName } from "@/lib/categories";
import { BOOKING_VIEWS, type BookingView, bookedLabel, rankBookedDesigns } from "@/lib/dashboard";
import { designName } from "@/lib/design-name";
import type { Design, DesignsSelect, MediaSelect } from "@/payload-types";
import { loggableError } from "../log";

/** Rows on a booking list; the rest are behind its "Mind (N)" link. */
export const LIST_ROWS = 5;

export type BookingRow = {
  id: number;
  design: string;
  image: string | null;
  customer: string;
  status: BookingStatus;
  createdAt: string;
  slotStartsAt: string | null;
};

export type BookingListData = { rows: BookingRow[]; total: number };

export type OverviewData = { pending: number; unscheduled: number; upcoming: number; soldOut: number[] };

export type BookedDesignCard = { id: number; name: string; image: string | null; label: string; soldOut: boolean };

// What a design brings along to the dashboard: its name and its first image. `satisfies` catches a misspelt field.
const DESIGN_FIELDS = {
  title: true,
  category: true,
  number: true,
  images: true,
} as const satisfies DesignsSelect<true>;
const IMAGE_FIELDS = { url: true, filename: true, sizes: true } as const satisfies MediaSelect<true>;

type ShownDesign = Pick<Design, keyof typeof DESIGN_FIELDS>;

const nameOf = (design: ShownDesign) =>
  design.title || designName({ collection: categoryName(design.category), number: design.number });

/** The design's first image at the admin's thumbnail size, or the image itself; null when there is none. */
function thumbnailOf(design: ShownDesign) {
  const image = design.images?.[0]?.image;
  if (!image || typeof image !== "object") return null;
  return image.sizes?.thumbnail?.url || image.url || null;
}

/**
 * Runs a widget's query. On failure it logs what is safe to log (cms/log.ts) and returns null, so the widget can show
 * an error in its place: Payload catches a widget's error neither on first render nor when it is added in edit mode,
 * and the whole dashboard would fail.
 */
export async function loadSafely<T>(req: PayloadRequest, widget: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (err) {
    req.payload.logger.error({ err: loggableError(err), widget, msg: "Dashboard widget failed to load" });
    return null;
  }
}

/** One of the four booking lists: its first rows and how many bookings it holds in all. */
export async function loadBookingView(req: PayloadRequest, view: BookingView, now: Date): Promise<BookingListData> {
  const { where, sort } = BOOKING_VIEWS[view];
  const { docs, totalDocs } = await req.payload.find({
    collection: "bookings",
    where: where(now),
    sort,
    limit: LIST_ROWS,
    depth: 2,
    select: { design: true, designName: true, name: true, status: true, createdAt: true, slotStartsAt: true },
    populate: { designs: DESIGN_FIELDS, media: IMAGE_FIELDS },
    overrideAccess: false,
    req,
  });
  const rows = docs.map((booking): BookingRow => {
    const design = typeof booking.design === "object" ? booking.design : null;
    return {
      id: booking.id,
      // The design can't be deleted while a booking points at it; the booking's own copy of the name is a safety net.
      design: design ? nameOf(design) : (booking.designName ?? ""),
      image: design ? thumbnailOf(design) : null,
      customer: booking.name,
      status: booking.status,
      createdAt: booking.createdAt,
      slotStartsAt: booking.slotStartsAt ?? null,
    };
  });
  return { rows, total: totalDocs };
}

/**
 * Every active booking's design, status and arrival. Completed bookings stay active for good, so this grows with the
 * studio's history. Cached per request: the overview and the booked designs get the same `req` and share one read.
 */
const activeBookings = cache(async (req: PayloadRequest) => {
  const { docs } = await req.payload.find({
    collection: "bookings",
    where: { status: { in: [...ACTIVE_STATUSES] } },
    select: { design: true, status: true, createdAt: true },
    depth: 0,
    pagination: false,
    overrideAccess: false,
    req,
  });
  return docs;
});

/** Every design whose rule its active bookings fill, hidden ones too: the site marks the same ones "Elkelt". */
async function soldOutDesignIds(req: PayloadRequest) {
  const [designs, bookings] = await Promise.all([
    req.payload.find({
      collection: "designs",
      select: { rule: true, limit: true },
      depth: 0,
      pagination: false,
      overrideAccess: false,
      req,
    }),
    activeBookings(req),
  ]);
  const counts = countActiveByDesign(bookings);
  return designs.docs.filter((d) => availability(d, counts.get(d.id) ?? 0).soldOut).map((d) => d.id);
}

/** The overview's numbers. The three booking counts use the lists' own filters. */
export async function loadOverview(req: PayloadRequest, now: Date): Promise<OverviewData> {
  const count = async (view: BookingView) => {
    const { totalDocs } = await req.payload.count({
      collection: "bookings",
      where: BOOKING_VIEWS[view].where(now),
      overrideAccess: false,
      req,
    });
    return totalDocs;
  };
  const [pending, unscheduled, upcoming, soldOut] = await Promise.all([
    count("pending"),
    count("unscheduled"),
    count("upcoming"),
    soldOutDesignIds(req),
  ]);
  return { pending, unscheduled, upcoming, soldOut };
}

/** The designs with active bookings, the most recently booked first, each with its tag. */
export async function loadBookedDesigns(req: PayloadRequest): Promise<BookedDesignCard[]> {
  const ranked = rankBookedDesigns(await activeBookings(req));
  if (ranked.length === 0) return [];
  const { docs } = await req.payload.find({
    collection: "designs",
    where: { id: { in: ranked.map((d) => d.id) } },
    depth: 1,
    select: { ...DESIGN_FIELDS, rule: true, limit: true },
    populate: { media: IMAGE_FIELDS },
    pagination: false,
    overrideAccess: false,
    req,
  });
  const byId = new Map(docs.map((design) => [design.id, design]));
  return ranked.flatMap(({ id, active }) => {
    const design = byId.get(id);
    if (!design) return [];
    const { text, soldOut } = bookedLabel(availability(design, active), active);
    return [{ id, name: nameOf(design), image: thumbnailOf(design), label: text, soldOut }];
  });
}
