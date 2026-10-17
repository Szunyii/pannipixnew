# Admin nyitó oldal: foglalási dashboard — tervdokumentum

**Dátum:** 2026-10-16 · **Állapot:** megvalósítva (2026-10-17, `feature/admin-dashboard`) · **Alap:** a `feature/payload-flash-booking` ág akkori állapota
**Kiinduló állapot:** Payload 3.90.2 (pontosan rögzítve), Next 16.3.8, magyar admin. A `/admin` nyitó oldalán ma egyetlen widget van, a Payload gyűjteménykártyái.

> **Módosítva 2026-10-17 (megvalósítás):** a kódreview-k és a böngészős próba nyomán néhány ponton eltér a fenti tervtől. Ezeket a szakaszokban helyben javítottam:
> - **A linkek nem visznek rendezést (3.1–3.3, 6.).** A Payload listanézete a kapott rendezést az admin saját beállításaként menti, így egy widget linkje tartósan átrendezné a *Foglalások* listát. A szűrt lista ezért a megszokott sorrendjében nyílik.
> - **Az „Elkelt minta” linkje (3.1, 6., 12.)** egyetlen, vesszővel elválasztott `id` listát ad át, mert a `qs-esm` 21 elemnél hosszabb indexelt listát objektummá alakít.
> - **Szerkesztő mód (7.):** három szöveg pontosabb lett.
> - **Hibakezelés (9., 12.):** a sorok dátumszövege is a `loadSafely`-n belül készül. A Payload egyik úton sem fogja meg a widget aszinkron hibáját.
> - **Akadálymentesség és elrendezés (6.):** látható fókuszkeret, jobb kontraszt, keskeny listák 260 px alatt.
> - **Tesztek (10.):** a widgetek renderelési tesztet is kaptak.

## 1. Cél

Az admin nyitó oldalán első ránézésre látszódjon, melyik flash mintát foglalták le, mi vár intézésre, és mi a következő időpont. A dashboard a Payload saját widgetrendszerére és UI-elemeire épül. A widgeteket az admin maga rakhatja be, veheti ki, méretezheti át és rendezheti át.

## 2. Meghozott döntések

| Kérdés | Döntés |
|---|---|
| Mit mutasson? | A legutóbbi foglalásokat, a lefoglalt mintákat, a teendőket (számlálók és függő foglalások), és a közelgő időpontokat is. |
| Ki-be rakás | A Payload beépített szerkesztő módja: hozzáadás, törlés, átméretezés, áthúzás, alapelrendezés visszaállítása. Az elrendezést a Payload adminonként menti. |
| Felépítés | Név szerinti widgetek: minden nézet külön widget a saját nevével, beállítás nélkül. A négy foglaláslista egy közös komponens. |
| Elvetve | Beállítható widgetek (nézet és sorszám a widget beállításaiban): két lépés, több kód. Saját blokk a dashboard felett (`beforeDashboard`): a ki-be rakást újra kellene írni. |
| Kockázat | A Payload 3.90.2 az `admin.dashboard` opciót kísérletinek jelöli. A verzió pontosan rögzítve van, a regisztráció egy fájlban áll, az adatfüggvények nem függnek tőle. |

## 3. Widgetek

| Slug | Név | Komponens | Legkisebb | Legnagyobb |
|---|---|---|---|---|
| `overview` | Áttekintés | `Overview` | fél (`medium`) | teljes |
| `pending-bookings` | Jóváhagyásra vár | `BookingList`, nézet: `pending` | harmad (`small`) | teljes |
| `unscheduled-bookings` | Időpontra vár | `BookingList`, nézet: `unscheduled` | harmad | teljes |
| `upcoming-bookings` | Közelgő időpontok | `BookingList`, nézet: `upcoming` | harmad | teljes |
| `recent-bookings` | Legutóbbi foglalások | `BookingList`, nézet: `recent` | harmad | teljes |
| `booked-designs` | Lefoglalt minták | `BookedDesigns` | fél | teljes |
| `collections` | Gyűjtemények | a Payload `CollectionCards` widgetje, változatlanul | teljes | teljes |

