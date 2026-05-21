-- ============================================================
-- 067_platform_support_bot.sql
-- Platform-level support: FAQ bot, super-admin ticket inbox,
-- conversation threads, and 20 seeded FAQs.
-- ============================================================

-- ── 1. support_faqs — managed by Super Admin only ─────────────────────────────

CREATE TABLE IF NOT EXISTS support_faqs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  keywords    TEXT[]      NOT NULL DEFAULT '{}',
  category    VARCHAR(100) NOT NULL DEFAULT 'General'
                CHECK (category IN ('Billing','Features','Technical','Account','Events','General')),
  sort_order  INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  view_count  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_faqs_category ON support_faqs(category, is_active);
CREATE INDEX IF NOT EXISTS idx_support_faqs_active   ON support_faqs(is_active, sort_order);

ALTER TABLE support_faqs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active FAQs
CREATE POLICY faq_read_active ON support_faqs
  FOR SELECT USING (is_active = TRUE);

-- ── 2. Extend support_tickets with platform-bot fields ───────────────────────
-- The existing table (024) has: tenant_id, title, description, status, priority, reporter_id, etc.
-- We add bot-related + super-admin fields on top.

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS submitted_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject            VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bot_faq_id         UUID REFERENCES support_faqs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalated_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_notes   TEXT,
  ADD COLUMN IF NOT EXISTS super_admin_notes  TEXT;

-- Extend the status CHECK to include bot-handled and escalated values.
-- We drop + re-add the constraint rather than modifying inline (Postgres compatibility).
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN (
    'open','bot_handled','escalated','in_progress',
    'resolved','closed','cancelled','pending_client'
  ));

-- ── 3. support_messages — conversation thread per ticket ─────────────────────

CREATE TABLE IF NOT EXISTS support_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type  TEXT        NOT NULL CHECK (sender_type IN ('user','bot','super_admin')),
  sender_id    UUID,           -- profiles.id; NULL for bot messages
  message      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id, created_at);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Users see messages on tickets that belong to their tenant
