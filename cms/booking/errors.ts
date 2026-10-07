import { ValidationError } from "payload";

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
  reactivate: "Elutasított vagy lemondott foglalás nem aktiválható újra – hozz létre új foglalást.",
  create_released: "Új foglalás csak Függőben, Jóváhagyva vagy Elkészült állapotban hozható létre.",
};

const FIELD: Record<BookingErrorCode, string> = {
  design_unavailable: "design",
  sold_out: "design",
  slot_required: "slot",
  slot_past: "slot",
  slot_taken: "slot",
  reactivate: "status",
  create_released: "status",
};

/** A booking rule failed. The admin shows the message under the field; the website maps the code. */
export class BookingError extends ValidationError {
  readonly code: BookingErrorCode;

  constructor(code: BookingErrorCode) {
    super({ collection: "bookings", errors: [{ message: BOOKING_MESSAGES[code], path: FIELD[code] }] });
    this.code = code;
    this.name = "BookingError";
  }
}

export type PublicBookingCode = "design_unavailable" | "sold_out" | "slot_taken" | "slot_past" | "unknown";

/**
 * Turns a failed create into a booking error code. Besides our own rules, SQLite's unique indexes
 * reject the loser of a race: on the slot (`slot_id`) or on the design's seat (`design_id`).
 */
export function classifyBookingError(err: unknown): BookingErrorCode | "seat_conflict" | "unknown" {
  if (err instanceof BookingError) return err.code;
  const path = (err as { data?: { errors?: { path?: string }[] } } | null)?.data?.errors?.[0]?.path;
  if (path === "slot" || path === "slot_id") return "slot_taken";
  if (path === "design" || path === "design_id" || path === "seat") return "seat_conflict";
  return "unknown";
}
