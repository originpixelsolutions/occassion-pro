-- ============================================================
-- OccasionPro — Migration 008: Guests, Check-in & Badges
-- ============================================================

-- ── GUEST CATEGORIES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,          -- VIP | General | Media | Speaker | Staff | Vendor
  color           TEXT DEFAULT '#1D4ED8',
  badge_color     TEXT DEFAULT '#FFFFFF',
  access_zones    TEXT[] DEFAULT '{}',    -- zone IDs from floor_plan_zones
  max_capacity    INTEGER,
  is_default      BOOLEAN DEFAULT false,
  priority        INTEGER DEFAULT 0,      -- higher = more access
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gc_event ON guest_categories(event_id);
CREATE INDEX IF NOT EXISTS idx_gc_tenant ON guest_categories(tenant_id);

-- ── GUESTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES guest_categories(id) ON DELETE SET NULL,
  -- Identity
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  company         TEXT,
  designation     TEXT,
  avatar_url      TEXT,
  -- RSVP
  rsvp_status     rsvp_status NOT NULL DEFAULT 'pending',
  rsvp_at         TIMESTAMPTZ,
  rsvp_token      TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  -- Plus one
  plus_one_allowed BOOLEAN DEFAULT false,
  plus_one_name   TEXT,
  plus_one_email  TEXT,
  -- Dietary & Accessibility
  dietary_requirements TEXT[] DEFAULT '{}',
  accessibility_needs TEXT,
  -- Table Assignment
  table_element_id UUID REFERENCES floor_plan_elements(id) ON DELETE SET NULL,
  seat_number     TEXT,
  -- QR Check-in
  qr_code         TEXT UNIQUE DEFAULT encode(gen_random_bytes(20), 'hex'),
  qr_code_url     TEXT,                   -- Cloudflare R2 (pre-rendered QR image)
  -- Ticket (for ticketed events)
  ticket_id       UUID,                   -- FK added in microsites migration
  -- Wallet passes
  apple_wallet_pass_url TEXT,
  google_wallet_pass_url TEXT,
  -- Metadata
  is_walk_in      BOOLEAN DEFAULT false,
  source          TEXT,                   -- imported | microsite | manual | api
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  invited_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guests_event ON guests(event_id);
CREATE INDEX IF NOT EXISTS idx_guests_tenant ON guests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guests_category ON guests(category_id);
CREATE INDEX IF NOT EXISTS idx_guests_qr ON guests(qr_code);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_guests_rsvp ON guests(event_id, rsvp_status);
CREATE INDEX IF NOT EXISTS idx_guests_search ON guests USING gin(to_tsvector('english', full_name || ' ' || COALESCE(email, '') || ' ' || COALESCE(company, '')));

-- ── CHECK-IN ZONES ───────────────────────────────────────────
-- Defines active check-in points for an event
CREATE TABLE IF NOT EXISTS checkin_zones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  floor_zone_id   UUID REFERENCES floor_plan_zones(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,          -- Main Entrance | VIP Gate | Hall B etc.
  allowed_categories TEXT[] DEFAULT '{}', -- empty = all categories allowed
  is_active       BOOLEAN DEFAULT true,
  kiosk_mode      BOOLEAN DEFAULT false,  -- is this zone running in kiosk mode?
  current_count   INTEGER DEFAULT 0,      -- real-time count (updated via DO)
  max_capacity    INTEGER,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cz_event ON checkin_zones(event_id);

-- ── CHECK-IN LOG ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkin_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id        UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  zone_id         UUID REFERENCES checkin_zones(id) ON DELETE SET NULL,
  status          checkin_status NOT NULL DEFAULT 'checked_in',
  scanned_by      UUID REFERENCES profiles(id),  -- NULL if self-service kiosk
  is_kiosk_scan   BOOLEAN DEFAULT false,
  device_id       TEXT,                   -- kiosk device identifier
  ip_address      INET,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cl_event ON checkin_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_cl_guest ON checkin_logs(guest_id);
CREATE INDEX IF NOT EXISTS idx_cl_zone ON checkin_logs(zone_id);
CREATE INDEX IF NOT EXISTS idx_cl_created ON checkin_logs(created_at DESC);

-- ── BADGE TEMPLATES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badge_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES guest_categories(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  -- Badge dimensions
  width_mm        INTEGER NOT NULL DEFAULT 90,
  height_mm       INTEGER NOT NULL DEFAULT 54,
  -- Design JSON (field positions, styles)
  design_data     JSONB NOT NULL DEFAULT '{}',
  background_color TEXT DEFAULT '#FFFFFF',
  background_image_url TEXT,
  -- Fields to show
  show_name       BOOLEAN DEFAULT true,
  show_company    BOOLEAN DEFAULT true,
  show_designation BOOLEAN DEFAULT true,
  show_category   BOOLEAN DEFAULT true,
  show_qr         BOOLEAN DEFAULT true,
  show_logo       BOOLEAN DEFAULT true,
  show_event_name BOOLEAN DEFAULT true,
  -- Printer config
  printer_type    TEXT DEFAULT 'standard',  -- standard | zebra | brother
  is_default      BOOLEAN DEFAULT false,
  thumbnail_url   TEXT,                   -- Cloudflare R2 preview
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bt_event ON badge_templates(event_id);
CREATE INDEX IF NOT EXISTS idx_bt_tenant ON badge_templates(tenant_id);

-- ── BADGE PRINT QUEUE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badge_print_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id        UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES badge_templates(id),
  zone_id         UUID REFERENCES checkin_zones(id),
  status          TEXT NOT NULL DEFAULT 'queued',  -- queued | printing | printed | failed | reprinted
  triggered_by    TEXT NOT NULL DEFAULT 'checkin', -- checkin | manual | bulk | kiosk
  printer_id      TEXT,
  printed_at      TIMESTAMPTZ,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bpq_event ON badge_print_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_bpq_guest ON badge_print_queue(guest_id);
CREATE INDEX IF NOT EXISTS idx_bpq_status ON badge_print_queue(event_id, status);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS guests_updated_at ON guests;
CREATE TRIGGER guests_updated_at BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS cz_updated_at ON checkin_zones;
CREATE TRIGGER cz_updated_at BEFORE UPDATE ON checkin_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS bt_updated_at ON badge_templates;
CREATE TRIGGER bt_updated_at BEFORE UPDATE ON badge_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
