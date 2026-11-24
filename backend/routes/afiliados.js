// routes/afiliados.js
const express = require('express');
const router = express.Router();
const {
    listarAfiliados, obtenerAfiliado, crearAfiliado, actualizarAfiliado, eliminarAfiliado,
    loginAfiliado, verificarPublico, perfilPropio, actualizarPerfilPropio,
    cambiarContrasenaPropia, resetearContrasena, qrPropio, exportarAfiliados,
    listarSolicitudes, aprobarSolicitud, rechazarSolicitud
} = require('../controllers/afiliadosController');
const { verificarToken, verificarAdmin, verificarAfiliado, identificarUsuario, soloAprobados } = require('../middleware/auth');
const { validarId } = require('../middleware/validar');

router.param('id', validarId);

// Registro público (cualquier persona puede afiliarse)
// (identificarUsuario: si quien registra es el administrador, el afiliado queda aprobado de una vez)
router.post('/', identificarUsuario, crearAfiliado);

// Login de usuario (afiliado)
router.post('/login', loginAfiliado);

// Verificación pública del carnet vía QR (sin autenticación, sin datos sensibles)
router.get('/verificar/:cedula', verificarPublico);

// Perfil propio del afiliado (debe ir antes de "/:id" para no chocar con la ruta genérica)
router.get('/perfil', verificarToken, verificarAfiliado, perfilPropio);
router.get('/perfil/qr', verificarToken, verificarAfiliado, soloAprobados, qrPropio);
router.put('/perfil', verificarToken, verificarAfiliado, actualizarPerfilPropio);
router.put('/perfil/contrasena', verificarToken, verificarAfiliado, cambiarContrasenaPropia);

// Rutas protegidas (solo admin autenticado)
router.get('/', verificarToken, verificarAdmin, listarAfiliados);
router.get('/exportar', verificarToken, verificarAdmin, exportarAfiliados);
router.get('/solicitudes', verificarToken, verificarAdmin, listarSolicitudes);
router.put('/:id/aprobar', verificarToken, verificarAdmin, aprobarSolicitud);
router.put('/:id/rechazar', verificarToken, verificarAdmin, rechazarSolicitud);
router.get('/:id', verificarToken, verificarAdmin, obtenerAfiliado);
router.put('/:id', verificarToken, verificarAdmin, actualizarAfiliado);
router.put('/:id/contrasena', verificarToken, verificarAdmin, resetearContrasena);
router.delete('/:id', verificarToken, verificarAdmin, eliminarAfiliado);

module.exports = router;
