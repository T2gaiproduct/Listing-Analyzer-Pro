#!/usr/bin/env bash
# Verify eBay OAuth env for staging (sandbox-first). Does not print secrets.
#
# Usage:
#   set -a && source .env && set +a
#   bash scripts/verify-ebay-oauth-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

default_env="${EBAY_OAUTH_DEFAULT_ENV:-sandbox}"
staging_only="${EBAY_STAGING_SANDBOX_ONLY:-}"
effective="sandbox"
if [[ "${staging_only,,}" == "true" || "${staging_only}" == "1" || "${staging_only,,}" == "yes" ]]; then
  effective="sandbox (forced by EBAY_STAGING_SANDBOX_ONLY)"
elif [[ "${default_env,,}" == "production" ]]; then
  effective="production"
else
  effective="sandbox"
fi

echo "==> eBay OAuth environment check"
echo "    EBAY_OAUTH_DEFAULT_ENV=${default_env}"
echo "    EBAY_STAGING_SANDBOX_ONLY=${staging_only:-<unset>}"
echo "    Effective connect environment: ${effective}"

check_triplet() {
  local label="$1"
  local prefix="$2"
  local id_var="${prefix}_CLIENT_ID"
  local secret_var="${prefix}_CLIENT_SECRET"
  local runame_var="${prefix}_RUNAME"
  local id="${!id_var:-}"
  local secret="${!secret_var:-}"
  local runame="${!runame_var:-}"
  if [[ -n "$id" && -n "$secret" && -n "$runame" ]]; then
    echo "    ${label}: configured (Client ID prefix: ${id:0:20}…, RuName: ${runame})"
    return 0
  fi
  echo "    ${label}: NOT configured (need ${prefix}_CLIENT_ID, CLIENT_SECRET, RUNAME)"
  return 1
}

sandbox_ok=0
prod_ok=0
check_triplet "Sandbox" EBAY_SANDBOX && sandbox_ok=1 || true
check_triplet "Production" EBAY_PRODUCTION && prod_ok=1 || true

echo ""
if [[ "${effective}" == sandbox* ]]; then
  if [[ "$sandbox_ok" -eq 1 ]]; then
    echo "OK — staging/sandbox connect can work (auth.sandbox.ebay.com)."
    echo "    Ensure RuName Accept URL matches: https://<your-host>/api/ebay/oauth/callback"
    exit 0
  fi
  echo "FAIL — effective environment is sandbox but EBAY_SANDBOX_* is incomplete."
  exit 1
fi

if [[ "$prod_ok" -eq 1 ]]; then
  echo "OK — production OAuth env present (auth.ebay.com)."
  exit 0
fi
echo "FAIL — EBAY_OAUTH_DEFAULT_ENV=production but EBAY_PRODUCTION_* is incomplete."
exit 1
