import { supabase } from '../Supabase/supabase.js';

const botones = document.querySelectorAll('.category-button');
const seccionResultados = document.getElementById('articles-result');
const tituloCategoria = document.getElementById('category-title');
const listaArticulos = document.getElementById('articles-list');

// Escucha el click en cada botón
botones.forEach(boton => {
    boton.addEventListener('click', () => {
        const slug = boton.dataset.slug;
        const nombre = boton.textContent;
        cargarArticulos(slug, nombre);
    });
});

async function cargarArticulos(slug, nombre) {

    // Muestra la sección y actualiza el título
    seccionResultados.classList.remove('hidden');
    tituloCategoria.textContent = nombre;
    listaArticulos.innerHTML = 'Cargando...';

    // Hace scroll suave hasta los resultados
    seccionResultados.scrollIntoView({ behavior: 'smooth' });

    // Consulta a Supabase
    const { data, error } = await supabase
        .from('articulos')
        .select('*')
        .eq('estado', 'publicado')
        .eq('categoria_id', await obtenerIdCategoria(slug));

    if (error) {
        listaArticulos.innerHTML = '<p class="no-articles">Error al cargar los artículos.</p>';
        return;
    }

    // Si no hay artículos
    if (data.length === 0) {
        listaArticulos.innerHTML = '<p class="no-articles">No hay artículos en esta categoría todavía.</p>';
        return;
    }

    // Renderiza las tarjetas
    listaArticulos.innerHTML = data.map(articulo => `
        <div class="article-card" onclick="window.location.href='/Articulo/articulo.html?slug=${articulo.slug}'">
            <img src="${articulo.imagen_portada || '/IMG/IMGprueba.png'}" alt="${articulo.titulo}">
            <h3>${articulo.titulo}</h3>
            <p>${articulo.descripcion || ''}</p>
        </div>
    `).join('');
}

// Función auxiliar para obtener el ID de la categoría por su slug
async function obtenerIdCategoria(slug) {
    const { data } = await supabase
        .from('categorias')
        .select('id')
        .eq('slug', slug)
        .single();

    return data?.id;
}