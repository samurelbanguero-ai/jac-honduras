// controllers/authController.js
// Login único y público: el mismo formulario sirve tanto para afiliados
// (identificador = cédula) como para administradores (identificador = usuario),
// sin que la interfaz tenga que distinguir cuál es cuál.
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    const { identificador, contrasena } = req.body;

    if (!identificador || !contrasena) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
    }

    try {
        const resultAdmin = await pool.query('SELECT * FROM admin WHERE usuario = $1', [identificador]);
        if (resultAdmin.rows.length > 0) {
            const admin = resultAdmin.rows[0];
            const valido = await bcrypt.compare(contrasena, admin.contrasena);
            if (valido) {
                const token = jwt.sign(
                    { id: admin.id, usuario: admin.usuario, rol: 'admin' },
                    process.env.JWT_SECRET,
                    { expiresIn: process.env.JWT_EXPIRES }
                );
                return res.json({
                    mensaje: 'Sesión iniciada correctamente.',
                    tipo: 'admin',
                    token,
                    admin: { id: admin.id, usuario: admin.usuario, nombre: admin.nombre }
                });
            }
        }

        const resultAfiliado = await pool.query('SELECT * FROM afiliados WHERE cedula = $1', [identificador]);
        if (resultAfiliado.rows.length > 0) {
            const afiliado = resultAfiliado.rows[0];
            const valido = await bcrypt.compare(contrasena, afiliado.contrasena);
            if (valido) {
                const token = jwt.sign(
                    { id: afiliado.id, rol: 'afiliado', cedula: afiliado.cedula },
                    process.env.JWT_SECRET,
                    { expiresIn: '2h' }
                );
                delete afiliado.contrasena;
                return res.json({
                    mensaje: 'Sesión iniciada correctamente.',
                    tipo: 'afiliado',
                    token,
                    afiliado
                });
            }
        }

        res.status(401).json({ error: 'Credenciales incorrectas.' });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error al iniciar sesión.' });
    }
};

module.exports = { login };
