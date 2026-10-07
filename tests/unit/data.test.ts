import { describe, expect, it } from "vitest";
import { type FlashDesign, availabilityLabel, priceRange, ruleSummary, sharedRule } from "@/components/data";
import { availability } from "@/lib/booking-rules";

let sequence = 0;

/** A design of a single collection at the given price, still bookable unless sold out. */
function design(price: number, { soldOut = false } = {}): FlashDesign {
  sequence += 1;
  return {
    id: sequence,
    number: String(sequence).padStart(3, "0"),
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
  ] as const)("names the rule when every collection is %s", (rule, label) => {
    expect(ruleSummary([{ rule }, { rule }])).toBe(label);
    expect(sharedRule([{ rule }, { rule }])).toBe(rule);
  });

  it("says it varies when the collections differ", () => {
    expect(ruleSummary([{ rule: "single" }, { rule: "single" }, { rule: "unlimited" }])).toBe("Kollekciónként eltérő");
    expect(sharedRule([{ rule: "limited" }, { rule: "single" }])).toBeNull();
  });

  it("says it varies when there are no collections", () => {
    expect(ruleSummary([])).toBe("Kollekciónként eltérő");
    expect(sharedRule([])).toBeNull();
  });
});
