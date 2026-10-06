# Payload CMS + flash minta időpontfoglalás — tervdokumentum

**Dátum:** 2026-10-06 · **Állapot:** jóváhagyásra vár · **Ág:** `feature/payload-flash-booking`
**Kiinduló állapot:** Next 16.3.8, React 19.2.8, Tailwind 4, egyoldalas landing, magyar szövegek, Hostinger (managed Node.js).

## 1. Cél

A flash minták ma be vannak égetve a kódba (`components/data.ts`), és a felület vásárlást sugall (kosár, „Megvásárlod a mintát”). A cél:

- Az admin a Payload CMS felületén kezeli a flash mintákat, a kollekciókat és a szabad időpontokat.
- A látogató **időpontot foglal** egy mintára az admin által megadott időpontok közül. Ez nem vásárlás: az ár tájékoztató, az oldalon nincs fizetés.
- Minden kollekció saját szabálya dönti el, hányszor foglalható egy mintája.

## 2. Meghozott döntések

| Kérdés | Döntés |
|---|---|
| Mi a „három kategória”? | A három kollekció (P’CONs, ORNX, daddywillhateus). A foglalhatósági szabály a kollekción van. |
| Időpontok | Közös naptár: bármely minta bármely szabad időpontra foglalható; egy időpont = egy foglalás. |
| Foglalás menete | Beküldéskor azonnal zárol (időpont + a minta egy alkalma), állapota *Függőben*; az admin jóváhagyja vagy elutasítja. |
| Adatbázis, képek | SQLite fájl és lemezre mentett képek a Hostingeren, a deploy mappán kívül (útvonal környezeti változóból). |
| Értesítés | E-mail az adminnak (új foglalás) és az ügyfélnek (beérkezett, jóváhagyva, elutasítva/lemondva), Hostinger SMTP-n. |

## 3. Architektúra

- A Payload 3.90.2 ugyanabban a Next alkalmazásban fut: egy processz, egy deploy.
- Útvonalcsoportok:
  - `app/(frontend)/` — a mostani oldal; ide költözik a `layout.tsx`, a `page.tsx` és a `globals.css`.
  - `app/(payload)/` — Payload admin (`/admin`) és REST API (`/api`), a Payload sablon fájljaival.
  - Az `app/favicon.ico` a helyén marad.
- `payload.config.ts` a repó gyökerében, `@payload-config` tsconfig aliasszal.
- `next.config.ts`: `withPayload()` csomagolja. A meglévő `allowedDevOrigins`, `images.qualities` és `experimental.turbopackPluginRuntimeStrategy` megmarad.
- **Adatbázis:** `@payloadcms/db-sqlite` (libsql), `client.url = DATABASE_URL`, `wal: true`, `busyTimeout: 5000`. A tranzakciók kikapcsolva maradnak (ez az alapértelmezés), az egyidejűségi garanciát egyedi indexek adják (6.4).
- **Képek:** `media` upload gyűjtemény, `staticDir = MEDIA_DIR`. A Payload szolgálja ki őket (`/api/media/file/...`), a `next/image` optimalizálja.
- **E-mail:** `@payloadcms/email-nodemailer`, SMTP. Ha nincs beállítva SMTP (fejlesztés), a Payload a konzolra naplóz.
- **Admin nyelve:** magyar (`@payloadcms/translations/languages/hu`), magyar gyűjtemény- és mezőcímkékkel. Időzóna: Europe/Budapest.
- **Séma:** fejlesztésben `push` (automatikus szinkron). Élesben a `migrations/` mappába generált, commitolt migrációk futnak induláskor (`prodMigrations`).

Kódszervezés:

```
payload.config.ts
payload/
  collections/   Users, Media, Categories, Designs, Slots, Bookings
  booking/       szabályok (limit, sorszámkiosztás, állapotok) és hookok
  emails/        sablonok és küldés
  access.ts
lib/flash.ts                  szerveroldali adatlekérés a frontendnek (Local API → frontend típusok)
app/(frontend)/actions.ts     server actionök: szabad időpontok, foglalás beküldése
scripts/seed.ts
migrations/
tests/
```

