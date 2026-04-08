const corsHeaders = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://sistemabase.es',
    'Content-Type': 'application/json; charset=utf-8',
};

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Metodo no permitido.' }, 405);
    }

    try {
        const body = await request.json();
        const nombre = String(body?.nombre || '').trim();
        const email = String(body?.email || '').trim();
        const mensaje = String(body?.mensaje || '').trim();
        const turnstileToken = String(body?.turnstileToken || '').trim();

        if (nombre.length < 2 || nombre.length > 100) {
            return jsonResponse({ error: 'El nombre no es valido.' }, 400);
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
            return jsonResponse({ error: 'El email no es valido.' }, 400);
        }

        if (mensaje.length < 10 || mensaje.length > 2000) {
            return jsonResponse({ error: 'El mensaje no es valido.' }, 400);
        }

        if (!turnstileToken) {
            return jsonResponse({ error: 'Falta la verificacion anti-spam.' }, 400);
        }

        await verificarTurnstile(turnstileToken, request);
        await enviarCorreo(nombre, email, mensaje);

        return jsonResponse({ ok: true }, 200);
    } catch (error) {
        console.error('contact-form error:', error);
        return jsonResponse({ error: error instanceof Error ? error.message : 'No se pudo procesar el mensaje.' }, 500);
    }
});

async function verificarTurnstile(token: string, request: Request) {
    const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!secret) {
        throw new Error('TURNSTILE_SECRET_KEY no esta configurada en la Edge Function.');
    }

    const formData = new FormData();
    formData.set('secret', secret);
    formData.set('response', token);

    const clientIp = request.headers.get('x-forwarded-for');
    if (clientIp) {
        formData.set('remoteip', clientIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
    });

    const result = await response.json();
    if (!response.ok || !result?.success) {
        throw new Error('La verificacion anti-spam ha fallado.');
    }
}

async function enviarCorreo(nombre: string, email: string, mensaje: string) {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const toEmail = Deno.env.get('CONTACT_TO_EMAIL');
    const fromEmail = Deno.env.get('CONTACT_FROM_EMAIL') || 'SistemaBase <onboarding@resend.dev>';

    if (!resendApiKey || !toEmail) {
        throw new Error('RESEND_API_KEY o CONTACT_TO_EMAIL no estan configuradas en la Edge Function.');
    }

    const payload = {
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject: `Nuevo mensaje de contacto: ${nombre}`,
        text: [
            `Nombre: ${nombre}`,
            `Email: ${email}`,
            '',
            'Mensaje:',
            mensaje,
        ].join('\n'),
    };

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend devolvio un error: ${errorText}`);
    }
}

function jsonResponse(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: corsHeaders,
    });
}
