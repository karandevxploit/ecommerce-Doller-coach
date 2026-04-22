#!/bin/bash
set -euo pipefail

# ================= CONFIG =================
DB_NAME="${DB_NAME:-ecommerce-prod}"
DB_URI="${DB_URI:-mongodb://localhost:27017}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mongodb}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
S3_BUCKET="${S3_BUCKET:-}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-changeme}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="${DB_NAME}_${TIMESTAMP}"
LOG_FILE="/var/log/mongodb-backup.log"
LOCK_FILE="/tmp/mongo_backup.lock"

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
if [[ $AVAILABLE_SPACE -lt 1048576 ]]; then
  log "ERROR: Not enough disk space"
  exit 1
fi

log "Starting backup for $DB_NAME"

# ================= BACKUP =================
mongodump \
  --uri="$DB_URI" \
  --db="$DB_NAME" \
  --archive="$BACKUP_DIR/${BACKUP_NAME}.archive" \
  --gzip

# ================= ENCRYPT =================
log "Encrypting backup..."
openssl enc -aes-256-cbc \
  -salt \
  -in "$BACKUP_DIR/${BACKUP_NAME}.archive" \
  -out "$BACKUP_DIR/${BACKUP_NAME}.enc" \
  -k "$ENCRYPTION_KEY"

rm -f "$BACKUP_DIR/${BACKUP_NAME}.archive"

# ================= VERIFY =================
if [[ ! -s "$BACKUP_DIR/${BACKUP_NAME}.enc" ]]; then
  log "ERROR: Backup failed"
  exit 1
fi

SIZE=$(du -h "$BACKUP_DIR/${BACKUP_NAME}.enc" | cut -f1)
log "Backup success: ${BACKUP_NAME}.enc ($SIZE)"

# ================= S3 UPLOAD =================
if [[ -n "$S3_BUCKET" ]]; then
  log "Uploading to S3..."

  aws s3 cp "$BACKUP_DIR/${BACKUP_NAME}.enc" \
    "s3://$S3_BUCKET/mongodb/" \
    --sse AES256 \
    --storage-class STANDARD_IA

  log "Upload complete"
fi

# ================= CLEANUP =================
log "Cleaning local backups..."
find "$BACKUP_DIR" -name "*.enc" -mtime +$RETENTION_DAYS -delete

if [[ -n "$S3_BUCKET" ]]; then
  log "Cleaning S3 backups..."
  aws s3api list-objects-v2 \
    --bucket "$S3_BUCKET" \
    --prefix "mongodb/" \
    --query "Contents[?LastModified<='$(date -d "$RETENTION_DAYS days ago" --iso-8601=seconds)'].Key" \
    --output text | while read -r key; do

      if [[ -n "$key" ]]; then
        aws s3 rm "s3://$S3_BUCKET/$key"
        log "Deleted: $key"
      fi
    done
fi

log "Backup completed successfully"