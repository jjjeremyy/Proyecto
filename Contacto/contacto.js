// ============================================================
//  CONFIGURACION EMAILJS
//  1. Crea una cuenta en https://www.emailjs.com
//  2. Crea un Email Service
//  3. Crea un Email Template con:
//     {{nombre}}, {{email}}, {{mensaje}}
// ============================================================

const EMAILJS_PUBLIC_KEY = 'FtSzjNKM-LbfXmh6K';
const EMAILJS_SERVICE_ID = 'default_service';
const EMAILJS_TEMPLATE_ID = 'template_pb880xb';

if (typeof emailjs === 'undefined') {
    console.error('EmailJS no se ha cargado correctamente.');
}

if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

const form = document.getElementById('contactForm');
const submitBtn = document.getElementById('submitBtn');
const feedback = document.getElementById('formFeedback');

form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const mensaje = document.getElementById('mensaje').value.trim();

    if (!nombre || !email || !mensaje) {
        showFeedback('Por favor, rellena todos los campos.', 'error');
        return;
    }

    if (typeof emailjs === 'undefined') {
        showFeedback('Error de carga de EmailJS. Recarga la pagina e intentalo de nuevo.', 'error');
        return;
    }

    setLoading(true);
    hideFeedback();

    try {
        await emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, form);
        showFeedback('Mensaje enviado. Nos pondremos en contacto pronto.', 'success');
        form.reset();
    } catch (err) {
        console.error('EmailJS error:', err);

        const errorMessage =
            err?.text ||
            err?.message ||
            'Error al enviar. Revisa el Service ID de EmailJS y que el servicio este configurado como predeterminado.';

        showFeedback(errorMessage, 'error');
    } finally {
        setLoading(false);
    }
});

function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    const btnText = submitBtn.querySelector('.btn-text');
    const btnIcon = submitBtn.querySelector('.btn-icon');

    if (isLoading) {
        btnText.textContent = 'Enviando...';
        btnIcon.innerHTML = '<div class="btn-spinner"></div>';
        return;
    }

    btnText.textContent = 'Enviar mensaje';
    btnIcon.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>`;
}

function showFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = `form-feedback ${type} show`;
}

function hideFeedback() {
    feedback.className = 'form-feedback';
    feedback.textContent = '';
}

const toggle = document.getElementById('menuToggle');
const nav = document.getElementById('navLinks');

toggle.addEventListener('click', () => nav.classList.toggle('open'));
