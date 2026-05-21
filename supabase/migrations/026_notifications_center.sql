-- ============================================================
-- OccasionPro — Migration 026: Notifications Center
-- In-app notifications, preferences, templates, broadcast
-- ============================================================

-- ── IN-APP NOTIFICATIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN ('event','finance','support','operations','team','system','ai','general')),
  title         TEXT NOT NULL,
  body          TEXT,
  action_url    TEXT,
  action_label  TEXT,
  icon          TEXT,                     -- lucide icon name
  metadata      JSONB NOT NULL DEFAULT '{}',
  is_read       BOOLEAN NOT NULL DEFAULT false,
  is_archived   BOOLEAN NOT NULL DEFAULT false,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── NOTIFICATION PREFERENCES (per user, per channel) ──────
CREATE TABLE IF NOT EXISTS notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,           -- matches notifications.category
  event_type      TEXT,                    -- NULL = applies to all in category
  in_app          BOOLEAN NOT NULL DEFAULT true,
  email           BOOLEAN NOT NULL DEFAULT true,
  whatsapp        BOOLEAN NOT NULL DEFAULT false,
  sms             BOOLEAN NOT NULL DEFAULT false,
  push            BOOLEAN NOT NULL DEFAULT true,
  digest          BOOLEAN NOT NULL DEFAULT false,  -- include in daily digest
  quiet_hours_start TIME,                          -- e.g. 22:00
  quiet_hours_end   TIME,                          -- e.g. 07:00
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique preference per user/category/event_type (NULL-safe)
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_prefs_with_type
  ON notification_preferences(tenant_id, user_id, category, event_type)
  WHERE event_type IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_prefs_no_type
  ON notification_preferences(tenant_id, user_id, category)
  WHERE event_type IS NULL;

-- ── NOTIFICATION TEMPLATES ────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  event_type      TEXT NOT NULL UNIQUE,
  category        TEXT NOT NULL,
  title_template  TEXT NOT NULL,   -- handlebars-style {{variable}}
  body_template   TEXT,
  email_subject   TEXT,
  email_body      TEXT,
  whatsapp_template TEXT,
  sms_template    TEXT,
  variables       TEXT[] DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── BROADCAST NOTIFICATIONS ───────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  target        TEXT NOT NULL DEFAULT 'all'
                  CHECK (target IN ('all','role','event','custom')),
  target_roles  TEXT[],
  target_event_id UUID,
  channels      TEXT[] NOT NULL DEFAULT '{in_app}',
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at  TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  recipient_count INTEGER,
  delivered_count INTEGER,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant  ON notifications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_id) WHERE is_read = false AND is_archived = false;
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user      ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_tmpl_tenant     ON notification_templates(tenant_id);

-- ── ROW-LEVEL SECURITY ────────────────────────────────────
ALTER TABLE notifications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_notifications    ENABLE ROW LEVEL SECURITY;

-- Users see only their own notifications
CREATE POLICY notif_user ON notifications
  USING (user_id = auth.uid());
CREATE POLICY notif_prefs_user ON notification_preferences
  USING (user_id = auth.uid());
CREATE POLICY notif_tmpl_tenant ON notification_templates
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY broadcast_tenant ON broadcast_notifications
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── TRIGGERS ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notifications_read_at ON notifications;
CREATE TRIGGER notifications_read_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION auto_read_at();

-- ── SEED: DEFAULT NOTIFICATION TEMPLATES ─────────────────
INSERT INTO notification_templates(tenant_id, name, event_type, category, title_template, body_template, variables, email_subject)
SELECT
  t.id,
  tmpl.name,
  tmpl.event_type,
  tmpl.category,
  tmpl.title_template,
  tmpl.body_template,
  tmpl.variables,
  tmpl.email_subject
FROM tenants t
CROSS JOIN (VALUES
  ('Event Created',      'event.created',          'event',      'New event: {{event_name}}',           'A new event "{{event_name}}" has been created for {{event_date}}.', ARRAY['event_name','event_date']::TEXT[], 'New Event Created — {{event_name}}'),
  ('Payment Received',   'payment.received',        'finance',    '₹{{amount}} payment received',        'Payment of ₹{{amount}} received for event "{{event_name}}".', ARRAY['amount','event_name']::TEXT[], 'Payment Received — ₹{{amount}}'),
  ('Invoice Overdue',    'invoice.overdue',         'finance',    'Invoice overdue: {{invoice_number}}', 'Invoice {{invoice_number}} for ₹{{amount}} is overdue since {{due_date}}.', ARRAY['invoice_number','amount','due_date']::TEXT[], 'Invoice Overdue — {{invoice_number}}'),
  ('Ticket Created',     'ticket.created',          'support',    'New ticket: {{ticket_number}}',       '{{reporter}} raised a ticket: {{subject}}.', ARRAY['ticket_number','reporter','subject']::TEXT[], 'New Support Ticket — {{ticket_number}}'),
  ('Ticket Escalated',   'ticket.escalated',        'support',    'Ticket escalated: {{ticket_number}}', 'Ticket {{ticket_number}} has been escalated to {{assigned_to}}.', ARRAY['ticket_number','assigned_to']::TEXT[], 'Ticket Escalated'),
  ('Staff Assigned',     'staff.assigned',          'team',       'You have been assigned to {{event_name}}', 'You have been assigned as {{role}} for event "{{event_name}}" on {{event_date}}.', ARRAY['event_name','role','event_date']::TEXT[], 'New Assignment — {{event_name}}'),
  ('Task Completed',     'task.completed',          'operations', 'Task completed: {{task_name}}',       '{{completed_by}} completed the task "{{task_name}}".', ARRAY['task_name','completed_by']::TEXT[], 'Task Completed'),
  ('Vendor Confirmed',   'vendor.confirmed',        'operations', '{{vendor_name}} confirmed',            'Vendor "{{vendor_name}}" has confirmed their booking for {{event_name}}.', ARRAY['vendor_name','event_name']::TEXT[], 'Vendor Confirmation'),
  ('Guest Checked In',   'guest.checked_in',        'operations', '{{guest_name}} checked in',           '{{guest_name}} has checked in at {{checkin_time}}.', ARRAY['guest_name','checkin_time']::TEXT[], 'Guest Check-in'),
  ('AI Alert',           'ai.risk_alert',           'ai',         'AI Risk Alert: {{event_name}}',       'AI detected a risk for event "{{event_name}}": {{risk_description}}.', ARRAY['event_name','risk_description']::TEXT[], 'AI Risk Alert — {{event_name}}')
) AS tmpl(name, event_type, category, title_template, body_template, variables, email_subject)
ON CONFLICT DO NOTHING;
