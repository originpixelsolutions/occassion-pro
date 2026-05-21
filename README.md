# OccasionPro

> **The AI-powered enterprise event operating system.**  
> ERP + CRM + Command Center + AI Intelligence — for every type of event, at every scale.

---

## Overview

OccasionPro is a multi-tenant SaaS platform that serves as the complete operating system for professional event companies. From intimate luxury weddings to stadium-scale sports events and government summits, OccasionPro handles the full lifecycle: sales pipeline, event operations, guest management, vendor coordination, financial control, real-time command, and post-event analytics.

### Portal Architecture

| Portal | URL | Purpose |
|---|---|---|
| **Super Admin** | `/super-admin` | Platform-level control — tenants, plans, modules, AI, security |
| **Company Admin** | `/[tenant]` | AI Command Center — events, CRM, finance, analytics |
| **Event Manager** | `/[tenant]/events/[id]` | Full event lifecycle management |
| **Team Member** | `/[tenant]/team` | Operations, production, hospitality, field work |
| **Client Portal** | `/client/[token]` | White-label client collaboration + approvals |
| **Vendor Portal** | `/vendor` | Vendor accounts, deliverables, invoicing |
| **Guest Portal** | `/guest/[token]` | RSVP, itinerary, accommodation, digital voucher |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, TypeScript, TailwindCSS, ShadCN UI, Framer Motion |
| **Mobile** | Expo (React Native), Expo Router, EAS |
| **Backend** | NestJS, Prisma (Supabase), BullMQ, WebSockets |
| **Database** | Supabase (PostgreSQL + Row Level Security + Realtime) |
| **Cache / Queue** | Redis (Upstash in prod), BullMQ workers |
| **Storage** | Cloudflare R2 + CDN |
| **Edge** | Cloudflare Workers (short links, custom domains, branding) |
| **Auth** | Supabase Auth (OTP, magic link, JWT) |
| **Payments** | Razorpay (primary, India), Stripe (international) |
| **AI** | LiteLLM proxy → OpenAI / Anthropic |
| **Notifications** | Resend (email), Fast2SMS (SMS), Meta Cloud API (WhatsApp) |
| **CI/CD** | GitHub Actions → Railway (API) + Vercel (Web) + Cloudflare (Workers) |

---

## Monorepo Structure

```
occasionpro/
├── apps/
│   ├── api/          # NestJS API — port 4000
│   ├── web/          # Next.js web app — port 3000
│   └── mobile/       # Expo React Native app
├── packages/
│   └── database/     # Supabase client + TypeScript types (shared)
├── infra/
│   └── workers/
│       └── short-link-router/  # Cloudflare Worker — links.occasionpro.in
├── supabase/
│   ├── config.toml
│   ├── migrations/   # 084 numbered SQL migrations
│   └── seed/         # Seed scripts (super admin, sample data)
├── docs/             # Architecture docs
└── .github/
    └── workflows/    # CI (ci.yml) + Deploy (deploy.yml)
```

---

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (`npm install -g pnpm`)
- **Docker** (optional — for local Supabase)
- **Supabase CLI** (`npm install -g supabase`)
- **Wrangler** (`npm install -g wrangler`) — for Cloudflare Workers

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/your-org/occasionpro.git
cd occasionpro
pnpm install
```

### 2. Configure environment variables

```bash
# API
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — fill in Supabase keys, Redis URL, etc.

# Web
cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local

# Mobile
cp apps/mobile/.env.example apps/mobile/.env
# Edit apps/mobile/.env
```

### 3. Start local Supabase

```bash
supabase start
# Outputs: API URL, anon key, service role key, JWT secret
# Copy these into apps/api/.env
```

### 4. Run database migrations

```bash
supabase db reset
# Runs all 084 migrations in order
```

### 5. Seed the super admin

```bash
psql $DATABASE_URL -f supabase/seed/001_super_admin.sql
# Creates hariprathishg@gmail.com with password ChangeMe@123!
# Change the password immediately after first login
```

### 6. Start development servers

```bash
# All apps in parallel via Turbo
pnpm dev

