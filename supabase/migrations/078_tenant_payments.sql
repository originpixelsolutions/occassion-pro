-- ============================================================
-- OccasionPro — Migration 078: Tenant Payments
--
-- Full event ticketing and payment infrastructure:
--   • tenant_payment_gateways  — per-tenant gateway config (AES-256-GCM encrypted)
--   • event_payment_settings   — per-event payment configuration
--   • event_ticket_types       — ticket catalog (price, inventory, sale window)
--   • event_payment_orders     — order lifecycle (initiated → paid → refunded)
--   • event_payment_refunds    — refund tracking per order
--   • event_discount_codes     — percentage/fixed discount codes with usage limits
--
-- Referenced by: tenant-payments.service.ts
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE payment_order_status AS ENUM (
    'initiated','pending','paid','failed','cancelled',
    'refunded','partially_refunded','expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE payment_refund_status AS ENUM ('pending','processing','success','failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE discount_type AS ENUM ('percentage','fixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── tenant_payment_gateways ────────────────────────────────────────────────────
-- Stores one row per provider per tenant.
-- config and webhook_secret are AES-256-GCM encrypted blobs (iv:tag:enc).
CREATE TABLE IF NOT EXISTS tenant_payment_gateways (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL,
  provider        text        NOT NULL,  -- 'razorpay'|'stripe'|'cashfree'|'payumoney'|'instamojo'|'manual'
  display_name    text        NOT NULL,
  config          text        NOT NULL,  -- encrypted JSON: API keys, secrets
  webhook_secret  text,                  -- encrypted, nullable
  is_active       boolean     NOT NULL DEFAULT true,
  is_default      boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_payment_gateways_provider_unique UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_gateways_tenant
  ON tenant_payment_gateways(tenant_id);

-- ── event_payment_settings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_payment_settings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id               uuid        NOT NULL,
  gateway_id              uuid        REFERENCES tenant_payment_gateways(id) ON DELETE SET NULL,
  is_payments_enabled     boolean     NOT NULL DEFAULT false,
  currency                text        NOT NULL DEFAULT 'INR',
  payment_title           text,
  collect_phone           boolean     NOT NULL DEFAULT true,
  collect_address         boolean     NOT NULL DEFAULT false,
  collect_gst             boolean     NOT NULL DEFAULT false,
  gst_percentage          numeric(5,2) NOT NULL DEFAULT 18,
  convenience_fee_pct     numeric(5,2) NOT NULL DEFAULT 0,
  success_redirect_url    text,
  failure_redirect_url    text,
  custom_fields           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT event_payment_settings_event_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_payment_settings_event
  ON event_payment_settings(event_id);

-- ── event_ticket_types ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_ticket_types (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid          NOT NULL,
  name                text          NOT NULL,
  description         text,
  category            text,
  price               numeric(12,2) NOT NULL DEFAULT 0,
  currency            text          NOT NULL DEFAULT 'INR',
  total_quantity      int,          -- NULL = unlimited
  sold_quantity       int           NOT NULL DEFAULT 0,
  reserved_quantity   int           NOT NULL DEFAULT 0,
  min_per_order       int           NOT NULL DEFAULT 1,
  max_per_order       int           NOT NULL DEFAULT 10,
  sale_starts_at      timestamptz,
  sale_ends_at        timestamptz,
  is_active           boolean       NOT NULL DEFAULT true,
  sort_order          int           NOT NULL DEFAULT 0,
  metadata            jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_ticket_types_event
  ON event_ticket_types(event_id);

-- ── event_payment_orders ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_payment_orders (
  id                    uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              uuid                  NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id             uuid                  NOT NULL,
  gateway_id            uuid                  REFERENCES tenant_payment_gateways(id) ON DELETE SET NULL,
  guest_id              uuid                  REFERENCES guests(id) ON DELETE SET NULL,
  discount_code_id      uuid,                 -- FK added after event_discount_codes is created
  order_ref             text                  NOT NULL,
  provider_order_id     text,
  provider_payment_id   text,
  provider_metadata     jsonb,
  guest_name            text                  NOT NULL,
  guest_email           text                  NOT NULL,
  guest_phone           text,
  line_items            jsonb                 NOT NULL DEFAULT '[]'::jsonb,
  subtotal              numeric(14,2)         NOT NULL DEFAULT 0,
  discount_amount       numeric(14,2)         NOT NULL DEFAULT 0,
  gst_amount            numeric(14,2)         NOT NULL DEFAULT 0,
  convenience_fee       numeric(14,2)         NOT NULL DEFAULT 0,
  total_amount          numeric(14,2)         NOT NULL DEFAULT 0,
  currency              text                  NOT NULL DEFAULT 'INR',
  status                payment_order_status  NOT NULL DEFAULT 'initiated',
  payment_method        text,
  paid_at               timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz           NOT NULL DEFAULT now(),
  updated_at            timestamptz           NOT NULL DEFAULT now(),

  CONSTRAINT event_payment_orders_ref_unique UNIQUE (event_id, order_ref)
);

CREATE INDEX IF NOT EXISTS idx_event_payment_orders_event
  ON event_payment_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_payment_orders_guest
  ON event_payment_orders(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_payment_orders_status
  ON event_payment_orders(event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_payment_orders_provider
  ON event_payment_orders(provider_order_id) WHERE provider_order_id IS NOT NULL;

-- ── event_payment_refunds ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_payment_refunds (
  id                  uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid                  NOT NULL REFERENCES event_payment_orders(id) ON DELETE CASCADE,
  tenant_id           uuid                  NOT NULL,
  refund_ref          text                  NOT NULL,
  provider_refund_id  text,
  amount              numeric(14,2)         NOT NULL,
  reason              text,
  status              payment_refund_status NOT NULL DEFAULT 'pending',
  initiated_by        uuid                  REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at        timestamptz,
  created_at          timestamptz           NOT NULL DEFAULT now(),
  updated_at          timestamptz           NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_payment_refunds_order
  ON event_payment_refunds(order_id);

-- ── event_discount_codes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_discount_codes (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id         uuid          NOT NULL,
  code              text          NOT NULL,
  discount_type     discount_type NOT NULL DEFAULT 'percentage',
  discount_value    numeric(10,2) NOT NULL,
  max_discount_cap  numeric(10,2),           -- max value when type = percentage
  min_order_value   numeric(10,2),
  usage_limit       int,                     -- NULL = unlimited
  usage_count       int           NOT NULL DEFAULT 0,
  valid_from        timestamptz,
  valid_until       timestamptz,
  is_active         boolean       NOT NULL DEFAULT true,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT event_discount_codes_code_unique UNIQUE (event_id, code)
);

CREATE INDEX IF NOT EXISTS idx_event_discount_codes_event
  ON event_discount_codes(event_id);

-- ── Late FK: link orders → discount codes ─────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE event_payment_orders
    ADD CONSTRAINT fk_orders_discount_code
      FOREIGN KEY (discount_code_id) REFERENCES event_discount_codes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Helper: atomic discount usage increment ───────────────────────────────────
CREATE OR REPLACE FUNCTION increment_discount_usage(code_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE event_discount_codes
  SET    usage_count = usage_count + 1,
         updated_at  = now()
  WHERE  id = code_id;
$$;

-- ── updated_at triggers ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_payments()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenant_payment_gateways',
    'event_payment_settings',
    'event_ticket_types',
    'event_payment_orders',
    'event_payment_refunds',
    'event_discount_codes'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
       CREATE TRIGGER trg_%1$s_updated_at
         BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION set_updated_at_payments();',
      t
    );
  END LOOP;
END $$;

-- ── RLS ────────────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenant_payment_gateways',
    'event_payment_settings',
    'event_ticket_types',
    'event_payment_orders',
    'event_payment_refunds',
    'event_discount_codes'
  ] LOOP
    EXECUTE format('ALTER TABLE %1$s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_tenant" ON %1$s FOR ALL
        USING      (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()))
        WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));
      CREATE POLICY "%1$s_service" ON %1$s FOR ALL USING (auth.role() = 'service_role');
    $f$, t);
  END LOOP;
END $$;
