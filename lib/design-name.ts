/** "P’CONs #027": the collection and number of a design, spelled one way in the admin, the bookings and the site. */
export function designName({ collection, number }: { collection: string; number: string }) {
  return `${collection} #${number}`;
}
