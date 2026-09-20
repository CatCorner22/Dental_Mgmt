import { bigint, boolean, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
    /** Business hours per weekday, ["HH:MM", "HH:MM"] in the location's timezone, or null when closed (Increment 1.29). */
    hours: jsonb("hours")
      .notNull()
      .default({
        mon: ["07:00", "19:00"],
        tue: ["07:00", "19:00"],
        wed: ["07:00", "19:00"],
        thu: ["07:00", "19:00"],
        fri: ["07:00", "17:00"],
        sat: null,
        sun: null,
      }),
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
    /** The control decision that permitted a grant with a critical SoD conflict. */
    decisionId: uuid("decision_id"),
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

export const auditChainChecks = pgTable(
  "audit_chain_checks",
  {
    tenantId: uuid("tenant_id").notNull(),
    day: date("day").notNull(),
    ok: boolean("ok").notNull(),
    headHash: text("head_hash").notNull(),
    eventCount: integer("event_count").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
    objectLockKey: text("object_lock_key"),
  },
  (t) => [index("audit_chain_checks_day_idx").on(t.day)]
);

export const disclosures = pgTable(
  "disclosures",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
    channel: text("channel").notNull(),
    recipient: text("recipient").notNull(),
    recordIds: jsonb("record_ids").notNull(),
    purpose: text("purpose").notNull(),
    actorUserId: uuid("actor_user_id").notNull(),
    actorName: text("actor_name").notNull(),
    documentId: uuid("document_id"),
  },
  (t) => [index("disclosures_tenant_patient_at_idx").on(t.tenantId, t.patientId, t.at)]
);

export const recoveryCeremonies = pgTable(
  "recovery_ceremonies",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    targetUserId: uuid("target_user_id").notNull(),
    initiatedBy: uuid("initiated_by").notNull(),
    approvedBy: uuid("approved_by"),
    initiatedAt: timestamp("initiated_at", { withTimezone: true }).notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    resetTokenHash: text("reset_token_hash"),
  },
  (t) => [index("recovery_ceremonies_target_idx").on(t.tenantId, t.targetUserId, t.initiatedAt)]
);

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    mrn: text("mrn").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    primaryLocationId: uuid("primary_location_id").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    createdById: uuid("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
  },
  (t) => [
    index("patients_tenant_idx").on(t.tenantId),
    uniqueIndex("patients_tenant_mrn_uidx").on(t.tenantId, t.mrn),
  ]
);

export const guarantorAccounts = pgTable(
  "guarantor_accounts",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    displayName: text("display_name").notNull(),
    statementHold: boolean("statement_hold").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    createdById: uuid("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
  },
  (t) => [index("guarantor_accounts_tenant_idx").on(t.tenantId)]
);

/**
 * The reason codes one practice has adopted (migration 0010; governed from a
 * screen since Increment 1.45). `ledger_entries.reason_code` is a foreign key
 * into (tenant_id, code), so the code itself never changes and a code in use
 * is never deleted: retiring one clears `active` and leaves history readable.
 */
export const reasonCodes = pgTable(
  "reason_codes",
  {
    tenantId: uuid("tenant_id").notNull(),
    code: text("code").notNull(),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    /**
     * The figure above which a posting under this reason waits for a second
     * person (Increment 1.46). Null means the practice set no rule and the
     * channel's threshold governs; 0 means every one of them waits. It only
     * tightens: the effective threshold is the lesser of this and the channel's.
     */
    requiresApprovalOverCents: bigint("requires_approval_over_cents", { mode: "number" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.code] }),
    index("reason_codes_tenant_kind_idx").on(t.tenantId, t.kind),
  ]
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    accountId: uuid("account_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    locationId: uuid("location_id").notNull(),
    kind: text("kind").notNull(),
    glBucket: text("gl_bucket").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("USD"),
    reasonCode: text("reason_code"),
    effectiveDate: date("effective_date").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    createdById: uuid("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    encounterId: uuid("encounter_id"),
    procedureId: uuid("procedure_id"),
    claimId: uuid("claim_id"),
    coverageId: uuid("coverage_id"),
    reversesEntryId: uuid("reverses_entry_id"),
    /** The entry this row corrects: set on a reversal and on the repost written with it (Increment 1.37). */
    correctsEntryId: uuid("corrects_entry_id"),
    approvalRequestId: uuid("approval_request_id"),
    /** The policy exception that licensed a single release above threshold. */
    appliedExceptionId: text("applied_exception_id"),
    /** True when this row landed against a day the practice had already frozen (Increment 1.40). */
    postedAfterClose: boolean("posted_after_close").notNull().default(false),
    /** The frozen day close this row landed behind; set by the database, never by the writer. */
    closedDayId: uuid("closed_day_id"),
    tender: text("tender"),
    memo: text("memo"),
    idempotencyKey: text("idempotency_key").notNull(),
    insuranceExpectedCents: bigint("insurance_expected_cents", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("ledger_entries_tenant_account_idx").on(t.tenantId, t.accountId, t.postedAt),
    index("ledger_entries_tenant_patient_idx").on(t.tenantId, t.patientId, t.effectiveDate),
    uniqueIndex("ledger_entries_tenant_idempotency_uidx").on(t.tenantId, t.idempotencyKey),
    index("ledger_entries_closed_day_idx").on(t.tenantId, t.closedDayId),
  ]
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    paymentEntryId: uuid("payment_entry_id").notNull(),
    chargeEntryId: uuid("charge_entry_id").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("payment_allocations_payment_idx").on(t.paymentEntryId),
    index("payment_allocations_charge_idx").on(t.chargeEntryId),
  ]
);

