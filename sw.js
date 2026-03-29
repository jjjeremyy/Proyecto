const CACHE_NAME = 'sistemabase-v1';
const PRECACHE = [
  '/',
  '/GuiaEstilosCSS/style.css',
  '/Home/home.css',
  '/IMG/LogoSistemaBaseBlanco.png',
];

// Instalar y precargar recursos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Estrategia: Cache First para estáticos, Network First para HTML
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones a Supabase (siempre frescas)
  if (url.hostname.includes('supabase.co')) return;

  // CSS, JS, imágenes: Cache First
  if (request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // HTML: Network First con fallback a caché
  event.respondWith(
    fetch(request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Limpiar cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});