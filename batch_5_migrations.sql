-- ============================================================
-- Migration: 041_platform_settings.sql
-- ============================================================
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

-- ============================================================
-- Migration: 042_printing_stationery.sql
-- ============================================================
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

-- ============================================================
-- Migration: 043_feedback_surveys.sql
-- ============================================================
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
  guest_id        UUID REFERENCES event_guests(id),
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

-- ============================================================
-- Migration: 044_health_safety.sql
-- ============================================================
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

-- ============================================================
-- Migration: 045_super_admin_platform_control.sql
-- ============================================================
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

-- ============================================================
-- Migration: 046_payment_multi_provider.sql
-- ============================================================
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
COMMENT ON COLUMN tenant_payment_config
-- ============================================================
-- Migration: 047_realtime_cross_module_triggers.sql
-- ============================================================
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
  ADD COLUMN IF NOT EXISTS accommodation_room_id uuid REFERENCES accommodation_rooms(id) ON DELETE SET NULL,
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
  ADD COLUMN IF NOT EXISTS depends_on_task_id uuid REFERENCES runsheet_tasks(id) ON DELETE SET NULL,
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

-- ============================================================
-- Migration: 048_guest_portal.sql
-- ============================================================
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

-- ============================================================
-- Migration: 049_client_vendor_portals.sql
-- ============================================================
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
  invited_by           uuid REFERENCES users(id) ON DELETE SET NULL,
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
  submitted_by    uuid REFERENCES users(id) ON DELETE SET NULL,
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
  assigned_by         uuid REFERENCES users(id) ON DELETE SET NULL,
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
  created_by            uuid REFERENCES users(id) ON DELETE SET NULL,
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
  reviewed_by       uuid REFERENCES users(id) ON DELETE SET NULL,
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
  rated_by          uuid REFERENCES users(id) ON DELETE SET NULL,
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


-- ============================================================
-- Migration: 050_vendor_portal_tables.sql
-- ============================================================
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

