-- ============================================================
-- OccasionPro — Migration 003: Events
-- ============================================================

-- ── EVENT TEMPLATES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        event_category NOT NULL,
  default_budget  NUMERIC(14,2),
  default_tasks   JSONB DEFAULT '[]',    -- array of task templates
  default_runsheet JSONB DEFAULT '[]',  -- array of runsheet items
  default_vendors JSONB DEFAULT '[]',   -- suggested vendor categories
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evt_tmpl_tenant ON event_templates(tenant_id);

-- ── EVENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES event_templates(id),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  category        event_category NOT NULL,
  status          event_status NOT NULL DEFAULT 'draft',

  -- Scheduling
  event_date      DATE,
  start_time      TIME,
  end_time        TIME,
  setup_date      DATE,
  breakdown_date  DATE,
  timezone        TEXT DEFAULT 'Asia/Kolkata',

  -- Location
  venue_id        UUID,                  -- FK added in venues migration
  venue_name      TEXT,                  -- denormalized for speed
  venue_address   JSONB DEFAULT '{}',

  -- Scale
  expected_guests INTEGER,
  confirmed_guests INTEGER DEFAULT 0,
  checked_in_guests INTEGER DEFAULT 0,

  -- Financial
  budget_total    NUMERIC(14,2),
  budget_spent    NUMERIC(14,2) DEFAULT 0,
  quoted_amount   NUMERIC(14,2),
  currency        TEXT NOT NULL DEFAULT 'INR',

  -- People
  manager_id      UUID REFERENCES profiles(id),   -- lead event manager
  client_id       UUID REFERENCES profiles(id),   -- primary client contact

  -- Microsite toggle
  microsite_enabled BOOLEAN NOT NULL DEFAULT false,

  -- AI risk score (0-100)
  ai_risk_score   INTEGER,
  ai_risk_flags   JSONB DEFAULT '[]',

  -- Content
  description     TEXT,
  brief           TEXT,
  special_notes   TEXT,
  cover_image_url TEXT,

  metadata        JSONB NOT NULL DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(tenant_id, event_date);
CREATE INDEX IF NOT EXISTS idx_events_manager ON events(manager_id);
CREATE INDEX IF NOT EXISTS idx_events_client ON events(client_id);
CREATE INDEX IF NOT EXISTS idx_events_search ON events USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ── EVENT PHASES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_phases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,           -- Planning, Production, Execution, Wrap
  order_index     INTEGER NOT NULL DEFAULT 0,
  start_date      DATE,
  end_date        DATE,
  is_completed    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phases_event ON event_phases(event_id);

-- ── EVENT TASKS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  phase_id        UUID REFERENCES event_phases(id),
  title           TEXT NOT NULL,
  description     TEXT,
  status          task_status NOT NULL DEFAULT 'todo',
  priority        task_priority NOT NULL DEFAULT 'medium',
  assigned_to     UUID REFERENCES profiles(id),
  due_date        DATE,
  due_time        TIME,
  estimated_hours NUMERIC(5,2),
  actual_hours    NUMERIC(5,2),
  parent_task_id  UUID REFERENCES event_tasks(id),  -- subtasks
  depends_on      UUID[],                           -- task IDs that must complete first
  tags            TEXT[] DEFAULT '{}',
  attachments     JSONB DEFAULT '[]',
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES profiles(id),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_event ON event_tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON event_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON event_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON event_tasks(event_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON event_tasks(due_date);

-- ── EVENT TIMELINE / RUNSHEET ─────────────────────────────────
CREATE TABLE IF NOT EXISTS event_runsheet (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  time_slot       TIME NOT NULL,
  duration_mins   INTEGER NOT NULL DEFAULT 15,
  title           TEXT NOT NULL,
  description     TEXT,
  responsible_id  UUID REFERENCES profiles(id),
  location        TEXT,                   -- specific area within venue
  vendor_id       UUID,                  -- FK added in vendors migration
  is_public       BOOLEAN DEFAULT false, -- show on guest-facing microsite
  status          TEXT DEFAULT 'pending', -- pending | in_progress | completed | delayed
  actual_start    TIME,
  delay_mins      INTEGER DEFAULT 0,
  notes           TEXT,
  order_index     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runsheet_event ON event_runsheet(event_id);

-- ── EVENT RISKS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_risks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,                   -- weather, vendor, technical, crowd, etc.
  level           risk_level NOT NULL DEFAULT 'medium',
  probability     INTEGER,               -- 1-5
  impact          INTEGER,               -- 1-5
  risk_score      INTEGER,               -- probability * impact
  mitigation      TEXT,
  contingency     TEXT,
  owner_id        UUID REFERENCES profiles(id),
  is_resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  ai_generated    BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risks_event ON event_risks(event_id);

-- ── EVENT ISSUES (live tracking) ─────────────────────────────
CREATE TABLE IF NOT EXISTS event_issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  severity        risk_level NOT NULL DEFAULT 'medium',
  reported_by     UUID REFERENCES profiles(id),
  assigned_to     UUID REFERENCES profiles(id),
  is_resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issues_event ON event_issues(event_id);
CREATE INDEX IF NOT EXISTS idx_issues_resolved ON event_issues(event_id, is_resolved);

-- ── EVENT DOCUMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT,                   -- contract, proposal, brief, report, etc.
  file_url        TEXT NOT NULL,          -- Cloudflare R2 URL
  file_size       INTEGER,               -- bytes
  mime_type       TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  is_client_visible BOOLEAN DEFAULT false,
  requires_signature BOOLEAN DEFAULT false,
  signed_at       TIMESTAMPTZ,
  signed_by       UUID REFERENCES profiles(id),
  uploaded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_event ON event_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_docs_type ON event_documents(tenant_id, type);

-- ── TRIGGERS ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tasks_updated_at ON event_tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON event_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS runsheet_updated_at ON event_runsheet;
CREATE TRIGGER runsheet_updated_at BEFORE UPDATE ON event_runsheet FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS risks_updated_at ON event_risks;
CREATE TRIGGER risks_updated_at BEFORE UPDATE ON event_risks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS issues_updated_at ON event_issues;
CREATE TRIGGER issues_updated_at BEFORE UPDATE ON event_issues FOR EACH ROW EXECUTE FUNCTION update_updated_at();
