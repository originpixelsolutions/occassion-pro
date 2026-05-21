-- ============================================================
-- Migration 042: Printing & Stationery Management
-- Covers all printed collateral for events:
-- invitations, menus, seating charts, signage, badges, programs,
-- favour tags, thank-you cards, table numbers, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS print_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Item metadata
  item_name       TEXT NOT NULL,
  item_type       TEXT NOT NULL DEFAULT 'invitation'
                  CHECK (item_type IN (
                    'invitation','menu_card','seating_chart','place_card','name_badge',
                    'programme','signage','banner','table_number','thank_you_card',
                    'favour_tag','envelope','rsvp_card','direction_sign','photo_booth_prop',
                    'cake_topper','welcome_board','backdrop_print','other'
                  )),
  -- Design & specs
  design_status   TEXT NOT NULL DEFAULT 'not_started'
                  CHECK (design_status IN (
                    'not_started','in_design','design_review','design_approved',
                    'sent_to_print','printing','ready_for_collection','delivered','cancelled'
                  )),
  design_file_url TEXT,                          -- External link (Drive, Dropbox, etc.) to design file
  proof_url       TEXT,                          -- External link to print proof
  -- Print specs
  quantity        INT NOT NULL DEFAULT 1,
  paper_size      TEXT DEFAULT 'A5',             -- A4, A5, A6, DL, custom
  paper_type      TEXT DEFAULT 'matte',          -- matte, glossy, silk, kraft, recycled
  finish          TEXT DEFAULT 'none',           -- none, lamination, spot_uv, foiling, emboss
  color_mode      TEXT DEFAULT 'full_color'
                  CHECK (color_mode IN ('full_color','black_white','pantone')),
  bleed_mm        NUMERIC(4,1) DEFAULT 3,
  -- Vendor & cost
  vendor_id       UUID REFERENCES vendors(id),
  unit_cost       NUMERIC(10,2),
  total_cost      NUMERIC(12,2) GENERATED ALWAYS AS (
                    CASE WHEN unit_cost IS NOT NULL THEN unit_cost * quantity ELSE NULL END
                  ) STORED,
  currency        TEXT NOT NULL DEFAULT 'INR',
  -- Logistics
  design_due_date DATE,
  print_due_date  DATE,
  delivery_date   DATE,
  -- Notes
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_items_event    ON print_items(event_id);
CREATE INDEX IF NOT EXISTS idx_print_items_tenant   ON print_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_print_items_type     ON print_items(item_type);
CREATE INDEX IF NOT EXISTS idx_print_items_status   ON print_items(design_status);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE print_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_print_items"
  ON print_items USING (tenant_id = current_setting('app.tenant_id')::uuid);

DROP TRIGGER IF EXISTS set_print_items_updated_at ON print_items;
CREATE TRIGGER set_print_items_updated_at
  BEFORE UPDATE ON print_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
