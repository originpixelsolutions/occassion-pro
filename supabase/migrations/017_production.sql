-- ============================================================
-- Migration 017: Production & Logistics Module
-- ============================================================

-- ─── Production Setups ────────────────────────────────────────────────────────
-- Represents a technical/production area for an event (Stage A, AV Booth, etc.)
CREATE TABLE IF NOT EXISTS production_setups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                            -- "Main Stage", "AV Booth", "Lighting Rig"
  category        TEXT DEFAULT 'general'
    CHECK (category IN ('stage','av','lighting','sound','power','network','rigging','pyrotechnics','video','decor','general')),
  description     TEXT,
  location        TEXT,                                     -- Physical location at venue
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','in_setup','ready','live','dismantling','done')),
  setup_start     TIMESTAMPTZ,
  setup_end       TIMESTAMPTZ,
  teardown_start  TIMESTAMPTZ,
  teardown_end    TIMESTAMPTZ,
  responsible_id  UUID REFERENCES profiles(id),
  vendor_id       UUID REFERENCES vendors(id),
  notes           TEXT,
  checklist       JSONB DEFAULT '[]',                       -- [{item, done, checked_by, checked_at}]
  attachments     JSONB DEFAULT '[]',                       -- [{name, url, type}]
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_setups_event  ON production_setups(event_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_prod_setups_status ON production_setups(event_id, status);

-- ─── Equipment Items ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT DEFAULT 'general'
    CHECK (category IN ('audio','video','lighting','staging','power','rigging','furniture','transport','communication','safety','general')),
  make            TEXT,
  model           TEXT,
  serial_number   TEXT,
  quantity_owned  INTEGER DEFAULT 1,
  quantity_available INTEGER,                               -- computed or manually set
  unit_cost       NUMERIC(12,2),
  notes           TEXT,
  condition       TEXT DEFAULT 'good'
    CHECK (condition IN ('excellent','good','fair','needs_repair','retired')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_tenant   ON equipment_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment_items(tenant_id, category);

-- ─── Equipment Assignments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  equipment_id    UUID NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  setup_id        UUID REFERENCES production_setups(id) ON DELETE SET NULL,
  quantity        INTEGER DEFAULT 1,
  status          TEXT DEFAULT 'reserved'
    CHECK (status IN ('reserved','dispatched','on_site','in_use','returned','damaged')),
  notes           TEXT,
  dispatched_at   TIMESTAMPTZ,
  returned_at     TIMESTAMPTZ,
  assigned_to     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equip_assign_event  ON equipment_assignments(event_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_equip_assign_equip  ON equipment_assignments(equipment_id);

-- ─── Load Schedule ────────────────────────────────────────────────────────────
-- Tracks vehicle movements, load-in and load-out windows
CREATE TABLE IF NOT EXISTS load_schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type            TEXT NOT NULL
    CHECK (type IN ('load_in','load_out','delivery','pickup','vendor_arrival','vendor_departure')),
  title           TEXT NOT NULL,
  description     TEXT,
  scheduled_time  TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  location        TEXT,                                     -- Gate/dock/entrance
  vendor_id       UUID REFERENCES vendors(id),
  vehicle_info    TEXT,                                     -- "Truck #3 - MH01AB1234"
  contact_name    TEXT,
  contact_phone   TEXT,
  status          TEXT DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','arrived','in_progress','completed','cancelled','delayed')),
  actual_time     TIMESTAMPTZ,
  delay_minutes   INTEGER DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_load_sched_event ON load_schedule(event_id, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_load_sched_tenant ON load_schedule(tenant_id);

-- ─── Supplier Coordination ────────────────────────────────────────────────────
-- Tracks supplier/vendor coordination items per event
CREATE TABLE IF NOT EXISTS supplier_coordination (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category        TEXT DEFAULT 'general'
    CHECK (category IN ('catering','decor','av','entertainment','transport','security','photography','general')),
  brief_sent      BOOLEAN DEFAULT false,
  brief_sent_at   TIMESTAMPTZ,
  confirmed       BOOLEAN DEFAULT false,
  confirmed_at    TIMESTAMPTZ,
  advance_paid    BOOLEAN DEFAULT false,
  advance_amount  NUMERIC(12,2),
  balance_due     NUMERIC(12,2),
  arrival_time    TIMESTAMPTZ,
  departure_time  TIMESTAMPTZ,
  contact_name    TEXT,
  contact_phone   TEXT,
  requirements    TEXT,                                     -- Power, space, etc.
  notes           TEXT,
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','briefed','confirmed','on_site','completed','cancelled')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_coord_event  ON supplier_coordination(event_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_coord_vendor ON supplier_coordination(vendor_id);

-- ─── Production Checklist Templates ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_checklist_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT DEFAULT 'general',
  items       JSONB NOT NULL DEFAULT '[]',  -- [{title, category, required}]
  event_type  TEXT,                          -- wedding, concert, corporate, etc.
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_templates_tenant ON production_checklist_templates(tenant_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE production_setups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_production_setups" ON production_setups
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_equipment" ON equipment_items
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE equipment_assignments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_equipment_assignments" ON equipment_assignments
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE load_schedule ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_load_schedule" ON load_schedule
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE supplier_coordination ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_supplier_coordination" ON supplier_coordination
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE production_checklist_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_prod_templates" ON production_checklist_templates
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
