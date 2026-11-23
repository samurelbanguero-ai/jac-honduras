// routes/comunidad.js
const express = require('express');
const router = express.Router();
const c = require('../controllers/comunidadController');
const { verificarToken, verificarAdmin, verificarAfiliado } = require('../middleware/auth');
const { validarId } = require('../middleware/validar');
const { subirFotoPerfil, subirPdf } = require('./subidas');

router.param('id', validarId);

// ── Perfil ────────────────────────────────────────────────────
router.post('/perfil/foto', verificarToken, verificarAfiliado, ...subirFotoPerfil('foto'), c.subirFotoPerfil);

// ── Notificaciones ────────────────────────────────────────────
router.get('/notificaciones', verificarToken, c.listarNotificaciones);
router.post('/notificaciones/:id/leer', verificarToken, verificarAfiliado, c.marcarNotificacionLeida);
router.post('/notificaciones', verificarToken, verificarAdmin, c.crearNotificacion);
router.delete('/notificaciones/:id', verificarToken, verificarAdmin, c.eliminarNotificacion);

// ── Encuestas / Votaciones ───────────────────────────────────
router.get('/encuestas', verificarToken, c.listarEncuestas);
router.post('/encuestas/:id/votar', verificarToken, verificarAfiliado, c.votarEncuesta);
router.post('/encuestas', verificarToken, verificarAdmin, c.crearEncuesta);
router.put('/encuestas/:id/cerrar', verificarToken, verificarAdmin, c.cerrarEncuesta);
router.delete('/encuestas/:id', verificarToken, verificarAdmin, c.eliminarEncuesta);

// ── PQRS ──────────────────────────────────────────────────────
router.get('/pqrs', verificarToken, c.listarPqrs);
router.post('/pqrs', verificarToken, verificarAfiliado, c.crearPqrs);
router.put('/pqrs/:id/responder', verificarToken, verificarAdmin, c.responderPqrs);

// ── Aportes ───────────────────────────────────────────────────
router.get('/aportes', verificarToken, c.listarAportes);
router.post('/aportes', verificarToken, verificarAdmin, c.crearAporte);

// ── Eventos / Convites ────────────────────────────────────────
router.get('/eventos', verificarToken, c.listarEventos);
router.post('/eventos/:id/inscribir', verificarToken, verificarAfiliado, c.inscribirseEvento);
router.delete('/eventos/:id/inscribir', verificarToken, verificarAfiliado, c.cancelarInscripcionEvento);
router.post('/eventos', verificarToken, verificarAdmin, c.crearEvento);
router.delete('/eventos/:id', verificarToken, verificarAdmin, c.eliminarEvento);

// ── Documentos / Actas ────────────────────────────────────────
router.get('/documentos', verificarToken, c.listarDocumentos);
router.post('/documentos', verificarToken, verificarAdmin, ...subirPdf('archivo'), c.subirDocumento);
router.delete('/documentos/:id', verificarToken, verificarAdmin, c.eliminarDocumento);

module.exports = router;
