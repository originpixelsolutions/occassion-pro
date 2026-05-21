-- ─────────────────────────────────────────────────────────────
-- Migration 096: Event Website Builder
-- Supports: per-event custom landing pages, drag-drop sections,
--           publish/unpublish, custom domains, SEO meta, GA embed
-- Section types: hero, about, schedule, speakers, sponsors,
--                faq, gallery, map, countdown, registration, custom
-- ─────────────────────────────────────────────────────────────

-- ── Event websites (one per event, managed by tenant) ─────────
CREATE TABLE IF NOT EXISTS event_websites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Identity
  slug        text NOT NULL,   -- short path: event.occasionpro.in/{slug}
  custom_domain  text,         -- optional: events.clientdomain.com

  -- Content
  title       text,            -- Page <title> (defaults to event name)
  description text,            -- Meta description
  favicon_url text,

  -- SEO
  seo_title        text,
  seo_description  text,
  seo_keywords     text,
  og_image_url     text,       -- Open Graph image

  -- Integrations
  ga_tracking_id   text,       -- GA4 measurement ID e.g. G-XXXXXXXX
  fb_pixel_id      text,
  custom_css       text,       -- Injected in <style> on publish
  custom_js        text,       -- Injected before </body>

  -- Theme
  primary_color    text NOT NULL DEFAULT '#6d28d9',
  font_family      text NOT NULL DEFAULT 'Inter',
  dark_mode        boolean NOT NULL DEFAULT false,

  -- Status
  is_published    boolean NOT NULL DEFAULT false,
  published_at    timestamptz,
  unpublished_at  timestamptz,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT event_websites_slug_unique UNIQUE (slug)
);

-- ── Section type enum ─────────────────────────────────────────
CREATE TYPE website_section_type AS ENUM (
  'hero',
  'about',
  'schedule',
  'speakers',
  'sponsors',
  'faq',
  'gallery',
  'map',
  'countdown',
  'registration',
  'custom_html'
);

-- ── Website sections (drag-drop ordered) ─────────────────────
CREATE TABLE IF NOT EXISTS event_website_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  uuid NOT NULL REFERENCES event_websites(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  section_type  website_section_type NOT NULL,
  title         text,            -- Section heading displayed to visitors
  is_visible    boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 0,

  -- All section content as JSONB — structure varies by type:
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  /*
    hero:         { headline, subheadline, background_image_url, cta_label, cta_url, overlay_opacity }
    about:        { body_html, image_url, layout: "text_left"|"text_right"|"centered" }
    schedule:     { days: [{ date, items: [{ time, title, speaker, room, description }] }] }
    speakers:     { items: [{ name, title, company, bio, photo_url, social: {} }] }
    sponsors:     { tiers: [{ name, items: [{ name, logo_url, website_url }] }] }
    faq:          { items: [{ question, answer }] }
    gallery:      { images: [{ url, caption }], layout: "grid"|"masonry"|"carousel" }
    map:          { embed_url, address, iframe_height }
    countdown:    { target_date, message_before, message_after, show_seconds }
    registration: { form_id, button_label, redirect_url }
    custom_html:  { html, css }
  */

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_event_websites_tenant       ON event_websites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_websites_event        ON event_websites(event_id);
CREATE INDEX IF NOT EXISTS idx_event_websites_slug         ON event_websites(slug);
CREATE INDEX IF NOT EXISTS idx_event_websites_custom_domain ON event_websites(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_website_sections_website ON event_website_sections(website_id, sort_order);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE event_websites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_website_sections  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_event_websites" ON event_websites
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_event_website_sections" ON event_website_sections
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Allow public read access to published websites (needed for public rendering)
CREATE POLICY "public_read_published_websites" ON event_websites
  FOR SELECT
  USING (is_published = true);

CREATE POLICY "public_read_published_sections" ON event_website_sections
  FOR SELECT
  USING (
    is_visible = true
    AND website_id IN (SELECT id FROM event_websites WHERE is_published = true)
  );

-- ── Function: reorder sections ────────────────────────────────
CREATE OR REPLACE FUNCTION reorder_website_sections(
  p_website_id uuid,
  p_section_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..array_length(p_section_ids, 1) LOOP
    UPDATE event_website_sections
    SET sort_order = i, updated_at = now()
    WHERE id = p_section_ids[i]
      AND website_id = p_website_id;
  END LOOP;
END;
$$;
