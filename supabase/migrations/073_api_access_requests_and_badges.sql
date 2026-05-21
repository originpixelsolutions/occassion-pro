-- ============================================================
-- Migration 073 — API Access Requests + Badge Templates
-- ============================================================
-- NOTE: Core external-API tables (api_keys, api_webhooks,
--       webhook_deliveries, api_usage_logs, api_scopes) were
--       created in migration 059.  This migration adds:
--   1. api_access_requests — tenant-level API-tier requests
--      awaiting Super Admin approval before keys can be created
--   2. badge_template JSONB column on events (for print badges)
--   3. 90-day retention index on api_usage_logs
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. API Access Requests
--    Tenants on free/starter plans submit a request to unlock
--    the external API.  Super Admin approves/rejects.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_access_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_requested    VARCHAR(30) NOT NULL DEFAULT 'agency'
                      CHECK (plan_requested IN ('agency','enterprise','custom')),
  use_case          TEXT NOT NULL,                  -- What will they use the API for?
  expected_rps      INT,                            -- Expected requests per second
  requested_scopes  TEXT[] NOT NULL DEFAULT '{}',  -- Scopes they need
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  -- Auto-provisioning on approval
  auto_provision    BOOLEAN NOT NULL DEFAULT TRUE,  -- Create first key automatically
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate pending requests per tenant
  CONSTRAINT api_access_requests_one_pending_per_tenant
    EXCLUDE USING btree (tenant_id WITH =)
    WHERE (status = 'pending')
);

CREATE INDEX IF NOT EXISTS idx_api_access_requests_tenant
  ON public.api_access_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_access_requests_status
  ON public.api_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_api_access_requests_created
  ON public.api_access_requests(created_at DESC);

-- Updated-at trigger (reuse function from migration 059)
DROP TRIGGER IF EXISTS trg_api_access_requests_updated_at ON public.api_access_requests;
CREATE TRIGGER trg_api_access_requests_updated_at
  BEFORE UPDATE ON public.api_access_requests
  FOR EACH ROW EXECUTE FUNCTION update_api_updated_at();

-- RLS
ALTER TABLE public.api_access_requests ENABLE ROW LEVEL SECURITY;

-- Tenant users can see and manage their own requests
CREATE POLICY "api_access_requests_tenant_isolation"
  ON public.api_access_requests
  USING (tenant_id = (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  ));

-- ─────────────────────────────────────────────
-- 2. Badge Template Column on events
-- ─────────────────────────────────────────────
-- Stores the tenant's per-event badge design choices.
-- Shape (all fields optional, resolved to defaults in service):
-- {
--   layout        : "6up" | "8up" | "avery5160"
--   paper_size    : "A4" | "Letter"
--   orientation   : "landscape" | "portrait"
--   show_fields   : ["guest_name","category","table","company","qr_code","event_name","logo"]
--   primary_color : "#7c3aed"
--   secondary_color: "#f5f3ff"
--   text_color    : "#1a1a2e"
--   font_family   : "Helvetica" | "Times-Roman" | "Courier"
--   logo_url      : "https://..."
--   background_url: "https://..."
--   qr_size       : 60        -- px
--   badge_width_mm : 85
--   badge_height_mm: 55
--   corner_radius  : 6
--   updated_at    : "ISO string"
-- }
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS badge_template JSONB;

COMMENT ON COLUMN public.events.badge_template IS
  'Per-event badge print template config (layout, colours, visible fields). See migration 073.';

-- GIN index so we can filter events that have a template configured
CREATE INDEX IF NOT EXISTS idx_events_badge_template
  ON public.events USING GIN (badge_template)
  WHERE badge_template IS NOT NULL;

-- ─────────────────────────────────────────────
-- 3. 90-day Retention Index on api_usage_logs
--    Facilitates efficient purge of old rows by a scheduled job
-- ─────────────────────────────────────────────
-- Composite index covering tenant + date range queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_api_usage_tenant_requested
  ON public.api_usage_logs(tenant_id, requested_at DESC);

-- Retention-purge helper: partial index on old rows so a pg_cron job can
-- DELETE FROM api_usage_logs WHERE requested_at < NOW() - INTERVAL '90 days'
-- efficiently without a seq scan.
CREATE INDEX IF NOT EXISTS idx_api_usage_old_rows
  ON public.api_usage_logs(requested_at)
  WHERE requested_at < NOW() - INTERVAL '90 days';

-- ─────────────────────────────────────────────
-- 4. Additional api_scopes seed rows (rsvp + print)
--    Extend the seed from migration 059 with scopes used by
--    post-event and badge modules.
-- ─────────────────────────────────────────────
INSERT INTO public.api_scopes (scope, category, description, is_sensitive)
VALUES
  ('rsvp:write',       'Guests',    'Submit RSVP responses via API',       FALSE),
  ('checkin:write',    'Guests',    'Mark guest attendance via API',        FALSE),
  ('post_event:read',  'Post-Event','Read post-event reports and surveys', FALSE),
  ('badges:generate',  'Guests',    'Trigger badge PDF generation',         FALSE)
ON CONFLICT (scope) DO NOTHING;