# Or individually:
pnpm --filter api dev        # API on :4000
pnpm --filter web dev        # Web on :3000
pnpm --filter mobile start   # Expo on :8081
```

---

## Environment Variables

See the `.env.example` files for the full list:

- **`apps/api/.env.example`** — All server-side vars (Supabase, Redis, payments, messaging, Cloudflare, AI, security)
- **`apps/web/.env.example`** — `NEXT_PUBLIC_*` browser vars
- **`apps/mobile/.env.example`** — `EXPO_PUBLIC_*` mobile vars

Key sections in `apps/api/.env`:

| Section | Variables |
|---|---|
| App | `PORT`, `NODE_ENV`, `WEB_URL`, `API_URL` |
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` |
| Security | `FIELD_ENCRYPTION_KEY`, `GATEWAY_ENCRYPTION_KEY`, `INTERNAL_WEBHOOK_SECRET` |
| Email | `RESEND_API_KEY`, `FROM_EMAIL` |
| SMS | `FAST2SMS_API_KEY` |
| WhatsApp | `META_WA_PHONE_NUMBER_ID`, `META_WA_ACCESS_TOKEN` |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `STRIPE_SECRET_KEY` |
| Storage | `CLOUDFLARE_R2_*` |
| AI | `LITELLM_URL`, `LITELLM_API_KEY`, `AI_DEFAULT_MODEL` |

---

## Deployment

### API → Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway link

# Deploy
railway up --service api
```

Railway reads `apps/api/railway.json` and builds using the `apps/api/Dockerfile`.  
Health check: `GET /health` → `{ status: 'ok', timestamp, version }`

### Web → Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from apps/web directory
cd apps/web
vercel deploy --prod
```

Vercel config is at `apps/web/vercel.json`. Set the following secrets in the Vercel dashboard:
`api_url`, `supabase_url`, `supabase_anon_key`, `app_url`, `razorpay_key_id`

### Cloudflare Worker → Wrangler

```bash
cd infra/workers/short-link-router

# Set secrets (never committed to wrangler.toml)
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Deploy to production
wrangler deploy

# Deploy to staging
wrangler deploy --env staging
```

### Mobile → EAS

```bash
cd apps/mobile

# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build for production (Play Store)
eas build --platform android --profile production

# Build for iOS App Store
eas build --platform ios --profile production

# Submit to stores
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

### CI/CD (GitHub Actions)

Push to `main` triggers `.github/workflows/deploy.yml`:

1. **CI gate** — lint, type-check, build, test, security scan
2. **API** → Railway (parallel)
3. **Web** → Vercel (parallel)
4. **Worker** → Cloudflare (parallel)

Required GitHub Secrets:

| Secret | Used by |
|---|---|
| `RAILWAY_TOKEN` | Railway deploy |
| `VERCEL_TOKEN` | Vercel deploy |
| `VERCEL_ORG_ID` | Vercel deploy |
| `VERCEL_PROJECT_ID` | Vercel deploy |
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Wrangler deploy |

---

## Database Migrations

Migrations live in `supabase/migrations/` and are numbered `001` → `084`.

```bash
# Apply all migrations (local)
supabase db reset

# Apply to a remote project
supabase db push

# Create a new migration
supabase migration new <name>
```

Notable migrations:
- `054_short_links.sql` — Short link system
- `066_subscriptions.sql` — 4-tier subscription plans + trial logic
- `080_custom_domains.sql` — White-label custom domains
- `081_security.sql` — Security audit log + brute force tracking
- `082_notifications.sql` — Multi-channel notification routing
- `083_dpdp.sql` — DPDP Act compliance (consent, data requests)
- `084_super_admins.sql` — Platform super admin table

---

## Production URLs

| Service | URL |
|---|---|
| Web App | `https://app.occasionpro.in` |
| API | `https://api.occasionpro.in` |
| Short Links | `https://links.occasionpro.in` |
| CDN | `https://cdn.occasionpro.in` |
| API Docs | `https://api.occasionpro.in/api/docs` |

---

## Key Architectural Decisions

- **Multi-tenant isolation** — Row Level Security on every table; tenant resolved from JWT claim
- **Short links** — Cloudflare Worker at `links.occasionpro.in` → Supabase → 301 redirect (< 5ms p50)
- **Custom domains** — Cloudflare Worker + KV branding token cache; per-tenant white-label portals
- **Real-time** — Supabase Realtime + PostgreSQL triggers for cross-module synchronisation
- **AI** — LiteLLM proxy abstracts provider; all AI features behind `ai_enabled` feature flag
- **Field encryption** — AES-256-GCM for PII and payment tokens via `FieldEncryptionService`
- **Offline mobile** — Dexie.js IndexedDB cache + background sync for check-in field operations

---

## License

Proprietary — OccasionPro © 2025. All rights reserved.
