import {
    obtenerArticulosBuscador,
    obtenerArticulosPorCategoria,
    obtenerIdCategoria,
} from '../Supabase/supabase.js';

const botones = Array.from(document.querySelectorAll('.category-button'));
const seccionResultados = document.getElementById('articles-result');
const tituloCategoria = document.getElementById('category-title');
const contadorArticulos = document.getElementById('articles-count');
const listaArticulos = document.getElementById('articles-list');

function renderSkeletons(cantidad = 6) {
    return Array.from({ length: cantidad }, () => `
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

function setActiveButton(slugActivo) {
    botones.forEach((boton) => {
        boton.classList.toggle('active', boton.dataset.slug === slugActivo);
    });
}

function renderMensaje(mensaje) {
    listaArticulos.innerHTML = `<p class="no-articles">${escapeHtml(mensaje)}</p>`;
}

function renderArticulos(articulos) {
    listaArticulos.innerHTML = articulos.map((articulo) => `
        <a href="../Articulo/articulo.html?slug=${encodeURIComponent(articulo.slug)}" class="article-card">
            <div class="article-card-image-wrapper">
                <img
                    src="${escapeAttr(articulo.imagen_portada || '../IMG/IMGprueba.png')}"
                    alt="${escapeAttr(articulo.titulo)}"
                    loading="lazy"
                    width="400"
                    height="170"
                    decoding="async"
                >
            </div>
            <div class="article-card-body">
                <h3>${escapeHtml(articulo.titulo)}</h3>
                <p>${escapeHtml(articulo.descripcion || '')}</p>
                <span class="article-card-link" aria-hidden="true">Leer articulo -></span>
            </div>
        </a>
    `).join('');
}

async function cargarArticulosPorCategoria(slug, nombre) {
    seccionResultados.classList.remove('hidden');
    tituloCategoria.textContent = nombre;
    contadorArticulos.textContent = '';
    listaArticulos.innerHTML = renderSkeletons();
    setActiveButton(slug);
    seccionResultados.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const categoriaId = await obtenerIdCategoria(slug, true);
        if (!categoriaId) {
            renderMensaje('Categoria no encontrada.');
            return;
        }

        const articulos = await obtenerArticulosPorCategoria(categoriaId, 0, 50, true);
        if (!Array.isArray(articulos)) {
            renderMensaje('Error al cargar los articulos.');
            return;
        }

        if (articulos.length === 0) {
            renderMensaje('No hay articulos en esta categoria todavia.');
            return;
        }

        contadorArticulos.textContent = `${articulos.length} articulo${articulos.length === 1 ? '' : 's'}`;
        renderArticulos(articulos);
    } catch (error) {
        console.error('[SistemaBase] Error cargando categoria:', error);
        renderMensaje('No se ha podido cargar esta categoria.');
    }
}

async function cargarResultadosBusqueda(query) {
    seccionResultados.classList.remove('hidden');
    tituloCategoria.textContent = `Busqueda: ${query}`;
    contadorArticulos.textContent = '';
    listaArticulos.innerHTML = renderSkeletons();
    setActiveButton(null);

    try {
        const articulos = await obtenerArticulosBuscador(true);
        if (!Array.isArray(articulos)) {
            renderMensaje('Error al cargar los articulos.');
            return;
        }

        const termino = normalizarTexto(query);
        const resultados = articulos.filter((articulo) => {
            const titulo = normalizarTexto(articulo.titulo);
            const descripcion = normalizarTexto(articulo.descripcion || '');
            const categoria = normalizarTexto(articulo.categorias?.nombre || '');
            return titulo.includes(termino) || descripcion.includes(termino) || categoria.includes(termino);
        });

        if (resultados.length === 0) {
            renderMensaje('No se han encontrado articulos para esta busqueda.');
            return;
        }

        contadorArticulos.textContent = `${resultados.length} resultado${resultados.length === 1 ? '' : 's'}`;
        renderArticulos(resultados);
    } catch (error) {
        console.error('[SistemaBase] Error cargando busqueda:', error);
        renderMensaje('No se ha podido completar la busqueda.');
    }
}

function normalizarTexto(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function escapeHtml(valor) {
    if (!valor) return '';

    return String(valor).replace(/[&<>"']/g, (match) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#39;',
    }[match]));
}

function escapeAttr(valor) {
    if (!valor) return '';
    return String(valor).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

botones.forEach((boton) => {
    boton.addEventListener('click', () => {
        cargarArticulosPorCategoria(boton.dataset.slug, boton.textContent.trim());
    });
});

const params = new URLSearchParams(window.location.search);
const slugInicial = params.get('slug');
const queryInicial = params.get('q');

if (slugInicial) {
    const boton = botones.find((item) => item.dataset.slug === slugInicial);
    cargarArticulosPorCategoria(slugInicial, boton?.textContent.trim() || slugInicial.replace(/_/g, ' '));
} else if (queryInicial) {
    cargarResultadosBusqueda(queryInicial.trim());
}
