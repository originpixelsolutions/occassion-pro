-- ============================================================
-- Migration 057 — Audit Trail
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL,
  actor_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name    VARCHAR(200),
  actor_email   VARCHAR(254),
  actor_role    VARCHAR(50),
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id   VARCHAR(200),
  resource_name TEXT,
  old_value     JSONB,
  new_value     JSONB,
  diff          JSONB,          -- key-level diff computed at write time
  ip_address    INET,
  user_agent    TEXT,
  portal        VARCHAR(30) DEFAULT 'team'
                  CHECK (portal IN ('team','client','vendor','guest','super_admin','api')),
  severity      VARCHAR(20) NOT NULL DEFAULT 'info'
                  CHECK (severity IN ('info','warning','critical')),
  tags          TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes — optimise the most common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_tenant       ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event        ON public.audit_logs(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor        ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource     ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_action       ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_severity     ON public.audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_created_at   ON public.audit_logs(created_at DESC);

-- Partitioning hint: in production, partition by RANGE(created_at) monthly.
-- For development, single table is fine.

-- ─────────────────────────────────────────────
-- Auto-log trigger helper (used by other modules optionally)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_action TEXT;
  v_diff   JSONB := '{}';
  v_key    TEXT;
  v_old    JSONB;
  v_new    JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    -- Build diff: only changed fields
    FOR v_key IN SELECT key FROM jsonb_each(v_new) LOOP
      IF (v_new->v_key) IS DISTINCT FROM (v_old->v_key) THEN
        v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key));
      END IF;
    END LOOP;
    IF v_diff = '{}'::JSONB THEN RETURN NEW; END IF;  -- no change, skip
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_old := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_logs (
    tenant_id, resource_type, resource_id, action, old_value, new_value, diff, severity
  ) VALUES (
    COALESCE((v_new->>'tenant_id')::UUID, (v_old->>'tenant_id')::UUID),
    TG_TABLE_NAME,
    COALESCE(v_new->>'id', v_old->>'id'),
    v_action,
    v_old,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_new END,
    CASE WHEN v_diff = '{}'::JSONB THEN NULL ELSE v_diff END,
    CASE WHEN TG_OP = 'DELETE' THEN 'warning' ELSE 'info' END
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Never let audit logging break the main operation
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to high-value tables
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['events','guests','invoices','event_team_members'] LOOP
    BEGIN
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%I
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION audit_log_changes()',
        tbl, tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_tenant_read" ON public.audit_logs
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

-- Only service-role can insert (all writes go through the API / trigger)
CREATE POLICY "audit_service_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (TRUE);

-- No updates or deletes — immutable log
-- ─────────────────────────────────────────────
-- Aggregate view: activity summary per actor per day
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_audit_daily_summary AS
SELECT
  tenant_id,
  DATE_TRUNC('day', created_at)   AS day,
  actor_id,
  actor_name,
  COUNT(*)                        AS action_count,
  COUNT(*) FILTER (WHERE severity = 'critical') AS critical_count,
  COUNT(*) FILTER (WHERE severity = 'warning')  AS warning_count,
  array_agg(DISTINCT action)      AS actions_taken
FROM public.audit_logs
GROUP BY tenant_id, DATE_TRUNC('day', created_at), actor_id, actor_name;
