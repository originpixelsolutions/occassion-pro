-- ============================================================
-- Migration 043: Feedback & Surveys
-- Post-event surveys, real-time feedback forms, NPS tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS event_surveys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  survey_type     TEXT NOT NULL DEFAULT 'post_event'
                  CHECK (survey_type IN (
                    'post_event','mid_event','vendor_rating','staff_rating',
                    'nps','session_feedback','catering_feedback','other'
                  )),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','active','closed','archived')),
  -- Distribution
  target_audience TEXT NOT NULL DEFAULT 'all_guests'
                  CHECK (target_audience IN ('all_guests','vip_only','staff_only','vendors','custom')),
  send_channel    TEXT[] DEFAULT '{}',             -- 'email','whatsapp','sms','qr_code'
  public_url_slug TEXT UNIQUE,                     -- for QR code landing page
  -- Timing
  opens_at        TIMESTAMPTZ,
  closes_at       TIMESTAMPTZ,
  auto_send_after_hours INT DEFAULT 2,             -- send X hours after event ends
  -- NPS
  nps_score_avg   NUMERIC(4,2),                    -- computed on response submission
  -- Metadata
  response_count  INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Survey questions
CREATE TABLE IF NOT EXISTS survey_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES event_surveys(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  question_type   TEXT NOT NULL DEFAULT 'rating'
                  CHECK (question_type IN (
                    'rating','nps','text','multiple_choice','checkbox',
                    'yes_no','scale_1_10','emoji','ranking'
                  )),
  is_required     BOOLEAN NOT NULL DEFAULT true,
  options         TEXT[] DEFAULT '{}',             -- for multiple_choice/checkbox
  min_label       TEXT,                            -- for scale questions
  max_label       TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Survey responses
CREATE TABLE IF NOT EXISTS survey_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES event_surveys(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Respondent (can be anonymous)
  respondent_name TEXT,
  respondent_email TEXT,
  guest_id        UUID REFERENCES guests(id),
  is_anonymous    BOOLEAN NOT NULL DEFAULT false,
  -- Answers stored as JSONB array: [{question_id, answer}]
  answers         JSONB NOT NULL DEFAULT '[]',
  -- Computed scores
  nps_score       INT CHECK (nps_score BETWEEN 0 AND 10),
  overall_rating  NUMERIC(3,1),
  -- Metadata
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_surveys_event     ON event_surveys(event_id);
CREATE INDEX IF NOT EXISTS idx_event_surveys_tenant    ON event_surveys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_surveys_status    ON event_surveys(status);
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON survey_questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_event  ON survey_responses(event_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_tenant ON survey_responses(tenant_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE event_surveys     ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_event_surveys"
  ON event_surveys USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_survey_questions"
  ON survey_questions USING (
    EXISTS (SELECT 1 FROM event_surveys es WHERE es.id = survey_id
            AND es.tenant_id = current_setting('app.tenant_id')::uuid)
  );
CREATE POLICY "tenant_isolation_survey_responses"
  ON survey_responses USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Public read for active surveys (for QR code landing page)
CREATE POLICY "public_read_active_surveys"
  ON event_surveys FOR SELECT USING (status = 'active');

DROP TRIGGER IF EXISTS set_event_surveys_updated_at ON event_surveys;
CREATE TRIGGER set_event_surveys_updated_at
  BEFORE UPDATE ON event_surveys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
