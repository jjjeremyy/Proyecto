import {
    obtenerArticuloPorSlug,
    obtenerRelacionados,
} from '../Supabase/supabase.js';

const purify = window.DOMPurify;
const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');
const footerYear = document.getElementById('footer-year');
const FAVORITOS_KEY = 'sistemabase_favoritos';

if (footerYear) {
    footerYear.textContent = new Date().getFullYear();
}

const bar = document.createElement('div');
bar.id = 'reading-progress';
document.body.appendChild(bar);

const btnTop = document.createElement('button');
btnTop.id = 'btn-top';
btnTop.textContent = '↑';
btnTop.setAttribute('aria-label', 'Volver al inicio');
btnTop.style.cssText = `
  position:fixed; bottom:24px; right:24px; width:44px; height:44px;
  background:var(--color-primary); color:#fff; border:none; border-radius:50%;
  font-size:20px; cursor:pointer; opacity:0; transition:opacity 0.3s;
  z-index:500; box-shadow:0 4px 16px rgba(4,56,115,0.3);
`;
document.body.appendChild(btnTop);
btnTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

window.addEventListener('scroll', () => {
    const doc = document.documentElement;
    const maxScroll = doc.scrollHeight - doc.clientHeight;
    const scrolled = maxScroll > 0 ? doc.scrollTop / maxScroll : 0;
    bar.style.width = `${Math.min(scrolled * 100, 100)}%`;
    btnTop.style.opacity = window.scrollY > 400 ? '1' : '0';
    btnTop.style.pointerEvents = window.scrollY > 400 ? 'auto' : 'none';
}, { passive: true });

inicializarAds(document.querySelectorAll('.ad-leaderboard .adsbygoogle, .ad-footer-banner .adsbygoogle'));

if (!slug) {
    mostrarError('No se ha especificado ningun articulo.');
} else {
    mostrarSkeleton();
    cargarArticulo(slug);
}

function mostrarSkeleton() {
    const loadingEl = document.getElementById('article-loading');
    if (!loadingEl) return;

    loadingEl.innerHTML = `
        <div style="max-width:860px;width:100%;padding:30px 20px;font-family:Arial,sans-serif;">
            <div style="height:14px;width:30%;border-radius:6px;margin-bottom:20px;${sk()}"></div>
            <div style="height:36px;width:85%;border-radius:8px;margin-bottom:12px;${sk()}"></div>
            <div style="height:36px;width:65%;border-radius:8px;margin-bottom:20px;${sk()}"></div>
            <div style="height:18px;width:50%;border-radius:6px;margin-bottom:32px;${sk()}"></div>
            <div style="height:320px;width:100%;border-radius:10px;margin-bottom:32px;${sk()}"></div>
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

function sk() {
    return `background:linear-gradient(90deg,#eef2f8 25%,#e2e8f4 50%,#eef2f8 75%);
            background-size:200% 100%;
            animation:sb-shimmer 1.4s infinite;
            display:block;`;
}

if (!document.getElementById('sb-shimmer-style')) {
    const style = document.createElement('style');
    style.id = 'sb-shimmer-style';
    style.textContent = `@keyframes sb-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }`;
    document.head.appendChild(style);
}

async function cargarArticulo(currentSlug) {
    const articulo = await obtenerArticuloPorSlug(currentSlug);

    const loadingEl = document.getElementById('article-loading');
    if (loadingEl) loadingEl.classList.add('hidden');

    if (!articulo || articulo.estado === false) {
        mostrarError('Articulo no encontrado o no esta publicado.');
        return;
    }

    rellenarArticulo(articulo);
    cargarRelacionados(articulo.categoria_id, articulo.id);
}

function rellenarArticulo(articulo) {
    const categoria = articulo.categorias?.nombre || '';

    document.title = `SistemaBase | ${articulo.titulo}`;
    setMeta('description', articulo.descripcion || articulo.titulo);
    setMetaProperty('og:title', `SistemaBase | ${articulo.titulo}`);
    setMetaProperty('og:description', articulo.descripcion || articulo.titulo);
    setMetaProperty('og:type', 'article');
    setMetaProperty('og:url', window.location.href);
    setMetaProperty('twitter:card', 'summary_large_image');
    setMetaProperty('twitter:title', `SistemaBase | ${articulo.titulo}`);
    setMetaProperty('twitter:description', articulo.descripcion || articulo.titulo);

    if (articulo.imagen_portada) {
        setMetaProperty('og:image', articulo.imagen_portada);
        setMetaProperty('twitter:image', articulo.imagen_portada);
    }

    setText('breadcrumb-categoria-text', categoria.replace(/_/g, ' '));
    setAttr('breadcrumb-categoria-link', 'href', '../Categorias/categorias.html');
    setText('breadcrumb-titulo-text', truncar(articulo.titulo, 45));

    setText('article-category-badge', categoria.replace(/_/g, ' ').toUpperCase());
    setText('article-date', formatearFecha(articulo.fecha_publicacion));
    setText('article-title', articulo.titulo);
    setText('article-subtitle', articulo.descripcion || '');

    const textoPlano = (articulo.contenido || '').replace(/<[^>]*>/g, '');
    const palabras = textoPlano.trim().split(/\s+/).filter(Boolean).length;
    const minutos = Math.max(1, Math.ceil(palabras / 200));
    setText('article-read-time', `${minutos} min de lectura`);

    if (articulo.imagen_portada) {
        const img = document.getElementById('article-featured-img');
        if (img) {
            img.src = articulo.imagen_portada;
            img.alt = articulo.titulo;
            img.setAttribute('fetchpriority', 'high');
            img.removeAttribute('loading');
        }
    } else {
        const figure = document.getElementById('article-featured-figure');
        if (figure) figure.style.display = 'none';
    }

    const bodyEl = document.getElementById('article-body-content');
    if (bodyEl) {
        bodyEl.innerHTML = sanitizarContenido(articulo.contenido || '');
        bodyEl.querySelectorAll('a[href^="http"]').forEach(link => {
            if (!link.href.startsWith(window.location.origin)) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            }
        });
    }

    document.getElementById('article-main').classList.remove('hidden');

    inicializarAds(document.querySelectorAll('#article-main .adsbygoogle'));

    configurarCompartir(articulo.titulo, articulo.slug);
    configurarFavorito(articulo);
}

function sanitizarContenido(html) {
    if (!purify) {
        console.warn('[Seguridad] DOMPurify no disponible. Contenido renderizado sin sanitizar.');
        return html;
    }

    return purify.sanitize(html, {
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'loading', 'target'],
        FORBID_TAGS: ['script', 'style', 'svg', 'math', 'object', 'embed'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'javascript'],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });
}

function inicializarAds(nodos) {
    requestAnimationFrame(() => {
        nodos.forEach(ins => {
            if (!ins.getAttribute('data-adsbygoogle-status')) {
                try {
                    (window.adsbygoogle = window.adsbygoogle || []).push({});
                } catch (error) {
                    console.warn('[AdSense] Error al inicializar bloque:', error);
                }
            }
        });
    });
}

async function cargarRelacionados(categoriaId, articuloActualId) {
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

    const data = await obtenerRelacionados(categoriaId, articuloActualId);

    if (!data || data.length === 0) {
        const section = document.getElementById('related-section');
        if (section) section.style.display = 'none';
        return;
    }

    if (!grid) return;

    grid.innerHTML = data.map(art => `
        <a href="articulo.html?slug=${encodeURIComponent(art.slug)}" class="related-card">
            <img src="${escapeAttr(art.imagen_portada || '../IMG/IMGprueba.png')}"
                 alt="${escapeAttr(art.titulo)}"
                 loading="lazy"
                 width="400" height="130">
            <div class="related-card-info">
                <span class="related-category">${escapeHtml((art.categorias?.nombre || '').replace(/_/g, ' '))}</span>
                <h4>${escapeHtml(art.titulo)}</h4>
            </div>
        </a>
    `).join('');
}

function configurarCompartir(titulo, currentSlug) {
    const btn = document.getElementById('btn-share');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const url = `${window.location.origin}${window.location.pathname}?slug=${encodeURIComponent(currentSlug)}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: titulo, url });
            } catch (_) {}
            return;
        }

        try {
            await navigator.clipboard.writeText(url);
            btn.textContent = 'Enlace copiado';
        } catch (_) {
            btn.textContent = 'No se pudo copiar';
        }

        setTimeout(() => {
            btn.textContent = 'Compartir';
        }, 2500);
    });
}

