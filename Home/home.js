// =============================================
// HOME.JS — SistemaBase
// FIX: prefetch movido a DESPUÉS de renderizar las tarjetas
// FIX: escape de HTML en interpolaciones para prevenir XSS
// FIX: Promise.all corregido
// =============================================
import { obtenerArticulosRecientes, obtenerArticulosBuscador } from '../Supabase/supabase.js';

// --------------------------------------------------
// 1. ARTÍCULOS RECIENTES
// --------------------------------------------------
async function cargarArticulosRecientes() {
    const lista = document.getElementById('recent-articles-list');
    if (!lista) return;

    // Skeleton loader
    lista.innerHTML = Array.from({ length: 4 }, () => `
        <div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid rgba(4,56,115,0.08);">
            <div style="height:160px;background:linear-gradient(90deg,#eef2f8 25%,#e2e8f4 50%,#eef2f8 75%);background-size:200% 100%;animation:sk-home 1.4s infinite;"></div>
            <div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px;">
                <div style="height:14px;width:75%;border-radius:5px;background:linear-gradient(90deg,#eef2f8 25%,#e2e8f4 50%,#eef2f8 75%);background-size:200% 100%;animation:sk-home 1.4s infinite;"></div>
                <div style="height:12px;width:55%;border-radius:5px;background:linear-gradient(90deg,#eef2f8 25%,#e2e8f4 50%,#eef2f8 75%);background-size:200% 100%;animation:sk-home 1.4s infinite;"></div>
            </div>
        </div>
    `).join('');

    if (!document.getElementById('sk-home-style')) {
        const s = document.createElement('style');
        s.id = 'sk-home-style';
        s.textContent = `@keyframes sk-home { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`;
        document.head.appendChild(s);
    }

    let data;
    try {
        data = await obtenerArticulosRecientes(4);
    } catch (err) {
        console.error('[SistemaBase] Error al cargar artículos recientes:', err);
        lista.innerHTML = `<p class="home-no-results">Error al cargar artículos. Revisa la consola para más detalles.</p>`;
        return;
    }

    if (!data || data.length === 0) {
        lista.innerHTML = '<p class="home-no-results">No hay artículos publicados todavía.</p>';
        return;
    }

    lista.innerHTML = data.map(art => `
        <a href="Articulo/articulo.html?slug=${encodeURIComponent(art.slug)}" class="recent-card">
            <div class="recent-card-img-wrap">
                <img src="${escapeAttr(art.imagen_portada || 'IMG/IMGprueba.png')}"
                     alt="${escapeAttr(art.titulo)}"
                     loading="lazy"
                     width="400" height="160"
                     decoding="async">
                <span class="recent-card-cat">${escapeHtml(art.categorias?.nombre || '')}</span>
            </div>
            <div class="recent-card-body">
                <h3>${escapeHtml(art.titulo)}</h3>
                <p>${escapeHtml(art.descripcion || '')}</p>
                <span class="recent-card-date">${formatearFecha(art.fecha_publicacion)}</span>
            </div>
        </a>
    `).join('');

    añadirPrefetchListeners();
}

