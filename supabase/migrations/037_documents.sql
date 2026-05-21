-- ============================================================
-- Migration 037: Document Management
-- event_documents with version control + folder structure
-- ============================================================

CREATE TABLE IF NOT EXISTS event_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  folder_path     TEXT NOT NULL DEFAULT '/',           -- e.g. '/contracts/', '/proposals/'
  document_name   TEXT NOT NULL,
  document_type   TEXT NOT NULL DEFAULT 'other'
                  CHECK (document_type IN (
                    'proposal','contract','invoice','timeline','floor_plan',
                    'mood_board','vendor_list','seating_chart','menu',
                    'runsheet','permit','brief','report','other'
                  )),
  -- Storage: PDF files go to R2; others are external links
  storage_type    TEXT NOT NULL DEFAULT 'upload'
                  CHECK (storage_type IN ('upload','link')),
  file_url        TEXT NOT NULL,                       -- R2 URL for uploads, external URL for links
  file_name       TEXT,
  file_size       BIGINT,                              -- bytes, null for links
  mime_type       TEXT,
  -- Version control
  version         INT NOT NULL DEFAULT 1,
  version_notes   TEXT,
  parent_id       UUID REFERENCES event_documents(id), -- previous version
  is_latest       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Access control
  visibility      TEXT NOT NULL DEFAULT 'team'
                  CHECK (visibility IN ('team','client','vendor','public')),
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status TEXT NOT NULL DEFAULT 'pending'
                  CHECK (approval_status IN ('pending','approved','rejected','not_required')),
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  -- Metadata
  description     TEXT,
  tags            TEXT[] DEFAULT '{}',
  uploaded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_documents_event    ON event_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_event_documents_tenant   ON event_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_documents_type     ON event_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_event_documents_folder   ON event_documents(folder_path);
CREATE INDEX IF NOT EXISTS idx_event_documents_latest   ON event_documents(is_latest) WHERE is_latest = TRUE;

-- ── Document access log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_access_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES event_documents(id) ON DELETE CASCADE,
  accessed_by UUID REFERENCES profiles(id),
  access_type TEXT NOT NULL DEFAULT 'view' CHECK (access_type IN ('view','download','share')),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  TEXT
);

CREATE INDEX IF NOT EXISTS idx_document_access_log_doc ON document_access_log(document_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE event_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_event_documents"
  ON event_documents USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_document_access_log"
  ON document_access_log USING (
    document_id IN (
      SELECT id FROM event_documents WHERE tenant_id = current_setting('app.tenant_id')::uuid
    )
  );

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_event_documents_updated_at ON event_documents;
CREATE TRIGGER set_event_documents_updated_at
  BEFORE UPDATE ON event_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