export const controlPolicies = pgTable(
  "control_policies",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    version: integer("version").notNull(),
    rulebookVersion: text("rulebook_version").notNull(),
    policy: jsonb("policy").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    createdById: uuid("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
  },
  (t) => [
    index("control_policies_tenant_effective_idx").on(t.tenantId, t.effectiveFrom),
    uniqueIndex("control_policies_tenant_version_uidx").on(t.tenantId, t.version),
  ]
);

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    status: text("status").notNull().default("pending"),
    channel: text("channel").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("USD"),
    subjectKind: text("subject_kind").notNull().default("ledger_post"),
    subjectId: uuid("subject_id"),
    heldPayload: jsonb("held_payload").notNull(),
    evaluation: jsonb("evaluation").notNull(),
    eligibleSecondRoles: text("eligible_second_roles").array().notNull().default([]),
    requesterId: uuid("requester_id").notNull(),
    requesterName: text("requester_name").notNull(),
    secondApproverId: uuid("second_approver_id"),
    secondApproverName: text("second_approver_name"),
    decisionReason: text("decision_reason"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    resultingEntryId: uuid("resulting_entry_id"),
    /** Set when this approval releases a correction pair for that entry (Increment 1.38). */
    correctsEntryId: uuid("corrects_entry_id"),
  },
  (t) => [index("approval_requests_tenant_status_idx").on(t.tenantId, t.status, t.requestedAt)]
);

export const approvalsLog = pgTable(
  "approvals_log",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    requestId: uuid("request_id").notNull(),
    decision: text("decision").notNull(),
    actorId: uuid("actor_id").notNull(),
    actorName: text("actor_name").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("approvals_log_request_idx").on(t.requestId)]
);

export const sodFindings = pgTable(
  "sod_findings",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    ruleId: text("rule_id").notNull(),
    personId: uuid("person_id").notNull(),
    entitlementA: text("entitlement_a").notNull(),
    entitlementB: text("entitlement_b").notNull(),
    severity: text("severity").notNull(),
    score: integer("score").notNull(),
    status: text("status").notNull().default("open"),
    dualReleaseMitigated: boolean("dual_release_mitigated").notNull().default(false),
    residualRiskAccepted: boolean("residual_risk_accepted").notNull().default(false),
    linkedControlId: text("linked_control_id"),
    conflict: jsonb("conflict").notNull(),
    rulebookVersion: text("rulebook_version").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    reopenedCount: integer("reopened_count").notNull().default(0),
  },
  (t) => [
    index("sod_findings_tenant_status_idx").on(t.tenantId, t.status, t.severity),
    uniqueIndex("sod_findings_tenant_rule_person_uidx").on(t.tenantId, t.ruleId, t.personId),
  ]
);

