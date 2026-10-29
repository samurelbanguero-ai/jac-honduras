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

module.exports = { verificarToken, verificarAdmin, verificarAfiliado, identificarUsuario };
