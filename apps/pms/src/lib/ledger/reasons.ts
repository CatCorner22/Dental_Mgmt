/**
 * The reason codes the product offers per posting kind.
 *
 * `ledger_entries.reason_code` is a foreign key into each practice's own
 * `reason_codes`, so an option here exists only because the practice seeds
 * it. Offering a list rather than a free-text box keeps a reason the
 * practice never adopted from reaching the database at all; the posting
 * services refuse an unregistered one in words besides (Increment 1.39).
 */
export const REASON_OPTIONS: Record<string, { value: string; label: string }[]> = {
  write_off: [
    { value: "courtesy", label: "Courtesy adjustment" },
    { value: "contractual_ppo", label: "Contractual PPO write-off" },
  ],
  adjustment: [{ value: "correction", label: "Correction" }],
};

/** Every option the product offers, whatever the kind; a correction may replace any of them. */
export const ALL_REASON_OPTIONS = Object.values(REASON_OPTIONS)
  .flat()
  .filter((option, i, all) => all.findIndex((o) => o.value === option.value) === i);
