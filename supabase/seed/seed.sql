-- ============================================================
-- OccasionPro — Development Seed Data
-- ============================================================
-- This seed creates a complete multi-tenant test environment:
--   • 1 Super Admin
--   • 2 Tenants: "Stellar Events" (Pro) + "Spark Celebrations" (Starter)
--   • Sample events, contacts, vendors, inventory, guests
-- ============================================================

-- ── DISABLE TRIGGERS FOR SEEDING ─────────────────────────────
SET session_replication_role = replica;

-- ── FIXED UUIDs FOR REPRODUCIBLE SEEDS ───────────────────────
DO $$
DECLARE
  -- Tenants
  v_tenant1       UUID := '00000000-0001-0000-0000-000000000001';
  v_tenant2       UUID := '00000000-0002-0000-0000-000000000001';
  -- Users
  v_super_admin   UUID := '00000000-0000-0000-0000-000000000001';
  v_t1_admin      UUID := '00000000-0001-0000-0000-000000000010';
  v_t1_mgr        UUID := '00000000-0001-0000-0000-000000000011';
  v_t1_member     UUID := '00000000-0001-0000-0000-000000000012';
  v_t2_admin      UUID := '00000000-0002-0000-0000-000000000010';
  -- Events
  v_event1        UUID := '00000000-0001-0001-0000-000000000001';
  v_event2        UUID := '00000000-0001-0001-0000-000000000002';
  v_event3        UUID := '00000000-0002-0001-0000-000000000001';
  -- Venue
  v_venue1        UUID := '00000000-0001-0002-0000-000000000001';
  -- Clients
  v_client1       UUID := '00000000-0001-0003-0000-000000000001';
  v_client2       UUID := '00000000-0001-0003-0000-000000000002';
  -- Lead
  v_lead1         UUID := '00000000-0001-0004-0000-000000000001';
  -- Vendor
  v_vendor1       UUID := '00000000-0001-0005-0000-000000000001';
  v_vendor2       UUID := '00000000-0001-0005-0000-000000000002';
  -- Budget
  v_budget1       UUID := '00000000-0001-0006-0000-000000000001';
  -- Floor plan
  v_floorplan1    UUID := '00000000-0001-0007-0000-000000000001';
  v_zone1         UUID := '00000000-0001-0007-0000-000000000010';
  v_zone2         UUID := '00000000-0001-0007-0000-000000000011';
  -- Guest categories
  v_cat_vip       UUID := '00000000-0001-0008-0000-000000000001';
  v_cat_general   UUID := '00000000-0001-0008-0000-000000000002';
  -- Inventory
  v_inv_cat1      UUID := '00000000-0001-0009-0000-000000000001';
  v_inv_item1     UUID := '00000000-0001-0009-0000-000000000010';
  v_inv_item2     UUID := '00000000-0001-0009-0000-000000000011';
  -- Microsite
  v_microsite1    UUID := '00000000-0001-0010-0000-000000000001';
  v_tier1         UUID := '00000000-0001-0010-0000-000000000010';
  v_tier2         UUID := '00000000-0001-0010-0000-000000000011';

BEGIN

