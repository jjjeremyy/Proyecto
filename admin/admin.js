// Ejemplo rápido de protección en admin.js
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
    window.location.href = '../index.html'; // Patada hacia afuera si no eres tú
}

