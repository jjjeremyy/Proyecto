// =============================================
// CATEGORIAS.JS — SistemaBase
// CORRECCIÓN GITHUB PAGES: rutas relativas
// =============================================
import { supabase } from '../Supabase/supabase.js';

const botones           = document.querySelectorAll('.category-button');
const seccionResultados = document.getElementById('articles-result');
const tituloCategoria   = document.getElementById('category-title');
const contadorArticulos = document.getElementById('articles-count');
const listaArticulos    = document.getElementById('articles-list');

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
    listaArticulos.innerHTML = data.map(articulo => `
        <div class="article-card" onclick="window.location.href='../Articulo/articulo.html?slug=${articulo.slug}'">
            <div class="article-card-image-wrapper">
                <img src="${articulo.imagen_portada || '../IMG/IMGprueba.png'}"
                    alt="${articulo.titulo}"
                    loading="lazy">
            </div>
            <div class="article-card-body">
                <h3>${articulo.titulo}</h3>
                <p>${articulo.descripcion || ''}</p>
                <span class="article-card-link">Leer artículo →</span>
            </div>
        </div>
    `).join('');
}

async function obtenerIdCategoria(slug) {
    const { data, error } = await supabase
        .from('categorias')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

    if (error) {
        console.error('Error buscando categoría:', error);
        return null;
    }

    return data?.id ?? null;
}
// Añadir a home.js y categorias.js
function añadirPrefetch(slug) {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = `/Articulo/articulo.html?slug=${slug}`;
  document.head.appendChild(link);
}

// En los event listeners de las tarjetas
document.querySelectorAll('.recent-card, .article-card').forEach(card => {
  card.addEventListener('mouseenter', () => {
    const href = card.getAttribute('href') || card.dataset.href;
    if (href) añadirPrefetch(new URL(href, location.href).searchParams.get('slug'));
  }, { once: true }); // once: true → solo la primera vez
});