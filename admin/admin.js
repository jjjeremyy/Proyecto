// =============================================
// ADMIN.JS — SistemaBase
// El import SIEMPRE primero en módulos ES
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
// 1. INICIALIZAR TINYMCE
// --------------------------------------------------
tinymce.init({
    selector: '#contenido',
    height: 520,
    menubar: false,
    plugins: [
        'advlist', 'autolink', 'lists', 'link', 'image',
        'charmap', 'preview', 'searchreplace', 'visualblocks',
        'fullscreen', 'insertdatetime', 'media', 'table',
        'code', 'codesample', 'wordcount'
    ],
    toolbar:
        'undo redo | formatselect | bold italic underline strikethrough | ' +
        'forecolor backcolor | alignleft aligncenter alignright alignjustify | ' +
        'bullist numlist outdent indent | link image media | ' +
        'codesample blockquote | removeformat | fullscreen code',
    content_style: `
        body {
            font-family: Arial, sans-serif;
            font-size: 16px;
            line-height: 1.7;
            color: #1a2a4a;
            padding: 12px 16px;
        }
        h1, h2, h3 { color: #043873; }
        pre { background: #0d1b33; color: #a8d4ff; padding: 16px; border-radius: 6px; }
    `,
    paste_data_images: true,
    // Subida de imágenes insertadas en el editor a Supabase Storage
    images_upload_handler: async (blobInfo) => {
        const file = blobInfo.blob();
        const fileName = `${Date.now()}-${blobInfo.filename()}`;
        const { data, error } = await supabase.storage
            .from('imagenes-articulos')
            .upload(fileName, file, { contentType: file.type });

        if (error) throw new Error('Error al subir imagen: ' + error.message);

        const { data: urlData } = supabase.storage
            .from('imagenes-articulos')
            .getPublicUrl(data.path);

        return urlData.publicUrl;
    }
});

// --------------------------------------------------
// 2. CARGAR CATEGORÍAS en el <select>
// --------------------------------------------------
async function cargarCategorias() {
    const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('nombre');

    if (error) {
        console.error('Error cargando categorías:', error);
        return;
    }

    const select = document.getElementById('categoria_id');
    data.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
    });
}
cargarCategorias();

// --------------------------------------------------
// 3. GENERADOR AUTOMÁTICO DE BABOSA (slug)
//    En tu BD el campo slug se llama "babosa"
// --------------------------------------------------
const inputTitulo = document.getElementById('titulo');
const inputBabosa = document.getElementById('babosa');
let babosaManual  = false;

inputTitulo.addEventListener('input', () => {
    if (!babosaManual) {
        inputBabosa.value = generarBabosa(inputTitulo.value);
    }
});

inputBabosa.addEventListener('input', () => {
    babosaManual = true;
    inputBabosa.value = generarBabosa(inputBabosa.value);
});

function generarBabosa(texto) {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')   // quita acentos
        .replace(/[^a-z0-9\s-]/g, '')      // solo letras, números, espacios y guiones
        .trim()
        .replace(/\s+/g, '-')              // espacios → guiones
        .replace(/-+/g, '-');              // guiones dobles → uno
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
    const contenido   = tinymce.get('contenido').getContent();
    const imagen      = document.getElementById('imagen_portada').value;
    const catSelect   = document.getElementById('categoria_id');
    const categoria   = catSelect.options[catSelect.selectedIndex]?.text || '';
    const fecha       = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    document.getElementById('preview-body').innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <span class="preview-category">${categoria}</span>
        </div>
        <div class="preview-meta">
            <span>📅 ${fecha}</span>
        </div>
        <h1>${titulo || '(Sin título)'}</h1>
        <p style="font-style:italic;color:#4a5a78;">${descripcion || ''}</p>
        ${imagen ? `<img src="${imagen}" alt="Imagen de portada" class="preview-featured-img" style="width:100%;border-radius:8px;margin-bottom:20px;">` : ''}
        <div>${contenido || '<p style="color:#999">(Sin contenido aún)</p>'}</div>
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

    // Valores — nombres exactos de columnas de tu tabla "artículos"
    const titulo         = document.getElementById('titulo').value.trim();
    const babosa         = document.getElementById('babosa').value.trim();
    const descripcion    = document.getElementById('descripcion').value.trim();
    const contenido      = tinymce.get('contenido').getContent();
    const categoria_id   = document.getElementById('categoria_id').value;
    const imagen_portada = document.getElementById('imagen_portada').value.trim();
    // "estado" en tu BD es BOOLEANO: true = publicado, false = borrador
    const estado         = document.getElementById('estado').value === 'true';

    // Validación
    let valido = true;
    if (!titulo)       { marcarError('titulo',       'El título es obligatorio.');  valido = false; }
    if (!babosa)       { marcarError('babosa',        'La URL es obligatoria.');     valido = false; }
    if (!categoria_id) { marcarError('categoria_id', 'Selecciona una categoría.');  valido = false; }
    if (!contenido || contenido === '<p></p>') {
        mostrarStatus('El contenido no puede estar vacío.', 'error');
        valido = false;
    }
    if (!valido) return;

    mostrarStatus('⏳ Publicando artículo...', 'loading');

    // Verificar que la babosa no exista ya en la BD
    const { data: existente } = await supabase
        .from('articulos')
        .select('id')
        .eq('babosa', babosa)
        .maybeSingle(); // maybeSingle no lanza error si no encuentra nada

    if (existente) {
        marcarError('babosa', 'Esta URL ya existe. Elige otra.');
        mostrarStatus('Error: la URL del artículo ya está en uso.', 'error');
        return;
    }

    // Objeto con los campos exactos de tu tabla
    const nuevoArticulo = {
        titulo,
        babosa,
        descripcion:      descripcion || null,
        contenido,
        categoria_id:     parseInt(categoria_id),
        imagen_portada:   imagen_portada || null,
        fecha_publicacion: new Date().toISOString().split('T')[0], // campo tipo DATE → 'YYYY-MM-DD'
        estado                                                      // campo tipo BOOLEAN
    };

    const { error } = await supabase
        .from('articulos')
        .insert([nuevoArticulo]);

    if (error) {
        mostrarStatus('❌ Error al publicar: ' + error.message, 'error');
        return;
    }

    mostrarStatus('✅ ¡Artículo publicado! URL pública: /articulo/?babosa=' + babosa, 'success');
    document.getElementById('formulario-articulo').reset();
    tinymce.get('contenido').setContent('');
    imgPreviewBox.classList.add('hidden');
    babosaManual = false;
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
