-- ============================================================
-- Migration 050: Vendor Portal — Additional Tables
-- vendor_documents, vendor_messages, vendor_event_briefs,
-- vendor_password_resets, vendor_deliverables completion fields
-- (vendor_accounts, vendor_event_assignments, vendor_invoices,
--  vendor_ratings are already in migration 049)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. VENDOR PASSWORD RESETS (invite / forgot-password tokens)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_password_resets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid NOT NULL REFERENCES vendor_accounts(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  used        boolean NOT NULL DEFAULT false,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_pwd_resets_vendor ON vendor_password_resets(vendor_id, used, expires_at);

-- ─────────────────────────────────────────────────────────────
-- 2. VENDOR DOCUMENTS (uploaded by vendor or tenant)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES vendor_event_assignments(id) ON DELETE CASCADE,
  name            text NOT NULL,
  file_url        text NOT NULL,
  doc_type        text NOT NULL DEFAULT 'general'
                  CHECK (doc_type IN ('contract','sow','insurance','compliance','invoice','general','other')),
  size_bytes      bigint,
  uploaded_by     text NOT NULL DEFAULT 'vendor' CHECK (uploaded_by IN ('vendor','tenant')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_docs_assignment ON vendor_documents(assignment_id);

-- ─────────────────────────────────────────────────────────────
-- 3. VENDOR MESSAGES (thread per assignment)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES vendor_event_assignments(id) ON DELETE CASCADE,
  sender_type     text NOT NULL CHECK (sender_type IN ('vendor','tenant')),
  sender_id       uuid NOT NULL,   -- vendor_accounts.id or users.id
  message         text NOT NULL CHECK (length(message) <= 2000),
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_msgs_assignment ON vendor_messages(assignment_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- 4. VENDOR EVENT BRIEF (per-event operational briefing)
-- Shared across all vendor assignments for an event
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_event_briefs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Logistics
  setup_time      text,
  teardown_time   text,
  reporting_contact_name  text,
  reporting_contact_phone text,
  venue_address   text,
  parking_info    text,
  load_in_details text,

  -- Day-of schedule (jsonb array of {time, activity, notes})
  schedule        jsonb DEFAULT '[]',

  -- Emergency
  emergency_contact_name  text,
  emergency_contact_phone text,
  emergency_procedures    text,

  -- General notes
  notes           text,

  -- Attire / dress code
  dress_code      text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_briefs_event ON vendor_event_briefs(event_id);

-- ─────────────────────────────────────────────────────────────
-- 5. EXTEND vendor_deliverables with completion fields
-- (base table created in migration 049)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE vendor_deliverables
  ADD COLUMN IF NOT EXISTS completed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS completion_notes  text,
  ADD COLUMN IF NOT EXISTS file_url          text;  -- proof of delivery

-- ─────────────────────────────────────────────────────────────
-- 6. EXTEND vendor_invoices with review + payment fields
-- ─────────────────────────────────────────────────────────────

ALTER TABLE vendor_invoices
  ADD COLUMN IF NOT EXISTS invoice_number    text,
  ADD COLUMN IF NOT EXISTS invoice_date      date,
  ADD COLUMN IF NOT EXISTS due_date          date,
  ADD COLUMN IF NOT EXISTS file_url          text,
  ADD COLUMN IF NOT EXISTS line_items        jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS review_notes      text,
  ADD COLUMN IF NOT EXISTS reviewed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at       timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at           timestamptz;

-- ─────────────────────────────────────────────────────────────
-- 7. EXTEND vendor_accounts with missing fields
-- ─────────────────────────────────────────────────────────────

ALTER TABLE vendor_accounts
  ADD COLUMN IF NOT EXISTS contact_name      text,
  ADD COLUMN IF NOT EXISTS phone             text,
  ADD COLUMN IF NOT EXISTS category          text,
  ADD COLUMN IF NOT EXISTS website           text,
  ADD COLUMN IF NOT EXISTS description       text,
  ADD COLUMN IF NOT EXISTS gstin             text,
  ADD COLUMN IF NOT EXISTS address           text,
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'active'
                           CHECK (status IN ('invited','active','suspended')),
  ADD COLUMN IF NOT EXISTS last_login        timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

-- ─────────────────────────────────────────────────────────────
-- 8. EXTEND vendor_event_assignments with missing fields
-- ─────────────────────────────────────────────────────────────

ALTER TABLE vendor_event_assignments
  ADD COLUMN IF NOT EXISTS services_description text,
  ADD COLUMN IF NOT EXISTS contract_amount       numeric(12,2),
  ADD COLUMN IF NOT EXISTS contract_url          text,
  ADD COLUMN IF NOT EXISTS last_accessed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS status                text NOT NULL DEFAULT 'invited'
                           CHECK (status IN ('invited','confirmed','active','completed','cancelled'));

-- ─────────────────────────────────────────────────────────────
-- 9. RLS POLICIES
-- ─────────────────────────────────────────────────────────────

ALTER TABLE vendor_password_resets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_event_briefs     ENABLE ROW LEVEL SECURITY;

-- Password resets: only service role
CREATE POLICY "vendor_pwd_service_only" ON vendor_password_resets USING (false);
CREATE POLICY "vendor_pwd_insert_public" ON vendor_password_resets FOR INSERT WITH CHECK (true);

-- Documents: tenant staff can manage; vendor access via service role (RLS bypassed by API)
CREATE POLICY "tenant_manage_vendor_docs" ON vendor_documents
  USING (
    assignment_id IN (
      SELECT id FROM vendor_event_assignments
      WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

-- Messages: tenant staff can manage
CREATE POLICY "tenant_manage_vendor_messages" ON vendor_messages
  USING (
    assignment_id IN (
      SELECT id FROM vendor_event_assignments
      WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

-- Event briefs: tenant staff can manage
CREATE POLICY "tenant_manage_briefs" ON vendor_event_briefs
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 10. PERFORMANCE INDEXES
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vendor_assignments_vendor ON vendor_event_assignments(vendor_account_id);
CREATE INDEX IF NOT EXISTS idx_vendor_assignments_event  ON vendor_event_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_vendor_deliverables_assign ON vendor_deliverables(assignment_id, status);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_assign    ON vendor_invoices(assignment_id, status);
