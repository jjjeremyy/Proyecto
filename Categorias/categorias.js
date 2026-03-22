import { supabase } from '../Supabase/supabase.js';

const botones           = document.querySelectorAll('.category-button');
const seccionResultados = document.getElementById('articles-result');
const tituloCategoria   = document.getElementById('category-title');
const listaArticulos    = document.getElementById('articles-list');

// Escucha el click en cada botón
botones.forEach(boton => {
    boton.addEventListener('click', () => {
        const slug  = boton.dataset.slug;
        const nombre = boton.textContent.trim();
        cargarArticulos(slug, nombre);
    });
});

async function cargarArticulos(slug, nombre) {
    seccionResultados.classList.remove('hidden');
    tituloCategoria.textContent = nombre;
    listaArticulos.innerHTML = '<p class="no-articles">Cargando...</p>';
    seccionResultados.scrollIntoView({ behavior: 'smooth' });

    // 1. Obtener el ID de la categoría por su babosa (campo slug en tu BD = "babosa")
    const categoriaId = await obtenerIdCategoria(slug);

    if (!categoriaId) {
        listaArticulos.innerHTML = '<p class="no-articles">Categoría no encontrada.</p>';
        return;
    }

    // 2. Obtener artículos de esa categoría
    //    estado es BOOLEAN en tu BD → true = publicado
    const { data, error } = await supabase
        .from('articulos')
        .select('titulo, babosa, imagen_portada, descripcion')
        .eq('estado', true)
        .eq('categoria_id', categoriaId)
        .order('fecha_publicacion', { ascending: false });

    if (error) {
        listaArticulos.innerHTML = '<p class="no-articles">Error al cargar los artículos.</p>';
        return;
    }

    if (!data || data.length === 0) {
        listaArticulos.innerHTML = '<p class="no-articles">No hay artículos en esta categoría todavía.</p>';
        return;
    }

    // 3. Renderizar tarjetas
    //    La URL usa "babosa" (no slug) como en el resto del proyecto
    listaArticulos.innerHTML = data.map(articulo => `
        <div class="article-card" onclick="window.location.href='/Articulo/articulo.html?babosa=${articulo.babosa}'">
            <img src="${articulo.imagen_portada || '/IMG/IMGprueba.png'}" alt="${articulo.titulo}">
            <h3>${articulo.titulo}</h3>
            <p>${articulo.descripcion || ''}</p>
        </div>
    `).join('');
}

// Obtiene el ID de la categoría buscando por su "babosa" (campo slug)
async function obtenerIdCategoria(slug) {
    const { data, error } = await supabase
        .from('categorias')
        .select('id')
        .eq('babosa', slug)   // campo slug en tu tabla categorías = "babosa"
        .maybeSingle();       // no lanza error si no encuentra nada

    if (error) {
        console.error('Error buscando categoría:', error);
        return null;
    }

    return data?.id ?? null;
}
