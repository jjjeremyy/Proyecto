// ═══════════════════════════════════════════════════
// CACHE.JS — Sistema de 4 niveles con TTL inteligente
// L1: Map en RAM (0ms)  L2: localStorage (0ms)
// L3: CDN headers       L4: Supabase (solo en build)
// ═══════════════════════════════════════════════════

const PREFIX  = 'sb_v2_';
const memCache = new Map();

// TTLs configurables por tipo de contenido
export const TTL = {
  articleDetail : 24 * 60 * 60 * 1000,  // 24h — cambia poco
  articleList   :       60 * 60 * 1000,  // 1h  — puede crecer
  categories    :  7 * 24 * 60 * 60 * 1000, // 7d  — casi estático
  search        :       30 * 60 * 1000,  // 30m — buscador
};

// ── Protección thundering herd: promesas en vuelo ──
const inflight = new Map();

export async function fetchWithCache(key, fetchFn, ttl = TTL.articleList) {
  const fullKey = PREFIX + key;

  // 1. Memoria (0ms)
  const memHit = readMem(fullKey, ttl);
  if (memHit !== null) return memHit;

  // 2. localStorage (0ms, persiste entre recargas)
  const lsHit = readLS(fullKey, ttl);
  if (lsHit !== null) {
    writeMem(fullKey, lsHit);  // repoblar L1
    return lsHit;
  }

  // 3. Evitar que múltiples peticiones simultáneas llamen a Supabase
  if (inflight.has(fullKey)) {
    return inflight.get(fullKey);
  }

  // 4. Fetch real (Supabase) — solo si no hay nada en caché
  const promise = fetchFn().then(data => {
    inflight.delete(fullKey);
    if (data !== null) {
      writeMem(fullKey, data);
      writeLS(fullKey, data);
    }
    return data;
  }).catch(err => {
    inflight.delete(fullKey);
    throw err;
  });

  inflight.set(fullKey, promise);
  return promise;
}

// Invalidar todo cuando el admin publica/actualiza
export function invalidateCache(pattern) {
  // Limpiar memoria
  for (const k of memCache.keys()) {
    if (!pattern || k.includes(pattern)) memCache.delete(k);
  }
  // Limpiar localStorage
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX) && (!pattern || k.includes(pattern)))
      .forEach(k => localStorage.removeItem(k));
  } catch (_) {}
}

// ── Helpers internos ──────────────────────────────
function readMem(key, ttl) {
  const e = memCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > ttl) { memCache.delete(key); return null; }
  return e.data;
}

function writeMem(key, data) {
  memCache.set(key, { data, ts: Date.now() });
}

function readLS(key, ttl) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttl) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function writeLS(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch (e) {
    if (e.name === 'QuotaExceededError') purgeLeastRecent();
  }
}

function purgeLeastRecent() {
  const entries = Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .map(k => ({ k, ts: JSON.parse(localStorage.getItem(k) || '{"ts":0}').ts }))
    .sort((a, b) => a.ts - b.ts);

  // Eliminar la mitad más antigua
  entries.slice(0, Math.ceil(entries.length / 2))
         .forEach(({ k }) => localStorage.removeItem(k));
}