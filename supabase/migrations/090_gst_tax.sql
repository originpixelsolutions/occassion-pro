-- ============================================================
-- Migration 090: GST & Tax Compliance Module
-- Covers: GST settings per tenant, configurable tax rates,
--         tax invoices, GST line items, GST filings tracker
-- ============================================================

-- ── GST Settings (per tenant, global defaults) ──────────────────────────────
CREATE TABLE IF NOT EXISTS gst_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Taxpayer registration
  gstin           text,                          -- 15-char GSTIN
  legal_name      text,                          -- registered legal name
  trade_name      text,                          -- optional trade name
  pan             text,                          -- PAN (extracted from GSTIN digits 3-12)

  -- Address (place of business)
  address_line1   text,
  address_line2   text,
  city            text,
  state           text,                          -- state name
  state_code      text,                          -- 2-digit state code (e.g. '29')
  pincode         text,

  -- Tax preferences
  default_gst_type    text NOT NULL DEFAULT 'regular'
                        CHECK (default_gst_type IN ('regular','composition','exempt','unregistered')),
  reverse_charge_applicable boolean NOT NULL DEFAULT false,
  e_invoicing_enabled  boolean NOT NULL DEFAULT false,
  auto_calculate_gst   boolean NOT NULL DEFAULT true,

  -- Invoice series
  invoice_prefix  text NOT NULL DEFAULT 'INV',
  invoice_counter integer NOT NULL DEFAULT 1,
  credit_note_prefix  text NOT NULL DEFAULT 'CN',
  credit_note_counter integer NOT NULL DEFAULT 1,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id)
);

-- ── Tax Rates (tenant-scoped, event-overridable) ─────────────────────────────
CREATE TABLE IF NOT EXISTS tax_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name            text NOT NULL,                 -- e.g. 'GST 18%', 'GST 12% (Events)'
  description     text,

  -- HSN / SAC classification
  hsn_sac_code    text,                          -- 4-8 digit code
  is_service      boolean NOT NULL DEFAULT true, -- SAC = service, HSN = goods

  -- Rate components (all as percentage)
  cgst_rate       numeric(5,2) NOT NULL DEFAULT 0,
  sgst_rate       numeric(5,2) NOT NULL DEFAULT 0,
  igst_rate       numeric(5,2) NOT NULL DEFAULT 0,
  utgst_rate      numeric(5,2) NOT NULL DEFAULT 0,
  cess_rate       numeric(5,2) NOT NULL DEFAULT 0,

  -- Computed total rate (trigger-maintained)
  total_rate      numeric(5,2) GENERATED ALWAYS AS (cgst_rate + sgst_rate + igst_rate + utgst_rate + cess_rate) STORED,

  -- Applicability
  is_exempt       boolean NOT NULL DEFAULT false,
  is_nil_rated    boolean NOT NULL DEFAULT false,
  is_reverse_charge boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  is_default      boolean NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Only one default rate per tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_rates_default
  ON tax_rates (tenant_id) WHERE (is_default = true AND is_active = true);

