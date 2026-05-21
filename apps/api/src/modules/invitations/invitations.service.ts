import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

export interface InvitationTemplate {
  id: string
  tenant_id: string | null
  name: string
  theme_slug: string
  thumbnail_url: string | null
  config: Record<string, unknown>
  is_system: boolean
  created_at: string
}

export interface EventInvitation {
  id: string
  event_id: string
  template_id: string
  custom_config: Record<string, unknown>
  is_published: boolean
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  template?: InvitationTemplate
}

export interface GuestInvitationLink {
  id: string
  event_id: string
  guest_id: string
  invitation_id: string
  short_link_id: string | null
  personalized_message: string | null
  is_opened: boolean
  opened_at: string | null
  open_count: number
  created_at: string
  short_link?: { code: string; destination_url: string; click_count: number }
  guest?: { full_name: string; email?: string; phone?: string }
}

export interface DeliveryStats {
  total_guests: number
  links_generated: number
  opened: number
  rsvp_responded: number
  delivery_rate: number
  open_rate: number
}

@Injectable()
export class InvitationsService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Templates ─────────────────────────────────────────────

  async listTemplates(tenantId: string): Promise<InvitationTemplate[]> {
    const { data, error } = await this.supabase
      .admin()
      .from('invitation_templates')
      .select('*')
      .or(`is_system.eq.true,tenant_id.eq.${tenantId}`)
      .order('is_system', { ascending: false })
      .order('name')

    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async getTemplate(id: string): Promise<InvitationTemplate> {
    const { data, error } = await this.supabase
      .admin()
      .from('invitation_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) throw new NotFoundException('Template not found')
    return data
  }

  // ── Event Invitation ──────────────────────────────────────

  async getEventInvitation(eventId: string): Promise<EventInvitation | null> {
    const { data, error } = await this.supabase
      .admin()
      .from('event_invitations')
      .select(`*, template:invitation_templates(*)`)
      .eq('event_id', eventId)
      .maybeSingle()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async createOrUpdateInvitation(
    eventId: string,
    dto: { templateId: string; customConfig?: Record<string, unknown> },
    userId: string,
  ): Promise<EventInvitation> {
    const { data, error } = await this.supabase
      .admin()
      .from('event_invitations')
      .upsert(
        {
          event_id: eventId,
          template_id: dto.templateId,
          custom_config: dto.customConfig ?? {},
          created_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id' },
      )
      .select(`*, template:invitation_templates(*)`)
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateCustomConfig(
    eventId: string,
    customConfig: Record<string, unknown>,
  ): Promise<EventInvitation> {
    const { data, error } = await this.supabase
      .admin()
      .from('event_invitations')
      .update({ custom_config: customConfig, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .select(`*, template:invitation_templates(*)`)
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async publishInvitation(eventId: string): Promise<EventInvitation> {
    const { data, error } = await this.supabase
      .admin()
      .from('event_invitations')
      .update({ is_published: true, published_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Guest Invitation Links ────────────────────────────────

  async generateGuestLinks(
    eventId: string,
    guestIds: string[] | 'all',
  ): Promise<{ created: number; links: GuestInvitationLink[] }> {
    // Get the event invitation
    const invitation = await this.getEventInvitation(eventId)
    if (!invitation) throw new NotFoundException('Event invitation not configured. Please create an invitation first.')
    if (!invitation.is_published) throw new BadRequestException('Invitation must be published before generating links.')

    // Resolve guestIds
    let targetGuestIds: string[]
    if (guestIds === 'all') {
      const { data: guests } = await this.supabase
        .admin()
        .from('guests')
        .select('id')
        .eq('event_id', eventId)

      targetGuestIds = (guests ?? []).map((g: { id: string }) => g.id)
    } else {
      targetGuestIds = guestIds
    }

    if (targetGuestIds.length === 0) return { created: 0, links: [] }

    // Find guests that already have links
    const { data: existing } = await this.supabase
      .admin()
      .from('guest_invitation_links')
      .select('guest_id')
      .eq('event_id', eventId)
      .in('guest_id', targetGuestIds)

    const existingIds = new Set((existing ?? []).map((e: { guest_id: string }) => e.guest_id))
    const newGuestIds = targetGuestIds.filter(id => !existingIds.has(id))

    if (newGuestIds.length === 0) {
      // All already have links — return existing
      const { data: links } = await this.supabase
        .admin()
        .from('guest_invitation_links')
        .select(`*, short_link:short_links(code,destination_url,click_count), guest:guests(full_name,email,phone)`)
        .eq('event_id', eventId)
        .in('guest_id', targetGuestIds)

      return { created: 0, links: links ?? [] }
    }

    // Insert new links — trigger will auto-create short_links
    const rows = newGuestIds.map(guestId => ({
      event_id: eventId,
      guest_id: guestId,
      invitation_id: invitation.id,
    }))

    const { data: inserted, error } = await this.supabase
      .admin()
      .from('guest_invitation_links')
      .insert(rows)
      .select(`*, short_link:short_links(code,destination_url,click_count), guest:guests(full_name,email,phone)`)

    if (error) throw new BadRequestException(error.message)
    return { created: newGuestIds.length, links: inserted ?? [] }
  }

  async getGuestInvitationLink(
    guestId: string,
    eventId: string,
  ): Promise<GuestInvitationLink | null> {
    const { data } = await this.supabase
      .admin()
      .from('guest_invitation_links')
      .select(`*, short_link:short_links(code,destination_url,click_count), guest:guests(full_name,email,phone)`)
      .eq('guest_id', guestId)
      .eq('event_id', eventId)
      .maybeSingle()

    return data
  }

  async getInvitationByShortCode(shortCode: string): Promise<{
    invitation: EventInvitation
    guestLink: GuestInvitationLink
    event: Record<string, unknown>
  } | null> {
    // Resolve short link
    const { data: shortLink } = await this.supabase
      .admin()
      .from('short_links')
      .select('*')
      .eq('code', shortCode)
      .eq('link_type', 'invitation')
      .single()

    if (!shortLink) return null

    // Get guest invitation link
    const { data: guestLink } = await this.supabase
      .admin()
      .from('guest_invitation_links')
      .select(`
        *,
        guest:guests(id, full_name, email, phone, category),
        invitation:event_invitations!inner(
          *,
          template:invitation_templates(*)
        )
      `)
      .eq('short_link_id', shortLink.id)
      .single()

    if (!guestLink) return null

    // Get event details
    const { data: event } = await this.supabase
      .admin()
      .from('events')
      .select(`
        id, title, description, start_date, end_date, timezone,
        venue_name, venue_address, cover_image_url, tenant_id,
        workspace:workspaces(name, logo_url)
      `)
      .eq('id', guestLink.event_id)
      .single()

    return {
      invitation: guestLink.invitation,
      guestLink,
      event: event ?? {},
    }
  }

  async trackOpen(shortCode: string): Promise<void> {
    // Find short link
    const { data: shortLink } = await this.supabase
      .admin()
      .from('short_links')
      .select('id')
      .eq('code', shortCode)
      .single()

    if (!shortLink) return

    // Update guest invitation link
    await this.supabase
      .admin()
      .from('guest_invitation_links')
      .update({
        is_opened: true,
        opened_at: new Date().toISOString(),
        open_count: this.supabase.serviceClient.rpc as unknown as number, // handled below
      })
      .eq('short_link_id', shortLink.id)

    // Use raw increment
    await this.supabase.serviceClient.rpc('increment_invitation_open', { p_short_link_id: shortLink.id }).catch(() => {
      // Fallback: fetch + increment
      this.supabase
        .admin()
        .from('guest_invitation_links')
        .select('open_count')
        .eq('short_link_id', shortLink.id)
        .single()
        .then(({ data }) => {
          if (data) {
            this.supabase
              .admin()
              .from('guest_invitation_links')
              .update({
                is_opened: true,
                opened_at: new Date().toISOString(),
                open_count: (data.open_count ?? 0) + 1,
              })
              .eq('short_link_id', shortLink.id)
              .then()
          }
        })
        .catch(() => {})
    })
  }

  async trackOpenDirect(shortCode: string): Promise<void> {
    const { data: shortLink } = await this.supabase
      .admin()
      .from('short_links')
      .select('id')
      .eq('code', shortCode)
      .eq('link_type', 'invitation')
      .maybeSingle()

    if (!shortLink) return

    const { data: link } = await this.supabase
      .admin()
      .from('guest_invitation_links')
      .select('open_count')
      .eq('short_link_id', shortLink.id)
      .maybeSingle()

    if (!link) return

    await this.supabase
      .admin()
      .from('guest_invitation_links')
      .update({
        is_opened: true,
        opened_at: new Date().toISOString(),
        open_count: (link.open_count ?? 0) + 1,
      })
      .eq('short_link_id', shortLink.id)
  }

  // ── Send Invitations ──────────────────────────────────────

  async sendInvitations(
    eventId: string,
    guestIds: string[] | 'all',
    channels: Array<'whatsapp' | 'sms' | 'email'>,
  ): Promise<{ sent: number; failed: number; results: Array<{ guestId: string; status: string }> }> {
    // Ensure links exist
    await this.generateGuestLinks(eventId, guestIds)

    // Get all guest links for this batch
    let query = this.supabase
      .admin()
      .from('guest_invitation_links')
      .select(`
        *,
        short_link:short_links(code,destination_url),
        guest:guests(id, full_name, email, phone)
      `)
      .eq('event_id', eventId)

    if (guestIds !== 'all') {
      query = query.in('guest_id', guestIds)
    }

    const { data: links } = await query

    if (!links?.length) return { sent: 0, failed: 0, results: [] }

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.occasionpro.com'
    let sent = 0
    let failed = 0
    const results: Array<{ guestId: string; status: string }> = []

    for (const link of links) {
      const shortUrl = `${appBaseUrl}/i/${link.short_link?.code}`
      const guestName = link.guest?.full_name ?? 'Guest'

      try {
        // In production these would call WhatsApp/SMS/Email providers
        // For now we log and mark as sent
        const channelResults = channels.map(ch => ({ channel: ch, url: shortUrl, guest: guestName }))
        console.log('[InvitationsService] Would send via', channelResults)
        sent++
        results.push({ guestId: link.guest_id, status: 'sent' })
      } catch {
        failed++
        results.push({ guestId: link.guest_id, status: 'failed' })
      }
    }

    return { sent, failed, results }
  }

  // ── Delivery Stats ────────────────────────────────────────

  async getDeliveryStats(eventId: string): Promise<DeliveryStats> {
    const { data: guestCount } = await this.supabase
      .admin()
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)

    const { data: links } = await this.supabase
      .admin()
      .from('guest_invitation_links')
      .select('is_opened, guest_id')
      .eq('event_id', eventId)

    // Count RSVP responses from guests table
    const { data: rsvpData } = await this.supabase
      .admin()
      .from('guests')
      .select('rsvp_status')
      .eq('event_id', eventId)
      .not('rsvp_status', 'is', null)

    const totalGuests = (guestCount as unknown as { count?: number })?.count ?? 0
    const linksGenerated = links?.length ?? 0
    const opened = (links ?? []).filter((l: { is_opened: boolean }) => l.is_opened).length
    const rsvpResponded = rsvpData?.length ?? 0

    return {
      total_guests: totalGuests,
      links_generated: linksGenerated,
      opened,
      rsvp_responded: rsvpResponded,
      delivery_rate: totalGuests > 0 ? Math.round((linksGenerated / totalGuests) * 100) : 0,
      open_rate: linksGenerated > 0 ? Math.round((opened / linksGenerated) * 100) : 0,
    }
  }

  // ── RSVP (called from public invitation page) ─────────────

  async submitRsvp(
    shortCode: string,
    response: 'attending' | 'not_attending',
  ): Promise<{ success: boolean }> {
    const { data: shortLink } = await this.supabase
      .admin()
      .from('short_links')
      .select('guest_id, event_id')
      .eq('code', shortCode)
      .eq('link_type', 'invitation')
      .maybeSingle()

    if (!shortLink?.guest_id) return { success: false }

    await this.supabase
      .admin()
      .from('guests')
      .update({
        rsvp_status: response === 'attending' ? 'confirmed' : 'declined',
        rsvp_responded_at: new Date().toISOString(),
      })
      .eq('id', shortLink.guest_id)

    return { success: true }
  }
}
