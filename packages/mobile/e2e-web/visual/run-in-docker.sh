#!/usr/bin/env bash
# Runs the mobile gallery's Playwright project inside the Playwright docker image pinned to the
# repo's @playwright/test version, so baselines match CI (Linux, same fonts and Chromium).
# Usage: run-in-docker.sh [extra playwright args, e.g. --update-snapshots]
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO_ROOT="$(cd "$MOBILE_DIR/../.." && pwd)"
VERSION="$(cd "$MOBILE_DIR" && node -p "require('@playwright/test/package.json').version")"
IMAGE="mcr.microsoft.com/playwright:v${VERSION}-noble"

# The gallery is exported on the host (platform independent output); the image only renders it.
(cd "$MOBILE_DIR" && pnpm run build:gallery)

docker run --rm --init --ipc=host --platform linux/amd64 \
  -v "$REPO_ROOT:/work" -w /work/packages/mobile/e2e-web \
  -e CI="${CI:-}" \
  "$IMAGE" \
  ../node_modules/.bin/playwright test --project=visual "$@"
