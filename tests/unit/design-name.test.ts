import { describe, expect, it } from "vitest";
import { designName } from "@/lib/design-name";

describe("designName", () => {
  it("is the collection's name followed by the design's number", () => {
    expect(designName({ collection: "P’CONs", number: "027" })).toBe("P’CONs #027");
  });
});
