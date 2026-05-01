#!/bin/bash
set -euo pipefail

# StarPath Astrology - S3 Backup Upload Script
# Usage: ./backup-s3.sh <backup_file> [options]
# Environment variables:
#   - BACKUP_S3_BUCKET (required)
#   - AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION (required)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ENABLE_ENCRYPTION="${BACKUP_ENCRYPTION:-true}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

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

Upload database backup to S3 with optional encryption.

Arguments:
  backup_file    Path to backup file to upload

Options:
  --encrypt      Encrypt file before upload (requires BACKUP_ENCRYPTION_KEY)
  --no-encrypt   Skip encryption
  --storage-class <class>  S3 storage class (STANDARD, GLACIER, etc.)
  --prefix <path>  S3 prefix/path (default: backups/)
  --metadata     Upload metadata file alongside backup
  --help         Show this help message

Environment Variables:
  BACKUP_S3_BUCKET         S3 bucket name (required)
  AWS_ACCESS_KEY_ID        AWS access key
  AWS_SECRET_ACCESS_KEY    AWS secret key
  AWS_REGION               AWS region (default: us-east-1)
  BACKUP_ENCRYPTION        Enable encryption (default: true)
  BACKUP_ENCRYPTION_KEY    Encryption key for file encryption

Examples:
  $0 /backups/starpath_backup_20240501.sql.gz
  $0 /backups/starpath_backup.sql.gz --encrypt --storage-class GLACIER
  $0 /backups/starpath_backup.sql.gz --prefix daily/

EOF
}

# Check dependencies
check_dependencies() {
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        log_info "Install with: pip install awscli"
        exit 1
    fi

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        log_info "Configure with: aws configure"
        exit 1
    fi
}

# Encrypt file
encrypt_file() {
    local input_file="$1"
    local output_file="${input_file}.enc"

    if [[ -z "$ENCRYPTION_KEY" ]]; then
        log_warn "Encryption requested but no BACKUP_ENCRYPTION_KEY set"
        return 1
    fi

    log "Encrypting backup file..."

    # Use openssl for encryption
    openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
        -in "$input_file" -out "$output_file" \
        -k "$ENCRYPTION_KEY" 2>/dev/null || {
        log_error "Encryption failed"
        return 1
    }

    log_success "File encrypted: $output_file"
    echo "$output_file"
}

# Upload to S3
upload_to_s3() {
    local file="$1"
    local s3_key="$2"
    local storage_class="$3"

    log "Uploading to S3: s3://${S3_BUCKET}/${s3_key}"
    log_info "Storage class: $storage_class"

    # Build upload command
    local upload_cmd="aws s3 cp \"$file\" \"s3://${S3_BUCKET}/${s3_key}\""

    # Add storage class
    if [[ -n "$storage_class" ]]; then
        upload_cmd="$upload_cmd --storage-class $storage_class"
    fi

    # Add metadata
    upload_cmd="$upload_cmd --metadata timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ),source=starpath-backup"

    # Execute upload
    if eval "$upload_cmd"; then
        log_success "Upload completed: s3://${S3_BUCKET}/${s3_key}"
        return 0
    else
        log_error "Upload failed"
        return 1
    fi
}

# Verify upload
verify_upload() {
    local s3_key="$1"
    local local_file="$2"

    log "Verifying S3 upload..."

    # Get remote checksum (ETag)
    local remote_etag
    remote_etag=$(aws s3api head-object --bucket "$S3_BUCKET" --key "$s3_key" --query 'ETag' --output text 2>/dev/null)

    if [[ -z "$remote_etag" ]] || [[ "$remote_etag" == "null" ]]; then
        log_warn "Could not verify S3 upload"
        return 1
    fi

    # Calculate local MD5
    local local_md5
    local_md5=$(md5sum "$local_file" | cut -d' ' -f1 | sed 's/^/"/;s/$/"/')

    # Compare (ETag includes quotes)
    if [[ "$remote_etag" == *"$local_md5"* ]] || [[ "$remote_etag" == "$local_md5" ]]; then
        log_success "Upload verification passed"
        return 0
    else
        log_warn "Upload checksum mismatch - file may be corrupted"
        return 1
    fi
}

