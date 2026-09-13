@AGENTS.md

# StarPath Astrology - Docker Deployment Guide

> Current architecture: multi-tenant white-label platform (PostgreSQL only).
> See `PROJECT_DOCUMENTATION.md` + `docs/MULTI_TENANCY.md` before deploying.
> Hosts `TENANT_ROOT_DOMAIN` / `NEXTAUTH_TRUST_HOST` are required env vars.

## Quick Start

### 1. Setup Environment

```bash
# Run the setup script
bash scripts/setup-docker.sh
```

This will:

- Generate secure passwords and secrets
- Create `.env.docker` file
- Set up necessary directories

### 2. Configure Environment Variables

Edit `.env.docker` and add your API keys:

```bash
# Required
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
ANTHROPIC_API_KEY=sk-ant-...

# Optional
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### 3. Build and Run

```bash
# Build the Docker image
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app
```

## Development Mode

For local development with external Next.js (hot reload):

```bash
# Start only database services
docker-compose -f docker-compose.dev.yml up -d

# Run Next.js locally (in another terminal)
npm run dev
```

## Production Deployment

### Using Docker Compose

```bash
# Create production env file
cp .env.docker .env.production
# Edit and update NEXTAUTH_URL to your domain

# Deploy
docker-compose -f docker-compose.yml up -d
```

### With Nginx Reverse Proxy

```bash
# 1. Copy and customize nginx config
cp nginx.conf.example nginx.conf

# 2. Add SSL certificates to ./ssl/ directory
mkdir -p ssl
# Place cert.pem and key.pem in ssl/

# 3. Uncomment nginx service in docker-compose.yml

# 4. Deploy
docker-compose up -d
```

## Useful Commands

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes database)
docker-compose down -v

# View logs for all services
docker-compose logs -f

# View specific service logs
docker-compose logs -f app

# Restart a service
docker-compose restart app

# Run database migrations manually
docker-compose exec app npx prisma migrate deploy

# Access database
docker-compose exec postgres psql -U starpath -d starpath

# Access Redis
docker-compose exec redis redis-cli

# Check health
docker-compose exec app ./healthcheck.sh
```

## Architecture

```
┌─────────────┐
│    Nginx    │  (Optional reverse proxy, SSL termination)
│  (port 80)  │
└──────┬──────┘
       │
┌──────▼──────┐
│  Next.js    │  (App server, port 3000)
│    App      │
└──────┬──────┘
       │
  ┌────┴────┐
  │         │
  ▼         ▼
┌──────┐ ┌──────┐
│Postgre│ │Redis │
│  SQL  │ │Cache │
└──────┘ └──────┘
```

## File Structure

```
.
├── Dockerfile                    # Multi-stage production build
├── docker-compose.yml            # Full production stack
├── docker-compose.dev.yml        # Development services only
├── .dockerignore                 # Build context exclusions
├── nginx.conf.example            # Nginx reverse proxy config
├── scripts/
│   ├── docker-entrypoint.sh      # Container startup script
│   ├── healthcheck.sh            # Health check script
│   └── setup-docker.sh           # Setup helper
├── secrets/                      # Docker secrets (gitignored)
│   └── db_password
└── .env.docker                   # Environment configuration
```

## Security Features

- **Non-root user**: App runs as `nextjs` user (UID 1001)
- **Multi-stage build**: Minimal production image
- **Secrets management**: Passwords stored in Docker secrets
- **Health checks**: Automated container health monitoring
- **Security headers**: XSS, CSRF, clickjacking protection
- **Signal handling**: Graceful shutdown on SIGTERM
