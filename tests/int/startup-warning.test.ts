import type { Payload } from "payload";
import { afterEach, describe, expect, it, vi } from "vitest";

// With SMTP_HOST set the config would dial the SMTP server to verify it; the start-up warning needs no mail adapter.
vi.mock("@payloadcms/email-nodemailer", () => ({ nodemailerAdapter: () => undefined }));

const SETTINGS = ["ADMIN_EMAIL", "SITE_URL", "SMTP_HOST"] as const;
type Settings = Partial<Record<(typeof SETTINGS)[number], string>>;

const complete: Settings = {
  ADMIN_EMAIL: "hello@pannipix.hu",
  SITE_URL: "https://pannipix.hu",
  SMTP_HOST: "smtp.example.com",
};

afterEach(() => {
  vi.unstubAllEnvs();
  // tests/setup.ts stubs NODE_ENV too, and unstubAllEnvs took that stub away with the rest.
  vi.stubEnv("NODE_ENV", "test");
});

/** Loads the real config as the server would see it in this environment, runs its onInit, and returns the warnings logged. */
async function warningsAtStartUp(settings: Settings, { nodeEnv = "production", phase }: { nodeEnv?: string; phase?: string } = {}) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("NEXT_PHASE", phase);
  for (const name of SETTINGS) vi.stubEnv(name, settings[name]);

  const { default: config } = await import("@payload-config");
  const warn = vi.fn();
  await (await config).onInit?.({ logger: { warn } } as unknown as Payload);
  return warn.mock.calls;
}

describe("start-up warning about booking emails", () => {
  it("lists every missing setting in production", async () => {
    expect(await warningsAtStartUp({})).toEqual([
      ["Booking emails are not fully configured; missing: ADMIN_EMAIL, SITE_URL, SMTP_HOST (see .env.example)."],
    ]);
  });

  it("lists only the missing ones, and counts an empty setting as missing", async () => {
    expect(await warningsAtStartUp({ ...complete, SITE_URL: "" })).toEqual([
      ["Booking emails are not fully configured; missing: SITE_URL (see .env.example)."],
    ]);
  });

  it("stays quiet in production when everything is set", async () => {
    expect(await warningsAtStartUp(complete)).toEqual([]);
  });

  it("stays quiet in development, where emails go to the console", async () => {
    expect(await warningsAtStartUp({}, { nodeEnv: "development" })).toEqual([]);
  });

  it("stays quiet while `next build` evaluates the config", async () => {
    expect(await warningsAtStartUp({}, { phase: "phase-production-build" })).toEqual([]);
  });
});
