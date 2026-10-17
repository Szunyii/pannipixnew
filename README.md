# PANNIPIX

Tetoválás-portfólió és foglalás flash mintákra. Next.js 16 + Payload CMS 3 (SQLite).

> **Figyelem:** az éles adatbázison soha ne futtasd az `npm run dev`-et vagy az `npm run seed`-et, és ne töltsd fel a helyi `.data/` adatbázist, mert utána az éles oldal nem tölt be. A tünet és a javítás: [Biztonságos üzemeltetés](#biztonságos-üzemeltetés).

## Fejlesztés

Előfeltétel: Node.js 22.12 vagy újabb (a tesztek miatt).

1. `npm install`
2. `cp .env.example .env`, majd a `PAYLOAD_SECRET=` után írj egy hosszú, véletlen értéket (például az `openssl rand -hex 32` kimenetét).
3. `npm run seed`: üres adatbázisba feltölti a helyőrző mintákat (mind P’CONs, egyszeri foglalhatósággal), 12 szabad időpontot (három hétre előre, keddenként és csütörtökönként 10:00-kor és 15:00-kor) és egy archív foglalást (emiatt a P’CONs #021 minta „elkelt”).
4. `npm run dev`
   - oldal: http://localhost:3000
   - admin: http://localhost:3000/admin (első alkalommal itt hozod létre az admin fiókot)

Az adatbázis és a feltöltött képek a `.data/` mappában vannak, ez nincs verziókezelve. Újrakezdés: `rm -rf .data && npm run seed`.

A fejlesztői adatbázist a dev szerver és a seed séma-szinkronnal (push) kezelik. Az éles módot (`npm run build && npm start`) ezért helyben külön adatbázissal próbáld, mert a fejlesztői adatbázison az éles indítás egy kérdésnél megállna (lásd [Biztonságos üzemeltetés](#biztonságos-üzemeltetés)). Például:

```bash
DATABASE_URL=file:./.data/prod-local.db MEDIA_DIR=./.data/prod-local-media npm start
```

SMTP beállítás nélkül a levelek nem mennek ki, hanem a szerver konzoljára íródik egy sor a címzettel és a tárggyal (a levél szövege nem látszik).

## Parancsok

| Parancs | Mire való |
|---|---|
| `npm run dev` | fejlesztői szerver (csak helyben) |
| `npm test` | egység- és integrációs tesztek; minden tesztfájl saját, ideiglenes SQLite adatbázist kap |
| `npm run lint`, `npm run typecheck` | statikus ellenőrzés |
| `npm run generate:types` | a `payload-types.ts` újragenerálása a Payload konfigurációból |
| `npm run payload migrate:create <név>` | migrációs fájl a sémaváltozáshoz; élesítés előtt kötelező |
| `npm run seed` | demó adatok üres fejlesztői adatbázisba (élesben soha) |

## Hogyan működik a foglalás

- **Minta:** a *Kollekció* mezőben legördülő listából választod ki, melyik kollekcióba tartozik. A *Foglalhatóság* mező mintánként dönti el, hányszor foglalható: *Egyszeri* (1), *Limitált* (x; az *Alkalmak száma* mezőben adod meg, legalább 2) vagy *Korlátlan*. Egy kollekción belül a minták foglalhatósága eltérhet. Az oldalon minden mintának saját oldala van: `/flash/<kollekció értéke>/<sorszám>`, például `/flash/pcons/028`.
- **Kollekciók:** a listájuk a kódban van (`lib/categories.ts`), az adminban nincs külön menüpontjuk. Új kollekcióhoz vegyél fel oda egy sort, és élesítsd; migráció nem kell hozzá. Az oldal szűrője a lista sorrendjében mutatja őket.
- **Időpontok:** az oldalon a vendég most nem választ időpontot (lásd *Időpontválasztó*), csak a mintát foglalja le; az időpontot te rendeled a foglaláshoz. Vegyél fel egy időpontot az *Időpontok* között, majd a foglalás *Időpont* mezőjében válaszd ki. Egy közös naptár van: bármelyik foglalás bármelyik szabad időpontot megkaphatja, és egy időpontra egy foglalás jut. Foglalt időpont kezdése nem módosítható: ha át kell tenni egy foglalást, vegyél fel új időpontot, és a foglalás *Időpont* mezőjében válaszd ki. A *Lejárt* időpontokat (elmúltak, és nem tartozik hozzájuk foglalás) érdemes időnként törölni, mert a foglalás *Időpont* mezőjének választójában a jövőbeli időpontok elé kerülnek.
- **Foglalás:** beküldéskor azonnal leköti a minta egy alkalmát, állapota *Függőben*, időpontja még nincs. Az admin *Jóváhagyva* vagy *Elutasítva* állapotra állítja, a tetoválás után *Elkészült* állapotra, ha pedig az ügyfél lemondja, *Lemondva* állapotra. Az *Időpont* mező nem kötelező: bármikor megadható, cserélhető vagy törölhető. A *Függőben*, *Jóváhagyva* és *Elkészült* foglalás tartja az alkalmat és (ha van) az időpontot; *Elutasítva* és *Lemondva* állapotban mindkettő újra szabad.
- **Dupla foglalás:** két egyedi index (`slot`, illetve `design + seat`) zárja ki akkor is, ha ketten egyszerre kattintanak.
- **E-mailek:** az `ADMIN_EMAIL` címre minden, az oldalon beküldött foglalásról levél érkezik. Az ügyfél a beérkezésről, a jóváhagyásról (a levél tárgya: „Visszaigazolva: …”), az elutasításról és a lemondásról kap levelet. Az időpont akkor szerepel a levelekben, ha a foglalásnak már van: ha a jóváhagyással egy mentésben adod meg, a visszaigazolás már tartalmazza; különben a levél azt írja, hogy az időpontot válaszlevélben egyeztetitek. Az időpont utólagos megadásáról vagy cseréjéről nem megy külön levél.
- **Időpontválasztó:** az oldali időpontválasztó ki van kapcsolva; a `lib/features.ts` `SLOT_PICKING` konstansa kapcsolja. `true` értékkel a foglalási ablak első lépése újra az időpontválasztás, az űrlap megköveteli az időpontot, és az oldal meg a levelek szövege is visszaáll (az admin oldalon az időpont ekkor sem kötelező). Átállítás után futtasd az `npm run generate:types` parancsot, mert az admin leírások a `payload-types.ts` megjegyzéseibe is bekerülnek.

## Az admin nyitó oldala

Az `/admin` nyitó oldalán foglalási widgetek vannak: *Áttekintés* (négy számláló), *Jóváhagyásra vár*, *Időpontra vár*, *Közelgő időpontok*, *Legutóbbi foglalások* és *Lefoglalt minták*, alattuk a gyűjtemények kártyái. Egy számláló, egy sor vagy egy minta a hozzá tartozó szűrt listát vagy a foglalást nyitja meg. A szűrt lista a *Foglalások* lista megszokott sorrendjében jelenik meg: a link csak szűr, a lista rendezését nem állítja át. Az adatok az oldal betöltésekor frissülnek.

- **Elrendezés:** a felső sáv *Irányítópult* menüjében válaszd az *Irányítópult szerkesztése* lehetőséget. A *Hozzáadás +* gombbal widgetet adhatsz hozzá, a meglévőket törölheted, átméretezheted és áthúzhatod; a *Módosítások mentése* adminonként menti az elrendezést. Az *Alapelrendezés visszaállítása* az eredetit hozza vissza.
- **Új widget a kódban:** a widgeteket és az alapelrendezést a `cms/dashboard/widgets.ts` sorolja fel. Új vagy átnevezett komponens után futtasd az `npm run generate:importmap` és az `npm run generate:types` parancsot. Akinek már van mentett elrendezése, annál az új widget nem jelenik meg magától: hozzá kell adnia, vagy vissza kell állítania az alapelrendezést.

## Élesítés (Hostinger, Node.js alkalmazás)

Ez a lista az első élesítés lépéseit adja. Későbbi deployoknál (főleg új migrációnál) előbb olvasd el a [Biztonságos üzemeltetés](#biztonságos-üzemeltetés) szakaszt: mentés, és a migráció kipróbálása az éles adatbázis másolatán.

0. **Node.js:** a hPanelben válaszd ki a 22-es verziót. Az oldal 20.9-től fut, a tesztekhez viszont legalább 22.12 kell. A magyar dátumokhoz teljes ICU kell; a hivatalos Node buildek ilyenek. Ellenőrzés: `node -p "new Intl.DateTimeFormat('hu-HU').resolvedOptions().locale"` → `hu-HU` (más érték esetén a Node nem teljes ICU-s).
1. **Környezeti változók:** állítsd be az alkalmazás környezeti változóiként (a hPanelben vagy a deploy mappa `.env` fájljában) az `.env.example` összes kulcsát a saját értékeiddel (a `SITE_URL` az éles `https://…` cím legyen). A `DATABASE_URL`-t és a `MEDIA_DIR`-t a **deploy mappán kívüli**, írható könyvtárra irányítsd, például:
   - `DATABASE_URL=file:/home/<felhasználó>/pannipix-data/pannipix.db`
   - `MEDIA_DIR=/home/<felhasználó>/pannipix-data/media`

   Élesben mindkettő kötelező. Ha bármelyik hiányzik, az admin, az API és a főoldal is szándékosan 500-as hibát ad, hogy semmi ne kerülhessen a deploy mappába.
   Az adatbázisfájl mappájának is írhatónak kell lennie: WAL módban az adatbázisfájl mellé `-wal` és `-shm` fájlok is kerülnek.
2. **HTTPS:** az admin bejelentkezéshez kell, mert a munkamenet-süti élesben csak HTTPS-en él. Kapcsold be az SSL-t a domainhez.
3. **Build és indítás:** `npm run build`, indítás: `npm start`. Ha a build memóriahiány miatt leáll: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`.

   **Migrációk:** a még nem futtatott migrációkat a Payload az indítás utáni **első kérésnél** futtatja le, nem magánál az `npm start`-nál. Ezért minden deploy után nyisd meg egyszer az oldalt (pl. `curl -fsS -m 30 https://<domain>/ -o /dev/null`), majd nézd meg a naplóban (hPanel → a Node.js alkalmazás naplója) a `Migrating:` / `Migrated:` sorokat (ha nincsenek, nem volt függő migráció), és azt, hogy nincs-e `Error running migration` hiba. Ha ilyet látsz, a teendőt a [Biztonságos üzemeltetés](#biztonságos-üzemeltetés) „Migráció élesítése előtt ments” pontja írja le.
4. **Első indítás után:** nyisd meg a `/admin` oldalt, és azonnal hozd létre az admin fiókot (amíg nincs fiók, bárki létrehozhatja az elsőt), majd vedd fel a mintákat (időpontot elég akkor felvenni, amikor egy foglaláshoz rendeled). Ezután próbáld ki élőben is. A próbához legalább 4 szabad alkalom kell a mintákon (elég egy *Korlátlan* minta is); bekapcsolt időpontválasztó mellett legalább 4 szabad időpont is; a végén töröld a próbafoglalásokat a *Foglalások* között.
   - Ugyanarról az eszközről foglalj egymás után négyszer: az első három átmegy, a negyediknél az oldal a „Túl sok foglalás érkezett erről a hálózatról. Próbáld újra később, vagy írj Instagramon: @pannipix.” üzenetet adja.
   - Egy másik hálózatról (pl. mobilnetről) még lehet foglalni.
   - Nézd meg, megérkezett-e a két levél (az adminnak és az ügyfélnek; lásd a 6. pontot).

   **Ha a 4. foglalás is átmegy, vagy a másik hálózatról sem lehet foglalni:** a `TRUSTED_PROXY_HOPS` alapértéke 1 (a Hostinger saját proxyja), bekapcsolt Hostinger CDN mellett várhatóan 2. Állítsd át, és indítsd újra az alkalmazást. Ha sem 1-gyel, sem 2-vel nem utasítja vissza az oldal a 4. foglalást (jele a naplóban: `Booking limit skipped: no usable visitor address in X-Forwarded-For; check TRUSTED_PROXY_HOPS (see README).`), a tárhely nem adja át a látogató címét. Ilyenkor a korlát nem működik, és csak a csapdamező véd; ha ez kevés, jöhet egy Cloudflare Turnstile.

   **Ha már az első éles foglalás „Invalid Server Actions request” hibával bukik el:** a proxy más hosztnevet ad át, mint amit a böngésző címsora mutat. Vedd fel a domaint (protokoll nélkül) a `next.config.ts` meglévő `experimental` blokkjába, majd építsd újra és indítsd újra az alkalmazást:

   ```ts
   serverActions: { allowedOrigins: ["pannipix.hu"] },
   ```
5. **Mentés:** a `pannipix-data` mappát (adatbázis + képek) rendszeresen menteni kell. Futó alkalmazás mellett az adatbázist így mentsd, teljes útvonallal (ha a fájl nem ott van, ahol a parancsot futtatod, az `sqlite3` hiba nélkül egy üres adatbázist ment): `sqlite3 /home/<felhasználó>/pannipix-data/pannipix.db ".backup <mentés-fájl>"`. Ha a szerveren nincs `sqlite3`, állítsd le az alkalmazást, és a `.db`, `-wal` és `-shm` fájlt együtt másold.
6. **E-mail kézbesítés:** a feladó domainjéhez (pl. `pannipix.hu`) állítsd be a Hostingeren az SPF-et és a DKIM-et, lehetőleg a DMARC-ot is, különben a Gmail spamnek nézheti a leveleket. A sikertelen küldés csak a szerver naplójában látszik (hPanel → a Node.js alkalmazás naplója). Ha az `ADMIN_EMAIL`, a `SITE_URL` vagy az `SMTP_HOST` hiányzik, a Payload indulásakor (az első kérésnél) figyelmeztetés kerül a naplóba.

## Biztonságos üzemeltetés

- **Egy adatbázis, egy folyamat.** Az alkalmazás egyetlen Node-folyamatot feltételez: a foglalási korlát (IP-nként óránként 3) számlálója a memóriában van, és a migrációkat is egyetlen folyamat futtatja. Deploy közben ezért ne fusson egyszerre a régi és az új alkalmazás, és futó oldal mellett ne futtass kézzel `payload migrate`-et. Az `npm run payload migrate:status` biztonságos, csak olvas. A `payload` parancsok elé add meg ugyanazokat a változókat, mint az alkalmazásnak (a `PAYLOAD_SECRET`-et is); `DATABASE_URL` nélkül a deploy mappa `.data/` adatbázisát nyitnák meg. Például:

  ```bash
  DATABASE_URL=file:/home/<felhasználó>/pannipix-data/pannipix.db \
  MEDIA_DIR=/home/<felhasználó>/pannipix-data/media \
  PAYLOAD_SECRET=<az alkalmazás értéke> \
  npm run payload migrate:status
  ```
- **Az éles adatbázison soha ne futtasd az `npm run dev`-et vagy az `npm run seed`-et, és ne töltsd fel a helyi `.data/` adatbázist.** Ezek séma-szinkronnal írnak, és `dev` jelölést hagynak a `payload_migrations` táblában.
  - **Tünet:** az oldal és az admin hibaüzenet nélkül nem tölt be (csak a statikus fájlok, pl. a favicon és a `public/` mappa képei töltenek be; a feltöltött képek nem), a napló végén ez áll: „It looks like you've run Payload in dev mode… (y/N)”.
  - **Teendő:** állítsd le az alkalmazást, és nézd meg a migrációk listáját: `sqlite3 /home/<felhasználó>/pannipix-data/pannipix.db "select name, batch from payload_migrations"`.
    - Ha a `migrations/` mappa minden migrációja szerepel a listában, töröld a `dev` sort: `sqlite3 /home/<felhasználó>/pannipix-data/pannipix.db "delete from payload_migrations where batch = -1"`, és indítsd újra az alkalmazást.
    - Ha csak néhány szerepel, vagy csak a `dev` sor van, az adatbázist nem (csak) migráció hozta létre: állítsd vissza a mentést, vagy kezdd üres adatbázissal.
- **Migráció élesítése előtt ments.** A migrációk tranzakció nélkül futnak. Egy félbeszakadt migráció után minden indítás az első kérésnél leáll (`table … already exists`). Ilyenkor állítsd le az alkalmazást, és állítsd vissza a mentést. A legelső élesítésnél elég törölni a három adatbázisfájlt (`.db`, `-wal`, `-shm`), és újraindítani.
- **Próba éles adatokon.** Egy új migrációt élesítés előtt próbálj ki az éles adatbázis másolatán. A tesztek üres adatbázison futnak, az adatfüggő hibákat (pl. új kötelező mező meglévő sorokon) nem látják.

  ```bash
  sqlite3 /home/<felhasználó>/pannipix-data/pannipix.db ".backup /tmp/proba.db"
  DATABASE_URL=file:/tmp/proba.db MEDIA_DIR=/tmp/proba-media PAYLOAD_SECRET=<az alkalmazás értéke> npm run payload migrate
  ```

## Sémaváltozás

1. Módosítsd a megfelelő collection-fájlt a `cms/collections/` mappában.
2. `npm run generate:types`
3. `npm run payload migrate:create <név>`, majd nézd át a generált fájlt, különösen a `down` törlési sorrendjét (előbb a gyerek táblák). Az `npm test` (`tests/int/migrations.test.ts`) addig hibát jelez, amíg a migráció hiányzik, vagy nem ugyanazt a sémát építi, mint a `cms/collections/` mappa definíciói.
4. A `.ts`, a `.json` és az `index.ts` fájlt együtt commitold. Élesben a migráció a következő indítás utáni első kérésnél fut le: előtte ments, és próbáld ki az éles adatbázis másolatán (lásd [Biztonságos üzemeltetés](#biztonságos-üzemeltetés)). Élesben már lefutott migrációt ne szerkessz és ne nevezz át, a `.json` pillanatképeket pedig ne töröld.
