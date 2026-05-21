-- ============================================================
-- Migration: 031_guest_table_customisation.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Guest Table Customisation (Migration 031)
-- Per-event: column manager, custom columns, saved views,
-- conditional formatting, mobile column prefs
-- ============================================================

-- ─── Event Guest Table Layouts ────────────────────────────────────────────────
-- Stores which columns are visible + their order for each event

CREATE TABLE IF NOT EXISTS event_guest_table_layouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- column_config: array of {id, field, label, visible, width, frozen, order}
  column_config   JSONB NOT NULL DEFAULT '[]',
  -- mobile_columns: up to 3 column ids to show in mobile card view
  mobile_columns  JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, event_id)
);

-- ─── Saved Table Views ─────────────────────────────────────────────────────────
-- Multiple named views per event, each with own columns/sort/filter/group

CREATE TABLE IF NOT EXISTS event_guest_table_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  is_default      BOOLEAN DEFAULT FALSE,
  -- column_ids: ordered list of visible column ids for this view
  column_ids      JSONB NOT NULL DEFAULT '[]',
  sort_by         TEXT,       -- field name
  sort_dir        TEXT DEFAULT 'asc' CHECK (sort_dir IN ('asc','desc')),
  filter_config   JSONB DEFAULT '{}',  -- {field: value} active filters
  group_by        TEXT,       -- field name to group rows by
  -- Share: generate a token so staff at a specific station can load this view
  share_token     TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_views_event ON event_guest_table_views(event_id);

-- ─── Custom Columns (per event) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_guest_custom_columns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  field_key       TEXT NOT NULL,   -- snake_case, used as key in guest_custom_data JSONB
  column_type     TEXT NOT NULL
                    CHECK (column_type IN ('text','number','dropdown','boolean','date')),
  options         JSONB DEFAULT '[]',  -- for dropdown: [{value, label}]
  is_required     BOOLEAN DEFAULT FALSE,
  show_in_rsvp    BOOLEAN DEFAULT FALSE,  -- expose in RSVP form builder
  show_in_export  BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_custom_cols_event ON event_guest_custom_columns(event_id);

-- ─── Guest Custom Data ─────────────────────────────────────────────────────────
-- Stores custom column values per guest (JSONB: {field_key: value})

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}';

