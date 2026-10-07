# Payload CMS + flash időpontfoglalás — implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A PANNIPIX Next.js oldalba integrált Payload CMS-ből az admin kezeli a flash mintákat, a kollekciók foglalhatósági szabályait és a szabad időpontokat; a látogató egy mintára időpontot foglal (nem vásárol).

**Architecture:** A Payload 3.90.2 ugyanabban a Next 16 alkalmazásban fut (`app/(payload)` route group), SQLite adatbázissal (`@payloadcms/db-sqlite`) és lemezre mentett képekkel. A foglalási szabályok a Bookings gyűjtemény `beforeChange` hookjában élnek (így az admin és a webes foglalás ugyanazt követi); a dupla foglalást egyedi indexek (`slot`, `design + seat`) zárják ki tranzakció nélkül. A főoldal minden kéréskor a Local API-ból olvas; a foglalás server actionön keresztül megy.

**Tech Stack:** Next 16.3.8, React 19.2.8, Tailwind 4, Payload 3.90.2 (`payload`, `@payloadcms/next`, `@payloadcms/db-sqlite`, `@payloadcms/email-nodemailer`, `@payloadcms/translations`), sharp, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-06-payload-flash-booking-design.md`

---

## Fontos tudnivalók a végrehajtónak

- **AGENTS.md:** ez a Next verzió eltér a megszokottól. Kétség esetén olvasd a `node_modules/next/dist/docs/` megfelelő fejezetét.
- **Payload médiafájl-URL:** `/api/media/file/<fájlnév>`, relatív és query string nélkül. **Ne állíts be `serverURL`-t a Payload configban**, különben az URL abszolút lesz, és a `next/image` külső képként kezelné.
- **SQLite + Payload:** a tranzakciók ki vannak kapcsolva (ez az adapter alapértelmezése). A konzisztenciát az egyedi indexek adják. Egyedi index megsértésekor a Payload `ValidationError`-t dob, ennek `data.errors[0].path` értéke `slot_id` / `slot` (időpont) vagy `design_id` (minta + sorszám).
- **Dev adatbázis:** fejlesztésben a Payload `push` módban szinkronizálja a sémát. Ha egy sémaváltozás után a dev szerver adatvesztésre figyelmeztetve kérdez a terminálban, a legegyszerűbb az újrakezdés: `rm -rf .data && npm run seed`.
- **Commit üzenetek** végére mindig kerüljön oda: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Minden parancs a repó gyökeréből fut: `/Users/szunyoghdavid/Documents/pannipix`.
- **Más projektek szerverei:** a gépen más projektek Next szerverei is futnak, az egyik a 3000-es porton. **Soha ne használj `pkill`-t vagy `killall`-t.** A saját szervert explicit porton indítsd (dev: `3210`, prod: `3211`), saját folyamatcsoportban (`set -m`), és a végén csak azt a csoportot állítsd le: `kill -TERM -- -"$PID"`. A szerverindító blokkokat `bash -c '…'`-ban futtasd, mert a zsh nem interaktív módban nem engedi a `set -m`-et.

## Fájltérkép

| Fájl | Felelősség |
|---|---|
| `payload.config.ts` | Payload konfiguráció: SQLite, e-mail, magyar admin, gyűjtemények, migrációk |
| `cms/access.ts` | Hozzáférési szabályok (admin / bárki / látható minta) |
| `cms/collections/*.ts` | Users, Media, Categories, Designs, Slots, Bookings |
| `cms/booking/errors.ts` | `BookingError` kódokkal, hibák osztályozása |
| `cms/booking/hooks.ts` | `prepareBooking`: foglalási szabályok minden mentéskor |
| `cms/booking/guards.ts` | Törlésvédelem (kollekció, minta, időpont) |
| `cms/booking/public.ts` | Webes foglalás létrehozása, újrapróbálással ütközés esetén |
| `cms/emails/templates.ts` | E-mail szövegek, és melyik esemény milyen levelet küld |
| `cms/emails/send.ts` | `afterChange` hook: levelek küldése, hibatűréssel |
| `lib/booking-rules.ts` | Tiszta függvények: állapotok, limit, foglalhatóság, sorszám |
| `lib/time.ts` | Europe/Budapest formázás, napok szerinti csoportosítás |
| `lib/format.ts` | Árformázás |
| `lib/booking-input.ts` | Testtájak listája, webes űrlap ellenőrzése |
| `lib/rate-limit.ts` | Memóriabeli csúszóablakos korlátozó |
| `lib/flash.ts` | Szerveroldali adatlekérés a főoldalnak és a foglalási ablaknak |
| `app/(frontend)/actions.ts` | Server actionök: `getOpenSlots`, `bookFlash` |
| `app/(payload)/**` | Payload admin és REST API (sablonfájlok) |
| `components/booking-dialog.tsx` | A foglalási ablak |
| `scripts/seed.ts` | Demó adatok üres adatbázisba |
| `tests/**` | Vitest egység- és integrációs tesztek |

---

### Task 1: Függőségek, ESM, scriptek, beállítófájlok

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `.gitignore`
- Modify: `eslint.config.mjs`
- Create: `.env.example`
- Create: `.env` (helyi, nincs verziókezelve)

- [ ] **Step 1: Csomagok telepítése**

```bash
npm install --save-exact payload@3.90.2 @payloadcms/next@3.90.2 @payloadcms/db-sqlite@3.90.2 @payloadcms/email-nodemailer@3.90.2 @payloadcms/translations@3.90.2
npm install graphql@^16.8.1 sharp@^0.35.5
npm install --save-dev @types/node@^22 vite@^8 vitest@^5.0.3
```

A `@types/node@^22` azért kell, mert a vitest 5 opcionális peer függősége `@types/node ^22 || >=24`. A `--legacy-peer-deps` kapcsolót ne használd: kihagyná a `vite`-ot a lockfile-ból, és utána egy sima `npm ci` elbukna.

Expected: a `package.json` `dependencies` szakaszában megjelenik a `payload`, `@payloadcms/next`, `@payloadcms/db-sqlite`, `@payloadcms/email-nodemailer`, `@payloadcms/translations` (mind `3.90.2`), a `graphql` és a `sharp`.

- [ ] **Step 2: `package.json`: ESM és scriptek**

A `"private": true,` sor után vedd fel ezt: `"type": "module",`. A `scripts` blokkot cseréld erre:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "vitest run",
    "payload": "payload",
    "generate:types": "payload generate:types",
    "generate:importmap": "payload generate:importmap",
    "seed": "payload run scripts/seed.ts"
  },
```

- [ ] **Step 3: `tsconfig.json`: `@payload-config` alias**

A `paths` blokkot cseréld erre:

```json
    "paths": {
      "@/*": ["./*"],
      "@payload-config": ["./payload.config.ts"]
    }
```

- [ ] **Step 4: `.gitignore`**

A fájl végére írd:

```
# Payload local data (SQLite database + uploaded images)
/.data/

# the env template is committed, the real env files are not
!.env.example
```

- [ ] **Step 5: `eslint.config.mjs`: generált fájlok kihagyása**

A `globalIgnores([...])` tömbbe a `"next-env.d.ts",` sor után vedd fel:

```js
    // Generated by Payload:
    "payload-types.ts",
    "app/(payload)/admin/importMap.js",
    "migrations/**",
```

- [ ] **Step 6: `.env.example` létrehozása**

```dotenv
# Required. Long random string, e.g. `openssl rand -hex 32`. Signs admin sessions,
# so changing it logs every admin out.
PAYLOAD_SECRET=

# SQLite file and uploaded images. On Hostinger point both OUTSIDE the deploy folder,
# e.g. file:/home/<user>/pannipix-data/pannipix.db and /home/<user>/pannipix-data/media
DATABASE_URL=file:./.data/pannipix.db
MEDIA_DIR=./.data/media

# Public address of the site, used for links in emails. Read at runtime.
SITE_URL=http://localhost:3000

# Who gets the "new booking" email.
ADMIN_EMAIL=hello@pannipix.hu

# Outgoing email (Hostinger SMTP). Leave SMTP_HOST empty in development: emails are logged instead.
# EMAIL_FROM_ADDRESS should be the mailbox that SMTP_USER authenticates as.
# SMTP_PORT 465 means implicit TLS (the config sets `secure` only for 465; 587 uses STARTTLS).
EMAIL_FROM_ADDRESS=hello@pannipix.hu
EMAIL_FROM_NAME=PANNIPIX
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
```

- [ ] **Step 7: Helyi `.env`**

```bash
sed "s/^PAYLOAD_SECRET=$/PAYLOAD_SECRET=$(openssl rand -hex 32)/" .env.example > .env
grep -c "^PAYLOAD_SECRET=.\{64\}$" .env
```

Expected: `1`

- [ ] **Step 8: Ellenőrzés**

```bash
npm run lint && npm run typecheck && git status --short
```

Expected: a lint és a typecheck hiba nélkül fut. A git status a `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `eslint.config.mjs` és `.env.example` változását mutatja, a `.env` fájlt nem.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore eslint.config.mjs .env.example
git commit -m "$(cat <<'EOF'
chore: add Payload, SQLite adapter and Vitest; switch to ESM

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Payload bekötése (route groupok, konfiguráció, Users, Media)

**Files:**
- Move: `app/layout.tsx` → `app/(frontend)/layout.tsx`
- Move: `app/page.tsx` → `app/(frontend)/page.tsx`
- Move: `app/globals.css` → `app/(frontend)/globals.css`
- Create: `app/(payload)/layout.tsx`
- Create: `app/(payload)/admin/[[...segments]]/page.tsx`
- Create: `app/(payload)/admin/[[...segments]]/not-found.tsx`
- Create: `app/(payload)/admin/importMap.js` (generált)
- Create: `app/(payload)/api/[...slug]/route.ts`
- Create: `cms/access.ts`
- Create: `cms/collections/Users.ts`
- Create: `cms/collections/Media.ts`
- Create: `payload.config.ts`
- Create: `payload-types.ts` (generált)
- Modify: `next.config.ts`

- [ ] **Step 1: A frontend áthelyezése a `(frontend)` route groupba**

```bash
mkdir -p "app/(frontend)"
git mv app/layout.tsx "app/(frontend)/layout.tsx"
git mv app/page.tsx "app/(frontend)/page.tsx"
git mv app/globals.css "app/(frontend)/globals.css"
```

A layout `import "./globals.css";` sora változatlanul működik, mert a CSS vele együtt költözött. Az `app/favicon.ico` a helyén marad.

- [ ] **Step 2: `cms/access.ts`**

```ts
import type { Access } from "payload";

/** Every account in this Payload is the studio's admin, so being logged in is the permission. */
export const isAdmin: Access = ({ req }) => Boolean(req.user);

export const anyone: Access = () => true;

/** Visitors only see designs switched on for the site; admins see everything. */
export const adminOrVisible: Access = ({ req }) => (req.user ? true : { visible: { equals: true } });
```

- [ ] **Step 3: `cms/collections/Users.ts`**

```ts
import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  labels: { singular: "Admin", plural: "Adminok" },
  admin: { useAsTitle: "email", group: "Beállítások" },
  auth: true,
  fields: [],
};
```

- [ ] **Step 4: `cms/collections/Media.ts`**

```ts
import path from "node:path";
import type { CollectionConfig } from "payload";
import { anyone, isAdmin } from "../access";

export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Kép", plural: "Képek" },
  admin: { group: "Flash", defaultColumns: ["filename", "alt", "updatedAt"] },
  access: { read: anyone, create: isAdmin, update: isAdmin, delete: isAdmin },
  upload: {
    // Outside the deploy folder in production (MEDIA_DIR), so uploads survive a redeploy.
    staticDir: path.resolve(process.env.MEDIA_DIR || ".data/media"),
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    imageSizes: [{ name: "thumbnail", width: 320 }],
    adminThumbnail: "thumbnail",
    crop: false,
    focalPoint: false,
  },
  fields: [
    {
      name: "alt",
      type: "text",
      label: "Alternatív szöveg",
      required: true,
      admin: { description: "Egy mondat arról, mi látható a képen. Ezt olvassák fel a képernyőolvasók." },
    },
  ],
};
```

- [ ] **Step 5: `payload.config.ts`**

```ts
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

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** SQLite lives in a file; on Hostinger DATABASE_URL points outside the deploy folder so redeploys keep it. */
function databaseUrl() {
  const url = process.env.DATABASE_URL || `file:${path.resolve(dirname, ".data/pannipix.db")}`;
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
        transportOptions: {
          host: process.env.SMTP_HOST,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        },
      })
    : undefined,
  graphQL: { disable: true },
  i18n: { supportedLanguages: { hu }, fallbackLanguage: "hu" },
  secret: process.env.PAYLOAD_SECRET || "",
  sharp,
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
});
```

- [ ] **Step 6: Payload route fájlok (a 3.90.2 blank sablonból)**

`app/(payload)/layout.tsx`:

```tsx
/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from "@payload-config";
import "@payloadcms/next/css";
import type { ServerFunctionClient } from "payload";
import { handleServerFunctions, RootLayout } from "@payloadcms/next/layouts";
import React from "react";

import { importMap } from "./admin/importMap.js";

type Args = {
  children: React.ReactNode;
};

const serverFunction: ServerFunctionClient = async function (args) {
  "use server";
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  });
};

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
);

export default Layout;
```

`app/(payload)/admin/[[...segments]]/page.tsx`:

```tsx
/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { Metadata } from "next";

import config from "@payload-config";
import { RootPage, generatePageMetadata } from "@payloadcms/next/views";
import { importMap } from "../importMap";

type Args = {
  params: Promise<{
    segments: string[];
  }>;
  searchParams: Promise<{
    [key: string]: string | string[];
  }>;
};

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams });

const Page = ({ params, searchParams }: Args) => RootPage({ config, params, searchParams, importMap });

export default Page;
```

`app/(payload)/admin/[[...segments]]/not-found.tsx`:

```tsx
/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { Metadata } from "next";

import config from "@payload-config";
import { NotFoundPage, generatePageMetadata } from "@payloadcms/next/views";
import { importMap } from "../importMap";

type Args = {
  params: Promise<{
    segments: string[];
  }>;
  searchParams: Promise<{
    [key: string]: string | string[];
  }>;
};

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams });

const NotFound = ({ params, searchParams }: Args) => NotFoundPage({ config, params, searchParams, importMap });

export default NotFound;
```

`app/(payload)/api/[...slug]/route.ts`:

```ts
/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from "@payload-config";
import "@payloadcms/next/css";
import { REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST, REST_PUT } from "@payloadcms/next/routes";

export const GET = REST_GET(config);
export const POST = REST_POST(config);
export const DELETE = REST_DELETE(config);
export const PATCH = REST_PATCH(config);
export const PUT = REST_PUT(config);
export const OPTIONS = REST_OPTIONS(config);
```

A GraphQL útvonalak szándékosan maradnak ki (`graphQL.disable: true`).

- [ ] **Step 7: `next.config.ts` becsomagolása `withPayload`-dal**

A teljes fájl:

```ts
import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let a phone on the same Wi-Fi load dev scripts when opening the site by the Mac's LAN IP.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*", "*.local"],
  images: {
    // Fine-line artwork smears at the default quality of 75.
    qualities: [75, 90],
  },
  experimental: {
    // Hostinger's build box won't let Turbopack's spawned node workers connect back over
    // 127.0.0.1, so PostCSS (Tailwind) dies on globals.css. Worker threads stay in-process.
    turbopackPluginRuntimeStrategy: "workerThreads",
  },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
```

- [ ] **Step 8: Import map és típusok generálása**

```bash
npm run generate:importmap && npm run generate:types
ls "app/(payload)/admin/importMap.js" payload-types.ts
```

Expected: mindkét fájl létezik, a `payload-types.ts`-ben szerepel az `export interface Media` és az `export interface User`.

- [ ] **Step 9: Dev szerver próba**

```bash
set -m
node_modules/.bin/next dev --port 3210 > /tmp/pannipix-dev.log 2>&1 &
PID=$!
for i in $(seq 1 90); do curl -s -o /dev/null http://localhost:3210/ && break; sleep 1; done
curl -s -o /dev/null -w "front %{http_code}\n" http://localhost:3210/
curl -s -L -o /dev/null -w "admin %{http_code} %{url_effective}\n" http://localhost:3210/admin
kill -TERM -- -"$PID"
```

Expected: `front 200` és `admin 200`. A Payload a `create-first-user` oldalra kliensoldalon irányít át, ezért a curl a `/admin` URL-en marad, a böngésző viszont átkerül. Ha bármelyik 500, nézd meg a `/tmp/pannipix-dev.log` fájlt.

- [ ] **Step 10: Lint, typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: nincs hiba.

- [ ] **Step 11: Commit**

```bash
git add -A app cms payload.config.ts payload-types.ts next.config.ts
git commit -m "$(cat <<'EOF'
feat: mount Payload admin and API next to the site

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

> **Az átnézés után (commit `10d41d6`):** a Task 2 kódja a fentiekhez képest így változott:
> - A `cms/env.ts` `dataLocation()` függvénye élesben megköveteli a `DATABASE_URL`-t és a `MEDIA_DIR`-t. A build alatt nem követeli meg.
> - A `Users` élesben `secure` sütit használ, a jelszó-visszaállító link pedig a `SITE_URL`-ből épül.
> - A nodemailer timeoutokat kap, és a build alatt nem ellenőrzi az SMTP-t.
> - `poweredByHeader: false`, és a Payload kliens-hint fejlécei csak a `/admin/*` alatt mennek ki.
> - Új fájl lett az `app/fonts.ts` és az `app/global-not-found.tsx` (`experimental.globalNotFound`).
> - A Task 3 átnézése után (`4e3f736`): `typescript.autoGenerate: !process.env.VITEST` és `telemetry: false`.
>
> A későbbi taskok ezekre a fájlokra csak hozzáfűzéssel hivatkoznak, így az utasításaik változatlanul érvényesek.

---

### Task 3: Tesztkörnyezet

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/helpers.ts`
- Create: `tests/fixtures/sample.webp`: 480×640-es fehér WebP, így a tesztek nem függnek a helyőrző grafikáktól. Generálás: `node -e 'require("sharp")({create:{width:480,height:640,channels:3,background:"#ffffff"}}).webp().toFile("tests/fixtures/sample.webp")'`
- Test: `tests/int/payload.test.ts`

- [ ] **Step 1: `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Payload keeps its instance on globalThis and reads env when the config is imported, so a test file
    // only gets its own database in its own process. Vitest suggests `isolate: false` for import-heavy suites: don't.
    pool: "forks",
    isolate: true,
    // Booting Payload and pushing the schema takes about a second per file; the rest is headroom for slow CI.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
```

- [ ] **Step 2: `tests/setup.ts`**

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, vi } from "vitest";

// Every test file runs in its own process with its own throwaway database and upload folder.
const dir = mkdtempSync(path.join(tmpdir(), "pannipix-test-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.MEDIA_DIR = path.join(dir, "media");
process.env.PAYLOAD_SECRET = "test-secret";
process.env.ADMIN_EMAIL = "admin@example.com";
process.env.SITE_URL = "https://pannipix.test";
delete process.env.SMTP_HOST;
// A NODE_ENV=production in the developer's shell would skip Payload's schema push.
vi.stubEnv("NODE_ENV", "test");
// The app formats times in Europe/Budapest explicitly; UTC here catches any accidental use of the machine's zone.
process.env.TZ = "UTC";

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 3: `tests/helpers.ts` (első változat)**

```ts
import config from "@payload-config";
import { getPayload, type Payload } from "payload";

export function getTestPayload(): Promise<Payload> {
  return getPayload({ config });
}
```

- [ ] **Step 4: Füstteszt: `tests/int/payload.test.ts`**

```ts
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getTestPayload } from "../helpers";

describe("payload", () => {
  it("boots on a fresh SQLite file and stores uploads with a thumbnail", async () => {
    const payload = await getTestPayload();
    const media = await payload.create({
      collection: "media",
      data: { alt: "Teszt kép" },
      filePath: fileURLToPath(new URL("../fixtures/sample.webp", import.meta.url)),
    });
    expect(media.url).toMatch(/^\/api\/media\/file\/sample.*\.webp$/);
    expect(media.sizes?.thumbnail?.width).toBe(320);
  });
});
```

- [ ] **Step 5: Futtatás**

```bash
npm test
```

Expected: `1 passed`. Ha a Payload nem indul, a hibaüzenet megmutatja, melyik env változó vagy csomag hiányzik.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests
git commit -m "$(cat <<'EOF'
test: run Payload against a throwaway SQLite file per test file

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Foglalási szabályok (tiszta függvények)

**Files:**
- Create: `lib/booking-rules.ts`
- Test: `tests/unit/booking-rules.test.ts`

- [ ] **Step 1: A bukó teszt megírása**

`tests/unit/booking-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUSES,
  RELEASED_STATUSES,
  STATUS_LABELS,
  availability,
  effectiveLimit,
  isActiveStatus,
  isReleasedStatus,
  lowestFreeSeat,
  nextSeat,
  relationId,
} from "@/lib/booking-rules";

describe("effectiveLimit", () => {
  it("is 1 for single, the set number for limited and none for unlimited", () => {
    expect(effectiveLimit({ rule: "single" })).toBe(1);
    expect(effectiveLimit({ rule: "limited", limit: 3 })).toBe(3);
    expect(effectiveLimit({ rule: "unlimited", limit: 3 })).toBeNull();
  });

  it("falls back to 1 when a limited collection has no number", () => {
    expect(effectiveLimit({ rule: "limited", limit: null })).toBe(1);
  });

  it("rounds a fractional limit down and never goes below 1", () => {
    expect(effectiveLimit({ rule: "limited", limit: 2.9 })).toBe(2);
    expect(effectiveLimit({ rule: "limited", limit: 0 })).toBe(1);
    expect(effectiveLimit({ rule: "limited", limit: -4 })).toBe(1);
  });

  it.each([NaN, Infinity])("fails closed on a limit of %s", (limit) => {
    expect(effectiveLimit({ rule: "limited", limit })).toBe(1);
  });

  it("ignores the limit of a single collection", () => {
    expect(effectiveLimit({ rule: "single", limit: 3 })).toBe(1);
  });
});

describe("availability", () => {
  it("counts down the remaining bookings and sells out at zero", () => {
    expect(availability({ rule: "single" }, 0)).toEqual({ rule: "single", limit: 1, remaining: 1, soldOut: false });
    expect(availability({ rule: "single" }, 1)).toEqual({ rule: "single", limit: 1, remaining: 0, soldOut: true });
    expect(availability({ rule: "limited", limit: 3 }, 1)).toEqual({ rule: "limited", limit: 3, remaining: 2, soldOut: false });
  });

  it("never goes below zero when a limit was lowered under the active bookings", () => {
    expect(availability({ rule: "limited", limit: 3 }, 5)).toEqual({ rule: "limited", limit: 3, remaining: 0, soldOut: true });
  });

  it("never sells out an unlimited design", () => {
    expect(availability({ rule: "unlimited" }, 40)).toEqual({ rule: "unlimited", limit: null, remaining: null, soldOut: false });
  });
});

describe("lowestFreeSeat", () => {
  it("returns the smallest seat nobody holds", () => {
    expect(lowestFreeSeat([], 3)).toBe(1);
    expect(lowestFreeSeat([1, 3], 3)).toBe(2);
    expect(lowestFreeSeat([null, 2], 2)).toBe(1);
  });

  it("returns null when every seat is taken", () => {
    expect(lowestFreeSeat([1, 2, 3], 3)).toBeNull();
  });

  it("handles a design with a single seat", () => {
    expect(lowestFreeSeat([], 1)).toBe(1);
    expect(lowestFreeSeat([1], 1)).toBeNull();
  });

  it("finds the free seat at either end", () => {
    expect(lowestFreeSeat([1, 2], 3)).toBe(3);
    expect(lowestFreeSeat([2, 3], 3)).toBe(1);
  });

  it("ignores seats above the limit and repeated seats", () => {
    expect(lowestFreeSeat([3, 4], 2)).toBe(1);
    expect(lowestFreeSeat([3, 1, 1], 3)).toBe(2);
  });

  it("takes any iterable", () => {
    expect(lowestFreeSeat(new Set([2, 1]), 3)).toBe(3);
  });
});

describe("nextSeat", () => {
  it("takes the lowest free seat while the design has room", () => {
    expect(nextSeat([], 1)).toBe(1);
    expect(nextSeat([1, 2], 3)).toBe(3);
  });

  it("is null when the limit was lowered under the active bookings", () => {
    expect(nextSeat([1, 3], 2)).toBeNull();
  });

  it("counts bookings without a seat, made while the collection was unlimited", () => {
    expect(nextSeat([null, null, 1], 3)).toBeNull();
    expect(nextSeat([null, null], 3)).toBe(1);
  });
});

describe("statuses", () => {
  it("treats pending, confirmed and completed as active", () => {
    expect(["pending", "confirmed", "completed"].every(isActiveStatus)).toBe(true);
    expect(isActiveStatus("rejected")).toBe(false);
  });

  it("treats rejected and cancelled as released", () => {
    expect(["rejected", "cancelled"].every(isReleasedStatus)).toBe(true);
    expect(isReleasedStatus(undefined)).toBe(false);
  });

  it("does not treat a missing status as active", () => {
    expect(isActiveStatus(undefined)).toBe(false);
    expect(isActiveStatus(null)).toBe(false);
  });

  it("has an admin label for every status and for nothing else", () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...ACTIVE_STATUSES, ...RELEASED_STATUSES].sort());
  });
});

