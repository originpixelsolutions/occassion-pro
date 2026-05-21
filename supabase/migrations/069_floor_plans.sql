-- ─────────────────────────────────────────────────────────────────────────────
-- 069_floor_plans.sql  –  Floor Plan Editor tables & helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE zone_type_enum AS ENUM (
    'dining','reception','stage','dance_floor','bar','kitchen','entrance','parking','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE table_type_enum AS ENUM (
    'round','rectangular','cocktail','serpentine','custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── floor_plans ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.floor_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name            varchar(100) NOT NULL DEFAULT 'Main Floor Plan',
  canvas_data     jsonb,
  canvas_width    int NOT NULL DEFAULT 3000,
  canvas_height   int NOT NULL DEFAULT 2000,
  grid_size       int NOT NULL DEFAULT 50,
  scale_label     varchar(20) NOT NULL DEFAULT '1 cell = 1m',
  is_published    bool NOT NULL DEFAULT false,
  thumbnail_url   text,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

-- ── floor_plan_zones ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.floor_plan_zones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id   uuid NOT NULL REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  name            varchar(100) NOT NULL,
  color           varchar(7) NOT NULL DEFAULT '#4f46e5',
  shape_id        varchar(100),
  capacity        int,
  zone_type       zone_type_enum NOT NULL DEFAULT 'other',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── floor_plan_tables ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.floor_plan_tables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id   uuid NOT NULL REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  zone_id         uuid REFERENCES public.floor_plan_zones(id) ON DELETE SET NULL,
  name            varchar(50) NOT NULL DEFAULT 'Table',
  shape_id        varchar(100),
  table_type      table_type_enum NOT NULL DEFAULT 'round',
  capacity        int NOT NULL DEFAULT 8,
  x_pos           decimal(10,2) NOT NULL DEFAULT 0,
  y_pos           decimal(10,2) NOT NULL DEFAULT 0,
  rotation        decimal(6,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── table_guest_assignments ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.table_guest_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id        uuid NOT NULL REFERENCES public.floor_plan_tables(id) ON DELETE CASCADE,
  guest_id        uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  seat_number     int,
  assigned_by     uuid REFERENCES public.profiles(id),
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_id, guest_id),
  UNIQUE NULLS NOT DISTINCT (table_id, seat_number)  -- allow multiple NULLs but unique non-null pairs
);

-- ── Add table_id / seat_number to guests ────────────────────────────────────

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS table_id    uuid REFERENCES public.floor_plan_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seat_number int;

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_floor_plans_event ON public.floor_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_zones_plan ON public.floor_plan_zones(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_tables_plan ON public.floor_plan_tables(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_tables_zone ON public.floor_plan_tables(zone_id);
CREATE INDEX IF NOT EXISTS idx_tga_table ON public.table_guest_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_tga_guest ON public.table_guest_assignments(guest_id);
CREATE INDEX IF NOT EXISTS idx_guests_table ON public.guests(table_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_floor_plan_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_floor_plan_updated_at ON public.floor_plans;
CREATE TRIGGER trg_floor_plan_updated_at
  BEFORE UPDATE ON public.floor_plans
  FOR EACH ROW EXECUTE FUNCTION fn_floor_plan_updated_at();

-- ── Helper function: get_floor_plan_with_assignments ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_floor_plan_with_assignments(p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan        public.floor_plans;
  v_tables      jsonb;
  v_zones       jsonb;
BEGIN
  SELECT * INTO v_plan
    FROM public.floor_plans
   WHERE event_id = p_event_id
   LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- zones
  SELECT coalesce(jsonb_agg(row_to_json(z.*)), '[]'::jsonb)
    INTO v_zones
    FROM public.floor_plan_zones z
   WHERE z.floor_plan_id = v_plan.id;

  -- tables + guests
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',          t.id,
        'name',        t.name,
        'shape_id',    t.shape_id,
        'table_type',  t.table_type,
        'capacity',    t.capacity,
        'x_pos',       t.x_pos,
        'y_pos',       t.y_pos,
        'rotation',    t.rotation,
        'zone_id',     t.zone_id,
        'guests', (
          SELECT coalesce(jsonb_agg(
            jsonb_build_object(
              'assignment_id', a.id,
              'guest_id',      g.id,
              'full_name',     g.full_name,
              'category',      g.category,
              'meal_preference', g.meal_preference,
              'seat_number',   a.seat_number
            )
          ), '[]'::jsonb)
          FROM public.table_guest_assignments a
          JOIN public.guests g ON g.id = a.guest_id
          WHERE a.table_id = t.id
        )
      )
    ), '[]'::jsonb)
    INTO v_tables
    FROM public.floor_plan_tables t
   WHERE t.floor_plan_id = v_plan.id;

  RETURN jsonb_build_object(
    'id',            v_plan.id,
    'event_id',      v_plan.event_id,
    'name',          v_plan.name,
    'canvas_data',   v_plan.canvas_data,
    'canvas_width',  v_plan.canvas_width,
    'canvas_height', v_plan.canvas_height,
    'grid_size',     v_plan.grid_size,
    'scale_label',   v_plan.scale_label,
    'is_published',  v_plan.is_published,
    'thumbnail_url', v_plan.thumbnail_url,
    'created_at',    v_plan.created_at,
    'updated_at',    v_plan.updated_at,
    'zones',         v_zones,
    'tables',        v_tables
  );
END; $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_plan_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_plan_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_guest_assignments ENABLE ROW LEVEL SECURITY;

-- floor_plans
CREATE POLICY fp_team_all ON public.floor_plans FOR ALL
  USING (event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.team_members tm ON tm.tenant_id = e.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  ));

CREATE POLICY fp_guest_read_published ON public.floor_plans FOR SELECT
  USING (is_published = true);

CREATE POLICY fp_service_all ON public.floor_plans FOR ALL
  USING (auth.role() = 'service_role');

-- floor_plan_zones (inherit via floor_plan ownership)
CREATE POLICY fpz_team_all ON public.floor_plan_zones FOR ALL
  USING (floor_plan_id IN (
    SELECT fp.id FROM public.floor_plans fp
    JOIN public.events e ON e.id = fp.event_id
    JOIN public.team_members tm ON tm.tenant_id = e.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  ));
CREATE POLICY fpz_service_all ON public.floor_plan_zones FOR ALL
  USING (auth.role() = 'service_role');

-- floor_plan_tables
CREATE POLICY fpt_team_all ON public.floor_plan_tables FOR ALL
  USING (floor_plan_id IN (
    SELECT fp.id FROM public.floor_plans fp
    JOIN public.events e ON e.id = fp.event_id
    JOIN public.team_members tm ON tm.tenant_id = e.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  ));
CREATE POLICY fpt_service_all ON public.floor_plan_tables FOR ALL
  USING (auth.role() = 'service_role');

-- table_guest_assignments
CREATE POLICY tga_team_all ON public.table_guest_assignments FOR ALL
  USING (table_id IN (
    SELECT t.id FROM public.floor_plan_tables t
    JOIN public.floor_plans fp ON fp.id = t.floor_plan_id
    JOIN public.events e ON e.id = fp.event_id
    JOIN public.team_members tm ON tm.tenant_id = e.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  ));
CREATE POLICY tga_service_all ON public.table_guest_assignments FOR ALL
  USING (auth.role() = 'service_role');

