-- ============================================================
-- Migration: 021_advanced_guests.sql
-- ============================================================
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

-- ============================================================
-- Migration: 022_workforce.sql
-- ============================================================
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

-- ============================================================
-- Migration: 023_marketing.sql
-- ============================================================
-- ============================================================
-- 023_marketing.sql
-- Marketing & Lead Generation System
-- ============================================================

-- ── Lead Sources / UTM Tracking ───────────────────────────────
CREATE TABLE IF NOT EXISTS lead_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'organic'
                CHECK (type IN ('organic','paid_search','paid_social','referral',
                                'direct','email','whatsapp','sms','event','partner','other')),
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_content   TEXT,
  cost_per_lead NUMERIC(10,2),
  is_active     BOOLEAN NOT NULL DEFAULT true,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Leads ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  crm_contact_id  UUID,                                  -- FK to crm_contacts if converted

  -- Identity
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  company         TEXT,
  location        TEXT,
  social_handle   TEXT,

  -- Lead details
  event_type      TEXT,                                   -- wedding, corporate, birthday…
  event_date      DATE,
  estimated_budget NUMERIC(12,2),
  guest_count     INTEGER,
  requirements    TEXT,

  -- Source & scoring
  source_id       UUID REFERENCES lead_sources(id),
  source_type     TEXT,
  utm_data        JSONB DEFAULT '{}',
  lead_score      INTEGER NOT NULL DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  score_breakdown JSONB DEFAULT '{}',               -- {budget:30, urgency:20, ...}

  -- Stage
  stage           TEXT NOT NULL DEFAULT 'new'
                  CHECK (stage IN ('new','contacted','qualified','proposal_sent',
                                   'negotiating','won','lost','nurturing')),
  stage_updated_at TIMESTAMPTZ,
  lost_reason     TEXT,
  win_probability INTEGER DEFAULT 0 CHECK (win_probability BETWEEN 0 AND 100),

  -- Assignment
  assigned_to     UUID REFERENCES profiles(id),
  assigned_at     TIMESTAMPTZ,

  -- Follow-up
  last_contact_at TIMESTAMPTZ,
  next_follow_up  TIMESTAMPTZ,
  follow_up_count INTEGER NOT NULL DEFAULT 0,

  -- Flags
  is_qualified    BOOLEAN NOT NULL DEFAULT false,
  is_converted    BOOLEAN NOT NULL DEFAULT false,
  converted_at    TIMESTAMPTZ,
  is_hot          BOOLEAN NOT NULL DEFAULT false,
  do_not_contact  BOOLEAN NOT NULL DEFAULT false,

  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Lead Activities / Timeline ────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES marketing_leads(id) ON DELETE CASCADE,

  type            TEXT NOT NULL
                  CHECK (type IN ('call','email','whatsapp','meeting','note',
                                  'stage_change','score_change','proposal','site_visit','follow_up')),
  subject         TEXT,
  body            TEXT,
  outcome         TEXT CHECK (outcome IN ('positive','neutral','negative','no_answer')),
  duration_min    INTEGER,
  next_action     TEXT,
  next_action_at  TIMESTAMPTZ,
  performed_by    UUID REFERENCES profiles(id),

  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Campaigns ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL DEFAULT 'email'
                  CHECK (type IN ('email','whatsapp','sms','social','paid_ad',
                                  'influencer','event','referral','content','mixed')),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','active','paused','completed','cancelled')),
  objective       TEXT CHECK (objective IN ('awareness','leads','conversion',
                                             'retention','engagement','upsell')),

  -- Targeting
  target_audience TEXT,
  target_event_types TEXT[] DEFAULT '{}',
  target_locations   TEXT[] DEFAULT '{}',
  estimated_reach    INTEGER,

  -- Budget
  budget          NUMERIC(12,2),
  spent           NUMERIC(12,2) DEFAULT 0,

  -- Schedule
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,

  -- Results
  sent_count      INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  opened_count    INTEGER NOT NULL DEFAULT 0,
  clicked_count   INTEGER NOT NULL DEFAULT 0,
  replied_count   INTEGER NOT NULL DEFAULT 0,
  converted_count INTEGER NOT NULL DEFAULT 0,
  unsubscribed    INTEGER NOT NULL DEFAULT 0,
  revenue_attributed NUMERIC(12,2) DEFAULT 0,

  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Campaign Messages / Templates ─────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,

  sequence_order  INTEGER NOT NULL DEFAULT 1,
  channel         TEXT NOT NULL CHECK (channel IN ('email','whatsapp','sms')),
  send_delay_days INTEGER NOT NULL DEFAULT 0,   -- days after previous message
  send_time       TIME,                          -- preferred send time

  subject         TEXT,
  body            TEXT NOT NULL,
  media_url       TEXT,
  cta_text        TEXT,
  cta_url         TEXT,

  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Campaign Recipients ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES marketing_leads(id),

  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,

  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','delivered','opened','clicked',
                                    'replied','converted','bounced','unsubscribed','failed')),
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,

  UNIQUE(campaign_id, lead_id)
);

-- ── Lead Capture Forms ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_capture_forms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  title           TEXT,
  subtitle        TEXT,
  cta_text        TEXT DEFAULT 'Get Free Quote',
  thank_you_message TEXT DEFAULT 'We''ll contact you within 24 hours!',

  -- Form config
  fields          JSONB NOT NULL DEFAULT '[]',   -- [{label, type, required, options}]
  source_id       UUID REFERENCES lead_sources(id),

  -- Branding
  primary_color   TEXT DEFAULT '#6366f1',
  logo_url        TEXT,
  background_url  TEXT,

  is_active       BOOLEAN NOT NULL DEFAULT true,
  submission_count INTEGER NOT NULL DEFAULT 0,
  conversion_rate  NUMERIC(5,2) DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- ── Form Submissions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  form_id         UUID NOT NULL REFERENCES lead_capture_forms(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES marketing_leads(id),

  data            JSONB NOT NULL DEFAULT '{}',
  ip_address      TEXT,
  user_agent      TEXT,
  referrer_url    TEXT,
  utm_data        JSONB DEFAULT '{}',

  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Social Posts / Content Calendar ──────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  content         TEXT NOT NULL,
  caption         TEXT,
  hashtags        TEXT[] DEFAULT '{}',
  media_urls      TEXT[] DEFAULT '{}',

  platforms       TEXT[] NOT NULL DEFAULT '{instagram}',
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','published','failed')),

  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,

  -- Analytics
  impressions     INTEGER DEFAULT 0,
  reach           INTEGER DEFAULT 0,
  likes           INTEGER DEFAULT 0,
  comments        INTEGER DEFAULT 0,
  shares          INTEGER DEFAULT 0,
  saves           INTEGER DEFAULT 0,
  link_clicks     INTEGER DEFAULT 0,

  campaign_id     UUID REFERENCES marketing_campaigns(id),
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Marketing Analytics / KPI Snapshots ──────────────────────
CREATE TABLE IF NOT EXISTS marketing_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,

  total_leads     INTEGER NOT NULL DEFAULT 0,
  new_leads       INTEGER NOT NULL DEFAULT 0,
  qualified_leads INTEGER NOT NULL DEFAULT 0,
  converted_leads INTEGER NOT NULL DEFAULT 0,
  lost_leads      INTEGER NOT NULL DEFAULT 0,

  total_revenue   NUMERIC(12,2) DEFAULT 0,
  marketing_spend NUMERIC(12,2) DEFAULT 0,
  roas            NUMERIC(6,2) DEFAULT 0,    -- return on ad spend
  cost_per_lead   NUMERIC(10,2) DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,

  top_source      TEXT,
  top_event_type  TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, snapshot_date)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_tenant         ON marketing_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage          ON marketing_leads(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_score          ON marketing_leads(tenant_id, lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_assigned       ON marketing_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_source         ON marketing_leads(source_id);
CREATE INDEX IF NOT EXISTS idx_leads_hot            ON marketing_leads(tenant_id, is_hot) WHERE is_hot = true;
CREATE INDEX IF NOT EXISTS idx_leads_followup       ON marketing_leads(tenant_id, next_follow_up);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant     ON marketing_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status     ON marketing_campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_recipients_campaign  ON campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_social_posts_tenant  ON social_posts(tenant_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions     ON form_submissions(form_id, submitted_at DESC);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE lead_sources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_leads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_capture_forms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_analytics   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON lead_sources
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON marketing_leads
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON lead_activities
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON marketing_campaigns
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON campaign_messages
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON campaign_recipients
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON lead_capture_forms
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON form_submissions
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON social_posts
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON marketing_analytics
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Public: allow form submission inserts without auth (for embed forms)
CREATE POLICY public_form_submit ON form_submissions
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- Migration: 024_support.sql
-- ============================================================
-- ============================================================
-- 024_support.sql — Support & Ticketing System
-- ============================================================

-- ── Ticket Categories ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  color         TEXT DEFAULT '#6366f1',
  icon          TEXT DEFAULT 'help-circle',
  sla_hours     INTEGER DEFAULT 24,           -- response SLA in hours
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- ── SLA Policies ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sla_policies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  priority            TEXT NOT NULL CHECK (priority IN ('critical','high','medium','low')),
  first_response_hrs  INTEGER NOT NULL DEFAULT 1,
  resolution_hrs      INTEGER NOT NULL DEFAULT 24,
  escalation_hrs      INTEGER,                -- auto-escalate after N hours
  is_default          BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, priority)
);

-- ── Support Tickets ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_tickets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_number       TEXT NOT NULL,                    -- e.g. TKT-0042
  title               TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','pending_client','resolved','closed','cancelled')),
  priority            TEXT NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('critical','high','medium','low')),
  category_id         UUID REFERENCES ticket_categories(id) ON DELETE SET NULL,

  -- Reporter
  reporter_type       TEXT DEFAULT 'internal' CHECK (reporter_type IN ('internal','client','vendor','guest')),
  reporter_id         UUID,                             -- profiles.id for internal
  reporter_name       TEXT,                             -- for external reporters
  reporter_email      TEXT,

  -- Assignment
  assigned_to         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_team       TEXT,
  escalated_to        UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Context
  event_id            UUID REFERENCES events(id) ON DELETE SET NULL,
  vendor_id           UUID REFERENCES vendors(id) ON DELETE SET NULL,
  related_entity_type TEXT,
  related_entity_id   UUID,

  -- SLA tracking
  sla_policy_id       UUID REFERENCES sla_policies(id) ON DELETE SET NULL,
  first_response_due  TIMESTAMPTZ,
  resolution_due      TIMESTAMPTZ,
  first_response_at   TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  sla_breached        BOOLEAN DEFAULT FALSE,
  response_sla_breached BOOLEAN DEFAULT FALSE,

  -- Satisfaction
  satisfaction_score  INTEGER CHECK (satisfaction_score BETWEEN 1 AND 5),
  satisfaction_note   TEXT,
  satisfaction_at     TIMESTAMPTZ,

  -- Resolution
  resolution_note     TEXT,
  resolved_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Tags & metadata
  tags                TEXT[] DEFAULT '{}',
  metadata            JSONB DEFAULT '{}',

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, ticket_number)
);

-- ── Ticket Comments / Activity Feed ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id     UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name   TEXT,
  author_type   TEXT DEFAULT 'agent' CHECK (author_type IN ('agent','client','vendor','system')),
  body          TEXT NOT NULL,
  is_internal   BOOLEAN DEFAULT FALSE,        -- internal notes not visible to client
  attachments   JSONB DEFAULT '[]',           -- [{name, url, size, mime}]
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ticket Attachments ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES ticket_comments(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   INTEGER,
  mime_type   TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ticket Activity Log ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name  TEXT,
  action      TEXT NOT NULL,               -- assigned, status_changed, priority_changed, escalated, etc.
  old_value   TEXT,
  new_value   TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Knowledge Base Articles ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES ticket_categories(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL,
  content       TEXT NOT NULL,
  summary       TEXT,
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  is_public     BOOLEAN DEFAULT FALSE,
  view_count    INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  tags          TEXT[] DEFAULT '{}',
  author_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- ── Ticket-to-KB Links ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_kb_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  article_id  UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  linked_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id, article_id)
);