export const controlFindings = pgTable(
  "control_findings",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    kind: text("kind").notNull(),
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    severity: text("severity").notNull(),
    status: text("status").notNull().default("open"),
    detail: jsonb("detail").notNull().default({}),
    detectorVersion: text("detector_version").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedReason: text("closed_reason"),
    reopenedCount: integer("reopened_count").notNull().default(0),
  },
  (t) => [
    index("control_findings_tenant_status_idx").on(t.tenantId, t.status, t.kind),
    uniqueIndex("control_findings_tenant_subject_uidx").on(t.tenantId, t.kind, t.subjectKind, t.subjectId),
  ]
);

export const controlDecisions = pgTable(
  "control_decisions",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    kind: text("kind").notNull(),
    note: text("note").notNull(),
    reviewBy: date("review_by"),
    residualAtDecision: integer("residual_at_decision"),
    supersedesDecisionId: uuid("supersedes_decision_id"),
    decidedById: uuid("decided_by_id").notNull(),
    decidedByName: text("decided_by_name").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
    scoringVersion: text("scoring_version").notNull(),
    rulebookVersion: text("rulebook_version").notNull(),
  },
  (t) => [
    index("control_decisions_subject_idx").on(t.tenantId, t.subjectKind, t.subjectId, t.decidedAt),
    index("control_decisions_review_idx").on(t.tenantId, t.reviewBy),
  ]
);

export const controlSnapshots = pgTable(
  "control_snapshots",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
    trigger: text("trigger").notNull(),
    scoringVersion: text("scoring_version").notNull(),
    rulebookVersion: text("rulebook_version").notNull(),
    averageResidual: integer("average_residual").notNull(),
    cosoOverall: integer("coso_overall").notNull(),
    pressureIndex: integer("pressure_index").notNull(),
    segregationHealth: integer("segregation_health").notNull(),
    openConflicts: integer("open_conflicts").notNull(),
    conflictsWithoutDecision: integer("conflicts_without_decision").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    takenById: uuid("taken_by_id"),
  },
  (t) => [index("control_snapshots_tenant_taken_idx").on(t.tenantId, t.takenAt)]
);

export const importRuns = pgTable(
  "import_runs",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    sourceSystem: text("source_system").notNull().default("curve_hero"),
    reportKind: text("report_kind").notNull(),
    locationId: uuid("location_id"),
    businessDate: date("business_date"),
    fileName: text("file_name"),
    fileSha256: text("file_sha256").notNull(),
    status: text("status").notNull().default("staged"),
    rowCount: integer("row_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    summary: jsonb("summary").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    createdById: uuid("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("import_runs_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("import_runs_tenant_kind_date_idx").on(t.tenantId, t.reportKind, t.businessDate),
  ]
);

export const importStagedRows = pgTable(
  "import_staged_rows",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    runId: uuid("run_id").notNull(),
    rowNumber: integer("row_number").notNull(),
    sourceKey: text("source_key"),
    rowSha256: text("row_sha256").notNull(),
    payload: jsonb("payload").notNull(),
    validationErrors: text("validation_errors").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("import_staged_rows_run_idx").on(t.runId),
    uniqueIndex("import_staged_rows_run_row_uidx").on(t.runId, t.rowNumber),
  ]
);

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    locationId: uuid("location_id"),
    displayName: text("display_name").notNull(),
    institutionName: text("institution_name"),
    accountNumberLast4: text("account_number_last4"),
    currency: text("currency").notNull().default("USD"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("bank_accounts_tenant_idx").on(t.tenantId)]
);

export const bankStatementImports = pgTable(
  "bank_statement_imports",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    bankAccountId: uuid("bank_account_id").notNull(),
    format: text("format").notNull().default("csv"),
    fileName: text("file_name"),
    fileSha256: text("file_sha256").notNull(),
    status: text("status").notNull().default("validated"),
    rowCount: integer("row_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    summary: jsonb("summary").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    createdById: uuid("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("bank_statement_imports_tenant_created_idx").on(t.tenantId, t.createdAt)]
);

export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    bankAccountId: uuid("bank_account_id").notNull(),
    importId: uuid("import_id"),
    postedDate: date("posted_date").notNull(),
    description: text("description").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("USD"),
    externalKey: text("external_key").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("bank_transactions_tenant_account_date_idx").on(
      t.tenantId,
      t.bankAccountId,
      t.postedDate
    ),
    index("bank_transactions_import_idx").on(t.importId),
    uniqueIndex("bank_transactions_tenant_account_external_uidx").on(
      t.tenantId,
      t.bankAccountId,
      t.externalKey
    ),
  ]
);

