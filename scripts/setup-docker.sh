#!/bin/bash
# ===========================================
# Docker Setup Helper Script
# ===========================================

set -e

echo "=========================================="
echo "StarPath Astrology - Docker Setup"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to generate random password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Check prerequisites
# ===========================================
echo ""
echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}Docker and Docker Compose are installed${NC}"

# Create secrets directory
# ===========================================
echo ""
echo "Setting up secrets..."

mkdir -p secrets

# Create database password if it doesn't exist
if [ ! -f secrets/db_password ]; then
    DB_PASSWORD=$(generate_password)
    echo "$DB_PASSWORD" > secrets/db_password
    echo -e "${GREEN}Created database password${NC}"
else
    echo -e "${YELLOW}Database password already exists${NC}"
fi

# Create NextAuth secret if it doesn't exist
if [ ! -f secrets/nextauth_secret ]; then
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    echo "$NEXTAUTH_SECRET" > secrets/nextauth_secret
    echo -e "${GREEN}Created NextAuth secret${NC}"
else
    echo -e "${YELLOW}NextAuth secret already exists${NC}"
fi

# Set permissions
echo ""
echo "Setting permissions..."
chmod 600 secrets/*
chmod +x scripts/docker-entrypoint.sh
chmod +x scripts/healthcheck.sh

echo -e "${GREEN}Permissions set${NC}"

# Create .env.docker file if it doesn't exist
# ===========================================
if [ ! -f .env.docker ]; then
    echo ""
    echo "Creating .env.docker file..."

    DB_PASSWORD=$(cat secrets/db_password)
    NEXTAUTH_SECRET=$(cat secrets/nextauth_secret)

    cat > .env.docker << EOF
# Database
DATABASE_URL=postgresql://starpath:${DB_PASSWORD}@postgres:5432/starpath?schema=public
DIRECT_URL=postgresql://starpath:${DB_PASSWORD}@postgres:5432/starpath?schema=public

# NextAuth
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=http://localhost:3000

# Redis
REDIS_URL=redis://redis:6379

# Stripe (fill these in)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_MONTHLY=
STRIPE_PRICE_ID_YEARLY=

# Anthropic AI (fill this in)
ANTHROPIC_API_KEY=

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email (optional)
RESEND_API_KEY=

# Cloudinary (optional)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
EOF

    echo -e "${GREEN}Created .env.docker file${NC}"
    echo -e "${YELLOW}Note: Please fill in your Stripe and API keys in .env.docker${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Fill in your API keys in .env.docker"
echo "  2. Build the Docker image:"
echo "     docker-compose build"
echo "  3. Start the services:"
echo "     docker-compose up -d"
echo "  4. View logs:"
echo "     docker-compose logs -f"
echo ""
echo "For development (PostgreSQL + Redis only):"
echo "  docker-compose -f docker-compose.dev.yml up -d"
echo "=========================================="
