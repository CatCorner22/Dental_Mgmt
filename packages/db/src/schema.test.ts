import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { baaIsLive, canEnableIntegration, refuseEnabledWithoutBaa } from "./baa";
import { encryptSecret, decryptSecret } from "./crypto";
import { GENESIS_HASH, hashDomainEvent } from "./chain";
import { uuidv7 } from "./ids";
import { DB_ROLES, PROCESS_ROLES } from "./roles";
import { SET_LOCAL_TENANT_SQL } from "./tenant-context";
import { TENANT_SCOPED_TABLES } from "./schema";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "../migrations/0001_init.sql"), "utf8");
const authSql = readFileSync(join(here, "../migrations/0002_auth_lookup.sql"), "utf8");
const auditSql = readFileSync(join(here, "../migrations/0006_audit_chain_checks.sql"), "utf8");
const complianceSql = readFileSync(join(here, "../migrations/0007_disclosures_recovery.sql"), "utf8");
const anchorSql = readFileSync(join(here, "../migrations/0008_chain_head_anchor.sql"), "utf8");
const patientsSql = readFileSync(join(here, "../migrations/0009_patients_accounts.sql"), "utf8");
const ledgerSql = readFileSync(join(here, "../migrations/0010_ledger_core.sql"), "utf8");
const ledgerViewsSql = readFileSync(join(here, "../migrations/0011_ledger_views.sql"), "utf8");
const controlsSql = readFileSync(join(here, "../migrations/0012_controls.sql"), "utf8");
const controlsRiskSql = readFileSync(join(here, "../migrations/0013_controls_risk.sql"), "utf8");
const enforcementSql = readFileSync(join(here, "../migrations/0014_controls_enforcement.sql"), "utf8");
const importSql = readFileSync(join(here, "../migrations/0015_import_staging.sql"), "utf8");
const bankSql = readFileSync(join(here, "../migrations/0016_bank_reconciliation.sql"), "utf8");
const dayCloseSql = readFileSync(join(here, "../migrations/0017_day_close_deposits.sql"), "utf8");
const statementsSql = readFileSync(join(here, "../migrations/0018_statements.sql"), "utf8");
const controlFindingsSql = readFileSync(join(here, "../migrations/0019_control_findings.sql"), "utf8");
const ledgerFindingsSql = readFileSync(join(here, "../migrations/0020_control_findings_ledger.sql"), "utf8");
const coverageFindingsSql = readFileSync(join(here, "../migrations/0021_control_findings_coverage.sql"), "utf8");
const decisionSubjectsSql = readFileSync(join(here, "../migrations/0022_control_decisions_detector_finding.sql"), "utf8");
const decisionRetireSql = readFileSync(join(here, "../migrations/0023_control_decisions_retire.sql"), "utf8");
const digestAcksSql = readFileSync(join(here, "../migrations/0024_digest_acks.sql"), "utf8");
const locationHoursSql = readFileSync(join(here, "../migrations/0025_locations_hours.sql"), "utf8");
const afterHoursHoldSql = readFileSync(join(here, "../migrations/0026_after_hours_hold.sql"), "utf8");
const hardEventAcksSql = readFileSync(join(here, "../migrations/0027_hard_event_acks.sql"), "utf8");
const glMappingsSql = readFileSync(join(here, "../migrations/0028_gl_mappings.sql"), "utf8");
const monthClosesSql = readFileSync(join(here, "../migrations/0029_month_closes.sql"), "utf8");
const correctionPairsSql = readFileSync(join(here, "../migrations/0030_correction_pairs.sql"), "utf8");
const correctionHoldsSql = readFileSync(join(here, "../migrations/0031_correction_holds.sql"), "utf8");
const latePostingsSql = readFileSync(join(here, "../migrations/0032_late_postings.sql"), "utf8");
const sealedDayFindingSql = readFileSync(join(here, "../migrations/0033_finding_sealed_day_posting.sql"), "utf8");
const packageSchemaSql = readFileSync(join(here, "../migrations/0034_package_schema_version.sql"), "utf8");
const reasonThresholdSql = readFileSync(join(here, "../migrations/0035_reason_thresholds.sql"), "utf8");
const reasonDecisionSql = readFileSync(join(here, "../migrations/0036_decision_on_reason_code.sql"), "utf8");
const cpaQuestionsSql = readFileSync(join(here, "../migrations/0037_cpa_questions.sql"), "utf8");
const attestationsSql = readFileSync(join(here, "../migrations/0038_channel_attestations.sql"), "utf8");
const threadReadsSql = readFileSync(join(here, "../migrations/0039_cpa_thread_reads.sql"), "utf8");
const rehashSql = readFileSync(join(here, "../migrations/0040_month_close_rehashes.sql"), "utf8");
const addressesSql = readFileSync(join(here, "../migrations/0041_notice_addresses.sql"), "utf8");
const sendsSql = readFileSync(join(here, "../migrations/0042_notice_sends.sql"), "utf8");
const failureKindSql = readFileSync(join(here, "../migrations/0043_notice_send_failure_kind.sql"), "utf8");
const proofsSql = readFileSync(join(here, "../migrations/0044_notice_address_proofs.sql"), "utf8");
const roundsSql = readFileSync(join(here, "../migrations/0045_notice_rounds.sql"), "utf8");
const kindSql = readFileSync(join(here, "../migrations/0046_notice_send_kind.sql"), "utf8");
const perCodeSql = readFileSync(join(here, "../migrations/0047_proof_is_per_code.sql"), "utf8");
const roundCodeSql = readFileSync(join(here, "../migrations/0048_round_may_send_a_code.sql"), "utf8");
const packageKindSql = readFileSync(join(here, "../migrations/0049_notice_package_kind.sql"), "utf8");
const increment01TenantTables = [
  "locations",
  "users",
  "sessions",
  "user_entitlements",
  "domain_event",
  "phi_access_log",
  "integration_registry",
  "auth_throttle",
] as const;

