import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Shield, ArrowLeft, ExternalLink } from 'lucide-react'

/**
 * OccasionPro — Public Privacy Policy page
 * Route: /[tenant]/privacy
 *
 * Server component — fetches the latest policy version from the API and
 * renders it as formatted markdown.  No auth required.
 */

interface PolicyData {
  version:          string
  content_markdown: string
  effective_from:   string
}

async function fetchPolicy(tenant: string): Promise<PolicyData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
    const res = await fetch(`${baseUrl}/api/public/privacy-policy`, {
      headers: { 'x-tenant-slug': tenant },
      next:    { revalidate: 3600 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

interface PageProps {
  params: { tenant: string }
}

export default async function PrivacyPolicyPage({ params }: PageProps) {
  const { tenant } = params
  const policy = await fetchPolicy(tenant)

  if (!policy) notFound()

  const effectiveDate = new Date(policy.effective_from).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href={`/${tenant}`}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Privacy Policy</span>
          </div>
          <span className="ml-auto text-xs text-zinc-500">
            Version {policy.version} · Effective {effectiveDate}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        <MarkdownPage content={policy.content_markdown} />

        {/* Footer CTAs */}
        <div className="mt-16 pt-8 border-t border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Want to exercise your data rights?</p>
            <p className="text-xs text-zinc-500 mt-1">
              Submit an access, correction, erasure, or portability request.
            </p>
          </div>
          <Link
            href={`/${tenant}/data-request`}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
          >
            Your Data Rights
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <p className="mt-6 text-xs text-zinc-600 text-center">
          Powered by OccasionPro · Compliant with India's Digital Personal Data Protection Act 2023
        </p>
      </main>
    </div>
  )
}

// ─── Markdown renderer (server-side, no client bundle needed) ─────────────────

function MarkdownPage({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []
  let i = 0

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${i}`} className="list-disc list-inside space-y-1.5 my-4 ml-2">
          {listItems}
        </ul>
      )
      listItems = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('# ')) {
      flushList()
      elements.push(
        <h1 key={i} className="text-2xl font-bold text-white mt-8 mb-4 pb-3 border-b border-zinc-800">
          {line.slice(2)}
        </h1>
      )
    } else if (line.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={i} className="text-lg font-semibold text-white mt-8 mb-3">
          {line.slice(3)}
        </h2>
      )
    } else if (line.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={i} className="text-base font-medium text-zinc-200 mt-5 mb-2">
          {line.slice(4)}
        </h3>
      )
    } else if (line.startsWith('---')) {
      flushList()
      elements.push(<hr key={i} className="border-zinc-800 my-6" />)
    } else if (line.startsWith('- ')) {
      listItems.push(
        <li key={i} className="text-sm text-zinc-400 leading-relaxed">
          {renderInline(line.slice(2))}
        </li>
      )
    } else if (line.trim() === '') {
      flushList()
      elements.push(<div key={i} className="h-2" />)
    } else {
      flushList()
      elements.push(
        <p key={i} className="text-sm text-zinc-400 leading-relaxed my-2">
          {renderInline(line)}
        </p>
      )
    }
    i++
  }

  flushList()
  return <article>{elements}</article>
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="text-zinc-200 font-semibold">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  )
}

export async function generateMetadata({ params }: PageProps) {
  return {
    title:       'Privacy Policy | OccasionPro',
    description: 'Privacy Policy — how we collect, use, and protect your personal data.',
  }
}
