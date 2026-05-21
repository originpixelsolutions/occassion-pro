-- ============================================================
-- Migration: 061_guest_copy_between_events.sql
-- ============================================================
-- ============================================================
-- Migration 061 — Guest Copy Between Events
-- ============================================================

-- ─────────────────────────────────────────────
-- Copy Jobs — audit trail for each copy operation
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_copy_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  target_event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requested_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Strategy for handling duplicates (matched by email or phone)
  duplicate_strategy    VARCHAR(20) NOT NULL DEFAULT 'skip'
                          CHECK (duplicate_strategy IN ('skip', 'overwrite', 'add_anyway')),

  -- Fields to copy (JSON array of column names, NULL = all)
  fields_to_copy        JSONB,

  -- Outcome counters
  total_guests          INT NOT NULL DEFAULT 0,
  copied_count          INT NOT NULL DEFAULT 0,
  skipped_count         INT NOT NULL DEFAULT 0,
  overwritten_count     INT NOT NULL DEFAULT 0,

  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message         TEXT,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_copy_jobs_tenant     ON public.guest_copy_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guest_copy_jobs_target     ON public.guest_copy_jobs(target_event_id);
CREATE INDEX IF NOT EXISTS idx_guest_copy_jobs_source     ON public.guest_copy_jobs(source_event_id);

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE public.guest_copy_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_copy_jobs_tenant_isolation" ON public.guest_copy_jobs
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- Add copied_from_event_id column to guests (nullable — set when guest is a copy)
-- ─────────────────────────────────────────────
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS copied_from_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS copy_job_id           UUID REFERENCES public.guest_copy_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guests_copied_from ON public.guests(copied_from_event_id) WHERE copied_from_event_id IS NOT NULL;

-- ============================================================
-- Migration: 062_guest_portal_v2.sql
-- ============================================================
-- ============================================================
-- Migration 062 — Guest Portal v2 (14 sections, FAQs, Announcements, Contacts)
-- Extends migration 048
-- ============================================================

-- ─────────────────────────────────────────────
-- Add missing section columns to guest_portal_settings
-- ─────────────────────────────────────────────
ALTER TABLE public.guest_portal_settings
  ADD COLUMN IF NOT EXISTS section_food_menu       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS section_announcements   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS section_faqs            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS section_contacts        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS section_my_invites      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS otp_required            BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS self_reg_auto_approve   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS custom_welcome_message  TEXT,
  ADD COLUMN IF NOT EXISTS custom_theme_override   JSONB,
  ADD COLUMN IF NOT EXISTS cover_image_url         TEXT,
  ADD COLUMN IF NOT EXISTS host_name               VARCHAR(200);

-- ─────────────────────────────────────────────
-- FAQs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_portal_faqs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portal_faqs_event ON public.guest_portal_faqs(event_id);

-- ─────────────────────────────────────────────
-- Announcements (with real-time feed via Supabase Realtime)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_portal_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  emoji       VARCHAR(10),
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portal_announcements_event ON public.guest_portal_announcements(event_id);

-- ─────────────────────────────────────────────
-- Key Contacts
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_portal_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  role        VARCHAR(100),               -- 'Event Coordinator', 'Venue Manager', etc.
  phone       VARCHAR(30),
  email       VARCHAR(200),
  whatsapp    VARCHAR(30),
  avatar_url  TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portal_contacts_event ON public.guest_portal_contacts(event_id);

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.guest_portal_faqs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_portal_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_portal_contacts      ENABLE ROW LEVEL SECURITY;

-- Team access (read/write by authenticated users in the tenant)
CREATE POLICY "portal_faqs_tenant"          ON public.guest_portal_faqs
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "portal_announcements_tenant" ON public.guest_portal_announcements
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "portal_contacts_tenant"      ON public.guest_portal_contacts
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Updated-at triggers
CREATE OR REPLACE FUNCTION update_portal_v2_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
DROP TRIGGER IF EXISTS trg_portal_faqs_updated_at ON public.guest_portal_faqs;
  CREATE TRIGGER trg_portal_faqs_updated_at
    BEFORE UPDATE ON public.guest_portal_faqs
    FOR EACH ROW EXECUTE FUNCTION update_portal_v2_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Migration: 063_client_portal_v2.sql
-- ============================================================
-- 063_client_portal_v2.sql
-- Client Portal v2: sessions table, messages table, magic links, per-tenant email uniqueness

-- ── 1. Add tenant_id to client_accounts (missing from 049) ──────────────────
ALTER TABLE client_accounts
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Drop the global email unique constraint and replace with per-tenant unique
ALTER TABLE client_accounts
  DROP CONSTRAINT IF EXISTS client_accounts_email_key;

-- Re-add per-tenant unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_client_accounts_tenant_email'
  ) THEN
    ALTER TABLE client_accounts
      ADD CONSTRAINT uq_client_accounts_tenant_email UNIQUE (tenant_id, email);
  END IF;
END $$;

ALTER TABLE client_accounts
  ADD COLUMN IF NOT EXISTS profile_complete bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_url       text,
  ADD COLUMN IF NOT EXISTS last_login_at    timestamptz;

-- ── 2. client_portal_sessions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_portal_sessions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid        NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expires_at     timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  user_agent     text,
  ip_hash        varchar(64)
);

CREATE INDEX IF NOT EXISTS idx_cp_sessions_client  ON client_portal_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_cp_sessions_expires ON client_portal_sessions(expires_at);

-- ── 3. client_magic_links ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_magic_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid        NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash  text        NOT NULL,
  purpose     text        NOT NULL DEFAULT 'login',   -- login | set_password
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used        bool        NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_magic_links_client ON client_magic_links(client_id);

