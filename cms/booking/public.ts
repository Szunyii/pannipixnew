import type { Payload } from "payload";
import type { BookingInput } from "@/lib/booking-input";
import { type PublicBookingCode, classifyBookingError } from "./errors";

export type PublicBookingResult = { ok: true; bookingId: number } | { ok: false; code: PublicBookingCode };

const PUBLIC_CODES = ["design_unavailable", "sold_out", "slot_taken", "slot_past"] as const satisfies readonly PublicBookingCode[];
const isPublicCode = (code: string): code is (typeof PUBLIC_CODES)[number] =>
  (PUBLIC_CODES as readonly string[]).includes(code);

/**
 * Each lost seat race means another booking for the design just went through, so the next attempt sees it
 * and takes the next seat or finds the design sold out. The cap only stops a booking that can't make progress,
 * e.g. a seat held by a row the hook doesn't count as active.
 */
export const MAX_ATTEMPTS = 10;

/**
 * Waits a few random milliseconds before a retry. Yielding to the event loop is what keeps the losers of one race
 * from picking the same seat again together; the randomness spreads them out when queries really run async.
 */
const pause = (attempt: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.random() * 5 * attempt));

/**
 * Creates a booking from the website form. Simultaneous requests for one design all pick its lowest
 * free seat and the unique index lets one through; the others pause a few random milliseconds and try
 * again, so they take the next free seat or learn the design sold out. A request that loses
 * MAX_ATTEMPTS seat races in a row gives up with "unknown", and the failure is logged.
 */
export async function createPublicBooking(payload: Payload, input: BookingInput): Promise<PublicBookingResult> {
  for (let attempt = 1; ; attempt += 1) {
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
        // The emails read only the booking's own fields. Populating the design and slot after the insert is extra work
        // that could fail once the row is stored, and the visitor would then see an error for a booking that exists.
        depth: 0,
      });
      return { ok: true, bookingId: booking.id };
    } catch (err) {
      const code = classifyBookingError(err);
      if (code === "seat_conflict" && attempt < MAX_ATTEMPTS) {
        await pause(attempt);
        continue;
      }
      if (isPublicCode(code)) return { ok: false, code };
      payload.logger.error({ err, attempts: attempt, msg: "Website booking failed" });
      return { ok: false, code: "unknown" };
    }
  }
}
