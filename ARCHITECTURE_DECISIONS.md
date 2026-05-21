# OccasionPro — Architecture Decisions & Master Plan
**Owner:** Hariprathish (hariprathishg@gmail.com)
**Last Updated:** 2026-05-17
**Status:** Living document — update on every confirmed decision

---

## 1. Platform Ownership & Tenancy Model

- **OccasionPro is owned exclusively by Hariprathish.** There is exactly one `super_admin` account in the system.
- **Tenants** are event companies / agencies who subscribe to use OccasionPro as their operating platform.
- Tenants get their own **isolated workspace** (multi-tenant SaaS with Row Level Security via `set_tenant_id` RPC).
- **White-label = branding only:** Tenants can set their own logo, brand color, company name, and custom domain. They do NOT get Super Admin access. They cannot see other tenants.
- Super Admin panel is at `/super-admin` — web-only, never in the Android app.
- The platform runs on `app.occasionpro.io` (or custom domain per tenant).

---

## 2. Architecture Principle: Automation First, Manual Override Second

> "The platform runs itself. The Super Admin watches and steps in only when needed."

### Primary (Automatic):
| Automation | Schedule | Description |
|---|---|---|
| `tenant_health_updater` | Every hour | Recalculates health scores + churn risk for all active tenants |
| `subscription_scheduler` | Daily 02:00 | Checks billing due dates, triggers Razorpay charges |
| `churn_risk_detector` | Daily 04:00 | Flags at-risk tenants, sets support_tag |
| `payment_retry_handler` | Daily 03:00 | Retries failed payments at 3/7/14 day intervals |
| `auto_suspend_enforcer` | Daily 05:00 | Suspends tenants with payment overdue >30 days |
| `storage_quota_enforcer` | Event-driven | Checks quota on every R2 upload |
| `notification_engine` | Event-driven | Fires alerts via Supabase triggers |
| `audit_log_archiver` | Weekly | Archives old audit logs |

### Secondary (Super Admin Manual Override — only when needed):
- Override a tenant's plan or limits
- Manually suspend/reactivate a tenant
- Toggle a specific module for a specific tenant
- Send a platform announcement
- Impersonate a tenant for support
- Override a payment status (offline payment received)
- Force logout a user session

Every automated process has:
1. Status indicator in Super Admin (running / paused / failed)
2. Manual override / trigger button
3. Alert if the automation fails

---

## 3. Super Admin — Full Platform Control (13 Domains)

Route: `/super-admin` — accessible ONLY to `is_super_admin = true` in DB.

1. **Tenant Management** — create/suspend/reactivate/delete, plan override, storage quota, impersonation with mandatory audit
2. **User Management** — view all users across tenants, suspend/force-logout/change-roles/force-password-reset
3. **Subscription & Billing** — create/edit/delete plans, manual plan assignment, discounts, mark-paid, manual refunds
4. **Payment Config** — platform Razorpay (SaaS billing), tenant payment provider visibility (NOT keys — Vault only)
5. **AI & Integrations** — master toggle (ai_api_enabled), provider selection, token usage monitoring, per-tenant AI access
6. **Platform Settings** — name/logo/favicon/timezone/currency, maintenance mode, announcement banner, feature flags
7. **Security & Access** — complete audit trail (filter/export), password policy, session timeout, MFA, IP controls
8. **Data & Storage** — R2 storage per tenant, storage quota management, tenant data export, DB stats
9. **Notifications & Communications** — platform-wide and per-tenant announcements
10. **Module Control Per Tenant** — toggle any individual module ON/OFF per tenant (edge-case override)
11. **Analytics & Monitoring** — platform-wide dashboard, tenant health scores, churn risk, automation status
12. **Support Tools** — impersonate, support notes, VIP/at-risk/churned tags
13. **Smart Alerts** — inactive tenant (30d), churn risk, payment failure, storage >90%, automation failures, new signups

### Audit rules:
- Every action logged in `super_admin_audit_log` (action, target, before/after, IP, is_automated)
- Destructive actions require typing "DELETE" to confirm
- Impersonation requires reason (min 5 chars), creates session record
- Sensitive values (API keys) encrypted via Supabase Vault — never returned to frontend

---

## 4. Payment Architecture

### 4a. Platform Razorpay (SaaS Billing — Hariprathish's account)
- Collects subscription fees FROM tenants TO OccasionPro
- Single Razorpay account, switchable from Super Admin panel
- Credentials encrypted in Supabase Vault
- Subscription plans: Starter (₹999/mo), Pro (₹2,999/mo), Business (₹7,999/mo), Enterprise (custom)
- Billing is fully automated (subscription_scheduler job)

### 4b. Tenant Payment — Multi-Provider, All Optional
Tenants can connect any of these or use offline-only (default):

