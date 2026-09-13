<!--
  HISTORY NOTE (documentation consolidation): PostgreSQL is now the only
  supported database and the app is multi-tenant (hostname -> platform).
  Steps below referencing SQLite, single-tenant flows, or `prisma migrate dev`
  are outdated. See PROJECT_DOCUMENTATION.md section 11 for the current runbook
  (migrate deploy + seeds, standalone build or Docker Compose).
-->

# StarPath Astrology - Production Launch Guide

## Status: READY FOR LAUNCH

All code changes complete. Database migrated and seeded. Build passing.

---

## Pre-Launch Checklist

### 1. Environment Variables (Required)

Edit `.env` with production values:

```bash
# Production domain (update before deploy)
NEXTAUTH_URL="https://your-domain.com"

# Generate new secret for production
# Run: openssl rand -base64 32
NEXTAUTH_SECRET="your-new-secret-here"

# Production database (recommended: PostgreSQL)
DATABASE_URL="postgresql://user:password@host:port/database"
DIRECT_URL="postgresql://user:password@host:port/database"

# AI Provider - Choose ONE option:

# Option A: Ollama (Free, self-hosted)
# Deploy Ollama to your server, then set:
OLLAMA_URL="http://your-ollama-server:11434"

# Option B: Anthropic (Paid, higher quality)
ANTHROPIC_API_KEY="sk-ant-..."

# Payments (optional - can add later)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### 2. Security Actions

- [ ] Change admin password from default `admin123`
- [ ] Generate new `NEXTAUTH_SECRET`
- [ ] Set strong passwords for all API keys
- [ ] Enable HTTPS on production domain

### 3. Database Setup

**Option A: Managed PostgreSQL (Recommended)**

1. Create database at [Neon](https://neon.tech) or [Supabase](https://supabase.com)
2. Copy connection string to `.env`
3. Run migrations:

```bash
npx prisma migrate deploy
```

**Option B: SQLite (Simple, low traffic)**

Already configured. No action needed.

### 4. Deploy Application

**Using Vercel:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Using other hosts (Railway, Render, etc.):**

1. Push code to GitHub
2. Connect repository to hosting platform
3. Set environment variables
4. Deploy

### 5. Post-Deploy Actions

1. **Run migrations** (if using PostgreSQL):

   ```bash
   npx prisma migrate deploy
   ```

2. **Verify admin access**:
   - Go to `https://your-domain.com/login`
   - Login: `admin@localhost` / `admin123`
   - Navigate to `/settings` to configure AI provider
   - Navigate to `/admin/plans` to verify plans

3. **Change admin password**:
   - Create new admin user via database or seed script
   - Or update password directly in database

4. **Test all features**:
   - Create birth chart
   - Generate horoscope
   - Test AI chat
   - Verify subscription flow (if Stripe configured)

---

## Deployment Options

### Vercel (Recommended)

**Pros:** Zero config, automatic HTTPS, edge functions, free tier

```bash
vercel --prod
```

### Railway

**Pros:** Simple, includes database, $5/month

1. Push to GitHub
2. Connect Railway to repo
3. Add PostgreSQL addon
4. Set environment variables
5. Deploy

### Render

**Pros:** Free tier, PostgreSQL included

1. Create Web Service
2. Connect GitHub repo
3. Add PostgreSQL database
4. Set environment variables
5. Deploy

### Self-Hosted (VPS)

**Pros:** Full control, cost-effective at scale

```bash
# Install Node.js, PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm i -g pm2

# Clone and setup
git clone <repo>
cd starpath-astrology
npm install
npx prisma migrate deploy

# Create systemd service or use PM2
pm2 start npm --name "starpath" -- start
pm2 save
pm2 startup
```

---

## AI Provider Setup

### Option 1: Ollama (Free)

1. **Install Ollama** on server:

   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```

2. **Pull model**:

   ```bash
   ollama pull llama3.2
   ```

3. **Configure in StarPath**:
   - Go to `/settings` as admin
   - Set Provider: Ollama
   - Set URL: `http://localhost:11434`
   - Set Model: `llama3.2`
   - Save

### Option 2: Anthropic Claude (Paid)

1. **Get API key**: https://console.anthropic.com

2. **Configure in StarPath**:
   - Go to `/settings` as admin
   - Set Provider: Anthropic
   - Set API Key: `sk-ant-...`
   - Set Model: `claude-sonnet-4-20250514`
   - Save

### Option 3: Google Gemini (Paid)

1. **Get API key**: https://makersuite.google.com

2. **Configure in StarPath**:
   - Go to `/settings` as admin
   - Set Provider: Gemini
   - Set API Key: `AIza...`
   - Set Model: `gemini-2.0-flash`
   - Save

---

## Stripe Setup (For Payments)

1. **Create Stripe account**: https://dashboard.stripe.com

2. **Create products**:
   - Product 1: "StarPath Monthly" → $9.99/month
   - Product 2: "StarPath Yearly" → $99.99/year

3. **Get Price IDs**:
   - Copy price IDs from Stripe Dashboard
   - Add to `.env`:
     ```
     STRIPE_PRICE_ID_MONTHLY="price_..."
     STRIPE_PRICE_ID_YEARLY="price_..."
     ```

4. **Configure webhook**:
   - Endpoint: `https://your-domain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment.*`
   - Copy webhook secret to `.env`:
     ```
     STRIPE_WEBHOOK_SECRET="whsec_..."
     ```

---

## Google OAuth Setup (Optional)

1. **Create credentials**: https://console.cloud.google.com/apis/credentials

2. **Configure**:
   - Authorized redirect URI: `https://your-domain.com/api/auth/callback/google`

3. **Add to `.env`**:
   ```
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   ```

---

## Monitoring & Maintenance

### Logs

```bash
# Vercel
vercel logs

# PM2
pm2 logs starpath

# Railway/Render
Check dashboard logs
```

### Database Backups

- **Neon**: Automatic daily backups
- **Supabase**: Automatic backups + point-in-time recovery
- **SQLite**: Manually backup `dev.db` file

### Health Checks

Monitor these endpoints:

- Homepage: `https://your-domain.com`
- API: `https://your-domain.com/api/astrology/chart`

### Updates

```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Run migrations (if any)
npx prisma migrate deploy

# Restart
pm2 restart starpath  # or redeploy on Vercel
```

---

## Troubleshooting

### AI not working

1. Check AI provider is running (Ollama) or API key is valid (Anthropic/Gemini)
2. Test connection at `/settings` → "Test Connection"
3. Check server logs for errors

### Database errors

1. Verify connection string in `.env`
2. Run `npx prisma generate`
3. Run `npx prisma migrate deploy`

### Auth not working

1. Verify `NEXTAUTH_URL` matches your domain
2. Regenerate `NEXTAUTH_SECRET`
3. Clear browser cookies

### Build fails

```bash
# Clean and rebuild
rm -rf node_modules .next
npm install
npm run build
```

---

## Support Contacts

- **Email**: privacy@starpathastrology.com
- **Documentation**: See README.md
- **Database Schema**: See prisma/schema.prisma

---

## Launch Confirmation

After completing all steps:

- [ ] Environment variables configured
- [ ] Database migrated
- [ ] Admin password changed
- [ ] AI provider configured and tested
- [ ] All pages load correctly
- [ ] Birth chart creation works
- [ ] Horoscope generation works
- [ ] AI chat works
- [ ] HTTPS enabled
- [ ] Monitoring set up

**You're ready to launch!**

---

**Last Updated:** April 14, 2026
**Version:** 1.0.0
