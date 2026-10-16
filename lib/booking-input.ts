import { SLOT_PICKING } from "./features";

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
  /** null while visitors don't pick a slot (SLOT_PICKING): the admin gives the booking one afterwards. */
  slotId: number | null;
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

/** Pasted or autofilled numbers often carry no-break spaces and typographic dashes that look like the plain ones. */
const phoneText = (value: unknown) =>
  text(value)
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/[\u2010-\u2015\u2212]/g, "-");

/** Browsers post a textarea's line breaks as CRLF; count and keep them as one character, like the textarea's own maxLength. */
const noteText = (value: unknown) => text(value).replace(/\r\n?/g, "\n");

const positiveInt = (value: unknown) => {
  const raw = text(value);
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

const isPlacement = (value: string): value is Placement => PLACEMENTS.some((p) => p.value === value);

/** Controls (CR, LF, tab, C1), line and paragraph separators and bidi overrides: a name is one plain line. */
const NOT_IN_A_NAME = /[\p{Cc}\p{Zl}\p{Zp}\u202a-\u202e\u2066-\u2069]/u;

/** The name goes into the emails and the form takes any address, so a link in it would be spam sent from our mailbox. */
const LINK_LIKE = /:\/\/|www\.|https?:/i;

/**
 * The rule Payload applies to the booking's email field (payload 3.90.2, fields/validations). Anything laxer here
 * passes the form and then fails inside payload.create, where the visitor only gets the generic error.
 */
const EMAIL =
  /^(?!.*\.\.)[\w!#$%&'*+/=?^`{|}~-](?:[\w!#$%&'*+/=?^`{|}~.-]*[\w!#$%&'*+/=?^`{|}~-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

/** Checks the booking form on the server; the browser's own validation is only a convenience. */
export function parseBookingInput(
  raw: Record<string, unknown>,
): { ok: true; data: BookingInput } | { ok: false; fieldErrors: FieldErrors } {
  const errors: FieldErrors = {};
  const designId = positiveInt(raw.designId);
  // While visitors don't pick a slot, a posted one is ignored: the endpoint takes any field, whatever the form shows.
  const slotId = SLOT_PICKING ? positiveInt(raw.slotId) : null;
  const name = text(raw.name);
  const email = text(raw.email);
  const phone = phoneText(raw.phone);
  const placement = text(raw.placement);
  const note = noteText(raw.note);

  if (designId === null) errors.designId = "Hiányzik a minta.";
  if (SLOT_PICKING && slotId === null) errors.slotId = "Válassz időpontot.";
  if (name.length < 2 || name.length > 100 || NOT_IN_A_NAME.test(name) || LINK_LIKE.test(name)) {
    errors.name = "Add meg a neved.";
  }
  if (email.length > 254 || !EMAIL.test(email)) {
    errors.email = "Adj meg egy érvényes e-mail-címet.";
  }
  if (!/^[0-9+()\-/. ]{6,20}$/.test(phone) || phone.replace(/\D/g, "").length < 6) {
    errors.phone = "Adj meg egy érvényes telefonszámot (pl. +36 30 123 4567).";
  }
  if (!isPlacement(placement)) errors.placement = "Válaszd ki a testtájat.";
  if (note.length > 1000) errors.note = "A megjegyzés legfeljebb 1000 karakter lehet.";
  if (raw.adult !== "on" && raw.adult !== "true" && raw.adult !== true) {
    errors.adult = "Csak 18 év felett foglalhatsz.";
  }

  if (designId === null || !isPlacement(placement) || Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }
  return {
    ok: true,
    data: { designId, slotId, name, email, phone, placement, note, website: text(raw.website) },
  };
}
