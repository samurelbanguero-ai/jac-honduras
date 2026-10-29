// controllers/comunidadController.js
const pool = require('../config/db');

// ════════════════════════════════════════════════════════════
// PERFIL — Foto de perfil
// ════════════════════════════════════════════════════════════

// POST /comunidad/perfil/foto (afiliado)
const subirFotoPerfil = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    }
    const foto_url = '/uploads/' + req.file.filename;
    try {
        const result = await pool.query(
            'UPDATE afiliados SET foto_url = $1 WHERE id = $2 RETURNING id, foto_url',
            [foto_url, req.admin.id]
        );
        res.json({ mensaje: 'Foto de perfil actualizada correctamente.', foto_url: result.rows[0].foto_url });
    } catch (err) {
        console.error('Error al subir foto de perfil:', err);
        res.status(500).json({ error: 'Error al subir la foto de perfil.' });
    }
};

// ════════════════════════════════════════════════════════════
// NOTIFICACIONES
// ════════════════════════════════════════════════════════════

// GET /comunidad/notificaciones (afiliado: incluye si ya la leyó · admin: todas)
const listarNotificaciones = async (req, res) => {
    try {
        if (req.admin.rol === 'admin') {
            const result = await pool.query('SELECT * FROM notificaciones ORDER BY fecha DESC');
            return res.json(result.rows);
        }
        const result = await pool.query(
            `SELECT n.*, (nl.id IS NOT NULL) AS leida
             FROM notificaciones n
             LEFT JOIN notificaciones_leidas nl ON nl.notificacion_id = n.id AND nl.afiliado_id = $1
             ORDER BY n.fecha DESC`,
            [req.admin.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener notificaciones:', err);
        res.status(500).json({ error: 'Error al obtener las notificaciones.' });
    }
};

// POST /comunidad/notificaciones/:id/leer (afiliado)
const marcarNotificacionLeida = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(
            `INSERT INTO notificaciones_leidas (notificacion_id, afiliado_id)
             VALUES ($1, $2) ON CONFLICT (notificacion_id, afiliado_id) DO NOTHING`,
            [id, req.admin.id]
        );
        res.json({ mensaje: 'Notificación marcada como leída.' });
    } catch (err) {
        console.error('Error al marcar notificación como leída:', err);
        res.status(500).json({ error: 'Error al marcar la notificación como leída.' });
    }
};

// POST /comunidad/notificaciones (admin)
const crearNotificacion = async (req, res) => {
    const { titulo, mensaje } = req.body;
    if (!titulo || !mensaje) {
        return res.status(400).json({ error: 'Título y mensaje son obligatorios.' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO notificaciones (titulo, mensaje, creado_por) VALUES ($1, $2, $3) RETURNING *',
            [titulo, mensaje, req.admin.id]
        );
        res.status(201).json({ mensaje: 'Aviso enviado a la comunidad.', notificacion: result.rows[0] });
    } catch (err) {
        console.error('Error al crear notificación:', err);
        res.status(500).json({ error: 'Error al enviar el aviso.' });
    }
};

// DELETE /comunidad/notificaciones/:id (admin)
const eliminarNotificacion = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM notificaciones WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Aviso no encontrado.' });
        }
        res.json({ mensaje: 'Aviso eliminado correctamente.' });
    } catch (err) {
        console.error('Error al eliminar notificación:', err);
        res.status(500).json({ error: 'Error al eliminar el aviso.' });
    }
};

// ════════════════════════════════════════════════════════════
// ENCUESTAS / VOTACIONES
// ════════════════════════════════════════════════════════════

