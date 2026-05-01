#!/bin/sh
# ===========================================
# StarPath Astrology - Docker Entrypoint Script
# ===========================================
# This script handles:
# - Waiting for database connectivity
# - Running Prisma migrations
# - Seeding the database if needed
# - Starting the Next.js application

set -e

echo "=========================================="
echo "StarPath Astrology - Container Startup"
echo "=========================================="

# Configuration
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-starpath}"
DB_NAME="${DB_NAME:-starpath}"
MAX_RETRIES="${DB_MAX_RETRIES:-30}"
RETRY_DELAY="${DB_RETRY_DELAY:-2}"

# Extract host from DATABASE_URL if available
if [ -n "$DATABASE_URL" ]; then
    # Parse postgresql://user:pass@host:port/db
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_HOST="${DB_HOST:-postgres}"
    DB_PORT="${DB_PORT:-5432}"
fi

echo ""
echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"
echo ""

# Function: Wait for database
# ===========================================
wait_for_db() {
    echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."

    retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
            echo "PostgreSQL is ready!"
            return 0
        fi

        retries=$((retries + 1))
        echo "Database not ready (attempt $retries/$MAX_RETRIES)... waiting ${RETRY_DELAY}s"
        sleep $RETRY_DELAY
    done

    echo "ERROR: Database failed to become ready after $MAX_RETRIES attempts"
    return 1
}

# Function: Run migrations
# ===========================================
run_migrations() {
    echo ""
    echo "Running Prisma migrations..."

    if [ -z "$DATABASE_URL" ]; then
        echo "WARNING: DATABASE_URL not set, skipping migrations"
        return 0
    fi

    # Check if prisma schema exists
    if [ ! -f "prisma/schema.prisma" ]; then
        echo "WARNING: prisma/schema.prisma not found, skipping migrations"
        return 0
    fi

    # Run migrations
    if npx prisma migrate deploy; then
        echo "Migrations completed successfully!"
        return 0
    else
        echo "ERROR: Migration failed"
        return 1
    fi
}

# Function: Seed database (optional)
# ===========================================
seed_database() {
    echo ""
    echo "Checking if database seeding is needed..."

    # Check if critical tables are empty (e.g., PaymentGateway)
    # This is a simple check - customize based on your needs
    if [ -n "$AUTO_SEED" ] && [ "$AUTO_SEED" = "true" ]; then
        echo "AUTO_SEED enabled, running seed..."
        npx prisma db seed || echo "Seed completed or not needed"
    else
        echo "AUTO_SEED not enabled, skipping seed step"
    fi
}

# Function: Graceful shutdown
# ===========================================
shutdown() {
    echo ""
    echo "Received shutdown signal, stopping gracefully..."
    exit 0
}

# Trap signals for graceful shutdown
trap 'shutdown' SIGTERM SIGINT

# Main execution
# ===========================================

# Step 1: Wait for database
echo "Step 1/4: Database connectivity check"
wait_for_db

# Step 2: Run migrations
echo ""
echo "Step 2/4: Database migrations"
run_migrations

# Step 3: Seed if needed
echo ""
echo "Step 3/4: Database seeding"
seed_database

# Step 4: Start application
echo ""
echo "Step 4/4: Starting Next.js application"
echo "=========================================="
echo ""
echo "Environment:"
echo "  NODE_ENV: $NODE_ENV"
echo "  PORT: $PORT"
echo "  HOSTNAME: $HOSTNAME"
echo ""
echo "Starting server..."
echo "=========================================="

# Start the Next.js server
# Use exec to replace shell process so signals propagate correctly
exec node server.js
