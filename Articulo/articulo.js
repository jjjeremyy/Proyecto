// ═══════════════════════════════════════════════════
// CARGA PROGRESIVA EN 3 FASES
// Fase 1 (0ms):   Título + metadata desde HTML inline
// Fase 2 (<100ms): Cuerpo del artículo
// Fase 3 (lazy):  Imágenes, relacionados, anuncios
// ═══════════════════════════════════════════════════

// Fase 1: El HTML ya viene del servidor/CDN — CERO JS necesario
// Si usas la solución actual (SPA), al menos marca el critical path:

const t0 = performance.now();

async function cargarArticulo(slug) {
  // ── FASE 2: Contenido principal ──────────────────
  const articulo = await obtenerArticuloPorSlug(slug);
  if (!articulo) { mostrarError(); return; }

  rellenarArticulo(articulo);

  const t1 = performance.now();
  console.log(`[Perf] Contenido principal: ${(t1 - t0).toFixed(0)}ms`);

  // ── FASE 3: Contenido diferido (no bloquea el render) ──
  requestIdleCallback(async () => {
    await Promise.all([
      cargarRelacionados(articulo.categoria_id, articulo.id),
      cargarAnunciosAdsense(),
    ]);
    const t2 = performance.now();
    console.log(`[Perf] Todo cargado: ${(t2 - t0).toFixed(0)}ms`);
  });
}

// Lazy init de AdSense — solo si el usuario ha aceptado cookies
function cargarAnunciosAdsense() {
  const consent = getCookieConsent();
  if (consent !== 'accepted') return;

  // Cargar script de AdSense solo cuando hay consentimiento
  const script = document.createElement('script');
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
  script.async = true;
  script.dataset.adClient = 'ca-pub-XXXXXX';
  document.head.appendChild(script);

  script.onload = () => {
    document.querySelectorAll('.adsbygoogle')
      .forEach(() => (adsbygoogle = window.adsbygoogle || []).push({}));
  };
}

// Web Vitals monitoring inline
function reportVitals() {
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach(e => {
      if (e.entryType === 'largest-contentful-paint') {
        console.log(`[LCP] ${e.startTime.toFixed(0)}ms`);
      }
      if (e.entryType === 'layout-shift' && !e.hadRecentInput) {
        console.log(`[CLS] score: ${e.value.toFixed(4)}`);
      }
    });
  });
  observer.observe({ type: 'largest-contentful-paint', buffered: true });
  observer.observe({ type: 'layout-shift', buffered: true });
}

reportVitals();