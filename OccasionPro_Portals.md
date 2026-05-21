# OccasionPro — All Portals: Features, Tools & Tech

> Enterprise Event Operating System — 7 Portal Architecture
> Stack: Next.js · React Native · NestJS · Supabase · Cloudflare · ElectricSQL · LiteLLM · Razorpay

---

## Portal Overview

| # | Portal | Users | Access |
|---|--------|-------|--------|
| 1 | Super Admin Portal | OccasionPro internal team | Email + Password + MFA |
| 2 | Company Admin Portal | Event company owners/directors | Google + Email + MFA |
| 3 | Event Manager Portal | Event managers/coordinators | Google + Email |
| 4 | Team Member Portal | All operational staff | Google + Email |
| 5 | Client Portal | Event clients/buyers | Google + Email + Magic Link |
| 6 | Vendor Portal | Vendors, suppliers, artists | Email + Password |
| 7 | Guest / Attendee Portal | Event attendees | Magic Link (invite-based) |

---

---

## 1. Super Admin Portal

> Platform-wide control center for OccasionPro's internal team. Full visibility into every tenant, transaction, and system metric.

### Features

#### Tenant Management
- Create, suspend, reactivate, delete company accounts
- View all tenants with plan, usage, and health status
- Override tenant settings and configurations
- Impersonate any tenant for support purposes
- Force password resets and session termination

#### Subscription & Billing
- View all active subscriptions across tenants
- Manage freemium → paid tier upgrades
- Override billing cycles and apply credits
- Revenue dashboard (MRR, ARR, churn, LTV)
- Razorpay transaction log and dispute management

#### Feature Flag Management
- Enable / disable features per tenant
- Global rollouts and A/B testing
- Beta feature access control
- Emergency kill switches for any feature

#### Platform Analytics
- Global usage metrics (active events, users, API calls)
- Real-time system load and performance
- AI usage tracking per tenant (token consumption)
- Storage consumption per tenant (R2)
- Geographic distribution of users

#### System Health & Monitoring
- Live error tracking (GlitchTip)
- Cloudflare Workers performance metrics
- Supabase database health and query performance
- ElectricSQL sync status across tenants
- Uptime monitoring and incident history

#### White-Label Management
- Approve custom domain requests
- SSL certificate status per tenant
- Custom branding configurations
- Branded mobile app build management

#### Security & Compliance
- Global audit log across all tenants
- Suspicious activity detection
- GDPR data deletion requests
- Data export requests per tenant
- API rate limit management per tenant

#### AI Platform Configuration
- LiteLLM model routing rules
- AI token budget per plan tier
- Cloudflare AI Gateway analytics
- Model performance benchmarking

#### Support Tools
- Cross-tenant search
- Support ticket escalation view
- Broadcast announcements to all tenants
- Scheduled maintenance mode

### Tech Stack
```
Frontend:     Next.js + TypeScript + Tailwind + ShadCN
Auth:         Supabase Auth (Email + MFA, super_admin role)
Database:     Supabase (super admin schema, bypasses RLS)
Feature Flags: Flagsmith (self-hosted)
Monitoring:   GlitchTip (self-hosted) + Cloudflare Analytics
AI Config:    LiteLLM admin UI (self-hosted on Fly.io)
Billing:      Razorpay Dashboard API
Edge:         Cloudflare Workers + Zero Trust (internal access only)
```

---

---

## 2. Company Admin Portal (AI Command Center)

> The operating brain of each event company. Manages the entire business — people, revenue, events, vendors, and AI intelligence.

### Features

#### AI Command Center Dashboard
- Real-time business intelligence overview
- Active events status with health scores
- Revenue vs target tracking
- Team utilization heatmap
- Vendor performance overview
- AI-generated daily business briefing
- Risk alerts and recommendations
- Profitability forecasting per event

#### Company Configuration
- Company profile, branding, and white-label setup
- Custom domain configuration
- Plan and subscription management (Razorpay)
- Timezone, currency, and language settings
- Business hours and holiday calendar
- Company-wide notification preferences

#### Team Management
- Invite team members with role assignment
- Role and permission matrix builder
- Team hierarchy and org chart
- Performance tracking per team member
- Salary and commission management
- Attendance and shift scheduling
- Onboarding workflow automation

#### Event Portfolio Overview
- All events across all stages (pipeline → active → completed)
- Multi-event revenue aggregation
- Event type breakdown analytics
- Seasonal trend analysis
- Event profitability comparison
- Capacity and resource conflict detection

#### CRM & Sales Overview
- Full sales pipeline (leads → proposals → won)
- Revenue pipeline value
- Client lifetime value tracking
- Conversion rate analytics
- Sales team performance
- AI proposal generation

