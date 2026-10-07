import type { Payload } from "payload";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicBooking } from "@/cms/booking/public";
import { sendBookingEmails } from "@/cms/emails/send";
import type { Booking } from "@/payload-types";
import {
  createBooking,
  createCategory,
  createDesign,
  createSlot,
  customer,
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

/** The id of the one booking in the database: a booking whose emails failed must still have been saved. */
async function onlyBookingId() {
  const { docs } = await payload.find({ collection: "bookings", pagination: false });
  expect(docs).toHaveLength(1);
  return docs[0].id;
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
    // A plain function, not a mock: a vi.fn() keeps the promise it returns, which counts as handling its rejection
    // and would hide a missing .catch in the hook.
    const smtpDown = new Error("SMTP down");
    const spied = payload.sendEmail;
    payload.sendEmail = () => Promise.reject(smtpDown);
    const logged = vi.spyOn(payload.logger, "error").mockImplementation(() => undefined);
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const d = await design();
      const result = await createPublicBooking(payload, publicInput(d.id, (await createSlot(payload)).id));
      // Node reports an unhandled rejection a turn or two after it happens.
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(result.ok).toBe(true);
      const id = await onlyBookingId();
      expect(unhandled).toEqual([]);
      expect(logged).toHaveBeenCalledTimes(2);
      expect(logged).toHaveBeenNthCalledWith(1, {
        err: smtpDown,
        msg: `Booking email "admin-new" for booking ${id} failed`,
      });
      expect(logged).toHaveBeenNthCalledWith(2, {
        err: smtpDown,
        msg: `Booking email "customer-received" for booking ${id} failed`,
      });
    } finally {
      process.off("unhandledRejection", onUnhandled);
      payload.sendEmail = spied;
    }
  });

  it("keep sending the other emails when one fails at once", async () => {
    const boom = new Error("no adapter");
    const logged = vi.spyOn(payload.logger, "error").mockImplementation(() => undefined);
    // payload.sendEmail is the spy from beforeEach. The admin's email goes first and throws before it can return a promise.
    vi.mocked(payload.sendEmail).mockImplementationOnce(() => {
      throw boom;
    });
    const d = await design();
    const result = await createPublicBooking(payload, publicInput(d.id, (await createSlot(payload)).id));

    expect(result.ok).toBe(true);
    const id = await onlyBookingId();
    expect(sent.map((m) => m.to)).toEqual(["teszt.elek@example.com"]);
    expect(logged).toHaveBeenCalledOnce();
    expect(logged).toHaveBeenCalledWith({ err: boom, msg: `Booking email "admin-new" for booking ${id} failed` });
  });

  it("never let an email that cannot be built stop a booking", async () => {
    const logged = vi.spyOn(payload.logger, "error").mockImplementation(() => undefined);
    const doc: Booking = {
      ...customer,
      id: 7,
      design: 1,
      status: "pending",
      designName: "Teszt #001",
      // Intl refuses to format this, so every template throws while it renders.
      slotStartsAt: "not a date",
      price: 90000,
      createdAt: "2026-10-07T08:00:00.000Z",
      updatedAt: "2026-10-07T08:00:00.000Z",
    };
    const args = {
      doc,
      previousDoc: {},
      operation: "create",
      context: { publicBooking: true },
      req: { payload },
    } as unknown as Parameters<typeof sendBookingEmails>[0];

    await expect(sendBookingEmails(args)).resolves.toBe(doc);

    expect(sent).toEqual([]);
    expect(logged).toHaveBeenCalledTimes(2);
    expect(logged).toHaveBeenNthCalledWith(1, {
      err: expect.any(RangeError),
      msg: 'Booking email "admin-new" for booking 7 failed',
    });
    expect(logged).toHaveBeenNthCalledWith(2, {
      err: expect.any(RangeError),
      msg: 'Booking email "customer-received" for booking 7 failed',
    });
  });
});
