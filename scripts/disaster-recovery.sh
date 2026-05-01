#!/bin/bash
set -euo pipefail

# StarPath Astrology - Disaster Recovery Runbook
# Usage: ./disaster-recovery.sh <scenario> [options]
# Scenarios: corruption, server-failure, datacenter-outage, ransomware, human-error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_PATH="${DB_PATH:-$PROJECT_ROOT/prisma/prod.db}"
DATABASE_URL="${DATABASE_URL:-}"

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

log_step() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Step $1: $2${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Show usage
usage() {
    cat << EOF
Usage: $0 <scenario> [options]

StarPath Astrology Disaster Recovery Runbook

Scenarios:
  corruption          Database corruption detected
  server-failure      Complete server failure
  datacenter-outage   Data center outage (multi-region)
  ransomware          Ransomware/malware attack
  human-error         Accidental data deletion/modification

Options:
  --backup <file>     Specify backup file to restore
  --from-s3           Download backup from S3 before restore
  --s3-key <key>      S3 key for backup (with --from-s3)
  --force             Skip confirmation prompts
  --dry-run           Show what would be done without executing
  --help              Show this help message

Environment Variables:
  BACKUP_S3_BUCKET    S3 bucket for backup retrieval
  AWS credentials     Required for S3 operations

Examples:
  $0 corruption --from-s3 --s3-key backups/latest.sql.gz
  $0 server-failure --backup /mnt/backup/latest.sql.gz
  $0 ransomware --dry-run

DR Targets:
  RTO: 4 hours (Recovery Time Objective)
  RPO: 1 hour (Recovery Point Objective)

EOF
}

# Send notification
notify() {
    local message="$1"
    local severity="${2:-info}"

    log "NOTIFY: $message"

    # Slack webhook if configured
    if [[ -n "${DR_SLACK_WEBHOOK:-}" ]]; then
        curl -s -X POST "$DR_SLACK_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"[DR ALERT - ${severity^^}] $message\",\"username\":\"StarPath-DR\"}" \
            > /dev/null 2>&1 || true
    fi

    # PagerDuty if configured
    if [[ -n "${DR_PAGERDUTY_KEY:-}" ]]; then
        curl -s -X POST "https://events.pagerduty.com/v2/enqueue" \
            -H "Content-Type: application/json" \
            -d "{\"routing_key\":\"$DR_PAGERDUTY_KEY\",\"event_action\":\"trigger\",\"payload\":{\"summary\":\"$message\",\"severity\":\"$severity\",\"source\":\"disaster-recovery\"}}" \
            > /dev/null 2>&1 || true
    fi
}

# Stop application
stop_application() {
    log_step "1" "Stop Application"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would stop application"
        return 0
    fi

    # Detect init system and stop service
    if command -v systemctl &> /dev/null; then
        if systemctl is-active --quiet starpath 2>/dev/null || \
           systemctl is-active --quiet starpath-astrology 2>/dev/null; then
            log "Stopping StarPath service..."
            systemctl stop starpath 2>/dev/null || systemctl stop starpath-astrology 2>/dev/null || true
            log_success "Service stopped"
        fi
    elif command -v service &> /dev/null; then
        service starpath stop 2>/dev/null || true
    fi

    # Stop Docker containers if running
    if [[ -f "$PROJECT_ROOT/docker-compose.yml" ]]; then
        log "Stopping Docker containers..."
        cd "$PROJECT_ROOT"
        docker-compose down 2>/dev/null || true
    fi

    # Kill Node.js processes
    pkill -f "next start" 2>/dev/null || true
    pkill -f "node.*starpath" 2>/dev/null || true

    log_success "Application stopped"
}

# Assess damage
assess_damage() {
    log_step "2" "Assess Damage"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would assess database integrity"
        return 0
    fi

    # Check database integrity
    if [[ -f "$DB_PATH" ]]; then
        log "Checking database integrity..."

        if sqlite3 "$DB_PATH" "PRAGMA integrity_check;" | grep -q "ok"; then
            log_success "Database integrity OK"
        else
            log_warn "Database integrity check FAILED"
            sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>&1 || true
        fi

        # Get database stats
        local table_count size
        table_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo 0)
        size=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH" 2>/dev/null || echo 0)

        log_info "Database size: $size bytes"
        log_info "Table count: $table_count"

        # Save assessment report
        cat > "${BACKUP_DIR}/assessment_$(date +%Y%m%d_%H%M%S).txt" << EOF
Disaster Assessment Report
==========================
Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Database: $DB_PATH
Size: $size bytes
Tables: $table_count
Integrity: $(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>/dev/null || echo "UNKNOWN")

File Hashes:
$(md5sum "$DB_PATH" 2>/dev/null || echo "N/A")
EOF
    else
        log_warn "Database file not found at: $DB_PATH"
    fi
}

