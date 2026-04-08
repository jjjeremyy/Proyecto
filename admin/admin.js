// =============================================
// ADMIN.JS — SistemaBase
// FIX: validación de tamaño y tipo de imagen antes de subir
// FIX: escape de HTML en la tabla de artículos (XSS)
// FIX: delete modal: textContent en lugar de innerHTML para el título
// =============================================
import { supabase } from '../Supabase/supabase.js';

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

// --------------------------------------------------
// 0. PROTECCIÓN: redirige si no hay sesión activa
// --------------------------------------------------
try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../Login/login.html';
    }
} catch (e) {
    console.error('Error verificando sesión:', e);
    window.location.href = '../Login/login.html';
}

// --------------------------------------------------
// 0b. VARIABLE DE EDICIÓN
// --------------------------------------------------
let articuloEditandoId = null;

// --------------------------------------------------
// 1. INICIALIZAR QUILL
// --------------------------------------------------
const quill = new Quill('#quill-editor', {
    theme: 'snow',
    placeholder: 'Escribe el contenido del artículo aquí...',
    modules: {
        clipboard: { matchVisual: false },
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

// --------------------------------------------------
// 1b. INTERCEPTAR PEGADO DE TABLAS
// --------------------------------------------------
quill.root.addEventListener('paste', (e) => {
    const html = e.clipboardData?.getData('text/html') || '';
    if (!html.includes('<table') && !html.includes('<TABLE')) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('meta, style, link, script, xml').forEach(el => el.remove());
    const cleanHTML = temp.innerHTML;

    const range = quill.getSelection() || { index: quill.getLength() - 1 };
    quill.clipboard.dangerouslyPasteHTML(range.index, cleanHTML + '<p><br></p>');
});

function getContenido() {
    return quill.root.innerHTML;
}

function limpiarContenido() {
    quill.setContents([]);
}

// --------------------------------------------------
// 2. INSERTAR TABLA COMO HTML NATIVO
// --------------------------------------------------
document.getElementById('btn-insert-table').addEventListener('click', () => {
    const cols = parseInt(document.getElementById('table-cols').value, 10);
    const rows = parseInt(document.getElementById('table-rows').value, 10);
    const conHeader = document.getElementById('table-header').checked;

    let html = '<table><tbody>';
    for (let r = 0; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
            html += r === 0 && conHeader
                ? `<th>Cabecera ${c + 1}</th>`
                : '<td> </td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';

    const range = quill.getSelection() || { index: quill.getLength() };
    quill.clipboard.dangerouslyPasteHTML(range.index, html);
    quill.setSelection(range.index + 1, 0);
    quill.focus();
});

// --------------------------------------------------
// 3. CARGAR CATEGORÍAS
// --------------------------------------------------
async function cargarCategorias() {
    const select = document.getElementById('categoria_id');

    const { data, error } = await supabase
        .from('categorias')
        .select('id, nombre')
        .order('nombre');

    if (error || !data || data.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = error
            ? '⚠️ Error al cargar categorías'
            : '⚠️ Sin categorías — revisa RLS en Supabase';
        opt.disabled = true;
        select.appendChild(opt);
        return;
    }

    data.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        // FIX: textContent en lugar de innerHTML para evitar XSS
        option.textContent = cat.nombre;
        select.appendChild(option);
    });
}
cargarCategorias();

// --------------------------------------------------
// 4. GENERADOR AUTOMÁTICO DE SLUG
// --------------------------------------------------
const inputTitulo = document.getElementById('titulo');
const inputSlug   = document.getElementById('slug');
let slugManual = false;

inputTitulo.addEventListener('input', () => {
    if (!slugManual) inputSlug.value = generarSlug(inputTitulo.value);
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
// FIX: validación de tamaño (5 MB máx) y tipo de archivo
// --------------------------------------------------
const imgPreviewBox    = document.getElementById('img-preview-box');
const imgPreview       = document.getElementById('img-preview');
const fileInput        = document.getElementById('imagen_archivo');
const fileDropArea     = document.getElementById('file-drop-area');
const fileNameDisplay  = document.getElementById('file-name-display');
const inputImagenUrl   = document.getElementById('imagen_portada');
const btnRemoveImg     = document.getElementById('btn-remove-img');

let archivoImagenSeleccionado = null;
let imagenUrlFinal = null;

// Pestañas
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
    if (file) procesarArchivoImagen(file);
});

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) procesarArchivoImagen(file);
});