describe("relationId", () => {
  it("reads an id from a number, a numeric string or a populated document", () => {
    expect(relationId(5)).toBe(5);
    expect(relationId("7")).toBe(7);
    expect(relationId({ id: 9, name: "x" })).toBe(9);
  });

  it("returns null for anything else", () => {
    expect(relationId(null)).toBeNull();
    expect(relationId("")).toBeNull();
    expect(relationId({})).toBeNull();
  });

  it("trims a numeric string and reads a string id inside a populated document", () => {
    expect(relationId(" 7 ")).toBe(7);
    expect(relationId({ id: "9" })).toBe(9);
  });

  it("rejects strings that are not plain digits", () => {
    expect(relationId("abc")).toBeNull();
    expect(relationId("7abc")).toBeNull();
  });

  it("returns null for a populated document without a usable id", () => {
    expect(relationId({ id: null })).toBeNull();
  });

  it.each([0, -1, 1.5, NaN])("rejects %s, which is not a row id", (value) => {
    expect(relationId(value)).toBeNull();
  });
});
```

- [ ] **Step 2: Futtasd, és nézd meg, hogy elbukik**

```bash
npx vitest run tests/unit/booking-rules.test.ts
```

Expected: FAIL, `Cannot find package '@/lib/booking-rules'` (a modul még nem létezik).

- [ ] **Step 3: `lib/booking-rules.ts`**

```ts
/** Statuses that hold a slot and one of the design's bookings. */
export const ACTIVE_STATUSES = ["pending", "confirmed", "completed"] as const;
/** Statuses that gave the slot and the booking back. */
export const RELEASED_STATUSES = ["rejected", "cancelled"] as const;

export type BookingStatus = (typeof ACTIVE_STATUSES)[number] | (typeof RELEASED_STATUSES)[number];
export type BookingRule = "single" | "limited" | "unlimited";

/** Admin labels. The Bookings status options are built from this, so a new status can't miss its label. */
export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Függőben",
  confirmed: "Jóváhagyva",
  completed: "Elkészült",
  rejected: "Elutasítva",
  cancelled: "Lemondva",
};

type RuleSource = { rule: BookingRule; limit?: number | null };

export const isActiveStatus = (status: string | null | undefined) =>
  (ACTIVE_STATUSES as readonly string[]).includes(status ?? "");

export const isReleasedStatus = (status: string | null | undefined) =>
  (RELEASED_STATUSES as readonly string[]).includes(status ?? "");

/** How many times a design may be booked under its collection's rule; null means no limit. Bad input fails closed. */
export function effectiveLimit({ rule, limit }: RuleSource): number | null {
  switch (rule) {
    case "unlimited":
      return null;
    case "limited":
      return typeof limit === "number" && Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 1;
    case "single":
      return 1;
    default: {
      const unknownRule: never = rule;
      void unknownRule;
      return 1;
    }
  }
}

export type Availability = {
  rule: BookingRule;
  limit: number | null;
  remaining: number | null;
  soldOut: boolean;
};

export function availability(category: RuleSource, activeCount: number): Availability {
  const limit = effectiveLimit(category);
  if (limit === null) return { rule: category.rule, limit: null, remaining: null, soldOut: false };
  const remaining = Math.max(0, limit - activeCount);
  return { rule: category.rule, limit, remaining, soldOut: remaining === 0 };
}

/**
 * The smallest seat in 1..limit that no active booking holds, or null when all are taken. Bookings
 * without a seat and seats above the limit are not seen here (nextSeat counts them). It must stay
 * deterministic: two requests that read the same bookings pick the same seat, and the unique index on
 * (design, seat) turns one of them away.
 */
export function lowestFreeSeat(taken: Iterable<number | null | undefined>, limit: number): number | null {
  const used = new Set<number>();
  for (const seat of taken) if (typeof seat === "number") used.add(seat);
  for (let seat = 1; seat <= limit; seat += 1) if (!used.has(seat)) return seat;
  return null;
}

/**
 * The seat a new booking takes, or null when the design is fully booked. Every active booking counts,
 * including ones without a seat (made while the collection was unlimited) or above a since-lowered limit.
 */
export function nextSeat(activeSeats: readonly (number | null | undefined)[], limit: number): number | null {
  return activeSeats.length < limit ? lowestFreeSeat(activeSeats, limit) : null;
}

/** Payload hands relationships over as an id or as the populated document; this returns the id either way. */
export function relationId(value: unknown): number | null {
  const id = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
  if (typeof id === "number") return Number.isSafeInteger(id) && id > 0 ? id : null;
  if (typeof id === "object" && id !== null && "id" in id) return relationId((id as { id: unknown }).id);
  return null;
}
```

- [ ] **Step 4: Futtasd, most át kell mennie**

```bash
npx vitest run tests/unit/booking-rules.test.ts
```

Expected: PASS (31 teszt).

- [ ] **Step 5: Commit**

```bash
git add lib/booking-rules.ts tests/unit/booking-rules.test.ts
git commit -m "$(cat <<'EOF'
feat: booking limits, availability and seat rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Időkezelés Europe/Budapest szerint

**Files:**
- Create: `lib/time.ts`
- Test: `tests/unit/time.test.ts`

- [ ] **Step 1: A bukó teszt megírása**

`tests/unit/time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  dayKey,
  formatSlotDay,
  formatSlotFull,
  formatSlotTime,
  formatSlotTitle,
  groupSlotsByDay,
  zonedTimeToUtc,
} from "@/lib/time";

// These constants are UTC instants, named after their Budapest wall-clock time (OCT_15_00_30 is 00:30 on 15 October
// in Budapest). tests/setup.ts pins TZ=UTC, so any accidental use of the machine's time zone shows up here.
// 2026-10-14 is a Wednesday in summer time (UTC+2); 2026-11-03 a Tuesday in winter time (UTC+1).
const OCT_14_10_00 = "2026-10-14T08:00:00.000Z";
const NOV_03_14_30 = "2026-11-03T13:30:00.000Z";
const OCT_15_00_30 = "2026-10-14T22:30:00.000Z";

describe("Budapest formatting", () => {
  it("formats day, time, full and admin labels in Hungarian", () => {
    expect(formatSlotDay(OCT_14_10_00)).toBe("okt. 14., szerda");
    expect(formatSlotTime(NOV_03_14_30)).toBe("14:30");
    expect(formatSlotFull(OCT_14_10_00)).toBe("2026. október 14., szerda 10:00");
    expect(formatSlotTitle(OCT_14_10_00)).toBe("2026. 10. 14. (szerda) 10:00");
  });

  it("puts a slot on its Budapest day, not its UTC day", () => {
    expect(dayKey(OCT_15_00_30)).toBe("2026-10-15");
    // 22:30 UTC on the 14th is already the 15th in Budapest, so the day label, date and weekday must follow.
    expect(formatSlotDay(OCT_15_00_30)).toBe("okt. 15., csütörtök");
    expect(formatSlotTitle(OCT_15_00_30)).toBe("2026. 10. 15. (csütörtök) 00:30");
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(dayKey(new Date(OCT_15_00_30))).toBe("2026-10-15");
    expect(formatSlotTime(new Date(NOV_03_14_30))).toBe("14:30");
  });
});

describe("zonedTimeToUtc", () => {
  it("reads a wall-clock time as Budapest time in both summer and winter", () => {
    expect(zonedTimeToUtc("2026-10-14", "10:00")).toBe(OCT_14_10_00);
    expect(zonedTimeToUtc("2026-11-03", "14:30")).toBe(NOV_03_14_30);
  });

  it("reads times on the summer-time change days correctly", () => {
    expect(zonedTimeToUtc("2026-03-29", "01:30")).toBe("2026-03-29T00:30:00.000Z"); // still winter time
    expect(zonedTimeToUtc("2026-03-29", "03:30")).toBe("2026-03-29T01:30:00.000Z"); // summer time
    expect(zonedTimeToUtc("2026-10-25", "01:30")).toBe("2026-10-24T23:30:00.000Z"); // still summer time
    expect(zonedTimeToUtc("2026-10-25", "03:30")).toBe("2026-10-25T02:30:00.000Z"); // winter time
  });

  it("moves a skipped spring time forward and reads a repeated autumn time as winter time", () => {
    expect(zonedTimeToUtc("2026-03-29", "02:30")).toBe("2026-03-29T01:30:00.000Z"); // skipped: 03:30 summer time
    expect(zonedTimeToUtc("2026-10-25", "02:30")).toBe("2026-10-25T01:30:00.000Z"); // happens twice: the later, winter-time one
  });
});

describe("groupSlotsByDay", () => {
  it("groups by Budapest day, earliest first", () => {
    const days = groupSlotsByDay([
      { id: 3, startsAt: OCT_15_00_30 },
      { id: 2, startsAt: "2026-10-14T12:00:00.000Z" },
      { id: 1, startsAt: OCT_14_10_00 },
    ]);
    expect(days.map((d) => d.key)).toEqual(["2026-10-14", "2026-10-15"]);
    expect(days[0].label).toBe("okt. 14., szerda");
    expect(days[0].slots.map((s) => [s.id, s.time])).toEqual([
      [1, "10:00"],
      [2, "14:00"],
    ]);
    expect(days[1].slots[0]).toEqual({
      id: 3,
      startsAt: OCT_15_00_30,
      time: "00:30",
      label: "2026. október 15., csütörtök 00:30",
    });
  });

  it("leaves the caller's array in its original order", () => {
    const slots = [
      { id: 3, startsAt: OCT_15_00_30 },
      { id: 2, startsAt: "2026-10-14T12:00:00.000Z" },
      { id: 1, startsAt: OCT_14_10_00 },
    ];
    const before = structuredClone(slots);
    groupSlotsByDay(slots);
    expect(slots).toEqual(before);
  });
});
```

- [ ] **Step 2: Futtasd, és nézd meg, hogy elbukik**

```bash
npx vitest run tests/unit/time.test.ts
```

Expected: FAIL, `Cannot find package '@/lib/time'` (a modul még nem létezik).

- [ ] **Step 3: `lib/time.ts`**

```ts
export const TIME_ZONE = "Europe/Budapest";

const hu = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("hu-HU", { timeZone: TIME_ZONE, ...options });

// en-CA on purpose: it formats as YYYY-MM-DD, which zonedTimeToUtc and the seed build dates from. Don't "simplify" it
// to hu-HU, that gives "2026. 10. 14.".
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayLabelFormat = hu({ month: "short", day: "numeric", weekday: "long" });
const timeFormat = hu({ hour: "2-digit", minute: "2-digit" });
const fullFormat = hu({ year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit" });
const numericDateFormat = hu({ year: "numeric", month: "2-digit", day: "2-digit" });
const weekdayFormat = hu({ weekday: "long" });

/** A Date, or an ISO string with "Z" or an offset, as Payload returns dates (a date-time string without either is read in the machine's zone). */
type DateInput = Date | string;
const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

/** The Budapest calendar day, e.g. "2026-10-14"; slots are grouped by it. */
export const dayKey = (value: DateInput) => dayKeyFormat.format(toDate(value));
/** "okt. 14., szerda" */
export const formatSlotDay = (value: DateInput) => dayLabelFormat.format(toDate(value));
/** "10:00" */
export const formatSlotTime = (value: DateInput) => timeFormat.format(toDate(value));
/** "2026. október 14., szerda 10:00" */
export const formatSlotFull = (value: DateInput) => fullFormat.format(toDate(value));

/** "2026. 10. 14. (szerda) 10:00": a slot's name in the admin. */
export function formatSlotTitle(value: DateInput) {
  const date = toDate(value);
  return `${numericDateFormat.format(date)} (${weekdayFormat.format(date)}) ${timeFormat.format(date)}`;
}

const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** How far Budapest is ahead of UTC at an instant, in ms (1 or 2 hours). Built from formatted parts, so the machine's time zone never enters. */
function offsetAt(ms: number) {
  const p = Object.fromEntries(offsetFormat.formatToParts(ms).map((part) => [part.type, part.value]));
  // The parts have whole-second resolution.
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}

/**
 * Reads a wall-clock time as Budapest time and returns it as a UTC ISO string. The input is trusted, not validated:
 * `day` is "YYYY-MM-DD" and `time` is "HH:mm", e.g. ("2026-10-14", "10:00"). A time skipped by the spring clock change
 * moves forward one hour; a time repeated in autumn resolves to the later, winter-time instant.
 */
export function zonedTimeToUtc(day: string, time: string): string {
  const asUtc = Date.parse(`${day}T${time}:00.000Z`);
  // The first guess can lie across a summer-time change from asUtc, so read the offset again at the guess.
  const guess = asUtc - offsetAt(asUtc);
  return new Date(asUtc - offsetAt(guess)).toISOString();
}

export type OpenSlot = { id: number; startsAt: string; time: string; label: string };
export type SlotDay = { key: string; label: string; slots: OpenSlot[] };

/** Groups slots into Budapest calendar days, earliest first. */
export function groupSlotsByDay(slots: { id: number; startsAt: string }[]): SlotDay[] {
  const days = new Map<string, SlotDay>();
  const sorted = [...slots].sort((a, b) => toDate(a.startsAt).getTime() - toDate(b.startsAt).getTime());
  for (const slot of sorted) {
    const key = dayKey(slot.startsAt);
    let day = days.get(key);
    if (!day) {
      day = { key, label: formatSlotDay(slot.startsAt), slots: [] };
      days.set(key, day);
    }
    day.slots.push({
      id: slot.id,
      startsAt: slot.startsAt,
      time: formatSlotTime(slot.startsAt),
      label: formatSlotFull(slot.startsAt),
    });
  }
  return [...days.values()];
}
```

- [ ] **Step 4: Futtasd, most át kell mennie**

```bash
npx vitest run tests/unit/time.test.ts
```

Expected: PASS (8 teszt). Ha egy formázott szöveg csak írásjelben tér el (más ICU verzió), a Node 22 tényleges kimenete a mérvadó: `node -e "console.log(new Intl.DateTimeFormat('hu-HU',{timeZone:'Europe/Budapest',month:'short',day:'numeric',weekday:'long'}).format(new Date('2026-10-14T08:00:00Z')))"`.

- [ ] **Step 5: Commit**

```bash
git add lib/time.ts tests/unit/time.test.ts
git commit -m "$(cat <<'EOF'
feat: Budapest-time formatting and day grouping for slots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Webes űrlap ellenőrzése és korlátozó

**Files:**
- Create: `lib/booking-input.ts`
- Create: `lib/rate-limit.ts`
- Test: `tests/unit/booking-input.test.ts`
- Test: `tests/unit/rate-limit.test.ts`

- [ ] **Step 1: A bukó tesztek megírása**

`tests/unit/booking-input.test.ts`:

```ts
import { email as payloadEmail } from "payload/shared";
import { describe, expect, it } from "vitest";
import { PLACEMENTS, parseBookingInput, placementLabel } from "@/lib/booking-input";

const valid = {
  designId: "12",
  slotId: "4",
  name: "  Kovács Anna ",
  email: "anna@example.com",
  phone: "+36 30 123 4567",
  placement: "alkar",
  note: "Bal alkarra",
  adult: "on",
  website: "",
};

const PHONE_ERROR = "Adj meg egy érvényes telefonszámot (pl. +36 30 123 4567).";

