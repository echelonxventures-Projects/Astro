# StarPath Astrology

A full-featured AI-powered astrology platform built with modern technologies. Navigate your cosmic journey with personalized birth charts, horoscopes, and AI-guided readings.

## Features

- **User Authentication**: Email/password and Google OAuth sign-in
- **Birth Chart Generation**: Calculate planetary positions, houses, and aspects
- **AI-Powered Readings**: Daily, love, and career horoscopes using configurable AI (Ollama/Anthropic/Gemini)
- **Compatibility Readings**: Synastry analysis between two birth charts
- **AI Chat**: Conversational astrology consultations
- **Subscription System**: Stripe-powered premium tiers with multi-region pricing
- **Palmistry**: AI-powered palm reading from photos
- **Face Reading**: Chinese physiognomy analysis
- **Responsive Design**: Beautiful purple & silver theme with glass morphism effects

## Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS v4, Framer Motion
- **Backend**: Next.js Server Actions & API Routes
- **Database**: SQLite (dev) / PostgreSQL (production) with Prisma ORM
- **Authentication**: NextAuth.js (Auth.js)
- **Payments**: Stripe with multi-region/multi-currency support
- **AI**: Configurable providers - Ollama (free/local), Anthropic Claude, Google Gemini
- **Astrology**: Custom calculation engine

## Quick Start (SQLite - Recommended for Local Dev)

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Clone and install dependencies**

```bash
cd starpath-astrology
npm install
```

2. **Set up environment variables**

```bash
cp .env.example .env
```

The default `.env` is already configured for SQLite local development.

3. **Set up the database**

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (creates SQLite database)
npx prisma migrate dev --name init
```

4. **Seed default data** (creates admin user and default plans)

```bash
npx tsx prisma/seed.ts
```

5. **Start the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Default Admin Credentials

After seeding, log in as admin:
- Email: `admin@localhost`
- Password: `admin123`

**Important**: Change the admin password in production!

## Production Setup (PostgreSQL)

### 1. Update Environment Variables

Edit `.env` to use PostgreSQL:

```bash
# Comment out SQLite
# DATABASE_URL="file:./dev.db"

# Enable PostgreSQL
DATABASE_URL="postgresql://user:password@host:port/database"
DIRECT_URL="postgresql://user:password@host:port/database"
```

### 2. Recommended: Use Managed PostgreSQL

**Neon (Serverless PostgreSQL)**
1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string to `.env`

**Supabase**
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy the "Connection string" (URI mode) to `.env`

### 3. Run Migrations

```bash
npx prisma migrate deploy
```

## Environment Variables Reference

See `.env.example` for all available options:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `NEXTAUTH_URL` | Your app URL | Yes |
| `NEXTAUTH_SECRET` | Auth secret (generate with `openssl rand -base64 32`) | Yes |
| `ANTHROPIC_API_KEY` | Claude API key (leave empty if using Ollama) | For Anthropic |
| `STRIPE_SECRET_KEY` | Stripe secret key | For payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | For payments |
| `STRIPE_PRICE_ID_MONTHLY` | Monthly subscription price ID | For payments |
| `STRIPE_PRICE_ID_YEARLY` | Yearly subscription price ID | For payments |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Optional |
| `CLOUDINARY_*` | Cloudinary credentials | For image uploads |

## Configuring AI Providers

StarPath supports multiple AI providers. Configure via Admin UI at `/settings`:

### Option 1: Ollama (Free, Local)
- Default provider for free tier
- Runs locally at `http://localhost:5566`
- Models: llama3.2, mistral, etc.
- No API key required

