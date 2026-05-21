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
