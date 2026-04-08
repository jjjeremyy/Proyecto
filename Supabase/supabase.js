import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { fetchConCache, clearCache, CACHE_TTL } from './cache.js';

export { CACHE_TTL };

const supabaseUrl = 'https://xylvokwwiiirjlcjrafb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5bHZva3d3aWlpcmpsY2pyYWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTQ2NTksImV4cCI6MjA4OTE3MDY1OX0.M__8j6m_9glJEoXHvxdG9gXtQ2fE_Fa8yWbBSl-GoS8';

export const supabase = createClient(supabaseUrl, supabaseKey);

const PAGE_SIZE_DEFAULT = 12;
const ESTADOS_PUBLICADOS = [true, 'true', 'publicado', 'Publicado', 'PUBLICADO', 1, '1'];

function normalizarTexto(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

async function ejecutarConsultaPublicados(crearConsulta) {
    let ultimoError = null;

    for (const estado of ESTADOS_PUBLICADOS) {
        const { data, error } = await crearConsulta(estado);
        if (!error) {
            return data;
        }
        ultimoError = error;
    }

    if (ultimoError) {
        console.error('Error filtrando articulos publicados:', ultimoError);
    }

    return null;
}

export async function obtenerArticulos(page = 0, pageSize = PAGE_SIZE_DEFAULT, forceRefresh = false) {
    const cacheKey = `articulos_p${page}_s${pageSize}`;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    return fetchConCache(cacheKey, async () => ejecutarConsultaPublicados((estado) => supabase
        .from('articulos')
        .select('id, titulo, slug, descripcion, imagen_portada, fecha_publicacion, categorias(nombre, slug)')
        .eq('estado', estado)
        .order('fecha_publicacion', { ascending: false })
        .range(from, to)), forceRefresh, CACHE_TTL.articleList);
}

export async function obtenerArticulosRecientes(limit = 4, forceRefresh = false) {
    const cacheKey = `articulos_recientes_${limit}`;

    return fetchConCache(cacheKey, async () => ejecutarConsultaPublicados((estado) => supabase
        .from('articulos')
        .select('titulo, slug, imagen_portada, descripcion, fecha_publicacion, categorias(nombre)')
        .eq('estado', estado)
        .order('fecha_publicacion', { ascending: false })
        .limit(limit)), forceRefresh, CACHE_TTL.articleList);
}

export async function obtenerArticulosBuscador(forceRefresh = false) {
    const cacheKey = 'articulos_buscador';

    return fetchConCache(cacheKey, async () => ejecutarConsultaPublicados((estado) => supabase
        .from('articulos')
        .select('titulo, slug, descripcion, imagen_portada, categorias(nombre)')
        .eq('estado', estado)
        .order('fecha_publicacion', { ascending: false })), forceRefresh, CACHE_TTL.articleList);
}

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

        if (error) {
            console.error('Error obteniendo articulo:', error);
            return null;
        }

        return data;
    }, forceRefresh, CACHE_TTL.articleDetail);
}

export async function obtenerRelacionados(categoriaId, articuloId, forceRefresh = false) {
    const cacheKey = `relacionados_cat${categoriaId}_not${articuloId}`;

    return fetchConCache(cacheKey, async () => ejecutarConsultaPublicados((estado) => supabase
        .from('articulos')
        .select('titulo, slug, imagen_portada, descripcion, categorias(nombre)')
        .eq('categoria_id', categoriaId)
        .eq('estado', estado)
        .neq('id', articuloId)
        .order('fecha_publicacion', { ascending: false })
        .limit(3)), forceRefresh, CACHE_TTL.articleList);
}

export async function obtenerArticulosPorCategoria(categoriaId, page = 0, pageSize = PAGE_SIZE_DEFAULT, forceRefresh = false) {
    const cacheKey = `articulos_cat${categoriaId}_p${page}_s${pageSize}`;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    return fetchConCache(cacheKey, async () => ejecutarConsultaPublicados((estado) => supabase
        .from('articulos')
        .select('titulo, slug, imagen_portada, descripcion')
        .eq('estado', estado)
        .eq('categoria_id', categoriaId)
        .order('fecha_publicacion', { ascending: false })
        .range(from, to)), forceRefresh, CACHE_TTL.articleList);
}

export async function obtenerCategorias(forceRefresh = false) {
    const cacheKey = 'categorias';

    return fetchConCache(cacheKey, async () => {
        const { data, error } = await supabase
            .from('categorias')
            .select('id, nombre, slug');

        if (error) {
            console.error('Error obteniendo categorias:', error);
            return null;
        }

        return data;
    }, forceRefresh, CACHE_TTL.sitemap);
}

export async function obtenerIdCategoria(slug, forceRefresh = false) {
    const cacheKey = `categoria_id_${slug}`;

    return fetchConCache(cacheKey, async () => {
        const categorias = await obtenerCategorias(forceRefresh);
        if (!categorias) return null;

        const slugNormalizado = normalizarTexto(slug);
        const categoria = categorias.find((item) =>
            item.slug === slug ||
            normalizarTexto(item.slug) === slugNormalizado ||
            normalizarTexto(item.nombre) === slugNormalizado
        );

        return categoria?.id ?? null;
    }, forceRefresh, CACHE_TTL.sitemap);
}

export async function obtenerTodosArticulos() {
    const { data, error } = await supabase
        .from('articulos')
        .select('*, categorias (nombre, slug)')
        .order('fecha_publicacion', { ascending: false });

    if (error) console.error('Error:', error);
    return data;
}

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
