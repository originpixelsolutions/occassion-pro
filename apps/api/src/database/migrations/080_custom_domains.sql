-- ============================================================
-- Migration 080: Custom Domain Setup
-- ============================================================

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE domain_verification_method_enum AS ENUM ('txt_record', 'cname_record');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE domain_ssl_status_enum AS ENUM ('pending', 'provisioning', 'active', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_custom_domains (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  domain                VARCHAR(253) NOT NULL UNIQUE,
  subdomain_prefix      TEXT,                             -- e.g. 'events' from events.client.com
  verification_token    TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  verification_method   domain_verification_method_enum NOT NULL DEFAULT 'txt_record',
  dns_target            TEXT        NOT NULL DEFAULT 'cname.occasionpro.in',
  is_verified           BOOLEAN     NOT NULL DEFAULT FALSE,
  verified_at           TIMESTAMPTZ,
  ssl_status            domain_ssl_status_enum NOT NULL DEFAULT 'pending',
  ssl_provisioned_at    TIMESTAMPTZ,
  is_active             BOOLEAN     NOT NULL DEFAULT FALSE,
  last_checked_at       TIMESTAMPTZ,
  check_failures        INTEGER     NOT NULL DEFAULT 0,
  metadata              JSONB       NOT NULL DEFAULT '{}',   -- stores cf_hostname_id, etc.
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_custom_domains_domain      ON tenant_custom_domains(domain);
CREATE INDEX IF NOT EXISTS idx_custom_domains_is_verified ON tenant_custom_domains(is_verified);
CREATE INDEX IF NOT EXISTS idx_custom_domains_is_active   ON tenant_custom_domains(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_domains_ssl_status  ON tenant_custom_domains(ssl_status);
CREATE INDEX IF NOT EXISTS idx_custom_domains_tenant_id   ON tenant_custom_domains(tenant_id);

-- ─── Trigger ──────────────────────────────────────────────────────────────────

DO $$
BEGIN
  EXECUTE '
    CREATE OR REPLACE TRIGGER trg_tenant_custom_domains_updated_at
    BEFORE UPDATE ON tenant_custom_domains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  ';
END $$;