# Upload metadata
upload_metadata() {
    local backup_file="$1"
    local s3_prefix="$2"

    local filename
    filename=$(basename "$backup_file")
    local metadata_file="${BACKUP_DIR}/metadata_$(date +%Y%m%d_%H%M%S).json"

    # Create metadata
    cat > "$metadata_file" << EOF
{
  "backupFile": "$filename",
  "uploadedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "s3Location": "s3://${S3_BUCKET}/${s3_prefix}${filename}",
  "s3Bucket": "$S3_BUCKET",
  "s3Key": "${s3_prefix}${filename}",
  "size": $(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo 0),
  "checksum": "$(md5sum "$backup_file" | cut -d' ' -f1)",
  "encrypted": $([[ "$ENABLE_ENCRYPTION" == "true" ]] && echo "true" || echo "false"),
  "storageClass": "${STORAGE_CLASS:-STANDARD}"
}
EOF

    local metadata_s3_key="${s3_prefix}metadata/$(basename "$metadata_file")"
    log "Uploading metadata: s3://${S3_BUCKET}/${metadata_s3_key}"

    if aws s3 cp "$metadata_file" "s3://${S3_BUCKET}/${metadata_s3_key}"; then
        log_success "Metadata uploaded"
    else
        log_warn "Failed to upload metadata"
    fi

    # Cleanup local metadata file
    rm -f "$metadata_file"
}

# Main function
main() {
    # Parse arguments
    local BACKUP_FILE=""
    local S3_PREFIX="backups/"
    local STORAGE_CLASS="STANDARD"
    local UPLOAD_METADATA=false
    local DO_ENCRYPT="${ENABLE_ENCRYPTION}"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --encrypt)
                DO_ENCRYPT=true
                shift
                ;;
            --no-encrypt)
                DO_ENCRYPT=false
                shift
                ;;
            --storage-class)
                STORAGE_CLASS="$2"
                shift 2
                ;;
            --prefix)
                S3_PREFIX="$2"
                shift 2
                ;;
            --metadata)
                UPLOAD_METADATA=true
                shift
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

    # Validate arguments
    if [[ -z "$BACKUP_FILE" ]]; then
        log_error "No backup file specified"
        usage
        exit 1
    fi

    if [[ ! -f "$BACKUP_FILE" ]]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi

    if [[ -z "$S3_BUCKET" ]]; then
        log_error "BACKUP_S3_BUCKET environment variable not set"
        exit 1
    fi

    # Check dependencies
    check_dependencies

    log "=== S3 Backup Upload ==="
    log_info "File: $BACKUP_FILE"
    log_info "Destination: s3://${S3_BUCKET}/${S3_PREFIX}"

    local FILE_TO_UPLOAD="$BACKUP_FILE"
    local CLEANUP_ENCRYPTED=false

    # Encrypt if requested
    if [[ "$DO_ENCRYPT" == "true" ]]; then
        if ENCRYPTED_FILE=$(encrypt_file "$BACKUP_FILE"); then
            FILE_TO_UPLOAD="$ENCRYPTED_FILE"
            CLEANUP_ENCRYPTED=true
        else
            log_warn "Encryption failed, proceeding with unencrypted upload"
        fi
    fi

    # Build S3 key
    local filename
    filename=$(basename "$FILE_TO_UPLOAD")
    local S3_KEY="${S3_PREFIX}${filename}"

    # Upload to S3
    if upload_to_s3 "$FILE_TO_UPLOAD" "$S3_KEY" "$STORAGE_CLASS"; then
        # Verify upload
        verify_upload "$S3_KEY" "$FILE_TO_UPLOAD"

        # Upload metadata if requested
        if [[ "$UPLOAD_METADATA" == "true" ]]; then
            upload_metadata "$FILE_TO_UPLOAD" "$S3_PREFIX"
        fi

        log_success "S3 backup upload completed successfully!"
    else
        log_error "S3 backup upload failed"
        exit 1
    fi

    # Cleanup encrypted file
    if [[ "$CLEANUP_ENCRYPTED" == "true" ]] && [[ -f "$ENCRYPTED_FILE" ]]; then
        rm -f "$ENCRYPTED_FILE"
        log "Cleaned up encrypted file"
    fi

    exit 0
}

main "$@"
