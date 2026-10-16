# Admin nyitó oldal: foglalási dashboard — implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az `/admin` nyitó oldalán hat foglalási widget mutatja, melyik flash mintát foglalták le, mi vár jóváhagyásra vagy időpontra, és mi a következő időpont; a widgeteket az admin a Payload saját szerkesztő módjában rakhatja be és veheti ki.

**Architecture:** A Payload 3.90.2 beépített (kísérleti) widgetes dashboardjára épül: a `cms/dashboard/widgets.ts` regisztrálja a widgeteket és az alapelrendezést az `admin.dashboard` alatt. A widgetek aszinkron szerverkomponensek; az adatot a `cms/dashboard/data.ts` kéri le a Local API-n a bejelentkezett admin `req`-jével, a szűrés, a címkék és a linkek tiszta függvények a `lib/dashboard.ts`-ben. A kinézet a Payload UI elemeiből (`Pill`, `Thumbnail`, `Banner`) és egy CSS Module-ból áll, a Payload témaváltozóival.

**Tech Stack:** Payload 3.90.2 (`payload`, `@payloadcms/next`, `@payloadcms/ui`, `@payloadcms/translations`), Next 16.3.8, React 19.2.8, SQLite, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-16-admin-dashboard-design.md`

> A terv kódját egy elkülönített másolaton végigpróbáltam (2026-10-16): a teljes tesztcsomag, a `tsc` és az ESLint hibátlan, és `next dev` alatt az admin nyitó oldala világos, sötét és telefonos nézetben is helyesen rajzolta ki a widgeteket. A linkek szűrését a REST API-n is ellenőriztem.

---

## Fontos tudnivalók a végrehajtónak

- **AGENTS.md:** ez a Next verzió eltér a megszokottól. Kétség esetén olvasd a `node_modules/next/dist/docs/` megfelelő fejezetét (a CSS Module-okról: `01-app/01-getting-started/11-css.md`).
- **Előfeltétel:** a 0. feladat. Amíg a munkafában nem commitolt változás van azokban a fájlokban, amelyekhez ez a terv hozzányúl, ne kezdj bele: a feladatok commitjai magukkal vinnék a felhasználó más munkáját.
- **Futó dev szerver:** a felhasználó `next dev`-je gyakran fut a repóban (3000-es port). Menet közben újratölt, és a config változásakor maga is újragenerálja az import mapot és a típusokat. Sémaváltozás nincs, így nem kérdez a terminálban. Ne indíts második `next dev`-et a repóban; a kézi próbát elkülönített másolaton végezd (8. feladat).
- **Fejlesztői adatbázis:** ne hozz létre foglalást a `.data/` adatbázisban. Ha a `.env`-ben van SMTP, valódi e-mail menne ki. A tesztek saját, ideiglenes adatbázist használnak (`tests/setup.ts`).
- **Kísérleti API:** az `admin.dashboard` opciót a Payload 3.90.2 kísérletinek jelöli. Csomagot ne frissíts.
- **Tesztparancsok:** egy fájl: `npx vitest run <fájl>`; minden: `npm test`; típusok: `npm run typecheck` (ha a `next typegen` a futó dev szerver miatt panaszkodik, `npx tsc --noEmit`); lint: `npm run lint`.
- **Stílus:** a felhasználói szöveg magyar, a kód és a kommentek angolok, ahogy a repóban máshol. A sorok 120 oszlop körül törnek.
- **Commit üzenetek** végére mindig kerüljön oda: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Fájlok

| Fájl | Mi változik |
|---|---|
| `lib/booking-rules.ts` | + `countActiveByDesign()`: mintánként az aktív foglalások száma |
| `lib/flash.ts` | a saját számláló ciklusa helyett `countActiveByDesign()` |
| `lib/time.ts` | + `formatReceivedAt()`: „ma 14:32”, „tegnap 19:05”, „okt. 13.” |
| `lib/dashboard.ts` | új: a négy lista leírása (`BOOKING_VIEWS`), `rankBookedDesigns`, `bookedLabel`, admin linkek |
| `cms/dashboard/data.ts` | új: Local API lekérdezések, `loadSafely` |
| `cms/dashboard/parts.tsx` | új: közös darabok (keret, állapot, mintakép, hiba, üres állapot) |
| `cms/dashboard/Overview.tsx` | új: Áttekintés widget |
| `cms/dashboard/BookingList.tsx` | új: a négy foglaláslista widget |
| `cms/dashboard/BookedDesigns.tsx` | új: Lefoglalt minták widget |
| `cms/dashboard/dashboard.module.css` | új: a widgetek stílusa |
| `cms/dashboard/widgets.ts` | új: regisztráció, alapelrendezés, a „Gyűjtemények” címke |
| `cms/dashboard/translations.ts` | új: a Payload magyar dashboard-szövegeinek felülírása |
| `payload.config.ts` | `admin.dashboard`, `i18n.translations`, `.then(labelPayloadWidgets)` |
| `app/(payload)/admin/importMap.js` | újragenerálva |
| `payload-types.ts` | újragenerálva (6 új widget típus) |
| `tests/helpers.ts` | a `createBooking` időpont nélkül is foglal (`slot: null`) |
| `tests/unit/booking-rules.test.ts`, `tests/unit/time.test.ts` | új esetek |
| `tests/unit/dashboard.test.ts`, `tests/int/dashboard.test.ts`, `tests/int/dashboard-config.test.ts` | új tesztek |
| `README.md` | új szakasz: Az admin nyitó oldala |

---

## Task 0: Előfeltétel — tiszta munkafa

**Files:** nincs változás.

- [ ] **Step 1: Nézd meg a munkafát**

Run: `git status --short`

Ha a lista üres, vagy egyik sora sem érinti ezeket a fájlokat, mehetsz az 1. feladatra: `lib/booking-rules.ts`, `lib/flash.ts`, `lib/time.ts`, `payload.config.ts`, `payload-types.ts`, `app/(payload)/admin/importMap.js`, `tests/helpers.ts`, `tests/unit/booking-rules.test.ts`, `tests/unit/time.test.ts`, `README.md`.

- [ ] **Step 2: Ha érinti, állj meg és kérdezz**

A terv írásakor (2026-10-16) a munkafában sok, nem commitolt változás volt, köztük ezek közül hét fájlban. Ezek a felhasználó korábbi munkái. Kérd meg, hogy commitolja őket (vagy adjon engedélyt, hogy egy általa jóváhagyott üzenettel commitold), és csak utána folytasd. Saját döntésből ne commitold, ne stash-eld és ne dobd el őket.

- [ ] **Step 3: Alapállapot**

Run: `npm test`
Expected: minden teszt zöld. Ha nem, jelezd a felhasználónak, mielőtt bármit változtatsz.

---

## Task 1: Mintánkénti aktív foglalások számlálása

Az oldal „Elkelt” címkéje és a dashboard ugyanazzal a függvénnyel számoljon.

**Files:**
- Modify: `lib/booking-rules.ts` (a fájl végére)
- Modify: `lib/flash.ts:5` (import) és `lib/flash.ts:21-36` (`getFlashCatalog`)
- Test: `tests/unit/booking-rules.test.ts`

- [ ] **Step 1: Írd meg a bukó tesztet**

`tests/unit/booking-rules.test.ts` importlistájába, az `availability,` sor után:

```ts
  countActiveByDesign,
```

A fájl végére:

```ts
describe("countActiveByDesign", () => {
  it("counts each design's active bookings", () => {
    const counts = countActiveByDesign([
      { design: 1, status: "pending" },
      { design: 1, status: "completed" },
      { design: 2, status: "confirmed" },
    ]);
    expect(counts).toEqual(
      new Map([
        [1, 2],
        [2, 1],
      ]),
    );
  });

  it("skips released bookings and bookings without a usable design", () => {
    const counts = countActiveByDesign([
      { design: 1, status: "rejected" },
      { design: 1, status: "cancelled" },
      { design: null, status: "pending" },
      { design: { id: 3 }, status: "pending" },
    ]);
    expect(counts).toEqual(new Map([[3, 1]]));
  });
});
```

- [ ] **Step 2: Futtasd, hogy lásd elbukni**

Run: `npx vitest run tests/unit/booking-rules.test.ts`
Expected: FAIL — `TypeError: countActiveByDesign is not a function`

- [ ] **Step 3: Írd meg a függvényt**

`lib/booking-rules.ts` végére, a `relationId` után:

```ts
/**
 * How many active bookings each design has, by design id. Released bookings and ones without a usable design don't
 * count, so a caller may pass every booking or only the active ones; `status` is required so it can't be left out.
 */
export function countActiveByDesign(bookings: Iterable<{ design?: unknown; status: string | null | undefined }>) {
  const counts = new Map<number, number>();
  for (const { design, status } of bookings) {
    const id = relationId(design);
    if (id !== null && isActiveStatus(status)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
```

- [ ] **Step 4: Futtasd, hogy lásd átmenni**

Run: `npx vitest run tests/unit/booking-rules.test.ts`
Expected: PASS

- [ ] **Step 5: Az oldal is ezt használja**

`lib/flash.ts` 5. sora:

```ts
import { ACTIVE_STATUSES, availability, countActiveByDesign, relationId } from "./booking-rules";
```

A `getFlashCatalog` második lekérdezése és a számlálás. Ezt:

```ts
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

  return designs.docs.flatMap((d) => toFlashDesign(d, counts.get(d.id) ?? 0) ?? []);
```

cseréld erre:

```ts
      select: { design: true, status: true },
      depth: 0,
      pagination: false,
    }),
  ]);

  const counts = countActiveByDesign(active.docs);
  return designs.docs.flatMap((d) => toFlashDesign(d, counts.get(d.id) ?? 0) ?? []);
