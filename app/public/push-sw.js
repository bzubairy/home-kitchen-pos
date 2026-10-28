// Push notification handling, loaded into the app's service worker (see vite.config.ts).

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kitchen Manager', {
      body: data.body || '',
      tag: data.tag,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: data.url || '/' },
      requireInteraction: true,
      // Reminders reuse the order's tag; renotify makes them ring again instead of updating silently.
      renotify: Boolean(data.tag),
      // Long, strong vibration (Android; iPhone ignores this).
      vibrate: [600, 200, 600, 200, 600, 200, 600],
    }),
  )
})

// Tapping the notification opens (or focuses) the app on that order.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if ('focus' in win) {
          win.navigate(url).catch(() => {})
          return win.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
