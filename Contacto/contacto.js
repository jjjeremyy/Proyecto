const btn = document.getElementById('button');
const form = document.getElementById('form');
const feedback = document.getElementById('formFeedback');
const nombreInput = document.getElementById('nombre');
const emailInput = document.getElementById('email');
const mensajeInput = document.getElementById('mensaje');
const nameInput = document.getElementById('name');
const timeInput = document.getElementById('time');

if (typeof emailjs === 'undefined') {
    console.error('EmailJS no se ha cargado correctamente.');
} else {
    emailjs.init('FtSzjNKM-LbfXmh6K');
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
            showFeedback(err?.text || JSON.stringify(err), 'error');
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

const toggle = document.getElementById('menuToggle');
const nav = document.getElementById('navLinks');

toggle.addEventListener('click', () => nav.classList.toggle('open'));
