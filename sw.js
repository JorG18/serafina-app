// Primero la red (así siempre tiene la última versión); si no hay internet, lo que quedó guardado.
// Los datos de la planilla no pasan por acá: van directo a Google.
const CACHE = 'serafina-app';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request)
    .then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