#### Financial Control
- Company-wide P&L dashboard
- Budget vs actuals across all events
- Cash flow forecasting
- Outstanding payments (clients + vendors)
- Expense category breakdown
- Tax reporting (GST/VAT)
- Razorpay payout management

#### Vendor Ecosystem
- Approved vendor directory
- Vendor performance scores
- Contract renewal alerts
- Preferred vendor lists per event category
- Vendor payment history
- Blacklist management

#### AI Business Intelligence
- AI COO assistant (chat interface)
- Profitability optimization suggestions
- Staffing efficiency recommendations
- Vendor cost benchmarking
- Market pricing intelligence
- Crisis prediction alerts
- Revenue opportunity identification

#### Integrations & API
- API key management
- Webhook configuration
- Third-party integration settings
- Data export scheduling (CSV, PDF reports)
- Zapier/n8n webhook endpoints

#### Audit & Compliance
- Full company audit log
- User activity tracking
- Data access logs
- Document retention policies

### Tech Stack
```
Frontend:     Next.js + TypeScript + Tailwind + ShadCN + Framer Motion
Auth:         Supabase Auth (Google + Email + MFA + SSO via SAML)
Database:     Supabase (tenant-isolated via RLS)
Realtime:     Supabase Realtime (live dashboards)
AI:           Cloudflare AI Gateway → LiteLLM → Any LLM provider
Payments:     Razorpay (Subscriptions + Route + Dashboard API)
Queues:       Inngest (automated workflows, alerts)
Storage:      Cloudflare R2 (documents, reports, media)
Edge:         Cloudflare Workers
Monitoring:   GlitchTip
Feature Flags: Flagsmith
Email:        Brevo (automated reports, alerts)
```

---

---

## 3. Event Manager Portal

> The operational nerve center for planning, executing, and commanding individual events — from first brief to final wrap.

### Features

#### Event Creation & Setup
- Event type selection (wedding, conference, concert, etc.)
- Multi-phase event builder (planning → production → execution → wrap)
- AI-assisted event brief generation
- Budget templating by event type
- Auto-generated task list from event brief
- Venue shortlisting and booking workflow
- Timeline builder with milestone tracking

#### Multi-Event Dashboard
- All managed events in one view
- Status indicators (on track / at risk / critical)
- Upcoming deadlines across events
- Resource conflicts across events
- AI priority recommendations

#### Live Event Command Center
- Real-time event execution dashboard
- Team location and status tracking
- Live issue reporting and resolution
- Countdown timers and schedule adherence
- Emergency escalation buttons
- Vendor check-in confirmation
- Guest arrival tracking
- Live weather and external risk monitoring
- Cloudflare Durable Objects powering real-time sync

#### Budget Management
- Budget creation with AI suggestions
- Line item tracking with actuals vs estimates
- Change order management
- Vendor quote comparison
- Budget approval workflow (client sign-off)
- Profitability calculation in real-time

#### Timeline & Runsheet Builder
- Drag-and-drop timeline editor
- Minute-by-minute runsheet
- Auto-assignment of tasks to team members
- Buffer time calculations
- Dependency mapping between tasks
- PDF export for on-site use

#### Team & Task Management
- Task creation and assignment
- Priority levels and due dates
- Progress tracking per team member
- Blocker flagging and escalation
- Daily briefing generation (AI)
- On-call schedule builder

#### Vendor Coordination Hub
- Vendor brief generation (AI-assisted)
- Contract send and sign workflow
- Vendor communication thread per event
- Delivery confirmation tracking
- Performance scoring post-event

#### Client Communication
- Centralized client chat per event
- Proposal sharing and approval
- Mood board and concept sharing
- Change request management
- Automated progress updates
- Client sign-off checkpoints

#### Risk & Issue Management
- Risk register per event
- AI risk scoring and prediction
- Issue log with resolution tracking
- Escalation workflow
- Post-event lessons learned

#### Document Management
- Centralized document vault per event
- Version control on all documents
- e-Signature workflow
- Auto-generated event reports
- Media gallery management (Cloudflare R2)

#### Reporting & Analytics
- Event performance reports (post-event)
- Budget reconciliation report
- Team performance analysis
- Vendor performance summary
- Client satisfaction report
- AI-generated post-event debrief

#### Event Microsite + Ticketing *(toggle — off by default)*
> Enabled per-event via feature toggle. When ON, generates a public-facing event page. When OFF, the event is fully internal with no public presence.

