/** "P’CONs #027": the collection and number of a design, spelled one way in the admin, the bookings and the site. */
export function designName({ collection, number }: { collection: string; number: string }) {
  return `${collection} #${number}`;
}

/** "/flash/pcons/027": the design's own page, from its collection's stored value and its number. */
export function designPath({ category, number }: { category: string; number: string }) {
  return `/flash/${encodeURIComponent(category)}/${encodeURIComponent(number)}`;
}
