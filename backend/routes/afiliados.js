// routes/afiliados.js
const express = require('express');
const router = express.Router();
const {
    listarAfiliados, obtenerAfiliado, crearAfiliado, actualizarAfiliado, eliminarAfiliado,
    loginAfiliado, verificarPublico, perfilPropio, actualizarPerfilPropio,
    cambiarContrasenaPropia, resetearContrasena, qrPropio
} = require('../controllers/afiliadosController');
const { verificarToken, verificarAdmin, verificarAfiliado } = require('../middleware/auth');
const { validarId } = require('../middleware/validar');

router.param('id', validarId);

// Registro público (cualquier persona puede afiliarse)
router.post('/', crearAfiliado);

// Login de usuario (afiliado)
router.post('/login', loginAfiliado);

// Verificación pública del carnet vía QR (sin autenticación, sin datos sensibles)
router.get('/verificar/:cedula', verificarPublico);

// Perfil propio del afiliado (debe ir antes de "/:id" para no chocar con la ruta genérica)
router.get('/perfil', verificarToken, verificarAfiliado, perfilPropio);
router.get('/perfil/qr', verificarToken, verificarAfiliado, qrPropio);
router.put('/perfil', verificarToken, verificarAfiliado, actualizarPerfilPropio);
router.put('/perfil/contrasena', verificarToken, verificarAfiliado, cambiarContrasenaPropia);

// Rutas protegidas (solo admin autenticado)
router.get('/', verificarToken, verificarAdmin, listarAfiliados);
router.get('/:id', verificarToken, verificarAdmin, obtenerAfiliado);
router.put('/:id', verificarToken, verificarAdmin, actualizarAfiliado);
router.put('/:id/contrasena', verificarToken, verificarAdmin, resetearContrasena);
router.delete('/:id', verificarToken, verificarAdmin, eliminarAfiliado);

module.exports = router;
