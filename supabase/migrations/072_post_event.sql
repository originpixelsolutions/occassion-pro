-- ============================================================
-- Migration 072 — Post-Event Module
-- ============================================================

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE post_event_checklist_category AS ENUM (
  'venue', 'finance', 'vendors', 'guests', 'team', 'documents'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE survey_respondent_type AS ENUM ('guest', 'vendor', 'team', 'client');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TYPE survey_type           AS ENUM ('guest', 'vendor', 'team', 'client');
CREATE TYPE testimonial_source    AS ENUM ('survey', 'manual', 'whatsapp');
DO $$ BEGIN
  CREATE TYPE settlement_payment_status AS ENUM ('pending', 'paid', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TYPE post_event_report_type    AS ENUM ('internal', 'client');

-- ─── post_event_settings ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS post_event_settings (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  is_enabled                  boolean NOT NULL DEFAULT true,
  auto_enabled_hours_after_event int NOT NULL DEFAULT 2,
  checklist_seeded            boolean NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_event_settings_event_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_post_event_settings_event ON post_event_settings(event_id);

-- ─── post_event_checklist ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS post_event_checklist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_key      varchar(100) NOT NULL,
  label         varchar(255) NOT NULL,
  category      post_event_checklist_category NOT NULL DEFAULT 'documents',
  is_completed  boolean NOT NULL DEFAULT false,
  completed_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at  timestamptz,
  notes         text,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_checklist_event     ON post_event_checklist(event_id);
CREATE INDEX IF NOT EXISTS idx_post_checklist_completed ON post_event_checklist(event_id, is_completed);

-- ─── event_surveys ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_surveys (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  survey_type    survey_type NOT NULL DEFAULT 'guest',
  title          varchar(255) NOT NULL,
  questions      jsonb NOT NULL DEFAULT '[]',
  is_active      boolean NOT NULL DEFAULT true,
  response_count int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_surveys_event ON event_surveys(event_id);

-- ─── survey_responses ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS survey_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id        uuid NOT NULL REFERENCES event_surveys(id) ON DELETE CASCADE,
  respondent_type  survey_respondent_type NOT NULL DEFAULT 'guest',
  respondent_id    uuid,
  answers          jsonb NOT NULL DEFAULT '{}',
  submitted_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey       ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_respondent   ON survey_responses(respondent_id);

-- Increment response_count on new survey response
CREATE OR REPLACE FUNCTION increment_survey_response_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE event_surveys SET response_count = response_count + 1 WHERE id = NEW.survey_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_survey_response_count ON survey_responses;
CREATE TRIGGER trg_survey_response_count
  AFTER INSERT ON survey_responses
  FOR EACH ROW EXECUTE FUNCTION increment_survey_response_count();

-- ─── event_testimonials ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_testimonials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  author_name varchar(255) NOT NULL,
  author_role varchar(100),
  content     text NOT NULL,
  rating      int CHECK (rating BETWEEN 1 AND 5),
  source      testimonial_source NOT NULL DEFAULT 'manual',
  is_approved boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  media_url   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_event    ON event_testimonials(event_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_approved ON event_testimonials(event_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON event_testimonials(event_id, is_featured) WHERE is_featured = true;

-- ─── vendor_settlements ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_settlements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_assignment_id  uuid REFERENCES vendor_event_assignments(id) ON DELETE SET NULL,
  agreed_amount         decimal(12,2) NOT NULL DEFAULT 0,
  final_amount          decimal(12,2) NOT NULL DEFAULT 0,
  adjustment_reason     text,
  payment_status        settlement_payment_status NOT NULL DEFAULT 'pending',
  paid_at               timestamptz,
  payment_method        varchar(50),
  receipt_url           text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_settlements_event  ON vendor_settlements(event_id);
CREATE INDEX IF NOT EXISTS idx_vendor_settlements_status ON vendor_settlements(event_id, payment_status);

-- ─── post_event_reports ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS post_event_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  report_type    post_event_report_type NOT NULL DEFAULT 'internal',
  generated_at   timestamptz NOT NULL DEFAULT now(),
  pdf_url        text,
  data_snapshot  jsonb NOT NULL DEFAULT '{}',
  created_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_event_reports_event ON post_event_reports(event_id);

-- ─── Add archived_at to events table ──────────────────────────────────────────

ALTER TABLE events ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_archived ON events(is_archived) WHERE is_archived = true;

-- ─── Seed checklist function ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_post_event_checklist(p_event_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO post_event_checklist (event_id, item_key, label, category, sort_order) VALUES
    -- Venue (6 items)
    (p_event_id, 'venue_walkthrough',       'Complete venue walkthrough & damage check',        'venue', 1),
    (p_event_id, 'venue_items_returned',    'Return all borrowed items to venue',               'venue', 2),
    (p_event_id, 'venue_keys_returned',     'Return keys / access cards',                       'venue', 3),
    (p_event_id, 'venue_invoice_received',  'Receive final venue invoice',                      'venue', 4),
    (p_event_id, 'venue_deposit_refund',    'Confirm security deposit refund',                  'venue', 5),
    (p_event_id, 'venue_feedback_sent',     'Send feedback / review to venue',                  'venue', 6),

    -- Finance (5 items)
    (p_event_id, 'finance_all_invoices',    'Collect all vendor invoices',                      'finance', 1),
    (p_event_id, 'finance_budget_final',    'Finalize actual spend vs budget',                  'finance', 2),
    (p_event_id, 'finance_client_invoice',  'Send final invoice to client',                     'finance', 3),
    (p_event_id, 'finance_payment_received','Confirm client payment received',                  'finance', 4),
    (p_event_id, 'finance_expense_report',  'File expense report / receipts',                   'finance', 5),

    -- Vendors (4 items)
    (p_event_id, 'vendors_all_settled',     'Settle all vendor payments',                       'vendors', 1),
    (p_event_id, 'vendors_collect_items',   'Collect all rented items from vendors',            'vendors', 2),
    (p_event_id, 'vendors_feedback',        'Send feedback to vendors',                         'vendors', 3),
    (p_event_id, 'vendors_contracts_filed', 'File all vendor contracts & receipts',             'vendors', 4),

    -- Guests (4 items)
    (p_event_id, 'guests_thank_you',        'Send thank-you messages to guests',                'guests', 1),
    (p_event_id, 'guests_photos_shared',    'Share event photos with guests',                   'guests', 2),
    (p_event_id, 'guests_survey_sent',      'Send post-event survey to guests',                 'guests', 3),
    (p_event_id, 'guests_headcount_final',  'Reconcile final headcount & no-shows',             'guests', 4),

    -- Team (3 items)
    (p_event_id, 'team_debrief',            'Conduct team debrief meeting',                     'team', 1),
    (p_event_id, 'team_thank_you',          'Send appreciation to team members',                'team', 2),
    (p_event_id, 'team_lessons_learned',    'Document lessons learned',                         'team', 3),

    -- Documents (3 items)
    (p_event_id, 'docs_archive',            'Archive all event documents & contracts',          'documents', 1),
    (p_event_id, 'docs_report_internal',    'Generate internal post-event report',              'documents', 2),
    (p_event_id, 'docs_report_client',      'Generate & send client report',                    'documents', 3);
END;
$$;

-- ─── Auto-create post_event_settings and seed checklist on event insert ───────

CREATE OR REPLACE FUNCTION auto_create_post_event_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO post_event_settings (event_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_post_event_settings ON events;
CREATE TRIGGER trg_auto_post_event_settings
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION auto_create_post_event_settings();

-- ─── updated_at triggers ──────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vendor_settlements'] LOOP
    EXECUTE format($f$
      CREATE TRIGGER trg_%1$s_updated_at
        BEFORE UPDATE ON %1$s
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    $f$, t);
  END LOOP;
END;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE post_event_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_event_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_surveys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_testimonials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_settlements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_event_reports   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'post_event_settings',
    'post_event_checklist',
    'event_surveys',
    'survey_responses',
    'event_testimonials',
    'vendor_settlements',
    'post_event_reports'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "tenant_isolation_%1$s"
        ON %1$s FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM events e
            JOIN tenant_users tu ON tu.tenant_id = e.tenant_id
            WHERE e.id = CASE
              WHEN %1$s = 'survey_responses' THEN (SELECT survey_id FROM event_surveys es WHERE es.id = survey_id LIMIT 1)
              ELSE event_id
            END
            AND tu.user_id = auth.uid()
          )
        );
    $f$, t);
  END LOOP;
END;
$$;
