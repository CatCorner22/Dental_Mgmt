import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      BCRYPT_COST: "4",
      DEV_MFA_KEY: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      AUTH_DEV_MEMORY: "1",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
});
