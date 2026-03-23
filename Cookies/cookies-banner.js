// =============================================
// COOKIES-BANNER.JS — SistemaBase
// Gestiona el banner de consentimiento de cookies.
// Guarda la decisión en localStorage para no
// volver a mostrar el banner si ya se aceptó/rechazó.
// =============================================

(function () {
    const COOKIE_KEY = 'sistemabase_cookie_consent';
    const COOKIE_VERSION = '1'; // incrementar si cambia la política

    function getConsentido() {
        try {
            const stored = localStorage.getItem(COOKIE_KEY);
            if (!stored) return null;
            const parsed = JSON.parse(stored);
            // Si la versión cambió, pedir consentimiento de nuevo
            if (parsed.version !== COOKIE_VERSION) return null;
            return parsed.decision; // 'accepted' | 'rejected'
        } catch {
            return null;
        }
    }

    function setConsentido(decision) {
        try {
            localStorage.setItem(COOKIE_KEY, JSON.stringify({
                decision,
                version: COOKIE_VERSION,
                fecha: new Date().toISOString()
            }));
        } catch { /* localStorage no disponible */ }
    }

    function ocultarBanner(banner) {
        banner.classList.remove('visible');
        // Eliminar del DOM tras la animación
        banner.addEventListener('transitionend', () => {
            banner.remove();
        }, { once: true });
    }

    function iniciarBanner() {
        // No mostrar si ya se dio respuesta
        if (getConsentido() !== null) return;

        const banner = document.getElementById('cookie-banner');
        if (!banner) return;

        // Mostrar con pequeño retardo para que la animación sea visible
        requestAnimationFrame(() => {
            setTimeout(() => banner.classList.add('visible'), 80);
        });

        const btnAceptar = document.getElementById('btn-cookie-accept');
        const btnRechazar = document.getElementById('btn-cookie-reject');

        if (btnAceptar) {
            btnAceptar.addEventListener('click', () => {
                setConsentido('accepted');
                ocultarBanner(banner);
                // Aquí podrías activar scripts de análisis, AdSense, etc.
                // window.loadAnalytics?.();
            });
        }

        if (btnRechazar) {
            btnRechazar.addEventListener('click', () => {
                setConsentido('rejected');
                ocultarBanner(banner);
            });
        }
    }

    // Esperar al DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarBanner);
    } else {
        iniciarBanner();
    }
})();
