#!/usr/bin/env bash
# Fails when schema.ts, the migration journal and the snapshots disagree, i.e.
# when `drizzle-kit generate` would create a new migration. Run from packages/backend.
set -euo pipefail

MIGRATIONS=drizzle/migrations

fingerprint() {
  find "$MIGRATIONS" -type f | LC_ALL=C sort | xargs shasum
}

pnpm exec drizzle-kit check

before="$(fingerprint)"
journal_backup="$(mktemp)"
cp "$MIGRATIONS/meta/_journal.json" "$journal_backup"
pnpm exec drizzle-kit generate --name=drift_check
after="$(fingerprint)"

if [ "$before" != "$after" ]; then
  echo "::error::Schema drift: drizzle-kit generate would create a migration. Run 'pnpm --filter @power-budget/backend db:generate' and commit the result." >&2
  diff <(echo "$before") <(echo "$after") >&2 || true
  # Restore the original state: drop new files, restore the journal.
  comm -13 <(echo "$before" | awk '{print $2}' | LC_ALL=C sort) <(find "$MIGRATIONS" -type f | LC_ALL=C sort) | xargs rm -f
  cp "$journal_backup" "$MIGRATIONS/meta/_journal.json"
  exit 1
fi

echo "No schema drift."
