#!/usr/bin/env bash
set -euo pipefail

# Power Budget Dashboard SLI Runner
# Usage: ./tests/perf/run-sli.sh [--seed] [--base-url URL] [--plan-id ID]

SEED=false
BASE_URL="${K6_BASE_URL:-http://localhost:3000}"
PLAN_ID="${K6_PLAN_ID:-}"
AUTH_TOKEN="${K6_AUTH_TOKEN:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --seed)
      SEED=true
      shift
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --plan-id)
      PLAN_ID="$2"
      shift 2
      ;;
    --auth-token)
      AUTH_TOKEN="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "=== Power Budget Dashboard SLI Test ==="
echo "Base URL: ${BASE_URL}"
echo "Plan ID: ${PLAN_ID:-<not set, using default>}"
echo ""

# Step 1: Seed fixture if requested
if [[ "${SEED}" == "true" ]]; then
  echo ">>> Seeding perf fixture..."
  cd "${ROOT_DIR}"
  pnpm -F @power-budget/backend db:seed:perf
  echo ">>> Fixture seeded."
  echo ""
fi

# Step 2: Check k6 is installed
if ! command -v k6 &> /dev/null; then
  echo "ERROR: k6 is not installed."
  echo "Install with: brew install k6 (macOS) or see https://k6.io/docs/get-started/installation/"
  exit 1
fi

# Step 3: Run k6
echo ">>> Running k6 load test..."
k6 run \
  -e K6_BASE_URL="${BASE_URL}" \
  -e K6_PLAN_ID="${PLAN_ID}" \
  -e K6_AUTH_TOKEN="${AUTH_TOKEN}" \
  --out json="${SCRIPT_DIR}/results-$(date +%Y%m%d-%H%M%S).json" \
  "${SCRIPT_DIR}/dashboard.k6.js"

echo ""
echo "=== SLI test complete ==="
