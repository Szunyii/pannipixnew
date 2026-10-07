import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  xff: null as string | null,
  warn: vi.fn(),
  getPayload: vi.fn(),
  create: vi.fn(),
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
  if (hops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
  else process.env.TRUSTED_PROXY_HOPS = hops;
  return (await import("@/app/(frontend)/actions")).bookFlash;
}

beforeEach(() => {
  h.xff = null;
  h.order.length = 0;
  h.warn.mockReset();
  h.create.mockReset().mockResolvedValue({ ok: true, bookingId: 1 });
  h.getPayload.mockReset().mockResolvedValue({ logger: { warn: h.warn, error: vi.fn() } });
});

describe("bookFlash", () => {
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

  it("does not use up the limit when Payload fails to start", async () => {
    const bookFlash = await load();
    h.xff = "203.0.113.9";
    h.getPayload.mockRejectedValue(new Error("db down"));
    for (let i = 0; i < 5; i += 1) await expect(bookFlash(valid())).rejects.toThrow("db down");
    h.getPayload.mockResolvedValue({ logger: { warn: h.warn, error: vi.fn() } });
    for (let i = 0; i < 3; i += 1) expect(await bookFlash(valid())).toEqual({ status: "success" });
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

  it("TRUSTED_PROXY_HOPS=2 keys on the second entry from the right", async () => {
    const bookFlash = await load("2");
    for (const real of ["203.0.113.9"]) {
      for (let i = 0; i < 3; i += 1) { h.xff = `${real}, 198.51.100.7`; await bookFlash(valid()); }
      h.xff = `${real}, 198.51.100.8`; // another CDN edge, same visitor
      expect(await bookFlash(valid())).toEqual({ status: "error", code: "rate_limited" });
    }
  });

  it("TRUSTED_PROXY_HOPS=0 switches the limit off", async () => {
    const bookFlash = await load("0");
    h.xff = "6.6.6.6, 203.0.113.9";
    for (let i = 0; i < 6; i += 1) expect(await bookFlash(valid())).toEqual({ status: "success" });
  });

  it.each([[""], ["abc"]])("TRUSTED_PROXY_HOPS=%j falls back to one hop", async (value) => {
    const bookFlash = await load(value);
    h.xff = "6.6.6.6, 203.0.113.9";
    for (let i = 0; i < 3; i += 1) await bookFlash(valid());
    expect(await bookFlash(valid())).toEqual({ status: "error", code: "rate_limited" });
  });
});
