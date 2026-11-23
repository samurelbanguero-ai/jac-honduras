// routes/subidas.js — Recepción de archivos subidos.
// multer los recibe en memoria y validados por tipo; luego guardarArchivo los
// envía a Cloudinary o al disco local (ver utils/archivos.js). El nombre final
// siempre es aleatorio y la extensión se deriva del tipo aceptado.
const multer = require('multer');
const { guardarArchivo } = require('../utils/archivos');

const IMAGENES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };
const PDF = { 'application/pdf': '.pdf' };

// Comprobación de la firma binaria: el tipo que declara el navegador se puede falsificar.
const FIRMAS = {
    '.jpg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    '.png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    '.gif': (b) => b.subarray(0, 4).toString('latin1') === 'GIF8',
    '.webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
    '.pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
};

function crearSubida({ tipos, maxMB, carpeta, privado = false, mensaje }) {
    const receptor = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxMB * 1024 * 1024, files: 1 },
        fileFilter: (req, file, cb) => {
            if (tipos[file.mimetype]) return cb(null, true);
            const err = new Error(mensaje);
            err.status = 400;
            cb(err);
        },
    });

    return (campo) => [
        receptor.single(campo),
        async (req, res, next) => {
            if (!req.file) return next();
            const extension = tipos[req.file.mimetype];
            if (!FIRMAS[extension](req.file.buffer)) {
                return res.status(400).json({ error: 'El archivo está dañado o no corresponde a su tipo.' });
            }
            try {
                req.file.url = await guardarArchivo(req.file, { carpeta, privado, extension });
                req.file.buffer = undefined; // liberar memoria
                next();
            } catch (err) {
                console.error('Error al guardar el archivo subido:', err.message);
                res.status(502).json({ error: 'No se pudo guardar el archivo. Inténtalo de nuevo.' });
            }
        },
    ];
}

module.exports = {
    subirFotoPerfil: crearSubida({ tipos: IMAGENES, maxMB: 5, carpeta: 'perfiles', mensaje: 'Solo se permiten imágenes JPG, PNG, GIF o WEBP.' }),
    subirImagenNoticia: crearSubida({ tipos: IMAGENES, maxMB: 5, carpeta: 'noticias', mensaje: 'Solo se permiten imágenes JPG, PNG, GIF o WEBP.' }),
    subirPdf: crearSubida({ tipos: PDF, maxMB: 10, carpeta: 'documentos', mensaje: 'Solo se permiten archivos PDF.' }),
    subirAdjuntoCenso: crearSubida({
        tipos: { ...IMAGENES, ...PDF }, maxMB: 8, carpeta: 'censo', privado: true,
        mensaje: 'Solo se permiten imágenes (JPG, PNG, GIF, WEBP) o archivos PDF.',
    }),
};
