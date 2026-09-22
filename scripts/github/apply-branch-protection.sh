#!/usr/bin/env bash
# Apply SellerLens branch protection via GitHub API.
# Requires: gh CLI logged in as a user with **admin** on the repository
# (the Cloud Agent integration token cannot set branch protection).
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-T2gaiproduct/Listing-Analyzer-Pro}"
MAIN_BRANCH="${MAIN_BRANCH:-main}"
STAGING_BRANCH="${STAGING_BRANCH:-staging}"
# Job id from .github/workflows/ci.yml — GitHub UI may show "CI / typecheck"
REQUIRED_CHECK="${REQUIRED_CHECK:-typecheck}"

echo "Repository: ${REPO}"
echo "Required CI check: ${REQUIRED_CHECK}"

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: run 'gh auth login' with an account that has admin on ${REPO}" >&2
  exit 1
fi

perms=$(gh api "repos/${REPO}" --jq '.permissions.admin' 2>/dev/null || echo "false")
if [[ "$perms" != "true" ]]; then
  echo "Error: current gh user is not a repo admin. Ask an owner to run this script or use Settings → Rules." >&2
  echo "Manual steps: https://github.com/${REPO}/blob/staging/.github/BRANCHING.md" >&2
  exit 1
fi

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

cat > "${tmpdir}/main-protection.json" <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["${REQUIRED_CHECK}"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
EOF

cat > "${tmpdir}/staging-protection.json" <<EOF
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

echo "==> Protecting ${MAIN_BRANCH}"
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/${REPO}/branches/${MAIN_BRANCH}/protection" \
  --input "${tmpdir}/main-protection.json"

echo "==> Protecting ${STAGING_BRANCH}"
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/${REPO}/branches/${STAGING_BRANCH}/protection" \
  --input "${tmpdir}/staging-protection.json"

echo "Done. If merges are blocked, add status check 'CI / typecheck' in the ruleset UI if '${REQUIRED_CHECK}' does not match."
echo "Settings: https://github.com/${REPO}/settings/rules"
