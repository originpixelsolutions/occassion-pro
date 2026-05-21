-- ============================================================
-- 023_marketing.sql
-- Marketing & Lead Generation System
-- ============================================================

-- ── Lead Sources / UTM Tracking ───────────────────────────────
CREATE TABLE IF NOT EXISTS lead_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'organic'
                CHECK (type IN ('organic','paid_search','paid_social','referral',
                                'direct','email','whatsapp','sms','event','partner','other')),
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_content   TEXT,
  cost_per_lead NUMERIC(10,2),
  is_active     BOOLEAN NOT NULL DEFAULT true,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Leads ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  crm_contact_id  UUID,                                  -- FK to crm_contacts if converted

  -- Identity
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  company         TEXT,
  location        TEXT,
  social_handle   TEXT,

  -- Lead details
  event_type      TEXT,                                   -- wedding, corporate, birthday…
  event_date      DATE,
  estimated_budget NUMERIC(12,2),
  guest_count     INTEGER,
  requirements    TEXT,

  -- Source & scoring
  source_id       UUID REFERENCES lead_sources(id),
  source_type     TEXT,
  utm_data        JSONB DEFAULT '{}',
  lead_score      INTEGER NOT NULL DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  score_breakdown JSONB DEFAULT '{}',               -- {budget:30, urgency:20, ...}

  -- Stage
  stage           TEXT NOT NULL DEFAULT 'new'
                  CHECK (stage IN ('new','contacted','qualified','proposal_sent',
                                   'negotiating','won','lost','nurturing')),
  stage_updated_at TIMESTAMPTZ,
  lost_reason     TEXT,
  win_probability INTEGER DEFAULT 0 CHECK (win_probability BETWEEN 0 AND 100),

  -- Assignment
  assigned_to     UUID REFERENCES profiles(id),
  assigned_at     TIMESTAMPTZ,

  -- Follow-up
  last_contact_at TIMESTAMPTZ,
  next_follow_up  TIMESTAMPTZ,
  follow_up_count INTEGER NOT NULL DEFAULT 0,

  -- Flags
  is_qualified    BOOLEAN NOT NULL DEFAULT false,
  is_converted    BOOLEAN NOT NULL DEFAULT false,
  converted_at    TIMESTAMPTZ,
  is_hot          BOOLEAN NOT NULL DEFAULT false,
  do_not_contact  BOOLEAN NOT NULL DEFAULT false,

  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Lead Activities / Timeline ────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES marketing_leads(id) ON DELETE CASCADE,

  type            TEXT NOT NULL
                  CHECK (type IN ('call','email','whatsapp','meeting','note',
                                  'stage_change','score_change','proposal','site_visit','follow_up')),
  subject         TEXT,
  body            TEXT,
  outcome         TEXT CHECK (outcome IN ('positive','neutral','negative','no_answer')),
  duration_min    INTEGER,
  next_action     TEXT,
  next_action_at  TIMESTAMPTZ,
  performed_by    UUID REFERENCES profiles(id),

  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Campaigns ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL DEFAULT 'email'
                  CHECK (type IN ('email','whatsapp','sms','social','paid_ad',
                                  'influencer','event','referral','content','mixed')),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','active','paused','completed','cancelled')),
  objective       TEXT CHECK (objective IN ('awareness','leads','conversion',
                                             'retention','engagement','upsell')),

  -- Targeting
  target_audience TEXT,
  target_event_types TEXT[] DEFAULT '{}',
  target_locations   TEXT[] DEFAULT '{}',
  estimated_reach    INTEGER,

  -- Budget
  budget          NUMERIC(12,2),
  spent           NUMERIC(12,2) DEFAULT 0,

  -- Schedule
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,

  -- Results
  sent_count      INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  opened_count    INTEGER NOT NULL DEFAULT 0,
  clicked_count   INTEGER NOT NULL DEFAULT 0,
  replied_count   INTEGER NOT NULL DEFAULT 0,
  converted_count INTEGER NOT NULL DEFAULT 0,
  unsubscribed    INTEGER NOT NULL DEFAULT 0,
  revenue_attributed NUMERIC(12,2) DEFAULT 0,

  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Campaign Messages / Templates ─────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,

  sequence_order  INTEGER NOT NULL DEFAULT 1,
  channel         TEXT NOT NULL CHECK (channel IN ('email','whatsapp','sms')),
  send_delay_days INTEGER NOT NULL DEFAULT 0,   -- days after previous message
  send_time       TIME,                          -- preferred send time

  subject         TEXT,
  body            TEXT NOT NULL,
  media_url       TEXT,
  cta_text        TEXT,
  cta_url         TEXT,

  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Campaign Recipients ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES marketing_leads(id),

  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,

  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','delivered','opened','clicked',
                                    'replied','converted','bounced','unsubscribed','failed')),
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,

  UNIQUE(campaign_id, lead_id)
);

