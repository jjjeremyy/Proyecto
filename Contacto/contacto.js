const btn = document.getElementById('button');
const form = document.getElementById('form');
const feedback = document.getElementById('formFeedback');
const nombreInput = document.getElementById('nombre');
const emailInput = document.getElementById('email');
const mensajeInput = document.getElementById('mensaje');
const nameInput = document.getElementById('name');
const timeInput = document.getElementById('time');
const titleInput = document.getElementById('title');
const messageInput = document.getElementById('message');
const fromNameInput = document.getElementById('from_name');
const replyToInput = document.getElementById('reply_to');
const toEmailInput = document.getElementById('to_email');

if (typeof emailjs === 'undefined') {
    console.error('EmailJS no se ha cargado correctamente.');
} else {
    emailjs.init('uXTjo90Pwv0fueks5');
}

form.addEventListener('submit', function (event) {
    event.preventDefault();

    const nombre = nombreInput.value.trim();
    const email = emailInput.value.trim();
    const mensaje = mensajeInput.value.trim();

    if (!nombre || !email || !mensaje) {
        showFeedback('Por favor, rellena todos los campos.', 'error');
        return;
    }

    if (typeof emailjs === 'undefined') {
        showFeedback('Error de carga de EmailJS. Recarga la pagina e intentalo de nuevo.', 'error');
        return;
    }

    nameInput.value = nombre;
    timeInput.value = new Date().toLocaleString('es-ES');
    titleInput.value = 'Nuevo mensaje desde el formulario de contacto';
    messageInput.value = mensaje;
    fromNameInput.value = nombre;
    replyToInput.value = email;
    toEmailInput.value = 'sistemabase00@gmail.com';

    setLoading(true);
    hideFeedback();

    const serviceID = 'default_service';
    const templateID = 'template_pb880xb';

    emailjs.sendForm(serviceID, templateID, this).then(
        () => {
            setLoading(false);
            showFeedback('Mensaje enviado correctamente.', 'success');
            form.reset();
        },
        (err) => {
            console.error('EmailJS error:', err);
            setLoading(false);
            showFeedback(formatEmailJSError(err), 'error');
        }
    );
});

function setLoading(isLoading) {
    btn.disabled = isLoading;

    const btnText = btn.querySelector('.btn-text');
    const btnIcon = btn.querySelector('.btn-icon');

    if (isLoading) {
        if (btnText) {
            btnText.textContent = 'Sending...';
        }

        if (btnIcon) {
            btnIcon.innerHTML = '<div class="btn-spinner"></div>';
        }

        return;
    }

    if (btnText) {
        btnText.textContent = 'Enviar mensaje';
    }

    if (btnIcon) {
        btnIcon.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
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

function formatEmailJSError(err) {
    const status = err?.status ? ` (${err.status})` : '';
    const text = err?.text || err?.message || '';

    if (text) {
        return `Error de EmailJS${status}: ${text}`;
    }

    return `Error de EmailJS${status}. Revisa el Service ID, la plantilla y el correo de destino en tu panel.`;
}

const toggle = document.getElementById('menuToggle');
const nav = document.getElementById('navLinks');

toggle.addEventListener('click', () => nav.classList.toggle('open'));

// contacto.js — añadir rate limiting en cliente

const RATE_LIMIT_KEY = 'sb_contact_last_submit';
const RATE_LIMIT_MS  = 60 * 1000; // 1 minuto entre envíos

form.addEventListener('submit', function (event) {
    event.preventDefault();

    // Rate limiting en cliente
    const lastSubmit = parseInt(localStorage.getItem(RATE_LIMIT_KEY) || '0', 10);
    const ahora = Date.now();
    
    if (ahora - lastSubmit < RATE_LIMIT_MS) {
        const segundos = Math.ceil((RATE_LIMIT_MS - (ahora - lastSubmit)) / 1000);
        showFeedback(`Por favor espera ${segundos} segundos antes de enviar otro mensaje.`, 'error');
        return;
    }

    const nombre  = nombreInput.value.trim();
    const email   = emailInput.value.trim();
    const mensaje = mensajeInput.value.trim();

    // Validación más robusta
    if (!nombre || nombre.length < 2 || nombre.length > 100) {
        showFeedback('El nombre debe tener entre 2 y 100 caracteres.', 'error');
        return;
    }

    if (!email || !validarEmail(email)) {
        showFeedback('Introduce un email válido.', 'error');
        return;
    }

    if (!mensaje || mensaje.length < 10 || mensaje.length > 2000) {
        showFeedback('El mensaje debe tener entre 10 y 2000 caracteres.', 'error');
        return;
    }

    // Guardar timestamp ANTES del envío (para evitar doble clic)
    localStorage.setItem(RATE_LIMIT_KEY, ahora.toString());

    // ... resto del código de envío
});

function validarEmail(email) {
    // RFC 5322 simplificado
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// Contador de intentos fallidos
let intentosFallidos = 0;
const MAX_INTENTOS = 5;

// En el callback de error de EmailJS:
function manejarErrorEnvio(err) {
    intentosFallidos++;
    
    if (intentosFallidos >= MAX_INTENTOS) {
        // Bloquear durante 10 minutos
        localStorage.setItem(RATE_LIMIT_KEY, (Date.now() + 9 * 60 * 1000).toString());
        setLoading(false);
        showFeedback('Demasiados intentos fallidos. Espera 10 minutos.', 'error');
        btn.disabled = true;
        return;
    }
    
    setLoading(false);
    showFeedback(formatEmailJSError(err), 'error');
}