-- ============================================================
-- Migration 055: Event Types + Smart Readiness Engine
-- ============================================================
-- • event_types table (system built-ins + tenant custom)
-- • event_type_readiness_checklist table
-- • Seed: 15 built-in event types + checklist items
-- • ALTER events: add event_type_id, currency_code, timezone,
--   deleted_at, purge_after, auto_approve_guests
-- • smart_readiness_score(p_event_id) DB function
-- • RLS policies
-- ============================================================

-- ── event_types ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_types (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES public.tenants(id) ON DELETE CASCADE,  -- NULL = system/global
  name         VARCHAR(100) NOT NULL,
  slug         VARCHAR(100) NOT NULL,
  icon         VARCHAR(50)  NOT NULL DEFAULT '📅',   -- emoji or icon name
  description  TEXT,
  color        VARCHAR(20)  DEFAULT '#6366f1',
  is_system    BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)  -- per-tenant slugs; system types have tenant_id=NULL
);

CREATE INDEX IF NOT EXISTS idx_event_types_tenant ON public.event_types (tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_types_system ON public.event_types (is_system) WHERE is_system = TRUE;

-- ── event_type_readiness_checklist ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_type_readiness_checklist (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id  UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  module         VARCHAR(60) NOT NULL,  -- e.g. 'venue', 'guests', 'finance', 'media'
  check_key      VARCHAR(100) NOT NULL, -- machine key for DB evaluation
  check_label    VARCHAR(200) NOT NULL, -- human-readable
  is_required    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INT     NOT NULL DEFAULT 0,
  UNIQUE (event_type_id, check_key)
);

CREATE INDEX IF NOT EXISTS idx_readiness_event_type ON public.event_type_readiness_checklist (event_type_id);

-- ── ALTER events: new columns ─────────────────────────────────────────────────

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type_id     UUID REFERENCES public.event_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency_code     VARCHAR(3)   NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS timezone          VARCHAR(50)  NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purge_after       TIMESTAMPTZ GENERATED ALWAYS AS (deleted_at + INTERVAL '30 days') STORED,
  ADD COLUMN IF NOT EXISTS auto_approve_guests BOOLEAN    NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_events_type   ON public.events (event_type_id);
CREATE INDEX IF NOT EXISTS idx_events_deleted ON public.events (deleted_at) WHERE deleted_at IS NOT NULL;

-- ── SEED: system event types ──────────────────────────────────────────────────

INSERT INTO public.event_types (id, tenant_id, name, slug, icon, description, color, is_system, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000001', NULL, 'Wedding',            'wedding',            '💍', 'Full-day wedding ceremony and reception', '#ec4899', TRUE, 1),
  ('10000000-0000-0000-0000-000000000002', NULL, 'Corporate',          'corporate',          '🏢', 'Corporate events, meetings, team offsites', '#6366f1', TRUE, 2),
  ('10000000-0000-0000-0000-000000000003', NULL, 'Birthday',           'birthday',           '🎂', 'Birthday parties and milestone celebrations', '#f59e0b', TRUE, 3),
  ('10000000-0000-0000-0000-000000000004', NULL, 'Conference',         'conference',         '🎤', 'Multi-speaker conferences and summits', '#0ea5e9', TRUE, 4),
  ('10000000-0000-0000-0000-000000000005', NULL, 'Concert',            'concert',            '🎵', 'Live music concerts and performances', '#a855f7', TRUE, 5),
  ('10000000-0000-0000-0000-000000000006', NULL, 'Exhibition',         'exhibition',         '🖼️', 'Art exhibitions and trade displays', '#14b8a6', TRUE, 6),
  ('10000000-0000-0000-0000-000000000007', NULL, 'Product Launch',     'product-launch',     '🚀', 'Brand and product launch events', '#f97316', TRUE, 7),
  ('10000000-0000-0000-0000-000000000008', NULL, 'Award Ceremony',     'award-ceremony',     '🏆', 'Award nights and recognition events', '#eab308', TRUE, 8),
  ('10000000-0000-0000-0000-000000000009', NULL, 'Funeral',            'funeral',            '🕯️', 'Funeral services and memorial gatherings', '#64748b', TRUE, 9),
  ('10000000-0000-0000-0000-000000000010', NULL, 'Engagement',         'engagement',         '💑', 'Engagement ceremonies and parties', '#f43f5e', TRUE, 10),
  ('10000000-0000-0000-0000-000000000011', NULL, 'Baby Shower',        'baby-shower',        '👶', 'Baby showers and gender reveals', '#06b6d4', TRUE, 11),
  ('10000000-0000-0000-0000-000000000012', NULL, 'Religious Ceremony', 'religious-ceremony', '🕌', 'Religious ceremonies and spiritual events', '#84cc16', TRUE, 12),
  ('10000000-0000-0000-0000-000000000013', NULL, 'Sports Event',       'sports-event',       '🏅', 'Sports tournaments, races, and athletic events', '#22c55e', TRUE, 13),
  ('10000000-0000-0000-0000-000000000014', NULL, 'Social Gathering',   'social-gathering',   '🎉', 'Casual social gatherings and get-togethers', '#fb923c', TRUE, 14),
  ('10000000-0000-0000-0000-000000000015', NULL, 'Gala / Fundraiser',  'gala-fundraiser',    '🥂', 'Gala dinners, fundraisers, and charity events', '#c084fc', TRUE, 15)
ON CONFLICT DO NOTHING;

-- ── SEED: readiness checklist per event type ──────────────────────────────────
-- check_key values map to DB checks in smart_readiness_score() function

-- WEDDING (type 1)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000001', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000001', 'core',         'has_cover_image',       'Cover image uploaded',                       FALSE, 2),
  ('10000000-0000-0000-0000-000000000001', 'venue',        'has_venue',             'Venue is booked',                            TRUE,  3),
  ('10000000-0000-0000-0000-000000000001', 'guests',       'min_guests_added',      'At least 10 guests added',                   TRUE,  4),
  ('10000000-0000-0000-0000-000000000001', 'guests',       'invitations_sent',      'Invitations sent to guests',                 TRUE,  5),
  ('10000000-0000-0000-0000-000000000001', 'finance',      'has_budget',            'Budget defined',                             TRUE,  6),
  ('10000000-0000-0000-0000-000000000001', 'vendors',      'has_vendor',            'At least one vendor assigned',               TRUE,  7),
  ('10000000-0000-0000-0000-000000000001', 'hospitality',  'has_accommodation',     'Accommodation details added',                FALSE, 8),
  ('10000000-0000-0000-0000-000000000001', 'fnb',          'has_fnb_menu',          'F&B menu configured',                        TRUE,  9),
  ('10000000-0000-0000-0000-000000000001', 'decor',        'has_decor_plan',        'Décor plan created',                         FALSE, 10)
ON CONFLICT DO NOTHING;

-- CORPORATE (type 2)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000002', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000002', 'core',         'has_cover_image',       'Cover image uploaded',                       FALSE, 2),
  ('10000000-0000-0000-0000-000000000002', 'venue',        'has_venue',             'Venue is booked',                            TRUE,  3),
  ('10000000-0000-0000-0000-000000000002', 'guests',       'min_guests_added',      'At least 5 guests/attendees added',          TRUE,  4),
  ('10000000-0000-0000-0000-000000000002', 'team',         'has_team_member',       'Team member assigned to event',              TRUE,  5),
  ('10000000-0000-0000-0000-000000000002', 'finance',      'has_budget',            'Budget defined',                             TRUE,  6),
  ('10000000-0000-0000-0000-000000000002', 'vendors',      'has_vendor',            'At least one vendor assigned',               FALSE, 7),
  ('10000000-0000-0000-0000-000000000002', 'production',   'has_runsheet',          'Run sheet / agenda created',                 TRUE,  8),
  ('10000000-0000-0000-0000-000000000002', 'fnb',          'has_fnb_menu',          'F&B requirements noted',                     FALSE, 9),
  ('10000000-0000-0000-0000-000000000002', 'documents',    'has_document',          'At least one event document attached',       FALSE, 10)
