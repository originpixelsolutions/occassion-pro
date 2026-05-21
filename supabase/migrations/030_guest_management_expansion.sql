-- ============================================================
-- OccasionPro — Guest Management Expansion (Migration 030)
-- Covers: invitations, RSVP, accommodation, import batches
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── INVITATION SYSTEM ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invitation_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  is_global       BOOLEAN DEFAULT FALSE,     -- saved as reusable template across events
  -- Section visibility flags
  show_banner         BOOLEAN DEFAULT TRUE,
  show_event_name     BOOLEAN DEFAULT TRUE,
  show_tagline        BOOLEAN DEFAULT TRUE,
  show_datetime       BOOLEAN DEFAULT TRUE,
  show_venue          BOOLEAN DEFAULT TRUE,
  show_dress_code     BOOLEAN DEFAULT FALSE,
  show_host_message   BOOLEAN DEFAULT FALSE,
  show_schedule       BOOLEAN DEFAULT FALSE,
  show_rsvp_button    BOOLEAN DEFAULT TRUE,
  show_contact        BOOLEAN DEFAULT FALSE,
  show_social_links   BOOLEAN DEFAULT FALSE,
  show_footer         BOOLEAN DEFAULT FALSE,
  -- Content
  banner_url          TEXT,
  tagline             TEXT,
  host_message        TEXT,
  schedule_preview    JSONB DEFAULT '[]',    -- [{time, title}]
  rsvp_deadline       TIMESTAMPTZ,
  contact_name        TEXT,
  contact_phone       TEXT,
  contact_email       TEXT,
  social_links        JSONB DEFAULT '{}',    -- {instagram, facebook, twitter, ...}
  footer_message      TEXT,
  -- Design
  layout_template     TEXT DEFAULT 'elegant'  CHECK (layout_template IN ('elegant','modern','minimal','festive','corporate')),
  base_theme          TEXT DEFAULT 'dark'      CHECK (base_theme IN ('light','dark')),
  primary_color       TEXT DEFAULT '#6366f1',
  secondary_color     TEXT DEFAULT '#f59e0b',
  background_color    TEXT DEFAULT '#0f172a',
  text_color          TEXT DEFAULT '#f8fafc',
  accent_color        TEXT DEFAULT '#e11d48',
  button_color        TEXT DEFAULT '#6366f1',
  button_text_color   TEXT DEFAULT '#ffffff',
  button_style        TEXT DEFAULT 'rounded'   CHECK (button_style IN ('sharp','rounded','pill')),
  font_family         TEXT DEFAULT 'Inter',
  font_size_base      INTEGER DEFAULT 16,
  logo_url            TEXT,
  logo_placement      TEXT DEFAULT 'top-center' CHECK (logo_placement IN ('top-left','top-center','top-right')),
  border_style        TEXT DEFAULT 'none'       CHECK (border_style IN ('none','thin','thick','double','shadow','rounded')),
  border_radius       TEXT DEFAULT 'default'    CHECK (border_radius IN ('sharp','default','rounded','pill')),
  background_type     TEXT DEFAULT 'solid'      CHECK (background_type IN ('solid','gradient','pattern','image')),
  background_image_url TEXT,
  section_spacing     TEXT DEFAULT 'normal'     CHECK (section_spacing IN ('compact','normal','spacious')),
  watermark_text      TEXT,
  watermark_opacity   NUMERIC(3,2) DEFAULT 0.0 CHECK (watermark_opacity BETWEEN 0 AND 1),
  -- Meta
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invitations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_id       UUID REFERENCES invitation_templates(id) ON DELETE SET NULL,
  guest_id          UUID REFERENCES guests(id) ON DELETE CASCADE,
  -- Unique token for guest-personalised link
  token             TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  personalised_url  TEXT,           -- set after generation: /i/[token]
  -- Status tracking
  status            TEXT DEFAULT 'draft'
                      CHECK (status IN ('draft','sent','delivered','opened','bounced','failed')),
  channel           TEXT DEFAULT 'email'
                      CHECK (channel IN ('email','whatsapp','sms','link')),
  sent_at           TIMESTAMPTZ,
  opened_at         TIMESTAMPTZ,
  opened_count      INTEGER DEFAULT 0,
  scheduled_at      TIMESTAMPTZ,       -- for scheduled sends
  -- Personalisation merge data
  merge_data        JSONB DEFAULT '{}', -- {guest_name, table_number, plus_one, ...}
  -- Meta
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_event    ON invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_invitations_guest    ON invitations(guest_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token    ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status   ON invitations(status);

-- ─── RSVP SYSTEM ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rsvp_forms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name                TEXT NOT NULL DEFAULT 'RSVP Form',
  -- Public access
  public_slug         TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  is_active           BOOLEAN DEFAULT TRUE,
  deadline            TIMESTAMPTZ,
  max_responses       INTEGER,          -- capacity cap (NULL = unlimited)
  password_protected  BOOLEAN DEFAULT FALSE,
  password_hash       TEXT,
  moderation_enabled  BOOLEAN DEFAULT FALSE,  -- require admin approval
  -- Section visibility flags
  show_attendance         BOOLEAN DEFAULT TRUE,   -- always on; required
  show_plus_one           BOOLEAN DEFAULT TRUE,
  show_meal_preference    BOOLEAN DEFAULT TRUE,
  show_dietary            BOOLEAN DEFAULT TRUE,
  show_accommodation      BOOLEAN DEFAULT FALSE,
  show_transport          BOOLEAN DEFAULT FALSE,
  show_tshirt_size        BOOLEAN DEFAULT FALSE,
  show_emergency_contact  BOOLEAN DEFAULT FALSE,
  show_message_to_host    BOOLEAN DEFAULT FALSE,
  -- Design (mirrors invitation_templates)
  layout_template     TEXT DEFAULT 'modern'  CHECK (layout_template IN ('elegant','modern','minimal','festive','corporate')),
  base_theme          TEXT DEFAULT 'light'   CHECK (base_theme IN ('light','dark')),
  primary_color       TEXT DEFAULT '#6366f1',
  background_color    TEXT DEFAULT '#ffffff',
  text_color          TEXT DEFAULT '#0f172a',
  button_color        TEXT DEFAULT '#6366f1',
  button_text_color   TEXT DEFAULT '#ffffff',
  font_family         TEXT DEFAULT 'Inter',
  logo_url            TEXT,
  logo_placement      TEXT DEFAULT 'top-center',
  border_radius       TEXT DEFAULT 'default',
  -- Thank-you page
  thankyou_message    TEXT DEFAULT 'Thank you for your RSVP!',
  thankyou_redirect_url TEXT,
  -- Meta
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rsvp_custom_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       UUID NOT NULL REFERENCES rsvp_forms(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('text','textarea','dropdown','checkbox','date','number')),
  options       JSONB DEFAULT '[]',  -- for dropdown/checkbox options
  is_required   BOOLEAN DEFAULT FALSE,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rsvp_responses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  form_id               UUID NOT NULL REFERENCES rsvp_forms(id) ON DELETE CASCADE,
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id              UUID REFERENCES guests(id) ON DELETE SET NULL,
  -- Core attendance
  attendance            TEXT NOT NULL CHECK (attendance IN ('yes','maybe','no')),
  -- Plus one
  plus_one_name         TEXT,
  plus_one_dietary      TEXT,
  -- Meal
  meal_preference       TEXT CHECK (meal_preference IN ('veg','non_veg','vegan','jain','halal','kosher','gluten_free','custom')),
  dietary_notes         TEXT,
  -- Accommodation
  accommodation_needed  BOOLEAN DEFAULT FALSE,
  accom_checkin_date    DATE,
  accom_checkout_date   DATE,
  accom_room_type       TEXT,
  accom_special_requests TEXT,
  -- Transport
  transport_needed      BOOLEAN DEFAULT FALSE,
  transport_pickup_location TEXT,
  transport_arrival_time TEXT,
  transport_flight_details TEXT,
  -- T-shirt
  tshirt_size           TEXT CHECK (tshirt_size IN ('XS','S','M','L','XL','XXL','XXXL')),
  -- Emergency contact
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  -- Message
  message_to_host       TEXT,
  -- Custom question answers
  custom_answers        JSONB DEFAULT '{}',  -- {question_id: answer}
  -- Moderation
  approval_status       TEXT DEFAULT 'auto_approved'
                          CHECK (approval_status IN ('pending','approved','rejected','auto_approved')),
  reviewed_by           UUID,
  reviewed_at           TIMESTAMPTZ,
  -- Meta
  ip_address            INET,
  user_agent            TEXT,
  submitted_at          TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rsvp_responses_form    ON rsvp_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_event   ON rsvp_responses(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_guest   ON rsvp_responses(guest_id);

-- Update guests table to track invite + RSVP state from new system
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS invite_status TEXT DEFAULT 'not_sent'
    CHECK (invite_status IN ('not_sent','sent','delivered','opened','bounced')),
  ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rsvp_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accommodation_status TEXT DEFAULT 'not_required'
    CHECK (accommodation_status IN ('not_required','requested','allocated','checked_in','checked_out')),
  ADD COLUMN IF NOT EXISTS transport_status TEXT DEFAULT 'not_required'
    CHECK (transport_status IN ('not_required','requested','arranged')),
  ADD COLUMN IF NOT EXISTS meal_preference TEXT
    CHECK (meal_preference IN ('veg','non_veg','vegan','jain','halal','kosher','gluten_free','custom')),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual','imported','self_registered','team_member')),
  ADD COLUMN IF NOT EXISTS registration_approved BOOLEAN,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general'
    CHECK (category IN ('vip','general','media','family','friend','colleague','vendor','speaker','sponsor','other'));

-- ─── ACCOMMODATION MANAGEMENT ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hotels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  country         TEXT DEFAULT 'India',
  star_rating     INTEGER CHECK (star_rating BETWEEN 1 AND 7),
  contact_name    TEXT,
  contact_phone   TEXT,
  contact_email   TEXT,
  website         TEXT,
  notes           TEXT,
  logo_url        TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hotel_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_number     TEXT NOT NULL,
  room_type       TEXT NOT NULL
                    CHECK (room_type IN ('single','double','twin','suite','deluxe','family','presidential')),
  capacity        INTEGER NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 10),
  floor           INTEGER,
  amenities       TEXT[] DEFAULT '{}',
  rate_per_night  NUMERIC(10,2),
  currency        TEXT DEFAULT 'INR',
  is_available    BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (hotel_id, room_number)
);