// GET /comunidad/encuestas (afiliado o admin)
const listarEncuestas = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT e.*,
                (SELECT COUNT(*) FROM votos v WHERE v.encuesta_id = e.id AND v.opcion = 'A')::int AS votos_a,
                (SELECT COUNT(*) FROM votos v WHERE v.encuesta_id = e.id AND v.opcion = 'B')::int AS votos_b
             FROM encuestas e ORDER BY e.created_at DESC`
        );

        let miVotos = {};
        if (req.admin.rol === 'afiliado') {
            const votosResult = await pool.query(
                'SELECT encuesta_id, opcion FROM votos WHERE afiliado_id = $1',
                [req.admin.id]
            );
            miVotos = Object.fromEntries(votosResult.rows.map(v => [v.encuesta_id, v.opcion]));
        }

        const encuestas = result.rows.map(e => ({
            ...e,
            total_votos: e.votos_a + e.votos_b,
            mi_voto: miVotos[e.id] || null
        }));

        res.json(encuestas);
    } catch (err) {
        console.error('Error al obtener encuestas:', err);
        res.status(500).json({ error: 'Error al obtener las encuestas.' });
    }
};

// POST /comunidad/encuestas/:id/votar (afiliado)
const votarEncuesta = async (req, res) => {
    const { id } = req.params;
    const { opcion } = req.body;

    if (!['A', 'B'].includes(opcion)) {
        return res.status(400).json({ error: 'Opción de voto inválida.' });
    }

    try {
        const encuesta = await pool.query('SELECT activa FROM encuestas WHERE id = $1', [id]);
        if (encuesta.rows.length === 0) {
            return res.status(404).json({ error: 'Encuesta no encontrada.' });
        }
        if (!encuesta.rows[0].activa) {
            return res.status(400).json({ error: 'Esta votación ya fue cerrada.' });
        }

        await pool.query(
            'INSERT INTO votos (encuesta_id, afiliado_id, opcion) VALUES ($1, $2, $3)',
            [id, req.admin.id, opcion]
        );
        res.status(201).json({ mensaje: 'Tu voto fue registrado correctamente.' });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Ya has votado en esta encuesta.' });
        }
        console.error('Error al votar:', err);
        res.status(500).json({ error: 'Error al registrar tu voto.' });
    }
};

// POST /comunidad/encuestas (admin)
const crearEncuesta = async (req, res) => {
    const { pregunta, opcion_a, opcion_b } = req.body;
    if (!pregunta || !opcion_a || !opcion_b) {
        return res.status(400).json({ error: 'La pregunta y las dos opciones son obligatorias.' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO encuestas (pregunta, opcion_a, opcion_b, creado_por) VALUES ($1, $2, $3, $4) RETURNING *',
            [pregunta, opcion_a, opcion_b, req.admin.id]
        );
        res.status(201).json({ mensaje: 'Votación creada correctamente.', encuesta: result.rows[0] });
    } catch (err) {
        console.error('Error al crear encuesta:', err);
        res.status(500).json({ error: 'Error al crear la votación.' });
    }
};

// PUT /comunidad/encuestas/:id/cerrar (admin)
const cerrarEncuesta = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE encuestas SET activa = false WHERE id = $1 RETURNING *',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Encuesta no encontrada.' });
        }
        res.json({ mensaje: 'Votación cerrada correctamente.', encuesta: result.rows[0] });
    } catch (err) {
        console.error('Error al cerrar encuesta:', err);
        res.status(500).json({ error: 'Error al cerrar la votación.' });
    }
};

// DELETE /comunidad/encuestas/:id (admin)
const eliminarEncuesta = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM encuestas WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Encuesta no encontrada.' });
        }
        res.json({ mensaje: 'Votación eliminada correctamente.' });
    } catch (err) {
        console.error('Error al eliminar encuesta:', err);
        res.status(500).json({ error: 'Error al eliminar la votación.' });
    }
};

// ════════════════════════════════════════════════════════════
// PQRS
// ════════════════════════════════════════════════════════════

// GET /comunidad/pqrs (afiliado: las suyas · admin: todas)
const listarPqrs = async (req, res) => {
    try {
        let result;
        if (req.admin.rol === 'admin') {
            result = await pool.query(
                `SELECT p.*, a.nombres, a.apellidos, a.cedula
                 FROM pqrs p JOIN afiliados a ON a.id = p.afiliado_id
                 ORDER BY p.fecha DESC`
            );
        } else {
            result = await pool.query(
                'SELECT * FROM pqrs WHERE afiliado_id = $1 ORDER BY fecha DESC',
                [req.admin.id]
            );
        }
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener PQRS:', err);
        res.status(500).json({ error: 'Error al obtener las peticiones.' });
    }
};

// POST /comunidad/pqrs (afiliado)
const crearPqrs = async (req, res) => {
    const { tipo, asunto, mensaje } = req.body;
    if (!asunto || !mensaje) {
        return res.status(400).json({ error: 'El asunto y el mensaje son obligatorios.' });
    }
    const TIPOS_VALIDOS = ['Peticion', 'Queja', 'Reclamo', 'Sugerencia'];
    const tipoFinal = TIPOS_VALIDOS.includes(tipo) ? tipo : 'Peticion';

    try {
        const result = await pool.query(
            `INSERT INTO pqrs (afiliado_id, tipo, asunto, mensaje)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.admin.id, tipoFinal, asunto, mensaje]
        );
        res.status(201).json({ mensaje: 'Tu solicitud fue enviada a la Junta.', pqrs: result.rows[0] });
    } catch (err) {
        console.error('Error al crear PQRS:', err);
        res.status(500).json({ error: 'Error al enviar tu solicitud.' });
    }
};

