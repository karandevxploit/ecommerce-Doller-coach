#!/bin/bash

set -euo pipefail

DB_NAME="${DB_NAME:-ecommerce-prod}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-27017}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mongodb}"

TEST_DB_NAME="${DB_NAME}_restore_test_$(date +%s)"
TEMP_DIR="/tmp/mongo_restore_test_$(date +%s)"

log() {
  echo "[$(date '+%F %T')] $1"
}

retry() {
  local retries=3
  local count=0
  until "$@"; do
    exit_code=$?
    count=$((count+1))
    if [ $count -lt $retries ]; then
      log "Retry $count/$retries..."
      sleep 2
    else
      return $exit_code
    fi
  done
}

log "🚀 Restore Test Started"

LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.tar.gz | head -1)
[[ -z "$LATEST_BACKUP" ]] && { log "No backup found"; exit 1; }

log "Using backup: $LATEST_BACKUP"

mkdir -p "$TEMP_DIR"
tar -xzf "$LATEST_BACKUP" -C "$TEMP_DIR"

BACKUP_DB_DIR=$(find "$TEMP_DIR" -type d -name "$DB_NAME" | head -1)
[[ -z "$BACKUP_DB_DIR" ]] && { log "DB folder missing"; exit 1; }

log "Restoring to test DB: $TEST_DB_NAME"

retry mongorestore \
  --host "$DB_HOST" \
  --port "$DB_PORT" \
  --nsFrom "$DB_NAME.*" \
  --nsTo "$TEST_DB_NAME.*" \
  "$BACKUP_DB_DIR"

log "🔍 Validating restore..."

COLLECTIONS=$(mongosh --quiet --eval \
"db.getSiblingDB('$TEST_DB_NAME').getCollectionNames().length")

if [[ "$COLLECTIONS" -eq 0 ]]; then
  log "❌ No collections found"
  exit 1
fi

log "Collections found: $COLLECTIONS"

TOTAL_DOCS=$(mongosh --quiet --eval "
db = db.getSiblingDB('$TEST_DB_NAME');
let total=0;
db.getCollectionNames().forEach(c=>{
  total += db[c].countDocuments();
});
print(total);
")

if [[ "$TOTAL_DOCS" -eq 0 ]]; then
  log "❌ No documents found"
  exit 1
fi

log "Documents count: $TOTAL_DOCS"

# Index validation
INDEX_COUNT=$(mongosh --quiet --eval "
db = db.getSiblingDB('$TEST_DB_NAME');
let count=0;
db.getCollectionNames().forEach(c=>{
  count += db[c].getIndexes().length;
});
print(count);
")

log "Indexes found: $INDEX_COUNT"

if [[ "$INDEX_COUNT" -eq 0 ]]; then
  log "⚠️ WARNING: No indexes restored"
fi

# Cleanup
log "🧹 Cleaning test DB"
mongosh --quiet --eval "db.getSiblingDB('$TEST_DB_NAME').dropDatabase()"

rm -rf "$TEMP_DIR"

log "✅ RESTORE TEST SUCCESS"