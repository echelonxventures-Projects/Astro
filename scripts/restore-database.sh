#!/bin/bash
set -euo pipefail

# StarPath Astrology - Database Restore Script
# Usage: ./restore-database.sh <backup_file> [--force]
# Example: ./restore-database.sh /backups/starpath_backup_full_20240501_120000.sql.gz

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_PATH="${DB_PATH:-$PROJECT_ROOT/prisma/prod.db}"
DATABASE_URL="${DATABASE_URL:-}"
FORCE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

log_error() {
    echo -e "${RED}[ERROR] $*${NC}"
}

log_success() {
    echo -e "${GREEN}[SUCCESS] $*${NC}"
}

log_warn() {
    echo -e "${YELLOW}[WARN] $*${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO] $*${NC}"
}

# Show usage
usage() {
    cat << EOF
Usage: $0 <backup_file> [options]

Restore StarPath Astrology database from backup.

Arguments:
  backup_file    Path to backup file (.sql, .sql.gz, or .dump)

Options:
  --force        Skip confirmation prompts
  --from-s3      Download from S3 before restore (requires S3_BUCKET)
  --s3-key       S3 key to download (required with --from-s3)
  --help         Show this help message

Examples:
  $0 /backups/starpath_backup_full_20240501_120000.sql.gz
  $0 --from-s3 --s3-key backups/starpath_backup_full_20240501_120000.sql.gz
  $0 /backups/latest.sql.gz --force

Environment Variables:
  DATABASE_URL      Database connection string
  DB_PATH           Path to SQLite database (fallback)
  BACKUP_S3_BUCKET  S3 bucket name
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION  AWS credentials

EOF
}

# Parse arguments
BACKUP_FILE=""
FROM_S3=false
S3_KEY=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        --from-s3)
            FROM_S3=true
            shift
            ;;
        --s3-key)
            S3_KEY="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            if [[ -z "$BACKUP_FILE" ]]; then
                BACKUP_FILE="$1"
            else
                log_error "Multiple backup files specified"
                exit 1
            fi
            shift
            ;;
    esac
done

# Download from S3 if requested
if [[ "$FROM_S3" == true ]]; then
    if [[ -z "$S3_KEY" ]]; then
        log_error "--s3-key required when using --from-s3"
        exit 1
    fi

    S3_BUCKET="${BACKUP_S3_BUCKET:-}"
    if [[ -z "$S3_BUCKET" ]]; then
        log_error "BACKUP_S3_BUCKET environment variable not set"
        exit 1
    fi

    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not installed"
        exit 1
    fi

    TEMP_BACKUP="${BACKUP_DIR}/$(basename "$S3_KEY")"
    log "Downloading from S3: s3://${S3_BUCKET}/${S3_KEY}"

    if aws s3 cp "s3://${S3_BUCKET}/${S3_KEY}" "$TEMP_BACKUP"; then
        BACKUP_FILE="$TEMP_BACKUP"
        log_success "Downloaded to: $TEMP_BACKUP"
    else
        log_error "Failed to download from S3"
        exit 1
    fi
fi

# Validate backup file
if [[ -z "$BACKUP_FILE" ]]; then
    log_error "No backup file specified"
    usage
    exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]] && [[ "$FROM_S3" == false ]]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

log_info "Backup file: $BACKUP_FILE"
log_info "Database path: $DB_PATH"

# Detect backup type
BACKUP_EXT="${BACKUP_FILE##*.}"
if [[ "$BACKUP_FILE" == *.gz ]]; then
    IS_COMPRESSED=true
    BACKUP_TYPE="compressed"
    log_info "Detected compressed backup"
elif [[ "$BACKUP_FILE" == *.dump ]]; then
    IS_COMPRESSED=false
    BACKUP_TYPE="postgresql"
    log_info "Detected PostgreSQL custom format backup"
elif [[ "$BACKUP_FILE" == *.sql ]]; then
    IS_COMPRESSED=false
    BACKUP_TYPE="sql"
    log_info "Detected SQL dump backup"
else
    log_warn "Unknown backup extension: $BACKUP_EXT"
    IS_COMPRESSED=false
    BACKUP_TYPE="unknown"
fi

# Confirmation prompt
if [[ "$FORCE" != true ]]; then
    echo
    log_warn "WARNING: This will REPLACE the current database with the backup!"
    log_warn "Current database: $DB_PATH"
    log_warn "Backup file: $BACKUP_FILE"
    echo
    read -p "Are you sure you want to continue? Type 'yes' to proceed: " CONFIRM

    if [[ "$CONFIRM" != "yes" ]]; then
        log "Restore cancelled by user"
        exit 0
    fi
fi

