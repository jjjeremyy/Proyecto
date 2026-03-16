import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://xylvokwwiiirjlcjrafb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5bHZva3d3aWlpcmpsY2pyYWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTQ2NTksImV4cCI6MjA4OTE3MDY1OX0.M__8j6m_9glJEoXHvxdG9gXtQ2fE_Fa8yWbBSl-GoS8'

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Artículos ──────────────────────────────────────────

export async function obtenerArticulos() {
  const { data, error } = await supabase
    .from('articulos')
    .select(`*, categorias (nombre, slug)`)
    .eq('estado', true)
    .order('fecha_publicacion', { ascending: false })

  if (error) console.error('Error:', error)
  return data
}

export async function crearArticulo(nuevoArticulo) {
  const { data, error } = await supabase
    .from('articulos')
    .insert([nuevoArticulo])

  if (error) throw error
  return data
}

export async function cambiarEstadoArticulo(id, nuevoEstado) {
  const { data, error } = await supabase
    .from('articulos')
    .update({ estado: nuevoEstado })
    .eq('id', id)

  if (error) throw error
  return data
}

// ── Categorías ─────────────────────────────────────────

export async function obtenerCategorias() {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')

  if (error) throw error
  return data
}

export async function obtenerArticulosPorCategoria(categoriaId) {
  const { data, error } = await supabase
    .from('articulos')
    .select('*')
    .eq('categoria_id', categoriaId)
    .eq('estado', true)

  if (error) throw error
  return data
}