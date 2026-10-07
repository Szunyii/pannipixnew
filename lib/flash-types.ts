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