## 4. Adatmodell

### 4.1 Kollekciók (`categories`)

| Mező | Típus | Szabály |
|---|---|---|
| `name` | text | kötelező, egyedi (pl. „P’CONs”) |
| `rule` | select: `single` Egyszeri / `limited` Limitált / `unlimited` Korlátlan | kötelező |
| `limit` | number | csak `limited`-nél látszik és kötelező, legalább 2 |
| `order` | number | megjelenítési sorrend az oldalon |

Effektív limit: `single` → 1, `limited` → `limit`, `unlimited` → nincs felső határ.

### 4.2 Flash minták (`designs`)

| Mező | Típus | Szabály |
|---|---|---|
| `category` | relationship → categories | kötelező |
| `number` | text | kötelező (pl. „027”); a `category` + `number` pár egyedi (összetett index) |
| `price` | number | kötelező, Ft, ≥ 0 |
| `size` | text | pl. „15–18 cm” |
| `placements` | text | pl. „alkar, comb, oldal” |
| `description` | textarea | |
| `badge` | select: `new` Új / `last` Utolsó | opcionális; az „Elkelt” automatikus |
| `images` | array, legalább 1 sor: `image` (upload → media, kötelező), `kind` (`art` Rajz / `photo` Fotó, alap: `art`), `label` (text, alap: „Minta”) | az első kép a kártyakép; a rajz fehér hátterű legyen, mert az oldal `mix-blend-multiply`-jal teszi a panelre |
| `visible` | checkbox | alap: igaz; hamis → nem jelenik meg az oldalon |

Megjelenített név: `${category.name} #${number}`. A hátralévő alkalmak száma nincs tárolva, mindig számolt (6.2).

### 4.3 Időpontok (`slots`)

| Mező | Típus | Szabály |
|---|---|---|
| `startsAt` | date (nap + idő), Europe/Budapest | kötelező, egyedi |
| `title` | text, automatikus, csak olvasható | pl. „2026. 10. 14. (kedd) 10:00”; ez látszik a kapcsolatválasztókban |
| állapot | számított (virtuális) | listaoszlop: *Szabad* / *Foglalt* |

### 4.4 Foglalások (`bookings`)

| Mező | Típus | Szabály |
|---|---|---|
| `design` | relationship → designs | kötelező |
| `slot` | relationship → slots | **egyedi**; felszabaduláskor `null` |
| `seat` | number, rejtett | a minta hányadik alkalma (1..limit); a `design` + `seat` pár **egyedi**; korlátlan kollekciónál és felszabaduláskor `null` |
| `status` | select: `pending` Függőben / `confirmed` Jóváhagyva / `completed` Elkészült / `rejected` Elutasítva / `cancelled` Lemondva | alap: `pending` |
| `name`, `email`, `phone` | text / email / text | kötelező |
| `placement` | select: Alkar, Felkar, Comb, Lábszár, Hát, Oldal, Gerinc, Más testtáj | kötelező |
| `note` | textarea | opcionális, legfeljebb 1000 karakter |
| `adultConfirmed` | checkbox | csak igaz értékkel menthető |
| `slotStartsAt`, `designName`, `price` | pillanatkép, csak olvasható | foglaláskor, időpont- és mintacserekor töltődik |
| `title` | text, automatikus | pl. „Kovács Anna — P’CONs #027” |

### 4.5 Képek (`media`) és adminok (`users`)

- `media`: csak képfájl; az `alt` kötelező; admin bélyegkép a `sharp` segítségével.
- `users`: Payload auth (e-mail + jelszó). Nincs nyilvános regisztráció; az első admint a `/admin` oldalon kell létrehozni.

## 5. Jogosultságok

| Gyűjtemény | Nyilvános (nincs bejelentkezve) | Admin |
|---|---|---|
| categories | olvasás | minden |
| designs | olvasás, csak `visible = true` | minden |
| media | olvasás | minden |
| slots | — | minden |
| bookings | — | minden |
| users | — | minden |

