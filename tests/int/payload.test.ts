import path from "node:path";
import { describe, expect, it } from "vitest";
import { getTestPayload } from "../helpers";

describe("payload", () => {
  it("boots on a fresh SQLite file and stores uploads with a thumbnail", async () => {
    const payload = await getTestPayload();
    const media = await payload.create({
      collection: "media",
      data: { alt: "Teszt kép" },
      filePath: path.resolve("public/flash/pcons-027-large.webp"),
    });
    expect(media.url).toMatch(/^\/api\/media\/file\/pcons-027-large.*\.webp$/);
    expect(media.sizes?.thumbnail?.width).toBe(320);
  });
});