```

A `relationId` import marad: a `listOpenSlots` használja.

- [ ] **Step 6: Az oldal tesztjei is zöldek**

Run: `npx vitest run tests/unit/booking-rules.test.ts tests/int/flash-data.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/booking-rules.ts lib/flash.ts tests/unit/booking-rules.test.ts
git commit -m "$(cat <<'EOF'
refactor: count active bookings per design in one shared helper

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: A beérkezés dátuma

**Files:**
- Modify: `lib/time.ts` (a `formatSlotTitle` után, a 37. sor körül)
- Test: `tests/unit/time.test.ts`

- [ ] **Step 1: Írd meg a bukó tesztet**

`tests/unit/time.test.ts` importlistájába, a `dayKey,` sor után:

```ts
  formatReceivedAt,
```

A fájl végére (az `OCT_15_00_30` konstans a fájl elején van már):

```ts
describe("formatReceivedAt", () => {
  it("says today and yesterday by Budapest days, with the time", () => {
    // Now is 00:30 on 15 October in Budapest, still the 14th in UTC.
    expect(formatReceivedAt("2026-10-14T22:10:00.000Z", OCT_15_00_30)).toBe("ma 00:10");
    expect(formatReceivedAt("2026-10-14T21:50:00.000Z", OCT_15_00_30)).toBe("tegnap 23:50");
  });

  it("gives an older booking's date, with the year when it is from another year", () => {
    expect(formatReceivedAt("2026-10-13T08:00:00.000Z", OCT_15_00_30)).toBe("okt. 13.");
    expect(formatReceivedAt("2025-10-13T08:00:00.000Z", OCT_15_00_30)).toBe("2025. okt. 13.");
  });

  it("finds yesterday across a month, a year and the autumn clock change", () => {
    expect(formatReceivedAt("2026-02-28T12:00:00.000Z", "2026-03-01T12:00:00.000Z")).toBe("tegnap 13:00");
    expect(formatReceivedAt("2025-12-31T12:00:00.000Z", "2026-01-01T12:00:00.000Z")).toBe("tegnap 13:00");
    // 00:10 on 25 October (summer time), seen at 00:30 on the 26th (winter time): 25 hours apart, yet yesterday.
    expect(formatReceivedAt("2026-10-24T22:10:00.000Z", "2026-10-25T23:30:00.000Z")).toBe("tegnap 00:10");
  });
});
```

- [ ] **Step 2: Futtasd, hogy lásd elbukni**

Run: `npx vitest run tests/unit/time.test.ts`
Expected: FAIL — `TypeError: formatReceivedAt is not a function`

- [ ] **Step 3: Írd meg a függvényt**

`lib/time.ts`, közvetlenül a `formatSlotTitle` függvény után:

```ts
const shortDateFormat = hu({ month: "short", day: "numeric" });
const shortDateWithYearFormat = hu({ year: "numeric", month: "short", day: "numeric" });

/**
 * The calendar day before a day key: "2026-03-01" → "2026-02-28". A day key has no time of day, so a clock change
 * can't shift it.
 */
function previousDayKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/**
 * When a booking came in, as the admin dashboard says it: "ma 14:32", "tegnap 19:05", "okt. 13.", or "2025. okt. 13."
 * from another year. Today and yesterday are Budapest days. `now` comes in so one page renders one moment.
 */
export function formatReceivedAt(value: DateInput, now: DateInput) {
  const day = dayKey(value);
  const today = dayKey(now);
  if (day === today) return `ma ${formatSlotTime(value)}`;
  if (day === previousDayKey(today)) return `tegnap ${formatSlotTime(value)}`;
  const format = day.slice(0, 4) === today.slice(0, 4) ? shortDateFormat : shortDateWithYearFormat;
  return format.format(toDate(value));
}
```

- [ ] **Step 4: Futtasd, hogy lásd átmenni**

Run: `npx vitest run tests/unit/time.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/time.ts tests/unit/time.test.ts
git commit -m "$(cat <<'EOF'
feat: dashboard date for when a booking came in

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: A dashboard tiszta függvényei

A négy lista szűrése, rendezése és szövegei, a lefoglalt minták sorrendje és címkéje, és az admin linkek. Itt nincs Payload-hívás, minden egységtesztelhető.

**Files:**
- Create: `lib/dashboard.ts`
- Test: `tests/unit/dashboard.test.ts`

- [ ] **Step 1: Írd meg a bukó tesztet**

`tests/unit/dashboard.test.ts`:

```ts
import * as qs from "qs-esm";
import { describe, expect, it } from "vitest";
import { availability } from "@/lib/booking-rules";
import {
  BOOKING_VIEWS,
  adminListUrl,
  bookedLabel,
  bookingUrl,
  designBookingsUrl,
  designsUrl,
  rankBookedDesigns,
  viewListUrl,
} from "@/lib/dashboard";

// 12:00 on Friday 16 October 2026 in Budapest (summer time, UTC+2).
const NOW = new Date("2026-10-16T10:00:00.000Z");

describe("BOOKING_VIEWS", () => {
  it("lists pending bookings, oldest first", () => {
    expect(BOOKING_VIEWS.pending.where(NOW)).toEqual({ status: { equals: "pending" } });
    expect(BOOKING_VIEWS.pending.sort).toBe("createdAt");
  });

  it("lists confirmed bookings without a slot, oldest first", () => {
    expect(BOOKING_VIEWS.unscheduled.where(NOW)).toEqual({
      and: [{ status: { equals: "confirmed" } }, { slot: { exists: false } }],
    });
    expect(BOOKING_VIEWS.unscheduled.sort).toBe("createdAt");
  });

  it("lists pending and confirmed bookings whose slot is still ahead, soonest first", () => {
    expect(BOOKING_VIEWS.upcoming.where(NOW)).toEqual({
      and: [
        { status: { in: ["pending", "confirmed"] } },
        { slotStartsAt: { greater_than: "2026-10-16T10:00:00.000Z" } },
      ],
    });
    expect(BOOKING_VIEWS.upcoming.sort).toBe("slotStartsAt");
  });

  it("lists every booking, newest first", () => {
    expect(BOOKING_VIEWS.recent.where(NOW)).toEqual({});
    expect(BOOKING_VIEWS.recent.sort).toBe("-createdAt");
  });

  it("dates a row by when it came in, or by its slot on the upcoming list", () => {
    // In at 19:05 on Thursday; booked for 10:00 on Tuesday 20 October.
    const booking = { createdAt: "2026-10-15T17:05:00.000Z", slotStartsAt: "2026-10-20T08:00:00.000Z" };
    expect(BOOKING_VIEWS.pending.when(booking, NOW)).toBe("beérkezett tegnap 19:05");
    expect(BOOKING_VIEWS.unscheduled.when(booking, NOW)).toBe("beérkezett tegnap 19:05");
    expect(BOOKING_VIEWS.recent.when(booking, NOW)).toBe("tegnap 19:05");
    expect(BOOKING_VIEWS.upcoming.when(booking, NOW)).toBe("okt. 20., kedd 10:00");
  });

  it("has a heading and an empty-state line for every list", () => {
    for (const view of Object.values(BOOKING_VIEWS)) {
      expect(view.title).not.toBe("");
      expect(view.empty).not.toBe("");
    }
  });
});

describe("bookedLabel", () => {
  const label = (rule: Parameters<typeof availability>[0], active: number) =>
    bookedLabel(availability(rule, active), active);

  it("marks a full design as sold out, with its bookings and its limit", () => {
    expect(label({ rule: "single" }, 1)).toEqual({ text: "Elkelt · 1/1", soldOut: true });
    expect(label({ rule: "limited", limit: 3 }, 3)).toEqual({ text: "Elkelt · 3/3", soldOut: true });
  });

  it("shows the true count when the limit was lowered under the bookings", () => {
    expect(label({ rule: "limited", limit: 3 }, 4)).toEqual({ text: "Elkelt · 4/3", soldOut: true });
  });

  it("counts a limited design's bookings against its limit while it has room", () => {
    expect(label({ rule: "limited", limit: 3 }, 2)).toEqual({ text: "2 / 3 alkalom", soldOut: false });
  });

  it("counts an unlimited design's bookings", () => {
    expect(label({ rule: "unlimited" }, 4)).toEqual({ text: "4 foglalás", soldOut: false });
  });
});