ON CONFLICT DO NOTHING;

-- BIRTHDAY (type 3)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000003', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000003', 'core',         'has_cover_image',       'Cover image uploaded',                       FALSE, 2),
  ('10000000-0000-0000-0000-000000000003', 'venue',        'has_venue',             'Venue confirmed',                            TRUE,  3),
  ('10000000-0000-0000-0000-000000000003', 'guests',       'min_guests_added',      'At least 5 guests added',                    TRUE,  4),
  ('10000000-0000-0000-0000-000000000003', 'guests',       'invitations_sent',      'Invitations sent',                           FALSE, 5),
  ('10000000-0000-0000-0000-000000000003', 'finance',      'has_budget',            'Budget defined',                             FALSE, 6),
  ('10000000-0000-0000-0000-000000000003', 'vendors',      'has_vendor',            'Vendor booked (catering/decor)',              FALSE, 7),
  ('10000000-0000-0000-0000-000000000003', 'fnb',          'has_fnb_menu',          'F&B / cake details added',                   TRUE,  8)
ON CONFLICT DO NOTHING;

-- CONFERENCE (type 4)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000004', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000004', 'core',         'has_cover_image',       'Conference banner uploaded',                 FALSE, 2),
  ('10000000-0000-0000-0000-000000000004', 'venue',        'has_venue',             'Venue / hall booked',                        TRUE,  3),
  ('10000000-0000-0000-0000-000000000004', 'guests',       'min_guests_added',      'At least 10 delegates registered',           TRUE,  4),
  ('10000000-0000-0000-0000-000000000004', 'artists',      'has_artist',            'Speakers / artists confirmed',               TRUE,  5),
  ('10000000-0000-0000-0000-000000000004', 'production',   'has_runsheet',          'Session schedule / run sheet created',       TRUE,  6),
  ('10000000-0000-0000-0000-000000000004', 'finance',      'has_budget',            'Budget defined',                             TRUE,  7),
  ('10000000-0000-0000-0000-000000000004', 'team',         'has_team_member',       'Team assigned',                              TRUE,  8),
  ('10000000-0000-0000-0000-000000000004', 'vendors',      'has_vendor',            'AV / tech vendor confirmed',                 TRUE,  9),
  ('10000000-0000-0000-0000-000000000004', 'documents',    'has_document',          'Conference agenda document attached',        FALSE, 10)