# Find latest backup
find_latest_backup() {
    log_step "3" "Locate Backup"

    if [[ -n "${BACKUP_FILE:-}" ]]; then
        log_info "Using specified backup: $BACKUP_FILE"
        return 0
    fi

    # Search for backups
    local latest_local
    latest_local=$(find "$BACKUP_DIR" -name "starpath_backup_*.gz" -type f -printf '%T@ %p\n' 2>/dev/null | \
        sort -n | tail -1 | cut -d' ' -f2-)

    if [[ -n "$latest_local" ]]; then
        log_info "Latest local backup: $latest_local"
        BACKUP_FILE="$latest_local"
        return 0
    fi

    # Try S3 if configured
    if [[ -n "${BACKUP_S3_BUCKET:-}" ]] && command -v aws &> /dev/null; then
        log "Searching S3 for latest backup..."

        local latest_s3
        latest_s3=$(aws s3 ls "s3://${BACKUP_S3_BUCKET}/backups/" 2>/dev/null | \
            grep "starpath_backup_" | sort | tail -1 | awk '{print $4}')

        if [[ -n "$latest_s3" ]]; then
            log_info "Latest S3 backup: s3://${BACKUP_S3_BUCKET}/backups/$latest_s3"
            FROM_S3=true
            S3_KEY="backups/$latest_s3"
            return 0
        fi
    fi

    log_error "No backup found"
    return 1
}

# Restore database
restore_database() {
    log_step "4" "Restore Database"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would restore database from: ${BACKUP_FILE:-S3}"
        return 0
    fi

    if [[ -z "${BACKUP_FILE:-}" ]] && [[ "${FROM_S3:-false}" != "true" ]]; then
        log_error "No backup available for restore"
        return 1
    fi

    # Build restore command
    local restore_cmd="bash ${SCRIPT_DIR}/restore-database.sh"

    if [[ -n "${BACKUP_FILE:-}" ]]; then
        restore_cmd="$restore_cmd \"$BACKUP_FILE\""
    fi

    if [[ "${FROM_S3:-false}" == "true" ]]; then
        restore_cmd="$restore_cmd --from-s3 --s3-key \"$S3_KEY\""
    fi

    restore_cmd="$restore_cmd --force"

    log "Executing: $restore_cmd"

    if eval "$restore_cmd"; then
        log_success "Database restored successfully"
    else
        log_error "Database restore failed"
        return 1
    fi
}

# Verify restoration
verify_restoration() {
    log_step "5" "Verify Restoration"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would verify database integrity"
        return 0
    fi

    # Check database integrity
    if [[ -f "$DB_PATH" ]]; then
        if sqlite3 "$DB_PATH" "PRAGMA integrity_check;" | grep -q "ok"; then
            log_success "Database integrity verified"
        else
            log_error "Database integrity check failed after restore"
            return 1
        fi

        # Basic connectivity test
        local user_count
        user_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM User;" 2>/dev/null || echo 0)
        log_info "User records found: $user_count"

        if [[ $user_count -gt 0 ]]; then
            log_success "Database is accessible and contains data"
        fi
    else
        log_error "Database file not found after restore"
        return 1
    fi
}

