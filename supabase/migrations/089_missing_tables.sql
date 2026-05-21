-- ============================================================
-- Migration 089: Missing tables referenced by application code
-- Adds: used_webhook_nonces, tenant_onboarding, event_media
-- Adds view: fnb_token_summary
-- ============================================================

-- ── Webhook replay-protection nonces ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS used_webhook_nonces (
  id         bigserial PRIMARY KEY,
  nonce      text        NOT NULL UNIQUE,
  source     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_nonces_nonce      ON used_webhook_nonces(nonce);
CREATE INDEX IF NOT EXISTS idx_webhook_nonces_created_at ON used_webhook_nonces(created_at);

-- Auto-purge nonces older than 24 hours (keeps the table small)
-- Requires pg_cron extension (enabled by default on Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-webhook-nonces',
      '0 * * * *',            -- every hour
      $$DELETE FROM used_webhook_nonces WHERE created_at < now() - interval '24 hours'$$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not available; nonces will be purged by application logic
  NULL;
END $$;

-- RLS: service-role only (webhook security service uses serviceClient)
ALTER TABLE used_webhook_nonces ENABLE ROW LEVEL SECURITY;
-- No tenant-scoped policy; only server-side code accesses this table via service key

-- ── Tenant onboarding progress ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_onboarding (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  step        text        NOT NULL,
  completed   boolean     NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, step)
);

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_tenant ON tenant_onboarding(tenant_id);

ALTER TABLE tenant_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_own_onboarding" ON tenant_onboarding
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── Event media (photo/video gallery for guest portal) ───────────────────────
CREATE TABLE IF NOT EXISTS event_media (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  url           text        NOT NULL,
  thumbnail_url text,
  type          text        NOT NULL DEFAULT 'photo' CHECK (type IN ('photo', 'video', 'reel')),
  caption       text,
  taken_at      timestamptz,
  is_public     boolean     NOT NULL DEFAULT true,
  uploaded_by   uuid        REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_media_event   ON event_media(event_id, is_public);
CREATE INDEX IF NOT EXISTS idx_event_media_tenant  ON event_media(tenant_id);

ALTER TABLE event_media ENABLE ROW LEVEL SECURITY;

-- Staff can manage; public portal reads only public items (guest portal uses service key)
CREATE POLICY "tenant_manage_event_media" ON event_media
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── F&B token summary view ───────────────────────────────────────────────────
-- Aggregated totals per event, used by the export PDF report
CREATE OR REPLACE VIEW fnb_token_summary AS
SELECT
  b.event_id,
  b.tenant_id,
  SUM(b.quantity)         AS total_issued,
  SUM(b.tokens_redeemed)  AS total_redeemed,
  SUM(b.quantity * mi.price) AS total_revenue
FROM fnb_token_batches b
LEFT JOIN fnb_menu_items mi ON mi.id = b.menu_item_id
GROUP BY b.event_id, b.tenant_id;
