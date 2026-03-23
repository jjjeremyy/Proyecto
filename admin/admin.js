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
// 2. INSERTAR TABLA COMO HTML NATIVO
//    Quill 1.x acepta HTML completo vía
//    clipboard.dangerouslyPasteHTML — funciona
//    sin ningún módulo externo adicional.
// --------------------------------------------------
document.getElementById('btn-insert-table').addEventListener('click', () => {
    const cols      = parseInt(document.getElementById('table-cols').value, 10);
    const rows      = parseInt(document.getElementById('table-rows').value, 10);
    const conHeader = document.getElementById('table-header').checked;

    // Construir el HTML de la tabla
    let html = '<table><tbody>';

    for (let r = 0; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
            if (r === 0 && conHeader) {
                html += `<th>Cabecera ${c + 1}</th>`;
            } else {
                html += '<td> </td>';
            }
        }
        html += '</tr>';
    }

    html += '</tbody></table><p><br></p>';

    // Obtener el índice actual del cursor (o el final si no hay foco)
    const range = quill.getSelection() || { index: quill.getLength() };

    // Insertar en la posición del cursor
    quill.clipboard.dangerouslyPasteHTML(range.index, html);

    // Mover el cursor justo después de la tabla
    quill.setSelection(range.index + 1, 0);
    quill.focus();
});

// --------------------------------------------------
// 3. CARGAR CATEGORÍAS en el <select>
// --------------------------------------------------
async function cargarCategorias() {
    const select = document.getElementById('categoria_id');

    const { data, error } = await supabase
        .from('categorias')
        .select('id, nombre')
        .order('nombre');

    if (error) {
        console.error('Error cargando categorías:', error);
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '⚠️ Error al cargar categorías';
        opt.disabled = true;
        select.appendChild(opt);
        return;
    }

    if (!data || data.length === 0) {
        console.warn('No se encontraron categorías. Verifica RLS en Supabase.');
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '⚠️ Sin categorías — revisa RLS en Supabase';
        opt.disabled = true;
        select.appendChild(opt);
        return;
    }

    data.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
    });
}
cargarCategorias();

// --------------------------------------------------
// 4. GENERADOR AUTOMÁTICO DE slug
// --------------------------------------------------
const inputTitulo = document.getElementById('titulo');
const inputSlug   = document.getElementById('slug');
let slugManual    = false;

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
// 5. GESTIÓN DE IMAGEN DE PORTADA
// --------------------------------------------------
const imgPreviewBox   = document.getElementById('img-preview-box');
const imgPreview      = document.getElementById('img-preview');
const fileInput       = document.getElementById('imagen_archivo');
const fileDropArea    = document.getElementById('file-drop-area');
const fileNameDisplay = document.getElementById('file-name-display');
const inputImagenUrl  = document.getElementById('imagen_portada');
const btnRemoveImg    = document.getElementById('btn-remove-img');

let archivoImagenSeleccionado = null;
let imagenUrlFinal = null;

// — Pestañas —
document.querySelectorAll('.img-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.img-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const panel = tab.dataset.tab;
        document.getElementById('panel-upload').classList.toggle('hidden', panel !== 'upload');
        document.getElementById('panel-url').classList.toggle('hidden', panel !== 'url');
    });
});

fileDropArea.addEventListener('click', () => fileInput.click());

fileDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropArea.classList.add('dragging');
});
fileDropArea.addEventListener('dragleave', () => {
    fileDropArea.classList.remove('dragging');
});
fileDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropArea.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        procesarArchivoImagen(file);
    }
});

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) procesarArchivoImagen(file);
});

function procesarArchivoImagen(file) {
    archivoImagenSeleccionado = file;
    imagenUrlFinal = null;
    fileNameDisplay.textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    const objectUrl = URL.createObjectURL(file);
    mostrarPreviewImagen(objectUrl);
}

inputImagenUrl.addEventListener('input', () => {
    const url = inputImagenUrl.value.trim();
    archivoImagenSeleccionado = null;
    imagenUrlFinal = null;
    if (url) {
        mostrarPreviewImagen(url);
    } else {
        ocultarPreviewImagen();
    }
});

function mostrarPreviewImagen(src) {
    imgPreview.src = src;
    imgPreviewBox.classList.remove('hidden');
}

function ocultarPreviewImagen() {
    imgPreviewBox.classList.add('hidden');
    imgPreview.src = '';
    archivoImagenSeleccionado = null;
    imagenUrlFinal = null;
    fileInput.value = '';
    fileNameDisplay.textContent = '';
    inputImagenUrl.value = '';
}

btnRemoveImg.addEventListener('click', ocultarPreviewImagen);

async function subirImagenAStorage(file) {
    const extension = file.name.split('.').pop();
    const nombreArchivo = `portada-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
        .from('portadas')
        .upload(nombreArchivo, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
        });

    if (uploadError) {
        throw new Error('Error subiendo imagen: ' + uploadError.message);
    }

    const { data: urlData } = supabase.storage
        .from('portadas')
        .getPublicUrl(nombreArchivo);

    return urlData.publicUrl;
}

// --------------------------------------------------
// 6. MODAL DE PREVISUALIZACIÓN
// --------------------------------------------------
document.getElementById('btn-preview').addEventListener('click', () => {
    const titulo      = document.getElementById('titulo').value;
    const descripcion = document.getElementById('descripcion').value;
    const contenido   = getContenido();
    const imagen      = imgPreview.src && !imgPreviewBox.classList.contains('hidden') ? imgPreview.src : '';
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
// 7. PUBLICAR ARTÍCULO EN SUPABASE
// --------------------------------------------------
document.getElementById('btn-submit').addEventListener('click', publicarArticulo);

async function publicarArticulo() {
    limpiarErrores();

    const titulo         = document.getElementById('titulo').value.trim();
    const slug           = document.getElementById('slug').value.trim();
    const descripcion    = document.getElementById('descripcion').value.trim();
    const contenido      = getContenido();
    const categoria_id   = document.getElementById('categoria_id').value;
    const estado         = document.getElementById('estado').value === 'true';

    const contenidoVacio = !contenido || contenido === '<p><br></p>' || contenido === '<p></p>';

    let valido = true;
    if (!titulo)        { marcarError('titulo',       'El título es obligatorio.');  valido = false; }
    if (!slug)          { marcarError('slug',          'La URL es obligatoria.');     valido = false; }
    if (!categoria_id)  { marcarError('categoria_id', 'Selecciona una categoría.');  valido = false; }
    if (contenidoVacio) { mostrarStatus('El contenido no puede estar vacío.', 'error'); valido = false; }
    if (!valido) return;

    mostrarStatus('⏳ Publicando artículo...', 'loading');

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

    let imagen_portada = null;

    if (archivoImagenSeleccionado) {
        try {
            mostrarStatus('⏳ Subiendo imagen...', 'loading');
            imagenUrlFinal = await subirImagenAStorage(archivoImagenSeleccionado);
            imagen_portada = imagenUrlFinal;
        } catch (err) {
            mostrarStatus('❌ ' + err.message, 'error');
            return;
        }
    } else if (inputImagenUrl.value.trim()) {
        imagen_portada = inputImagenUrl.value.trim();
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

    mostrarStatus('⏳ Guardando artículo...', 'loading');

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
    ocultarPreviewImagen();
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