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
    await payload.delete({ collection, where: { id: { exists: true } }, overrideAccess: true });
  }
}

export async function createCategory(payload: Payload, rule: BookingRule, limit?: number) {
  sequence += 1;
  return payload.create({ collection: "categories", data: { name: `Teszt ${sequence}`, rule, limit, order: sequence } });
}

async function testImage(payload: Payload) {
  imageId ??= (
    await payload.create({
      collection: "media",
      data: { alt: "Tesztminta" },
      filePath: fileURLToPath(new URL("./fixtures/sample.webp", import.meta.url)),
    })
  ).id;
  return imageId;
}

export async function createDesign(payload: Payload, categoryId: number, data: { visible?: boolean; price?: number } = {}) {
  sequence += 1;
  return payload.create({
    collection: "designs",
    data: {
      category: categoryId,
      number: String(sequence).padStart(3, "0"),
      price: data.price ?? 90000,
      visible: data.visible ?? true,
      images: [{ image: await testImage(payload), kind: "art", label: "Minta" }],
    },
  });
}

/** A slot a week from now (or a week ago), an hour after the previous one so start times never collide. */
export async function createSlot(payload: Payload, { past = false } = {}) {
  sequence += 1;
  const startsAt = new Date(Date.now() + (past ? -7 : 7) * DAY + sequence * HOUR).toISOString();
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