-- ─── Conditional Formatting Rules ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_guest_table_formatting (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- condition
  field           TEXT NOT NULL,
  operator        TEXT NOT NULL CHECK (operator IN ('eq','neq','contains','gt','lt','is_empty','is_not_empty')),
  value           TEXT,
  -- style to apply
  row_bg_color    TEXT,       -- e.g. '#fef2f2' for light red
  row_text_color  TEXT,
  left_border_color TEXT,     -- e.g. '#f59e0b' for gold VIP border
  bold_text       BOOLEAN DEFAULT FALSE,
  sort_order      INTEGER DEFAULT 0,  -- rules evaluated in order; max 5 per event
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formatting_event ON event_guest_table_formatting(event_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE event_guest_table_layouts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_guest_table_views      ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_guest_custom_columns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_guest_table_formatting ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON event_guest_table_layouts
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON event_guest_table_views
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON event_guest_custom_columns
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON event_guest_table_formatting
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ============================================================
-- Migration: 032_event_scoped_design_correction.sql
-- ============================================================
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

-- ============================================================
-- Migration: 033_public_registration.sql
-- ============================================================
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

-- ============================================================
-- Migration: 034_fnb_management.sql
-- ============================================================
-- ============================================================
-- OccasionPro — F&B (Food & Beverage) Management (Migration 034)
-- Full module: menus, items, beverages, stations, tasting, consumption
-- ============================================================

-- ── F&B Menus (per event, per meal session) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS fnb_menus (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,                   -- "Day 1 Gala Dinner"
  meal_type         TEXT NOT NULL CHECK (meal_type IN (
                      'breakfast','lunch','dinner','hi-tea','cocktails',
                      'brunch','welcome-drinks','midnight-snacks','custom'
                    )),
  session_name      TEXT,                             -- Custom label override
  service_style     TEXT NOT NULL DEFAULT 'buffet' CHECK (service_style IN (
                      'buffet','plated','food-stations','cocktail','family-style','live-stations'
                    )),
  start_time        TIME,
  end_time          TIME,
  pax_count         INTEGER,                          -- Guest count for this session
  total_food_cost   DECIMAL(12,2) DEFAULT 0,          -- Auto-computed
  is_confirmed      BOOLEAN DEFAULT FALSE,
  status            TEXT DEFAULT 'draft' CHECK (status IN (
                      'draft','submitted_to_vendor','vendor_confirmed','finalised'
                    )),
  notes             TEXT,
  display_order     INTEGER DEFAULT 0,
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_menus_event ON fnb_menus(event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_menus_tenant ON fnb_menus(tenant_id);

-- ── F&B Menu Items ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fnb_menu_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id             UUID NOT NULL REFERENCES fnb_menus(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  category            TEXT NOT NULL DEFAULT 'main' CHECK (category IN (
                        'starter','main','dessert','beverage','bread',
                        'salad','live-station','snack','soup','side'
                      )),
  cuisine_type        TEXT,                            -- Indian, Continental, Chinese, etc.
  -- Dietary flags
  is_veg              BOOLEAN DEFAULT FALSE,
  is_vegan            BOOLEAN DEFAULT FALSE,
  is_gluten_free      BOOLEAN DEFAULT FALSE,
  is_halal            BOOLEAN DEFAULT FALSE,
  is_jain             BOOLEAN DEFAULT FALSE,
  -- Allergens
  allergens           TEXT[] DEFAULT ARRAY[]::TEXT[],  -- nuts, dairy, shellfish, egg, soy, wheat
  -- Quantities & Costs
  unit                TEXT DEFAULT 'per_person' CHECK (unit IN (
                        'per_person','per_piece','per_kg','per_litre','per_platter'
                      )),
  quantity_per_pax    DECIMAL(8,3),
  total_quantity      DECIMAL(10,3),
  unit_cost           DECIMAL(10,2),
  total_cost          DECIMAL(12,2) GENERATED ALWAYS AS (
                        COALESCE(total_quantity, 0) * COALESCE(unit_cost, 0)
                      ) STORED,
  -- Vendor
  catering_vendor_id  UUID REFERENCES vendors(id) ON DELETE SET NULL,
  notes               TEXT,
  display_order       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_items_menu    ON fnb_menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_fnb_items_event   ON fnb_menu_items(event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_items_vendor  ON fnb_menu_items(catering_vendor_id);

-- ── Beverage Packages ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fnb_beverage_packages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  menu_id               UUID REFERENCES fnb_menus(id) ON DELETE SET NULL,
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'soft-bar' CHECK (type IN (
                          'soft-bar','full-bar','beer-wine','mocktails-only','custom'
                        )),
  items                 JSONB DEFAULT '[]',            -- [{name, quantity_per_pax, unit}]
  duration_hours        DECIMAL(4,1),
  price_per_pax         DECIMAL(10,2),
  total_cost            DECIMAL(12,2),
  bartender_count       INTEGER DEFAULT 0,
  bar_opens_at          TIME,
  bar_closes_at         TIME,
  is_dry_event          BOOLEAN DEFAULT FALSE,         -- Hides bar section if true
  is_included_in_package BOOLEAN DEFAULT TRUE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_beverages_event ON fnb_beverage_packages(event_id);

-- ── Service Stations ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fnb_service_stations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  menu_id             UUID REFERENCES fnb_menus(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,                   -- "Live Pasta Counter", "Chaat Corner"
  station_type        TEXT DEFAULT 'food' CHECK (station_type IN (
                        'food','beverage','dessert','live-cooking','display'
                      )),
  location_in_venue   TEXT,
  assigned_staff_count INTEGER DEFAULT 2,
  setup_time          TIME,                            -- When to start setup
  breakdown_time      TIME,                            -- When to start breakdown
  equipment_needed    TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes               TEXT,
  display_order       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_stations_event ON fnb_service_stations(event_id);

-- ── Tasting Sessions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fnb_tasting_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  menu_id             UUID REFERENCES fnb_menus(id) ON DELETE SET NULL,
  vendor_id           UUID REFERENCES vendors(id) ON DELETE SET NULL,
  scheduled_at        TIMESTAMPTZ,
  location            TEXT,
  attendees           TEXT[] DEFAULT ARRAY[]::TEXT[],  -- Names/emails of attendees
  status              TEXT DEFAULT 'scheduled' CHECK (status IN (
                        'scheduled','completed','cancelled','rescheduled'
                      )),
  feedback_notes      TEXT,
  items_approved      TEXT[] DEFAULT ARRAY[]::TEXT[],
  items_rejected      TEXT[] DEFAULT ARRAY[]::TEXT[],
  items_modified      TEXT[] DEFAULT ARRAY[]::TEXT[],
  follow_up_required  BOOLEAN DEFAULT FALSE,
  follow_up_notes     TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_tasting_event  ON fnb_tasting_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_tasting_vendor ON fnb_tasting_sessions(vendor_id);

-- ── Consumption Log (post-event) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fnb_consumption_log (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id                UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  menu_id                 UUID REFERENCES fnb_menus(id) ON DELETE SET NULL,
  item_id                 UUID REFERENCES fnb_menu_items(id) ON DELETE SET NULL,
  item_name               TEXT,                        -- Denormalised in case item deleted
  planned_quantity        DECIMAL(10,3),
  actual_quantity_consumed DECIMAL(10,3),
  leftover_quantity       DECIMAL(10,3),
  wastage_pct             DECIMAL(5,2) GENERATED ALWAYS AS (
                            CASE
                              WHEN COALESCE(planned_quantity, 0) > 0
                              THEN ROUND((COALESCE(leftover_quantity, 0) / planned_quantity) * 100, 2)
                              ELSE 0
                            END
                          ) STORED,
  wastage_notes           TEXT,
  logged_by               UUID,
  logged_at               TIMESTAMPTZ DEFAULT NOW(),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_consumption_event ON fnb_consumption_log(event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_consumption_item  ON fnb_consumption_log(item_id);

-- ── Dietary Summary View ─────────────────────────────────────────────────────
-- Pulls guest dietary info from rsvp_responses (custom_answers JSONB + guest fields)
-- Falls back to guest_details dietary flags when available

CREATE OR REPLACE VIEW fnb_dietary_summary AS
SELECT
  g.event_id,
  g.tenant_id,
  COUNT(*)                                                    AS total_guests,
  COUNT(*) FILTER (WHERE g.dietary_preference = 'vegetarian') AS veg_count,
  COUNT(*) FILTER (WHERE g.dietary_preference = 'vegan')      AS vegan_count,
  COUNT(*) FILTER (WHERE g.dietary_preference = 'jain')       AS jain_count,
  COUNT(*) FILTER (WHERE g.dietary_preference = 'halal')      AS halal_count,
  COUNT(*) FILTER (WHERE g.dietary_preference = 'non_vegetarian'
                      OR g.dietary_preference IS NULL)         AS non_veg_count,
  COUNT(*) FILTER (WHERE 'gluten_free' = ANY(COALESCE(g.allergens, ARRAY[]::TEXT[]))) AS gluten_free_count,
  COUNT(*) FILTER (WHERE g.allergens IS NOT NULL AND array_length(g.allergens, 1) > 0) AS has_allergies_count,
  COALESCE(
    jsonb_agg(DISTINCT allergen) FILTER (
      WHERE allergen IS NOT NULL
        AND allergen != ''
    ), '[]'::jsonb
  )                                                            AS all_allergens
FROM guests g,
     LATERAL unnest(COALESCE(g.allergens, ARRAY[]::TEXT[])) AS allergen
WHERE g.rsvp_status IN ('confirmed', 'attending')
GROUP BY g.event_id, g.tenant_id;

-- ── Auto-update menu total_food_cost on item change ─────────────────────────

CREATE OR REPLACE FUNCTION sync_menu_food_cost()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE fnb_menus
  SET total_food_cost = (
    SELECT COALESCE(SUM(COALESCE(total_cost, 0)), 0)
    FROM fnb_menu_items
    WHERE menu_id = COALESCE(NEW.menu_id, OLD.menu_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.menu_id, OLD.menu_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_menu_cost_insert ON fnb_menu_items;
CREATE TRIGGER trg_sync_menu_cost_insert
  AFTER INSERT OR UPDATE OR DELETE ON fnb_menu_items
  FOR EACH ROW EXECUTE FUNCTION sync_menu_food_cost();

-- ── Add dietary columns to guests if not present ────────────────────────────
-- (safe — only adds if column doesn't exist)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guests' AND column_name = 'dietary_preference'
  ) THEN
    ALTER TABLE guests ADD COLUMN dietary_preference TEXT CHECK (
      dietary_preference IN ('vegetarian','vegan','jain','halal','non_vegetarian','other')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guests' AND column_name = 'allergens'
  ) THEN
    ALTER TABLE guests ADD COLUMN allergens TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;

-- ============================================================
-- Migration: 035_granular_permissions.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Granular Module-Level Permissions (Migration 035)
-- Extends RBAC system with per-module, per-team-member access control
-- ============================================================

-- ── Access level enum ────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_access_level') THEN
    CREATE TYPE module_access_level AS ENUM ('none', 'view', 'edit', 'full');
  END IF;
END $$;

-- ── Module registry ──────────────────────────────────────────────────────────
-- Single source of truth for all platform modules

CREATE TABLE IF NOT EXISTS platform_modules (
  id              TEXT PRIMARY KEY,           -- 'guests', 'fnb', 'finance', etc.
  label           TEXT NOT NULL,              -- "Guests"
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'operations',  -- 'core','operations','finance','admin','system'
  sidebar_path    TEXT,                       -- '/guests'
  is_always_on    BOOLEAN NOT NULL DEFAULT false,  -- Dashboard, Notifications
  admin_only      BOOLEAN NOT NULL DEFAULT false,  -- Settings full, Super Admin
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed all modules
INSERT INTO platform_modules (id, label, description, category, sidebar_path, is_always_on, admin_only, sort_order) VALUES
  ('dashboard',        'Dashboard',              'Main dashboard overview',             'core',       '/dashboard',   true,  false, 1),
  ('events',           'Events',                 'Event creation and management',       'core',       '/events',      false, false, 2),
  ('guests',           'Guests',                 'Guest list, check-in, export',        'operations', '/guests',      false, false, 3),
  ('fnb',              'F&B',                    'Food & beverage management',          'operations', '/fnb',         false, false, 4),
  ('accommodation',    'Accommodation',          'Hotel blocks and room assignments',   'operations', '/accommodation',false,false, 5),
  ('invitations_rsvp', 'Invitations & RSVP',     'Invite sending and RSVP tracking',   'operations', '/rsvp',        false, false, 6),
  ('venues',           'Venues',                 'Venue listing and floor plans',       'operations', '/venues',      false, false, 7),
  ('vendors',          'Vendors',                'Vendor management and payments',      'operations', '/vendors',     false, false, 8),
  ('finance',          'Finance & Budget',       'Invoices, expenses, P&L',            'finance',    '/finance',     false, false, 9),
  ('crm',              'CRM',                    'Leads, proposals, sales pipeline',    'finance',    '/crm',         false, false, 10),
  ('runsheet',         'Runsheet',               'Event runsheet and timeline',         'operations', '/runsheet',    false, false, 11),
  ('tasks',            'Tasks',                  'Task assignment and tracking',        'operations', '/tasks',       false, false, 12),
  ('team',             'Team',                   'Team members and roles',              'admin',      '/team',        false, true,  13),
  ('artists',          'Artist & Talent',        'Artist and performer management',     'operations', '/artists',     false, false, 14),
  ('transportation',   'Transportation',         'Transport and logistics',             'operations', '/transportation',false,false,15),
  ('av_technical',     'AV & Technical',         'AV and technical production',         'operations', '/av',          false, false, 16),
  ('security',         'Security',               'Security and crowd management',       'operations', '/security',    false, false, 17),
  ('sponsorship',      'Sponsorship',            'Sponsorship and partnerships',        'finance',    '/sponsorship', false, false, 18),
  ('inventory',        'Inventory',              'Stock and equipment tracking',        'operations', '/inventory',   false, false, 19),
  ('microsites',       'Microsites & Ticketing', 'Event websites and ticket sales',    'operations', '/microsites',  false, false, 20),
  ('analytics',        'Analytics',              'Reports and business intelligence',   'admin',      '/analytics',   false, false, 21),
  ('ai_assistant',     'AI Assistant',           'AI-powered automation and insights',  'core',       '/ai',          false, false, 22),
  ('notifications',    'Notifications',          'Notification center',                 'core',       '/notifications',true, false, 23),
  ('settings',         'Settings',               'Platform settings and configuration', 'admin',      '/settings',    false, true,  24),
  ('super_admin',      'Super Admin',            'Super admin portal (never for team)', 'system',     '/super-admin', false, true,  25)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- ── Team member permissions ───────────────────────────────────────────────────
-- Stores per-module access level for each team member
-- event_id IS NULL = platform-wide (applies to all events)
-- event_id IS NOT NULL = event-specific override

CREATE TABLE IF NOT EXISTS team_member_permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id     UUID REFERENCES events(id) ON DELETE CASCADE,   -- NULL = platform-wide
  module_id    TEXT NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
  access_level module_access_level NOT NULL DEFAULT 'none',
  granted_by   UUID REFERENCES profiles(id),
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, event_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_tmp_tenant     ON team_member_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tmp_profile    ON team_member_permissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_tmp_event      ON team_member_permissions(event_id);
CREATE INDEX IF NOT EXISTS idx_tmp_module     ON team_member_permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_tmp_profile_event ON team_member_permissions(profile_id, event_id);

-- ── Preset permission templates ───────────────────────────────────────────────
-- Preset roles that auto-set all module levels

CREATE TABLE IF NOT EXISTS permission_presets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,        -- 'admin', 'manager', 'coordinator', 'view_only'
  label       TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#6366f1',
  is_system   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO permission_presets (name, label, description, color) VALUES
  ('admin',       'Admin',        'Full access to all modules including team and settings', '#ef4444'),
  ('manager',     'Manager',      'Full operational access, view-only for finance and admin', '#f59e0b'),
  ('coordinator', 'Coordinator',  'Edit access for operations, view-only for finance', '#3b82f6'),
  ('view_only',   'View Only',    'Read-only access to all non-admin modules', '#6b7280')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS permission_preset_modules (
  preset_name  TEXT NOT NULL REFERENCES permission_presets(name) ON DELETE CASCADE,
  module_id    TEXT NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
  access_level module_access_level NOT NULL DEFAULT 'none',
  PRIMARY KEY (preset_name, module_id)
);

-- Admin preset: full everywhere except super_admin (none)
INSERT INTO permission_preset_modules (preset_name, module_id, access_level)
SELECT 'admin', id,
  CASE
    WHEN id = 'super_admin' THEN 'none'::module_access_level
    ELSE 'full'::module_access_level
  END
FROM platform_modules
ON CONFLICT (preset_name, module_id) DO NOTHING;

-- Manager preset
INSERT INTO permission_preset_modules (preset_name, module_id, access_level)
SELECT 'manager', id,
  CASE
    WHEN id IN ('super_admin','settings') THEN 'none'::module_access_level
    WHEN id IN ('team','analytics','finance') THEN 'view'::module_access_level
    ELSE 'full'::module_access_level
  END
FROM platform_modules
ON CONFLICT (preset_name, module_id) DO NOTHING;

-- Coordinator preset
INSERT INTO permission_preset_modules (preset_name, module_id, access_level)
SELECT 'coordinator', id,
  CASE
    WHEN id IN ('super_admin','settings','team') THEN 'none'::module_access_level
    WHEN id IN ('analytics','finance','crm','sponsorship') THEN 'view'::module_access_level
    ELSE 'edit'::module_access_level
  END
FROM platform_modules
ON CONFLICT (preset_name, module_id) DO NOTHING;

-- View only preset
INSERT INTO permission_preset_modules (preset_name, module_id, access_level)
SELECT 'view_only', id,
  CASE
    WHEN id IN ('super_admin','settings','team') THEN 'none'::module_access_level
    WHEN id = 'dashboard' THEN 'full'::module_access_level
    WHEN id = 'notifications' THEN 'full'::module_access_level
    ELSE 'view'::module_access_level
  END
FROM platform_modules
ON CONFLICT (preset_name, module_id) DO NOTHING;

-- ── Helper function: get effective access level ───────────────────────────────
-- Returns access level for a profile+module combination, preferring event override

CREATE OR REPLACE FUNCTION get_module_access(
  p_profile_id UUID,
  p_module_id  TEXT,
  p_event_id   UUID DEFAULT NULL
) RETURNS module_access_level AS $$
DECLARE
  v_level module_access_level;
BEGIN
  -- Try event-specific override first
  IF p_event_id IS NOT NULL THEN
    SELECT access_level INTO v_level
    FROM team_member_permissions
    WHERE profile_id = p_profile_id AND module_id = p_module_id AND event_id = p_event_id
    LIMIT 1;
    IF FOUND THEN RETURN v_level; END IF;
  END IF;

  -- Fall back to platform-wide
  SELECT access_level INTO v_level
  FROM team_member_permissions
  WHERE profile_id = p_profile_id AND module_id = p_module_id AND event_id IS NULL
  LIMIT 1;
  IF FOUND THEN RETURN v_level; END IF;

  -- Check if always-on
  SELECT CASE WHEN is_always_on THEN 'full'::module_access_level ELSE 'none'::module_access_level END
  INTO v_level
  FROM platform_modules
  WHERE id = p_module_id;

  RETURN COALESCE(v_level, 'none'::module_access_level);
END;
$$ LANGUAGE plpgsql STABLE;

-- ── RLS: team_member_permissions ─────────────────────────────────────────────

ALTER TABLE team_member_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_see_own_permissions"
  ON team_member_permissions FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "admins_manage_permissions"
  ON team_member_permissions FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- ============================================================
-- Migration: 036_messaging.sql
-- ============================================================
-- ============================================================
-- Migration 036: Communication & Messaging
-- event_messages, message_threads, broadcast_messages
-- ============================================================

-- ── Message threads ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_threads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  thread_type   TEXT NOT NULL DEFAULT 'internal'
                CHECK (thread_type IN ('internal','client','vendor','broadcast')),
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','resolved','archived')),
  participants  UUID[] NOT NULL DEFAULT '{}',   -- profile_ids
  last_message_at TIMESTAMPTZ,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_threads_tenant   ON message_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_event    ON message_threads(event_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_type     ON message_threads(thread_type);

-- ── Messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  sender_id     UUID REFERENCES profiles(id),
  sender_name   TEXT,                          -- fallback for external senders
  message       TEXT NOT NULL,
  message_type  TEXT NOT NULL DEFAULT 'text'
                CHECK (message_type IN ('text','system','file')),
  attachments   JSONB DEFAULT '[]',            -- [{name, url, size, mime_type}]
  is_read_by    UUID[] NOT NULL DEFAULT '{}',  -- profile_ids who have read
  reply_to_id   UUID REFERENCES event_messages(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_messages_thread  ON event_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_tenant  ON event_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_event   ON event_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_created ON event_messages(created_at DESC);

-- ── Broadcast messages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  audience        TEXT NOT NULL DEFAULT 'all_team'
                  CHECK (audience IN ('all_team','all_guests','vendors','specific_roles','specific_guests')),
  audience_filter JSONB DEFAULT '{}',          -- {role_ids: [], guest_tags: [], etc.}
  channels        TEXT[] NOT NULL DEFAULT ARRAY['in_app'],  -- in_app, email, sms, whatsapp
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','sent','failed')),
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  sent_count      INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_messages_tenant ON broadcast_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_event  ON broadcast_messages(event_id);

-- ── Announcement pins ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low','normal','high','urgent')),
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_announcements_event ON event_announcements(event_id);

-- ── Updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_message_thread_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE message_threads
  SET last_message_at = NEW.created_at, updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_thread_last_message ON event_messages;
CREATE TRIGGER trg_update_thread_last_message
  AFTER INSERT ON event_messages
  FOR EACH ROW EXECUTE FUNCTION update_message_thread_last_message();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE message_threads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_message_threads"     ON message_threads     USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_event_messages"      ON event_messages      USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_broadcast_messages"  ON broadcast_messages  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_event_announcements" ON event_announcements USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ============================================================
-- Migration: 037_documents.sql
-- ============================================================
-- ============================================================
-- Migration 037: Document Management
-- event_documents with version control + folder structure
-- ============================================================

CREATE TABLE IF NOT EXISTS event_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  folder_path     TEXT NOT NULL DEFAULT '/',           -- e.g. '/contracts/', '/proposals/'
  document_name   TEXT NOT NULL,
  document_type   TEXT NOT NULL DEFAULT 'other'
                  CHECK (document_type IN (
                    'proposal','contract','invoice','timeline','floor_plan',
                    'mood_board','vendor_list','seating_chart','menu',
                    'runsheet','permit','brief','report','other'
                  )),
  -- Storage: PDF files go to R2; others are external links
  storage_type    TEXT NOT NULL DEFAULT 'upload'
                  CHECK (storage_type IN ('upload','link')),
  file_url        TEXT NOT NULL,                       -- R2 URL for uploads, external URL for links
  file_name       TEXT,
  file_size       BIGINT,                              -- bytes, null for links
  mime_type       TEXT,
  -- Version control
  version         INT NOT NULL DEFAULT 1,
  version_notes   TEXT,
  parent_id       UUID REFERENCES event_documents(id), -- previous version
  is_latest       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Access control
  visibility      TEXT NOT NULL DEFAULT 'team'
                  CHECK (visibility IN ('team','client','vendor','public')),
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status TEXT NOT NULL DEFAULT 'pending'
                  CHECK (approval_status IN ('pending','approved','rejected','not_required')),
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  -- Metadata
  description     TEXT,
  tags            TEXT[] DEFAULT '{}',
  uploaded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_documents_event    ON event_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_event_documents_tenant   ON event_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_documents_type     ON event_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_event_documents_folder   ON event_documents(folder_path);
CREATE INDEX IF NOT EXISTS idx_event_documents_latest   ON event_documents(is_latest) WHERE is_latest = TRUE;

-- ── Document access log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_access_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES event_documents(id) ON DELETE CASCADE,
  accessed_by UUID REFERENCES profiles(id),
  access_type TEXT NOT NULL DEFAULT 'view' CHECK (access_type IN ('view','download','share')),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  TEXT
);

CREATE INDEX IF NOT EXISTS idx_document_access_log_doc ON document_access_log(document_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE event_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_event_documents"
  ON event_documents USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_document_access_log"
  ON document_access_log USING (
    document_id IN (
      SELECT id FROM event_documents WHERE tenant_id = current_setting('app.tenant_id')::uuid
    )
  );

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_event_documents_updated_at ON event_documents;
CREATE TRIGGER set_event_documents_updated_at
  BEFORE UPDATE ON event_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Migration: 038_permits.sql
-- ============================================================
-- ============================================================
-- Migration 038: Legal & Permits Management
-- event_permits, permit_reminders, legal_documents
-- ============================================================

CREATE TABLE IF NOT EXISTS event_permits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Permit identity
  permit_name       TEXT NOT NULL,
  permit_type       TEXT NOT NULL DEFAULT 'other'
                    CHECK (permit_type IN (
                      'noise_permit','fire_safety','police_permission','food_license',
                      'liquor_license','temporary_structure','road_closure',
                      'drone_permit','pyrotechnics','signage','health_safety',
                      'copyright_music','venue_usage','insurance_certificate','other'
                    )),
  permit_number     TEXT,                               -- official reference number
  issuing_authority TEXT,                               -- e.g. "Municipal Corporation"
  jurisdiction      TEXT,                               -- city / state / country
  -- Dates
  applied_date      DATE,
  issued_date       DATE,
  expiry_date       DATE,
  -- Status
  status            TEXT NOT NULL DEFAULT 'not_started'
                    CHECK (status IN (
                      'not_started','applied','under_review','approved',
                      'rejected','expired','renewal_required','not_required'
                    )),
  rejection_reason  TEXT,
  -- Document storage (PDF only → R2; external links allowed)
  storage_type      TEXT NOT NULL DEFAULT 'link'
                    CHECK (storage_type IN ('upload','link')),
  document_url      TEXT,                               -- R2 URL or external URL
  file_name         TEXT,
  file_size         BIGINT,
  -- Smart / intelligence fields
  auto_reminder_days INT[] NOT NULL DEFAULT '{60,30,14,7,1}', -- days before expiry
  is_critical       BOOLEAN NOT NULL DEFAULT FALSE,     -- blocks event if missing
  cost              NUMERIC(12,2),
  currency          TEXT NOT NULL DEFAULT 'INR',
  -- Metadata
  notes             TEXT,
  assigned_to       UUID REFERENCES profiles(id),
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_permits_event    ON event_permits(event_id);
CREATE INDEX IF NOT EXISTS idx_event_permits_tenant   ON event_permits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_permits_status   ON event_permits(status);
CREATE INDEX IF NOT EXISTS idx_event_permits_expiry   ON event_permits(expiry_date);
CREATE INDEX IF NOT EXISTS idx_event_permits_type     ON event_permits(permit_type);

-- ── Permit reminder log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permit_reminder_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id   UUID NOT NULL REFERENCES event_permits(id) ON DELETE CASCADE,
  days_before INT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_to     UUID REFERENCES profiles(id),
  channel     TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','whatsapp'))
);

CREATE INDEX IF NOT EXISTS idx_permit_reminder_log_permit ON permit_reminder_log(permit_id);

-- ── Legal documents (contracts, NDAs, agreements) ────────────────────────────
-- Note: general event documents are in event_documents (migration 037).
-- This table is specifically for legally-binding agreements requiring signatures.
CREATE TABLE IF NOT EXISTS event_legal_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL DEFAULT 'contract'
                  CHECK (doc_type IN (
                    'contract','nda','mou','vendor_agreement',
                    'client_agreement','insurance_policy','indemnity','other'
                  )),
  doc_name        TEXT NOT NULL,
  parties         TEXT[],                               -- ["Client: ABC Corp", "Company: XYZ Events"]
  -- Storage
  storage_type    TEXT NOT NULL DEFAULT 'link'
                  CHECK (storage_type IN ('upload','link')),
  document_url    TEXT,
  file_name       TEXT,
  file_size       BIGINT,
  -- Signature tracking
  signature_status TEXT NOT NULL DEFAULT 'pending'
                  CHECK (signature_status IN ('pending','partially_signed','fully_signed','voided')),
  signed_date     DATE,
  expiry_date     DATE,
  -- Smart fields
  is_critical     BOOLEAN NOT NULL DEFAULT FALSE,
  auto_reminder_days INT[] NOT NULL DEFAULT '{30,7}',
  -- Metadata
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_legal_docs_event  ON event_legal_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_event_legal_docs_tenant ON event_legal_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_legal_docs_status ON event_legal_documents(signature_status);
CREATE INDEX IF NOT EXISTS idx_event_legal_docs_expiry ON event_legal_documents(expiry_date);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE event_permits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_reminder_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_event_permits"
  ON event_permits USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY "tenant_isolation_permit_reminder_log"
  ON permit_reminder_log USING (
    permit_id IN (
      SELECT id FROM event_permits WHERE tenant_id = current_setting('app.tenant_id')::uuid
    )
  );

CREATE POLICY "tenant_isolation_event_legal_documents"
  ON event_legal_documents USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ── Updated_at triggers ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_event_permits_updated_at ON event_permits;
CREATE TRIGGER set_event_permits_updated_at
  BEFORE UPDATE ON event_permits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_event_legal_docs_updated_at ON event_legal_documents;
CREATE TRIGGER set_event_legal_docs_updated_at
  BEFORE UPDATE ON event_legal_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Migration: 039_media.sql
-- ============================================================
-- ============================================================
-- Migration 039: Photography & Videography Management
-- ALL media is stored as EXTERNAL LINKS only (no R2 uploads).
-- Google Drive, Dropbox, WeTransfer, YouTube, Vimeo, etc.
-- Only PDFs (<5MB) and small assets go to R2 — not here.
-- ============================================================

CREATE TABLE IF NOT EXISTS event_shot_lists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category      TEXT NOT NULL DEFAULT 'general'
                CHECK (category IN (
                  'pre_event','ceremony','reception','speeches','candid',
                  'group_photos','detail_shots','venue','guests',
                  'performances','behind_scenes','other'
                )),
  shot_name     TEXT NOT NULL,
  description   TEXT,
  priority      TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('must_have','nice_to_have','optional')),
  people_involved TEXT[],              -- names of people needed for the shot
  location      TEXT,                  -- specific location/area at venue
  time_window   TEXT,                  -- e.g. "During cocktail hour"
  reference_url TEXT,                  -- external reference image (Drive/Dropbox link — NO R2)
  is_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  notes         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_shot_lists_event    ON event_shot_lists(event_id);
CREATE INDEX IF NOT EXISTS idx_event_shot_lists_tenant   ON event_shot_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_shot_lists_category ON event_shot_lists(category);

-- ── Media deliverables (external links only) ──────────────────────────────────
-- Every media_url MUST be an external link. This is enforced at application level.
CREATE TABLE IF NOT EXISTS media_deliverables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Categorisation
  media_category  TEXT NOT NULL DEFAULT 'photos'
                  CHECK (media_category IN (
                    'raw_photos','edited_photos','highlight_reel','full_video',
                    'teaser','same_day_edit','drone_footage','behind_scenes',
                    'photo_album','slideshow','social_cuts','other'
                  )),
  deliverable_name TEXT NOT NULL,
  description     TEXT,
  -- External link storage ONLY (no R2 uploads)
  link_type       TEXT NOT NULL DEFAULT 'drive'
                  CHECK (link_type IN (
                    'google_drive','dropbox','wetransfer','youtube','vimeo',
                    'onedrive','frame_io','smugmug','flickr','other'
                  )),
  media_url       TEXT NOT NULL,        -- external URL
  password_hint   TEXT,                 -- if link is password protected
  -- WeTransfer expiry tracking (links expire in 7 days)
  is_wetransfer   BOOLEAN NOT NULL DEFAULT FALSE,
  wetransfer_expiry DATE,               -- manually entered expiry date
  -- Metadata
  file_count      INT,                  -- approximate count of files
  total_size_gb   NUMERIC(6,2),         -- approximate size
  duration_mins   INT,                  -- for video deliverables
  resolution      TEXT,                 -- e.g. "4K", "1080p", "RAW"
  -- Status & review
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
                    'pending','uploaded_by_vendor','under_review',
                    'approved','revision_requested','delivered_to_client'
                  )),
  revision_notes  TEXT,
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  -- Deadline
  delivery_deadline DATE,
  delivered_at    TIMESTAMPTZ,
  -- Vendor linkage
  vendor_id       UUID REFERENCES vendors(id),
  -- Metadata
  tags            TEXT[] DEFAULT '{}',
  uploaded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_deliverables_event    ON media_deliverables(event_id);
CREATE INDEX IF NOT EXISTS idx_media_deliverables_tenant   ON media_deliverables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_media_deliverables_category ON media_deliverables(media_category);
CREATE INDEX IF NOT EXISTS idx_media_deliverables_status   ON media_deliverables(status);
CREATE INDEX IF NOT EXISTS idx_media_deliverables_deadline ON media_deliverables(delivery_deadline);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE event_shot_lists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_deliverables  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_event_shot_lists"
  ON event_shot_lists USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY "tenant_isolation_media_deliverables"
  ON media_deliverables USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ── Updated_at triggers ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_event_shot_lists_updated_at ON event_shot_lists;
CREATE TRIGGER set_event_shot_lists_updated_at
  BEFORE UPDATE ON event_shot_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_media_deliverables_updated_at ON media_deliverables;
CREATE TRIGGER set_media_deliverables_updated_at
  BEFORE UPDATE ON media_deliverables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Migration: 040_decor.sql
-- ============================================================
-- ============================================================
-- Migration 040: Décor Management
-- decor_zones, decor_items with external reference image links
-- NOTE: No media uploads. All reference images = external URLs only.
-- ============================================================

CREATE TABLE IF NOT EXISTS decor_zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  zone_name     TEXT NOT NULL,          -- e.g. "Mandap", "Entrance", "Stage"
  zone_type     TEXT NOT NULL DEFAULT 'general'
                CHECK (zone_type IN (
                  'entrance','mandap','stage','dining_area','lounge',
                  'photo_booth','bar','dessert_table','kids_zone',
                  'ceremony','reception','cocktail_area','other'
                )),
  description   TEXT,
  color_palette TEXT[],                 -- e.g. ["#FFD700", "#FFFFFF", "#1A1A2E"]
  theme         TEXT,                   -- e.g. "Royal Gold", "Rustic Boho"
  budget        NUMERIC(12,2),
  currency      TEXT NOT NULL DEFAULT 'INR',
  actual_cost   NUMERIC(12,2),
  status        TEXT NOT NULL DEFAULT 'planning'
                CHECK (status IN ('planning','confirmed','in_progress','installed','dismantled')),
  sort_order    INT NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decor_zones_event  ON decor_zones(event_id);
CREATE INDEX IF NOT EXISTS idx_decor_zones_tenant ON decor_zones(tenant_id);

-- ── Décor items ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decor_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  zone_id         UUID REFERENCES decor_zones(id) ON DELETE SET NULL,
  item_name       TEXT NOT NULL,
  item_category   TEXT NOT NULL DEFAULT 'floral'
                  CHECK (item_category IN (
                    'floral','draping','lighting','furniture','props',
                    'centrepiece','backdrop','signage','candles','balloon',
                    'fabric','greenery','water_feature','stationary_props','other'
                  )),
  -- Reference images (EXTERNAL LINKS ONLY — no R2 uploads)
  reference_images TEXT[] DEFAULT '{}',   -- Google Drive / Pinterest / Dropbox URLs
  -- Quantity & sourcing
  quantity        INT NOT NULL DEFAULT 1,
  unit            TEXT NOT NULL DEFAULT 'piece',  -- piece, metre, set, bunch
  source          TEXT NOT NULL DEFAULT 'vendor'
                  CHECK (source IN ('vendor','rental','purchase','client_provided','in_house')),
  vendor_id       UUID REFERENCES vendors(id),
  -- Pricing
  unit_cost       NUMERIC(12,2),
  total_cost      NUMERIC(12,2) GENERATED ALWAYS AS (
                    CASE WHEN unit_cost IS NOT NULL THEN unit_cost * quantity ELSE NULL END
                  ) STORED,
  currency        TEXT NOT NULL DEFAULT 'INR',
  -- Status
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
                    'pending','ordered','confirmed','delivered','installed','returned','cancelled'
                  )),
  -- Logistics
  delivery_date   DATE,
  installation_time TEXT,               -- e.g. "2 hrs before event"
  dismantling_time TEXT,
  -- Metadata
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decor_items_event    ON decor_items(event_id);
CREATE INDEX IF NOT EXISTS idx_decor_items_tenant   ON decor_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decor_items_zone     ON decor_items(zone_id);
CREATE INDEX IF NOT EXISTS idx_decor_items_category ON decor_items(item_category);
CREATE INDEX IF NOT EXISTS idx_decor_items_status   ON decor_items(status);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE decor_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE decor_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_decor_zones"
  ON decor_zones USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_decor_items"
  ON decor_items USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Updated_at triggers
DROP TRIGGER IF EXISTS set_decor_zones_updated_at ON decor_zones;
CREATE TRIGGER set_decor_zones_updated_at
  BEFORE UPDATE ON decor_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_decor_items_updated_at ON decor_items;
CREATE TRIGGER set_decor_items_updated_at
  BEFORE UPDATE ON decor_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

