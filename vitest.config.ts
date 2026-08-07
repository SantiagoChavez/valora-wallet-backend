import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    env: {
      GEMINI_API_KEY: "test_dummy_key"
    }
  },
});