# Create restore point (backup current database before restoring)
RESTORE_POINT="${BACKUP_DIR}/restore_point_$(date +%Y%m%d_%H%M%S).db"
if [[ -f "$DB_PATH" ]]; then
    log "Creating restore point of current database..."
    cp "$DB_PATH" "$RESTORE_POINT"
    log_success "Restore point created: $RESTORE_POINT"
fi

# Perform restore
log "Starting database restore..."

if [[ -n "$DATABASE_URL" ]] && [[ "$DATABASE_URL" == *"postgresql"* ]]; then
    # PostgreSQL restore
    log "Restoring to PostgreSQL database..."

    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\).*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

    export PGPASSWORD="$DB_PASS"

    # Create temporary database
    TEMP_DB="${DB_NAME}_restore_temp"
    log "Creating temporary database: $TEMP_DB"

    psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$TEMP_DB\";" 2>/dev/null || true
    psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$TEMP_DB\";" 2>/dev/null || {
        log_error "Failed to create temporary database"
        exit 1
    }

    # Restore to temporary database
    if [[ "$BACKUP_TYPE" == "postgresql" ]] || [[ "$BACKUP_FILE" == *.dump ]]; then
        pg_restore -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$TEMP_DB" -v "$BACKUP_FILE" 2>&1 || {
            log_error "pg_restore failed"
            exit 1
        }
    else
        # SQL dump
        if [[ "$IS_COMPRESSED" == true ]]; then
            gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$TEMP_DB" 2>&1 || {
                log_error "SQL restore failed"
                exit 1
            }
        else
            psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$TEMP_DB" < "$BACKUP_FILE" 2>&1 || {
                log_error "SQL restore failed"
                exit 1
            }
        fi
    fi

    # Swap databases
    log "Swapping databases..."
    psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d postgres -c "
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}';
    " 2>/dev/null || true

    psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d postgres -c "
        ALTER DATABASE \"$DB_NAME\" RENAME TO \"${DB_NAME}_old\";
        ALTER DATABASE \"$TEMP_DB\" RENAME TO \"$DB_NAME\";
        DROP DATABASE IF EXISTS \"${DB_NAME}_old\";
    " 2>&1 || {
        log_error "Database swap failed"
        exit 1
    }

    unset PGPASSWORD

else
    # SQLite restore
    log "Restoring SQLite database..."

    # Ensure directory exists
    DB_DIR=$(dirname "$DB_PATH")
    mkdir -p "$DB_DIR"

    # Decompress if needed
    if [[ "$IS_COMPRESSED" == true ]]; then
        log "Decompressing backup..."
        TEMP_SQL="${BACKUP_DIR}/restore_temp_$(date +%s).sql"
        gunzip -c "$BACKUP_FILE" > "$TEMP_SQL"
        SOURCE_FILE="$TEMP_SQL"
    else
        SOURCE_FILE="$BACKUP_FILE"
    fi

    # Check if source is SQLite database or SQL dump
    if head -c 16 "$SOURCE_FILE" | grep -q "SQLite format 3" 2>/dev/null; then
        # Binary SQLite backup
        log "Restoring from SQLite binary backup..."
        cp "$SOURCE_FILE" "$DB_PATH"
    else
        # SQL dump
        log "Restoring from SQL dump..."
        rm -f "$DB_PATH"
        sqlite3 "$DB_PATH" < "$SOURCE_FILE" || {
            log_error "SQLite restore failed"
            exit 1
        }
    fi

    # Cleanup temp file
    if [[ "$IS_COMPRESSED" == true ]] && [[ -f "$TEMP_SQL" ]]; then
        rm -f "$TEMP_SQL"
    fi
fi

# Verify restore
log "Verifying database integrity..."
if [[ -f "$DB_PATH" ]]; then
    if sqlite3 "$DB_PATH" "PRAGMA integrity_check;" | grep -q "ok"; then
        log_success "Database integrity check passed"
    else
        log_warn "Database integrity check returned warnings"
    fi

    # Count tables
    TABLE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
    log_info "Restored database contains $TABLE_COUNT tables"
fi

# Update schema if needed (for Prisma)
if [[ -d "$PROJECT_ROOT/prisma" ]]; then
    log "Checking if Prisma migration is needed..."
    cd "$PROJECT_ROOT"
    npx prisma migrate status 2>/dev/null || log_warn "Could not check migration status"
fi

# Cleanup temporary S3 download
if [[ "$FROM_S3" == true ]] && [[ -f "$TEMP_BACKUP" ]]; then
    rm -f "$TEMP_BACKUP"
    log "Cleaned up temporary S3 download"
fi

log_success "Database restore completed successfully!"
log_info "Database location: $DB_PATH"

exit 0
