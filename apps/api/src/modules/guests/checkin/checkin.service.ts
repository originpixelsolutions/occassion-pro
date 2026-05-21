import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { SupabaseService } from '../../../common/supabase/supabase.service'

@Injectable()
export class CheckinService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly emitter: EventEmitter2,
  ) {}

  /**
   * Check in a guest by QR code scan
   * Used by both staff and kiosk
   */
  async scanQrCode(
    qrCode: string,
    zoneId: string | undefined,
    scannedBy: string | undefined,
    isKiosk: boolean,
    deviceId: string | undefined,
    token: string,
  ) {
    const client = this.supabase.forRequest(token)

    // Find guest by QR code
    const { data: guest, error: guestError } = await client
      .from('guests')
      .select(`*, guest_categories(id, name, color, access_zones, priority)`)
      .eq('qr_code', qrCode)
      .single()

    if (guestError || !guest) {
      throw new NotFoundException('QR code not recognized')
    }

    // Check zone access permissions
    if (zoneId && guest.guest_categories?.access_zones?.length > 0) {
      const allowedZones: string[] = guest.guest_categories.access_zones
      if (allowedZones.length > 0 && !allowedZones.includes(zoneId)) {
        throw new BadRequestException('Guest does not have access to this zone')
      }
    }

    // Check if already checked in
    const { data: existingCheckin } = await client
      .from('checkin_logs')
      .select('id')
      .eq('guest_id', guest.id)
      .eq('status', 'checked_in')
      .limit(1)
      .single()

    // Log the check-in
    const { data: log, error: logError } = await client
      .from('checkin_logs')
      .insert({
        tenant_id: guest.tenant_id,
        event_id: guest.event_id,
        guest_id: guest.id,
        zone_id: zoneId ?? null,
        status: 'checked_in',
        scanned_by: scannedBy ?? null,
        is_kiosk_scan: isKiosk,
        device_id: deviceId ?? null,
      })
      .select()
      .single()

    if (logError) throw new Error(logError.message)

    // Update zone headcount via service client (bypasses RLS for counter update)
    if (zoneId) {
      await this.supabase.serviceClient
        .from('checkin_zones')
        .update({ current_count: this.supabase.serviceClient
          .from('checkin_zones')
          .select('current_count')
        })
        .eq('id', zoneId)
    }

    // Emit real-time event for badge printing trigger
    this.emitter.emit('guest.checked_in', {
      guest,
      log,
      isReentry: !!existingCheckin,
    })

    return {
      guest: {
        id: guest.id,
        full_name: guest.full_name,
        company: guest.company,
        designation: guest.designation,
        category: guest.guest_categories,
        qr_code_url: guest.qr_code_url,
      },
      log,
      isReentry: !!existingCheckin,
    }
  }

  async getLiveStats(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)

    const [totalGuests, checkedIn, zoneStats] = await Promise.all([
      client.from('guests').select('id', { count: 'exact', head: true })
        .eq('event_id', eventId).eq('tenant_id', tenantId),
      client.from('checkin_logs').select('id', { count: 'exact', head: true })
        .eq('event_id', eventId).eq('tenant_id', tenantId).eq('status', 'checked_in'),
      client.from('checkin_zones')
        .select('id, name, current_count, max_capacity')
        .eq('event_id', eventId).eq('tenant_id', tenantId).eq('is_active', true),
    ])

    return {
      total: totalGuests.count ?? 0,
      checkedIn: checkedIn.count ?? 0,
      checkInRate: totalGuests.count
        ? Math.round(((checkedIn.count ?? 0) / totalGuests.count) * 100)
        : 0,
      zones: zoneStats.data ?? [],
    }
  }
}
