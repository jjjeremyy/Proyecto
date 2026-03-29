import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { fetchWithCache, invalidateCache, TTL } from './cache.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Campos mínimos para listado (no pedir 'contenido' — puede ser 50KB) ──
const LIST_FIELDS = 'titulo,slug,descripcion,imagen_portada,fecha_publicacion,categorias(nombre)';

// ── Artículo por slug (hit más frecuente) ──────────
export async function obtenerArticuloPorSlug(slug) {
  return fetchWithCache(`art_${slug}`, async () => {
    const { data, error } = await supabase
      .from('articulos')
      .select(`
        id, titulo, slug, descripcion, contenido,
        imagen_portada, fecha_publicacion, categoria_id,
        categorias(id, nombre)
      `)
      .eq('slug', slug)       // usa el índice único
      .eq('estado', true)
      .maybeSingle();

    if (error) { console.error('[Supabase]', error); return null; }
    return data;
  }, TTL.articleDetail);
}

// ── Listado reciente — SIN el campo 'contenido' ────
export async function obtenerArticulosRecientes(limit = 4) {
  return fetchWithCache(`recientes_${limit}`, async () => {
    const { data, error } = await supabase
      .from('articulos')
      .select(LIST_FIELDS)
      .eq('estado', true)
      .order('fecha_publicacion', { ascending: false })
      .limit(limit);

    if (error) { console.error('[Supabase]', error); return null; }
    return data;
  }, TTL.articleList);
}

// ── Buscador — carga diferida al primer focus ──────
export async function obtenerArticulosBuscador() {
  return fetchWithCache('buscador_all', async () => {
    const { data, error } = await supabase
      .from('articulos')
      .select('titulo,slug,descripcion,imagen_portada,categorias(nombre)')
      .eq('estado', true)
      .order('fecha_publicacion', { ascending: false });

    if (error) { console.error('[Supabase]', error); return null; }
    return data;
  }, TTL.search);
}

// ── Escrituras — invalidan caché automáticamente ───
export async function crearArticulo(datos) {
  const { data, error } = await supabase.from('articulos').insert([datos]);
  if (error) throw error;
  invalidateCache();                    // limpiar todo el caché
  await triggerRebuild(datos.slug);     // regenerar HTML en CDN
  return data;
}

export async function actualizarArticulo(id, datos) {
  const { data, error } = await supabase.from('articulos').update(datos).eq('id', id);
  if (error) throw error;
  invalidateCache(`art_${datos.slug}`); // solo el artículo modificado
  await triggerRebuild(datos.slug);
  return data;
}

// Llama al Cloudflare Worker / Netlify webhook para rebuild
async function triggerRebuild(slug) {
  const hookUrl = import.meta.env.REBUILD_HOOK_URL;
  if (!hookUrl) return;
  try {
    await fetch(hookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, ts: Date.now() })
    });
  } catch (e) { console.warn('Rebuild hook failed', e); }
}