// PUT /comunidad/pqrs/:id/responder (admin)
const responderPqrs = async (req, res) => {
    const { id } = req.params;
    const { respuesta } = req.body;
    if (!respuesta) {
        return res.status(400).json({ error: 'La respuesta no puede estar vacía.' });
    }
    try {
        const result = await pool.query(
            `UPDATE pqrs SET respuesta = $1, estado = 'Respondido', fecha_respuesta = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING *`,
            [respuesta, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada.' });
        }
        res.json({ mensaje: 'Respuesta enviada correctamente.', pqrs: result.rows[0] });
    } catch (err) {
        console.error('Error al responder PQRS:', err);
        res.status(500).json({ error: 'Error al enviar la respuesta.' });
    }
};

// ════════════════════════════════════════════════════════════
// APORTES
// ════════════════════════════════════════════════════════════

// GET /comunidad/aportes (afiliado: los suyos · admin: todos)
const listarAportes = async (req, res) => {
    try {
        let result;
        if (req.admin.rol === 'admin') {
            result = await pool.query(
                `SELECT ap.*, a.nombres, a.apellidos, a.cedula
                 FROM aportes ap JOIN afiliados a ON a.id = ap.afiliado_id
                 ORDER BY ap.fecha DESC`
            );
        } else {
            result = await pool.query(
                'SELECT * FROM aportes WHERE afiliado_id = $1 ORDER BY fecha DESC',
                [req.admin.id]
            );
        }
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener aportes:', err);
        res.status(500).json({ error: 'Error al obtener los aportes.' });
    }
};

// POST /comunidad/aportes (admin)
const crearAporte = async (req, res) => {
    const { afiliado_id, concepto, valor, fecha, estado } = req.body;
    if (!afiliado_id || !concepto || !valor) {
        return res.status(400).json({ error: 'El afiliado, el concepto y el valor son obligatorios.' });
    }
    if (isNaN(valor) || Number(valor) <= 0) {
        return res.status(400).json({ error: 'El valor del aporte debe ser un número positivo.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO aportes (afiliado_id, concepto, valor, fecha, estado, registrado_por)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [afiliado_id, concepto, valor, fecha || new Date().toISOString().split('T')[0],
             estado === 'Pendiente' ? 'Pendiente' : 'Pagado', req.admin.id]
        );
        res.status(201).json({ mensaje: 'Aporte registrado correctamente.', aporte: result.rows[0] });
    } catch (err) {
        if (err.code === '23503') {
            return res.status(400).json({ error: 'El afiliado indicado no existe.' });
        }
        console.error('Error al crear aporte:', err);
        res.status(500).json({ error: 'Error al registrar el aporte.' });
    }
};

// ════════════════════════════════════════════════════════════
// EVENTOS / CONVITES (VOLUNTARIADO)
// ════════════════════════════════════════════════════════════

// GET /comunidad/eventos (afiliado o admin)
const listarEventos = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT e.*,
                (SELECT COUNT(*) FROM inscritos_eventos ie WHERE ie.evento_id = e.id)::int AS total_inscritos
             FROM eventos e ORDER BY e.fecha ASC`
        );

        let misInscripciones = new Set();
        if (req.admin.rol === 'afiliado') {
            const insc = await pool.query(
                'SELECT evento_id FROM inscritos_eventos WHERE afiliado_id = $1',
                [req.admin.id]
            );
            misInscripciones = new Set(insc.rows.map(r => r.evento_id));
        }

        const eventos = result.rows.map(e => ({ ...e, inscrito: misInscripciones.has(e.id) }));
        res.json(eventos);
    } catch (err) {
        console.error('Error al obtener eventos:', err);
        res.status(500).json({ error: 'Error al obtener los eventos.' });
    }
};

// POST /comunidad/eventos/:id/inscribir (afiliado)
const inscribirseEvento = async (req, res) => {
    const { id } = req.params;
    try {
        const evento = await pool.query('SELECT id FROM eventos WHERE id = $1', [id]);
        if (evento.rows.length === 0) {
            return res.status(404).json({ error: 'Evento no encontrado.' });
        }
        await pool.query(
            `INSERT INTO inscritos_eventos (evento_id, afiliado_id) VALUES ($1, $2)
             ON CONFLICT (evento_id, afiliado_id) DO NOTHING`,
            [id, req.admin.id]
        );
        res.status(201).json({ mensaje: '¡Inscripción confirmada! Gracias por apoyar el convite.' });
    } catch (err) {
        console.error('Error al inscribirse al evento:', err);
        res.status(500).json({ error: 'Error al inscribirte al evento.' });
    }
};

// DELETE /comunidad/eventos/:id/inscribir (afiliado)
const cancelarInscripcionEvento = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(
            'DELETE FROM inscritos_eventos WHERE evento_id = $1 AND afiliado_id = $2',
            [id, req.admin.id]
        );
        res.json({ mensaje: 'Inscripción cancelada.' });
    } catch (err) {
        console.error('Error al cancelar inscripción:', err);
        res.status(500).json({ error: 'Error al cancelar la inscripción.' });
    }
};

// POST /comunidad/eventos (admin)
const crearEvento = async (req, res) => {
    const { titulo, descripcion, fecha, lugar } = req.body;
    if (!titulo || !fecha) {
        return res.status(400).json({ error: 'El título y la fecha son obligatorios.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO eventos (titulo, descripcion, fecha, lugar, creado_por)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [titulo, descripcion || null, fecha, lugar || null, req.admin.id]
        );
        res.status(201).json({ mensaje: 'Evento programado correctamente.', evento: result.rows[0] });
    } catch (err) {
        console.error('Error al crear evento:', err);
        res.status(500).json({ error: 'Error al programar el evento.' });
    }
};

// DELETE /comunidad/eventos/:id (admin)
const eliminarEvento = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM eventos WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Evento no encontrado.' });
        }
        res.json({ mensaje: 'Evento eliminado correctamente.' });
    } catch (err) {
        console.error('Error al eliminar evento:', err);
        res.status(500).json({ error: 'Error al eliminar el evento.' });
    }
};

// ════════════════════════════════════════════════════════════
// DOCUMENTOS / ACTAS
// ════════════════════════════════════════════════════════════

// GET /comunidad/documentos (afiliado o admin)
const listarDocumentos = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM documentos ORDER BY fecha DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener documentos:', err);
        res.status(500).json({ error: 'Error al obtener los documentos.' });
    }
};

// POST /comunidad/documentos (admin)
const subirDocumento = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }
    const { nombre, tipo } = req.body;
    if (!nombre) {
        return res.status(400).json({ error: 'El nombre del documento es obligatorio.' });
    }
    const archivo_url = '/uploads/' + req.file.filename;
    try {
        const result = await pool.query(
            `INSERT INTO documentos (nombre, archivo_url, tipo, subido_por)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [nombre, archivo_url, tipo || 'Otro', req.admin.id]
        );
        res.status(201).json({ mensaje: 'Documento subido correctamente.', documento: result.rows[0] });
    } catch (err) {
        console.error('Error al subir documento:', err);
        res.status(500).json({ error: 'Error al subir el documento.' });
    }
};

// DELETE /comunidad/documentos/:id (admin)
const eliminarDocumento = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM documentos WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Documento no encontrado.' });
        }
        res.json({ mensaje: 'Documento eliminado correctamente.' });
    } catch (err) {
        console.error('Error al eliminar documento:', err);
        res.status(500).json({ error: 'Error al eliminar el documento.' });
    }
};

module.exports = {
    subirFotoPerfil,
    listarNotificaciones,
    marcarNotificacionLeida,
    crearNotificacion,
    eliminarNotificacion,
    listarEncuestas,
    votarEncuesta,
    crearEncuesta,
    cerrarEncuesta,
    eliminarEncuesta,
    listarPqrs,
    crearPqrs,
    responderPqrs,
    listarAportes,
    crearAporte,
    listarEventos,
    inscribirseEvento,
    cancelarInscripcionEvento,
    crearEvento,
    eliminarEvento,
    listarDocumentos,
    subirDocumento,
    eliminarDocumento
};
