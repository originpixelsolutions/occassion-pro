-- ============================================================
-- Migration 052: Event-Level Access Control
--
-- Workspace Owner / Event Managers can:
--   1. Remove any member from a specific event (is_active = false)
--   2. Override per-module permissions for a member within an event
--
-- Access resolution order (highest to lowest priority):
--   1. Super Admin → always allowed
--   2. Workspace suspended → deny all
--   3. event-level is_active = false → deny for that event
--   4. event-level module_overrides → use override for that module
--   5. workspace role default → fall through
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TEAM EVENT ACCESS TABLE
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_event_access (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Active flag — false means removed from this event
  is_active       boolean NOT NULL DEFAULT true,

  -- Per-module permission overrides for this event only
  -- Structure: { "finance": "view", "guests": "full", "crm": "none", ... }
  -- Valid values: "none" | "view" | "edit" | "full" | null (null = use workspace default)
  module_overrides jsonb NOT NULL DEFAULT '{}',

  -- Audit fields
  added_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  added_at        timestamptz NOT NULL DEFAULT now(),
  removed_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  removed_at      timestamptz,
  removal_reason  text,

  updated_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (event_id, user_id)   -- one row per member per event
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_team_event_access_event   ON team_event_access(event_id, is_active);
CREATE INDEX IF NOT EXISTS idx_team_event_access_user    ON team_event_access(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_event_access_tenant  ON team_event_access(tenant_id);

-- ─────────────────────────────────────────────────────────────
-- 2. RLS POLICIES
-- ─────────────────────────────────────────────────────────────

ALTER TABLE team_event_access ENABLE ROW LEVEL SECURITY;

-- Tenant staff can read all event access records for their tenant
CREATE POLICY "tenant_read_event_access" ON team_event_access
  FOR SELECT
  USING (
    tenant_id = (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
      LIMIT 1
    )
  );

-- Only workspace owners and event_managers can modify event access
-- (service role bypasses RLS for the guard logic)
CREATE POLICY "manager_write_event_access" ON team_event_access
  FOR ALL
  USING (
    tenant_id = (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'event_manager')
        AND tm.status = 'active'
      LIMIT 1
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3. FUNCTION: check_event_module_access
-- Called by the API guard to resolve effective module access
-- Returns: 'full' | 'edit' | 'view' | 'none'
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_event_module_access(
  p_user_id   uuid,
  p_event_id  uuid,
  p_module    text DEFAULT NULL  -- null = check event-level active only
)
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_tenant_id     uuid;
  v_workspace_role text;
  v_is_active     boolean;
  v_overrides     jsonb;
  v_module_access text;
BEGIN
  -- Get tenant from event
  SELECT tenant_id INTO v_tenant_id FROM events WHERE id = p_event_id;
  IF v_tenant_id IS NULL THEN RETURN 'none'; END IF;

  -- Get workspace role
  SELECT role INTO v_workspace_role
  FROM tenant_members
  WHERE user_id = p_user_id AND tenant_id = v_tenant_id AND status = 'active';

  IF v_workspace_role IS NULL THEN RETURN 'none'; END IF;

  -- Workspace owner: unconditional full access (even event-level can't restrict owner)
  IF v_workspace_role = 'owner' THEN RETURN 'full'; END IF;

  -- Check event-level access record
  SELECT is_active, module_overrides
  INTO v_is_active, v_overrides
  FROM team_event_access
  WHERE user_id = p_user_id AND event_id = p_event_id;

  -- If a record exists and is_active = false → removed from event
  IF v_is_active IS NOT NULL AND v_is_active = false THEN
    RETURN 'none';
  END IF;

  -- If module-level check requested and override exists
  IF p_module IS NOT NULL AND v_overrides IS NOT NULL AND v_overrides ? p_module THEN
    v_module_access := v_overrides ->> p_module;
    RETURN COALESCE(v_module_access, 'none');
  END IF;

  -- Fall through to workspace role default
  CASE v_workspace_role
    WHEN 'event_manager' THEN RETURN 'full';
    WHEN 'team_lead'     THEN RETURN 'edit';
    WHEN 'team_member'   THEN RETURN 'view';
    ELSE RETURN 'none';
  END CASE;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. FUNCTION: get_event_team_with_access
-- Returns all workspace members enriched with their event access status
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_event_team_with_access(p_event_id uuid)
RETURNS TABLE (
  user_id          uuid,
  full_name        text,
  email            text,
  avatar_url       text,
  workspace_role   text,
  department       text,
  is_on_event      boolean,
  is_active        boolean,
  module_overrides jsonb,
  added_by_name    text,
  added_at         timestamptz,
  removed_by_name  text,
  removed_at       timestamptz,
  removal_reason   text
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM events WHERE id = p_event_id;

  RETURN QUERY
  SELECT
    u.id                          AS user_id,
    u.name                        AS full_name,
    u.email                       AS email,
    u.avatar_url                  AS avatar_url,
    tm.role                       AS workspace_role,
    tm.department                 AS department,
    (tea.id IS NOT NULL)          AS is_on_event,
    COALESCE(tea.is_active, true) AS is_active,
    COALESCE(tea.module_overrides, '{}'::jsonb) AS module_overrides,
    adder.name                    AS added_by_name,
    tea.added_at                  AS added_at,
    remover.name                  AS removed_by_name,
    tea.removed_at                AS removed_at,
    tea.removal_reason            AS removal_reason
  FROM tenant_members tm
  JOIN users u ON u.id = tm.user_id
  LEFT JOIN team_event_access tea ON tea.user_id = tm.user_id AND tea.event_id = p_event_id
  LEFT JOIN users adder   ON adder.id = tea.added_by
  LEFT JOIN users remover ON remover.id = tea.removed_by
  WHERE tm.tenant_id = v_tenant_id
    AND tm.status = 'active'
    AND tm.role != 'owner'   -- owner always has access; show separately
  ORDER BY tm.role DESC, u.name;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. AUDIT LOG ENTRIES — auto-log event access changes
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_event_access_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_actor_name  text;
  v_member_name text;
  v_event_name  text;
  v_action      text;
  v_details     jsonb;
BEGIN
  SELECT name INTO v_actor_name   FROM users WHERE id = COALESCE(NEW.updated_by, NEW.added_by, OLD.updated_by);
  SELECT name INTO v_member_name  FROM users WHERE id = NEW.user_id;
  SELECT name INTO v_event_name   FROM events WHERE id = NEW.event_id;

  IF TG_OP = 'INSERT' THEN
    v_action  := 'event_member_added';
    v_details := jsonb_build_object('event', v_event_name, 'member', v_member_name);

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active = true AND NEW.is_active = false THEN
      v_action  := 'event_member_removed';
      v_details := jsonb_build_object(
        'event', v_event_name,
        'member', v_member_name,
        'reason', NEW.removal_reason
      );
    ELSIF OLD.is_active = false AND NEW.is_active = true THEN
      v_action  := 'event_member_restored';
      v_details := jsonb_build_object('event', v_event_name, 'member', v_member_name);
    ELSIF OLD.module_overrides != NEW.module_overrides THEN
      v_action  := 'event_access_overrides_updated';
      v_details := jsonb_build_object(
        'event', v_event_name,
        'member', v_member_name,
        'overrides', NEW.module_overrides
      );
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO audit_logs (
    tenant_id, event_id, actor_id, action, entity_type, entity_id, details
  )
  SELECT
    NEW.tenant_id, NEW.event_id, COALESCE(NEW.updated_by, NEW.added_by),
    v_action, 'team_event_access', NEW.id, v_details
  WHERE v_action IS NOT NULL;

  RETURN NEW;
END;
$$;

-- Only create trigger if audit_logs table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    DROP TRIGGER IF EXISTS trg_log_event_access ON team_event_access;
    CREATE TRIGGER trg_log_event_access
      AFTER INSERT OR UPDATE ON team_event_access
      FOR EACH ROW EXECUTE FUNCTION log_event_access_change();
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. VALID MODULE KEYS (constraint helper)
-- ─────────────────────────────────────────────────────────────

COMMENT ON COLUMN team_event_access.module_overrides IS
  'JSONB object. Keys are module identifiers: crm, finance, guests, vendors, inventory,
   production, hospitality, artists, venues, marketing, support, team, documents,
   fnb, decor, media, surveys, health_safety, gifts.
   Values: "none" | "view" | "edit" | "full"';
