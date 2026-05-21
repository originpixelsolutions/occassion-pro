# OccasionPro — Master Plan
> Living document. Last updated: 2026-05-21. Update after every major decision.

---

## PRODUCT VISION

OccasionPro is an **AI-powered enterprise event operating system** — the SAP of event management. It serves ALL event types globally: weddings, corporate events, concerts, government summits, sports events, religious gatherings, conferences, exhibitions, and virtual/hybrid events.

### Target scale
- Multi-tenant SaaS — event companies as tenants
- From boutique 2-person agencies to billion-dollar global event companies running 500 simultaneous events
- Supports events from 5 attendees to 500,000+

---

## PORTAL ARCHITECTURE

| Portal | Who Uses It | Description |
|--------|-------------|-------------|
| **Super Admin** | Platform owner (OccasionPro) | Full platform control, tenant management, billing, AI config, security |
| **Company Admin** (AI Command Center) | Workspace Owner + Managers | Business dashboard, CRM, analytics, AI assistant |
| **Event Manager Portal** | All staff (role-filtered) | Full event lifecycle management — access gated by workspace role |
| **Client Portal** | Event clients | Read-only views, approvals, document downloads |
| **Guest Portal** | Event guests | OTP login, RSVP, schedule, QR code, accommodation |
| **Vendor Portal** | Event vendors | Assignments, deliverables, invoices, documents, briefs |

### Workspace Role Hierarchy (Tenant-Level)

> **Critical**: The account that signs up becomes the **Workspace Owner** — not "Event Manager". The Owner has unconditional full access and cannot be restricted by anyone else.

| Role | DB Key | Rank | Capabilities |
|------|--------|------|-------------|
| **Owner** | `owner` | 4 | Full access to everything. Billing, settings, team. Cannot be demoted. One per workspace. |
| **Manager** | `event_manager` | 3 | Manages events, team operations. Owner can restrict module access. |
| **Lead** | `team_lead` | 2 | Leads sub-teams. Access restricted to assigned modules. |
| **Member** | `team_member` | 1 | Standard staff. Access per module permissions only. |

**Owner-only actions:** Billing/subscription changes · Workspace settings · Invite/remove members · Role assignment · Payment gateway config · API key management · Ownership transfer

**Ownership transfer:** Owner can transfer to any other member via `POST /team/transfer-ownership`. Current owner becomes Manager. Enforced by PostgreSQL partial unique index (`WHERE role = 'owner'`).

**Guard implementation:** `WorkspaceRoleGuard` + `@RequireTenantRole('owner')` decorator. Super Admins bypass all tenant role checks.

### Team Member Portal Modules
CRM & Sales · Finance · Operations · Production · Hospitality · Artist Management · Venue Management · Inventory & Warehouse · Guest Management · Marketing · Support · Mobile Operations

---

## TECH STACK

### Frontend
- Next.js 14 (App Router) · TypeScript · TailwindCSS · ShadCN UI · Framer Motion
- React Native + Expo (mobile — shared iOS/Android codebase)

### Backend
- NestJS · PostgreSQL (Supabase) · Redis · Prisma · BullMQ · WebSockets
- Event-driven architecture · Microservice-ready

### Infrastructure
- Docker · Kubernetes · AWS/GCP + Cloudflare (WAF, CDN, Workers)
- Supabase (Database + Auth + Realtime + Storage + Vault)
- Cloudflare R2 (file storage) · Cloudflare Workers (short links, edge)

### Realtime
- Socket.IO · Redis Pub/Sub · Supabase Realtime (for collaborative features)

---

## SUBSCRIPTION PLANS

**Architecture**: Fully configurable from Super Admin — name, price, limits, features changeable without code changes. Plans stored in `subscription_plans` table.

**Placeholder plans** (rename/reprice anytime from Super Admin):
- **Starter** — small agencies, limited events/users/storage
- **Pro** — mid-size agencies, expanded limits
- **Enterprise** — large agencies, unlimited + custom modules

Each plan configures: max_events, max_users, max_storage_gb, trial_days, enabled_modules[], price_monthly, price_yearly.

---

## TENANT SELF-SERVICE SIGN-UP

Flow:
1. Public landing page at `/` — OccasionPro marketing (features, pricing CTA)
2. `/register` — email + password → email verification
3. Workspace setup wizard: company name, slug, logo, timezone
4. Plan selection → start free trial or pay
5. Super Admin notified on new tenant sign-up
6. Approval mode: instant (default) or manual approval by Super Admin
7. Onboarding checklist for new tenant:
   - ☐ Create your first event
   - ☐ Invite your team
   - ☐ Set up payment

---

## iOS / ANDROID MOBILE APP

**Strategy**: React Native + Expo — 95% shared code between iOS and Android.

**Phase 1 (Build now)**: Android
- All components platform-agnostic
- `Platform.OS` only where truly required (e.g. push notification setup)

**Phase 2 (Architecture supports from Day 1)**: iOS
- EAS Build target addition
- APNs push notifications (handled by Expo automatically)
- App Store submission guide in docs

**Mobile-first modules**: check-in QR scanner, runsheet live view, guest management on-the-go, quick notifications.

---

## EMAIL SYSTEM

**Default provider**: Resend (free tier — 100 emails/day, excellent deliverability)
**Pattern**: Pluggable `IEmailProvider` interface

```typescript
interface IEmailProvider {
  sendEmail(to: string, subject: string, html: string, from?: string): Promise<void>
  sendBulk(emails: EmailPayload[]): Promise<BulkEmailResult>
}
```

**Providers**: `ResendProvider` (default) | `SendGridProvider` | `SMTPProvider` | `MailgunProvider`

**Switch via**: `EMAIL_PROVIDER=resend` env var or Super Admin config panel

**Transactional emails**:
- RSVP confirmation (with personalized details)
- Invoice delivery
- Payment receipt
- Password reset (15-min expiry link)
- Welcome + onboarding
- Event reminders (configurable: 7 days, 1 day, day-of)
- Guest thank-you post-event