Az „aktív” foglalás itt is azt jelenti, mint a foglalási szabályokban: *Függőben*, *Jóváhagyva* vagy *Elkészült* (`ACTIVE_STATUSES`).

### 3.1 Áttekintés

Négy számláló egy sorban; a widget szűkebb szélességén kettő-kettő egymás alatt.

| Számláló | Mit számol | Hová visz |
|---|---|---|
| Jóváhagyásra vár | *Függőben* foglalások | a foglaláslista, erre szűrve |
| Időpontra vár | *Jóváhagyva* foglalások időpont nélkül | a foglaláslista, erre szűrve |
| Közelgő időpont | *Függőben* vagy *Jóváhagyva* foglalások, amelyek időpontja (`slotStartsAt`) a jövőben van | a foglaláslista, erre szűrve |
| Elkelt minta | minták, amelyeknek a foglalhatósága betelt, a rejtetteket is beleértve; ugyanaz a számítás, mint az oldal „Elkelt” címkéjénél (`availability()`) | a Flash minták listája, ezekre a mintákra szűrve (`id` in, egy vesszővel elválasztott értékként) |

A 0 értékű számláló nem link. A linkek csak szűrnek, rendezést nem visznek: a lista a megszokott (mentett) sorrendjében nyílik.

### 3.2 A négy foglaláslista

Egy sor: a minta képe, a minta neve, a foglaló neve és egy dátum, jobb oldalt az állapot. A sor a foglalás szerkesztő oldalára visz. Egy lista legfeljebb 5 sort mutat, a címe mellett „Mind (N) →” link vezet a foglaláslistára ugyanazzal a szűréssel, rendezés nélkül (csak ha N > 0). A foglalónak csak a neve látszik, az e-mail címe és a telefonszáma nem.

| Nézet | Szűrés | Rendezés | Dátum a sorban | Üres állapot |
|---|---|---|---|---|
| `pending` | *Függőben* | beérkezés, a legrégebbi felül | „beérkezett tegnap 19:05” | Nincs jóváhagyásra váró foglalás. |
| `unscheduled` | *Jóváhagyva* és nincs időpont | beérkezés, a legrégebbi felül | „beérkezett okt. 13.” | Minden jóváhagyott foglalásnak van időpontja. |
| `upcoming` | *Függőben* vagy *Jóváhagyva*, és `slotStartsAt` a jövőben | időpont, a legközelebbi felül | „okt. 20., kedd 10:00” | Nincs közelgő időpont. |
| `recent` | minden állapot | beérkezés, a legfrissebb felül | „ma 14:32” | Még nincs foglalás. |

- A két teendőlistában azért van a legrégebbi felül, mert ezeket sorban érdemes intézni.
- Az *Időpontra vár* nem tartalmazza a függő foglalásokat (azok a *Jóváhagyásra vár* listában vannak), így a két teendőlista nem tartalmazza kétszer ugyanazt a foglalást.
- A beérkezés dátuma: „ma 14:32”, „tegnap 19:05”, egyébként „okt. 13.”, más évben „2025. okt. 13.”; budapesti idő szerint.
- Az időpont a foglalás pillanatképe (`slotStartsAt`). Aktív foglalás időpontjának kezdése nem változhat (`guardSlotTimeChange`), ezért ez megbízható.
- A minta neve a betöltött mintáé (`P’CONs #027`). Ha a minta nem töltődik be, a foglalás pillanatképe (`designName`) áll a helyén.

Állapotok (`Pill`, a felirat a `STATUS_LABELS`-ből):

| Állapot | `pillStyle` |
|---|---|
| Függőben | `warning` |
| Jóváhagyva | `success` |
| Elkészült | `light` |
| Elutasítva, Lemondva | `light-gray` |

### 3.3 Lefoglalt minták

