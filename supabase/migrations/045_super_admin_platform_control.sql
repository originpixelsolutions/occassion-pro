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