- **Microsite Builder:** Branded one-page event website with event name, date, venue, schedule, speakers/performers, sponsors, and gallery
- Custom subdomain (e.g., `gala.clientbrand.com`) via Cloudflare Workers white-label routing
- Full branding control: logo, colors, hero image/video, typography — matches company white-label config
- Mobile-responsive, SEO-optimized, fast (Cloudflare Pages + edge CDN)
- **Ticket Tiers:** Create multiple ticket types (Early Bird, General, VIP, Table, Group)
- Ticket pricing, quantity caps, sale start/end dates, promo codes
- Razorpay payment integration (0% platform commission — gateway fee only)
- RSVP-only mode (free events, invite-based attendance)
- Pre-approval workflow: attendee registers → manager approves → ticket issued
- Ticket delivery via email (QR code) and Apple/Google Wallet
- **Sales Dashboard:** Real-time ticket sales, revenue, capacity utilization
- Affiliate/partner ticketing links with UTM attribution
- Waitlist management with auto-notify on cancellation
- Seat selection map (linked to Floor Plan Builder seat layout)
- Refund and transfer management via Razorpay
- Countdown timer, social share buttons, embedded maps
- Toggle OFF at any time — microsite goes offline, existing ticket holders retain access

**Tech:** Cloudflare Pages (microsite hosting), Cloudflare Workers (custom domain routing), Cloudflare KV (microsite config cache), Supabase (ticket + attendee data), Razorpay (payments + refunds), Brevo (ticket delivery emails), Wallet Pass API (digital tickets), qrcode.js (QR generation)

### Tech Stack
```
Frontend:     Next.js + TypeScript + Tailwind + ShadCN + Framer Motion
Mobile:       React Native + Expo (field command access)
Auth:         Supabase Auth
Database:     Supabase (PostgreSQL + RLS)
Realtime:     Cloudflare Durable Objects (live command center)
             + Supabase Realtime (data sync)
Offline:      ElectricSQL (full offline access to event data)
AI:           Cloudflare AI Gateway → LiteLLM (brief gen, risk scoring)
Storage:      Cloudflare R2 (documents, floor plans, media)
Queues:       Inngest (automated workflows, alerts, reminders)
Edge:         Cloudflare Workers (API routing)
Email:        Brevo (client communication triggers)
```

---

---

## 4. Team Member Portal

> The execution layer for all operational staff. Contains 12 specialized modules — each a full sub-system.

### Module 1 — CRM & Sales

**Features:**
- Lead capture and qualification
- Sales pipeline with drag-and-drop stages
- Contact and company management
- Proposal builder (AI-assisted)
- Quote generation with dynamic pricing
- Contract creation and e-signature
- Follow-up automation
- Call and meeting logging
- Win/loss analysis
- Commission tracking

**Tech:** Supabase (CRM tables), Inngest (follow-up automation), Brevo (email sequences), LiteLLM (AI proposals)

---

### Module 2 — Finance

**Features:**
- Event budget creation and management
- Expense tracking and categorization
- Invoice generation (client-facing)
- Vendor bill management and approval
- Payment collection (Razorpay links)
- Vendor payouts (Razorpay Route)
- P&L per event
- Tax calculation (GST/VAT multi-jurisdiction)
- Financial approval workflows
- Recurring expense tracking
- Currency conversion (global events)
- Financial report generation

**Tech:** Supabase, Razorpay (Gateway + Route), Inngest (payment workflows), Cloudflare R2 (invoice PDFs), LiteLLM (financial analysis)

---

### Module 3 — Operations

**Features:**
- Master task board (Kanban + List + Calendar)
- Project timeline management
- SOP library and execution checklists
- Resource allocation planner
- Logistics coordination
- Supplier order management
- Delivery tracking
- Operations runsheet builder
- Venue setup coordination
- Post-event breakdown management
- Operations analytics

**Tech:** Supabase, Cloudflare Durable Objects (live ops sync), ElectricSQL (offline), Inngest (automation)

---

### Module 4 — Production

**Features:**
- Technical requirements management
- Stage and set design documentation
- AV equipment tracking
- Power and infrastructure planning
- Technical rider management
- Equipment hire coordination
- Production schedule builder
- Crew management
- Technical runsheet
- Safety and compliance checklist
- Production cost tracking

**Tech:** Supabase, Cloudflare R2 (technical documents, floor plans), ElectricSQL (offline production docs)

---

### Module 5 — Hospitality

**Features:**
- Accommodation booking management
- Hotel room block coordination
- VIP hospitality planning
- Catering menu management
- Dietary requirement tracking
- F&B cost management
- Transport coordination (airport, venue)
- Green room and backstage management
- VIP experience workflows
- Hospitality budget tracking
- Hospitality vendor management

**Tech:** Supabase, LiteLLM (VIP experience suggestions), Cloudflare R2 (hospitality documents)

---

### Module 6 — Artist Management

**Features:**
- Artist / performer database
- Talent booking workflow
- Contract and rider management
- Artist fee and royalty tracking
- Technical rider parsing (AI)
- Travel and accommodation coordination
- Green room requirement management
- Performance schedule builder
- Artist communication portal
- Payment management (Razorpay Route)
- Post-performance review
- Artist relationship scoring