export const reconciliationRuns = pgTable(
  "reconciliation_runs",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    bankAccountId: uuid("bank_account_id").notNull(),
    importId: uuid("import_id"),
    source: text("source").notNull().default("statement_import"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    status: text("status").notNull().default("open"),
    bankNetCents: bigint("bank_net_cents", { mode: "number" }).notNull().default(0),
    matchedCents: bigint("matched_cents", { mode: "number" }).notNull().default(0),
    varianceCents: bigint("variance_cents", { mode: "number" }).notNull().default(0),
    summary: jsonb("summary").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    createdById: uuid("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    clearedById: uuid("cleared_by_id"),
    clearedByName: text("cleared_by_name"),
  },
  (t) => [index("reconciliation_runs_tenant_created_idx").on(t.tenantId, t.createdAt)]
);

export const reconciliationVariances = pgTable(
  "reconciliation_variances",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    runId: uuid("run_id").notNull(),
    bankTransactionId: uuid("bank_transaction_id"),
    kind: text("kind").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("open"),
    matchRef: jsonb("match_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("reconciliation_variances_run_idx").on(t.runId)]
);

export const deposits = pgTable(
  "deposits",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    locationId: uuid("location_id").notNull(),
    bankAccountId: uuid("bank_account_id").notNull(),
    businessDate: date("business_date").notNull(),
    method: text("method").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("USD"),
    reference: text("reference"),
    status: text("status").notNull().default("open"),
    importStagedRowId: uuid("import_staged_row_id"),
    dayCloseId: uuid("day_close_id"),
    preparedById: uuid("prepared_by_id").notNull(),
    preparedByName: text("prepared_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("deposits_tenant_location_date_idx").on(t.tenantId, t.locationId, t.businessDate),
    uniqueIndex("deposits_tenant_staged_row_uidx").on(t.tenantId, t.importStagedRowId),
  ]
);

export const dayCloses = pgTable(
  "day_closes",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    locationId: uuid("location_id").notNull(),
    businessDate: date("business_date").notNull(),
    status: text("status").notNull().default("open"),
    depositTotalCents: bigint("deposit_total_cents", { mode: "number" }).notNull().default(0),
    daySheetTotalCents: bigint("day_sheet_total_cents", { mode: "number" }).notNull().default(0),
    varianceCents: bigint("variance_cents", { mode: "number" }).notNull().default(0),
    summary: jsonb("summary").notNull().default({}),
    frozenAt: timestamp("frozen_at", { withTimezone: true }),
    frozenById: uuid("frozen_by_id"),
    frozenByName: text("frozen_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("day_closes_tenant_location_date_idx").on(t.tenantId, t.locationId, t.businessDate),
    uniqueIndex("day_closes_tenant_location_date_uidx").on(t.tenantId, t.locationId, t.businessDate),
  ]
);

export const statements = pgTable(
  "statements",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    accountId: uuid("account_id").notNull(),
    patientId: uuid("patient_id"),
    asOf: date("as_of").notNull(),
    status: text("status").notNull().default("draft"),
    patientDueCents: bigint("patient_due_cents", { mode: "number" }).notNull().default(0),
    insurancePendingCents: bigint("insurance_pending_cents", { mode: "number" }).notNull().default(0),
    creditCents: bigint("credit_cents", { mode: "number" }).notNull().default(0),
    holdReason: text("hold_reason"),
    snapshot: jsonb("snapshot").notNull().default({}),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    issuedById: uuid("issued_by_id"),
    issuedByName: text("issued_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("statements_tenant_account_as_of_idx").on(t.tenantId, t.accountId, t.asOf)]
);

export const digestAcks = pgTable(
  "digest_acks",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    /** sha256 of the canonical digest the acknowledger read. */
    summaryHash: text("summary_hash").notNull(),
    eventCount: integer("event_count").notNull(),
    acknowledgedById: uuid("acknowledged_by_id").notNull(),
    acknowledgedByName: text("acknowledged_by_name").notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("digest_acks_tenant_period_uidx").on(t.tenantId, t.periodEnd)]
);

/** The owner's acknowledgment of one hard event (Increment 1.33); append-only, one per event. */
export const hardEventAcks = pgTable(
  "hard_event_acks",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    kind: text("kind").notNull(),
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    eventAt: timestamp("event_at", { withTimezone: true }).notNull(),
    /** What was done about it; at least ten characters. */
    note: text("note").notNull(),
    acknowledgedById: uuid("acknowledged_by_id").notNull(),
    acknowledgedByName: text("acknowledged_by_name").notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("hard_event_acks_event_uidx").on(t.tenantId, t.kind, t.subjectKind, t.subjectId)]
);

/**
 * The tenant's chart-of-accounts mapping under maker-checker (Increment 1.35):
 * one row per proposal, decided by someone other than the proposer.
 */
export const glMappings = pgTable(
  "gl_mappings",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    glBucket: text("gl_bucket").notNull(),
    kind: text("kind").notNull(),
    /** The reason code, or "*" for every reason code on that bucket and kind. */
    reasonCode: text("reason_code").notNull().default("*"),
    accountCode: text("account_code").notNull(),
    accountName: text("account_name").notNull(),
    side: text("side").notNull(),
    note: text("note").notNull().default(""),
    status: text("status").notNull().default("proposed"),
    proposedById: uuid("proposed_by_id").notNull(),
    proposedByName: text("proposed_by_name").notNull(),
    proposedAt: timestamp("proposed_at", { withTimezone: true }).notNull(),
    decidedById: uuid("decided_by_id"),
    decidedByName: text("decided_by_name"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    supersedesId: uuid("supersedes_id"),
  },
  (t) => [index("gl_mappings_tenant_key_idx").on(t.tenantId, t.glBucket, t.kind, t.reasonCode)]
);

/**
 * A frozen month (Increment 1.36): what the practice told its accountant,
 * with the package hash at the moment of closing. One per month; append-only.
 */
export const monthCloses = pgTable(
  "month_closes",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    month: text("month").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    packageHash: text("package_hash").notNull(),
    /** The package shape the hash was computed under (Increment 1.43); hashes compare only within one. */
    packageSchema: text("package_schema").notNull(),
    entryCount: integer("entry_count").notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    closedById: uuid("closed_by_id").notNull(),
    closedByName: text("closed_by_name").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("month_closes_tenant_month_uidx").on(t.tenantId, t.month)]
);

