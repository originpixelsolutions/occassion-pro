-- ============================================================
-- 022_workforce.sql
-- Workforce Management & Staff Scheduling System
-- ============================================================

-- ── Staff Roles / Positions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name          TEXT NOT NULL,
  code          TEXT NOT NULL,               -- e.g. 'event_coordinator', 'security', 'mc'
  department    TEXT,                        -- e.g. 'operations', 'hospitality', 'technical'
  hourly_rate   NUMERIC(10,2),
  overtime_rate NUMERIC(10,2),
  color         TEXT DEFAULT '#6366f1',      -- for schedule grid
  is_active     BOOLEAN NOT NULL DEFAULT true,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- ── Staff / Employees ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id      UUID REFERENCES profiles(id) ON DELETE SET NULL, -- linked user account (optional)

  -- Identity
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  photo_url       TEXT,

  -- Employment
  employee_code   TEXT,
  role_id         UUID REFERENCES staff_roles(id),
  department      TEXT,
  employment_type TEXT NOT NULL DEFAULT 'full_time'
                  CHECK (employment_type IN ('full_time','part_time','contractor','freelancer','intern')),
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive','on_leave','terminated')),

  -- Skills & certifications
  skills          TEXT[] DEFAULT '{}',
  certifications  TEXT[] DEFAULT '{}',
  languages       TEXT[] DEFAULT '{}',
  experience_years INTEGER DEFAULT 0,

  -- Availability
  available_days  TEXT[] DEFAULT '{"mon","tue","wed","thu","fri","sat","sun"}',
  max_hours_week  INTEGER DEFAULT 48,
  min_hours_week  INTEGER DEFAULT 0,

  -- Payroll
  base_hourly_rate NUMERIC(10,2),
  overtime_multiplier NUMERIC(4,2) DEFAULT 1.5,
  bank_account    TEXT,
  tax_id          TEXT,

  -- Emergency
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,

  -- Metadata
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  rating          NUMERIC(3,2),              -- average performance rating (0-5)
  total_events    INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, employee_code)
);

-- ── Event Staffing Plans ──────────────────────────────────────
-- One plan per event (auto-created or manual)
CREATE TABLE IF NOT EXISTS event_staffing_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','published','locked','completed')),
  headcount_target INTEGER DEFAULT 0,
  headcount_confirmed INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,

  created_by      UUID REFERENCES profiles(id),
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(event_id)
);

-- ── Shifts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  plan_id         UUID REFERENCES event_staffing_plans(id) ON DELETE CASCADE,

  -- Shift definition
  title           TEXT NOT NULL,
  role_id         UUID REFERENCES staff_roles(id),
  department      TEXT,
  location        TEXT,                       -- gate, zone, stage, etc.
  description     TEXT,

  -- Timing
  shift_date      DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  break_minutes   INTEGER DEFAULT 0,

  -- Capacity
  slots_required  INTEGER NOT NULL DEFAULT 1,
  slots_filled    INTEGER NOT NULL DEFAULT 0,

  -- Priority
  priority        TEXT NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('critical','high','normal','low')),
  is_overnight    BOOLEAN NOT NULL DEFAULT false,

  color           TEXT,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Shift Assignments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_id        UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  status          TEXT NOT NULL DEFAULT 'assigned'
                  CHECK (status IN ('assigned','confirmed','declined','no_show','completed')),

  -- Confirmation
  confirmed_at    TIMESTAMPTZ,
  confirmation_channel TEXT CHECK (confirmation_channel IN ('app','whatsapp','email','sms','phone')),
  decline_reason  TEXT,

  -- Actual attendance
  check_in_time   TIMESTAMPTZ,
  check_out_time  TIMESTAMPTZ,
  actual_hours    NUMERIC(5,2),
  overtime_hours  NUMERIC(5,2) DEFAULT 0,

  -- Performance
  performance_rating  SMALLINT CHECK (performance_rating BETWEEN 1 AND 5),
  performance_notes   TEXT,
  rated_by        UUID REFERENCES profiles(id),
  rated_at        TIMESTAMPTZ,

  -- Pay
  base_pay        NUMERIC(10,2),
  overtime_pay    NUMERIC(10,2) DEFAULT 0,
  bonus_pay       NUMERIC(10,2) DEFAULT 0,
  total_pay       NUMERIC(10,2),
  pay_processed   BOOLEAN NOT NULL DEFAULT false,
  pay_processed_at TIMESTAMPTZ,

  assigned_by     UUID REFERENCES profiles(id),
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(shift_id, staff_id)
);

