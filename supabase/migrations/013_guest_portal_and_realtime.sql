-- ============================================================
-- Migration 013: Guest Portal, Client Collaboration & Realtime
-- ============================================================

-- ─── Client Portals ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_portals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  portal_slug       TEXT NOT NULL UNIQUE,
  client_name       TEXT NOT NULL,
  client_email      TEXT NOT NULL,
  client_phone      TEXT,
  access_code       TEXT NOT NULL,
  access_expires_at TIMESTAMPTZ,
  allowed_sections  TEXT[] DEFAULT ARRAY['timeline','documents','messages','rsvp'],
  is_active         BOOLEAN DEFAULT true,
  last_accessed_at  TIMESTAMPTZ,
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_portals_tenant ON client_portals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_portals_event ON client_portals(event_id);
CREATE INDEX IF NOT EXISTS idx_client_portals_slug ON client_portals(portal_slug);

-- ─── Event Milestones ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_milestones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    TIMESTAMPTZ NOT NULL,
  status      TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','in_progress','completed','overdue')),
  sort_order  INTEGER DEFAULT 0,
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_event ON event_milestones(event_id, tenant_id);

-- ─── Client RSVPs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_rsvps (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id            UUID NOT NULL REFERENCES client_portals(id) ON DELETE CASCADE,
  event_id             UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_name          TEXT NOT NULL,
  client_email         TEXT NOT NULL,
  status               TEXT NOT NULL CHECK (status IN ('pending','confirmed','declined','maybe','waitlisted')),
  plus_ones            INTEGER DEFAULT 0,
  dietary_requirements TEXT,
  message              TEXT,
  responded_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (portal_id)   -- one RSVP per portal
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event ON client_rsvps(event_id, tenant_id);

-- ─── Portal Approvals ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_approvals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id    UUID NOT NULL REFERENCES client_portals(id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id      TEXT NOT NULL,
  item_type    TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','revision_requested')),
  notes        TEXT,
  client_name  TEXT,
  client_email TEXT,
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (portal_id, item_id, item_type)
);

CREATE INDEX IF NOT EXISTS idx_approvals_event ON portal_approvals(event_id, tenant_id);

-- ─── Portal Documents ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_documents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id             UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  document_name        TEXT NOT NULL,
  document_type        TEXT NOT NULL DEFAULT 'other',
  file_url             TEXT NOT NULL,
  description          TEXT,
  requires_approval    BOOLEAN DEFAULT false,
  is_visible_to_client BOOLEAN DEFAULT true,
  uploaded_by          UUID,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_docs_event ON portal_documents(event_id, tenant_id);

-- ─── Portal Messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id       UUID NOT NULL REFERENCES client_portals(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message         TEXT NOT NULL,
  attachment_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  from_client     BOOLEAN DEFAULT false,
  sender_name     TEXT,
  sender_email    TEXT,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_msgs_portal ON portal_messages(portal_id);
CREATE INDEX IF NOT EXISTS idx_portal_msgs_event ON portal_messages(event_id, tenant_id);

-- ─── Enhance existing guests table with portal fields ────────────────────────
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS check_in_status TEXT DEFAULT 'pending'
    CHECK (check_in_status IN ('pending','checked_in','no_show')),
  ADD COLUMN IF NOT EXISTS checked_in_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_by   UUID,
  ADD COLUMN IF NOT EXISTS is_vip          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS plus_ones       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_preference TEXT,
  ADD COLUMN IF NOT EXISTS category        TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS imported_by     UUID;

-- ─── Finance tables (if not already created by module stubs) ─────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID REFERENCES events(id) ON DELETE SET NULL,
  client_id         UUID,
  invoice_number    TEXT NOT NULL UNIQUE,
  client_name       TEXT NOT NULL,
  client_email      TEXT NOT NULL,
  client_phone      TEXT,
  client_address    TEXT,
  line_items        JSONB NOT NULL DEFAULT '[]',
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(12,2) DEFAULT 0,
  tax_amount        NUMERIC(12,2) DEFAULT 0,
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount       NUMERIC(12,2) DEFAULT 0,
  due_date          TIMESTAMPTZ,
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','partially_paid','paid','overdue','cancelled')),
  notes             TEXT,
  terms             TEXT,
  payment_milestones JSONB DEFAULT '[]',
  sent_at           TIMESTAMPTZ,
  razorpay_order_id TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_event ON invoices(event_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(tenant_id, status);

CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id     UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  event_id       UUID REFERENCES events(id) ON DELETE SET NULL,
  amount         NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  transaction_id TEXT,
  status         TEXT DEFAULT 'captured' CHECK (status IN ('pending','processing','captured','failed','refunded','partially_refunded')),
  notes          TEXT,
  recorded_by    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);

CREATE TABLE IF NOT EXISTS expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id     UUID REFERENCES events(id) ON DELETE SET NULL,
  category     TEXT NOT NULL,
  description  TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  date         TIMESTAMPTZ DEFAULT NOW(),
  vendor_id    UUID,
  receipt_url  TEXT,
  is_approved  BOOLEAN DEFAULT false,
  approved_by  UUID,
  approved_at  TIMESTAMPTZ,
  notes        TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_event ON expenses(event_id, tenant_id);

CREATE TABLE IF NOT EXISTS event_budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  total_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  allocations  JSONB DEFAULT '[]',
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budgets_event ON event_budgets(event_id, tenant_id);

-- ─── CRM Leads (enhanced) ────────────────────────────────────────────────────
-- leads table already exists from 004_crm_and_clients.sql — add any missing columns
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS contact_name     TEXT,
  ADD COLUMN IF NOT EXISTS contact_email    TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone    TEXT,
  ADD COLUMN IF NOT EXISTS company_name     TEXT,
  ADD COLUMN IF NOT EXISTS event_type       TEXT,
  ADD COLUMN IF NOT EXISTS estimated_guests INTEGER,
  ADD COLUMN IF NOT EXISTS budget           NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS score            INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_to      UUID,
  ADD COLUMN IF NOT EXISTS event_id         UUID,
  ADD COLUMN IF NOT EXISTS follow_up_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_tenant   ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status   ON leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);

CREATE TABLE IF NOT EXISTS lead_activities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  notes        TEXT,
  outcome      TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT false,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON lead_activities(lead_id);

CREATE TABLE IF NOT EXISTS proposals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_id     UUID REFERENCES events(id),
  title        TEXT NOT NULL,
  content      JSONB NOT NULL DEFAULT '{}',
  total_value  NUMERIC(12,2),
  status       TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','accepted','rejected','expired')),
  valid_until  TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  accepted_at  TIMESTAMPTZ,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals(lead_id);

-- ─── RLS Policies ────────────────────────────────────────────────────────────

-- Client portals: tenant-scoped read/write, public read by slug
ALTER TABLE client_portals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_portals" ON client_portals
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Portal tables follow same tenant pattern
ALTER TABLE event_milestones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_milestones" ON event_milestones
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE portal_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_portal_docs" ON portal_documents
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE portal_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_portal_msgs" ON portal_messages
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_invoices" ON invoices
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_payments" ON payments
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_expenses" ON expenses
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_leads" ON leads
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Auto-update timestamps ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_client_portals ON client_portals;
CREATE TRIGGER set_updated_at_client_portals
  BEFORE UPDATE ON client_portals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_milestones ON event_milestones;
CREATE TRIGGER set_updated_at_milestones
  BEFORE UPDATE ON event_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_invoices ON invoices;
CREATE TRIGGER set_updated_at_invoices
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_leads ON leads;
CREATE TRIGGER set_updated_at_leads
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_proposals ON proposals;
CREATE TRIGGER set_updated_at_proposals
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
