-- ============================================================
-- OccasionPro — Migration 076: Intelligence Layer
--
-- Tables for the rule-based AI intelligence engine:
--   • smart_alerts    — per-event rule-triggered alerts
--   • event_health_scores — aggregated health score per event
--
-- Referenced by: intelligence.service.ts
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── smart_alerts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS smart_alerts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id    uuid        NOT NULL,
  alert_type   text        NOT NULL,                 -- unique rule key, e.g. 'guest_count_low'
  severity     alert_severity NOT NULL DEFAULT 'info',
  title        text        NOT NULL,
  message      text        NOT NULL,
  context      jsonb,                                -- rule-specific data (thresholds, counts, etc.)
  is_dismissed boolean     NOT NULL DEFAULT false,
  dismissed_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  dismissed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT smart_alerts_event_type_unique UNIQUE (event_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_smart_alerts_event     ON smart_alerts(event_id) WHERE is_dismissed = false;
CREATE INDEX IF NOT EXISTS idx_smart_alerts_tenant    ON smart_alerts(tenant_id) WHERE is_dismissed = false;
CREATE INDEX IF NOT EXISTS idx_smart_alerts_severity  ON smart_alerts(severity, created_at DESC);

ALTER TABLE smart_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_alerts_tenant_read"
  ON smart_alerts FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "smart_alerts_tenant_update"
  ON smart_alerts FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "smart_alerts_service_all"
  ON smart_alerts FOR ALL
  USING (auth.role() = 'service_role');

-- ── event_health_scores ───────────────────────────────────
CREATE TABLE IF NOT EXISTS event_health_scores (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id        uuid        NOT NULL,
  overall_score    int         NOT NULL DEFAULT 100 CHECK (overall_score BETWEEN 0 AND 100),
  dimension_scores jsonb       NOT NULL DEFAULT '{}'::jsonb,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  recompute_at     timestamptz NOT NULL DEFAULT (now() + interval '6 hours'),

  CONSTRAINT event_health_scores_event_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_health_scores_tenant   ON event_health_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_health_scores_recompute ON event_health_scores(recompute_at);

ALTER TABLE event_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_health_scores_tenant_read"
  ON event_health_scores FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "event_health_scores_service_all"
  ON event_health_scores FOR ALL
  USING (auth.role() = 'service_role');

-- ── updated_at trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_smart_alerts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_smart_alerts_updated_at ON smart_alerts;
CREATE TRIGGER trg_smart_alerts_updated_at
  BEFORE UPDATE ON smart_alerts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_smart_alerts();
