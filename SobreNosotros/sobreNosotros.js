// ── FADE-IN ON SCROLL ──
// Añadimos .js-ready al body SOLO después de registrar el observer,
// así el CSS nunca oculta contenido si JS falla o tarda.
document.body.classList.add('js-ready');

const elements = document.querySelectorAll('.fade-in');

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

elements.forEach(el => observer.observe(el));

// Fallback: si algún elemento no se ha activado tras 1s, lo mostramos igualmente
setTimeout(() => {
    elements.forEach(el => el.classList.add('visible'));
}, 1000);