#!/usr/bin/env bash
# Boots the backend for the Playwright e2e suite and the k6 gate (CLN-017).
#
# Needs Postgres + Redis from docker/e2e/docker-compose.yml and a built backend
# (`pnpm turbo run build --filter=@power-budget/backend`). Same boot as the image
# (migrate, then the API), plus the least-privilege app role and the system
# category catalogue that `pnpm db:roles` / `pnpm db:seed` add on a fresh setup.
# The API runs with the embedded worker, so invite emails really go out, to the
# fake Resend API (packages/web/e2e/support/fake-resend.mjs). Test-only secrets.
set -euo pipefail

cd "$(dirname "$0")/../packages/backend"

export NODE_ENV=test
export PORT="${E2E_API_PORT:-3100}"
export MIGRATION_DATABASE_URL="${E2E_MIGRATION_DATABASE_URL:-postgres://power_budget:power_budget@localhost:55432/power_budget}"
export APP_DB_USER="${E2E_APP_DB_USER:-pb_app_e2e}"
export APP_DB_PASSWORD="${E2E_APP_DB_PASSWORD:-pb_app_e2e}"
export DATABASE_URL="postgres://${APP_DB_USER}:${APP_DB_PASSWORD}@localhost:55432/power_budget"
export REDIS_URL="${E2E_REDIS_URL:-redis://localhost:56379}"
export JWT_SECRET='e2e-only-jwt-secret-0123456789-abcdefghijklmnopqrstuvwxyz'
export KEK_BASE64='BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc='
export CORS_ORIGINS="${E2E_WEB_URL:-http://localhost:4173}"
export APP_BASE_URL="${E2E_WEB_URL:-http://localhost:4173}"
export START_WORKER=true
export RESEND_API_KEY=re_e2e_fake_key
export RESEND_BASE_URL="${E2E_FAKE_RESEND_URL:-http://localhost:3901}"
# Fixture calls spread over client addresses (X-Forwarded-For) so the per-IP auth
# rate limit does not trip on one machine; see e2e/support/api.ts.
export TRUST_PROXY=true

node drizzle/migrate.mjs
node drizzle/roles.mjs
DATABASE_URL="$MIGRATION_DATABASE_URL" pnpm exec tsx drizzle/seed/0001_seed_categories.ts
exec node dist/src/main.js