describe("parseBookingInput", () => {
  it("accepts a complete form and trims the text", () => {
    expect(parseBookingInput(valid)).toEqual({
      ok: true,
      data: {
        designId: 12,
        slotId: 4,
        name: "Kovács Anna",
        email: "anna@example.com",
        phone: "+36 30 123 4567",
        placement: "alkar",
        note: "Bal alkarra",
        website: "",
      },
    });
  });

  it("reports every missing field", () => {
    const result = parseBookingInput({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual(
      ["adult", "designId", "email", "name", "phone", "placement", "slotId"].sort(),
    );
  });

  it("rejects a bad email, a short or lettered phone, an unknown placement and a long note", () => {
    const result = parseBookingInput({
      ...valid,
      email: "anna@",
      phone: "12-ab",
      placement: "fül",
      note: "x".repeat(1001),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toEqual({
      email: "Adj meg egy érvényes e-mail-címet.",
      phone: PHONE_ERROR,
      placement: "Válaszd ki a testtájat.",
      note: "A megjegyzés legfeljebb 1000 karakter lehet.",
    });
  });

  it("requires the 18+ box", () => {
    const result = parseBookingInput({ ...valid, adult: undefined });
    expect(result).toEqual({ ok: false, fieldErrors: { adult: "Csak 18 év felett foglalhatsz." } });
  });

  it("passes the honeypot through for the caller to judge", () => {
    const result = parseBookingInput({ ...valid, website: "spam.example" });
    expect(result.ok && result.data.website).toBe("spam.example");
  });

  it.each(["0", "1e3", "0x10", "12.0", "99999999999999999999"])("rejects %j as a design or slot id", (id) => {
    const result = parseBookingInput({ ...valid, designId: id, slotId: id });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toEqual({ designId: "Hiányzik a minta.", slotId: "Válassz időpontot." });
  });

  it("rejects a line break in the phone number", () => {
    const result = parseBookingInput({ ...valid, phone: "123\n456789" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toEqual({ phone: PHONE_ERROR });
  });

  it.each([
    ["line break", "Anna\nBcc: x"],
    ["tab", "Anna\tKiss"],
    ["delete character", "Anna\u007fKiss"],
    ["next-line character", "Anna\u0085Kiss"],
    ["line separator", "Anna\u2028Kiss"],
    ["bidi override", "Anna\u202eKiss"],
  ])("rejects a %s in the name", (_kind, name) => {
    const result = parseBookingInput({ ...valid, name });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toEqual({ name: "Add meg a neved." });
  });

  it("keeps line breaks in the note, which comes from a textarea", () => {
    const result = parseBookingInput({ ...valid, note: "Bal alkar\nkülső oldal" });
    expect(result.ok && result.data.note).toBe("Bal alkar\nkülső oldal");
  });

  it("counts a posted line break (CRLF) as one character, like the textarea's own maxLength does", () => {
    const typed = `${"x".repeat(990)}${"\n".repeat(5)}${"y".repeat(5)}`; // exactly 1000 characters in the browser
    const result = parseBookingInput({ ...valid, note: typed.replaceAll("\n", "\r\n") });
    expect(result.ok && result.data.note).toBe(typed);
  });
});

describe("parseBookingInput boundaries", () => {
  const emailOfLength = (n: number) => `${"a".repeat(n - 5)}@b.co`;

  it.each([
    { label: "a name of 1 character", field: "name", value: "A", ok: false },
    { label: "a name of 2 characters, accents included", field: "name", value: "Ád", ok: true },
    { label: "a name of 100 characters", field: "name", value: "a".repeat(100), ok: true },
    { label: "a name of 101 characters", field: "name", value: "a".repeat(101), ok: false },
    { label: "an email of 254 characters", field: "email", value: emailOfLength(254), ok: true },
    { label: "an email of 255 characters", field: "email", value: emailOfLength(255), ok: false },
    { label: "an email without a dot after the @", field: "email", value: "anna@example", ok: false },
    { label: "an email with a space", field: "email", value: "an na@example.com", ok: false },
    { label: "a phone of 5 digits", field: "phone", value: "12345", ok: false },
    { label: "a phone of 5 digits padded out with punctuation", field: "phone", value: "+(1)-2 3-4 5", ok: false },
    { label: "a phone with letters", field: "phone", value: "123456abc", ok: false },
    { label: "a phone of 20 characters", field: "phone", value: "12345678901234567890", ok: true },
    { label: "a phone of 21 characters", field: "phone", value: "123456789012345678901", ok: false },
    { label: "a phone with parentheses, plus and hyphen", field: "phone", value: "+(36) 30-123 4567", ok: true },
    { label: "design id 0", field: "designId", value: "0", ok: false },
    { label: "slot id 0", field: "slotId", value: "0", ok: false },
  ])("$label", ({ field, value, ok }) => {
    const result = parseBookingInput({ ...valid, [field]: value });
    expect(result.ok).toBe(ok);
    // Only the field under test may complain.
    if (!ok && !result.ok) expect(Object.keys(result.fieldErrors)).toEqual([field]);
  });
});

describe("phone numbers as people write and paste them", () => {
  it.each([
    { label: "the Hungarian slash notation", input: "06 30/123-4567", stored: "06 30/123-4567" },
    { label: "dots", input: "06.30.123.4567", stored: "06.30.123.4567" },
    { label: "no-break spaces from a copied number", input: "+36\u00a030\u00a0123\u00a04567", stored: "+36 30 123 4567" },
    { label: "narrow no-break spaces", input: "+36\u202f30\u202f123\u202f4567", stored: "+36 30 123 4567" },
    { label: "en dashes", input: "06\u201330\u2013123\u20134567", stored: "06-30-123-4567" },
    { label: "runs of spaces", input: "+36   30 123  4567", stored: "+36 30 123 4567" },
  ])("accepts $label and stores plain characters", ({ input, stored }) => {
    const result = parseBookingInput({ ...valid, phone: input });
    expect(result.ok && result.data.phone).toBe(stored);
  });
});

describe("email", () => {
  // The booking's email field is validated by Payload on create. Whatever this form lets through but Payload refuses
  // shows up as an unspecific failure instead of a message under the field.
  const payloadAccepts = (value: string) =>
    payloadEmail(value, { required: true, req: { t: (key: string) => key, payload: { config: { collections: [] } } } } as never) === true;

  it.each([
    "anna@example.com",
    "anna.kovacs+flash@gmail.com",
    "ANNA@EXAMPLE.COM",
    "a'b@example.com",
    "anna@sub.example.co.uk",
    "anna@example.c",
    "anna@example.com.",
    "a..b@example.com",
    ".anna@example.com",
    "anna@-example.com",
    "anna@exa_mple.com",
    "kovács.anna@gmail.com",
    "anna@példa.hu",
    "an,na@example.com",
    "Anna<anna@example.com>",
    "anna@1.2.3.4",
  ])("gives %j the same verdict as Payload", (value) => {
    const result = parseBookingInput({ ...valid, email: value });
    const formAccepts = result.ok || !("email" in result.fieldErrors);
    expect(formAccepts).toBe(payloadAccepts(value));
  });
});

describe("placements", () => {
  it("offers the eight body areas of the spec, and accepts every one of them", () => {
    expect(PLACEMENTS).toEqual([
      { value: "alkar", label: "Alkar" },
      { value: "felkar", label: "Felkar" },
      { value: "comb", label: "Comb" },
      { value: "labszar", label: "Lábszár" },
      { value: "hat", label: "Hát" },
      { value: "oldal", label: "Oldal" },
      { value: "gerinc", label: "Gerinc" },
      { value: "mas", label: "Más testtáj" },
    ]);
    for (const { value } of PLACEMENTS) expect(parseBookingInput({ ...valid, placement: value }).ok).toBe(true);
  });
});

describe("placementLabel", () => {
  it("turns a stored value into its Hungarian label", () => {
    expect(placementLabel("labszar")).toBe("Lábszár");
    expect(placementLabel("ismeretlen")).toBe("ismeretlen");
  });
});
```

`tests/unit/rate-limit.test.ts`:

```ts
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
```

- [ ] **Step 2: Futtasd, és nézd meg, hogy elbukik**

```bash
npx vitest run tests/unit/booking-input.test.ts tests/unit/rate-limit.test.ts
```

Expected: FAIL, mindkét import feloldhatatlan.

- [ ] **Step 3: `lib/booking-input.ts`**

```ts
export const PLACEMENTS = [
  { value: "alkar", label: "Alkar" },
  { value: "felkar", label: "Felkar" },
  { value: "comb", label: "Comb" },
  { value: "labszar", label: "Lábszár" },
  { value: "hat", label: "Hát" },
  { value: "oldal", label: "Oldal" },
  { value: "gerinc", label: "Gerinc" },
  { value: "mas", label: "Más testtáj" },
] as const;

export type Placement = (typeof PLACEMENTS)[number]["value"];

export const placementLabel = (value: string) => PLACEMENTS.find((p) => p.value === value)?.label ?? value;

export type BookingInput = {
  designId: number;
  slotId: number;
  name: string;
  email: string;
  phone: string;
  placement: Placement;
  note: string;
  /** Honeypot: people never see this field, so anything in it came from a bot. */
  website: string;
};

export type BookingField = "designId" | "slotId" | "name" | "email" | "phone" | "placement" | "note" | "adult";
export type FieldErrors = Partial<Record<BookingField, string>>;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Pasted or autofilled numbers often carry no-break spaces and typographic dashes that look like the plain ones. */
const phoneText = (value: unknown) =>
  text(value)
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/[\u2010-\u2015\u2212]/g, "-");

/** Browsers post a textarea's line breaks as CRLF; count and keep them as one character, like the textarea's own maxLength. */
const noteText = (value: unknown) => text(value).replace(/\r\n?/g, "\n");

const positiveInt = (value: unknown) => {
  const raw = text(value);
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

const isPlacement = (value: string): value is Placement => PLACEMENTS.some((p) => p.value === value);

/** Controls (CR, LF, tab, C1), line and paragraph separators and bidi overrides: a name is one plain line. */
const NOT_IN_A_NAME = /[\p{Cc}\p{Zl}\p{Zp}\u202a-\u202e\u2066-\u2069]/u;

/**
 * The rule Payload applies to the booking's email field (payload 3.90.2, fields/validations). Anything laxer here
 * passes the form and then fails inside payload.create, where the visitor only gets the generic error.
 */
const EMAIL =
  /^(?!.*\.\.)[\w!#$%&'*+/=?^`{|}~-](?:[\w!#$%&'*+/=?^`{|}~.-]*[\w!#$%&'*+/=?^`{|}~-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

/** Checks the booking form on the server; the browser's own validation is only a convenience. */
export function parseBookingInput(
  raw: Record<string, unknown>,
): { ok: true; data: BookingInput } | { ok: false; fieldErrors: FieldErrors } {
  const errors: FieldErrors = {};
  const designId = positiveInt(raw.designId);
  const slotId = positiveInt(raw.slotId);
  const name = text(raw.name);
  const email = text(raw.email);
  const phone = phoneText(raw.phone);
  const placement = text(raw.placement);
  const note = noteText(raw.note);

  if (designId === null) errors.designId = "Hiányzik a minta.";
  if (slotId === null) errors.slotId = "Válassz időpontot.";
  if (name.length < 2 || name.length > 100 || NOT_IN_A_NAME.test(name)) errors.name = "Add meg a neved.";
  if (email.length > 254 || !EMAIL.test(email)) {
    errors.email = "Adj meg egy érvényes e-mail-címet.";
  }
  if (!/^[0-9+()\-/. ]{6,20}$/.test(phone) || phone.replace(/\D/g, "").length < 6) {
    errors.phone = "Adj meg egy érvényes telefonszámot (pl. +36 30 123 4567).";
  }
  if (!isPlacement(placement)) errors.placement = "Válaszd ki a testtájat.";
  if (note.length > 1000) errors.note = "A megjegyzés legfeljebb 1000 karakter lehet.";
  if (raw.adult !== "on" && raw.adult !== "true" && raw.adult !== true) {
    errors.adult = "Csak 18 év felett foglalhatsz.";
  }

  if (designId === null || slotId === null || !isPlacement(placement) || Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }
  return {
    ok: true,
    data: { designId, slotId, name, email, phone, placement, note, website: text(raw.website) },
  };
}
```

- [ ] **Step 4: `lib/rate-limit.ts`**

```ts
/** Counts events per key in a sliding window. Kept in memory: one Node process, reset on restart. */
export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  const events = new Map<string, number[]>();

  function recent(key: string) {
    const cutoff = now() - windowMs;
    const list = (events.get(key) ?? []).filter((time) => time > cutoff);
    if (list.length > 0) events.set(key, list);
    else events.delete(key);
    return list;
  }

  return {
    /** Counts one event if the key is under its limit; false once it is reached. Synchronous, so parallel requests can't all slip through. */
    take(key: string) {
      const list = recent(key);
      if (list.length >= limit) return false;
      events.set(key, [...list, now()]);
      return true;
    },
    /** Gives back the key's latest event, e.g. when the booking it was taken for did not go through. */
    release(key: string) {
      const list = recent(key);
      list.pop();
      if (list.length > 0) events.set(key, list);
      else events.delete(key);
    },
  };
}
```

- [ ] **Step 5: Futtasd, most át kell mennie**

```bash
npx vitest run tests/unit/booking-input.test.ts tests/unit/rate-limit.test.ts
```

Expected: PASS (63 teszt).

- [ ] **Step 6: Commit**

```bash
git add lib/booking-input.ts lib/rate-limit.ts tests/unit/booking-input.test.ts tests/unit/rate-limit.test.ts
git commit -m "$(cat <<'EOF'
feat: booking form validation and an in-memory rate limiter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Domain gyűjtemények és törlésvédelem

**Files:**
- Create: `cms/booking/guards.ts`
- Create: `cms/collections/Categories.ts`
- Create: `cms/collections/Designs.ts`
- Create: `cms/collections/Slots.ts`
- Create: `cms/collections/Bookings.ts`
- Modify: `payload.config.ts`
- Modify: `payload-types.ts` (generált)
- Modify: `tests/helpers.ts`
- Test: `tests/int/collections.test.ts`

- [ ] **Step 1: `cms/booking/guards.ts`**

```ts
import { APIError, type CollectionBeforeDeleteHook, type CollectionSlug, type Where } from "payload";

/** A delete the guards turn down on purpose: the admin sees the message, and the server logs it at info (payload.config.ts). */
export class DeleteRefusedError extends APIError {
  constructor(message: string) {
    super(message, 400, null, true);
    // Set by hand: loggingLevels matches on the name, and a minifier may rename the class.
    this.name = "DeleteRefusedError";
  }
}

function refuseWhileReferenced(collection: CollectionSlug, field: string, message: string): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    const where: Where = { [field]: { equals: id } };
    const { totalDocs } = await req.payload.count({ collection, where, overrideAccess: true, req });
    if (totalDocs > 0) throw new DeleteRefusedError(message);
  };
}

export const guardCategoryDelete = refuseWhileReferenced(
  "designs",
  "category",
  "A kollekció nem törölhető, amíg minta tartozik hozzá. Előbb helyezd át vagy töröld a mintáit.",
);

export const guardDesignDelete = refuseWhileReferenced(
  "bookings",
  "design",
  "A minta nem törölhető, mert foglalás tartozik hozzá. Ha nem szeretnéd az oldalon mutatni, kapcsold ki a „Megjelenik az oldalon” beállítást.",
);

// Rejected and cancelled bookings no longer hold a slot, so only active ones block this.
export const guardSlotDelete = refuseWhileReferenced(
  "bookings",
  "slot",
  "Az időpont nem törölhető, mert foglalás tartozik hozzá. Előbb utasítsd el vagy mondd le a foglalást.",
);

// Payload removes an upload's files before the row, so without this check the row delete would fail on the design's
// image reference only after the artwork was gone from disk.
export const guardMediaDelete = refuseWhileReferenced(
  "designs",
  "images.image",
  "A kép nem törölhető, mert flash minta használja. Előbb cseréld le a mintában.",
);
```

- [ ] **Step 2: `cms/collections/Categories.ts`**

```ts
import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionConfig } from "payload";
import type { Category } from "@/payload-types";
import { anyone, isAdmin } from "../access";
import { guardCategoryDelete } from "../booking/guards";

/** Only a limited collection has a limit; clearing it otherwise keeps an old value from coming back with the rule. */
const clearUnusedLimit: CollectionBeforeChangeHook<Category> = ({ data, originalDoc }) => {
  if ((data.rule ?? originalDoc?.rule) !== "limited") data.limit = null;
  return data;
};

/** Designs carry the collection's name ("P’CONs #027"); re-saving them after a rename lets prepareDesign catch up. */
const renameDesigns: CollectionAfterChangeHook<Category> = async ({ doc, operation, previousDoc, req }) => {
  if (operation !== "update" || previousDoc.name === doc.name) return;
  const { errors } = await req.payload.update({
    collection: "designs",
    where: { category: { equals: doc.id } },
    data: {},
    depth: 0,
    overrideAccess: true,
    req,
  });
  // A bulk update reports failed documents instead of throwing; the rename itself is already saved.
  if (errors.length > 0) req.payload.logger.error({ errors, msg: "Some designs kept the collection's old name" });
};

export const Categories: CollectionConfig = {
  slug: "categories",
  labels: { singular: "Kollekció", plural: "Kollekciók" },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "rule", "limit", "order"],
    group: "Flash",
    description: "A kollekció dönti el, hányszor foglalható egy-egy mintája.",
  },
  defaultSort: "order",
  // Payload's copy appends an English " - Copy" to the name.
  disableDuplicate: true,
  access: { read: anyone, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: { beforeChange: [clearUnusedLimit], afterChange: [renameDesigns], beforeDelete: [guardCategoryDelete] },
  fields: [
    { name: "name", type: "text", required: true, unique: true, label: "Név" },
    {
      name: "rule",
      type: "select",
      required: true,
      defaultValue: "single",
      label: "Foglalhatóság",
      options: [
        { label: "Egyszeri – minden minta egyszer foglalható", value: "single" },
        { label: "Limitált – minden minta x alkalommal foglalható", value: "limited" },
        { label: "Korlátlan – bármennyiszer foglalható", value: "unlimited" },
      ],
    },
    {
      name: "limit",
      type: "number",
      // Selects Payload's single-number field type, so validate's arguments below are typed.
      hasMany: false,
      label: "Alkalmak száma",
      admin: {
        condition: (_, siblingData) => siblingData?.rule === "limited",
        description: "Hányszor foglalható egy minta ebben a kollekcióban.",
        step: 1,
      },
      validate: (value, { siblingData }) =>
        (siblingData as { rule?: string }).rule !== "limited" ||
        (typeof value === "number" && Number.isInteger(value) && value >= 2) ||
        "Limitált kollekciónál legalább 2 alkalmat adj meg.",
    },
    {
      name: "order",
      type: "number",
      defaultValue: 0,
      label: "Sorrend",
      admin: { position: "sidebar", description: "A kisebb szám előrébb kerül az oldalon." },
    },
  ],
};
```

- [ ] **Step 3: `cms/collections/Designs.ts`**

```ts
import { ValidationError, type CollectionBeforeChangeHook, type CollectionConfig, type Where } from "payload";
import { relationId } from "@/lib/booking-rules";
import type { Design } from "@/payload-types";
import { adminOrVisible, isAdmin } from "../access";
import { guardDesignDelete } from "../booking/guards";

/** Trims the number, refuses one the collection already has, and names the design "P’CONs #027" for admin lists and pickers. */
const prepareDesign: CollectionBeforeChangeHook<Design> = async ({ data, originalDoc, req }) => {
  if (typeof data.number === "string") data.number = data.number.trim();
  const categoryId = relationId(data.category ?? originalDoc?.category);
  const number = data.number ?? originalDoc?.number;
  if (categoryId === null || !number) return data;

  // Checked here, a clash shows on the number field; the unique (category, number) index still settles two saves at once.
  const sameNumber: Where[] = [{ category: { equals: categoryId } }, { number: { equals: number } }];
  if (originalDoc?.id) sameNumber.push({ id: { not_equals: originalDoc.id } });
  const { totalDocs } = await req.payload.count({
    collection: "designs",
    where: { and: sameNumber },
    overrideAccess: true,
    req,
  });
  if (totalDocs > 0) {
    throw new ValidationError(
      {
        collection: "designs",
        errors: [{ path: "number", label: "Sorszám", message: "Ebben a kollekcióban már van ilyen sorszámú minta." }],
      },
      req.t,
    );
  }

  const category = await req.payload.findByID({
    collection: "categories",
    id: categoryId,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
  });
  if (category) data.title = `${category.name} #${number}`;
  return data;
};

export const Designs: CollectionConfig = {
  slug: "designs",
  labels: { singular: "Flash minta", plural: "Flash minták" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "price", "visible", "updatedAt"],
    group: "Flash",
    listSearchableFields: ["title", "number"],
  },
  defaultSort: "-createdAt",
  // A copy would keep the number, which its collection already has.
  disableDuplicate: true,
  access: { read: adminOrVisible, create: isAdmin, update: isAdmin, delete: isAdmin },
  indexes: [{ fields: ["category", "number"], unique: true }],
  hooks: { beforeChange: [prepareDesign], beforeDelete: [guardDesignDelete] },
  fields: [
    { name: "title", type: "text", label: "Minta", admin: { hidden: true, disableBulkEdit: true } },
    {
      type: "row",
      fields: [
        { name: "category", type: "relationship", relationTo: "categories", required: true, label: "Kollekció" },
        {
          name: "number",
          type: "text",
          required: true,
          label: "Sorszám",
          admin: { description: "A név után áll: 027 → P’CONs #027." },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "price",
          type: "number",
          required: true,
          min: 0,
          label: "Ár (Ft)",
          admin: { description: "Tájékoztató ár, az oldalon nincs fizetés." },
        },
        {
          name: "badge",
          type: "select",
          label: "Címke",
          options: [
            { label: "Új", value: "new" },
            { label: "Utolsó", value: "last" },
          ],
          admin: { description: "Az „Elkelt” címke magától kerül fel." },
        },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "size", type: "text", label: "Ajánlott méret", admin: { placeholder: "15–18 cm" } },
        { name: "placements", type: "text", label: "Ajánlott testtájak", admin: { placeholder: "alkar, comb, oldal" } },
      ],
    },
    { name: "description", type: "textarea", label: "Leírás" },
    {
      name: "images",
      type: "array",
      label: "Képek",
      labels: { singular: "Kép", plural: "Képek" },
      minRows: 1,
      required: true,
      admin: { description: "Az első kép jelenik meg a kártyán. A rajz fehér hátterű legyen, így ráolvad a panelre." },
      fields: [
        { name: "image", type: "upload", relationTo: "media", required: true, label: "Kép" },
        {
          type: "row",
          fields: [
            {
              name: "kind",
              type: "select",
              required: true,
              defaultValue: "art",
              label: "Típus",
              options: [
                { label: "Rajz", value: "art" },
                { label: "Fotó", value: "photo" },
              ],
            },
            {
              name: "label",
              type: "text",
              defaultValue: "Minta",
              label: "Felirat",
              admin: { description: "pl. Minta, Bőrön, Részlet" },
            },
          ],
        },
      ],
    },
    {
      name: "visible",
      type: "checkbox",
      defaultValue: true,
      label: "Megjelenik az oldalon",
      admin: { position: "sidebar" },
    },
  ],
};
```

- [ ] **Step 4: `cms/collections/Slots.ts`**

```ts
import type { CollectionBeforeChangeHook, CollectionConfig, FieldHook } from "payload";
import { TIME_ZONE, formatSlotTitle } from "@/lib/time";
import type { Slot } from "@/payload-types";
import { isAdmin } from "../access";
import { guardSlotDelete } from "../booking/guards";

const setTitle: CollectionBeforeChangeHook<Slot> = ({ data, originalDoc }) => {
  const startsAt = data.startsAt ?? originalDoc?.startsAt;
  // Collection hooks run before field validation: a bad date is left for the date field to reject (400, not 500).
  if (startsAt && !Number.isNaN(Date.parse(startsAt))) data.title = formatSlotTitle(startsAt);
  return data;
};

/** List column: whether a booking holds the slot, or it passed unbooked. */
const slotState: FieldHook<Slot> = async ({ data, req }) => {
  if (!data?.id) return undefined;
  const { totalDocs } = await req.payload.count({
    collection: "bookings",
    where: { slot: { equals: data.id } },
    overrideAccess: true,
    req,
  });
  if (totalDocs > 0) return "Foglalt";
  return data.startsAt && new Date(data.startsAt).getTime() < Date.now() ? "Lejárt" : "Szabad";
};

export const Slots: CollectionConfig = {
  slug: "slots",
  labels: { singular: "Időpont", plural: "Időpontok" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "state"],
    group: "Foglalás",
    description: "Szabad időpontok, amelyekre az oldalon flash mintát lehet foglalni. Egy időpontra egy foglalás jut.",
  },
  defaultSort: "startsAt",
  disableDuplicate: true,
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: { beforeChange: [setTitle], beforeDelete: [guardSlotDelete] },
  fields: [
    { name: "title", type: "text", label: "Időpont", admin: { hidden: true, disableBulkEdit: true } },
    {
      name: "startsAt",
      type: "date",
      required: true,
      unique: true,
      label: "Kezdés",
      timezone: {
        defaultTimezone: TIME_ZONE,
        supportedTimezones: [{ label: "Budapest", value: TIME_ZONE }],
        // Budapest is the only zone and Payload fills it in; left required, the generated type would make every
        // slot create pass startsAt_tz. The admin's zone picker stays required: it follows startsAt's `required`.
        override: ({ baseField }) => ({
          ...baseField,
          required: false,
          label: "Időzóna",
          admin: { ...baseField.admin, disableListColumn: true, disableListFilter: true, disableBulkEdit: true },
        }),
      },
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
          timeIntervals: 15,
          timeFormat: "HH:mm",
          displayFormat: "yyyy. MM. dd. HH:mm",
        },
      },
    },
    {
      name: "state",
      type: "text",
      virtual: true,
      label: "Állapot",
      admin: { readOnly: true },
      hooks: { afterRead: [slotState] },
    },
  ],
};
```

- [ ] **Step 5: `cms/collections/Bookings.ts` (mezők, még szabály-hook nélkül)**

```ts
import type { CollectionConfig, Where } from "payload";
import { PLACEMENTS } from "@/lib/booking-input";
import { STATUS_LABELS, relationId } from "@/lib/booking-rules";
import { isAdmin } from "../access";

export const Bookings: CollectionConfig = {
  slug: "bookings",
  labels: { singular: "Foglalás", plural: "Foglalások" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slotStartsAt", "status", "phone", "createdAt"],
    group: "Foglalás",
    description:
      "Az oldalon beküldött és a kézzel felvett foglalások. Elutasításkor vagy lemondáskor az időpont és a minta egy alkalma újra foglalható lesz.",
    listSearchableFields: ["name", "email", "phone", "designName"],
  },
  defaultSort: "-createdAt",
  disableDuplicate: true,
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  // Together with the unique slot this keeps simultaneous requests from overbooking (SQLite allows many NULLs).
  indexes: [{ fields: ["design", "seat"], unique: true }],
  fields: [
    { name: "title", type: "text", label: "Foglalás", admin: { hidden: true, disableBulkEdit: true } },
    {
      type: "row",
      fields: [
        {
          name: "design",
          type: "relationship",
          relationTo: "designs",
          required: true,
          label: "Minta",
          // "Edit many" saves the bookings in parallel: moved onto one design together, they'd all pick the same seat.
          admin: { disableBulkEdit: true },
        },
        {
          name: "slot",
          type: "relationship",
          relationTo: "slots",
          unique: true,
          label: "Időpont",
          admin: { description: "Csak szabad időpont választható." },
          // The picker only offers slots no other booking holds.
          filterOptions: async ({ id, req }) => {
            const conditions: Where[] = [{ slot: { exists: true } }];
            if (id) conditions.push({ id: { not_equals: id } });
            const held = await req.payload.find({
              collection: "bookings",
              where: { and: conditions },
              select: { slot: true },
              depth: 0,
              pagination: false,
              overrideAccess: true,
              req,
            });
            const taken = held.docs.map((b) => relationId(b.slot)).filter((v): v is number => v !== null);
            return taken.length > 0 ? { id: { not_in: taken } } : true;
          },
        },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      label: "Állapot",
      options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ label, value })),
      admin: { position: "sidebar" },
    },
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true, label: "Név" },
        { name: "email", type: "email", required: true, label: "E-mail" },
        { name: "phone", type: "text", required: true, label: "Telefon" },
      ],
    },
    {
      name: "placement",
      type: "select",
      required: true,
      label: "Testtáj",
      options: PLACEMENTS.map(({ label, value }) => ({ label, value })),
    },
    { name: "note", type: "textarea", maxLength: 1000, label: "Megjegyzés" },
    {
      name: "adultConfirmed",
      type: "checkbox",
      required: true,
      label: "Elmúlt 18 éves",
      validate: (value) => value === true || "Csak 18 év feletti ügyfél foglalhat.",
    },
    {
      name: "seat",
      type: "number",
      label: "Sorszám (belső)",
      // "Edit many" still lists hidden fields; a bulk-set seat would clash with the unique (design, seat) index.
      admin: { hidden: true, disableListColumn: true, disableListFilter: true, disableBulkEdit: true },
    },
    { name: "designName", type: "text", label: "Minta (foglaláskor)", admin: { readOnly: true, position: "sidebar" } },
    {
      name: "slotStartsAt",
      type: "date",
      label: "Időpont (foglaláskor)",
      admin: {
        readOnly: true,
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime", displayFormat: "yyyy. MM. dd. HH:mm" },
      },
    },
    { name: "price", type: "number", label: "Ár a foglaláskor (Ft)", admin: { readOnly: true, position: "sidebar" } },
  ],
};
```

- [ ] **Step 6: `payload.config.ts`: gyűjtemények és időzóna**

Az importok közé:

```ts
import { TIME_ZONE } from "./lib/time";
import { Bookings } from "./cms/collections/Bookings";
import { Categories } from "./cms/collections/Categories";
import { Designs } from "./cms/collections/Designs";
import { Slots } from "./cms/collections/Slots";
```

Az `admin` blokkba a `meta` után:

```ts
    timezones: {
      defaultTimezone: TIME_ZONE,
      supportedTimezones: [{ label: "Budapest", value: TIME_ZONE }],
    },
```

A `collections` sort cseréld erre (ez adja az admin menü sorrendjét):

```ts
  collections: [Bookings, Slots, Designs, Categories, Media, Users],
```

- [ ] **Step 7: Típusok újragenerálása**

```bash
npm run generate:types && grep -E "export interface (Category|Design|Slot|Booking) " payload-types.ts
```

Expected: mind a négy interfész megjelenik.

- [ ] **Step 8: Tesztsegédek bővítése: a `tests/helpers.ts` teljes új tartalma**

```ts
import { fileURLToPath } from "node:url";
import config from "@payload-config";
import { getPayload, type Payload } from "payload";
import type { BookingInput } from "@/lib/booking-input";
import type { BookingRule } from "@/lib/booking-rules";
import type { Booking } from "@/payload-types";

export function getTestPayload(): Promise<Payload> {
  return getPayload({ config });
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let sequence = 0;
let imageId: number | undefined;

/** Clears everything but images and admins, in the order the delete guards allow. */
export async function resetDatabase(payload: Payload) {
  for (const collection of ["bookings", "slots", "designs", "categories"] as const) {
    // A bulk delete reports the documents it couldn't delete instead of throwing.
    const { errors } = await payload.delete({ collection, where: { id: { exists: true } }, overrideAccess: true });
    if (errors.length > 0) throw new Error(`Could not clear ${collection}: ${errors.map((e) => e.message).join("; ")}`);
  }
}

export async function createCategory(payload: Payload, rule: BookingRule, limit?: number) {
  sequence += 1;
  return payload.create({ collection: "categories", data: { name: `Teszt ${sequence}`, rule, limit, order: sequence } });
}

/** Uploads the fixture image as a new media document. */
export function createImage(payload: Payload) {
  return payload.create({
    collection: "media",
    data: { alt: "Tesztminta" },
    filePath: fileURLToPath(new URL("./fixtures/sample.webp", import.meta.url)),
  });
}

/** One image shared by every design that doesn't ask for its own. */
async function testImage(payload: Payload) {
  imageId ??= (await createImage(payload)).id;
  return imageId;
}

export async function createDesign(
  payload: Payload,
  categoryId: number,
  data: { visible?: boolean; price?: number; number?: string; image?: number } = {},
) {
  sequence += 1;
  return payload.create({
    collection: "designs",
    data: {
      category: categoryId,
      number: data.number ?? String(sequence).padStart(3, "0"),
      price: data.price ?? 90000,
      visible: data.visible ?? true,
      images: [{ image: data.image ?? (await testImage(payload)), kind: "art", label: "Minta" }],
    },
  });
}

/** A slot over a week from now (or over a week ago); each call goes an hour further, so start times never collide. */
export async function createSlot(payload: Payload, { past = false } = {}) {
  sequence += 1;
  const offset = 7 * DAY + sequence * HOUR;
  const startsAt = new Date(Date.now() + (past ? -offset : offset)).toISOString();
  return payload.create({ collection: "slots", data: { startsAt } });
}

export const customer = {
  name: "Teszt Elek",
  email: "teszt.elek@example.com",
  phone: "+36 30 123 4567",
  placement: "alkar",
  adultConfirmed: true,
} as const;

/** Books the way the admin panel does: no website-only rules apply. */
export async function createBooking(
  payload: Payload,
  design: number,
  slot: number,
  data: { status?: Booking["status"] } = {},
) {
  return payload.create({ collection: "bookings", data: { ...customer, design, slot, status: data.status ?? "pending" } });
}

/** What the website form sends for a design and a slot. */
export function publicInput(designId: number, slotId: number): BookingInput {
  const { name, email, phone, placement } = customer;
  return { designId, slotId, name, email, phone, placement, note: "", website: "" };
}
```

- [ ] **Step 9: Integrációs teszt: `tests/int/collections.test.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import { Forbidden, logError, type Payload, type SelectField } from "payload";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBooking,
  createCategory,
  createDesign,
  createImage,
  createSlot,
  customer,
  getTestPayload,
  resetDatabase,
} from "../helpers";

let payload: Payload;

beforeAll(async () => {
  payload = await getTestPayload();
});

beforeEach(async () => {
  await resetDatabase(payload);
});

/** Whether an upload's file is in the media folder (tests/setup.ts points MEDIA_DIR at a temp folder). */
const onDisk = (filename: string | null | undefined) =>
  Boolean(filename) && fs.existsSync(path.join(process.env.MEDIA_DIR ?? "", filename ?? ""));

