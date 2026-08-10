const SHELL_URLS = ["/", "/dashboard", "/icon.svg", "/manifest.webmanifest"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("snark-shell-v1").then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).catch(() => cached)
    })
  )
})

self.addEventListener("push", (event) => {
  let payload = { title: "SNARK", body: "Новое уведомление", url: "/" }
  try {
    if (event.data) {
      const data = event.data.json()
      payload = {
        title: data.title || payload.title,
        body: data.body || data.message || payload.body,
        url: data.url || data.href || "/",
      }
    }
  } catch {
    // keep defaults
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      data: { url: payload.url },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
