import { supabase } from '../Supabase/supabase.js';

const BRUTE_FORCE_KEY = 'sb_login_attempts';
const MAX_INTENTOS_LOGIN = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('toggle-password');
const form = document.getElementById('login-form');
const btnLogin = document.getElementById('btn-login');
const btnText = document.getElementById('btn-text');
const btnLoader = document.getElementById('btn-loader');
const errorBox = document.getElementById('login-error');
const errorMsg = document.getElementById('login-error-msg');

try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.replace('../admin/admin.html');
    }
} catch (error) {
    console.error('Error verificando sesion:', error);
}

togglePassword?.addEventListener('click', () => {
    const esPassword = passwordInput.type === 'password';
    passwordInput.type = esPassword ? 'text' : 'password';
    togglePassword.textContent = esPassword ? 'Ocultar' : 'Mostrar';
});

form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await iniciarSesion();
});

function obtenerEstadoLogin() {
    try {
        const raw = localStorage.getItem(BRUTE_FORCE_KEY);
        return raw ? JSON.parse(raw) : { intentos: 0, bloqueadoHasta: 0 };
    } catch {
        return { intentos: 0, bloqueadoHasta: 0 };
    }
}

function guardarEstadoLogin(estado) {
    localStorage.setItem(BRUTE_FORCE_KEY, JSON.stringify(estado));
}

async function iniciarSesion() {
    const estado = obtenerEstadoLogin();

    if (Date.now() < estado.bloqueadoHasta) {
        const minutos = Math.ceil((estado.bloqueadoHasta - Date.now()) / 60000);
        mostrarError(`Demasiados intentos fallidos. Espera ${minutos} minutos.`);
        btnLogin.disabled = true;
        return;
    }

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    errorBox.classList.add('hidden');
    btnLogin.disabled = false;

    if (!email || !password) {
        mostrarError('Por favor rellena el email y la contrasena.');
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        mostrarError('El formato del email no es valido.');
        return;
    }

    setBtnCargando(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        setBtnCargando(false);
        estado.intentos++;

        if (estado.intentos >= MAX_INTENTOS_LOGIN) {
            estado.bloqueadoHasta = Date.now() + BLOQUEO_MS;
            estado.intentos = 0;
            guardarEstadoLogin(estado);
            mostrarError('Demasiados intentos fallidos. Cuenta bloqueada 15 minutos.');
            btnLogin.disabled = true;
            return;
        }

        guardarEstadoLogin(estado);
        const restantes = MAX_INTENTOS_LOGIN - estado.intentos;
        mostrarError(`${traducirError(error.message)} (${restantes} intentos restantes)`);
        return;
    }

    guardarEstadoLogin({ intentos: 0, bloqueadoHasta: 0 });
    window.location.replace('../admin/admin.html');
}

function setBtnCargando(cargando) {
    btnLogin.disabled = cargando;
    btnText.classList.toggle('hidden', cargando);
    btnLoader.classList.toggle('hidden', !cargando);
}

function mostrarError(mensaje) {
    errorMsg.textContent = mensaje;
    errorBox.classList.remove('hidden');
}

function traducirError(mensajeIngles) {
    const errores = {
        'Invalid login credentials': 'Email o contrasena incorrectos.',
        'Email not confirmed': 'Confirma tu email antes de entrar.',
        'Too many requests': 'Demasiados intentos. Espera unos minutos.',
        'User not found': 'No existe ningun usuario con ese email.',
        'Invalid email': 'El formato del email no es valido.',
    };

    for (const [clave, traduccion] of Object.entries(errores)) {
        if (mensajeIngles.includes(clave)) return traduccion;
    }

    return 'Error al iniciar sesion. Intentalo de nuevo.';
}
