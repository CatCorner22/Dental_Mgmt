import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Increment 0.1 schema. No PHI patient rows.
 * tenant_id is on every tenant-scoped table and is in every unique index.
 */

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("locations_tenant_idx").on(t.tenantId),
    uniqueIndex("locations_tenant_name_uidx").on(t.tenantId, t.name),
  ]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(),
    clinicalRole: text("clinical_role").notNull().default("unset"),
    active: boolean("active").notNull().default(true),
    /** Envelope-encrypted TOTP secret. Null until MFA enrollment completes. */
    mfaSecretEnc: jsonb("mfa_secret_enc"),
    mfaEnrolledAt: timestamp("mfa_enrolled_at", { withTimezone: true }),
    recoveryCodesHash: text("recovery_codes_hash"),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("users_tenant_idx").on(t.tenantId),
    uniqueIndex("users_tenant_username_uidx").on(t.tenantId, t.username),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
    deviceProfile: text("device_profile").notNull().default("desk"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("sessions_tenant_user_idx").on(t.tenantId, t.userId),
    index("sessions_idle_idx").on(t.idleExpiresAt),
  ]
);

export const userEntitlements = pgTable(
  "user_entitlements",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    entitlement: text("entitlement").notNull(),
    grantedBy: uuid("granted_by"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    reason: text("reason"),
  },
  (t) => [index("user_entitlements_tenant_user_idx").on(t.tenantId, t.userId)]
);

export const domainEvent = pgTable(
  "domain_event",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    actorUserId: uuid("actor_user_id"),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    /** Per-tenant position in the chain, from 1. Defines order; forbids forks. */
    seq: bigint("seq", { mode: "number" }).notNull(),
  },
  (t) => [
    index("domain_event_tenant_occurred_idx").on(t.tenantId, t.occurredAt),
    uniqueIndex("domain_event_tenant_hash_uidx").on(t.tenantId, t.hash),
    uniqueIndex("domain_event_tenant_seq_uidx").on(t.tenantId, t.seq),
  ]
);

export const phiAccessLog = pgTable(
  "phi_access_log",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    purpose: text("purpose").notNull(),
    recordKind: text("record_kind").notNull(),
    recordIds: jsonb("record_ids").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
  },
  (t) => [index("phi_access_log_tenant_at_idx").on(t.tenantId, t.at)]
);

export const integrationRegistry = pgTable(
  "integration_registry",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    vendor: text("vendor").notNull(),
    purpose: text("purpose").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    baaSignedAt: timestamp("baa_signed_at", { withTimezone: true }),
    baaExpiresAt: timestamp("baa_expires_at", { withTimezone: true }),
    baaDocumentRef: text("baa_document_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("integration_registry_tenant_vendor_uidx").on(t.tenantId, t.vendor, t.purpose),
  ]
);

export const authThrottle = pgTable("auth_throttle", {
  key: text("key").primaryKey(),
  tenantId: uuid("tenant_id"),
  failCount: integer("fail_count").notNull().default(0),
  firstFailAt: timestamp("first_fail_at", { withTimezone: true }).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

export const TENANT_SCOPED_TABLES = [
  "locations",
  "users",
  "sessions",
  "user_entitlements",
  "domain_event",
  "phi_access_log",
  "integration_registry",
] as const;