**Tech:** Supabase, Razorpay Route (artist payouts), LiteLLM (rider analysis, contract drafting), Cloudflare R2 (contracts, riders)

---

### Module 7 — Venue Management

**Features:**
- Global venue database
- Venue search and comparison
- Capacity and layout management
- Floor plan storage and annotation
- Venue contract management
- Booking and availability calendar
- Venue pricing negotiation tracking
- Site visit scheduling
- Venue requirement checklist
- Venue performance history
- Venue relationship management

#### Floor Plan Builder *(new)*
- Interactive drag-and-drop canvas for venue layout design
- Zone creation: stage, seating blocks, VIP areas, backstage, booths, F&B stations
- Capacity zone enforcement (max occupancy per zone)
- Table and chair arrangement tools
- Booth assignment for expos and trade shows (link to Vendor Portal)
- Restricted access zone tagging (linked to QR check-in access control)
- Floor plan versioning and history
- Export as PDF or image (for on-site printing and client approval)
- Multiple floor levels / outdoor + indoor support
- Seat map generation for ticketed events (links to Event Microsite + Ticketing)
- Shared view with Client Portal for client approval

**Tech:** Supabase, Cloudflare R2 (floor plans, contracts, exports), Cloudflare KV (venue cache), LiteLLM (venue recommendation), Konva.js / Fabric.js (canvas rendering)

---

### Module 8 — Inventory & Warehouse

**Features:**
- Equipment and asset registry
- Inventory tracking (in / out / damaged)
- QR/barcode-based check-in/check-out
- Storage location management
- Maintenance scheduling
- Asset depreciation tracking
- Rental inventory management
- Event kit builder (pack lists per event type)
- Stock level alerts
- Procurement management
- Inter-event inventory conflict detection

**Tech:** Supabase, React Native (QR scanner), ElectricSQL (offline inventory ops), Cloudflare KV (stock levels cache)

---

### Module 9 — Guest Management

**Features:**
- Master guest list management
- RSVP tracking and management
- Seating / table assignment (linked to Floor Plan Builder)
- Dietary and accessibility data
- Guest category management (VIP, press, general, media, speaker)
- Digital invitation management
- Plus-one management
- Guest communication (invites, reminders, updates)
- Walk-in management
- Real-time attendance tracking
- Post-event guest data export

#### QR Check-in *(expanded)*
- Unique QR code auto-generated per guest at RSVP confirmation
- Multi-zone check-in — separate QR scan points per zone (main entry, VIP lounge, individual sessions, backstage)
- Zone-level access control (VIP QR only admits to VIP zone — enforced by Floor Plan zone tags)
- Real-time headcount per zone via Cloudflare Durable Objects
- Duplicate scan detection and alert
- Bulk check-in for groups and delegations
- Full offline check-in — ElectricSQL local sync, auto-reconciles on reconnect
- QR scanner works on any iOS/Android device or laptop camera
- Walk-in registration: create guest on-the-fly, generate QR instantly

#### Badge Printing *(new)*
- Custom badge template designer (drag-and-drop: logo, name, role, company, QR code, color tier)
- Multiple badge layouts per guest category (VIP gold, general white, speaker teal, media press)
- On-demand print queue at check-in desk (auto-triggers on successful QR scan)
- Bulk pre-print with export for professional print shops
- On-arrival reprint for lost/damaged badges
- QR code embedded in badge for continued zone access scanning
- Compatible with standard label printers (Brother, Zebra) via browser print API
- Digital badge option (Apple/Google Wallet pass)

**Tech:** Supabase, React Native (check-in + scanner), ElectricSQL (offline check-in), Brevo (invitation emails), Cloudflare R2 (badge assets, invitation media), Supabase Realtime (live attendance), Cloudflare Durable Objects (zone headcount sync), qrcode.js (QR generation), Wallet Pass API (digital badges)

---

### Module 10 — Marketing

**Features:**
- Event marketing campaign management
- Social media content planning
- Email campaign builder (Brevo)
- Event landing page builder
- Ticket sales page integration
- Press release management
- Media kit builder
- Sponsor activation tracking
- Marketing budget management
- Campaign performance analytics
- UTM tracking and attribution
- Post-event marketing report

**Tech:** Supabase, Brevo (email campaigns), Cloudflare R2 (media assets), Cloudflare Pages (landing pages), LiteLLM (content generation)

---

### Module 11 — Support

**Features:**
- Internal helpdesk (team raising issues)
- Client issue ticketing
- Vendor complaint management
- Escalation workflow
- SLA tracking
- Knowledge base / FAQ builder
- Live chat (on-site event support)
- Issue resolution tracking
- Support analytics
- On-call rotation management

**Tech:** Supabase, Cloudflare Durable Objects (live support chat), Inngest (SLA alerts), Cloudflare KV (knowledge base cache)

