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
