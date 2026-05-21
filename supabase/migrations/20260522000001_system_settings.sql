-- Migration: system_settings table for super-admin managed API keys
-- Drop in: supabase/migrations/20260522000001_system_settings.sql

CREATE TABLE IF NOT EXISTS system_settings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        UNIQUE NOT NULL,
  value       TEXT,                          -- store encrypted at app layer
  description TEXT,
  category    TEXT        NOT NULL DEFAULT 'general',
  is_sensitive BOOLEAN    NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_settings_category ON system_settings (category);
CREATE INDEX idx_system_settings_key      ON system_settings (key);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_system_settings_updated_at();

-- RLS: only super_admins table members may read or write
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_select" ON system_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id  = auth.uid()
        AND super_admins.is_active = true
    )
  );

CREATE POLICY "super_admin_insert" ON system_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id  = auth.uid()
        AND super_admins.is_active = true
    )
  );

CREATE POLICY "super_admin_update" ON system_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id  = auth.uid()
        AND super_admins.is_active = true
    )
  );

-- Seed default keys (values NULL until set by super admin)
INSERT INTO system_settings (key, description, category, is_sensitive) VALUES
  ('razorpay_key_id',     'Razorpay API Key ID (public)',     'payments', FALSE),
  ('razorpay_key_secret', 'Razorpay API Key Secret',          'payments', TRUE),
  ('resend_api_key',      'Resend transactional email key',   'email',    TRUE),
  ('openai_api_key',      'OpenAI API key',                   'ai',       TRUE),
  ('jwt_secret',          'JWT signing secret',               'auth',     TRUE),
  ('short_link_base_url', 'Base URL for short links',         'general',  FALSE)
ON CONFLICT (key) DO NOTHING;
