// controllers/adminController.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// POST /admin/login
const login = async (req, res) => {
    const { usuario, contrasena } = req.body;

    if (!usuario || !contrasena) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
    }

    try {
        const result = await pool.query('SELECT * FROM admin WHERE usuario = $1', [usuario]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }

        const admin = result.rows[0];
        const valido = await bcrypt.compare(contrasena, admin.contrasena);

        if (!valido) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }

        const token = jwt.sign(
            { id: admin.id, usuario: admin.usuario, rol: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES }
        );

        res.json({
            mensaje: 'Sesión iniciada correctamente.',
            token,
            admin: { id: admin.id, usuario: admin.usuario, nombre: admin.nombre }
        });
    } catch (err) {
        console.error('Error en login de admin:', err);
        res.status(500).json({ error: 'Error al iniciar sesión.' });
    }
};

// GET /admin/perfil - Datos del admin autenticado
const perfil = (req, res) => {
    res.json({ admin: req.admin });
};

module.exports = { login, perfil };
