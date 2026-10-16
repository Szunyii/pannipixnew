import { inspect } from "node:util";
import type { Payload } from "payload";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicBooking } from "@/cms/booking/public";
import {
  createDesign,
  createSlot,
  customer,
  getTestPayload,
  publicInput,
  resetDatabase,
} from "../helpers";

// Both settings of the switch are pinned here, so the tests hold whichever way lib/features.ts has it.
const features = vi.hoisted(() => ({ slotPicking: true }));
vi.mock("@/lib/features", () => ({
  get SLOT_PICKING() {
    return features.slotPicking;
  },
}));

let payload: Payload;

beforeAll(async () => {
  payload = await getTestPayload();
});

beforeEach(async () => {
  features.slotPicking = true;
  await resetDatabase(payload);
});

describe("website bookings", () => {
  it("always start as pending", async () => {
    const design = await createDesign(payload);
    const booking = await payload.create({
      collection: "bookings",
      data: { ...customer, design: design.id, slot: (await createSlot(payload)).id, status: "confirmed" },
      context: { publicBooking: true },
    });
    expect(booking.status).toBe("pending");
  });

  it("refuse past slots and hidden designs", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    const hidden = await createDesign(payload, { rule: "unlimited", visible: false });

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
    const design = await createDesign(payload, { rule: "unlimited" });
    expect(await createPublicBooking(payload, publicInput(design.id, 999_999))).toEqual({ ok: false, code: "slot_taken" });
  });

  it("let exactly one of two simultaneous requests take the last booking of a design", async () => {
    const design = await createDesign(payload);
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
    const design = await createDesign(payload, { rule: "limited", limit: 2 });
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
    const design = await createDesign(payload, { rule: "limited", limit: 12 });
    const slots = [];
    for (let i = 0; i < 14; i += 1) slots.push(await createSlot(payload));

    const results = await Promise.all(slots.map((s) => createPublicBooking(payload, publicInput(design.id, s.id))));

    expect(results.filter((r) => r.ok)).toHaveLength(12);
    expect(results.filter((r) => !r.ok)).toEqual(Array(2).fill({ ok: false, code: "sold_out" }));
    const booked = await payload.find({ collection: "bookings", where: { design: { equals: design.id } }, pagination: false });
    expect(booked.docs.map((b) => b.seat ?? 0).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("log a failed insert without the booking's data", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    const slot = await createSlot(payload);
    const booking = { ...publicInput(design.id, slot.id), note: "Allergiás vagyok a festékre" };
    const details = [booking.name, booking.email, booking.phone, booking.note];
    // The database turns every booking insert away, as a full disk would. Drizzle then throws an error whose message
    // lists the query's parameters: the visitor's name, email, phone and note.
    await payload.db.drizzle.$client.execute(
      "CREATE TRIGGER refuse_booking BEFORE INSERT ON bookings BEGIN SELECT RAISE(ABORT, 'disk I/O error'); END",
    );
    const create = vi.spyOn(payload, "create");
    const logged = vi.spyOn(payload.logger, "error").mockImplementation(() => undefined);
    try {
      expect(await createPublicBooking(payload, booking)).toEqual({ ok: false, code: "unknown" });

      const failure = await (create.mock.results[0].value as Promise<unknown>).catch((err: unknown) => err);
      for (const detail of details) expect(inspect(failure, { depth: null })).toContain(detail);
      expect(logged.mock.calls).toEqual([
        [{ err: { name: "Error", code: "SQLITE_CONSTRAINT_TRIGGER" }, attempts: 1, msg: "Website booking failed" }],
      ]);
      for (const detail of details) expect(inspect(logged.mock.calls, { depth: null })).not.toContain(detail);
    } finally {
      create.mockRestore();
      logged.mockRestore();
      await payload.db.drizzle.$client.execute("DROP TRIGGER refuse_booking");
    }
  });

  it("log which field Payload refused, not what the visitor entered", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    const slot = await createSlot(payload);
    // An address Payload's email field turns away.
    const booking = { ...publicInput(design.id, slot.id), email: "not-an-email" };
    const logged = vi.spyOn(payload.logger, "error").mockImplementation(() => undefined);
    try {
      expect(await createPublicBooking(payload, booking)).toEqual({ ok: false, code: "unknown" });

      expect(logged.mock.calls).toEqual([
        [{ err: { name: "ValidationError", paths: ["email"] }, attempts: 1, msg: "Website booking failed" }],
      ]);
      for (const detail of [booking.name, booking.email, booking.phone]) {
        expect(inspect(logged.mock.calls, { depth: null })).not.toContain(detail);
      }
    } finally {
      logged.mockRestore();
    }
  });

  it("let exactly one of two simultaneous requests take a slot", async () => {
    const [a, b] = [await createDesign(payload, { rule: "unlimited" }), await createDesign(payload, { rule: "unlimited" })];
    const slot = await createSlot(payload);

    const results = await Promise.all([
      createPublicBooking(payload, publicInput(a.id, slot.id)),
      createPublicBooking(payload, publicInput(b.id, slot.id)),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, code: "slot_taken" });
  });

  it("must name a slot while visitors pick one, though the admin may still leave it for later", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    const data = { ...customer, design: design.id, status: "pending" } as const;

    await expect(
      payload.create({ collection: "bookings", data, context: { publicBooking: true } }),
    ).rejects.toMatchObject({ code: "slot_required", data: { errors: [{ path: "slot", message: "Válassz időpontot." }] } });
    expect((await payload.create({ collection: "bookings", data })).status).toBe("pending");
  });
});

describe("website bookings while visitors don't pick a slot", () => {
  beforeEach(() => {
    features.slotPicking = false;
  });

  it("hold the design without a slot, for the admin to give them one", async () => {
    const design = await createDesign(payload);

    const result = await createPublicBooking(payload, publicInput(design.id));

    expect(result).toEqual({ ok: true, bookingId: expect.any(Number) });
    const { docs } = await payload.find({ collection: "bookings", depth: 0, pagination: false });
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ status: "pending", seat: 1, design: design.id });
    expect(docs[0].slot ?? null).toBeNull();
    expect(docs[0].slotStartsAt ?? null).toBeNull();
    expect(await createPublicBooking(payload, publicInput(design.id))).toEqual({ ok: false, code: "sold_out" });
  });

  it("let exactly one of two simultaneous requests take the last booking of a design", async () => {
    const design = await createDesign(payload);

    const results = await Promise.all([
      createPublicBooking(payload, publicInput(design.id)),
      createPublicBooking(payload, publicInput(design.id)),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, code: "sold_out" });
    expect((await payload.count({ collection: "bookings" })).totalDocs).toBe(1);
  });

  it("book an unlimited design any number of times, none of them holding a slot", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });

    const results = await Promise.all([1, 2, 3].map(() => createPublicBooking(payload, publicInput(design.id))));

    expect(results.every((r) => r.ok)).toBe(true);
    expect((await payload.count({ collection: "bookings", where: { slot: { exists: true } } })).totalDocs).toBe(0);
  });
});
