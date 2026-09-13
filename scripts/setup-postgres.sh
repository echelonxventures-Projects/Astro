#!/bin/bash
# PostgreSQL Setup Script for StarPath Astrology
# Run this script to switch from SQLite to PostgreSQL

set -e

echo "🚀 Setting up PostgreSQL for StarPath Astrology..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set DATABASE_URL and DIRECT_URL for PostgreSQL:"
    echo "  export DATABASE_URL='postgresql://user:password@host:port/starpath'"
    echo "  export DIRECT_URL='postgresql://user:password@host:port/starpath'"
    echo ""
    echo "Popular PostgreSQL providers:"
    echo "  - Neon (https://neon.tech) - Free tier available"
    echo "  - Supabase (https://supabase.com) - Free tier available"
    echo "  - Railway (https://railway.app) - Simple deployment"
    echo "  - AWS RDS - Enterprise option"
    exit 1
fi

echo "✅ DATABASE_URL is set"

# Schema is PostgreSQL-canonical; no schema switching needed
echo "📄 Using canonical PostgreSQL schema (prisma/schema.prisma)"

# Generate Prisma client
echo "⚡ Generating Prisma client..."
npx prisma generate

# Apply migrations (creates tables)
echo "📊 Applying migrations to PostgreSQL..."
npx prisma migrate deploy

# Seed default data
echo "🌱 Seeding default data..."
npx tsx prisma/seed.ts

# Seed payment gateways
echo "💳 Seeding payment gateways..."
npx tsx prisma/seed-payment-gateways.ts

echo ""
echo "✅ PostgreSQL setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Update NEXTAUTH_URL in .env to your production domain"
echo "  2. Generate NEXTAUTH_SECRET: openssl rand -base64 32"
echo "  3. Run: npm run build"
echo "  4. Deploy to your server"
echo ""
echo "🔄 To switch back to SQLite for development:"
echo "  cp prisma/schema.prisma.sqlite prisma/schema.prisma"
echo "  npx prisma generate"