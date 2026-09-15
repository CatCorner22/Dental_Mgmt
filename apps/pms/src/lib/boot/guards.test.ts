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

  it("refuses production with DEV_MFA_KEY", () => {
    const errors = productionBootErrors({
      NODE_ENV: "production",
      POSTGRES_URL: "postgres://db?sslmode=verify-full",
      DEV_MFA_KEY: "dev-only",
      BACKUP_TARGET: "s3://backups",
      OBJECT_STORAGE_URL: "s3://objects",
      APPEND_ROLE_DSN: "postgres://append?sslmode=verify-full",
    });
    expect(errors.some((e) => e.includes("DEV_MFA_KEY"))).toBe(true);
  });

  it("refuse production with the memory auth store", () => {
    const errors = productionBootErrors({
      NODE_ENV: "production",
      POSTGRES_URL: "postgres://db?sslmode=verify-full",
      KMS_KEY_ID: "kms-1",
      BACKUP_TARGET: "s3://backups",
      OBJECT_STORAGE_URL: "s3://objects",
      APPEND_ROLE_DSN: "postgres://append?sslmode=verify-full",
      AUTH_DEV_MEMORY: "1",
    });
    expect(errors.some((e) => e.includes("AUTH_DEV_MEMORY"))).toBe(true);
  });
});
