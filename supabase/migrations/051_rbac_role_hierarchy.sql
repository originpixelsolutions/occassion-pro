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
  ADD COLUMN IF NOT EXISTS workspace_owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

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
