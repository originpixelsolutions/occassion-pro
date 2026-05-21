-- ============================================================
-- OccasionPro — Migration 080: Custom Domains
--
-- Per-tenant white-label custom domain system.
-- Integrates with Cloudflare Custom Hostnames API for SSL
-- provisioning and the CUSTOM_DOMAINS_KV Worker binding for
-- fast domain → tenant slug resolution at the edge.
--
-- Referenced by: custom-domains.service.ts
-- ============================================================

-- ── tenant_custom_domains ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_custom_domains (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL,
  domain                text        NOT NULL,
  subdomain_prefix      text,                   -- e.g. 'events' for events.client.com
  verification_token    text,                   -- TXT record value for DNS verification
  verification_method   text        NOT NULL DEFAULT 'txt_record',
  is_verified           boolean     NOT NULL DEFAULT false,
  verified_at           timestamptz,
  is_active             boolean     NOT NULL DEFAULT false,
  ssl_status            text        NOT NULL DEFAULT 'pending',
                                               -- 'pending'|'provisioning'|'active'|'failed'
  ssl_provisioned_at    timestamptz,
  cf_custom_hostname_id text,                  -- Cloudflare Custom Hostname resource ID
  check_failures        int         NOT NULL DEFAULT 0,
  last_checked_at       timestamptz,
  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_custom_domains_domain_unique UNIQUE (domain),
  CONSTRAINT tenant_custom_domains_tenant_unique UNIQUE (tenant_id)  -- one domain per tenant
);

CREATE INDEX IF NOT EXISTS idx_tenant_custom_domains_tenant
  ON tenant_custom_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_custom_domains_ssl_pending
  ON tenant_custom_domains(ssl_status, is_verified)
  WHERE ssl_status = 'provisioning' AND is_verified = true;
CREATE INDEX IF NOT EXISTS idx_tenant_custom_domains_unverified
  ON tenant_custom_domains(is_verified, check_failures, created_at)
  WHERE is_verified = false AND check_failures < 10;

-- ── updated_at trigger ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_custom_domains()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_custom_domains_updated_at ON tenant_custom_domains;
CREATE TRIGGER trg_tenant_custom_domains_updated_at
  BEFORE UPDATE ON tenant_custom_domains
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_custom_domains();

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE tenant_custom_domains ENABLE ROW LEVEL SECURITY;

-- Tenant owners can read their own domain record
CREATE POLICY "tenant_custom_domains_tenant_read"
  ON tenant_custom_domains FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

-- Tenant owners can insert/update their own record
CREATE POLICY "tenant_custom_domains_tenant_write"
  ON tenant_custom_domains FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

CREATE POLICY "tenant_custom_domains_tenant_update"
  ON tenant_custom_domains FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

CREATE POLICY "tenant_custom_domains_tenant_delete"
  ON tenant_custom_domains FOR DELETE
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

-- Service role has full access (used by background verification cron)
CREATE POLICY "tenant_custom_domains_service"
  ON tenant_custom_domains FOR ALL
  USING (auth.role() = 'service_role');
