-- ============================================================
-- Migration 092: Webhook Automation Builder
-- ============================================================
-- Provides a no-code automation rules engine for event operations.
-- Each rule has a trigger (an event occurrence) and a list of
-- actions to execute in sequence when the trigger fires.
--
-- Tables:
--   automation_rules       — rule definitions (trigger + actions)
--   automation_executions  — execution log per trigger occurrence
--   automation_action_logs — per-action log within an execution
-- ============================================================

-- ── Trigger type enum ─────────────────────────────────────────────────────────

CREATE TYPE automation_trigger_type AS ENUM (
  -- Guest lifecycle
  'guest.rsvp_confirmed',
  'guest.rsvp_declined',
  'guest.rsvp_maybe',
  'guest.checked_in',
  'guest.added',

  -- Payment
  'payment.received',
  'payment.overdue',
  'payment.refunded',

  -- Task
  'task.completed',
  'task.overdue',
  'task.created',
  'task.assigned',

  -- Vendor
  'vendor.confirmed',
  'vendor.cancelled',
  'vendor.invoice_uploaded',

  -- Budget
  'budget.category_overspent',
  'budget.total_threshold',     -- % of total budget spent crosses threshold

  -- Event lifecycle
  'event.day_before',
  'event.hours_before_6',
  'event.started',
  'event.completed',

  -- WhatsApp
  'whatsapp.reply_received',
  'whatsapp.opt_out',

  -- Manual
  'manual.trigger'              -- user presses a button in the UI
);

-- ── Action type enum ──────────────────────────────────────────────────────────

CREATE TYPE automation_action_type AS ENUM (
  'webhook.http',         -- POST to external URL
  'email.send',           -- send email via EmailService
  'whatsapp.send',        -- send WhatsApp message
  'sms.send',             -- send SMS
  'task.create',          -- create a task on the event
  'task.assign',          -- assign an existing task
  'notification.internal',-- push internal platform notification
  'field.update',         -- update a field on an entity (guests, vendors, etc.)
  'delay.wait',           -- pause N seconds/minutes before next action
  'condition.branch'      -- if/else condition to skip subsequent actions
);

-- ── Execution status ──────────────────────────────────────────────────────────

CREATE TYPE automation_exec_status AS ENUM (
  'pending', 'running', 'success', 'partial_failure', 'failed', 'skipped'
);

-- ── Rule definitions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,  -- null = global rule for all events

  -- Identity
  name          TEXT NOT NULL,
  description   TEXT,

  -- Trigger
  trigger_type  automation_trigger_type NOT NULL,
  trigger_filters JSONB DEFAULT '{}',
  -- Examples:
  --   guest.rsvp_confirmed + {"dietary": ["vegan"]}     → only for vegan guests
  --   payment.received     + {"method": "bank_transfer"} → only bank transfers
  --   task.overdue         + {"category": "catering"}   → only catering tasks
  --   budget.total_threshold + {"threshold_pct": 80}    → when 80% spent

  -- Actions array — ordered list, executed in sequence
  actions       JSONB NOT NULL DEFAULT '[]',
  -- Each action object shape:
  -- {
  --   "id": "uuid",
  --   "type": "webhook.http",
  --   "label": "Notify Slack",
  --   "config": {
  --     "url": "https://hooks.slack.com/...",
  --     "method": "POST",
  --     "headers": {"Content-Type": "application/json"},
  --     "body_template": "{\"text\": \"Guest {{guest.name}} RSVP confirmed for {{event.name}}\"}",
  --     "timeout_ms": 5000,
  --     "retry_count": 2
  --   }
  -- }
  --
  -- email.send config: { to_template, subject_template, body_template, cc }
  -- whatsapp.send config: { to_field (e.g. "guest.phone"), body_template }
  -- task.create config: { title_template, description_template, category, assigned_to, due_days_offset }
  -- delay.wait config: { seconds: 60 }
  -- condition.branch config: { field, operator, value, skip_actions_on_false: [action_id] }

  -- Control
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  run_once      BOOLEAN NOT NULL DEFAULT FALSE,  -- fire only the first time trigger occurs

  -- Rate-limiting
  cooldown_seconds INT DEFAULT 0,               -- minimum seconds between firings for the same context key
  max_executions   INT,                         -- max total fires (null = unlimited)

  -- Stats
  execution_count   INT NOT NULL DEFAULT 0,
  last_fired_at     TIMESTAMPTZ,
  last_success_at   TIMESTAMPTZ,
  last_failure_at   TIMESTAMPTZ,

  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auto_rules_tenant   ON automation_rules(tenant_id);
