-- ============================================================
-- OccasionPro — Migration 009: Inventory & Warehouse
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  parent_id       UUID REFERENCES inventory_categories(id),
  icon            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES inventory_categories(id),
  name            TEXT NOT NULL,
  sku             TEXT,
  barcode         TEXT,
  qr_code         TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  description     TEXT,
  unit            TEXT DEFAULT 'piece',  -- piece | set | kg | meter | etc.
  quantity_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity_available NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity_in_use NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity_damaged NUMERIC(12,2) NOT NULL DEFAULT 0,
  reorder_level   NUMERIC(12,2) DEFAULT 0,
  unit_cost       NUMERIC(12,2),
  replacement_cost NUMERIC(12,2),
  storage_location TEXT,
  storage_notes   TEXT,
  images          TEXT[] DEFAULT '{}',
  tags            TEXT[] DEFAULT '{}',
  is_rentable     BOOLEAN DEFAULT false,
  rental_rate_per_day NUMERIC(10,2),
  last_maintenance_at DATE,
  next_maintenance_at DATE,
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_tenant ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inv_qr ON inventory_items(qr_code);
CREATE INDEX IF NOT EXISTS idx_inv_search ON inventory_items USING gin(to_tsvector('english', name));

-- ── INVENTORY TRANSACTIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  type            inventory_tx_type NOT NULL,
  quantity        NUMERIC(12,2) NOT NULL,
  notes           TEXT,
  performed_by    UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_tx_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_event ON inventory_transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_tenant ON inventory_transactions(tenant_id);

-- ── EVENT INVENTORY ALLOCATIONS ──────────────────────────────
CREATE TABLE IF NOT EXISTS event_inventory_allocations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_allocated NUMERIC(12,2) NOT NULL,
  quantity_returned  NUMERIC(12,2) DEFAULT 0,
  quantity_damaged   NUMERIC(12,2) DEFAULT 0,
  allocated_at    TIMESTAMPTZ,
  returned_at     TIMESTAMPTZ,
  notes           TEXT,
  allocated_by    UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eia_event ON event_inventory_allocations(event_id);
CREATE INDEX IF NOT EXISTS idx_eia_item ON event_inventory_allocations(item_id);

DROP TRIGGER IF EXISTS inv_updated_at ON inventory_items;
CREATE TRIGGER inv_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS eia_updated_at ON event_inventory_allocations;
CREATE TRIGGER eia_updated_at BEFORE UPDATE ON event_inventory_allocations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
