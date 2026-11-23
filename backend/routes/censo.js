// routes/censo.js
const express = require('express');
const router = express.Router();
const c = require('../controllers/censoController');
const { verificarToken, verificarAdmin, verificarAfiliado } = require('../middleware/auth');
const { validarId } = require('../middleware/validar');
const { subirAdjuntoCenso } = require('./subidas');

router.param('id', validarId);

// ── Afiliado: solo su propio censo ───────────────────────────
router.get('/mio', verificarToken, verificarAfiliado, c.obtenerMiCenso);
router.post('/mio', verificarToken, verificarAfiliado, c.guardarMiCenso);

// ── Afiliado: miembros de SU hogar ───────────────────────────
router.get('/mio/miembros', verificarToken, verificarAfiliado, c.listarMisMiembrosHogar);
router.post('/mio/miembros', verificarToken, verificarAfiliado, c.agregarMiMiembroHogar);
router.put('/mio/miembros/:id', verificarToken, verificarAfiliado, c.actualizarMiMiembroHogar);
router.delete('/mio/miembros/:id', verificarToken, verificarAfiliado, c.eliminarMiMiembroHogar);

// ── Afiliado: archivos adjuntos de SU censo ──────────────────
router.get('/mio/archivos', verificarToken, verificarAfiliado, c.listarMisArchivosCenso);
router.post('/mio/archivos', verificarToken, verificarAfiliado, ...subirAdjuntoCenso('archivo'), c.subirMiArchivoCenso);
router.delete('/mio/archivos/:id', verificarToken, verificarAfiliado, c.eliminarMiArchivoCenso);

// ── Ver un adjunto: enlace firmado y temporal (lo usan <img> y <a>, que no
//    pueden enviar el token en la cabecera Authorization) ─────
router.get('/archivos/:id/ver', c.verArchivoCenso);

// ── Admin: listado, estadísticas y gestión completa ──────────
// (rutas fijas antes de "/:id" para que no sean capturadas como un id)
router.get('/estadisticas', verificarToken, verificarAdmin, c.obtenerEstadisticas);
router.delete('/archivos/:id', verificarToken, verificarAdmin, c.eliminarArchivoCensoAdmin);
router.delete('/miembros/:id', verificarToken, verificarAdmin, c.eliminarMiembroHogarAdmin);
router.get('/', verificarToken, verificarAdmin, c.listarCensos);
router.get('/:id/archivos', verificarToken, verificarAdmin, c.listarArchivosCensoAdmin);
router.get('/:id/miembros', verificarToken, verificarAdmin, c.listarMiembrosHogarAdmin);
router.put('/:id/revision', verificarToken, verificarAdmin, c.marcarRevisionCenso);
router.get('/:id', verificarToken, verificarAdmin, c.obtenerCensoPorId);
router.put('/:id', verificarToken, verificarAdmin, c.actualizarCenso);
router.delete('/:id', verificarToken, verificarAdmin, c.eliminarCenso);

module.exports = router;