ON CONFLICT DO NOTHING;

-- CONCERT (type 5)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000005', 'core',         'has_event_date',        'Event date is set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000005', 'venue',        'has_venue',             'Venue / stage confirmed',                    TRUE,  2),
  ('10000000-0000-0000-0000-000000000005', 'artists',      'has_artist',            'Artist / performer confirmed',               TRUE,  3),
  ('10000000-0000-0000-0000-000000000005', 'vendors',      'has_vendor',            'Sound & lighting vendor confirmed',          TRUE,  4),
  ('10000000-0000-0000-0000-000000000005', 'production',   'has_runsheet',          'Show run sheet created',                     TRUE,  5),
  ('10000000-0000-0000-0000-000000000005', 'finance',      'has_budget',            'Budget defined',                             TRUE,  6),
  ('10000000-0000-0000-0000-000000000005', 'team',         'has_team_member',       'Production crew assigned',                   TRUE,  7),
  ('10000000-0000-0000-0000-000000000005', 'permits',      'has_permit',            'Event permits / NOC obtained',               TRUE,  8),
  ('10000000-0000-0000-0000-000000000005', 'guests',       'min_guests_added',      'Ticket holders / guests listed',             FALSE, 9)
ON CONFLICT DO NOTHING;

-- EXHIBITION (type 6)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000006', 'core',         'has_event_date',        'Event dates set',                            TRUE,  1),
  ('10000000-0000-0000-0000-000000000006', 'venue',        'has_venue',             'Exhibition hall booked',                     TRUE,  2),
  ('10000000-0000-0000-0000-000000000006', 'vendors',      'has_vendor',            'At least one exhibitor / vendor',            TRUE,  3),
  ('10000000-0000-0000-0000-000000000006', 'finance',      'has_budget',            'Budget defined',                             TRUE,  4),
  ('10000000-0000-0000-0000-000000000006', 'team',         'has_team_member',       'Team assigned',                              TRUE,  5),
  ('10000000-0000-0000-0000-000000000006', 'decor',        'has_decor_plan',        'Stall / booth layout planned',               FALSE, 6),
  ('10000000-0000-0000-0000-000000000006', 'permits',      'has_permit',            'Exhibition permits obtained',                FALSE, 7),
  ('10000000-0000-0000-0000-000000000006', 'guests',       'min_guests_added',      'Expected visitor count estimated',           FALSE, 8)
