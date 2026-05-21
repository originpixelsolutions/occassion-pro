-- ============================================================
-- Migration 058 — Subscription Plans & Feature Enforcement
-- ============================================================

-- ─────────────────────────────────────────────
-- Plan definitions (system-level, seeded)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  VARCHAR(30) NOT NULL UNIQUE,
  name                  VARCHAR(50) NOT NULL,
  description           TEXT,
  price_monthly         NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly          NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency              VARCHAR(3) NOT NULL DEFAULT 'USD',
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  is_public             BOOLEAN NOT NULL DEFAULT TRUE,
  trial_days            INT NOT NULL DEFAULT 0,
  sort_order            INT NOT NULL DEFAULT 0,

  -- Hard limits (NULL = unlimited)
  max_events            INT,
  max_guests_per_event  INT,
  max_team_members      INT,
  max_storage_gb        NUMERIC(6,2),
  max_ai_calls_monthly  INT,
  max_short_links       INT,
  max_venues            INT,
  max_vendors           INT,

  -- Feature flags (JSONB for flexibility)
  features              JSONB NOT NULL DEFAULT '{}',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Tenant subscriptions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id           UUID NOT NULL REFERENCES public.subscription_plans(id),
  status            VARCHAR(30) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('trialing','active','past_due','cancelled','suspended','expired')),

  -- Billing cycle
  billing_period    VARCHAR(10) NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','yearly','lifetime')),
  current_period_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  trial_start           TIMESTAMPTZ,
  trial_end             TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Payment provider reference
  payment_provider      VARCHAR(30),
  external_subscription_id VARCHAR(200),
  external_customer_id     VARCHAR(200),

  -- Usage snapshot (refreshed daily by scheduler)
  usage_events          INT NOT NULL DEFAULT 0,
  usage_team_members    INT NOT NULL DEFAULT 0,
  usage_storage_gb      NUMERIC(6,2) NOT NULL DEFAULT 0,
  usage_ai_calls        INT NOT NULL DEFAULT 0,
  usage_short_links     INT NOT NULL DEFAULT 0,
  usage_refreshed_at    TIMESTAMPTZ,

  -- Override limits (Super Admin can grant extra capacity)
  override_max_events   INT,
  override_max_team     INT,
  override_max_storage  NUMERIC(6,2),

  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id)  -- one active subscription per tenant
);

CREATE INDEX IF NOT EXISTS idx_sub_tenant   ON public.tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_status   ON public.tenant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_sub_plan     ON public.tenant_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_sub_trial    ON public.tenant_subscriptions(trial_end) WHERE status = 'trialing';

-- ─────────────────────────────────────────────
-- Plan change history
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_change_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_plan_id    UUID REFERENCES public.subscription_plans(id),
  to_plan_id      UUID NOT NULL REFERENCES public.subscription_plans(id),
  changed_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason          TEXT,
  effective_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Seed: 4 plan tiers
-- ─────────────────────────────────────────────
INSERT INTO public.subscription_plans
  (id, slug, name, description, price_monthly, price_yearly, trial_days, sort_order,
   max_events, max_guests_per_event, max_team_members, max_storage_gb,
   max_ai_calls_monthly, max_short_links, max_venues, max_vendors, features)
