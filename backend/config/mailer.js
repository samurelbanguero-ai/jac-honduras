// config/mailer.js - Envío de notificaciones por correo cuando se publica una noticia.
// No configurado por defecto: si faltan las variables SMTP_* en .env, simplemente
// no se envían correos (se loguea un aviso) sin romper la publicación de noticias.
const nodemailer = require('nodemailer');
const pool = require('./db');

let transporter = null;

function obtenerTransporter() {
    if (transporter) return transporter;

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return transporter;
}

// Envía un correo a todos los afiliados con correo registrado avisando de una
// noticia nueva. No lanza errores hacia arriba: un fallo de correo nunca debe
// impedir que la noticia quede publicada.
async function notificarNuevaNoticia(noticia) {
    const t = obtenerTransporter();
    if (!t) {
        console.warn('⚠️  SMTP no configurado (backend/.env) — no se enviaron notificaciones por correo.');
        return { enviado: false, motivo: 'smtp_no_configurado' };
    }

    try {
        const result = await pool.query(
            `SELECT correo FROM afiliados WHERE correo IS NOT NULL AND correo <> ''`
        );
        const correos = result.rows.map(r => r.correo);

        if (correos.length === 0) {
            return { enviado: false, motivo: 'sin_destinatarios' };
        }

        const url = encodeURI(`${(process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '')}/`);

        await t.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: process.env.SMTP_USER, // remitente en "Para", destinatarios reales en BCC
            bcc: correos,
            subject: `JAC Honduras, Cauca — ${String(noticia.titulo).replace(/[\r\n]+/g, ' ')}`,
            text: `${noticia.titulo}\n\n${noticia.contenido}\n\nVer más: ${url}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width:560px; margin:0 auto;">
                    <h2 style="color:#0D5C35;">${escaparHtml(noticia.titulo)}</h2>
                    <p style="color:#1F2937; white-space:pre-line;">${escaparHtml(noticia.contenido)}</p>
                    <p><a href="${url}" style="color:#0D5C35;">Ver todas las noticias en JAC Honduras, Cauca</a></p>
                    <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;">
                    <p style="color:#6B7280; font-size:0.8rem;">Junta de Acción Comunal de Honduras, Cauca</p>
                </div>
            `,
        });

        return { enviado: true, destinatarios: correos.length };
    } catch (err) {
        console.error('Error al enviar notificaciones por correo:', err.message);
        return { enviado: false, motivo: 'error_envio' };
    }
}

function escaparHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Correo con el enlace para crear una contraseña nueva.
// Sin SMTP configurado: en desarrollo se muestra el enlace en la consola para
// poder probar; en producción solo se registra un aviso (el enlace nunca se imprime).
async function enviarCorreoRecuperacion({ correo, nombre, enlace, minutos }) {
    const t = obtenerTransporter();
    if (!t) {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`\n[DESARROLLO] Enlace de recuperación para ${correo}:\n${enlace}\n`);
        } else {
            console.warn('⚠️  SMTP no configurado: no se pudo enviar el correo de recuperación de contraseña.');
        }
        return false;
    }
    try {
        await t.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: correo,
            subject: 'JAC Honduras, Cauca — Crea una contraseña nueva',
            text: `Hola ${nombre}:\n\nRecibimos una solicitud para cambiar la contraseña de tu cuenta en la Junta de Acción Comunal de Honduras.\n\nAbre este enlace para crear una nueva (vence en ${minutos} minutos y sirve una sola vez):\n${enlace}\n\nSi no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width:560px; margin:0 auto; color:#16241c;">
                    <h2 style="color:#0a4325; margin-bottom:8px;">Crea una contraseña nueva</h2>
                    <p>Hola ${escaparHtml(nombre)}:</p>
                    <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta en la Junta de Acción Comunal de Honduras.</p>
                    <p style="margin:24px 0;"><a href="${escaparHtml(enlace)}" style="background:#0a4325; color:#ffffff; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:bold;">Crear contraseña nueva</a></p>
                    <p style="color:#4a5a50; font-size:0.9rem;">El enlace vence en ${minutos} minutos y sirve una sola vez. Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.</p>
                    <hr style="border:none; border-top:1px solid #dde3dd; margin:24px 0;">
                    <p style="color:#78867d; font-size:0.8rem;">Junta de Acción Comunal de Honduras, Cauca</p>
                </div>`,
        });
        return true;
    } catch (err) {
        console.error('Error al enviar el correo de recuperación:', err.message);
        return false;
    }
}