describe("collections", () => {
  it("names designs and slots for the admin", async () => {
    const category = await createCategory(payload, "single");
    const design = await createDesign(payload, category.id);
    expect(design.title).toBe(`${category.name} #${design.number}`);

    const slot = await payload.create({ collection: "slots", data: { startsAt: "2026-10-14T08:00:00.000Z" } });
    expect(slot.title).toBe("2026. 10. 14. (szerda) 10:00");
  });

  it("renames a collection's designs with it", async () => {
    const category = await createCategory(payload, "single");
    const { id } = await createDesign(payload, category.id);
    const before = await payload.findByID({ collection: "designs", id, depth: 0 });

    await payload.update({ collection: "categories", id: category.id, data: { name: "Átnevezett" } });

    const after = await payload.findByID({ collection: "designs", id, depth: 0 });
    expect(after.title).toBe(`Átnevezett #${before.number}`);
    expect(after.images).toEqual(before.images);
  });

  it("stores a design number trimmed", async () => {
    const category = await createCategory(payload, "single");
    const design = await createDesign(payload, category.id, { number: " 027 " });
    expect(design.number).toBe("027");
    expect(design.title).toBe(`${category.name} #027`);
  });

  it("refuses a number its collection already has, but not another collection's", async () => {
    const category = await createCategory(payload, "single");
    await createDesign(payload, category.id, { number: "027" });

    await expect(createDesign(payload, category.id, { number: "027" })).rejects.toMatchObject({
      name: "ValidationError",
      data: { errors: [{ path: "number", message: "Ebben a kollekcióban már van ilyen sorszámú minta." }] },
    });
    const other = await createCategory(payload, "single");
    expect((await createDesign(payload, other.id, { number: "027" })).number).toBe("027");
  });

  it("doesn't duplicate designs or collections", async () => {
    const category = await createCategory(payload, "single");
    const design = await createDesign(payload, category.id);
    await expect(payload.duplicate({ collection: "designs", id: design.id })).rejects.toThrow(/cannot be duplicated/);
    await expect(payload.duplicate({ collection: "categories", id: category.id })).rejects.toThrow(
      /cannot be duplicated/,
    );
  });

  it("asks for at least two bookings on a limited collection", async () => {
    await expect(
      payload.create({ collection: "categories", data: { name: "Hibás", rule: "limited", limit: 1 } }),
    ).rejects.toMatchObject({ name: "ValidationError", data: { errors: [{ path: "limit" }] } });
    expect((await createCategory(payload, "limited", 2)).limit).toBe(2);
  });

  it("drops the limit of a collection that isn't limited", async () => {
    const limited = await createCategory(payload, "limited", 3);
    const single = await payload.update({ collection: "categories", id: limited.id, data: { rule: "single" } });
    expect(single.limit).toBeNull();
    expect((await createCategory(payload, "unlimited", 5)).limit).toBeNull();
  });

  it("refuses a second slot at the same time", async () => {
    const { startsAt } = await createSlot(payload);
    await expect(payload.create({ collection: "slots", data: { startsAt } })).rejects.toMatchObject({
      name: "ValidationError",
      data: { errors: [{ path: "startsAt" }] },
    });
  });

  it("hides switched-off designs from visitors", async () => {
    const category = await createCategory(payload, "single");
    await createDesign(payload, category.id, { visible: false });
    const shown = await createDesign(payload, category.id);
    const result = await payload.find({ collection: "designs", overrideAccess: false });
    expect(result.docs.map((d) => d.id)).toEqual([shown.id]);
  });

  it("keeps visitors away from bookings, slots and admin accounts", async () => {
    const category = await createCategory(payload, "single");
    const design = await createDesign(payload, category.id);
    const slot = await createSlot(payload);

    for (const collection of ["bookings", "slots", "users"] as const) {
      await expect(payload.find({ collection, overrideAccess: false })).rejects.toBeInstanceOf(Forbidden);
    }
    await expect(
      payload.create({
        collection: "bookings",
        data: { ...customer, design: design.id, slot: slot.id, status: "pending" },
        overrideAccess: false,
      }),
    ).rejects.toBeInstanceOf(Forbidden);
    const categories = await payload.find({ collection: "categories", overrideAccess: false });
    expect(categories.docs.map((c) => c.id)).toEqual([category.id]);
  });

  it("keeps referenced collections, designs and slots from being deleted", async () => {
    const category = await createCategory(payload, "unlimited");
    const design = await createDesign(payload, category.id);
    const slot = await createSlot(payload);
    await createBooking(payload, design.id, slot.id);

    await expect(payload.delete({ collection: "categories", id: category.id })).rejects.toThrow(/minta tartozik/);
    await expect(payload.delete({ collection: "designs", id: design.id })).rejects.toThrow(/foglalás tartozik/);
    await expect(payload.delete({ collection: "slots", id: slot.id })).rejects.toThrow(/foglalás tartozik/);
  });

  it("keeps an image a design uses, files and all", async () => {
    const used = await createImage(payload);
    const unused = await createImage(payload);
    await createDesign(payload, (await createCategory(payload, "single")).id, { image: used.id });

    await expect(payload.delete({ collection: "media", id: used.id })).rejects.toThrow(
      "A kép nem törölhető, mert flash minta használja. Előbb cseréld le a mintában.",
    );
    expect(onDisk(used.filename)).toBe(true);
    expect(onDisk(used.sizes?.thumbnail?.filename)).toBe(true);

    await payload.delete({ collection: "media", id: unused.id });
    expect(onDisk(unused.filename)).toBe(false);
  });

  it("logs a refused delete as info, not as a server error", async () => {
    const category = await createCategory(payload, "single");
    await createDesign(payload, category.id);
    const refusal = await payload.delete({ collection: "categories", id: category.id }).catch((err: unknown) => err);
    expect(refusal).toMatchObject({ name: "DeleteRefusedError", status: 400, isPublic: true });

    const info = vi.spyOn(payload.logger, "info").mockImplementation(() => {});
    const error = vi.spyOn(payload.logger, "error").mockImplementation(() => {});
    try {
      logError({ err: refusal, payload });
      expect(info).toHaveBeenCalledOnce();
      expect(error).not.toHaveBeenCalled();
    } finally {
      info.mockRestore();
      error.mockRestore();
    }
  });

  it("shows whether a slot is free, booked or past", async () => {
    const category = await createCategory(payload, "unlimited");
    const design = await createDesign(payload, category.id);
    const free = await createSlot(payload);
    const booked = await createSlot(payload);
    const past = await createSlot(payload, { past: true });
    await createBooking(payload, design.id, booked.id);

    const state = async (id: number) => (await payload.findByID({ collection: "slots", id })).state;
    expect(await state(free.id)).toBe("Szabad");
    expect(await state(booked.id)).toBe("Foglalt");
    expect(await state(past.id)).toBe("Lejárt");
  });

  it("keeps internal fields and a booking's design out of the admin's bulk edit", () => {
    // "Edit many" skips fields that are unique, readOnly, disabled, top-level hidden or disableBulkEdit, but not admin.hidden.
    const field = (slug: "bookings" | "designs" | "slots", name: string) => {
      const found = payload.collections[slug].config.flattenedFields.find((f) => f.name === name);
      if (!found) throw new Error(`${slug}.${name} is not in the sanitized config`);
      return found;
    };

    expect(field("bookings", "seat").admin).toMatchObject({
      hidden: true,
      disableBulkEdit: true,
      disableListColumn: true,
      disableListFilter: true,
    });
    // A bulk edit saves its documents in parallel: bookings moved onto one design together would all pick the same seat.
    expect(field("bookings", "design").admin).toMatchObject({ disableBulkEdit: true });

    // Payload adds the zone picker beside startsAt; the override relabels it and keeps it out of lists and bulk edit.
    const timezone = field("slots", "startsAt_tz") as SelectField;
    expect(timezone.label).toBe("Időzóna");
    expect(timezone.required).toBeFalsy();
    expect(timezone.admin).toMatchObject({ disableListColumn: true, disableListFilter: true, disableBulkEdit: true });

    for (const slug of ["bookings", "designs", "slots"] as const) {
      expect(field(slug, "title").admin).toMatchObject({ hidden: true, disableBulkEdit: true });
    }
  });
});
```

- [ ] **Step 10: Futtatás**

```bash
npx vitest run tests/int/collections.test.ts
```

Expected: PASS (15 teszt). Ha a séma push-a a `bookings` összetett indexén bukik el (`indexes` → `design`, `seat`), az index építésénél a relationship mező oszlopa (`design_id`) nem oldódott fel. Ilyenkor az `indexes` sor helyett a `payload.config.ts` `sqliteAdapter` hívásában add hozzá ugyanezt az indexet az `afterSchemaInit` hookkal (`uniqueIndex("bookings_design_seat_idx").on(table.design, table.seat)`, a `@payloadcms/db-sqlite/drizzle/sqlite-core`-ból), majd futtasd újra.

- [ ] **Step 11: Lint, typecheck, teljes tesztkészlet**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: minden zöld.

- [ ] **Step 12: Commit**

```bash
git add cms payload.config.ts payload-types.ts tests
git commit -m "$(cat <<'EOF'
feat: collections, designs, slots and bookings in Payload

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

> **Az átnézés után (commit `bdcd7d1`):**
> - A `cms/collections/Media.ts` `hooks: { beforeDelete: [guardMediaDelete] }`-t kapott. Használatban lévő kép így nem törölhető, mert a Payload a fájlokat a sor törlése előtt törölné.
> - A `payload.config.ts` `loggingLevels` beállítása a `DeleteRefusedError`-t és a `BookingError`-t info szinten naplózza.
> - A fenti kódblokkok már a végleges változatot mutatják: minta-sorszám ütközés barátságos hibával, duplikálás tiltva, hozzáférés-tesztek, a `limit` törlése nem limitált szabálynál.


---

### Task 8: A foglalási szabályok hookja

**Files:**
- Create: `cms/booking/errors.ts`
- Create: `cms/booking/hooks.ts`
- Modify: `cms/collections/Bookings.ts`
- Test: `tests/int/bookings.test.ts`

- [ ] **Step 1: `cms/booking/errors.ts`**

```ts
import { type PayloadRequest, ValidationError } from "payload";

export type BookingErrorCode =
  | "design_unavailable"
  | "sold_out"
  | "slot_required"
  | "slot_past"
  | "slot_taken"
  | "reactivate"
  | "create_released";

export const BOOKING_MESSAGES: Record<BookingErrorCode, string> = {
  design_unavailable: "Ez a minta jelenleg nem foglalható.",
  sold_out: "Ez a minta már betelt.",
  slot_required: "Válassz időpontot.",
  slot_past: "Ez az időpont már elmúlt, válassz másikat.",
  slot_taken: "Ezt az időpontot közben lefoglalták, válassz másikat.",
  reactivate: "Elutasított vagy lemondott foglalás nem aktiválható újra – hozz létre új foglalást.",
  create_released: "Új foglalás csak Függőben, Jóváhagyva vagy Elkészült állapotban hozható létre.",
};

const FIELD = {
  design_unavailable: "design",
  sold_out: "design",
  slot_required: "slot",
  slot_past: "slot",
  slot_taken: "slot",
  reactivate: "status",
  create_released: "status",
} as const satisfies Record<BookingErrorCode, string>;

/** The Bookings field labels; the admin's error toast names the field with them. */
const FIELD_LABEL: Record<(typeof FIELD)[BookingErrorCode], string> = {
  design: "Minta",
  slot: "Időpont",
  status: "Állapot",
};

/** A booking rule failed. The admin shows the message under the field; the website maps the code. */
export class BookingError extends ValidationError {
  readonly code: BookingErrorCode;

  /** Pass `req.t`: without it Payload words the admin's toast in English. */
  constructor(code: BookingErrorCode, t?: PayloadRequest["t"]) {
    const path = FIELD[code];
    super({ collection: "bookings", errors: [{ label: FIELD_LABEL[path], message: BOOKING_MESSAGES[code], path }] }, t);
    this.code = code;
    this.name = "BookingError";
  }
}

export type PublicBookingCode = "design_unavailable" | "sold_out" | "slot_taken" | "slot_past" | "unknown";

/**
 * Turns a failed create into a booking error code. Besides our own rules, SQLite's unique indexes
 * reject the loser of a race: on the slot (`slot_id`) or on the design's seat (`design_id`).
 */
export function classifyBookingError(err: unknown): BookingErrorCode | "seat_conflict" | "unknown" {
  if (err instanceof BookingError) return err.code;
  const path = (err as { data?: { errors?: { path?: string }[] } } | null)?.data?.errors?.[0]?.path;
  if (path === "slot" || path === "slot_id") return "slot_taken";
  if (path === "design" || path === "design_id" || path === "seat") return "seat_conflict";
  return "unknown";
}
```

- [ ] **Step 2: A bukó teszt megírása: `tests/int/bookings.test.ts`**

```ts
import type { Payload } from "payload";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createBooking,
  createCategory,
  createDesign,
  createSlot,
  customer,
  getTestPayload,
  resetDatabase,
} from "../helpers";

let payload: Payload;

beforeAll(async () => {
  payload = await getTestPayload();
});

beforeEach(async () => {
  await resetDatabase(payload);
});

describe("booking rules", () => {
  it("books a single design once and frees it when the booking is rejected", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    const first = await createSlot(payload);
    const second = await createSlot(payload);

    const booking = await createBooking(payload, design.id, first.id);
    expect(booking.seat).toBe(1);
    await expect(createBooking(payload, design.id, second.id)).rejects.toMatchObject({ code: "sold_out" });

    const rejected = await payload.update({ collection: "bookings", id: booking.id, data: { status: "rejected" } });
    expect(rejected.slot).toBeNull();
    expect(rejected.seat).toBeNull();
    expect(rejected.slotStartsAt).toBe(first.startsAt);

    expect((await createBooking(payload, design.id, first.id)).seat).toBe(1);
  });

  it("explains a refusal in Hungarian, under the field it concerns", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    await createBooking(payload, design.id, (await createSlot(payload)).id);

    const refusal = await createBooking(payload, design.id, (await createSlot(payload)).id).catch((err: unknown) => err);
    expect(refusal).toMatchObject({
      name: "BookingError",
      code: "sold_out",
      data: { errors: [{ path: "design", message: "Ez a minta már betelt." }] },
    });
    // The admin form shows this one as a toast.
    expect((refusal as Error).message).toBe("A következő mező érvénytelen: Minta");
  });

  it("keeps the seat and the slot while the admin confirms and completes a booking on a full design", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    const slot = await createSlot(payload);
    const { id } = await createBooking(payload, design.id, slot.id);

    for (const status of ["confirmed", "completed"] as const) {
      const updated = await payload.update({ collection: "bookings", id, data: { status }, depth: 0 });
      expect(updated).toMatchObject({ status, seat: 1, slot: slot.id });
    }
    // The admin form sends the whole document back, unchanged fields included.
    const doc = await payload.findByID({ collection: "bookings", id, depth: 0 });
    const saved = await payload.update({ collection: "bookings", id, data: { ...doc, note: "x" }, depth: 0 });
    expect(saved).toMatchObject({ status: "completed", seat: 1, slot: slot.id, note: "x" });
  });

  it("books a limited design as many times as its collection allows", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "limited", 2)).id);
    const seats = [];
    for (let i = 0; i < 2; i += 1) seats.push((await createBooking(payload, design.id, (await createSlot(payload)).id)).seat);
    expect(seats).toEqual([1, 2]);
    await expect(createBooking(payload, design.id, (await createSlot(payload)).id)).rejects.toMatchObject({
      code: "sold_out",
    });
  });

  it("books an unlimited design any number of times", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "unlimited")).id);
    for (let i = 0; i < 3; i += 1) {
      const booking = await createBooking(payload, design.id, (await createSlot(payload)).id);
      expect(booking.seat).toBeNull();
    }
  });

  it("gives a slot to one booking only", async () => {
    const category = await createCategory(payload, "unlimited");
    const [a, b] = [await createDesign(payload, category.id), await createDesign(payload, category.id)];
    const slot = await createSlot(payload);
    await createBooking(payload, a.id, slot.id);
    await expect(createBooking(payload, b.id, slot.id)).rejects.toMatchObject({ code: "slot_taken" });
  });

  it.each(["rejected", "cancelled"] as const)("never brings a %s booking back", async (status) => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    const booking = await createBooking(payload, design.id, (await createSlot(payload)).id);
    await payload.update({ collection: "bookings", id: booking.id, data: { status } });

    await expect(
      payload.update({ collection: "bookings", id: booking.id, data: { status: "confirmed" } }),
    ).rejects.toMatchObject({ code: "reactivate" });
    // Switching between the two released statuses is fine.
    const other = status === "rejected" ? "cancelled" : "rejected";
    expect((await payload.update({ collection: "bookings", id: booking.id, data: { status: other } })).status).toBe(other);
  });

  it.each(["rejected", "cancelled"] as const)("does not create a booking that is already %s", async (status) => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    await expect(
      createBooking(payload, design.id, (await createSlot(payload)).id, { status }),
    ).rejects.toMatchObject({ code: "create_released" });
  });

  it("asks the admin for a slot", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    await expect(
      payload.create({ collection: "bookings", data: { ...customer, design: design.id, status: "pending" } }),
    ).rejects.toMatchObject({ code: "slot_required" });
  });

  it("refuses a design that doesn't exist", async () => {
    await expect(createBooking(payload, 999_999, (await createSlot(payload)).id)).rejects.toMatchObject({
      code: "design_unavailable",
    });
  });

  it("moves a booking only to a free slot", async () => {
    const category = await createCategory(payload, "unlimited");
    const [a, b] = [await createDesign(payload, category.id), await createDesign(payload, category.id)];
    const [s1, s2, s3] = [await createSlot(payload), await createSlot(payload), await createSlot(payload)];
    await createBooking(payload, a.id, s1.id);
    const moving = await createBooking(payload, b.id, s2.id);

    await expect(
      payload.update({ collection: "bookings", id: moving.id, data: { slot: s1.id } }),
    ).rejects.toMatchObject({ code: "slot_taken" });
    const moved = await payload.update({ collection: "bookings", id: moving.id, data: { slot: s3.id } });
    expect(moved.slotStartsAt).toBe(s3.startsAt);
  });

  it("checks the limit again when a booking moves to another design", async () => {
    const category = await createCategory(payload, "single");
    const [taken, other, free] = [
      await createDesign(payload, category.id),
      await createDesign(payload, category.id),
      await createDesign(payload, category.id),
    ];
    await createBooking(payload, taken.id, (await createSlot(payload)).id);
    const moving = await createBooking(payload, other.id, (await createSlot(payload)).id);

    await expect(
      payload.update({ collection: "bookings", id: moving.id, data: { design: taken.id } }),
    ).rejects.toMatchObject({ code: "sold_out" });
    const moved = await payload.update({ collection: "bookings", id: moving.id, data: { design: free.id } });
    expect(moved.designName).toBe(`${category.name} #${free.number}`);
    expect(moved.seat).toBe(1);
  });

  it("keeps a design sold out when its collection's limit is lowered under the active bookings", async () => {
    const category = await createCategory(payload, "limited", 3);
    const design = await createDesign(payload, category.id);
    const bookings = [];
    for (let i = 0; i < 3; i += 1) bookings.push(await createBooking(payload, design.id, (await createSlot(payload)).id));
    // Seats 2 and 3 stay active, so a free seat (1) exists below the new limit: only the count may refuse.
    await payload.update({ collection: "bookings", id: bookings[0].id, data: { status: "cancelled" } });
    await payload.update({ collection: "categories", id: category.id, data: { limit: 2 } });
    await expect(createBooking(payload, design.id, (await createSlot(payload)).id)).rejects.toMatchObject({
      code: "sold_out",
    });
  });

  it("counts the bookings made while the collection was unlimited", async () => {
    const category = await createCategory(payload, "unlimited");
    const design = await createDesign(payload, category.id);
    for (let i = 0; i < 2; i += 1) await createBooking(payload, design.id, (await createSlot(payload)).id);
    await payload.update({ collection: "categories", id: category.id, data: { rule: "limited", limit: 3 } });

    expect((await createBooking(payload, design.id, (await createSlot(payload)).id)).seat).toBe(1);
    await expect(createBooking(payload, design.id, (await createSlot(payload)).id)).rejects.toMatchObject({
      code: "sold_out",
    });
  });

  it("records the design, price and time at booking and names the booking", async () => {
    const category = await createCategory(payload, "single");
    const design = await createDesign(payload, category.id, { price: 110000 });
    const slot = await createSlot(payload);
    const booking = await createBooking(payload, design.id, slot.id);
    expect(booking).toMatchObject({
      designName: `${category.name} #${design.number}`,
      price: 110000,
      slotStartsAt: slot.startsAt,
      title: `Teszt Elek — ${category.name} #${design.number}`,
    });
  });

  it("lets the admin book a hidden design on a past slot", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id, { visible: false });
    const booking = await createBooking(payload, design.id, (await createSlot(payload, { past: true })).id, {
      status: "completed",
    });
    expect(booking.status).toBe("completed");
  });
});
```

- [ ] **Step 3: Futtasd, és nézd meg, hogy elbukik**

```bash
npx vitest run tests/int/bookings.test.ts
```

Expected: FAIL. Az első teszt `booking.seat` értéke `undefined`/`null` lesz `1` helyett, mert a hook még nincs bekötve.

- [ ] **Step 4: `cms/booking/hooks.ts`**

```ts
import type { CollectionBeforeChangeHook, PayloadRequest, Where } from "payload";
import {
  ACTIVE_STATUSES,
  effectiveLimit,
  isActiveStatus,
  isReleasedStatus,
  nextSeat,
  relationId,
} from "@/lib/booking-rules";
import type { Booking } from "@/payload-types";
import { BookingError } from "./errors";

type Draft = Partial<Booking>;
type Scope = { data: Draft; isPublic: boolean; excludeId?: number; req: PayloadRequest };

/**
 * Applies the booking rules on every save, from the website and from the admin alike: an active
 * booking holds a free slot and one of its design's seats, and gives both back when it is rejected
 * or cancelled. The unique indexes on `slot` and `design + seat` settle simultaneous requests.
 */
export const prepareBooking: CollectionBeforeChangeHook<Booking> = async ({
  data,
  originalDoc,
  operation,
  req,
  context,
}) => {
  const isPublic = context.publicBooking === true;
  const previous = operation === "update" ? originalDoc : undefined;
  if (isPublic && operation === "create") data.status = "pending";
  const status = data.status ?? previous?.status ?? "pending";

  if (!previous && isReleasedStatus(status)) throw new BookingError("create_released", req.t);
  if (previous && isReleasedStatus(previous.status) && isActiveStatus(status)) {
    throw new BookingError("reactivate", req.t);
  }

  if (isReleasedStatus(status)) {
    data.slot = null;
    data.seat = null;
  } else {
    const designId = relationId(data.design ?? previous?.design);
    if (designId === null) throw new BookingError("design_unavailable", req.t);
    if (!previous || relationId(previous.design) !== designId) {
      await takeSeat(designId, { data, isPublic, excludeId: previous?.id, req });
    }

    const slotId = relationId(data.slot === undefined ? previous?.slot : data.slot);
    if (slotId === null) throw new BookingError("slot_required", req.t);
    if (!previous || relationId(previous.slot) !== slotId) {
      await takeSlot(slotId, { data, isPublic, excludeId: previous?.id, req });
    }
  }

  const name = (data.name ?? previous?.name ?? "").trim();
  data.title = `${name} — ${data.designName ?? previous?.designName ?? ""}`;
  return data;
};

async function takeSeat(designId: number, { data, isPublic, excludeId, req }: Scope) {
  const design = await req.payload.findByID({
    collection: "designs",
    id: designId,
    select: { category: true, number: true, price: true, visible: true },
    depth: 1,
    disableErrors: true,
    overrideAccess: true,
    req,
  });
  if (!design || (isPublic && !design.visible)) throw new BookingError("design_unavailable", req.t);
  const category =
    typeof design.category === "object"
      ? design.category
      : await req.payload.findByID({ collection: "categories", id: design.category, overrideAccess: true, req });

  const limit = effectiveLimit(category);
  if (limit === null) {
    data.seat = null;
  } else {
    // One read gives both the count and the free seat, so two requests that see the same state
    // pick the same seat and the unique index turns one of them away (see nextSeat).
    const conditions: Where[] = [{ design: { equals: designId } }, { status: { in: [...ACTIVE_STATUSES] } }];
    // The booking never counts against itself, so a save that runs twice (a double submit) keeps its seat.
    if (excludeId) conditions.push({ id: { not_equals: excludeId } });
    const active = await req.payload.find({
      collection: "bookings",
      where: { and: conditions },
      select: { seat: true },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      req,
    });
    const seat = nextSeat(active.docs.map((b) => b.seat), limit);
    if (seat === null) throw new BookingError("sold_out", req.t);
    data.seat = seat;
  }
  data.designName = `${category.name} #${design.number}`;
  data.price = design.price;
}

async function takeSlot(slotId: number, { data, isPublic, excludeId, req }: Scope) {
  const slot = await req.payload.findByID({
    collection: "slots",
    id: slotId,
    select: { startsAt: true },
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
  });
  if (!slot) throw new BookingError("slot_taken", req.t);
  if (isPublic && new Date(slot.startsAt).getTime() <= Date.now()) throw new BookingError("slot_past", req.t);

  const conditions: Where[] = [{ slot: { equals: slotId } }];
  // Likewise, a save that runs twice doesn't find its own slot taken.
  if (excludeId) conditions.push({ id: { not_equals: excludeId } });
  const { totalDocs } = await req.payload.count({
    collection: "bookings",
    where: { and: conditions },
    overrideAccess: true,
    req,
  });
  if (totalDocs > 0) throw new BookingError("slot_taken", req.t);
  data.slotStartsAt = slot.startsAt;
}
```

- [ ] **Step 5: A hook bekötése a `cms/collections/Bookings.ts`-be**

Importok közé:

```ts
import { prepareBooking } from "../booking/hooks";
```

Az `indexes` sor után:

```ts
  hooks: { beforeChange: [prepareBooking] },
```

- [ ] **Step 6: Futtasd, most át kell mennie**

```bash
npx vitest run tests/int/bookings.test.ts
```

Expected: PASS (18 teszt).

- [ ] **Step 7: Lint, typecheck, teljes tesztkészlet**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: minden zöld (a Task 7 tesztjei is, mert a `createBooking` admin úton továbbra is működik).

- [ ] **Step 8: Commit**

```bash
git add cms tests
git commit -m "$(cat <<'EOF'
feat: enforce booking limits, slot exclusivity and release on reject/cancel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Webes foglalás és egyidejű kérések

**Files:**
- Create: `cms/booking/public.ts`
- Test: `tests/unit/booking-errors.test.ts`
- Test: `tests/int/public-booking.test.ts`
- Test: `tests/unit/public-booking-retry.test.ts`

- [ ] **Step 1: A bukó tesztek megírása**

`tests/unit/booking-errors.test.ts`:

```ts
import { ValidationError } from "payload";
import { describe, expect, it } from "vitest";
import { BookingError, classifyBookingError } from "@/cms/booking/errors";

const uniqueViolation = (path: string) =>
  new ValidationError({ collection: "bookings", errors: [{ message: "Value must be unique", path }] });

describe("classifyBookingError", () => {
  it("passes our own rule codes through", () => {
    expect(classifyBookingError(new BookingError("sold_out"))).toBe("sold_out");
  });

  it("reads a lost race on the slot as a taken slot", () => {
    expect(classifyBookingError(uniqueViolation("slot_id"))).toBe("slot_taken");
    expect(classifyBookingError(uniqueViolation("slot"))).toBe("slot_taken");
  });

  it("reads a lost race on the design's seat as a seat conflict", () => {
    expect(classifyBookingError(uniqueViolation("design_id"))).toBe("seat_conflict");
  });

  it("leaves anything else unknown", () => {
    expect(classifyBookingError(new Error("disk full"))).toBe("unknown");
    expect(classifyBookingError(null)).toBe("unknown");
  });
});
```

`tests/int/public-booking.test.ts`:

