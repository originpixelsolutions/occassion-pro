/**
 * OccasionPro Check-in Service Worker
 *
 * Strategy:
 *   - Cache-first for static assets (JS/CSS/fonts/icons)
 *   - Network-first with offline fallback for API calls
 *   - Background Sync for queued check-in POSTs when offline
 *
 * Background Sync tag: 'checkin-queue'
 */

const CACHE_VERSION = 'v1'
const STATIC_CACHE = `op-checkin-static-${CACHE_VERSION}`
const API_CACHE = `op-checkin-api-${CACHE_VERSION}`
const CHECKIN_QUEUE_TAG = 'checkin-queue'
const CHECKIN_QUEUE_STORE = 'checkin-queue-idb'

// Assets to precache on install
const PRECACHE_URLS = [
  '/checkin-pwa',
  '/_next/static/css/',
]

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Precache manifest itself
      return cache.addAll(['/checkin-manifest.json']).catch(() => {
        // Non-fatal — manifest may not exist yet in dev
      })
    }),
  )
  self.skipWaiting()
})

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Don't intercept non-GET requests (POSTs go through Background Sync)
  if (request.method !== 'GET') return

  // API calls → network-first, fall back to cache
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE))
    return
  }

  // Static assets (_next/static, fonts, icons) → cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE))
    return
  }

  // Navigation (pages) → network-first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithCache(request, STATIC_CACHE))
    return
  }
})

// ─── Background Sync ─────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === CHECKIN_QUEUE_TAG) {
    event.waitUntil(drainCheckinQueue())
  }
})

// ─── Push Notifications (future) ─────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  const { title, body, icon } = event.data.json()
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon ?? '/icons/checkin-192.png',
      badge: '/icons/checkin-192.png',
    }),
  )
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function cacheFirstWithNetwork(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Open a minimal IndexedDB for the pending queue
function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CHECKIN_QUEUE_STORE, 1)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('queue', {
        keyPath: 'id',
        autoIncrement: true,
      })
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = () => reject(req.error)
  })
}

async function getQueueItems(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readonly')
    const req = tx.objectStore('queue').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function deleteQueueItem(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite')
    const req = tx.objectStore('queue').delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function drainCheckinQueue() {
  let db
  try {
    db = await openQueueDB()
  } catch {
    return
  }

  const items = await getQueueItems(db)

  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${item.token}`,
        },
        body: JSON.stringify(item.payload),
      })

      // 409 = already checked in — not an error, remove from queue
      if (res.ok || res.status === 409) {
        await deleteQueueItem(db, item.id)
      }
      // 4xx (not 409) = bad request, drop it to avoid infinite retry
      else if (res.status >= 400 && res.status < 500) {
        await deleteQueueItem(db, item.id)
      }
      // 5xx = server error, leave in queue for next sync
    } catch {
      // Network still down — leave in queue
    }
  }

  // Notify open tabs that sync completed
  const clients = await self.clients.matchAll({ type: 'window' })
  clients.forEach((c) =>
    c.postMessage({ type: 'SYNC_COMPLETE', processed: items.length }),
  )
}
