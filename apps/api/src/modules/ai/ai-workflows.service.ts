import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { AiService } from './ai.service';

/**
 * AiWorkflowsService
 * High-level orchestration of AI workflows with rich event context.
 * Each method gathers full context from the database, then calls AiService.generate().
 */
@Injectable()
export class AiWorkflowsService {
  private readonly logger = new Logger(AiWorkflowsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly aiService: AiService,
  ) {}

  // ─── Proposal Generation with full lead context ──────────────────────────

  async generateProposalFromLead(
    leadId: string,
    tenantId: string,
    userId: string,
    token: string,
  ) {
    const client = this.supabase.forRequest(token);

    const { data: lead } = await client
      .from('leads')
      .select('*, lead_activities(*)')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .single();

    if (!lead) throw new NotFoundException('Lead not found');

    const prompt = `
Generate a comprehensive, professional event proposal for the following client inquiry.

PROSPECT DETAILS:
- Name: ${lead.contact_name}
- Company: ${lead.company_name ?? 'Individual'}
- Event Type: ${lead.event_type ?? 'Not specified'}
- Expected Date: ${lead.event_date ?? 'TBD'}
- Guest Count: ${lead.estimated_guests ?? 'TBD'}
- Budget Range: ${lead.budget ? `₹${(lead.budget / 100000).toFixed(1)}L` : 'Not specified'}
- Source: ${lead.source}

ACTIVITY HISTORY:
${lead.lead_activities?.map((a: any) => `- ${a.type}: ${a.notes ?? a.title}`).join('\n') ?? 'Initial inquiry'}

Please generate a formal event proposal that includes:
1. Executive Summary
2. Event Vision and Concept
3. Proposed Services and Inclusions
4. Timeline and Milestones
5. Investment Summary (with breakdown)
6. Why Choose Us (differentiators)
7. Terms and Next Steps

Use professional language appropriate for a premium event management company.
`.trim();

    return this.aiService.generate({
      feature: 'proposal_generation',
      prompt,
      context: { lead },
      tenantId,
      userId,
    });
  }

  // ─── Budget Optimization with actuals comparison ─────────────────────────

  async optimizeBudget(
    eventId: string,
    tenantId: string,
    userId: string,
    token: string,
  ) {
    const client = this.supabase.forRequest(token);

    const [budgetRes, expensesRes, vendorRes] = await Promise.all([
      client.from('event_budgets').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).single(),
      client.from('expenses').select('category, amount, description, is_approved').eq('event_id', eventId).eq('tenant_id', tenantId),
      client.from('vendor_contracts').select('vendor_id, contract_value, service_type, status').eq('event_id', eventId).eq('tenant_id', tenantId),
    ]);

    const budget = budgetRes.data;
    const expenses = expensesRes.data ?? [];
    const vendors = vendorRes.data ?? [];

    const totalSpent = expenses.reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
    const totalBudget = budget?.total_budget ?? 0;

    const prompt = `
Analyze this event budget and provide optimization recommendations.

TOTAL BUDGET: ₹${(totalBudget / 100000).toFixed(2)}L
SPENT SO FAR: ₹${(totalSpent / 100000).toFixed(2)}L (${totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0}% utilized)
REMAINING: ₹${((totalBudget - totalSpent) / 100000).toFixed(2)}L

EXPENSE BREAKDOWN BY CATEGORY:
${Object.entries(
  expenses.reduce((acc: any, e: any) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {}),
)
  .map(([cat, amt]: [string, any]) => `- ${cat}: ₹${((amt as number) / 1000).toFixed(0)}K`)
  .join('\n')}

VENDOR CONTRACTS:
${vendors.map((v: any) => `- ${v.service_type}: ₹${(v.contract_value / 1000).toFixed(0)}K (${v.status})`).join('\n') || 'None'}

BUDGET ALLOCATIONS:
${(budget?.allocations ?? []).map((a: any) => `- ${a.category}: ₹${(a.allocated_amount / 1000).toFixed(0)}K allocated`).join('\n') || 'No allocations defined'}

Please provide:
1. Overspend alerts and root causes
2. Reallocation recommendations
3. Cost-saving opportunities (with estimated savings)
4. Vendor negotiation suggestions
5. Risk of going over budget
6. Recommended adjustments for remaining spend
`.trim();

