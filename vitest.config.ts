import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    fileParallelism: false,
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/app/**/*.test.ts",
    ],
    exclude: ["tests/rls/**", "tests/a11y/**"],
    setupFiles: ["tests/setup-env.ts"],
  },
  resolve: {
    alias: {
      "@": root,
    },
  },
});
