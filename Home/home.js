// =============================================
// HOME.JS — SistemaBase
// CORRECCIÓN DE RUTAS: index.html está en la raíz,
// por lo que las rutas NO llevan ../
// =============================================
import { obtenerArticulosRecientes, obtenerArticulosBuscador } from '../Supabase/supabase.js';

// --------------------------------------------------
// 1. ARTÍCULOS RECIENTES
// --------------------------------------------------
async function cargarArticulosRecientes() {
    const lista = document.getElementById('recent-articles-list');
    if (!lista) return;

    // Skeleton loader mientras carga
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

    const data = await obtenerArticulosRecientes(4);

    if (!data || data.length === 0) {
        lista.innerHTML = '<p class="home-no-results">No hay artículos publicados todavía.</p>';
        return;
    }

    const fallbackImg = 'IMG/IMGprueba.png';
    // ✅ CORRECCIÓN CLAVE: rutas sin ../ porque index.html está en la raíz
    lista.innerHTML = data.map(art => `
        <a href="Articulo/articulo.html?slug=${encodeURIComponent(art.slug)}" class="recent-card">
            <div class="recent-card-img-wrap">
                <img src="${escapeAttr(safeImgSrc(art.imagen_portada, fallbackImg))}"
                     alt="${escapeAttr(art.titulo)}"
                     loading="lazy"
                     width="400" height="160"
                     decoding="async">
                <span class="recent-card-cat">${escapeHtml(art.categorias?.nombre || '')}</span>
            </div>
            <div class="recent-card-body">
                <h3>${escapeHtml(art.titulo)}</h3>
                <p>${escapeHtml(art.descripcion || '')}</p>
                <span class="recent-card-date">${escapeHtml(formatearFecha(art.fecha_publicacion))}</span>
            </div>
        </a>
    `).join('');
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

    async function cargarDatosBuscador() {
        if (cargado || cargando) return;
        cargando = true;
        const data = await obtenerArticulosBuscador();
        if (data) { todosLosArticulos = data; cargado = true; }
        cargando = false;
    }

    input.addEventListener('focus', cargarDatosBuscador, { once: true });

    input.addEventListener('input', async () => {
        const query = input.value.trim().toLowerCase();

        if (query.length < 2) {
            resultados.classList.add('hidden');
            resultados.innerHTML = '';
            return;
        }

        if (!cargado) await cargarDatosBuscador();

        const filtrados = todosLosArticulos.filter(art =>
            art.titulo.toLowerCase().includes(query) ||
            (art.descripcion || '').toLowerCase().includes(query) ||
            (art.categorias?.nombre || '').toLowerCase().includes(query)
        );

        if (filtrados.length === 0) {
            resultados.innerHTML = `<p class="search-no-results">Sin resultados para "<strong>${escapeHtml(input.value)}</strong>"</p>`;
        } else {
            // ✅ CORRECCIÓN: rutas sin ../ en los resultados del buscador
            const fb = 'IMG/IMGprueba.png';
            resultados.innerHTML = filtrados.slice(0, 6).map(art => `
                <a href="Articulo/articulo.html?slug=${encodeURIComponent(art.slug)}" class="search-result-item">
                    <img src="${escapeAttr(safeImgSrc(art.imagen_portada, fb))}"
                         alt="${escapeAttr(art.titulo)}"
                         width="46" height="46">
                    <div>
                        <span class="search-result-cat">${escapeHtml(art.categorias?.nombre || '')}</span>
                        <p>${resaltarTexto(art.titulo, query)}</p>
                    </div>
                </a>
            `).join('');
        }

        resultados.classList.remove('hidden');
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
// UTILIDADES
// --------------------------------------------------
function formatearFecha(fecha) {
    if (!fecha) return '';
    return new Date(fecha + 'T00:00').toLocaleDateString('es-ES', {
        day: 'numeric', month: 'short', year: 'numeric'
    });
}

function resaltarTexto(texto, query) {
    if (!query) return escapeHtml(texto);
    const safe = escapeHtml(texto);
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return safe.replace(regex, '<mark>$1</mark>');
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function escapeAttr(str) {
    return escapeHtml(str);
}

function safeImgSrc(url, fallback) {
    const u = (url || '').trim();
    if (!u) return fallback;
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('../') || u.startsWith('./') || u.startsWith('IMG/') || u.startsWith('/')) return u;
    return fallback;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

Promise.all([
    cargarArticulosRecientes(),
    Promise.resolve(inicializarBuscador())
]);