import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'
import { ConfigService } from '@nestjs/config'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateWebsiteDto {
  slug: string
  title?: string
  description?: string
  favicon_url?: string
  seo_title?: string
  seo_description?: string
  seo_keywords?: string
  og_image_url?: string
  ga_tracking_id?: string
  fb_pixel_id?: string
  custom_css?: string
  custom_js?: string
  primary_color?: string
  font_family?: string
  dark_mode?: boolean
  custom_domain?: string
}

export interface SectionDto {
  section_type: string
  title?: string
  is_visible?: boolean
  sort_order?: number
  content?: Record<string, any>
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class WebsiteBuilderService {
  private supabase

  constructor(private readonly config: ConfigService) {
    this.supabase = createClient(
      config.get<string>('SUPABASE_URL')!,
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    )
  }

  private userClient(token: string) {
    return createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Website CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  async getWebsite(eventId: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('event_websites')
      .select('*, event_website_sections(*)')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('sort_order', { referencedTable: 'event_website_sections', ascending: true })
      .single()

    if (error && error.code !== 'PGRST116') throw new BadRequestException(error.message)
    return data ?? null
  }

  async createWebsite(
    eventId: string,
    dto: CreateWebsiteDto,
    tenantId: string,
    userId: string,
    token: string,
  ) {
    const db = this.userClient(token)

    // Check slug uniqueness
    const { data: existing } = await db
      .from('event_websites')
      .select('id')
      .eq('slug', dto.slug)
      .single()

    if (existing) throw new ConflictException(`Slug "${dto.slug}" is already taken`)

    const { data, error } = await db
      .from('event_websites')
      .insert({
        tenant_id: tenantId,
        event_id: eventId,
        created_by: userId,
        ...dto,
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateWebsite(
    websiteId: string,
    dto: Partial<CreateWebsiteDto>,
    tenantId: string,
    token: string,
  ) {
    const db = this.userClient(token)

    // Slug uniqueness check if slug is being changed
    if (dto.slug) {
      const { data: existing } = await db
        .from('event_websites')
        .select('id')
        .eq('slug', dto.slug)
        .neq('id', websiteId)
        .single()
      if (existing) throw new ConflictException(`Slug "${dto.slug}" is already taken`)
    }

    const { data, error } = await db
      .from('event_websites')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', websiteId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Website not found')
    return data
  }

  async deleteWebsite(websiteId: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { error } = await db
      .from('event_websites')
      .delete()
      .eq('id', websiteId)
      .eq('tenant_id', tenantId)

    if (error) throw new BadRequestException(error.message)
    return { deleted: true }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Publish / Unpublish
  // ─────────────────────────────────────────────────────────────────────────────

  async publishWebsite(websiteId: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('event_websites')
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', websiteId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Website not found')
    return data
  }

  async unpublishWebsite(websiteId: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('event_websites')
      .update({
        is_published: false,
        unpublished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', websiteId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Website not found')
    return data
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Slug availability check
  // ─────────────────────────────────────────────────────────────────────────────

  async checkSlug(slug: string) {
    const { data } = await this.supabase
      .from('event_websites')
      .select('id')
      .eq('slug', slug)
      .single()
    return { slug, available: !data }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public website render (no auth)
  // ─────────────────────────────────────────────────────────────────────────────

  async getPublishedWebsite(slug: string) {
    const { data, error } = await this.supabase
      .from('event_websites')
      .select(`
        *,
        events ( name, start_date, end_date, location, cover_image_url ),
        event_website_sections (*)
      `)
      .eq('slug', slug)
      .eq('is_published', true)
      .order('sort_order', { referencedTable: 'event_website_sections', ascending: true })
      .single()

    if (error || !data) throw new NotFoundException('Website not found or not published')
    return data
  }

  async getPublishedWebsiteByDomain(domain: string) {
    const { data, error } = await this.supabase
      .from('event_websites')
      .select(`
        *,
        events ( name, start_date, end_date, location, cover_image_url ),
        event_website_sections (*)
      `)
      .eq('custom_domain', domain)
      .eq('is_published', true)
      .order('sort_order', { referencedTable: 'event_website_sections', ascending: true })
      .single()

    if (error || !data) throw new NotFoundException('Website not found')
    return data
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Section CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  async addSection(websiteId: string, dto: SectionDto, tenantId: string, token: string) {
    const db = this.userClient(token)

    // Get current max sort_order
    const { data: existing } = await db
      .from('event_website_sections')
      .select('sort_order')
      .eq('website_id', websiteId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextOrder = (existing?.sort_order ?? 0) + 1

    const { data, error } = await db
      .from('event_website_sections')
      .insert({
        website_id: websiteId,
        tenant_id: tenantId,
        section_type: dto.section_type,
        title: dto.title ?? this.defaultTitle(dto.section_type),
        is_visible: dto.is_visible ?? true,
        sort_order: dto.sort_order ?? nextOrder,
        content: dto.content ?? this.defaultContent(dto.section_type),
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateSection(
    sectionId: string,
    dto: Partial<SectionDto>,
    tenantId: string,
    token: string,
  ) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('event_website_sections')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', sectionId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Section not found')
    return data
  }

  async deleteSection(sectionId: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { error } = await db
      .from('event_website_sections')
      .delete()
      .eq('id', sectionId)
      .eq('tenant_id', tenantId)

    if (error) throw new BadRequestException(error.message)
    return { deleted: true }
  }

  async reorderSections(websiteId: string, sectionIds: string[], tenantId: string, token: string) {
    // Verify website belongs to tenant
    const db = this.userClient(token)
    const { data: website } = await db
      .from('event_websites')
      .select('id')
      .eq('id', websiteId)
      .eq('tenant_id', tenantId)
      .single()

    if (!website) throw new NotFoundException('Website not found')

    await this.supabase.rpc('reorder_website_sections', {
      p_website_id: websiteId,
      p_section_ids: sectionIds,
    })

    return { reordered: true, count: sectionIds.length }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private defaultTitle(sectionType: string): string {
    const titles: Record<string, string> = {
      hero:         'Welcome',
      about:        'About the Event',
      schedule:     'Schedule',
      speakers:     'Speakers',
      sponsors:     'Our Sponsors',
      faq:          'Frequently Asked Questions',
      gallery:      'Gallery',
      map:          'Venue',
      countdown:    'Event Starts In',
      registration: 'Register Now',
      custom_html:  'Custom Section',
    }
    return titles[sectionType] ?? sectionType
  }

  private defaultContent(sectionType: string): Record<string, any> {
    const defaults: Record<string, any> = {
      hero:         { headline: 'Welcome to our Event', subheadline: '', overlay_opacity: 0.5 },
      about:        { body_html: '<p>Tell your story here.</p>', layout: 'centered' },
      schedule:     { days: [] },
      speakers:     { items: [] },
      sponsors:     { tiers: [{ name: 'Gold', items: [] }, { name: 'Silver', items: [] }] },
      faq:          { items: [{ question: 'How do I register?', answer: 'Click the Register button above.' }] },
      gallery:      { images: [], layout: 'grid' },
      map:          { address: '', iframe_height: 400 },
      countdown:    { message_before: 'Event starts in', message_after: 'Event has started!', show_seconds: true },
      registration: { button_label: 'Register Now' },
      custom_html:  { html: '', css: '' },
    }
    return defaults[sectionType] ?? {}
  }
}
