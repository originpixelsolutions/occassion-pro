import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class WorkforceService {
  constructor(private readonly supabase: SupabaseService) {}

  private client(token: string) {
    return this.supabase.forRequest(token)
  }

  // ── Staff Members ──────────────────────────────────────────────────────────

  async listStaff(tenantId: string, token: string, filters: {
    status?: string
    department?: string
    role_id?: string
    search?: string
  } = {}) {
    const db = this.client(token)
    let query = db
      .from('staff_members')
      .select(`
        *,
        role:staff_roles(id, name, code, color, department)
      `)
      .eq('tenant_id', tenantId)
      .order('full_name')

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.department) query = query.eq('department', filters.department)
    if (filters.role_id) query = query.eq('role_id', filters.role_id)
    if (filters.search) {
      query = query.or(
        `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,employee_code.ilike.%${filters.search}%`
      )
    }

    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async getStaffMember(id: string, tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('staff_members')
      .select(`
        *,
        role:staff_roles(*),
        assignments:shift_assignments(
          id, status, check_in_time, check_out_time, performance_rating, total_pay,
          shift:shifts(title, shift_date, start_time, end_time, location,
            event:events(id, name))
        ),
        reviews:staff_performance_reviews(*)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) throw new NotFoundException('Staff member not found')
    return data
  }

  async upsertStaffMember(dto: any, tenantId: string, token: string) {
    const payload = { ...dto, tenant_id: tenantId, updated_at: new Date().toISOString() }
    const { data, error } = await this.client(token)
      .from('staff_members')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateStaffStatus(id: string, status: string, tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('staff_members')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Staff Roles ────────────────────────────────────────────────────────────

  async listRoles(tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('staff_roles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name')

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async upsertRole(dto: any, tenantId: string, token: string) {
    const payload = { ...dto, tenant_id: tenantId }
    const { data, error } = await this.client(token)
      .from('staff_roles')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Staffing Plans ─────────────────────────────────────────────────────────

  async getOrCreatePlan(eventId: string, tenantId: string, token: string) {
    const db = this.client(token)

    // Try to get existing plan
    const { data: existing } = await db
      .from('event_staffing_plans')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (existing) return existing

    // Create new plan
    const { data, error } = await db
      .from('event_staffing_plans')
      .insert({ event_id: eventId, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updatePlan(planId: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('event_staffing_plans')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', planId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Shifts ─────────────────────────────────────────────────────────────────

  async getEventShifts(eventId: string, tenantId: string, token: string) {
    const db = this.client(token)

    const [shiftsResult, assignmentsResult] = await Promise.all([
      db
        .from('shifts')
        .select(`
          *,
          role:staff_roles(id, name, code, color)
        `)
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId)
        .order('shift_date')
        .order('start_time'),
      db
        .from('shift_assignments')
        .select(`
          id, status, shift_id, confirmed_at, check_in_time, check_out_time,
          staff:staff_members(id, full_name, photo_url, employee_code,
            role:staff_roles(name, color))
        `)
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId),
    ])

    if (shiftsResult.error) throw new BadRequestException(shiftsResult.error.message)

    // Attach assignments to shifts
    const assignmentsByShift: Record<string, any[]> = {}
    for (const a of assignmentsResult.data || []) {
      if (!assignmentsByShift[a.shift_id]) assignmentsByShift[a.shift_id] = []
      assignmentsByShift[a.shift_id].push(a)
    }

    const shifts = (shiftsResult.data || []).map(s => ({
      ...s,
      assignments: assignmentsByShift[s.id] || [],
    }))

    // Group by date
    const byDate: Record<string, any[]> = {}
    for (const shift of shifts) {
      const key = shift.shift_date
      if (!byDate[key]) byDate[key] = []
      byDate[key].push(shift)
    }

    return { shifts, by_date: byDate }
  }

  async upsertShift(dto: any, eventId: string, tenantId: string, token: string) {
    // Auto-get/create plan
    const plan = await this.getOrCreatePlan(eventId, tenantId, token)

    const payload = {
      ...dto,
      event_id: eventId,
      tenant_id: tenantId,
      plan_id: plan.id,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await this.client(token)
      .from('shifts')
      .upsert(payload, { onConflict: 'id' })
      .select(`*, role:staff_roles(id, name, code, color)`)
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteShift(shiftId: string, tenantId: string, token: string) {
    // Check no confirmed assignments
    const { data: assignments } = await this.client(token)
      .from('shift_assignments')
      .select('id, status')
      .eq('shift_id', shiftId)
      .in('status', ['confirmed', 'completed'])

    if (assignments && assignments.length > 0) {
      throw new BadRequestException('Cannot delete shift with confirmed or completed assignments')
    }

    const { error } = await this.client(token)
      .from('shifts')
      .delete()
      .eq('id', shiftId)
      .eq('tenant_id', tenantId)

    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ── Assignments ────────────────────────────────────────────────────────────

  async assignStaff(shiftId: string, staffIds: string[], tenantId: string, token: string, assignedBy: string) {
    const db = this.client(token)

    // Validate shift exists
    const { data: shift, error: shiftErr } = await db
      .from('shifts')
      .select('id, event_id, slots_required, slots_filled, title, shift_date, start_time, end_time')
      .eq('id', shiftId)
      .eq('tenant_id', tenantId)
      .single()

    if (shiftErr || !shift) throw new NotFoundException('Shift not found')

    // Check for capacity
    const remaining = shift.slots_required - shift.slots_filled
    if (staffIds.length > remaining) {
      throw new BadRequestException(`Shift only has ${remaining} open slot(s)`)
    }

    // Check for conflicts (same staff already assigned to overlapping shift on same day)
    const { data: existingAssignments } = await db
      .from('shift_assignments')
      .select('staff_id')
      .eq('shift_id', shiftId)
      .in('staff_id', staffIds)
      .not('status', 'eq', 'declined')

    const alreadyAssigned = new Set((existingAssignments || []).map(a => a.staff_id))
    const newStaffIds = staffIds.filter(id => !alreadyAssigned.has(id))

    if (newStaffIds.length === 0) {
      return { assigned: 0, message: 'All staff already assigned to this shift' }
    }

    const inserts = newStaffIds.map(staff_id => ({
      shift_id: shiftId,
      staff_id,
      event_id: shift.event_id,
      tenant_id: tenantId,
      assigned_by: assignedBy,
    }))

    const { data, error } = await db
      .from('shift_assignments')
      .insert(inserts)
      .select()

    if (error) throw new BadRequestException(error.message)
    return { assigned: data?.length || 0, assignments: data }
  }

  async updateAssignment(id: string, dto: any, tenantId: string, token: string) {
    const payload = { ...dto, updated_at: new Date().toISOString() }

    // Auto-calculate total_pay if hours provided
    if (dto.actual_hours !== undefined) {
      const { data: asgn } = await this.client(token)
        .from('shift_assignments')
        .select('staff:staff_members(base_hourly_rate, overtime_multiplier)')
        .eq('id', id)
        .single()

      const staff = (asgn as any)?.staff
      if (staff?.base_hourly_rate) {
        const baseHrs = Math.min(dto.actual_hours, 8)
        const otHrs = Math.max(0, (dto.overtime_hours || 0))
        payload.base_pay = baseHrs * staff.base_hourly_rate
        payload.overtime_pay = otHrs * staff.base_hourly_rate * (staff.overtime_multiplier || 1.5)
        payload.total_pay = payload.base_pay + payload.overtime_pay + (dto.bonus_pay || 0)
      }
    }

    const { data, error } = await this.client(token)
      .from('shift_assignments')
      .update(payload)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async confirmAssignment(id: string, channel: string, tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('shift_assignments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmation_channel: channel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async checkInStaff(assignmentId: string, tenantId: string, token: string, recordedBy: string) {
    const db = this.client(token)

    // Get assignment + shift times
    const { data: asgn } = await db
      .from('shift_assignments')
      .select('id, staff_id, event_id, shift:shifts(start_time, shift_date)')
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId)
      .single()

    if (!asgn) throw new NotFoundException('Assignment not found')

    const now = new Date().toISOString()

    const [updateResult, logResult] = await Promise.all([
      db
        .from('shift_assignments')
        .update({ check_in_time: now, status: 'confirmed', updated_at: now })
        .eq('id', assignmentId)
        .eq('tenant_id', tenantId)
        .select()
        .single(),
      db
        .from('staff_attendance_log')
        .insert({
          tenant_id: tenantId,
          staff_id: (asgn as any).staff_id,
          event_id: (asgn as any).event_id,
          assignment_id: assignmentId,
          action: 'check_in',
          recorded_by: recordedBy,
        }),
    ])

    if (updateResult.error) throw new BadRequestException(updateResult.error.message)
    return updateResult.data
  }

  async checkOutStaff(assignmentId: string, tenantId: string, token: string) {
    const db = this.client(token)

    const { data: asgn } = await db
      .from('shift_assignments')
      .select('id, staff_id, event_id, check_in_time, shift:shifts(start_time, end_time, break_minutes)')
      .eq('id', assignmentId)
      .eq('tenant_id', tenantId)
      .single()

    if (!asgn) throw new NotFoundException('Assignment not found')

    const now = new Date()
    const checkIn = new Date((asgn as any).check_in_time || now)
    const diffMs = now.getTime() - checkIn.getTime()
    const diffHrs = diffMs / (1000 * 60 * 60)
    const breakHrs = ((asgn as any).shift?.break_minutes || 0) / 60
    const actualHours = Math.max(0, diffHrs - breakHrs)
    const standardHrs = 8
    const overtimeHrs = Math.max(0, actualHours - standardHrs)

    const [updateResult] = await Promise.all([
      db
        .from('shift_assignments')
        .update({
          check_out_time: now.toISOString(),
          actual_hours: Math.round(actualHours * 100) / 100,
          overtime_hours: Math.round(overtimeHrs * 100) / 100,
          status: 'completed',
          updated_at: now.toISOString(),
        })
        .eq('id', assignmentId)
        .eq('tenant_id', tenantId)
        .select()
        .single(),
      db
        .from('staff_attendance_log')
        .insert({
          tenant_id: tenantId,
          staff_id: (asgn as any).staff_id,
          event_id: (asgn as any).event_id,
          assignment_id: assignmentId,
          action: 'check_out',
        }),
    ])

    if (updateResult.error) throw new BadRequestException(updateResult.error.message)
    return updateResult.data
  }

  async bulkAssign(eventId: string, dto: { shift_id: string; staff_ids: string[] }[], tenantId: string, token: string, assignedBy: string) {
    const results = []
    for (const item of dto) {
      try {
        const result = await this.assignStaff(item.shift_id, item.staff_ids, tenantId, token, assignedBy)
        results.push({ shift_id: item.shift_id, ...result })
      } catch (e) {
        results.push({ shift_id: item.shift_id, error: e.message })
      }
    }
    return results
  }

  // ── Dashboard & Analytics ──────────────────────────────────────────────────

  async getEventWorkforceDashboard(eventId: string, tenantId: string, token: string) {
    const db = this.client(token)

    const [planResult, shiftsResult, assignmentsResult, attendanceResult] = await Promise.all([
      db
        .from('event_staffing_plans')
        .select('*')
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      db
        .from('shifts')
        .select(`*, role:staff_roles(id, name, code, color)`)
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId)
        .order('shift_date')
        .order('start_time'),
      db
        .from('shift_assignments')
        .select(`
          id, status, check_in_time, check_out_time, actual_hours, overtime_hours, total_pay,
          staff:staff_members(id, full_name, photo_url, employee_code,
            role:staff_roles(name, color)),
          shift:shifts(id, title, shift_date, start_time, end_time, location, priority,
            role:staff_roles(name, code, color))
        `)
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId),
      db
        .from('staff_attendance_log')
        .select('*')
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId)
        .order('timestamp', { ascending: false })
        .limit(50),
    ])

    const shifts = shiftsResult.data || []
    const assignments = assignmentsResult.data || []

    // Stats
    const totalShifts = shifts.length
    const totalSlots = shifts.reduce((s, sh) => s + sh.slots_required, 0)
    const filledSlots = shifts.reduce((s, sh) => s + sh.slots_filled, 0)
    const criticalUnfilled = shifts.filter(
      s => s.priority === 'critical' && s.slots_filled < s.slots_required
    )

    const statusCounts = assignments.reduce((acc: Record<string, number>, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1
      return acc
    }, {})

    const checkedIn = assignments.filter(a => a.check_in_time && !a.check_out_time)
    const totalPayroll = assignments.reduce((s, a) => s + (a.total_pay || 0), 0)
    const totalHours = assignments.reduce((s, a) => s + (a.actual_hours || 0), 0)

    // Department breakdown
    const deptMap: Record<string, { total: number; filled: number }> = {}
    for (const shift of shifts) {
      const dept = shift.role?.department || shift.department || 'General'
      if (!deptMap[dept]) deptMap[dept] = { total: 0, filled: 0 }
      deptMap[dept].total += shift.slots_required
      deptMap[dept].filled += shift.slots_filled
    }

    return {
      plan: planResult.data,
      stats: {
        total_shifts: totalShifts,
        total_slots: totalSlots,
        filled_slots: filledSlots,
        fill_rate: totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0,
        critical_unfilled: criticalUnfilled.length,
        currently_checked_in: checkedIn.length,
        status_breakdown: statusCounts,
        total_payroll: Math.round(totalPayroll * 100) / 100,
        total_hours: Math.round(totalHours * 100) / 100,
      },
      shifts,
      assignments,
      by_department: deptMap,
      recent_attendance: attendanceResult.data || [],
    }
  }

  async getLiveStaffStatus(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('shift_assignments')
      .select(`
        id, status, check_in_time, check_out_time,
        staff:staff_members(id, full_name, photo_url, phone),
        shift:shifts(id, title, location, start_time, end_time, priority,
          role:staff_roles(name, color))
      `)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .in('status', ['confirmed', 'completed'])
      .order('check_in_time', { ascending: false })

    if (error) throw new BadRequestException(error.message)

    const onSite = (data || []).filter(a => a.check_in_time && !a.check_out_time)
    const departed = (data || []).filter(a => a.check_out_time)
    const expected = (data || []).filter(a => !a.check_in_time)

    return {
      on_site: onSite,
      departed,
      expected,
      counts: {
        on_site: onSite.length,
        departed: departed.length,
        expected: expected.length,
        total: (data || []).length,
      },
    }
  }

  async getTenantWorkforceStats(tenantId: string, token: string) {
    const db = this.client(token)

    const [staffResult, rolesResult, topResult] = await Promise.all([
      db
        .from('staff_members')
        .select('id, status, department, employment_type, total_events, rating')
        .eq('tenant_id', tenantId),
      db
        .from('staff_roles')
        .select('id, name, code, department')
        .eq('tenant_id', tenantId)
        .eq('is_active', true),
      db
        .from('staff_members')
        .select('id, full_name, photo_url, total_events, rating, role:staff_roles(name)')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('total_events', { ascending: false })
        .limit(5),
    ])

    const staff = staffResult.data || []
    const active = staff.filter(s => s.status === 'active')
    const deptMap: Record<string, number> = {}
    const typeMap: Record<string, number> = {}

    for (const s of active) {
      const dept = s.department || 'General'
      deptMap[dept] = (deptMap[dept] || 0) + 1
      typeMap[s.employment_type] = (typeMap[s.employment_type] || 0) + 1
    }

    return {
      total_staff: staff.length,
      active_staff: active.length,
      on_leave: staff.filter(s => s.status === 'on_leave').length,
      total_roles: (rolesResult.data || []).length,
      avg_rating: active.length > 0
        ? Math.round((active.reduce((s, m) => s + (m.rating || 0), 0) / active.length) * 10) / 10
        : 0,
      by_department: deptMap,
      by_employment_type: typeMap,
      top_performers: topResult.data || [],
    }
  }

  // ── Availability ───────────────────────────────────────────────────────────

  async getStaffAvailability(eventId: string, tenantId: string, token: string) {
    const db = this.client(token)

    // Get event dates
    const { data: event } = await db
      .from('events')
      .select('id, name, start_date, end_date')
      .eq('id', eventId)
      .single()

    if (!event) throw new NotFoundException('Event not found')

    // Get all active staff with their unavailability during event period
    const [staffResult, unavailResult, existingAssignResult] = await Promise.all([
      db
        .from('staff_members')
        .select('id, full_name, employee_code, photo_url, role:staff_roles(name, color), skills')
        .eq('tenant_id', tenantId)
        .eq('status', 'active'),
      db
        .from('staff_unavailability')
        .select('staff_id, from_date, to_date, reason')
        .eq('tenant_id', tenantId)
        .lte('from_date', event.end_date)
        .gte('to_date', event.start_date),
      db
        .from('shift_assignments')
        .select('staff_id, status, shift:shifts(shift_date, start_time, end_time)')
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId)
        .not('status', 'eq', 'declined'),
    ])

    const unavailByStaff = new Set(
      (unavailResult.data || []).map(u => u.staff_id)
    )
    const assignedByStaff = new Set(
      (existingAssignResult.data || []).map(a => a.staff_id)
    )

    return (staffResult.data || []).map(staff => ({
      ...staff,
      is_unavailable: unavailByStaff.has(staff.id),
      is_assigned: assignedByStaff.has(staff.id),
      availability_status: unavailByStaff.has(staff.id)
        ? 'unavailable'
        : assignedByStaff.has(staff.id)
          ? 'assigned'
          : 'available',
    }))
  }

  async setUnavailability(dto: any, tenantId: string, token: string) {
    const payload = { ...dto, tenant_id: tenantId }
    const { data, error } = await this.client(token)
      .from('staff_unavailability')
      .insert(payload)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Performance & Reviews ──────────────────────────────────────────────────

  async createReview(dto: any, tenantId: string, token: string, reviewerId: string) {
    const payload = { ...dto, tenant_id: tenantId, reviewer_id: reviewerId }
    const { data, error } = await this.client(token)
      .from('staff_performance_reviews')
      .insert(payload)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Update staff avg rating
    const { data: reviews } = await this.client(token)
      .from('staff_performance_reviews')
      .select('overall_rating')
      .eq('staff_id', dto.staff_id)
      .eq('tenant_id', tenantId)

    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((s, r) => s + r.overall_rating, 0) / reviews.length
      await this.client(token)
        .from('staff_members')
        .update({ rating: Math.round(avg * 10) / 10 })
        .eq('id', dto.staff_id)
        .eq('tenant_id', tenantId)
    }

    return data
  }

  // ── Payroll ────────────────────────────────────────────────────────────────

  async getPayrollSummary(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('shift_assignments')
      .select(`
        id, actual_hours, overtime_hours, base_pay, overtime_pay, bonus_pay, total_pay, pay_processed,
        staff:staff_members(id, full_name, employee_code, base_hourly_rate),
        shift:shifts(title, shift_date, role:staff_roles(name))
      `)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')

    if (error) throw new BadRequestException(error.message)

    const rows = data || []
    return {
      assignments: rows,
      summary: {
        total_staff: new Set(rows.map(r => (r.staff as any)?.id)).size,
        total_hours: rows.reduce((s, r) => s + (r.actual_hours || 0), 0),
        total_overtime: rows.reduce((s, r) => s + (r.overtime_hours || 0), 0),
        total_base_pay: rows.reduce((s, r) => s + (r.base_pay || 0), 0),
        total_overtime_pay: rows.reduce((s, r) => s + (r.overtime_pay || 0), 0),
        total_bonus: rows.reduce((s, r) => s + (r.bonus_pay || 0), 0),
        grand_total: rows.reduce((s, r) => s + (r.total_pay || 0), 0),
        unpaid: rows.filter(r => !r.pay_processed).length,
      },
    }
  }
}