describe("Increment 0.1 schema", () => {
  it("names the three process roles", () => {
    expect(PROCESS_ROLES).toEqual(["app_rw", "app_append", "app_migrate"]);
    for (const role of PROCESS_ROLES) expect(Object.keys(DB_ROLES)).toContain(role);
    expect(sql).toMatch(/app_rw/);
    expect(sql).toMatch(/app_append/);
    expect(sql).toMatch(/app_migrate/);
  });

  it("creates every Increment 0.1 table", () => {
    for (const name of [
      "tenants",
      "locations",
      "users",
      "sessions",
      "user_entitlements",
      "domain_event",
      "phi_access_log",
      "integration_registry",
      "auth_throttle",
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${name}\\b`));
    }
  });

  it("does not create clinical encounter tables in Increment 0.1", () => {
    expect(sql).not.toMatch(/CREATE TABLE encounters\b/);
    expect(sql).not.toMatch(/CREATE TABLE notes\b/);
  });

  it("enables and forces RLS on every tenant-scoped table from Increment 0.1", () => {
    for (const name of ["tenants", ...increment01TenantTables]) {
      expect(sql, name).toMatch(new RegExp(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`));
      expect(sql, name).toMatch(new RegExp(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`));
    }
  });
});

describe("Increment 0.5 audit chain checks", () => {
  it("creates an append-only daily check table with RLS", () => {
    expect(auditSql).toMatch(/CREATE TABLE audit_chain_checks/);
    expect(auditSql).toMatch(/ALTER TABLE audit_chain_checks ENABLE ROW LEVEL SECURITY/);
    expect(auditSql).toMatch(/audit_chain_checks_immutable/);
    expect(auditSql).toMatch(/GRANT INSERT ON audit_chain_checks TO app_append/);
  });
});

describe("Increment 0.6 disclosures and recovery", () => {
  it("creates append-only disclosures and a two-admin recovery table", () => {
    expect(complianceSql).toMatch(/CREATE TABLE disclosures/);
    expect(complianceSql).toMatch(/CREATE TABLE recovery_ceremonies/);
    expect(complianceSql).toMatch(/recovery_ceremonies_distinct_admins/);
    expect(complianceSql).toMatch(/auth_lookup_recovery_ceremony/);
    expect(complianceSql).toMatch(/GRANT INSERT ON disclosures TO app_append/);
  });
});

describe("Increment 1.1 ledger kernel", () => {
  it("creates patient headers and append-only ledger tables", () => {
    expect(patientsSql).toMatch(/CREATE TABLE patients\b/);
    expect(patientsSql).toMatch(/CREATE TABLE guarantor_accounts\b/);
    expect(ledgerSql).toMatch(/CREATE TABLE ledger_entries\b/);
    expect(ledgerSql).toMatch(/CREATE TABLE payment_allocations\b/);
    expect(ledgerSql).toMatch(/ledger_entries_immutable/);
    expect(ledgerSql).toMatch(/payment_allocations_within_bounds/);
    expect(ledgerSql).toMatch(/GRANT INSERT ON ledger_entries, payment_allocations TO app_append/);
    expect(ledgerSql).toMatch(/GRANT SELECT ON ledger_entries, payment_allocations TO app_append/);
    expect(ledgerViewsSql).toMatch(/CREATE OR REPLACE VIEW account_balances/);
    expect(ledgerViewsSql).toMatch(/CREATE OR REPLACE VIEW ledger_explanations/);
  });
});

describe("Increment 1.2 controls inbox", () => {
  it("creates policy and approval tables with immutability grants", () => {
    expect(controlsSql).toMatch(/CREATE TABLE control_policies\b/);
    expect(controlsSql).toMatch(/CREATE TABLE approval_requests\b/);
    expect(controlsSql).toMatch(/CREATE TABLE approvals_log\b/);
    expect(controlsSql).toMatch(/approval_requester_ne_second/);
    expect(controlsSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON approval_requests TO app_rw/);
  });
});

describe("Increment 1.12 Precog on live rows", () => {
  it("creates findings, an append-only decision register, and append-only snapshots", () => {
    expect(controlsRiskSql).toMatch(/CREATE TABLE sod_findings\b/);
    expect(controlsRiskSql).toMatch(/CREATE TABLE control_decisions\b/);
    expect(controlsRiskSql).toMatch(/CREATE TABLE control_snapshots\b/);
    expect(controlsRiskSql).toMatch(/UNIQUE \(tenant_id, rule_id, person_id\)/);
    expect(controlsRiskSql).toMatch(/control_decisions_immutable/);
    expect(controlsRiskSql).toMatch(/control_snapshots_immutable/);
    expect(controlsRiskSql).toMatch(/sod_findings_no_delete/);
    expect(controlsRiskSql).toMatch(/length\(btrim\(note\)\) >= 10/);
    expect(controlsRiskSql).toMatch(/ADD COLUMN decision_id uuid REFERENCES control_decisions\(id\)/);
    expect(controlsRiskSql).toMatch(
      /CREATE UNIQUE INDEX user_entitlements_live_uidx\s+ON user_entitlements \(tenant_id, user_id, entitlement\)\s+WHERE effective_to IS NULL/
    );
  });

  it("forces RLS and grants only what the runtime role needs", () => {
    for (const name of ["sod_findings", "control_decisions", "control_snapshots"]) {
      expect(controlsRiskSql, name).toMatch(new RegExp(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`));
      expect(controlsRiskSql, name).toMatch(new RegExp(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`));
      expect(controlsRiskSql, name).toMatch(new RegExp(`CREATE POLICY ${name}_isolation ON ${name}`));
    }
    expect(controlsRiskSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON sod_findings TO app_rw/);
    expect(controlsRiskSql).toMatch(/GRANT SELECT, INSERT ON control_decisions TO app_rw/);
    expect(controlsRiskSql).toMatch(/GRANT SELECT, INSERT ON control_snapshots TO app_rw/);
    expect(controlsRiskSql).not.toMatch(/GRANT[^\n]*(UPDATE|DELETE)[^\n]*control_decisions/);
    expect(controlsRiskSql).not.toMatch(/GRANT[^\n]*(UPDATE|DELETE)[^\n]*control_snapshots/);
  });
});

describe("Increment 1.22 detector findings", () => {
  it("creates control_findings as open-or-closed rows that are never deleted", () => {
    expect(controlFindingsSql).toMatch(/CREATE TABLE control_findings\b/);
    expect(controlFindingsSql).toMatch(/kind IN \('unmatched_bank_line_48h', 'degraded_owner_clearance', 'decision_unreviewed'\)/);
    expect(controlFindingsSql).toMatch(/UNIQUE \(tenant_id, kind, subject_kind, subject_id\)/);
    expect(controlFindingsSql).toMatch(/control_findings_closed_has_time/);
    expect(controlFindingsSql).toMatch(/control_findings_closed_has_reason/);
    expect(controlFindingsSql).toMatch(/control_findings_no_delete/);
    expect(controlFindingsSql).toMatch(/ALTER TABLE control_findings ENABLE ROW LEVEL SECURITY/);
    expect(controlFindingsSql).toMatch(/ALTER TABLE control_findings FORCE ROW LEVEL SECURITY/);
    expect(controlFindingsSql).toMatch(/CREATE POLICY control_findings_isolation ON control_findings/);
    expect(controlFindingsSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON control_findings TO app_rw/);
    expect(controlFindingsSql).not.toMatch(/GRANT[^\n]*DELETE[^\n]*control_findings/);
    expect(TENANT_SCOPED_TABLES).toContain("control_findings");
  });

  it("widens the finding kinds to the ledger detectors and adds the ledger entry as a subject", () => {
    expect(ledgerFindingsSql).toMatch(/DROP CONSTRAINT control_findings_kind_check/);
    expect(ledgerFindingsSql).toMatch(/'release_without_approval', 'backdated_posting', 'duplicate_patient_payment'/);
    expect(ledgerFindingsSql).toMatch(/DROP CONSTRAINT control_findings_subject_kind_check/);
    expect(ledgerFindingsSql).toMatch(/'control_decision', 'ledger_entry'\)/);
    expect(ledgerFindingsSql).not.toMatch(/GRANT|DROP TABLE|DELETE/);
  });

  it("adds the coverage detectors' kinds and the deposit and entitlement subjects", () => {
    expect(coverageFindingsSql).toMatch(/'deposit_not_banked', 'sole_holder_critical_duty'/);
    expect(coverageFindingsSql).toMatch(/'ledger_entry', 'deposit', 'entitlement'\)/);
    expect(coverageFindingsSql).not.toMatch(/GRANT|DROP TABLE|DELETE/);
  });

  it("lets a control decision name a detector finding as its subject", () => {
    expect(decisionSubjectsSql).toMatch(/DROP CONSTRAINT control_decisions_subject_kind_check/);
    expect(decisionSubjectsSql).toMatch(/'scenario', 'knowledge', 'detector_finding'\)/);
    expect(decisionSubjectsSql).not.toMatch(/GRANT|DROP TABLE|DELETE|UPDATE/);
  });

  it("lets a decision be retired by a superseding row of kind retire", () => {
    expect(decisionRetireSql).toMatch(/DROP CONSTRAINT control_decisions_kind_check/);
    expect(decisionRetireSql).toMatch(/'monitor', 'insure', 'retire'\)/);
    expect(decisionRetireSql).not.toMatch(/GRANT|DROP TABLE|DELETE|UPDATE/);
  });
});

describe("Increment 1.28 weekly digest acknowledgments", () => {
  it("stores one append-only, tenant-isolated acknowledgment per period, binding the summary hash", () => {
    expect(digestAcksSql).toMatch(/CREATE TABLE digest_acks\b/);
    expect(digestAcksSql).toMatch(/summary_hash text NOT NULL CHECK \(length\(summary_hash\) = 64\)/);
    expect(digestAcksSql).toMatch(/UNIQUE \(tenant_id, period_end\)/);
    expect(digestAcksSql).toMatch(/digest_acks_period_order/);
    expect(digestAcksSql).toMatch(/digest_acks_no_update/);
    expect(digestAcksSql).toMatch(/digest_acks_no_delete/);
    expect(digestAcksSql).toMatch(/ALTER TABLE digest_acks FORCE ROW LEVEL SECURITY/);
    expect(digestAcksSql).toMatch(/CREATE POLICY digest_acks_isolation ON digest_acks/);
    expect(digestAcksSql).toMatch(/GRANT SELECT, INSERT ON digest_acks TO app_rw/);
    expect(digestAcksSql).not.toMatch(/GRANT[^\n]*(UPDATE|DELETE)[^\n]*digest_acks/);
    expect(TENANT_SCOPED_TABLES).toContain("digest_acks");
  });
});

describe("Increment 1.33 hard-event acknowledgments", () => {
  it("stores one append-only, tenant-isolated acknowledgment per hard event, with a note that says something", () => {
    expect(hardEventAcksSql).toMatch(/CREATE TABLE hard_event_acks\b/);
    expect(hardEventAcksSql).toMatch(/kind text NOT NULL CHECK \(kind IN \(/);
    for (const kind of ["after_hours_refund", "retroactive_entry", "waived_dual_control", "deposit_variance", "chain_failure", "new_device_financial_role"]) {
      expect(hardEventAcksSql).toContain(`'${kind}'`);
    }
    expect(hardEventAcksSql).toMatch(/note text NOT NULL CHECK \(length\(btrim\(note\)\) >= 10\)/);
    expect(hardEventAcksSql).toMatch(/UNIQUE \(tenant_id, kind, subject_kind, subject_id\)/);
    expect(hardEventAcksSql).toMatch(/hard_event_acks_no_update/);
    expect(hardEventAcksSql).toMatch(/hard_event_acks_no_delete/);
    expect(hardEventAcksSql).toMatch(/ALTER TABLE hard_event_acks FORCE ROW LEVEL SECURITY/);
    expect(hardEventAcksSql).toMatch(/CREATE POLICY hard_event_acks_isolation ON hard_event_acks/);
    expect(hardEventAcksSql).toMatch(/GRANT SELECT, INSERT ON hard_event_acks TO app_rw/);
    expect(hardEventAcksSql).not.toMatch(/GRANT[^\n]*(UPDATE|DELETE)[^\n]*hard_event_acks/);
    expect(TENANT_SCOPED_TABLES).toContain("hard_event_acks");
  });
});

describe("Increment 1.35 GL mappings under maker-checker", () => {
  it("keys a mapping by bucket, kind, and reason code, and lets only a different person decide it", () => {
    expect(glMappingsSql).toMatch(/CREATE TABLE gl_mappings\b/);
    expect(glMappingsSql).toMatch(/reason_code text NOT NULL DEFAULT '\*'/);
    expect(glMappingsSql).toMatch(/side text NOT NULL CHECK \(side IN \('debit', 'credit'\)\)/);
    expect(glMappingsSql).toMatch(/status text NOT NULL DEFAULT 'proposed' CHECK \(status IN \('proposed', 'approved', 'rejected'\)\)/);
    expect(glMappingsSql).toMatch(/CONSTRAINT gl_mappings_maker_ne_checker CHECK \(decided_by_id IS NULL OR decided_by_id <> proposed_by_id\)/);
    expect(glMappingsSql).toMatch(/CONSTRAINT gl_mappings_decision_complete/);
    expect(glMappingsSql).toMatch(/CREATE UNIQUE INDEX gl_mappings_pending_uidx[\s\S]*WHERE status = 'proposed'/);
    expect(glMappingsSql).toMatch(/gl_mappings_no_delete/);
    expect(glMappingsSql).toMatch(/gl_mappings_decide_only/);
    expect(glMappingsSql).toMatch(/ALTER TABLE gl_mappings FORCE ROW LEVEL SECURITY/);
    expect(glMappingsSql).toMatch(/CREATE POLICY gl_mappings_isolation ON gl_mappings/);
    expect(glMappingsSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON gl_mappings TO app_rw/);
    expect(glMappingsSql).not.toMatch(/GRANT[^\n]*DELETE[^\n]*gl_mappings/);
    expect(TENANT_SCOPED_TABLES).toContain("gl_mappings");
  });
});

describe("Increment 1.36 month close and the prior-period refusal", () => {
  it("freezes one close per month, append-only, and refuses a back-dated entry without reason prior_period", () => {
    expect(monthClosesSql).toMatch(/CREATE TABLE month_closes\b/);
    expect(monthClosesSql).toMatch(/month text NOT NULL CHECK \(month ~ '\^\[0-9\]\{4\}-\(0\[1-9\]\|1\[0-2\]\)\$'\)/);
    expect(monthClosesSql).toMatch(/package_hash text NOT NULL CHECK \(length\(package_hash\) = 64\)/);
    expect(monthClosesSql).toMatch(/UNIQUE \(tenant_id, month\)/);
    expect(monthClosesSql).toMatch(/month_closes_no_update/);
    expect(monthClosesSql).toMatch(/month_closes_no_delete/);
    expect(monthClosesSql).toMatch(/ALTER TABLE month_closes FORCE ROW LEVEL SECURITY/);
    expect(monthClosesSql).toMatch(/CREATE POLICY month_closes_isolation ON month_closes/);
    expect(monthClosesSql).toMatch(/GRANT SELECT, INSERT ON month_closes TO app_rw/);
    expect(monthClosesSql).toMatch(/GRANT SELECT ON month_closes TO app_append/);
    expect(monthClosesSql).not.toMatch(/GRANT[^\n]*(UPDATE|DELETE)[^\n]*month_closes/);
    // The refusal itself: a trigger on the posting path, with the one way through.
    expect(monthClosesSql).toMatch(/CREATE OR REPLACE FUNCTION ledger_entries_month_not_closed/);
    expect(monthClosesSql).toMatch(/NEW\.reason_code IS DISTINCT FROM 'prior_period'/);
    expect(monthClosesSql).toMatch(/RAISE EXCEPTION\s+'month_closed:/);
    expect(monthClosesSql).toMatch(/CREATE TRIGGER ledger_entries_month_not_closed\s+BEFORE INSERT ON ledger_entries/);
    expect(TENANT_SCOPED_TABLES).toContain("month_closes");
  });
});

describe("Increment 1.37 the reversal-and-repost correction pair", () => {
  it("links a correction to the entry it replaces and mirrors the amount", () => {
    expect(correctionPairsSql).toMatch(/ALTER TABLE ledger_entries ADD COLUMN corrects_entry_id uuid REFERENCES ledger_entries\(id\)/);
    // A reversal that corrects an entry reverses that same entry; nothing else may claim to.
    expect(correctionPairsSql).toMatch(/CONSTRAINT ledger_entries_reversal_corrects_its_original/);
    expect(correctionPairsSql).toMatch(/reverses_entry_id = corrects_entry_id/);
    expect(correctionPairsSql).toMatch(/CREATE OR REPLACE FUNCTION ledger_entries_correction_pair/);
    expect(correctionPairsSql).toMatch(/CREATE TRIGGER ledger_entries_correction_pair\s+BEFORE INSERT ON ledger_entries/);
  });

  it("refuses a reversal of a reversal, a second reversal of one entry, an unmirrored amount, and an unbacked repost", () => {
    expect(correctionPairsSql).toMatch(/RAISE EXCEPTION\s+'reversal_original_missing:/);
    expect(correctionPairsSql).toMatch(/RAISE EXCEPTION\s+'reversal_of_reversal:/);
    expect(correctionPairsSql).toMatch(/RAISE EXCEPTION\s+'already_reversed:/);
    expect(correctionPairsSql).toMatch(/RAISE EXCEPTION\s+'reversal_not_mirrored:/);
    expect(correctionPairsSql).toMatch(/NEW\.amount_cents <> -original\.amount_cents/);
    expect(correctionPairsSql).toMatch(/RAISE EXCEPTION\s+'repost_without_reversal:/);
  });

  it("tightens the closed-month refusal from a label to the pair itself", () => {
    expect(correctionPairsSql).toMatch(/CREATE OR REPLACE FUNCTION ledger_entries_month_not_closed/);
    expect(correctionPairsSql).toMatch(/NEW\.reason_code IS DISTINCT FROM 'prior_period' OR NEW\.corrects_entry_id IS NULL/);
    expect(correctionPairsSql).toMatch(/RAISE EXCEPTION\s+'month_closed:/);
    // The trigger itself is not re-created: migration 0029 already attached it to the same function.
    expect(correctionPairsSql).not.toMatch(/CREATE TRIGGER ledger_entries_month_not_closed/);
    expect(correctionPairsSql).not.toMatch(/GRANT|DROP TABLE|DELETE FROM/);
  });
});

describe("Increment 1.38 one approval releases a correction pair", () => {
  it("lets an approval name the entry being corrected", () => {
    expect(correctionHoldsSql).toMatch(/ALTER TABLE approval_requests ADD COLUMN corrects_entry_id uuid REFERENCES ledger_entries\(id\)/);
    expect(correctionHoldsSql).toMatch(/CREATE OR REPLACE FUNCTION ledger_entries_requires_approval/);
    expect(correctionHoldsSql).toMatch(/req\.corrects_entry_id IS NOT NULL/);
    expect(correctionHoldsSql).toMatch(/NEW\.corrects_entry_id IS DISTINCT FROM req\.corrects_entry_id/);
    // Neither half may exceed the figure the second person approved.
    expect(correctionHoldsSql).toMatch(/amount_cents > abs\(req\.amount_cents\)/);
    expect(correctionHoldsSql).toMatch(/RAISE EXCEPTION 'dual_release_required: approval request % approved up to % cents/);
  });

  it("carries the whole trigger forward, after-hours hold included, rather than reverting it", () => {
    // Rebuilding this function from an older migration's text would silently drop the
    // after-hours hold that migration 0026 added to it. These lines are that guarantee.
    expect(correctionHoldsSql).toMatch(/after_hours_hold boolean := false;/);
    expect(correctionHoldsSql).toMatch(/ledger_posted_outside_hours\(NEW\.tenant_id, NEW\.location_id, NEW\.posted_at\)/);
    expect(correctionHoldsSql).toMatch(/IF amount_cents <= threshold_cents AND NOT after_hours_hold THEN/);
    expect(correctionHoldsSql).toMatch(/was posted outside the location''s business hours \(after-hours hold\)/);
    // And the ordinary rules still stand for an ordinary approval.
    expect(correctionHoldsSql).toMatch(/abs\(req\.amount_cents\) <> amount_cents/);
    expect(correctionHoldsSql).toMatch(/req\.resulting_entry_id IS NOT NULL AND req\.resulting_entry_id <> NEW\.id/);
  });

  it("restates one-row-per-approval as one row per kind for a correction", () => {
    expect(correctionHoldsSql).toMatch(/DROP INDEX ledger_entries_approval_request_uidx/);
    expect(correctionHoldsSql).toMatch(/CREATE UNIQUE INDEX ledger_entries_approval_request_uidx\s+ON ledger_entries \(approval_request_id\)\s+WHERE approval_request_id IS NOT NULL AND corrects_entry_id IS NULL/);
    expect(correctionHoldsSql).toMatch(/CREATE UNIQUE INDEX ledger_entries_correction_approval_uidx\s+ON ledger_entries \(approval_request_id, kind\)\s+WHERE approval_request_id IS NOT NULL AND corrects_entry_id IS NOT NULL/);
    expect(correctionHoldsSql).not.toMatch(/GRANT|DROP TABLE|DELETE FROM/);
  });
});

describe("Increment 1.51 attesting a channel the product cannot enforce", () => {
  it("holds one dated assertion per practice, month and channel", () => {
    expect(attestationsSql).toMatch(/CREATE TABLE channel_attestations/);
    expect(attestationsSql).toMatch(/month text NOT NULL CHECK \(month ~ '\^\[0-9\]\{4\}-\[0-9\]\{2\}\$'\)/);
    expect(attestationsSql).toMatch(/note text NOT NULL CHECK \(length\(btrim\(note\)\) >= 10\)/);
    // Whether an independent reader or the practice itself said it.
    expect(attestationsSql).toMatch(/attested_seat text NOT NULL CHECK \(attested_seat IN \('accountant', 'practice'\)\)/);
    // Named, so the constraint the schema declares and the one the database holds agree.
    expect(attestationsSql).toMatch(
      /CREATE UNIQUE INDEX channel_attestations_month_channel_uidx[\s\S]*\(tenant_id, month, channel\)/
    );
  });

  it("is append-only, tenant-isolated under FORCE RLS, and never granted an update or a delete", () => {
    expect(attestationsSql).toMatch(/channel_attestations is append-only/);
    expect(attestationsSql).toMatch(/TRIGGER channel_attestations_no_update[\s\S]*BEFORE UPDATE/);
    expect(attestationsSql).toMatch(/TRIGGER channel_attestations_no_delete[\s\S]*BEFORE DELETE/);
    expect(attestationsSql).toMatch(/ALTER TABLE channel_attestations FORCE ROW LEVEL SECURITY/);
    expect(attestationsSql).toMatch(/CREATE POLICY channel_attestations_isolation/);
    expect(attestationsSql).toMatch(/GRANT SELECT, INSERT ON channel_attestations TO app_rw;/);
    expect(attestationsSql).not.toMatch(/GRANT[^;]*UPDATE[^;]*ON channel_attestations/);
    expect(attestationsSql).not.toMatch(/GRANT[^;]*DELETE[^;]*ON channel_attestations/);
  });
});

describe("Increment 1.59 sending, and failing to send", () => {
  it("records one row per attempt, append-only", () => {
    expect(sendsSql).toMatch(/CREATE TABLE notice_sends/);
    expect(sendsSql).toMatch(/notice_sends is append-only/);
    expect(sendsSql).toMatch(/TRIGGER notice_sends_no_update[\s\S]*BEFORE UPDATE/);
    expect(sendsSql).toMatch(/TRIGGER notice_sends_no_delete[\s\S]*BEFORE DELETE/);
  });

  it("admits three outcomes and no fourth", () => {
    // A send that "maybe" went is the silence this table exists to prevent.
    expect(sendsSql).toMatch(/outcome text NOT NULL CHECK \(outcome IN \('sent', 'failed', 'unreachable'\)\)/);
  });

  it("refuses a failure that does not say what failed", () => {
    expect(sendsSql).toMatch(/notice_sends_failure_says_why CHECK \(outcome <> 'failed' OR detail IS NOT NULL\)/);
    // And an unreachable row has no address and says why in words.
    expect(sendsSql).toMatch(/notice_sends_unreachable_has_no_address/);
  });

  it("refuses a send that claims to have gone nowhere, or to have said nothing", () => {
    expect(sendsSql).toMatch(/notice_sends_sent_is_complete/);
    expect(sendsSql).toMatch(/address IS NOT NULL AND subject IS NOT NULL AND body IS NOT NULL AND detail IS NULL/);
  });

  it("is tenant-isolated under FORCE RLS and never granted an update or a delete", () => {
    expect(sendsSql).toMatch(/TRIGGER notice_sends_match_their_tenant[\s\S]*BEFORE INSERT/);
    expect(sendsSql).toMatch(/ALTER TABLE notice_sends FORCE ROW LEVEL SECURITY/);
    expect(sendsSql).toMatch(/CREATE POLICY notice_sends_isolation/);
    expect(sendsSql).toMatch(/GRANT SELECT, INSERT ON notice_sends TO app_rw;/);
    expect(sendsSql).not.toMatch(/GRANT[^;]*UPDATE[^;]*ON notice_sends/);
    expect(sendsSql).not.toMatch(/GRANT[^;]*DELETE[^;]*ON notice_sends/);
  });
});

describe("Increment 1.60 a refusal that can pass, and one that cannot", () => {
  it("admits two kinds of refusal and no third", () => {
    expect(failureKindSql).toMatch(/ALTER TABLE notice_sends ADD COLUMN failure_kind text;/);
    expect(failureKindSql).toMatch(
      /notice_sends_failure_kind_is_one_of[\s\S]*failure_kind IN \('transient', 'permanent'\)/
    );
  });

  it("gives a kind only to a refusal, because only a refusal has one to give", () => {
    expect(failureKindSql).toMatch(
      /notice_sends_only_a_failure_has_a_kind[\s\S]*failure_kind IS NULL OR outcome = 'failed'/
    );
  });

  it("binds every later failure to say which kind, and invents nothing about the earlier ones", () => {
    // NOT VALID is the whole point: a failure recorded before this migration
    // does not know its kind, and filling one in would be advice to a reader on
    // evidence nobody ever had.
    expect(failureKindSql).toMatch(
      /notice_sends_failure_says_which_kind[\s\S]*outcome <> 'failed' OR failure_kind IS NOT NULL\) NOT VALID;/
    );
    expect(failureKindSql).not.toMatch(/UPDATE notice_sends/);
    expect(failureKindSql).not.toMatch(/DEFAULT '(transient|permanent)'/);
  });

  it("adds no counter beside the rows", () => {
    // How many times the practice tried is answered by counting attempts. A
    // number stored next to them is a status the rows can contradict.
    expect(failureKindSql).not.toMatch(/attempt_count|retries|retry_count|tries/);
  });
});

describe("Increment 1.66 a fourth kind of message", () => {
  it("admits four kinds and still refuses a fifth", () => {
    expect(packageKindSql).toMatch(/ALTER TABLE notice_sends DROP CONSTRAINT notice_sends_kind_is_one_of;/);
    expect(packageKindSql).toMatch(
      /notice_sends_kind_is_one_of[\s\S]*kind IN \('notices', 'proof_code', 'digest', 'package'\)/
    );
  });

  it("counts the package beside the sum that must add up, as the digest is", () => {
    expect(packageKindSql).toMatch(/ALTER TABLE notice_rounds ADD COLUMN packages_sent integer NOT NULL DEFAULT 0/);
    expect(packageKindSql).toMatch(/ALTER TABLE notice_rounds ALTER COLUMN packages_sent DROP DEFAULT;/);
    expect(packageKindSql).toMatch(/ALTER TABLE notice_rounds ALTER COLUMN packages_failed DROP DEFAULT;/);
    expect(packageKindSql).not.toMatch(/notice_rounds_counts_add_up/);
  });
});

describe("Increment 1.65 single use belongs to the code", () => {
  it("moves the guarantee off the address and onto the code it is true of", () => {
    // One proof per address meant "a code is used once" only while a proof was
    // forever. Once a proof can lapse it means "an address can never be proved
    // twice", which is a different and wrong rule.
    expect(perCodeSql).toMatch(/DROP INDEX notice_address_proofs_one_per_address;/);
    expect(perCodeSql).toMatch(
      /CREATE UNIQUE INDEX notice_address_proofs_one_per_challenge ON notice_address_proofs \(challenge_id\);/
    );
  });

  it("indexes the newest proof per address, which is the only read it has", () => {
    expect(perCodeSql).toMatch(/notice_address_proofs_latest_idx ON notice_address_proofs \(tenant_id, address_id, proved_at DESC\)/);
  });

  it("lets the product ask for a code, and still only a person prove", () => {
    // The round acts for nobody. Borrowing somebody's identity to send them a
    // code would put a lie in the one column the rule is enforced against.
    expect(roundCodeSql).toMatch(/IF actor IS NULL THEN RETURN NEW; END IF;/);
    expect(roundCodeSql).toMatch(/a person asks only for their own address/);
    // Only the challenge trigger is replaced; the proof's stays strict.
    expect(roundCodeSql).toMatch(/DROP TRIGGER notice_address_challenges_are_ones_own ON notice_address_challenges;/);
    expect(roundCodeSql).not.toMatch(/notice_address_proofs_are_ones_own/);
    expect(roundCodeSql).not.toMatch(/notice_address_checks_are_ones_own\(\)\s*RETURNS/);
  });

  it("stores no expiry, because a dated append-only row already says when one lapses", () => {
    expect(perCodeSql).not.toMatch(/expires|lapses|valid_until/);
  });
});

describe("Increment 1.64 what a message was, said rather than inferred", () => {
  it("admits three kinds and no fourth", () => {
    expect(kindSql).toMatch(/notice_sends_kind_is_one_of[\s\S]*kind IN \('notices', 'proof_code', 'digest'\)/);
  });

  it("recovers the kind of every earlier row rather than guessing it", () => {
    // Increment 1.60 grandfathered its column under NOT VALID because the fact
    // was unknowable. Here it is knowable — nothing owed writes no row, so a
    // zero count names the proof code — so it is read back rather than left
    // null, and the two migrations differ because the evidence differs.
    expect(kindSql).toMatch(/UPDATE notice_sends SET kind = CASE WHEN notice_count = 0 THEN 'proof_code' ELSE 'notices' END;/);
    expect(kindSql).toMatch(/ALTER TABLE notice_sends ALTER COLUMN kind SET NOT NULL;/);
    expect(kindSql).not.toMatch(/ADD COLUMN kind text NOT NULL DEFAULT/);
  });

  it("holds the rule the backfill read, so a later writer cannot quietly break it", () => {
    expect(kindSql).toMatch(
      /notice_sends_only_a_code_carries_nothing[\s\S]*CHECK \(\(kind = 'proof_code'\) = \(notice_count = 0\)\)/
    );
  });

  it("counts the digest beside the sum that must add up, never inside it", () => {
    // considered = sent + failed + unchanged + nothing_owed + unreachable says
    // every person became exactly one notices outcome. A digest is a second
    // message to the same person; folding it in would make the invariant say
    // nothing.
    expect(kindSql).toMatch(/ALTER TABLE notice_rounds ADD COLUMN digests_sent integer NOT NULL DEFAULT 0/);
    expect(kindSql).toMatch(/ALTER TABLE notice_rounds ALTER COLUMN digests_sent DROP DEFAULT;/);
    expect(kindSql).toMatch(/ALTER TABLE notice_rounds ALTER COLUMN digests_failed DROP DEFAULT;/);
    expect(kindSql).not.toMatch(/notice_rounds_counts_add_up/);
  });
});

describe("Increment 1.62 the round that runs without anybody pressing anything", () => {
  it("writes a row for every round, including the quiet ones", () => {
    // The one place this codebase writes a row saying nothing happened, and
    // the reason is the whole increment: a scheduler that died must not look
    // like a practice that owes nothing.
    expect(roundsSql).toMatch(/CREATE TABLE notice_rounds/);
    expect(roundsSql).toMatch(/indistinguishable from a practice that owes\s*--\s*nothing/);
  });

  it("refuses counts that do not account for everybody considered", () => {
    expect(roundsSql).toMatch(
      /notice_rounds_counts_add_up[\s\S]*CHECK \(considered = sent \+ failed \+ unchanged \+ nothing_owed \+ unreachable\)/
    );
  });

  it("is append-only, tenant-isolated, and never granted an update or a delete", () => {
    expect(roundsSql).toMatch(/TRIGGER notice_rounds_no_update[\s\S]*BEFORE UPDATE/);
    expect(roundsSql).toMatch(/TRIGGER notice_rounds_no_delete[\s\S]*BEFORE DELETE/);
    expect(roundsSql).toMatch(/ALTER TABLE notice_rounds FORCE ROW LEVEL SECURITY/);
    expect(roundsSql).toMatch(/CREATE POLICY notice_rounds_isolation/);
    expect(roundsSql).toMatch(/GRANT SELECT, INSERT ON notice_rounds TO app_rw;/);
    expect(roundsSql).not.toMatch(/GRANT[^;]*UPDATE[^;]*ON notice_rounds/);
    expect(roundsSql).not.toMatch(/GRANT[^;]*DELETE[^;]*ON notice_rounds/);
  });

  it("asks for no acting user, because a round runs with nobody signed in", () => {
    expect(roundsSql).not.toMatch(/app\.user_id/);
  });
});

describe("Increment 1.61 proving an address reaches its person", () => {
  it("keeps the code as a hash and never in the clear", () => {
    expect(proofsSql).toMatch(/token_hash text NOT NULL CHECK \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
    expect(proofsSql).not.toMatch(/token text|code text/);
  });

  it("ties a proof to one address row and to the code that answered it", () => {
    // The proof points at the address row, not at the person: a changed
    // address is a new row, which no proof names.
    expect(proofsSql).toMatch(
      /notice_address_proofs_address_is_theirs[\s\S]*FOREIGN KEY \(address_id, user_id\) REFERENCES notice_addresses \(id, user_id\)/
    );
    expect(proofsSql).toMatch(
      /notice_address_proofs_answers_its_own_challenge[\s\S]*FOREIGN KEY \(challenge_id, address_id\) REFERENCES notice_address_challenges \(id, address_id\)/
    );
  });

  it("admits one proof per address, which is what makes a code single-use", () => {
    expect(proofsSql).toMatch(/CREATE UNIQUE INDEX notice_address_proofs_one_per_address ON notice_address_proofs \(address_id\)/);
  });

  it("refuses a proof stamped after its code expired, reading the proof's own stamp", () => {
    expect(proofsSql).toMatch(/NEW\.proved_at > window_ends/);
    expect(proofsSql).toMatch(/notice_address_challenges_expires_after_issue CHECK \(expires_at > issued_at\)/);
  });

  it("lets a person act only for themselves, and holds both tables append-only", () => {
    expect(proofsSql).toMatch(/a person proves only their own address/);
    for (const t of ["notice_address_challenges", "notice_address_proofs"]) {
      expect(proofsSql).toMatch(new RegExp(`TRIGGER ${t}_no_update[\\s\\S]*BEFORE UPDATE`));
      expect(proofsSql).toMatch(new RegExp(`TRIGGER ${t}_no_delete[\\s\\S]*BEFORE DELETE`));
      expect(proofsSql).toMatch(new RegExp(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`));
      expect(proofsSql).toMatch(new RegExp(`CREATE POLICY ${t}_isolation`));
      expect(proofsSql).toMatch(new RegExp(`GRANT SELECT, INSERT ON ${t} TO app_rw;`));
      expect(proofsSql).not.toMatch(new RegExp(`GRANT[^;]*UPDATE[^;]*ON ${t}`));
      expect(proofsSql).not.toMatch(new RegExp(`GRANT[^;]*DELETE[^;]*ON ${t}`));
    }
  });
});

