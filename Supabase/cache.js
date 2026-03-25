// =============================================
// CACHE.JS — Sistema de caché de dos niveles
// Nivel 1: Memoria (Map) — acceso instantáneo
// Nivel 2: localStorage — persiste entre recargas
// TTL: 1 hora (3 600 000 ms)
// =============================================

// Prefijo para evitar colisiones con otras claves en localStorage
const CACHE_PREFIX = 'sb_cache_';

// Tiempo de vida del caché: 1 hora en milisegundos
export const CACHE_TTL = {
  articleList: 60 * 60 * 1000,      // 1 hora (antes era fijo)
  articleDetail: 24 * 60 * 60 * 1000, // 24 horas
  sitemap: 7 * 24 * 60 * 60 * 1000,  // 1 semana
};

// ── Nivel 1: caché en memoria ──────────────────────────
const memoryCache = new Map();
const inFlightRequests = new Map();

// ── getCache ───────────────────────────────────────────
// Busca primero en memoria, luego en localStorage.
// Devuelve los datos si existen y no han expirado, o null.
export function getCache(key, ttl = CACHE_TTL.articleList) {
  const fullKey = CACHE_PREFIX + key;

  // 1. Intentar memoria (más rápido)
  if (memoryCache.has(fullKey)) {
    const entry = memoryCache.get(fullKey);
    if (Date.now() - entry.timestamp < ttl) {
      return entry.data;
    }
    // Expirado → limpiar
    memoryCache.delete(fullKey);
  }

  // 2. Intentar localStorage
  try {
    const raw = localStorage.getItem(fullKey);
    if (!raw) return null;

    const entry = JSON.parse(raw);
    const effectiveTtl = entry.ttl ?? ttl;
    if (Date.now() - entry.timestamp < effectiveTtl) {
      // Rehidratar memoria para futuras lecturas rápidas
      memoryCache.set(fullKey, entry);
      return entry.data;
    }

    // Expirado → limpiar
    localStorage.removeItem(fullKey);
  } catch (e) {
    console.warn('[Cache] Error leyendo localStorage:', e);
  }

  return null;
}

// ── setCache ───────────────────────────────────────────
// Guarda en ambos niveles con timestamp actual.
export function setCache(key, data, ttl = CACHE_TTL.articleList) {
  const fullKey = CACHE_PREFIX + key;
  const entry = {
    data,
    timestamp: Date.now(),
    ttl
  };

  // Nivel 1: memoria
  memoryCache.set(fullKey, entry);

  // Nivel 2: localStorage (con protección contra QuotaExceeded)
  try {
    localStorage.setItem(fullKey, JSON.stringify(entry));
  } catch (e) {
    console.warn('[Cache] No se pudo guardar en localStorage:', e);
    // Si el almacenamiento está lleno, limpiar caché antiguo e intentar de nuevo
    clearCache();
    try {
      localStorage.setItem(fullKey, JSON.stringify(entry));
    } catch (_) { /* silenciar */ }
  }
}

// ── clearCache ─────────────────────────────────────────
// Sin argumento: borra TODAS las claves con el prefijo.
// Con argumento: borra solo esa clave específica.
export function clearCache(key) {
  if (key) {
    const fullKey = CACHE_PREFIX + key;
    memoryCache.delete(fullKey);
    inFlightRequests.delete(fullKey);
    localStorage.removeItem(fullKey);
    return;
  }

  // Borrar todo el caché prefijado
  memoryCache.clear();
  inFlightRequests.clear();

  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

// ── fetchConCache ──────────────────────────────────────
// Función genérica que implementa el patrón cache-first:
//   1. Revisa el caché
//   2. Si no hay datos válidos, ejecuta la función de fetch
//   3. Guarda el resultado en caché
//   4. Devuelve los datos
//
// Parámetros:
//   cacheKey  — clave única para esta consulta
//   fetchFn   — función async que devuelve los datos frescos
//   forceRefresh — si true, ignora el caché y fuerza petición
//
// Devuelve: los datos (desde caché o desde Supabase)
export async function fetchConCache(cacheKey, fetchFn, forceRefresh = false, ttl = CACHE_TTL.articleList) {
  const fullKey = CACHE_PREFIX + cacheKey;

  // 1. Revisar caché (si no se fuerza refresco)
  if (!forceRefresh) {
    const cached = getCache(cacheKey, ttl);
    if (cached !== null) {
      console.log(`[Cache] HIT — "${cacheKey}"`);
      return cached;
    }

    if (inFlightRequests.has(fullKey)) {
      console.log(`[Cache] WAIT — "${cacheKey}"`);
      return inFlightRequests.get(fullKey);
    }
  }

  // 2. Ejecutar la petición real
  console.log(`[Cache] MISS — "${cacheKey}" → consultando Supabase`);
  const requestPromise = (async () => {
    const data = await fetchFn();

    // 3. Guardar en caché (solo si hay datos válidos)
    if (data !== null) setCache(cacheKey, data, ttl);

    // 4. Devolver los datos
    return data;
  })();

  inFlightRequests.set(fullKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(fullKey);
  }
}
