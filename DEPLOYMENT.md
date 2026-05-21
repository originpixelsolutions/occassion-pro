# Deployment Guide — OccasionPro

## Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase CLI: `npm i -g supabase`
- Railway CLI: `npm i -g @railway/cli`
- Vercel CLI: `npm i -g vercel`
- Wrangler (Cloudflare): `npm i -g wrangler`

---

## 1. Run Database Migrations

This pushes all 85 migrations to your Supabase project in order.

```bash
# From project root
npx supabase db push --project-ref lndcqdnsllfcnkidhtem
```

If prompted, authenticate with:

```bash
npx supabase login
```

### Verify migrations ran

```bash
npx supabase db diff --project-ref lndcqdnsllfcnkidhtem
# Should show: No schema changes detected (empty diff = all migrations applied)
```

---

## 2. Seed Super Admin

Run this **once** after migrations complete. It creates the platform super admin account.

```bash
# Option A — via Supabase CLI (recommended)
npx supabase db execute --project-ref lndcqdnsllfcnkidhtem \
  --file supabase/seed/001_super_admin.sql

# Option B — via psql (requires DATABASE_URL from Supabase dashboard)
psql "$DATABASE_URL" -f supabase/seed/001_super_admin.sql
```

> **Important:** After first login at `occasionpro.in/super-admin`, immediately change the password. Default is `ChangeMe@123!`.

### Get DATABASE_URL

1. Supabase Dashboard → Project `lndcqdnsllfcnkidhtem`
2. **Settings → Database → Connection string → URI**
3. Copy the `postgres://...` string

---

## 3. Deploy Web App → Vercel

### First-time setup

```bash
cd apps/web
vercel link          # connect to existing Vercel project or create new
vercel env pull      # pull environment variables (or set them via dashboard)
```

### Set environment variables in Vercel Dashboard

Go to **Vercel → Project → Settings → Environment Variables** and add:

```
NEXT_PUBLIC_SUPABASE_URL        = https://lndcqdnsllfcnkidhtem.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = <anon key from Supabase dashboard>
NEXT_PUBLIC_APP_URL             = https://occasionpro.in
NEXT_PUBLIC_API_URL             = https://api.occasionpro.in
SUPABASE_SERVICE_ROLE_KEY       = <service role key — server-side only, NOT NEXT_PUBLIC_>
```

### Deploy

```bash
cd apps/web
vercel --prod
```

Or push to `main` branch if you have GitHub integration enabled — Vercel will auto-deploy.

### Add custom domain

```bash
vercel domains add occasionpro.in
vercel domains add www.occasionpro.in
```

Or via Vercel Dashboard → **Settings → Domains**.

---

## 4. Deploy API → Railway

### First-time setup

```bash
cd apps/api
railway login
railway init          # link to existing project or create new
```

### Set environment variables in Railway Dashboard

Go to **Railway → Project → API Service → Variables** and add:

```
SUPABASE_URL                = https://lndcqdnsllfcnkidhtem.supabase.co
SUPABASE_SERVICE_ROLE_KEY   = <service role key>
SUPABASE_JWT_SECRET         = <JWT secret from Supabase Settings → API>
DATABASE_URL                = <direct connection string from Supabase>
PORT                        = 3001
NODE_ENV                    = production
APP_URL                     = https://occasionpro.in
RAZORPAY_KEY_ID             = <add when available>
RAZORPAY_KEY_SECRET         = <add when available>
META_WA_PHONE_NUMBER_ID     = <add when available>
META_WA_ACCESS_TOKEN        = <add when available>
RESEND_API_KEY              = <add when available>
```

### Deploy

```bash
cd apps/api
railway up
```

Railway detects the `Dockerfile` or `package.json` start script automatically.

### Add custom domain

1. Railway Dashboard → API service → **Settings → Networking**
2. **Add Custom Domain** → enter `api.occasionpro.in`
3. Copy the `*.up.railway.app` hostname shown → add as CNAME in GoDaddy (see DNS_SETUP.md)

---

## 5. Deploy Cloudflare Worker (Short Links)

### First-time setup

```bash
cd apps/worker-shortlinks
wrangler login
```

### Set secrets

```bash
wrangler secret put SUPABASE_URL
# Enter: https://lndcqdnsllfcnkidhtem.supabase.co

wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Enter: <service role key>
```

### Deploy

```bash
wrangler deploy
```

### Add custom domain

1. Cloudflare Dashboard → **Workers & Pages** → select your worker
2. **Triggers** → **Custom Domains** → Add `links.occasionpro.in`

---

## 6. Full Deployment Order (First Deploy)

Run in this exact order:

```
1. npx supabase db push --project-ref lndcqdnsllfcnkidhtem
2. npx supabase db execute --project-ref lndcqdnsllfcnkidhtem --file supabase/seed/001_super_admin.sql
3. wrangler deploy              (from apps/worker-shortlinks/)
4. railway up                  (from apps/api/)
5. vercel --prod               (from apps/web/)
6. Add DNS records in GoDaddy  (see DNS_SETUP.md)
```

---

## 7. Subsequent Deploys

```bash
# Web app (auto-deploys on git push to main if GitHub connected)
cd apps/web && vercel --prod

# API
cd apps/api && railway up

# Worker
cd apps/worker-shortlinks && wrangler deploy

# New migrations only
npx supabase db push --project-ref lndcqdnsllfcnkidhtem
```

---

## 8. Monitoring & Logs

| Service | Logs |
|---|---|
| Web app | Vercel Dashboard → Deployments → Functions |
| API | `railway logs` or Railway Dashboard |
| Worker | `wrangler tail` or Cloudflare Dashboard |
| Database | Supabase Dashboard → Logs → Postgres |
| Auth | Supabase Dashboard → Logs → Auth |

---

## Rollback

```bash
# Vercel — instant rollback to previous deployment
vercel rollback

# Railway — redeploy previous commit
railway rollback

# Worker
wrangler deployments list
wrangler rollback <deployment-id>
```