CREATE POLICY msg_tenant_read ON support_messages
  FOR SELECT USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY msg_tenant_insert ON support_messages
  FOR INSERT WITH CHECK (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Super Admin sees all tickets / messages (bypasses tenant_isolation)
-- We use a SECURITY DEFINER function approach: add a separate permissive policy.
CREATE POLICY super_admin_full_tickets ON support_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_full_messages ON support_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY super_admin_full_faqs ON support_faqs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ── 4. updated_at trigger for support_faqs ───────────────────────────────────

CREATE OR REPLACE FUNCTION fn_support_faq_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_faq_updated ON support_faqs;
CREATE TRIGGER trg_support_faq_updated
  BEFORE UPDATE ON support_faqs
  FOR EACH ROW EXECUTE FUNCTION fn_support_faq_updated_at();

-- ── 5. Enable Realtime on support_messages ────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;

-- ── 6. Seed 20 platform FAQs ─────────────────────────────────────────────────

INSERT INTO support_faqs (question, answer, keywords, category, sort_order) VALUES

-- ── Billing (5) ──────────────────────────────────────────────────────────────
(
  'How do I upgrade my plan?',
  'Go to **Settings → Billing** from the left sidebar. You''ll see all available plans with their features. Click "Upgrade" on the plan you want, and you''ll be taken to a secure Razorpay checkout. Your new plan activates immediately after payment.',
  ARRAY['upgrade','plan','billing','payment','subscription','razorpay','checkout'],
  'Billing', 10
),
(
  'Can I switch from monthly to yearly billing?',
  'Yes! Head to **Settings → Billing**, scroll down to your current plan, and click "Switch to Yearly". Yearly plans save you ~17% compared to monthly. Your billing cycle resets from the switch date.',
  ARRAY['yearly','annual','monthly','billing','switch','cycle','save'],
  'Billing', 20
),
(
  'How do I cancel my subscription?',
  'Go to **Settings → Billing** and click "Cancel Subscription" at the bottom of the page. Your access continues until the end of your current billing period. Data is preserved for 90 days after cancellation so you can reactivate anytime.',
  ARRAY['cancel','subscription','end','stop','billing','refund'],
  'Billing', 30
),
(
  'What payment methods are accepted?',
  'We accept all major credit/debit cards (Visa, Mastercard, Rupay), UPI, net banking, and wallets through Razorpay. All payments are processed securely and your card details are never stored on our servers.',
  ARRAY['payment','card','upi','netbanking','wallet','razorpay','accepted','methods'],
  'Billing', 40
),
(
  'What happens when my free trial ends?',
  'Your 14-day Growth trial expires automatically. You''ll see a full-screen prompt to choose a paid plan. Your events, guests, and all data are preserved — nothing is deleted. You have 30 days to reactivate before data cleanup begins.',
  ARRAY['trial','expire','ends','free','data','after','grace'],
  'Billing', 50
),

-- ── Features (4) ─────────────────────────────────────────────────────────────
(
  'How do I invite team members?',
  'Go to **Settings → Team** and click "Invite Member". Enter their email address and select their role (Manager, Coordinator, or Viewer). They''ll receive an email invite valid for 7 days. Team member limits depend on your plan.',
  ARRAY['invite','team','member','add','role','email','staff'],
  'Features', 10
),
(
  'What is the AI assistant and what can it do?',
  'The AI assistant (available on Growth and Agency plans) helps you generate event proposals, draft guest communications, suggest vendor options, forecast budgets, and automate repetitive planning tasks. Access it from any page via the AI button in the top bar.',
  ARRAY['ai','assistant','artificial intelligence','proposal','automation','smart','generate'],
  'Features', 20
),
(
  'Can I create a custom client portal for my clients?',
  'Yes! In any event, go to **Portals → Client Portal** and enable it. Your client gets a branded link where they can approve vendors, view budgets, upload documents, and communicate — all without needing an OccasionPro account.',
  ARRAY['client','portal','branded','link','access','share','approve','collaborate'],
  'Features', 30
),
(
  'Is there a mobile app?',
  'OccasionPro is fully responsive and works great on mobile browsers. A dedicated iOS/Android app is on our roadmap for Q3 2026. In the meantime, you can add the web app to your home screen for an app-like experience.',
  ARRAY['mobile','app','ios','android','phone','tablet','responsive'],
  'Features', 40
),

-- ── Events (4) ───────────────────────────────────────────────────────────────
(
  'How do I add guests to an event?',
  'Open the event, go to the **Guests** tab, and click "Add Guest". You can add individually, bulk-import from CSV (download our template first), or copy guests from a previous event. Each guest gets a unique QR code for check-in.',
  ARRAY['guest','add','import','csv','bulk','rsvp','checkin','qr'],
  'Events', 10
),
(
  'How do I send invitations to guests?',
  'From the Guests tab, select guests and click **Send Invitation**. Choose from email, WhatsApp, or SMS. You can customise the invitation template with your event branding, RSVP link, and a personal message.',
  ARRAY['invitation','send','email','whatsapp','sms','invite','rsvp','message'],
  'Events', 20
),
(
  'Can I set up an online RSVP page?',
  'Yes. In your event settings go to **Microsites → RSVP Page**. Customise the design with your event colors, add a cover photo, meal preferences, dietary requirements, and any custom questions. Share the RSVP link directly or embed it on your website.',
  ARRAY['rsvp','online','form','microsite','website','registration','page','link'],
  'Events', 30
),
(
  'How do I delete an event?',
  'Go to the event, click the three-dot menu (⋯) in the top-right, and select "Delete Event". You''ll be asked to confirm. Deleting an event permanently removes all associated data — guests, tasks, vendors, documents. This cannot be undone.',
  ARRAY['delete','remove','event','archive','cancel','permanently'],
  'Events', 40
),

-- ── Technical (4) ────────────────────────────────────────────────────────────
(
  'How do I export my data?',
  'Go to **Settings → Data & Exports**. You can export guests (CSV/Excel), events summary, vendor contracts, financial reports, and more. Full workspace data exports (ZIP) are available on Growth and Agency plans and are delivered by email within 30 minutes.',
  ARRAY['export','data','download','csv','excel','backup','zip','report'],
  'Technical', 10
),
(
  'Can I connect a custom domain to my client portals?',
  'Yes, on the Agency plan. Go to **Settings → Branding → Custom Domain**, enter your domain (e.g. portal.youreventco.com), and follow the DNS instructions. It typically takes 10–30 minutes to propagate. SSL is automatic.',
  ARRAY['custom','domain','dns','ssl','branding','white label','cname','portal'],
  'Technical', 20
),
(
  'Why is the app running slowly?',
  'Try clearing your browser cache and reloading. OccasionPro works best in Chrome, Edge, or Safari (latest versions). If slowness persists, check your internet connection, disable browser extensions temporarily, and try an incognito window. If the issue continues, please contact support.',
  ARRAY['slow','performance','loading','lag','cache','browser','speed','issue'],
  'Technical', 30
),
(
  'Is my data secure and backed up?',
  'All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We run on Supabase/AWS infrastructure with automated daily backups retained for 30 days. We are SOC 2 compliant and GDPR-ready. View our full security policy at occasionpro.com/security.',
  ARRAY['security','backup','encrypted','data','safe','privacy','gdpr','soc2','compliant'],
  'Technical', 40
),

-- ── Account (3) ──────────────────────────────────────────────────────────────
(
  'How do I change my workspace name or logo?',
  'Go to **Settings → Workspace** and update your workspace name, logo, and brand colors. Changes take effect immediately across all portals and documents generated by OccasionPro.',
  ARRAY['workspace','name','logo','brand','settings','change','update','company'],
  'Account', 10
),
(
  'How do I reset my password?',
  'On the login page, click "Forgot password?" and enter your email. You''ll receive a reset link valid for 1 hour. If you don''t see it, check your spam folder. You can also change your password from **Settings → Profile → Security**.',
  ARRAY['password','reset','forgot','change','login','security','email','account'],
  'Account', 20
),
(
  'Can I have multiple workspaces under one account?',
  'Yes. Click your workspace name in the top-left to open the workspace switcher and select "Create new workspace". Each workspace has its own subscription, team, and events. Switching between them is instant. This is ideal for agencies managing multiple brands.',
  ARRAY['workspace','multiple','switch','new','create','agency','brand','account'],
  'Account', 30
)

ON CONFLICT DO NOTHING;
