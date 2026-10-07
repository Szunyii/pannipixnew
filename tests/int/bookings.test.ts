import type { Payload } from "payload";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
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

describe("booking rules", () => {
  it("books a single design once and frees it when the booking is rejected", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    const first = await createSlot(payload);
    const second = await createSlot(payload);

    const booking = await createBooking(payload, design.id, first.id);
    expect(booking.seat).toBe(1);
    await expect(createBooking(payload, design.id, second.id)).rejects.toMatchObject({ code: "sold_out" });

    const rejected = await payload.update({ collection: "bookings", id: booking.id, data: { status: "rejected" } });
    expect(rejected.slot).toBeNull();
    expect(rejected.seat).toBeNull();
    expect(rejected.slotStartsAt).toBe(first.startsAt);

    expect((await createBooking(payload, design.id, first.id)).seat).toBe(1);
  });

  it("books a limited design as many times as its collection allows", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "limited", 2)).id);
    const seats = [];
    for (let i = 0; i < 2; i += 1) seats.push((await createBooking(payload, design.id, (await createSlot(payload)).id)).seat);
    expect(seats).toEqual([1, 2]);
    await expect(createBooking(payload, design.id, (await createSlot(payload)).id)).rejects.toMatchObject({
      code: "sold_out",
    });
  });

  it("books an unlimited design any number of times", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "unlimited")).id);
    for (let i = 0; i < 3; i += 1) {
      const booking = await createBooking(payload, design.id, (await createSlot(payload)).id);
      expect(booking.seat).toBeNull();
    }
  });

  it("gives a slot to one booking only", async () => {
    const category = await createCategory(payload, "unlimited");
    const [a, b] = [await createDesign(payload, category.id), await createDesign(payload, category.id)];
    const slot = await createSlot(payload);
    await createBooking(payload, a.id, slot.id);
    await expect(createBooking(payload, b.id, slot.id)).rejects.toMatchObject({ code: "slot_taken" });
  });

  it("never brings a rejected or cancelled booking back", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    const booking = await createBooking(payload, design.id, (await createSlot(payload)).id);
    await payload.update({ collection: "bookings", id: booking.id, data: { status: "rejected" } });

    await expect(
      payload.update({ collection: "bookings", id: booking.id, data: { status: "confirmed" } }),
    ).rejects.toMatchObject({ code: "reactivate" });
    const cancelled = await payload.update({ collection: "bookings", id: booking.id, data: { status: "cancelled" } });
    expect(cancelled.status).toBe("cancelled");
  });

  it("does not create a booking that is already rejected", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    await expect(
      createBooking(payload, design.id, (await createSlot(payload)).id, { status: "rejected" }),
    ).rejects.toMatchObject({ code: "create_released" });
  });

  it("moves a booking only to a free slot", async () => {
    const category = await createCategory(payload, "unlimited");
    const [a, b] = [await createDesign(payload, category.id), await createDesign(payload, category.id)];
    const [s1, s2, s3] = [await createSlot(payload), await createSlot(payload), await createSlot(payload)];
    await createBooking(payload, a.id, s1.id);
    const moving = await createBooking(payload, b.id, s2.id);

    await expect(
      payload.update({ collection: "bookings", id: moving.id, data: { slot: s1.id } }),
    ).rejects.toMatchObject({ code: "slot_taken" });
    const moved = await payload.update({ collection: "bookings", id: moving.id, data: { slot: s3.id } });
    expect(moved.slotStartsAt).toBe(s3.startsAt);
  });

  it("checks the limit again when a booking moves to another design", async () => {
    const category = await createCategory(payload, "single");
    const [taken, other, free] = [
      await createDesign(payload, category.id),
      await createDesign(payload, category.id),
      await createDesign(payload, category.id),
    ];
    await createBooking(payload, taken.id, (await createSlot(payload)).id);
    const moving = await createBooking(payload, other.id, (await createSlot(payload)).id);

    await expect(
      payload.update({ collection: "bookings", id: moving.id, data: { design: taken.id } }),
    ).rejects.toMatchObject({ code: "sold_out" });
    const moved = await payload.update({ collection: "bookings", id: moving.id, data: { design: free.id } });
    expect(moved.designName).toBe(`${category.name} #${free.number}`);
    expect(moved.seat).toBe(1);
  });

  it("keeps a design sold out when its collection's limit is lowered under the active bookings", async () => {
    const category = await createCategory(payload, "limited", 3);
    const design = await createDesign(payload, category.id);
    const bookings = [];
    for (let i = 0; i < 3; i += 1) bookings.push(await createBooking(payload, design.id, (await createSlot(payload)).id));
    // Seats 2 and 3 stay active, so a free seat (1) exists below the new limit: only the count may refuse.
    await payload.update({ collection: "bookings", id: bookings[0].id, data: { status: "cancelled" } });
    await payload.update({ collection: "categories", id: category.id, data: { limit: 2 } });
    await expect(createBooking(payload, design.id, (await createSlot(payload)).id)).rejects.toMatchObject({
      code: "sold_out",
    });
  });

  it("counts the bookings made while the collection was unlimited", async () => {
    const category = await createCategory(payload, "unlimited");
    const design = await createDesign(payload, category.id);
    for (let i = 0; i < 2; i += 1) await createBooking(payload, design.id, (await createSlot(payload)).id);
    await payload.update({ collection: "categories", id: category.id, data: { rule: "limited", limit: 3 } });

    expect((await createBooking(payload, design.id, (await createSlot(payload)).id)).seat).toBe(1);
    await expect(createBooking(payload, design.id, (await createSlot(payload)).id)).rejects.toMatchObject({
      code: "sold_out",
    });
  });

  it("records the design, price and time at booking and names the booking", async () => {
    const category = await createCategory(payload, "single");
    const design = await createDesign(payload, category.id, { price: 110000 });
    const slot = await createSlot(payload);
    const booking = await createBooking(payload, design.id, slot.id);
    expect(booking).toMatchObject({
      designName: `${category.name} #${design.number}`,
      price: 110000,
      slotStartsAt: slot.startsAt,
      title: `Teszt Elek — ${category.name} #${design.number}`,
    });
  });

  it("lets the admin book a hidden design on a past slot", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id, { visible: false });
    const booking = await createBooking(payload, design.id, (await createSlot(payload, { past: true })).id, {
      status: "completed",
    });
    expect(booking.status).toBe("completed");
  });
});
