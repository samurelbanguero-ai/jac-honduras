// routes/admin.js
const express = require('express');
const router = express.Router();
const { login, perfil } = require('../controllers/adminController');
const { verificarToken, verificarAdmin } = require('../middleware/auth');

router.post('/login', login);
router.get('/perfil', verificarToken, verificarAdmin, perfil);

module.exports = router;