---

## FLOOR PLAN MODULE

**Library**: Konva.js (React Konva) — performant for large canvas diagrams

### Canvas Features
- Infinite canvas — zoom in/out, pan freely
- Grid snapping (1m, 0.5m, custom)
- Ruler/measurement overlay
- Mini-map for navigation
- Multiple layers: Structure / Furniture / Guest Assignment (toggle visibility)
- Undo/redo (Ctrl+Z / Ctrl+Y)
- Autosave every 30 seconds to Supabase (JSON per event)

### Structure Layer Tools
Walls · Fences/Barriers · Entrance/Exit markers · Columns/Pillars · Stage · Dance floor · Tents/Canopy · Parking zones · Restrooms · Kitchen area · Registration desk · Bar counter · Custom labels

### Furniture Layer Tools
Round tables (4/6/8/10/12 seat) · Rectangular tables (2/4/6/8) · Banquet rows · Cocktail tables · Individual chairs · Buffet stations · Podium/Lectern · Photo booth · Projector screen · AV equipment markers

Copy/paste · Duplicate · Rotate · Resize any object

### Zone Management
Draw colored zones (VIP Zone, Family Section, Press Area) · Set capacity limit · Auto-count seats in zone

### Guest Assignment (right panel)
Drag guests from list onto tables · Filter by unassigned/dietary/VIP/company · Auto-suggest seating (group by company, family together, VIPs near stage)

### Export
PDF (A0/A1/A3 print-ready) · PNG (high res) · Excel seating chart · Read-only share link

---

## RUNSHEET — REAL-TIME COLLABORATIVE

**Tech**: Supabase Realtime (presence + broadcast)

### Collaborative Features
- Multiple team members edit simultaneously
- Presence indicators — avatars of who's viewing
- Live cursor positions on timeline
- Optimistic updates + conflict resolution (last-write-wins per field)
- Change highlighting — recently edited tasks flash briefly
- "X is editing this task" indicator per cell
- Comment thread per task

### Version History
- Full runsheet state at any past point
- Restore to any version

### Lock Mode
- Super Admin / Event Manager can lock runsheet (read-only for others) during live event

---

## DATA EXPORTS — ALL MODULES

### Rules
- All exports use **tenant logo, company name, and brand color** (from workspace branding)
- Formats: Excel (.xlsx) and PDF where appropriate; CSV for raw data
- Export button: top-right of every module page, always visible

### Per-Module Exports
| Module | Formats |
|--------|---------|
| Guests | Excel (full list: name, contact, RSVP, dietary, accommodation, transport, check-in, table, notes) |
| Budget | Excel (category breakdown + line items + actuals vs estimates + GST); PDF (formatted branded report) |
| Vendors | Excel (contact, service, amount, payment status, contract) |
| Runsheet | PDF (print-ready day-of sheet with branding); Excel (raw data) |
| F&B | Excel (menu, quantities, dietary counts, cost breakdown) |
| Accommodation | Excel (room allocations, guest names, dates, room numbers, vouchers) |
| Check-in | Excel (attendance report: who checked in, time, no-shows) |
| Finance/Invoices | PDF (GST-compliant branded invoice); Excel (payment tracker) |
| Gifts | Excel (gift log: giver, item, value, status) |
| Communication logs | Excel (message history, delivery status) |
| Surveys | Excel (all responses with timestamps); PDF (summary with charts) |
| Post-event report | PDF (full branded report, see Post-Event module) |
| Full event | ZIP file containing all exports for one event |

---

## CONFERENCE MODULE

Activated for events marked as type "Conference". 9 sub-modules:

### 8a. Registration & Ticketing
Ticket types (General/VIP/Speaker/Sponsor/Press/Student/Exhibitor) · Custom registration form per type · Promo codes · Group registration · Waitlist management · Registration deadline + late fee · QR code ticket email · Attendee self-serve portal

### 8b. Speaker Management
Speaker profile (bio, photo, designation, social links) · Session assignments · Speaker portal (upload presentation, update bio) · Travel & accommodation tracking · Confirmation status · Green room flag · Speaker kit checklist · Communication templates

### 8c. Session & Agenda Management
Multiple tracks (parallel sessions) · Session types (keynote/panel/workshop/breakout/networking/exhibition) · Drag-drop agenda builder · Conflict detection (same speaker, two simultaneous sessions) · Abstract submission workflow · Session check-in (QR at door) · Certificate of attendance generation · Published vs internal agenda view

### 8d. Sponsor Management
Sponsor tiers (Title/Platinum/Gold/Silver/Bronze/Community — fully configurable) · Benefits per tier · Sponsor portal · Exhibition booth assignment (linked to floor plan) · Sponsor invoice generation · Deliverables checklist

### 8e. Exhibition & Booth Management
Booth catalog (number, size, location, price, status) · Exhibitor portal · Setup schedule

### 8f. Networking Features
Attendee directory (opt-in) · Meeting request system · Networking session scheduler (auto-generate pairings)

### 8g. Live Session Features
Q&A management (submit → approve → display) · Live polling (real-time results) · Session feedback (5-star) · Streaming link support

### 8h. CPD/CEU Credit Tracking
Mark sessions as CPD-eligible · Auto-calculate credits per attendee · Certificate generation

### 8i. Conference Exports
Conference program (PDF booklet) · Speaker certificates · Attendance certificates · CPD certificates · Session attendance reports · Sponsor report

---

## POST-EVENT MODULE

Triggers when event status = "Completed". 11 sub-modules:

### 9a. Wrap-Up Checklist (auto-generated by event type)
Smart checklist: headcount recorded · vendor payments settled · client invoice paid · thank-you sent · venue cleared · equipment returned · feedback survey sent · photos received · report generated · testimonial requested · event archived

### 9b. Final Headcount Reconciliation
RSVPs vs actual check-ins · No-show rate · Walk-in count · Breakdown by category/table/zone

