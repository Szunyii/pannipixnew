import { ValidationError } from "payload";
import { describe, expect, it } from "vitest";
import { BookingError, classifyBookingError } from "@/cms/booking/errors";

const uniqueViolation = (path: string) =>
  new ValidationError({ collection: "bookings", errors: [{ message: "Value must be unique", path }] });

describe("classifyBookingError", () => {
  it("passes our own rule codes through", () => {
    expect(classifyBookingError(new BookingError("sold_out"))).toBe("sold_out");
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
