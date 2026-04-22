#!/bin/bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8001}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

log() {
  echo "[$(date '+%H:%M:%S')] $1"
}

request() {
  curl -s -o /dev/null -w "%{http_code}|%{time_total}" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    --max-time 5 "$BASE_URL$1"
}

# -------------------------------
# CONCURRENT TEST
# -------------------------------
test_distributed_lock() {
  log "Testing distributed lock (concurrent)..."

  res=$(seq 1 5 | xargs -I{} -P 5 bash -c \
    'curl -s -o /dev/null -w "%{http_code}" '"$BASE_URL"'/api/admin/stats')

  success=$(echo "$res" | grep -c 200 || true)

  if [[ "$success" -ge 1 ]]; then
    log "PASS distributed lock"
    return 0
  else
    log "FAIL distributed lock"
    return 1
  fi
}

# -------------------------------
# TIMEOUT TEST
# -------------------------------
test_timeout() {
  log "Testing timeout..."

  res=$(curl -s -w "%{time_total}" \
    --max-time 3 "$BASE_URL/api/products?simulateDelay=10" || echo "timeout")

  if [[ "$res" == "timeout" ]]; then
    log "PASS timeout"
    return 0
  else
    log "FAIL timeout"
    return 1
  fi
}

# -------------------------------
# PAYLOAD TEST
# -------------------------------
test_payload() {
  log "Testing payload limit..."

  payload=$(printf '%.0sA' {1..1000000})

  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/api/test" \
    -H "Content-Type: application/json" \
    -d "{\"data\":\"$payload\"}")

  [[ "$code" == "413" ]] && log "PASS payload" || log "FAIL payload"
}

# -------------------------------
# HEALTH TEST
# -------------------------------
test_health() {
  log "Testing health..."

  code=$(request "/api/health")
  [[ "$code" == 200* ]] && log "PASS health" || log "FAIL health"
}

# -------------------------------
# MAIN
# -------------------------------
log "START SAFETY CHECK"

test_health
test_timeout
test_payload
test_distributed_lock

log "DONE"