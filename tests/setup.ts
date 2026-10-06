import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Every test file runs in its own process with its own throwaway database and upload folder.
const dir = mkdtempSync(path.join(tmpdir(), "pannipix-test-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.MEDIA_DIR = path.join(dir, "media");
process.env.PAYLOAD_SECRET = "test-secret";
process.env.ADMIN_EMAIL = "admin@example.com";
process.env.SITE_URL = "https://pannipix.test";
delete process.env.SMTP_HOST;