describe("Increment 1.58 where a notice would go", () => {
  it("holds an address per person, append-only, with a null address as a recorded withdrawal", () => {
    expect(addressesSql).toMatch(/CREATE TABLE notice_addresses/);
    // Nullable on purpose: withdrawing is an act, recorded rather than a row removed.
    expect(addressesSql).toMatch(/address text CHECK \(address IS NULL OR address ~ /);
    expect(addressesSql).toMatch(/notice_addresses is append-only/);
    expect(addressesSql).toMatch(/TRIGGER notice_addresses_no_update[\s\S]*BEFORE UPDATE/);
    expect(addressesSql).toMatch(/TRIGGER notice_addresses_no_delete[\s\S]*BEFORE DELETE/);
  });

  it("stores no seat, because a seat is derived from rank and grants", () => {
    // A stored seat is a status column that can disagree with the rows under
    // it: a person's rank or grant changes and the copy does not.
    expect(addressesSql).not.toMatch(/seat text/);
  });

  it("refuses an address set by anybody but the person it belongs to", () => {
    // The one act whose whole risk is being done on somebody else's behalf: an
    // administrator who could write another person's address could redirect
    // that person's notices, silently.
    expect(addressesSql).toMatch(/TRIGGER notice_addresses_are_ones_own[\s\S]*BEFORE INSERT/);
    expect(addressesSql).toMatch(/current_setting\('app\.user_id', true\)/);
    expect(addressesSql).toMatch(/a person sets only their own/);
    // And no acting user at all is a refusal rather than a row nobody owns.
    expect(addressesSql).toMatch(/no acting user in this transaction/);
  });

  it("is tenant-isolated under FORCE RLS and never granted an update or a delete", () => {
    expect(addressesSql).toMatch(/TRIGGER notice_addresses_match_their_tenant[\s\S]*BEFORE INSERT/);
    expect(addressesSql).toMatch(/ALTER TABLE notice_addresses FORCE ROW LEVEL SECURITY/);
    expect(addressesSql).toMatch(/CREATE POLICY notice_addresses_isolation/);
    expect(addressesSql).toMatch(/GRANT SELECT, INSERT ON notice_addresses TO app_rw;/);
    expect(addressesSql).not.toMatch(/GRANT[^;]*UPDATE[^;]*ON notice_addresses/);
    expect(addressesSql).not.toMatch(/GRANT[^;]*DELETE[^;]*ON notice_addresses/);
  });
});

describe("Increment 1.56 a baseline for a month closed under an older shape", () => {
  it("adds a baseline rather than rewriting the close, and only for a month that was closed", () => {
    expect(rehashSql).toMatch(/CREATE TABLE month_close_rehashes/);
    // The frozen hash records what the accountant received; month_closes refuses
    // every update, and this migration must not reach for one either.
    expect(rehashSql).not.toMatch(/UPDATE month_closes/);
    expect(rehashSql).not.toMatch(/ALTER TABLE month_closes/);
    expect(rehashSql).toMatch(/FOREIGN KEY \(tenant_id, month\) REFERENCES month_closes \(tenant_id, month\)/);
    expect(rehashSql).toMatch(/package_hash text NOT NULL CHECK \(package_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  });

  it("takes one baseline per shape, and never under the shape the close already froze", () => {
    // The first reading under a shape is the baseline; a second would move the
    // line a later comparison is drawn from and hide a move in between.
    expect(rehashSql).toMatch(
      /CREATE UNIQUE INDEX month_close_rehashes_month_schema_uidx[\s\S]*\(tenant_id, month, package_schema\)/
    );
    expect(rehashSql).toMatch(/TRIGGER month_close_rehashes_is_a_later_shape[\s\S]*BEFORE INSERT/);
    expect(rehashSql).toMatch(/which is already its baseline/);
  });

  it("is append-only, tenant-isolated under FORCE RLS, and never granted an update or a delete", () => {
    expect(rehashSql).toMatch(/month_close_rehashes is append-only/);
    expect(rehashSql).toMatch(/TRIGGER month_close_rehashes_no_update[\s\S]*BEFORE UPDATE/);
    expect(rehashSql).toMatch(/TRIGGER month_close_rehashes_no_delete[\s\S]*BEFORE DELETE/);
    expect(rehashSql).toMatch(/ALTER TABLE month_close_rehashes FORCE ROW LEVEL SECURITY/);
    expect(rehashSql).toMatch(/CREATE POLICY month_close_rehashes_isolation/);
    expect(rehashSql).toMatch(/GRANT SELECT, INSERT ON month_close_rehashes TO app_rw;/);
    expect(rehashSql).not.toMatch(/GRANT[^;]*UPDATE[^;]*ON month_close_rehashes/);
    expect(rehashSql).not.toMatch(/GRANT[^;]*DELETE[^;]*ON month_close_rehashes/);
  });
});

describe("Increment 1.55 the accountant reads the answer", () => {
  it("records one read per act, with the message the reader had in front of them", () => {
    expect(threadReadsSql).toMatch(/CREATE TABLE cpa_thread_reads/);
    expect(threadReadsSql).toMatch(/seat text NOT NULL CHECK \(seat IN \('accountant', 'practice'\)\)/);
    expect(threadReadsSql).toMatch(/up_to_message_id uuid NOT NULL REFERENCES cpa_thread_messages\(id\)/);
    // Deliberately NOT unique per thread and seat: a thread is read again
    // whenever it grows, and the latest row wins. A unique key here would force
    // the row to be rewritten, which is exactly what the append-only rule forbids.
    expect(threadReadsSql).not.toMatch(/UNIQUE[\s\S]*cpa_thread_reads/);
    expect(threadReadsSql).not.toMatch(/CREATE UNIQUE INDEX[^;]*cpa_thread_reads/);
  });

  it("refuses a read that names a message of another thread, so a signal clears only for what was seen", () => {
    expect(threadReadsSql).toMatch(/TRIGGER cpa_thread_reads_match_their_thread[\s\S]*BEFORE INSERT/);
    expect(threadReadsSql).toMatch(/is not this practice/);
    expect(threadReadsSql).toMatch(/belongs to thread/);
  });

  it("is append-only, tenant-isolated under FORCE RLS, and never granted an update or a delete", () => {
    expect(threadReadsSql).toMatch(/cpa_thread_reads is append-only/);
    expect(threadReadsSql).toMatch(/TRIGGER cpa_thread_reads_no_update[\s\S]*BEFORE UPDATE/);
    expect(threadReadsSql).toMatch(/TRIGGER cpa_thread_reads_no_delete[\s\S]*BEFORE DELETE/);
    expect(threadReadsSql).toMatch(/ALTER TABLE cpa_thread_reads FORCE ROW LEVEL SECURITY/);
    expect(threadReadsSql).toMatch(/CREATE POLICY cpa_thread_reads_isolation/);
    expect(threadReadsSql).toMatch(/GRANT SELECT, INSERT ON cpa_thread_reads TO app_rw;/);
    expect(threadReadsSql).not.toMatch(/GRANT[^;]*UPDATE[^;]*ON cpa_thread_reads/);
    expect(threadReadsSql).not.toMatch(/GRANT[^;]*DELETE[^;]*ON cpa_thread_reads/);
  });
});

describe("Increment 1.50 the accountant's question and the practice's answer", () => {
  it("holds a thread in one append-only table, keyed to the package line it is about", () => {
    expect(cpaQuestionsSql).toMatch(/CREATE TABLE cpa_thread_messages/);
    // The opener carries its own id, so a thread is one indexed read.
    expect(cpaQuestionsSql).toMatch(/thread_id uuid NOT NULL/);
    expect(cpaQuestionsSql).toMatch(/CREATE INDEX cpa_thread_messages_thread_idx ON cpa_thread_messages \(tenant_id, thread_id, created_at\)/);
    // A month, a package line, and a body that says something.
    expect(cpaQuestionsSql).toMatch(/month text NOT NULL CHECK \(month ~ '\^\[0-9\]\{4\}-\[0-9\]\{2\}\$'\)/);
    expect(cpaQuestionsSql).toMatch(/subject_key text NOT NULL CHECK \(length\(btrim\(subject_key\)\) > 0\)/);
    expect(cpaQuestionsSql).toMatch(/body text NOT NULL CHECK \(length\(btrim\(body\)\) >= 10\)/);
    // Which side spoke, which is what decides whether an answer is still owed.
    expect(cpaQuestionsSql).toMatch(/author_seat text NOT NULL CHECK \(author_seat IN \('accountant', 'practice'\)\)/);
  });

  it("is append-only, and a reply joins a thread that opens in the same practice", () => {
    expect(cpaQuestionsSql).toMatch(/cpa_thread_messages is append-only/);
    expect(cpaQuestionsSql).toMatch(/TRIGGER cpa_thread_messages_no_update[\s\S]*BEFORE UPDATE/);
    expect(cpaQuestionsSql).toMatch(/TRIGGER cpa_thread_messages_no_delete[\s\S]*BEFORE DELETE/);
    expect(cpaQuestionsSql).toMatch(/TRIGGER cpa_thread_messages_joins_its_thread[\s\S]*BEFORE INSERT/);
    expect(cpaQuestionsSql).toMatch(/does not open in this practice/);
    expect(cpaQuestionsSql).toMatch(/a reply carries its thread''s month and subject/);
  });

  it("is tenant-isolated under FORCE RLS and readable and writable by app_rw alone", () => {
    expect(cpaQuestionsSql).toMatch(/ALTER TABLE cpa_thread_messages ENABLE ROW LEVEL SECURITY/);
    expect(cpaQuestionsSql).toMatch(/ALTER TABLE cpa_thread_messages FORCE ROW LEVEL SECURITY/);
    expect(cpaQuestionsSql).toMatch(/CREATE POLICY cpa_thread_messages_isolation/);
    expect(cpaQuestionsSql).toMatch(/GRANT SELECT, INSERT ON cpa_thread_messages TO app_rw;/);
    // No UPDATE or DELETE is granted to anyone: the triggers are the second lock, not the only one.
    expect(cpaQuestionsSql).not.toMatch(/GRANT[^;]*UPDATE[^;]*ON cpa_thread_messages/);
    expect(cpaQuestionsSql).not.toMatch(/GRANT[^;]*DELETE[^;]*ON cpa_thread_messages/);
  });
});

describe("Increment 1.47 a decision about a reason code", () => {
  it("widens the decision subjects by one and carries every one already in use forward", () => {
    expect(reasonDecisionSql).toMatch(/'reason_code'/);
    for (const subject of [
      "sod_finding",
      "grant",
      "control",
      "exception",
      "scenario",
      "knowledge",
      "detector_finding",
    ]) {
      expect(reasonDecisionSql).toContain(`'${subject}'`);
    }
    expect(reasonDecisionSql).not.toMatch(/GRANT|DROP TABLE|DELETE FROM/);
  });
});

describe("Increment 1.46 a reason may tighten the threshold", () => {
  it("makes the three states distinguishable, and backfills the rows that never meant anything", () => {
    expect(reasonThresholdSql).toMatch(/ALTER TABLE reason_codes ALTER COLUMN requires_approval_over_cents DROP NOT NULL/);
    expect(reasonThresholdSql).toMatch(/ALTER TABLE reason_codes ALTER COLUMN requires_approval_over_cents DROP DEFAULT/);
    // Every existing row carries 0 because nothing ever read the column, so NULL
    // is the truth about them: no practice expressed a rule through it.
    expect(reasonThresholdSql).toMatch(/UPDATE reason_codes SET requires_approval_over_cents = NULL WHERE requires_approval_over_cents = 0/);
    expect(reasonThresholdSql).toMatch(/CHECK \(requires_approval_over_cents IS NULL OR requires_approval_over_cents >= 0\)/);
  });

  it("tightens and never loosens, and lets the append role read the reasons", () => {
    expect(reasonThresholdSql).toMatch(/threshold_cents := least\(threshold_cents, reason_threshold_cents\)/);
    expect(reasonThresholdSql).toMatch(/SELECT requires_approval_over_cents INTO reason_threshold_cents/);
    expect(reasonThresholdSql).toMatch(/GRANT SELECT ON reason_codes TO app_append;/);
    expect(reasonThresholdSql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO app_append/);
  });

  it("carries the whole trigger forward, the after-hours hold and the correction branch included", () => {
    // Rebuilding this function from an older migration's text would silently
    // revert both, as it nearly did in Increment 1.38. These lines are that guarantee.
    expect(reasonThresholdSql).toMatch(/CREATE OR REPLACE FUNCTION ledger_entries_requires_approval/);
    expect(reasonThresholdSql).toMatch(/after_hours_hold boolean := false;/);
    expect(reasonThresholdSql).toMatch(/ledger_posted_outside_hours\(NEW\.tenant_id, NEW\.location_id, NEW\.posted_at\)/);
    expect(reasonThresholdSql).toMatch(/was posted outside the location''s business hours \(after-hours hold\)/);
    expect(reasonThresholdSql).toMatch(/req\.corrects_entry_id IS NOT NULL/);
    expect(reasonThresholdSql).toMatch(/amount_cents > abs\(req\.amount_cents\)/);
    // And the exception path is untouched: a governed decision still licenses its figure.
    expect(reasonThresholdSql).toMatch(/exception % raises the threshold only to % cents/);
  });
});

describe("Increment 1.45 the practice's reason codes", () => {
  it("names reason_codes among the tenant-scoped tables it has always been", () => {
    // The table has carried FORCE RLS and a tenant policy since migration 0010;
    // the list that names the tenant-scoped tables had simply never said so.
    expect(TENANT_SCOPED_TABLES).toContain("reason_codes");
    expect(ledgerSql).toMatch(/ALTER TABLE reason_codes FORCE ROW LEVEL SECURITY/);
    expect(ledgerSql).toMatch(/CREATE POLICY reason_codes_isolation ON reason_codes/);
  });

  it("keys entries to the code, which is why the code never changes and a used one is never deleted", () => {
    expect(ledgerSql).toMatch(/PRIMARY KEY \(tenant_id, code\)/);
    expect(ledgerSql).toMatch(/CONSTRAINT ledger_entries_reason_fk\s+FOREIGN KEY \(tenant_id, reason_code\) REFERENCES reason_codes \(tenant_id, code\)/);
    // Retiring is a flag the table has always had, so Increment 1.45 needed no migration.
    expect(ledgerSql).toMatch(/active boolean NOT NULL DEFAULT true/);
  });
});

describe("Increment 1.43 the package schema version", () => {
  it("backfills the months already closed, then makes a close state its own schema", () => {
    expect(packageSchemaSql).toMatch(/ALTER TABLE month_closes ADD COLUMN package_schema text NOT NULL DEFAULT 'package-v1'/);
    // Dropping the default is the point: a close records the shape it used rather
    // than inheriting whichever one the column was created with.
    expect(packageSchemaSql).toMatch(/ALTER COLUMN package_schema DROP DEFAULT/);
    expect(packageSchemaSql).not.toMatch(/GRANT|DROP TABLE|DELETE FROM|UPDATE month_closes/);
  });
});

describe("Increment 1.42 the sealed-day posting finding", () => {
  it("widens the finding kinds by one and keeps every kind already in use", () => {
    expect(sealedDayFindingSql).toMatch(/ALTER TABLE control_findings DROP CONSTRAINT control_findings_kind_check/);
    expect(sealedDayFindingSql).toMatch(/'posting_into_sealed_day'/);
    // Dropping and restating the list is how this table widens, so the restatement
    // must carry every kind forward; a detector whose kind vanished would fail at
    // insert time, long after the migration ran.
    for (const kind of [
      "unmatched_bank_line_48h",
      "degraded_owner_clearance",
      "decision_unreviewed",
      "release_without_approval",
      "backdated_posting",
      "duplicate_patient_payment",
      "deposit_not_banked",
      "sole_holder_critical_duty",
    ]) {
      expect(sealedDayFindingSql).toContain(`'${kind}'`);
    }
    // The subject is a ledger entry, which the constraint already admits.
    expect(sealedDayFindingSql).not.toMatch(/control_findings_subject_kind_check/);
    expect(sealedDayFindingSql).not.toMatch(/GRANT|DROP TABLE|DELETE FROM/);
  });
});

describe("Increment 1.40 the late posting into a sealed day", () => {
  it("carries the flag and the day it landed behind as one fact", () => {
    expect(latePostingsSql).toMatch(/ALTER TABLE ledger_entries ADD COLUMN posted_after_close boolean NOT NULL DEFAULT false/);
    expect(latePostingsSql).toMatch(/ALTER TABLE ledger_entries ADD COLUMN closed_day_id uuid REFERENCES day_closes\(id\)/);
    expect(latePostingsSql).toMatch(/CONSTRAINT ledger_entries_late_names_its_day/);
    expect(latePostingsSql).toMatch(/CHECK \(posted_after_close = \(closed_day_id IS NOT NULL\)\)/);
    expect(latePostingsSql).toMatch(/CREATE INDEX ledger_entries_closed_day_idx/);
  });

  it("stamps the row from the database's own reading, and only for a frozen day", () => {
    expect(latePostingsSql).toMatch(/CREATE OR REPLACE FUNCTION ledger_entries_stamp_late_posting/);
    // Location-scoped, on the row's effective date, and only where the day is frozen:
    // an open day is not a seal, and another location's seal is not this row's.
    expect(latePostingsSql).toMatch(/location_id = NEW\.location_id/);
    expect(latePostingsSql).toMatch(/business_date = NEW\.effective_date/);
    expect(latePostingsSql).toMatch(/AND status = 'frozen'/);
    // The trigger assigns both columns, so whatever the writer passed is overwritten.
    expect(latePostingsSql).toMatch(/NEW\.closed_day_id := frozen_day;/);
    expect(latePostingsSql).toMatch(/NEW\.posted_after_close := frozen_day IS NOT NULL;/);
    expect(latePostingsSql).toMatch(/CREATE TRIGGER ledger_entries_stamp_late_posting\s+BEFORE INSERT ON ledger_entries/);
  });

  it("records rather than refuses, and lets the append role read the seals", () => {
    // The month close refuses (migration 0029). A day close is the practice's own,
    // so a late posting into one is admitted and named, never turned away.
    expect(latePostingsSql).not.toMatch(/RAISE EXCEPTION/);
    expect(latePostingsSql).toMatch(/GRANT SELECT ON day_closes TO app_append;/);
    expect(latePostingsSql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO app_append/);
    expect(latePostingsSql).not.toMatch(/DROP TABLE|DELETE FROM/);
  });
});

describe("Increment 1.29 location hours", () => {
  it("gives every location a week of business hours with a plain default and closed weekend", () => {
    expect(locationHoursSql).toMatch(/ALTER TABLE locations\s+ADD COLUMN hours jsonb NOT NULL DEFAULT/);
    expect(locationHoursSql).toMatch(/"mon":\["07:00","19:00"\]/);
    expect(locationHoursSql).toMatch(/"fri":\["07:00","17:00"\]/);
    expect(locationHoursSql).toMatch(/"sat":null,"sun":null/);
    expect(locationHoursSql).not.toMatch(/GRANT|DROP|DELETE|UPDATE/);
  });
});

describe("Increment 1.30 after-hours hold enforced by the database", () => {
  it("re-defines the dual-release trigger to hold an after-hours release whatever the amount", () => {
    expect(afterHoursHoldSql).toMatch(/CREATE OR REPLACE FUNCTION ledger_posted_outside_hours\(p_tenant uuid, p_location uuid, p_at timestamptz\)/);
    expect(afterHoursHoldSql).toMatch(/p_at AT TIME ZONE loc\.timezone/);
    expect(afterHoursHoldSql).toMatch(/loc\.hours -> dow/);
    expect(afterHoursHoldSql).toMatch(/CREATE OR REPLACE FUNCTION ledger_entries_requires_approval\(\)/);
    expect(afterHoursHoldSql).toMatch(/e->>'action' = 'force_dual'/);
    expect(afterHoursHoldSql).toMatch(/COALESCE\(\(e->>'outsideBusinessHours'\)::boolean, false\)/);
    expect(afterHoursHoldSql).toMatch(/IF amount_cents <= threshold_cents AND NOT after_hours_hold THEN/);
    expect(afterHoursHoldSql).toMatch(/after-hours hold\) and cites no approved request/);
    expect(afterHoursHoldSql).toMatch(/GRANT SELECT ON locations TO app_append/);
    expect(afterHoursHoldSql).not.toMatch(/DROP TRIGGER|DROP TABLE|DELETE FROM/);
  });
});

describe("Increment 1.13 dual release re-checked by the database", () => {
  it("adds a BEFORE INSERT trigger on ledger_entries that reads the active policy", () => {
    expect(enforcementSql).toMatch(/CREATE TRIGGER ledger_entries_dual_release\s+BEFORE INSERT ON ledger_entries/);
    expect(enforcementSql).toMatch(/FROM control_policies\s+WHERE tenant_id = NEW\.tenant_id\s+ORDER BY version DESC/);
    expect(enforcementSql).toMatch(/req\.status <> 'approved'/);
    expect(enforcementSql).toMatch(/req\.second_approver_id = NEW\.created_by_id/);
    expect(enforcementSql).toMatch(/ADD COLUMN applied_exception_id text/);
    expect(enforcementSql).toMatch(/CREATE UNIQUE INDEX ledger_entries_approval_request_uidx/);
    expect(enforcementSql).toMatch(/GRANT SELECT ON control_policies, approval_requests TO app_append/);
    expect(enforcementSql).not.toMatch(/GRANT[^\n]*(INSERT|UPDATE|DELETE)[^\n]*TO app_append/);
  });
});

describe("Increment 1.3 Curve Hero import staging", () => {
  it("creates import run and staged row tables with RLS", () => {
    expect(importSql).toMatch(/CREATE TABLE import_runs\b/);
    expect(importSql).toMatch(/CREATE TABLE import_staged_rows\b/);
    expect(importSql).toMatch(/ALTER TABLE import_runs ENABLE ROW LEVEL SECURITY/);
    expect(importSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON import_runs, import_staged_rows TO app_rw/);
  });
});

describe("Increment 1.5 bank reconciliation", () => {
  it("creates bank accounts, append-only transactions, and reconciliation tables", () => {
    expect(bankSql).toMatch(/CREATE TABLE bank_accounts\b/);
    expect(bankSql).toMatch(/CREATE TABLE bank_transactions\b/);
    expect(bankSql).toMatch(/CREATE TABLE reconciliation_runs\b/);
    expect(bankSql).toMatch(/CREATE TABLE reconciliation_variances\b/);
    expect(bankSql).toMatch(/bank_transactions_immutable/);
    expect(bankSql).toMatch(/GRANT SELECT, INSERT ON bank_transactions TO app_rw/);
  });
});

describe("Increment 1.6 day close and deposits", () => {
  it("creates deposits and frozen day close tables", () => {
    expect(dayCloseSql).toMatch(/CREATE TABLE deposits\b/);
    expect(dayCloseSql).toMatch(/CREATE TABLE day_closes\b/);
    expect(dayCloseSql).toMatch(/day_closes_immutable_when_frozen/);
    expect(dayCloseSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON deposits, day_closes TO app_rw/);
  });
});

describe("Increment 1.10 patient statements", () => {
  it("creates statements with issued-row immutability and RLS", () => {
    expect(statementsSql).toMatch(/CREATE TABLE statements\b/);
    expect(statementsSql).toMatch(/hold_reason/);
    expect(statementsSql).toMatch(/statements_immutable_when_issued/);
    expect(statementsSql).toMatch(/GRANT SELECT, INSERT, UPDATE ON statements TO app_rw/);
    expect(TENANT_SCOPED_TABLES).toContain("statements");
  });
});

describe("Increment 0.7 chain head anchor", () => {
  it("stores the Object Lock key and allows a one-time anchor update", () => {
    expect(anchorSql).toMatch(/object_lock_key/);
    expect(anchorSql).toMatch(/GRANT SELECT, UPDATE ON audit_chain_checks TO app_append/);
    expect(anchorSql).toMatch(/OLD\.object_lock_key IS NULL/);
  });
});

describe("BAA gate", () => {
  const live = {
    signedAt: new Date("2026-01-01T00:00:00Z"),
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    documentRef: "baa/vendor-1",
  };

  it("refuses enablement without a live BAA", () => {
    expect(canEnableIntegration({ signedAt: null, expiresAt: null, documentRef: null })).toBe(
      false
    );
    expect(refuseEnabledWithoutBaa(true, live).ok).toBe(true);
    expect(
      refuseEnabledWithoutBaa(true, { signedAt: null, expiresAt: null, documentRef: null })
    ).toEqual({ ok: false, code: "baa_required" });
  });

  it("treats an expired BAA as not live", () => {
    expect(
      baaIsLive({
        signedAt: new Date("2024-01-01T00:00:00Z"),
        expiresAt: new Date("2025-01-01T00:00:00Z"),
        documentRef: "old",
      })
    ).toBe(false);
  });

  it("is encoded in the migration trigger", () => {
    expect(sql).toMatch(/integration_requires_live_baa/);
    expect(sql).toMatch(/baa_required/);
  });
});

describe("envelope encryption", () => {
  const env = { DEV_MFA_KEY: "a".repeat(64) };

  it("round-trips an MFA secret", () => {
    const blob = encryptSecret("JBSWY3DPEHPK3PXP", env);
    expect(blob.alg).toBe("aes-256-gcm");
    expect(decryptSecret(blob, env)).toBe("JBSWY3DPEHPK3PXP");
  });
});

describe("domain event chain", () => {
  it("is deterministic and breaks if a link is rewritten", () => {
    const first = hashDomainEvent({
      prevHash: GENESIS_HASH,
      tenantId: "t1",
      kind: "user.created",
      payload: { id: "u1" },
      occurredAt: "2026-09-14T00:00:00.000Z",
    });
    const second = hashDomainEvent({
      prevHash: first,
      tenantId: "t1",
      kind: "session.started",
      payload: { id: "s1" },
      occurredAt: "2026-09-14T00:01:00.000Z",
    });
    expect(first).toHaveLength(64);
    expect(second).not.toBe(first);
    const tampered = hashDomainEvent({
      prevHash: first,
      tenantId: "t1",
      kind: "session.started",
      payload: { id: "s2" },
      occurredAt: "2026-09-14T00:01:00.000Z",
    });
    expect(tampered).not.toBe(second);
  });
});

describe("uuidv7", () => {
  it("is time-ordered", () => {
    const a = uuidv7(1_000);
    const b = uuidv7(2_000);
    expect(a < b).toBe(true);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});

describe("Increment 0.2 auth lookup", () => {
  it("binds tenant context with SET LOCAL (is_local true)", () => {
    expect(SET_LOCAL_TENANT_SQL).toMatch(/set_config\('app\.tenant_id', \$1, true\)/);
    expect(SET_LOCAL_TENANT_SQL).toMatch(/set_config\('app\.user_id', \$2, true\)/);
  });

  it("looks up users and sessions without a tenant setting", () => {
    expect(authSql).toMatch(/CREATE OR REPLACE FUNCTION auth_lookup_user\(/);
    expect(authSql).toMatch(/CREATE OR REPLACE FUNCTION auth_lookup_user_by_id\(/);
    expect(authSql).toMatch(/CREATE OR REPLACE FUNCTION auth_lookup_session\(/);
    expect(authSql).toMatch(/SECURITY DEFINER/);
    expect(authSql).toMatch(/users_username_lower_uidx/);
  });
});
