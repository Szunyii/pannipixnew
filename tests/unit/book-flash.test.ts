import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  xff: null as string | null,
  warn: vi.fn(),
  getPayload: vi.fn(),
  create: vi.fn(),
  refresh: vi.fn(),
  order: [] as string[],
}));

vi.mock("next/headers", () => ({
  headers: async () => {
    h.order.push("headers");
    return new Headers(h.xff === null ? {} : { "x-forwarded-for": h.xff });
  },
}));
vi.mock("payload", () => ({
  getPayload: (...args: unknown[]) => {
    h.order.push("getPayload");
    return h.getPayload(...args);
  },
}));
vi.mock("@/cms/booking/public", () => ({
  createPublicBooking: (...args: unknown[]) => {
    h.order.push("create");
    return h.create(...args);
  },
}));
// The real config would load Payload's adapters; the action only hands it to the mocked getPayload.
vi.mock("@payload-config", () => ({ default: {} }));
// refresh() only works inside a real Server Action request.
vi.mock("next/cache", () => ({ refresh: () => h.refresh() }));

const valid = () => {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    designId: "12", slotId: "4", name: "Kovács Anna", email: "anna@example.com", phone: "+36 30 123 4567",
    placement: "alkar", note: "", adult: "on", website: "",
  })) f.set(k, v);
  return f;
};

async function load(hops?: string) {
  vi.resetModules();
  vi.stubEnv("TRUSTED_PROXY_HOPS", hops);
  return (await import("@/app/(frontend)/actions")).bookFlash;
}

