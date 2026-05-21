-- ============================================================
-- OccasionPro — Migration 081: Security Infrastructure
--
-- Two tables:
--   • auth_attempts      — brute-force protection (BruteForceService)
--   • security_audit_log — immutable security event log (SecurityAuditService)
--
-- Privacy: IP addresses, identifiers, and user agents are stored
-- as SHA-256 hashes only (hashed before insert in BruteForceService
-- and SecurityAuditService via FieldEncryptionService.hashForStorage).
--
-- Referenced by:
--   apps/api/src/common/security/brute-force.service.ts
--   apps/api/src/common/security/security-audit.service.ts
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE attempt_type_enum AS ENUM (
    'password','otp','magic_link','api_key',
    'vendor_login','client_login','guest_login'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── auth_attempts ──────────────────────────────────────────────────────────────
-- Tracks authentication attempts for brute-force detection.
-- All sensitive values (IP, identifier, user_agent) are SHA-256 hashed.
-- Rows older than 24 hours are irrelevant for lockout checks and can be pruned.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid,              -- nullable: pre-auth attempts may lack tenant context
  ip_hash          text               NOT NULL,
  identifier_hash  text               NOT NULL,  -- hash of email / phone / token
  attempt_type     text               NOT NULL,  -- matches attempt_type_enum values (stored as text for flexibility)
  success          boolean            NOT NULL DEFAULT false,
  user_agent_hash  text,
  created_at       timestamptz        NOT NULL DEFAULT now()
);

-- Fast lockout check: recent failures for a given identifier+type
CREATE INDEX IF NOT EXISTS idx_auth_attempts_identifier_type
  ON auth_attempts(identifier_hash, attempt_type, created_at DESC)
  WHERE success = false;

-- Fast lockout check: recent failures for a given IP
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip
  ON auth_attempts(ip_hash, attempt_type, created_at DESC)
  WHERE success = false;

-- Tenant-scoped query support
CREATE INDEX IF NOT EXISTS idx_auth_attempts_tenant
  ON auth_attempts(tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- ── security_audit_log ─────────────────────────────────────────────────────────
-- Append-only security event log. No UPDATE or DELETE policies for tenant users.
-- Written by SecurityAuditService fire-and-forget from throughout the API.
CREATE TABLE IF NOT EXISTS security_audit_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  action         text        NOT NULL,   -- matches SecurityAction union type
  tenant_id      uuid,
  user_id        uuid,
  resource_type  text,
  resource_id    text,
  ip_hash        text,
  user_agent_hash text,
  metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  success        boolean     NOT NULL DEFAULT true,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Super-admin dashboard: list events by tenant (recent first)
CREATE INDEX IF NOT EXISTS idx_security_audit_log_tenant
  ON security_audit_log(tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Filter by action type
CREATE INDEX IF NOT EXISTS idx_security_audit_log_action
  ON security_audit_log(action, created_at DESC);

-- Filter failures only
CREATE INDEX IF NOT EXISTS idx_security_audit_log_failures
  ON security_audit_log(tenant_id, action, created_at DESC)
  WHERE success = false;

-- User-scoped audit trail
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user
  ON security_audit_log(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────────────────────

-- auth_attempts: service role only (written/read exclusively by BruteForceService)
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_attempts_service"
  ON auth_attempts FOR ALL
  USING (auth.role() = 'service_role');

-- security_audit_log: read-only for tenant members (append-only semantics)
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_audit_log_tenant_read"
  ON security_audit_log FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

-- No INSERT/UPDATE/DELETE for tenant users — only service role may write
CREATE POLICY "security_audit_log_service"
  ON security_audit_log FOR ALL
  USING (auth.role() = 'service_role');

-- ── Pruning helper (called by a scheduled cron in super-admin automation) ──────
-- Removes auth_attempts older than 24 hours (they cannot affect lockout windows)
-- and audit log entries older than 2 years (regulatory retention = 1 year + buffer).
CREATE OR REPLACE FUNCTION prune_security_tables()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM auth_attempts
  WHERE created_at < now() - interval '24 hours';

  DELETE FROM security_audit_log
  WHERE created_at < now() - interval '2 years';
$$;
