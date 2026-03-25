// =============================================
// HOME.JS — SistemaBase
// Carga artículos recientes desde Supabase
// e implementa el buscador en tiempo real.
// =============================================
import { supabase } from '../Supabase/supabase.js';

// --------------------------------------------------
// 1. ARTÍCULOS RECIENTES (reemplaza "Temas Recientes")
// --------------------------------------------------
async function cargarArticulosRecientes() {
    const lista = document.getElementById('recent-articles-list');
    if (!lista) return;

    lista.innerHTML = `
        <div class="home-loading">
            <div class="home-spinner"></div>
        </div>`;

    const { data, error } = await supabase
        .from('articulos')
        .select('titulo, slug, imagen_portada, descripcion, fecha_publicacion, categorias(nombre)')
        .eq('estado', true)
        .order('fecha_publicacion', { ascending: false })
        .limit(4);

    if (error || !data || data.length === 0) {
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
// 2. BUSCADOR EN TIEMPO REAL
// --------------------------------------------------
let todosLosArticulos = [];

async function inicializarBuscador() {
    const input     = document.getElementById('search-input');
    const resultados = document.getElementById('search-results');
    if (!input || !resultados) return;

    // Precargar todos los artículos publicados para buscar en cliente
    const { data, error } = await supabase
        .from('articulos')
        .select('titulo, slug, descripcion, imagen_portada, categorias(nombre)')
        .eq('estado', true)
        .order('fecha_publicacion', { ascending: false });

    if (!error && data) todosLosArticulos = data;

    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();

        if (query.length < 2) {
            resultados.classList.add('hidden');
            resultados.innerHTML = '';
            return;
        }

        const filtrados = todosLosArticulos.filter(art =>
            art.titulo.toLowerCase().includes(query) ||
            (art.descripcion || '').toLowerCase().includes(query) ||
            (art.categorias?.nombre || '').toLowerCase().includes(query)
        );

        if (filtrados.length === 0) {
            resultados.innerHTML = '<p class="search-no-results">Sin resultados para "<strong>' + escapeHtml(input.value) + '</strong>"</p>';
        } else {
            resultados.innerHTML = filtrados.slice(0, 6).map(art => `
                <a href="/Articulo/articulo.html?slug=${art.slug}" class="search-result-item">
                    <img src="${art.imagen_portada || '/IMG/IMGprueba.png'}" alt="${art.titulo}">
                    <div>
                        <span class="search-result-cat">${art.categorias?.nombre || ''}</span>
                        <p>${resaltarTexto(art.titulo, query)}</p>
                    </div>
                </a>
            `).join('');
        }

        resultados.classList.remove('hidden');
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
// ARRANQUE
// --------------------------------------------------
cargarArticulosRecientes();
inicializarBuscador();
