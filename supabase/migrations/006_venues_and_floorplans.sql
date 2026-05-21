-- ============================================================
-- OccasionPro — Migration 006: Venues & Floor Plan Builder
-- ============================================================

-- ── VENUES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT,                   -- hotel | banquet | outdoor | stadium | convention | etc.
  address         JSONB NOT NULL DEFAULT '{}',
  city            TEXT,
  state           TEXT,
  country         TEXT DEFAULT 'IN',
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),
  capacity_min    INTEGER,
  capacity_max    INTEGER,
  area_sqft       INTEGER,
  floors          INTEGER DEFAULT 1,
  parking_capacity INTEGER,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  website         TEXT,
  images          TEXT[] DEFAULT '{}',   -- Cloudflare R2 URLs
  amenities       TEXT[] DEFAULT '{}',
  restrictions    TEXT[] DEFAULT '{}',   -- no alcohol | noise curfew 10pm | etc.
  pricing_notes   TEXT,
  average_cost    NUMERIC(12,2),
  rating          NUMERIC(3,2),          -- 1.00–5.00
  review_count    INTEGER DEFAULT 0,
  is_preferred    BOOLEAN DEFAULT false,
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venues_tenant ON venues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(tenant_id, city);
CREATE INDEX IF NOT EXISTS idx_venues_search ON venues USING gin(to_tsvector('english', name || ' ' || COALESCE(city, '')));

-- Add FK from events to venues
DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT fk_events_venue FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── VENUE BOOKINGS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venue_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  venue_id        UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  booking_date    DATE NOT NULL,
  setup_date      DATE,
  breakdown_date  DATE,
  start_time      TIME,
  end_time        TIME,
  status          TEXT NOT NULL DEFAULT 'tentative',  -- tentative | confirmed | cancelled
  quoted_amount   NUMERIC(14,2),
  paid_amount     NUMERIC(14,2) DEFAULT 0,
  contract_url    TEXT,                   -- Cloudflare R2
  notes           TEXT,
  confirmed_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vb_venue ON venue_bookings(venue_id);
CREATE INDEX IF NOT EXISTS idx_vb_event ON venue_bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_vb_date ON venue_bookings(booking_date);

-- ── FLOOR PLANS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS floor_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  venue_id        UUID REFERENCES venues(id) ON DELETE SET NULL,
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'Main Floor',
  floor_level     INTEGER DEFAULT 0,       -- 0 = ground, 1 = first floor, etc.
  width_units     NUMERIC(10,2),           -- in meters
  height_units    NUMERIC(10,2),           -- in meters
  background_url  TEXT,                    -- uploaded venue blueprint (R2)
  thumbnail_url   TEXT,                    -- generated preview (R2)
  is_published    BOOLEAN DEFAULT false,   -- visible to client
  version         INTEGER DEFAULT 1,
  canvas_data     JSONB NOT NULL DEFAULT '{}',  -- full canvas state (Konva/Fabric)
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fp_event ON floor_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_fp_venue ON floor_plans(venue_id);
CREATE INDEX IF NOT EXISTS idx_fp_tenant ON floor_plans(tenant_id);

-- ── FLOOR PLAN ZONES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS floor_plan_zones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id   UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  zone_type       zone_type NOT NULL DEFAULT 'general',
  color           TEXT DEFAULT '#E5E7EB',
  -- Position on canvas (in units)
  x               NUMERIC(10,2) NOT NULL DEFAULT 0,
  y               NUMERIC(10,2) NOT NULL DEFAULT 0,
  width           NUMERIC(10,2) NOT NULL DEFAULT 100,
  height          NUMERIC(10,2) NOT NULL DEFAULT 100,
  capacity        INTEGER,
  is_restricted   BOOLEAN DEFAULT false,  -- requires special QR access
  access_categories TEXT[] DEFAULT '{}',  -- VIP | speaker | media | etc.
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fpz_floorplan ON floor_plan_zones(floor_plan_id);

-- ── FLOOR PLAN ELEMENTS (tables, chairs, booths, etc.) ───────
CREATE TABLE IF NOT EXISTS floor_plan_elements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id   UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
  zone_id         UUID REFERENCES floor_plan_zones(id) ON DELETE SET NULL,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  element_type    TEXT NOT NULL,          -- table | chair | stage | booth | podium | sofa | etc.
  label           TEXT,                   -- Table 1, Booth A3, etc.
  x               NUMERIC(10,2) NOT NULL DEFAULT 0,
  y               NUMERIC(10,2) NOT NULL DEFAULT 0,
  width           NUMERIC(10,2),
  height          NUMERIC(10,2),
  rotation        NUMERIC(6,2) DEFAULT 0,
  capacity        INTEGER,               -- seats at this table
  vendor_id       UUID,                  -- FK vendors migration (for booth assignments)
  is_reserved     BOOLEAN DEFAULT false,
  assigned_to     TEXT,                   -- name/label for reserved items
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fpe_floorplan ON floor_plan_elements(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_fpe_zone ON floor_plan_elements(zone_id);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS venues_updated_at ON venues;
CREATE TRIGGER venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS vb_updated_at ON venue_bookings;
CREATE TRIGGER vb_updated_at BEFORE UPDATE ON venue_bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS fp_updated_at ON floor_plans;
CREATE TRIGGER fp_updated_at BEFORE UPDATE ON floor_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS fpz_updated_at ON floor_plan_zones;
CREATE TRIGGER fpz_updated_at BEFORE UPDATE ON floor_plan_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS fpe_updated_at ON floor_plan_elements;
CREATE TRIGGER fpe_updated_at BEFORE UPDATE ON floor_plan_elements FOR EACH ROW EXECUTE FUNCTION update_updated_at();