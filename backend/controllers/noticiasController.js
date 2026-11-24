// controllers/noticiasController.js
const pool = require('../config/db');
const { notificarNuevaNoticia } = require('../config/mailer');
const { borrarArchivo } = require('../utils/archivos');

// ¿Puede ver noticias solo-afiliados? Admin, o afiliado con la afiliación aprobada.
async function puedeVerInternas(usuario) {
    if (!usuario) return false;
    if (usuario.rol === 'admin') return true;
    if (usuario.rol !== 'afiliado') return false;
    const { rows } = await pool.query('SELECT estado FROM afiliados WHERE id = $1', [usuario.id]);
    return rows[0]?.estado === 'aprobado';
}

// GET /noticias - Listar noticias.
// Visitante anónimo: solo noticias públicas.
// Afiliado o admin autenticado: públicas + solo-afiliados.
const listarNoticias = async (req, res) => {
    try {
        const autenticado = await puedeVerInternas(req.admin);
        const result = await pool.query(
            `SELECT n.*, a.nombre as autor_nombre
             FROM noticias n
             LEFT JOIN admin a ON n.autor_admin_id = a.id
             WHERE $1 OR n.solo_afiliados = false
             ORDER BY n.created_at DESC`,
            [autenticado]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener noticias:', err);
        res.status(500).json({ error: 'Error al obtener noticias.' });
    }
};

// GET /noticias/:id - Obtener una noticia
const obtenerNoticia = async (req, res) => {
    const { id } = req.params;
    try {
        const autenticado = await puedeVerInternas(req.admin);
        const result = await pool.query(
            `SELECT n.*, a.nombre as autor_nombre
             FROM noticias n
             LEFT JOIN admin a ON n.autor_admin_id = a.id
             WHERE n.id = $1 AND ($2 OR n.solo_afiliados = false)`, [id, autenticado]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Noticia no encontrada.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener noticia:', err);
        res.status(500).json({ error: 'Error al obtener noticia.' });
    }
};

// POST /noticias - Crear noticia (SÓLO ADMIN)
const crearNoticia = async (req, res) => {
    const { titulo, contenido } = req.body;
    const solo_afiliados = req.body.solo_afiliados === 'true' || req.body.solo_afiliados === true;
    // Soporte legacy para URL en texto: solo enlaces https:// externos
    let imagen_url = typeof req.body.imagen_url === 'string' && /^https:\/\/[^\s"'<>]+$/.test(req.body.imagen_url)
        ? req.body.imagen_url.slice(0, 500)
        : null;

    // Si viene un archivo desde multer, usar su ruta estática
    if (req.file) {
        imagen_url = req.file.url;
    }

    const autor_admin_id = req.admin.id; // Viene del token JWT de admin

    if (!titulo || !contenido) {
        if (req.file) borrarArchivo(imagen_url);
        return res.status(400).json({ error: 'Título y contenido son obligatorios.' });
    }
    if (titulo.length > 255) {
        if (req.file) borrarArchivo(imagen_url);
        return res.status(400).json({ error: 'El título no puede superar los 255 caracteres.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO noticias (titulo, contenido, imagen_url, autor_admin_id, solo_afiliados)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [titulo, contenido, imagen_url, autor_admin_id, solo_afiliados]
        );

        const notificacion = await notificarNuevaNoticia(result.rows[0]);

        res.status(201).json({
            mensaje: 'Noticia publicada exitosamente.',
            noticia: result.rows[0],
            notificacion
        });
    } catch (err) {
        console.error('Error al crear noticia:', err);
        res.status(500).json({ error: 'Error al crear noticia.' });
    }
};

// DELETE /noticias/:id - Eliminar noticia (SÓLO ADMIN)
const eliminarNoticia = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM noticias WHERE id=$1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Noticia no encontrada.' });
        }
        borrarArchivo(result.rows[0].imagen_url);
        res.json({ mensaje: 'Noticia eliminada correctamente.' });
    } catch (err) {
        console.error('Error al eliminar noticia:', err);
        res.status(500).json({ error: 'Error al eliminar noticia.' });
    }
};

module.exports = {
    listarNoticias,
    obtenerNoticia,
    crearNoticia,
    eliminarNoticia
};
