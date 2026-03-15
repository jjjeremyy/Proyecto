import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tu-url.supabase.co'
const supabaseKey = 'tu-anon-key'

export const supabase = createClient(supabaseUrl, supabaseKey)


// articulos

// A. Obtener todos los artículos (incluyendo datos de su categoría)
async function obtenerArticulos() {
  const { data, error } = await supabase
    .from('articulos')
    .select(`
      *,
      categorias (nombre, slug) 
    `) // Esto hace un "join" automático usando la FK categoria_id
    .order('fecha_publicacion', { ascending: false });

  if (error) console.error('Error:', error);
  return data;
}

// B. Insertar un nuevo artículo
async function crearArticulo(nuevoArticulo) {
  // nuevoArticulo debe ser un objeto con los campos: titulo, slug, contenido, etc.
  const { data, error } = await supabase
    .from('articulos')
    .insert([nuevoArticulo]);

  if (error) throw error;
  return data;
}

// C. Cambiar estado (Publicar/Desactivar)
async function cambiarEstadoArticulo(id, nuevoEstado) {
  const { data, error } = await supabase
    .from('articulos')
    .update({ estado: nuevoEstado })
    .eq('id', id);
    
  if (error) throw error;
  return data;
}




// categorias

// A. Obtener todas las categorías (útil para un menú desplegable)
async function obtenerCategorias() {
  const { data, error } = await supabase
    .from('categorias')
    .select('*');
    
  if (error) throw error;
  return data;
}

// B. Obtener una categoría y sus artículos (Relación inversa)
async function obtenerArticulosPorCategoria(categoriaSlug) {
  const { data, error } = await supabase
    .from('categorias')
    .select(`
      nombre,
      articulos (*)
    `)
    .eq('slug', categoriaSlug);

  if (error) throw error;
  return data;
}