describe("rankBookedDesigns", () => {
  const booking = (design: unknown, status: string, createdAt: string) => ({ design, status, createdAt });

  it("puts the most recently booked design first, with its number of active bookings", () => {
    const ranked = rankBookedDesigns([
      booking(1, "completed", "2026-10-01T10:00:00.000Z"),
      booking(2, "pending", "2026-10-15T10:00:00.000Z"),
      booking(1, "confirmed", "2026-10-12T10:00:00.000Z"),
    ]);
    expect(ranked).toEqual([
      { id: 2, active: 1, lastBookedAt: "2026-10-15T10:00:00.000Z" },
      { id: 1, active: 2, lastBookedAt: "2026-10-12T10:00:00.000Z" },
    ]);
  });

  it("leaves out rejected and cancelled bookings, and the designs that only have those", () => {
    const ranked = rankBookedDesigns([
      booking(1, "rejected", "2026-10-15T10:00:00.000Z"),
      booking(2, "cancelled", "2026-10-15T11:00:00.000Z"),
      booking(2, "pending", "2026-10-10T10:00:00.000Z"),
    ]);
    expect(ranked).toEqual([{ id: 2, active: 1, lastBookedAt: "2026-10-10T10:00:00.000Z" }]);
  });

  it("keeps the twelve most recently booked", () => {
    const bookings = Array.from({ length: 14 }, (_, i) =>
      booking(i + 1, "pending", new Date(Date.UTC(2026, 9, 1 + i)).toISOString()),
    );
    const ranked = rankBookedDesigns(bookings);
    expect(ranked).toHaveLength(12);
    expect(ranked[0].id).toBe(14);
    expect(ranked.at(-1)?.id).toBe(3);
  });

  it("reads a populated design as well as an id", () => {
    expect(rankBookedDesigns([booking({ id: 5 }, "pending", "2026-10-15T10:00:00.000Z")])).toEqual([
      { id: 5, active: 1, lastBookedAt: "2026-10-15T10:00:00.000Z" },
    ]);
  });
});

describe("admin links", () => {
  it("writes a filter the way the admin's list view reads it back", () => {
    const url = adminListUrl("/admin", "bookings", {
      where: { and: [{ status: { equals: "confirmed" } }, { slot: { exists: false } }] },
      sort: "createdAt",
    });
    expect(decodeURIComponent(url)).toBe(
      "/admin/collections/bookings?where[and][0][status][equals]=confirmed&where[and][1][slot][exists]=false&sort=createdAt",
    );
    // The admin parses its URL with qs-esm; the values come back as strings, which Payload's query reads as usual.
    const [path, query] = url.split("?");
    expect(path).toBe("/admin/collections/bookings");
    expect(qs.parse(query)).toEqual({
      where: { and: [{ status: { equals: "confirmed" } }, { slot: { exists: "false" } }] },
      sort: "createdAt",
    });
  });

  it("narrows the designs list to the given designs", () => {
    expect(decodeURIComponent(designsUrl("/admin", [3, 7]))).toBe(
      "/admin/collections/designs?where[id][in][0]=3&where[id][in][1]=7",
    );
  });

  it("leaves the query off when there is nothing to filter or sort", () => {
    expect(adminListUrl("/admin", "bookings", { where: {} })).toBe("/admin/collections/bookings");
  });

  it("links a list's full view, a design's bookings and a booking's page", () => {
    expect(decodeURIComponent(viewListUrl("/admin", "pending", NOW))).toBe(
      "/admin/collections/bookings?where[status][equals]=pending&sort=createdAt",
    );
    expect(decodeURIComponent(designBookingsUrl("/admin", 5))).toBe(
      "/admin/collections/bookings?where[design][equals]=5&sort=-createdAt",
    );
    expect(bookingUrl("/admin", 42)).toBe("/admin/collections/bookings/42");
  });
});
```

A `qs-esm` a Payload függősége (8.0.1, típusokkal); a teszt azzal olvassa vissza a linket, amivel az admin is.

- [ ] **Step 2: Futtasd, hogy lásd elbukni**

Run: `npx vitest run tests/unit/dashboard.test.ts`
Expected: FAIL — `Error: Cannot find package '@/lib/dashboard'`

- [ ] **Step 3: Írd meg a modult**

`lib/dashboard.ts`:

```ts
import type { Where } from "payload";
import { formatAdminURL } from "payload/shared";
import { type Availability, isActiveStatus, relationId } from "./booking-rules";
import { formatReceivedAt, formatSlotDay, formatSlotTime } from "./time";

/** The four booking lists on the admin dashboard; each is its own widget (cms/dashboard/widgets.ts). */
export type BookingView = "pending" | "unscheduled" | "upcoming" | "recent";

/** What a row's date is made from: when the booking came in, and its copy of the slot's start. */
type RowTimes = { createdAt: string; slotStartsAt?: string | null };

export type BookingViewSpec = {
  /** The widget's heading, and its name in the dashboard's add-widget list. */
  title: string;
  /** The bookings the list shows. The overview counts the same ones, so its numbers match the lists. */
  where: (now: Date) => Where;
  /** A Payload sort: the field, "-" in front for newest first. */
  sort: string;
  /** The date a row shows after the customer's name. */
  when: (booking: RowTimes, now: Date) => string;
  /** What the widget says when no booking fits. */
  empty: string;
};

const received = (booking: RowTimes, now: Date) => `beérkezett ${formatReceivedAt(booking.createdAt, now)}`;

/** Every condition at once. Typed arguments, so TypeScript reads each condition as a Where of its own. */
const allOf = (...conditions: Where[]): Where => ({ and: conditions });

export const BOOKING_VIEWS: Record<BookingView, BookingViewSpec> = {
  pending: {
    title: "Jóváhagyásra vár",
    where: () => ({ status: { equals: "pending" } }),
    // Oldest first, in both to-do lists: they are worked through in order.
    sort: "createdAt",
    when: received,
    empty: "Nincs jóváhagyásra váró foglalás.",
  },
  unscheduled: {
    title: "Időpontra vár",
    // Pending bookings have no slot yet either; they wait in the list above, so nothing is counted twice.
    where: () => allOf({ status: { equals: "confirmed" } }, { slot: { exists: false } }),
    sort: "createdAt",
    when: received,
    empty: "Minden jóváhagyott foglalásnak van időpontja.",
  },
  upcoming: {
    title: "Közelgő időpontok",
    // An active booking that loses its slot loses slotStartsAt too, so a future slotStartsAt means a held slot.
    where: (now) =>
      allOf({ status: { in: ["pending", "confirmed"] } }, { slotStartsAt: { greater_than: now.toISOString() } }),
    sort: "slotStartsAt",
    when: ({ slotStartsAt }) => (slotStartsAt ? `${formatSlotDay(slotStartsAt)} ${formatSlotTime(slotStartsAt)}` : ""),
    empty: "Nincs közelgő időpont.",
  },
  recent: {
    title: "Legutóbbi foglalások",
    where: () => ({}),
    sort: "-createdAt",
    when: (booking, now) => formatReceivedAt(booking.createdAt, now),
    empty: "Még nincs foglalás.",
  },
};

/** How many designs the "Lefoglalt minták" widget shows. */
export const BOOKED_DESIGNS_SHOWN = 12;

export type BookedDesign = { id: number; active: number; lastBookedAt: string };

/**
 * The designs with active bookings, the most recently booked first, at most `max`: each with its number of active
 * bookings and when the latest of them came in. Released bookings don't count.
 */
export function rankBookedDesigns(
  bookings: Iterable<{ design?: unknown; status: string | null | undefined; createdAt: string }>,
  max = BOOKED_DESIGNS_SHOWN,
): BookedDesign[] {
  const byDesign = new Map<number, BookedDesign>();
  for (const { design, status, createdAt } of bookings) {
    const id = relationId(design);
    if (id === null || !isActiveStatus(status)) continue;
    const seen = byDesign.get(id);
    if (!seen) {
      byDesign.set(id, { id, active: 1, lastBookedAt: createdAt });
      continue;
    }
    seen.active += 1;
    if (Date.parse(createdAt) > Date.parse(seen.lastBookedAt)) seen.lastBookedAt = createdAt;
  }
  return [...byDesign.values()]
    .sort((a, b) => Date.parse(b.lastBookedAt) - Date.parse(a.lastBookedAt) || b.id - a.id)
    .slice(0, max);
}

/**
 * The tag on a booked design's card: "Elkelt · 1/1" once its rule is full (the true count even when the limit was
 * lowered under it, "Elkelt · 4/3"), "2 / 3 alkalom" while a limited design has room, "4 foglalás" when unlimited.
 */
export function bookedLabel({ limit, soldOut }: Availability, active: number) {
  if (limit === null) return { text: `${active} foglalás`, soldOut: false };
  if (soldOut) return { text: `Elkelt · ${active}/${limit}`, soldOut: true };
  return { text: `${active} / ${limit} alkalom`, soldOut: false };
}

/** Writes a value into the query the way the admin's list view reads it back: where[status][equals]=pending. */
function appendQuery(params: URLSearchParams, key: string, value: unknown) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendQuery(params, `${key}[${index}]`, item));
  } else if (typeof value === "object" && value !== null) {
    for (const [name, item] of Object.entries(value)) appendQuery(params, `${key}[${name}]`, item);
  } else if (value !== undefined) {
    params.append(key, String(value));
  }
}

/** An admin list view, filtered and sorted. */
export function adminListUrl(
  adminRoute: string,
  collection: "bookings" | "designs",
  { where, sort }: { where?: Where; sort?: string } = {},
) {
  const params = new URLSearchParams();
  if (where) appendQuery(params, "where", where);
  if (sort) params.set("sort", sort);
  const list = formatAdminURL({ adminRoute, path: `/collections/${collection}` });
  const query = params.toString();
  return query ? `${list}?${query}` : list;
}

