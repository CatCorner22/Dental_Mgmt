#!/usr/bin/env bash
# The whole gate, in one command, before a tree goes live. Usage: bash scripts/final-review.sh
# Each step writes its report under .scratch/final-review/ and this script prints one line per step.
# Exit 1 if any step is red. Nothing here is new: it is every check the repository already runs,
# in the order a reader would want them, so "it passed" has one meaning.
set -u
cd "$(dirname "$0")/.."
OUT=.scratch/final-review; mkdir -p "$OUT"; red=0
step() { local name=$1; shift; if "$@" > "$OUT/$name.log" 2>&1; then echo "PASS  $name"; else echo "FAIL  $name   (see $OUT/$name.log)"; red=1; fi; }

step syntax        node scripts/syntax-check.mjs
step proto-check   node scripts/proto-check.mjs
step a11y          node scripts/a11y-check.mjs --json "$OUT/a11y.json"
step verify-docs   bash scripts/verify-docs.sh
# The full regression suite is the slow one (about 20 minutes): 700 checks, each a browser run.
step reproduce     node scripts/beta/reproduce.mjs --json "$OUT/reproduce.json"

# Summaries a reader wants without opening a log.
echo
grep -E "distinct violations" "$OUT/a11y.log" || true
grep -E "of [0-9]+ reproduced" "$OUT/reproduce.log" || true
grep -E "cannot be read as clean" -A4 "$OUT/reproduce.log" || true
grep -cE "^PASS" "$OUT/verify-docs.log" | sed 's/^/verify-docs PASS rows: /' || true
echo
if [ "$red" = 1 ]; then echo "RED: at least one gate failed."; else echo "GREEN: every gate passed."; fi
exit $red
