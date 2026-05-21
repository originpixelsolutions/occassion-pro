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