-- ── Escalation Rules ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS escalation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  priority        TEXT CHECK (priority IN ('critical','high','medium','low')),
  hours_threshold INTEGER NOT NULL DEFAULT 4,
  escalate_to     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notify_email    TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant   ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status   ON support_tickets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(tenant_id, priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_event    ON support_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_sla      ON support_tickets(tenant_id, sla_breached, status);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket   ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket ON ticket_activities(ticket_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_tenant       ON kb_articles(tenant_id, status);

-- ── Auto-increment ticket number ─────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_ticket_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(ticket_number FROM 'TKT-(\d+)') AS INTEGER)
  ), 999) + 1
  INTO v_seq
  FROM support_tickets
  WHERE tenant_id = p_tenant_id;
  RETURN 'TKT-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ── Auto-update updated_at ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_support_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_ticket_updated ON support_tickets;
CREATE TRIGGER trg_support_ticket_updated
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_updated_at();

DROP TRIGGER IF EXISTS trg_kb_article_updated ON kb_articles;
CREATE TRIGGER trg_kb_article_updated
  BEFORE UPDATE ON kb_articles
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_updated_at();

DROP TRIGGER IF EXISTS trg_ticket_comment_updated ON ticket_comments;
CREATE TRIGGER trg_ticket_comment_updated
  BEFORE UPDATE ON ticket_comments
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_updated_at();

-- ── Auto-log ticket activity on status change ────────────────────────────────

CREATE OR REPLACE FUNCTION log_ticket_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ticket_activities(tenant_id, ticket_id, action, old_value, new_value)
    VALUES (NEW.tenant_id, NEW.id, 'status_changed', OLD.status, NEW.status);
  END IF;
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO ticket_activities(tenant_id, ticket_id, action, old_value, new_value)
    VALUES (NEW.tenant_id, NEW.id, 'priority_changed', OLD.priority, NEW.priority);
  END IF;
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO ticket_activities(tenant_id, ticket_id, action, old_value, new_value)
    VALUES (NEW.tenant_id, NEW.id, 'assigned', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_activity ON support_tickets;
CREATE TRIGGER trg_ticket_activity
  AFTER UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION log_ticket_activity();

-- ── SLA breach check function ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_sla_breaches()
RETURNS void AS $$
BEGIN
  -- Mark response SLA breached
  UPDATE support_tickets
  SET response_sla_breached = TRUE
  WHERE first_response_at IS NULL
    AND first_response_due < NOW()
    AND status NOT IN ('resolved','closed','cancelled')
    AND response_sla_breached = FALSE;

  -- Mark resolution SLA breached
  UPDATE support_tickets
  SET sla_breached = TRUE
  WHERE resolved_at IS NULL
    AND resolution_due < NOW()
    AND status NOT IN ('resolved','closed','cancelled')
    AND sla_breached = FALSE;
END;
$$ LANGUAGE plpgsql;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE ticket_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_kb_links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules     ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON ticket_categories    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON sla_policies         USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON support_tickets      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON ticket_comments      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON ticket_attachments   USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON ticket_activities    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON kb_articles          USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON escalation_rules     USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ticket_kb_links: inherit from tickets
CREATE POLICY ticket_link_isolation ON ticket_kb_links
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ── Default seed data function ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_support_defaults(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  -- Default categories
  INSERT INTO ticket_categories (tenant_id, name, color, sla_hours, sort_order) VALUES
    (p_tenant_id, 'Vendor Issue',        '#f59e0b', 4,  1),
    (p_tenant_id, 'Client Request',      '#6366f1', 8,  2),
    (p_tenant_id, 'Event Operations',    '#10b981', 2,  3),
    (p_tenant_id, 'Finance & Billing',   '#ef4444', 24, 4),
    (p_tenant_id, 'IT & Systems',        '#3b82f6', 8,  5),
    (p_tenant_id, 'Staff & HR',          '#8b5cf6', 24, 6),
    (p_tenant_id, 'Guest Complaint',     '#ec4899', 4,  7),
    (p_tenant_id, 'General Enquiry',     '#64748b', 48, 8)
  ON CONFLICT (tenant_id, name) DO NOTHING;

  -- Default SLA policies
  INSERT INTO sla_policies (tenant_id, name, priority, first_response_hrs, resolution_hrs, escalation_hrs, is_default) VALUES
    (p_tenant_id, 'Critical SLA',  'critical', 1,  4,  2,   FALSE),
    (p_tenant_id, 'High SLA',      'high',     2,  8,  4,   FALSE),
    (p_tenant_id, 'Standard SLA',  'medium',   4,  24, 12,  TRUE),
    (p_tenant_id, 'Low SLA',       'low',      8,  72, NULL, FALSE)
  ON CONFLICT (tenant_id, priority) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Migration: 025_integrations.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 025: API & Integration Hub
-- API keys, webhook subscriptions, payload logs, connectors
-- ============================================================

-- ── API KEYS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_prefix    TEXT NOT NULL,          -- e.g. "op_live_" visible in UI
  key_hash      TEXT NOT NULL,          -- bcrypt/sha256 of the full key
  key_last4     TEXT NOT NULL,          -- last 4 chars for display
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  environment   TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live','sandbox')),
  expires_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  usage_count   INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES profiles(id),
  revoked_by    UUID REFERENCES profiles(id),
  revoked_at    TIMESTAMPTZ,
  revoke_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── WEBHOOK ENDPOINTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  secret          TEXT NOT NULL,          -- HMAC signing secret
  events          TEXT[] NOT NULL DEFAULT '{}',  -- subscribed event types
  is_active       BOOLEAN NOT NULL DEFAULT true,
  description     TEXT,
  api_version     TEXT NOT NULL DEFAULT 'v1',
  timeout_ms      INTEGER NOT NULL DEFAULT 10000,
  retry_count     INTEGER NOT NULL DEFAULT 3,
  -- Stats (denormalised for speed)
  total_deliveries    INTEGER NOT NULL DEFAULT 0,
  successful_deliveries INTEGER NOT NULL DEFAULT 0,
  failed_deliveries   INTEGER NOT NULL DEFAULT 0,
  last_triggered_at   TIMESTAMPTZ,
  last_success_at     TIMESTAMPTZ,
  last_failure_at     TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── WEBHOOK DELIVERIES (payload log) ──────────────────────
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  endpoint_id     UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  event_id        UUID,                   -- source entity id
  payload         JSONB NOT NULL DEFAULT '{}',
  attempt         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','success','failed','retrying')),
  response_status INTEGER,
  response_body   TEXT,
  response_time_ms INTEGER,
  error_message   TEXT,
  next_retry_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── THIRD-PARTY INTEGRATIONS ──────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,          -- 'whatsapp','razorpay','google_calendar','zoom','sendgrid','twilio'
  display_name    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'disconnected'
                    CHECK (status IN ('connected','disconnected','error','pending')),
  config          JSONB NOT NULL DEFAULT '{}',   -- non-secret config (masked in API)
  secrets         JSONB NOT NULL DEFAULT '{}',   -- encrypted secrets
  scopes          TEXT[] DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  last_tested_at  TIMESTAMPTZ,
  last_error      TEXT,
  last_synced_at  TIMESTAMPTZ,
  connected_by    UUID REFERENCES profiles(id),
  connected_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);

-- ── INTEGRATION EVENT LOG ─────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
  provider      TEXT NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  action        TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('success','failure','pending')),
  payload       JSONB DEFAULT '{}',
  response      JSONB DEFAULT '{}',
  error_message TEXT,
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant     ON api_keys(tenant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_hash        ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant      ON webhook_endpoints(tenant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_deliveries_endpoint  ON webhook_deliveries(endpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_status    ON webhook_deliveries(tenant_id, status) WHERE status IN ('pending','retrying','failed');
CREATE INDEX IF NOT EXISTS idx_integrations_tenant  ON integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intlog_tenant        ON integration_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intlog_provider      ON integration_logs(tenant_id, provider, created_at DESC);

-- ── ROW-LEVEL SECURITY ────────────────────────────────────
ALTER TABLE api_keys             ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints    ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs     ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_tenant ON api_keys
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY webhooks_tenant ON webhook_endpoints
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY deliveries_tenant ON webhook_deliveries
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY integrations_tenant ON integrations
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY intlog_tenant ON integration_logs
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── TRIGGERS ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_webhook_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' THEN
    UPDATE webhook_endpoints SET
      total_deliveries = total_deliveries + 1,
      successful_deliveries = successful_deliveries + 1,
      last_triggered_at = NOW(),
      last_success_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.endpoint_id;
  ELSIF NEW.status = 'failed' THEN
    UPDATE webhook_endpoints SET
      total_deliveries = total_deliveries + 1,
      failed_deliveries = failed_deliveries + 1,
      last_triggered_at = NOW(),
      last_failure_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.endpoint_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS webhook_delivery_stats ON webhook_deliveries;
CREATE TRIGGER webhook_delivery_stats
  AFTER UPDATE OF status ON webhook_deliveries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('success','failed'))
  EXECUTE FUNCTION update_webhook_stats();

CREATE OR REPLACE FUNCTION track_api_key_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE api_keys SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE key_hash = NEW.key_hash;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated-at triggers
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'api_keys_updated_at') THEN
DROP TRIGGER IF EXISTS api_keys_updated_at ON api_keys;
    CREATE TRIGGER api_keys_updated_at BEFORE UPDATE ON api_keys
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'webhooks_updated_at') THEN
DROP TRIGGER IF EXISTS webhooks_updated_at ON webhook_endpoints;
    CREATE TRIGGER webhooks_updated_at BEFORE UPDATE ON webhook_endpoints
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'integrations_updated_at') THEN
DROP TRIGGER IF EXISTS integrations_updated_at ON integrations;
    CREATE TRIGGER integrations_updated_at BEFORE UPDATE ON integrations
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- ── SEED DEFAULT INTEGRATION SLOTS ────────────────────────
-- Each tenant gets disconnected stubs so the UI always has a full grid
CREATE OR REPLACE FUNCTION seed_integration_slots(p_tenant_id UUID)
RETURNS VOID AS $$
DECLARE
  providers TEXT[][] := ARRAY[
    ['whatsapp',       'WhatsApp Business'],
    ['razorpay',       'Razorpay Payments'],
    ['google_calendar','Google Calendar'],
    ['zoom',           'Zoom Video'],
    ['sendgrid',       'SendGrid Email'],
    ['twilio',         'Twilio SMS'],
    ['stripe',         'Stripe Payments'],
    ['slack',          'Slack Notifications']
  ];
  p TEXT[];
BEGIN
  FOREACH p SLICE 1 IN ARRAY providers LOOP
    INSERT INTO integrations(tenant_id, provider, display_name, status)
    VALUES (p_tenant_id, p[1], p[2], 'disconnected')
    ON CONFLICT (tenant_id, provider) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ── WEBHOOK EVENT TYPES ENUM (reference) ──────────────────
-- These are the supported event types for webhook subscriptions
COMMENT ON TABLE webhook_endpoints IS
'Supported event types: event.created, event.updated, event.cancelled,
 ticket.created, ticket.status_changed, ticket.escalated,
 payment.received, payment.failed, payment.refunded,
 guest.checked_in, vendor.confirmed, vendor.declined,
 staff.assigned, staff.checkin, task.completed,
 report.generated';

-- ============================================================
-- Migration: 026_notifications_center.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 026: Notifications Center
-- In-app notifications, preferences, templates, broadcast
-- ============================================================

-- ── IN-APP NOTIFICATIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN ('event','finance','support','operations','team','system','ai','general')),
  title         TEXT NOT NULL,
  body          TEXT,
  action_url    TEXT,
  action_label  TEXT,
  icon          TEXT,                     -- lucide icon name
  metadata      JSONB NOT NULL DEFAULT '{}',
  is_read       BOOLEAN NOT NULL DEFAULT false,
  is_archived   BOOLEAN NOT NULL DEFAULT false,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── NOTIFICATION PREFERENCES (per user, per channel) ──────
CREATE TABLE IF NOT EXISTS notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,           -- matches notifications.category
  event_type      TEXT,                    -- NULL = applies to all in category
  in_app          BOOLEAN NOT NULL DEFAULT true,
  email           BOOLEAN NOT NULL DEFAULT true,
  whatsapp        BOOLEAN NOT NULL DEFAULT false,
  sms             BOOLEAN NOT NULL DEFAULT false,
  push            BOOLEAN NOT NULL DEFAULT true,
  digest          BOOLEAN NOT NULL DEFAULT false,  -- include in daily digest
  quiet_hours_start TIME,                          -- e.g. 22:00
  quiet_hours_end   TIME,                          -- e.g. 07:00
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique preference per user/category/event_type (NULL-safe)
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_prefs_with_type
  ON notification_preferences(tenant_id, user_id, category, event_type)
  WHERE event_type IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_prefs_no_type
  ON notification_preferences(tenant_id, user_id, category)
  WHERE event_type IS NULL;

