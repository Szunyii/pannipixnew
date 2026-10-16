import { describe, expect, it } from "vitest";
import { CATEGORIES, type CategorySlug, categoryName } from "@/lib/categories";

describe("flash collections", () => {
  it("are P’CONs, ORNX and daddywillhateus, in the order the site's filter shows them", () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual(["P’CONs", "ORNX", "daddywillhateus"]);
  });

  it("each have their own value, since that is what a design stores", () => {
    const values = CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("each head their row of designs with a sentence", () => {
    for (const { tagline } of CATEGORIES) expect(tagline).toMatch(/^\S.*\.$/);
  });

  it("are named by their label", () => {
    expect(categoryName("pcons")).toBe("P’CONs");
    expect(categoryName("daddywillhateus")).toBe("daddywillhateus");
  });

  it("fall back to the stored value for a collection that left the list", () => {
    expect(categoryName("regi" as CategorySlug)).toBe("regi");
  });
});