Nyilvános foglalás kizárólag a server actionön keresztül jöhet létre (Local API).

## 6. Foglalási szabályok

### 6.1 Állapotok

- **Aktív**: `pending`, `confirmed`, `completed`. Leköti az időpontot és a minta egy alkalmát.
- **Felszabadított**: `rejected`, `cancelled`. A hook `slot = null` és `seat = null` értéket állít be; a pillanatképek megmaradnak.
- Felszabadított foglalás nem állítható vissza aktívra. Hibaüzenet: „Elutasított vagy lemondott foglalás nem aktiválható újra — hozz létre új foglalást.” A két felszabadított állapot között szabad a váltás.

### 6.2 Foglalhatóság

- `activeCount` = a minta aktív foglalásainak száma.
- A minta foglalható, ha nyilvános foglalásnál látható, **és** a kollekciója `unlimited`, **vagy** `activeCount < limit`.
- Hátralévő alkalmak: `limit − activeCount` (legalább 0). Ha 0, az oldalon „Elkelt”.
- Ha az admin szabályt vált, a meglévő foglalások nem változnak; a számítás az új szabállyal folytatódik.

### 6.3 Új foglalás (Bookings `beforeChange`, létrehozás)

Nyilvános és admin által felvett foglalásnál ugyanez fut; az eltérések jelölve.

1. Betölti a mintát a kollekciójával. Nyilvános foglalásnál a minta legyen `visible`.
2. Betölti az időpontot. Nyilvános foglalásnál legyen jövőbeli. Ha az időpontnak már van aktív foglalása, barátságos hibát ad. A végső garancia az egyedi index.
3. **Egyetlen lekérdezéssel** beolvassa a minta aktív foglalásait a sorszámukkal. Ebből számolja az `activeCount`-ot és az 1..limit közötti legkisebb szabad sorszámot. Ha nincs ilyen: „Ez a minta már betelt.”
4. Kitölti a pillanatképeket és a `title`-t. Nyilvános foglalás állapota mindig `pending`.

### 6.4 Egyidejűség

- Két egyedi index védi a foglalásokat: `bookings.slot` és (`bookings.design`, `bookings.seat`). Az SQLite több `NULL` értéket is enged egy egyedi oszlopban, így a felszabadított és a korlátlan foglalások nem ütköznek.
- **Két kérés egyszerre ugyanarra az időpontra:** az egyik beszúrás `SQLITE_CONSTRAINT_UNIQUE` hibát kap. A Payload ezt `ValidationError`-rá alakítja, a hibás mező útvonalával. Az ügyfél ezt látja: „Ezt az időpontot közben lefoglalták, válassz másikat.”
- **Két kérés egyszerre ugyanarra a sorszámra:** az egyik elbukik, és a server action **egyszer** újrapróbálja. Ekkor már friss állapotot lát, tehát vagy új sorszámot kap, vagy „betelt” üzenetet.
- Az `activeCount` és a szabad sorszám ugyanabból az olvasásból jön, ezért a limit nem léphető túl. Aki régebbi állapotot lát, ugyanazt a sorszámot választja, mint a másik kérés, és az indexen elbukik.

### 6.5 Admin módosítások (Bookings `beforeChange`, frissítés)

- Ha a státusz felszabadítottra vált, a `slot` és a `seat` nullázódik.
- Aktív foglalás áthelyezhető egy másik szabad időpontra. Az egyedi index védi, a pillanatkép frissül.
- Ha aktív foglalásnál cserélődik a minta, a 6.3/3. lépés újrafut az új mintára, a foglalás saját korábbi alkalmát nem számolva.

### 6.6 Törlési szabályok (`beforeDelete`)

- Kollekció nem törölhető, amíg van benne minta.
- Minta nem törölhető, ha bármilyen foglalás tartozik hozzá. Helyette `visible = false`.
- Időpont nem törölhető, ha aktív foglalás tartozik hozzá.
- Foglalás törölhető (pl. spam esetén); a törlés felszabadítja az időpontot és az alkalmat.

