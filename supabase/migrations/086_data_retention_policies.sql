-- ============================================================================
-- Migration 086: Data Retention Policies
-- OccasionPro — DPDP compliance: configurable data lifecycle rules per tenant
-- ============================================================================

-- ─── data_retention_policies ─────────────────────────────────────────────────
-- Defines how long different categories of personal data are retained.
-- Required by DPDP Act 2023 (India) and GDPR for data minimisation compliance.

CREATE TABLE IF NOT EXISTS data_retention_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  data_category         TEXT NOT NULL,
  -- e.g. 'guest_profiles', 'event_records', 'payment_data',
  --      'communications', 'audit_logs', 'consent_records',
  --      'support_tickets', 'vendor_data', 'media_files'

  display_name          TEXT NOT NULL,
  description           TEXT,

  retention_period_days INT NOT NULL DEFAULT 365,
  -- 0 means "retain until manually deleted"

  legal_basis           TEXT,
  -- e.g. 'DPDP Act 2023 s.8', 'GDPR Art.17', 'Contractual obligation'

  auto_purge_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  -- If true, expired records are automatically anonymised or deleted

  purge_action          TEXT NOT NULL DEFAULT 'anonymise'
                          CHECK (purge_action IN ('anonymise', 'delete', 'archive')),

  last_purge_at         TIMESTAMPTZ,
  next_purge_at         TIMESTAMPTZ,   -- computed from last_purge + retention_period_days

  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  notes                 TEXT,

  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, data_category)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_retention_policies_tenant
  ON data_retention_policies (tenant_id);

CREATE INDEX IF NOT EXISTS idx_retention_policies_active
  ON data_retention_policies (tenant_id, is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_retention_policies_purge
  ON data_retention_policies (next_purge_at)
  WHERE auto_purge_enabled = TRUE AND is_active = TRUE;

-- ─── updated_at trigger ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_retention_policies_updated_at'
  ) THEN
    CREATE TRIGGER set_retention_policies_updated_at
      BEFORE UPDATE ON data_retention_policies
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;

-- Service role bypasses all RLS (for automation jobs and admin operations)
CREATE POLICY "service_role_all_retention_policies"
  ON data_retention_policies FOR ALL
  USING (auth.role() = 'service_role');

-- Tenant isolation: authenticated users can only read their own tenant's policies
CREATE POLICY "tenant_isolation_retention_policies"
  ON data_retention_policies FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Only workspace owners / admins can manage retention policies (via service role in practice)
CREATE POLICY "tenant_manage_retention_policies"
  ON data_retention_policies FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "tenant_update_retention_policies"
  ON data_retention_policies FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── Default retention policies (seeded for all new tenants via trigger) ─────
-- When a new workspace is created, populate sensible defaults.
-- These are SUGGESTED defaults; tenants can modify them.

CREATE OR REPLACE FUNCTION seed_default_retention_policies(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO data_retention_policies
    (tenant_id, data_category, display_name, description, retention_period_days, legal_basis, auto_purge_enabled, purge_action)
  VALUES
    (p_tenant_id, 'guest_profiles',    'Guest Profiles',          'Name, email, phone of event guests',               90,   'DPDP Act 2023 s.8(3)',    FALSE, 'anonymise'),
    (p_tenant_id, 'event_records',     'Event Records',           'Event details, schedules, runsheets',              1825, 'Contractual obligation',  FALSE, 'archive'),
    (p_tenant_id, 'payment_data',      'Payment & Invoice Data',  'Invoices, receipts, payment records',              2555, 'Income Tax Act 1961',     FALSE, 'archive'),
    (p_tenant_id, 'communications',    'Communications',          'Messages, emails, WhatsApp sent via platform',     365,  'DPDP Act 2023 s.8',       FALSE, 'delete'),
    (p_tenant_id, 'audit_logs',        'Audit Logs',              'User actions, system events',                      730,  'Security best practice',  FALSE, 'archive'),
    (p_tenant_id, 'consent_records',   'Consent Records',         'DPDP consent timestamps and text',                 1825, 'DPDP Act 2023 s.6',       FALSE, 'archive'),
    (p_tenant_id, 'support_tickets',   'Support Tickets',         'Help desk conversations',                          365,  'Service obligation',      FALSE, 'delete'),
    (p_tenant_id, 'vendor_data',       'Vendor Data',             'Vendor profiles, contracts, performance records',  1095, 'Contractual obligation',  FALSE, 'anonymise'),
    (p_tenant_id, 'media_files',       'Media & Documents',       'Photos, videos, PDFs uploaded to the platform',   365,  'Storage policy',          FALSE, 'delete')
  ON CONFLICT (tenant_id, data_category) DO NOTHING;
END;
$$;

-- ─── Comment ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE data_retention_policies IS
  'DPDP / GDPR data lifecycle rules. Each row defines how long a category of personal data is kept and what happens when it expires. The auto_purge_enabled flag activates scheduled anonymisation or deletion jobs.';
