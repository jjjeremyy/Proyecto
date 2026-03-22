// =============================================
// ADMIN.JS — SistemaBase
// Editor WYSIWYG: Quill.js (100% gratuito)
// =============================================
import { supabase } from '../Supabase/supabase.js';

// --------------------------------------------------
// 0. PROTECCIÓN: redirige si no hay sesión activa
// --------------------------------------------------
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
    window.location.href = '../Login/login.html';
}

// --------------------------------------------------
// 1. INICIALIZAR QUILL (editor WYSIWYG gratuito)
// --------------------------------------------------
const quill = new Quill('#quill-editor', {
    theme: 'snow',
    placeholder: 'Escribe el contenido del artículo aquí...',
    modules: {
        toolbar: [
            [{ header: [2, 3, 4, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ color: [] }, { background: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ indent: '-1' }, { indent: '+1' }],
            [{ align: [] }],
            ['link', 'image', 'video'],
            ['blockquote', 'code-block'],
            ['clean']
        ]
    }
});

function getContenido() {
    return quill.root.innerHTML;
}

function limpiarContenido() {
    quill.setContents([]);
}

// --------------------------------------------------
// 2. CARGAR CATEGORÍAS en el <select>
//    CAUSA DEL PROBLEMA: si RLS está activado en
//    Supabase sin política de lectura, la query
//    devuelve array vacío sin dar error.
//    SOLUCIÓN: usamos la sesión activa (ya logado)
//    que tiene permisos, y mostramos el error claro.
// --------------------------------------------------
async function cargarCategorias() {
    const select = document.getElementById('categoria_id');

    const { data, error } = await supabase
        .from('categorias')
        .select('id, nombre')
        .order('nombre');

    // Error de red o permisos
    if (error) {
        console.error('Error cargando categorías:', error);
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '⚠️ Error al cargar categorías';
        opt.disabled = true;
        select.appendChild(opt);
        return;
    }

    // Sin datos: RLS bloqueando o tabla vacía
    if (!data || data.length === 0) {
        console.warn('No se encontraron categorías. Verifica RLS en Supabase.');
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '⚠️ Sin categorías — revisa RLS en Supabase';
        opt.disabled = true;
        select.appendChild(opt);
        return;
    }

    // Éxito: rellenar el select
    data.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
    });
}
cargarCategorias();

// --------------------------------------------------
// 3. GENERADOR AUTOMÁTICO DE slug (slug)
// --------------------------------------------------
const inputTitulo = document.getElementById('titulo');
const inputSlug = document.getElementById('slug');
let slugManual  = false;

inputTitulo.addEventListener('input', () => {
    if (!slugManual) {
        inputSlug.value = generarSlug(inputTitulo.value);
    }
});

inputSlug.addEventListener('input', () => {
    slugManual = true;
    inputSlug.value = generarSlug(inputSlug.value);
});

