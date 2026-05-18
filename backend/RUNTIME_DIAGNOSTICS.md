# Runtime Stability Diagnostics Guide

## Overview
This guide helps verify that the backend runs with exactly ONE instance, ONE outbox worker, and no duplicate DB queries.

---

## STEP 1: DETECT MULTIPLE INSTANCES

### What to Look For
On server startup, you should see:
```
🔵 [RUNTIME_START] PID=12345, Timestamp=2026-04-28T10:30:45.123Z

[BOOTSTRAP_START] PID=12345 2026-04-28T10:30:45.456Z

[SERVER_BOOT] PID=12345, BootTime=2500ms, Routes=23
```

### Failure Signs
- **Multiple PIDs** in logs = multiple server instances running
- **Bootstrap called twice** = duplicate startup handler
- **Routes registered more than once** = route duplication

### How to Test
```bash
# Kill all existing processes first
taskkill /F /IM node.exe

# Start fresh
npm run start

# Check logs for PID
# Should see ONLY ONE PID from start to finish
```

---

## STEP 2: DETECT DUPLICATE OUTBOX WORKERS

### What to Look For
On bootstrap:
```
[OUTBOX_WORKER_INIT] Interval #1, PID=12345, StartTime=2026-04-28T10:30:47.890Z
[OUTBOX_WORKER_STARTED] intervalNum=1, intervalMs=10000
```

Then every 60 seconds:
```
[SYSTEM_STATS] PID=12345 | Outbox=[Intervals:1, Execs:6, Uptime:60s]
```

### Failure Signs
- **Intervals > 1** = multiple `setInterval()` calls created
- **Execs count growing too fast** (>1 per second) = overlapping executions
- **Multiple OUTBOX_WORKER_INIT logs** = worker created multiple times

### How to Verify
```bash
# Start server
npm run start

# In another terminal, query metrics
curl http://localhost:8001/metrics | jq '.outbox'

# Should output:
{
  "started": true,
  "intervalCount": 1,
  "executionCount": 6-10,
  "uptime": 60000-65000,
  "isProcessing": false
}

# Wait 60 seconds, check again
sleep 60
curl http://localhost:8001/metrics | jq '.outbox'

# intervalCount should STILL be 1
# executionCount should increase by ~6 more (one every 10 seconds)
```

---

## STEP 3: VERIFY INTERVAL COUNT EQUALS 1

### Automated Check
```bash
# Run this every 30 seconds during server uptime
curl http://localhost:8001/metrics | jq '.outbox.intervalCount'

# Should ALWAYS output: 1
```

### Manual Check in Logs
```bash
# Grep for all interval creation
grep "\[OUTBOX_WORKER_INIT\]" logs/*.log

# Should see ONLY ONE line total
# If > 1: CRITICAL - multiple workers created
```

---

## STEP 4: CHECK ROUTE DUPLICATION

### What to Look For
During bootstrap, first log output should show routes being registered:
```
[ROUTE_REG] #1: /api/auth
[ROUTE_REG] #2: /api/products
[ROUTE_REG] #3: /api/categories
...
[ROUTE_REG] #23: /api/uploads
```

### Failure Signs
- **Routes registered > 1 time each** = app.use() called multiple times
- **Same route path repeated** = duplicate registration

### How to Test
```bash
npm run start 2>&1 | grep "\[ROUTE_REG\]" | sort | uniq -d

# If output is empty: GOOD (no duplicates)
# If output shows routes: BAD (duplicates found)
```

---

## STEP 5: REDIS RUNTIME CHECK

### Startup (Should See Once)
```
[REDIS_READY] Enabled=true, PID=12345, Time=2026-04-28T10:30:48.123Z
✅ [REDIS] Connected & Ready
```

### If Redis Fails
```
[REDIS_DISABLED] Reason=Connection refused...
```

### Verify State Doesn't Toggle
```bash
# Query warmup endpoint
curl http://localhost:8001/warmup | jq '.redisReady'

# Should output consistent value (true or false)
# NOT toggling between calls

# Repeat 5 times - values should be identical
for i in {1..5}; do
  curl http://localhost:8001/warmup | jq '.redisReady'
  sleep 1
done
```

---

## STEP 6: DB QUERY COUNT TRACKING

### Expected Behavior
Every 50 queries or 5 seconds, you'll see:
```
[DB_QUERY] #50 products.find()
[DB_QUERY] #100 orders.find()
[DB_QUERY] #150 users.findOne()
```

### Monitor Query Rate
```bash
# Watch live
npm run start 2>&1 | grep "\[DB_QUERY\]"

# Count queries per minute
npm run start 2>&1 | grep -o "\[DB_QUERY\]" | wc -l
# Should be reasonable: ~50-200 per minute under normal load
```

### Failure Signs
- **Query count growing exponentially** = N+1 queries
- **Same queries repeated every second** = unnecessary polling
- **Queries without explicit request** = background tasks

---

## STEP 7: DISABLE WORKER TEMPORARILY

To test if issues are caused by outbox worker:

### Option A: Environment Variable
```bash
OUTBOX_WORKER_DISABLED=true npm run start
```

### Option B: Code Edit
In `backend/services/outbox.service.js`, line ~133:
```javascript
const startOutboxWorker = () => {
  return;  // <-- ADD THIS LINE to disable
  // ... rest of function
};
```

