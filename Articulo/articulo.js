// =============================================
// ARTICULO.JS — SistemaBase
// Carga dinámicamente los datos del artículo
// desde Supabase usando el slug de la URL.
//
// URL esperada: /articulo/?slug=nombre-del-articulo
// =============================================

import { supabase } from '../Supabase/supabase.js';

// --------------------------------------------------
// 1. LEER EL SLUG DE LA URL
// --------------------------------------------------
const params = new URLSearchParams(window.location.search);
const slug   = params.get('slug');

if (!slug) {
    mostrarError('No se ha especificado ningún artículo.');
} else {
    cargarArticulo(slug);
}

// --------------------------------------------------
// 2. CARGAR EL ARTÍCULO DESDE SUPABASE
// --------------------------------------------------
async function cargarArticulo(slug) {
    // Mostrar estado de carga
    document.getElementById('article-loading').classList.remove('hidden');
    document.getElementById('article-main').classList.add('hidden');

    // Consultar artículo + su categoría en una sola query
    const { data: articulo, error } = await supabase
        .from('articulos')
        .select(`
            *,
            categorias ( id, nombre )
        `)
        .eq('slug', slug)
        .eq('estado', 'publicado')
        .single();

    document.getElementById('article-loading').classList.add('hidden');

    if (error || !articulo) {
        mostrarError('Artículo no encontrado o no está publicado.');
        return;
    }

    // --------------------------------------------------
    // 3. RELLENAR LA PLANTILLA CON LOS DATOS
    // --------------------------------------------------
    rellenarArticulo(articulo);

    // --------------------------------------------------
    // 4. CARGAR ARTÍCULOS RELACIONADOS (misma categoría)
    // --------------------------------------------------
    if (articulo.categoria_id) {
        cargarRelacionados(articulo.categoria_id, articulo.id);
    }
}

// --------------------------------------------------
// FUNCIÓN PRINCIPAL: rellena todos los elementos HTML
// --------------------------------------------------
function rellenarArticulo(a) {
    const categoria = a.categorias?.nombre || '';

    // <title> del navegador
    document.title = `SistemaBase | ${a.titulo}`;

    // Meta descripción (SEO)
    setMeta('description', a.subtitulo || a.titulo);

    // Open Graph (redes sociales)
    setMeta('og:title',       a.titulo,        'property');
    setMeta('og:description', a.subtitulo || '', 'property');
    setMeta('og:image',       a.imagen_portada || '', 'property');
    setMeta('og:type',        'article',        'property');

    // Breadcrumb
    setText('breadcrumb-categoria-text', categoria);
    setAttr('breadcrumb-categoria-link', 'href', `/Categorias/categorias.html?cat=${a.categoria_id}`);
    setText('breadcrumb-titulo-text', truncar(a.titulo, 40));

    // Meta superior
    setText('article-category-badge',   categoria.toUpperCase());
    setText('article-date',             formatearFecha(a.fecha_publicacion));
    setText('article-read-time',        a.tiempo_lectura ? `⏱ ${a.tiempo_lectura} min de lectura` : '');

    // Título y subtítulo
    setText('article-title',    a.titulo);
    setText('article-subtitle', a.subtitulo || '');

    // Autor
    setText('article-author-name', a.autor || 'SistemaBase');

    // Imagen de portada
    if (a.imagen_portada) {
        const img = document.getElementById('article-featured-img');
        if (img) {
            img.src = a.imagen_portada;
            img.alt = a.titulo;
        }
    } else {
        // Ocultar figura si no hay imagen
        const fig = document.getElementById('article-featured-figure');
        if (fig) fig.style.display = 'none';
    }

    // Contenido principal (HTML sanitizado)
    const contenidoEl = document.getElementById('article-body-content');
    if (contenidoEl) {
        contenidoEl.innerHTML = a.contenido || '';
    }

    // Etiquetas
    const tagsContainer = document.getElementById('article-tags-container');
    if (tagsContainer && a.etiquetas && a.etiquetas.length > 0) {
        tagsContainer.innerHTML =
            `<span class="tags-label">Etiquetas:</span>` +
            a.etiquetas.map(tag =>
                `<a href="/Categorias/categorias.html?tag=${encodeURIComponent(tag)}" class="tag">${tag}</a>`
            ).join('');
    } else if (tagsContainer) {
        tagsContainer.style.display = 'none';
    }

    // Mostrar el artículo
    document.getElementById('article-main').classList.remove('hidden');

    // Botón compartir
    configurarCompartir(a.titulo, slug);
}

// --------------------------------------------------
// ARTÍCULOS RELACIONADOS
// --------------------------------------------------
async function cargarRelacionados(categoriaId, articuloActualId) {
    const { data, error } = await supabase
        .from('articulos')
        .select('titulo, slug, imagen_portada, categorias(nombre)')
        .eq('categoria_id', categoriaId)
        .eq('estado', 'publicado')
        .neq('id', articuloActualId)     // Excluir el artículo actual
        .order('fecha_publicacion', { ascending: false })
        .limit(3);

    if (error || !data || data.length === 0) {
        const section = document.getElementById('related-section');
        if (section) section.style.display = 'none';
        return;
    }

    const grid = document.getElementById('related-grid');
    if (!grid) return;

    grid.innerHTML = data.map(art => `
        <a href="/articulo/?slug=${art.slug}" class="related-card">
            <img src="${art.imagen_portada || '/IMG/IMGprueba.png'}" alt="${art.titulo}">
            <div class="related-card-info">
                <span class="related-category">${art.categorias?.nombre || ''}</span>
                <h4>${art.titulo}</h4>
            </div>
        </a>
    `).join('');
}

// --------------------------------------------------
// BOTÓN COMPARTIR
// --------------------------------------------------
function configurarCompartir(titulo, slug) {
    const btnShare = document.getElementById('btn-share');
    if (!btnShare) return;

    btnShare.addEventListener('click', async () => {
        const url = `${window.location.origin}/articulo/?slug=${slug}`;

        if (navigator.share) {
            // API nativa de compartir (móvil)
            try {
                await navigator.share({ title: titulo, url });
            } catch (e) { /* El usuario canceló */ }
        } else {
            // Fallback: copiar al portapapeles
            await navigator.clipboard.writeText(url);
            btnShare.textContent = '✅ ¡Enlace copiado!';
            setTimeout(() => { btnShare.textContent = 'Compartir'; }, 2500);
        }
    });
}

// --------------------------------------------------
// ERROR: artículo no encontrado
// --------------------------------------------------
function mostrarError(mensaje) {
    document.getElementById('article-loading').classList.add('hidden');
    const errorEl = document.getElementById('article-error');
    if (errorEl) {
        errorEl.textContent = mensaje;
        errorEl.classList.remove('hidden');
    }
}

// --------------------------------------------------
// UTILIDADES
// --------------------------------------------------
function setText(id, texto) {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
}

function setAttr(id, attr, valor) {
    const el = document.getElementById(id);
    if (el) el.setAttribute(attr, valor);
}

function setMeta(name, content, attr = 'name') {
    let tag = document.querySelector(`meta[${attr}="${name}"]`);
    if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, name);
        document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
}

function formatearFecha(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

function truncar(texto, max) {
    return texto && texto.length > max ? texto.substring(0, max) + '…' : texto;
}
