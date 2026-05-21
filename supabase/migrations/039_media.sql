-- ============================================================
-- Migration 039: Photography & Videography Management
-- ALL media is stored as EXTERNAL LINKS only (no R2 uploads).
-- Google Drive, Dropbox, WeTransfer, YouTube, Vimeo, etc.
-- Only PDFs (<5MB) and small assets go to R2 — not here.
-- ============================================================

CREATE TABLE IF NOT EXISTS event_shot_lists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category      TEXT NOT NULL DEFAULT 'general'
                CHECK (category IN (
                  'pre_event','ceremony','reception','speeches','candid',
                  'group_photos','detail_shots','venue','guests',
                  'performances','behind_scenes','other'
                )),
  shot_name     TEXT NOT NULL,
  description   TEXT,
  priority      TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('must_have','nice_to_have','optional')),
  people_involved TEXT[],              -- names of people needed for the shot
  location      TEXT,                  -- specific location/area at venue
  time_window   TEXT,                  -- e.g. "During cocktail hour"
  reference_url TEXT,                  -- external reference image (Drive/Dropbox link — NO R2)
  is_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  notes         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_shot_lists_event    ON event_shot_lists(event_id);
CREATE INDEX IF NOT EXISTS idx_event_shot_lists_tenant   ON event_shot_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_shot_lists_category ON event_shot_lists(category);

-- ── Media deliverables (external links only) ──────────────────────────────────
-- Every media_url MUST be an external link. This is enforced at application level.
CREATE TABLE IF NOT EXISTS media_deliverables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Categorisation
  media_category  TEXT NOT NULL DEFAULT 'photos'
                  CHECK (media_category IN (
                    'raw_photos','edited_photos','highlight_reel','full_video',
                    'teaser','same_day_edit','drone_footage','behind_scenes',
                    'photo_album','slideshow','social_cuts','other'
                  )),
  deliverable_name TEXT NOT NULL,
  description     TEXT,
  -- External link storage ONLY (no R2 uploads)
  link_type       TEXT NOT NULL DEFAULT 'drive'
                  CHECK (link_type IN (
                    'google_drive','dropbox','wetransfer','youtube','vimeo',
                    'onedrive','frame_io','smugmug','flickr','other'
                  )),
  media_url       TEXT NOT NULL,        -- external URL
  password_hint   TEXT,                 -- if link is password protected
  -- WeTransfer expiry tracking (links expire in 7 days)
  is_wetransfer   BOOLEAN NOT NULL DEFAULT FALSE,
  wetransfer_expiry DATE,               -- manually entered expiry date
  -- Metadata
  file_count      INT,                  -- approximate count of files
  total_size_gb   NUMERIC(6,2),         -- approximate size
  duration_mins   INT,                  -- for video deliverables
  resolution      TEXT,                 -- e.g. "4K", "1080p", "RAW"
  -- Status & review
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
                    'pending','uploaded_by_vendor','under_review',
                    'approved','revision_requested','delivered_to_client'
                  )),
  revision_notes  TEXT,
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  -- Deadline
  delivery_deadline DATE,
  delivered_at    TIMESTAMPTZ,
  -- Vendor linkage
  vendor_id       UUID REFERENCES vendors(id),
  -- Metadata
  tags            TEXT[] DEFAULT '{}',
  uploaded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_deliverables_event    ON media_deliverables(event_id);
CREATE INDEX IF NOT EXISTS idx_media_deliverables_tenant   ON media_deliverables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_media_deliverables_category ON media_deliverables(media_category);
CREATE INDEX IF NOT EXISTS idx_media_deliverables_status   ON media_deliverables(status);
CREATE INDEX IF NOT EXISTS idx_media_deliverables_deadline ON media_deliverables(delivery_deadline);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE event_shot_lists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_deliverables  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_event_shot_lists"
  ON event_shot_lists USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY "tenant_isolation_media_deliverables"
  ON media_deliverables USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ── Updated_at triggers ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_event_shot_lists_updated_at ON event_shot_lists;
CREATE TRIGGER set_event_shot_lists_updated_at
  BEFORE UPDATE ON event_shot_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_media_deliverables_updated_at ON media_deliverables;
CREATE TRIGGER set_media_deliverables_updated_at
  BEFORE UPDATE ON media_deliverables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
