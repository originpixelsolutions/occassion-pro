# Resend Email Setup Guide

## What You Need

At the end of this guide you will have:
- `RESEND_API_KEY` — authenticates all email send requests
- DNS records added in GoDaddy to verify `occasionpro.in` as a sending domain
- Ability to send from `*@occasionpro.in` addresses (e.g., `hello@occasionpro.in`, `noreply@occasionpro.in`, `events@occasionpro.in`)

---

## Step 1 — Create a Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up with `hariprathishg@gmail.com`
3. Verify your email

---

## Step 2 — Add occasionpro.in as a Sending Domain

1. Resend Dashboard → **Domains** → **Add Domain**
2. Enter: `occasionpro.in`
3. Select region: **Asia Pacific** (or US East — both work fine for India)
4. Click **Add**

Resend will display a set of DNS records to add. They look like the table below (your actual values will differ — use the ones Resend shows you, not these examples).

---

## Step 3 — Add DNS Records in GoDaddy

> **Use the exact values from the Resend dashboard.** The values below are examples only.

Log in to [GoDaddy DNS Manager](https://dcc.godaddy.com/manage/occasionpro.in/dns) → Add each record:

### DKIM Record (Domain Key — required for deliverability)

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...` (from Resend) | 3600 |

### SPF Record (Sender Policy Framework)

> Check if you already have a TXT record on `@`. If you do, **append** to the existing record rather than creating a new one (multiple SPF records cause failures).

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` | `v=spf1 include:amazonses.com ~all` | 3600 |

If you already have an SPF record like `v=spf1 include:google.com ~all`, change it to:
```
v=spf1 include:google.com include:amazonses.com ~all
```

### DMARC Record (optional but recommended)

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@occasionpro.in` | 3600 |

---

## Step 4 — Verify the Domain

1. After adding all DNS records, return to Resend Dashboard → **Domains**
2. Click **Verify** next to `occasionpro.in`
3. DNS propagation takes **5 minutes to 2 hours**
4. Status will change from `Pending` to `Verified` ✓

If verification fails after 2 hours:
- Double-check each record value matches exactly what Resend shows
- Use `dig TXT resend._domainkey.occasionpro.in +short` to confirm the record is live

---

## Step 5 — Get Your API Key

1. Resend Dashboard → **API Keys** → **Create API Key**
2. Name: `OccasionPro Production`
3. Permission: **Full Access** (or **Sending Access** for tighter security)
4. Domain: Select `occasionpro.in`
5. Click **Create** → copy the key immediately (shown only once)

---

## Step 6 — Add API Key to Environment Files

### Local (`.env.local` — never commit)

```bash
RESEND_API_KEY=re_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
RESEND_FROM_EMAIL=noreply@occasionpro.in
RESEND_FROM_NAME=OccasionPro
```

### Railway (API service)

Add all three variables in Railway Dashboard → API Service → Variables:

```
RESEND_API_KEY      = re_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
RESEND_FROM_EMAIL   = noreply@occasionpro.in
RESEND_FROM_NAME    = OccasionPro
```

---

## Step 7 — Email Addresses to Use

Once the domain is verified, you can send from any `@occasionpro.in` address without creating mailboxes:

| Purpose | Address |
|---------|---------|
| Transactional (default) | `noreply@occasionpro.in` |
| Guest invitations | `events@occasionpro.in` |
| Support / helpdesk | `hello@occasionpro.in` |
| Billing / invoices | `billing@occasionpro.in` |
| Vendor communications | `vendors@occasionpro.in` |

These are **sending-only** addresses. To receive replies, set up forwarding rules via GoDaddy Email Forwarding or Google Workspace.

---

## Step 8 — Test It

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_XXXXXXXXXXXX" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "OccasionPro <noreply@occasionpro.in>",
    "to": ["hariprathishg@gmail.com"],
    "subject": "OccasionPro email test",
    "html": "<p>Email is working correctly.</p>"
  }'
```

Expected response: `200 OK` with an `id` field.

---

## Where the Key Is Used in Code

| File | Variable |
|------|----------|
| `apps/api/src/email/email.service.ts` | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| `apps/api/src/notifications/email-templates/` | Template files (no secrets) |

---

## Email Templates in Use

OccasionPro sends the following transactional emails:

| Template | Trigger |
|----------|---------|
| Welcome email | New tenant signup |
| Guest invitation | Guest added to event |
| RSVP confirmation | Guest confirms attendance |
| Payment receipt | Invoice paid |
| Vendor booking confirmation | Vendor assigned to event |
| Password reset | Auth flow (handled by Supabase) |
| Event reminder | 48h before event |
| Post-event thank you | Event marked complete |

> **Note:** Password reset and magic link emails are handled by **Supabase Auth** directly. To use your custom domain for those, go to Supabase Dashboard → **Authentication → Email Templates** → update the sender to `noreply@occasionpro.in` and configure SMTP under **Project Settings → Auth → SMTP Settings** using Resend's SMTP credentials.

### Resend SMTP Credentials (for Supabase Auth)

```
Host:     smtp.resend.com
Port:     465 (SSL) or 587 (TLS)
Username: resend
Password: <your RESEND_API_KEY>
```
