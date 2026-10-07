import { ValidationError } from "payload";
import { describe, expect, it, vi } from "vitest";
import { BookingError, classifyBookingError } from "@/cms/booking/errors";

const uniqueViolation = (path: string) =>
  new ValidationError({ collection: "bookings", errors: [{ message: "Value must be unique", path }] });

describe("classifyBookingError", () => {
  it("passes our own rule codes through", () => {
    expect(classifyBookingError(new BookingError("sold_out"))).toBe("sold_out");
  });

  it("passes the code through from a second copy of the module, as hot reload loads one", async () => {
    vi.resetModules();
    const copy = await import("@/cms/booking/errors");
    const soldOut = new copy.BookingError("sold_out");
    expect(soldOut).not.toBeInstanceOf(BookingError);
    // Not a lost seat race (its path is "design"): that would be retried and end up "unknown".
    expect(classifyBookingError(soldOut)).toBe("sold_out");
    expect(classifyBookingError(new copy.BookingError("design_unavailable"))).toBe("design_unavailable");
  });

  it("doesn't take a code it doesn't know from an error that only has the name", () => {
    const lookalike = Object.assign(uniqueViolation("design_id"), { name: "BookingError", code: "not_a_code" });
    expect(classifyBookingError(lookalike)).toBe("seat_conflict");
    expect(classifyBookingError({ name: "BookingError", code: "sold_out" })).toBe("unknown");
  });

  it("reads a lost race on the slot as a taken slot", () => {
    expect(classifyBookingError(uniqueViolation("slot_id"))).toBe("slot_taken");
    expect(classifyBookingError(uniqueViolation("slot"))).toBe("slot_taken");
  });

  it("reads a lost race on the design's seat as a seat conflict", () => {
    expect(classifyBookingError(uniqueViolation("design_id"))).toBe("seat_conflict");
  });

  it("leaves anything else unknown", () => {
    expect(classifyBookingError(new Error("disk full"))).toBe("unknown");
    expect(classifyBookingError(null)).toBe("unknown");
  });
});