CREATE TABLE IF NOT EXISTS accommodation_bookings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id                UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  hotel_id                UUID NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  room_id                 UUID NOT NULL REFERENCES hotel_rooms(id) ON DELETE RESTRICT,
  guest_id                UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  check_in_date           DATE NOT NULL,
  check_out_date          DATE NOT NULL,
  -- Computed: out - in (stored for performance)
  nights                  INTEGER GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
  status                  TEXT DEFAULT 'pending'
                            CHECK (status IN ('pending','confirmed','cancelled','checked_in','checked_out','no_show')),
  booked_by               UUID,     -- user who made the booking
  booking_reference       TEXT DEFAULT encode(gen_random_bytes(6), 'hex'),
  special_requests        TEXT,
  is_complimentary        BOOLEAN DEFAULT FALSE,
  amount                  NUMERIC(10,2),
  paid_by_guest           BOOLEAN DEFAULT FALSE,
  voucher_generated       BOOLEAN DEFAULT FALSE,
  voucher_sent            BOOLEAN DEFAULT FALSE,
  voucher_sent_at         TIMESTAMPTZ,
  voucher_url             TEXT,      -- link to generated PDF
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  -- Enforce dates are valid
  CONSTRAINT chk_checkout_after_checkin CHECK (check_out_date > check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_accom_bookings_event   ON accommodation_bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_accom_bookings_guest   ON accommodation_bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_accom_bookings_room    ON accommodation_bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_accom_bookings_hotel   ON accommodation_bookings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_accom_bookings_dates   ON accommodation_bookings(check_in_date, check_out_date);

-- Prevent double-booking: same room cannot have overlapping confirmed bookings
CREATE OR REPLACE FUNCTION prevent_room_double_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM accommodation_bookings
    WHERE room_id = NEW.room_id
      AND id != NEW.id
      AND status NOT IN ('cancelled','no_show')
      AND check_in_date < NEW.check_out_date
      AND check_out_date > NEW.check_in_date
  ) THEN
    RAISE EXCEPTION 'Room % is already booked for the requested dates', NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_room_double_booking ON accommodation_bookings;