- Azok a minták, amelyeknek van aktív foglalása (rejtett minták is), az utolsó aktív foglalás szerint a legutóbbi elöl, legfeljebb 12.
- Kártya: a minta képe, neve és egy címke (`Pill`):
  - betelt: „Elkelt · 1/1” (`dark`); a szám az aktív foglalások és a limit, akkor is, ha a limitet utólag a foglalások száma alá vették („Elkelt · 4/3”);
  - limitált, van még hely: „2 / 3 alkalom” (`light`), azaz aktív foglalások / limit;
  - korlátlan: „4 foglalás” (`light`), az aktív foglalások száma.
- A kártya a foglaláslistára visz, a mintára szűrve.
- Üres állapot: „Még nincs lefoglalt minta.”

### 3.4 Gyűjtemények

A Payload saját widgetje marad, változatlan tartalommal. Mivel a Payload címke nélkül regisztrálja, a hozzáadás listájában „Collections” állna; a config utólag „Gyűjtemények” címkét ad neki (6. szakasz).

## 4. Alapelrendezés

Ezt látja az admin, amíg nem mentett saját elrendezést, és ide tér vissza az „Alapelrendezés visszaállítása” után:

1. Áttekintés (teljes)
2. Jóváhagyásra vár (fél) · Időpontra vár (fél)
3. Közelgő időpontok (fél) · Legutóbbi foglalások (fél)
4. Lefoglalt minták (teljes)
5. Gyűjtemények (teljes)

768 px alatt a Payload minden widgetet teljes szélességűre vesz, egymás alá.

## 5. Szerkesztés

A Payload kész szerkesztő módját használjuk, nem írunk sajátot. A felső sáv „Irányítópult” menüjéből indul: widget hozzáadása listából, törlése, átméretezése a saját legkisebb és legnagyobb mérete között, áthúzása, mentés vagy elvetés, illetve az alapelrendezés visszaállítása. Az elrendezés a Payload `payload-preferences` gyűjteményébe kerül, adminonként. Szerkesztés közben hozzáadott widget a legkisebb méretén indul; ezért minden widget a saját szélességéhez igazodik (CSS container query vagy `auto-fill` rács), nem a képernyőéhez. Egy 260 px-nél keskenyebb listában az állapot a szöveg alá, a „Mind (N) →” a cím alá kerül. Az átméretezés választójában a szélességek angol neve látszik (`small` … `full`, százalékkal); ezekhez a Payloadnak nincs fordítási kulcsa.

Ha egy admin már mentett saját elrendezést, az új widgetek nem jelennek meg nála maguktól: hozzáadhatja őket, vagy visszaállíthatja az alapelrendezést. A fejlesztői adatbázisban 2026-10-16-án nincs mentett elrendezés.

## 6. Architektúra

```
cms/dashboard/
  widgets.ts             a widgetek és az alapelrendezés (admin.dashboard); a Gyűjtemények címkéje
  translations.ts        a Payload magyar dashboard-szövegeinek felülírása
  data.ts                Local API lekérdezések a bejelentkezett admin req-jével; loadSafely
  Overview.tsx           Áttekintés
  BookingList.tsx        a négy foglaláslista; a nézetet a regisztráció adja (serverProps.view)
  BookedDesigns.tsx      Lefoglalt minták
  parts.tsx              közös darabok: keret, mintakép, állapot, hibaüzenet, üres állapot
  dashboard.module.css
lib/dashboard.ts         tiszta függvények: nézetek, widgetcímek, címkék, linkek
lib/time.ts              + a beérkezés dátuma („ma 14:32”, „tegnap”, „okt. 13.”)
lib/booking-rules.ts     + countActiveByDesign(), a lib/flash.ts-ből áthozva
payload.config.ts        admin.dashboard, i18n.translations.hu, a Gyűjtemények címkéje
app/(payload)/admin/importMap.js   újragenerálva (npm run generate:importmap)
payload-types.ts         újragenerálva (npm run generate:types)
```

