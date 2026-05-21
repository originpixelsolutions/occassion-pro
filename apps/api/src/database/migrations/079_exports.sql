-- ============================================================
-- Migration 079: Branded Exports & Full Event ZIP
-- ============================================================

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE export_type_enum AS ENUM (
    'guest_list',
    'seating_chart',
    'runsheet',
    'badges',
    'attendance',
    'budget_report',
    'vendor_report',
    'fnb_report',
    'payment_report',
    'full_event_zip',
    'custom_report'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE export_format_enum AS ENUM ('pdf', 'xlsx', 'csv', 'zip');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE export_status_enum AS ENUM ('queued', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS export_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id         UUID REFERENCES events(id) ON DELETE SET NULL,
  export_type      export_type_enum NOT NULL,
  format           export_format_enum NOT NULL,
  status           export_status_enum NOT NULL DEFAULT 'queued',
  file_url         TEXT,
  file_size_bytes  BIGINT,
  error_message    TEXT,
  requested_by     UUID NOT NULL,
  options          JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tenant_brand_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  primary_color       VARCHAR(7)  NOT NULL DEFAULT '#6366F1',
  secondary_color     VARCHAR(7)  NOT NULL DEFAULT '#8B5CF6',
  logo_url            TEXT,
  company_name        TEXT,
  footer_text         TEXT NOT NULL DEFAULT 'Powered by OccasionPro',
  font_family         TEXT NOT NULL DEFAULT 'Inter',
  report_header_html  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_export_jobs_tenant_id    ON export_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_event_id     ON export_jobs(event_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status       ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created_at   ON export_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_tenant_event ON export_jobs(tenant_id, event_id, created_at DESC);

-- ─── Triggers ─────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tenant_brand_settings'] LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ─── Seed default brand for existing tenants ──────────────────────────────────

INSERT INTO tenant_brand_settings (tenant_id)
SELECT id FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM tenant_brand_settings)
ON CONFLICT (tenant_id) DO NOTHING;
