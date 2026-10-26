#!/usr/bin/env bash
# Runs the `visual` Playwright project inside the Playwright docker image pinned to the repo's
# @playwright/test version, so baselines match CI (Linux, same fonts and Chromium).
# Usage: run-in-docker.sh [extra playwright args, e.g. --update-snapshots]
set -euo pipefail

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO_ROOT="$(cd "$WEB_DIR/../.." && pwd)"
VERSION="$(cd "$WEB_DIR" && node -p "require('@playwright/test/package.json').version")"
IMAGE="mcr.microsoft.com/playwright:v${VERSION}-noble"

# The gallery is built on the host (platform independent output); the image only renders it.
(cd "$WEB_DIR" && pnpm run build:gallery)

docker run --rm --init --ipc=host --platform linux/amd64 \
  -v "$REPO_ROOT:/work" -w /work/packages/web \
  -e CI="${CI:-}" -e PW_VISUAL=1 -e VISUAL_STATIC=1 \
  "$IMAGE" \
  node_modules/.bin/playwright test --project=visual "$@"
