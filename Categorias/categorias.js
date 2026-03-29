// =============================================
// CATEGORIAS.JS — SistemaBase
// CORRECCIÓN GITHUB PAGES: rutas relativas
// =============================================
import { supabase, obtenerIdCategoria } from '../Supabase/supabase.js';

const botones           = document.querySelectorAll('.category-button');
const seccionResultados = document.getElementById('articles-result');
const tituloCategoria   = document.getElementById('category-title');
const contadorArticulos = document.getElementById('articles-count');
const listaArticulos    = document.getElementById('articles-list');

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, m =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
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

function renderSkeletons(n = 6) {
    return Array.from({ length: n }, () => `
        <div class="skeleton-card">
            <div class="skeleton-img"></div>
            <div class="skeleton-body">
                <div class="skeleton-line medium"></div>
                <div class="skeleton-line short"></div>
                <div class="skeleton-line medium"></div>
            </div>
        </div>
    `).join('');
}

function setActiveButton(boton) {
    botones.forEach(b => b.classList.remove('active'));
    boton.classList.add('active');
}

botones.forEach(boton => {
    boton.addEventListener('click', () => {
        const slug   = boton.dataset.slug;
        const nombre = boton.textContent.trim();
        setActiveButton(boton);
        cargarArticulos(slug, nombre);
    });
});

async function cargarArticulos(slug, nombre) {
    seccionResultados.classList.remove('hidden');
    tituloCategoria.textContent = nombre;
    contadorArticulos.textContent = '';
    listaArticulos.innerHTML = renderSkeletons();
    seccionResultados.scrollIntoView({ behavior: 'smooth' });

    const categoriaId = await obtenerIdCategoria(slug);

    if (!categoriaId) {
        listaArticulos.innerHTML = '<p class="no-articles">Categoría no encontrada.</p>';
        return;
    }

    const { data, error } = await supabase
        .from('articulos')
        .select('titulo, slug, imagen_portada, descripcion')
        .eq('estado', true)
        .eq('categoria_id', categoriaId)
        .order('fecha_publicacion', { ascending: false });

    if (error) {
        listaArticulos.innerHTML = '<p class="no-articles">Error al cargar los artículos.</p>';
        return;
    }

    if (!data || data.length === 0) {
        contadorArticulos.textContent = '';
        listaArticulos.innerHTML = '<p class="no-articles">No hay artículos en esta categoría todavía.</p>';
        return;
    }

    contadorArticulos.textContent = `${data.length} artículo${data.length !== 1 ? 's' : ''}`;

    // Ruta relativa: estamos en Categorias/, enlazamos a ../Articulo/
    const fb = '../IMG/IMGprueba.png';
    listaArticulos.innerHTML = data.map(articulo => `
    <a href="../Articulo/articulo.html?slug=${encodeURIComponent(articulo.slug)}" class="article-card">
        <div class="article-card-image-wrapper">
            <img src="${escapeAttr(safeImgSrc(articulo.imagen_portada, fb))}"
                 alt="${escapeAttr(articulo.titulo)}"
                 loading="lazy"
                 width="400" height="170"
                 decoding="async">
        </div>
        <div class="article-card-body">
            <h3>${escapeHtml(articulo.titulo)}</h3>
            <p>${escapeHtml(articulo.descripcion || '')}</p>
            <span class="article-card-link" aria-hidden="true">Leer artículo →</span>
        </div>
    </a>
`).join('');
}
