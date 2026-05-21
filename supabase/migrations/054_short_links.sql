-- ============================================================
-- OccasionPro — Migration 054: Short Link System
-- Every link sent to guests/clients/vendors is a short links.occasionpro.in
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE short_link_type AS ENUM (
  'invitation', 'rsvp', 'guest_portal', 'client_portal',
  'vendor_portal', 'payment', 'document', 'custom'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE device_type AS ENUM ('mobile', 'desktop', 'tablet', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── short_links ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS short_links (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            varchar(10) UNIQUE NOT NULL,
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        uuid        REFERENCES events(id) ON DELETE SET NULL,
  link_type       short_link_type NOT NULL DEFAULT 'custom',
  destination_url text        NOT NULL,
  guest_id        uuid        REFERENCES guests(id) ON DELETE SET NULL,
  client_id       uuid        REFERENCES client_companies(id) ON DELETE SET NULL,
  vendor_id       uuid        REFERENCES vendor_accounts(id) ON DELETE SET NULL,
  custom_alias    varchar(50) UNIQUE,
  expires_at      timestamptz,
  max_clicks      integer     CHECK (max_clicks IS NULL OR max_clicks > 0),
  click_count     integer     NOT NULL DEFAULT 0,
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_short_links_tenant    ON short_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_short_links_event     ON short_links(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_short_links_guest     ON short_links(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_short_links_active    ON short_links(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_short_links_alias     ON short_links(custom_alias) WHERE custom_alias IS NOT NULL;

-- ── short_link_clicks ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS short_link_clicks (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_id  uuid        NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
  clicked_at     timestamptz NOT NULL DEFAULT now(),
  ip_hash        varchar(64),          -- SHA-256 of IP, never raw
  user_agent     text,
  referrer       text,
  country_code   varchar(2),
  device_type    device_type NOT NULL DEFAULT 'unknown',
  metadata       jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_slc_link_time  ON short_link_clicks(short_link_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_slc_daily      ON short_link_clicks(short_link_id, date_trunc('day', clicked_at));

-- ── generate_short_code() ──────────────────────────────────
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS varchar(10)
LANGUAGE plpgsql
AS $$
DECLARE
  charset  text    := 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code_len integer := 7;
  attempt  integer := 0;
  candidate varchar(10);
  exists_check integer;
BEGIN
  LOOP
    attempt := attempt + 1;
    IF attempt > 5 THEN
      RAISE EXCEPTION 'Failed to generate unique short code after 5 attempts';
    END IF;

    -- Build random string from safe charset (no 0/O/1/I/l confusion)
    candidate := '';
    FOR i IN 1..code_len LOOP
      candidate := candidate || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;

    SELECT COUNT(1) INTO exists_check FROM short_links WHERE code = candidate;
    IF exists_check = 0 THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;

-- ── resolve_short_link() ───────────────────────────────────
-- Called by Edge Function / CF Worker on each redirect
-- Returns: { destination_url, link_type, metadata } or NULL if invalid
CREATE OR REPLACE FUNCTION resolve_short_link(
  p_code        text,
  p_ip_hash     text     DEFAULT NULL,
  p_user_agent  text     DEFAULT NULL,
  p_referrer    text     DEFAULT NULL,
  p_country     varchar  DEFAULT NULL,
  p_device      text     DEFAULT 'unknown'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_link  short_links%ROWTYPE;
  v_device device_type;
BEGIN
  -- Resolve code or custom_alias
  SELECT * INTO v_link
  FROM short_links
  WHERE (code = p_code OR custom_alias = p_code)
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Check expiry
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  -- Check click cap
  IF v_link.max_clicks IS NOT NULL AND v_link.click_count >= v_link.max_clicks THEN
    RETURN jsonb_build_object('error', 'limit_reached');
  END IF;

  -- Parse device type safely
  BEGIN
    v_device := p_device::device_type;
  EXCEPTION WHEN OTHERS THEN
    v_device := 'unknown';
  END;

  -- Record click
  INSERT INTO short_link_clicks (short_link_id, ip_hash, user_agent, referrer, country_code, device_type)
  VALUES (v_link.id, p_ip_hash, p_user_agent, p_referrer, p_country, v_device);

  -- Increment counter (non-blocking — best effort)
  UPDATE short_links
  SET click_count = click_count + 1,
      updated_at  = now()
  WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'destination_url', v_link.destination_url,
    'link_type',       v_link.link_type,
    'tenant_id',       v_link.tenant_id,
    'event_id',        v_link.event_id,
    'guest_id',        v_link.guest_id,
    'metadata',        v_link.metadata
  );
END;
$$;

-- ── get_short_link_analytics() ─────────────────────────────
CREATE OR REPLACE FUNCTION get_short_link_analytics(p_link_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total       integer;
  v_daily       jsonb;
  v_devices     jsonb;
  v_hours       jsonb;
BEGIN
  SELECT click_count INTO v_total FROM short_links WHERE id = p_link_id;

  SELECT jsonb_agg(row_to_json(d)) INTO v_daily
  FROM (
    SELECT date_trunc('day', clicked_at)::date AS day, COUNT(*) AS clicks
    FROM short_link_clicks
    WHERE short_link_id = p_link_id
      AND clicked_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 1
  ) d;

  SELECT jsonb_agg(row_to_json(d)) INTO v_devices
  FROM (
    SELECT device_type, COUNT(*) AS clicks
    FROM short_link_clicks WHERE short_link_id = p_link_id
    GROUP BY 1
  ) d;

  SELECT jsonb_agg(row_to_json(d)) INTO v_hours
  FROM (
    SELECT EXTRACT(hour FROM clicked_at)::int AS hour, COUNT(*) AS clicks
    FROM short_link_clicks WHERE short_link_id = p_link_id
    GROUP BY 1 ORDER BY 1
  ) d;

  RETURN jsonb_build_object(
    'total',   COALESCE(v_total, 0),
    'daily',   COALESCE(v_daily, '[]'::jsonb),
    'devices', COALESCE(v_devices, '[]'::jsonb),
    'hours',   COALESCE(v_hours, '[]'::jsonb)
  );
END;
$$;

-- ── Timestamp trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_short_links_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_short_links_updated_at ON short_links;
CREATE TRIGGER trg_short_links_updated_at
  BEFORE UPDATE ON short_links
  FOR EACH ROW EXECUTE FUNCTION update_short_links_updated_at();

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE short_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_link_clicks ENABLE ROW LEVEL SECURITY;

-- Tenant members can CRUD their own tenant's links
CREATE POLICY short_links_tenant_all ON short_links
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

-- Clicks: read by tenant members; inserts via SECURITY DEFINER function only
CREATE POLICY slc_tenant_read ON short_link_clicks
  FOR SELECT USING (
    short_link_id IN (
      SELECT id FROM short_links
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
      )
    )
  );

-- Service role bypass for Edge Function / CF Worker
CREATE POLICY short_links_service_all ON short_links
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY slc_service_all ON short_link_clicks
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE short_links IS 'All short links for op.link/* redirects';
COMMENT ON TABLE short_link_clicks IS 'Click analytics — SHA-256 IP hashing for DPDP compliance';
COMMENT ON FUNCTION resolve_short_link IS 'Called by CF Worker on each hit; atomic click counter + redirect URL lookup';