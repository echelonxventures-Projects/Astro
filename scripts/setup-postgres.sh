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

# Backup SQLite schema
echo "📦 Backing up SQLite schema..."
cp prisma/schema.prisma prisma/schema.prisma.sqlite

# Copy PostgreSQL schema to main schema file
echo "📄 Switching to PostgreSQL schema..."
cp prisma/schema.prisma.postgresql prisma/schema.prisma

# Generate Prisma client
echo "⚡ Generating Prisma client..."
npx prisma generate

# Push schema to database (creates tables)
echo "📊 Pushing schema to PostgreSQL..."
npx prisma db push --accept-data-loss

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