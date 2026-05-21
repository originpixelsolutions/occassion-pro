-- ============================================================
-- Migration 081: Security Infrastructure
-- OccasionPro — Enterprise Security Hardening
-- ============================================================
-- Tables: auth_attempts, used_webhook_nonces, security_audit_log
-- pg_cron cleanup jobs for nonces and old attempt records
-- ============================================================

-- ── ENUMS ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE attempt_type_enum AS ENUM (
    'login_password',
    'login_otp',
    'login_magic_link',
    'guest_portal_otp',
    'client_portal_magic_link',
    'vendor_portal_login',
    'api_key_auth',
    'totp_verify',
    'password_reset'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE security_action_enum AS ENUM (
    -- Auth events
    'auth.login_success',
    'auth.login_failure',
    'auth.logout',
    'auth.token_refresh',
    'auth.otp_sent',
    'auth.otp_verified',
    'auth.magic_link_sent',
    'auth.magic_link_consumed',
    'auth.brute_force_lockout',
    -- API key events
    'api_key.created',
    'api_key.revoked',
    'api_key.used',
    'api_key.quota_exceeded',
    -- Webhook events
    'webhook.signature_invalid',
    'webhook.replay_detected',
    'webhook.delivered',
    -- Admin events
    'admin.tenant_suspended',
    'admin.tenant_reactivated',
    'admin.plan_changed',
    'admin.user_impersonated',
    -- Data events
    'data.export_requested',
    'data.bulk_delete',
    'data.sensitive_access',
    -- Security events
    'security.sql_injection_attempt',
    'security.xss_attempt',
    'security.rate_limit_exceeded',
    'security.unauthorized_tenant_access'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── TABLE: auth_attempts ─────────────────────────────────────
-- Tracks authentication attempts for brute-force protection.
-- ip_hash and identifier_hash are SHA-256 hashes — never store
-- raw IPs or email/phone in this table for privacy.

CREATE TABLE IF NOT EXISTS auth_attempts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256(ip_address) — prevents raw IP storage
  ip_hash         TEXT        NOT NULL,
  -- SHA-256(email|phone|token) — hashed identifier
  identifier_hash TEXT        NOT NULL,
  attempt_type    attempt_type_enum NOT NULL,
  -- Whether this attempt succeeded
  success         BOOLEAN     NOT NULL DEFAULT false,
  -- Tenant context (nullable for pre-auth attempts)
  tenant_id       UUID        REFERENCES tenants(id) ON DELETE SET NULL,
  -- Optional: user agent hash for fingerprinting
  user_agent_hash TEXT,
  attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lockout queries (most recent N failures per ip+identifier)
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip_hash
  ON auth_attempts (ip_hash, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_identifier
  ON auth_attempts (identifier_hash, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip_identifier
  ON auth_attempts (ip_hash, identifier_hash, attempt_type, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_tenant
  ON auth_attempts (tenant_id, attempted_at DESC)
  WHERE tenant_id IS NOT NULL;

-- ── TABLE: used_webhook_nonces ───────────────────────────────
-- Prevents webhook replay attacks. Each delivered webhook has
-- a nonce (UUID from X-Webhook-Delivery-ID header). We store
-- consumed nonces and reject duplicates within the 24h window.

CREATE TABLE IF NOT EXISTS used_webhook_nonces (
  nonce           TEXT        PRIMARY KEY,
  source          TEXT,       -- e.g. "razorpay", "stripe", "internal"
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for TTL cleanup
CREATE INDEX IF NOT EXISTS idx_webhook_nonces_created
  ON used_webhook_nonces (created_at);

-- ── TABLE: security_audit_log ────────────────────────────────
-- Immutable security event log. Partitioned by month for scalability.
-- Never DELETE from this table — use archival for old records.

CREATE TABLE IF NOT EXISTS security_audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Actor context
  tenant_id       UUID        REFERENCES tenants(id) ON DELETE SET NULL,
  user_id         UUID,       -- Supabase auth user ID
  -- Action details
  action          security_action_enum NOT NULL,
  resource_type   TEXT,       -- e.g. "event", "guest", "payment"
  resource_id     TEXT,       -- UUID of the affected resource
  -- Network context (hashed for privacy)
  ip_hash         TEXT,
  user_agent_hash TEXT,
  -- Additional structured data
  metadata        JSONB       NOT NULL DEFAULT '{}',
  -- Outcome
  success         BOOLEAN     NOT NULL DEFAULT true,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for audit queries and compliance reporting
CREATE INDEX IF NOT EXISTS idx_sec_audit_tenant_created
  ON security_audit_log (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sec_audit_action
  ON security_audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_audit_user_id
  ON security_audit_log (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sec_audit_resource
  ON security_audit_log (resource_type, resource_id)
  WHERE resource_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sec_audit_created
  ON security_audit_log (created_at DESC);

-- ── TABLE: field_encryption_keys ─────────────────────────────
-- Key rotation tracking — actual keys live in env/KMS, never DB.
-- This table tracks which key version was used to encrypt a field.

CREATE TABLE IF NOT EXISTS field_encryption_key_versions (
  version         INTEGER     PRIMARY KEY,
  description     TEXT,       -- e.g. "Initial AES-256-GCM key — 2026-05"
  activated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deprecated_at   TIMESTAMPTZ,
  is_current      BOOLEAN     NOT NULL DEFAULT false
);

-- Ensure only one current key
CREATE UNIQUE INDEX IF NOT EXISTS idx_fek_current
  ON field_encryption_key_versions (is_current)
  WHERE is_current = true;

-- Insert initial key version record
INSERT INTO field_encryption_key_versions (version, description, is_current)
VALUES (1, 'Initial AES-256-GCM key (FIELD_ENCRYPTION_KEY env var) — activated 2026-05', true)
ON CONFLICT (version) DO NOTHING;

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
-- security_audit_log: read-only via API (service role writes)
ALTER TABLE security_audit_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_attempts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE used_webhook_nonces    ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — all API mutations use service role key.
-- No anon/authenticated policies needed for these security tables.

-- ── pg_cron CLEANUP JOBS ─────────────────────────────────────
-- Requires pg_cron extension. If not available, these are no-ops.

DO $$
BEGIN
  -- Delete webhook nonces older than 24 hours (daily at 02:00 UTC)
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-webhook-nonces',
      '0 2 * * *',
      $$DELETE FROM used_webhook_nonces WHERE created_at < now() - INTERVAL '24 hours'$$
    );

    -- Delete auth attempts older than 30 days (daily at 02:15 UTC)
    PERFORM cron.schedule(
      'cleanup-auth-attempts',
      '15 2 * * *',
      $$DELETE FROM auth_attempts WHERE attempted_at < now() - INTERVAL '30 days'$$
    );

    -- Archive security audit log older than 1 year to cold storage marker
    -- (actual archival to S3/R2 handled by application-level job)
    PERFORM cron.schedule(
      'mark-old-audit-log',
      '30 2 * * 0',
      $$
        UPDATE security_audit_log
        SET metadata = metadata || '{"archived": true}'::jsonb
        WHERE created_at < now() - INTERVAL '1 year'
          AND NOT (metadata ? 'archived')
      $$
    );
  END IF;
END
$$;

-- ── HELPER FUNCTION: record_auth_attempt ─────────────────────
-- Called from application layer to record auth events atomically.

CREATE OR REPLACE FUNCTION record_auth_attempt(
  p_ip_hash         TEXT,
  p_identifier_hash TEXT,
  p_attempt_type    attempt_type_enum,
  p_success         BOOLEAN,
  p_tenant_id       UUID    DEFAULT NULL,
  p_user_agent_hash TEXT    DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO auth_attempts (
    ip_hash, identifier_hash, attempt_type,
    success, tenant_id, user_agent_hash
  )
  VALUES (
    p_ip_hash, p_identifier_hash, p_attempt_type,
    p_success, p_tenant_id, p_user_agent_hash
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── HELPER FUNCTION: count_recent_failures ───────────────────
-- Returns failure count for an ip+identifier in the last N minutes.
-- Used by brute-force detection logic.

CREATE OR REPLACE FUNCTION count_recent_failures(
  p_ip_hash         TEXT,
  p_identifier_hash TEXT,
  p_attempt_type    attempt_type_enum,
  p_window_minutes  INTEGER DEFAULT 15
) RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM   auth_attempts
  WHERE  ip_hash         = p_ip_hash
    AND  identifier_hash = p_identifier_hash
    AND  attempt_type    = p_attempt_type
    AND  success         = false
    AND  attempted_at    > now() - (p_window_minutes * INTERVAL '1 minute')
$$;

-- ── HELPER FUNCTION: is_nonce_used ───────────────────────────

CREATE OR REPLACE FUNCTION is_nonce_used(p_nonce TEXT) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM used_webhook_nonces WHERE nonce = p_nonce
  )
$$;

-- ── COMMENTS ─────────────────────────────────────────────────
COMMENT ON TABLE auth_attempts IS
  'Brute-force protection: tracks auth attempts per ip+identifier hash. Auto-cleaned after 30 days.';
COMMENT ON TABLE used_webhook_nonces IS
  'Webhook replay protection: consumed nonce registry. Auto-cleaned after 24 hours.';
COMMENT ON TABLE security_audit_log IS
  'Immutable security event log for compliance and incident response. Never delete; archive after 1 year.';
COMMENT ON TABLE field_encryption_key_versions IS
  'Tracks which key version was used for field-level AES-256-GCM encryption. Actual keys live in env/KMS.';