/** The bookings list filtered and sorted like one of the dashboard's lists: its "Mind (N)" link and its counter. */
export function viewListUrl(adminRoute: string, view: BookingView, now: Date) {
  const { where, sort } = BOOKING_VIEWS[view];
  return adminListUrl(adminRoute, "bookings", { where: where(now), sort });
}

/** A design's bookings, newest first: where a "Lefoglalt minták" card leads. */
export function designBookingsUrl(adminRoute: string, designId: number) {
  return adminListUrl(adminRoute, "bookings", { where: { design: { equals: designId } }, sort: "-createdAt" });
}

/** The designs list narrowed to these designs: where the "Elkelt minta" number leads. */
export function designsUrl(adminRoute: string, ids: number[]) {
  return adminListUrl(adminRoute, "designs", { where: { id: { in: ids } } });
}

/** A booking's page in the admin. */
export function bookingUrl(adminRoute: string, id: number) {
  return formatAdminURL({ adminRoute, path: `/collections/bookings/${id}` });
}
```

Az `allOf` nem díszítés: ha az `and` tömböt közvetlenül írod objektumliterállal, a TypeScript a különböző alakú elemeket közös unióvá vonja össze, és a `tsc` elutasítja (`Type 'undefined' is not assignable to type 'Where[] | WhereField'`).

- [ ] **Step 4: Futtasd, hogy lásd átmenni**

Run: `npx vitest run tests/unit/dashboard.test.ts`
Expected: PASS

- [ ] **Step 5: Típusellenőrzés**

Run: `npx tsc --noEmit`
Expected: nincs kimenet (0 hiba).

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard.ts tests/unit/dashboard.test.ts
git commit -m "$(cat <<'EOF'
feat: dashboard views, tags and admin links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Lekérdezések

**Files:**
- Modify: `tests/helpers.ts` (`createBooking`, a 86–94. sor körül)
- Create: `cms/dashboard/data.ts`
- Test: `tests/int/dashboard.test.ts`

- [ ] **Step 1: A teszt segédfüggvénye időpont nélkül is foglal**

`tests/helpers.ts`, ezt:

```ts
/** Books the way the admin panel does: no website-only rules apply. */
export async function createBooking(
  payload: Payload,
  design: number,
  slot: number,
  data: { status?: Booking["status"] } = {},
) {
```

cseréld erre (a függvény törzse nem változik):

```ts
/** Books the way the admin panel does: no website-only rules apply, and the slot may be left empty (null). */
export async function createBooking(
  payload: Payload,
  design: number,
  slot: number | null,
  data: { status?: Booking["status"] } = {},
) {
```

- [ ] **Step 2: Írd meg a bukó tesztet**

`tests/int/dashboard.test.ts`:

```ts
import { createLocalReq, type Payload, type PayloadRequest } from "payload";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadBookedDesigns, loadBookingView, loadOverview, loadSafely } from "@/cms/dashboard/data";
import { getFlashCatalog } from "@/lib/flash";
import { createBooking, createDesign, createSlot, getTestPayload, resetDatabase } from "../helpers";

let payload: Payload;
let req: PayloadRequest;

beforeAll(async () => {
  payload = await getTestPayload();
  const admin = await payload.create({
    collection: "users",
    data: { email: "admin@example.com", password: "dashboard-test-password" },
  });
  req = await createLocalReq({ user: { ...admin, collection: "users" } }, payload);
});

beforeEach(async () => {
  await resetDatabase(payload);
});

// createdAt has millisecond precision; a short pause keeps "oldest first" and "newest first" well defined.
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
const ids = (docs: { id: number }[]) => docs.map((doc) => doc.id);
const sorted = (values: number[]) => values.toSorted((a, b) => a - b);
const reject = (id: number) => payload.update({ collection: "bookings", id, data: { status: "rejected" } });

describe("booking lists", () => {
  it("lists pending bookings oldest first, with the design's name and image and the customer's name", async () => {
    const design = await createDesign(payload, { rule: "unlimited", number: "027" });
    const first = await createBooking(payload, design.id, null);
    await tick();
    const second = await createBooking(payload, design.id, null);
    await createBooking(payload, design.id, null, { status: "confirmed" });

    const { rows, total } = await loadBookingView(req, "pending", new Date());

    expect(total).toBe(2);
    expect(ids(rows)).toEqual([first.id, second.id]);
    expect(rows[0]).toMatchObject({
      design: "P’CONs #027",
      customer: "Teszt Elek",
      status: "pending",
      slotStartsAt: null,
    });
    expect(rows[0].image).toMatch(/^\/api\/media\/file\/.+/);
  });

  it("lists confirmed bookings without a slot, and only those", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    const waiting = await createBooking(payload, design.id, null, { status: "confirmed" });
    await createBooking(payload, design.id, (await createSlot(payload)).id, { status: "confirmed" });
    // A pending booking has no slot either, but it waits for approval first.
    await createBooking(payload, design.id, null);

    const { rows, total } = await loadBookingView(req, "unscheduled", new Date());

    expect(total).toBe(1);
    expect(ids(rows)).toEqual([waiting.id]);
  });

  it("lists pending and confirmed bookings whose slot is ahead, soonest first", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    // Each createSlot call lands an hour later than the one before.
    const sooner = await createSlot(payload);
    const later = await createSlot(payload);
    const confirmed = await createBooking(payload, design.id, later.id, { status: "confirmed" });
    const pending = await createBooking(payload, design.id, sooner.id);
    await createBooking(payload, design.id, (await createSlot(payload, { past: true })).id, { status: "confirmed" });
    const rejected = await createBooking(payload, design.id, (await createSlot(payload)).id);
    await reject(rejected.id);

    const { rows, total } = await loadBookingView(req, "upcoming", new Date());

    expect(total).toBe(2);
    expect(ids(rows)).toEqual([pending.id, confirmed.id]);
    expect(rows[0].slotStartsAt).toBe(sooner.startsAt);
  });

  it("lists every booking newest first, five of them, with the total", async () => {
    const design = await createDesign(payload, { rule: "unlimited" });
    const made = [];
    for (let i = 0; i < 6; i += 1) {
      made.push(await createBooking(payload, design.id, null));
      await tick();
    }
    await reject(made[5].id);

    const { rows, total } = await loadBookingView(req, "recent", new Date());

    expect(total).toBe(6);
    expect(ids(rows)).toEqual(ids(made.slice(1).reverse()));
    expect(rows[0].status).toBe("rejected");
  });
});

describe("overview", () => {
  it("counts what each list holds, and every sold-out design, hidden ones too", async () => {
    const single = await createDesign(payload, { rule: "single" });
    const limited = await createDesign(payload, { rule: "limited", limit: 2 });
    const hidden = await createDesign(payload, { rule: "single", visible: false });
    const unlimited = await createDesign(payload, { rule: "unlimited" });
    await createBooking(payload, single.id, null);
    await createBooking(payload, limited.id, null, { status: "confirmed" });
    await createBooking(payload, limited.id, (await createSlot(payload)).id, { status: "confirmed" });
    await createBooking(payload, hidden.id, (await createSlot(payload, { past: true })).id, { status: "completed" });
    await createBooking(payload, unlimited.id, null, { status: "completed" });

    const overview = await loadOverview(req, new Date());

    expect(overview).toMatchObject({ pending: 1, unscheduled: 1, upcoming: 1 });
    expect(sorted(overview.soldOut)).toEqual(sorted([single.id, limited.id, hidden.id]));
    // The site marks the same designs sold out; it only leaves out the hidden one, which it doesn't show.
    const siteSoldOut = (await getFlashCatalog()).filter((d) => d.availability.soldOut).map((d) => d.id);
    expect(sorted(overview.soldOut.filter((id) => id !== hidden.id))).toEqual(sorted(siteSoldOut));
  });
});

describe("booked designs", () => {
  it("shows the designs with active bookings, the most recently booked first, each with its tag", async () => {
    const single = await createDesign(payload, { rule: "single", number: "027" });
    const limited = await createDesign(payload, { category: "ornx", rule: "limited", limit: 3, number: "002" });
    const released = await createDesign(payload, { rule: "single" });
    await createBooking(payload, limited.id, null);
    await tick();
    await createBooking(payload, single.id, null, { status: "confirmed" });
    await tick();
    await createBooking(payload, limited.id, null, { status: "completed" });
    await reject((await createBooking(payload, released.id, null)).id);

    const cards = await loadBookedDesigns(req);

    expect(ids(cards)).toEqual([limited.id, single.id]);
    expect(cards[0]).toMatchObject({ name: "ORNX #002", label: "2 / 3 alkalom", soldOut: false });
    expect(cards[1]).toMatchObject({ name: "P’CONs #027", label: "Elkelt · 1/1", soldOut: true });
    expect(cards[0].image).toMatch(/^\/api\/media\/file\/.+/);
  });

  it("is empty while no booking holds a design", async () => {
    await createDesign(payload);
    expect(await loadBookedDesigns(req)).toEqual([]);
  });
});

