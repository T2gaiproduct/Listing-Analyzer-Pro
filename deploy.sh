#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/root/Listing-Analyzer-Pro"
FRONTEND_DIR="/var/www/sellerlens"
API_PM2_NAME="listing-auditor-api"
BRANCH="${1:-staging}"

# Server-only runtime/migrated data — never delete or reset; allow during deploy.
DEPLOY_GIT_IGNORE_PREFIXES=(
  "artifacts/api-server/public/images/"
  "artifacts/api-server/public/images.before-old-server/"
  "public/"
  "ssh/"
)

cd "$APP_DIR"

echo "=========================================="
echo " SellerLens Deployment"
echo " Branch: $BRANCH"
echo "=========================================="
echo

deploy_git_path_is_ignored() {
  local path="$1"
  path="${path#\"}"
  path="${path%\"}"
  if [[ "$path" == "deploy.sh" ]]; then
    return 0
  fi
  local prefix
  for prefix in "${DEPLOY_GIT_IGNORE_PREFIXES[@]}"; do
    if [[ "$path" == "${prefix%/}" || "$path" == "$prefix"* ]]; then
      return 0
    fi
  done
  return 1
}

deploy_git_blocking_changes() {
  local line path blocking=""
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    path="${line:3}"
    if [[ "$path" == *" -> "* ]]; then
      path="${path##* -> }"
    fi
    if deploy_git_path_is_ignored "$path"; then
      continue
    fi
    blocking+="${line}"$'\n'
  done < <(git status --porcelain)
  printf '%s' "$blocking"
}

echo "==> Checking Git working tree (ignoring migrated runtime paths)..."
BLOCKING_CHANGES="$(deploy_git_blocking_changes)"
if [[ -n "${BLOCKING_CHANGES//$'\n'/}" ]]; then
  echo "ERROR: Working tree has changes outside allowed runtime paths."
  echo "Commit/stash those changes before deploying."
  printf '%s' "$BLOCKING_CHANGES"
  exit 1
fi
if [[ -n "$(git status --porcelain)" && -z "${BLOCKING_CHANGES//$'\n'/}" ]]; then
  echo "Note: ignored local/runtime paths (images, public/, ssh/, deploy.sh)."
fi

echo
echo "==> Fetching latest code..."
git fetch origin

echo
echo "==> Switching to $BRANCH..."
git checkout "$BRANCH"

echo
echo "==> Pulling latest $BRANCH..."
git pull --ff-only origin "$BRANCH"

echo
echo "==> Current commit:"
git log -1 --oneline

echo
echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo
echo "==> Preparing Clerk frontend environment..."
if [[ -z "${VITE_CLERK_PUBLISHABLE_KEY:-}" ]] && [[ -f ".env.old" ]]; then
  export VITE_CLERK_PUBLISHABLE_KEY="$(grep '^VITE_CLERK_PUBLISHABLE_KEY=' .env.old | cut -d= -f2-)"
fi
unset VITE_CLERK_PROXY_URL

if [[ -z "${VITE_CLERK_PUBLISHABLE_KEY:-}" ]]; then
  echo "ERROR: VITE_CLERK_PUBLISHABLE_KEY is not set."
  exit 1
fi
echo "Clerk publishable key: configured"

echo
echo "==> Building application..."
pnpm build

echo
echo "==> Verifying frontend build..."
DIST_DIR="$APP_DIR/artifacts/listing-auditor/dist/public"
if [[ ! -f "$DIST_DIR/index.html" ]]; then
  echo "ERROR: Frontend build output not found."
  exit 1
fi

if ! grep -R -qE 'pk_(test|live)_[A-Za-z0-9_-]{20,}' \
  "$DIST_DIR/assets" \
  --exclude='*.map'; then
  echo "ERROR: Clerk publishable key was not found in frontend build."
  exit 1
fi
echo "Frontend build verified."

echo
echo "==> Creating frontend backup..."
BACKUP_DIR="/var/www/sellerlens.backup-$(date +%Y%m%d-%H%M%S)"
sudo cp -a "$FRONTEND_DIR" "$BACKUP_DIR"
echo "Backup: $BACKUP_DIR"

echo
echo "==> Deploying frontend..."
sudo cp -a "$DIST_DIR"/. "$FRONTEND_DIR"/
sudo chown -R www-data:www-data "$FRONTEND_DIR"

echo
echo "==> Restarting backend..."
pm2 restart "$API_PM2_NAME"

echo
echo "==> Reloading Nginx..."
sudo systemctl reload nginx

echo
echo "==> Checking frontend..."
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' https://test.sellerlens.io/)"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "ERROR: Frontend health check failed. HTTP $HTTP_CODE"
  exit 1
fi
echo "Frontend HTTP status: $HTTP_CODE"

echo
echo "==> Checking API..."
API_CODE="$(curl -s -o /dev/null -w '%{http_code}' https://test.sellerlens.io/api/healthz || true)"
echo "API HTTP status: $API_CODE"

echo
echo "=========================================="
echo " Deployment completed successfully"
echo " Branch: $BRANCH"
echo " Commit: $(git rev-parse --short HEAD)"
echo "=========================================="
