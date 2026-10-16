import { describe, expect, it } from "vitest";
import { type FlashDesign, availabilityLabel, priceRange, rowOrder, ruleSummary, sharedRule } from "@/components/data";
import { type BookingRule, availability } from "@/lib/booking-rules";

let sequence = 0;

/** A design booked once, at the given price, still bookable unless sold out. */
function design(price: number, { soldOut = false } = {}): FlashDesign {
  sequence += 1;
  return {
    id: sequence,
    number: String(sequence).padStart(3, "0"),
    category: "pcons",
    collection: "Teszt",
    price,
    size: "",
    placements: "",
    description: "",
    createdAt: "2026-10-01T10:00:00.000Z",
    images: [{ src: "/flash/teszt.webp", alt: "Tesztminta", kind: "art", label: "Minta" }],
    availability: availability({ rule: "single" }, soldOut ? 1 : 0),
  };
}

/** A design that can still be booked, under the given rule. */
function designUnder(rule: BookingRule): FlashDesign {
  return { ...design(90000), availability: availability({ rule, limit: 3 }, 0) };
}

describe("priceRange", () => {
  it("is null when nothing can be booked", () => {
    expect(priceRange([])).toBeNull();
    expect(priceRange([design(90000, { soldOut: true })])).toBeNull();
  });

  it("gives one price when every bookable design costs the same", () => {
    expect(priceRange([design(90000)])).toBe("90 000 Ft");
    expect(priceRange([design(90000), design(90000)])).toBe("90 000 Ft");
  });

  it("spans the cheapest to the dearest bookable design", () => {
    expect(priceRange([design(120000), design(60000), design(90000)])).toBe("60 000 – 120 000 Ft");
  });

  it("leaves sold-out designs out", () => {
    expect(priceRange([design(30000, { soldOut: true }), design(90000), design(150000, { soldOut: true })])).toBe(
      "90 000 Ft",
    );
    expect(
      priceRange([design(30000, { soldOut: true }), design(60000), design(120000), design(200000, { soldOut: true })]),
    ).toBe("60 000 – 120 000 Ft");
  });
});

describe("rowOrder", () => {
  it("keeps the order it is given, with the sold-out designs at the end", () => {
    const [a, b, c] = [design(1), design(2, { soldOut: true }), design(3)];
    expect(rowOrder([a, b, c]).map((d) => d.price)).toEqual([1, 3, 2]);
  });
});

describe("availabilityLabel", () => {
  it("names the rule of a design that can still be booked", () => {
    expect(availabilityLabel(availability({ rule: "single" }, 0))).toBe("Egyszeri minta");
    expect(availabilityLabel(availability({ rule: "limited", limit: 3 }, 1))).toBe("Limitált · még 2 alkalom");
    expect(availabilityLabel(availability({ rule: "unlimited" }, 12))).toBe("Korlátlanul foglalható");
  });

  it("says sold out whatever the rule", () => {
    expect(availabilityLabel(availability({ rule: "single" }, 1))).toBe("Elkelt");
    expect(availabilityLabel(availability({ rule: "limited", limit: 3 }, 3))).toBe("Elkelt");
  });
});

describe("ruleSummary", () => {
  it.each([
    ["single", "Egyszeri"],
    ["limited", "Limitált"],
    ["unlimited", "Korlátlan"],
  ] as const)("names the rule when every design shown is %s", (rule, label) => {
    const designs = [designUnder(rule), designUnder(rule)];
    expect(ruleSummary(designs)).toBe(label);
    expect(sharedRule(designs)).toBe(rule);
  });

  it("says each design states its own when the designs differ", () => {
    const designs = [designUnder("single"), designUnder("single"), designUnder("unlimited")];
    expect(ruleSummary(designs)).toBe("Mintánként megadva");
    expect(sharedRule(designs)).toBeNull();
    expect(sharedRule([designUnder("limited"), designUnder("single")])).toBeNull();
  });

  it("counts a sold-out design: it is still shown, under its rule", () => {
    const soldOut = design(90000, { soldOut: true });
    expect(ruleSummary([soldOut, designUnder("unlimited")])).toBe("Mintánként megadva");
    expect(ruleSummary([soldOut])).toBe("Egyszeri");
  });

  it("shows the other facts' placeholder when there are no designs", () => {
    expect(ruleSummary([])).toBe("Mintánként megadva");
    expect(sharedRule([])).toBeNull();
  });
});