describe("access", () => {
  it("refuses to load anything without a logged-in admin", async () => {
    const anonymous = await createLocalReq({}, payload);
    await expect(loadBookingView(anonymous, "recent", new Date())).rejects.toMatchObject({ name: "Forbidden" });
    await expect(loadOverview(anonymous, new Date())).rejects.toMatchObject({ name: "Forbidden" });
    await expect(loadBookedDesigns(anonymous)).rejects.toMatchObject({ name: "Forbidden" });
  });
});

describe("loadSafely", () => {
  it("logs only what is safe to log, and gives the widget null, when a query fails", async () => {
    const logged = vi.spyOn(payload.logger, "error").mockImplementation(() => undefined);
    // Drizzle puts the query's parameters, a customer's name among them, into its error message.
    const failure = Object.assign(new Error("Failed query: … params: Teszt Elek"), {
      name: "LibsqlError",
      code: "SQLITE_BUSY",
    });

    const result = await loadSafely(req, "overview", () => Promise.reject(failure));

    expect(result).toBeNull();
    expect(logged).toHaveBeenCalledWith({
      err: { name: "LibsqlError", code: "SQLITE_BUSY" },
      widget: "overview",
      msg: "Dashboard widget failed to load",
    });
    expect(JSON.stringify(logged.mock.calls)).not.toContain("Teszt Elek");
    logged.mockRestore();
  });

  it("hands the result over when the query works", async () => {
    expect(await loadSafely(req, "overview", async () => 42)).toBe(42);
  });
});
```

- [ ] **Step 3: Futtasd, hogy lásd elbukni**

Run: `npx vitest run tests/int/dashboard.test.ts`
Expected: FAIL — `Error: Cannot find package '@/cms/dashboard/data'`

- [ ] **Step 4: Írd meg a lekérdezéseket**

`cms/dashboard/data.ts`:

```ts
import type { PayloadRequest } from "payload";
import { ACTIVE_STATUSES, type BookingStatus, availability, countActiveByDesign } from "@/lib/booking-rules";
import { categoryName } from "@/lib/categories";
import { BOOKING_VIEWS, type BookingView, bookedLabel, rankBookedDesigns } from "@/lib/dashboard";
import { designName } from "@/lib/design-name";
import type { Design } from "@/payload-types";
import { loggableError } from "../log";

/** Rows on a booking list; the rest are behind its "Mind (N)" link. */
export const LIST_ROWS = 5;

export type BookingRow = {
  id: number;
  design: string;
  image: string | null;
  customer: string;
  status: BookingStatus;
  createdAt: string;
  slotStartsAt: string | null;
};

export type Overview = { pending: number; unscheduled: number; upcoming: number; soldOut: number[] };

export type BookedDesignCard = { id: number; name: string; image: string | null; label: string; soldOut: boolean };

// What a design brings along to the dashboard: its name and its first image.
const DESIGN_FIELDS = { title: true, category: true, number: true, images: true } as const;
const IMAGE_FIELDS = { url: true, filename: true, sizes: true } as const;

type ShownDesign = Pick<Design, "title" | "category" | "number" | "images">;

const nameOf = (design: ShownDesign) =>
  design.title || designName({ collection: categoryName(design.category), number: design.number });

/** The design's first image at the admin's thumbnail size, or the image itself; null when there is none. */
function thumbnailOf(design: ShownDesign) {
  const image = design.images?.[0]?.image;
  if (!image || typeof image !== "object") return null;
  return image.sizes?.thumbnail?.url || image.url || null;
}

/**
 * Runs a widget's query. On failure it logs what is safe to log (cms/log.ts) and returns null, so the widget can show
 * an error in its place: Payload doesn't catch a widget's error on first render, and the whole dashboard would fail.
 */
export async function loadSafely<T>(req: PayloadRequest, widget: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (err) {
    req.payload.logger.error({ err: loggableError(err), widget, msg: "Dashboard widget failed to load" });
    return null;
  }
}

/** One of the four booking lists: its first rows and how many bookings it holds in all. */
export async function loadBookingView(req: PayloadRequest, view: BookingView, now: Date) {
  const { where, sort } = BOOKING_VIEWS[view];
  const { docs, totalDocs } = await req.payload.find({
    collection: "bookings",
    where: where(now),
    sort,
    limit: LIST_ROWS,
    depth: 2,
    select: { design: true, designName: true, name: true, status: true, createdAt: true, slotStartsAt: true },
    populate: { designs: DESIGN_FIELDS, media: IMAGE_FIELDS },
    overrideAccess: false,
    req,
  });
  const rows = docs.map((booking): BookingRow => {
    const design = typeof booking.design === "object" ? booking.design : null;
    return {
      id: booking.id,
      // The design can't be deleted while a booking points at it; the booking's own copy of the name is a safety net.
      design: design ? nameOf(design) : (booking.designName ?? ""),
      image: design ? thumbnailOf(design) : null,
      customer: booking.name,
      status: booking.status,
      createdAt: booking.createdAt,
      slotStartsAt: booking.slotStartsAt ?? null,
    };
  });
  return { rows, total: totalDocs };
}

async function activeBookings(req: PayloadRequest) {
  const { docs } = await req.payload.find({
    collection: "bookings",
    where: { status: { in: [...ACTIVE_STATUSES] } },
    select: { design: true, status: true, createdAt: true },
    depth: 0,
    pagination: false,
    overrideAccess: false,
    req,
  });
  return docs;
}

/** Every design whose rule its active bookings fill, hidden ones too: the site marks the same ones "Elkelt". */
async function soldOutDesignIds(req: PayloadRequest) {
  const [designs, bookings] = await Promise.all([
    req.payload.find({
      collection: "designs",
      select: { rule: true, limit: true },
      depth: 0,
      pagination: false,
      overrideAccess: false,
      req,
    }),
    activeBookings(req),
  ]);
  const counts = countActiveByDesign(bookings);
  return designs.docs.filter((d) => availability(d, counts.get(d.id) ?? 0).soldOut).map((d) => d.id);
}

/** The overview's numbers. The three booking counts use the lists' own filters. */
export async function loadOverview(req: PayloadRequest, now: Date): Promise<Overview> {
  const count = async (view: BookingView) => {
    const { totalDocs } = await req.payload.count({
      collection: "bookings",
      where: BOOKING_VIEWS[view].where(now),
      overrideAccess: false,
      req,
    });
    return totalDocs;
  };
  const [pending, unscheduled, upcoming, soldOut] = await Promise.all([
    count("pending"),
    count("unscheduled"),
    count("upcoming"),
    soldOutDesignIds(req),
  ]);
  return { pending, unscheduled, upcoming, soldOut };
}

/** The designs with active bookings, the most recently booked first, each with its tag. */
export async function loadBookedDesigns(req: PayloadRequest): Promise<BookedDesignCard[]> {
  const ranked = rankBookedDesigns(await activeBookings(req));
  if (ranked.length === 0) return [];
  const { docs } = await req.payload.find({
    collection: "designs",
    where: { id: { in: ranked.map((d) => d.id) } },
    depth: 1,
    select: { ...DESIGN_FIELDS, rule: true, limit: true },
    populate: { media: IMAGE_FIELDS },
    pagination: false,
    overrideAccess: false,
    req,
  });
  const byId = new Map(docs.map((design) => [design.id, design]));
  return ranked.flatMap(({ id, active }) => {
    const design = byId.get(id);
    if (!design) return [];
    const { text, soldOut } = bookedLabel(availability(design, active), active);
    return [{ id, name: nameOf(design), image: thumbnailOf(design), label: text, soldOut }];
  });
}
```

Megjegyzések:
- `overrideAccess: false` + `req`: a Local API alapból kikapcsolja a jogosultságellenőrzést; így a gyűjtemények `access` szabályai érvényesek (bejelentkezés nélkül `Forbidden`).
- A `media` `select`-jében a `filename` is kell: a Payload abból számolja ki az `url`-t és a méretek URL-jét.

- [ ] **Step 5: Futtasd, hogy lásd átmenni**

Run: `npx vitest run tests/int/dashboard.test.ts`
Expected: PASS (10 teszt). A „No email adapter provided” figyelmeztetés várható: a foglalások levelei a konzolra mennének, de Vitest alatt csak a figyelmeztetések látszanak.

- [ ] **Step 6: A többi teszt sem tört el a segédfüggvény miatt**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tests/helpers.ts cms/dashboard/data.ts tests/int/dashboard.test.ts
git commit -m "$(cat <<'EOF'
feat: dashboard queries for the booking widgets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Widget komponensek

Szerverkomponensek, Payload UI-elemekkel. Automatikus tesztjük nincs (a Payload UI-elemei SCSS-t importálnak, és aszinkron szerverkomponenst Vitestben csak kerülőúttal lehet renderelni); a 8. feladat kézi próbája fedi le őket. Itt a típusellenőrzés és a lint a kapu.

**Files:**
- Create: `cms/dashboard/dashboard.module.css`
- Create: `cms/dashboard/parts.tsx`
- Create: `cms/dashboard/Overview.tsx`
- Create: `cms/dashboard/BookingList.tsx`
- Create: `cms/dashboard/BookedDesigns.tsx`

- [ ] **Step 1: Stílus**

`cms/dashboard/dashboard.module.css`:

```css
/* The booking widgets on the admin home. Colours come from Payload's theme variables, so the light and dark admin
   themes both work; widths come from the widget itself (the admin resizes it), hence the container queries. */

