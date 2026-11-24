// middleware/auth.js - Verificación de token JWT
const jwt = require('jsonwebtoken');
require('dotenv').config();

const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
};

// Debe usarse siempre después de verificarToken.
// Los tokens de afiliado no llevan rol:'admin', así que esto bloquea
// que un afiliado autoregistrado use rutas administrativas.
const verificarAdmin = (req, res, next) => {
    if (!req.admin || req.admin.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso restringido a administradores.' });
    }
    next();
};

const verificarAfiliado = (req, res, next) => {
    if (!req.admin || req.admin.rol !== 'afiliado') {
        return res.status(403).json({ error: 'Acceso restringido a afiliados.' });
    }
    next();
};

// Para rutas públicas que deben "saber" si quien consulta está autenticado
// (p. ej. mostrar noticias solo-afiliados), sin bloquear a un visitante anónimo.
const identificarUsuario = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            req.admin = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            // Token inválido/expirado: se trata como visitante anónimo, no como error.
        }
    }
    next();
};

// Para funciones internas de la comunidad: el administrador siempre pasa; un
// afiliado solo si su solicitud ya fue aprobada (se consulta la base en cada
// petición, así una aprobación o un rechazo se aplican de inmediato).
const soloAprobados = async (req, res, next) => {
    if (req.admin && req.admin.rol === 'admin') return next();
    if (!req.admin || req.admin.rol !== 'afiliado') {
        return res.status(403).json({ error: 'Acceso restringido.' });
    }
    try {
        const pool = require('../config/db');
        const { rows } = await pool.query('SELECT estado FROM afiliados WHERE id = $1', [req.admin.id]);
        if (!rows[0]) return res.status(401).json({ error: 'Tu cuenta ya no existe. Inicia sesión de nuevo.' });
        if (rows[0].estado !== 'aprobado') {
            return res.status(403).json({ error: 'Tu solicitud de afiliación todavía no ha sido aprobada por la Junta.', estado: rows[0].estado });
        }
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = { verificarToken, verificarAdmin, verificarAfiliado, identificarUsuario, soloAprobados };
