import type { Availability } from "@/lib/booking-rules";
import { formatPrice } from "@/lib/format";
import type { FlashDesign } from "@/lib/flash-types";

export { formatPrice };
export type { DesignImage, FlashCategory, FlashDesign } from "@/lib/flash-types";

export const styles = ["Conceptual", "Abstract", "Microrealism"] as const;

export function designName(d: Pick<FlashDesign, "collection" | "number">) {
  return `${d.collection} #${d.number}`;
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