-- ── NOTIFICATION TEMPLATES ────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  event_type      TEXT NOT NULL UNIQUE,
  category        TEXT NOT NULL,
  title_template  TEXT NOT NULL,   -- handlebars-style {{variable}}
  body_template   TEXT,
  email_subject   TEXT,
  email_body      TEXT,
  whatsapp_template TEXT,
  sms_template    TEXT,
  variables       TEXT[] DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── BROADCAST NOTIFICATIONS ───────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  target        TEXT NOT NULL DEFAULT 'all'
                  CHECK (target IN ('all','role','event','custom')),
  target_roles  TEXT[],
  target_event_id UUID,
  channels      TEXT[] NOT NULL DEFAULT '{in_app}',
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at  TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  recipient_count INTEGER,
  delivered_count INTEGER,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant  ON notifications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_id) WHERE is_read = false AND is_archived = false;
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user      ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_tmpl_tenant     ON notification_templates(tenant_id);

-- ── ROW-LEVEL SECURITY ────────────────────────────────────
ALTER TABLE notifications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_notifications    ENABLE ROW LEVEL SECURITY;

-- Users see only their own notifications
CREATE POLICY notif_user ON notifications
  USING (user_id = auth.uid());
CREATE POLICY notif_prefs_user ON notification_preferences
  USING (user_id = auth.uid());
CREATE POLICY notif_tmpl_tenant ON notification_templates
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY broadcast_tenant ON broadcast_notifications
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── TRIGGERS ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notifications_read_at ON notifications;
CREATE TRIGGER notifications_read_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION auto_read_at();

-- ── SEED: DEFAULT NOTIFICATION TEMPLATES ─────────────────
INSERT INTO notification_templates(tenant_id, name, event_type, category, title_template, body_template, variables, email_subject)
SELECT
  t.id,
  tmpl.name,
  tmpl.event_type,
  tmpl.category,
  tmpl.title_template,
  tmpl.body_template,
  tmpl.variables,
  tmpl.email_subject
FROM tenants t
CROSS JOIN (VALUES
  ('Event Created',      'event.created',          'event',      'New event: {{event_name}}',           'A new event "{{event_name}}" has been created for {{event_date}}.', ARRAY['event_name','event_date']::TEXT[], 'New Event Created — {{event_name}}'),
  ('Payment Received',   'payment.received',        'finance',    '₹{{amount}} payment received',        'Payment of ₹{{amount}} received for event "{{event_name}}".', ARRAY['amount','event_name']::TEXT[], 'Payment Received — ₹{{amount}}'),
  ('Invoice Overdue',    'invoice.overdue',         'finance',    'Invoice overdue: {{invoice_number}}', 'Invoice {{invoice_number}} for ₹{{amount}} is overdue since {{due_date}}.', ARRAY['invoice_number','amount','due_date']::TEXT[], 'Invoice Overdue — {{invoice_number}}'),
  ('Ticket Created',     'ticket.created',          'support',    'New ticket: {{ticket_number}}',       '{{reporter}} raised a ticket: {{subject}}.', ARRAY['ticket_number','reporter','subject']::TEXT[], 'New Support Ticket — {{ticket_number}}'),
  ('Ticket Escalated',   'ticket.escalated',        'support',    'Ticket escalated: {{ticket_number}}', 'Ticket {{ticket_number}} has been escalated to {{assigned_to}}.', ARRAY['ticket_number','assigned_to']::TEXT[], 'Ticket Escalated'),
  ('Staff Assigned',     'staff.assigned',          'team',       'You have been assigned to {{event_name}}', 'You have been assigned as {{role}} for event "{{event_name}}" on {{event_date}}.', ARRAY['event_name','role','event_date']::TEXT[], 'New Assignment — {{event_name}}'),
  ('Task Completed',     'task.completed',          'operations', 'Task completed: {{task_name}}',       '{{completed_by}} completed the task "{{task_name}}".', ARRAY['task_name','completed_by']::TEXT[], 'Task Completed'),
  ('Vendor Confirmed',   'vendor.confirmed',        'operations', '{{vendor_name}} confirmed',            'Vendor "{{vendor_name}}" has confirmed their booking for {{event_name}}.', ARRAY['vendor_name','event_name']::TEXT[], 'Vendor Confirmation'),
  ('Guest Checked In',   'guest.checked_in',        'operations', '{{guest_name}} checked in',           '{{guest_name}} has checked in at {{checkin_time}}.', ARRAY['guest_name','checkin_time']::TEXT[], 'Guest Check-in'),
  ('AI Alert',           'ai.risk_alert',           'ai',         'AI Risk Alert: {{event_name}}',       'AI detected a risk for event "{{event_name}}": {{risk_description}}.', ARRAY['event_name','risk_description']::TEXT[], 'AI Risk Alert — {{event_name}}')
) AS tmpl(name, event_type, category, title_template, body_template, variables, email_subject)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Migration: 027_playbooks.sql
-- ============================================================
-- ============================================================
-- 027 — EVENT PLAYBOOKS & TEMPLATES SYSTEM
-- Reusable event playbooks with tasks, budgets, vendors,
-- runsheet items, and checklist items.
-- ============================================================

-- ── 1. Event Playbooks ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_playbooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  -- tenant_id NULL = global system playbook (read-only for tenants)

  name          TEXT NOT NULL,
  description   TEXT,
  event_type    TEXT NOT NULL, -- wedding, conference, festival, corporate, etc.
  category      TEXT,          -- luxury, budget, outdoor, virtual, hybrid
  tags          TEXT[] DEFAULT '{}',

  -- Metadata
  estimated_budget_min   BIGINT,   -- INR, rough range
  estimated_budget_max   BIGINT,
  typical_guest_count    INT,
  typical_duration_days  INT DEFAULT 1,

  -- Template stats
  task_count        INT DEFAULT 0,
  checklist_count   INT DEFAULT 0,
  vendor_count      INT DEFAULT 0,
  budget_item_count INT DEFAULT 0,
  runsheet_count    INT DEFAULT 0,

  -- Usage
  times_applied INT DEFAULT 0,
  last_applied_at TIMESTAMPTZ,

  -- Display
  cover_emoji   TEXT DEFAULT '📋',
  color         TEXT DEFAULT '#6366f1',  -- hex color for UI

  is_system     BOOLEAN DEFAULT false,  -- true = global/Anthropic template
  is_active     BOOLEAN DEFAULT true,

  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Playbook Tasks ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,          -- setup, logistics, vendor, guest, finance, etc.
  priority        TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  responsible_role TEXT,         -- event_manager, coordinator, logistics, finance, etc.

  -- Timing (relative to event date, negative = before, positive = after)
  days_before_event  INT,        -- NULL = day of event
  time_of_day        TIME,       -- optional: time on that day

  estimated_hours NUMERIC(5,2),
  requires_approval BOOLEAN DEFAULT false,
  tags            TEXT[] DEFAULT '{}',

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Playbook Budget Items ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_budget_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  category        TEXT NOT NULL,    -- venue, catering, decor, av, photography, etc.
  name            TEXT NOT NULL,
  description     TEXT,

  -- Can be a fixed amount or a % of total event budget
  amount_type     TEXT DEFAULT 'percentage' CHECK (amount_type IN ('fixed','percentage','per_guest','per_day')),
  amount          NUMERIC(12,2),    -- INR for fixed, 0-100 for percentage, per-person/day rate

  is_mandatory    BOOLEAN DEFAULT false,
  notes           TEXT,

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Playbook Vendor Categories ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_vendor_requirements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  vendor_type     TEXT NOT NULL,   -- caterer, decorator, photographer, av, security, etc.
  name            TEXT NOT NULL,   -- e.g. "Main Caterer", "Backup Generator"
  description     TEXT,

  is_mandatory    BOOLEAN DEFAULT true,
  quantity_needed INT DEFAULT 1,

  -- Budget guidance
  budget_percentage NUMERIC(5,2),  -- % of total budget to allocate
  notes             TEXT,

  -- Booking timing
  days_before_event INT,           -- when to book by (relative to event)

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Playbook Checklist Items ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_checklist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,           -- planning, legal, logistics, day-of, post-event
  is_mandatory    BOOLEAN DEFAULT true,
  days_before_event INT,

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Playbook Runsheet Items ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_runsheet_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,

  -- Relative timing: hours before/after event start (negative = before)
  offset_hours    NUMERIC(6,2) DEFAULT 0,  -- -2.5 = 2.5 hours before event
  duration_minutes INT DEFAULT 30,

  responsible_role TEXT,
  location        TEXT,
  notes           TEXT,

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. Applied Playbooks (audit trail) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_playbook_applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id  UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE SET NULL,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  applied_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- What was applied
  tasks_created      INT DEFAULT 0,
  budget_items_created INT DEFAULT 0,
  vendors_created    INT DEFAULT 0,
  checklist_created  INT DEFAULT 0,
  runsheet_created   INT DEFAULT 0,

  applied_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_playbooks_tenant      ON event_playbooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_event_type  ON event_playbooks(event_type);
CREATE INDEX IF NOT EXISTS idx_playbooks_is_system   ON event_playbooks(is_system) WHERE is_system = true;

