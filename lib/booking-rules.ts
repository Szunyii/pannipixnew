/** Statuses that hold a slot and one of the design's bookings. */
export const ACTIVE_STATUSES = ["pending", "confirmed", "completed"] as const;
/** Statuses that gave the slot and the booking back. */
export const RELEASED_STATUSES = ["rejected", "cancelled"] as const;

export type BookingStatus = (typeof ACTIVE_STATUSES)[number] | (typeof RELEASED_STATUSES)[number];
export type BookingRule = "single" | "limited" | "unlimited";

/** Admin labels. The Bookings status options are built from this, so a new status can't miss its label. */
export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Függőben",
  confirmed: "Jóváhagyva",
  completed: "Elkészült",
  rejected: "Elutasítva",
  cancelled: "Lemondva",
};

type RuleSource = { rule: BookingRule; limit?: number | null };

export const isActiveStatus = (status: string | null | undefined) =>
  (ACTIVE_STATUSES as readonly string[]).includes(status ?? "");

export const isReleasedStatus = (status: string | null | undefined) =>
  (RELEASED_STATUSES as readonly string[]).includes(status ?? "");

/** How many times a design may be booked under its collection's rule; null means no limit. Bad input fails closed. */
export function effectiveLimit({ rule, limit }: RuleSource): number | null {
  switch (rule) {
    case "unlimited":
      return null;
    case "limited":
      return typeof limit === "number" && Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 1;
    case "single":
      return 1;
    default: {
      const unknownRule: never = rule;
      void unknownRule;
      return 1;
    }
  }
}

export type Availability = {
  rule: BookingRule;
  limit: number | null;
  remaining: number | null;
  soldOut: boolean;
};

export function availability(category: RuleSource, activeCount: number): Availability {
  const limit = effectiveLimit(category);
  if (limit === null) return { rule: category.rule, limit: null, remaining: null, soldOut: false };
  const remaining = Math.max(0, limit - activeCount);
  return { rule: category.rule, limit, remaining, soldOut: remaining === 0 };
}

/**
 * The smallest seat in 1..limit that no active booking holds, or null when all are taken. Bookings
 * without a seat and seats above the limit are not seen here (nextSeat counts them). It must stay
 * deterministic: two requests that read the same bookings pick the same seat, and the unique index on
 * (design, seat) turns one of them away.
 */
export function lowestFreeSeat(taken: Iterable<number | null | undefined>, limit: number): number | null {
  const used = new Set<number>();
  for (const seat of taken) if (typeof seat === "number") used.add(seat);
  for (let seat = 1; seat <= limit; seat += 1) if (!used.has(seat)) return seat;
  return null;
}

/**
 * The seat a new booking takes, or null when the design is fully booked. Every active booking counts,
 * including ones without a seat (made while the collection was unlimited) or above a since-lowered limit.
 */
export function nextSeat(activeSeats: readonly (number | null | undefined)[], limit: number): number | null {
  return activeSeats.length < limit ? lowestFreeSeat(activeSeats, limit) : null;
}

/** Payload hands relationships over as an id or as the populated document; this returns the id either way. */
export function relationId(value: unknown): number | null {
  const id = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
  if (typeof id === "number") return Number.isSafeInteger(id) && id > 0 ? id : null;
  if (typeof id === "object" && id !== null && "id" in id) return relationId((id as { id: unknown }).id);
  return null;
}
