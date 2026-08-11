#!/usr/bin/env bash
# Clerk OTP / verification emails use the Application name from the Clerk Dashboard,
# not the SellerLens website code. Run this after deploy to align Clerk branding.
set -euo pipefail

APP_NAME="${CLERK_APPLICATION_NAME:-Seller Lens}"

echo "==> Clerk branding should display: ${APP_NAME}"
echo ""
echo "1. Open https://dashboard.clerk.com"
echo "2. Select your SellerLens application"
echo "3. Go to Configure → Settings"
echo "4. Set Application name to: ${APP_NAME}"
echo "5. Under Branding, upload your Seller Lens logo (optional)"
echo "6. Go to Configure → Email → Verification code template"
echo "   Replace any 'Listing Auditor' text with ${APP_NAME}"
echo ""
echo "After saving, request a new sign-in code — the email should show ${APP_NAME}."

if [[ -n "${CLERK_SECRET_KEY:-}" ]]; then
  echo ""
  echo "Clerk instance reachable: $(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${CLERK_SECRET_KEY}" https://api.clerk.com/v1/instance)"
fi
