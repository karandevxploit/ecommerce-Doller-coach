#!/bin/bash
set -euo pipefail

# ================= CONFIG =================
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/redis}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
S3_BUCKET="${S3_BUCKET:-}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-changeme}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="redis_${TIMESTAMP}"
LOG_FILE="/var/log/redis-backup.log"
LOCK_FILE="/tmp/redis_backup.lock"

# ================= LOCK =================
if [[ -f "$LOCK_FILE" ]]; then
  echo "Backup already running. Exiting."
  exit 1
fi
trap 'rm -f "$LOCK_FILE"' EXIT
touch "$LOCK_FILE"

# ================= LOG =================
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ================= PRECHECK =================
mkdir -p "$BACKUP_DIR"

AVAILABLE_SPACE=$(df "$BACKUP_DIR" | awk 'NR==2 {print $4}')
if [[ $AVAILABLE_SPACE -lt 524288 ]]; then
  log "ERROR: Not enough disk space"
  exit 1
fi

# Use REDISCLI_AUTH (secure)
export REDISCLI_AUTH="$REDIS_PASSWORD"

REDIS_CMD="redis-cli -h $REDIS_HOST -p $REDIS_PORT"

log "Starting Redis backup..."

# ================= BGSAVE =================
START_TIME=$(date +%s)

$REDIS_CMD BGSAVE

# Wait with timeout
TIMEOUT=60
while true; do
  STATUS=$($REDIS_CMD INFO persistence | grep rdb_bgsave_in_progress)

  if [[ "$STATUS" == *":0" ]]; then
    log "BGSAVE completed"
    break
  fi

  NOW=$(date +%s)
  if (( NOW - START_TIME > TIMEOUT )); then
    log "ERROR: BGSAVE timeout"
    exit 1
  fi

  sleep 2
done

# ================= COPY =================
RDB_DIR=$($REDIS_CMD CONFIG GET dir | tail -n1)
RDB_FILE=$($REDIS_CMD CONFIG GET dbfilename | tail -n1)

cp "$RDB_DIR/$RDB_FILE" "$BACKUP_DIR/$BACKUP_NAME.rdb"

# ================= CHECKSUM =================
CHECKSUM=$(sha256sum "$BACKUP_DIR/$BACKUP_NAME.rdb" | awk '{print $1}')
log "Checksum: $CHECKSUM"

# ================= ENCRYPT =================
openssl enc -aes-256-cbc \
  -salt \
  -in "$BACKUP_DIR/$BACKUP_NAME.rdb" \
  -out "$BACKUP_DIR/$BACKUP_NAME.enc" \
  -k "$ENCRYPTION_KEY"

rm -f "$BACKUP_DIR/$BACKUP_NAME.rdb"

# ================= VERIFY =================
if [[ ! -s "$BACKUP_DIR/$BACKUP_NAME.enc" ]]; then
  log "ERROR: Backup failed"
  exit 1
fi

SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME.enc" | cut -f1)
log "Backup created: $BACKUP_NAME.enc ($SIZE)"

# ================= S3 =================
if [[ -n "$S3_BUCKET" ]]; then
  log "Uploading to S3..."

  aws s3 cp "$BACKUP_DIR/$BACKUP_NAME.enc" \
    "s3://$S3_BUCKET/redis/" \
    --sse AES256 \
    --storage-class STANDARD_IA

  log "Upload complete"
fi

# ================= CLEANUP =================
find "$BACKUP_DIR" -name "*.enc" -mtime +$RETENTION_DAYS -delete

if [[ -n "$S3_BUCKET" ]]; then
  aws s3api list-objects-v2 \
    --bucket "$S3_BUCKET" \
    --prefix "redis/" \
    --query "Contents[?LastModified<='$(date -d "$RETENTION_DAYS days ago" --iso-8601=seconds)'].Key" \
    --output text | while read -r key; do

      [[ -n "$key" ]] && aws s3 rm "s3://$S3_BUCKET/$key"
    done
fi

log "Backup completed successfully"