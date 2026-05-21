-- ============================================================
-- Migration 093: Enhanced Public Microsite v2
-- ============================================================
-- Extends the existing event microsite with:
--   • Speaker profiles (bio, photo, social links)
--   • Full schedule grid (day, start_time, end_time, stage, speaker)
--   • Sponsor tiers (platinum / gold / silver / community)
--   • FAQ entries
--   • Microsite settings (theme, custom domain, Razorpay embed, tracking)
-- ============================================================

-- ── Speaker profiles ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS microsite_speakers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Identity
  name            TEXT NOT NULL,
  title           TEXT,                  -- e.g. "CEO at Acme Corp"
  company         TEXT,
  bio             TEXT,
  photo_url       TEXT,

  -- Social
  linkedin_url    TEXT,
  twitter_url     TEXT,
  website_url     TEXT,

  -- Display
  display_order   INT NOT NULL DEFAULT 0,
  is_keynote      BOOLEAN NOT NULL DEFAULT FALSE,
  is_published    BOOLEAN NOT NULL DEFAULT TRUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ms_speakers_event  ON microsite_speakers(event_id);
CREATE INDEX idx_ms_speakers_tenant ON microsite_speakers(tenant_id);

-- ── Schedule sessions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS microsite_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  speaker_id      UUID REFERENCES microsite_speakers(id) ON DELETE SET NULL,

  -- Session
  title           TEXT NOT NULL,
  description     TEXT,
  session_type    TEXT DEFAULT 'talk',   -- 'talk' | 'workshop' | 'panel' | 'break' | 'networking' | 'keynote'
  stage           TEXT,                  -- e.g. "Main Stage", "Workshop Room A"

  -- Timing
  session_date    DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,

  -- Meta
  tags            TEXT[] DEFAULT '{}',
  is_published    BOOLEAN NOT NULL DEFAULT TRUE,
  display_order   INT NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ms_sessions_event ON microsite_sessions(event_id);
CREATE INDEX idx_ms_sessions_date  ON microsite_sessions(event_id, session_date);

-- ── Sponsors ──────────────────────────────────────────────────────────────────

CREATE TYPE sponsor_tier AS ENUM ('platinum', 'gold', 'silver', 'bronze', 'community', 'media');

CREATE TABLE IF NOT EXISTS microsite_sponsors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  logo_url        TEXT,
  website_url     TEXT,
  tier            sponsor_tier NOT NULL DEFAULT 'silver',
  tagline         TEXT,

  display_order   INT NOT NULL DEFAULT 0,
  is_published    BOOLEAN NOT NULL DEFAULT TRUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ms_sponsors_event ON microsite_sponsors(event_id);

-- ── FAQ entries ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS microsite_faqs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  question        TEXT NOT NULL,
  answer          TEXT NOT NULL,
  display_order   INT NOT NULL DEFAULT 0,
  is_published    BOOLEAN NOT NULL DEFAULT TRUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ms_faqs_event ON microsite_faqs(event_id);

-- ── Microsite settings (extends / replaces the old microsites table) ──────────

CREATE TABLE IF NOT EXISTS microsite_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Branding
  theme           TEXT NOT NULL DEFAULT 'dark',  -- 'dark' | 'light' | 'brand'
  accent_color    TEXT DEFAULT '#8B5CF6',
  hero_image_url  TEXT,
  logo_url        TEXT,

  -- Sections enabled
  show_speakers   BOOLEAN NOT NULL DEFAULT TRUE,
  show_schedule   BOOLEAN NOT NULL DEFAULT TRUE,
  show_sponsors   BOOLEAN NOT NULL DEFAULT TRUE,
  show_faq        BOOLEAN NOT NULL DEFAULT TRUE,
  show_map        BOOLEAN NOT NULL DEFAULT TRUE,

  -- Registration
  registration_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  registration_fee_paise  INT DEFAULT 0,               -- 0 = free
  razorpay_key_id         TEXT,                        -- override tenant default
  max_registrations       INT,                         -- null = unlimited
  registration_deadline   TIMESTAMPTZ,

  -- Custom domain
  custom_domain   TEXT,                               -- e.g. 'event.acmecorp.com'
  slug_override   TEXT,                               -- override auto-generated slug

  -- SEO / Social
  meta_title      TEXT,
  meta_description TEXT,
  og_image_url    TEXT,
  twitter_handle  TEXT,

  -- Tracking
  ga4_measurement_id  TEXT,
  fb_pixel_id         TEXT,

  -- Display
  countdown_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  hero_cta_label      TEXT DEFAULT 'Register Now',
  hero_cta_url        TEXT,

  -- Status
  is_published    BOOLEAN NOT NULL DEFAULT FALSE,
  published_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (event_id)
);