// ── Solicitudes de afiliación ──────────────────────────────
const sitio = () => (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

function plantilla(titulo, parrafos, boton) {
    const cuerpo = parrafos.map(p => `<p style="margin:0 0 12px;">${p}</p>`).join('');
    const enlace = boton
        ? `<p style="margin:24px 0;"><a href="${escaparHtml(boton.url)}" style="background:#0a4325; color:#ffffff; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:bold;">${escaparHtml(boton.texto)}</a></p>`
        : '';
    return `
        <div style="font-family: Arial, sans-serif; max-width:560px; margin:0 auto; color:#16241c;">
            <h2 style="color:#0a4325; margin-bottom:12px;">${escaparHtml(titulo)}</h2>
            ${cuerpo}${enlace}
            <hr style="border:none; border-top:1px solid #dde3dd; margin:24px 0;">
            <p style="color:#78867d; font-size:0.8rem;">Junta de Acción Comunal de Honduras, Cauca</p>
        </div>`;
}

async function enviarCorreo({ para, asunto, texto, html }) {
    const t = obtenerTransporter();
    if (!t || !para) {
        if (!t) console.warn(`⚠️  SMTP no configurado: no se envió el correo "${asunto}".`);
        return false;
    }
    try {
        await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: para, subject: asunto, text: texto, html });
        return true;
    } catch (err) {
        console.error(`Error al enviar el correo "${asunto}":`, err.message);
        return false;
    }
}

// Aviso a la Junta: llegó una solicitud nueva.
function avisarNuevaSolicitud(afiliado) {
    const para = process.env.JUNTA_EMAIL || process.env.SMTP_USER;
    const nombre = `${afiliado.nombres} ${afiliado.apellidos}`;
    const panel = `${sitio()}/panel-jac-2024`;
    return enviarCorreo({
        para,
        asunto: `Nueva solicitud de afiliación: ${nombre}`.replace(/[\r\n]+/g, ' '),
        texto: `${nombre} (C.C. ${afiliado.cedula}) solicitó afiliarse a la Junta.\n\nRevisa y aprueba o rechaza la solicitud en el panel: ${panel}`,
        html: plantilla('Nueva solicitud de afiliación', [
            `<strong>${escaparHtml(nombre)}</strong> (C.C. ${escaparHtml(afiliado.cedula)}) solicitó afiliarse a la Junta.`,
            `Teléfono: ${escaparHtml(afiliado.telefono || 'no registrado')}<br>Correo: ${escaparHtml(afiliado.correo || 'no registrado')}`,
            'Revisa los datos en el panel y aprueba o rechaza la solicitud.',
        ], { texto: 'Revisar solicitud', url: panel }),
    });
}

// Aviso al solicitante: su afiliación fue aprobada.
function avisarSolicitudAprobada(afiliado) {
    const ingreso = `${sitio()}/login`;
    return enviarCorreo({
        para: afiliado.correo,
        asunto: 'Tu afiliación a la JAC Honduras fue aprobada',
        texto: `Hola ${afiliado.nombres}:\n\nLa Junta de Acción Comunal de Honduras aprobó tu solicitud de afiliación. Ya puedes ingresar y ver tu carnet digital: ${ingreso}`,
        html: plantilla('Tu afiliación fue aprobada', [
            `Hola ${escaparHtml(afiliado.nombres)}:`,
            'La Junta de Acción Comunal de Honduras aprobó tu solicitud de afiliación. Ya haces parte de la Junta.',
            'Ingresa con tu cédula para ver tu carnet digital, votar en las consultas y participar en los convites.',
        ], { texto: 'Ver mi carnet', url: ingreso }),
    });
}

// Aviso al solicitante: su afiliación no fue aprobada.
function avisarSolicitudRechazada(afiliado, motivo) {
    return enviarCorreo({
        para: afiliado.correo,
        asunto: 'Sobre tu solicitud de afiliación a la JAC Honduras',
        texto: `Hola ${afiliado.nombres}:\n\nLa Junta revisó tu solicitud de afiliación y por ahora no fue aprobada.${motivo ? `\n\nMotivo: ${motivo}` : ''}\n\nSi tienes dudas, acércate a la Junta.`,
        html: plantilla('Sobre tu solicitud de afiliación', [
            `Hola ${escaparHtml(afiliado.nombres)}:`,
            'La Junta revisó tu solicitud de afiliación y por ahora no fue aprobada.',
            ...(motivo ? [`<strong>Motivo:</strong> ${escaparHtml(motivo)}`] : []),
            'Si tienes dudas o quieres corregir algún dato, acércate a la Junta.',
        ]),
    });
}

module.exports = {
    notificarNuevaNoticia,
    enviarCorreoRecuperacion,
    avisarNuevaSolicitud,
    avisarSolicitudAprobada,
    avisarSolicitudRechazada,
};
