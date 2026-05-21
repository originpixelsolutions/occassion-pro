import { Injectable, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'

// ─── Column mapping: CSV header → DB field ────────────────────────────────────

const KNOWN_HEADERS: Record<string, string> = {
  'name': 'full_name',
  'full name': 'full_name',
  'guest name': 'full_name',
  'first name': 'first_name',
  'last name': 'last_name',
  'email': 'email',
  'email address': 'email',
  'phone': 'phone',
  'mobile': 'phone',
  'phone number': 'phone',
  'category': 'category',
  'type': 'category',
  'guest type': 'category',
  'company': 'company',
  'organisation': 'company',
  'organization': 'company',
  'designation': 'designation',
  'title': 'designation',
  'table': 'table_number',
  'table number': 'table_number',
  'meal': 'meal_preference',
  'meal preference': 'meal_preference',
  'dietary': 'dietary_notes',
  'dietary requirements': 'dietary_notes',
  'notes': 'notes',
  'rsvp': 'rsvp_status',
  'rsvp status': 'rsvp_status',
  'plus ones': 'plus_ones',
  'plus one': 'plus_ones',
  'accommodation': 'accommodation_status',
}

function autoMapHeaders(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const h of headers) {
    const key = h.trim().toLowerCase()
    if (KNOWN_HEADERS[key]) map[h] = KNOWN_HEADERS[key]
  }
  return map
}

function validateRow(row: Record<string, string>, rowNum: number): string[] {
  const errors: string[] = []
  if (!row.full_name?.trim() && !(row.first_name?.trim() || row.last_name?.trim())) {
    errors.push(`Row ${rowNum}: Guest name is required`)
  }
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push(`Row ${rowNum}: Invalid email format: ${row.email}`)
  }
  return errors
}

function normaliseRow(raw: Record<string, string>, mapping: Record<string, string>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [csvCol, dbCol] of Object.entries(mapping)) {
    const val = raw[csvCol]?.trim()
    if (val === undefined || val === '') continue
    switch (dbCol) {
      case 'plus_ones': out[dbCol] = parseInt(val, 10) || 0; break
      case 'rsvp_status': out[dbCol] = val.toLowerCase(); break
      case 'category': out[dbCol] = val.toLowerCase(); break
      case 'meal_preference': out[dbCol] = val.toLowerCase().replace(/\s+/g, '_'); break
      default: out[dbCol] = val
    }
  }
  // Combine first/last if full_name wasn't directly mapped
  if (!out.full_name && (out.first_name || out.last_name)) {
    out.full_name = `${out.first_name ?? ''} ${out.last_name ?? ''}`.trim()
  }
  return out
}

@Injectable()
export class GuestImportService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Preview: parse CSV rows + auto-detect column mapping, return first 10 rows */
  previewImport(headers: string[], rows: Record<string, string>[]): {
    suggestedMapping: Record<string, string>
    preview: Record<string, any>[]
    totalRows: number
  } {
    const suggestedMapping = autoMapHeaders(headers)
    const preview = rows.slice(0, 10).map(r => normaliseRow(r, suggestedMapping))
    return { suggestedMapping, preview, totalRows: rows.length }
  }

  /** Execute import: validate → deduplicate → insert → log batch */
  async executeImport(
    eventId: string,
    tenantId: string,
    filename: string,
    headers: string[],
    rows: Record<string, string>[],
    columnMapping: Record<string, string>,
    userId: string,
    token: string,
  ) {
    const db = this.supabase.forRequest(token)

    // 1. Fetch existing guest emails for this event (for dedup)
    const { data: existingGuests } = await db.from('guests')
      .select('email').eq('event_id', eventId).eq('tenant_id', tenantId)
    const existingEmails = new Set((existingGuests ?? []).map(g => g.email?.toLowerCase()).filter(Boolean))

    // 2. Create import batch record
    const { data: batch } = await db.from('guest_import_batches').insert({
      tenant_id: tenantId,
      event_id: eventId,
      imported_by: userId,
      filename,
      total_rows: rows.length,
      status: 'processing',
      column_mapping: columnMapping,
    }).select().single()

    const validRows: any[] = []
    const errorLog: any[] = []
    let skipped = 0
    let duplicates = 0

    // 3. Validate + normalise
    for (let i = 0; i < rows.length; i++) {
      const normalised = normaliseRow(rows[i], columnMapping)
      const errors = validateRow(normalised, i + 2) // +2: header is row 1

      if (errors.length) {
        errorLog.push({ row: i + 2, errors })
        continue
      }

      const email = normalised.email?.toLowerCase()
      if (email && existingEmails.has(email)) {
        duplicates++
        continue
      }

      if (email) existingEmails.add(email)
      validRows.push({
        ...normalised,
        event_id: eventId,
        tenant_id: tenantId,
        source: 'imported',
        rsvp_status: normalised.rsvp_status ?? 'pending',
      })
    }

    // 4. Bulk insert valid rows
    let imported = 0
    if (validRows.length) {
      const { data: inserted, error: insertError } = await db.from('guests')
        .insert(validRows).select('id')
      if (insertError) {
        // Update batch as failed
        await db.from('guest_import_batches').update({
          status: 'failed',
          error_log: [{ error: insertError.message }],
          completed_at: new Date().toISOString(),
        }).eq('id', batch!.id)
        throw new Error(insertError.message)
      }
      imported = inserted?.length ?? 0
    }

    // 5. Update batch record
    const batchResult = {
      imported_count: imported,
      skipped_count: skipped,
      failed_count: errorLog.length,
      duplicate_count: duplicates,
      status: 'completed',
      error_log: errorLog,
      completed_at: new Date().toISOString(),
    }
    await db.from('guest_import_batches')
      .update(batchResult).eq('id', batch!.id)

    return {
      batch_id: batch!.id,
      total: rows.length,
      imported,
      skipped,
      duplicates,
      failed: errorLog.length,
      errors: errorLog,
    }
  }

  async listBatches(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)
    const { data, error } = await db.from('guest_import_batches')
      .select('*').eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  /** Generate CSV template with all standard columns */
  generateTemplate(): string {
    const headers = [
      'full_name', 'email', 'phone', 'company', 'designation',
      'category', 'rsvp_status', 'meal_preference', 'dietary_notes',
      'table_number', 'plus_ones', 'notes',
    ]
    const example = [
      'Rahul Sharma', 'rahul@example.com', '+91 98765 43210',
      'Acme Corp', 'CEO', 'vip', 'confirmed', 'veg', '',
      'Table 1', '1', '',
    ]
    return [headers.join(','), example.join(',')].join('\n')
  }
}
