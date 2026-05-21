-- ============================================================
-- Migration 046: Multi-Provider Payment Architecture
-- ============================================================
-- Extends tenant_payment_config with all provider credentials.
-- Creates invoice_payments (offline + online confirmed receipts).
-- Creates invoice_payment_attempts (payment link tracking).
-- ============================================================

-- ─── 1. Extend tenant_payment_config ─────────────────────────────────────────

ALTER TABLE tenant_payment_config
  -- Stripe
  ADD COLUMN IF NOT EXISTS stripe_publishable_key  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_secret_key       TEXT,

  -- PayU
  ADD COLUMN IF NOT EXISTS payu_merchant_key       TEXT,
  ADD COLUMN IF NOT EXISTS payu_salt               TEXT,

  -- Cashfree
  ADD COLUMN IF NOT EXISTS cashfree_app_id         TEXT,
  ADD COLUMN IF NOT EXISTS cashfree_secret_key     TEXT,

  -- PayPal
  ADD COLUMN IF NOT EXISTS paypal_client_id        TEXT,
  ADD COLUMN IF NOT EXISTS paypal_client_secret    TEXT,

  -- Instamojo
  ADD COLUMN IF NOT EXISTS instamojo_api_key       TEXT,
  ADD COLUMN IF NOT EXISTS instamojo_auth_token    TEXT,

  -- General flags (already may exist from 045 — add IF NOT EXISTS)
  ADD COLUMN IF NOT EXISTS payment_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_payment_at         TIMESTAMPTZ;

-- Ensure the provider column has the full enum set
DO $$
BEGIN
  -- Alter type if it's a CHECK constraint (handle both approaches)
  ALTER TABLE tenant_payment_config
    DROP CONSTRAINT IF EXISTS tenant_payment_config_provider_check;

  ALTER TABLE tenant_payment_config
    ADD CONSTRAINT tenant_payment_config_provider_check
    CHECK (provider IN ('manual','razorpay','stripe','payu','cashfree','paypal','instamojo'));
EXCEPTION
  WHEN others THEN NULL; -- ignore if column doesn't have this constraint
END $$;

-- ─── 2. invoice_payments (confirmed payment receipts) ────────────────────────
-- Stores both offline payments (cash/cheque/NEFT/etc.) and
-- confirmed online payments (webhook-confirmed or manually verified).

CREATE TABLE IF NOT EXISTS invoice_payments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Amount
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency         CHAR(3)     NOT NULL DEFAULT 'INR',

  -- Payment classification
  method           TEXT        NOT NULL DEFAULT 'cash'
                   CHECK (method IN ('cash','cheque','neft','rtgs','upi','card','online','other')),
  is_offline       BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Status
  status           TEXT        NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('pending','confirmed','failed','refunded')),

  -- Online payment reference (NULL for offline)
  provider         TEXT,       -- razorpay | stripe | payu | cashfree | paypal | instamojo
  provider_payment_id TEXT,    -- provider's payment/capture ID
  payment_attempt_id  UUID,    -- FK to invoice_payment_attempts if originated from a link

  -- Offline payment details
  reference_number TEXT,       -- cheque no / UTR / UPI ref
  payment_date     DATE,
  notes            TEXT,
  received_by      TEXT,       -- staff member name

  -- Audit
  recorded_by      UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice    ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant     ON invoice_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_status     ON invoice_payments(status);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date       ON invoice_payments(payment_date);

-- ─── 3. invoice_payment_attempts (payment link tracking) ─────────────────────
-- Every time a "Send Payment Link" action is triggered, a record is created here.
-- Tracks the lifecycle: pending → paid / failed / expired.

CREATE TABLE IF NOT EXISTS invoice_payment_attempts (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id           UUID    NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id            UUID    REFERENCES tenants(id) ON DELETE SET NULL,

  -- Provider info
  provider             TEXT    NOT NULL,
  provider_payment_id  TEXT,   -- link/order/request ID from the provider
  payment_url          TEXT,   -- the URL sent to the customer

  -- Amount at time of link creation
  amount               NUMERIC(12,2),
  currency             CHAR(3) DEFAULT 'INR',

  -- Lifecycle
  status               TEXT    NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','paid','failed','expired','cancelled')),
  expires_at           TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,

  -- Metadata
  customer_email       TEXT,
  customer_phone       TEXT,
  webhook_payload      JSONB,  -- raw webhook data from provider for audit

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_invoice    ON invoice_payment_attempts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_provider   ON invoice_payment_attempts(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status     ON invoice_payment_attempts(status);

-- ─── 4. Add FK from invoice_payments to invoice_payment_attempts ─────────────

DO $$ BEGIN
  ALTER TABLE invoice_payments
    ADD CONSTRAINT fk_invoice_payments_attempt
    FOREIGN KEY (payment_attempt_id)
    REFERENCES invoice_payment_attempts(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 5. Trigger: auto-update updated_at ──────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_payments_updated_at ON invoice_payments;
CREATE TRIGGER trg_invoice_payments_updated_at
  BEFORE UPDATE ON invoice_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payment_attempts_updated_at ON invoice_payment_attempts;
CREATE TRIGGER trg_payment_attempts_updated_at
  BEFORE UPDATE ON invoice_payment_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 6. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE invoice_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payment_attempts ENABLE ROW LEVEL SECURITY;

-- Tenant isolation: users can only see their own tenant's payment records.
-- Super admin bypasses via service role client.

CREATE POLICY invoice_payments_tenant_isolation
  ON invoice_payments
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY payment_attempts_tenant_isolation
  ON invoice_payment_attempts
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- ─── 7. Vault-ready column comments ──────────────────────────────────────────
-- These columns hold provider credentials. In production, values should be
-- encrypted at rest via Supabase Vault or your KMS.

COMMENT ON COLUMN tenant_payment_config.razorpay_key_secret    IS 'SENSITIVE: encrypt via Vault in production';
COMMENT ON COLUMN tenant_payment_config.stripe_secret_key      IS 'SENSITIVE: encrypt via Vault in production';
COMMENT ON COLUMN tenant_payment_config.payu_salt              IS 'SENSITIVE: encrypt via Vault in production';
COMMENT ON COLUMN tenant_payment_config.cashfree_secret_key    IS 'SENSITIVE: encrypt via Vault in production';
COMMENT ON COLUMN tenant_payment_config.paypal_client_secret   IS 'SENSITIVE: encrypt via Vault in production';
COMMENT ON COLUMN tenant_payment_config.instamojo_auth_token   IS 'SENSITIVE: encrypt via Vault in production';
