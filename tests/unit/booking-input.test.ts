import { email as payloadEmail } from "payload/shared";
import { describe, expect, it } from "vitest";
import { PLACEMENTS, parseBookingInput, placementLabel } from "@/lib/booking-input";

const valid = {
  designId: "12",
  slotId: "4",
  name: "  Kovács Anna ",
  email: "anna@example.com",
  phone: "+36 30 123 4567",
  placement: "alkar",
  note: "Bal alkarra",
  adult: "on",
  website: "",
};

const PHONE_ERROR = "Adj meg egy érvényes telefonszámot (pl. +36 30 123 4567).";

describe("parseBookingInput", () => {
  it("accepts a complete form and trims the text", () => {
    expect(parseBookingInput(valid)).toEqual({
      ok: true,
      data: {
        designId: 12,
        slotId: 4,
        name: "Kovács Anna",
        email: "anna@example.com",
        phone: "+36 30 123 4567",
        placement: "alkar",
        note: "Bal alkarra",
        website: "",
      },
    });
  });

  it("reports every missing field", () => {
    const result = parseBookingInput({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual(
      ["adult", "designId", "email", "name", "phone", "placement", "slotId"].sort(),
    );
  });

  it("rejects a bad email, a short or lettered phone, an unknown placement and a long note", () => {
    const result = parseBookingInput({
      ...valid,
      email: "anna@",
      phone: "12-ab",
      placement: "fül",
      note: "x".repeat(1001),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toEqual({
      email: "Adj meg egy érvényes e-mail-címet.",
      phone: PHONE_ERROR,
      placement: "Válaszd ki a testtájat.",
      note: "A megjegyzés legfeljebb 1000 karakter lehet.",
    });
  });

  it("requires the 18+ box", () => {
    const result = parseBookingInput({ ...valid, adult: undefined });
    expect(result).toEqual({ ok: false, fieldErrors: { adult: "Csak 18 év felett foglalhatsz." } });
  });

  it("passes the honeypot through for the caller to judge", () => {
    const result = parseBookingInput({ ...valid, website: "spam.example" });
    expect(result.ok && result.data.website).toBe("spam.example");
  });

  it.each(["0", "1e3", "0x10", "12.0", "99999999999999999999"])("rejects %j as a design or slot id", (id) => {
    const result = parseBookingInput({ ...valid, designId: id, slotId: id });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toEqual({ designId: "Hiányzik a minta.", slotId: "Válassz időpontot." });
  });

  it("rejects a line break in the phone number", () => {
    const result = parseBookingInput({ ...valid, phone: "123\n456789" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toEqual({ phone: PHONE_ERROR });
  });

  it.each([
    ["line break", "Anna\nBcc: x"],
    ["tab", "Anna\tKiss"],
    ["delete character", "Anna\u007fKiss"],
    ["next-line character", "Anna\u0085Kiss"],
    ["line separator", "Anna\u2028Kiss"],
    ["bidi override", "Anna\u202eKiss"],
  ])("rejects a %s in the name", (_kind, name) => {
    const result = parseBookingInput({ ...valid, name });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toEqual({ name: "Add meg a neved." });
  });

  it("keeps line breaks in the note, which comes from a textarea", () => {
    const result = parseBookingInput({ ...valid, note: "Bal alkar\nkülső oldal" });
    expect(result.ok && result.data.note).toBe("Bal alkar\nkülső oldal");
  });

  it("counts a posted line break (CRLF) as one character, like the textarea's own maxLength does", () => {
    const typed = `${"x".repeat(990)}${"\n".repeat(5)}${"y".repeat(5)}`; // exactly 1000 characters in the browser
    const result = parseBookingInput({ ...valid, note: typed.replaceAll("\n", "\r\n") });
    expect(result.ok && result.data.note).toBe(typed);
  });
});

describe("parseBookingInput boundaries", () => {
  const emailOfLength = (n: number) => `${"a".repeat(n - 5)}@b.co`;

  it.each([
    { label: "a name of 1 character", field: "name", value: "A", ok: false },
    { label: "a name of 2 characters, accents included", field: "name", value: "Ád", ok: true },
    { label: "a name of 100 characters", field: "name", value: "a".repeat(100), ok: true },
    { label: "a name of 101 characters", field: "name", value: "a".repeat(101), ok: false },
    { label: "an email of 254 characters", field: "email", value: emailOfLength(254), ok: true },
    { label: "an email of 255 characters", field: "email", value: emailOfLength(255), ok: false },
    { label: "an email without a dot after the @", field: "email", value: "anna@example", ok: false },
    { label: "an email with a space", field: "email", value: "an na@example.com", ok: false },
    { label: "a phone of 5 digits", field: "phone", value: "12345", ok: false },
    { label: "a phone of 5 digits padded out with punctuation", field: "phone", value: "+(1)-2 3-4 5", ok: false },
    { label: "a phone with letters", field: "phone", value: "123456abc", ok: false },
    { label: "a phone of 20 characters", field: "phone", value: "12345678901234567890", ok: true },
    { label: "a phone of 21 characters", field: "phone", value: "123456789012345678901", ok: false },
    { label: "a phone with parentheses, plus and hyphen", field: "phone", value: "+(36) 30-123 4567", ok: true },
    { label: "design id 0", field: "designId", value: "0", ok: false },
    { label: "slot id 0", field: "slotId", value: "0", ok: false },
  ])("$label", ({ field, value, ok }) => {
    const result = parseBookingInput({ ...valid, [field]: value });
    expect(result.ok).toBe(ok);
    // Only the field under test may complain.
    if (!ok && !result.ok) expect(Object.keys(result.fieldErrors)).toEqual([field]);
  });
});

describe("phone numbers as people write and paste them", () => {
  it.each([
    { label: "the Hungarian slash notation", input: "06 30/123-4567", stored: "06 30/123-4567" },
    { label: "dots", input: "06.30.123.4567", stored: "06.30.123.4567" },
    { label: "no-break spaces from a copied number", input: "+36\u00a030\u00a0123\u00a04567", stored: "+36 30 123 4567" },
    { label: "narrow no-break spaces", input: "+36\u202f30\u202f123\u202f4567", stored: "+36 30 123 4567" },
    { label: "en dashes", input: "06\u201330\u2013123\u20134567", stored: "06-30-123-4567" },
    { label: "runs of spaces", input: "+36   30 123  4567", stored: "+36 30 123 4567" },
  ])("accepts $label and stores plain characters", ({ input, stored }) => {
    const result = parseBookingInput({ ...valid, phone: input });
    expect(result.ok && result.data.phone).toBe(stored);
  });
});

describe("email", () => {
  // The booking's email field is validated by Payload on create. Whatever this form lets through but Payload refuses
  // shows up as an unspecific failure instead of a message under the field.
  const payloadAccepts = (value: string) =>
    payloadEmail(value, { required: true, req: { t: (key: string) => key, payload: { config: { collections: [] } } } } as never) === true;

  it.each([
    "anna@example.com",
    "anna.kovacs+flash@gmail.com",
    "ANNA@EXAMPLE.COM",
    "a'b@example.com",
    "anna@sub.example.co.uk",
    "anna@example.c",
    "anna@example.com.",
    "a..b@example.com",
    ".anna@example.com",
    "anna@-example.com",
    "anna@exa_mple.com",
    "kovács.anna@gmail.com",
    "anna@példa.hu",
    "an,na@example.com",
    "Anna<anna@example.com>",
    "anna@1.2.3.4",
  ])("gives %j the same verdict as Payload", (value) => {
    const result = parseBookingInput({ ...valid, email: value });
    const formAccepts = result.ok || !("email" in result.fieldErrors);
    expect(formAccepts).toBe(payloadAccepts(value));
  });
});

describe("placements", () => {
  it("offers the eight body areas of the spec, and accepts every one of them", () => {
    expect(PLACEMENTS).toEqual([
      { value: "alkar", label: "Alkar" },
      { value: "felkar", label: "Felkar" },
      { value: "comb", label: "Comb" },
      { value: "labszar", label: "Lábszár" },
      { value: "hat", label: "Hát" },
      { value: "oldal", label: "Oldal" },
      { value: "gerinc", label: "Gerinc" },
      { value: "mas", label: "Más testtáj" },
    ]);
    for (const { value } of PLACEMENTS) expect(parseBookingInput({ ...valid, placement: value }).ok).toBe(true);
  });
});

describe("placementLabel", () => {
  it("turns a stored value into its Hungarian label", () => {
    expect(placementLabel("labszar")).toBe("Lábszár");
    expect(placementLabel("ismeretlen")).toBe("ismeretlen");
  });
});
