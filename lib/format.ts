// Deterministic on server and client, so no hydration mismatch from Intl.
export function formatPrice(n: number) {
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;
}
