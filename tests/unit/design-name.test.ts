import { describe, expect, it } from "vitest";
import { designName, designPath } from "@/lib/design-name";

describe("designName", () => {
  it("is the collection's name followed by the design's number", () => {
    expect(designName({ collection: "P’CONs", number: "027" })).toBe("P’CONs #027");
  });
});

describe("designPath", () => {
  it("is the design's page, under its collection's stored value", () => {
    expect(designPath({ category: "pcons", number: "027" })).toBe("/flash/pcons/027");
  });

  it("escapes a number the address can't carry as it is", () => {
    expect(designPath({ category: "ornx", number: "1/a b" })).toBe("/flash/ornx/1%2Fa%20b");
  });
});