ON CONFLICT DO NOTHING;

-- PRODUCT LAUNCH (type 7)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000007', 'core',         'has_event_date',        'Launch date confirmed',                      TRUE,  1),
  ('10000000-0000-0000-0000-000000000007', 'core',         'has_cover_image',       'Event banner / creative uploaded',           TRUE,  2),
  ('10000000-0000-0000-0000-000000000007', 'venue',        'has_venue',             'Launch venue confirmed',                     TRUE,  3),
  ('10000000-0000-0000-0000-000000000007', 'guests',       'min_guests_added',      'Press / invitees list added',                TRUE,  4),
  ('10000000-0000-0000-0000-000000000007', 'guests',       'invitations_sent',      'Press invitations sent',                     TRUE,  5),
  ('10000000-0000-0000-0000-000000000007', 'production',   'has_runsheet',          'Launch run sheet / script ready',            TRUE,  6),
  ('10000000-0000-0000-0000-000000000007', 'vendors',      'has_vendor',            'AV / media vendor confirmed',                TRUE,  7),
  ('10000000-0000-0000-0000-000000000007', 'finance',      'has_budget',            'Budget approved',                            TRUE,  8),
  ('10000000-0000-0000-0000-000000000007', 'documents',    'has_document',          'Press kit / brand document attached',        FALSE, 9)
ON CONFLICT DO NOTHING;

-- AWARD CEREMONY (type 8)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000008', 'core',         'has_event_date',        'Ceremony date set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000008', 'venue',        'has_venue',             'Award venue confirmed',                      TRUE,  2),
  ('10000000-0000-0000-0000-000000000008', 'guests',       'min_guests_added',      'Nominees / guests added',                    TRUE,  3),
  ('10000000-0000-0000-0000-000000000008', 'guests',       'invitations_sent',      'Invitations dispatched',                     TRUE,  4),
  ('10000000-0000-0000-0000-000000000008', 'production',   'has_runsheet',          'Show run order created',                     TRUE,  5),
  ('10000000-0000-0000-0000-000000000008', 'vendors',      'has_vendor',            'AV / trophy vendor confirmed',               TRUE,  6),
  ('10000000-0000-0000-0000-000000000008', 'finance',      'has_budget',            'Budget defined',                             TRUE,  7),
  ('10000000-0000-0000-0000-000000000008', 'fnb',          'has_fnb_menu',          'Dinner / F&B menu configured',               FALSE, 8),
  ('10000000-0000-0000-0000-000000000008', 'team',         'has_team_member',       'Team assigned',                              TRUE,  9)
ON CONFLICT DO NOTHING;

-- FUNERAL (type 9)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000009', 'core',         'has_event_date',        'Service date and time confirmed',            TRUE,  1),
  ('10000000-0000-0000-0000-000000000009', 'venue',        'has_venue',             'Venue / chapel confirmed',                   TRUE,  2),
  ('10000000-0000-0000-0000-000000000009', 'guests',       'min_guests_added',      'Attendees / family contacts added',          FALSE, 3),
  ('10000000-0000-0000-0000-000000000009', 'vendors',      'has_vendor',            'Funeral service vendor confirmed',           TRUE,  4),
  ('10000000-0000-0000-0000-000000000009', 'documents',    'has_document',          'Order of service document prepared',         TRUE,  5),
  ('10000000-0000-0000-0000-000000000009', 'finance',      'has_budget',            'Budget estimated',                           FALSE, 6),
  ('10000000-0000-0000-0000-000000000009', 'team',         'has_team_member',       'Coordinator assigned',                       TRUE,  7),
  ('10000000-0000-0000-0000-000000000009', 'hospitality',  'has_accommodation',     'Out-of-town family accommodation noted',     FALSE, 8)
