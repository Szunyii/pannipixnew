export type Collection = "P’CONs" | "ORNX" | "daddywillhateus";

export type DesignImage = {
  src: string;
  alt: string;
  /** "art" sits on the stencil panel and multiplies onto it; "photo" is framed like a print */
  kind: "art" | "photo";
  label: string;
};

export type FlashDesign = {
  id: string;
  collection: Collection;
  price: number;
  size: string;
  placements: string;
  description: string;
  badge?: "Új" | "Utolsó";
  sold?: boolean;
  images: DesignImage[];
};

export const collections: Collection[] = ["P’CONs", "ORNX", "daddywillhateus"];

export const styles = ["Conceptual", "Abstract", "Microrealism"] as const;

// Placeholder artwork is cropped from the reference mockups — swap in the originals in /public/flash.
export const designs: FlashDesign[] = [
  {
    id: "027",
    collection: "P’CONs",
    price: 90000,
    size: "15–18 cm",
    placements: "kar, comb, hát, oldal",
    description:
      "Szitakötő és robotkéz egy függőleges tengely két oldalán: a természetes és az épített világ találkozása, bolygókkal és körpályákkal keretezve.",
    badge: "Új",
    images: [
      { src: "/flash/pcons-027-large.webp", alt: "P’CONs #027 – szitakötő és robotkéz egy függőleges sáv két oldalán", kind: "art", label: "Minta" },
      { src: "/flash/pcons-027-skin.webp", alt: "P’CONs #027 elkészült tetoválásként lábszáron", kind: "photo", label: "Bőrön" },
      { src: "/flash/pcons-027-detail.webp", alt: "P’CONs #027 részlet: a szitakötő", kind: "photo", label: "Részlet" },
    ],
  },
  {
    id: "024",
    collection: "P’CONs",
    price: 110000,
    size: "16–20 cm",
    placements: "alkar, comb, oldal",
    description:
      "Lehunyt szemű arc pillangók és virágok között. A kompozíciót körök és függőleges vonalak rendezik.",
    images: [{ src: "/flash/pcons-024.webp", alt: "P’CONs #024 – női arc pillangókkal és virágokkal", kind: "art", label: "Minta" }],
  },
  {
    id: "025",
    collection: "P’CONs",
    price: 90000,
    size: "14–17 cm",
    placements: "alkar, lábszár, gerinc",
    description:
      "Szimmetrikus orchideakompozíció éles, lefelé futó vonalakkal — tükörtengelyre épített minta.",
    images: [{ src: "/flash/pcons-025.webp", alt: "P’CONs #025 – szimmetrikus orchideák függőleges tengelyen", kind: "art", label: "Minta" }],
  },
  {
    id: "026",
    collection: "P’CONs",
    price: 120000,
    size: "18–22 cm",
    placements: "comb, oldal, hát",
    description:
      "Tengely köré tekeredő kígyó füstszerű árnyalással és geometriai körökkel.",
    badge: "Utolsó",
    images: [{ src: "/flash/pcons-026.webp", alt: "P’CONs #026 – tengely köré tekeredő kígyó", kind: "art", label: "Minta" }],
  },
  {
    id: "023",
    collection: "P’CONs",
    price: 100000,
    size: "15–19 cm",
    placements: "comb, oldal, felkar",
    description:
      "Két koi egymás körül, kör alakú pályán: a mozgás és az egyensúly mintája.",
    images: [{ src: "/flash/pcons-023.webp", alt: "P’CONs #023 – két koi hal körpályán", kind: "art", label: "Minta" }],
  },
  {
    id: "022",
    collection: "P’CONs",
    price: 90000,
    size: "12–15 cm",
    placements: "alkar, gerinc, lábszár",
    description:
      "Holdkorong egyetlen függőleges vonalon. A kollekció legletisztultabb darabja.",
    badge: "Új",
    images: [{ src: "/flash/pcons-022.webp", alt: "P’CONs #022 – holdkorong egy függőleges vonalon", kind: "art", label: "Minta" }],
  },
  {
    id: "021",
    collection: "P’CONs",
    price: 90000,
    size: "14–18 cm",
    placements: "alkar, comb, oldal",
    description: "Orchideák körök metszéspontjában, finom vonalas kerettel.",
    sold: true,
    images: [{ src: "/flash/pcons-021.webp", alt: "P’CONs #021 – orchideák körök metszéspontjában", kind: "art", label: "Minta" }],
  },
  {
    id: "020",
    collection: "P’CONs",
    price: 110000,
    size: "15–18 cm",
    placements: "alkar, comb, felkar",
    description: "Szétcsúszó arc, függőleges vonalakra bontva.",
    images: [{ src: "/flash/pcons-020.webp", alt: "P’CONs #020 – függőleges vonalakra bomló arc", kind: "art", label: "Minta" }],
  },
];

export function designName(d: FlashDesign) {
  return `${d.collection} #${d.id}`;
}

// Deterministic on server and client, so no hydration mismatch from Intl.
export function formatPrice(n: number) {
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;
}
