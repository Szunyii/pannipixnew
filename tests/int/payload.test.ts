import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getTestPayload } from "../helpers";

describe("payload", () => {
  it("boots on a fresh SQLite file and stores uploads with a thumbnail", async () => {
    const payload = await getTestPayload();
    const media = await payload.create({
      collection: "media",
      data: { alt: "Teszt kép" },
      filePath: fileURLToPath(new URL("../fixtures/sample.webp", import.meta.url)),
    });
    expect(media.url).toMatch(/^\/api\/media\/file\/sample.*\.webp$/);
    expect(media.sizes?.thumbnail?.width).toBe(320);
  });
});
