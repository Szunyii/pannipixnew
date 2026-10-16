# Payload CMS + flash minta időpontfoglalás — tervdokumentum

**Dátum:** 2026-10-06 · **Állapot:** jóváhagyásra vár · **Ág:** `feature/payload-flash-booking`
**Kiinduló állapot:** Next 16.3.8, React 19.2.8, Tailwind 4, egyoldalas landing, magyar szövegek, Hostinger (managed Node.js).

> **Módosítva 2026-10-12:** az oldalon az időpontválasztó ki van kapcsolva, a látogató csak a mintát foglalja le, az időpontot az admin rendeli hozzá. Az eltéréseket a 16. szakasz írja le; a többi szakasz a bekapcsolt választót mutatja.
>
> **Módosítva 2026-10-12 (2.):** a kollekció a mintán választható legördülő listából, és a foglalhatóság is a minta mezője, nem a kollekcióé. Az eltéréseket a 17. szakasz írja le; a többi szakasz a kollekciónkénti szabályt mutatja.

## 1. Cél

A flash minták ma be vannak égetve a kódba (`components/data.ts`), és a felület vásárlást sugall (kosár, „Megvásárlod a mintát”). A cél:

- Az admin a Payload CMS felületén kezeli a flash mintákat, a kollekciókat és a szabad időpontokat.
- A látogató **időpontot foglal** egy mintára az admin által megadott időpontok közül. Ez nem vásárlás: az ár ki van írva, de az oldalon nincs fizetés.
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
- **E-mail:** `@payloadcms/email-nodemailer`, SMTP. Ha nincs beállítva SMTP (fejlesztés), a Payload csak egy sort naplóz a konzolra a címzettel és a tárggyal; a levél szövege nem látszik.
- **Admin nyelve:** magyar (`@payloadcms/translations/languages/hu`), magyar gyűjtemény- és mezőcímkékkel. Időzóna: Europe/Budapest.
- **Séma:** fejlesztésben `push` (automatikus szinkron). Élesben a `migrations/` mappába generált, commitolt migrációk futnak (`prodMigrations`), folyamatonként egyszer, a Payload első használatakor (az indítás utáni első kérésnél); a `next build` alatt soha.

Kódszervezés:

