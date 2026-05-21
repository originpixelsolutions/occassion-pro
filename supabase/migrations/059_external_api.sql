-- ============================================================
-- Migration 059 — External Tenant API (API Keys + Webhooks)
-- ============================================================

-- ─────────────────────────────────────────────
-- API Keys
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name             VARCHAR(150) NOT NULL,
  key_prefix       VARCHAR(10) NOT NULL,          -- e.g. "op_live_" shown in UI
  key_hash         VARCHAR(64) NOT NULL UNIQUE,    -- SHA-256 of the raw key
  key_hint         VARCHAR(10) NOT NULL,           -- last 4 chars shown in UI
  scopes           TEXT[] NOT NULL DEFAULT '{}',  -- ['events:read','guests:write',…]
  environment      VARCHAR(10) NOT NULL DEFAULT 'live'
                     CHECK (environment IN ('live','test')),
  status           VARCHAR(20) NOT NULL DEFAULT 'pending_approval'
                     CHECK (status IN ('pending_approval','active','suspended','revoked')),
  approval_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  rate_limit_rpm   INT NOT NULL DEFAULT 60,        -- requests per minute
  rate_limit_daily INT NOT NULL DEFAULT 10000,     -- requests per day
  allowed_ips      INET[],                         -- NULL = any IP allowed
  description      TEXT,
  last_used_at     TIMESTAMPTZ,
  usage_count      BIGINT NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,                    -- NULL = never
  created_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant  ON public.api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash    ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_status  ON public.api_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix  ON public.api_keys(key_prefix);

-- ─────────────────────────────────────────────
-- API Usage Logs (time-series, partition-ready)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id           BIGSERIAL PRIMARY KEY,
  api_key_id   UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL,
  endpoint     VARCHAR(200) NOT NULL,
  method       VARCHAR(10) NOT NULL,
  status_code  SMALLINT NOT NULL,
  response_ms  INT,
  ip_address   INET,
  user_agent   TEXT,
  error_code   VARCHAR(50),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_key       ON public.api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_tenant    ON public.api_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_requested ON public.api_usage_logs(requested_at DESC);

-- ─────────────────────────────────────────────
-- Webhook Endpoints
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            VARCHAR(150) NOT NULL,
  url             TEXT NOT NULL,
  secret          VARCHAR(100) NOT NULL,           -- HMAC signing secret (stored hashed)
  events          TEXT[] NOT NULL DEFAULT '{}',   -- ['event.created','guest.updated',…]
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','disabled')),
  ssl_verify      BOOLEAN NOT NULL DEFAULT TRUE,
  timeout_seconds INT NOT NULL DEFAULT 10,
  retry_count     INT NOT NULL DEFAULT 3,
  last_triggered_at TIMESTAMPTZ,
  last_success_at   TIMESTAMPTZ,
  last_failure_at   TIMESTAMPTZ,
  failure_count     INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON public.api_webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON public.api_webhooks(status);

-- ─────────────────────────────────────────────
-- Webhook Delivery Logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      UUID NOT NULL REFERENCES public.api_webhooks(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  event_type      VARCHAR(100) NOT NULL,
  payload         JSONB NOT NULL,
  attempt         SMALLINT NOT NULL DEFAULT 1,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','success','failed','skipped')),
  response_code   SMALLINT,
  response_body   TEXT,
  response_ms     INT,
  error_message   TEXT,
  next_retry_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_webhook   ON public.webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_tenant    ON public.webhook_deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status    ON public.webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivered ON public.webhook_deliveries(delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_retry     ON public.webhook_deliveries(next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- ─────────────────────────────────────────────
-- Available scopes (reference table)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_scopes (
  scope       VARCHAR(100) PRIMARY KEY,
  category    VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO public.api_scopes (scope, category, description, is_sensitive) VALUES
  ('events:read',     'Events',   'Read event data',                  FALSE),
  ('events:write',    'Events',   'Create and update events',         FALSE),
  ('events:delete',   'Events',   'Delete events',                    TRUE),
  ('guests:read',     'Guests',   'Read guest list and RSVP data',    FALSE),
  ('guests:write',    'Guests',   'Create and update guests',         FALSE),
  ('guests:delete',   'Guests',   'Delete guests',                    TRUE),
  ('vendors:read',    'Vendors',  'Read vendor assignments',          FALSE),
  ('vendors:write',   'Vendors',  'Assign and update vendors',        FALSE),
  ('finance:read',    'Finance',  'Read invoices and payments',       TRUE),
  ('finance:write',   'Finance',  'Create invoices',                  TRUE),
  ('team:read',       'Team',     'Read team members',                FALSE),
  ('team:write',      'Team',     'Manage team assignments',          TRUE),
  ('analytics:read',  'Analytics','Read analytics and reports',       FALSE),
  ('ai:invoke',       'AI',       'Trigger AI features',              FALSE),
  ('webhooks:manage', 'Webhooks', 'Manage webhook endpoints',         TRUE),
  ('admin:read',      'Admin',    'Read tenant configuration',        TRUE),
  ('admin:write',     'Admin',    'Modify tenant configuration',      TRUE)
ON CONFLICT (scope) DO NOTHING;

-- ─────────────────────────────────────────────
-- Updated-at triggers
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_api_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['api_keys','api_webhooks'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION update_api_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE public.api_keys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_webhooks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- API keys
CREATE POLICY "api_keys_tenant_isolation" ON public.api_keys
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Usage logs (read-only for tenant)
CREATE POLICY "api_usage_tenant_isolation" ON public.api_usage_logs
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Webhooks
CREATE POLICY "webhooks_tenant_isolation" ON public.api_webhooks
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Deliveries
CREATE POLICY "deliveries_tenant_isolation" ON public.webhook_deliveries
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- Daily usage summary view
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_api_key_daily_usage AS
SELECT
  k.id          AS api_key_id,
  k.tenant_id,
  k.name        AS key_name,
  k.key_prefix,
  k.key_hint,
  k.rate_limit_daily,
  DATE(l.requested_at)            AS usage_date,
  COUNT(*)                        AS request_count,
  COUNT(*) FILTER (WHERE l.status_code >= 400) AS error_count,
  ROUND(AVG(l.response_ms))       AS avg_response_ms
FROM public.api_keys k
LEFT JOIN public.api_usage_logs l
  ON l.api_key_id = k.id
  AND l.requested_at >= NOW() - INTERVAL '30 days'
GROUP BY k.id, k.tenant_id, k.name, k.key_prefix, k.key_hint, k.rate_limit_daily, DATE(l.requested_at);