CREATE INDEX IF NOT EXISTS idx_playbook_tasks_pb     ON playbook_tasks(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_budget_pb    ON playbook_budget_items(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_vendor_pb    ON playbook_vendor_requirements(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_check_pb     ON playbook_checklist_items(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_run_pb       ON playbook_runsheet_items(playbook_id);
CREATE INDEX IF NOT EXISTS idx_pb_applications_event ON event_playbook_applications(event_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE event_playbooks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_budget_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_vendor_requirements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_checklist_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_runsheet_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_playbook_applications    ENABLE ROW LEVEL SECURITY;

-- Playbooks: tenant sees their own + system playbooks
CREATE POLICY "playbooks_tenant_or_system" ON event_playbooks FOR ALL
  USING (
    is_system = true
    OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- Child tables: access via playbook ownership
CREATE POLICY "pb_tasks_access"   ON playbook_tasks FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_budget_access"  ON playbook_budget_items FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_vendor_access"  ON playbook_vendor_requirements FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_check_access"   ON playbook_checklist_items FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_run_access"     ON playbook_runsheet_items FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_applications_tenant" ON event_playbook_applications FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_playbook_counts()
RETURNS TRIGGER AS $$
DECLARE v_pb_id UUID;
BEGIN
  v_pb_id := COALESCE(NEW.playbook_id, OLD.playbook_id);

  UPDATE event_playbooks SET
    task_count        = (SELECT COUNT(*) FROM playbook_tasks           WHERE playbook_id = v_pb_id),
    budget_item_count = (SELECT COUNT(*) FROM playbook_budget_items    WHERE playbook_id = v_pb_id),
    vendor_count      = (SELECT COUNT(*) FROM playbook_vendor_requirements WHERE playbook_id = v_pb_id),
    checklist_count   = (SELECT COUNT(*) FROM playbook_checklist_items WHERE playbook_id = v_pb_id),
    runsheet_count    = (SELECT COUNT(*) FROM playbook_runsheet_items  WHERE playbook_id = v_pb_id),
    updated_at = NOW()
  WHERE id = v_pb_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_pb_counts_tasks ON playbook_tasks;
CREATE TRIGGER trg_update_pb_counts_tasks
  AFTER INSERT OR DELETE ON playbook_tasks
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

DROP TRIGGER IF EXISTS trg_update_pb_counts_budget ON playbook_budget_items;
CREATE TRIGGER trg_update_pb_counts_budget
  AFTER INSERT OR DELETE ON playbook_budget_items
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

DROP TRIGGER IF EXISTS trg_update_pb_counts_vendor ON playbook_vendor_requirements;
CREATE TRIGGER trg_update_pb_counts_vendor
  AFTER INSERT OR DELETE ON playbook_vendor_requirements
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

DROP TRIGGER IF EXISTS trg_update_pb_counts_checklist ON playbook_checklist_items;
CREATE TRIGGER trg_update_pb_counts_checklist
  AFTER INSERT OR DELETE ON playbook_checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

DROP TRIGGER IF EXISTS trg_update_pb_counts_runsheet ON playbook_runsheet_items;
CREATE TRIGGER trg_update_pb_counts_runsheet
  AFTER INSERT OR DELETE ON playbook_runsheet_items
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

-- ── Seed: System Playbooks ───────────────────────────────────────────────────

INSERT INTO event_playbooks
  (name, description, event_type, category, tags, estimated_budget_min, estimated_budget_max,
   typical_guest_count, typical_duration_days, cover_emoji, color, is_system, is_active)
VALUES
  -- 1. Luxury Wedding
  ('Luxury Wedding', 'Full-service luxury wedding with complete vendor suite, 5-star hospitality, and immersive décor.',
   'wedding', 'luxury',
   ARRAY['wedding','luxury','premium','multicultural'],
   2000000, 15000000, 400, 2, '💍', '#ec4899', true, true),

  -- 2. Destination Wedding
  ('Destination Wedding', 'Outstation wedding with accommodation, travel logistics, and multi-day programming.',
   'wedding', 'destination',
   ARRAY['wedding','destination','travel','resort'],
   3000000, 20000000, 150, 4, '🌴', '#f97316', true, true),

  -- 3. Corporate Conference
  ('Corporate Conference', 'Multi-track professional conference with keynotes, breakout sessions, and networking.',
   'conference', 'corporate',
   ARRAY['conference','b2b','networking','tech'],
   500000, 5000000, 500, 2, '🎤', '#6366f1', true, true),

  -- 4. Product Launch
  ('Product Launch Event', 'High-impact product reveal with media, influencers, demo zones, and press kit.',
   'launch', 'corporate',
   ARRAY['launch','press','brand','experiential'],
   1000000, 8000000, 300, 1, '🚀', '#8b5cf6', true, true),

  -- 5. Music Festival
  ('Music Festival', 'Large-scale outdoor music festival with multiple stages, artist management, and crowd ops.',
   'festival', 'entertainment',
   ARRAY['festival','music','outdoor','large-scale'],
   5000000, 50000000, 5000, 3, '🎵', '#14b8a6', true, true),

  -- 6. Corporate Annual Day
  ('Corporate Annual Day / Gala', 'Awards ceremony, dinner, and entertainment for corporate teams and leadership.',
   'corporate', 'gala',
   ARRAY['corporate','awards','gala','formal'],
   800000, 4000000, 300, 1, '🏆', '#f59e0b', true, true),

  -- 7. Birthday Celebration
  ('Milestone Birthday Celebration', 'Premium birthday event — 50th, 60th, etc — with theme, catering, and entertainment.',
   'birthday', 'private',
   ARRAY['birthday','private','milestone','themed'],
   200000, 2000000, 100, 1, '🎂', '#ec4899', true, true),

  -- 8. Trade Exhibition
  ('Trade Exhibition / Expo', 'Multi-booth exhibition hall with exhibitor management, public access, and B2B matchmaking.',
   'exhibition', 'b2b',
   ARRAY['expo','trade','exhibition','b2b'],
   2000000, 20000000, 2000, 3, '🏛️', '#0ea5e9', true, true),

  -- 9. Virtual Conference
  ('Virtual Conference / Webinar Series', 'Fully online conference with live streaming, virtual networking, and on-demand recordings.',
   'virtual', 'digital',
   ARRAY['virtual','online','webinar','streaming'],
   100000, 1000000, 1000, 1, '💻', '#10b981', true, true),

  -- 10. Sports Tournament
  ('Sports Tournament', 'Multi-day sports competition with teams, officials, spectators, and media coverage.',
   'sports', 'competitive',
   ARRAY['sports','tournament','competition','outdoor'],
   500000, 10000000, 1000, 3, '🏆', '#ef4444', true, true)
ON CONFLICT DO NOTHING;

-- ── Seed: Tasks for Luxury Wedding ──────────────────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Luxury Wedding' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_tasks (playbook_id, title, category, priority, responsible_role, days_before_event, sort_order) VALUES
      (v_pb_id, 'Confirm venue contract and F&B minimums',           'venue',      'critical', 'event_manager',  90, 10),
      (v_pb_id, 'Finalise guest list and dietary requirements',       'guest',      'high',     'coordinator',    60, 20),
      (v_pb_id, 'Book photographer and videographer',                 'vendor',     'critical', 'event_manager',  90, 30),
      (v_pb_id, 'Confirm caterer menu and tasting session',           'catering',   'critical', 'event_manager',  60, 40),
      (v_pb_id, 'Book floral & décor vendor — sign contract',         'decor',      'high',     'coordinator',    60, 50),
      (v_pb_id, 'Book entertainment (DJ/band/performers)',            'vendor',     'high',     'coordinator',    45, 60),
      (v_pb_id, 'Send invitations (physical + digital)',              'guest',      'high',     'coordinator',    45, 70),
      (v_pb_id, 'Confirm AV / lighting / sound vendor',              'av',         'high',     'coordinator',    45, 80),
      (v_pb_id, 'Book makeup artists and hair stylists',             'vendor',     'medium',   'coordinator',    30, 90),
      (v_pb_id, 'Create final seating chart',                        'logistics',  'high',     'coordinator',    14, 100),
      (v_pb_id, 'Confirm final guest count with caterer',            'catering',   'critical', 'event_manager',  7,  110),
      (v_pb_id, 'Venue walkthrough and logistics briefing',          'logistics',  'high',     'event_manager',  3,  120),
      (v_pb_id, 'Brief all staff and vendors — final schedule share','staff',      'critical', 'event_manager',  1,  130),
      (v_pb_id, 'Set up décor and test AV — day before',             'setup',      'critical', 'logistics',      1,  140),
      (v_pb_id, 'Welcome guests and manage arrivals',                'guest',      'critical', 'coordinator',    0,  150),
      (v_pb_id, 'Coordinate ceremony runsheet in real time',         'operations', 'critical', 'event_manager',  0,  160),
      (v_pb_id, 'Post-event wrap — décor teardown and payments',     'logistics',  'high',     'coordinator',    NULL, 170),
      (v_pb_id, 'Send thank-you cards / emails to guests',           'guest',      'medium',   'coordinator',    NULL, 180);
  END IF;
END $$;

-- ── Seed: Tasks for Corporate Conference ────────────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Corporate Conference' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_tasks (playbook_id, title, category, priority, responsible_role, days_before_event, sort_order) VALUES
      (v_pb_id, 'Finalise conference theme and agenda structure',     'planning',   'critical', 'event_manager',  90, 10),
      (v_pb_id, 'Confirm venue — hall layout and breakout rooms',     'venue',      'critical', 'event_manager',  90, 20),
      (v_pb_id, 'Identify and confirm keynote speakers',              'speaker',    'critical', 'coordinator',    75, 30),
      (v_pb_id, 'Launch registration portal and early bird pricing',  'marketing',  'high',     'marketing',      75, 40),
      (v_pb_id, 'Finalise AV and streaming setup',                   'av',         'critical', 'logistics',      60, 50),
      (v_pb_id, 'Confirm sponsors and collect brand assets',          'finance',    'high',     'event_manager',  60, 60),
      (v_pb_id, 'Arrange catering — breaks, lunches, gala dinner',   'catering',   'high',     'coordinator',    45, 70),
      (v_pb_id, 'Print badges, brochures, and signage',              'logistics',  'medium',   'coordinator',    14, 80),
      (v_pb_id, 'Brief volunteers and registration desk staff',       'staff',      'high',     'event_manager',  3,  90),
      (v_pb_id, 'Test AV, internet, and app systems',                'av',         'critical', 'logistics',      1,  100),
      (v_pb_id, 'Open registration and manage check-in',             'guest',      'critical', 'coordinator',    0,  110),
      (v_pb_id, 'MC briefing and real-time session management',       'operations', 'critical', 'event_manager',  0,  120),
      (v_pb_id, 'Collect speaker recordings for post-conference',    'media',      'medium',   'coordinator',    NULL, 130),
      (v_pb_id, 'Send post-event survey to all attendees',           'feedback',   'medium',   'marketing',      NULL, 140);
  END IF;
END $$;

-- ── Seed: Budget Items for Luxury Wedding ────────────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Luxury Wedding' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_budget_items (playbook_id, category, name, amount_type, amount, is_mandatory, sort_order) VALUES
      (v_pb_id, 'venue',       'Venue Rental',              'percentage', 20, true,  10),
      (v_pb_id, 'catering',    'Food & Beverage',           'percentage', 30, true,  20),
      (v_pb_id, 'decor',       'Floral & Décor',            'percentage', 15, true,  30),
      (v_pb_id, 'photography', 'Photography & Videography', 'percentage', 8,  true,  40),
      (v_pb_id, 'av',          'AV, Lighting & Sound',      'percentage', 7,  true,  50),
      (v_pb_id, 'entertainment','Entertainment & Music',     'percentage', 6,  false, 60),
      (v_pb_id, 'hospitality', 'Guest Hospitality & Gifts', 'percentage', 4,  false, 70),
      (v_pb_id, 'staffing',    'Event Staff & Coordinators','percentage', 4,  true,  80),
      (v_pb_id, 'transport',   'Guest Transportation',      'percentage', 3,  false, 90),
      (v_pb_id, 'contingency', 'Contingency Reserve',       'percentage', 3,  true,  100);
  END IF;
END $$;

-- ── Seed: Vendor Requirements for Luxury Wedding ─────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Luxury Wedding' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_vendor_requirements (playbook_id, vendor_type, name, is_mandatory, quantity_needed, budget_percentage, days_before_event, sort_order) VALUES
      (v_pb_id, 'caterer',       'Main Caterer',           true,  1, 30, 90,  10),
      (v_pb_id, 'decorator',     'Floral & Décor Vendor',  true,  1, 15, 90,  20),
      (v_pb_id, 'photographer',  'Wedding Photographer',   true,  1, 5,  90,  30),
      (v_pb_id, 'videographer',  'Wedding Videographer',   true,  1, 3,  90,  40),
      (v_pb_id, 'av',            'AV & Sound System',      true,  1, 7,  60,  50),
      (v_pb_id, 'lighting',      'Lighting Vendor',        true,  1, 4,  60,  60),
      (v_pb_id, 'entertainment', 'Live Band or DJ',         false, 1, 6,  45,  70),
      (v_pb_id, 'makeup',        'Bridal Makeup Artist',   true,  1, 2,  30,  80),
      (v_pb_id, 'security',      'Security Team',          true,  1, 2,  14,  90),
      (v_pb_id, 'transport',     'Guest Shuttle Service',  false, 1, 3,  30,  100);
  END IF;
END $$;

-- ── Seed: Checklist for Luxury Wedding ──────────────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Luxury Wedding' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_checklist_items (playbook_id, title, category, is_mandatory, days_before_event, sort_order) VALUES
      (v_pb_id, 'Venue contract signed and deposit paid',           'legal',      true,  90, 10),
      (v_pb_id, 'All vendor contracts signed',                      'legal',      true,  60, 20),
      (v_pb_id, 'Food license / FSSAI permit obtained',             'legal',      true,  45, 30),
      (v_pb_id, 'Liquor permit obtained (if applicable)',           'legal',      false, 45, 40),
      (v_pb_id, 'Noise permit obtained from local authority',       'legal',      false, 30, 50),
      (v_pb_id, 'Fire safety NOC from venue',                      'safety',     true,  30, 60),
      (v_pb_id, 'Insurance policy activated for event',            'finance',    true,  30, 70),
      (v_pb_id, 'Final headcount confirmed with caterer',          'operations', true,  7,  80),
      (v_pb_id, 'Emergency contact list distributed to all staff', 'safety',     true,  3,  90),
      (v_pb_id, 'Venue walkthrough completed',                     'operations', true,  3,  100),
      (v_pb_id, 'All vendor final payments processed',             'finance',    true,  NULL, 110),
      (v_pb_id, 'Post-event feedback collected from couple',       'quality',    false, NULL, 120);
  END IF;
END $$;

-- ── Seed: Runsheet items for Corporate Conference ────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Corporate Conference' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_runsheet_items (playbook_id, title, category, offset_hours, duration_minutes, responsible_role, sort_order) VALUES
      (v_pb_id, 'AV and tech setup & test',          'setup',      -4,    120, 'logistics',      10),
      (v_pb_id, 'Registration desk opens',           'guest',      -1,    60,  'coordinator',    20),
      (v_pb_id, 'Networking breakfast / tea',        'catering',   -0.5,  30,  'catering',       30),
      (v_pb_id, 'Welcome address by host',           'program',    0,     15,  'event_manager',  40),
      (v_pb_id, 'Keynote 1',                        'program',    0.25,  60,  'speaker',        50),
      (v_pb_id, 'Q&A — Keynote 1',                  'program',    1.25,  15,  'event_manager',  60),
      (v_pb_id, 'Coffee break / networking',         'catering',   1.5,   20,  'catering',       70),
      (v_pb_id, 'Panel Discussion',                  'program',    1.83,  60,  'event_manager',  80),
      (v_pb_id, 'Lunch break',                      'catering',   3,     60,  'catering',       90),
      (v_pb_id, 'Breakout sessions (parallel)',      'program',    4,     90,  'coordinator',    100),
      (v_pb_id, 'Afternoon tea / networking',        'catering',   5.5,   20,  'catering',       110),
      (v_pb_id, 'Keynote 2 / Closing session',       'program',    5.83,  45,  'speaker',        120),
      (v_pb_id, 'Awards / Recognition ceremony',     'program',    6.5,   30,  'event_manager',  130),
      (v_pb_id, 'Cocktails & networking close',      'networking', 7,     90,  'coordinator',    140),
      (v_pb_id, 'Vendor teardown and venue check-out','teardown',  8.5,   60,  'logistics',      150);
  END IF;
END $$;

-- ============================================================
-- Migration: 028_documents.sql
-- ============================================================
-- ============================================================
-- 028_documents.sql  —  Document Generation System
-- ============================================================
-- Covers: proposals, contracts, invoices, run-of-show PDFs,
-- BEOs (Banquet Event Orders), vendor agreements, letters.
-- Each document has a type, template, version history, and
-- optional e-signature workflow.
-- ============================================================

-- ── Document templates ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'proposal', 'contract', 'invoice', 'beo', 'run_of_show',
    'vendor_agreement', 'letter', 'quote', 'nda', 'custom'
  )),
  description   TEXT,
  -- Template content stored as structured JSON blocks
  content       JSONB NOT NULL DEFAULT '[]',
  -- CSS / branding overrides
  styles        JSONB NOT NULL DEFAULT '{}',
  -- Variable schema: list of {key, label, type, required}
  variables     JSONB NOT NULL DEFAULT '[]',
  is_system     BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  version       INTEGER NOT NULL DEFAULT 1,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_templates_tenant    ON document_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_doc_templates_type      ON document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_doc_templates_system    ON document_templates(is_system) WHERE is_system = true;

-- ── Generated documents ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id      UUID REFERENCES document_templates(id),
  -- Context references (at least one should be set)
  event_id         UUID REFERENCES events(id) ON DELETE SET NULL,
  client_id        UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  vendor_id        UUID REFERENCES vendors(id) ON DELETE SET NULL,
  -- Document metadata
  name             TEXT NOT NULL,
  document_type    TEXT NOT NULL CHECK (document_type IN (
    'proposal', 'contract', 'invoice', 'beo', 'run_of_show',
    'vendor_agreement', 'letter', 'quote', 'nda', 'custom'
  )),
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'review', 'sent', 'viewed', 'signed', 'approved',
    'rejected', 'expired', 'archived'
  )),
  version          INTEGER NOT NULL DEFAULT 1,
  -- Rendered content (merged template + variables)
  content          JSONB NOT NULL DEFAULT '[]',
  -- Variable values used to render this document
  variable_values  JSONB NOT NULL DEFAULT '{}',
  -- Rendered PDF stored in Supabase Storage
  pdf_path         TEXT,
  pdf_url          TEXT,
  pdf_size_bytes   INTEGER,
  -- Sharing
  share_token      TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  share_expires_at TIMESTAMPTZ,
  -- E-signature
  requires_signature BOOLEAN NOT NULL DEFAULT false,
  signed_at        TIMESTAMPTZ,
  signed_by_name   TEXT,
  signed_by_email  TEXT,
  signature_data   JSONB,          -- base64 signature image + metadata
  -- Financial (for invoices / quotes)
  subtotal         NUMERIC(14, 2),
  tax_amount       NUMERIC(14, 2),
  discount_amount  NUMERIC(14, 2),
  total_amount     NUMERIC(14, 2),
  currency         TEXT NOT NULL DEFAULT 'INR',
  due_date         DATE,
  -- Tracking
  sent_at          TIMESTAMPTZ,
  viewed_at        TIMESTAMPTZ,
  view_count       INTEGER NOT NULL DEFAULT 0,
  last_viewed_ip   TEXT,
  notes            TEXT,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant      ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_event       ON documents(event_id);
CREATE INDEX IF NOT EXISTS idx_documents_client      ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_type        ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status      ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_share_token ON documents(share_token);

-- ── Document version history ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  content       JSONB NOT NULL DEFAULT '[]',
  variable_values JSONB NOT NULL DEFAULT '{}',
  pdf_path      TEXT,
  change_note   TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON document_versions(document_id);

-- ── Document activities / audit log ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_activities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  action       TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'sent', 'viewed', 'downloaded',
    'signed', 'approved', 'rejected', 'expired', 'archived',
    'comment_added', 'version_created', 'pdf_generated'
  )),
  actor_id     UUID REFERENCES profiles(id),
  actor_name   TEXT,
  actor_email  TEXT,
  ip_address   TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_activities_document ON document_activities(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_activities_created  ON document_activities(created_at DESC);

-- ── Document line items (for invoices / quotes) ───────────────────────────────

CREATE TABLE IF NOT EXISTS document_line_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  description  TEXT NOT NULL,
  quantity     NUMERIC(10, 3) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_rate     NUMERIC(5, 2) NOT NULL DEFAULT 18,   -- GST default
  line_total   NUMERIC(14, 2) GENERATED ALWAYS AS (
    ROUND(quantity * unit_price * (1 - discount_pct / 100) * (1 + tax_rate / 100), 2)
  ) STORED,
  category     TEXT,
  notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_doc_line_items_document ON document_line_items(document_id);

-- ── Triggers ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();

DROP TRIGGER IF EXISTS trg_doc_templates_updated_at ON document_templates;
CREATE TRIGGER trg_doc_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();

-- Auto-log creation activity
CREATE OR REPLACE FUNCTION log_document_created()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO document_activities (document_id, action, actor_id, created_at)
  VALUES (NEW.id, 'created', NEW.created_by, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_log_created ON documents;
CREATE TRIGGER trg_document_log_created
  AFTER INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION log_document_created();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_line_items ENABLE ROW LEVEL SECURITY;

-- Templates: system templates visible to all, tenant templates to own tenant
CREATE POLICY "templates_tenant_access" ON document_templates
  FOR ALL USING (
    is_system = true
    OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- Documents: tenant-scoped
CREATE POLICY "documents_tenant_access" ON documents
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- Versions: accessible if parent document accessible
CREATE POLICY "doc_versions_tenant_access" ON document_versions
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Activities: accessible if parent document accessible
CREATE POLICY "doc_activities_tenant_access" ON document_activities
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Line items: accessible if parent document accessible
CREATE POLICY "doc_line_items_tenant_access" ON document_line_items
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Public share token access (unauthenticated)
CREATE POLICY "documents_public_share" ON documents
  FOR SELECT USING (
    share_token IS NOT NULL
    AND (share_expires_at IS NULL OR share_expires_at > now())
  );

-- ── System templates seed ─────────────────────────────────────────────────────

INSERT INTO document_templates (name, document_type, description, is_system, variables, content) VALUES

('Event Proposal', 'proposal',
 'Professional event proposal with cover page, scope, timeline, and investment summary',
 true,
 '[
   {"key":"client_name","label":"Client Name","type":"text","required":true},
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"event_venue","label":"Venue","type":"text","required":false},
   {"key":"guest_count","label":"Guest Count","type":"number","required":false},
   {"key":"company_name","label":"Our Company Name","type":"text","required":true},
   {"key":"valid_until","label":"Proposal Valid Until","type":"date","required":false},
   {"key":"total_investment","label":"Total Investment","type":"currency","required":false}
 ]',
 '[
   {"type":"cover","title":"{{event_name}}","subtitle":"Prepared for {{client_name}}","date":"{{event_date}}"},
   {"type":"heading","text":"Executive Summary"},
   {"type":"paragraph","text":"Dear {{client_name}},\n\nThank you for considering {{company_name}} for your upcoming event. We are delighted to present this proposal for {{event_name}}."},
   {"type":"heading","text":"Event Overview"},
   {"type":"key_value","items":[
     {"label":"Event Name","value":"{{event_name}}"},
     {"label":"Event Date","value":"{{event_date}}"},
     {"label":"Venue","value":"{{event_venue}}"},
     {"label":"Expected Guests","value":"{{guest_count}}"}
   ]},
   {"type":"heading","text":"Our Services"},
   {"type":"paragraph","text":"[Describe the services included in this proposal]"},
   {"type":"heading","text":"Investment Summary"},
   {"type":"line_items"},
   {"type":"total_block"},
   {"type":"heading","text":"Terms & Conditions"},
   {"type":"paragraph","text":"This proposal is valid until {{valid_until}}. A 50% advance is required to confirm booking."},
   {"type":"signature_block","label":"Client Acceptance"}
 ]'),

('Service Contract', 'contract',
 'Comprehensive event services contract with payment schedule and cancellation policy',
 true,
 '[
   {"key":"client_name","label":"Client Name","type":"text","required":true},
   {"key":"client_address","label":"Client Address","type":"text","required":true},
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"event_venue","label":"Venue","type":"text","required":true},
   {"key":"company_name","label":"Company Name","type":"text","required":true},
   {"key":"contract_date","label":"Contract Date","type":"date","required":true},
   {"key":"total_value","label":"Total Contract Value","type":"currency","required":true},
   {"key":"advance_amount","label":"Advance Amount","type":"currency","required":true},
   {"key":"balance_due_date","label":"Balance Due Date","type":"date","required":true}
 ]',
 '[
   {"type":"heading","text":"EVENT SERVICES AGREEMENT"},
   {"type":"paragraph","text":"This Agreement is entered into on {{contract_date}} between {{company_name}} (\"Service Provider\") and {{client_name}} of {{client_address}} (\"Client\")."},
   {"type":"heading","text":"1. Event Details"},
   {"type":"key_value","items":[
     {"label":"Event","value":"{{event_name}}"},
     {"label":"Date","value":"{{event_date}}"},
     {"label":"Venue","value":"{{event_venue}}"}
   ]},
   {"type":"heading","text":"2. Services"},
   {"type":"line_items"},
   {"type":"heading","text":"3. Payment Schedule"},
   {"type":"paragraph","text":"Total Contract Value: {{total_value}}\nAdvance (due on signing): {{advance_amount}}\nBalance due: {{balance_due_date}}"},
   {"type":"heading","text":"4. Cancellation Policy"},
   {"type":"paragraph","text":"Cancellations made more than 90 days prior: 25% of advance forfeited.\nCancellations made 30-90 days prior: 50% of advance forfeited.\nCancellations made less than 30 days prior: 100% of advance forfeited."},
   {"type":"heading","text":"5. Force Majeure"},
   {"type":"paragraph","text":"Neither party shall be liable for delays or failures due to circumstances beyond reasonable control."},
   {"type":"dual_signature","party_a":"{{company_name}}","party_b":"{{client_name}}"}
 ]'),

