import { type PayloadRequest, ValidationError } from "payload";

export type BookingErrorCode =
  | "design_unavailable"
  | "sold_out"
  | "slot_required"
  | "slot_past"
  | "slot_taken"
  | "reactivate"
  | "create_released";

export const BOOKING_MESSAGES: Record<BookingErrorCode, string> = {
  design_unavailable: "Ez a minta jelenleg nem foglalható.",
  sold_out: "Ez a minta már betelt.",
  slot_required: "Válassz időpontot.",
  slot_past: "Ez az időpont már elmúlt, válassz másikat.",
  slot_taken: "Ezt az időpontot közben lefoglalták, válassz másikat.",
  // Short: the admin shows it in the narrow sidebar, under the status. The field's description says what to do instead.
  reactivate: "Ez a foglalás már nem aktiválható.",
  create_released: "Új foglalás csak Függőben, Jóváhagyva vagy Elkészült állapotban hozható létre.",
};

const FIELD = {
  design_unavailable: "design",
  sold_out: "design",
  slot_required: "slot",
  slot_past: "slot",
  slot_taken: "slot",
  reactivate: "status",
  create_released: "status",
} as const satisfies Record<BookingErrorCode, string>;

/** The Bookings field labels; the admin's error toast names the field with them. */
const FIELD_LABEL: Record<(typeof FIELD)[BookingErrorCode], string> = {
  design: "Minta",
  slot: "Időpont",
  status: "Állapot",
};

/** A booking rule failed. The admin shows the message under the field; the website maps the code. */
export class BookingError extends ValidationError {
  readonly code: BookingErrorCode;

  /** Pass `req.t`: without it Payload words the admin's toast in English. */
  constructor(code: BookingErrorCode, t?: PayloadRequest["t"]) {
    const path = FIELD[code];
    super({ collection: "bookings", errors: [{ label: FIELD_LABEL[path], message: BOOKING_MESSAGES[code], path }] }, t);
    this.code = code;
    this.name = "BookingError";
  }
}

export type PublicBookingCode = "design_unavailable" | "sold_out" | "slot_taken" | "slot_past" | "unknown";

/**
 * A BookingError, also when it comes from a second copy of this module: hot reload can load the class twice, and
 * `instanceof` then fails. A sold-out design would read as a lost seat race, be retried and end up "unknown".
 */
function isBookingError(err: unknown): err is BookingError {
  if (err instanceof BookingError) return true;
  const code = (err as { code?: unknown } | null)?.code;
  return (
    err instanceof Error && err.name === "BookingError" && typeof code === "string" && Object.hasOwn(BOOKING_MESSAGES, code)
  );
}

/**
 * Turns a failed create into a booking error code. Besides our own rules, SQLite's unique indexes
 * reject the loser of a race: on the slot (`slot_id`) or on the design's seat (`design_id`).
 */
export function classifyBookingError(err: unknown): BookingErrorCode | "seat_conflict" | "unknown" {
  if (isBookingError(err)) return err.code;
  const path = (err as { data?: { errors?: { path?: string }[] } } | null)?.data?.errors?.[0]?.path;
  if (path === "slot" || path === "slot_id") return "slot_taken";
  if (path === "design" || path === "design_id" || path === "seat") return "seat_conflict";
  return "unknown";
}
