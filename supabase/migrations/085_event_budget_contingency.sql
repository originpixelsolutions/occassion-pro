-- ============================================================
-- Migration 085: Event Budget Items & Contingency Plans
-- ============================================================
-- Creates event-scoped tables for:
--   1. event_budget_items  — per-event budget line items with status tracking
--   2. event_contingency_plans — crisis/scenario plans with risk levels
-- Both tables are multi-tenant (tenant_id) and RLS-protected.
-- ============================================================

-- ── 1. event_budget_items ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_budget_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Category grouping (matches UI: Venue, Catering, AV/Tech, Décor, etc.)
  category_id      TEXT        NOT NULL DEFAULT 'other',
  category_name    TEXT        NOT NULL DEFAULT 'Other',

  -- Line item details
  description      TEXT        NOT NULL,
  estimated_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_amount    NUMERIC(14,2) DEFAULT 0,

  -- Approval/payment lifecycle
  status           TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','paid','overbudget')),

  -- Optional metadata
  vendor_name      TEXT,
  notes            TEXT,
  paid_at          TIMESTAMPTZ,

  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_budget_items_event
  ON event_budget_items (event_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_event_budget_items_tenant
  ON event_budget_items (tenant_id);

CREATE INDEX IF NOT EXISTS idx_event_budget_items_status
  ON event_budget_items (status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_event_budget_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_budget_items_updated_at ON event_budget_items;
CREATE TRIGGER trg_event_budget_items_updated_at
  BEFORE UPDATE ON event_budget_items
  FOR EACH ROW EXECUTE FUNCTION update_event_budget_items_updated_at();

-- RLS
ALTER TABLE event_budget_items ENABLE ROW LEVEL SECURITY;

-- Tenant isolation: users can only see/modify items for their own tenant
CREATE POLICY "event_budget_items_tenant_isolation"
  ON event_budget_items
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Service role bypass for server-side operations
CREATE POLICY "event_budget_items_service_role"
  ON event_budget_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── 2. event_contingency_plans ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_contingency_plans (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Scenario identification
  scenario            TEXT        NOT NULL,
  category            TEXT        NOT NULL DEFAULT 'general',

  -- Risk classification
  risk_level          TEXT        NOT NULL DEFAULT 'medium'
                      CHECK (risk_level IN ('low','medium','high','critical')),

  -- Plan content (stored as text; may contain newline-separated action steps)
  trigger_conditions  TEXT,
  response_actions    TEXT,

  -- Ownership
  responsible_person  TEXT,
  contact_number      TEXT,

  -- Lifecycle
  status              TEXT        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','reviewed','activated')),

  reviewed_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  activated_at        TIMESTAMPTZ,

  created_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_contingency_plans_event
  ON event_contingency_plans (event_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_event_contingency_plans_tenant
  ON event_contingency_plans (tenant_id);

CREATE INDEX IF NOT EXISTS idx_event_contingency_plans_risk
  ON event_contingency_plans (risk_level);

CREATE INDEX IF NOT EXISTS idx_event_contingency_plans_status
  ON event_contingency_plans (status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_event_contingency_plans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_contingency_plans_updated_at ON event_contingency_plans;
CREATE TRIGGER trg_event_contingency_plans_updated_at
  BEFORE UPDATE ON event_contingency_plans
  FOR EACH ROW EXECUTE FUNCTION update_event_contingency_plans_updated_at();

-- RLS
ALTER TABLE event_contingency_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_contingency_plans_tenant_isolation"
  ON event_contingency_plans
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "event_contingency_plans_service_role"
  ON event_contingency_plans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── 3. Comments ───────────────────────────────────────────────────────────────
COMMENT ON TABLE event_budget_items IS
  'Per-event budget line items with category grouping, estimated vs actual amounts, and approval status tracking.';

COMMENT ON TABLE event_contingency_plans IS
  'Crisis scenario contingency plans for events, including trigger conditions, response actions, risk classification, and activation lifecycle.';
