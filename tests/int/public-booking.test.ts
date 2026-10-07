import type { Payload } from "payload";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPublicBooking } from "@/cms/booking/public";
import {
  createCategory,
  createDesign,
  createSlot,
  customer,
  getTestPayload,
  publicInput,
  resetDatabase,
} from "../helpers";

let payload: Payload;

beforeAll(async () => {
  payload = await getTestPayload();
});

beforeEach(async () => {
  await resetDatabase(payload);
});

describe("website bookings", () => {
  it("always start as pending", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    const booking = await payload.create({
      collection: "bookings",
      data: { ...customer, design: design.id, slot: (await createSlot(payload)).id, status: "confirmed" },
      context: { publicBooking: true },
    });
    expect(booking.status).toBe("pending");
  });

  it("refuse past slots and hidden designs", async () => {
    const category = await createCategory(payload, "unlimited");
    const design = await createDesign(payload, category.id);
    const hidden = await createDesign(payload, category.id, { visible: false });

    expect(await createPublicBooking(payload, publicInput(design.id, (await createSlot(payload, { past: true })).id))).toEqual({
      ok: false,
      code: "slot_past",
    });
    expect(await createPublicBooking(payload, publicInput(hidden.id, (await createSlot(payload)).id))).toEqual({
      ok: false,
      code: "design_unavailable",
    });
  });

  it("report a slot that no longer exists as taken", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "unlimited")).id);
    expect(await createPublicBooking(payload, publicInput(design.id, 999_999))).toEqual({ ok: false, code: "slot_taken" });
  });

  it("let exactly one of two simultaneous requests take the last booking of a design", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    const [s1, s2] = [await createSlot(payload), await createSlot(payload)];

    const results = await Promise.all([
      createPublicBooking(payload, publicInput(design.id, s1.id)),
      createPublicBooking(payload, publicInput(design.id, s2.id)),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, code: "sold_out" });
    expect((await payload.count({ collection: "bookings" })).totalDocs).toBe(1);
  });

  it("let two simultaneous requests share a design with two bookings left", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "limited", 2)).id);
    const [s1, s2] = [await createSlot(payload), await createSlot(payload)];

    const results = await Promise.all([
      createPublicBooking(payload, publicInput(design.id, s1.id)),
      createPublicBooking(payload, publicInput(design.id, s2.id)),
    ]);

    expect(results.every((r) => r.ok)).toBe(true);
    const booked = await payload.find({ collection: "bookings", where: { design: { equals: design.id } }, pagination: false });
    expect(booked.docs.map((b) => b.seat ?? 0).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("give every seat to a crowd that asks at once, and tell the rest it sold out", async () => {
    // More requests than MAX_ATTEMPTS: if the losers retried in lockstep, the last ones would run out of attempts.
    const design = await createDesign(payload, (await createCategory(payload, "limited", 12)).id);
    const slots = [];
    for (let i = 0; i < 14; i += 1) slots.push(await createSlot(payload));

    const results = await Promise.all(slots.map((s) => createPublicBooking(payload, publicInput(design.id, s.id))));

    expect(results.filter((r) => r.ok)).toHaveLength(12);
    expect(results.filter((r) => !r.ok)).toEqual(Array(2).fill({ ok: false, code: "sold_out" }));
    const booked = await payload.find({ collection: "bookings", where: { design: { equals: design.id } }, pagination: false });
    expect(booked.docs.map((b) => b.seat ?? 0).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("let exactly one of two simultaneous requests take a slot", async () => {
    const category = await createCategory(payload, "unlimited");
    const [a, b] = [await createDesign(payload, category.id), await createDesign(payload, category.id)];
    const slot = await createSlot(payload);

    const results = await Promise.all([
      createPublicBooking(payload, publicInput(a.id, slot.id)),
      createPublicBooking(payload, publicInput(b.id, slot.id)),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, code: "slot_taken" });
  });
});
