import { afterEach, describe, expect, it } from "vitest";
import { siteUrl } from "@/cms/env";

const original = process.env.SITE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = original;
});

describe("siteUrl", () => {
  it("is the SITE_URL setting", () => {
    process.env.SITE_URL = "https://pannipix.hu";
    expect(siteUrl()).toBe("https://pannipix.hu");
  });

  it("drops a trailing slash, so a link built from it has no double slash", () => {
    process.env.SITE_URL = "https://pannipix.hu/";
    expect(siteUrl()).toBe("https://pannipix.hu");
    expect(`${siteUrl()}/admin`).toBe("https://pannipix.hu/admin");
  });

  it.each([undefined, ""])("falls back to the local dev server when SITE_URL is %j", (value) => {
    if (value === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = value;
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("reads the setting on every call, not once at start-up", () => {
    process.env.SITE_URL = "https://one.example";
    expect(siteUrl()).toBe("https://one.example");
    process.env.SITE_URL = "https://two.example";
    expect(siteUrl()).toBe("https://two.example");
  });
});
