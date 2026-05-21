-- ============================================================
-- 029_rbac.sql  —  Advanced RBAC & Permissions System
-- ============================================================
-- Architecture:
--   roles       → named roles scoped to a tenant
--   permissions → granular capability flags (resource:action)
--   role_permissions → many-to-many: role has permissions
--   profile_roles   → many-to-many: user has roles (per tenant)
--   resource_acls   → per-resource overrides (event-level access)
-- ============================================================

-- ── Permission catalogue ───────────────────────────────────────────────────────
-- Exhaustive list of all capabilities in the system.

CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource    TEXT NOT NULL,   -- e.g. 'events', 'finance', 'guests'
  action      TEXT NOT NULL,   -- e.g. 'view', 'create', 'edit', 'delete', 'export'
  code        TEXT NOT NULL UNIQUE,  -- 'events:create'
  description TEXT,
  category    TEXT,            -- ui grouping
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resource, action)
);

CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_code     ON permissions(code);

-- ── Roles ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = system role
  name        TEXT NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  priority    INTEGER NOT NULL DEFAULT 0,  -- higher = more powerful; used for UI ordering
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant  ON roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_system  ON roles(is_system) WHERE is_system = true;

-- ── Role ↔ Permission ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by    UUID REFERENCES profiles(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission_id);

