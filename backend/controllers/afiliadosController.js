// controllers/afiliadosController.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const COLUMNAS_PUBLICAS = `id, nombres, apellidos, cedula, fecha_expedicion, genero, etnia,
    discapacidad, fecha_afiliacion, telefono, correo, foto_url, created_at`;

// GET /afiliados - Listar todos los afiliados
const listarAfiliados = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${COLUMNAS_PUBLICAS} FROM afiliados ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener afiliados:', err);
        res.status(500).json({ error: 'Error al obtener afiliados.' });
    }
};

// GET /afiliados/:id - Obtener un afiliado
const obtenerAfiliado = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`SELECT ${COLUMNAS_PUBLICAS} FROM afiliados WHERE id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Afiliado no encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener afiliado:', err);
        res.status(500).json({ error: 'Error al obtener afiliado.' });
    }
};

// POST /afiliados - Crear afiliado
const crearAfiliado = async (req, res) => {
    const {
        nombres, apellidos, cedula, contrasena, fecha_expedicion,
        genero, etnia, discapacidad, fecha_afiliacion,
        telefono, correo
    } = req.body;

    // Validaciones básicas
    if (!nombres || !apellidos || !cedula || !contrasena || !fecha_expedicion || !genero) {
        return res.status(400).json({ error: 'Los campos nombres, apellidos, cédula, contraseña, fecha de expedición y género son obligatorios.' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(contrasena, salt);

        const result = await pool.query(
            `INSERT INTO afiliados
             (nombres, apellidos, cedula, contrasena, fecha_expedicion, genero, etnia, discapacidad, fecha_afiliacion, telefono, correo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING ${COLUMNAS_PUBLICAS}`,
            [nombres, apellidos, cedula, hashedPassword, fecha_expedicion, genero,
             etnia || null, discapacidad || 'Ninguna',
             fecha_afiliacion || new Date().toISOString().split('T')[0],
             telefono || null, correo || null]
        );
        
        const token = jwt.sign(
            { id: result.rows[0].id, rol: 'afiliado', cedula: result.rows[0].cedula },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.status(201).json({
            mensaje: '¡Registro exitoso! Ya te encuentras en la Junta de Acción Comunal de Honduras, Cauca.',
            token,
            afiliado: result.rows[0]
        });
    } catch (err) {
        if (err.code === '23505') { // Violación de unique (cédula duplicada)
            return res.status(400).json({ error: 'Ya existe un afiliado con esa cédula.' });
        }
        console.error('Error al registrar afiliado:', err);
        res.status(500).json({ error: 'Error al registrar afiliado.' });
    }
};

// PUT /afiliados/:id - Actualizar afiliado
const actualizarAfiliado = async (req, res) => {
    const { id } = req.params;
    const {
        nombres, apellidos, cedula, fecha_expedicion,
        genero, etnia, discapacidad, fecha_afiliacion,
        telefono, correo
    } = req.body;

    if (!nombres || !apellidos || !cedula || !fecha_expedicion || !genero) {
        return res.status(400).json({ error: 'Campos obligatorios incompletos.' });
    }

    try {
        const result = await pool.query(
            `UPDATE afiliados SET
             nombres=$1, apellidos=$2, cedula=$3, fecha_expedicion=$4,
             genero=$5, etnia=$6, discapacidad=$7, fecha_afiliacion=$8,
             telefono=$9, correo=$10
             WHERE id=$11 RETURNING ${COLUMNAS_PUBLICAS}`,
            [nombres, apellidos, cedula, fecha_expedicion, genero,
             etnia || null, discapacidad || 'Ninguna', fecha_afiliacion,
             telefono || null, correo || null, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Afiliado no encontrado.' });
        }
        res.json({ mensaje: 'Afiliado actualizado correctamente.', afiliado: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Ya existe un afiliado con esa cédula.' });
        }
        console.error('Error al actualizar afiliado:', err);
        res.status(500).json({ error: 'Error al actualizar afiliado.' });
    }
};

// DELETE /afiliados/:id - Eliminar afiliado
const eliminarAfiliado = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`DELETE FROM afiliados WHERE id=$1 RETURNING ${COLUMNAS_PUBLICAS}`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Afiliado no encontrado.' });
        }
        res.json({ mensaje: 'Afiliado eliminado correctamente.' });
    } catch (err) {
        console.error('Error al eliminar afiliado:', err);
        res.status(500).json({ error: 'Error al eliminar afiliado.' });
    }
};

// GET /afiliados/perfil - Datos propios del afiliado autenticado
const perfilPropio = async (req, res) => {
    try {
        const result = await pool.query(`SELECT ${COLUMNAS_PUBLICAS} FROM afiliados WHERE id = $1`, [req.admin.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Afiliado no encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener perfil propio:', err);
        res.status(500).json({ error: 'Error al obtener el perfil.' });
    }
};

// PUT /afiliados/perfil - El afiliado edita sus propios datos de contacto.
// Solo teléfono y correo: cédula/nombres/etc. los sigue manejando el admin
// para no perder control sobre la identidad del registro.
const actualizarPerfilPropio = async (req, res) => {
    const { telefono, correo } = req.body;

    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        return res.status(400).json({ error: 'Correo electrónico inválido.' });
    }

    try {
        const result = await pool.query(
            `UPDATE afiliados SET telefono = $1, correo = $2 WHERE id = $3 RETURNING ${COLUMNAS_PUBLICAS}`,
            [telefono || null, correo || null, req.admin.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Afiliado no encontrado.' });
        }
        res.json({ mensaje: 'Datos de contacto actualizados correctamente.', afiliado: result.rows[0] });
    } catch (err) {
        console.error('Error al actualizar perfil propio:', err);
        res.status(500).json({ error: 'Error al actualizar el perfil.' });
    }
};

// PUT /afiliados/perfil/contrasena - El afiliado cambia su propia contraseña
// (sabiendo la actual). Para cuando la olvida por completo y no puede
// autenticarse, ver resetearContrasena (acción del admin).
const cambiarContrasenaPropia = async (req, res) => {
    const { contrasena_actual, contrasena_nueva } = req.body;

    if (!contrasena_actual || !contrasena_nueva) {
        return res.status(400).json({ error: 'Ingresa tu contraseña actual y la nueva.' });
    }
    if (contrasena_nueva.length < 6) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    try {
        const result = await pool.query('SELECT contrasena FROM afiliados WHERE id = $1', [req.admin.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Afiliado no encontrado.' });
        }

        const valido = await bcrypt.compare(contrasena_actual, result.rows[0].contrasena);
        if (!valido) {
            return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
        }

        const hash = await bcrypt.hash(contrasena_nueva, 10);
        await pool.query('UPDATE afiliados SET contrasena = $1 WHERE id = $2', [hash, req.admin.id]);

        res.json({ mensaje: 'Contraseña actualizada correctamente.' });
    } catch (err) {
        console.error('Error al cambiar contraseña propia:', err);
        res.status(500).json({ error: 'Error al cambiar la contraseña.' });
    }
};

// PUT /afiliados/:id/contrasena - El admin resetea la contraseña de un
// afiliado que ya no puede entrar (la olvidó y no sabe la actual).
const resetearContrasena = async (req, res) => {
    const { id } = req.params;
    const { contrasena_nueva } = req.body;

    if (!contrasena_nueva || contrasena_nueva.length < 6) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    try {
        const hash = await bcrypt.hash(contrasena_nueva, 10);
        const result = await pool.query(
            'UPDATE afiliados SET contrasena = $1 WHERE id = $2 RETURNING id',
            [hash, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Afiliado no encontrado.' });
        }
        res.json({ mensaje: 'Contraseña reestablecida correctamente.' });
    } catch (err) {
        console.error('Error al resetear contraseña:', err);
        res.status(500).json({ error: 'Error al reestablecer la contraseña.' });
    }
};

// GET /afiliados/verificar/:cedula - Verificación pública del carnet (vía QR).
// Sin autenticación: solo expone datos no sensibles (nada de teléfono,
// correo, género, etnia, discapacidad, etc.).
const verificarPublico = async (req, res) => {
    const { cedula } = req.params;
    try {
        const result = await pool.query(
            'SELECT nombres, apellidos, cedula, foto_url, fecha_afiliacion FROM afiliados WHERE cedula = $1',
            [cedula]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontró ningún afiliado con esa cédula.' });
        }
        res.json({ verificado: true, afiliado: result.rows[0] });
    } catch (err) {
        console.error('Error al verificar afiliado:', err);
        res.status(500).json({ error: 'Error al verificar el afiliado.' });
    }
};

// POST /afiliados/login - Iniciar sesión de afiliado
const loginAfiliado = async (req, res) => {
    const { cedula, contrasena } = req.body;
    
    if (!cedula || !contrasena) {
        return res.status(400).json({ error: 'Cédula y contraseña son requeridas.' });
    }

    try {
        const result = await pool.query('SELECT * FROM afiliados WHERE cedula = $1', [cedula]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }

        const afiliado = result.rows[0];
        const isMatch = await bcrypt.compare(contrasena, afiliado.contrasena);

        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }

        const token = jwt.sign(
            { id: afiliado.id, rol: 'afiliado', cedula: afiliado.cedula },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        delete afiliado.contrasena; // No enviar contraseña en la respuesta

        res.json({
            mensaje: 'Inicio de sesión exitoso.',
            token,
            afiliado
        });
    } catch (err) {
        console.error('Error al iniciar sesión de afiliado:', err);
        res.status(500).json({ error: 'Error al iniciar sesión.' });
    }
};

module.exports = {
    listarAfiliados,
    obtenerAfiliado,
    crearAfiliado,
    actualizarAfiliado,
    eliminarAfiliado,
    loginAfiliado,
    verificarPublico,
    perfilPropio,
    actualizarPerfilPropio,
    cambiarContrasenaPropia,
    resetearContrasena
};
