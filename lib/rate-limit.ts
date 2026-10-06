/** Counts events per key in a sliding window. Kept in memory: one Node process, reset on restart. */
export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  const events = new Map<string, number[]>();

  function recent(key: string) {
    const cutoff = now() - windowMs;
    const list = (events.get(key) ?? []).filter((time) => time > cutoff);
    if (list.length > 0) events.set(key, list);
    else events.delete(key);
    return list;
  }

  return {
    allowed: (key: string) => recent(key).length < limit,
    record: (key: string) => {
      events.set(key, [...recent(key), now()]);
    },
  };
}
