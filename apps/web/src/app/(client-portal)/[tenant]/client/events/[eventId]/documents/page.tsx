'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Download, Loader2, File } from 'lucide-react'

function cpFetch(path: string) {
  const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    headers: { ...(session ? { 'X-Client-Session': session } : {}) },
  })
}

const TYPE_ICONS: Record<string, string> = {
  proposal: '📄', contract: '📋', invoice: '🧾',
  floor_plan: '🗺️', timeline: '📅', brief: '📝',
  report: '📊', other: '📁',
}

export default function ClientDocumentsPage({
  params,
}: {
  params: Promise<{ tenant: string; eventId: string }>
}) {
  const { tenant, eventId } = use(params)
  const router = useRouter()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = typeof window !== 'undefined' ? localStorage.getItem('cp_session') : null
    if (!session) { router.replace(`/${tenant}/client/auth`); return }

    cpFetch(`/client-portal/events/${eventId}/documents`)
      .then(r => {
        if (r.status === 401) { router.replace(`/${tenant}/client/auth`); return null }
        return r.json()
      })
      .then(d => { if (d) setDocs(d.documents || []) })
      .finally(() => setLoading(false))
  }, [eventId, tenant])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg">Documents</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{docs.length} document{docs.length !== 1 ? 's' : ''} shared with you</p>
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <FileText className="w-10 h-10 text-zinc-700 mx-auto" />
          <p className="text-zinc-400 text-sm">No documents yet</p>
          <p className="text-zinc-600 text-xs">Documents shared by your event team will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div
              key={doc.id}
              className="bg-[#13131a] border border-white/8 rounded-xl p-4 flex items-center gap-4 hover:border-white/15 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl shrink-0">
                {TYPE_ICONS[doc.type] || TYPE_ICONS.other}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-zinc-500 capitalize">{doc.type?.replace('_', ' ')}</span>
                  {doc.file_size && (
                    <>
                      <span className="text-zinc-700">·</span>
                      <span className="text-xs text-zinc-500">
                        {(doc.file_size / 1024).toFixed(0)} KB
                      </span>
                    </>
                  )}
                  <span className="text-zinc-700">·</span>
                  <span className="text-xs text-zinc-500">
                    {new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              {doc.file_url && (
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-white/8 text-zinc-500 hover:text-white transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