- **Regisztráció.** A négy lista ugyanaz a komponens: `Component: { path: "/cms/dashboard/BookingList#BookingList", serverProps: { view: "pending" } }`, és így tovább; a slug a nézetből képződik (`pending-bookings`), a hibanapló is ezt a nevet írja. A Payload a `serverProps`-ot a szerverkomponens propjaihoz fűzi. A config a widgetlista másolatát kapja, mert a Payload a kapott tömbbe fűzi a saját widgetjét. A címkék a `BOOKING_VIEWS`-ből és a `WIDGET_TITLES`-ből jönnek, a widgetek fejlécével közösen.
- **Szerverkomponensek.** Mindhárom aszinkron szerverkomponens; a Payload a `req`-et, a `user`-t és a `locale`-t adja nekik. A „most” időpontot widgetenként egyszer veszik, és paraméterként adják tovább, így a tiszta függvények tesztelhetők.
- **Payload UI-elemek.** `Pill` (állapot, Elkelt), `Thumbnail` (a minta képe, üres `alt`-tal, mert mellette a név szövegként áll; ha nincs kép, a Payload saját helyettesítő ikonja), `Banner` (hiba), `Link` (a Payload töltéssávjával, `prefetch={false}`). Kliens komponensek, a szerverkomponens szerializálható propokat ad nekik. A számlálók és a mintakártyák saját markupot kapnak.
- **Stílus.** Egy CSS Module (`dashboard.module.css`) a Payload témaváltozóival (`--theme-elevation-*`, `--style-radius-*`, `--accessibility-outline`), így a világos és a sötét admin téma magától működik. A Payload saját stílusai cascade layerben vannak, a modul szabályai ezért nyernek. A linkek saját `:focus-visible` keretet kapnak (a Payload `a:focus { outline: none }`-t ad), a másodlagos szöveg `--theme-elevation-600` (AA kontraszt). Az adminban nincs Tailwind.
- **Lekérdezések** (`data.ts`). A Local API-t a widget `req`-jével és `overrideAccess: false`-szal hívják, így a gyűjtemények jogosultsága érvényes. Csak a szükséges mezőket kérik le (`select`, `populate`, a konstansok `satisfies`-szal ellenőrizve); a kép a minta első képének `thumbnail` mérete, ennek hiányában az eredeti. Az aktív foglalásokat egy kérésen belül egyszer olvassák be (React `cache`), az Áttekintés és a Lefoglalt minták közösen használja.
  - Lista: egy `find` a nézet szűrésével és rendezésével, `limit: 5`; a `totalDocs` adja a „Mind (N)” számát.
  - Áttekintés: három `count`, plusz az elkelt minták: a minták szabálya és az aktív foglalások mintánkénti száma (`countActiveByDesign`), majd `availability()`.
  - Lefoglalt minták: az aktív foglalások mintája és beérkezése, mintánként csoportosítva (darab, utolsó beérkezés), az első 12 minta egy `find`-dal.
- **Tiszta függvények** (`lib/dashboard.ts`): a négy nézet leírása (szűrés a „most”-tól függően, rendezés, dátum fajtája, üres szöveg); a mintacímke („Elkelt · 1/1”, „2 / 3 alkalom”, „4 foglalás”); a lefoglalt minták csoportosítása és sorrendje; a szűrt admin listák linkje (`/admin/collections/bookings?where[status][equals]=pending`, rendezés nélkül), az admin útvonalát a config `routes.admin`-jából véve. A közelgő nézet linkjében a „most” a renderelés ideje. Az elkelt minták linkje az `id`-kat egyetlen, vesszővel elválasztott értékként adja át, üres listánál nincs link.
- **Közös számlálás.** A mintánkénti aktív foglalásszámlálás korábban a `lib/flash.ts` `getFlashCatalog` függvényében volt; átkerült a `lib/booking-rules.ts`-be (`countActiveByDesign`), és az oldal meg a dashboard is ezt használja, így az „Elkelt” mindkét helyen ugyanazt jelenti.
- **Adatbázis.** Gyűjtemény nem változik: nincs migráció, és a futó `next dev` sem kérdez a sémáról. Az elrendezés a Payload meglévő `payload_preferences` táblájába kerül.

