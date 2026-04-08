// =============================================
// CACHE.JS - Sistema de cache de dos niveles
// Nivel 1: Memoria (Map)
// Nivel 2: localStorage
// =============================================

const CACHE_PREFIX = 'sb_cache_';
const CACHE_VERSION = 'v2';
const memoryCache = new Map();

export const CACHE_TTL = {
    articleList: 60 * 60 * 1000,
    articleDetail: 24 * 60 * 60 * 1000,
    sitemap: 7 * 24 * 60 * 60 * 1000,
};

function isCacheableKey(key) {
    const blockedWords = ['session', 'user', 'token', 'auth'];
    return !blockedWords.some(word => key.toLowerCase().includes(word));
}

export function getCache(key, ttl = CACHE_TTL.articleList) {
    const fullKey = CACHE_PREFIX + key;

    if (memoryCache.has(fullKey)) {
        const entry = memoryCache.get(fullKey);
        if (entry.version === CACHE_VERSION && Date.now() - entry.timestamp < ttl) {
            return entry.data;
        }
        memoryCache.delete(fullKey);
    }

    try {
        const raw = localStorage.getItem(fullKey);
        if (!raw) return null;

        const entry = JSON.parse(raw);
        if (entry.version !== CACHE_VERSION) {
            localStorage.removeItem(fullKey);
            return null;
        }

        if (Date.now() - entry.timestamp < ttl) {
            memoryCache.set(fullKey, entry);
            return entry.data;
        }

        localStorage.removeItem(fullKey);
    } catch (error) {
        console.warn('[Cache] Error leyendo localStorage:', error);
        try {
            localStorage.removeItem(fullKey);
        } catch (_) {}
    }

    return null;
}

export function setCache(key, data) {
    if (!isCacheableKey(key)) {
        console.warn('[Cache] Clave denegada por politica de seguridad:', key);
        return;
    }

    const fullKey = CACHE_PREFIX + key;
    const entry = {
        data,
        timestamp: Date.now(),
        version: CACHE_VERSION,
    };

    memoryCache.set(fullKey, entry);

    try {
        localStorage.setItem(fullKey, JSON.stringify(entry));
    } catch (error) {
        console.warn('[Cache] No se pudo guardar en localStorage:', error);
        clearCache();
    }
}

export function clearCache(key) {
    if (key) {
        const fullKey = CACHE_PREFIX + key;
        memoryCache.delete(fullKey);
        localStorage.removeItem(fullKey);
        return;
    }

    memoryCache.clear();

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const currentKey = localStorage.key(i);
        if (currentKey && currentKey.startsWith(CACHE_PREFIX)) {
            keysToRemove.push(currentKey);
        }
    }

    keysToRemove.forEach(currentKey => localStorage.removeItem(currentKey));
}

export async function fetchConCache(cacheKey, fetchFn, forceRefresh = false, ttl = CACHE_TTL.articleList) {
    if (!forceRefresh) {
        const cached = getCache(cacheKey, ttl);
        if (cached !== null) {
            console.log(`[Cache] HIT - "${cacheKey}"`);
            return cached;
        }
    }

    console.log(`[Cache] MISS - "${cacheKey}" -> consultando Supabase`);
    const data = await fetchFn();

    if (data !== null) {
        setCache(cacheKey, data);
    }

    return data;
}
