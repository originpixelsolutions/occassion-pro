-- ============================================================
-- Migration 078: Tenant Payment Gateway System
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE payment_provider_enum AS ENUM (
    'razorpay', 'stripe', 'cashfree', 'payumoney', 'paypal', 'instamojo', 'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_order_status_enum AS ENUM (
    'pending', 'initiated', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE refund_status_enum AS ENUM (
    'pending', 'processing', 'completed', 'failed', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_category_enum AS ENUM (
    'general', 'vip', 'early_bird', 'group', 'press', 'speaker', 'sponsor', 'staff', 'complimentary'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discount_type_enum AS ENUM ('percentage', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────
-- 1. tenant_payment_gateways
--    One row per provider per tenant. Config is AES-256-GCM encrypted.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_payment_gateways (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  provider        payment_provider_enum NOT NULL,
  display_name    TEXT NOT NULL,
  config          TEXT NOT NULL,            -- AES-256-GCM encrypted JSON string
  is_active       BOOLEAN NOT NULL DEFAULT false,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  webhook_secret  TEXT,                     -- encrypted provider webhook secret
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_tpg_tenant ON tenant_payment_gateways (tenant_id);

-- ──────────────────────────────────────────────────────────────
-- 2. event_payment_settings
--    Per-event payment configuration
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_payment_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL UNIQUE,
  tenant_id             UUID NOT NULL,
  gateway_id            UUID REFERENCES tenant_payment_gateways(id) ON DELETE SET NULL,
  currency              CHAR(3) NOT NULL DEFAULT 'INR',
  payment_title         TEXT,
  payment_description   TEXT,
  success_redirect_url  TEXT,
  failure_redirect_url  TEXT,
  collect_gst           BOOLEAN NOT NULL DEFAULT false,
  gst_percentage        NUMERIC(5,2),
  convenience_fee_pct   NUMERIC(5,2) DEFAULT 0,
  is_payments_enabled   BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_eps_tenant ON event_payment_settings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_eps_event  ON event_payment_settings (event_id);

-- ──────────────────────────────────────────────────────────────
-- 3. event_ticket_types
--    Ticket SKUs per event with inventory management
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_ticket_types (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL,
  tenant_id         UUID NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  category          ticket_category_enum NOT NULL DEFAULT 'general',
  price             NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency          CHAR(3) NOT NULL DEFAULT 'INR',
  total_quantity    INTEGER,               -- NULL = unlimited
  sold_quantity     INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  min_per_order     INTEGER NOT NULL DEFAULT 1,
  max_per_order     INTEGER NOT NULL DEFAULT 10,
  sale_starts_at    TIMESTAMPTZ,
  sale_ends_at      TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  is_visible        BOOLEAN NOT NULL DEFAULT true,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ett_event  ON event_ticket_types (event_id);
CREATE INDEX IF NOT EXISTS idx_ett_tenant ON event_ticket_types (tenant_id);

-- ──────────────────────────────────────────────────────────────
-- 4. event_payment_orders
--    One order = one payment attempt (may contain multiple tickets)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_payment_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL,
  tenant_id           UUID NOT NULL,
  gateway_id          UUID REFERENCES tenant_payment_gateways(id) ON DELETE SET NULL,
  order_ref           TEXT NOT NULL UNIQUE,
  provider_order_id   TEXT,
  provider_payment_id TEXT,
  guest_id            UUID,
  guest_name          TEXT NOT NULL,
  guest_email         TEXT NOT NULL,
  guest_phone         TEXT,
  line_items          JSONB NOT NULL DEFAULT '[]',
  subtotal            NUMERIC(12,2) NOT NULL,
  discount_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  convenience_fee     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(12,2) NOT NULL,
  currency            CHAR(3) NOT NULL DEFAULT 'INR',
  status              payment_order_status_enum NOT NULL DEFAULT 'pending',
  discount_code_id    UUID,
  payment_method      TEXT,
  provider_metadata   JSONB,
  failure_reason      TEXT,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_epo_event    ON event_payment_orders (event_id);
CREATE INDEX IF NOT EXISTS idx_epo_tenant   ON event_payment_orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_epo_guest    ON event_payment_orders (guest_id);
CREATE INDEX IF NOT EXISTS idx_epo_status   ON event_payment_orders (status);
CREATE INDEX IF NOT EXISTS idx_epo_provider ON event_payment_orders (provider_order_id);

-- ──────────────────────────────────────────────────────────────
-- 5. event_payment_refunds
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_payment_refunds (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES event_payment_orders(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL,
  refund_ref          TEXT NOT NULL UNIQUE,
  provider_refund_id  TEXT,
  amount              NUMERIC(12,2) NOT NULL,
  reason              TEXT,
  status              refund_status_enum NOT NULL DEFAULT 'pending',
  initiated_by        UUID,
  processed_at        TIMESTAMPTZ,
  provider_metadata   JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_epr_order  ON event_payment_refunds (order_id);
CREATE INDEX IF NOT EXISTS idx_epr_tenant ON event_payment_refunds (tenant_id);

-- ──────────────────────────────────────────────────────────────
-- 6. event_discount_codes
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_discount_codes (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                   UUID NOT NULL,
  tenant_id                  UUID NOT NULL,
  code                       TEXT NOT NULL,
  description                TEXT,
  discount_type              discount_type_enum NOT NULL DEFAULT 'percentage',
  discount_value             NUMERIC(10,2) NOT NULL,
  max_discount_cap           NUMERIC(10,2),
  min_order_value            NUMERIC(10,2),
  applicable_ticket_type_ids UUID[],
  usage_limit                INTEGER,
  usage_count                INTEGER NOT NULL DEFAULT 0,
  per_user_limit             INTEGER NOT NULL DEFAULT 1,
  valid_from                 TIMESTAMPTZ,
  valid_until                TIMESTAMPTZ,
  is_active                  BOOLEAN NOT NULL DEFAULT true,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, code)
);
CREATE INDEX IF NOT EXISTS idx_edc_event  ON event_discount_codes (event_id);
CREATE INDEX IF NOT EXISTS idx_edc_tenant ON event_discount_codes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_edc_code   ON event_discount_codes (code);

-- ──────────────────────────────────────────────────────────────
-- Triggers: updated_at auto-update
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenant_payment_gateways',
    'event_payment_settings',
    'event_ticket_types',
    'event_payment_orders',
    'event_payment_refunds',
    'event_discount_codes'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
       CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_timestamp();',
      t, t, t, t
    );
  END LOOP;
END $$;
