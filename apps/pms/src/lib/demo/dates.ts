/**
 * The days the demonstration forms offer (Increment 1.85).
 *
 * Three screens pre-fill a date so a walk-through lands on the seeded story
 * week rather than on an empty day: the day close, posting to the ledger, and
 * the statement's as-of. Each held its own copy of the seed's literal, so
 * moving the seed left them pointing at a week that no longer existed.
 *
 * They are written here rather than read from `@pms/db/seed-data`, which is
 * where the seed's own constant lives, because that module also carries
 * `DEV_PASSWORD` and `DEV_MFA_SECRET`. A client component that imports it puts
 * both inside the bundler's reach, and whether tree-shaking then drops them is
 * not a thing worth depending on for two dates. `seedWindow.test.ts` asserts
 * these two values against `SEED_STORY_WEEK` instead, so a seed moved without
 * them fails by name in the gate rather than quietly on a screen.
 */

/** The day the day-close and ledger-posting forms offer. Matches `SEED_STORY_WEEK.effective`. */
export const DEMO_EFFECTIVE_DATE = "2026-09-19";

/** The day the statements form offers as its as-of. Matches `SEED_STORY_WEEK.issued`. */
export const DEMO_AS_OF_DATE = "2026-09-21";
