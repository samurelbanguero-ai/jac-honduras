// routes/censo.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const {
    obtenerMiCenso,
    guardarMiCenso,
    listarCensos,
    obtenerEstadisticas,
    obtenerCensoPorId,
    actualizarCenso,
    eliminarCenso,
    marcarRevisionCenso,
    listarMisMiembrosHogar,
    agregarMiMiembroHogar,
    actualizarMiMiembroHogar,
    eliminarMiMiembroHogar,
    listarMiembrosHogarAdmin,
    eliminarMiembroHogarAdmin,
    listarMisArchivosCenso,
    subirMiArchivoCenso,
    eliminarMiArchivoCenso,
    listarArchivosCensoAdmin,
    eliminarArchivoCensoAdmin
} = require('../controllers/censoController');
const { verificarToken, verificarAdmin, verificarAfiliado } = require('../middleware/auth');

// ── Multer: archivos adjuntos del censo (fotos de la vivienda o documentos) ──
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const EXTENSIONES_ARCHIVO_CENSO = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
    'application/pdf': '.pdf'
};
const storageArchivoCenso = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const ext = EXTENSIONES_ARCHIVO_CENSO[file.mimetype] || path.extname(file.originalname);
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
    }
});
const uploadArchivoCenso = multer({
    storage: storageArchivoCenso,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
    fileFilter: (req, file, cb) => {
        if (EXTENSIONES_ARCHIVO_CENSO[file.mimetype]) return cb(null, true);
        const err = new Error('Solo se permiten imágenes (JPG, PNG, GIF, WEBP) o archivos PDF.');
        err.status = 400;
        cb(err);
    }
});

// ── Afiliado: solo su propio censo ───────────────────────────
router.get('/mio', verificarToken, verificarAfiliado, obtenerMiCenso);
router.post('/mio', verificarToken, verificarAfiliado, guardarMiCenso);

// ── Afiliado: miembros de SU hogar ───────────────────────────
router.get('/mio/miembros', verificarToken, verificarAfiliado, listarMisMiembrosHogar);
router.post('/mio/miembros', verificarToken, verificarAfiliado, agregarMiMiembroHogar);
router.put('/mio/miembros/:id', verificarToken, verificarAfiliado, actualizarMiMiembroHogar);
router.delete('/mio/miembros/:id', verificarToken, verificarAfiliado, eliminarMiMiembroHogar);

// ── Afiliado: archivos adjuntos de SU censo ──────────────────
router.get('/mio/archivos', verificarToken, verificarAfiliado, listarMisArchivosCenso);
router.post('/mio/archivos', verificarToken, verificarAfiliado, uploadArchivoCenso.single('archivo'), subirMiArchivoCenso);
router.delete('/mio/archivos/:id', verificarToken, verificarAfiliado, eliminarMiArchivoCenso);

// ── Admin: listado, estadísticas y gestión completa ──────────
// (rutas fijas antes de "/:id" para que no sean capturadas como un id)
router.get('/estadisticas', verificarToken, verificarAdmin, obtenerEstadisticas);
router.delete('/archivos/:id', verificarToken, verificarAdmin, eliminarArchivoCensoAdmin);
router.delete('/miembros/:id', verificarToken, verificarAdmin, eliminarMiembroHogarAdmin);
router.get('/', verificarToken, verificarAdmin, listarCensos);
router.get('/:id/archivos', verificarToken, verificarAdmin, listarArchivosCensoAdmin);
router.get('/:id/miembros', verificarToken, verificarAdmin, listarMiembrosHogarAdmin);
router.put('/:id/revision', verificarToken, verificarAdmin, marcarRevisionCenso);
router.get('/:id', verificarToken, verificarAdmin, obtenerCensoPorId);
router.put('/:id', verificarToken, verificarAdmin, actualizarCenso);
router.delete('/:id', verificarToken, verificarAdmin, eliminarCenso);

module.exports = router;