## 7. Szövegek

- A widgetnevek, az üres állapotok és a hibaüzenet a 3. és a 9. szakasz szerint.
- A Payload magyar dashboard-szövegei vegyesen magáznak és tegeznek, egy helyen „Műszerfal” áll, a „Mentett változtatásai vannak” pedig a nem mentettekről szól. Az `i18n.translations.hu` felülírja őket, tegezve, ahogy az admin többi leírása:

| Kulcs | Payload | Új |
|---|---|---|
| `dashboard:addButton` | Adj hozzá + | Hozzáadás + |
| `dashboard:addWidget` | Adjon hozzá widgetet | Widget hozzáadása |
| `dashboard:deleteWidget` | Törölje a(z) {{id}} widgetet | Widget törlése: {{id}} |
| `dashboard:discardMessage` | Mentett változtatásai vannak az irányítópult elrendezésében. Biztosan el szeretné vetni őket? | Az elrendezésen nem mentett változtatások vannak. Biztosan elveted őket? |
| `dashboard:discardTitle` | Elveti a változtatásokat? | Elveted a változtatásokat? |
| `dashboard:editDashboard` | Műszerfal szerkesztése | Irányítópult szerkesztése |
| `dashboard:editingDashboard` | Szerkesztési irányítópult | Szerkesztési mód |
| `dashboard:noItems` | Nincsenek widgetek az irányítópulton. Hozzáadhatja őket a felső sávban található "Irányítópult" menüből. | Nincs widget az irányítópulton. A „Hozzáadás +” gombbal adhatsz hozzá egyet; ha nem látod, kapcsold be a szerkesztést az „Irányítópult” menüben. |
| `dashboard:resetLayout` | Alaphelyzet visszaállítása | Alapelrendezés visszaállítása |
| `dashboard:searchWidgets` | Keresés widgetek... | Widget keresése… |
| `error:failedToResetLayout` | A felület visszaállítása sikertelen. | Nem sikerült visszaállítani az alapelrendezést. |

- A „Gyűjtemények” címke: a `buildConfig` eredményén a `collections` widget `label`-je. A Payload ezt a widgetet mindig maga fűzi a listához, ezért saját bejegyzéssel duplán szerepelne. Ugyanígy igazítja utólag a `next.config.ts` is a `withPayload` fejléceit.

## 8. Adatvédelem

A dashboardot csak bejelentkezett admin látja (a Payload a widgetet csak bejelentkezett felhasználónak rendereli, a lekérdezések pedig a gyűjtemények jogosultságával futnak). A foglalóból csak a név jelenik meg. A naplóba nem kerül személyes adat (9. szakasz).

## 9. Hibakezelés

- Minden widget a saját lekérdezését `try/catch`-ben futtatja (`loadSafely`); a listák a sorok dátumszövegét is ezen belül írják meg. Hibánál a widget címe alatt egy `Banner` (`type="error"`) áll: „Nem sikerült betölteni. Töltsd újra az oldalt.”, a dashboard többi része működik. A Payload a widget aszinkron hibáját egyik úton sem fogja meg (a `render-widget` szerverfüggvény `try/catch`-e csak a komponens létrehozását fedi, a futását nem), ezért egyetlen hibás lekérdezés az egész nyitó oldalt elvinné.
- A naplóba `req.payload.logger.error` kerül a `loggableError()` (`cms/log.ts`) kimenetével és a widget slugjával. A hiba üzenete nem kerül a naplóba: a Drizzle a lekérdezés paramétereit, köztük neveket, fűz hozzá.
- Hiányzó kép: a `Thumbnail` helyettesítő ikonja. Hiányzó minta: a név a `designName` pillanatképből, kép nélkül. Mintát nem lehet törölni, amíg foglalás hivatkozik rá (`guardDesignDelete`), ez csak biztonsági háló.

## 10. Tesztelés

