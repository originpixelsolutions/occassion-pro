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
