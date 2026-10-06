import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { nodemailerAdapter } from "@payloadcms/email-nodemailer";
import { hu } from "@payloadcms/translations/languages/hu";
import { buildConfig } from "payload";
import sharp from "sharp";
import { Media } from "./cms/collections/Media";
import { Users } from "./cms/collections/Users";
import { dataLocation } from "./cms/env";

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

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: " – PANNIPIX" },
  },
  collections: [Media, Users],
  db: sqliteAdapter({
    client: { url: databaseUrl() },
    // WAL lets the site read while a booking is written; busyTimeout waits out a brief lock instead of failing.
    wal: true,
    busyTimeout: 5000,
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
  i18n: { supportedLanguages: { hu }, fallbackLanguage: "hu" },
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
});