---

### Module 12 — Mobile Operations

**Features:**
- Full offline-capable mobile app
- Field task management
- Real-time team communication
- On-site check-in tools
- Inventory QR scanner
- Live event status updates
- Emergency reporting
- Push notifications
- GPS team tracking (opt-in)
- Voice-to-task (AI)
- Offline runsheet access
- Photo/video capture and upload

#### Kiosk Mode *(new)*
- Full-screen self-check-in mode deployable on any tablet or display
- Guest self-scans their QR code from invitation or digital wallet pass
- Auto-triggers badge print on successful scan (connected to badge printer queue)
- Camera-based QR scanning or manual name search fallback
- Welcoming branded UI with company/event logo and colors
- Guest-facing — displays guest name, category, and session access on screen post-scan
- Idle screen shows event branding, schedule, sponsor logos
- Staff PIN lock — staff must enter PIN to exit kiosk mode or access back-office
- Multi-kiosk support — deploy multiple tablets at different entry points, all synced in real-time
- Full offline capability — logs check-ins locally, syncs to Supabase when reconnected
- Accessible mode: large text, high contrast, audio confirmation on check-in

**Tech:** React Native + Expo, WatermelonDB (local), ElectricSQL (sync), Cloudflare R2 (media upload), Expo Push Notifications, Supabase Realtime, Cloudflare Durable Objects (multi-kiosk sync)

---

### Team Member Portal — Full Tech Stack
```
Frontend (Web): Next.js + TypeScript + Tailwind + ShadCN + Framer Motion
Mobile:         React Native + Expo
Auth:           Supabase Auth (Google + Email)
Database:       Supabase (PostgreSQL + RLS per tenant)
Realtime:       Supabase Realtime + Cloudflare Durable Objects
Offline Sync:   ElectricSQL (self-hosted) + WatermelonDB (mobile)
AI:             Cloudflare AI Gateway → LiteLLM → Any LLM
Payments:       Razorpay (Route for payouts, Gateway for collections)
Queues:         Cloudflare Queues + Inngest
Storage:        Cloudflare R2
Edge:           Cloudflare Workers
Email:          Brevo
Push:           Expo Push Notifications
Monitoring:     GlitchTip
```

---

---

## 5. Client Portal

> The luxury client experience layer. Clients track their event, approve decisions, make payments, and stay involved — without operational overwhelm.

### Features

#### Event Overview
- Real-time event progress dashboard
- Milestone completion tracker
- Countdown to event day
- Budget overview (approved vs spent)
- Team contact directory
- Event summary card

#### Collaboration & Approvals
- Mood board and concept presentation
- Digital approval workflows (accept / request changes)
- Change request submission
- Document review and sign-off
- Version history on shared documents
- Comments and feedback threads

#### Budget & Payments
- Approved budget visibility
- Payment schedule and history
- Invoice review and payment (Razorpay)
- Change order approvals
- Receipt downloads
- Outstanding payment reminders

#### Guest List Management
- Upload and manage personal guest list
- Track RSVP responses
- Guest category assignment (VIP, family, etc.)
- Dietary and accessibility submission
- Seating preference input
- Guest list sharing with event manager

#### Communication Hub
- Direct messaging with event manager
- File sharing
- Meeting scheduling
- Video call integration (link-based)
- Notification preferences
- Activity feed

#### Event Day Experience
- Live event status feed
- Real-time schedule updates
- Emergency contact directory
- On-site request submission
- Live photo / video feed from team
- Feedback submission (real-time)

#### Post-Event
- Final event report
- Photo and video gallery (Cloudflare R2)
- Invoice and financial summary
- Review and testimonial submission
- Referral program

### Tech Stack
```
Frontend:     Next.js + TypeScript + Tailwind + ShadCN
Auth:         Supabase Auth (Google + Email + Magic Link)
Database:     Supabase (RLS — client sees only their events)
Realtime:     Supabase Realtime (live updates)
Payments:     Razorpay (payment links, invoice payment)
Storage:      Cloudflare R2 (documents, photos, videos)
Edge:         Cloudflare Workers
Email:        Brevo (payment reminders, milestone updates)
AI:           LiteLLM (change request impact analysis)
```

---

---

## 6. Vendor Portal

> The supplier and service provider hub. Vendors manage their profile, receive work, submit invoices, and get paid — all in one place.

### Features

#### Vendor Profile
- Company profile and portfolio
- Service category and specialization
- Coverage areas / regions
- Pricing tiers and packages
- Certifications and credentials
- Past work showcase (Cloudflare R2)
- Ratings and review history

#### Opportunity Management
- Available event job listings
- Quote / proposal submission
- Quote status tracking
- Job acceptance / decline workflow
- Negotiation thread per job
- Contract review and signing