('Tax Invoice', 'invoice',
 'GST-compliant tax invoice with line items, CGST/SGST/IGST breakdown',
 true,
 '[
   {"key":"invoice_number","label":"Invoice Number","type":"text","required":true},
   {"key":"invoice_date","label":"Invoice Date","type":"date","required":true},
   {"key":"due_date","label":"Due Date","type":"date","required":true},
   {"key":"client_name","label":"Client Name","type":"text","required":true},
   {"key":"client_gstin","label":"Client GSTIN","type":"text","required":false},
   {"key":"client_address","label":"Client Address","type":"text","required":true},
   {"key":"company_name","label":"Company Name","type":"text","required":true},
   {"key":"company_gstin","label":"Company GSTIN","type":"text","required":true},
   {"key":"event_name","label":"Event / Reference","type":"text","required":false}
 ]',
 '[
   {"type":"invoice_header","title":"TAX INVOICE"},
   {"type":"invoice_parties","bill_to":"{{client_name}}\n{{client_address}}\nGSTIN: {{client_gstin}}","company":"{{company_name}}\nGSTIN: {{company_gstin}}"},
   {"type":"invoice_meta","items":[
     {"label":"Invoice No.","value":"{{invoice_number}}"},
     {"label":"Invoice Date","value":"{{invoice_date}}"},
     {"label":"Due Date","value":"{{due_date}}"},
     {"label":"Reference","value":"{{event_name}}"}
   ]},
   {"type":"line_items","show_tax":true},
   {"type":"tax_summary","gst_type":"igst"},
   {"type":"total_block","currency":"INR"},
   {"type":"bank_details"},
   {"type":"paragraph","text":"Please transfer the amount to our bank account. Quote invoice number in transfer reference."}
 ]'),

