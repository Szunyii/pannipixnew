import { inspect } from "node:util";
import { type Payload, ValidationError } from "payload";
import { describe, expect, it, vi } from "vitest";
import { BookingError } from "@/cms/booking/errors";
import { MAX_ATTEMPTS, createPublicBooking } from "@/cms/booking/public";
import type { BookingInput } from "@/lib/booking-input";

const input: BookingInput = {
  designId: 12,
  slotId: 4,
  name: "Teszt Elek",
  email: "teszt.elek@example.com",
  phone: "+36 30 123 4567",
  placement: "alkar",
  note: "",
  website: "",
};

/** What Payload throws when a unique index turns the insert away (drizzle's handleUpsertError). */
const uniqueViolation = (path: string) =>
  new ValidationError({ collection: "bookings", errors: [{ message: "Value must be unique", path }] });
const seatConflict = () => uniqueViolation("design_id");

/** A stand-in for Payload whose create fails or succeeds in the given order. */
function fakePayload(...outcomes: unknown[]) {
  const create = vi.fn();
  for (const outcome of outcomes) {
    if (outcome instanceof Error) create.mockRejectedValueOnce(outcome);
    else create.mockResolvedValueOnce(outcome);
  }
  const error = vi.fn();
  return { payload: { create, logger: { error } } as unknown as Payload, create, error };
}

// The int tests reach the retry only through how libsql interleaves Promise.all; these pin it without a database.
describe("createPublicBooking", () => {
  it("tries again after losing a seat race and books the next seat", async () => {
    const { payload, create, error } = fakePayload(seatConflict(), { id: 7 });
    expect(await createPublicBooking(payload, input)).toEqual({ ok: true, bookingId: 7 });
    expect(create).toHaveBeenCalledTimes(2);
    expect(error).not.toHaveBeenCalled();
  });

  it("reports sold out when the retry finds no seat left", async () => {
    const { payload, create } = fakePayload(seatConflict(), new BookingError("sold_out"));
    expect(await createPublicBooking(payload, input)).toEqual({ ok: false, code: "sold_out" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("keeps trying while other bookings keep taking the seat it picked", async () => {
    const lost = Array.from({ length: MAX_ATTEMPTS - 1 }, seatConflict);
    const { payload, create } = fakePayload(...lost, { id: 9 });
    expect(await createPublicBooking(payload, input)).toEqual({ ok: true, bookingId: 9 });
    expect(create).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("gives up and logs after MAX_ATTEMPTS, so a seat that never frees up can't loop forever", async () => {
    const { payload, create, error } = fakePayload();
    create.mockRejectedValue(seatConflict());
    expect(await createPublicBooking(payload, input)).toEqual({ ok: false, code: "unknown" });
    expect(create).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("lets waiting work run before it retries, so the losers of one race don't retry in lockstep", async () => {
    let waitingWorkRan = false;
    let ranBeforeRetry: boolean | undefined;
    const { payload, create } = fakePayload();
    create
      .mockImplementationOnce(async () => {
        // Another request's continuation, queued on the event loop while this attempt runs.
        setTimeout(() => (waitingWorkRan = true), 0);
        throw seatConflict();
      })
      .mockImplementationOnce(async () => {
        ranBeforeRetry = waitingWorkRan;
        return { id: 7 };
      });
    expect(await createPublicBooking(payload, input)).toEqual({ ok: true, bookingId: 7 });
    expect(ranBeforeRetry).toBe(true);
  });

  it.each([
    ["a slot someone else just took", uniqueViolation("slot_id"), "slot_taken"],
    ["a sold-out design", new BookingError("sold_out"), "sold_out"],
    ["a hidden design", new BookingError("design_unavailable"), "design_unavailable"],
    ["a past slot", new BookingError("slot_past"), "slot_past"],
  ])("answers %s at once, without retrying", async (_what, err, code) => {
    const { payload, create, error } = fakePayload(err);
    expect(await createPublicBooking(payload, input)).toEqual({ ok: false, code });
    expect(create).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it("logs an unexpected failure and does not retry it", async () => {
    const { payload, create, error } = fakePayload(new Error("SQLITE_IOERR"));
    expect(await createPublicBooking(payload, input)).toEqual({ ok: false, code: "unknown" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("logs the kind of a failed insert, never the booking it was storing", async () => {
    const booking = { ...input, note: "Allergiás vagyok a festékre" };
    const params = [booking.name, booking.email, booking.phone, booking.note];
    // Drizzle puts the query's parameters into the message of its error: the visitor's name, email, phone and note.
    const driver = Object.assign(new Error("SQLITE_BUSY: database is locked"), { code: "SQLITE_BUSY" });
    const message = `Failed query: insert into "bookings" (...)\nparams: ${params.join(",")}`;
    const failure = Object.assign(new Error(message, { cause: driver }), { params });
    expect(inspect(failure, { depth: null })).toContain(booking.email);
    const { payload, error } = fakePayload(failure);

    expect(await createPublicBooking(payload, booking)).toEqual({ ok: false, code: "unknown" });

    expect(error).toHaveBeenCalledExactlyOnceWith({
      err: { name: "Error", code: "SQLITE_BUSY" },
      attempts: 1,
      msg: "Website booking failed",
    });
    for (const detail of params) expect(inspect(error.mock.calls, { depth: null })).not.toContain(detail);
  });

  it("sends every attempt as a pending website booking that loads no relations afterwards", async () => {
    const { payload, create } = fakePayload(seatConflict(), { id: 7 });
    await createPublicBooking(payload, input);
    for (const [args] of create.mock.calls) {
      expect(args).toMatchObject({
        collection: "bookings",
        // The emails read the booking's own fields; loading the design and slot after the insert could only fail late.
        depth: 0,
        context: { publicBooking: true },
        overrideAccess: true,
        data: { design: 12, slot: 4, status: "pending", note: null, adultConfirmed: true },
      });
    }
  });
});
