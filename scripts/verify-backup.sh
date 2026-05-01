#!/bin/bash
set -euo pipefail

# StarPath Astrology - Backup Verification Script
# Usage: ./verify-backup.sh <backup_file>
# Returns 0 on success, 1 on failure

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-/backups}"

# Colors for output (if terminal)
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

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

Verify backup file integrity and usability.

Arguments:
  backup_file    Path to backup file to verify

Options:
  --detailed     Run detailed verification (restore to temp database)
  --checksum <hash>  Verify against expected checksum
  --quiet        Minimal output, return code only
  --help         Show this help message

Exit Codes:
  0   Verification successful
  1   File not found or corrupted
  2   Invalid arguments
  3   Verification failed

Examples:
  $0 /backups/starpath_backup_20240501.sql.gz
  $0 /backups/backup.gz --detailed
  $0 /backups/backup.gz --checksum abc123def456

EOF
}

# Check if file exists
check_file_exists() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        log_error "Backup file not found: $file"
        return 1
    fi

    local size
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)

    if [[ $size -eq 0 ]]; then
        log_error "Backup file is empty"
        return 1
    fi

    log_success "File exists (${size} bytes)"
    return 0
}

# Check file format
verify_format() {
    local file="$1"
    local filename
    filename=$(basename "$file")

    log "Verifying file format..."

    # Check based on extension
    if [[ "$file" == *.gz ]]; then
        if gunzip -t "$file" 2>/dev/null; then
            log_success "Gzip format valid"
        else
            log_error "Invalid gzip file"
            return 1
        fi

        # Check inner format
        local first_bytes
        first_bytes=$(gunzip -c "$file" 2>/dev/null | head -c 100)

        if echo "$first_bytes" | grep -q "SQLite format 3" 2>/dev/null; then
            log_success "Contains valid SQLite database"
        elif echo "$first_bytes" | grep -q "^-- " 2>/dev/null; then
            log_success "Contains valid SQL dump"
        elif echo "$first_bytes" | grep -q "^CREATE TABLE" 2>/dev/null; then
            log_success "Contains valid SQL dump"
        else
            log_warn "Unknown inner format"
        fi

    elif [[ "$file" == *.sql ]]; then
        if grep -q "CREATE TABLE\|INSERT INTO\|SQLite format 3" "$file" 2>/dev/null; then
            log_success "SQL/SQLite format valid"
        else
            log_warn "File does not appear to be a valid SQL dump"
        fi

    elif [[ "$file" == *.dump ]]; then
        if pg_restore --list "$file" &> /dev/null; then
            log_success "PostgreSQL dump format valid"
        else
            log_warn "Could not verify PostgreSQL dump format"
        fi

    elif [[ "$file" == *.enc ]]; then
        log_info "Encrypted file - format check skipped (content obscured)"

    else
        log_warn "Unknown file extension: ${file##*.}"
        return 1
    fi

    return 0
}

# Verify checksum
verify_checksum() {
    local file="$1"
    local expected_checksum="${2:-}"

    log "Calculating checksum..."

    local actual_checksum
    actual_checksum=$(md5sum "$file" | cut -d' ' -f1)

    log_info "File MD5: $actual_checksum"

    if [[ -n "$expected_checksum" ]]; then
        if [[ "$actual_checksum" == "$expected_checksum" ]]; then
            log_success "Checksum matches expected value"
            return 0
        else
            log_error "Checksum mismatch!"
            log_error "  Expected: $expected_checksum"
            log_error "  Actual:   $actual_checksum"
            return 1
        fi
    fi

    return 0
}

