# Deployment Guide - StarPath Astrology

## Deployment to OCI Always Free Instance

### Prerequisites

1. Oracle Cloud Infrastructure (OCI) Always Free VM.Standard.E2.1.Micro instance
2. Domain: `astro.echelonxventures.org`
3. SSH access to the server
4. Node.js 20+ installed on server
5. PM2 process manager installed

### Admin Routes

After deployment, access the admin panels at:

| Panel | URL | Description |
|-------|-----|-------------|
| Payment Gateways | `/admin/payments` | Manage Stripe, Razorpay, payment methods, transactions |
| Subscription Plans | `/admin/plans` | Configure pricing plans and features |
| AI Settings | `/settings` | AI provider configuration |

**Note:** All admin routes require:
- Valid login (redirects to `/login` if not authenticated)
- User role = `admin` (redirects to dashboard if not admin)

To set a user as admin after deployment:
```bash
sqlite3 prisma/prod.db
UPDATE "User" SET role = 'admin' WHERE email = 'your-email@example.com';
```

### Step 1: Transfer Files to Server

From your local machine, run:

```bash
# Create deployment package
tar -czf starpath-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.env' \
  .

# Transfer to server (update username and IP)
scp starpath-deploy.tar.gz opc@<SERVER_IP>:/home/opc/starpath
```

### Step 2: Connect to Server and Setup

```bash
# SSH into server
ssh opc@<SERVER_IP>

# Navigate to app directory
cd /home/opc/starpath

# Extract files
tar -xzf starpath-deploy.tar.gz

# Install dependencies
npm install

# Setup environment
cp .env.example .env.production
# Edit .env.production with your production values
```

### Step 3: Configure Environment Variables

Edit `.env.production` with the following values:

```bash
# Database (using SQLite for simplicity)
DATABASE_URL="file:./prod.db"
DIRECT_URL="file:./prod.db"

# NextAuth
NEXTAUTH_URL="https://astro.echelonxventures.org"
NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"

# Razorpay (for Indian market)
RAZORPAY_KEY_ID="<your_razorpay_key_id>"
RAZORPAY_KEY_SECRET="<your_razorpay_key_secret>"
RAZORPAY_WEBHOOK_SECRET="<your_razorpay_webhook_secret>"

# Stripe (for international)
STRIPE_SECRET_KEY="<your_stripe_secret_key>"
STRIPE_WEBHOOK_SECRET="<your_stripe_webhook_secret>"

# OpenRouter (for AI)
OPENROUTER_API_KEY="<your_openrouter_api_key>"

# Google OAuth
GOOGLE_CLIENT_ID="<your_google_client_id>"
GOOGLE_CLIENT_SECRET="<your_google_client_secret>"
```

### Step 4: Run Database Migrations

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed initial data (if you have a seed script)
npm run db:seed
```

### Step 5: Build Application

```bash
npm run build
```

### Step 6: Start with PM2

```bash
# Start the application
pm2 start npm --name "starpath-astrology" -- start

# Or use the start script if available
pm2 start npm --name "starpath-astrology" -- run start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Step 7: Configure Webhook URLs

Configure webhook URLs in your payment gateway dashboards:

**Razorpay:**
- Webhook URL: `https://astro.echelonxventures.org/api/payment/webhook/razorpay`
- Events: payment.authorized, payment.captured, payment.failed, subscription.activated, subscription.cancelled

**Stripe:**
- Webhook URL: `https://astro.echelonxventures.org/api/payment/webhook/stripe`
- Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed

### Step 8: Verify Deployment

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs starpath-astrology

# Test the application
curl https://astro.echelonxventures.org
```

## Payment Gateway Configuration

After deployment, you need to configure the payment gateways in the database:

### Option 1: Using Admin Panel (if available)

Navigate to `/admin/payments` and configure:
- Enable Stripe and Razorpay gateways
- Add API keys and secrets
- Set default gateway
- Configure payment methods

### Option 2: Direct Database Insert

Create a seed script or run SQLite commands:

```bash
# Connect to SQLite
sqlite3 prisma/prod.db

-- Insert Stripe gateway
INSERT INTO "PaymentGateway" (id, name, key, apiKey, apiSecret, webhookSecret, isEnabled, isDefault, supportedCurrencies, supportedCountries, testMode, sortOrder, createdAt, updatedAt)
VALUES ('stripe_1', 'Stripe', 'stripe', '<encrypted_stripe_key>', '<encrypted_stripe_secret>', '<encrypted_stripe_webhook>', 1, 1, '["USD","EUR","GBP","INR"]', '["US","GB","IN"]', 0, 1, datetime('now'), datetime('now'));

-- Insert Razorpay gateway
INSERT INTO "PaymentGateway" (id, name, key, publicKey, apiSecret, webhookSecret, isEnabled, isDefault, supportedCurrencies, supportedCountries, testMode, sortOrder, createdAt, updatedAt)
VALUES ('razorpay_1', 'Razorpay', 'razorpay', '<your_razorpay_key_id>', '<encrypted_razorpay_secret>', '<encrypted_razorpay_webhook>', 1, 0, '["INR","USD","EUR"]', '["IN","US","GB"]', 0, 2, datetime('now'), datetime('now'));
```

## Payment Methods Configuration

For Razorpay, configure these payment methods:

```sql
-- UPI
INSERT INTO "PaymentMethod" (id, gatewayId, name, key, isEnabled, sortOrder, createdAt, updatedAt)
VALUES ('upi_1', 'razorpay_1', 'UPI', 'upi', 1, 1, datetime('now'), datetime('now'));

-- Cards
INSERT INTO "PaymentMethod" (id, gatewayId, name, key, isEnabled, sortOrder, createdAt, updatedAt)
VALUES ('card_1', 'razorpay_1', 'Credit/Debit Card', 'card', 1, 2, datetime('now'), datetime('now'));

-- Netbanking
INSERT INTO "PaymentMethod" (id, gatewayId, name, key, isEnabled, sortOrder, createdAt, updatedAt)
VALUES ('netbanking_1', 'razorpay_1', 'Net Banking', 'netbanking', 1, 3, datetime('now'), datetime('now'));

-- Wallets
INSERT INTO "PaymentMethod" (id, gatewayId, name, key, isEnabled, sortOrder, createdAt, updatedAt)
VALUES ('wallet_1', 'razorpay_1', 'Wallets', 'wallet', 1, 4, datetime('now'), datetime('now'));
```

## Troubleshooting

### Application won't start
```bash
pm2 logs starpath-astrology --lines 100
```

### Database errors
```bash
npx prisma db check
npx prisma db push
```

### Port 3000 already in use
```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>
```

### SSL Certificate issues
```bash
# If using Cloudflare SSL, ensure DNS is pointed correctly
# A record: astro.echelonxventures.org -> <SERVER_IP>
```

## Monitoring

### PM2 Commands
```bash
pm2 status              # Check app status
pm2 logs                # View logs
pm2 restart starpath    # Restart app
pm2 stop starpath       # Stop app
pm2 delete starpath     # Delete from PM2
pm2 monit               # Real-time monitoring
```

### Database Backup
```bash
# Backup SQLite database
cp prisma/prod.db prisma/prod.db.backup.$(date +%Y%m%d)
```

## Security Considerations

1. **API Keys**: All sensitive data in `.env.production` should be properly secured
2. **Database**: Ensure database file is not accessible via web
3. **Webhooks**: Always verify webhook signatures
4. **HTTPS**: Use Cloudflare SSL or Let's Encrypt
5. **Rate Limiting**: Consider adding rate limiting for API endpoints
