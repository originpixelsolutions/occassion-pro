-- ============================================================
-- Migration 044: Health & Safety Module
-- Safety checklists, incident reports, emergency contacts,
-- medical stations, capacity enforcement, zone management
-- ============================================================

-- ── Safety Checklists ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_checklists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  checklist_type  TEXT NOT NULL DEFAULT 'general'
                  CHECK (checklist_type IN ('general','venue','fire','medical','crowd','evacuation','vendor','electrical','stage','custom')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','completed','failed')),
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES profiles(id),
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Checklist Items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_checklist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id    UUID NOT NULL REFERENCES safety_checklists(id) ON DELETE CASCADE,
  item_text       TEXT NOT NULL,
  is_required     BOOLEAN NOT NULL DEFAULT true,
  is_checked      BOOLEAN NOT NULL DEFAULT false,
  checked_by      UUID REFERENCES profiles(id),
  checked_at      TIMESTAMPTZ,
  notes           TEXT,
  order_index     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Incident Reports ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  incident_type   TEXT NOT NULL DEFAULT 'medical'
                  CHECK (incident_type IN ('medical','security','fire','crowd','property_damage','weather','technical','slip_fall','other')),
  severity        TEXT NOT NULL DEFAULT 'low'
                  CHECK (severity IN ('low','medium','high','critical')),
  title           TEXT NOT NULL,
  description     TEXT,
  location        TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reported_by     UUID REFERENCES profiles(id),
  injured_count   INTEGER DEFAULT 0,
  response_taken  TEXT,
  resolved        BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  follow_up_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Emergency Contacts ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_emergency_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'general'
                  CHECK (role IN ('event_manager','security_head','medical_officer','fire_marshal','police','ambulance','fire_brigade','venue_manager','client','vip_liaison','general')),
  phone           TEXT NOT NULL,
  alternate_phone TEXT,
  email           TEXT,
  is_on_site      BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Medical Stations ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_medical_stations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  location        TEXT NOT NULL,
  station_type    TEXT NOT NULL DEFAULT 'first_aid'
                  CHECK (station_type IN ('first_aid','ambulance','doctor','nurse','medical_team')),
  capacity        INTEGER DEFAULT 1,
  staff_count     INTEGER DEFAULT 1,
  equipment       TEXT[],
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Event Safety Summary (per-event config) ────────────────
CREATE TABLE IF NOT EXISTS event_safety_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  venue_capacity        INTEGER,
  max_crowd_density_pct INTEGER DEFAULT 90, -- Alert at this % of venue_capacity
  first_aiders_required INTEGER,            -- Calculated: 1 per 50 guests
  security_ratio        TEXT DEFAULT '1:50', -- 1 security per N guests
  evacuation_time_mins  INTEGER DEFAULT 10,
  medical_plan_url      TEXT,
  emergency_plan_url    TEXT,
  safety_briefing_done  BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_safety_checklists_event ON safety_checklists(event_id);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_event ON safety_incidents(event_id);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_severity ON safety_incidents(severity, resolved);
CREATE INDEX IF NOT EXISTS idx_safety_emergency_contacts_event ON safety_emergency_contacts(event_id);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE safety_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_medical_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_safety_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_safety_checklists" ON safety_checklists
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY "tenant_checklist_items" ON safety_checklist_items
  USING (EXISTS (SELECT 1 FROM safety_checklists sc WHERE sc.id = checklist_id AND sc.tenant_id = current_setting('app.current_tenant_id')::UUID));
CREATE POLICY "tenant_incidents" ON safety_incidents
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY "tenant_emergency_contacts" ON safety_emergency_contacts
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY "tenant_medical_stations" ON safety_medical_stations
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY "tenant_safety_config" ON event_safety_config
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Triggers ───────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_safety_checklists_updated_at ON safety_checklists;
CREATE TRIGGER set_safety_checklists_updated_at BEFORE UPDATE ON safety_checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_safety_incidents_updated_at ON safety_incidents;
CREATE TRIGGER set_safety_incidents_updated_at BEFORE UPDATE ON safety_incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_event_safety_config_updated_at ON event_safety_config;
CREATE TRIGGER set_event_safety_config_updated_at BEFORE UPDATE ON event_safety_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
