-- ============================================================
-- 028_documents.sql  —  Document Generation System
-- ============================================================
-- Covers: proposals, contracts, invoices, run-of-show PDFs,
-- BEOs (Banquet Event Orders), vendor agreements, letters.
-- Each document has a type, template, version history, and
-- optional e-signature workflow.
-- ============================================================

-- ── Document templates ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'proposal', 'contract', 'invoice', 'beo', 'run_of_show',
    'vendor_agreement', 'letter', 'quote', 'nda', 'custom'
  )),
  description   TEXT,
  -- Template content stored as structured JSON blocks
  content       JSONB NOT NULL DEFAULT '[]',
  -- CSS / branding overrides
  styles        JSONB NOT NULL DEFAULT '{}',
  -- Variable schema: list of {key, label, type, required}
  variables     JSONB NOT NULL DEFAULT '[]',
  is_system     BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  version       INTEGER NOT NULL DEFAULT 1,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_templates_tenant    ON document_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_doc_templates_type      ON document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_doc_templates_system    ON document_templates(is_system) WHERE is_system = true;

-- ── Generated documents ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id      UUID REFERENCES document_templates(id),
  -- Context references (at least one should be set)
  event_id         UUID REFERENCES events(id) ON DELETE SET NULL,
  client_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  vendor_id        UUID REFERENCES vendors(id) ON DELETE SET NULL,
  -- Document metadata
  name             TEXT NOT NULL,
  document_type    TEXT NOT NULL CHECK (document_type IN (
    'proposal', 'contract', 'invoice', 'beo', 'run_of_show',
    'vendor_agreement', 'letter', 'quote', 'nda', 'custom'
  )),
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'review', 'sent', 'viewed', 'signed', 'approved',
    'rejected', 'expired', 'archived'
  )),
  version          INTEGER NOT NULL DEFAULT 1,
  -- Rendered content (merged template + variables)
  content          JSONB NOT NULL DEFAULT '[]',
  -- Variable values used to render this document
  variable_values  JSONB NOT NULL DEFAULT '{}',
  -- Rendered PDF stored in Supabase Storage
  pdf_path         TEXT,
  pdf_url          TEXT,
  pdf_size_bytes   INTEGER,
  -- Sharing
  share_token      TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  share_expires_at TIMESTAMPTZ,
  -- E-signature
  requires_signature BOOLEAN NOT NULL DEFAULT false,
  signed_at        TIMESTAMPTZ,
  signed_by_name   TEXT,
  signed_by_email  TEXT,
  signature_data   JSONB,          -- base64 signature image + metadata
  -- Financial (for invoices / quotes)
  subtotal         NUMERIC(14, 2),
  tax_amount       NUMERIC(14, 2),
  discount_amount  NUMERIC(14, 2),
  total_amount     NUMERIC(14, 2),
  currency         TEXT NOT NULL DEFAULT 'INR',
  due_date         DATE,
  -- Tracking
  sent_at          TIMESTAMPTZ,
  viewed_at        TIMESTAMPTZ,
  view_count       INTEGER NOT NULL DEFAULT 0,
  last_viewed_ip   TEXT,
  notes            TEXT,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant      ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_event       ON documents(event_id);
CREATE INDEX IF NOT EXISTS idx_documents_client      ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_type        ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status      ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_share_token ON documents(share_token);

-- ── Document version history ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  content       JSONB NOT NULL DEFAULT '[]',
  variable_values JSONB NOT NULL DEFAULT '{}',
  pdf_path      TEXT,
  change_note   TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON document_versions(document_id);

