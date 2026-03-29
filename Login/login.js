// =============================================
// LOGIN.JS — SistemaBase
// Gestiona el inicio de sesión con Supabase Auth
// =============================================
import { supabase } from '../Supabase/supabase.js';

// --------------------------------------------------
// 0. SI YA HAY SESIÓN ACTIVA, IR DIRECTO AL ADMIN
//    (evita mostrar el login a quien ya está logado)
// --------------------------------------------------
try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '../Login/login.html';
    }
} catch (e) {
    console.error('Error verificando sesión:', e);
    window.location.href = '../Login/login.html';
}

// --------------------------------------------------
// 1. MOSTRAR / OCULTAR CONTRASEÑA
// --------------------------------------------------
const passwordInput  = document.getElementById('password');
const togglePassword = document.getElementById('toggle-password');

togglePassword.addEventListener('click', () => {
    const esPassword = passwordInput.type === 'password';
    passwordInput.type   = esPassword ? 'text' : 'password';
    togglePassword.textContent = esPassword ? '🙈' : '👁';
});

// --------------------------------------------------
// 2. SUBMIT DEL FORMULARIO
// --------------------------------------------------
const form      = document.getElementById('login-form');
const btnLogin  = document.getElementById('btn-login');
const btnText   = document.getElementById('btn-text');
const btnLoader = document.getElementById('btn-loader');
const errorBox  = document.getElementById('login-error');
const errorMsg  = document.getElementById('login-error-msg');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await iniciarSesion();
});

async function iniciarSesion() {
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Ocultar error previo
    errorBox.classList.add('hidden');

    // Validación básica en cliente
    if (!email || !password) {
        mostrarError('Por favor rellena el email y la contraseña.');
        return;
    }

    // Estado de carga
    setBtnCargando(true);

    // Llamada a Supabase Auth
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        setBtnCargando(false);
        // Supabase devuelve mensajes en inglés, los traducimos
        mostrarError(traducirError(error.message));
        return;
    }

    // Login correcto → redirigir al admin
    window.location.href = '../admin/admin.html';
}

// --------------------------------------------------
// UTILIDADES
// --------------------------------------------------
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
        'Invalid login credentials':       'Email o contraseña incorrectos.',
        'Email not confirmed':             'Confirma tu email antes de entrar.',
        'Too many requests':               'Demasiados intentos. Espera unos minutos.',
        'User not found':                  'No existe ningún usuario con ese email.',
        'Invalid email':                   'El formato del email no es válido.',
    };
    // Buscar coincidencia parcial
    for (const [clave, traduccion] of Object.entries(errores)) {
        if (mensajeIngles.includes(clave)) return traduccion;
    }
    return 'Error al iniciar sesión. Inténtalo de nuevo.';
}