CREATE INDEX idx_auto_rules_event    ON automation_rules(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_auto_rules_trigger  ON automation_rules(trigger_type);
CREATE INDEX idx_auto_rules_active   ON automation_rules(is_active) WHERE is_active = TRUE;

-- ── Execution log ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,

  -- What fired the rule
  trigger_type    automation_trigger_type NOT NULL,
  trigger_context JSONB DEFAULT '{}',
  -- e.g. { "guest_id": "uuid", "guest_name": "Priya", "rsvp_status": "confirmed" }
  -- e.g. { "payment_id": "uuid", "amount": 50000, "method": "bank_transfer" }

  -- Overall result
  status          automation_exec_status NOT NULL DEFAULT 'pending',
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,

  -- Summary counts
  actions_total   INT NOT NULL DEFAULT 0,
  actions_success INT NOT NULL DEFAULT 0,
  actions_failed  INT NOT NULL DEFAULT 0,
  actions_skipped INT NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auto_exec_rule     ON automation_executions(rule_id);
CREATE INDEX idx_auto_exec_tenant   ON automation_executions(tenant_id);
CREATE INDEX idx_auto_exec_event    ON automation_executions(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_auto_exec_status   ON automation_executions(status);
CREATE INDEX idx_auto_exec_created  ON automation_executions(created_at DESC);

-- ── Per-action log within an execution ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_action_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id    UUID NOT NULL REFERENCES automation_executions(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Which action
  action_index    INT NOT NULL,            -- 0-based position in the rule's actions array
  action_id       TEXT,                    -- the "id" field from the action object
  action_type     automation_action_type NOT NULL,
  action_label    TEXT,

  -- Result
  status          automation_exec_status NOT NULL DEFAULT 'pending',
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,

  -- HTTP webhook specifics
  http_status_code  INT,
  http_response     TEXT,
  http_duration_ms  INT,

  -- General
  output            JSONB DEFAULT '{}',
  error_message     TEXT,
  retry_count       INT NOT NULL DEFAULT 0,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auto_action_log_exec ON automation_action_logs(execution_id);
CREATE INDEX idx_auto_action_log_type ON automation_action_logs(action_type);

-- ── Triggers: updated_at ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_automation_rule_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_auto_rule_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_automation_rule_updated_at();

-- ── Trigger: increment execution_count on rule ───────────────────────────────

CREATE OR REPLACE FUNCTION increment_rule_execution_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('success', 'partial_failure', 'failed') AND OLD.status = 'running' THEN
    UPDATE automation_rules
    SET
      execution_count = execution_count + 1,
      last_fired_at   = NEW.started_at,
      last_success_at = CASE WHEN NEW.status IN ('success','partial_failure') THEN now() ELSE last_success_at END,
      last_failure_at = CASE WHEN NEW.status = 'failed' THEN now() ELSE last_failure_at END,
      updated_at      = now()
    WHERE id = NEW.rule_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_auto_exec_rule_stats
  AFTER UPDATE OF status ON automation_executions
  FOR EACH ROW EXECUTE FUNCTION increment_rule_execution_count();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE automation_rules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_action_logs    ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_rules_tenant ON automation_rules
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY auto_exec_tenant ON automation_executions
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY auto_action_log_tenant ON automation_action_logs
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── Realtime (execution log) ──────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE automation_executions;
ALTER PUBLICATION supabase_realtime ADD TABLE automation_action_logs;
