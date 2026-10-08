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

A fejlesztői adatbázist a dev szerver és a seed séma-szinkronnal (push) kezeli. Az éles módot (`npm run build && npm start`) helyben külön adatbázissal próbáld, például `DATABASE_URL=file:./.data/prod-local.db MEDIA_DIR=./.data/prod-local-media npm start`: a fejlesztői adatbázison az éles indítás egy kérdésnél megállna (lásd *Biztonságos üzemeltetés*).

SMTP beállítás nélkül a levelek nem mennek ki, hanem a szerver konzoljára íródik egy sor a címzettel és a tárggyal (a levél szövege nem látszik).

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
   Élesben mindkettő kötelező. Ha bármelyik hiányzik, az admin, az API és a főoldal is szándékosan 500-as hibát ad, hogy semmi ne kerülhessen a deploy mappába.
2. Build: `npm run build`, indítás: `npm start`. Ha a build memóriahiány miatt leáll: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`.
   A még nem futtatott migrációkat a Payload az indítás utáni **első kérésnél** futtatja le, nem magánál az `npm start`-nál. Ezért minden deploy után nyisd meg egyszer az oldalt (pl. `curl -fsS -m 30 https://<domain>/ -o /dev/null`), és nézd meg a naplóban a `Migrating:` / `Migrated:` sorokat (ha nincs ilyen, nem volt függő migráció), és hogy nincs-e `Error running migration`.
3. **HTTPS:** az admin bejelentkezéshez kell, mert a munkamenet-süti élesben csak HTTPS-en él. Kapcsold be az SSL-t a domainhez.
4. Első indítás után: `/admin` → admin fiók → kollekciók, minták és időpontok felvétele.
   Ezután próbáld ki élőben is:
   - Foglalj egy időpontot az oldalon.
   - Egy eszközről 4 gyors foglalás: a 4. elutasítva.
   - Egy másik hálózatról (pl. mobilnetről) még lehet foglalni.

   - A próbához legalább 4 szabad időpont és egy korlátlan vagy legalább 4 alkalmas minta kell. Utána töröld a próbafoglalásokat az adminban.

   Ha a 4. foglalás is átmegy, vagy a másik hálózatról sem lehet foglalni, állítsd át a `TRUSTED_PROXY_HOPS`-t: a Hostinger CDN bekapcsolásával 2. Ha sem 1-gyel, sem 2-vel nem utasítja el a 4. foglalást, a tárhely nem adja át a látogató címét. Ilyenkor a korlát nem működik, és csak a csapdamező véd; ha ez kevés, jöhet egy Cloudflare Turnstile.

   Ha már az első éles foglalás „Invalid Server Actions request” hibával bukik el, a proxy más hosztnevet ad át: a domaint fel kell venni az `experimental.serverActions.allowedOrigins` listába a `next.config.ts`-ben.
5. **Mentés:** a `pannipix-data` mappát (adatbázis + képek) rendszeresen menteni kell. Futó alkalmazás mellett az adatbázist így mentsd: `sqlite3 pannipix.db ".backup <mentés-fájl>"`. Ha fájlként másolod, előbb állítsd le az alkalmazást, és a `.db`, `-wal` és `-shm` fájlt együtt másold.
6. **E-mail kézbesítés:** a feladó domainjéhez (pl. `pannipix.hu`) állítsd be a Hostingeren az SPF-et és a DKIM-et, lehetőleg a DMARC-ot is, különben a Gmail spamnek nézheti a leveleket. A sikertelen küldés csak a szerver naplójában látszik (hPanel → a Node.js alkalmazás naplója). Ha az `ADMIN_EMAIL`, a `SITE_URL` vagy az `SMTP_HOST` hiányzik, a Payload indulásakor (az első kérésnél) figyelmeztetés kerül a naplóba.

Feltételezés: egyetlen Node processz fut. A foglalási korlát (IP-nként óránként 3) a memóriában számol, és a migrációkat is egyetlen folyamat futtatja.

## Biztonságos üzemeltetés

- **Egy adatbázis, egy folyamat.** Deploy közben ne fusson egyszerre a régi és az új alkalmazás, és futó oldal mellett ne futtass kézzel `payload migrate`-et. A `npm run payload migrate:status` biztonságos, csak olvas. A `payload` parancsok elé add meg ugyanazokat a változókat, mint az alkalmazásnak; `DATABASE_URL` nélkül a deploy mappa `.data/` adatbázisát nyitnák meg.
- **Az éles adatbázison soha ne futtasd az `npm run dev`-et vagy az `npm run seed`-et, és ne töltsd fel a helyi `.data/` adatbázist.** Ezek séma-szinkronnal írnak, és `dev` jelölést hagynak a `payload_migrations` táblában. Tünet: az oldal és az admin hibaüzenet nélkül nem tölt be (csak a `public/` mappa fájljai, pl. a favicon, töltenek be; a feltöltött képek sem), a napló végén ez áll: „It looks like you've run Payload in dev mode… (y/N)”. Teendő: állítsd le az alkalmazást, és nézd meg: `sqlite3 pannipix.db "select name, batch from payload_migrations"`. Ha minden migráció szerepel a listában, töröld a `dev` sort (`delete from payload_migrations where batch = -1`), és indítsd újra. Ha csak a `dev` sor van, az adatbázist nem migráció hozta létre: állítsd vissza a mentést, vagy kezdd üres adatbázissal.
- **Migráció élesítése előtt ments.** A migrációk tranzakció nélkül futnak. Egy félbeszakadt migráció után minden indítás az első kérésnél leáll (`table … already exists`). Ilyenkor állítsd le az alkalmazást, és állítsd vissza a mentést. A legelső élesítésnél elég törölni a három adatbázisfájlt (`.db`, `-wal`, `-shm`), és újraindítani.
- **Próba éles adatokon.** Egy új migrációt élesítés előtt próbálj ki az éles adatbázis másolatán: `sqlite3 pannipix.db ".backup /tmp/proba.db"`, majd `DATABASE_URL=file:/tmp/proba.db MEDIA_DIR=/tmp/proba-media npm run payload migrate` (a többi változó az alkalmazáséval egyezzen). A tesztek üres adatbázison futnak, az adatfüggő hibákat (pl. új kötelező mező meglévő sorokon) nem látják.

## Sémaváltozás

1. Módosítsd a gyűjteményt a `cms/collections/` mappában.
2. `npm run generate:types`
3. `npm run payload migrate:create <rövid-név>`, majd nézd át a generált fájlt, különösen a `down` törlési sorrendjét (előbb a gyerek táblák). Az `npm test` (`tests/int/migrations.test.ts`) addig hibát jelez, amíg a migráció hiányzik, vagy nem ugyanazt a sémát építi, mint a gyűjtemények.
4. A `.ts`, a `.json` és az `index.ts` fájlt együtt commitold. Élesben a következő indítás utáni első kérésnél fut le. Élesben már lefutott migrációt ne szerkessz és ne nevezz át, a `.json` pillanatképeket pedig ne töröld.
