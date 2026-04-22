#!/bin/bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8001}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

LOG_FILE="/var/log/alert-test.log"
mkdir -p "$(dirname "$LOG_FILE")"

SUCCESS_COUNT=0
FAIL_COUNT=0

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_response() {
    if [[ "$1" -ge 200 && "$1" -lt 300 ]]; then
        ((SUCCESS_COUNT++))
    else
        ((FAIL_COUNT++))
        log "❌ Failed with status $1"
    fi
}

retry_curl() {
    local url=$1
    local data=$2

    for i in {1..3}; do
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" \
            --max-time 5 || echo 500)

        if [[ "$STATUS" -lt 400 ]]; then
            echo "$STATUS"
            return
        fi

        sleep 1
    done

    echo "$STATUS"
}

test_email_alert() {
    if [[ -n "$ALERT_EMAIL" ]]; then
        log "📧 Testing email alert..."
        if echo "Test alert" | mail -s "TEST ALERT" "$ALERT_EMAIL"; then
            ((SUCCESS_COUNT++))
        else
            ((FAIL_COUNT++))
        fi
    fi
}

test_webhook_alert() {
    if [[ -n "$ALERT_WEBHOOK" ]]; then
        log "🌐 Testing webhook..."
        STATUS=$(retry_curl "$ALERT_WEBHOOK" '{"message":"TEST ALERT"}')
        check_response "$STATUS"
    fi
}

test_slack_alert() {
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        log "💬 Testing Slack..."
        STATUS=$(retry_curl "$SLACK_WEBHOOK" '{"text":"TEST ALERT"}')
        check_response "$STATUS"
    fi
}

test_error_monitoring() {
    log "🔥 Triggering error spike..."

    for i in {1..20}; do
        curl -s "$BASE_URL/api/nonexistent" >/dev/null &
    done

    wait
    log "Error spike completed"
}

health_check() {
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
    if [[ "$STATUS" -ne 200 ]]; then
        log "❌ Backend unhealthy"
        exit 1
    fi
}

summary() {
    log "=========================="
    log "SUCCESS: $SUCCESS_COUNT"
    log "FAIL: $FAIL_COUNT"

    if [[ "$FAIL_COUNT" -eq 0 ]]; then
        log "✅ ALL ALERT TESTS PASSED"
    else
        log "❌ SOME TESTS FAILED"
    fi
}

log "🚀 ALERT VALIDATION STARTED"

health_check

# Run tests in parallel
test_email_alert &
test_webhook_alert &
test_slack_alert &

wait

test_error_monitoring

summary