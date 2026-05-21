-- ============================================================
-- 021_advanced_guests.sql
-- Advanced Guest Management & QR Check-in System
-- ============================================================

-- ── Guest Groups / Families ───────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  name          TEXT NOT NULL,
  side          TEXT CHECK (side IN ('bride','groom','mutual','family','corporate','other')),
  relation      TEXT,
  notes         TEXT,
  is_vip        BOOLEAN NOT NULL DEFAULT false,
  primary_contact_name  TEXT,
  primary_contact_phone TEXT,
  primary_contact_email TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Extended Guest Profiles ───────────────────────────────────
-- Extends the existing 'guests' table with additional fields
-- via a separate detail table to avoid altering core schema

CREATE TABLE IF NOT EXISTS guest_details (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id        UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Classification
  group_id        UUID REFERENCES guest_groups(id),
  guest_type      TEXT NOT NULL DEFAULT 'regular'
                  CHECK (guest_type IN ('vip','family','friend','colleague','vendor','media','other','regular')),
  side            TEXT CHECK (side IN ('bride','groom','mutual','family','corporate','other')),
  relation_to_host TEXT,

  -- Meal & Dietary
  meal_preference TEXT CHECK (meal_preference IN ('veg','non_veg','vegan','jain','kosher','halal','custom')),
  dietary_notes   TEXT,
  allergies       TEXT[],
  meal_session    TEXT CHECK (meal_session IN ('breakfast','lunch','dinner','cocktail','all')),

  -- Seating
  table_number    TEXT,
  seat_number     TEXT,
  seating_zone    TEXT,
  seating_confirmed BOOLEAN NOT NULL DEFAULT false,

  -- QR & Check-in
  qr_code         TEXT UNIQUE,
  checked_in      BOOLEAN NOT NULL DEFAULT false,
  check_in_time   TIMESTAMPTZ,
  check_in_gate   TEXT,
  checked_in_by   UUID REFERENCES profiles(id),

  -- RSVP
  rsvp_status     TEXT NOT NULL DEFAULT 'pending'
                  CHECK (rsvp_status IN ('pending','confirmed','declined','tentative','no_show')),
  rsvp_responded_at TIMESTAMPTZ,
  rsvp_notes      TEXT,
  plus_one_allowed  BOOLEAN NOT NULL DEFAULT false,
  plus_one_name     TEXT,
  plus_one_checked_in BOOLEAN NOT NULL DEFAULT false,

  -- Gifting
  gift_received   BOOLEAN NOT NULL DEFAULT false,
  gift_description TEXT,
  gift_amount     NUMERIC(10,2),
  gift_acknowledged BOOLEAN NOT NULL DEFAULT false,
  gift_acknowledged_at TIMESTAMPTZ,

  -- Communication
  invite_sent     BOOLEAN NOT NULL DEFAULT false,
  invite_sent_at  TIMESTAMPTZ,
  invite_channel  TEXT CHECK (invite_channel IN ('whatsapp','email','sms','courier','hand_delivered')),
  reminder_sent   BOOLEAN NOT NULL DEFAULT false,

  -- Hospitality
  transport_needed BOOLEAN NOT NULL DEFAULT false,
  hotel_needed     BOOLEAN NOT NULL DEFAULT false,
  special_assistance TEXT,

  -- Priority / Badge
  badge_color     TEXT,
  access_zones    TEXT[] DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(guest_id, event_id)
);

-- ── Tables / Seating Chart ────────────────────────────────────
CREATE TABLE IF NOT EXISTS seating_tables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  table_number    TEXT NOT NULL,
  table_name      TEXT,
  table_type      TEXT NOT NULL DEFAULT 'round'
                  CHECK (table_type IN ('round','rectangular','square','banquet','cocktail','head_table','kids')),
  capacity        INTEGER NOT NULL DEFAULT 10,
  zone            TEXT,

  -- Position on floor plan
  pos_x           NUMERIC(6,2),
  pos_y           NUMERIC(6,2),

  assigned_count  INTEGER NOT NULL DEFAULT 0,
  is_reserved     BOOLEAN NOT NULL DEFAULT false,
  reserved_for    TEXT,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, table_number)
);

-- ── QR Check-in Log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkin_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id        UUID REFERENCES guests(id),

  qr_code         TEXT,
  scan_result     TEXT NOT NULL DEFAULT 'success'
                  CHECK (scan_result IN ('success','already_checked_in','invalid_code','wrong_event')),
  gate_name       TEXT,
  scanned_by      UUID REFERENCES profiles(id),
  device_id       TEXT,
  ip_address      TEXT,

  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Gift Registry ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_registry_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  item_name       TEXT NOT NULL,
  description     TEXT,
  quantity_needed INTEGER NOT NULL DEFAULT 1,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  estimated_price NUMERIC(10,2),
  store_url       TEXT,
  image_url       TEXT,
  category        TEXT,

  is_fulfilled    BOOLEAN NOT NULL DEFAULT false,
  fulfilled_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Guest Import Batch ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_import_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  filename        TEXT NOT NULL,
  total_rows      INTEGER NOT NULL DEFAULT 0,
  imported        INTEGER NOT NULL DEFAULT 0,
  failed          INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'processing'
                  CHECK (status IN ('processing','completed','failed','partial')),
  error_log       JSONB DEFAULT '[]',

  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_guest_details_event       ON guest_details(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_details_guest       ON guest_details(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_details_qr          ON guest_details(qr_code);
CREATE INDEX IF NOT EXISTS idx_guest_details_table       ON guest_details(event_id, table_number);
CREATE INDEX IF NOT EXISTS idx_guest_details_rsvp        ON guest_details(event_id, rsvp_status);
CREATE INDEX IF NOT EXISTS idx_guest_details_checkin     ON guest_details(event_id, checked_in);
CREATE INDEX IF NOT EXISTS idx_guest_groups_event        ON guest_groups(event_id);
CREATE INDEX IF NOT EXISTS idx_seating_tables_event      ON seating_tables(event_id);
CREATE INDEX IF NOT EXISTS idx_checkin_log_event         ON checkin_log(event_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkin_log_qr            ON checkin_log(qr_code);
CREATE INDEX IF NOT EXISTS idx_gift_registry_event       ON gift_registry_items(event_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE guest_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_details         ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_tables        ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_registry_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_import_batches  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON guest_groups
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON guest_details
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON seating_tables
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON checkin_log
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON gift_registry_items
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON guest_import_batches
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Helper function: Generate QR code for guest ───────────────
CREATE OR REPLACE FUNCTION generate_guest_qr(p_guest_id UUID, p_event_id UUID)
RETURNS TEXT AS $$
  SELECT encode(digest(p_guest_id::text || p_event_id::text || extract(epoch from now())::text, 'sha256'), 'hex');
$$ LANGUAGE SQL;
