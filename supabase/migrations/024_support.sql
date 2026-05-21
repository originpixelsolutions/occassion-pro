-- ============================================================
-- 024_support.sql — Support & Ticketing System
-- ============================================================

-- ── Ticket Categories ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  color         TEXT DEFAULT '#6366f1',
  icon          TEXT DEFAULT 'help-circle',
  sla_hours     INTEGER DEFAULT 24,           -- response SLA in hours
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- ── SLA Policies ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sla_policies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  priority            TEXT NOT NULL CHECK (priority IN ('critical','high','medium','low')),
  first_response_hrs  INTEGER NOT NULL DEFAULT 1,
  resolution_hrs      INTEGER NOT NULL DEFAULT 24,
  escalation_hrs      INTEGER,                -- auto-escalate after N hours
  is_default          BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, priority)
);

-- ── Support Tickets ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_tickets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_number       TEXT NOT NULL,                    -- e.g. TKT-0042
  title               TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','pending_client','resolved','closed','cancelled')),
  priority            TEXT NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('critical','high','medium','low')),
  category_id         UUID REFERENCES ticket_categories(id) ON DELETE SET NULL,

  -- Reporter
  reporter_type       TEXT DEFAULT 'internal' CHECK (reporter_type IN ('internal','client','vendor','guest')),
  reporter_id         UUID,                             -- profiles.id for internal
  reporter_name       TEXT,                             -- for external reporters
  reporter_email      TEXT,

  -- Assignment
  assigned_to         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_team       TEXT,
  escalated_to        UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Context
  event_id            UUID REFERENCES events(id) ON DELETE SET NULL,
  vendor_id           UUID REFERENCES vendors(id) ON DELETE SET NULL,
  related_entity_type TEXT,
  related_entity_id   UUID,

  -- SLA tracking
  sla_policy_id       UUID REFERENCES sla_policies(id) ON DELETE SET NULL,
  first_response_due  TIMESTAMPTZ,
  resolution_due      TIMESTAMPTZ,
  first_response_at   TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  sla_breached        BOOLEAN DEFAULT FALSE,
  response_sla_breached BOOLEAN DEFAULT FALSE,

  -- Satisfaction
  satisfaction_score  INTEGER CHECK (satisfaction_score BETWEEN 1 AND 5),
  satisfaction_note   TEXT,
  satisfaction_at     TIMESTAMPTZ,

  -- Resolution
  resolution_note     TEXT,
  resolved_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Tags & metadata
  tags                TEXT[] DEFAULT '{}',
  metadata            JSONB DEFAULT '{}',

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, ticket_number)
);

-- ── Ticket Comments / Activity Feed ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id     UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name   TEXT,
  author_type   TEXT DEFAULT 'agent' CHECK (author_type IN ('agent','client','vendor','system')),
  body          TEXT NOT NULL,
  is_internal   BOOLEAN DEFAULT FALSE,        -- internal notes not visible to client
  attachments   JSONB DEFAULT '[]',           -- [{name, url, size, mime}]
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ticket Attachments ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES ticket_comments(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   INTEGER,
  mime_type   TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ticket Activity Log ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name  TEXT,
  action      TEXT NOT NULL,               -- assigned, status_changed, priority_changed, escalated, etc.
  old_value   TEXT,
  new_value   TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Knowledge Base Articles ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES ticket_categories(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL,
  content       TEXT NOT NULL,
  summary       TEXT,
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  is_public     BOOLEAN DEFAULT FALSE,
  view_count    INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  tags          TEXT[] DEFAULT '{}',
  author_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- ── Ticket-to-KB Links ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_kb_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  article_id  UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  linked_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id, article_id)
);

-- ── Escalation Rules ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS escalation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  priority        TEXT CHECK (priority IN ('critical','high','medium','low')),
  hours_threshold INTEGER NOT NULL DEFAULT 4,
  escalate_to     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notify_email    TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant   ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status   ON support_tickets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(tenant_id, priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_event    ON support_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_sla      ON support_tickets(tenant_id, sla_breached, status);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket   ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket ON ticket_activities(ticket_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_tenant       ON kb_articles(tenant_id, status);

-- ── Auto-increment ticket number ─────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_ticket_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(ticket_number FROM 'TKT-(\d+)') AS INTEGER)
  ), 999) + 1
  INTO v_seq
  FROM support_tickets
  WHERE tenant_id = p_tenant_id;
  RETURN 'TKT-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ── Auto-update updated_at ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_support_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_ticket_updated ON support_tickets;
