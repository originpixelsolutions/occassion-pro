-- ==========================================
-- Migration: 001_extensions_and_types.sql
-- ==========================================
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


-- ==========================================
-- Migration: 002_tenants_and_users.sql
-- ==========================================
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


-- ==========================================
-- Migration: 003_events.sql
-- ==========================================
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


-- ==========================================
-- Migration: 004_crm_and_clients.sql
-- ==========================================
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


-- ==========================================
-- Migration: 005_finance.sql
-- ==========================================
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


-- ==========================================
-- Migration: 006_venues_and_floorplans.sql
-- ==========================================
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

-- ==========================================
-- Migration: 007_vendors.sql
-- ==========================================
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


-- ==========================================
-- Migration: 008_guests_and_checkin.sql
-- ==========================================
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


-- ==========================================
-- Migration: 009_inventory.sql
-- ==========================================
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


-- ==========================================
-- Migration: 010_microsites_and_ticketing.sql
-- ==========================================
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


-- ==========================================
-- Migration: 011_ai_and_platform.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 011: AI Tracking & Platform Tables
-- ============================================================

-- ── AI GENERATIONS (log every AI output) ─────────────────────
CREATE TABLE IF NOT EXISTS ai_generations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type            ai_gen_type NOT NULL,
  model           TEXT NOT NULL,          -- gpt-4o | claude-3-5-sonnet | gemini-1.5-pro | etc.
  prompt_tokens   INTEGER,
  completion_tokens INTEGER,
  total_tokens    INTEGER,
  latency_ms      INTEGER,
  resource_type   TEXT,                   -- events | leads | guests | etc.
  resource_id     UUID,
  prompt          TEXT,
  output          TEXT,
  was_accepted    BOOLEAN,                -- did user accept/use this output?
  feedback        TEXT,
  cost_usd        NUMERIC(10,6),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_tenant ON ai_generations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_user ON ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_type ON ai_generations(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_ai_created ON ai_generations(created_at DESC);

-- ── AI USAGE QUOTAS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_monthly (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month           DATE NOT NULL,           -- first day of month
  total_tokens    BIGINT DEFAULT 0,
  total_cost_usd  NUMERIC(12,6) DEFAULT 0,
  generation_count INTEGER DEFAULT 0,
  quota_limit     BIGINT,                  -- monthly token limit per plan
  is_limit_hit    BOOLEAN DEFAULT false,
  UNIQUE(tenant_id, month)
);

CREATE INDEX IF NOT EXISTS idx_aiu_tenant ON ai_usage_monthly(tenant_id);

-- ── TEAM SHIFTS & ASSIGNMENTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS team_shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_label      TEXT,                   -- e.g. "Stage Manager", "Registration Desk"
  shift_start     TIMESTAMPTZ NOT NULL,
  shift_end       TIMESTAMPTZ NOT NULL,
  location        TEXT,
  is_confirmed    BOOLEAN DEFAULT false,
  confirmed_at    TIMESTAMPTZ,
  checked_in_at   TIMESTAMPTZ,
  checked_out_at  TIMESTAMPTZ,
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_event ON team_shifts(event_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON team_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_start ON team_shifts(shift_start);

-- ── COMMENTS / ACTIVITY FEED ─────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type   TEXT NOT NULL,          -- events | tasks | leads | invoices | vendors | guests
  resource_id     UUID NOT NULL,
  author_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  attachments     TEXT[] DEFAULT '{}',
  mentions        UUID[] DEFAULT '{}',    -- user IDs mentioned
  parent_id       UUID REFERENCES comments(id), -- replies
  is_edited       BOOLEAN DEFAULT false,
  edited_at       TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_resource ON comments(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_comments_tenant ON comments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);

-- ── WEBHOOKS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  secret          TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events          TEXT[] NOT NULL DEFAULT '{}',  -- event types to trigger on
  is_active       BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  failure_count   INTEGER DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);

-- ── WEBHOOK DELIVERY LOG ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  webhook_id      UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         JSONB DEFAULT '{}',
  status_code     INTEGER,
  response_body   TEXT,
  duration_ms     INTEGER,
  is_success      BOOLEAN,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','retrying')),
  attempt_count   INTEGER DEFAULT 0,
  retry_count     INTEGER DEFAULT 0,
  next_retry_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wd_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_wd_created ON webhook_deliveries(created_at DESC);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS shifts_updated_at ON team_shifts;
CREATE TRIGGER shifts_updated_a

-- ==========================================
-- Migration: 012_rls_policies.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 012: Row Level Security Policies
-- ============================================================
-- Every table is locked down by tenant_id.
-- Users can only access data belonging to their tenant.
-- Super admins bypass RLS via service role key (server-side only).
-- ============================================================

-- ── ENABLE RLS ON ALL TABLES ─────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_runsheet ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_vendor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_print_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_inventory_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsites ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsite_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- ── HELPER FUNCTION: get current user's tenant ───────────────
CREATE OR REPLACE FUNCTION current_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── HELPER FUNCTION: get current user's role ─────────────────
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM user_roles
  WHERE user_id = auth.uid()
    AND tenant_id = current_user_tenant_id()
    AND is_active = true
  LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── HELPER FUNCTION: check if super admin ───────────────────
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT is_super_admin FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── HELPER FUNCTION: tenant isolation check ─────────────────
-- Reusable predicate: does a table row belong to current user's tenant?
CREATE OR REPLACE FUNCTION belongs_to_tenant(row_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT row_tenant_id = current_user_tenant_id() OR is_super_admin()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── PROFILES POLICY ──────────────────────────────────────────
-- Users can read their own profile; tenant members can see each other
DO $$ BEGIN
  CREATE POLICY "Users can read their own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── STANDARD TENANT ISOLATION MACRO ─────────────────────────
-- For each table with tenant_id: SELECT/INSERT/UPDATE/DELETE limited to own tenant
-- Applying to all major tables:

-- EVENTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - events" ON events FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- EVENT TASKS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - tasks" ON event_tasks FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- EVENT RUNSHEET
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - runsheet" ON event_runsheet FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- BUDGETS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - budgets" ON budgets FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- BUDGET LINE ITEMS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - budget_line_items" ON budget_line_items FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INVOICES
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - invoices" ON invoices FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PAYMENTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - payments" ON payments FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- EXPENSES
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - expenses" ON expenses FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- VENDOR PAYOUTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - vendor_payouts" ON vendor_payouts FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CONTACTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - contacts" ON contacts FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- LEADS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - leads" ON leads FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- VENUES
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - venues" ON venues FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FLOOR PLANS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - floor_plans" ON floor_plans FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FLOOR PLAN ZONES
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - floor_plan_zones" ON floor_plan_zones FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FLOOR PLAN ELEMENTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - floor_plan_elements" ON floor_plan_elements FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- VENDORS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - vendors" ON vendors FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- VENDOR CONTRACTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - vendor_contracts" ON vendor_contracts FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- GUESTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - guests" ON guests FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CHECKIN LOGS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - checkin_logs" ON checkin_logs FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INVENTORY ITEMS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - inventory_items" ON inventory_items FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AI GENERATIONS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - ai_generations" ON ai_generations FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NOTIFICATIONS — users only see their own
DO $$ BEGIN
  CREATE POLICY "Users see own notifications" ON notifications FOR SELECT
  USING (user_id = auth.uid() AND belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "System can insert notifications" ON notifications FOR INSERT
  WITH CHECK (belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- MICROSITES — public SELECT for published microsites (for microsite pages)
DO $$ BEGIN
  CREATE POLICY "Published microsites are publicly readable" ON microsites FOR SELECT
  USING (status = 'published' OR belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant can manage microsites" ON microsites FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- TICKET TIERS — public SELECT for active tiers on published microsites
DO $$ BEGIN
  CREATE POLICY "Active ticket tiers are publicly readable" ON ticket_tiers FOR SELECT
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM microsites WHERE id = microsite_id AND status = 'published'
    ) OR belongs_to_tenant(tenant_id)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant can manage ticket_tiers" ON ticket_tiers FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- TICKET PURCHASES — buyers can see their own
DO $$ BEGIN
  CREATE POLICY "Buyers can see own purchases" ON ticket_purchases FOR SELECT
  USING (buyer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant can manage ticket_purchases" ON ticket_purchases FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- VENDORS — vendors see their own records
DO $$ BEGIN
  CREATE POLICY "Vendor portal: vendors see own profile"
  ON vendors FOR SELECT
  USING (user_id = auth.uid() OR belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- COMMENTS
DO $$ BEGIN
  CREATE POLICY "Tenant isolation - comments" ON comments FOR ALL
  USING (belongs_to_tenant(tenant_id))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- USER ROLES
DO $$ BEGIN
  CREATE POLICY "Users can see roles in their tenant" ON user_roles FOR SELECT
  USING (belongs_to_tenant(tenant_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Company admins can manage roles" ON user_roles FOR ALL
  USING (belongs_to_tenant(tenant_id) AND current_user_role() IN ('company_admin', 'super_admin'))
  WITH CHECK (tenant_id = current_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ==========================================
-- Migration: 013_guest_portal_and_realtime.sql
-- ==========================================
-- ============================================================
-- Migration 013: Guest Portal, Client Collaboration & Realtime
-- ============================================================

-- ─── Client Portals ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_portals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  portal_slug       TEXT NOT NULL UNIQUE,
  client_name       TEXT NOT NULL,
  client_email      TEXT NOT NULL,
  client_phone      TEXT,
  access_code       TEXT NOT NULL,
  access_expires_at TIMESTAMPTZ,
  allowed_sections  TEXT[] DEFAULT ARRAY['timeline','documents','messages','rsvp'],
  is_active         BOOLEAN DEFAULT true,
  last_accessed_at  TIMESTAMPTZ,
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_portals_tenant ON client_portals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_portals_event ON client_portals(event_id);
CREATE INDEX IF NOT EXISTS idx_client_portals_slug ON client_portals(portal_slug);

-- ─── Event Milestones ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_milestones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    TIMESTAMPTZ NOT NULL,
  status      TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','in_progress','completed','overdue')),
  sort_order  INTEGER DEFAULT 0,
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_event ON event_milestones(event_id, tenant_id);

-- ─── Client RSVPs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_rsvps (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id            UUID NOT NULL REFERENCES client_portals(id) ON DELETE CASCADE,
  event_id             UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_name          TEXT NOT NULL,
  client_email         TEXT NOT NULL,
  status               TEXT NOT NULL CHECK (status IN ('pending','confirmed','declined','maybe','waitlisted')),
  plus_ones            INTEGER DEFAULT 0,
  dietary_requirements TEXT,
  message              TEXT,
  responded_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (portal_id)   -- one RSVP per portal
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event ON client_rsvps(event_id, tenant_id);

-- ─── Portal Approvals ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_approvals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id    UUID NOT NULL REFERENCES client_portals(id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id      TEXT NOT NULL,
  item_type    TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','revision_requested')),
  notes        TEXT,
  client_name  TEXT,
  client_email TEXT,
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (portal_id, item_id, item_type)
);

CREATE INDEX IF NOT EXISTS idx_approvals_event ON portal_approvals(event_id, tenant_id);

-- ─── Portal Documents ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_documents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id             UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  document_name        TEXT NOT NULL,
  document_type        TEXT NOT NULL DEFAULT 'other',
  file_url             TEXT NOT NULL,
  description          TEXT,
  requires_approval    BOOLEAN DEFAULT false,
  is_visible_to_client BOOLEAN DEFAULT true,
  uploaded_by          UUID,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_docs_event ON portal_documents(event_id, tenant_id);

-- ─── Portal Messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id       UUID NOT NULL REFERENCES client_portals(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message         TEXT NOT NULL,
  attachment_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  from_client     BOOLEAN DEFAULT false,
  sender_name     TEXT,
  sender_email    TEXT,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_msgs_portal ON portal_messages(portal_id);
CREATE INDEX IF NOT EXISTS idx_portal_msgs_event ON portal_messages(event_id, tenant_id);

-- ─── Enhance existing guests table with portal fields ────────────────────────
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS check_in_status TEXT DEFAULT 'pending'
    CHECK (check_in_status IN ('pending','checked_in','no_show')),
  ADD COLUMN IF NOT EXISTS checked_in_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_by   UUID,
  ADD COLUMN IF NOT EXISTS is_vip          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS plus_ones       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_preference TEXT,
  ADD COLUMN IF NOT EXISTS category        TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS imported_by     UUID;

-- ─── Finance tables (if not already created by module stubs) ─────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID REFERENCES events(id) ON DELETE SET NULL,
  client_id         UUID,
  invoice_number    TEXT NOT NULL UNIQUE,
  client_name       TEXT NOT NULL,
  client_email      TEXT NOT NULL,
  client_phone      TEXT,
  client_address    TEXT,
  line_items        JSONB NOT NULL DEFAULT '[]',
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(12,2) DEFAULT 0,
  tax_amount        NUMERIC(12,2) DEFAULT 0,
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount       NUMERIC(12,2) DEFAULT 0,
  due_date          TIMESTAMPTZ,
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','partially_paid','paid','overdue','cancelled')),
  notes             TEXT,
  terms             TEXT,
  payment_milestones JSONB DEFAULT '[]',
  sent_at           TIMESTAMPTZ,
  razorpay_order_id TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_event ON invoices(event_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(tenant_id, status);

CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id     UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  event_id       UUID REFERENCES events(id) ON DELETE SET NULL,
  amount         NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  transaction_id TEXT,
  status         TEXT DEFAULT 'captured' CHECK (status IN ('pending','processing','captured','failed','refunded','partially_refunded')),
  notes          TEXT,
  recorded_by    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);

CREATE TABLE IF NOT EXISTS expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id     UUID REFERENCES events(id) ON DELETE SET NULL,
  category     TEXT NOT NULL,
  description  TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  date         TIMESTAMPTZ DEFAULT NOW(),
  vendor_id    UUID,
  receipt_url  TEXT,
  is_approved  BOOLEAN DEFAULT false,
  approved_by  UUID,
  approved_at  TIMESTAMPTZ,
  notes        TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_event ON expenses(event_id, tenant_id);

CREATE TABLE IF NOT EXISTS event_budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  total_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  allocations  JSONB DEFAULT '[]',
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budgets_event ON event_budgets(event_id, tenant_id);

-- ─── CRM Leads (enhanced) ────────────────────────────────────────────────────
-- leads table already exists from 004_crm_and_clients.sql — add any missing columns
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS contact_name     TEXT,
  ADD COLUMN IF NOT EXISTS contact_email    TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone    TEXT,
  ADD COLUMN IF NOT EXISTS company_name     TEXT,
  ADD COLUMN IF NOT EXISTS event_type       TEXT,
  ADD COLUMN IF NOT EXISTS estimated_guests INTEGER,
  ADD COLUMN IF NOT EXISTS budget           NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS score            INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_to      UUID,
  ADD COLUMN IF NOT EXISTS event_id         UUID,
  ADD COLUMN IF NOT EXISTS follow_up_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_tenant   ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status   ON leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);

CREATE TABLE IF NOT EXISTS lead_activities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  notes        TEXT,
  outcome      TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT false,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON lead_activities(lead_id);

CREATE TABLE IF NOT EXISTS proposals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_id     UUID REFERENCES events(id),
  title        TEXT NOT NULL,
  content      JSONB NOT NULL DEFAULT '{}',
  total_value  NUMERIC(12,2),
  status       TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','accepted','rejected','expired')),
  valid_until  TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  accepted_at  TIMESTAMPTZ,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals(lead_id);

-- ─── RLS Policies ────────────────────────────────────────────────────────────

-- Client portals: tenant-scoped read/write, public read by slug
ALTER TABLE client_portals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_portals" ON client_portals
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Portal tables follow same tenant pattern
ALTER TABLE event_milestones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_milestones" ON event_milestones
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE portal_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_portal_docs" ON portal_documents
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE portal_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_portal_msgs" ON portal_messages
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_invoices" ON invoices
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_payments" ON payments
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_expenses" ON expenses
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_leads" ON leads
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Auto-update timestamps ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_client_portals ON client_portals;
CREATE TRIGGER set_updated_at_client_portals
  BEFORE UPDATE ON client_portals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_milestones ON event_milestones;
CREATE TRIGGER set_updated_at_milestones
  BEFORE UPDATE ON event_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_invoices ON invoices;
CREATE TRIGGER set_updated_at_invoices
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_leads ON leads;
CREATE TRIGGER set_updated_at_leads
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_proposals ON proposals;
CREATE TRIGGER set_updated_at_proposals
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ==========================================
-- Migration: 014_vendor_portal.sql
-- ==========================================
-- ============================================================
-- Migration 014: Vendor Portal & Self-Service Access
-- ============================================================

-- ─── Vendor Portal Tokens ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_portal_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id      UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  contract_id    UUID REFERENCES vendor_contracts(id) ON DELETE CASCADE,
  event_id       UUID REFERENCES events(id) ON DELETE CASCADE,
  access_token   TEXT NOT NULL UNIQUE,
  expires_at     TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  is_active      BOOLEAN DEFAULT true,
  created_by     UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_tokens_token ON vendor_portal_tokens(access_token);
CREATE INDEX IF NOT EXISTS idx_vendor_tokens_vendor ON vendor_portal_tokens(vendor_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_tokens_contract ON vendor_portal_tokens(contract_id);

-- ─── Vendor Deliverables (what vendors submit back to the company) ────────────
CREATE TABLE IF NOT EXISTS vendor_deliverables (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id    UUID NOT NULL REFERENCES vendor_contracts(id) ON DELETE CASCADE,
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id      UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  file_url       TEXT,
  file_name      TEXT,
  deliverable_type TEXT DEFAULT 'document',
  status         TEXT DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','approved','rejected')),
  review_notes   TEXT,
  submitted_at   TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  reviewed_by    UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliverables_contract ON vendor_deliverables(contract_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_event ON vendor_deliverables(event_id, tenant_id);

-- ─── Vendor Portal Messages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id  UUID NOT NULL REFERENCES vendor_contracts(id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id    UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  message      TEXT NOT NULL,
  from_vendor  BOOLEAN DEFAULT false,
  sender_name  TEXT,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_msgs_contract ON vendor_messages(contract_id);
CREATE INDEX IF NOT EXISTS idx_vendor_msgs_event ON vendor_messages(event_id, tenant_id);

-- ─── Enhance vendor_contracts if columns don't exist ─────────────────────────
ALTER TABLE vendor_contracts
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending','partial','paid','overdue')),
  ADD COLUMN IF NOT EXISTS paid_amount     NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes           TEXT,
  ADD COLUMN IF NOT EXISTS portal_token_id UUID;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE vendor_portal_tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_vendor_tokens" ON vendor_portal_tokens
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE vendor_deliverables ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_vendor_deliverables" ON vendor_deliverables
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE vendor_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_vendor_messages" ON vendor_messages
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ==========================================
-- Migration: 015_super_admin.sql
-- ==========================================
-- ============================================================
-- Migration 015: Super Admin Infrastructure
-- ============================================================

-- ─── Feature Flags ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  enabled     BOOLEAN DEFAULT false,
  description TEXT,
  tenant_ids  UUID[] DEFAULT '{}',  -- empty = applies to all; populated = allowlist
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO feature_flags (name, enabled, description) VALUES
  ('ai_proposal_generation', true,  'AI-powered proposal generation from leads'),
  ('ai_budget_optimization', true,  'AI budget optimization and forecasting'),
  ('ai_risk_prediction',     true,  'AI risk prediction for events'),
  ('vendor_portal',          true,  'Vendor self-service portal with token-based access'),
  ('guest_portal',           true,  'Guest RSVP and check-in portal'),
  ('real_time_command',      true,  'Real-time event command center and live ops'),
  ('advanced_analytics',     true,  'Advanced analytics and BI dashboard'),
  ('white_label',            false, 'White-label branding for enterprise clients'),
  ('multi_currency',         false, 'Multi-currency invoicing and reporting'),
  ('sso_saml',               false, 'SAML-based Single Sign-On for enterprise')
ON CONFLICT (name) DO NOTHING;

-- ─── Audit Logs (platform-wide) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id       UUID,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   UUID,
  old_values    JSONB,
  new_values    JSONB,
  metadata      JSONB DEFAULT '{}',
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant   ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user     ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ─── Enhance tenants table ────────────────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan          TEXT DEFAULT 'starter'
    CHECK (plan IN ('starter','growth','professional','enterprise','custom')),
  ADD COLUMN IF NOT EXISTS max_events    INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_users     INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS features      TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS country       TEXT,
  ADD COLUMN IF NOT EXISTS mrr           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS churned_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes         TEXT;

-- ─── Enhance profiles table ───────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

-- ─── Webhook deliveries — table created in 011; ensure all columns exist ─────
ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','delivered','failed','retrying')),
  ADD COLUMN IF NOT EXISTS response_code INTEGER,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant ON webhook_deliveries(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status, next_retry_at);

-- ─── RLS: audit_logs readable only by super admins ────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "super_admin_audit_logs" ON audit_logs
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
    OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "feature_flags_readable" ON feature_flags
  FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "feature_flags_writable_super_admin" ON feature_flags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
                                                                                                                                                                                                                                                                                    

-- ==========================================
-- Migration: 016_command_center.sql
-- ==========================================
-- ============================================================
-- Migration 016: Event Command Center
-- ============================================================

-- ─── Runsheet Items ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheet_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  category          TEXT DEFAULT 'general'
    CHECK (category IN ('general','setup','ceremony','reception','entertainment','catering','vip','logistics','technical','teardown')),
  scheduled_time    TIMESTAMPTZ NOT NULL,
  duration_minutes  INTEGER DEFAULT 30,
  location          TEXT,
  assignee_id       UUID REFERENCES profiles(id),
  status            TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','skipped','delayed')),
  notes             TEXT,
  actual_start_time TIMESTAMPTZ,
  actual_end_time   TIMESTAMPTZ,
  delay_minutes     INTEGER DEFAULT 0,
  is_critical       BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runsheet_event    ON runsheet_items(event_id, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_runsheet_tenant   ON runsheet_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_runsheet_status   ON runsheet_items(event_id, status);

-- ─── Incident Reports ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incident_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low','medium','high','critical')),
  category      TEXT DEFAULT 'general'
    CHECK (category IN ('general','safety','technical','vendor','guest','weather','security','medical','logistics')),
  location      TEXT,
  status        TEXT DEFAULT 'open'
    CHECK (status IN ('open','investigating','resolved','closed')),
  reported_by   UUID REFERENCES profiles(id),
  assigned_to   UUID REFERENCES profiles(id),
  resolved_by   UUID REFERENCES profiles(id),
  resolution    TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_event   ON incident_reports(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incident_reports(event_id, severity) WHERE status = 'open';

-- ─── Team Event Assignments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_event_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id),
  role            TEXT,
  department      TEXT,
  shift_start     TIMESTAMPTZ,
  shift_end       TIMESTAMPTZ,
  check_in_status TEXT DEFAULT 'pending' CHECK (check_in_status IN ('pending','checked_in','absent')),
  checked_in_at   TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_assignments_event  ON team_event_assignments(event_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_user   ON team_event_assignments(user_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE runsheet_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_runsheet" ON runsheet_items
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_incidents" ON incident_reports
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE team_event_assignments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_team_assignments" ON team_event_assignments
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ==========================================
-- Migration: 017_production.sql
-- ==========================================
-- ============================================================
-- Migration 017: Production & Logistics Module
-- ============================================================

-- ─── Production Setups ────────────────────────────────────────────────────────
-- Represents a technical/production area for an event (Stage A, AV Booth, etc.)
CREATE TABLE IF NOT EXISTS production_setups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                            -- "Main Stage", "AV Booth", "Lighting Rig"
  category        TEXT DEFAULT 'general'
    CHECK (category IN ('stage','av','lighting','sound','power','network','rigging','pyrotechnics','video','decor','general')),
  description     TEXT,
  location        TEXT,                                     -- Physical location at venue
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','in_setup','ready','live','dismantling','done')),
  setup_start     TIMESTAMPTZ,
  setup_end       TIMESTAMPTZ,
  teardown_start  TIMESTAMPTZ,
  teardown_end    TIMESTAMPTZ,
  responsible_id  UUID REFERENCES profiles(id),
  vendor_id       UUID REFERENCES vendors(id),
  notes           TEXT,
  checklist       JSONB DEFAULT '[]',                       -- [{item, done, checked_by, checked_at}]
  attachments     JSONB DEFAULT '[]',                       -- [{name, url, type}]
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_setups_event  ON production_setups(event_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_prod_setups_status ON production_setups(event_id, status);

-- ─── Equipment Items ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT DEFAULT 'general'
    CHECK (category IN ('audio','video','lighting','staging','power','rigging','furniture','transport','communication','safety','general')),
  make            TEXT,
  model           TEXT,
  serial_number   TEXT,
  quantity_owned  INTEGER DEFAULT 1,
  quantity_available INTEGER,                               -- computed or manually set
  unit_cost       NUMERIC(12,2),
  notes           TEXT,
  condition       TEXT DEFAULT 'good'
    CHECK (condition IN ('excellent','good','fair','needs_repair','retired')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_tenant   ON equipment_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment_items(tenant_id, category);

-- ─── Equipment Assignments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  equipment_id    UUID NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  setup_id        UUID REFERENCES production_setups(id) ON DELETE SET NULL,
  quantity        INTEGER DEFAULT 1,
  status          TEXT DEFAULT 'reserved'
    CHECK (status IN ('reserved','dispatched','on_site','in_use','returned','damaged')),
  notes           TEXT,
  dispatched_at   TIMESTAMPTZ,
  returned_at     TIMESTAMPTZ,
  assigned_to     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equip_assign_event  ON equipment_assignments(event_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_equip_assign_equip  ON equipment_assignments(equipment_id);

-- ─── Load Schedule ────────────────────────────────────────────────────────────
-- Tracks vehicle movements, load-in and load-out windows
CREATE TABLE IF NOT EXISTS load_schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type            TEXT NOT NULL
    CHECK (type IN ('load_in','load_out','delivery','pickup','vendor_arrival','vendor_departure')),
  title           TEXT NOT NULL,
  description     TEXT,
  scheduled_time  TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  location        TEXT,                                     -- Gate/dock/entrance
  vendor_id       UUID REFERENCES vendors(id),
  vehicle_info    TEXT,                                     -- "Truck #3 - MH01AB1234"
  contact_name    TEXT,
  contact_phone   TEXT,
  status          TEXT DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','arrived','in_progress','completed','cancelled','delayed')),
  actual_time     TIMESTAMPTZ,
  delay_minutes   INTEGER DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_load_sched_event ON load_schedule(event_id, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_load_sched_tenant ON load_schedule(tenant_id);

-- ─── Supplier Coordination ────────────────────────────────────────────────────
-- Tracks supplier/vendor coordination items per event
CREATE TABLE IF NOT EXISTS supplier_coordination (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category        TEXT DEFAULT 'general'
    CHECK (category IN ('catering','decor','av','entertainment','transport','security','photography','general')),
  brief_sent      BOOLEAN DEFAULT false,
  brief_sent_at   TIMESTAMPTZ,
  confirmed       BOOLEAN DEFAULT false,
  confirmed_at    TIMESTAMPTZ,
  advance_paid    BOOLEAN DEFAULT false,
  advance_amount  NUMERIC(12,2),
  balance_due     NUMERIC(12,2),
  arrival_time    TIMESTAMPTZ,
  departure_time  TIMESTAMPTZ,
  contact_name    TEXT,
  contact_phone   TEXT,
  requirements    TEXT,                                     -- Power, space, etc.
  notes           TEXT,
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','briefed','confirmed','on_site','completed','cancelled')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_coord_event  ON supplier_coordination(event_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_coord_vendor ON supplier_coordination(vendor_id);

-- ─── Production Checklist Templates ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_checklist_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT DEFAULT 'general',
  items       JSONB NOT NULL DEFAULT '[]',  -- [{title, category, required}]
  event_type  TEXT,                          -- wedding, concert, corporate, etc.
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_templates_tenant ON production_checklist_templates(tenant_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE production_setups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_production_setups" ON production_setups
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_equipment" ON equipment_items
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE equipment_assignments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_equipment_assignments" ON equipment_assignments
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE load_schedule ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_load_schedule" ON load_schedule
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE supplier_coordination ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_supplier_coordination" ON supplier_coordination
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE production_checklist_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_prod_templates" ON production_checklist_templates
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ==========================================
-- Migration: 018_hospitality.sql
-- ==========================================
-- ============================================================
-- Migration 018: Hospitality & Accommodation Module
-- ============================================================

-- ─── Room Blocks ──────────────────────────────────────────────────────────────
-- Hotel/venue room blocks reserved for an event
CREATE TABLE IF NOT EXISTS room_blocks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  hotel_name        TEXT NOT NULL,
  hotel_address     TEXT,
  hotel_phone       TEXT,
  hotel_contact     TEXT,
  room_type         TEXT NOT NULL,          -- 'Deluxe', 'Suite', 'Standard', etc.
  total_rooms       INTEGER NOT NULL DEFAULT 0,
  confirmed_rooms   INTEGER DEFAULT 0,
  occupied_rooms    INTEGER DEFAULT 0,
  rate_per_night    NUMERIC(12,2),
  currency          TEXT DEFAULT 'INR',
  check_in_date     DATE,
  check_out_date    DATE,
  cutoff_date       DATE,                   -- Date by which bookings must be made
  contract_url      TEXT,
  notes             TEXT,
  status            TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','negotiating','confirmed','cancelled')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_blocks_event  ON room_blocks(event_id, tenant_id);

-- ─── Guest Accommodation ──────────────────────────────────────────────────────
-- Tracks individual guest room assignments
CREATE TABLE IF NOT EXISTS guest_accommodation (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  room_block_id     UUID REFERENCES room_blocks(id) ON DELETE SET NULL,
  guest_name        TEXT NOT NULL,
  guest_email       TEXT,
  guest_phone       TEXT,
  room_number       TEXT,
  room_type         TEXT,
  check_in_date     DATE,
  check_out_date    DATE,
  check_in_time     TIMESTAMPTZ,
  check_out_time    TIMESTAMPTZ,
  status            TEXT DEFAULT 'reserved'
    CHECK (status IN ('reserved','confirmed','checked_in','checked_out','cancelled','no_show')),
  special_requests  TEXT,
  is_vip            BOOLEAN DEFAULT false,
  is_complimentary  BOOLEAN DEFAULT false,
  cost              NUMERIC(12,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_accom_event  ON guest_accommodation(event_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_guest_accom_block  ON guest_accommodation(room_block_id);

-- ─── F&B Planning ─────────────────────────────────────────────────────────────
-- Food & Beverage plans for event sessions
CREATE TABLE IF NOT EXISTS fnb_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,          -- 'Welcome Dinner', 'Day 1 Lunch', 'Cocktail Hour'
  meal_type         TEXT DEFAULT 'other'
    CHECK (meal_type IN ('breakfast','lunch','dinner','cocktails','snacks','welcome_drink','high_tea','gala','other')),
  scheduled_time    TIMESTAMPTZ,
  duration_minutes  INTEGER DEFAULT 60,
  location          TEXT,
  pax_count         INTEGER DEFAULT 0,      -- Number of people
  menu_style        TEXT DEFAULT 'buffet'
    CHECK (menu_style IN ('buffet','plated','family_style','cocktail','live_counters','boxed','mixed')),
  vendor_id         UUID REFERENCES vendors(id),
  menu_items        JSONB DEFAULT '[]',     -- [{name, description, dietary, quantity}]
  dietary_counts    JSONB DEFAULT '{}',     -- {vegetarian: 10, vegan: 5, gluten_free: 2}
  cost_per_head     NUMERIC(12,2),
  total_cost        NUMERIC(12,2),
  status            TEXT DEFAULT 'planning'
    CHECK (status IN ('planning','confirmed','in_progress','completed','cancelled')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_plans_event ON fnb_plans(event_id, tenant_id);

-- ─── VIP Hospitality ──────────────────────────────────────────────────────────
-- VIP treatment plans and requirements
CREATE TABLE IF NOT EXISTS vip_hospitality (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_name        TEXT NOT NULL,
  guest_type        TEXT DEFAULT 'guest'
    CHECK (guest_type IN ('artist','dignitary','sponsor','celebrity','media','client','family','other')),
  company           TEXT,
  designation       TEXT,
  requirements      TEXT,                   -- Special requirements
  room_block_id     UUID REFERENCES room_blocks(id),
  accommodation     TEXT,                   -- Room type / hotel name override
  transport_needed  BOOLEAN DEFAULT false,
  transport_notes   TEXT,
  dietary_notes     TEXT,
  security_needed   BOOLEAN DEFAULT false,
  security_notes    TEXT,
  protocol_notes    TEXT,                   -- Special protocol / seating
  assigned_to       UUID REFERENCES profiles(id), -- Dedicated host/handler
  arrival_time      TIMESTAMPTZ,
  departure_time    TIMESTAMPTZ,
  flight_details    TEXT,
  gift_arranged     BOOLEAN DEFAULT false,
  status            TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','arrived','completed','cancelled')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vip_hospitality_event ON vip_hospitality(event_id, tenant_id);

-- ─── Transport Coordination ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transport_bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type              TEXT DEFAULT 'transfer'
    CHECK (type IN ('airport_pickup','airport_drop','hotel_venue','venue_hotel','intercity','sightseeing','other')),
  passenger_name    TEXT NOT NULL,
  passenger_count   INTEGER DEFAULT 1,
  pickup_location   TEXT NOT NULL,
  dropoff_location  TEXT NOT NULL,
  pickup_time       TIMESTAMPTZ NOT NULL,
  vehicle_type      TEXT DEFAULT 'sedan'
    CHECK (vehicle_type IN ('sedan','suv','van','bus','luxury','ambulance','other')),
  vehicle_number    TEXT,
  driver_name       TEXT,
  driver_phone      TEXT,
  vendor_id         UUID REFERENCES vendors(id),
  vip_id            UUID REFERENCES vip_hospitality(id) ON DELETE SET NULL,
  status            TEXT DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','confirmed','dispatched','completed','cancelled','no_show')),
  actual_pickup_time TIMESTAMPTZ,
  cost              NUMERIC(12,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_event   ON transport_bookings(event_id, pickup_time);
CREATE INDEX IF NOT EXISTS idx_transport_tenant  ON transport_bookings(tenant_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE room_blocks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_room_blocks" ON room_blocks
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE guest_accommodation ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_guest_accommodation" ON guest_accommodation
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE fnb_plans ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_fnb_plans" ON fnb_plans
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE vip_hospitality ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_vip_hospitality" ON vip_hospitality
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE transport_bookings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_transport_bookings" ON transport_bookings
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ==========================================
-- Migration: 019_artist_management.sql
-- ==========================================
-- ============================================================
-- Migration 019: Artist & Talent Management
-- ============================================================

-- ─── Artists / Talent Registry ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artists (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  stage_name        TEXT,
  genre             TEXT,                          -- 'Bollywood', 'EDM', 'Classical', 'Comedy', etc.
  category          TEXT DEFAULT 'performer'
    CHECK (category IN ('performer','dj','band','comedian','speaker','emcee','dancer','acrobat','magician','celebrity','other')),
  nationality       TEXT,
  languages         TEXT[],
  bio               TEXT,
  profile_image_url TEXT,
  website_url       TEXT,
  instagram_url     TEXT,
  youtube_url       TEXT,
  spotify_url       TEXT,
  agent_name        TEXT,
  agent_email       TEXT,
  agent_phone       TEXT,
  manager_name      TEXT,
  manager_email     TEXT,
  manager_phone     TEXT,
  base_fee          NUMERIC(14,2),
  currency          TEXT DEFAULT 'INR',
  tags              TEXT[],
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artists_tenant   ON artists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artists_category ON artists(tenant_id, category);

-- ─── Artist Bookings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artist_bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  artist_id         UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  set_name          TEXT,                           -- "Opening Act", "Main Set", "DJ Night"
  set_type          TEXT DEFAULT 'performance'
    CHECK (set_type IN ('performance','keynote','workshop','meet_greet','soundcheck','rehearsal','other')),
  start_time        TIMESTAMPTZ,
  duration_minutes  INTEGER DEFAULT 60,
  stage             TEXT,                           -- Which stage / venue area
  set_order         INTEGER DEFAULT 0,             -- Order on bill
  fee               NUMERIC(14,2),
  currency          TEXT DEFAULT 'INR',
  fee_status        TEXT DEFAULT 'quoted'
    CHECK (fee_status IN ('quoted','negotiating','agreed','advance_paid','fully_paid','disputed')),
  advance_amount    NUMERIC(14,2),
  advance_paid_at   TIMESTAMPTZ,
  balance_due       NUMERIC(14,2),
  contract_url      TEXT,
  contract_signed   BOOLEAN DEFAULT false,
  rider_url         TEXT,
  status            TEXT DEFAULT 'enquiry'
    CHECK (status IN ('enquiry','negotiating','booked','confirmed','on_site','performed','cancelled','no_show')),
  cancellation_fee  NUMERIC(14,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_bookings_event  ON artist_bookings(event_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_artist_bookings_artist ON artist_bookings(artist_id);

-- ─── Artist Riders ────────────────────────────────────────────────────────────
-- Technical and hospitality rider items for an artist booking
CREATE TABLE IF NOT EXISTS artist_riders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id        UUID NOT NULL REFERENCES artist_bookings(id) ON DELETE CASCADE,
  rider_type        TEXT DEFAULT 'technical'
    CHECK (rider_type IN ('technical','hospitality','security','transport','accommodation')),
  item              TEXT NOT NULL,
  quantity          INTEGER DEFAULT 1,
  specification     TEXT,
  is_mandatory      BOOLEAN DEFAULT true,
  fulfilled         BOOLEAN DEFAULT false,
  fulfilled_by      UUID REFERENCES profiles(id),
  fulfilled_at      TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_riders_booking ON artist_riders(booking_id);

-- ─── Artist Schedule / Itinerary ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artist_itinerary (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id        UUID NOT NULL REFERENCES artist_bookings(id) ON DELETE CASCADE,
  activity          TEXT NOT NULL,          -- 'Arrival', 'Soundcheck', 'Green Room', 'Performance', etc.
  activity_type     TEXT DEFAULT 'other'
    CHECK (activity_type IN ('travel','arrival','check_in','soundcheck','meet_greet','performance','interview','dinner','departure','other')),
  scheduled_time    TIMESTAMPTZ NOT NULL,
  duration_minutes  INTEGER DEFAULT 30,
  location          TEXT,
  notes             TEXT,
  status            TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','completed','cancelled')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_itinerary_booking ON artist_itinerary(booking_id, scheduled_time);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_artists" ON artists
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE artist_bookings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_artist_bookings" ON artist_bookings
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE artist_riders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_artist_riders" ON artist_riders
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE artist_itinerary ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_artist_itinerary" ON artist_itinerary
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ==========================================
-- Migration: 020_client_portal.sql
-- ==========================================
-- ============================================================
-- 020_client_portal.sql
-- White-label Client Collaboration Portal
-- ============================================================

-- ── Portal Branding Configuration ────────────────────────────
CREATE TABLE IF NOT EXISTS client_portal_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,

  -- Branding
  portal_name     TEXT NOT NULL DEFAULT 'Event Portal',
  logo_url        TEXT,
  favicon_url     TEXT,
  cover_image_url TEXT,
  primary_color   TEXT NOT NULL DEFAULT '#6366f1',
  accent_color    TEXT NOT NULL DEFAULT '#8b5cf6',
  background_color TEXT NOT NULL DEFAULT '#0f172a',
  font_family     TEXT NOT NULL DEFAULT 'Inter',

  -- Access
  access_token    TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  password_hash   TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  expires_at      TIMESTAMPTZ,

  -- Feature flags
  show_timeline   BOOLEAN NOT NULL DEFAULT true,
  show_budget     BOOLEAN NOT NULL DEFAULT true,
  show_documents  BOOLEAN NOT NULL DEFAULT true,
  show_moodboard  BOOLEAN NOT NULL DEFAULT true,
  show_vendors    BOOLEAN NOT NULL DEFAULT false,
  show_guestlist  BOOLEAN NOT NULL DEFAULT false,
  show_updates    BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  welcome_message TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(event_id)
);

-- ── Client Updates / Announcements ───────────────────────────
CREATE TABLE IF NOT EXISTS client_updates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  update_type     TEXT NOT NULL DEFAULT 'general'
                  CHECK (update_type IN (
                    'general','milestone','alert','vendor','finance',
                    'design','logistics','reminder','approval_request'
                  )),
  priority        TEXT NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('low','normal','high','urgent')),

  -- Attachment
  attachment_url  TEXT,
  attachment_name TEXT,

  -- Visibility
  is_pinned       BOOLEAN NOT NULL DEFAULT false,
  is_published    BOOLEAN NOT NULL DEFAULT true,
  published_at    TIMESTAMPTZ DEFAULT NOW(),

  -- Reactions
  client_read     BOOLEAN NOT NULL DEFAULT false,
  client_read_at  TIMESTAMPTZ,

  -- Author
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Event Timeline Milestones ─────────────────────────────────
CREATE TABLE IF NOT EXISTS client_timeline_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'planning'
                  CHECK (category IN (
                    'planning','booking','design','logistics',
                    'payment','approval','milestone','delivery'
                  )),

  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'upcoming'
                  CHECK (status IN (
                    'upcoming','in_progress','completed','delayed','cancelled'
                  )),

  -- Visibility
  visible_to_client BOOLEAN NOT NULL DEFAULT true,
  requires_client_action BOOLEAN NOT NULL DEFAULT false,

  -- Ordering
  sort_order      INTEGER NOT NULL DEFAULT 0,

  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Document Approvals ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  description     TEXT,
  file_url        TEXT NOT NULL,
  file_type       TEXT,
  file_size_bytes BIGINT,

  document_type   TEXT NOT NULL DEFAULT 'contract'
                  CHECK (document_type IN (
                    'contract','proposal','invoice','design',
                    'floor_plan','mood_board','vendor_quote',
                    'timeline','run_of_show','other'
                  )),

  -- Approval workflow
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approval_status   TEXT NOT NULL DEFAULT 'pending'
                    CHECK (approval_status IN (
                      'pending','under_review','approved','rejected','revision_requested'
                    )),
  approved_by_name  TEXT,
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  client_notes      TEXT,

  -- Version
  version         INTEGER NOT NULL DEFAULT 1,
  parent_id       UUID REFERENCES client_documents(id),

  -- Visibility
  is_shared       BOOLEAN NOT NULL DEFAULT true,

  uploaded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Mood Board ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_moodboard_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  title           TEXT,
  caption         TEXT,
  image_url       TEXT NOT NULL,
  source_url      TEXT,

  category        TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN (
                    'general','decor','floral','lighting','venue',
                    'attire','cake','catering','entertainment',
                    'photography','invitation','color_palette'
                  )),

  -- Client reaction
  client_liked    BOOLEAN,
  client_note     TEXT,
  reacted_at      TIMESTAMPTZ,

  -- Layout hint
  grid_size       TEXT NOT NULL DEFAULT 'medium'
                  CHECK (grid_size IN ('small','medium','large','full')),
  sort_order      INTEGER NOT NULL DEFAULT 0,

  added_by        UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Budget Approval Items ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_budget_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  category        TEXT NOT NULL,
  item_name       TEXT NOT NULL,
  description     TEXT,
  estimated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_amount    NUMERIC(12,2),

  status          TEXT NOT NULL DEFAULT 'pending_approval'
                  CHECK (status IN (
                    'draft','pending_approval','approved',
                    'rejected','revision_requested','on_hold'
                  )),

  -- Client approval
  client_approved_at  TIMESTAMPTZ,
  client_rejected_at  TIMESTAMPTZ,
  client_notes        TEXT,

  -- Manager notes
  internal_notes  TEXT,
  vendor_id       UUID REFERENCES vendors(id),

  -- Flags
  is_optional     BOOLEAN NOT NULL DEFAULT false,
  is_upgrade      BOOLEAN NOT NULL DEFAULT false,

  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Client Messages / Comments ────────────────────────────────
CREATE TABLE IF NOT EXISTS client_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Thread
  parent_id       UUID REFERENCES client_messages(id),

  body            TEXT NOT NULL,
  sender_type     TEXT NOT NULL DEFAULT 'team'
                  CHECK (sender_type IN ('team','client')),
  sender_name     TEXT NOT NULL,
  sender_avatar   TEXT,

  -- Reference
  ref_type        TEXT CHECK (ref_type IN (
                    'document','budget_item','timeline','moodboard','general'
                  )),
  ref_id          UUID,

  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_configs_event       ON client_portal_configs(event_id);
CREATE INDEX IF NOT EXISTS idx_portal_configs_token       ON client_portal_configs(access_token);
CREATE INDEX IF NOT EXISTS idx_client_updates_event       ON client_updates(event_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_timeline_event      ON client_timeline_items(event_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_client_documents_event     ON client_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_client_moodboard_event     ON client_moodboard_items(event_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_client_budget_event        ON client_budget_approvals(event_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_event      ON client_messages(event_id, created_at);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE client_portal_configs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_updates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_timeline_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_moodboard_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_budget_approvals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_messages           ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_portal_configs
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_updates
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_timeline_items
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_documents
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_moodboard_items
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_budget_approvals
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON client_messages
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ==========================================
-- Migration: 021_advanced_guests.sql
-- ==========================================
-- ============================================================
-- 021_advanced_guests.sql
-- Advanced Guest Management & QR Check-in System
-- ============================================================

-- ── Guest Groups / Families ───────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  name          TEXT NOT NULL,
  side          TEXT CHECK (side IN ('bride','groom','mutual','family','corporate','other')),
  relation      TEXT,
  notes         TEXT,
  is_vip        BOOLEAN NOT NULL DEFAULT false,
  primary_contact_name  TEXT,
  primary_contact_phone TEXT,
  primary_contact_email TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Extended Guest Profiles ───────────────────────────────────
-- Extends the existing 'guests' table with additional fields
-- via a separate detail table to avoid altering core schema

CREATE TABLE IF NOT EXISTS guest_details (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id        UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Classification
  group_id        UUID REFERENCES guest_groups(id),
  guest_type      TEXT NOT NULL DEFAULT 'regular'
                  CHECK (guest_type IN ('vip','family','friend','colleague','vendor','media','other','regular')),
  side            TEXT CHECK (side IN ('bride','groom','mutual','family','corporate','other')),
  relation_to_host TEXT,

  -- Meal & Dietary
  meal_preference TEXT CHECK (meal_preference IN ('veg','non_veg','vegan','jain','kosher','halal','custom')),
  dietary_notes   TEXT,
  allergies       TEXT[],
  meal_session    TEXT CHECK (meal_session IN ('breakfast','lunch','dinner','cocktail','all')),

  -- Seating
  table_number    TEXT,
  seat_number     TEXT,
  seating_zone    TEXT,
  seating_confirmed BOOLEAN NOT NULL DEFAULT false,

  -- QR & Check-in
  qr_code         TEXT UNIQUE,
  checked_in      BOOLEAN NOT NULL DEFAULT false,
  check_in_time   TIMESTAMPTZ,
  check_in_gate   TEXT,
  checked_in_by   UUID REFERENCES profiles(id),

  -- RSVP
  rsvp_status     TEXT NOT NULL DEFAULT 'pending'
                  CHECK (rsvp_status IN ('pending','confirmed','declined','tentative','no_show')),
  rsvp_responded_at TIMESTAMPTZ,
  rsvp_notes      TEXT,
  plus_one_allowed  BOOLEAN NOT NULL DEFAULT false,
  plus_one_name     TEXT,
  plus_one_checked_in BOOLEAN NOT NULL DEFAULT false,

  -- Gifting
  gift_received   BOOLEAN NOT NULL DEFAULT false,
  gift_description TEXT,
  gift_amount     NUMERIC(10,2),
  gift_acknowledged BOOLEAN NOT NULL DEFAULT false,
  gift_acknowledged_at TIMESTAMPTZ,

  -- Communication
  invite_sent     BOOLEAN NOT NULL DEFAULT false,
  invite_sent_at  TIMESTAMPTZ,
  invite_channel  TEXT CHECK (invite_channel IN ('whatsapp','email','sms','courier','hand_delivered')),
  reminder_sent   BOOLEAN NOT NULL DEFAULT false,

  -- Hospitality
  transport_needed BOOLEAN NOT NULL DEFAULT false,
  hotel_needed     BOOLEAN NOT NULL DEFAULT false,
  special_assistance TEXT,

  -- Priority / Badge
  badge_color     TEXT,
  access_zones    TEXT[] DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(guest_id, event_id)
);

-- ── Tables / Seating Chart ────────────────────────────────────
CREATE TABLE IF NOT EXISTS seating_tables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  table_number    TEXT NOT NULL,
  table_name      TEXT,
  table_type      TEXT NOT NULL DEFAULT 'round'
                  CHECK (table_type IN ('round','rectangular','square','banquet','cocktail','head_table','kids')),
  capacity        INTEGER NOT NULL DEFAULT 10,
  zone            TEXT,

  -- Position on floor plan
  pos_x           NUMERIC(6,2),
  pos_y           NUMERIC(6,2),

  assigned_count  INTEGER NOT NULL DEFAULT 0,
  is_reserved     BOOLEAN NOT NULL DEFAULT false,
  reserved_for    TEXT,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, table_number)
);

-- ── QR Check-in Log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkin_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id        UUID REFERENCES guests(id),

  qr_code         TEXT,
  scan_result     TEXT NOT NULL DEFAULT 'success'
                  CHECK (scan_result IN ('success','already_checked_in','invalid_code','wrong_event')),
  gate_name       TEXT,
  scanned_by      UUID REFERENCES profiles(id),
  device_id       TEXT,
  ip_address      TEXT,

  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Gift Registry ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_registry_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  item_name       TEXT NOT NULL,
  description     TEXT,
  quantity_needed INTEGER NOT NULL DEFAULT 1,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  estimated_price NUMERIC(10,2),
  store_url       TEXT,
  image_url       TEXT,
  category        TEXT,

  is_fulfilled    BOOLEAN NOT NULL DEFAULT false,
  fulfilled_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Guest Import Batch ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_import_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  filename        TEXT NOT NULL,
  total_rows      INTEGER NOT NULL DEFAULT 0,
  imported        INTEGER NOT NULL DEFAULT 0,
  failed          INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'processing'
                  CHECK (status IN ('processing','completed','failed','partial')),
  error_log       JSONB DEFAULT '[]',

  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_guest_details_event       ON guest_details(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_details_guest       ON guest_details(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_details_qr          ON guest_details(qr_code);
CREATE INDEX IF NOT EXISTS idx_guest_details_table       ON guest_details(event_id, table_number);
CREATE INDEX IF NOT EXISTS idx_guest_details_rsvp        ON guest_details(event_id, rsvp_status);
CREATE INDEX IF NOT EXISTS idx_guest_details_checkin     ON guest_details(event_id, checked_in);
CREATE INDEX IF NOT EXISTS idx_guest_groups_event        ON guest_groups(event_id);
CREATE INDEX IF NOT EXISTS idx_seating_tables_event      ON seating_tables(event_id);
CREATE INDEX IF NOT EXISTS idx_checkin_log_event         ON checkin_log(event_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_log_qr            ON checkin_log(qr_code);
CREATE INDEX IF NOT EXISTS idx_gift_registry_event       ON gift_registry_items(event_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE guest_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_details         ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_tables        ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_registry_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_import_batches  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON guest_groups
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON guest_details
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON seating_tables
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON checkin_log
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON gift_registry_items
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON guest_import_batches
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Helper function: Generate QR code for guest ───────────────
CREATE OR REPLACE FUNCTION generate_guest_qr(p_guest_id UUID, p_event_id UUID)
RETURNS TEXT AS $$
  SELECT encode(digest(p_guest_id::text || p_event_id::text || extract(epoch from now())::text, 'sha256'), 'hex');
$$ LANGUAGE SQL;


-- ==========================================
-- Migration: 022_workforce.sql
-- ==========================================
-- ============================================================
-- 022_workforce.sql
-- Workforce Management & Staff Scheduling System
-- ============================================================

-- ── Staff Roles / Positions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name          TEXT NOT NULL,
  code          TEXT NOT NULL,               -- e.g. 'event_coordinator', 'security', 'mc'
  department    TEXT,                        -- e.g. 'operations', 'hospitality', 'technical'
  hourly_rate   NUMERIC(10,2),
  overtime_rate NUMERIC(10,2),
  color         TEXT DEFAULT '#6366f1',      -- for schedule grid
  is_active     BOOLEAN NOT NULL DEFAULT true,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- ── Staff / Employees ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id      UUID REFERENCES profiles(id) ON DELETE SET NULL, -- linked user account (optional)

  -- Identity
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  photo_url       TEXT,

  -- Employment
  employee_code   TEXT,
  role_id         UUID REFERENCES staff_roles(id),
  department      TEXT,
  employment_type TEXT NOT NULL DEFAULT 'full_time'
                  CHECK (employment_type IN ('full_time','part_time','contractor','freelancer','intern')),
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive','on_leave','terminated')),

  -- Skills & certifications
  skills          TEXT[] DEFAULT '{}',
  certifications  TEXT[] DEFAULT '{}',
  languages       TEXT[] DEFAULT '{}',
  experience_years INTEGER DEFAULT 0,

  -- Availability
  available_days  TEXT[] DEFAULT '{"mon","tue","wed","thu","fri","sat","sun"}',
  max_hours_week  INTEGER DEFAULT 48,
  min_hours_week  INTEGER DEFAULT 0,

  -- Payroll
  base_hourly_rate NUMERIC(10,2),
  overtime_multiplier NUMERIC(4,2) DEFAULT 1.5,
  bank_account    TEXT,
  tax_id          TEXT,

  -- Emergency
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,

  -- Metadata
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  rating          NUMERIC(3,2),              -- average performance rating (0-5)
  total_events    INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, employee_code)
);

-- ── Event Staffing Plans ──────────────────────────────────────
-- One plan per event (auto-created or manual)
CREATE TABLE IF NOT EXISTS event_staffing_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','published','locked','completed')),
  headcount_target INTEGER DEFAULT 0,
  headcount_confirmed INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,

  created_by      UUID REFERENCES profiles(id),
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(event_id)
);

-- ── Shifts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  plan_id         UUID REFERENCES event_staffing_plans(id) ON DELETE CASCADE,

  -- Shift definition
  title           TEXT NOT NULL,
  role_id         UUID REFERENCES staff_roles(id),
  department      TEXT,
  location        TEXT,                       -- gate, zone, stage, etc.
  description     TEXT,

  -- Timing
  shift_date      DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  break_minutes   INTEGER DEFAULT 0,

  -- Capacity
  slots_required  INTEGER NOT NULL DEFAULT 1,
  slots_filled    INTEGER NOT NULL DEFAULT 0,

  -- Priority
  priority        TEXT NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('critical','high','normal','low')),
  is_overnight    BOOLEAN NOT NULL DEFAULT false,

  color           TEXT,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Shift Assignments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_id        UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  status          TEXT NOT NULL DEFAULT 'assigned'
                  CHECK (status IN ('assigned','confirmed','declined','no_show','completed')),

  -- Confirmation
  confirmed_at    TIMESTAMPTZ,
  confirmation_channel TEXT CHECK (confirmation_channel IN ('app','whatsapp','email','sms','phone')),
  decline_reason  TEXT,

  -- Actual attendance
  check_in_time   TIMESTAMPTZ,
  check_out_time  TIMESTAMPTZ,
  actual_hours    NUMERIC(5,2),
  overtime_hours  NUMERIC(5,2) DEFAULT 0,

  -- Performance
  performance_rating  SMALLINT CHECK (performance_rating BETWEEN 1 AND 5),
  performance_notes   TEXT,
  rated_by        UUID REFERENCES profiles(id),
  rated_at        TIMESTAMPTZ,

  -- Pay
  base_pay        NUMERIC(10,2),
  overtime_pay    NUMERIC(10,2) DEFAULT 0,
  bonus_pay       NUMERIC(10,2) DEFAULT 0,
  total_pay       NUMERIC(10,2),
  pay_processed   BOOLEAN NOT NULL DEFAULT false,
  pay_processed_at TIMESTAMPTZ,

  assigned_by     UUID REFERENCES profiles(id),
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(shift_id, staff_id)
);

-- ── Staff Availability Blocks ─────────────────────────────────
-- When a staff member is unavailable
CREATE TABLE IF NOT EXISTS staff_unavailability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,

  from_date       DATE NOT NULL,
  to_date         DATE NOT NULL,
  reason          TEXT CHECK (reason IN ('leave','sick','holiday','personal','training','other')),
  notes           TEXT,
  approved        BOOLEAN NOT NULL DEFAULT false,
  approved_by     UUID REFERENCES profiles(id),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Staff Attendance Log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_attendance_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id),
  assignment_id   UUID REFERENCES shift_assignments(id),

  action          TEXT NOT NULL CHECK (action IN ('check_in','check_out','break_start','break_end')),
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location        TEXT,
  device_id       TEXT,
  recorded_by     UUID REFERENCES profiles(id),    -- supervisor override
  notes           TEXT
);

-- ── Staff Performance Reviews ─────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_performance_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id),

  reviewer_id     UUID REFERENCES profiles(id),
  review_period   TEXT,                           -- 'Q1 2026', 'Event: Grand Wedding'
  overall_rating  NUMERIC(3,2) NOT NULL,

  -- Criteria
  punctuality     SMALLINT CHECK (punctuality BETWEEN 1 AND 5),
  professionalism SMALLINT CHECK (professionalism BETWEEN 1 AND 5),
  teamwork        SMALLINT CHECK (teamwork BETWEEN 1 AND 5),
  guest_handling  SMALLINT CHECK (guest_handling BETWEEN 1 AND 5),
  initiative      SMALLINT CHECK (initiative BETWEEN 1 AND 5),

  strengths       TEXT,
  improvements    TEXT,
  private_notes   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Payroll Batches ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  batch_name      TEXT NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','processing','completed','cancelled')),

  total_staff     INTEGER NOT NULL DEFAULT 0,
  total_hours     NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_base_pay  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_overtime  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_bonus     NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total     NUMERIC(12,2) NOT NULL DEFAULT 0,

  processed_by    UUID REFERENCES profiles(id),
  processed_at    TIMESTAMPTZ,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_members_tenant       ON staff_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_role         ON staff_members(role_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_status       ON staff_members(status);
CREATE INDEX IF NOT EXISTS idx_shifts_event               ON shifts(event_id);
CREATE INDEX IF NOT EXISTS idx_shifts_plan                ON shifts(plan_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date                ON shifts(event_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift    ON shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_staff    ON shift_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_event    ON shift_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_status   ON shift_assignments(event_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_log_staff       ON staff_attendance_log(staff_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_log_event       ON staff_attendance_log(event_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_unavailability_staff       ON staff_unavailability(staff_id, from_date, to_date);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE staff_roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_staffing_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_unavailability      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_batches           ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON staff_roles
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON staff_members
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON event_staffing_plans
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON shifts
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON shift_assignments
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON staff_unavailability
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON staff_attendance_log
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON staff_performance_reviews
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON payroll_batches
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Helper: auto-update staffing plan headcount ───────────────
CREATE OR REPLACE FUNCTION update_plan_headcount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE event_staffing_plans
  SET headcount_confirmed = (
    SELECT COUNT(*) FROM shift_assignments
    WHERE event_id = NEW.event_id
    AND status IN ('confirmed','completed')
  ),
  updated_at = NOW()
  WHERE event_id = NEW.event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_plan_headcount
AFTER INSERT OR UPDATE OF status ON shift_assignments
FOR EACH ROW EXECUTE FUNCTION update_plan_headcount();

-- ── Helper: auto-update slots_filled on shifts ────────────────
CREATE OR REPLACE FUNCTION update_shift_slots()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shifts
  SET slots_filled = (
    SELECT COUNT(*) FROM shift_assignments
    WHERE shift_id = COALESCE(NEW.shift_id, OLD.shift_id)
    AND status NOT IN ('declined','no_show')
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.shift_id, OLD.shift_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_shift_slots
AFTER INSERT OR UPDATE OF status OR DELETE ON shift_assignments
FOR EACH ROW EXECUTE FUNCTION update_shift_slots();


-- ==========================================
-- Migration: 023_marketing.sql
-- ==========================================
-- ============================================================
-- 023_marketing.sql
-- Marketing & Lead Generation System
-- ============================================================

-- ── Lead Sources / UTM Tracking ───────────────────────────────
CREATE TABLE IF NOT EXISTS lead_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'organic'
                CHECK (type IN ('organic','paid_search','paid_social','referral',
                                'direct','email','whatsapp','sms','event','partner','other')),
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_content   TEXT,
  cost_per_lead NUMERIC(10,2),
  is_active     BOOLEAN NOT NULL DEFAULT true,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Leads ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  crm_contact_id  UUID,                                  -- FK to crm_contacts if converted

  -- Identity
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  company         TEXT,
  location        TEXT,
  social_handle   TEXT,

  -- Lead details
  event_type      TEXT,                                   -- wedding, corporate, birthday…
  event_date      DATE,
  estimated_budget NUMERIC(12,2),
  guest_count     INTEGER,
  requirements    TEXT,

  -- Source & scoring
  source_id       UUID REFERENCES lead_sources(id),
  source_type     TEXT,
  utm_data        JSONB DEFAULT '{}',
  lead_score      INTEGER NOT NULL DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  score_breakdown JSONB DEFAULT '{}',               -- {budget:30, urgency:20, ...}

  -- Stage
  stage           TEXT NOT NULL DEFAULT 'new'
                  CHECK (stage IN ('new','contacted','qualified','proposal_sent',
                                   'negotiating','won','lost','nurturing')),
  stage_updated_at TIMESTAMPTZ,
  lost_reason     TEXT,
  win_probability INTEGER DEFAULT 0 CHECK (win_probability BETWEEN 0 AND 100),

  -- Assignment
  assigned_to     UUID REFERENCES profiles(id),
  assigned_at     TIMESTAMPTZ,

  -- Follow-up
  last_contact_at TIMESTAMPTZ,
  next_follow_up  TIMESTAMPTZ,
  follow_up_count INTEGER NOT NULL DEFAULT 0,

  -- Flags
  is_qualified    BOOLEAN NOT NULL DEFAULT false,
  is_converted    BOOLEAN NOT NULL DEFAULT false,
  converted_at    TIMESTAMPTZ,
  is_hot          BOOLEAN NOT NULL DEFAULT false,
  do_not_contact  BOOLEAN NOT NULL DEFAULT false,

  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Lead Activities / Timeline ────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES marketing_leads(id) ON DELETE CASCADE,

  type            TEXT NOT NULL
                  CHECK (type IN ('call','email','whatsapp','meeting','note',
                                  'stage_change','score_change','proposal','site_visit','follow_up')),
  subject         TEXT,
  body            TEXT,
  outcome         TEXT CHECK (outcome IN ('positive','neutral','negative','no_answer')),
  duration_min    INTEGER,
  next_action     TEXT,
  next_action_at  TIMESTAMPTZ,
  performed_by    UUID REFERENCES profiles(id),

  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Campaigns ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL DEFAULT 'email'
                  CHECK (type IN ('email','whatsapp','sms','social','paid_ad',
                                  'influencer','event','referral','content','mixed')),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','active','paused','completed','cancelled')),
  objective       TEXT CHECK (objective IN ('awareness','leads','conversion',
                                             'retention','engagement','upsell')),

  -- Targeting
  target_audience TEXT,
  target_event_types TEXT[] DEFAULT '{}',
  target_locations   TEXT[] DEFAULT '{}',
  estimated_reach    INTEGER,

  -- Budget
  budget          NUMERIC(12,2),
  spent           NUMERIC(12,2) DEFAULT 0,

  -- Schedule
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,

  -- Results
  sent_count      INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  opened_count    INTEGER NOT NULL DEFAULT 0,
  clicked_count   INTEGER NOT NULL DEFAULT 0,
  replied_count   INTEGER NOT NULL DEFAULT 0,
  converted_count INTEGER NOT NULL DEFAULT 0,
  unsubscribed    INTEGER NOT NULL DEFAULT 0,
  revenue_attributed NUMERIC(12,2) DEFAULT 0,

  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Campaign Messages / Templates ─────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,

  sequence_order  INTEGER NOT NULL DEFAULT 1,
  channel         TEXT NOT NULL CHECK (channel IN ('email','whatsapp','sms')),
  send_delay_days INTEGER NOT NULL DEFAULT 0,   -- days after previous message
  send_time       TIME,                          -- preferred send time

  subject         TEXT,
  body            TEXT NOT NULL,
  media_url       TEXT,
  cta_text        TEXT,
  cta_url         TEXT,

  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Campaign Recipients ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES marketing_leads(id),

  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,

  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','delivered','opened','clicked',
                                    'replied','converted','bounced','unsubscribed','failed')),
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,

  UNIQUE(campaign_id, lead_id)
);

-- ── Lead Capture Forms ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_capture_forms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  title           TEXT,
  subtitle        TEXT,
  cta_text        TEXT DEFAULT 'Get Free Quote',
  thank_you_message TEXT DEFAULT 'We''ll contact you within 24 hours!',

  -- Form config
  fields          JSONB NOT NULL DEFAULT '[]',   -- [{label, type, required, options}]
  source_id       UUID REFERENCES lead_sources(id),

  -- Branding
  primary_color   TEXT DEFAULT '#6366f1',
  logo_url        TEXT,
  background_url  TEXT,

  is_active       BOOLEAN NOT NULL DEFAULT true,
  submission_count INTEGER NOT NULL DEFAULT 0,
  conversion_rate  NUMERIC(5,2) DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- ── Form Submissions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  form_id         UUID NOT NULL REFERENCES lead_capture_forms(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES marketing_leads(id),

  data            JSONB NOT NULL DEFAULT '{}',
  ip_address      TEXT,
  user_agent      TEXT,
  referrer_url    TEXT,
  utm_data        JSONB DEFAULT '{}',

  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Social Posts / Content Calendar ──────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  content         TEXT NOT NULL,
  caption         TEXT,
  hashtags        TEXT[] DEFAULT '{}',
  media_urls      TEXT[] DEFAULT '{}',

  platforms       TEXT[] NOT NULL DEFAULT '{instagram}',
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','published','failed')),

  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,

  -- Analytics
  impressions     INTEGER DEFAULT 0,
  reach           INTEGER DEFAULT 0,
  likes           INTEGER DEFAULT 0,
  comments        INTEGER DEFAULT 0,
  shares          INTEGER DEFAULT 0,
  saves           INTEGER DEFAULT 0,
  link_clicks     INTEGER DEFAULT 0,

  campaign_id     UUID REFERENCES marketing_campaigns(id),
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Marketing Analytics / KPI Snapshots ──────────────────────
CREATE TABLE IF NOT EXISTS marketing_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,

  total_leads     INTEGER NOT NULL DEFAULT 0,
  new_leads       INTEGER NOT NULL DEFAULT 0,
  qualified_leads INTEGER NOT NULL DEFAULT 0,
  converted_leads INTEGER NOT NULL DEFAULT 0,
  lost_leads      INTEGER NOT NULL DEFAULT 0,

  total_revenue   NUMERIC(12,2) DEFAULT 0,
  marketing_spend NUMERIC(12,2) DEFAULT 0,
  roas            NUMERIC(6,2) DEFAULT 0,    -- return on ad spend
  cost_per_lead   NUMERIC(10,2) DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,

  top_source      TEXT,
  top_event_type  TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, snapshot_date)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_tenant         ON marketing_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage          ON marketing_leads(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_score          ON marketing_leads(tenant_id, lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_assigned       ON marketing_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_source         ON marketing_leads(source_id);
CREATE INDEX IF NOT EXISTS idx_leads_hot            ON marketing_leads(tenant_id, is_hot) WHERE is_hot = true;
CREATE INDEX IF NOT EXISTS idx_leads_followup       ON marketing_leads(tenant_id, next_follow_up);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant     ON marketing_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status     ON marketing_campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_recipients_campaign  ON campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_social_posts_tenant  ON social_posts(tenant_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions     ON form_submissions(form_id, submitted_at DESC);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE lead_sources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_leads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_capture_forms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_analytics   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON lead_sources
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON marketing_leads
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON lead_activities
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON marketing_campaigns
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON campaign_messages
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON campaign_recipients
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON lead_capture_forms
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON form_submissions
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON social_posts
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON marketing_analytics
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Public: allow form submission inserts without auth (for embed forms)
CREATE POLICY public_form_submit ON form_submissions
  FOR INSERT WITH CHECK (true);


-- ==========================================
-- Migration: 024_support.sql
-- ==========================================
-- ============================================================
-- 024_support.sql — Support & Ticketing System
-- ============================================================

-- ── Ticket Categories ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  color         TEXT DEFAULT '#6366f1',
  icon          TEXT DEFAULT 'help-circle',
  sla_hours     INTEGER DEFAULT 24,           -- response SLA in hours
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- ── SLA Policies ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sla_policies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  priority            TEXT NOT NULL CHECK (priority IN ('critical','high','medium','low')),
  first_response_hrs  INTEGER NOT NULL DEFAULT 1,
  resolution_hrs      INTEGER NOT NULL DEFAULT 24,
  escalation_hrs      INTEGER,                -- auto-escalate after N hours
  is_default          BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, priority)
);

-- ── Support Tickets ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_tickets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_number       TEXT NOT NULL,                    -- e.g. TKT-0042
  title               TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','pending_client','resolved','closed','cancelled')),
  priority            TEXT NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('critical','high','medium','low')),
  category_id         UUID REFERENCES ticket_categories(id) ON DELETE SET NULL,

  -- Reporter
  reporter_type       TEXT DEFAULT 'internal' CHECK (reporter_type IN ('internal','client','vendor','guest')),
  reporter_id         UUID,                             -- profiles.id for internal
  reporter_name       TEXT,                             -- for external reporters
  reporter_email      TEXT,

  -- Assignment
  assigned_to         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_team       TEXT,
  escalated_to        UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Context
  event_id            UUID REFERENCES events(id) ON DELETE SET NULL,
  vendor_id           UUID REFERENCES vendors(id) ON DELETE SET NULL,
  related_entity_type TEXT,
  related_entity_id   UUID,

  -- SLA tracking
  sla_policy_id       UUID REFERENCES sla_policies(id) ON DELETE SET NULL,
  first_response_due  TIMESTAMPTZ,
  resolution_due      TIMESTAMPTZ,
  first_response_at   TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  sla_breached        BOOLEAN DEFAULT FALSE,
  response_sla_breached BOOLEAN DEFAULT FALSE,

  -- Satisfaction
  satisfaction_score  INTEGER CHECK (satisfaction_score BETWEEN 1 AND 5),
  satisfaction_note   TEXT,
  satisfaction_at     TIMESTAMPTZ,

  -- Resolution
  resolution_note     TEXT,
  resolved_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Tags & metadata
  tags                TEXT[] DEFAULT '{}',
  metadata            JSONB DEFAULT '{}',

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, ticket_number)
);

-- ── Ticket Comments / Activity Feed ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id     UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name   TEXT,
  author_type   TEXT DEFAULT 'agent' CHECK (author_type IN ('agent','client','vendor','system')),
  body          TEXT NOT NULL,
  is_internal   BOOLEAN DEFAULT FALSE,        -- internal notes not visible to client
  attachments   JSONB DEFAULT '[]',           -- [{name, url, size, mime}]
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ticket Attachments ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES ticket_comments(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   INTEGER,
  mime_type   TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ticket Activity Log ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name  TEXT,
  action      TEXT NOT NULL,               -- assigned, status_changed, priority_changed, escalated, etc.
  old_value   TEXT,
  new_value   TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Knowledge Base Articles ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES ticket_categories(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL,
  content       TEXT NOT NULL,
  summary       TEXT,
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  is_public     BOOLEAN DEFAULT FALSE,
  view_count    INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  tags          TEXT[] DEFAULT '{}',
  author_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- ── Ticket-to-KB Links ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_kb_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  article_id  UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  linked_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id, article_id)
);

-- ── Escalation Rules ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS escalation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  priority        TEXT CHECK (priority IN ('critical','high','medium','low')),
  hours_threshold INTEGER NOT NULL DEFAULT 4,
  escalate_to     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notify_email    TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant   ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status   ON support_tickets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(tenant_id, priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_event    ON support_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_sla      ON support_tickets(tenant_id, sla_breached, status);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket   ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket ON ticket_activities(ticket_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_tenant       ON kb_articles(tenant_id, status);

-- ── Auto-increment ticket number ─────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_ticket_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(ticket_number FROM 'TKT-(\d+)') AS INTEGER)
  ), 999) + 1
  INTO v_seq
  FROM support_tickets
  WHERE tenant_id = p_tenant_id;
  RETURN 'TKT-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ── Auto-update updated_at ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_support_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_ticket_updated ON support_tickets;
CREATE TRIGGER trg_support_ticket_updated
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_updated_at();

DROP TRIGGER IF EXISTS trg_kb_article_updated ON kb_articles;
CREATE TRIGGER trg_kb_article_updated
  BEFORE UPDATE ON kb_articles
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_updated_at();

DROP TRIGGER IF EXISTS trg_ticket_comment_updated ON ticket_comments;
CREATE TRIGGER trg_ticket_comment_updated
  BEFORE UPDATE ON ticket_comments
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_updated_at();

-- ── Auto-log ticket activity on status change ────────────────────────────────

CREATE OR REPLACE FUNCTION log_ticket_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ticket_activities(tenant_id, ticket_id, action, old_value, new_value)
    VALUES (NEW.tenant_id, NEW.id, 'status_changed', OLD.status, NEW.status);
  END IF;
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO ticket_activities(tenant_id, ticket_id, action, old_value, new_value)
    VALUES (NEW.tenant_id, NEW.id, 'priority_changed', OLD.priority, NEW.priority);
  END IF;
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO ticket_activities(tenant_id, ticket_id, action, old_value, new_value)
    VALUES (NEW.tenant_id, NEW.id, 'assigned', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_activity ON support_tickets;
CREATE TRIGGER trg_ticket_activity
  AFTER UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION log_ticket_activity();

-- ── SLA breach check function ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_sla_breaches()
RETURNS void AS $$
BEGIN
  -- Mark response SLA breached
  UPDATE support_tickets
  SET response_sla_breached = TRUE
  WHERE first_response_at IS NULL
    AND first_response_due < NOW()
    AND status NOT IN ('resolved','closed','cancelled')
    AND response_sla_breached = FALSE;

  -- Mark resolution SLA breached
  UPDATE support_tickets
  SET sla_breached = TRUE
  WHERE resolved_at IS NULL
    AND resolution_due < NOW()
    AND status NOT IN ('resolved','closed','cancelled')
    AND sla_breached = FALSE;
END;
$$ LANGUAGE plpgsql;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE ticket_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_kb_links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules     ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON ticket_categories    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON sla_policies         USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON support_tickets      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON ticket_comments      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON ticket_attachments   USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON ticket_activities    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON kb_articles          USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON escalation_rules     USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ticket_kb_links: inherit from tickets
CREATE POLICY ticket_link_isolation ON ticket_kb_links
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ── Default seed data function ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_support_defaults(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  -- Default categories
  INSERT INTO ticket_categories (tenant_id, name, color, sla_hours, sort_order) VALUES
    (p_tenant_id, 'Vendor Issue',        '#f59e0b', 4,  1),
    (p_tenant_id, 'Client Request',      '#6366f1', 8,  2),
    (p_tenant_id, 'Event Operations',    '#10b981', 2,  3),
    (p_tenant_id, 'Finance & Billing',   '#ef4444', 24, 4),
    (p_tenant_id, 'IT & Systems',        '#3b82f6', 8,  5),
    (p_tenant_id, 'Staff & HR',          '#8b5cf6', 24, 6),
    (p_tenant_id, 'Guest Complaint',     '#ec4899', 4,  7),
    (p_tenant_id, 'General Enquiry',     '#64748b', 48, 8)
  ON CONFLICT (tenant_id, name) DO NOTHING;

  -- Default SLA policies
  INSERT INTO sla_policies (tenant_id, name, priority, first_response_hrs, resolution_hrs, escalation_hrs, is_default) VALUES
    (p_tenant_id, 'Critical SLA',  'critical', 1,  4,  2,   FALSE),
    (p_tenant_id, 'High SLA',      'high',     2,  8,  4,   FALSE),
    (p_tenant_id, 'Standard SLA',  'medium',   4,  24, 12,  TRUE),
    (p_tenant_id, 'Low SLA',       'low',      8,  72, NULL, FALSE)
  ON CONFLICT (tenant_id, priority) DO NOTHING;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- Migration: 025_integrations.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 025: API & Integration Hub
-- API keys, webhook subscriptions, payload logs, connectors
-- ============================================================

-- ── API KEYS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_prefix    TEXT NOT NULL,          -- e.g. "op_live_" visible in UI
  key_hash      TEXT NOT NULL,          -- bcrypt/sha256 of the full key
  key_last4     TEXT NOT NULL,          -- last 4 chars for display
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  environment   TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live','sandbox')),
  expires_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  usage_count   INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES profiles(id),
  revoked_by    UUID REFERENCES profiles(id),
  revoked_at    TIMESTAMPTZ,
  revoke_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── WEBHOOK ENDPOINTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  secret          TEXT NOT NULL,          -- HMAC signing secret
  events          TEXT[] NOT NULL DEFAULT '{}',  -- subscribed event types
  is_active       BOOLEAN NOT NULL DEFAULT true,
  description     TEXT,
  api_version     TEXT NOT NULL DEFAULT 'v1',
  timeout_ms      INTEGER NOT NULL DEFAULT 10000,
  retry_count     INTEGER NOT NULL DEFAULT 3,
  -- Stats (denormalised for speed)
  total_deliveries    INTEGER NOT NULL DEFAULT 0,
  successful_deliveries INTEGER NOT NULL DEFAULT 0,
  failed_deliveries   INTEGER NOT NULL DEFAULT 0,
  last_triggered_at   TIMESTAMPTZ,
  last_success_at     TIMESTAMPTZ,
  last_failure_at     TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── WEBHOOK DELIVERIES (payload log) ──────────────────────
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  endpoint_id     UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  event_id        UUID,                   -- source entity id
  payload         JSONB NOT NULL DEFAULT '{}',
  attempt         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','success','failed','retrying')),
  response_status INTEGER,
  response_body   TEXT,
  response_time_ms INTEGER,
  error_message   TEXT,
  next_retry_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── THIRD-PARTY INTEGRATIONS ──────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,          -- 'whatsapp','razorpay','google_calendar','zoom','sendgrid','twilio'
  display_name    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'disconnected'
                    CHECK (status IN ('connected','disconnected','error','pending')),
  config          JSONB NOT NULL DEFAULT '{}',   -- non-secret config (masked in API)
  secrets         JSONB NOT NULL DEFAULT '{}',   -- encrypted secrets
  scopes          TEXT[] DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  last_tested_at  TIMESTAMPTZ,
  last_error      TEXT,
  last_synced_at  TIMESTAMPTZ,
  connected_by    UUID REFERENCES profiles(id),
  connected_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);

-- ── INTEGRATION EVENT LOG ─────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
  provider      TEXT NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  action        TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('success','failure','pending')),
  payload       JSONB DEFAULT '{}',
  response      JSONB DEFAULT '{}',
  error_message TEXT,
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant     ON api_keys(tenant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_hash        ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant      ON webhook_endpoints(tenant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_deliveries_endpoint  ON webhook_deliveries(endpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_status    ON webhook_deliveries(tenant_id, status) WHERE status IN ('pending','retrying','failed');
CREATE INDEX IF NOT EXISTS idx_integrations_tenant  ON integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intlog_tenant        ON integration_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intlog_provider      ON integration_logs(tenant_id, provider, created_at DESC);

-- ── ROW-LEVEL SECURITY ────────────────────────────────────
ALTER TABLE api_keys             ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints    ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs     ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_tenant ON api_keys
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY webhooks_tenant ON webhook_endpoints
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY deliveries_tenant ON webhook_deliveries
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY integrations_tenant ON integrations
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY intlog_tenant ON integration_logs
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── TRIGGERS ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_webhook_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' THEN
    UPDATE webhook_endpoints SET
      total_deliveries = total_deliveries + 1,
      successful_deliveries = successful_deliveries + 1,
      last_triggered_at = NOW(),
      last_success_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.endpoint_id;
  ELSIF NEW.status = 'failed' THEN
    UPDATE webhook_endpoints SET
      total_deliveries = total_deliveries + 1,
      failed_deliveries = failed_deliveries + 1,
      last_triggered_at = NOW(),
      last_failure_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.endpoint_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS webhook_delivery_stats ON webhook_deliveries;
CREATE TRIGGER webhook_delivery_stats
  AFTER UPDATE OF status ON webhook_deliveries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('success','failed'))
  EXECUTE FUNCTION update_webhook_stats();

CREATE OR REPLACE FUNCTION track_api_key_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE api_keys SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE key_hash = NEW.key_hash;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated-at triggers
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'api_keys_updated_at') THEN
DROP TRIGGER IF EXISTS api_keys_updated_at ON api_keys;
    CREATE TRIGGER api_keys_updated_at BEFORE UPDATE ON api_keys
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'webhooks_updated_at') THEN
DROP TRIGGER IF EXISTS webhooks_updated_at ON webhook_endpoints;
    CREATE TRIGGER webhooks_updated_at BEFORE UPDATE ON webhook_endpoints
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'integrations_updated_at') THEN
DROP TRIGGER IF EXISTS integrations_updated_at ON integrations;
    CREATE TRIGGER integrations_updated_at BEFORE UPDATE ON integrations
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- ── SEED DEFAULT INTEGRATION SLOTS ────────────────────────
-- Each tenant gets disconnected stubs so the UI always has a full grid
CREATE OR REPLACE FUNCTION seed_integration_slots(p_tenant_id UUID)
RETURNS VOID AS $$
DECLARE
  providers TEXT[][] := ARRAY[
    ['whatsapp',       'WhatsApp Business'],
    ['razorpay',       'Razorpay Payments'],
    ['google_calendar','Google Calendar'],
    ['zoom',           'Zoom Video'],
    ['sendgrid',       'SendGrid Email'],
    ['twilio',         'Twilio SMS'],
    ['stripe',         'Stripe Payments'],
    ['slack',          'Slack Notifications']
  ];
  p TEXT[];
BEGIN
  FOREACH p SLICE 1 IN ARRAY providers LOOP
    INSERT INTO integrations(tenant_id, provider, display_name, status)
    VALUES (p_tenant_id, p[1], p[2], 'disconnected')
    ON CONFLICT (tenant_id, provider) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ── WEBHOOK EVENT TYPES ENUM (reference) ──────────────────
-- These are the supported event types for webhook subscriptions
COMMENT ON TABLE webhook_endpoints IS
'Supported event types: event.created, event.updated, event.cancelled,
 ticket.created, ticket.status_changed, ticket.escalated,
 payment.received, payment.failed, payment.refunded,
 guest.checked_in, vendor.confirmed, vendor.declined,
 staff.assigned, staff.checkin, task.completed,
 report.generated';


-- ==========================================
-- Migration: 026_notifications_center.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 026: Notifications Center
-- In-app notifications, preferences, templates, broadcast
-- ============================================================

-- ── IN-APP NOTIFICATIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN ('event','finance','support','operations','team','system','ai','general')),
  title         TEXT NOT NULL,
  body          TEXT,
  action_url    TEXT,
  action_label  TEXT,
  icon          TEXT,                     -- lucide icon name
  metadata      JSONB NOT NULL DEFAULT '{}',
  is_read       BOOLEAN NOT NULL DEFAULT false,
  is_archived   BOOLEAN NOT NULL DEFAULT false,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── NOTIFICATION PREFERENCES (per user, per channel) ──────
CREATE TABLE IF NOT EXISTS notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,           -- matches notifications.category
  event_type      TEXT,                    -- NULL = applies to all in category
  in_app          BOOLEAN NOT NULL DEFAULT true,
  email           BOOLEAN NOT NULL DEFAULT true,
  whatsapp        BOOLEAN NOT NULL DEFAULT false,
  sms             BOOLEAN NOT NULL DEFAULT false,
  push            BOOLEAN NOT NULL DEFAULT true,
  digest          BOOLEAN NOT NULL DEFAULT false,  -- include in daily digest
  quiet_hours_start TIME,                          -- e.g. 22:00
  quiet_hours_end   TIME,                          -- e.g. 07:00
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique preference per user/category/event_type (NULL-safe)
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_prefs_with_type
  ON notification_preferences(tenant_id, user_id, category, event_type)
  WHERE event_type IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_prefs_no_type
  ON notification_preferences(tenant_id, user_id, category)
  WHERE event_type IS NULL;

-- ── NOTIFICATION TEMPLATES ────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  event_type      TEXT NOT NULL UNIQUE,
  category        TEXT NOT NULL,
  title_template  TEXT NOT NULL,   -- handlebars-style {{variable}}
  body_template   TEXT,
  email_subject   TEXT,
  email_body      TEXT,
  whatsapp_template TEXT,
  sms_template    TEXT,
  variables       TEXT[] DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── BROADCAST NOTIFICATIONS ───────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  target        TEXT NOT NULL DEFAULT 'all'
                  CHECK (target IN ('all','role','event','custom')),
  target_roles  TEXT[],
  target_event_id UUID,
  channels      TEXT[] NOT NULL DEFAULT '{in_app}',
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at  TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  recipient_count INTEGER,
  delivered_count INTEGER,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant  ON notifications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_id) WHERE is_read = false AND is_archived = false;
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user      ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_tmpl_tenant     ON notification_templates(tenant_id);

-- ── ROW-LEVEL SECURITY ────────────────────────────────────
ALTER TABLE notifications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_notifications    ENABLE ROW LEVEL SECURITY;

-- Users see only their own notifications
CREATE POLICY notif_user ON notifications
  USING (user_id = auth.uid());
CREATE POLICY notif_prefs_user ON notification_preferences
  USING (user_id = auth.uid());
CREATE POLICY notif_tmpl_tenant ON notification_templates
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY broadcast_tenant ON broadcast_notifications
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── TRIGGERS ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notifications_read_at ON notifications;
CREATE TRIGGER notifications_read_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION auto_read_at();

-- ── SEED: DEFAULT NOTIFICATION TEMPLATES ─────────────────
INSERT INTO notification_templates(tenant_id, name, event_type, category, title_template, body_template, variables, email_subject)
SELECT
  t.id,
  tmpl.name,
  tmpl.event_type,
  tmpl.category,
  tmpl.title_template,
  tmpl.body_template,
  tmpl.variables,
  tmpl.email_subject
FROM tenants t
CROSS JOIN (VALUES
  ('Event Created',      'event.created',          'event',      'New event: {{event_name}}',           'A new event "{{event_name}}" has been created for {{event_date}}.', ARRAY['event_name','event_date']::TEXT[], 'New Event Created — {{event_name}}'),
  ('Payment Received',   'payment.received',        'finance',    '₹{{amount}} payment received',        'Payment of ₹{{amount}} received for event "{{event_name}}".', ARRAY['amount','event_name']::TEXT[], 'Payment Received — ₹{{amount}}'),
  ('Invoice Overdue',    'invoice.overdue',         'finance',    'Invoice overdue: {{invoice_number}}', 'Invoice {{invoice_number}} for ₹{{amount}} is overdue since {{due_date}}.', ARRAY['invoice_number','amount','due_date']::TEXT[], 'Invoice Overdue — {{invoice_number}}'),
  ('Ticket Created',     'ticket.created',          'support',    'New ticket: {{ticket_number}}',       '{{reporter}} raised a ticket: {{subject}}.', ARRAY['ticket_number','reporter','subject']::TEXT[], 'New Support Ticket — {{ticket_number}}'),
  ('Ticket Escalated',   'ticket.escalated',        'support',    'Ticket escalated: {{ticket_number}}', 'Ticket {{ticket_number}} has been escalated to {{assigned_to}}.', ARRAY['ticket_number','assigned_to']::TEXT[], 'Ticket Escalated'),
  ('Staff Assigned',     'staff.assigned',          'team',       'You have been assigned to {{event_name}}', 'You have been assigned as {{role}} for event "{{event_name}}" on {{event_date}}.', ARRAY['event_name','role','event_date']::TEXT[], 'New Assignment — {{event_name}}'),
  ('Task Completed',     'task.completed',          'operations', 'Task completed: {{task_name}}',       '{{completed_by}} completed the task "{{task_name}}".', ARRAY['task_name','completed_by']::TEXT[], 'Task Completed'),
  ('Vendor Confirmed',   'vendor.confirmed',        'operations', '{{vendor_name}} confirmed',            'Vendor "{{vendor_name}}" has confirmed their booking for {{event_name}}.', ARRAY['vendor_name','event_name']::TEXT[], 'Vendor Confirmation'),
  ('Guest Checked In',   'guest.checked_in',        'operations', '{{guest_name}} checked in',           '{{guest_name}} has checked in at {{checkin_time}}.', ARRAY['guest_name','checkin_time']::TEXT[], 'Guest Check-in'),
  ('AI Alert',           'ai.risk_alert',           'ai',         'AI Risk Alert: {{event_name}}',       'AI detected a risk for event "{{event_name}}": {{risk_description}}.', ARRAY['event_name','risk_description']::TEXT[], 'AI Risk Alert — {{event_name}}')
) AS tmpl(name, event_type, category, title_template, body_template, variables, email_subject)
ON CONFLICT DO NOTHING;


-- ==========================================
-- Migration: 027_playbooks.sql
-- ==========================================
-- ============================================================
-- 027 — EVENT PLAYBOOKS & TEMPLATES SYSTEM
-- Reusable event playbooks with tasks, budgets, vendors,
-- runsheet items, and checklist items.
-- ============================================================

-- ── 1. Event Playbooks ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_playbooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  -- tenant_id NULL = global system playbook (read-only for tenants)

  name          TEXT NOT NULL,
  description   TEXT,
  event_type    TEXT NOT NULL, -- wedding, conference, festival, corporate, etc.
  category      TEXT,          -- luxury, budget, outdoor, virtual, hybrid
  tags          TEXT[] DEFAULT '{}',

  -- Metadata
  estimated_budget_min   BIGINT,   -- INR, rough range
  estimated_budget_max   BIGINT,
  typical_guest_count    INT,
  typical_duration_days  INT DEFAULT 1,

  -- Template stats
  task_count        INT DEFAULT 0,
  checklist_count   INT DEFAULT 0,
  vendor_count      INT DEFAULT 0,
  budget_item_count INT DEFAULT 0,
  runsheet_count    INT DEFAULT 0,

  -- Usage
  times_applied INT DEFAULT 0,
  last_applied_at TIMESTAMPTZ,

  -- Display
  cover_emoji   TEXT DEFAULT '📋',
  color         TEXT DEFAULT '#6366f1',  -- hex color for UI

  is_system     BOOLEAN DEFAULT false,  -- true = global/Anthropic template
  is_active     BOOLEAN DEFAULT true,

  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Playbook Tasks ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,          -- setup, logistics, vendor, guest, finance, etc.
  priority        TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  responsible_role TEXT,         -- event_manager, coordinator, logistics, finance, etc.

  -- Timing (relative to event date, negative = before, positive = after)
  days_before_event  INT,        -- NULL = day of event
  time_of_day        TIME,       -- optional: time on that day

  estimated_hours NUMERIC(5,2),
  requires_approval BOOLEAN DEFAULT false,
  tags            TEXT[] DEFAULT '{}',

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Playbook Budget Items ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_budget_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  category        TEXT NOT NULL,    -- venue, catering, decor, av, photography, etc.
  name            TEXT NOT NULL,
  description     TEXT,

  -- Can be a fixed amount or a % of total event budget
  amount_type     TEXT DEFAULT 'percentage' CHECK (amount_type IN ('fixed','percentage','per_guest','per_day')),
  amount          NUMERIC(12,2),    -- INR for fixed, 0-100 for percentage, per-person/day rate

  is_mandatory    BOOLEAN DEFAULT false,
  notes           TEXT,

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Playbook Vendor Categories ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_vendor_requirements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  vendor_type     TEXT NOT NULL,   -- caterer, decorator, photographer, av, security, etc.
  name            TEXT NOT NULL,   -- e.g. "Main Caterer", "Backup Generator"
  description     TEXT,

  is_mandatory    BOOLEAN DEFAULT true,
  quantity_needed INT DEFAULT 1,

  -- Budget guidance
  budget_percentage NUMERIC(5,2),  -- % of total budget to allocate
  notes             TEXT,

  -- Booking timing
  days_before_event INT,           -- when to book by (relative to event)

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Playbook Checklist Items ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_checklist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,           -- planning, legal, logistics, day-of, post-event
  is_mandatory    BOOLEAN DEFAULT true,
  days_before_event INT,

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Playbook Runsheet Items ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_runsheet_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,

  -- Relative timing: hours before/after event start (negative = before)
  offset_hours    NUMERIC(6,2) DEFAULT 0,  -- -2.5 = 2.5 hours before event
  duration_minutes INT DEFAULT 30,

  responsible_role TEXT,
  location        TEXT,
  notes           TEXT,

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. Applied Playbooks (audit trail) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_playbook_applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id  UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE SET NULL,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  applied_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- What was applied
  tasks_created      INT DEFAULT 0,
  budget_items_created INT DEFAULT 0,
  vendors_created    INT DEFAULT 0,
  checklist_created  INT DEFAULT 0,
  runsheet_created   INT DEFAULT 0,

  applied_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_playbooks_tenant      ON event_playbooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_event_type  ON event_playbooks(event_type);
CREATE INDEX IF NOT EXISTS idx_playbooks_is_system   ON event_playbooks(is_system) WHERE is_system = true;

CREATE INDEX IF NOT EXISTS idx_playbook_tasks_pb     ON playbook_tasks(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_budget_pb    ON playbook_budget_items(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_vendor_pb    ON playbook_vendor_requirements(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_check_pb     ON playbook_checklist_items(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_run_pb       ON playbook_runsheet_items(playbook_id);
CREATE INDEX IF NOT EXISTS idx_pb_applications_event ON event_playbook_applications(event_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE event_playbooks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_budget_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_vendor_requirements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_checklist_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_runsheet_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_playbook_applications    ENABLE ROW LEVEL SECURITY;

-- Playbooks: tenant sees their own + system playbooks
CREATE POLICY "playbooks_tenant_or_system" ON event_playbooks FOR ALL
  USING (
    is_system = true
    OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- Child tables: access via playbook ownership
CREATE POLICY "pb_tasks_access"   ON playbook_tasks FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_budget_access"  ON playbook_budget_items FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_vendor_access"  ON playbook_vendor_requirements FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_check_access"   ON playbook_checklist_items FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_run_access"     ON playbook_runsheet_items FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_applications_tenant" ON event_playbook_applications FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_playbook_counts()
RETURNS TRIGGER AS $$
DECLARE v_pb_id UUID;
BEGIN
  v_pb_id := COALESCE(NEW.playbook_id, OLD.playbook_id);

  UPDATE event_playbooks SET
    task_count        = (SELECT COUNT(*) FROM playbook_tasks           WHERE playbook_id = v_pb_id),
    budget_item_count = (SELECT COUNT(*) FROM playbook_budget_items    WHERE playbook_id = v_pb_id),
    vendor_count      = (SELECT COUNT(*) FROM playbook_vendor_requirements WHERE playbook_id = v_pb_id),
    checklist_count   = (SELECT COUNT(*) FROM playbook_checklist_items WHERE playbook_id = v_pb_id),
    runsheet_count    = (SELECT COUNT(*) FROM playbook_runsheet_items  WHERE playbook_id = v_pb_id),
    updated_at = NOW()
  WHERE id = v_pb_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_pb_counts_tasks ON playbook_tasks;
CREATE TRIGGER trg_update_pb_counts_tasks
  AFTER INSERT OR DELETE ON playbook_tasks
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

DROP TRIGGER IF EXISTS trg_update_pb_counts_budget ON playbook_budget_items;
CREATE TRIGGER trg_update_pb_counts_budget
  AFTER INSERT OR DELETE ON playbook_budget_items
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

DROP TRIGGER IF EXISTS trg_update_pb_counts_vendor ON playbook_vendor_requirements;
CREATE TRIGGER trg_update_pb_counts_vendor
  AFTER INSERT OR DELETE ON playbook_vendor_requirements
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

DROP TRIGGER IF EXISTS trg_update_pb_counts_checklist ON playbook_checklist_items;
CREATE TRIGGER trg_update_pb_counts_checklist
  AFTER INSERT OR DELETE ON playbook_checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

DROP TRIGGER IF EXISTS trg_update_pb_counts_runsheet ON playbook_runsheet_items;
CREATE TRIGGER trg_update_pb_counts_runsheet
  AFTER INSERT OR DELETE ON playbook_runsheet_items
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

-- ── Seed: System Playbooks ───────────────────────────────────────────────────

INSERT INTO event_playbooks
  (name, description, event_type, category, tags, estimated_budget_min, estimated_budget_max,
   typical_guest_count, typical_duration_days, cover_emoji, color, is_system, is_active)
VALUES
  -- 1. Luxury Wedding
  ('Luxury Wedding', 'Full-service luxury wedding with complete vendor suite, 5-star hospitality, and immersive décor.',
   'wedding', 'luxury',
   ARRAY['wedding','luxury','premium','multicultural'],
   2000000, 15000000, 400, 2, '💍', '#ec4899', true, true),

  -- 2. Destination Wedding
  ('Destination Wedding', 'Outstation wedding with accommodation, travel logistics, and multi-day programming.',
   'wedding', 'destination',
   ARRAY['wedding','destination','travel','resort'],
   3000000, 20000000, 150, 4, '🌴', '#f97316', true, true),

  -- 3. Corporate Conference
  ('Corporate Conference', 'Multi-track professional conference with keynotes, breakout sessions, and networking.',
   'conference', 'corporate',
   ARRAY['conference','b2b','networking','tech'],
   500000, 5000000, 500, 2, '🎤', '#6366f1', true, true),

  -- 4. Product Launch
  ('Product Launch Event', 'High-impact product reveal with media, influencers, demo zones, and press kit.',
   'launch', 'corporate',
   ARRAY['launch','press','brand','experiential'],
   1000000, 8000000, 300, 1, '🚀', '#8b5cf6', true, true),

  -- 5. Music Festival
  ('Music Festival', 'Large-scale outdoor music festival with multiple stages, artist management, and crowd ops.',
   'festival', 'entertainment',
   ARRAY['festival','music','outdoor','large-scale'],
   5000000, 50000000, 5000, 3, '🎵', '#14b8a6', true, true),

  -- 6. Corporate Annual Day
  ('Corporate Annual Day / Gala', 'Awards ceremony, dinner, and entertainment for corporate teams and leadership.',
   'corporate', 'gala',
   ARRAY['corporate','awards','gala','formal'],
   800000, 4000000, 300, 1, '🏆', '#f59e0b', true, true),

  -- 7. Birthday Celebration
  ('Milestone Birthday Celebration', 'Premium birthday event — 50th, 60th, etc — with theme, catering, and entertainment.',
   'birthday', 'private',
   ARRAY['birthday','private','milestone','themed'],
   200000, 2000000, 100, 1, '🎂', '#ec4899', true, true),

  -- 8. Trade Exhibition
  ('Trade Exhibition / Expo', 'Multi-booth exhibition hall with exhibitor management, public access, and B2B matchmaking.',
   'exhibition', 'b2b',
   ARRAY['expo','trade','exhibition','b2b'],
   2000000, 20000000, 2000, 3, '🏛️', '#0ea5e9', true, true),

  -- 9. Virtual Conference
  ('Virtual Conference / Webinar Series', 'Fully online conference with live streaming, virtual networking, and on-demand recordings.',
   'virtual', 'digital',
   ARRAY['virtual','online','webinar','streaming'],
   100000, 1000000, 1000, 1, '💻', '#10b981', true, true),

  -- 10. Sports Tournament
  ('Sports Tournament', 'Multi-day sports competition with teams, officials, spectators, and media coverage.',
   'sports', 'competitive',
   ARRAY['sports','tournament','competition','outdoor'],
   500000, 10000000, 1000, 3, '🏆', '#ef4444', true, true)
ON CONFLICT DO NOTHING;

-- ── Seed: Tasks for Luxury Wedding ──────────────────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Luxury Wedding' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_tasks (playbook_id, title, category, priority, responsible_role, days_before_event, sort_order) VALUES
      (v_pb_id, 'Confirm venue contract and F&B minimums',           'venue',      'critical', 'event_manager',  90, 10),
      (v_pb_id, 'Finalise guest list and dietary requirements',       'guest',      'high',     'coordinator',    60, 20),
      (v_pb_id, 'Book photographer and videographer',                 'vendor',     'critical', 'event_manager',  90, 30),
      (v_pb_id, 'Confirm caterer menu and tasting session',           'catering',   'critical', 'event_manager',  60, 40),
      (v_pb_id, 'Book floral & décor vendor — sign contract',         'decor',      'high',     'coordinator',    60, 50),
      (v_pb_id, 'Book entertainment (DJ/band/performers)',            'vendor',     'high',     'coordinator',    45, 60),
      (v_pb_id, 'Send invitations (physical + digital)',              'guest',      'high',     'coordinator',    45, 70),
      (v_pb_id, 'Confirm AV / lighting / sound vendor',              'av',         'high',     'coordinator',    45, 80),
      (v_pb_id, 'Book makeup artists and hair stylists',             'vendor',     'medium',   'coordinator',    30, 90),
      (v_pb_id, 'Create final seating chart',                        'logistics',  'high',     'coordinator',    14, 100),
      (v_pb_id, 'Confirm final guest count with caterer',            'catering',   'critical', 'event_manager',  7,  110),
      (v_pb_id, 'Venue walkthrough and logistics briefing',          'logistics',  'high',     'event_manager',  3,  120),
      (v_pb_id, 'Brief all staff and vendors — final schedule share','staff',      'critical', 'event_manager',  1,  130),
      (v_pb_id, 'Set up décor and test AV — day before',             'setup',      'critical', 'logistics',      1,  140),
      (v_pb_id, 'Welcome guests and manage arrivals',                'guest',      'critical', 'coordinator',    0,  150),
      (v_pb_id, 'Coordinate ceremony runsheet in real time',         'operations', 'critical', 'event_manager',  0,  160),
      (v_pb_id, 'Post-event wrap — décor teardown and payments',     'logistics',  'high',     'coordinator',    NULL, 170),
      (v_pb_id, 'Send thank-you cards / emails to guests',           'guest',      'medium',   'coordinator',    NULL, 180);
  END IF;
END $$;

-- ── Seed: Tasks for Corporate Conference ────────────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Corporate Conference' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_tasks (playbook_id, title, category, priority, responsible_role, days_before_event, sort_order) VALUES
      (v_pb_id, 'Finalise conference theme and agenda structure',     'planning',   'critical', 'event_manager',  90, 10),
      (v_pb_id, 'Confirm venue — hall layout and breakout rooms',     'venue',      'critical', 'event_manager',  90, 20),
      (v_pb_id, 'Identify and confirm keynote speakers',              'speaker',    'critical', 'coordinator',    75, 30),
      (v_pb_id, 'Launch registration portal and early bird pricing',  'marketing',  'high',     'marketing',      75, 40),
      (v_pb_id, 'Finalise AV and streaming setup',                   'av',         'critical', 'logistics',      60, 50),
      (v_pb_id, 'Confirm sponsors and collect brand assets',          'finance',    'high',     'event_manager',  60, 60),
      (v_pb_id, 'Arrange catering — breaks, lunches, gala dinner',   'catering',   'high',     'coordinator',    45, 70),
      (v_pb_id, 'Print badges, brochures, and signage',              'logistics',  'medium',   'coordinator',    14, 80),
      (v_pb_id, 'Brief volunteers and registration desk staff',       'staff',      'high',     'event_manager',  3,  90),
      (v_pb_id, 'Test AV, internet, and app systems',                'av',         'critical', 'logistics',      1,  100),
      (v_pb_id, 'Open registration and manage check-in',             'guest',      'critical', 'coordinator',    0,  110),
      (v_pb_id, 'MC briefing and real-time session management',       'operations', 'critical', 'event_manager',  0,  120),
      (v_pb_id, 'Collect speaker recordings for post-conference',    'media',      'medium',   'coordinator',    NULL, 130),
      (v_pb_id, 'Send post-event survey to all attendees',           'feedback',   'medium',   'marketing',      NULL, 140);
  END IF;
END $$;

-- ── Seed: Budget Items for Luxury Wedding ────────────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Luxury Wedding' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_budget_items (playbook_id, category, name, amount_type, amount, is_mandatory, sort_order) VALUES
      (v_pb_id, 'venue',       'Venue Rental',              'percentage', 20, true,  10),
      (v_pb_id, 'catering',    'Food & Beverage',           'percentage', 30, true,  20),
      (v_pb_id, 'decor',       'Floral & Décor',            'percentage', 15, true,  30),
      (v_pb_id, 'photography', 'Photography & Videography', 'percentage', 8,  true,  40),
      (v_pb_id, 'av',          'AV, Lighting & Sound',      'percentage', 7,  true,  50),
      (v_pb_id, 'entertainment','Entertainment & Music',     'percentage', 6,  false, 60),
      (v_pb_id, 'hospitality', 'Guest Hospitality & Gifts', 'percentage', 4,  false, 70),
      (v_pb_id, 'staffing',    'Event Staff & Coordinators','percentage', 4,  true,  80),
      (v_pb_id, 'transport',   'Guest Transportation',      'percentage', 3,  false, 90),
      (v_pb_id, 'contingency', 'Contingency Reserve',       'percentage', 3,  true,  100);
  END IF;
END $$;

-- ── Seed: Vendor Requirements for Luxury Wedding ─────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Luxury Wedding' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_vendor_requirements (playbook_id, vendor_type, name, is_mandatory, quantity_needed, budget_percentage, days_before_event, sort_order) VALUES
      (v_pb_id, 'caterer',       'Main Caterer',           true,  1, 30, 90,  10),
      (v_pb_id, 'decorator',     'Floral & Décor Vendor',  true,  1, 15, 90,  20),
      (v_pb_id, 'photographer',  'Wedding Photographer',   true,  1, 5,  90,  30),
      (v_pb_id, 'videographer',  'Wedding Videographer',   true,  1, 3,  90,  40),
      (v_pb_id, 'av',            'AV & Sound System',      true,  1, 7,  60,  50),
      (v_pb_id, 'lighting',      'Lighting Vendor',        true,  1, 4,  60,  60),
      (v_pb_id, 'entertainment', 'Live Band or DJ',         false, 1, 6,  45,  70),
      (v_pb_id, 'makeup',        'Bridal Makeup Artist',   true,  1, 2,  30,  80),
      (v_pb_id, 'security',      'Security Team',          true,  1, 2,  14,  90),
      (v_pb_id, 'transport',     'Guest Shuttle Service',  false, 1, 3,  30,  100);
  END IF;
END $$;

-- ── Seed: Checklist for Luxury Wedding ──────────────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Luxury Wedding' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_checklist_items (playbook_id, title, category, is_mandatory, days_before_event, sort_order) VALUES
      (v_pb_id, 'Venue contract signed and deposit paid',           'legal',      true,  90, 10),
      (v_pb_id, 'All vendor contracts signed',                      'legal',      true,  60, 20),
      (v_pb_id, 'Food license / FSSAI permit obtained',             'legal',      true,  45, 30),
      (v_pb_id, 'Liquor permit obtained (if applicable)',           'legal',      false, 45, 40),
      (v_pb_id, 'Noise permit obtained from local authority',       'legal',      false, 30, 50),
      (v_pb_id, 'Fire safety NOC from venue',                      'safety',     true,  30, 60),
      (v_pb_id, 'Insurance policy activated for event',            'finance',    true,  30, 70),
      (v_pb_id, 'Final headcount confirmed with caterer',          'operations', true,  7,  80),
      (v_pb_id, 'Emergency contact list distributed to all staff', 'safety',     true,  3,  90),
      (v_pb_id, 'Venue walkthrough completed',                     'operations', true,  3,  100),
      (v_pb_id, 'All vendor final payments processed',             'finance',    true,  NULL, 110),
      (v_pb_id, 'Post-event feedback collected from couple',       'quality',    false, NULL, 120);
  END IF;
END $$;

-- ── Seed: Runsheet items for Corporate Conference ────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Corporate Conference' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_runsheet_items (playbook_id, title, category, offset_hours, duration_minutes, responsible_role, sort_order) VALUES
      (v_pb_id, 'AV and tech setup & test',          'setup',      -4,    120, 'logistics',      10),
      (v_pb_id, 'Registration desk opens',           'guest',      -1,    60,  'coordinator',    20),
      (v_pb_id, 'Networking breakfast / tea',        'catering',   -0.5,  30,  'catering',       30),
      (v_pb_id, 'Welcome address by host',           'program',    0,     15,  'event_manager',  40),
      (v_pb_id, 'Keynote 1',                        'program',    0.25,  60,  'speaker',        50),
      (v_pb_id, 'Q&A — Keynote 1',                  'program',    1.25,  15,  'event_manager',  60),
      (v_pb_id, 'Coffee break / networking',         'catering',   1.5,   20,  'catering',       70),
      (v_pb_id, 'Panel Discussion',                  'program',    1.83,  60,  'event_manager',  80),
      (v_pb_id, 'Lunch break',                      'catering',   3,     60,  'catering',       90),
      (v_pb_id, 'Breakout sessions (parallel)',      'program',    4,     90,  'coordinator',    100),
      (v_pb_id, 'Afternoon tea / networking',        'catering',   5.5,   20,  'catering',       110),
      (v_pb_id, 'Keynote 2 / Closing session',       'program',    5.83,  45,  'speaker',        120),
      (v_pb_id, 'Awards / Recognition ceremony',     'program',    6.5,   30,  'event_manager',  130),
      (v_pb_id, 'Cocktails & networking close',      'networking', 7,     90,  'coordinator',    140),
      (v_pb_id, 'Vendor teardown and venue check-out','teardown',  8.5,   60,  'logistics',      150);
  END IF;
END $$;


-- ==========================================
-- Migration: 028_documents.sql
-- ==========================================
-- ============================================================
-- 028_documents.sql  —  Document Generation System
-- ============================================================
-- Covers: proposals, contracts, invoices, run-of-show PDFs,
-- BEOs (Banquet Event Orders), vendor agreements, letters.
-- Each document has a type, template, version history, and
-- optional e-signature workflow.
-- ============================================================

-- ── Document templates ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'proposal', 'contract', 'invoice', 'beo', 'run_of_show',
    'vendor_agreement', 'letter', 'quote', 'nda', 'custom'
  )),
  description   TEXT,
  -- Template content stored as structured JSON blocks
  content       JSONB NOT NULL DEFAULT '[]',
  -- CSS / branding overrides
  styles        JSONB NOT NULL DEFAULT '{}',
  -- Variable schema: list of {key, label, type, required}
  variables     JSONB NOT NULL DEFAULT '[]',
  is_system     BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  version       INTEGER NOT NULL DEFAULT 1,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_templates_tenant    ON document_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_doc_templates_type      ON document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_doc_templates_system    ON document_templates(is_system) WHERE is_system = true;

-- ── Generated documents ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id      UUID REFERENCES document_templates(id),
  -- Context references (at least one should be set)
  event_id         UUID REFERENCES events(id) ON DELETE SET NULL,
  client_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  vendor_id        UUID REFERENCES vendors(id) ON DELETE SET NULL,
  -- Document metadata
  name             TEXT NOT NULL,
  document_type    TEXT NOT NULL CHECK (document_type IN (
    'proposal', 'contract', 'invoice', 'beo', 'run_of_show',
    'vendor_agreement', 'letter', 'quote', 'nda', 'custom'
  )),
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'review', 'sent', 'viewed', 'signed', 'approved',
    'rejected', 'expired', 'archived'
  )),
  version          INTEGER NOT NULL DEFAULT 1,
  -- Rendered content (merged template + variables)
  content          JSONB NOT NULL DEFAULT '[]',
  -- Variable values used to render this document
  variable_values  JSONB NOT NULL DEFAULT '{}',
  -- Rendered PDF stored in Supabase Storage
  pdf_path         TEXT,
  pdf_url          TEXT,
  pdf_size_bytes   INTEGER,
  -- Sharing
  share_token      TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  share_expires_at TIMESTAMPTZ,
  -- E-signature
  requires_signature BOOLEAN NOT NULL DEFAULT false,
  signed_at        TIMESTAMPTZ,
  signed_by_name   TEXT,
  signed_by_email  TEXT,
  signature_data   JSONB,          -- base64 signature image + metadata
  -- Financial (for invoices / quotes)
  subtotal         NUMERIC(14, 2),
  tax_amount       NUMERIC(14, 2),
  discount_amount  NUMERIC(14, 2),
  total_amount     NUMERIC(14, 2),
  currency         TEXT NOT NULL DEFAULT 'INR',
  due_date         DATE,
  -- Tracking
  sent_at          TIMESTAMPTZ,
  viewed_at        TIMESTAMPTZ,
  view_count       INTEGER NOT NULL DEFAULT 0,
  last_viewed_ip   TEXT,
  notes            TEXT,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant      ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_event       ON documents(event_id);
CREATE INDEX IF NOT EXISTS idx_documents_client      ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_type        ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status      ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_share_token ON documents(share_token);

-- ── Document version history ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  content       JSONB NOT NULL DEFAULT '[]',
  variable_values JSONB NOT NULL DEFAULT '{}',
  pdf_path      TEXT,
  change_note   TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON document_versions(document_id);

-- ── Document activities / audit log ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_activities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  action       TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'sent', 'viewed', 'downloaded',
    'signed', 'approved', 'rejected', 'expired', 'archived',
    'comment_added', 'version_created', 'pdf_generated'
  )),
  actor_id     UUID REFERENCES profiles(id),
  actor_name   TEXT,
  actor_email  TEXT,
  ip_address   TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_activities_document ON document_activities(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_activities_created  ON document_activities(created_at DESC);

-- ── Document line items (for invoices / quotes) ───────────────────────────────

CREATE TABLE IF NOT EXISTS document_line_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  description  TEXT NOT NULL,
  quantity     NUMERIC(10, 3) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_rate     NUMERIC(5, 2) NOT NULL DEFAULT 18,   -- GST default
  line_total   NUMERIC(14, 2) GENERATED ALWAYS AS (
    ROUND(quantity * unit_price * (1 - discount_pct / 100) * (1 + tax_rate / 100), 2)
  ) STORED,
  category     TEXT,
  notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_doc_line_items_document ON document_line_items(document_id);

-- ── Triggers ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();

DROP TRIGGER IF EXISTS trg_doc_templates_updated_at ON document_templates;
CREATE TRIGGER trg_doc_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();

-- Auto-log creation activity
CREATE OR REPLACE FUNCTION log_document_created()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO document_activities (document_id, action, actor_id, created_at)
  VALUES (NEW.id, 'created', NEW.created_by, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_log_created ON documents;
CREATE TRIGGER trg_document_log_created
  AFTER INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION log_document_created();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_line_items ENABLE ROW LEVEL SECURITY;

-- Templates: system templates visible to all, tenant templates to own tenant
CREATE POLICY "templates_tenant_access" ON document_templates
  FOR ALL USING (
    is_system = true
    OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- Documents: tenant-scoped
CREATE POLICY "documents_tenant_access" ON documents
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- Versions: accessible if parent document accessible
CREATE POLICY "doc_versions_tenant_access" ON document_versions
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Activities: accessible if parent document accessible
CREATE POLICY "doc_activities_tenant_access" ON document_activities
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Line items: accessible if parent document accessible
CREATE POLICY "doc_line_items_tenant_access" ON document_line_items
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Public share token access (unauthenticated)
CREATE POLICY "documents_public_share" ON documents
  FOR SELECT USING (
    share_token IS NOT NULL
    AND (share_expires_at IS NULL OR share_expires_at > now())
  );

-- ── System templates seed ─────────────────────────────────────────────────────

INSERT INTO document_templates (name, document_type, description, is_system, variables, content) VALUES

('Event Proposal', 'proposal',
 'Professional event proposal with cover page, scope, timeline, and investment summary',
 true,
 '[
   {"key":"client_name","label":"Client Name","type":"text","required":true},
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"event_venue","label":"Venue","type":"text","required":false},
   {"key":"guest_count","label":"Guest Count","type":"number","required":false},
   {"key":"company_name","label":"Our Company Name","type":"text","required":true},
   {"key":"valid_until","label":"Proposal Valid Until","type":"date","required":false},
   {"key":"total_investment","label":"Total Investment","type":"currency","required":false}
 ]',
 '[
   {"type":"cover","title":"{{event_name}}","subtitle":"Prepared for {{client_name}}","date":"{{event_date}}"},
   {"type":"heading","text":"Executive Summary"},
   {"type":"paragraph","text":"Dear {{client_name}},\n\nThank you for considering {{company_name}} for your upcoming event. We are delighted to present this proposal for {{event_name}}."},
   {"type":"heading","text":"Event Overview"},
   {"type":"key_value","items":[
     {"label":"Event Name","value":"{{event_name}}"},
     {"label":"Event Date","value":"{{event_date}}"},
     {"label":"Venue","value":"{{event_venue}}"},
     {"label":"Expected Guests","value":"{{guest_count}}"}
   ]},
   {"type":"heading","text":"Our Services"},
   {"type":"paragraph","text":"[Describe the services included in this proposal]"},
   {"type":"heading","text":"Investment Summary"},
   {"type":"line_items"},
   {"type":"total_block"},
   {"type":"heading","text":"Terms & Conditions"},
   {"type":"paragraph","text":"This proposal is valid until {{valid_until}}. A 50% advance is required to confirm booking."},
   {"type":"signature_block","label":"Client Acceptance"}
 ]'),

('Service Contract', 'contract',
 'Comprehensive event services contract with payment schedule and cancellation policy',
 true,
 '[
   {"key":"client_name","label":"Client Name","type":"text","required":true},
   {"key":"client_address","label":"Client Address","type":"text","required":true},
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"event_venue","label":"Venue","type":"text","required":true},
   {"key":"company_name","label":"Company Name","type":"text","required":true},
   {"key":"contract_date","label":"Contract Date","type":"date","required":true},
   {"key":"total_value","label":"Total Contract Value","type":"currency","required":true},
   {"key":"advance_amount","label":"Advance Amount","type":"currency","required":true},
   {"key":"balance_due_date","label":"Balance Due Date","type":"date","required":true}
 ]',
 '[
   {"type":"heading","text":"EVENT SERVICES AGREEMENT"},
   {"type":"paragraph","text":"This Agreement is entered into on {{contract_date}} between {{company_name}} (\"Service Provider\") and {{client_name}} of {{client_address}} (\"Client\")."},
   {"type":"heading","text":"1. Event Details"},
   {"type":"key_value","items":[
     {"label":"Event","value":"{{event_name}}"},
     {"label":"Date","value":"{{event_date}}"},
     {"label":"Venue","value":"{{event_venue}}"}
   ]},
   {"type":"heading","text":"2. Services"},
   {"type":"line_items"},
   {"type":"heading","text":"3. Payment Schedule"},
   {"type":"paragraph","text":"Total Contract Value: {{total_value}}\nAdvance (due on signing): {{advance_amount}}\nBalance due: {{balance_due_date}}"},
   {"type":"heading","text":"4. Cancellation Policy"},
   {"type":"paragraph","text":"Cancellations made more than 90 days prior: 25% of advance forfeited.\nCancellations made 30-90 days prior: 50% of advance forfeited.\nCancellations made less than 30 days prior: 100% of advance forfeited."},
   {"type":"heading","text":"5. Force Majeure"},
   {"type":"paragraph","text":"Neither party shall be liable for delays or failures due to circumstances beyond reasonable control."},
   {"type":"dual_signature","party_a":"{{company_name}}","party_b":"{{client_name}}"}
 ]'),

('Tax Invoice', 'invoice',
 'GST-compliant tax invoice with line items, CGST/SGST/IGST breakdown',
 true,
 '[
   {"key":"invoice_number","label":"Invoice Number","type":"text","required":true},
   {"key":"invoice_date","label":"Invoice Date","type":"date","required":true},
   {"key":"due_date","label":"Due Date","type":"date","required":true},
   {"key":"client_name","label":"Client Name","type":"text","required":true},
   {"key":"client_gstin","label":"Client GSTIN","type":"text","required":false},
   {"key":"client_address","label":"Client Address","type":"text","required":true},
   {"key":"company_name","label":"Company Name","type":"text","required":true},
   {"key":"company_gstin","label":"Company GSTIN","type":"text","required":true},
   {"key":"event_name","label":"Event / Reference","type":"text","required":false}
 ]',
 '[
   {"type":"invoice_header","title":"TAX INVOICE"},
   {"type":"invoice_parties","bill_to":"{{client_name}}\n{{client_address}}\nGSTIN: {{client_gstin}}","company":"{{company_name}}\nGSTIN: {{company_gstin}}"},
   {"type":"invoice_meta","items":[
     {"label":"Invoice No.","value":"{{invoice_number}}"},
     {"label":"Invoice Date","value":"{{invoice_date}}"},
     {"label":"Due Date","value":"{{due_date}}"},
     {"label":"Reference","value":"{{event_name}}"}
   ]},
   {"type":"line_items","show_tax":true},
   {"type":"tax_summary","gst_type":"igst"},
   {"type":"total_block","currency":"INR"},
   {"type":"bank_details"},
   {"type":"paragraph","text":"Please transfer the amount to our bank account. Quote invoice number in transfer reference."}
 ]'),

('Banquet Event Order (BEO)', 'beo',
 'Detailed operational BEO covering setup, F&B, AV, staffing requirements',
 true,
 '[
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"setup_time","label":"Setup Time","type":"text","required":true},
   {"key":"start_time","label":"Start Time","type":"text","required":true},
   {"key":"end_time","label":"End Time","type":"text","required":true},
   {"key":"venue_name","label":"Venue / Room","type":"text","required":true},
   {"key":"guest_count","label":"Pax Count","type":"number","required":true},
   {"key":"client_name","label":"Client Name","type":"text","required":true},
   {"key":"account_manager","label":"Account Manager","type":"text","required":true}
 ]',
 '[
   {"type":"heading","text":"BANQUET EVENT ORDER"},
   {"type":"key_value","cols":2,"items":[
     {"label":"Event","value":"{{event_name}}"},
     {"label":"Client","value":"{{client_name}}"},
     {"label":"Date","value":"{{event_date}}"},
     {"label":"Venue / Room","value":"{{venue_name}}"},
     {"label":"Setup Time","value":"{{setup_time}}"},
     {"label":"Start Time","value":"{{start_time}}"},
     {"label":"End Time","value":"{{end_time}}"},
     {"label":"Pax","value":"{{guest_count}}"},
     {"label":"Account Manager","value":"{{account_manager}}"}
   ]},
   {"type":"section_heading","text":"Room Setup"},
   {"type":"checklist_table","headers":["Item","Qty","Notes"]},
   {"type":"section_heading","text":"Food & Beverage"},
   {"type":"menu_block"},
   {"type":"section_heading","text":"Audio-Visual Requirements"},
   {"type":"checklist_table","headers":["Equipment","Qty","Provider"]},
   {"type":"section_heading","text":"Staffing"},
   {"type":"checklist_table","headers":["Role","Count","Reporting Time"]},
   {"type":"section_heading","text":"Special Requirements"},
   {"type":"notes_block"},
   {"type":"approval_row","label":"Approved by"}
 ]'),

('Run of Show', 'run_of_show',
 'Minute-by-minute event run sheet with cues, responsibilities, and timing',
 true,
 '[
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"venue_name","label":"Venue","type":"text","required":true},
   {"key":"event_director","label":"Event Director","type":"text","required":true},
   {"key":"technical_director","label":"Technical Director","type":"text","required":false}
 ]',
 '[
   {"type":"heading","text":"RUN OF SHOW — {{event_name}}"},
   {"type":"key_value","items":[
     {"label":"Date","value":"{{event_date}}"},
     {"label":"Venue","value":"{{venue_name}}"},
     {"label":"Event Director","value":"{{event_director}}"},
     {"label":"Technical Director","value":"{{technical_director}}"}
   ]},
   {"type":"runsheet_table","headers":["Time","Duration","Item","Responsible","AV Cue","Notes"]},
   {"type":"paragraph","text":"All times are approximate. Event Director has authority to adjust timing on the day."}
 ]'),

('Vendor Agreement', 'vendor_agreement',
 'Standard vendor service agreement with deliverables, payment terms, and liability clauses',
 true,
 '[
   {"key":"vendor_name","label":"Vendor Name","type":"text","required":true},
   {"key":"vendor_service","label":"Service Type","type":"text","required":true},
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"company_name","label":"Our Company Name","type":"text","required":true},
   {"key":"total_fee","label":"Total Fee","type":"currency","required":true},
   {"key":"advance_pct","label":"Advance %","type":"number","required":true}
 ]',
 '[
   {"type":"heading","text":"VENDOR SERVICE AGREEMENT"},
   {"type":"paragraph","text":"This agreement is between {{company_name}} (\"Client\") and {{vendor_name}} (\"Vendor\") for {{vendor_service}} services at {{event_name}} on {{event_date}}."},
   {"type":"heading","text":"1. Scope of Services"},
   {"type":"line_items"},
   {"type":"heading","text":"2. Compensation"},
   {"type":"paragraph","text":"Total Fee: {{total_fee}}\nAdvance ({{advance_pct}}%) due on signing. Balance due on day of event."},
   {"type":"heading","text":"3. Vendor Obligations"},
   {"type":"paragraph","text":"Vendor agrees to arrive no later than the time specified, bring all required equipment, and maintain professional conduct throughout."},
   {"type":"heading","text":"4. Cancellation"},
   {"type":"paragraph","text":"Cancellation by Client with less than 14 days notice: 50% of total fee payable. Cancellation by Vendor: full advance to be refunded within 7 days."},
   {"type":"dual_signature","party_a":"{{company_name}}","party_b":"{{vendor_name}}"}
 ]')

ON CONFLICT DO NOTHING;


-- ==========================================
-- Migration: 029_rbac.sql
-- ==========================================
-- ============================================================
-- 029_rbac.sql  —  Advanced RBAC & Permissions System
-- ============================================================
-- Architecture:
--   roles       → named roles scoped to a tenant
--   permissions → granular capability flags (resource:action)
--   role_permissions → many-to-many: role has permissions
--   profile_roles   → many-to-many: user has roles (per tenant)
--   resource_acls   → per-resource overrides (event-level access)
-- ============================================================

-- ── Permission catalogue ───────────────────────────────────────────────────────
-- Exhaustive list of all capabilities in the system.

CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource    TEXT NOT NULL,   -- e.g. 'events', 'finance', 'guests'
  action      TEXT NOT NULL,   -- e.g. 'view', 'create', 'edit', 'delete', 'export'
  code        TEXT NOT NULL UNIQUE,  -- 'events:create'
  description TEXT,
  category    TEXT,            -- ui grouping
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resource, action)
);

CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_code     ON permissions(code);

-- ── Roles ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = system role
  name        TEXT NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  priority    INTEGER NOT NULL DEFAULT 0,  -- higher = more powerful; used for UI ordering
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant  ON roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_system  ON roles(is_system) WHERE is_system = true;

-- ── Role ↔ Permission ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by    UUID REFERENCES profiles(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission_id);

-- ── Profile ↔ Role (tenant-scoped) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profile_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES profiles(id),
  expires_at  TIMESTAMPTZ,   -- optional time-limited role grant
  UNIQUE (profile_id, role_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_roles_profile ON profile_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_role    ON profile_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_tenant  ON profile_roles(tenant_id);

-- ── Resource ACLs (per-object overrides) ─────────────────────────────────────
-- Allows granting/revoking access to specific resources
-- e.g. a team member can view a particular event they wouldn't normally see.

CREATE TABLE IF NOT EXISTS resource_acls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,   -- 'event', 'client', 'vendor', etc.
  resource_id   UUID NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  is_grant      BOOLEAN NOT NULL DEFAULT true,  -- true = grant, false = deny
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES profiles(id),
  UNIQUE (profile_id, resource_type, resource_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_acls_profile  ON resource_acls(profile_id);
CREATE INDEX IF NOT EXISTS idx_resource_acls_resource ON resource_acls(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_acls_tenant   ON resource_acls(tenant_id);

-- ── RBAC audit log ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rbac_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE SET NULL,
  actor_id    UUID REFERENCES profiles(id),
  action      TEXT NOT NULL CHECK (action IN (
    'role_created', 'role_updated', 'role_deleted',
    'permission_granted', 'permission_revoked',
    'role_assigned', 'role_revoked',
    'acl_granted', 'acl_revoked'
  )),
  target_type TEXT,   -- 'role', 'profile', 'permission'
  target_id   UUID,
  metadata    JSONB DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rbac_audit_tenant  ON rbac_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_actor   ON rbac_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_created ON rbac_audit_log(created_at DESC);

-- ── Helper function: check if profile has permission ─────────────────────────

CREATE OR REPLACE FUNCTION profile_has_permission(
  p_profile_id  UUID,
  p_permission  TEXT   -- permission code, e.g. 'events:create'
) RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM profile_roles pr
    JOIN role_permissions rp ON rp.role_id = pr.role_id
    JOIN permissions p        ON p.id = rp.permission_id
    WHERE pr.profile_id = p_profile_id
      AND p.code = p_permission
      AND (pr.expires_at IS NULL OR pr.expires_at > now())
  ) INTO has_perm;
  RETURN has_perm;
END;
$$;

-- ── Helper: get all permissions for a profile ─────────────────────────────────

CREATE OR REPLACE FUNCTION get_profile_permissions(p_profile_id UUID)
RETURNS TABLE(code TEXT, resource TEXT, action TEXT, category TEXT) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
    SELECT DISTINCT p.code, p.resource, p.action, p.category
    FROM profile_roles pr
    JOIN role_permissions rp ON rp.role_id = pr.role_id
    JOIN permissions p        ON p.id = rp.permission_id
    WHERE pr.profile_id = p_profile_id
      AND (pr.expires_at IS NULL OR pr.expires_at > now())
    ORDER BY p.resource, p.action;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE permissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_roles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_acls   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_audit_log  ENABLE ROW LEVEL SECURITY;

-- Permissions: read-only to all authenticated
CREATE POLICY "permissions_read_all" ON permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- Roles: system roles visible to all; tenant roles to own tenant
CREATE POLICY "roles_tenant_access" ON roles FOR ALL USING (
  is_system = true
  OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Role permissions: visible if role is accessible
CREATE POLICY "role_perms_tenant_access" ON role_permissions FOR ALL USING (
  role_id IN (
    SELECT id FROM roles
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  )
);

-- Profile roles: own records + admins in same tenant
CREATE POLICY "profile_roles_own_and_admin" ON profile_roles FOR ALL USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Resource ACLs: tenant-scoped
CREATE POLICY "resource_acls_tenant" ON resource_acls FOR ALL USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Audit log: tenant-scoped
CREATE POLICY "rbac_audit_tenant" ON rbac_audit_log FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- ── Permissions seed — full catalogue ─────────────────────────────────────────

INSERT INTO permissions (resource, action, code, description, category) VALUES
-- Events
('events','view',          'events:view',           'View events list and details',              'Events'),
('events','create',        'events:create',          'Create new events',                         'Events'),
('events','edit',          'events:edit',            'Edit event details',                        'Events'),
('events','delete',        'events:delete',          'Delete events',                             'Events'),
('events','export',        'events:export',          'Export events data',                        'Events'),
('events','publish',       'events:publish',         'Publish event microsite',                   'Events'),
-- CRM
('crm','view',             'crm:view',               'View CRM contacts and deals',               'CRM'),
('crm','create',           'crm:create',             'Create CRM contacts, leads, deals',         'CRM'),
('crm','edit',             'crm:edit',               'Edit CRM records',                          'CRM'),
('crm','delete',           'crm:delete',             'Delete CRM records',                        'CRM'),
('crm','export',           'crm:export',             'Export CRM data',                           'CRM'),
('crm','bulk_assign',      'crm:bulk_assign',        'Bulk assign contacts to team members',      'CRM'),
-- Finance
('finance','view',         'finance:view',           'View invoices, budgets, P&L',               'Finance'),
('finance','create',       'finance:create',         'Create invoices and budget items',          'Finance'),
('finance','edit',         'finance:edit',           'Edit financial records',                    'Finance'),
('finance','delete',       'finance:delete',         'Delete financial records',                  'Finance'),
('finance','approve',      'finance:approve',        'Approve purchase orders and expenses',      'Finance'),
('finance','export',       'finance:export',         'Export financial data and reports',         'Finance'),
('finance','view_margins', 'finance:view_margins',   'View profit margins and sensitive data',    'Finance'),
-- Vendors
('vendors','view',         'vendors:view',           'View vendor profiles',                      'Vendors'),
('vendors','create',       'vendors:create',         'Add new vendors',                           'Vendors'),
('vendors','edit',         'vendors:edit',           'Edit vendor details',                       'Vendors'),
('vendors','delete',       'vendors:delete',         'Delete vendors',                            'Vendors'),
('vendors','contract',     'vendors:contract',       'Create and sign vendor contracts',          'Vendors'),
-- Guests
('guests','view',          'guests:view',            'View guest lists',                          'Guests'),
('guests','create',        'guests:create',          'Add guests',                                'Guests'),
('guests','edit',          'guests:edit',            'Edit guest records',                        'Guests'),
('guests','delete',        'guests:delete',          'Delete guests',                             'Guests'),
('guests','checkin',       'guests:checkin',         'Perform guest check-in',                    'Guests'),
('guests','export',        'guests:export',          'Export guest lists',                        'Guests'),
-- Team
('team','view',            'team:view',              'View team members',                         'Team'),
('team','invite',          'team:invite',            'Invite new team members',                   'Team'),
('team','edit',            'team:edit',              'Edit team member roles',                    'Team'),
('team','remove',          'team:remove',            'Remove team members',                       'Team'),
-- Production
('production','view',      'production:view',        'View production plans and tasks',           'Production'),
('production','create',    'production:create',      'Create production items',                   'Production'),
('production','edit',      'production:edit',        'Edit production records',                   'Production'),
('production','delete',    'production:delete',      'Delete production records',                 'Production'),
-- Artists
('artists','view',         'artists:view',           'View artist roster',                        'Artists'),
('artists','create',       'artists:create',         'Add artists',                               'Artists'),
('artists','edit',         'artists:edit',           'Edit artist records',                       'Artists'),
('artists','book',         'artists:book',           'Book and contract artists',                 'Artists'),
-- Inventory
('inventory','view',       'inventory:view',         'View inventory',                            'Inventory'),
('inventory','create',     'inventory:create',       'Add inventory items',                       'Inventory'),
('inventory','edit',       'inventory:edit',         'Edit inventory',                            'Inventory'),
('inventory','delete',     'inventory:delete',       'Delete inventory items',                    'Inventory'),
('inventory','allocate',   'inventory:allocate',     'Allocate inventory to events',              'Inventory'),
-- Analytics
('analytics','view',       'analytics:view',         'View analytics dashboards',                 'Analytics'),
('analytics','export',     'analytics:export',       'Export analytics data',                     'Analytics'),
('analytics','view_revenue','analytics:view_revenue','View revenue analytics',                    'Analytics'),
-- Documents
('documents','view',       'documents:view',         'View documents',                            'Documents'),
('documents','create',     'documents:create',       'Create documents',                          'Documents'),
('documents','edit',       'documents:edit',         'Edit documents',                            'Documents'),
('documents','delete',     'documents:delete',       'Delete documents',                          'Documents'),
('documents','send',       'documents:send',         'Send documents to clients',                 'Documents'),
('documents','sign',       'documents:sign',         'Sign documents',                            'Documents'),
-- Playbooks
('playbooks','view',       'playbooks:view',         'View playbooks',                            'Playbooks'),
('playbooks','create',     'playbooks:create',       'Create custom playbooks',                   'Playbooks'),
('playbooks','edit',       'playbooks:edit',         'Edit playbooks',                            'Playbooks'),
('playbooks','apply',      'playbooks:apply',        'Apply playbooks to events',                 'Playbooks'),
-- Integrations
('integrations','view',    'integrations:view',      'View integrations',                         'Integrations'),
('integrations','manage',  'integrations:manage',    'Manage API keys and webhooks',              'Integrations'),
-- Settings
('settings','view',        'settings:view',          'View company settings',                     'Settings'),
('settings','edit',        'settings:edit',          'Edit company settings',                     'Settings'),
('settings','billing',     'settings:billing',       'Manage billing and subscription',           'Settings'),
-- RBAC
('rbac','view',            'rbac:view',              'View roles and permissions',                'RBAC'),
('rbac','manage',          'rbac:manage',            'Create and assign roles',                   'RBAC'),
-- Command Center
('command_center','view',  'command_center:view',    'View command center',                       'Command Center'),
('command_center','manage','command_center:manage',  'Manage incidents and alerts',               'Command Center'),
-- Super Admin (tenant-level)
('tenant','manage',        'tenant:manage',          'Full tenant administration',                'Admin'),
('tenant','view_all',      'tenant:view_all',        'View all tenant data',                      'Admin')

ON CONFLICT (resource, action) DO NOTHING;

-- ── System roles seed ─────────────────────────────────────────────────────────

INSERT INTO roles (id, name, description, is_system, color, priority) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Super Admin',       'Full access to everything',                          true, '#ef4444', 100),
  ('00000000-0000-0000-0000-000000000002', 'Company Admin',     'Admin access to all company features',               true, '#f97316', 90),
  ('00000000-0000-0000-0000-000000000003', 'Event Manager',     'Full control over assigned events',                  true, '#6366f1', 70),
  ('00000000-0000-0000-0000-000000000004', 'Senior Coordinator','Manage events, vendors, guests; no finance delete',  true, '#8b5cf6', 60),
  ('00000000-0000-0000-0000-000000000005', 'Operations Staff',  'Day-of operations and check-in',                     true, '#0ea5e9', 50),
  ('00000000-0000-0000-0000-000000000006', 'Finance Manager',   'Full finance access, limited other access',          true, '#10b981', 60),
  ('00000000-0000-0000-0000-000000000007', 'Sales Executive',   'CRM, proposals, client communication',               true, '#f59e0b', 50),
  ('00000000-0000-0000-0000-000000000008', 'Vendor Manager',    'Vendor contracts, artist booking',                   true, '#ec4899', 50),
  ('00000000-0000-0000-0000-000000000009', 'View Only',         'Read-only access across the platform',               true, '#64748b', 10)

ON CONFLICT (id) DO NOTHING;

-- Grant all permissions to Super Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT DO NOTHING;

-- Grant all permissions to Company Admin (except super admin flags)
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
WHERE code NOT IN ('settings:billing', 'rbac:manage', 'tenant:manage')
ON CONFLICT DO NOTHING;

-- Event Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions
WHERE resource IN ('events','crm','guests','vendors','production','artists','inventory','documents','playbooks')
   OR code IN ('analytics:view','command_center:view','settings:view')
ON CONFLICT DO NOTHING;

-- Senior Coordinator
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', id FROM permissions
WHERE (resource IN ('events','guests','vendors','production','inventory','documents')
      AND action != 'delete')
   OR code IN ('crm:view','crm:edit','finance:view','analytics:view','settings:view')
ON CONFLICT DO NOTHING;

-- Operations Staff
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000005', id FROM permissions
WHERE code IN (
  'events:view','guests:view','guests:checkin','vendors:view',
  'production:view','production:edit','inventory:view','inventory:allocate',
  'command_center:view','settings:view'
)
ON CONFLICT DO NOTHING;

-- Finance Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000006', id FROM permissions
WHERE resource IN ('finance','documents')
   OR code IN (
     'events:view','crm:view','vendors:view','analytics:view',
     'analytics:view_revenue','settings:view'
   )
ON CONFLICT DO NOTHING;

-- Sales Executive
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000007', id FROM permissions
WHERE resource IN ('crm','documents')
   OR code IN (
     'events:view','events:create','playbooks:view','playbooks:apply',
     'analytics:view','settings:view'
   )
ON CONFLICT DO NOTHING;

-- Vendor Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000008', id FROM permissions
WHERE resource IN ('vendors','artists')
   OR code IN (
     'events:view','production:view','inventory:view','inventory:allocate',
     'documents:view','documents:create','documents:send','settings:view'
   )
ON CONFLICT DO NOTHING;

-- View Only — all :view permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000009', id FROM permissions
WHERE action = 'view'
ON CONFLICT DO NOTHING;


-- ==========================================
-- Migration: 030_guest_management_expansion.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Guest Management Expansion (Migration 030)
-- Covers: invitations, RSVP, accommodation, import batches
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── INVITATION SYSTEM ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invitation_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  is_global       BOOLEAN DEFAULT FALSE,     -- saved as reusable template across events
  -- Section visibility flags
  show_banner         BOOLEAN DEFAULT TRUE,
  show_event_name     BOOLEAN DEFAULT TRUE,
  show_tagline        BOOLEAN DEFAULT TRUE,
  show_datetime       BOOLEAN DEFAULT TRUE,
  show_venue          BOOLEAN DEFAULT TRUE,
  show_dress_code     BOOLEAN DEFAULT FALSE,
  show_host_message   BOOLEAN DEFAULT FALSE,
  show_schedule       BOOLEAN DEFAULT FALSE,
  show_rsvp_button    BOOLEAN DEFAULT TRUE,
  show_contact        BOOLEAN DEFAULT FALSE,
  show_social_links   BOOLEAN DEFAULT FALSE,
  show_footer         BOOLEAN DEFAULT FALSE,
  -- Content
  banner_url          TEXT,
  tagline             TEXT,
  host_message        TEXT,
  schedule_preview    JSONB DEFAULT '[]',    -- [{time, title}]
  rsvp_deadline       TIMESTAMPTZ,
  contact_name        TEXT,
  contact_phone       TEXT,
  contact_email       TEXT,
  social_links        JSONB DEFAULT '{}',    -- {instagram, facebook, twitter, ...}
  footer_message      TEXT,
  -- Design
  layout_template     TEXT DEFAULT 'elegant'  CHECK (layout_template IN ('elegant','modern','minimal','festive','corporate')),
  base_theme          TEXT DEFAULT 'dark'      CHECK (base_theme IN ('light','dark')),
  primary_color       TEXT DEFAULT '#6366f1',
  secondary_color     TEXT DEFAULT '#f59e0b',
  background_color    TEXT DEFAULT '#0f172a',
  text_color          TEXT DEFAULT '#f8fafc',
  accent_color        TEXT DEFAULT '#e11d48',
  button_color        TEXT DEFAULT '#6366f1',
  button_text_color   TEXT DEFAULT '#ffffff',
  button_style        TEXT DEFAULT 'rounded'   CHECK (button_style IN ('sharp','rounded','pill')),
  font_family         TEXT DEFAULT 'Inter',
  font_size_base      INTEGER DEFAULT 16,
  logo_url            TEXT,
  logo_placement      TEXT DEFAULT 'top-center' CHECK (logo_placement IN ('top-left','top-center','top-right')),
  border_style        TEXT DEFAULT 'none'       CHECK (border_style IN ('none','thin','thick','double','shadow','rounded')),
  border_radius       TEXT DEFAULT 'default'    CHECK (border_radius IN ('sharp','default','rounded','pill')),
  background_type     TEXT DEFAULT 'solid'      CHECK (background_type IN ('solid','gradient','pattern','image')),
  background_image_url TEXT,
  section_spacing     TEXT DEFAULT 'normal'     CHECK (section_spacing IN ('compact','normal','spacious')),
  watermark_text      TEXT,
  watermark_opacity   NUMERIC(3,2) DEFAULT 0.0 CHECK (watermark_opacity BETWEEN 0 AND 1),
  -- Meta
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invitations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_id       UUID REFERENCES invitation_templates(id) ON DELETE SET NULL,
  guest_id          UUID REFERENCES guests(id) ON DELETE CASCADE,
  -- Unique token for guest-personalised link
  token             TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  personalised_url  TEXT,           -- set after generation: /i/[token]
  -- Status tracking
  status            TEXT DEFAULT 'draft'
                      CHECK (status IN ('draft','sent','delivered','opened','bounced','failed')),
  channel           TEXT DEFAULT 'email'
                      CHECK (channel IN ('email','whatsapp','sms','link')),
  sent_at           TIMESTAMPTZ,
  opened_at         TIMESTAMPTZ,
  opened_count      INTEGER DEFAULT 0,
  scheduled_at      TIMESTAMPTZ,       -- for scheduled sends
  -- Personalisation merge data
  merge_data        JSONB DEFAULT '{}', -- {guest_name, table_number, plus_one, ...}
  -- Meta
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_event    ON invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_invitations_guest    ON invitations(guest_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token    ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status   ON invitations(status);

-- ─── RSVP SYSTEM ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rsvp_forms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name                TEXT NOT NULL DEFAULT 'RSVP Form',
  -- Public access
  public_slug         TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  is_active           BOOLEAN DEFAULT TRUE,
  deadline            TIMESTAMPTZ,
  max_responses       INTEGER,          -- capacity cap (NULL = unlimited)
  password_protected  BOOLEAN DEFAULT FALSE,
  password_hash       TEXT,
  moderation_enabled  BOOLEAN DEFAULT FALSE,  -- require admin approval
  -- Section visibility flags
  show_attendance         BOOLEAN DEFAULT TRUE,   -- always on; required
  show_plus_one           BOOLEAN DEFAULT TRUE,
  show_meal_preference    BOOLEAN DEFAULT TRUE,
  show_dietary            BOOLEAN DEFAULT TRUE,
  show_accommodation      BOOLEAN DEFAULT FALSE,
  show_transport          BOOLEAN DEFAULT FALSE,
  show_tshirt_size        BOOLEAN DEFAULT FALSE,
  show_emergency_contact  BOOLEAN DEFAULT FALSE,
  show_message_to_host    BOOLEAN DEFAULT FALSE,
  -- Design (mirrors invitation_templates)
  layout_template     TEXT DEFAULT 'modern'  CHECK (layout_template IN ('elegant','modern','minimal','festive','corporate')),
  base_theme          TEXT DEFAULT 'light'   CHECK (base_theme IN ('light','dark')),
  primary_color       TEXT DEFAULT '#6366f1',
  background_color    TEXT DEFAULT '#ffffff',
  text_color          TEXT DEFAULT '#0f172a',
  button_color        TEXT DEFAULT '#6366f1',
  button_text_color   TEXT DEFAULT '#ffffff',
  font_family         TEXT DEFAULT 'Inter',
  logo_url            TEXT,
  logo_placement      TEXT DEFAULT 'top-center',
  border_radius       TEXT DEFAULT 'default',
  -- Thank-you page
  thankyou_message    TEXT DEFAULT 'Thank you for your RSVP!',
  thankyou_redirect_url TEXT,
  -- Meta
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rsvp_custom_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       UUID NOT NULL REFERENCES rsvp_forms(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('text','textarea','dropdown','checkbox','date','number')),
  options       JSONB DEFAULT '[]',  -- for dropdown/checkbox options
  is_required   BOOLEAN DEFAULT FALSE,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rsvp_responses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  form_id               UUID NOT NULL REFERENCES rsvp_forms(id) ON DELETE CASCADE,
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id              UUID REFERENCES guests(id) ON DELETE SET NULL,
  -- Core attendance
  attendance            TEXT NOT NULL CHECK (attendance IN ('yes','maybe','no')),
  -- Plus one
  plus_one_name         TEXT,
  plus_one_dietary      TEXT,
  -- Meal
  meal_preference       TEXT CHECK (meal_preference IN ('veg','non_veg','vegan','jain','halal','kosher','gluten_free','custom')),
  dietary_notes         TEXT,
  -- Accommodation
  accommodation_needed  BOOLEAN DEFAULT FALSE,
  accom_checkin_date    DATE,
  accom_checkout_date   DATE,
  accom_room_type       TEXT,
  accom_special_requests TEXT,
  -- Transport
  transport_needed      BOOLEAN DEFAULT FALSE,
  transport_pickup_location TEXT,
  transport_arrival_time TEXT,
  transport_flight_details TEXT,
  -- T-shirt
  tshirt_size           TEXT CHECK (tshirt_size IN ('XS','S','M','L','XL','XXL','XXXL')),
  -- Emergency contact
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  -- Message
  message_to_host       TEXT,
  -- Custom question answers
  custom_answers        JSONB DEFAULT '{}',  -- {question_id: answer}
  -- Moderation
  approval_status       TEXT DEFAULT 'auto_approved'
                          CHECK (approval_status IN ('pending','approved','rejected','auto_approved')),
  reviewed_by           UUID,
  reviewed_at           TIMESTAMPTZ,
  -- Meta
  ip_address            INET,
  user_agent            TEXT,
  submitted_at          TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rsvp_responses_form    ON rsvp_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_event   ON rsvp_responses(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_guest   ON rsvp_responses(guest_id);

-- Update guests table to track invite + RSVP state from new system
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS invite_status TEXT DEFAULT 'not_sent'
    CHECK (invite_status IN ('not_sent','sent','delivered','opened','bounced')),
  ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rsvp_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accommodation_status TEXT DEFAULT 'not_required'
    CHECK (accommodation_status IN ('not_required','requested','allocated','checked_in','checked_out')),
  ADD COLUMN IF NOT EXISTS transport_status TEXT DEFAULT 'not_required'
    CHECK (transport_status IN ('not_required','requested','arranged')),
  ADD COLUMN IF NOT EXISTS meal_preference TEXT
    CHECK (meal_preference IN ('veg','non_veg','vegan','jain','halal','kosher','gluten_free','custom')),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual','imported','self_registered','team_member')),
  ADD COLUMN IF NOT EXISTS registration_approved BOOLEAN,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general'
    CHECK (category IN ('vip','general','media','family','friend','colleague','vendor','speaker','sponsor','other'));

-- ─── ACCOMMODATION MANAGEMENT ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hotels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  country         TEXT DEFAULT 'India',
  star_rating     INTEGER CHECK (star_rating BETWEEN 1 AND 7),
  contact_name    TEXT,
  contact_phone   TEXT,
  contact_email   TEXT,
  website         TEXT,
  notes           TEXT,
  logo_url        TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hotel_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_number     TEXT NOT NULL,
  room_type       TEXT NOT NULL
                    CHECK (room_type IN ('single','double','twin','suite','deluxe','family','presidential')),
  capacity        INTEGER NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 10),
  floor           INTEGER,
  amenities       TEXT[] DEFAULT '{}',
  rate_per_night  NUMERIC(10,2),
  currency        TEXT DEFAULT 'INR',
  is_available    BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (hotel_id, room_number)
);

CREATE TABLE IF NOT EXISTS accommodation_bookings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id                UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  hotel_id                UUID NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  room_id                 UUID NOT NULL REFERENCES hotel_rooms(id) ON DELETE RESTRICT,
  guest_id                UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  check_in_date           DATE NOT NULL,
  check_out_date          DATE NOT NULL,
  -- Computed: out - in (stored for performance)
  nights                  INTEGER GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
  status                  TEXT DEFAULT 'pending'
                            CHECK (status IN ('pending','confirmed','cancelled','checked_in','checked_out','no_show')),
  booked_by               UUID,     -- user who made the booking
  booking_reference       TEXT DEFAULT encode(gen_random_bytes(6), 'hex'),
  special_requests        TEXT,
  is_complimentary        BOOLEAN DEFAULT FALSE,
  amount                  NUMERIC(10,2),
  paid_by_guest           BOOLEAN DEFAULT FALSE,
  voucher_generated       BOOLEAN DEFAULT FALSE,
  voucher_sent            BOOLEAN DEFAULT FALSE,
  voucher_sent_at         TIMESTAMPTZ,
  voucher_url             TEXT,      -- link to generated PDF
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  -- Enforce dates are valid
  CONSTRAINT chk_checkout_after_checkin CHECK (check_out_date > check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_accom_bookings_event   ON accommodation_bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_accom_bookings_guest   ON accommodation_bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_accom_bookings_room    ON accommodation_bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_accom_bookings_hotel   ON accommodation_bookings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_accom_bookings_dates   ON accommodation_bookings(check_in_date, check_out_date);

-- Prevent double-booking: same room cannot have overlapping confirmed bookings
CREATE OR REPLACE FUNCTION prevent_room_double_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM accommodation_bookings
    WHERE room_id = NEW.room_id
      AND id != NEW.id
      AND status NOT IN ('cancelled','no_show')
      AND check_in_date < NEW.check_out_date
      AND check_out_date > NEW.check_in_date
  ) THEN
    RAISE EXCEPTION 'Room % is already booked for the requested dates', NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_room_double_booking ON accommodation_bookings;
CREATE TRIGGER trg_prevent_room_double_booking
  BEFORE INSERT OR UPDATE ON accommodation_bookings
  FOR EACH ROW EXECUTE FUNCTION prevent_room_double_booking();

-- ─── GUEST IMPORT BATCHES ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guest_import_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  imported_by     UUID,
  filename        TEXT NOT NULL,
  total_rows      INTEGER DEFAULT 0,
  imported_count  INTEGER DEFAULT 0,
  skipped_count   INTEGER DEFAULT 0,
  failed_count    INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'processing'
                    CHECK (status IN ('processing','completed','failed')),
  error_log       JSONB DEFAULT '[]',  -- [{row, field, error}]
  column_mapping  JSONB DEFAULT '{}',  -- {csv_col: db_col}
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_event ON guest_import_batches(event_id);

-- ─── PUBLIC REGISTRATION LINKS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_registration_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  slug                TEXT UNIQUE NOT NULL,  -- used in /register/[slug]
  is_active           BOOLEAN DEFAULT TRUE,
  expires_at          TIMESTAMPTZ,
  max_registrations   INTEGER,    -- capacity cap
  current_count       INTEGER DEFAULT 0,
  password_protected  BOOLEAN DEFAULT FALSE,
  password_hash       TEXT,
  moderation_enabled  BOOLEAN DEFAULT FALSE,
  custom_questions    JSONB DEFAULT '[]',  -- [{id, text, type, required, options}]
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_links_event ON event_registration_links(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_links_slug ON event_registration_links(slug);

-- ─── VOUCHER TEMPLATES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS voucher_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  is_global       BOOLEAN DEFAULT FALSE,
  -- Section toggles
  show_event_logo       BOOLEAN DEFAULT TRUE,
  show_guest_name       BOOLEAN DEFAULT TRUE,
  show_guest_designation BOOLEAN DEFAULT TRUE,
  show_hotel_name       BOOLEAN DEFAULT TRUE,
  show_hotel_address    BOOLEAN DEFAULT TRUE,
  show_hotel_stars      BOOLEAN DEFAULT TRUE,
  show_room_number      BOOLEAN DEFAULT TRUE,
  show_room_type        BOOLEAN DEFAULT TRUE,
  show_checkin_date     BOOLEAN DEFAULT TRUE,
  show_checkout_date    BOOLEAN DEFAULT TRUE,
  show_nights           BOOLEAN DEFAULT TRUE,
  show_booking_ref      BOOLEAN DEFAULT TRUE,
  show_special_requests BOOLEAN DEFAULT FALSE,
  show_hotel_contact    BOOLEAN DEFAULT TRUE,
  show_emergency_contact BOOLEAN DEFAULT FALSE,
  show_terms            BOOLEAN DEFAULT FALSE,
  show_qr_code          BOOLEAN DEFAULT TRUE,
  show_signature_block  BOOLEAN DEFAULT FALSE,
  show_footer           BOOLEAN DEFAULT TRUE,
  -- Content
  terms_text      TEXT,
  footer_message  TEXT,
  -- Design
  layout_template TEXT DEFAULT 'elegant'
                    CHECK (layout_template IN ('elegant','minimal','bordered','ribbon')),
  page_size       TEXT DEFAULT 'a4_portrait'
                    CHECK (page_size IN ('a4_portrait','a4_landscape','card','mobile')),
  primary_color   TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#f59e0b',
  background_color TEXT DEFAULT '#ffffff',
  text_color      TEXT DEFAULT '#0f172a',
  heading_color   TEXT DEFAULT '#1e293b',
  border_style    TEXT DEFAULT 'elegant',
  border_color    TEXT DEFAULT '#6366f1',
  font_family     TEXT DEFAULT 'Inter',
  logo_url        TEXT,
  logo_placement  TEXT DEFAULT 'top-center',
  background_type TEXT DEFAULT 'solid',
  background_image_url TEXT,
  watermark_text  TEXT,
  watermark_opacity NUMERIC(3,2) DEFAULT 0.0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE invitation_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_forms                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_custom_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_responses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_rooms                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodation_bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_import_batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registration_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_templates            ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY "tenant_isolation" ON invitation_templates
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON invitations
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON rsvp_forms
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON rsvp_custom_questions
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON rsvp_responses
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON hotels
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON hotel_rooms
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON accommodation_bookings
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON guest_import_batches
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON event_registration_links
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON voucher_templates
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);


-- ==========================================
-- Migration: 031_guest_table_customisation.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Guest Table Customisation (Migration 031)
-- Per-event: column manager, custom columns, saved views,
-- conditional formatting, mobile column prefs
-- ============================================================

-- ─── Event Guest Table Layouts ────────────────────────────────────────────────
-- Stores which columns are visible + their order for each event

CREATE TABLE IF NOT EXISTS event_guest_table_layouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- column_config: array of {id, field, label, visible, width, frozen, order}
  column_config   JSONB NOT NULL DEFAULT '[]',
  -- mobile_columns: up to 3 column ids to show in mobile card view
  mobile_columns  JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, event_id)
);

-- ─── Saved Table Views ─────────────────────────────────────────────────────────
-- Multiple named views per event, each with own columns/sort/filter/group

CREATE TABLE IF NOT EXISTS event_guest_table_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  is_default      BOOLEAN DEFAULT FALSE,
  -- column_ids: ordered list of visible column ids for this view
  column_ids      JSONB NOT NULL DEFAULT '[]',
  sort_by         TEXT,       -- field name
  sort_dir        TEXT DEFAULT 'asc' CHECK (sort_dir IN ('asc','desc')),
  filter_config   JSONB DEFAULT '{}',  -- {field: value} active filters
  group_by        TEXT,       -- field name to group rows by
  -- Share: generate a token so staff at a specific station can load this view
  share_token     TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_views_event ON event_guest_table_views(event_id);

-- ─── Custom Columns (per event) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_guest_custom_columns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  field_key       TEXT NOT NULL,   -- snake_case, used as key in guest_custom_data JSONB
  column_type     TEXT NOT NULL
                    CHECK (column_type IN ('text','number','dropdown','boolean','date')),
  options         JSONB DEFAULT '[]',  -- for dropdown: [{value, label}]
  is_required     BOOLEAN DEFAULT FALSE,
  show_in_rsvp    BOOLEAN DEFAULT FALSE,  -- expose in RSVP form builder
  show_in_export  BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_custom_cols_event ON event_guest_custom_columns(event_id);

-- ─── Guest Custom Data ─────────────────────────────────────────────────────────
-- Stores custom column values per guest (JSONB: {field_key: value})

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}';

-- ─── Conditional Formatting Rules ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_guest_table_formatting (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- condition
  field           TEXT NOT NULL,
  operator        TEXT NOT NULL CHECK (operator IN ('eq','neq','contains','gt','lt','is_empty','is_not_empty')),
  value           TEXT,
  -- style to apply
  row_bg_color    TEXT,       -- e.g. '#fef2f2' for light red
  row_text_color  TEXT,
  left_border_color TEXT,     -- e.g. '#f59e0b' for gold VIP border
  bold_text       BOOLEAN DEFAULT FALSE,
  sort_order      INTEGER DEFAULT 0,  -- rules evaluated in order; max 5 per event
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formatting_event ON event_guest_table_formatting(event_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE event_guest_table_layouts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_guest_table_views      ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_guest_custom_columns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_guest_table_formatting ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON event_guest_table_layouts
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON event_guest_table_views
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON event_guest_custom_columns
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON event_guest_table_formatting
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);


-- ==========================================
-- Migration: 032_event_scoped_design_correction.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Architecture Correction (Migration 032)
-- DESIGN PRINCIPLE: All document designs (invitation, RSVP, voucher)
-- are ALWAYS event-scoped. No design is shared globally — only
-- "Master Templates" in a read-only library; applying one to an
-- event creates a full independent COPY.
-- ============================================================

-- ─── 1. Master Template Library (global, read-only, copy-on-use) ─────────────
-- These are curated library templates that admins can "apply" to an event.
-- Applying creates a COPY under invitation_templates / voucher_templates
-- with an event_id. Editing the event copy NEVER affects the master.

CREATE TABLE IF NOT EXISTS master_invitation_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  preview_image_url TEXT,
  category        TEXT DEFAULT 'general'
                    CHECK (category IN ('wedding','corporate','birthday','conference','party','general')),
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  -- All design/content fields (mirrors invitation_templates)
  show_banner         BOOLEAN DEFAULT TRUE,
  show_event_name     BOOLEAN DEFAULT TRUE,
  show_tagline        BOOLEAN DEFAULT TRUE,
  show_datetime       BOOLEAN DEFAULT TRUE,
  show_venue          BOOLEAN DEFAULT TRUE,
  show_dress_code     BOOLEAN DEFAULT FALSE,
  show_host_message   BOOLEAN DEFAULT FALSE,
  show_schedule       BOOLEAN DEFAULT FALSE,
  show_rsvp_button    BOOLEAN DEFAULT TRUE,
  show_contact        BOOLEAN DEFAULT FALSE,
  show_social_links   BOOLEAN DEFAULT FALSE,
  show_footer         BOOLEAN DEFAULT FALSE,
  layout_template     TEXT DEFAULT 'elegant'
                        CHECK (layout_template IN ('elegant','modern','minimal','festive','corporate')),
  base_theme          TEXT DEFAULT 'dark'   CHECK (base_theme IN ('light','dark')),
  primary_color       TEXT DEFAULT '#6366f1',
  secondary_color     TEXT DEFAULT '#f59e0b',
  background_color    TEXT DEFAULT '#0f172a',
  text_color          TEXT DEFAULT '#f8fafc',
  accent_color        TEXT DEFAULT '#e11d48',
  button_color        TEXT DEFAULT '#6366f1',
  button_text_color   TEXT DEFAULT '#ffffff',
  button_style        TEXT DEFAULT 'rounded' CHECK (button_style IN ('sharp','rounded','pill')),
  font_family         TEXT DEFAULT 'Inter',
  font_size_base      INTEGER DEFAULT 16,
  logo_placement      TEXT DEFAULT 'top-center'
                        CHECK (logo_placement IN ('top-left','top-center','top-right')),
  border_style        TEXT DEFAULT 'none'
                        CHECK (border_style IN ('none','thin','thick','double','shadow','rounded')),
  border_radius       TEXT DEFAULT 'default'
                        CHECK (border_radius IN ('sharp','default','rounded','pill')),
  background_type     TEXT DEFAULT 'solid'
                        CHECK (background_type IN ('solid','gradient','pattern','image')),
  section_spacing     TEXT DEFAULT 'normal'
                        CHECK (section_spacing IN ('compact','normal','spacious')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_voucher_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  preview_image_url TEXT,
  category        TEXT DEFAULT 'general',
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  -- All design fields (mirrors voucher_templates)
  show_event_logo       BOOLEAN DEFAULT TRUE,
  show_guest_name       BOOLEAN DEFAULT TRUE,
  show_guest_designation BOOLEAN DEFAULT TRUE,
  show_hotel_name       BOOLEAN DEFAULT TRUE,
  show_hotel_address    BOOLEAN DEFAULT TRUE,
  show_hotel_stars      BOOLEAN DEFAULT TRUE,
  show_room_number      BOOLEAN DEFAULT TRUE,
  show_room_type        BOOLEAN DEFAULT TRUE,
  show_checkin_date     BOOLEAN DEFAULT TRUE,
  show_checkout_date    BOOLEAN DEFAULT TRUE,
  show_nights           BOOLEAN DEFAULT TRUE,
  show_booking_ref      BOOLEAN DEFAULT TRUE,
  show_special_requests BOOLEAN DEFAULT FALSE,
  show_hotel_contact    BOOLEAN DEFAULT TRUE,
  show_emergency_contact BOOLEAN DEFAULT FALSE,
  show_terms            BOOLEAN DEFAULT FALSE,
  show_qr_code          BOOLEAN DEFAULT TRUE,
  show_signature_block  BOOLEAN DEFAULT FALSE,
  show_footer           BOOLEAN DEFAULT TRUE,
  layout_template TEXT DEFAULT 'elegant'
                    CHECK (layout_template IN ('elegant','minimal','bordered','ribbon')),
  page_size       TEXT DEFAULT 'a4_portrait'
                    CHECK (page_size IN ('a4_portrait','a4_landscape','card','mobile')),
  primary_color   TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#f59e0b',
  background_color TEXT DEFAULT '#ffffff',
  text_color      TEXT DEFAULT '#0f172a',
  heading_color   TEXT DEFAULT '#1e293b',
  border_style    TEXT DEFAULT 'elegant',
  border_color    TEXT DEFAULT '#6366f1',
  font_family     TEXT DEFAULT 'Inter',
  logo_placement  TEXT DEFAULT 'top-center',
  background_type TEXT DEFAULT 'solid',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Fix invitation_templates: make event_id NOT NULL ─────────────────────
-- First: backfill any rows without an event_id by removing orphaned globals
-- (in a fresh DB there are none, but belt-and-suspenders)
DELETE FROM invitation_templates WHERE event_id IS NULL;

-- Remove the is_global column (no longer needed — event scope is enforced by event_id)
ALTER TABLE invitation_templates DROP COLUMN IF EXISTS is_global;

-- Now enforce NOT NULL on event_id
ALTER TABLE invitation_templates
  ALTER COLUMN event_id SET NOT NULL;

-- Change ON DELETE to CASCADE (document design is part of the event)
ALTER TABLE invitation_templates
  DROP CONSTRAINT IF EXISTS invitation_templates_event_id_fkey;
ALTER TABLE invitation_templates
  ADD CONSTRAINT invitation_templates_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- Add index on event_id for fast per-event queries
CREATE INDEX IF NOT EXISTS idx_invitation_templates_event ON invitation_templates(event_id);

-- ─── 3. Fix voucher_templates: make event_id NOT NULL ────────────────────────
DELETE FROM voucher_templates WHERE event_id IS NULL;

ALTER TABLE voucher_templates DROP COLUMN IF EXISTS is_global;

ALTER TABLE voucher_templates
  ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE voucher_templates
  DROP CONSTRAINT IF EXISTS voucher_templates_event_id_fkey;
ALTER TABLE voucher_templates
  ADD CONSTRAINT voucher_templates_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_voucher_templates_event ON voucher_templates(event_id);

-- ─── 4. Auto-create default templates when an event is created ───────────────
-- This trigger ensures every new event gets a blank invitation template
-- and a blank voucher template automatically.

CREATE OR REPLACE FUNCTION create_default_event_templates()
RETURNS TRIGGER AS $$
BEGIN
  -- Default invitation template for this event
  INSERT INTO invitation_templates (
    tenant_id, event_id, name,
    layout_template, base_theme, primary_color, background_color, text_color,
    button_color, button_text_color, font_family,
    show_banner, show_event_name, show_tagline, show_datetime,
    show_venue, show_rsvp_button
  ) VALUES (
    NEW.tenant_id, NEW.id, 'Default Invitation',
    'elegant', 'dark', '#6366f1', '#0f172a', '#f8fafc',
    '#6366f1', '#ffffff', 'Inter',
    true, true, true, true, true, true
  ) ON CONFLICT DO NOTHING;

  -- Default voucher template for this event
  INSERT INTO voucher_templates (
    tenant_id, event_id, name,
    layout_template, page_size, primary_color, background_color, text_color,
    font_family,
    show_guest_name, show_hotel_name, show_checkin_date, show_checkout_date,
    show_nights, show_booking_ref, show_qr_code, show_footer
  ) VALUES (
    NEW.tenant_id, NEW.id, 'Default Voucher',
    'elegant', 'a4_portrait', '#6366f1', '#ffffff', '#0f172a',
    'Inter',
    true, true, true, true, true, true, true, true
  ) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_default_event_templates ON events;
CREATE TRIGGER trg_create_default_event_templates
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION create_default_event_templates();

-- ─── 5. Seed default RSVP form per event (same pattern) ──────────────────────
CREATE OR REPLACE FUNCTION create_default_rsvp_form()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO rsvp_forms (
    tenant_id, event_id, name, is_active,
    show_attendance, show_plus_one, show_meal_preference, show_dietary
  ) VALUES (
    NEW.tenant_id, NEW.id, 'RSVP Form', true,
    true, true, true, true
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_default_rsvp_form ON events;
CREATE TRIGGER trg_create_default_rsvp_form
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION create_default_rsvp_form();

-- ─── 6. Master template library: no RLS (public read, super admin writes) ────
-- Super Admin portal manages these; all authenticated users can read.
-- (Apply appropriate policies in your Supabase dashboard based on your auth model)

-- ─── 7. Tracking: copy_from_master audit trail ───────────────────────────────
-- Track when an event template was seeded from a master (informational only)
ALTER TABLE invitation_templates
  ADD COLUMN IF NOT EXISTS copied_from_master UUID REFERENCES master_invitation_templates(id) ON DELETE SET NULL;

ALTER TABLE voucher_templates
  ADD COLUMN IF NOT EXISTS copied_from_master UUID REFERENCES master_voucher_templates(id) ON DELETE SET NULL;

-- ─── Summary comment ─────────────────────────────────────────────────────────
-- After this migration:
-- • invitation_templates.event_id is NOT NULL → always event-scoped
-- • voucher_templates.event_id is NOT NULL → always event-scoped
-- • rsvp_forms.event_id was already NOT NULL → correct
-- • master_invitation_templates / master_voucher_templates = global library
-- • Applying a master to an event = INSERT into event-scoped table with copied_from_master set
-- • Editing event copy never affects master
-- • Every new event auto-gets default invitation, voucher, and RSVP templates via triggers


-- ==========================================
-- Migration: 033_public_registration.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Public Guest Self-Registration (Migration 033)
-- Allows events to have a public registration page where guests
-- can sign up directly. Each event has one registration config.
-- ============================================================

CREATE TABLE IF NOT EXISTS event_registration_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,

  -- Public access
  public_slug           TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  is_active             BOOLEAN DEFAULT FALSE,    -- default OFF; host must explicitly enable
  deadline              TIMESTAMPTZ,
  max_registrations     INTEGER,                  -- NULL = unlimited

  -- Approval / moderation
  require_approval      BOOLEAN DEFAULT FALSE,    -- if true, guests get registration_approved=false until approved

  -- Fields to collect
  collect_phone         BOOLEAN DEFAULT TRUE,
  collect_company       BOOLEAN DEFAULT FALSE,
  collect_designation   BOOLEAN DEFAULT FALSE,
  collect_city          BOOLEAN DEFAULT FALSE,
  collect_category      BOOLEAN DEFAULT FALSE,
  allowed_categories    TEXT[] DEFAULT ARRAY['general','vip','media','speaker','sponsor'],

  -- Content
  welcome_message       TEXT,
  success_message       TEXT DEFAULT 'Thank you for registering!',

  -- Design (matches RsvpForm design fields)
  primary_color         TEXT DEFAULT '#6366f1',
  background_color      TEXT DEFAULT '#ffffff',
  text_color            TEXT DEFAULT '#0f172a',
  button_color          TEXT DEFAULT '#6366f1',
  button_text_color     TEXT DEFAULT '#ffffff',
  font_family           TEXT DEFAULT 'Inter',
  border_radius         TEXT DEFAULT 'default' CHECK (border_radius IN ('sharp','default','rounded','pill')),

  -- Meta
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_configs_event  ON event_registration_configs(event_id);
CREATE INDEX IF NOT EXISTS idx_reg_configs_slug   ON event_registration_configs(public_slug);
CREATE INDEX IF NOT EXISTS idx_reg_configs_tenant ON event_registration_configs(tenant_id);

-- Auto-create registration config when an event is created (inactive by default)
CREATE OR REPLACE FUNCTION create_default_registration_config()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO event_registration_configs (tenant_id, event_id)
  VALUES (NEW.tenant_id, NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_registration_config ON events;
CREATE TRIGGER trg_create_registration_config
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION create_default_registration_config();


-- ==========================================
-- Migration: 034_fnb_management.sql
-- ==========================================
-- ============================================================
-- OccasionPro — F&B (Food & Beverage) Management (Migration 034)
-- Full module: menus, items, beverages, stations, tasting, consumption
-- ============================================================

-- ── F&B Menus (per event, per meal session) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS fnb_menus (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,                   -- "Day 1 Gala Dinner"
  meal_type         TEXT NOT NULL CHECK (meal_type IN (
                      'breakfast','lunch','dinner','hi-tea','cocktails',
                      'brunch','welcome-drinks','midnight-snacks','custom'
                    )),
  session_name      TEXT,                             -- Custom label override
  service_style     TEXT NOT NULL DEFAULT 'buffet' CHECK (service_style IN (
                      'buffet','plated','food-stations','cocktail','family-style','live-stations'
                    )),
  start_time        TIME,
  end_time          TIME,
  pax_count         INTEGER,                          -- Guest count for this session
  total_food_cost   DECIMAL(12,2) DEFAULT 0,          -- Auto-computed
  is_confirmed      BOOLEAN DEFAULT FALSE,
  status            TEXT DEFAULT 'draft' CHECK (status IN (
                      'draft','submitted_to_vendor','vendor_confirmed','finalised'
                    )),
  notes             TEXT,
  display_order     INTEGER DEFAULT 0,
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_menus_event ON fnb_menus(event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_menus_tenant ON fnb_menus(tenant_id);

-- ── F&B Menu Items ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fnb_menu_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id             UUID NOT NULL REFERENCES fnb_menus(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  category            TEXT NOT NULL DEFAULT 'main' CHECK (category IN (
                        'starter','main','dessert','beverage','bread',
                        'salad','live-station','snack','soup','side'
                      )),
  cuisine_type        TEXT,                            -- Indian, Continental, Chinese, etc.
  -- Dietary flags
  is_veg              BOOLEAN DEFAULT FALSE,
  is_vegan            BOOLEAN DEFAULT FALSE,
  is_gluten_free      BOOLEAN DEFAULT FALSE,
  is_halal            BOOLEAN DEFAULT FALSE,
  is_jain             BOOLEAN DEFAULT FALSE,
  -- Allergens
  allergens           TEXT[] DEFAULT ARRAY[]::TEXT[],  -- nuts, dairy, shellfish, egg, soy, wheat
  -- Quantities & Costs
  unit                TEXT DEFAULT 'per_person' CHECK (unit IN (
                        'per_person','per_piece','per_kg','per_litre','per_platter'
                      )),
  quantity_per_pax    DECIMAL(8,3),
  total_quantity      DECIMAL(10,3),
  unit_cost           DECIMAL(10,2),
  total_cost          DECIMAL(12,2) GENERATED ALWAYS AS (
                        COALESCE(total_quantity, 0) * COALESCE(unit_cost, 0)
                      ) STORED,
  -- Vendor
  catering_vendor_id  UUID REFERENCES vendors(id) ON DELETE SET NULL,
  notes               TEXT,
  display_order       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_items_menu    ON fnb_menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_fnb_items_event   ON fnb_menu_items(event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_items_vendor  ON fnb_menu_items(catering_vendor_id);

-- ── Beverage Packages ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fnb_beverage_packages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  menu_id               UUID REFERENCES fnb_menus(id) ON DELETE SET NULL,
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'soft-bar' CHECK (type IN (
                          'soft-bar','full-bar','beer-wine','mocktails-only','custom'
                        )),
  items                 JSONB DEFAULT '[]',            -- [{name, quantity_per_pax, unit}]
  duration_hours        DECIMAL(4,1),
  price_per_pax         DECIMAL(10,2),
  total_cost            DECIMAL(12,2),
  bartender_count       INTEGER DEFAULT 0,
  bar_opens_at          TIME,
  bar_closes_at         TIME,
  is_dry_event          BOOLEAN DEFAULT FALSE,         -- Hides bar section if true
  is_included_in_package BOOLEAN DEFAULT TRUE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_beverages_event ON fnb_beverage_packages(event_id);

-- ── Service Stations ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fnb_service_stations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  menu_id             UUID REFERENCES fnb_menus(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,                   -- "Live Pasta Counter", "Chaat Corner"
  station_type        TEXT DEFAULT 'food' CHECK (station_type IN (
                        'food','beverage','dessert','live-cooking','display'
                      )),
  location_in_venue   TEXT,
  assigned_staff_count INTEGER DEFAULT 2,
  setup_time          TIME,                            -- When to start setup
  breakdown_time      TIME,                            -- When to start breakdown
  equipment_needed    TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes               TEXT,
  display_order       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_stations_event ON fnb_service_stations(event_id);

-- ── Tasting Sessions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fnb_tasting_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  menu_id             UUID REFERENCES fnb_menus(id) ON DELETE SET NULL,
  vendor_id           UUID REFERENCES vendors(id) ON DELETE SET NULL,
  scheduled_at        TIMESTAMPTZ,
  location            TEXT,
  attendees           TEXT[] DEFAULT ARRAY[]::TEXT[],  -- Names/emails of attendees
  status              TEXT DEFAULT 'scheduled' CHECK (status IN (
                        'scheduled','completed','cancelled','rescheduled'
                      )),
  feedback_notes      TEXT,
  items_approved      TEXT[] DEFAULT ARRAY[]::TEXT[],
  items_rejected      TEXT[] DEFAULT ARRAY[]::TEXT[],
  items_modified      TEXT[] DEFAULT ARRAY[]::TEXT[],
  follow_up_required  BOOLEAN DEFAULT FALSE,
  follow_up_notes     TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_tasting_event  ON fnb_tasting_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_tasting_vendor ON fnb_tasting_sessions(vendor_id);

-- ── Consumption Log (post-event) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fnb_consumption_log (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id                UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  menu_id                 UUID REFERENCES fnb_menus(id) ON DELETE SET NULL,
  item_id                 UUID REFERENCES fnb_menu_items(id) ON DELETE SET NULL,
  item_name               TEXT,                        -- Denormalised in case item deleted
  planned_quantity        DECIMAL(10,3),
  actual_quantity_consumed DECIMAL(10,3),
  leftover_quantity       DECIMAL(10,3),
  wastage_pct             DECIMAL(5,2) GENERATED ALWAYS AS (
                            CASE
                              WHEN COALESCE(planned_quantity, 0) > 0
                              THEN ROUND((COALESCE(leftover_quantity, 0) / planned_quantity) * 100, 2)
                              ELSE 0
                            END
                          ) STORED,
  wastage_notes           TEXT,
  logged_by               UUID,
  logged_at               TIMESTAMPTZ DEFAULT NOW(),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_consumption_event ON fnb_consumption_log(event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_consumption_item  ON fnb_consumption_log(item_id);

-- ── Dietary Summary View ─────────────────────────────────────────────────────
-- Pulls guest dietary info from rsvp_responses (custom_answers JSONB + guest fields)
-- Falls back to guest_details dietary flags when available

CREATE OR REPLACE VIEW fnb_dietary_summary AS
SELECT
  g.event_id,
  g.tenant_id,
  COUNT(*)                                                    AS total_guests,
  COUNT(*) FILTER (WHERE g.dietary_preference = 'vegetarian') AS veg_count,
  COUNT(*) FILTER (WHERE g.dietary_preference = 'vegan')      AS vegan_count,
  COUNT(*) FILTER (WHERE g.dietary_preference = 'jain')       AS jain_count,
  COUNT(*) FILTER (WHERE g.dietary_preference = 'halal')      AS halal_count,
  COUNT(*) FILTER (WHERE g.dietary_preference = 'non_vegetarian'
                      OR g.dietary_preference IS NULL)         AS non_veg_count,
  COUNT(*) FILTER (WHERE 'gluten_free' = ANY(COALESCE(g.allergens, ARRAY[]::TEXT[]))) AS gluten_free_count,
  COUNT(*) FILTER (WHERE g.allergens IS NOT NULL AND array_length(g.allergens, 1) > 0) AS has_allergies_count,
  COALESCE(
    jsonb_agg(DISTINCT allergen) FILTER (
      WHERE allergen IS NOT NULL
        AND allergen != ''
    ), '[]'::jsonb
  )                                                            AS all_allergens
FROM guests g,
     LATERAL unnest(COALESCE(g.allergens, ARRAY[]::TEXT[])) AS allergen
WHERE g.rsvp_status IN ('confirmed', 'attending')
GROUP BY g.event_id, g.tenant_id;

-- ── Auto-update menu total_food_cost on item change ─────────────────────────

CREATE OR REPLACE FUNCTION sync_menu_food_cost()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE fnb_menus
  SET total_food_cost = (
    SELECT COALESCE(SUM(COALESCE(total_cost, 0)), 0)
    FROM fnb_menu_items
    WHERE menu_id = COALESCE(NEW.menu_id, OLD.menu_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.menu_id, OLD.menu_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_menu_cost_insert ON fnb_menu_items;
CREATE TRIGGER trg_sync_menu_cost_insert
  AFTER INSERT OR UPDATE OR DELETE ON fnb_menu_items
  FOR EACH ROW EXECUTE FUNCTION sync_menu_food_cost();

-- ── Add dietary columns to guests if not present ────────────────────────────
-- (safe — only adds if column doesn't exist)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guests' AND column_name = 'dietary_preference'
  ) THEN
    ALTER TABLE guests ADD COLUMN dietary_preference TEXT CHECK (
      dietary_preference IN ('vegetarian','vegan','jain','halal','non_vegetarian','other')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guests' AND column_name = 'allergens'
  ) THEN
    ALTER TABLE guests ADD COLUMN allergens TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;


-- ==========================================
-- Migration: 035_granular_permissions.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Granular Module-Level Permissions (Migration 035)
-- Extends RBAC system with per-module, per-team-member access control
-- ============================================================

-- ── Access level enum ────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_access_level') THEN
    CREATE TYPE module_access_level AS ENUM ('none', 'view', 'edit', 'full');
  END IF;
END $$;

-- ── Module registry ──────────────────────────────────────────────────────────
-- Single source of truth for all platform modules

CREATE TABLE IF NOT EXISTS platform_modules (
  id              TEXT PRIMARY KEY,           -- 'guests', 'fnb', 'finance', etc.
  label           TEXT NOT NULL,              -- "Guests"
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'operations',  -- 'core','operations','finance','admin','system'
  sidebar_path    TEXT,                       -- '/guests'
  is_always_on    BOOLEAN NOT NULL DEFAULT false,  -- Dashboard, Notifications
  admin_only      BOOLEAN NOT NULL DEFAULT false,  -- Settings full, Super Admin
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed all modules
INSERT INTO platform_modules (id, label, description, category, sidebar_path, is_always_on, admin_only, sort_order) VALUES
  ('dashboard',        'Dashboard',              'Main dashboard overview',             'core',       '/dashboard',   true,  false, 1),
  ('events',           'Events',                 'Event creation and management',       'core',       '/events',      false, false, 2),
  ('guests',           'Guests',                 'Guest list, check-in, export',        'operations', '/guests',      false, false, 3),
  ('fnb',              'F&B',                    'Food & beverage management',          'operations', '/fnb',         false, false, 4),
  ('accommodation',    'Accommodation',          'Hotel blocks and room assignments',   'operations', '/accommodation',false,false, 5),
  ('invitations_rsvp', 'Invitations & RSVP',     'Invite sending and RSVP tracking',   'operations', '/rsvp',        false, false, 6),
  ('venues',           'Venues',                 'Venue listing and floor plans',       'operations', '/venues',      false, false, 7),
  ('vendors',          'Vendors',                'Vendor management and payments',      'operations', '/vendors',     false, false, 8),
  ('finance',          'Finance & Budget',       'Invoices, expenses, P&L',            'finance',    '/finance',     false, false, 9),
  ('crm',              'CRM',                    'Leads, proposals, sales pipeline',    'finance',    '/crm',         false, false, 10),
  ('runsheet',         'Runsheet',               'Event runsheet and timeline',         'operations', '/runsheet',    false, false, 11),
  ('tasks',            'Tasks',                  'Task assignment and tracking',        'operations', '/tasks',       false, false, 12),
  ('team',             'Team',                   'Team members and roles',              'admin',      '/team',        false, true,  13),
  ('artists',          'Artist & Talent',        'Artist and performer management',     'operations', '/artists',     false, false, 14),
  ('transportation',   'Transportation',         'Transport and logistics',             'operations', '/transportation',false,false,15),
  ('av_technical',     'AV & Technical',         'AV and technical production',         'operations', '/av',          false, false, 16),
  ('security',         'Security',               'Security and crowd management',       'operations', '/security',    false, false, 17),
  ('sponsorship',      'Sponsorship',            'Sponsorship and partnerships',        'finance',    '/sponsorship', false, false, 18),
  ('inventory',        'Inventory',              'Stock and equipment tracking',        'operations', '/inventory',   false, false, 19),
  ('microsites',       'Microsites & Ticketing', 'Event websites and ticket sales',    'operations', '/microsites',  false, false, 20),
  ('analytics',        'Analytics',              'Reports and business intelligence',   'admin',      '/analytics',   false, false, 21),
  ('ai_assistant',     'AI Assistant',           'AI-powered automation and insights',  'core',       '/ai',          false, false, 22),
  ('notifications',    'Notifications',          'Notification center',                 'core',       '/notifications',true, false, 23),
  ('settings',         'Settings',               'Platform settings and configuration', 'admin',      '/settings',    false, true,  24),
  ('super_admin',      'Super Admin',            'Super admin portal (never for team)', 'system',     '/super-admin', false, true,  25)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- ── Team member permissions ───────────────────────────────────────────────────
-- Stores per-module access level for each team member
-- event_id IS NULL = platform-wide (applies to all events)
-- event_id IS NOT NULL = event-specific override

CREATE TABLE IF NOT EXISTS team_member_permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id     UUID REFERENCES events(id) ON DELETE CASCADE,   -- NULL = platform-wide
  module_id    TEXT NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
  access_level module_access_level NOT NULL DEFAULT 'none',
  granted_by   UUID REFERENCES profiles(id),
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, event_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_tmp_tenant     ON team_member_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tmp_profile    ON team_member_permissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_tmp_event      ON team_member_permissions(event_id);
CREATE INDEX IF NOT EXISTS idx_tmp_module     ON team_member_permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_tmp_profile_event ON team_member_permissions(profile_id, event_id);

-- ── Preset permission templates ───────────────────────────────────────────────
-- Preset roles that auto-set all module levels

CREATE TABLE IF NOT EXISTS permission_presets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,        -- 'admin', 'manager', 'coordinator', 'view_only'
  label       TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#6366f1',
  is_system   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO permission_presets (name, label, description, color) VALUES
  ('admin',       'Admin',        'Full access to all modules including team and settings', '#ef4444'),
  ('manager',     'Manager',      'Full operational access, view-only for finance and admin', '#f59e0b'),
  ('coordinator', 'Coordinator',  'Edit access for operations, view-only for finance', '#3b82f6'),
  ('view_only',   'View Only',    'Read-only access to all non-admin modules', '#6b7280')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS permission_preset_modules (
  preset_name  TEXT NOT NULL REFERENCES permission_presets(name) ON DELETE CASCADE,
  module_id    TEXT NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
  access_level module_access_level NOT NULL DEFAULT 'none',
  PRIMARY KEY (preset_name, module_id)
);

-- Admin preset: full everywhere except super_admin (none)
INSERT INTO permission_preset_modules (preset_name, module_id, access_level)
SELECT 'admin', id,
  CASE
    WHEN id = 'super_admin' THEN 'none'::module_access_level
    ELSE 'full'::module_access_level
  END
FROM platform_modules
ON CONFLICT (preset_name, module_id) DO NOTHING;

-- Manager preset
INSERT INTO permission_preset_modules (preset_name, module_id, access_level)
SELECT 'manager', id,
  CASE
    WHEN id IN ('super_admin','settings') THEN 'none'::module_access_level
    WHEN id IN ('team','analytics','finance') THEN 'view'::module_access_level
    ELSE 'full'::module_access_level
  END
FROM platform_modules
ON CONFLICT (preset_name, module_id) DO NOTHING;

-- Coordinator preset
INSERT INTO permission_preset_modules (preset_name, module_id, access_level)
SELECT 'coordinator', id,
  CASE
    WHEN id IN ('super_admin','settings','team') THEN 'none'::module_access_level
    WHEN id IN ('analytics','finance','crm','sponsorship') THEN 'view'::module_access_level
    ELSE 'edit'::module_access_level
  END
FROM platform_modules
ON CONFLICT (preset_name, module_id) DO NOTHING;

-- View only preset
INSERT INTO permission_preset_modules (preset_name, module_id, access_level)
SELECT 'view_only', id,
  CASE
    WHEN id IN ('super_admin','settings','team') THEN 'none'::module_access_level
    WHEN id = 'dashboard' THEN 'full'::module_access_level
    WHEN id = 'notifications' THEN 'full'::module_access_level
    ELSE 'view'::module_access_level
  END
FROM platform_modules
ON CONFLICT (preset_name, module_id) DO NOTHING;

-- ── Helper function: get effective access level ───────────────────────────────
-- Returns access level for a profile+module combination, preferring event override

CREATE OR REPLACE FUNCTION get_module_access(
  p_profile_id UUID,
  p_module_id  TEXT,
  p_event_id   UUID DEFAULT NULL
) RETURNS module_access_level AS $$
DECLARE
  v_level module_access_level;
BEGIN
  -- Try event-specific override first
  IF p_event_id IS NOT NULL THEN
    SELECT access_level INTO v_level
    FROM team_member_permissions
    WHERE profile_id = p_profile_id AND module_id = p_module_id AND event_id = p_event_id
    LIMIT 1;
    IF FOUND THEN RETURN v_level; END IF;
  END IF;

  -- Fall back to platform-wide
  SELECT access_level INTO v_level
  FROM team_member_permissions
  WHERE profile_id = p_profile_id AND module_id = p_module_id AND event_id IS NULL
  LIMIT 1;
  IF FOUND THEN RETURN v_level; END IF;

  -- Check if always-on
  SELECT CASE WHEN is_always_on THEN 'full'::module_access_level ELSE 'none'::module_access_level END
  INTO v_level
  FROM platform_modules
  WHERE id = p_module_id;

  RETURN COALESCE(v_level, 'none'::module_access_level);
END;
$$ LANGUAGE plpgsql STABLE;

-- ── RLS: team_member_permissions ─────────────────────────────────────────────

ALTER TABLE team_member_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_see_own_permissions"
  ON team_member_permissions FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "admins_manage_permissions"
  ON team_member_permissions FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin')
    )
  );


-- ==========================================
-- Migration: 036_messaging.sql
-- ==========================================
-- ============================================================
-- Migration 036: Communication & Messaging
-- event_messages, message_threads, broadcast_messages
-- ============================================================

-- ── Message threads ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_threads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  thread_type   TEXT NOT NULL DEFAULT 'internal'
                CHECK (thread_type IN ('internal','client','vendor','broadcast')),
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','resolved','archived')),
  participants  UUID[] NOT NULL DEFAULT '{}',   -- profile_ids
  last_message_at TIMESTAMPTZ,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_threads_tenant   ON message_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_event    ON message_threads(event_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_type     ON message_threads(thread_type);

-- ── Messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  sender_id     UUID REFERENCES profiles(id),
  sender_name   TEXT,                          -- fallback for external senders
  message       TEXT NOT NULL,
  message_type  TEXT NOT NULL DEFAULT 'text'
                CHECK (message_type IN ('text','system','file')),
  attachments   JSONB DEFAULT '[]',            -- [{name, url, size, mime_type}]
  is_read_by    UUID[] NOT NULL DEFAULT '{}',  -- profile_ids who have read
  reply_to_id   UUID REFERENCES event_messages(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_messages_thread  ON event_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_tenant  ON event_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_event   ON event_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_created ON event_messages(created_at DESC);

-- ── Broadcast messages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  audience        TEXT NOT NULL DEFAULT 'all_team'
                  CHECK (audience IN ('all_team','all_guests','vendors','specific_roles','specific_guests')),
  audience_filter JSONB DEFAULT '{}',          -- {role_ids: [], guest_tags: [], etc.}
  channels        TEXT[] NOT NULL DEFAULT ARRAY['in_app'],  -- in_app, email, sms, whatsapp
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','sent','failed')),
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  sent_count      INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_messages_tenant ON broadcast_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_event  ON broadcast_messages(event_id);

-- ── Announcement pins ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low','normal','high','urgent')),
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_announcements_event ON event_announcements(event_id);

-- ── Updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_message_thread_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE message_threads
  SET last_message_at = NEW.created_at, updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_thread_last_message ON event_messages;
CREATE TRIGGER trg_update_thread_last_message
  AFTER INSERT ON event_messages
  FOR EACH ROW EXECUTE FUNCTION update_message_thread_last_message();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE message_threads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_message_threads"     ON message_threads     USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_event_messages"      ON event_messages      USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_broadcast_messages"  ON broadcast_messages  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_event_announcements" ON event_announcements USING (tenant_id = current_setting('app.tenant_id')::uuid);


-- ==========================================
-- Migration: 037_documents.sql
-- ==========================================
-- ============================================================
-- Migration 037: Document Management
-- event_documents with version control + folder structure
-- ============================================================

CREATE TABLE IF NOT EXISTS event_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  folder_path     TEXT NOT NULL DEFAULT '/',           -- e.g. '/contracts/', '/proposals/'
  document_name   TEXT NOT NULL,
  document_type   TEXT NOT NULL DEFAULT 'other'
                  CHECK (document_type IN (
                    'proposal','contract','invoice','timeline','floor_plan',
                    'mood_board','vendor_list','seating_chart','menu',
                    'runsheet','permit','brief','report','other'
                  )),
  -- Storage: PDF files go to R2; others are external links
  storage_type    TEXT NOT NULL DEFAULT 'upload'
                  CHECK (storage_type IN ('upload','link')),
  file_url        TEXT NOT NULL,                       -- R2 URL for uploads, external URL for links
  file_name       TEXT,
  file_size       BIGINT,                              -- bytes, null for links
  mime_type       TEXT,
  -- Version control
  version         INT NOT NULL DEFAULT 1,
  version_notes   TEXT,
  parent_id       UUID REFERENCES event_documents(id), -- previous version
  is_latest       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Access control
  visibility      TEXT NOT NULL DEFAULT 'team'
                  CHECK (visibility IN ('team','client','vendor','public')),
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status TEXT NOT NULL DEFAULT 'pending'
                  CHECK (approval_status IN ('pending','approved','rejected','not_required')),
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  -- Metadata
  description     TEXT,
  tags            TEXT[] DEFAULT '{}',
  uploaded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_documents_event    ON event_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_event_documents_tenant   ON event_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_documents_type     ON event_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_event_documents_folder   ON event_documents(folder_path);
CREATE INDEX IF NOT EXISTS idx_event_documents_latest   ON event_documents(is_latest) WHERE is_latest = TRUE;

-- ── Document access log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_access_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES event_documents(id) ON DELETE CASCADE,
  accessed_by UUID REFERENCES profiles(id),
  access_type TEXT NOT NULL DEFAULT 'view' CHECK (access_type IN ('view','download','share')),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  TEXT
);

CREATE INDEX IF NOT EXISTS idx_document_access_log_doc ON document_access_log(document_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE event_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_event_documents"
  ON event_documents USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_document_access_log"
  ON document_access_log USING (
    document_id IN (
      SELECT id FROM event_documents WHERE tenant_id = current_setting('app.tenant_id')::uuid
    )
  );

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_event_documents_updated_at ON event_documents;
CREATE TRIGGER set_event_documents_updated_at
  BEFORE UPDATE ON event_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==========================================
-- Migration: 038_permits.sql
-- ==========================================
-- ============================================================
-- Migration 038: Legal & Permits Management
-- event_permits, permit_reminders, legal_documents
-- ============================================================

CREATE TABLE IF NOT EXISTS event_permits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Permit identity
  permit_name       TEXT NOT NULL,
  permit_type       TEXT NOT NULL DEFAULT 'other'
                    CHECK (permit_type IN (
                      'noise_permit','fire_safety','police_permission','food_license',
                      'liquor_license','temporary_structure','road_closure',
                      'drone_permit','pyrotechnics','signage','health_safety',
                      'copyright_music','venue_usage','insurance_certificate','other'
                    )),
  permit_number     TEXT,                               -- official reference number
  issuing_authority TEXT,                               -- e.g. "Municipal Corporation"
  jurisdiction      TEXT,                               -- city / state / country
  -- Dates
  applied_date      DATE,
  issued_date       DATE,
  expiry_date       DATE,
  -- Status
  status            TEXT NOT NULL DEFAULT 'not_started'
                    CHECK (status IN (
                      'not_started','applied','under_review','approved',
                      'rejected','expired','renewal_required','not_required'
                    )),
  rejection_reason  TEXT,
  -- Document storage (PDF only → R2; external links allowed)
  storage_type      TEXT NOT NULL DEFAULT 'link'
                    CHECK (storage_type IN ('upload','link')),
  document_url      TEXT,                               -- R2 URL or external URL
  file_name         TEXT,
  file_size         BIGINT,
  -- Smart / intelligence fields
  auto_reminder_days INT[] NOT NULL DEFAULT '{60,30,14,7,1}', -- days before expiry
  is_critical       BOOLEAN NOT NULL DEFAULT FALSE,     -- blocks event if missing
  cost              NUMERIC(12,2),
  currency          TEXT NOT NULL DEFAULT 'INR',
  -- Metadata
  notes             TEXT,
  assigned_to       UUID REFERENCES profiles(id),
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_permits_event    ON event_permits(event_id);
CREATE INDEX IF NOT EXISTS idx_event_permits_tenant   ON event_permits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_permits_status   ON event_permits(status);
CREATE INDEX IF NOT EXISTS idx_event_permits_expiry   ON event_permits(expiry_date);
CREATE INDEX IF NOT EXISTS idx_event_permits_type     ON event_permits(permit_type);

-- ── Permit reminder log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permit_reminder_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id   UUID NOT NULL REFERENCES event_permits(id) ON DELETE CASCADE,
  days_before INT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_to     UUID REFERENCES profiles(id),
  channel     TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','whatsapp'))
);

CREATE INDEX IF NOT EXISTS idx_permit_reminder_log_permit ON permit_reminder_log(permit_id);

-- ── Legal documents (contracts, NDAs, agreements) ────────────────────────────
-- Note: general event documents are in event_documents (migration 037).
-- This table is specifically for legally-binding agreements requiring signatures.
CREATE TABLE IF NOT EXISTS event_legal_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL DEFAULT 'contract'
                  CHECK (doc_type IN (
                    'contract','nda','mou','vendor_agreement',
                    'client_agreement','insurance_policy','indemnity','other'
                  )),
  doc_name        TEXT NOT NULL,
  parties         TEXT[],                               -- ["Client: ABC Corp", "Company: XYZ Events"]
  -- Storage
  storage_type    TEXT NOT NULL DEFAULT 'link'
                  CHECK (storage_type IN ('upload','link')),
  document_url    TEXT,
  file_name       TEXT,
  file_size       BIGINT,
  -- Signature tracking
  signature_status TEXT NOT NULL DEFAULT 'pending'
                  CHECK (signature_status IN ('pending','partially_signed','fully_signed','voided')),
  signed_date     DATE,
  expiry_date     DATE,
  -- Smart fields
  is_critical     BOOLEAN NOT NULL DEFAULT FALSE,
  auto_reminder_days INT[] NOT NULL DEFAULT '{30,7}',
  -- Metadata
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_legal_docs_event  ON event_legal_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_event_legal_docs_tenant ON event_legal_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_legal_docs_status ON event_legal_documents(signature_status);
CREATE INDEX IF NOT EXISTS idx_event_legal_docs_expiry ON event_legal_documents(expiry_date);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE event_permits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_reminder_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_event_permits"
  ON event_permits USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY "tenant_isolation_permit_reminder_log"
  ON permit_reminder_log USING (
    permit_id IN (
      SELECT id FROM event_permits WHERE tenant_id = current_setting('app.tenant_id')::uuid
    )
  );

CREATE POLICY "tenant_isolation_event_legal_documents"
  ON event_legal_documents USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ── Updated_at triggers ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_event_permits_updated_at ON event_permits;
CREATE TRIGGER set_event_permits_updated_at
  BEFORE UPDATE ON event_permits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_event_legal_docs_updated_at ON event_legal_documents;
CREATE TRIGGER set_event_legal_docs_updated_at
  BEFORE UPDATE ON event_legal_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==========================================
-- Migration: 039_media.sql
-- ==========================================
-- ============================================================
-- Migration 039: Photography & Videography Management
-- ALL media is stored as EXTERNAL LINKS only (no R2 uploads).
-- Google Drive, Dropbox, WeTransfer, YouTube, Vimeo, etc.
-- Only PDFs (<5MB) and small assets go to R2 — not here.
-- ============================================================

CREATE TABLE IF NOT EXISTS event_shot_lists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category      TEXT NOT NULL DEFAULT 'general'
                CHECK (category IN (
                  'pre_event','ceremony','reception','speeches','candid',
                  'group_photos','detail_shots','venue','guests',
                  'performances','behind_scenes','other'
                )),
  shot_name     TEXT NOT NULL,
  description   TEXT,
  priority      TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('must_have','nice_to_have','optional')),
  people_involved TEXT[],              -- names of people needed for the shot
  location      TEXT,                  -- specific location/area at venue
  time_window   TEXT,                  -- e.g. "During cocktail hour"
  reference_url TEXT,                  -- external reference image (Drive/Dropbox link — NO R2)
  is_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  notes         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_shot_lists_event    ON event_shot_lists(event_id);
CREATE INDEX IF NOT EXISTS idx_event_shot_lists_tenant   ON event_shot_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_shot_lists_category ON event_shot_lists(category);

-- ── Media deliverables (external links only) ──────────────────────────────────
-- Every media_url MUST be an external link. This is enforced at application level.
CREATE TABLE IF NOT EXISTS media_deliverables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Categorisation
  media_category  TEXT NOT NULL DEFAULT 'photos'
                  CHECK (media_category IN (
                    'raw_photos','edited_photos','highlight_reel','full_video',
                    'teaser','same_day_edit','drone_footage','behind_scenes',
                    'photo_album','slideshow','social_cuts','other'
                  )),
  deliverable_name TEXT NOT NULL,
  description     TEXT,
  -- External link storage ONLY (no R2 uploads)
  link_type       TEXT NOT NULL DEFAULT 'drive'
                  CHECK (link_type IN (
                    'google_drive','dropbox','wetransfer','youtube','vimeo',
                    'onedrive','frame_io','smugmug','flickr','other'
                  )),
  media_url       TEXT NOT NULL,        -- external URL
  password_hint   TEXT,                 -- if link is password protected
  -- WeTransfer expiry tracking (links expire in 7 days)
  is_wetransfer   BOOLEAN NOT NULL DEFAULT FALSE,
  wetransfer_expiry DATE,               -- manually entered expiry date
  -- Metadata
  file_count      INT,                  -- approximate count of files
  total_size_gb   NUMERIC(6,2),         -- approximate size
  duration_mins   INT,                  -- for video deliverables
  resolution      TEXT,                 -- e.g. "4K", "1080p", "RAW"
  -- Status & review
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
                    'pending','uploaded_by_vendor','under_review',
                    'approved','revision_requested','delivered_to_client'
                  )),
  revision_notes  TEXT,
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  -- Deadline
  delivery_deadline DATE,
  delivered_at    TIMESTAMPTZ,
  -- Vendor linkage
  vendor_id       UUID REFERENCES vendors(id),
  -- Metadata
  tags            TEXT[] DEFAULT '{}',
  uploaded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_deliverables_event    ON media_deliverables(event_id);
CREATE INDEX IF NOT EXISTS idx_media_deliverables_tenant   ON media_deliverables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_media_deliverables_category ON media_deliverables(media_category);
CREATE INDEX IF NOT EXISTS idx_media_deliverables_status   ON media_deliverables(status);
CREATE INDEX IF NOT EXISTS idx_media_deliverables_deadline ON media_deliverables(delivery_deadline);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE event_shot_lists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_deliverables  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_event_shot_lists"
  ON event_shot_lists USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY "tenant_isolation_media_deliverables"
  ON media_deliverables USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ── Updated_at triggers ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_event_shot_lists_updated_at ON event_shot_lists;
CREATE TRIGGER set_event_shot_lists_updated_at
  BEFORE UPDATE ON event_shot_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_media_deliverables_updated_at ON media_deliverables;
CREATE TRIGGER set_media_deliverables_updated_at
  BEFORE UPDATE ON media_deliverables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==========================================
-- Migration: 040_decor.sql
-- ==========================================
-- ============================================================
-- Migration 040: Décor Management
-- decor_zones, decor_items with external reference image links
-- NOTE: No media uploads. All reference images = external URLs only.
-- ============================================================

CREATE TABLE IF NOT EXISTS decor_zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  zone_name     TEXT NOT NULL,          -- e.g. "Mandap", "Entrance", "Stage"
  zone_type     TEXT NOT NULL DEFAULT 'general'
                CHECK (zone_type IN (
                  'entrance','mandap','stage','dining_area','lounge',
                  'photo_booth','bar','dessert_table','kids_zone',
                  'ceremony','reception','cocktail_area','other'
                )),
  description   TEXT,
  color_palette TEXT[],                 -- e.g. ["#FFD700", "#FFFFFF", "#1A1A2E"]
  theme         TEXT,                   -- e.g. "Royal Gold", "Rustic Boho"
  budget        NUMERIC(12,2),
  currency      TEXT NOT NULL DEFAULT 'INR',
  actual_cost   NUMERIC(12,2),
  status        TEXT NOT NULL DEFAULT 'planning'
                CHECK (status IN ('planning','confirmed','in_progress','installed','dismantled')),
  sort_order    INT NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decor_zones_event  ON decor_zones(event_id);
CREATE INDEX IF NOT EXISTS idx_decor_zones_tenant ON decor_zones(tenant_id);

-- ── Décor items ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decor_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  zone_id         UUID REFERENCES decor_zones(id) ON DELETE SET NULL,
  item_name       TEXT NOT NULL,
  item_category   TEXT NOT NULL DEFAULT 'floral'
                  CHECK (item_category IN (
                    'floral','draping','lighting','furniture','props',
                    'centrepiece','backdrop','signage','candles','balloon',
                    'fabric','greenery','water_feature','stationary_props','other'
                  )),
  -- Reference images (EXTERNAL LINKS ONLY — no R2 uploads)
  reference_images TEXT[] DEFAULT '{}',   -- Google Drive / Pinterest / Dropbox URLs
  -- Quantity & sourcing
  quantity        INT NOT NULL DEFAULT 1,
  unit            TEXT NOT NULL DEFAULT 'piece',  -- piece, metre, set, bunch
  source          TEXT NOT NULL DEFAULT 'vendor'
                  CHECK (source IN ('vendor','rental','purchase','client_provided','in_house')),
  vendor_id       UUID REFERENCES vendors(id),
  -- Pricing
  unit_cost       NUMERIC(12,2),
  total_cost      NUMERIC(12,2) GENERATED ALWAYS AS (
                    CASE WHEN unit_cost IS NOT NULL THEN unit_cost * quantity ELSE NULL END
                  ) STORED,
  currency        TEXT NOT NULL DEFAULT 'INR',
  -- Status
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
                    'pending','ordered','confirmed','delivered','installed','returned','cancelled'
                  )),
  -- Logistics
  delivery_date   DATE,
  installation_time TEXT,               -- e.g. "2 hrs before event"
  dismantling_time TEXT,
  -- Metadata
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decor_items_event    ON decor_items(event_id);
CREATE INDEX IF NOT EXISTS idx_decor_items_tenant   ON decor_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decor_items_zone     ON decor_items(zone_id);
CREATE INDEX IF NOT EXISTS idx_decor_items_category ON decor_items(item_category);
CREATE INDEX IF NOT EXISTS idx_decor_items_status   ON decor_items(status);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE decor_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE decor_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_decor_zones"
  ON decor_zones USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_decor_items"
  ON decor_items USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Updated_at triggers
DROP TRIGGER IF EXISTS set_decor_zones_updated_at ON decor_zones;
CREATE TRIGGER set_decor_zones_updated_at
  BEFORE UPDATE ON decor_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_decor_items_updated_at ON decor_items;
CREATE TRIGGER set_decor_items_updated_at
  BEFORE UPDATE ON decor_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==========================================
-- Migration: 041_platform_settings.sql
-- ==========================================
-- ============================================================
-- Migration 041: Platform Settings
-- Global platform-level settings controlled by Super Admin only.
-- ai_enabled: master toggle for ALL AI features across all tenants.
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,   -- e.g. 'ai_enabled'
  value         JSONB NOT NULL,          -- flexible: true/false, string, object
  description   TEXT,
  updated_by    UUID REFERENCES profiles(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults
INSERT INTO platform_settings (key, value, description) VALUES
  ('ai_api_enabled', 'false'::jsonb,
   'Master toggle for AI API features only (OpenAI/Anthropic/LiteLLM calls). Rule-based smart features (health scores, budget alerts, duplicate detection, smart seating, etc.) always run regardless of this setting.'),
  ('platform_name', '"OccasionPro"'::jsonb,
   'Platform display name used in emails and UI'),
  ('maintenance_mode', 'false'::jsonb,
   'When true, platform shows maintenance page to all non-super-admin users'),
  ('max_tenants', '1000'::jsonb,
   'Hard cap on tenant count — 0 = unlimited'),
  ('default_plan', '"starter"'::jsonb,
   'Plan assigned to newly registered tenants')
ON CONFLICT (key) DO NOTHING;

-- Only super admins can touch this table (application-level enforcement)
-- No tenant_id — this is global
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_only_platform_settings"
  ON platform_settings
  USING (
    EXISTS (
      SELECT 1 FROM super_admins sa
      WHERE sa.profile_id = auth.uid() AND sa.is_active = true
    )
  );

-- Allow anonymous/service reads for the ai_enabled key (needed for guards)
CREATE POLICY "service_read_platform_settings"
  ON platform_settings FOR SELECT
  USING (true);  -- read is unrestricted; writes are super-admin-only above

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER set_platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==========================================
-- Migration: 042_printing_stationery.sql
-- ==========================================
-- ============================================================
-- Migration 042: Printing & Stationery Management
-- Covers all printed collateral for events:
-- invitations, menus, seating charts, signage, badges, programs,
-- favour tags, thank-you cards, table numbers, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS print_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Item metadata
  item_name       TEXT NOT NULL,
  item_type       TEXT NOT NULL DEFAULT 'invitation'
                  CHECK (item_type IN (
                    'invitation','menu_card','seating_chart','place_card','name_badge',
                    'programme','signage','banner','table_number','thank_you_card',
                    'favour_tag','envelope','rsvp_card','direction_sign','photo_booth_prop',
                    'cake_topper','welcome_board','backdrop_print','other'
                  )),
  -- Design & specs
  design_status   TEXT NOT NULL DEFAULT 'not_started'
                  CHECK (design_status IN (
                    'not_started','in_design','design_review','design_approved',
                    'sent_to_print','printing','ready_for_collection','delivered','cancelled'
                  )),
  design_file_url TEXT,                          -- External link (Drive, Dropbox, etc.) to design file
  proof_url       TEXT,                          -- External link to print proof
  -- Print specs
  quantity        INT NOT NULL DEFAULT 1,
  paper_size      TEXT DEFAULT 'A5',             -- A4, A5, A6, DL, custom
  paper_type      TEXT DEFAULT 'matte',          -- matte, glossy, silk, kraft, recycled
  finish          TEXT DEFAULT 'none',           -- none, lamination, spot_uv, foiling, emboss
  color_mode      TEXT DEFAULT 'full_color'
                  CHECK (color_mode IN ('full_color','black_white','pantone')),
  bleed_mm        NUMERIC(4,1) DEFAULT 3,
  -- Vendor & cost
  vendor_id       UUID REFERENCES vendors(id),
  unit_cost       NUMERIC(10,2),
  total_cost      NUMERIC(12,2) GENERATED ALWAYS AS (
                    CASE WHEN unit_cost IS NOT NULL THEN unit_cost * quantity ELSE NULL END
                  ) STORED,
  currency        TEXT NOT NULL DEFAULT 'INR',
  -- Logistics
  design_due_date DATE,
  print_due_date  DATE,
  delivery_date   DATE,
  -- Notes
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_items_event    ON print_items(event_id);
CREATE INDEX IF NOT EXISTS idx_print_items_tenant   ON print_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_print_items_type     ON print_items(item_type);
CREATE INDEX IF NOT EXISTS idx_print_items_status   ON print_items(design_status);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE print_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_print_items"
  ON print_items USING (tenant_id = current_setting('app.tenant_id')::uuid);

DROP TRIGGER IF EXISTS set_print_items_updated_at ON print_items;
CREATE TRIGGER set_print_items_updated_at
  BEFORE UPDATE ON print_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==========================================
-- Migration: 043_feedback_surveys.sql
-- ==========================================
-- ============================================================
-- Migration 043: Feedback & Surveys
-- Post-event surveys, real-time feedback forms, NPS tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS event_surveys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  survey_type     TEXT NOT NULL DEFAULT 'post_event'
                  CHECK (survey_type IN (
                    'post_event','mid_event','vendor_rating','staff_rating',
                    'nps','session_feedback','catering_feedback','other'
                  )),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','active','closed','archived')),
  -- Distribution
  target_audience TEXT NOT NULL DEFAULT 'all_guests'
                  CHECK (target_audience IN ('all_guests','vip_only','staff_only','vendors','custom')),
  send_channel    TEXT[] DEFAULT '{}',             -- 'email','whatsapp','sms','qr_code'
  public_url_slug TEXT UNIQUE,                     -- for QR code landing page
  -- Timing
  opens_at        TIMESTAMPTZ,
  closes_at       TIMESTAMPTZ,
  auto_send_after_hours INT DEFAULT 2,             -- send X hours after event ends
  -- NPS
  nps_score_avg   NUMERIC(4,2),                    -- computed on response submission
  -- Metadata
  response_count  INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Survey questions
CREATE TABLE IF NOT EXISTS survey_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES event_surveys(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  question_type   TEXT NOT NULL DEFAULT 'rating'
                  CHECK (question_type IN (
                    'rating','nps','text','multiple_choice','checkbox',
                    'yes_no','scale_1_10','emoji','ranking'
                  )),
  is_required     BOOLEAN NOT NULL DEFAULT true,
  options         TEXT[] DEFAULT '{}',             -- for multiple_choice/checkbox
  min_label       TEXT,                            -- for scale questions
  max_label       TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Survey responses
CREATE TABLE IF NOT EXISTS survey_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES event_surveys(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Respondent (can be anonymous)
  respondent_name TEXT,
  respondent_email TEXT,
  guest_id        UUID REFERENCES guests(id),
  is_anonymous    BOOLEAN NOT NULL DEFAULT false,
  -- Answers stored as JSONB array: [{question_id, answer}]
  answers         JSONB NOT NULL DEFAULT '[]',
  -- Computed scores
  nps_score       INT CHECK (nps_score BETWEEN 0 AND 10),
  overall_rating  NUMERIC(3,1),
  -- Metadata
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_surveys_event     ON event_surveys(event_id);
CREATE INDEX IF NOT EXISTS idx_event_surveys_tenant    ON event_surveys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_surveys_status    ON event_surveys(status);
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON survey_questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_event  ON survey_responses(event_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_tenant ON survey_responses(tenant_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE event_surveys     ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_event_surveys"
  ON event_surveys USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_survey_questions"
  ON survey_questions USING (
    EXISTS (SELECT 1 FROM event_surveys es WHERE es.id = survey_id
            AND es.tenant_id = current_setting('app.tenant_id')::uuid)
  );
CREATE POLICY "tenant_isolation_survey_responses"
  ON survey_responses USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Public read for active surveys (for QR code landing page)
CREATE POLICY "public_read_active_surveys"
  ON event_surveys FOR SELECT USING (status = 'active');

DROP TRIGGER IF EXISTS set_event_surveys_updated_at ON event_surveys;
CREATE TRIGGER set_event_surveys_updated_at
  BEFORE UPDATE ON event_surveys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==========================================
-- Migration: 044_health_safety.sql
-- ==========================================
-- ============================================================
-- Migration 044: Health & Safety Module
-- Safety checklists, incident reports, emergency contacts,
-- medical stations, capacity enforcement, zone management
-- ============================================================

-- ── Safety Checklists ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_checklists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  checklist_type  TEXT NOT NULL DEFAULT 'general'
                  CHECK (checklist_type IN ('general','venue','fire','medical','crowd','evacuation','vendor','electrical','stage','custom')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','completed','failed')),
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES profiles(id),
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Checklist Items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_checklist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id    UUID NOT NULL REFERENCES safety_checklists(id) ON DELETE CASCADE,
  item_text       TEXT NOT NULL,
  is_required     BOOLEAN NOT NULL DEFAULT true,
  is_checked      BOOLEAN NOT NULL DEFAULT false,
  checked_by      UUID REFERENCES profiles(id),
  checked_at      TIMESTAMPTZ,
  notes           TEXT,
  order_index     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Incident Reports ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  incident_type   TEXT NOT NULL DEFAULT 'medical'
                  CHECK (incident_type IN ('medical','security','fire','crowd','property_damage','weather','technical','slip_fall','other')),
  severity        TEXT NOT NULL DEFAULT 'low'
                  CHECK (severity IN ('low','medium','high','critical')),
  title           TEXT NOT NULL,
  description     TEXT,
  location        TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reported_by     UUID REFERENCES profiles(id),
  injured_count   INTEGER DEFAULT 0,
  response_taken  TEXT,
  resolved        BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  follow_up_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Emergency Contacts ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_emergency_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'general'
                  CHECK (role IN ('event_manager','security_head','medical_officer','fire_marshal','police','ambulance','fire_brigade','venue_manager','client','vip_liaison','general')),
  phone           TEXT NOT NULL,
  alternate_phone TEXT,
  email           TEXT,
  is_on_site      BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Medical Stations ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_medical_stations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  location        TEXT NOT NULL,
  station_type    TEXT NOT NULL DEFAULT 'first_aid'
                  CHECK (station_type IN ('first_aid','ambulance','doctor','nurse','medical_team')),
  capacity        INTEGER DEFAULT 1,
  staff_count     INTEGER DEFAULT 1,
  equipment       TEXT[],
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Event Safety Summary (per-event config) ────────────────
CREATE TABLE IF NOT EXISTS event_safety_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  venue_capacity        INTEGER,
  max_crowd_density_pct INTEGER DEFAULT 90, -- Alert at this % of venue_capacity
  first_aiders_required INTEGER,            -- Calculated: 1 per 50 guests
  security_ratio        TEXT DEFAULT '1:50', -- 1 security per N guests
  evacuation_time_mins  INTEGER DEFAULT 10,
  medical_plan_url      TEXT,
  emergency_plan_url    TEXT,
  safety_briefing_done  BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_safety_checklists_event ON safety_checklists(event_id);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_event ON safety_incidents(event_id);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_severity ON safety_incidents(severity, resolved);
CREATE INDEX IF NOT EXISTS idx_safety_emergency_contacts_event ON safety_emergency_contacts(event_id);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE safety_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_medical_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_safety_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_safety_checklists" ON safety_checklists
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY "tenant_checklist_items" ON safety_checklist_items
  USING (EXISTS (SELECT 1 FROM safety_checklists sc WHERE sc.id = checklist_id AND sc.tenant_id = current_setting('app.current_tenant_id')::UUID));
CREATE POLICY "tenant_incidents" ON safety_incidents
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY "tenant_emergency_contacts" ON safety_emergency_contacts
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY "tenant_medical_stations" ON safety_medical_stations
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY "tenant_safety_config" ON event_safety_config
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Triggers ───────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_safety_checklists_updated_at ON safety_checklists;
CREATE TRIGGER set_safety_checklists_updated_at BEFORE UPDATE ON safety_checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_safety_incidents_updated_at ON safety_incidents;
CREATE TRIGGER set_safety_incidents_updated_at BEFORE UPDATE ON safety_incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_event_safety_config_updated_at ON event_safety_config;
CREATE TRIGGER set_event_safety_config_updated_at BEFORE UPDATE ON event_safety_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==========================================
-- Migration: 045_super_admin_platform_control.sql
-- ==========================================
-- ============================================================
-- 045: Super Admin Full Platform Control
-- Automation-first architecture: all tables support both
-- automated operations AND manual super-admin overrides.
-- ============================================================

-- ─── Subscription Plans ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,           -- 'starter', 'pro', 'enterprise'
  display_name    TEXT NOT NULL,
  description     TEXT,
  price_monthly   NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly    NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'INR',
  max_events      INTEGER NOT NULL DEFAULT 5,
  max_users       INTEGER NOT NULL DEFAULT 3,
  max_guests      INTEGER NOT NULL DEFAULT 500,
  storage_gb      NUMERIC(6,2) NOT NULL DEFAULT 1,
  modules         JSONB NOT NULL DEFAULT '[]',    -- array of module keys included
  features        JSONB NOT NULL DEFAULT '{}',    -- feature flag overrides
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  razorpay_plan_id TEXT,                          -- Razorpay plan ID for auto-billing
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default plans
INSERT INTO subscription_plans (name, display_name, price_monthly, price_yearly, max_events, max_users, max_guests, storage_gb, modules, sort_order)
VALUES
  ('starter', 'Starter', 999, 9990, 5, 3, 500, 1,
   '["events","crm","guests","finance","venues"]', 1),
  ('pro', 'Pro', 2999, 29990, 25, 10, 5000, 10,
   '["events","crm","guests","finance","venues","vendors","inventory","production","hospitality","marketing","support","messaging"]', 2),
  ('business', 'Business', 7999, 79990, 100, 50, 50000, 50,
   '["events","crm","guests","finance","venues","vendors","inventory","production","hospitality","marketing","support","messaging","artists","workforce","analytics","documents","playbooks","permits","media","decor","printing","surveys","health_safety","fnb"]', 3),
  ('enterprise', 'Enterprise', 0, 0, -1, -1, -1, 500,
   '["all"]', 4)
ON CONFLICT (name) DO NOTHING;

-- ─── Super Admin Audit Log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_admin_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by    UUID REFERENCES auth.users(id),
  action          TEXT NOT NULL,                  -- e.g. 'tenant.suspend', 'plan.override', 'impersonate.start'
  target_type     TEXT NOT NULL,                  -- 'tenant', 'user', 'plan', 'platform', 'automation'
  target_id       TEXT,                           -- ID of affected entity
  target_name     TEXT,                           -- human-readable label
  before_value    JSONB,
  after_value     JSONB,
  reason          TEXT,                           -- optional reason/note
  ip_address      INET,
  user_agent      TEXT,
  session_id      TEXT,
  is_automated    BOOLEAN NOT NULL DEFAULT false, -- true = automation wrote this
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_created ON super_admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_target ON super_admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_action ON super_admin_audit_log(action);

-- ─── Tenant Module Settings ──────────────────────────────────────────────────
-- Per-tenant module overrides (plan is the default; this table stores exceptions)
CREATE TABLE IF NOT EXISTS tenant_module_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_key      TEXT NOT NULL,
  is_enabled      BOOLEAN NOT NULL DEFAULT true,
  override_reason TEXT,                            -- why super admin toggled this
  overridden_by   UUID REFERENCES auth.users(id),
  overridden_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, module_key)
);
CREATE INDEX IF NOT EXISTS idx_tenant_module_settings_tenant ON tenant_module_settings(tenant_id);

-- ─── Tenant Payment Config ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_payment_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  razorpay_key_id       TEXT,                     -- stored encrypted via Vault
  razorpay_key_secret   TEXT,                     -- stored encrypted via Vault
  razorpay_webhook_secret TEXT,
  razorpay_account_id   TEXT,                     -- for payouts
  use_platform_keys     BOOLEAN NOT NULL DEFAULT true,  -- false = use tenant's own keys
  payment_enabled       BOOLEAN NOT NULL DEFAULT true,
  test_mode             BOOLEAN NOT NULL DEFAULT false,
  grace_period_days     INTEGER NOT NULL DEFAULT 7,
  auto_suspend_days     INTEGER NOT NULL DEFAULT 30,
  last_payment_at       TIMESTAMPTZ,
  next_billing_date     DATE,
  subscription_id       TEXT,                     -- Razorpay subscription ID
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Tenant AI Config ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_ai_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  ai_api_enabled  BOOLEAN NOT NULL DEFAULT false,  -- follows platform default if null
  provider        TEXT NOT NULL DEFAULT 'platform', -- 'platform'|'openai'|'anthropic'|'ollama'|'litellm'
  api_key         TEXT,                            -- encrypted via Vault
  api_endpoint    TEXT,                            -- for ollama/litellm
  model_name      TEXT,
  tokens_used     BIGINT NOT NULL DEFAULT 0,
  tokens_limit    BIGINT NOT NULL DEFAULT 1000000,
  reset_at        DATE,                            -- monthly reset date
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Automation Job Runs ─────────────────────────────────────────────────────
-- Tracks every automated job execution — primary automation layer
CREATE TABLE IF NOT EXISTS automation_job_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name        TEXT NOT NULL,                  -- 'subscription_scheduler', 'health_updater', etc.
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'running'|'completed'|'failed'|'paused'
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER,
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_affected  INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  result_summary  JSONB,
  triggered_by    TEXT NOT NULL DEFAULT 'scheduler',  -- 'scheduler'|'webhook'|'manual'|'super_admin'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_job_name ON automation_job_runs(job_name, created_at DESC);

-- ─── Automation Job Config ────────────────────────────────────────────────────
-- Super admin can pause/resume automations; tracks last run status
CREATE TABLE IF NOT EXISTS automation_job_config (
  job_name        TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  description     TEXT,
  cron_expression TEXT,
  is_enabled      BOOLEAN NOT NULL DEFAULT true,
  is_paused       BOOLEAN NOT NULL DEFAULT false,  -- manual pause by super admin
  paused_reason   TEXT,
  last_run_at     TIMESTAMPTZ,
  last_run_status TEXT,
  last_error      TEXT,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO automation_job_config (job_name, display_name, description, cron_expression) VALUES
  ('subscription_scheduler', 'Subscription Scheduler', 'Daily: checks due dates, triggers Razorpay charges, handles grace periods', '0 2 * * *'),
  ('tenant_health_updater', 'Tenant Health Updater', 'Hourly: recalculates health scores for all active tenants', '0 * * * *'),
  ('churn_risk_detector', 'Churn Risk Detector', 'Daily: flags at-risk tenants based on activity patterns', '0 4 * * *'),
  ('payment_retry_handler', 'Payment Retry Handler', 'Daily: retries failed payments at 3/7/14 day intervals', '0 3 * * *'),
  ('auto_suspend_enforcer', 'Auto-Suspend Enforcer', 'Daily: suspends tenants with payment overdue >30 days', '0 5 * * *'),
  ('storage_quota_enforcer', 'Storage Quota Enforcer', 'On-upload (event-driven): checks quota before allowing uploads', 'event-driven'),
  ('notification_engine', 'Notification Engine', 'Event-driven (Supabase triggers): fires alerts based on rule conditions', 'event-driven'),
  ('audit_log_archiver', 'Audit Log Archiver', 'Weekly: archives old audit logs to cold storage', '0 1 * * 0')
ON CONFLICT (job_name) DO NOTHING;

-- ─── Tenant Health Scores ─────────────────────────────────────────────────────
-- Written by automation, read by super admin dashboard
CREATE TABLE IF NOT EXISTS tenant_health_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  score           NUMERIC(5,2) NOT NULL DEFAULT 100,  -- 0-100
  grade           TEXT NOT NULL DEFAULT 'A',          -- A/B/C/D/F
  churn_risk      TEXT NOT NULL DEFAULT 'low',        -- 'low'|'medium'|'high'|'critical'
  risk_reasons    JSONB NOT NULL DEFAULT '[]',
  components      JSONB NOT NULL DEFAULT '{}',        -- { activity: 40, billing: 30, ... }
  last_active_at  TIMESTAMPTZ,
  events_30d      INTEGER NOT NULL DEFAULT 0,
  logins_30d      INTEGER NOT NULL DEFAULT 0,
  api_calls_7d    INTEGER NOT NULL DEFAULT 0,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_health_churn ON tenant_health_scores(churn_risk, score);

-- ─── Platform Announcements ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'info',   -- 'info'|'warning'|'critical'|'maintenance'
  target          TEXT NOT NULL DEFAULT 'all',    -- 'all'|'tenant:<id>'|'plan:<name>'
  show_banner     BOOLEAN NOT NULL DEFAULT false,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at         TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON platform_announcements(is_active, starts_at, ends_at);

-- ─── Support Notes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_admin_support_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  note        TEXT NOT NULL,
  tag         TEXT,             -- 'vip'|'at_risk'|'churned'|'general'
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_notes_tenant ON super_admin_support_notes(tenant_id);

-- ─── Impersonation Sessions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_admin_impersonation_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id  UUID NOT NULL REFERENCES auth.users(id),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  impersonated_user_id UUID REFERENCES auth.users(id),
  reason          TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  ip_address      INET,
  actions_taken   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_impersonation_super_admin ON super_admin_impersonation_sessions(super_admin_id, started_at DESC);

-- ─── Extend Tenants Table ─────────────────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_override TEXT,
  ADD COLUMN IF NOT EXISTS plan_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS plan_override_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_override_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_by TEXT DEFAULT 'system',  -- 'system'|'super_admin'
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT NOT NULL DEFAULT 1073741824,  -- 1 GB default
  ADD COLUMN IF NOT EXISTS support_tag TEXT,         -- 'vip'|'at_risk'|'churned'
  ADD COLUMN IF NOT EXISTS churn_risk TEXT NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS health_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_pct INTEGER NOT NULL DEFAULT 0;

-- ─── RLS: Super admin tables are service-role only ────────────────────────────
ALTER TABLE super_admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_payment_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_job_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_support_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Subscription plans are readable by all authenticated users (for plan display)
CREATE POLICY "plans_read_all" ON subscription_plans FOR SELECT TO authenticated USING (true);

-- Announcements readable by all authenticated
CREATE POLICY "announcements_read_active" ON platform_announcements FOR SELECT TO authenticated
  USING (is_active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));

-- Tenant module settings readable by own tenant users
CREATE POLICY "module_settings_tenant_read" ON tenant_module_settings FOR SELECT TO authenticated
  USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

-- AI config readable by own tenant
CREATE POLICY "ai_config_tenant_read" ON tenant_ai_config FOR SELECT TO authenticated
  USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

-- Health scores readable by own tenant
CREATE POLICY "health_scores_tenant_read" ON tenant_health_scores FOR SELECT TO authenticated
  USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

-- All other super_admin tables: service role only (no user-level RLS needed)
-- The NestJS super admin service uses serviceClient which bypasses RLS

-- ─── Updated_at triggers ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscription_plans_updated_at') THEN
DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON subscription_plans;
    CREATE TRIGGER trg_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tenant_module_settings_updated_at') THEN
DROP TRIGGER IF EXISTS trg_tenant_module_settings_updated_at ON tenant_module_settings;
    CREATE TRIGGER trg_tenant_module_settings_updated_at BEFORE UPDATE ON tenant_module_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tenant_payment_config_updated_at') THEN
DROP TRIGGER IF EXISTS trg_tenant_payment_config_updated_at ON tenant_payment_config;
    CREATE TRIGGER trg_tenant_payment_config_updated_at BEFORE UPDATE ON tenant_payment_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tenant_ai_config_updated_at') THEN
DROP TRIGGER IF EXISTS trg_tenant_ai_config_updated_at ON tenant_ai_config;
    CREATE TRIGGER trg_tenant_ai_config_updated_at BEFORE UPDATE ON tenant_ai_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ─── Function: write_audit_log (callable from service role) ───────────────────
CREATE OR REPLACE FUNCTION write_super_admin_audit(
  p_action TEXT,
  p_target_type TEXT,
  p_target_id TEXT DEFAULT NULL,
  p_target_name TEXT DEFAULT NULL,
  p_before_value JSONB DEFAULT NULL,
  p_after_value JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_is_automated BOOLEAN DEFAULT false
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO super_admin_audit_log (
    action, target_type, target_id, target_name,
    before_value, after_value, reason, ip_address, is_automated
  ) VALUES (
    p_action, p_target_type, p_target_id, p_target_name,
    p_before_value, p_after_value, p_reason, p_ip_address::inet, p_is_automated
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


-- ==========================================
-- Migration: 046_payment_multi_provider.sql
-- ==========================================
-- ============================================================
-- Migration 046: Multi-Provider Payment Architecture
-- ============================================================
-- Extends tenant_payment_config with all provider credentials.
-- Creates invoice_payments (offline + online confirmed receipts).
-- Creates invoice_payment_attempts (payment link tracking).
-- ============================================================

-- ─── 1. Extend tenant_payment_config ─────────────────────────────────────────

ALTER TABLE tenant_payment_config
  -- Stripe
  ADD COLUMN IF NOT EXISTS stripe_publishable_key  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_secret_key       TEXT,

  -- PayU
  ADD COLUMN IF NOT EXISTS payu_merchant_key       TEXT,
  ADD COLUMN IF NOT EXISTS payu_salt               TEXT,

  -- Cashfree
  ADD COLUMN IF NOT EXISTS cashfree_app_id         TEXT,
  ADD COLUMN IF NOT EXISTS cashfree_secret_key     TEXT,

  -- PayPal
  ADD COLUMN IF NOT EXISTS paypal_client_id        TEXT,
  ADD COLUMN IF NOT EXISTS paypal_client_secret    TEXT,

  -- Instamojo
  ADD COLUMN IF NOT EXISTS instamojo_api_key       TEXT,
  ADD COLUMN IF NOT EXISTS instamojo_auth_token    TEXT,

  -- General flags (already may exist from 045 — add IF NOT EXISTS)
  ADD COLUMN IF NOT EXISTS payment_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_payment_at         TIMESTAMPTZ;

-- Ensure the provider column has the full enum set
DO $$
BEGIN
  -- Alter type if it's a CHECK constraint (handle both approaches)
  ALTER TABLE tenant_payment_config
    DROP CONSTRAINT IF EXISTS tenant_payment_config_provider_check;

  ALTER TABLE tenant_payment_config
    ADD CONSTRAINT tenant_payment_config_provider_check
    CHECK (provider IN ('manual','razorpay','stripe','payu','cashfree','paypal','instamojo'));
EXCEPTION
  WHEN others THEN NULL; -- ignore if column doesn't have this constraint
END $$;

-- ─── 2. invoice_payments (confirmed payment receipts) ────────────────────────
-- Stores both offline payments (cash/cheque/NEFT/etc.) and
-- confirmed online payments (webhook-confirmed or manually verified).

CREATE TABLE IF NOT EXISTS invoice_payments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Amount
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency         CHAR(3)     NOT NULL DEFAULT 'INR',

  -- Payment classification
  method           TEXT        NOT NULL DEFAULT 'cash'
                   CHECK (method IN ('cash','cheque','neft','rtgs','upi','card','online','other')),
  is_offline       BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Status
  status           TEXT        NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('pending','confirmed','failed','refunded')),

  -- Online payment reference (NULL for offline)
  provider         TEXT,       -- razorpay | stripe | payu | cashfree | paypal | instamojo
  provider_payment_id TEXT,    -- provider's payment/capture ID
  payment_attempt_id  UUID,    -- FK to invoice_payment_attempts if originated from a link

  -- Offline payment details
  reference_number TEXT,       -- cheque no / UTR / UPI ref
  payment_date     DATE,
  notes            TEXT,
  received_by      TEXT,       -- staff member name

  -- Audit
  recorded_by      UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice    ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant     ON invoice_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_status     ON invoice_payments(status);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date       ON invoice_payments(payment_date);

-- ─── 3. invoice_payment_attempts (payment link tracking) ─────────────────────
-- Every time a "Send Payment Link" action is triggered, a record is created here.
-- Tracks the lifecycle: pending → paid / failed / expired.

CREATE TABLE IF NOT EXISTS invoice_payment_attempts (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id           UUID    NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id            UUID    REFERENCES tenants(id) ON DELETE SET NULL,

  -- Provider info
  provider             TEXT    NOT NULL,
  provider_payment_id  TEXT,   -- link/order/request ID from the provider
  payment_url          TEXT,   -- the URL sent to the customer

  -- Amount at time of link creation
  amount               NUMERIC(12,2),
  currency             CHAR(3) DEFAULT 'INR',

  -- Lifecycle
  status               TEXT    NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','paid','failed','expired','cancelled')),
  expires_at           TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,

  -- Metadata
  customer_email       TEXT,
  customer_phone       TEXT,
  webhook_payload      JSONB,  -- raw webhook data from provider for audit

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_invoice    ON invoice_payment_attempts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_provider   ON invoice_payment_attempts(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status     ON invoice_payment_attempts(status);

-- ─── 4. Add FK from invoice_payments to invoice_payment_attempts ─────────────

DO $$ BEGIN
  ALTER TABLE invoice_payments
    ADD CONSTRAINT fk_invoice_payments_attempt
    FOREIGN KEY (payment_attempt_id)
    REFERENCES invoice_payment_attempts(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 5. Trigger: auto-update updated_at ──────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_payments_updated_at ON invoice_payments;
CREATE TRIGGER trg_invoice_payments_updated_at
  BEFORE UPDATE ON invoice_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payment_attempts_updated_at ON invoice_payment_attempts;
CREATE TRIGGER trg_payment_attempts_updated_at
  BEFORE UPDATE ON invoice_payment_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 6. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE invoice_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payment_attempts ENABLE ROW LEVEL SECURITY;

-- Tenant isolation: users can only see their own tenant's payment records.
-- Super admin bypasses via service role client.

CREATE POLICY invoice_payments_tenant_isolation
  ON invoice_payments
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY payment_attempts_tenant_isolation
  ON invoice_payment_attempts
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- ─── 7. Vault-ready column comments ──────────────────────────────────────────
-- These columns hold provider credentials. In production, values should be
-- encrypted at rest via Supabase Vault or your KMS.

COMMENT ON COLUMN tenant_payment_config.razorpay_key_secret    IS 'SENSITIVE: encrypt via Vault in production';
COMMENT ON COLUMN tenant_payment_config.stripe_secret_key      IS 'SENSITIVE: encrypt via Vault in production';
COMMENT ON COLUMN tenant_payment_config.payu_salt              IS 'SENSITIVE: encrypt via Vault in production';
COMMENT ON COLUMN tenant_payment_config.cashfree_secret_key    IS 'SENSITIVE: encrypt via Vault in production';
COMMENT ON COLUMN tenant_payment_config.paypal_client_secret   IS 'SENSITIVE: encrypt via Vault in production';
COMMENT ON COLUMN tenant_payment_config.instamojo_auth_token   IS 'SENSITIVE: encrypt via Vault in production';


-- ==========================================
-- Migration: 047_realtime_cross_module_triggers.sql
-- ==========================================
-- ============================================================
-- Migration 047: Cross-Module Real-time Triggers
-- All modules interconnected via PostgreSQL triggers.
-- Changes in one module propagate to dependent modules instantly.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- ENABLE REALTIME on all core tables
-- ─────────────────────────────────────────────────────────────

-- Note: In Supabase, realtime is enabled per-publication.
-- Run these in Supabase dashboard or via CLI:
-- ALTER PUBLICATION supabase_realtime ADD TABLE guests;
-- (Listed here for documentation — Supabase runs these via the dashboard toggle)

-- ─────────────────────────────────────────────────────────────
-- HELPER: notify_module_change
-- Broadcasts a custom NOTIFY event for edge functions / API to pick up
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_module_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify(
    'module_change',
    json_build_object(
      'table',   TG_TABLE_NAME,
      'event',   TG_OP,
      'tenant',  COALESCE(NEW.tenant_id, OLD.tenant_id),
      'event_id',COALESCE(NEW.event_id, OLD.event_id),
      'id',      COALESCE(NEW.id, OLD.id),
      'ts',      extract(epoch from now())
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 1. GUEST CHECK-IN → Multiple modules
-- When a guest checks in:
--   a) Update event check-in counters
--   b) Decrement F&B token availability
--   c) Update floor plan presence
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_guest_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_id uuid := NEW.event_id;
BEGIN
  -- Only fire when status changes TO checked_in
  IF NEW.check_in_status = 'checked_in' AND (OLD.check_in_status IS DISTINCT FROM 'checked_in') THEN

    -- Update event live counters (if events table has these counters)
    UPDATE events
    SET
      live_checkin_count = COALESCE(live_checkin_count, 0) + 1,
      updated_at = now()
    WHERE id = v_event_id;

    -- Decrement token count for this guest (meal token auto-issued on check-in)
    -- Only if F&B token system is enabled for this event
    UPDATE fnb_serving_sessions
    SET
      tokens_redeemed = COALESCE(tokens_redeemed, 0) + 1,
      updated_at = now()
    WHERE event_id = v_event_id
      AND is_token_system = true
      AND session_type = 'main_meal';

    -- Recalculate event health score
    PERFORM recalculate_event_health(v_event_id);

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_guest_checkin ON guests;
CREATE TRIGGER on_guest_checkin
  AFTER UPDATE ON guests
  FOR EACH ROW
  EXECUTE FUNCTION handle_guest_checkin();

-- ─────────────────────────────────────────────────────────────
-- 2. GUEST RSVP CHANGE → Health score + headcount + F&B
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_rsvp_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.rsvp_status IS DISTINCT FROM NEW.rsvp_status THEN
    -- Recalculate event health score (includes headcount prediction)
    PERFORM recalculate_event_health(NEW.event_id);

    -- Update event RSVP counts cache
    UPDATE events SET
      rsvp_yes_count = (
        SELECT COUNT(*) FROM guests
        WHERE event_id = NEW.event_id AND rsvp_status = 'confirmed'
      ),
      rsvp_no_count = (
        SELECT COUNT(*) FROM guests
        WHERE event_id = NEW.event_id AND rsvp_status = 'declined'
      ),
      rsvp_pending_count = (
        SELECT COUNT(*) FROM guests
        WHERE event_id = NEW.event_id AND rsvp_status = 'pending'
      ),
      updated_at = now()
    WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_rsvp_change ON guests;
CREATE TRIGGER on_rsvp_change
  AFTER UPDATE ON guests
  FOR EACH ROW
  EXECUTE FUNCTION handle_rsvp_change();

-- ─────────────────────────────────────────────────────────────
-- 3. VENDOR PAYMENT → Budget actuals
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_vendor_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_budget_category_id uuid;
BEGIN
  -- Find the budget item linked to this vendor
  SELECT bc.id INTO v_budget_category_id
  FROM budget_items bi
  JOIN budget_categories bc ON bc.id = bi.category_id
  WHERE bi.vendor_id = NEW.vendor_id
    AND bc.event_id = NEW.event_id
  LIMIT 1;

  IF v_budget_category_id IS NOT NULL THEN
    -- Recalculate actual spend for this budget category
    UPDATE budget_categories
    SET
      actual_amount = (
        SELECT COALESCE(SUM(vp.amount), 0)
        FROM vendor_payments vp
        JOIN vendors v ON v.id = vp.vendor_id
        JOIN budget_items bi ON bi.vendor_id = v.id
        WHERE bi.category_id = budget_categories.id
          AND vp.status = 'completed'
      ),
      updated_at = now()
    WHERE id = v_budget_category_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_vendor_payment ON vendor_payments;
CREATE TRIGGER on_vendor_payment
  AFTER INSERT OR UPDATE ON vendor_payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_vendor_payment();

-- ─────────────────────────────────────────────────────────────
-- 4. INVOICE PAYMENT → Budget actuals + Client balance
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_invoice_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Update invoice paid_amount
  UPDATE invoices
  SET
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM invoice_payments
      WHERE invoice_id = NEW.invoice_id
        AND status = 'confirmed'
    ),
    updated_at = now()
  WHERE id = NEW.invoice_id;

  -- Update invoice status based on payment
  UPDATE invoices
  SET
    status = CASE
      WHEN paid_amount >= total_amount THEN 'paid'
      WHEN paid_amount > 0 THEN 'partially_paid'
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_invoice_payment ON invoice_payments;
CREATE TRIGGER on_invoice_payment
  AFTER INSERT OR UPDATE ON invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_invoice_payment();

-- ─────────────────────────────────────────────────────────────
-- 5. RUNSHEET TASK COMPLETION → Unlock dependencies
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Unlock tasks that were blocked by this task
    UPDATE runsheet_tasks
    SET
      is_locked = false,
      updated_at = now()
    WHERE event_id = NEW.event_id
      AND depends_on_task_id = NEW.id
      AND is_locked = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_task_completion ON runsheet_tasks;
CREATE TRIGGER on_task_completion
  AFTER UPDATE ON runsheet_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_completion();

-- ─────────────────────────────────────────────────────────────
-- 6. ACCOMMODATION ASSIGNMENT → Guest profile update
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_accommodation_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.guest_id IS NOT NULL THEN
    -- Update guest profile with room number
    UPDATE guests
    SET
      accommodation_room_id = NEW.room_id,
      updated_at = now()
    WHERE id = NEW.guest_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_accommodation_assignment ON accommodation_allocations;
CREATE TRIGGER on_accommodation_assignment
  AFTER INSERT OR UPDATE ON accommodation_allocations
  FOR EACH ROW
  EXECUTE FUNCTION handle_accommodation_assignment();

-- ─────────────────────────────────────────────────────────────
-- 7. EVENT HEALTH SCORE — Recalculation function
-- Called by multiple triggers above.
-- Composite score (0-100) based on:
--   - RSVP rate (25%)
--   - Budget utilisation (25%)
--   - Task completion (25%)
--   - Vendor confirmation (25%)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recalculate_event_health(p_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rsvp_score      numeric := 0;
  v_budget_score    numeric := 0;
  v_task_score      numeric := 0;
  v_vendor_score    numeric := 0;
  v_total_guests    integer;
  v_rsvp_confirmed  integer;
  v_total_tasks     integer;
  v_completed_tasks integer;
  v_total_vendors   integer;
  v_confirmed_vendors integer;
  v_budget_used_pct numeric;
  v_health_score    integer;
BEGIN
  -- RSVP score
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE rsvp_status = 'confirmed')
  INTO v_total_guests, v_rsvp_confirmed
  FROM guests
  WHERE event_id = p_event_id AND is_deleted = false;

  IF v_total_guests > 0 THEN
    v_rsvp_score := LEAST(100, (v_rsvp_confirmed::numeric / v_total_guests) * 100);
  ELSE
    v_rsvp_score := 50; -- neutral if no guests yet
  END IF;

  -- Task score
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_total_tasks, v_completed_tasks
  FROM runsheet_tasks
  WHERE event_id = p_event_id AND is_deleted = false;

  IF v_total_tasks > 0 THEN
    v_task_score := (v_completed_tasks::numeric / v_total_tasks) * 100;
  ELSE
    v_task_score := 50;
  END IF;

  -- Vendor score
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'confirmed')
  INTO v_total_vendors, v_confirmed_vendors
  FROM vendors
  WHERE event_id = p_event_id AND is_deleted = false;

  IF v_total_vendors > 0 THEN
    v_vendor_score := (v_confirmed_vendors::numeric / v_total_vendors) * 100;
  ELSE
    v_vendor_score := 50;
  END IF;

  -- Budget score (good if budget < 90% used; bad if over budget)
  SELECT
    CASE
      WHEN SUM(estimated_amount) > 0
      THEN LEAST(100, (COALESCE(SUM(actual_amount), 0) / SUM(estimated_amount)) * 100)
      ELSE 50
    END
  INTO v_budget_used_pct
  FROM budget_categories
  WHERE event_id = p_event_id;

  -- Budget score: 100 if using 0-80%, declining to 0 at 120%+
  v_budget_score := GREATEST(0, LEAST(100, 100 - GREATEST(0, v_budget_used_pct - 80) * 5));

  -- Composite score (equal weights)
  v_health_score := ROUND((v_rsvp_score + v_task_score + v_vendor_score + v_budget_score) / 4);

  -- Update event
  UPDATE events
  SET
    health_score = v_health_score,
    updated_at = now()
  WHERE id = p_event_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. GUEST TABLE — add missing columns if not present
-- ─────────────────────────────────────────────────────────────

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS accommodation_room_id uuid REFERENCES hotel_rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS live_checkin_count integer GENERATED ALWAYS AS (NULL) STORED; -- placeholder, not used directly

-- ─────────────────────────────────────────────────────────────
-- 9. EVENTS TABLE — live counters & health score
-- ─────────────────────────────────────────────────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS health_score integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS live_checkin_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rsvp_yes_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rsvp_no_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rsvp_pending_count integer DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- 10. RUNSHEET TASKS — dependency columns
-- ─────────────────────────────────────────────────────────────

ALTER TABLE runsheet_tasks
  ADD COLUMN IF NOT EXISTS depends_on_task_id uuid REFERENCES runsheet_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- 11. VENDOR PAYMENTS — ensure event_id is present
-- ─────────────────────────────────────────────────────────────

-- vendor_payments links through vendors, but add denormalized event_id for trigger efficiency
ALTER TABLE vendor_payments
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE CASCADE;

-- Backfill event_id from vendors table
UPDATE vendor_payments vp
SET event_id = v.event_id
FROM vendors v
WHERE v.id = vp.vendor_id
  AND vp.event_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 12. F&B SERVING SESSIONS — token tracking columns
-- ─────────────────────────────────────────────────────────────

ALTER TABLE fnb_serving_sessions
  ADD COLUMN IF NOT EXISTS is_token_system boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tokens_issued integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_redeemed integer DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- INDEXES for trigger performance
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_guests_event_rsvp      ON guests(event_id, rsvp_status);
CREATE INDEX IF NOT EXISTS idx_guests_event_checkin    ON guests(event_id, check_in_status);
CREATE INDEX IF NOT EXISTS idx_runsheet_tasks_dep      ON runsheet_tasks(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_event   ON vendor_payments(event_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_inv    ON invoice_payments(invoice_id, status);
CREATE INDEX IF NOT EXISTS idx_accommodation_alloc_guest ON accommodation_allocations(guest_id);


-- ==========================================
-- Migration: 048_guest_portal.sql
-- ==========================================
-- ============================================================
-- Migration 048: Guest Portal System
-- OTP login, per-event settings, section toggles,
-- guest sessions, SMS provider config
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. GUEST PORTAL SETTINGS — per event
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guest_portal_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id              uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,

  -- Login
  login_enabled         boolean NOT NULL DEFAULT false,
  allow_self_register   boolean NOT NULL DEFAULT false,
  otp_delivery          text NOT NULL DEFAULT 'sms' CHECK (otp_delivery IN ('whatsapp','sms','both')),
  session_duration      text NOT NULL DEFAULT '7d' CHECK (session_duration IN ('event_day','7d','30d')),
  not_on_list_message   text DEFAULT 'You''re not on the guest list for this event.',

  -- Branding
  portal_title          text,
  hero_image_url        text,
  brand_color           text DEFAULT '#7c3aed',
  welcome_message       text DEFAULT 'Welcome, {{guest_name}}!',
  footer_text           text,
  hide_powered_by       boolean NOT NULL DEFAULT false,

  -- Sections (toggles)
  section_invitation    boolean NOT NULL DEFAULT true,
  section_rsvp          boolean NOT NULL DEFAULT true,
  section_event_details boolean NOT NULL DEFAULT true,
  section_accommodation boolean NOT NULL DEFAULT true,
  section_transport     boolean NOT NULL DEFAULT true,
  section_meal          boolean NOT NULL DEFAULT true,
  section_qr_code       boolean NOT NULL DEFAULT true,
  section_seating       boolean NOT NULL DEFAULT false,  -- released manually
  section_schedule      boolean NOT NULL DEFAULT true,
  section_gallery       boolean NOT NULL DEFAULT false,  -- added when ready
  section_contact       boolean NOT NULL DEFAULT true,
  section_survey        boolean NOT NULL DEFAULT false,  -- post-event
  section_gift_registry boolean NOT NULL DEFAULT false,
  section_sessions      boolean NOT NULL DEFAULT false,  -- conference only

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. WORKSPACE-LEVEL DEFAULT PORTAL SETTINGS
-- ─────────────────────────────────────────────────────────────

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS guest_portal_enabled_default boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_portal_otp_delivery_default text DEFAULT 'sms',
  ADD COLUMN IF NOT EXISTS sms_provider text DEFAULT 'fast2sms',
  ADD COLUMN IF NOT EXISTS sms_api_key_vault_key text;  -- key in Supabase Vault

-- ─────────────────────────────────────────────────────────────
-- 3. GUEST OTP SESSIONS
-- Short-lived OTP codes + issued guest sessions
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guest_otp_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  mobile       text NOT NULL,
  otp_hash     text NOT NULL,        -- bcrypt hash of 6-digit code
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  attempts     integer NOT NULL DEFAULT 0,
  verified     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Rate-limit index: count OTPs per mobile per event in last 15 min
CREATE INDEX IF NOT EXISTS idx_otp_mobile_event_time ON guest_otp_requests(event_id, mobile, created_at);

CREATE TABLE IF NOT EXISTS guest_portal_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id     uuid REFERENCES guests(id) ON DELETE SET NULL,  -- null if self-registered
  mobile       text NOT NULL,
  session_token_hash text NOT NULL,  -- hashed JWT
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_revoked   boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_event ON guest_portal_sessions(event_id, guest_id);

-- ─────────────────────────────────────────────────────────────
-- 4. GUEST PORTAL MESSAGES (Contact Organiser)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guest_portal_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id    uuid REFERENCES guests(id) ON DELETE SET NULL,
  mobile      text NOT NULL,
  message     text NOT NULL CHECK (length(message) <= 1000),
  read        boolean NOT NULL DEFAULT false,
  replied_at  timestamptz,
  reply_text  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_messages_event ON guest_portal_messages(event_id, read);

-- ─────────────────────────────────────────────────────────────
-- 5. GUESTS TABLE — add portal-related fields
-- ─────────────────────────────────────────────────────────────

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS portal_access_code text,  -- unique short code for personalised URL
  ADD COLUMN IF NOT EXISTS mobile_verified boolean DEFAULT false;

-- Generate portal access codes for existing guests (8-char alphanumeric)
UPDATE guests
SET portal_access_code = upper(substring(md5(id::text || 'op_salt_2026') from 1 for 8))
WHERE portal_access_code IS NULL;

-- Ensure uniqueness via index (not constraint, to avoid migration failure on conflicts)
CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_portal_code ON guests(portal_access_code);

-- ─────────────────────────────────────────────────────────────
-- 6. SHORT LINKS for guest portal
-- Auto-created entries for portal URLs
-- (uses existing short_links table from plan — create if not exists)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS short_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,
  destination_url text NOT NULL,
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        uuid REFERENCES events(id) ON DELETE CASCADE,
  link_type       text,  -- invitation, portal, rsvp, payment, qr, survey, etc.
  guest_id        uuid REFERENCES guests(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  click_count     integer NOT NULL DEFAULT 0,
  last_clicked_at timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  password_hash   text,     -- optional password protection
  custom_alias    text UNIQUE,
  metadata        jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_short_links_code       ON short_links(code);
CREATE INDEX IF NOT EXISTS idx_short_links_event      ON short_links(event_id);
CREATE INDEX IF NOT EXISTS idx_short_links_guest      ON short_links(guest_id);

-- ─────────────────────────────────────────────────────────────
-- 7. CLICK TRACKING
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS short_link_clicks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id     uuid NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
  clicked_at  timestamptz NOT NULL DEFAULT now(),
  device_type text,  -- mobile, desktop, tablet
  country     text,
  city        text,
  user_agent  text,
  referer     text
);

CREATE INDEX IF NOT EXISTS idx_link_clicks_link ON short_link_clicks(link_id, clicked_at);

-- ─────────────────────────────────────────────────────────────
-- 8. RLS POLICIES — Guest Portal
-- ─────────────────────────────────────────────────────────────

ALTER TABLE guest_portal_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_otp_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_portal_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_portal_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_links             ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_link_clicks       ENABLE ROW LEVEL SECURITY;

-- Portal settings: visible/editable to tenant staff only
CREATE POLICY "tenant_portal_settings" ON guest_portal_settings
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- OTP requests: anonymous write allowed (public), read limited to service role
CREATE POLICY "otp_insert_public" ON guest_otp_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "otp_read_service" ON guest_otp_requests
  USING (false);  -- only service role reads OTPs

-- Portal messages: staff can read/reply; guests insert only
CREATE POLICY "staff_read_messages" ON guest_portal_messages
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Short links: tenant staff can manage, public can read active links
CREATE POLICY "tenant_manage_links" ON short_links
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "public_read_active_links" ON short_links
  FOR SELECT USING (is_active = true);

-- ─────────────────────────────────────────────────────────────
-- 9. FUNCTION: generate_portal_short_link
-- Called when an event is published or guest is added
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_guest_portal_code(p_guest_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_code text;
BEGIN
  v_code := upper(substring(md5(p_guest_id::text || extract(epoch from now())::text) from 1 for 8));
  UPDATE guests SET portal_access_code = v_code WHERE id = p_guest_id;
  RETURN v_code;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 10. INDEXES — performance
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_portal_settings_event ON guest_portal_settings(event_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON guest_portal_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expiry ON guest_portal_sessions(expires_at) WHERE is_revoked = false;


-- ==========================================
-- Migration: 049_client_vendor_portals.sql
-- ==========================================
-- ============================================================
-- Migration 049: Client Portal + Vendor Portal Systems
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- CLIENT PORTAL
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text UNIQUE NOT NULL,
  full_name         text NOT NULL,
  phone             text,
  password_hash     text NOT NULL,
  profile_complete  boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_login        timestamptz
);

CREATE TABLE IF NOT EXISTS client_event_access (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id    uuid NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  event_id             uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  access_level         text NOT NULL DEFAULT 'view_only'
                         CHECK (access_level IN ('view_only','collaborator','full_access')),
  invited_by           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  invited_at           timestamptz NOT NULL DEFAULT now(),
  revoked_at           timestamptz,
  -- Per-client section overrides (null = use event default)
  section_overrides    jsonb DEFAULT '{}',
  -- Internal notes (not visible to client)
  internal_notes       text,
  -- Tracking
  last_viewed_at       timestamptz,
  UNIQUE (client_account_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_client_access_event   ON client_event_access(event_id);
CREATE INDEX IF NOT EXISTS idx_client_access_client  ON client_event_access(client_account_id);
CREATE INDEX IF NOT EXISTS idx_client_access_tenant  ON client_event_access(tenant_id);

-- Client Portal Settings (per event)
CREATE TABLE IF NOT EXISTS client_portal_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id              uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  enabled               boolean NOT NULL DEFAULT false,
  section_overview      boolean NOT NULL DEFAULT true,
  section_approvals     boolean NOT NULL DEFAULT true,
  section_budget        boolean NOT NULL DEFAULT true,
  section_payments      boolean NOT NULL DEFAULT true,
  section_documents     boolean NOT NULL DEFAULT true,
  section_timeline      boolean NOT NULL DEFAULT true,
  section_messages      boolean NOT NULL DEFAULT true,
  section_gallery       boolean NOT NULL DEFAULT true,
  section_reports       boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Client approval items
CREATE TABLE IF NOT EXISTS client_approvals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  file_url        text,
  deadline        timestamptz,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','changes_requested','rejected')),
  submitted_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by     uuid REFERENCES client_accounts(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  review_comment  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_approvals_event ON client_approvals(event_id, status);

-- Client password reset tokens
CREATE TABLE IF NOT EXISTS client_password_resets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  used        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- VENDOR PORTAL (persistent accounts)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text UNIQUE NOT NULL,
  full_name         text NOT NULL,
  company_name      text,
  phone             text,
  password_hash     text NOT NULL,
  business_category text,
  gstin             text,
  logo_url          text,
  portfolio_links   jsonb DEFAULT '[]',
  -- Bank details encrypted at app level
  bank_details_enc  text,
  profile_complete  boolean NOT NULL DEFAULT false,
  performance_score numeric(3,2) DEFAULT NULL,  -- 0.00–5.00 computed average
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_login        timestamptz
);

CREATE TABLE IF NOT EXISTS vendor_event_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_account_id   uuid NOT NULL REFERENCES vendor_accounts(id) ON DELETE CASCADE,
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_type        text NOT NULL,
  scope_of_work       text,
  contract_amount     numeric(15,2),
  payment_status      text NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN ('pending','partial','paid','overdue')),
  access_level        text NOT NULL DEFAULT 'standard'
                        CHECK (access_level IN ('basic','standard','full')),
  assigned_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  revoked_at          timestamptz,
  internal_notes      text,  -- not visible to vendor
  last_viewed_at      timestamptz,
  UNIQUE (vendor_account_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_assignments_event   ON vendor_event_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_vendor_assignments_vendor  ON vendor_event_assignments(vendor_account_id);
CREATE INDEX IF NOT EXISTS idx_vendor_assignments_tenant  ON vendor_event_assignments(tenant_id);

-- Vendor Deliverables
CREATE TABLE IF NOT EXISTS vendor_deliverables (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id         uuid NOT NULL REFERENCES vendor_event_assignments(id) ON DELETE CASCADE,
  event_id              uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  description           text,
  due_date              timestamptz,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','in_progress','completed','overdue')),
  completed_at          timestamptz,
  completed_by          uuid REFERENCES vendor_accounts(id) ON DELETE SET NULL,
  created_by            uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_deliverables_assignment ON vendor_deliverables(assignment_id);
CREATE INDEX IF NOT EXISTS idx_vendor_deliverables_event ON vendor_deliverables(event_id, status);

-- Vendor Invoices (submitted by vendor)
CREATE TABLE IF NOT EXISTS vendor_invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id     uuid NOT NULL REFERENCES vendor_event_assignments(id) ON DELETE CASCADE,
  event_id          uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_account_id uuid NOT NULL REFERENCES vendor_accounts(id) ON DELETE CASCADE,
  invoice_number    text,
  amount            numeric(15,2) NOT NULL,
  file_url          text,
  notes             text,
  status            text NOT NULL DEFAULT 'submitted'
                      CHECK (status IN ('submitted','under_review','approved','paid','rejected')),
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at       timestamptz,
  paid_at           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_vendor_invoices_assignment ON vendor_invoices(assignment_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_event ON vendor_invoices(event_id, status);

-- Vendor Ratings (post-event, set by tenant)
CREATE TABLE IF NOT EXISTS vendor_ratings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id     uuid NOT NULL REFERENCES vendor_event_assignments(id) ON DELETE CASCADE UNIQUE,
  vendor_account_id uuid NOT NULL REFERENCES vendor_accounts(id) ON DELETE CASCADE,
  rated_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  quality_score     integer CHECK (quality_score BETWEEN 1 AND 5),
  punctuality_score integer CHECK (punctuality_score BETWEEN 1 AND 5),
  communication_score integer CHECK (communication_score BETWEEN 1 AND 5),
  value_score       integer CHECK (value_score BETWEEN 1 AND 5),
  overall_score     numeric(3,2) GENERATED ALWAYS AS (
    (quality_score + punctuality_score + communication_score + value_score)::numeric / 4
  ) STORED,
  comment           text,
  rated_at          timestamptz NOT NULL DEFAULT now()
);

-- Function: recompute vendor performance_score after rating
CREATE OR REPLACE FUNCTION update_vendor_performance_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE vendor_accounts
  SET performance_score = (
    SELECT ROUND(AVG(overall_score)::numeric, 2)
    FROM vendor_ratings WHERE vendor_account_id = NEW.vendor_account_id
  )
  WHERE id = NEW.vendor_account_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_vendor_rating_score
AFTER INSERT OR UPDATE ON vendor_ratings
FOR EACH ROW EXECUTE FUNCTION update_vendor_performance_score();

-- Vendor password reset tokens
CREATE TABLE IF NOT EXISTS vendor_password_resets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid NOT NULL REFERENCES vendor_accounts(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  used        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- IN-APP NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Recipient
  recipient_id    uuid NOT NULL,
  recipient_type  text NOT NULL CHECK (recipient_type IN (
    'team', 'client', 'vendor', 'guest', 'super_admin'
  )),
  -- Context
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        uuid REFERENCES events(id) ON DELETE SET NULL,
  module          text,   -- budget, vendor, guest, crm, etc.
  -- Content
  type            text NOT NULL,  -- new_rsvp, budget_alert, task_assigned, etc.
  priority        text NOT NULL DEFAULT 'info'
                    CHECK (priority IN ('critical','warning','info','action_required')),
  title           text NOT NULL,
  message         text NOT NULL,
  action_url      text,
  -- State
  is_read         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  read_at         timestamptz,
  -- Auto-archive after 90 days
  expires_at      timestamptz DEFAULT (now() + interval '90 days')
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, recipient_type, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_event     ON notifications(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_expiry    ON notifications(expires_at);

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  user_type       text NOT NULL CHECK (user_type IN ('team','client','vendor','guest')),
  notification_type text NOT NULL,
  in_app          boolean NOT NULL DEFAULT true,
  email           boolean NOT NULL DEFAULT true,
  whatsapp        boolean NOT NULL DEFAULT false,
  quiet_hours_start time,
  quiet_hours_end   time,
  digest_mode     boolean NOT NULL DEFAULT false,
  digest_hour     integer CHECK (digest_hour BETWEEN 0 AND 23),
  UNIQUE (user_id, user_type, notification_type)
);

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ─────────────────────────────────────────────────────────────

ALTER TABLE client_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_event_access     ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_portal_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_approvals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_event_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_deliverables     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_ratings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Notifications: each user sees only their own
CREATE POLICY "notifications_own" ON notifications
  USING (recipient_id = auth.uid()::uuid);

-- Client portal settings: tenant staff only
CREATE POLICY "client_portal_settings_tenant" ON client_portal_settings
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Client approvals: tenant staff can manage, no direct client RLS (service role handles client reads)
CREATE POLICY "client_approvals_tenant" ON client_approvals
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));



-- ==========================================
-- Migration: 050_vendor_portal_tables.sql
-- ==========================================
-- ============================================================
-- Migration 050: Vendor Portal — Additional Tables
-- vendor_documents, vendor_messages, vendor_event_briefs,
-- vendor_password_resets, vendor_deliverables completion fields
-- (vendor_accounts, vendor_event_assignments, vendor_invoices,
--  vendor_ratings are already in migration 049)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. VENDOR PASSWORD RESETS (invite / forgot-password tokens)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_password_resets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid NOT NULL REFERENCES vendor_accounts(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  used        boolean NOT NULL DEFAULT false,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_pwd_resets_vendor ON vendor_password_resets(vendor_id, used, expires_at);

-- ─────────────────────────────────────────────────────────────
-- 2. VENDOR DOCUMENTS (uploaded by vendor or tenant)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES vendor_event_assignments(id) ON DELETE CASCADE,
  name            text NOT NULL,
  file_url        text NOT NULL,
  doc_type        text NOT NULL DEFAULT 'general'
                  CHECK (doc_type IN ('contract','sow','insurance','compliance','invoice','general','other')),
  size_bytes      bigint,
  uploaded_by     text NOT NULL DEFAULT 'vendor' CHECK (uploaded_by IN ('vendor','tenant')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_docs_assignment ON vendor_documents(assignment_id);

-- ─────────────────────────────────────────────────────────────
-- 3. VENDOR MESSAGES (thread per assignment)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES vendor_event_assignments(id) ON DELETE CASCADE,
  sender_type     text NOT NULL CHECK (sender_type IN ('vendor','tenant')),
  sender_id       uuid NOT NULL,   -- vendor_accounts.id or users.id
  message         text NOT NULL CHECK (length(message) <= 2000),
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_msgs_assignment ON vendor_messages(assignment_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- 4. VENDOR EVENT BRIEF (per-event operational briefing)
-- Shared across all vendor assignments for an event
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_event_briefs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Logistics
  setup_time      text,
  teardown_time   text,
  reporting_contact_name  text,
  reporting_contact_phone text,
  venue_address   text,
  parking_info    text,
  load_in_details text,

  -- Day-of schedule (jsonb array of {time, activity, notes})
  schedule        jsonb DEFAULT '[]',

  -- Emergency
  emergency_contact_name  text,
  emergency_contact_phone text,
  emergency_procedures    text,

  -- General notes
  notes           text,

  -- Attire / dress code
  dress_code      text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_briefs_event ON vendor_event_briefs(event_id);

-- ─────────────────────────────────────────────────────────────
-- 5. EXTEND vendor_deliverables with completion fields
-- (base table created in migration 049)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE vendor_deliverables
  ADD COLUMN IF NOT EXISTS completed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS completion_notes  text,
  ADD COLUMN IF NOT EXISTS file_url          text;  -- proof of delivery

-- ─────────────────────────────────────────────────────────────
-- 6. EXTEND vendor_invoices with review + payment fields
-- ─────────────────────────────────────────────────────────────

ALTER TABLE vendor_invoices
  ADD COLUMN IF NOT EXISTS invoice_number    text,
  ADD COLUMN IF NOT EXISTS invoice_date      date,
  ADD COLUMN IF NOT EXISTS due_date          date,
  ADD COLUMN IF NOT EXISTS file_url          text,
  ADD COLUMN IF NOT EXISTS line_items        jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS review_notes      text,
  ADD COLUMN IF NOT EXISTS reviewed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at       timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at           timestamptz;

-- ─────────────────────────────────────────────────────────────
-- 7. EXTEND vendor_accounts with missing fields
-- ─────────────────────────────────────────────────────────────

ALTER TABLE vendor_accounts
  ADD COLUMN IF NOT EXISTS contact_name      text,
  ADD COLUMN IF NOT EXISTS phone             text,
  ADD COLUMN IF NOT EXISTS category          text,
  ADD COLUMN IF NOT EXISTS website           text,
  ADD COLUMN IF NOT EXISTS description       text,
  ADD COLUMN IF NOT EXISTS gstin             text,
  ADD COLUMN IF NOT EXISTS address           text,
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'active'
                           CHECK (status IN ('invited','active','suspended')),
  ADD COLUMN IF NOT EXISTS last_login        timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

-- ─────────────────────────────────────────────────────────────
-- 8. EXTEND vendor_event_assignments with missing fields
-- ─────────────────────────────────────────────────────────────

ALTER TABLE vendor_event_assignments
  ADD COLUMN IF NOT EXISTS services_description text,
  ADD COLUMN IF NOT EXISTS contract_amount       numeric(12,2),
  ADD COLUMN IF NOT EXISTS contract_url          text,
  ADD COLUMN IF NOT EXISTS last_accessed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS status                text NOT NULL DEFAULT 'invited'
                           CHECK (status IN ('invited','confirmed','active','completed','cancelled'));

-- ─────────────────────────────────────────────────────────────
-- 9. RLS POLICIES
-- ─────────────────────────────────────────────────────────────

ALTER TABLE vendor_password_resets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_event_briefs     ENABLE ROW LEVEL SECURITY;

-- Password resets: only service role
CREATE POLICY "vendor_pwd_service_only" ON vendor_password_resets USING (false);
CREATE POLICY "vendor_pwd_insert_public" ON vendor_password_resets FOR INSERT WITH CHECK (true);

-- Documents: tenant staff can manage; vendor access via service role (RLS bypassed by API)
CREATE POLICY "tenant_manage_vendor_docs" ON vendor_documents
  USING (
    assignment_id IN (
      SELECT id FROM vendor_event_assignments
      WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

-- Messages: tenant staff can manage
CREATE POLICY "tenant_manage_vendor_messages" ON vendor_messages
  USING (
    assignment_id IN (
      SELECT id FROM vendor_event_assignments
      WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

-- Event briefs: tenant staff can manage
CREATE POLICY "tenant_manage_briefs" ON vendor_event_briefs
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 10. PERFORMANCE INDEXES
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vendor_assignments_vendor ON vendor_event_assignments(vendor_account_id);
CREATE INDEX IF NOT EXISTS idx_vendor_assignments_event  ON vendor_event_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_vendor_deliverables_assign ON vendor_deliverables(assignment_id, status);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_assign    ON vendor_invoices(assignment_id, status);


-- ==========================================
-- Migration: 051_rbac_role_hierarchy.sql
-- ==========================================
-- ============================================================
-- Migration 051: Corrected RBAC Role Hierarchy
--
-- Hierarchy:
--   Super Admin  (platform level — super_admins table)
--   └── Workspace Owner   (tenant creator — role = 'owner')
--         └── Event Manager (role = 'event_manager')
--               └── Team Lead (role = 'team_lead')
--                     └── Team Member (role = 'team_member')
--
-- Changes:
--   1. Add role column to tenant_members (replaces scattered role refs)
--   2. Add workspace_owner_id to tenants table
--   3. Backfill existing owner records
--   4. Add module_permissions table for granular per-role permissions
--   5. Update RLS policies to reflect corrected hierarchy
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TENANT_MEMBERS — add canonical role column
-- ─────────────────────────────────────────────────────────────

ALTER TABLE tenant_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'team_member'
    CHECK (role IN ('owner', 'event_manager', 'team_lead', 'team_member'));

-- Single owner constraint: enforce at most one owner per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_members_one_owner
  ON tenant_members (tenant_id)
  WHERE role = 'owner';

-- ─────────────────────────────────────────────────────────────
-- 2. TENANTS — track owner_id (the workspace creator)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS workspace_owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Backfill from existing tenant_members where old role = 'owner'
UPDATE tenants t
SET workspace_owner_id = tm.user_id
FROM tenant_members tm
WHERE tm.tenant_id = t.id
  AND tm.role = 'owner'
  AND t.workspace_owner_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. BACKFILL existing tenant_members
-- If the user is the workspace creator, mark them owner
-- ─────────────────────────────────────────────────────────────

-- Set owner role for workspace creators (where owner_id matches)
UPDATE tenant_members tm
SET role = 'owner'
FROM tenants t
WHERE tm.tenant_id = t.id
  AND tm.user_id = t.owner_id;

-- Any remaining unset roles with old 'event_manager' label → event_manager
-- (handles legacy data from old role system)
UPDATE tenant_members
SET role = 'event_manager'
WHERE role = 'team_member'
  AND id IN (
    SELECT tm.id FROM tenant_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE u.role = 'event_manager'
  );

-- ─────────────────────────────────────────────────────────────
-- 4. ROLE PERMISSIONS TABLE
-- Fine-grained per-role, per-module controls (customisable by owner)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('event_manager', 'team_lead', 'team_member')),
                -- Note: 'owner' is excluded — always has full access, no restrictions
  module_key    text NOT NULL,
  can_view      boolean NOT NULL DEFAULT true,
  can_create    boolean NOT NULL DEFAULT false,
  can_edit      boolean NOT NULL DEFAULT false,
  can_delete    boolean NOT NULL DEFAULT false,
  can_export    boolean NOT NULL DEFAULT false,
  can_approve   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, role, module_key)
);

CREATE INDEX IF NOT EXISTS idx_role_perms_tenant_role ON role_permissions(tenant_id, role);

-- ─────────────────────────────────────────────────────────────
-- 5. DEFAULT ROLE PERMISSIONS — seed for new tenants
-- Owner-only modules clearly marked
-- ─────────────────────────────────────────────────────────────

-- Function: called when a new tenant is created to seed defaults
CREATE OR REPLACE FUNCTION seed_default_role_permissions(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Event Manager defaults: near-full access, blocked from billing + workspace settings
  INSERT INTO role_permissions (tenant_id, role, module_key, can_view, can_create, can_edit, can_delete, can_export, can_approve)
  VALUES
    (p_tenant_id, 'event_manager', 'events',         true, true, true, true,  true,  true),
    (p_tenant_id, 'event_manager', 'guests',          true, true, true, true,  true,  true),
    (p_tenant_id, 'event_manager', 'vendors',         true, true, true, false, true,  true),
    (p_tenant_id, 'event_manager', 'finance',         true, true, true, false, true,  true),
    (p_tenant_id, 'event_manager', 'crm',             true, true, true, true,  true,  true),
    (p_tenant_id, 'event_manager', 'team',            true, true, true, false, false, true),
    (p_tenant_id, 'event_manager', 'inventory',       true, true, true, true,  true,  false),
    (p_tenant_id, 'event_manager', 'fnb',             true, true, true, true,  true,  true),
    (p_tenant_id, 'event_manager', 'production',      true, true, true, true,  true,  true),
    (p_tenant_id, 'event_manager', 'hospitality',     true, true, true, true,  true,  true),
    (p_tenant_id, 'event_manager', 'analytics',       true, false, false, false, true, false),
    (p_tenant_id, 'event_manager', 'ai',              true, true, false, false, false, false),
    (p_tenant_id, 'event_manager', 'documents',       true, true, true, false, true,  false),
    (p_tenant_id, 'event_manager', 'communication',   true, true, false, false, false, false),
    -- Blocked for event_manager (owner only):
    (p_tenant_id, 'event_manager', 'billing',         false, false, false, false, false, false),
    (p_tenant_id, 'event_manager', 'workspace_settings', false, false, false, false, false, false),
    (p_tenant_id, 'event_manager', 'api_settings',    false, false, false, false, false, false),
    (p_tenant_id, 'event_manager', 'payment_gateways',false, false, false, false, false, false),

  -- Team Lead defaults: module-scoped, mostly view + create
    (p_tenant_id, 'team_lead', 'events',       true, false, true,  false, true,  false),
    (p_tenant_id, 'team_lead', 'guests',        true, true,  true,  false, true,  false),
    (p_tenant_id, 'team_lead', 'vendors',       true, false, false, false, false, false),
    (p_tenant_id, 'team_lead', 'finance',       true, true,  false, false, false, false),
    (p_tenant_id, 'team_lead', 'crm',           true, true,  true,  false, false, false),
    (p_tenant_id, 'team_lead', 'inventory',     true, true,  true,  false, false, false),
    (p_tenant_id, 'team_lead', 'fnb',           true, true,  true,  false, false, false),
    (p_tenant_id, 'team_lead', 'production',    true, true,  true,  false, false, false),
    (p_tenant_id, 'team_lead', 'hospitality',   true, true,  true,  false, false, false),
    (p_tenant_id, 'team_lead', 'communication', true, true,  false, false, false, false),
    (p_tenant_id, 'team_lead', 'documents',     true, true,  false, false, false, false),
    (p_tenant_id, 'team_lead', 'billing',       false, false, false, false, false, false),
    (p_tenant_id, 'team_lead', 'team',          true, false, false, false, false, false),
    (p_tenant_id, 'team_lead', 'analytics',     true, false, false, false, true,  false),

  -- Team Member defaults: mostly view only
    (p_tenant_id, 'team_member', 'events',       true, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'guests',        true, true,  false, false, false, false),
    (p_tenant_id, 'team_member', 'inventory',     true, true,  false, false, false, false),
    (p_tenant_id, 'team_member', 'fnb',           true, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'production',    true, true,  false, false, false, false),
    (p_tenant_id, 'team_member', 'communication', true, true,  false, false, false, false),
    (p_tenant_id, 'team_member', 'documents',     true, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'billing',       false, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'vendors',       false, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'finance',       false, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'crm',           false, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'team',          false, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'analytics',     false, false, false, false, false, false)

  ON CONFLICT (tenant_id, role, module_key) DO NOTHING;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS POLICIES — updated for corrected hierarchy
-- ─────────────────────────────────────────────────────────────

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Owner can manage all role permissions for their workspace
CREATE POLICY "owner_manage_role_permissions" ON role_permissions
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- All tenant members can read their workspace's role permissions
CREATE POLICY "staff_read_role_permissions" ON role_permissions
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 7. HELPER FUNCTION: get effective role for a user in a tenant
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_tenant_role(p_user_id uuid, p_tenant_id uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT role FROM tenant_members
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. HELPER FUNCTION: check if user is owner
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_workspace_owner(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND role = 'owner'
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 9. OWNERSHIP TRANSFER FUNCTION
-- Safely transfers workspace ownership to another team member
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION transfer_workspace_ownership(
  p_tenant_id    uuid,
  p_current_owner uuid,
  p_new_owner     uuid
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Verify caller is current owner
  IF NOT is_workspace_owner(p_current_owner, p_tenant_id) THEN
    RAISE EXCEPTION 'Only the current workspace owner can transfer ownership';
  END IF;

  -- Verify new owner is a member of this workspace
  IF NOT EXISTS (SELECT 1 FROM tenant_members WHERE user_id = p_new_owner AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'New owner must be an existing team member';
  END IF;

  -- Downgrade current owner to event_manager
  UPDATE tenant_members SET role = 'event_manager'
  WHERE user_id = p_current_owner AND tenant_id = p_tenant_id;

  -- Upgrade new owner
  UPDATE tenant_members SET role = 'owner'
  WHERE user_id = p_new_owner AND tenant_id = p_tenant_id;

  -- Update tenants.workspace_owner_id
  UPDATE tenants SET workspace_owner_id = p_new_owner, owner_id = p_new_owner
  WHERE id = p_tenant_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 10. UPDATED TRIGGERS — set owner role on tenant creation
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_workspace_owner_role()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- When a new tenant is created, set the owner's role in tenant_members
  UPDATE tenant_members
  SET role = 'owner'
  WHERE tenant_id = NEW.id AND user_id = NEW.owner_id;

  -- Also set workspace_owner_id
  NEW.workspace_owner_id := NEW.owner_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_workspace_owner ON tenants;
CREATE TRIGGER trg_set_workspace_owner
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_workspace_owner_role();


-- ==========================================
-- Migration: 052_event_level_access.sql
-- ==========================================
-- ============================================================
-- Migration 052: Event-Level Access Control
--
-- Workspace Owner / Event Managers can:
--   1. Remove any member from a specific event (is_active = false)
--   2. Override per-module permissions for a member within an event
--
-- Access resolution order (highest to lowest priority):
--   1. Super Admin → always allowed
--   2. Workspace suspended → deny all
--   3. event-level is_active = false → deny for that event
--   4. event-level module_overrides → use override for that module
--   5. workspace role default → fall through
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TEAM EVENT ACCESS TABLE
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_event_access (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Active flag — false means removed from this event
  is_active       boolean NOT NULL DEFAULT true,

  -- Per-module permission overrides for this event only
  -- Structure: { "finance": "view", "guests": "full", "crm": "none", ... }
  -- Valid values: "none" | "view" | "edit" | "full" | null (null = use workspace default)
  module_overrides jsonb NOT NULL DEFAULT '{}',

  -- Audit fields
  added_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  added_at        timestamptz NOT NULL DEFAULT now(),
  removed_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  removed_at      timestamptz,
  removal_reason  text,

  updated_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (event_id, user_id)   -- one row per member per event
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_team_event_access_event   ON team_event_access(event_id, is_active);
CREATE INDEX IF NOT EXISTS idx_team_event_access_user    ON team_event_access(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_event_access_tenant  ON team_event_access(tenant_id);

-- ─────────────────────────────────────────────────────────────
-- 2. RLS POLICIES
-- ─────────────────────────────────────────────────────────────

ALTER TABLE team_event_access ENABLE ROW LEVEL SECURITY;

-- Tenant staff can read all event access records for their tenant
CREATE POLICY "tenant_read_event_access" ON team_event_access
  FOR SELECT
  USING (
    tenant_id = (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
      LIMIT 1
    )
  );

-- Only workspace owners and event_managers can modify event access
-- (service role bypasses RLS for the guard logic)
CREATE POLICY "manager_write_event_access" ON team_event_access
  FOR ALL
  USING (
    tenant_id = (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'event_manager')
        AND tm.status = 'active'
      LIMIT 1
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. FUNCTION: check_event_module_access
-- Called by the API guard to resolve effective module access
-- Returns: 'full' | 'edit' | 'view' | 'none'
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_event_module_access(
  p_user_id   uuid,
  p_event_id  uuid,
  p_module    text DEFAULT NULL  -- null = check event-level active only
)
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_tenant_id     uuid;
  v_workspace_role text;
  v_is_active     boolean;
  v_overrides     jsonb;
  v_module_access text;
BEGIN
  -- Get tenant from event
  SELECT tenant_id INTO v_tenant_id FROM events WHERE id = p_event_id;
  IF v_tenant_id IS NULL THEN RETURN 'none'; END IF;

  -- Get workspace role
  SELECT role INTO v_workspace_role
  FROM tenant_members
  WHERE user_id = p_user_id AND tenant_id = v_tenant_id AND status = 'active';

  IF v_workspace_role IS NULL THEN RETURN 'none'; END IF;

  -- Workspace owner: unconditional full access (even event-level can't restrict owner)
  IF v_workspace_role = 'owner' THEN RETURN 'full'; END IF;

  -- Check event-level access record
  SELECT is_active, module_overrides
  INTO v_is_active, v_overrides
  FROM team_event_access
  WHERE user_id = p_user_id AND event_id = p_event_id;

  -- If a record exists and is_active = false → removed from event
  IF v_is_active IS NOT NULL AND v_is_active = false THEN
    RETURN 'none';
  END IF;

  -- If module-level check requested and override exists
  IF p_module IS NOT NULL AND v_overrides IS NOT NULL AND v_overrides ? p_module THEN
    v_module_access := v_overrides ->> p_module;
    RETURN COALESCE(v_module_access, 'none');
  END IF;

  -- Fall through to workspace role default
  CASE v_workspace_role
    WHEN 'event_manager' THEN RETURN 'full';
    WHEN 'team_lead'     THEN RETURN 'edit';
    WHEN 'team_member'   THEN RETURN 'view';
    ELSE RETURN 'none';
  END CASE;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. FUNCTION: get_event_team_with_access
-- Returns all workspace members enriched with their event access status
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_event_team_with_access(p_event_id uuid)
RETURNS TABLE (
  user_id          uuid,
  full_name        text,
  email            text,
  avatar_url       text,
  workspace_role   text,
  department       text,
  is_on_event      boolean,
  is_active        boolean,
  module_overrides jsonb,
  added_by_name    text,
  added_at         timestamptz,
  removed_by_name  text,
  removed_at       timestamptz,
  removal_reason   text
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM events WHERE id = p_event_id;

  RETURN QUERY
  SELECT
    u.id                          AS user_id,
    u.name                        AS full_name,
    u.email                       AS email,
    u.avatar_url                  AS avatar_url,
    tm.role                       AS workspace_role,
    tm.department                 AS department,
    (tea.id IS NOT NULL)          AS is_on_event,
    COALESCE(tea.is_active, true) AS is_active,
    COALESCE(tea.module_overrides, '{}'::jsonb) AS module_overrides,
    adder.name                    AS added_by_name,
    tea.added_at                  AS added_at,
    remover.name                  AS removed_by_name,
    tea.removed_at                AS removed_at,
    tea.removal_reason            AS removal_reason
  FROM tenant_members tm
  JOIN users u ON u.id = tm.user_id
  LEFT JOIN team_event_access tea ON tea.user_id = tm.user_id AND tea.event_id = p_event_id
  LEFT JOIN users adder   ON adder.id = tea.added_by
  LEFT JOIN users remover ON remover.id = tea.removed_by
  WHERE tm.tenant_id = v_tenant_id
    AND tm.status = 'active'
    AND tm.role != 'owner'   -- owner always has access; show separately
  ORDER BY tm.role DESC, u.name;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. AUDIT LOG ENTRIES — auto-log event access changes
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_event_access_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_actor_name  text;
  v_member_name text;
  v_event_name  text;
  v_action      text;
  v_details     jsonb;
BEGIN
  SELECT name INTO v_actor_name   FROM users WHERE id = COALESCE(NEW.updated_by, NEW.added_by, OLD.updated_by);
  SELECT name INTO v_member_name  FROM users WHERE id = NEW.user_id;
  SELECT name INTO v_event_name   FROM events WHERE id = NEW.event_id;

  IF TG_OP = 'INSERT' THEN
    v_action  := 'event_member_added';
    v_details := jsonb_build_object('event', v_event_name, 'member', v_member_name);

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active = true AND NEW.is_active = false THEN
      v_action  := 'event_member_removed';
      v_details := jsonb_build_object(
        'event', v_event_name,
        'member', v_member_name,
        'reason', NEW.removal_reason
      );
    ELSIF OLD.is_active = false AND NEW.is_active = true THEN
      v_action  := 'event_member_restored';
      v_details := jsonb_build_object('event', v_event_name, 'member', v_member_name);
    ELSIF OLD.module_overrides != NEW.module_overrides THEN
      v_action  := 'event_access_overrides_updated';
      v_details := jsonb_build_object(
        'event', v_event_name,
        'member', v_member_name,
        'overrides', NEW.module_overrides
      );
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO audit_logs (
    tenant_id, event_id, actor_id, action, entity_type, entity_id, details
  )
  SELECT
    NEW.tenant_id, NEW.event_id, COALESCE(NEW.updated_by, NEW.added_by),
    v_action, 'team_event_access', NEW.id, v_details
  WHERE v_action IS NOT NULL;

  RETURN NEW;
END;
$$;

-- Only create trigger if audit_logs table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    DROP TRIGGER IF EXISTS trg_log_event_access ON team_event_access;
    CREATE TRIGGER trg_log_event_access
      AFTER INSERT OR UPDATE ON team_event_access
      FOR EACH ROW EXECUTE FUNCTION log_event_access_change();
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. VALID MODULE KEYS (constraint helper)
-- ─────────────────────────────────────────────────────────────

COMMENT ON COLUMN team_event_access.module_overrides IS
  'JSONB object. Keys are module identifiers: crm, finance, guests, vendors, inventory,
   production, hospitality, artists, venues, marketing, support, team, documents,
   fnb, decor, media, surveys, health_safety, gifts.
   Values: "none" | "view" | "edit" | "full"';


-- ==========================================
-- Migration: 053_notifications.sql
-- ==========================================
-- =============================================================================
-- OccasionPro Migration 053 — Notification Centre
--
-- Tables:
--   notifications              → all notifications across portals
--   notification_preferences   → per-user per-module muting/channel prefs
--
-- Functions:
--   create_notification()      → insert with preference check, return id
--   mark_notifications_read()  → batch mark read, return count
--   get_unread_count()         → fast unread badge count
--
-- Real-time:
--   Supabase Realtime publication on notifications table (recipient_id filter)
-- =============================================================================

-- ─── Enum types ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE notification_recipient_type AS ENUM (
    'team',    -- workspace team member
    'guest',   -- event guest
    'client',  -- client portal user
    'vendor'   -- vendor portal user
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_module AS ENUM (
    'guests',       -- guest management actions
    'finance',      -- payments, budgets, invoices
    'fnb',          -- food & beverage
    'floorplan',    -- floor plan changes
    'runsheet',     -- runsheet updates
    'vendors',      -- vendor assignments, declines
    'clients',      -- client actions
    'team',         -- team changes, removals
    'conference',   -- conference / session module
    'post_event',   -- post-event feedback, reports
    'system'        -- platform-level alerts
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_urgency AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id         UUID REFERENCES events(id) ON DELETE SET NULL,

  recipient_id     UUID NOT NULL,   -- user_id / guest_id / client_id / vendor_id
  recipient_type   notification_recipient_type NOT NULL,

  module           notification_module NOT NULL,
  urgency          notification_urgency NOT NULL DEFAULT 'info',

  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  action_url       TEXT,            -- deep-link to the relevant page

  is_read          BOOLEAN NOT NULL DEFAULT FALSE,
  read_at          TIMESTAMPTZ,

  -- batching support: reference to first notification in a batch group
  batch_key        TEXT,            -- e.g. "finance:event_id:2026-05-17T10" — same key = same batch
  batch_count      INT NOT NULL DEFAULT 1,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast unread badge and inbox queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications(recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_event
  ON notifications(tenant_id, event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_batch_key
  ON notifications(batch_key, created_at DESC)
  WHERE batch_key IS NOT NULL;

-- ─── notification_preferences ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_preferences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  recipient_type    notification_recipient_type NOT NULL,
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,

  module            notification_module NOT NULL,
  urgency_threshold notification_urgency NOT NULL DEFAULT 'info',  -- min urgency to receive
  in_app_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_enabled  BOOLEAN NOT NULL DEFAULT FALSE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, tenant_id, module)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user
  ON notification_preferences(user_id, recipient_type);

-- ─── Trigger: updated_at ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_notifications_updated_at();

-- ─── Function: create_notification ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_notification(
  p_tenant_id       UUID,
  p_event_id        UUID,
  p_recipient_id    UUID,
  p_recipient_type  notification_recipient_type,
  p_module          notification_module,
  p_title           TEXT,
  p_body            TEXT,
  p_action_url      TEXT DEFAULT NULL,
  p_urgency         notification_urgency DEFAULT 'info',
  p_batch_key       TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_pref           notification_preferences%ROWTYPE;
  v_urgency_rank   INT;
  v_threshold_rank INT;
  v_notification_id UUID;
  v_batch_count    INT;
  v_existing_batch UUID;
BEGIN
  -- Check preferences (only for team members who have explicit prefs)
  SELECT * INTO v_pref
  FROM notification_preferences
  WHERE user_id = p_recipient_id
    AND (tenant_id = p_tenant_id OR tenant_id IS NULL)
    AND module = p_module
  LIMIT 1;

  -- If preference exists and in_app is disabled, skip
  IF FOUND AND NOT v_pref.in_app_enabled THEN
    RETURN NULL;
  END IF;

  -- Check urgency threshold
  IF FOUND THEN
    -- Map urgency to rank
    v_urgency_rank := CASE p_urgency
      WHEN 'info'     THEN 1
      WHEN 'warning'  THEN 2
      WHEN 'critical' THEN 3
    END;
    v_threshold_rank := CASE v_pref.urgency_threshold
      WHEN 'info'     THEN 1
      WHEN 'warning'  THEN 2
      WHEN 'critical' THEN 3
    END;

    IF v_urgency_rank < v_threshold_rank THEN
      RETURN NULL; -- below user's threshold, don't send
    END IF;
  END IF;

  -- Smart batching: check if a recent notification with same batch_key exists (within 60s)
  IF p_batch_key IS NOT NULL THEN
    SELECT id, batch_count INTO v_existing_batch, v_batch_count
    FROM notifications
    WHERE batch_key = p_batch_key
      AND recipient_id = p_recipient_id
      AND created_at > NOW() - INTERVAL '60 seconds'
      AND is_read = FALSE
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      -- Update existing notification's count and body
      UPDATE notifications
      SET
        batch_count = v_batch_count + 1,
        body = p_body,  -- most recent body
        title = CASE
          WHEN v_batch_count + 1 >= 3
          THEN regexp_replace(p_title, '^\d+ ', '') -- strip leading count
               -- Caller is responsible for title like "3 new updates in Finance"
          ELSE p_title
        END,
        updated_at = NOW()
      WHERE id = v_existing_batch
      RETURNING id INTO v_notification_id;

      RETURN v_notification_id;
    END IF;
  END IF;

  -- Insert new notification
  INSERT INTO notifications (
    tenant_id, event_id, recipient_id, recipient_type,
    module, urgency, title, body, action_url, batch_key
  )
  VALUES (
    p_tenant_id, p_event_id, p_recipient_id, p_recipient_type,
    p_module, p_urgency, p_title, p_body, p_action_url, p_batch_key
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- ─── Function: mark_notifications_read ───────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_recipient_id UUID,
  p_ids          UUID[]
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE recipient_id = p_recipient_id
    AND id = ANY(p_ids)
    AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── Function: mark_all_notifications_read ────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_all_notifications_read(
  p_recipient_id UUID,
  p_tenant_id    UUID
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE recipient_id = p_recipient_id
    AND tenant_id = p_tenant_id
    AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── Function: get_unread_count ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_unread_count(
  p_recipient_id UUID
)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INT
  FROM notifications
  WHERE recipient_id = p_recipient_id
    AND is_read = FALSE;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Each recipient can only see and update their own notifications
DROP POLICY IF EXISTS "notifications_own_read" ON notifications;
CREATE POLICY "notifications_own_read" ON notifications
  FOR SELECT
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_own_update" ON notifications;
CREATE POLICY "notifications_own_update" ON notifications
  FOR UPDATE
  USING (recipient_id = auth.uid());

-- Service role (used by backend) can insert
DROP POLICY IF EXISTS "notifications_service_insert" ON notifications;
CREATE POLICY "notifications_service_insert" ON notifications
  FOR INSERT
  WITH CHECK (TRUE);  -- enforced at application layer

-- Super admins can read all
DROP POLICY IF EXISTS "notifications_super_admin_all" ON notifications;
CREATE POLICY "notifications_super_admin_all" ON notifications
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

-- Preferences: own rows only
DROP POLICY IF EXISTS "notif_prefs_own" ON notification_preferences;
CREATE POLICY "notif_prefs_own" ON notification_preferences
  FOR ALL
  USING (user_id = auth.uid());

-- ─── Enable Supabase Realtime ─────────────────────────────────────────────────

-- Add notifications to the realtime publication so clients can subscribe
-- to filtered channels: realtime:notifications:recipient_id=<uuid>
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ─── Comments ────────────────────────────────────────────────────────────────

COMMENT ON TABLE notifications IS
  'Cross-portal notification centre. Recipients can be team members, guests, clients, or vendors. '
  'Supabase Realtime streams new rows filtered by recipient_id.';

COMMENT ON TABLE notification_preferences IS
  'Per-user per-module notification preferences. Controls in-app, email, WhatsApp delivery and urgency threshold.';

COMMENT ON FUNCTION create_notification IS
  'Insert a notification respecting user preferences and smart batching. '
  'Returns the notification id, or NULL if suppressed by preferences.';


-- ==========================================
-- Migration: 054_short_links.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 054: Short Link System
-- Every link sent to guests/clients/vendors is a short links.occasionpro.in
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE short_link_type AS ENUM (
  'invitation', 'rsvp', 'guest_portal', 'client_portal',
  'vendor_portal', 'payment', 'document', 'custom'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE device_type AS ENUM ('mobile', 'desktop', 'tablet', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── short_links ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS short_links (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            varchar(10) UNIQUE NOT NULL,
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        uuid        REFERENCES events(id) ON DELETE SET NULL,
  link_type       short_link_type NOT NULL DEFAULT 'custom',
  destination_url text        NOT NULL,
  guest_id        uuid        REFERENCES guests(id) ON DELETE SET NULL,
  client_id       uuid        REFERENCES client_companies(id) ON DELETE SET NULL,
  vendor_id       uuid        REFERENCES vendor_accounts(id) ON DELETE SET NULL,
  custom_alias    varchar(50) UNIQUE,
  expires_at      timestamptz,
  max_clicks      integer     CHECK (max_clicks IS NULL OR max_clicks > 0),
  click_count     integer     NOT NULL DEFAULT 0,
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_short_links_tenant    ON short_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_short_links_event     ON short_links(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_short_links_guest     ON short_links(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_short_links_active    ON short_links(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_short_links_alias     ON short_links(custom_alias) WHERE custom_alias IS NOT NULL;

-- ── short_link_clicks ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS short_link_clicks (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_id  uuid        NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
  clicked_at     timestamptz NOT NULL DEFAULT now(),
  ip_hash        varchar(64),          -- SHA-256 of IP, never raw
  user_agent     text,
  referrer       text,
  country_code   varchar(2),
  device_type    device_type NOT NULL DEFAULT 'unknown',
  metadata       jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_slc_link_time  ON short_link_clicks(short_link_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_slc_daily      ON short_link_clicks(short_link_id, date_trunc('day', clicked_at));

-- ── generate_short_code() ──────────────────────────────────
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS varchar(10)
LANGUAGE plpgsql
AS $$
DECLARE
  charset  text    := 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code_len integer := 7;
  attempt  integer := 0;
  candidate varchar(10);
  exists_check integer;
BEGIN
  LOOP
    attempt := attempt + 1;
    IF attempt > 5 THEN
      RAISE EXCEPTION 'Failed to generate unique short code after 5 attempts';
    END IF;

    -- Build random string from safe charset (no 0/O/1/I/l confusion)
    candidate := '';
    FOR i IN 1..code_len LOOP
      candidate := candidate || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;

    SELECT COUNT(1) INTO exists_check FROM short_links WHERE code = candidate;
    IF exists_check = 0 THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;

-- ── resolve_short_link() ───────────────────────────────────
-- Called by Edge Function / CF Worker on each redirect
-- Returns: { destination_url, link_type, metadata } or NULL if invalid
CREATE OR REPLACE FUNCTION resolve_short_link(
  p_code        text,
  p_ip_hash     text     DEFAULT NULL,
  p_user_agent  text     DEFAULT NULL,
  p_referrer    text     DEFAULT NULL,
  p_country     varchar  DEFAULT NULL,
  p_device      text     DEFAULT 'unknown'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_link  short_links%ROWTYPE;
  v_device device_type;
BEGIN
  -- Resolve code or custom_alias
  SELECT * INTO v_link
  FROM short_links
  WHERE (code = p_code OR custom_alias = p_code)
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Check expiry
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  -- Check click cap
  IF v_link.max_clicks IS NOT NULL AND v_link.click_count >= v_link.max_clicks THEN
    RETURN jsonb_build_object('error', 'limit_reached');
  END IF;

  -- Parse device type safely
  BEGIN
    v_device := p_device::device_type;
  EXCEPTION WHEN OTHERS THEN
    v_device := 'unknown';
  END;

  -- Record click
  INSERT INTO short_link_clicks (short_link_id, ip_hash, user_agent, referrer, country_code, device_type)
  VALUES (v_link.id, p_ip_hash, p_user_agent, p_referrer, p_country, v_device);

  -- Increment counter (non-blocking — best effort)
  UPDATE short_links
  SET click_count = click_count + 1,
      updated_at  = now()
  WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'destination_url', v_link.destination_url,
    'link_type',       v_link.link_type,
    'tenant_id',       v_link.tenant_id,
    'event_id',        v_link.event_id,
    'guest_id',        v_link.guest_id,
    'metadata',        v_link.metadata
  );
END;
$$;

-- ── get_short_link_analytics() ─────────────────────────────
CREATE OR REPLACE FUNCTION get_short_link_analytics(p_link_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total       integer;
  v_daily       jsonb;
  v_devices     jsonb;
  v_hours       jsonb;
BEGIN
  SELECT click_count INTO v_total FROM short_links WHERE id = p_link_id;

  SELECT jsonb_agg(row_to_json(d)) INTO v_daily
  FROM (
    SELECT date_trunc('day', clicked_at)::date AS day, COUNT(*) AS clicks
    FROM short_link_clicks
    WHERE short_link_id = p_link_id
      AND clicked_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 1
  ) d;

  SELECT jsonb_agg(row_to_json(d)) INTO v_devices
  FROM (
    SELECT device_type, COUNT(*) AS clicks
    FROM short_link_clicks WHERE short_link_id = p_link_id
    GROUP BY 1
  ) d;

  SELECT jsonb_agg(row_to_json(d)) INTO v_hours
  FROM (
    SELECT EXTRACT(hour FROM clicked_at)::int AS hour, COUNT(*) AS clicks
    FROM short_link_clicks WHERE short_link_id = p_link_id
    GROUP BY 1 ORDER BY 1
  ) d;

  RETURN jsonb_build_object(
    'total',   COALESCE(v_total, 0),
    'daily',   COALESCE(v_daily, '[]'::jsonb),
    'devices', COALESCE(v_devices, '[]'::jsonb),
    'hours',   COALESCE(v_hours, '[]'::jsonb)
  );
END;
$$;

-- ── Timestamp trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_short_links_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_short_links_updated_at ON short_links;
CREATE TRIGGER trg_short_links_updated_at
  BEFORE UPDATE ON short_links
  FOR EACH ROW EXECUTE FUNCTION update_short_links_updated_at();

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE short_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_link_clicks ENABLE ROW LEVEL SECURITY;

-- Tenant members can CRUD their own tenant's links
CREATE POLICY short_links_tenant_all ON short_links
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

-- Clicks: read by tenant members; inserts via SECURITY DEFINER function only
CREATE POLICY slc_tenant_read ON short_link_clicks
  FOR SELECT USING (
    short_link_id IN (
      SELECT id FROM short_links
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
      )
    )
  );

-- Service role bypass for Edge Function / CF Worker
CREATE POLICY short_links_service_all ON short_links
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY slc_service_all ON short_link_clicks
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE short_links IS 'All short links for op.link/* redirects';
COMMENT ON TABLE short_link_clicks IS 'Click analytics — SHA-256 IP hashing for DPDP compliance';
COMMENT ON FUNCTION resolve_short_link IS 'Called by CF Worker on each hit; atomic click counter + redirect URL lookup';

-- ==========================================
-- Migration: 055_event_types_readiness.sql
-- ==========================================
-- ============================================================
-- Migration 055: Event Types + Smart Readiness Engine
-- ============================================================
-- • event_types table (system built-ins + tenant custom)
-- • event_type_readiness_checklist table
-- • Seed: 15 built-in event types + checklist items
-- • ALTER events: add event_type_id, currency_code, timezone,
--   deleted_at, purge_after, auto_approve_guests
-- • smart_readiness_score(p_event_id) DB function
-- • RLS policies
-- ============================================================

-- ── event_types ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_types (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES public.tenants(id) ON DELETE CASCADE,  -- NULL = system/global
  name         VARCHAR(100) NOT NULL,
  slug         VARCHAR(100) NOT NULL,
  icon         VARCHAR(50)  NOT NULL DEFAULT '📅',   -- emoji or icon name
  description  TEXT,
  color        VARCHAR(20)  DEFAULT '#6366f1',
  is_system    BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)  -- per-tenant slugs; system types have tenant_id=NULL
);

CREATE INDEX IF NOT EXISTS idx_event_types_tenant ON public.event_types (tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_types_system ON public.event_types (is_system) WHERE is_system = TRUE;

-- ── event_type_readiness_checklist ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_type_readiness_checklist (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id  UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  module         VARCHAR(60) NOT NULL,  -- e.g. 'venue', 'guests', 'finance', 'media'
  check_key      VARCHAR(100) NOT NULL, -- machine key for DB evaluation
  check_label    VARCHAR(200) NOT NULL, -- human-readable
  is_required    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INT     NOT NULL DEFAULT 0,
  UNIQUE (event_type_id, check_key)
);

CREATE INDEX IF NOT EXISTS idx_readiness_event_type ON public.event_type_readiness_checklist (event_type_id);

-- ── ALTER events: new columns ─────────────────────────────────────────────────

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type_id     UUID REFERENCES public.event_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency_code     VARCHAR(3)   NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS timezone          VARCHAR(50)  NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purge_after       TIMESTAMPTZ GENERATED ALWAYS AS (deleted_at + INTERVAL '30 days') STORED,
  ADD COLUMN IF NOT EXISTS auto_approve_guests BOOLEAN    NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_events_type   ON public.events (event_type_id);
CREATE INDEX IF NOT EXISTS idx_events_deleted ON public.events (deleted_at) WHERE deleted_at IS NOT NULL;

-- ── SEED: system event types ──────────────────────────────────────────────────

INSERT INTO public.event_types (id, tenant_id, name, slug, icon, description, color, is_system, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000001', NULL, 'Wedding',            'wedding',            '💍', 'Full-day wedding ceremony and reception', '#ec4899', TRUE, 1),
  ('10000000-0000-0000-0000-000000000002', NULL, 'Corporate',          'corporate',          '🏢', 'Corporate events, meetings, team offsites', '#6366f1', TRUE, 2),
  ('10000000-0000-0000-0000-000000000003', NULL, 'Birthday',           'birthday',           '🎂', 'Birthday parties and milestone celebrations', '#f59e0b', TRUE, 3),
  ('10000000-0000-0000-0000-000000000004', NULL, 'Conference',         'conference',         '🎤', 'Multi-speaker conferences and summits', '#0ea5e9', TRUE, 4),
  ('10000000-0000-0000-0000-000000000005', NULL, 'Concert',            'concert',            '🎵', 'Live music concerts and performances', '#a855f7', TRUE, 5),
  ('10000000-0000-0000-0000-000000000006', NULL, 'Exhibition',         'exhibition',         '🖼️', 'Art exhibitions and trade displays', '#14b8a6', TRUE, 6),
  ('10000000-0000-0000-0000-000000000007', NULL, 'Product Launch',     'product-launch',     '🚀', 'Brand and product launch events', '#f97316', TRUE, 7),
  ('10000000-0000-0000-0000-000000000008', NULL, 'Award Ceremony',     'award-ceremony',     '🏆', 'Award nights and recognition events', '#eab308', TRUE, 8),
  ('10000000-0000-0000-0000-000000000009', NULL, 'Funeral',            'funeral',            '🕯️', 'Funeral services and memorial gatherings', '#64748b', TRUE, 9),
  ('10000000-0000-0000-0000-000000000010', NULL, 'Engagement',         'engagement',         '💑', 'Engagement ceremonies and parties', '#f43f5e', TRUE, 10),
  ('10000000-0000-0000-0000-000000000011', NULL, 'Baby Shower',        'baby-shower',        '👶', 'Baby showers and gender reveals', '#06b6d4', TRUE, 11),
  ('10000000-0000-0000-0000-000000000012', NULL, 'Religious Ceremony', 'religious-ceremony', '🕌', 'Religious ceremonies and spiritual events', '#84cc16', TRUE, 12),
  ('10000000-0000-0000-0000-000000000013', NULL, 'Sports Event',       'sports-event',       '🏅', 'Sports tournaments, races, and athletic events', '#22c55e', TRUE, 13),
  ('10000000-0000-0000-0000-000000000014', NULL, 'Social Gathering',   'social-gathering',   '🎉', 'Casual social gatherings and get-togethers', '#fb923c', TRUE, 14),
  ('10000000-0000-0000-0000-000000000015', NULL, 'Gala / Fundraiser',  'gala-fundraiser',    '🥂', 'Gala dinners, fundraisers, and charity events', '#c084fc', TRUE, 15)
ON CONFLICT DO NOTHING;

-- ── SEED: readiness checklist per event type ──────────────────────────────────
-- check_key values map to DB checks in smart_readiness_score() function

-- WEDDING (type 1)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000001', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000001', 'core',         'has_cover_image',       'Cover image uploaded',                       FALSE, 2),
  ('10000000-0000-0000-0000-000000000001', 'venue',        'has_venue',             'Venue is booked',                            TRUE,  3),
  ('10000000-0000-0000-0000-000000000001', 'guests',       'min_guests_added',      'At least 10 guests added',                   TRUE,  4),
  ('10000000-0000-0000-0000-000000000001', 'guests',       'invitations_sent',      'Invitations sent to guests',                 TRUE,  5),
  ('10000000-0000-0000-0000-000000000001', 'finance',      'has_budget',            'Budget defined',                             TRUE,  6),
  ('10000000-0000-0000-0000-000000000001', 'vendors',      'has_vendor',            'At least one vendor assigned',               TRUE,  7),
  ('10000000-0000-0000-0000-000000000001', 'hospitality',  'has_accommodation',     'Accommodation details added',                FALSE, 8),
  ('10000000-0000-0000-0000-000000000001', 'fnb',          'has_fnb_menu',          'F&B menu configured',                        TRUE,  9),
  ('10000000-0000-0000-0000-000000000001', 'decor',        'has_decor_plan',        'Décor plan created',                         FALSE, 10)
ON CONFLICT DO NOTHING;

-- CORPORATE (type 2)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000002', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000002', 'core',         'has_cover_image',       'Cover image uploaded',                       FALSE, 2),
  ('10000000-0000-0000-0000-000000000002', 'venue',        'has_venue',             'Venue is booked',                            TRUE,  3),
  ('10000000-0000-0000-0000-000000000002', 'guests',       'min_guests_added',      'At least 5 guests/attendees added',          TRUE,  4),
  ('10000000-0000-0000-0000-000000000002', 'team',         'has_team_member',       'Team member assigned to event',              TRUE,  5),
  ('10000000-0000-0000-0000-000000000002', 'finance',      'has_budget',            'Budget defined',                             TRUE,  6),
  ('10000000-0000-0000-0000-000000000002', 'vendors',      'has_vendor',            'At least one vendor assigned',               FALSE, 7),
  ('10000000-0000-0000-0000-000000000002', 'production',   'has_runsheet',          'Run sheet / agenda created',                 TRUE,  8),
  ('10000000-0000-0000-0000-000000000002', 'fnb',          'has_fnb_menu',          'F&B requirements noted',                     FALSE, 9),
  ('10000000-0000-0000-0000-000000000002', 'documents',    'has_document',          'At least one event document attached',       FALSE, 10)
ON CONFLICT DO NOTHING;

-- BIRTHDAY (type 3)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000003', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000003', 'core',         'has_cover_image',       'Cover image uploaded',                       FALSE, 2),
  ('10000000-0000-0000-0000-000000000003', 'venue',        'has_venue',             'Venue confirmed',                            TRUE,  3),
  ('10000000-0000-0000-0000-000000000003', 'guests',       'min_guests_added',      'At least 5 guests added',                    TRUE,  4),
  ('10000000-0000-0000-0000-000000000003', 'guests',       'invitations_sent',      'Invitations sent',                           FALSE, 5),
  ('10000000-0000-0000-0000-000000000003', 'finance',      'has_budget',            'Budget defined',                             FALSE, 6),
  ('10000000-0000-0000-0000-000000000003', 'vendors',      'has_vendor',            'Vendor booked (catering/decor)',              FALSE, 7),
  ('10000000-0000-0000-0000-000000000003', 'fnb',          'has_fnb_menu',          'F&B / cake details added',                   TRUE,  8)
ON CONFLICT DO NOTHING;

-- CONFERENCE (type 4)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000004', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000004', 'core',         'has_cover_image',       'Conference banner uploaded',                 FALSE, 2),
  ('10000000-0000-0000-0000-000000000004', 'venue',        'has_venue',             'Venue / hall booked',                        TRUE,  3),
  ('10000000-0000-0000-0000-000000000004', 'guests',       'min_guests_added',      'At least 10 delegates registered',           TRUE,  4),
  ('10000000-0000-0000-0000-000000000004', 'artists',      'has_artist',            'Speakers / artists confirmed',               TRUE,  5),
  ('10000000-0000-0000-0000-000000000004', 'production',   'has_runsheet',          'Session schedule / run sheet created',       TRUE,  6),
  ('10000000-0000-0000-0000-000000000004', 'finance',      'has_budget',            'Budget defined',                             TRUE,  7),
  ('10000000-0000-0000-0000-000000000004', 'team',         'has_team_member',       'Team assigned',                              TRUE,  8),
  ('10000000-0000-0000-0000-000000000004', 'vendors',      'has_vendor',            'AV / tech vendor confirmed',                 TRUE,  9),
  ('10000000-0000-0000-0000-000000000004', 'documents',    'has_document',          'Conference agenda document attached',        FALSE, 10)
ON CONFLICT DO NOTHING;

-- CONCERT (type 5)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000005', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000005', 'venue',        'has_venue',             'Venue / stage confirmed',                    TRUE,  2),
  ('10000000-0000-0000-0000-000000000005', 'artists',      'has_artist',            'Artist / performer confirmed',               TRUE,  3),
  ('10000000-0000-0000-0000-000000000005', 'vendors',      'has_vendor',            'Sound & lighting vendor confirmed',          TRUE,  4),
  ('10000000-0000-0000-0000-000000000005', 'production',   'has_runsheet',          'Show run sheet created',                     TRUE,  5),
  ('10000000-0000-0000-0000-000000000005', 'finance',      'has_budget',            'Budget defined',                             TRUE,  6),
  ('10000000-0000-0000-0000-000000000005', 'team',         'has_team_member',       'Production crew assigned',                   TRUE,  7),
  ('10000000-0000-0000-0000-000000000005', 'permits',      'has_permit',            'Event permits / NOC obtained',               TRUE,  8),
  ('10000000-0000-0000-0000-000000000005', 'guests',       'min_guests_added',      'Ticket holders / guests listed',             FALSE, 9)
ON CONFLICT DO NOTHING;

-- EXHIBITION (type 6)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000006', 'core',         'has_event_date',        'Event dates set',                            TRUE,  1),
  ('10000000-0000-0000-0000-000000000006', 'venue',        'has_venue',             'Exhibition hall booked',                     TRUE,  2),
  ('10000000-0000-0000-0000-000000000006', 'vendors',      'has_vendor',            'At least one exhibitor / vendor',            TRUE,  3),
  ('10000000-0000-0000-0000-000000000006', 'finance',      'has_budget',            'Budget defined',                             TRUE,  4),
  ('10000000-0000-0000-0000-000000000006', 'team',         'has_team_member',       'Team assigned',                              TRUE,  5),
  ('10000000-0000-0000-0000-000000000006', 'decor',        'has_decor_plan',        'Stall / booth layout planned',               FALSE, 6),
  ('10000000-0000-0000-0000-000000000006', 'permits',      'has_permit',            'Exhibition permits obtained',                FALSE, 7),
  ('10000000-0000-0000-0000-000000000006', 'guests',       'min_guests_added',      'Expected visitor count estimated',           FALSE, 8)
ON CONFLICT DO NOTHING;

-- PRODUCT LAUNCH (type 7)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000007', 'core',         'has_event_date',        'Launch date confirmed',                      TRUE,  1),
  ('10000000-0000-0000-0000-000000000007', 'core',         'has_cover_image',       'Event banner / creative uploaded',           TRUE,  2),
  ('10000000-0000-0000-0000-000000000007', 'venue',        'has_venue',             'Launch venue confirmed',                     TRUE,  3),
  ('10000000-0000-0000-0000-000000000007', 'guests',       'min_guests_added',      'Press / invitees list added',                TRUE,  4),
  ('10000000-0000-0000-0000-000000000007', 'guests',       'invitations_sent',      'Press invitations sent',                     TRUE,  5),
  ('10000000-0000-0000-0000-000000000007', 'production',   'has_runsheet',          'Launch run sheet / script ready',            TRUE,  6),
  ('10000000-0000-0000-0000-000000000007', 'vendors',      'has_vendor',            'AV / media vendor confirmed',                TRUE,  7),
  ('10000000-0000-0000-0000-000000000007', 'finance',      'has_budget',            'Budget approved',                            TRUE,  8),
  ('10000000-0000-0000-0000-000000000007', 'documents',    'has_document',          'Press kit / brand document attached',        FALSE, 9)
ON CONFLICT DO NOTHING;

-- AWARD CEREMONY (type 8)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000008', 'core',         'has_event_date',        'Ceremony date set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000008', 'venue',        'has_venue',             'Award venue confirmed',                      TRUE,  2),
  ('10000000-0000-0000-0000-000000000008', 'guests',       'min_guests_added',      'Nominees / guests added',                    TRUE,  3),
  ('10000000-0000-0000-0000-000000000008', 'guests',       'invitations_sent',      'Invitations dispatched',                     TRUE,  4),
  ('10000000-0000-0000-0000-000000000008', 'production',   'has_runsheet',          'Show run order created',                     TRUE,  5),
  ('10000000-0000-0000-0000-000000000008', 'vendors',      'has_vendor',            'AV / trophy vendor confirmed',               TRUE,  6),
  ('10000000-0000-0000-0000-000000000008', 'finance',      'has_budget',            'Budget defined',                             TRUE,  7),
  ('10000000-0000-0000-0000-000000000008', 'fnb',          'has_fnb_menu',          'Dinner / F&B menu configured',               FALSE, 8),
  ('10000000-0000-0000-0000-000000000008', 'team',         'has_team_member',       'Team assigned',                              TRUE,  9)
ON CONFLICT DO NOTHING;

-- FUNERAL (type 9)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000009', 'core',         'has_event_date',        'Service date and time confirmed',            TRUE,  1),
  ('10000000-0000-0000-0000-000000000009', 'venue',        'has_venue',             'Venue / chapel confirmed',                   TRUE,  2),
  ('10000000-0000-0000-0000-000000000009', 'guests',       'min_guests_added',      'Attendees / family contacts added',          FALSE, 3),
  ('10000000-0000-0000-0000-000000000009', 'vendors',      'has_vendor',            'Funeral service vendor confirmed',           TRUE,  4),
  ('10000000-0000-0000-0000-000000000009', 'documents',    'has_document',          'Order of service document prepared',         TRUE,  5),
  ('10000000-0000-0000-0000-000000000009', 'finance',      'has_budget',            'Budget estimated',                           FALSE, 6),
  ('10000000-0000-0000-0000-000000000009', 'team',         'has_team_member',       'Coordinator assigned',                       TRUE,  7),
  ('10000000-0000-0000-0000-000000000009', 'hospitality',  'has_accommodation',     'Out-of-town family accommodation noted',     FALSE, 8)
ON CONFLICT DO NOTHING;

-- ENGAGEMENT (type 10)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000010', 'core',         'has_event_date',        'Engagement date set',                        TRUE,  1),
  ('10000000-0000-0000-0000-000000000010', 'venue',        'has_venue',             'Venue confirmed',                            TRUE,  2),
  ('10000000-0000-0000-0000-000000000010', 'guests',       'min_guests_added',      'Guest list added',                           TRUE,  3),
  ('10000000-0000-0000-0000-000000000010', 'guests',       'invitations_sent',      'Invitations sent',                           TRUE,  4),
  ('10000000-0000-0000-0000-000000000010', 'fnb',          'has_fnb_menu',          'Catering / menu confirmed',                  TRUE,  5),
  ('10000000-0000-0000-0000-000000000010', 'decor',        'has_decor_plan',        'Décor plan in place',                        FALSE, 6),
  ('10000000-0000-0000-0000-000000000010', 'finance',      'has_budget',            'Budget defined',                             FALSE, 7),
  ('10000000-0000-0000-0000-000000000010', 'vendors',      'has_vendor',            'Photographer / videographer booked',         FALSE, 8)
ON CONFLICT DO NOTHING;

-- BABY SHOWER (type 11)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000011', 'core',         'has_event_date',        'Event date set',                             TRUE,  1),
  ('10000000-0000-0000-0000-000000000011', 'venue',        'has_venue',             'Venue confirmed',                            TRUE,  2),
  ('10000000-0000-0000-0000-000000000011', 'guests',       'min_guests_added',      'Guest list added',                           TRUE,  3),
  ('10000000-0000-0000-0000-000000000011', 'guests',       'invitations_sent',      'Invitations sent',                           FALSE, 4),
  ('10000000-0000-0000-0000-000000000011', 'fnb',          'has_fnb_menu',          'Cake / refreshments planned',                TRUE,  5),
  ('10000000-0000-0000-0000-000000000011', 'decor',        'has_decor_plan',        'Theme / décor decided',                      FALSE, 6),
  ('10000000-0000-0000-0000-000000000011', 'finance',      'has_budget',            'Budget set',                                 FALSE, 7)
ON CONFLICT DO NOTHING;

-- RELIGIOUS CEREMONY (type 12)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000012', 'core',         'has_event_date',        'Ceremony date/time set',                     TRUE,  1),
  ('10000000-0000-0000-0000-000000000012', 'venue',        'has_venue',             'Venue / place of worship confirmed',         TRUE,  2),
  ('10000000-0000-0000-0000-000000000012', 'guests',       'min_guests_added',      'Congregation / guests added',                FALSE, 3),
  ('10000000-0000-0000-0000-000000000012', 'vendors',      'has_vendor',            'Priest / officiant confirmed',               TRUE,  4),
  ('10000000-0000-0000-0000-000000000012', 'fnb',          'has_fnb_menu',          'Prasad / food arrangements noted',           FALSE, 5),
  ('10000000-0000-0000-0000-000000000012', 'team',         'has_team_member',       'Coordinator assigned',                       FALSE, 6),
  ('10000000-0000-0000-0000-000000000012', 'permits',      'has_permit',            'Any required permissions obtained',          FALSE, 7),
  ('10000000-0000-0000-0000-000000000012', 'finance',      'has_budget',            'Budget estimated',                           FALSE, 8)
ON CONFLICT DO NOTHING;

-- SPORTS EVENT (type 13)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000013', 'core',         'has_event_date',        'Event date confirmed',                       TRUE,  1),
  ('10000000-0000-0000-0000-000000000013', 'venue',        'has_venue',             'Venue / stadium confirmed',                  TRUE,  2),
  ('10000000-0000-0000-0000-000000000013', 'guests',       'min_guests_added',      'Participants / teams registered',            TRUE,  3),
  ('10000000-0000-0000-0000-000000000013', 'team',         'has_team_member',       'Operations team assigned',                   TRUE,  4),
  ('10000000-0000-0000-0000-000000000013', 'vendors',      'has_vendor',            'Equipment / logistics vendor confirmed',     TRUE,  5),
  ('10000000-0000-0000-0000-000000000013', 'permits',      'has_permit',            'Sports event permit obtained',               TRUE,  6),
  ('10000000-0000-0000-0000-000000000013', 'finance',      'has_budget',            'Budget approved',                            TRUE,  7),
  ('10000000-0000-0000-0000-000000000013', 'production',   'has_runsheet',          'Event schedule / format documented',         FALSE, 8),
  ('10000000-0000-0000-0000-000000000013', 'health_safety','has_health_safety_plan','First aid / safety plan in place',           TRUE,  9)
ON CONFLICT DO NOTHING;

-- SOCIAL GATHERING (type 14)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000014', 'core',         'has_event_date',        'Date and time set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000014', 'venue',        'has_venue',             'Venue / location confirmed',                 TRUE,  2),
  ('10000000-0000-0000-0000-000000000014', 'guests',       'min_guests_added',      'At least 5 guests added',                    FALSE, 3),
  ('10000000-0000-0000-0000-000000000014', 'fnb',          'has_fnb_menu',          'Food / drinks arranged',                     FALSE, 4),
  ('10000000-0000-0000-0000-000000000014', 'finance',      'has_budget',            'Budget noted',                               FALSE, 5)
ON CONFLICT DO NOTHING;

-- GALA / FUNDRAISER (type 15)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000015', 'core',         'has_event_date',        'Gala date confirmed',                        TRUE,  1),
  ('10000000-0000-0000-0000-000000000015', 'core',         'has_cover_image',       'Gala / charity banner uploaded',             FALSE, 2),
  ('10000000-0000-0000-0000-000000000015', 'venue',        'has_venue',             'Venue confirmed',                            TRUE,  3),
  ('10000000-0000-0000-0000-000000000015', 'guests',       'min_guests_added',      'Donor / guest list added',                   TRUE,  4),
  ('10000000-0000-0000-0000-000000000015', 'guests',       'invitations_sent',      'Invitations dispatched',                     TRUE,  5),
  ('10000000-0000-0000-0000-000000000015', 'fnb',          'has_fnb_menu',          'Gala dinner menu configured',                TRUE,  6),
  ('10000000-0000-0000-0000-000000000015', 'finance',      'has_budget',            'Fundraising target and budget set',          TRUE,  7),
  ('10000000-0000-0000-0000-000000000015', 'vendors',      'has_vendor',            'Décor / entertainment vendor confirmed',     TRUE,  8),
  ('10000000-0000-0000-0000-000000000015', 'production',   'has_runsheet',          'Programme / run order created',              TRUE,  9),
  ('10000000-0000-0000-0000-000000000015', 'team',         'has_team_member',       'Team assigned',                              TRUE,  10)
ON CONFLICT DO NOTHING;

-- ── smart_readiness_score() ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.smart_readiness_score(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event          RECORD;
  v_checklist      RECORD;
  v_items          JSONB := '[]'::JSONB;
  v_total          INT   := 0;
  v_completed      INT   := 0;
  v_is_completed   BOOLEAN;
  v_score_pct      NUMERIC;
BEGIN
  -- Load event
  SELECT e.*, et.name AS type_name, et.icon AS type_icon
  INTO v_event
  FROM public.events e
  LEFT JOIN public.event_types et ON et.id = e.event_type_id
  WHERE e.id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Event not found');
  END IF;

  IF v_event.event_type_id IS NULL THEN
    RETURN jsonb_build_object(
      'total_checks', 0,
      'completed_checks', 0,
      'score_pct', 0,
      'items', '[]'::JSONB,
      'message', 'No event type set'
    );
  END IF;

  -- Iterate checklist for this event type
  FOR v_checklist IN
    SELECT * FROM public.event_type_readiness_checklist
    WHERE event_type_id = v_event.event_type_id
    ORDER BY sort_order
  LOOP
    v_is_completed := FALSE;

    -- Evaluate each check_key against actual event data
    CASE v_checklist.check_key

      WHEN 'has_event_date' THEN
        v_is_completed := v_event.start_date IS NOT NULL;

      WHEN 'has_cover_image' THEN
        v_is_completed := v_event.cover_image_url IS NOT NULL AND v_event.cover_image_url <> '';

      WHEN 'has_venue' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_venues ev WHERE ev.event_id = p_event_id LIMIT 1
        );

      WHEN 'min_guests_added' THEN
        v_is_completed := (
          SELECT COUNT(*) FROM public.guests g WHERE g.event_id = p_event_id
        ) >= 5;

      WHEN 'invitations_sent' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.invitations i
          WHERE i.event_id = p_event_id AND i.status IN ('sent', 'delivered', 'opened')
          LIMIT 1
        );

      WHEN 'has_budget' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_budgets eb WHERE eb.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_vendor' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_vendors ev WHERE ev.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_accommodation' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.accommodation_rooms ar WHERE ar.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_fnb_menu' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.fnb_menus fm WHERE fm.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_decor_plan' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.decor_items di WHERE di.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_team_member' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_team_members etm WHERE etm.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_runsheet' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.production_runsheets pr WHERE pr.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_artist' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_artists ea WHERE ea.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_permit' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_permits ep WHERE ep.event_id = p_event_id AND ep.status = 'approved' LIMIT 1
        );

      WHEN 'has_document' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.documents d WHERE d.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_health_safety_plan' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.health_safety_plans hsp WHERE hsp.event_id = p_event_id LIMIT 1
        );

      ELSE
        v_is_completed := FALSE;
    END CASE;

    v_total := v_total + 1;
    IF v_is_completed THEN
      v_completed := v_completed + 1;
    END IF;

    v_items := v_items || jsonb_build_object(
      'check_key',   v_checklist.check_key,
      'check_label', v_checklist.check_label,
      'module',      v_checklist.module,
      'is_required', v_checklist.is_required,
      'is_completed', v_is_completed,
      'sort_order',  v_checklist.sort_order
    );
  END LOOP;

  v_score_pct := CASE
    WHEN v_total = 0 THEN 0
    ELSE ROUND((v_completed::NUMERIC / v_total::NUMERIC) * 100)
  END;

  RETURN jsonb_build_object(
    'total_checks',     v_total,
    'completed_checks', v_completed,
    'score_pct',        v_score_pct,
    'event_type',       v_event.type_name,
    'event_type_icon',  v_event.type_icon,
    'items',            v_items
  );
END;
$$;

-- ── RLS policies ──────────────────────────────────────────────────────────────

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_type_readiness_checklist ENABLE ROW LEVEL SECURITY;

-- System types visible to all authenticated users
CREATE POLICY "event_types_read_system" ON public.event_types
  FOR SELECT USING (is_system = TRUE OR tenant_id = (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1
  ));

-- Tenant can manage their own custom types
CREATE POLICY "event_types_manage_own" ON public.event_types
  FOR ALL USING (
    tenant_id IS NOT NULL AND tenant_id = (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Checklist items readable by authenticated users (joined via event_types)
CREATE POLICY "readiness_checklist_read" ON public.event_type_readiness_checklist
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.event_types et
      WHERE et.id = event_type_id
        AND (et.is_system = TRUE OR et.tenant_id = (
          SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1
        ))
    )
  );

-- Service role bypass
CREATE POLICY "event_types_service_all" ON public.event_types
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "readiness_checklist_service_all" ON public.event_type_readiness_checklist
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Grant execute on smart_readiness_score to authenticated
GRANT EXECUTE ON FUNCTION public.smart_readiness_score(UUID) TO authenticated, service_role;


-- ==========================================
-- Migration: 056_health_safety.sql
-- ==========================================
-- ============================================================
-- Migration 056 — Health & Safety Module
-- ============================================================

-- ─────────────────────────────────────────────
-- Health & Safety Plans (master record per event)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.health_safety_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title                 VARCHAR(200) NOT NULL DEFAULT 'Health & Safety Plan',
  status                VARCHAR(30) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','under_review','approved','archived')),
  crowd_capacity        INT,
  venue_area_sqm        NUMERIC(10,2),
  expected_attendance   INT,
  medical_team_count    INT DEFAULT 0,
  security_team_count   INT DEFAULT 0,
  first_aid_kits        INT DEFAULT 0,
  aed_units             INT DEFAULT 0,           -- defibrillators
  fire_extinguishers    INT DEFAULT 0,
  emergency_exits       INT DEFAULT 0,
  nearest_hospital      TEXT,
  hospital_distance_km  NUMERIC(5,2),
  emergency_contact_name    VARCHAR(150),
  emergency_contact_phone   VARCHAR(30),
  ambulance_on_site     BOOLEAN NOT NULL DEFAULT FALSE,
  police_liaison_name   VARCHAR(150),
  police_liaison_phone  VARCHAR(30),
  weather_contingency   TEXT,
  evacuation_plan_url   TEXT,
  notes                 TEXT,
  approved_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,
  reviewed_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  created_by            UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_plans_event ON public.health_safety_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_hs_plans_tenant ON public.health_safety_plans(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hs_plans_event_unique ON public.health_safety_plans(event_id);

-- ─────────────────────────────────────────────
-- Risk Assessments
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hs_risk_assessments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           UUID NOT NULL REFERENCES public.health_safety_plans(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category          VARCHAR(50) NOT NULL
                      CHECK (category IN (
                        'crowd_management','fire_safety','medical','security',
                        'electrical','structural','weather','food_safety',
                        'transport','chemical','noise','other'
                      )),
  hazard            TEXT NOT NULL,
  who_affected      TEXT,                          -- 'guests, staff, artists'
  likelihood        SMALLINT NOT NULL DEFAULT 3
                      CHECK (likelihood BETWEEN 1 AND 5),
  severity          SMALLINT NOT NULL DEFAULT 3
                      CHECK (severity BETWEEN 1 AND 5),
  risk_score        SMALLINT GENERATED ALWAYS AS (likelihood * severity) STORED,
  risk_level        VARCHAR(20) GENERATED ALWAYS AS (
                      CASE (likelihood * severity)
                        WHEN 1  THEN 'very_low'
                        WHEN 2  THEN 'very_low'
                        WHEN 3  THEN 'low'
                        WHEN 4  THEN 'low'
                        WHEN 5  THEN 'medium'
                        WHEN 6  THEN 'medium'
                        WHEN 8  THEN 'medium'
                        WHEN 9  THEN 'high'
                        WHEN 10 THEN 'high'
                        WHEN 12 THEN 'high'
                        WHEN 15 THEN 'critical'
                        WHEN 16 THEN 'critical'
                        WHEN 20 THEN 'critical'
                        WHEN 25 THEN 'critical'
                        ELSE 'medium'
                      END
                    ) STORED,
  mitigation        TEXT NOT NULL,
  residual_likelihood SMALLINT CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_severity   SMALLINT CHECK (residual_severity BETWEEN 1 AND 5),
  owner             VARCHAR(150),
  status            VARCHAR(20) NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','mitigated','accepted','closed')),
  review_date       DATE,
  notes             TEXT,
  created_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_risks_plan    ON public.hs_risk_assessments(plan_id);
CREATE INDEX IF NOT EXISTS idx_hs_risks_event   ON public.hs_risk_assessments(event_id);
CREATE INDEX IF NOT EXISTS idx_hs_risks_level   ON public.hs_risk_assessments(risk_level);

-- ─────────────────────────────────────────────
-- Incidents
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hs_incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID REFERENCES public.health_safety_plans(id) ON DELETE SET NULL,
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  incident_type   VARCHAR(50) NOT NULL
                    CHECK (incident_type IN (
                      'medical','security','fire','structural','crowd',
                      'electrical','weather','food_poisoning','theft',
                      'harassment','near_miss','other'
                    )),
  title           VARCHAR(200) NOT NULL,
  description     TEXT NOT NULL,
  severity        VARCHAR(20) NOT NULL DEFAULT 'minor'
                    CHECK (severity IN ('minor','moderate','serious','critical')),
  occurred_at     TIMESTAMPTZ NOT NULL,
  location        VARCHAR(200),
  injured_count   INT DEFAULT 0,
  hospitalized    BOOLEAN NOT NULL DEFAULT FALSE,
  reported_by     VARCHAR(150),
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action_taken    TEXT,
  follow_up       TEXT,
  police_report   BOOLEAN NOT NULL DEFAULT FALSE,
  police_ref_no   VARCHAR(100),
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','investigating','resolved','closed')),
  resolved_at     TIMESTAMPTZ,
  resolution_notes TEXT,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_incidents_event    ON public.hs_incidents(event_id);
CREATE INDEX IF NOT EXISTS idx_hs_incidents_type     ON public.hs_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_hs_incidents_severity ON public.hs_incidents(severity);

-- ─────────────────────────────────────────────
-- Pre-Event Checklists
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hs_checklists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES public.health_safety_plans(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  category    VARCHAR(50) NOT NULL DEFAULT 'general'
                CHECK (category IN (
                  'general','venue','medical','fire_safety','crowd',
                  'electrical','catering','security','communications','post_event'
                )),
  due_date    DATE,
  assigned_to VARCHAR(150),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','completed','n_a')),
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_checklists_plan  ON public.hs_checklists(plan_id);
CREATE INDEX IF NOT EXISTS idx_hs_checklists_event ON public.hs_checklists(event_id);

-- ─────────────────────────────────────────────
-- Checklist Items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hs_checklist_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id  UUID NOT NULL REFERENCES public.hs_checklists(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  is_checked    BOOLEAN NOT NULL DEFAULT FALSE,
  checked_by    VARCHAR(150),
  checked_at    TIMESTAMPTZ,
  notes         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_items_checklist ON public.hs_checklist_items(checklist_id);

-- ─────────────────────────────────────────────
-- Seed: default checklist templates (system level, tenant_id IS NULL → applied at first plan creation)
-- ─────────────────────────────────────────────
-- (Applied programmatically in service layer — not seeded here to avoid missing FK)

-- ─────────────────────────────────────────────
-- Updated-at triggers
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_hs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'health_safety_plans','hs_risk_assessments',
    'hs_incidents','hs_checklists'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION update_hs_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE public.health_safety_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_risk_assessments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_incidents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_checklists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_checklist_items     ENABLE ROW LEVEL SECURITY;

-- health_safety_plans
CREATE POLICY "hs_plans_tenant_isolation" ON public.health_safety_plans
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- hs_risk_assessments
CREATE POLICY "hs_risks_tenant_isolation" ON public.hs_risk_assessments
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- hs_incidents
CREATE POLICY "hs_incidents_tenant_isolation" ON public.hs_incidents
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- hs_checklists
CREATE POLICY "hs_checklists_tenant_isolation" ON public.hs_checklists
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- hs_checklist_items (join through checklist → plan → tenant)
CREATE POLICY "hs_items_tenant_isolation" ON public.hs_checklist_items
  USING (
    EXISTS (
      SELECT 1
      FROM public.hs_checklists cl
      WHERE cl.id = hs_checklist_items.checklist_id
        AND cl.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────
-- Crowd density view (helper for capacity calculations)
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_hs_crowd_density AS
SELECT
  p.id                          AS plan_id,
  p.event_id,
  p.crowd_capacity,
  p.venue_area_sqm,
  p.expected_attendance,
  CASE
    WHEN p.venue_area_sqm > 0 AND p.expected_attendance > 0
    THEN ROUND((p.expected_attendance / p.venue_area_sqm)::NUMERIC, 2)
    ELSE NULL
  END                           AS persons_per_sqm,
  CASE
    WHEN p.venue_area_sqm > 0 AND p.expected_attendance > 0
    THEN CASE
      WHEN (p.expected_attendance / p.venue_area_sqm) <= 1.0 THEN 'safe'
      WHEN (p.expected_attendance / p.venue_area_sqm) <= 2.0 THEN 'moderate'
      WHEN (p.expected_attendance / p.venue_area_sqm) <= 3.0 THEN 'dense'
      ELSE 'overcrowded'
    END
    ELSE 'unknown'
  END                           AS density_status
FROM public.health_safety_plans p;


-- ==========================================
-- Migration: 057_audit_trail.sql
-- ==========================================
-- ============================================================
-- Migration 057 — Audit Trail
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL,
  actor_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name    VARCHAR(200),
  actor_email   VARCHAR(254),
  actor_role    VARCHAR(50),
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id   VARCHAR(200),
  resource_name TEXT,
  old_value     JSONB,
  new_value     JSONB,
  diff          JSONB,          -- key-level diff computed at write time
  ip_address    INET,
  user_agent    TEXT,
  portal        VARCHAR(30) DEFAULT 'team'
                  CHECK (portal IN ('team','client','vendor','guest','super_admin','api')),
  severity      VARCHAR(20) NOT NULL DEFAULT 'info'
                  CHECK (severity IN ('info','warning','critical')),
  tags          TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes — optimise the most common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_tenant       ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event        ON public.audit_logs(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor        ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource     ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_action       ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_severity     ON public.audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_created_at   ON public.audit_logs(created_at DESC);

-- Partitioning hint: in production, partition by RANGE(created_at) monthly.
-- For development, single table is fine.

-- ─────────────────────────────────────────────
-- Auto-log trigger helper (used by other modules optionally)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_action TEXT;
  v_diff   JSONB := '{}';
  v_key    TEXT;
  v_old    JSONB;
  v_new    JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    -- Build diff: only changed fields
    FOR v_key IN SELECT key FROM jsonb_each(v_new) LOOP
      IF (v_new->v_key) IS DISTINCT FROM (v_old->v_key) THEN
        v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key));
      END IF;
    END LOOP;
    IF v_diff = '{}'::JSONB THEN RETURN NEW; END IF;  -- no change, skip
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_old := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_logs (
    tenant_id, resource_type, resource_id, action, old_value, new_value, diff, severity
  ) VALUES (
    COALESCE((v_new->>'tenant_id')::UUID, (v_old->>'tenant_id')::UUID),
    TG_TABLE_NAME,
    COALESCE(v_new->>'id', v_old->>'id'),
    v_action,
    v_old,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_new END,
    CASE WHEN v_diff = '{}'::JSONB THEN NULL ELSE v_diff END,
    CASE WHEN TG_OP = 'DELETE' THEN 'warning' ELSE 'info' END
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Never let audit logging break the main operation
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to high-value tables
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['events','guests','invoices','event_team_members'] LOOP
    BEGIN
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%I
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION audit_log_changes()',
        tbl, tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_tenant_read" ON public.audit_logs
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

-- Only service-role can insert (all writes go through the API / trigger)
CREATE POLICY "audit_service_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (TRUE);

-- No updates or deletes — immutable log
-- ─────────────────────────────────────────────
-- Aggregate view: activity summary per actor per day
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_audit_daily_summary AS
SELECT
  tenant_id,
  DATE_TRUNC('day', created_at)   AS day,
  actor_id,
  actor_name,
  COUNT(*)                        AS action_count,
  COUNT(*) FILTER (WHERE severity = 'critical') AS critical_count,
  COUNT(*) FILTER (WHERE severity = 'warning')  AS warning_count,
  array_agg(DISTINCT action)      AS actions_taken
FROM public.audit_logs
GROUP BY tenant_id, DATE_TRUNC('day', created_at), actor_id, actor_name;


-- ==========================================
-- Migration: 058_subscription_plans.sql
-- ==========================================
-- ============================================================
-- Migration 058 — Subscription Plans & Feature Enforcement
-- ============================================================

-- ─────────────────────────────────────────────
-- Plan definitions (system-level, seeded)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  VARCHAR(30) NOT NULL UNIQUE,
  name                  VARCHAR(50) NOT NULL,
  description           TEXT,
  price_monthly         NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly          NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency              VARCHAR(3) NOT NULL DEFAULT 'USD',
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  is_public             BOOLEAN NOT NULL DEFAULT TRUE,
  trial_days            INT NOT NULL DEFAULT 0,
  sort_order            INT NOT NULL DEFAULT 0,

  -- Hard limits (NULL = unlimited)
  max_events            INT,
  max_guests_per_event  INT,
  max_team_members      INT,
  max_storage_gb        NUMERIC(6,2),
  max_ai_calls_monthly  INT,
  max_short_links       INT,
  max_venues            INT,
  max_vendors           INT,

  -- Feature flags (JSONB for flexibility)
  features              JSONB NOT NULL DEFAULT '{}',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Tenant subscriptions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id           UUID NOT NULL REFERENCES public.subscription_plans(id),
  status            VARCHAR(30) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('trialing','active','past_due','cancelled','suspended','expired')),

  -- Billing cycle
  billing_period    VARCHAR(10) NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','yearly','lifetime')),
  current_period_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  trial_start           TIMESTAMPTZ,
  trial_end             TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Payment provider reference
  payment_provider      VARCHAR(30),
  external_subscription_id VARCHAR(200),
  external_customer_id     VARCHAR(200),

  -- Usage snapshot (refreshed daily by scheduler)
  usage_events          INT NOT NULL DEFAULT 0,
  usage_team_members    INT NOT NULL DEFAULT 0,
  usage_storage_gb      NUMERIC(6,2) NOT NULL DEFAULT 0,
  usage_ai_calls        INT NOT NULL DEFAULT 0,
  usage_short_links     INT NOT NULL DEFAULT 0,
  usage_refreshed_at    TIMESTAMPTZ,

  -- Override limits (Super Admin can grant extra capacity)
  override_max_events   INT,
  override_max_team     INT,
  override_max_storage  NUMERIC(6,2),

  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id)  -- one active subscription per tenant
);

CREATE INDEX IF NOT EXISTS idx_sub_tenant   ON public.tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_status   ON public.tenant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_sub_plan     ON public.tenant_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_sub_trial    ON public.tenant_subscriptions(trial_end) WHERE status = 'trialing';

-- ─────────────────────────────────────────────
-- Plan change history
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_change_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_plan_id    UUID REFERENCES public.subscription_plans(id),
  to_plan_id      UUID NOT NULL REFERENCES public.subscription_plans(id),
  changed_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason          TEXT,
  effective_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Seed: 4 plan tiers
-- ─────────────────────────────────────────────
INSERT INTO public.subscription_plans
  (id, slug, name, description, price_monthly, price_yearly, trial_days, sort_order,
   max_events, max_guests_per_event, max_team_members, max_storage_gb,
   max_ai_calls_monthly, max_short_links, max_venues, max_vendors, features)
VALUES
  -- FREE
  (
    'a0000000-0000-0000-0000-000000000001',
    'free', 'Free', 'For individuals testing the platform',
    0, 0, 0, 0,
    3, 50, 3, 1,
    20, 5, 2, 5,
    '{"ai_assistant":false,"ai_proposals":false,"ai_budget_optimizer":false,"white_label":false,
      "custom_domain":false,"api_access":false,"multi_currency":false,"advanced_analytics":false,
      "guest_portal":true,"vendor_portal":false,"client_portal":false,"audit_trail":false,
      "playbooks":false,"document_generation":false,"animated_invitations":false,
      "short_links":true,"event_types_custom":false,"offline_checkin":false,
      "payment_processing":false,"realtime_collaboration":false,"priority_support":false}'
  ),
  -- STARTER
  (
    'a0000000-0000-0000-0000-000000000002',
    'starter', 'Starter', 'For small event businesses getting started',
    29, 290, 0, 1,
    20, 300, 10, 10,
    100, 50, 5, 20,
    '{"ai_assistant":true,"ai_proposals":false,"ai_budget_optimizer":false,"white_label":false,
      "custom_domain":false,"api_access":false,"multi_currency":true,"advanced_analytics":false,
      "guest_portal":true,"vendor_portal":true,"client_portal":true,"audit_trail":true,
      "playbooks":true,"document_generation":true,"animated_invitations":true,
      "short_links":true,"event_types_custom":true,"offline_checkin":false,
      "payment_processing":true,"realtime_collaboration":false,"priority_support":false}'
  ),
  -- GROWTH (with 14-day free trial)
  (
    'a0000000-0000-0000-0000-000000000003',
    'growth', 'Growth', 'For growing event companies — includes 14-day free trial',
    79, 790, 14, 2,
    100, 2000, 25, 50,
    500, 200, 20, 100,
    '{"ai_assistant":true,"ai_proposals":true,"ai_budget_optimizer":true,"white_label":false,
      "custom_domain":true,"api_access":true,"multi_currency":true,"advanced_analytics":true,
      "guest_portal":true,"vendor_portal":true,"client_portal":true,"audit_trail":true,
      "playbooks":true,"document_generation":true,"animated_invitations":true,
      "short_links":true,"event_types_custom":true,"offline_checkin":true,
      "payment_processing":true,"realtime_collaboration":true,"priority_support":false}'
  ),
  -- AGENCY (unlimited)
  (
    'a0000000-0000-0000-0000-000000000004',
    'agency', 'Agency', 'For large event agencies — unlimited everything',
    199, 1990, 0, 3,
    NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    '{"ai_assistant":true,"ai_proposals":true,"ai_budget_optimizer":true,"white_label":true,
      "custom_domain":true,"api_access":true,"multi_currency":true,"advanced_analytics":true,
      "guest_portal":true,"vendor_portal":true,"client_portal":true,"audit_trail":true,
      "playbooks":true,"document_generation":true,"animated_invitations":true,
      "short_links":true,"event_types_custom":true,"offline_checkin":true,
      "payment_processing":true,"realtime_collaboration":true,"priority_support":true}'
  )
ON CONFLICT (slug) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  features      = EXCLUDED.features,
  updated_at    = NOW();

-- ─────────────────────────────────────────────
-- Default all existing tenants to Free plan
-- ─────────────────────────────────────────────
INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status)
SELECT
  t.id,
  'a0000000-0000-0000-0000-000000000001'::UUID,
  'active'
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_subscriptions ts WHERE ts.tenant_id = t.id
)
ON CONFLICT (tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- Computed view: tenant plan limits + current usage
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_tenant_plan AS
SELECT
  ts.tenant_id,
  ts.status                                             AS sub_status,
  ts.trial_end,
  ts.current_period_end,
  ts.cancel_at_period_end,
  sp.slug                                               AS plan_slug,
  sp.name                                               AS plan_name,
  sp.features,
  sp.price_monthly,
  -- Effective limits (override takes precedence)
  COALESCE(ts.override_max_events,   sp.max_events)    AS limit_events,
  COALESCE(ts.override_max_team,     sp.max_team_members) AS limit_team,
  COALESCE(ts.override_max_storage,  sp.max_storage_gb)   AS limit_storage_gb,
  sp.max_guests_per_event                               AS limit_guests_per_event,
  sp.max_ai_calls_monthly                               AS limit_ai_calls,
  sp.max_short_links                                    AS limit_short_links,
  sp.max_venues                                         AS limit_venues,
  sp.max_vendors                                        AS limit_vendors,
  -- Current usage
  ts.usage_events,
  ts.usage_team_members,
  ts.usage_storage_gb,
  ts.usage_ai_calls,
  ts.usage_short_links,
  ts.usage_refreshed_at,
  -- Is trial active?
  (ts.status = 'trialing' AND ts.trial_end > NOW())    AS is_trialing,
  -- Days left in trial
  GREATEST(0, EXTRACT(DAY FROM (ts.trial_end - NOW()))::INT) AS trial_days_remaining
FROM public.tenant_subscriptions ts
JOIN public.subscription_plans sp ON sp.id = ts.plan_id;

-- ─────────────────────────────────────────────
-- Updated-at triggers
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_sub_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_sub_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER trg_sub_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_sub_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_subs_updated_at ON public.tenant_subscriptions;
CREATE TRIGGER trg_tenant_subs_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_sub_updated_at();

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.subscription_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_change_history   ENABLE ROW LEVEL SECURITY;

-- Plans are public-readable
CREATE POLICY "plans_public_read" ON public.subscription_plans
  FOR SELECT USING (is_public = TRUE);

-- Tenant can only read their own subscription
CREATE POLICY "sub_tenant_read" ON public.tenant_subscriptions
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "plan_history_tenant_read" ON public.plan_change_history
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

-- Data preservation: mark subscription expired after 30-day grace post-cancellation
-- (handled by scheduler in super-admin automation engine)


-- ==========================================
-- Migration: 059_external_api.sql
-- ==========================================
-- ============================================================
-- Migration 059 — External Tenant API (API Keys + Webhooks)
-- ============================================================

-- ─────────────────────────────────────────────
-- API Keys
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name             VARCHAR(150) NOT NULL,
  key_prefix       VARCHAR(10) NOT NULL,          -- e.g. "op_live_" shown in UI
  key_hash         VARCHAR(64) NOT NULL UNIQUE,    -- SHA-256 of the raw key
  key_hint         VARCHAR(10) NOT NULL,           -- last 4 chars shown in UI
  scopes           TEXT[] NOT NULL DEFAULT '{}',  -- ['events:read','guests:write',…]
  environment      VARCHAR(10) NOT NULL DEFAULT 'live'
                     CHECK (environment IN ('live','test')),
  status           VARCHAR(20) NOT NULL DEFAULT 'pending_approval'
                     CHECK (status IN ('pending_approval','active','suspended','revoked')),
  approval_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  rate_limit_rpm   INT NOT NULL DEFAULT 60,        -- requests per minute
  rate_limit_daily INT NOT NULL DEFAULT 10000,     -- requests per day
  allowed_ips      INET[],                         -- NULL = any IP allowed
  description      TEXT,
  last_used_at     TIMESTAMPTZ,
  usage_count      BIGINT NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,                    -- NULL = never
  created_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant  ON public.api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash    ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_status  ON public.api_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix  ON public.api_keys(key_prefix);

-- ─────────────────────────────────────────────
-- API Usage Logs (time-series, partition-ready)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id           BIGSERIAL PRIMARY KEY,
  api_key_id   UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL,
  endpoint     VARCHAR(200) NOT NULL,
  method       VARCHAR(10) NOT NULL,
  status_code  SMALLINT NOT NULL,
  response_ms  INT,
  ip_address   INET,
  user_agent   TEXT,
  error_code   VARCHAR(50),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_key       ON public.api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_tenant    ON public.api_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_requested ON public.api_usage_logs(requested_at DESC);

-- ─────────────────────────────────────────────
-- Webhook Endpoints
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            VARCHAR(150) NOT NULL,
  url             TEXT NOT NULL,
  secret          VARCHAR(100) NOT NULL,           -- HMAC signing secret (stored hashed)
  events          TEXT[] NOT NULL DEFAULT '{}',   -- ['event.created','guest.updated',…]
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','disabled')),
  ssl_verify      BOOLEAN NOT NULL DEFAULT TRUE,
  timeout_seconds INT NOT NULL DEFAULT 10,
  retry_count     INT NOT NULL DEFAULT 3,
  last_triggered_at TIMESTAMPTZ,
  last_success_at   TIMESTAMPTZ,
  last_failure_at   TIMESTAMPTZ,
  failure_count     INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON public.api_webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON public.api_webhooks(status);

-- ─────────────────────────────────────────────
-- Webhook Delivery Logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      UUID NOT NULL REFERENCES public.api_webhooks(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  event_type      VARCHAR(100) NOT NULL,
  payload         JSONB NOT NULL,
  attempt         SMALLINT NOT NULL DEFAULT 1,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','success','failed','skipped')),
  response_code   SMALLINT,
  response_body   TEXT,
  response_ms     INT,
  error_message   TEXT,
  next_retry_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_webhook   ON public.webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_tenant    ON public.webhook_deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status    ON public.webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivered ON public.webhook_deliveries(delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_retry     ON public.webhook_deliveries(next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- ─────────────────────────────────────────────
-- Available scopes (reference table)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_scopes (
  scope       VARCHAR(100) PRIMARY KEY,
  category    VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO public.api_scopes (scope, category, description, is_sensitive) VALUES
  ('events:read',     'Events',   'Read event data',                  FALSE),
  ('events:write',    'Events',   'Create and update events',         FALSE),
  ('events:delete',   'Events',   'Delete events',                    TRUE),
  ('guests:read',     'Guests',   'Read guest list and RSVP data',    FALSE),
  ('guests:write',    'Guests',   'Create and update guests',         FALSE),
  ('guests:delete',   'Guests',   'Delete guests',                    TRUE),
  ('vendors:read',    'Vendors',  'Read vendor assignments',          FALSE),
  ('vendors:write',   'Vendors',  'Assign and update vendors',        FALSE),
  ('finance:read',    'Finance',  'Read invoices and payments',       TRUE),
  ('finance:write',   'Finance',  'Create invoices',                  TRUE),
  ('team:read',       'Team',     'Read team members',                FALSE),
  ('team:write',      'Team',     'Manage team assignments',          TRUE),
  ('analytics:read',  'Analytics','Read analytics and reports',       FALSE),
  ('ai:invoke',       'AI',       'Trigger AI features',              FALSE),
  ('webhooks:manage', 'Webhooks', 'Manage webhook endpoints',         TRUE),
  ('admin:read',      'Admin',    'Read tenant configuration',        TRUE),
  ('admin:write',     'Admin',    'Modify tenant configuration',      TRUE)
ON CONFLICT (scope) DO NOTHING;

-- ─────────────────────────────────────────────
-- Updated-at triggers
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_api_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['api_keys','api_webhooks'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION update_api_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE public.api_keys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_webhooks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- API keys
CREATE POLICY "api_keys_tenant_isolation" ON public.api_keys
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Usage logs (read-only for tenant)
CREATE POLICY "api_usage_tenant_isolation" ON public.api_usage_logs
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Webhooks
CREATE POLICY "webhooks_tenant_isolation" ON public.api_webhooks
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Deliveries
CREATE POLICY "deliveries_tenant_isolation" ON public.webhook_deliveries
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- Daily usage summary view
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_api_key_daily_usage AS
SELECT
  k.id          AS api_key_id,
  k.tenant_id,
  k.name        AS key_name,
  k.key_prefix,
  k.key_hint,
  k.rate_limit_daily,
  DATE(l.requested_at)            AS usage_date,
  COUNT(*)                        AS request_count,
  COUNT(*) FILTER (WHERE l.status_code >= 400) AS error_count,
  ROUND(AVG(l.response_ms))       AS avg_response_ms
FROM public.api_keys k
LEFT JOIN public.api_usage_logs l
  ON l.api_key_id = k.id
  AND l.requested_at >= NOW() - INTERVAL '30 days'
GROUP BY k.id, k.tenant_id, k.name, k.key_prefix, k.key_hint, k.rate_limit_daily, DATE(l.requested_at);



-- ==========================================
-- Migration: 060_gift_management.sql
-- ==========================================
-- ============================================================
-- Migration 060 — Gift Management Module
-- ============================================================

-- ─────────────────────────────────────────────
-- Gift Registry (per event)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_registries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL DEFAULT 'Gift Registry',
  description   TEXT,
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  public_slug   VARCHAR(80) UNIQUE,
  allow_cash    BOOLEAN NOT NULL DEFAULT TRUE,
  cash_target   NUMERIC(12,2),
  currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','closed','archived')),
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_registries_event  ON public.gift_registries(event_id);
CREATE INDEX IF NOT EXISTS idx_gift_registries_tenant ON public.gift_registries(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_registries_event_unique ON public.gift_registries(event_id);

-- ─────────────────────────────────────────────
-- Gift Items (wishlist entries on a registry)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id     UUID NOT NULL REFERENCES public.gift_registries(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) NOT NULL DEFAULT 'other'
                    CHECK (category IN (
                      'electronics','home_decor','kitchen','clothing',
                      'jewellery','experience','cash','voucher',
                      'books','toys','wellness','travel','other'
                    )),
  brand           VARCHAR(100),
  image_url       TEXT,
  product_url     TEXT,
  price           NUMERIC(12,2),
  currency_code   VARCHAR(3) NOT NULL DEFAULT 'INR',
  quantity_wanted INT NOT NULL DEFAULT 1,
  quantity_received INT NOT NULL DEFAULT 0,
  priority        VARCHAR(10) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','must_have')),
  is_group_gift   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INT NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_items_registry ON public.gift_items(registry_id);
CREATE INDEX IF NOT EXISTS idx_gift_items_event    ON public.gift_items(event_id);
CREATE INDEX IF NOT EXISTS idx_gift_items_category ON public.gift_items(category);

-- ─────────────────────────────────────────────
-- Gifts Received (actual gifts logged against an event)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gifts_received (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  registry_id     UUID REFERENCES public.gift_registries(id) ON DELETE SET NULL,
  gift_item_id    UUID REFERENCES public.gift_items(id) ON DELETE SET NULL,
  guest_id        UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  giver_name      VARCHAR(200),                    -- fallback if no guest_id
  giver_phone     VARCHAR(30),
  giver_email     VARCHAR(200),
  gift_type       VARCHAR(20) NOT NULL DEFAULT 'physical'
                    CHECK (gift_type IN ('physical','cash','voucher','experience','digital')),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) NOT NULL DEFAULT 'other',
  brand           VARCHAR(100),
  estimated_value NUMERIC(12,2),
  cash_amount     NUMERIC(12,2),                   -- only for cash gifts
  currency_code   VARCHAR(3) NOT NULL DEFAULT 'INR',
  quantity        INT NOT NULL DEFAULT 1,
  received_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by     VARCHAR(150),                    -- staff member who logged it
  storage_location VARCHAR(200),
  condition       VARCHAR(20) NOT NULL DEFAULT 'new'
                    CHECK (condition IN ('new','good','fair')),
  thank_you_sent  BOOLEAN NOT NULL DEFAULT FALSE,
  thank_you_sent_at TIMESTAMPTZ,
  thank_you_channel VARCHAR(20)
                    CHECK (thank_you_channel IN ('whatsapp','email','sms','in_person',NULL)),
  notes           TEXT,
  image_url       TEXT,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gifts_received_event      ON public.gifts_received(event_id);
CREATE INDEX IF NOT EXISTS idx_gifts_received_tenant     ON public.gifts_received(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gifts_received_guest      ON public.gifts_received(guest_id);
CREATE INDEX IF NOT EXISTS idx_gifts_received_type       ON public.gifts_received(gift_type);
CREATE INDEX IF NOT EXISTS idx_gifts_received_thankyou   ON public.gifts_received(thank_you_sent);

-- ─────────────────────────────────────────────
-- Thank You Templates
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_thankyou_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES public.events(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  channel     VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp','email','sms')),
  subject     VARCHAR(200),              -- email only
  body        TEXT NOT NULL,
  variables   TEXT[] NOT NULL DEFAULT '{}', -- e.g. ['{{giver_name}}','{{gift_name}}']
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thankyou_tenant ON public.gift_thankyou_templates(tenant_id);

-- ─────────────────────────────────────────────
-- Seed default templates
-- ─────────────────────────────────────────────
INSERT INTO public.gift_thankyou_templates
  (tenant_id, name, channel, body, variables, is_default)
SELECT
  t.id,
  'WhatsApp Thank You',
  'whatsapp',
  'Dear {{giver_name}}, thank you so much for the beautiful {{gift_name}}! Your thoughtfulness means the world to us. With love 💕',
  ARRAY['{{giver_name}}','{{gift_name}}'],
  TRUE
FROM public.tenants t
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- Gift summary view
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_gift_summary AS
SELECT
  e.id                                              AS event_id,
  e.tenant_id,
  COUNT(gr.id)                                      AS total_gifts,
  COUNT(gr.id) FILTER (WHERE gr.gift_type = 'cash') AS cash_gifts,
  COUNT(gr.id) FILTER (WHERE gr.gift_type = 'physical') AS physical_gifts,
  COALESCE(SUM(gr.estimated_value), 0)              AS total_estimated_value,
  COALESCE(SUM(gr.cash_amount), 0)                  AS total_cash_received,
  COUNT(gr.id) FILTER (WHERE gr.thank_you_sent = FALSE) AS pending_thankyou,
  COUNT(gr.id) FILTER (WHERE gr.thank_you_sent = TRUE)  AS thankyou_sent
FROM public.events e
LEFT JOIN public.gifts_received gr ON gr.event_id = e.id
GROUP BY e.id, e.tenant_id;

-- ─────────────────────────────────────────────
-- Updated-at triggers
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_gifts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['gift_registries','gift_items','gifts_received'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION update_gifts_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE public.gift_registries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gifts_received           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_thankyou_templates  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gift_registries_tenant" ON public.gift_registries
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "gift_items_tenant" ON public.gift_items
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "gifts_received_tenant" ON public.gifts_received
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "gift_templates_tenant" ON public.gift_thankyou_templates
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));



-- ==========================================
-- Migration: 061_guest_copy_between_events.sql
-- ==========================================
-- ============================================================
-- Migration 061 — Guest Copy Between Events
-- ============================================================

-- ─────────────────────────────────────────────
-- Copy Jobs — audit trail for each copy operation
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_copy_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  target_event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requested_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Strategy for handling duplicates (matched by email or phone)
  duplicate_strategy    VARCHAR(20) NOT NULL DEFAULT 'skip'
                          CHECK (duplicate_strategy IN ('skip', 'overwrite', 'add_anyway')),

  -- Fields to copy (JSON array of column names, NULL = all)
  fields_to_copy        JSONB,

  -- Outcome counters
  total_guests          INT NOT NULL DEFAULT 0,
  copied_count          INT NOT NULL DEFAULT 0,
  skipped_count         INT NOT NULL DEFAULT 0,
  overwritten_count     INT NOT NULL DEFAULT 0,

  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message         TEXT,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_copy_jobs_tenant     ON public.guest_copy_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guest_copy_jobs_target     ON public.guest_copy_jobs(target_event_id);
CREATE INDEX IF NOT EXISTS idx_guest_copy_jobs_source     ON public.guest_copy_jobs(source_event_id);

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE public.guest_copy_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_copy_jobs_tenant_isolation" ON public.guest_copy_jobs
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- Add copied_from_event_id column to guests (nullable — set when guest is a copy)
-- ─────────────────────────────────────────────
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS copied_from_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS copy_job_id           UUID REFERENCES public.guest_copy_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guests_copied_from ON public.guests(copied_from_event_id) WHERE copied_from_event_id IS NOT NULL;


-- ==========================================
-- Migration: 062_guest_portal_v2.sql
-- ==========================================
-- ============================================================
-- Migration 062 — Guest Portal v2 (14 sections, FAQs, Announcements, Contacts)
-- Extends migration 048
-- ============================================================

-- ─────────────────────────────────────────────
-- Add missing section columns to guest_portal_settings
-- ─────────────────────────────────────────────
ALTER TABLE public.guest_portal_settings
  ADD COLUMN IF NOT EXISTS section_food_menu       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS section_announcements   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS section_faqs            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS section_contacts        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS section_my_invites      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS otp_required            BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS self_reg_auto_approve   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS custom_welcome_message  TEXT,
  ADD COLUMN IF NOT EXISTS custom_theme_override   JSONB,
  ADD COLUMN IF NOT EXISTS cover_image_url         TEXT,
  ADD COLUMN IF NOT EXISTS host_name               VARCHAR(200);

-- ─────────────────────────────────────────────
-- FAQs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_portal_faqs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portal_faqs_event ON public.guest_portal_faqs(event_id);

-- ─────────────────────────────────────────────
-- Announcements (with real-time feed via Supabase Realtime)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_portal_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  emoji       VARCHAR(10),
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portal_announcements_event ON public.guest_portal_announcements(event_id);

-- ─────────────────────────────────────────────
-- Key Contacts
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_portal_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  role        VARCHAR(100),               -- 'Event Coordinator', 'Venue Manager', etc.
  phone       VARCHAR(30),
  email       VARCHAR(200),
  whatsapp    VARCHAR(30),
  avatar_url  TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portal_contacts_event ON public.guest_portal_contacts(event_id);

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.guest_portal_faqs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_portal_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_portal_contacts      ENABLE ROW LEVEL SECURITY;

-- Team access (read/write by authenticated users in the tenant)
CREATE POLICY "portal_faqs_tenant"          ON public.guest_portal_faqs
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "portal_announcements_tenant" ON public.guest_portal_announcements
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "portal_contacts_tenant"      ON public.guest_portal_contacts
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Updated-at triggers
CREATE OR REPLACE FUNCTION update_portal_v2_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
DROP TRIGGER IF EXISTS trg_portal_faqs_updated_at ON public.guest_portal_faqs;
  CREATE TRIGGER trg_portal_faqs_updated_at
    BEFORE UPDATE ON public.guest_portal_faqs
    FOR EACH ROW EXECUTE FUNCTION update_portal_v2_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ==========================================
-- Migration: 063_client_portal_v2.sql
-- ==========================================
-- 063_client_portal_v2.sql
-- Client Portal v2: sessions table, messages table, magic links, per-tenant email uniqueness

-- ── 1. Add tenant_id to client_accounts (missing from 049) ──────────────────
ALTER TABLE client_accounts
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Drop the global email unique constraint and replace with per-tenant unique
ALTER TABLE client_accounts
  DROP CONSTRAINT IF EXISTS client_accounts_email_key;

-- Re-add per-tenant unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_client_accounts_tenant_email'
  ) THEN
    ALTER TABLE client_accounts
      ADD CONSTRAINT uq_client_accounts_tenant_email UNIQUE (tenant_id, email);
  END IF;
END $$;

ALTER TABLE client_accounts
  ADD COLUMN IF NOT EXISTS profile_complete bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_url       text,
  ADD COLUMN IF NOT EXISTS last_login_at    timestamptz;

-- ── 2. client_portal_sessions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_portal_sessions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid        NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expires_at     timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  user_agent     text,
  ip_hash        varchar(64)
);

CREATE INDEX IF NOT EXISTS idx_cp_sessions_client  ON client_portal_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_cp_sessions_expires ON client_portal_sessions(expires_at);

-- ── 3. client_magic_links ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_magic_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid        NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash  text        NOT NULL,
  purpose     text        NOT NULL DEFAULT 'login',   -- login | set_password
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used        bool        NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_magic_links_client ON client_magic_links(client_id);

-- ── 4. client_messages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_type         text        NOT NULL CHECK (sender_type IN ('team', 'client')),
  sender_id           uuid        NOT NULL,
  message             text        NOT NULL,
  attachment_url      text,
  attachment_name     text,
  is_read_by_client   bool        NOT NULL DEFAULT false,
  is_read_by_team     bool        NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_messages_event   ON client_messages(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_messages_tenant  ON client_messages(tenant_id);

-- ── 5. Add access_level values — update existing 'view_only'→'view' ──────────
-- Keep backwards compat: the new enum adds 'view' | 'collaborator' | 'full'
-- existing rows have 'view_only' | 'collaborator' | 'full_access'
-- We normalise with a check constraint comment only — no data loss

-- ── 6. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE client_portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_magic_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_messages        ENABLE ROW LEVEL SECURITY;

-- service role bypasses RLS; policies for anon/authenticated tenants:
DO $$
BEGIN
  -- Sessions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_portal_sessions' AND policyname = 'service_all') THEN
    CREATE POLICY service_all ON client_portal_sessions USING (true) WITH CHECK (true);
  END IF;
  -- Magic links
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_magic_links' AND policyname = 'service_all') THEN
    CREATE POLICY service_all ON client_magic_links USING (true) WITH CHECK (true);
  END IF;
  -- Messages
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_messages' AND policyname = 'service_all') THEN
    CREATE POLICY service_all ON client_messages USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ==========================================
-- Migration: 064_vendor_portal.sql
-- ==========================================
-- ============================================================
-- 064_vendor_portal.sql
-- Vendor Portal: global vendor accounts, sessions, assignments,
-- messaging, and performance scoring
-- ============================================================

-- ── vendor_accounts ──────────────────────────────────────────
-- Global vendor accounts (not tenant-scoped; one account per email)
CREATE TABLE IF NOT EXISTS vendor_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  business_name  TEXT,
  phone          TEXT,
  category       TEXT NOT NULL DEFAULT 'Other'
                   CHECK (category IN (
                     'Catering','Photography','Decor','AV','Transport',
                     'Security','Entertainment','Venue','Floral','Cake',
                     'Makeup','Invitations','Lighting','Staffing','Other'
                   )),
  website        TEXT,
  bio            TEXT,
  avatar_url     TEXT,
  gstin          TEXT,
  -- Bank details stored encrypted at the application layer
  bank_account_name    TEXT,
  bank_account_number  TEXT,   -- store pgp-encrypted or app-encrypted
  bank_ifsc            TEXT,
  password_hash  TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  profile_complete BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_accounts_email    ON vendor_accounts (email);
CREATE INDEX IF NOT EXISTS idx_vendor_accounts_category ON vendor_accounts (category);

-- ── vendor_portal_sessions ───────────────────────────────────
-- UUID primary key IS the session token (same pattern as client portal)
CREATE TABLE IF NOT EXISTS vendor_portal_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      UUID NOT NULL REFERENCES vendor_accounts (id) ON DELETE CASCADE,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash        TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_sessions_vendor_id  ON vendor_portal_sessions (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_sessions_expires_at ON vendor_portal_sessions (expires_at);

-- ── vendor_password_reset_tokens ─────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID NOT NULL REFERENCES vendor_accounts (id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  purpose     TEXT NOT NULL DEFAULT 'reset' CHECK (purpose IN ('reset','set_password')),
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_pwd_token_hash ON vendor_password_reset_tokens (token_hash);

-- ── vendor_event_assignments ─────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_event_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           UUID NOT NULL REFERENCES vendor_accounts (id) ON DELETE RESTRICT,
  event_id            UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  service_description TEXT,
  agreed_amount       DECIMAL(12,2),
  currency_code       TEXT NOT NULL DEFAULT 'INR',
  status              TEXT NOT NULL DEFAULT 'invited'
                        CHECK (status IN (
                          'invited','confirmed','in_progress',
                          'completed','cancelled','declined'
                        )),
  assigned_by         UUID REFERENCES profiles (id) ON DELETE SET NULL,
  -- Staff ratings / notes (hidden from vendor)
  tenant_rating       SMALLINT CHECK (tenant_rating BETWEEN 1 AND 5),
  vendor_notes        TEXT,      -- internal staff notes
  -- Vendor response
  vendor_response_note TEXT,
  responded_at        TIMESTAMPTZ,
  -- Timestamps
  invited_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (vendor_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_vea_vendor_id  ON vendor_event_assignments (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vea_event_id   ON vendor_event_assignments (event_id);
CREATE INDEX IF NOT EXISTS idx_vea_tenant_id  ON vendor_event_assignments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_vea_status     ON vendor_event_assignments (status);

-- ── vendor_messages ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES vendor_event_assignments (id) ON DELETE CASCADE,
  sender_type     TEXT NOT NULL CHECK (sender_type IN ('team','vendor')),
  sender_id       UUID,   -- profiles.id if team, vendor_accounts.id if vendor
  content         TEXT NOT NULL,
  is_read_by_vendor BOOLEAN NOT NULL DEFAULT FALSE,
  is_read_by_team   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_messages_assignment_id ON vendor_messages (assignment_id);
CREATE INDEX IF NOT EXISTS idx_vendor_messages_created_at    ON vendor_messages (created_at);

-- ── vendor_performance_scores (view) ─────────────────────────
CREATE OR REPLACE VIEW vendor_performance_scores AS
SELECT
  va.id                                               AS vendor_id,
  va.name                                             AS vendor_name,
  va.category,
  COUNT(vea.id)                                       AS total_assignments,
  COUNT(vea.id) FILTER (WHERE vea.status = 'completed') AS completed_assignments,
  ROUND(AVG(vea.tenant_rating) FILTER (WHERE vea.tenant_rating IS NOT NULL), 2)
                                                      AS avg_rating,
  -- Simple performance score: 50% completion rate + 50% avg rating (normalised to 20)
  ROUND(
    COALESCE(
      (COUNT(vea.id) FILTER (WHERE vea.status = 'completed')::NUMERIC /
       NULLIF(COUNT(vea.id), 0)) * 50, 0
    ) +
    COALESCE(
      (AVG(vea.tenant_rating) FILTER (WHERE vea.tenant_rating IS NOT NULL) / 5.0) * 50, 0
    ),
  0)                                                  AS score
FROM vendor_accounts va
LEFT JOIN vendor_event_assignments vea ON vea.vendor_id = va.id
GROUP BY va.id, va.name, va.category;

-- ── updated_at triggers ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_vendor_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_accounts_updated_at ON vendor_accounts;
CREATE TRIGGER trg_vendor_accounts_updated_at
  BEFORE UPDATE ON vendor_accounts
  FOR EACH ROW EXECUTE FUNCTION update_vendor_updated_at();

DROP TRIGGER IF EXISTS trg_vea_updated_at ON vendor_event_assignments;
CREATE TRIGGER trg_vea_updated_at
  BEFORE UPDATE ON vendor_event_assignments
  FOR EACH ROW EXECUTE FUNCTION update_vendor_updated_at();


-- ==========================================
-- Migration: 065_team_invitations_soft_delete.sql
-- ==========================================
-- ============================================================
-- 065_team_invitations_soft_delete.sql
-- 1. team_invitations — invite-link flow for workspace members
-- 2. events soft-delete — 30-day grace period before purge
-- ============================================================

-- ── 1. TEAM INVITATIONS ──────────────────────────────────────

-- Role enum (reuse if already exists, otherwise create)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_member_role') THEN
    CREATE TYPE workspace_member_role AS ENUM (
      'event_manager',
      'team_lead',
      'team_member'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS team_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email        VARCHAR(255) NOT NULL,
  name         VARCHAR(255),
  role         workspace_member_role NOT NULL DEFAULT 'team_member',
  invited_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 64-char random hex generated at application layer
  token        VARCHAR(64) NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at  TIMESTAMPTZ,
  is_revoked   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup by token (public invite-link resolution)
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invitations_token
  ON team_invitations (token);

-- Prevent duplicate pending invitations per workspace+email
CREATE INDEX IF NOT EXISTS idx_team_invitations_tenant_email
  ON team_invitations (tenant_id, email);

-- ── 2. EVENTS SOFT DELETE ────────────────────────────────────

-- Add soft-delete columns to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS deleted_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_purge_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by              UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Index for fast deleted-events queries (per tenant)
CREATE INDEX IF NOT EXISTS idx_events_deleted_at
  ON events (tenant_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── deleted_events view ──────────────────────────────────────
-- Convenience view; consumers should still apply tenant_id filter.
CREATE OR REPLACE VIEW deleted_events AS
  SELECT
    *,
    GREATEST(0, EXTRACT(EPOCH FROM (deletion_scheduled_purge_at - NOW())) / 86400)::int
      AS days_until_purge
  FROM events
  WHERE deleted_at IS NOT NULL;

-- ── Soft-delete cascade trigger ──────────────────────────────
-- When an event is soft-deleted:
--   • cancel all vendor assignments
--   • deactivate all team event access entries
CREATE OR REPLACE FUNCTION fn_event_soft_delete_cascade()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when deleted_at transitions NULL → non-null
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN

    -- Cancel pending/confirmed vendor assignments
    UPDATE vendor_event_assignments
    SET    status     = 'cancelled',
           updated_at = NOW()
    WHERE  event_id = NEW.id
      AND  status NOT IN ('cancelled', 'completed');

    -- Deactivate team access
    UPDATE team_event_access
    SET    is_active  = FALSE,
           updated_at = NOW()
    WHERE  event_id = NEW.id
      AND  is_active = TRUE;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_soft_delete_cascade ON events;
CREATE TRIGGER trg_event_soft_delete_cascade
  AFTER UPDATE OF deleted_at ON events
  FOR EACH ROW
  EXECUTE FUNCTION fn_event_soft_delete_cascade();

-- ── Scheduled purge (pg_cron) ────────────────────────────────
-- Run once daily; permanently deletes events whose grace period has elapsed.
-- Enable extension first:  CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Then schedule:
--   SELECT cron.schedule(
--     'purge-soft-deleted-events',
--     '0 3 * * *',
--     $$DELETE FROM events
--       WHERE deleted_at IS NOT NULL
--         AND deletion_scheduled_purge_at < NOW()$$
--   );

-- ── RLS policies for team_invitations ───────────────────────
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Workspace members can read their own workspace's invitations
CREATE POLICY "tenant members can view invitations"
  ON team_invitations FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Only admins / owners can insert (enforced at application layer too)
CREATE POLICY "tenant members can create invitations"
  ON team_invitations FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Revoking / accepting updates locked to same tenant
CREATE POLICY "tenant members can update invitations"
  ON team_invitations FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );


-- ==========================================
-- Migration: 066_subscriptions_inr_update.sql
-- ==========================================
-- ============================================================
-- Migration 066 — Subscription System: INR Pricing + Plan Features
--                  + DB Functions + Auto-Trial Trigger
-- ============================================================
-- Builds on migration 058 which created the core tables.
-- This migration:
--   1. Updates plan prices to INR (₹)
--   2. Adds plan_features table for granular feature rows
--   3. Creates get_tenant_plan_limits() function
--   4. Creates check_feature_access() function
--   5. Adds auto-trial trigger on tenant INSERT
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Update plan currency + prices to INR
-- ─────────────────────────────────────────────

-- Free plan stays free
UPDATE public.subscription_plans SET
  currency       = 'INR',
  price_monthly  = 0,
  price_yearly   = 0,
  updated_at     = NOW()
WHERE slug = 'free';

-- Starter: ₹2,499/mo | ₹24,990/yr (~17% savings)
UPDATE public.subscription_plans SET
  currency       = 'INR',
  price_monthly  = 2499,
  price_yearly   = 24990,
  updated_at     = NOW()
WHERE slug = 'starter';

-- Growth: ₹5,999/mo | ₹59,990/yr (~17% savings)
UPDATE public.subscription_plans SET
  currency       = 'INR',
  price_monthly  = 5999,
  price_yearly   = 59990,
  trial_days     = 14,
  updated_at     = NOW()
WHERE slug = 'growth';

-- Agency: ₹12,999/mo | ₹1,29,990/yr (~17% savings)
UPDATE public.subscription_plans SET
  currency       = 'INR',
  price_monthly  = 12999,
  price_yearly   = 129990,
  updated_at     = NOW()
WHERE slug = 'agency';

-- ─────────────────────────────────────────────
-- 2. plan_features table (granular feature rows)
--    Provides an indexed, queryable alternative to
--    the JSONB features column for feature gates.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_features (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_key   VARCHAR(60)  NOT NULL,
  is_enabled    BOOLEAN      NOT NULL DEFAULT FALSE,
  limit_value   INT,               -- NULL = unlimited (when feature has a numeric cap)
  description   TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (plan_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_plan_features_plan    ON public.plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_key     ON public.plan_features(feature_key);
CREATE INDEX IF NOT EXISTS idx_plan_features_enabled ON public.plan_features(plan_id, feature_key) WHERE is_enabled = TRUE;

-- updated_at trigger for plan_features
DROP TRIGGER IF EXISTS trg_plan_features_updated_at ON public.plan_features;
CREATE TRIGGER trg_plan_features_updated_at
  BEFORE UPDATE ON public.plan_features
  FOR EACH ROW EXECUTE FUNCTION update_sub_updated_at();

-- RLS for plan_features (public read, since it mirrors the plans)
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_features_public_read" ON public.plan_features
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.subscription_plans sp
      WHERE sp.id = plan_id AND sp.is_public = TRUE
    )
  );

-- ─────────────────────────────────────────────
-- Seed plan_features rows from JSONB features column
-- (insert only — idempotent via ON CONFLICT)
-- ─────────────────────────────────────────────

INSERT INTO public.plan_features (plan_id, feature_key, is_enabled)
SELECT
  sp.id,
  kv.key     AS feature_key,
  (kv.value::TEXT = 'true') AS is_enabled
FROM public.subscription_plans sp,
     jsonb_each(sp.features) AS kv
WHERE jsonb_typeof(kv.value) = 'boolean'
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW();

-- ─────────────────────────────────────────────
-- 3. get_tenant_plan_limits()
--    Returns a complete summary of the tenant's
--    current plan limits, trial state, and usage.
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_tenant_plan_limits(
  p_tenant_id UUID
)
RETURNS TABLE (
  plan_slug               VARCHAR,
  plan_name               VARCHAR,
  sub_status              VARCHAR,
  is_trialing             BOOLEAN,
  trial_days_remaining    INT,
  trial_ends_at           TIMESTAMPTZ,
  currency                VARCHAR,
  price_monthly           NUMERIC,

  -- Effective hard limits (override > plan default)
  max_events              INT,
  max_guests_per_event    INT,
  max_team_members        INT,
  max_storage_gb          NUMERIC,
  max_ai_calls_monthly    INT,
  max_short_links         INT,
  max_venues              INT,
  max_vendors             INT,

  -- Current usage
  usage_events            INT,
  usage_team_members      INT,
  usage_storage_gb        NUMERIC,
  usage_ai_calls          INT,
  usage_short_links       INT,
  usage_refreshed_at      TIMESTAMPTZ,

  -- Feature flags (full JSONB for flexible access)
  features_json           JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS
$$
BEGIN
  RETURN QUERY
  SELECT
    sp.slug::VARCHAR,
    sp.name::VARCHAR,
    ts.status::VARCHAR,
    (ts.status = 'trialing' AND ts.trial_end > NOW()),
    GREATEST(0, EXTRACT(DAY FROM (ts.trial_end - NOW()))::INT),
    ts.trial_end,
    sp.currency::VARCHAR,
    sp.price_monthly,

    -- Effective limits
    COALESCE(ts.override_max_events,  sp.max_events)::INT,
    sp.max_guests_per_event::INT,
    COALESCE(ts.override_max_team,    sp.max_team_members)::INT,
    COALESCE(ts.override_max_storage, sp.max_storage_gb)::NUMERIC,
    sp.max_ai_calls_monthly::INT,
    sp.max_short_links::INT,
    sp.max_venues::INT,
    sp.max_vendors::INT,

    -- Usage
    ts.usage_events,
    ts.usage_team_members,
    ts.usage_storage_gb,
    ts.usage_ai_calls,
    ts.usage_short_links,
    ts.usage_refreshed_at,

    sp.features
  FROM public.tenant_subscriptions ts
  JOIN public.subscription_plans sp ON sp.id = ts.plan_id
  WHERE ts.tenant_id = p_tenant_id;
END;
$$;

-- Grant execute to authenticated service role
GRANT EXECUTE ON FUNCTION public.get_tenant_plan_limits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tenant_plan_limits(UUID) TO authenticated;

-- ─────────────────────────────────────────────
-- 4. check_feature_access()
--    Fast boolean check for a single feature key.
--    Returns FALSE if tenant has no subscription or
--    feature doesn't exist on their plan.
--    Also returns FALSE if subscription is expired/cancelled
--    (unless feature_key = 'read_only_access').
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_feature_access(
  p_tenant_id   UUID,
  p_feature_key VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER AS
$$
DECLARE
  v_status    VARCHAR;
  v_is_trial  BOOLEAN;
  v_enabled   BOOLEAN;
BEGIN
  -- Get subscription status
  SELECT
    ts.status,
    (ts.status = 'trialing' AND ts.trial_end > NOW())
  INTO v_status, v_is_trial
  FROM public.tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id;

  -- No subscription found → deny
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Expired / cancelled subscriptions lose feature access
  -- (except a special read_only_access key for graceful degradation)
  IF v_status IN ('cancelled', 'suspended', 'expired') AND p_feature_key <> 'read_only_access' THEN
    -- Grace: still allow basic access to existing data
    RETURN FALSE;
  END IF;

  -- past_due gets 7-day grace on all features before lockout
  -- (scheduler handles transition to expired after grace period)

  -- Check feature flag in plan_features table first (most accurate)
  SELECT pf.is_enabled INTO v_enabled
  FROM public.tenant_subscriptions ts
  JOIN public.plan_features pf ON pf.plan_id = ts.plan_id
  WHERE ts.tenant_id = p_tenant_id
    AND pf.feature_key = p_feature_key;

  IF FOUND THEN
    RETURN COALESCE(v_enabled, FALSE);
  END IF;

  -- Fall back to JSONB features column
  SELECT (sp.features ->> p_feature_key)::BOOLEAN INTO v_enabled
  FROM public.tenant_subscriptions ts
  JOIN public.subscription_plans sp ON sp.id = ts.plan_id
  WHERE ts.tenant_id = p_tenant_id;

  RETURN COALESCE(v_enabled, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_feature_access(UUID, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_feature_access(UUID, VARCHAR) TO authenticated;

-- ─────────────────────────────────────────────
-- 5. Auto-trial trigger on new tenant creation
--    Inserts a Growth-plan trialing subscription
--    whenever a new row is inserted into tenants.
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_auto_trial_on_workspace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS
$$
DECLARE
  v_growth_plan_id UUID;
BEGIN
  -- Look up Growth plan UUID
  SELECT id INTO v_growth_plan_id
  FROM public.subscription_plans
  WHERE slug = 'growth'
  LIMIT 1;

  -- Only proceed if Growth plan exists
  IF v_growth_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert 14-day Growth trial (skip if already has a subscription)
  INSERT INTO public.tenant_subscriptions (
    tenant_id,
    plan_id,
    status,
    billing_period,
    current_period_start,
    current_period_end,
    trial_start,
    trial_end,
    metadata
  )
  VALUES (
    NEW.id,
    v_growth_plan_id,
    'trialing',
    'monthly',
    NOW(),
    NOW() + INTERVAL '14 days',   -- period end = trial end
    NOW(),
    NOW() + INTERVAL '14 days',
    jsonb_build_object('auto_trial', TRUE, 'source', 'workspace_creation')
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop before recreate (idempotent)
DROP TRIGGER IF EXISTS trg_auto_trial_on_workspace ON public.tenants;

CREATE TRIGGER trg_auto_trial_on_workspace
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_trial_on_workspace();

-- ─────────────────────────────────────────────
-- 6. pg_cron: expire trials + downgrade to Free
--    (runs daily at 01:00 UTC)
--    Requires pg_cron extension to be enabled.
-- ─────────────────────────────────────────────

DO $$
BEGIN
  -- Only schedule if pg_cron is available
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove existing job if any
    PERFORM cron.unschedule('expire_trials')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'expire_trials'
    );

    PERFORM cron.schedule(
      'expire_trials',
      '0 1 * * *',   -- 01:00 UTC daily
      $$
        -- 1. Expire trials that ended
        UPDATE public.tenant_subscriptions
        SET
          status    = 'expired',
          updated_at = NOW()
        WHERE status = 'trialing'
          AND trial_end < NOW();

        -- 2. Downgrade expired/past_due (past 7-day grace) → Free
        UPDATE public.tenant_subscriptions ts
        SET
          plan_id   = (SELECT id FROM public.subscription_plans WHERE slug = 'free'),
          status    = 'active',
          updated_at = NOW()
        WHERE ts.status IN ('expired', 'past_due')
          AND ts.updated_at < NOW() - INTERVAL '7 days';
      $$
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 7. Refresh v_tenant_plan view to include
--    trial_ends_at + currency columns
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_tenant_plan AS
SELECT
  ts.tenant_id,
  ts.id                                                         AS subscription_id,
  ts.status                                                     AS sub_status,
  ts.trial_start,
  ts.trial_end                                                  AS trial_ends_at,
  ts.current_period_start,
  ts.current_period_end,
  ts.cancel_at_period_end,
  ts.billing_period,
  sp.id                                                         AS plan_id,
  sp.slug                                                       AS plan_slug,
  sp.name                                                       AS plan_name,
  sp.currency,
  sp.price_monthly,
  sp.price_yearly,
  sp.features,

  -- Effective limits (override takes precedence)
  COALESCE(ts.override_max_events,   sp.max_events)            AS limit_events,
  COALESCE(ts.override_max_team,     sp.max_team_members)      AS limit_team,
  COALESCE(ts.override_max_storage,  sp.max_storage_gb)        AS limit_storage_gb,
  sp.max_guests_per_event                                       AS limit_guests_per_event,
  sp.max_ai_calls_monthly                                       AS limit_ai_calls,
  sp.max_short_links                                            AS limit_short_links,
  sp.max_venues                                                 AS limit_venues,
  sp.max_vendors                                                AS limit_vendors,

  -- Current usage
  ts.usage_events,
  ts.usage_team_members,
  ts.usage_storage_gb,
  ts.usage_ai_calls,
  ts.usage_short_links,
  ts.usage_refreshed_at,

  -- Trial helpers
  (ts.status = 'trialing' AND ts.trial_end > NOW())            AS is_trialing,
  GREATEST(0, EXTRACT(DAY FROM (ts.trial_end - NOW()))::INT)   AS trial_days_remaining,

  -- Access state
  CASE
    WHEN ts.status IN ('trialing', 'active')               THEN 'active'
    WHEN ts.status = 'past_due'                            THEN 'grace'
    WHEN ts.status IN ('cancelled','suspended','expired')  THEN 'locked'
    ELSE 'unknown'
  END                                                           AS access_state
FROM public.tenant_subscriptions ts
JOIN public.subscription_plans sp ON sp.id = ts.plan_id;

-- ─────────────────────────────────────────────
-- 8. Razorpay payment reference columns
--    (safe ADD COLUMN IF NOT EXISTS)
-- ─────────────────────────────────────────────

ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_customer_id      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_plan_id          VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_sub_razorpay
  ON public.tenant_subscriptions(razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────────


-- ==========================================
-- Migration: 067_platform_support_bot.sql
-- ==========================================
-- ============================================================
-- 067_platform_support_bot.sql
-- Platform-level support: FAQ bot, super-admin ticket inbox,
-- conversation threads, and 20 seeded FAQs.
-- ============================================================

-- ── 1. support_faqs — managed by Super Admin only ─────────────────────────────

CREATE TABLE IF NOT EXISTS support_faqs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  keywords    TEXT[]      NOT NULL DEFAULT '{}',
  category    VARCHAR(100) NOT NULL DEFAULT 'General'
                CHECK (category IN ('Billing','Features','Technical','Account','Events','General')),
  sort_order  INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  view_count  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_faqs_category ON support_faqs(category, is_active);
CREATE INDEX IF NOT EXISTS idx_support_faqs_active   ON support_faqs(is_active, sort_order);

ALTER TABLE support_faqs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active FAQs
CREATE POLICY faq_read_active ON support_faqs
  FOR SELECT USING (is_active = TRUE);

-- ── 2. Extend support_tickets with platform-bot fields ───────────────────────
-- The existing table (024) has: tenant_id, title, description, status, priority, reporter_id, etc.
-- We add bot-related + super-admin fields on top.

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS submitted_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject            VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bot_faq_id         UUID REFERENCES support_faqs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalated_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_notes   TEXT,
  ADD COLUMN IF NOT EXISTS super_admin_notes  TEXT;

-- Extend the status CHECK to include bot-handled and escalated values.
-- We drop + re-add the constraint rather than modifying inline (Postgres compatibility).
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN (
    'open','bot_handled','escalated','in_progress',
    'resolved','closed','cancelled','pending_client'
  ));

-- ── 3. support_messages — conversation thread per ticket ─────────────────────

CREATE TABLE IF NOT EXISTS support_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type  TEXT        NOT NULL CHECK (sender_type IN ('user','bot','super_admin')),
  sender_id    UUID,           -- profiles.id; NULL for bot messages
  message      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id, created_at);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Users see messages on tickets that belong to their tenant
CREATE POLICY msg_tenant_read ON support_messages
  FOR SELECT USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY msg_tenant_insert ON support_messages
  FOR INSERT WITH CHECK (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Super Admin sees all tickets / messages (bypasses tenant_isolation)
-- We use a SECURITY DEFINER function approach: add a separate permissive policy.
CREATE POLICY super_admin_full_tickets ON support_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_full_messages ON support_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_full_faqs ON support_faqs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ── 4. updated_at trigger for support_faqs ───────────────────────────────────

CREATE OR REPLACE FUNCTION fn_support_faq_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_faq_updated ON support_faqs;
CREATE TRIGGER trg_support_faq_updated
  BEFORE UPDATE ON support_faqs
  FOR EACH ROW EXECUTE FUNCTION fn_support_faq_updated_at();

-- ── 5. Enable Realtime on support_messages ────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;

-- ── 6. Seed 20 platform FAQs ─────────────────────────────────────────────────

INSERT INTO support_faqs (question, answer, keywords, category, sort_order) VALUES

-- ── Billing (5) ──────────────────────────────────────────────────────────────
(
  'How do I upgrade my plan?',
  'Go to **Settings → Billing** from the left sidebar. You''ll see all available plans with their features. Click "Upgrade" on the plan you want, and you''ll be taken to a secure Razorpay checkout. Your new plan activates immediately after payment.',
  ARRAY['upgrade','plan','billing','payment','subscription','razorpay','checkout'],
  'Billing', 10
),
(
  'Can I switch from monthly to yearly billing?',
  'Yes! Head to **Settings → Billing**, scroll down to your current plan, and click "Switch to Yearly". Yearly plans save you ~17% compared to monthly. Your billing cycle resets from the switch date.',
  ARRAY['yearly','annual','monthly','billing','switch','cycle','save'],
  'Billing', 20
),
(
  'How do I cancel my subscription?',
  'Go to **Settings → Billing** and click "Cancel Subscription" at the bottom of the page. Your access continues until the end of your current billing period. Data is preserved for 90 days after cancellation so you can reactivate anytime.',
  ARRAY['cancel','subscription','end','stop','billing','refund'],
  'Billing', 30
),
(
  'What payment methods are accepted?',
  'We accept all major credit/debit cards (Visa, Mastercard, Rupay), UPI, net banking, and wallets through Razorpay. All payments are processed securely and your card details are never stored on our servers.',
  ARRAY['payment','card','upi','netbanking','wallet','razorpay','accepted','methods'],
  'Billing', 40
),
(
  'What happens when my free trial ends?',
  'Your 14-day Growth trial expires automatically. You''ll see a full-screen prompt to choose a paid plan. Your events, guests, and all data are preserved — nothing is deleted. You have 30 days to reactivate before data cleanup begins.',
  ARRAY['trial','expire','ends','free','data','after','grace'],
  'Billing', 50
),

-- ── Features (4) ─────────────────────────────────────────────────────────────
(
  'How do I invite team members?',
  'Go to **Settings → Team** and click "Invite Member". Enter their email address and select their role (Manager, Coordinator, or Viewer). They''ll receive an email invite valid for 7 days. Team member limits depend on your plan.',
  ARRAY['invite','team','member','add','role','email','staff'],
  'Features', 10
),
(
  'What is the AI assistant and what can it do?',
  'The AI assistant (available on Growth and Agency plans) helps you generate event proposals, draft guest communications, suggest vendor options, forecast budgets, and automate repetitive planning tasks. Access it from any page via the AI button in the top bar.',
  ARRAY['ai','assistant','artificial intelligence','proposal','automation','smart','generate'],
  'Features', 20
),
(
  'Can I create a custom client portal for my clients?',
  'Yes! In any event, go to **Portals → Client Portal** and enable it. Your client gets a branded link where they can approve vendors, view budgets, upload documents, and communicate — all without needing an OccasionPro account.',
  ARRAY['client','portal','branded','link','access','share','approve','collaborate'],
  'Features', 30
),
(
  'Is there a mobile app?',
  'OccasionPro is fully responsive and works great on mobile browsers. A dedicated iOS/Android app is on our roadmap for Q3 2026. In the meantime, you can add the web app to your home screen for an app-like experience.',
  ARRAY['mobile','app','ios','android','phone','tablet','responsive'],
  'Features', 40
),

-- ── Events (4) ───────────────────────────────────────────────────────────────
(
  'How do I add guests to an event?',
  'Open the event, go to the **Guests** tab, and click "Add Guest". You can add individually, bulk-import from CSV (download our template first), or copy guests from a previous event. Each guest gets a unique QR code for check-in.',
  ARRAY['guest','add','import','csv','bulk','rsvp','checkin','qr'],
  'Events', 10
),
(
  'How do I send invitations to guests?',
  'From the Guests tab, select guests and click **Send Invitation**. Choose from email, WhatsApp, or SMS. You can customise the invitation template with your event branding, RSVP link, and a personal message.',
  ARRAY['invitation','send','email','whatsapp','sms','invite','rsvp','message'],
  'Events', 20
),
(
  'Can I set up an online RSVP page?',
  'Yes. In your event settings go to **Microsites → RSVP Page**. Customise the design with your event colors, add a cover photo, meal preferences, dietary requirements, and any custom questions. Share the RSVP link directly or embed it on your website.',
  ARRAY['rsvp','online','form','microsite','website','registration','page','link'],
  'Events', 30
),
(
  'How do I delete an event?',
  'Go to the event, click the three-dot menu (⋯) in the top-right, and select "Delete Event". You''ll be asked to confirm. Deleting an event permanently removes all associated data — guests, tasks, vendors, documents. This cannot be undone.',
  ARRAY['delete','remove','event','archive','cancel','permanently'],
  'Events', 40
),

-- ── Technical (4) ────────────────────────────────────────────────────────────
(
  'How do I export my data?',
  'Go to **Settings → Data & Exports**. You can export guests (CSV/Excel), events summary, vendor contracts, financial reports, and more. Full workspace data exports (ZIP) are available on Growth and Agency plans and are delivered by email within 30 minutes.',
  ARRAY['export','data','download','csv','excel','backup','zip','report'],
  'Technical', 10
),
(
  'Can I connect a custom domain to my client portals?',
  'Yes, on the Agency plan. Go to **Settings → Branding → Custom Domain**, enter your domain (e.g. portal.youreventco.com), and follow the DNS instructions. It typically takes 10–30 minutes to propagate. SSL is automatic.',
  ARRAY['custom','domain','dns','ssl','branding','white label','cname','portal'],
  'Technical', 20
),
(
  'Why is the app running slowly?',
  'Try clearing your browser cache and reloading. OccasionPro works best in Chrome, Edge, or Safari (latest versions). If slowness persists, check your internet connection, disable browser extensions temporarily, and try an incognito window. If the issue continues, please contact support.',
  ARRAY['slow','performance','loading','lag','cache','browser','speed','issue'],
  'Technical', 30
),
(
  'Is my data secure and backed up?',
  'All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We run on Supabase/AWS infrastructure with automated daily backups retained for 30 days. We are SOC 2 compliant and GDPR-ready. View our full security policy at occasionpro.com/security.',
  ARRAY['security','backup','encrypted','data','safe','privacy','gdpr','soc2','compliant'],
  'Technical', 40
),

-- ── Account (3) ──────────────────────────────────────────────────────────────
(
  'How do I change my workspace name or logo?',
  'Go to **Settings → Workspace** and update your workspace name, logo, and brand colors. Changes take effect immediately across all portals and documents generated by OccasionPro.',
  ARRAY['workspace','name','logo','brand','settings','change','update','company'],
  'Account', 10
),
(
  'How do I reset my password?',
  'On the login page, click "Forgot password?" and enter your email. You''ll receive a reset link valid for 1 hour. If you don''t see it, check your spam folder. You can also change your password from **Settings → Profile → Security**.',
  ARRAY['password','reset','forgot','change','login','security','email','account'],
  'Account', 20
),
(
  'Can I have multiple workspaces under one account?',
  'Yes. Click your workspace name in the top-left to open the workspace switcher and select "Create new workspace". Each workspace has its own subscription, team, and events. Switching between them is instant. This is ideal for agencies managing multiple brands.',
  ARRAY['workspace','multiple','switch','new','create','agency','brand','account'],
  'Account', 30
)

ON CONFLICT DO NOTHING;


-- ==========================================
-- Migration: 068_animated_invitations.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 068: Animated Digital Invitation Builder
-- Personalized guest invitation links with themed animated viewer
-- ============================================================

-- ── invitation_templates ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitation_templates (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid         REFERENCES tenants(id) ON DELETE CASCADE,   -- NULL = system template
  name           varchar(100) NOT NULL,
  theme_slug     varchar(50)  NOT NULL,
  thumbnail_url  text,
  config         jsonb        NOT NULL DEFAULT '{}',
  is_system      boolean      NOT NULL DEFAULT true,
  created_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_templates_tenant  ON invitation_templates(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_templates_system  ON invitation_templates(is_system) WHERE is_system = true;
CREATE INDEX IF NOT EXISTS idx_inv_templates_slug    ON invitation_templates(theme_slug);

-- ── event_invitations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_invitations (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_id    uuid         NOT NULL REFERENCES invitation_templates(id),
  custom_config  jsonb        NOT NULL DEFAULT '{}',   -- tenant overrides merged on top of template config
  is_published   boolean      NOT NULL DEFAULT false,
  published_at   timestamptz,
  created_by     uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(event_id)                                     -- one invitation per event
);

CREATE INDEX IF NOT EXISTS idx_event_inv_event    ON event_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_inv_template ON event_invitations(template_id);

-- ── guest_invitation_links ────────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_invitation_links (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             uuid         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id             uuid         NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  invitation_id        uuid         NOT NULL REFERENCES event_invitations(id) ON DELETE CASCADE,
  short_link_id        uuid         REFERENCES short_links(id) ON DELETE SET NULL,
  personalized_message text,
  is_opened            boolean      NOT NULL DEFAULT false,
  opened_at            timestamptz,
  open_count           integer      NOT NULL DEFAULT 0,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(event_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_gil_event        ON guest_invitation_links(event_id);
CREATE INDEX IF NOT EXISTS idx_gil_guest        ON guest_invitation_links(guest_id);
CREATE INDEX IF NOT EXISTS idx_gil_invitation   ON guest_invitation_links(invitation_id);
CREATE INDEX IF NOT EXISTS idx_gil_short_link   ON guest_invitation_links(short_link_id) WHERE short_link_id IS NOT NULL;

-- ── Trigger: auto-create short_link on guest_invitation_links insert ──
CREATE OR REPLACE FUNCTION fn_create_invitation_short_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code      varchar(10);
  v_link_id   uuid;
  v_tenant_id uuid;
BEGIN
  -- Get tenant_id from the event
  SELECT tenant_id INTO v_tenant_id FROM events WHERE id = NEW.event_id;

  -- Generate unique short code
  v_code := generate_short_code();

  -- Insert the short link record
  INSERT INTO short_links (
    code, tenant_id, event_id, link_type,
    destination_url, guest_id, metadata
  )
  VALUES (
    v_code,
    v_tenant_id,
    NEW.event_id,
    'invitation',
    '/i/' || v_code,
    NEW.guest_id,
    jsonb_build_object('invitation_id', NEW.invitation_id, 'guest_link_id', NEW.id)
  )
  RETURNING id INTO v_link_id;

  -- Back-fill the FK on the row we just inserted
  UPDATE guest_invitation_links
  SET short_link_id = v_link_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invitation_short_link ON guest_invitation_links;
CREATE TRIGGER trg_invitation_short_link
  AFTER INSERT ON guest_invitation_links
  FOR EACH ROW
  WHEN (NEW.short_link_id IS NULL)
  EXECUTE FUNCTION fn_create_invitation_short_link();

-- ── Timestamp trigger for event_invitations ───────────────────
CREATE OR REPLACE FUNCTION fn_event_inv_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_event_inv_updated_at ON event_invitations;
CREATE TRIGGER trg_event_inv_updated_at
  BEFORE UPDATE ON event_invitations
  FOR EACH ROW EXECUTE FUNCTION fn_event_inv_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE invitation_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_invitations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_invitation_links  ENABLE ROW LEVEL SECURITY;

-- System templates readable by all authenticated users
CREATE POLICY inv_templates_system_read ON invitation_templates
  FOR SELECT USING (is_system = true);

-- Tenant custom templates readable/writable by tenant members
CREATE POLICY inv_templates_tenant_all ON invitation_templates
  FOR ALL USING (
    tenant_id IS NOT NULL AND
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

-- Event invitations — tenant members of the event's workspace
CREATE POLICY event_inv_tenant_all ON event_invitations
  FOR ALL USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN tenant_members tm ON tm.tenant_id = e.tenant_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Guest invitation links — tenant members
CREATE POLICY gil_tenant_all ON guest_invitation_links
  FOR ALL USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN tenant_members tm ON tm.tenant_id = e.tenant_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Public read for invitation links (guests open via short link — no auth)
CREATE POLICY gil_public_read ON guest_invitation_links
  FOR SELECT USING (true);

CREATE POLICY event_inv_public_read ON event_invitations
  FOR SELECT USING (is_published = true);

CREATE POLICY inv_templates_public_read ON invitation_templates
  FOR SELECT USING (true);

-- Super admin full access
CREATE POLICY inv_templates_super_admin ON invitation_templates
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY event_inv_super_admin ON event_invitations
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY gil_super_admin ON guest_invitation_links
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Service role bypass (for backend operations)
CREATE POLICY inv_templates_service ON invitation_templates
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY event_inv_service ON event_invitations
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY gil_service ON guest_invitation_links
  FOR ALL USING (auth.role() = 'service_role');

-- ── Seed: 10 System Invitation Themes ────────────────────────
INSERT INTO invitation_templates (id, name, theme_slug, thumbnail_url, config, is_system) VALUES

-- 1. Royal Gold
(gen_random_uuid(), 'Royal Gold', 'royal-gold', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(135deg,#1a0a00 0%,#2d1400 50%,#1a0a00 100%)"},"primaryColor":"#c9a84c","accentColor":"#f5d88a","textColor":"#f5e6c8","fontHeading":"Cormorant Garamond","fontBody":"Libre Baskerville","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["geometric-border","crown-motif","gold-particles"],"musicEnabled":false}',
  true),

-- 2. Minimal White
(gen_random_uuid(), 'Minimal White', 'minimal-white', NULL,
  '{"background":{"type":"solid","value":"#fafafa"},"primaryColor":"#1a1a1a","accentColor":"#888888","textColor":"#1a1a1a","fontHeading":"Playfair Display","fontBody":"Lato","animationStyle":"minimal","animationSpeed":"medium","decorativeElements":["thin-line"],"musicEnabled":false}',
  true),

-- 3. Floral Pink
(gen_random_uuid(), 'Floral Pink', 'floral-pink', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(160deg,#fce4ec 0%,#f8bbd0 40%,#f48fb1 100%)"},"primaryColor":"#c2185b","accentColor":"#e91e63","textColor":"#880e4f","fontHeading":"Dancing Script","fontBody":"Lato","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["rose-petals","floral-border","butterflies"],"musicEnabled":false}',
  true),

-- 4. Dark Luxury
(gen_random_uuid(), 'Dark Luxury', 'dark-luxury', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(180deg,#0a0a0a 0%,#1a1a2e 50%,#0a0a0a 100%)"},"primaryColor":"#e8e8e8","accentColor":"#b8860b","textColor":"#f0f0f0","fontHeading":"Cinzel","fontBody":"Cormorant Garamond","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["diamond-pattern","silver-sparkles","luxury-border"],"musicEnabled":false}',
  true),

-- 5. Pastel Dream
(gen_random_uuid(), 'Pastel Dream', 'pastel-dream', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(135deg,#e0f7fa 0%,#fce4ec 50%,#f3e5f5 100%)"},"primaryColor":"#7b1fa2","accentColor":"#ff6f00","textColor":"#4a148c","fontHeading":"Pacifico","fontBody":"Nunito","animationStyle":"playful","animationSpeed":"medium","decorativeElements":["stars","balloons","confetti-static"],"musicEnabled":false}',
  true),

-- 6. Vibrant Festival
(gen_random_uuid(), 'Vibrant Festival', 'vibrant-festival', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(135deg,#ff6b35 0%,#f7c59f 30%,#efefd0 60%,#004e89 100%)"},"primaryColor":"#ff6b35","accentColor":"#f7c59f","textColor":"#ffffff","fontHeading":"Righteous","fontBody":"Nunito","animationStyle":"vibrant","animationSpeed":"fast","decorativeElements":["fireworks","lanterns","rangoli"],"musicEnabled":false}',
  true),

-- 7. Corporate Blue
(gen_random_uuid(), 'Corporate Blue', 'corporate-blue', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(160deg,#0d1b2a 0%,#1b2838 60%,#162032 100%)"},"primaryColor":"#4fc3f7","accentColor":"#ffffff","textColor":"#e3f2fd","fontHeading":"Montserrat","fontBody":"Open Sans","animationStyle":"minimal","animationSpeed":"medium","decorativeElements":["grid-pattern","circuit-lines"],"musicEnabled":false}',
  true),

-- 8. Rustic Wood
(gen_random_uuid(), 'Rustic Wood', 'rustic-wood', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(180deg,#3e1c00 0%,#6d3a1f 50%,#4e2400 100%)"},"primaryColor":"#d4a853","accentColor":"#f5deb3","textColor":"#faebd7","fontHeading":"Abril Fatface","fontBody":"Merriweather","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["wood-grain","leaves","twine-border"],"musicEnabled":false}',
  true),

-- 9. Starry Night
(gen_random_uuid(), 'Starry Night', 'starry-night', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(180deg,#0a0520 0%,#1a0845 50%,#0a0520 100%)"},"primaryColor":"#a78bfa","accentColor":"#c4b5fd","textColor":"#e9d5ff","fontHeading":"Cormorant Garamond","fontBody":"Lato","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["animated-stars","moon","constellation-lines"],"musicEnabled":false}',
  true),

-- 10. Neon Party
(gen_random_uuid(), 'Neon Party', 'neon-party', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(135deg,#0d0d0d 0%,#1a0030 50%,#0d0d0d 100%)"},"primaryColor":"#ff00c8","accentColor":"#00e5ff","textColor":"#ffffff","fontHeading":"Orbitron","fontBody":"Exo 2","animationStyle":"vibrant","animationSpeed":"fast","decorativeElements":["neon-glow","electric-lines","disco-balls"],"musicEnabled":false}',
  true);

COMMENT ON TABLE invitation_templates IS 'System and tenant-custom animated invitation themes';
COMMENT ON TABLE event_invitations IS 'One invitation configuration per event, with template + custom overrides';
COMMENT ON TABLE guest_invitation_links IS 'Per-guest personalized invitation links with open tracking';
COMMENT ON FUNCTION fn_create_invitation_short_link IS 'Auto-creates a short_link entry when a guest invitation link is inserted';


-- ==========================================
-- Migration: 069_floor_plans.sql
-- ==========================================
-- ─────────────────────────────────────────────────────────────────────────────
-- 069_floor_plans.sql  –  Floor Plan Editor tables & helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE zone_type_enum AS ENUM (
    'dining','reception','stage','dance_floor','bar','kitchen','entrance','parking','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE table_type_enum AS ENUM (
    'round','rectangular','cocktail','serpentine','custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── floor_plans ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.floor_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name            varchar(100) NOT NULL DEFAULT 'Main Floor Plan',
  canvas_data     jsonb,
  canvas_width    int NOT NULL DEFAULT 3000,
  canvas_height   int NOT NULL DEFAULT 2000,
  grid_size       int NOT NULL DEFAULT 50,
  scale_label     varchar(20) NOT NULL DEFAULT '1 cell = 1m',
  is_published    bool NOT NULL DEFAULT false,
  thumbnail_url   text,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

-- ── floor_plan_zones ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.floor_plan_zones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id   uuid NOT NULL REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  name            varchar(100) NOT NULL,
  color           varchar(7) NOT NULL DEFAULT '#4f46e5',
  shape_id        varchar(100),
  capacity        int,
  zone_type       zone_type_enum NOT NULL DEFAULT 'other',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── floor_plan_tables ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.floor_plan_tables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id   uuid NOT NULL REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  zone_id         uuid REFERENCES public.floor_plan_zones(id) ON DELETE SET NULL,
  name            varchar(50) NOT NULL DEFAULT 'Table',
  shape_id        varchar(100),
  table_type      table_type_enum NOT NULL DEFAULT 'round',
  capacity        int NOT NULL DEFAULT 8,
  x_pos           decimal(10,2) NOT NULL DEFAULT 0,
  y_pos           decimal(10,2) NOT NULL DEFAULT 0,
  rotation        decimal(6,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── table_guest_assignments ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.table_guest_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id        uuid NOT NULL REFERENCES public.floor_plan_tables(id) ON DELETE CASCADE,
  guest_id        uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  seat_number     int,
  assigned_by     uuid REFERENCES public.profiles(id),
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_id, guest_id),
  UNIQUE NULLS NOT DISTINCT (table_id, seat_number)  -- allow multiple NULLs but unique non-null pairs
);

-- ── Add table_id / seat_number to guests ────────────────────────────────────

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS table_id    uuid REFERENCES public.floor_plan_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seat_number int;

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_floor_plans_event ON public.floor_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_zones_plan ON public.floor_plan_zones(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_tables_plan ON public.floor_plan_tables(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_tables_zone ON public.floor_plan_tables(zone_id);
CREATE INDEX IF NOT EXISTS idx_tga_table ON public.table_guest_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_tga_guest ON public.table_guest_assignments(guest_id);
CREATE INDEX IF NOT EXISTS idx_guests_table ON public.guests(table_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_floor_plan_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_floor_plan_updated_at ON public.floor_plans;
CREATE TRIGGER trg_floor_plan_updated_at
  BEFORE UPDATE ON public.floor_plans
  FOR EACH ROW EXECUTE FUNCTION fn_floor_plan_updated_at();

-- ── Helper function: get_floor_plan_with_assignments ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_floor_plan_with_assignments(p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan        public.floor_plans;
  v_tables      jsonb;
  v_zones       jsonb;
BEGIN
  SELECT * INTO v_plan
    FROM public.floor_plans
   WHERE event_id = p_event_id
   LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- zones
  SELECT coalesce(jsonb_agg(row_to_json(z.*)), '[]'::jsonb)
    INTO v_zones
    FROM public.floor_plan_zones z
   WHERE z.floor_plan_id = v_plan.id;

  -- tables + guests
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',          t.id,
        'name',        t.name,
        'shape_id',    t.shape_id,
        'table_type',  t.table_type,
        'capacity',    t.capacity,
        'x_pos',       t.x_pos,
        'y_pos',       t.y_pos,
        'rotation',    t.rotation,
        'zone_id',     t.zone_id,
        'guests', (
          SELECT coalesce(jsonb_agg(
            jsonb_build_object(
              'assignment_id', a.id,
              'guest_id',      g.id,
              'full_name',     g.full_name,
              'category',      g.category,
              'meal_preference', g.meal_preference,
              'seat_number',   a.seat_number
            )
          ), '[]'::jsonb)
          FROM public.table_guest_assignments a
          JOIN public.guests g ON g.id = a.guest_id
          WHERE a.table_id = t.id
        )
      )
    ), '[]'::jsonb)
    INTO v_tables
    FROM public.floor_plan_tables t
   WHERE t.floor_plan_id = v_plan.id;

  RETURN jsonb_build_object(
    'id',            v_plan.id,
    'event_id',      v_plan.event_id,
    'name',          v_plan.name,
    'canvas_data',   v_plan.canvas_data,
    'canvas_width',  v_plan.canvas_width,
    'canvas_height', v_plan.canvas_height,
    'grid_size',     v_plan.grid_size,
    'scale_label',   v_plan.scale_label,
    'is_published',  v_plan.is_published,
    'thumbnail_url', v_plan.thumbnail_url,
    'created_at',    v_plan.created_at,
    'updated_at',    v_plan.updated_at,
    'zones',         v_zones,
    'tables',        v_tables
  );
END; $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_plan_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_plan_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_guest_assignments ENABLE ROW LEVEL SECURITY;

-- floor_plans
CREATE POLICY fp_team_all ON public.floor_plans FOR ALL
  USING (event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.team_members tm ON tm.tenant_id = e.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  ));

CREATE POLICY fp_guest_read_published ON public.floor_plans FOR SELECT
  USING (is_published = true);

CREATE POLICY fp_service_all ON public.floor_plans FOR ALL
  USING (auth.role() = 'service_role');

-- floor_plan_zones (inherit via floor_plan ownership)
CREATE POLICY fpz_team_all ON public.floor_plan_zones FOR ALL
  USING (floor_plan_id IN (
    SELECT fp.id FROM public.floor_plans fp
    JOIN public.events e ON e.id = fp.event_id
    JOIN public.team_members tm ON tm.tenant_id = e.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  ));
CREATE POLICY fpz_service_all ON public.floor_plan_zones FOR ALL
  USING (auth.role() = 'service_role');

-- floor_plan_tables
CREATE POLICY fpt_team_all ON public.floor_plan_tables FOR ALL
  USING (floor_plan_id IN (
    SELECT fp.id FROM public.floor_plans fp
    JOIN public.events e ON e.id = fp.event_id
    JOIN public.team_members tm ON tm.tenant_id = e.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  ));
CREATE POLICY fpt_service_all ON public.floor_plan_tables FOR ALL
  USING (auth.role() = 'service_role');

-- table_guest_assignments
CREATE POLICY tga_team_all ON public.table_guest_assignments FOR ALL
  USING (table_id IN (
    SELECT t.id FROM public.floor_plan_tables t
    JOIN public.floor_plans fp ON fp.id = t.floor_plan_id
    JOIN public.events e ON e.id = fp.event_id
    JOIN public.team_members tm ON tm.tenant_id = e.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  ));
CREATE POLICY tga_service_all ON public.table_guest_assignments FOR ALL
  USING (auth.role() = 'service_role');



-- ==========================================
-- Migration: 070_runsheets.sql
-- ==========================================
-- Migration 070: Runsheets (Event Day Timeline)
-- Real-time collaborative operational runsheet for event day management

-- Item status enum
DO $$ BEGIN
  CREATE TYPE runsheet_item_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'skipped',
  'delayed'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Item category enum
DO $$ BEGIN
  CREATE TYPE runsheet_item_category AS ENUM (
  'Setup',
  'Ceremony',
  'Reception',
  'Performance',
  'Speech',
  'Catering',
  'Technical',
  'Transport',
  'VIP',
  'Media',
  'Rehearsal',
  'Breakdown',
  'Other'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- runsheets (one per event)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title          varchar(100) NOT NULL DEFAULT 'Event Runsheet',
  is_locked      boolean NOT NULL DEFAULT false,
  locked_by      uuid REFERENCES auth.users(id),
  locked_at      timestamptz,
  version        integer NOT NULL DEFAULT 1,
  created_by     uuid NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

-- ─────────────────────────────────────────────
-- runsheet_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheet_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runsheet_id       uuid NOT NULL REFERENCES runsheets(id) ON DELETE CASCADE,
  parent_id         uuid REFERENCES runsheet_items(id) ON DELETE CASCADE,
  position          decimal(12,4) NOT NULL DEFAULT 1000,          -- fractional indexing
  start_time        timestamptz,
  end_time          timestamptz,
  duration_minutes  integer,
  title             varchar(255) NOT NULL,
  description       text,
  category          runsheet_item_category NOT NULL DEFAULT 'Other',
  assigned_to       uuid[] NOT NULL DEFAULT '{}',                  -- team member user IDs
  assigned_vendors  uuid[] NOT NULL DEFAULT '{}',                  -- vendor_account IDs
  status            runsheet_item_status NOT NULL DEFAULT 'pending',
  delay_minutes     integer NOT NULL DEFAULT 0,
  is_guest_visible  boolean NOT NULL DEFAULT false,
  notes             text,
  color             varchar(7),                                    -- hex color e.g. #3b82f6
  is_deleted        boolean NOT NULL DEFAULT false,
  created_by        uuid REFERENCES auth.users(id),
  updated_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- runsheet_item_comments
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheet_item_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES runsheet_items(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  comment     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- runsheet_versions (snapshots)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheet_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runsheet_id  uuid NOT NULL REFERENCES runsheets(id) ON DELETE CASCADE,
  version      integer NOT NULL,
  label        varchar(100),                                       -- optional human label
  snapshot     jsonb NOT NULL,                                     -- full items array
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_runsheets_event     ON runsheets(event_id);
CREATE INDEX IF NOT EXISTS idx_runsheets_tenant    ON runsheets(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runsheet_items_sheet    ON runsheet_items(runsheet_id);
CREATE INDEX IF NOT EXISTS idx_runsheet_items_parent   ON runsheet_items(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_runsheet_items_pos      ON runsheet_items(runsheet_id, position) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_runsheet_items_status   ON runsheet_items(runsheet_id, status) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_runsheet_comments_item  ON runsheet_item_comments(item_id);
CREATE INDEX IF NOT EXISTS idx_runsheet_versions_sheet ON runsheet_versions(runsheet_id, version);

-- ─────────────────────────────────────────────
-- Updated_at triggers
-- ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_runsheets_updated_at ON runsheets;
CREATE TRIGGER set_runsheets_updated_at
  BEFORE UPDATE ON runsheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_runsheet_items_updated_at ON runsheet_items;
CREATE TRIGGER set_runsheet_items_updated_at
  BEFORE UPDATE ON runsheet_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────
-- RLS policies
-- ─────────────────────────────────────────────
ALTER TABLE runsheets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE runsheet_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE runsheet_item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE runsheet_versions     ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_all_runsheets"              ON runsheets             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_runsheet_items"         ON runsheet_items        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_runsheet_comments"      ON runsheet_item_comments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_runsheet_versions"      ON runsheet_versions     FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- Function: auto-save version every 30 min
-- Called from application layer (cron) — placeholder trigger
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_runsheet_version(
  p_runsheet_id uuid,
  p_user_id     uuid,
  p_label       varchar DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_version  integer;
  v_snapshot jsonb;
  v_id       uuid;
BEGIN
  -- Get current version number
  SELECT version INTO v_version FROM runsheets WHERE id = p_runsheet_id;

  -- Build snapshot of all active items
  SELECT jsonb_agg(row_to_json(ri.*) ORDER BY ri.position)
  INTO v_snapshot
  FROM runsheet_items ri
  WHERE ri.runsheet_id = p_runsheet_id
    AND ri.is_deleted = false;

  -- Insert version snapshot
  INSERT INTO runsheet_versions (runsheet_id, version, label, snapshot, created_by)
  VALUES (p_runsheet_id, v_version, p_label, COALESCE(v_snapshot, '[]'::jsonb), p_user_id)
  RETURNING id INTO v_id;

  -- Bump runsheet version
  UPDATE runsheets SET version = version + 1, updated_at = now()
  WHERE id = p_runsheet_id;

  RETURN v_id;
END;
$$;

-- ─────────────────────────────────────────────
-- Realtime: enable for collaborative editing
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE runsheet_items;
ALTER PUBLICATION supabase_realtime ADD TABLE runsheet_item_comments;


-- ==========================================
-- Migration: 071_conference.sql
-- ==========================================
-- ============================================================
-- Migration 071 — Conference Module
-- Full conference management: ticketing, speakers, sessions,
-- sponsors, exhibitors, live Q&A, polls, CEU, networking
-- ============================================================

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE conference_ticket_type AS ENUM (
  'general', 'vip', 'speaker', 'sponsor', 'exhibitor',
  'student', 'group', 'virtual', 'press', 'staff'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE conference_registration_status AS ENUM (
  'pending', 'confirmed', 'cancelled', 'waitlisted', 'checked_in', 'no_show'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE conference_session_type AS ENUM (
  'keynote', 'panel', 'workshop', 'breakout', 'lightning',
  'networking', 'fireside', 'demo', 'poster', 'exhibition'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE conference_session_status AS ENUM (
  'scheduled', 'live', 'completed', 'cancelled'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE speaker_status AS ENUM (
  'invited', 'confirmed', 'declined', 'cancelled'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sponsor_tier AS ENUM (
  'title', 'platinum', 'gold', 'silver', 'bronze', 'partner', 'media', 'community'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE exhibitor_status AS ENUM (
  'pending', 'confirmed', 'setup', 'active', 'concluded'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE question_status AS ENUM (
  'pending', 'approved', 'answered', 'dismissed'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE poll_status AS ENUM (
  'draft', 'active', 'closed', 'archived'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE networking_status AS ENUM (
  'pending', 'accepted', 'declined', 'blocked'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 1. conference_settings ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  tenant_id               uuid NOT NULL,
  is_enabled              boolean NOT NULL DEFAULT false,
  ticketing_enabled       boolean NOT NULL DEFAULT true,
  ceu_tracking_enabled    boolean NOT NULL DEFAULT false,
  networking_enabled      boolean NOT NULL DEFAULT true,
  live_qa_enabled         boolean NOT NULL DEFAULT true,
  polling_enabled         boolean NOT NULL DEFAULT true,
  max_attendees           integer,
  registration_opens_at   timestamptz,
  registration_closes_at  timestamptz,
  early_bird_until        timestamptz,
  welcome_message         text,
  code_of_conduct_url     varchar(500),
  hashtag                 varchar(100),
  wifi_name               varchar(200),
  wifi_password           varchar(200),
  app_store_url           varchar(500),
  play_store_url          varchar(500),
  streaming_url           varchar(500),
  custom_domain           varchar(255),
  branding_colors         jsonb DEFAULT '{}'::jsonb,
  meta                    jsonb DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conference_settings_event ON conference_settings(event_id);
CREATE INDEX IF NOT EXISTS idx_conference_settings_tenant ON conference_settings(tenant_id);

-- ─── 2. conference_tickets ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_tickets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL,
  name                varchar(100) NOT NULL,
  description         text,
  ticket_type         conference_ticket_type NOT NULL DEFAULT 'general',
  price               decimal(12, 2) NOT NULL DEFAULT 0,
  early_bird_price    decimal(12, 2),
  currency_code       char(3) NOT NULL DEFAULT 'INR',
  quantity_total      integer,
  quantity_sold       integer NOT NULL DEFAULT 0,
  quantity_reserved   integer NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  is_visible          boolean NOT NULL DEFAULT true,
  sale_starts_at      timestamptz,
  sale_ends_at        timestamptz,
  max_per_order       integer DEFAULT 10,
  min_per_order       integer DEFAULT 1,
  includes_meal       boolean NOT NULL DEFAULT false,
  includes_kit        boolean NOT NULL DEFAULT false,
  includes_recording  boolean NOT NULL DEFAULT false,
  access_sessions     uuid[] DEFAULT '{}',    -- null = all sessions
  color               varchar(7) DEFAULT '#6366f1',
  sort_order          integer NOT NULL DEFAULT 0,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conf_tickets_event ON conference_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_conf_tickets_tenant ON conference_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conf_tickets_active ON conference_tickets(event_id, is_active);

-- ─── 3. conference_registrations ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_registrations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL,
  ticket_id           uuid NOT NULL REFERENCES conference_tickets(id) ON DELETE RESTRICT,
  guest_id            uuid REFERENCES guests(id) ON DELETE SET NULL,
  registration_number varchar(50) NOT NULL,
  status              conference_registration_status NOT NULL DEFAULT 'pending',
  first_name          varchar(100) NOT NULL,
  last_name           varchar(100) NOT NULL,
  email               varchar(255) NOT NULL,
  phone               varchar(30),
  company             varchar(200),
  job_title           varchar(200),
  dietary_requirements varchar(200),
  t_shirt_size        varchar(10),
  badge_name          varchar(100),
  badge_company       varchar(100),
  qr_code             varchar(500),
  checked_in_at       timestamptz,
  checked_in_by       uuid,
  amount_paid         decimal(12, 2) NOT NULL DEFAULT 0,
  payment_reference   varchar(200),
  is_complimentary    boolean NOT NULL DEFAULT false,
  notes               text,
  custom_fields       jsonb DEFAULT '{}'::jsonb,
  sessions_attended   uuid[] DEFAULT '{}',
  ceu_credits_earned  decimal(6, 2) NOT NULL DEFAULT 0,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, registration_number),
  UNIQUE (event_id, email, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_conf_reg_event ON conference_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_conf_reg_tenant ON conference_registrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conf_reg_email ON conference_registrations(event_id, email);
CREATE INDEX IF NOT EXISTS idx_conf_reg_status ON conference_registrations(event_id, status);
CREATE INDEX IF NOT EXISTS idx_conf_reg_guest ON conference_registrations(guest_id) WHERE guest_id IS NOT NULL;

-- ─── 4. conference_speakers ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_speakers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL,
  first_name      varchar(100) NOT NULL,
  last_name       varchar(100) NOT NULL,
  email           varchar(255),
  phone           varchar(30),
  company         varchar(200),
  job_title       varchar(200),
  bio             text,
  photo_url       varchar(500),
  status          speaker_status NOT NULL DEFAULT 'invited',
  is_keynote      boolean NOT NULL DEFAULT false,
  is_featured     boolean NOT NULL DEFAULT false,
  speaker_order   integer NOT NULL DEFAULT 0,
  linkedin_url    varchar(500),
  twitter_handle  varchar(100),
  website_url     varchar(500),
  topics          text[],
  languages       varchar(10)[] DEFAULT '{"en"}',
  travel_required boolean NOT NULL DEFAULT false,
  hotel_required  boolean NOT NULL DEFAULT false,
  honorarium      decimal(12, 2),
  honorarium_currency char(3),
  dietary_requirements varchar(200),
  notes           text,
  contract_url    varchar(500),
  meta            jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conf_speakers_event ON conference_speakers(event_id);
CREATE INDEX IF NOT EXISTS idx_conf_speakers_tenant ON conference_speakers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conf_speakers_status ON conference_speakers(event_id, status);
CREATE INDEX IF NOT EXISTS idx_conf_speakers_featured ON conference_speakers(event_id, is_featured);

-- ─── 5. conference_sessions ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL,
  title               varchar(300) NOT NULL,
  description         text,
  session_type        conference_session_type NOT NULL DEFAULT 'breakout',
  status              conference_session_status NOT NULL DEFAULT 'scheduled',
  track               varchar(100),
  room                varchar(200),
  room_capacity       integer,
  floor               varchar(50),
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz NOT NULL,
  duration_minutes    integer GENERATED ALWAYS AS (
                        EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60
                      )::integer STORED,
  day_number          integer,
  is_virtual          boolean NOT NULL DEFAULT false,
  stream_url          varchar(500),
  recording_url       varchar(500),
  slides_url          varchar(500),
  is_ticketed         boolean NOT NULL DEFAULT false,
  allowed_ticket_types conference_ticket_type[],
  max_attendees       integer,
  registered_count    integer NOT NULL DEFAULT 0,
  ceu_credits         decimal(4, 2) NOT NULL DEFAULT 0,
  ceu_type            varchar(100),
  language            varchar(10) DEFAULT 'en',
  difficulty_level    varchar(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'all')),
  tags                text[],
  is_featured         boolean NOT NULL DEFAULT false,
  requires_signup     boolean NOT NULL DEFAULT false,
  sort_order          integer NOT NULL DEFAULT 0,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conf_sessions_event ON conference_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_conf_sessions_tenant ON conference_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conf_sessions_starts ON conference_sessions(event_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_conf_sessions_track ON conference_sessions(event_id, track);
CREATE INDEX IF NOT EXISTS idx_conf_sessions_status ON conference_sessions(event_id, status);

-- ─── 5b. session_speakers junction ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_session_speakers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES conference_sessions(id) ON DELETE CASCADE,
  speaker_id    uuid NOT NULL REFERENCES conference_speakers(id) ON DELETE CASCADE,
  role          varchar(50) DEFAULT 'speaker',  -- speaker|moderator|panelist|host
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, speaker_id)
);

CREATE INDEX IF NOT EXISTS idx_sess_spkr_session ON conference_session_speakers(session_id);
CREATE INDEX IF NOT EXISTS idx_sess_spkr_speaker ON conference_session_speakers(speaker_id);

-- ─── 6. session_attendees ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_session_attendees (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES conference_sessions(id) ON DELETE CASCADE,
  registration_id     uuid NOT NULL REFERENCES conference_registrations(id) ON DELETE CASCADE,
  event_id            uuid NOT NULL,
  checked_in_at       timestamptz,
  checked_in_by       uuid,
  ceu_issued          boolean NOT NULL DEFAULT false,
  ceu_issued_at       timestamptz,
  feedback_rating     smallint CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_comment    text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_sess_att_session ON conference_session_attendees(session_id);
CREATE INDEX IF NOT EXISTS idx_sess_att_reg ON conference_session_attendees(registration_id);
CREATE INDEX IF NOT EXISTS idx_sess_att_event ON conference_session_attendees(event_id);

-- ─── 7. conference_sponsors ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_sponsors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL,
  company_name        varchar(200) NOT NULL,
  tier                sponsor_tier NOT NULL DEFAULT 'bronze',
  logo_url            varchar(500),
  website_url         varchar(500),
  tagline             varchar(300),
  description         text,
  contact_name        varchar(200),
  contact_email       varchar(255),
  contact_phone       varchar(30),
  booth_number        varchar(20),
  sponsorship_amount  decimal(14, 2),
  currency_code       char(3) DEFAULT 'INR',
  contract_url        varchar(500),
  invoice_url         varchar(500),
  payment_status      varchar(30) DEFAULT 'pending',
  benefits            jsonb DEFAULT '[]'::jsonb,
  social_links        jsonb DEFAULT '{}'::jsonb,
  is_featured         boolean NOT NULL DEFAULT false,
  sort_order          integer NOT NULL DEFAULT 0,
  notes               text,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conf_sponsors_event ON conference_sponsors(event_id);
CREATE INDEX IF NOT EXISTS idx_conf_sponsors_tenant ON conference_sponsors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conf_sponsors_tier ON conference_sponsors(event_id, tier);

-- ─── 8. conference_exhibitors ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_exhibitors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL,
  company_name        varchar(200) NOT NULL,
  status              exhibitor_status NOT NULL DEFAULT 'pending',
  booth_number        varchar(20),
  booth_size          varchar(50),
  hall                varchar(100),
  logo_url            varchar(500),
  website_url         varchar(500),
  description         text,
  category            varchar(100),
  contact_name        varchar(200),
  contact_email       varchar(255),
  contact_phone       varchar(30),
  setup_time          timestamptz,
  teardown_time       timestamptz,
  power_required      boolean NOT NULL DEFAULT false,
  internet_required   boolean NOT NULL DEFAULT false,
  floor_plan_position jsonb,    -- {x, y, width, height}
  exhibitor_fee       decimal(12, 2),
  currency_code       char(3) DEFAULT 'INR',
  payment_status      varchar(30) DEFAULT 'pending',
  staff_count         integer DEFAULT 2,
  notes               text,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conf_exhibitors_event ON conference_exhibitors(event_id);
CREATE INDEX IF NOT EXISTS idx_conf_exhibitors_tenant ON conference_exhibitors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conf_exhibitors_status ON conference_exhibitors(event_id, status);

-- ─── 9. conference_live_questions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_live_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES conference_sessions(id) ON DELETE CASCADE,
  event_id        uuid NOT NULL,
  tenant_id       uuid NOT NULL,
  registration_id uuid REFERENCES conference_registrations(id) ON DELETE SET NULL,
  asked_by_name   varchar(200),
  question_text   text NOT NULL,
  status          question_status NOT NULL DEFAULT 'pending',
  upvotes         integer NOT NULL DEFAULT 0,
  is_anonymous    boolean NOT NULL DEFAULT false,
  answered_by     uuid,
  answer_text     text,
  answered_at     timestamptz,
  sort_order      integer NOT NULL DEFAULT 0,
  meta            jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_q_session ON conference_live_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_live_q_event ON conference_live_questions(event_id);
CREATE INDEX IF NOT EXISTS idx_live_q_status ON conference_live_questions(session_id, status);

-- ─── 9b. question_upvotes ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_question_upvotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     uuid NOT NULL REFERENCES conference_live_questions(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES conference_registrations(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_q_upvotes_question ON conference_question_upvotes(question_id);

-- ─── 10. conference_live_polls ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_live_polls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid REFERENCES conference_sessions(id) ON DELETE CASCADE,
  event_id      uuid NOT NULL,
  tenant_id     uuid NOT NULL,
  question      text NOT NULL,
  status        poll_status NOT NULL DEFAULT 'draft',
  is_anonymous  boolean NOT NULL DEFAULT true,
  allow_multiple boolean NOT NULL DEFAULT false,
  show_results  boolean NOT NULL DEFAULT true,
  options       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- options format: [{ id, text, votes_count }]
  total_votes   integer NOT NULL DEFAULT 0,
  started_at    timestamptz,
  closed_at     timestamptz,
  created_by    uuid,
  meta          jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polls_session ON conference_live_polls(session_id);
CREATE INDEX IF NOT EXISTS idx_polls_event ON conference_live_polls(event_id);
CREATE INDEX IF NOT EXISTS idx_polls_status ON conference_live_polls(event_id, status);

-- ─── 10b. poll_responses ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_poll_responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id         uuid NOT NULL REFERENCES conference_live_polls(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES conference_registrations(id) ON DELETE CASCADE,
  selected_options jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array of option IDs
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_resp_poll ON conference_poll_responses(poll_id);

-- ─── 11. conference_ceu_credits ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_ceu_credits (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registration_id     uuid NOT NULL REFERENCES conference_registrations(id) ON DELETE CASCADE,
  session_id          uuid REFERENCES conference_sessions(id) ON DELETE SET NULL,
  tenant_id           uuid NOT NULL,
  credit_type         varchar(100) NOT NULL,
  credits             decimal(6, 2) NOT NULL,
  accreditation_body  varchar(200),
  certificate_number  varchar(100),
  certificate_url     varchar(500),
  issued_at           timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz,
  issued_by           uuid,
  notes               text,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ceu_event ON conference_ceu_credits(event_id);
CREATE INDEX IF NOT EXISTS idx_ceu_registration ON conference_ceu_credits(registration_id);
CREATE INDEX IF NOT EXISTS idx_ceu_session ON conference_ceu_credits(session_id) WHERE session_id IS NOT NULL;

-- ─── 12. conference_networking_connections ────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_networking_connections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  requester_id        uuid NOT NULL REFERENCES conference_registrations(id) ON DELETE CASCADE,
  recipient_id        uuid NOT NULL REFERENCES conference_registrations(id) ON DELETE CASCADE,
  status              networking_status NOT NULL DEFAULT 'pending',
  message             text,
  meeting_scheduled   boolean NOT NULL DEFAULT false,
  meeting_time        timestamptz,
  meeting_location    varchar(300),
  notes               text,
  connected_at        timestamptz,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, requester_id, recipient_id),
  CHECK (requester_id != recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_networking_event ON conference_networking_connections(event_id);
CREATE INDEX IF NOT EXISTS idx_networking_requester ON conference_networking_connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_networking_recipient ON conference_networking_connections(recipient_id);
CREATE INDEX IF NOT EXISTS idx_networking_status ON conference_networking_connections(event_id, status);

-- ─── Updated-at triggers ─────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'conference_settings', 'conference_tickets', 'conference_registrations',
    'conference_speakers', 'conference_sessions', 'conference_sponsors',
    'conference_exhibitors', 'conference_live_questions', 'conference_live_polls',
    'conference_networking_connections'
  ] LOOP
    EXECUTE format('
      CREATE OR REPLACE TRIGGER set_updated_at_%s
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    ', t, t);
  END LOOP;
END;
$$;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'conference_settings', 'conference_tickets', 'conference_registrations',
    'conference_speakers', 'conference_sessions', 'conference_session_speakers',
    'conference_session_attendees', 'conference_sponsors', 'conference_exhibitors',
    'conference_live_questions', 'conference_question_upvotes',
    'conference_live_polls', 'conference_poll_responses',
    'conference_ceu_credits', 'conference_networking_connections'
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY "service_role_bypass_%s" ON %s TO service_role USING (true) WITH CHECK (true);',
      t, t
    );
  END LOOP;
END;
$$;

-- ─── Realtime ─────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE conference_live_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE conference_live_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE conference_registrations;

-- ─── Helper: auto-increment ticket sold count ─────────────────────────────────

CREATE OR REPLACE FUNCTION increment_ticket_sold_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    UPDATE conference_tickets SET quantity_sold = quantity_sold + 1 WHERE id = NEW.ticket_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
      UPDATE conference_tickets SET quantity_sold = quantity_sold + 1 WHERE id = NEW.ticket_id;
    ELSIF OLD.status = 'confirmed' AND NEW.status IN ('cancelled', 'no_show') THEN
      UPDATE conference_tickets SET quantity_sold = GREATEST(quantity_sold - 1, 0) WHERE id = NEW.ticket_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_sold_count ON conference_registrations;
CREATE TRIGGER trg_ticket_sold_count
AFTER INSERT OR UPDATE ON conference_registrations
FOR EACH ROW EXECUTE FUNCTION increment_ticket_sold_count();

-- ─── Helper: auto-increment session registered_count ─────────────────────────

CREATE OR REPLACE FUNCTION increment_session_registered_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conference_sessions SET registered_count = registered_count + 1 WHERE id = NEW.session_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE conference_sessions SET registered_count = GREATEST(registered_count - 1, 0) WHERE id = OLD.session_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_session_reg_count ON conference_session_attendees;
CREATE TRIGGER trg_session_reg_count
AFTER INSERT OR DELETE ON conference_session_attendees
FOR EACH ROW EXECUTE FUNCTION increment_session_registered_count();

-- ─── Helper: auto-increment poll votes ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_poll_votes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conference_live_polls SET total_votes = total_votes + 1 WHERE id = NEW.poll_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE conference_live_polls SET total_votes = GREATEST(total_votes - 1, 0) WHERE id = OLD.poll_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_poll_votes ON conference_poll_responses;
CREATE TRIGGER trg_poll_votes
AFTER INSERT OR DELETE ON conference_poll_responses
FOR EACH ROW EXECUTE FUNCTION update_poll_votes();

-- ─── Helper: auto-increment question upvotes ─────────────────────────────────

CREATE OR REPLACE FUNCTION update_question_upvotes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conference_live_questions SET upvotes = upvotes + 1 WHERE id = NEW.question_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE conference_live_questions SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = OLD.question_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_question_upvotes ON conference_question_upvotes;
CREATE TRIGGER trg_question_upvotes
AFTER INSERT OR DELETE ON conference_question_upvotes
FOR EACH ROW EXECUTE FUNCTION update_question_upvotes();

-- ─── Sequence / registration number helper ────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS conf_reg_seq START 1000 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_registration_number(p_event_id uuid)
RETURNS varchar LANGUAGE plpgsql AS $$
DECLARE
  v_prefix varchar;
  v_seq    bigint;
BEGIN
  SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))
    INTO v_prefix
    FROM events WHERE id = p_event_id;

  v_prefix := COALESCE(v_prefix, 'REG');
  v_seq := nextval('conf_reg_seq');
  RETURN v_prefix || '-' || LPAD(v_seq::text, 6, '0');
END;
$$;

-- Comments
COMMENT ON TABLE conference_settings IS 'Per-event conference feature toggles and metadata';
COMMENT ON TABLE conference_tickets IS 'Ticket types available for an event';
COMMENT ON TABLE conference_registrations IS 'Individual attendee registrations with badge and check-in info';
COMMENT ON TABLE conference_speakers IS 'Speaker profiles including honorarium and logistics';
COMMENT ON TABLE conference_sessions IS 'Agenda sessions with room, time, CEU, and capacity';
COMMENT ON TABLE conference_session_speakers IS 'Many-to-many: speakers per session with role';
COMMENT ON TABLE conference_session_attendees IS 'Per-session check-in and CEU issuance';
COMMENT ON TABLE conference_sponsors IS 'Sponsors by tier with contract and payment tracking';
COMMENT ON TABLE conference_exhibitors IS 'Exhibitor booths with floor-plan position and logistics';
COMMENT ON TABLE conference_live_questions IS 'Audience Q&A with moderation queue';
COMMENT ON TABLE conference_live_polls IS 'Live polls with embedded options JSONB';
COMMENT ON TABLE conference_ceu_credits IS 'Continuing education units issued per registration/session';
COMMENT ON TABLE conference_networking_connections IS 'Attendee-to-attendee connection requests and meetings';


-- ==========================================
-- Migration: 072_post_event.sql
-- ==========================================
-- ============================================================
-- Migration 072 — Post-Event Module
-- ============================================================

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE post_event_checklist_category AS ENUM (
  'venue', 'finance', 'vendors', 'guests', 'team', 'documents'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE survey_respondent_type AS ENUM ('guest', 'vendor', 'team', 'client');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TYPE survey_type           AS ENUM ('guest', 'vendor', 'team', 'client');
CREATE TYPE testimonial_source    AS ENUM ('survey', 'manual', 'whatsapp');
DO $$ BEGIN
  CREATE TYPE settlement_payment_status AS ENUM ('pending', 'paid', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TYPE post_event_report_type    AS ENUM ('internal', 'client');

-- ─── post_event_settings ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS post_event_settings (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  is_enabled                  boolean NOT NULL DEFAULT true,
  auto_enabled_hours_after_event int NOT NULL DEFAULT 2,
  checklist_seeded            boolean NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_event_settings_event_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_post_event_settings_event ON post_event_settings(event_id);

-- ─── post_event_checklist ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS post_event_checklist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_key      varchar(100) NOT NULL,
  label         varchar(255) NOT NULL,
  category      post_event_checklist_category NOT NULL DEFAULT 'documents',
  is_completed  boolean NOT NULL DEFAULT false,
  completed_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at  timestamptz,
  notes         text,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_checklist_event     ON post_event_checklist(event_id);
CREATE INDEX IF NOT EXISTS idx_post_checklist_completed ON post_event_checklist(event_id, is_completed);

-- ─── event_surveys ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_surveys (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  survey_type    survey_type NOT NULL DEFAULT 'guest',
  title          varchar(255) NOT NULL,
  questions      jsonb NOT NULL DEFAULT '[]',
  is_active      boolean NOT NULL DEFAULT true,
  response_count int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_surveys_event ON event_surveys(event_id);

-- ─── survey_responses ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS survey_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id        uuid NOT NULL REFERENCES event_surveys(id) ON DELETE CASCADE,
  respondent_type  survey_respondent_type NOT NULL DEFAULT 'guest',
  respondent_id    uuid,
  answers          jsonb NOT NULL DEFAULT '{}',
  submitted_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey       ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_respondent   ON survey_responses(respondent_id);

-- Increment response_count on new survey response
CREATE OR REPLACE FUNCTION increment_survey_response_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE event_surveys SET response_count = response_count + 1 WHERE id = NEW.survey_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_survey_response_count ON survey_responses;
CREATE TRIGGER trg_survey_response_count
  AFTER INSERT ON survey_responses
  FOR EACH ROW EXECUTE FUNCTION increment_survey_response_count();

-- ─── event_testimonials ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_testimonials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  author_name varchar(255) NOT NULL,
  author_role varchar(100),
  content     text NOT NULL,
  rating      int CHECK (rating BETWEEN 1 AND 5),
  source      testimonial_source NOT NULL DEFAULT 'manual',
  is_approved boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  media_url   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_event    ON event_testimonials(event_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_approved ON event_testimonials(event_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON event_testimonials(event_id, is_featured) WHERE is_featured = true;

-- ─── vendor_settlements ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_settlements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_assignment_id  uuid REFERENCES vendor_event_assignments(id) ON DELETE SET NULL,
  agreed_amount         decimal(12,2) NOT NULL DEFAULT 0,
  final_amount          decimal(12,2) NOT NULL DEFAULT 0,
  adjustment_reason     text,
  payment_status        settlement_payment_status NOT NULL DEFAULT 'pending',
  paid_at               timestamptz,
  payment_method        varchar(50),
  receipt_url           text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_settlements_event  ON vendor_settlements(event_id);
CREATE INDEX IF NOT EXISTS idx_vendor_settlements_status ON vendor_settlements(event_id, payment_status);

-- ─── post_event_reports ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS post_event_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  report_type    post_event_report_type NOT NULL DEFAULT 'internal',
  generated_at   timestamptz NOT NULL DEFAULT now(),
  pdf_url        text,
  data_snapshot  jsonb NOT NULL DEFAULT '{}',
  created_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_event_reports_event ON post_event_reports(event_id);

-- ─── Add archived_at to events table ──────────────────────────────────────────

ALTER TABLE events ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_archived ON events(is_archived) WHERE is_archived = true;

-- ─── Seed checklist function ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_post_event_checklist(p_event_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO post_event_checklist (event_id, item_key, label, category, sort_order) VALUES
    -- Venue (6 items)
    (p_event_id, 'venue_walkthrough',       'Complete venue walkthrough & damage check',        'venue', 1),
    (p_event_id, 'venue_items_returned',    'Return all borrowed items to venue',               'venue', 2),
    (p_event_id, 'venue_keys_returned',     'Return keys / access cards',                       'venue', 3),
    (p_event_id, 'venue_invoice_received',  'Receive final venue invoice',                      'venue', 4),
    (p_event_id, 'venue_deposit_refund',    'Confirm security deposit refund',                  'venue', 5),
    (p_event_id, 'venue_feedback_sent',     'Send feedback / review to venue',                  'venue', 6),

    -- Finance (5 items)
    (p_event_id, 'finance_all_invoices',    'Collect all vendor invoices',                      'finance', 1),
    (p_event_id, 'finance_budget_final',    'Finalize actual spend vs budget',                  'finance', 2),
    (p_event_id, 'finance_client_invoice',  'Send final invoice to client',                     'finance', 3),
    (p_event_id, 'finance_payment_received','Confirm client payment received',                  'finance', 4),
    (p_event_id, 'finance_expense_report',  'File expense report / receipts',                   'finance', 5),

    -- Vendors (4 items)
    (p_event_id, 'vendors_all_settled',     'Settle all vendor payments',                       'vendors', 1),
    (p_event_id, 'vendors_collect_items',   'Collect all rented items from vendors',            'vendors', 2),
    (p_event_id, 'vendors_feedback',        'Send feedback to vendors',                         'vendors', 3),
    (p_event_id, 'vendors_contracts_filed', 'File all vendor contracts & receipts',             'vendors', 4),

    -- Guests (4 items)
    (p_event_id, 'guests_thank_you',        'Send thank-you messages to guests',                'guests', 1),
    (p_event_id, 'guests_photos_shared',    'Share event photos with guests',                   'guests', 2),
    (p_event_id, 'guests_survey_sent',      'Send post-event survey to guests',                 'guests', 3),
    (p_event_id, 'guests_headcount_final',  'Reconcile final headcount & no-shows',             'guests', 4),

    -- Team (3 items)
    (p_event_id, 'team_debrief',            'Conduct team debrief meeting',                     'team', 1),
    (p_event_id, 'team_thank_you',          'Send appreciation to team members',                'team', 2),
    (p_event_id, 'team_lessons_learned',    'Document lessons learned',                         'team', 3),

    -- Documents (3 items)
    (p_event_id, 'docs_archive',            'Archive all event documents & contracts',          'documents', 1),
    (p_event_id, 'docs_report_internal',    'Generate internal post-event report',              'documents', 2),
    (p_event_id, 'docs_report_client',      'Generate & send client report',                    'documents', 3);
END;
$$;

-- ─── Auto-create post_event_settings and seed checklist on event insert ───────

CREATE OR REPLACE FUNCTION auto_create_post_event_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO post_event_settings (event_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_post_event_settings ON events;
CREATE TRIGGER trg_auto_post_event_settings
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION auto_create_post_event_settings();

-- ─── updated_at triggers ──────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vendor_settlements'] LOOP
    EXECUTE format($f$
      CREATE TRIGGER trg_%1$s_updated_at
        BEFORE UPDATE ON %1$s
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    $f$, t);
  END LOOP;
END;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE post_event_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_event_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_surveys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_testimonials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_settlements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_event_reports   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'post_event_settings',
    'post_event_checklist',
    'event_surveys',
    'survey_responses',
    'event_testimonials',
    'vendor_settlements',
    'post_event_reports'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "tenant_isolation_%1$s"
        ON %1$s FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM events e
            JOIN tenant_users tu ON tu.tenant_id = e.tenant_id
            WHERE e.id = CASE
              WHEN %1$s = 'survey_responses' THEN (SELECT survey_id FROM event_surveys es WHERE es.id = survey_id LIMIT 1)
              ELSE event_id
            END
            AND tu.user_id = auth.uid()
          )
        );
    $f$, t);
  END LOOP;
END;
$$;


-- ==========================================
-- Migration: 073_api_access_requests_and_badges.sql
-- ==========================================
-- ============================================================
-- Migration 073 — API Access Requests + Badge Templates
-- ============================================================
-- NOTE: Core external-API tables (api_keys, api_webhooks,
--       webhook_deliveries, api_usage_logs, api_scopes) were
--       created in migration 059.  This migration adds:
--   1. api_access_requests — tenant-level API-tier requests
--      awaiting Super Admin approval before keys can be created
--   2. badge_template JSONB column on events (for print badges)
--   3. 90-day retention index on api_usage_logs
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. API Access Requests
--    Tenants on free/starter plans submit a request to unlock
--    the external API.  Super Admin approves/rejects.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_access_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_requested    VARCHAR(30) NOT NULL DEFAULT 'agency'
                      CHECK (plan_requested IN ('agency','enterprise','custom')),
  use_case          TEXT NOT NULL,                  -- What will they use the API for?
  expected_rps      INT,                            -- Expected requests per second
  requested_scopes  TEXT[] NOT NULL DEFAULT '{}',  -- Scopes they need
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  -- Auto-provisioning on approval
  auto_provision    BOOLEAN NOT NULL DEFAULT TRUE,  -- Create first key automatically
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate pending requests per tenant
  CONSTRAINT api_access_requests_one_pending_per_tenant
    EXCLUDE USING btree (tenant_id WITH =)
    WHERE (status = 'pending')
);

CREATE INDEX IF NOT EXISTS idx_api_access_requests_tenant
  ON public.api_access_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_access_requests_status
  ON public.api_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_api_access_requests_created
  ON public.api_access_requests(created_at DESC);

-- Updated-at trigger (reuse function from migration 059)
DROP TRIGGER IF EXISTS trg_api_access_requests_updated_at ON public.api_access_requests;
CREATE TRIGGER trg_api_access_requests_updated_at
  BEFORE UPDATE ON public.api_access_requests
  FOR EACH ROW EXECUTE FUNCTION update_api_updated_at();

-- RLS
ALTER TABLE public.api_access_requests ENABLE ROW LEVEL SECURITY;

-- Tenant users can see and manage their own requests
CREATE POLICY "api_access_requests_tenant_isolation"
  ON public.api_access_requests
  USING (tenant_id = (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  ));

-- ─────────────────────────────────────────────
-- 2. Badge Template Column on events
-- ─────────────────────────────────────────────
-- Stores the tenant's per-event badge design choices.
-- Shape (all fields optional, resolved to defaults in service):
-- {
--   layout        : "6up" | "8up" | "avery5160"
--   paper_size    : "A4" | "Letter"
--   orientation   : "landscape" | "portrait"
--   show_fields   : ["guest_name","category","table","company","qr_code","event_name","logo"]
--   primary_color : "#7c3aed"
--   secondary_color: "#f5f3ff"
--   text_color    : "#1a1a2e"
--   font_family   : "Helvetica" | "Times-Roman" | "Courier"
--   logo_url      : "https://..."
--   background_url: "https://..."
--   qr_size       : 60        -- px
--   badge_width_mm : 85
--   badge_height_mm: 55
--   corner_radius  : 6
--   updated_at    : "ISO string"
-- }
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS badge_template JSONB;

COMMENT ON COLUMN public.events.badge_template IS
  'Per-event badge print template config (layout, colours, visible fields). See migration 073.';

-- GIN index so we can filter events that have a template configured
CREATE INDEX IF NOT EXISTS idx_events_badge_template
  ON public.events USING GIN (badge_template)
  WHERE badge_template IS NOT NULL;

-- ─────────────────────────────────────────────
-- 3. 90-day Retention Index on api_usage_logs
--    Facilitates efficient purge of old rows by a scheduled job
-- ─────────────────────────────────────────────
-- Composite index covering tenant + date range queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_api_usage_tenant_requested
  ON public.api_usage_logs(tenant_id, requested_at DESC);

-- Retention-purge helper: partial index on old rows so a pg_cron job can
-- DELETE FROM api_usage_logs WHERE requested_at < NOW() - INTERVAL '90 days'
-- efficiently without a seq scan.
CREATE INDEX IF NOT EXISTS idx_api_usage_old_rows
  ON public.api_usage_logs(requested_at)
  WHERE requested_at < NOW() - INTERVAL '90 days';

-- ─────────────────────────────────────────────
-- 4. Additional api_scopes seed rows (rsvp + print)
--    Extend the seed from migration 059 with scopes used by
--    post-event and badge modules.
-- ─────────────────────────────────────────────
INSERT INTO public.api_scopes (scope, category, description, is_sensitive)
VALUES
  ('rsvp:write',       'Guests',    'Submit RSVP responses via API',       FALSE),
  ('checkin:write',    'Guests',    'Mark guest attendance via API',        FALSE),
  ('post_event:read',  'Post-Event','Read post-event reports and surveys', FALSE),
  ('badges:generate',  'Guests',    'Trigger badge PDF generation',         FALSE)
ON CONFLICT (scope) DO NOTHING;


-- ==========================================
-- Migration: 074_user_device_tokens.sql
-- ==========================================
-- Migration 074: User Device Tokens
-- Stores Expo push notification tokens per user for mobile push delivery.

create table if not exists public.user_device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tenant_id   uuid not null,
  token       text not null,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, token)
);

-- Index for looking up all tokens for a user (to send pushes)
create index if not exists idx_device_tokens_user_id
  on public.user_device_tokens(user_id);

-- Index for tenant-wide token lookups
create index if not exists idx_device_tokens_tenant_id
  on public.user_device_tokens(tenant_id);

-- RLS: users can only manage their own tokens
alter table public.user_device_tokens enable row level security;

create policy "users manage own tokens"
  on public.user_device_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role can read all tokens (needed for push delivery from API)
create policy "service role full access"
  on public.user_device_tokens
  for all
  to service_role
  using (true)
  with check (true);


-- ==========================================
-- Migration: 075_onboarding.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 075: Tenant Onboarding
--
-- Adds onboarding wizard state columns to the tenants table.
-- Referenced by: tenants.service.ts → getOnboardingStatus / advanceStep
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS onboarding_step          int          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at  timestamptz;

COMMENT ON COLUMN tenants.onboarding_step IS
  '0 = not started; 1–4 = wizard step; 5 = complete (also sets onboarding_completed_at)';

COMMENT ON COLUMN tenants.onboarding_completed_at IS
  'Set when onboarding_step reaches 5. NULL means onboarding is still in progress.';

-- Index for super-admin onboarding funnel queries
CREATE INDEX IF NOT EXISTS idx_tenants_onboarding_step
  ON tenants(onboarding_step)
  WHERE onboarding_completed_at IS NULL;


-- ==========================================
-- Migration: 076_intelligence.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 076: Intelligence Layer
--
-- Tables for the rule-based AI intelligence engine:
--   • smart_alerts    — per-event rule-triggered alerts
--   • event_health_scores — aggregated health score per event
--
-- Referenced by: intelligence.service.ts
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── smart_alerts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS smart_alerts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id    uuid        NOT NULL,
  alert_type   text        NOT NULL,                 -- unique rule key, e.g. 'guest_count_low'
  severity     alert_severity NOT NULL DEFAULT 'info',
  title        text        NOT NULL,
  message      text        NOT NULL,
  context      jsonb,                                -- rule-specific data (thresholds, counts, etc.)
  is_dismissed boolean     NOT NULL DEFAULT false,
  dismissed_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  dismissed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT smart_alerts_event_type_unique UNIQUE (event_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_smart_alerts_event     ON smart_alerts(event_id) WHERE is_dismissed = false;
CREATE INDEX IF NOT EXISTS idx_smart_alerts_tenant    ON smart_alerts(tenant_id) WHERE is_dismissed = false;
CREATE INDEX IF NOT EXISTS idx_smart_alerts_severity  ON smart_alerts(severity, created_at DESC);

ALTER TABLE smart_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_alerts_tenant_read"
  ON smart_alerts FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "smart_alerts_tenant_update"
  ON smart_alerts FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "smart_alerts_service_all"
  ON smart_alerts FOR ALL
  USING (auth.role() = 'service_role');

-- ── event_health_scores ───────────────────────────────────
CREATE TABLE IF NOT EXISTS event_health_scores (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id        uuid        NOT NULL,
  overall_score    int         NOT NULL DEFAULT 100 CHECK (overall_score BETWEEN 0 AND 100),
  dimension_scores jsonb       NOT NULL DEFAULT '{}'::jsonb,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  recompute_at     timestamptz NOT NULL DEFAULT (now() + interval '6 hours'),

  CONSTRAINT event_health_scores_event_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_health_scores_tenant   ON event_health_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_health_scores_recompute ON event_health_scores(recompute_at);

ALTER TABLE event_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_health_scores_tenant_read"
  ON event_health_scores FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "event_health_scores_service_all"
  ON event_health_scores FOR ALL
  USING (auth.role() = 'service_role');

-- ── updated_at trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_smart_alerts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_smart_alerts_updated_at ON smart_alerts;
CREATE TRIGGER trg_smart_alerts_updated_at
  BEFORE UPDATE ON smart_alerts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_smart_alerts();


-- ==========================================
-- Migration: 077_fnb_v2.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 077: F&B Module v2
--
-- Full F&B management schema — menus, items, serving stations,
-- token batches, token issuance, and consumption logging.
--
-- Referenced by: fnb.service.ts
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE fnb_meal_type     AS ENUM ('breakfast','lunch','dinner','brunch','hi_tea','snacks','cocktail','supper','custom');
  CREATE TYPE fnb_dietary_type  AS ENUM ('veg','non_veg','vegan','jain','gluten_free','kosher','halal','custom');
  CREATE TYPE fnb_serving_type  AS ENUM ('plated','buffet','live_cooking','thali','token','bar_service','food_stall','family_style','canape','cocktail_style','packed','custom');
  CREATE TYPE fnb_station_type  AS ENUM ('buffet','live','bar','dessert','juice','tea_coffee','welcome_drink','custom');
  CREATE TYPE fnb_token_status  AS ENUM ('issued','used','expired','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── fnb_menus ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_menus (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL,
  name           text        NOT NULL,
  meal_type      fnb_meal_type NOT NULL DEFAULT 'custom',
  service_time   timestamptz,
  guest_count    int,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_menus_event ON fnb_menus(event_id);

-- ── fnb_menu_items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_menu_items (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id         uuid         NOT NULL REFERENCES fnb_menus(id) ON DELETE CASCADE,
  event_id        uuid         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id       uuid         NOT NULL,
  name            text         NOT NULL,
  description     text,
  category        text,                             -- e.g. 'starter', 'main', 'dessert'
  dietary_type    fnb_dietary_type NOT NULL DEFAULT 'veg',
  serving_type    fnb_serving_type NOT NULL DEFAULT 'buffet',
  quantity        numeric(10,2),
  unit            text,                             -- 'kg', 'pcs', 'litre', etc.
  cost_per_unit   numeric(12,2),
  total_cost      numeric(14,2),
  sort_order      int          NOT NULL DEFAULT 0,
  is_active       boolean      NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_menu_items_menu   ON fnb_menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_fnb_menu_items_event  ON fnb_menu_items(event_id);

-- ── fnb_serving_stations ──────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_serving_stations (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL,
  name           text        NOT NULL,
  station_type   fnb_station_type NOT NULL DEFAULT 'buffet',
  location       text,
  capacity       int,
  staff_count    int         NOT NULL DEFAULT 0,
  assigned_items jsonb       NOT NULL DEFAULT '[]'::jsonb,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_serving_stations_event ON fnb_serving_stations(event_id);

-- ── fnb_token_batches ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_token_batches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id       uuid        NOT NULL,
  menu_item_id    uuid        REFERENCES fnb_menu_items(id) ON DELETE SET NULL,
  batch_code      text        NOT NULL,
  total_tokens    int         NOT NULL DEFAULT 0,
  issued_tokens   int         NOT NULL DEFAULT 0,
  batch_type      text        NOT NULL DEFAULT 'standard',
  notes           text,
  valid_from      timestamptz,
  valid_until     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fnb_token_batches_code_unique UNIQUE (event_id, batch_code)
);

CREATE INDEX IF NOT EXISTS idx_fnb_token_batches_event ON fnb_token_batches(event_id);

-- ── fnb_tokens ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid        NOT NULL REFERENCES fnb_token_batches(id) ON DELETE CASCADE,
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id     uuid        NOT NULL,
  guest_id      uuid        REFERENCES guests(id) ON DELETE SET NULL,
  token_code    text        NOT NULL,
  status        fnb_token_status NOT NULL DEFAULT 'issued',
  used_at       timestamptz,
  used_at_station text,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fnb_tokens_code_unique UNIQUE (event_id, token_code)
);

CREATE INDEX IF NOT EXISTS idx_fnb_tokens_batch   ON fnb_tokens(batch_id);
CREATE INDEX IF NOT EXISTS idx_fnb_tokens_guest   ON fnb_tokens(guest_id);
CREATE INDEX IF NOT EXISTS idx_fnb_tokens_event   ON fnb_tokens(event_id);

-- ── fnb_consumption_log ───────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_consumption_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL,
  menu_item_id   uuid        REFERENCES fnb_menu_items(id) ON DELETE SET NULL,
  guest_id       uuid        REFERENCES guests(id) ON DELETE SET NULL,
  quantity       numeric(10,2) NOT NULL DEFAULT 1,
  station        text,
  consumed_at    timestamptz NOT NULL DEFAULT now(),
  notes          text
);

CREATE INDEX IF NOT EXISTS idx_fnb_consumption_log_event ON fnb_consumption_log(event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_consumption_log_item  ON fnb_consumption_log(menu_item_id);

-- ── RLS (tenant-scoped) ───────────────────────────────────
ALTER TABLE fnb_menus          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_menu_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_serving_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_token_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_consumption_log ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['fnb_menus','fnb_menu_items','fnb_serving_stations','fnb_token_batches','fnb_tokens','fnb_consumption_log'] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_tenant" ON %1$s FOR ALL
        USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()))
        WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));
      CREATE POLICY "%1$s_service" ON %1$s FOR ALL USING (auth.role() = 'service_role');
    $f$, t);
  END LOOP;
END $$;


-- ==========================================
-- Migration: 078_tenant_payments.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 078: Tenant Payments
--
-- Full event ticketing and payment infrastructure:
--   • tenant_payment_gateways  — per-tenant gateway config (AES-256-GCM encrypted)
--   • event_payment_settings   — per-event payment configuration
--   • event_ticket_types       — ticket catalog (price, inventory, sale window)
--   • event_payment_orders     — order lifecycle (initiated → paid → refunded)
--   • event_payment_refunds    — refund tracking per order
--   • event_discount_codes     — percentage/fixed discount codes with usage limits
--
-- Referenced by: tenant-payments.service.ts
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE payment_order_status AS ENUM (
    'initiated','pending','paid','failed','cancelled',
    'refunded','partially_refunded','expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE payment_refund_status AS ENUM ('pending','processing','success','failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE discount_type AS ENUM ('percentage','fixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── tenant_payment_gateways ────────────────────────────────────────────────────
-- Stores one row per provider per tenant.
-- config and webhook_secret are AES-256-GCM encrypted blobs (iv:tag:enc).
CREATE TABLE IF NOT EXISTS tenant_payment_gateways (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL,
  provider        text        NOT NULL,  -- 'razorpay'|'stripe'|'cashfree'|'payumoney'|'instamojo'|'manual'
  display_name    text        NOT NULL,
  config          text        NOT NULL,  -- encrypted JSON: API keys, secrets
  webhook_secret  text,                  -- encrypted, nullable
  is_active       boolean     NOT NULL DEFAULT true,
  is_default      boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_payment_gateways_provider_unique UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_gateways_tenant
  ON tenant_payment_gateways(tenant_id);

-- ── event_payment_settings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_payment_settings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id               uuid        NOT NULL,
  gateway_id              uuid        REFERENCES tenant_payment_gateways(id) ON DELETE SET NULL,
  is_payments_enabled     boolean     NOT NULL DEFAULT false,
  currency                text        NOT NULL DEFAULT 'INR',
  payment_title           text,
  collect_phone           boolean     NOT NULL DEFAULT true,
  collect_address         boolean     NOT NULL DEFAULT false,
  collect_gst             boolean     NOT NULL DEFAULT false,
  gst_percentage          numeric(5,2) NOT NULL DEFAULT 18,
  convenience_fee_pct     numeric(5,2) NOT NULL DEFAULT 0,
  success_redirect_url    text,
  failure_redirect_url    text,
  custom_fields           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT event_payment_settings_event_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_payment_settings_event
  ON event_payment_settings(event_id);

-- ── event_ticket_types ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_ticket_types (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid          NOT NULL,
  name                text          NOT NULL,
  description         text,
  category            text,
  price               numeric(12,2) NOT NULL DEFAULT 0,
  currency            text          NOT NULL DEFAULT 'INR',
  total_quantity      int,          -- NULL = unlimited
  sold_quantity       int           NOT NULL DEFAULT 0,
  reserved_quantity   int           NOT NULL DEFAULT 0,
  min_per_order       int           NOT NULL DEFAULT 1,
  max_per_order       int           NOT NULL DEFAULT 10,
  sale_starts_at      timestamptz,
  sale_ends_at        timestamptz,
  is_active           boolean       NOT NULL DEFAULT true,
  sort_order          int           NOT NULL DEFAULT 0,
  metadata            jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_ticket_types_event
  ON event_ticket_types(event_id);

-- ── event_payment_orders ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_payment_orders (
  id                    uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              uuid                  NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id             uuid                  NOT NULL,
  gateway_id            uuid                  REFERENCES tenant_payment_gateways(id) ON DELETE SET NULL,
  guest_id              uuid                  REFERENCES guests(id) ON DELETE SET NULL,
  discount_code_id      uuid,                 -- FK added after event_discount_codes is created
  order_ref             text                  NOT NULL,
  provider_order_id     text,
  provider_payment_id   text,
  provider_metadata     jsonb,
  guest_name            text                  NOT NULL,
  guest_email           text                  NOT NULL,
  guest_phone           text,
  line_items            jsonb                 NOT NULL DEFAULT '[]'::jsonb,
  subtotal              numeric(14,2)         NOT NULL DEFAULT 0,
  discount_amount       numeric(14,2)         NOT NULL DEFAULT 0,
  gst_amount            numeric(14,2)         NOT NULL DEFAULT 0,
  convenience_fee       numeric(14,2)         NOT NULL DEFAULT 0,
  total_amount          numeric(14,2)         NOT NULL DEFAULT 0,
  currency              text                  NOT NULL DEFAULT 'INR',
  status                payment_order_status  NOT NULL DEFAULT 'initiated',
  payment_method        text,
  paid_at               timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz           NOT NULL DEFAULT now(),
  updated_at            timestamptz           NOT NULL DEFAULT now(),

  CONSTRAINT event_payment_orders_ref_unique UNIQUE (event_id, order_ref)
);

CREATE INDEX IF NOT EXISTS idx_event_payment_orders_event
  ON event_payment_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_payment_orders_guest
  ON event_payment_orders(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_payment_orders_status
  ON event_payment_orders(event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_payment_orders_provider
  ON event_payment_orders(provider_order_id) WHERE provider_order_id IS NOT NULL;

-- ── event_payment_refunds ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_payment_refunds (
  id                  uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid                  NOT NULL REFERENCES event_payment_orders(id) ON DELETE CASCADE,
  tenant_id           uuid                  NOT NULL,
  refund_ref          text                  NOT NULL,
  provider_refund_id  text,
  amount              numeric(14,2)         NOT NULL,
  reason              text,
  status              payment_refund_status NOT NULL DEFAULT 'pending',
  initiated_by        uuid                  REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at        timestamptz,
  created_at          timestamptz           NOT NULL DEFAULT now(),
  updated_at          timestamptz           NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_payment_refunds_order
  ON event_payment_refunds(order_id);

-- ── event_discount_codes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_discount_codes (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id         uuid          NOT NULL,
  code              text          NOT NULL,
  discount_type     discount_type NOT NULL DEFAULT 'percentage',
  discount_value    numeric(10,2) NOT NULL,
  max_discount_cap  numeric(10,2),           -- max value when type = percentage
  min_order_value   numeric(10,2),
  usage_limit       int,                     -- NULL = unlimited
  usage_count       int           NOT NULL DEFAULT 0,
  valid_from        timestamptz,
  valid_until       timestamptz,
  is_active         boolean       NOT NULL DEFAULT true,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT event_discount_codes_code_unique UNIQUE (event_id, code)
);

CREATE INDEX IF NOT EXISTS idx_event_discount_codes_event
  ON event_discount_codes(event_id);

-- ── Late FK: link orders → discount codes ─────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE event_payment_orders
    ADD CONSTRAINT fk_orders_discount_code
      FOREIGN KEY (discount_code_id) REFERENCES event_discount_codes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Helper: atomic discount usage increment ───────────────────────────────────
CREATE OR REPLACE FUNCTION increment_discount_usage(code_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE event_discount_codes
  SET    usage_count = usage_count + 1,
         updated_at  = now()
  WHERE  id = code_id;
$$;

-- ── updated_at triggers ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_payments()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenant_payment_gateways',
    'event_payment_settings',
    'event_ticket_types',
    'event_payment_orders',
    'event_payment_refunds',
    'event_discount_codes'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
       CREATE TRIGGER trg_%1$s_updated_at
         BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION set_updated_at_payments();',
      t
    );
  END LOOP;
END $$;

-- ── RLS ────────────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenant_payment_gateways',
    'event_payment_settings',
    'event_ticket_types',
    'event_payment_orders',
    'event_payment_refunds',
    'event_discount_codes'
  ] LOOP
    EXECUTE format('ALTER TABLE %1$s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_tenant" ON %1$s FOR ALL
        USING      (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()))
        WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));
      CREATE POLICY "%1$s_service" ON %1$s FOR ALL USING (auth.role() = 'service_role');
    $f$, t);
  END LOOP;
END $$;


-- ==========================================
-- Migration: 079_exports.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 079: Export Jobs
--
-- Async export job queue for PDF, XLSX, CSV, and ZIP report
-- generation.  The NestJS ExportsService enqueues a job,
-- processes it asynchronously, uploads the result to R2, and
-- writes the public URL back to this table.
--
-- Referenced by: exports.service.ts
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE export_job_status AS ENUM ('queued','processing','completed','failed');
  CREATE TYPE export_format_type AS ENUM ('pdf','xlsx','csv','zip');
  CREATE TYPE export_type_enum AS ENUM (
    'guest_list','seating_chart','runsheet','badges','attendance',
    'budget_report','vendor_report','fnb_report','payment_report',
    'full_event_zip','custom_report'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── export_jobs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS export_jobs (
  id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid               NOT NULL,
  event_id         uuid               REFERENCES events(id) ON DELETE CASCADE,
  export_type      export_type_enum   NOT NULL,
  format           export_format_type NOT NULL DEFAULT 'pdf',
  status           export_job_status  NOT NULL DEFAULT 'queued',
  options          jsonb              NOT NULL DEFAULT '{}'::jsonb,
  file_url         text,
  file_size_bytes  bigint,
  error_message    text,
  requested_by     uuid               REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz        NOT NULL DEFAULT now(),
  completed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_tenant
  ON export_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_event
  ON export_jobs(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_export_jobs_status
  ON export_jobs(status) WHERE status IN ('queued', 'processing');

-- ── tenant_brand_settings ──────────────────────────────────────────────────────
-- Stores per-tenant report branding: colors, logo, footer text.
-- Used by ExportsService.getBrand() to apply custom branding to all exports.
CREATE TABLE IF NOT EXISTS tenant_brand_settings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  company_name        text,
  primary_color       text        NOT NULL DEFAULT '#6366F1',
  secondary_color     text        NOT NULL DEFAULT '#8B5CF6',
  logo_url            text,
  footer_text         text        NOT NULL DEFAULT 'Powered by OccasionPro',
  font_family         text        NOT NULL DEFAULT 'Inter',
  report_header_html  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_brand_settings_tenant_unique UNIQUE (tenant_id)
);

-- ── updated_at trigger ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_brand_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_brand_settings_updated_at ON tenant_brand_settings;
CREATE TRIGGER trg_tenant_brand_settings_updated_at
  BEFORE UPDATE ON tenant_brand_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_brand_settings();

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE export_jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_brand_settings  ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['export_jobs','tenant_brand_settings'] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_tenant" ON %1$s FOR ALL
        USING      (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()))
        WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));
      CREATE POLICY "%1$s_service" ON %1$s FOR ALL USING (auth.role() = 'service_role');
    $f$, t);
  END LOOP;
END $$;


-- ==========================================
-- Migration: 080_custom_domains.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 080: Custom Domains
--
-- Per-tenant white-label custom domain system.
-- Integrates with Cloudflare Custom Hostnames API for SSL
-- provisioning and the CUSTOM_DOMAINS_KV Worker binding for
-- fast domain → tenant slug resolution at the edge.
--
-- Referenced by: custom-domains.service.ts
-- ============================================================

-- ── tenant_custom_domains ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_custom_domains (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL,
  domain                text        NOT NULL,
  subdomain_prefix      text,                   -- e.g. 'events' for events.client.com
  verification_token    text,                   -- TXT record value for DNS verification
  verification_method   text        NOT NULL DEFAULT 'txt_record',
  is_verified           boolean     NOT NULL DEFAULT false,
  verified_at           timestamptz,
  is_active             boolean     NOT NULL DEFAULT false,
  ssl_status            text        NOT NULL DEFAULT 'pending',
                                               -- 'pending'|'provisioning'|'active'|'failed'
  ssl_provisioned_at    timestamptz,
  cf_custom_hostname_id text,                  -- Cloudflare Custom Hostname resource ID
  check_failures        int         NOT NULL DEFAULT 0,
  last_checked_at       timestamptz,
  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_custom_domains_domain_unique UNIQUE (domain),
  CONSTRAINT tenant_custom_domains_tenant_unique UNIQUE (tenant_id)  -- one domain per tenant
);

CREATE INDEX IF NOT EXISTS idx_tenant_custom_domains_tenant
  ON tenant_custom_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_custom_domains_ssl_pending
  ON tenant_custom_domains(ssl_status, is_verified)
  WHERE ssl_status = 'provisioning' AND is_verified = true;
CREATE INDEX IF NOT EXISTS idx_tenant_custom_domains_unverified
  ON tenant_custom_domains(is_verified, check_failures, created_at)
  WHERE is_verified = false AND check_failures < 10;

-- ── updated_at trigger ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_custom_domains()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_custom_domains_updated_at ON tenant_custom_domains;
CREATE TRIGGER trg_tenant_custom_domains_updated_at
  BEFORE UPDATE ON tenant_custom_domains
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_custom_domains();

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE tenant_custom_domains ENABLE ROW LEVEL SECURITY;

-- Tenant owners can read their own domain record
CREATE POLICY "tenant_custom_domains_tenant_read"
  ON tenant_custom_domains FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

-- Tenant owners can insert/update their own record
CREATE POLICY "tenant_custom_domains_tenant_write"
  ON tenant_custom_domains FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

CREATE POLICY "tenant_custom_domains_tenant_update"
  ON tenant_custom_domains FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

CREATE POLICY "tenant_custom_domains_tenant_delete"
  ON tenant_custom_domains FOR DELETE
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

-- Service role has full access (used by background verification cron)
CREATE POLICY "tenant_custom_domains_service"
  ON tenant_custom_domains FOR ALL
  USING (auth.role() = 'service_role');


-- ==========================================
-- Migration: 081_security.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 081: Security Infrastructure
--
-- Two tables:
--   • auth_attempts      — brute-force protection (BruteForceService)
--   • security_audit_log — immutable security event log (SecurityAuditService)
--
-- Privacy: IP addresses, identifiers, and user agents are stored
-- as SHA-256 hashes only (hashed before insert in BruteForceService
-- and SecurityAuditService via FieldEncryptionService.hashForStorage).
--
-- Referenced by:
--   apps/api/src/common/security/brute-force.service.ts
--   apps/api/src/common/security/security-audit.service.ts
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE attempt_type_enum AS ENUM (
    'password','otp','magic_link','api_key',
    'vendor_login','client_login','guest_login'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── auth_attempts ──────────────────────────────────────────────────────────────
-- Tracks authentication attempts for brute-force detection.
-- All sensitive values (IP, identifier, user_agent) are SHA-256 hashed.
-- Rows older than 24 hours are irrelevant for lockout checks and can be pruned.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid,              -- nullable: pre-auth attempts may lack tenant context
  ip_hash          text               NOT NULL,
  identifier_hash  text               NOT NULL,  -- hash of email / phone / token
  attempt_type     text               NOT NULL,  -- matches attempt_type_enum values (stored as text for flexibility)
  success          boolean            NOT NULL DEFAULT false,
  user_agent_hash  text,
  created_at       timestamptz        NOT NULL DEFAULT now()
);

-- Fast lockout check: recent failures for a given identifier+type
CREATE INDEX IF NOT EXISTS idx_auth_attempts_identifier_type
  ON auth_attempts(identifier_hash, attempt_type, created_at DESC)
  WHERE success = false;

-- Fast lockout check: recent failures for a given IP
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip
  ON auth_attempts(ip_hash, attempt_type, created_at DESC)
  WHERE success = false;

-- Tenant-scoped query support
CREATE INDEX IF NOT EXISTS idx_auth_attempts_tenant
  ON auth_attempts(tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- ── security_audit_log ─────────────────────────────────────────────────────────
-- Append-only security event log. No UPDATE or DELETE policies for tenant users.
-- Written by SecurityAuditService fire-and-forget from throughout the API.
CREATE TABLE IF NOT EXISTS security_audit_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  action         text        NOT NULL,   -- matches SecurityAction union type
  tenant_id      uuid,
  user_id        uuid,
  resource_type  text,
  resource_id    text,
  ip_hash        text,
  user_agent_hash text,
  metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  success        boolean     NOT NULL DEFAULT true,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Super-admin dashboard: list events by tenant (recent first)
CREATE INDEX IF NOT EXISTS idx_security_audit_log_tenant
  ON security_audit_log(tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Filter by action type
CREATE INDEX IF NOT EXISTS idx_security_audit_log_action
  ON security_audit_log(action, created_at DESC);

-- Filter failures only
CREATE INDEX IF NOT EXISTS idx_security_audit_log_failures
  ON security_audit_log(tenant_id, action, created_at DESC)
  WHERE success = false;

-- User-scoped audit trail
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user
  ON security_audit_log(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────────────────────

-- auth_attempts: service role only (written/read exclusively by BruteForceService)
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_attempts_service"
  ON auth_attempts FOR ALL
  USING (auth.role() = 'service_role');

-- security_audit_log: read-only for tenant members (append-only semantics)
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_audit_log_tenant_read"
  ON security_audit_log FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

-- No INSERT/UPDATE/DELETE for tenant users — only service role may write
CREATE POLICY "security_audit_log_service"
  ON security_audit_log FOR ALL
  USING (auth.role() = 'service_role');

-- ── Pruning helper (called by a scheduled cron in super-admin automation) ──────
-- Removes auth_attempts older than 24 hours (they cannot affect lockout windows)
-- and audit log entries older than 2 years (regulatory retention = 1 year + buffer).
CREATE OR REPLACE FUNCTION prune_security_tables()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM auth_attempts
  WHERE created_at < now() - interval '24 hours';

  DELETE FROM security_audit_log
  WHERE created_at < now() - interval '2 years';
$$;


-- ==========================================
-- Migration: 082_notifications.sql
-- ==========================================
-- ============================================================================
-- Migration 082: Notification Templates, Preferences & Delivery Log
-- OccasionPro — Multi-channel notification infrastructure
-- ============================================================================

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM (
    'in_app', 'email', 'sms', 'whatsapp', 'push'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_delivery_status AS ENUM (
    'queued', 'sent', 'delivered', 'failed', 'bounced', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_recipient_type AS ENUM (
    'team', 'guest', 'client', 'vendor'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── notification_templates ───────────────────────────────────────────────────
-- System templates (tenant_id NULL) + tenant overrides (tenant_id SET)

CREATE TABLE IF NOT EXISTS notification_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = system template
  template_key      TEXT NOT NULL,
  channel           notification_channel NOT NULL,
  event_trigger     TEXT NOT NULL,                     -- e.g. 'guest.rsvp_confirmed'
  subject_template  TEXT,                              -- for email channel
  body_template     TEXT NOT NULL,                     -- Handlebars template string
  variables         JSONB DEFAULT '[]',                -- [{name, description, required}]
  is_system         BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NULL-safe unique: one system template + one override per tenant per template_key+channel
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_templates_system
  ON notification_templates (template_key, channel)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_templates_tenant
  ON notification_templates (template_key, channel, tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notif_templates_key_channel
  ON notification_templates (template_key, channel);
CREATE INDEX IF NOT EXISTS idx_notif_templates_tenant
  ON notification_templates (tenant_id) WHERE tenant_id IS NOT NULL;

-- ─── notification_preferences ─────────────────────────────────────────────────
-- Per-user, per-tenant channel toggle matrix + quiet hours

CREATE TABLE IF NOT EXISTS notification_channel_preferences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- JSONB map of category → {in_app, email, sms, whatsapp, push}
  -- e.g. {"events": {"in_app": true, "email": true, "sms": false, "whatsapp": true, "push": true}}
  channel_preferences JSONB NOT NULL DEFAULT '{
    "events":    {"in_app": true,  "email": true,  "sms": false, "whatsapp": true,  "push": true},
    "guests":    {"in_app": true,  "email": true,  "sms": false, "whatsapp": false, "push": true},
    "runsheet":  {"in_app": true,  "email": false, "sms": false, "whatsapp": false, "push": true},
    "payments":  {"in_app": true,  "email": true,  "sms": false, "whatsapp": true,  "push": false},
    "vendors":   {"in_app": true,  "email": true,  "sms": false, "whatsapp": false, "push": false},
    "alerts":    {"in_app": true,  "email": true,  "sms": false, "whatsapp": false, "push": true},
    "clients":   {"in_app": true,  "email": true,  "sms": false, "whatsapp": false, "push": false},
    "team":      {"in_app": true,  "email": true,  "sms": false, "whatsapp": false, "push": true}
  }',
  quiet_hours_start   TIME,           -- e.g. '22:00'
  quiet_hours_end     TIME,           -- e.g. '08:00'
  timezone            TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user_tenant
  ON notification_channel_preferences (user_id, tenant_id);

-- ─── notification_log ─────────────────────────────────────────────────────────
-- Immutable delivery log for all outbound notifications

CREATE TABLE IF NOT EXISTS notification_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_type      notification_recipient_type NOT NULL,
  recipient_id        UUID NOT NULL,
  channel             notification_channel NOT NULL,
  template_key        TEXT NOT NULL,
  event_id            UUID,           -- nullable, links notification to an event
  status              notification_delivery_status NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,           -- e.g. Resend email ID, Fast2SMS message ID
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  failure_reason      TEXT,
  metadata            JSONB DEFAULT '{}',  -- rendered subject, body snippet, variables used
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_tenant      ON notification_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_recipient   ON notification_log (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_status      ON notification_log (status);
CREATE INDEX IF NOT EXISTS idx_notif_log_event       ON notification_log (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_log_template    ON notification_log (template_key);

-- Enable Supabase Realtime on notification_log (for super admin monitoring)
ALTER TABLE notification_log REPLICA IDENTITY FULL;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE notification_templates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channel_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log                 ENABLE ROW LEVEL SECURITY;

-- Templates: system templates visible to all; tenant templates to own tenant
CREATE POLICY "notification_templates_select" ON notification_templates
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = (
    SELECT tenant_id FROM workspace_members WHERE user_id = auth.uid() LIMIT 1
  ));

-- Preferences: own row only
CREATE POLICY "notification_prefs_own" ON notification_channel_preferences
  FOR ALL USING (user_id = auth.uid());

-- Log: own tenant reads
CREATE POLICY "notification_log_tenant" ON notification_log
  FOR SELECT USING (tenant_id = (
    SELECT tenant_id FROM workspace_members WHERE user_id = auth.uid() LIMIT 1
  ));

-- ─── Helper function: check quiet hours ──────────────────────────────────────

CREATE OR REPLACE FUNCTION is_in_quiet_hours(
  p_user_id UUID,
  p_tenant_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_start TIME;
  v_end   TIME;
  v_tz    TEXT;
  v_now   TIME;
BEGIN
  SELECT quiet_hours_start, quiet_hours_end, timezone
    INTO v_start, v_end, v_tz
    FROM notification_channel_preferences
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN false;
  END IF;

  v_now := (now() AT TIME ZONE COALESCE(v_tz, 'Asia/Kolkata'))::TIME;

  -- Handle overnight quiet hours (e.g. 22:00 → 08:00)
  IF v_start > v_end THEN
    RETURN v_now >= v_start OR v_now <= v_end;
  ELSE
    RETURN v_now >= v_start AND v_now <= v_end;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Seed: 30 System Notification Templates ──────────────────────────────────

INSERT INTO notification_templates (template_key, channel, event_trigger, subject_template, body_template, variables, is_system) VALUES

-- ── Guest events ──────────────────────────────────────────────────────────────

('guest_rsvp_confirmed', 'email', 'guest.rsvp_confirmed',
 'Your RSVP is confirmed — {{event_name}}',
 '<p>Hi {{guest_name}},</p><p>Great news! Your RSVP for <strong>{{event_name}}</strong> on {{event_date}} has been confirmed.</p><p>Venue: {{venue_name}}</p>{{#if qr_link}}<p>Your entry QR code: <a href="{{qr_link}}">View QR Code</a></p>{{/if}}<p>We look forward to seeing you!</p>',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"venue_name","required":false},{"name":"qr_link","required":false}]',
 true),

('guest_rsvp_confirmed', 'whatsapp', 'guest.rsvp_confirmed',
 NULL,
 '✅ *RSVP Confirmed!*\n\nHi {{guest_name}}, your attendance at *{{event_name}}* on {{event_date}} is confirmed.\n\n📍 Venue: {{venue_name}}\n{{#if qr_link}}🎟️ Your QR code: {{qr_link}}{{/if}}\n\nSee you there! 🎉',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"venue_name","required":false},{"name":"qr_link","required":false}]',
 true),

('guest_checkin_welcome', 'whatsapp', 'guest.checked_in',
 NULL,
 '👋 *Welcome, {{guest_name}}!*\n\nYou''ve successfully checked in to *{{event_name}}*.\n\n{{#if digital_badge_link}}🏷️ Your digital badge: {{digital_badge_link}}{{/if}}\n{{#if table_number}}🪑 Your table: {{table_number}}{{/if}}\n\nEnjoy the event! ✨',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"digital_badge_link","required":false},{"name":"table_number","required":false}]',
 true),

('guest_event_reminder_24h', 'email', 'event.reminder_24h',
 '📅 Reminder: {{event_name}} is tomorrow!',
 '<p>Hi {{guest_name}},</p><p>Just a reminder that <strong>{{event_name}}</strong> is <strong>tomorrow, {{event_date}}</strong>.</p><p>📍 <strong>Venue:</strong> {{venue_name}}, {{venue_address}}</p><p>🕐 <strong>Time:</strong> {{event_time}}</p>{{#if qr_link}}<p>🎟️ <strong>Your entry QR:</strong> <a href="{{qr_link}}">View Here</a></p>{{/if}}<p>We''re excited to see you!</p>',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"event_time","required":true},{"name":"venue_name","required":true},{"name":"venue_address","required":false},{"name":"qr_link","required":false}]',
 true),

('guest_event_reminder_24h', 'sms', 'event.reminder_24h',
 NULL,
 'Hi {{guest_name}}, reminder: {{event_name}} is tomorrow at {{event_time}}. Venue: {{venue_name}}. {{#if qr_link}}QR: {{qr_link}}{{/if}}',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_time","required":true},{"name":"venue_name","required":true},{"name":"qr_link","required":false}]',
 true),

('guest_event_reminder_24h', 'whatsapp', 'event.reminder_24h',
 NULL,
 '⏰ *Event Reminder*\n\nHi {{guest_name}}, *{{event_name}}* is tomorrow!\n\n🗓️ Date: {{event_date}}\n🕐 Time: {{event_time}}\n📍 Venue: {{venue_name}}\n{{#if qr_link}}🎟️ Your QR: {{qr_link}}{{/if}}\n\nSee you there! 👋',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"event_time","required":true},{"name":"venue_name","required":true},{"name":"qr_link","required":false}]',
 true),

('guest_invitation_sent', 'email', 'guest.invitation_sent',
 'You''re invited to {{event_name}}!',
 '<p>Hi {{guest_name}},</p><p>You''ve been invited to <strong>{{event_name}}</strong>.</p><p>🗓️ Date: {{event_date}}<br>📍 Venue: {{venue_name}}</p><p><a href="{{rsvp_link}}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">RSVP Now</a></p>',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"venue_name","required":false},{"name":"rsvp_link","required":true}]',
 true),

('guest_invitation_sent', 'whatsapp', 'guest.invitation_sent',
 NULL,
 '🎉 *You''re Invited!*\n\nHi {{guest_name}}, you''ve been invited to *{{event_name}}*.\n\n🗓️ {{event_date}}\n📍 {{venue_name}}\n\n👉 RSVP here: {{rsvp_link}}',
 '[{"name":"guest_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"venue_name","required":false},{"name":"rsvp_link","required":true}]',
 true),

-- ── Team events ───────────────────────────────────────────────────────────────

('team_invite', 'email', 'team.member_invited',
 'You''ve been invited to join {{workspace_name}} on OccasionPro',
 '<p>Hi {{invitee_name}},</p><p><strong>{{inviter_name}}</strong> has invited you to join <strong>{{workspace_name}}</strong> on OccasionPro as <strong>{{role}}</strong>.</p><p><a href="{{invite_link}}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Accept Invitation</a></p><p>This link expires in 7 days.</p>',
 '[{"name":"invitee_name","required":true},{"name":"inviter_name","required":true},{"name":"workspace_name","required":true},{"name":"role","required":true},{"name":"invite_link","required":true}]',
 true),

('team_event_assigned', 'email', 'team.event_assigned',
 'You''ve been assigned to {{event_name}}',
 '<p>Hi {{member_name}},</p><p>You''ve been assigned to <strong>{{event_name}}</strong> on {{event_date}} as <strong>{{role}}</strong>.</p><p><a href="{{event_url}}">View Event</a></p>',
 '[{"name":"member_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"role","required":true},{"name":"event_url","required":true}]',
 true),

('team_event_assigned', 'in_app', 'team.event_assigned',
 NULL,
 'You''ve been assigned to {{event_name}} as {{role}}.',
 '[{"name":"event_name","required":true},{"name":"role","required":true}]',
 true),

('runsheet_item_assigned', 'in_app', 'runsheet.item_assigned',
 NULL,
 '📋 Runsheet item assigned: "{{item_title}}" at {{start_time}} on {{event_name}}.',
 '[{"name":"item_title","required":true},{"name":"start_time","required":true},{"name":"event_name","required":true}]',
 true),

('runsheet_item_assigned', 'push', 'runsheet.item_assigned',
 'New runsheet assignment',
 '📋 "{{item_title}}" at {{start_time}} — {{event_name}}',
 '[{"name":"item_title","required":true},{"name":"start_time","required":true},{"name":"event_name","required":true}]',
 true),

('alert_critical', 'in_app', 'intelligence.alert_critical',
 NULL,
 '🚨 {{alert_title}}: {{alert_message}}',
 '[{"name":"alert_title","required":true},{"name":"alert_message","required":true},{"name":"event_name","required":false}]',
 true),

('alert_critical', 'email', 'intelligence.alert_critical',
 '🚨 Critical Alert — {{event_name}}: {{alert_title}}',
 '<p><strong>⚠️ Critical Alert</strong></p><p><strong>Event:</strong> {{event_name}}<br><strong>Alert:</strong> {{alert_title}}</p><p>{{alert_message}}</p><p><a href="{{event_url}}">View Event Dashboard</a></p>',
 '[{"name":"alert_title","required":true},{"name":"alert_message","required":true},{"name":"event_name","required":true},{"name":"event_url","required":true}]',
 true),

('alert_critical', 'push', 'intelligence.alert_critical',
 '🚨 Critical Alert',
 '{{alert_title}}: {{alert_message}}',
 '[{"name":"alert_title","required":true},{"name":"alert_message","required":true}]',
 true),

-- ── Vendor events ─────────────────────────────────────────────────────────────

('vendor_event_assigned', 'email', 'vendor.event_assigned',
 'New event assignment: {{event_name}}',
 '<p>Hi {{vendor_name}},</p><p>You have been assigned to <strong>{{event_name}}</strong> on {{event_date}} at {{venue_name}}.</p><p>Category: {{vendor_category}}</p><p><a href="{{vendor_portal_url}}">View in Vendor Portal</a></p>',
 '[{"name":"vendor_name","required":true},{"name":"event_name","required":true},{"name":"event_date","required":true},{"name":"venue_name","required":false},{"name":"vendor_category","required":false},{"name":"vendor_portal_url","required":true}]',
 true),

('vendor_payment_done', 'email', 'vendor.payment_processed',
 'Payment processed: ₹{{amount}} for {{event_name}}',
 '<p>Hi {{vendor_name}},</p><p>A payment of <strong>₹{{amount}}</strong> has been processed for <strong>{{event_name}}</strong>.</p><p>Reference: {{payment_reference}}<br>Date: {{payment_date}}</p><p><a href="{{vendor_portal_url}}">View in Vendor Portal</a></p>',
 '[{"name":"vendor_name","required":true},{"name":"amount","required":true},{"name":"event_name","required":true},{"name":"payment_reference","required":false},{"name":"payment_date","required":true},{"name":"vendor_portal_url","required":true}]',
 true),

('vendor_settlement_reminder', 'email', 'vendor.settlement_reminder',
 'Pending settlement: {{event_name}}',
 '<p>Hi {{vendor_name}},</p><p>This is a reminder that your settlement for <strong>{{event_name}}</strong> is pending.</p><p>Outstanding amount: <strong>₹{{outstanding_amount}}</strong><br>Due date: {{due_date}}</p><p><a href="{{vendor_portal_url}}">View Details</a></p>',
 '[{"name":"vendor_name","required":true},{"name":"event_name","required":true},{"name":"outstanding_amount","required":true},{"name":"due_date","required":true},{"name":"vendor_portal_url","required":true}]',
 true),

('vendor_settlement_reminder', 'in_app', 'vendor.settlement_reminder',
 NULL,
 '💰 Settlement pending for {{event_name}}: ₹{{outstanding_amount}} due {{due_date}}.',
 '[{"name":"event_name","required":true},{"name":"outstanding_amount","required":true},{"name":"due_date","required":true}]',
 true),

-- ── Client events ─────────────────────────────────────────────────────────────

('client_portal_access', 'email', 'client.portal_access_granted',
 'Your OccasionPro client portal is ready — {{event_name}}',
 '<p>Hi {{client_name}},</p><p>Your event planning portal for <strong>{{event_name}}</strong> is now live!</p><p>You can view proposals, approve items, share feedback, and track event progress.</p><p><a href="{{magic_link}}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Access Your Portal</a></p><p>This link expires in 24 hours. You can request a new one at any time.</p>',
 '[{"name":"client_name","required":true},{"name":"event_name","required":true},{"name":"magic_link","required":true}]',
 true),

('client_file_shared', 'email', 'client.file_shared',
 'New document shared: {{file_name}} — {{event_name}}',
 '<p>Hi {{client_name}},</p><p>A new document <strong>{{file_name}}</strong> has been shared with you for <strong>{{event_name}}</strong>.</p><p><a href="{{portal_url}}">View in Your Portal</a></p>',
 '[{"name":"client_name","required":true},{"name":"file_name","required":true},{"name":"event_name","required":true},{"name":"portal_url","required":true}]',
 true),

('client_file_shared', 'in_app', 'client.file_shared',
 NULL,
 '📄 New document shared: "{{file_name}}" for {{event_name}}.',
 '[{"name":"file_name","required":true},{"name":"event_name","required":true}]',
 true),

-- ── Payment events ────────────────────────────────────────────────────────────

('payment_confirmed', 'email', 'payment.confirmed',
 '✅ Payment confirmed — ₹{{amount}}',
 '<p>Hi {{buyer_name}},</p><p>Your payment of <strong>₹{{amount}}</strong> has been confirmed.</p><p>Reference: {{payment_reference}}<br>Event: {{event_name}}<br>Date: {{payment_date}}</p><p>Thank you!</p>',
 '[{"name":"buyer_name","required":true},{"name":"amount","required":true},{"name":"payment_reference","required":true},{"name":"event_name","required":false},{"name":"payment_date","required":true}]',
 true),

('payment_confirmed', 'whatsapp', 'payment.confirmed',
 NULL,
 '✅ *Payment Confirmed!*\n\nHi {{buyer_name}}, your payment of *₹{{amount}}* has been received.\n\nRef: {{payment_reference}}\n📅 {{payment_date}}\n\nThank you! 🙏',
 '[{"name":"buyer_name","required":true},{"name":"amount","required":true},{"name":"payment_reference","required":true},{"name":"payment_date","required":true}]',
 true),

('refund_processed', 'email', 'payment.refund_processed',
 'Refund processed — ₹{{amount}}',
 '<p>Hi {{buyer_name}},</p><p>A refund of <strong>₹{{amount}}</strong> has been processed to your original payment method.</p><p>Reference: {{refund_reference}}<br>Expected within: 5–7 business days</p>',
 '[{"name":"buyer_name","required":true},{"name":"amount","required":true},{"name":"refund_reference","required":true}]',
 true),

('payment_failed', 'email', 'payment.failed',
 'Payment failed — action required',
 '<p>Hi {{buyer_name}},</p><p>Your payment of <strong>₹{{amount}}</strong> could not be processed.</p><p>Reason: {{failure_reason}}</p><p>Please try again or use a different payment method.</p><p><a href="{{retry_url}}">Retry Payment</a></p>',
 '[{"name":"buyer_name","required":true},{"name":"amount","required":true},{"name":"failure_reason","required":false},{"name":"retry_url","required":true}]',
 true)

ON CONFLICT DO NOTHING;

-- ─── updated_at trigger on templates ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_notification_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_templates_updated_at ON notification_templates;
CREATE TRIGGER trg_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_notification_template_updated_at();


-- ==========================================
-- Migration: 083_dpdp.sql
-- ==========================================
-- ============================================================
-- Migration 083: DPDP Compliance
-- India's Digital Personal Data Protection Act 2023
-- ============================================================

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE subject_type_enum AS ENUM ('guest', 'team_member', 'client', 'vendor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consent_type_enum AS ENUM (
    'data_processing',
    'marketing_comms',
    'photo_sharing',
    'third_party_sharing'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE data_request_type_enum AS ENUM ('access', 'correction', 'erasure', 'portability');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE data_request_status_enum AS ENUM ('pending', 'processing', 'completed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── consent_records ──────────────────────────────────────────────────────────
-- Records every explicit consent event (and withdrawal).
-- ip_hash + user_agent_hash are SHA-256 digests — never store raw PII.

CREATE TABLE IF NOT EXISTS consent_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id         UUID REFERENCES events(id) ON DELETE SET NULL,
  subject_type     subject_type_enum NOT NULL,
  subject_id       UUID,               -- NULL for unauthenticated subjects
  subject_email    TEXT NOT NULL,
  consent_type     consent_type_enum NOT NULL,
  consent_given    BOOLEAN NOT NULL DEFAULT TRUE,
  consent_text     TEXT NOT NULL,       -- exact text shown to the user
  ip_hash          TEXT,               -- SHA-256 of originating IP
  user_agent_hash  TEXT,               -- SHA-256 of User-Agent string
  given_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at     TIMESTAMPTZ,
  version          TEXT NOT NULL DEFAULT '1.0',

  CONSTRAINT consent_records_email_not_empty CHECK (subject_email <> '')
);

-- ─── data_requests ────────────────────────────────────────────────────────────
-- Tracks subject rights requests (access, erasure, correction, portability).

CREATE TABLE IF NOT EXISTS data_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE SET NULL,
  requestor_email  TEXT NOT NULL,
  request_type     data_request_type_enum NOT NULL,
  status           data_request_status_enum NOT NULL DEFAULT 'pending',
  notes            TEXT,
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  handled_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT data_requests_email_not_empty CHECK (requestor_email <> '')
);

-- ─── privacy_policy_versions ──────────────────────────────────────────────────
-- Append-only log of all published privacy policy versions.

CREATE TABLE IF NOT EXISTS privacy_policy_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version          TEXT NOT NULL UNIQUE,
  content_markdown TEXT NOT NULL,
  effective_from   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_consent_subject_email
  ON consent_records (subject_email);

CREATE INDEX IF NOT EXISTS idx_consent_type
  ON consent_records (consent_type);

CREATE INDEX IF NOT EXISTS idx_consent_tenant_email_type
  ON consent_records (tenant_id, subject_email, consent_type);

CREATE INDEX IF NOT EXISTS idx_consent_given_at
  ON consent_records (given_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_requests_status
  ON data_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_requests_email
  ON data_requests (requestor_email);

CREATE INDEX IF NOT EXISTS idx_data_requests_tenant
  ON data_requests (tenant_id, requested_at DESC);

-- ─── Seed initial privacy policy version ─────────────────────────────────────

INSERT INTO privacy_policy_versions (version, content_markdown, effective_from)
VALUES (
  '1.0',
  E'# Privacy Policy\n\n**Last updated:** January 2025  \n**Effective from:** January 1, 2025\n\n---\n\n## 1. Data Fiduciary\n\nThis platform is operated by the event management company (**Tenant**) that organised the event you are attending. OccasionPro acts as the **Data Processor** on behalf of the Tenant.\n\n## 2. What data we collect\n\n- **Identity data**: Full name, email address, phone number\n- **Event data**: RSVP responses, meal preferences, accommodation requests, check-in records\n- **Communications**: Messages sent through the guest portal\n- **Technical data**: IP address (hashed), device type — used only for security and fraud prevention\n\n## 3. Purpose and legal basis\n\nWe collect and process your personal data solely for the purposes of:\n- Managing your registration and attendance at the event\n- Communicating event-related information\n- Generating entry passes and seating assignments\n- Catering and accommodation arrangements\n\nYour data is processed on the basis of **your explicit consent** given at registration.\n\n## 4. Data sharing\n\nYour data is shared only with:\n- The event organiser (Tenant) and their authorised staff\n- Vendors directly involved in delivering services at your event (caterers, accommodation providers) — only with your consent\n- OccasionPro (as Data Processor) for platform operations\n\nWe **do not sell** your data to any third party.\n\n## 5. Retention\n\nYour personal data is retained for 90 days after the event date, after which it is anonymised unless you request earlier deletion.\n\n## 6. Your Rights under DPDP Act 2023\n\nUnder India''s Digital Personal Data Protection Act 2023, you have the right to:\n\n- **Access**: Obtain a summary of all personal data held about you\n- **Correction**: Request correction of inaccurate or incomplete data\n- **Erasure**: Request deletion of your personal data\n- **Portability**: Receive your data in a machine-readable format\n- **Withdraw Consent**: Withdraw your consent at any time without affecting the lawfulness of prior processing\n- **Nominate**: Nominate another person to exercise these rights on your behalf\n\nTo exercise these rights, visit the **Your Data Rights** page or email the Grievance Officer.\n\n## 7. Grievance Officer\n\nIf you have any complaints or concerns regarding the processing of your personal data, please contact our designated Grievance Officer:\n\n**Email:** grievance@occasionpro.in  \n**Response time:** Within 48 hours of receipt\n\n## 8. Contact\n\nFor any privacy-related queries, contact: **privacy@occasionpro.in**',
  NOW()
) ON CONFLICT (version) DO NOTHING;

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE consent_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_policy_versions ENABLE ROW LEVEL SECURITY;

-- Service role bypass (API uses service role)
CREATE POLICY "service_role_all_consent"
  ON consent_records FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_data_requests"
  ON data_requests FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "public_read_privacy_policy"
  ON privacy_policy_versions FOR SELECT USING (TRUE);

CREATE POLICY "service_role_all_privacy_policy"
  ON privacy_policy_versions FOR ALL USING (auth.role() = 'service_role');


-- ==========================================
-- Migration: 084_super_admins.sql
-- ==========================================
-- ============================================================
-- OccasionPro — Migration 084: Super Admins Table
--
-- Platform-level super admin table.
-- Guards check: super_admins WHERE user_id = auth.uid() AND is_active = true
--
-- Referenced by:
--   workspace-role.guard.ts  — .eq('user_id', userId)
--   event-access.guard.ts    — .eq('user_id', userId)
--   041_platform_settings.sql — RLS policies
-- ============================================================

-- ── super_admins ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS super_admins (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  full_name   text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT super_admins_user_id_unique UNIQUE (user_id),
  CONSTRAINT super_admins_email_unique   UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_super_admins_user_id   ON super_admins(user_id)  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_super_admins_email     ON super_admins(email);

COMMENT ON TABLE super_admins IS
  'Platform-level super admin accounts. Users in this table bypass all tenant role checks.';

COMMENT ON COLUMN super_admins.user_id IS
  'Maps to auth.users.id — used by workspace-role.guard and event-access.guard.';

-- ── RLS ───────────────────────────────────────────────────

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Super admins can read their own record
CREATE POLICY "super_admins_self_read"
  ON super_admins FOR SELECT
  USING (user_id = auth.uid());

-- Only existing super admins can manage this table (via service role in practice)
CREATE POLICY "super_admins_service_all"
  ON super_admins FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM super_admins sa
      WHERE sa.user_id = auth.uid() AND sa.is_active = true
    )
  );


-- ==========================================
-- Migration: 085_event_budget_contingency.sql
-- ==========================================
-- ============================================================
-- Migration 085: Event Budget Items & Contingency Plans
-- ============================================================
-- Creates event-scoped tables for:
--   1. event_budget_items  — per-event budget line items with status tracking
--   2. event_contingency_plans — crisis/scenario plans with risk levels
-- Both tables are multi-tenant (tenant_id) and RLS-protected.
-- ============================================================

-- ── 1. event_budget_items ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_budget_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Category grouping (matches UI: Venue, Catering, AV/Tech, Décor, etc.)
  category_id      TEXT        NOT NULL DEFAULT 'other',
  category_name    TEXT        NOT NULL DEFAULT 'Other',

  -- Line item details
  description      TEXT        NOT NULL,
  estimated_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_amount    NUMERIC(14,2) DEFAULT 0,

  -- Approval/payment lifecycle
  status           TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','paid','overbudget')),

  -- Optional metadata
  vendor_name      TEXT,
  notes            TEXT,
  paid_at          TIMESTAMPTZ,

  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_budget_items_event
  ON event_budget_items (event_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_event_budget_items_tenant
  ON event_budget_items (tenant_id);

CREATE INDEX IF NOT EXISTS idx_event_budget_items_status
  ON event_budget_items (status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_event_budget_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_budget_items_updated_at ON event_budget_items;
CREATE TRIGGER trg_event_budget_items_updated_at
  BEFORE UPDATE ON event_budget_items
  FOR EACH ROW EXECUTE FUNCTION update_event_budget_items_updated_at();

-- RLS
ALTER TABLE event_budget_items ENABLE ROW LEVEL SECURITY;

-- Tenant isolation: users can only see/modify items for their own tenant
CREATE POLICY "event_budget_items_tenant_isolation"
  ON event_budget_items
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Service role bypass for server-side operations
CREATE POLICY "event_budget_items_service_role"
  ON event_budget_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── 2. event_contingency_plans ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_contingency_plans (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Scenario identification
  scenario            TEXT        NOT NULL,
  category            TEXT        NOT NULL DEFAULT 'general',

  -- Risk classification
  risk_level          TEXT        NOT NULL DEFAULT 'medium'
                      CHECK (risk_level IN ('low','medium','high','critical')),

  -- Plan content (stored as text; may contain newline-separated action steps)
  trigger_conditions  TEXT,
  response_actions    TEXT,

  -- Ownership
  responsible_person  TEXT,
  contact_number      TEXT,

  -- Lifecycle
  status              TEXT        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','reviewed','activated')),

  reviewed_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  activated_at        TIMESTAMPTZ,

  created_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_contingency_plans_event
  ON event_contingency_plans (event_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_event_contingency_plans_tenant
  ON event_contingency_plans (tenant_id);

CREATE INDEX IF NOT EXISTS idx_event_contingency_plans_risk
  ON event_contingency_plans (risk_level);

CREATE INDEX IF NOT EXISTS idx_event_contingency_plans_status
  ON event_contingency_plans (status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_event_contingency_plans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_contingency_plans_updated_at ON event_contingency_plans;
CREATE TRIGGER trg_event_contingency_plans_updated_at
  BEFORE UPDATE ON event_contingency_plans
  FOR EACH ROW EXECUTE FUNCTION update_event_contingency_plans_updated_at();

-- RLS
ALTER TABLE event_contingency_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_contingency_plans_tenant_isolation"
  ON event_contingency_plans
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "event_contingency_plans_service_role"
  ON event_contingency_plans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── 3. Comments ───────────────────────────────────────────────────────────────
COMMENT ON TABLE event_budget_items IS
  'Per-event budget line items with category grouping, estimated vs actual amounts, and approval status tracking.';

COMMENT ON TABLE event_contingency_plans IS
  'Crisis scenario contingency plans for events, including trigger conditions, response actions, risk classification, and activation lifecycle.';


-- ==========================================
-- Migration: 086_data_retention_policies.sql
-- ==========================================
-- ============================================================================
-- Migration 086: Data Retention Policies
-- OccasionPro — DPDP compliance: configurable data lifecycle rules per tenant
-- ============================================================================

-- ─── data_retention_policies ─────────────────────────────────────────────────
-- Defines how long different categories of personal data are retained.
-- Required by DPDP Act 2023 (India) and GDPR for data minimisation compliance.

CREATE TABLE IF NOT EXISTS data_retention_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  data_category         TEXT NOT NULL,
  -- e.g. 'guest_profiles', 'event_records', 'payment_data',
  --      'communications', 'audit_logs', 'consent_records',
  --      'support_tickets', 'vendor_data', 'media_files'

  display_name          TEXT NOT NULL,
  description           TEXT,

  retention_period_days INT NOT NULL DEFAULT 365,
  -- 0 means "retain until manually deleted"

  legal_basis           TEXT,
  -- e.g. 'DPDP Act 2023 s.8', 'GDPR Art.17', 'Contractual obligation'

  auto_purge_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  -- If true, expired records are automatically anonymised or deleted

  purge_action          TEXT NOT NULL DEFAULT 'anonymise'
                          CHECK (purge_action IN ('anonymise', 'delete', 'archive')),

  last_purge_at         TIMESTAMPTZ,
  next_purge_at         TIMESTAMPTZ,   -- computed from last_purge + retention_period_days

  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  notes                 TEXT,

  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, data_category)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_retention_policies_tenant
  ON data_retention_policies (tenant_id);

CREATE INDEX IF NOT EXISTS idx_retention_policies_active
  ON data_retention_policies (tenant_id, is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_retention_policies_purge
  ON data_retention_policies (next_purge_at)
  WHERE auto_purge_enabled = TRUE AND is_active = TRUE;

-- ─── updated_at trigger ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_retention_policies_updated_at'
  ) THEN
    CREATE TRIGGER set_retention_policies_updated_at
      BEFORE UPDATE ON data_retention_policies
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;

-- Service role bypasses all RLS (for automation jobs and admin operations)
CREATE POLICY "service_role_all_retention_policies"
  ON data_retention_policies FOR ALL
  USING (auth.role() = 'service_role');

-- Tenant isolation: authenticated users can only read their own tenant's policies
CREATE POLICY "tenant_isolation_retention_policies"
  ON data_retention_policies FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Only workspace owners / admins can manage retention policies (via service role in practice)
CREATE POLICY "tenant_manage_retention_policies"
  ON data_retention_policies FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "tenant_update_retention_policies"
  ON data_retention_policies FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── Default retention policies (seeded for all new tenants via trigger) ─────
-- When a new workspace is created, populate sensible defaults.
-- These are SUGGESTED defaults; tenants can modify them.

CREATE OR REPLACE FUNCTION seed_default_retention_policies(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO data_retention_policies
    (tenant_id, data_category, display_name, description, retention_period_days, legal_basis, auto_purge_enabled, purge_action)
  VALUES
    (p_tenant_id, 'guest_profiles',    'Guest Profiles',          'Name, email, phone of event guests',               90,   'DPDP Act 2023 s.8(3)',    FALSE, 'anonymise'),
    (p_tenant_id, 'event_records',     'Event Records',           'Event details, schedules, runsheets',              1825, 'Contractual obligation',  FALSE, 'archive'),
    (p_tenant_id, 'payment_data',      'Payment & Invoice Data',  'Invoices, receipts, payment records',              2555, 'Income Tax Act 1961',     FALSE, 'archive'),
    (p_tenant_id, 'communications',    'Communications',          'Messages, emails, WhatsApp sent via platform',     365,  'DPDP Act 2023 s.8',       FALSE, 'delete'),
    (p_tenant_id, 'audit_logs',        'Audit Logs',              'User actions, system events',                      730,  'Security best practice',  FALSE, 'archive'),
    (p_tenant_id, 'consent_records',   'Consent Records',         'DPDP consent timestamps and text',                 1825, 'DPDP Act 2023 s.6',       FALSE, 'archive'),
    (p_tenant_id, 'support_tickets',   'Support Tickets',         'Help desk conversations',                          365,  'Service obligation',      FALSE, 'delete'),
    (p_tenant_id, 'vendor_data',       'Vendor Data',             'Vendor profiles, contracts, performance records',  1095, 'Contractual obligation',  FALSE, 'anonymise'),
    (p_tenant_id, 'media_files',       'Media & Documents',       'Photos, videos, PDFs uploaded to the platform',   365,  'Storage policy',          FALSE, 'delete')
  ON CONFLICT (tenant_id, data_category) DO NOTHING;
END;
$$;

-- ─── Comment ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE data_retention_policies IS
  'DPDP / GDPR data lifecycle rules. Each row defines how long a category of personal data is kept and what happens when it expires. The auto_purge_enabled flag activates scheduled anonymisation or deletion jobs.';


-- ==========================================
-- Migration: 087_profiles_user_fields.sql
-- ==========================================
-- ============================================================================
-- Migration 087: Extend profiles with user-facing fields
-- OccasionPro — Aligns profiles table with NestJS service expectations.
--
-- Services written against a `users` table that has email, role, and status.
-- profiles already has id (= auth.users.id), full_name, tenant_id.
-- This migration adds the three missing columns so services can work with
-- profiles directly without a separate users table.
-- ============================================================================

-- ─── Add columns ─────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS role         TEXT NOT NULL DEFAULT 'team_member',
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended', 'invited'));

-- Index for email lookups (membership checks, invitation deduplication)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);

-- Index for tenant + status (count active members per tenant)
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_status ON profiles (tenant_id, status)
  WHERE status = 'active';

-- ─── Back-fill email from auth.users ─────────────────────────────────────────
-- Runs once at migration time to populate existing rows.
-- New rows are kept in sync via the trigger below.

UPDATE profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id
  AND p.email IS NULL;

-- ─── Trigger: keep profiles.email in sync with auth.users ────────────────────

CREATE OR REPLACE FUNCTION sync_profile_email_on_user_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Called on INSERT or UPDATE of auth.users
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
    SET email     = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  RETURN NEW;
END;
$$;

-- Replace the existing on_auth_user_created trigger with the new version
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_profile_email_on_user_create();

-- ─── RLS: profiles can read their own email ───────────────────────────────────
-- Existing RLS policies on profiles remain. No new ones needed —
-- service role bypasses all RLS for server-side queries.

-- ─── Comment ─────────────────────────────────────────────────────────────────
COMMENT ON COLUMN profiles.email IS
  'Denormalized from auth.users.email. Kept in sync by on_auth_user_created trigger. Used for membership lookups and invitation deduplication.';

COMMENT ON COLUMN profiles.role IS
  'Primary workspace role for this profile (owner | event_manager | team_lead | team_member). Detailed per-tenant role assignments live in user_roles.';

COMMENT ON COLUMN profiles.status IS
  'Account status: active | inactive | suspended | invited.';


-- ==========================================
-- Migration: 088_vendor_quotes.sql
-- ==========================================
-- ============================================================
-- Migration 088: Vendor Quotes
-- Allows vendors to submit price quotes against their
-- event assignments. Staff can review and approve/reject.
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_quotes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id       uuid NOT NULL REFERENCES vendor_event_assignments(id) ON DELETE CASCADE,
  vendor_id           uuid NOT NULL REFERENCES vendor_accounts(id) ON DELETE CASCADE,

  -- Quote details
  service_description text NOT NULL CHECK (length(service_description) > 0),
  amount              numeric(14,2) NOT NULL CHECK (amount > 0),
  currency_code       text NOT NULL DEFAULT 'INR',
  notes               text,
  file_url            text,           -- attached quote document

  -- Lifecycle
  status              text NOT NULL DEFAULT 'submitted'
                      CHECK (status IN ('submitted','under_review','approved','rejected','withdrawn')),

  -- Staff review
  review_note         text,
  reviewed_by         uuid REFERENCES profiles(id),
  reviewed_at         timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_quotes_assignment ON vendor_quotes(assignment_id);
CREATE INDEX IF NOT EXISTS idx_vendor_quotes_vendor     ON vendor_quotes(vendor_id, status);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE vendor_quotes ENABLE ROW LEVEL SECURITY;

-- Vendor portal API uses service-role key — no RLS needed for vendor reads/writes.
-- Tenant staff (JWT auth) can manage quotes for their own assignments.
CREATE POLICY "tenant_manage_vendor_quotes" ON vendor_quotes
  USING (
    assignment_id IN (
      SELECT id FROM vendor_event_assignments
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_vendor_quotes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_quotes_updated_at ON vendor_quotes;
CREATE TRIGGER trg_vendor_quotes_updated_at
  BEFORE UPDATE ON vendor_quotes
  FOR EACH ROW EXECUTE FUNCTION set_vendor_quotes_updated_at();


-- ==========================================
-- Migration: 089_missing_tables.sql
-- ==========================================
-- ============================================================
-- Migration 089: Missing tables referenced by application code
-- Adds: used_webhook_nonces, tenant_onboarding, event_media
-- Adds view: fnb_token_summary
-- ============================================================

-- ── Webhook replay-protection nonces ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS used_webhook_nonces (
  id         bigserial PRIMARY KEY,
  nonce      text        NOT NULL UNIQUE,
  source     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_nonces_nonce      ON used_webhook_nonces(nonce);
CREATE INDEX IF NOT EXISTS idx_webhook_nonces_created_at ON used_webhook_nonces(created_at);

-- Auto-purge nonces older than 24 hours (keeps the table small)
-- Requires pg_cron extension (enabled by default on Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-webhook-nonces',
      '0 * * * *',            -- every hour
      $$DELETE FROM used_webhook_nonces WHERE created_at < now() - interval '24 hours'$$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not available; nonces will be purged by application logic
  NULL;
END $$;

-- RLS: service-role only (webhook security service uses serviceClient)
ALTER TABLE used_webhook_nonces ENABLE ROW LEVEL SECURITY;
-- No tenant-scoped policy; only server-side code accesses this table via service key

-- ── Tenant onboarding progress ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_onboarding (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  step        text        NOT NULL,
  completed   boolean     NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, step)
);

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_tenant ON tenant_onboarding(tenant_id);

ALTER TABLE tenant_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_own_onboarding" ON tenant_onboarding
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── Event media (photo/video gallery for guest portal) ───────────────────────
CREATE TABLE IF NOT EXISTS event_media (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  url           text        NOT NULL,
  thumbnail_url text,
  type          text        NOT NULL DEFAULT 'photo' CHECK (type IN ('photo', 'video', 'reel')),
  caption       text,
  taken_at      timestamptz,
  is_public     boolean     NOT NULL DEFAULT true,
  uploaded_by   uuid        REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_media_event   ON event_media(event_id, is_public);
CREATE INDEX IF NOT EXISTS idx_event_media_tenant  ON event_media(tenant_id);

ALTER TABLE event_media ENABLE ROW LEVEL SECURITY;

-- Staff can manage; public portal reads only public items (guest portal uses service key)
CREATE POLICY "tenant_manage_event_media" ON event_media
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── F&B token summary view ───────────────────────────────────────────────────
-- Aggregated totals per event, used by the export PDF report
CREATE OR REPLACE VIEW fnb_token_summary AS
SELECT
  b.event_id,
  b.tenant_id,
  SUM(b.quantity)         AS total_issued,
  SUM(b.tokens_redeemed)  AS total_redeemed,
  SUM(b.quantity * mi.price) AS total_revenue
FROM fnb_token_batches b
LEFT JOIN fnb_menu_items mi ON mi.id = b.menu_item_id
GROUP BY b.event_id, b.tenant_id;


-- ==========================================
-- Migration: 20240120_tenant_branding.sql
-- ==========================================
-- ─────────────────────────────────────────────────────────────────────────────
-- tenant_branding — per-tenant white-label design token storage
-- Each row holds the full CSS variable set for one tenant.
-- Super Admin can set platform-wide defaults (tenant_id IS NULL) 
-- or override per tenant.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_branding (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE,  -- NULL = platform default
  -- Core palette (stored as raw HSL channels, e.g. "263 72% 58%")
  primary_hsl         TEXT NOT NULL DEFAULT '263 72% 58%',   -- violet
  secondary_hsl       TEXT NOT NULL DEFAULT '38 92% 50%',    -- gold
  accent_hsl          TEXT NOT NULL DEFAULT '25 95% 53%',    -- coral
  danger_hsl          TEXT NOT NULL DEFAULT '0 84% 60%',
  success_hsl         TEXT NOT NULL DEFAULT '160 84% 39%',
  info_hsl            TEXT NOT NULL DEFAULT '199 89% 48%',
  -- Surfaces (light)
  background_light_hsl TEXT NOT NULL DEFAULT '0 0% 98%',
  card_light_hsl       TEXT NOT NULL DEFAULT '0 0% 100%',
  border_light_hsl     TEXT NOT NULL DEFAULT '220 13% 91%',
  -- Surfaces (dark)
  background_dark_hsl  TEXT NOT NULL DEFAULT '240 14% 7%',
  card_dark_hsl        TEXT NOT NULL DEFAULT '240 13% 10%',
  border_dark_hsl      TEXT NOT NULL DEFAULT '240 10% 22%',
  -- Brand assets
  logo_url            TEXT,
  favicon_url         TEXT,
  -- Typography
  font_family         TEXT NOT NULL DEFAULT 'Inter',
  font_url            TEXT,                                   -- Google Fonts embed URL
  -- Shape
  border_radius       TEXT NOT NULL DEFAULT 'default',       -- 'sharp'|'default'|'rounded'|'pill'
  -- Defaults
  dark_mode_default   BOOLEAN NOT NULL DEFAULT true,
  -- Meta
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)   -- one branding row per tenant (NULL = platform)
);

-- Row-level security
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;

-- Super admins can read/write all rows
CREATE POLICY "super_admin_full_access" ON public.tenant_branding
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

-- Tenant members can read their own branding
CREATE POLICY "tenant_member_read" ON public.tenant_branding
  FOR SELECT
  USING (
    tenant_id IS NULL  -- platform default is public
    OR tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS tenant_branding_updated_at ON public.tenant_branding;
CREATE TRIGGER tenant_branding_updated_at
  BEFORE UPDATE ON public.tenant_branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed platform-wide defaults (tenant_id = NULL)
INSERT INTO public.tenant_branding (tenant_id) VALUES (NULL)
ON CONFLICT (tenant_id) DO NOTHING;


