-- ============================================================
-- Migration 016: Event Command Center
-- ============================================================

-- ─── Runsheet Items ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runsheet_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  category          TEXT DEFAULT 'general'
    CHECK (category IN ('general','setup','ceremony','reception','entertainment','catering','vip','logistics','technical','teardown')),
  scheduled_time    TIMESTAMPTZ NOT NULL,
  duration_minutes  INTEGER DEFAULT 30,
  location          TEXT,
  assignee_id       UUID REFERENCES profiles(id),
  status            TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','skipped','delayed')),
  notes             TEXT,
  actual_start_time TIMESTAMPTZ,
  actual_end_time   TIMESTAMPTZ,
  delay_minutes     INTEGER DEFAULT 0,
  is_critical       BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runsheet_event    ON runsheet_items(event_id, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_runsheet_tenant   ON runsheet_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_runsheet_status   ON runsheet_items(event_id, status);

-- ─── Incident Reports ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incident_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low','medium','high','critical')),
  category      TEXT DEFAULT 'general'
    CHECK (category IN ('general','safety','technical','vendor','guest','weather','security','medical','logistics')),
  location      TEXT,
  status        TEXT DEFAULT 'open'
    CHECK (status IN ('open','investigating','resolved','closed')),
  reported_by   UUID REFERENCES profiles(id),
  assigned_to   UUID REFERENCES profiles(id),
  resolved_by   UUID REFERENCES profiles(id),
  resolution    TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_event   ON incident_reports(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incident_reports(event_id, severity) WHERE status = 'open';

-- ─── Team Event Assignments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_event_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id),
  role            TEXT,
  department      TEXT,
  shift_start     TIMESTAMPTZ,
  shift_end       TIMESTAMPTZ,
  check_in_status TEXT DEFAULT 'pending' CHECK (check_in_status IN ('pending','checked_in','absent')),
  checked_in_at   TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_assignments_event  ON team_event_assignments(event_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_user   ON team_event_assignments(user_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE runsheet_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_runsheet" ON runsheet_items
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_incidents" ON incident_reports
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE team_event_assignments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_team_assignments" ON team_event_assignments
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
