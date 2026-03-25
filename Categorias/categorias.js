import {
    obtenerArticulosPorCategoria,
    obtenerIdCategoria
} from '../Supabase/supabase.js';

const botones           = document.querySelectorAll('.category-button');
const seccionResultados = document.getElementById('articles-result');
const tituloCategoria   = document.getElementById('category-title');
const contadorArticulos = document.getElementById('articles-count');
const listaArticulos    = document.getElementById('articles-list');

// Esqueletos de carga
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

// Marcar botón activo
function setActiveButton(boton) {
    botones.forEach(b => b.classList.remove('active'));
    boton.classList.add('active');
}

// Escucha el click en cada botón
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

    // 1. Obtener el ID de la categoría por su slug
    const categoriaId = await obtenerIdCategoria(slug);

    if (!categoriaId) {
        listaArticulos.innerHTML = '<p class="no-articles">Categoría no encontrada.</p>';
        return;
    }

    // 2. Obtener artículos de esa categoría
    const data = await obtenerArticulosPorCategoria(categoriaId);

    if (!data) {
        listaArticulos.innerHTML = '<p class="no-articles">Error al cargar los artículos.</p>';
        return;
    }

    if (!data || data.length === 0) {
        contadorArticulos.textContent = '';
        listaArticulos.innerHTML = '<p class="no-articles">No hay artículos en esta categoría todavía.</p>';
        return;
    }

    // Contador
    contadorArticulos.textContent = `${data.length} artículo${data.length !== 1 ? 's' : ''}`;

    // 3. Renderizar tarjetas
    listaArticulos.innerHTML = data.map(articulo => `
        <div class="article-card" onclick="window.location.href='/Articulo/articulo.html?slug=${articulo.slug}'">
            <div class="article-card-image-wrapper">
                <img src="${articulo.imagen_portada || '/IMG/IMGprueba.png'}" 
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