- **Egységtesztek** (`tests/unit/dashboard.test.ts`; a `lib/time.ts` új függvénye a meglévő `tests/unit/time.test.ts`-ben):
  - a négy nézet szűrése és rendezése rögzített „most”-tal;
  - a mintacímkék: egyszeri, limitált (van hely / betelt / limit alá vett), korlátlan;
  - a beérkezés dátuma: ma, tegnap, régebbi, más év; budapesti éjfél és az óraátállítás körül;
  - a linképítő: a pontos URL, és visszaolvasva a `qs-esm`-mel (az admin is ezzel olvassa) ugyanaz a `where`;
  - a lefoglalt minták csoportosítása: sorrend, legfeljebb 12, az elutasított és a lemondott nem számít;
  - `countActiveByDesign`.
- **Integrációs tesztek** (`tests/int/dashboard.test.ts`, Local API a teszt-adatbázison, a meglévő `tests/helpers.ts`-szel):
  - minden nézet a jó foglalásokat adja, a jó sorrendben, és a jó darabszámot;
  - jövőbeli időpontú függő foglalás a közelgők között van;
  - az időpont nélküli jóváhagyott csak az *Időpontra vár* nézetben van;
  - múltbeli időpont nem közelgő;
  - az elkelt minták száma megegyezik azzal, amit az oldal „Elkelt”-nek mutat;
  - az „Elkelt minta” linkje az admin saját URL-olvasásával és a Payload lekérdezésével pontosan az elkelt mintákat adja, 21-nél több esetén is;
  - felhasználó nélküli `req`-gel a lekérdezés elutasítva;
  - hibás lekérdezésnél a `loadSafely` `null`-t ad, és a naplóba a hiba üzenete nem kerül be;
  - minden teszt friss `req`-et kap (egy kérés gyorsítótárazza a betöltött dokumentumokat).
- **Config** (`tests/int/dashboard-config.test.ts`, a felépített configon, adatbázis nélkül):
  - az alapelrendezés minden slugja regisztrált widget;
  - minden widget komponense szerepel az `importMap.js`-ben (elmaradt `generate:importmap` esetén a teszt elbukik);
  - a `collections` widget címkéje „Gyűjtemények”;
  - a felülírt fordítási kulcsok léteznek a Payload magyar fordításában (ha egy frissítés átnevezi őket, kiderül), és el is jutnak az admin fordításáig;
  - a Payload saját widgetje nem kerül a modul widgetlistájába.
- **Renderelés** (`tests/unit/dashboard-widgets.test.tsx`; a Vitest a `.tsx` teszteket is futtatja): a Payload UI-elemei helyén egyszerű helyettesítők, a lekérdezések mockolva, a `loadSafely` valódi. Ellenőrzi:
  - a nullás számláló nem link;
  - hibás dátum hibasávot ad, nem dobást;
  - a sorok és a „Mind (N)” linkjei;
  - az üres `alt`;
  - az elkelt kártya sötét címkéje.
- Az `npm run lint`, az `npm run typecheck` és az `npm test` hiba nélkül fut le.
- **Kézi ellenőrzés** egy elkülönített másolaton, mintafoglalásokkal, nem a fejlesztői adatbázisban: világos és sötét téma; telefonszélesség (768 px alatt egymás alatt); szerkesztő mód (törlés, hozzáadás, átméretezés, áthúzás, mentés, visszaállítás); minden link a jó szűrt listát nyitja; üres adatbázissal az üres állapotok.

## 11. Hatókörön kívül

- Élő frissítés: az adatok az oldal betöltésekor frissülnek.
- Widgetenkénti beállítások (sorok száma, szűrők).
- Grafikonok, statisztikák időben (foglalások havonta, bevétel).
- Közös elrendezés az adminok között: a Payload adminonként ment.
- Műveletek a dashboardról (jóváhagyás, elutasítás gombok): a foglalást megnyitva intézhető.
- Az egyedi tetoválás kérései: nincsenek az adatbázisban.

## 12. Ellenőrzött technikai tények (2026-10-16, a csomagok forrásából)

