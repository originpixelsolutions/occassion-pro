-- ============================================================
-- OccasionPro — Migration 004: CRM & Clients
-- ============================================================

-- ── CLIENT COMPANIES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  industry        TEXT,
  website         TEXT,
  logo_url        TEXT,
  address         JSONB DEFAULT '{}',
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,
  total_events    INTEGER DEFAULT 0,
  total_revenue   NUMERIC(14,2) DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_tenant ON client_companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_search ON client_companies USING gin(to_tsvector('english', name));

-- ── CONTACTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES client_companies(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES profiles(id),   -- if they have a portal account
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  designation     TEXT,
  avatar_url      TEXT,
  is_primary      BOOLEAN DEFAULT false,
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,
  last_contacted_at TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_search ON contacts USING gin(to_tsvector('english', full_name || ' ' || COALESCE(email, '')));

-- ── LEADS (Sales Pipeline) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id      UUID REFERENCES client_companies(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,                 -- "Sharma Wedding — Dec 2025"
  category        event_category,
  stage           lead_stage NOT NULL DEFAULT 'new',
  value           NUMERIC(14,2),                 -- estimated event value
  currency        TEXT NOT NULL DEFAULT 'INR',
  probability     INTEGER DEFAULT 50,            -- % chance of winning
  expected_close  DATE,
  event_date      DATE,
  source          TEXT,                          -- referral | website | social | cold | etc.
  owner_id        UUID REFERENCES profiles(id),  -- sales rep
  last_activity_at TIMESTAMPTZ,
  won_at          TIMESTAMPTZ,
  lost_at         TIMESTAMPTZ,
  lost_reason     TEXT,
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_close ON leads(expected_close);

-- ── LEAD ACTIVITIES (CRM timeline) ──────────────────────────
CREATE TABLE IF NOT EXISTS lead_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,          -- call | email | meeting | note | stage_change
  title           TEXT,
  body            TEXT,
  performed_by    UUID REFERENCES profiles(id),
  scheduled_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant ON lead_activities(tenant_id);

-- ── PROPOSALS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id),
  title           TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'draft',  -- draft | sent | viewed | accepted | declined
  valid_until     DATE,
  total_amount    NUMERIC(14,2),
  currency        TEXT NOT NULL DEFAULT 'INR',
  notes           TEXT,
  terms           TEXT,
  file_url        TEXT,                   -- generated PDF (Cloudflare R2)
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  declined_at     TIMESTAMPTZ,
  decline_reason  TEXT,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_tenant ON proposals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposals_event ON proposals(event_id);

-- ── PROPOSAL LINE ITEMS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposal_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  category        TEXT,                   -- Venue | Catering | Decor | Entertainment | etc.
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price      NUMERIC(12,2) NOT NULL,
  discount_pct    NUMERIC(5,2) DEFAULT 0,
  tax_pct         NUMERIC(5,2) DEFAULT 18,  -- GST default 18%
  total           NUMERIC(14,2),
  is_optional     BOOLEAN DEFAULT false,
  order_index     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pli_proposal ON proposal_line_items(proposal_id);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS cc_updated_at ON client_companies;
CREATE TRIGGER cc_updated_at BEFORE UPDATE ON client_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS proposals_updated_at ON proposals;
CREATE TRIGGER proposals_updated_at BEFORE UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