/**
 * One baseline per practice, month and package shape (Increment 1.56): under
 * this shape, as of this moment, this closed month hashed to this.
 *
 * It never replaces the close's own frozen hash, which records what the
 * accountant received and which `month_closes` refuses to change. It gives
 * "has a figure moved since?" something to compare against again for a month
 * closed under an older shape, and names the date that claim runs from.
 */
export const monthCloseRehashes = pgTable(
  "month_close_rehashes",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    month: text("month").notNull(),
    /** The shape this baseline was computed under; never the close's own. */
    packageSchema: text("package_schema").notNull(),
    packageHash: text("package_hash").notNull(),
    entryCount: integer("entry_count").notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    computedById: uuid("computed_by_id").notNull(),
    computedByName: text("computed_by_name").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("month_close_rehashes_month_schema_uidx").on(t.tenantId, t.month, t.packageSchema)]
);

/**
 * Where one person's notices would go (Increment 1.58). Append-only, newest
 * row in force: after a message goes out, "what address was on file that day"
 * is the question an audit asks, and an update would destroy the answer. A
 * null address is a withdrawal, recorded rather than deleted. The database
 * refuses a row whose acting user is not the user it names, so nobody
 * redirects anybody else's notices.
 */
export const noticeAddresses = pgTable(
  "notice_addresses",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    /** Null means "nowhere, and that was a decision". */
    address: text("address"),
    setAt: timestamp("set_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("notice_addresses_user_idx").on(t.tenantId, t.userId, t.setAt)]
);

/**
 * One attempt to send a person their notices (Increment 1.59). Append-only: an
 * attempt is never rewritten, and a later attempt is another row. A failure is
 * a row like any other, because a send that failed silently is worse than one
 * that never happened — the reader would believe they had been told. Nothing
 * owed writes no row at all, since that is not an act.
 */
export const noticeSends = pgTable(
  "notice_sends",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    seat: text("seat").notNull(),
    recipientId: uuid("recipient_id").notNull(),
    recipientName: text("recipient_name").notNull(),
    /** Where it went, as of this attempt. Null exactly when the outcome is unreachable. */
    address: text("address"),
    /** 'sent' | 'failed' | 'unreachable'. */
    outcome: text("outcome").notNull(),
    /** The transport's own words on a failure, or why there was nowhere to send. */
    detail: text("detail"),
    /**
     * 'transient' | 'permanent' on a failure (Increment 1.60). Null on any
     * other outcome, and on a failure recorded before the distinction existed.
     */
    failureKind: text("failure_kind"),
    /** 'notices' | 'proof_code' | 'digest' (Increment 1.64): what this message was, said rather than inferred. */
    kind: text("kind").notNull(),
    subject: text("subject"),
    body: text("body"),
    noticeCount: integer("notice_count").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("notice_sends_recipient_idx").on(t.tenantId, t.recipientId, t.attemptedAt)]
);

