-- ============================================================
-- OccasionPro — Migration 075: Tenant Onboarding
--
-- Adds onboarding wizard state columns to the tenants table.
-- Referenced by: tenants.service.ts → getOnboardingStatus / advanceStep
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS onboarding_step          int          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at  timestamptz;

COMMENT ON COLUMN tenants.onboarding_step IS
  '0 = not started; 1–4 = wizard step; 5 = complete (also sets onboarding_completed_at)';

COMMENT ON COLUMN tenants.onboarding_completed_at IS
  'Set when onboarding_step reaches 5. NULL means onboarding is still in progress.';

-- Index for super-admin onboarding funnel queries
CREATE INDEX IF NOT EXISTS idx_tenants_onboarding_step
  ON tenants(onboarding_step)
  WHERE onboarding_completed_at IS NULL;
