// routes/auth.js
const express = require('express');
const router = express.Router();
const { login } = require('../controllers/authController');
const { solicitarRecuperacion, validarEnlace, restablecerContrasena } = require('../controllers/recuperacionController');

router.post('/login', login);

// Recuperación de contraseña (afiliados)
router.post('/recuperar', solicitarRecuperacion);
router.post('/restablecer/validar', validarEnlace);
router.post('/restablecer', restablecerContrasena);

module.exports = router;
