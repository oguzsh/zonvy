import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pure-logic tests only (search, time math, pins). No SvelteKit plugin needed.
export default defineConfig({
  resolve: {
    alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
