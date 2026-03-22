// =============================================
// ARTICULO.JS — SistemaBase
// Lee ?slug= de la URL y carga el artículo
// desde Supabase rellenando la plantilla HTML.
// =============================================
import { supabase } from '../Supabase/supabase.js';

// --------------------------------------------------
// 1. LEER LA slug (slug) DE LA URL
//    Ejemplo: /articulo/?slug=que-es-la-ia
// --------------------------------------------------
const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');

if (!slug) {
    mostrarError('No se ha especificado ningún artículo.');
} else {
    cargarArticulo(slug);
}

// --------------------------------------------------
// 2. CARGAR EL ARTÍCULO DESDE SUPABASE
// --------------------------------------------------
async function cargarArticulo(slug) {
    document.getElementById('article-loading').classList.remove('hidden');
    document.getElementById('article-main').classList.add('hidden');

    // JOIN con categorías para obtener el nombre de la categoría
    const { data: articulo, error } = await supabase
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
        .eq('estado', true)        // estado es BOOLEAN en tu BD
        .maybeSingle();

    document.getElementById('article-loading').classList.add('hidden');

    if (error || !articulo) {
        mostrarError('Artículo no encontrado o no está publicado.');
        return;
    }

    rellenarArticulo(articulo);
    cargarRelacionados(articulo.categoria_id, articulo.id);
}

// --------------------------------------------------
// 3. RELLENAR LA PLANTILLA CON LOS DATOS
// --------------------------------------------------
function rellenarArticulo(a) {
    const categoria = a.categorias?.nombre || '';

    // Pestaña del navegador
    document.title = `SistemaBase | ${a.titulo}`;

    // Meta descripción SEO
    setMeta('description', a.descripcion || a.titulo);

    // Breadcrumb
    setText('breadcrumb-categoria-text', categoria);
    setAttr('breadcrumb-categoria-link', 'href', `/Categorias/categorias.html`);
    setText('breadcrumb-titulo-text', truncar(a.titulo, 45));

    // Cabecera
    setText('article-category-badge', categoria.toUpperCase());
    setText('article-date', formatearFecha(a.fecha_publicacion));

    // Título y descripción
    setText('article-title',    a.titulo);
    setText('article-subtitle', a.descripcion || '');

    // Imagen de portada
    if (a.imagen_portada) {
        const img = document.getElementById('article-featured-img');
        if (img) {
            img.src = a.imagen_portada;
            img.alt = a.titulo;
        }
    } else {
        const fig = document.getElementById('article-featured-figure');
        if (fig) fig.style.display = 'none';
    }

    // Contenido (HTML generado por TinyMCE en el admin)
    const bodyEl = document.getElementById('article-body-content');
    if (bodyEl) bodyEl.innerHTML = a.contenido || '';

    // Mostrar el artículo
    document.getElementById('article-main').classList.remove('hidden');

    // Botón compartir
    configurarCompartir(a.titulo, a.slug);
}

// --------------------------------------------------
// 4. ARTÍCULOS RELACIONADOS (misma categoría)
// --------------------------------------------------
async function cargarRelacionados(categoriaId, articuloActualId) {
    const { data, error } = await supabase
        .from('articulos')
        .select('titulo, slug, imagen_portada, descripcion, categorias(nombre)')
        .eq('categoria_id', categoriaId)
        .eq('estado', true)
        .neq('id', articuloActualId)
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
// 5. BOTÓN COMPARTIR
// --------------------------------------------------
function configurarCompartir(titulo, slug) {
    const btn = document.getElementById('btn-share');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const url = `${window.location.origin}/articulo/?slug=${slug}`;
        if (navigator.share) {
            try { await navigator.share({ title: titulo, url }); } catch (_) {}
        } else {
            await navigator.clipboard.writeText(url);
            btn.textContent = '✅ ¡Enlace copiado!';
            setTimeout(() => { btn.textContent = 'Compartir'; }, 2500);
        }
    });
}

// --------------------------------------------------
// ERROR
// --------------------------------------------------
function mostrarError(mensaje) {
    document.getElementById('article-loading').classList.add('hidden');
    const el = document.getElementById('article-error-msg');
    if (el) el.textContent = mensaje;
    document.getElementById('article-error').classList.remove('hidden');
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

function setMeta(name, content) {
    let tag = document.querySelector(`meta[name="${name}"]`);
    if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    // fecha_publicacion es tipo DATE ('YYYY-MM-DD'), añadimos T00:00 para evitar desfase de zona horaria
    return new Date(fecha + 'T00:00').toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

function truncar(texto, max) {
    return texto && texto.length > max ? texto.substring(0, max) + '…' : texto;
}
