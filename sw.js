const CACHE = 'score-v39';
const ASSETS = ['./index.html', './manifest.json', './score-logo.png', './score-logo-dark.png', './score-logo-gold.png', './score-logo-guide.png', './presentation-score-cbta.html', './score-logo-presentation.png', './manifest-presentation.json', './apple-touch-icon-presentation.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isAppPage = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match(e.request).then(cached => {
        if (cached) return cached;
        if (isAppPage) return caches.match('./index.html');
        return new Response('Offline', {status: 503});
      }))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return response;
        }).catch(() => new Response('Offline', {status: 503}));
      })
    );
  }
});