## 7. E-mailek

A levelek a Bookings `afterChange` hookjából mennek. Ha a küldés nem sikerül, az soha nem buktatja el a mentést, csak `payload.logger.error` naplózza.

| Esemény | Címzett | Tartalom |
|---|---|---|
| Nyilvános létrehozás | admin (`ADMIN_EMAIL`) | ügyféladatok, minta, időpont, link: `${NEXT_PUBLIC_SERVER_URL}/admin/collections/bookings/{id}` |
| Létrehozás `pending` állapotban | ügyfél | „Megkaptam a foglalásod”: minta, időpont, ár, „hamarosan visszaigazolom” |
| Váltás `confirmed`-re (vagy létrehozás így) | ügyfél | „Jóváhagyva”: végleges időpont, minta, ár |
| Váltás `rejected`-re | ügyfél | rövid, udvarias elutasítás, link a mintákhoz |
| Váltás `cancelled`-re | ügyfél | a lemondás visszaigazolása |

A `completed` állapotra és az időpont-áthelyezésre nem megy e-mail. A sablonok egyszerű HTML-ek szöveges változattal, magyarul, a PANNIPIX hangvételében; az időpont Europe/Budapest szerint formázva.

## 8. Visszaélés elleni védelem (server action)

- **Csapdamező (honeypot):** ha ki van töltve, a válasz „sikeres”, de foglalás nem jön létre.
- **IP-alapú korlát, memóriában:** IP-nként óránként legfeljebb 3 létrejött foglalás. A Hostingeren egy Node processz fut; újrainduláskor a számláló nullázódik, ez elfogadott.
- **Bemenet-ellenőrzés:**
  - név: 2–100 karakter
  - e-mail: érvényes formátum
  - telefon: 6–20 karakter (számjegy, szóköz, `+`, `-`, zárójel)
  - testtáj: a listából
  - megjegyzés: legfeljebb 1000 karakter
  - 18+: kötelező

## 9. Weboldal

### 9.1 Adatok

- Az `app/(frontend)/page.tsx` aszinkron szerverkomponens, amely minden kéréskor friss adatot ad (`await connection()`), cache nélkül.
- A `lib/flash.ts` a Local API-ból képez a frontend típusaira: kollekciók, látható minták a képeikkel, foglalhatóság (szabály, limit, hátralévő alkalmak, elkelt-e).
- Az adatok propként jutnak a kliens komponensekhez (`FlashCollection`, `Spotlight`, `Paths`).
- A `components/data.ts`-ből kikerül a `designs` tömb és a `collections` lista; a típusok és a segédfüggvények maradnak.
- **Rendezés:** a „Legújabb” a létrehozás ideje szerint csökkenő, az ár szerinti rendezések maradnak.
- **Kollekciószűrő:** az adatbázis kollekcióiból, `order` szerint.
- **„Több minta mutatása”:** először 8 minta, gombnyomásra további 8. Ha minden minta látszik, a gomb eltűnik.
- **Kiemelt minta:** alapból a legújabb látható minta.

### 9.2 Kosár → foglalás

- **Kikerül:** a fejléc kosár ikonja a számlálóval, a kártyák táska gombja, valamint a `useStore` `cart` és `toggleCart` része.
- **Marad:** a kedvencek (szív), kliensoldali állapotként.
- **Kártya:** naptár ikonos gomb nyitja a foglalási ablakot (aria-label: „{név} – időpontfoglalás”). Elkelt mintánál nincs ilyen gomb.
- **Kiemelt rész:** „Időpontot foglalok” elsődleges gomb. Elkelt mintánál a meglévő „Hasonló egyedi tervet kérek” jelenik meg.

### 9.3 Foglalási ablak

