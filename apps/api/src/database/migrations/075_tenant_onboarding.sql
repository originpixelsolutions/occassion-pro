-- Migration 075: Tenant Onboarding Tracking
-- Adds onboarding state columns to the tenants table.
--
-- onboarding_step        — last completed wizard step (0 = not started, 1-5 = step N done)
-- onboarding_completed_at — timestamp when the wizard was fully completed (NULL = not done)
--
-- The onboarding wizard shows on first login if onboarding_completed_at IS NULL.
-- Steps:
--   0  Not started
--   1  Welcome + company setup
--   2  First event quick-create
--   3  Invite team
--   4  Feature tour
--   5  Celebration (wizard complete) — sets onboarding_completed_at

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS onboarding_step          INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at  TIMESTAMPTZ;

-- Tenants created before this migration are considered already onboarded.
-- Mark existing tenants as onboarding complete so they don't see the wizard.
UPDATE tenants
SET
  onboarding_step         = 5,
  onboarding_completed_at = NOW()
WHERE onboarding_completed_at IS NULL;

-- Index to quickly find tenants that still need onboarding
CREATE INDEX IF NOT EXISTS idx_tenants_onboarding_pending
  ON tenants (id)
  WHERE onboarding_completed_at IS NULL;

COMMENT ON COLUMN tenants.onboarding_step IS
  'Last completed onboarding wizard step (0 = not started, 1-5 = step N completed)';

COMMENT ON COLUMN tenants.onboarding_completed_at IS
  'Timestamp when the onboarding wizard was fully completed. NULL = not yet onboarded.';
