// =============================================
// ADMIN.JS — SistemaBase
// FIX: soporte completo de tablas en Quill v1.x
//      Las tablas se gestionan directamente en el DOM
//      del editor, sin pasar por el modelo Delta de Quill.
// =============================================
import { supabase } from '../Supabase/supabase.js';

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const LOGIN_PATH = '../Login/login.html';
const adminContext = await exigirRolAdmin();
if (!adminContext) {
    throw new Error('No se pudo inicializar el panel de administracion.');
}

// --------------------------------------------------
// 0b. VARIABLE DE EDICION
// --------------------------------------------------
let articuloEditandoId = null;

async function exigirRolAdmin() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) { redirigirALogin(); return null; }
        if (session.expires_at && Date.now() / 1000 > session.expires_at) {
            await supabase.auth.signOut(); redirigirALogin(); return null;
        }
        const { data: perfil, error: perfilError } = await supabase
            .from('perfiles').select('rol').eq('id', session.user.id).maybeSingle();
        const rol = String(perfil?.rol || '').toLowerCase();
        const tablaPerfilDisponible = !perfilError;
        const rolExplicitoNoAdmin = tablaPerfilDisponible && perfil && rol !== 'admin';
        if (rolExplicitoNoAdmin) { await supabase.auth.signOut(); redirigirALogin(); return null; }
        if (perfilError) console.warn('No se pudo validar el rol admin desde perfiles.', perfilError);
        else if (!perfil) console.warn('No existe perfil para este usuario.');
        document.body.classList.remove('admin-pending');
        document.body.classList.add('admin-ready');
        return { session, perfil };
    } catch (error) {
        console.error('Error verificando rol admin:', error);
        redirigirALogin();
        return null;
    }
}

function redirigirALogin() {
    document.body.classList.remove('admin-ready');
    document.body.classList.add('admin-pending');
    window.location.replace(LOGIN_PATH);
}

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
// 1b. PRESERVAR TABLAS: Quill v1 elimina tablas de su
//     modelo interno. La solución es guardar el HTML
//     completo (incluyendo tablas) por separado y
//     reconstruirlo al leer/escribir.
// --------------------------------------------------

/**
 * Devuelve el HTML del editor TAL CUAL está en el DOM,
 * preservando tablas y cualquier HTML que Quill no entienda.
 */
function getContenido() {
    return quill.root.innerHTML;
}

/**
 * Carga HTML en el editor respetando tablas.
 * Quill.setContents() destruye las tablas,
 * así que escribimos directamente en el DOM.
 */
function setContenido(html) {
    quill.root.innerHTML = html || '';
}

function limpiarContenido() {
    quill.root.innerHTML = '';
}

// --------------------------------------------------
// 1c. INTERCEPTAR PEGADO: preservar tablas del portapapeles
// --------------------------------------------------
quill.root.addEventListener('paste', (e) => {
    const html = e.clipboardData?.getData('text/html') || '';
    if (!html.includes('<table') && !html.includes('<TABLE')) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    // Limpiar metadatos de Office/Google Docs pero conservar la tabla
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('meta, style, link, script, xml, o\\:p').forEach(el => el.remove());

    // Eliminar atributos de estilo inline masivos (de Word/Sheets) pero conservar estructura
    temp.querySelectorAll('table, tr, td, th, tbody, thead, tfoot').forEach(el => {
        // Conservar sólo colspan y rowspan
        const colspan = el.getAttribute('colspan');
        const rowspan = el.getAttribute('rowspan');
        // Eliminar todos los atributos
        while (el.attributes.length > 0) el.removeAttribute(el.attributes[0].name);
        if (colspan) el.setAttribute('colspan', colspan);
        if (rowspan) el.setAttribute('rowspan', rowspan);
    });

    const cleanHTML = temp.innerHTML;

    // Insertar en la posición actual del cursor
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const fragment = range.createContextualFragment(cleanHTML + '<p><br></p>');
        range.insertNode(fragment);
        // Mover cursor al final del fragmento insertado
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        quill.root.innerHTML += cleanHTML + '<p><br></p>';
    }
});

