const CACHE_NAME = 'trangchu-noibo-v2-push';
const APP_SHELL = [
  '/',
  '/index.html',
  '/admin.html',
  '/hang-loi/',
  '/hang-loi/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then(res => res || caches.match('/index.html')))
  );
});

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Có cập nhật hàng lỗi';
  const bodyParts = [];
  if (data.body || data.message) bodyParts.push(data.body || data.message);
  if (data.product_name) bodyParts.push(`Sản phẩm: ${data.product_name}`);
  if (data.sku) bodyParts.push(`Item: ${data.sku}`);

  const options = {
    body: bodyParts.join('\n') || 'Bấm để mở quản lý hàng lỗi',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.defect_id ? `defect-${data.defect_id}` : 'defect-notification',
    renotify: true,
    data: {
      url: data.url || '/hang-loi/',
      defect_id: data.defect_id || null,
      notification_id: data.notification_id || null
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data?.url || '/hang-loi/', self.location.origin).href;

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windowClients) {
      if ('focus' in client && client.url.startsWith(self.location.origin)) {
        await client.focus();
        if ('navigate' in client) return client.navigate(urlToOpen);
        return;
      }
    }
    if (clients.openWindow) return clients.openWindow(urlToOpen);
  })());
});
