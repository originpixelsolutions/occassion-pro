/**
 * OccasionPro Webhook Relay Worker
 *
 * Receives external webhooks (Razorpay, etc.) and:
 * 1. Immediately returns 200 to the sender
 * 2. Enqueues the payload into Cloudflare Queue for reliable processing
 * 3. Consumer processes the queue and forwards to the NestJS API
 */

interface Env {
  WEBHOOK_QUEUE: Queue
  API_URL: string
}

interface WebhookMessage {
  source: string
  path: string
  headers: Record<string, string>
  body: string
  receivedAt: string
}

// ─── HTTP Handler (producer) ────────────────────────────────────────────────
async function handleWebhookReceive(
  request: Request,
  env: Env,
  path: string,
): Promise<Response> {
  const body = await request.text()

  const message: WebhookMessage = {
    source: detectSource(path),
    path,
    headers: Object.fromEntries(request.headers.entries()),
    body,
    receivedAt: new Date().toISOString(),
  }

  // Enqueue — non-blocking
  await env.WEBHOOK_QUEUE.send(message)

  return new Response(JSON.stringify({ queued: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function detectSource(path: string): string {
  if (path.includes('razorpay')) return 'razorpay'
  if (path.includes('stripe')) return 'stripe'
  if (path.includes('supabase')) return 'supabase'
  return 'unknown'
}

// ─── Queue Consumer ─────────────────────────────────────────────────────────
async function processWebhookBatch(
  batch: MessageBatch<WebhookMessage>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const { source, path, headers, body } = message.body

    try {
      const apiPath = `/api/v1/internal/webhooks/${source}`
      const res = await fetch(`${env.API_URL}${apiPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': headers['content-type'] ?? 'application/json',
          // Forward original signature headers for verification
          ...(headers['x-razorpay-signature'] ? { 'x-razorpay-signature': headers['x-razorpay-signature'] } : {}),
          ...(headers['stripe-signature'] ? { 'stripe-signature': headers['stripe-signature'] } : {}),
          'X-Webhook-Source': source,
          'X-Original-Path': path,
          'X-Forwarded-By': 'occasionpro-relay-worker',
        },
        body,
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        console.error(`Webhook relay failed: ${res.status} for ${source}`)
        message.retry()
      } else {
        message.ack()
      }
    } catch (err) {
      console.error(`Webhook relay error for ${source}:`, err)
      message.retry()
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname.startsWith('/webhook')) {
      return handleWebhookReceive(request, env, url.pathname)
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response('OK', { status: 200 })
    }

    return new Response('Not found', { status: 404 })
  },

  async queue(batch: MessageBatch<WebhookMessage>, env: Env): Promise<void> {
    return processWebhookBatch(batch, env)
  },
} satisfies ExportedHandler<Env>
