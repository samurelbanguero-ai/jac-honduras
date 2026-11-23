// controllers/afiliadosController.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { esCredencialPublica } = require('../config/seguridad');
const { borrarArchivo } = require('../utils/archivos');

const GENEROS = ['Masculino', 'Femenino', 'No binario', 'Otro', 'Prefiero no decir'];
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_CEDULA = /^\d{5,15}$/;
const RE_TELEFONO = /^[+\d][\d\s-]{6,19}$/;

function esFechaValida(valor) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) return false;
    const fecha = new Date(valor);
    return !Number.isNaN(fecha.getTime()) && fecha <= new Date();
}

// Valida los datos de identidad comunes a registro y edición. Devuelve un
// mensaje de error o null.
function validarDatosAfiliado(d) {
    for (const campo of ['nombres', 'apellidos', 'cedula', 'fecha_expedicion', 'genero', 'etnia', 'discapacidad', 'fecha_afiliacion', 'telefono', 'correo']) {
        if (d[campo] != null && typeof d[campo] !== 'string') return 'Formato de datos inválido.';
    }
    if (String(d.nombres).trim().length > 100 || String(d.apellidos).trim().length > 100) {
        return 'Nombres y apellidos no pueden superar los 100 caracteres.';
    }
    if (!RE_CEDULA.test(String(d.cedula))) return 'La cédula debe contener solo números (entre 5 y 15 dígitos).';
    if (!esFechaValida(d.fecha_expedicion)) return 'La fecha de expedición no es válida.';
    if (d.fecha_afiliacion && !esFechaValida(d.fecha_afiliacion)) return 'La fecha de afiliación no es válida.';
    if (!GENEROS.includes(d.genero)) return 'Selecciona un género válido.';
    if (d.correo && (!RE_CORREO.test(d.correo) || d.correo.length > 100)) return 'Correo electrónico inválido.';
    if (d.telefono && !RE_TELEFONO.test(d.telefono)) return 'Número de teléfono inválido.';
    if (d.etnia && String(d.etnia).length > 50) return 'El campo etnia es demasiado largo.';
    if (d.discapacidad && String(d.discapacidad).length > 100) return 'El campo discapacidad es demasiado largo.';
    return null;
}

function validarContrasena(contrasena) {
    if (typeof contrasena !== 'string' || contrasena.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (contrasena.length > 72) return 'La contraseña no puede superar los 72 caracteres.';
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(contrasena) || !/\d/.test(contrasena)) return 'La contraseña debe combinar letras y números.';
    return null;
}

const esHashBcryptValido = (hash) =>
    typeof hash === 'string' && /^\$2[aby]\$/.test(hash);

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
    const errorDatos = validarDatosAfiliado(req.body) || validarContrasena(contrasena);
    if (errorDatos) {
        return res.status(400).json({ error: errorDatos });
    }

    try {
        const hashedPassword = await bcrypt.hash(contrasena, 12);

        const result = await pool.query(
            `INSERT INTO afiliados
             (nombres, apellidos, cedula, contrasena, fecha_expedicion, genero, etnia, discapacidad, fecha_afiliacion, telefono, correo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING ${COLUMNAS_PUBLICAS}`,
            [nombres.trim(), apellidos.trim(), cedula, hashedPassword, fecha_expedicion, genero,
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
    const errorDatos = validarDatosAfiliado(req.body);
    if (errorDatos) {
        return res.status(400).json({ error: errorDatos });
    }

    try {
        const result = await pool.query(
            `UPDATE afiliados SET
             nombres=$1, apellidos=$2, cedula=$3, fecha_expedicion=$4,
             genero=$5, etnia=$6, discapacidad=$7, fecha_afiliacion=$8,
             telefono=$9, correo=$10
             WHERE id=$11 RETURNING ${COLUMNAS_PUBLICAS}`,
            [nombres, apellidos, cedula, fecha_expedicion, genero,
             etnia || null, discapacidad || 'Ninguna', fecha_afiliacion || new Date().toISOString().split('T')[0],
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
        // Archivos que quedarían huérfanos (foto y adjuntos del censo, que se borran en cascada)
        const adjuntos = await pool.query(
            `SELECT ca.archivo_url FROM censo_archivos ca JOIN censos c ON c.id = ca.censo_id WHERE c.afiliado_id = $1`, [id]);
        const result = await pool.query(`DELETE FROM afiliados WHERE id=$1 RETURNING ${COLUMNAS_PUBLICAS}`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Afiliado no encontrado.' });
        }
        borrarArchivo(result.rows[0].foto_url);
        adjuntos.rows.forEach(a => borrarArchivo(a.archivo_url));
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
    if ((telefono != null && typeof telefono !== 'string') || (correo != null && typeof correo !== 'string')) {
        return res.status(400).json({ error: 'Formato de datos inválido.' });
    }

    if (correo && (!RE_CORREO.test(correo) || correo.length > 100)) {
        return res.status(400).json({ error: 'Correo electrónico inválido.' });
    }
    if (telefono && !RE_TELEFONO.test(telefono)) {
        return res.status(400).json({ error: 'Número de teléfono inválido.' });
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
    const errorContrasena = validarContrasena(contrasena_nueva);
    if (errorContrasena) {
        return res.status(400).json({ error: errorContrasena });
    }

    try {
        const result = await pool.query('SELECT contrasena FROM afiliados WHERE id = $1', [req.admin.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Afiliado no encontrado.' });
        }

        const valido = esHashBcryptValido(result.rows[0].contrasena)
            ? await bcrypt.compare(contrasena_actual, result.rows[0].contrasena)
            : false;
        if (!valido) {
            return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
        }

        const hash = await bcrypt.hash(contrasena_nueva, 12);
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

    const errorContrasena = validarContrasena(contrasena_nueva);
    if (errorContrasena) {
        return res.status(400).json({ error: errorContrasena });
    }

    try {
        const hash = await bcrypt.hash(contrasena_nueva, 12);
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
    if (!RE_CEDULA.test(String(cedula))) {
        return res.status(404).json({ error: 'No se encontró ningún afiliado con esa cédula.' });
    }
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
        const isMatch = esHashBcryptValido(afiliado.contrasena)
            ? await bcrypt.compare(contrasena, afiliado.contrasena)
            : false;

        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }
        if (esCredencialPublica({ tipo: 'afiliado', identificador: cedula, contrasena })) {
            return res.status(403).json({ error: 'Esta cuenta usa una contraseña de prueba y fue bloqueada por seguridad. Contacta a la Junta.' });
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

// GET /afiliados/perfil/qr - QR del carnet generado en el propio servidor.
// (Antes se pedía a api.qrserver.com, lo que enviaba la cédula a un tercero.)
const qrPropio = async (req, res) => {
    try {
        const base = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
        const url = `${base}/verificar/${encodeURIComponent(req.admin.cedula)}`;
        const imagen = await QRCode.toDataURL(url, { width: 400, margin: 1, errorCorrectionLevel: 'M' });
        res.json({ url, imagen });
    } catch (err) {
        console.error('Error al generar el QR:', err);
        res.status(500).json({ error: 'No se pudo generar el código QR.' });
    }
};

module.exports = {
    validarContrasena,
    qrPropio,
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
