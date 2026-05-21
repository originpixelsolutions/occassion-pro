-- ============================================================
-- Migration 019: Artist & Talent Management
-- ============================================================

-- ─── Artists / Talent Registry ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artists (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  stage_name        TEXT,
  genre             TEXT,                          -- 'Bollywood', 'EDM', 'Classical', 'Comedy', etc.
  category          TEXT DEFAULT 'performer'
    CHECK (category IN ('performer','dj','band','comedian','speaker','emcee','dancer','acrobat','magician','celebrity','other')),
  nationality       TEXT,
  languages         TEXT[],
  bio               TEXT,
  profile_image_url TEXT,
  website_url       TEXT,
  instagram_url     TEXT,
  youtube_url       TEXT,
  spotify_url       TEXT,
  agent_name        TEXT,
  agent_email       TEXT,
  agent_phone       TEXT,
  manager_name      TEXT,
  manager_email     TEXT,
  manager_phone     TEXT,
  base_fee          NUMERIC(14,2),
  currency          TEXT DEFAULT 'INR',
  tags              TEXT[],
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artists_tenant   ON artists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artists_category ON artists(tenant_id, category);

-- ─── Artist Bookings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artist_bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  artist_id         UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  set_name          TEXT,                           -- "Opening Act", "Main Set", "DJ Night"
  set_type          TEXT DEFAULT 'performance'
    CHECK (set_type IN ('performance','keynote','workshop','meet_greet','soundcheck','rehearsal','other')),
  start_time        TIMESTAMPTZ,
  duration_minutes  INTEGER DEFAULT 60,
  stage             TEXT,                           -- Which stage / venue area
  set_order         INTEGER DEFAULT 0,             -- Order on bill
  fee               NUMERIC(14,2),
  currency          TEXT DEFAULT 'INR',
  fee_status        TEXT DEFAULT 'quoted'
    CHECK (fee_status IN ('quoted','negotiating','agreed','advance_paid','fully_paid','disputed')),
  advance_amount    NUMERIC(14,2),
  advance_paid_at   TIMESTAMPTZ,
  balance_due       NUMERIC(14,2),
  contract_url      TEXT,
  contract_signed   BOOLEAN DEFAULT false,
  rider_url         TEXT,
  status            TEXT DEFAULT 'enquiry'
    CHECK (status IN ('enquiry','negotiating','booked','confirmed','on_site','performed','cancelled','no_show')),
  cancellation_fee  NUMERIC(14,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_bookings_event  ON artist_bookings(event_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_artist_bookings_artist ON artist_bookings(artist_id);

-- ─── Artist Riders ────────────────────────────────────────────────────────────
-- Technical and hospitality rider items for an artist booking
CREATE TABLE IF NOT EXISTS artist_riders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id        UUID NOT NULL REFERENCES artist_bookings(id) ON DELETE CASCADE,
  rider_type        TEXT DEFAULT 'technical'
    CHECK (rider_type IN ('technical','hospitality','security','transport','accommodation')),
  item              TEXT NOT NULL,
  quantity          INTEGER DEFAULT 1,
  specification     TEXT,
  is_mandatory      BOOLEAN DEFAULT true,
  fulfilled         BOOLEAN DEFAULT false,
  fulfilled_by      UUID REFERENCES profiles(id),
  fulfilled_at      TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_riders_booking ON artist_riders(booking_id);

-- ─── Artist Schedule / Itinerary ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artist_itinerary (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id        UUID NOT NULL REFERENCES artist_bookings(id) ON DELETE CASCADE,
  activity          TEXT NOT NULL,          -- 'Arrival', 'Soundcheck', 'Green Room', 'Performance', etc.
  activity_type     TEXT DEFAULT 'other'
    CHECK (activity_type IN ('travel','arrival','check_in','soundcheck','meet_greet','performance','interview','dinner','departure','other')),
  scheduled_time    TIMESTAMPTZ NOT NULL,
  duration_minutes  INTEGER DEFAULT 30,
  location          TEXT,
  notes             TEXT,
  status            TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','completed','cancelled')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_itinerary_booking ON artist_itinerary(booking_id, scheduled_time);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_artists" ON artists
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE artist_bookings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_artist_bookings" ON artist_bookings
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE artist_riders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_artist_riders" ON artist_riders
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE artist_itinerary ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_artist_itinerary" ON artist_itinerary
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
