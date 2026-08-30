import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "@thread/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "apps/extension/src/**/*.test.ts"],
    coverage: { reporter: ["text", "json-summary"] },
  },
});
