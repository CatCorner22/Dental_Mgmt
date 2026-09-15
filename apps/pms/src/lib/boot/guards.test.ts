import { describe, expect, it } from "vitest";
import { productionBootErrors } from "./guards";

describe("production boot guards", () => {
  it("are silent outside production", () => {
    expect(productionBootErrors({ NODE_ENV: "development" })).toEqual([]);
  });

  it("refuse production without verify-full Postgres and companions", () => {
    const errors = productionBootErrors({ NODE_ENV: "production" });
    expect(errors.some((e) => e.includes("POSTGRES_URL"))).toBe(true);
  });

  it("accept a complete production env", () => {
    expect(
      productionBootErrors({
        NODE_ENV: "production",
        POSTGRES_URL: "postgres://db?sslmode=verify-full",
        KMS_KEY_ID: "kms-1",
        BACKUP_TARGET: "s3://backups",
        OBJECT_STORAGE_URL: "s3://objects",
        APPEND_ROLE_DSN: "postgres://append?sslmode=verify-full",
      })
    ).toEqual([]);
  });
});
