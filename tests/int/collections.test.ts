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

describe("collections", () => {
  it("names designs and slots for the admin", async () => {
    const category = await createCategory(payload, "single");
    const design = await createDesign(payload, category.id);
    expect(design.title).toBe(`${category.name} #${design.number}`);

    const slot = await payload.create({ collection: "slots", data: { startsAt: "2026-10-14T08:00:00.000Z" } });
    expect(slot.title).toBe("2026. 10. 14. (szerda) 10:00");
  });

  it("asks for at least two bookings on a limited collection", async () => {
    await expect(
      payload.create({ collection: "categories", data: { name: "Hibás", rule: "limited", limit: 1 } }),
    ).rejects.toThrow();
    expect((await createCategory(payload, "limited", 2)).limit).toBe(2);
  });

  it("hides switched-off designs from visitors", async () => {
    const category = await createCategory(payload, "single");
    await createDesign(payload, category.id, { visible: false });
    const shown = await createDesign(payload, category.id);
    const result = await payload.find({ collection: "designs", overrideAccess: false });
    expect(result.docs.map((d) => d.id)).toEqual([shown.id]);
  });

  it("keeps referenced collections, designs and slots from being deleted", async () => {
    const category = await createCategory(payload, "unlimited");
    const design = await createDesign(payload, category.id);
    const slot = await createSlot(payload);
    await createBooking(payload, design.id, slot.id);

    await expect(payload.delete({ collection: "categories", id: category.id })).rejects.toThrow(/minta tartozik/);
    await expect(payload.delete({ collection: "designs", id: design.id })).rejects.toThrow(/foglalás tartozik/);
    await expect(payload.delete({ collection: "slots", id: slot.id })).rejects.toThrow(/foglalás tartozik/);
  });

  it("shows whether a slot is free, booked or past", async () => {
    const category = await createCategory(payload, "unlimited");
    const design = await createDesign(payload, category.id);
    const free = await createSlot(payload);
    const booked = await createSlot(payload);
    const past = await createSlot(payload, { past: true });
    await createBooking(payload, design.id, booked.id);

    const state = async (id: number) => (await payload.findByID({ collection: "slots", id })).state;
    expect(await state(free.id)).toBe("Szabad");
    expect(await state(booked.id)).toBe("Foglalt");
    expect(await state(past.id)).toBe("Lejárt");
  });
});
