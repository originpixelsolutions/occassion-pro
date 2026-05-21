-- ============================================================
-- 027 — EVENT PLAYBOOKS & TEMPLATES SYSTEM
-- Reusable event playbooks with tasks, budgets, vendors,
-- runsheet items, and checklist items.
-- ============================================================

-- ── 1. Event Playbooks ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_playbooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  -- tenant_id NULL = global system playbook (read-only for tenants)

  name          TEXT NOT NULL,
  description   TEXT,
  event_type    TEXT NOT NULL, -- wedding, conference, festival, corporate, etc.
  category      TEXT,          -- luxury, budget, outdoor, virtual, hybrid
  tags          TEXT[] DEFAULT '{}',

  -- Metadata
  estimated_budget_min   BIGINT,   -- INR, rough range
  estimated_budget_max   BIGINT,
  typical_guest_count    INT,
  typical_duration_days  INT DEFAULT 1,

  -- Template stats
  task_count        INT DEFAULT 0,
  checklist_count   INT DEFAULT 0,
  vendor_count      INT DEFAULT 0,
  budget_item_count INT DEFAULT 0,
  runsheet_count    INT DEFAULT 0,

  -- Usage
  times_applied INT DEFAULT 0,
  last_applied_at TIMESTAMPTZ,

  -- Display
  cover_emoji   TEXT DEFAULT '📋',
  color         TEXT DEFAULT '#6366f1',  -- hex color for UI

  is_system     BOOLEAN DEFAULT false,  -- true = global/Anthropic template
  is_active     BOOLEAN DEFAULT true,

  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Playbook Tasks ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,          -- setup, logistics, vendor, guest, finance, etc.
  priority        TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  responsible_role TEXT,         -- event_manager, coordinator, logistics, finance, etc.

  -- Timing (relative to event date, negative = before, positive = after)
  days_before_event  INT,        -- NULL = day of event
  time_of_day        TIME,       -- optional: time on that day

  estimated_hours NUMERIC(5,2),
  requires_approval BOOLEAN DEFAULT false,
  tags            TEXT[] DEFAULT '{}',

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Playbook Budget Items ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_budget_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  category        TEXT NOT NULL,    -- venue, catering, decor, av, photography, etc.
  name            TEXT NOT NULL,
  description     TEXT,

  -- Can be a fixed amount or a % of total event budget
  amount_type     TEXT DEFAULT 'percentage' CHECK (amount_type IN ('fixed','percentage','per_guest','per_day')),
  amount          NUMERIC(12,2),    -- INR for fixed, 0-100 for percentage, per-person/day rate

  is_mandatory    BOOLEAN DEFAULT false,
  notes           TEXT,

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Playbook Vendor Categories ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_vendor_requirements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  vendor_type     TEXT NOT NULL,   -- caterer, decorator, photographer, av, security, etc.
  name            TEXT NOT NULL,   -- e.g. "Main Caterer", "Backup Generator"
  description     TEXT,

  is_mandatory    BOOLEAN DEFAULT true,
  quantity_needed INT DEFAULT 1,

  -- Budget guidance
  budget_percentage NUMERIC(5,2),  -- % of total budget to allocate
  notes             TEXT,

  -- Booking timing
  days_before_event INT,           -- when to book by (relative to event)

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Playbook Checklist Items ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_checklist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,           -- planning, legal, logistics, day-of, post-event
  is_mandatory    BOOLEAN DEFAULT true,
  days_before_event INT,

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Playbook Runsheet Items ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playbook_runsheet_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id     UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,

  -- Relative timing: hours before/after event start (negative = before)
  offset_hours    NUMERIC(6,2) DEFAULT 0,  -- -2.5 = 2.5 hours before event
  duration_minutes INT DEFAULT 30,

  responsible_role TEXT,
  location        TEXT,
  notes           TEXT,

  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. Applied Playbooks (audit trail) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_playbook_applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id  UUID NOT NULL REFERENCES event_playbooks(id) ON DELETE SET NULL,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  applied_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- What was applied
  tasks_created      INT DEFAULT 0,
  budget_items_created INT DEFAULT 0,
  vendors_created    INT DEFAULT 0,
  checklist_created  INT DEFAULT 0,
  runsheet_created   INT DEFAULT 0,

  applied_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_playbooks_tenant      ON event_playbooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_event_type  ON event_playbooks(event_type);
