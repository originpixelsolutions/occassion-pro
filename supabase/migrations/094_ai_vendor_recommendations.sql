-- ─────────────────────────────────────────────────────────────
-- Migration 094: AI Vendor Recommendation Engine
-- Stores AI-generated vendor recommendation sessions and their
-- ranked shortlists with reasoning, scores, and user feedback.
-- ─────────────────────────────────────────────────────────────

-- ── Vendor performance scores (denormalised for fast AI lookup) ──
CREATE TABLE IF NOT EXISTS vendor_performance_scores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Aggregated metrics (updated by trigger / periodic job)
  total_bookings      int  NOT NULL DEFAULT 0,
  completed_bookings  int  NOT NULL DEFAULT 0,
  cancelled_bookings  int  NOT NULL DEFAULT 0,
  avg_rating          numeric(3,2),          -- 0.00 – 5.00
  on_time_rate        numeric(5,2),          -- %
  budget_adherence    numeric(5,2),          -- % of bookings within agreed budget
  repeat_hire_rate    numeric(5,2),          -- % of tenants who re-hired
  avg_response_hours  numeric(6,2),          -- avg time to respond to quote req
  last_booked_at      timestamptz,

  -- Composite score (0–100) updated by recalc function
  composite_score  numeric(5,2) NOT NULL DEFAULT 0,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (vendor_id, tenant_id)
);

-- ── AI Recommendation sessions ────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_vendor_recommendation_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id    uuid REFERENCES events(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Input criteria
  event_type        text,
  service_category  text NOT NULL,
  budget_min        numeric(14,2),
  budget_max        numeric(14,2),
  event_date        date,
  location          text,
  guest_count       int,
  requirements      text,            -- free-text brief

  -- AI output
  model_used        text,
  tokens_used       int,
  latency_ms        int,
  raw_ai_response   text,

  status   text NOT NULL DEFAULT 'pending'   -- pending | completed | error
           CHECK (status IN ('pending','completed','error')),
  error    text,

  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Individual ranked recommendations within a session ────────
CREATE TABLE IF NOT EXISTS ai_vendor_recommendations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES ai_vendor_recommendation_sessions(id) ON DELETE CASCADE,
  vendor_id     uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  rank          int NOT NULL,           -- 1 = top pick
  match_score   numeric(5,2),          -- 0–100 AI confidence score
  reasoning     text,                  -- AI explanation for this pick

  -- Breakdown scores surfaced in UI
  score_budget    numeric(5,2),
  score_category  numeric(5,2),
  score_history   numeric(5,2),
  score_rating    numeric(5,2),

  -- User feedback
  user_action  text   -- 'shortlisted' | 'dismissed' | 'assigned'
               CHECK (user_action IN ('shortlisted','dismissed','assigned') OR user_action IS NULL),
  actioned_at  timestamptz,
  actioned_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vendor_perf_tenant    ON vendor_performance_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_perf_composite ON vendor_performance_scores(tenant_id, composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_rec_sessions_event  ON ai_vendor_recommendation_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_ai_rec_sessions_tenant ON ai_vendor_recommendation_sessions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_recs_session        ON ai_vendor_recommendations(session_id, rank);
CREATE INDEX IF NOT EXISTS idx_ai_recs_vendor         ON ai_vendor_recommendations(vendor_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE vendor_performance_scores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_vendor_recommendation_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_vendor_recommendations             ENABLE ROW LEVEL SECURITY;

-- vendor_performance_scores: tenant-scoped read/write
CREATE POLICY "tenant_vendor_perf" ON vendor_performance_scores
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- recommendation sessions: tenant-scoped
CREATE POLICY "tenant_ai_rec_sessions" ON ai_vendor_recommendation_sessions
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- recommendation rows: tenant-scoped
CREATE POLICY "tenant_ai_recs" ON ai_vendor_recommendations
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── Helper: recalculate composite score ──────────────────────
CREATE OR REPLACE FUNCTION recalc_vendor_composite_score(p_vendor_id uuid, p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v record;
  score numeric;
BEGIN
  SELECT * INTO v
  FROM vendor_performance_scores
  WHERE vendor_id = p_vendor_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Weighted composite: rating 35%, on_time 25%, budget_adherence 20%, repeat_hire 15%, response 5%
  score :=
    COALESCE(v.avg_rating, 0)         / 5.0 * 35 +
    COALESCE(v.on_time_rate, 50)       / 100 * 25 +
    COALESCE(v.budget_adherence, 50)   / 100 * 20 +
    COALESCE(v.repeat_hire_rate, 0)    / 100 * 15 +
    GREATEST(0, (24 - LEAST(COALESCE(v.avg_response_hours, 24), 24)) / 24.0) * 5;

  UPDATE vendor_performance_scores
  SET composite_score = ROUND(score, 2), updated_at = now()
  WHERE vendor_id = p_vendor_id AND tenant_id = p_tenant_id;
END;
$$;

-- ── Seed performance rows when a vendor is created ───────────
CREATE OR REPLACE FUNCTION seed_vendor_performance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO vendor_performance_scores (vendor_id, tenant_id)
  VALUES (NEW.id, NEW.tenant_id)
  ON CONFLICT (vendor_id, tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_vendor_performance ON vendors;
CREATE TRIGGER trg_seed_vendor_performance
  AFTER INSERT ON vendors
  FOR EACH ROW EXECUTE FUNCTION seed_vendor_performance();