```
payload.config.ts
cms/
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
| `title` | text, automatikus, csak olvasható | pl. „2026. 10. 14. (szerda) 10:00”; ez látszik a kapcsolatválasztókban |
| állapot | számított (virtuális) | listaoszlop: *Szabad* / *Foglalt* / *Lejárt* (elmúlt, és nincs rajta foglalás) |

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
- Felszabadított foglalás nem állítható vissza aktívra. Hibaüzenet: „Ez a foglalás már nem aktiválható.” Az *Állapot* mező leírása az adminban elmondja, mikor kap az ügyfél levelet, és hogy ilyenkor új foglalást kell létrehozni. A két felszabadított állapot között szabad a váltás.
- Új foglalás nem jöhet létre eleve elutasított vagy lemondott állapotban. Hibaüzenet: „Új foglalás csak Függőben, Jóváhagyva vagy Elkészült állapotban hozható létre.”

### 6.2 Foglalhatóság

- `activeCount` = a minta aktív foglalásainak száma.
- A minta foglalható, ha nyilvános foglalásnál látható, **és** a kollekciója `unlimited`, **vagy** `activeCount < limit`.
- Hátralévő alkalmak: `limit − activeCount` (legalább 0). Ha 0, az oldalon „Elkelt”.
- Ha az admin szabályt vált, a meglévő foglalások nem változnak; a számítás az új szabállyal folytatódik.

### 6.3 Új foglalás (Bookings `beforeChange`, létrehozás)

Nyilvános és admin által felvett foglalásnál ugyanez fut; az eltérések jelölve.

1. Betölti a mintát a kollekciójával. Nyilvános foglalásnál a minta legyen `visible`.
2. **Egyetlen lekérdezéssel** beolvassa a minta aktív foglalásait a sorszámukkal. Ebből számolja az `activeCount`-ot és az 1..limit közötti legkisebb szabad sorszámot. Ha nincs ilyen: „Ez a minta már betelt.” Ez a lépés megelőzi az időpontét, mert egy betelt mintánál az ügyfélnek úgyis másikat kell választania.
3. Betölti az időpontot. Nyilvános foglalásnál legyen jövőbeli. Ha az időpontnak már van aktív foglalása, barátságos hibát ad. A végső garancia az egyedi index.
4. Kitölti a pillanatképeket és a `title`-t. Nyilvános foglalás állapota mindig `pending`.

### 6.4 Egyidejűség

- Két egyedi index védi a foglalásokat: `bookings.slot` és (`bookings.design`, `bookings.seat`). Az SQLite több `NULL` értéket is enged egy egyedi oszlopban, így a felszabadított és a korlátlan foglalások nem ütköznek.
- **Két kérés egyszerre ugyanarra az időpontra:** az egyik beszúrás `SQLITE_CONSTRAINT_UNIQUE` hibát kap. A Payload ezt `ValidationError`-rá alakítja, a hibás mező útvonalával. Az ügyfél ezt látja: „Ezt az időpontot közben lefoglalták, válassz másikat.”
- **Több kérés egyszerre ugyanarra a sorszámra:** egy átmegy, a többi elbukik az indexen, és néhány ezredmásodpercnyi véletlen várakozás után újrapróbálkozik, összesen legfeljebb 10-szer. Minden elvesztett kísérlet azt jelenti, hogy közben egy másik foglalás átment, így a következő kísérlet friss állapotot lát: a következő szabad sorszámot kapja, vagy „betelt” üzenetet. A felső korlát csak azt az esetet zárja le, amikor nincs előrehaladás (pl. egy sorszámot olyan sor tart, amelyet a hook nem számol aktívnak). Ekkor az ügyfél általános hibát lát, és a szerver naplózza az esetet.
- Az `activeCount` és a szabad sorszám ugyanabból az olvasásból jön, ezért a limit nem léphető túl. Aki régebbi állapotot lát, ugyanazt a sorszámot választja, mint a másik kérés, és az indexen elbukik.
- **Ismert szélső eset:** ha egy kérés még korlátlannak látja a kollekciót (sorszám nélkül), és közben az admin limitáltra állítja, ez a foglalás a régi szabály szerint jön létre. Ez megfelel a 6.2-nek: a szabályváltás a meglévő és a folyamatban lévő foglalásokat nem érinti.

### 6.5 Admin módosítások (Bookings `beforeChange`, frissítés)

- Ha a státusz felszabadítottra vált, a `slot` és a `seat` nullázódik.
- Aktív foglalás áthelyezhető egy másik szabad időpontra. Az egyedi index védi, a pillanatkép frissül.
- Ha aktív foglalásnál cserélődik a minta, a 6.3/3. lépés újrafut az új mintára, a foglalás saját korábbi alkalmát nem számolva.

### 6.6 Törlési szabályok (`beforeDelete`)

- Kollekció nem törölhető, amíg van benne minta.
- Minta nem törölhető, ha bármilyen foglalás tartozik hozzá. Helyette `visible = false`.
- Időpont nem törölhető, ha aktív foglalás tartozik hozzá.
- Foglalt időpont kezdése nem módosítható (különben a foglalás pillanatképe és a levelek a régi időt mutatnák): új időpontot kell felvenni, és arra áthelyezni a foglalást.
- Foglalás törölhető (pl. spam esetén); a törlés felszabadítja az időpontot és az alkalmat.

## 7. E-mailek

A levelek a Bookings `afterChange` hookjából mennek. Ha a küldés nem sikerül, az soha nem buktatja el a mentést, csak `payload.logger.error` naplózza.

| Esemény | Címzett | Tartalom |
|---|---|---|
| Nyilvános létrehozás | admin (`ADMIN_EMAIL`) | ügyféladatok, minta, időpont, link: `${SITE_URL}/admin/collections/bookings/{id}` |
| Létrehozás `pending` állapotban | ügyfél | „Megkaptam a foglalásod”: minta, időpont, ár, „hamarosan visszaigazolom” |
| Váltás `confirmed`-re (vagy létrehozás így) | ügyfél | „Visszaigazolva”: végleges időpont, minta, ár, és hogy a részleteket (pl. a pontos elhelyezést) válaszlevélben egyeztetjük |
| Váltás `rejected`-re | ügyfél | rövid, udvarias elutasítás, link a mintákhoz |
| Váltás `cancelled`-re | ügyfél | a lemondás visszaigazolása |

A `completed` állapotra és az időpont-áthelyezésre nem megy e-mail. Státuszjavításkor sem megy ismételt levél: a visszaigazolás csak függő állapotból, az elutasítás és a lemondás csak aktív állapotból indul. A levelek indítása nem várja meg a küldést. Ez egyetlen, folyamatosan futó Node folyamatot feltételez (`next start`, Hostinger); egy újraindításkor éppen küldés alatt álló levél elveszhet. Ha élesben hiányzik az `ADMIN_EMAIL`, a `SITE_URL` vagy az `SMTP_HOST`, indításkor figyelmeztetés kerül a naplóba. A sablonok egyszerű HTML-ek szöveges változattal, magyarul, a PANNIPIX hangvételében; az időpont Europe/Budapest szerint formázva.

## 8. Visszaélés elleni védelem (server action)

- **Csapdamező (honeypot):** ha ki van töltve, a válasz „sikeres”, de foglalás nem jön létre.
- **IP-alapú korlát, memóriában:** IP-nként óránként legfeljebb 3 létrejött foglalás. A Hostingeren egy Node processz fut; újrainduláskor a számláló nullázódik, ez elfogadott. A látogató címe az `X-Forwarded-For` jobbról `TRUSTED_PROXY_HOPS`-adik eleme (alapból 1). IPv6-nál a /64-es előtag számít. Ha nincs használható nyilvános cím, a korlát kimarad, nehogy minden látogató egy közös keretet kapjon; ilyenkor a napló egyszer figyelmeztet. Belső címnek számít a loopback, a privát tartományok, a link-local, az ULA és a CGNAT (100.64.0.0/10). A `TRUSTED_PROXY_HOPS` (a körülötte lévő szóközök nélkül) csak számjegyekből álló érték lehet; minden más 1-nek számít, és csak a kifejezett `0` kapcsolja ki a korlátot (erről is figyelmeztet a napló).
- **Bemenet-ellenőrzés:**
  - név: 2–100 karakter
  - e-mail: érvényes formátum (ugyanaz a szabály, mint a Payload e-mail mezőjéé)
  - telefon: 6–20 karakter, legalább 6 számjegy (számjegy, szóköz, `+`, `-`, `/`, `.`, zárójel). A beillesztett számok speciális szóközei és kötőjelei normál szóközzé és kötőjellé alakulnak.
  - testtáj: a listából
  - megjegyzés: legfeljebb 1000 karakter
  - 18+: kötelező

## 9. Weboldal

### 9.1 Adatok

- Az `app/(frontend)/page.tsx` aszinkron szerverkomponens, amely minden kéréskor friss adatot ad (`await connection()`), cache nélkül.
- A `lib/flash.ts` a Local API-ból képez a frontend típusaira: kollekciók, látható minták a képeikkel, foglalhatóság (szabály, limit, hátralévő alkalmak, elkelt-e).
- Az adatok propként jutnak a kliens komponensekhez (`FlashCollection`, `Spotlight`, `Paths`).
- A `components/data.ts`-ből kikerül a `designs` tömb és a `collections` lista; a típusok és a segédfüggvények maradnak.
- **Rendezés:** a „Legújabb” a létrehozás ideje szerint csökkenő. Az ár szerinti rendezések maradnak, de az elkelt minták a végükre kerülnek.
- **Kollekciószűrő:** az adatbázis kollekcióiból, `order` szerint.
- **„Több minta mutatása”:** először 8 minta, gombnyomásra további 8. Ha minden minta látszik, a gomb eltűnik.
- **Kiemelt minta:** alapból a legújabb foglalható minta; ha nincs ilyen, a legújabb látható.

### 9.2 Kosár → foglalás

- **Kikerül:** a fejléc kosár ikonja a számlálóval, a kártyák táska gombja, valamint a `useStore` `cart` és `toggleCart` része.
- **Marad:** a kedvencek (szív), kliensoldali állapotként.
- **Kártya:** naptár ikonos gomb nyitja a foglalási ablakot (aria-label: „{név} – időpontfoglalás”). Elkelt mintánál nincs ilyen gomb.
- **Kiemelt rész:** „Időpontot foglalok” elsődleges gomb. Elkelt mintánál a meglévő „Hasonló egyedi tervet kérek” jelenik meg.

### 9.3 Foglalási ablak

Natív `<dialog>` fókuszkezeléssel és Esc-re zárással. Mobilon teljes képernyős lap, asztali nézetben vízszintesen középre igazított, felül rögzített panel, amely a tartalommal lefelé nő (így nem ugrik, amikor betöltenek az időpontok). Bezáráskor a fókusz visszakerül a megnyitó gombra; ha az közben eltűnt (a minta elkelt), a helyére lépő vagy a környezetében lévő első fókuszálható elemre. A meglévő tokeneket használja (paper/ink, Bodoni + Jost, hairline) és az oldal mozgásnyelvét (`ease-settle`, a csökkentett mozgás beállítás tiszteletben tartása).

1. **Fejléc:** kép, név, ár, foglalhatóság („Egyszeri minta” / „Limitált · még 2 alkalom” / „Korlátlanul foglalható”). Alatta: *„A foglalás nem vásárlás: most nem fizetsz semmit, a részleteket a visszaigazolásban egyeztetjük.”*
2. **Időpont:**
   - Megnyitáskor egy server action tölti be a jövőbeli szabad időpontokat.
   - Napok szerint csoportosítva jelennek meg („okt. 14., szerda”), alattuk az időpontgombokkal („10:00”).
   - A címkéket a szerver formázza Europe/Budapest szerint, így nincs hidratációs eltérés.
   - Üres állapot: „Most nincs szabad időpont. Írj Instagramon (@pannipix), és szólok, ha újakat nyitok.”
3. **Adataid:** név, e-mail, telefon, testtáj, megjegyzés, 18+ jelölőnégyzet, rejtett csapdamező.
4. **Eredmény:**
   - Siker: összefoglaló („Megkaptam a foglalásod… e-mailben visszaigazolom”). A server action ugyanabban a válaszban az oldalt is újrarendereli (`refresh()` a `next/cache`-ből), így a foglalhatóság már frissült, mire az ablak a sikert mutatja.
   - Közben elvitt időpont: visszalép az időpontokhoz, friss listával és üzenettel.
   - Betelt vagy közben elrejtett minta: üzenet, a foglalás nem folytatható, és az oldal is frissül.
   - Mezőhiba: a mező alatt jelenik meg.
   - Túl sok kérés vagy ismeretlen hiba: általános üzenet és az Instagram elérhetőség.
   - Ha a kérés el sem jut a szerverig (megszakadt kapcsolat), vagy a Payload nem indul el: ugyanez az általános üzenet, a kitöltött űrlap megmarad. Ha az oldal egy újratelepítés miatt elavult: „Az oldal közben frissült…” üzenet és újratöltés gomb.
   - Végső védőhálóként az oldal saját, magyar hibaoldalt kap a Next alapértelmezett hibaképernyője helyett.

### 9.4 Szövegek

- A „vásárlás/megvásárlod” mindenhol „foglalás/lefoglalod” lesz: Szolgáltatások, a flash kollekció bevezetője, a Kiemelt rész „Hogyan működik?” blokkja, a Folyamat és a GYIK.
- **Folyamat (flash):** Választás → Időpontfoglalás → Visszaigazolás → Tetoválás.
- **Szolgáltatások / Flash:** az ártartomány az adatokból számolódik. A „Darabszám: Mindegyikből egy” helyére a kollekciónként eltérő szabály kerül.
- A Kiemelt rész „Egyszer elkészíthető minta” sora a kollekció szabálya szerint változik.
- **Elkelt minta:** „Elkelt” címke. Az ár helyén a kártyán „Lefoglalva”, a Kiemelt részben „Elkelt” áll.
- **Kapcsolat űrlap:** kikerül a „Flash minta” mód, a bevezető szöveg a mintáknál történő foglalásra utal. Az űrlap továbbra sem küld semmit (hatókörön kívül).

## 10. Seed (`npm run seed`)

- Csak üres adatbázison fut: ha már van kollekció, kilép. Ha egy korábbi futás félbeszakadt, a kilépő üzenet elmondja a teendőt: friss adatbázis és média mappa.
- Éles módban (`NODE_ENV=production`) nem fut: még a Payload indítása előtt hibával kilép, így egy friss éles adatbázist sem tölthet fel helyőrzőkkel.
- Létrehozza a 3 kollekciót **helyőrző szabállyal**: P’CONs = egyszeri, ORNX = limitált (3), daddywillhateus = korlátlan.
- Feltölti a jelenlegi 8 helyőrző mintát a `/public/flash` képekkel és a mostani alt szövegekkel. A „021” elkelt állapota egy múltbeli időponton lévő `completed` foglalásból jön.
- Felvesz 12 jövőbeli szabad időpontot a következő három hétre (kedden és csütörtökön, 10:00-kor és 15:00-kor, budapesti idő szerint). Az #021 demó foglalása `archiv@example.com` címre szól, nem valódi postafiókra.

## 11. Konfiguráció és üzembe helyezés

`.env.example`:

```
PAYLOAD_SECRET=            # hosszú véletlen string
DATABASE_URL=file:./.data/pannipix.db
MEDIA_DIR=./.data/media
SITE_URL=http://localhost:3000
ADMIN_EMAIL=hello@pannipix.hu
EMAIL_FROM_ADDRESS=hello@pannipix.hu
EMAIL_FROM_NAME=PANNIPIX
SMTP_HOST=                 # élesben pl. smtp.hostinger.com; üresen a levelek a konzolra mennek
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
TRUSTED_PROXY_HOPS=1
```

- **Fejlesztés:** a `.data/` mappa gitignore-olt.
- **Hostinger:** a `DATABASE_URL` és a `MEDIA_DIR` a deploy mappán kívüli, írható könyvtárra mutasson (pl. `/home/<user>/pannipix-data/`). A WAL mód miatt a könyvtárnak is írhatónak kell lennie, mert ott jönnek létre a `-wal` és `-shm` fájlok.
- **Build:** a `next build` nem nyúl az adatbázishoz. A főoldal dinamikus, az admin és az API útvonalak eleve azok.
- **Migrációk:** az indítás utáni első kérésnél a Payload lefuttatja a még nem futtatott migrációkat. Tranzakció nélkül futnak, ezért migráció élesítése előtt mentés kell. Sémaváltozás után `npm run payload migrate:create`, majd commit; a `tests/int/migrations.test.ts` elbukik, ha a migrációk sémája eltér a gyűjteményekétől, és ha egy `down` nem tud lefutni. Az éles adatbázison nem futhat `next dev` vagy seed: a push `dev` jelölést hagy, amitől az éles indítás egy interaktív kérdésnél megáll.
- **Feltételezés:** a Hostingeren egy Node processz fut. A memóriabeli korlát és a migrációk futtatása erre épít.
- **Mentés:** az SQLite fájlt és a média mappát rendszeresen menteni kell. A módja a README-be kerül.

## 12. Tesztelés

- **Vitest integrációs tesztek** ideiglenes SQLite fájlon, a valódi Payload konfigurációval, tehát a valódi hookokkal és indexekkel:
  1. Egyszeri minta: a második foglalás elutasítva; elutasítás után újra foglalható.
  2. Limitált minta (2): a harmadik foglalás elutasítva.
  3. Korlátlan minta: több foglalás is sikerül.
  4. Ugyanarra az időpontra érkező második foglalás elutasítva.
  5. Felszabadított foglalás nem aktiválható újra.
  6. Foglalt időpontra történő áthelyezés elutasítva.
  7. Foglalt időpont kezdésének módosítása elutasítva.
  7. **Két egyidejű foglalás az utolsó alkalomra, illetve ugyanarra az időpontra: pontosan egy sikerül.**
  8. Nyilvános foglalás múltbeli időpontra vagy rejtett mintára elutasítva.
  9. A törlési szabályok.
- **Egységtesztek:** bemenet-ellenőrzés, a szabad sorszám számítása, időpont-formázás.
- Az `npm run lint`, a `tsc --noEmit` és a `next build` hiba nélkül fut le.
- **Kézi végigjátszás böngészőben:** kollekció, minta és időpont felvétele az adminban → foglalás az oldalon → jóváhagyás → e-mail sor (címzett, tárgy) a konzolban. Mobil nézetben is.

## 13. Hatókörön kívül

- Az egyedi tetoválás űrlap beküldése.
- Online fizetés, foglaló.
- Ügyfélfiókok; mintánkénti külön aloldalak és URL-ek.
- E-mail időpont-áthelyezésről; naptárszinkron (pl. Google Calendar).
- Tömeges időpont-létrehozó eszköz. Az admin egyesével veszi fel az időpontokat. A duplikálás ki van kapcsolva, mert egy kezdési idő csak egyszer szerepelhet.
- Több minta egy időpontban.

## 14. Pontosításra váró pontok

- A fizetésről szóló mondat (9.3/1). Ha a fizetés máshogy működik (pl. foglalóval), igazítani kell. A pontos mondat a `lib/copy.ts` `PAYMENT_NOTE` konstansa; szó szerint idézi a „megkaptam” e-mail, a foglalási ablak és a GYIK. Rövidebb változatai a Folyamat lépéseiben és a Kiemelt rész „Hogyan működik?” blokkjában vannak.
- A kollekciók valódi szabályai. A seed csak helyőrző értékeket tölt be.
- Az SMTP fiók adatai és az admin értesítési címe (élesítéskor).

## 15. Ellenőrzött technikai tények (2026-10-06, a csomagok forrásából)

- A `@payloadcms/next` 3.90.2 peer függősége `next >=16.3.3 <17`, tehát a 16.3.8 támogatott. A `withPayload` Next 16-on Turbopack buildet is támogat, és megőrzi a meglévő `experimental` beállításokat.
- `@payloadcms/db-sqlite` 3.90.2: a tranzakciók alapból ki vannak kapcsolva (`defaultBeginTransaction` → `null`). A `wal` és a `busyTimeout` opció elérhető.
- Az egyszerű (nem `hasMany`) relationship mező a fő táblában `<mező>_id` oszlop, idegen kulccsal (`onDelete: set null`). A `unique: true` egyedi indexet hoz létre rajta.
- A gyűjtemény szintű `indexes: [{ fields, unique }]` (összetett index) támogatott.
- Az SQLite `UNIQUE constraint failed` hibából Payload `ValidationError` lesz (`handleUpsertError`), a hibás mező útvonalával.
- A date mezőnek van `timezone` opciója, és a `virtual` mezők is elérhetők. A magyar admin fordítás: `@payloadcms/translations/languages/hu`.

## 16. Módosítás (2026-10-12): az időpontválasztó ki van kapcsolva

Egyelőre a látogató csak a mintát foglalja le, időpontot nem választ; az időpontot az admin rendeli a foglaláshoz. Az időpontválasztó kódja megmaradt: a `lib/features.ts` `SLOT_PICKING` konstansa kapcsolja, az értéke most `false`. A fenti szakaszok a bekapcsolt (`true`) állapotot írják le.

### 16.1 Ami a kapcsolótól függ (kikapcsolva)

- **Foglalási ablak (9.3):** egyetlen lépés (*Adataid*); nincs időpontlépés, és az ablak nem kér le időpontokat. A fejléc felirata „Foglalás”. Siker után: „Hamarosan átnézem, és e-mailben visszaigazolom; az időpontot utána egyeztetjük.”
- **Bemenet-ellenőrzés (8.):** a `slotId` nem kötelező. Ha valaki mégis elküldi, a szerver figyelmen kívül hagyja, és a foglalás időpont nélkül jön létre.
- **Az oldal szövegei (9.2, 9.4):** „időpontfoglalás” helyett „foglalás”. Érintett: a kártya gombja („{név} – foglalás”), a Kiemelt rész gombja („Lefoglalom”) és „Hogyan működik?” blokkja, a Folyamat (Választás → Foglalás → Visszaigazolás → Tetoválás), a Szolgáltatások flash leírása, a Kapcsolat bevezetője és az oldal meta leírása. A `PAYMENT_NOTE` nem változik.
- **Admin leírások:** a *Foglalások* és az *Időpontok* gyűjtemény leírása elmondja, hogy az időpontot az admin adja meg.
- **E-mailek (7.):** elutasításnál és lemondásnál a mintákhoz visszavezető mondat és a link felirata („Flash minták”) nem ígér szabad időpontokat.

### 16.2 Ami mindkét állapotban érvényes

- **Az időpont nem kötelező az aktív foglaláson (6.1, 6.3, 6.5).** A foglalás időpont nélkül is leköti a minta egy alkalmát. Az admin a foglalás *Időpont* mezőjében bármikor megadhat, cserélhet vagy törölhet időpontot; a `slot` egyedi indexe és a „csak szabad időpont” szabály változatlan. Ha az időpont lekerül egy aktív foglalásról, a `slotStartsAt` pillanatkép is törlődik (felszabadításkor továbbra is megmarad). Időpontot csak a nyilvános foglalás követel meg, és csak bekapcsolt választó mellett („Válassz időpontot.”).
- **E-mailek (7.):** az időpont csak akkor szerepel a levél soraiban és tárgyában, ha a foglalásnak már van.
  - „Megkaptam” levél időpont nélkül: jelzi, hogy az időpontot a visszaigazolás után egyeztetjük.
  - Visszaigazolás időpont nélkül: a tárgya „Visszaigazolva: {minta}”, és azt írja, hogy az időpontot és a részleteket válaszlevélben egyeztetjük.
  - Az adminnak szóló levél időpont nélkül: a foglalás „jóváhagyásra és időpontra vár”.
  - Időpont megadásáról vagy cseréjéről továbbra sem megy külön levél. A visszaigazolásba akkor kerül be az időpont, ha az admin a jóváhagyással egy mentésben adja meg.
- **Séma:** nem változik, migráció nem kell (a `slot` oszlop eddig is lehetett üres).

### 16.3 Visszakapcsolás

A `SLOT_PICKING` értékét `true`-ra kell állítani, majd futtatni az `npm run generate:types` parancsot (az admin leírások a `payload-types.ts` megjegyzéseibe is bekerülnek). A tesztek mindkét állapotot rögzítik, mert a kapcsolót maguk állítják, így az átállítás nem töri el őket. A kikapcsolt időszakban időpont nélkül létrejött foglalások ezután is menthetők, mert az admin oldalon az időpont nem kötelező.

### 16.4 Tesztelés

A 12. szakasz listája kiegészül:

- Nyilvános foglalás időpont nélkül; egyszeri mintára két egyidejű kérésből pontosan egy sikerül.
- Bekapcsolt választó mellett a nyilvános foglalás időpont nélkül elutasítva, az adminé nem.
- Admin foglalás időpont nélkül; időpont utólagos megadása és elvétele (az elvett időpont újra kiadható).
- Levelek időponttal és anélkül; elutasítás és lemondás szövege mindkét kapcsolóállásban.
- Bemenet-ellenőrzés mindkét kapcsolóállásban.

## 17. Módosítás (2026-10-12): a kollekció és a foglalhatóság a mintán van

A kollekció már nem külön gyűjtemény: a minta legördülő listából választja ki, és azt is a minta adja meg, hányszor foglalható. A fenti szakaszok a kollekciónkénti szabályt írják le; ahol ez a szakasz mást mond, ez érvényes.

### 17.1 Adatmodell (4.1, 4.2)

- A `categories` gyűjtemény megszűnt, az adminban nincs *Kollekciók* menüpont.
- A kollekciók listája a kódban van: `lib/categories.ts`, `CATEGORIES` (`pcons` → P’CONs, `ornx` → ORNX, `daddywillhateus` → daddywillhateus). A lista sorrendje az oldal szűrőjének sorrendje. Új kollekció egy új sor; migráció nem kell hozzá, mert az oszlop sima szöveg.
- `designs.category`: `select`, kötelező, a lista értékeivel (korábban kapcsolat a `categories` gyűjteményre). A `(category, number)` egyedi index megmaradt.
- `designs.rule` (`single` | `limited` | `unlimited`, alapértelmezés: `single`) és `designs.limit` (csak `limited` mellett, legalább 2; más szabálynál mentéskor törlődik). A két mező a kollekcióról került át, a jelentésük nem változott. Az admin listában a *Foglalhatóság* oszlop is látszik.
- A minta `title` mezője a kollekció feliratából és a sorszámból áll („P’CONs #027”). Ha egy felirat megváltozik a listában, az érintett mintákat újra kell menteni; a kollekció átnevezését követő automatikus újramentés megszűnt.

### 17.2 Foglalási szabályok (6.2–6.6)

- A foglalhatóságot a minta `rule` és `limit` mezője adja. A 6.2–6.5 logikája egyébként nem változott: a helyek kiosztása, az egyedi indexek, a csökkentett limit és a korábban korlátlan minta kezelése ugyanaz, csak a szabály forrása a minta.
- Egy kollekción belül a minták foglalhatósága eltérhet.
- A kollekció törlési szabálya (6.6) megszűnt; a mintáé, az időponté és a képé változatlan.

### 17.3 Weboldal (9.1, 9.4)

- `getFlashCatalog()` csak a mintákat adja vissza; a kollekciók a `CATEGORIES` listából jönnek.
- A szűrő a lista minden kollekcióját mutatja, akkor is, ha valamelyikben nincs látható minta.
- A Szolgáltatások „Alkalmak” sora: ha minden látható minta foglalhatósága azonos, annak a neve (Egyszeri, Limitált, Korlátlan); különben, és amíg nincs látható minta, „Mintánként megadva”.
- Szövegek: a flash rész bevezetője vegyes foglalhatóságnál „…ezt minden mintánál jelzem.”; a GYIK válasza „Ez mintánként változik, mindegyiknél jelzem.” kezdetű.

### 17.4 Seed és migráció (10., 11.)

- A seed nem hoz létre kollekciókat. A helyőrző minták mind P’CONs, egyszeri foglalhatósággal. A seed akkor marad ki, ha az adatbázisban már van minta.
- Éles adatbázis a módosításkor még nem volt, ezért nincs átalakító migráció: az induló migráció újra lett generálva (`20261012_105725_initial`). A `down` törlési sorrendje (előbb a gyerek táblák) ugyanúgy kézzel van igazítva, mint az előzőben.
- Egy korábbi sémával létrejött fejlesztői adatbázison a dev szerver séma-szinkronja nem megy végig magától: kérdést tesz fel a terminálban (elsőként azt, hogy a `designs` tábla `category` oszlopa új-e vagy átnevezés), és addig az oldal nem tölt be. Ilyen adatbázisnál a legegyszerűbb az újrakezdés (`rm -rf .data && npm run seed`).

### 17.5 Tesztelés

A 12. szakasz listája így módosul:

- A minta kollekciója csak a lista egyik értéke lehet; a név a feliratból áll össze, és a minta áthelyezésekor frissül.
- Limitált mintánál legalább 2 alkalom kell; nem limitált mintáról a limit mentéskor törlődik; a foglalhatóság alapértéke egyszeri.
- Egy kollekción belül minden minta a saját szabálya szerint foglalható, és az oldal is eszerint mutatja.
- A minta limitjének csökkentése és a korlátlanról limitáltra váltás (korábban a kollekción).
- A kollekció gyűjteményre vonatkozó tesztek (átnevezés, sorrend, törlés, olvasási jog) megszűntek.

## 18. Módosítás (2026-10-12): a minta saját oldalon

A „Kiemelt” (`#kiemelt`) rész lekerült a főoldalról: minden látható minta saját oldalt kap, `/flash/<kollekció értéke>/<sorszám>` címen (pl. `/flash/pcons/028`). A kártya képe és a „Részletek” gombja ide vezet. Az oldal a 9.1 szerinti katalógusból dolgozik (egy kérésen belül egyszer olvasva), kérésenként renderelődik, és 404-et ad, ha a minta nem látható vagy nincs. Tetején „Flash minták” link a főoldal flash részére, jobbra „Előző | Következő” a kollekció sorának sorrendjében (legújabb elöl, az elkeltek a végén). A fejléc, a lábléc, a kedvencek és a foglalási ablak a layoutban van, így a minta oldalán is működnek; a fejléc és a lábléc horgonyai `/#…` alakúak. A főoldal `<main>` eleme is a layoutban van.
