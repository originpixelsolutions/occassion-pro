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
