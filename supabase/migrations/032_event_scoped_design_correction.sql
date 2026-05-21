-- ============================================================
-- OccasionPro — Architecture Correction (Migration 032)
-- DESIGN PRINCIPLE: All document designs (invitation, RSVP, voucher)
-- are ALWAYS event-scoped. No design is shared globally — only
-- "Master Templates" in a read-only library; applying one to an
-- event creates a full independent COPY.
-- ============================================================

-- ─── 1. Master Template Library (global, read-only, copy-on-use) ─────────────
-- These are curated library templates that admins can "apply" to an event.
-- Applying creates a COPY under invitation_templates / voucher_templates
-- with an event_id. Editing the event copy NEVER affects the master.

CREATE TABLE IF NOT EXISTS master_invitation_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  preview_image_url TEXT,
  category        TEXT DEFAULT 'general'
                    CHECK (category IN ('wedding','corporate','birthday','conference','party','general')),
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  -- All design/content fields (mirrors invitation_templates)
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
  layout_template     TEXT DEFAULT 'elegant'
                        CHECK (layout_template IN ('elegant','modern','minimal','festive','corporate')),
  base_theme          TEXT DEFAULT 'dark'   CHECK (base_theme IN ('light','dark')),
  primary_color       TEXT DEFAULT '#6366f1',
  secondary_color     TEXT DEFAULT '#f59e0b',
  background_color    TEXT DEFAULT '#0f172a',
  text_color          TEXT DEFAULT '#f8fafc',
  accent_color        TEXT DEFAULT '#e11d48',
  button_color        TEXT DEFAULT '#6366f1',
  button_text_color   TEXT DEFAULT '#ffffff',
  button_style        TEXT DEFAULT 'rounded' CHECK (button_style IN ('sharp','rounded','pill')),
  font_family         TEXT DEFAULT 'Inter',
  font_size_base      INTEGER DEFAULT 16,
  logo_placement      TEXT DEFAULT 'top-center'
                        CHECK (logo_placement IN ('top-left','top-center','top-right')),
  border_style        TEXT DEFAULT 'none'
                        CHECK (border_style IN ('none','thin','thick','double','shadow','rounded')),
  border_radius       TEXT DEFAULT 'default'
                        CHECK (border_radius IN ('sharp','default','rounded','pill')),
  background_type     TEXT DEFAULT 'solid'
                        CHECK (background_type IN ('solid','gradient','pattern','image')),
  section_spacing     TEXT DEFAULT 'normal'
                        CHECK (section_spacing IN ('compact','normal','spacious')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_voucher_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  preview_image_url TEXT,
  category        TEXT DEFAULT 'general',
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  -- All design fields (mirrors voucher_templates)
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
  logo_placement  TEXT DEFAULT 'top-center',
  background_type TEXT DEFAULT 'solid',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Fix invitation_templates: make event_id NOT NULL ─────────────────────
-- First: backfill any rows without an event_id by removing orphaned globals
-- (in a fresh DB there are none, but belt-and-suspenders)
DELETE FROM invitation_templates WHERE event_id IS NULL;

-- Remove the is_global column (no longer needed — event scope is enforced by event_id)
ALTER TABLE invitation_templates DROP COLUMN IF EXISTS is_global;

-- Now enforce NOT NULL on event_id
ALTER TABLE invitation_templates
  ALTER COLUMN event_id SET NOT NULL;

-- Change ON DELETE to CASCADE (document design is part of the event)
ALTER TABLE invitation_templates
  DROP CONSTRAINT IF EXISTS invitation_templates_event_id_fkey;
ALTER TABLE invitation_templates
  ADD CONSTRAINT invitation_templates_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- Add index on event_id for fast per-event queries
CREATE INDEX IF NOT EXISTS idx_invitation_templates_event ON invitation_templates(event_id);

-- ─── 3. Fix voucher_templates: make event_id NOT NULL ────────────────────────
DELETE FROM voucher_templates WHERE event_id IS NULL;

ALTER TABLE voucher_templates DROP COLUMN IF EXISTS is_global;

ALTER TABLE voucher_templates
  ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE voucher_templates
  DROP CONSTRAINT IF EXISTS voucher_templates_event_id_fkey;
ALTER TABLE voucher_templates
  ADD CONSTRAINT voucher_templates_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_voucher_templates_event ON voucher_templates(event_id);

-- ─── 4. Auto-create default templates when an event is created ───────────────
-- This trigger ensures every new event gets a blank invitation template
-- and a blank voucher template automatically.

CREATE OR REPLACE FUNCTION create_default_event_templates()
RETURNS TRIGGER AS $$
BEGIN
  -- Default invitation template for this event
  INSERT INTO invitation_templates (
    tenant_id, event_id, name,
    layout_template, base_theme, primary_color, background_color, text_color,
    button_color, button_text_color, font_family,
    show_banner, show_event_name, show_tagline, show_datetime,
    show_venue, show_rsvp_button
  ) VALUES (
    NEW.tenant_id, NEW.id, 'Default Invitation',
    'elegant', 'dark', '#6366f1', '#0f172a', '#f8fafc',
    '#6366f1', '#ffffff', 'Inter',
    true, true, true, true, true, true
  ) ON CONFLICT DO NOTHING;

  -- Default voucher template for this event
  INSERT INTO voucher_templates (
    tenant_id, event_id, name,
    layout_template, page_size, primary_color, background_color, text_color,
    font_family,
    show_guest_name, show_hotel_name, show_checkin_date, show_checkout_date,
    show_nights, show_booking_ref, show_qr_code, show_footer
  ) VALUES (
    NEW.tenant_id, NEW.id, 'Default Voucher',
    'elegant', 'a4_portrait', '#6366f1', '#ffffff', '#0f172a',
    'Inter',
    true, true, true, true, true, true, true, true
  ) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_default_event_templates ON events;
CREATE TRIGGER trg_create_default_event_templates
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION create_default_event_templates();

-- ─── 5. Seed default RSVP form per event (same pattern) ──────────────────────
CREATE OR REPLACE FUNCTION create_default_rsvp_form()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO rsvp_forms (
    tenant_id, event_id, name, is_active,
    show_attendance, show_plus_one, show_meal_preference, show_dietary
  ) VALUES (
    NEW.tenant_id, NEW.id, 'RSVP Form', true,
    true, true, true, true
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_default_rsvp_form ON events;
CREATE TRIGGER trg_create_default_rsvp_form
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION create_default_rsvp_form();

-- ─── 6. Master template library: no RLS (public read, super admin writes) ────
-- Super Admin portal manages these; all authenticated users can read.
-- (Apply appropriate policies in your Supabase dashboard based on your auth model)

-- ─── 7. Tracking: copy_from_master audit trail ───────────────────────────────
-- Track when an event template was seeded from a master (informational only)
ALTER TABLE invitation_templates
  ADD COLUMN IF NOT EXISTS copied_from_master UUID REFERENCES master_invitation_templates(id) ON DELETE SET NULL;

ALTER TABLE voucher_templates
  ADD COLUMN IF NOT EXISTS copied_from_master UUID REFERENCES master_voucher_templates(id) ON DELETE SET NULL;

-- ─── Summary comment ─────────────────────────────────────────────────────────
-- After this migration:
-- • invitation_templates.event_id is NOT NULL → always event-scoped
-- • voucher_templates.event_id is NOT NULL → always event-scoped
-- • rsvp_forms.event_id was already NOT NULL → correct
-- • master_invitation_templates / master_voucher_templates = global library
-- • Applying a master to an event = INSERT into event-scoped table with copied_from_master set
-- • Editing event copy never affects master
-- • Every new event auto-gets default invitation, voucher, and RSVP templates via triggers
