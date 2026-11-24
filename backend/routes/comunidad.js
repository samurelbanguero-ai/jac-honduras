// routes/comunidad.js
const express = require('express');
const router = express.Router();
const c = require('../controllers/comunidadController');
const { verificarToken, verificarAdmin, verificarAfiliado, soloAprobados } = require('../middleware/auth');
const { validarId } = require('../middleware/validar');
const { subirFotoPerfil, subirPdf } = require('./subidas');

router.param('id', validarId);

// ── Perfil ────────────────────────────────────────────────────
router.post('/perfil/foto', verificarToken, verificarAfiliado, ...subirFotoPerfil('foto'), c.subirFotoPerfil);

// ── Notificaciones ────────────────────────────────────────────
router.get('/notificaciones', verificarToken, soloAprobados, c.listarNotificaciones);
router.post('/notificaciones/:id/leer', verificarToken, soloAprobados, verificarAfiliado, c.marcarNotificacionLeida);
router.post('/notificaciones', verificarToken, soloAprobados, verificarAdmin, c.crearNotificacion);
router.delete('/notificaciones/:id', verificarToken, soloAprobados, verificarAdmin, c.eliminarNotificacion);

// ── Encuestas / Votaciones ───────────────────────────────────
router.get('/encuestas', verificarToken, soloAprobados, c.listarEncuestas);
router.post('/encuestas/:id/votar', verificarToken, soloAprobados, verificarAfiliado, c.votarEncuesta);
router.post('/encuestas', verificarToken, soloAprobados, verificarAdmin, c.crearEncuesta);
router.put('/encuestas/:id/cerrar', verificarToken, soloAprobados, verificarAdmin, c.cerrarEncuesta);
router.delete('/encuestas/:id', verificarToken, soloAprobados, verificarAdmin, c.eliminarEncuesta);

// ── PQRS ──────────────────────────────────────────────────────
router.get('/pqrs', verificarToken, soloAprobados, c.listarPqrs);
router.post('/pqrs', verificarToken, soloAprobados, verificarAfiliado, c.crearPqrs);
router.put('/pqrs/:id/responder', verificarToken, soloAprobados, verificarAdmin, c.responderPqrs);

// ── Aportes ───────────────────────────────────────────────────
router.get('/aportes', verificarToken, soloAprobados, c.listarAportes);
router.post('/aportes', verificarToken, soloAprobados, verificarAdmin, c.crearAporte);

// ── Eventos / Convites ────────────────────────────────────────
router.get('/eventos', verificarToken, soloAprobados, c.listarEventos);
router.post('/eventos/:id/inscribir', verificarToken, soloAprobados, verificarAfiliado, c.inscribirseEvento);
router.delete('/eventos/:id/inscribir', verificarToken, soloAprobados, verificarAfiliado, c.cancelarInscripcionEvento);
router.post('/eventos', verificarToken, soloAprobados, verificarAdmin, c.crearEvento);
router.delete('/eventos/:id', verificarToken, soloAprobados, verificarAdmin, c.eliminarEvento);

// ── Documentos / Actas ────────────────────────────────────────
router.get('/documentos', verificarToken, soloAprobados, c.listarDocumentos);
router.post('/documentos', verificarToken, soloAprobados, verificarAdmin, ...subirPdf('archivo'), c.subirDocumento);
router.delete('/documentos/:id', verificarToken, soloAprobados, verificarAdmin, c.eliminarDocumento);

module.exports = router;
