import { Injectable, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class SurveysService {
  constructor(private readonly supabase: SupabaseService) {}

  private c(token: string) { return this.supabase.forRequest(token) }

  async getStats(eventId: string, tenantId: string, token: string) {
    const c = this.c(token)
    const [surveysRes, responsesRes] = await Promise.all([
      c.from('event_surveys').select('id, status, survey_type, response_count, nps_score_avg').eq('event_id', eventId),
      c.from('survey_responses').select('nps_score, overall_rating').eq('event_id', eventId),
    ])
    const surveys = surveysRes.data ?? []
    const responses = responsesRes.data ?? []
    const activeSurveys = surveys.filter(s => s.status === 'active').length
    const totalResponses = responses.length
    const avgNps = responses.filter(r => r.nps_score != null).length > 0
      ? responses.reduce((s, r) => s + (r.nps_score ?? 0), 0) / responses.filter(r => r.nps_score != null).length
      : null
    const avgRating = responses.filter(r => r.overall_rating != null).length > 0
      ? responses.reduce((s, r) => s + Number(r.overall_rating ?? 0), 0) / responses.filter(r => r.overall_rating != null).length
      : null
    return { totalSurveys: surveys.length, activeSurveys, totalResponses, avgNps: avgNps ? Math.round(avgNps * 10) / 10 : null, avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null }
  }

  async listSurveys(eventId: string, tenantId: string, token: string) {
    const c = this.c(token)
    const { data, error } = await c
      .from('event_surveys')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  async getSurveyWithQuestions(surveyId: string, tenantId: string, token: string) {
    const c = this.c(token)
    const [surveyRes, questionsRes] = await Promise.all([
      c.from('event_surveys').select('*').eq('id', surveyId).single(),
      c.from('survey_questions').select('*').eq('survey_id', surveyId).order('sort_order'),
    ])
    if (!surveyRes.data) throw new NotFoundException('Survey not found')
    return { ...surveyRes.data, questions: questionsRes.data ?? [] }
  }

  async createSurvey(tenantId: string, token: string, body: Record<string, unknown>) {
    const c = this.c(token)
    const { data: profile } = await c.from('profiles').select('id').single()
    const slug = `survey-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const { data, error } = await c
      .from('event_surveys')
      .insert({ ...body, tenant_id: tenantId, created_by: profile?.id, public_url_slug: slug })
      .select().single()
    if (error) throw error
    return data
  }

  async updateSurvey(id: string, tenantId: string, token: string, body: Record<string, unknown>) {
    const c = this.c(token)
    const { data, error } = await c
      .from('event_surveys')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    return data
  }

  async saveQuestions(surveyId: string, tenantId: string, token: string, questions: Record<string, unknown>[]) {
    const c = this.c(token)
    // Delete existing and re-insert
    await c.from('survey_questions').delete().eq('survey_id', surveyId)
    if (questions.length === 0) return []
    const { data, error } = await c
      .from('survey_questions')
      .insert(questions.map((q, i) => ({ ...q, survey_id: surveyId, sort_order: i })))
      .select()
    if (error) throw error
    return data ?? []
  }

  async getResponses(surveyId: string, tenantId: string, token: string) {
    const c = this.c(token)
    const { data, error } = await c
      .from('survey_responses')
      .select('*')
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  async deleteSurvey(id: string, tenantId: string, token: string) {
    const c = this.c(token)
    const { error } = await c.from('event_surveys').delete().eq('id', id)
    if (error) throw error
  }
}