/**
 * One run of the scheduled sender (Increment 1.62), including the quiet ones.
 *
 * Written even when the round had nothing to do, which is the opposite of this
 * codebase's usual rule, and deliberately: a round that wrote nothing when
 * nothing happened would make a scheduler that died look exactly like a
 * practice that owes nothing, and telling those apart is the whole job.
 */
export const noticeRounds = pgTable(
  "notice_rounds",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull(),
    considered: integer("considered").notNull(),
    sent: integer("sent").notNull(),
    failed: integer("failed").notNull(),
    unchanged: integer("unchanged").notNull(),
    nothingOwed: integer("nothing_owed").notNull(),
    unreachable: integer("unreachable").notNull(),
    /** A second axis over the same people (Increment 1.64), counted beside the sum rather than folded into it. */
    digestsSent: integer("digests_sent").notNull(),
    digestsFailed: integer("digests_failed").notNull(),
    /** A third axis (Increment 1.66): the month-end package told to the accountant. */
    packagesSent: integer("packages_sent").notNull(),
    packagesFailed: integer("packages_failed").notNull(),
  },
  (t) => [index("notice_rounds_latest_idx").on(t.tenantId, t.ranAt)]
);

/**
 * One code sent to an address so the person can prove it reaches them
 * (Increment 1.61). The code itself lives only in the message; this row keeps
 * its SHA-256 so the database can recognise the right one and not produce one.
 */
export const noticeAddressChallenges = pgTable(
  "notice_address_challenges",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    /** The exact address row the code went to, so a later address is not proved by an earlier code. */
    addressId: uuid("address_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /**
     * SHA-256 of the stop secret this message carried (Increment 1.67). A
     * second token with the opposite power: the code proves an address, this
     * one can only stop it. Null on a challenge issued before the link
     * existed, which is a fact about that message rather than an exemption.
     */
    stopHash: text("stop_hash"),
  },
  (t) => [index("notice_address_challenges_lookup_idx").on(t.tenantId, t.userId, t.tokenHash)]
);

/**
 * That somebody reading a mailbox said they did not ask for this practice's
 * messages (Increment 1.67).
 *
 * The one row here written by nobody: the person who refuses has no account
 * and never will, and what authorises the row is the secret the message
 * carried rather than a session. It names the mailbox and not a user, because
 * the person who refused is not the person who typed the address in.
 *
 * Keyed by the address text rather than by the address row, so changing one
 * character and saving again does not hand the practice a fresh start.
 */
export const noticeAddressRefusals = pgTable("notice_address_refusals", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  /** The message that provoked this, so "how do we know they were asked" has an answer. */
  challengeId: uuid("challenge_id").notNull(),
  address: text("address").notNull(),
  refusedAt: timestamp("refused_at", { withTimezone: true }).notNull(),
});

/**
 * That one address row was proved to reach the person it names (Increment
 * 1.61). One row per address, forever: changing an address writes a new
 * address row, which no proof points at, so a changed address is unproved by
 * the shape rather than by anything remembering to clear a flag.
 */
export const noticeAddressProofs = pgTable("notice_address_proofs", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  addressId: uuid("address_id").notNull(),
  /** Which code proved it, so "how do we know" has an answer rather than a date. */
  challengeId: uuid("challenge_id").notNull(),
  provedAt: timestamp("proved_at", { withTimezone: true }).notNull(),
});

/**
 * One append-only message in a thread the accountant and the practice hold
 * about one month-end package line (Increment 1.50). The message that opened a
 * thread carries its own id in `threadId`; a reply carries the opener's, and
 * the database refuses a reply whose thread does not open in this practice or
 * whose month and subject differ from it.
 */
