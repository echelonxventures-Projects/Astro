#!/bin/sh
# ===========================================
# StarPath Astrology - Health Check Script
# ===========================================
# This script performs comprehensive health checks:
# - HTTP endpoint check (/health or /)
# - Database connectivity
# Returns: 0 for healthy, 1 for unhealthy

set -e

# Configuration
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-http://localhost:3000/health}"
ALT_ENDPOINT="${ALT_ENDPOINT:-http://localhost:3000}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
TIMEOUT="${HEALTH_TIMEOUT:-5}"

# Colors for output (if terminal supports it)
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function: Check HTTP endpoint
# ===========================================
check_http() {
    # Try primary endpoint first
    if wget --quiet --tries=1 --timeout=$TIMEOUT --spider "$HEALTH_ENDPOINT" 2>/dev/null; then
        return 0
    fi

    # Fallback to alternative endpoint
    if wget --quiet --tries=1 --timeout=$TIMEOUT --spider "$ALT_ENDPOINT" 2>/dev/null; then
        return 0
    fi

    # Try with curl if available
    if command -v curl >/dev/null 2>&1; then
        if curl -fsS --max-time $TIMEOUT "$HEALTH_ENDPOINT" >/dev/null 2>&1; then
            return 0
        fi
        if curl -fsS --max-time $TIMEOUT "$ALT_ENDPOINT" >/dev/null 2>&1; then
            return 0
        fi
    fi

    return 1
}

# Function: Check database connectivity
# ===========================================
check_database() {
    # Parse database host from DATABASE_URL if available
    if [ -n "$DATABASE_URL" ]; then
        DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_HOST="${DB_HOST:-postgres}"
        DB_PORT="${DB_PORT:-5432}"
    fi

    # Check if database is reachable
    if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
        return 0
    fi

    return 1
}

# Main health check
# ===========================================

# Check HTTP endpoint
check_http
HTTP_STATUS=$?

# Check database connectivity
check_database
DB_STATUS=$?

# Evaluate overall health
# ===========================================
if [ $HTTP_STATUS -eq 0 ] && [ $DB_STATUS -eq 0 ]; then
    # All checks passed
    exit 0
else
    # At least one check failed
    exit 1
fi
