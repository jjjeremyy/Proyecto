// =============================================
// LOGIN.JS — SistemaBase
// Gestiona el inicio de sesión con Supabase Auth
// FIX: Lógica de redirección corregida
// =============================================
import { supabase } from '../Supabase/supabase.js';

// --------------------------------------------------
// 0. SI YA HAY SESIÓN ACTIVA, IR DIRECTO AL ADMIN
//    FIX: la condición estaba INVERTIDA en la versión anterior
// --------------------------------------------------
try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        // Ya está logado → ir al panel de administración
        window.location.href = '../admin/admin.html';
    }
    // Si no hay sesión, se queda en el login (comportamiento correcto)
} catch (e) {
    console.error('Error verificando sesión:', e);
    // En caso de error al verificar, se queda en el login
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
        'Invalid login credentials':  'Email o contraseña incorrectos.',
        'Email not confirmed':         'Confirma tu email antes de entrar.',
        'Too many requests':           'Demasiados intentos. Espera unos minutos.',
        'User not found':              'No existe ningún usuario con ese email.',
        'Invalid email':               'El formato del email no es válido.',
    };
    for (const [clave, traduccion] of Object.entries(errores)) {
        if (mensajeIngles.includes(clave)) return traduccion;
    }
    return 'Error al iniciar sesión. Inténtalo de nuevo.';
}

// login.js — añadir protección contra fuerza bruta

const BRUTE_FORCE_KEY = 'sb_login_attempts';
const MAX_INTENTOS_LOGIN = 5;
const BLOQUEO_MS = 15 * 60 * 1000; // 15 minutos

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
    
    // Verificar si está bloqueado
    if (Date.now() < estado.bloqueadoHasta) {
        const minutos = Math.ceil((estado.bloqueadoHasta - Date.now()) / 60000);
        mostrarError(`Demasiados intentos fallidos. Espera ${minutos} minutos.`);
        btnLogin.disabled = true;
        return;
    }

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        mostrarError('Por favor rellena el email y la contraseña.');
        return;
    }

    // Validar formato email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        mostrarError('El formato del email no es válido.');
        return;
    }

    setBtnCargando(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        setBtnCargando(false);
        
        // Incrementar contador de intentos fallidos
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

    // Login correcto — resetear contador
    guardarEstadoLogin({ intentos: 0, bloqueadoHasta: 0 });
    window.location.replace('../admin/admin.html');
}