// --------------------------------------------------
// 2. BUSCADOR
// --------------------------------------------------
function inicializarBuscador() {
    const input      = document.getElementById('search-input');
    const resultados = document.getElementById('search-results');
    if (!input || !resultados) return;

    let todosLosArticulos = [];
    let cargado  = false;
    let cargando = false;
    let debounceId = null;

    async function cargarDatosBuscador() {
        if (cargado || cargando) return;
        cargando = true;
        const data = await obtenerArticulosBuscador();
        if (data) { todosLosArticulos = data; cargado = true; }
        cargando = false;
    }

<<<<<<< HEAD
=======
    input.addEventListener('focus', cargarDatosBuscador, { once: true });

>>>>>>> main
    input.addEventListener('input', async () => {
        const rawQuery = input.value.trim();

        clearTimeout(debounceId);
        debounceId = setTimeout(async () => {
            const query = rawQuery.toLowerCase();

<<<<<<< HEAD
            if (query.length < 2) {
                resultados.classList.add('hidden');
                resultados.innerHTML = '';
                return;
            }
=======
        if (!cargado) await cargarDatosBuscador();
>>>>>>> main

            if (!cargado) {
                resultados.innerHTML = '<p class="search-no-results">Buscando artículos...</p>';
                resultados.classList.remove('hidden');
                await cargarDatosBuscador();
            }

<<<<<<< HEAD
            const filtrados = todosLosArticulos.filter(art =>
                art.titulo.toLowerCase().includes(query) ||
                (art.descripcion || '').toLowerCase().includes(query) ||
                (art.categorias?.nombre || '').toLowerCase().includes(query)
            );
=======
        if (filtrados.length === 0) {
            resultados.innerHTML = `<p class="search-no-results">Sin resultados para "<strong>${escapeHtml(input.value)}</strong>"</p>`;
        } else {
            resultados.innerHTML = filtrados.slice(0, 6).map(art => `
                <a href="Articulo/articulo.html?slug=${encodeURIComponent(art.slug)}" class="search-result-item">
                    <img src="${escapeAttr(art.imagen_portada || 'IMG/IMGprueba.png')}"
                         alt="${escapeAttr(art.titulo)}"
                         width="46" height="46">
                    <div>
                        <span class="search-result-cat">${escapeHtml(art.categorias?.nombre || '')}</span>
                        <p>${resaltarTexto(escapeHtml(art.titulo), query)}</p>
                    </div>
                </a>
            `).join('');
        }
>>>>>>> main

            if (filtrados.length === 0) {
                resultados.innerHTML = `<p class="search-no-results">Sin resultados para "<strong>${escapeHtml(rawQuery)}</strong>"</p>`;
            } else {
                resultados.innerHTML = filtrados.slice(0, 6).map(art => `
                    <a href="/Articulo/articulo.html?slug=${art.slug}" class="search-result-item">
                        <img src="${art.imagen_portada || '/IMG/IMGprueba.png'}" alt="${art.titulo}" loading="lazy">
                        <div>
                            <span class="search-result-cat">${art.categorias?.nombre || ''}</span>
                            <p>${resaltarTexto(art.titulo, query)}</p>
                        </div>
                    </a>
                `).join('');
            }

            resultados.classList.remove('hidden');
        }, 180);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            resultados.classList.add('hidden');
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = encodeURIComponent(input.value.trim());
            if (query) window.location.href = `Categorias/categorias.html?q=${query}`;
        }
    });
}

// --------------------------------------------------
// FIX: prefetch — se llama DESPUÉS de renderizar las tarjetas
// --------------------------------------------------
function añadirPrefetchListeners() {
    document.querySelectorAll('.recent-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            const href = card.getAttribute('href');
            if (!href) return;
            try {
                const slug = new URL(href, location.href).searchParams.get('slug');
                if (slug) {
                    const link = document.createElement('link');
                    link.rel = 'prefetch';
                    link.href = `Articulo/articulo.html?slug=${encodeURIComponent(slug)}`;
                    document.head.appendChild(link);
                }
            } catch (_) {}
        }, { once: true });
    });
}

// --------------------------------------------------
// UTILIDADES
// --------------------------------------------------
function formatearFecha(fecha) {
    if (!fecha) return '';
    return new Date(fecha + 'T00:00').toLocaleDateString('es-ES', {
        day: 'numeric', month: 'short', year: 'numeric'
    });
}

function resaltarTexto(textoEscapado, query) {
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return textoEscapado.replace(regex, '<mark>$1</mark>');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --------------------------------------------------
// INICIO
// --------------------------------------------------
<<<<<<< HEAD
Promise.all([
    cargarArticulosRecientes(),
    Promise.resolve(inicializarBuscador()) // síncrono, no bloquea
]);
=======
await cargarArticulosRecientes();
inicializarBuscador();
>>>>>>> main
