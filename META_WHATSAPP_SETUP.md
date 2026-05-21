# Meta WhatsApp Cloud API Setup

## What You Need

At the end of this guide you will have:
- `META_WA_PHONE_NUMBER_ID` — identifies your WhatsApp sender number
- `META_WA_ACCESS_TOKEN` — authenticates API calls
- `META_WA_WEBHOOK_VERIFY_TOKEN` — validates incoming webhook events
- `META_APP_ID` — your Meta App ID

---

## Step 1 — Create a Meta Developer Account

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Log in with your Facebook account (or create one)
3. Click **Get Started** and follow the developer account setup

---

## Step 2 — Create a Meta App

1. [Meta Developer Dashboard](https://developers.facebook.com/apps) → **Create App**
2. Choose **Business** as the app type
3. Fill in:
   - App Name: `OccasionPro`
   - App Contact Email: `hariprathishg@gmail.com`
   - Business Account: Select your Meta Business Suite account (create one if needed at [business.facebook.com](https://business.facebook.com))
4. Click **Create App**

---

## Step 3 — Add WhatsApp Product

1. In your new app dashboard, scroll to **Add Products**
2. Find **WhatsApp** → click **Set Up**
3. You'll see the **WhatsApp Business Platform** section added to the left sidebar

---

## Step 4 — Get a Test Phone Number

Meta gives you a free test number for development.

1. Go to **WhatsApp → API Setup** in your app dashboard
2. Under **Step 1 — Select a phone number**, you'll see a test number like `+1 555-xxxx`
3. Copy the **Phone Number ID** shown below it → this is `META_WA_PHONE_NUMBER_ID`
4. Copy the **Temporary Access Token** → this is your initial `META_WA_ACCESS_TOKEN`

> **Note:** The temporary token expires in 24 hours. For production, create a permanent token (Step 7).

---

## Step 5 — Add a Real Phone Number (Production)

For production, you need a real Indian number that is **not** currently registered with WhatsApp.

1. **WhatsApp → Phone Numbers** → **Add Phone Number**
2. Enter a phone number you own (mobile or landline)
   - Must not be registered with WhatsApp personal/business app
   - Indian numbers: any +91 mobile number works
3. Verify via SMS or voice call
4. Once verified, this number appears in the dropdown
5. Select it — the **Phone Number ID** updates → copy it

---

## Step 6 — Set Up Webhooks

OccasionPro needs webhooks to receive inbound WhatsApp messages and delivery status updates.

1. **WhatsApp → Configuration** → **Webhook** → **Edit**
2. **Callback URL:** `https://api.occasionpro.in/webhooks/whatsapp`
3. **Verify Token:** Create a random string, e.g., `occasionpro_wa_verify_2024` → save this as `META_WA_WEBHOOK_VERIFY_TOKEN` in Railway
4. Click **Verify and Save**
5. Under **Webhook Fields** → subscribe to:
   - `messages` ✓ (inbound messages)
   - `message_deliveries` ✓ (delivery receipts)
   - `message_reads` ✓ (read receipts)
   - `message_reactions` (optional)

---

## Step 7 — Create a Permanent System User Token

The temporary token expires. Create a permanent one:

1. Go to [Meta Business Suite](https://business.facebook.com) → **Settings → Users → System Users**
2. Click **Add** → create a system user:
   - Name: `OccasionPro API`
   - Role: `Admin`
3. Click **Generate New Token**:
   - Select your app (`OccasionPro`)
   - Permissions needed:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
4. Copy the token → this is your permanent `META_WA_ACCESS_TOKEN`
5. **Important:** Store it safely — it's only shown once

---

## Step 8 — Add Keys to Environment Files

### Local (`.env.local` — never commit)

```bash
META_APP_ID=<your-app-id>
META_WA_PHONE_NUMBER_ID=<phone-number-id>
META_WA_ACCESS_TOKEN=<permanent-system-user-token>
META_WA_WEBHOOK_VERIFY_TOKEN=occasionpro_wa_verify_2024
```

### Railway (API service)

Add all four variables above in Railway Dashboard → API Service → Variables.

---

## Step 9 — Create Message Templates

WhatsApp requires pre-approved templates for outbound messages (non-reply context).

1. **WhatsApp → Message Templates** → **Create Template**
2. Create templates for:
   - `event_reminder` — "Hi {{1}}, your event {{2}} is tomorrow at {{3}}."
   - `payment_receipt` — "Hi {{1}}, payment of ₹{{2}} received for {{3}}. Ref: {{4}}."
   - `guest_invitation` — "You're invited to {{1}}! RSVP here: {{2}}"
   - `vendor_booking` — "Booking confirmed for {{1}} on {{2}}. Details: {{3}}"
3. Submit each template — Meta reviews within **24–48 hours**
4. Once approved, template names go into `supabase/seed` or app config

---

## Step 10 — Go Live (Move out of Test Mode)

To message numbers other than your 5 test numbers:

1. **App Dashboard → App Review** → submit for review
2. Request permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
3. Provide use case description (event management platform)
4. Meta review: **5–7 business days**

---

## Where Variables Are Used in Code

| File | Variable |
|------|----------|
| `apps/api/src/whatsapp/whatsapp.service.ts` | `META_WA_PHONE_NUMBER_ID`, `META_WA_ACCESS_TOKEN` |
| `apps/api/src/webhooks/whatsapp.controller.ts` | `META_WA_WEBHOOK_VERIFY_TOKEN` |

---

## Test a Message (curl)

Once set up, verify it works:

```bash
curl -X POST \
  "https://graph.facebook.com/v19.0/${META_WA_PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer ${META_WA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "91XXXXXXXXXX",
    "type": "text",
    "text": { "body": "OccasionPro test message!" }
  }'
```

A `200 OK` with `messages[0].id` confirms it's working.
