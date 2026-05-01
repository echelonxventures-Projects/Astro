#!/bin/bash
set -euo pipefail

# StarPath Astrology - Database Backup Script
# Usage: ./backup-database.sh [full|incremental]
# Environment variables required:
#   - DATABASE_URL or DB_PATH
#   - BACKUP_S3_BUCKET (optional, for S3 upload)
#   - AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION (optional)

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_PATH="${DB_PATH:-$PROJECT_ROOT/prisma/prod.db}"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_TYPE="${1:-full}"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]$(date +'%Y-%m-%d %H:%M:%S')] $*${NC}" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]$(date +'%Y-%m-%d %H:%M:%S')] $*${NC}" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]$(date +'%Y-%m-%d %H:%M:%S')] $*${NC}" | tee -a "$LOG_FILE"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate timestamp and backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="starpath_backup_${BACKUP_TYPE}_${TIMESTAMP}.sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

log "Starting ${BACKUP_TYPE} backup..."
log "Backup destination: $BACKUP_PATH"

# Detect database type and perform backup
if [[ -n "${DATABASE_URL:-}" ]]; then
    if [[ "$DATABASE_URL" == *"postgresql"* ]]; then
        # PostgreSQL backup
        log "Detected PostgreSQL database"

        # Extract connection details from DATABASE_URL
        # Format: postgresql://user:password@host:port/dbname
        DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\).*/\1/p')
        DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
        DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

        if [[ "$BACKUP_TYPE" == "full" ]]; then
            log "Creating full PostgreSQL dump..."
            PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
                pg_dump -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" \
                --format=custom --file="${BACKUP_PATH}.dump" 2>/dev/null || {
                log_error "PostgreSQL backup failed"
                exit 1
            }
            BACKUP_PATH="${BACKUP_PATH}.dump"
        else
            log "Creating incremental PostgreSQL backup (not yet implemented)"
            log_warn "Incremental backup falls back to full backup"
            PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
                pg_dump -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" \
                --format=custom --file="${BACKUP_PATH}.dump" 2>/dev/null || {
                log_error "PostgreSQL backup failed"
                exit 1
            }
            BACKUP_PATH="${BACKUP_PATH}.dump"
        fi
    elif [[ "$DATABASE_URL" == *"sqlite"* ]] || [[ "$DATABASE_URL" == *"file:"* ]]; then
        # SQLite backup from connection string
        DB_FILE=$(echo "$DATABASE_URL" | sed 's/.*file:\.\.\?\//\./; s/.*file://')
        DB_PATH="${DB_FILE:-$PROJECT_ROOT/prisma/dev.db}"
        log "Detected SQLite database at: $DB_PATH"

        # SQLite backup
        log "Creating SQLite backup..."
        if [[ -f "$DB_PATH" ]]; then
            sqlite3 "$DB_PATH" ".backup '${BACKUP_PATH}'" || {
                log_error "SQLite backup failed"
                exit 1
            }
        else
            log_error "Database file not found: $DB_PATH"
            exit 1
        fi
    else
        log_error "Unsupported database type in DATABASE_URL"
        exit 1
    fi
else
    # SQLite backup from DB_PATH
    log "Using SQLite database at: $DB_PATH"

    if [[ ! -f "$DB_PATH" ]]; then
        log_error "Database file not found: $DB_PATH"
        exit 1
    fi

    log "Creating SQLite backup..."
    sqlite3 "$DB_PATH" ".backup '${BACKUP_PATH}'" || {
        log_error "SQLite backup failed"
        exit 1
    }
fi

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
log "Raw backup size: $BACKUP_SIZE"

# Compress backup
log "Compressing backup..."
COMPRESSED_PATH="${BACKUP_PATH}.gz"
gzip -f "$BACKUP_PATH"
COMPRESSED_SIZE=$(du -h "$COMPRESSED_PATH" | cut -f1)
log "Compressed backup size: $COMPRESSED_SIZE"

# Generate checksum
CHECKSUM=$(md5sum "$COMPRESSED_PATH" | cut -d' ' -f1)
log "Backup checksum (MD5): $CHECKSUM"

# Save metadata
cat > "${BACKUP_DIR}/metadata_${TIMESTAMP}.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "type": "${BACKUP_TYPE}",
  "database": "$(basename "$DB_PATH")",
  "compressed_file": "$(basename "$COMPRESSED_PATH")",
  "compressed_size": "${COMPRESSED_SIZE}",
  "checksum_md5": "${CHECKSUM}",
  "retention_days": ${RETENTION_DAYS},
  "s3_uploaded": false
}
EOF

