-- ============================================================
-- Migration: 011_ai_and_platform.sql
-- ============================================================
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

-- ============================================================
-- Migration: 012_rls_policies.sql
-- ============================================================
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

-- ============================================================
-- Migration: 013_guest_portal_and_realtime.sql
-- ============================================================
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

-- ============================================================
-- Migration: 014_vendor_portal.sql
-- ============================================================
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

-- ============================================================
-- Migration: 015_super_admin.sql
-- ============================================================
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

-- ============================================================
-- Migration: 016_command_center.sql
-- ============================================================
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

-- ============================================================
-- Migration: 017_production.sql
-- ============================================================
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

-- ============================================================
-- Migration: 018_hospitality.sql
-- ============================================================
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

-- ============================================================
-- Migration: 019_artist_management.sql
-- ============================================================
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

-- ============================================================
-- Migration: 020_client_portal.sql
-- ============================================================
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

