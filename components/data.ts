import type { Availability, BookingRule } from "@/lib/booking-rules";
import { designName, designPath } from "@/lib/design-name";
import { formatPrice } from "@/lib/format";
import type { FlashDesign } from "@/lib/flash-types";

export { designName, designPath, formatPrice };
export type { BookingRule };
export type { DesignImage, FlashDesign } from "@/lib/flash-types";

export const styles = ["Conceptual", "Abstract", "Microrealism"] as const;

/** What the services overview shows for a fact each design states itself, or when there is nothing to go by yet. */
export const PER_DESIGN = "Mintánként megadva";

/** The order a collection's row shows its designs in: as given (newest first), with the sold-out ones at the end. */
export function rowOrder(designs: FlashDesign[]) {
  return [...designs].sort((a, b) => Number(a.availability.soldOut) - Number(b.availability.soldOut));
}

/** One line on how often a design can still be booked. */
export function availabilityLabel({ rule, remaining, soldOut }: Availability) {
  if (soldOut) return "Elkelt";
  if (rule === "single") return "Egyszeri minta";
  if (rule === "limited") return `Limitált · még ${remaining} alkalom`;
  return "Korlátlanul foglalható";
}

/** "90 000 – 120 000 Ft" across the designs that can still be booked; null when none can. */
export function priceRange(designs: FlashDesign[]) {
  const prices = designs.filter((d) => !d.availability.soldOut).map((d) => d.price);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(min) : `${formatPrice(min).replace(" Ft", "")} – ${formatPrice(max)}`;
}

type Designs = readonly Pick<FlashDesign, "availability">[];

/** The rule every design shown on the site books by; null when they differ or there are none. */
export function sharedRule(designs: Designs): BookingRule | null {
  const rule = designs[0]?.availability.rule;
  return rule && designs.every((d) => d.availability.rule === rule) ? rule : null;
}

const ruleNames: Record<BookingRule, string> = { single: "Egyszeri", limited: "Limitált", unlimited: "Korlátlan" };

/** How often a flash design can be booked, in a word or two for the services overview. */
export function ruleSummary(designs: Designs) {
  const rule = sharedRule(designs);
  return rule ? ruleNames[rule] : PER_DESIGN;
}
