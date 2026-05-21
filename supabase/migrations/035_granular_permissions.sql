-- ============================================================
-- OccasionPro — Granular Module-Level Permissions (Migration 035)
-- Extends RBAC system with per-module, per-team-member access control
-- ============================================================

-- ── Access level enum ────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_access_level') THEN
    CREATE TYPE module_access_level AS ENUM ('none', 'view', 'edit', 'full');
  END IF;
END $$;

-- ── Module registry ──────────────────────────────────────────────────────────
-- Single source of truth for all platform modules

CREATE TABLE IF NOT EXISTS platform_modules (
  id              TEXT PRIMARY KEY,           -- 'guests', 'fnb', 'finance', etc.
  label           TEXT NOT NULL,              -- "Guests"
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'operations',  -- 'core','operations','finance','admin','system'
  sidebar_path    TEXT,                       -- '/guests'
  is_always_on    BOOLEAN NOT NULL DEFAULT false,  -- Dashboard, Notifications
  admin_only      BOOLEAN NOT NULL DEFAULT false,  -- Settings full, Super Admin
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed all modules
INSERT INTO platform_modules (id, label, description, category, sidebar_path, is_always_on, admin_only, sort_order) VALUES
  ('dashboard',        'Dashboard',              'Main dashboard overview',             'core',       '/dashboard',   true,  false, 1),
  ('events',           'Events',                 'Event creation and management',       'core',       '/events',      false, false, 2),
  ('guests',           'Guests',                 'Guest list, check-in, export',        'operations', '/guests',      false, false, 3),
  ('fnb',              'F&B',                    'Food & beverage management',          'operations', '/fnb',         false, false, 4),
  ('accommodation',    'Accommodation',          'Hotel blocks and room assignments',   'operations', '/accommodation',false,false, 5),
  ('invitations_rsvp', 'Invitations & RSVP',     'Invite sending and RSVP tracking',   'operations', '/rsvp',        false, false, 6),
  ('venues',           'Venues',                 'Venue listing and floor plans',       'operations', '/venues',      false, false, 7),
  ('vendors',          'Vendors',                'Vendor management and payments',      'operations', '/vendors',     false, false, 8),
  ('finance',          'Finance & Budget',       'Invoices, expenses, P&L',            'finance',    '/finance',     false, false, 9),
  ('crm',              'CRM',                    'Leads, proposals, sales pipeline',    'finance',    '/crm',         false, false, 10),
  ('runsheet',         'Runsheet',               'Event runsheet and timeline',         'operations', '/runsheet',    false, false, 11),
  ('tasks',            'Tasks',                  'Task assignment and tracking',        'operations', '/tasks',       false, false, 12),
  ('team',             'Team',                   'Team members and roles',              'admin',      '/team',        false, true,  13),
  ('artists',          'Artist & Talent',        'Artist and performer management',     'operations', '/artists',     false, false, 14),
  ('transportation',   'Transportation',         'Transport and logistics',             'operations', '/transportation',false,false,15),
  ('av_technical',     'AV & Technical',         'AV and technical production',         'operations', '/av',          false, false, 16),
  ('security',         'Security',               'Security and crowd management',       'operations', '/security',    false, false, 17),
  ('sponsorship',      'Sponsorship',            'Sponsorship and partnerships',        'finance',    '/sponsorship', false, false, 18),
  ('inventory',        'Inventory',              'Stock and equipment tracking',        'operations', '/inventory',   false, false, 19),
  ('microsites',       'Microsites & Ticketing', 'Event websites and ticket sales',    'operations', '/microsites',  false, false, 20),
  ('analytics',        'Analytics',              'Reports and business intelligence',   'admin',      '/analytics',   false, false, 21),
  ('ai_assistant',     'AI Assistant',           'AI-powered automation and insights',  'core',       '/ai',          false, false, 22),
  ('notifications',    'Notifications',          'Notification center',                 'core',       '/notifications',true, false, 23),
  ('settings',         'Settings',               'Platform settings and configuration', 'admin',      '/settings',    false, true,  24),
  ('super_admin',      'Super Admin',            'Super admin portal (never for team)', 'system',     '/super-admin', false, true,  25)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- ── Team member permissions ───────────────────────────────────────────────────
-- Stores per-module access level for each team member
-- event_id IS NULL = platform-wide (applies to all events)
-- event_id IS NOT NULL = event-specific override

CREATE TABLE IF NOT EXISTS team_member_permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id     UUID REFERENCES events(id) ON DELETE CASCADE,   -- NULL = platform-wide
  module_id    TEXT NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
  access_level module_access_level NOT NULL DEFAULT 'none',
  granted_by   UUID REFERENCES profiles(id),
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, event_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_tmp_tenant     ON team_member_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tmp_profile    ON team_member_permissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_tmp_event      ON team_member_permissions(event_id);
CREATE INDEX IF NOT EXISTS idx_tmp_module     ON team_member_permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_tmp_profile_event ON team_member_permissions(profile_id, event_id);

-- ── Preset permission templates ───────────────────────────────────────────────
-- Preset roles that auto-set all module levels

CREATE TABLE IF NOT EXISTS permission_presets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,        -- 'admin', 'manager', 'coordinator', 'view_only'
  label       TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#6366f1',
  is_system   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO permission_presets (name, label, description, color) VALUES
  ('admin',       'Admin',        'Full access to all modules including team and settings', '#ef4444'),
  ('manager',     'Manager',      'Full operational access, view-only for finance and admin', '#f59e0b'),
  ('coordinator', 'Coordinator',  'Edit access for operations, view-only for finance', '#3b82f6'),
  ('view_only',   'View Only',    'Read-only access to all non-admin modules', '#6b7280')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS permission_preset_modules (
  preset_name  TEXT NOT NULL REFERENCES permission_presets(name) ON DELETE CASCADE,
  module_id    TEXT NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
  access_level module_access_level NOT NULL DEFAULT 'none',
  PRIMARY KEY (preset_name, module_id)
);

-- Admin preset: full everywhere except super_admin (none)
INSERT INTO permission_preset_modules (preset_name, module_id, access_level)
SELECT 'admin', id,
  CASE
    WHEN id = 'super_admin' THEN 'none'::module_access_level
    ELSE 'full'::module_access_level
  END
FROM platform_modules
ON CONFLICT (preset_name, module_id) DO NOTHING;

-- Manager preset
INSERT INTO permission_preset_modules (preset_name, module_id, access_level)
SELECT 'manager', id,
  CASE
    WHEN id IN ('super_admin','settings') THEN 'none'::module_access_level
    WHEN id IN ('team','analytics','finance') THEN 'view'::module_access_level
    ELSE 'full'::module_access_level
  END
FROM platform_modules
ON CONFLICT (preset_name, module_id) DO NOTHING;

-- Coordinator preset
INSERT INTO permission_preset_modules (preset_name, module_id, access_level)
SELECT 'coordinator', id,
  CASE
    WHEN id IN ('super_admin','settings','team') THEN 'none'::module_access_level
    WHEN id IN ('analytics','finance','crm','sponsorship') THEN 'view'::module_access_level
    ELSE 'edit'::module_access_level
  END
FROM platform_modules
ON CONFLICT (preset_name, module_id) DO NOTHING;

-- View only preset
INSERT INTO permission_preset_modules (preset_name, module_id, access_level)
SELECT 'view_only', id,
  CASE
    WHEN id IN ('super_admin','settings','team') THEN 'none'::module_access_level
    WHEN id = 'dashboard' THEN 'full'::module_access_level
    WHEN id = 'notifications' THEN 'full'::module_access_level
    ELSE 'view'::module_access_level
  END
FROM platform_modules
ON CONFLICT (preset_name, module_id) DO NOTHING;

-- ── Helper function: get effective access level ───────────────────────────────
-- Returns access level for a profile+module combination, preferring event override

CREATE OR REPLACE FUNCTION get_module_access(
  p_profile_id UUID,
  p_module_id  TEXT,
  p_event_id   UUID DEFAULT NULL
) RETURNS module_access_level AS $$
DECLARE
  v_level module_access_level;
BEGIN
  -- Try event-specific override first
  IF p_event_id IS NOT NULL THEN
    SELECT access_level INTO v_level
    FROM team_member_permissions
    WHERE profile_id = p_profile_id AND module_id = p_module_id AND event_id = p_event_id
    LIMIT 1;
    IF FOUND THEN RETURN v_level; END IF;
  END IF;

  -- Fall back to platform-wide
  SELECT access_level INTO v_level
  FROM team_member_permissions
  WHERE profile_id = p_profile_id AND module_id = p_module_id AND event_id IS NULL
  LIMIT 1;
  IF FOUND THEN RETURN v_level; END IF;

  -- Check if always-on
  SELECT CASE WHEN is_always_on THEN 'full'::module_access_level ELSE 'none'::module_access_level END
  INTO v_level
  FROM platform_modules
  WHERE id = p_module_id;

  RETURN COALESCE(v_level, 'none'::module_access_level);
END;
$$ LANGUAGE plpgsql STABLE;

-- ── RLS: team_member_permissions ─────────────────────────────────────────────

ALTER TABLE team_member_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_see_own_permissions"
  ON team_member_permissions FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "admins_manage_permissions"
  ON team_member_permissions FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin')
    )
  );
