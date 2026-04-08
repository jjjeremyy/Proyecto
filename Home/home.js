import { obtenerArticulosRecientes, obtenerArticulosBuscador } from '../Supabase/supabase.js';

async function cargarArticulosRecientes() {
    const lista = document.getElementById('recent-articles-list');
    if (!lista) return;

    lista.innerHTML = Array.from({ length: 4 }, () => `
        <div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid rgba(4,56,115,0.08);">
            <div style="height:160px;background:linear-gradient(90deg,#eef2f8 25%,#e2e8f4 50%,#eef2f8 75%);background-size:200% 100%;animation:sk-home 1.4s infinite;"></div>
            <div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px;">
                <div style="height:14px;width:75%;border-radius:5px;background:linear-gradient(90deg,#eef2f8 25%,#e2e8f4 50%,#eef2f8 75%);background-size:200% 100%;animation:sk-home 1.4s infinite;"></div>
                <div style="height:12px;width:55%;border-radius:5px;background:linear-gradient(90deg,#eef2f8 25%,#e2e8f4 50%,#eef2f8 75%);background-size:200% 100%;animation:sk-home 1.4s infinite;"></div>
            </div>
        </div>
    `).join('');

    asegurarEstilosSkeleton();

    let articulos;
    try {
        articulos = await obtenerArticulosRecientes(4, true);
    } catch (error) {
        console.error('[SistemaBase] Error al cargar articulos recientes:', error);
        lista.innerHTML = '<p class="home-no-results">Error al cargar los articulos recientes.</p>';
        return;
    }

    if (!Array.isArray(articulos) || articulos.length === 0) {
        lista.innerHTML = '<p class="home-no-results">No hay articulos publicados todavia.</p>';
        return;
    }

    lista.innerHTML = articulos.map((articulo) => `
        <a href="Articulo/articulo.html?slug=${encodeURIComponent(articulo.slug)}" class="recent-card">
            <div class="recent-card-img-wrap">
                <img
                    src="${escapeAttr(articulo.imagen_portada || 'IMG/IMGprueba.png')}"
                    alt="${escapeAttr(articulo.titulo)}"
                    loading="lazy"
                    width="400"
                    height="160"
                    decoding="async"
                >
                <span class="recent-card-cat">${escapeHtml(formatearNombreCategoria(articulo.categorias?.nombre || ''))}</span>
            </div>
            <div class="recent-card-body">
                <h3>${escapeHtml(articulo.titulo)}</h3>
                <p>${escapeHtml(articulo.descripcion || '')}</p>
                <span class="recent-card-date">${formatearFecha(articulo.fecha_publicacion)}</span>
            </div>
        </a>
    `).join('');

    anadirPrefetchListeners();
}

function asegurarEstilosSkeleton() {
    if (document.getElementById('sk-home-style')) return;

    const estilo = document.createElement('style');
    estilo.id = 'sk-home-style';
    estilo.textContent = '@keyframes sk-home { 0%{background-position:200% 0} 100%{background-position:-200% 0} }';
    document.head.appendChild(estilo);
}

function inicializarBuscador() {
    const input = document.getElementById('search-input');
    const resultados = document.getElementById('search-results');
    if (!input || !resultados) return;

    let articulos = [];
    let cargado = false;
    let cargando = false;

    async function cargarDatos() {
        if (cargado || cargando) return;

        cargando = true;
        try {
            const data = await obtenerArticulosBuscador();
            if (Array.isArray(data)) {
                articulos = data;
                cargado = true;
            }
        } catch (error) {
            console.error('[SistemaBase] Error al cargar datos del buscador:', error);
        } finally {
            cargando = false;
        }
    }

    input.addEventListener('focus', cargarDatos, { once: true });

    input.addEventListener('input', async () => {
        const query = input.value.trim().toLowerCase();

        if (query.length < 2) {
            resultados.classList.add('hidden');
            resultados.innerHTML = '';
            return;
        }

        if (!cargado) {
            await cargarDatos();
        }

        const filtrados = articulos.filter((articulo) =>
            articulo.titulo.toLowerCase().includes(query) ||
            (articulo.descripcion || '').toLowerCase().includes(query) ||
            (articulo.categorias?.nombre || '').toLowerCase().includes(query)
        );

        if (filtrados.length === 0) {
            resultados.innerHTML = `<p class="search-no-results">Sin resultados para "<strong>${escapeHtml(input.value)}</strong>"</p>`;
        } else {
            resultados.innerHTML = filtrados.slice(0, 6).map((articulo) => `
                <a href="Articulo/articulo.html?slug=${encodeURIComponent(articulo.slug)}" class="search-result-item">
                    <img
                        src="${escapeAttr(articulo.imagen_portada || 'IMG/IMGprueba.png')}"
                        alt="${escapeAttr(articulo.titulo)}"
                        width="46"
                        height="46"
                    >
                    <div>
                        <span class="search-result-cat">${escapeHtml(formatearNombreCategoria(articulo.categorias?.nombre || ''))}</span>
                        <p>${resaltarTexto(escapeHtml(articulo.titulo), query)}</p>
                    </div>
                </a>
            `).join('');
        }

        resultados.classList.remove('hidden');
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.search-wrapper')) {
            resultados.classList.add('hidden');
        }
    });

    input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;

        const query = input.value.trim();
        if (!query) return;

        window.location.href = `Categorias/categorias.html?q=${encodeURIComponent(query)}`;
    });
}

function anadirPrefetchListeners() {
    document.querySelectorAll('.recent-card').forEach((card) => {
        card.addEventListener('mouseenter', () => {
            const href = card.getAttribute('href');
            if (!href) return;

            try {
                const slug = new URL(href, window.location.href).searchParams.get('slug');
                if (!slug) return;

                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = `Articulo/articulo.html?slug=${encodeURIComponent(slug)}`;
                document.head.appendChild(link);
            } catch (error) {
                console.debug('[SistemaBase] Prefetch omitido:', error);
            }
        }, { once: true });
    });
}

function formatearFecha(fecha) {
    if (!fecha) return '';

    return new Date(`${fecha}T00:00`).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function formatearNombreCategoria(nombre) {
    if (!nombre) return '';

    if (/[A-ZÁÉÍÓÚÑ ]/.test(nombre)) {
        return nombre;
    }

    return nombre
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resaltarTexto(textoEscapado, query) {
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return textoEscapado.replace(regex, '<mark>$1</mark>');
}

function escapeHtml(valor) {
    if (!valor) return '';

    return String(valor).replace(/[&<>"']/g, (match) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#39;',
    }[match]));
}

function escapeAttr(valor) {
    if (!valor) return '';
    return String(valor).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeRegex(valor) {
    return String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

await cargarArticulosRecientes();
inicializarBuscador();