-- ── 4. client_messages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_type         text        NOT NULL CHECK (sender_type IN ('team', 'client')),
  sender_id           uuid        NOT NULL,
  message             text        NOT NULL,
  attachment_url      text,
  attachment_name     text,
  is_read_by_client   bool        NOT NULL DEFAULT false,
  is_read_by_team     bool        NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_messages_event   ON client_messages(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_messages_tenant  ON client_messages(tenant_id);

-- ── 5. Add access_level values — update existing 'view_only'→'view' ──────────
-- Keep backwards compat: the new enum adds 'view' | 'collaborator' | 'full'
-- existing rows have 'view_only' | 'collaborator' | 'full_access'
-- We normalise with a check constraint comment only — no data loss

-- ── 6. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE client_portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_magic_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_messages        ENABLE ROW LEVEL SECURITY;

-- service role bypasses RLS; policies for anon/authenticated tenants:
DO $$
BEGIN
  -- Sessions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_portal_sessions' AND policyname = 'service_all') THEN
    CREATE POLICY service_all ON client_portal_sessions USING (true) WITH CHECK (true);
  END IF;
  -- Magic links
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_magic_links' AND policyname = 'service_all') THEN
    CREATE POLICY service_all ON client_magic_links USING (true) WITH CHECK (true);
  END IF;
  -- Messages
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_messages' AND policyname = 'service_all') THEN
    CREATE POLICY service_all ON client_messages USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- Migration: 064_vendor_portal.sql
-- ============================================================
-- ============================================================
-- 064_vendor_portal.sql
-- Vendor Portal: global vendor accounts, sessions, assignments,
-- messaging, and performance scoring
-- ============================================================

-- ── vendor_accounts ──────────────────────────────────────────
-- Global vendor accounts (not tenant-scoped; one account per email)
CREATE TABLE IF NOT EXISTS vendor_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  business_name  TEXT,
  phone          TEXT,
  category       TEXT NOT NULL DEFAULT 'Other'
                   CHECK (category IN (
                     'Catering','Photography','Decor','AV','Transport',
                     'Security','Entertainment','Venue','Floral','Cake',
                     'Makeup','Invitations','Lighting','Staffing','Other'
                   )),
  website        TEXT,
  bio            TEXT,
  avatar_url     TEXT,
  gstin          TEXT,
  -- Bank details stored encrypted at the application layer
  bank_account_name    TEXT,
  bank_account_number  TEXT,   -- store pgp-encrypted or app-encrypted
  bank_ifsc            TEXT,
  password_hash  TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  profile_complete BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_accounts_email    ON vendor_accounts (email);
CREATE INDEX IF NOT EXISTS idx_vendor_accounts_category ON vendor_accounts (category);

-- ── vendor_portal_sessions ───────────────────────────────────
-- UUID primary key IS the session token (same pattern as client portal)
CREATE TABLE IF NOT EXISTS vendor_portal_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      UUID NOT NULL REFERENCES vendor_accounts (id) ON DELETE CASCADE,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash        TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_sessions_vendor_id  ON vendor_portal_sessions (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_sessions_expires_at ON vendor_portal_sessions (expires_at);

-- ── vendor_password_reset_tokens ─────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID NOT NULL REFERENCES vendor_accounts (id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  purpose     TEXT NOT NULL DEFAULT 'reset' CHECK (purpose IN ('reset','set_password')),
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_pwd_token_hash ON vendor_password_reset_tokens (token_hash);

-- ── vendor_event_assignments ─────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_event_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           UUID NOT NULL REFERENCES vendor_accounts (id) ON DELETE RESTRICT,
  event_id            UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  service_description TEXT,
  agreed_amount       DECIMAL(12,2),
  currency_code       TEXT NOT NULL DEFAULT 'INR',
  status              TEXT NOT NULL DEFAULT 'invited'
                        CHECK (status IN (
                          'invited','confirmed','in_progress',
                          'completed','cancelled','declined'
                        )),
  assigned_by         UUID REFERENCES profiles (id) ON DELETE SET NULL,
  -- Staff ratings / notes (hidden from vendor)
  tenant_rating       SMALLINT CHECK (tenant_rating BETWEEN 1 AND 5),
  vendor_notes        TEXT,      -- internal staff notes
  -- Vendor response
  vendor_response_note TEXT,
  responded_at        TIMESTAMPTZ,
  -- Timestamps
  invited_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (vendor_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_vea_vendor_id  ON vendor_event_assignments (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vea_event_id   ON vendor_event_assignments (event_id);
CREATE INDEX IF NOT EXISTS idx_vea_tenant_id  ON vendor_event_assignments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_vea_status     ON vendor_event_assignments (status);

-- ── vendor_messages ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES vendor_event_assignments (id) ON DELETE CASCADE,
  sender_type     TEXT NOT NULL CHECK (sender_type IN ('team','vendor')),
  sender_id       UUID,   -- profiles.id if team, vendor_accounts.id if vendor
  content         TEXT NOT NULL,
  is_read_by_vendor BOOLEAN NOT NULL DEFAULT FALSE,
  is_read_by_team   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_messages_assignment_id ON vendor_messages (assignment_id);
CREATE INDEX IF NOT EXISTS idx_vendor_messages_created_at    ON vendor_messages (created_at);

-- ── vendor_performance_scores (view) ─────────────────────────
CREATE OR REPLACE VIEW vendor_performance_scores AS
SELECT
  va.id                                               AS vendor_id,
  va.name                                             AS vendor_name,
  va.category,
  COUNT(vea.id)                                       AS total_assignments,
  COUNT(vea.id) FILTER (WHERE vea.status = 'completed') AS completed_assignments,
  ROUND(AVG(vea.tenant_rating) FILTER (WHERE vea.tenant_rating IS NOT NULL), 2)
                                                      AS avg_rating,
  -- Simple performance score: 50% completion rate + 50% avg rating (normalised to 20)
  ROUND(
    COALESCE(
      (COUNT(vea.id) FILTER (WHERE vea.status = 'completed')::NUMERIC /
       NULLIF(COUNT(vea.id), 0)) * 50, 0
    ) +
    COALESCE(
      (AVG(vea.tenant_rating) FILTER (WHERE vea.tenant_rating IS NOT NULL) / 5.0) * 50, 0
    ),
  0)                                                  AS score
FROM vendor_accounts va
LEFT JOIN vendor_event_assignments vea ON vea.vendor_id = va.id
GROUP BY va.id, va.name, va.category;

-- ── updated_at triggers ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_vendor_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_accounts_updated_at ON vendor_accounts;
CREATE TRIGGER trg_vendor_accounts_updated_at
  BEFORE UPDATE ON vendor_accounts
  FOR EACH ROW EXECUTE FUNCTION update_vendor_updated_at();

DROP TRIGGER IF EXISTS trg_vea_updated_at ON vendor_event_assignments;
CREATE TRIGGER trg_vea_updated_at
  BEFORE UPDATE ON vendor_event_assignments
  FOR EACH ROW EXECUTE FUNCTION update_vendor_updated_at();

-- ============================================================
-- Migration: 065_team_invitations_soft_delete.sql
-- ============================================================
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
  invited_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  ADD COLUMN IF NOT EXISTS deleted_by              UUID REFERENCES users(id) ON DELETE SET NULL;

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

-- ============================================================
-- Migration: 066_subscriptions_inr_update.sql
-- ============================================================
-- ============================================================
-- Migration 066 — Subscription System: INR Pricing + Plan Features
--                  + DB Functions + Auto-Trial Trigger
-- ============================================================
-- Builds on migration 058 which created the core tables.
-- This migration:
--   1. Updates plan prices to INR (₹)
--   2. Adds plan_features table for granular feature rows
--   3. Creates get_tenant_plan_limits() function
--   4. Creates check_feature_access() function
--   5. Adds auto-trial trigger on tenant INSERT
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Update plan currency + prices to INR
-- ─────────────────────────────────────────────

-- Free plan stays free
UPDATE public.subscription_plans SET
  currency       = 'INR',
  price_monthly  = 0,
  price_yearly   = 0,
  updated_at     = NOW()
WHERE slug = 'free';

-- Starter: ₹2,499/mo | ₹24,990/yr (~17% savings)
UPDATE public.subscription_plans SET
  currency       = 'INR',
  price_monthly  = 2499,
  price_yearly   = 24990,
  updated_at     = NOW()
WHERE slug = 'starter';

-- Growth: ₹5,999/mo | ₹59,990/yr (~17% savings)
UPDATE public.subscription_plans SET
  currency       = 'INR',
  price_monthly  = 5999,
  price_yearly   = 59990,
  trial_days     = 14,
  updated_at     = NOW()
WHERE slug = 'growth';

-- Agency: ₹12,999/mo | ₹1,29,990/yr (~17% savings)
UPDATE public.subscription_plans SET
  currency       = 'INR',
  price_monthly  = 12999,
  price_yearly   = 129990,
  updated_at     = NOW()
WHERE slug = 'agency';

-- ─────────────────────────────────────────────
-- 2. plan_features table (granular feature rows)
--    Provides an indexed, queryable alternative to
--    the JSONB features column for feature gates.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_features (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_key   VARCHAR(60)  NOT NULL,
  is_enabled    BOOLEAN      NOT NULL DEFAULT FALSE,
  limit_value   INT,               -- NULL = unlimited (when feature has a numeric cap)
  description   TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (plan_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_plan_features_plan    ON public.plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_key     ON public.plan_features(feature_key);
CREATE INDEX IF NOT EXISTS idx_plan_features_enabled ON public.plan_features(plan_id, feature_key) WHERE is_enabled = TRUE;

-- updated_at trigger for plan_features
DROP TRIGGER IF EXISTS trg_plan_features_updated_at ON public.plan_features;
CREATE TRIGGER trg_plan_features_updated_at
  BEFORE UPDATE ON public.plan_features
  FOR EACH ROW EXECUTE FUNCTION update_sub_updated_at();

-- RLS for plan_features (public read, since it mirrors the plans)
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_features_public_read" ON public.plan_features
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.subscription_plans sp
      WHERE sp.id = plan_id AND sp.is_public = TRUE
    )
  );

-- ─────────────────────────────────────────────
-- Seed plan_features rows from JSONB features column
-- (insert only — idempotent via ON CONFLICT)
-- ─────────────────────────────────────────────

INSERT INTO public.plan_features (plan_id, feature_key, is_enabled)
SELECT
  sp.id,
  kv.key     AS feature_key,
  (kv.value::TEXT = 'true') AS is_enabled
FROM public.subscription_plans sp,
     jsonb_each(sp.features) AS kv
WHERE jsonb_typeof(kv.value) = 'boolean'
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW();

-- ─────────────────────────────────────────────
-- 3. get_tenant_plan_limits()
--    Returns a complete summary of the tenant's
--    current plan limits, trial state, and usage.
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_tenant_plan_limits(
  p_tenant_id UUID
)
RETURNS TABLE (
  plan_slug               VARCHAR,
  plan_name               VARCHAR,
  sub_status              VARCHAR,
  is_trialing             BOOLEAN,
  trial_days_remaining    INT,
  trial_ends_at           TIMESTAMPTZ,
  currency                VARCHAR,
  price_monthly           NUMERIC,

  -- Effective hard limits (override > plan default)
  max_events              INT,
  max_guests_per_event    INT,
  max_team_members        INT,
  max_storage_gb          NUMERIC,
  max_ai_calls_monthly    INT,
  max_short_links         INT,
  max_venues              INT,
  max_vendors             INT,

  -- Current usage
  usage_events            INT,
  usage_team_members      INT,
  usage_storage_gb        NUMERIC,
  usage_ai_calls          INT,
  usage_short_links       INT,
  usage_refreshed_at      TIMESTAMPTZ,

  -- Feature flags (full JSONB for flexible access)
  features_json           JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS
$$
BEGIN
  RETURN QUERY
  SELECT
    sp.slug::VARCHAR,
    sp.name::VARCHAR,
    ts.status::VARCHAR,
    (ts.status = 'trialing' AND ts.trial_end > NOW()),
    GREATEST(0, EXTRACT(DAY FROM (ts.trial_end - NOW()))::INT),
    ts.trial_end,
    sp.currency::VARCHAR,
    sp.price_monthly,

    -- Effective limits
    COALESCE(ts.override_max_events,  sp.max_events)::INT,
    sp.max_guests_per_event::INT,
    COALESCE(ts.override_max_team,    sp.max_team_members)::INT,
    COALESCE(ts.override_max_storage, sp.max_storage_gb)::NUMERIC,
    sp.max_ai_calls_monthly::INT,
    sp.max_short_links::INT,
    sp.max_venues::INT,
    sp.max_vendors::INT,

    -- Usage
    ts.usage_events,
    ts.usage_team_members,
    ts.usage_storage_gb,
    ts.usage_ai_calls,
    ts.usage_short_links,
    ts.usage_refreshed_at,

    sp.features
  FROM public.tenant_subscriptions ts
  JOIN public.subscription_plans sp ON sp.id = ts.plan_id
  WHERE ts.tenant_id = p_tenant_id;
END;
$$;

-- Grant execute to authenticated service role
GRANT EXECUTE ON FUNCTION public.get_tenant_plan_limits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tenant_plan_limits(UUID) TO authenticated;

-- ─────────────────────────────────────────────
-- 4. check_feature_access()
--    Fast boolean check for a single feature key.
--    Returns FALSE if tenant has no subscription or
--    feature doesn't exist on their plan.
--    Also returns FALSE if subscription is expired/cancelled
--    (unless feature_key = 'read_only_access').
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_feature_access(
  p_tenant_id   UUID,
  p_feature_key VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER AS
$$
DECLARE
  v_status    VARCHAR;
  v_is_trial  BOOLEAN;
  v_enabled   BOOLEAN;
BEGIN
  -- Get subscription status
  SELECT
    ts.status,
    (ts.status = 'trialing' AND ts.trial_end > NOW())
  INTO v_status, v_is_trial
  FROM public.tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id;

  -- No subscription found → deny
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Expired / cancelled subscriptions lose feature access
  -- (except a special read_only_access key for graceful degradation)
  IF v_status IN ('cancelled', 'suspended', 'expired') AND p_feature_key <> 'read_only_access' THEN
    -- Grace: still allow basic access to existing data
    RETURN FALSE;
  END IF;

  -- past_due gets 7-day grace on all features before lockout
  -- (scheduler handles transition to expired after grace period)

  -- Check feature flag in plan_features table first (most accurate)
  SELECT pf.is_enabled INTO v_enabled
  FROM public.tenant_subscriptions ts
  JOIN public.plan_features pf ON pf.plan_id = ts.plan_id
  WHERE ts.tenant_id = p_tenant_id
    AND pf.feature_key = p_feature_key;

  IF FOUND THEN
    RETURN COALESCE(v_enabled, FALSE);
  END IF;

  -- Fall back to JSONB features column
  SELECT (sp.features ->> p_feature_key)::BOOLEAN INTO v_enabled
  FROM public.tenant_subscriptions ts
  JOIN public.subscription_plans sp ON sp.id = ts.plan_id
  WHERE ts.tenant_id = p_tenant_id;

  RETURN COALESCE(v_enabled, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_feature_access(UUID, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_feature_access(UUID, VARCHAR) TO authenticated;

-- ─────────────────────────────────────────────
-- 5. Auto-trial trigger on new tenant creation
--    Inserts a Growth-plan trialing subscription
--    whenever a new row is inserted into tenants.
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_auto_trial_on_workspace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS
$$
DECLARE
  v_growth_plan_id UUID;
BEGIN
  -- Look up Growth plan UUID
  SELECT id INTO v_growth_plan_id
  FROM public.subscription_plans
  WHERE slug = 'growth'
  LIMIT 1;

  -- Only proceed if Growth plan exists
  IF v_growth_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert 14-day Growth trial (skip if already has a subscription)
  INSERT INTO public.tenant_subscriptions (
    tenant_id,
    plan_id,
    status,
    billing_period,
    current_period_start,
    current_period_end,
    trial_start,
    trial_end,
    metadata
  )
  VALUES (
    NEW.id,
    v_growth_plan_id,
    'trialing',
    'monthly',
    NOW(),
    NOW() + INTERVAL '14 days',   -- period end = trial end
    NOW(),
    NOW() + INTERVAL '14 days',
    jsonb_build_object('auto_trial', TRUE, 'source', 'workspace_creation')
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop before recreate (idempotent)
DROP TRIGGER IF EXISTS trg_auto_trial_on_workspace ON public.tenants;

CREATE TRIGGER trg_auto_trial_on_workspace
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_trial_on_workspace();

-- ─────────────────────────────────────────────
-- 6. pg_cron: expire trials + downgrade to Free
--    (runs daily at 01:00 UTC)
--    Requires pg_cron extension to be enabled.
-- ─────────────────────────────────────────────

DO $$
BEGIN
  -- Only schedule if pg_cron is available
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove existing job if any
    PERFORM cron.unschedule('expire_trials')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'expire_trials'
    );

    PERFORM cron.schedule(
      'expire_trials',
      '0 1 * * *',   -- 01:00 UTC daily
      $$
        -- 1. Expire trials that ended
        UPDATE public.tenant_subscriptions
        SET
          status    = 'expired',
          updated_at = NOW()
        WHERE status = 'trialing'
          AND trial_end < NOW();

        -- 2. Downgrade expired/past_due (past 7-day grace) → Free
        UPDATE public.tenant_subscriptions ts
        SET
          plan_id   = (SELECT id FROM public.subscription_plans WHERE slug = 'free'),
          status    = 'active',
          updated_at = NOW()
        WHERE ts.status IN ('expired', 'past_due')
          AND ts.updated_at < NOW() - INTERVAL '7 days';
      $$
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 7. Refresh v_tenant_plan view to include
--    trial_ends_at + currency columns
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_tenant_plan AS
SELECT
  ts.tenant_id,
  ts.id                                                         AS subscription_id,
  ts.status                                                     AS sub_status,
  ts.trial_start,
  ts.trial_end                                                  AS trial_ends_at,
  ts.current_period_start,
  ts.current_period_end,
  ts.cancel_at_period_end,
  ts.billing_period,
  sp.id                                                         AS plan_id,
  sp.slug                                                       AS plan_slug,
  sp.name                                                       AS plan_name,
  sp.currency,
  sp.price_monthly,
  sp.price_yearly,
  sp.features,

  -- Effective limits (override takes precedence)
  COALESCE(ts.override_max_events,   sp.max_events)            AS limit_events,
  COALESCE(ts.override_max_team,     sp.max_team_members)      AS limit_team,
  COALESCE(ts.override_max_storage,  sp.max_storage_gb)        AS limit_storage_gb,
  sp.max_guests_per_event                                       AS limit_guests_per_event,
  sp.max_ai_calls_monthly                                       AS limit_ai_calls,
  sp.max_short_links                                            AS limit_short_links,
  sp.max_venues                                                 AS limit_venues,
  sp.max_vendors                                                AS limit_vendors,

  -- Current usage
  ts.usage_events,
  ts.usage_team_members,
  ts.usage_storage_gb,
  ts.usage_ai_calls,
  ts.usage_short_links,
  ts.usage_refreshed_at,

  -- Trial helpers
  (ts.status = 'trialing' AND ts.trial_end > NOW())            AS is_trialing,
  GREATEST(0, EXTRACT(DAY FROM (ts.trial_end - NOW()))::INT)   AS trial_days_remaining,

  -- Access state
  CASE
    WHEN ts.status IN ('trialing', 'active')               THEN 'active'
    WHEN ts.status = 'past_due'                            THEN 'grace'
    WHEN ts.status IN ('cancelled','suspended','expired')  THEN 'locked'
    ELSE 'unknown'
  END                                                           AS access_state
FROM public.tenant_subscriptions ts
JOIN public.subscription_plans sp ON sp.id = ts.plan_id;

-- ─────────────────────────────────────────────
-- 8. Razorpay payment reference columns
--    (safe ADD COLUMN IF NOT EXISTS)
-- ─────────────────────────────────────────────

ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_customer_id      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_plan_id          VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_sub_razorpay
  ON public.tenant_subscriptions(razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────────

-- ============================================================
-- Migration: 067_platform_support_bot.sql
-- ============================================================
-- ============================================================
-- 067_platform_support_bot.sql
-- Platform-level support: FAQ bot, super-admin ticket inbox,
-- conversation threads, and 20 seeded FAQs.
-- ============================================================

-- ── 1. support_faqs — managed by Super Admin only ─────────────────────────────

CREATE TABLE IF NOT EXISTS support_faqs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  keywords    TEXT[]      NOT NULL DEFAULT '{}',
  category    VARCHAR(100) NOT NULL DEFAULT 'General'
                CHECK (category IN ('Billing','Features','Technical','Account','Events','General')),
  sort_order  INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  view_count  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_faqs_category ON support_faqs(category, is_active);
CREATE INDEX IF NOT EXISTS idx_support_faqs_active   ON support_faqs(is_active, sort_order);

ALTER TABLE support_faqs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active FAQs
CREATE POLICY faq_read_active ON support_faqs
  FOR SELECT USING (is_active = TRUE);

-- ── 2. Extend support_tickets with platform-bot fields ───────────────────────
-- The existing table (024) has: tenant_id, title, description, status, priority, reporter_id, etc.
-- We add bot-related + super-admin fields on top.

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS submitted_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject            VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bot_faq_id         UUID REFERENCES support_faqs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalated_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_notes   TEXT,
  ADD COLUMN IF NOT EXISTS super_admin_notes  TEXT;

-- Extend the status CHECK to include bot-handled and escalated values.
-- We drop + re-add the constraint rather than modifying inline (Postgres compatibility).
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN (
    'open','bot_handled','escalated','in_progress',
    'resolved','closed','cancelled','pending_client'
  ));

-- ── 3. support_messages — conversation thread per ticket ─────────────────────

CREATE TABLE IF NOT EXISTS support_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type  TEXT        NOT NULL CHECK (sender_type IN ('user','bot','super_admin')),
  sender_id    UUID,           -- profiles.id; NULL for bot messages
  message      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id, created_at);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Users see messages on tickets that belong to their tenant
CREATE POLICY msg_tenant_read ON support_messages
  FOR SELECT USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY msg_tenant_insert ON support_messages
  FOR INSERT WITH CHECK (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Super Admin sees all tickets / messages (bypasses tenant_isolation)
-- We use a SECURITY DEFINER function approach: add a separate permissive policy.
CREATE POLICY super_admin_full_tickets ON support_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_full_messages ON support_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_full_faqs ON support_faqs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ── 4. updated_at trigger for support_faqs ───────────────────────────────────

CREATE OR REPLACE FUNCTION fn_support_faq_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_faq_updated ON support_faqs;
CREATE TRIGGER trg_support_faq_updated
  BEFORE UPDATE ON support_faqs
  FOR EACH ROW EXECUTE FUNCTION fn_support_faq_updated_at();

-- ── 5. Enable Realtime on support_messages ────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;

-- ── 6. Seed 20 platform FAQs ─────────────────────────────────────────────────

INSERT INTO support_faqs (question, answer, keywords, category, sort_order) VALUES

-- ── Billing (5) ──────────────────────────────────────────────────────────────
(
  'How do I upgrade my plan?',
  'Go to **Settings → Billing** from the left sidebar. You''ll see all available plans with their features. Click "Upgrade" on the plan you want, and you''ll be taken to a secure Razorpay checkout. Your new plan activates immediately after payment.',
  ARRAY['upgrade','plan','billing','payment','subscription','razorpay','checkout'],
  'Billing', 10
),
(
  'Can I switch from monthly to yearly billing?',
  'Yes! Head to **Settings → Billing**, scroll down to your current plan, and click "Switch to Yearly". Yearly plans save you ~17% compared to monthly. Your billing cycle resets from the switch date.',
  ARRAY['yearly','annual','monthly','billing','switch','cycle','save'],
  'Billing', 20
),
(
  'How do I cancel my subscription?',
  'Go to **Settings → Billing** and click "Cancel Subscription" at the bottom of the page. Your access continues until the end of your current billing period. Data is preserved for 90 days after cancellation so you can reactivate anytime.',
  ARRAY['cancel','subscription','end','stop','billing','refund'],
  'Billing', 30
),
(
  'What payment methods are accepted?',
  'We accept all major credit/debit cards (Visa, Mastercard, Rupay), UPI, net banking, and wallets through Razorpay. All payments are processed securely and your card details are never stored on our servers.',
  ARRAY['payment','card','upi','netbanking','wallet','razorpay','accepted','methods'],
  'Billing', 40
),
(
  'What happens when my free trial ends?',
  'Your 14-day Growth trial expires automatically. You''ll see a full-screen prompt to choose a paid plan. Your events, guests, and all data are preserved — nothing is deleted. You have 30 days to reactivate before data cleanup begins.',
  ARRAY['trial','expire','ends','free','data','after','grace'],
  'Billing', 50
),

-- ── Features (4) ─────────────────────────────────────────────────────────────
(
  'How do I invite team members?',
  'Go to **Settings → Team** and click "Invite Member". Enter their email address and select their role (Manager, Coordinator, or Viewer). They''ll receive an email invite valid for 7 days. Team member limits depend on your plan.',
  ARRAY['invite','team','member','add','role','email','staff'],
  'Features', 10
),
(
  'What is the AI assistant and what can it do?',
  'The AI assistant (available on Growth and Agency plans) helps you generate event proposals, draft guest communications, suggest vendor options, forecast budgets, and automate repetitive planning tasks. Access it from any page via the AI button in the top bar.',
  ARRAY['ai','assistant','artificial intelligence','proposal','automation','smart','generate'],
  'Features', 20
),
(
  'Can I create a custom client portal for my clients?',
  'Yes! In any event, go to **Portals → Client Portal** and enable it. Your client gets a branded link where they can approve vendors, view budgets, upload documents, and communicate — all without needing an OccasionPro account.',
  ARRAY['client','portal','branded','link','access','share','approve','collaborate'],
  'Features', 30
),
(
  'Is there a mobile app?',
  'OccasionPro is fully responsive and works great on mobile browsers. A dedicated iOS/Android app is on our roadmap for Q3 2026. In the meantime, you can add the web app to your home screen for an app-like experience.',
  ARRAY['mobile','app','ios','android','phone','tablet','responsive'],
  'Features', 40
),

-- ── Events (4) ───────────────────────────────────────────────────────────────
(
  'How do I add guests to an event?',
  'Open the event, go to the **Guests** tab, and click "Add Guest". You can add individually, bulk-import from CSV (download our template first), or copy guests from a previous event. Each guest gets a unique QR code for check-in.',
  ARRAY['guest','add','import','csv','bulk','rsvp','checkin','qr'],
  'Events', 10
),
(
  'How do I send invitations to guests?',
  'From the Guests tab, select guests and click **Send Invitation**. Choose from email, WhatsApp, or SMS. You can customise the invitation template with your event branding, RSVP link, and a personal message.',
  ARRAY['invitation','send','email','whatsapp','sms','invite','rsvp','message'],
  'Events', 20
),
(
  'Can I set up an online RSVP page?',
  'Yes. In your event settings go to **Microsites → RSVP Page**. Customise the design with your event colors, add a cover photo, meal preferences, dietary requirements, and any custom questions. Share the RSVP link directly or embed it on your website.',
  ARRAY['rsvp','online','form','microsite','website','registration','page','link'],
  'Events', 30
),
(
  'How do I delete an event?',
  'Go to the event, click the three-dot menu (⋯) in the top-right, and select "Delete Event". You''ll be asked to confirm. Deleting an event permanently removes all associated data — guests, tasks, vendors, documents. This cannot be undone.',
  ARRAY['delete','remove','event','archive','cancel','permanently'],
  'Events', 40
),

-- ── Technical (4) ────────────────────────────────────────────────────────────
(
  'How do I export my data?',
  'Go to **Settings → Data & Exports**. You can export guests (CSV/Excel), events summary, vendor contracts, financial reports, and more. Full workspace data exports (ZIP) are available on Growth and Agency plans and are delivered by email within 30 minutes.',
  ARRAY['export','data','download','csv','excel','backup','zip','report'],
  'Technical', 10
),
(
  'Can I connect a custom domain to my client portals?',
  'Yes, on the Agency plan. Go to **Settings → Branding → Custom Domain**, enter your domain (e.g. portal.youreventco.com), and follow the DNS instructions. It typically takes 10–30 minutes to propagate. SSL is automatic.',
  ARRAY['custom','domain','dns','ssl','branding','white label','cname','portal'],
  'Technical', 20
),
(
  'Why is the app running slowly?',
  'Try clearing your browser cache and reloading. OccasionPro works best in Chrome, Edge, or Safari (latest versions). If slowness persists, check your internet connection, disable browser extensions temporarily, and try an incognito window. If the issue continues, please contact support.',
  ARRAY['slow','performance','loading','lag','cache','browser','speed','issue'],
  'Technical', 30
),
(
  'Is my data secure and backed up?',
  'All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We run on Supabase/AWS infrastructure with automated daily backups retained for 30 days. We are SOC 2 compliant and GDPR-ready. View our full security policy at occasionpro.com/security.',
  ARRAY['security','backup','encrypted','data','safe','privacy','gdpr','soc2','compliant'],
  'Technical', 40
),

-- ── Account (3) ──────────────────────────────────────────────────────────────
(
  'How do I change my workspace name or logo?',
  'Go to **Settings → Workspace** and update your workspace name, logo, and brand colors. Changes take effect immediately across all portals and documents generated by OccasionPro.',
  ARRAY['workspace','name','logo','brand','settings','change','update','company'],
  'Account', 10
),
(
  'How do I reset my password?',
  'On the login page, click "Forgot password?" and enter your email. You''ll receive a reset link valid for 1 hour. If you don''t see it, check your spam folder. You can also change your password from **Settings → Profile → Security**.',
  ARRAY['password','reset','forgot','change','login','security','email','account'],
  'Account', 20
),
(
  'Can I have multiple workspaces under one account?',
  'Yes. Click your workspace name in the top-left to open the workspace switcher and select "Create new workspace". Each workspace has its own subscription, team, and events. Switching between them is instant. This is ideal for agencies managing multiple brands.',
  ARRAY['workspace','multiple','switch','new','create','agency','brand','account'],
  'Account', 30
)

ON CONFLICT DO NOTHING;

-- ============================================================
-- Migration: 068_animated_invitations.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 068: Animated Digital Invitation Builder
-- Personalized guest invitation links with themed animated viewer
-- ============================================================

-- ── invitation_templates ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitation_templates (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid         REFERENCES tenants(id) ON DELETE CASCADE,   -- NULL = system template
  name           varchar(100) NOT NULL,
  theme_slug     varchar(50)  NOT NULL,
  thumbnail_url  text,
  config         jsonb        NOT NULL DEFAULT '{}',
  is_system      boolean      NOT NULL DEFAULT true,
  created_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_templates_tenant  ON invitation_templates(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_templates_system  ON invitation_templates(is_system) WHERE is_system = true;
CREATE INDEX IF NOT EXISTS idx_inv_templates_slug    ON invitation_templates(theme_slug);

-- ── event_invitations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_invitations (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_id    uuid         NOT NULL REFERENCES invitation_templates(id),
  custom_config  jsonb        NOT NULL DEFAULT '{}',   -- tenant overrides merged on top of template config
  is_published   boolean      NOT NULL DEFAULT false,
  published_at   timestamptz,
  created_by     uuid         REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(event_id)                                     -- one invitation per event
);

CREATE INDEX IF NOT EXISTS idx_event_inv_event    ON event_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_inv_template ON event_invitations(template_id);

-- ── guest_invitation_links ────────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_invitation_links (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             uuid         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id             uuid         NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  invitation_id        uuid         NOT NULL REFERENCES event_invitations(id) ON DELETE CASCADE,
  short_link_id        uuid         REFERENCES short_links(id) ON DELETE SET NULL,
  personalized_message text,
  is_opened            boolean      NOT NULL DEFAULT false,
  opened_at            timestamptz,
  open_count           integer      NOT NULL DEFAULT 0,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(event_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_gil_event        ON guest_invitation_links(event_id);
CREATE INDEX IF NOT EXISTS idx_gil_guest        ON guest_invitation_links(guest_id);
CREATE INDEX IF NOT EXISTS idx_gil_invitation   ON guest_invitation_links(invitation_id);
CREATE INDEX IF NOT EXISTS idx_gil_short_link   ON guest_invitation_links(short_link_id) WHERE short_link_id IS NOT NULL;

-- ── Trigger: auto-create short_link on guest_invitation_links insert ──
CREATE OR REPLACE FUNCTION fn_create_invitation_short_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code      varchar(10);
  v_link_id   uuid;
  v_tenant_id uuid;
BEGIN
  -- Get tenant_id from the event
  SELECT tenant_id INTO v_tenant_id FROM events WHERE id = NEW.event_id;

  -- Generate unique short code
  v_code := generate_short_code();

  -- Insert the short link record
  INSERT INTO short_links (
    code, tenant_id, event_id, link_type,
    destination_url, guest_id, metadata
  )
  VALUES (
    v_code,
    v_tenant_id,
    NEW.event_id,
    'invitation',
    '/i/' || v_code,
    NEW.guest_id,
    jsonb_build_object('invitation_id', NEW.invitation_id, 'guest_link_id', NEW.id)
  )
  RETURNING id INTO v_link_id;

  -- Back-fill the FK on the row we just inserted
  UPDATE guest_invitation_links
  SET short_link_id = v_link_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invitation_short_link ON guest_invitation_links;
CREATE TRIGGER trg_invitation_short_link
  AFTER INSERT ON guest_invitation_links
  FOR EACH ROW
  WHEN (NEW.short_link_id IS NULL)
  EXECUTE FUNCTION fn_create_invitation_short_link();

-- ── Timestamp trigger for event_invitations ───────────────────
CREATE OR REPLACE FUNCTION fn_event_inv_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_event_inv_updated_at ON event_invitations;
CREATE TRIGGER trg_event_inv_updated_at
  BEFORE UPDATE ON event_invitations
  FOR EACH ROW EXECUTE FUNCTION fn_event_inv_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE invitation_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_invitations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_invitation_links  ENABLE ROW LEVEL SECURITY;

-- System templates readable by all authenticated users
CREATE POLICY inv_templates_system_read ON invitation_templates
  FOR SELECT USING (is_system = true);

-- Tenant custom templates readable/writable by tenant members
CREATE POLICY inv_templates_tenant_all ON invitation_templates
  FOR ALL USING (
    tenant_id IS NOT NULL AND
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

-- Event invitations — tenant members of the event's workspace
CREATE POLICY event_inv_tenant_all ON event_invitations
  FOR ALL USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN tenant_members tm ON tm.tenant_id = e.tenant_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Guest invitation links — tenant members
CREATE POLICY gil_tenant_all ON guest_invitation_links
  FOR ALL USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN tenant_members tm ON tm.tenant_id = e.tenant_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Public read for invitation links (guests open via short link — no auth)
CREATE POLICY gil_public_read ON guest_invitation_links
  FOR SELECT USING (true);

CREATE POLICY event_inv_public_read ON event_invitations
  FOR SELECT USING (is_published = true);

CREATE POLICY inv_templates_public_read ON invitation_templates
  FOR SELECT USING (true);

-- Super admin full access
CREATE POLICY inv_templates_super_admin ON invitation_templates
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY event_inv_super_admin ON event_invitations
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY gil_super_admin ON guest_invitation_links
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Service role bypass (for backend operations)
CREATE POLICY inv_templates_service ON invitation_templates
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY event_inv_service ON event_invitations
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY gil_service ON guest_invitation_links
  FOR ALL USING (auth.role() = 'service_role');

-- ── Seed: 10 System Invitation Themes ────────────────────────
INSERT INTO invitation_templates (id, name, theme_slug, thumbnail_url, config, is_system) VALUES

-- 1. Royal Gold
(gen_random_uuid(), 'Royal Gold', 'royal-gold', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(135deg,#1a0a00 0%,#2d1400 50%,#1a0a00 100%)"},"primaryColor":"#c9a84c","accentColor":"#f5d88a","textColor":"#f5e6c8","fontHeading":"Cormorant Garamond","fontBody":"Libre Baskerville","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["geometric-border","crown-motif","gold-particles"],"musicEnabled":false}',
  true),

-- 2. Minimal White
(gen_random_uuid(), 'Minimal White', 'minimal-white', NULL,
  '{"background":{"type":"solid","value":"#fafafa"},"primaryColor":"#1a1a1a","accentColor":"#888888","textColor":"#1a1a1a","fontHeading":"Playfair Display","fontBody":"Lato","animationStyle":"minimal","animationSpeed":"medium","decorativeElements":["thin-line"],"musicEnabled":false}',
  true),

-- 3. Floral Pink
(gen_random_uuid(), 'Floral Pink', 'floral-pink', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(160deg,#fce4ec 0%,#f8bbd0 40%,#f48fb1 100%)"},"primaryColor":"#c2185b","accentColor":"#e91e63","textColor":"#880e4f","fontHeading":"Dancing Script","fontBody":"Lato","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["rose-petals","floral-border","butterflies"],"musicEnabled":false}',
  true),

-- 4. Dark Luxury
(gen_random_uuid(), 'Dark Luxury', 'dark-luxury', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(180deg,#0a0a0a 0%,#1a1a2e 50%,#0a0a0a 100%)"},"primaryColor":"#e8e8e8","accentColor":"#b8860b","textColor":"#f0f0f0","fontHeading":"Cinzel","fontBody":"Cormorant Garamond","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["diamond-pattern","silver-sparkles","luxury-border"],"musicEnabled":false}',
  true),

-- 5. Pastel Dream
(gen_random_uuid(), 'Pastel Dream', 'pastel-dream', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(135deg,#e0f7fa 0%,#fce4ec 50%,#f3e5f5 100%)"},"primaryColor":"#7b1fa2","accentColor":"#ff6f00","textColor":"#4a148c","fontHeading":"Pacifico","fontBody":"Nunito","animationStyle":"playful","animationSpeed":"medium","decorativeElements":["stars","balloons","confetti-static"],"musicEnabled":false}',
  true),

-- 6. Vibrant Festival
(gen_random_uuid(), 'Vibrant Festival', 'vibrant-festival', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(135deg,#ff6b35 0%,#f7c59f 30%,#efefd0 60%,#004e89 100%)"},"primaryColor":"#ff6b35","accentColor":"#f7c59f","textColor":"#ffffff","fontHeading":"Righteous","fontBody":"Nunito","animationStyle":"vibrant","animationSpeed":"fast","decorativeElements":["fireworks","lanterns","rangoli"],"musicEnabled":false}',
  true),

-- 7. Corporate Blue
(gen_random_uuid(), 'Corporate Blue', 'corporate-blue', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(160deg,#0d1b2a 0%,#1b2838 60%,#162032 100%)"},"primaryColor":"#4fc3f7","accentColor":"#ffffff","textColor":"#e3f2fd","fontHeading":"Montserrat","fontBody":"Open Sans","animationStyle":"minimal","animationSpeed":"medium","decorativeElements":["grid-pattern","circuit-lines"],"musicEnabled":false}',
  true),

-- 8. Rustic Wood
(gen_random_uuid(), 'Rustic Wood', 'rustic-wood', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(180deg,#3e1c00 0%,#6d3a1f 50%,#4e2400 100%)"},"primaryColor":"#d4a853","accentColor":"#f5deb3","textColor":"#faebd7","fontHeading":"Abril Fatface","fontBody":"Merriweather","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["wood-grain","leaves","twine-border"],"musicEnabled":false}',
  true),

-- 9. Starry Night
(gen_random_uuid(), 'Starry Night', 'starry-night', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(180deg,#0a0520 0%,#1a0845 50%,#0a0520 100%)"},"primaryColor":"#a78bfa","accentColor":"#c4b5fd","textColor":"#e9d5ff","fontHeading":"Cormorant Garamond","fontBody":"Lato","animationStyle":"elegant","animationSpeed":"slow","decorativeElements":["animated-stars","moon","constellation-lines"],"musicEnabled":false}',
  true),

-- 10. Neon Party
(gen_random_uuid(), 'Neon Party', 'neon-party', NULL,
  '{"background":{"type":"gradient","value":"linear-gradient(135deg,#0d0d0d 0%,#1a0030 50%,#0d0d0d 100%)"},"primaryColor":"#ff00c8","accentColor":"#00e5ff","textColor":"#ffffff","fontHeading":"Orbitron","fontBody":"Exo 2","animationStyle":"vibrant","animationSpeed":"fast","decorativeElements":["neon-glow","electric-lines","disco-balls"],"musicEnabled":false}',
  true);

COMMENT ON TABLE invitation_templates IS 'System and tenant-custom animated invitation themes';
COMMENT ON TABLE event_invitations IS 'One invitation configuration per event, with template + custom overrides';
COMMENT ON TABLE guest_invitation_links IS 'Per-guest personalized invitation links with open tracking';
COMMENT ON FUNCTION fn_create_invitation_short_link IS 'Auto-creates a short_link entry when a guest invitation link is inserted';

-- ============================================================
-- Migration: 069_floor_plans.sql
-- ============================================================
-- ─────────────────────────────────────────────────────────────────────────────
-- 069_floor_plans.sql  –  Floor Plan Editor tables & helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE zone_type_enum AS ENUM (
    'dining','reception','stage','dance_floor','bar','kitchen','entrance','parking','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE table_type_enum AS ENUM (
    'round','rectangular','cocktail','serpentine','custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── floor_plans ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.floor_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name            varchar(100) NOT NULL DEFAULT 'Main Floor Plan',
  canvas_data     jsonb,
  canvas_width    int NOT NULL DEFAULT 3000,
  canvas_height   int NOT NULL DEFAULT 2000,
  grid_size       int NOT NULL DEFAULT 50,
  scale_label     varchar(20) NOT NULL DEFAULT '1 cell = 1m',
  is_published    bool NOT NULL DEFAULT false,
  thumbnail_url   text,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

-- ── floor_plan_zones ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.floor_plan_zones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id   uuid NOT NULL REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  name            varchar(100) NOT NULL,
  color           varchar(7) NOT NULL DEFAULT '#4f46e5',
  shape_id        varchar(100),
  capacity        int,
  zone_type       zone_type_enum NOT NULL DEFAULT 'other',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── floor_plan_tables ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.floor_plan_tables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id   uuid NOT NULL REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  zone_id         uuid REFERENCES public.floor_plan_zones(id) ON DELETE SET NULL,
  name            varchar(50) NOT NULL DEFAULT 'Table',
  shape_id        varchar(100),
  table_type      table_type_enum NOT NULL DEFAULT 'round',
  capacity        int NOT NULL DEFAULT 8,
  x_pos           decimal(10,2) NOT NULL DEFAULT 0,
  y_pos           decimal(10,2) NOT NULL DEFAULT 0,
  rotation        decimal(6,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── table_guest_assignments ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.table_guest_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id        uuid NOT NULL REFERENCES public.floor_plan_tables(id) ON DELETE CASCADE,
  guest_id        uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  seat_number     int,
  assigned_by     uuid REFERENCES public.profiles(id),
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_id, guest_id),
  UNIQUE NULLS NOT DISTINCT (table_id, seat_number)  -- allow multiple NULLs but unique non-null pairs
);

-- ── Add table_id / seat_number to guests ────────────────────────────────────

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS table_id    uuid REFERENCES public.floor_plan_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seat_number int;

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_floor_plans_event ON public.floor_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_zones_plan ON public.floor_plan_zones(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_tables_plan ON public.floor_plan_tables(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_tables_zone ON public.floor_plan_tables(zone_id);
CREATE INDEX IF NOT EXISTS idx_tga_table ON public.table_guest_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_tga_guest ON public.table_guest_assignments(guest_id);
CREATE INDEX IF NOT EXISTS idx_guests_table ON public.guests(table_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_floor_plan_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_floor_plan_updated_at ON public.floor_plans;
CREATE TRIGGER trg_floor_plan_updated_at
  BEFORE UPDATE ON public.floor_plans
  FOR EACH ROW EXECUTE FUNCTION fn_floor_plan_updated_at();

-- ── Helper function: get_floor_plan_with_assignments ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_floor_plan_with_assignments(p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan        public.floor_plans;
  v_tables      jsonb;
  v_zones       jsonb;
BEGIN
  SELECT * INTO v_plan
    FROM public.floor_plans
   WHERE event_id = p_event_id
   LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- zones
  SELECT coalesce(jsonb_agg(row_to_json(z.*)), '[]'::jsonb)
    INTO v_zones
    FROM public.floor_plan_zones z
   WHERE z.floor_plan_id = v_plan.id;

  -- tables + guests
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',          t.id,
        'name',        t.name,
        'shape_id',    t.shape_id,
        'table_type',  t.table_type,
        'capacity',    t.capacity,
        'x_pos',       t.x_pos,
        'y_pos',       t.y_pos,
        'rotation',    t.rotation,
        'zone_id',     t.zone_id,
        'guests', (
          SELECT coalesce(jsonb_agg(
            jsonb_build_object(
              'assignment_id', a.id,
              'guest_id',      g.id,
              'full_name',     g.full_name,
              'category',      g.category,
              'meal_preference', g.meal_preference,
              'seat_number',   a.seat_number
            )
          ), '[]'::jsonb)
          FROM public.table_guest_assignments a
          JOIN public.guests g ON g.id = a.guest_id
          WHERE a.table_id = t.id
        )
      )
    ), '[]'::jsonb)
    INTO v_tables
    FROM public.floor_plan_tables t
   WHERE t.floor_plan_id = v_plan.id;

  RETURN jsonb_build_object(
    'id',            v_plan.id,
    'event_id',      v_plan.event_id,
    'name',          v_plan.name,
    'canvas_data',   v_plan.canvas_data,
    'canvas_width',  v_plan.canvas_width,
    'canvas_height', v_plan.canvas_height,
    'grid_size',     v_plan.grid_size,
    'scale_label',   v_plan.scale_label,
    'is_published',  v_plan.is_published,
    'thumbnail_url', v_plan.thumbnail_url,
    'created_at',    v_plan.created_at,
    'updated_at',    v_plan.updated_at,
    'zones',         v_zones,
    'tables',        v_tables
  );
END; $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_plan_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_plan_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_guest_assignments ENABLE ROW LEVEL SECURITY;

-- floor_plans
CREATE POLICY fp_team_all ON public.floor_plans FOR ALL
  USING (event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.team_members tm ON tm.tenant_id = e.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  ));

CREATE POLICY fp_guest_read_published ON public.floor_plans FOR SELECT
  USING (is_published = true);

CREATE POLICY fp_service_all ON public.floor_plans FOR ALL
  USING (auth.role() = 'service_role');

-- floor_plan_zones (inherit via floor_plan ownership)
CREATE POLICY fpz_team_all ON public.floor_plan_zones FOR ALL
  USING (floor_plan_id IN (
    SELECT fp.id FROM public.floor_plans fp
    JOIN public.events e ON e.id = fp.event_id
    JOIN public.team_members tm ON tm.tenant_id = e.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  ));
CREATE POLICY fpz_service_all ON public.floor_plan_zones FOR ALL
  USING (auth.role() = 'service_role');

-- floor_plan_tables
CREATE POLICY fpt_team_all ON public.floor_plan_tables FOR ALL
  USING (floor_plan_id IN (
    SELECT fp.id FROM public.floor_plans fp
    JOIN public.events e ON e.id = fp.event_id
    JOIN public.team_members tm ON tm.tenant_id = e.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  ));
CREATE POLICY fpt_service_all ON public.floor_plan_tables FOR ALL
  USING (auth.role() = 'service_role');

-- table_guest_assignments
CREATE POLICY tga_team_all ON public.table_guest_assignments FOR ALL
  USING (table_id IN (
    SELECT t.id FROM public.floor_plan_tables t
    JOIN public.floor_plans fp ON fp.id = t.floor_plan_id
    JOIN public.events e ON e.id = fp.event_id
    JOIN public.team_members tm ON tm.tenant_id = e.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  ));
CREATE POLICY tga_service_all ON public.table_guest_assignments FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- Migration: 070_runsheets.sql
-- ============================================================
-- Migration 070: Runsheets (Event Day Timeline)
-- Real-time collaborative operational runsheet for event day management

-- Item status enum
DO $$ BEGIN
  CREATE TYPE runsheet_item_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'skipped',
  'delayed'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Item category enum
DO $$ BEGIN
  CREATE TYPE runsheet_item_category AS ENUM (
  'Setup',
  'Ceremony',
  'Reception',
  'Performance',
  'Speech',
  'Catering',
  'Technical',
  'Transport',
  'VIP',
  'Media',
  'Rehearsal',
  'Breakdown',
  'Other'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- runsheets (one per event)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title          varchar(100) NOT NULL DEFAULT 'Event Runsheet',
  is_locked      boolean NOT NULL DEFAULT false,
  locked_by      uuid REFERENCES auth.users(id),
  locked_at      timestamptz,
  version        integer NOT NULL DEFAULT 1,
  created_by     uuid NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

-- ─────────────────────────────────────────────
-- runsheet_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheet_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runsheet_id       uuid NOT NULL REFERENCES runsheets(id) ON DELETE CASCADE,
  parent_id         uuid REFERENCES runsheet_items(id) ON DELETE CASCADE,
  position          decimal(12,4) NOT NULL DEFAULT 1000,          -- fractional indexing
  start_time        timestamptz,
  end_time          timestamptz,
  duration_minutes  integer,
  title             varchar(255) NOT NULL,
  description       text,
  category          runsheet_item_category NOT NULL DEFAULT 'Other',
  assigned_to       uuid[] NOT NULL DEFAULT '{}',                  -- team member user IDs
  assigned_vendors  uuid[] NOT NULL DEFAULT '{}',                  -- vendor_account IDs
  status            runsheet_item_status NOT NULL DEFAULT 'pending',
  delay_minutes     integer NOT NULL DEFAULT 0,
  is_guest_visible  boolean NOT NULL DEFAULT false,
  notes             text,
  color             varchar(7),                                    -- hex color e.g. #3b82f6
  is_deleted        boolean NOT NULL DEFAULT false,
  created_by        uuid REFERENCES auth.users(id),
  updated_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- runsheet_item_comments
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheet_item_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES runsheet_items(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  comment     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- runsheet_versions (snapshots)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheet_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runsheet_id  uuid NOT NULL REFERENCES runsheets(id) ON DELETE CASCADE,
  version      integer NOT NULL,
  label        varchar(100),                                       -- optional human label
  snapshot     jsonb NOT NULL,                                     -- full items array
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_runsheets_event     ON runsheets(event_id);
CREATE INDEX IF NOT EXISTS idx_runsheets_tenant    ON runsheets(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runsheet_items_sheet    ON runsheet_items(runsheet_id);
CREATE INDEX IF NOT EXISTS idx_runsheet_items_parent   ON runsheet_items(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_runsheet_items_pos      ON runsheet_items(runsheet_id, position) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_runsheet_items_status   ON runsheet_items(runsheet_id, status) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_runsheet_comments_item  ON runsheet_item_comments(item_id);
CREATE INDEX IF NOT EXISTS idx_runsheet_versions_sheet ON runsheet_versions(runsheet_id, version);

-- ─────────────────────────────────────────────
-- Updated_at triggers
-- ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_runsheets_updated_at ON runsheets;
CREATE TRIGGER set_runsheets_updated_at
  BEFORE UPDATE ON runsheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_runsheet_items_updated_at ON runsheet_items;
CREATE TRIGGER set_runsheet_items_updated_at
  BEFORE UPDATE ON runsheet_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────
-- RLS policies
-- ─────────────────────────────────────────────
ALTER TABLE runsheets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE runsheet_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE runsheet_item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE runsheet_versions     ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_all_runsheets"              ON runsheets             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_runsheet_items"         ON runsheet_items        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_runsheet_comments"      ON runsheet_item_comments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_runsheet_versions"      ON runsheet_versions     FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- Function: auto-save version every 30 min
-- Called from application layer (cron) — placeholder trigger
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_runsheet_version(
  p_runsheet_id uuid,
  p_user_id     uuid,
  p_label       varchar DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_version  integer;
  v_snapshot jsonb;
  v_id       uuid;
BEGIN
  -- Get current version number
  SELECT version INTO v_version FROM runsheets WHERE id = p_runsheet_id;

  -- Build snapshot of all active items
  SELECT jsonb_agg(row_to_json(ri.*) ORDER BY ri.position)
  INTO v_snapshot
  FROM runsheet_items ri
  WHERE ri.runsheet_id = p_runsheet_id
    AND ri.is_deleted = false;

  -- Insert version snapshot
  INSERT INTO runsheet_versions (runsheet_id, version, label, snapshot, created_by)
  VALUES (p_runsheet_id, v_version, p_label, COALESCE(v_snapshot, '[]'::jsonb), p_user_id)
  RETURNING id INTO v_id;

  -- Bump runsheet version
  UPDATE runsheets SET version = version + 1, updated_at = now()
  WHERE id = p_runsheet_id;

  RETURN v_id;
END;
$$;

-- ─────────────────────────────────────────────
-- Realtime: enable for collaborative editing
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE runsheet_items;
ALTER PUBLICATION supabase_realtime ADD TABLE runsheet_item_comments;