-- ── Staff Availability Blocks ─────────────────────────────────
-- When a staff member is unavailable
CREATE TABLE IF NOT EXISTS staff_unavailability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,

  from_date       DATE NOT NULL,
  to_date         DATE NOT NULL,
  reason          TEXT CHECK (reason IN ('leave','sick','holiday','personal','training','other')),
  notes           TEXT,
  approved        BOOLEAN NOT NULL DEFAULT false,
  approved_by     UUID REFERENCES profiles(id),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Staff Attendance Log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_attendance_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id),
  assignment_id   UUID REFERENCES shift_assignments(id),

  action          TEXT NOT NULL CHECK (action IN ('check_in','check_out','break_start','break_end')),
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location        TEXT,
  device_id       TEXT,
  recorded_by     UUID REFERENCES profiles(id),    -- supervisor override
  notes           TEXT
);

-- ── Staff Performance Reviews ─────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_performance_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id),

  reviewer_id     UUID REFERENCES profiles(id),
  review_period   TEXT,                           -- 'Q1 2026', 'Event: Grand Wedding'
  overall_rating  NUMERIC(3,2) NOT NULL,

  -- Criteria
  punctuality     SMALLINT CHECK (punctuality BETWEEN 1 AND 5),
  professionalism SMALLINT CHECK (professionalism BETWEEN 1 AND 5),
  teamwork        SMALLINT CHECK (teamwork BETWEEN 1 AND 5),
  guest_handling  SMALLINT CHECK (guest_handling BETWEEN 1 AND 5),
  initiative      SMALLINT CHECK (initiative BETWEEN 1 AND 5),

  strengths       TEXT,
  improvements    TEXT,
  private_notes   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Payroll Batches ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  batch_name      TEXT NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','processing','completed','cancelled')),

  total_staff     INTEGER NOT NULL DEFAULT 0,
  total_hours     NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_base_pay  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_overtime  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_bonus     NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total     NUMERIC(12,2) NOT NULL DEFAULT 0,

  processed_by    UUID REFERENCES profiles(id),
  processed_at    TIMESTAMPTZ,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_members_tenant       ON staff_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_role         ON staff_members(role_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_status       ON staff_members(status);
CREATE INDEX IF NOT EXISTS idx_shifts_event               ON shifts(event_id);
CREATE INDEX IF NOT EXISTS idx_shifts_plan                ON shifts(plan_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date                ON shifts(event_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift    ON shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_staff    ON shift_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_event    ON shift_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_status   ON shift_assignments(event_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_log_staff       ON staff_attendance_log(staff_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_log_event       ON staff_attendance_log(event_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_unavailability_staff       ON staff_unavailability(staff_id, from_date, to_date);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE staff_roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_staffing_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_unavailability      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_batches           ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON staff_roles
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON staff_members
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON event_staffing_plans
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON shifts
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON shift_assignments
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON staff_unavailability
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON staff_attendance_log
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON staff_performance_reviews
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON payroll_batches
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Helper: auto-update staffing plan headcount ───────────────
CREATE OR REPLACE FUNCTION update_plan_headcount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE event_staffing_plans
  SET headcount_confirmed = (
    SELECT COUNT(*) FROM shift_assignments
    WHERE event_id = NEW.event_id
    AND status IN ('confirmed','completed')
  ),
  updated_at = NOW()
  WHERE event_id = NEW.event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_plan_headcount
AFTER INSERT OR UPDATE OF status ON shift_assignments
FOR EACH ROW EXECUTE FUNCTION update_plan_headcount();

-- ── Helper: auto-update slots_filled on shifts ────────────────
CREATE OR REPLACE FUNCTION update_shift_slots()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shifts
  SET slots_filled = (
    SELECT COUNT(*) FROM shift_assignments
    WHERE shift_id = COALESCE(NEW.shift_id, OLD.shift_id)
    AND status NOT IN ('declined','no_show')
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.shift_id, OLD.shift_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_shift_slots
AFTER INSERT OR UPDATE OF status OR DELETE ON shift_assignments
FOR EACH ROW EXECUTE FUNCTION update_shift_slots();
