import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    include: ["tests/a11y/**/*.test.ts"],
    setupFiles: ["tests/setup-env.ts"],
  },
  resolve: {
    alias: {
      "@": root,
    },
  },
});
