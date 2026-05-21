import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

export interface FaqMatch {
  id: string
  question: string
  answer: string
  category: string
  score: number
}

@Injectable()
export class SupportBotService {
  private readonly logger = new Logger(SupportBotService.name)

  constructor(private readonly supabase: SupabaseService) {}

  // ── Tokenize a string into lowercase words ────────────────────────────────

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)  // skip very short words
  }

  // ── Score a single FAQ against a query ────────────────────────────────────
  // Strategy: count matching keywords (weighted 1.5x) + matching words in question (1x)

  private scoreFaq(
    query: string,
    faq: { question: string; answer: string; keywords: string[] },
  ): number {
    const queryTokens = new Set(this.tokenize(query))
    if (queryTokens.size === 0) return 0

    let hits = 0

    // Check keywords (higher weight)
    for (const kw of faq.keywords) {
      const kwLower = kw.toLowerCase()
      if (queryTokens.has(kwLower)) {
        hits += 1.5
        continue
      }
      // Partial match — query contains keyword or keyword contains query token
      for (const qt of queryTokens) {
        if (kwLower.includes(qt) || qt.includes(kwLower)) {
          hits += 0.8
          break
        }
      }
    }

    // Check question words (lower weight)
    const questionTokens = this.tokenize(faq.question)
    for (const qt of queryTokens) {
      if (questionTokens.includes(qt)) hits += 1.0
    }

    // Normalise by query length so longer queries don't dominate
    return hits / Math.max(queryTokens.size, 1)
  }

  // ── Main entry: find best FAQ match for a query ───────────────────────────

  async findFaqAnswer(query: string, threshold = 0.4): Promise<FaqMatch | null> {
    if (!query || query.trim().length < 3) return null

    const { data: faqs, error } = await this.supabase
      .admin()
      .from('support_faqs')
      .select('id, question, answer, keywords, category')
      .eq('is_active', true)

    if (error || !faqs || faqs.length === 0) return null

    let best: FaqMatch | null = null

    for (const faq of faqs) {
      const score = this.scoreFaq(query, faq)
      if (score > threshold && (!best || score > best.score)) {
        best = { id: faq.id, question: faq.question, answer: faq.answer, category: faq.category, score }
      }
    }

    // Increment view_count on the matched FAQ (fire-and-forget)
    if (best) {
      const faqId = best.id
      this.supabase.serviceClient
        .from('support_faqs')
        .select('view_count')
        .eq('id', faqId)
        .single()
        .then(({ data }) => {
          if (data) {
            this.supabase.serviceClient
              .from('support_faqs')
              .update({ view_count: (data.view_count ?? 0) + 1 })
              .eq('id', faqId)
              .then()
          }
        })
        .catch(() => { /* non-critical */ })
    }

    return best
  }

  // ── Browse FAQs by category ───────────────────────────────────────────────

  async getCategories(): Promise<string[]> {
    const { data } = await this.supabase
      .admin()
      .from('support_faqs')
      .select('category')
      .eq('is_active', true)

    if (!data) return []
    const cats = [...new Set(data.map(r => r.category))]
    return cats.sort()
  }

  async getFaqsByCategory(category: string) {
    const { data } = await this.supabase
      .admin()
      .from('support_faqs')
      .select('id, question, answer, category, view_count')
      .eq('is_active', true)
      .eq('category', category)
      .order('sort_order')

    return data ?? []
  }

  async searchFaqs(query: string) {
    if (!query || query.trim().length < 2) {
      const { data } = await this.supabase
        .admin()
        .from('support_faqs')
        .select('id, question, answer, category, keywords')
        .eq('is_active', true)
        .order('sort_order')
      return data ?? []
    }

    const { data: faqs } = await this.supabase
      .admin()
      .from('support_faqs')
      .select('id, question, answer, category, keywords, sort_order')
      .eq('is_active', true)

    if (!faqs) return []

    // Score all and return those above a low threshold, sorted by score
    const scored = faqs
      .map(f => ({ ...f, score: this.scoreFaq(query, f) }))
      .filter(f => f.score > 0.2)
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, 10)
  }

  // ── Super Admin: full FAQ management ─────────────────────────────────────

  async listAllFaqs() {
    const { data } = await this.supabase
      .admin()
      .from('support_faqs')
      .select('*')
      .order('category')
      .order('sort_order')

    return data ?? []
  }

  async createFaq(dto: {
    question: string
    answer: string
    keywords: string[]
    category: string
    sort_order?: number
  }) {
    const { data, error } = await this.supabase
      .admin()
      .from('support_faqs')
      .insert({
        question: dto.question,
        answer: dto.answer,
        keywords: dto.keywords,
        category: dto.category,
        sort_order: dto.sort_order ?? 0,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  }

  async updateFaq(id: string, dto: Partial<{
    question: string
    answer: string
    keywords: string[]
    category: string
    sort_order: number
    is_active: boolean
  }>) {
    const { data, error } = await this.supabase
      .admin()
      .from('support_faqs')
      .update(dto)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  }

  async deleteFaq(id: string) {
    const { error } = await this.supabase
      .admin()
      .from('support_faqs')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
    return { deleted: true }
  }
}