- `payload` 3.90.2: az `admin.dashboard` (`widgets`, `defaultLayout`) `@experimental` jelölésű. Egy widget: `slug`, `Component`, `label`, `fields`, `minWidth`, `maxWidth`.
- A `sanitizeConfig` minden esetben hozzáfűzi a `collections` widgetet (`@payloadcms/next/rsc#CollectionCards`, `minWidth: "full"`, címke nélkül). A `[{ widgetSlug: "collections", width: "full" }]` alapelrendezést csak akkor állítja be, ha nincs saját.
- Szélességek: `x-small` 25%, `small` 33⅓%, `medium` 50%, `large` 66⅔%, `x-large` 75%, `full` 100%. 768 px alatt minden widget 100%.
- Az elrendezés a `dashboard-layout` kulcsú preferencia, felhasználónként. Ha nincs, az alapelrendezés látszik. A visszaállítás törli a preferenciát, és a szerverről újra lekéri az alapelrendezést. Szerkesztéskor hozzáadott widget a `minWidth` méretén indul.
- A widget komponens propjai: `req`, `user`, `locale`, `permissions`, `cookies`, `widgetData`, `widgetSlug`. Objektum alakú `Component` esetén a `serverProps` a szerverkomponens propjaihoz adódik (`RenderServerComponent`).
- A widget aszinkron hibáját a Payload egyik úton sem kezeli: első rendereléskor a `ModularDashboard` nem, a szerkesztéskor hozzáadott widgetet renderelő `render-widget` szerverfüggvény `try/catch`-e pedig csak a `RenderServerComponent` hívást fedi, amely a komponenst nem futtatja le (javítva 2026-10-17; a korábbi szöveg szerint az utóbbi megfogta).
- A `sanitizeConfig` a kapott `admin.dashboard.widgets` tömbbe `push`-olja a `collections` widgetet.
- Az admin a lista-URL-t `qs.parse(…, { depth: 10, ignoreQueryPrefix: true })`-zal olvassa, az alapértelmezett `arrayLimit: 20`-szal: 21 elemnél hosszabb indexelt lista (`where[id][in][21]`) objektummá válik, és a Payload a szűrőt elhagyja. Az `in` vesszővel elválasztott szöveget is elfogad.
- A listanézet a kapott `sort`-ot (és `limit`-et, `columns`-ot) a `collection-<slug>` preferenciába menti, a `where`-t nem.
- Az admin csak a `@payloadcms/next/css`-t tölti be; ebben a `:focus-visible` keret után `a:focus { outline: none }` áll, így egy sima link fókuszkeret nélkül marad. A Payload komponensei (gomb, pill, táblázat) maguk adják vissza.
- A szélességválasztó a nyers neveket mutatja (`small`, `medium`, …); ezekhez nincs fordítási kulcs.
- A `withPayload` kikapcsolja a Turbopack szerveroldali fast refresh-ét, így fejlesztés közben egy változás után a teljes szerveroldali modulgráf újra lefut.
- Az import map generátor a dashboard widgetek komponenseit is felveszi. A hozzáadás listája a widget `label`-jét mutatja, ennek hiányában a slugból képzett nevet (`toWords`).
- Az admin listanézet a `where` és a `sort` paramétert az URL-ből olvassa (`qs-esm`).
- `@payloadcms/ui`: a `Pill` (`pillStyle`: `warning`, `success`, `light`, `light-gray`, `dark` …), a `Thumbnail` és a `Banner` (`type`: `error` …) kliens komponens.
- A `Thumbnail` a dashboardon `min-height: 100%`-ot kap (`.thumbnail:not(.thumbnail--size-none)`), a képe pedig nincs abszolút pozícionálva, így egy álló rajz széthúzná a kártyát. A widget CSS-e ezért rögzített dobozt ad neki (`min-height: 0`), és a képet `position: absolute`-tal teszi rá (próba: 2026-10-16, fej nélküli Chrome).
- A fejlesztői adatbázisban (2026-10-16) nincs `dashboard-layout` preferencia, 0 foglalás és 23 minta van.
