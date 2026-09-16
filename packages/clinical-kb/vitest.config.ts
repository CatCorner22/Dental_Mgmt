import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@pms/clinical-core": path.resolve(__dirname, "../clinical-core/src/index.ts"),
      "@": path.resolve(__dirname, "../clinical-core/src")
    }
  }
});
