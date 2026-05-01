# StarPath Astrology - Production Deployment Guide

## Prerequisites

- Node.js 20+
- PostgreSQL database (Neon, Supabase, Railway, or self-hosted)
- Domain name with SSL certificate
- Payment gateway accounts (Stripe for international, Razorpay for India)

---

## Step 1: PostgreSQL Database Setup

### Option A: Neon (Recommended - Free Tier)

1. Go to https://neon.tech and create account
2. Create new project named "starpath"
3. Copy connection string from dashboard
4. Add to `.env.production`:
   ```
   DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/starpath?sslmode=require"
   DIRECT_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/starpath?sslmode=require"
   ```

### Option B: Supabase (Free Tier)

1. Go to https://supabase.com and create account
2. Create new project
3. Go to Settings > Database
4. Copy connection string (enable SSL)
5. Add to `.env.production`:
   ```
   DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres?sslmode=require"
   DIRECT_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres?sslmode=require"
   ```

### Option C: Railway

1. Go to https://railway.app and create account
2. Create PostgreSQL service
3. Copy connection variables
4. Add to `.env.production`

---

## Step 2: Initialize Database

After setting DATABASE_URL and DIRECT_URL:

```bash
# Run the PostgreSQL setup script
npm run db:setup-postgres

# Or manually:
npm run db:generate
npm run db:push
npm run db:seed
```

This will:
- Switch from SQLite schema to PostgreSQL schema
- Generate Prisma client
- Create all tables
- Seed default data and payment gateways

---

## Step 3: Security Configuration

### Generate Secrets

```bash
# NextAuth secret (for JWT signing)
openssl rand -base64 32

# Encryption key (for payment gateway credentials)
openssl rand -base64 32
```

Add to `.env.production`:
```
NEXTAUTH_SECRET="your-generated-secret"
ENCRYPTION_KEY="your-encryption-key"
```

### Update URLs

```
NEXTAUTH_URL="https://your-domain.com"
```

---

## Step 4: AI Provider Configuration

### Free Tier (OpenRouter)

1. Go to https://openrouter.ai
2. Create account and get API key
3. Add to `.env.production`:
   ```
   OPENROUTER_API_KEY="sk-or-v1-xxx"
   ```

Free models work without API key (rate limited):
- `meta-llama/llama-3.2-3b-instruct:free`
- `google/gemma-3-1b-it:free`

### Free Tier (NVIDIA NIM)

1. Go to https://build.nvidia.com
2. Create account and get API key
3. Add to `.env.production`:
   ```
   NVIDIA_API_KEY="nvapi-xxx"
   ```

Popular models:
- `meta/llama-3.1-8b-instruct`
- `meta/llama-3.2-3b-instruct`

### Free Tier (OpenCode - Local)

OpenCode provides free AI via local server (no API key needed):

1. Install OpenCode CLI:
   ```bash
   # Via npm
   npm install -g @opencode-ai/cli
   ```

2. Start server:
   ```bash
   opencode serve --port 8080
   ```

3. Add to `.env`:
   ```
   OPENCODE_URL="http://localhost:8080"
   ```

Free models available:
- `opencode/minimax-m2.5-free`
- `opencode/nemotron-3-super-free`
- `opencode/hy3-preview-free`

### Premium (Anthropic Claude)

```
ANTHROPIC_API_KEY="sk-ant-xxx"
```

---

## Step 5: Payment Gateways

### Stripe (International Payments)

1. Go to https://dashboard.stripe.com
2. Get API keys from Developers > API Keys
3. Create products and prices:
   - Monthly subscription
   - Yearly subscription
4. Add webhook endpoint and get signing secret
5. Add to `.env.production`:
   ```
   STRIPE_SECRET_KEY="sk_live_xxx"
   STRIPE_WEBHOOK_SECRET="whsec_xxx"
   STRIPE_PRICE_ID_MONTHLY="price_xxx"
   STRIPE_PRICE_ID_YEARLY="price_xxx"
   ```

### Razorpay (India Payments)

