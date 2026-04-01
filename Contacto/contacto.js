// ============================================================
//  CONFIGURACIÓN EMAILJS
//  1. Crea una cuenta en https://www.emailjs.com (gratis)
//  2. Crea un "Email Service" (Gmail, Outlook, etc.)
//  3. Crea un "Email Template" con las variables:
//       {{nombre}}, {{email}}, {{mensaje}}
//  4. Sustituye las 3 constantes de abajo con tus datos reales
//// ============================================================
//  EMAILJS — Configuración
//  Tus credenciales reales ya están aplicadas abajo
// ============================================================

const EMAILJS_PUBLIC_KEY  = 'FtSzjNKM-LbfXmh6K';   // ✅ tu clave real
const EMAILJS_SERVICE_ID  = 'default_service';        // ✅ tu service ID
const EMAILJS_TEMPLATE_ID = 'template_pb880xb';       // ✅ tu template ID

emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

// ── Elementos del formulario ──────────────────────────────────
const form      = document.getElementById('contactForm');
const submitBtn = document.getElementById('submitBtn');
const feedback  = document.getElementById('formFeedback');

form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const nombre  = document.getElementById('nombre').value.trim();
    const email   = document.getElementById('email').value.trim();
    const mensaje = document.getElementById('mensaje').value.trim();

    if (!nombre || !email || !mensaje) {
        showFeedback('Por favor, rellena todos los campos.', 'error');
        return;
    }

    setLoading(true);
    hideFeedback();

    try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { nombre, email, mensaje });
        showFeedback('✓ Mensaje enviado. ¡Nos pondremos en contacto pronto!', 'success');
        form.reset();
    } catch (err) {
        console.error('EmailJS error:', err);
        showFeedback('Error al enviar. Inténtalo de nuevo o escríbenos directamente.', 'error');
    } finally {
        setLoading(false);
    }
});

// ── Helpers formulario ────────────────────────────────────────
function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    const btnText = submitBtn.querySelector('.btn-text');
    const btnIcon = submitBtn.querySelector('.btn-icon');

    if (isLoading) {
        btnText.textContent = 'Enviando…';
        btnIcon.innerHTML = '<div class="btn-spinner"></div>';
    } else {
        btnText.textContent = 'Enviar mensaje';
        btnIcon.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>`;
    }
}

function showFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = `form-feedback ${type} show`;
}

function hideFeedback() {
    feedback.className = 'form-feedback';
    feedback.textContent = '';
}

// ── Menú hamburguesa ──────────────────────────────────────────
const toggle = document.getElementById('menuToggle');
const nav    = document.getElementById('navLinks');

toggle.addEventListener('click', () => nav.classList.toggle('open'));