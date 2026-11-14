import { defineConfig } from "vitest/config";

// Pure-logic tests only (search, time math, pins). No SvelteKit plugin needed.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
