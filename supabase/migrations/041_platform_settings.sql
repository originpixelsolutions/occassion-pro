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
