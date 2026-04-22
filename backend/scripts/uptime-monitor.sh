#!/bin/bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8001}"
HEALTH_ENDPOINT="/api/health"
TIMEOUT=5
CHECK_INTERVAL=30

FAILURE_COUNT=0
MAX_FAILURES=3
LAST_ALERT_TIME=0
ALERT_COOLDOWN=300

log() {
  echo "[$(date '+%F %T')] $1"
}

send_alert() {
  local msg="$1"
  local now=$(date +%s)

  if (( now - LAST_ALERT_TIME < ALERT_COOLDOWN )); then
    return
  fi

  LAST_ALERT_TIME=$now
  log "🚨 ALERT: $msg"
}

check_health() {
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time $TIMEOUT "$BASE_URL$HEALTH_ENDPOINT" || echo 000)

  if [[ "$status" == "200" ]]; then
    return 0
  else
    return 1
  fi
}

log "🚀 Monitoring started..."

while true; do
  if check_health; then
    log "✅ HEALTH OK"
    FAILURE_COUNT=0
  else
    FAILURE_COUNT=$((FAILURE_COUNT+1))
    log "❌ FAILURE #$FAILURE_COUNT"

    if [[ $FAILURE_COUNT -ge $MAX_FAILURES ]]; then
      send_alert "Service DOWN ($FAILURE_COUNT failures)"
    fi
  fi

  sleep $CHECK_INTERVAL
done