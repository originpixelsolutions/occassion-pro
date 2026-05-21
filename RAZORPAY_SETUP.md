# Razorpay Setup Guide

## When to Do This

Complete this after you receive your Razorpay business account approval. Razorpay typically takes **2–5 business days** to verify documents.

---

## Step 1 — Create a Razorpay Account

1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Sign up with your business email
3. Complete KYC:
   - Business PAN
   - GST certificate (if applicable)
   - Bank account details (for settlements)
4. Wait for activation email

---

## Step 2 — Get API Keys

### Test Keys (use during development)

1. Razorpay Dashboard → **Settings → API Keys**
2. Click **Generate Test Key**
3. Copy:
   - `rzp_test_XXXXXXXXXXXXXXXX` → this is `RAZORPAY_KEY_ID`
   - The secret shown once → this is `RAZORPAY_KEY_SECRET`

### Live Keys (use in production)

1. Same location → **Generate Live Key**
2. Live keys only work after your account is activated

---

## Step 3 — Add Keys to Environment Files

### Local development (`.env.local` in project root — never commit this)

```bash
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX
```

### Railway (API service) — production

1. Railway Dashboard → API Service → **Variables**
2. Add:

```
RAZORPAY_KEY_ID       = rzp_live_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET   = XXXXXXXXXXXXXXXXXXXXXXXX
```

### Vercel (web app) — only if frontend calls Razorpay directly

```
NEXT_PUBLIC_RAZORPAY_KEY_ID = rzp_live_XXXXXXXXXXXXXXXX
```

> **Never put `RAZORPAY_KEY_SECRET` in a `NEXT_PUBLIC_` variable.** The secret must only live server-side (Railway API).

---

## Step 4 — Configure Webhooks

OccasionPro uses webhooks to confirm payments and handle subscription events.

1. Razorpay Dashboard → **Settings → Webhooks** → **Add New Webhook**
2. **Webhook URL:** `https://api.occasionpro.in/webhooks/razorpay`
3. **Secret:** Generate a strong random string and save it as `RAZORPAY_WEBHOOK_SECRET` in Railway
4. **Events to subscribe:**
   - `payment.captured`
   - `payment.failed`
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.cancelled`
   - `subscription.completed`
   - `refund.created`
   - `refund.processed`

---

## Step 5 — Configure Razorpay Route (for vendor payouts)

This is needed to split payments to vendors automatically.

1. Razorpay Dashboard → **Route** → **Enable Route**
2. Complete Route KYC if prompted
3. When creating vendor records in OccasionPro, collect:
   - Vendor bank account number
   - IFSC code
4. The API will create **Linked Accounts** via Razorpay Route API automatically

---

## Step 6 — Subscription Plans (Optional — for SaaS billing)

If you want Razorpay to manage OccasionPro tenant subscriptions:

1. Razorpay Dashboard → **Subscriptions → Plans** → **Create Plan**
2. Create plans matching `subscription_plans` table:
   - `starter` — ₹2,999/month
   - `professional` — ₹7,999/month
   - `enterprise` — ₹19,999/month
3. Copy each Plan ID (e.g., `plan_XXXXXXXX`) and update the `razorpay_plan_id` column in the `subscription_plans` table via Supabase Dashboard

---

## Where Keys Are Used in Code

| File | Key Used |
|------|---------|
| `apps/api/src/payments/razorpay.service.ts` | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| `apps/api/src/webhooks/razorpay.controller.ts` | `RAZORPAY_WEBHOOK_SECRET` |
| `apps/web/src/lib/razorpay.ts` | `NEXT_PUBLIC_RAZORPAY_KEY_ID` (checkout only) |

---

## Testing Payments

Use Razorpay test card details:
- Card: `4111 1111 1111 1111`
- Expiry: Any future date
- CVV: Any 3 digits
- OTP: `1234`

UPI test VPA: `success@razorpay`

Full test credentials: [razorpay.com/docs/payments/test-card-details](https://razorpay.com/docs/payments/test-card-details/)
