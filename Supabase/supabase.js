// =============================================
// SUPABASE.JS — SistemaBase
// Cliente Supabase + funciones optimizadas
// con caché, paginación y selección de campos
// =============================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import { fetchConCache, clearCache, CACHE_TTL } from './cache.js'

export { CACHE_TTL };  // re-exportar para que articulo.js pueda importarlo

const supabaseUrl = 'https://xylvokwwiiirjlcjrafb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5bHZva3d3aWlpcmpsY2pyYWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTQ2NTksImV4cCI6MjA4OTE3MDY1OX0.M__8j6m_9glJEoXHvxdG9gXtQ2fE_Fa8yWbBSl-GoS8'

export const supabase = createClient(supabaseUrl, supabaseKey)

const PAGE_SIZE_DEFAULT = 12;

// ── Artículos publicados (listado paginado) ────────────
export async function obtenerArticulos(page = 0, pageSize = PAGE_SIZE_DEFAULT, forceRefresh = false) {
    const cacheKey = `articulos_p${page}_s${pageSize}`;
    const from = page * pageSize;
    const to   = from + pageSize - 1;

    return fetchConCache(cacheKey, async () => {
        const { data, error } = await supabase
            .from('articulos')
            .select('id, titulo, slug, descripcion, imagen_portada, fecha_publicacion, categorias(nombre, slug)')
            .eq('estado', true)
            .order('fecha_publicacion', { ascending: false })
            .range(from, to);

        if (error) { console.error('Error obteniendo artículos:', error); return null; }
        return data;
    }, forceRefresh, CACHE_TTL.articleList);
}

// ── Artículos recientes para Home ──────────────────────
export async function obtenerArticulosRecientes(limit = 4, forceRefresh = false) {
    const cacheKey = `articulos_recientes_${limit}`;

    return fetchConCache(cacheKey, async () => {
        const { data, error } = await supabase
            .from('articulos')
            .select('titulo, slug, imagen_portada, descripcion, fecha_publicacion, categorias(nombre)')
            .eq('estado', true)
            .order('fecha_publicacion', { ascending: false })
            .limit(limit);

        if (error) { console.error('Error obteniendo artículos recientes:', error); return null; }
        return data;
    }, forceRefresh, CACHE_TTL.articleList);
}

// ── Artículos para buscador ────────────────────────────
export async function obtenerArticulosBuscador(forceRefresh = false) {
  const cacheKey = 'articulos_buscador';
  return fetchConCache(cacheKey, async () => {
    const { data, error } = await supabase
      .from('articulos')
      .select('titulo, slug, descripcion, imagen_portada, categorias(nombre)')
      .eq('estado', true)
      .order('fecha_publicacion', { ascending: false })
      .limit(200); // límite explícito — antes era ilimitado
    if (error) { console.error(error); return null; }
    return data;
  }, forceRefresh, CACHE_TTL.articleList);
}

// ── Artículo individual por slug ───────────────────────
export async function obtenerArticuloPorSlug(slug, forceRefresh = false) {
    const cacheKey = `articulo_${slug}`;

    return fetchConCache(cacheKey, async () => {
        const { data, error } = await supabase
            .from('articulos')
            .select(`
                id,
                titulo,
                slug,
                descripcion,
                contenido,
                imagen_portada,
                fecha_publicacion,
                estado,
                categoria_id,
                categorias ( id, nombre )
            `)
            .eq('slug', slug)
            .maybeSingle();

        if (error) { console.error('Error obteniendo artículo:', error); return null; }
        return data;
    }, forceRefresh, CACHE_TTL.articleDetail);
}

// ── Artículos relacionados ─────────────────────────────
export async function obtenerRelacionados(categoriaId, articuloId, forceRefresh = false) {
    const cacheKey = `relacionados_cat${categoriaId}_not${articuloId}`;

    return fetchConCache(cacheKey, async () => {
        const { data, error } = await supabase
            .from('articulos')
            .select('titulo, slug, imagen_portada, descripcion, categorias(nombre)')
            .eq('categoria_id', categoriaId)
            .eq('estado', true)
            .neq('id', articuloId)
            .order('fecha_publicacion', { ascending: false })
            .limit(3);

        if (error) { console.error('Error obteniendo relacionados:', error); return null; }
        return data;
    }, forceRefresh, CACHE_TTL.articleList);
}

// ── Artículos por categoría (paginados) ────────────────
export async function obtenerArticulosPorCategoria(categoriaId, page = 0, pageSize = PAGE_SIZE_DEFAULT, forceRefresh = false) {
    const cacheKey = `articulos_cat${categoriaId}_p${page}_s${pageSize}`;
    const from = page * pageSize;
    const to   = from + pageSize - 1;

    return fetchConCache(cacheKey, async () => {
        const { data, error } = await supabase
            .from('articulos')
            .select('titulo, slug, imagen_portada, descripcion')
            .eq('estado', true)
            .eq('categoria_id', categoriaId)
            .order('fecha_publicacion', { ascending: false })
            .range(from, to);

        if (error) { console.error('Error obteniendo artículos por categoría:', error); return null; }
        return data;
    }, forceRefresh, CACHE_TTL.articleList);
}

// ── Categorías ─────────────────────────────────────────
export async function obtenerCategorias(forceRefresh = false) {
    const cacheKey = 'categorias';

    return fetchConCache(cacheKey, async () => {
        const { data, error } = await supabase
            .from('categorias')
            .select('id, nombre, slug');

        if (error) { console.error('Error obteniendo categorías:', error); return null; }
        return data;
    }, forceRefresh, CACHE_TTL.sitemap);
}

// ── ID de categoría por slug ───────────────────────────
export async function obtenerIdCategoria(slug, forceRefresh = false) {
    const cacheKey = `categoria_id_${slug}`;

    return fetchConCache(cacheKey, async () => {
        const { data, error } = await supabase
            .from('categorias')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

        if (error) { console.error('Error buscando categoría:', error); return null; }
        return data?.id ?? null;
    }, forceRefresh, CACHE_TTL.sitemap);
}

// ── Todos los artículos (admin — sin caché) ────────────
export async function obtenerTodosArticulos() {
    const { data, error } = await supabase
        .from('articulos')
        .select('*, categorias (nombre, slug)')
        .order('fecha_publicacion', { ascending: false });

    if (error) console.error('Error:', error);
    return data;
}

// =============================================
// FUNCIONES DE ESCRITURA (invalidan caché)
// =============================================

export async function crearArticulo(nuevoArticulo) {
    const { data, error } = await supabase.from('articulos').insert([nuevoArticulo]);
    if (error) throw error;
    clearCache();
    return data;
}

export async function cambiarEstadoArticulo(id, nuevoEstado) {
    const { data, error } = await supabase.from('articulos').update({ estado: nuevoEstado }).eq('id', id);
    if (error) throw error;
    clearCache();
    return data;
}

export async function actualizarArticulo(id, datos) {
    const { data, error } = await supabase.from('articulos').update(datos).eq('id', id);
    if (error) throw error;
    clearCache();
    return data;
}

export async function eliminarArticulo(id) {
    const { data, error } = await supabase.from('articulos').delete().eq('id', id);
    if (error) throw error;
    clearCache();
    return data;
}

export async function buscarArticulos(query) {
  const { data, error } = await supabase
    .from('articulos')
    .select('titulo, slug, descripcion, imagen_portada, categorias(nombre)')
    .eq('estado', true)
    .textSearch('fts', query, { type: 'websearch', config: 'spanish' })
    .limit(8);
  if (error) { console.error(error); return []; }
  return data;
}