import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Booting Payload and pushing the schema to a fresh SQLite file takes a few seconds per test file.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
