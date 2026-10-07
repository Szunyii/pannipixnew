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
