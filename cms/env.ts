/** True while the production server runs, not while `next build` evaluates the config. */
export const isProductionRuntime =
  process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";

/** The site's public address for links in emails, without a trailing slash. Read at runtime. */
export function siteUrl() {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Where the site's data lives. Development falls back to `.data/`; production requires the variable,
 * so a forgotten setting can't put bookings and uploads inside the deploy folder, which a redeploy wipes.
 */
export function dataLocation(name: "DATABASE_URL" | "MEDIA_DIR", fallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProductionRuntime) {
    throw new Error(`${name} is not set. In production it must point outside the deploy folder (see .env.example).`);
  }
  return fallback;
}
