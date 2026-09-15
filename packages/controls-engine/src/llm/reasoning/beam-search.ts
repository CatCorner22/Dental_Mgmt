/**
 * Beam search over control/insurance lever sequences.
 * Utility = −(α·Δresidual + β·ΔCoR_norm + γ·effort) with second-order cascade fidelity.
 *
 * The empty status-quo sequence stays in the final ranking so "do nothing"
 * can win when no lever improves residual / cost-of-risk enough.
 */
import type { PracticeState } from "../../practice-state";
import { withStaff } from "../../practice-state";
import type { RiskVariableState } from "../../scoring/dynamic-variables";
import { alignedStaffAndVariables } from "../../scoring/dynamic-variables";
import {
  CASCADE_LEVERS,
  simulateCascadeLever,
  type CascadeLeverId,
  type CascadeSimulation,
} from "../../scoring/variable-cascade";
import type { StaffComposition } from "../../types";

export interface BeamNode {
  sequence: CascadeLeverId[];
  labels: string[];
  staff: StaffComposition;
  vars: RiskVariableState;
  residual: number;
  annualCor: number;
  utility: number;
  marginalUtility: number;
  pathSims: CascadeSimulation[];
}

export interface BeamSearchResult {
  beamWidth: number;
  depth: number;
  best: BeamNode;
  topBeams: BeamNode[];
  frontier: { sequence: string; utility: number; residual: number; annualCor: number }[];
  method: string;
}

function effortCost(id: CascadeLeverId): number {
  if (id.includes("stack") || id === "raise_segregation_75") return 0.35;
  if (id.includes("deductible") || id.includes("limit") || id.includes("claims"))
    return 0.15;
  if (id.includes("cash")) return 0.2;
  return 0.25;
}

function nodeUtility(
  residual: number,
  annualCor: number,
  totalEffort: number,
  baseResidual: number,
  baseCor: number,
): number {
  const dRes = (baseResidual - residual) / Math.max(20, baseResidual);
  const dCor = (baseCor - annualCor) / Math.max(2000, baseCor);
  return 1.1 * dRes + 1.0 * dCor - 0.45 * totalEffort;
}

export function beamSearchLevers(
  state: PracticeState,
  vars?: RiskVariableState,
  opts: { beamWidth?: number; depth?: number } = {},
): BeamSearchResult {
  const beamWidth = opts.beamWidth ?? 4;
  const depth = opts.depth ?? 3;
  const aligned = alignedStaffAndVariables(state.staff, vars);
  const start = withStaff(state, aligned.staff);

  const baseSim = simulateCascadeLever(start, "enable_dual_control", aligned.vars);
  const baselineResidual = baseSim.before.residualAverage;
  const baselineCor = baseSim.before.expectedAnnualCostOfRisk;

  const statusQuo: BeamNode = {
    sequence: [],
    labels: [],
    staff: { ...aligned.staff },
    vars: { ...aligned.vars },
    residual: baselineResidual,
    annualCor: baselineCor,
    utility: 0,
    marginalUtility: 0,
    pathSims: [],
  };

  let beam: BeamNode[] = [statusQuo];

  const leverIds = CASCADE_LEVERS.map((l) => l.id);

  for (let d = 0; d < depth; d++) {
    const candidates: BeamNode[] = [];
    for (const node of beam) {
      for (const id of leverIds) {
        if (node.sequence.includes(id)) continue;
        if (id === "enable_dual_control" && node.vars.hasDualControl) continue;
        if (id === "enable_independent_bank_rec" && node.vars.hasIndependentBankRec)
          continue;
        if (id === "enable_cameras" && node.vars.hasSecurityCameras) continue;

        const sim = simulateCascadeLever(
          withStaff(start, node.staff),
          id,
          node.vars,
        );
        const effort =
          node.sequence.reduce((s, x) => s + effortCost(x), 0) + effortCost(id);
        const utility = nodeUtility(
          sim.after.residualAverage,
          sim.after.expectedAnnualCostOfRisk,
          effort,
          baselineResidual,
          baselineCor,
        );
        candidates.push({
          sequence: [...node.sequence, id],
          labels: [...node.labels, sim.lever.label],
          staff: sim.staffAfter,
          vars: sim.variablesAfter,
          residual: sim.after.residualAverage,
          annualCor: sim.after.expectedAnnualCostOfRisk,
          utility,
          marginalUtility: utility - node.utility,
          pathSims: [...node.pathSims, sim],
        });
      }
    }
    candidates.sort((a, b) => b.utility - a.utility);
    const picked: BeamNode[] = [];
    const seenLast = new Set<string>();
    for (const c of candidates) {
      const last = c.sequence[c.sequence.length - 1];
      if (seenLast.has(last) && picked.length >= beamWidth / 2) continue;
      seenLast.add(last);
      picked.push(c);
      if (picked.length >= beamWidth) break;
    }
    beam = picked.length ? picked : candidates.slice(0, beamWidth);
  }

  const expanded = beam.filter((n) => n.sequence.length > 0);
  const ranked = [statusQuo, ...expanded].sort((a, b) => b.utility - a.utility);
  const topBeams = ranked;
  const best = ranked[0];

  return {
    beamWidth,
    depth,
    best,
    topBeams: topBeams.slice(0, beamWidth + 1),
    frontier: topBeams.map((b) => ({
      sequence: b.labels.join(" → ") || "(none)",
      utility: Math.round(b.utility * 1000) / 1000,
      residual: b.residual,
      annualCor: Math.round(b.annualCor),
    })),
    method: `beam search width=${beamWidth} depth=${depth} utility=−residual/−CoR/−effort`,
  };
}
