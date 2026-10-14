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

deploy_load_env() {
  if [[ -f "$APP_DIR/.env" ]]; then
    echo "==> Loading $APP_DIR/.env for this deploy (build + PM2 --update-env)"
    set -a
    # shellcheck disable=SC1091
    source "$APP_DIR/.env"
    set +a
  else
    echo "WARN: No $APP_DIR/.env — using existing shell/PM2 environment only"
  fi
}

deploy_load_env

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
if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm is not installed on this server." >&2
  echo "       Run: npm install -g pnpm@10   (or: corepack enable && corepack prepare pnpm@10.33.3 --activate)" >&2
  exit 1
fi
PNPM_VERSION="$(pnpm --version)"
echo "pnpm version: $PNPM_VERSION"
# Some hosts run lifecycle scripts without a pnpm/* user-agent; preinstall accepts npm_execpath too.
export npm_config_user_agent="pnpm/${PNPM_VERSION}"
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
echo "    VITE_AUTH_PROVIDER=${VITE_AUTH_PROVIDER:-<unset> (Clerk UI)}"
echo "    NATIVE_AUTH_ENABLED=${NATIVE_AUTH_ENABLED:-<unset>}"

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

if [[ "${VITE_AUTH_PROVIDER:-}" == "native" ]]; then
  if ! grep -R -q 'VITE_AUTH_PROVIDER' "$DIST_DIR/assets" --exclude='*.map' 2>/dev/null \
    && ! grep -R -q 'native-clerk-shim' "$DIST_DIR/assets" --exclude='*.map' 2>/dev/null; then
    echo "WARN: Native auth build — could not confirm shim in assets (continuing)."
  fi
else
  if ! grep -R -qE 'pk_(test|live)_[A-Za-z0-9_-]{20,}' \
    "$DIST_DIR/assets" \
    --exclude='*.map'; then
    echo "ERROR: Clerk publishable key was not found in frontend build."
    exit 1
  fi
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
echo "==> Restarting backend (PM2 --update-env from loaded .env)..."
deploy_load_env
pm2 restart "$API_PM2_NAME" --update-env

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

AUTH_CONFIG="$(curl -s https://test.sellerlens.io/api/auth/config || true)"
echo "Auth config: $AUTH_CONFIG"
if [[ "${NATIVE_AUTH_ENABLED:-}" == "true" ]]; then
  if [[ "$AUTH_CONFIG" != *'"enabled":true'* && "$AUTH_CONFIG" != *'"enabled": true'* ]]; then
    echo "ERROR: NATIVE_AUTH_ENABLED=true in .env but /api/auth/config reports enabled:false."
    echo "       PM2 may not have received env vars. Run: pm2 show $API_PM2_NAME"
    echo "       Or recreate process: set -a && source .env && set +a && pm2 restart $API_PM2_NAME --update-env"
    exit 1
  fi
fi

echo
echo "=========================================="
echo " Deployment completed successfully"
echo " Branch: $BRANCH"
echo " Commit: $(git rev-parse --short HEAD)"
echo "=========================================="
