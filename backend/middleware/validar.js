// middleware/validar.js — Validaciones comunes de parámetros.

// Para router.param('id', validarId): rechaza ids no numéricos con 400 en vez
// de dejar que PostgreSQL falle con un error 500.
const validarId = (req, res, next, valor) => {
    if (!/^\d{1,10}$/.test(String(valor))) {
        return res.status(400).json({ error: 'Identificador inválido.' });
    }
    next();
};

module.exports = { validarId };
