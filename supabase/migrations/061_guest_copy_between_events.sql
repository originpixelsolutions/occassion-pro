-- ============================================================
-- Migration 061 — Guest Copy Between Events
-- ============================================================

-- ─────────────────────────────────────────────
-- Copy Jobs — audit trail for each copy operation
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_copy_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  target_event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requested_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Strategy for handling duplicates (matched by email or phone)
  duplicate_strategy    VARCHAR(20) NOT NULL DEFAULT 'skip'
                          CHECK (duplicate_strategy IN ('skip', 'overwrite', 'add_anyway')),

  -- Fields to copy (JSON array of column names, NULL = all)
  fields_to_copy        JSONB,

  -- Outcome counters
  total_guests          INT NOT NULL DEFAULT 0,
  copied_count          INT NOT NULL DEFAULT 0,
  skipped_count         INT NOT NULL DEFAULT 0,
  overwritten_count     INT NOT NULL DEFAULT 0,

  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message         TEXT,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_copy_jobs_tenant     ON public.guest_copy_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guest_copy_jobs_target     ON public.guest_copy_jobs(target_event_id);
CREATE INDEX IF NOT EXISTS idx_guest_copy_jobs_source     ON public.guest_copy_jobs(source_event_id);

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE public.guest_copy_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_copy_jobs_tenant_isolation" ON public.guest_copy_jobs
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- Add copied_from_event_id column to guests (nullable — set when guest is a copy)
-- ─────────────────────────────────────────────
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS copied_from_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS copy_job_id           UUID REFERENCES public.guest_copy_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guests_copied_from ON public.guests(copied_from_event_id) WHERE copied_from_event_id IS NOT NULL;
