import type { Payload } from "payload";
import type { BookingInput } from "@/lib/booking-input";
import { type PublicBookingCode, classifyBookingError } from "./errors";

export type PublicBookingResult = { ok: true; bookingId: number } | { ok: false; code: PublicBookingCode };

const PUBLIC_CODES: readonly string[] = ["design_unavailable", "sold_out", "slot_taken", "slot_past"];
const MAX_ATTEMPTS = 3;

/**
 * Creates a booking from the website form. Simultaneous requests for one design all pick its lowest
 * free seat and the unique index lets one through; the others retry, and then take the next seat or
 * learn the design sold out.
 */
export async function createPublicBooking(payload: Payload, input: BookingInput): Promise<PublicBookingResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const booking = await payload.create({
        collection: "bookings",
        data: {
          design: input.designId,
          slot: input.slotId,
          status: "pending",
          name: input.name,
          email: input.email,
          phone: input.phone,
          placement: input.placement,
          note: input.note || null,
          adultConfirmed: true,
        },
        context: { publicBooking: true },
        overrideAccess: true,
      });
      return { ok: true, bookingId: booking.id };
    } catch (err) {
      const code = classifyBookingError(err);
      if (code === "seat_conflict" && attempt < MAX_ATTEMPTS) continue;
      if (PUBLIC_CODES.includes(code)) return { ok: false, code: code as PublicBookingCode };
      payload.logger.error({ err, msg: "Website booking failed" });
      return { ok: false, code: "unknown" };
    }
  }
  return { ok: false, code: "unknown" };
}