### 9c. Final Budget Reconciliation
Estimated vs actual per category · Variance analysis with reason · Cost per head · Unpaid vendor invoices · Client payment status · P&L summary

### 9d. Vendor Settlement
Final payment tracking · Rate vendors (1-5 stars) → feeds vendor performance score

### 9e. Guest Thank-You Communication
Bulk personalised WhatsApp/email · Variable substitution (name, event_name) · Attach: photo link, survey link, voucher · Delivery tracking · Schedule send

### 9f. Feedback & Survey Results
NPS calculation · Sentiment summary · Top positive themes / improvement areas · Per-category ratings · Export Excel + PDF

### 9g. Post-Event Report (Branded PDF)
Sections (toggleable): Event Overview · Attendance Summary · Budget Summary · Vendor Summary · Guest Feedback · Timeline Performance · F&B Summary · Accommodation Summary · Lessons Learned · Appendices

### 9h. Client Final Report & Invoice
Client-facing subset of post-event report · Final balance invoice · Send to client portal

### 9i. Testimonial & Review Request
Personalised testimonial request · Simple star + text form · Stored testimonials

### 9j. Event Archiving
Read-only after archiving · Searchable event history · Data kept forever unless manually deleted

### 9k. Smart Post-Event Alerts
Unpaid vendor invoices (day after) · Client payment overdue (3 days after) · Thank-you not sent (next morning) · Low survey response rate (2 days after) · Report not generated (1 week after)

---

## DIGITAL ANIMATED INVITATIONS

### Types
- **Static card** — beautifully designed (existing)
- **Animated web invite** — CSS + Framer Motion, URL-based cinematic experience
- **Video invitation** — external video embed + overlay text

### 10 Animation Templates
Royal/Traditional · Modern Minimal · Floral · Corporate · Bollywood/Festive · Garden Party · Luxury · Kids Party · Beach/Destination · Black Tie

### Builder Features
Content sections (toggleable): hero · host names · countdown timer · venue + map · dress code · schedule · RSVP button · media · personal message · footer

Visual: background · animation style · 20+ Google Fonts · colors · dividers · logo placement · background music (on user interaction)

### RSVP Integration
RSVP button embedded directly in invite — inline form submission

### Sharing
Unique short link per guest (personalised name auto-filled) · Send via WhatsApp/Email · QR code · PDF/PNG export

### Technical
- Public routes: `/i/[shortcode]` (Next.js dynamic, no auth required)
- Framer Motion + CSS animations
- Templates as JSON schema
- Builder: dnd-kit drag-drop
- Guest token in URL for personalisation

---

## SHORT LINKS

### Format
`links.occasionpro.in/[6-8 char alphanumeric]` — or tenant custom domain: `events.theirdomain.com/[code]`

### All Links That Get Shortened
Guest invitation · RSVP form · Accommodation voucher · Client portal access · Vendor portal · Payment links · Survey/feedback · Check-in QR · Event registration · Guest self-registration · Photo album

### Features
Click tracking (total, unique, device type, date/time) · Expiry option · Password protection · Custom alias · Bulk generation

### Analytics Per Link
Click timeline · Mobile vs desktop · Conversion tracking (RSVP completion after click)

### Technical
```sql
CREATE TABLE short_links (
  id uuid PRIMARY KEY,
  code text UNIQUE NOT NULL,        -- 6-8 char alphanumeric
  destination_url text NOT NULL,
  tenant_id uuid REFERENCES tenants,
  event_id uuid REFERENCES events,
  link_type text,                    -- invitation, rsvp, payment, etc.
  guest_id uuid REFERENCES guests,   -- nullable, for personalised links
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  click_count integer DEFAULT 0
);
```
- **Cloudflare Worker** at `links.occasionpro.in` — ultra-fast edge redirects
- Click tracking: async background call (redirect fires instantly, tracking non-blocking)

---

## F&B MODULE — ALL SERVING TYPES

### 15 Serving Style Types
1. **Sit-Down / Plated** — fixed menu per course, pre-order per guest during RSVP, dietary substitution per seat, course timing schedule
2. **Buffet** — stations (starters, salad bar, live cooking, mains, dessert, beverages, chaat), quantity per dish, replenishment schedule, smart quantity calculator
3. **Live Cooking / Action Stations** — dosa, pasta, wok, grill, chaat, omelette, biryani dum, tandoor, sushi, crepe, waffle, ice cream rolling, smoothie bar; per station: chef count, equipment, throughput, ingredients
4. **Cocktail / Finger Food** — canapes, bruschetta, mini sliders, satay; pieces per guest calculator, server count estimate (1:20 rule)
5. **High Tea** — tiered stands, dietary variants per tier
6. **Family Style / Sharing Platters** — auto-calculate: `ceil(guests / guests_per_platter)`
7. **Food Stalls / Kiosks** — per stall: cuisine, vendor, menu, footfall, revenue share, floor plan position, operating hours
8. **Thali Service** — veg/non-veg/jain/south indian; items per thali, refill tracking, token system option
9. **Token / Coupon System** — digital QR tokens, types (meal/snack/beverage/alcohol), issuance tracking, redemption tracking, age-gate for alcohol
10. **Bar & Beverage** — full/limited/soft/cash/token bar; alcoholic, non-alcoholic, hot beverage categories; per-drink quantity calculator, bartender count, last call time
11. **Midnight Snack / After-Party** — separate timing/quantity from main meal
12. **Welcome Drinks** — arrival window, linked to check-in module
13. **Cake / Dessert** — portions calculator, cutting time (linked to runsheet), takeaway mithai boxes
14. **Kids Menu** — pulled from guest list age/category filter
15. **Special Dietary** — vegan, jain, gluten-free, nut-free, halal/kosher, diabetic-friendly; kitchen separation requirements

### Smart F&B Engine
- **Auto-quantity formulas** per serving type:
  - Buffet: `dish_qty = guest_count × portion × 1.15`
  - Plated: exact = guest count
  - Finger food: `pieces = guest_count × pieces_per_person`
  - Beverages: `bottles = ceil((guests × drinks_per_hour × hours) / drinks_per_bottle)`
