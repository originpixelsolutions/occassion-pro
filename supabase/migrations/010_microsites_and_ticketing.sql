-- ============================================================
-- OccasionPro — Migration 010: Event Microsites & Ticketing
-- ============================================================

-- ── MICROSITES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS microsites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  status          microsite_status NOT NULL DEFAULT 'draft',
  -- Domain
  subdomain       TEXT,                   -- e.g. "gala2025" → gala2025.occasionpro.in
  custom_domain   TEXT,                   -- e.g. tickets.clientbrand.com
  -- Content
  title           TEXT NOT NULL,
  tagline         TEXT,
  description     TEXT,
  hero_image_url  TEXT,
  hero_video_url  TEXT,
  -- SEO
  meta_title      TEXT,
  meta_description TEXT,
  og_image_url    TEXT,
  -- Branding
  primary_color   TEXT DEFAULT '#1D4ED8',
  accent_color    TEXT DEFAULT '#06B6D4',
  logo_url        TEXT,
  -- Features
  show_schedule   BOOLEAN DEFAULT true,
  show_speakers   BOOLEAN DEFAULT true,
  show_sponsors   BOOLEAN DEFAULT false,
  show_gallery    BOOLEAN DEFAULT false,
  show_map        BOOLEAN DEFAULT true,
  show_countdown  BOOLEAN DEFAULT true,
  enable_ticketing BOOLEAN DEFAULT false,  -- main ticketing toggle
  enable_rsvp     BOOLEAN DEFAULT false,   -- free RSVP mode
  require_approval BOOLEAN DEFAULT false,  -- manual guest approval
  -- Analytics
  page_views      INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  -- Publishing
  published_at    TIMESTAMPTZ,
  unpublished_at  TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ms_event ON microsites(event_id);
CREATE INDEX IF NOT EXISTS idx_ms_tenant ON microsites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ms_subdomain ON microsites(subdomain);
CREATE INDEX IF NOT EXISTS idx_ms_domain ON microsites(custom_domain);

-- ── TICKET TIERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_tiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  microsite_id    UUID NOT NULL REFERENCES microsites(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,          -- Early Bird | General | VIP | Table | Group
  description     TEXT,
  price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'INR',
  quantity_total  INTEGER,               -- NULL = unlimited
  quantity_sold   INTEGER NOT NULL DEFAULT 0,
  quantity_available INTEGER GENERATED ALWAYS AS (
    CASE WHEN quantity_total IS NULL THEN 999999 ELSE quantity_total - quantity_sold END
  ) STORED,
  -- Sale window
  sale_starts_at  TIMESTAMPTZ,
  sale_ends_at    TIMESTAMPTZ,
  -- Guest category link
  category_id     UUID REFERENCES guest_categories(id),
  -- Perks
  includes        TEXT[] DEFAULT '{}',   -- list of inclusions
  -- Promo
  promo_codes     JSONB DEFAULT '[]',    -- [{code, discount_type, discount_value, usage_limit, used_count}]
  -- Transfer/refund
  is_transferable BOOLEAN DEFAULT true,
  is_refundable   BOOLEAN DEFAULT true,
  refund_cutoff_hours INTEGER DEFAULT 24,
  is_active       BOOLEAN DEFAULT true,
  order_index     INTEGER DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tt_microsite ON ticket_tiers(microsite_id);
CREATE INDEX IF NOT EXISTS idx_tt_event ON ticket_tiers(event_id);

-- ── TICKET PURCHASES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  microsite_id    UUID NOT NULL REFERENCES microsites(id) ON DELETE CASCADE,
  tier_id         UUID NOT NULL REFERENCES ticket_tiers(id),
  -- Buyer
  buyer_name      TEXT NOT NULL,
  buyer_email     TEXT NOT NULL,
  buyer_phone     TEXT,
  -- Quantity
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      NUMERIC(12,2) NOT NULL,
  promo_code      TEXT,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  tax_amount      NUMERIC(12,2) DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'INR',
  -- Payment
  payment_id      UUID REFERENCES payments(id) ON DELETE SET NULL,
  razorpay_order_id TEXT,
  -- Status
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | cancelled | refunded
  confirmed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  refunded_at     TIMESTAMPTZ,
  refund_amount   NUMERIC(12,2) DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_event ON ticket_purchases(event_id);
CREATE INDEX IF NOT EXISTS idx_tp_tier ON ticket_purchases(tier_id);
CREATE INDEX IF NOT EXISTS idx_tp_buyer ON ticket_purchases(buyer_email);
CREATE INDEX IF NOT EXISTS idx_tp_status ON ticket_purchases(tenant_id, status);

-- ── TICKETS (individual tickets from a purchase) ─────────────
CREATE TABLE IF NOT EXISTS tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_id     UUID NOT NULL REFERENCES ticket_purchases(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tier_id         UUID NOT NULL REFERENCES ticket_tiers(id),
  guest_id        UUID REFERENCES guests(id) ON DELETE SET NULL,
  ticket_number   TEXT NOT NULL UNIQUE DEFAULT 'OP-' || upper(substring(encode(gen_random_bytes(4),'hex'), 1, 8)),
  holder_name     TEXT,
  holder_email    TEXT,
  qr_code         TEXT UNIQUE DEFAULT encode(gen_random_bytes(20), 'hex'),
  qr_code_url     TEXT,
  status          ticket_status NOT NULL DEFAULT 'active',
  -- Apple/Google Wallet
  apple_wallet_pass_url TEXT,
  google_wallet_pass_url TEXT,
  -- Transfer
  transferred_to  TEXT,
  transferred_at  TIMESTAMPTZ,
  -- Use
  used_at         TIMESTAMPTZ,
  used_at_zone_id UUID REFERENCES checkin_zones(id),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_purchase ON tickets(purchase_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr ON tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(event_id, status);

-- Add FK from guests to tickets
DO $$ BEGIN
  ALTER TABLE guests ADD CONSTRAINT fk_guests_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── MICROSITE CONTENT BLOCKS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS microsite_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  microsite_id    UUID NOT NULL REFERENCES microsites(id) ON DELETE CASCADE,
  block_type      TEXT NOT NULL,          -- schedule | speakers | sponsors | gallery | faq | custom
  title           TEXT,
  content         JSONB NOT NULL DEFAULT '{}',
  is_visible      BOOLEAN DEFAULT true,
  order_index     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mc_microsite ON microsite_content(microsite_id);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS ms_updated_at ON microsites;
CREATE TRIGGER ms_updated_at BEFORE UPDATE ON microsites FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tt_updated_at ON ticket_tiers;
CREATE TRIGGER tt_updated_at BEFORE UPDATE ON ticket_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tp_updated_at ON ticket_purchases;
CREATE TRIGGER tp_updated_at BEFORE UPDATE ON ticket_purchases FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tickets_updated_at ON tickets;
DROP TRIGGER IF EXISTS tickets_updated_at ON tickets;
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS mc_updated_at ON microsite_content;
CREATE TRIGGER mc_updated_at BEFORE UPDATE ON microsite_content FOR EACH ROW EXECUTE FUNCTION update_updated_at();
