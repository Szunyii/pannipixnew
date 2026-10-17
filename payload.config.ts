import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { nodemailerAdapter } from "@payloadcms/email-nodemailer";
import { hu } from "@payloadcms/translations/languages/hu";
import { buildConfig, defaultLoggerOptions } from "payload";
import sharp from "sharp";
import { Bookings } from "./cms/collections/Bookings";
import { Designs } from "./cms/collections/Designs";
import { Media } from "./cms/collections/Media";
import { Slots } from "./cms/collections/Slots";
import { Users } from "./cms/collections/Users";
import { dashboardTranslations } from "./cms/dashboard/translations";
import { dashboard, labelPayloadWidgets } from "./cms/dashboard/widgets";
import { dataLocation, isProductionRuntime } from "./cms/env";
import { TIME_ZONE } from "./lib/time";
import { migrations } from "./migrations";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** SQLite lives in a file; on Hostinger DATABASE_URL points outside the deploy folder so redeploys keep it. */
function databaseUrl() {
  const url = dataLocation("DATABASE_URL", "file:./.data/pannipix.db");
  if (url.startsWith("file:")) {
    try {
      fs.mkdirSync(path.dirname(path.resolve(url.slice("file:".length))), { recursive: true });
    } catch {
      // A missing or read-only folder surfaces as a connection error that names the path.
    }
  }
  return url;
}

const smtpPort = Number(process.env.SMTP_PORT || 465);

/**
 * Refusals our hooks throw on purpose (DeleteRefusedError from cms/booking/guards.ts, BookingError from the booking
 * rules) log at info, like Payload's own ValidationError. Payload types these keys as its own error names but looks up
 * any error's `name`, hence the wider type.
 */
const expectedRefusals: Record<string, "info"> = { DeleteRefusedError: "info", BookingError: "info" };

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: " – PANNIPIX" },
    // The admin home: booking widgets each admin can add, remove, resize and reorder (cms/dashboard/). Payload appends
    // its own widget to the list it gets, so it gets a copy: a config reload in dev would otherwise add it again.
    dashboard: { ...dashboard, widgets: [...dashboard.widgets] },
    timezones: {
      defaultTimezone: TIME_ZONE,
      supportedTimezones: [{ label: "Budapest", value: TIME_ZONE }],
    },
  },
  collections: [Bookings, Slots, Designs, Media, Users],
  db: sqliteAdapter({
    client: { url: databaseUrl() },
    // WAL lets the site read while a booking is written; busyTimeout waits out a brief lock instead of failing.
    wal: true,
    busyTimeout: 5000,
    // In production, pending migrations run once per process, when Payload initialises: on the first request that uses
    // it, not at `next start`. Never during `next build`: if a page ever started Payload at build time, the build would
    // at most read the database the build machine points at (and fail on a missing table), never migrate it.
    prodMigrations: isProductionRuntime ? migrations : undefined,
  }),
  // Without SMTP settings Payload logs each email to the console instead of sending it.
  email: process.env.SMTP_HOST
    ? nodemailerAdapter({
        defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || "hello@pannipix.hu",
        defaultFromName: process.env.EMAIL_FROM_NAME || "PANNIPIX",
        // `next build` evaluates this config too; don't dial the SMTP server from the build.
        skipVerify: process.env.NEXT_PHASE === "phase-production-build",
        transportOptions: {
          host: process.env.SMTP_HOST,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          // Give up fast instead of nodemailer's 2 min / 30 s / 10 min defaults.
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
        },
      })
    : undefined,
  graphQL: { disable: true },
  i18n: { supportedLanguages: { hu }, fallbackLanguage: "hu", translations: { hu: dashboardTranslations } },
  // Under Vitest only warnings and errors print: the console email adapter logs an INFO line per email, and the suite
  // books dozens of times. The destination is Payload's own, so the output keeps its usual look.
  logger: process.env.VITEST ? { options: { level: "warn" }, destination: defaultLoggerOptions } : undefined,
  loggingLevels: expectedRefusals,
  // Bookings work without mail settings, but the emails would go missing or to the console: say so once at start-up.
  onInit: (payload) => {
    if (!isProductionRuntime) return;
    const missing = ["ADMIN_EMAIL", "SITE_URL", "SMTP_HOST"].filter((name) => !process.env[name]);
    if (missing.length > 0) {
      payload.logger.warn(`Booking emails are not fully configured; missing: ${missing.join(", ")} (see .env.example).`);
    }
  },
  secret: process.env.PAYLOAD_SECRET || "",
  sharp,
  // Payload otherwise runs `git config` and posts anonymous usage data on every init, test files included.
  telemetry: false,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
    // Payload regenerates types in a child process on every dev start; under Vitest that child would outlive
    // the test file and read the developer's .env. `npm run generate:types` remains the writer for tests.
    autoGenerate: !process.env.VITEST,
  },
}).then(labelPayloadWidgets);
