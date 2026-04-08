const form = document.getElementById('form');
const btn = document.getElementById('button');
const feedback = document.getElementById('formFeedback');
const nombreInput = document.getElementById('nombre');
const emailInput = document.getElementById('email');
const mensajeInput = document.getElementById('mensaje');
const toggle = document.getElementById('menuToggle');
const nav = document.getElementById('navLinks');

const DEFAULT_CONTACT_ENDPOINT = 'https://xylvokwwiiirjlcjrafb.functions.supabase.co/contact-form';
const endpoint = form?.dataset.contactEndpoint?.trim() || DEFAULT_CONTACT_ENDPOINT;
const turnstileSiteKey = form?.dataset.turnstileSiteKey?.trim() || '';

let widgetId = null;

if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
}

window.addEventListener('load', () => {
    inicializarTurnstile();
});

form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nombre = nombreInput.value.trim();
    const email = emailInput.value.trim();
    const mensaje = mensajeInput.value.trim();

    if (!nombre || nombre.length < 2 || nombre.length > 100) {
        showFeedback('El nombre debe tener entre 2 y 100 caracteres.', 'error');
        return;
    }

    if (!email || !validarEmail(email)) {
        showFeedback('Introduce un email valido.', 'error');
        return;
    }

    if (!mensaje || mensaje.length < 10 || mensaje.length > 2000) {
        showFeedback('El mensaje debe tener entre 10 y 2000 caracteres.', 'error');
        return;
    }

    if (!endpoint) {
        showFeedback('Configura el endpoint seguro del formulario antes de enviar mensajes.', 'error');
        return;
    }

    if (!widgetId || !window.turnstile) {
        showFeedback('Configura Turnstile antes de usar el formulario de contacto.', 'error');
        return;
    }

    const turnstileToken = window.turnstile.getResponse(widgetId);
    if (!turnstileToken) {
        showFeedback('Completa la verificacion anti-spam antes de enviar el formulario.', 'error');
        return;
    }

    setLoading(true);
    hideFeedback();

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nombre,
                email,
                mensaje,
                turnstileToken,
            }),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'No se pudo enviar el mensaje.');
        }

        showFeedback('Mensaje enviado correctamente. Gracias por contactar con SistemaBase.', 'success');
        form.reset();
        if (window.turnstile && widgetId !== null) {
            window.turnstile.reset(widgetId);
        }
    } catch (error) {
        console.error('Error enviando contacto:', error);
        showFeedback(error.message || 'No se pudo enviar el mensaje.', 'error');
    } finally {
        setLoading(false);
    }
});

function inicializarTurnstile() {
    if (!form) return;

    if (!turnstileSiteKey) {
        btn.disabled = true;
        showFeedback('Configura una clave publica de Turnstile en el formulario para activar el contacto.', 'error');
        return;
    }

    if (!window.turnstile) {
        btn.disabled = true;
        showFeedback('No se ha podido cargar Turnstile. Recarga la pagina e intentalo de nuevo.', 'error');
        return;
    }

    widgetId = window.turnstile.render('#turnstile-widget', {
        sitekey: turnstileSiteKey,
        theme: 'light',
    });

    btn.disabled = false;
    hideFeedback();
}

function setLoading(isLoading) {
    if (!btn) return;

    btn.disabled = isLoading;

    const btnText = btn.querySelector('.btn-text');
    const btnIcon = btn.querySelector('.btn-icon');

    if (isLoading) {
        if (btnText) btnText.textContent = 'Enviando...';
        if (btnIcon) btnIcon.innerHTML = '<div class="btn-spinner"></div>';
        return;
    }

    if (btnText) btnText.textContent = 'Enviar mensaje';
    if (btnIcon) {
        btnIcon.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>`;
    }
}

function showFeedback(message, type) {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `form-feedback ${type} show`;
}

function hideFeedback() {
    if (!feedback) return;
    feedback.className = 'form-feedback';
    feedback.textContent = '';
}

function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