Natív `<dialog>` fókuszkezeléssel és Esc-re zárással. Mobilon teljes képernyős lap, asztali nézetben középre igazított panel. A meglévő tokeneket használja (paper/ink, Bodoni + Jost, hairline) és az oldal mozgásnyelvét (`ease-settle`, a csökkentett mozgás beállítás tiszteletben tartása).

1. **Fejléc:** kép, név, ár, foglalhatóság („Egyszeri minta” / „Limitált · még 2 alkalom” / „Korlátlanul foglalható”). Alatta: *„A foglalás nem vásárlás: most nem fizetsz semmit, a részleteket a visszaigazolásban egyeztetjük.”*
2. **Időpont:**
   - Megnyitáskor egy server action tölti be a jövőbeli szabad időpontokat.
   - Napok szerint csoportosítva jelennek meg („okt. 14., kedd”), alattuk az időpontgombokkal („10:00”).
   - A címkéket a szerver formázza Europe/Budapest szerint, így nincs hidratációs eltérés.
   - Üres állapot: „Most nincs szabad időpont. Írj Instagramon (@pannipix), és szólok, ha újakat nyitok.”
3. **Adataid:** név, e-mail, telefon, testtáj, megjegyzés, 18+ jelölőnégyzet, rejtett csapdamező.
4. **Eredmény:**
   - Siker: összefoglaló („Megkaptam a foglalásod… e-mailben visszaigazolom”), majd a `router.refresh()` frissíti a foglalhatóságot az oldalon.
   - Közben elvitt időpont: visszalép az időpontokhoz, friss listával és üzenettel.
   - Betelt minta: üzenet, a foglalás nem folytatható.
   - Mezőhiba: a mező alatt jelenik meg.
   - Túl sok kérés vagy ismeretlen hiba: általános üzenet és az Instagram elérhetőség.

### 9.4 Szövegek

- A „vásárlás/megvásárlod” mindenhol „foglalás/lefoglalod” lesz: Szolgáltatások, a flash kollekció bevezetője, a Kiemelt rész „Hogyan működik?” blokkja, a Folyamat és a GYIK.
- **Folyamat (flash):** Választás → Időpontfoglalás → Visszaigazolás → Tetoválás.
- **Szolgáltatások / Flash:** az ártartomány az adatokból számolódik. A „Darabszám: Mindegyikből egy” helyére a kollekciónként eltérő szabály kerül.
- A Kiemelt rész „Egyszer elkészíthető minta” sora a kollekció szabálya szerint változik.
- **Elkelt minta:** „Elkelt” címke. Az ár helyén a kártyán „Lefoglalva”, a Kiemelt részben „Elkelt” áll.
- **Kapcsolat űrlap:** kikerül a „Flash minta” mód, a bevezető szöveg a mintáknál történő foglalásra utal. Az űrlap továbbra sem küld semmit (hatókörön kívül).

## 10. Seed (`npm run seed`)

- Csak üres adatbázison fut: ha már van kollekció, kilép.
- Létrehozza a 3 kollekciót **helyőrző szabállyal**: P’CONs = egyszeri, ORNX = limitált (3), daddywillhateus = korlátlan.
- Feltölti a jelenlegi 8 helyőrző mintát a `/public/flash` képekkel és a mostani alt szövegekkel. A „021” elkelt állapota egy múltbeli időponton lévő `completed` foglalásból jön.
- Felvesz néhány jövőbeli szabad időpontot a következő hetekre.

## 11. Konfiguráció és üzembe helyezés

`.env.example`:

```
PAYLOAD_SECRET=            # hosszú véletlen string
DATABASE_URL=file:./.data/pannipix.db
MEDIA_DIR=./.data/media
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
ADMIN_EMAIL=hello@pannipix.hu
EMAIL_FROM=PANNIPIX <hello@pannipix.hu>
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
```