.widget {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 16px 20px;
  background: var(--theme-elevation-50);
  border: 1px solid var(--theme-border-color);
  border-radius: var(--style-radius-m);
}

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.title {
  margin: 0;
  font-size: 18px;
  line-height: 24px;
  font-weight: 500;
}

.more {
  color: var(--theme-elevation-500);
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;
}

.more:hover {
  color: var(--theme-text);
}

.empty {
  margin: 0;
  color: var(--theme-elevation-500);
}

/* Áttekintés: four numbers in a row, two by two in a narrow widget. */
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

@container (max-width: 560px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  height: 100%;
  padding: 12px 14px;
  color: inherit;
  text-decoration: none;
  background: var(--theme-bg);
  border: 1px solid var(--theme-border-color);
  border-radius: var(--style-radius-m);
}

a.stat:hover {
  border-color: var(--theme-elevation-400);
}

.statValue {
  font-size: 26px;
  line-height: 32px;
  font-weight: 500;
}

.statLabel {
  color: var(--theme-elevation-500);
}

/* The booking lists. */
.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rows li + li {
  border-top: 1px solid var(--theme-border-color);
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  color: inherit;
  text-decoration: none;
}

.row:hover strong {
  text-decoration: underline;
}

.rowText {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.rowText strong {
  font-weight: 500;
}

/* Wraps in a narrow widget rather than cutting off the date. */
.rowText span {
  color: var(--theme-elevation-500);
}

/* Lefoglalt minták: as many cards per row as fit. */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  height: 100%;
  padding: 8px;
  color: inherit;
  text-decoration: none;
  background: var(--theme-bg);
  border: 1px solid var(--theme-border-color);
  border-radius: var(--style-radius-m);
}

.card:hover {
  border-color: var(--theme-elevation-400);
}

.card strong {
  font-weight: 500;
}

/* A design's image: the drawing on white, as on the site, whole and never cropped. The box has a fixed size and the
   image is laid over it, so a tall drawing can't stretch a row or a card. These rules outrank Payload's Thumbnail. */
.row .image {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  min-height: 0;
  max-height: none;
}

.card .image {
  width: 100%;
  height: auto;
  min-height: 0;
  max-height: none;
  aspect-ratio: 1;
}

.widget .image {
  position: relative;
  overflow: hidden;
  background: #fff;
  border-radius: var(--style-radius-s);
}

.widget .image.image img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
```

Miért kell a képszabályok mindegyike: a Payload `Thumbnail` itt `min-height: 100%`-ot kap, a képe pedig nincs abszolút pozícionálva. Enélkül egy álló rajz a saját magasságára nyújtja a kártyát, és a címke kilóg a widget keretéből (a próbán pontosan ez történt). A `min-height: 0` és az abszolút kép rögzíti a dobozt; a `.image.image` a Payload `.thumbnail:not(…) img` szabályánál erősebb.

- [ ] **Step 2: Közös darabok**

`cms/dashboard/parts.tsx`:

```tsx
import { Banner, Pill, Thumbnail } from "@payloadcms/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { type BookingStatus, STATUS_LABELS } from "@/lib/booking-rules";
import styles from "./dashboard.module.css";

const STATUS_PILLS: Record<BookingStatus, "warning" | "success" | "light" | "light-gray"> = {
  pending: "warning",
  confirmed: "success",
  completed: "light",
  rejected: "light-gray",
  cancelled: "light-gray",
};

export function StatusPill({ status }: { status: BookingStatus }) {
  return (
    <Pill pillStyle={STATUS_PILLS[status]} size="small">
      {STATUS_LABELS[status]}
    </Pill>
  );
}

/** A design's image. Without one, or when it fails to load, Payload's Thumbnail shows its file icon. */
export function DesignImage({ src }: { src: string | null }) {
  return <Thumbnail className={styles.image} fileSrc={src ?? undefined} size="small" />;
}