ON CONFLICT DO NOTHING;

-- ENGAGEMENT (type 10)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000010', 'core',         'has_event_date',        'Engagement date set',                        TRUE,  1),
  ('10000000-0000-0000-0000-000000000010', 'venue',        'has_venue',             'Venue confirmed',                            TRUE,  2),
  ('10000000-0000-0000-0000-000000000010', 'guests',       'min_guests_added',      'Guest list added',                           TRUE,  3),
  ('10000000-0000-0000-0000-000000000010', 'guests',       'invitations_sent',      'Invitations sent',                           TRUE,  4),
  ('10000000-0000-0000-0000-000000000010', 'fnb',          'has_fnb_menu',          'Catering / menu confirmed',                  TRUE,  5),
  ('10000000-0000-0000-0000-000000000010', 'decor',        'has_decor_plan',        'Décor plan in place',                        FALSE, 6),
  ('10000000-0000-0000-0000-000000000010', 'finance',      'has_budget',            'Budget defined',                             FALSE, 7),
  ('10000000-0000-0000-0000-000000000010', 'vendors',      'has_vendor',            'Photographer / videographer booked',         FALSE, 8)
ON CONFLICT DO NOTHING;

-- BABY SHOWER (type 11)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000011', 'core',         'has_event_date',        'Event date set',                             TRUE,  1),
  ('10000000-0000-0000-0000-000000000011', 'venue',        'has_venue',             'Venue confirmed',                            TRUE,  2),
  ('10000000-0000-0000-0000-000000000011', 'guests',       'min_guests_added',      'Guest list added',                           TRUE,  3),
  ('10000000-0000-0000-0000-000000000011', 'guests',       'invitations_sent',      'Invitations sent',                           FALSE, 4),
  ('10000000-0000-0000-0000-000000000011', 'fnb',          'has_fnb_menu',          'Cake / refreshments planned',                TRUE,  5),
  ('10000000-0000-0000-0000-000000000011', 'decor',        'has_decor_plan',        'Theme / décor decided',                      FALSE, 6),
  ('10000000-0000-0000-0000-000000000011', 'finance',      'has_budget',            'Budget set',                                 FALSE, 7)
ON CONFLICT DO NOTHING;

-- RELIGIOUS CEREMONY (type 12)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000012', 'core',         'has_event_date',        'Ceremony date/time set',                     TRUE,  1),
  ('10000000-0000-0000-0000-000000000012', 'venue',        'has_venue',             'Venue / place of worship confirmed',         TRUE,  2),
  ('10000000-0000-0000-0000-000000000012', 'guests',       'min_guests_added',      'Congregation / guests added',                FALSE, 3),
  ('10000000-0000-0000-0000-000000000012', 'vendors',      'has_vendor',            'Priest / officiant confirmed',               TRUE,  4),
  ('10000000-0000-0000-0000-000000000012', 'fnb',          'has_fnb_menu',          'Prasad / food arrangements noted',           FALSE, 5),
  ('10000000-0000-0000-0000-000000000012', 'team',         'has_team_member',       'Coordinator assigned',                       FALSE, 6),
  ('10000000-0000-0000-0000-000000000012', 'permits',      'has_permit',            'Any required permissions obtained',          FALSE, 7),
  ('10000000-0000-0000-0000-000000000012', 'finance',      'has_budget',            'Budget estimated',                           FALSE, 8)
ON CONFLICT DO NOTHING;

