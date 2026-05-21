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