CREATE TRIGGER trg_support_ticket_updated
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_updated_at();

DROP TRIGGER IF EXISTS trg_kb_article_updated ON kb_articles;
CREATE TRIGGER trg_kb_article_updated
  BEFORE UPDATE ON kb_articles
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_updated_at();

DROP TRIGGER IF EXISTS trg_ticket_comment_updated ON ticket_comments;
CREATE TRIGGER trg_ticket_comment_updated
  BEFORE UPDATE ON ticket_comments
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_updated_at();

-- ── Auto-log ticket activity on status change ────────────────────────────────

CREATE OR REPLACE FUNCTION log_ticket_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ticket_activities(tenant_id, ticket_id, action, old_value, new_value)
    VALUES (NEW.tenant_id, NEW.id, 'status_changed', OLD.status, NEW.status);
  END IF;
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO ticket_activities(tenant_id, ticket_id, action, old_value, new_value)
    VALUES (NEW.tenant_id, NEW.id, 'priority_changed', OLD.priority, NEW.priority);
  END IF;
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO ticket_activities(tenant_id, ticket_id, action, old_value, new_value)
    VALUES (NEW.tenant_id, NEW.id, 'assigned', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_activity ON support_tickets;
CREATE TRIGGER trg_ticket_activity
  AFTER UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION log_ticket_activity();

-- ── SLA breach check function ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_sla_breaches()
RETURNS void AS $$
BEGIN
  -- Mark response SLA breached
  UPDATE support_tickets
  SET response_sla_breached = TRUE
  WHERE first_response_at IS NULL
    AND first_response_due < NOW()
    AND status NOT IN ('resolved','closed','cancelled')
    AND response_sla_breached = FALSE;

  -- Mark resolution SLA breached
  UPDATE support_tickets
  SET sla_breached = TRUE
  WHERE resolved_at IS NULL
    AND resolution_due < NOW()
    AND status NOT IN ('resolved','closed','cancelled')
    AND sla_breached = FALSE;
END;
$$ LANGUAGE plpgsql;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE ticket_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_kb_links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules     ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON ticket_categories    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON sla_policies         USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON support_tickets      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON ticket_comments      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON ticket_attachments   USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON ticket_activities    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON kb_articles          USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY tenant_isolation ON escalation_rules     USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ticket_kb_links: inherit from tickets
CREATE POLICY ticket_link_isolation ON ticket_kb_links
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ── Default seed data function ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_support_defaults(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  -- Default categories
  INSERT INTO ticket_categories (tenant_id, name, color, sla_hours, sort_order) VALUES
    (p_tenant_id, 'Vendor Issue',        '#f59e0b', 4,  1),
    (p_tenant_id, 'Client Request',      '#6366f1', 8,  2),
    (p_tenant_id, 'Event Operations',    '#10b981', 2,  3),
    (p_tenant_id, 'Finance & Billing',   '#ef4444', 24, 4),
    (p_tenant_id, 'IT & Systems',        '#3b82f6', 8,  5),
    (p_tenant_id, 'Staff & HR',          '#8b5cf6', 24, 6),
    (p_tenant_id, 'Guest Complaint',     '#ec4899', 4,  7),
    (p_tenant_id, 'General Enquiry',     '#64748b', 48, 8)
  ON CONFLICT (tenant_id, name) DO NOTHING;

  -- Default SLA policies
  INSERT INTO sla_policies (tenant_id, name, priority, first_response_hrs, resolution_hrs, escalation_hrs, is_default) VALUES
    (p_tenant_id, 'Critical SLA',  'critical', 1,  4,  2,   FALSE),
    (p_tenant_id, 'High SLA',      'high',     2,  8,  4,   FALSE),
    (p_tenant_id, 'Standard SLA',  'medium',   4,  24, 12,  TRUE),
    (p_tenant_id, 'Low SLA',       'low',      8,  72, NULL, FALSE)
  ON CONFLICT (tenant_id, priority) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
