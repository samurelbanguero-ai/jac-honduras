// routes/noticias.js
const express = require('express');
const router = express.Router();
const { listarNoticias, obtenerNoticia, crearNoticia, eliminarNoticia } = require('../controllers/noticiasController');
const { verificarToken, verificarAdmin, identificarUsuario } = require('../middleware/auth');
const { validarId } = require('../middleware/validar');
const { subirImagenNoticia } = require('./subidas');

router.param('id', validarId);

// Rutas públicas (identificarUsuario no bloquea: solo permite saber si
// quien consulta está autenticado, para incluir noticias solo-afiliados)
router.get('/', identificarUsuario, listarNoticias);
router.get('/:id', identificarUsuario, obtenerNoticia);

// Rutas protegidas (solo administrador)
router.post('/', verificarToken, verificarAdmin, ...subirImagenNoticia('imagen'), crearNoticia);
router.delete('/:id', verificarToken, verificarAdmin, eliminarNoticia);

module.exports = router;
