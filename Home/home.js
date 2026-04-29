import { obtenerArticulosRecientes, obtenerArticulosBuscador } from '../Supabase/supabase.js';

const FAVORITOS_KEY = 'sistemabase_favoritos';

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

function cargarArticulosFavoritos() {
    const section = document.getElementById('favorite-topics');
    const lista = document.getElementById('favorite-articles-list');
    if (!section || !lista) return;

    const favoritos = obtenerFavoritos();

    if (favoritos.length === 0) {
        section.classList.add('hidden');
        lista.innerHTML = '';
        return;
    }

    section.classList.remove('hidden');
    lista.innerHTML = favoritos.map((articulo) => `
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
                <span class="recent-card-cat">${escapeHtml(formatearNombreCategoria(articulo.categoria || ''))}</span>
                <span class="favorite-card-badge" aria-label="Articulo favorito">★</span>
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

function obtenerFavoritos() {
    try {
        const data = JSON.parse(localStorage.getItem(FAVORITOS_KEY) || '[]');
        return Array.isArray(data) ? data.filter((item) => item?.slug) : [];
    } catch (error) {
        console.warn('[SistemaBase] No se pudieron leer los favoritos:', error);
        return [];
    }
}

function asegurarEstilosSkeleton() {
    if (document.getElementById('sk-home-style')) return;

    const estilo = document.createElement('style');
    estilo.id = 'sk-home-style';
    estilo.textContent = '@keyframes sk-home { 0%{background-position:200% 0} 100%{background-position:-200% 0} }';
    document.head.appendChild(estilo);
}

/* ══════════════════════════════════════════════
   BÚSQUEDA FUZZY
   ══════════════════════════════════════════════ */

/**
 * Elimina acentos y convierte a minúsculas.
 * "Programación" → "programacion"
 */
function normalizar(texto) {
    if (!texto) return '';
    return String(texto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Distancia de Levenshtein entre dos cadenas.
 * Mide cuántas ediciones (inserción, borrado, sustitución)
 * separan a y b.
 */
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;

    // Matriz de (m+1) x (n+1)
    const dp = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }

    return dp[m][n];
}

/**
 * Comprueba si query coincide con texto con tolerancia a errores.
 *
 * Estrategia por capas (de más a menos estricta):
 *   1. Coincidencia exacta de subcadena  → score 0  (mejor)
 *   2. Todas las palabras del query aparecen en el texto → score 1
 *   3. Alguna palabra del query está cerca por Levenshtein → score 2
 *
 * Devuelve { match: boolean, score: number }
 * score más bajo = mejor resultado.
 */
function puntuarCoincidencia(textoOriginal, queryOriginal) {
    const texto = normalizar(textoOriginal);
    const query = normalizar(queryOriginal);

    if (!query) return { match: false, score: Infinity };

    // Capa 1: subcadena exacta (normalizada)
    if (texto.includes(query)) return { match: true, score: 0 };

    const palabrasQuery = query.split(/\s+/).filter(Boolean);
    const palabrasTexto = texto.split(/\s+/).filter(Boolean);

    // Capa 2: todas las palabras del query aparecen en el texto
    const todasPresentes = palabrasQuery.every((pq) =>
        palabrasTexto.some((pt) => pt.includes(pq) || pq.includes(pt))
    );
    if (todasPresentes) return { match: true, score: 1 };

    // Capa 3: fuzzy — tolerancia proporcional a la longitud de la palabra
    // Umbral: 1 error por cada 4 caracteres (mínimo 1, máximo 3)
    const hayCoincidenciaFuzzy = palabrasQuery.some((pq) => {
        const umbral = Math.min(3, Math.max(1, Math.floor(pq.length / 4)));
        return palabrasTexto.some((pt) => levenshtein(pq, pt) <= umbral);
    });
    if (hayCoincidenciaFuzzy) return { match: true, score: 2 };

    return { match: false, score: Infinity };
}

/**
 * Filtra y ordena artículos según relevancia al query.
 */
function buscarArticulos(articulos, query) {
    if (!query || query.length < 2) return [];

    const resultados = [];

    for (const articulo of articulos) {
        // Puntuamos título (más peso), descripción y categoría
        const pTitulo      = puntuarCoincidencia(articulo.titulo, query);
        const pDescripcion = puntuarCoincidencia(articulo.descripcion || '', query);
        const pCategoria   = puntuarCoincidencia(articulo.categorias?.nombre || '', query);

        // El título tiene prioridad: si coincide allí, el score es mejor
        const scores = [
            pTitulo.match      ? pTitulo.score      : Infinity,
            pDescripcion.match ? pDescripcion.score + 3 : Infinity,
            pCategoria.match   ? pCategoria.score   + 2 : Infinity,
        ];

        const mejorScore = Math.min(...scores);

        if (mejorScore < Infinity) {
            resultados.push({ articulo, score: mejorScore });
        }
    }

    // Ordenar de mejor a peor score
    resultados.sort((a, b) => a.score - b.score);

    return resultados.map((r) => r.articulo);
}

/* ══════════════════════════════════════════════
   INICIALIZAR BUSCADOR
   ══════════════════════════════════════════════ */

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
        const query = input.value.trim();

        if (query.length < 2) {
            resultados.classList.add('hidden');
            resultados.innerHTML = '';
            return;
        }

        if (!cargado) {
            await cargarDatos();
        }

        const filtrados = buscarArticulos(articulos, query);

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

/* ══════════════════════════════════════════════
   PREFETCH
   ══════════════════════════════════════════════ */

function anadirPrefetchListeners() {
    document.querySelectorAll('.recent-card').forEach((card) => {
        if (card.dataset.prefetchReady === 'true') return;
        card.dataset.prefetchReady = 'true';

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

/* ══════════════════════════════════════════════
   UTILIDADES
   ══════════════════════════════════════════════ */

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
    // Resaltar ignorando acentos: normalizamos el texto escapado para buscar,
    // pero marcamos la posición en el texto original
    const queryNorm = normalizar(query);
    const palabras = queryNorm.split(/\s+/).filter(Boolean);

    let resultado = textoEscapado;
    for (const palabra of palabras) {
        // Regex que ignora acentos usando una aproximación simple de caracteres
        const regex = new RegExp(
            palabra.split('').map((c) => {
                const variantes = {
                    a: '[aáàäâã]', e: '[eéèëê]', i: '[iíìïî]',
                    o: '[oóòöôõ]', u: '[uúùüû]', n: '[nñ]',
                };
                return variantes[c] || escapeRegex(c);
            }).join(''),
            'gi'
        );
        resultado = resultado.replace(regex, '<mark>$&</mark>');
    }
    return resultado;
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
cargarArticulosFavoritos();
inicializarBuscador();
