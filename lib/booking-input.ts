export const PLACEMENTS = [
  { value: "alkar", label: "Alkar" },
  { value: "felkar", label: "Felkar" },
  { value: "comb", label: "Comb" },
  { value: "labszar", label: "Lábszár" },
  { value: "hat", label: "Hát" },
  { value: "oldal", label: "Oldal" },
  { value: "gerinc", label: "Gerinc" },
  { value: "mas", label: "Más testtáj" },
] as const;

export type Placement = (typeof PLACEMENTS)[number]["value"];

export const placementLabel = (value: string) => PLACEMENTS.find((p) => p.value === value)?.label ?? value;

export type BookingInput = {
  designId: number;
  slotId: number;
  name: string;
  email: string;
  phone: string;
  placement: Placement;
  note: string;
  /** Honeypot: people never see this field, so anything in it came from a bot. */
  website: string;
};

export type BookingField = "designId" | "slotId" | "name" | "email" | "phone" | "placement" | "note" | "adult";
export type FieldErrors = Partial<Record<BookingField, string>>;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const positiveInt = (value: unknown) => {
  const n = Number(text(value));
  return Number.isInteger(n) && n > 0 ? n : null;
};

const isPlacement = (value: string): value is Placement => PLACEMENTS.some((p) => p.value === value);

/** Checks the booking form on the server; the browser's own validation is only a convenience. */
export function parseBookingInput(
  raw: Record<string, unknown>,
): { ok: true; data: BookingInput } | { ok: false; fieldErrors: FieldErrors } {
  const errors: FieldErrors = {};
  const designId = positiveInt(raw.designId);
  const slotId = positiveInt(raw.slotId);
  const name = text(raw.name);
  const email = text(raw.email);
  const phone = text(raw.phone);
  const placement = text(raw.placement);
  const note = text(raw.note);

  if (designId === null) errors.designId = "Hiányzik a minta.";
  if (slotId === null) errors.slotId = "Válassz időpontot.";
  if (name.length < 2 || name.length > 100) errors.name = "Add meg a neved.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Adj meg egy érvényes e-mail-címet.";
  }
  if (!/^[0-9+()\-\s]{6,20}$/.test(phone) || phone.replace(/\D/g, "").length < 6) {
    errors.phone = "Adj meg egy érvényes telefonszámot.";
  }
  if (!isPlacement(placement)) errors.placement = "Válaszd ki a testtájat.";
  if (note.length > 1000) errors.note = "A megjegyzés legfeljebb 1000 karakter lehet.";
  if (raw.adult !== "on" && raw.adult !== "true" && raw.adult !== true) {
    errors.adult = "Csak 18 év felett foglalhatsz.";
  }

  if (designId === null || slotId === null || !isPlacement(placement) || Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }
  return {
    ok: true,
    data: { designId, slotId, name, email, phone, placement, note, website: text(raw.website) },
  };
}