-- ── Document activities / audit log ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_activities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  action       TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'sent', 'viewed', 'downloaded',
    'signed', 'approved', 'rejected', 'expired', 'archived',
    'comment_added', 'version_created', 'pdf_generated'
  )),
  actor_id     UUID REFERENCES profiles(id),
  actor_name   TEXT,
  actor_email  TEXT,
  ip_address   TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_activities_document ON document_activities(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_activities_created  ON document_activities(created_at DESC);

-- ── Document line items (for invoices / quotes) ───────────────────────────────

CREATE TABLE IF NOT EXISTS document_line_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  description  TEXT NOT NULL,
  quantity     NUMERIC(10, 3) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_rate     NUMERIC(5, 2) NOT NULL DEFAULT 18,   -- GST default
  line_total   NUMERIC(14, 2) GENERATED ALWAYS AS (
    ROUND(quantity * unit_price * (1 - discount_pct / 100) * (1 + tax_rate / 100), 2)
  ) STORED,
  category     TEXT,
  notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_doc_line_items_document ON document_line_items(document_id);

-- ── Triggers ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();

DROP TRIGGER IF EXISTS trg_doc_templates_updated_at ON document_templates;
CREATE TRIGGER trg_doc_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();

-- Auto-log creation activity
CREATE OR REPLACE FUNCTION log_document_created()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO document_activities (document_id, action, actor_id, created_at)
  VALUES (NEW.id, 'created', NEW.created_by, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_log_created ON documents;
CREATE TRIGGER trg_document_log_created
  AFTER INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION log_document_created();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_line_items ENABLE ROW LEVEL SECURITY;

-- Templates: system templates visible to all, tenant templates to own tenant
CREATE POLICY "templates_tenant_access" ON document_templates
  FOR ALL USING (
    is_system = true
    OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- Documents: tenant-scoped
CREATE POLICY "documents_tenant_access" ON documents
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- Versions: accessible if parent document accessible
CREATE POLICY "doc_versions_tenant_access" ON document_versions
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Activities: accessible if parent document accessible
CREATE POLICY "doc_activities_tenant_access" ON document_activities
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Line items: accessible if parent document accessible
CREATE POLICY "doc_line_items_tenant_access" ON document_line_items
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Public share token access (unauthenticated)
CREATE POLICY "documents_public_share" ON documents
  FOR SELECT USING (
    share_token IS NOT NULL
    AND (share_expires_at IS NULL OR share_expires_at > now())
  );

-- ── System templates seed ─────────────────────────────────────────────────────

INSERT INTO document_templates (name, document_type, description, is_system, variables, content) VALUES

('Event Proposal', 'proposal',
 'Professional event proposal with cover page, scope, timeline, and investment summary',
 true,
 '[
   {"key":"client_name","label":"Client Name","type":"text","required":true},
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"event_venue","label":"Venue","type":"text","required":false},
   {"key":"guest_count","label":"Guest Count","type":"number","required":false},
   {"key":"company_name","label":"Our Company Name","type":"text","required":true},
   {"key":"valid_until","label":"Proposal Valid Until","type":"date","required":false},
   {"key":"total_investment","label":"Total Investment","type":"currency","required":false}
 ]',
 '[
   {"type":"cover","title":"{{event_name}}","subtitle":"Prepared for {{client_name}}","date":"{{event_date}}"},
   {"type":"heading","text":"Executive Summary"},
   {"type":"paragraph","text":"Dear {{client_name}},\n\nThank you for considering {{company_name}} for your upcoming event. We are delighted to present this proposal for {{event_name}}."},
   {"type":"heading","text":"Event Overview"},
   {"type":"key_value","items":[
     {"label":"Event Name","value":"{{event_name}}"},
     {"label":"Event Date","value":"{{event_date}}"},
     {"label":"Venue","value":"{{event_venue}}"},
     {"label":"Expected Guests","value":"{{guest_count}}"}
   ]},
   {"type":"heading","text":"Our Services"},
   {"type":"paragraph","text":"[Describe the services included in this proposal]"},
   {"type":"heading","text":"Investment Summary"},
   {"type":"line_items"},
   {"type":"total_block"},
   {"type":"heading","text":"Terms & Conditions"},
   {"type":"paragraph","text":"This proposal is valid until {{valid_until}}. A 50% advance is required to confirm booking."},
   {"type":"signature_block","label":"Client Acceptance"}
 ]'),

('Service Contract', 'contract',
 'Comprehensive event services contract with payment schedule and cancellation policy',
 true,
 '[
   {"key":"client_name","label":"Client Name","type":"text","required":true},
   {"key":"client_address","label":"Client Address","type":"text","required":true},
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"event_venue","label":"Venue","type":"text","required":true},
   {"key":"company_name","label":"Company Name","type":"text","required":true},
   {"key":"contract_date","label":"Contract Date","type":"date","required":true},
   {"key":"total_value","label":"Total Contract Value","type":"currency","required":true},
   {"key":"advance_amount","label":"Advance Amount","type":"currency","required":true},
   {"key":"balance_due_date","label":"Balance Due Date","type":"date","required":true}
 ]',
 '[
   {"type":"heading","text":"EVENT SERVICES AGREEMENT"},
   {"type":"paragraph","text":"This Agreement is entered into on {{contract_date}} between {{company_name}} (\"Service Provider\") and {{client_name}} of {{client_address}} (\"Client\")."},
   {"type":"heading","text":"1. Event Details"},
   {"type":"key_value","items":[
     {"label":"Event","value":"{{event_name}}"},
     {"label":"Date","value":"{{event_date}}"},
     {"label":"Venue","value":"{{event_venue}}"}
   ]},
   {"type":"heading","text":"2. Services"},
   {"type":"line_items"},
   {"type":"heading","text":"3. Payment Schedule"},
   {"type":"paragraph","text":"Total Contract Value: {{total_value}}\nAdvance (due on signing): {{advance_amount}}\nBalance due: {{balance_due_date}}"},
   {"type":"heading","text":"4. Cancellation Policy"},
   {"type":"paragraph","text":"Cancellations made more than 90 days prior: 25% of advance forfeited.\nCancellations made 30-90 days prior: 50% of advance forfeited.\nCancellations made less than 30 days prior: 100% of advance forfeited."},
   {"type":"heading","text":"5. Force Majeure"},
   {"type":"paragraph","text":"Neither party shall be liable for delays or failures due to circumstances beyond reasonable control."},
   {"type":"dual_signature","party_a":"{{company_name}}","party_b":"{{client_name}}"}
 ]'),

