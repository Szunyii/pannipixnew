import type { Payload } from "payload";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicBooking } from "@/cms/booking/public";
import {
  createBooking,
  createCategory,
  createDesign,
  createSlot,
  getTestPayload,
  publicInput,
  resetDatabase,
} from "../helpers";

let payload: Payload;
let sent: { to: string; subject: string }[];

beforeAll(async () => {
  payload = await getTestPayload();
});

beforeEach(async () => {
  await resetDatabase(payload);
  sent = [];
  vi.spyOn(payload, "sendEmail").mockImplementation(async (message) => {
    sent.push({ to: String(message.to), subject: String(message.subject) });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function design() {
  return createDesign(payload, (await createCategory(payload, "unlimited")).id);
}

describe("booking emails", () => {
  it("tell the admin and the customer about a website booking", async () => {
    const d = await design();
    await createPublicBooking(payload, publicInput(d.id, (await createSlot(payload)).id));
    expect(sent.map((m) => m.to)).toEqual(["admin@example.com", "teszt.elek@example.com"]);
    expect(sent[0].subject).toMatch(/^Új foglalás: /);
    expect(sent[1].subject).toMatch(/^Megkaptam a foglalásod/);
  });

  it("follow the status: confirmed, then cancelled", async () => {
    const booking = await createBooking(payload, (await design()).id, (await createSlot(payload)).id);
    sent = [];
    await payload.update({ collection: "bookings", id: booking.id, data: { status: "confirmed" } });
    await payload.update({ collection: "bookings", id: booking.id, data: { status: "cancelled" } });
    expect(sent.map((m) => m.subject.split(":")[0])).toEqual(["Visszaigazolva", "Lemondva"]);
  });

  it("stay quiet when a booking is completed", async () => {
    const booking = await createBooking(payload, (await design()).id, (await createSlot(payload)).id);
    sent = [];
    await payload.update({ collection: "bookings", id: booking.id, data: { status: "completed" } });
    expect(sent).toEqual([]);
  });

  it("never stop a booking when sending fails", async () => {
    vi.spyOn(payload, "sendEmail").mockRejectedValue(new Error("SMTP down"));
    const d = await design();
    const result = await createPublicBooking(payload, publicInput(d.id, (await createSlot(payload)).id));
    expect(result.ok).toBe(true);
  });
});
