import type { Payload } from "payload";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getFlashCatalog, listOpenSlots } from "@/lib/flash";
import {
  createBooking,
  createCategory,
  createDesign,
  createSlot,
  getTestPayload,
  resetDatabase,
} from "../helpers";

let payload: Payload;

beforeAll(async () => {
  payload = await getTestPayload();
});

beforeEach(async () => {
  await resetDatabase(payload);
});

describe("getFlashCatalog", () => {
  it("lists visible designs, newest first, with live availability", async () => {
    const single = await createCategory(payload, "single");
    const limited = await createCategory(payload, "limited", 3);
    const booked = await createDesign(payload, single.id);
    // createdAt has millisecond precision; keep the two designs apart so "newest first" is well defined.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const limitedDesign = await createDesign(payload, limited.id);
    await createDesign(payload, single.id, { visible: false });
    await createBooking(payload, booked.id, (await createSlot(payload)).id);
    await createBooking(payload, limitedDesign.id, (await createSlot(payload)).id);

    const { categories, designs } = await getFlashCatalog();

    expect(categories.map((c) => c.name)).toEqual([single.name, limited.name]);
    expect(designs.map((d) => d.id)).toEqual([limitedDesign.id, booked.id]);
    expect(designs[0]).toMatchObject({
      number: limitedDesign.number,
      collection: limited.name,
      availability: { rule: "limited", limit: 3, remaining: 2, soldOut: false },
    });
    expect(designs[1].availability).toEqual({ rule: "single", limit: 1, remaining: 0, soldOut: true });
    expect(designs[1].images[0]).toMatchObject({ kind: "art", label: "Minta", alt: "Tesztminta" });
    expect(designs[1].images[0].src).toMatch(/^\/api\/media\/file\//);
  });

  it("frees a seat again once the booking is rejected", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    const booking = await createBooking(payload, design.id, (await createSlot(payload)).id);
    await payload.update({ collection: "bookings", id: booking.id, data: { status: "rejected" } });
    const { designs } = await getFlashCatalog();
    expect(designs[0].availability.soldOut).toBe(false);
  });
});

describe("listOpenSlots", () => {
  it("offers only future slots nobody holds, grouped by day", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "unlimited")).id);
    const free = await createSlot(payload);
    const held = await createSlot(payload);
    await createSlot(payload, { past: true });
    await createBooking(payload, design.id, held.id);

    const days = await listOpenSlots();
    expect(days.flatMap((d) => d.slots.map((s) => s.id))).toEqual([free.id]);
  });
});
