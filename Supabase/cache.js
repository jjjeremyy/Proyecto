// =============================================
// CACHE.JS — Sistema de caché de dos niveles
// Nivel 1: Memoria (Map) — acceso instantáneo
// Nivel 2: localStorage — persiste entre recargas
// TTL: 1 hora (3 600 000 ms)
// =============================================

// Prefijo para evitar colisiones con otras claves en localStorage
const CACHE_PREFIX = 'sb_cache_';

// Tiempo de vida del caché: 1 hora en milisegundos
export const CACHE_TTL = 60 * 60 * 1000;

// ── Nivel 1: caché en memoria ──────────────────────────
const memoryCache = new Map();

// ── getCache ───────────────────────────────────────────
// Busca primero en memoria, luego en localStorage.
// Devuelve los datos si existen y no han expirado, o null.
export function getCache(key) {
  const fullKey = CACHE_PREFIX + key;

  // 1. Intentar memoria (más rápido)
  if (memoryCache.has(fullKey)) {
    const entry = memoryCache.get(fullKey);
    if (Date.now() - entry.timestamp < CACHE_TTL) {
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
    if (Date.now() - entry.timestamp < CACHE_TTL) {
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
export function setCache(key, data) {
  const fullKey = CACHE_PREFIX + key;
  const entry = {
    data,
    timestamp: Date.now()
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
    localStorage.removeItem(fullKey);
    return;
  }

  // Borrar todo el caché prefijado
  memoryCache.clear();

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
export async function fetchConCache(cacheKey, fetchFn, forceRefresh = false) {
  // 1. Revisar caché (si no se fuerza refresco)
  if (!forceRefresh) {
    const cached = getCache(cacheKey);
    if (cached !== null) {
      console.log(`[Cache] HIT — "${cacheKey}"`);
      return cached;
    }
  }

  // 2. Ejecutar la petición real
  console.log(`[Cache] MISS — "${cacheKey}" → consultando Supabase`);
  const data = await fetchFn();

  // 3. Guardar en caché (solo si hay datos válidos)
  if (data !== null && data !== undefined) {
    setCache(cacheKey, data);
  }

  // 4. Devolver los datos
  return data;
}