-- ── AUTH USERS (auth.users) ───────────────────────────────────
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
  (v_super_admin, 'superadmin@occasionpro.in', crypt('Admin@123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Super Admin"}'),
  (v_t1_admin,    'admin@stellarevents.com',   crypt('Admin@123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ananya Sharma"}'),
  (v_t1_mgr,      'priya@stellarevents.com',   crypt('Admin@123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Priya Menon"}'),
  (v_t1_member,   'rahul@stellarevents.com',   crypt('Admin@123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rahul Verma"}'),
  (v_t2_admin,    'admin@sparkcelebrations.in', crypt('Admin@123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Karthik Nair"}')
ON CONFLICT (id) DO NOTHING;

-- ── TENANTS ───────────────────────────────────────────────────
INSERT INTO tenants (id, name, slug, plan, status, country, currency, timezone, max_users, max_events_per_month)
VALUES
  (v_tenant1, 'Stellar Events',        'stellar-events',     'pro',     'active', 'IN', 'INR', 'Asia/Kolkata', 25, 50),
  (v_tenant2, 'Spark Celebrations',    'spark-celebrations', 'starter', 'active', 'IN', 'INR', 'Asia/Kolkata', 5,  10)
ON CONFLICT (id) DO NOTHING;

-- ── PROFILES ─────────────────────────────────────────────────
INSERT INTO profiles (id, tenant_id, full_name, email, phone, is_super_admin)
VALUES
  (v_super_admin, v_tenant1,  'Super Admin',   'superadmin@occasionpro.in', '+91-99999-00000', true),
  (v_t1_admin,    v_tenant1,  'Ananya Sharma', 'admin@stellarevents.com',   '+91-98765-43210', false),
  (v_t1_mgr,      v_tenant1,  'Priya Menon',   'priya@stellarevents.com',   '+91-98765-43211', false),
  (v_t1_member,   v_tenant1,  'Rahul Verma',   'rahul@stellarevents.com',   '+91-98765-43212', false),
  (v_t2_admin,    v_tenant2,  'Karthik Nair',  'admin@sparkcelebrations.in', '+91-90000-12345', false)
ON CONFLICT (id) DO NOTHING;

-- ── USER ROLES ────────────────────────────────────────────────
INSERT INTO user_roles (user_id, tenant_id, role, is_active, assigned_by)
VALUES
  (v_super_admin, v_tenant1, 'super_admin',    true, v_super_admin),
  (v_t1_admin,    v_tenant1, 'company_admin',  true, v_super_admin),
  (v_t1_mgr,      v_tenant1, 'event_manager',  true, v_t1_admin),
  (v_t1_member,   v_tenant1, 'team_member',    true, v_t1_admin),
  (v_t2_admin,    v_tenant2, 'company_admin',  true, v_super_admin)
ON CONFLICT (user_id, tenant_id, role) DO NOTHING;

-- ── VENUE ─────────────────────────────────────────────────────
INSERT INTO venues (id, tenant_id, name, address_line1, city, state, country, capacity_seated, capacity_standing, area_sqft, latitude, longitude, amenities, tags)
VALUES
  (v_venue1, v_tenant1, 'Grand Meridian Ballroom', '12, Residency Road', 'Bengaluru', 'Karnataka', 'IN', 500, 800, 12000,
   12.9716, 77.5946,
   ARRAY['AC','Parking','WiFi','Stage','Green Room','Catering Kitchen'],
   ARRAY['luxury','ballroom','corporate','wedding'])
ON CONFLICT (id) DO NOTHING;

-- ── EVENTS (Tenant 1) ─────────────────────────────────────────
INSERT INTO events (id, tenant_id, name, category, status, start_date, end_date, venue_id, city, state, country, expected_guests, actual_guests, budget_amount, currency, created_by, description, microsite_enabled)
VALUES
  (v_event1, v_tenant1,
   'TechSummit Bengaluru 2026',
   'conference', 'confirmed',
   '2026-07-15 09:00:00+05:30',
   '2026-07-16 18:00:00+05:30',
   v_venue1, 'Bengaluru', 'Karnataka', 'IN',
   400, 0, 1500000, 'INR', v_t1_admin,
   'Annual technology summit bringing together 400+ industry leaders, startup founders, and engineers for 2 days of talks, workshops, and networking.',
   true),
  (v_event2, v_tenant1,
   'Kapoor-Singh Wedding',
   'wedding', 'planning',
   '2026-09-20 10:00:00+05:30',
   '2026-09-22 23:00:00+05:30',
   v_venue1, 'Bengaluru', 'Karnataka', 'IN',
   600, 0, 5000000, 'INR', v_t1_mgr,
   'Three-day destination wedding celebration for the Kapoor and Singh families.',
   false)
ON CONFLICT (id) DO NOTHING;

-- ── EVENTS (Tenant 2) ─────────────────────────────────────────
INSERT INTO events (id, tenant_id, name, category, status, start_date, end_date, city, country, expected_guests, budget_amount, currency, created_by, description)
VALUES
  (v_event3, v_tenant2,
   'Spark Annual Gala 2026',
   'corporate', 'draft',
   '2026-08-10 19:00:00+05:30',
   '2026-08-10 23:00:00+05:30',
   'Chennai', 'IN', 200, 800000, 'INR', v_t2_admin,
   'Annual gala dinner and awards night for corporate clients.')
ON CONFLICT (id) DO NOTHING;

-- ── EVENT PHASES (TechSummit) ────────────────────────────────
INSERT INTO event_phases (tenant_id, event_id, name, order_index, start_date, end_date, color, description)
VALUES
  (v_tenant1, v_event1, 'Pre-Production',     1, '2026-05-01', '2026-06-30', '#8B5CF6', 'Planning, vendor procurement, speaker confirmation'),
  (v_tenant1, v_event1, 'Production Setup',   2, '2026-07-13', '2026-07-14', '#3B82F6', 'Venue setup, AV check, registration desk prep'),
  (v_tenant1, v_event1, 'Event Execution',    3, '2026-07-15', '2026-07-16', '#10B981', 'Live event — Day 1 and Day 2'),
  (v_tenant1, v_event1, 'Post-Event Wrap',    4, '2026-07-17', '2026-07-19', '#F59E0B', 'Tear-down, vendor settlements, feedback collection')
ON CONFLICT DO NOTHING;

-- ── EVENT TASKS (TechSummit) ────────────────────────────────
INSERT INTO event_tasks (tenant_id, event_id, title, status, priority, due_date, assigned_to, created_by)
VALUES
  (v_tenant1, v_event1, 'Confirm venue booking and sign contract',  'completed', 'urgent', '2026-05-20', v_t1_admin, v_t1_admin),
  (v_tenant1, v_event1, 'Finalise speaker list and send invitations', 'in_progress', 'high', '2026-06-01', v_t1_mgr, v_t1_admin),
  (v_tenant1, v_event1, 'Set up event microsite and ticketing',     'pending', 'high', '2026-06-15', v_t1_mgr, v_t1_admin),
  (v_tenant1, v_event1, 'Coordinate AV and lighting vendors',       'pending', 'medium', '2026-06-30', v_t1_member, v_t1_mgr),
  (v_tenant1, v_event1, 'Design and print delegate badges',         'pending', 'medium', '2026-07-10', v_t1_member, v_t1_mgr),
  (v_tenant1, v_event1, 'Prepare registration desk kiosks',         'pending', 'high', '2026-07-12', v_t1_member, v_t1_mgr)
ON CONFLICT DO NOTHING;

-- ── CLIENT COMPANIES ─────────────────────────────────────────
INSERT INTO client_companies (id, tenant_id, name, industry, city, country, website, created_by)
VALUES
  (v_client1, v_tenant1, 'NovaTech Solutions',     'Technology',        'Bengaluru', 'IN', 'https://novatech.example.com', v_t1_admin),
  (v_client2, v_tenant1, 'Kapoor Family (Private)', 'Personal / Wedding', 'Mumbai',   'IN', NULL, v_t1_mgr)
ON CONFLICT (id) DO NOTHING;

-- ── CONTACTS ─────────────────────────────────────────────────
INSERT INTO contacts (tenant_id, company_id, full_name, email, phone, designation, is_primary_contact, created_by)
VALUES
  (v_tenant1, v_client1, 'Vikram Patel',   'vikram@novatech.example.com', '+91-98001-00001', 'Head of Marketing',  true, v_t1_admin),
  (v_tenant1, v_client2, 'Sunita Kapoor',  'sunita.kapoor@example.com',  '+91-98001-00002', 'Bride''s Mother',    true, v_t1_mgr)
ON CONFLICT DO NOTHING;

-- ── LEADS ────────────────────────────────────────────────────
INSERT INTO leads (id, tenant_id, company_id, title, stage, probability, estimated_value, currency, source, assigned_to, created_by)
VALUES
  (v_lead1, v_tenant1, v_client1, 'TechSummit 2026 Corporate Package', 'proposal', 75, 250000, 'INR', 'referral', v_t1_mgr, v_t1_admin)
ON CONFLICT (id) DO NOTHING;

-- ── VENDOR CATEGORIES ─────────────────────────────────────────
INSERT INTO vendor_categories (tenant_id, name, icon, description)
VALUES
  (v_tenant1, 'AV & Lighting',    'speaker',       'Audio visual equipment, stage lighting, LED walls'),
  (v_tenant1, 'Photography',      'camera',        'Event photography and videography'),
  (v_tenant1, 'Catering',         'utensils',      'Food and beverage services'),
  (v_tenant1, 'Floral & Decor',   'flower',        'Floral arrangements and event decoration'),
  (v_tenant1, 'Transportation',   'car',           'Guest transfers and logistics'),
  (v_tenant1, 'Entertainment',    'music',         'Artists, bands, DJs, performers'),
  (v_tenant1, 'Security',         'shield',        'Event security and crowd management')
ON CONFLICT DO NOTHING;

-- ── VENDORS ──────────────────────────────────────────────────
INSERT INTO vendors (id, tenant_id, name, email, phone, city, country, gstin, tags, rating, created_by)
VALUES
  (v_vendor1, v_tenant1, 'Lightcraft AV Solutions', 'sales@lightcraft.example.com', '+91-80001-00001', 'Bengaluru', 'IN', '29ABCDE1234F1Z5', ARRAY['av','lighting','led'], 4.7, v_t1_admin),
  (v_vendor2, v_tenant1, 'Aroma Catering Co.',       'events@aromacatering.example.com', '+91-80001-00002', 'Bengaluru', 'IN', '29FGHIJ5678G2A1', ARRAY['catering','buffet','live-counters'], 4.5, v_t1_admin)
ON CONFLICT (id) DO NOTHING;

-- ── BUDGET ───────────────────────────────────────────────────
INSERT INTO budgets (id, tenant_id, event_id, total_budget, currency, created_by)
VALUES
  (v_budget1, v_tenant1, v_event1, 1500000, 'INR', v_t1_admin)
ON CONFLICT (id) DO NOTHING;

INSERT INTO budget_line_items (tenant_id, event_id, budget_id, category, name, estimated_amount, currency, created_by)
VALUES
  (v_tenant1, v_event1, v_budget1, 'Venue',         'Grand Meridian Ballroom — 2 days',   350000, 'INR', v_t1_admin),
  (v_tenant1, v_event1, v_budget1, 'AV & Lighting',  'Full AV setup with LED wall',         280000, 'INR', v_t1_admin),
  (v_tenant1, v_event1, v_budget1, 'Catering',       'Lunch + Tea breaks × 2 days × 400',  240000, 'INR', v_t1_admin),
  (v_tenant1, v_event1, v_budget1, 'Marketing',      'Social media, print, email campaigns', 80000, 'INR', v_t1_admin),
  (v_tenant1, v_event1, v_budget1, 'Hospitality',    'Speaker hospitality & green room',    120000, 'INR', v_t1_admin),
  (v_tenant1, v_event1, v_budget1, 'Ops & Logistics','Badges, signage, stationery',          50000, 'INR', v_t1_admin),
  (v_tenant1, v_event1, v_budget1, 'Contingency',    '10% contingency buffer',              150000, 'INR', v_t1_admin)
ON CONFLICT DO NOTHING;

-- ── FLOOR PLAN ────────────────────────────────────────────────
INSERT INTO floor_plans (id, tenant_id, event_id, venue_id, name, version, is_active, width_px, height_px, scale_ratio, created_by)
VALUES
  (v_floorplan1, v_tenant1, v_event1, v_venue1, 'TechSummit 2026 — Main Hall Layout', 1, true, 1200, 800, 0.1, v_t1_mgr)
ON CONFLICT (id) DO NOTHING;

INSERT INTO floor_plan_zones (id, tenant_id, floor_plan_id, name, zone_type, color, capacity, order_index)
VALUES
  (v_zone1, v_tenant1, v_floorplan1, 'Main Stage & Auditorium', 'stage',        '#8B5CF6', 350, 1),
  (v_zone2, v_tenant1, v_floorplan1, 'Networking Lounge',       'networking',   '#10B981', 150, 2)
ON CONFLICT (id) DO NOTHING;

-- ── INVENTORY ────────────────────────────────────────────────
INSERT INTO inventory_categories (id, tenant_id, name, icon)
VALUES
  (v_inv_cat1, v_tenant1, 'Event Furniture', 'armchair')
ON CONFLICT (id) DO NOTHING;

INSERT INTO inventory_items (id, tenant_id, category_id, name, sku, unit, quantity_total, quantity_available, unit_cost, replacement_cost, storage_location, created_by)
VALUES
  (v_inv_item1, v_tenant1, v_inv_cat1, 'Banquet Chair (Padded)',     'FURN-CHR-001', 'piece', 500, 500, 200,  800,  'Warehouse A - Row 3', v_t1_admin),
  (v_inv_item2, v_tenant1, v_inv_cat1, 'Round Table (6-seater 5ft)', 'FURN-TBL-001', 'piece', 80,  80,  1500, 5000, 'Warehouse A - Row 1', v_t1_admin)
ON CONFLICT (id) DO NOTHING;

-- ── GUEST CATEGORIES ─────────────────────────────────────────
INSERT INTO guest_categories (id, tenant_id, event_id, name, color, badge_color, priority, is_default)
VALUES
  (v_cat_vip,     v_tenant1, v_event1, 'VIP',     '#7C3AED', '#EDE9FE', 100, false),
  (v_cat_general, v_tenant1, v_event1, 'Delegate', '#1D4ED8', '#EFF6FF', 10, true)
ON CONFLICT (id) DO NOTHING;

-- ── SAMPLE GUESTS ────────────────────────────────────────────
INSERT INTO guests (tenant_id, event_id, category_id, full_name, email, company, designation, rsvp_status, source)
VALUES
  (v_tenant1, v_event1, v_cat_vip,     'Arun Kumar',     'arun.kumar@techcorp.example.com',   'TechCorp India',     'CTO',               'confirmed', 'manual'),
  (v_tenant1, v_event1, v_cat_vip,     'Meera Pillai',   'meera.p@startupXYZ.example.com',    'StartupXYZ',         'Founder & CEO',     'confirmed', 'manual'),
  (v_tenant1, v_event1, v_cat_general, 'Suresh Rajan',   'suresh.r@devtools.example.com',     'DevTools Co',        'Senior Engineer',   'pending',   'imported'),
  (v_tenant1, v_event1, v_cat_general, 'Divya Krishnan', 'divya.k@cloudsys.example.com',      'CloudSys',           'Product Manager',   'confirmed', 'imported'),
  (v_tenant1, v_event1, v_cat_general, 'Mohit Saxena',   'mohit.s@nexgen.example.com',        'NexGen AI',          'Data Scientist',    'declined',  'imported')
ON CONFLICT DO NOTHING;

-- ── EVENT MICROSITE (TechSummit) ─────────────────────────────
INSERT INTO microsites (id, tenant_id, event_id, status, subdomain, title, tagline, description, primary_color, accent_color, enable_ticketing, show_schedule, show_speakers, show_sponsors, created_by)
VALUES
  (v_microsite1, v_tenant1, v_event1, 'published', 'techsummit2026',
   'TechSummit Bengaluru 2026',
   'Shaping the Future of Technology in India',
   'Join 400+ industry leaders, founders, and engineers for two days of inspiration, innovation, and impactful networking at Bengaluru''s premier annual tech summit.',
   '#7C3AED', '#06B6D4', true, true, true, true, v_t1_mgr)
ON CONFLICT (id) DO NOTHING;

-- ── TICKET TIERS ─────────────────────────────────────────────
INSERT INTO ticket_tiers (id, tenant_id, microsite_id, event_id, name, description, price, currency, quantity_total, is_active, order_index)
VALUES
  (v_tier1, v_tenant1, v_microsite1, v_event1, 'Early Bird',
   'Limited early bird tickets at special price. Includes lunch and conference kit.',
   1499, 'INR', 100, true, 1),
  (v_tier2, v_tenant1, v_microsite1, v_event1, 'General Delegate',
   'Standard conference pass with access to all sessions, networking, and meals.',
   2499, 'INR', 300, true, 2)
ON CONFLICT (id) DO NOTHING;

-- ── NOTIFICATIONS (sample) ───────────────────────────────────
INSERT INTO notifications (tenant_id, user_id, type, title, body, channel, is_read)
VALUES
  (v_tenant1, v_t1_admin, 'event_reminder',  'Event in 30 days',  'TechSummit Bengaluru 2026 is 30 days away. Review your checklist.', 'in_app', false),
  (v_tenant1, v_t1_mgr,   'task_assigned',   'Task assigned to you', 'You have been assigned: Set up event microsite and ticketing', 'in_app', false)
ON CONFLICT DO NOTHING;

END $$;

-- ── RE-ENABLE TRIGGERS ────────────────────────────────────────
SET session_replication_role = DEFAULT;

-- ── VERIFY COUNTS ─────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✓ Seed complete.';
  RAISE NOTICE '  tenants:   %', (SELECT COUNT(*) FROM tenants);
  RAISE NOTICE '  profiles:  %', (SELECT COUNT(*) FROM profiles);
  RAISE NOTICE '  events:    %', (SELECT COUNT(*) FROM events);
  RAISE NOTICE '  guests:    %', (SELECT COUNT(*) FROM guests);
  RAISE NOTICE '  vendors:   %', (SELECT COUNT(*) FROM vendors);
END $$;