| Provider | Region | Keys Required |
|---|---|---|
| Razorpay | India | Key ID + Key Secret |
| Stripe | International | Publishable Key + Secret Key |
| PayU | India | Merchant Key + Salt |
| Cashfree | India | App ID + Secret Key |
| PayPal | International | Client ID + Secret |
| Instamojo | India | API Key + Auth Token |
| **Manual/Offline** | Any | None — always available |

**Key principles:**
- Finance module works 100% without any payment provider
- Invoice creation, instalment scheduling, payment tracking — all work offline
- "Send Payment Link" button shown ONLY if tenant has connected a provider (otherwise hidden)
- "Record Payment" (offline) is always visible: amount, date, method dropdown, reference, notes
- Payment status = total received (online + offline) vs invoice total
- No blocking banners: "Connect Razorpay" is a soft nudge in workspace settings only

### 4c. Payment Provider Interface (IPaymentProvider)
```typescript
interface IPaymentProvider {
  createPaymentLink(invoice: Invoice): Promise<{ url: string; paymentId: string }>
  verifyPayment(paymentId: string): Promise<{ status: string; amount: number; timestamp: Date }>
  refund(paymentId: string, amount: number): Promise<{ success: boolean }>
  getTransactionHistory(tenantId: string): Promise<Transaction[]>
}
```
Implementations: `RazorpayProvider`, `StripeProvider`, `PayUProvider`, `CashfreeProvider`, `PayPalProvider`, `InstamojoProvider`

`PaymentService` resolves correct provider at runtime from `tenant_payment_config.provider` field.

---

## 5. AI Architecture

### 5a. Rule-Based Intelligence Layer (FREE — Always On)
All "smart" features are pure math/regex/keyword algorithms. Zero cost, zero external APIs, zero ML models.

| Module | Smart Features |
|---|---|
| Dashboard | Event Health Score (weighted: RSVP% + budget% + tasks% + vendors%), days-urgency indicator |
| Guests | Fuzzy duplicate detection (Levenshtein), completeness score, headcount prediction (optimistic/realistic/pessimistic) |
| F&B | Auto-quantity calculation (meal type multipliers + wastage buffer), per-item coverage check |
| Budget | Burn rate predictor, payment due alerts, category utilization heat |
| Vendors | Double-booking detection, confirmation status alerts |
| Timeline | Critical path alerts, task overdue detection |
| Check-in | Real-time occupancy severity (green/amber/red), hourly arrival rate |
| Accommodation | Room over-allocation detection, occupancy forecast |
| Communication | Sentiment scoring (keyword-based), open-rate benchmarking |
| Documents | Expiry date alerts (7d/30d warnings), missing document detection |
| Legal/Permits | Permit expiry alerts, compliance checklist status |
| Gifts | Budget vs received variance alerts |
| GST | GSTIN validator (regex), tax category mismatch alerts |
| Surveys | NPS score (promoters−detractors/total×100), low response rate alerts |
| Health & Safety | First-aider coverage (1 per 50 guests), incident severity tracking |
| Client Portal | Event completion percentage, milestone alerts |
| Vendor Portal | Delivery timeline risk scoring |
| Super Admin | Tenant health scoring, churn risk detection, platform health grade |
| Mobile | Live event alerts, queue management indicators |

Reusable hooks: `useEventHealth()`, `useGuestCompleteness()`, `useBudgetBurnRate()`, `useOccupancySeverity()`
Unified component: `<SmartAlert severity="warning|critical|info|success" />`
Configurable thresholds per tenant.

### 5b. LLM API Toggle (PAID — Super Admin Controlled)
- Platform-wide toggle: `ai_api_enabled` in `platform_settings` table
- Default: **OFF**
- Controls ONLY: OpenAI/Anthropic/Ollama/LiteLLM API calls
- Does NOT affect rule-based features
- Super Admin sets provider (None / OpenAI / Anthropic / Ollama / LiteLLM) + API key
- API key encrypted in Supabase Vault
- Token usage monitored per tenant
- Guard: `AiApiEnabledGuard` on all LLM endpoints

---

## 6. WhatsApp Integration

- **Default:** Baileys / WPPConnect (free, open-source WhatsApp Web automation)
- **Swap to official Meta WhatsApp Business API:** single env var change (`WHATSAPP_PROVIDER=meta`)
- Provider adapter pattern: `IWhatsAppProvider` interface with `sendMessage(to, text, template?)` method
- Implementations: `BaileysProvider` (default), `MetaWhatsAppProvider` (when env var set)
- Used for: invitation delivery, RSVP confirmations, payment reminders, event day alerts

---

## 7. Android App

