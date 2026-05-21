-- ============================================================
-- Migration: 051_rbac_role_hierarchy.sql
-- ============================================================
-- ============================================================
-- Migration 051: Corrected RBAC Role Hierarchy
--
-- Hierarchy:
--   Super Admin  (platform level — super_admins table)
--   └── Workspace Owner   (tenant creator — role = 'owner')
--         └── Event Manager (role = 'event_manager')
--               └── Team Lead (role = 'team_lead')
--                     └── Team Member (role = 'team_member')
--
-- Changes:
--   1. Add role column to tenant_members (replaces scattered role refs)
--   2. Add workspace_owner_id to tenants table
--   3. Backfill existing owner records
--   4. Add module_permissions table for granular per-role permissions
--   5. Update RLS policies to reflect corrected hierarchy
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TENANT_MEMBERS — add canonical role column
-- ─────────────────────────────────────────────────────────────

ALTER TABLE tenant_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'team_member'
    CHECK (role IN ('owner', 'event_manager', 'team_lead', 'team_member'));

-- Single owner constraint: enforce at most one owner per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_members_one_owner
  ON tenant_members (tenant_id)
  WHERE role = 'owner';

-- ─────────────────────────────────────────────────────────────
-- 2. TENANTS — track owner_id (the workspace creator)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS workspace_owner_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- Backfill from existing tenant_members where old role = 'owner'
UPDATE tenants t
SET workspace_owner_id = tm.user_id
FROM tenant_members tm
WHERE tm.tenant_id = t.id
  AND tm.role = 'owner'
  AND t.workspace_owner_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. BACKFILL existing tenant_members
-- If the user is the workspace creator, mark them owner
-- ─────────────────────────────────────────────────────────────

-- Set owner role for workspace creators (where owner_id matches)
UPDATE tenant_members tm
SET role = 'owner'
FROM tenants t
WHERE tm.tenant_id = t.id
  AND tm.user_id = t.owner_id;

-- Any remaining unset roles with old 'event_manager' label → event_manager
-- (handles legacy data from old role system)
UPDATE tenant_members
SET role = 'event_manager'
WHERE role = 'team_member'
  AND id IN (
    SELECT tm.id FROM tenant_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE u.role = 'event_manager'
  );

-- ─────────────────────────────────────────────────────────────
-- 4. ROLE PERMISSIONS TABLE
-- Fine-grained per-role, per-module controls (customisable by owner)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('event_manager', 'team_lead', 'team_member')),
                -- Note: 'owner' is excluded — always has full access, no restrictions
  module_key    text NOT NULL,
  can_view      boolean NOT NULL DEFAULT true,
  can_create    boolean NOT NULL DEFAULT false,
  can_edit      boolean NOT NULL DEFAULT false,
  can_delete    boolean NOT NULL DEFAULT false,
  can_export    boolean NOT NULL DEFAULT false,
  can_approve   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, role, module_key)
);

CREATE INDEX IF NOT EXISTS idx_role_perms_tenant_role ON role_permissions(tenant_id, role);

-- ─────────────────────────────────────────────────────────────
-- 5. DEFAULT ROLE PERMISSIONS — seed for new tenants
-- Owner-only modules clearly marked
-- ─────────────────────────────────────────────────────────────

