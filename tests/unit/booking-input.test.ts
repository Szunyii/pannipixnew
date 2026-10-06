import { describe, expect, it } from "vitest";
import { parseBookingInput, placementLabel } from "@/lib/booking-input";

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
      phone: "Adj meg egy érvényes telefonszámot.",
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
});

describe("placementLabel", () => {
  it("turns a stored value into its Hungarian label", () => {
    expect(placementLabel("labszar")).toBe("Lábszár");
    expect(placementLabel("ismeretlen")).toBe("ismeretlen");
  });
});