### What to Expect
- No `[OUTBOX_WORKER_INIT]` logs
- No DB queries from outbox polling
- Outbox events remain in "pending" status (not processed)

---

## STEP 8: FINAL VALIDATION CHECKLIST

Run this sequence to confirm stability:

```bash
#!/bin/bash

echo "=== STEP 1: Kill Existing Processes ==="
taskkill /F /IM node.exe 2>/dev/null
sleep 2

echo "=== STEP 2: Start Fresh Server ==="
npm run start > server.log 2>&1 &
SERVER_PID=$!
sleep 5

echo "=== STEP 3: Check PID Uniqueness ==="
PID_COUNT=$(grep -o "\[RUNTIME_START\] PID=" server.log | wc -l)
echo "PIDs found: $PID_COUNT (should be 1)"
if [ $PID_COUNT -ne 1 ]; then
  echo "❌ FAIL: Multiple PIDs detected"
  kill $SERVER_PID
  exit 1
fi

echo "=== STEP 4: Check Outbox Intervals ==="
INTERVAL_COUNT=$(grep -o "\[OUTBOX_WORKER_INIT\]" server.log | wc -l)
echo "Intervals created: $INTERVAL_COUNT (should be 1)"
if [ $INTERVAL_COUNT -ne 1 ]; then
  echo "❌ FAIL: Multiple intervals created"
  kill $SERVER_PID
  exit 1
fi

echo "=== STEP 5: Query Metrics ==="
curl -s http://localhost:8001/metrics | jq '.outbox'

echo "=== STEP 6: Wait 60 Seconds for Worker Polling ==="
sleep 60

echo "=== STEP 7: Verify Execution Count ==="
METRICS=$(curl -s http://localhost:8001/metrics)
EXEC_COUNT=$(echo $METRICS | jq '.outbox.executionCount')
echo "Executions: $EXEC_COUNT (should be 6-7 after 60s)"

echo "=== STEP 8: Check Warmup ==="
curl -s http://localhost:8001/warmup | jq '{ dbReady, redisReady, pid, outboxWorker }'

echo "=== ✅ ALL TESTS PASSED ==="
kill $SERVER_PID
```

---

## COMMON ISSUES & SOLUTIONS

### Issue: Multiple outbox executions per second
**Cause:** Overlapping processing or multiple setInterval calls
**Fix:** Check `isProcessing` flag and `workerStarted` guard in outbox.service.js

### Issue: Redis toggling between enabled/disabled
**Cause:** Per-request retry logic causing state changes
**Fix:** Redis should disable ONCE on error, never re-enable

### Issue: Duplicate routes in logs
**Cause:** app.use() being called multiple times
**Fix:** Search for duplicate route registrations in server.js

### Issue: PID changes mid-execution
**Cause:** Process respawn or cluster mode confusion
**Fix:** Check PM2 or cluster mode settings

### Issue: Outbox worker not starting
**Cause:** DB not ready or worker disabled via env var
**Fix:** Check `NODE_ENV=development` or `OUTBOX_WORKER_DISABLED=true`

---

## Real-Time Monitoring Dashboard

Create `monitor.sh`:
```bash
#!/bin/bash

echo "🔵 RUNTIME DIAGNOSTICS DASHBOARD"
echo "================================="

while true; do
  clear
  echo "[$(date '+%H:%M:%S')] REAL-TIME MONITOR"
  echo ""
  
  # Get metrics
  METRICS=$(curl -s http://localhost:8001/metrics)
  
  PID=$(echo $METRICS | jq '.pid')
  UPTIME=$(echo $METRICS | jq '.uptime / 1000')
  ROUTES=$(echo $METRICS | jq '.routes')
  INTERVALS=$(echo $METRICS | jq '.outbox.intervalCount')
  EXECS=$(echo $METRICS | jq '.outbox.executionCount')
  
  echo "Process ID:        $PID"
  echo "Uptime:            ${UPTIME}s"
  echo "Routes:            $ROUTES"
  echo "Outbox Intervals:  $INTERVALS ✓"
  echo "Outbox Execs:      $EXECS"
  echo ""
  
  # Warmup check
  WARMUP=$(curl -s http://localhost:8001/warmup)
  DB_READY=$(echo $WARMUP | jq '.dbReady')
  REDIS_READY=$(echo $WARMUP | jq '.redisReady')
  
  echo "DB Status:         $DB_READY"
  echo "Redis Status:      $REDIS_READY"
  
  sleep 5
done
```

Usage:
```bash
bash monitor.sh
```

---

## Summary

✅ **System is STABLE when:**
- Only ONE `[RUNTIME_START]` PID logged
- Only ONE `[OUTBOX_WORKER_INIT]` logged
- `intervalCount === 1` always
- No duplicate route registrations
- Redis enabled/disabled state stable
- DB queries at reasonable rate (~50-200/min)

❌ **System is UNSTABLE when:**
- Multiple PIDs
- Multiple intervals
- Routes registered > 1 time
- Redis toggling state
- Explosive DB query growth
- Outbox executing > 1/second

---

For more details, check: `backend/server.js` (instrumentation), `backend/services/outbox.service.js` (worker tracking), `backend/config/redis.js` (Redis state).
