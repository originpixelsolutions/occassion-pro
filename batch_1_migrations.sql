-- ============================================================
-- Migration: 001_extensions_and_types.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 001: Extensions & Custom Types
-- ============================================================

-- ── EXTENSIONS ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";          -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS "unaccent";          -- accent-insensitive search
CREATE EXTENSION IF NOT EXISTS "btree_gin";         -- GIN index support

-- ── ENUMS ────────────────────────────────────────────────────

-- Tenant plan tiers
DO $$ BEGIN
  CREATE TYPE plan_tier AS ENUM ('free', 'starter', 'growth', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tenant status
DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'trial', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User roles across the platform
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
  'super_admin',
  'company_admin',
  'event_manager',
  'team_member',
  'client',
  'vendor',
  'guest'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Event status
DO $$ BEGIN
  CREATE TYPE event_status AS ENUM (
  'draft',
  'briefing',
  'proposal',
  'confirmed',
  'planning',
  'production',
  'live',
  'completed',
  'cancelled',
  'postponed'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Event type (broad categories)
DO $$ BEGIN
  CREATE TYPE event_category AS ENUM (
  'wedding',
  'corporate',
  'concert',
  'conference',
  'festival',
  'sports',
  'government',
  'religious',
  'exhibition',
  'educational',
  'virtual',
  'hybrid',
  'private_party',
  'other'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Task status
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Task priority
DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Lead / CRM stage
DO $$ BEGIN
  CREATE TYPE lead_stage AS ENUM (
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'negotiating',
  'won',
  'lost',
  'on_hold'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoice status
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
  'draft',
  'sent',
  'viewed',
  'partial',
  'paid',
  'overdue',
  'cancelled',
  'refunded'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payment status
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'partially_refunded'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vendor contract status
DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM (
  'draft',
  'sent',
  'signed',
  'active',
  'completed',
  'disputed',
  'cancelled'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Guest RSVP status
DO $$ BEGIN
  CREATE TYPE rsvp_status AS ENUM ('pending', 'accepted', 'declined', 'maybe', 'waitlisted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Check-in status
DO $$ BEGIN
  CREATE TYPE checkin_status AS ENUM ('checked_in', 'checked_out', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Risk level
DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Floor plan zone type
DO $$ BEGIN
  CREATE TYPE zone_type AS ENUM (
  'stage',
  'seating',
  'vip',
  'backstage',
  'entrance',
  'exit',
  'booth',
  'food_beverage',
  'green_room',
  'parking',
  'restricted',
  'general'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ticket status
DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('active', 'used', 'cancelled', 'refunded', 'transferred');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Microsite status
DO $$ BEGIN
  CREATE TYPE microsite_status AS ENUM ('draft', 'published', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Inventory transaction type
DO $$ BEGIN
  CREATE TYPE inventory_tx_type AS ENUM ('in', 'out', 'damaged', 'lost', 'maintenance', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notification channel
DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('email', 'push', 'sms', 'in_app');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AI generation type
DO $$ BEGIN
  CREATE TYPE ai_gen_type AS ENUM (
  'event_brief',
  'proposal',
  'email_draft',
  'risk_assessment',
  'budget_suggestion',
  'vendor_brief',
  'post_event_report',
  'guest_message',
  'social_content',
  'runsheet'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Migration: 002_tenants_and_users.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 002: Tenants & Users (Multi-Tenant Core)
-- ============================================================

-- ── TENANTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,          -- used in subdomain: slug.occasionpro.in
  logo_url        TEXT,
  website         TEXT,
  email           TEXT,
  phone           TEXT,
  address         JSONB DEFAULT '{}',            -- {line1, line2, city, state, country, zip}
  timezone        TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  currency        TEXT NOT NULL DEFAULT 'INR',
  country         TEXT NOT NULL DEFAULT 'IN',
  plan            plan_tier NOT NULL DEFAULT 'free',
  status          tenant_status NOT NULL DEFAULT 'trial',
  trial_ends_at   TIMESTAMPTZ,
  settings        JSONB NOT NULL DEFAULT '{}',   -- feature toggles, preferences
  metadata        JSONB NOT NULL DEFAULT '{}',   -- custom fields, integrations
  razorpay_account_id TEXT,                      -- for Route payouts
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- ── WHITE LABEL CONFIG ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS white_label_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  custom_domain   TEXT UNIQUE,                   -- e.g. app.myclientbrand.com
  brand_name      TEXT,
  primary_color   TEXT DEFAULT '#1D4ED8',
  accent_color    TEXT DEFAULT '#06B6D4',
  logo_url        TEXT,
  favicon_url     TEXT,
  font_family     TEXT DEFAULT 'Inter',
  email_from_name TEXT,
  email_from_addr TEXT,
  custom_css      TEXT,
  ssl_verified    BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wl_tenant ON white_label_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wl_domain ON white_label_configs(custom_domain);

-- ── TENANT SUBSCRIPTIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan                plan_tier NOT NULL,
  razorpay_sub_id     TEXT,
  status              TEXT NOT NULL DEFAULT 'active', -- active | paused | cancelled
  billing_cycle       TEXT NOT NULL DEFAULT 'monthly', -- monthly | yearly
  amount              NUMERIC(12,2),
  currency            TEXT NOT NULL DEFAULT 'INR',
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subs_tenant ON tenant_subscriptions(tenant_id);

-- ── PROFILES (extends auth.users) ────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
  full_name       TEXT,
  display_name    TEXT,
  avatar_url      TEXT,
  phone           TEXT,
  timezone        TEXT DEFAULT 'Asia/Kolkata',
  language        TEXT DEFAULT 'en',
  is_super_admin  BOOLEAN NOT NULL DEFAULT false,
  last_seen_at    TIMESTAMPTZ,
  onboarded       BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- ── USER ROLES ───────────────────────────────────────────────
-- A user can have different roles across different tenants
CREATE TABLE IF NOT EXISTS user_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role            user_role NOT NULL,
  permissions     JSONB NOT NULL DEFAULT '{}',   -- fine-grained permission overrides
  is_active       BOOLEAN NOT NULL DEFAULT true,
  invited_by      UUID REFERENCES profiles(id),
  invited_at      TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tenant_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- ── INVITATIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            user_role NOT NULL,
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      UUID REFERENCES profiles(id),
  accepted_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

-- ── AUDIT LOG ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,                 -- create_event, update_invoice, delete_guest, etc.
  resource_type   TEXT NOT NULL,                 -- events, invoices, guests, etc.
  resource_id     UUID,
  old_data        JSONB,
  new_data        JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ── NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  body            TEXT,
  channel         notification_channel NOT NULL DEFAULT 'in_app',
  resource_type   TEXT,
  resource_id     UUID,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ── AUTO-UPDATE TRIGGER ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS user_roles_updated_at ON user_roles;
CREATE TRIGGER user_roles_updated_at BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS wl_updated_at ON white_label_configs;
CREATE TRIGGER wl_updated_at BEFORE UPDATE ON white_label_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS subs_updated_at ON tenant_subscriptions;
CREATE TRIGGER subs_updated_at BEFORE UPDATE ON tenant_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Migration: 003_events.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 003: Events
-- ============================================================

-- ── EVENT TEMPLATES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        event_category NOT NULL,
  default_budget  NUMERIC(14,2),
  default_tasks   JSONB DEFAULT '[]',    -- array of task templates
  default_runsheet JSONB DEFAULT '[]',  -- array of runsheet items
  default_vendors JSONB DEFAULT '[]',   -- suggested vendor categories
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evt_tmpl_tenant ON event_templates(tenant_id);

-- ── EVENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES event_templates(id),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  category        event_category NOT NULL,
  status          event_status NOT NULL DEFAULT 'draft',

  -- Scheduling
  event_date      DATE,
  start_time      TIME,
  end_time        TIME,
  setup_date      DATE,
  breakdown_date  DATE,
  timezone        TEXT DEFAULT 'Asia/Kolkata',

  -- Location
  venue_id        UUID,                  -- FK added in venues migration
  venue_name      TEXT,                  -- denormalized for speed
  venue_address   JSONB DEFAULT '{}',

  -- Scale
  expected_guests INTEGER,
  confirmed_guests INTEGER DEFAULT 0,
  checked_in_guests INTEGER DEFAULT 0,

  -- Financial
  budget_total    NUMERIC(14,2),
  budget_spent    NUMERIC(14,2) DEFAULT 0,
  quoted_amount   NUMERIC(14,2),
  currency        TEXT NOT NULL DEFAULT 'INR',

  -- People
  manager_id      UUID REFERENCES profiles(id),   -- lead event manager
  client_id       UUID REFERENCES profiles(id),   -- primary client contact

  -- Microsite toggle
  microsite_enabled BOOLEAN NOT NULL DEFAULT false,

  -- AI risk score (0-100)
  ai_risk_score   INTEGER,
  ai_risk_flags   JSONB DEFAULT '[]',

  -- Content
  description     TEXT,
  brief           TEXT,
  special_notes   TEXT,
  cover_image_url TEXT,

  metadata        JSONB NOT NULL DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(tenant_id, event_date);
CREATE INDEX IF NOT EXISTS idx_events_manager ON events(manager_id);
CREATE INDEX IF NOT EXISTS idx_events_client ON events(client_id);
CREATE INDEX IF NOT EXISTS idx_events_search ON events USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ── EVENT PHASES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_phases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,           -- Planning, Production, Execution, Wrap
  order_index     INTEGER NOT NULL DEFAULT 0,
  start_date      DATE,
  end_date        DATE,
  is_completed    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phases_event ON event_phases(event_id);

-- ── EVENT TASKS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  phase_id        UUID REFERENCES event_phases(id),
  title           TEXT NOT NULL,
  description     TEXT,
  status          task_status NOT NULL DEFAULT 'todo',
  priority        task_priority NOT NULL DEFAULT 'medium',
  assigned_to     UUID REFERENCES profiles(id),
  due_date        DATE,
  due_time        TIME,
  estimated_hours NUMERIC(5,2),
  actual_hours    NUMERIC(5,2),
  parent_task_id  UUID REFERENCES event_tasks(id),  -- subtasks
  depends_on      UUID[],                           -- task IDs that must complete first
  tags            TEXT[] DEFAULT '{}',
  attachments     JSONB DEFAULT '[]',
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES profiles(id),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_event ON event_tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON event_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON event_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON event_tasks(event_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON event_tasks(due_date);

-- ── EVENT TIMELINE / RUNSHEET ─────────────────────────────────
CREATE TABLE IF NOT EXISTS event_runsheet (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  time_slot       TIME NOT NULL,
  duration_mins   INTEGER NOT NULL DEFAULT 15,
  title           TEXT NOT NULL,
  description     TEXT,
  responsible_id  UUID REFERENCES profiles(id),
  location        TEXT,                   -- specific area within venue
  vendor_id       UUID,                  -- FK added in vendors migration
  is_public       BOOLEAN DEFAULT false, -- show on guest-facing microsite
  status          TEXT DEFAULT 'pending', -- pending | in_progress | completed | delayed
  actual_start    TIME,
  delay_mins      INTEGER DEFAULT 0,
  notes           TEXT,
  order_index     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runsheet_event ON event_runsheet(event_id);

-- ── EVENT RISKS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_risks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,                   -- weather, vendor, technical, crowd, etc.
  level           risk_level NOT NULL DEFAULT 'medium',
  probability     INTEGER,               -- 1-5
  impact          INTEGER,               -- 1-5
  risk_score      INTEGER,               -- probability * impact
  mitigation      TEXT,
  contingency     TEXT,
  owner_id        UUID REFERENCES profiles(id),
  is_resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  ai_generated    BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risks_event ON event_risks(event_id);

-- ── EVENT ISSUES (live tracking) ─────────────────────────────
CREATE TABLE IF NOT EXISTS event_issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  severity        risk_level NOT NULL DEFAULT 'medium',
  reported_by     UUID REFERENCES profiles(id),
  assigned_to     UUID REFERENCES profiles(id),
  is_resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issues_event ON event_issues(event_id);
CREATE INDEX IF NOT EXISTS idx_issues_resolved ON event_issues(event_id, is_resolved);

-- ── EVENT DOCUMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT,                   -- contract, proposal, brief, report, etc.
  file_url        TEXT NOT NULL,          -- Cloudflare R2 URL
  file_size       INTEGER,               -- bytes
  mime_type       TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  is_client_visible BOOLEAN DEFAULT false,
  requires_signature BOOLEAN DEFAULT false,
  signed_at       TIMESTAMPTZ,
  signed_by       UUID REFERENCES profiles(id),
  uploaded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_event ON event_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_docs_type ON event_documents(tenant_id, type);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tasks_updated_at ON event_tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON event_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS runsheet_updated_at ON event_runsheet;
CREATE TRIGGER runsheet_updated_at BEFORE UPDATE ON event_runsheet FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS risks_updated_at ON event_risks;
CREATE TRIGGER risks_updated_at BEFORE UPDATE ON event_risks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS issues_updated_at ON event_issues;
CREATE TRIGGER issues_updated_at BEFORE UPDATE ON event_issues FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Migration: 004_crm_and_clients.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 004: CRM & Clients
-- ============================================================

-- ── CLIENT COMPANIES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  industry        TEXT,
  website         TEXT,
  logo_url        TEXT,
  address         JSONB DEFAULT '{}',
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,
  total_events    INTEGER DEFAULT 0,
  total_revenue   NUMERIC(14,2) DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_tenant ON client_companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_search ON client_companies USING gin(to_tsvector('english', name));

-- ── CONTACTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES client_companies(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES profiles(id),   -- if they have a portal account
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  designation     TEXT,
  avatar_url      TEXT,
  is_primary      BOOLEAN DEFAULT false,
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,
  last_contacted_at TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_search ON contacts USING gin(to_tsvector('english', full_name || ' ' || COALESCE(email, '')));

-- ── LEADS (Sales Pipeline) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id      UUID REFERENCES client_companies(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,                 -- "Sharma Wedding — Dec 2025"
  category        event_category,
  stage           lead_stage NOT NULL DEFAULT 'new',
  value           NUMERIC(14,2),                 -- estimated event value
  currency        TEXT NOT NULL DEFAULT 'INR',
  probability     INTEGER DEFAULT 50,            -- % chance of winning
  expected_close  DATE,
  event_date      DATE,
  source          TEXT,                          -- referral | website | social | cold | etc.
  owner_id        UUID REFERENCES profiles(id),  -- sales rep
  last_activity_at TIMESTAMPTZ,
  won_at          TIMESTAMPTZ,
  lost_at         TIMESTAMPTZ,
  lost_reason     TEXT,
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_close ON leads(expected_close);

-- ── LEAD ACTIVITIES (CRM timeline) ──────────────────────────
CREATE TABLE IF NOT EXISTS lead_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,          -- call | email | meeting | note | stage_change
  title           TEXT,
  body            TEXT,
  performed_by    UUID REFERENCES profiles(id),
  scheduled_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant ON lead_activities(tenant_id);

-- ── PROPOSALS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id),
  title           TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'draft',  -- draft | sent | viewed | accepted | declined
  valid_until     DATE,
  total_amount    NUMERIC(14,2),
  currency        TEXT NOT NULL DEFAULT 'INR',
  notes           TEXT,
  terms           TEXT,
  file_url        TEXT,                   -- generated PDF (Cloudflare R2)
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  declined_at     TIMESTAMPTZ,
  decline_reason  TEXT,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_tenant ON proposals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposals_event ON proposals(event_id);

-- ── PROPOSAL LINE ITEMS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposal_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  category        TEXT,                   -- Venue | Catering | Decor | Entertainment | etc.
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price      NUMERIC(12,2) NOT NULL,
  discount_pct    NUMERIC(5,2) DEFAULT 0,
  tax_pct         NUMERIC(5,2) DEFAULT 18,  -- GST default 18%
  total           NUMERIC(14,2),
  is_optional     BOOLEAN DEFAULT false,
  order_index     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pli_proposal ON proposal_line_items(proposal_id);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS cc_updated_at ON client_companies;
CREATE TRIGGER cc_updated_at BEFORE UPDATE ON client_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS proposals_updated_at ON proposals;
CREATE TRIGGER proposals_updated_at BEFORE UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Migration: 005_finance.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 005: Finance
-- ============================================================

-- ── BUDGETS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'Main Budget',
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'INR',
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  is_locked       BOOLEAN DEFAULT false,        -- locked after client approval
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budgets_event ON budgets(event_id);
CREATE INDEX IF NOT EXISTS idx_budgets_tenant ON budgets(tenant_id);

-- ── BUDGET LINE ITEMS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id       UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,          -- Venue | Catering | Decor | AV | Entertainment | etc.
  subcategory     TEXT,
  description     TEXT NOT NULL,
  estimated_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_amount   NUMERIC(14,2) DEFAULT 0,
  variance        NUMERIC(14,2) GENERATED ALWAYS AS (actual_amount - estimated_amount) STORED,
  vendor_id       UUID,                  -- FK added in vendors migration
  is_paid         BOOLEAN DEFAULT false,
  notes           TEXT,
  order_index     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bli_budget ON budget_line_items(budget_id);
CREATE INDEX IF NOT EXISTS idx_bli_tenant ON budget_line_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bli_category ON budget_line_items(tenant_id, category);

-- ── INVOICES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id      UUID REFERENCES client_companies(id) ON DELETE SET NULL,
  invoice_number  TEXT NOT NULL,
  status          invoice_status NOT NULL DEFAULT 'draft',
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  currency        TEXT NOT NULL DEFAULT 'INR',
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance_due     NUMERIC(14,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  notes           TEXT,
  terms           TEXT,
  file_url        TEXT,                   -- PDF stored in Cloudflare R2
  razorpay_payment_link_id TEXT,
  razorpay_payment_link_url TEXT,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  overdue_reminder_sent_at TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_event ON invoices(event_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date);

-- ── INVOICE LINE ITEMS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price      NUMERIC(12,2) NOT NULL,
  discount_pct    NUMERIC(5,2) DEFAULT 0,
  tax_pct         NUMERIC(5,2) DEFAULT 18,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  order_index     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ili_invoice ON invoice_line_items(invoice_id);

-- ── PAYMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id      UUID REFERENCES invoices(id) ON DELETE SET NULL,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  amount          NUMERIC(14,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'INR',
  status          payment_status NOT NULL DEFAULT 'pending',
  payment_method  TEXT,                   -- card | upi | netbanking | wallet | etc.
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  paid_by         UUID REFERENCES profiles(id),
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  refund_amount   NUMERIC(14,2) DEFAULT 0,
  refunded_at     TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(tenant_id, status);

-- ── EXPENSES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  budget_line_item_id UUID REFERENCES budget_line_items(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'INR',
  category        TEXT,
  vendor_id       UUID,                   -- FK added in vendors migration
  receipt_url     TEXT,                   -- Cloudflare R2
  paid_by         UUID REFERENCES profiles(id),
  payment_method  TEXT,
  is_reimbursable BOOLEAN DEFAULT false,
  is_reimbursed   BOOLEAN DEFAULT false,
  reimbursed_at   TIMESTAMPTZ,
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_event ON expenses(event_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- ── VENDOR PAYOUTS (Razorpay Route) ──────────────────────────
CREATE TABLE IF NOT EXISTS vendor_payouts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id             UUID,                 -- FK added in vendors migration
  event_id              UUID REFERENCES events(id) ON DELETE SET NULL,
  amount                NUMERIC(14,2) NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'INR',
  razorpay_payout_id    TEXT UNIQUE,
  razorpay_fund_account_id TEXT,
  status                payment_status NOT NULL DEFAULT 'pending',
  paid_at               TIMESTAMPTZ,
  notes                 TEXT,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_tenant ON vendor_payouts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payouts_vendor ON vendor_payouts(vendor_id);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS budgets_updated_at ON budgets;
CREATE TRIGGER budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS bli_updated_at ON budget_line_items;
CREATE TRIGGER bli_updated_at BEFORE UPDATE ON budget_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS expenses_updated_at ON expenses;
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS payouts_updated_at ON vendor_payouts;
CREATE TRIGGER payouts_updated_at BEFORE UPDATE ON vendor_payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Migration: 006_venues_and_floorplans.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 006: Venues & Floor Plan Builder
-- ============================================================

-- ── VENUES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT,                   -- hotel | banquet | outdoor | stadium | convention | etc.
  address         JSONB NOT NULL DEFAULT '{}',
  city            TEXT,
  state           TEXT,
  country         TEXT DEFAULT 'IN',
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),
  capacity_min    INTEGER,
  capacity_max    INTEGER,
  area_sqft       INTEGER,
  floors          INTEGER DEFAULT 1,
  parking_capacity INTEGER,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  website         TEXT,
  images          TEXT[] DEFAULT '{}',   -- Cloudflare R2 URLs
  amenities       TEXT[] DEFAULT '{}',
  restrictions    TEXT[] DEFAULT '{}',   -- no alcohol | noise curfew 10pm | etc.
  pricing_notes   TEXT,
  average_cost    NUMERIC(12,2),
  rating          NUMERIC(3,2),          -- 1.00–5.00
  review_count    INTEGER DEFAULT 0,
  is_preferred    BOOLEAN DEFAULT false,
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venues_tenant ON venues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(tenant_id, city);
CREATE INDEX IF NOT EXISTS idx_venues_search ON venues USING gin(to_tsvector('english', name || ' ' || COALESCE(city, '')));

-- Add FK from events to venues
DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT fk_events_venue FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── VENUE BOOKINGS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venue_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  venue_id        UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  booking_date    DATE NOT NULL,
  setup_date      DATE,
  breakdown_date  DATE,
  start_time      TIME,
  end_time        TIME,
  status          TEXT NOT NULL DEFAULT 'tentative',  -- tentative | confirmed | cancelled
  quoted_amount   NUMERIC(14,2),
  paid_amount     NUMERIC(14,2) DEFAULT 0,
  contract_url    TEXT,                   -- Cloudflare R2
  notes           TEXT,
  confirmed_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vb_venue ON venue_bookings(venue_id);
CREATE INDEX IF NOT EXISTS idx_vb_event ON venue_bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_vb_date ON venue_bookings(booking_date);

-- ── FLOOR PLANS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS floor_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  venue_id        UUID REFERENCES venues(id) ON DELETE SET NULL,
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'Main Floor',
  floor_level     INTEGER DEFAULT 0,       -- 0 = ground, 1 = first floor, etc.
  width_units     NUMERIC(10,2),           -- in meters
  height_units    NUMERIC(10,2),           -- in meters
  background_url  TEXT,                    -- uploaded venue blueprint (R2)
  thumbnail_url   TEXT,                    -- generated preview (R2)
  is_published    BOOLEAN DEFAULT false,   -- visible to client
  version         INTEGER DEFAULT 1,
  canvas_data     JSONB NOT NULL DEFAULT '{}',  -- full canvas state (Konva/Fabric)
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fp_event ON floor_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_fp_venue ON floor_plans(venue_id);
CREATE INDEX IF NOT EXISTS idx_fp_tenant ON floor_plans(tenant_id);

-- ── FLOOR PLAN ZONES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS floor_plan_zones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id   UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  zone_type       zone_type NOT NULL DEFAULT 'general',
  color           TEXT DEFAULT '#E5E7EB',
  -- Position on canvas (in units)
  x               NUMERIC(10,2) NOT NULL DEFAULT 0,
  y               NUMERIC(10,2) NOT NULL DEFAULT 0,
  width           NUMERIC(10,2) NOT NULL DEFAULT 100,
  height          NUMERIC(10,2) NOT NULL DEFAULT 100,
  capacity        INTEGER,
  is_restricted   BOOLEAN DEFAULT false,  -- requires special QR access
  access_categories TEXT[] DEFAULT '{}',  -- VIP | speaker | media | etc.
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fpz_floorplan ON floor_plan_zones(floor_plan_id);

-- ── FLOOR PLAN ELEMENTS (tables, chairs, booths, etc.) ───────
CREATE TABLE IF NOT EXISTS floor_plan_elements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id   UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
  zone_id         UUID REFERENCES floor_plan_zones(id) ON DELETE SET NULL,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  element_type    TEXT NOT NULL,          -- table | chair | stage | booth | podium | sofa | etc.
  label           TEXT,                   -- Table 1, Booth A3, etc.
  x               NUMERIC(10,2) NOT NULL DEFAULT 0,
  y               NUMERIC(10,2) NOT NULL DEFAULT 0,
  width           NUMERIC(10,2),
  height          NUMERIC(10,2),
  rotation        NUMERIC(6,2) DEFAULT 0,
  capacity        INTEGER,               -- seats at this table
  vendor_id       UUID,                  -- FK vendors migration (for booth assignments)
  is_reserved     BOOLEAN DEFAULT false,
  assigned_to     TEXT,                   -- name/label for reserved items
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fpe_floorplan ON floor_plan_elements(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_fpe_zone ON floor_plan_elements(zone_id);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS venues_updated_at ON venues;
CREATE TRIGGER venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS vb_updated_at ON venue_bookings;
CREATE TRIGGER vb_updated_at BEFORE UPDATE ON venue_bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS fp_updated_at ON floor_plans;
CREATE TRIGGER fp_updated_at BEFORE UPDATE ON floor_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS fpz_updated_at ON floor_plan_zones;
CREATE TRIGGER fpz_updated_at BEFORE UPDATE ON floor_plan_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS fpe_updated_at ON floor_plan_elements;
CREATE TRIGGER fpe_updated_at BEFORE UPDATE ON floor_plan_elements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ============================================================
-- Migration: 007_vendors.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 007: Vendors
-- ============================================================

-- ── VENDOR CATEGORIES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,          -- Catering | AV | Decor | Photography | Artist | etc.
  icon            TEXT,
  parent_id       UUID REFERENCES vendor_categories(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── VENDORS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id),  -- if they have vendor portal access
  category_id     UUID REFERENCES vendor_categories(id),
  name            TEXT NOT NULL,
  contact_name    TEXT,
  email           TEXT,
  phone           TEXT,
  website         TEXT,
  address         JSONB DEFAULT '{}',
  city            TEXT,
  state           TEXT,
  country         TEXT DEFAULT 'IN',
  gstin           TEXT,                   -- GST number (India)
  pan             TEXT,                   -- PAN number (India)
  bank_details    JSONB DEFAULT '{}',     -- encrypted bank info for Razorpay Route
  razorpay_fund_account_id TEXT,          -- Razorpay Route fund account
  is_verified     BOOLEAN DEFAULT false,
  is_preferred    BOOLEAN DEFAULT false,
  is_blacklisted  BOOLEAN DEFAULT false,
  blacklist_reason TEXT,
  rating          NUMERIC(3,2),
  review_count    INTEGER DEFAULT 0,
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,
  portfolio_urls  TEXT[] DEFAULT '{}',
  specializations TEXT[] DEFAULT '{}',
  -- Artist specific
  is_artist       BOOLEAN DEFAULT false,
  artist_type     TEXT,                   -- DJ | Band | Singer | Comedian | Anchor | etc.
  rider_requirements TEXT,               -- technical/hospitality rider
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category_id);
CREATE INDEX IF NOT EXISTS idx_vendors_city ON vendors(tenant_id, city);
CREATE INDEX IF NOT EXISTS idx_vendors_artist ON vendors(tenant_id, is_artist);
CREATE INDEX IF NOT EXISTS idx_vendors_search ON vendors USING gin(to_tsvector('english', name || ' ' || COALESCE(contact_name, '')));

-- Add FK from floor_plan_elements to vendors
DO $$ BEGIN
  ALTER TABLE floor_plan_elements ADD CONSTRAINT fk_fpe_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE budget_line_items ADD CONSTRAINT fk_bli_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE expenses ADD CONSTRAINT fk_expenses_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE vendor_payouts ADD CONSTRAINT fk_payouts_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE event_runsheet ADD CONSTRAINT fk_runsheet_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── EVENT VENDOR ASSIGNMENTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS event_vendor_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category        TEXT,
  role            TEXT,                   -- primary | secondary | backup
  quoted_amount   NUMERIC(14,2),
  agreed_amount   NUMERIC(14,2),
  currency        TEXT DEFAULT 'INR',
  status          TEXT NOT NULL DEFAULT 'shortlisted',  -- shortlisted | briefed | contracted | active | completed | cancelled
  briefed_at      TIMESTAMPTZ,
  contracted_at   TIMESTAMPTZ,
  arrival_time    TIME,
  departure_time  TIME,
  requirements    TEXT,
  notes           TEXT,
  performance_score INTEGER,            -- 1-5 post-event rating
  performance_notes TEXT,
  metadata        JSONB DEFAULT '{}',
  assigned_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_eva_event ON event_vendor_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_eva_vendor ON event_vendor_assignments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_eva_tenant ON event_vendor_assignments(tenant_id);

-- ── VENDOR CONTRACTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  assignment_id   UUID REFERENCES event_vendor_assignments(id),
  title           TEXT NOT NULL,
  status          contract_status NOT NULL DEFAULT 'draft',
  amount          NUMERIC(14,2),
  currency        TEXT DEFAULT 'INR',
  start_date      DATE,
  end_date        DATE,
  file_url        TEXT,                   -- Cloudflare R2 (PDF)
  signed_by_vendor_at TIMESTAMPTZ,
  signed_by_company_at TIMESTAMPTZ,
  vendor_signature_url TEXT,
  company_signature_url TEXT,
  terms           TEXT,
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vc_vendor ON vendor_contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vc_event ON vendor_contracts(event_id);

-- ── VENDOR COMMUNICATIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_communications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  sender_id       UUID REFERENCES profiles(id),
  type            TEXT NOT NULL DEFAULT 'message',  -- message | brief | update | alert
  subject         TEXT,
  body            TEXT NOT NULL,
  attachments     TEXT[] DEFAULT '{}',
  is_read         BOOLEAN DEFAULT false,
  read_at         TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vcomm_vendor ON vendor_communications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vcomm_event ON vendor_communications(event_id);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS vendors_updated_at ON vendors;
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS eva_updated_at ON event_vendor_assignments;
CREATE TRIGGER eva_updated_at BEFORE UPDATE ON event_vendor_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS vp_updated_at ON vendor_payouts;
CREATE TRIGGER vp_updated_at BEFORE UPDATE ON vendor_payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS vc_updated_at ON vendor_communications;
CREATE TRIGGER vc_updated_at BEFORE UPDATE ON vendor_communications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Migration: 008_guests_and_checkin.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 008: Guests, Check-in & Badges
-- ============================================================

-- ── GUEST CATEGORIES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,          -- VIP | General | Media | Speaker | Staff | Vendor
  color           TEXT DEFAULT '#1D4ED8',
  badge_color     TEXT DEFAULT '#FFFFFF',
  access_zones    TEXT[] DEFAULT '{}',    -- zone IDs from floor_plan_zones
  max_capacity    INTEGER,
  is_default      BOOLEAN DEFAULT false,
  priority        INTEGER DEFAULT 0,      -- higher = more access
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gc_event ON guest_categories(event_id);
CREATE INDEX IF NOT EXISTS idx_gc_tenant ON guest_categories(tenant_id);

-- ── GUESTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES guest_categories(id) ON DELETE SET NULL,
  -- Identity
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  company         TEXT,
  designation     TEXT,
  avatar_url      TEXT,
  -- RSVP
  rsvp_status     rsvp_status NOT NULL DEFAULT 'pending',
  rsvp_at         TIMESTAMPTZ,
  rsvp_token      TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  -- Plus one
  plus_one_allowed BOOLEAN DEFAULT false,
  plus_one_name   TEXT,
  plus_one_email  TEXT,
  -- Dietary & Accessibility
  dietary_requirements TEXT[] DEFAULT '{}',
  accessibility_needs TEXT,
  -- Table Assignment
  table_element_id UUID REFERENCES floor_plan_elements(id) ON DELETE SET NULL,
  seat_number     TEXT,
  -- QR Check-in
  qr_code         TEXT UNIQUE DEFAULT encode(gen_random_bytes(20), 'hex'),
  qr_code_url     TEXT,                   -- Cloudflare R2 (pre-rendered QR image)
  -- Ticket (for ticketed events)
  ticket_id       UUID,                   -- FK added in microsites migration
  -- Wallet passes
  apple_wallet_pass_url TEXT,
  google_wallet_pass_url TEXT,
  -- Metadata
  is_walk_in      BOOLEAN DEFAULT false,
  source          TEXT,                   -- imported | microsite | manual | api
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  invited_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guests_event ON guests(event_id);
CREATE INDEX IF NOT EXISTS idx_guests_tenant ON guests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guests_category ON guests(category_id);
CREATE INDEX IF NOT EXISTS idx_guests_qr ON guests(qr_code);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_guests_rsvp ON guests(event_id, rsvp_status);
CREATE INDEX IF NOT EXISTS idx_guests_search ON guests USING gin(to_tsvector('english', full_name || ' ' || COALESCE(email, '') || ' ' || COALESCE(company, '')));

-- ── CHECK-IN ZONES ───────────────────────────────────────────
-- Defines active check-in points for an event
CREATE TABLE IF NOT EXISTS checkin_zones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  floor_zone_id   UUID REFERENCES floor_plan_zones(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,          -- Main Entrance | VIP Gate | Hall B etc.
  allowed_categories TEXT[] DEFAULT '{}', -- empty = all categories allowed
  is_active       BOOLEAN DEFAULT true,
  kiosk_mode      BOOLEAN DEFAULT false,  -- is this zone running in kiosk mode?
  current_count   INTEGER DEFAULT 0,      -- real-time count (updated via DO)
  max_capacity    INTEGER,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cz_event ON checkin_zones(event_id);

-- ── CHECK-IN LOG ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkin_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id        UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  zone_id         UUID REFERENCES checkin_zones(id) ON DELETE SET NULL,
  status          checkin_status NOT NULL DEFAULT 'checked_in',
  scanned_by      UUID REFERENCES profiles(id),  -- NULL if self-service kiosk
  is_kiosk_scan   BOOLEAN DEFAULT false,
  device_id       TEXT,                   -- kiosk device identifier
  ip_address      INET,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cl_event ON checkin_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_cl_guest ON checkin_logs(guest_id);
CREATE INDEX IF NOT EXISTS idx_cl_zone ON checkin_logs(zone_id);
CREATE INDEX IF NOT EXISTS idx_cl_created ON checkin_logs(created_at DESC);

-- ── BADGE TEMPLATES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badge_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES guest_categories(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  -- Badge dimensions
  width_mm        INTEGER NOT NULL DEFAULT 90,
  height_mm       INTEGER NOT NULL DEFAULT 54,
  -- Design JSON (field positions, styles)
  design_data     JSONB NOT NULL DEFAULT '{}',
  background_color TEXT DEFAULT '#FFFFFF',
  background_image_url TEXT,
  -- Fields to show
  show_name       BOOLEAN DEFAULT true,
  show_company    BOOLEAN DEFAULT true,
  show_designation BOOLEAN DEFAULT true,
  show_category   BOOLEAN DEFAULT true,
  show_qr         BOOLEAN DEFAULT true,
  show_logo       BOOLEAN DEFAULT true,
  show_event_name BOOLEAN DEFAULT true,
  -- Printer config
  printer_type    TEXT DEFAULT 'standard',  -- standard | zebra | brother
  is_default      BOOLEAN DEFAULT false,
  thumbnail_url   TEXT,                   -- Cloudflare R2 preview
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bt_event ON badge_templates(event_id);
CREATE INDEX IF NOT EXISTS idx_bt_tenant ON badge_templates(tenant_id);

-- ── BADGE PRINT QUEUE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badge_print_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id        UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES badge_templates(id),
  zone_id         UUID REFERENCES checkin_zones(id),
  status          TEXT NOT NULL DEFAULT 'queued',  -- queued | printing | printed | failed | reprinted
  triggered_by    TEXT NOT NULL DEFAULT 'checkin', -- checkin | manual | bulk | kiosk
  printer_id      TEXT,
  printed_at      TIMESTAMPTZ,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bpq_event ON badge_print_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_bpq_guest ON badge_print_queue(guest_id);
CREATE INDEX IF NOT EXISTS idx_bpq_status ON badge_print_queue(event_id, status);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS guests_updated_at ON guests;
CREATE TRIGGER guests_updated_at BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS cz_updated_at ON checkin_zones;
CREATE TRIGGER cz_updated_at BEFORE UPDATE ON checkin_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS bt_updated_at ON badge_templates;
CREATE TRIGGER bt_updated_at BEFORE UPDATE ON badge_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Migration: 009_inventory.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 009: Inventory & Warehouse
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  parent_id       UUID REFERENCES inventory_categories(id),
  icon            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES inventory_categories(id),
  name            TEXT NOT NULL,
  sku             TEXT,
  barcode         TEXT,
  qr_code         TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  description     TEXT,
  unit            TEXT DEFAULT 'piece',  -- piece | set | kg | meter | etc.
  quantity_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity_available NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity_in_use NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity_damaged NUMERIC(12,2) NOT NULL DEFAULT 0,
  reorder_level   NUMERIC(12,2) DEFAULT 0,
  unit_cost       NUMERIC(12,2),
  replacement_cost NUMERIC(12,2),
  storage_location TEXT,
  storage_notes   TEXT,
  images          TEXT[] DEFAULT '{}',
  tags            TEXT[] DEFAULT '{}',
  is_rentable     BOOLEAN DEFAULT false,
  rental_rate_per_day NUMERIC(10,2),
  last_maintenance_at DATE,
  next_maintenance_at DATE,
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_tenant ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inv_qr ON inventory_items(qr_code);
CREATE INDEX IF NOT EXISTS idx_inv_search ON inventory_items USING gin(to_tsvector('english', name));

-- ── INVENTORY TRANSACTIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  type            inventory_tx_type NOT NULL,
  quantity        NUMERIC(12,2) NOT NULL,
  notes           TEXT,
  performed_by    UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_tx_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_event ON inventory_transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_tenant ON inventory_transactions(tenant_id);

-- ── EVENT INVENTORY ALLOCATIONS ──────────────────────────────
CREATE TABLE IF NOT EXISTS event_inventory_allocations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_allocated NUMERIC(12,2) NOT NULL,
  quantity_returned  NUMERIC(12,2) DEFAULT 0,
  quantity_damaged   NUMERIC(12,2) DEFAULT 0,
  allocated_at    TIMESTAMPTZ,
  returned_at     TIMESTAMPTZ,
  notes           TEXT,
  allocated_by    UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eia_event ON event_inventory_allocations(event_id);
CREATE INDEX IF NOT EXISTS idx_eia_item ON event_inventory_allocations(item_id);

DROP TRIGGER IF EXISTS inv_updated_at ON inventory_items;
CREATE TRIGGER inv_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS eia_updated_at ON event_inventory_allocations;
CREATE TRIGGER eia_updated_at BEFORE UPDATE ON event_inventory_allocations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Migration: 010_microsites_and_ticketing.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 010: Event Microsites & Ticketing
-- ============================================================

-- ── MICROSITES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS microsites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  status          microsite_status NOT NULL DEFAULT 'draft',
  -- Domain
  subdomain       TEXT,                   -- e.g. "gala2025" → gala2025.occasionpro.in
  custom_domain   TEXT,                   -- e.g. tickets.clientbrand.com
  -- Content
  title           TEXT NOT NULL,
  tagline         TEXT,
  description     TEXT,
  hero_image_url  TEXT,
  hero_video_url  TEXT,
  -- SEO
  meta_title      TEXT,
  meta_description TEXT,
  og_image_url    TEXT,
  -- Branding
  primary_color   TEXT DEFAULT '#1D4ED8',
  accent_color    TEXT DEFAULT '#06B6D4',
  logo_url        TEXT,
  -- Features
  show_schedule   BOOLEAN DEFAULT true,
  show_speakers   BOOLEAN DEFAULT true,
  show_sponsors   BOOLEAN DEFAULT false,
  show_gallery    BOOLEAN DEFAULT false,
  show_map        BOOLEAN DEFAULT true,
  show_countdown  BOOLEAN DEFAULT true,
  enable_ticketing BOOLEAN DEFAULT false,  -- main ticketing toggle
  enable_rsvp     BOOLEAN DEFAULT false,   -- free RSVP mode
  require_approval BOOLEAN DEFAULT false,  -- manual guest approval
  -- Analytics
  page_views      INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  -- Publishing
  published_at    TIMESTAMPTZ,
  unpublished_at  TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ms_event ON microsites(event_id);
CREATE INDEX IF NOT EXISTS idx_ms_tenant ON microsites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ms_subdomain ON microsites(subdomain);
CREATE INDEX IF NOT EXISTS idx_ms_domain ON microsites(custom_domain);

-- ── TICKET TIERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_tiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  microsite_id    UUID NOT NULL REFERENCES microsites(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,          -- Early Bird | General | VIP | Table | Group
  description     TEXT,
  price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'INR',
  quantity_total  INTEGER,               -- NULL = unlimited
  quantity_sold   INTEGER NOT NULL DEFAULT 0,
  quantity_available INTEGER GENERATED ALWAYS AS (
    CASE WHEN quantity_total IS NULL THEN 999999 ELSE quantity_total - quantity_sold END
  ) STORED,
  -- Sale window
  sale_starts_at  TIMESTAMPTZ,
  sale_ends_at    TIMESTAMPTZ,
  -- Guest category link
  category_id     UUID REFERENCES guest_categories(id),
  -- Perks
  includes        TEXT[] DEFAULT '{}',   -- list of inclusions
  -- Promo
  promo_codes     JSONB DEFAULT '[]',    -- [{code, discount_type, discount_value, usage_limit, used_count}]
  -- Transfer/refund
  is_transferable BOOLEAN DEFAULT true,
  is_refundable   BOOLEAN DEFAULT true,
  refund_cutoff_hours INTEGER DEFAULT 24,
  is_active       BOOLEAN DEFAULT true,
  order_index     INTEGER DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tt_microsite ON ticket_tiers(microsite_id);
CREATE INDEX IF NOT EXISTS idx_tt_event ON ticket_tiers(event_id);

-- ── TICKET PURCHASES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  microsite_id    UUID NOT NULL REFERENCES microsites(id) ON DELETE CASCADE,
  tier_id         UUID NOT NULL REFERENCES ticket_tiers(id),
  -- Buyer
  buyer_name      TEXT NOT NULL,
  buyer_email     TEXT NOT NULL,
  buyer_phone     TEXT,
  -- Quantity
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      NUMERIC(12,2) NOT NULL,
  promo_code      TEXT,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  tax_amount      NUMERIC(12,2) DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'INR',
  -- Payment
  payment_id      UUID REFERENCES payments(id) ON DELETE SET NULL,
  razorpay_order_id TEXT,
  -- Status
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | cancelled | refunded
  confirmed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  refunded_at     TIMESTAMPTZ,
  refund_amount   NUMERIC(12,2) DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_event ON ticket_purchases(event_id);
CREATE INDEX IF NOT EXISTS idx_tp_tier ON ticket_purchases(tier_id);
CREATE INDEX IF NOT EXISTS idx_tp_buyer ON ticket_purchases(buyer_email);
CREATE INDEX IF NOT EXISTS idx_tp_status ON ticket_purchases(tenant_id, status);

-- ── TICKETS (individual tickets from a purchase) ─────────────
CREATE TABLE IF NOT EXISTS tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_id     UUID NOT NULL REFERENCES ticket_purchases(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tier_id         UUID NOT NULL REFERENCES ticket_tiers(id),
  guest_id        UUID REFERENCES guests(id) ON DELETE SET NULL,
  ticket_number   TEXT NOT NULL UNIQUE DEFAULT 'OP-' || upper(substring(encode(gen_random_bytes(4),'hex'), 1, 8)),
  holder_name     TEXT,
  holder_email    TEXT,
  qr_code         TEXT UNIQUE DEFAULT encode(gen_random_bytes(20), 'hex'),
  qr_code_url     TEXT,
  status          ticket_status NOT NULL DEFAULT 'active',
  -- Apple/Google Wallet
  apple_wallet_pass_url TEXT,
  google_wallet_pass_url TEXT,
  -- Transfer
  transferred_to  TEXT,
  transferred_at  TIMESTAMPTZ,
  -- Use
  used_at         TIMESTAMPTZ,
  used_at_zone_id UUID REFERENCES checkin_zones(id),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_purchase ON tickets(purchase_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr ON tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(event_id, status);

-- Add FK from guests to tickets
DO $$ BEGIN
  ALTER TABLE guests ADD CONSTRAINT fk_guests_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── MICROSITE CONTENT BLOCKS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS microsite_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  microsite_id    UUID NOT NULL REFERENCES microsites(id) ON DELETE CASCADE,
  block_type      TEXT NOT NULL,          -- schedule | speakers | sponsors | gallery | faq | custom
  title           TEXT,
  content         JSONB NOT NULL DEFAULT '{}',
  is_visible      BOOLEAN DEFAULT true,
  order_index     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mc_microsite ON microsite_content(microsite_id);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS ms_updated_at ON microsites;
CREATE TRIGGER ms_updated_at BEFORE UPDATE ON microsites FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tt_updated_at ON ticket_tiers;
CREATE TRIGGER tt_updated_at BEFORE UPDATE ON ticket_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tp_updated_at ON ticket_purchases;
CREATE TRIGGER tp_updated_at BEFORE UPDATE ON ticket_purchases FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tickets_updated_at ON tickets;
DROP TRIGGER IF EXISTS tickets_updated_at ON tickets;
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS mc_updated_at ON microsite_content;
CREATE TRIGGER mc_updated_at BEFORE UPDATE ON microsite_content FOR EACH ROW EXECUTE FUNCTION update_updated_at();