#### Job Execution
- Assigned event briefs
- Requirement checklist per job
- File and document submission
- Deliverable confirmation
- Schedule and timeline view
- On-site check-in confirmation
- Issue reporting

#### Financial Management
- Invoice creation and submission
- Payment status tracking
- Razorpay Route payout history
- Tax document management
- Earnings analytics
- Multi-event financial summary

#### Communication
- Direct messaging with event team
- Notification preferences
- Document exchange
- Contract history

#### Artist Mode (for Performers)
- Technical rider builder
- Hospitality rider submission
- Travel and accommodation coordination
- Performance schedule view
- Set list and technical requirements
- Backstage and green room requests

### Tech Stack
```
Frontend:     Next.js + TypeScript + Tailwind + ShadCN
Auth:         Supabase Auth (Email + Password)
Database:     Supabase (RLS — vendor sees only their jobs)
Payments:     Razorpay Route (automated vendor payouts)
Storage:      Cloudflare R2 (portfolio, documents, deliverables)
Edge:         Cloudflare Workers
Email:        Brevo (job alerts, payment confirmations)
AI:           LiteLLM (quote optimization suggestions)
```

---

---

## 7. Guest / Attendee Portal

> The final-mile experience layer. The event consumer's interface — from invitation to post-event memories.

### Features

#### Invitation & RSVP
- Beautiful digital invitation display
- One-click RSVP (yes / no / maybe)
- Plus-one management
- Dietary and accessibility preferences
- T-shirt size, session preferences (conference)
- Confirmation email with QR pass (Brevo)

#### Personal Event Hub
- Personal agenda / schedule
- Session / activity selection (conferences)
- Table / seat assignment display
- Event venue map and directions
- Speaker / performer lineup
- Dress code and event information
- FAQ and contact directory

#### QR Check-In Pass
- Digital QR code (wallet-ready)
- Apple Wallet / Google Wallet integration
- Offline-capable display
- Access tier indicator (VIP, General, Media)

#### Event Day Experience
- Live schedule with real-time updates
- Push notifications for schedule changes
- On-site navigation (indoor maps)
- Concierge requests (transport, assistance)
- Food and beverage menu (if applicable)
- Live Q&A participation (conferences)
- Real-time feedback submission

#### Networking (Conference / Corporate Events)
- Attendee directory (opt-in)
- Meeting request and scheduling
- Business card exchange (QR-based)
- Session notes and bookmarks

#### Post-Event
- Event photo gallery (shared by team)
- Certificate download (conferences, workshops)
- Feedback survey
- Highlight reel access
- Share to social media

### Tech Stack
```
Frontend:     Next.js (web) + React Native + Expo (mobile)
Auth:         Supabase Auth (Magic Link — no password needed)
Database:     Supabase (RLS — guest sees only their event data)
Realtime:     Supabase Realtime (live schedule updates)
Offline:      ElectricSQL (offline agenda and QR pass access)
Storage:      Cloudflare R2 (event photos, certificates, media)
Push:         Expo Push Notifications (schedule updates, announcements)
Edge:         Cloudflare Workers
Email:        Brevo (invitation, confirmation, post-event)
AI:           LiteLLM (personalized schedule recommendations)
```

---

---

## Cross-Portal Tech Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE LAYER                     │
│         Workers · Pages · R2 · KV · Queues · AI Gateway      │
│              Durable Objects · Zero Trust · Hyperdrive        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                          │
│   Next.js (Web Portals)  ·  React Native + Expo (Mobile)     │
│              NestJS API  ·  Supabase Edge Functions           │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    DATA & SYNC LAYER                          │
│   Supabase (PostgreSQL + RLS)  ·  ElectricSQL (Offline Sync) │
│        Supabase Realtime  ·  WatermelonDB (Mobile Local)      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    SERVICES LAYER                             │
│  Razorpay · Brevo · LiteLLM · Inngest · Flagsmith · GlitchTip│
└─────────────────────────────────────────────────────────────┘
```

---

## Portal-to-Portal Data Flow

```
Super Admin
    └── manages → All Tenants (Company Admins)

Company Admin
    └── oversees → Event Managers + Team Members + Vendors + Clients

Event Manager
    ├── coordinates → Team Members (task assignment)
    ├── communicates → Clients (approvals, updates)
    ├── manages → Vendors (briefs, contracts)
    └── manages → Guests (list, check-in)

Team Member
    ├── executes → Tasks assigned by Event Manager
    ├── manages → Vendors, Inventory, Finance, Guests (per module)
    └── field ops → Mobile Operations (offline-capable)

Client
    ├── approves → Proposals, budgets, concepts
    ├── pays → Invoices via Razorpay
    └── manages → Guest list

Vendor
    ├── receives → Job briefs from Event Manager / Team
    ├── submits → Invoices, deliverables
    └── receives → Payouts via Razorpay Route

