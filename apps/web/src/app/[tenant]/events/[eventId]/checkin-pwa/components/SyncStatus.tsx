'use client'

/**
 * SyncStatus
 *
 * Displays online/offline state, pending check-in count, and a manual "Sync Now" button.
 * Shows spinner while sync is in progress.
 */

import type { SyncState } from '../hooks/useOfflineSync'

interface SyncStatusProps {
  syncState: SyncState
  onSyncNow: () => void
}

export function SyncStatus({ syncState, onSyncNow }: SyncStatusProps) {
  const { online, pendingCount, syncing, lastSyncedAt, lastError } = syncState

  const formattedTime = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {/* Online / offline pill */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                    ${online
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`}
        />
        {online ? 'Online' : 'Offline'}
      </div>

      {/* Pending badge */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                        bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {pendingCount} pending
        </div>
      )}

      {/* Sync Now button — only show when online + pending or errored */}
      {online && (pendingCount > 0 || lastError) && (
        <button
          onClick={onSyncNow}
          disabled={syncing}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                     bg-indigo-600/20 text-indigo-400 border border-indigo-500/30
                     hover:bg-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all active:scale-95"
        >
          {syncing ? (
            <>
              <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
              Syncing…
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Now
            </>
          )}
        </button>
      )}

      {/* Last synced time */}
      {formattedTime && pendingCount === 0 && !lastError && (
        <span className="text-xs text-white/25">Synced {formattedTime}</span>
      )}

      {/* Error hint */}
      {lastError && (
        <span className="text-xs text-red-400/80 max-w-[160px] truncate" title={lastError}>
          ⚠ Sync issue
        </span>
      )}
    </div>
  )
}
