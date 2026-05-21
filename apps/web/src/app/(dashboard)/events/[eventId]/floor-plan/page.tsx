'use client'

import dynamic from 'next/dynamic'

// Konva requires browser APIs — load client-only
const FloorPlanEditorClient = dynamic(
  () => import('@/components/floor-plan/FloorPlanEditorClient'),
  { ssr: false, loading: () => (
    <div className="h-screen w-full flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-white/40 text-sm animate-pulse">Loading Floor Plan Editor…</div>
    </div>
  )},
)

export default function FloorPlanPage() {
  return <FloorPlanEditorClient />
}