### Option 2: Anthropic Claude (Premium)
- Higher quality readings
- Required for premium tiers
- Get API key from [console.anthropic.com](https://console.anthropic.com)

### Option 3: Google Gemini (Premium)
- Alternative premium provider
- Get API key from [makersuite.google.com](https://makersuite.google.com)

## Project Structure

```
starpath-astrology/
├── prisma/
│   ├── schema.prisma        # SQLite schema (default)
│   ├── schema.prisma.postgresql  # PostgreSQL schema
│   └── seed.ts              # Database seeding
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (auth)/          # Login/signup pages
│   │   ├── (dashboard)/     # Authenticated pages
│   │   ├── (admin)/         # Admin settings & plans
│   │   ├── api/             # API routes
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Homepage
│   ├── components/          # React components
│   ├── lib/                 # Utility libraries
│   │   ├── ai/              # AI provider abstraction
│   │   ├── astrology/       # Astrology calculations
│   │   ├── auth.ts          # NextAuth config
│   │   ├── db.ts            # Prisma client
│   │   ├── plans.ts         # Subscription plans
│   │   └── settings.ts      # App settings
│   └── types/               # TypeScript types
└── .env.example             # Environment template
```

## Available Pages/Routes

| Route | Description |
|-------|-------------|
| `/` | Homepage with features |
| `/login` | User login |
| `/signup` | User registration |
| `/dashboard` | User dashboard |
| `/chart` | Create birth chart |
| `/horoscope/daily` | Daily horoscope |
| `/horoscope/love` | Love horoscope |
| `/horoscope/career` | Career horoscope |
| `/compatibility` | Relationship compatibility |
| `/chat/horoscope` | AI astrologer chat |
| `/palmistry` | Palm reading |
| `/face-reading` | Face reading |
| `/pricing` | Subscription plans |
| `/profile` | User profile settings |
| `/subscription` | Manage subscription |
| `/settings` | Admin AI provider settings |
| `/admin/plans` | Admin plan management |

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `GET/POST /api/auth/[...nextauth]` - NextAuth endpoints

### Astrology
- `GET/POST /api/astrology/chart` - Manage birth charts
- `POST /api/astrology/generate` - Generate AI readings
- `GET/POST /api/astrology/chat` - AI chat sessions
- `POST /api/astrology/palmistry` - Palm image analysis
- `POST /api/astrology/face-reading` - Face image analysis

### Admin & Settings
- `GET/POST /api/settings` - AI provider configuration
- `GET/POST /api/settings/plans` - Plan AI configuration
- `GET/POST /api/admin/plans` - Subscription plan management

### Stripe
- `POST /api/stripe/checkout` - Create checkout session
- `GET /api/stripe/portal` - Create portal session
- `POST /api/stripe/webhook` - Handle Stripe webhooks

## Database Schema

- **User**: Account and subscription info (with role field for admin)
- **BirthChart**: Calculated planetary positions
- **Reading**: Generated AI readings
- **ChatSession**: AI chat conversations
- **Subscription**: Stripe subscription data
- **Payment**: Payment history
- **AppSettings**: Application-wide settings (AI provider config)
- **AIProviderConfig**: Per-plan AI provider settings
- **SubscriptionPlan**: Dynamic subscription plans
- **PlanFeature**: Configurable features
- **PlanFeatureAccess**: Plan-feature relationships
- **Region**: Multi-region pricing configuration

## Subscription Plans

| Feature | Free | Monthly | Yearly |
|---------|------|---------|--------|
| Daily Horoscope | ✓ | ✓ | ✓ |
| Basic Birth Chart | ✓ | ✓ | ✓ |
| AI Readings/Month | 3 | Unlimited | Unlimited |
| Love Horoscope | - | ✓ | ✓ |
| Career Horoscope | - | ✓ | ✓ |
| Compatibility | - | ✓ | ✓ |
| AI Chat | - | ✓ | ✓ |
| Priority Support | - | ✓ | ✓ |

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Run linting
npm run lint

# Database commands
npx prisma generate        # Generate Prisma client
npx prisma migrate dev     # Create and apply migration
npx prisma migrate deploy  # Apply migrations in production
npx prisma studio          # Open database GUI
npx tsx prisma/seed.ts     # Seed database
```

## Deployment

### Using Vercel (Recommended)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set environment variables
4. Deploy

### Database Options for Production

- **Neon**: Serverless PostgreSQL - [neon.tech](https://neon.tech)
- **Supabase**: Managed PostgreSQL - [supabase.com](https://supabase.com)
- **PlanetScale**: MySQL-compatible - [planetscale.com](https://planetscale.com)
- **Railway**: PostgreSQL add-on - [railway.app](https://railway.app)

### Stripe Setup

1. Create products and prices in Stripe Dashboard
2. Copy price IDs to `.env`
3. Set up webhook endpoint: `https://your-domain.com/api/stripe/webhook`
4. Events to subscribe: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment.*`

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-domain.com/api/auth/callback/google`
4. Copy client ID and secret to `.env`

## Production Checklist

Before deploying to production:

- [ ] Update `NEXTAUTH_URL` to production domain
- [ ] Generate new `NEXTAUTH_SECRET`: `openssl rand -base64 32`
- [ ] Change admin password from default (`admin123`)
- [ ] Configure production database (PostgreSQL recommended)
- [ ] Set up Ollama on a server or configure Anthropic API key
- [ ] Add Stripe keys if accepting payments
- [ ] Update privacy policy contact email
- [ ] Run `npx prisma migrate deploy` in production

## Multi-Region Pricing

The app supports regional pricing with automatic currency conversion:

1. Admin can configure regions at `/admin/plans`
2. Users see prices in their local currency on `/pricing`
3. Regional price multipliers adjust for purchasing power

## License

MIT

## Disclaimer

This is an educational astrology platform. Readings are for entertainment purposes only and should not replace professional advice. Planetary calculations are simplified approximations - for production use, consider integrating the Swiss Ephemeris for higher accuracy.

## Contact

- Website: starpathastrology.com
- Email: privacy@starpathastrology.com
