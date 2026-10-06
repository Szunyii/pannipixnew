import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Payload keeps its instance on globalThis and reads env when the config is imported, so a test file
    // only gets its own database in its own process. Vitest suggests `isolate: false` for import-heavy suites: don't.
    pool: "forks",
    isolate: true,
    // Booting Payload and pushing the schema takes about a second per file; the rest is headroom for slow CI.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
