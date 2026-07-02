// sw.js — Network First: دائماً من الإنترنت أولاً
const VERSION = 'v1';

self.addEventListener('install', e => {
  self.skipWaiting(); // فعّل فوراً بدون انتظار
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key))) // احذف كل الكاش القديم
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // HTML فقط — دائماً من الشبكة
  if (e.request.destination === 'document' || e.request.url.endsWith('.html')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // باقي الملفات — شبكة أولاً ثم كاش
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