export const cpaThreadMessages = pgTable(
  "cpa_thread_messages",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    /** The opening message's id; the opener carries its own. */
    threadId: uuid("thread_id").notNull(),
    month: text("month").notNull(),
    /** The package line it hangs on: the section and key `packageRows` gives every row. */
    subjectKey: text("subject_key").notNull(),
    /** What was asked or answered; at least ten characters. */
    body: text("body").notNull(),
    /** Which side spoke: 'accountant' or 'practice'. A seat, not a rank. */
    authorSeat: text("author_seat").notNull(),
    authorId: uuid("author_id").notNull(),
    authorName: text("author_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("cpa_thread_messages_thread_idx").on(t.tenantId, t.threadId, t.createdAt)]
);

/**
 * One dated assertion that somebody reviewed one external channel's month
 * (Increment 1.51). One row per practice, month and channel; append-only, so a
 * later opinion is a later month's row rather than an edit of this one.
 */
export const channelAttestations = pgTable(
  "channel_attestations",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    month: text("month").notNull(),
    channel: text("channel").notNull(),
    /** What was reviewed and against what; at least ten characters. */
    note: text("note").notNull(),
    /** Whether the outside accountant or the practice itself reviewed it. */
    attestedSeat: text("attested_seat").notNull(),
    attestedById: uuid("attested_by_id").notNull(),
    attestedByName: text("attested_by_name").notNull(),
    attestedAt: timestamp("attested_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("channel_attestations_month_channel_uidx").on(t.tenantId, t.month, t.channel)]
);

/**
 * One append-only record that a seat read a thread up to a given message
 * (Increment 1.55). Deliberately not unique: a thread is read again whenever it
 * grows, so a seat has many rows over a thread's life and the latest one wins.
 * A later message therefore re-opens the signal without any row being rewritten.
 */
export const cpaThreadReads = pgTable("cpa_thread_reads", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  threadId: uuid("thread_id").notNull(),
  /** Which side read it; not a rank. */
  seat: text("seat").notNull(),
  /** The last message the reader had in front of them. */
  upToMessageId: uuid("up_to_message_id").notNull(),
  readerId: uuid("reader_id").notNull(),
  readerName: text("reader_name").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull(),
});

/**
 * The practice's invitations to a seat, and the claims that spent them
 * (Increment 1.71; newest-row-in-force since 1.73).
 *
 * Two tables rather than one with a `claimed_at`, for the reason a proof is a
 * table and not a column on a challenge: a status column would be an UPDATE on
 * an otherwise append-only row, and a fact that could be rewritten.
 */
export const seatInvitations = pgTable(
  "seat_invitations",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    /** The seat this invitation was created alongside. */
    userId: uuid("user_id").notNull(),
    /** sha256 of the secret the link carries; the secret itself is never stored. */
    tokenHash: text("token_hash").notNull(),
    invitedBy: uuid("invited_by").notNull(),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("seat_invitations_newest_idx").on(t.tenantId, t.userId, t.invitedAt)]
);

export const seatInvitationClaims = pgTable("seat_invitation_claims", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  invitationId: uuid("invitation_id").notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull(),
});

export const TENANT_SCOPED_TABLES = [
  "locations",
  "reason_codes",
  "users",
  "sessions",
  "user_entitlements",
  "domain_event",
  "phi_access_log",
  "integration_registry",
  "audit_chain_checks",
  "disclosures",
  "recovery_ceremonies",
  "patients",
  "guarantor_accounts",
  "ledger_entries",
  "payment_allocations",
  "control_policies",
  "approval_requests",
  "approvals_log",
  "sod_findings",
  "control_decisions",
  "control_snapshots",
  "import_runs",
  "import_staged_rows",
  "bank_accounts",
  "bank_statement_imports",
  "bank_transactions",
  "reconciliation_runs",
  "reconciliation_variances",
  "deposits",
  "day_closes",
  "statements",
  "control_findings",
  "digest_acks",
  "hard_event_acks",
  "gl_mappings",
  "month_closes",
  "cpa_thread_messages",
  "channel_attestations",
  "cpa_thread_reads",
  "month_close_rehashes",
  "notice_addresses",
  "notice_address_challenges",
  "notice_address_proofs",
  "notice_address_refusals",
  "notice_rounds",
  "notice_sends",
  "seat_invitations",
  "seat_invitation_claims",
] as const;
