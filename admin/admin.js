import { supabase } from '../Supabase/supabase.js';

// ── Contraseña ─────────────────────────────────────────
const PASSWORD = 'sistemabase2026';

const loginScreen = document.getElementById('login-screen');
const adminPanel  = document.getElementById('admin-panel');
const loginError  = document.getElementById('login-error');

// Verificar si ya estaba logueado en esta sesión
if (sessionStorage.getItem('admin_ok') === 'true') {
    mostrarPanel();
}

document.getElementById('login-btn').addEventListener('click', () => {
    const val = document.getElementById('password-input').value;
    if (val === PASSWORD) {
        sessionStorage.setItem('admin_ok', 'true');
        mostrarPanel();
    } else {
        loginError.classList.remove('hidden');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('admin_ok');
    location.reload();
});

function mostrarPanel() {
    loginScreen.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    cargarCategorias();
    cargarTablaArticulos();
}

// ── Editor Quill ───────────────────────────────────────
const quill = new Quill('#editor-contenido', {
    theme: 'snow',
    placeholder: 'Escribí el contenido del artículo...',
    modules: {
        toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'header': [1, 2, 3, false] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link', 'image'],
            ['clean']
        ]
    }
});

// ── Generar slug automático ────────────────────────────
document.getElementById('generar-slug-btn').addEventListener('click', () => {
    const titulo = document.getElementById('titulo').value;
    const slug = titulo
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // saca tildes
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
    document.getElementById('slug').value = slug;
});

// ── Vista previa imagen ────────────────────────────────
document.getElementById('preview-img-btn').addEventListener('click', () => {
    const url = document.getElementById('imagen_portada').value;
    const preview = document.getElementById('imagen-preview');
    if (url) {
        preview.src = url;
        preview.classList.remove('hidden');
    }
});

// ── Cargar categorías en el select ─────────────────────
async function cargarCategorias() {
    const { data, error } = await supabase.from('categorias').select('*');
    if (error) return;
    const select = document.getElementById('categoria_id');
    data.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
    });
}

// ── Publicar artículo ──────────────────────────────────
document.getElementById('publicar-btn').addEventListener('click', async () => {
    const titulo     = document.getElementById('titulo').value.trim();
    const slug       = document.getElementById('slug').value.trim();
    const contenido  = quill.root.innerHTML; // HTML del editor
    const categoria  = document.getElementById('categoria_id').value;

    const msgExito = document.getElementById('mensaje-exito');
    const msgError = document.getElementById('mensaje-error');
    msgExito.classList.add('hidden');
    msgError.classList.add('hidden');

    if (!titulo || !slug || !categoria) {
        msgError.textContent = 'Título, slug y categoría son obligatorios.';
        msgError.classList.remove('hidden');
        return;
    }

    const nuevoArticulo = {
        titulo,
        slug,
        descripcion: document.getElementById('descripcion').value,
        contenido,
        categoria_id: categoria,
        imagen_portada: document.getElementById('imagen_portada').value || null,
        fecha_publicacion: new Date().toISOString(),
        estado: true
    };

    const { error } = await supabase.from('articulos').insert([nuevoArticulo]);

    if (error) {
        msgError.textContent = 'Error: ' + error.message;
        msgError.classList.remove('hidden');
    } else {
        msgExito.classList.remove('hidden');
        document.getElementById('titulo').value = '';
        document.getElementById('slug').value = '';
        document.getElementById('descripcion').value = '';
        document.getElementById('imagen_portada').value = '';
        document.getElementById('imagen-preview').classList.add('hidden');
        document.getElementById('categoria_id').value = '';
        quill.setText('');
        cargarTablaArticulos();
    }
});

// ── Tabla de artículos ─────────────────────────────────
document.getElementById('recargar-btn').addEventListener('click', cargarTablaArticulos);

async function cargarTablaArticulos() {
    const tbody = document.getElementById('tbody-articulos');
    tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';

    const { data, error } = await supabase
        .from('articulos')
        .select('*, categorias(nombre)')
        .order('fecha_publicacion', { ascending: false });

    if (error) {
        tbody.innerHTML = '<tr><td colspan="5">Error al cargar.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(a => `
        <tr>
            <td>${a.titulo}</td>
            <td>${a.categorias?.nombre || '-'}</td>
            <td>${a.fecha_publicacion?.slice(0, 10) || '-'}</td>
            <td>${a.estado ? '✅ Activo' : '❌ Inactivo'}</td>
            <td>
                <button 
                    class="${a.estado ? 'btn-desactivar' : 'btn-activar'}"
                    onclick="toggleEstado('${a.id}', ${a.estado})">
                    ${a.estado ? 'Desactivar' : 'Activar'}
                </button>
            </td>
        </tr>
    `).join('');
}

// ── Activar / Desactivar artículo ──────────────────────
window.toggleEstado = async (id, estadoActual) => {
    const { error } = await supabase
        .from('articulos')
        .update({ estado: !estadoActual })
        .eq('id', id);

    if (!error) cargarTablaArticulos();
};