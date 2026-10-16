import type { Availability } from "./booking-rules";
import type { CategorySlug } from "./categories";

export type DesignImage = {
  src: string;
  alt: string;
  /** "art" sits on the stencil panel and multiplies onto it; "photo" fills the panel */
  kind: "art" | "photo";
  label: string;
};

export type FlashDesign = {
  id: number;
  /** Printed after the collection name: "027" in "P’CONs #027". */
  number: string;
  /** The collection's stored value, e.g. "pcons"; the design's own page is addressed by it. */
  category: CategorySlug;
  /** The collection's name as printed, e.g. "P’CONs". */
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
