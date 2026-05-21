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
