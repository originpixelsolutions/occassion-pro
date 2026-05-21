-- ============================================================
-- 065_team_invitations_soft_delete.sql
-- 1. team_invitations — invite-link flow for workspace members
-- 2. events soft-delete — 30-day grace period before purge
-- ============================================================

-- ── 1. TEAM INVITATIONS ──────────────────────────────────────

-- Role enum (reuse if already exists, otherwise create)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_member_role') THEN
    CREATE TYPE workspace_member_role AS ENUM (
      'event_manager',
      'team_lead',
      'team_member'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS team_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email        VARCHAR(255) NOT NULL,
  name         VARCHAR(255),
  role         workspace_member_role NOT NULL DEFAULT 'team_member',
  invited_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 64-char random hex generated at application layer
  token        VARCHAR(64) NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at  TIMESTAMPTZ,
  is_revoked   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup by token (public invite-link resolution)
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invitations_token
  ON team_invitations (token);

-- Prevent duplicate pending invitations per workspace+email
CREATE INDEX IF NOT EXISTS idx_team_invitations_tenant_email
  ON team_invitations (tenant_id, email);

-- ── 2. EVENTS SOFT DELETE ────────────────────────────────────

-- Add soft-delete columns to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS deleted_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_purge_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by              UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Index for fast deleted-events queries (per tenant)
CREATE INDEX IF NOT EXISTS idx_events_deleted_at
  ON events (tenant_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── deleted_events view ──────────────────────────────────────
-- Convenience view; consumers should still apply tenant_id filter.
CREATE OR REPLACE VIEW deleted_events AS
  SELECT
    *,
    GREATEST(0, EXTRACT(EPOCH FROM (deletion_scheduled_purge_at - NOW())) / 86400)::int
      AS days_until_purge
  FROM events
  WHERE deleted_at IS NOT NULL;

-- ── Soft-delete cascade trigger ──────────────────────────────
-- When an event is soft-deleted:
--   • cancel all vendor assignments
--   • deactivate all team event access entries
CREATE OR REPLACE FUNCTION fn_event_soft_delete_cascade()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when deleted_at transitions NULL → non-null
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN

    -- Cancel pending/confirmed vendor assignments
    UPDATE vendor_event_assignments
    SET    status     = 'cancelled',
           updated_at = NOW()
    WHERE  event_id = NEW.id
      AND  status NOT IN ('cancelled', 'completed');

    -- Deactivate team access
    UPDATE team_event_access
    SET    is_active  = FALSE,
           updated_at = NOW()
    WHERE  event_id = NEW.id
      AND  is_active = TRUE;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_soft_delete_cascade ON events;
CREATE TRIGGER trg_event_soft_delete_cascade
  AFTER UPDATE OF deleted_at ON events
  FOR EACH ROW
  EXECUTE FUNCTION fn_event_soft_delete_cascade();

-- ── Scheduled purge (pg_cron) ────────────────────────────────
-- Run once daily; permanently deletes events whose grace period has elapsed.
-- Enable extension first:  CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Then schedule:
--   SELECT cron.schedule(
--     'purge-soft-deleted-events',
--     '0 3 * * *',
--     $$DELETE FROM events
--       WHERE deleted_at IS NOT NULL
--         AND deletion_scheduled_purge_at < NOW()$$
--   );

-- ── RLS policies for team_invitations ───────────────────────
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Workspace members can read their own workspace's invitations
CREATE POLICY "tenant members can view invitations"
  ON team_invitations FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Only admins / owners can insert (enforced at application layer too)
CREATE POLICY "tenant members can create invitations"
  ON team_invitations FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Revoking / accepting updates locked to same tenant
CREATE POLICY "tenant members can update invitations"
  ON team_invitations FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );
