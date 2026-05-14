#!/usr/bin/env bash
set -euo pipefail
# WARNING: This script destroys all local database data (removes Docker volumes).
# Run only when you want a completely clean slate.

echo "Stopping containers and removing volumes..."
docker compose down -v
echo "Starting fresh containers..."
docker compose up -d --wait
echo "Done. Local database is fresh."
