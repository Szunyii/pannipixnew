import type { Availability, BookingRule } from "@/lib/booking-rules";
import { designName } from "@/lib/design-name";
import { formatPrice } from "@/lib/format";
import type { FlashCategory, FlashDesign } from "@/lib/flash-types";

export { designName, formatPrice };
export type { BookingRule };
export type { DesignImage, FlashCategory, FlashDesign } from "@/lib/flash-types";

export const styles = ["Conceptual", "Abstract", "Microrealism"] as const;

/** What the services overview shows for a fact each design states itself, or when there is nothing to go by yet. */
export const PER_DESIGN = "Mintánként megadva";

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
type Categories = readonly Pick<FlashCategory, "rule">[];

/**
 * The rule every design on the site books by; null when they differ or there are none. It goes by the designs shown:
 * a collection with no visible design (empty, or all switched off) would otherwise make the rules look mixed. Only
 * while no design is shown do the collections stand in.
 */
export function sharedRule(designs: Designs, categories: Categories): BookingRule | null {
  const rules = designs.length > 0 ? designs.map((d) => d.availability.rule) : categories.map((c) => c.rule);
  const rule = rules[0];
  return rule && rules.every((r) => r === rule) ? rule : null;
}

const ruleNames: Record<BookingRule, string> = { single: "Egyszeri", limited: "Limitált", unlimited: "Korlátlan" };

/** How often a flash design can be booked, in a word or two for the services overview. */
export function ruleSummary(designs: Designs, categories: Categories) {
  if (designs.length === 0 && categories.length === 0) return PER_DESIGN;
  const rule = sharedRule(designs, categories);
  return rule ? ruleNames[rule] : "Kollekciónként eltérő";
}