```ts
import type { Payload } from "payload";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPublicBooking } from "@/cms/booking/public";
import {
  createCategory,
  createDesign,
  createSlot,
  customer,
  getTestPayload,
  publicInput,
  resetDatabase,
} from "../helpers";

let payload: Payload;

beforeAll(async () => {
  payload = await getTestPayload();
});

beforeEach(async () => {
  await resetDatabase(payload);
});

describe("website bookings", () => {
  it("always start as pending", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    const booking = await payload.create({
      collection: "bookings",
      data: { ...customer, design: design.id, slot: (await createSlot(payload)).id, status: "confirmed" },
      context: { publicBooking: true },
    });
    expect(booking.status).toBe("pending");
  });

  it("refuse past slots and hidden designs", async () => {
    const category = await createCategory(payload, "unlimited");
    const design = await createDesign(payload, category.id);
    const hidden = await createDesign(payload, category.id, { visible: false });

    expect(await createPublicBooking(payload, publicInput(design.id, (await createSlot(payload, { past: true })).id))).toEqual({
      ok: false,
      code: "slot_past",
    });
    expect(await createPublicBooking(payload, publicInput(hidden.id, (await createSlot(payload)).id))).toEqual({
      ok: false,
      code: "design_unavailable",
    });
  });

  it("report a slot that no longer exists as taken", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "unlimited")).id);
    expect(await createPublicBooking(payload, publicInput(design.id, 999_999))).toEqual({ ok: false, code: "slot_taken" });
  });

  it("let exactly one of two simultaneous requests take the last booking of a design", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    const [s1, s2] = [await createSlot(payload), await createSlot(payload)];

    const results = await Promise.all([
      createPublicBooking(payload, publicInput(design.id, s1.id)),
      createPublicBooking(payload, publicInput(design.id, s2.id)),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, code: "sold_out" });
    expect((await payload.count({ collection: "bookings" })).totalDocs).toBe(1);
  });

  it("let two simultaneous requests share a design with two bookings left", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "limited", 2)).id);
    const [s1, s2] = [await createSlot(payload), await createSlot(payload)];

    const results = await Promise.all([
      createPublicBooking(payload, publicInput(design.id, s1.id)),
      createPublicBooking(payload, publicInput(design.id, s2.id)),
    ]);

    expect(results.every((r) => r.ok)).toBe(true);
    const booked = await payload.find({ collection: "bookings", where: { design: { equals: design.id } }, pagination: false });
    expect(booked.docs.map((b) => b.seat ?? 0).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("give every seat to a crowd that asks at once, and tell the rest it sold out", async () => {
    // More requests than MAX_ATTEMPTS: if the losers retried in lockstep, the last ones would run out of attempts.
    const design = await createDesign(payload, (await createCategory(payload, "limited", 12)).id);
    const slots = [];
    for (let i = 0; i < 14; i += 1) slots.push(await createSlot(payload));

    const results = await Promise.all(slots.map((s) => createPublicBooking(payload, publicInput(design.id, s.id))));

    expect(results.filter((r) => r.ok)).toHaveLength(12);
    expect(results.filter((r) => !r.ok)).toEqual(Array(2).fill({ ok: false, code: "sold_out" }));
    const booked = await payload.find({ collection: "bookings", where: { design: { equals: design.id } }, pagination: false });
    expect(booked.docs.map((b) => b.seat ?? 0).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("let exactly one of two simultaneous requests take a slot", async () => {
    const category = await createCategory(payload, "unlimited");
    const [a, b] = [await createDesign(payload, category.id), await createDesign(payload, category.id)];
    const slot = await createSlot(payload);

    const results = await Promise.all([
      createPublicBooking(payload, publicInput(a.id, slot.id)),
      createPublicBooking(payload, publicInput(b.id, slot.id)),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, code: "slot_taken" });
  });
});
```

`tests/unit/public-booking-retry.test.ts` (adatbázis nélkül, a `payload.create` helyett csonkkal; az újrapróbálást a meghajtó ütemezésétől függetlenül rögzíti):

```ts
import { type Payload, ValidationError } from "payload";
import { describe, expect, it, vi } from "vitest";
import { BookingError } from "@/cms/booking/errors";
import { MAX_ATTEMPTS, createPublicBooking } from "@/cms/booking/public";
import type { BookingInput } from "@/lib/booking-input";

const input: BookingInput = {
  designId: 12,
  slotId: 4,
  name: "Teszt Elek",
  email: "teszt.elek@example.com",
  phone: "+36 30 123 4567",
  placement: "alkar",
  note: "",
  website: "",
};

/** What Payload throws when a unique index turns the insert away (drizzle's handleUpsertError). */
const uniqueViolation = (path: string) =>
  new ValidationError({ collection: "bookings", errors: [{ message: "Value must be unique", path }] });
const seatConflict = () => uniqueViolation("design_id");

/** A stand-in for Payload whose create fails or succeeds in the given order. */
function fakePayload(...outcomes: unknown[]) {
  const create = vi.fn();
  for (const outcome of outcomes) {
    if (outcome instanceof Error) create.mockRejectedValueOnce(outcome);
    else create.mockResolvedValueOnce(outcome);
  }
  const error = vi.fn();
  return { payload: { create, logger: { error } } as unknown as Payload, create, error };
}

// The int tests reach the retry only through how libsql interleaves Promise.all; these pin it without a database.
describe("createPublicBooking", () => {
  it("tries again after losing a seat race and books the next seat", async () => {
    const { payload, create, error } = fakePayload(seatConflict(), { id: 7 });
    expect(await createPublicBooking(payload, input)).toEqual({ ok: true, bookingId: 7 });
    expect(create).toHaveBeenCalledTimes(2);
    expect(error).not.toHaveBeenCalled();
  });

  it("reports sold out when the retry finds no seat left", async () => {
    const { payload, create } = fakePayload(seatConflict(), new BookingError("sold_out"));
    expect(await createPublicBooking(payload, input)).toEqual({ ok: false, code: "sold_out" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("keeps trying while other bookings keep taking the seat it picked", async () => {
    const lost = Array.from({ length: MAX_ATTEMPTS - 1 }, seatConflict);
    const { payload, create } = fakePayload(...lost, { id: 9 });
    expect(await createPublicBooking(payload, input)).toEqual({ ok: true, bookingId: 9 });
    expect(create).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("gives up and logs after MAX_ATTEMPTS, so a seat that never frees up can't loop forever", async () => {
    const { payload, create, error } = fakePayload();
    create.mockRejectedValue(seatConflict());
    expect(await createPublicBooking(payload, input)).toEqual({ ok: false, code: "unknown" });
    expect(create).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("lets waiting work run before it retries, so the losers of one race don't retry in lockstep", async () => {
    let waitingWorkRan = false;
    let ranBeforeRetry: boolean | undefined;
    const { payload, create } = fakePayload();
    create
      .mockImplementationOnce(async () => {
        // Another request's continuation, queued on the event loop while this attempt runs.
        setTimeout(() => (waitingWorkRan = true), 0);
        throw seatConflict();
      })
      .mockImplementationOnce(async () => {
        ranBeforeRetry = waitingWorkRan;
        return { id: 7 };
      });
    expect(await createPublicBooking(payload, input)).toEqual({ ok: true, bookingId: 7 });
    expect(ranBeforeRetry).toBe(true);
  });

  it.each([
    ["a slot someone else just took", uniqueViolation("slot_id"), "slot_taken"],
    ["a sold-out design", new BookingError("sold_out"), "sold_out"],
    ["a hidden design", new BookingError("design_unavailable"), "design_unavailable"],
    ["a past slot", new BookingError("slot_past"), "slot_past"],
  ])("answers %s at once, without retrying", async (_what, err, code) => {
    const { payload, create, error } = fakePayload(err);
    expect(await createPublicBooking(payload, input)).toEqual({ ok: false, code });
    expect(create).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it("logs an unexpected failure and does not retry it", async () => {
    const { payload, create, error } = fakePayload(new Error("SQLITE_IOERR"));
    expect(await createPublicBooking(payload, input)).toEqual({ ok: false, code: "unknown" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("sends every attempt as a pending website booking", async () => {
    const { payload, create } = fakePayload(seatConflict(), { id: 7 });
    await createPublicBooking(payload, input);
    for (const [args] of create.mock.calls) {
      expect(args).toMatchObject({
        collection: "bookings",
        context: { publicBooking: true },
        overrideAccess: true,
        data: { design: 12, slot: 4, status: "pending", note: null, adultConfirmed: true },
      });
    }
  });
});
```

- [ ] **Step 2: Futtasd, és nézd meg, hogy elbukik**

```bash
npx vitest run tests/unit/booking-errors.test.ts tests/unit/public-booking-retry.test.ts tests/int/public-booking.test.ts
```

Expected: az `errors` teszt PASS (a Task 8-ban már elkészült), a `public-booking` és a `public-booking-retry` FAIL: `Cannot find package '@/cms/booking/public'` (a modul még nem létezik).

- [ ] **Step 3: `cms/booking/public.ts`**

```ts
import type { Payload } from "payload";
import type { BookingInput } from "@/lib/booking-input";
import { type PublicBookingCode, classifyBookingError } from "./errors";

export type PublicBookingResult = { ok: true; bookingId: number } | { ok: false; code: PublicBookingCode };

const PUBLIC_CODES = ["design_unavailable", "sold_out", "slot_taken", "slot_past"] as const satisfies readonly PublicBookingCode[];
const isPublicCode = (code: string): code is (typeof PUBLIC_CODES)[number] =>
  (PUBLIC_CODES as readonly string[]).includes(code);

/**
 * Each lost seat race means another booking for the design just went through, so the next attempt sees it
 * and takes the next seat or finds the design sold out. The cap only stops a booking that can't make progress,
 * e.g. a seat held by a row the hook doesn't count as active.
 */
export const MAX_ATTEMPTS = 10;

/**
 * Waits a few random milliseconds before a retry. Yielding to the event loop is what keeps the losers of one race
 * from picking the same seat again together; the randomness spreads them out when queries really run async.
 */
const pause = (attempt: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.random() * 5 * attempt));

/**
 * Creates a booking from the website form. Simultaneous requests for one design all pick its lowest
 * free seat and the unique index lets one through; the others pause a few random milliseconds and try
 * again, so they take the next free seat or learn the design sold out. A request that loses
 * MAX_ATTEMPTS seat races in a row gives up with "unknown", and the failure is logged.
 */
export async function createPublicBooking(payload: Payload, input: BookingInput): Promise<PublicBookingResult> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const booking = await payload.create({
        collection: "bookings",
        data: {
          design: input.designId,
          slot: input.slotId,
          status: "pending",
          name: input.name,
          email: input.email,
          phone: input.phone,
          placement: input.placement,
          note: input.note || null,
          adultConfirmed: true,
        },
        context: { publicBooking: true },
        overrideAccess: true,
      });
      return { ok: true, bookingId: booking.id };
    } catch (err) {
      const code = classifyBookingError(err);
      if (code === "seat_conflict" && attempt < MAX_ATTEMPTS) {
        await pause(attempt);
        continue;
      }
      if (isPublicCode(code)) return { ok: false, code };
      payload.logger.error({ err, attempts: attempt, msg: "Website booking failed" });
      return { ok: false, code: "unknown" };
    }
  }
}
```

- [ ] **Step 4: Futtasd, most át kell mennie**

```bash
npx vitest run tests/unit/booking-errors.test.ts tests/unit/public-booking-retry.test.ts tests/int/public-booking.test.ts
```

Expected: PASS (22 teszt). Ha a két egyidejűségi teszt valamelyike `unknown` kódot ad, nézd meg a naplóban az `err` tartalmát. Ha a `data.errors[0].path` más (pl. `bookings_design_seat_idx`), vedd fel a `classifyBookingError` megfelelő ágába, és bővítsd vele a `booking-errors` egységtesztet.

- [ ] **Step 5: Commit**

```bash
git add cms/booking/public.ts tests/unit/booking-errors.test.ts tests/unit/public-booking-retry.test.ts tests/int/public-booking.test.ts
git commit -m "$(cat <<'EOF'
feat: website bookings that retry a lost seat race

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: E-mail értesítések

**Files:**
- Create: `lib/format.ts`
- Create: `cms/emails/templates.ts`
- Create: `cms/emails/send.ts`
- Modify: `cms/collections/Bookings.ts`
- Test: `tests/unit/email-templates.test.ts`
- Test: `tests/int/emails.test.ts`

- [ ] **Step 1: `lib/format.ts`**

```ts
// Deterministic on server and client, so no hydration mismatch from Intl.
export function formatPrice(n: number) {
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;
}
```

- [ ] **Step 2: A bukó tesztek megírása**

`tests/unit/email-templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  type BookingEmailData,
  adminNewBookingEmail,
  bookingEmailsFor,
  customerReceivedEmail,
  customerRejectedEmail,
  escapeHtml,
} from "@/cms/emails/templates";

const data: BookingEmailData = {
  name: "Kovács Anna",
  email: "anna@example.com",
  phone: "+36 30 123 4567",
  placement: "Alkar",
  note: "<script>alert(1)</script>",
  designName: "P’CONs #027",
  slotStartsAt: "2026-10-14T08:00:00.000Z",
  price: 90000,
  adminUrl: "https://pannipix.test/admin/collections/bookings/5",
  siteUrl: "https://pannipix.test",
};

describe("templates", () => {
  it("escapes HTML", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });

  it("confirms receipt with the design, Budapest time and price", () => {
    const email = customerReceivedEmail(data);
    expect(email.subject).toBe("Megkaptam a foglalásod – P’CONs #027");
    expect(email.text).toContain("Szia Kovács Anna!");
    expect(email.text).toContain("Időpont: 2026. október 14., szerda 10:00");
    expect(email.text).toContain("Ár: 90 000 Ft");
    expect(email.text).toContain("most nem fizetsz semmit");
  });

  it("gives the admin the customer's details with a link, and never raw HTML from the form", () => {
    const email = adminNewBookingEmail(data);
    expect(email.subject).toBe("Új foglalás: P’CONs #027 – 2026. október 14., szerda 10:00");
    expect(email.text).toContain("Telefon: +36 30 123 4567");
    expect(email.text).toContain("https://pannipix.test/admin/collections/bookings/5");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("links a rejected customer back to the designs", () => {
    expect(customerRejectedEmail(data).text).toContain("https://pannipix.test/#flash");
  });
});

describe("bookingEmailsFor", () => {
  it("tells the admin and the customer about a website booking", () => {
    expect(bookingEmailsFor({ operation: "create", isPublic: true, status: "pending" })).toEqual([
      "admin-new",
      "customer-received",
    ]);
  });

  it("does not tell the admin about a booking the admin made", () => {
    expect(bookingEmailsFor({ operation: "create", isPublic: false, status: "pending" })).toEqual(["customer-received"]);
    expect(bookingEmailsFor({ operation: "create", isPublic: false, status: "confirmed" })).toEqual(["customer-confirmed"]);
    expect(bookingEmailsFor({ operation: "create", isPublic: false, status: "completed" })).toEqual([]);
  });

  it("writes to the customer when the status changes to confirmed, rejected or cancelled", () => {
    const change = (status: string, previousStatus = "pending") =>
      bookingEmailsFor({ operation: "update", isPublic: false, status, previousStatus });
    expect(change("confirmed")).toEqual(["customer-confirmed"]);
    expect(change("rejected")).toEqual(["customer-rejected"]);
    expect(change("cancelled", "confirmed")).toEqual(["customer-cancelled"]);
    expect(change("completed", "confirmed")).toEqual([]);
    expect(change("confirmed", "confirmed")).toEqual([]);
  });
});
```

`tests/int/emails.test.ts`:

```ts
import type { Payload } from "payload";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicBooking } from "@/cms/booking/public";
import {
  createBooking,
  createCategory,
  createDesign,
  createSlot,
  getTestPayload,
  publicInput,
  resetDatabase,
} from "../helpers";

let payload: Payload;
let sent: { to: string; subject: string }[];

beforeAll(async () => {
  payload = await getTestPayload();
});