-- ── Profile ↔ Role (tenant-scoped) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profile_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES profiles(id),
  expires_at  TIMESTAMPTZ,   -- optional time-limited role grant
  UNIQUE (profile_id, role_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_roles_profile ON profile_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_role    ON profile_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_tenant  ON profile_roles(tenant_id);

-- ── Resource ACLs (per-object overrides) ─────────────────────────────────────
-- Allows granting/revoking access to specific resources
-- e.g. a team member can view a particular event they wouldn't normally see.

CREATE TABLE IF NOT EXISTS resource_acls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,   -- 'event', 'client', 'vendor', etc.
  resource_id   UUID NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  is_grant      BOOLEAN NOT NULL DEFAULT true,  -- true = grant, false = deny
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES profiles(id),
  UNIQUE (profile_id, resource_type, resource_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_acls_profile  ON resource_acls(profile_id);
CREATE INDEX IF NOT EXISTS idx_resource_acls_resource ON resource_acls(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_acls_tenant   ON resource_acls(tenant_id);

-- ── RBAC audit log ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rbac_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE SET NULL,
  actor_id    UUID REFERENCES profiles(id),
  action      TEXT NOT NULL CHECK (action IN (
    'role_created', 'role_updated', 'role_deleted',
    'permission_granted', 'permission_revoked',
    'role_assigned', 'role_revoked',
    'acl_granted', 'acl_revoked'
  )),
  target_type TEXT,   -- 'role', 'profile', 'permission'
  target_id   UUID,
  metadata    JSONB DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rbac_audit_tenant  ON rbac_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_actor   ON rbac_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_created ON rbac_audit_log(created_at DESC);

-- ── Helper function: check if profile has permission ─────────────────────────

CREATE OR REPLACE FUNCTION profile_has_permission(
  p_profile_id  UUID,
  p_permission  TEXT   -- permission code, e.g. 'events:create'
) RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM profile_roles pr
    JOIN role_permissions rp ON rp.role_id = pr.role_id
    JOIN permissions p        ON p.id = rp.permission_id
    WHERE pr.profile_id = p_profile_id
      AND p.code = p_permission
      AND (pr.expires_at IS NULL OR pr.expires_at > now())
  ) INTO has_perm;
  RETURN has_perm;
END;
$$;

-- ── Helper: get all permissions for a profile ─────────────────────────────────

CREATE OR REPLACE FUNCTION get_profile_permissions(p_profile_id UUID)
RETURNS TABLE(code TEXT, resource TEXT, action TEXT, category TEXT) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
    SELECT DISTINCT p.code, p.resource, p.action, p.category
    FROM profile_roles pr
    JOIN role_permissions rp ON rp.role_id = pr.role_id
    JOIN permissions p        ON p.id = rp.permission_id
    WHERE pr.profile_id = p_profile_id
      AND (pr.expires_at IS NULL OR pr.expires_at > now())
    ORDER BY p.resource, p.action;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE permissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_roles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_acls   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_audit_log  ENABLE ROW LEVEL SECURITY;

-- Permissions: read-only to all authenticated
CREATE POLICY "permissions_read_all" ON permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- Roles: system roles visible to all; tenant roles to own tenant
CREATE POLICY "roles_tenant_access" ON roles FOR ALL USING (
  is_system = true
  OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Role permissions: visible if role is accessible
CREATE POLICY "role_perms_tenant_access" ON role_permissions FOR ALL USING (
  role_id IN (
    SELECT id FROM roles
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  )
);

-- Profile roles: own records + admins in same tenant
CREATE POLICY "profile_roles_own_and_admin" ON profile_roles FOR ALL USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Resource ACLs: tenant-scoped
CREATE POLICY "resource_acls_tenant" ON resource_acls FOR ALL USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Audit log: tenant-scoped
CREATE POLICY "rbac_audit_tenant" ON rbac_audit_log FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- ── Permissions seed — full catalogue ─────────────────────────────────────────

INSERT INTO permissions (resource, action, code, description, category) VALUES
-- Events
('events','view',          'events:view',           'View events list and details',              'Events'),
('events','create',        'events:create',          'Create new events',                         'Events'),
('events','edit',          'events:edit',            'Edit event details',                        'Events'),
('events','delete',        'events:delete',          'Delete events',                             'Events'),
('events','export',        'events:export',          'Export events data',                        'Events'),
('events','publish',       'events:publish',         'Publish event microsite',                   'Events'),
-- CRM
('crm','view',             'crm:view',               'View CRM contacts and deals',               'CRM'),
('crm','create',           'crm:create',             'Create CRM contacts, leads, deals',         'CRM'),
('crm','edit',             'crm:edit',               'Edit CRM records',                          'CRM'),
('crm','delete',           'crm:delete',             'Delete CRM records',                        'CRM'),
('crm','export',           'crm:export',             'Export CRM data',                           'CRM'),
('crm','bulk_assign',      'crm:bulk_assign',        'Bulk assign contacts to team members',      'CRM'),
-- Finance
('finance','view',         'finance:view',           'View invoices, budgets, P&L',               'Finance'),
('finance','create',       'finance:create',         'Create invoices and budget items',          'Finance'),
('finance','edit',         'finance:edit',           'Edit financial records',                    'Finance'),
('finance','delete',       'finance:delete',         'Delete financial records',                  'Finance'),
('finance','approve',      'finance:approve',        'Approve purchase orders and expenses',      'Finance'),
('finance','export',       'finance:export',         'Export financial data and reports',         'Finance'),
('finance','view_margins', 'finance:view_margins',   'View profit margins and sensitive data',    'Finance'),
-- Vendors
('vendors','view',         'vendors:view',           'View vendor profiles',                      'Vendors'),
('vendors','create',       'vendors:create',         'Add new vendors',                           'Vendors'),
('vendors','edit',         'vendors:edit',           'Edit vendor details',                       'Vendors'),
('vendors','delete',       'vendors:delete',         'Delete vendors',                            'Vendors'),
('vendors','contract',     'vendors:contract',       'Create and sign vendor contracts',          'Vendors'),
-- Guests
('guests','view',          'guests:view',            'View guest lists',                          'Guests'),
('guests','create',        'guests:create',          'Add guests',                                'Guests'),
('guests','edit',          'guests:edit',            'Edit guest records',                        'Guests'),
('guests','delete',        'guests:delete',          'Delete guests',                             'Guests'),
('guests','checkin',       'guests:checkin',         'Perform guest check-in',                    'Guests'),
('guests','export',        'guests:export',          'Export guest lists',                        'Guests'),
-- Team
('team','view',            'team:view',              'View team members',                         'Team'),
('team','invite',          'team:invite',            'Invite new team members',                   'Team'),
('team','edit',            'team:edit',              'Edit team member roles',                    'Team'),
('team','remove',          'team:remove',            'Remove team members',                       'Team'),
-- Production
('production','view',      'production:view',        'View production plans and tasks',           'Production'),
('production','create',    'production:create',      'Create production items',                   'Production'),
('production','edit',      'production:edit',        'Edit production records',                   'Production'),
('production','delete',    'production:delete',      'Delete production records',                 'Production'),
-- Artists
('artists','view',         'artists:view',           'View artist roster',                        'Artists'),
('artists','create',       'artists:create',         'Add artists',                               'Artists'),
('artists','edit',         'artists:edit',           'Edit artist records',                       'Artists'),
('artists','book',         'artists:book',           'Book and contract artists',                 'Artists'),
-- Inventory
('inventory','view',       'inventory:view',         'View inventory',                            'Inventory'),
('inventory','create',     'inventory:create',       'Add inventory items',                       'Inventory'),
('inventory','edit',       'inventory:edit',         'Edit inventory',                            'Inventory'),
('inventory','delete',     'inventory:delete',       'Delete inventory items',                    'Inventory'),
('inventory','allocate',   'inventory:allocate',     'Allocate inventory to events',              'Inventory'),
-- Analytics
('analytics','view',       'analytics:view',         'View analytics dashboards',                 'Analytics'),
('analytics','export',     'analytics:export',       'Export analytics data',                     'Analytics'),
('analytics','view_revenue','analytics:view_revenue','View revenue analytics',                    'Analytics'),
-- Documents
('documents','view',       'documents:view',         'View documents',                            'Documents'),
('documents','create',     'documents:create',       'Create documents',                          'Documents'),
('documents','edit',       'documents:edit',         'Edit documents',                            'Documents'),
('documents','delete',     'documents:delete',       'Delete documents',                          'Documents'),
('documents','send',       'documents:send',         'Send documents to clients',                 'Documents'),
('documents','sign',       'documents:sign',         'Sign documents',                            'Documents'),
-- Playbooks
('playbooks','view',       'playbooks:view',         'View playbooks',                            'Playbooks'),
('playbooks','create',     'playbooks:create',       'Create custom playbooks',                   'Playbooks'),
('playbooks','edit',       'playbooks:edit',         'Edit playbooks',                            'Playbooks'),
('playbooks','apply',      'playbooks:apply',        'Apply playbooks to events',                 'Playbooks'),
-- Integrations
('integrations','view',    'integrations:view',      'View integrations',                         'Integrations'),
('integrations','manage',  'integrations:manage',    'Manage API keys and webhooks',              'Integrations'),
-- Settings
('settings','view',        'settings:view',          'View company settings',                     'Settings'),
('settings','edit',        'settings:edit',          'Edit company settings',                     'Settings'),
('settings','billing',     'settings:billing',       'Manage billing and subscription',           'Settings'),
-- RBAC
('rbac','view',            'rbac:view',              'View roles and permissions',                'RBAC'),
('rbac','manage',          'rbac:manage',            'Create and assign roles',                   'RBAC'),
-- Command Center
('command_center','view',  'command_center:view',    'View command center',                       'Command Center'),
('command_center','manage','command_center:manage',  'Manage incidents and alerts',               'Command Center'),
-- Super Admin (tenant-level)
('tenant','manage',        'tenant:manage',          'Full tenant administration',                'Admin'),
('tenant','view_all',      'tenant:view_all',        'View all tenant data',                      'Admin')

ON CONFLICT (resource, action) DO NOTHING;

-- ── System roles seed ─────────────────────────────────────────────────────────

INSERT INTO roles (id, name, description, is_system, color, priority) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Super Admin',       'Full access to everything',                          true, '#ef4444', 100),
  ('00000000-0000-0000-0000-000000000002', 'Company Admin',     'Admin access to all company features',               true, '#f97316', 90),
  ('00000000-0000-0000-0000-000000000003', 'Event Manager',     'Full control over assigned events',                  true, '#6366f1', 70),
  ('00000000-0000-0000-0000-000000000004', 'Senior Coordinator','Manage events, vendors, guests; no finance delete',  true, '#8b5cf6', 60),
  ('00000000-0000-0000-0000-000000000005', 'Operations Staff',  'Day-of operations and check-in',                     true, '#0ea5e9', 50),
  ('00000000-0000-0000-0000-000000000006', 'Finance Manager',   'Full finance access, limited other access',          true, '#10b981', 60),
  ('00000000-0000-0000-0000-000000000007', 'Sales Executive',   'CRM, proposals, client communication',               true, '#f59e0b', 50),
  ('00000000-0000-0000-0000-000000000008', 'Vendor Manager',    'Vendor contracts, artist booking',                   true, '#ec4899', 50),
  ('00000000-0000-0000-0000-000000000009', 'View Only',         'Read-only access across the platform',               true, '#64748b', 10)

ON CONFLICT (id) DO NOTHING;

-- Grant all permissions to Super Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT DO NOTHING;

-- Grant all permissions to Company Admin (except super admin flags)
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
WHERE code NOT IN ('settings:billing', 'rbac:manage', 'tenant:manage')
ON CONFLICT DO NOTHING;

-- Event Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions
WHERE resource IN ('events','crm','guests','vendors','production','artists','inventory','documents','playbooks')
   OR code IN ('analytics:view','command_center:view','settings:view')
ON CONFLICT DO NOTHING;

-- Senior Coordinator
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', id FROM permissions
WHERE (resource IN ('events','guests','vendors','production','inventory','documents')
      AND action != 'delete')
   OR code IN ('crm:view','crm:edit','finance:view','analytics:view','settings:view')
ON CONFLICT DO NOTHING;

-- Operations Staff
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000005', id FROM permissions
WHERE code IN (
  'events:view','guests:view','guests:checkin','vendors:view',
  'production:view','production:edit','inventory:view','inventory:allocate',
  'command_center:view','settings:view'
)
ON CONFLICT DO NOTHING;

-- Finance Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000006', id FROM permissions
WHERE resource IN ('finance','documents')
   OR code IN (
     'events:view','crm:view','vendors:view','analytics:view',
     'analytics:view_revenue','settings:view'
   )
ON CONFLICT DO NOTHING;

-- Sales Executive
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000007', id FROM permissions
WHERE resource IN ('crm','documents')
   OR code IN (
     'events:view','events:create','playbooks:view','playbooks:apply',
     'analytics:view','settings:view'
   )
ON CONFLICT DO NOTHING;

-- Vendor Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000008', id FROM permissions
WHERE resource IN ('vendors','artists')
   OR code IN (
     'events:view','production:view','inventory:view','inventory:allocate',
     'documents:view','documents:create','documents:send','settings:view'
   )
ON CONFLICT DO NOTHING;

-- View Only — all :view permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000009', id FROM permissions
WHERE action = 'view'
ON CONFLICT DO NOTHING;
