// routes/comunidad.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const {
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
} = require('../controllers/comunidadController');
const { verificarToken, verificarAdmin, verificarAfiliado } = require('../middleware/auth');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// ── Multer: imágenes (foto de perfil) ────────────────────────
const EXTENSIONES_IMAGEN = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };
const storageImagen = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const ext = EXTENSIONES_IMAGEN[file.mimetype] || path.extname(file.originalname);
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
    }
});
const uploadImagen = multer({
    storage: storageImagen,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        if (EXTENSIONES_IMAGEN[file.mimetype]) return cb(null, true);
        const err = new Error('Solo se permiten imágenes JPG, PNG, GIF o WEBP.');
        err.status = 400;
        cb(err);
    }
});

// ── Multer: documentos (actas / reglamentos en PDF) ──────────
const storageDocumento = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + '.pdf')
});
const uploadDocumento = multer({
    storage: storageDocumento,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') return cb(null, true);
        const err = new Error('Solo se permiten archivos PDF.');
        err.status = 400;
        cb(err);
    }
});

// ── Perfil ────────────────────────────────────────────────────
router.post('/perfil/foto', verificarToken, verificarAfiliado, uploadImagen.single('foto'), subirFotoPerfil);

// ── Notificaciones ────────────────────────────────────────────
router.get('/notificaciones', verificarToken, listarNotificaciones);
router.post('/notificaciones/:id/leer', verificarToken, verificarAfiliado, marcarNotificacionLeida);
router.post('/notificaciones', verificarToken, verificarAdmin, crearNotificacion);
router.delete('/notificaciones/:id', verificarToken, verificarAdmin, eliminarNotificacion);

// ── Encuestas / Votaciones ───────────────────────────────────
router.get('/encuestas', verificarToken, listarEncuestas);
router.post('/encuestas/:id/votar', verificarToken, verificarAfiliado, votarEncuesta);
router.post('/encuestas', verificarToken, verificarAdmin, crearEncuesta);
router.put('/encuestas/:id/cerrar', verificarToken, verificarAdmin, cerrarEncuesta);
router.delete('/encuestas/:id', verificarToken, verificarAdmin, eliminarEncuesta);

// ── PQRS ──────────────────────────────────────────────────────
router.get('/pqrs', verificarToken, listarPqrs);
router.post('/pqrs', verificarToken, verificarAfiliado, crearPqrs);
router.put('/pqrs/:id/responder', verificarToken, verificarAdmin, responderPqrs);

// ── Aportes ───────────────────────────────────────────────────
router.get('/aportes', verificarToken, listarAportes);
router.post('/aportes', verificarToken, verificarAdmin, crearAporte);

// ── Eventos / Convites ────────────────────────────────────────
router.get('/eventos', verificarToken, listarEventos);
router.post('/eventos/:id/inscribir', verificarToken, verificarAfiliado, inscribirseEvento);
router.delete('/eventos/:id/inscribir', verificarToken, verificarAfiliado, cancelarInscripcionEvento);
router.post('/eventos', verificarToken, verificarAdmin, crearEvento);
router.delete('/eventos/:id', verificarToken, verificarAdmin, eliminarEvento);

// ── Documentos / Actas ────────────────────────────────────────
router.get('/documentos', verificarToken, listarDocumentos);
router.post('/documentos', verificarToken, verificarAdmin, uploadDocumento.single('archivo'), subirDocumento);
router.delete('/documentos/:id', verificarToken, verificarAdmin, eliminarDocumento);

module.exports = router;
