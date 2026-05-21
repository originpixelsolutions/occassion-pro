-- ============================================================================
-- Migration 087: Extend profiles with user-facing fields
-- OccasionPro — Aligns profiles table with NestJS service expectations.
--
-- Services written against a `users` table that has email, role, and status.
-- profiles already has id (= auth.users.id), full_name, tenant_id.
-- This migration adds the three missing columns so services can work with
-- profiles directly without a separate users table.
-- ============================================================================

-- ─── Add columns ─────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS role         TEXT NOT NULL DEFAULT 'team_member',
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended', 'invited'));

-- Index for email lookups (membership checks, invitation deduplication)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);

-- Index for tenant + status (count active members per tenant)
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_status ON profiles (tenant_id, status)
  WHERE status = 'active';

-- ─── Back-fill email from auth.users ─────────────────────────────────────────
-- Runs once at migration time to populate existing rows.
-- New rows are kept in sync via the trigger below.

UPDATE profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id
  AND p.email IS NULL;

-- ─── Trigger: keep profiles.email in sync with auth.users ────────────────────

CREATE OR REPLACE FUNCTION sync_profile_email_on_user_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Called on INSERT or UPDATE of auth.users
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
    SET email     = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  RETURN NEW;
END;
$$;

-- Replace the existing on_auth_user_created trigger with the new version
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_profile_email_on_user_create();

-- ─── RLS: profiles can read their own email ───────────────────────────────────
-- Existing RLS policies on profiles remain. No new ones needed —
-- service role bypasses all RLS for server-side queries.

-- ─── Comment ─────────────────────────────────────────────────────────────────
COMMENT ON COLUMN profiles.email IS
  'Denormalized from auth.users.email. Kept in sync by on_auth_user_created trigger. Used for membership lookups and invitation deduplication.';

COMMENT ON COLUMN profiles.role IS
  'Primary workspace role for this profile (owner | event_manager | team_lead | team_member). Detailed per-tenant role assignments live in user_roles.';

COMMENT ON COLUMN profiles.status IS
  'Account status: active | inactive | suspended | invited.';