-- SPORTS EVENT (type 13)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000013', 'core',         'has_event_date',        'Event date confirmed',                       TRUE,  1),
  ('10000000-0000-0000-0000-000000000013', 'venue',        'has_venue',             'Venue / stadium confirmed',                  TRUE,  2),
  ('10000000-0000-0000-0000-000000000013', 'guests',       'min_guests_added',      'Participants / teams registered',            TRUE,  3),
  ('10000000-0000-0000-0000-000000000013', 'team',         'has_team_member',       'Operations team assigned',                   TRUE,  4),
  ('10000000-0000-0000-0000-000000000013', 'vendors',      'has_vendor',            'Equipment / logistics vendor confirmed',     TRUE,  5),
  ('10000000-0000-0000-0000-000000000013', 'permits',      'has_permit',            'Sports event permit obtained',               TRUE,  6),
  ('10000000-0000-0000-0000-000000000013', 'finance',      'has_budget',            'Budget approved',                            TRUE,  7),
  ('10000000-0000-0000-0000-000000000013', 'production',   'has_runsheet',          'Event schedule / format documented',         FALSE, 8),
  ('10000000-0000-0000-0000-000000000013', 'health_safety','has_health_safety_plan','First aid / safety plan in place',           TRUE,  9)
ON CONFLICT DO NOTHING;

-- SOCIAL GATHERING (type 14)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000014', 'core',         'has_event_date',        'Date and time set',                          TRUE,  1),
  ('10000000-0000-0000-0000-000000000014', 'venue',        'has_venue',             'Venue / location confirmed',                 TRUE,  2),
  ('10000000-0000-0000-0000-000000000014', 'guests',       'min_guests_added',      'At least 5 guests added',                    FALSE, 3),
  ('10000000-0000-0000-0000-000000000014', 'fnb',          'has_fnb_menu',          'Food / drinks arranged',                     FALSE, 4),
  ('10000000-0000-0000-0000-000000000014', 'finance',      'has_budget',            'Budget noted',                               FALSE, 5)
ON CONFLICT DO NOTHING;

