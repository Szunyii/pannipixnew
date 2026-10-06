/** Statuses that hold a slot and one of the design's bookings. */
export const ACTIVE_STATUSES = ["pending", "confirmed", "completed"] as const;
/** Statuses that gave the slot and the booking back. */
export const RELEASED_STATUSES = ["rejected", "cancelled"] as const;

export type BookingStatus = (typeof ACTIVE_STATUSES)[number] | (typeof RELEASED_STATUSES)[number];
export type BookingRule = "single" | "limited" | "unlimited";

type RuleSource = { rule: BookingRule; limit?: number | null };

export const isActiveStatus = (status: string | null | undefined) =>
  (ACTIVE_STATUSES as readonly string[]).includes(status ?? "");

export const isReleasedStatus = (status: string | null | undefined) =>
  (RELEASED_STATUSES as readonly string[]).includes(status ?? "");

/** How many times a design may be booked under its collection's rule; null means no limit. */
export function effectiveLimit({ rule, limit }: RuleSource): number | null {
  if (rule === "single") return 1;
  if (rule === "limited") return Math.max(1, Math.floor(limit ?? 1));
  return null;
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

/** The smallest seat number in 1..limit that no active booking holds, or null when all are taken. */
export function lowestFreeSeat(taken: Iterable<number | null | undefined>, limit: number): number | null {
  const used = new Set<number>();
  for (const seat of taken) if (typeof seat === "number") used.add(seat);
  for (let seat = 1; seat <= limit; seat += 1) if (!used.has(seat)) return seat;
  return null;
}

/** Payload hands relationships over as an id or as the populated document; this returns the id either way. */
export function relationId(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  if (value && typeof value === "object" && "id" in value) return relationId((value as { id: unknown }).id);
  return null;
}
