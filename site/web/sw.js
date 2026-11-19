// Service worker страницы /push: показывает уведомление Arcade и по нажатию открывает /push. Ничего не кеширует и
// запросы страниц не трогает. Сообщение сайта — { text }: одна строка, только «сессия такая-то ждёт тебя»
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let text = ''
  try {
    text = event.data ? String(event.data.json().text || '') : ''
  } catch {
    // не JSON — уведомление без текста: браузер всё равно требует что-то показать
  }
  event.waitUntil(
    self.registration.showNotification('Arcade', {
      body: text.slice(0, 140),
      tag: 'arcade-waiting',
      renotify: true,
      icon: '/arcade-192.png',
      data: { url: '/push' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const page = open.find((c) => new URL(c.url).pathname.startsWith('/push'))
      if (page && typeof page.focus === 'function') return page.focus()
      return self.clients.openWindow('/push')
    })(),
  )
})
