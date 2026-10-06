import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows the limit inside the window, then again once it has passed", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });

    expect(limiter.allowed("a")).toBe(true);
    limiter.record("a");
    limiter.record("a");
    expect(limiter.allowed("a")).toBe(false);
    expect(limiter.allowed("b")).toBe(true);

    now = 1001;
    expect(limiter.allowed("a")).toBe(true);
  });
});
