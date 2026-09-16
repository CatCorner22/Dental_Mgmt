/**
 * Production templates for a practice that has no scenario or knowledge
 * rows of its own yet. Numeric parameters match the frozen Ridgeview
 * fixture so residual and COSO scores stay comparable across tenants;
 * the wording is generic and names no person.
 *
 * Base rates are educational illustrations, not actuarial pricing.
 * Every number here is directional until a CPA calibrates it.
 */
import type { ConflictRule } from "./sod/conflict-rules";
import { CONFLICT_RULES } from "./sod/conflict-rules";
import type { CrimeFraudStats, ScenarioTemplate } from "./types";

export const ILLUSTRATIVE_CRIME_STATS: CrimeFraudStats = {
  industryEmbezzlementRate: 0.18,
  typicalLossMid: 35000,
  typicalLossHigh: 125000,
  medianDetectionDays: 90,
  detectionDaysP95: 210,
  source:
    "Illustrative synthesis of small professional practice fraud / embezzlement studies (e.g. ACFE Report to the Nations patterns for small orgs; dental practice management fraud case literature). Educational rates — not firm-specific actuarial pricing.",
};

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: "sc-front-desk-leaves",
    title: "Sole holder of denial-appeal knowledge leaves",
    description:
      "The one person who knows the insurance denial and appeal workflow resigns with two weeks' notice and no documented cross-training.",
    knowledgeId: "k1",
    controlId: "c-claims",
    baseTimelineDays: { p50: 45, p95Low: 28, p95High: 75 },
    baseFinancialImpact: { expected: 18500, low: 8000, high: 42000 },
    statSources: [
      "Denial aging / revenue cycle lag patterns in dental practice management literature",
      "Key-person risk: revenue leakage when sole expert exits mid-cycle",
    ],
    cascadeLayers: ["knowledge", "process", "surface", "continuity"],
    mitigations: [
      {
        id: "m1",
        label: "Cross-train billing on denial appeals (documented SOP)",
        effort: "medium",
        riskReduction: 0.55,
        costAnnual: 2400,
      },
      {
        id: "m2",
        label: "Hire temporary RCM support for 90 days",
        effort: "high",
        riskReduction: 0.65,
        costAnnual: 12000,
      },
      {
        id: "m3",
        label: "Record the denial playbook before exit",
        effort: "low",
        riskReduction: 0.35,
        costAnnual: 400,
      },
    ],
  },
  {
    id: "sc-cash-sod-failure",
    title: "Unsegregated cash + reconciliation control fails",
    description:
      "The same person posts payments and reconciles the bank with weak independent review. Opportunity plus weak SoD elevates fraud and error risk.",
    controlId: "c-sod-cash",
    baseTimelineDays: { p50: 90, p95Low: 45, p95High: 210 },
    baseFinancialImpact: { expected: 28000, low: 5000, high: 95000 },
    statSources: [
      ILLUSTRATIVE_CRIME_STATS.source,
      "ACFE-style small organization fraud: longer detection when custody + recording combined",
    ],
    cascadeLayers: ["control", "process", "surface", "continuity"],
    mitigations: [
      {
        id: "m4",
        label: "Independent bank recon by owner weekly",
        effort: "low",
        riskReduction: 0.5,
        costAnnual: 0,
      },
      {
        id: "m5",
        label: "Split posting vs deposit custody",
        effort: "medium",
        riskReduction: 0.7,
        costAnnual: 0,
      },
      {
        id: "m6",
        label: "Camera + dual count on cash drawer close",
        effort: "medium",
        riskReduction: 0.4,
        costAnnual: 800,
      },
    ],
  },
  {
    id: "sc-writeoff-abuse",
    title: "Write-off authority without dual control",
    description:
      "Billing can post large adjustments without independent approval. The control gap plus staff composition raises residual risk.",
    controlId: "c-sod-billing",
    knowledgeId: "k7",
    baseTimelineDays: { p50: 120, p95Low: 60, p95High: 240 },
    baseFinancialImpact: { expected: 22000, low: 4000, high: 70000 },
    statSources: [
      ILLUSTRATIVE_CRIME_STATS.source,
      "Revenue leakage studies: undocumented adjustments and weak dual control",
    ],
    cascadeLayers: ["control", "knowledge", "process", "continuity"],
    mitigations: [
      {
        id: "m7",
        label: "Require owner approval for write-offs > $150",
        effort: "low",
        riskReduction: 0.6,
        costAnnual: 0,
      },
      {
        id: "m8",
        label: "Monthly adjustment exception report",
        effort: "low",
        riskReduction: 0.45,
        costAnnual: 0,
      },
    ],
  },
  {
    id: "sc-vendor-fraud",
    title: "Vendor setup + payment not segregated",
    description:
      "Accounts payable can create vendors and release payments. This is the classic fictitious-vendor path when dual release is missing.",
    controlId: "c-sod-ap",
    baseTimelineDays: { p50: 100, p95Low: 50, p95High: 200 },
    baseFinancialImpact: { expected: 40000, low: 8000, high: 125000 },
    statSources: [
      ILLUSTRATIVE_CRIME_STATS.source,
      "Billing schemes / fictitious vendor patterns in small entity fraud literature",
    ],
    cascadeLayers: ["control", "source", "process", "continuity"],
    mitigations: [
      {
        id: "m9",
        label: "Dual bank release on all ACH > $500",
        effort: "medium",
        riskReduction: 0.75,
        costAnnual: 0,
      },
      {
        id: "m10",
        label: "Independent new-vendor review monthly",
        effort: "low",
        riskReduction: 0.5,
        costAnnual: 0,
      },
    ],
  },
];

