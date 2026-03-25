// =============================================
// HOME.JS — SistemaBase
// Carga artículos recientes desde Supabase
// e implementa el buscador en tiempo real.
// Optimización: los datos del buscador se
// cargan SOLO cuando el usuario empieza a escribir.
// =============================================
import { obtenerArticulosRecientes, obtenerArticulosBuscador } from '../Supabase/supabase.js';

// --------------------------------------------------
// 1. ARTÍCULOS RECIENTES — usa caché (1 hora)
// --------------------------------------------------
async function cargarArticulosRecientes() {
    const lista = document.getElementById('recent-articles-list');
    if (!lista) return;

    // Skeleton mientras carga
    lista.innerHTML = Array.from({ length: 4 }, () => `
        <div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid rgba(4,56,115,0.08);">
            <div style="height:160px;background:linear-gradient(90deg,#eef2f8 25%,#e2e8f4 50%,#eef2f8 75%);background-size:200% 100%;animation:sk-home 1.4s infinite;"></div>
            <div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px;">
                <div style="height:14px;width:75%;border-radius:5px;background:linear-gradient(90deg,#eef2f8 25%,#e2e8f4 50%,#eef2f8 75%);background-size:200% 100%;animation:sk-home 1.4s infinite;"></div>
                <div style="height:12px;width:55%;border-radius:5px;background:linear-gradient(90deg,#eef2f8 25%,#e2e8f4 50%,#eef2f8 75%);background-size:200% 100%;animation:sk-home 1.4s infinite;"></div>
            </div>
        </div>
    `).join('');

    // Inyectar keyframes una sola vez
    if (!document.getElementById('sk-home-style')) {
        const s = document.createElement('style');
        s.id = 'sk-home-style';
        s.textContent = `@keyframes sk-home { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`;
        document.head.appendChild(s);
    }

    // Llamada con caché — no va a Supabase si hay datos frescos en localStorage
    const data = await obtenerArticulosRecientes(4);

    if (!data || data.length === 0) {
        lista.innerHTML = '<p class="home-no-results">No hay artículos publicados todavía.</p>';
        return;
    }

    lista.innerHTML = data.map(art => `
        <a href="/Articulo/articulo.html?slug=${art.slug}" class="recent-card">
            <div class="recent-card-img-wrap">
                <img src="${art.imagen_portada || '/IMG/IMGprueba.png'}"
                     alt="${art.titulo}"
                     loading="lazy">
                <span class="recent-card-cat">${art.categorias?.nombre || ''}</span>
            </div>
            <div class="recent-card-body">
                <h3>${art.titulo}</h3>
                <p>${art.descripcion || ''}</p>
                <span class="recent-card-date">${formatearFecha(art.fecha_publicacion)}</span>
            </div>
        </a>
    `).join('');
}

// --------------------------------------------------
// 2. BUSCADOR — carga datos SOLO al primer keystroke
//    (lazy loading: no consulta Supabase hasta que el
//     usuario empieza a escribir)
// --------------------------------------------------
function inicializarBuscador() {
    const input    = document.getElementById('search-input');
    const resultados = document.getElementById('search-results');
    if (!input || !resultados) return;

    let todosLosArticulos = [];
    let cargado = false;
    let cargando = false;
    let debounceId = null;

    async function cargarDatosBuscador() {
        if (cargado || cargando) return;
        cargando = true;

        // Usar caché — solo llama a Supabase si no hay datos frescos
        const data = await obtenerArticulosBuscador();
        if (data) {
            todosLosArticulos = data;
            cargado = true;
        }
        cargando = false;
    }

    input.addEventListener('input', async () => {
        const rawQuery = input.value.trim();

        clearTimeout(debounceId);
        debounceId = setTimeout(async () => {
            const query = rawQuery.toLowerCase();

            if (query.length < 2) {
                resultados.classList.add('hidden');
                resultados.innerHTML = '';
                return;
            }

            if (!cargado) {
                resultados.innerHTML = '<p class="search-no-results">Buscando artículos...</p>';
                resultados.classList.remove('hidden');
                await cargarDatosBuscador();
            }

            const filtrados = todosLosArticulos.filter(art =>
                art.titulo.toLowerCase().includes(query) ||
                (art.descripcion || '').toLowerCase().includes(query) ||
                (art.categorias?.nombre || '').toLowerCase().includes(query)
            );

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

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            resultados.classList.add('hidden');
        }
    });

    // Navegar con Enter
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = encodeURIComponent(input.value.trim());
            if (query) window.location.href = `/Categorias/categorias.html?q=${query}`;
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
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return texto.replace(regex, '<mark>$1</mark>');
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --------------------------------------------------
// ARRANQUE — las dos en paralelo
// --------------------------------------------------
Promise.all([
    cargarArticulosRecientes(),
    Promise.resolve(inicializarBuscador()) // síncrono, no bloquea
]);