-- ── Tax Invoices ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        uuid REFERENCES events(id) ON DELETE SET NULL,

  -- Invoice identity
  invoice_number  text NOT NULL,
  invoice_type    text NOT NULL DEFAULT 'tax_invoice'
                    CHECK (invoice_type IN ('tax_invoice','proforma','credit_note','debit_note')),
  invoice_date    date NOT NULL DEFAULT CURRENT_DATE,
  due_date        date,

  -- Linked to original invoice (for credit/debit notes)
  original_invoice_id uuid REFERENCES tax_invoices(id) ON DELETE SET NULL,

  -- Parties
  supplier_gstin  text,
  supplier_name   text NOT NULL,
  supplier_address text,
  supplier_state_code text,

  buyer_name      text NOT NULL,
  buyer_gstin     text,
  buyer_address   text,
  buyer_state_code text,
  buyer_pan       text,

  -- Supply classification
  supply_type     text NOT NULL DEFAULT 'B2B'
                    CHECK (supply_type IN ('B2B','B2C','SEZ','Export','Import')),
  place_of_supply text,                          -- state code
  is_igst         boolean NOT NULL DEFAULT false, -- interstate = IGST

  -- Amounts (computed from line items via trigger)
  subtotal        numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  taxable_amount  numeric(14,2) NOT NULL DEFAULT 0,
  cgst_amount     numeric(14,2) NOT NULL DEFAULT 0,
  sgst_amount     numeric(14,2) NOT NULL DEFAULT 0,
  igst_amount     numeric(14,2) NOT NULL DEFAULT 0,
  utgst_amount    numeric(14,2) NOT NULL DEFAULT 0,
  cess_amount     numeric(14,2) NOT NULL DEFAULT 0,
  total_tax       numeric(14,2) NOT NULL DEFAULT 0,
  round_off       numeric(6,2)  NOT NULL DEFAULT 0,
  grand_total     numeric(14,2) NOT NULL DEFAULT 0,

  -- Currency
  currency        text NOT NULL DEFAULT 'INR',

  -- Status & payment
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','finalized','sent','paid','cancelled','void')),
  payment_status  text NOT NULL DEFAULT 'unpaid'
                    CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
  amount_paid     numeric(14,2) NOT NULL DEFAULT 0,

  -- E-invoicing (IRN, QR code)
  irn             text,                          -- Invoice Reference Number
  ack_number      text,                          -- Acknowledgement number
  ack_date        timestamptz,
  qr_code_url     text,
  signed_invoice  text,                          -- base64-encoded signed PDF

  -- Reverse charge
  reverse_charge  boolean NOT NULL DEFAULT false,

  notes           text,
  terms           text,
  internal_notes  text,

  -- Audit
  created_by      uuid REFERENCES auth.users(id),
  finalized_at    timestamptz,
  cancelled_at    timestamptz,
  cancellation_reason text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, invoice_number)
);

-- ── GST Line Items ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gst_line_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES tax_invoices(id) ON DELETE CASCADE,
  tax_rate_id     uuid REFERENCES tax_rates(id) ON DELETE SET NULL,

  -- Item details
  item_code       text,
  description     text NOT NULL,
  hsn_sac_code    text,
  is_service      boolean NOT NULL DEFAULT true,

  -- Quantity & pricing
  quantity        numeric(12,3) NOT NULL DEFAULT 1,
  unit            text NOT NULL DEFAULT 'nos',
  unit_price      numeric(14,2) NOT NULL,
  discount_pct    numeric(5,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  taxable_amount  numeric(14,2) NOT NULL,

  -- Tax rates (snapshot at time of invoice creation)
  cgst_rate       numeric(5,2) NOT NULL DEFAULT 0,
  sgst_rate       numeric(5,2) NOT NULL DEFAULT 0,
  igst_rate       numeric(5,2) NOT NULL DEFAULT 0,
  utgst_rate      numeric(5,2) NOT NULL DEFAULT 0,
  cess_rate       numeric(5,2) NOT NULL DEFAULT 0,

  -- Tax amounts
  cgst_amount     numeric(14,2) NOT NULL DEFAULT 0,
  sgst_amount     numeric(14,2) NOT NULL DEFAULT 0,
  igst_amount     numeric(14,2) NOT NULL DEFAULT 0,
  utgst_amount    numeric(14,2) NOT NULL DEFAULT 0,
  cess_amount     numeric(14,2) NOT NULL DEFAULT 0,
  total_tax       numeric(14,2) NOT NULL DEFAULT 0,
  line_total      numeric(14,2) NOT NULL,

  -- Special handling
  is_nil_rated    boolean NOT NULL DEFAULT false,
  is_exempt       boolean NOT NULL DEFAULT false,
  is_reverse_charge boolean NOT NULL DEFAULT false,

  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── GST Filings Tracker ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gst_filings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  return_type     text NOT NULL
                    CHECK (return_type IN ('GSTR-1','GSTR-2A','GSTR-3B','GSTR-9','GSTR-9C','IFF','CMP-08')),
  tax_period      text NOT NULL,               -- 'MM-YYYY' e.g. '04-2026'
  frequency       text NOT NULL DEFAULT 'monthly'
                    CHECK (frequency IN ('monthly','quarterly','annual')),

  -- Filing status
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','filed','nil_filed','under_process','error')),

  -- Key figures
  total_outward_supplies  numeric(14,2),
  total_inward_supplies   numeric(14,2),
  total_igst_payable      numeric(14,2),
  total_cgst_payable      numeric(14,2),
  total_sgst_payable      numeric(14,2),
  total_cess_payable      numeric(14,2),
  late_fee                numeric(10,2),
  interest                numeric(10,2),

  -- ARN / acknowledgement
  arn             text,                        -- Acknowledgement Reference Number
  filing_date     date,
  due_date        date,

  notes           text,
  filed_by        uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, return_type, tax_period)
);