- **Fejlesztés:** a `.data/` mappa gitignore-olt.
- **Hostinger:** a `DATABASE_URL` és a `MEDIA_DIR` a deploy mappán kívüli, írható könyvtárra mutasson (pl. `/home/<user>/pannipix-data/`). A WAL mód miatt a könyvtárnak is írhatónak kell lennie, mert ott jönnek létre a `-wal` és `-shm` fájlok.
- **Build:** a `next build` nem nyúl az adatbázishoz. A főoldal dinamikus, az admin és az API útvonalak eleve azok.
- **Migrációk:** induláskor a Payload lefuttatja a még nem futtatott migrációkat. Sémaváltozás után `npm run payload migrate:create`, majd commit.
- **Feltételezés:** a Hostingeren egy Node processz fut. A memóriabeli korlát és az induláskori migráció erre épít.
- **Mentés:** az SQLite fájlt és a média mappát rendszeresen menteni kell. A módja a README-be kerül.

## 12. Tesztelés

- **Vitest integrációs tesztek** ideiglenes SQLite fájlon, a valódi Payload konfigurációval, tehát a valódi hookokkal és indexekkel:
  1. Egyszeri minta: a második foglalás elutasítva; elutasítás után újra foglalható.
  2. Limitált minta (2): a harmadik foglalás elutasítva.
  3. Korlátlan minta: több foglalás is sikerül.
  4. Ugyanarra az időpontra érkező második foglalás elutasítva.
  5. Felszabadított foglalás nem aktiválható újra.
  6. Foglalt időpontra történő áthelyezés elutasítva.
  7. **Két egyidejű foglalás az utolsó alkalomra, illetve ugyanarra az időpontra: pontosan egy sikerül.**
  8. Nyilvános foglalás múltbeli időpontra vagy rejtett mintára elutasítva.
  9. A törlési szabályok.
- **Egységtesztek:** bemenet-ellenőrzés, a szabad sorszám számítása, időpont-formázás.
- Az `npm run lint`, a `tsc --noEmit` és a `next build` hiba nélkül fut le.
- **Kézi végigjátszás böngészőben:** kollekció, minta és időpont felvétele az adminban → foglalás az oldalon → jóváhagyás → e-mail a konzolban. Mobil nézetben is.

## 13. Hatókörön kívül

- Az egyedi tetoválás űrlap beküldése.
- Online fizetés, foglaló.
- Ügyfélfiókok; mintánkénti külön aloldalak és URL-ek.
- E-mail időpont-áthelyezésről; naptárszinkron (pl. Google Calendar).
- Tömeges időpont-létrehozó eszköz. Az admin egyesével vagy duplikálással veszi fel az időpontokat.
- Több minta egy időpontban.

## 14. Pontosításra váró pontok

- A fizetésről szóló mondat (9.3/1). Ha a fizetés máshogy működik (pl. foglalóval), igazítani kell.
- A kollekciók valódi szabályai. A seed csak helyőrző értékeket tölt be.
- Az SMTP fiók adatai és az admin értesítési címe (élesítéskor).

## 15. Ellenőrzött technikai tények (2026-10-06, a csomagok forrásából)

- A `@payloadcms/next` 3.90.2 peer függősége `next >=16.3.3 <17`, tehát a 16.3.8 támogatott. A `withPayload` Next 16-on Turbopack buildet is támogat, és megőrzi a meglévő `experimental` beállításokat.
- `@payloadcms/db-sqlite` 3.90.2: a tranzakciók alapból ki vannak kapcsolva (`defaultBeginTransaction` → `null`). A `wal` és a `busyTimeout` opció elérhető.
- Az egyszerű (nem `hasMany`) relationship mező a fő táblában `<mező>_id` oszlop, idegen kulccsal (`onDelete: set null`). A `unique: true` egyedi indexet hoz létre rajta.
- A gyűjtemény szintű `indexes: [{ fields, unique }]` (összetett index) támogatott.
- Az SQLite `UNIQUE constraint failed` hibából Payload `ValidationError` lesz (`handleUpsertError`), a hibás mező útvonalával.
- A date mezőnek van `timezone` opciója, és a `virtual` mezők is elérhetők. A magyar admin fordítás: `@payloadcms/translations/languages/hu`.