beforeEach(() => {
  h.xff = null;
  h.order.length = 0;
  h.warn.mockReset();
  h.refresh.mockReset();
  h.create.mockReset().mockResolvedValue({ ok: true, bookingId: 1 });
  h.getPayload.mockReset().mockResolvedValue({ logger: { warn: h.warn, error: vi.fn() } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  // tests/setup.ts stubs NODE_ENV too, and unstubAllEnvs took that stub away with the rest.
  vi.stubEnv("NODE_ENV", "test");
});

describe("bookFlash", () => {
  it.each([
    ["a booking that went through", { ok: true, bookingId: 3 }, { status: "success" }],
    ["a sold-out design", { ok: false, code: "sold_out" }, { status: "error", code: "sold_out" }],
    ["a design taken off the site", { ok: false, code: "design_unavailable" }, { status: "error", code: "design_unavailable" }],
  ])("re-renders the page in the same response after %s", async (_what, outcome, answer) => {
    const bookFlash = await load();
    h.create.mockResolvedValue(outcome);
    expect(await bookFlash(valid())).toEqual(answer);
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a slot taken meanwhile", "slot_taken"],
    ["a slot that has passed", "slot_past"],
    ["an unknown failure", "unknown"],
  ])("leaves the page as it is after %s", async (_what, code) => {
    const bookFlash = await load();
    h.create.mockResolvedValue({ ok: false, code });
    expect(await bookFlash(valid())).toEqual({ status: "error", code });
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it("leaves the page as it is when nothing was booked: invalid input, the limit, a honeypot, Payload down", async () => {
    const bookFlash = await load();
    const bad = valid();
    bad.set("email", "anna@");
    expect(await bookFlash(bad)).toMatchObject({ status: "error", code: "invalid" });

    const bot = valid();
    bot.set("website", "spam.example");
    expect(await bookFlash(bot)).toEqual({ status: "success" });

    vi.spyOn(console, "error").mockImplementation(() => {});
    h.getPayload.mockRejectedValueOnce(new Error("db down"));
    expect(await bookFlash(valid())).toEqual({ status: "error", code: "unknown" });
    expect(h.refresh).not.toHaveBeenCalled();

    h.xff = "203.0.113.9";
    for (let i = 0; i < 3; i += 1) await bookFlash(valid());
    expect(h.refresh).toHaveBeenCalledTimes(3);
    expect(await bookFlash(valid())).toEqual({ status: "error", code: "rate_limited" });
    expect(h.refresh).toHaveBeenCalledTimes(3);
  });

  it("refuses the 4th booking of one visitor, however the visitor decorates the header", async () => {
    const bookFlash = await load();
    const results = [];
    for (const spoof of ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"]) {
      h.xff = `${spoof}, 203.0.113.9`; // the proxy appended the real address
      results.push(await bookFlash(valid()));
    }
    expect(results.map((r) => r.status)).toEqual(["success", "success", "success", "error"]);
    expect(results[3]).toEqual({ status: "error", code: "rate_limited" });
    expect(h.create).toHaveBeenCalledTimes(3);
    // Everything works as set up: nothing to warn about.
    expect(h.warn).not.toHaveBeenCalled();
  });

  it("keeps counting a booking for an hour: still refused after 59 minutes, allowed again after 61", async () => {
    // Only the clock is faked, and before load(): the limiter reads the clock it finds when the module starts.
    vi.useFakeTimers({ toFake: ["Date"] });
    const bookFlash = await load();
    h.xff = "203.0.113.9";
    for (let i = 0; i < 3; i += 1) expect(await bookFlash(valid())).toEqual({ status: "success" });

    vi.advanceTimersByTime(59 * 60_000);
    expect(await bookFlash(valid())).toEqual({ status: "error", code: "rate_limited" });

    vi.advanceTimersByTime(2 * 60_000);
    expect(await bookFlash(valid())).toEqual({ status: "success" });
  });

  it("keeps visitors apart", async () => {
    const bookFlash = await load();
    for (let i = 0; i < 3; i += 1) { h.xff = "203.0.113.9"; await bookFlash(valid()); }
    h.xff = "203.0.113.10";
    expect(await bookFlash(valid())).toEqual({ status: "success" });
  });

  it.each([
    ["no header (Next fills the socket address: loopback)", "::ffff:127.0.0.1"],
    ["a private hop", "10.0.0.7"],
    ["no forwarded header at all", null],
  ])("does not limit anyone when there is no usable address: %s", async (_what, xff) => {
    const bookFlash = await load();
    h.xff = xff;
    for (let i = 0; i < 6; i += 1) expect(await bookFlash(valid())).toEqual({ status: "success" });
    expect(h.create).toHaveBeenCalledTimes(6);
  });

  it("gives the slot back when the booking fails, so failures never use up the 3", async () => {
    const bookFlash = await load();
    h.xff = "203.0.113.9";
    h.create.mockResolvedValue({ ok: false, code: "slot_taken" });
    for (let i = 0; i < 5; i += 1) expect(await bookFlash(valid())).toEqual({ status: "error", code: "slot_taken" });
    h.create.mockResolvedValue({ ok: true, bookingId: 2 });
    for (let i = 0; i < 3; i += 1) expect(await bookFlash(valid())).toEqual({ status: "success" });
    expect(await bookFlash(valid())).toEqual({ status: "error", code: "rate_limited" });
  });

  it("answers a filled honeypot with success, stores nothing, logs a warning without personal data, and does not use the limit", async () => {
    const bookFlash = await load();
    h.xff = "203.0.113.9";
    const bot = valid();
    bot.set("website", "spam.example");
    for (let i = 0; i < 5; i += 1) expect(await bookFlash(bot)).toEqual({ status: "success" });
    expect(h.create).not.toHaveBeenCalled();
    expect(h.warn).toHaveBeenCalledTimes(5);
    expect(JSON.stringify(h.warn.mock.calls)).not.toMatch(/203\.0\.113|anna|example\.com|spam/i);
    for (let i = 0; i < 3; i += 1) expect(await bookFlash(valid())).toEqual({ status: "success" });
  });

  it("returns an error value instead of throwing when Payload fails to start, and does not use up the limit", async () => {
    const bookFlash = await load();
    h.xff = "203.0.113.9";
    // Payload has no logger yet, so the action writes to the console.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = new Error("db down");
    h.getPayload.mockRejectedValue(cause);
    for (let i = 0; i < 5; i += 1) expect(await bookFlash(valid())).toEqual({ status: "error", code: "unknown" });
    expect(logged).toHaveBeenCalledTimes(5);
    expect(logged.mock.calls[0]).toContain(cause);
    expect(JSON.stringify(logged.mock.calls)).not.toMatch(/203\.0\.113|anna|example\.com|\+36/i);
    h.getPayload.mockResolvedValue({ logger: { warn: h.warn, error: vi.fn() } });
    for (let i = 0; i < 3; i += 1) expect(await bookFlash(valid())).toEqual({ status: "success" });
  });

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["a string", "designId=12&slotId=4"],
    ["a plain object", { designId: "12", slotId: "4" }],
    ["a list of pairs", [["designId", "12"], ["slotId", "4"]]],
  ])("answers %s instead of a form with 'invalid', and does not touch Payload", async (_what, argument) => {
    const bookFlash = await load();
    // A Server Function can be called with anything, whatever its type says.
    expect(await bookFlash(argument as unknown as FormData)).toEqual({ status: "error", code: "invalid", fieldErrors: {} });
    expect(h.order).toEqual([]);
  });

  it("reads Payload before it takes a slot, and rejects invalid input before touching Payload", async () => {
    const bookFlash = await load();
    h.xff = "203.0.113.9";
    await bookFlash(valid());
    expect(h.order).toEqual(["getPayload", "headers", "create"]);
    h.order.length = 0;
    const bad = valid();
    bad.set("email", "anna@");
    expect(await bookFlash(bad)).toMatchObject({ status: "error", code: "invalid" });
    expect(h.order).toEqual([]);
  });

  // A value pasted with spaces around it still means what it says.
  it.each([["2"], [" 2 "]])("TRUSTED_PROXY_HOPS=%j keys on the second entry from the right", async (value) => {
    const bookFlash = await load(value);
    for (const real of ["203.0.113.9"]) {
      for (let i = 0; i < 3; i += 1) { h.xff = `${real}, 198.51.100.7`; await bookFlash(valid()); }
      h.xff = `${real}, 198.51.100.8`; // another CDN edge, same visitor
      expect(await bookFlash(valid())).toEqual({ status: "error", code: "rate_limited" });
    }
  });

  it("TRUSTED_PROXY_HOPS=0 switches the limit off, and says so once", async () => {
    const bookFlash = await load("0");
    h.xff = "6.6.6.6, 203.0.113.9";
    for (let i = 0; i < 6; i += 1) expect(await bookFlash(valid())).toEqual({ status: "success" });
    expect(h.warn).toHaveBeenCalledTimes(1);
    expect(h.warn.mock.calls[0]).toEqual(["Booking limit is off: TRUSTED_PROXY_HOPS is 0 (see .env.example)."]);
    expect(JSON.stringify(h.warn.mock.calls)).not.toMatch(/6\.6\.6\.6|203\.0\.113|anna|example\.com/i);
  });

  // Only an explicit 0 may switch the limit off, so every typo must mean the default. The first entry differs on
  // every request, like a visitor's spoofed header: a typo read as 2 would key on it and never refuse anyone.
  it.each([[""], ["abc"], ["-1"], ["0x2"], ["2abc"]])("TRUSTED_PROXY_HOPS=%j falls back to one hop", async (value) => {
    const bookFlash = await load(value);
    const results = [];
    for (const spoof of ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"]) {
      h.xff = `${spoof}, 203.0.113.9`;
      results.push(await bookFlash(valid()));
    }
    expect(results).toEqual([
      { status: "success" },
      { status: "success" },
      { status: "success" },
      { status: "error", code: "rate_limited" },
    ]);
    expect(h.warn).not.toHaveBeenCalled();
  });

  it.each([
    ["a private hop", "10.0.0.7"],
    ["the socket address Next fills in when the proxy sent nothing", "::ffff:127.0.0.1"],
    ["no forwarded header at all", null],
  ])("warns once, without any address, when there is no usable visitor address: %s", async (_what, xff) => {
    const bookFlash = await load();
    h.xff = xff;
    for (let i = 0; i < 4; i += 1) expect(await bookFlash(valid())).toEqual({ status: "success" });
    expect(h.warn.mock.calls).toEqual([
      ["Booking limit skipped: no usable visitor address in X-Forwarded-For; check TRUSTED_PROXY_HOPS (see README)."],
    ]);
    expect(JSON.stringify(h.warn.mock.calls)).not.toMatch(/10\.0\.0\.7|127\.0\.0\.1|anna|example\.com/i);
  });

  it("warns when the first request without a usable address comes, however many good ones came before it", async () => {
    const bookFlash = await load();
    h.xff = "203.0.113.9";
    await bookFlash(valid());
    expect(h.warn).not.toHaveBeenCalled();
    h.xff = "10.0.0.7";
    await bookFlash(valid());
    await bookFlash(valid());
    expect(h.warn).toHaveBeenCalledTimes(1);
  });
});
