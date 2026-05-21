-- ============================================================
-- OccasionPro — Migration 007: Vendors
-- ============================================================

-- ── VENDOR CATEGORIES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,          -- Catering | AV | Decor | Photography | Artist | etc.
  icon            TEXT,
  parent_id       UUID REFERENCES vendor_categories(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── VENDORS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id),  -- if they have vendor portal access
  category_id     UUID REFERENCES vendor_categories(id),
  name            TEXT NOT NULL,
  contact_name    TEXT,
  email           TEXT,
  phone           TEXT,
  website         TEXT,
  address         JSONB DEFAULT '{}',
  city            TEXT,
  state           TEXT,
  country         TEXT DEFAULT 'IN',
  gstin           TEXT,                   -- GST number (India)
  pan             TEXT,                   -- PAN number (India)
  bank_details    JSONB DEFAULT '{}',     -- encrypted bank info for Razorpay Route
  razorpay_fund_account_id TEXT,          -- Razorpay Route fund account
  is_verified     BOOLEAN DEFAULT false,
  is_preferred    BOOLEAN DEFAULT false,
  is_blacklisted  BOOLEAN DEFAULT false,
  blacklist_reason TEXT,
  rating          NUMERIC(3,2),
  review_count    INTEGER DEFAULT 0,
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,
  portfolio_urls  TEXT[] DEFAULT '{}',
  specializations TEXT[] DEFAULT '{}',
  -- Artist specific
  is_artist       BOOLEAN DEFAULT false,
  artist_type     TEXT,                   -- DJ | Band | Singer | Comedian | Anchor | etc.
  rider_requirements TEXT,               -- technical/hospitality rider
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category_id);
CREATE INDEX IF NOT EXISTS idx_vendors_city ON vendors(tenant_id, city);
CREATE INDEX IF NOT EXISTS idx_vendors_artist ON vendors(tenant_id, is_artist);
CREATE INDEX IF NOT EXISTS idx_vendors_search ON vendors USING gin(to_tsvector('english', name || ' ' || COALESCE(contact_name, '')));

-- Add FK from floor_plan_elements to vendors
DO $$ BEGIN
  ALTER TABLE floor_plan_elements ADD CONSTRAINT fk_fpe_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE budget_line_items ADD CONSTRAINT fk_bli_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE expenses ADD CONSTRAINT fk_expenses_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE vendor_payouts ADD CONSTRAINT fk_payouts_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE event_runsheet ADD CONSTRAINT fk_runsheet_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── EVENT VENDOR ASSIGNMENTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS event_vendor_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category        TEXT,
  role            TEXT,                   -- primary | secondary | backup
  quoted_amount   NUMERIC(14,2),
  agreed_amount   NUMERIC(14,2),
  currency        TEXT DEFAULT 'INR',
  status          TEXT NOT NULL DEFAULT 'shortlisted',  -- shortlisted | briefed | contracted | active | completed | cancelled
  briefed_at      TIMESTAMPTZ,
  contracted_at   TIMESTAMPTZ,
  arrival_time    TIME,
  departure_time  TIME,
  requirements    TEXT,
  notes           TEXT,
  performance_score INTEGER,            -- 1-5 post-event rating
  performance_notes TEXT,
  metadata        JSONB DEFAULT '{}',
  assigned_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_eva_event ON event_vendor_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_eva_vendor ON event_vendor_assignments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_eva_tenant ON event_vendor_assignments(tenant_id);

-- ── VENDOR CONTRACTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  assignment_id   UUID REFERENCES event_vendor_assignments(id),
  title           TEXT NOT NULL,
  status          contract_status NOT NULL DEFAULT 'draft',
  amount          NUMERIC(14,2),
  currency        TEXT DEFAULT 'INR',
  start_date      DATE,
  end_date        DATE,
  file_url        TEXT,                   -- Cloudflare R2 (PDF)
  signed_by_vendor_at TIMESTAMPTZ,
  signed_by_company_at TIMESTAMPTZ,
  vendor_signature_url TEXT,
  company_signature_url TEXT,
  terms           TEXT,
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vc_vendor ON vendor_contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vc_event ON vendor_contracts(event_id);

-- ── VENDOR COMMUNICATIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_communications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  sender_id       UUID REFERENCES profiles(id),
  type            TEXT NOT NULL DEFAULT 'message',  -- message | brief | update | alert
  subject         TEXT,
  body            TEXT NOT NULL,
  attachments     TEXT[] DEFAULT '{}',
  is_read         BOOLEAN DEFAULT false,
  read_at         TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vcomm_vendor ON vendor_communications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vcomm_event ON vendor_communications(event_id);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS vendors_updated_at ON vendors;
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS eva_updated_at ON event_vendor_assignments;
CREATE TRIGGER eva_updated_at BEFORE UPDATE ON event_vendor_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS vp_updated_at ON vendor_payouts;
CREATE TRIGGER vp_updated_at BEFORE UPDATE ON vendor_payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS vc_updated_at ON vendor_communications;
CREATE TRIGGER vc_updated_at BEFORE UPDATE ON vendor_communications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
