import { inspect } from "node:util";
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
/** What the mail adapter was asked to send, as plain strings. */
let sent: { to: string; replyTo?: string; subject: string; text: string; headers?: unknown }[];

beforeAll(async () => {
  payload = await getTestPayload();
});

beforeEach(async () => {
  await resetDatabase(payload);
  sent = [];
  vi.spyOn(payload, "sendEmail").mockImplementation(async (message) => {
    sent.push({
      to: String(message.to),
      replyTo: message.replyTo === undefined ? undefined : String(message.replyTo),
      subject: String(message.subject),
      text: String(message.text),
      headers: message.headers,
    });
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

/** Books a design on the website and returns the new booking's id. */
async function bookOnTheWebsite() {
  const d = await design();
  const result = await createPublicBooking(payload, publicInput(d.id, (await createSlot(payload)).id));
  expect(result.ok).toBe(true);
  return onlyBookingId();
}

/** Runs `run` with an environment variable set (undefined removes it), then puts the variable back. */
async function withEnv(name: string, value: string | undefined, run: () => Promise<void>) {
  const original = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    await run();
  } finally {
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
}

describe("booking emails", () => {
  it("tell the admin and the customer about a website booking", async () => {
    await bookOnTheWebsite();
    expect(sent.map((m) => m.to)).toEqual(["admin@example.com", customer.email]);
    expect(sent[0].subject).toMatch(/^Új foglalás: /);
    expect(sent[1].subject).toMatch(/^Megkaptam a foglalásod/);
  });

  it.each(["https://pannipix.test", "https://pannipix.test/"])("send the admin a link to the booking when SITE_URL is %j", async (siteUrl) => {
    await withEnv("SITE_URL", siteUrl, async () => {
      const id = await bookOnTheWebsite();
      const [toAdmin] = sent;
      expect(toAdmin.to).toBe("admin@example.com");
      expect(toAdmin.text).toContain(`https://pannipix.test/admin/collections/bookings/${id}`);
      expect(toAdmin.text).not.toContain("//admin");
    });
  });

  it("route a reply to the other side: the admin's email to the customer, the customer's to the admin", async () => {
    await bookOnTheWebsite();
    const [toAdmin, toCustomer] = sent;
    expect(toAdmin.replyTo).toBe(customer.email);
    expect(toCustomer.to).toBe(customer.email);
    expect(toCustomer.replyTo).toBe("admin@example.com");
  });

  it("are marked as automatic, so out-of-office replies stay away", async () => {
    await bookOnTheWebsite();
    expect(sent).toHaveLength(2);
    for (const email of sent) expect(email.headers).toEqual({ "Auto-Submitted": "auto-generated" });
  });

  it("send only the customer's email, and log why, when ADMIN_EMAIL is not set", async () => {
    const warned = vi.spyOn(payload.logger, "warn").mockImplementation(() => undefined);
    await withEnv("ADMIN_EMAIL", undefined, async () => {
      await bookOnTheWebsite();
      expect(sent.map((m) => m.to)).toEqual([customer.email]);
      expect(sent[0].replyTo).toBeUndefined();
      expect(warned).toHaveBeenCalledExactlyOnceWith("ADMIN_EMAIL is not set; the new-booking email was not sent.");
    });
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

  it.each([
    ["pending", ["Megkaptam a foglalásod"]],
    ["confirmed", ["Visszaigazolva"]],
    ["completed", []],
  ] as const)("tell the customer of a booking the admin creates as %s: %j", async (status, subjects) => {
    await createBooking(payload, (await design()).id, (await createSlot(payload)).id, { status });
    // Only the customer hears of it: the admin made the booking, and one created as Elkészült sends nothing.
    expect(sent.map((m) => m.to)).toEqual(subjects.map(() => customer.email));
    expect(sent.map((m) => m.subject)).toEqual(subjects.map((subject) => expect.stringContaining(subject)));
  });

  it("stay quiet when a booking is deleted", async () => {
    const booking = await createBooking(payload, (await design()).id, (await createSlot(payload)).id);
    sent = [];
    await payload.delete({ collection: "bookings", id: booking.id });
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
        err: { name: "Error" },
        msg: `Booking email "admin-new" for booking ${id} failed`,
      });
      expect(logged).toHaveBeenNthCalledWith(2, {
        err: { name: "Error" },
        msg: `Booking email "customer-received" for booking ${id} failed`,
      });
    } finally {
      process.off("unhandledRejection", onUnhandled);
      payload.sendEmail = spied;
    }
  });

  it("log a refused email without its addresses or anything else about the customer", async () => {
    // What nodemailer throws when the mail server refuses a recipient: the address is in the message, the server's
    // reply and the rejected list.
    const reply = `550 5.1.1 <${customer.email}>: Recipient address rejected: User unknown`;
    const refusal = Object.assign(new Error(`Can't send mail - all recipients were rejected: ${reply}`), {
      code: "EENVELOPE",
      response: reply,
      responseCode: 550,
      command: "RCPT TO",
      rejected: [customer.email],
      rejectedErrors: [{ code: "EENVELOPE", response: reply, responseCode: 550, recipient: customer.email }],
    });
    expect(inspect(refusal, { depth: null })).toContain(customer.email);
    const spied = payload.sendEmail;
    payload.sendEmail = () => Promise.reject(refusal);
    const logged = vi.spyOn(payload.logger, "error").mockImplementation(() => undefined);
    try {
      const id = await bookOnTheWebsite();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const entry = (kind: string) => ({
        err: { name: "Error", code: "EENVELOPE", responseCode: 550, command: "RCPT TO" },
        msg: `Booking email "${kind}" for booking ${id} failed`,
      });
      expect(logged.mock.calls).toEqual([[entry("admin-new")], [entry("customer-received")]]);
      const printed = inspect(logged.mock.calls, { depth: null });
      for (const detail of [customer.name, customer.email, customer.phone, "admin@example.com"]) {
        expect(printed).not.toContain(detail);
      }
    } finally {
      payload.sendEmail = spied;
    }
  });

  it("never hold a booking up while the mail server is slow", async () => {
    // A plain function again, so a mock can't swallow what the hook does with the promise it gets.
    let calls = 0;
    const spied = payload.sendEmail;
    payload.sendEmail = () => {
      calls += 1;
      return new Promise(() => {});
    };
    try {
      const d = await design();
      const result = await createPublicBooking(payload, publicInput(d.id, (await createSlot(payload)).id));

      expect(result).toEqual({ ok: true, bookingId: expect.any(Number) });
      expect(calls).toBe(2);
    } finally {
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
    expect(logged).toHaveBeenCalledWith({
      err: { name: "Error" },
      msg: `Booking email "admin-new" for booking ${id} failed`,
    });
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
    // A bug in our own code keeps its stack, so the log says where: here Intl refusing the date in lib/time.ts.
    const bug = { name: "RangeError", stack: expect.stringContaining("lib/time.ts") };
    expect(logged).toHaveBeenNthCalledWith(1, { err: bug, msg: 'Booking email "admin-new" for booking 7 failed' });
    expect(logged).toHaveBeenNthCalledWith(2, {
      err: bug,
      msg: 'Booking email "customer-received" for booking 7 failed',
    });
  });
});
