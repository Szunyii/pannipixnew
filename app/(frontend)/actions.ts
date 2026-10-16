"use server";

import config from "@payload-config";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { type Payload, getPayload } from "payload";
import type { PublicBookingCode } from "@/cms/booking/errors";
import { createPublicBooking } from "@/cms/booking/public";
import { type FieldErrors, parseBookingInput } from "@/lib/booking-input";
import { clientAddress } from "@/lib/client-address";
import { listOpenSlots } from "@/lib/flash";
import { createRateLimiter } from "@/lib/rate-limit";
import type { SlotDay } from "@/lib/time";

export type BookFlashState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; code: PublicBookingCode | "invalid" | "rate_limited"; fieldErrors?: FieldErrors };

// At most three bookings an hour from one visitor, so nobody can lock up the whole calendar.
const limiter = createRateLimiter({ limit: 3, windowMs: 60 * 60 * 1000 });

// Proxies in front of the app that append to X-Forwarded-For (see .env.example). Spaces around the value don't count.
// Only an explicit 0 turns the limit off: anything else that isn't plain digits ("-1", "0x2", "2abc", "") is a typo,
// and a typo must not do that.
const hopsSetting = (process.env.TRUSTED_PROXY_HOPS ?? "").trim();
const trustedProxyHops = /^\d+$/.test(hopsSetting) ? Number(hopsSetting) : 1;

// Neither line may carry an address or anything else about a visitor.
const LIMIT_OFF = "Booking limit is off: TRUSTED_PROXY_HOPS is 0 (see .env.example).";
const NO_ADDRESS =
  "Booking limit skipped: no usable visitor address in X-Forwarded-For; check TRUSTED_PROXY_HOPS (see README).";

const warned = new Set<string>();

/** Warns the first time only. The setting stays the same for the life of the process, so a line per booking would just bury it. */
function warnOnce(payload: Payload, message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  payload.logger.warn(message);
}

export async function getOpenSlots(): Promise<SlotDay[]> {
  return listOpenSlots();
}

export async function bookFlash(formData: FormData): Promise<BookFlashState> {
  // A Server Function is an endpoint anyone can call with any argument, whatever its type says.
  if (!(formData instanceof FormData)) return { status: "error", code: "invalid", fieldErrors: {} };
  const parsed = parseBookingInput(Object.fromEntries(formData));
  if (!parsed.ok) return { status: "error", code: "invalid", fieldErrors: parsed.fieldErrors };

  let payload: Payload;
  try {
    payload = await getPayload({ config });
  } catch (err) {
    // A failure is a value for the form to show, not a throw. Payload has no logger yet, so it goes to the console;
    // nothing from the form has reached Payload, so the log holds no personal data.
    console.error("Booking form: Payload failed to start.", err);
    return { status: "error", code: "unknown" };
  }
  // Bots fill the hidden field: tell them it worked and store nothing (so there's nothing to re-render either).
  if (parsed.data.website) {
    payload.logger.warn("Booking form honeypot filled in; nothing stored.");
    return { status: "success" };
  }

  // No usable visitor address (e.g. an unexpected proxy setup): skip the limit rather than share one bucket,
  // but say so once, because a limit that does nothing looks just like one that works.
  const address = clientAddress((await headers()).get("x-forwarded-for"), trustedProxyHops);
  if (!address) {
    warnOnce(payload, trustedProxyHops === 0 ? LIMIT_OFF : NO_ADDRESS);
  } else if (!limiter.take(address)) {
    return { status: "error", code: "rate_limited" };
  }

  const result = await createPublicBooking(payload, parsed.data);
  if (!result.ok) {
    // Only bookings that went through count against the limit.
    if (address) limiter.release(address);
    // The design can't be booked any more: re-render the page too, so the cards and the design page stop offering it.
    if (result.code === "sold_out" || result.code === "design_unavailable") refresh();
    return { status: "error", code: result.code };
  }
  // The response then carries the re-rendered page with the new availability, together with the answer: the page is
  // up to date by the time the dialog says "done", and no second request is needed. Next applies it as a push
  // navigation, so with a #hash in the address (left by an in-page link) Back first returns to that hash.
  refresh();
  return { status: "success" };
}