/**
 * The typed controls registry: one row per control the residual engine
 * scores, with the SoD rules whose conflicts mean the control is not
 * segregated. `ruleIds` is derived from the rulebook's linkedControlId
 * and completed for the one rule the rulebook leaves unlinked.
 */
export interface ControlTemplate {
  id: string;
  name: string;
  description: string;
  duties: string[];
  ruleIds: string[];
}

function rulesLinkedTo(controlId: string): string[] {
  return CONFLICT_RULES.filter((r: ConflictRule) => r.linkedControlId === controlId).map(
    (r) => r.id,
  );
}

export const CONTROL_TEMPLATES: ControlTemplate[] = [
  {
    id: "c-cash",
    name: "Cash handling control",
    description: "Separate custody of cash from posting and deposit reconciliation.",
    duties: ["custody", "recording", "reconciliation"],
    ruleIds: rulesLinkedTo("c-cash"),
  },
  {
    id: "c-sod-cash",
    name: "SoD: payments vs reconciliation",
    description: "Whoever posts payments or prepares the deposit does not reconcile the bank.",
    duties: ["recording", "reconciliation"],
    ruleIds: rulesLinkedTo("c-sod-cash"),
  },
  {
    id: "c-sod-billing",
    name: "SoD: claims and adjustments",
    description: "Whoever submits claims or posts adjustments does not approve write-offs alone.",
    duties: ["authorization", "recording"],
    ruleIds: rulesLinkedTo("c-sod-billing"),
  },
  {
    id: "c-sod-ap",
    name: "SoD: vendor setup vs payment",
    description: "Whoever creates or approves vendors does not release payments alone.",
    duties: ["authorization", "custody", "master_data"],
    ruleIds: rulesLinkedTo("c-sod-ap"),
  },
  {
    id: "c-payroll",
    name: "Payroll approval",
    description: "The owner approves the payroll file before transmission.",
    duties: ["authorization", "recording"],
    ruleIds: rulesLinkedTo("c-payroll"),
  },
  {
    id: "c-pms-admin",
    name: "PMS admin separated from posting",
    description: "Role administration is not combined with payment posting.",
    duties: ["master_data", "recording"],
    ruleIds: ["rule-admin-pay"],
  },
];
