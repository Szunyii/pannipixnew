import { isIP } from "node:net";

/**
 * Loopback, private, carrier-grade NAT (100.64.0.0/10), link-local and unspecified addresses: a hop inside the host's
 * own network, not a visitor.
 */
const INTERNAL =
  /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.|0\.|::1?$|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i;

/** An IPv6 visitor can pick any address in their /64, so that prefix is what identifies them. */
function ipv6Prefix(ip: string) {
  const [head = "", tail = ""] = ip.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const missing = ip.includes("::") ? Math.max(0, 8 - headGroups.length - tailGroups.length) : 0;
  const groups = [...headGroups, ...Array<string>(missing).fill("0"), ...tailGroups];
  return `${groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/**
 * The visitor's address as the nearest trusted proxy saw it: the entry `hops` places from the right of
 * X-Forwarded-For. Everything to its left is whatever the visitor chose to send. Null when there is no usable
 * public address (no header, hops < 1, an internal hop, junk), so the caller skips its per-address limit.
 */
export function clientAddress(forwardedFor: string | null, hops = 1): string | null {
  if (hops < 1) return null;
  const entries = (forwardedFor ?? "").split(",").map((entry) => entry.trim());
  const candidate = entries[entries.length - hops]?.replace(/^::ffff:/i, "");
  if (!candidate || !isIP(candidate) || INTERNAL.test(candidate)) return null;
  return isIP(candidate) === 6 ? ipv6Prefix(candidate) : candidate;
}
