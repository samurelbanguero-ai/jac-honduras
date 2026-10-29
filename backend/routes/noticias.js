// routes/noticias.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const {
    listarNoticias,
    obtenerNoticia,
    crearNoticia,
    eliminarNoticia
} = require('../controllers/noticiasController');
const { verificarToken, verificarAdmin, identificarUsuario } = require('../middleware/auth');

// Asegurar que la carpeta 'uploads' exista
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configurar multer para almacenar imágenes
const EXTENSIONES_PERMITIDAS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const ext = EXTENSIONES_PERMITIDAS[file.mimetype] || path.extname(file.originalname);
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        if (EXTENSIONES_PERMITIDAS[file.mimetype]) {
            cb(null, true);
        } else {
            const err = new Error('Solo se permiten imágenes JPG, PNG, GIF o WEBP.');
            err.status = 400;
            cb(err);
        }
    }
});

// Rutas públicas (identificarUsuario no bloquea: solo permite saber si
// quien consulta está autenticado, para incluir noticias solo-afiliados)
router.get('/', identificarUsuario, listarNoticias);
router.get('/:id', identificarUsuario, obtenerNoticia);

// Rutas protegidas (solo administrador)
router.post('/', verificarToken, verificarAdmin, upload.single('imagen'), crearNoticia);
router.delete('/:id', verificarToken, verificarAdmin, eliminarNoticia);

module.exports = router;
