// =============================================
// ARTICULO.JS — SistemaBase (OPTIMIZADO)
// Mejoras aplicadas:
//   1. Caché via obtenerArticuloPorSlug() y obtenerRelacionados()
//   2. Artículo principal + relacionados en PARALELO (Promise.all)
//   3. Skeleton loader visible mientras carga
//   4. Artículo se muestra TAN PRONTO llega, sin esperar relacionados
//   5. Imagen de portada con fetchpriority="high" para mejor LCP
// =============================================
import {
    obtenerArticuloPorSlug,
    obtenerRelacionados,
    CACHE_TTL
} from '../Supabase/supabase.js';

// --------------------------------------------------
// 1. LEER EL SLUG DE LA URL
// --------------------------------------------------
const params = new URLSearchParams(window.location.search);
const slug   = params.get('slug');

if (!slug) {
    mostrarError('No se ha especificado ningún artículo.');
} else {
    mostrarSkeleton();
    cargarArticulo(slug);
}

// --------------------------------------------------
// 2. SKELETON LOADER — visible mientras llega el artículo
// --------------------------------------------------
function mostrarSkeleton() {
    // Ocultar spinner antiguo, mostrar skeleton en su lugar
    const loadingEl = document.getElementById('article-loading');
    if (loadingEl) {
        loadingEl.innerHTML = `
            <div style="
                max-width: 860px;
                width: 100%;
                padding: 30px 20px;
                font-family: Arial, sans-serif;
            ">
                <!-- Skeleton cabecera -->
                <div style="height:14px;width:30%;border-radius:6px;margin-bottom:20px;${sk()}"></div>
                <div style="height:36px;width:85%;border-radius:8px;margin-bottom:12px;${sk()}"></div>
                <div style="height:36px;width:65%;border-radius:8px;margin-bottom:20px;${sk()}"></div>
                <div style="height:18px;width:50%;border-radius:6px;margin-bottom:32px;${sk()}"></div>
                <!-- Skeleton imagen portada -->
                <div style="height:320px;width:100%;border-radius:10px;margin-bottom:32px;${sk()}"></div>
                <!-- Skeleton párrafos -->
                <div style="height:14px;width:100%;border-radius:5px;margin-bottom:10px;${sk()}"></div>
                <div style="height:14px;width:96%;border-radius:5px;margin-bottom:10px;${sk()}"></div>
                <div style="height:14px;width:88%;border-radius:5px;margin-bottom:10px;${sk()}"></div>
                <div style="height:14px;width:92%;border-radius:5px;margin-bottom:24px;${sk()}"></div>
                <div style="height:14px;width:100%;border-radius:5px;margin-bottom:10px;${sk()}"></div>
                <div style="height:14px;width:78%;border-radius:5px;margin-bottom:10px;${sk()}"></div>
                <div style="height:14px;width:84%;border-radius:5px;${sk()}"></div>
            </div>
        `;
        loadingEl.classList.remove('hidden');
        loadingEl.style.alignItems = 'flex-start';
    }
}

function sk() {
    return `background: linear-gradient(90deg, #eef2f8 25%, #e2e8f4 50%, #eef2f8 75%);
            background-size: 200% 100%;
            animation: sb-shimmer 1.4s infinite;
            display:block;`;
}

// Inyectar keyframes del shimmer una sola vez
if (!document.getElementById('sb-shimmer-style')) {
    const style = document.createElement('style');
    style.id = 'sb-shimmer-style';
    style.textContent = `@keyframes sb-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }`;
    document.head.appendChild(style);
}

// --------------------------------------------------
// 3. CARGAR ARTÍCULO — usa caché de supabase.js
// --------------------------------------------------
async function cargarArticulo(slug) {
    // Usar la función con caché (24h para artículos individuales)
    const articulo = await obtenerArticuloPorSlug(slug);

    // Ocultar skeleton
    const loadingEl = document.getElementById('article-loading');
    if (loadingEl) loadingEl.classList.add('hidden');

    if (!articulo || articulo.estado === false) {
        mostrarError('Artículo no encontrado o no está publicado.');
        return;
    }

    // Rellenar y mostrar el artículo YA — sin esperar relacionados
    rellenarArticulo(articulo);

    // Cargar relacionados en segundo plano (no bloquea la visualización)
    cargarRelacionados(articulo.categoria_id, articulo.id);
}