-- GALA / FUNDRAISER (type 15)
INSERT INTO public.event_type_readiness_checklist (event_type_id, module, check_key, check_label, is_required, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000015', 'core',         'has_event_date',        'Gala date confirmed',                        TRUE,  1),
  ('10000000-0000-0000-0000-000000000015', 'core',         'has_cover_image',       'Gala / charity banner uploaded',             FALSE, 2),
  ('10000000-0000-0000-0000-000000000015', 'venue',        'has_venue',             'Venue confirmed',                            TRUE,  3),
  ('10000000-0000-0000-0000-000000000015', 'guests',       'min_guests_added',      'Donor / guest list added',                   TRUE,  4),
  ('10000000-0000-0000-0000-000000000015', 'guests',       'invitations_sent',      'Invitations dispatched',                     TRUE,  5),
  ('10000000-0000-0000-0000-000000000015', 'fnb',          'has_fnb_menu',          'Gala dinner menu configured',                TRUE,  6),
  ('10000000-0000-0000-0000-000000000015', 'finance',      'has_budget',            'Fundraising target and budget set',          TRUE,  7),
  ('10000000-0000-0000-0000-000000000015', 'vendors',      'has_vendor',            'Décor / entertainment vendor confirmed',     TRUE,  8),
  ('10000000-0000-0000-0000-000000000015', 'production',   'has_runsheet',          'Programme / run order created',              TRUE,  9),
  ('10000000-0000-0000-0000-000000000015', 'team',         'has_team_member',       'Team assigned',                              TRUE,  10)
ON CONFLICT DO NOTHING;

-- ── smart_readiness_score() ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.smart_readiness_score(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event          RECORD;
  v_checklist      RECORD;
  v_items          JSONB := '[]'::JSONB;
  v_total          INT   := 0;
  v_completed      INT   := 0;
  v_is_completed   BOOLEAN;
  v_score_pct      NUMERIC;
BEGIN
  -- Load event
  SELECT e.*, et.name AS type_name, et.icon AS type_icon
  INTO v_event
  FROM public.events e
  LEFT JOIN public.event_types et ON et.id = e.event_type_id
  WHERE e.id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Event not found');
  END IF;

  IF v_event.event_type_id IS NULL THEN
    RETURN jsonb_build_object(
      'total_checks', 0,
      'completed_checks', 0,
      'score_pct', 0,
      'items', '[]'::JSONB,
      'message', 'No event type set'
    );
  END IF;

  -- Iterate checklist for this event type
  FOR v_checklist IN
    SELECT * FROM public.event_type_readiness_checklist
    WHERE event_type_id = v_event.event_type_id
    ORDER BY sort_order
  LOOP
    v_is_completed := FALSE;

    -- Evaluate each check_key against actual event data
    CASE v_checklist.check_key

      WHEN 'has_event_date' THEN
        v_is_completed := v_event.start_date IS NOT NULL;

      WHEN 'has_cover_image' THEN
        v_is_completed := v_event.cover_image_url IS NOT NULL AND v_event.cover_image_url <> '';

      WHEN 'has_venue' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_venues ev WHERE ev.event_id = p_event_id LIMIT 1
        );

      WHEN 'min_guests_added' THEN
        v_is_completed := (
          SELECT COUNT(*) FROM public.guests g WHERE g.event_id = p_event_id
        ) >= 5;

      WHEN 'invitations_sent' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.invitations i
          WHERE i.event_id = p_event_id AND i.status IN ('sent', 'delivered', 'opened')
          LIMIT 1
        );

      WHEN 'has_budget' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_budgets eb WHERE eb.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_vendor' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_vendors ev WHERE ev.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_accommodation' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.accommodation_rooms ar WHERE ar.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_fnb_menu' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.fnb_menus fm WHERE fm.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_decor_plan' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.decor_items di WHERE di.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_team_member' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_team_members etm WHERE etm.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_runsheet' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.production_runsheets pr WHERE pr.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_artist' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_artists ea WHERE ea.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_permit' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.event_permits ep WHERE ep.event_id = p_event_id AND ep.status = 'approved' LIMIT 1
        );

      WHEN 'has_document' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.documents d WHERE d.event_id = p_event_id LIMIT 1
        );

      WHEN 'has_health_safety_plan' THEN
        v_is_completed := EXISTS (
          SELECT 1 FROM public.health_safety_plans hsp WHERE hsp.event_id = p_event_id LIMIT 1
        );

      ELSE
        v_is_completed := FALSE;
    END CASE;

    v_total := v_total + 1;
    IF v_is_completed THEN
      v_completed := v_completed + 1;
    END IF;

    v_items := v_items || jsonb_build_object(
      'check_key',   v_checklist.check_key,
      'check_label', v_checklist.check_label,
      'module',      v_checklist.module,
      'is_required', v_checklist.is_required,
      'is_completed', v_is_completed,
      'sort_order',  v_checklist.sort_order
    );
  END LOOP;

  v_score_pct := CASE
    WHEN v_total = 0 THEN 0
    ELSE ROUND((v_completed::NUMERIC / v_total::NUMERIC) * 100)
  END;

  RETURN jsonb_build_object(
    'total_checks',     v_total,
    'completed_checks', v_completed,
    'score_pct',        v_score_pct,
    'event_type',       v_event.type_name,
    'event_type_icon',  v_event.type_icon,
    'items',            v_items
  );
END;
$$;

-- ── RLS policies ──────────────────────────────────────────────────────────────

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_type_readiness_checklist ENABLE ROW LEVEL SECURITY;

-- System types visible to all authenticated users
CREATE POLICY "event_types_read_system" ON public.event_types
  FOR SELECT USING (is_system = TRUE OR tenant_id = (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1
  ));

-- Tenant can manage their own custom types
CREATE POLICY "event_types_manage_own" ON public.event_types
  FOR ALL USING (
    tenant_id IS NOT NULL AND tenant_id = (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Checklist items readable by authenticated users (joined via event_types)
CREATE POLICY "readiness_checklist_read" ON public.event_type_readiness_checklist
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.event_types et
      WHERE et.id = event_type_id
        AND (et.is_system = TRUE OR et.tenant_id = (
          SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1
        ))
    )
  );

-- Service role bypass
CREATE POLICY "event_types_service_all" ON public.event_types
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "readiness_checklist_service_all" ON public.event_type_readiness_checklist
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Grant execute on smart_readiness_score to authenticated
GRANT EXECUTE ON FUNCTION public.smart_readiness_score(UUID) TO authenticated, service_role;
