-- ============================================================
-- Migration 018: Hospitality & Accommodation Module
-- ============================================================

-- ─── Room Blocks ──────────────────────────────────────────────────────────────
-- Hotel/venue room blocks reserved for an event
CREATE TABLE IF NOT EXISTS room_blocks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  hotel_name        TEXT NOT NULL,
  hotel_address     TEXT,
  hotel_phone       TEXT,
  hotel_contact     TEXT,
  room_type         TEXT NOT NULL,          -- 'Deluxe', 'Suite', 'Standard', etc.
  total_rooms       INTEGER NOT NULL DEFAULT 0,
  confirmed_rooms   INTEGER DEFAULT 0,
  occupied_rooms    INTEGER DEFAULT 0,
  rate_per_night    NUMERIC(12,2),
  currency          TEXT DEFAULT 'INR',
  check_in_date     DATE,
  check_out_date    DATE,
  cutoff_date       DATE,                   -- Date by which bookings must be made
  contract_url      TEXT,
  notes             TEXT,
  status            TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','negotiating','confirmed','cancelled')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_blocks_event  ON room_blocks(event_id, tenant_id);

-- ─── Guest Accommodation ──────────────────────────────────────────────────────
-- Tracks individual guest room assignments
CREATE TABLE IF NOT EXISTS guest_accommodation (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  room_block_id     UUID REFERENCES room_blocks(id) ON DELETE SET NULL,
  guest_name        TEXT NOT NULL,
  guest_email       TEXT,
  guest_phone       TEXT,
  room_number       TEXT,
  room_type         TEXT,
  check_in_date     DATE,
  check_out_date    DATE,
  check_in_time     TIMESTAMPTZ,
  check_out_time    TIMESTAMPTZ,
  status            TEXT DEFAULT 'reserved'
    CHECK (status IN ('reserved','confirmed','checked_in','checked_out','cancelled','no_show')),
  special_requests  TEXT,
  is_vip            BOOLEAN DEFAULT false,
  is_complimentary  BOOLEAN DEFAULT false,
  cost              NUMERIC(12,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_accom_event  ON guest_accommodation(event_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_guest_accom_block  ON guest_accommodation(room_block_id);

-- ─── F&B Planning ─────────────────────────────────────────────────────────────
-- Food & Beverage plans for event sessions
CREATE TABLE IF NOT EXISTS fnb_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,          -- 'Welcome Dinner', 'Day 1 Lunch', 'Cocktail Hour'
  meal_type         TEXT DEFAULT 'other'
    CHECK (meal_type IN ('breakfast','lunch','dinner','cocktails','snacks','welcome_drink','high_tea','gala','other')),
  scheduled_time    TIMESTAMPTZ,
  duration_minutes  INTEGER DEFAULT 60,
  location          TEXT,
  pax_count         INTEGER DEFAULT 0,      -- Number of people
  menu_style        TEXT DEFAULT 'buffet'
    CHECK (menu_style IN ('buffet','plated','family_style','cocktail','live_counters','boxed','mixed')),
  vendor_id         UUID REFERENCES vendors(id),
  menu_items        JSONB DEFAULT '[]',     -- [{name, description, dietary, quantity}]
  dietary_counts    JSONB DEFAULT '{}',     -- {vegetarian: 10, vegan: 5, gluten_free: 2}
  cost_per_head     NUMERIC(12,2),
  total_cost        NUMERIC(12,2),
  status            TEXT DEFAULT 'planning'
    CHECK (status IN ('planning','confirmed','in_progress','completed','cancelled')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fnb_plans_event ON fnb_plans(event_id, tenant_id);

-- ─── VIP Hospitality ──────────────────────────────────────────────────────────
-- VIP treatment plans and requirements
CREATE TABLE IF NOT EXISTS vip_hospitality (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_name        TEXT NOT NULL,
  guest_type        TEXT DEFAULT 'guest'
    CHECK (guest_type IN ('artist','dignitary','sponsor','celebrity','media','client','family','other')),
  company           TEXT,
  designation       TEXT,
  requirements      TEXT,                   -- Special requirements
  room_block_id     UUID REFERENCES room_blocks(id),
  accommodation     TEXT,                   -- Room type / hotel name override
  transport_needed  BOOLEAN DEFAULT false,
  transport_notes   TEXT,
  dietary_notes     TEXT,
  security_needed   BOOLEAN DEFAULT false,
  security_notes    TEXT,
  protocol_notes    TEXT,                   -- Special protocol / seating
  assigned_to       UUID REFERENCES profiles(id), -- Dedicated host/handler
  arrival_time      TIMESTAMPTZ,
  departure_time    TIMESTAMPTZ,
  flight_details    TEXT,
  gift_arranged     BOOLEAN DEFAULT false,
  status            TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','arrived','completed','cancelled')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vip_hospitality_event ON vip_hospitality(event_id, tenant_id);

-- ─── Transport Coordination ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transport_bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type              TEXT DEFAULT 'transfer'
    CHECK (type IN ('airport_pickup','airport_drop','hotel_venue','venue_hotel','intercity','sightseeing','other')),
  passenger_name    TEXT NOT NULL,
  passenger_count   INTEGER DEFAULT 1,
  pickup_location   TEXT NOT NULL,
  dropoff_location  TEXT NOT NULL,
  pickup_time       TIMESTAMPTZ NOT NULL,
  vehicle_type      TEXT DEFAULT 'sedan'
    CHECK (vehicle_type IN ('sedan','suv','van','bus','luxury','ambulance','other')),
  vehicle_number    TEXT,
  driver_name       TEXT,
  driver_phone      TEXT,
  vendor_id         UUID REFERENCES vendors(id),
  vip_id            UUID REFERENCES vip_hospitality(id) ON DELETE SET NULL,
  status            TEXT DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','confirmed','dispatched','completed','cancelled','no_show')),
  actual_pickup_time TIMESTAMPTZ,
  cost              NUMERIC(12,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_event   ON transport_bookings(event_id, pickup_time);
CREATE INDEX IF NOT EXISTS idx_transport_tenant  ON transport_bookings(tenant_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE room_blocks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_room_blocks" ON room_blocks
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE guest_accommodation ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_guest_accommodation" ON guest_accommodation
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE fnb_plans ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_fnb_plans" ON fnb_plans
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE vip_hospitality ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_vip_hospitality" ON vip_hospitality
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE transport_bookings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_transport_bookings" ON transport_bookings
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