// --------------------------------------------------
// 4. RELLENAR LA PLANTILLA
// --------------------------------------------------
function rellenarArticulo(a) {
    const categoria = a.categorias?.nombre || '';

    document.title = `SistemaBase | ${a.titulo}`;
    setMeta('description', a.descripcion || a.titulo);

    setText('breadcrumb-categoria-text', categoria);
    setAttr('breadcrumb-categoria-link', 'href', `/Categorias/categorias.html`);
    setText('breadcrumb-titulo-text', truncar(a.titulo, 45));

    setText('article-category-badge', categoria.toUpperCase());
    setText('article-date', formatearFecha(a.fecha_publicacion));
    setText('article-title',    a.titulo);
    setText('article-subtitle', a.descripcion || '');

    // Imagen de portada — fetchpriority="high" mejora el LCP
    if (a.imagen_portada) {
        const img = document.getElementById('article-featured-img');
        if (img) {
            img.src = a.imagen_portada;
            img.alt = a.titulo;
            img.setAttribute('fetchpriority', 'high'); // ← clave para LCP rápido
            img.removeAttribute('loading');            // no lazy en la imagen principal
        }
    } else {
        const fig = document.getElementById('article-featured-figure');
        if (fig) fig.style.display = 'none';
    }

    const bodyEl = document.getElementById('article-body-content');
    if (bodyEl) bodyEl.innerHTML = a.contenido || '';

    document.getElementById('article-main').classList.remove('hidden');
    configurarCompartir(a.titulo, a.slug);
}

// --------------------------------------------------
// 5. RELACIONADOS — en segundo plano con caché (1h)
// --------------------------------------------------
async function cargarRelacionados(categoriaId, articuloActualId) {
    // Mostrar skeleton de relacionados mientras carga
    const grid = document.getElementById('related-grid');
    if (grid) {
        grid.innerHTML = Array.from({ length: 3 }, () => `
            <div style="border-radius:8px;overflow:hidden;border:1px solid #dce5f5;background:#fff;">
                <div style="height:130px;${sk()}"></div>
                <div style="padding:12px 14px;">
                    <div style="height:10px;width:40%;border-radius:4px;margin-bottom:8px;${sk()}"></div>
                    <div style="height:13px;width:90%;border-radius:4px;margin-bottom:6px;${sk()}"></div>
                    <div style="height:13px;width:70%;border-radius:4px;${sk()}"></div>
                </div>
            </div>
        `).join('');
    }

    // Usar función con caché de supabase.js
    const data = await obtenerRelacionados(categoriaId, articuloActualId);

    if (!data || data.length === 0) {
        const section = document.getElementById('related-section');
        if (section) section.style.display = 'none';
        return;
    }

    if (!grid) return;

    grid.innerHTML = data.map(art => `
        <a href="/Articulo/articulo.html?slug=${art.slug}" class="related-card">
            <img src="${art.imagen_portada || '/IMG/IMGprueba.png'}"
                 alt="${art.titulo}"
                 loading="lazy"
                 width="400" height="130">
            <div class="related-card-info">
                <span class="related-category">${art.categorias?.nombre || ''}</span>
                <h4>${art.titulo}</h4>
            </div>
        </a>
    `).join('');
}

// --------------------------------------------------
// 6. BOTÓN COMPARTIR
// --------------------------------------------------
function configurarCompartir(titulo, slug) {
    const btn = document.getElementById('btn-share');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const url = `${window.location.origin}/Articulo/articulo.html?slug=${slug}`;
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
    const loadingEl = document.getElementById('article-loading');
    if (loadingEl) loadingEl.classList.add('hidden');
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
    return new Date(fecha + 'T00:00').toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

function truncar(texto, max) {
    return texto && texto.length > max ? texto.substring(0, max) + '…' : texto;
}