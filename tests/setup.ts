import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, vi } from "vitest";

// Every test file runs in its own process with its own throwaway database and upload folder.
const dir = mkdtempSync(path.join(tmpdir(), "pannipix-test-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.MEDIA_DIR = path.join(dir, "media");
process.env.PAYLOAD_SECRET = "test-secret";
process.env.ADMIN_EMAIL = "admin@example.com";
process.env.SITE_URL = "https://pannipix.test";
delete process.env.SMTP_HOST;
// A NODE_ENV=production in the developer's shell would skip Payload's schema push.
vi.stubEnv("NODE_ENV", "test");
// The app formats times in Europe/Budapest explicitly; UTC here catches any accidental use of the machine's zone.
process.env.TZ = "UTC";

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
