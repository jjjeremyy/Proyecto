// ============================================================
//  CONFIGURACIÓN EMAILJS
//  1. Crea una cuenta en https://www.emailjs.com (gratis)
//  2. Crea un "Email Service" (Gmail, Outlook, etc.)
//  3. Crea un "Email Template" con las variables:
//       {{nombre}}, {{email}}, {{mensaje}}
//  4. Sustituye las 3 constantes de abajo con tus datos reales
// ============================================================

const EMAILJS_PUBLIC_KEY  = "TU_PUBLIC_KEY";    // Account > API Keys
const EMAILJS_SERVICE_ID  = "TU_SERVICE_ID";    // Email Services > Service ID
const EMAILJS_TEMPLATE_ID = "TU_TEMPLATE_ID";   // Email Templates > Template ID

// ============================================================

(function () {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
})();

const form       = document.getElementById("contactForm");
const submitBtn  = document.getElementById("submitBtn");
const feedback   = document.getElementById("formFeedback");

form.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Validación básica
    const nombre  = document.getElementById("nombre").value.trim();
    const email   = document.getElementById("email").value.trim();
    const mensaje = document.getElementById("mensaje").value.trim();

    if (!nombre || !email || !mensaje) {
        showFeedback("Por favor, rellena todos los campos.", "error");
        return;
    }

    // Estado de carga
    setLoading(true);
    hideFeedback();

    const templateParams = { nombre, email, mensaje };

    try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        showFeedback("✓ Mensaje enviado. ¡Nos pondremos en contacto pronto!", "success");
        form.reset();
    } catch (error) {
        console.error("EmailJS error:", error);
        showFeedback("Error al enviar. Inténtalo de nuevo o escríbenos directamente.", "error");
    } finally {
        setLoading(false);
    }
});

// ── Helpers ──────────────────────────────────────────────────

function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    const btnText = submitBtn.querySelector(".btn-text");
    const btnIcon = submitBtn.querySelector(".btn-icon");

    if (isLoading) {
        btnText.textContent = "Enviando…";
        btnIcon.innerHTML = '<div class="btn-spinner"></div>';
    } else {
        btnText.textContent = "Enviar mensaje";
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
    feedback.className = "form-feedback";
    feedback.textContent = "";
}


const toggle = document.getElementById('menuToggle');
const nav = document.getElementById('navLinks');

toggle.addEventListener('click', () => nav.classList.toggle('open'));
