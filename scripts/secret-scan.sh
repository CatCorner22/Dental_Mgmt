#!/usr/bin/env bash
# Cheap secret scan for committed files. Does not replace a vendor scanner.
set -euo pipefail
cd "$(dirname "$0")/.."

# Ignore vendored axe, prototype fixtures, and lockfiles.
hits=$(git grep -nE \
  'PREVIEW_CLIENT_SECRET\s*=|AKIA[0-9A-Z]{16}|BEGIN (RSA |OPENSSH )?PRIVATE KEY|xai-[A-Za-z0-9]{20,}' \
  -- ':!*.lock' ':!package-lock.json' ':!scripts/vendor/**' ':!knowledge/**' ':!scripts/secret-scan.sh' || true)

if [[ -n "$hits" ]]; then
  echo "::error::Secret scan matched committed text:"
  echo "$hits"
  exit 1
fi

echo "secret scan ok"
