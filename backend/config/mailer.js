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

        const url = `${process.env.SITE_URL || 'http://localhost:3000'}/`;

        await t.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: process.env.SMTP_USER, // remitente en "Para", destinatarios reales en BCC
            bcc: correos,
            subject: `📢 JAC Honduras, Cauca — ${noticia.titulo}`,
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
        .replace(/>/g, '&gt;');
}

module.exports = { notificarNuevaNoticia };