function generarSlug(texto) {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

// --------------------------------------------------
// 4. VISTA PREVIA DE IMAGEN DE PORTADA
// --------------------------------------------------
const inputImagen   = document.getElementById('imagen_portada');
const imgPreviewBox = document.getElementById('img-preview-box');
const imgPreview    = document.getElementById('img-preview');

inputImagen.addEventListener('input', () => {
    const url = inputImagen.value.trim();
    if (url) {
        imgPreview.src = url;
        imgPreviewBox.classList.remove('hidden');
    } else {
        imgPreviewBox.classList.add('hidden');
    }
});

// --------------------------------------------------
// 5. MODAL DE PREVISUALIZACIÓN
// --------------------------------------------------
document.getElementById('btn-preview').addEventListener('click', () => {
    const titulo      = document.getElementById('titulo').value;
    const descripcion = document.getElementById('descripcion').value;
    const contenido   = getContenido();
    const imagen      = document.getElementById('imagen_portada').value;
    const catSelect   = document.getElementById('categoria_id');
    const categoria   = catSelect.options[catSelect.selectedIndex]?.text || '';
    const fecha       = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    document.getElementById('preview-body').innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <span class="preview-category">${categoria}</span>
        </div>
        <div class="preview-meta"><span>📅 ${fecha}</span></div>
        <h1>${titulo || '(Sin título)'}</h1>
        <p style="font-style:italic;color:#4a5a78;">${descripcion || ''}</p>
        ${imagen ? `<img src="${imagen}" alt="Imagen de portada" style="width:100%;border-radius:8px;margin-bottom:20px;">` : ''}
        <div class="ql-snow"><div class="ql-editor" style="padding:0">${contenido || '<p style="color:#999">(Sin contenido aún)</p>'}</div></div>
    `;

    document.getElementById('preview-modal').classList.remove('hidden');
});

document.getElementById('close-preview').addEventListener('click', cerrarModal);
document.getElementById('modal-overlay').addEventListener('click', cerrarModal);

function cerrarModal() {
    document.getElementById('preview-modal').classList.add('hidden');
}

// --------------------------------------------------
// 6. PUBLICAR ARTÍCULO EN SUPABASE
// --------------------------------------------------
document.getElementById('btn-submit').addEventListener('click', publicarArticulo);

async function publicarArticulo() {
    limpiarErrores();

    const titulo         = document.getElementById('titulo').value.trim();
    const slug         = document.getElementById('slug').value.trim();
    const descripcion    = document.getElementById('descripcion').value.trim();
    const contenido      = getContenido();
    const categoria_id   = document.getElementById('categoria_id').value;
    const imagen_portada = document.getElementById('imagen_portada').value.trim();
    const estado         = document.getElementById('estado').value === 'true';

    const contenidoVacio = !contenido || contenido === '<p><br></p>' || contenido === '<p></p>';

    let valido = true;
    if (!titulo)        { marcarError('titulo',       'El título es obligatorio.');  valido = false; }
    if (!slug)        { marcarError('slug',        'La URL es obligatoria.');     valido = false; }
    if (!categoria_id)  { marcarError('categoria_id', 'Selecciona una categoría.');  valido = false; }
    if (contenidoVacio) { mostrarStatus('El contenido no puede estar vacío.', 'error'); valido = false; }
    if (!valido) return;

    mostrarStatus('⏳ Publicando artículo...', 'loading');

    // Verificar que la slug no exista ya
    const { data: existente } = await supabase
        .from('articulos')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

    if (existente) {
        marcarError('slug', 'Esta URL ya existe. Elige otra.');
        mostrarStatus('Error: la URL del artículo ya está en uso.', 'error');
        return;
    }

    const nuevoArticulo = {
        titulo,
        slug,
        descripcion:       descripcion || null,
        contenido,
        categoria_id:      parseInt(categoria_id),
        imagen_portada:    imagen_portada || null,
        fecha_publicacion: new Date().toISOString().split('T')[0],
        estado
    };

    const { error } = await supabase
        .from('articulos')
        .insert([nuevoArticulo]);

    if (error) {
        mostrarStatus('❌ Error al publicar: ' + error.message, 'error');
        return;
    }

    mostrarStatus('✅ ¡Artículo publicado! URL: /articulo/?slug=' + slug, 'success');
    document.getElementById('formulario-articulo').reset();
    limpiarContenido();
    imgPreviewBox.classList.add('hidden');
    slugManual = false;
}

// --------------------------------------------------
// UTILIDADES
// --------------------------------------------------
function mostrarStatus(mensaje, tipo) {
    const el = document.getElementById('status-message');
    el.textContent = mensaje;
    el.className   = `status-message ${tipo}`;
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function marcarError(idCampo, mensaje) {
    const campo = document.getElementById(idCampo);
    if (campo) {
        campo.classList.add('error');
        if (!campo.parentNode.querySelector('.field-error-msg')) {
            const small = document.createElement('small');
            small.textContent = mensaje;
            small.style.color  = '#e02424';
            small.className    = 'field-error-msg';
            campo.parentNode.appendChild(small);
        }
    }
    mostrarStatus('Por favor corrige los errores marcados.', 'error');
}

function limpiarErrores() {
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
    document.getElementById('status-message').classList.add('hidden');
}
