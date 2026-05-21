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
