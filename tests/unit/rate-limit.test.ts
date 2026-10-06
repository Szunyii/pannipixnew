import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("takes up to the limit per key, lets a release make room, and frees everything once the window has passed", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });

    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("a")).toBe(false);
    expect(limiter.take("b")).toBe(true);

    limiter.release("a");
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("a")).toBe(false);

    now = 1001;
    expect(limiter.take("a")).toBe(true);
  });

  it("counts an event for exactly one window", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => now });

    limiter.take("a");
    now = 999;
    expect(limiter.take("a")).toBe(false);
    now = 1000;
    expect(limiter.take("a")).toBe(true);
  });

  it("gives back the latest event, so the older ones keep counting", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });

    limiter.take("a"); // at 0
    now = 600;
    limiter.take("a"); // at 600
    limiter.release("a"); // drops the one at 600

    // The one at 0 has left the window by now. Had it been the one given back, the one at 600 would still count
    // and only a single take would fit.
    now = 1001;
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("a")).toBe(false);
  });

  it("does nothing when a key with no events is released", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });

    expect(() => limiter.release("nobody")).not.toThrow();
    expect(limiter.take("nobody")).toBe(true);
    expect(limiter.take("nobody")).toBe(false);
  });
});