('Banquet Event Order (BEO)', 'beo',
 'Detailed operational BEO covering setup, F&B, AV, staffing requirements',
 true,
 '[
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"setup_time","label":"Setup Time","type":"text","required":true},
   {"key":"start_time","label":"Start Time","type":"text","required":true},
   {"key":"end_time","label":"End Time","type":"text","required":true},
   {"key":"venue_name","label":"Venue / Room","type":"text","required":true},
   {"key":"guest_count","label":"Pax Count","type":"number","required":true},
   {"key":"client_name","label":"Client Name","type":"text","required":true},
   {"key":"account_manager","label":"Account Manager","type":"text","required":true}
 ]',
 '[
   {"type":"heading","text":"BANQUET EVENT ORDER"},
   {"type":"key_value","cols":2,"items":[
     {"label":"Event","value":"{{event_name}}"},
     {"label":"Client","value":"{{client_name}}"},
     {"label":"Date","value":"{{event_date}}"},
     {"label":"Venue / Room","value":"{{venue_name}}"},
     {"label":"Setup Time","value":"{{setup_time}}"},
     {"label":"Start Time","value":"{{start_time}}"},
     {"label":"End Time","value":"{{end_time}}"},
     {"label":"Pax","value":"{{guest_count}}"},
     {"label":"Account Manager","value":"{{account_manager}}"}
   ]},
   {"type":"section_heading","text":"Room Setup"},
   {"type":"checklist_table","headers":["Item","Qty","Notes"]},
   {"type":"section_heading","text":"Food & Beverage"},
   {"type":"menu_block"},
   {"type":"section_heading","text":"Audio-Visual Requirements"},
   {"type":"checklist_table","headers":["Equipment","Qty","Provider"]},
   {"type":"section_heading","text":"Staffing"},
   {"type":"checklist_table","headers":["Role","Count","Reporting Time"]},
   {"type":"section_heading","text":"Special Requirements"},
   {"type":"notes_block"},
   {"type":"approval_row","label":"Approved by"}
 ]'),

('Run of Show', 'run_of_show',
 'Minute-by-minute event run sheet with cues, responsibilities, and timing',
 true,
 '[
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"venue_name","label":"Venue","type":"text","required":true},
   {"key":"event_director","label":"Event Director","type":"text","required":true},
   {"key":"technical_director","label":"Technical Director","type":"text","required":false}
 ]',
 '[
   {"type":"heading","text":"RUN OF SHOW — {{event_name}}"},
   {"type":"key_value","items":[
     {"label":"Date","value":"{{event_date}}"},
     {"label":"Venue","value":"{{venue_name}}"},
     {"label":"Event Director","value":"{{event_director}}"},
     {"label":"Technical Director","value":"{{technical_director}}"}
   ]},
   {"type":"runsheet_table","headers":["Time","Duration","Item","Responsible","AV Cue","Notes"]},
   {"type":"paragraph","text":"All times are approximate. Event Director has authority to adjust timing on the day."}
 ]'),

('Vendor Agreement', 'vendor_agreement',
 'Standard vendor service agreement with deliverables, payment terms, and liability clauses',
 true,
 '[
   {"key":"vendor_name","label":"Vendor Name","type":"text","required":true},
   {"key":"vendor_service","label":"Service Type","type":"text","required":true},
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"company_name","label":"Our Company Name","type":"text","required":true},
   {"key":"total_fee","label":"Total Fee","type":"currency","required":true},
   {"key":"advance_pct","label":"Advance %","type":"number","required":true}
 ]',
 '[
   {"type":"heading","text":"VENDOR SERVICE AGREEMENT"},
   {"type":"paragraph","text":"This agreement is between {{company_name}} (\"Client\") and {{vendor_name}} (\"Vendor\") for {{vendor_service}} services at {{event_name}} on {{event_date}}."},
   {"type":"heading","text":"1. Scope of Services"},
   {"type":"line_items"},
   {"type":"heading","text":"2. Compensation"},
   {"type":"paragraph","text":"Total Fee: {{total_fee}}\nAdvance ({{advance_pct}}%) due on signing. Balance due on day of event."},
   {"type":"heading","text":"3. Vendor Obligations"},
   {"type":"paragraph","text":"Vendor agrees to arrive no later than the time specified, bring all required equipment, and maintain professional conduct throughout."},
   {"type":"heading","text":"4. Cancellation"},
   {"type":"paragraph","text":"Cancellation by Client with less than 14 days notice: 50% of total fee payable. Cancellation by Vendor: full advance to be refunded within 7 days."},
   {"type":"dual_signature","party_a":"{{company_name}}","party_b":"{{vendor_name}}"}
 ]')

ON CONFLICT DO NOTHING;

-- ============================================================
-- Migration: 029_rbac.sql
-- ============================================================
-- ============================================================
-- 029_rbac.sql  —  Advanced RBAC & Permissions System
-- ============================================================
-- Architecture:
--   roles       → named roles scoped to a tenant
--   permissions → granular capability flags (resource:action)
--   role_permissions → many-to-many: role has permissions
--   profile_roles   → many-to-many: user has roles (per tenant)
--   resource_acls   → per-resource overrides (event-level access)
-- ============================================================

-- ── Permission catalogue ───────────────────────────────────────────────────────
-- Exhaustive list of all capabilities in the system.

CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource    TEXT NOT NULL,   -- e.g. 'events', 'finance', 'guests'
  action      TEXT NOT NULL,   -- e.g. 'view', 'create', 'edit', 'delete', 'export'
  code        TEXT NOT NULL UNIQUE,  -- 'events:create'
  description TEXT,
  category    TEXT,            -- ui grouping
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resource, action)
);

CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_code     ON permissions(code);

-- ── Roles ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = system role
  name        TEXT NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  priority    INTEGER NOT NULL DEFAULT 0,  -- higher = more powerful; used for UI ordering
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant  ON roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_system  ON roles(is_system) WHERE is_system = true;

-- ── Role ↔ Permission ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by    UUID REFERENCES profiles(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission_id);