CREATE INDEX idx_ms_settings_event  ON microsite_settings(event_id);
CREATE INDEX idx_ms_settings_tenant ON microsite_settings(tenant_id);
CREATE INDEX idx_ms_settings_domain ON microsite_settings(custom_domain) WHERE custom_domain IS NOT NULL;

-- ── Registrations (ticket purchases via microsite) ────────────────────────────

CREATE TYPE microsite_reg_status AS ENUM (
  'pending_payment', 'confirmed', 'cancelled', 'refunded'
);

CREATE TABLE IF NOT EXISTS microsite_registrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id            UUID REFERENCES guest_details(id) ON DELETE SET NULL,

  -- Registrant details
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  company             TEXT,
  designation         TEXT,
  dietary             TEXT,

  -- Payment
  amount_paise        INT NOT NULL DEFAULT 0,
  payment_method      TEXT,
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,
  status              microsite_reg_status NOT NULL DEFAULT 'pending_payment',

  -- QR / check-in
  qr_code             TEXT,                  -- unique check-in token
  checked_in_at       TIMESTAMPTZ,

  -- Meta
  utm_source          TEXT,
  utm_medium          TEXT,
  utm_campaign        TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ms_reg_event   ON microsite_registrations(event_id);
CREATE INDEX idx_ms_reg_email   ON microsite_registrations(email);
CREATE INDEX idx_ms_reg_status  ON microsite_registrations(status);
CREATE INDEX idx_ms_reg_qr      ON microsite_registrations(qr_code) WHERE qr_code IS NOT NULL;

-- ── Triggers: updated_at ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_microsite_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_ms_speakers_upd  BEFORE UPDATE ON microsite_speakers    FOR EACH ROW EXECUTE FUNCTION update_microsite_updated_at();
CREATE TRIGGER trg_ms_sessions_upd  BEFORE UPDATE ON microsite_sessions    FOR EACH ROW EXECUTE FUNCTION update_microsite_updated_at();
CREATE TRIGGER trg_ms_settings_upd  BEFORE UPDATE ON microsite_settings    FOR EACH ROW EXECUTE FUNCTION update_microsite_updated_at();
CREATE TRIGGER trg_ms_reg_upd       BEFORE UPDATE ON microsite_registrations FOR EACH ROW EXECUTE FUNCTION update_microsite_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE microsite_speakers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsite_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsite_sponsors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsite_faqs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsite_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsite_registrations  ENABLE ROW LEVEL SECURITY;

-- Staff can manage their tenant's microsite data
CREATE POLICY ms_speakers_tenant      ON microsite_speakers      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY ms_sessions_tenant      ON microsite_sessions      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY ms_sponsors_tenant      ON microsite_sponsors      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY ms_faqs_tenant          ON microsite_faqs          USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY ms_settings_tenant      ON microsite_settings      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY ms_registrations_tenant ON microsite_registrations USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Public read for published content (needed for the public-facing microsite)
CREATE POLICY ms_speakers_public ON microsite_speakers
  FOR SELECT USING (is_published = TRUE);

CREATE POLICY ms_sessions_public ON microsite_sessions
  FOR SELECT USING (is_published = TRUE);

CREATE POLICY ms_sponsors_public ON microsite_sponsors
  FOR SELECT USING (is_published = TRUE);

CREATE POLICY ms_faqs_public ON microsite_faqs
  FOR SELECT USING (is_published = TRUE);

CREATE POLICY ms_settings_public ON microsite_settings
  FOR SELECT USING (is_published = TRUE);

-- Public insert for registrations
CREATE POLICY ms_registrations_insert ON microsite_registrations
  FOR INSERT WITH CHECK (TRUE);

-- ── Realtime ──────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE microsite_registrations;
ALTER PUBLICATION supabase_realtime ADD TABLE microsite_settings;