VALUES
  -- FREE
  (
    'a0000000-0000-0000-0000-000000000001',
    'free', 'Free', 'For individuals testing the platform',
    0, 0, 0, 0,
    3, 50, 3, 1,
    20, 5, 2, 5,
    '{"ai_assistant":false,"ai_proposals":false,"ai_budget_optimizer":false,"white_label":false,
      "custom_domain":false,"api_access":false,"multi_currency":false,"advanced_analytics":false,
      "guest_portal":true,"vendor_portal":false,"client_portal":false,"audit_trail":false,
      "playbooks":false,"document_generation":false,"animated_invitations":false,
      "short_links":true,"event_types_custom":false,"offline_checkin":false,
      "payment_processing":false,"realtime_collaboration":false,"priority_support":false}'
  ),
  -- STARTER
  (
    'a0000000-0000-0000-0000-000000000002',
    'starter', 'Starter', 'For small event businesses getting started',
    29, 290, 0, 1,
    20, 300, 10, 10,
    100, 50, 5, 20,
    '{"ai_assistant":true,"ai_proposals":false,"ai_budget_optimizer":false,"white_label":false,
      "custom_domain":false,"api_access":false,"multi_currency":true,"advanced_analytics":false,
      "guest_portal":true,"vendor_portal":true,"client_portal":true,"audit_trail":true,
      "playbooks":true,"document_generation":true,"animated_invitations":true,
      "short_links":true,"event_types_custom":true,"offline_checkin":false,
      "payment_processing":true,"realtime_collaboration":false,"priority_support":false}'
  ),
  -- GROWTH (with 14-day free trial)
  (
    'a0000000-0000-0000-0000-000000000003',
    'growth', 'Growth', 'For growing event companies — includes 14-day free trial',
    79, 790, 14, 2,
    100, 2000, 25, 50,
    500, 200, 20, 100,
    '{"ai_assistant":true,"ai_proposals":true,"ai_budget_optimizer":true,"white_label":false,
      "custom_domain":true,"api_access":true,"multi_currency":true,"advanced_analytics":true,
      "guest_portal":true,"vendor_portal":true,"client_portal":true,"audit_trail":true,
      "playbooks":true,"document_generation":true,"animated_invitations":true,
      "short_links":true,"event_types_custom":true,"offline_checkin":true,
      "payment_processing":true,"realtime_collaboration":true,"priority_support":false}'
  ),
  -- AGENCY (unlimited)
  (
    'a0000000-0000-0000-0000-000000000004',
    'agency', 'Agency', 'For large event agencies — unlimited everything',
    199, 1990, 0, 3,
    NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    '{"ai_assistant":true,"ai_proposals":true,"ai_budget_optimizer":true,"white_label":true,
      "custom_domain":true,"api_access":true,"multi_currency":true,"advanced_analytics":true,
      "guest_portal":true,"vendor_portal":true,"client_portal":true,"audit_trail":true,
      "playbooks":true,"document_generation":true,"animated_invitations":true,
      "short_links":true,"event_types_custom":true,"offline_checkin":true,
      "payment_processing":true,"realtime_collaboration":true,"priority_support":true}'
  )
ON CONFLICT (slug) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  features      = EXCLUDED.features,
  updated_at    = NOW();

-- ─────────────────────────────────────────────
-- Default all existing tenants to Free plan
-- ─────────────────────────────────────────────
INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status)
SELECT
  t.id,
  'a0000000-0000-0000-0000-000000000001'::UUID,
  'active'
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_subscriptions ts WHERE ts.tenant_id = t.id
)
ON CONFLICT (tenant_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- Computed view: tenant plan limits + current usage
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_tenant_plan AS
SELECT
  ts.tenant_id,
  ts.status                                             AS sub_status,
  ts.trial_end,
  ts.current_period_end,
  ts.cancel_at_period_end,
  sp.slug                                               AS plan_slug,
  sp.name                                               AS plan_name,
  sp.features,
  sp.price_monthly,
  -- Effective limits (override takes precedence)
  COALESCE(ts.override_max_events,   sp.max_events)    AS limit_events,
  COALESCE(ts.override_max_team,     sp.max_team_members) AS limit_team,
  COALESCE(ts.override_max_storage,  sp.max_storage_gb)   AS limit_storage_gb,
  sp.max_guests_per_event                               AS limit_guests_per_event,
  sp.max_ai_calls_monthly                               AS limit_ai_calls,
  sp.max_short_links                                    AS limit_short_links,
  sp.max_venues                                         AS limit_venues,
  sp.max_vendors                                        AS limit_vendors,
  -- Current usage
  ts.usage_events,
  ts.usage_team_members,
  ts.usage_storage_gb,
  ts.usage_ai_calls,
  ts.usage_short_links,
  ts.usage_refreshed_at,
  -- Is trial active?
  (ts.status = 'trialing' AND ts.trial_end > NOW())    AS is_trialing,
  -- Days left in trial
  GREATEST(0, EXTRACT(DAY FROM (ts.trial_end - NOW()))::INT) AS trial_days_remaining
FROM public.tenant_subscriptions ts
JOIN public.subscription_plans sp ON sp.id = ts.plan_id;

-- ─────────────────────────────────────────────
-- Updated-at triggers
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_sub_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_sub_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER trg_sub_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_sub_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_subs_updated_at ON public.tenant_subscriptions;
CREATE TRIGGER trg_tenant_subs_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_sub_updated_at();

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.subscription_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_change_history   ENABLE ROW LEVEL SECURITY;

-- Plans are public-readable
CREATE POLICY "plans_public_read" ON public.subscription_plans
  FOR SELECT USING (is_public = TRUE);

-- Tenant can only read their own subscription
CREATE POLICY "sub_tenant_read" ON public.tenant_subscriptions
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "plan_history_tenant_read" ON public.plan_change_history
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

-- Data preservation: mark subscription expired after 30-day grace post-cancellation
-- (handled by scheduler in super-admin automation engine)
