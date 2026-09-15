console.error(
  "Curve Hero ledger apply is API-only in Increment 1.8.\n" +
    "POST /api/import/curve/apply with JSON body { \"runId\": \"<import-run-uuid>\" } " +
    "and the run_import entitlement."
);
process.exit(1);
