/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  icon?: string
}

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return

  let payload: PushPayload

  try {
    payload = event.data.json() as PushPayload
  } catch {
    payload = { title: 'Club CRM', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: payload.tag ?? 'sports-crm',
      data: { url: payload.url ?? '/' },
      requireInteraction: false,
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  const targetUrl: string = (event.notification.data as { url?: string } | undefined)?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(targetUrl) || targetUrl === '/')
      if (existing) {
        return existing.focus()
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
