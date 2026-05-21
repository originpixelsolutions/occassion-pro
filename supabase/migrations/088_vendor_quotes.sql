-- ============================================================
-- Migration 088: Vendor Quotes
-- Allows vendors to submit price quotes against their
-- event assignments. Staff can review and approve/reject.
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_quotes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id       uuid NOT NULL REFERENCES vendor_event_assignments(id) ON DELETE CASCADE,
  vendor_id           uuid NOT NULL REFERENCES vendor_accounts(id) ON DELETE CASCADE,

  -- Quote details
  service_description text NOT NULL CHECK (length(service_description) > 0),
  amount              numeric(14,2) NOT NULL CHECK (amount > 0),
  currency_code       text NOT NULL DEFAULT 'INR',
  notes               text,
  file_url            text,           -- attached quote document

  -- Lifecycle
  status              text NOT NULL DEFAULT 'submitted'
                      CHECK (status IN ('submitted','under_review','approved','rejected','withdrawn')),

  -- Staff review
  review_note         text,
  reviewed_by         uuid REFERENCES profiles(id),
  reviewed_at         timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_quotes_assignment ON vendor_quotes(assignment_id);
CREATE INDEX IF NOT EXISTS idx_vendor_quotes_vendor     ON vendor_quotes(vendor_id, status);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE vendor_quotes ENABLE ROW LEVEL SECURITY;

-- Vendor portal API uses service-role key — no RLS needed for vendor reads/writes.
-- Tenant staff (JWT auth) can manage quotes for their own assignments.
CREATE POLICY "tenant_manage_vendor_quotes" ON vendor_quotes
  USING (
    assignment_id IN (
      SELECT id FROM vendor_event_assignments
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_vendor_quotes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_quotes_updated_at ON vendor_quotes;
CREATE TRIGGER trg_vendor_quotes_updated_at
  BEFORE UPDATE ON vendor_quotes
  FOR EACH ROW EXECUTE FUNCTION set_vendor_quotes_updated_at();
