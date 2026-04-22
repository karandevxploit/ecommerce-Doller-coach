#!/bin/bash

set -euo pipefail

# ================= CONFIG =================
ENV="${ENV:-staging}"  # staging | production
BASE_URL="${BASE_URL:-http://localhost:8001}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
RESULTS_DIR="/tmp/failure-drills-$(date +%s)"
LOG_FILE="/var/log/failure-drills.log"

mkdir -p "$RESULTS_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ================= SAFETY GUARD =================
if [[ "$ENV" == "production" ]]; then
  log "❌ BLOCKED: Cannot run failure drills in production"
  exit 1
fi

# ================= CLEANUP TRAP =================
cleanup() {
  log "Restoring system state..."
  # add restore hooks here if needed
}
trap cleanup EXIT

# ================= CURL WRAPPER =================
request() {
  local endpoint="$1"

  curl -s -o /dev/null -w "%{http_code}|%{time_total}" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    --max-time 5 \
    "$BASE_URL$endpoint"
}

# ================= TEST =================
test_endpoint() {
  local endpoint="$1"
  local expected="$2"

  for i in {1..3}; do
    res=$(request "$endpoint" || echo "000|0")
    code="${res%%|*}"
    time="${res##*|}"

    if [[ "$code" == "$expected" ]]; then
      log "✅ $endpoint ($code ${time}s)"
      return 0
    fi

    sleep 1
  done

  log "❌ $endpoint failed (expected $expected)"
  return 1
}

# ================= SAFE FAILURE SIMULATION =================
simulate_failure() {
  local scenario="$1"

  log "Simulating: $scenario"

  case "$scenario" in
    "redis-down")
      # Instead of stopping Redis → simulate via env toggle
      export REDIS_SIMULATE_DOWN=true
      ;;
    "mongodb-down")
      export DB_SIMULATE_DOWN=true
      ;;
    *)
      log "Unknown scenario"
      ;;
  esac
}

restore() {
  unset REDIS_SIMULATE_DOWN
  unset DB_SIMULATE_DOWN
}

# ================= DRILL =================
run_drill() {
  local scenario="$1"

  log "=== DRILL: $scenario ==="

  # baseline
  test_endpoint "/api/health" "200"

  simulate_failure "$scenario"

  # during failure
  test_endpoint "/api/health" "200"
  test_endpoint "/api/health/deep" "503"

  restore

  sleep 3

  # recovery
  test_endpoint "/api/health" "200"

  log "=== DONE: $scenario ==="
}

# ================= EXECUTION =================
log "Starting Failure Drills"

run_drill "redis-down"
run_drill "mongodb-down"

log "Completed"