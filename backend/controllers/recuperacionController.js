// controllers/recuperacionController.js — "¿Olvidaste tu contraseña?" para afiliados.
//
// Flujo:
//  1. POST /api/recuperar { cedula }: si el afiliado tiene correo, se le envía un
//     enlace de un solo uso que vence en 30 minutos. La respuesta es SIEMPRE la
//     misma, exista o no la cédula, para no revelar quién está afiliado.
//  2. POST /api/restablecer/validar { token }: la página comprueba si el enlace sirve.
//  3. POST /api/restablecer { token, contrasena }: guarda la contraseña nueva.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { enviarCorreoRecuperacion } = require('../config/mailer');
const { validarContrasena } = require('../controllers/afiliadosController');

const VIGENCIA_MIN = 30;
const MAX_POR_HORA = 3; // enlaces por afiliado por hora (evita llenar su bandeja de correo)

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const tokenValido = (token) => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);

const RESPUESTA_GENERICA = {
    mensaje: 'Si la cédula está registrada y tiene un correo, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam. El enlace vence en 30 minutos.',
};

// POST /api/recuperar
const solicitarRecuperacion = async (req, res) => {
    const cedula = typeof req.body.cedula === 'string' ? req.body.cedula.trim() : '';
    if (!/^\d{5,15}$/.test(cedula)) {
        return res.status(400).json({ error: 'Escribe tu número de cédula (solo números).' });
    }

    try {
        const { rows } = await pool.query(
            `SELECT id, nombres, correo FROM afiliados WHERE cedula = $1`, [cedula]);
        const afiliado = rows[0];
        if (!afiliado || !afiliado.correo) return res.json(RESPUESTA_GENERICA);

        const recientes = await pool.query(
            `SELECT COUNT(*)::int AS total FROM recuperaciones_contrasena
             WHERE afiliado_id = $1 AND creado_en > NOW() - INTERVAL '1 hour'`, [afiliado.id]);
        if (recientes.rows[0].total >= MAX_POR_HORA) return res.json(RESPUESTA_GENERICA);

        // Un solo enlace vigente a la vez: los anteriores dejan de servir.
        await pool.query(
            `UPDATE recuperaciones_contrasena SET usado_en = NOW()
             WHERE afiliado_id = $1 AND usado_en IS NULL`, [afiliado.id]);

        const token = crypto.randomBytes(32).toString('hex');
        await pool.query(
            `INSERT INTO recuperaciones_contrasena (afiliado_id, token_hash, expira_en)
             VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
            [afiliado.id, hashToken(token), String(VIGENCIA_MIN)]);

        const base = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
        // El código va después de "#": el navegador no lo envía al servidor ni a terceros.
        const enlace = `${base}/restablecer#${token}`;
        await enviarCorreoRecuperacion({ correo: afiliado.correo, nombre: afiliado.nombres, enlace, minutos: VIGENCIA_MIN });

        res.json(RESPUESTA_GENERICA);
    } catch (err) {
        console.error('Error al solicitar recuperación de contraseña:', err);
        res.status(500).json({ error: 'No se pudo procesar la solicitud. Inténtalo de nuevo.' });
    }
};

async function buscarSolicitudVigente(cliente, token) {
    const { rows } = await cliente.query(
        `SELECT r.id, r.afiliado_id, a.nombres
         FROM recuperaciones_contrasena r JOIN afiliados a ON a.id = r.afiliado_id
         WHERE r.token_hash = $1 AND r.usado_en IS NULL AND r.expira_en > NOW()`,
        [hashToken(token)]);
    return rows[0] || null;
}

// POST /api/restablecer/validar
const validarEnlace = async (req, res) => {
    const { token } = req.body;
    if (!tokenValido(token)) return res.status(400).json({ valido: false });
    try {
        const solicitud = await buscarSolicitudVigente(pool, token);
        if (!solicitud) return res.status(410).json({ valido: false });
        res.json({ valido: true, nombre: solicitud.nombres });
    } catch (err) {
        console.error('Error al validar enlace de recuperación:', err);
        res.status(500).json({ error: 'No se pudo verificar el enlace.' });
    }
};

// POST /api/restablecer
const restablecerContrasena = async (req, res) => {
    const { token, contrasena } = req.body;
    if (!tokenValido(token)) {
        return res.status(400).json({ error: 'El enlace no es válido. Pide uno nuevo.' });
    }
    const errorContrasena = validarContrasena(contrasena);
    if (errorContrasena) return res.status(400).json({ error: errorContrasena });

    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        const solicitud = await buscarSolicitudVigente(cliente, token);
        if (!solicitud) {
            await cliente.query('ROLLBACK');
            return res.status(410).json({ error: 'El enlace ya se usó o venció. Pide uno nuevo.' });
        }
        const hash = await bcrypt.hash(contrasena, 12);
        await cliente.query('UPDATE afiliados SET contrasena = $1 WHERE id = $2', [hash, solicitud.afiliado_id]);
        await cliente.query(
            `UPDATE recuperaciones_contrasena SET usado_en = NOW()
             WHERE afiliado_id = $1 AND usado_en IS NULL`, [solicitud.afiliado_id]);
        await cliente.query('COMMIT');
        res.json({ mensaje: 'Tu contraseña fue cambiada. Ya puedes ingresar con la nueva.' });
    } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        console.error('Error al restablecer contraseña:', err);
        res.status(500).json({ error: 'No se pudo cambiar la contraseña. Inténtalo de nuevo.' });
    } finally {
        cliente.release();
    }
};

module.exports = { solicitarRecuperacion, validarEnlace, restablecerContrasena };
