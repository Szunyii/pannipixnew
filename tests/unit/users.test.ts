import { afterEach, describe, expect, it } from "vitest";
import { Users } from "@/cms/collections/Users";

const original = process.env.SITE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = original;
});

/** The body of the password-reset email for a token. */
async function resetEmailHtml(token: string) {
  const forgotPassword = typeof Users.auth === "object" ? Users.auth.forgotPassword : undefined;
  return forgotPassword?.generateEmailHTML?.({ token });
}

describe("password reset email", () => {
  it.each(["https://pannipix.hu", "https://pannipix.hu/"])("links to the reset page of the site at SITE_URL %j", async (siteUrl) => {
    process.env.SITE_URL = siteUrl;
    const link = "https://pannipix.hu/admin/reset/abc123";
    expect(await resetEmailHtml("abc123")).toContain(`<a href="${link}">${link}</a>`);
  });
});