# Detailed verification (restore to temp location)
detailed_verification() {
    local file="$1"

    log "Running detailed verification..."
    log_info "This will attempt to restore the backup to a temporary location"

    local TEMP_DIR
    TEMP_DIR=$(mktemp -d)
    local TEMP_DB="${TEMP_DIR}/verify_test.db"

    trap 'rm -rf "$TEMP_DIR"' EXIT

    local source_file="$file"

    # Decompress if needed
    if [[ "$file" == *.gz ]]; then
        log "Decompressing for detailed verification..."
        gunzip -c "$file" > "${TEMP_DIR}/backup.sql"
        source_file="${TEMP_DIR}/backup.sql"
    fi

    # Check format and restore
    local first_bytes
    first_bytes=$(head -c 16 "$source_file")

    if echo "$first_bytes" | grep -q "SQLite format 3" 2>/dev/null; then
        # Binary SQLite backup
        cp "$source_file" "$TEMP_DB"

        if sqlite3 "$TEMP_DB" "PRAGMA integrity_check;" | grep -q "ok"; then
            log_success "SQLite integrity check passed"
        else
            log_error "SQLite integrity check failed"
            return 1
        fi

        # Count tables
        local table_count
        table_count=$(sqlite3 "$TEMP_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
        log_info "Database contains $table_count tables"

        if [[ $table_count -eq 0 ]]; then
            log_warn "Database has no tables"
        fi

    elif [[ "$source_file" == *.sql ]] || head -c 100 "$source_file" | grep -q "CREATE TABLE" 2>/dev/null; then
        # SQL dump
        sqlite3 "$TEMP_DB" < "$source_file" || {
            log_error "Failed to restore SQL dump"
            return 1
        }

        if sqlite3 "$TEMP_DB" "PRAGMA integrity_check;" | grep -q "ok"; then
            log_success "SQL dump integrity check passed"
        else
            log_error "SQL dump integrity check failed"
            return 1
        fi
    fi

    log_success "Detailed verification passed"
    return 0
}

# S3 backup verification
verify_s3_backup() {
    local s3_url="$1"

    log "Verifying S3 backup: $s3_url"

    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not installed"
        return 1
    fi

    # Parse S3 URL
    local bucket key
    bucket=$(echo "$s3_url" | sed 's/s3:\/\//; s/\([^/]*\)\/.*/\1/')
    key=$(echo "$s3_url" | sed 's/s3:\/\/[^/]*\///')

    log_info "Bucket: $bucket"
    log_info "Key: $key"

    # Check if object exists
    if aws s3api head-object --bucket "$bucket" --key "$key" &> /dev/null; then
        log_success "S3 object exists"

        # Get object info
        local size
        size=$(aws s3api head-object --bucket "$bucket" --key "$key" --query 'ContentLength' --output text)
        log_info "Object size: ${size} bytes"

        return 0
    else
        log_error "S3 object not found or not accessible"
        return 1
    fi
}

# Main function
main() {
    local BACKUP_FILE=""
    local DETAILED=false
    local EXPECTED_CHECKSUM=""
    local QUIET=false
    local IS_S3=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --detailed)
                DETAILED=true
                shift
                ;;
            --checksum)
                EXPECTED_CHECKSUM="$2"
                shift 2
                ;;
            --quiet)
                QUIET=true
                shift
                ;;
            --help)
                usage
                exit 0
                ;;
            s3://*)
                BACKUP_FILE="$1"
                IS_S3=true
                shift
                ;;
            -*)
                log_error "Unknown option: $1"
                usage
                exit 2
                ;;
            *)
                if [[ -z "$BACKUP_FILE" ]]; then
                    BACKUP_FILE="$1"
                else
                    log_error "Multiple backup files specified"
                    exit 2
                fi
                shift
                ;;
        esac
    done

    # Validate arguments
    if [[ -z "$BACKUP_FILE" ]]; then
        log_error "No backup file specified"
        usage
        exit 2
    fi

    # Suppress output if quiet mode
    if [[ "$QUIET" == "true" ]]; then
        exec > /dev/null 2>&1
    fi

    log "=== Backup Verification ==="
    log_info "File: $BACKUP_FILE"

    local EXIT_CODE=0

    if [[ "$IS_S3" == "true" ]]; then
        # S3 verification
        if ! verify_s3_backup "$BACKUP_FILE"; then
            EXIT_CODE=3
        fi
    else
        # Local file verification
        if ! check_file_exists "$BACKUP_FILE"; then
            EXIT_CODE=1
        elif ! verify_format "$BACKUP_FILE"; then
            EXIT_CODE=3
        elif ! verify_checksum "$BACKUP_FILE" "$EXPECTED_CHECKSUM"; then
            EXIT_CODE=3
        elif [[ "$DETAILED" == "true" ]]; then
            if ! detailed_verification "$BACKUP_FILE"; then
                EXIT_CODE=3
            fi
        fi
    fi

    if [[ $EXIT_CODE -eq 0 ]]; then
        log_success "Backup verification PASSED"
    else
        log_error "Backup verification FAILED"
    fi

    exit $EXIT_CODE
}

main "$@"