beforeEach(async () => {
  await resetDatabase(payload);
  sent = [];
  vi.spyOn(payload, "sendEmail").mockImplementation(async (message) => {
    sent.push({ to: String(message.to), subject: String(message.subject) });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function design() {
  return createDesign(payload, (await createCategory(payload, "unlimited")).id);
}

describe("booking emails", () => {
  it("tell the admin and the customer about a website booking", async () => {
    const d = await design();
    await createPublicBooking(payload, publicInput(d.id, (await createSlot(payload)).id));
    expect(sent.map((m) => m.to)).toEqual(["admin@example.com", "teszt.elek@example.com"]);
    expect(sent[0].subject).toMatch(/^Új foglalás: /);
    expect(sent[1].subject).toMatch(/^Megkaptam a foglalásod/);
  });

  it("follow the status: confirmed, then cancelled", async () => {
    const booking = await createBooking(payload, (await design()).id, (await createSlot(payload)).id);
    sent = [];
    await payload.update({ collection: "bookings", id: booking.id, data: { status: "confirmed" } });
    await payload.update({ collection: "bookings", id: booking.id, data: { status: "cancelled" } });
    expect(sent.map((m) => m.subject.split(":")[0])).toEqual(["Visszaigazolva", "Lemondva"]);
  });

  it("stay quiet when a booking is completed", async () => {
    const booking = await createBooking(payload, (await design()).id, (await createSlot(payload)).id);
    sent = [];
    await payload.update({ collection: "bookings", id: booking.id, data: { status: "completed" } });
    expect(sent).toEqual([]);
  });

  it("never stop a booking when sending fails", async () => {
    vi.spyOn(payload, "sendEmail").mockRejectedValue(new Error("SMTP down"));
    const d = await design();
    const result = await createPublicBooking(payload, publicInput(d.id, (await createSlot(payload)).id));
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Futtasd, és nézd meg, hogy elbukik**

```bash
npx vitest run tests/unit/email-templates.test.ts tests/int/emails.test.ts
```

Expected: FAIL, `Cannot find package '@/cms/emails/templates'` (a modul még nem létezik).

- [ ] **Step 4: `cms/emails/templates.ts`**

```ts
import { formatPrice } from "@/lib/format";
import { formatSlotFull } from "@/lib/time";

export type BookingEmailData = {
  name: string;
  email: string;
  phone: string;
  /** Hungarian label, e.g. "Lábszár". */
  placement: string;
  note?: string | null;
  designName: string;
  slotStartsAt?: string | null;
  price?: number | null;
  adminUrl: string;
  siteUrl: string;
};

export type EmailContent = { subject: string; html: string; text: string };

type Block = { p: string } | { rows: [string, string][] } | { link: [string, string] };

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

const when = (d: BookingEmailData) => (d.slotStartsAt ? formatSlotFull(d.slotStartsAt) : "–");
const price = (d: BookingEmailData) => (typeof d.price === "number" ? formatPrice(d.price) : "–");

function render(subject: string, blocks: Block[]): EmailContent {
  const text = blocks
    .map((b) => {
      if ("p" in b) return b.p;
      if ("rows" in b) return b.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
      return `${b.link[0]}: ${b.link[1]}`;
    })
    .join("\n\n");

  const body = blocks
    .map((b) => {
      if ("p" in b) return `<p style="margin:0 0 16px">${escapeHtml(b.p)}</p>`;
      if ("rows" in b) {
        const rows = b.rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 16px 4px 0;color:#6e6d66;font-size:12px;letter-spacing:.16em;text-transform:uppercase;vertical-align:top">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`,
          )
          .join("");
        return `<table role="presentation" style="margin:0 0 20px;border-collapse:collapse">${rows}</table>`;
      }
      return `<p style="margin:0 0 16px"><a href="${escapeHtml(b.link[1])}" style="color:#121211">${escapeHtml(b.link[0])}</a></p>`;
    })
    .join("");

  const html = `<!doctype html><html lang="hu"><body style="margin:0;background:#f7f7f5;color:#121211;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6"><div style="max-width:560px;margin:0 auto;padding:32px 24px"><p style="margin:0 0 28px;font-size:13px;letter-spacing:.3em">PANNIPIX</p>${body}</div></body></html>`;
  return { subject, html, text };
}

const details = (d: BookingEmailData): Block => ({
  rows: [
    ["Minta", d.designName],
    ["Időpont", when(d)],
    ["Ár", price(d)],
  ],
});
const greeting = (d: BookingEmailData): Block => ({ p: `Szia ${d.name}!` });
const signature: Block = { p: "PANNIPIX" };
const designsLink = (d: BookingEmailData): Block => ({ link: ["Flash minták és szabad időpontok", `${d.siteUrl}/#flash`] });

export function customerReceivedEmail(d: BookingEmailData): EmailContent {
  return render(`Megkaptam a foglalásod – ${d.designName}`, [
    greeting(d),
    { p: "Megkaptam a foglalásodat. Hamarosan átnézem, és e-mailben visszaigazolom." },
    details(d),
    {
      p: "A foglalás nem vásárlás: most nem fizetsz semmit, a részleteket a visszaigazolásban egyeztetjük. Ha kérdésed van, válaszolj erre a levélre.",
    },
    signature,
  ]);
}

export function customerConfirmedEmail(d: BookingEmailData): EmailContent {
  return render(`Visszaigazolva: ${d.designName}, ${when(d)}`, [
    greeting(d),
    { p: "Visszaigazolom a foglalásodat, várlak!" },
    details(d),
    { p: "Ha mégsem tudsz jönni, kérlek, minél előbb válaszolj erre a levélre." },
    signature,
  ]);
}

export function customerRejectedEmail(d: BookingEmailData): EmailContent {
  return render(`A foglalásod nem jött létre – ${d.designName}`, [
    greeting(d),
    { p: `Sajnos a ${when(d)} időpontra szóló foglalásodat nem tudom vállalni.` },
    { p: "Ha másik időpont vagy minta is jó, itt találod a szabadokat:" },
    designsLink(d),
    signature,
  ]);
}

export function customerCancelledEmail(d: BookingEmailData): EmailContent {
  return render(`Lemondva: ${d.designName}, ${when(d)}`, [
    greeting(d),
    { p: `A ${when(d)} időpontra szóló foglalásod le lett mondva.` },
    { p: "Ha új időpontot szeretnél, itt foglalhatsz:" },
    designsLink(d),
    signature,
  ]);
}

export function adminNewBookingEmail(d: BookingEmailData): EmailContent {
  const rows: [string, string][] = [
    ["Minta", d.designName],
    ["Időpont", when(d)],
    ["Ár", price(d)],
    ["Név", d.name],
    ["E-mail", d.email],
    ["Telefon", d.phone],
    ["Testtáj", d.placement],
  ];
  if (d.note) rows.push(["Megjegyzés", d.note]);
  return render(`Új foglalás: ${d.designName} – ${when(d)}`, [
    { p: "Új foglalás érkezett az oldalról, jóváhagyásra vár." },
    { rows },
    { link: ["Megnyitás az adminban", d.adminUrl] },
  ]);
}

export type BookingEmailKind =
  | "admin-new"
  | "customer-received"
  | "customer-confirmed"
  | "customer-rejected"
  | "customer-cancelled";

/** Which emails a booking change sends. Completing a booking or moving it to another slot sends none. */
export function bookingEmailsFor({
  operation,
  isPublic,
  status,
  previousStatus,
}: {
  operation: "create" | "update";
  isPublic: boolean;
  status: string;
  previousStatus?: string | null;
}): BookingEmailKind[] {
  if (operation === "create") {
    const kinds: BookingEmailKind[] = isPublic ? ["admin-new"] : [];
    if (status === "pending") kinds.push("customer-received");
    if (status === "confirmed") kinds.push("customer-confirmed");
    return kinds;
  }
  if (status === previousStatus) return [];
  if (status === "confirmed") return ["customer-confirmed"];
  if (status === "rejected") return ["customer-rejected"];
  if (status === "cancelled") return ["customer-cancelled"];
  return [];
}
```

- [ ] **Step 5: `cms/emails/send.ts`**

```ts
import type { CollectionAfterChangeHook } from "payload";
import { placementLabel } from "@/lib/booking-input";
import type { Booking } from "@/payload-types";
import {
  type BookingEmailData,
  type BookingEmailKind,
  type EmailContent,
  adminNewBookingEmail,
  bookingEmailsFor,
  customerCancelledEmail,
  customerConfirmedEmail,
  customerReceivedEmail,
  customerRejectedEmail,
} from "./templates";

const builders: Record<BookingEmailKind, (d: BookingEmailData) => EmailContent> = {
  "admin-new": adminNewBookingEmail,
  "customer-received": customerReceivedEmail,
  "customer-confirmed": customerConfirmedEmail,
  "customer-rejected": customerRejectedEmail,
  "customer-cancelled": customerCancelledEmail,
};

/**
 * Starts the booking's emails without waiting for them: a slow mail server must not hold up the
 * visitor or the admin. A failed send is logged and never undoes the booking.
 */
export const sendBookingEmails: CollectionAfterChangeHook<Booking> = async ({
  doc,
  previousDoc,
  operation,
  req,
  context,
}) => {
  const kinds = bookingEmailsFor({
    operation,
    isPublic: context.publicBooking === true,
    status: doc.status,
    previousStatus: previousDoc?.status,
  });
  if (kinds.length === 0) return doc;

  const siteUrl = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const adminEmail = process.env.ADMIN_EMAIL;
  const data: BookingEmailData = {
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    placement: placementLabel(doc.placement),
    note: doc.note,
    designName: doc.designName ?? "",
    slotStartsAt: doc.slotStartsAt,
    price: doc.price,
    adminUrl: `${siteUrl}/admin/collections/bookings/${doc.id}`,
    siteUrl,
  };

  for (const kind of kinds) {
    const toAdmin = kind === "admin-new";
    if (toAdmin && !adminEmail) continue;
    const { subject, html, text } = builders[kind](data);
    req.payload
      .sendEmail({
        to: toAdmin ? adminEmail : doc.email,
        replyTo: toAdmin ? doc.email : adminEmail,
        subject,
        html,
        text,
      })
      .catch((err: unknown) => {
        req.payload.logger.error({ err, msg: `Booking email "${kind}" for booking ${doc.id} failed` });
      });
  }
  return doc;
};
```

- [ ] **Step 6: Bekötés a `cms/collections/Bookings.ts`-be**

Importok közé:

```ts
import { sendBookingEmails } from "../emails/send";
```

A `hooks` sort cseréld erre:

```ts
  hooks: { beforeChange: [prepareBooking], afterChange: [sendBookingEmails] },
```

- [ ] **Step 7: Futtasd, most át kell mennie**

```bash
npx vitest run tests/unit/email-templates.test.ts tests/int/emails.test.ts
```

Expected: PASS (11 teszt).

- [ ] **Step 8: Lint, typecheck, teljes tesztkészlet**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: minden zöld.

- [ ] **Step 9: Commit**

```bash
git add lib/format.ts cms tests
git commit -m "$(cat <<'EOF'
feat: booking emails for the admin and the customer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Szerveroldali adatréteg és server actionök

**Files:**
- Create: `lib/flash-types.ts`
- Create: `lib/flash.ts`
- Create: `lib/client-address.ts`
- Create: `app/(frontend)/actions.ts`
- Modify: `.env.example`
- Test: `tests/int/flash-data.test.ts`
- Test: `tests/unit/client-address.test.ts`
- Test: `tests/unit/book-flash.test.ts`

- [ ] **Step 1: `lib/flash-types.ts`: a frontend által használt alakok**

Csak típusok vannak benne, így a kliens komponensek is importálhatják (a Task 12 a `components/data.ts`-ből exportálja tovább őket).

```ts
import type { Availability, BookingRule } from "./booking-rules";

export type DesignImage = {
  src: string;
  alt: string;
  /** "art" sits on the stencil panel and multiplies onto it; "photo" is framed like a print */
  kind: "art" | "photo";
  label: string;
};

export type FlashCategory = { id: number; name: string; rule: BookingRule };

export type FlashDesign = {
  id: number;
  /** Printed after the collection name: "027" in "P’CONs #027". */
  number: string;
  collection: string;
  price: number;
  size: string;
  placements: string;
  description: string;
  badge?: "Új" | "Utolsó";
  createdAt: string;
  images: DesignImage[];
  availability: Availability;
};
```

- [ ] **Step 2: A bukó teszt megírása: `tests/int/flash-data.test.ts`**

```ts
import type { Payload } from "payload";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getFlashCatalog, listOpenSlots } from "@/lib/flash";
import {
  createBooking,
  createCategory,
  createDesign,
  createSlot,
  getTestPayload,
  resetDatabase,
} from "../helpers";

let payload: Payload;

beforeAll(async () => {
  payload = await getTestPayload();
});

beforeEach(async () => {
  await resetDatabase(payload);
});

describe("getFlashCatalog", () => {
  it("lists visible designs, newest first, with live availability", async () => {
    const single = await createCategory(payload, "single");
    const limited = await createCategory(payload, "limited", 3);
    const booked = await createDesign(payload, single.id);
    // createdAt has millisecond precision; keep the two designs apart so "newest first" is well defined.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const limitedDesign = await createDesign(payload, limited.id);
    await createDesign(payload, single.id, { visible: false });
    await createBooking(payload, booked.id, (await createSlot(payload)).id);
    await createBooking(payload, limitedDesign.id, (await createSlot(payload)).id);

    const { categories, designs } = await getFlashCatalog();

    expect(categories.map((c) => c.name)).toEqual([single.name, limited.name]);
    expect(designs.map((d) => d.id)).toEqual([limitedDesign.id, booked.id]);
    expect(designs[0]).toMatchObject({
      number: limitedDesign.number,
      collection: limited.name,
      availability: { rule: "limited", limit: 3, remaining: 2, soldOut: false },
    });
    expect(designs[1].availability).toEqual({ rule: "single", limit: 1, remaining: 0, soldOut: true });
    expect(designs[1].images[0]).toMatchObject({ kind: "art", label: "Minta", alt: "Tesztminta" });
    expect(designs[1].images[0].src).toMatch(/^\/api\/media\/file\//);
  });

  it("frees a seat again once the booking is rejected", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "single")).id);
    const booking = await createBooking(payload, design.id, (await createSlot(payload)).id);
    await payload.update({ collection: "bookings", id: booking.id, data: { status: "rejected" } });
    const { designs } = await getFlashCatalog();
    expect(designs[0].availability.soldOut).toBe(false);
  });
});

describe("listOpenSlots", () => {
  it("offers only future slots nobody holds, grouped by day", async () => {
    const design = await createDesign(payload, (await createCategory(payload, "unlimited")).id);
    const free = await createSlot(payload);
    const held = await createSlot(payload);
    await createSlot(payload, { past: true });
    await createBooking(payload, design.id, held.id);

    const days = await listOpenSlots();
    expect(days.flatMap((d) => d.slots.map((s) => s.id))).toEqual([free.id]);
  });
});
```

- [ ] **Step 3: Futtasd, és nézd meg, hogy elbukik**

```bash
npx vitest run tests/int/flash-data.test.ts
```

Expected: FAIL, `Cannot find package '@/lib/flash'` (a modul még nem létezik).

- [ ] **Step 4: `lib/flash.ts`**

```ts
import config from "@payload-config";
import { getPayload } from "payload";
import type { Design } from "@/payload-types";
import { ACTIVE_STATUSES, availability, relationId } from "./booking-rules";
import type { DesignImage, FlashCategory, FlashDesign } from "./flash-types";
import { type SlotDay, groupSlotsByDay } from "./time";

/** Collections and visible designs for the landing page, with live availability. */
export async function getFlashCatalog(): Promise<{ categories: FlashCategory[]; designs: FlashDesign[] }> {
  const payload = await getPayload({ config });
  const [categories, designs, active] = await Promise.all([
    payload.find({ collection: "categories", sort: "order", depth: 0, pagination: false }),
    payload.find({
      collection: "designs",
      where: { visible: { equals: true } },
      sort: "-createdAt",
      depth: 1,
      pagination: false,
    }),
    payload.find({
      collection: "bookings",
      where: { status: { in: [...ACTIVE_STATUSES] } },
      select: { design: true },
      depth: 0,
      pagination: false,
    }),
  ]);

  const counts = new Map<number, number>();
  for (const booking of active.docs) {
    const id = relationId(booking.design);
    if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return {
    categories: categories.docs.map((c) => ({ id: c.id, name: c.name, rule: c.rule })),
    designs: designs.docs.flatMap((d) => toFlashDesign(d, counts.get(d.id) ?? 0) ?? []),
  };
}

function toFlashDesign(doc: Design, activeCount: number): FlashDesign | null {
  const category = typeof doc.category === "object" ? doc.category : null;
  const images: DesignImage[] = (doc.images ?? []).flatMap(({ image, kind, label }) =>
    image && typeof image === "object" && image.url
      ? [{ src: image.url, alt: image.alt, kind: kind === "photo" ? "photo" : "art", label: label || "Minta" }]
      : [],
  );
  // Without its collection or any image a design can't be drawn as a card.
  if (!category || images.length === 0) return null;
  return {
    id: doc.id,
    number: doc.number,
    collection: category.name,
    price: doc.price,
    size: doc.size ?? "",
    placements: doc.placements ?? "",
    description: doc.description ?? "",
    badge: doc.badge === "new" ? "Új" : doc.badge === "last" ? "Utolsó" : undefined,
    createdAt: doc.createdAt,
    images,
    availability: availability(category, activeCount),
  };
}

/** Future slots no booking holds, grouped by Budapest day. */
export async function listOpenSlots(now = new Date()): Promise<SlotDay[]> {
  const payload = await getPayload({ config });
  const [slots, held] = await Promise.all([
    payload.find({
      collection: "slots",
      where: { startsAt: { greater_than: now.toISOString() } },
      select: { startsAt: true },
      sort: "startsAt",
      depth: 0,
      pagination: false,
    }),
    payload.find({
      collection: "bookings",
      where: { slot: { exists: true } },
      select: { slot: true },
      depth: 0,
      pagination: false,
    }),
  ]);
  const taken = new Set(held.docs.map((b) => relationId(b.slot)));
  return groupSlotsByDay(slots.docs.filter((s) => !taken.has(s.id)));
}
```

- [ ] **Step 5: Futtasd, most át kell mennie**

```bash
npx vitest run tests/int/flash-data.test.ts
```

Expected: PASS (3 teszt).

- [ ] **Step 6: A látogató címe: a bukó teszt (`tests/unit/client-address.test.ts`)**

A foglalási korlát a látogató címére kulcsol. A Next 16 magától kitölti az `X-Forwarded-For` fejlécet a socket címével, ha a proxy nem küld ilyet. Ezért a fejléc bal oldali eleme hamisítható, a jobb szélső pedig proxy nélkül a saját loopback cím lehet. A megbízható elem jobbról a `TRUSTED_PROXY_HOPS`-adik. Ha nincs használható nyilvános cím, nincs kulcs, és a korlát kimarad, nehogy mindenki egy közös keretet kapjon.

```ts
import { describe, expect, it } from "vitest";
import { clientAddress } from "@/lib/client-address";

describe("clientAddress", () => {
  it("takes the entry our own proxy added, not the one the visitor sent", () => {
    // The visitor sent "X-Forwarded-For: 6.6.6.6"; the proxy appended the address it actually saw.
    expect(clientAddress("6.6.6.6, 203.0.113.9")).toBe("203.0.113.9");
    expect(clientAddress("203.0.113.9")).toBe("203.0.113.9");
  });

  it("counts the trusted hops from the right", () => {
    expect(clientAddress("6.6.6.6, 203.0.113.9, 198.51.100.7", 2)).toBe("203.0.113.9");
    expect(clientAddress("203.0.113.9", 2)).toBeNull();
  });

  it("trusts nothing when hops is below 1", () => {
    expect(clientAddress("203.0.113.9", 0)).toBeNull();
  });

  it.each([
    ["no header", null],
    ["an empty header", ""],
    ["junk", "not-an-address"],
    ["a port glued on", "203.0.113.9:4711"],
    ["an IPv4 loopback", "127.0.0.1"],
    ["an IPv4-mapped loopback, which is what Next fills in when the proxy sent nothing", "::ffff:127.0.0.1"],
    ["an IPv6 loopback", "::1"],
    ["a private address", "10.1.2.3"],
    ["another private range", "172.20.0.5"],
    ["a unique-local IPv6 address", "fd00::1"],
  ])("has no address for %s", (_what, header) => {
    expect(clientAddress(header)).toBeNull();
  });

  it("reads an IPv4-mapped address as the IPv4 one", () => {
    expect(clientAddress("::ffff:203.0.113.9")).toBe("203.0.113.9");
  });

  it("identifies an IPv6 visitor by their /64", () => {
    const a = clientAddress("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    const b = clientAddress("2001:DB8:1:2::1");
    expect(a).toBe("2001:db8:1:2::/64");
    expect(b).toBe(a);
    expect(clientAddress("2001:db8:1:3::1")).not.toBe(a);
  });

  it("expands :: before cutting the prefix", () => {
    expect(clientAddress("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });
});
```

```bash
npx vitest run tests/unit/client-address.test.ts
```

Expected: FAIL, `Cannot find package '@/lib/client-address'` (a modul még nem létezik).

- [ ] **Step 7: `lib/client-address.ts`**

```ts
import { isIP } from "node:net";

/** Loopback, private, link-local and unspecified addresses: a hop inside the host's own network, not a visitor. */
const INTERNAL = /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.|0\.|::1?$|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i;

/** An IPv6 visitor can pick any address in their /64, so that prefix is what identifies them. */
function ipv6Prefix(ip: string) {
  const [head = "", tail = ""] = ip.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const missing = ip.includes("::") ? Math.max(0, 8 - headGroups.length - tailGroups.length) : 0;
  const groups = [...headGroups, ...Array<string>(missing).fill("0"), ...tailGroups];
  return `${groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/**
 * The visitor's address as the nearest trusted proxy saw it: the entry `hops` places from the right of
 * X-Forwarded-For. Everything to its left is whatever the visitor chose to send. Null when there is no usable
 * public address (no header, hops < 1, an internal hop, junk), so the caller skips its per-address limit.
 */
export function clientAddress(forwardedFor: string | null, hops = 1): string | null {
  if (hops < 1) return null;
  const entries = (forwardedFor ?? "").split(",").map((entry) => entry.trim());
  const candidate = entries[entries.length - hops]?.replace(/^::ffff:/i, "");
  if (!candidate || !isIP(candidate) || INTERNAL.test(candidate)) return null;
  return isIP(candidate) === 6 ? ipv6Prefix(candidate) : candidate;
}
```

```bash
npx vitest run tests/unit/client-address.test.ts
```

Expected: PASS (16 teszt).

- [ ] **Step 8: `.env.example`: a proxy-hopok száma**

A fájl végére:

```dotenv

# Proxies in front of the app that append to X-Forwarded-For. Assumed: 1 for Hostinger's own, 2 with its CDN
# switched on; confirm with the README's live checks. The booking limit (3 per visitor per hour) keys on the
# address that many entries from the right; 0 turns it off, anything else non-numeric means 1.
TRUSTED_PROXY_HOPS=1
```

- [ ] **Step 9: A server action bukó tesztje (`tests/unit/book-flash.test.ts`)**

A Payloadot, a fejléceket és a foglalás létrehozását mockolja; a korlátozó, a címkezelés és az űrlap-ellenőrzés valódi. Minden teszt friss modulpéldányt tölt be (`vi.resetModules`), így a korlátozó állapota nem szivárog át.

```ts
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
```

```bash
npx vitest run tests/unit/book-flash.test.ts
```

Expected: FAIL, az `@/app/(frontend)/actions` modul még nem létezik.

- [ ] **Step 10: `app/(frontend)/actions.ts`**

```ts
"use server";

import config from "@payload-config";
import { headers } from "next/headers";
import { getPayload } from "payload";
import type { PublicBookingCode } from "@/cms/booking/errors";
import { createPublicBooking } from "@/cms/booking/public";
import { type FieldErrors, parseBookingInput } from "@/lib/booking-input";
import { clientAddress } from "@/lib/client-address";
import { listOpenSlots } from "@/lib/flash";
import { createRateLimiter } from "@/lib/rate-limit";
import type { SlotDay } from "@/lib/time";

export type BookFlashState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; code: PublicBookingCode | "invalid" | "rate_limited"; fieldErrors?: FieldErrors };

// At most three bookings an hour from one visitor, so nobody can lock up the whole calendar.
const limiter = createRateLimiter({ limit: 3, windowMs: 60 * 60 * 1000 });
// Proxies in front of the app that append to X-Forwarded-For (see .env.example); 0 turns the limit off.
const hopsSetting = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
const trustedProxyHops = Number.isInteger(hopsSetting) ? hopsSetting : 1;

export async function getOpenSlots(): Promise<SlotDay[]> {
  return listOpenSlots();
}

export async function bookFlash(formData: FormData): Promise<BookFlashState> {
  const parsed = parseBookingInput(Object.fromEntries(formData));
  if (!parsed.ok) return { status: "error", code: "invalid", fieldErrors: parsed.fieldErrors };

  const payload = await getPayload({ config });
  // Bots fill the hidden field: tell them it worked and store nothing.
  if (parsed.data.website) {
    payload.logger.warn("Booking form honeypot filled in; nothing stored.");
    return { status: "success" };
  }

  // No usable visitor address (e.g. an unexpected proxy setup): skip the limit rather than share one bucket.
  const address = clientAddress((await headers()).get("x-forwarded-for"), trustedProxyHops);
  if (address && !limiter.take(address)) return { status: "error", code: "rate_limited" };

  const result = await createPublicBooking(payload, parsed.data);
  if (!result.ok) {
    // Only bookings that went through count against the limit.
    if (address) limiter.release(address);
    return { status: "error", code: result.code };
  }
  return { status: "success" };
}
```

Futtasd a tesztet: `npx vitest run tests/unit/book-flash.test.ts`. Expected: PASS (13 teszt).

- [ ] **Step 11: Lint, typecheck, teljes tesztkészlet**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: minden zöld.

- [ ] **Step 12: Commit**

```bash
git add lib/flash-types.ts lib/flash.ts lib/client-address.ts .env.example "app/(frontend)/actions.ts" tests/int/flash-data.test.ts tests/unit/client-address.test.ts tests/unit/book-flash.test.ts
git commit -m "$(cat <<'EOF'
feat: read the flash catalog and open slots from Payload; booking server actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Az oldal átállítása valós adatokra, kosár helyett foglalás

**Files:**
- Modify: `components/data.ts`
- Modify: `components/store.tsx`
- Modify: `components/icons.tsx`
- Modify: `components/header.tsx`
- Modify: `components/flash-collection.tsx`
- Modify: `components/spotlight.tsx`
- Modify: `components/paths.tsx`
- Modify: `app/(frontend)/page.tsx`

A lépések közben a typecheck piros lehet. A task végén (Step 9) zöldnek kell lennie.

- [ ] **Step 1: `components/data.ts`: a teljes új tartalom**

Kikerül a beégetett `designs` tömb, a `collections` lista és a `Collection` típus. A típusok a `lib/flash-types.ts`-ből jönnek.

```ts
import type { Availability } from "@/lib/booking-rules";
import { formatPrice } from "@/lib/format";
import type { FlashDesign } from "@/lib/flash-types";

export { formatPrice };
export type { DesignImage, FlashCategory, FlashDesign } from "@/lib/flash-types";

export const styles = ["Conceptual", "Abstract", "Microrealism"] as const;

export function designName(d: Pick<FlashDesign, "collection" | "number">) {
  return `${d.collection} #${d.number}`;
}

/** One line on how often a design can still be booked. */
export function availabilityLabel({ rule, remaining, soldOut }: Availability) {
  if (soldOut) return "Elkelt";
  if (rule === "single") return "Egyszeri minta";
  if (rule === "limited") return `Limitált · még ${remaining} alkalom`;
  return "Korlátlanul foglalható";
}

/** "90 000 – 120 000 Ft" across the designs that can still be booked; null when none can. */
export function priceRange(designs: FlashDesign[]) {
  const prices = designs.filter((d) => !d.availability.soldOut).map((d) => d.price);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(min) : `${formatPrice(min).replace(" Ft", "")} – ${formatPrice(max)}`;
}
```

- [ ] **Step 2: `components/store.tsx`: a teljes új tartalom**

```tsx
"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Store = {
  favorites: Set<number>;
  featured: number | null;
  /** The design whose booking dialog is open, if any. */
  bookingFor: number | null;
  toggleFavorite: (id: number) => void;
  feature: (id: number) => void;
  openBooking: (id: number) => void;
  closeBooking: () => void;
};

const StoreContext = createContext<Store | null>(null);

function toggled(set: Set<number>, id: number) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// Favourites stay UI-only; a booking goes through the booking dialog to Payload.
export function StoreProvider({
  initialFeatured,
  children,
}: {
  initialFeatured: number | null;
  children: React.ReactNode;
}) {
  const [favorites, setFavorites] = useState<Set<number>>(() => new Set());
  const [featured, setFeatured] = useState(initialFeatured);
  const [bookingFor, setBookingFor] = useState<number | null>(null);

  const toggleFavorite = useCallback((id: number) => setFavorites((s) => toggled(s, id)), []);
  const feature = useCallback((id: number) => setFeatured(id), []);
  const openBooking = useCallback((id: number) => setBookingFor(id), []);
  const closeBooking = useCallback(() => setBookingFor(null), []);

  const value = useMemo(
    () => ({ favorites, featured, bookingFor, toggleFavorite, feature, openBooking, closeBooking }),
    [favorites, featured, bookingFor, toggleFavorite, feature, openBooking, closeBooking],
  );

  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}
```

- [ ] **Step 3: `components/icons.tsx`: `Bag` helyett `Calendar`**

Cseréld le a teljes `export const Bag = ...` blokkot erre:

```tsx
export const Calendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
);
```

- [ ] **Step 4: `components/header.tsx`: kikerül a kosár**

1. Az importokból töröld a `Bag`-et és a `useStore`-t:

```tsx
import { Close, Menu, User } from "./icons";
import { Logo, Tags, container } from "./ui";
```

2. A `Header()` törzséből töröld ezt a sort: `const { cart } = useStore();`

3. Töröld a teljes kosár linket, vagyis az `<a href="#flash" aria-label={`Kosár: ${cart.size} minta`} ...>` elemet a záró `</a>`-ig, a benne lévő számlálóval együtt. A `Fiókom` és a menü gomb marad.

A foglalási ablak a Task 13-ban kerül az oldalra. Addig a naptár gomb és az „Időpontot foglalok” gomb csak a store állapotát állítja.

- [ ] **Step 5: `components/flash-collection.tsx`: a teljes új tartalom**

```tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { type FlashCategory, type FlashDesign, designName, formatPrice } from "./data";
import { Calendar, ChevronDown, Heart } from "./icons";
import { useStore } from "./store";
import { Arrow, Pcons, StyleTags, btn, container } from "./ui";

type Sort = "newest" | "price-asc" | "price-desc";

const ALL = "Összes";
/** Cards shown at first, and added by each "Több minta mutatása". */
const PAGE = 8;

const sorters: Record<Sort, (a: FlashDesign, b: FlashDesign) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
};

export function showFlashProcess() {
  window.dispatchEvent(new CustomEvent("process-tab", { detail: "flash" }));
}

function FlashCard({ design }: { design: FlashDesign }) {
  const { favorites, toggleFavorite, feature, openBooking } = useStore();
  const name = designName(design);
  const saved = favorites.has(design.id);
  const { soldOut, rule, remaining } = design.availability;
  const badge = soldOut ? "Elkelt" : design.badge;
  const image = design.images[0];

  return (
    <article className="group">
      <div className="relative aspect-[219/344] overflow-hidden rounded-[3px] bg-stencil">
        <a
          href="#kiemelt"
          onClick={() => feature(design.id)}
          aria-label={`${name} részletei`}
          className="absolute inset-0 focus-visible:-outline-offset-4"
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            quality={90}
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 50vw"
            className={`object-contain mix-blend-multiply transition-[transform,opacity] duration-700 ease-settle group-hover:scale-[1.035] ${soldOut ? "opacity-35" : ""}`}
          />
        </a>

        {badge && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-[3px] bg-paper px-2 py-1.5 font-sans text-[0.625rem] uppercase leading-none tracking-[0.18em]">
            {badge}
          </span>
        )}

        <button
          type="button"
          onClick={() => toggleFavorite(design.id)}
          aria-pressed={saved}
          aria-label={saved ? `${name} eltávolítása a mentettek közül` : `${name} mentése későbbre`}
          className="absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-paper/90 transition-[scale] duration-300 hover:scale-105 active:scale-90 active:duration-75"
        >
          <Heart size={19} filled={saved} />
        </button>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[1.0625rem] leading-snug sm:text-[1.1875rem]">
            {design.collection === "P’CONs" ? <Pcons suffix={` #${design.number}`} /> : name}
          </h3>
          <p className="mt-1 font-display text-[1rem] text-graphite sm:text-[1.0625rem]">
            {soldOut ? <span className="italic text-muted">Lefoglalva</span> : formatPrice(design.price)}
          </p>
          {!soldOut && rule === "limited" && (
            <p className="mt-1.5 text-[0.8125rem] text-muted">még {remaining} alkalom</p>
          )}
        </div>
        {!soldOut && (
          <button
            type="button"
            onClick={() => openBooking(design.id)}
            aria-label={`${name} – időpontfoglalás`}
            className="grid size-11 shrink-0 place-items-center rounded-[6px] border border-hairline bg-white transition-[background-color,border-color,color,scale] duration-300 hover:border-ink hover:bg-ink hover:text-paper active:scale-90 active:duration-75"
          >
            <Calendar size={19} />
          </button>
        )}
      </div>
    </article>
  );
}