- **Coverage check**: veg options ≥ veg guests; jain ≥ jain guests
- **Allergen cross-check**: nuts in dish + nut-allergy guests → flag
- **Budget per head**: total F&B ÷ attending guests
- **Vendor capacity check**: caterer max ≥ guest count
- **Token reconciliation**: issued ≠ redeemed → investigate
- **Wastage report**: estimated vs actual post-event

### F&B Exports
- Catering brief (PDF — sent to caterer)
- Kitchen quantity sheet (Excel)
- Beverage order sheet (Excel)
- Token issue sheet (Excel)
- Post-event consumption report

---

## SECURITY ARCHITECTURE

### 1. Authentication Security
- Supabase Auth with bcrypt (never plaintext passwords)
- MFA (TOTP) — optional, enforceable by Super Admin
- Magic link expiry: 15 minutes
- Access tokens: 1 hour · Refresh tokens: 7 days, rotated on use
- Concurrent session limit: configurable per plan
- Account lockout: 5 failed attempts → 15 min lockout → alert
- Suspicious login alert: new device/location → notify account owner
- Password policy: min 8 chars, uppercase + number + special (configurable)
- HaveIBeenPwned check on new passwords (k-anonymity — no plaintext sent)
- No passwords in URLs, logs, or error messages

### 2. Authorisation & Access Control
- RLS on **every** Supabase table — no exceptions
- Every API endpoint validates JWT
- RBAC enforced at API layer (NestJS guards) AND database layer (RLS) — double enforcement
- Tenant isolation: architecturally impossible to access another tenant's data
- Module-level permissions checked on every request
- API rate limiting per endpoint per user (NestJS Throttler)

#### Workspace Role Hierarchy
- `owner` (rank 4): Unconditional full access. One per workspace. Billing, settings, team management.
- `event_manager` (rank 3): High access, module-level restrictions configurable by owner.
- `team_lead` (rank 2): Sub-team management, restricted by owner/manager.
- `team_member` (rank 1): Per-module access only.
- **Guard**: `WorkspaceRoleGuard` reads `@RequireTenantRole()` metadata, checks `tenant_members.role`
- **DB**: `CREATE UNIQUE INDEX ... WHERE role = 'owner'` ensures single-owner constraint
- **Transfer**: `transfer_workspace_ownership()` PostgreSQL function — atomic, validated
- **Super Admin bypass**: Super Admins skip all tenant role checks

### 3. Data Encryption
- All data encrypted at rest (Supabase + Supabase Vault for secrets)
- All data encrypted in transit (TLS 1.3 minimum)
- Sensitive fields encrypted at application level (payment keys, API keys, webhook secrets)
- Supabase Vault for all credentials
- Encryption keys rotatable without data loss

### 4. API Security
- HTTPS only — HTTP rejected with 301
- CORS: strict whitelist, no wildcard
- Helmet.js: all security headers (X-Frame-Options, HSTS, CSP, Referrer-Policy)
- CSRF protection on all state-changing endpoints
- Input validation: class-validator on every request
- Rate limiting: per-IP and per-user-token
- Webhook signatures verified (HMAC-SHA256)
- Request size limits enforced
- No stack traces in production responses

### 5. Tenant Data Isolation
- Complete isolation at DB level (RLS + tenant_id on every table)
- Super Admin impersonation: 30-min token, full audit log, cannot modify Super Admin credentials
- Shared nothing: no shared caches/queues/state between tenants

### 6. Secrets Management
- Zero secrets in code or git
- All secrets in env vars + Supabase Vault
- `.env` in `.gitignore` + git-secrets pre-commit hook
- Dependency scanning: npm audit + Snyk on every PR

### 7. Audit Trail & Monitoring
- Every data-changing action logged: user, action, entity, before/after, timestamp, IP, user_agent
- Audit logs: **immutable** (append-only, no UPDATE/DELETE on audit_log enforced by RLS)
- Sentry for exception tracking
- Structured JSON logging with request_id for tracing
- Log retention: 90 days minimum

### 8. Data Privacy & Compliance
- Data minimisation: only collect what's needed
- Right to erasure: hard delete for guest personal data (GDPR/DPDP compliant)
- Data portability: full export on request (JSON + CSV)
- Privacy policy + T&C: acceptance recorded at sign-up
- No user data sold or shared with third parties
- India IT Act 2000 + DPDP Act 2023 compliance
- WhatsApp/email logs: 30-day retention, auto-purge

### 9. Infrastructure Security
- Cloudflare: DDoS protection, WAF, bot detection, rate limiting at edge
- Docker: non-root user, minimal Alpine base images
- Dependabot: automatic security patch PRs
- Trivy: container image scanning in CI
- No SSH to production — CI/CD only

### 10. File & Media Security
- R2 uploads: signed URLs only, expire in 1 hour
- MIME type validated server-side
- File size limits per category (avatar <200KB, logo <1MB, PDF <5MB)
- No executable uploads (.exe, .sh, .php, .js server files blocked)
- URLs validated (no javascript: or data: URIs)

### 11. Frontend Security
- No sensitive data in localStorage
- Auth tokens in httpOnly cookies (prevents XSS theft)
- Strict CSP — no inline scripts
- All user content sanitised with DOMPurify
- HSTS with long max-age

### 12. Security Testing
- OWASP Top 10 reviewed for every major feature
- Automated: npm audit + Snyk + Trivy in CI
- SSL Labs A+ target
- Security headers tested before each production deploy

### 13. Incident Response
- Runbook in documentation
- Super Admin instant alerts: bulk exports, RLS bypass attempts, mass deletion
- One-click: suspend tenant, revoke all sessions, disable compromised API key

### 14. Smart Security Alerts (always on)
- 5+ failed logins in 10 min → lock + alert
- Login from new country → alert account owner
- Bulk export >1000 records → log + notify Super Admin
- API key used from new IP → alert
- Mass deletion >50 records in 1 min → require confirmation + log

