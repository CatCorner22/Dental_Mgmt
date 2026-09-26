/**
 * Version stamps frozen onto scored artifacts.
 * Bump SCORING_VERSION when residual math or weights change.
 * Bump CONTROL_RULEBOOK_VERSION when SoD pairs or dual-release defaults change.
 *
 * Weights and multipliers are directional until a CPA calibrates them.
 * Engines score control design and residual risk — never people.
 */
// 0.2.0: the after-hours hold joins the dual-release defaults (hours-scoped force_dual exception; Increment 1.30).
// 0.3.0: `run_import` enters the rulebook (Increment 1.91). It guarded three
//        import routes while belonging to no catalog, so it could be revoked
//        and never granted, and the duty-family matrix scored nobody who held
//        it. Recording, weight 4. Every practice's duty matrix gains a row and
//        a column, and a person holding it alongside a custody, reconciliation
//        or authorization duty gains a family-level finding that was always
//        true and never scored.
// 0.3.1: rule-admin-pay links to c-pms-admin; family conflict ids are order-independent; a matching force_dual outranks any loosening exception.
export const CONTROL_RULEBOOK_VERSION = "0.3.1";
export const SCORING_VERSION = "precog-residual-v1.1.0";
