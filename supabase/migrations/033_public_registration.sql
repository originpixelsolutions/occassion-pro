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
