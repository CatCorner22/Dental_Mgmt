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
