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
    /** Counts one event if the key is under its limit; false once it is reached. Synchronous, so parallel requests can't all slip through. */
    take(key: string) {
      const list = recent(key);
      if (list.length >= limit) return false;
      events.set(key, [...list, now()]);
      return true;
    },
    /** Gives back the key's latest event, e.g. when the booking it was taken for did not go through. */
    release(key: string) {
      const list = recent(key);
      list.pop();
      if (list.length > 0) events.set(key, list);
      else events.delete(key);
    },
  };
}
