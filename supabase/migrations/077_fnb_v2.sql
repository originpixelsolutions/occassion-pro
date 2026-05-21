-- ============================================================
-- OccasionPro — Migration 077: F&B Module v2
--
-- Full F&B management schema — menus, items, serving stations,
-- token batches, token issuance, and consumption logging.
--
-- Referenced by: fnb.service.ts
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE fnb_meal_type     AS ENUM ('breakfast','lunch','dinner','brunch','hi_tea','snacks','cocktail','supper','custom');
  CREATE TYPE fnb_dietary_type  AS ENUM ('veg','non_veg','vegan','jain','gluten_free','kosher','halal','custom');
  CREATE TYPE fnb_serving_type  AS ENUM ('plated','buffet','live_cooking','thali','token','bar_service','food_stall','family_style','canape','cocktail_style','packed','custom');
  CREATE TYPE fnb_station_type  AS ENUM ('buffet','live','bar','dessert','juice','tea_coffee','welcome_drink','custom');
  CREATE TYPE fnb_token_status  AS ENUM ('issued','used','expired','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── fnb_menus ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_menus (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL,
  name           text        NOT NULL,
  meal_type      fnb_meal_type NOT NULL DEFAULT 'custom',
  service_time   timestamptz,
  guest_count    int,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_menus_event ON fnb_menus(event_id);

-- ── fnb_menu_items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_menu_items (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id         uuid         NOT NULL REFERENCES fnb_menus(id) ON DELETE CASCADE,
  event_id        uuid         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id       uuid         NOT NULL,
  name            text         NOT NULL,
  description     text,
  category        text,                             -- e.g. 'starter', 'main', 'dessert'
  dietary_type    fnb_dietary_type NOT NULL DEFAULT 'veg',
  serving_type    fnb_serving_type NOT NULL DEFAULT 'buffet',
  quantity        numeric(10,2),
  unit            text,                             -- 'kg', 'pcs', 'litre', etc.
  cost_per_unit   numeric(12,2),
  total_cost      numeric(14,2),
  sort_order      int          NOT NULL DEFAULT 0,
  is_active       boolean      NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_menu_items_menu   ON fnb_menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_fnb_menu_items_event  ON fnb_menu_items(event_id);

-- ── fnb_serving_stations ──────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_serving_stations (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL,
  name           text        NOT NULL,
  station_type   fnb_station_type NOT NULL DEFAULT 'buffet',
  location       text,
  capacity       int,
  staff_count    int         NOT NULL DEFAULT 0,
  assigned_items jsonb       NOT NULL DEFAULT '[]'::jsonb,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_serving_stations_event ON fnb_serving_stations(event_id);

-- ── fnb_token_batches ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_token_batches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id       uuid        NOT NULL,
  menu_item_id    uuid        REFERENCES fnb_menu_items(id) ON DELETE SET NULL,
  batch_code      text        NOT NULL,
  total_tokens    int         NOT NULL DEFAULT 0,
  issued_tokens   int         NOT NULL DEFAULT 0,
  batch_type      text        NOT NULL DEFAULT 'standard',
  notes           text,
  valid_from      timestamptz,
  valid_until     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fnb_token_batches_code_unique UNIQUE (event_id, batch_code)
);

CREATE INDEX IF NOT EXISTS idx_fnb_token_batches_event ON fnb_token_batches(event_id);

-- ── fnb_tokens ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid        NOT NULL REFERENCES fnb_token_batches(id) ON DELETE CASCADE,
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id     uuid        NOT NULL,
  guest_id      uuid        REFERENCES guests(id) ON DELETE SET NULL,
  token_code    text        NOT NULL,
  status        fnb_token_status NOT NULL DEFAULT 'issued',
  used_at       timestamptz,
  used_at_station text,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fnb_tokens_code_unique UNIQUE (event_id, token_code)
);

CREATE INDEX IF NOT EXISTS idx_fnb_tokens_batch   ON fnb_tokens(batch_id);
CREATE INDEX IF NOT EXISTS idx_fnb_tokens_guest   ON fnb_tokens(guest_id);
CREATE INDEX IF NOT EXISTS idx_fnb_tokens_event   ON fnb_tokens(event_id);

-- ── fnb_consumption_log ───────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_consumption_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL,
  menu_item_id   uuid        REFERENCES fnb_menu_items(id) ON DELETE SET NULL,
  guest_id       uuid        REFERENCES guests(id) ON DELETE SET NULL,
  quantity       numeric(10,2) NOT NULL DEFAULT 1,
  station        text,
  consumed_at    timestamptz NOT NULL DEFAULT now(),
  notes          text
);

CREATE INDEX IF NOT EXISTS idx_fnb_consumption_log_event ON fnb_consumption_log(event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_consumption_log_item  ON fnb_consumption_log(menu_item_id);

-- ── RLS (tenant-scoped) ───────────────────────────────────
ALTER TABLE fnb_menus          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_menu_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_serving_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_token_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_consumption_log ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['fnb_menus','fnb_menu_items','fnb_serving_stations','fnb_token_batches','fnb_tokens','fnb_consumption_log'] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_tenant" ON %1$s FOR ALL
        USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()))
        WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));
      CREATE POLICY "%1$s_service" ON %1$s FOR ALL USING (auth.role() = 'service_role');
    $f$, t);
  END LOOP;
END $$;