-- ── Input Tax Credit Ledger ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS itc_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id      uuid REFERENCES tax_invoices(id) ON DELETE SET NULL,

  entry_type      text NOT NULL CHECK (entry_type IN ('credit','debit','reversal','blocked')),
  supply_type     text,                        -- 'B2B','Import', etc.

  supplier_gstin  text,
  supplier_name   text,
  invoice_number  text,
  invoice_date    date,

  igst_credit     numeric(14,2) NOT NULL DEFAULT 0,
  cgst_credit     numeric(14,2) NOT NULL DEFAULT 0,
  sgst_credit     numeric(14,2) NOT NULL DEFAULT 0,
  cess_credit     numeric(14,2) NOT NULL DEFAULT 0,

  availed         boolean NOT NULL DEFAULT false,
  availed_date    date,
  blocked_reason  text,

  tax_period      text,                        -- 'MM-YYYY'
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Triggers: updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_gst_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_gst_settings_updated_at') THEN
    CREATE TRIGGER trg_gst_settings_updated_at
      BEFORE UPDATE ON gst_settings FOR EACH ROW EXECUTE FUNCTION update_gst_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_tax_rates_updated_at') THEN
    CREATE TRIGGER trg_tax_rates_updated_at
      BEFORE UPDATE ON tax_rates FOR EACH ROW EXECUTE FUNCTION update_gst_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_tax_invoices_updated_at') THEN
    CREATE TRIGGER trg_tax_invoices_updated_at
      BEFORE UPDATE ON tax_invoices FOR EACH ROW EXECUTE FUNCTION update_gst_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_gst_filings_updated_at') THEN
    CREATE TRIGGER trg_gst_filings_updated_at
      BEFORE UPDATE ON gst_filings FOR EACH ROW EXECUTE FUNCTION update_gst_updated_at();
  END IF;
END $$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE gst_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_invoices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE gst_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE gst_filings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE itc_ledger     ENABLE ROW LEVEL SECURITY;

-- gst_settings
CREATE POLICY gst_settings_tenant ON gst_settings
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- tax_rates
CREATE POLICY tax_rates_tenant ON tax_rates
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- tax_invoices
CREATE POLICY tax_invoices_tenant ON tax_invoices
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- gst_line_items (via invoice)
CREATE POLICY gst_line_items_tenant ON gst_line_items
  USING (EXISTS (
    SELECT 1 FROM tax_invoices ti
    WHERE ti.id = gst_line_items.invoice_id
      AND ti.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

-- gst_filings
CREATE POLICY gst_filings_tenant ON gst_filings
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- itc_ledger
CREATE POLICY itc_ledger_tenant ON itc_ledger
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tax_invoices_tenant         ON tax_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_event          ON tax_invoices(event_id);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_status         ON tax_invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_date           ON tax_invoices(tenant_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_gst_line_items_invoice      ON gst_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_gst_filings_tenant          ON gst_filings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gst_filings_period          ON gst_filings(tenant_id, tax_period);
CREATE INDEX IF NOT EXISTS idx_itc_ledger_tenant           ON itc_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_itc_ledger_period           ON itc_ledger(tenant_id, tax_period);

-- ── Seed: Default tax rates for new tenants (run per-tenant on onboarding) ───
-- (Actual seed data is injected at tenant-onboarding time in the service layer)

COMMENT ON TABLE gst_settings   IS 'Per-tenant GST registration and preferences';
COMMENT ON TABLE tax_rates      IS 'Configurable GST/tax rate slabs with HSN/SAC mapping';
COMMENT ON TABLE tax_invoices   IS 'Tax invoices, proformas, credit/debit notes with full GST breakdown';
COMMENT ON TABLE gst_line_items IS 'Line items for each tax invoice';
COMMENT ON TABLE gst_filings    IS 'GST return filing tracker (GSTR-1, GSTR-3B, etc.)';
COMMENT ON TABLE itc_ledger     IS 'Input Tax Credit ledger — credits, debits, reversals';
