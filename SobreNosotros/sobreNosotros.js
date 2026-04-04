// ── FADE-IN ON SCROLL ──
// Sin condición de carrera: los elementos comienzan ocultos via CSS,
// el observer los muestra al entrar en viewport.
// threshold:0 garantiza que dispara en cuanto 1px es visible.

document.addEventListener('DOMContentLoaded', function () {
    var elements = document.querySelectorAll('.fade-in');

    if (!('IntersectionObserver' in window)) {
        // Fallback para navegadores sin soporte
        elements.forEach(function(el) { el.classList.add('visible'); });
        return;
    }

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0, rootMargin: '0px 0px -20px 0px' });

    elements.forEach(function(el) { observer.observe(el); });
});