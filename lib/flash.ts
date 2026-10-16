import config from "@payload-config";
import { getPayload } from "payload";
import { cache } from "react";
import type { Design } from "@/payload-types";
import { ACTIVE_STATUSES, availability, relationId } from "./booking-rules";
import { categoryName } from "./categories";
import type { DesignImage, FlashDesign } from "./flash-types";
import { type SlotDay, groupSlotsByDay } from "./time";

/** The visible designs, newest first, with live availability. Read once per request: a page and its metadata share it. */
export const getFlashCatalog = cache(async (): Promise<FlashDesign[]> => {
  const payload = await getPayload({ config });
  const [designs, active] = await Promise.all([
    payload.find({
      collection: "designs",
      where: { visible: { equals: true } },
      sort: "-createdAt",
      depth: 1,
      pagination: false,
    }),
    payload.find({
      collection: "bookings",
      where: { status: { in: [...ACTIVE_STATUSES] } },
      select: { design: true },
      depth: 0,
      pagination: false,
    }),
  ]);

  const counts = new Map<number, number>();
  for (const booking of active.docs) {
    const id = relationId(booking.design);
    if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return designs.docs.flatMap((d) => toFlashDesign(d, counts.get(d.id) ?? 0) ?? []);
});

function toFlashDesign(doc: Design, activeCount: number): FlashDesign | null {
  const images: DesignImage[] = (doc.images ?? []).flatMap(({ image, kind, label }) =>
    image && typeof image === "object" && image.url
      ? [{ src: image.url, alt: image.alt, kind: kind === "photo" ? "photo" : "art", label: label || "Minta" }]
      : [],
  );
  // Without any image a design can't be drawn as a card.
  if (images.length === 0) return null;
  return {
    id: doc.id,
    number: doc.number,
    category: doc.category,
    collection: categoryName(doc.category),
    price: doc.price,
    size: doc.size ?? "",
    placements: doc.placements ?? "",
    description: doc.description ?? "",
    badge: doc.badge === "new" ? "Új" : doc.badge === "last" ? "Utolsó" : undefined,
    createdAt: doc.createdAt,
    images,
    availability: availability(doc, activeCount),
  };
}

/** Future slots no booking holds, grouped by Budapest day. */
export async function listOpenSlots(now = new Date()): Promise<SlotDay[]> {
  const payload = await getPayload({ config });
  const [slots, held] = await Promise.all([
    payload.find({
      collection: "slots",
      where: { startsAt: { greater_than: now.toISOString() } },
      select: { startsAt: true },
      sort: "startsAt",
      depth: 0,
      pagination: false,
    }),
    payload.find({
      collection: "bookings",
      where: { slot: { exists: true } },
      select: { slot: true },
      depth: 0,
      pagination: false,
    }),
  ]);
  const taken = new Set(held.docs.map((b) => relationId(b.slot)));
  return groupSlotsByDay(slots.docs.filter((s) => !taken.has(s.id)));
}
