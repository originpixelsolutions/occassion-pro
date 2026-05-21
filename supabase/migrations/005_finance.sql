-- ============================================================
-- OccasionPro — Migration 005: Finance
-- ============================================================

-- ── BUDGETS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'Main Budget',
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'INR',
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  is_locked       BOOLEAN DEFAULT false,        -- locked after client approval
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budgets_event ON budgets(event_id);
CREATE INDEX IF NOT EXISTS idx_budgets_tenant ON budgets(tenant_id);

-- ── BUDGET LINE ITEMS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id       UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,          -- Venue | Catering | Decor | AV | Entertainment | etc.
  subcategory     TEXT,
  description     TEXT NOT NULL,
  estimated_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_amount   NUMERIC(14,2) DEFAULT 0,
  variance        NUMERIC(14,2) GENERATED ALWAYS AS (actual_amount - estimated_amount) STORED,
  vendor_id       UUID,                  -- FK added in vendors migration
  is_paid         BOOLEAN DEFAULT false,
  notes           TEXT,
  order_index     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bli_budget ON budget_line_items(budget_id);
CREATE INDEX IF NOT EXISTS idx_bli_tenant ON budget_line_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bli_category ON budget_line_items(tenant_id, category);

-- ── INVOICES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id      UUID REFERENCES client_companies(id) ON DELETE SET NULL,
  invoice_number  TEXT NOT NULL,
  status          invoice_status NOT NULL DEFAULT 'draft',
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  currency        TEXT NOT NULL DEFAULT 'INR',
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance_due     NUMERIC(14,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  notes           TEXT,
  terms           TEXT,
  file_url        TEXT,                   -- PDF stored in Cloudflare R2
  razorpay_payment_link_id TEXT,
  razorpay_payment_link_url TEXT,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  overdue_reminder_sent_at TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_event ON invoices(event_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date);

-- ── INVOICE LINE ITEMS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price      NUMERIC(12,2) NOT NULL,
  discount_pct    NUMERIC(5,2) DEFAULT 0,
  tax_pct         NUMERIC(5,2) DEFAULT 18,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  order_index     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ili_invoice ON invoice_line_items(invoice_id);

-- ── PAYMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id      UUID REFERENCES invoices(id) ON DELETE SET NULL,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  amount          NUMERIC(14,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'INR',
  status          payment_status NOT NULL DEFAULT 'pending',
  payment_method  TEXT,                   -- card | upi | netbanking | wallet | etc.
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  paid_by         UUID REFERENCES profiles(id),
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  refund_amount   NUMERIC(14,2) DEFAULT 0,
  refunded_at     TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(tenant_id, status);

-- ── EXPENSES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  budget_line_item_id UUID REFERENCES budget_line_items(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'INR',
  category        TEXT,
  vendor_id       UUID,                   -- FK added in vendors migration
  receipt_url     TEXT,                   -- Cloudflare R2
  paid_by         UUID REFERENCES profiles(id),
  payment_method  TEXT,
  is_reimbursable BOOLEAN DEFAULT false,
  is_reimbursed   BOOLEAN DEFAULT false,
  reimbursed_at   TIMESTAMPTZ,
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_event ON expenses(event_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- ── VENDOR PAYOUTS (Razorpay Route) ──────────────────────────
CREATE TABLE IF NOT EXISTS vendor_payouts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id             UUID,                 -- FK added in vendors migration
  event_id              UUID REFERENCES events(id) ON DELETE SET NULL,
  amount                NUMERIC(14,2) NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'INR',
  razorpay_payout_id    TEXT UNIQUE,
  razorpay_fund_account_id TEXT,
  status                payment_status NOT NULL DEFAULT 'pending',
  paid_at               TIMESTAMPTZ,
  notes                 TEXT,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_tenant ON vendor_payouts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payouts_vendor ON vendor_payouts(vendor_id);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS budgets_updated_at ON budgets;
CREATE TRIGGER budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS bli_updated_at ON budget_line_items;
CREATE TRIGGER bli_updated_at BEFORE UPDATE ON budget_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS expenses_updated_at ON expenses;
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS payouts_updated_at ON vendor_payouts;
CREATE TRIGGER payouts_updated_at BEFORE UPDATE ON vendor_payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
