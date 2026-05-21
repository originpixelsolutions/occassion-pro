-- ============================================================
-- OccasionPro — Super Admin Seed
--
-- Seeds hariprathishg@gmail.com as the platform super admin.
--
-- Run manually after `supabase db reset` or `supabase db migrate`:
--   psql $DATABASE_URL -f supabase/seed/001_super_admin.sql
--
-- Or include in the main seed.sql by appending:
--   \i supabase/seed/001_super_admin.sql
--
-- SECURITY:
--   • Change the password immediately after first login via the Supabase
--     Dashboard or by calling auth.update_user() via the Supabase Auth API.
--   • Do NOT run this on a production database with the default password.
--   • This file should NOT be committed to a public repository.
-- ============================================================

DO $$
DECLARE
  v_user_id  uuid;
  v_email    text := 'hariprathishg@gmail.com';
  v_password text := 'ChangeMe@123!';
BEGIN

  -- ── 1. Upsert into auth.users ───────────────────────────────────────────────
  --
  -- Supabase local dev uses pgcrypto for password hashing.
  -- The encrypted_password column stores a bcrypt hash.

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    role,
    aud,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token
  )
  VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),                                        -- confirm email immediately
    'authenticated',
    'authenticated',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', 'Hariprathish G'),
    false,
    '',
    ''
  )
  ON CONFLICT (email) DO UPDATE
    SET
      encrypted_password = crypt(v_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
      updated_at         = now()
  RETURNING id INTO v_user_id;

  -- ── 2. Upsert into public.super_admins ─────────────────────────────────────
  --
  -- Requires migration 084_super_admins.sql to have run first.

  INSERT INTO super_admins (user_id, email, full_name, is_active)
  VALUES (v_user_id, v_email, 'Hariprathish G', true)
  ON CONFLICT (user_id) DO UPDATE
    SET
      email      = EXCLUDED.email,
      full_name  = EXCLUDED.full_name,
      is_active  = true;

  RAISE NOTICE 'Super admin seeded: % (id=%)', v_email, v_user_id;

END $$;