Guest
    ├── RSVPs → via invitation
    ├── checks in → via QR pass
    └── experiences → live event, post-event media
```

---

*OccasionPro — Built for the world's most complex events. Zero compromise.*

---

## Intelligence Layer — Core Requirement

> **Every module in OccasionPro must be intelligent. AI/smart features are not optional add-ons — they are first-class requirements, built inline as each module is constructed.**

### Implementation Stack
- **Rule-based algorithms** — deterministic logic for type detection, threshold alerts, scoring formulae
- **LiteLLM** — NLP-powered features (draft generation, summary, classification) via the `AiModule`
- **Supabase Realtime** — live websocket subscriptions for occupancy, check-in, command center feeds
- **PostgreSQL materialized views** — pre-computed scores refreshed on schedule (health scores, analytics)
- **BullMQ jobs** — background processing for expiry reminders, permit alerts, survey follow-ups

---

### 1. Smart Dashboard (Company Admin & Event Manager)

- **Event Health Score (0–100)**: Composite of budget variance %, task completion %, vendor confirmation %, guest RSVP rate, permit status, timeline adherence. Rendered as a colour-coded ring (green ≥ 80, amber 60–79, red < 60).
- **Predictive Alerts**: Budget trending → project overspend before event date. Timeline delays → auto-flag critical path slippage. Low RSVP → trigger follow-up campaign suggestion.
- **AI Daily Briefing**: LiteLLM-generated morning summary of the top 5 action items across all active events.
- **Anomaly Detection**: Flag unusual expense spikes, sudden vendor score drops, guest cancellation surges.

---

### 2. Smart Guests

- **Duplicate Detection**: Fuzzy-match on name + phone/email before insert; surface merge suggestion with confidence %.
- **Headcount Prediction**: RSVP acceptance rate × remaining invitations → predicted final headcount with ±10% confidence band.
- **Dietary & Accessibility Auto-Grouping**: Cluster similar dietary tags for F&B planning handoff.
- **Smart Follow-up Timing**: ML-suggested optimal send time for RSVP reminders based on historical response data.
- **VIP Auto-Tagging**: Flag guests matching known VIP criteria (title, relationship, spend history).

---

### 3. Smart F&B

- **Auto Quantity Calculation**: `confirmed_guests × ratio_per_pax × buffer_factor` for each menu item → purchase order draft.
- **Menu Conflict Detection**: Flag allergen clashes across guest dietary profiles.
- **Wastage Prediction**: Post-event analysis comparing ordered vs consumed; surfaces recommendations for next event.
- **Budget vs Actual Variance**: Real-time comparison; alert if F&B spend exceeds allocated budget by configurable threshold.
- **Vendor Performance Score**: Rolling average of delivery accuracy, quality ratings, on-time %.

---

### 4. Smart Budget

- **Overspend Root Cause Analysis**: When actual > budget, automatically surfaces the top 3 line items driving the variance.
- **Predictive Cash Flow**: Projects weekly outflow based on upcoming milestones and unpaid vendor invoices.
- **Margin Forecasting**: Revenue − projected total cost → live profit margin % with trend arrow.
- **Smart Approval Routing**: Expenses above configurable threshold auto-escalate to the next approval tier.
- **Category Benchmarking**: Compare spend ratios vs industry benchmarks (e.g., venue typically 30–40% of total budget).

---

### 5. Smart Vendors

- **Performance Score (0–100)**: Weighted composite of on-time delivery, invoice accuracy, responsiveness, quality ratings across all past events.
- **Conflict Detection**: Warn if the same vendor is double-booked across overlapping events on the same dates.
- **Recommendation Engine**: When adding a vendor slot, surface top-rated vendors from the tenant's master list filtered by category and budget range.
- **Contract Expiry Alerts**: 60 / 30 / 7 day reminders before vendor contract or insurance certificate expiry.
- **AI Brief Generation**: LiteLLM auto-drafts vendor briefing documents from event specs and job requirements.

---

### 6. Smart Communication

- **AI-Drafted Messages**: LiteLLM drafts context-aware messages based on thread type (client approval request, vendor brief, team update) with one-click send.
- **Priority Scoring**: Incoming messages scored by urgency keywords, sender role, and time to event → auto-sorted in inbox.
- **Sentiment Analysis**: Flag negative sentiment in client/vendor messages for urgent human review.
- **Response Time SLA**: Track average response time per thread; alert when SLA breached.
- **Smart Broadcast Targeting**: Auto-suggest audience segments for broadcasts based on message content classification.

---

### 7. Smart Timeline

- **Dependency-Aware Scheduling**: Tasks linked with `depends_on` relationships; Gantt view shows critical path highlighted.
- **Critical Path Detection**: Automatically calculates the longest dependency chain; any delay on the critical path updates the event risk score.
- **Auto-Rescheduling Suggestions**: When a milestone slips, surface a proposed revised schedule for impacted downstream tasks.
- **Resource Conflict Detection**: Flag team members or equipment assigned to overlapping tasks.
- **Milestone Health Indicators**: Each milestone shows % complete, days remaining, and risk level (on-track / at-risk / delayed).

---

### 8. Smart Check-in

- **Live Occupancy Counter**: Real-time guest count vs venue capacity; colour-coded (green < 80%, amber 80–95%, red > 95%).
- **Surge Detection**: Alert when check-in rate exceeds safe throughput threshold (configurable per gate).
- **Predicted Arrival Curve**: Based on RSVP response time patterns, predict arrivals per 15-minute window — allows staffing pre-positioning.
- **Offline Sync Queue**: IndexedDB stores scans offline; syncs in batch when connectivity restored; conflict resolution on duplicate scans.
- **VIP Fast-Lane Flag**: Automatically route VIP-tagged guests to priority lane on check-in screen.

---

### 9. Smart Accommodation

- **Auto-Assign Algorithm**: Match guests to rooms based on stated preferences, relationship clusters (families together), and VIP priority.
- **Occupancy Optimisation**: Minimise single-occupancy waste; suggest room-sharing for team members.
- **Availability Conflict Detection**: Alert on double-assigned rooms before confirmation.
- **Check-in / Check-out Timeline**: Auto-populate expected times from event schedule; flag guests arriving outside hotel check-in window.
- **Block Release Reminder**: Alert 14 days before hotel room-block release deadline.

---

### 10. Smart Documents

- **AI Type Detection**: Rule-based filename pattern matching + LiteLLM fallback to classify uploaded files into 13 document types automatically.
- **Auto-Fill Templates**: LiteLLM populates contract/proposal templates from event metadata (client name, date, venue, budget).
- **Approval Routing**: Documents flagged as `requires_approval` auto-notify the approver via in-app notification + email.
- **Smart Alerts**: Surface "no signed contract", "permits missing", "N documents pending approval" as contextual banners.
- **Version Intelligence**: Detect when a new upload is likely a new version of an existing document (similar name + same type) and prompt to use version-replace flow.

---

### 11. Smart Reports (Post-Event AI Summary)

- **Auto-Generated Event Report**: LiteLLM synthesises budget variance, attendance accuracy, vendor performance, timeline adherence into a narrative post-event summary.
- **KPI Comparison**: Actual vs planned for all major metrics — guests, budget, timeline milestones, revenue.
- **Vendor Scorecards**: Auto-populated from delivery data; one-click export as PDF.
- **Lessons Learned Extraction**: LiteLLM identifies recurring issues across past events and surfaces actionable recommendations.
- **Client-Ready Report**: Stripped-down version with only client-visible metrics, auto-generated for client portal.

---

### 12. Smart Notifications

- **Priority Scoring Algorithm**: Notification priority = `urgency_weight × (1 / days_to_event) × sender_role_weight`. Surfaces most critical items first.
- **Digest Batching**: Low-priority notifications batched into a daily digest instead of real-time pings.
- **Snooze Intelligence**: Learn from user snooze patterns; auto-set optimal send time for future similar notifications.
- **Escalation Chains**: If a high-priority notification is unread after N hours, auto-escalate to the next tier (manager, then admin).
- **Channel Routing**: Route notifications to in-app, email, or WhatsApp based on user preference + urgency threshold.

---

### 13. Super Admin Intelligence

- **Tenant Health Scores (0–100)**: Per-tenant composite: active events %, team activity, revenue trend, support tickets, overdue tasks.
- **Churn Risk Detection**: Flag tenants with declining login frequency, dropping event count, or open support issues > 14 days.
- **Platform Usage Heatmaps**: Module-level usage analytics to identify underutilised features across the tenant base.
- **Anomaly Monitoring**: Flag unusual API usage spikes, failed payment surges, or error rate increases.
- **AI Tenant Brief**: LiteLLM-generated per-tenant health summary for CS team daily standups.

---

### Intelligence Implementation Rules

1. **Inline, not deferred** — Smart features are built into each module as it is constructed, not added later in a separate pass.
2. **Progressive enhancement** — Rule-based logic ships first; LiteLLM enhancement layered on top without blocking the base feature.
3. **Non-blocking UI** — Intelligence widgets (health scores, smart alerts, suggestions) load asynchronously; main content never waits on AI.
4. **Configurable thresholds** — Alert thresholds (budget overspend %, capacity %, permit expiry days) are tenant-configurable via settings.
5. **Audit trail** — All AI-generated content is flagged with a `ai_generated: true` metadata field and the model/version used.
6. **Graceful degradation** — If LiteLLM is unavailable, rule-based fallbacks always function; no feature is 100% dependent on LLM availability.

