// Ejemplo rápido de protección en admin.js
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
    window.location.href = '../index.html'; // Patada hacia afuera si no eres tú
}

import { supabase } from '..Supabase/supabase.js';

const form = document.getElementById('formulario-articulo');

// 1. Cargar categorías al iniciar para el <select>
async function cargarCategorias() {
    const { data } = await supabase.from('categorias').select('*');
    const select = document.getElementById('categoria_id');
    data.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
    });
}
cargarCategorias();

// 2. Evento para enviar el formulario
form.addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que la página se recargue

    const nuevoArticulo = {
        titulo: document.getElementById('titulo').value,
        slug: document.getElementById('slug').value,
        descripcion: document.getElementById('descripcion').value,
        contenido: document.getElementById('contenido').value,
        categoria_id: document.getElementById('categoria_id').value,
        imagen_portada: document.getElementById('imagen_portada').value,
        fecha_publicacion: new Date().toISOString(),
        estado: 'publicado'
    };

    const { data, error } = await supabase
        .from('articulos')
        .insert([nuevoArticulo]);

    if (error) {
        alert('Error al subir: ' + error.message);
    } else {
        alert('¡Artículo publicado con éxito!');
        form.reset();
    }
});