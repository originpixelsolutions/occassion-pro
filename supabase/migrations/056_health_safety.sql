-- ============================================================
-- Migration 056 — Health & Safety Module
-- ============================================================

-- ─────────────────────────────────────────────
-- Health & Safety Plans (master record per event)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.health_safety_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title                 VARCHAR(200) NOT NULL DEFAULT 'Health & Safety Plan',
  status                VARCHAR(30) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','under_review','approved','archived')),
  crowd_capacity        INT,
  venue_area_sqm        NUMERIC(10,2),
  expected_attendance   INT,
  medical_team_count    INT DEFAULT 0,
  security_team_count   INT DEFAULT 0,
  first_aid_kits        INT DEFAULT 0,
  aed_units             INT DEFAULT 0,           -- defibrillators
  fire_extinguishers    INT DEFAULT 0,
  emergency_exits       INT DEFAULT 0,
  nearest_hospital      TEXT,
  hospital_distance_km  NUMERIC(5,2),
  emergency_contact_name    VARCHAR(150),
  emergency_contact_phone   VARCHAR(30),
  ambulance_on_site     BOOLEAN NOT NULL DEFAULT FALSE,
  police_liaison_name   VARCHAR(150),
  police_liaison_phone  VARCHAR(30),
  weather_contingency   TEXT,
  evacuation_plan_url   TEXT,
  notes                 TEXT,
  approved_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,
  reviewed_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  created_by            UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_plans_event ON public.health_safety_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_hs_plans_tenant ON public.health_safety_plans(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hs_plans_event_unique ON public.health_safety_plans(event_id);

-- ─────────────────────────────────────────────
-- Risk Assessments
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hs_risk_assessments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           UUID NOT NULL REFERENCES public.health_safety_plans(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category          VARCHAR(50) NOT NULL
                      CHECK (category IN (
                        'crowd_management','fire_safety','medical','security',
                        'electrical','structural','weather','food_safety',
                        'transport','chemical','noise','other'
                      )),
  hazard            TEXT NOT NULL,
  who_affected      TEXT,                          -- 'guests, staff, artists'
  likelihood        SMALLINT NOT NULL DEFAULT 3
                      CHECK (likelihood BETWEEN 1 AND 5),
  severity          SMALLINT NOT NULL DEFAULT 3
                      CHECK (severity BETWEEN 1 AND 5),
  risk_score        SMALLINT GENERATED ALWAYS AS (likelihood * severity) STORED,
  risk_level        VARCHAR(20) GENERATED ALWAYS AS (
                      CASE (likelihood * severity)
                        WHEN 1  THEN 'very_low'
                        WHEN 2  THEN 'very_low'
                        WHEN 3  THEN 'low'
                        WHEN 4  THEN 'low'
                        WHEN 5  THEN 'medium'
                        WHEN 6  THEN 'medium'
                        WHEN 8  THEN 'medium'
                        WHEN 9  THEN 'high'
                        WHEN 10 THEN 'high'
                        WHEN 12 THEN 'high'
                        WHEN 15 THEN 'critical'
                        WHEN 16 THEN 'critical'
                        WHEN 20 THEN 'critical'
                        WHEN 25 THEN 'critical'
                        ELSE 'medium'
                      END
                    ) STORED,
  mitigation        TEXT NOT NULL,
  residual_likelihood SMALLINT CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_severity   SMALLINT CHECK (residual_severity BETWEEN 1 AND 5),
  owner             VARCHAR(150),
  status            VARCHAR(20) NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','mitigated','accepted','closed')),
  review_date       DATE,
  notes             TEXT,
  created_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_risks_plan    ON public.hs_risk_assessments(plan_id);
CREATE INDEX IF NOT EXISTS idx_hs_risks_event   ON public.hs_risk_assessments(event_id);
CREATE INDEX IF NOT EXISTS idx_hs_risks_level   ON public.hs_risk_assessments(risk_level);

-- ─────────────────────────────────────────────
-- Incidents
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hs_incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID REFERENCES public.health_safety_plans(id) ON DELETE SET NULL,
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  incident_type   VARCHAR(50) NOT NULL
                    CHECK (incident_type IN (
                      'medical','security','fire','structural','crowd',
                      'electrical','weather','food_poisoning','theft',
                      'harassment','near_miss','other'
                    )),
  title           VARCHAR(200) NOT NULL,
  description     TEXT NOT NULL,
  severity        VARCHAR(20) NOT NULL DEFAULT 'minor'
                    CHECK (severity IN ('minor','moderate','serious','critical')),
  occurred_at     TIMESTAMPTZ NOT NULL,
  location        VARCHAR(200),
  injured_count   INT DEFAULT 0,
  hospitalized    BOOLEAN NOT NULL DEFAULT FALSE,
  reported_by     VARCHAR(150),
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action_taken    TEXT,
  follow_up       TEXT,
  police_report   BOOLEAN NOT NULL DEFAULT FALSE,
  police_ref_no   VARCHAR(100),
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','investigating','resolved','closed')),
  resolved_at     TIMESTAMPTZ,
  resolution_notes TEXT,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_incidents_event    ON public.hs_incidents(event_id);
CREATE INDEX IF NOT EXISTS idx_hs_incidents_type     ON public.hs_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_hs_incidents_severity ON public.hs_incidents(severity);

-- ─────────────────────────────────────────────
-- Pre-Event Checklists
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hs_checklists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES public.health_safety_plans(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  category    VARCHAR(50) NOT NULL DEFAULT 'general'
                CHECK (category IN (
                  'general','venue','medical','fire_safety','crowd',
                  'electrical','catering','security','communications','post_event'
                )),
  due_date    DATE,
  assigned_to VARCHAR(150),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','completed','n_a')),
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_checklists_plan  ON public.hs_checklists(plan_id);
CREATE INDEX IF NOT EXISTS idx_hs_checklists_event ON public.hs_checklists(event_id);

-- ─────────────────────────────────────────────
-- Checklist Items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hs_checklist_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id  UUID NOT NULL REFERENCES public.hs_checklists(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  is_checked    BOOLEAN NOT NULL DEFAULT FALSE,
  checked_by    VARCHAR(150),
  checked_at    TIMESTAMPTZ,
  notes         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_items_checklist ON public.hs_checklist_items(checklist_id);

-- ─────────────────────────────────────────────
-- Seed: default checklist templates (system level, tenant_id IS NULL → applied at first plan creation)
-- ─────────────────────────────────────────────
-- (Applied programmatically in service layer — not seeded here to avoid missing FK)

-- ─────────────────────────────────────────────
-- Updated-at triggers
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_hs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'health_safety_plans','hs_risk_assessments',
    'hs_incidents','hs_checklists'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION update_hs_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE public.health_safety_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_risk_assessments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_incidents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_checklists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_checklist_items     ENABLE ROW LEVEL SECURITY;

-- health_safety_plans
CREATE POLICY "hs_plans_tenant_isolation" ON public.health_safety_plans
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- hs_risk_assessments
CREATE POLICY "hs_risks_tenant_isolation" ON public.hs_risk_assessments
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- hs_incidents
CREATE POLICY "hs_incidents_tenant_isolation" ON public.hs_incidents
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- hs_checklists
CREATE POLICY "hs_checklists_tenant_isolation" ON public.hs_checklists
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- hs_checklist_items (join through checklist → plan → tenant)
CREATE POLICY "hs_items_tenant_isolation" ON public.hs_checklist_items
  USING (
    EXISTS (
      SELECT 1
      FROM public.hs_checklists cl
      WHERE cl.id = hs_checklist_items.checklist_id
        AND cl.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────
-- Crowd density view (helper for capacity calculations)
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_hs_crowd_density AS
SELECT
  p.id                          AS plan_id,
  p.event_id,
  p.crowd_capacity,
  p.venue_area_sqm,
  p.expected_attendance,
  CASE
    WHEN p.venue_area_sqm > 0 AND p.expected_attendance > 0
    THEN ROUND((p.expected_attendance / p.venue_area_sqm)::NUMERIC, 2)
    ELSE NULL
  END                           AS persons_per_sqm,
  CASE
    WHEN p.venue_area_sqm > 0 AND p.expected_attendance > 0
    THEN CASE
      WHEN (p.expected_attendance / p.venue_area_sqm) <= 1.0 THEN 'safe'
      WHEN (p.expected_attendance / p.venue_area_sqm) <= 2.0 THEN 'moderate'
      WHEN (p.expected_attendance / p.venue_area_sqm) <= 3.0 THEN 'dense'
      ELSE 'overcrowded'
    END
    ELSE 'unknown'
  END                           AS density_status
FROM public.health_safety_plans p;