---

## CURRENT BUILD STATUS

### ✅ Completed
- [x] Supabase multi-tenant schema (tenants, events, guests, vendors, staff, budget, invoices, etc.)
- [x] NestJS API — Auth, Tenant management, Events CRUD, Guest management
- [x] Super Admin Portal — all 16 pages (overview, automations, alerts, analytics, tenants, users, modules, billing, payments, AI, settings, data, branding, security, support, health)
- [x] Payment module — 7 providers (Razorpay, Stripe, PayU, Cashfree, PayPal, Instamojo, Manual)
- [x] Automation engine — 8 scheduled jobs (health check, billing, churn detection, etc.)
- [x] Audit log system
- [x] Tenant health score algorithm
- [x] **Realtime infrastructure** — `useRealtime.ts` (React Query + Supabase Realtime cache invalidation), `usePresence.ts` (who-is-online presence + PresenceAvatars component), Migration 047 (8 PostgreSQL cross-module triggers: guest check-in, RSVP change, vendor payment, invoice payment, task completion, accommodation assignment + recalculate_event_health composite score function)

### ✅ Additional Completed (confirmed via codebase survey May 2026)
- [x] **Self-service sign-up flow + marketing landing page** — `/register` 3-step wizard (account → workspace → plan), `/signup` redirect, register store (sessionStorage), password strength meter, slug availability check, timezone picker, logo upload, Google OAuth, plan cards with annual/monthly toggle
- [x] **Email system** — IEmailProvider interface, ResendProvider, SmtpProvider (nodemailer), SendGridProvider, MailgunProvider, 13 transactional email templates (welcome, verifyEmail, passwordReset, trialWelcome/expiring/expired, rsvpConfirmation, eventReminder, guestThankYou, invoiceDelivery, paymentReceipt, teamInvite, vendorInvite), EMAIL_PROVIDER env switch
- [x] **Short links** — Migration 054 (short_links table + short_link_clicks + generate_short_code() + resolve_short_link() RPC + analytics function + RLS), NestJS ShortLinksModule (create/bulk/resolve/analytics/update/deactivate), Cloudflare Worker (workers/short-links) at links.occasionpro.in with KV cache + async click tracking
- [x] **Floor plan editor (Konva.js infinite canvas)** — Migration 055 (floor_plans + floor_plan_tables + floor_plan_table_guests + auto_assign_guests() RPC + RLS), NestJS FloorPlanModule (init/get/save/unassigned/createTable/updateTable/deleteTable/assignGuest/unassignGuest/autoAssign/publish/exportSeatingChart), React Konva editor (infinite canvas, zoom/pan, grid snap, 10 shape types across 3 layers, undo/redo, auto-save, guest assignment right panel, context menus, draw tools, export PNG)
- [x] **Runsheet real-time collaboration** — `usePresence.tsx` (Supabase presence + PresenceAvatars), `useRunsheetGateway.ts` (Socket.IO live item updates + TypingIndicator), both wired into runsheet page
- [x] **Digital animated invitations** — `/events/[eventId]/invitations/` page with Framer Motion templates + invitation builder
- [x] **Conference module (9 sub-modules)** — `/events/[eventId]/conference/` with agenda, speakers, sessions, abstracts, live-voting, networking, exhibitors, streaming, analytics sub-pages
- [x] **Post-event module** — `/events/[eventId]/post-event/` with feedback, analytics, media-gallery, thank-you, highlights, report, follow-up, invoicing, closeout sub-pages
- [x] **F&B module overhaul** — 8 sub-pages (menu, dietary, tokens, stations, inventory, vendors, timeline, reports) + `fnb.service.ts` with smart serving engine
- [x] **React Native mobile app (Android Phase 1)** — `apps/mobile/` with 35+ files: task manager, runsheet, check-in scanner, notifications, offline sync (Zustand + AsyncStorage), push notifications
- [x] **All-module branded exports (Excel + PDF)** — `exports.service.ts` using PDFKit + ExcelJS, all-module export coverage
- [x] **Client Portal deep module** — `(client-portal)` route group: dashboard, timeline, documents, budget, guests, messages, approvals, payments (8 pages)
- [x] **Contingency Planning module** — `/events/[eventId]/contingency/page.tsx` with risk matrix, response plans, escalation workflows
- [x] **Offline Check-in PWA** — `[tenant]/events/[eventId]/checkin-pwa/` (5 files): Dexie.js offline DB, ZXing QR scanner, sync queue, PWA manifest
- [x] **Health & Safety module** — `health-safety/page.tsx` with incident reporting, capacity monitoring, emergency contacts, compliance checklist
- [x] **Audit Trail module** — `audit/page.tsx` + `audit.service.ts` with immutable log, filter/search, CSV export
- [x] **Gift Management module** — `gifts/page.tsx` + `gifts.service.ts` with gift registry, tracking, acknowledgment workflows
- [x] **GST & Tax Compliance module** — `gst/page.tsx` + `gst.service.ts` (Migration 090), invoice GSTIN, HSN codes, GST return export, TDS tracking