-- ── Lead Capture Forms ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_capture_forms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  title           TEXT,
  subtitle        TEXT,
  cta_text        TEXT DEFAULT 'Get Free Quote',
  thank_you_message TEXT DEFAULT 'We''ll contact you within 24 hours!',

  -- Form config
  fields          JSONB NOT NULL DEFAULT '[]',   -- [{label, type, required, options}]
  source_id       UUID REFERENCES lead_sources(id),

  -- Branding
  primary_color   TEXT DEFAULT '#6366f1',
  logo_url        TEXT,
  background_url  TEXT,

  is_active       BOOLEAN NOT NULL DEFAULT true,
  submission_count INTEGER NOT NULL DEFAULT 0,
  conversion_rate  NUMERIC(5,2) DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- ── Form Submissions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  form_id         UUID NOT NULL REFERENCES lead_capture_forms(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES marketing_leads(id),

  data            JSONB NOT NULL DEFAULT '{}',
  ip_address      TEXT,
  user_agent      TEXT,
  referrer_url    TEXT,
  utm_data        JSONB DEFAULT '{}',

  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Social Posts / Content Calendar ──────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  content         TEXT NOT NULL,
  caption         TEXT,
  hashtags        TEXT[] DEFAULT '{}',
  media_urls      TEXT[] DEFAULT '{}',

  platforms       TEXT[] NOT NULL DEFAULT '{instagram}',
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','published','failed')),

  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,

  -- Analytics
  impressions     INTEGER DEFAULT 0,
  reach           INTEGER DEFAULT 0,
  likes           INTEGER DEFAULT 0,
  comments        INTEGER DEFAULT 0,
  shares          INTEGER DEFAULT 0,
  saves           INTEGER DEFAULT 0,
  link_clicks     INTEGER DEFAULT 0,

  campaign_id     UUID REFERENCES marketing_campaigns(id),
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Marketing Analytics / KPI Snapshots ──────────────────────
CREATE TABLE IF NOT EXISTS marketing_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,

  total_leads     INTEGER NOT NULL DEFAULT 0,
  new_leads       INTEGER NOT NULL DEFAULT 0,
  qualified_leads INTEGER NOT NULL DEFAULT 0,
  converted_leads INTEGER NOT NULL DEFAULT 0,
  lost_leads      INTEGER NOT NULL DEFAULT 0,

  total_revenue   NUMERIC(12,2) DEFAULT 0,
  marketing_spend NUMERIC(12,2) DEFAULT 0,
  roas            NUMERIC(6,2) DEFAULT 0,    -- return on ad spend
  cost_per_lead   NUMERIC(10,2) DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,

  top_source      TEXT,
  top_event_type  TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, snapshot_date)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_tenant         ON marketing_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage          ON marketing_leads(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_score          ON marketing_leads(tenant_id, lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_assigned       ON marketing_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_source         ON marketing_leads(source_id);
CREATE INDEX IF NOT EXISTS idx_leads_hot            ON marketing_leads(tenant_id, is_hot) WHERE is_hot = true;
CREATE INDEX IF NOT EXISTS idx_leads_followup       ON marketing_leads(tenant_id, next_follow_up);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant     ON marketing_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status     ON marketing_campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_recipients_campaign  ON campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_social_posts_tenant  ON social_posts(tenant_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions     ON form_submissions(form_id, submitted_at DESC);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE lead_sources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_leads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_capture_forms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_analytics   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON lead_sources
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON marketing_leads
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON lead_activities
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON marketing_campaigns
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON campaign_messages
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON campaign_recipients
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON lead_capture_forms
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON form_submissions
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON social_posts
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
  CREATE POLICY tenant_isolation ON marketing_analytics
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Public: allow form submission inserts without auth (for embed forms)
CREATE POLICY public_form_submit ON form_submissions
  FOR INSERT WITH CHECK (true);
