# StarPath Astrology - Project Documentation

## Overview

StarPath Astrology is a full-featured, production-ready AI-powered astrology platform built with modern web technologies. It provides personalized birth charts, AI-guided horoscopes, compatibility readings, palmistry, face reading, and a subscription-based premium tier system.

---

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Technology Stack](#technology-stack)
3. [Features](#features)
4. [Directory Structure](#directory-structure)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [AI Integration](#ai-integration)
8. [Payment Gateway System](#payment-gateway-system)
9. [Authentication & Security](#authentication--security)
10. [Configuration](#configuration)
11. [Deployment](#deployment)

---

## Project Architecture

### Design Patterns

- **App Router**: Next.js 16 App Router with route groups for organization
- **Server/Client Components**: Hybrid rendering with server-side auth checks
- **Factory Pattern**: AI providers and payment gateways use factory pattern
- **Interface Pattern**: Unified interfaces for multiple AI/payment providers
- **Repository Pattern**: Prisma ORM abstracts database operations

### Route Groups

| Group | Purpose | Access |
|-------|---------|--------|
| `(auth)` | Login/signup pages | Public |
| `(dashboard)` | User features | Authenticated |
| `(admin)` | Admin settings | Admin role only |
| `api/` | API routes | Mixed (public/admin) |

---

## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | Next.js | 16.2.3 |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | 4.x |
| **Animations** | Framer Motion | 12.x |
| **Icons** | Lucide React | 1.8.x |
| **Database** | SQLite (dev) / PostgreSQL (prod) | - |
| **ORM** | Prisma | 6.19.3 |
| **Authentication** | NextAuth.js | 4.24.x |
| **AI Providers** | Ollama, Anthropic, Gemini, OpenRouter | - |
| **Payments** | Stripe, Razorpay | Stripe 22.x |
| **State Management** | Zustand | 5.x |
| **Date Handling** | date-fns | 4.x |

---

## Features

### Core Features

| Feature | Description | Access Level |
|---------|-------------|--------------|
| **Birth Chart Generation** | Calculate planetary positions, houses, aspects | All users |
| **Daily Horoscope** | AI-generated daily readings based on birth chart | All users (limited for free) |
| **Love Horoscope** | Relationship-focused readings | Premium |
| **Career Horoscope** | Career guidance readings | Premium |
| **Compatibility Reading** | Synastry analysis between two charts | Premium |
| **AI Chat** | Conversational astrology consultations | Premium |
| **Palmistry** | AI palm reading from uploaded images | Premium |
| **Face Reading** | Chinese physiognomy analysis | Premium |

### Admin Features

| Feature | Route | Description |
|---------|-------|-------------|
| **AI Provider Settings** | `/settings` | Configure AI providers per subscription tier |
| **Plan Management** | `/admin/plans` | Create/edit subscription plans with features |
| **Payment Gateway Admin** | `/admin/payments` | Manage gateways, methods, transactions |

---

## Directory Structure

```
trustastrology-clone/
├── prisma/
│   ├── schema.prisma              # SQLite schema (default)
│   ├── schema.prisma.postgresql   # PostgreSQL schema
│   └── seed.ts                    # Database seeding
│   └── seed-payment-gateways.ts   # Payment gateway seeding
│
├── src/
│   ├── app/
│   │   ├── (auth)/               # Authentication routes
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   │
│   │   ├── (dashboard)/          # User features
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── chart/page.tsx
│   │   │   ├── horoscope/
│   │   │   │   ├── daily/page.tsx
│   │   │   │   ├── love/page.tsx
│   │   │   │   └── career/page.tsx
│   │   │   ├── compatibility/page.tsx
│   │   │   ├── chat/horoscope/page.tsx
│   │   │   ├── palmistry/page.tsx
│   │   │   ├── face-reading/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   └── subscription/page.tsx
│   │   │
│   │   ├── (admin)/              # Admin routes (protected)
│   │   │   ├── settings/page.tsx
│   │   │   ├── admin/
│   │   │   │   ├── plans/page.tsx
│   │   │   │   └── payments/page.tsx
│   │   │
│   │   ├── api/                  # API routes
│   │   │   ├── auth/
│   │   │   ├── astrology/
│   │   │   ├── settings/
│   │   │   ├── admin/
│   │   │   ├── payment/
│   │   │   └── stripe/
│   │   │
│   │   ├── pricing/page.tsx      # Public pricing page
│   │   ├── privacy/page.tsx
│   │   ├── terms/page.tsx
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Homepage
│   │
│   ├── components/
│   │   └── AuthProvider.tsx      # Session provider wrapper
│   │
│   ├── lib/
│   │   ├── ai/                   # AI integration
│   │   │   ├── provider.ts       # Provider interface
│   │   │   ├── client.ts         # AI client factory
│   │   │   ├── anthropic-provider.ts
│   │   │   ├── gemini-provider.ts
│   │   │   ├── ollama-provider.ts
│   │   │   ├── openrouter-provider.ts
│   │   │   ├── astrology-prompts.ts
│   │   │   └── plan-config.ts
│   │   │
│   │   ├── astrology/            # Astrology calculations
│   │   │   └── calculations.ts   # Birth chart engine
│   │   │
│   │   ├── payment/              # Payment gateways
│   │   │   ├── gateway-interface.ts
│   │   │   ├── gateway-registry.ts
│   │   │   ├── stripe-gateway.ts
│   │   │   ├── razorpay-gateway.ts
│   │   │   ├── paypal-gateway.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── auth.ts               # NextAuth configuration
│   │   ├── db.ts                 # Prisma client
│   │   ├── plans.ts              # Subscription plans
│   │   ├── settings.ts           # App settings
│   │   ├── branding.ts           # Branding constants
│   │   └── stripe.ts             # Stripe utilities
│   │
│   └── types/
│       └── index.ts              # TypeScript types
│
├── public/                       # Static assets
├── scripts/
│   └── deploy.sh                 # Deployment script
│
└── Configuration Files
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── tailwind.config
    ├── postcss.config.mjs
    └── eslint.config.mjs
```

---

## Database Schema

### Core Tables

| Model | Purpose | Key Fields |
|-------|---------|------------|
| **User** | User accounts | email, passwordHash, role, subscriptionStatus, birthDetails |
| **Account** | OAuth links | provider, providerAccountId |
| **Session** | Auth sessions | sessionToken, expires |
| **BirthChart** | Calculated charts | planets (JSON), houses (JSON), aspects (JSON) |
| **Reading** | AI readings | type, content, input (JSON) |
| **ChatSession** | AI conversations | messages (JSON), metadata (JSON) |
| **Subscription** | Stripe subscriptions | stripeSubscriptionId, plan, status |
| **Payment** | Payment history | stripePaymentId, amount, currency, status |

### Configuration Tables

| Model | Purpose | Key Fields |
|-------|---------|------------|
| **AppSettings** | Global settings | key, value (e.g., AI_PROVIDER, AI_MODEL) |
| **AIProviderConfig** | Per-plan AI config | provider, model, apiKey, maxTokens, plan |
| **SubscriptionPlan** | Dynamic plans | name, key, price, interval, features (JSON) |
| **PlanFeature** | Feature definitions | name, key, category |
| **PlanFeatureAccess** | Plan-feature matrix | planId, featureId, enabled, value |
| **Region** | Regional settings | name, code, currency, priceMultiplier |

### Payment Tables

| Model | Purpose | Key Fields |
|-------|---------|------------|
| **PaymentGateway** | Gateway config | name, key, apiKey, apiSecret, isEnabled |
| **PaymentMethod** | Methods per gateway | name, key (upi, card, netbanking) |
| **GatewayPlan** | Gateway-plan mapping | gatewayPlanId (Stripe/Razorpay Price ID) |
| **PaymentTransaction** | Unified transactions | gatewayTransactionId, status, amount |

---

## API Endpoints

### Authentication APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/signup` | POST | Create new account |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth endpoints |

### Astrology APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/astrology/chart` | GET | Get user's birth charts |
| `/api/astrology/chart` | POST | Create/save birth chart |
| `/api/astrology/generate` | POST | Generate AI reading |
| `/api/astrology/chat` | GET | Get chat sessions |
| `/api/astrology/chat` | POST | Send message to AI |
| `/api/astrology/palmistry` | POST | Analyze palm image |
| `/api/astrology/face-reading` | POST | Analyze face image |

### Payment APIs

| Endpoint | Method | Purpose | Access |
|----------|--------|---------|--------|
| `/api/payment/checkout` | POST | Create checkout session | Public |
| `/api/payment/methods` | GET | Get available methods | Public |
| `/api/payment/subscription` | GET/POST | Manage subscription | Authenticated |
| `/api/payment/webhook/stripe` | POST | Stripe webhook | Public |
| `/api/payment/webhook/razorpay` | POST | Razorpay webhook | Public |

### Admin APIs (Protected)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/plans` | GET | Get all plans, features, regions |
| `/api/admin/plans` | POST | Create/update/delete plans |
| `/api/admin/payments` | GET | Get gateways, methods, transactions |
| `/api/admin/payments` | POST | Manage gateway configuration |
| `/api/settings` | GET/POST | AI provider settings |
| `/api/settings/plans` | GET/POST | Plan-specific AI config |

---

## AI Integration

### Supported Providers

| Provider | Use Case | API Key Required | Vision Support |
|----------|----------|------------------|----------------|
| **Ollama** | Free tier, local | No | No |
| **Anthropic Claude** | Premium | Yes | Yes |
| **Google Gemini** | Premium alternative | Yes | Yes |
| **OpenRouter** | Multi-model access | Yes | Depends on model |

### Provider Interface

```typescript
interface AIProvider {
  name: string
  supportsVision: boolean
  complete(request: TextCompletionRequest): Promise<string>
  completeWithVision?(request: VisionCompletionRequest): Promise<string>
}
```

### Per-Plan AI Configuration

| Plan | Default Provider | Default Model | Max Tokens |
|------|------------------|---------------|------------|
| Free | OpenRouter | meta-llama/llama-3.2-3b-instruct | 512 |
| Monthly | Anthropic | claude-sonnet-4-20250514 | 1024 |
| Yearly | Anthropic | claude-opus-4-7 | 2048 |

### Astrology Prompts

Located in `src/lib/ai/astrology-prompts.ts`:
- Birth chart interpretation prompts
- Daily horoscope generation
- Love/Career reading templates
- Compatibility analysis prompts
- Palmistry/Face reading prompts

---

## Payment Gateway System

### Architecture

The payment system uses a unified gateway interface allowing multiple payment providers:

```typescript
interface IPaymentGateway {
  name: string
  key: string
  supportedCurrencies: string[]
  supportedCountries: string[]

  createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult>
  handleWebhook(payload: string, signature: string): Promise<WebhookResult>
  getSubscription(subscriptionId: string): Promise<SubscriptionInfo>
  cancelSubscription(subscriptionId: string): Promise<CancelResult>
}
```

### Supported Gateways

| Gateway | Status | Primary Use | Supported Methods |
|---------|--------|-------------|-------------------|
| **Stripe** | Implemented | International | Cards, Apple Pay, Google Pay |
| **Razorpay** | Implemented | India | UPI, Cards, Netbanking, Wallets, PayLater, EMI |
| **PayPal** | Stub | Future | PayPal, Cards |

### Payment Methods (India via Razorpay)

| Method | Key | Description |
|--------|-----|-------------|
| UPI | `upi` | Unified Payments Interface |
| Credit/Debit Cards | `card` | All major cards |
| Netbanking | `netbanking` | All Indian banks |
| Wallets | `wallet` | Paytm, PhonePe, etc. |
| PayLater | `paylater` | Simpl, LazyPay |
| EMI | `emi` | Card EMI options |

### Security

- API keys encrypted with AES-256 before storage
- Webhook signatures verified (HMAC SHA256)
- No sensitive data exposed to client-side
- CSRF protection via NextAuth cookies

---

## Authentication & Security

### Authentication Flow

```
User Request → Server Component → auth() → Database Check → Render/Redirect
                                      ↓
                              Not Authenticated → /login
                              Non-Admin User → /dashboard?error=...
```

### Protected Routes

| Route Type | Protection Method |
|------------|-------------------|
| Admin pages (`/admin/*`) | Server component + DB role check |
| Admin APIs (`/api/admin/*`) | `checkAdmin()` middleware |
| Dashboard pages (`/dashboard/*`) | `AuthProvider` + session check |

### Admin Access

Default admin credentials (from seed):
- Email: `admin@localhost`
- Password: `admin123`

**Important**: Change password before production!

---

## Configuration

### Environment Variables

#### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Database connection (SQLite or PostgreSQL) |
| `NEXTAUTH_URL` | App URL (e.g., `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Auth secret (generate with `openssl rand -base64 32`) |

#### AI Providers

| Variable | Provider | Required For |
|----------|----------|--------------|
| `OPENROUTER_API_KEY` | OpenRouter | Free tier |
| `ANTHROPIC_API_KEY` | Anthropic | Premium tiers |
| `GEMINI_API_KEY` | Gemini | Alternative premium |
| `OLLAMA_URL` | Ollama | Local AI (default: `http://localhost:11434`) |

#### Payment Gateways

| Variable | Gateway |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RAZORPAY_KEY_ID` | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret |
| `ENCRYPTION_KEY` | For encrypting gateway API keys |

#### Optional

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `CLOUDINARY_CLOUD_NAME` | Image uploads (palmistry) |
| `CLOUDINARY_API_KEY` | Image uploads |
| `CLOUDINARY_API_SECRET` | Image uploads |

---

## Deployment

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env

# 3. Generate Prisma client
npx prisma generate

# 4. Run migrations
npx prisma migrate dev --name init

# 5. Seed database
npx tsx prisma/seed.ts

# 6. Start development server
npm run dev
```

### Production Deployment (Vercel)

1. Push code to GitHub
2. Import project in Vercel dashboard
3. Set environment variables
4. Deploy

### Production Deployment (OCI/VPS)

```bash
# 1. Create deployment package
tar -czf starpath-deployment.tar.gz --exclude='node_modules' --exclude='.next' --exclude='.git' trustastrology-clone

# 2. Transfer to server
scp starpath-deployment.tar.gz user@server:/home/opc/starpath

# 3. On server: extract, install, build
cd /home/opc/starpath
tar -xzf starpath-deployment.tar.gz
npm install
npx prisma generate
npx prisma migrate deploy
npm run build

# 4. Start with PM2
pm2 start npm --name "starpath" -- start
pm2 save
pm2 startup
```

### Production Checklist

- [ ] Update `NEXTAUTH_URL` to production domain
- [ ] Generate new `NEXTAUTH_SECRET`
- [ ] Change admin password from `admin123`
- [ ] Configure PostgreSQL database
- [ ] Set up AI provider API keys
- [ ] Configure Stripe/Razorpay webhooks
- [ ] Set webhook URLs in provider dashboards

---

## License

MIT

## Disclaimer

This is an educational astrology platform. Readings are for entertainment purposes only. Planetary calculations are simplified approximations - for production use, consider integrating Swiss Ephemeris for higher accuracy.

---

**Last Updated**: April 30, 2026