import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from '../../common/supabase/supabase.service'

export type AiFeature =
  | 'proposal_generation'
  | 'budget_optimization'
  | 'risk_prediction'
  | 'guest_insights'
  | 'schedule_suggestion'
  | 'vendor_recommendation'
  | 'email_draft'
  | 'event_summary'
  | 'runsheet_generation'
  | 'business_insights'
  | 'chat'

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)
  private readonly liteLlmUrl: string
  private readonly liteLlmKey: string

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.liteLlmUrl = this.config.get<string>('LITELLM_URL', 'http://localhost:4001')
    this.liteLlmKey = this.config.get<string>('LITELLM_API_KEY', '')
  }

  async generate(dto: {
    feature: AiFeature
    prompt: string
    context?: Record<string, unknown>
    eventId?: string
    tenantId: string
    userId: string
    model?: string
  }) {
    const model = dto.model ?? this.config.get<string>('AI_DEFAULT_MODEL', 'gpt-4o-mini')

    const systemPrompt = this.getSystemPrompt(dto.feature)
    const userMessage = dto.context
      ? `${dto.prompt}\n\nContext:\n${JSON.stringify(dto.context, null, 2)}`
      : dto.prompt

    const startedAt = Date.now()

    try {
      const response = await fetch(`${this.liteLlmUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.liteLlmKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`LiteLLM error: ${err}`)
      }

      const data = await response.json()
      const result = data.choices?.[0]?.message?.content ?? ''
      const tokensUsed = data.usage?.total_tokens ?? 0

      // Log to database
      const client = this.supabase.serviceClient
      await client.from('ai_generations').insert({
        tenant_id: dto.tenantId,
        event_id: dto.eventId ?? null,
        user_id: dto.userId,
        feature: dto.feature,
        prompt: dto.prompt,
        model,
        result,
        tokens_used: tokensUsed,
        latency_ms: Date.now() - startedAt,
        status: 'success',
      })

      return { result, model, tokens_used: tokensUsed }
    } catch (err: any) {
      this.logger.error(`AI generation failed: ${err.message}`)

      const client = this.supabase.serviceClient
      await client.from('ai_generations').insert({
        tenant_id: dto.tenantId,
        event_id: dto.eventId ?? null,
        user_id: dto.userId,
        feature: dto.feature,
        prompt: dto.prompt,
        model,
        result: null,
        status: 'error',
        error_message: err.message,
      })

      throw err
    }
  }

  async generateProposal(eventId: string, tenantId: string, userId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data: event } = await client
      .from('events')
      .select(`*, clients(name), events_tasks(*)`)
      .eq('id', eventId)
      .single()

    return this.generate({
      feature: 'proposal_generation',
      prompt: `Generate a professional event proposal for this event.`,
      context: event,
      eventId,
      tenantId,
      userId,
    })
  }

  async generateRunsheet(eventId: string, tenantId: string, userId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data: event } = await client
      .from('events')
      .select(`*, event_tasks(*)`)
      .eq('id', eventId)
      .single()

    return this.generate({
      feature: 'runsheet_generation',
      prompt: 'Generate a detailed minute-by-minute runsheet for this event.',
      context: event,
      eventId,
      tenantId,
      userId,
    })
  }

  async predictRisks(eventId: string, tenantId: string, userId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data: event } = await client
      .from('events')
      .select(`*, vendor_contracts(*), budgets(*, budget_line_items(*))`)
      .eq('id', eventId)
      .single()

    return this.generate({
      feature: 'risk_prediction',
      prompt: 'Analyze this event data and identify top 5 operational risks with mitigation strategies.',
      context: event,
      eventId,
      tenantId,
      userId,
    })
  }

  async generateInsights(tenantId: string, period: string): Promise<{ insights: Array<{ title: string; body: string; icon_type: string }> }> {
    const db = this.supabase.serviceClient

    // Pull lightweight analytics context for the tenant
    const [eventsRes, invoicesRes] = await Promise.all([
      db.from('events')
        .select('id, name, status, start_date, event_type')
        .eq('tenant_id', tenantId)
        .order('start_date', { ascending: false })
        .limit(30),
      db.from('invoices')
        .select('id, total_amount, status, issue_date')
        .eq('tenant_id', tenantId)
        .order('issue_date', { ascending: false })
        .limit(50),
    ])

    const events = eventsRes.data ?? []
    const invoices = invoicesRes.data ?? []

    const totalRevenue = invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (i.total_amount ?? 0), 0)
    const pendingRevenue = invoices.filter((i: any) => i.status !== 'paid').reduce((s: number, i: any) => s + (i.total_amount ?? 0), 0)
    const completedEvents = events.filter((e: any) => e.status === 'completed').length
    const upcomingEvents = events.filter((e: any) => e.status === 'upcoming' || e.status === 'planning').length

    const contextSummary = JSON.stringify({
      period,
      total_events: events.length,
      completed_events: completedEvents,
      upcoming_events: upcomingEvents,
      total_revenue_collected_inr: totalRevenue,
      pending_revenue_inr: pendingRevenue,
      top_event_types: [...new Set(events.map((e: any) => e.event_type).filter(Boolean))].slice(0, 5),
    })

    const prompt = `You are a business analyst for an event management company. Based on the following analytics data, generate exactly 3 concise business insights. Each insight must be actionable and specific.

Data: ${contextSummary}

Return a valid JSON array with exactly 3 objects. Each object must have:
- "title": short title (max 5 words)
- "body": 1-2 sentence insight with a specific recommendation
- "icon_type": one of "trend", "target", "activity", "revenue", "warning"

Return only the JSON array, no other text.`

    let insights: Array<{ title: string; body: string; icon_type: string }> = []

    try {
      const t0 = Date.now()
      const res = await fetch(`${this.liteLlmUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.liteLlmKey ? { Authorization: `Bearer ${this.liteLlmKey}` } : {}),
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a business analytics expert for event companies. Always respond with valid JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.4,
          max_tokens: 600,
        }),
      })

      const latency = Date.now() - t0
      const json = await res.json()
      const text: string = json?.choices?.[0]?.message?.content ?? '[]'
      const clean = text.replace(/```json|```/g, '').trim()
      insights = JSON.parse(clean)

      // Log the generation
      await this.supabase.serviceClient.from('ai_generations').insert({
        tenant_id: tenantId,
        feature: 'business_insights' as AiFeature,
        prompt,
        result: text,
        tokens_used: json?.usage?.total_tokens ?? null,
        latency_ms: latency,
        status: 'success',
      }).then(() => {})

    } catch (err) {
      this.logger.warn(`generateInsights failed: ${err}`)
      // Return graceful fallback so the UI still loads
      insights = [
        { title: 'Review Upcoming Events', body: `You have ${upcomingEvents} upcoming events. Ensure vendor confirmations and timelines are in place.`, icon_type: 'target' },
        { title: 'Revenue Collection', body: `₹${(pendingRevenue / 1e5).toFixed(1)}L in invoices are still pending. Follow up to improve cash flow.`, icon_type: 'revenue' },
        { title: 'Event Performance', body: `${completedEvents} events completed this period. Collect post-event feedback to track satisfaction scores.`, icon_type: 'activity' },
      ]
    }

    return { insights: Array.isArray(insights) ? insights.slice(0, 3) : [] }
  }

  // ─── AI Vendor Recommendation Engine ─────────────────────────────────────────

  async recommendVendors(dto: {
    tenantId: string
    userId: string
    token: string
    eventId?: string
    serviceCategory: string
    eventType?: string
    budgetMin?: number
    budgetMax?: number
    eventDate?: string
    location?: string
    guestCount?: number
    requirements?: string
  }) {
    const { tenantId, userId, token, eventId, serviceCategory } = dto
    const db = this.supabase.serviceClient
    const userClient = this.supabase.forRequest(token)

    // ── 1. Create session record ──
    const { data: session, error: sessionErr } = await db
      .from('ai_vendor_recommendation_sessions')
      .insert({
        tenant_id: tenantId,
        event_id: eventId ?? null,
        requested_by: userId,
        service_category: serviceCategory,
        event_type: dto.eventType ?? null,
        budget_min: dto.budgetMin ?? null,
        budget_max: dto.budgetMax ?? null,
        event_date: dto.eventDate ?? null,
        location: dto.location ?? null,
        guest_count: dto.guestCount ?? null,
        requirements: dto.requirements ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (sessionErr) throw new Error(sessionErr.message)

    // ── 2. Fetch matching vendors + their performance scores ──
    let vendorQuery = userClient
      .from('vendors')
      .select(`
        id, name, service_type, description, base_price, price_unit,
        city, state, website, logo_url, status,
        vendor_performance_scores (
          avg_rating, on_time_rate, budget_adherence, repeat_hire_rate,
          avg_response_hours, composite_score, total_bookings, completed_bookings
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .ilike('service_type', `%${serviceCategory}%`)
      .limit(20)

    if (dto.budgetMax) {
      vendorQuery = vendorQuery.lte('base_price', dto.budgetMax * 1.2) // 20% buffer
    }

    const { data: vendors } = await vendorQuery

    if (!vendors || vendors.length === 0) {
      await db.from('ai_vendor_recommendation_sessions').update({ status: 'completed', raw_ai_response: '[]' }).eq('id', session.id)
      return { sessionId: session.id, recommendations: [] }
    }

    // ── 3. Build prompt ──
    const vendorSummaries = vendors.map((v: any, idx: number) => ({
      index: idx + 1,
      id: v.id,
      name: v.name,
      service_type: v.service_type,
      base_price: v.base_price,
      price_unit: v.price_unit,
      location: [v.city, v.state].filter(Boolean).join(', '),
      description: v.description?.slice(0, 200),
      performance: v.vendor_performance_scores?.[0] ?? {},
    }))

    const criteria = {
      service_category: serviceCategory,
      event_type: dto.eventType,
      budget_range: dto.budgetMin || dto.budgetMax
        ? `₹${dto.budgetMin ?? 0} – ₹${dto.budgetMax ?? '∞'}`
        : 'Not specified',
      event_date: dto.eventDate,
      location: dto.location,
      guest_count: dto.guestCount,
      requirements: dto.requirements,
    }

    const prompt = `You are an expert event procurement specialist. Rank the following vendors for a client's event requirements.

CLIENT REQUIREMENTS:
${JSON.stringify(criteria, null, 2)}

AVAILABLE VENDORS (${vendors.length} vendors):
${JSON.stringify(vendorSummaries, null, 2)}

Rank ALL vendors from best to worst fit. For each vendor return:
- "vendorIndex": the index number from the list above
- "rank": position (1 = best)
- "matchScore": 0-100 confidence score
- "reasoning": 2-3 sentences explaining why this vendor fits or doesn't
- "scoreBudget": 0-100 budget fit score
- "scoreCategory": 0-100 category specialization score
- "scoreHistory": 0-100 track record score
- "scoreRating": 0-100 rating score

Return ONLY a valid JSON array of objects with these exact keys. No markdown, no explanation outside the JSON.`

    const t0 = Date.now()
    let rawResponse = '[]'
    let tokensUsed = 0
    let recommendations: any[] = []

    try {
      const res = await fetch(`${this.liteLlmUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.liteLlmKey ? { Authorization: `Bearer ${this.liteLlmKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.config.get<string>('AI_DEFAULT_MODEL', 'gpt-4o-mini'),
          messages: [
            {
              role: 'system',
              content: 'You are a procurement specialist for premium events. Always return valid JSON arrays only.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      })

      const latency = Date.now() - t0
      const json = await res.json()
      rawResponse = json?.choices?.[0]?.message?.content ?? '[]'
      tokensUsed = json?.usage?.total_tokens ?? 0

      const clean = rawResponse.replace(/```json|```/g, '').trim()
      const ranked: any[] = JSON.parse(clean)

      // ── 4. Persist ranked recommendations ──
      const inserts = ranked.map((r: any) => {
        const vendor = vendors[r.vendorIndex - 1]
        if (!vendor) return null
        return {
          session_id: session.id,
          vendor_id: vendor.id,
          tenant_id: tenantId,
          rank: r.rank,
          match_score: r.matchScore,
          reasoning: r.reasoning,
          score_budget: r.scoreBudget,
          score_category: r.scoreCategory,
          score_history: r.scoreHistory,
          score_rating: r.scoreRating,
        }
      }).filter(Boolean)

      if (inserts.length > 0) {
        await db.from('ai_vendor_recommendations').insert(inserts)
      }

      // Build response including vendor details
      recommendations = ranked.map((r: any) => {
        const vendor = vendors[r.vendorIndex - 1]
        if (!vendor) return null
        const perf = (vendor as any).vendor_performance_scores?.[0] ?? {}
        return {
          rank: r.rank,
          matchScore: r.matchScore,
          reasoning: r.reasoning,
          scores: {
            budget: r.scoreBudget,
            category: r.scoreCategory,
            history: r.scoreHistory,
            rating: r.scoreRating,
          },
          vendor: {
            id: vendor.id,
            name: vendor.name,
            serviceType: vendor.service_type,
            basePrice: vendor.base_price,
            priceUnit: vendor.price_unit,
            city: vendor.city,
            state: vendor.state,
            website: vendor.website,
            logoUrl: vendor.logo_url,
            avgRating: perf.avg_rating,
            compositeScore: perf.composite_score,
            totalBookings: perf.total_bookings,
            onTimeRate: perf.on_time_rate,
          },
        }
      }).filter(Boolean).sort((a: any, b: any) => a.rank - b.rank)

      await db.from('ai_vendor_recommendation_sessions').update({
        status: 'completed',
        model_used: this.config.get<string>('AI_DEFAULT_MODEL', 'gpt-4o-mini'),
        tokens_used: tokensUsed,
        latency_ms: latency,
        raw_ai_response: rawResponse,
      }).eq('id', session.id)

    } catch (err: any) {
      this.logger.error(`Vendor recommendation AI call failed: ${err.message}`)
      await db.from('ai_vendor_recommendation_sessions').update({
        status: 'error',
        error: err.message,
        latency_ms: Date.now() - t0,
      }).eq('id', session.id)

      // Graceful fallback: score vendors by composite_score without AI
      recommendations = vendors
        .map((v: any, idx: number) => {
          const perf = v.vendor_performance_scores?.[0] ?? {}
          return {
            rank: idx + 1,
            matchScore: perf.composite_score ?? 50,
            reasoning: 'Ranked by historical performance score (AI unavailable).',
            scores: { budget: 50, category: 70, history: perf.composite_score ?? 50, rating: perf.avg_rating ? perf.avg_rating * 20 : 50 },
            vendor: {
              id: v.id, name: v.name, serviceType: v.service_type,
              basePrice: v.base_price, priceUnit: v.price_unit,
              city: v.city, state: v.state, website: v.website, logoUrl: v.logo_url,
              avgRating: perf.avg_rating, compositeScore: perf.composite_score,
              totalBookings: perf.total_bookings, onTimeRate: perf.on_time_rate,
            },
          }
        })
        .sort((a: any, b: any) => b.matchScore - a.matchScore)
        .map((r: any, i: number) => ({ ...r, rank: i + 1 }))
    }

    return { sessionId: session.id, recommendations }
  }

  async getRecommendationSession(sessionId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('ai_vendor_recommendation_sessions')
      .select(`
        *,
        ai_vendor_recommendations (
          *,
          vendors (id, name, service_type, base_price, city, logo_url)
        )
      `)
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateRecommendationAction(
    recommendationId: string,
    action: 'shortlisted' | 'dismissed' | 'assigned',
    tenantId: string,
    userId: string,
    token: string,
  ) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('ai_vendor_recommendations')
      .update({
        user_action: action,
        actioned_at: new Date().toISOString(),
        actioned_by: userId,
      })
      .eq('id', recommendationId)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async getRecommendationHistory(tenantId: string, token: string, eventId?: string) {
    const client = this.supabase.forRequest(token)
    let query = client
      .from('ai_vendor_recommendation_sessions')
      .select('id, service_category, event_type, status, created_at, budget_min, budget_max')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (eventId) query = query.eq('event_id', eventId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async getHistory(tenantId: string, token: string, options: { eventId?: string; feature?: string } = {}) {
    const client = this.supabase.forRequest(token)
    let query = client
      .from('ai_generations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (options.eventId) query = query.eq('event_id', options.eventId)
    if (options.feature) query = query.eq('feature', options.feature)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data ?? []
  }

  private getSystemPrompt(feature: AiFeature): string {
    const prompts: Record<AiFeature, string> = {
      proposal_generation: `You are an expert event management consultant. Generate professional, detailed event proposals that impress clients. Use formal language and include timeline, deliverables, and investment sections.`,
      budget_optimization: `You are a financial expert specializing in event budgeting. Analyze budgets and suggest optimizations to reduce costs while maintaining quality. Be specific with amounts and percentages.`,
      risk_prediction: `You are an event operations risk analyst. Identify specific operational, financial, and logistical risks. For each risk, provide: likelihood (1-5), impact (1-5), and concrete mitigation strategy.`,
      guest_insights: `You are a guest experience analyst. Analyze guest data to provide actionable insights about attendance patterns, VIP needs, and experience improvements.`,
      schedule_suggestion: `You are an expert event scheduler. Create optimized schedules that consider venue logistics, vendor availability, and guest flow. Output in structured timeline format.`,
      vendor_recommendation: `You are a procurement specialist for events. Recommend vendors based on requirements, budget, and past performance. Provide specific reasons for each recommendation.`,
      email_draft: `You are a professional communications specialist for event companies. Draft clear, professional emails that are concise and action-oriented.`,
      event_summary: `You are an event analytics expert. Provide comprehensive post-event summaries with KPIs, highlights, lessons learned, and recommendations for future events.`,
      runsheet_generation: `You are an expert event operations manager. Generate detailed minute-by-minute runsheets with cue points, responsible persons, and contingency notes. Format as a structured table.`,
      business_insights: `You are a business analyst for an event management company. Generate concise, actionable insights based on analytics data. Respond with valid JSON only.`,
      chat: `You are OccasionPro's AI assistant — an expert in event management, operations, vendor coordination, budgeting, client relations, and hospitality. You help event professionals make better decisions, draft communications, plan events, manage risks, and grow their business. Be concise, practical, and specific. Use markdown for formatting when helpful.`,
    }
    return prompts[feature] ?? 'You are a helpful event management AI assistant.'
  }

  // ─── Multi-turn Chat ──────────────────────────────────────────────────────

  async chat(dto: {
    message: string
    history: Array<{ role: 'user' | 'assistant'; content: string }>
    tenantId: string
    userId: string
    model?: string
  }) {
    const model = dto.model ?? this.config.get<string>('AI_DEFAULT_MODEL', 'gpt-4o-mini')
    const systemPrompt = this.getSystemPrompt('chat')

    // Build full messages array: system + history (last 10 turns) + current message
    const historySlice = (dto.history ?? []).slice(-10)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...historySlice,
      { role: 'user', content: dto.message },
    ]

    const startedAt = Date.now()

    try {
      const response = await fetch(`${this.liteLlmUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.liteLlmKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1500,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`LiteLLM error: ${err}`)
      }

      const data = await response.json()
      const result = data.choices?.[0]?.message?.content ?? ''
      const tokensUsed = data.usage?.total_tokens ?? 0

      // Log chat session
      const client = this.supabase.serviceClient
      await client.from('ai_generations').insert({
        tenant_id: dto.tenantId,
        user_id: dto.userId,
        feature: 'chat' as AiFeature,
        prompt: dto.message,
        model,
        result,
        tokens_used: tokensUsed,
        latency_ms: Date.now() - startedAt,
        status: 'success',
      }).then(() => {})

      return { response: result, tokens_used: tokensUsed, model }
    } catch (err: any) {
      this.logger.error(`AI chat failed: ${err.message}`)
      throw err
    }
  }
}
