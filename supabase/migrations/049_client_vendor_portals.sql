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

