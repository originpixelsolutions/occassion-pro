-- ─────────────────────────────────────────────────────────────────────────────
-- tenant_branding — per-tenant white-label design token storage
-- Each row holds the full CSS variable set for one tenant.
-- Super Admin can set platform-wide defaults (tenant_id IS NULL) 
-- or override per tenant.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_branding (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES public.tenants(id) ON DELETE CASCADE,  -- NULL = platform default
  -- Core palette (stored as raw HSL channels, e.g. "263 72% 58%")
  primary_hsl         TEXT NOT NULL DEFAULT '263 72% 58%',   -- violet
  secondary_hsl       TEXT NOT NULL DEFAULT '38 92% 50%',    -- gold
  accent_hsl          TEXT NOT NULL DEFAULT '25 95% 53%',    -- coral
  danger_hsl          TEXT NOT NULL DEFAULT '0 84% 60%',
  success_hsl         TEXT NOT NULL DEFAULT '160 84% 39%',
  info_hsl            TEXT NOT NULL DEFAULT '199 89% 48%',
  -- Surfaces (light)
  background_light_hsl TEXT NOT NULL DEFAULT '0 0% 98%',
  card_light_hsl       TEXT NOT NULL DEFAULT '0 0% 100%',
  border_light_hsl     TEXT NOT NULL DEFAULT '220 13% 91%',
  -- Surfaces (dark)
  background_dark_hsl  TEXT NOT NULL DEFAULT '240 14% 7%',
  card_dark_hsl        TEXT NOT NULL DEFAULT '240 13% 10%',
  border_dark_hsl      TEXT NOT NULL DEFAULT '240 10% 22%',
  -- Brand assets
  logo_url            TEXT,
  favicon_url         TEXT,
  -- Typography
  font_family         TEXT NOT NULL DEFAULT 'Inter',
  font_url            TEXT,                                   -- Google Fonts embed URL
  -- Shape
  border_radius       TEXT NOT NULL DEFAULT 'default',       -- 'sharp'|'default'|'rounded'|'pill'
  -- Defaults
  dark_mode_default   BOOLEAN NOT NULL DEFAULT true,
  -- Meta
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)   -- one branding row per tenant (NULL = platform)
);

-- Row-level security
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;

-- Super admins can read/write all rows
CREATE POLICY "super_admin_full_access" ON public.tenant_branding
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
    )
  );

-- Tenant members can read their own branding
CREATE POLICY "tenant_member_read" ON public.tenant_branding
  FOR SELECT
  USING (
    tenant_id IS NULL  -- platform default is public
    OR tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS tenant_branding_updated_at ON public.tenant_branding;
CREATE TRIGGER tenant_branding_updated_at
  BEFORE UPDATE ON public.tenant_branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed platform-wide defaults (tenant_id = NULL)
INSERT INTO public.tenant_branding (tenant_id) VALUES (NULL)
ON CONFLICT (tenant_id) DO NOTHING;
