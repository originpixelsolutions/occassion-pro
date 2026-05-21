-- Migration 077: Food & Beverage (F&B) Module
-- Full F&B lifecycle: menus → items → token batches → tokens → consumption log → stations

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fnb_meal_type') THEN
    CREATE TYPE fnb_meal_type AS ENUM (
      'breakfast', 'brunch', 'lunch', 'hi_tea', 'dinner',
      'cocktail', 'buffet', 'food_stall', 'live_counter',
      'dessert_counter', 'bar', 'mocktail_counter',
      'welcome_drink', 'midnight_snack', 'custom'
    );
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fnb_dietary_type') THEN
    CREATE TYPE fnb_dietary_type AS ENUM (
      'veg', 'non_veg', 'vegan', 'jain', 'gluten_free', 'dairy_free'
    );
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fnb_token_status') THEN
    CREATE TYPE fnb_token_status AS ENUM (
      'unissued', 'issued', 'redeemed', 'expired', 'void'
    );
  END IF;
END$$;

-- ─── fnb_menus ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_menus (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255)  NOT NULL,
  description TEXT,
  meal_type   fnb_meal_type NOT NULL DEFAULT 'custom',
  is_active   BOOLEAN       NOT NULL DEFAULT true,
  sort_order  INTEGER       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_menus_event   ON fnb_menus (event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_menus_tenant  ON fnb_menus (tenant_id);

-- ─── fnb_menu_items ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_menu_items (
  id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id             UUID              NOT NULL REFERENCES fnb_menus(id) ON DELETE CASCADE,
  event_id            UUID              NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           UUID              NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                VARCHAR(255)      NOT NULL,
  description         TEXT,
  category            VARCHAR(100),
  dietary_type        fnb_dietary_type  NOT NULL DEFAULT 'veg',
  allergens           TEXT[]            NOT NULL DEFAULT '{}',
  estimated_quantity  INTEGER,
  actual_quantity     INTEGER,
  unit                VARCHAR(50)       DEFAULT 'serving',
  cost_per_unit       NUMERIC(12, 2),
  sort_order          INTEGER           NOT NULL DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_items_menu    ON fnb_menu_items (menu_id);
CREATE INDEX IF NOT EXISTS idx_fnb_items_event   ON fnb_menu_items (event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_items_dietary ON fnb_menu_items (dietary_type);

-- ─── fnb_token_batches ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_token_batches (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id        UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_id          UUID         REFERENCES fnb_menus(id) ON DELETE SET NULL,
  batch_name       VARCHAR(255) NOT NULL,
  token_prefix     VARCHAR(20)  NOT NULL DEFAULT 'TKN',
  total_tokens     INTEGER      NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  tokens_issued    INTEGER      NOT NULL DEFAULT 0,
  tokens_redeemed  INTEGER      NOT NULL DEFAULT 0,
  valid_from       TIMESTAMPTZ,
  valid_until      TIMESTAMPTZ,
  created_by       UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_batches_event ON fnb_token_batches (event_id);

-- ─── fnb_tokens ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_tokens (
  id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     UUID             NOT NULL REFERENCES fnb_token_batches(id) ON DELETE CASCADE,
  event_id     UUID             NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id    UUID             NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  guest_id     UUID             REFERENCES guests(id) ON DELETE SET NULL,
  token_code   VARCHAR(100)     NOT NULL UNIQUE,
  qr_data      TEXT             NOT NULL,
  status       fnb_token_status NOT NULL DEFAULT 'unissued',
  issued_at    TIMESTAMPTZ,
  redeemed_at  TIMESTAMPTZ,
  redeemed_by  UUID             REFERENCES profiles(id) ON DELETE SET NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_tokens_event    ON fnb_tokens (event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_tokens_batch    ON fnb_tokens (batch_id);
CREATE INDEX IF NOT EXISTS idx_fnb_tokens_guest    ON fnb_tokens (guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fnb_tokens_status   ON fnb_tokens (status);
CREATE INDEX IF NOT EXISTS idx_fnb_tokens_code     ON fnb_tokens (token_code);

-- ─── fnb_consumption_log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_consumption_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_id         UUID        REFERENCES fnb_tokens(id) ON DELETE SET NULL,
  guest_id         UUID        REFERENCES guests(id) ON DELETE SET NULL,
  menu_item_id     UUID        NOT NULL REFERENCES fnb_menu_items(id) ON DELETE CASCADE,
  quantity         INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  served_by        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  served_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  serving_station  VARCHAR(255),
  notes            TEXT
);

CREATE INDEX IF NOT EXISTS idx_fnb_log_event       ON fnb_consumption_log (event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_log_item        ON fnb_consumption_log (menu_item_id);
CREATE INDEX IF NOT EXISTS idx_fnb_log_guest       ON fnb_consumption_log (guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fnb_log_station     ON fnb_consumption_log (event_id, serving_station);
CREATE INDEX IF NOT EXISTS idx_fnb_log_served_at   ON fnb_consumption_log (served_at DESC);

-- ─── fnb_serving_stations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_serving_stations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  menu_ids    UUID[]      NOT NULL DEFAULT '{}',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_stations_event ON fnb_serving_stations (event_id);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Enable realtime so the scanner UI gets instant token-redeemed updates
ALTER PUBLICATION supabase_realtime ADD TABLE fnb_tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE fnb_consumption_log;

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fnb_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['fnb_menus','fnb_menu_items','fnb_token_batches','fnb_tokens','fnb_serving_stations']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fnb_set_updated_at()', t, t);
  END LOOP;
END$$;

-- ─── Comments ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE fnb_menus IS 'Named menus per event with meal_type classification';
COMMENT ON TABLE fnb_menu_items IS 'Individual dishes/drinks within a menu with dietary and allergen info';
COMMENT ON TABLE fnb_token_batches IS 'Batch of F&B tokens for controlled food access (e.g. 1 dinner token per guest)';
COMMENT ON TABLE fnb_tokens IS 'Individual scan-able tokens; redeemed at serving stations via QR';
COMMENT ON TABLE fnb_consumption_log IS 'Granular log of every item served — used for consumption reports and cost analysis';
COMMENT ON TABLE fnb_serving_stations IS 'Physical or logical stations where food is distributed';