1. Go to https://dashboard.razorpay.com
2. Get Key ID and Key Secret
3. Create subscription plans
4. Add webhook endpoint
5. Add to `.env.production`:
   ```
   RAZORPAY_KEY_ID="rzp_live_xxx"
   RAZORPAY_KEY_SECRET="xxx"
   RAZORPAY_WEBHOOK_SECRET="xxx"
   ```

---

## Step 6: Optional Services

### Google OAuth

1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-domain.com/api/auth/callback/google`
4. Add to `.env.production`:
   ```
   GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="GOCSPX-xxx"
   ```

### Cloudinary (Image Uploads)

1. Go to https://cloudinary.com
2. Get cloud name, API key, API secret
3. Add to `.env.production`:
   ```
   CLOUDINARY_CLOUD_NAME="xxx"
   CLOUDINARY_API_KEY="xxx"
   CLOUDINARY_API_SECRET="xxx"
   ```

### Resend (Email Notifications)

1. Go to https://resend.com
2. Get API key
3. Add to `.env.production`:
   ```
   RESEND_API_KEY="re_xxx"
   ```

---

## Step 7: Build and Deploy

```bash
# Prepare for deployment
npm run deploy:prepare

# Or step by step:
npm run db:generate
npm run build
```

### Deployment Options

#### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set environment variables in Vercel dashboard.

#### Docker

```bash
# Build image
docker build -t starpath-astrology .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="xxx" \
  -e NEXTAUTH_URL="xxx" \
  -e NEXTAUTH_SECRET="xxx" \
  starpath-astrology
```

#### Self-hosted (PM2)

```bash
# Install PM2
npm i -g pm2

# Start application
pm2 start npm --name "starpath" -- start

# Save PM2 config
pm2 save

# Setup startup script
pm2 startup
```

---

## Step 8: Post-Deployment

### Change Admin Password

Default admin credentials should be changed immediately:
- Email: `admin@starpath.com`
- Password: `admin123`

Login and update via profile settings.

### Verify Services

1. Test user registration/login
2. Test Google OAuth
3. Test birth chart generation
4. Test AI chat functionality
5. Test payment flows (test mode first)
6. Test webhook endpoints

### Setup Monitoring

- Configure error tracking (Sentry, LogRocket)
- Setup uptime monitoring
- Monitor database performance

---

## Database Schema Overview

The PostgreSQL schema includes:

| Model | Purpose |
|-------|---------|
| User | User accounts and profiles |
| Account | OAuth provider accounts |
| Session | User sessions |
| BirthChart | Saved birth charts |
| Reading | Generated readings |
| ChatSession | AI chat history |
| Subscription | User subscriptions |
| Payment | Payment records |
| PaymentGateway | Gateway configurations |
| PaymentMethod | Payment methods per gateway |
| GatewayPlan | Gateway-specific plan IDs |
| PaymentTransaction | Unified transaction records |
| SubscriptionPlan | Configurable plans |
| PlanFeature | Feature definitions |
| PlanFeatureAccess | Plan-feature mappings |
| Region | Regional configurations |
| AIProviderConfig | AI provider settings |
| AppSettings | Application settings |

---

## Troubleshooting

### Database Connection Errors

```bash
# Check connection
npx prisma db pull

# Reset database (WARNING: destroys data)
npx prisma db push --force-reset
```

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

### Authentication Issues

- Verify NEXTAUTH_URL matches your domain
- Check NEXTAUTH_SECRET is set
- Ensure cookies work with HTTPS

---

## Environment Variables Checklist

| Variable | Required | Source |
|----------|----------|--------|
| DATABASE_URL | Yes | PostgreSQL provider |
| DIRECT_URL | Yes | PostgreSQL provider |
| NEXTAUTH_URL | Yes | Your domain |
| NEXTAUTH_SECRET | Yes | Generated |
| ENCRYPTION_KEY | Yes | Generated |
| OPENROUTER_API_KEY | Recommended | OpenRouter |
| STRIPE_SECRET_KEY | Payments | Stripe |
| RAZORPAY_KEY_ID | India | Razorpay |
| GOOGLE_CLIENT_ID | OAuth | Google Cloud |
| CLOUDINARY_CLOUD_NAME | Images | Cloudinary |
| RESEND_API_KEY | Email | Resend |