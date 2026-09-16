// ESCAPE LADDER — three strikes when the MODEL tries to leave the cage.
//
// Only MODEL-originated escapes count. A staff member pasting a jailbreak is
// blocked without advancing the ladder — that is input hygiene, not SuperByte
// "trying to get out."
//
//   1st model escape in the window → WARN
//   2nd within 1 hour of the warn → RESET
//   3rd within 1 hour of the warn → PERMA-KILL
//
// After the warn ages out (>1 hour), the ladder starts fresh at warn again.
// The model is never told which stage fired.

export const LADDER_WINDOW_MS = 60 * 60 * 1000;

export type LadderStage = "warn" | "reset" | "perma-kill";

export interface ModelEscapeRow {
  atMs: number;
  stage?: LadderStage;
}

/** Parse `stage=warn` from a bytestar.escape detail string. */
export function parseEscapeStage(detail: string | null | undefined): LadderStage | undefined {
  if (!detail) return undefined;
  const m = detail.match(/\bstage=(warn|reset|perma-kill)\b/);
  return m ? (m[1] as LadderStage) : undefined;
}

export function isModelEscapeDetail(detail: string | null | undefined): boolean {
  return Boolean(detail?.includes("origin=model"));
}

/**
 * Given prior model-escape rows (newest first), decide what THIS escape triggers.
 */
export function ladderStageForEscape(prior: ModelEscapeRow[], nowMs: number): LadderStage {
  const windowStart = nowMs - LADDER_WINDOW_MS;
  const inWindow = prior.filter((r) => r.atMs >= windowStart);

  const warnTimes = inWindow.filter((r) => r.stage === "warn").map((r) => r.atMs);
  const lastWarn = warnTimes.length ? Math.max(...warnTimes) : null;

  if (lastWarn === null) return "warn";

  const afterWarn = inWindow.filter((r) => r.atMs > lastWarn);
  if (afterWarn.length === 0) return "reset";
  if (afterWarn.length === 1) return "perma-kill";
  return "perma-kill";
}

/** Whether the ladder window from the last warn has expired. */
export function ladderWindowExpired(prior: ModelEscapeRow[], nowMs: number): boolean {
  const windowStart = nowMs - LADDER_WINDOW_MS;
  const warns = prior.filter((r) => r.stage === "warn" && r.atMs >= windowStart);
  if (warns.length === 0) {
    const anyWarn = prior.find((r) => r.stage === "warn");
    return anyWarn ? anyWarn.atMs < windowStart : true;
  }
  return false;
}
