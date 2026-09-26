/**
 * Synthetic tenants and staff for local Postgres and AUTH_DEV_MEMORY.
 * Keep in sync with apps/pms/src/lib/auth/devSeed.ts.
 */
export const DEV_PASSWORD = "Dev-password-0.2!";
export const DEV_MFA_SECRET = "JBSWY3DPEHPK3PXP";
export const DEV_RECOVERY_CODE = "dev0-aaaa";

export const DEV_TENANTS = [
  { id: "0196b0a0-0000-7000-8000-000000000001", name: "Ridgeview Family Dental", slug: "ridgeview" },
  { id: "0196b0a0-0000-7000-8000-000000000002", name: "Oakridge Dental", slug: "oakridge" },
] as const;

/** Stable ids for the Ridgeview demo ledger seeded in Increment 1.4. */
export const SEED_APPROVAL = {
  requestId: "0196b0a0-0000-7000-8000-000000000601",
} as const;

export const SEED_BANK = {
  tenantId: DEV_TENANTS[0].id,
  locationId: "0196b0a0-0000-7000-8000-000000000101",
  accountId: "0196b0a0-0000-7000-8000-000000000401",
} as const;

export const SEED_LEDGER = {
  tenantId: DEV_TENANTS[0].id,
  locationId: "0196b0a0-0000-7000-8000-000000000101",
  ownerId: "0196b0a0-0000-7000-8000-000000000011",
  patientJaneId: "0196b0a0-0000-7000-8000-000000000301",
  patientJohnId: "0196b0a0-0000-7000-8000-000000000302",
  accountDoeId: "0196b0a0-0000-7000-8000-000000000311",
  accountSmithId: "0196b0a0-0000-7000-8000-000000000312",
  procedureJaneId: "0196b0a0-0000-7000-8000-000000000321",
  procedureJohnId: "0196b0a0-0000-7000-8000-000000000322",
  chargeJaneId: "0196b0a0-0000-7000-8000-000000000331",
  chargeJohnId: "0196b0a0-0000-7000-8000-000000000332",
  paymentJaneId: "0196b0a0-0000-7000-8000-000000000341",
  memberJaneId: "0196b0a0-0000-7000-8000-000000000351",
  memberJohnId: "0196b0a0-0000-7000-8000-000000000352",
  allocationJaneId: "0196b0a0-0000-7000-8000-000000000361",
  statementJaneId: "0196b0a0-0000-7000-8000-000000000701",
} as const;

/**
 * THE SEED'S STORY WEEK, AND THE DAY IT EXPIRES.
 *
 * The demo rows carry `effective_date` as a written date while `posted_at` is
 * the moment the seed runs, so the gap between them belongs to the wall clock
 * and not to the fixture. `BACKDATE_DAYS = 7` in
 * `apps/pms/src/lib/controls/detectors.ts`, read by `alerts/hardEvents.ts`,
 * raises a `retroactive_entry` once that gap passes seven days — and the owner
 * board and weekly digest cases assert that ordinary seeded rows raise no such
 * thing. On 2026-09-22 the old week (2026-09-14) went eight days stale and
 * turned `main` red.
 *
 * Increment 1.84 moved it to 2026-09-19, five days rather than the six that
 * would have been possible, for a reason worth recording: the money-desk suite
 * imports its deposits at `daysAgo(2)`, so a week anchored on 2026-09-20 would
 * have collided with them on 2026-09-22 and put four rows on a day close that
 * expects two. Five days clears that collision for every day this week survives.
 *
 * The arithmetic is unforgiving. `today - effective` must stay at or under
 * seven, and an effective date may not run ahead of the clock, so **any written
 * date buys at most seven days**. This one buys five, and fails again on
 * 2026-09-27.
 *
 * Increment 1.85 gave that sentence a reader, and moved it here from
 * `seed-ledger.ts` because the value moved here first.
 * `apps/pms/src/lib/controls/seedWindow.ts` holds the three rules above as one
 * function and `seedWindow.test.ts` runs it against the real clock, so on the
 * day this expires the gate names the constant, the arithmetic and the two ways
 * forward — rather than leaving them to be inferred from two board assertions
 * about retroactive entries.
 *
 * Moving it again is a stopgap, chosen deliberately over anchoring these dates
 * to the seed run — which would end the drift for good and move every assertion
 * that quotes them. When this next fails, that is the decision waiting.
 */
export const SEED_STORY_WEEK = {
  /** The day the demo ledger, day close, approval and statement lines are effective. */
  effective: "2026-09-19",
  /** The day the demo statement is as-of and was issued. It may not precede the week or run ahead of the clock. */
  issued: "2026-09-21",
} as const;

export const DEV_LOCATIONS = [
  {
    id: "0196b0a0-0000-7000-8000-000000000101",
    tenantId: DEV_TENANTS[0].id,
    name: "Main",
    timezone: "America/Chicago",
  },
  {
    id: "0196b0a0-0000-7000-8000-000000000201",
    tenantId: DEV_TENANTS[1].id,
    name: "Main",
    timezone: "America/Chicago",
  },
] as const;

export type SeedUserSpec = {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  role: "admin" | "user" | "readonly";
  clinicalRole: string;
  entitlements: string[];
  /** When false, the user must enroll MFA on first password sign-in. */
  mfaEnrolled: boolean;
};

export const DEV_USERS: readonly SeedUserSpec[] = [
  {
    id: "0196b0a0-0000-7000-8000-000000000011",
    tenantId: DEV_TENANTS[0].id,
    username: "ridgeview-owner",
    displayName: "Riley Owner",
    role: "admin",
    clinicalRole: "dentist",
    entitlements: ["approve_writeoffs", "run_import", "bank_reconcile"],
    mfaEnrolled: true,
  },
  {
    id: "0196b0a0-0000-7000-8000-000000000012",
    tenantId: DEV_TENANTS[0].id,
    username: "ridgeview-front",
    displayName: "Finn Front",
    role: "user",
    clinicalRole: "unset",
    entitlements: ["post_payments", "run_import"],
    mfaEnrolled: true,
  },
  {
    id: "0196b0a0-0000-7000-8000-000000000013",
    tenantId: DEV_TENANTS[0].id,
    username: "ridgeview-newhire",
    displayName: "Nora Newhire",
    role: "user",
    clinicalRole: "unset",
    entitlements: [],
    mfaEnrolled: false,
  },
  {
    // The outside accountant's seat (Increment 1.49): the lowest rank the
    // product has, holding the reporting grant and nothing else, so it reaches
    // the month-end package and no other screen. Its duty pairs with no other
    // in the SoD rulebook, so inviting it creates no conflict; and because it
    // never posts, prepares, or clears, it is the independent reconciler the
    // controls design wants rather than another pair of the practice's hands.
    id: "0196b0a0-0000-7000-8000-000000000014",
    tenantId: DEV_TENANTS[0].id,
    username: "ridgeview-cpa",
    displayName: "Casey Prentice",
    role: "readonly",
    clinicalRole: "unset",
    entitlements: ["view_reports_only"],
    mfaEnrolled: true,
  },
  {
    id: "0196b0a0-0000-7000-8000-000000000021",
    tenantId: DEV_TENANTS[1].id,
    username: "oakridge-owner",
    displayName: "Oak Owner",
    role: "admin",
    clinicalRole: "dentist",
    entitlements: ["approve_writeoffs"],
    mfaEnrolled: true,
  },
];