// --------------------------------------------------
// 2. INSERTAR TABLA DIRECTAMENTE EN EL DOM DEL EDITOR
// --------------------------------------------------
document.getElementById('btn-insert-table').addEventListener('click', () => {
    const cols = parseInt(document.getElementById('table-cols').value, 10);
    const rows = parseInt(document.getElementById('table-rows').value, 10);
    const conHeader = document.getElementById('table-header').checked;

    // Construir la tabla como elemento DOM real
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');

    for (let r = 0; r < rows; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement(r === 0 && conHeader ? 'th' : 'td');
            cell.textContent = r === 0 && conHeader ? `Cabecera ${c + 1}` : ' ';
            tr.appendChild(cell);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    // Párrafo después de la tabla para poder seguir escribiendo
    const afterParagraph = document.createElement('p');
    afterParagraph.innerHTML = '<br>';

    // Insertar en la posición del cursor dentro del editor
    const selection = window.getSelection();
    let inserted = false;

    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // Verificar que el cursor está dentro del editor
        if (quill.root.contains(range.commonAncestorContainer)) {
            // Subir hasta encontrar un hijo directo del editor
            let node = range.commonAncestorContainer;
            while (node && node.parentNode !== quill.root) {
                node = node.parentNode;
            }
            if (node && node.parentNode === quill.root) {
                quill.root.insertBefore(afterParagraph, node.nextSibling);
                quill.root.insertBefore(table, afterParagraph);
                inserted = true;
                // Mover cursor al primer td/th
                const firstCell = table.querySelector('td, th');
                if (firstCell) {
                    const newRange = document.createRange();
                    newRange.setStart(firstCell, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }
        }
    }

    if (!inserted) {
        quill.root.appendChild(table);
        quill.root.appendChild(afterParagraph);
    }

    quill.root.focus();
});

// --------------------------------------------------
// 3. CARGAR CATEGORÍAS
// --------------------------------------------------
async function cargarCategorias() {
    const select = document.getElementById('categoria_id');
    const { data, error } = await supabase
        .from('categorias').select('id, nombre').order('nombre');

    if (error || !data || data.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = error ? '⚠️ Error al cargar categorías' : '⚠️ Sin categorías — revisa RLS en Supabase';
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
    return texto.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '').trim()
        .replace(/\s+/g, '-').replace(/-+/g, '-');
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
fileDropArea.addEventListener('dragover', (e) => { e.preventDefault(); fileDropArea.classList.add('dragging'); });
fileDropArea.addEventListener('dragleave', () => fileDropArea.classList.remove('dragging'));
fileDropArea.addEventListener('drop', (e) => {
    e.preventDefault(); fileDropArea.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file) procesarArchivoImagen(file);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) procesarArchivoImagen(fileInput.files[0]); });

inputImagenUrl.addEventListener('input', () => {
    const url = inputImagenUrl.value.trim();
    archivoImagenSeleccionado = null; imagenUrlFinal = null;
    if (url) mostrarPreviewImagen(url); else ocultarPreviewImagen();
});

function mostrarPreviewImagen(src) { imgPreview.src = src; imgPreviewBox.classList.remove('hidden'); }
function ocultarPreviewImagen() {
    imgPreviewBox.classList.add('hidden'); imgPreview.src = '';
    archivoImagenSeleccionado = null; imagenUrlFinal = null;
    fileInput.value = ''; fileNameDisplay.textContent = ''; inputImagenUrl.value = '';
}
btnRemoveImg.addEventListener('click', ocultarPreviewImagen);

async function subirImagenAStorage(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    const nombreArchivo = `portada-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('portadas')
        .upload(nombreArchivo, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (uploadError) throw new Error('Error subiendo imagen: ' + uploadError.message);
    const { data: urlData } = supabase.storage.from('portadas').getPublicUrl(nombreArchivo);
    return urlData.publicUrl;
}

const MAGIC_BYTES = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/png':  [[0x89, 0x50, 0x4E, 0x47]],
    'image/gif':  [[0x47, 0x49, 0x46, 0x38]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]],
};

async function validarMagicBytes(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = (e) => {
            const arr = new Uint8Array(e.target.result);
            const signatures = MAGIC_BYTES[file.type] || [];
            resolve(signatures.some(sig => sig.every((byte, i) => arr[i] === byte)));
        };
        reader.readAsArrayBuffer(file.slice(0, 8));
    });
}

async function procesarArchivoImagen(file) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        mostrarStatus('❌ Tipo de archivo no permitido.', 'error'); fileInput.value = ''; return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        mostrarStatus(`❌ La imagen supera ${MAX_IMAGE_SIZE_MB} MB.`, 'error'); fileInput.value = ''; return;
    }
    if (file.type !== 'image/svg+xml') {
        const bytesValidos = await validarMagicBytes(file);
        if (!bytesValidos) {
            mostrarStatus('❌ El archivo no es una imagen válida.', 'error'); fileInput.value = ''; return;
        }
    }
    const extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
    const nombreSeguro = `portada-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    archivoImagenSeleccionado = new File([file], nombreSeguro, { type: file.type });
    imagenUrlFinal = null;
    fileNameDisplay.textContent = `${archivoImagenSeleccionado.name} (${(file.size / 1024).toFixed(1)} KB)`;
    mostrarPreviewImagen(URL.createObjectURL(archivoImagenSeleccionado));
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
            <span class="preview-category">${escapeHtml(categoria)}</span>
        </div>
        <div class="preview-meta"><span>📅 ${escapeHtml(fecha)}</span></div>
        <h1>${escapeHtml(titulo || '(Sin título)')}</h1>
        <p style="font-style:italic;color:#4a5a78;">${escapeHtml(descripcion || '')}</p>
        ${imagen ? `<img src="${escapeAttr(imagen)}" alt="Imagen de portada" style="width:100%;border-radius:8px;margin-bottom:20px;">` : ''}
        <div class="ql-snow"><div class="ql-editor preview-content" style="padding:0">${contenido || '<p style="color:#999">(Sin contenido aún)</p>'}</div></div>
    `;

    document.getElementById('preview-modal').classList.remove('hidden');
});

document.getElementById('close-preview').addEventListener('click', cerrarModal);
document.getElementById('modal-overlay').addEventListener('click', cerrarModal);
function cerrarModal() { document.getElementById('preview-modal').classList.add('hidden'); }

// --------------------------------------------------
// 7. PUBLICAR / GUARDAR ARTÍCULO EN SUPABASE
// --------------------------------------------------
document.getElementById('btn-submit').addEventListener('click', publicarArticulo);

async function publicarArticulo() {
    limpiarErrores();
    const titulo       = document.getElementById('titulo').value.trim();
    const slug         = document.getElementById('slug').value.trim();
    const descripcion  = document.getElementById('descripcion').value.trim();
    const contenido    = getContenido();
    const categoria_id = document.getElementById('categoria_id').value;
    const estado       = document.getElementById('estado').value === 'true';
    const contenidoVacio = !contenido || contenido === '<p><br></p>' || contenido === '<p></p>';

    let valido = true;
    if (!titulo)        { marcarError('titulo',       'El título es obligatorio.');     valido = false; }
    if (!slug)          { marcarError('slug',          'La URL es obligatoria.');        valido = false; }
    if (!categoria_id)  { marcarError('categoria_id', 'Selecciona una categoría.');     valido = false; }
    if (contenidoVacio) { mostrarStatus('El contenido no puede estar vacío.', 'error'); valido = false; }
    if (!valido) return;

    mostrarStatus('⏳ Verificando URL...', 'loading');
    let query = supabase.from('articulos').select('id').eq('slug', slug);
    if (articuloEditandoId) query = query.neq('id', articuloEditandoId);
    const { data: existente } = await query.maybeSingle();
    if (existente) { marcarError('slug', 'Esta URL ya existe. Elige otra.'); mostrarStatus('Error: la URL del artículo ya está en uso.', 'error'); return; }

    let imagen_portada = null;
    if (archivoImagenSeleccionado) {
        try {
            mostrarStatus('⏳ Subiendo imagen...', 'loading');
            imagenUrlFinal = await subirImagenAStorage(archivoImagenSeleccionado);
            imagen_portada = imagenUrlFinal;
        } catch (err) { mostrarStatus('❌ ' + err.message, 'error'); return; }
    } else if (inputImagenUrl.value.trim()) {
        imagen_portada = inputImagenUrl.value.trim();
    } else if (articuloEditandoId && imgPreview.src && !imgPreviewBox.classList.contains('hidden')) {
        imagen_portada = imgPreview.src;
    }

    const datosArticulo = {
        titulo, slug,
        descripcion: descripcion || null,
        contenido,
        categoria_id: parseInt(categoria_id),
        imagen_portada: imagen_portada || null,
        estado
    };

    if (articuloEditandoId) {
        mostrarStatus('⏳ Guardando cambios...', 'loading');
        const { error } = await supabase.from('articulos').update(datosArticulo).eq('id', articuloEditandoId);
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
const navLinks         = document.querySelectorAll('.admin-nav-link[data-section]');
const seccionEditor    = document.getElementById('seccion-editor');
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
// --------------------------------------------------
async function cargarListaArticulos() {
    const tbody    = document.getElementById('articles-tbody');
    const emptyMsg = document.getElementById('articles-empty');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#6b7a99;">Cargando artículos...</td></tr>';
    emptyMsg.classList.add('hidden');

    const { data, error } = await supabase.from('articulos')
        .select('*, categorias (nombre)').order('fecha_publicacion', { ascending: false });

    if (error) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#e02424;">❌ Error al cargar artículos</td></tr>'; return; }
    if (!data || data.length === 0) { tbody.innerHTML = ''; emptyMsg.classList.remove('hidden'); return; }

    tbody.innerHTML = '';
    data.forEach(art => {
        const tr = document.createElement('tr');
        const fecha = art.fecha_publicacion
            ? new Date(art.fecha_publicacion).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—';
        const estadoBadge = art.estado
            ? '<span class="badge badge--published">Publicado</span>'
            : '<span class="badge badge--draft">Borrador</span>';

        tr.innerHTML = `
            <td class="article-title-cell" title="${escapeAttr(art.titulo)}">${escapeHtml(art.titulo)}</td>
            <td>${escapeHtml(art.categorias?.nombre || '—')}</td>
            <td>${estadoBadge}</td>
            <td class="articles-date">${escapeHtml(fecha)}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-action btn-action--edit" data-id="${art.id}">✏️ Editar</button>
                    <button class="btn-action btn-action--delete" data-id="${art.id}">🗑 Eliminar</button>
                </div>
            </td>
        `;
        tr.querySelector('.btn-action--delete').__articuloTitulo = art.titulo;
        tbody.appendChild(tr);
    });
}

document.getElementById('articles-tbody').addEventListener('click', handleArticleAction);

function handleArticleAction(e) {
    const btn = e.target.closest('.btn-action');
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    if (btn.classList.contains('btn-action--edit')) editarArticulo(id);
    else if (btn.classList.contains('btn-action--delete')) abrirModalEliminar(id, btn.__articuloTitulo || 'este artículo');
}

// --------------------------------------------------
// 10. EDITAR ARTÍCULO
// --------------------------------------------------
async function editarArticulo(id) {
    mostrarStatusLista('⏳ Cargando artículo...', 'loading');
    const { data: art, error } = await supabase.from('articulos').select('*').eq('id', id).single();
    if (error || !art) { mostrarStatusLista('❌ No se pudo cargar el artículo.', 'error'); return; }

    document.getElementById('titulo').value       = art.titulo || '';
    document.getElementById('slug').value         = art.slug || '';
    document.getElementById('descripcion').value  = art.descripcion || '';
    document.getElementById('categoria_id').value = art.categoria_id || '';
    document.getElementById('estado').value       = art.estado ? 'true' : 'false';

    // FIX: usar setContenido (DOM directo) en lugar de quill.root.innerHTML
    // para preservar tablas al cargar un artículo guardado.
    setContenido(art.contenido || '');

    if (art.imagen_portada) {
        inputImagenUrl.value = art.imagen_portada;
        mostrarPreviewImagen(art.imagen_portada);
        document.querySelectorAll('.img-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.img-tab[data-tab="url"]').classList.add('active');
        document.getElementById('panel-upload').classList.add('hidden');
        document.getElementById('panel-url').classList.remove('hidden');
    } else { ocultarPreviewImagen(); }

    articuloEditandoId = id;
    slugManual = true;
    document.getElementById('editor-title').textContent = 'Editar Artículo';
    document.getElementById('btn-submit').textContent    = '💾 Guardar cambios';
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
    document.getElementById('status-message-lista').classList.add('hidden');
    document.getElementById('nav-nuevo').click();
}

// --------------------------------------------------
// 11. CANCELAR EDICIÓN
// --------------------------------------------------
document.getElementById('btn-cancel-edit').addEventListener('click', resetearEditor);

function resetearEditor() {
    articuloEditandoId = null; slugManual = false;
    document.getElementById('formulario-articulo').reset();
    limpiarContenido();
    ocultarPreviewImagen();
    document.getElementById('editor-title').textContent = 'Nuevo Artículo';
    document.getElementById('btn-submit').textContent    = '🚀 Publicar';
    document.getElementById('btn-cancel-edit').classList.add('hidden');
    document.getElementById('status-message').classList.add('hidden');
}

// --------------------------------------------------
// 12. ELIMINAR ARTÍCULO
// --------------------------------------------------
let articuloAEliminarId = null;

function abrirModalEliminar(id, titulo) {
    articuloAEliminarId = id;
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
    if (error) { mostrarStatusLista('❌ Error al eliminar: ' + error.message, 'error'); return; }
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
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// --------------------------------------------------
// LOGOUT + AUTO-LOGOUT POR INACTIVIDAD
// --------------------------------------------------
document.getElementById('nav-logout').addEventListener('click', async (e) => {
    e.preventDefault();
    if (!confirm('¿Seguro que quieres cerrar sesión?')) return;
    try {
        await supabase.auth.signOut();
        localStorage.clear(); sessionStorage.clear();
        window.location.replace('../Login/login.html');
    } catch (e) {
        console.error('Error al cerrar sesión:', e);
        window.location.replace('../Login/login.html');
    }
});

let timerInactividad;
function resetearTimerInactividad() {
    clearTimeout(timerInactividad);
    timerInactividad = setTimeout(async () => {
        await supabase.auth.signOut();
        alert('Sesión expirada por inactividad.');
        window.location.replace('../Login/login.html');
    }, 30 * 60 * 1000);
}
['click', 'keypress', 'scroll', 'mousemove'].forEach(ev => {
    document.addEventListener(ev, resetearTimerInactividad, { passive: true });
});
resetearTimerInactividad();