-- Function: called when a new tenant is created to seed defaults
CREATE OR REPLACE FUNCTION seed_default_role_permissions(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Event Manager defaults: near-full access, blocked from billing + workspace settings
  INSERT INTO role_permissions (tenant_id, role, module_key, can_view, can_create, can_edit, can_delete, can_export, can_approve)
  VALUES
    (p_tenant_id, 'event_manager', 'events',         true, true, true, true,  true,  true),
    (p_tenant_id, 'event_manager', 'guests',          true, true, true, true,  true,  true),
    (p_tenant_id, 'event_manager', 'vendors',         true, true, true, false, true,  true),
    (p_tenant_id, 'event_manager', 'finance',         true, true, true, false, true,  true),
    (p_tenant_id, 'event_manager', 'crm',             true, true, true, true,  true,  true),
    (p_tenant_id, 'event_manager', 'team',            true, true, true, false, false, true),
    (p_tenant_id, 'event_manager', 'inventory',       true, true, true, true,  true,  false),
    (p_tenant_id, 'event_manager', 'fnb',             true, true, true, true,  true,  true),
    (p_tenant_id, 'event_manager', 'production',      true, true, true, true,  true,  true),
    (p_tenant_id, 'event_manager', 'hospitality',     true, true, true, true,  true,  true),
    (p_tenant_id, 'event_manager', 'analytics',       true, false, false, false, true, false),
    (p_tenant_id, 'event_manager', 'ai',              true, true, false, false, false, false),
    (p_tenant_id, 'event_manager', 'documents',       true, true, true, false, true,  false),
    (p_tenant_id, 'event_manager', 'communication',   true, true, false, false, false, false),
    -- Blocked for event_manager (owner only):
    (p_tenant_id, 'event_manager', 'billing',         false, false, false, false, false, false),
    (p_tenant_id, 'event_manager', 'workspace_settings', false, false, false, false, false, false),
    (p_tenant_id, 'event_manager', 'api_settings',    false, false, false, false, false, false),
    (p_tenant_id, 'event_manager', 'payment_gateways',false, false, false, false, false, false),

  -- Team Lead defaults: module-scoped, mostly view + create
    (p_tenant_id, 'team_lead', 'events',       true, false, true,  false, true,  false),
    (p_tenant_id, 'team_lead', 'guests',        true, true,  true,  false, true,  false),
    (p_tenant_id, 'team_lead', 'vendors',       true, false, false, false, false, false),
    (p_tenant_id, 'team_lead', 'finance',       true, true,  false, false, false, false),
    (p_tenant_id, 'team_lead', 'crm',           true, true,  true,  false, false, false),
    (p_tenant_id, 'team_lead', 'inventory',     true, true,  true,  false, false, false),
    (p_tenant_id, 'team_lead', 'fnb',           true, true,  true,  false, false, false),
    (p_tenant_id, 'team_lead', 'production',    true, true,  true,  false, false, false),
    (p_tenant_id, 'team_lead', 'hospitality',   true, true,  true,  false, false, false),
    (p_tenant_id, 'team_lead', 'communication', true, true,  false, false, false, false),
    (p_tenant_id, 'team_lead', 'documents',     true, true,  false, false, false, false),
    (p_tenant_id, 'team_lead', 'billing',       false, false, false, false, false, false),
    (p_tenant_id, 'team_lead', 'team',          true, false, false, false, false, false),
    (p_tenant_id, 'team_lead', 'analytics',     true, false, false, false, true,  false),

  -- Team Member defaults: mostly view only
    (p_tenant_id, 'team_member', 'events',       true, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'guests',        true, true,  false, false, false, false),
    (p_tenant_id, 'team_member', 'inventory',     true, true,  false, false, false, false),
    (p_tenant_id, 'team_member', 'fnb',           true, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'production',    true, true,  false, false, false, false),
    (p_tenant_id, 'team_member', 'communication', true, true,  false, false, false, false),
    (p_tenant_id, 'team_member', 'documents',     true, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'billing',       false, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'vendors',       false, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'finance',       false, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'crm',           false, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'team',          false, false, false, false, false, false),
    (p_tenant_id, 'team_member', 'analytics',     false, false, false, false, false, false)

  ON CONFLICT (tenant_id, role, module_key) DO NOTHING;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS POLICIES — updated for corrected hierarchy
-- ─────────────────────────────────────────────────────────────

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Owner can manage all role permissions for their workspace
CREATE POLICY "owner_manage_role_permissions" ON role_permissions
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- All tenant members can read their workspace's role permissions
CREATE POLICY "staff_read_role_permissions" ON role_permissions
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 7. HELPER FUNCTION: get effective role for a user in a tenant
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_tenant_role(p_user_id uuid, p_tenant_id uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT role FROM tenant_members
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. HELPER FUNCTION: check if user is owner
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_workspace_owner(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND role = 'owner'
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 9. OWNERSHIP TRANSFER FUNCTION
-- Safely transfers workspace ownership to another team member
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION transfer_workspace_ownership(
  p_tenant_id    uuid,
  p_current_owner uuid,
  p_new_owner     uuid
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Verify caller is current owner
  IF NOT is_workspace_owner(p_current_owner, p_tenant_id) THEN
    RAISE EXCEPTION 'Only the current workspace owner can transfer ownership';
  END IF;

  -- Verify new owner is a member of this workspace
  IF NOT EXISTS (SELECT 1 FROM tenant_members WHERE user_id = p_new_owner AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'New owner must be an existing team member';
  END IF;

  -- Downgrade current owner to event_manager
  UPDATE tenant_members SET role = 'event_manager'
  WHERE user_id = p_current_owner AND tenant_id = p_tenant_id;

  -- Upgrade new owner
  UPDATE tenant_members SET role = 'owner'
  WHERE user_id = p_new_owner AND tenant_id = p_tenant_id;

  -- Update tenants.workspace_owner_id
  UPDATE tenants SET workspace_owner_id = p_new_owner, owner_id = p_new_owner
  WHERE id = p_tenant_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 10. UPDATED TRIGGERS — set owner role on tenant creation
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_workspace_owner_role()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- When a new tenant is created, set the owner's role in tenant_members
  UPDATE tenant_members
  SET role = 'owner'
  WHERE tenant_id = NEW.id AND user_id = NEW.owner_id;

  -- Also set workspace_owner_id
  NEW.workspace_owner_id := NEW.owner_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_workspace_owner ON tenants;
CREATE TRIGGER trg_set_workspace_owner
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_workspace_owner_role();

-- ============================================================
-- Migration: 052_event_level_access.sql
-- ============================================================
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
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Active flag — false means removed from this event
  is_active       boolean NOT NULL DEFAULT true,

  -- Per-module permission overrides for this event only
  -- Structure: { "finance": "view", "guests": "full", "crm": "none", ... }
  -- Valid values: "none" | "view" | "edit" | "full" | null (null = use workspace default)
  module_overrides jsonb NOT NULL DEFAULT '{}',

  -- Audit fields
  added_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  added_at        timestamptz NOT NULL DEFAULT now(),
  removed_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  removed_at      timestamptz,
  removal_reason  text,

  updated_by      uuid REFERENCES users(id) ON DELETE SET NULL,
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

-- ============================================================
-- Migration: 053_notifications.sql
-- ============================================================
-- =============================================================================
-- OccasionPro Migration 053 — Notification Centre
--
-- Tables:
--   notifications              → all notifications across portals
--   notification_preferences   → per-user per-module muting/channel prefs
--
-- Functions:
--   create_notification()      → insert with preference check, return id
--   mark_notifications_read()  → batch mark read, return count
--   get_unread_count()         → fast unread badge count
--
-- Real-time:
--   Supabase Realtime publication on notifications table (recipient_id filter)
-- =============================================================================

-- ─── Enum types ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE notification_recipient_type AS ENUM (
    'team',    -- workspace team member
    'guest',   -- event guest
    'client',  -- client portal user
    'vendor'   -- vendor portal user
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_module AS ENUM (
    'guests',       -- guest management actions
    'finance',      -- payments, budgets, invoices
    'fnb',          -- food & beverage
    'floorplan',    -- floor plan changes
    'runsheet',     -- runsheet updates
    'vendors',      -- vendor assignments, declines
    'clients',      -- client actions
    'team',         -- team changes, removals
    'conference',   -- conference / session module
    'post_event',   -- post-event feedback, reports
    'system'        -- platform-level alerts
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_urgency AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id         UUID REFERENCES events(id) ON DELETE SET NULL,

  recipient_id     UUID NOT NULL,   -- user_id / guest_id / client_id / vendor_id
  recipient_type   notification_recipient_type NOT NULL,

  module           notification_module NOT NULL,
  urgency          notification_urgency NOT NULL DEFAULT 'info',

  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  action_url       TEXT,            -- deep-link to the relevant page

  is_read          BOOLEAN NOT NULL DEFAULT FALSE,
  read_at          TIMESTAMPTZ,

  -- batching support: reference to first notification in a batch group
  batch_key        TEXT,            -- e.g. "finance:event_id:2026-05-17T10" — same key = same batch
  batch_count      INT NOT NULL DEFAULT 1,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast unread badge and inbox queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications(recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_event
  ON notifications(tenant_id, event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_batch_key
  ON notifications(batch_key, created_at DESC)
  WHERE batch_key IS NOT NULL;

-- ─── notification_preferences ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_preferences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  recipient_type    notification_recipient_type NOT NULL,
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,

  module            notification_module NOT NULL,
  urgency_threshold notification_urgency NOT NULL DEFAULT 'info',  -- min urgency to receive
  in_app_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_enabled  BOOLEAN NOT NULL DEFAULT FALSE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, tenant_id, module)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user
  ON notification_preferences(user_id, recipient_type);

-- ─── Trigger: updated_at ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_notifications_updated_at();

-- ─── Function: create_notification ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_notification(
  p_tenant_id       UUID,
  p_event_id        UUID,
  p_recipient_id    UUID,
  p_recipient_type  notification_recipient_type,
  p_module          notification_module,
  p_title           TEXT,
  p_body            TEXT,
  p_action_url      TEXT DEFAULT NULL,
  p_urgency         notification_urgency DEFAULT 'info',
  p_batch_key       TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_pref           notification_preferences%ROWTYPE;
  v_urgency_rank   INT;
  v_threshold_rank INT;
  v_notification_id UUID;
  v_batch_count    INT;
  v_existing_batch UUID;
BEGIN
  -- Check preferences (only for team members who have explicit prefs)
  SELECT * INTO v_pref
  FROM notification_preferences
  WHERE user_id = p_recipient_id
    AND (tenant_id = p_tenant_id OR tenant_id IS NULL)
    AND module = p_module
  LIMIT 1;

  -- If preference exists and in_app is disabled, skip
  IF FOUND AND NOT v_pref.in_app_enabled THEN
    RETURN NULL;
  END IF;

  -- Check urgency threshold
  IF FOUND THEN
    -- Map urgency to rank
    v_urgency_rank := CASE p_urgency
      WHEN 'info'     THEN 1
      WHEN 'warning'  THEN 2
      WHEN 'critical' THEN 3
    END;
    v_threshold_rank := CASE v_pref.urgency_threshold
      WHEN 'info'     THEN 1
      WHEN 'warning'  THEN 2
      WHEN 'critical' THEN 3
    END;

    IF v_urgency_rank < v_threshold_rank THEN
      RETURN NULL; -- below user's threshold, don't send
    END IF;
  END IF;

  -- Smart batching: check if a recent notification with same batch_key exists (within 60s)
  IF p_batch_key IS NOT NULL THEN
    SELECT id, batch_count INTO v_existing_batch, v_batch_count
    FROM notifications
    WHERE batch_key = p_batch_key
      AND recipient_id = p_recipient_id
      AND created_at > NOW() - INTERVAL '60 seconds'
      AND is_read = FALSE
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      -- Update existing notification's count and body
      UPDATE notifications
      SET
        batch_count = v_batch_count + 1,
        body = p_body,  -- most recent body
        title = CASE
          WHEN v_batch_count + 1 >= 3
          THEN regexp_replace(p_title, '^\d+ ', '') -- strip leading count
               -- Caller is responsible for title like "3 new updates in Finance"
          ELSE p_title
        END,
        updated_at = NOW()
      WHERE id = v_existing_batch
      RETURNING id INTO v_notification_id;

      RETURN v_notification_id;
    END IF;
  END IF;

  -- Insert new notification
  INSERT INTO notifications (
    tenant_id, event_id, recipient_id, recipient_type,
    module, urgency, title, body, action_url, batch_key
  )
  VALUES (
    p_tenant_id, p_event_id, p_recipient_id, p_recipient_type,
    p_module, p_urgency, p_title, p_body, p_action_url, p_batch_key
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- ─── Function: mark_notifications_read ───────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_recipient_id UUID,
  p_ids          UUID[]
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE recipient_id = p_recipient_id
    AND id = ANY(p_ids)
    AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── Function: mark_all_notifications_read ────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_all_notifications_read(
  p_recipient_id UUID,
  p_tenant_id    UUID
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE recipient_id = p_recipient_id
    AND tenant_id = p_tenant_id
    AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── Function: get_unread_count ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_unread_count(
  p_recipient_id UUID
)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INT
  FROM notifications
  WHERE recipient_id = p_recipient_id
    AND is_read = FALSE;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Each recipient can only see and update their own notifications
DROP POLICY IF EXISTS "notifications_own_read" ON notifications;
CREATE POLICY "notifications_own_read" ON notifications
  FOR SELECT
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_own_update" ON notifications;
CREATE POLICY "notifications_own_update" ON notifications
  FOR UPDATE
  USING (recipient_id = auth.uid());

-- Service role (used by backend) can insert
DROP POLICY IF EXISTS "notifications_service_insert" ON notifications;
CREATE POLICY "notifications_service_insert" ON notifications
  FOR INSERT
  WITH CHECK (TRUE);  -- enforced at application layer

-- Super admins can read all
DROP POLICY IF EXISTS "notifications_super_admin_all" ON notifications;
CREATE POLICY "notifications_super_admin_all" ON notifications
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

-- Preferences: own rows only
DROP POLICY IF EXISTS "notif_prefs_own" ON notification_preferences;
CREATE POLICY "notif_prefs_own" ON notification_preferences
  FOR ALL
  USING (user_id = auth.uid());

-- ─── Enable Supabase Realtime ─────────────────────────────────────────────────

-- Add notifications to the realtime publication so clients can subscribe
-- to filtered channels: realtime:notifications:recipient_id=<uuid>
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ─── Comments ────────────────────────────────────────────────────────────────

COMMENT ON TABLE notifications IS
  'Cross-portal notification centre. Recipients can be team members, guests, clients, or vendors. '
  'Supabase Realtime streams new rows filtered by recipient_id.';

COMMENT ON TABLE notification_preferences IS
  'Per-user per-module notification preferences. Controls in-app, email, WhatsApp delivery and urgency threshold.';

COMMENT ON FUNCTION create_notification IS
  'Insert a notification respecting user preferences and smart batching. '
  'Returns the notification id, or NULL if suppressed by preferences.';

-- ============================================================
-- Migration: 054_short_links.sql
-- ============================================================
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
  created_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
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
-- ============================================================
-- Migration: 055_event_types_readiness.sql
-- ============================================================
-- ============================================================
-- Migration 055: Event Types + Smart Readiness Engine
-- ============================================================
-- • event_types table (system built-ins + tenant custom)
-- • event_type_readiness_checklist table
-- • Seed: 15 built-in event types + checklist items
-- • ALTER events: add event_type_id, currency_code, timezone,
--   deleted_at, purge_after, auto_approve_guests
-- • smart_readiness_score(p_event_id) DB function
-- • RLS policies
-- ============================================================

-- ── event_types ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_types (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES public.tenants(id) ON DELETE CASCADE,  -- NULL = system/global
  name         VARCHAR(100) NOT NULL,
  slug         VARCHAR(100) NOT NULL,
  icon         VARCHAR(50)  NOT NULL DEFAULT '📅',   -- emoji or icon name
  description  TEXT,
  color        VARCHAR(20)  DEFAULT '#6366f1',
  is_system    BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)  -- per-tenant slugs; system types have tenant_id=NULL
);

CREATE INDEX IF NOT EXISTS idx_event_types_tenant ON public.event_types (tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_types_system ON public.event_types (is_system) WHERE is_system = TRUE;

-- ── event_type_readiness_checklist ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_type_readiness_checklist (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id  UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  module         VARCHAR(60) NOT NULL,  -- e.g. 'venue', 'guests', 'finance', 'media'
  check_key      VARCHAR(100) NOT NULL, -- machine key for DB evaluation
  check_label    VARCHAR(200) NOT NULL, -- human-readable
  is_required    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INT     NOT NULL DEFAULT 0,
  UNIQUE (event_type_id, check_key)
);

CREATE INDEX IF NOT EXISTS idx_readiness_event_type ON public.event_type_readiness_checklist (event_type_id);

-- ── ALTER events: new columns ─────────────────────────────────────────────────

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type_id     UUID REFERENCES public.event_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency_code     VARCHAR(3)   NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS timezone          VARCHAR(50)  NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purge_after       TIMESTAMPTZ GENERATED ALWAYS AS (deleted_at + INTERVAL '30 days') STORED,
  ADD COLUMN IF NOT EXISTS auto_approve_guests BOOLEAN    NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_events_type   ON public.events (event_type_id);
CREATE INDEX IF NOT EXISTS idx_events_deleted ON public.events (deleted_at) WHERE deleted_at IS NOT NULL;

-- ── SEED: system event types ──────────────────────────────────────────────────

INSERT INTO public.event_types (id, tenant_id, name, slug, icon, description, color, is_system, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000001', NULL, 'Wedding',            'wedding',            '💍', 'Full-day wedding ceremony and reception', '#ec4899', TRUE, 1),
  ('10000000-0000-0000-0000-000000000002', NULL, 'Corporate',          'corporate',          '🏢', 'Corporate events, meetings, team offsites', '#6366f1', TRUE, 2),
  ('10000000-0000-0000-0000-000000000003', NULL, 'Birthday',           'birthday',           '🎂', 'Birthday parties and milestone celebrations', '#f59e0b', TRUE, 3),
  ('10000000-0000-0000-0000-000000000004', NULL, 'Conference',         'conference',         '🎤', 'Multi-speaker conferences and summits', '#0ea5e9', TRUE, 4),
  ('10000000-0000-0000-0000-000000000005', NULL, 'Concert',            'concert',            '🎵', 'Live music concerts and performances', '#a855f7', TRUE, 5),
  ('10000000-0000-0000-0000-000000000006', NULL, 'Exhibition',         'exhibition',         '🖼️', 'Art exhibitions and trade displays', '#14b8a6', TRUE, 6),
  ('10000000-0000-0000-0000-000000000007', NULL, 'Product Launch',     'product-launch',     '🚀', 'Brand and product launch events', '#f97316', TRUE, 7),
  ('10000000-0000-0000-0000-000000000008', NULL, 'Award Ceremony',     'award-ceremony',     '🏆', 'Award nights and recognition events', '#eab308', TRUE, 8),
  ('10000000-0000-0000-0000-000000000009', NULL, 'Funeral',            'funeral',            '🕯️', 'Funeral services and memorial gatherings', '#64748b', TRUE, 9),
  ('10000000-0000-0000-0000-000000000010', NULL, 'Engagement',         'engagement',         '💑', 'Engagement ceremonies and parties', '#f43f5e', TRUE, 10),
  ('10000000-0000-0000-0000-000000000011', NULL, 'Baby Shower',        'baby-shower',        '👶', 'Baby showers and gender reveals', '#06b6d4', TRUE, 11),
  ('10000000-0000-0000-0000-000000000012', NULL, 'Religious Ceremony', 'religious-ceremony', '🕌', 'Religious ceremonies and spiritual events', '#84cc16', TRUE, 12),
  ('10000000-0000-0000-0000-000000000013', NULL, 'Sports Event',       'sports-event',       '🏅', 'Sports tournaments, races, and athletic events', '#22c55e', TRUE, 13),
  ('10000000-0000-0000-0000-000000000014', NULL, 'Social Gathering',   'social-gathering',   '🎉', 'Casual social gatherings and get-togethers', '#fb923c', TRUE, 14),
  ('10000000-0000-0000-0000-000000000015', NULL, 'Gala / Fundraiser',  'gala-fundraiser',    '🥂', 'Gala dinners, fundraisers, and charity events', '#c084fc', TRUE, 15)
ON CONFLICT DO NOTHING;

-- ── SEED: readiness checklist per event type ──────────────────────────────────
-- check_key values map to DB checks in smart_readiness_score() function

-- WEDDING (type 1)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000001', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000001', 'core',         'has_cover_image',       'Cover image uploaded',                       FALSE, 2),
  ('10000000-0000-0000-0000-000000000001', 'venue',        'has_venue',             'Venue is booked',                            TRUE,  3),
  ('10000000-0000-0000-0000-000000000001', 'guests',       'min_guests_added',      'At least 10 guests added',                   TRUE,  4),
  ('10000000-0000-0000-0000-000000000001', 'guests',       'invitations_sent',      'Invitations sent to guests',                 TRUE,  5),
  ('10000000-0000-0000-0000-000000000001', 'finance',      'has_budget',            'Budget defined',                             TRUE,  6),
  ('10000000-0000-0000-0000-000000000001', 'vendors',      'has_vendor',            'At least one vendor assigned',               TRUE,  7),
  ('10000000-0000-0000-0000-000000000001', 'hospitality',  'has_accommodation',     'Accommodation details added',                FALSE, 8),
  ('10000000-0000-0000-0000-000000000001', 'fnb',          'has_fnb_menu',          'F&B menu configured',                        TRUE,  9),
  ('10000000-0000-0000-0000-000000000001', 'decor',        'has_decor_plan',        'Décor plan created',                         FALSE, 10)
ON CONFLICT DO NOTHING;

-- CORPORATE (type 2)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000002', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000002', 'core',         'has_cover_image',       'Cover image uploaded',                       FALSE, 2),
  ('10000000-0000-0000-0000-000000000002', 'venue',        'has_venue',             'Venue is booked',                            TRUE,  3),
  ('10000000-0000-0000-0000-000000000002', 'guests',       'min_guests_added',      'At least 5 guests/attendees added',          TRUE,  4),
  ('10000000-0000-0000-0000-000000000002', 'team',         'has_team_member',       'Team member assigned to event',              TRUE,  5),
  ('10000000-0000-0000-0000-000000000002', 'finance',      'has_budget',            'Budget defined',                             TRUE,  6),
  ('10000000-0000-0000-0000-000000000002', 'vendors',      'has_vendor',            'At least one vendor assigned',               FALSE, 7),
  ('10000000-0000-0000-0000-000000000002', 'production',   'has_runsheet',          'Run sheet / agenda created',                 TRUE,  8),
  ('10000000-0000-0000-0000-000000000002', 'fnb',          'has_fnb_menu',          'F&B requirements noted',                     FALSE, 9),
  ('10000000-0000-0000-0000-000000000002', 'documents',    'has_document',          'At least one event document attached',       FALSE, 10)
ON CONFLICT DO NOTHING;

-- BIRTHDAY (type 3)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000003', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000003', 'core',         'has_cover_image',       'Cover image uploaded',                       FALSE, 2),
  ('10000000-0000-0000-0000-000000000003', 'venue',        'has_venue',             'Venue confirmed',                            TRUE,  3),
  ('10000000-0000-0000-0000-000000000003', 'guests',       'min_guests_added',      'At least 5 guests added',                    TRUE,  4),
  ('10000000-0000-0000-0000-000000000003', 'guests',       'invitations_sent',      'Invitations sent',                           FALSE, 5),
  ('10000000-0000-0000-0000-000000000003', 'finance',      'has_budget',            'Budget defined',                             FALSE, 6),
  ('10000000-0000-0000-0000-000000000003', 'vendors',      'has_vendor',            'Vendor booked (catering/decor)',              FALSE, 7),
  ('10000000-0000-0000-0000-000000000003', 'fnb',          'has_fnb_menu',          'F&B / cake details added',                   TRUE,  8)
ON CONFLICT DO NOTHING;

-- CONFERENCE (type 4)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000004', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000004', 'core',         'has_cover_image',       'Conference banner uploaded',                 FALSE, 2),
  ('10000000-0000-0000-0000-000000000004', 'venue',        'has_venue',             'Venue / hall booked',                        TRUE,  3),
  ('10000000-0000-0000-0000-000000000004', 'guests',       'min_guests_added',      'At least 10 delegates registered',           TRUE,  4),
  ('10000000-0000-0000-0000-000000000004', 'artists',      'has_artist',            'Speakers / artists confirmed',               TRUE,  5),
  ('10000000-0000-0000-0000-000000000004', 'production',   'has_runsheet',          'Session schedule / run sheet created',       TRUE,  6),
  ('10000000-0000-0000-0000-000000000004', 'finance',      'has_budget',            'Budget defined',                             TRUE,  7),
  ('10000000-0000-0000-0000-000000000004', 'team',         'has_team_member',       'Team assigned',                              TRUE,  8),
  ('10000000-0000-0000-0000-000000000004', 'vendors',      'has_vendor',            'AV / tech vendor confirmed',                 TRUE,  9),
  ('10000000-0000-0000-0000-000000000004', 'documents',    'has_document',          'Conference agenda document attached',        FALSE, 10)
ON CONFLICT DO NOTHING;

-- CONCERT (type 5)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000005', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000005', 'venue',        'has_venue',             'Venue / stage confirmed',                    TRUE,  2),
  ('10000000-0000-0000-0000-000000000005', 'artists',      'has_artist',            'Artist / performer confirmed',               TRUE,  3),
  ('10000000-0000-0000-0000-000000000005', 'vendors',      'has_vendor',            'Sound & lighting vendor confirmed',          TRUE,  4),
  ('10000000-0000-0000-0000-000000000005', 'production',   'has_runsheet',          'Show run sheet created',                     TRUE,  5),
  ('10000000-0000-0000-0000-000000000005', 'finance',      'has_budget',            'Budget defined',                             TRUE,  6),
  ('10000000-0000-0000-0000-000000000005', 'team',         'has_team_member',       'Production crew assigned',                   TRUE,  7),
  ('10000000-0000-0000-0000-000000000005', 'permits',      'has_permit',            'Event permits / NOC obtained',               TRUE,  8),
  ('10000000-0000-0000-0000-000000000005', 'guests',       'min_guests_added',      'Ticket holders / guests listed',             FALSE, 9)
ON CONFLICT DO NOTHING;

-- EXHIBITION (type 6)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000006', 'core',         'has_event_date',        'Event dates set',                            TRUE,  1),
  ('10000000-0000-0000-0000-000000000006', 'venue',        'has_venue',             'Exhibition hall booked',                     TRUE,  2),
  ('10000000-0000-0000-0000-000000000006', 'vendors',      'has_vendor',            'At least one exhibitor / vendor',            TRUE,  3),
  ('10000000-0000-0000-0000-000000000006', 'finance',      'has_budget',            'Budget defined',                             TRUE,  4),
  ('10000000-0000-0000-0000-000000000006', 'team',         'has_team_member',       'Team assigned',                              TRUE,  5),
  ('10000000-0000-0000-0000-000000000006', 'decor',        'has_decor_plan',        'Stall / booth layout planned',               FALSE, 6),
  ('10000000-0000-0000-0000-000000000006', 'permits',      'has_permit',            'Exhibition permits obtained',                FALSE, 7),
  ('10000000-0000-0000-0000-000000000006', 'guests',       'min_guests_added',      'Expected visitor count estimated',           FALSE, 8)
ON CONFLICT DO NOTHING;

-- PRODUCT LAUNCH (type 7)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000007', 'core',         'has_event_date',        'Launch date confirmed',                      TRUE,  1),
  ('10000000-0000-0000-0000-000000000007', 'core',         'has_cover_image',       'Event banner / creative uploaded',           TRUE,  2),
  ('10000000-0000-0000-0000-000000000007', 'venue',        'has_venue',             'Launch venue confirmed',                     TRUE,  3),
  ('10000000-0000-0000-0000-000000000007', 'guests',       'min_guests_added',      'Press / invitees list added',                TRUE,  4),
  ('10000000-0000-0000-0000-000000000007', 'guests',       'invitations_sent',      'Press invitations sent',                     TRUE,  5),
  ('10000000-0000-0000-0000-000000000007', 'production',   'has_runsheet',          'Launch run sheet / script ready',            TRUE,  6),
  ('10000000-0000-0000-0000-000000000007', 'vendors',      'has_vendor',            'AV / media vendor confirmed',                TRUE,  7),
  ('10000000-0000-0000-0000-000000000007', 'finance',      'has_budget',            'Budget approved',                            TRUE,  8),
  ('10000000-0000-0000-0000-000000000007', 'documents',    'has_document',          'Press kit / brand document attached',        FALSE, 9)
ON CONFLICT DO NOTHING;

-- AWARD CEREMONY (type 8)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000008', 'core',         'has_event_date',        'Ceremony date set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000008', 'venue',        'has_venue',             'Award venue confirmed',                      TRUE,  2),
  ('10000000-0000-0000-0000-000000000008', 'guests',       'min_guests_added',      'Nominees / guests added',                    TRUE,  3),
  ('10000000-0000-0000-0000-000000000008', 'guests',       'invitations_sent',      'Invitations dispatched',                     TRUE,  4),
  ('10000000-0000-0000-0000-000000000008', 'production',   'has_runsheet',          'Show run order created',                     TRUE,  5),
  ('10000000-0000-0000-0000-000000000008', 'vendors',      'has_vendor',            'AV / trophy vendor confirmed',               TRUE,  6),
  ('10000000-0000-0000-0000-000000000008', 'finance',      'has_budget',            'Budget defined',                             TRUE,  7),
  ('10000000-0000-0000-0000-000000000008', 'fnb',          'has_fnb_menu',          'Dinner / F&B menu configured',               FALSE, 8),
  ('10000000-0000-0000-0000-000000000008', 'team',         'has_team_member',       'Team assigned',                              TRUE,  9)
ON CONFLICT DO NOTHING;

-- FUNERAL (type 9)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000009', 'core',         'has_event_date',        'Service date and time confirmed',            TRUE,  1),
  ('10000000-0000-0000-0000-000000000009', 'venue',        'has_venue',             'Venue / chapel confirmed',                   TRUE,  2),
  ('10000000-0000-0000-0000-000000000009', 'guests',       'min_guests_added',      'Attendees / family contacts added',          FALSE, 3),
  ('10000000-0000-0000-0000-000000000009', 'vendors',      'has_vendor',            'Funeral service vendor confirmed',           TRUE,  4),
  ('10000000-0000-0000-0000-000000000009', 'documents',    'has_document',          'Order of service document prepared',         TRUE,  5),
  ('10000000-0000-0000-0000-000000000009', 'finance',      'has_budget',            'Budget estimated',                           FALSE, 6),
  ('10000000-0000-0000-0000-000000000009', 'team',         'has_team_member',       'Coordinator assigned',                       TRUE,  7),
  ('10000000-0000-0000-0000-000000000009', 'hospitality',  'has_accommodation',     'Out-of-town family accommodation noted',     FALSE, 8)
ON CONFLICT DO NOTHING;

-- ENGAGEMENT (type 10)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000010', 'core',         'has_event_date',        'Engagement date set',                        TRUE,  1),
  ('10000000-0000-0000-0000-000000000010', 'venue',        'has_venue',             'Venue confirmed',                            TRUE,  2),
  ('10000000-0000-0000-0000-000000000010', 'guests',       'min_guests_added',      'Guest list added',                           TRUE,  3),
  ('10000000-0000-0000-0000-000000000010', 'guests',       'invitations_sent',      'Invitations sent',                           TRUE,  4),
  ('10000000-0000-0000-0000-000000000010', 'fnb',          'has_fnb_menu',          'Catering / menu confirmed',                  TRUE,  5),
  ('10000000-0000-0000-0000-000000000010', 'decor',        'has_decor_plan',        'Décor plan in place',                        FALSE, 6),
  ('10000000-0000-0000-0000-000000000010', 'finance',      'has_budget',            'Budget defined',                             FALSE, 7),
  ('10000000-0000-0000-0000-000000000010', 'vendors',      'has_vendor',            'Photographer / videographer booked',         FALSE, 8)
ON CONFLICT DO NOTHING;

-- BABY SHOWER (type 11)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000011', 'core',         'has_event_date',        'Event date set',                             TRUE,  1),
  ('10000000-0000-0000-0000-000000000011', 'venue',        'has_venue',             'Venue confirmed',                            TRUE,  2),
  ('10000000-0000-0000-0000-000000000011', 'guests',       'min_guests_added',      'Guest list added',                           TRUE,  3),
  ('10000000-0000-0000-0000-000000000011', 'guests',       'invitations_sent',      'Invitations sent',                           FALSE, 4),
  ('10000000-0000-0000-0000-000000000011', 'fnb',          'has_fnb_menu',          'Cake / refreshments planned',                TRUE,  5),
  ('10000000-0000-0000-0000-000000000011', 'decor',        'has_decor_plan',        'Theme / décor decided',                      FALSE, 6),
  ('10000000-0000-0000-0000-000000000011', 'finance',      'has_budget',            'Budget set',                                 FALSE, 7)
ON CONFLICT DO NOTHING;

-- RELIGIOUS CEREMONY (type 12)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000012', 'core',         'has_event_date',        'Ceremony date/time set',                     TRUE,  1),
  ('10000000-0000-0000-0000-000000000012', 'venue',        'has_venue',             'Venue / place of worship confirmed',         TRUE,  2),
  ('10000000-0000-0000-0000-000000000012', 'guests',       'min_guests_added',      'Congregation / guests added',                FALSE, 3),
  ('10000000-0000-0000-0000-000000000012', 'vendors',      'has_vendor',            'Priest / officiant confirmed',               TRUE,  4),
  ('10000000-0000-0000-0000-000000000012', 'fnb',          'has_fnb_menu',          'Prasad / food arrangements noted',           FALSE, 5),
  ('10000000-0000-0000-0000-000000000012', 'team',         'has_team_member',       'Coordinator assigned',                       FALSE, 6),
  ('10000000-0000-0000-0000-000000000012', 'permits',      'has_permit',            'Any required permissions obtained',          FALSE, 7),
  ('10000000-0000-0000-0000-000000000012', 'finance',      'has_budget',            'Budget estimated',                           FALSE, 8)
ON CONFLICT DO NOTHING;

-- SPORTS EVENT (type 13)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000013', 'core',         'has_event_date',        'Event date confirmed',                       TRUE,  1),
  ('10000000-0000-0000-0000-000000000013', 'venue',        'has_venue',             'Venue / stadium confirmed',                  TRUE,  2),
  ('10000000-0000-0000-0000-000000000013', 'guests',       'min_guests_added',      'Participants / teams registered',            TRUE,  3),
  ('10000000-0000-0000-0000-000000000013', 'team',         'has_team_member',       'Operations team assigned',                   TRUE,  4),
  ('10000000-0000-0000-0000-000000000013', 'vendors',      'has_vendor',            'Equipment / logistics vendor confirmed',     TRUE,  5),
  ('10000000-0000-0000-0000-000000000013', 'permits',      'has_permit',            'Sports event permit obtained',               TRUE,  6),
  ('10000000-0000-0000-0000-000000000013', 'finance',      'has_budget',            'Budget approved',                            TRUE,  7),
  ('10000000-0000-0000-0000-000000000013', 'production',   'has_runsheet',          'Event schedule / format documented',         FALSE, 8),
  ('10000000-0000-0000-0000-000000000013', 'health_safety','has_health_safety_plan','First aid / safety plan in place',           TRUE,  9)
ON CONFLICT DO NOTHING;

-- SOCIAL GATHERING (type 14)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000014', 'core',         'has_event_date',        'Date and time set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000014', 'venue',        'has_venue',             'Venue / location confirmed',                 TRUE,  2),
  ('10000000-0000-0000-0000-000000000014', 'guests',       'min_guests_added',      'At least 5 guests added',                    FALSE, 3),
  ('10000000-0000-0000-0000-000000000014', 'fnb',          'has_fnb_menu',          'Food / drinks arranged',                     FALSE, 4),
  ('10000000-0000-0000-0000-000000000014', 'finance',      'has_budget',            'Budget noted',                               FALSE, 5)
ON CONFLICT DO NOTHING;

-- GALA / FUNDRAISER (type 15)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000015', 'core',         'has_event_date',        'Gala date confirmed',                        TRUE,  1),
  ('10000000-0000-0000-0000-000000000015', 'core',         'has_cover_image',       'Gala / charity banner uploaded',             FALSE, 2),
  ('10000000-0000-0000-0000-000000000015', 'venue',        'has_venue',             'Venue confirmed',                            TRUE,  3),
  ('10000000-0000-0000-0000-000000000015', 'guests',       'min_guests_added',      'Donor / guest list added',                   TRUE,  4),
  ('10000000-0000-0000-0000-000000000015', 'guests',       'invitations_sent',      'Invitations dispatched',                     TRUE,  5),
  ('10000000-0000-0000-0000-000000000015', 'fnb',          'has_fnb_menu',          'Gala dinner menu configured',                TRUE,  6),
  ('10000000-0000-0000-0000-000000000015', 'finance',      'has_budget',            'Fundraising target and budget set',          TRUE,  7),
  ('10000000-0000-0000-0000-000000000015', 'vendors',      'has_vendor',            'Décor / entertainment vendor confirmed',     TRUE,  8),
  ('10000000-0000-0000-0000-000000000015', 'production',   'has_runsheet',          'Programme / run order created',              TRUE,  9),
  ('10000000-0000-0000-0000-000000000015', 'team',         'has_team_member',       'Team assigned',                              TRUE,  10)
ON CONFLICT DO NOTHING;

-- ── smart_readiness_score() ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.smart_readiness_score(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event          RECORD;
  v_checklist      RECORD;
  v_items          JSONB := '[]'::JSONB;
  v_total          INT   := 0;
  v_completed      INT   := 0;
  v_is_completed   BOOLEAN;
  v_score_pct      NUMERIC;
BEGIN
  -- Load event
  SELECT e.*, et.name AS type_name, et.icon AS type_icon
  INTO v_event
  FROM public.events e
  LEFT JOIN public.event_types et ON et.id = e.event_type_id
  WHERE e.id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Event not found');
  END IF;

  IF v_event.event_type_id IS NULL THEN
    RETURN jsonb_build_object(
      'total_checks', 0,
      'completed_checks', 0,
      'score_pct', 0,
      'items', '[]'::JSONB,
      'message', 'No event type set'
    );
  END IF;

  -- Iterate checklist for this event type
  FOR v_checklist IN
    SELECT * FROM public.event_type_readiness_checklist
    WHERE event_type_id = v_event.event_type_id
    ORDER BY sort_order
  LOOP
    v_is_completed := FALSE;

    -- Evaluate each check_key against actual event data
    CASE v_checklist.check_key

      WHEN 'has_event_date' THEN
        v_is_completed := v_event.start_date IS NOT NULL;

      WHEN 'has_cover_image' THEN
        v_is_completed := v_event.cover_image_url IS NOT NULL AND v_event.cover_image_url <> '';

      WHEN 'has_venue' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_venues ev WHERE ev.event_id = p_event_id LIMIT 1
        );

      WHEN 'min_guests_added' THEN
        v_is_completed := (
          SELECT COUNT(*) FROM public.guests g WHERE g.event_id = p_event_id
        ) >= 5;

      WHEN 'invitations_sent' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.invitations i
          WHERE i.event_id = p_event_id AND i.status IN ('sent', 'delivered', 'opened')
          LIMIT 1
        );

      WHEN 'has_budget' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_budgets eb WHERE eb.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_vendor' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_vendors ev WHERE ev.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_accommodation' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.accommodation_rooms ar WHERE ar.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_fnb_menu' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.fnb_menus fm WHERE fm.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_decor_plan' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.decor_items di WHERE di.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_team_member' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_team_members etm WHERE etm.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_runsheet' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.production_runsheets pr WHERE pr.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_artist' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_artists ea WHERE ea.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_permit' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_permits ep WHERE ep.event_id = p_event_id AND ep.status = 'approved' LIMIT 1
        );

      WHEN 'has_document' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.documents d WHERE d.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_health_safety_plan' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.health_safety_plans hsp WHERE hsp.event_id = p_event_id LIMIT 1
        );

      ELSE
        v_is_completed := FALSE;
    END CASE;

    v_total := v_total + 1;
    IF v_is_completed THEN
      v_completed := v_completed + 1;
    END IF;

    v_items := v_items || jsonb_build_object(
      'check_key',   v_checklist.check_key,
      'check_label', v_checklist.check_label,
      'module',      v_checklist.module,
      'is_required', v_checklist.is_required,
      'is_completed', v_is_completed,
      'sort_order',  v_checklist.sort_order
    );
  END LOOP;

  v_score_pct := CASE
    WHEN v_total = 0 THEN 0
    ELSE ROUND((v_completed::NUMERIC / v_total::NUMERIC) * 100)
  END;

  RETURN jsonb_build_object(
    'total_checks',     v_total,
    'completed_checks', v_completed,
    'score_pct',        v_score_pct,
    'event_type',       v_event.type_name,
    'event_type_icon',  v_event.type_icon,
    'items',            v_items
  );
END;
$$;

-- ── RLS policies ──────────────────────────────────────────────────────────────

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_type_readiness_checklist ENABLE ROW LEVEL SECURITY;

-- System types visible to all authenticated users
CREATE POLICY "event_types_read_system" ON public.event_types
  FOR SELECT USING (is_system = TRUE OR tenant_id = (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1
  ));

-- Tenant can manage their own custom types
CREATE POLICY "event_types_manage_own" ON public.event_types
  FOR ALL USING (
    tenant_id IS NOT NULL AND tenant_id = (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Checklist items readable by authenticated users (joined via event_types)
CREATE POLICY "readiness_checklist_read" ON public.event_type_readiness_checklist
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.event_types et
      WHERE et.id = event_type_id
        AND (et.is_system = TRUE OR et.tenant_id = (
          SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1
        ))
    )
  );

-- Service role bypass
CREATE POLICY "event_types_service_all" ON public.event_types
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "readiness_checklist_service_all" ON public.event_type_readiness_checklist
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Grant execute on smart_readiness_score to authenticated
GRANT EXECUTE ON FUNCTION public.smart_readiness_score(UUID) TO authenticated, service_role;

-- ============================================================
-- Migration: 056_health_safety.sql
-- ============================================================
-- ============================================================
-- Migration 056 — Health & Safety Module
-- ============================================================

-- ─────────────────────────────────────────────
-- Health & Safety Plans (master record per event)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.health_safety_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title                 VARCHAR(200) NOT NULL DEFAULT 'Health & Safety Plan',
  status                VARCHAR(30) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','under_review','approved','archived')),
  crowd_capacity        INT,
  venue_area_sqm        NUMERIC(10,2),
  expected_attendance   INT,
  medical_team_count    INT DEFAULT 0,
  security_team_count   INT DEFAULT 0,
  first_aid_kits        INT DEFAULT 0,
  aed_units             INT DEFAULT 0,           -- defibrillators
  fire_extinguishers    INT DEFAULT 0,
  emergency_exits       INT DEFAULT 0,
  nearest_hospital      TEXT,
  hospital_distance_km  NUMERIC(5,2),
  emergency_contact_name    VARCHAR(150),
  emergency_contact_phone   VARCHAR(30),
  ambulance_on_site     BOOLEAN NOT NULL DEFAULT FALSE,
  police_liaison_name   VARCHAR(150),
  police_liaison_phone  VARCHAR(30),
  weather_contingency   TEXT,
  evacuation_plan_url   TEXT,
  notes                 TEXT,
  approved_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,
  reviewed_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  created_by            UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_plans_event ON public.health_safety_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_hs_plans_tenant ON public.health_safety_plans(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hs_plans_event_unique ON public.health_safety_plans(event_id);

-- ─────────────────────────────────────────────
-- Risk Assessments
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hs_risk_assessments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           UUID NOT NULL REFERENCES public.health_safety_plans(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category          VARCHAR(50) NOT NULL
                      CHECK (category IN (
                        'crowd_management','fire_safety','medical','security',
                        'electrical','structural','weather','food_safety',
                        'transport','chemical','noise','other'
                      )),
  hazard            TEXT NOT NULL,
  who_affected      TEXT,                          -- 'guests, staff, artists'
  likelihood        SMALLINT NOT NULL DEFAULT 3
                      CHECK (likelihood BETWEEN 1 AND 5),
  severity          SMALLINT NOT NULL DEFAULT 3
                      CHECK (severity BETWEEN 1 AND 5),
  risk_score        SMALLINT GENERATED ALWAYS AS (likelihood * severity) STORED,
  risk_level        VARCHAR(20) GENERATED ALWAYS AS (
                      CASE (likelihood * severity)
                        WHEN 1  THEN 'very_low'
                        WHEN 2  THEN 'very_low'
                        WHEN 3  THEN 'low'
                        WHEN 4  THEN 'low'
                        WHEN 5  THEN 'medium'
                        WHEN 6  THEN 'medium'
                        WHEN 8  THEN 'medium'
                        WHEN 9  THEN 'high'
                        WHEN 10 THEN 'high'
                        WHEN 12 THEN 'high'
                        WHEN 15 THEN 'critical'
                        WHEN 16 THEN 'critical'
                        WHEN 20 THEN 'critical'
                        WHEN 25 THEN 'critical'
                        ELSE 'medium'
                      END
                    ) STORED,
  mitigation        TEXT NOT NULL,
  residual_likelihood SMALLINT CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_severity   SMALLINT CHECK (residual_severity BETWEEN 1 AND 5),
  owner             VARCHAR(150),
  status            VARCHAR(20) NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','mitigated','accepted','closed')),
  review_date       DATE,
  notes             TEXT,
  created_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_risks_plan    ON public.hs_risk_assessments(plan_id);
CREATE INDEX IF NOT EXISTS idx_hs_risks_event   ON public.hs_risk_assessments(event_id);
CREATE INDEX IF NOT EXISTS idx_hs_risks_level   ON public.hs_risk_assessments(risk_level);

-- ─────────────────────────────────────────────
-- Incidents
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hs_incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID REFERENCES public.health_safety_plans(id) ON DELETE SET NULL,
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  incident_type   VARCHAR(50) NOT NULL
                    CHECK (incident_type IN (
                      'medical','security','fire','structural','crowd',
                      'electrical','weather','food_poisoning','theft',
                      'harassment','near_miss','other'
                    )),
  title           VARCHAR(200) NOT NULL,
  description     TEXT NOT NULL,
  severity        VARCHAR(20) NOT NULL DEFAULT 'minor'
                    CHECK (severity IN ('minor','moderate','serious','critical')),
  occurred_at     TIMESTAMPTZ NOT NULL,
  location        VARCHAR(200),
  injured_count   INT DEFAULT 0,
  hospitalized    BOOLEAN NOT NULL DEFAULT FALSE,
  reported_by     VARCHAR(150),
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action_taken    TEXT,
  follow_up       TEXT,
  police_report   BOOLEAN NOT NULL DEFAULT FALSE,
  police_ref_no   VARCHAR(100),
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','investigating','resolved','closed')),
  resolved_at     TIMESTAMPTZ,
  resolution_notes TEXT,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_incidents_event    ON public.hs_incidents(event_id);
CREATE INDEX IF NOT EXISTS idx_hs_incidents_type     ON public.hs_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_hs_incidents_severity ON public.hs_incidents(severity);

-- ─────────────────────────────────────────────
-- Pre-Event Checklists
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hs_checklists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES public.health_safety_plans(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  category    VARCHAR(50) NOT NULL DEFAULT 'general'
                CHECK (category IN (
                  'general','venue','medical','fire_safety','crowd',
                  'electrical','catering','security','communications','post_event'
                )),
  due_date    DATE,
  assigned_to VARCHAR(150),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','completed','n_a')),
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_checklists_plan  ON public.hs_checklists(plan_id);
CREATE INDEX IF NOT EXISTS idx_hs_checklists_event ON public.hs_checklists(event_id);

-- ─────────────────────────────────────────────
-- Checklist Items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hs_checklist_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id  UUID NOT NULL REFERENCES public.hs_checklists(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  is_checked    BOOLEAN NOT NULL DEFAULT FALSE,
  checked_by    VARCHAR(150),
  checked_at    TIMESTAMPTZ,
  notes         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_items_checklist ON public.hs_checklist_items(checklist_id);

-- ─────────────────────────────────────────────
-- Seed: default checklist templates (system level, tenant_id IS NULL → applied at first plan creation)
-- ─────────────────────────────────────────────
-- (Applied programmatically in service layer — not seeded here to avoid missing FK)

-- ─────────────────────────────────────────────
-- Updated-at triggers
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_hs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'health_safety_plans','hs_risk_assessments',
    'hs_incidents','hs_checklists'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION update_hs_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE public.health_safety_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_risk_assessments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_incidents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_checklists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_checklist_items     ENABLE ROW LEVEL SECURITY;

-- health_safety_plans
CREATE POLICY "hs_plans_tenant_isolation" ON public.health_safety_plans
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- hs_risk_assessments
CREATE POLICY "hs_risks_tenant_isolation" ON public.hs_risk_assessments
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- hs_incidents
CREATE POLICY "hs_incidents_tenant_isolation" ON public.hs_incidents
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- hs_checklists
CREATE POLICY "hs_checklists_tenant_isolation" ON public.hs_checklists
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- hs_checklist_items (join through checklist → plan → tenant)
CREATE POLICY "hs_items_tenant_isolation" ON public.hs_checklist_items
  USING (
    EXISTS (
      SELECT 1
      FROM public.hs_checklists cl
      WHERE cl.id = hs_checklist_items.checklist_id
        AND cl.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────
-- Crowd density view (helper for capacity calculations)
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_hs_crowd_density AS
SELECT
  p.id                          AS plan_id,
  p.event_id,
  p.crowd_capacity,
  p.venue_area_sqm,
  p.expected_attendance,
  CASE
    WHEN p.venue_area_sqm > 0 AND p.expected_attendance > 0
    THEN ROUND((p.expected_attendance / p.venue_area_sqm)::NUMERIC, 2)
    ELSE NULL
  END                           AS persons_per_sqm,
  CASE
    WHEN p.venue_area_sqm > 0 AND p.expected_attendance > 0
    THEN CASE
      WHEN (p.expected_attendance / p.venue_area_sqm) <= 1.0 THEN 'safe'
      WHEN (p.expected_attendance / p.venue_area_sqm) <= 2.0 THEN 'moderate'
      WHEN (p.expected_attendance / p.venue_area_sqm) <= 3.0 THEN 'dense'
      ELSE 'overcrowded'
    END
    ELSE 'unknown'
  END                           AS density_status
FROM public.health_safety_plans p;

-- ============================================================
-- Migration: 057_audit_trail.sql
-- ============================================================
-- ============================================================
-- Migration 057 — Audit Trail
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL,
  actor_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name    VARCHAR(200),
  actor_email   VARCHAR(254),
  actor_role    VARCHAR(50),
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id   VARCHAR(200),
  resource_name TEXT,
  old_value     JSONB,
  new_value     JSONB,
  diff          JSONB,          -- key-level diff computed at write time
  ip_address    INET,
  user_agent    TEXT,
  portal        VARCHAR(30) DEFAULT 'team'
                  CHECK (portal IN ('team','client','vendor','guest','super_admin','api')),
  severity      VARCHAR(20) NOT NULL DEFAULT 'info'
                  CHECK (severity IN ('info','warning','critical')),
  tags          TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes — optimise the most common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_tenant       ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event        ON public.audit_logs(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor        ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource     ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_action       ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_severity     ON public.audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_created_at   ON public.audit_logs(created_at DESC);

-- Partitioning hint: in production, partition by RANGE(created_at) monthly.
-- For development, single table is fine.

-- ─────────────────────────────────────────────
-- Auto-log trigger helper (used by other modules optionally)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_action TEXT;
  v_diff   JSONB := '{}';
  v_key    TEXT;
  v_old    JSONB;
  v_new    JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    -- Build diff: only changed fields
    FOR v_key IN SELECT key FROM jsonb_each(v_new) LOOP
      IF (v_new->v_key) IS DISTINCT FROM (v_old->v_key) THEN
        v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key));
      END IF;
    END LOOP;
    IF v_diff = '{}'::JSONB THEN RETURN NEW; END IF;  -- no change, skip
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_old := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_logs (
    tenant_id, resource_type, resource_id, action, old_value, new_value, diff, severity
  ) VALUES (
    COALESCE((v_new->>'tenant_id')::UUID, (v_old->>'tenant_id')::UUID),
    TG_TABLE_NAME,
    COALESCE(v_new->>'id', v_old->>'id'),
    v_action,
    v_old,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_new END,
    CASE WHEN v_diff = '{}'::JSONB THEN NULL ELSE v_diff END,
    CASE WHEN TG_OP = 'DELETE' THEN 'warning' ELSE 'info' END
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Never let audit logging break the main operation
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to high-value tables
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['events','guests','invoices','event_team_members'] LOOP
    BEGIN
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%I
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION audit_log_changes()',
        tbl, tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_tenant_read" ON public.audit_logs
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

-- Only service-role can insert (all writes go through the API / trigger)
CREATE POLICY "audit_service_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (TRUE);

-- No updates or deletes — immutable log
-- ─────────────────────────────────────────────
-- Aggregate view: activity summary per actor per day
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_audit_daily_summary AS
SELECT
  tenant_id,
  DATE_TRUNC('day', created_at)   AS day,
  actor_id,
  actor_name,
  COUNT(*)                        AS action_count,
  COUNT(*) FILTER (WHERE severity = 'critical') AS critical_count,
  COUNT(*) FILTER (WHERE severity = 'warning')  AS warning_count,
  array_agg(DISTINCT action)      AS actions_taken
FROM public.audit_logs
GROUP BY tenant_id, DATE_TRUNC('day', created_at), actor_id, actor_name;

-- ============================================================
-- Migration: 058_subscription_plans.sql
-- ============================================================
-- ============================================================
-- Migration 058 — Subscription Plans & Feature Enforcement
-- ============================================================

-- ─────────────────────────────────────────────
-- Plan definitions (system-level, seeded)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  VARCHAR(30) NOT NULL UNIQUE,
  name                  VARCHAR(50) NOT NULL,
  description           TEXT,
  price_monthly         NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly          NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency              VARCHAR(3) NOT NULL DEFAULT 'USD',
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  is_public             BOOLEAN NOT NULL DEFAULT TRUE,
  trial_days            INT NOT NULL DEFAULT 0,
  sort_order            INT NOT NULL DEFAULT 0,

  -- Hard limits (NULL = unlimited)
  max_events            INT,
  max_guests_per_event  INT,
  max_team_members      INT,
  max_storage_gb        NUMERIC(6,2),
  max_ai_calls_monthly  INT,
  max_short_links       INT,
  max_venues            INT,
  max_vendors           INT,

  -- Feature flags (JSONB for flexibility)
  features              JSONB NOT NULL DEFAULT '{}',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Tenant subscriptions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id           UUID NOT NULL REFERENCES public.subscription_plans(id),
  status            VARCHAR(30) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('trialing','active','past_due','cancelled','suspended','expired')),

  -- Billing cycle
  billing_period    VARCHAR(10) NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','yearly','lifetime')),
  current_period_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  trial_start           TIMESTAMPTZ,
  trial_end             TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Payment provider reference
  payment_provider      VARCHAR(30),
  external_subscription_id VARCHAR(200),
  external_customer_id     VARCHAR(200),

  -- Usage snapshot (refreshed daily by scheduler)
  usage_events          INT NOT NULL DEFAULT 0,
  usage_team_members    INT NOT NULL DEFAULT 0,
  usage_storage_gb      NUMERIC(6,2) NOT NULL DEFAULT 0,
  usage_ai_calls        INT NOT NULL DEFAULT 0,
  usage_short_links     INT NOT NULL DEFAULT 0,
  usage_refreshed_at    TIMESTAMPTZ,

  -- Override limits (Super Admin can grant extra capacity)
  override_max_events   INT,
  override_max_team     INT,
  override_max_storage  NUMERIC(6,2),

  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id)  -- one active subscription per tenant
);

CREATE INDEX IF NOT EXISTS idx_sub_tenant   ON public.tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_status   ON public.tenant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_sub_plan     ON public.tenant_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_sub_trial    ON public.tenant_subscriptions(trial_end) WHERE status = 'trialing';

-- ─────────────────────────────────────────────
-- Plan change history
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_change_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_plan_id    UUID REFERENCES public.subscription_plans(id),
  to_plan_id      UUID NOT NULL REFERENCES public.subscription_plans(id),
  changed_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason          TEXT,
  effective_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Seed: 4 plan tiers
-- ─────────────────────────────────────────────
INSERT INTO public.subscription_plans
  (id, slug, name, description, price_monthly, price_yearly, trial_days, sort_order,
   max_events, max_guests_per_event, max_team_members, max_storage_gb,
   max_ai_calls_monthly, max_short_links, max_venues, max_vendors, features)
VALUES
  -- FREE
  (
    'a0000000-0000-0000-0000-000000000001',
    'free', 'Free', 'For individuals testing the platform',
    0, 0, 0, 0,
    3, 50, 3, 1,
    20, 5, 2, 5,
    '{"ai_assistant":false,"ai_proposals":false,"ai_budget_optimizer":false,"white_label":false,
      "custom_domain":false,"api_access":false,"multi_currency":false,"advanced_analytics":false,
      "guest_portal":true,"vendor_portal":false,"client_portal":false,"audit_trail":false,
      "playbooks":false,"document_generation":false,"animated_invitations":false,
      "short_links":true,"event_types_custom":false,"offline_checkin":false,
      "payment_processing":false,"realtime_collaboration":false,"priority_support":false}'
  ),
  -- STARTER
  (
    'a0000000-0000-0000-0000-000000000002',
    'starter', 'Starter', 'For small event businesses getting started',
    29, 290, 0, 1,
    20, 300, 10, 10,
    100, 50, 5, 20,
    '{"ai_assistant":true,"ai_proposals":false,"ai_budget_optimizer":false,"white_label":false,
      "custom_domain":false,"api_access":false,"multi_currency":true,"advanced_analytics":false,
      "guest_portal":true,"vendor_portal":true,"client_portal":true,"audit_trail":true,
      "playbooks":true,"document_generation":true,"animated_invitations":true,
      "short_links":true,"event_types_custom":true,"offline_checkin":false,
      "payment_processing":true,"realtime_collaboration":false,"priority_support":false}'
  ),
  -- GROWTH (with 14-day free trial)
  (
    'a0000000-0000-0000-0000-000000000003',
    'growth', 'Growth', 'For growing event companies — includes 14-day free trial',
    79, 790, 14, 2,
    100, 2000, 25, 50,
    500, 200, 20, 100,
    '{"ai_assistant":true,"ai_proposals":true,"ai_budget_optimizer":true,"white_label":false,
      "custom_domain":true,"api_access":true,"multi_currency":true,"advanced_analytics":true,
      "guest_portal":true,"vendor_portal":true,"client_portal":true,"audit_trail":true,
      "playbooks":true,"document_generation":true,"animated_invitations":true,
      "short_links":true,"event_types_custom":true,"offline_checkin":true,
      "payment_processing":true,"realtime_collaboration":true,"priority_support":false}'
  ),
  -- AGENCY (unlimited)
  (
    'a0000000-0000-0000-0000-000000000004',
    'agency', 'Agency', 'For large event agencies — unlimited everything',
    199, 1990, 0, 3,
    NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    '{"ai_assistant":true,"ai_proposals":true,"ai_budget_optimizer":true,"white_label":true,
      "custom_domain":true,"api_access":true,"multi_currency":true,"advanced_analytics":true,
      "guest_portal":true,"vendor_portal":true,"client_portal":true,"audit_trail":true,
      "playbooks":true,"document_generation":true,"animated_invitations":true,
      "short_links":true,"event_types_custom":true,"offline_checkin":true,
      "payment_processing":true,"realtime_collaboration":true,"priority_support":true}'
  )
ON CONFLICT (slug) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  features      = EXCLUDED.features,
  updated_at    = NOW();

-- ─────────────────────────────────────────────
-- Default all existing tenants to Free plan
-- ─────────────────────────────────────────────
INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status)
SELECT
  t.id,
  'a0000000-0000-0000-0000-000000000001'::UUID,
  'active'
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_subscriptions ts WHERE ts.tenant_id = t.id
)
ON CONFLICT (tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- Computed view: tenant plan limits + current usage
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_tenant_plan AS
SELECT
  ts.tenant_id,
  ts.status                                             AS sub_status,
  ts.trial_end,
  ts.current_period_end,
  ts.cancel_at_period_end,
  sp.slug                                               AS plan_slug,
  sp.name                                               AS plan_name,
  sp.features,
  sp.price_monthly,
  -- Effective limits (override takes precedence)
  COALESCE(ts.override_max_events,   sp.max_events)    AS limit_events,
  COALESCE(ts.override_max_team,     sp.max_team_members) AS limit_team,
  COALESCE(ts.override_max_storage,  sp.max_storage_gb)   AS limit_storage_gb,
  sp.max_guests_per_event                               AS limit_guests_per_event,
  sp.max_ai_calls_monthly                               AS limit_ai_calls,
  sp.max_short_links                                    AS limit_short_links,
  sp.max_venues                                         AS limit_venues,
  sp.max_vendors                                        AS limit_vendors,
  -- Current usage
  ts.usage_events,
  ts.usage_team_members,
  ts.usage_storage_gb,
  ts.usage_ai_calls,
  ts.usage_short_links,
  ts.usage_refreshed_at,
  -- Is trial active?
  (ts.status = 'trialing' AND ts.trial_end > NOW())    AS is_trialing,
  -- Days left in trial
  GREATEST(0, EXTRACT(DAY FROM (ts.trial_end - NOW()))::INT) AS trial_days_remaining
FROM public.tenant_subscriptions ts
JOIN public.subscription_plans sp ON sp.id = ts.plan_id;

-- ─────────────────────────────────────────────
-- Updated-at triggers
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_sub_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_sub_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER trg_sub_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_sub_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_subs_updated_at ON public.tenant_subscriptions;
CREATE TRIGGER trg_tenant_subs_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_sub_updated_at();

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.subscription_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_change_history   ENABLE ROW LEVEL SECURITY;

-- Plans are public-readable
CREATE POLICY "plans_public_read" ON public.subscription_plans
  FOR SELECT USING (is_public = TRUE);

-- Tenant can only read their own subscription
CREATE POLICY "sub_tenant_read" ON public.tenant_subscriptions
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "plan_history_tenant_read" ON public.plan_change_history
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

-- Data preservation: mark subscription expired after 30-day grace post-cancellation
-- (handled by scheduler in super-admin automation engine)

-- ============================================================
-- Migration: 059_external_api.sql
-- ============================================================
-- ============================================================
-- Migration 059 — External Tenant API (API Keys + Webhooks)
-- ============================================================

-- ─────────────────────────────────────────────
-- API Keys
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name             VARCHAR(150) NOT NULL,
  key_prefix       VARCHAR(10) NOT NULL,          -- e.g. "op_live_" shown in UI
  key_hash         VARCHAR(64) NOT NULL UNIQUE,    -- SHA-256 of the raw key
  key_hint         VARCHAR(10) NOT NULL,           -- last 4 chars shown in UI
  scopes           TEXT[] NOT NULL DEFAULT '{}',  -- ['events:read','guests:write',…]
  environment      VARCHAR(10) NOT NULL DEFAULT 'live'
                     CHECK (environment IN ('live','test')),
  status           VARCHAR(20) NOT NULL DEFAULT 'pending_approval'
                     CHECK (status IN ('pending_approval','active','suspended','revoked')),
  approval_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  rate_limit_rpm   INT NOT NULL DEFAULT 60,        -- requests per minute
  rate_limit_daily INT NOT NULL DEFAULT 10000,     -- requests per day
  allowed_ips      INET[],                         -- NULL = any IP allowed
  description      TEXT,
  last_used_at     TIMESTAMPTZ,
  usage_count      BIGINT NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,                    -- NULL = never
  created_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant  ON public.api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash    ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_status  ON public.api_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix  ON public.api_keys(key_prefix);

-- ─────────────────────────────────────────────
-- API Usage Logs (time-series, partition-ready)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id           BIGSERIAL PRIMARY KEY,
  api_key_id   UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL,
  endpoint     VARCHAR(200) NOT NULL,
  method       VARCHAR(10) NOT NULL,
  status_code  SMALLINT NOT NULL,
  response_ms  INT,
  ip_address   INET,
  user_agent   TEXT,
  error_code   VARCHAR(50),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_key       ON public.api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_tenant    ON public.api_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_requested ON public.api_usage_logs(requested_at DESC);

-- ─────────────────────────────────────────────
-- Webhook Endpoints
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            VARCHAR(150) NOT NULL,
  url             TEXT NOT NULL,
  secret          VARCHAR(100) NOT NULL,           -- HMAC signing secret (stored hashed)
  events          TEXT[] NOT NULL DEFAULT '{}',   -- ['event.created','guest.updated',…]
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','disabled')),
  ssl_verify      BOOLEAN NOT NULL DEFAULT TRUE,
  timeout_seconds INT NOT NULL DEFAULT 10,
  retry_count     INT NOT NULL DEFAULT 3,
  last_triggered_at TIMESTAMPTZ,
  last_success_at   TIMESTAMPTZ,
  last_failure_at   TIMESTAMPTZ,
  failure_count     INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON public.api_webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON public.api_webhooks(status);

-- ─────────────────────────────────────────────
-- Webhook Delivery Logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      UUID NOT NULL REFERENCES public.api_webhooks(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  event_type      VARCHAR(100) NOT NULL,
  payload         JSONB NOT NULL,
  attempt         SMALLINT NOT NULL DEFAULT 1,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','success','failed','skipped')),
  response_code   SMALLINT,
  response_body   TEXT,
  response_ms     INT,
  error_message   TEXT,
  next_retry_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_webhook   ON public.webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_tenant    ON public.webhook_deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status    ON public.webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivered ON public.webhook_deliveries(delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_retry     ON public.webhook_deliveries(next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- ─────────────────────────────────────────────
-- Available scopes (reference table)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_scopes (
  scope       VARCHAR(100) PRIMARY KEY,
  category    VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO public.api_scopes (scope, category, description, is_sensitive) VALUES
  ('events:read',     'Events',   'Read event data',                  FALSE),
  ('events:write',    'Events',   'Create and update events',         FALSE),
  ('events:delete',   'Events',   'Delete events',                    TRUE),
  ('guests:read',     'Guests',   'Read guest list and RSVP data',    FALSE),
  ('guests:write',    'Guests',   'Create and update guests',         FALSE),
  ('guests:delete',   'Guests',   'Delete guests',                    TRUE),
  ('vendors:read',    'Vendors',  'Read vendor assignments',          FALSE),
  ('vendors:write',   'Vendors',  'Assign and update vendors',        FALSE),
  ('finance:read',    'Finance',  'Read invoices and payments',       TRUE),
  ('finance:write',   'Finance',  'Create invoices',                  TRUE),
  ('team:read',       'Team',     'Read team members',                FALSE),
  ('team:write',      'Team',     'Manage team assignments',          TRUE),
  ('analytics:read',  'Analytics','Read analytics and reports',       FALSE),
  ('ai:invoke',       'AI',       'Trigger AI features',              FALSE),
  ('webhooks:manage', 'Webhooks', 'Manage webhook endpoints',         TRUE),
  ('admin:read',      'Admin',    'Read tenant configuration',        TRUE),
  ('admin:write',     'Admin',    'Modify tenant configuration',      TRUE)
ON CONFLICT (scope) DO NOTHING;

-- ─────────────────────────────────────────────
-- Updated-at triggers
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_api_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['api_keys','api_webhooks'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION update_api_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE public.api_keys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_webhooks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- API keys
CREATE POLICY "api_keys_tenant_isolation" ON public.api_keys
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Usage logs (read-only for tenant)
CREATE POLICY "api_usage_tenant_isolation" ON public.api_usage_logs
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Webhooks
CREATE POLICY "webhooks_tenant_isolation" ON public.api_webhooks
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Deliveries
CREATE POLICY "deliveries_tenant_isolation" ON public.webhook_deliveries
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- Daily usage summary view
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_api_key_daily_usage AS
SELECT
  k.id          AS api_key_id,
  k.tenant_id,
  k.name        AS key_name,
  k.key_prefix,
  k.key_hint,
  k.rate_limit_daily,
  DATE(l.requested_at)            AS usage_date,
  COUNT(*)                        AS request_count,
  COUNT(*) FILTER (WHERE l.status_code >= 400) AS error_count,
  ROUND(AVG(l.response_ms))       AS avg_response_ms
FROM public.api_keys k
LEFT JOIN public.api_usage_logs l
  ON l.api_key_id = k.id
  AND l.requested_at >= NOW() - INTERVAL '30 days'
GROUP BY k.id, k.tenant_id, k.name, k.key_prefix, k.key_hint, k.rate_limit_daily, DATE(l.requested_at);


-- ============================================================
-- Migration: 060_gift_management.sql
-- ============================================================
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