('Tax Invoice', 'invoice',
 'GST-compliant tax invoice with line items, CGST/SGST/IGST breakdown',
 true,
 '[
   {"key":"invoice_number","label":"Invoice Number","type":"text","required":true},
   {"key":"invoice_date","label":"Invoice Date","type":"date","required":true},
   {"key":"due_date","label":"Due Date","type":"date","required":true},
   {"key":"client_name","label":"Client Name","type":"text","required":true},
   {"key":"client_gstin","label":"Client GSTIN","type":"text","required":false},
   {"key":"client_address","label":"Client Address","type":"text","required":true},
   {"key":"company_name","label":"Company Name","type":"text","required":true},
   {"key":"company_gstin","label":"Company GSTIN","type":"text","required":true},
   {"key":"event_name","label":"Event / Reference","type":"text","required":false}
 ]',
 '[
   {"type":"invoice_header","title":"TAX INVOICE"},
   {"type":"invoice_parties","bill_to":"{{client_name}}\n{{client_address}}\nGSTIN: {{client_gstin}}","company":"{{company_name}}\nGSTIN: {{company_gstin}}"},
   {"type":"invoice_meta","items":[
     {"label":"Invoice No.","value":"{{invoice_number}}"},
     {"label":"Invoice Date","value":"{{invoice_date}}"},
     {"label":"Due Date","value":"{{due_date}}"},
     {"label":"Reference","value":"{{event_name}}"}
   ]},
   {"type":"line_items","show_tax":true},
   {"type":"tax_summary","gst_type":"igst"},
   {"type":"total_block","currency":"INR"},
   {"type":"bank_details"},
   {"type":"paragraph","text":"Please transfer the amount to our bank account. Quote invoice number in transfer reference."}
 ]'),

