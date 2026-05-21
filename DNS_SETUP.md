# DNS Setup — GoDaddy for occasionpro.in

## Overview

| Subdomain | Points To | Service |
|---|---|---|
| `occasionpro.in` (root) | Vercel | Next.js web app |
| `www.occasionpro.in` | Vercel | Redirect to root |
| `api.occasionpro.in` | Railway | NestJS API |
| `links.occasionpro.in` | Cloudflare Workers | Short link redirector |

---

## Step-by-Step in GoDaddy

1. Log in to [GoDaddy DNS Manager](https://dcc.godaddy.com/manage/occasionpro.in/dns)
2. Click **Add New Record** for each entry below

---

## Records to Add

### 1. Root Domain → Vercel

Vercel does **not** support CNAME on the root (apex) domain because CNAMEs conflict with SOA/NS records. Use **A records** pointing to Vercel's anycast IPs instead.

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `76.76.21.21` | 600 |

> **Note:** After adding, go to your Vercel project → **Settings → Domains** → add `occasionpro.in`. Vercel will detect the A record and issue a TLS certificate automatically.

---

### 2. www → Vercel (CNAME redirect to root)

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `www` | `cname.vercel-dns.com` | 600 |

> In Vercel, also add `www.occasionpro.in` as a domain and set it to **redirect to `occasionpro.in`**.

---

### 3. API Subdomain → Railway

Railway provides a stable `*.up.railway.app` hostname for each service.

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `api` | `<your-service>.up.railway.app` | 600 |

> **How to get your Railway hostname:**
> 1. Open your Railway project → select the API service
> 2. Go to **Settings → Networking → Public Networking**
> 3. Click **Generate Domain** (if not done) — copy the `*.up.railway.app` value
> 4. Also add `api.occasionpro.in` as a **Custom Domain** in that same Railway settings panel

---

### 4. Short Links → Cloudflare Workers

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `links` | `occasionpro-links.YOUR_SUBDOMAIN.workers.dev` | 600 |

> **How to get your Workers hostname:**
> 1. Run `wrangler deploy` from `apps/worker-shortlinks/`
> 2. Cloudflare will assign a `*.workers.dev` URL — copy it
> 3. In [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers → your worker → **Triggers** → add custom domain `links.occasionpro.in`
> 4. Cloudflare will automatically provision TLS

> **Alternative (if not using Cloudflare as registrar):** Add the CNAME in GoDaddy and then add the route in Cloudflare Workers triggers manually.

---

## Email / Resend DNS Records

These will be provided by Resend after you add `occasionpro.in` as a sending domain. See **RESEND_EMAIL_SETUP.md** for the exact records. They will look like:

| Type | Name | Value |
|------|------|-------|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSq...` (DKIM key) |
| TXT | `@` | `v=spf1 include:amazonses.com ~all` |
| MX | `@` | `feedback-smtp.us-east-1.amazonses.com` (for bounce handling) |

---

## Verification

After adding all records, verify propagation:

```bash
# Root domain
dig A occasionpro.in +short

# API
dig CNAME api.occasionpro.in +short

# Short links
dig CNAME links.occasionpro.in +short

# Or use online tool:
# https://dnschecker.org
```

DNS propagation typically takes **5–30 minutes** with TTL 600. GoDaddy sometimes takes up to 2 hours for initial propagation.

---

## Checklist

- [ ] A record: `@` → `76.76.21.21` (Vercel)
- [ ] CNAME: `www` → `cname.vercel-dns.com`
- [ ] CNAME: `api` → `<railway-hostname>.up.railway.app`
- [ ] CNAME: `links` → `<worker-name>.workers.dev`
- [ ] Vercel: add `occasionpro.in` and `www.occasionpro.in` as domains
- [ ] Railway: add `api.occasionpro.in` as custom domain
- [ ] Cloudflare Workers: add `links.occasionpro.in` as custom domain route
- [ ] Resend DNS records added (after RESEND_EMAIL_SETUP.md)
