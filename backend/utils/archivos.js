// utils/archivos.js — Almacenamiento seguro de archivos subidos.
//
// Dos modos, elegidos automáticamente:
//  - Cloudinary (si existe CLOUDINARY_URL): recomendado en Render, cuyo disco
//    gratuito se borra en cada redespliegue.
//  - Disco local (backend/uploads): desarrollo local o servidores con disco propio.
//
// En ambos modos:
//  - Fotos de perfil, imágenes de noticias y actas son públicas.
//  - Los adjuntos del censo (fotos de la vivienda, documentos personales) son
//    PRIVADOS: nunca tienen una URL pública. El backend los entrega solo a través
//    de un enlace firmado y con vencimiento (/api/censo/archivos/:id/ver).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const PRIVADO_DIR = path.join(UPLOADS_DIR, 'privado');
for (const dir of [UPLOADS_DIR, PRIVADO_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const DURACION_ENLACE_MS = 30 * 60 * 1000; // 30 minutos
const CARPETA_CLOUDINARY = process.env.CLOUDINARY_FOLDER || 'jac-honduras';

let cloudinary = null;
if (process.env.CLOUDINARY_URL) {
    // El SDK lee CLOUDINARY_URL (cloudinary://API_KEY:API_SECRET@CLOUD_NAME) solo.
    cloudinary = require('cloudinary').v2;
    cloudinary.config({ secure: true });
}
const usaCloudinary = () => Boolean(cloudinary);

function nombreAleatorio(ext) {
    return `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
}

// ── Disco local ────────────────────────────────────────────

// Resuelve una URL local guardada en BD (/uploads/x.jpg o /privado/x.pdf) a una
// ruta de disco, impidiendo cualquier intento de salir de la carpeta de uploads.
function rutaDesdeUrl(url) {
    if (typeof url !== 'string') return null;
    let base;
    let nombre;
    if (url.startsWith('/uploads/')) {
        base = UPLOADS_DIR;
        nombre = url.slice('/uploads/'.length);
    } else if (url.startsWith('/privado/')) {
        base = PRIVADO_DIR;
        nombre = url.slice('/privado/'.length);
    } else {
        return null;
    }
    if (!nombre || nombre !== path.basename(nombre)) return null;
    return path.join(base, nombre);
}

// ── Cloudinary ─────────────────────────────────────────────
// Públicos: se guarda la secure_url (https://res.cloudinary.com/...).
// Privados: se guarda una referencia interna "cld:<resource_type>:<public_id>:<formato>"
// (tipo "authenticated": Cloudinary exige firma para entregarlos).

function subirACloudinary(buffer, { carpeta, privado, esPdf }) {
    return new Promise((resolve, reject) => {
        const flujo = cloudinary.uploader.upload_stream({
            folder: `${CARPETA_CLOUDINARY}/${carpeta}`,
            resource_type: esPdf ? 'raw' : 'image',
            type: privado ? 'authenticated' : 'upload',
            overwrite: false,
            // En archivos "raw" la extensión forma parte del public_id: así el enlace termina en .pdf
            ...(esPdf ? { public_id: nombreAleatorio('.pdf') } : { use_filename: false, unique_filename: true }),
        }, (err, resultado) => (err ? reject(err) : resolve(resultado)));
        flujo.end(buffer);
    });
}

function referenciaCloudinary(url) {
    if (typeof url !== 'string') return null;
    const privada = url.match(/^cld:(image|raw):([^:]+):([a-z0-9]*)$/i);
    if (privada) {
        return { resource_type: privada[1], public_id: privada[2], format: privada[3] || undefined, type: 'authenticated' };
    }
    // https://res.cloudinary.com/<cloud>/<resource_type>/upload/[v123/]<public_id>[.<ext>]
    const publica = url.match(/^https:\/\/res\.cloudinary\.com\/[^/]+\/(image|raw)\/upload\/(?:v\d+\/)?(.+)$/);
    if (publica) {
        const resource_type = publica[1];
        // En "image" el public_id no lleva extensión; en "raw" sí.
        const public_id = resource_type === 'image' ? publica[2].replace(/\.[a-z0-9]+$/i, '') : publica[2];
        return { resource_type, public_id, type: 'upload' };
    }
    return null;
}

// ── API común ──────────────────────────────────────────────

// Guarda el archivo recibido por multer (en memoria) y devuelve la URL o
// referencia que se almacena en la base de datos.
async function guardarArchivo(file, { carpeta, privado = false, extension }) {
    const esPdf = extension === '.pdf';
    if (usaCloudinary()) {
        const r = await subirACloudinary(file.buffer, { carpeta, privado, esPdf });
        return privado ? `cld:${r.resource_type}:${r.public_id}:${r.format || ''}` : r.secure_url;
    }
    const nombre = nombreAleatorio(extension);
    await fs.promises.writeFile(path.join(privado ? PRIVADO_DIR : UPLOADS_DIR, nombre), file.buffer, { flag: 'wx' });
    return `${privado ? '/privado/' : '/uploads/'}${nombre}`;
}

// Borra el archivo asociado a una URL guardada. Nunca lanza error: un fallo al
// borrar un archivo no debe impedir la operación principal.
function borrarArchivo(url) {
    const ruta = rutaDesdeUrl(url);
    if (ruta) {
        fs.promises.unlink(ruta).catch(() => {});
        return;
    }
    const ref = referenciaCloudinary(url);
    if (ref && usaCloudinary()) {
        cloudinary.uploader.destroy(ref.public_id, { resource_type: ref.resource_type, type: ref.type, invalidate: true })
            .catch(err => console.warn('No se pudo borrar el archivo en Cloudinary:', err.message));
    }
}

// Cabeceras para servir archivos subidos por usuarios.
// - Imágenes: CSP "sandbox" (aunque el archivo traiga código, no se ejecuta).
// - PDF: el visor de PDF de Chrome no funciona con "sandbox", así que se
//   impide incrustarlo en otros sitios y se confía en nosniff + tipo fijo.
function cabecerasArchivoSubido(res, nombre) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (/\.pdf$/i.test(nombre) || /^cld:raw:/i.test(nombre)) {
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    } else {
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    }
}

const TIPOS_SERVIDOS = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf' };

// Entrega un adjunto privado (ya autorizado por el enlace firmado).
async function servirArchivoPrivado(url, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    cabecerasArchivoSubido(res, url);

    const ruta = rutaDesdeUrl(url);
    if (ruta) {
        return res.sendFile(ruta, { dotfiles: 'deny' }, (err) => {
            if (err && !res.headersSent) res.status(404).json({ error: 'Archivo no encontrado.' });
        });
    }

    const ref = referenciaCloudinary(url);
    if (!ref || !usaCloudinary()) return res.status(404).json({ error: 'Archivo no encontrado.' });

    // URL firmada de Cloudinary: se descarga desde el servidor y se reenvía, así
    // el navegador nunca recibe un enlace permanente al archivo.
    const firmada = cloudinary.url(ref.public_id, {
        resource_type: ref.resource_type,
        type: ref.type,
        sign_url: true,
        secure: true,
        ...(ref.format && ref.resource_type === 'image' ? { format: ref.format } : {}),
    });
    const respuesta = await fetch(firmada);
    if (!respuesta.ok || !respuesta.body) return res.status(404).json({ error: 'Archivo no encontrado.' });

    const extension = (ref.format || path.extname(ref.public_id).slice(1) || '').toLowerCase();
    res.setHeader('Content-Type', TIPOS_SERVIDOS[extension] || respuesta.headers.get('content-type') || 'application/octet-stream');
    const largo = respuesta.headers.get('content-length');
    if (largo) res.setHeader('Content-Length', largo);
    Readable.fromWeb(respuesta.body).pipe(res);
}

// ── Enlaces firmados para adjuntos del censo ───────────────
function firma(id, exp) {
    return crypto
        .createHmac('sha256', process.env.JWT_SECRET)
        .update(`censo-archivo:${id}:${exp}`)
        .digest('hex');
}

function enlaceFirmadoCenso(id) {
    const exp = Date.now() + DURACION_ENLACE_MS;
    return `/api/censo/archivos/${id}/ver?exp=${exp}&sig=${firma(id, exp)}`;
}

function verificarFirmaCenso(id, exp, sig) {
    const expNum = Number(exp);
    if (!Number.isFinite(expNum) || expNum < Date.now() || typeof sig !== 'string') return false;
    const esperada = Buffer.from(firma(id, expNum), 'hex');
    const recibida = Buffer.from(sig, 'hex');
    return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
}

// ¿La referencia guardada corresponde a una imagen? (para previsualizar en el panel)
function esImagen(url) {
    if (/^cld:image:/i.test(url || '')) return true;
    if (/^cld:raw:/i.test(url || '')) return false;
    return /\.(jpe?g|png|gif|webp)$/i.test(url || '');
}

module.exports = {
    UPLOADS_DIR,
    PRIVADO_DIR,
    usaCloudinary,
    nombreAleatorio,
    rutaDesdeUrl,
    referenciaCloudinary,
    guardarArchivo,
    borrarArchivo,
    servirArchivoPrivado,
    cabecerasArchivoSubido,
    enlaceFirmadoCenso,
    verificarFirmaCenso,
    esImagen,
};
