-- ============================================================
-- Migration 014: Vendor Portal & Self-Service Access
-- ============================================================

-- ─── Vendor Portal Tokens ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_portal_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id      UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  contract_id    UUID REFERENCES vendor_contracts(id) ON DELETE CASCADE,
  event_id       UUID REFERENCES events(id) ON DELETE CASCADE,
  access_token   TEXT NOT NULL UNIQUE,
  expires_at     TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  is_active      BOOLEAN DEFAULT true,
  created_by     UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_tokens_token ON vendor_portal_tokens(access_token);
CREATE INDEX IF NOT EXISTS idx_vendor_tokens_vendor ON vendor_portal_tokens(vendor_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_tokens_contract ON vendor_portal_tokens(contract_id);

-- ─── Vendor Deliverables (what vendors submit back to the company) ────────────
CREATE TABLE IF NOT EXISTS vendor_deliverables (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id    UUID NOT NULL REFERENCES vendor_contracts(id) ON DELETE CASCADE,
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id      UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  file_url       TEXT,
  file_name      TEXT,
  deliverable_type TEXT DEFAULT 'document',
  status         TEXT DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','approved','rejected')),
  review_notes   TEXT,
  submitted_at   TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  reviewed_by    UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliverables_contract ON vendor_deliverables(contract_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_event ON vendor_deliverables(event_id, tenant_id);

-- ─── Vendor Portal Messages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id  UUID NOT NULL REFERENCES vendor_contracts(id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id    UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  message      TEXT NOT NULL,
  from_vendor  BOOLEAN DEFAULT false,
  sender_name  TEXT,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_msgs_contract ON vendor_messages(contract_id);
CREATE INDEX IF NOT EXISTS idx_vendor_msgs_event ON vendor_messages(event_id, tenant_id);

-- ─── Enhance vendor_contracts if columns don't exist ─────────────────────────
ALTER TABLE vendor_contracts
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending','partial','paid','overdue')),
  ADD COLUMN IF NOT EXISTS paid_amount     NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes           TEXT,
  ADD COLUMN IF NOT EXISTS portal_token_id UUID;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE vendor_portal_tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_vendor_tokens" ON vendor_portal_tokens
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE vendor_deliverables ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_vendor_deliverables" ON vendor_deliverables
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE vendor_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_vendor_messages" ON vendor_messages
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
