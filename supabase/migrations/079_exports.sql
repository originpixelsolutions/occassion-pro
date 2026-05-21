-- ============================================================
-- OccasionPro — Migration 079: Export Jobs
--
-- Async export job queue for PDF, XLSX, CSV, and ZIP report
-- generation.  The NestJS ExportsService enqueues a job,
-- processes it asynchronously, uploads the result to R2, and
-- writes the public URL back to this table.
--
-- Referenced by: exports.service.ts
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE export_job_status AS ENUM ('queued','processing','completed','failed');
  CREATE TYPE export_format_type AS ENUM ('pdf','xlsx','csv','zip');
  CREATE TYPE export_type_enum AS ENUM (
    'guest_list','seating_chart','runsheet','badges','attendance',
    'budget_report','vendor_report','fnb_report','payment_report',
    'full_event_zip','custom_report'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── export_jobs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS export_jobs (
  id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid               NOT NULL,
  event_id         uuid               REFERENCES events(id) ON DELETE CASCADE,
  export_type      export_type_enum   NOT NULL,
  format           export_format_type NOT NULL DEFAULT 'pdf',
  status           export_job_status  NOT NULL DEFAULT 'queued',
  options          jsonb              NOT NULL DEFAULT '{}'::jsonb,
  file_url         text,
  file_size_bytes  bigint,
  error_message    text,
  requested_by     uuid               REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz        NOT NULL DEFAULT now(),
  completed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_tenant
  ON export_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_event
  ON export_jobs(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_export_jobs_status
  ON export_jobs(status) WHERE status IN ('queued', 'processing');

-- ── tenant_brand_settings ──────────────────────────────────────────────────────
-- Stores per-tenant report branding: colors, logo, footer text.
-- Used by ExportsService.getBrand() to apply custom branding to all exports.
CREATE TABLE IF NOT EXISTS tenant_brand_settings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  company_name        text,
  primary_color       text        NOT NULL DEFAULT '#6366F1',
  secondary_color     text        NOT NULL DEFAULT '#8B5CF6',
  logo_url            text,
  footer_text         text        NOT NULL DEFAULT 'Powered by OccasionPro',
  font_family         text        NOT NULL DEFAULT 'Inter',
  report_header_html  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_brand_settings_tenant_unique UNIQUE (tenant_id)
);

-- ── updated_at trigger ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_brand_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_brand_settings_updated_at ON tenant_brand_settings;
CREATE TRIGGER trg_tenant_brand_settings_updated_at
  BEFORE UPDATE ON tenant_brand_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_brand_settings();

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE export_jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_brand_settings  ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['export_jobs','tenant_brand_settings'] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_tenant" ON %1$s FOR ALL
        USING      (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()))
        WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));
      CREATE POLICY "%1$s_service" ON %1$s FOR ALL USING (auth.role() = 'service_role');
    $f$, t);
  END LOOP;
END $$;