function configurarFavorito(articulo) {
    const btn = document.getElementById('btn-favorite');
    if (!btn || !articulo?.slug) return;

    const favorito = normalizarFavorito(articulo);

    function actualizarBoton() {
        const estaGuardado = existeFavorito(favorito.slug);
        btn.classList.toggle('is-favorite', estaGuardado);
        btn.setAttribute('aria-pressed', String(estaGuardado));

        const icono = btn.querySelector('.favorite-icon');
        const texto = btn.querySelector('.favorite-text');
        if (icono) icono.textContent = estaGuardado ? '★' : '☆';
        if (texto) texto.textContent = estaGuardado ? 'Quitar favorito' : 'Guardar favorito';
        btn.setAttribute('aria-label', estaGuardado ? 'Quitar articulo de favoritos' : 'Guardar articulo en favoritos');
    }

    actualizarBoton();

    btn.addEventListener('click', () => {
        const favoritos = obtenerFavoritos();
        const indice = favoritos.findIndex((item) => item.slug === favorito.slug);

        if (indice >= 0) {
            favoritos.splice(indice, 1);
        } else {
            favoritos.unshift(favorito);
        }

        guardarFavoritos(favoritos);
        actualizarBoton();
    });
}

function normalizarFavorito(articulo) {
    return {
        slug: articulo.slug,
        titulo: articulo.titulo || '',
        descripcion: articulo.descripcion || '',
        imagen_portada: articulo.imagen_portada || '',
        fecha_publicacion: articulo.fecha_publicacion || '',
        categoria: articulo.categorias?.nombre || '',
        guardado_en: new Date().toISOString(),
    };
}

function existeFavorito(currentSlug) {
    return obtenerFavoritos().some((item) => item.slug === currentSlug);
}

function obtenerFavoritos() {
    try {
        const data = JSON.parse(localStorage.getItem(FAVORITOS_KEY) || '[]');
        return Array.isArray(data) ? data.filter((item) => item?.slug) : [];
    } catch (error) {
        console.warn('[SistemaBase] No se pudieron leer los favoritos:', error);
        return [];
    }
}

function guardarFavoritos(favoritos) {
    try {
        localStorage.setItem(FAVORITOS_KEY, JSON.stringify(favoritos));
    } catch (error) {
        console.warn('[SistemaBase] No se pudieron guardar los favoritos:', error);
    }
}

function mostrarError(mensaje) {
    const loadingEl = document.getElementById('article-loading');
    if (loadingEl) loadingEl.classList.add('hidden');

    const el = document.getElementById('article-error-msg');
    if (el) el.textContent = mensaje;

    document.getElementById('article-error').classList.remove('hidden');
}

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

function setMetaProperty(property, content) {
    let tag = document.querySelector(`meta[property="${property}"]`);
    if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    return new Date(fecha + 'T00:00').toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function truncar(texto, max) {
    return texto && texto.length > max ? `${texto.substring(0, max)}...` : texto;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, match => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#39;',
    }[match]));
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