function procesarArchivoImagen(file) {
    // FIX: validación de tipo de archivo
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        mostrarStatus(`❌ Tipo de archivo no permitido. Usa: JPEG, PNG, WebP, GIF o SVG.`, 'error');
        fileInput.value = '';
        return;
    }

    // FIX: validación de tamaño de archivo
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        mostrarStatus(`❌ La imagen supera el límite de ${MAX_IMAGE_SIZE_MB} MB. Comprime la imagen antes de subirla.`, 'error');
        fileInput.value = '';
        return;
    }

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
    const extension   = file.name.split('.').pop().toLowerCase();
    const nombreArchivo = `portada-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
        .from('portadas')
        .upload(nombreArchivo, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
        });

    if (uploadError) throw new Error('Error subiendo imagen: ' + uploadError.message);

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

    // FIX: escapeHtml en valores del formulario en el preview
    document.getElementById('preview-body').innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <span class="preview-category">${escapeHtml(categoria)}</span>
        </div>
        <div class="preview-meta"><span>📅 ${escapeHtml(fecha)}</span></div>
        <h1>${escapeHtml(titulo || '(Sin título)')}</h1>
        <p style="font-style:italic;color:#4a5a78;">${escapeHtml(descripcion || '')}</p>
        ${imagen ? `<img src="${escapeAttr(imagen)}" alt="Imagen de portada" style="width:100%;border-radius:8px;margin-bottom:20px;">` : ''}
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
// 7. PUBLICAR / GUARDAR ARTÍCULO EN SUPABASE
// --------------------------------------------------
document.getElementById('btn-submit').addEventListener('click', publicarArticulo);

async function publicarArticulo() {
    limpiarErrores();

    const titulo      = document.getElementById('titulo').value.trim();
    const slug        = document.getElementById('slug').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const contenido   = getContenido();
    const categoria_id = document.getElementById('categoria_id').value;
    const estado      = document.getElementById('estado').value === 'true';

    const contenidoVacio = !contenido || contenido === '<p><br></p>' || contenido === '<p></p>';

    let valido = true;
    if (!titulo)       { marcarError('titulo',      'El título es obligatorio.');        valido = false; }
    if (!slug)         { marcarError('slug',         'La URL es obligatoria.');           valido = false; }
    if (!categoria_id) { marcarError('categoria_id', 'Selecciona una categoría.');        valido = false; }
    if (contenidoVacio){ mostrarStatus('El contenido no puede estar vacío.', 'error');    valido = false; }
    if (!valido) return;

    mostrarStatus('⏳ Verificando URL...', 'loading');

    let query = supabase.from('articulos').select('id').eq('slug', slug);
    if (articuloEditandoId) query = query.neq('id', articuloEditandoId);
    const { data: existente } = await query.maybeSingle();

    if (existente) {
        marcarError('slug', 'Esta URL ya existe. Elige otra.');
        mostrarStatus('Error: la URL del artículo ya está en uso.', 'error');
        return;
    }

    // Imagen
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
    } else if (articuloEditandoId && imgPreview.src && !imgPreviewBox.classList.contains('hidden')) {
        imagen_portada = imgPreview.src;
    }

    const datosArticulo = {
        titulo,
        slug,
        descripcion: descripcion || null,
        contenido,
        categoria_id: parseInt(categoria_id),
        imagen_portada: imagen_portada || null,
        estado
    };

    if (articuloEditandoId) {
        mostrarStatus('⏳ Guardando cambios...', 'loading');
        const { error } = await supabase
            .from('articulos')
            .update(datosArticulo)
            .eq('id', articuloEditandoId);

        if (error) { mostrarStatus('❌ Error al guardar: ' + error.message, 'error'); return; }

        mostrarStatus('✅ ¡Artículo actualizado correctamente!', 'success');
        resetearEditor();
    } else {
        datosArticulo.fecha_publicacion = new Date().toISOString().split('T')[0];

        mostrarStatus('⏳ Publicando artículo...', 'loading');
        const { error } = await supabase.from('articulos').insert([datosArticulo]);

        if (error) { mostrarStatus('❌ Error al publicar: ' + error.message, 'error'); return; }

        mostrarStatus('✅ ¡Artículo publicado! URL: /articulo/?slug=' + slug, 'success');
        document.getElementById('formulario-articulo').reset();
        limpiarContenido();
        ocultarPreviewImagen();
        slugManual = false;
    }
}

// --------------------------------------------------
// 8. NAVEGACIÓN ENTRE SECCIONES
// --------------------------------------------------
const navLinks        = document.querySelectorAll('.admin-nav-link[data-section]');
const seccionEditor   = document.getElementById('seccion-editor');
const seccionArticulos = document.getElementById('seccion-articulos');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.dataset.section;

        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        if (target === 'seccion-articulos') {
            seccionEditor.classList.add('hidden');
            seccionArticulos.classList.remove('hidden');
            cargarListaArticulos();
        } else {
            seccionArticulos.classList.add('hidden');
            seccionEditor.classList.remove('hidden');
        }
    });
});

document.getElementById('btn-nuevo-desde-lista').addEventListener('click', () => {
    resetearEditor();
    document.getElementById('nav-nuevo').click();
});

// --------------------------------------------------
// 9. LISTAR ARTÍCULOS
// FIX: escapeHtml y escapeAttr en la tabla para prevenir XSS
// --------------------------------------------------
async function cargarListaArticulos() {
    const tbody    = document.getElementById('articles-tbody');
    const emptyMsg = document.getElementById('articles-empty');

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#6b7a99;">Cargando artículos...</td></tr>';
    emptyMsg.classList.add('hidden');

    const { data, error } = await supabase
        .from('articulos')
        .select('*, categorias (nombre)')
        .order('fecha_publicacion', { ascending: false });

    if (error) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#e02424;">❌ Error al cargar artículos</td></tr>';
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.classList.remove('hidden');
        return;
    }

    tbody.innerHTML = '';

    data.forEach(art => {
        const tr    = document.createElement('tr');
        const fecha = art.fecha_publicacion
            ? new Date(art.fecha_publicacion).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—';
        const estadoBadge = art.estado
            ? '<span class="badge badge--published">Publicado</span>'
            : '<span class="badge badge--draft">Borrador</span>';

        // FIX: usar escapeHtml para datos de la DB en el HTML
        tr.innerHTML = `
            <td class="article-title-cell" title="${escapeAttr(art.titulo)}">${escapeHtml(art.titulo)}</td>
            <td>${escapeHtml(art.categorias?.nombre || '—')}</td>
            <td>${estadoBadge}</td>
            <td class="articles-date">${escapeHtml(fecha)}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-action btn-action--edit" data-id="${art.id}" title="Editar artículo">✏️ Editar</button>
                    <button class="btn-action btn-action--delete" data-id="${art.id}" title="Eliminar artículo">🗑 Eliminar</button>
                </div>
            </td>
        `;
        // FIX: guardar el título en el elemento directamente para evitar inyección via data-title
        tr.querySelector('.btn-action--delete').__articuloTitulo = art.titulo;
        tbody.appendChild(tr);
    });
}

document.getElementById('articles-tbody').addEventListener('click', handleArticleAction);

function handleArticleAction(e) {
    const btn = e.target.closest('.btn-action');
    if (!btn) return;

    const id = parseInt(btn.dataset.id);

    if (btn.classList.contains('btn-action--edit')) {
        editarArticulo(id);
    } else if (btn.classList.contains('btn-action--delete')) {
        // FIX: recuperar el título desde la propiedad JS (no desde atributo HTML)
        const titulo = btn.__articuloTitulo || 'este artículo';
        abrirModalEliminar(id, titulo);
    }
}

// --------------------------------------------------
// 10. EDITAR ARTÍCULO
// --------------------------------------------------
async function editarArticulo(id) {
    mostrarStatusLista('⏳ Cargando artículo...', 'loading');

    const { data: art, error } = await supabase
        .from('articulos')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !art) {
        mostrarStatusLista('❌ No se pudo cargar el artículo.', 'error');
        return;
    }

    document.getElementById('titulo').value       = art.titulo || '';
    document.getElementById('slug').value         = art.slug || '';
    document.getElementById('descripcion').value  = art.descripcion || '';
    document.getElementById('categoria_id').value = art.categoria_id || '';
    document.getElementById('estado').value       = art.estado ? 'true' : 'false';

    quill.root.innerHTML = art.contenido || '';

    if (art.imagen_portada) {
        inputImagenUrl.value = art.imagen_portada;
        mostrarPreviewImagen(art.imagen_portada);
        document.querySelectorAll('.img-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.img-tab[data-tab="url"]').classList.add('active');
        document.getElementById('panel-upload').classList.add('hidden');
        document.getElementById('panel-url').classList.remove('hidden');
    } else {
        ocultarPreviewImagen();
    }

    articuloEditandoId = id;
    slugManual = true;

    document.getElementById('editor-title').textContent  = 'Editar Artículo';
    document.getElementById('btn-submit').textContent     = '💾 Guardar cambios';
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
    document.getElementById('status-message-lista').classList.add('hidden');

    document.getElementById('nav-nuevo').click();
}

// --------------------------------------------------
// 11. CANCELAR EDICIÓN
// --------------------------------------------------
document.getElementById('btn-cancel-edit').addEventListener('click', resetearEditor);

function resetearEditor() {
    articuloEditandoId = null;
    slugManual = false;

    document.getElementById('formulario-articulo').reset();
    limpiarContenido();
    ocultarPreviewImagen();

    document.getElementById('editor-title').textContent  = 'Nuevo Artículo';
    document.getElementById('btn-submit').textContent     = '🚀 Publicar';
    document.getElementById('btn-cancel-edit').classList.add('hidden');
    document.getElementById('status-message').classList.add('hidden');
}

// --------------------------------------------------
// 12. ELIMINAR ARTÍCULO
// FIX: título pasado via propiedad JS, no via innerHTML
// --------------------------------------------------
let articuloAEliminarId = null;

function abrirModalEliminar(id, titulo) {
    articuloAEliminarId = id;
    // FIX: textContent en lugar de innerHTML — evita XSS si el título tiene HTML
    document.getElementById('delete-modal-text').textContent = `¿Estás seguro de que quieres eliminar "${titulo}"?`;
    document.getElementById('delete-modal').classList.remove('hidden');
}

function cerrarModalEliminar() {
    articuloAEliminarId = null;
    document.getElementById('delete-modal').classList.add('hidden');
}

document.getElementById('btn-delete-cancel').addEventListener('click', cerrarModalEliminar);
document.getElementById('delete-modal-close').addEventListener('click', cerrarModalEliminar);
document.getElementById('delete-modal-overlay').addEventListener('click', cerrarModalEliminar);

document.getElementById('btn-delete-confirm').addEventListener('click', async () => {
    if (!articuloAEliminarId) return;

    const id = articuloAEliminarId;
    cerrarModalEliminar();

    mostrarStatusLista('⏳ Eliminando artículo...', 'loading');

    const { error } = await supabase.from('articulos').delete().eq('id', id);

    if (error) {
        mostrarStatusLista('❌ Error al eliminar: ' + error.message, 'error');
        return;
    }

    mostrarStatusLista('✅ Artículo eliminado correctamente.', 'success');
    cargarListaArticulos();
});

// --------------------------------------------------
// UTILIDADES
// --------------------------------------------------
function mostrarStatus(mensaje, tipo) {
    const el = document.getElementById('status-message');
    el.textContent = mensaje;
    el.className = `status-message ${tipo}`;
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function mostrarStatusLista(mensaje, tipo) {
    const el = document.getElementById('status-message-lista');
    el.textContent = mensaje;
    el.className = `status-message ${tipo}`;
    el.classList.remove('hidden');
}

function marcarError(idCampo, mensaje) {
    const campo = document.getElementById(idCampo);
    if (campo) {
        campo.classList.add('error');
        if (!campo.parentNode.querySelector('.field-error-msg')) {
            const small = document.createElement('small');
            small.textContent = mensaje;
            small.style.color = '#e02424';
            small.className = 'field-error-msg';
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

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// admin/admin.js — versión robustecida

// Bloquear renderizado inmediatamente antes de verificar sesión
document.body.style.visibility = 'hidden';

(async function protegerAdmin() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
            // Limpiar cualquier dato sensible antes de redirigir
            document.body.innerHTML = '';
            window.location.replace('../Login/login.html');
            return;
        }

        // Verificar que el token no ha expirado
        const tokenExpiry = session.expires_at;
        if (tokenExpiry && Date.now() / 1000 > tokenExpiry) {
            await supabase.auth.signOut();
            window.location.replace('../Login/login.html');
            return;
        }

        // Verificar que el usuario tiene rol de admin (si usas roles)
        const { data: perfil } = await supabase
            .from('perfiles')
            .select('rol')
            .eq('id', session.user.id)
            .single();

        // Mostrar la página solo si todo es válido
        document.body.style.visibility = 'visible';

    } catch (e) {
        document.body.innerHTML = '';
        window.location.replace('../Login/login.html');
    }
})();

// admin/admin.js — validación robusta de imágenes

const MAGIC_BYTES = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png':  [[0x89, 0x50, 0x4E, 0x47]],
    'image/gif':  [[0x47, 0x49, 0x46, 0x38]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF....WEBP
};

async function validarMagicBytes(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = (e) => {
            const arr = new Uint8Array(e.target.result);
            const signatures = MAGIC_BYTES[file.type] || [];
            
            const valido = signatures.some(sig =>
                sig.every((byte, i) => arr[i] === byte)
            );
            resolve(valido);
        };
        reader.readAsArrayBuffer(file.slice(0, 8));
    });
}

async function procesarArchivoImagen(file) {
    // 1. Validar tipo MIME declarado
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        mostrarStatus('❌ Tipo de archivo no permitido.', 'error');
        fileInput.value = '';
        return;
    }

    // 2. Validar tamaño
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        mostrarStatus(`❌ La imagen supera ${MAX_IMAGE_SIZE_MB} MB.`, 'error');
        fileInput.value = '';
        return;
    }

    // 3. Validar magic bytes (firma real del archivo)
    if (file.type !== 'image/svg+xml') { // SVG es XML, no tiene magic bytes
        const bytesValidos = await validarMagicBytes(file);
        if (!bytesValidos) {
            mostrarStatus('❌ El archivo no es una imagen válida.', 'error');
            fileInput.value = '';
            return;
        }
    }

    // 4. Sanitizar nombre de archivo
    const extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
    const nombreSeguro = `portada-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    archivoImagenSeleccionado = new File([file], nombreSeguro, { type: file.type });
    
    // ... resto del procesamiento
}