# Start application
start_application() {
    log_step "6" "Start Application"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would start application"
        return 0
    fi

    # Run migrations if needed
    if [[ -d "$PROJECT_ROOT/prisma" ]]; then
        log "Running database migrations..."
        cd "$PROJECT_ROOT"
        npx prisma migrate deploy 2>/dev/null || log_warn "Migration check failed"
    fi

    # Start service
    if command -v systemctl &> /dev/null; then
        log "Starting StarPath service..."
        systemctl start starpath 2>/dev/null || systemctl start starpath-astrology 2>/dev/null || \
            log_warn "Could not start via systemctl"
    fi

    # Or start Docker
    if [[ -f "$PROJECT_ROOT/docker-compose.yml" ]]; then
        log "Starting Docker containers..."
        cd "$PROJECT_ROOT"
        docker-compose up -d 2>/dev/null || log_warn "Could not start Docker"
    fi

    # Verify application health
    log "Waiting for application to start..."
    sleep 5

    local health_url="http://localhost:3000/api/health"
    if curl -s "$health_url" | grep -q "ok\|healthy" 2>/dev/null; then
        log_success "Application health check passed"
    else
        log_warn "Application health check returned unexpected response"
    fi

    log_success "Application start initiated"
}

# Generate recovery report
generate_report() {
    log_step "7" "Generate Recovery Report"

    local report_file="${BACKUP_DIR}/recovery_report_$(date +%Y%m%d_%H%M%S).md"

    cat > "$report_file" << EOF
# Disaster Recovery Report

## Summary

| Field | Value |
|-------|-------|
| Recovery Date | $(date -u +%Y-%m-%dT%H:%M:%SZ) |
| Scenario | ${SCENARIO:-unknown} |
| Recovery Time | ${RECOVERY_TIME:-N/A} |
| Status | ${STATUS:-pending} |

## Actions Taken

1. Application stopped
2. Damage assessed
3. Backup located: ${BACKUP_FILE:-N/A}
4. Database restored
5. Integrity verified
6. Application started

## Post-Recovery Status

- Database location: $DB_PATH
- Application URL: ${NEXTAUTH_URL:-http://localhost:3000}
- Health check: $(curl -s "http://localhost:3000/api/health" 2>/dev/null || echo "N/A")

## Notes

$(cat)

## Sign-off

- [ ] Recovery verified by operations team
- [ ] Monitoring alerts cleared
- [ ] Users notified of restoration
- [ ] Post-incident review scheduled

EOF

    log_info "Recovery report saved to: $report_file"
}

# Scenario: Database Corruption
scenario_corruption() {
    log "=== DATABASE CORRUPTION RECOVERY ==="
    log_warn "RTO: 4 hours | RPO: 1 hour"

    notify "Database corruption detected - starting recovery" "critical"

    stop_application
    assess_damage
    find_latest_backup || exit 1
    restore_database || exit 1
    verify_restoration || exit 1
    start_application

    notify "Database corruption recovery complete" "info"
}

# Scenario: Server Failure
scenario_server_failure() {
    log "=== SERVER FAILURE RECOVERY ==="
    log_warn "RTO: 4 hours | RPO: 1 hour"

    notify "Server failure detected - starting recovery" "critical"

    # Additional steps for server recovery
    log_step "0" "Provision New Server"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would provision new server"
    else
        log_info "Ensure new server is provisioned and ready"
        log_info "Required: Node.js, npm, SQLite/PostgreSQL, application code"
    fi

    find_latest_backup || exit 1
    restore_database || exit 1
    verify_restoration || exit 1

    # Update DNS if needed
    log_step "DNS" "Update DNS"
    log_info "Update DNS records to point to new server IP"

    start_application

    notify "Server failure recovery complete" "info"
}

# Scenario: Data Center Outage
scenario_datacenter_outage() {
    log "=== DATA CENTER OUTAGE RECOVERY ==="
    log_warn "RTO: 4 hours | RPO: 1 hour"

    notify "Data center outage detected - activating multi-region DR" "critical"

    log_step "ACT" "Activate Secondary Region"
    log_info "Route traffic to secondary region"
    log_info "Update load balancer / DNS to secondary region"

    # Multi-region specific steps
    log "Checking secondary region health..."

    if [[ "${DRY_RUN:-false}" != "true" ]]; then
        log_info "Secondary region should already have latest data (replicated)"
        log_info "If not, restore from S3 backup to secondary region"
    fi

    notify "Multi-region DR activated" "info"
}

# Scenario: Ransomware
scenario_ransomware() {
    log "=== RANSOMWARE RECOVERY ==="
    log_warn "This scenario requires forensic analysis"

    notify "Ransomware incident detected - initiating security protocols" "critical"

    log_step "SEC" "Security Assessment"
    log_info "1. ISOLATE affected systems immediately"
    log_info "2. DO NOT pay ransom - use clean backups"
    log_info "3. Contact security team and law enforcement"
    log_info "4. Preserve evidence for forensic analysis"
    log_info "5. Use pre-ransomware backup only"

    stop_application
    assess_damage

    log_warn "Select backup from BEFORE the ransomware incident"
    read -p "Enter backup file path or S3 key: " BACKUP_FILE

    restore_database || exit 1
    verify_restoration || exit 1

    log_step "SEC" "Post-Recovery Security"
    log_info "1. Change all passwords"
    log_info "2. Rotate all API keys"
    log_info "3. Audit all user access"
    log_info "4. Review security logs"
    log_info "5. Patch vulnerable systems"

    start_application

    notify "Ransomware recovery complete - security review required" "warning"
}

# Scenario: Human Error
scenario_human_error() {
    log "=== HUMAN ERROR RECOVERY ==="
    log_warn "Accidental data deletion or modification"

    notify "Human error incident - assessing scope" "warning"

    log_step "SCOPE" "Determine Scope"
    log_info "Identify what was accidentally deleted/modified"

    stop_application
    assess_damage

    log "Select appropriate backup based on when error occurred"
    find_latest_backup || exit 1

    log_warn "Consider partial restore if only specific tables affected"

    restore_database || exit 1
    verify_restoration || exit 1
    start_application

    notify "Human error recovery complete" "info"
}

# Main function
main() {
    SCENARIO=""
    BACKUP_FILE=""
    FROM_S3=false
    S3_KEY=""
    FORCE=false
    DRY_RUN=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            corruption|server-failure|datacenter-outage|ransomware|human-error)
                SCENARIO="$1"
                shift
                ;;
            --backup)
                BACKUP_FILE="$2"
                shift 2
                ;;
            --from-s3)
                FROM_S3=true
                shift
                ;;
            --s3-key)
                S3_KEY="$2"
                shift 2
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
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
                log_error "Unknown scenario: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Validate
    if [[ -z "$SCENARIO" ]]; then
        log_error "No scenario specified"
        usage
        exit 1
    fi

    log "=========================================="
    log "  StarPath Astrology Disaster Recovery"
    log "  Scenario: ${SCENARIO}"
    log "=========================================="

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN MODE - No changes will be made"
    fi

    if [[ "$FORCE" != true ]] && [[ "$DRY_RUN" != true ]]; then
        echo
        log_warn "This will perform disaster recovery for scenario: $SCENARIO"
        log_warn "Current database will be RESTORED from backup"
        read -p "Type 'DISASTER-RECOVERY' to proceed: " CONFIRM

        if [[ "$CONFIRM" != "DISASTER-RECOVERY" ]]; then
            log "Recovery cancelled by user"
            exit 0
        fi
    fi

    local START_TIME
    START_TIME=$(date +%s)

    # Execute scenario
    case $SCENARIO in
        corruption)
            scenario_corruption
            ;;
        server-failure)
            scenario_server_failure
            ;;
        datacenter-outage)
            scenario_datacenter_outage
            ;;
        ransomware)
            scenario_ransomware
            ;;
        human-error)
            scenario_human_error
            ;;
        *)
            log_error "Unknown scenario: $SCENARIO"
            exit 1
            ;;
    esac

    local END_TIME RECOVERY_TIME
    END_TIME=$(date +%s)
    RECOVERY_TIME=$((END_TIME - START_TIME))

    log "=========================================="
    log_success "  DISASTER RECOVERY COMPLETE"
    log "  Total time: ${RECOVERY_TIME}s ($(date -u -d @${RECOVERY_TIME} +%H:%M:%S 2>/dev/null || echo "${RECOVERY_TIME}s"))"
    log "=========================================="

    generate_report << EOF
Scenario: $SCENARIO
Recovery duration: ${RECOVERY_TIME} seconds
Actions performed: Application stop, backup restore, verification, restart
Notes: Recovery completed successfully
EOF

    exit 0
}

main "$@"