export function FlashCollection({ designs, categories }: { designs: FlashDesign[]; categories: FlashCategory[] }) {
  const [filter, setFilter] = useState(ALL);
  const [sort, setSort] = useState<Sort>("newest");
  const [shown, setShown] = useState(PAGE);

  const visible = designs.filter((d) => filter === ALL || d.collection === filter).sort(sorters[sort]);

  const choose = (name: string) => {
    setFilter(name);
    setShown(PAGE);
  };

  return (
    <section id="flash" data-nav="flash" aria-labelledby="flash-title" className="border-t border-hairline">
      <div className={`${container} py-24 lg:py-32`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="label text-muted">Flash kollekció</p>
            <h2
              id="flash-title"
              className="mt-4 font-display text-[clamp(4rem,10vw,8.75rem)] font-normal leading-[0.88] tracking-[-0.03em]"
            >
              <Pcons />
            </h2>
            <StyleTags className="mt-6" />
          </div>
          <div className="max-w-[23rem] lg:pb-2">
            <p className="leading-[1.7] text-graphite">
              Előre megtervezett minták, amelyek a PANNIPIX világát képviselik. Van, amelyik csak egyszer kerül
              bőrre, és van, amelyik többször is: ezt a kollekció dönti el.
            </p>
            <a href="#info" onClick={showFlashProcess} className="group label -mb-3 mt-3 inline-flex items-center gap-3 py-3">
              Hogyan működik a flash <Arrow />
            </a>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-b border-hairline pb-6 md:flex-row md:items-center md:justify-between">
          <div role="group" aria-label="Kollekció szűrése" className="-mx-5 flex gap-2.5 overflow-x-auto overscroll-x-contain px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {[ALL, ...categories.map((c) => c.name)].map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={filter === c}
                onClick={() => choose(c)}
                className="h-11 shrink-0 rounded-[6px] bg-stencil px-5 font-display text-[1.0625rem] transition-[background-color,color,scale] duration-300 hover:bg-[#e3e3df] active:scale-[0.97] active:duration-75 aria-pressed:bg-ink aria-pressed:text-paper"
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-8 md:justify-end">
            <p className="text-[0.9375rem] text-muted" aria-live="polite">
              {visible.length} minta
            </p>
            <label className="relative flex items-center gap-3 text-[0.9375rem]">
              <span className="text-muted">Rendezés</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="min-h-11 cursor-pointer appearance-none bg-transparent pr-7 text-ink [field-sizing:content] focus-visible:outline-offset-2"
              >
                <option value="newest">Legújabb</option>
                <option value="price-asc">Ár szerint növekvő</option>
                <option value="price-desc">Ár szerint csökkenő</option>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-0" />
            </label>
          </div>
        </div>

        {visible.length > 0 ? (
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 lg:grid-cols-4 lg:gap-y-16">
            {visible.slice(0, shown).map((d) => (
              <FlashCard key={d.id} design={d} />
            ))}
          </div>
        ) : (
          <div className="mt-10 flex flex-col items-center rounded-[3px] border border-dashed border-ash/70 px-6 py-24 text-center">
            <p className="max-w-[30rem] font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight">
              Ebben a kollekcióban most nincs elérhető minta.
            </p>
            <p className="mt-4 max-w-[26rem] leading-[1.7] text-graphite">
              Nézz körül a többi kollekcióban, vagy kérj egyedi tervet a saját ötletedből.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              {filter !== ALL && (
                <button type="button" onClick={() => choose(ALL)} className={btn.outline}>
                  Összes minta
                </button>
              )}
              <a href="#kapcsolat" className={btn.primary}>
                Egyedi tervet kérek <Arrow />
              </a>
            </div>
          </div>
        )}

        {visible.length > shown && (
          <div className="mt-20 flex justify-center">
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className={`${btn.primary} min-w-[18rem]`}>
              Több minta mutatása <Arrow />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: `components/spotlight.tsx`: a teljes új tartalom**

```tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { type DesignImage, type FlashDesign, designName, formatPrice } from "./data";
import { ChevronLeft, ChevronRight, Heart, Plus, Resize, Sparkle, Torso } from "./icons";
import { useStore } from "./store";
import { Arrow, Pcons, StyleTags, btn, container } from "./ui";

function Picture({ image, sizes, thumb = false }: { image: DesignImage; sizes: string; thumb?: boolean }) {
  if (image.kind === "art") {
    return (
      <Image
        src={image.src}
        alt={thumb ? "" : image.alt}
        fill
        quality={90}
        sizes={sizes}
        className={`object-contain mix-blend-multiply ${thumb ? "p-[8%]" : "p-[5%]"}`}
      />
    );
  }
  // Photos are shown as a small print laid on the panel rather than stretched to fill it.
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div
        className={`bg-white shadow-[0_1px_2px_rgb(0_0_0/0.06),0_18px_40px_-18px_rgb(0_0_0/0.25)] ${
          thumb ? "w-[62%] p-1 pb-3" : "w-[min(58%,17rem)] -rotate-[1.25deg] p-2.5 pb-11"
        }`}
      >
        <div className="relative aspect-[216/250] overflow-hidden">
          <Image src={image.src} alt={thumb ? "" : image.alt} fill quality={90} sizes={sizes} className="object-cover" />
        </div>
        {!thumb && <p className="label mt-4 text-[0.6875rem] text-muted">{image.label}</p>}
      </div>
    </div>
  );
}

function Fact({ icon, term, children }: { icon: React.ReactNode; term: string; children: React.ReactNode }) {
  return (
    <div className="relative pl-12">
      <dt className="label text-[0.6875rem] text-muted">
        <span className="absolute left-0 top-0 text-ink">{icon}</span>
        {term}
      </dt>
      <dd className="mt-2">{children}</dd>
    </div>
  );
}

/** What the collection's rule means for this design, in one term and one sentence. */
function ruleFact({ rule, limit, remaining, soldOut }: FlashDesign["availability"]) {
  if (rule === "single") {
    return {
      term: "Egyszeri minta",
      body: soldOut ? "Ez a minta már gazdára talált, többé nem tetoválom." : "Ez a design csak egyszer készül el.",
    };
  }
  if (rule === "limited") {
    return {
      term: "Limitált minta",
      body: soldOut
        ? `Mind a ${limit} alkalom elkelt.`
        : `Összesen ${limit} alkalommal készül el, ebből még ${remaining} foglalható.`,
    };
  }
  return { term: "Bármikor foglalható", body: "Ez a minta többször is elkészülhet." };
}

function Detail({ design }: { design: FlashDesign }) {
  const { favorites, toggleFavorite, openBooking } = useStore();
  const [active, setActive] = useState(0);
  const name = designName(design);
  const image = design.images[active];
  const saved = favorites.has(design.id);
  const { soldOut } = design.availability;
  const fact = ruleFact(design.availability);

  return (
    <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-20">
      <div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[3px] bg-stencil">
          <Picture key={image.src} image={image} sizes="(min-width: 1024px) 48vw, 92vw" />
          {soldOut && (
            <span className="label absolute left-4 top-4 rounded-[3px] bg-paper px-2.5 py-2 text-[0.625rem]">Elkelt</span>
          )}
        </div>

        {design.images.length > 1 && (
          <div role="group" aria-label="Nézetek" className="mt-3 grid grid-cols-3 gap-3">
            {design.images.map((img, i) => (
              <button
                key={img.src}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={active === i}
                aria-label={img.label}
                className="relative aspect-[5/6] overflow-hidden rounded-[3px] border border-transparent bg-stencil transition-[border-color,scale] duration-200 hover:border-ash active:scale-[0.97] aria-pressed:border-ink"
              >
                <Picture image={img} sizes="16vw" thumb />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lg:pt-2">
        <div className="flex items-baseline justify-between">
          <p className="label text-muted">{design.collection}</p>
          <p className="font-display text-[1.0625rem] text-muted">#{design.number}</p>
        </div>
        <h3 className="mt-5 font-display text-[clamp(2.6rem,4.4vw,3.9rem)] font-normal leading-none tracking-[-0.02em]">
          {design.collection === "P’CONs" ? <Pcons suffix={` #${design.number}`} /> : name}
        </h3>
        <StyleTags className="mt-5" />
        <p className="mt-7 font-display text-[1.875rem] leading-none">
          {soldOut ? <span className="italic text-muted">Elkelt</span> : formatPrice(design.price)}
        </p>

        <dl className="mt-9 space-y-7 border-t border-hairline pt-8">
          <Fact icon={<Resize size={22} />} term="Ajánlott méret">
            <span className="font-display text-[1.1875rem]">{design.size}</span>
          </Fact>
          <Fact icon={<Sparkle size={22} />} term={fact.term}>
            <span className="text-[0.9375rem] leading-relaxed text-graphite">{fact.body}</span>
          </Fact>
          <Fact icon={<Torso size={22} />} term="Ajánlott testtájak">
            <span className="font-display text-[1.1875rem]">{design.placements}</span>
            <span className="mt-2 block text-[0.9375rem] leading-relaxed text-graphite">
              Más testtájra is kérhető, erről a konzultáción egyeztetünk.
            </span>
          </Fact>
        </dl>

        <div className="mt-10 grid gap-3">
          {soldOut ? (
            <a href="#kapcsolat" className={`${btn.primary} w-full justify-between`}>
              Hasonló egyedi tervet kérek <Arrow />
            </a>
          ) : (
            <button type="button" onClick={() => openBooking(design.id)} className={`${btn.primary} w-full justify-between`}>
              Időpontot foglalok <Arrow />
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleFavorite(design.id)}
            aria-pressed={saved}
            className={`${btn.outline} w-full`}
          >
            <Heart size={18} filled={saved} />
            {saved ? "Elmentve" : "Mentés későbbre"}
          </button>
        </div>

        <div className="mt-10 border-t border-hairline">
          {[
            ["Leírás", design.description],
            [
              "Fontos információk",
              "A méret csak kis mértékben módosítható, hogy a részletek tiszták maradjanak. Kisebb változtatásokat, például egy elem elhagyását, a konzultáción egyeztetünk.",
            ],
            [
              "Hogyan működik?",
              "Kiválasztasz egy szabad időpontot, és elküldöd a foglalást. Most nem fizetsz semmit: átnézem a foglalást, és e-mailben visszaigazolom. A foglalással a minta egy alkalma lekerül a kínálatból.",
            ],
          ].map(([title, body]) => (
            <details key={title} className="border-b border-hairline">
              <summary className="label flex items-center justify-between py-5 text-[0.75rem]">
                {title}
                <Plus size={18} className="acc-icon transition-transform duration-300 ease-settle" />
              </summary>
              <p className="max-w-[34rem] pb-6 text-[0.9375rem] leading-[1.7] text-graphite">{body}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Spotlight({ designs }: { designs: FlashDesign[] }) {
  const { featured, feature } = useStore();
  if (designs.length === 0) return null;
  const index = Math.max(0, designs.findIndex((d) => d.id === featured));
  const design = designs[index];
  const step = (dir: 1 | -1) => feature(designs[(index + dir + designs.length) % designs.length].id);

  return (
    <section id="kiemelt" data-nav="flash" aria-labelledby="spotlight-title" className="bg-paper">
      <div className={`${container} pb-28 lg:pb-36`}>
        <div className="flex items-center justify-between border-t border-hairline pt-8">
          <h2 id="spotlight-title" className="label text-muted">
            A minta közelről
          </h2>
          <div className="label flex items-center text-[0.6875rem]">
            <button type="button" onClick={() => step(-1)} className="flex min-h-11 items-center gap-1.5 px-2.5 transition-opacity hover:opacity-60 active:opacity-40">
              <ChevronLeft size={15} /> Előző
            </button>
            <span aria-hidden="true" className="h-3.5 w-px bg-hairline" />
            <button type="button" onClick={() => step(1)} className="-mr-2.5 flex min-h-11 items-center gap-1.5 px-2.5 transition-opacity hover:opacity-60 active:opacity-40">
              Következő <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {designName(design)}
        </p>
        <Detail key={design.id} design={design} />
      </div>
    </section>
  );
}
```

- [ ] **Step 7: `components/paths.tsx`: árintervallum propként, foglalás-szöveg**

A `const services = [ ... ];` blokkot (a `Construction()` függvény után, a `Paths()` előtt) cseréld le erre a kettőre:

```tsx
const customService = {
  id: "egyedi",
  label: "Egyedi tetoválás",
  title: "Megtervezem a te ötletedből.",
  body: "Elmeséled, mi foglalkoztat: egy emléket, egy szimbólumot, egy hangulatot. Ebből építek konceptuális kompozíciót, ami követi a testtájad formáját.",
  facts: [
    ["Kezdés", "Online konzultáció"],
    ["Tervezés", "2–3 hét"],
    ["Ár", "Egyedi ajánlat a konzultáció után"],
  ],
  cta: { href: "#kapcsolat", label: "Egyedi tervet kérek", style: btn.primary },
  visual: <Construction />,
};

function flashService(price: string | null) {
  return {
    id: "flash-minta",
    label: "Flash minták",
    title: "Válassz egy kész mintát.",
    body: "Előre megrajzolt darabok a PANNIPIX kollekciókból, fix áron. Kiválasztod a mintát és egy szabad időpontot, én pedig visszaigazolom a foglalást.",
    facts: [
      ["Ár", price ?? "Mintánként megadva"],
      ["Méret", "Mintánként megadva"],
      ["Alkalmak", "Kollekciónként eltérő"],
    ],
    cta: { href: "#flash", label: "Flash minták böngészése", style: btn.outline },
    visual: (
      <Image
        src="/flash/pcons-022.webp"
        alt="P’CONs #022 flash minta: holdkorong egy függőleges vonalon"
        fill
        quality={90}
        sizes="(min-width: 1024px) 40vw, 90vw"
        className="object-contain py-[6%] mix-blend-multiply"
      />
    ),
  };
}
```

Majd a függvény fejlécét és az első sorát:

```tsx
export function Paths({ flashPrice }: { flashPrice: string | null }) {
  const services = [customService, flashService(flashPrice)];
  return (
```

(A JSX többi része változatlan, a `services.map(...)` továbbra is működik.)

- [ ] **Step 8: `app/(frontend)/page.tsx`: a teljes új tartalom**

```tsx
import { connection } from "next/server";
import { About } from "@/components/about";
import { Booking } from "@/components/booking";
import { priceRange } from "@/components/data";
import { Faq } from "@/components/faq";
import { FlashCollection } from "@/components/flash-collection";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Paths } from "@/components/paths";
import { Process } from "@/components/process";
import { Spotlight } from "@/components/spotlight";
import { StoreProvider } from "@/components/store";
import { getFlashCatalog } from "@/lib/flash";

export default async function Home() {
  // Rendered per request so availability is always current, and the build never touches the database.
  await connection();
  const { categories, designs } = await getFlashCatalog();

  return (
    <StoreProvider initialFeatured={designs[0]?.id ?? null}>
      <a
        href="#main"
        className="label sr-only z-60 rounded-[5px] bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ugrás a tartalomra
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Paths flashPrice={priceRange(designs)} />
        <FlashCollection designs={designs} categories={categories} />
        <Spotlight designs={designs} />
        <Process />
        <Faq />
        <About />
        <Booking />
      </main>
      <Footer />
    </StoreProvider>
  );
}
```

- [ ] **Step 9: Lint és typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: nincs hiba. Ha a typecheck még egy helyen a régi `cart`, `toggleCart`, `designs` vagy `Collection` exportra hivatkozik, a hibaüzenet megadja a fájlt és a sort: azt is a fenti mintára kell átírni.

- [ ] **Step 10: Commit**

```bash
git add components "app/(frontend)/page.tsx"
git commit -m "$(cat <<'EOF'
feat: render flash designs from Payload; book instead of cart

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: A foglalási ablak

**Files:**
- Create: `components/booking-dialog.tsx`
- Modify: `app/(frontend)/page.tsx`

- [ ] **Step 1: `components/booking-dialog.tsx`: a teljes tartalom**

```tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { type BookFlashState, bookFlash, getOpenSlots } from "@/app/(frontend)/actions";
import { PLACEMENTS } from "@/lib/booking-input";
import type { OpenSlot, SlotDay } from "@/lib/time";
import { type FlashDesign, availabilityLabel, designName, formatPrice } from "./data";
import { Check, ChevronDown, ChevronLeft, Close } from "./icons";
import { useStore } from "./store";
import { Arrow, btn } from "./ui";

type Step = "slot" | "details" | "done";
type ErrorCode = Extract<BookFlashState, { status: "error" }>["code"];

const ERROR_TEXT: Record<ErrorCode, string> = {
  invalid: "Nézd át a jelölt mezőket.",
  rate_limited: "Túl sok foglalás érkezett erről a hálózatról. Próbáld újra később, vagy írj Instagramon: @pannipix.",
  design_unavailable: "Ez a minta jelenleg nem foglalható.",
  sold_out: "Ez a minta közben betelt.",
  slot_taken: "Ezt az időpontot közben lefoglalták, válassz másikat.",
  slot_past: "Ez az időpont már elmúlt, válassz másikat.",
  unknown: "Valami hiba történt. Próbáld újra, vagy írj Instagramon: @pannipix.",
};

const field =
  "mt-1.5 block w-full border-0 border-b border-hairline bg-transparent pb-3 pt-2 text-[1.0625rem] text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none aria-invalid:border-ink";

function ErrorText({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-2 text-[0.875rem] italic">
      {children}
    </p>
  );
}

function TextField({
  label,
  error,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label text-[0.6875rem] text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={field}
        {...props}
      />
      <ErrorText id={`${id}-error`}>{error}</ErrorText>
    </div>
  );
}

function BookingFlow({ design, onClose }: { design: FlashDesign; onClose: () => void }) {
  const router = useRouter();
  // Keep the header as it was when the dialog opened, even after the page refreshes availability.
  const [snapshot] = useState(design);
  const [step, setStep] = useState<Step>("slot");
  const [days, setDays] = useState<SlotDay[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [slot, setSlot] = useState<OpenSlot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<BookFlashState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const placementId = useId();
  const noteId = useId();
  const headings = {
    slot: useRef<HTMLHeadingElement>(null),
    details: useRef<HTMLHeadingElement>(null),
    done: useRef<HTMLHeadingElement>(null),
  };
  const mounted = useRef(false);

  const loadSlots = useCallback(() => {
    getOpenSlots().then(
      (next) => {
        setDays(next);
        setLoadFailed(false);
      },
      () => setLoadFailed(true),
    );
  }, []);

  useEffect(loadSlots, [loadSlots]);

  // Move focus to the new step's heading, so keyboard and screen reader users follow along.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headings[step].current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function retry() {
    setLoadFailed(false);
    setDays(null);
    loadSlots();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const next = await bookFlash(formData);
      setResult(next);
      if (next.status === "success") {
        setStep("done");
        router.refresh();
      } else if (next.status === "error" && (next.code === "slot_taken" || next.code === "slot_past")) {
        setNotice(ERROR_TEXT[next.code]);
        setSlot(null);
        setDays(null);
        setStep("slot");
        loadSlots();
      }
    });
  }

  const image = snapshot.images.find((i) => i.kind === "art") ?? snapshot.images[0];
  const name = designName(snapshot);
  const errors = result.status === "error" && result.code === "invalid" ? (result.fieldErrors ?? {}) : {};
  const formError =
    result.status === "error" && !["invalid", "slot_taken", "slot_past"].includes(result.code)
      ? ERROR_TEXT[result.code]
      : null;

  return (
    <div className="fade-up flex h-full max-h-[inherit] flex-col">
      <header className="flex items-start gap-4 border-b border-hairline px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:pt-7">
        <div className="relative aspect-[219/344] w-14 shrink-0 overflow-hidden rounded-[3px] bg-stencil">
          <Image src={image.src} alt="" fill sizes="56px" quality={90} className="object-contain mix-blend-multiply" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="label text-[0.6875rem] text-muted">Időpontfoglalás</p>
          <h2 id="booking-title" className="mt-2 font-display text-[1.75rem] leading-tight">
            {name}
          </h2>
          <p className="mt-1 text-[0.9375rem] text-graphite">
            {formatPrice(snapshot.price)} · {availabilityLabel(snapshot.availability)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Bezárás"
          className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full transition-[background-color,scale] duration-200 hover:bg-ink/5 active:scale-95"
        >
          <Close size={22} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-7 sm:px-8">
        {step === "done" ? (
          <section aria-live="polite" className="py-2">
            <span className="grid size-12 place-items-center rounded-full border border-ink">
              <Check size={22} />
            </span>
            <h3
              ref={headings.done}
              tabIndex={-1}
              className="mt-6 font-display text-[clamp(1.9rem,4vw,2.4rem)] leading-tight focus:outline-none"
            >
              Megkaptam a foglalásod.
            </h3>
            <p className="mt-4 font-display text-[1.1875rem]">
              {name} · {slot?.label}
            </p>
            <p className="mt-4 max-w-[28rem] leading-[1.7] text-graphite">
              Hamarosan átnézem, és e-mailben visszaigazolom. Ha nem találod a levelet, nézd meg a spam mappát is.
            </p>
            <button type="button" onClick={onClose} className={`${btn.primary} mt-9`}>
              Rendben
            </button>
          </section>
        ) : (
          <>
            <section hidden={step !== "slot"} aria-labelledby="booking-slot-step">
              <h3
                id="booking-slot-step"
                ref={headings.slot}
                tabIndex={-1}
                className="label text-muted focus:outline-none"
              >
                1 · Válassz időpontot
              </h3>
              {notice && (
                <p role="alert" className="mt-5 border-l border-ink pl-4 text-[0.9375rem] leading-relaxed">
                  {notice}
                </p>
              )}

              {loadFailed ? (
                <div className="mt-6">
                  <p className="leading-relaxed text-graphite">Nem sikerült betölteni az időpontokat.</p>
                  <button type="button" onClick={retry} className={`${btn.outline} mt-5`}>
                    Újrapróbálom
                  </button>
                </div>
              ) : days === null ? (
                <p className="mt-6 text-graphite" aria-live="polite">
                  Időpontok betöltése…
                </p>
              ) : days.length === 0 ? (
                <p className="mt-6 max-w-[28rem] leading-[1.7] text-graphite">
                  Most nincs szabad időpont. Írj Instagramon (
                  <a href="https://instagram.com/pannipix" className="underline underline-offset-4">
                    @pannipix
                  </a>
                  ), és szólok, ha újakat nyitok.
                </p>
              ) : (
                <div className="mt-6 space-y-7">
                  {days.map((day) => (
                    <fieldset key={day.key}>
                      <legend className="font-display text-[1.25rem]">{day.label}</legend>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {day.slots.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            aria-pressed={slot?.id === s.id}
                            aria-label={s.label}
                            onClick={() => {
                              setSlot(s);
                              setNotice(null);
                            }}
                            className="h-11 min-w-[5.5rem] rounded-[6px] bg-stencil px-4 font-display text-[1.0625rem] transition-[background-color,color,scale] duration-300 hover:bg-[#e3e3df] active:scale-[0.97] active:duration-75 aria-pressed:bg-ink aria-pressed:text-paper"
                          >
                            {s.time}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              )}

              <div className="mt-10 flex flex-col gap-5 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-[22rem] text-[0.875rem] leading-snug text-muted">
                  A foglalás nem vásárlás: most nem fizetsz semmit, a részleteket a visszaigazolásban egyeztetjük.
                </p>
                <button
                  type="button"
                  disabled={!slot}
                  onClick={() => setStep("details")}
                  className={`${btn.primary} shrink-0 disabled:opacity-40`}
                >
                  Tovább <Arrow />
                </button>
              </div>
            </section>

            {/* Stays mounted while the visitor goes back to change the time, so typed details survive. */}
            <form hidden={step !== "details"} onSubmit={submit} aria-labelledby="booking-details-step">
              <div className="flex items-center justify-between gap-4">
                <h3
                  id="booking-details-step"
                  ref={headings.details}
                  tabIndex={-1}
                  className="label text-muted focus:outline-none"
                >
                  2 · Adataid
                </h3>
                <button
                  type="button"
                  onClick={() => setStep("slot")}
                  className="label -mr-2 flex min-h-11 items-center gap-1.5 px-2 text-[0.6875rem] transition-opacity hover:opacity-60"
                >
                  <ChevronLeft size={15} /> Időpont
                </button>
              </div>
              <p className="mt-3 font-display text-[1.25rem]">{slot?.label}</p>

              <input type="hidden" name="designId" value={snapshot.id} />
              <input type="hidden" name="slotId" value={slot?.id ?? ""} />
              {/* Honeypot: hidden from people and screen readers, tempting to bots. */}
              <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
                <label>
                  Weboldal
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2">
                <TextField
                  label="Név"
                  name="name"
                  maxLength={100}
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  required
                  error={errors.name}
                />
                <TextField
                  label="E-mail"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  required
                  error={errors.email}
                />
                <TextField
                  label="Telefon"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  enterKeyHint="next"
                  required
                  error={errors.phone}
                />
                <div>
                  <label htmlFor={placementId} className="label text-[0.6875rem] text-muted">
                    Testtáj
                  </label>
                  <div className="relative">
                    <select
                      id={placementId}
                      name="placement"
                      required
                      defaultValue=""
                      aria-invalid={errors.placement ? true : undefined}
                      aria-describedby={errors.placement ? `${placementId}-error` : undefined}
                      className={`${field} cursor-pointer appearance-none pr-8`}
                    >
                      <option value="" disabled>
                        Válassz
                      </option>
                      {PLACEMENTS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute bottom-4 right-0 text-muted" />
                  </div>
                  <ErrorText id={`${placementId}-error`}>{errors.placement}</ErrorText>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={noteId} className="label text-[0.6875rem] text-muted">
                    Megjegyzés (nem kötelező)
                  </label>
                  <textarea
                    id={noteId}
                    name="note"
                    rows={3}
                    maxLength={1000}
                    placeholder="Pontos hely, méret, kérdés…"
                    aria-invalid={errors.note ? true : undefined}
                    aria-describedby={errors.note ? `${noteId}-error` : undefined}
                    className={`${field} resize-none leading-[1.6]`}
                  />
                  <ErrorText id={`${noteId}-error`}>{errors.note}</ErrorText>
                </div>
              </div>

              <label className="mt-8 flex min-h-11 cursor-pointer select-none items-center gap-3 text-[0.9375rem] text-graphite">
                <input
                  type="checkbox"
                  name="adult"
                  required
                  aria-invalid={errors.adult ? true : undefined}
                  aria-describedby={errors.adult ? "booking-adult-error" : undefined}
                  className="size-[1.125rem] cursor-pointer accent-ink"
                />
                Elmúltam 18 éves.
              </label>
              <ErrorText id="booking-adult-error">{errors.adult}</ErrorText>

              {formError && (
                <p role="alert" className="mt-6 border-l border-ink pl-4 text-[0.9375rem] leading-relaxed">
                  {formError}
                </p>
              )}

              <div className="mt-8 border-t border-hairline pt-6">
                <button
                  type="submit"
                  disabled={pending || !slot}
                  className={`${btn.primary} w-full justify-between disabled:opacity-60 sm:w-auto sm:min-w-[17rem]`}
                >
                  {pending ? "Küldés…" : "Foglalás elküldése"} <Arrow />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export function BookingDialog({ designs }: { designs: FlashDesign[] }) {
  const { bookingFor, closeBooking } = useStore();
  const design = designs.find((d) => d.id === bookingFor) ?? null;
  const ref = useRef<HTMLDialogElement>(null);

  // The store decides whether the native dialog is open; Esc and the close button report back via onClose.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (design && !dialog.open) dialog.showModal();
    if (!design && dialog.open) dialog.close();
  }, [design]);

  // A modal dialog doesn't stop the page behind it from scrolling on touch devices.
  useEffect(() => {
    if (!design) return;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [design]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="booking-title"
      onClose={closeBooking}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-paper p-0 text-ink backdrop:bg-ink/45 sm:m-auto sm:h-auto sm:max-h-[min(54rem,calc(100dvh-4rem))] sm:w-[min(42rem,calc(100vw-4rem))] sm:rounded-[6px]"
    >
      {design && <BookingFlow key={design.id} design={design} onClose={() => ref.current?.close()} />}
    </dialog>
  );
}
```

- [ ] **Step 2: Az ablak bekötése az oldalba (`app/(frontend)/page.tsx`)**

Az importok közé, a `Booking` import után:

```tsx
import { BookingDialog } from "@/components/booking-dialog";
```

A `<Footer />` sor után, a `</StoreProvider>` elé:

```tsx
      <BookingDialog designs={designs} />
```

- [ ] **Step 3: Lint és typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: nincs hiba. Ha a `react-hooks` szabálycsomag a `useEffect(loadSlots, [loadSlots])` sort jelöli (`set-state-in-effect`), írd át `useEffect(() => { loadSlots(); }, [loadSlots]);` formára. A setState itt egy Promise callbackben fut, nem szinkron.

- [ ] **Step 4: Commit**

```bash
git add components/booking-dialog.tsx "app/(frontend)/page.tsx"
git commit -m "$(cat <<'EOF'
feat: booking dialog with open slots, details form and confirmation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Szövegek: vásárlás helyett foglalás

**Files:**
- Modify: `components/process.tsx`
- Modify: `components/faq.tsx`
- Modify: `components/booking.tsx`
- Modify: `app/(frontend)/layout.tsx`

- [ ] **Step 1: `components/process.tsx`: a flash lépések**

A `steps` objektumban cseréld le a teljes `flash: [ ... ],` tömböt erre:

```tsx
  flash: [
    {
      title: "Választás",
      body: "Kiválasztod a mintát. Mindegyiknél látod az ajánlott méretet, a testtájakat és azt, hányszor foglalható még.",
    },
    {
      title: "Időpontfoglalás",
      body: "Kiválasztasz egy szabad időpontot, és elküldöd a foglalást. Most nem fizetsz semmit.",
    },
    {
      title: "Visszaigazolás",
      body: "Átnézem a foglalást, és e-mailben visszaigazolom. Ekkor egyeztetjük a pontos elhelyezést is.",
    },
    {
      title: "Tetoválás",
      body: "Elkészül a tetoválás. Az egyszeri minták ezután véglegesen archívumba kerülnek.",
    },
  ],
```

- [ ] **Step 2: `components/faq.tsx`: flash kérdések**

A `faqs` tömbben cseréld le a `"Mi történik a flash mintával, miután elkészült?"` elemet erre a kettőre:

```tsx
  {
    q: "Mi történik a flash mintával, miután elkészült?",
    a: "Ez a kollekción múlik. Az egyszeri minta egy alkalom után lekerül a kínálatból, a limitált mintát a megadott számú alkalommal tetoválom, a többi bármikor foglalható.",
  },
  {
    q: "Kell előre fizetnem a flash mintáért?",
    a: "Nem. Az online foglalás nem vásárlás: most nem fizetsz semmit, a részleteket a visszaigazolásban egyeztetjük.",
  },
```

- [ ] **Step 3: `components/booking.tsx`: a Kapcsolat űrlap csak egyedi tervre**

A teljes új tartalom:

```tsx
"use client";

import { useId, useState } from "react";
import { PLACEMENTS } from "@/lib/booking-input";
import { ChevronDown, Instagram, Mail } from "./icons";
import { Arrow, btn, container } from "./ui";

const field =
  "mt-1.5 block w-full border-0 border-b border-paper/25 bg-transparent pb-3 pt-2 text-[1.0625rem] text-paper placeholder:text-ash/60 transition-colors focus:border-paper focus:outline-none";

function Field({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label text-[0.6875rem] text-ash">
        {label}
      </label>
      <input id={id} className={field} {...props} />
    </div>
  );
}

export function Booking() {
  const [sent, setSent] = useState(false);
  const [placement, setPlacement] = useState("");
  const ideaId = useId();
  const placeId = useId();

  return (
    <section id="kapcsolat" data-nav="kapcsolat" aria-labelledby="booking-title-contact" className="bg-ink text-paper">
      <div className={`${container} grid gap-16 py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-24 lg:py-36`}>
        <div>
          <p className="label text-ash">Kapcsolat</p>
          <h2
            id="booking-title-contact"
            className="mt-5 font-display text-[clamp(2.75rem,5.6vw,5.25rem)] font-normal leading-[0.98] tracking-[-0.025em]"
          >
            Kezdjük a te <em>mintáddal.</em>
          </h2>
          <p className="mt-7 max-w-[25rem] leading-[1.7] text-ash">
            Írd le, mit szeretnél, és pár napon belül válaszolok. Flash mintára közvetlenül a mintánál tudsz
            időpontot foglalni.
          </p>
          <ul className="mt-12 space-y-1 border-t border-paper/15 pt-6">
            <li>
              <a href="https://instagram.com/pannipix" className="inline-flex items-center gap-3.5 py-2 hover:text-ash">
                <Instagram size={20} /> @pannipix
              </a>
            </li>
            <li>
              <a href="mailto:hello@pannipix.hu" className="inline-flex items-center gap-3.5 py-2 hover:text-ash">
                <Mail size={20} /> hello@pannipix.hu
              </a>
            </li>
          </ul>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="lg:pt-3"
        >
          <p className="label text-[0.6875rem] text-ash">Egyedi tetoválás</p>
          <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            <Field label="Név" name="name" autoComplete="name" autoCapitalize="words" enterKeyHint="next" required />
            <Field label="E-mail" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" required />

            <div className="sm:col-span-2">
              <label htmlFor={ideaId} className="label text-[0.6875rem] text-ash">
                Az ötleted
              </label>
              <textarea
                id={ideaId}
                name="idea"
                rows={3}
                placeholder="Mi foglalkoztat? Egy emlék, egy szimbólum, egy hangulat…"
                className={`${field} resize-none leading-[1.6]`}
              />
            </div>

            <div>
              <label htmlFor={placeId} className="label text-[0.6875rem] text-ash">
                Testtáj
              </label>
              <div className="relative">
                <select
                  id={placeId}
                  name="placement"
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value)}
                  className={`${field} cursor-pointer appearance-none pr-8 ${placement ? "" : "text-ash/60"}`}
                >
                  <option value="" disabled className="text-ink">
                    Válassz
                  </option>
                  {PLACEMENTS.map((p) => (
                    <option key={p.value} value={p.value} className="text-ink">
                      {p.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute bottom-4 right-0 text-ash" />
              </div>
            </div>
            <Field label="Méret (cm)" name="size" inputMode="numeric" enterKeyHint="done" placeholder="pl. 15" />
          </div>

          <label className="mt-8 flex min-h-11 cursor-pointer select-none items-center gap-3 text-[0.9375rem] text-ash">
            <input type="checkbox" required className="size-[1.125rem] cursor-pointer accent-paper" />
            Elmúltam 18 éves.
          </label>

          <div className="mt-12 flex flex-col gap-6 sm:flex-row sm:items-center">
            <button type="submit" className={`${btn.light} sm:min-w-[17rem] sm:justify-between`}>
              Jelentkezés elküldése <Arrow />
            </button>
            <p role="status" className="max-w-[20rem] text-[0.9375rem] leading-snug text-ash">
              {sent && "Az online jelentkezés hamarosan elérhető. Addig írj Instagramon: @pannipix."}
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
```

(A szekció címének `id`-ja `booking-title-contact` lett, mert a foglalási ablak címe a `booking-title` azonosítót kapta. Két egyforma `id` megtörné az `aria-labelledby`-t.)

- [ ] **Step 4: `app/(frontend)/layout.tsx`: meta leírás**

A `description` értékét cseréld erre:

```tsx
    "Konceptuális, absztrakt és mikrorealista tetoválások. Egyedi tervezés, vagy időpontra foglalható flash minták a PANNIPIX kollekciókból.",
```

- [ ] **Step 5: Lint, typecheck, tesztek**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: minden zöld.

- [ ] **Step 6: Commit**

```bash
git add components "app/(frontend)/layout.tsx"
git commit -m "$(cat <<'EOF'
copy: describe flash as booking, not buying

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Seed

**Files:**
- Create: `scripts/seed.ts`

- [ ] **Step 1: `scripts/seed.ts`**

```ts
import path from "node:path";
import config from "@payload-config";
import { getPayload } from "payload";
import { dayKey, zonedTimeToUtc } from "@/lib/time";

const payload = await getPayload({ config });

if ((await payload.count({ collection: "categories" })).totalDocs > 0) {
  payload.logger.info("Seed skipped: the database already has collections.");
  process.exit(0);
}

// Placeholder rules. Set the real ones in the admin.
const pcons = await payload.create({ collection: "categories", data: { name: "P’CONs", rule: "single", order: 1 } });
await payload.create({ collection: "categories", data: { name: "ORNX", rule: "limited", limit: 3, order: 2 } });
await payload.create({ collection: "categories", data: { name: "daddywillhateus", rule: "unlimited", order: 3 } });

async function upload(file: string, alt: string) {
  const media = await payload.create({
    collection: "media",
    data: { alt },
    filePath: path.resolve("public/flash", file),
  });
  return media.id;
}

type Placeholder = {
  number: string;
  price: number;
  size: string;
  placements: string;
  description: string;
  badge?: "new" | "last";
  images: { file: string; alt: string; kind: "art" | "photo"; label: string }[];
};

// Cropped from the reference mockups. Oldest first, so "Legújabb" sorts like the numbers.
const placeholders: Placeholder[] = [
  {
    number: "020",
    price: 110000,
    size: "15–18 cm",
    placements: "alkar, comb, felkar",
    description: "Szétcsúszó arc, függőleges vonalakra bontva.",
    images: [{ file: "pcons-020.webp", alt: "P’CONs #020 – függőleges vonalakra bomló arc", kind: "art", label: "Minta" }],
  },
  {
    number: "021",
    price: 90000,
    size: "14–18 cm",
    placements: "alkar, comb, oldal",
    description: "Orchideák körök metszéspontjában, finom vonalas kerettel.",
    images: [{ file: "pcons-021.webp", alt: "P’CONs #021 – orchideák körök metszéspontjában", kind: "art", label: "Minta" }],
  },
  {
    number: "022",
    price: 90000,
    size: "12–15 cm",
    placements: "alkar, gerinc, lábszár",
    description: "Holdkorong egyetlen függőleges vonalon. A kollekció legletisztultabb darabja.",
    badge: "new",
    images: [{ file: "pcons-022.webp", alt: "P’CONs #022 – holdkorong egy függőleges vonalon", kind: "art", label: "Minta" }],
  },
  {
    number: "023",
    price: 100000,
    size: "15–19 cm",
    placements: "comb, oldal, felkar",
    description: "Két koi egymás körül, kör alakú pályán: a mozgás és az egyensúly mintája.",
    images: [{ file: "pcons-023.webp", alt: "P’CONs #023 – két koi hal körpályán", kind: "art", label: "Minta" }],
  },
  {
    number: "024",
    price: 110000,
    size: "16–20 cm",
    placements: "alkar, comb, oldal",
    description: "Lehunyt szemű arc pillangók és virágok között. A kompozíciót körök és függőleges vonalak rendezik.",
    images: [{ file: "pcons-024.webp", alt: "P’CONs #024 – női arc pillangókkal és virágokkal", kind: "art", label: "Minta" }],
  },
  {
    number: "025",
    price: 90000,
    size: "14–17 cm",
    placements: "alkar, lábszár, gerinc",
    description: "Szimmetrikus orchideakompozíció éles, lefelé futó vonalakkal — tükörtengelyre épített minta.",
    images: [{ file: "pcons-025.webp", alt: "P’CONs #025 – szimmetrikus orchideák függőleges tengelyen", kind: "art", label: "Minta" }],
  },
  {
    number: "026",
    price: 120000,
    size: "18–22 cm",
    placements: "comb, oldal, hát",
    description: "Tengely köré tekeredő kígyó füstszerű árnyalással és geometriai körökkel.",
    badge: "last",
    images: [{ file: "pcons-026.webp", alt: "P’CONs #026 – tengely köré tekeredő kígyó", kind: "art", label: "Minta" }],
  },
  {
    number: "027",
    price: 90000,
    size: "15–18 cm",
    placements: "kar, comb, hát, oldal",
    description:
      "Szitakötő és robotkéz egy függőleges tengely két oldalán: a természetes és az épített világ találkozása, bolygókkal és körpályákkal keretezve.",
    badge: "new",
    images: [
      { file: "pcons-027-large.webp", alt: "P’CONs #027 – szitakötő és robotkéz egy függőleges sáv két oldalán", kind: "art", label: "Minta" },
      { file: "pcons-027-skin.webp", alt: "P’CONs #027 elkészült tetoválásként lábszáron", kind: "photo", label: "Bőrön" },
      { file: "pcons-027-detail.webp", alt: "P’CONs #027 részlet: a szitakötő", kind: "photo", label: "Részlet" },
    ],
  },
];

const designIds = new Map<string, number>();
for (const p of placeholders) {
  const images = [];
  for (const img of p.images) images.push({ image: await upload(img.file, img.alt), kind: img.kind, label: img.label });
  const design = await payload.create({
    collection: "designs",
    data: {
      category: pcons.id,
      number: p.number,
      price: p.price,
      size: p.size,
      placements: p.placements,
      description: p.description,
      badge: p.badge,
      images,
    },
  });
  designIds.set(p.number, design.id);
}

// Open slots: Tuesdays and Thursdays at 10:00 and 15:00 over the next three weeks. Calendar arithmetic
// on Budapest's date, so a summer-time change can't skip or repeat a day.
const today = dayKey(new Date());
let opened = 0;
for (let offset = 1; offset <= 21; offset += 1) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  const day = date.toISOString().slice(0, 10);
  const weekday = date.getUTCDay();
  if (weekday !== 2 && weekday !== 4) continue;
  for (const time of ["10:00", "15:00"]) {
    await payload.create({ collection: "slots", data: { startsAt: zonedTimeToUtc(day, time) } });
    opened += 1;
  }
}

// #021 is already on skin: a completed booking on a past slot keeps it sold out.
const past = await payload.create({
  collection: "slots",
  data: { startsAt: zonedTimeToUtc(dayKey(new Date(Date.now() - 30 * 86_400_000)), "10:00") },
});
const soldId = designIds.get("021");
if (soldId) {
  await payload.create({
    collection: "bookings",
    data: {
      design: soldId,
      slot: past.id,
      status: "completed",
      name: "Archív foglalás",
      email: "hello@pannipix.hu",
      phone: "+36 00 000 0000",
      placement: "alkar",
      adultConfirmed: true,
    },
  });
}

payload.logger.info(`Seed done: 3 collections, ${placeholders.length} designs, ${opened} open slots.`);
process.exit(0);
```

- [ ] **Step 2: Futtatás tiszta adatbázison**

```bash
rm -rf .data && npm run seed
sqlite3 .data/pannipix.db "select count(*) from categories; select count(*) from designs; select count(*) from slots; select status from bookings;"
```

Expected: a napló végén `Seed done: 3 collections, 8 designs, 12 open slots.` (a nyitott időpontok száma 12 körül mozog, a héten belüli naptól függően). Az SQL kimenete: `3`, `8`, a nyitott időpontok száma + 1, majd `completed`.

- [ ] **Step 3: A seed második futtatása kihagyja az üres adatbázisra szánt feltöltést**

```bash
npm run seed 2>&1 | grep "Seed skipped"
```

Expected: `Seed skipped: the database already has collections.`

- [ ] **Step 4: Typecheck, commit**

```bash
npm run typecheck
git add scripts/seed.ts
git commit -m "$(cat <<'EOF'
feat: seed script with the placeholder designs and open slots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Első migráció és éles indítás

**Files:**
- Create: `migrations/*` (generált)
- Modify: `payload.config.ts`

- [ ] **Step 1: A kezdő migráció generálása**

```bash
npm run payload migrate:create initial
ls migrations
```

Expected: `index.ts`, valamint egy `<időbélyeg>_initial.ts` és egy `<időbélyeg>_initial.json`. Ha a parancs megerősítést kér, válaszolj igennel. Nézd át a `.ts` fájlt: szerepeljen benne a `bookings`, `slots`, `designs`, `categories`, `media`, `users` tábla, a `bookings_slot_idx` UNIQUE index és a `design`+`seat` összetett UNIQUE index.

- [ ] **Step 2: `prodMigrations` bekötése**

A `payload.config.ts` importjai közé:

```ts
import { migrations } from "./migrations";
```

A `sqliteAdapter({...})` hívásba a `busyTimeout: 5000,` után:

```ts
    // On a long-running server (Hostinger) pending migrations run once, when Payload starts.
    prodMigrations: migrations,
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: sikeres build. A `/` útvonal a listában dinamikus (`ƒ`), nem statikus.

- [ ] **Step 4: Éles indítás friss adatbázison (a migráció próbája)**

```bash
set -m
DATABASE_URL=file:./.data/prod-check.db MEDIA_DIR=./.data/prod-check-media node_modules/.bin/next start --port 3211 > /tmp/pannipix-prod.log 2>&1 &
PID=$!
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:3211/ && break; sleep 1; done
curl -s -o /dev/null -w "front %{http_code}\n" http://localhost:3211/
curl -s -L -o /dev/null -w "admin %{http_code}\n" http://localhost:3211/admin
sqlite3 .data/prod-check.db ".tables"
kill -TERM -- -"$PID"
rm -rf .data/prod-check.db* .data/prod-check-media
```

Expected: `front 200`, `admin 200`. A táblák között szerepel a `bookings`, `slots`, `designs`, `categories` és a `payload_migrations`. A friss adatbázisban nincs minta, ezért az oldal flash szekciója az üres állapotot mutatja. Ez rendben van.

- [ ] **Step 5: Tesztek, commit**

```bash
npm test
git add migrations payload.config.ts
git commit -m "$(cat <<'EOF'
feat: initial migration, run on production start

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: README

**Files:**
- Modify: `README.md` (teljes csere)

- [ ] **Step 1: `README.md`**

````markdown
# PANNIPIX

Tetoválás-portfólió és flash minta időpontfoglalás. Next.js 16 + Payload CMS 3 (SQLite).

## Fejlesztés

1. `npm install`
2. `cp .env.example .env`, majd a `PAYLOAD_SECRET` mögé írj egy hosszú véletlen szöveget (`openssl rand -hex 32`).
3. `npm run seed`: üres adatbázisba feltölti a három kollekciót, a helyőrző mintákat és pár szabad időpontot.
4. `npm run dev`
   - oldal: http://localhost:3000
   - admin: http://localhost:3000/admin (első alkalommal itt hozod létre az admin fiókot)

Az adatbázis és a feltöltött képek a `.data/` mappában vannak, ez nincs verziókezelve. Újrakezdés: `rm -rf .data && npm run seed`.

SMTP beállítás nélkül a levelek nem mennek ki, hanem a szerver konzoljára íródnak.

## Parancsok

| Parancs | Mire való |
|---|---|
| `npm run dev` | fejlesztői szerver |
| `npm test` | egység- és integrációs tesztek; minden tesztfájl saját, ideiglenes SQLite adatbázist kap |
| `npm run lint`, `npm run typecheck` | statikus ellenőrzés |
| `npm run generate:types` | a `payload-types.ts` újragenerálása a Payload konfigurációból |
| `npm run payload migrate:create <név>` | migráció a sémaváltozásokról, élesítés előtt kötelező |
| `npm run seed` | demó adatok üres adatbázisba |

## Hogyan működik a foglalás

- **Kollekció:** a szabálya dönti el, hányszor foglalható egy-egy mintája: *Egyszeri* (1), *Limitált* (x) vagy *Korlátlan*.
- **Időpontok:** egy közös naptár. Bármelyik minta bármelyik szabad időpontra foglalható, és egy időpontra egy foglalás jut. A *Lejárt* állapotú, szabad időpontokat érdemes időnként törölni, mert az admin időpont-választójában a jövőbeliek elé kerülnek.
- **Foglalás:** beküldéskor azonnal leköti az időpontot és a minta egy alkalmát, állapota *Függőben*. Az admin jóváhagyja vagy elutasítja. *Elutasítva* és *Lemondva* állapotban az időpont és az alkalom újra szabad.
- **Dupla foglalás:** két egyedi index (`slot`, illetve `design + seat`) zárja ki, akkor is, ha ketten egyszerre kattintanak.
- **E-mailek:** az admin minden webes foglalásról levelet kap. Az ügyfél a beérkezésről, a jóváhagyásról, az elutasításról és a lemondásról kap levelet.

## Élesítés (Hostinger, Node.js alkalmazás)

0. Node.js verzió: 22 (a hPanelben kiválasztva). Az oldal 20.9 felett is fut, a tesztekhez viszont legalább 22.12 kell. A magyar dátumokhoz teljes ICU kell; a hivatalos Node buildek ilyenek. Ellenőrzés: `node -p "new Intl.DateTimeFormat('hu-HU').resolvedOptions().locale"` → `hu-HU`.
1. Környezeti változók: az `.env.example` összes kulcsa. A `DATABASE_URL` és a `MEDIA_DIR` a **deploy mappán kívüli**, írható könyvtárra mutasson, például:
   - `DATABASE_URL=file:/home/<felhasználó>/pannipix-data/pannipix.db`
   - `MEDIA_DIR=/home/<felhasználó>/pannipix-data/media`
   A WAL mód miatt a könyvtárnak is írhatónak kell lennie (`-wal`, `-shm` fájlok).
   Élesben mindkettő kötelező. Ha bármelyik hiányzik, az admin és az API szándékosan 500-as hibát ad, hogy semmi ne kerülhessen a deploy mappába.
2. Build: `npm run build`, indítás: `npm start`. Induláskor a Payload lefuttatja a még nem futtatott migrációkat. Ha a build memóriahiány miatt leáll: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`.
3. **HTTPS:** az admin bejelentkezéshez kell, mert a munkamenet-süti élesben csak HTTPS-en él. Kapcsold be az SSL-t a domainhez.
4. Első indítás után: `/admin` → admin fiók → kollekciók, minták és időpontok felvétele.
   Ezután próbáld ki élőben is:
   - Foglalj egy időpontot az oldalon.
   - Egy eszközről 4 gyors foglalás: a 4. elutasítva.
   - Egy másik hálózatról (pl. mobilnetről) még lehet foglalni.

   - A próbához legalább 4 szabad időpont és egy korlátlan vagy legalább 4 alkalmas minta kell. Utána töröld a próbafoglalásokat az adminban.

   Ha a 4. foglalás is átmegy, vagy a másik hálózatról sem lehet foglalni, állítsd át a `TRUSTED_PROXY_HOPS`-t: a Hostinger CDN bekapcsolásával 2. Ha sem 1-gyel, sem 2-vel nem utasítja el a 4. foglalást, a tárhely nem adja át a látogató címét. Ilyenkor a korlát nem működik, és csak a csapdamező véd; ha ez kevés, jöhet egy Cloudflare Turnstile.

   Ha már az első éles foglalás „Invalid Server Actions request” hibával bukik el, a proxy más hosztnevet ad át: a domaint fel kell venni az `experimental.serverActions.allowedOrigins` listába a `next.config.ts`-ben.
5. **Mentés:** a `pannipix-data` mappát (adatbázis + képek) rendszeresen menteni kell.

Feltételezés: egyetlen Node processz fut. A foglalási korlát (IP-nként óránként 3) a memóriában számol.

## Sémaváltozás

1. Módosítsd a gyűjteményt a `cms/collections/` mappában.
2. `npm run generate:types`
3. `npm run payload migrate:create <rövid-név>`, majd nézd át a generált fájlt.
4. Commit. Élesben a következő indításkor lefut.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: setup, booking rules and Hostinger deployment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Végső ellenőrzés

- [ ] **Step 1: Teljes automatikus ellenőrzés**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: minden zöld, a tesztösszesítőben 0 failed.

- [ ] **Step 2: Böngészős végigjátszás** (a `run` skill segítségével, vagy kézzel)

Előkészítés: `rm -rf .data && npm run seed`, majd a dev szerver a 3210-es porton, saját folyamatcsoportban (lásd Task 2, Step 9). Az URL-ek: `http://localhost:3210/` és `http://localhost:3210/admin`. A végén csak ezt a folyamatcsoportot állítsd le.

Admin, asztali nézet (1280 px):
1. `/admin` → admin fiók létrehozása → a menüben a *Foglalás* (Foglalások, Időpontok), a *Flash* (Flash minták, Kollekciók, Képek) és a *Beállítások* (Adminok) csoport látszik, magyarul.
2. *Kollekciók* → ORNX → a *Foglalhatóság* *Limitált*, az *Alkalmak száma* mező látszik. *Egyszeri*-re váltva a mező eltűnik.
3. *Időpontok* → új időpont holnapra 11:00-ra → a listában a címe `ÉÉÉÉ. HH. NN. (nap) 11:00`, az állapota *Szabad*.
4. *Flash minták* → P’CONs #021 törlése → hibaüzenet, mert foglalás tartozik hozzá.

Oldal (1280 px és 390 px széles nézet):
5. A Flash szekcióban 8 minta látszik. A #021 „Elkelt” címkét kapott, ára helyén „Lefoglalva” áll, naptár gomb nincs rajta.
6. Naptár gomb a #027-en → megnyílik az ablak. Mobilon teljes képernyős, asztalin középre igazított. Az időpontok napok szerint csoportosítva jelennek meg.
7. Időpont kiválasztása → *Tovább* → hibás e-mail (`anna@`) → a mező alatt magyar hibaüzenet jelenik meg, a beírt adatok megmaradnak.
8. Helyes adatok → *Foglalás elküldése* → „Megkaptam a foglalásod.” Bezárás után a #027 kártyáján „Elkelt” áll (P’CONs = egyszeri).
9. A dev szerver konzoljában két `Email attempted without being configured` sor van: egy az `ADMIN_EMAIL`-re, egy az ügyfélre.
10. Adminban a foglalás *Függőben* → *Elutasítva* → a konzolban újabb e-mail sor jelenik meg. Az oldalt frissítve a #027 újra foglalható.
11. Esc és a háttérre kattintás bezárja az ablakot. Tab-bal az ablakon belül lehet lépkedni.

Expected: minden lépés a leírt módon működik. Ha bármelyik eltér, az eltérést a `superpowers:systematic-debugging` skill szerint kell kivizsgálni.

- [ ] **Step 3: Záró commit (ha a QA során javítás kellett)**

```bash
git status --short
```

Ha van változás: commit egy, a javítást leíró üzenettel és a `Co-Authored-By` sorral.