('Banquet Event Order (BEO)', 'beo',
 'Detailed operational BEO covering setup, F&B, AV, staffing requirements',
 true,
 '[
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"setup_time","label":"Setup Time","type":"text","required":true},
   {"key":"start_time","label":"Start Time","type":"text","required":true},
   {"key":"end_time","label":"End Time","type":"text","required":true},
   {"key":"venue_name","label":"Venue / Room","type":"text","required":true},
   {"key":"guest_count","label":"Pax Count","type":"number","required":true},
   {"key":"client_name","label":"Client Name","type":"text","required":true},
   {"key":"account_manager","label":"Account Manager","type":"text","required":true}
 ]',
 '[
   {"type":"heading","text":"BANQUET EVENT ORDER"},
   {"type":"key_value","cols":2,"items":[
     {"label":"Event","value":"{{event_name}}"},
     {"label":"Client","value":"{{client_name}}"},
     {"label":"Date","value":"{{event_date}}"},
     {"label":"Venue / Room","value":"{{venue_name}}"},
     {"label":"Setup Time","value":"{{setup_time}}"},
     {"label":"Start Time","value":"{{start_time}}"},
     {"label":"End Time","value":"{{end_time}}"},
     {"label":"Pax","value":"{{guest_count}}"},
     {"label":"Account Manager","value":"{{account_manager}}"}
   ]},
   {"type":"section_heading","text":"Room Setup"},
   {"type":"checklist_table","headers":["Item","Qty","Notes"]},
   {"type":"section_heading","text":"Food & Beverage"},
   {"type":"menu_block"},
   {"type":"section_heading","text":"Audio-Visual Requirements"},
   {"type":"checklist_table","headers":["Equipment","Qty","Provider"]},
   {"type":"section_heading","text":"Staffing"},
   {"type":"checklist_table","headers":["Role","Count","Reporting Time"]},
   {"type":"section_heading","text":"Special Requirements"},
   {"type":"notes_block"},
   {"type":"approval_row","label":"Approved by"}
 ]'),

('Run of Show', 'run_of_show',
 'Minute-by-minute event run sheet with cues, responsibilities, and timing',
 true,
 '[
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"venue_name","label":"Venue","type":"text","required":true},
   {"key":"event_director","label":"Event Director","type":"text","required":true},
   {"key":"technical_director","label":"Technical Director","type":"text","required":false}
 ]',
 '[
   {"type":"heading","text":"RUN OF SHOW — {{event_name}}"},
   {"type":"key_value","items":[
     {"label":"Date","value":"{{event_date}}"},
     {"label":"Venue","value":"{{venue_name}}"},
     {"label":"Event Director","value":"{{event_director}}"},
     {"label":"Technical Director","value":"{{technical_director}}"}
   ]},
   {"type":"runsheet_table","headers":["Time","Duration","Item","Responsible","AV Cue","Notes"]},
   {"type":"paragraph","text":"All times are approximate. Event Director has authority to adjust timing on the day."}
 ]'),

('Vendor Agreement', 'vendor_agreement',
 'Standard vendor service agreement with deliverables, payment terms, and liability clauses',
 true,
 '[
   {"key":"vendor_name","label":"Vendor Name","type":"text","required":true},
   {"key":"vendor_service","label":"Service Type","type":"text","required":true},
   {"key":"event_name","label":"Event Name","type":"text","required":true},
   {"key":"event_date","label":"Event Date","type":"date","required":true},
   {"key":"company_name","label":"Our Company Name","type":"text","required":true},
   {"key":"total_fee","label":"Total Fee","type":"currency","required":true},
   {"key":"advance_pct","label":"Advance %","type":"number","required":true}
 ]',
 '[
   {"type":"heading","text":"VENDOR SERVICE AGREEMENT"},
   {"type":"paragraph","text":"This agreement is between {{company_name}} (\"Client\") and {{vendor_name}} (\"Vendor\") for {{vendor_service}} services at {{event_name}} on {{event_date}}."},
   {"type":"heading","text":"1. Scope of Services"},
   {"type":"line_items"},
   {"type":"heading","text":"2. Compensation"},
   {"type":"paragraph","text":"Total Fee: {{total_fee}}\nAdvance ({{advance_pct}}%) due on signing. Balance due on day of event."},
   {"type":"heading","text":"3. Vendor Obligations"},
   {"type":"paragraph","text":"Vendor agrees to arrive no later than the time specified, bring all required equipment, and maintain professional conduct throughout."},
   {"type":"heading","text":"4. Cancellation"},
   {"type":"paragraph","text":"Cancellation by Client with less than 14 days notice: 50% of total fee payable. Cancellation by Vendor: full advance to be refunded within 7 days."},
   {"type":"dual_signature","party_a":"{{company_name}}","party_b":"{{vendor_name}}"}
 ]')

ON CONFLICT DO NOTHING;
