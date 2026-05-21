import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

const SYSTEM_PROMPT = `You are an expert AI assistant for OccasionPro — an enterprise event management platform.
You help event professionals with proposals, budgets, risk assessments, timelines, vendor briefings,
guest experience design, and operational planning.

Be concise, practical, and professional. Format responses with markdown when helpful.
Always tailor advice to the specific event details provided in the context.`

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    // Check AI enabled for tenant
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (profile?.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('ai_enabled')
        .eq('id', profile.tenant_id)
        .single()

      if (tenant?.ai_enabled === false) {
        return NextResponse.json({ error: 'AI is disabled for this workspace' }, { status: 403 })
      }
    }

    const body = await req.json()
    const { message, context, history = [] } = body as {
      message: string
      context?: string
      history?: Array<{ role: string; content: string }>
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      // Return a graceful fallback when API key not configured
      return new Response(
        'AI chat is not configured yet. Set OPENAI_API_KEY in your environment to enable real AI responses.',
        {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        },
      )
    }

    // Build messages for OpenAI
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
    ]

    if (context) {
      messages.push({
        role: 'system',
        content: `Current event context:\n${context}`,
      })
    }

    // Include recent history
    for (const h of history.slice(-6)) {
      if (h.role === 'user' || h.role === 'assistant') {
        messages.push({ role: h.role, content: h.content })
      }
    }

    messages.push({ role: 'user', content: message })

    // Stream from OpenAI
    const upstream = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages,
        stream: true,
        max_tokens: 1500,
        temperature: 0.7,
      }),
    })

    if (!upstream.ok) {
      const errText = await upstream.text()
      console.error('[AI chat] OpenAI error:', errText)
      return new Response('AI service temporarily unavailable. Please try again.', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    // Pipe the streaming SSE response, extracting just the text content
    const { readable, writable } = new TransformStream<string, string>()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    // Read OpenAI SSE and forward only the text deltas
    ;(async () => {
      const reader = upstream.body!.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                await writer.write(encoder.encode(delta))
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } finally {
        writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('[AI chat] error:', err)
    return new Response('An unexpected error occurred. Please try again.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