CREATE INDEX IF NOT EXISTS idx_playbooks_is_system   ON event_playbooks(is_system) WHERE is_system = true;

CREATE INDEX IF NOT EXISTS idx_playbook_tasks_pb     ON playbook_tasks(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_budget_pb    ON playbook_budget_items(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_vendor_pb    ON playbook_vendor_requirements(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_check_pb     ON playbook_checklist_items(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_run_pb       ON playbook_runsheet_items(playbook_id);
CREATE INDEX IF NOT EXISTS idx_pb_applications_event ON event_playbook_applications(event_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE event_playbooks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_budget_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_vendor_requirements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_checklist_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_runsheet_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_playbook_applications    ENABLE ROW LEVEL SECURITY;

-- Playbooks: tenant sees their own + system playbooks
CREATE POLICY "playbooks_tenant_or_system" ON event_playbooks FOR ALL
  USING (
    is_system = true
    OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- Child tables: access via playbook ownership
CREATE POLICY "pb_tasks_access"   ON playbook_tasks FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_budget_access"  ON playbook_budget_items FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_vendor_access"  ON playbook_vendor_requirements FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_check_access"   ON playbook_checklist_items FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_run_access"     ON playbook_runsheet_items FOR ALL
  USING (playbook_id IN (
    SELECT id FROM event_playbooks
    WHERE is_system = true
       OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "pb_applications_tenant" ON event_playbook_applications FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_playbook_counts()
RETURNS TRIGGER AS $$
DECLARE v_pb_id UUID;
BEGIN
  v_pb_id := COALESCE(NEW.playbook_id, OLD.playbook_id);

  UPDATE event_playbooks SET
    task_count        = (SELECT COUNT(*) FROM playbook_tasks           WHERE playbook_id = v_pb_id),
    budget_item_count = (SELECT COUNT(*) FROM playbook_budget_items    WHERE playbook_id = v_pb_id),
    vendor_count      = (SELECT COUNT(*) FROM playbook_vendor_requirements WHERE playbook_id = v_pb_id),
    checklist_count   = (SELECT COUNT(*) FROM playbook_checklist_items WHERE playbook_id = v_pb_id),
    runsheet_count    = (SELECT COUNT(*) FROM playbook_runsheet_items  WHERE playbook_id = v_pb_id),
    updated_at = NOW()
  WHERE id = v_pb_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_pb_counts_tasks ON playbook_tasks;
CREATE TRIGGER trg_update_pb_counts_tasks
  AFTER INSERT OR DELETE ON playbook_tasks
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

DROP TRIGGER IF EXISTS trg_update_pb_counts_budget ON playbook_budget_items;
CREATE TRIGGER trg_update_pb_counts_budget
  AFTER INSERT OR DELETE ON playbook_budget_items
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

DROP TRIGGER IF EXISTS trg_update_pb_counts_vendor ON playbook_vendor_requirements;
CREATE TRIGGER trg_update_pb_counts_vendor
  AFTER INSERT OR DELETE ON playbook_vendor_requirements
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

DROP TRIGGER IF EXISTS trg_update_pb_counts_checklist ON playbook_checklist_items;
CREATE TRIGGER trg_update_pb_counts_checklist
  AFTER INSERT OR DELETE ON playbook_checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

DROP TRIGGER IF EXISTS trg_update_pb_counts_runsheet ON playbook_runsheet_items;
CREATE TRIGGER trg_update_pb_counts_runsheet
  AFTER INSERT OR DELETE ON playbook_runsheet_items
  FOR EACH ROW EXECUTE FUNCTION update_playbook_counts();

-- ── Seed: System Playbooks ───────────────────────────────────────────────────

INSERT INTO event_playbooks
  (name, description, event_type, category, tags, estimated_budget_min, estimated_budget_max,
   typical_guest_count, typical_duration_days, cover_emoji, color, is_system, is_active)
VALUES
  -- 1. Luxury Wedding
  ('Luxury Wedding', 'Full-service luxury wedding with complete vendor suite, 5-star hospitality, and immersive décor.',
   'wedding', 'luxury',
   ARRAY['wedding','luxury','premium','multicultural'],
   2000000, 15000000, 400, 2, '💍', '#ec4899', true, true),

  -- 2. Destination Wedding
  ('Destination Wedding', 'Outstation wedding with accommodation, travel logistics, and multi-day programming.',
   'wedding', 'destination',
   ARRAY['wedding','destination','travel','resort'],
   3000000, 20000000, 150, 4, '🌴', '#f97316', true, true),

  -- 3. Corporate Conference
  ('Corporate Conference', 'Multi-track professional conference with keynotes, breakout sessions, and networking.',
   'conference', 'corporate',
   ARRAY['conference','b2b','networking','tech'],
   500000, 5000000, 500, 2, '🎤', '#6366f1', true, true),

  -- 4. Product Launch
  ('Product Launch Event', 'High-impact product reveal with media, influencers, demo zones, and press kit.',
   'launch', 'corporate',
   ARRAY['launch','press','brand','experiential'],
   1000000, 8000000, 300, 1, '🚀', '#8b5cf6', true, true),

  -- 5. Music Festival
  ('Music Festival', 'Large-scale outdoor music festival with multiple stages, artist management, and crowd ops.',
   'festival', 'entertainment',
   ARRAY['festival','music','outdoor','large-scale'],
   5000000, 50000000, 5000, 3, '🎵', '#14b8a6', true, true),

  -- 6. Corporate Annual Day
  ('Corporate Annual Day / Gala', 'Awards ceremony, dinner, and entertainment for corporate teams and leadership.',
   'corporate', 'gala',
   ARRAY['corporate','awards','gala','formal'],
   800000, 4000000, 300, 1, '🏆', '#f59e0b', true, true),

  -- 7. Birthday Celebration
  ('Milestone Birthday Celebration', 'Premium birthday event — 50th, 60th, etc — with theme, catering, and entertainment.',
   'birthday', 'private',
   ARRAY['birthday','private','milestone','themed'],
   200000, 2000000, 100, 1, '🎂', '#ec4899', true, true),

  -- 8. Trade Exhibition
  ('Trade Exhibition / Expo', 'Multi-booth exhibition hall with exhibitor management, public access, and B2B matchmaking.',
   'exhibition', 'b2b',
   ARRAY['expo','trade','exhibition','b2b'],
   2000000, 20000000, 2000, 3, '🏛️', '#0ea5e9', true, true),

  -- 9. Virtual Conference
  ('Virtual Conference / Webinar Series', 'Fully online conference with live streaming, virtual networking, and on-demand recordings.',
   'virtual', 'digital',
   ARRAY['virtual','online','webinar','streaming'],
   100000, 1000000, 1000, 1, '💻', '#10b981', true, true),

  -- 10. Sports Tournament
  ('Sports Tournament', 'Multi-day sports competition with teams, officials, spectators, and media coverage.',
   'sports', 'competitive',
   ARRAY['sports','tournament','competition','outdoor'],
   500000, 10000000, 1000, 3, '🏆', '#ef4444', true, true)
ON CONFLICT DO NOTHING;

-- ── Seed: Tasks for Luxury Wedding ──────────────────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Luxury Wedding' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_tasks (playbook_id, title, category, priority, responsible_role, days_before_event, sort_order) VALUES
      (v_pb_id, 'Confirm venue contract and F&B minimums',           'venue',      'critical', 'event_manager',  90, 10),
      (v_pb_id, 'Finalise guest list and dietary requirements',       'guest',      'high',     'coordinator',    60, 20),
      (v_pb_id, 'Book photographer and videographer',                 'vendor',     'critical', 'event_manager',  90, 30),
      (v_pb_id, 'Confirm caterer menu and tasting session',           'catering',   'critical', 'event_manager',  60, 40),
      (v_pb_id, 'Book floral & décor vendor — sign contract',         'decor',      'high',     'coordinator',    60, 50),
      (v_pb_id, 'Book entertainment (DJ/band/performers)',            'vendor',     'high',     'coordinator',    45, 60),
      (v_pb_id, 'Send invitations (physical + digital)',              'guest',      'high',     'coordinator',    45, 70),
      (v_pb_id, 'Confirm AV / lighting / sound vendor',              'av',         'high',     'coordinator',    45, 80),
      (v_pb_id, 'Book makeup artists and hair stylists',             'vendor',     'medium',   'coordinator',    30, 90),
      (v_pb_id, 'Create final seating chart',                        'logistics',  'high',     'coordinator',    14, 100),
      (v_pb_id, 'Confirm final guest count with caterer',            'catering',   'critical', 'event_manager',  7,  110),
      (v_pb_id, 'Venue walkthrough and logistics briefing',          'logistics',  'high',     'event_manager',  3,  120),
      (v_pb_id, 'Brief all staff and vendors — final schedule share','staff',      'critical', 'event_manager',  1,  130),
      (v_pb_id, 'Set up décor and test AV — day before',             'setup',      'critical', 'logistics',      1,  140),
      (v_pb_id, 'Welcome guests and manage arrivals',                'guest',      'critical', 'coordinator',    0,  150),
      (v_pb_id, 'Coordinate ceremony runsheet in real time',         'operations', 'critical', 'event_manager',  0,  160),
      (v_pb_id, 'Post-event wrap — décor teardown and payments',     'logistics',  'high',     'coordinator',    NULL, 170),
      (v_pb_id, 'Send thank-you cards / emails to guests',           'guest',      'medium',   'coordinator',    NULL, 180);
  END IF;
END $$;

-- ── Seed: Tasks for Corporate Conference ────────────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Corporate Conference' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_tasks (playbook_id, title, category, priority, responsible_role, days_before_event, sort_order) VALUES
      (v_pb_id, 'Finalise conference theme and agenda structure',     'planning',   'critical', 'event_manager',  90, 10),
      (v_pb_id, 'Confirm venue — hall layout and breakout rooms',     'venue',      'critical', 'event_manager',  90, 20),
      (v_pb_id, 'Identify and confirm keynote speakers',              'speaker',    'critical', 'coordinator',    75, 30),
      (v_pb_id, 'Launch registration portal and early bird pricing',  'marketing',  'high',     'marketing',      75, 40),
      (v_pb_id, 'Finalise AV and streaming setup',                   'av',         'critical', 'logistics',      60, 50),
      (v_pb_id, 'Confirm sponsors and collect brand assets',          'finance',    'high',     'event_manager',  60, 60),
      (v_pb_id, 'Arrange catering — breaks, lunches, gala dinner',   'catering',   'high',     'coordinator',    45, 70),
      (v_pb_id, 'Print badges, brochures, and signage',              'logistics',  'medium',   'coordinator',    14, 80),
      (v_pb_id, 'Brief volunteers and registration desk staff',       'staff',      'high',     'event_manager',  3,  90),
      (v_pb_id, 'Test AV, internet, and app systems',                'av',         'critical', 'logistics',      1,  100),
      (v_pb_id, 'Open registration and manage check-in',             'guest',      'critical', 'coordinator',    0,  110),
      (v_pb_id, 'MC briefing and real-time session management',       'operations', 'critical', 'event_manager',  0,  120),
      (v_pb_id, 'Collect speaker recordings for post-conference',    'media',      'medium',   'coordinator',    NULL, 130),
      (v_pb_id, 'Send post-event survey to all attendees',           'feedback',   'medium',   'marketing',      NULL, 140);
  END IF;
END $$;

-- ── Seed: Budget Items for Luxury Wedding ────────────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Luxury Wedding' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_budget_items (playbook_id, category, name, amount_type, amount, is_mandatory, sort_order) VALUES
      (v_pb_id, 'venue',       'Venue Rental',              'percentage', 20, true,  10),
      (v_pb_id, 'catering',    'Food & Beverage',           'percentage', 30, true,  20),
      (v_pb_id, 'decor',       'Floral & Décor',            'percentage', 15, true,  30),
      (v_pb_id, 'photography', 'Photography & Videography', 'percentage', 8,  true,  40),
      (v_pb_id, 'av',          'AV, Lighting & Sound',      'percentage', 7,  true,  50),
      (v_pb_id, 'entertainment','Entertainment & Music',     'percentage', 6,  false, 60),
      (v_pb_id, 'hospitality', 'Guest Hospitality & Gifts', 'percentage', 4,  false, 70),
      (v_pb_id, 'staffing',    'Event Staff & Coordinators','percentage', 4,  true,  80),
      (v_pb_id, 'transport',   'Guest Transportation',      'percentage', 3,  false, 90),
      (v_pb_id, 'contingency', 'Contingency Reserve',       'percentage', 3,  true,  100);
  END IF;
END $$;

-- ── Seed: Vendor Requirements for Luxury Wedding ─────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Luxury Wedding' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_vendor_requirements (playbook_id, vendor_type, name, is_mandatory, quantity_needed, budget_percentage, days_before_event, sort_order) VALUES
      (v_pb_id, 'caterer',       'Main Caterer',           true,  1, 30, 90,  10),
      (v_pb_id, 'decorator',     'Floral & Décor Vendor',  true,  1, 15, 90,  20),
      (v_pb_id, 'photographer',  'Wedding Photographer',   true,  1, 5,  90,  30),
      (v_pb_id, 'videographer',  'Wedding Videographer',   true,  1, 3,  90,  40),
      (v_pb_id, 'av',            'AV & Sound System',      true,  1, 7,  60,  50),
      (v_pb_id, 'lighting',      'Lighting Vendor',        true,  1, 4,  60,  60),
      (v_pb_id, 'entertainment', 'Live Band or DJ',         false, 1, 6,  45,  70),
      (v_pb_id, 'makeup',        'Bridal Makeup Artist',   true,  1, 2,  30,  80),
      (v_pb_id, 'security',      'Security Team',          true,  1, 2,  14,  90),
      (v_pb_id, 'transport',     'Guest Shuttle Service',  false, 1, 3,  30,  100);
  END IF;
END $$;

-- ── Seed: Checklist for Luxury Wedding ──────────────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Luxury Wedding' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_checklist_items (playbook_id, title, category, is_mandatory, days_before_event, sort_order) VALUES
      (v_pb_id, 'Venue contract signed and deposit paid',           'legal',      true,  90, 10),
      (v_pb_id, 'All vendor contracts signed',                      'legal',      true,  60, 20),
      (v_pb_id, 'Food license / FSSAI permit obtained',             'legal',      true,  45, 30),
      (v_pb_id, 'Liquor permit obtained (if applicable)',           'legal',      false, 45, 40),
      (v_pb_id, 'Noise permit obtained from local authority',       'legal',      false, 30, 50),
      (v_pb_id, 'Fire safety NOC from venue',                      'safety',     true,  30, 60),
      (v_pb_id, 'Insurance policy activated for event',            'finance',    true,  30, 70),
      (v_pb_id, 'Final headcount confirmed with caterer',          'operations', true,  7,  80),
      (v_pb_id, 'Emergency contact list distributed to all staff', 'safety',     true,  3,  90),
      (v_pb_id, 'Venue walkthrough completed',                     'operations', true,  3,  100),
      (v_pb_id, 'All vendor final payments processed',             'finance',    true,  NULL, 110),
      (v_pb_id, 'Post-event feedback collected from couple',       'quality',    false, NULL, 120);
  END IF;
END $$;

-- ── Seed: Runsheet items for Corporate Conference ────────────────────────────

DO $$
DECLARE v_pb_id UUID;
BEGIN
  SELECT id INTO v_pb_id FROM event_playbooks WHERE name = 'Corporate Conference' AND is_system = true LIMIT 1;

  IF v_pb_id IS NOT NULL THEN
    INSERT INTO playbook_runsheet_items (playbook_id, title, category, offset_hours, duration_minutes, responsible_role, sort_order) VALUES
      (v_pb_id, 'AV and tech setup & test',          'setup',      -4,    120, 'logistics',      10),
      (v_pb_id, 'Registration desk opens',           'guest',      -1,    60,  'coordinator',    20),
      (v_pb_id, 'Networking breakfast / tea',        'catering',   -0.5,  30,  'catering',       30),
      (v_pb_id, 'Welcome address by host',           'program',    0,     15,  'event_manager',  40),
      (v_pb_id, 'Keynote 1',                        'program',    0.25,  60,  'speaker',        50),
      (v_pb_id, 'Q&A — Keynote 1',                  'program',    1.25,  15,  'event_manager',  60),
      (v_pb_id, 'Coffee break / networking',         'catering',   1.5,   20,  'catering',       70),
      (v_pb_id, 'Panel Discussion',                  'program',    1.83,  60,  'event_manager',  80),
      (v_pb_id, 'Lunch break',                      'catering',   3,     60,  'catering',       90),
      (v_pb_id, 'Breakout sessions (parallel)',      'program',    4,     90,  'coordinator',    100),
      (v_pb_id, 'Afternoon tea / networking',        'catering',   5.5,   20,  'catering',       110),
      (v_pb_id, 'Keynote 2 / Closing session',       'program',    5.83,  45,  'speaker',        120),
      (v_pb_id, 'Awards / Recognition ceremony',     'program',    6.5,   30,  'event_manager',  130),
      (v_pb_id, 'Cocktails & networking close',      'networking', 7,     90,  'coordinator',    140),
      (v_pb_id, 'Vendor teardown and venue check-out','teardown',  8.5,   60,  'logistics',      150);
  END IF;
END $$;
