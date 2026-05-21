-- ============================================================
-- Migration 060 — Gift Management Module
-- ============================================================

-- ─────────────────────────────────────────────
-- Gift Registry (per event)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_registries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL DEFAULT 'Gift Registry',
  description   TEXT,
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  public_slug   VARCHAR(80) UNIQUE,
  allow_cash    BOOLEAN NOT NULL DEFAULT TRUE,
  cash_target   NUMERIC(12,2),
  currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','closed','archived')),
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_registries_event  ON public.gift_registries(event_id);
CREATE INDEX IF NOT EXISTS idx_gift_registries_tenant ON public.gift_registries(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_registries_event_unique ON public.gift_registries(event_id);

-- ─────────────────────────────────────────────
-- Gift Items (wishlist entries on a registry)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id     UUID NOT NULL REFERENCES public.gift_registries(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) NOT NULL DEFAULT 'other'
                    CHECK (category IN (
                      'electronics','home_decor','kitchen','clothing',
                      'jewellery','experience','cash','voucher',
                      'books','toys','wellness','travel','other'
                    )),
  brand           VARCHAR(100),
  image_url       TEXT,
  product_url     TEXT,
  price           NUMERIC(12,2),
  currency_code   VARCHAR(3) NOT NULL DEFAULT 'INR',
  quantity_wanted INT NOT NULL DEFAULT 1,
  quantity_received INT NOT NULL DEFAULT 0,
  priority        VARCHAR(10) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','must_have')),
  is_group_gift   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INT NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_items_registry ON public.gift_items(registry_id);
CREATE INDEX IF NOT EXISTS idx_gift_items_event    ON public.gift_items(event_id);
CREATE INDEX IF NOT EXISTS idx_gift_items_category ON public.gift_items(category);

-- ─────────────────────────────────────────────
-- Gifts Received (actual gifts logged against an event)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gifts_received (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  registry_id     UUID REFERENCES public.gift_registries(id) ON DELETE SET NULL,
  gift_item_id    UUID REFERENCES public.gift_items(id) ON DELETE SET NULL,
  guest_id        UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  giver_name      VARCHAR(200),                    -- fallback if no guest_id
  giver_phone     VARCHAR(30),
  giver_email     VARCHAR(200),
  gift_type       VARCHAR(20) NOT NULL DEFAULT 'physical'
                    CHECK (gift_type IN ('physical','cash','voucher','experience','digital')),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) NOT NULL DEFAULT 'other',
  brand           VARCHAR(100),
  estimated_value NUMERIC(12,2),
  cash_amount     NUMERIC(12,2),                   -- only for cash gifts
  currency_code   VARCHAR(3) NOT NULL DEFAULT 'INR',
  quantity        INT NOT NULL DEFAULT 1,
  received_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by     VARCHAR(150),                    -- staff member who logged it
  storage_location VARCHAR(200),
  condition       VARCHAR(20) NOT NULL DEFAULT 'new'
                    CHECK (condition IN ('new','good','fair')),
  thank_you_sent  BOOLEAN NOT NULL DEFAULT FALSE,
  thank_you_sent_at TIMESTAMPTZ,
  thank_you_channel VARCHAR(20)
                    CHECK (thank_you_channel IN ('whatsapp','email','sms','in_person',NULL)),
  notes           TEXT,
  image_url       TEXT,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gifts_received_event      ON public.gifts_received(event_id);
CREATE INDEX IF NOT EXISTS idx_gifts_received_tenant     ON public.gifts_received(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gifts_received_guest      ON public.gifts_received(guest_id);
CREATE INDEX IF NOT EXISTS idx_gifts_received_type       ON public.gifts_received(gift_type);
CREATE INDEX IF NOT EXISTS idx_gifts_received_thankyou   ON public.gifts_received(thank_you_sent);

-- ─────────────────────────────────────────────
-- Thank You Templates
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_thankyou_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES public.events(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  channel     VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp','email','sms')),
  subject     VARCHAR(200),              -- email only
  body        TEXT NOT NULL,
  variables   TEXT[] NOT NULL DEFAULT '{}', -- e.g. ['{{giver_name}}','{{gift_name}}']
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thankyou_tenant ON public.gift_thankyou_templates(tenant_id);

-- ─────────────────────────────────────────────
-- Seed default templates
-- ─────────────────────────────────────────────
INSERT INTO public.gift_thankyou_templates
  (tenant_id, name, channel, body, variables, is_default)
SELECT
  t.id,
  'WhatsApp Thank You',
  'whatsapp',
  'Dear {{giver_name}}, thank you so much for the beautiful {{gift_name}}! Your thoughtfulness means the world to us. With love 💕',
  ARRAY['{{giver_name}}','{{gift_name}}'],
  TRUE
FROM public.tenants t
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- Gift summary view
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_gift_summary AS
SELECT
  e.id                                              AS event_id,
  e.tenant_id,
  COUNT(gr.id)                                      AS total_gifts,
  COUNT(gr.id) FILTER (WHERE gr.gift_type = 'cash') AS cash_gifts,
  COUNT(gr.id) FILTER (WHERE gr.gift_type = 'physical') AS physical_gifts,
  COALESCE(SUM(gr.estimated_value), 0)              AS total_estimated_value,
  COALESCE(SUM(gr.cash_amount), 0)                  AS total_cash_received,
  COUNT(gr.id) FILTER (WHERE gr.thank_you_sent = FALSE) AS pending_thankyou,
  COUNT(gr.id) FILTER (WHERE gr.thank_you_sent = TRUE)  AS thankyou_sent
FROM public.events e
LEFT JOIN public.gifts_received gr ON gr.event_id = e.id
GROUP BY e.id, e.tenant_id;

-- ─────────────────────────────────────────────
-- Updated-at triggers
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_gifts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['gift_registries','gift_items','gifts_received'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION update_gifts_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE public.gift_registries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gifts_received           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_thankyou_templates  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gift_registries_tenant" ON public.gift_registries
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "gift_items_tenant" ON public.gift_items
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "gifts_received_tenant" ON public.gifts_received
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "gift_templates_tenant" ON public.gift_thankyou_templates
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