log "Metadata saved to: metadata_${TIMESTAMP}.json"

# Upload to S3 if configured
if [[ -n "$S3_BUCKET" ]]; then
    log "Uploading to S3 bucket: $S3_BUCKET"

    # Check AWS credentials
    if ! command -v aws &> /dev/null; then
        log_warn "AWS CLI not found. Skipping S3 upload."
    elif [[ -z "${AWS_ACCESS_KEY_ID:-}" ]] || [[ -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
        log_warn "AWS credentials not configured. Skipping S3 upload."
    else
        S3_KEY="backups/$(basename "$COMPRESSED_PATH")"

        if aws s3 cp "$COMPRESSED_PATH" "s3://${S3_BUCKET}/${S3_KEY}"; then
            log_success "Uploaded to s3://${S3_BUCKET}/${S3_KEY}"

            # Upload metadata
            aws s3 cp "${BACKUP_DIR}/metadata_${TIMESTAMP}.json" "s3://${S3_BUCKET}/backups/metadata/"

            # Update metadata
            jq '.s3_uploaded = true' "${BACKUP_DIR}/metadata_${TIMESTAMP}.json" > "${BACKUP_DIR}/metadata_${TIMESTAMP}.tmp.json"
            mv "${BACKUP_DIR}/metadata_${TIMESTAMP}.tmp.json" "${BACKUP_DIR}/metadata_${TIMESTAMP}.json"
        else
            log_error "S3 upload failed"
            exit 1
        fi
    fi
else
    log_warn "S3_BUCKET not configured. Skipping cloud backup."
fi

# Cleanup old local backups
log "Cleaning up old local backups (>${RETENTION_DAYS} days)..."
DELETED_COUNT=0
while IFS= read -r file; do
    if [[ -f "$file" ]]; then
        rm "$file"
        DELETED_COUNT=$((DELETED_COUNT + 1))
        log "Deleted old backup: $(basename "$file")"
    fi
done < <(find "$BACKUP_DIR" -name "starpath_backup_*.gz" -mtime +$RETENTION_DAYS 2>/dev/null)

# Cleanup old metadata files
find "$BACKUP_DIR" -name "metadata_*.json" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

log "Cleanup complete. Deleted $DELETED_COUNT old backup(s)."

# Cleanup S3 backups if configured
if [[ -n "$S3_BUCKET" ]] && command -v aws &> /dev/null; then
    log "Cleaning up old S3 backups..."

    # List and delete old backups from S3
    aws s3 ls "s3://${S3_BUCKET}/backups/" 2>/dev/null | while read -r line; do
        FILE_DATE=$(echo "$line" | awk '{print $1}')
        FILE_NAME=$(echo "$line" | awk '{print $4}')

        if [[ -n "$FILE_NAME" ]] && [[ "$FILE_NAME" == starpath_backup_*.gz ]]; then
            FILE_EPOCH=$(date -d "$FILE_DATE" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$FILE_DATE" +%s 2>/dev/null)
            CURRENT_EPOCH=$(date +%s)
            AGE_DAYS=$(( (CURRENT_EPOCH - FILE_EPOCH) / 86400 ))

            if [[ $AGE_DAYS -gt $RETENTION_DAYS ]]; then
                aws s3 rm "s3://${S3_BUCKET}/backups/$FILE_NAME" 2>/dev/null && \
                    log "Deleted old S3 backup: $FILE_NAME"
            fi
        fi
    done
fi

# Verify backup integrity
log "Verifying backup integrity..."
if bash "${SCRIPT_DIR}/verify-backup.sh" "$COMPRESSED_PATH" 2>/dev/null; then
    log_success "Backup verification passed"
else
    log_warn "Backup verification script not available or failed"
fi

# Send notification (if configured)
if [[ -n "${BACKUP_NOTIFICATION_WEBHOOK:-}" ]]; then
    curl -s -X POST "$BACKUP_NOTIFICATION_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"Backup completed successfully: ${BACKUP_FILE}.gz (${COMPRESSED_SIZE})\"}" \
        > /dev/null || log_warn "Notification webhook failed"
fi

log_success "Backup completed successfully!"
log "Backup file: $(basename "$COMPRESSED_PATH")"
log "Location: ${BACKUP_DIR}/"
log "Size: ${COMPRESSED_SIZE}"

exit 0