- **In scope.** Team/staff mobile app for field operations.
- **Tech:** Expo + React Native (not bare workflow)
- **Build:** EAS Build for APK/AAB distribution (no App Store required for internal use)
- **7 core screens:**
  1. Dashboard — live event status, today's tasks
  2. Check-in — barcode/QR scan, manual search, real-time count
  3. Guest List — filterable, offline-cached
  4. Tasks & Timeline — assigned tasks, status updates
  5. Incidents — report safety/operational incidents in real-time
  6. Vendor Coordination — vendor contacts, delivery status
  7. Notifications — push alerts, live event updates
- **Offline-first:** IndexedDB guest cache, sync queue for check-ins
- **NOT in Super Admin** — Super Admin is web-only

---

## 8. Media & Storage Strategy

- **R2 (Cloudflare):** Logos, avatars, small PDFs only. Max 10MB per file.
- **External links:** All photos and videos are stored via external links (Google Drive, Dropbox, YouTube, Vimeo). Platform never stores large media files.
- Reason: R2 costs scale poorly with media. External links are free.

### Per-Event Document Isolation
- Invitation design, RSVP form, voucher design — all are per-event local copies
- Template library = copy-on-use (editing a template never affects events using old copy)
- No shared mutable templates

---

## 9. Color System & Theming

### Brand Colors
- **Primary:** Purple `#7c3aed` (violet-700 in Tailwind)
- **Logo gradient:** Gold (`#f59e0b`) → Orange (`#f97316`) → Red (`#ef4444`)
- **Accent:** Purple-adjacent — `#8b5cf6`, `#6d28d9`

### Dark Mode
- Background: deep charcoal `#0f0f14`
- Card surface: `#1a1a24`
- Border: `#2d2d3d`
- Text: `#e2e2f0` (primary), `#9999b3` (muted)

### Implementation
- CSS custom properties as single source of truth (`--primary`, `--background`, `--foreground`, etc.)
- Light/dark toggle on ALL portals
- User preference persisted in localStorage
- Supabase tenant branding overrides CSS variables at runtime

---

## 10. RBAC & Permissions

- Module-level permissions per team member: **No Access / View / Edit / Full**
- Platform-wide defaults per role (Admin / Manager / Staff / Viewer)
- Event-specific overrides per member
- Super Admin sees all — no restrictions
- Tenant owner = full access to their workspace
- Permissions checked at API level (NestJS guards) AND UI level (hide/disable controls)

---

## 11. India-Specific Features

- **GST:** CGST/SGST (intrastate), IGST (interstate), GSTIN validator (regex), invoice-level tax breakdown
- **TDS:** TDS on vendor payments (deductible at source), TDS certificate generation
- **Payment:** Razorpay + PayU + Cashfree + Instamojo (all INR-native providers supported)
- **WhatsApp:** WhatsApp Business API for mass communication (most clients use WhatsApp over email)
- **Language:** Hindi/regional language consideration in guest communications (future)
- **Currency:** INR default, USD/EUR/GBP/AED for international events

---

## 12. Module Queue (Remaining)

| # | Module | Status |
|---|---|---|
| 99 | Client Portal (deep) | Pending |
| 107 | Contingency Planning | Pending |
| 108 | Audit Trail | Pending |
| 109 | Offline Check-in PWA | Pending |
| 110 | Gift Management | Pending |
| 111 | GST & Tax Compliance | Pending |
| 112 | Conference/Summit | Pending |
| 135 | Multi-Provider Payment Architecture | In Progress |
| 134 | Super Admin Frontend (full rebuild) | In Progress |

---

## 13. Tech Stack (Confirmed)

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, TailwindCSS, ShadCN/ui, Framer Motion |
| Backend | NestJS, TypeScript |
| Database | Supabase (PostgreSQL + Row Level Security + Realtime) |
| Cache | Redis (Upstash) via @keyv/redis |
| Queue | BullMQ |
| Mobile | Expo + React Native, EAS Build |
| Storage | Cloudflare R2 (small files only) |
| CDN | Cloudflare |
| Infra | Docker + Kubernetes (production), Docker Compose (local dev) |
| CI/CD | GitHub Actions |
| Realtime | Socket.IO + Redis Pub/Sub |
| Payments (Platform) | Razorpay (SaaS subscription billing) |
| Payments (Tenant) | Pluggable: Razorpay/Stripe/PayU/Cashfree/PayPal/Instamojo/Manual |
| AI (Rule-based) | Pure TypeScript algorithms — zero cost |
| AI (LLM) | Provider-agnostic: OpenAI/Anthropic/Ollama/LiteLLM (Super Admin toggle) |
| WhatsApp | Baileys (default) / Meta Business API (env var swap) |
| Secrets | Supabase Vault for all sensitive credentials |

---

*This document is the source of truth for architecture decisions. Update on every confirmed decision.*
