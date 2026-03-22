import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run source TypeScript tests only — never the compiled dist/ output
    include: ["src/**/__tests__/**/*.ts", "src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
  },
});