/** A widget's frame: its heading, a link on the right when there is one, and its content. */
export function WidgetFrame({
  title,
  link,
  children,
}: {
  title: string;
  link?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className={styles.widget}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {link && (
          <Link className={styles.more} href={link.href}>
            {link.label}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/** What a widget shows when its query failed (see loadSafely); the rest of the dashboard still works. */
export function WidgetError({ title }: { title: string }) {
  return (
    <WidgetFrame title={title}>
      <Banner type="error">Nem sikerült betölteni. Töltsd újra az oldalt.</Banner>
    </WidgetFrame>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
```

- [ ] **Step 3: Áttekintés**

`cms/dashboard/Overview.tsx`:

```tsx
import Link from "next/link";
import type { WidgetServerProps } from "payload";
import { designsUrl, viewListUrl } from "@/lib/dashboard";
import styles from "./dashboard.module.css";
import { loadOverview, loadSafely } from "./data";
import { WidgetError, WidgetFrame } from "./parts";

const TITLE = "Áttekintés";

/** Four numbers: what waits for approval, what waits for a slot, what is coming up, and the sold-out designs. */
export async function Overview({ req }: WidgetServerProps) {
  const now = new Date();
  const overview = await loadSafely(req, "overview", () => loadOverview(req, now));
  if (!overview) return <WidgetError title={TITLE} />;

  const adminRoute = req.payload.config.routes.admin;
  const stats = [
    { label: "Jóváhagyásra vár", value: overview.pending, href: viewListUrl(adminRoute, "pending", now) },
    { label: "Időpontra vár", value: overview.unscheduled, href: viewListUrl(adminRoute, "unscheduled", now) },
    { label: "Közelgő időpont", value: overview.upcoming, href: viewListUrl(adminRoute, "upcoming", now) },
    { label: "Elkelt minta", value: overview.soldOut.length, href: designsUrl(adminRoute, overview.soldOut) },
  ];

  return (
    <WidgetFrame title={TITLE}>
      <ul className={styles.stats}>
        {stats.map(({ label, value, href }) => {
          const content = (
            <>
              <strong className={styles.statValue}>{value}</strong>
              <span className={styles.statLabel}>{label}</span>
            </>
          );
          // A zero opens nothing worth seeing, so it isn't a link.
          return (
            <li key={label}>
              {value > 0 ? (
                <Link className={styles.stat} href={href}>
                  {content}
                </Link>
              ) : (
                <div className={styles.stat}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </WidgetFrame>
  );
}
```

A lekérdezés hibáját a `loadSafely` fogja meg, nem egy `try/catch` a JSX körül: a JSX-et így nem kell a `try` blokkban felépíteni.

- [ ] **Step 4: A négy foglaláslista**

`cms/dashboard/BookingList.tsx`:

```tsx
import Link from "next/link";
import type { WidgetServerProps } from "payload";
import { BOOKING_VIEWS, type BookingView, bookingUrl, viewListUrl } from "@/lib/dashboard";
import styles from "./dashboard.module.css";
import { loadBookingView, loadSafely } from "./data";
import { DesignImage, EmptyState, StatusPill, WidgetError, WidgetFrame } from "./parts";

/** One of the four booking lists. Which one comes from its registration in cms/dashboard/widgets.ts (serverProps). */
export async function BookingList({ req, view }: WidgetServerProps & { view: BookingView }) {
  const spec = BOOKING_VIEWS[view];
  const now = new Date();
  const list = await loadSafely(req, `${view}-bookings`, () => loadBookingView(req, view, now));
  if (!list) return <WidgetError title={spec.title} />;

  const adminRoute = req.payload.config.routes.admin;
  const all =
    list.total > 0 ? { href: viewListUrl(adminRoute, view, now), label: `Mind (${list.total}) →` } : undefined;

  return (
    <WidgetFrame title={spec.title} link={all}>
      {list.rows.length === 0 ? (
        <EmptyState>{spec.empty}</EmptyState>
      ) : (
        <ul className={styles.rows}>
          {list.rows.map((row) => (
            <li key={row.id}>
              <Link className={styles.row} href={bookingUrl(adminRoute, row.id)}>
                <DesignImage src={row.image} />
                <span className={styles.rowText}>
                  <strong>{row.design}</strong>
                  <span>
                    {row.customer} · {spec.when(row, now)}
                  </span>
                </span>
                <StatusPill status={row.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}
```

- [ ] **Step 5: Lefoglalt minták**

`cms/dashboard/BookedDesigns.tsx`:

```tsx
import { Pill } from "@payloadcms/ui";
import Link from "next/link";
import type { WidgetServerProps } from "payload";
import { designBookingsUrl } from "@/lib/dashboard";
import styles from "./dashboard.module.css";
import { loadBookedDesigns, loadSafely } from "./data";
import { DesignImage, EmptyState, WidgetError, WidgetFrame } from "./parts";

const TITLE = "Lefoglalt minták";

/** The designs with active bookings; a card opens that design's bookings. */
export async function BookedDesigns({ req }: WidgetServerProps) {
  const cards = await loadSafely(req, "booked-designs", () => loadBookedDesigns(req));
  if (!cards) return <WidgetError title={TITLE} />;

  const adminRoute = req.payload.config.routes.admin;
  return (
    <WidgetFrame title={TITLE}>
      {cards.length === 0 ? (
        <EmptyState>Még nincs lefoglalt minta.</EmptyState>
      ) : (
        <ul className={styles.cards}>
          {cards.map((card) => (
            <li key={card.id}>
              <Link className={styles.card} href={designBookingsUrl(adminRoute, card.id)}>
                <DesignImage src={card.image} />
                <strong>{card.name}</strong>
                <Pill pillStyle={card.soldOut ? "dark" : "light"} size="small">
                  {card.label}
                </Pill>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}
```

- [ ] **Step 6: Típusellenőrzés és lint**

Run: `npx tsc --noEmit && npx eslint cms/dashboard`
Expected: nincs kimenet (0 hiba).

- [ ] **Step 7: Commit**

```bash
git add cms/dashboard/dashboard.module.css cms/dashboard/parts.tsx cms/dashboard/Overview.tsx cms/dashboard/BookingList.tsx cms/dashboard/BookedDesigns.tsx
git commit -m "$(cat <<'EOF'
feat: admin dashboard widget components

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Regisztráció, magyar szövegek, generált fájlok

Ezzel jelennek meg a widgetek az admin nyitó oldalán.

**Files:**
- Create: `cms/dashboard/translations.ts`
- Create: `cms/dashboard/widgets.ts`
- Modify: `payload.config.ts` (importok a 13. sor után; `admin`; `i18n`; a fájl utolsó sora)
- Regenerate: `app/(payload)/admin/importMap.js`, `payload-types.ts`
- Test: `tests/int/dashboard-config.test.ts`

- [ ] **Step 1: Írd meg a bukó tesztet**

`tests/int/dashboard-config.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { initI18n } from "@payloadcms/translations";
import { hu } from "@payloadcms/translations/languages/hu";
import type { Payload } from "payload";
import { beforeAll, describe, expect, it } from "vitest";
import { dashboardTranslations } from "@/cms/dashboard/translations";
import { dashboard } from "@/cms/dashboard/widgets";
import { getTestPayload } from "../helpers";

let payload: Payload;

beforeAll(async () => {
  payload = await getTestPayload();
});

describe("dashboard widgets", () => {
  it("lays out only widgets that are registered, Payload's collection cards included", () => {
    const registered = new Set(payload.config.admin.dashboard?.widgets.map((widget) => widget.slug));
    const layout = dashboard.defaultLayout as { widgetSlug: string }[];
    for (const { widgetSlug } of layout) expect(registered, widgetSlug).toContain(widgetSlug);
  });

  it("has every widget component in the generated import map", () => {
    // `npm run generate:importmap` writes it; without an entry the admin can't render the widget.
    const importMap = readFileSync(new URL("../../app/(payload)/admin/importMap.js", import.meta.url), "utf8");
    for (const { slug, Component } of dashboard.widgets) {
      const path = typeof Component === "object" ? Component.path : Component;
      expect(typeof path, slug).toBe("string");
      expect(importMap).toContain(`"${path}"`);
    }
  });

  it("names Payload's collection cards in Hungarian in the add-widget list", () => {
    const cards = payload.config.admin.dashboard?.widgets.find((widget) => widget.slug === "collections");
    expect(cards?.label).toBe("Gyűjtemények");
  });
});

describe("dashboard translations", () => {
  it("replaces only strings Payload's Hungarian translation has", () => {
    // A Payload upgrade that renames a key would otherwise leave the old Hungarian text in place unnoticed.
    const payloadStrings = hu.translations as unknown as Record<string, Record<string, string>>;
    for (const [group, strings] of Object.entries(dashboardTranslations)) {
      for (const key of Object.keys(strings)) expect(payloadStrings[group], `${group}:${key}`).toHaveProperty(key);
    }
  });

  it("reaches the admin's translations", async () => {
    const i18n = await initI18n({ config: payload.config.i18n, context: "client", language: "hu" });
    expect(i18n.t("dashboard:resetLayout")).toBe("Alapelrendezés visszaállítása");
    expect(i18n.t("error:failedToResetLayout")).toBe("Nem sikerült visszaállítani az alapelrendezést.");
    // Strings we don't replace keep Payload's text.
    expect(i18n.t("dashboard:discardConfirmLabel")).toBe("Elvetés");
  });
});
```

- [ ] **Step 2: Futtasd, hogy lásd elbukni**

Run: `npx vitest run tests/int/dashboard-config.test.ts`
Expected: FAIL — `Error: Cannot find package '@/cms/dashboard/translations'`

- [ ] **Step 3: A magyar szövegek**

`cms/dashboard/translations.ts`:

```ts
/**
 * Payload's Hungarian strings for the dashboard's edit mode mix "ön" and "te", call it "Műszerfal" once, and speak of
 * saved changes where they are unsaved. The rest of the admin's own text says "te"; these replace Payload's.
 */
export const dashboardTranslations = {
  dashboard: {
    addButton: "Hozzáadás +",
    addWidget: "Widget hozzáadása",
    deleteWidget: "A(z) {{id}} widget törlése",
    discardMessage: "Az elrendezésen nem mentett változtatások vannak. Biztosan elveted őket?",
    discardTitle: "Elveted a változtatásokat?",
    editDashboard: "Irányítópult szerkesztése",
    editingDashboard: "Szerkesztő mód",
    noItems: "Nincs widget az irányítópulton. Az „Irányítópult” menüben kapcsold be a szerkesztést, és adj hozzá egyet.",
    resetLayout: "Alapelrendezés visszaállítása",
    searchWidgets: "Widget keresése…",
  },
  error: {
    failedToResetLayout: "Nem sikerült visszaállítani az alapelrendezést.",
  },
};
```

A szerkesztő mód mentés gombja (`fields:saveChanges`, „Módosítások mentése”) jó, azt nem kell felülírni.

- [ ] **Step 4: A widgetek és az alapelrendezés**

`cms/dashboard/widgets.ts`:

```ts
import type { DashboardConfig, SanitizedConfig, Widget } from "payload";
import { BOOKING_VIEWS, type BookingView } from "@/lib/dashboard";

// Paths are relative to the import map's baseDir (the repo root). After adding or renaming a component here, run
// `npm run generate:importmap`; `next dev` regenerates it too.
const bookingList = (slug: string, view: BookingView): Widget => ({
  slug,
  label: BOOKING_VIEWS[view].title,
  Component: { path: "/cms/dashboard/BookingList#BookingList", serverProps: { view } },
  minWidth: "small",
  maxWidth: "full",
});

/**
 * The admin home. Each admin can add, remove, resize and reorder these widgets in the dashboard's edit mode; Payload
 * saves the layout per admin. The default layout is what an admin sees before saving one, and after "reset".
 */
export const dashboard: DashboardConfig = {
  widgets: [
    {
      slug: "overview",
      label: "Áttekintés",
      Component: "/cms/dashboard/Overview#Overview",
      minWidth: "medium",
      maxWidth: "full",
    },
    bookingList("pending-bookings", "pending"),
    bookingList("unscheduled-bookings", "unscheduled"),
    bookingList("upcoming-bookings", "upcoming"),
    bookingList("recent-bookings", "recent"),
    {
      slug: "booked-designs",
      label: "Lefoglalt minták",
      Component: "/cms/dashboard/BookedDesigns#BookedDesigns",
      minWidth: "medium",
      maxWidth: "full",
    },
  ],
  defaultLayout: [
    { widgetSlug: "overview", width: "full" },
    { widgetSlug: "pending-bookings", width: "medium" },
    { widgetSlug: "unscheduled-bookings", width: "medium" },
    { widgetSlug: "upcoming-bookings", width: "medium" },
    { widgetSlug: "recent-bookings", width: "medium" },
    { widgetSlug: "booked-designs", width: "full" },
    // Payload's own collection cards, registered by Payload itself.
    { widgetSlug: "collections", width: "full" },
  ],
};

/**
 * Payload always appends its collection-cards widget, without a label, so the add-widget list would call it
 * "Collections". A widget of our own with that slug would show up twice, so the built config gets the label instead.
 */
export function labelPayloadWidgets(config: SanitizedConfig) {
  const cards = config.admin.dashboard?.widgets.find((widget) => widget.slug === "collections");
  if (cards) cards.label = "Gyűjtemények";
  return config;
}
```

A négy lista ugyanaz a komponens: a `serverProps.view`-t a Payload a szerverkomponens propjaihoz fűzi (`RenderServerComponent`).

- [ ] **Step 5: A config**

`payload.config.ts`, az importok közé, a `Users` importja után:

```ts
import { dashboardTranslations } from "./cms/dashboard/translations";
import { dashboard, labelPayloadWidgets } from "./cms/dashboard/widgets";
```

Az `admin` blokkban, a `meta` sor után:

```ts
    // The admin home: booking widgets each admin can add, remove, resize and reorder (cms/dashboard/).
    dashboard,
```

Az `i18n` sor:

```ts
  i18n: { supportedLanguages: { hu }, fallbackLanguage: "hu", translations: { hu: dashboardTranslations } },
```

A fájl utolsó sora, a `});` helyett:

```ts
}).then(labelPayloadWidgets);
```

A config továbbra is `Promise<SanitizedConfig>`-et exportál, mint eddig; a `getPayload`, a Payload CLI és az admin layout is ezt várja.

- [ ] **Step 6: Generált fájlok**

Run: `npm run generate:importmap`
Expected: `Writing import map to …/app/(payload)/admin/importMap.js`, és a fájlban három új bejegyzés a `CollectionCards` mellett:

```js
  "/cms/dashboard/Overview#Overview": Overview_412f77a6f49b147d8c58a16328a9630a,
  "/cms/dashboard/BookingList#BookingList": BookingList_df7c067ebb1e3cc3d583a6139de564a2,
  "/cms/dashboard/BookedDesigns#BookedDesigns": BookedDesigns_0d460977c3d6d2c10c223051809a4bbe,
```

Run: `npm run generate:types`
Expected: `Types written to …/payload-types.ts`; a `Config.widgets` alá bekerül az `overview`, `pending-bookings`, `unscheduled-bookings`, `upcoming-bookings`, `recent-bookings` és `booked-designs`, egy-egy `…Widget` interfésszel (`width`: a widget legkisebb és legnagyobb mérete közötti értékek).

Ha fut a felhasználó dev szervere, ő is újragenerálhatja ezeket; az eredmény ugyanez.

- [ ] **Step 7: Futtasd, hogy lásd átmenni**

Run: `npx vitest run tests/int/dashboard-config.test.ts`
Expected: PASS (5 teszt)

- [ ] **Step 8: Típusellenőrzés és lint**

Run: `npm run typecheck && npm run lint`
Expected: hiba nélkül. (A `defaultLayout` slugjait és szélességeit a generált `payload-types.ts` ellenőrzi; ezért kell előbb a `generate:types`.)

- [ ] **Step 9: Commit**

```bash
git add cms/dashboard/translations.ts cms/dashboard/widgets.ts payload.config.ts "app/(payload)/admin/importMap.js" payload-types.ts tests/int/dashboard-config.test.ts
git commit -m "$(cat <<'EOF'
feat: booking widgets on the admin home

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: README

**Files:**
- Modify: `README.md` (új szakasz a „Hogyan működik a foglalás” után, az „Élesítés (Hostinger, Node.js alkalmazás)” elé)

- [ ] **Step 1: Írd be a szakaszt**

```markdown
## Az admin nyitó oldala

Az `/admin` nyitó oldalán foglalási widgetek vannak: *Áttekintés* (négy számláló), *Jóváhagyásra vár*, *Időpontra vár*, *Közelgő időpontok*, *Legutóbbi foglalások* és *Lefoglalt minták*, alattuk a gyűjtemények kártyái. Egy számláló, egy sor vagy egy minta a hozzá tartozó, szűrt listát vagy a foglalást nyitja meg. Az adatok az oldal betöltésekor frissülnek.

- **Elrendezés:** a felső sáv *Irányítópult* menüjében válaszd az *Irányítópult szerkesztése* lehetőséget. A *Hozzáadás +* gombbal widgetet adhatsz hozzá, a meglévőket törölheted, átméretezheted és áthúzhatod; a *Módosítások mentése* adminonként menti az elrendezést. Az *Alapelrendezés visszaállítása* az eredetit hozza vissza.
- **Új widget a kódban:** a widgeteket és az alapelrendezést a `cms/dashboard/widgets.ts` sorolja fel. Új vagy átnevezett komponens után futtasd az `npm run generate:importmap` és az `npm run generate:types` parancsot. Akinek már van mentett elrendezése, annál az új widget nem jelenik meg magától: hozzá kell adnia, vagy vissza kell állítania az alapelrendezést.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: the admin home in the README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Teljes ellenőrzés és kézi próba

**Files:** nincs változás (hacsak a próba hibát nem talál).

- [ ] **Step 1: Minden automatikus ellenőrzés**

Run: `npm test && npm run typecheck && npm run lint`
Expected: minden teszt zöld, a típusellenőrzés és a lint hiba nélkül fut.

- [ ] **Step 2: Elkülönített másolat**

A felhasználó adatbázisában és dev szerverén nem próbálunk. Másolat a scratchpadben (`$SP` legyen a munkamenet scratchpad mappája):

```bash
rsync -a --exclude node_modules --exclude .next --exclude .data --exclude .git --exclude '.env*' ./ "$SP/dash-check/"
cp -Rc node_modules "$SP/dash-check/node_modules"
cat > "$SP/dash-check/.env" <<'EOF'
PAYLOAD_SECRET=dash-check-secret-not-real
DATABASE_URL=file:./.data/pannipix.db
MEDIA_DIR=.data/media
SITE_URL=http://localhost:3111
ADMIN_EMAIL=admin@example.com
EOF
cd "$SP/dash-check" && npm run seed
```

Expected: `Seed done: 8 designs, … open slots.` (SMTP nincs beállítva, így levél nem megy ki.)

- [ ] **Step 3: Mintafoglalások a másolatban**

`$SP/dash-check/scripts/dash-check.ts` (csak a másolatban, nem a repóban):

```ts
// Check-only: an admin and a few bookings so every dashboard widget has something to show.
import config from "@payload-config";
import { getPayload } from "payload";

const payload = await getPayload({ config });
await payload.create({ collection: "users", data: { email: "admin@example.com", password: "dash-check-password" } });
const designs = (await payload.find({ collection: "designs", pagination: false, depth: 0 })).docs;
const slots = (
  await payload.find({
    collection: "slots",
    where: { startsAt: { greater_than: new Date().toISOString() } },
    sort: "startsAt",
    pagination: false,
    depth: 0,
  })
).docs;
const book = (name: string, number: string, extra: { slot?: number; status?: "pending" | "confirmed" } = {}) =>
  payload.create({
    collection: "bookings",
    data: {
      name,
      email: "check@example.com",
      phone: "+36 30 000 0000",
      placement: "alkar",
      adultConfirmed: true,
      design: designs.find((d) => d.number === number)!.id,
      slot: extra.slot,
      status: extra.status ?? "pending",
    },
  });
// A short pause between bookings keeps their order on the lists well defined.
const pause = () => new Promise((resolve) => setTimeout(resolve, 30));

await book("Szabó Lili", "025");
await pause();
await book("Varga Dóra", "023", { status: "confirmed" });
await pause();
await book("Tóth Bence", "022", { slot: slots[0].id, status: "confirmed" });
await pause();
await book("Horváth Emma", "024", { slot: slots[1].id });
await pause();
const rejected = await book("Nagy Réka", "026");
await payload.update({ collection: "bookings", id: rejected.id, data: { status: "rejected" } });
await pause();
await book("Kiss Anna", "027");
payload.logger.info("Check data: 6 bookings.");
process.exit(0);
```

Run: `cd "$SP/dash-check" && npx payload run scripts/dash-check.ts`
Expected: `Check data: 6 bookings.`

- [ ] **Step 4: Dev szerver a másolaton**

Run (háttérben): `cd "$SP/dash-check" && npx next dev -p 3111`
Expected: `✓ Ready`. Nyisd meg a http://localhost:3111/admin oldalt, és lépj be: `admin@example.com` / `dash-check-password`.

- [ ] **Step 5: Ellenőrizd a böngészőben**

A mintaadatokkal ezt kell látni:
- *Áttekintés*: 3 jóváhagyásra vár, 1 időpontra vár, 2 közelgő időpont, 6 elkelt minta. Mind a négy link, és a jó szűrt listát nyitja: a 6-os a Flash minták listáját a hat mintára szűkítve.
- *Jóváhagyásra vár*: Szabó Lili, Horváth Emma, Kiss Anna, ebben a sorrendben, „Mind (3) →”. *Időpontra vár*: Varga Dóra. *Közelgő időpontok*: Tóth Bence, aztán Horváth Emma, időponttal. *Legutóbbi foglalások*: öt sor, Kiss Anna felül, Nagy Réka szürke „Elutasítva” címkével, „Mind (7) →” (a seed archív foglalásával együtt).
- *Lefoglalt minták*: hat kártya „Elkelt · 1/1” címkével; a #026 nincs köztük. A képek négyzetesek, teljesek, fehér alapon, és semmi nem lóg ki a widget keretéből.
- Egy sorra kattintva a foglalás nyílik, egy kártyára kattintva a minta foglalásai.
- Sötét téma (fiók → *Admin téma*): a widgetek követik.
- Telefonszélesség (fejlesztői eszközök, 390 px): a widgetek egymás alatt, a számlálók 2×2-ben, a sorok szövege tördel, nem vágódik le.
- Szerkesztő mód (*Irányítópult* menü → *Irányítópult szerkesztése*): egy widget törlése, újra hozzáadása a *Hozzáadás +* listából (a lista elemei: Áttekintés, a négy lista, Lefoglalt minták, Gyűjtemények; nincs angol „Collections”), átméretezés, áthúzás, *Módosítások mentése*, újratöltés után megmarad; *Alapelrendezés visszaállítása* után az eredeti elrendezés jön vissza. A szövegek tegeznek.
- Üres állapot: töröld a hat foglalást az adminban; minden widget a saját üres szövegét mutatja.

- [ ] **Step 6: Takarítás**

Állítsd le a másolat dev szerverét, és töröld a másolatot: `rm -rf "$SP/dash-check"`.

- [ ] **Step 7: Ha a próba hibát talált**

Javítsd a repóban, futtasd újra az 1. lépést, és commitold a javítást egy külön, a hibát megnevező commitban.
