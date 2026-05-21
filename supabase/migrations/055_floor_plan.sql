-- ============================================================
-- OccasionPro — Migration 055: Floor Plan System
-- Infinite-canvas seating chart with Konva.js shapes,
-- table management, and intelligent guest auto-assignment
-- ============================================================

-- ── Floor plan canvas (one per event) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS floor_plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id     uuid        NOT NULL,
  -- JSON array of FPShape objects persisted by the editor
  shapes        jsonb       NOT NULL DEFAULT '[]',
  -- Canvas configuration (width, height, gridSize, scaleLabel, backgroundColor)
  canvas_props  jsonb       NOT NULL DEFAULT '{}',
  is_published  boolean     NOT NULL DEFAULT false,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS floor_plans_tenant_id_idx ON floor_plans (tenant_id);

-- ── Tables placed on the floor plan ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS floor_plan_tables (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id   uuid        NOT NULL,
  -- shape_id links back to the corresponding FPShape.id in the canvas JSON
  shape_id    text,
  name        text        NOT NULL,
  seats       integer     NOT NULL DEFAULT 8 CHECK (seats > 0 AND seats <= 500),
  table_type  text        NOT NULL DEFAULT 'table-round'
              CHECK (table_type IN ('table-round','table-rect','table-cocktail')),
  x_pos       numeric(9,2) NOT NULL DEFAULT 0,
  y_pos       numeric(9,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fpt_event_id_idx   ON floor_plan_tables (event_id);
CREATE INDEX IF NOT EXISTS fpt_tenant_id_idx  ON floor_plan_tables (tenant_id);

-- ── Guest seating assignments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS floor_plan_table_guests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    uuid        NOT NULL REFERENCES floor_plan_tables(id) ON DELETE CASCADE,
  event_id    uuid        NOT NULL,
  tenant_id   uuid        NOT NULL,
  guest_id    uuid        NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  seat_number integer,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  -- Each guest sits at exactly one table per event
  UNIQUE (event_id, guest_id),
  UNIQUE (table_id, guest_id)
);

CREATE INDEX IF NOT EXISTS fptg_table_id_idx  ON floor_plan_table_guests (table_id);
CREATE INDEX IF NOT EXISTS fptg_event_id_idx  ON floor_plan_table_guests (event_id);
CREATE INDEX IF NOT EXISTS fptg_guest_id_idx  ON floor_plan_table_guests (guest_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fp_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trig_floor_plans_updated_at     ON floor_plans;
CREATE TRIGGER trig_floor_plans_updated_at
  BEFORE UPDATE ON floor_plans
  FOR EACH ROW EXECUTE FUNCTION fp_set_updated_at();

DROP TRIGGER IF EXISTS trig_floor_plan_tables_updated_at ON floor_plan_tables;
CREATE TRIGGER trig_floor_plan_tables_updated_at
  BEFORE UPDATE ON floor_plan_tables
  FOR EACH ROW EXECUTE FUNCTION fp_set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE floor_plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_tables        ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_table_guests  ENABLE ROW LEVEL SECURITY;

-- floor_plans
CREATE POLICY "tenant members can manage floor plans"
  ON floor_plans FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- floor_plan_tables
CREATE POLICY "tenant members can manage floor plan tables"
  ON floor_plan_tables FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- floor_plan_table_guests
CREATE POLICY "tenant members can manage table assignments"
  ON floor_plan_table_guests FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Service role bypass (NestJS API, Cloudflare Worker)
CREATE POLICY "service role bypass floor_plans"
  ON floor_plans FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role bypass floor_plan_tables"
  ON floor_plan_tables FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role bypass floor_plan_table_guests"
  ON floor_plan_table_guests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── auto_assign_guests() ─────────────────────────────────────────────────────
-- Distributes all unassigned guests across tables that still have capacity.
-- Returns the number of guests successfully assigned.
CREATE OR REPLACE FUNCTION auto_assign_guests(
  p_event_id  uuid,
  p_tenant_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assigned   integer := 0;
  v_guest_rec  RECORD;
  v_table_rec  RECORD;
  v_seat_num   integer;
BEGIN
  -- Cursor over unassigned guests (RSVP accepted, not yet placed)
  FOR v_guest_rec IN
    SELECT g.id
    FROM   guests g
    WHERE  g.event_id   = p_event_id
    AND    g.tenant_id  = p_tenant_id
    AND    g.rsvp_status IN ('confirmed','attending','checked_in')
    AND    g.id NOT IN (
             SELECT guest_id FROM floor_plan_table_guests
             WHERE  event_id = p_event_id
           )
    ORDER BY g.last_name, g.first_name
  LOOP
    -- Find the table with the most remaining capacity
    SELECT
      t.id,
      t.seats - COUNT(a.id) AS remaining
    INTO v_table_rec
    FROM  floor_plan_tables t
    LEFT JOIN floor_plan_table_guests a ON a.table_id = t.id
    WHERE t.event_id  = p_event_id
    AND   t.tenant_id = p_tenant_id
    GROUP BY t.id, t.seats
    HAVING t.seats > COUNT(a.id)
    ORDER BY remaining DESC
    LIMIT 1;

    EXIT WHEN v_table_rec IS NULL;

    -- Next seat number at this table
    SELECT COALESCE(MAX(seat_number), 0) + 1
    INTO   v_seat_num
    FROM   floor_plan_table_guests
    WHERE  table_id = v_table_rec.id;

    INSERT INTO floor_plan_table_guests
      (table_id, event_id, tenant_id, guest_id, seat_number)
    VALUES
      (v_table_rec.id, p_event_id, p_tenant_id, v_guest_rec.id, v_seat_num)
    ON CONFLICT DO NOTHING;

    v_assigned := v_assigned + 1;
  END LOOP;

  RETURN v_assigned;
END;
$$;
