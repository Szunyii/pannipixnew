/**
 * The flash collections, in the order the site shows them. A design picks one in the admin and stores its `value`;
 * the site heads each collection's row of designs with its `tagline`. A new collection is a new line here: the
 * column is plain text, so it needs no migration. A design's saved title carries the label ("P’CONs #027"); after
 * changing a label, save that collection's designs again.
 */
export const CATEGORIES = [
  { value: "pcons", label: "P’CONs", tagline: "Egy kép, amiben felismered a történeted." },
  { value: "ornx", label: "ORNX", tagline: "Egy ékszer, amit soha nem kell levenned." },
  { value: "daddywillhateus", label: "daddywillhateus", tagline: "Egy minta, amiért nem kérsz engedélyt." },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["value"];

/** The collection's name as the site and the admin print it; a value that left the list stands for itself. */
export function categoryName(slug: CategorySlug): string {
  return CATEGORIES.find((c) => c.value === slug)?.label ?? slug;
}
