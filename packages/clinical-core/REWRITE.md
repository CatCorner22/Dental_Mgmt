# Smile Notes tests that need a rewrite after the PHI premise invert

Lifting 201 test files while changing "PHI blocks filing" into "PHI is an
outbound-boundary classifier" will fail some Smile Notes tests. Those failures
are tracked here. They are not a reason to leave PHI-blocking rules in place.

Run `pnpm --filter @pms/clinical-core test` and append a row for each failing
file: path, assertion, and the rewrite needed (drop, invert, or keep as a
boundary test).

| File | What failed | Rewrite |
|---|---|---|
| *(filled after the first package test run)* | | |
