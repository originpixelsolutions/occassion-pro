-- ============================================================
-- Migration 038: Legal & Permits Management
-- event_permits, permit_reminders, legal_documents
-- ============================================================

CREATE TABLE IF NOT EXISTS event_permits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Permit identity
  permit_name       TEXT NOT NULL,
  permit_type       TEXT NOT NULL DEFAULT 'other'
                    CHECK (permit_type IN (
                      'noise_permit','fire_safety','police_permission','food_license',
                      'liquor_license','temporary_structure','road_closure',
                      'drone_permit','pyrotechnics','signage','health_safety',
                      'copyright_music','venue_usage','insurance_certificate','other'
                    )),
  permit_number     TEXT,                               -- official reference number
  issuing_authority TEXT,                               -- e.g. "Municipal Corporation"
  jurisdiction      TEXT,                               -- city / state / country
  -- Dates
  applied_date      DATE,
  issued_date       DATE,
  expiry_date       DATE,
  -- Status
  status            TEXT NOT NULL DEFAULT 'not_started'
                    CHECK (status IN (
                      'not_started','applied','under_review','approved',
                      'rejected','expired','renewal_required','not_required'
                    )),
  rejection_reason  TEXT,
  -- Document storage (PDF only → R2; external links allowed)
  storage_type      TEXT NOT NULL DEFAULT 'link'
                    CHECK (storage_type IN ('upload','link')),
  document_url      TEXT,                               -- R2 URL or external URL
  file_name         TEXT,
  file_size         BIGINT,
  -- Smart / intelligence fields
  auto_reminder_days INT[] NOT NULL DEFAULT '{60,30,14,7,1}', -- days before expiry
  is_critical       BOOLEAN NOT NULL DEFAULT FALSE,     -- blocks event if missing
  cost              NUMERIC(12,2),
  currency          TEXT NOT NULL DEFAULT 'INR',
  -- Metadata
  notes             TEXT,
  assigned_to       UUID REFERENCES profiles(id),
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_permits_event    ON event_permits(event_id);
CREATE INDEX IF NOT EXISTS idx_event_permits_tenant   ON event_permits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_permits_status   ON event_permits(status);
CREATE INDEX IF NOT EXISTS idx_event_permits_expiry   ON event_permits(expiry_date);
CREATE INDEX IF NOT EXISTS idx_event_permits_type     ON event_permits(permit_type);

-- ── Permit reminder log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permit_reminder_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id   UUID NOT NULL REFERENCES event_permits(id) ON DELETE CASCADE,
  days_before INT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_to     UUID REFERENCES profiles(id),
  channel     TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','whatsapp'))
);

CREATE INDEX IF NOT EXISTS idx_permit_reminder_log_permit ON permit_reminder_log(permit_id);

-- ── Legal documents (contracts, NDAs, agreements) ────────────────────────────
-- Note: general event documents are in event_documents (migration 037).
-- This table is specifically for legally-binding agreements requiring signatures.
CREATE TABLE IF NOT EXISTS event_legal_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL DEFAULT 'contract'
                  CHECK (doc_type IN (
                    'contract','nda','mou','vendor_agreement',
                    'client_agreement','insurance_policy','indemnity','other'
                  )),
  doc_name        TEXT NOT NULL,
  parties         TEXT[],                               -- ["Client: ABC Corp", "Company: XYZ Events"]
  -- Storage
  storage_type    TEXT NOT NULL DEFAULT 'link'
                  CHECK (storage_type IN ('upload','link')),
  document_url    TEXT,
  file_name       TEXT,
  file_size       BIGINT,
  -- Signature tracking
  signature_status TEXT NOT NULL DEFAULT 'pending'
                  CHECK (signature_status IN ('pending','partially_signed','fully_signed','voided')),
  signed_date     DATE,
  expiry_date     DATE,
  -- Smart fields
  is_critical     BOOLEAN NOT NULL DEFAULT FALSE,
  auto_reminder_days INT[] NOT NULL DEFAULT '{30,7}',
  -- Metadata
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_legal_docs_event  ON event_legal_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_event_legal_docs_tenant ON event_legal_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_legal_docs_status ON event_legal_documents(signature_status);
CREATE INDEX IF NOT EXISTS idx_event_legal_docs_expiry ON event_legal_documents(expiry_date);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE event_permits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_reminder_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_event_permits"
  ON event_permits USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY "tenant_isolation_permit_reminder_log"
  ON permit_reminder_log USING (
    permit_id IN (
      SELECT id FROM event_permits WHERE tenant_id = current_setting('app.tenant_id')::uuid
    )
  );

CREATE POLICY "tenant_isolation_event_legal_documents"
  ON event_legal_documents USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ── Updated_at triggers ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_event_permits_updated_at ON event_permits;
CREATE TRIGGER set_event_permits_updated_at
  BEFORE UPDATE ON event_permits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_event_legal_docs_updated_at ON event_legal_documents;
CREATE TRIGGER set_event_legal_docs_updated_at
  BEFORE UPDATE ON event_legal_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