-- ── Profile ↔ Role (tenant-scoped) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profile_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES profiles(id),
  expires_at  TIMESTAMPTZ,   -- optional time-limited role grant
  UNIQUE (profile_id, role_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_roles_profile ON profile_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_role    ON profile_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_tenant  ON profile_roles(tenant_id);

-- ── Resource ACLs (per-object overrides) ─────────────────────────────────────
-- Allows granting/revoking access to specific resources
-- e.g. a team member can view a particular event they wouldn't normally see.

CREATE TABLE IF NOT EXISTS resource_acls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,   -- 'event', 'client', 'vendor', etc.
  resource_id   UUID NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  is_grant      BOOLEAN NOT NULL DEFAULT true,  -- true = grant, false = deny
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES profiles(id),
  UNIQUE (profile_id, resource_type, resource_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_acls_profile  ON resource_acls(profile_id);
CREATE INDEX IF NOT EXISTS idx_resource_acls_resource ON resource_acls(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_acls_tenant   ON resource_acls(tenant_id);

-- ── RBAC audit log ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rbac_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE SET NULL,
  actor_id    UUID REFERENCES profiles(id),
  action      TEXT NOT NULL CHECK (action IN (
    'role_created', 'role_updated', 'role_deleted',
    'permission_granted', 'permission_revoked',
    'role_assigned', 'role_revoked',
    'acl_granted', 'acl_revoked'
  )),
  target_type TEXT,   -- 'role', 'profile', 'permission'
  target_id   UUID,
  metadata    JSONB DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rbac_audit_tenant  ON rbac_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_actor   ON rbac_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_created ON rbac_audit_log(created_at DESC);

-- ── Helper function: check if profile has permission ─────────────────────────

CREATE OR REPLACE FUNCTION profile_has_permission(
  p_profile_id  UUID,
  p_permission  TEXT   -- permission code, e.g. 'events:create'
) RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM profile_roles pr
    JOIN role_permissions rp ON rp.role_id = pr.role_id
    JOIN permissions p        ON p.id = rp.permission_id
    WHERE pr.profile_id = p_profile_id
      AND p.code = p_permission
      AND (pr.expires_at IS NULL OR pr.expires_at > now())
  ) INTO has_perm;
  RETURN has_perm;
END;
$$;

-- ── Helper: get all permissions for a profile ─────────────────────────────────

CREATE OR REPLACE FUNCTION get_profile_permissions(p_profile_id UUID)
RETURNS TABLE(code TEXT, resource TEXT, action TEXT, category TEXT) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
    SELECT DISTINCT p.code, p.resource, p.action, p.category
    FROM profile_roles pr
    JOIN role_permissions rp ON rp.role_id = pr.role_id
    JOIN permissions p        ON p.id = rp.permission_id
    WHERE pr.profile_id = p_profile_id
      AND (pr.expires_at IS NULL OR pr.expires_at > now())
    ORDER BY p.resource, p.action;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE permissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_roles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_acls   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_audit_log  ENABLE ROW LEVEL SECURITY;

-- Permissions: read-only to all authenticated
CREATE POLICY "permissions_read_all" ON permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- Roles: system roles visible to all; tenant roles to own tenant
CREATE POLICY "roles_tenant_access" ON roles FOR ALL USING (
  is_system = true
  OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Role permissions: visible if role is accessible
CREATE POLICY "role_perms_tenant_access" ON role_permissions FOR ALL USING (
  role_id IN (
    SELECT id FROM roles
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  )
);

-- Profile roles: own records + admins in same tenant
CREATE POLICY "profile_roles_own_and_admin" ON profile_roles FOR ALL USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Resource ACLs: tenant-scoped
CREATE POLICY "resource_acls_tenant" ON resource_acls FOR ALL USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Audit log: tenant-scoped
CREATE POLICY "rbac_audit_tenant" ON rbac_audit_log FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- ── Permissions seed — full catalogue ─────────────────────────────────────────

INSERT INTO permissions (resource, action, code, description, category) VALUES
-- Events
('events','view',          'events:view',           'View events list and details',              'Events'),
('events','create',        'events:create',          'Create new events',                         'Events'),
('events','edit',          'events:edit',            'Edit event details',                        'Events'),
('events','delete',        'events:delete',          'Delete events',                             'Events'),
('events','export',        'events:export',          'Export events data',                        'Events'),
('events','publish',       'events:publish',         'Publish event microsite',                   'Events'),
-- CRM
('crm','view',             'crm:view',               'View CRM contacts and deals',               'CRM'),
('crm','create',           'crm:create',             'Create CRM contacts, leads, deals',         'CRM'),
('crm','edit',             'crm:edit',               'Edit CRM records',                          'CRM'),
('crm','delete',           'crm:delete',             'Delete CRM records',                        'CRM'),
('crm','export',           'crm:export',             'Export CRM data',                           'CRM'),
('crm','bulk_assign',      'crm:bulk_assign',        'Bulk assign contacts to team members',      'CRM'),
-- Finance
('finance','view',         'finance:view',           'View invoices, budgets, P&L',               'Finance'),
('finance','create',       'finance:create',         'Create invoices and budget items',          'Finance'),
('finance','edit',         'finance:edit',           'Edit financial records',                    'Finance'),
('finance','delete',       'finance:delete',         'Delete financial records',                  'Finance'),
('finance','approve',      'finance:approve',        'Approve purchase orders and expenses',      'Finance'),
('finance','export',       'finance:export',         'Export financial data and reports',         'Finance'),
('finance','view_margins', 'finance:view_margins',   'View profit margins and sensitive data',    'Finance'),
-- Vendors
('vendors','view',         'vendors:view',           'View vendor profiles',                      'Vendors'),
('vendors','create',       'vendors:create',         'Add new vendors',                           'Vendors'),
('vendors','edit',         'vendors:edit',           'Edit vendor details',                       'Vendors'),
('vendors','delete',       'vendors:delete',         'Delete vendors',                            'Vendors'),
('vendors','contract',     'vendors:contract',       'Create and sign vendor contracts',          'Vendors'),
-- Guests
('guests','view',          'guests:view',            'View guest lists',                          'Guests'),
('guests','create',        'guests:create',          'Add guests',                                'Guests'),
('guests','edit',          'guests:edit',            'Edit guest records',                        'Guests'),
('guests','delete',        'guests:delete',          'Delete guests',                             'Guests'),
('guests','checkin',       'guests:checkin',         'Perform guest check-in',                    'Guests'),
('guests','export',        'guests:export',          'Export guest lists',                        'Guests'),
-- Team
('team','view',            'team:view',              'View team members',                         'Team'),
('team','invite',          'team:invite',            'Invite new team members',                   'Team'),
('team','edit',            'team:edit',              'Edit team member roles',                    'Team'),
('team','remove',          'team:remove',            'Remove team members',                       'Team'),
-- Production
('production','view',      'production:view',        'View production plans and tasks',           'Production'),
('production','create',    'production:create',      'Create production items',                   'Production'),
('production','edit',      'production:edit',        'Edit production records',                   'Production'),
('production','delete',    'production:delete',      'Delete production records',                 'Production'),
-- Artists
('artists','view',         'artists:view',           'View artist roster',                        'Artists'),
('artists','create',       'artists:create',         'Add artists',                               'Artists'),
('artists','edit',         'artists:edit',           'Edit artist records',                       'Artists'),
('artists','book',         'artists:book',           'Book and contract artists',                 'Artists'),
-- Inventory
('inventory','view',       'inventory:view',         'View inventory',                            'Inventory'),
('inventory','create',     'inventory:create',       'Add inventory items',                       'Inventory'),
('inventory','edit',       'inventory:edit',         'Edit inventory',                            'Inventory'),
('inventory','delete',     'inventory:delete',       'Delete inventory items',                    'Inventory'),
('inventory','allocate',   'inventory:allocate',     'Allocate inventory to events',              'Inventory'),
-- Analytics
('analytics','view',       'analytics:view',         'View analytics dashboards',                 'Analytics'),
('analytics','export',     'analytics:export',       'Export analytics data',                     'Analytics'),
('analytics','view_revenue','analytics:view_revenue','View revenue analytics',                    'Analytics'),
-- Documents
('documents','view',       'documents:view',         'View documents',                            'Documents'),
('documents','create',     'documents:create',       'Create documents',                          'Documents'),
('documents','edit',       'documents:edit',         'Edit documents',                            'Documents'),
('documents','delete',     'documents:delete',       'Delete documents',                          'Documents'),
('documents','send',       'documents:send',         'Send documents to clients',                 'Documents'),
('documents','sign',       'documents:sign',         'Sign documents',                            'Documents'),
-- Playbooks
('playbooks','view',       'playbooks:view',         'View playbooks',                            'Playbooks'),
('playbooks','create',     'playbooks:create',       'Create custom playbooks',                   'Playbooks'),
('playbooks','edit',       'playbooks:edit',         'Edit playbooks',                            'Playbooks'),
('playbooks','apply',      'playbooks:apply',        'Apply playbooks to events',                 'Playbooks'),
-- Integrations
('integrations','view',    'integrations:view',      'View integrations',                         'Integrations'),
('integrations','manage',  'integrations:manage',    'Manage API keys and webhooks',              'Integrations'),
-- Settings
('settings','view',        'settings:view',          'View company settings',                     'Settings'),
('settings','edit',        'settings:edit',          'Edit company settings',                     'Settings'),
('settings','billing',     'settings:billing',       'Manage billing and subscription',           'Settings'),
-- RBAC
('rbac','view',            'rbac:view',              'View roles and permissions',                'RBAC'),
('rbac','manage',          'rbac:manage',            'Create and assign roles',                   'RBAC'),
-- Command Center
('command_center','view',  'command_center:view',    'View command center',                       'Command Center'),
('command_center','manage','command_center:manage',  'Manage incidents and alerts',               'Command Center'),
-- Super Admin (tenant-level)
('tenant','manage',        'tenant:manage',          'Full tenant administration',                'Admin'),
('tenant','view_all',      'tenant:view_all',        'View all tenant data',                      'Admin')

ON CONFLICT (resource, action) DO NOTHING;

-- ── System roles seed ─────────────────────────────────────────────────────────

INSERT INTO roles (id, name, description, is_system, color, priority) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Super Admin',       'Full access to everything',                          true, '#ef4444', 100),
  ('00000000-0000-0000-0000-000000000002', 'Company Admin',     'Admin access to all company features',               true, '#f97316', 90),
  ('00000000-0000-0000-0000-000000000003', 'Event Manager',     'Full control over assigned events',                  true, '#6366f1', 70),
  ('00000000-0000-0000-0000-000000000004', 'Senior Coordinator','Manage events, vendors, guests; no finance delete',  true, '#8b5cf6', 60),
  ('00000000-0000-0000-0000-000000000005', 'Operations Staff',  'Day-of operations and check-in',                     true, '#0ea5e9', 50),
  ('00000000-0000-0000-0000-000000000006', 'Finance Manager',   'Full finance access, limited other access',          true, '#10b981', 60),
  ('00000000-0000-0000-0000-000000000007', 'Sales Executive',   'CRM, proposals, client communication',               true, '#f59e0b', 50),
  ('00000000-0000-0000-0000-000000000008', 'Vendor Manager',    'Vendor contracts, artist booking',                   true, '#ec4899', 50),
  ('00000000-0000-0000-0000-000000000009', 'View Only',         'Read-only access across the platform',               true, '#64748b', 10)

ON CONFLICT (id) DO NOTHING;

-- Grant all permissions to Super Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT DO NOTHING;

-- Grant all permissions to Company Admin (except super admin flags)
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
WHERE code NOT IN ('settings:billing', 'rbac:manage', 'tenant:manage')
ON CONFLICT DO NOTHING;

-- Event Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions
WHERE resource IN ('events','crm','guests','vendors','production','artists','inventory','documents','playbooks')
   OR code IN ('analytics:view','command_center:view','settings:view')
ON CONFLICT DO NOTHING;

-- Senior Coordinator
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', id FROM permissions
WHERE (resource IN ('events','guests','vendors','production','inventory','documents')
      AND action != 'delete')
   OR code IN ('crm:view','crm:edit','finance:view','analytics:view','settings:view')
ON CONFLICT DO NOTHING;

-- Operations Staff
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000005', id FROM permissions
WHERE code IN (
  'events:view','guests:view','guests:checkin','vendors:view',
  'production:view','production:edit','inventory:view','inventory:allocate',
  'command_center:view','settings:view'
)
ON CONFLICT DO NOTHING;

-- Finance Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000006', id FROM permissions
WHERE resource IN ('finance','documents')
   OR code IN (
     'events:view','crm:view','vendors:view','analytics:view',
     'analytics:view_revenue','settings:view'
   )
ON CONFLICT DO NOTHING;

-- Sales Executive
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000007', id FROM permissions
WHERE resource IN ('crm','documents')
   OR code IN (
     'events:view','events:create','playbooks:view','playbooks:apply',
     'analytics:view','settings:view'
   )
ON CONFLICT DO NOTHING;

-- Vendor Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000008', id FROM permissions
WHERE resource IN ('vendors','artists')
   OR code IN (
     'events:view','production:view','inventory:view','inventory:allocate',
     'documents:view','documents:create','documents:send','settings:view'
   )
ON CONFLICT DO NOTHING;

-- View Only — all :view permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000009', id FROM permissions
WHERE action = 'view'
ON CONFLICT DO NOTHING;

-- ============================================================
-- Migration: 030_guest_management_expansion.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Guest Management Expansion (Migration 030)
-- Covers: invitations, RSVP, accommodation, import batches
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── INVITATION SYSTEM ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invitation_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  is_global       BOOLEAN DEFAULT FALSE,     -- saved as reusable template across events
  -- Section visibility flags
  show_banner         BOOLEAN DEFAULT TRUE,
  show_event_name     BOOLEAN DEFAULT TRUE,
  show_tagline        BOOLEAN DEFAULT TRUE,
  show_datetime       BOOLEAN DEFAULT TRUE,
  show_venue          BOOLEAN DEFAULT TRUE,
  show_dress_code     BOOLEAN DEFAULT FALSE,
  show_host_message   BOOLEAN DEFAULT FALSE,
  show_schedule       BOOLEAN DEFAULT FALSE,
  show_rsvp_button    BOOLEAN DEFAULT TRUE,
  show_contact        BOOLEAN DEFAULT FALSE,
  show_social_links   BOOLEAN DEFAULT FALSE,
  show_footer         BOOLEAN DEFAULT FALSE,
  -- Content
  banner_url          TEXT,
  tagline             TEXT,
  host_message        TEXT,
  schedule_preview    JSONB DEFAULT '[]',    -- [{time, title}]
  rsvp_deadline       TIMESTAMPTZ,
  contact_name        TEXT,
  contact_phone       TEXT,
  contact_email       TEXT,
  social_links        JSONB DEFAULT '{}',    -- {instagram, facebook, twitter, ...}
  footer_message      TEXT,
  -- Design
  layout_template     TEXT DEFAULT 'elegant'  CHECK (layout_template IN ('elegant','modern','minimal','festive','corporate')),
  base_theme          TEXT DEFAULT 'dark'      CHECK (base_theme IN ('light','dark')),
  primary_color       TEXT DEFAULT '#6366f1',
  secondary_color     TEXT DEFAULT '#f59e0b',
  background_color    TEXT DEFAULT '#0f172a',
  text_color          TEXT DEFAULT '#f8fafc',
  accent_color        TEXT DEFAULT '#e11d48',
  button_color        TEXT DEFAULT '#6366f1',
  button_text_color   TEXT DEFAULT '#ffffff',
  button_style        TEXT DEFAULT 'rounded'   CHECK (button_style IN ('sharp','rounded','pill')),
  font_family         TEXT DEFAULT 'Inter',
  font_size_base      INTEGER DEFAULT 16,
  logo_url            TEXT,
  logo_placement      TEXT DEFAULT 'top-center' CHECK (logo_placement IN ('top-left','top-center','top-right')),
  border_style        TEXT DEFAULT 'none'       CHECK (border_style IN ('none','thin','thick','double','shadow','rounded')),
  border_radius       TEXT DEFAULT 'default'    CHECK (border_radius IN ('sharp','default','rounded','pill')),
  background_type     TEXT DEFAULT 'solid'      CHECK (background_type IN ('solid','gradient','pattern','image')),
  background_image_url TEXT,
  section_spacing     TEXT DEFAULT 'normal'     CHECK (section_spacing IN ('compact','normal','spacious')),
  watermark_text      TEXT,
  watermark_opacity   NUMERIC(3,2) DEFAULT 0.0 CHECK (watermark_opacity BETWEEN 0 AND 1),
  -- Meta
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invitations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_id       UUID REFERENCES invitation_templates(id) ON DELETE SET NULL,
  guest_id          UUID REFERENCES guests(id) ON DELETE CASCADE,
  -- Unique token for guest-personalised link
  token             TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  personalised_url  TEXT,           -- set after generation: /i/[token]
  -- Status tracking
  status            TEXT DEFAULT 'draft'
                      CHECK (status IN ('draft','sent','delivered','opened','bounced','failed')),
  channel           TEXT DEFAULT 'email'
                      CHECK (channel IN ('email','whatsapp','sms','link')),
  sent_at           TIMESTAMPTZ,
  opened_at         TIMESTAMPTZ,
  opened_count      INTEGER DEFAULT 0,
  scheduled_at      TIMESTAMPTZ,       -- for scheduled sends
  -- Personalisation merge data
  merge_data        JSONB DEFAULT '{}', -- {guest_name, table_number, plus_one, ...}
  -- Meta
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_event    ON invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_invitations_guest    ON invitations(guest_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token    ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status   ON invitations(status);

-- ─── RSVP SYSTEM ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rsvp_forms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name                TEXT NOT NULL DEFAULT 'RSVP Form',
  -- Public access
  public_slug         TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  is_active           BOOLEAN DEFAULT TRUE,
  deadline            TIMESTAMPTZ,
  max_responses       INTEGER,          -- capacity cap (NULL = unlimited)
  password_protected  BOOLEAN DEFAULT FALSE,
  password_hash       TEXT,
  moderation_enabled  BOOLEAN DEFAULT FALSE,  -- require admin approval
  -- Section visibility flags
  show_attendance         BOOLEAN DEFAULT TRUE,   -- always on; required
  show_plus_one           BOOLEAN DEFAULT TRUE,
  show_meal_preference    BOOLEAN DEFAULT TRUE,
  show_dietary            BOOLEAN DEFAULT TRUE,
  show_accommodation      BOOLEAN DEFAULT FALSE,
  show_transport          BOOLEAN DEFAULT FALSE,
  show_tshirt_size        BOOLEAN DEFAULT FALSE,
  show_emergency_contact  BOOLEAN DEFAULT FALSE,
  show_message_to_host    BOOLEAN DEFAULT FALSE,
  -- Design (mirrors invitation_templates)
  layout_template     TEXT DEFAULT 'modern'  CHECK (layout_template IN ('elegant','modern','minimal','festive','corporate')),
  base_theme          TEXT DEFAULT 'light'   CHECK (base_theme IN ('light','dark')),
  primary_color       TEXT DEFAULT '#6366f1',
  background_color    TEXT DEFAULT '#ffffff',
  text_color          TEXT DEFAULT '#0f172a',
  button_color        TEXT DEFAULT '#6366f1',
  button_text_color   TEXT DEFAULT '#ffffff',
  font_family         TEXT DEFAULT 'Inter',
  logo_url            TEXT,
  logo_placement      TEXT DEFAULT 'top-center',
  border_radius       TEXT DEFAULT 'default',
  -- Thank-you page
  thankyou_message    TEXT DEFAULT 'Thank you for your RSVP!',
  thankyou_redirect_url TEXT,
  -- Meta
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rsvp_custom_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       UUID NOT NULL REFERENCES rsvp_forms(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('text','textarea','dropdown','checkbox','date','number')),
  options       JSONB DEFAULT '[]',  -- for dropdown/checkbox options
  is_required   BOOLEAN DEFAULT FALSE,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rsvp_responses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  form_id               UUID NOT NULL REFERENCES rsvp_forms(id) ON DELETE CASCADE,
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id              UUID REFERENCES guests(id) ON DELETE SET NULL,
  -- Core attendance
  attendance            TEXT NOT NULL CHECK (attendance IN ('yes','maybe','no')),
  -- Plus one
  plus_one_name         TEXT,
  plus_one_dietary      TEXT,
  -- Meal
  meal_preference       TEXT CHECK (meal_preference IN ('veg','non_veg','vegan','jain','halal','kosher','gluten_free','custom')),
  dietary_notes         TEXT,
  -- Accommodation
  accommodation_needed  BOOLEAN DEFAULT FALSE,
  accom_checkin_date    DATE,
  accom_checkout_date   DATE,
  accom_room_type       TEXT,
  accom_special_requests TEXT,
  -- Transport
  transport_needed      BOOLEAN DEFAULT FALSE,
  transport_pickup_location TEXT,
  transport_arrival_time TEXT,
  transport_flight_details TEXT,
  -- T-shirt
  tshirt_size           TEXT CHECK (tshirt_size IN ('XS','S','M','L','XL','XXL','XXXL')),
  -- Emergency contact
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  -- Message
  message_to_host       TEXT,
  -- Custom question answers
  custom_answers        JSONB DEFAULT '{}',  -- {question_id: answer}
  -- Moderation
  approval_status       TEXT DEFAULT 'auto_approved'
                          CHECK (approval_status IN ('pending','approved','rejected','auto_approved')),
  reviewed_by           UUID,
  reviewed_at           TIMESTAMPTZ,
  -- Meta
  ip_address            INET,
  user_agent            TEXT,
  submitted_at          TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rsvp_responses_form    ON rsvp_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_event   ON rsvp_responses(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_guest   ON rsvp_responses(guest_id);

-- Update guests table to track invite + RSVP state from new system
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS invite_status TEXT DEFAULT 'not_sent'
    CHECK (invite_status IN ('not_sent','sent','delivered','opened','bounced')),
  ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rsvp_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accommodation_status TEXT DEFAULT 'not_required'
    CHECK (accommodation_status IN ('not_required','requested','allocated','checked_in','checked_out')),
  ADD COLUMN IF NOT EXISTS transport_status TEXT DEFAULT 'not_required'
    CHECK (transport_status IN ('not_required','requested','arranged')),
  ADD COLUMN IF NOT EXISTS meal_preference TEXT
    CHECK (meal_preference IN ('veg','non_veg','vegan','jain','halal','kosher','gluten_free','custom')),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual','imported','self_registered','team_member')),
  ADD COLUMN IF NOT EXISTS registration_approved BOOLEAN,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general'
    CHECK (category IN ('vip','general','media','family','friend','colleague','vendor','speaker','sponsor','other'));

-- ─── ACCOMMODATION MANAGEMENT ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hotels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  country         TEXT DEFAULT 'India',
  star_rating     INTEGER CHECK (star_rating BETWEEN 1 AND 7),
  contact_name    TEXT,
  contact_phone   TEXT,
  contact_email   TEXT,
  website         TEXT,
  notes           TEXT,
  logo_url        TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hotel_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_number     TEXT NOT NULL,
  room_type       TEXT NOT NULL
                    CHECK (room_type IN ('single','double','twin','suite','deluxe','family','presidential')),
  capacity        INTEGER NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 10),
  floor           INTEGER,
  amenities       TEXT[] DEFAULT '{}',
  rate_per_night  NUMERIC(10,2),
  currency        TEXT DEFAULT 'INR',
  is_available    BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (hotel_id, room_number)
);

CREATE TABLE IF NOT EXISTS accommodation_bookings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id                UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  hotel_id                UUID NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  room_id                 UUID NOT NULL REFERENCES hotel_rooms(id) ON DELETE RESTRICT,
  guest_id                UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  check_in_date           DATE NOT NULL,
  check_out_date          DATE NOT NULL,
  -- Computed: out - in (stored for performance)
  nights                  INTEGER GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
  status                  TEXT DEFAULT 'pending'
                            CHECK (status IN ('pending','confirmed','cancelled','checked_in','checked_out','no_show')),
  booked_by               UUID,     -- user who made the booking
  booking_reference       TEXT DEFAULT encode(gen_random_bytes(6), 'hex'),
  special_requests        TEXT,
  is_complimentary        BOOLEAN DEFAULT FALSE,
  amount                  NUMERIC(10,2),
  paid_by_guest           BOOLEAN DEFAULT FALSE,
  voucher_generated       BOOLEAN DEFAULT FALSE,
  voucher_sent            BOOLEAN DEFAULT FALSE,
  voucher_sent_at         TIMESTAMPTZ,
  voucher_url             TEXT,      -- link to generated PDF
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  -- Enforce dates are valid
  CONSTRAINT chk_checkout_after_checkin CHECK (check_out_date > check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_accom_bookings_event   ON accommodation_bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_accom_bookings_guest   ON accommodation_bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_accom_bookings_room    ON accommodation_bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_accom_bookings_hotel   ON accommodation_bookings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_accom_bookings_dates   ON accommodation_bookings(check_in_date, check_out_date);

-- Prevent double-booking: same room cannot have overlapping confirmed bookings
CREATE OR REPLACE FUNCTION prevent_room_double_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM accommodation_bookings
    WHERE room_id = NEW.room_id
      AND id != NEW.id
      AND status NOT IN ('cancelled','no_show')
      AND check_in_date < NEW.check_out_date
      AND check_out_date > NEW.check_in_date
  ) THEN
    RAISE EXCEPTION 'Room % is already booked for the requested dates', NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_room_double_booking ON accommodation_bookings;
CREATE TRIGGER trg_prevent_room_double_booking
  BEFORE INSERT OR UPDATE ON accommodation_bookings
  FOR EACH ROW EXECUTE FUNCTION prevent_room_double_booking();

-- ─── GUEST IMPORT BATCHES ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guest_import_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  imported_by     UUID,
  filename        TEXT NOT NULL,
  total_rows      INTEGER DEFAULT 0,
  imported_count  INTEGER DEFAULT 0,
  skipped_count   INTEGER DEFAULT 0,
  failed_count    INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'processing'
                    CHECK (status IN ('processing','completed','failed')),
  error_log       JSONB DEFAULT '[]',  -- [{row, field, error}]
  column_mapping  JSONB DEFAULT '{}',  -- {csv_col: db_col}
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_event ON guest_import_batches(event_id);

-- ─── PUBLIC REGISTRATION LINKS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_registration_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  slug                TEXT UNIQUE NOT NULL,  -- used in /register/[slug]
  is_active           BOOLEAN DEFAULT TRUE,
  expires_at          TIMESTAMPTZ,
  max_registrations   INTEGER,    -- capacity cap
  current_count       INTEGER DEFAULT 0,
  password_protected  BOOLEAN DEFAULT FALSE,
  password_hash       TEXT,
  moderation_enabled  BOOLEAN DEFAULT FALSE,
  custom_questions    JSONB DEFAULT '[]',  -- [{id, text, type, required, options}]
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_links_event ON event_registration_links(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_links_slug ON event_registration_links(slug);

-- ─── VOUCHER TEMPLATES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS voucher_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  is_global       BOOLEAN DEFAULT FALSE,
  -- Section toggles
  show_event_logo       BOOLEAN DEFAULT TRUE,
  show_guest_name       BOOLEAN DEFAULT TRUE,
  show_guest_designation BOOLEAN DEFAULT TRUE,
  show_hotel_name       BOOLEAN DEFAULT TRUE,
  show_hotel_address    BOOLEAN DEFAULT TRUE,
  show_hotel_stars      BOOLEAN DEFAULT TRUE,
  show_room_number      BOOLEAN DEFAULT TRUE,
  show_room_type        BOOLEAN DEFAULT TRUE,
  show_checkin_date     BOOLEAN DEFAULT TRUE,
  show_checkout_date    BOOLEAN DEFAULT TRUE,
  show_nights           BOOLEAN DEFAULT TRUE,
  show_booking_ref      BOOLEAN DEFAULT TRUE,
  show_special_requests BOOLEAN DEFAULT FALSE,
  show_hotel_contact    BOOLEAN DEFAULT TRUE,
  show_emergency_contact BOOLEAN DEFAULT FALSE,
  show_terms            BOOLEAN DEFAULT FALSE,
  show_qr_code          BOOLEAN DEFAULT TRUE,
  show_signature_block  BOOLEAN DEFAULT FALSE,
  show_footer           BOOLEAN DEFAULT TRUE,
  -- Content
  terms_text      TEXT,
  footer_message  TEXT,
  -- Design
  layout_template TEXT DEFAULT 'elegant'
                    CHECK (layout_template IN ('elegant','minimal','bordered','ribbon')),
  page_size       TEXT DEFAULT 'a4_portrait'
                    CHECK (page_size IN ('a4_portrait','a4_landscape','card','mobile')),
  primary_color   TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#f59e0b',
  background_color TEXT DEFAULT '#ffffff',
  text_color      TEXT DEFAULT '#0f172a',
  heading_color   TEXT DEFAULT '#1e293b',
  border_style    TEXT DEFAULT 'elegant',
  border_color    TEXT DEFAULT '#6366f1',
  font_family     TEXT DEFAULT 'Inter',
  logo_url        TEXT,
  logo_placement  TEXT DEFAULT 'top-center',
  background_type TEXT DEFAULT 'solid',
  background_image_url TEXT,
  watermark_text  TEXT,
  watermark_opacity NUMERIC(3,2) DEFAULT 0.0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE invitation_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_forms                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_custom_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_responses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_rooms                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodation_bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_import_batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registration_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_templates            ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY "tenant_isolation" ON invitation_templates
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON invitations
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON rsvp_forms
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON rsvp_custom_questions
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON rsvp_responses
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON hotels
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON hotel_rooms
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON accommodation_bookings
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON guest_import_batches
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON event_registration_links
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
CREATE POLICY "tenant_isolation" ON voucher_templates
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

