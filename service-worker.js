const CACHE_NAME = 'trangchu-noibo-v4-fix-notification-click';

// Lấy đúng thư mục gốc của PWA theo scope.
// Ví dụ:
// - Domain riêng: https://abc.com/              => scope /
// - GitHub Pages: https://abc.github.io/app/   => scope /app/
const APP_SCOPE_URL = new URL(self.registration?.scope || './', self.location.href);

function resolveAppUrl(target = './') {
  try {
    const raw = String(target || './').trim();

    // Cho phép URL đầy đủ cùng domain. Nếu khác domain thì quay về trang chủ app để an toàn.
    if (/^https?:\/\//i.test(raw)) {
      const fullUrl = new URL(raw);
      return fullUrl.origin === self.location.origin ? fullUrl.href : APP_SCOPE_URL.href;
    }

    // Quan trọng: nếu payload gửi kiểu /hang-loi/ thì coi nó là đường dẫn trong app,
    // không mở từ gốc domain. Fix lỗi app nằm trong thư mục con như /trangchu-main/.
    const cleanPath = raw.startsWith('/') ? raw.replace(/^\/+/, '') : raw;
    return new URL(cleanPath || './', APP_SCOPE_URL).href;
  } catch (error) {
    return APP_SCOPE_URL.href;
  }
}

const APP_SHELL = [
  './',
  'index.html',
  'admin.html',
  'hang-loi/',
  'hang-loi/index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
].map(resolveAppUrl);

const BADGE_DB_NAME = 'trangchu-pwa-badge-db';
const BADGE_DB_VERSION = 1;
const BADGE_STORE = 'badge_state';
const BADGE_KEY = 'notification_count';
const BADGE_MAX_COUNT = 99;

function normalizeBadgeCount(count) {
  const value = Number(count);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.floor(value), BADGE_MAX_COUNT);
}

function openBadgeDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) return resolve(null);

    const request = indexedDB.open(BADGE_DB_NAME, BADGE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BADGE_STORE)) db.createObjectStore(BADGE_STORE);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredBadgeCount() {
  const db = await openBadgeDb().catch(() => null);
  if (!db) return 0;

  return new Promise(resolve => {
    const tx = db.transaction(BADGE_STORE, 'readonly');
    const store = tx.objectStore(BADGE_STORE);
    const request = store.get(BADGE_KEY);

    request.onsuccess = () => resolve(normalizeBadgeCount(request.result || 0));
    request.onerror = () => resolve(0);
    tx.oncomplete = () => db.close();
  });
}

async function saveStoredBadgeCount(count) {
  const badgeCount = normalizeBadgeCount(count);
  const db = await openBadgeDb().catch(() => null);
  if (!db) return badgeCount;

  return new Promise(resolve => {
    const tx = db.transaction(BADGE_STORE, 'readwrite');
    const store = tx.objectStore(BADGE_STORE);
    store.put(badgeCount, BADGE_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve(badgeCount);
    };
    tx.onerror = () => {
      db.close();
      resolve(badgeCount);
    };
  });
}

async function applyAppBadge(count) {
  const badgeCount = await saveStoredBadgeCount(count);

  try {
    if (!self.registration) return badgeCount;

    if (badgeCount > 0 && 'setAppBadge' in self.registration) {
      await self.registration.setAppBadge(badgeCount);
    } else if (badgeCount <= 0 && 'clearAppBadge' in self.registration) {
      await self.registration.clearAppBadge();
    }
  } catch (error) {
    console.warn('Không cập nhật được badge PWA từ Service Worker:', error?.message || error);
  }

  return badgeCount;
}

async function increaseAppBadge() {
  const current = await getStoredBadgeCount();
  return applyAppBadge(current + 1);
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await caches.keys().then(keys => Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)));
    await applyAppBadge(await getStoredBadgeCount());
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(APP_SCOPE_URL.href)) return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then(res => res || caches.match(resolveAppUrl('index.html'))))
  );
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'PWA_BADGE_SET') return;

  event.waitUntil(applyAppBadge(data.count || 0));
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
    icon: resolveAppUrl('icons/icon-192.png'),
    badge: resolveAppUrl('icons/icon-192.png'),
    tag: data.defect_id ? `defect-${data.defect_id}` : 'defect-notification',
    renotify: true,
    data: {
      url: data.url || 'hang-loi/',
      defect_id: data.defect_id || null,
      notification_id: data.notification_id || null
    }
  };

  event.waitUntil((async () => {
    if (data.badge_count !== undefined || data.unread_count !== undefined) {
      await applyAppBadge(data.badge_count ?? data.unread_count);
    } else {
      await increaseAppBadge();
    }

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  // Fix đường dẫn khi bấm thông báo trên điện thoại:
  // /hang-loi/ sẽ được đổi thành <scope-của-app>/hang-loi/
  const urlToOpen = resolveAppUrl(event.notification.data?.url || 'hang-loi/');

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of windowClients) {
      const isSameApp = client.url && client.url.startsWith(APP_SCOPE_URL.href);
      if (!isSameApp) continue;

      try {
        await client.focus();
        if ('navigate' in client) return client.navigate(urlToOpen);
        return;
      } catch (error) {
        console.warn('Không chuyển được tab app cũ, sẽ mở tab mới:', error?.message || error);
      }
    }

    if (clients.openWindow) return clients.openWindow(urlToOpen);
  })());
});
