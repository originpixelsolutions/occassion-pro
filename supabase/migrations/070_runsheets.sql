-- Migration 070: Runsheets (Event Day Timeline)
-- Real-time collaborative operational runsheet for event day management

-- Item status enum
DO $$ BEGIN
  CREATE TYPE runsheet_item_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'skipped',
  'delayed'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Item category enum
DO $$ BEGIN
  CREATE TYPE runsheet_item_category AS ENUM (
  'Setup',
  'Ceremony',
  'Reception',
  'Performance',
  'Speech',
  'Catering',
  'Technical',
  'Transport',
  'VIP',
  'Media',
  'Rehearsal',
  'Breakdown',
  'Other'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- runsheets (one per event)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title          varchar(100) NOT NULL DEFAULT 'Event Runsheet',
  is_locked      boolean NOT NULL DEFAULT false,
  locked_by      uuid REFERENCES auth.users(id),
  locked_at      timestamptz,
  version        integer NOT NULL DEFAULT 1,
  created_by     uuid NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

-- ─────────────────────────────────────────────
-- runsheet_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheet_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runsheet_id       uuid NOT NULL REFERENCES runsheets(id) ON DELETE CASCADE,
  parent_id         uuid REFERENCES runsheet_items(id) ON DELETE CASCADE,
  position          decimal(12,4) NOT NULL DEFAULT 1000,          -- fractional indexing
  start_time        timestamptz,
  end_time          timestamptz,
  duration_minutes  integer,
  title             varchar(255) NOT NULL,
  description       text,
  category          runsheet_item_category NOT NULL DEFAULT 'Other',
  assigned_to       uuid[] NOT NULL DEFAULT '{}',                  -- team member user IDs
  assigned_vendors  uuid[] NOT NULL DEFAULT '{}',                  -- vendor_account IDs
  status            runsheet_item_status NOT NULL DEFAULT 'pending',
  delay_minutes     integer NOT NULL DEFAULT 0,
  is_guest_visible  boolean NOT NULL DEFAULT false,
  notes             text,
  color             varchar(7),                                    -- hex color e.g. #3b82f6
  is_deleted        boolean NOT NULL DEFAULT false,
  created_by        uuid REFERENCES auth.users(id),
  updated_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- runsheet_item_comments
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheet_item_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES runsheet_items(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  comment     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- runsheet_versions (snapshots)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheet_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runsheet_id  uuid NOT NULL REFERENCES runsheets(id) ON DELETE CASCADE,
  version      integer NOT NULL,
  label        varchar(100),                                       -- optional human label
  snapshot     jsonb NOT NULL,                                     -- full items array
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_runsheets_event     ON runsheets(event_id);
CREATE INDEX IF NOT EXISTS idx_runsheets_tenant    ON runsheets(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runsheet_items_sheet    ON runsheet_items(runsheet_id);
CREATE INDEX IF NOT EXISTS idx_runsheet_items_parent   ON runsheet_items(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_runsheet_items_pos      ON runsheet_items(runsheet_id, position) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_runsheet_items_status   ON runsheet_items(runsheet_id, status) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_runsheet_comments_item  ON runsheet_item_comments(item_id);
CREATE INDEX IF NOT EXISTS idx_runsheet_versions_sheet ON runsheet_versions(runsheet_id, version);

-- ─────────────────────────────────────────────
-- Updated_at triggers
-- ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_runsheets_updated_at ON runsheets;
CREATE TRIGGER set_runsheets_updated_at
  BEFORE UPDATE ON runsheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_runsheet_items_updated_at ON runsheet_items;
CREATE TRIGGER set_runsheet_items_updated_at
  BEFORE UPDATE ON runsheet_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────
-- RLS policies
-- ─────────────────────────────────────────────
ALTER TABLE runsheets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE runsheet_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE runsheet_item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE runsheet_versions     ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_all_runsheets"              ON runsheets             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_runsheet_items"         ON runsheet_items        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_runsheet_comments"      ON runsheet_item_comments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_runsheet_versions"      ON runsheet_versions     FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- Function: auto-save version every 30 min
-- Called from application layer (cron) — placeholder trigger
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_runsheet_version(
  p_runsheet_id uuid,
  p_user_id     uuid,
  p_label       varchar DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_version  integer;
  v_snapshot jsonb;
  v_id       uuid;
BEGIN
  -- Get current version number
  SELECT version INTO v_version FROM runsheets WHERE id = p_runsheet_id;

  -- Build snapshot of all active items
  SELECT jsonb_agg(row_to_json(ri.*) ORDER BY ri.position)
  INTO v_snapshot
  FROM runsheet_items ri
  WHERE ri.runsheet_id = p_runsheet_id
    AND ri.is_deleted = false;

  -- Insert version snapshot
  INSERT INTO runsheet_versions (runsheet_id, version, label, snapshot, created_by)
  VALUES (p_runsheet_id, v_version, p_label, COALESCE(v_snapshot, '[]'::jsonb), p_user_id)
  RETURNING id INTO v_id;

  -- Bump runsheet version
  UPDATE runsheets SET version = version + 1, updated_at = now()
  WHERE id = p_runsheet_id;

  RETURN v_id;
END;
$$;

-- ─────────────────────────────────────────────
-- Realtime: enable for collaborative editing
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE runsheet_items;
ALTER PUBLICATION supabase_realtime ADD TABLE runsheet_item_comments;
