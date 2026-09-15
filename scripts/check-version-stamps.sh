#!/usr/bin/env bash
# Fail when rule/KB/control files change without their version stamp file.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${SKIP_VERSION_STAMPS:-}" == "1" ]]; then
  echo "version stamps skipped"
  exit 0
fi

BASE="${VERSION_STAMP_BASE:-}"
if [[ -z "$BASE" ]]; then
  if git rev-parse --verify origin/claude/dental-precog-consolidation-60ckgd >/dev/null 2>&1; then
    BASE="origin/claude/dental-precog-consolidation-60ckgd"
  else
    BASE="HEAD~1"
  fi
fi

if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
  echo "No merge base ($BASE); skipping version-stamp diff."
  exit 0
fi

CHANGED=$(git diff --name-only "$BASE"...HEAD || true)

fail_if() {
  local pattern="$1"
  local stamp="$2"
  local label="$3"
  local hits
  hits=$(echo "$CHANGED" | grep -E "$pattern" | grep -v '\.test\.ts$' || true)
  local stamp_hit
  stamp_hit=$(echo "$CHANGED" | grep -c "$stamp" || true)
  if [[ -n "$hits" && "$stamp_hit" = "0" ]]; then
    echo "::error::$label changed without bumping $stamp:"
    echo "$hits"
    exit 1
  fi
}

fail_if '^packages/clinical-core/src/lib/(vocab|modules)/|^packages/clinical-core/src/lib/audit/(rules/|maskPhi)' \
  'packages/clinical-core/src/lib/version.ts' \
  "Rules/vocab/modules"

fail_if '^packages/clinical-kb/src/knowledge' \
  'packages/clinical-kb/src/version.ts' \
  "Knowledge table"

fail_if '^packages/controls-engine/src/(sod|controls|scoring/weights)' \
  'packages/controls-engine/src/version.ts' \
  "Control rulebook / weights"

echo "version stamps ok"