### 🔄 Next Build Queue (genuinely unbuilt as of May 2026)
- [x] **WhatsApp Business API broadcast system** — Mass guest communications via WhatsApp: template messages, delivery receipts, two-way reply inbox, opt-out management, broadcast scheduling, campaign analytics. Requires `whatsapp_broadcasts` + `whatsapp_messages` tables (Migration 091).
- [x] **Webhook automation builder** — Visual trigger → action rules engine: event-driven (guest RSVP, payment received, task completed, vendor confirmed) → actions (HTTP webhook, send email, create task, update field). No-code automation for power users. Migration 092.
- [x] **Enhanced public microsite v2** — Speaker profiles with bios/photos, full schedule grid (day/time slots), sponsor logos tier display, inline registration + ticket purchase form with Razorpay embed, countdown timer, social share meta tags, custom domain mapping. Migration 093.
- [x] **Multi-event cross-analytics dashboard** — Aggregate KPIs across all events in a tenant account: revenue trend, guest headcount YoY, vendor spend by category, task completion rate, top-performing event types. Executive-level BI view with date range filters and CSV export.
- [x] **AI Vendor Recommendation Engine** — Suggest vendors by event type, budget, category, and past performance scores. Uses LiteLLM to rank vendor shortlist with reasoning. Integrates into vendor assignment flow.
- [x] **SMS broadcast module** — Bulk SMS to guests/vendors via Twilio/MSG91: segmented sends (by RSVP status, accommodation type, dietary requirement), delivery tracking, reply-to-event inbox. Migration 095.
- [x] **Event website builder** — Drag-drop page builder for custom event landing pages beyond the public microsite: custom sections (sponsors, FAQs, map embed, countdown), publish to `event.occasionpro.in/[slug]` or custom domain, SEO meta, Google Analytics embed.
- [x] **Vendor payment disbursement** — Automated vendor payout scheduling: payment milestones (booking advance, pre-event, post-event), bank transfer via Razorpay Payout API, UPI payouts, disbursement approval workflow, reconciliation with budget actuals.
- [x] **Vendor Portal frontend (11 pages)** — Complete `(vendor-portal)` route group: auth/login, auth/forgot-password, auth/set-password, layout (sidebar nav + VendorCtx), dashboard (stats + pending-invite banner + upcoming list), assignments/page (search + 7 status filters), assignments/[assignmentId] (overview/messages/quotes tabs + accept/decline), messages (threaded inbox), payments (milestone list + summary cards + status filters), performance (score ring + metric bars + organiser reviews), profile (profile edit + bank details tab). Global vendor accounts (no tenant slug), token in localStorage as `vendor_session_token`.
- [x] **Guest Portal frontend** — Mobile-first OTP-gated portal at `(guest-portal)/g/[eventId]`. Single-page layout: OTP request → verify → authenticated portal with sections: My Invitation, RSVP Status, Event Details, My Accommodation, Transport, Meal Preference, My QR Code (prominent on event day), My Seating, Event Schedule, Photo Gallery, Contact Organiser, Feedback. Smart section priority based on event phase (today vs. future vs. past). Session token in localStorage as `guest_session_token`. `GuestCtx` provider for session state.
- [x] **Team invitation acceptance page** — `/join/[token]` public page (no auth required). Fetches `GET /api/v1/invite/info?token=xxx` → renders expired/revoked/accepted error states or form. Form: full name + password + confirm password. `PasswordStrength` component with 4 criteria bars (length ≥8, uppercase, number, special char). Submit: `POST /api/v1/invite/accept` → on success shows workspace/role confirmation card + auto-redirects to `/login` after 2s. Role display labels map: owner/event_manager/team_lead/team_member.
- [x] **Public event website viewer** — `/e/[slug]` public page. Fetches `GET /api/v1/sites/:slug`. Renders 13 section types: hero (background image + overlay + CTA), countdown (live 1-second interval hook), about, schedule (day-tab switcher + session list), speakers (grid + photo/initials + LinkedIn), sponsors (tier-grouped, grayscale → color on hover), FAQ (native details/summary accordion), register (ticket types + Razorpay CTA), map (Google Maps iframe), gallery (3-col lazy grid), contact (email/phone links + form), text, divider. Sticky responsive nav (transparent → dark backdrop on scroll), custom theming via `theme_config` (primary_color, background_color, text_color, font_family), dynamic document.title + favicon + custom CSS injection. "Powered by OccasionPro" footer.
- [x] **Event Check-in Management page** — `/events/[eventId]/checkin/` (Task #43). Full check-in operations dashboard: 4 tabs (Overview, Manual, Scanner, No-Shows). Live stats (total/checked-in/VIP/zone breakdown) polled every 10s via `GET /checkin/stats`. Supabase Realtime subscription on `guest_details` for live feed. ZXing `BrowserQRCodeReader` camera QR scanner (dynamic import). Manual check-in by guest search + click. No-shows list (RSVP'd attending but not yet arrived). Link to Offline Check-in PWA for tablet door use. Replaced `checkin-pwa` sidebar entry with `checkin` (standard routing).
- [x] **Guest CSV Import wizard** — `/events/[eventId]/guests/import/` (Task #44). 3-step wizard: (1) Upload — drag-drop CSV zone + FileReader + inline `parseCSV` handling quoted fields/CRLF/empty values + 5-row preview table; (2) Map Columns — auto-detection of headers (name/mobile/email/category/rsvp_status/dietary_requirement/table_number/accommodation_type/is_vip/notes) + manual override dropdowns + POST preview; (3) Result — import stats (imported/skipped/errors) + error detail table + import history from `GET /batches`. Import button + link added to guests page toolbar and empty state.
- [x] **Vendor Contracts page** — `/events/[eventId]/vendors/contracts/` (Task #45). Full contracts management: list all event contracts from `GET /events/:eventId/contracts`, status pipeline (draft→sent→signed→cancelled) with status summary cards, create contract modal (vendor picker, title, value, currency, effective/expiry dates, notes) via `POST /vendors/:vendorId/contracts`, inline status advance + cancel via `PUT /vendors/:vendorId/contracts/:id/status`. "Contracts" button added to event vendors page toolbar.
- [x] **CRM Proposals page** — `/crm/proposals/` (Task #46). Full proposals pipeline: list from `GET /proposals` with status badges (draft/sent/viewed/accepted/declined), visual pipeline bar with counts + %, create proposal modal (title, lead link, event link, amount, currency, valid-until, notes) via `POST /proposals`, timeline stamps (sent_at/viewed_at/accepted_at/declined_at), total accepted + pending pipeline value, expired badge. "Proposals" button added to CRM page header.

---

## REAL-TIME INTERCONNECTION ARCHITECTURE

### Core Engine
**Supabase Realtime** (PostgreSQL LISTEN/NOTIFY + WebSockets) — all tables have realtime enabled. Changes propagate to ALL connected clients (all portals, all devices) within **<500ms**.

### Cross-Module Data Flow Map

| Trigger Source | Effect on Other Modules |
|----------------|-------------------------|
| Guest checks in | Dashboard live counter · F&B token decrements · Floor plan shows guest as seated · Check-in task auto-progresses |
| Guest RSVP received | Dashboard health score · Headcount prediction · F&B quantity recalc · Communication log updated |
| Guest added/dietary change | F&B coverage check re-runs · Floor plan guest count · Badge print queue |
| Vendor confirmed | Timeline task auto-completes · Budget committed updates · Documents module |
| Vendor invoice paid | Budget actuals update · Finance module · Vendor portal shows "Paid" |
| Budget category overspent | Real-time alert to event manager |
| F&B quantities change | Budget F&B line item updates |
| Task completed in runsheet | Dependent tasks auto-unlock · Team member notified on mobile |
| Room assigned (accommodation) | Guest profile shows room number · Voucher generated · Short link created |
| Payment received (client) | Client portal balance updates within seconds |
| New tenant sign-up | Super Admin dashboard shows new tenant immediately |
| Platform error rate spike | Super Admin monitoring widget updates live |

### Implementation Pattern

```typescript
// Standard realtime subscription — replicate for every module
const channel = supabase
  .channel(`${moduleName}-${eventId}`)
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'guest_details', filter: `event_id=eq.${eventId}` },
    (payload) => queryClient.invalidateQueries(['guests', eventId])
  )
  .subscribe()
```

**Stack**: React Query (initial fetch + cache) + Supabase Realtime (invalidation). Result: instant UI updates, no full refetches.

### Key PostgreSQL Triggers (cross-module)

```sql
-- Guest check-in → decrement F&B tokens, update check-in counters
CREATE TRIGGER on_guest_checkin AFTER UPDATE ON guest_details
WHEN (NEW.check_in_status = 'checked_in')
EXECUTE FUNCTION handle_guest_checkin();

-- Vendor payment → update budget actuals
CREATE TRIGGER on_payment_made AFTER INSERT ON payments
EXECUTE FUNCTION update_budget_actuals();

-- RSVP change → recalculate event health score
CREATE TRIGGER on_rsvp_update AFTER UPDATE ON guest_details
WHEN (OLD.rsvp_status != NEW.rsvp_status)
EXECUTE FUNCTION recalculate_event_health();

-- Task completion → unlock dependencies
CREATE TRIGGER on_task_complete AFTER UPDATE ON runsheet_tasks
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION unlock_dependent_tasks();
```

### Presence System
- Who is online on each event tracked via Supabase Realtime presence
- Show avatars/initials of team members viewing same page
- "John is editing the runsheet" indicator
- Soft locks for concurrent edits (warns, doesn't hard block)

### No Stale Data Policy
- Active events: no data older than 5 seconds displayed
- Loading states on first load only — subsequent updates seamless
- Optimistic updates on all user actions (revert if API fails)
- Offline changes (mobile): sync the moment connection restores — conflict resolution: last-write-wins per field

### Client Portal Realtime
Event progress · Budget approvals · Document uploads · Payment status · RSVP live count · Messages — ALL update without page refresh.

### Vendor Portal Realtime
Task assignments · Payment status · Messages · Document requests — all instant.

---

## GUEST PORTAL — LOGIN & CUSTOMISATION SYSTEM

### Default: OFF (Link-only access)
By default, guests access everything via links only — invitation link, RSVP link, voucher link. No account, no password, no friction. This remains the default unless the tenant explicitly enables guest login.

### Toggle Levels
1. **Workspace-level default** — enable for all new events by default
2. **Per-event toggle** — override for a specific event (Event Settings → Guest Portal section)

### Authentication: Mobile OTP (No Password Ever)
- Guest enters mobile number → receives OTP via SMS or WhatsApp (tenant's choice)
- OTP: 6 digits, valid 10 minutes
- After verification: session lasts for event duration (or configurable: event day / 7 days / 30 days)
- Guest mobile number matched against guest record → auto-linked to their profile
- Number not on list → "You're not on the guest list" (configurable message)
- Self-registration: tenant can allow unlisted guests to register

### OTP Delivery (tenant selects)
- **WhatsApp** (preferred — uses existing WhatsApp provider)
- **SMS** (fallback — ISMSProvider interface)
- **Both** (WhatsApp primary, SMS fallback on failure)

**ISMSProvider** (same pattern as IEmailProvider / IPaymentProvider):
```typescript
interface ISMSProvider {
  sendOTP(mobile: string, otp: string, eventName?: string): Promise<void>
}
```
Providers: `Fast2SMSProvider` (default, free, India) | `MSG91Provider` | `TwilioProvider` | `TextLocalProvider`
Switch via: `SMS_PROVIDER=fast2sms` env var or Super Admin config panel.

### Rate Limiting
- Max 3 OTP requests per mobile per 15 minutes

### Guest Portal Sections (each toggleable by tenant per event)
| Section | Description |
|---------|-------------|
| My Invitation | Personalised animated invitation view |
| RSVP Status | View/update RSVP if still open |
| Event Details | Date, venue, dress code, schedule |
| My Accommodation | Room details, check-in/out, download voucher |
| Transport | Pickup time, vehicle, meeting point |
| Meal Preference | View/update dietary preference |
| My QR Code | Check-in QR (shown prominently on event day) |
| My Seating | Table assignment (released by organiser) |
| Event Schedule | Full program/agenda |
| Photo Gallery | External album link shared by organiser |
| Contact Organiser | Message to event team |
| Feedback/Survey | Post-event survey link |
| Gift Registry | If event has gift registry enabled |
| Conference Sessions | For conferences: registered sessions, speaker schedule |

### Smart Behaviour
- Pending RSVP → portal opens directly to RSVP section
- No room assigned → accommodation shows "Pending allocation"
- Event is today → QR code shown prominently at top
- Post-event → show survey + gallery, hide RSVP and QR

### Portal URLs
- Event portal: `links.occasionpro.in/[event-slug]/portal`
- Personalised: `links.occasionpro.in/[event-slug]/g/[guestcode]` → pre-fills guest's mobile number

### Tenant Customisation
- Custom portal title (e.g. "Sharma Wedding Guest Portal")
- Portal hero image (external URL)
- Brand color (auto from event branding or custom)
- Welcome message with guest name variable
- Custom footer text
- Show/hide "Powered by OccasionPro" (Super Admin can disable for white-label)

### Security
- JWT in httpOnly cookie (not localStorage)
- Session expiry: configurable per event
- Guest sees only their own data (RLS enforced: guest_id + event_id)

---

---

## CLIENT PORTAL — Auth & Access Model

### Core Concept
Clients who hire event companies get a dedicated portal to track their event. Email + password login. One client account can span multiple events (even across tenants if they work with multiple event companies).

### Access Grant Flow
1. Event Manager → event → Client Portal section → "Invite Client" (enters email)
2. New email → gets invitation email: "Set your password to access your event portal"
3. Existing account → gets notification: "You've been added to [Event Name]"
4. Client logs in → sees all events they have access to

### Database
```
client_accounts: id, email, full_name, phone, password
---

## PLATFORM OWNER DECISIONS (Confirmed)

### 1. Team Member Invitation — Invite Link Flow
- No pre-registered account required
- Workspace owner/event manager invites via email; system generates a short link (via ShortLinksModule with `link_type = 'team_invite'`)
- Recipient clicks link → lands on `/join/[token]` page → sets password → account created → redirected to Team Member Portal
- Token expires in 72 hours; can be resent; revocable before acceptance
- DB: `team_invitations` table: id, tenant_id, invited_email, role, token, invited_by, status (pending/accepted/revoked/expired), expires_at, created_at

### 2. Event Types — Two-Tier System
- **Built-in types** (15): Wedding, Corporate, Birthday, Conference, Concert, Exhibition, Product Launch, Award Ceremony, Funeral, Engagement, Baby Shower, Religious Ceremony, Sports Event, Social Gathering, Gala/Fundraiser
- **Custom types**: Tenant can create their own event types with custom name, icon, description
- Each event type drives **Smart Readiness** — a % score of recommended setup steps completed
- Smart Readiness shown prominently on the event dashboard (circular progress ring)
- `event_types` table with `is_system` flag; `event_type_readiness_checklist` table per type
- `events` table: added `event_type_id FK`, `currency_code VARCHAR(3) DEFAULT 'INR'`, `timezone VARCHAR(50) DEFAULT 'Asia/Kolkata'`

### 3. Guest Self-Registration — In Scope
- Guests can self-register via the public guest portal
- Before registering, guests see: event name, date, venue, description, cover image
- **Toggle**: tenant can enable/disable self-registration per event
- Self-registered guests default to `status = 'pending_approval'` unless tenant enables auto-approve (`auto_approve_guests` boolean on events)
- Workflow: Guest registers → pending queue → event manager approves/rejects → guest notified

### 4. Free Trial — 14-Day Growth Plan
- All new signups get 14-day Growth plan trial (no credit card required)
- After 14 days:
  - **Read-only mode**: existing data visible, NO new events/guests/vendors/anything
  - **Full-screen paywall** forced on every dashboard visit
  - Data preserved for **30 days post-trial** before permanent deletion if unpaid
- Implementation: `subscription_status` field on tenants; `trial_ends_at` timestamp; middleware checks on all write operations

### 5. Currency — Multi-Currency Per Event
- Each event has its own `currency_code` (ISO 4217, e.g. "INR", "USD", "EUR", "AED")
- All financial displays (invoices, budgets, payments) use the event's currency
- Super Admin can set platform default currency (default: INR)
- `events.currency_code VARCHAR(3) DEFAULT 'INR'`; stored on event; financial modules read it

### 6. Timezone — Per Event
- Each event has its own `timezone` (IANA string, e.g. "Asia/Kolkata", "America/New_York")
- All event datetime displays rendered in the event's timezone
- Tenant workspace has a `default_timezone` that pre-fills on event creation
- `events.timezone VARCHAR(50) DEFAULT 'Asia/Kolkata'`

### 7. Badge Printing — PDF Export
- Export printable PDF badge sheets in standard label sizes:
  - **A4-6**: 6 badges per A4 sheet
  - **A4-8**: 8 badges per A4 sheet
  - **Avery 5395**: compatible layout
- Badge fields: Guest Name, Event Name, Category/Table, QR code
- Tenant customisation: colors, logo, fields shown (toggle each field)
- PDF generated server-side via `BadgesService.generatePdf(eventId, options)`

### 8. Support System — In-App Bot + Escalation
- In-app chat widget in the Help section (all portals)
- **Bot**: rule-based FAQ matching (editable by Super Admin via Super Admin portal)
- **Escalation**: unresolved queries create a support ticket in Super Admin portal
- Ticket states: `open` → `bot_handled` | `escalated` → `resolved`
- `support_faqs` table: question pattern, answer, category, sort_order (Super Admin editable)
- `support_tickets` table: id, tenant_id, user_id, subject, messages JSONB, status, escalated_at, resolved_at
- `SupportModule` in NestJS; `SupportChatWidget.tsx` React component

### 9. Event Deletion — 30-Day Soft Delete
- "Delete" moves event to **Deleted Events archive** (visible to workspace owner only)
- Restore button available during 30-day window
- After 30 days: **permanent cascade purge** (automated scheduled job)
- Countdown shown: "Permanent deletion in X days"
- Super Admin can: force-purge early OR extend the window
- DB: `events.deleted_at TIMESTAMP` (soft delete); `events.purge_after TIMESTAMP DEFAULT deleted_at + 30 days`
- Scheduled job: `EventPurgeScheduler` runs daily, purges where `purge_after < NOW()`

---

