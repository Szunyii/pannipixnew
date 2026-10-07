"use server";

import config from "@payload-config";
import { headers } from "next/headers";
import { getPayload } from "payload";
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
// Proxies in front of the app that append to X-Forwarded-For (see .env.example); 0 turns the limit off.
const hopsSetting = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
const trustedProxyHops = Number.isInteger(hopsSetting) ? hopsSetting : 1;

export async function getOpenSlots(): Promise<SlotDay[]> {
  return listOpenSlots();
}

export async function bookFlash(formData: FormData): Promise<BookFlashState> {
  const parsed = parseBookingInput(Object.fromEntries(formData));
  if (!parsed.ok) return { status: "error", code: "invalid", fieldErrors: parsed.fieldErrors };

  const payload = await getPayload({ config });
  // Bots fill the hidden field: tell them it worked and store nothing.
  if (parsed.data.website) {
    payload.logger.warn("Booking form honeypot filled in; nothing stored.");
    return { status: "success" };
  }

  // No usable visitor address (e.g. an unexpected proxy setup): skip the limit rather than share one bucket.
  const address = clientAddress((await headers()).get("x-forwarded-for"), trustedProxyHops);
  if (address && !limiter.take(address)) return { status: "error", code: "rate_limited" };

  const result = await createPublicBooking(payload, parsed.data);
  if (!result.ok) {
    // Only bookings that went through count against the limit.
    if (address) limiter.release(address);
    return { status: "error", code: result.code };
  }
  return { status: "success" };
}