CREATE TRIGGER trg_prevent_room_double_booking
  BEFORE INSERT OR UPDATE ON accommodation_bookings
  FOR EACH ROW EXECUTE FUNCTION prevent_room_double_booking();

-- ─── GUEST IMPORT BATCHES ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guest_import_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  imported_by     UUID,
  filename        TEXT NOT NULL,
  total_rows      INTEGER DEFAULT 0,
  imported_count  INTEGER DEFAULT 0,
  skipped_count   INTEGER DEFAULT 0,
  failed_count    INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'processing'
                    CHECK (status IN ('processing','completed','failed')),
  error_log       JSONB DEFAULT '[]',  -- [{row, field, error}]
  column_mapping  JSONB DEFAULT '{}',  -- {csv_col: db_col}
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_event ON guest_import_batches(event_id);

-- ─── PUBLIC REGISTRATION LINKS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_registration_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  slug                TEXT UNIQUE NOT NULL,  -- used in /register/[slug]
  is_active           BOOLEAN DEFAULT TRUE,
  expires_at          TIMESTAMPTZ,
  max_registrations   INTEGER,    -- capacity cap
  current_count       INTEGER DEFAULT 0,
  password_protected  BOOLEAN DEFAULT FALSE,
  password_hash       TEXT,
  moderation_enabled  BOOLEAN DEFAULT FALSE,
  custom_questions    JSONB DEFAULT '[]',  -- [{id, text, type, required, options}]
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_links_event ON event_registration_links(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_links_slug ON event_registration_links(slug);

-- ─── VOUCHER TEMPLATES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS voucher_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  is_global       BOOLEAN DEFAULT FALSE,
  -- Section toggles
  show_event_logo       BOOLEAN DEFAULT TRUE,
  show_guest_name       BOOLEAN DEFAULT TRUE,
  show_guest_designation BOOLEAN DEFAULT TRUE,
  show_hotel_name       BOOLEAN DEFAULT TRUE,
  show_hotel_address    BOOLEAN DEFAULT TRUE,
  show_hotel_stars      BOOLEAN DEFAULT TRUE,
  show_room_number      BOOLEAN DEFAULT TRUE,
  show_room_type        BOOLEAN DEFAULT TRUE,
  show_checkin_date     BOOLEAN DEFAULT TRUE,
  show_checkout_date    BOOLEAN DEFAULT TRUE,
  show_nights           BOOLEAN DEFAULT TRUE,
  show_booking_ref      BOOLEAN DEFAULT TRUE,
  show_special_requests BOOLEAN DEFAULT FALSE,
  show_hotel_contact    BOOLEAN DEFAULT TRUE,
  show_emergency_contact BOOLEAN DEFAULT FALSE,
  show_terms            BOOLEAN DEFAULT FALSE,
  show_qr_code          BOOLEAN DEFAULT TRUE,
  show_signature_block  BOOLEAN DEFAULT FALSE,
  show_footer           BOOLEAN DEFAULT TRUE,
  -- Content
  terms_text      TEXT,
  footer_message  TEXT,
  -- Design
  layout_template TEXT DEFAULT 'elegant'
                    CHECK (layout_template IN ('elegant','minimal','bordered','ribbon')),
  page_size       TEXT DEFAULT 'a4_portrait'
                    CHECK (page_size IN ('a4_portrait','a4_landscape','card','mobile')),
  primary_color   TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#f59e0b',
  background_color TEXT DEFAULT '#ffffff',
  text_color      TEXT DEFAULT '#0f172a',
  heading_color   TEXT DEFAULT '#1e293b',
  border_style    TEXT DEFAULT 'elegant',
  border_color    TEXT DEFAULT '#6366f1',
  font_family     TEXT DEFAULT 'Inter',
  logo_url        TEXT,
  logo_placement  TEXT DEFAULT 'top-center',
  background_type TEXT DEFAULT 'solid',
  background_image_url TEXT,
  watermark_text  TEXT,
  watermark_opacity NUMERIC(3,2) DEFAULT 0.0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE invitation_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_forms                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_custom_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_responses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_rooms                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodation_bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_import_batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registration_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_templates            ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY "tenant_isolation" ON invitation_templates
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON invitations
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON rsvp_forms
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON rsvp_custom_questions
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON rsvp_responses
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON hotels
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON hotel_rooms
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON accommodation_bookings
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON guest_import_batches
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON event_registration_links
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON voucher_templates
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
