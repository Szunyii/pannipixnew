import { fileURLToPath } from "node:url";
import config from "@payload-config";
import { getPayload, type Payload } from "payload";
import type { BookingInput } from "@/lib/booking-input";
import type { BookingRule } from "@/lib/booking-rules";
import type { Booking } from "@/payload-types";

export function getTestPayload(): Promise<Payload> {
  return getPayload({ config });
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let sequence = 0;
let imageId: number | undefined;

/** Clears everything but images and admins, in the order the delete guards allow. */
export async function resetDatabase(payload: Payload) {
  for (const collection of ["bookings", "slots", "designs", "categories"] as const) {
    // A bulk delete reports the documents it couldn't delete instead of throwing.
    const { errors } = await payload.delete({ collection, where: { id: { exists: true } }, overrideAccess: true });
    if (errors.length > 0) throw new Error(`Could not clear ${collection}: ${errors.map((e) => e.message).join("; ")}`);
  }
}

export async function createCategory(payload: Payload, rule: BookingRule, limit?: number) {
  sequence += 1;
  return payload.create({ collection: "categories", data: { name: `Teszt ${sequence}`, rule, limit, order: sequence } });
}

/** Uploads the fixture image as a new media document. */
export function createImage(payload: Payload) {
  return payload.create({
    collection: "media",
    data: { alt: "Tesztminta" },
    filePath: fileURLToPath(new URL("./fixtures/sample.webp", import.meta.url)),
  });
}

/** One image shared by every design that doesn't ask for its own. */
async function testImage(payload: Payload) {
  imageId ??= (await createImage(payload)).id;
  return imageId;
}

export async function createDesign(
  payload: Payload,
  categoryId: number,
  data: { visible?: boolean; price?: number; number?: string; image?: number } = {},
) {
  sequence += 1;
  return payload.create({
    collection: "designs",
    data: {
      category: categoryId,
      number: data.number ?? String(sequence).padStart(3, "0"),
      price: data.price ?? 90000,
      visible: data.visible ?? true,
      images: [{ image: data.image ?? (await testImage(payload)), kind: "art", label: "Minta" }],
    },
  });
}

/** A slot over a week from now (or over a week ago); each call goes an hour further, so start times never collide. */
export async function createSlot(payload: Payload, { past = false } = {}) {
  sequence += 1;
  const offset = 7 * DAY + sequence * HOUR;
  const startsAt = new Date(Date.now() + (past ? -offset : offset)).toISOString();
  return payload.create({ collection: "slots", data: { startsAt } });
}

export const customer = {
  name: "Teszt Elek",
  email: "teszt.elek@example.com",
  phone: "+36 30 123 4567",
  placement: "alkar",
  adultConfirmed: true,
} as const;

/** Books the way the admin panel does: no website-only rules apply. */
export async function createBooking(
  payload: Payload,
  design: number,
  slot: number,
  data: { status?: Booking["status"] } = {},
) {
  return payload.create({ collection: "bookings", data: { ...customer, design, slot, status: data.status ?? "pending" } });
}

/** What the website form sends for a design and a slot. */
export function publicInput(designId: number, slotId: number): BookingInput {
  const { name, email, phone, placement } = customer;
  return { designId, slotId, name, email, phone, placement, note: "", website: "" };
}
