/**
 * Version stamps frozen onto scored artifacts.
 * Bump SCORING_VERSION when residual math or weights change.
 * Bump CONTROL_RULEBOOK_VERSION when SoD pairs or dual-release defaults change.
 *
 * Weights and multipliers are directional until a CPA calibrates them.
 * Engines score control design and residual risk — never people.
 */
// 0.2.0: the after-hours hold joins the dual-release defaults (hours-scoped force_dual exception; Increment 1.30).
export const CONTROL_RULEBOOK_VERSION = "0.2.0";
export const SCORING_VERSION = "precog-residual-v1.1.0";
