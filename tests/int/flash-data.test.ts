import type { Payload } from "payload";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getFlashCatalog, listOpenSlots } from "@/lib/flash";
import { createBooking, createDesign, createSlot, getTestPayload, resetDatabase } from "../helpers";

let payload: Payload;

beforeAll(async () => {
  payload = await getTestPayload();
});

beforeEach(async () => {
  await resetDatabase(payload);
});

describe("getFlashCatalog", () => {
  it("lists visible designs, newest first, with live availability", async () => {
    const booked = await createDesign(payload, { category: "pcons", rule: "single" });
    // createdAt has millisecond precision; keep the two designs apart so "newest first" is well defined.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const limitedDesign = await createDesign(payload, { category: "ornx", rule: "limited", limit: 3 });
    await createDesign(payload, { visible: false });
    await createBooking(payload, booked.id, (await createSlot(payload)).id);
    await createBooking(payload, limitedDesign.id, (await createSlot(payload)).id);

    const designs = await getFlashCatalog();

    expect(designs.map((d) => d.id)).toEqual([limitedDesign.id, booked.id]);
    expect(designs[0]).toMatchObject({
      number: limitedDesign.number,
      category: "ornx",
      collection: "ORNX",
      availability: { rule: "limited", limit: 3, remaining: 2, soldOut: false },
    });
    expect(designs[1]).toMatchObject({ category: "pcons", collection: "P’CONs" });
    expect(designs[1].availability).toEqual({ rule: "single", limit: 1, remaining: 0, soldOut: true });
    expect(designs[1].images[0]).toMatchObject({ kind: "art", label: "Minta", alt: "Tesztminta" });
    expect(designs[1].images[0].src).toMatch(/^\/api\/media\/file\//);
  });

  it("takes each design's availability from its own rule, also within one collection", async () => {
    const once = await createDesign(payload, { category: "pcons", rule: "single" });
    const always = await createDesign(payload, { category: "pcons", rule: "unlimited" });
    for (const design of [once, always]) await createBooking(payload, design.id, (await createSlot(payload)).id);

    const designs = await getFlashCatalog();

    const availabilityOf = (id: number) => designs.find((d) => d.id === id)?.availability;
    expect(availabilityOf(once.id)).toEqual({ rule: "single", limit: 1, remaining: 0, soldOut: true });
    expect(availabilityOf(always.id)).toEqual({ rule: "unlimited", limit: null, remaining: null, soldOut: false });
  });

  it("frees a seat again once the booking is rejected", async () => {
    const design = await createDesign(payload);
    const booking = await createBooking(payload, design.id, (await createSlot(payload)).id);
    await payload.update({ collection: "bookings", id: booking.id, data: { status: "rejected" } });
    const designs = await getFlashCatalog();
    expect(designs[0].availability.soldOut).toBe(false);
  });
});

describe("listOpenSlots", () => {
  const openSlotIds = async () => (await listOpenSlots()).flatMap((day) => day.slots.map((slot) => slot.id));

  it("offers only future slots nobody holds, grouped by day", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    const free = await createSlot(payload);
    const held = await createSlot(payload);
    await createSlot(payload, { past: true });
    await createBooking(payload, design.id, held.id);

    expect(await openSlotIds()).toEqual([free.id]);
  });

  it("offers a slot again once the booking that held it is rejected", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    const slot = await createSlot(payload);
    const booking = await createBooking(payload, design.id, slot.id);
    expect(await openSlotIds()).toEqual([]);

    await payload.update({ collection: "bookings", id: booking.id, data: { status: "rejected" } });

    expect(await openSlotIds()).toEqual([slot.id]);
  });
});
