-- ============================================================
-- Migration: 071_conference.sql
-- ============================================================
-- ============================================================
-- Migration 071 — Conference Module
-- Full conference management: ticketing, speakers, sessions,
-- sponsors, exhibitors, live Q&A, polls, CEU, networking
-- ============================================================

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE conference_ticket_type AS ENUM (
  'general', 'vip', 'speaker', 'sponsor', 'exhibitor',
  'student', 'group', 'virtual', 'press', 'staff'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE conference_registration_status AS ENUM (
  'pending', 'confirmed', 'cancelled', 'waitlisted', 'checked_in', 'no_show'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE conference_session_type AS ENUM (
  'keynote', 'panel', 'workshop', 'breakout', 'lightning',
  'networking', 'fireside', 'demo', 'poster', 'exhibition'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE conference_session_status AS ENUM (
  'scheduled', 'live', 'completed', 'cancelled'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE speaker_status AS ENUM (
  'invited', 'confirmed', 'declined', 'cancelled'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sponsor_tier AS ENUM (
  'title', 'platinum', 'gold', 'silver', 'bronze', 'partner', 'media', 'community'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE exhibitor_status AS ENUM (
  'pending', 'confirmed', 'setup', 'active', 'concluded'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE question_status AS ENUM (
  'pending', 'approved', 'answered', 'dismissed'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE poll_status AS ENUM (
  'draft', 'active', 'closed', 'archived'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE networking_status AS ENUM (
  'pending', 'accepted', 'declined', 'blocked'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 1. conference_settings ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  tenant_id               uuid NOT NULL,
  is_enabled              boolean NOT NULL DEFAULT false,
  ticketing_enabled       boolean NOT NULL DEFAULT true,
  ceu_tracking_enabled    boolean NOT NULL DEFAULT false,
  networking_enabled      boolean NOT NULL DEFAULT true,
  live_qa_enabled         boolean NOT NULL DEFAULT true,
  polling_enabled         boolean NOT NULL DEFAULT true,
  max_attendees           integer,
  registration_opens_at   timestamptz,
  registration_closes_at  timestamptz,
  early_bird_until        timestamptz,
  welcome_message         text,
  code_of_conduct_url     varchar(500),
  hashtag                 varchar(100),
  wifi_name               varchar(200),
  wifi_password           varchar(200),
  app_store_url           varchar(500),
  play_store_url          varchar(500),
  streaming_url           varchar(500),
  custom_domain           varchar(255),
  branding_colors         jsonb DEFAULT '{}'::jsonb,
  meta                    jsonb DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conference_settings_event ON conference_settings(event_id);
CREATE INDEX IF NOT EXISTS idx_conference_settings_tenant ON conference_settings(tenant_id);

-- ─── 2. conference_tickets ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_tickets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL,
  name                varchar(100) NOT NULL,
  description         text,
  ticket_type         conference_ticket_type NOT NULL DEFAULT 'general',
  price               decimal(12, 2) NOT NULL DEFAULT 0,
  early_bird_price    decimal(12, 2),
  currency_code       char(3) NOT NULL DEFAULT 'INR',
  quantity_total      integer,
  quantity_sold       integer NOT NULL DEFAULT 0,
  quantity_reserved   integer NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  is_visible          boolean NOT NULL DEFAULT true,
  sale_starts_at      timestamptz,
  sale_ends_at        timestamptz,
  max_per_order       integer DEFAULT 10,
  min_per_order       integer DEFAULT 1,
  includes_meal       boolean NOT NULL DEFAULT false,
  includes_kit        boolean NOT NULL DEFAULT false,
  includes_recording  boolean NOT NULL DEFAULT false,
  access_sessions     uuid[] DEFAULT '{}',    -- null = all sessions
  color               varchar(7) DEFAULT '#6366f1',
  sort_order          integer NOT NULL DEFAULT 0,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conf_tickets_event ON conference_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_conf_tickets_tenant ON conference_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conf_tickets_active ON conference_tickets(event_id, is_active);

-- ─── 3. conference_registrations ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_registrations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL,
  ticket_id           uuid NOT NULL REFERENCES conference_tickets(id) ON DELETE RESTRICT,
  guest_id            uuid REFERENCES guests(id) ON DELETE SET NULL,
  registration_number varchar(50) NOT NULL,
  status              conference_registration_status NOT NULL DEFAULT 'pending',
  first_name          varchar(100) NOT NULL,
  last_name           varchar(100) NOT NULL,
  email               varchar(255) NOT NULL,
  phone               varchar(30),
  company             varchar(200),
  job_title           varchar(200),
  dietary_requirements varchar(200),
  t_shirt_size        varchar(10),
  badge_name          varchar(100),
  badge_company       varchar(100),
  qr_code             varchar(500),
  checked_in_at       timestamptz,
  checked_in_by       uuid,
  amount_paid         decimal(12, 2) NOT NULL DEFAULT 0,
  payment_reference   varchar(200),
  is_complimentary    boolean NOT NULL DEFAULT false,
  notes               text,
  custom_fields       jsonb DEFAULT '{}'::jsonb,
  sessions_attended   uuid[] DEFAULT '{}',
  ceu_credits_earned  decimal(6, 2) NOT NULL DEFAULT 0,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, registration_number),
  UNIQUE (event_id, email, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_conf_reg_event ON conference_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_conf_reg_tenant ON conference_registrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conf_reg_email ON conference_registrations(event_id, email);
CREATE INDEX IF NOT EXISTS idx_conf_reg_status ON conference_registrations(event_id, status);
CREATE INDEX IF NOT EXISTS idx_conf_reg_guest ON conference_registrations(guest_id) WHERE guest_id IS NOT NULL;

-- ─── 4. conference_speakers ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_speakers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL,
  first_name      varchar(100) NOT NULL,
  last_name       varchar(100) NOT NULL,
  email           varchar(255),
  phone           varchar(30),
  company         varchar(200),
  job_title       varchar(200),
  bio             text,
  photo_url       varchar(500),
  status          speaker_status NOT NULL DEFAULT 'invited',
  is_keynote      boolean NOT NULL DEFAULT false,
  is_featured     boolean NOT NULL DEFAULT false,
  speaker_order   integer NOT NULL DEFAULT 0,
  linkedin_url    varchar(500),
  twitter_handle  varchar(100),
  website_url     varchar(500),
  topics          text[],
  languages       varchar(10)[] DEFAULT '{"en"}',
  travel_required boolean NOT NULL DEFAULT false,
  hotel_required  boolean NOT NULL DEFAULT false,
  honorarium      decimal(12, 2),
  honorarium_currency char(3),
  dietary_requirements varchar(200),
  notes           text,
  contract_url    varchar(500),
  meta            jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conf_speakers_event ON conference_speakers(event_id);
CREATE INDEX IF NOT EXISTS idx_conf_speakers_tenant ON conference_speakers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conf_speakers_status ON conference_speakers(event_id, status);
CREATE INDEX IF NOT EXISTS idx_conf_speakers_featured ON conference_speakers(event_id, is_featured);

-- ─── 5. conference_sessions ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL,
  title               varchar(300) NOT NULL,
  description         text,
  session_type        conference_session_type NOT NULL DEFAULT 'breakout',
  status              conference_session_status NOT NULL DEFAULT 'scheduled',
  track               varchar(100),
  room                varchar(200),
  room_capacity       integer,
  floor               varchar(50),
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz NOT NULL,
  duration_minutes    integer GENERATED ALWAYS AS (
                        EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60
                      )::integer STORED,
  day_number          integer,
  is_virtual          boolean NOT NULL DEFAULT false,
  stream_url          varchar(500),
  recording_url       varchar(500),
  slides_url          varchar(500),
  is_ticketed         boolean NOT NULL DEFAULT false,
  allowed_ticket_types conference_ticket_type[],
  max_attendees       integer,
  registered_count    integer NOT NULL DEFAULT 0,
  ceu_credits         decimal(4, 2) NOT NULL DEFAULT 0,
  ceu_type            varchar(100),
  language            varchar(10) DEFAULT 'en',
  difficulty_level    varchar(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'all')),
  tags                text[],
  is_featured         boolean NOT NULL DEFAULT false,
  requires_signup     boolean NOT NULL DEFAULT false,
  sort_order          integer NOT NULL DEFAULT 0,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conf_sessions_event ON conference_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_conf_sessions_tenant ON conference_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conf_sessions_starts ON conference_sessions(event_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_conf_sessions_track ON conference_sessions(event_id, track);
CREATE INDEX IF NOT EXISTS idx_conf_sessions_status ON conference_sessions(event_id, status);

-- ─── 5b. session_speakers junction ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_session_speakers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES conference_sessions(id) ON DELETE CASCADE,
  speaker_id    uuid NOT NULL REFERENCES conference_speakers(id) ON DELETE CASCADE,
  role          varchar(50) DEFAULT 'speaker',  -- speaker|moderator|panelist|host
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, speaker_id)
);

CREATE INDEX IF NOT EXISTS idx_sess_spkr_session ON conference_session_speakers(session_id);
CREATE INDEX IF NOT EXISTS idx_sess_spkr_speaker ON conference_session_speakers(speaker_id);

-- ─── 6. session_attendees ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_session_attendees (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES conference_sessions(id) ON DELETE CASCADE,
  registration_id     uuid NOT NULL REFERENCES conference_registrations(id) ON DELETE CASCADE,
  event_id            uuid NOT NULL,
  checked_in_at       timestamptz,
  checked_in_by       uuid,
  ceu_issued          boolean NOT NULL DEFAULT false,
  ceu_issued_at       timestamptz,
  feedback_rating     smallint CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_comment    text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_sess_att_session ON conference_session_attendees(session_id);
CREATE INDEX IF NOT EXISTS idx_sess_att_reg ON conference_session_attendees(registration_id);
CREATE INDEX IF NOT EXISTS idx_sess_att_event ON conference_session_attendees(event_id);

-- ─── 7. conference_sponsors ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_sponsors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL,
  company_name        varchar(200) NOT NULL,
  tier                sponsor_tier NOT NULL DEFAULT 'bronze',
  logo_url            varchar(500),
  website_url         varchar(500),
  tagline             varchar(300),
  description         text,
  contact_name        varchar(200),
  contact_email       varchar(255),
  contact_phone       varchar(30),
  booth_number        varchar(20),
  sponsorship_amount  decimal(14, 2),
  currency_code       char(3) DEFAULT 'INR',
  contract_url        varchar(500),
  invoice_url         varchar(500),
  payment_status      varchar(30) DEFAULT 'pending',
  benefits            jsonb DEFAULT '[]'::jsonb,
  social_links        jsonb DEFAULT '{}'::jsonb,
  is_featured         boolean NOT NULL DEFAULT false,
  sort_order          integer NOT NULL DEFAULT 0,
  notes               text,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conf_sponsors_event ON conference_sponsors(event_id);
CREATE INDEX IF NOT EXISTS idx_conf_sponsors_tenant ON conference_sponsors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conf_sponsors_tier ON conference_sponsors(event_id, tier);

-- ─── 8. conference_exhibitors ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_exhibitors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL,
  company_name        varchar(200) NOT NULL,
  status              exhibitor_status NOT NULL DEFAULT 'pending',
  booth_number        varchar(20),
  booth_size          varchar(50),
  hall                varchar(100),
  logo_url            varchar(500),
  website_url         varchar(500),
  description         text,
  category            varchar(100),
  contact_name        varchar(200),
  contact_email       varchar(255),
  contact_phone       varchar(30),
  setup_time          timestamptz,
  teardown_time       timestamptz,
  power_required      boolean NOT NULL DEFAULT false,
  internet_required   boolean NOT NULL DEFAULT false,
  floor_plan_position jsonb,    -- {x, y, width, height}
  exhibitor_fee       decimal(12, 2),
  currency_code       char(3) DEFAULT 'INR',
  payment_status      varchar(30) DEFAULT 'pending',
  staff_count         integer DEFAULT 2,
  notes               text,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conf_exhibitors_event ON conference_exhibitors(event_id);
CREATE INDEX IF NOT EXISTS idx_conf_exhibitors_tenant ON conference_exhibitors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conf_exhibitors_status ON conference_exhibitors(event_id, status);

-- ─── 9. conference_live_questions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_live_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES conference_sessions(id) ON DELETE CASCADE,
  event_id        uuid NOT NULL,
  tenant_id       uuid NOT NULL,
  registration_id uuid REFERENCES conference_registrations(id) ON DELETE SET NULL,
  asked_by_name   varchar(200),
  question_text   text NOT NULL,
  status          question_status NOT NULL DEFAULT 'pending',
  upvotes         integer NOT NULL DEFAULT 0,
  is_anonymous    boolean NOT NULL DEFAULT false,
  answered_by     uuid,
  answer_text     text,
  answered_at     timestamptz,
  sort_order      integer NOT NULL DEFAULT 0,
  meta            jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_q_session ON conference_live_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_live_q_event ON conference_live_questions(event_id);
CREATE INDEX IF NOT EXISTS idx_live_q_status ON conference_live_questions(session_id, status);

-- ─── 9b. question_upvotes ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_question_upvotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     uuid NOT NULL REFERENCES conference_live_questions(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES conference_registrations(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_q_upvotes_question ON conference_question_upvotes(question_id);

-- ─── 10. conference_live_polls ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_live_polls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid REFERENCES conference_sessions(id) ON DELETE CASCADE,
  event_id      uuid NOT NULL,
  tenant_id     uuid NOT NULL,
  question      text NOT NULL,
  status        poll_status NOT NULL DEFAULT 'draft',
  is_anonymous  boolean NOT NULL DEFAULT true,
  allow_multiple boolean NOT NULL DEFAULT false,
  show_results  boolean NOT NULL DEFAULT true,
  options       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- options format: [{ id, text, votes_count }]
  total_votes   integer NOT NULL DEFAULT 0,
  started_at    timestamptz,
  closed_at     timestamptz,
  created_by    uuid,
  meta          jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polls_session ON conference_live_polls(session_id);
CREATE INDEX IF NOT EXISTS idx_polls_event ON conference_live_polls(event_id);
CREATE INDEX IF NOT EXISTS idx_polls_status ON conference_live_polls(event_id, status);

-- ─── 10b. poll_responses ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_poll_responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id         uuid NOT NULL REFERENCES conference_live_polls(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES conference_registrations(id) ON DELETE CASCADE,
  selected_options jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array of option IDs
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_resp_poll ON conference_poll_responses(poll_id);

-- ─── 11. conference_ceu_credits ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_ceu_credits (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registration_id     uuid NOT NULL REFERENCES conference_registrations(id) ON DELETE CASCADE,
  session_id          uuid REFERENCES conference_sessions(id) ON DELETE SET NULL,
  tenant_id           uuid NOT NULL,
  credit_type         varchar(100) NOT NULL,
  credits             decimal(6, 2) NOT NULL,
  accreditation_body  varchar(200),
  certificate_number  varchar(100),
  certificate_url     varchar(500),
  issued_at           timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz,
  issued_by           uuid,
  notes               text,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ceu_event ON conference_ceu_credits(event_id);
CREATE INDEX IF NOT EXISTS idx_ceu_registration ON conference_ceu_credits(registration_id);
CREATE INDEX IF NOT EXISTS idx_ceu_session ON conference_ceu_credits(session_id) WHERE session_id IS NOT NULL;

-- ─── 12. conference_networking_connections ────────────────────────────────────

CREATE TABLE IF NOT EXISTS conference_networking_connections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  requester_id        uuid NOT NULL REFERENCES conference_registrations(id) ON DELETE CASCADE,
  recipient_id        uuid NOT NULL REFERENCES conference_registrations(id) ON DELETE CASCADE,
  status              networking_status NOT NULL DEFAULT 'pending',
  message             text,
  meeting_scheduled   boolean NOT NULL DEFAULT false,
  meeting_time        timestamptz,
  meeting_location    varchar(300),
  notes               text,
  connected_at        timestamptz,
  meta                jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, requester_id, recipient_id),
  CHECK (requester_id != recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_networking_event ON conference_networking_connections(event_id);
CREATE INDEX IF NOT EXISTS idx_networking_requester ON conference_networking_connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_networking_recipient ON conference_networking_connections(recipient_id);
CREATE INDEX IF NOT EXISTS idx_networking_status ON conference_networking_connections(event_id, status);

-- ─── Updated-at triggers ─────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'conference_settings', 'conference_tickets', 'conference_registrations',
    'conference_speakers', 'conference_sessions', 'conference_sponsors',
    'conference_exhibitors', 'conference_live_questions', 'conference_live_polls',
    'conference_networking_connections'
  ] LOOP
    EXECUTE format('
      CREATE OR REPLACE TRIGGER set_updated_at_%s
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    ', t, t);
  END LOOP;
END;
$$;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'conference_settings', 'conference_tickets', 'conference_registrations',
    'conference_speakers', 'conference_sessions', 'conference_session_speakers',
    'conference_session_attendees', 'conference_sponsors', 'conference_exhibitors',
    'conference_live_questions', 'conference_question_upvotes',
    'conference_live_polls', 'conference_poll_responses',
    'conference_ceu_credits', 'conference_networking_connections'
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY "service_role_bypass_%s" ON %s TO service_role USING (true) WITH CHECK (true);',
      t, t
    );
  END LOOP;
END;
$$;

-- ─── Realtime ─────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE conference_live_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE conference_live_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE conference_registrations;

-- ─── Helper: auto-increment ticket sold count ─────────────────────────────────

CREATE OR REPLACE FUNCTION increment_ticket_sold_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    UPDATE conference_tickets SET quantity_sold = quantity_sold + 1 WHERE id = NEW.ticket_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
      UPDATE conference_tickets SET quantity_sold = quantity_sold + 1 WHERE id = NEW.ticket_id;
    ELSIF OLD.status = 'confirmed' AND NEW.status IN ('cancelled', 'no_show') THEN
      UPDATE conference_tickets SET quantity_sold = GREATEST(quantity_sold - 1, 0) WHERE id = NEW.ticket_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_sold_count ON conference_registrations;
CREATE TRIGGER trg_ticket_sold_count
AFTER INSERT OR UPDATE ON conference_registrations
FOR EACH ROW EXECUTE FUNCTION increment_ticket_sold_count();

-- ─── Helper: auto-increment session registered_count ─────────────────────────

CREATE OR REPLACE FUNCTION increment_session_registered_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conference_sessions SET registered_count = registered_count + 1 WHERE id = NEW.session_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE conference_sessions SET registered_count = GREATEST(registered_count - 1, 0) WHERE id = OLD.session_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_session_reg_count ON conference_session_attendees;
CREATE TRIGGER trg_session_reg_count
AFTER INSERT OR DELETE ON conference_session_attendees
FOR EACH ROW EXECUTE FUNCTION increment_session_registered_count();

-- ─── Helper: auto-increment poll votes ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_poll_votes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conference_live_polls SET total_votes = total_votes + 1 WHERE id = NEW.poll_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE conference_live_polls SET total_votes = GREATEST(total_votes - 1, 0) WHERE id = OLD.poll_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_poll_votes ON conference_poll_responses;
CREATE TRIGGER trg_poll_votes
AFTER INSERT OR DELETE ON conference_poll_responses
FOR EACH ROW EXECUTE FUNCTION update_poll_votes();

-- ─── Helper: auto-increment question upvotes ─────────────────────────────────

CREATE OR REPLACE FUNCTION update_question_upvotes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conference_live_questions SET upvotes = upvotes + 1 WHERE id = NEW.question_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE conference_live_questions SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = OLD.question_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_question_upvotes ON conference_question_upvotes;
CREATE TRIGGER trg_question_upvotes
AFTER INSERT OR DELETE ON conference_question_upvotes
FOR EACH ROW EXECUTE FUNCTION update_question_upvotes();

-- ─── Sequence / registration number helper ────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS conf_reg_seq START 1000 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_registration_number(p_event_id uuid)
RETURNS varchar LANGUAGE plpgsql AS $$
DECLARE
  v_prefix varchar;
  v_seq    bigint;
BEGIN
  SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'), 3))
    INTO v_prefix
    FROM events WHERE id = p_event_id;

  v_prefix := COALESCE(v_prefix, 'REG');
  v_seq := nextval('conf_reg_seq');
  RETURN v_prefix || '-' || LPAD(v_seq::text, 6, '0');
END;
$$;

-- Comments
COMMENT ON TABLE conference_settings IS 'Per-event conference feature toggles and metadata';
COMMENT ON TABLE conference_tickets IS 'Ticket types available for an event';
COMMENT ON TABLE conference_registrations IS 'Individual attendee registrations with badge and check-in info';
COMMENT ON TABLE conference_speakers IS 'Speaker profiles including honorarium and logistics';
COMMENT ON TABLE conference_sessions IS 'Agenda sessions with room, time, CEU, and capacity';
COMMENT ON TABLE conference_session_speakers IS 'Many-to-many: speakers per session with role';
COMMENT ON TABLE conference_session_attendees IS 'Per-session check-in and CEU issuance';
COMMENT ON TABLE conference_sponsors IS 'Sponsors by tier with contract and payment tracking';
COMMENT ON TABLE conference_exhibitors IS 'Exhibitor booths with floor-plan position and logistics';
COMMENT ON TABLE conference_live_questions IS 'Audience Q&A with moderation queue';
COMMENT ON TABLE conference_live_polls IS 'Live polls with embedded options JSONB';
COMMENT ON TABLE conference_ceu_credits IS 'Continuing education units issued per registration/session';
COMMENT ON TABLE conference_networking_connections IS 'Attendee-to-attendee connection requests and meetings';

-- ============================================================
-- Migration: 072_post_event.sql
-- ============================================================
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
  completed_by  uuid REFERENCES users(id) ON DELETE SET NULL,
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
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
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

-- ============================================================
-- Migration: 073_api_access_requests_and_badges.sql
-- ============================================================
-- ============================================================
-- Migration 073 — API Access Requests + Badge Templates
-- ============================================================
-- NOTE: Core external-API tables (api_keys, api_webhooks,
--       webhook_deliveries, api_usage_logs, api_scopes) were
--       created in migration 059.  This migration adds:
--   1. api_access_requests — tenant-level API-tier requests
--      awaiting Super Admin approval before keys can be created
--   2. badge_template JSONB column on events (for print badges)
--   3. 90-day retention index on api_usage_logs
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. API Access Requests
--    Tenants on free/starter plans submit a request to unlock
--    the external API.  Super Admin approves/rejects.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_access_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_requested    VARCHAR(30) NOT NULL DEFAULT 'agency'
                      CHECK (plan_requested IN ('agency','enterprise','custom')),
  use_case          TEXT NOT NULL,                  -- What will they use the API for?
  expected_rps      INT,                            -- Expected requests per second
  requested_scopes  TEXT[] NOT NULL DEFAULT '{}',  -- Scopes they need
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  -- Auto-provisioning on approval
  auto_provision    BOOLEAN NOT NULL DEFAULT TRUE,  -- Create first key automatically
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate pending requests per tenant
  CONSTRAINT api_access_requests_one_pending_per_tenant
    EXCLUDE USING btree (tenant_id WITH =)
    WHERE (status = 'pending')
);

CREATE INDEX IF NOT EXISTS idx_api_access_requests_tenant
  ON public.api_access_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_access_requests_status
  ON public.api_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_api_access_requests_created
  ON public.api_access_requests(created_at DESC);

-- Updated-at trigger (reuse function from migration 059)
DROP TRIGGER IF EXISTS trg_api_access_requests_updated_at ON public.api_access_requests;
CREATE TRIGGER trg_api_access_requests_updated_at
  BEFORE UPDATE ON public.api_access_requests
  FOR EACH ROW EXECUTE FUNCTION update_api_updated_at();

-- RLS
ALTER TABLE public.api_access_requests ENABLE ROW LEVEL SECURITY;

-- Tenant users can see and manage their own requests
CREATE POLICY "api_access_requests_tenant_isolation"
  ON public.api_access_requests
  USING (tenant_id = (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  ));

-- ─────────────────────────────────────────────
-- 2. Badge Template Column on events
-- ─────────────────────────────────────────────
-- Stores the tenant's per-event badge design choices.
-- Shape (all fields optional, resolved to defaults in service):
-- {
--   layout        : "6up" | "8up" | "avery5160"
--   paper_size    : "A4" | "Letter"
--   orientation   : "landscape" | "portrait"
--   show_fields   : ["guest_name","category","table","company","qr_code","event_name","logo"]
--   primary_color : "#7c3aed"
--   secondary_color: "#f5f3ff"
--   text_color    : "#1a1a2e"
--   font_family   : "Helvetica" | "Times-Roman" | "Courier"
--   logo_url      : "https://..."
--   background_url: "https://..."
--   qr_size       : 60        -- px
--   badge_width_mm : 85
--   badge_height_mm: 55
--   corner_radius  : 6
--   updated_at    : "ISO string"
-- }
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS badge_template JSONB;

COMMENT ON COLUMN public.events.badge_template IS
  'Per-event badge print template config (layout, colours, visible fields). See migration 073.';

-- GIN index so we can filter events that have a template configured
CREATE INDEX IF NOT EXISTS idx_events_badge_template
  ON public.events USING GIN (badge_template)
  WHERE badge_template IS NOT NULL;

-- ─────────────────────────────────────────────
-- 3. 90-day Retention Index on api_usage_logs
--    Facilitates efficient purge of old rows by a scheduled job
-- ─────────────────────────────────────────────
-- Composite index covering tenant + date range queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_api_usage_tenant_requested
  ON public.api_usage_logs(tenant_id, requested_at DESC);

-- Retention-purge helper: partial index on old rows so a pg_cron job can
-- DELETE FROM api_usage_logs WHERE requested_at < NOW() - INTERVAL '90 days'
-- efficiently without a seq scan.
CREATE INDEX IF NOT EXISTS idx_api_usage_old_rows
  ON public.api_usage_logs(requested_at)
  WHERE requested_at < NOW() - INTERVAL '90 days';

-- ─────────────────────────────────────────────
-- 4. Additional api_scopes seed rows (rsvp + print)
--    Extend the seed from migration 059 with scopes used by
--    post-event and badge modules.
-- ─────────────────────────────────────────────
INSERT INTO public.api_scopes (scope, category, description, is_sensitive)
VALUES
  ('rsvp:write',       'Guests',    'Submit RSVP responses via API',       FALSE),
  ('checkin:write',    'Guests',    'Mark guest attendance via API',        FALSE),
  ('post_event:read',  'Post-Event','Read post-event reports and surveys', FALSE),
  ('badges:generate',  'Guests',    'Trigger badge PDF generation',         FALSE)
ON CONFLICT (scope) DO NOTHING;

-- ============================================================
-- Migration: 074_user_device_tokens.sql
-- ============================================================
-- Migration 074: User Device Tokens
-- Stores Expo push notification tokens per user for mobile push delivery.

create table if not exists public.user_device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tenant_id   uuid not null,
  token       text not null,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, token)
);

-- Index for looking up all tokens for a user (to send pushes)
create index if not exists idx_device_tokens_user_id
  on public.user_device_tokens(user_id);

-- Index for tenant-wide token lookups
create index if not exists idx_device_tokens_tenant_id
  on public.user_device_tokens(tenant_id);

-- RLS: users can only manage their own tokens
alter table public.user_device_tokens enable row level security;

create policy "users manage own tokens"
  on public.user_device_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role can read all tokens (needed for push delivery from API)
create policy "service role full access"
  on public.user_device_tokens
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- Migration: 075_onboarding.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 075: Tenant Onboarding
--
-- Adds onboarding wizard state columns to the tenants table.
-- Referenced by: tenants.service.ts → getOnboardingStatus / advanceStep
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS onboarding_step          int          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at  timestamptz;

COMMENT ON COLUMN tenants.onboarding_step IS
  '0 = not started; 1–4 = wizard step; 5 = complete (also sets onboarding_completed_at)';

COMMENT ON COLUMN tenants.onboarding_completed_at IS
  'Set when onboarding_step reaches 5. NULL means onboarding is still in progress.';

-- Index for super-admin onboarding funnel queries
CREATE INDEX IF NOT EXISTS idx_tenants_onboarding_step
  ON tenants(onboarding_step)
  WHERE onboarding_completed_at IS NULL;

-- ============================================================
-- Migration: 076_intelligence.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 076: Intelligence Layer
--
-- Tables for the rule-based AI intelligence engine:
--   • smart_alerts    — per-event rule-triggered alerts
--   • event_health_scores — aggregated health score per event
--
-- Referenced by: intelligence.service.ts
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── smart_alerts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS smart_alerts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id    uuid        NOT NULL,
  alert_type   text        NOT NULL,                 -- unique rule key, e.g. 'guest_count_low'
  severity     alert_severity NOT NULL DEFAULT 'info',
  title        text        NOT NULL,
  message      text        NOT NULL,
  context      jsonb,                                -- rule-specific data (thresholds, counts, etc.)
  is_dismissed boolean     NOT NULL DEFAULT false,
  dismissed_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  dismissed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT smart_alerts_event_type_unique UNIQUE (event_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_smart_alerts_event     ON smart_alerts(event_id) WHERE is_dismissed = false;
CREATE INDEX IF NOT EXISTS idx_smart_alerts_tenant    ON smart_alerts(tenant_id) WHERE is_dismissed = false;
CREATE INDEX IF NOT EXISTS idx_smart_alerts_severity  ON smart_alerts(severity, created_at DESC);

ALTER TABLE smart_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_alerts_tenant_read"
  ON smart_alerts FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "smart_alerts_tenant_update"
  ON smart_alerts FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "smart_alerts_service_all"
  ON smart_alerts FOR ALL
  USING (auth.role() = 'service_role');

-- ── event_health_scores ───────────────────────────────────
CREATE TABLE IF NOT EXISTS event_health_scores (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id        uuid        NOT NULL,
  overall_score    int         NOT NULL DEFAULT 100 CHECK (overall_score BETWEEN 0 AND 100),
  dimension_scores jsonb       NOT NULL DEFAULT '{}'::jsonb,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  recompute_at     timestamptz NOT NULL DEFAULT (now() + interval '6 hours'),

  CONSTRAINT event_health_scores_event_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_health_scores_tenant   ON event_health_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_health_scores_recompute ON event_health_scores(recompute_at);

ALTER TABLE event_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_health_scores_tenant_read"
  ON event_health_scores FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "event_health_scores_service_all"
  ON event_health_scores FOR ALL
  USING (auth.role() = 'service_role');

-- ── updated_at trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_smart_alerts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_smart_alerts_updated_at ON smart_alerts;
CREATE TRIGGER trg_smart_alerts_updated_at
  BEFORE UPDATE ON smart_alerts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_smart_alerts();

-- ============================================================
-- Migration: 077_fnb_v2.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 077: F&B Module v2
--
-- Full F&B management schema — menus, items, serving stations,
-- token batches, token issuance, and consumption logging.
--
-- Referenced by: fnb.service.ts
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE fnb_meal_type     AS ENUM ('breakfast','lunch','dinner','brunch','hi_tea','snacks','cocktail','supper','custom');
  CREATE TYPE fnb_dietary_type  AS ENUM ('veg','non_veg','vegan','jain','gluten_free','kosher','halal','custom');
  CREATE TYPE fnb_serving_type  AS ENUM ('plated','buffet','live_cooking','thali','token','bar_service','food_stall','family_style','canape','cocktail_style','packed','custom');
  CREATE TYPE fnb_station_type  AS ENUM ('buffet','live','bar','dessert','juice','tea_coffee','welcome_drink','custom');
  CREATE TYPE fnb_token_status  AS ENUM ('issued','used','expired','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── fnb_menus ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_menus (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL,
  name           text        NOT NULL,
  meal_type      fnb_meal_type NOT NULL DEFAULT 'custom',
  service_time   timestamptz,
  guest_count    int,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_menus_event ON fnb_menus(event_id);

-- ── fnb_menu_items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_menu_items (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id         uuid         NOT NULL REFERENCES fnb_menus(id) ON DELETE CASCADE,
  event_id        uuid         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id       uuid         NOT NULL,
  name            text         NOT NULL,
  description     text,
  category        text,                             -- e.g. 'starter', 'main', 'dessert'
  dietary_type    fnb_dietary_type NOT NULL DEFAULT 'veg',
  serving_type    fnb_serving_type NOT NULL DEFAULT 'buffet',
  quantity        numeric(10,2),
  unit            text,                             -- 'kg', 'pcs', 'litre', etc.
  cost_per_unit   numeric(12,2),
  total_cost      numeric(14,2),
  sort_order      int          NOT NULL DEFAULT 0,
  is_active       boolean      NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_menu_items_menu   ON fnb_menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_fnb_menu_items_event  ON fnb_menu_items(event_id);

-- ── fnb_serving_stations ──────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_serving_stations (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL,
  name           text        NOT NULL,
  station_type   fnb_station_type NOT NULL DEFAULT 'buffet',
  location       text,
  capacity       int,
  staff_count    int         NOT NULL DEFAULT 0,
  assigned_items jsonb       NOT NULL DEFAULT '[]'::jsonb,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fnb_serving_stations_event ON fnb_serving_stations(event_id);

-- ── fnb_token_batches ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_token_batches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id       uuid        NOT NULL,
  menu_item_id    uuid        REFERENCES fnb_menu_items(id) ON DELETE SET NULL,
  batch_code      text        NOT NULL,
  total_tokens    int         NOT NULL DEFAULT 0,
  issued_tokens   int         NOT NULL DEFAULT 0,
  batch_type      text        NOT NULL DEFAULT 'standard',
  notes           text,
  valid_from      timestamptz,
  valid_until     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fnb_token_batches_code_unique UNIQUE (event_id, batch_code)
);

CREATE INDEX IF NOT EXISTS idx_fnb_token_batches_event ON fnb_token_batches(event_id);

-- ── fnb_tokens ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid        NOT NULL REFERENCES fnb_token_batches(id) ON DELETE CASCADE,
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id     uuid        NOT NULL,
  guest_id      uuid        REFERENCES guests(id) ON DELETE SET NULL,
  token_code    text        NOT NULL,
  status        fnb_token_status NOT NULL DEFAULT 'issued',
  used_at       timestamptz,
  used_at_station text,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fnb_tokens_code_unique UNIQUE (event_id, token_code)
);

CREATE INDEX IF NOT EXISTS idx_fnb_tokens_batch   ON fnb_tokens(batch_id);
CREATE INDEX IF NOT EXISTS idx_fnb_tokens_guest   ON fnb_tokens(guest_id);
CREATE INDEX IF NOT EXISTS idx_fnb_tokens_event   ON fnb_tokens(event_id);

-- ── fnb_consumption_log ───────────────────────────────────
CREATE TABLE IF NOT EXISTS fnb_consumption_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id      uuid        NOT NULL,
  menu_item_id   uuid        REFERENCES fnb_menu_items(id) ON DELETE SET NULL,
  guest_id       uuid        REFERENCES guests(id) ON DELETE SET NULL,
  quantity       numeric(10,2) NOT NULL DEFAULT 1,
  station        text,
  consumed_at    timestamptz NOT NULL DEFAULT now(),
  notes          text
);

CREATE INDEX IF NOT EXISTS idx_fnb_consumption_log_event ON fnb_consumption_log(event_id);
CREATE INDEX IF NOT EXISTS idx_fnb_consumption_log_item  ON fnb_consumption_log(menu_item_id);

-- ── RLS (tenant-scoped) ───────────────────────────────────
ALTER TABLE fnb_menus          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_menu_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_serving_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_token_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fnb_consumption_log ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['fnb_menus','fnb_menu_items','fnb_serving_stations','fnb_token_batches','fnb_tokens','fnb_consumption_log'] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_tenant" ON %1$s FOR ALL
        USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()))
        WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));
      CREATE POLICY "%1$s_service" ON %1$s FOR ALL USING (auth.role() = 'service_role');
    $f$, t);
  END LOOP;
END $$;

-- ============================================================
-- Migration: 078_tenant_payments.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 078: Tenant Payments
--
-- Full event ticketing and payment infrastructure:
--   • tenant_payment_gateways  — per-tenant gateway config (AES-256-GCM encrypted)
--   • event_payment_settings   — per-event payment configuration
--   • event_ticket_types       — ticket catalog (price, inventory, sale window)
--   • event_payment_orders     — order lifecycle (initiated → paid → refunded)
--   • event_payment_refunds    — refund tracking per order
--   • event_discount_codes     — percentage/fixed discount codes with usage limits
--
-- Referenced by: tenant-payments.service.ts
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE payment_order_status AS ENUM (
    'initiated','pending','paid','failed','cancelled',
    'refunded','partially_refunded','expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE payment_refund_status AS ENUM ('pending','processing','success','failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE discount_type AS ENUM ('percentage','fixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── tenant_payment_gateways ────────────────────────────────────────────────────
-- Stores one row per provider per tenant.
-- config and webhook_secret are AES-256-GCM encrypted blobs (iv:tag:enc).
CREATE TABLE IF NOT EXISTS tenant_payment_gateways (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL,
  provider        text        NOT NULL,  -- 'razorpay'|'stripe'|'cashfree'|'payumoney'|'instamojo'|'manual'
  display_name    text        NOT NULL,
  config          text        NOT NULL,  -- encrypted JSON: API keys, secrets
  webhook_secret  text,                  -- encrypted, nullable
  is_active       boolean     NOT NULL DEFAULT true,
  is_default      boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_payment_gateways_provider_unique UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_gateways_tenant
  ON tenant_payment_gateways(tenant_id);

-- ── event_payment_settings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_payment_settings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id               uuid        NOT NULL,
  gateway_id              uuid        REFERENCES tenant_payment_gateways(id) ON DELETE SET NULL,
  is_payments_enabled     boolean     NOT NULL DEFAULT false,
  currency                text        NOT NULL DEFAULT 'INR',
  payment_title           text,
  collect_phone           boolean     NOT NULL DEFAULT true,
  collect_address         boolean     NOT NULL DEFAULT false,
  collect_gst             boolean     NOT NULL DEFAULT false,
  gst_percentage          numeric(5,2) NOT NULL DEFAULT 18,
  convenience_fee_pct     numeric(5,2) NOT NULL DEFAULT 0,
  success_redirect_url    text,
  failure_redirect_url    text,
  custom_fields           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT event_payment_settings_event_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_payment_settings_event
  ON event_payment_settings(event_id);

-- ── event_ticket_types ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_ticket_types (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id           uuid          NOT NULL,
  name                text          NOT NULL,
  description         text,
  category            text,
  price               numeric(12,2) NOT NULL DEFAULT 0,
  currency            text          NOT NULL DEFAULT 'INR',
  total_quantity      int,          -- NULL = unlimited
  sold_quantity       int           NOT NULL DEFAULT 0,
  reserved_quantity   int           NOT NULL DEFAULT 0,
  min_per_order       int           NOT NULL DEFAULT 1,
  max_per_order       int           NOT NULL DEFAULT 10,
  sale_starts_at      timestamptz,
  sale_ends_at        timestamptz,
  is_active           boolean       NOT NULL DEFAULT true,
  sort_order          int           NOT NULL DEFAULT 0,
  metadata            jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_ticket_types_event
  ON event_ticket_types(event_id);

-- ── event_payment_orders ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_payment_orders (
  id                    uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              uuid                  NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id             uuid                  NOT NULL,
  gateway_id            uuid                  REFERENCES tenant_payment_gateways(id) ON DELETE SET NULL,
  guest_id              uuid                  REFERENCES guests(id) ON DELETE SET NULL,
  discount_code_id      uuid,                 -- FK added after event_discount_codes is created
  order_ref             text                  NOT NULL,
  provider_order_id     text,
  provider_payment_id   text,
  provider_metadata     jsonb,
  guest_name            text                  NOT NULL,
  guest_email           text                  NOT NULL,
  guest_phone           text,
  line_items            jsonb                 NOT NULL DEFAULT '[]'::jsonb,
  subtotal              numeric(14,2)         NOT NULL DEFAULT 0,
  discount_amount       numeric(14,2)         NOT NULL DEFAULT 0,
  gst_amount            numeric(14,2)         NOT NULL DEFAULT 0,
  convenience_fee       numeric(14,2)         NOT NULL DEFAULT 0,
  total_amount          numeric(14,2)         NOT NULL DEFAULT 0,
  currency              text                  NOT NULL DEFAULT 'INR',
  status                payment_order_status  NOT NULL DEFAULT 'initiated',
  payment_method        text,
  paid_at               timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz           NOT NULL DEFAULT now(),
  updated_at            timestamptz           NOT NULL DEFAULT now(),

  CONSTRAINT event_payment_orders_ref_unique UNIQUE (event_id, order_ref)
);

CREATE INDEX IF NOT EXISTS idx_event_payment_orders_event
  ON event_payment_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_payment_orders_guest
  ON event_payment_orders(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_payment_orders_status
  ON event_payment_orders(event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_payment_orders_provider
  ON event_payment_orders(provider_order_id) WHERE provider_order_id IS NOT NULL;

-- ── event_payment_refunds ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_payment_refunds (
  id                  uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid                  NOT NULL REFERENCES event_payment_orders(id) ON DELETE CASCADE,
  tenant_id           uuid                  NOT NULL,
  refund_ref          text                  NOT NULL,
  provider_refund_id  text,
  amount              numeric(14,2)         NOT NULL,
  reason              text,
  status              payment_refund_status NOT NULL DEFAULT 'pending',
  initiated_by        uuid                  REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at        timestamptz,
  created_at          timestamptz           NOT NULL DEFAULT now(),
  updated_at          timestamptz           NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_payment_refunds_order
  ON event_payment_refunds(order_id);

-- ── event_discount_codes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_discount_codes (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id         uuid          NOT NULL,
  code              text          NOT NULL,
  discount_type     discount_type NOT NULL DEFAULT 'percentage',
  discount_value    numeric(10,2) NOT NULL,
  max_discount_cap  numeric(10,2),           -- max value when type = percentage
  min_order_value   numeric(10,2),
  usage_limit       int,                     -- NULL = unlimited
  usage_count       int           NOT NULL DEFAULT 0,
  valid_from        timestamptz,
  valid_until       timestamptz,
  is_active         boolean       NOT NULL DEFAULT true,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT event_discount_codes_code_unique UNIQUE (event_id, code)
);

CREATE INDEX IF NOT EXISTS idx_event_discount_codes_event
  ON event_discount_codes(event_id);

-- ── Late FK: link orders → discount codes ─────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE event_payment_orders
    ADD CONSTRAINT fk_orders_discount_code
      FOREIGN KEY (discount_code_id) REFERENCES event_discount_codes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Helper: atomic discount usage increment ───────────────────────────────────
CREATE OR REPLACE FUNCTION increment_discount_usage(code_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE event_discount_codes
  SET    usage_count = usage_count + 1,
         updated_at  = now()
  WHERE  id = code_id;
$$;

-- ── updated_at triggers ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_payments()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenant_payment_gateways',
    'event_payment_settings',
    'event_ticket_types',
    'event_payment_orders',
    'event_payment_refunds',
    'event_discount_codes'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
       CREATE TRIGGER trg_%1$s_updated_at
         BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION set_updated_at_payments();',
      t
    );
  END LOOP;
END $$;

-- ── RLS ────────────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenant_payment_gateways',
    'event_payment_settings',
    'event_ticket_types',
    'event_payment_orders',
    'event_payment_refunds',
    'event_discount_codes'
  ] LOOP
    EXECUTE format('ALTER TABLE %1$s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_tenant" ON %1$s FOR ALL
        USING      (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()))
        WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));
      CREATE POLICY "%1$s_service" ON %1$s FOR ALL US
-- ============================================================
-- Migration: 079_exports.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 079: Export Jobs
--
-- Async export job queue for PDF, XLSX, CSV, and ZIP report
-- generation.  The NestJS ExportsService enqueues a job,
-- processes it asynchronously, uploads the result to R2, and
-- writes the public URL back to this table.
--
-- Referenced by: exports.service.ts
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE export_job_status AS ENUM ('queued','processing','completed','failed');
  CREATE TYPE export_format_type AS ENUM ('pdf','xlsx','csv','zip');
  CREATE TYPE export_type_enum AS ENUM (
    'guest_list','seating_chart','runsheet','badges','attendance',
    'budget_report','vendor_report','fnb_report','payment_report',
    'full_event_zip','custom_report'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── export_jobs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS export_jobs (
  id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid               NOT NULL,
  event_id         uuid               REFERENCES events(id) ON DELETE CASCADE,
  export_type      export_type_enum   NOT NULL,
  format           export_format_type NOT NULL DEFAULT 'pdf',
  status           export_job_status  NOT NULL DEFAULT 'queued',
  options          jsonb              NOT NULL DEFAULT '{}'::jsonb,
  file_url         text,
  file_size_bytes  bigint,
  error_message    text,
  requested_by     uuid               REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz        NOT NULL DEFAULT now(),
  completed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_tenant
  ON export_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_event
  ON export_jobs(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_export_jobs_status
  ON export_jobs(status) WHERE status IN ('queued', 'processing');

-- ── tenant_brand_settings ──────────────────────────────────────────────────────
-- Stores per-tenant report branding: colors, logo, footer text.
-- Used by ExportsService.getBrand() to apply custom branding to all exports.
CREATE TABLE IF NOT EXISTS tenant_brand_settings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  company_name        text,
  primary_color       text        NOT NULL DEFAULT '#6366F1',
  secondary_color     text        NOT NULL DEFAULT '#8B5CF6',
  logo_url            text,
  footer_text         text        NOT NULL DEFAULT 'Powered by OccasionPro',
  font_family         text        NOT NULL DEFAULT 'Inter',
  report_header_html  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_brand_settings_tenant_unique UNIQUE (tenant_id)
);

-- ── updated_at trigger ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_brand_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_brand_settings_updated_at ON tenant_brand_settings;
CREATE TRIGGER trg_tenant_brand_settings_updated_at
  BEFORE UPDATE ON tenant_brand_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_brand_settings();

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE export_jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_brand_settings  ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['export_jobs','tenant_brand_settings'] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_tenant" ON %1$s FOR ALL
        USING      (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()))
        WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()));
      CREATE POLICY "%1$s_service" ON %1$s FOR ALL USING (auth.role() = 'service_role');
    $f$, t);
  END LOOP;
END $$;

-- ============================================================
-- Migration: 080_custom_domains.sql
-- ============================================================
-- ============================================================
-- OccasionPro — Migration 080: Custom Domains
--
-- Per-tenant white-label custom domain system.
-- Integrates with Cloudflare Custom Hostnames API for SSL
-- provisioning and the CUSTOM_DOMAINS_KV Worker binding for
-- fast domain → tenant slug resolution at the edge.
--
-- Referenced by: custom-domains.service.ts
-- ============================================================

-- ── tenant_custom_domains ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_custom_domains (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL,
  domain                text        NOT NULL,
  subdomain_prefix      text,                   -- e.g. 'events' for events.client.com
  verification_token    text,                   -- TXT record value for DNS verification
  verification_method   text        NOT NULL DEFAULT 'txt_record',
  is_verified           boolean     NOT NULL DEFAULT false,
  verified_at           timestamptz,
  is_active             boolean     NOT NULL DEFAULT false,
  ssl_status            text        NOT NULL DEFAULT 'pending',
                                               -- 'pending'|'provisioning'|'active'|'failed'
  ssl_provisioned_at    timestamptz,
  cf_custom_hostname_id text,                  -- Cloudflare Custom Hostname resource ID
  check_failures        int         NOT NULL DEFAULT 0,
  last_checked_at       timestamptz,
  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_custom_domains_domain_unique UNIQUE (domain),
  CONSTRAINT tenant_custom_domains_tenant_unique UNIQUE (tenant_id)  -- one domain per tenant
);

CREATE INDEX IF NOT EXISTS idx_tenant_custom_domains_tenant
  ON tenant_custom_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_custom_domains_ssl_pending
  ON tenant_custom_domains(ssl_status, is_verified)
  WHERE ssl_status = 'provisioning' AND is_verified = true;
CREATE INDEX IF NOT EXISTS idx_tenant_custom_domains_unverified
  ON tenant_custom_domains(is_verified, check_failures, created_at)
  WHERE is_verified = false AND check_failures < 10;

-- ── updated_at trigger ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_custom_domains()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_custom_domains_updated_at ON tenant_custom_domains;
CREATE TRIGGER trg_tenant_custom_domains_updated_at
  BEFORE UPDATE ON tenant_custom_domains
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_custom_domains();

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE tenant_custom_domains ENABLE ROW LEVEL SECURITY;

-- Tenant owners can read their own domain record
CREATE POLICY "tenant_custom_domains_tenant_read"
  ON tenant_custom_domains FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

-- Tenant owners can insert/update their own record
CREATE POLICY "tenant_custom_domains_tenant_write"
  ON tenant_custom_domains FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

CREATE POLICY "tenant_custom_domains_tenant_update"
  ON tenant_custom_domains FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

CREATE POLICY "tenant_custom_domains_tenant_delete"
  ON tenant_custom_domains FOR DELETE
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
  );

-- Service role has full access (used by background verification cron)
CREATE POLICY "tenant_custom_domains_service"
  ON tenant_custom_domains FOR ALL
  USING (auth.role() = 'service_role');

