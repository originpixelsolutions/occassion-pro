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
