-- ============================================================
-- OccasionPro — Migration 084: Super Admins Table
--
-- Platform-level super admin table.
-- Guards check: super_admins WHERE user_id = auth.uid() AND is_active = true
--
-- Referenced by:
--   workspace-role.guard.ts  — .eq('user_id', userId)
--   event-access.guard.ts    — .eq('user_id', userId)
--   041_platform_settings.sql — RLS policies
-- ============================================================

-- ── super_admins ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS super_admins (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  full_name   text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT super_admins_user_id_unique UNIQUE (user_id),
  CONSTRAINT super_admins_email_unique   UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_super_admins_user_id   ON super_admins(user_id)  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_super_admins_email     ON super_admins(email);

COMMENT ON TABLE super_admins IS
  'Platform-level super admin accounts. Users in this table bypass all tenant role checks.';

COMMENT ON COLUMN super_admins.user_id IS
  'Maps to auth.users.id — used by workspace-role.guard and event-access.guard.';

-- ── RLS ───────────────────────────────────────────────────

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Super admins can read their own record
CREATE POLICY "super_admins_self_read"
  ON super_admins FOR SELECT
  USING (user_id = auth.uid());

-- Only existing super admins can manage this table (via service role in practice)
CREATE POLICY "super_admins_service_all"
  ON super_admins FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM super_admins sa
      WHERE sa.user_id = auth.uid() AND sa.is_active = true
    )
  );
