-- ============================================================
-- OccasionPro — Migration 011: AI Tracking & Platform Tables
-- ============================================================

-- ── AI GENERATIONS (log every AI output) ─────────────────────
CREATE TABLE IF NOT EXISTS ai_generations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type            ai_gen_type NOT NULL,
  model           TEXT NOT NULL,          -- gpt-4o | claude-3-5-sonnet | gemini-1.5-pro | etc.
  prompt_tokens   INTEGER,
  completion_tokens INTEGER,
  total_tokens    INTEGER,
  latency_ms      INTEGER,
  resource_type   TEXT,                   -- events | leads | guests | etc.
  resource_id     UUID,
  prompt          TEXT,
  output          TEXT,
  was_accepted    BOOLEAN,                -- did user accept/use this output?
  feedback        TEXT,
  cost_usd        NUMERIC(10,6),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_tenant ON ai_generations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_user ON ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_type ON ai_generations(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_ai_created ON ai_generations(created_at DESC);

-- ── AI USAGE QUOTAS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_monthly (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month           DATE NOT NULL,           -- first day of month
  total_tokens    BIGINT DEFAULT 0,
  total_cost_usd  NUMERIC(12,6) DEFAULT 0,
  generation_count INTEGER DEFAULT 0,
  quota_limit     BIGINT,                  -- monthly token limit per plan
  is_limit_hit    BOOLEAN DEFAULT false,
  UNIQUE(tenant_id, month)
);

CREATE INDEX IF NOT EXISTS idx_aiu_tenant ON ai_usage_monthly(tenant_id);

-- ── TEAM SHIFTS & ASSIGNMENTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS team_shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_label      TEXT,                   -- e.g. "Stage Manager", "Registration Desk"
  shift_start     TIMESTAMPTZ NOT NULL,
  shift_end       TIMESTAMPTZ NOT NULL,
  location        TEXT,
  is_confirmed    BOOLEAN DEFAULT false,
  confirmed_at    TIMESTAMPTZ,
  checked_in_at   TIMESTAMPTZ,
  checked_out_at  TIMESTAMPTZ,
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_event ON team_shifts(event_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON team_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_start ON team_shifts(shift_start);

-- ── COMMENTS / ACTIVITY FEED ─────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type   TEXT NOT NULL,          -- events | tasks | leads | invoices | vendors | guests
  resource_id     UUID NOT NULL,
  author_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  attachments     TEXT[] DEFAULT '{}',
  mentions        UUID[] DEFAULT '{}',    -- user IDs mentioned
  parent_id       UUID REFERENCES comments(id), -- replies
  is_edited       BOOLEAN DEFAULT false,
  edited_at       TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_resource ON comments(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_comments_tenant ON comments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);

-- ── WEBHOOKS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  secret          TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events          TEXT[] NOT NULL DEFAULT '{}',  -- event types to trigger on
  is_active       BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  failure_count   INTEGER DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);

-- ── WEBHOOK DELIVERY LOG ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  webhook_id      UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         JSONB DEFAULT '{}',
  status_code     INTEGER,
  response_body   TEXT,
  duration_ms     INTEGER,
  is_success      BOOLEAN,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','retrying')),
  attempt_count   INTEGER DEFAULT 0,
  retry_count     INTEGER DEFAULT 0,
  next_retry_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wd_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_wd_created ON webhook_deliveries(created_at DESC);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS shifts_updated_at ON team_shifts;
CREATE TRIGGER shifts_updated_at BEFORE UPDATE ON team_shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS webhooks_updated_at ON webhooks;
CREATE TRIGGER webhooks_updated_at BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