    return this.aiService.generate({
      feature: 'budget_optimization',
      prompt,
      context: { budget, expenses, vendors },
      eventId,
      tenantId,
      userId,
    });
  }

  // ─── Risk Prediction with full event context ──────────────────────────────

  async predictEventRisks(
    eventId: string,
    tenantId: string,
    userId: string,
    token: string,
  ) {
    const client = this.supabase.forRequest(token);

    const [eventRes, vendorsRes, guestsRes, tasksRes] = await Promise.all([
      client
        .from('events')
        .select('*, event_venues(name, city, capacity)')
        .eq('id', eventId)
        .eq('tenant_id', tenantId)
        .single(),
      client.from('vendor_contracts').select('service_type, status, contract_value').eq('event_id', eventId),
      client
        .from('guests')
        .select('check_in_status, rsvp_status, is_vip')
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId),
      client
        .from('event_tasks')
        .select('title, status, due_date, priority')
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId),
    ]);

    const event = eventRes.data;
    if (!event) throw new NotFoundException('Event not found');

    const vendorContracts = vendorsRes.data ?? [];
    const guests = guestsRes.data ?? [];
    const tasks = tasksRes.data ?? [];

    const daysToEvent = event.start_date
      ? Math.ceil((new Date(event.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    const unconfirmedVendors = vendorContracts.filter((v: any) => v.status !== 'active' && v.status !== 'signed');
    const overdueTasks = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed');
    const vipCount = guests.filter((g: any) => g.is_vip).length;

    const prompt = `
Perform a comprehensive operational risk assessment for the following event.

EVENT: ${event.name}
TYPE: ${event.event_type ?? 'Not specified'}
DATE: ${event.start_date ?? 'TBD'} (${daysToEvent !== null ? `${daysToEvent} days away` : 'date unknown'})
VENUE: ${event.event_venues?.name ?? 'TBD'}, ${event.event_venues?.city ?? 'Unknown'}
CAPACITY: ${event.event_venues?.capacity ?? 'Unknown'}
EXPECTED GUESTS: ${event.expected_guests ?? guests.length}
VIP GUESTS: ${vipCount}

VENDOR STATUS:
- Total vendors: ${vendorContracts.length}
- Confirmed: ${vendorContracts.filter((v: any) => v.status === 'active' || v.status === 'signed').length}
- Unconfirmed: ${unconfirmedVendors.length}
${unconfirmedVendors.map((v: any) => `  ⚠️ ${v.service_type} (${v.status})`).join('\n')}

TASK STATUS:
- Total tasks: ${tasks.length}
- Completed: ${tasks.filter((t: any) => t.status === 'completed').length}
- Overdue: ${overdueTasks.length}
${overdueTasks.map((t: any) => `  ⚠️ ${t.title} (due: ${t.due_date})`).join('\n')}

Please produce a risk register with:
1. Top 5 Critical Risks (with likelihood 1-5, impact 1-5, risk score, and specific mitigation)
2. Vendor Risk Assessment
3. Timeline/Task Risk
4. Guest Management Risks (especially VIP)
5. Financial Risk
6. Emergency Response Recommendations

Format as a structured risk matrix.
`.trim();

    return this.aiService.generate({
      feature: 'risk_prediction',
      prompt,
      context: { event, vendorContracts, unconfirmedVendors, overdueTasks, daysToEvent },
      eventId,
      tenantId,
      userId,
    });
  }

  // ─── Smart Runsheet Generation ────────────────────────────────────────────

  async generateSmartRunsheet(
    eventId: string,
    tenantId: string,
    userId: string,
    token: string,
  ) {
    const client = this.supabase.forRequest(token);

    const [eventRes, tasksRes, vendorsRes] = await Promise.all([
      client.from('events').select('*, event_venues(*)').eq('id', eventId).eq('tenant_id', tenantId).single(),
      client
        .from('event_tasks')
        .select('*')
        .eq('event_id', eventId)
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: true }),
      client.from('vendor_contracts').select('service_type, status').eq('event_id', eventId),
    ]);

    const event = eventRes.data;
    if (!event) throw new NotFoundException('Event not found');

    const tasks = tasksRes.data ?? [];
    const vendors = vendorsRes.data ?? [];

    const prompt = `
Generate a detailed minute-by-minute event runsheet for the following event.

EVENT DETAILS:
- Name: ${event.name}
- Type: ${event.event_type ?? 'Event'}
- Date: ${event.start_date}
- Start Time: ${event.start_date ? new Date(event.start_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
- End Time: ${event.end_date ? new Date(event.end_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
- Venue: ${event.event_venues?.name ?? 'TBD'}
- Expected Guests: ${event.expected_guests ?? 'TBD'}

KEY TASKS / ACTIVITIES:
${tasks.map((t: any) => `- ${t.title} (${t.category ?? 'general'})`).join('\n') || 'No tasks defined — create a general runsheet'}

VENDORS ON-SITE:
${vendors.map((v: any) => `- ${v.service_type}`).join('\n') || 'None specified'}

Please generate a detailed runsheet with:
1. Pre-event setup (venue opening through guest arrival)
2. Guest arrival window
3. Main event flow (minute by minute)
4. Vendor cue points (catering, AV, photography, etc.)
5. Buffer periods and contingency notes
6. Post-event wrap-up

Format as a table with columns: TIME | ACTIVITY | RESPONSIBLE | NOTES/CUES

Include specific buffer windows and contingency notes for critical moments.
`.trim();

    return this.aiService.generate({
      feature: 'runsheet_generation',
      prompt,
      context: { event, tasks, vendors },
      eventId,
      tenantId,
      userId,
    });
  }

  // ─── Guest Intelligence ───────────────────────────────────────────────────

  async generateGuestInsights(
    eventId: string,
    tenantId: string,
    userId: string,
    token: string,
  ) {
    const client = this.supabase.forRequest(token);

    const { data: guests } = await client
      .from('guests')
      .select('name, category, is_vip, plus_ones, meal_preference, rsvp_status, check_in_status')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId);

    const g = guests ?? [];
    const total = g.length;
    const vips = g.filter((x: any) => x.is_vip);
    const byCategory = g.reduce((acc: any, x: any) => { acc[x.category] = (acc[x.category] ?? 0) + 1; return acc; }, {});
    const dietary = g.filter((x: any) => x.meal_preference).map((x: any) => x.meal_preference);

    const prompt = `
Analyze the following guest list data and provide actionable insights.

GUEST SUMMARY:
- Total Guests: ${total}
- Total with +1s: ${g.reduce((s: number, x: any) => s + 1 + (x.plus_ones ?? 0), 0)}
- VIP Guests: ${vips.length} (${vips.map((v: any) => v.name).slice(0, 5).join(', ')}${vips.length > 5 ? '...' : ''})

BY CATEGORY:
${Object.entries(byCategory).map(([cat, cnt]) => `- ${cat}: ${cnt}`).join('\n')}

RSVP STATUS:
- Confirmed: ${g.filter((x: any) => x.rsvp_status === 'confirmed').length}
- Pending: ${g.filter((x: any) => x.rsvp_status === 'pending').length}
- Declined: ${g.filter((x: any) => x.rsvp_status === 'declined').length}

DIETARY REQUIREMENTS:
${dietary.length > 0 ? dietary.slice(0, 20).join(', ') : 'None specified'}

Please provide:
1. Guest Experience Recommendations (flow, seating, engagement)
2. VIP Management Protocol (specific attention points)
3. Catering Considerations (based on dietary data)
4. Check-in Optimization Suggestions
5. Potential Friction Points and How to Address Them
6. Special Arrangements Needed
`.trim();

    return this.aiService.generate({
      feature: 'guest_insights',
      prompt,
      context: { guestStats: { total, vips: vips.length, byCategory } },
      eventId,
      tenantId,
      userId,
    });
  }
}
