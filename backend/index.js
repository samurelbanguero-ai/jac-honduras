// index.js - Servidor principal JAC Honduras, Cauca
require('dotenv').config();

const { verificarConfiguracion, asegurarAdministrador, ES_PRODUCCION } = require('./config/seguridad');
verificarConfiguracion(); // Falla rápido si falta JWT_SECRET (antes de cargar rutas)

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const pool = require('./config/db');
const jwt = require('jsonwebtoken');
const { UPLOADS_DIR, cabecerasArchivoSubido } = require('./utils/archivos');
const { aplicarEsquemaSiFalta, aplicarMigracionesIdempotentes, migrarAdjuntosCensoLegados } = require('./scripts/migrate');

const esTokenAdmin = (req) => {
    const token = (req.headers.authorization || '').split(' ')[1];
    if (!token) return false;
    try { return jwt.verify(token, process.env.JWT_SECRET).rol === 'admin'; } catch { return false; }
};

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '../frontend');

// Render (y cualquier hosting con proxy inverso) reenvía la IP real del
// visitante en X-Forwarded-For. Sin esto, el límite de intentos se aplicaría a
// la IP del proxy y bloquearía a todos los usuarios a la vez.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? (ES_PRODUCCION ? 1 : 0)));

// ─── Cabeceras de seguridad ────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            // Las páginas usan scripts y manejadores inline: se permiten, pero solo
            // desde este mismo origen (sin CDNs ni dominios externos).
            'script-src': ["'self'", "'unsafe-inline'"],
            'script-src-attr': ["'unsafe-inline'"],
            'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            'font-src': ["'self'", 'https://fonts.gstatic.com'],
            'img-src': ["'self'", 'data:', 'blob:', 'https:'],
            'connect-src': ["'self'"],
            'frame-ancestors': ["'none'"],
            'form-action': ["'self'"],
            'upgrade-insecure-requests': ES_PRODUCCION ? [] : null,
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: ES_PRODUCCION,
}));

// El frontend se sirve desde este mismo servidor (mismo origen), así que
// por defecto no se habilita CORS. Solo se activa si se define CORS_ORIGIN.
if (process.env.CORS_ORIGIN) {
    app.use(cors({ origin: process.env.CORS_ORIGIN.split(',').map(o => o.trim()) }));
}
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

// ─── Límites de peticiones ─────────────────────────────────
const limitador = (max, minutos, mensaje) => rateLimit({
    windowMs: minutos * 60 * 1000,
    max,
    message: { error: mensaje },
    standardHeaders: true,
    legacyHeaders: false,
});

// Fuerza bruta en inicio de sesión: solo cuentan los intentos fallidos, así
// varias personas que entran desde el mismo wifi no se bloquean entre sí.
app.use(['/api/login', '/api/admin/login', '/api/afiliados/login'], rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: { error: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.' },
    standardHeaders: true,
    legacyHeaders: false,
}));
// Registros masivos / spam. No aplica al administrador (registra afiliados
// desde el panel) ni cuenta los formularios rechazados por validación.
app.post('/api/afiliados', rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    skipFailedRequests: true,
    skip: (req) => esTokenAdmin(req),
    message: { error: 'Demasiados registros desde esta conexión. Intenta más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
}));
// Recuperación de contraseña: evita usarla para enviar correos masivos
app.use('/api/recuperar', limitador(5, 15, 'Ya pediste varios enlaces. Espera 15 minutos y revisa tu correo (también la carpeta de spam).'));
app.use('/api/restablecer', limitador(20, 15, 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.'));
// Enumeración de cédulas a través de la verificación pública
app.use('/api/afiliados/verificar', limitador(30, 15, 'Demasiadas consultas. Intenta más tarde.'));
// Límite general de la API (excepto /api/ping)
const limiteGeneral = limitador(600, 15, 'Demasiadas peticiones. Intenta más tarde.');
app.use('/api', (req, res, next) => (req.path === '/ping' ? next() : limiteGeneral(req, res, next)));

// ─── Archivos estáticos ────────────────────────────────────
app.use(express.static(FRONTEND_DIR, { index: false, maxAge: ES_PRODUCCION ? '1h' : 0 }));
// Chart.js se sirve desde node_modules (antes venía de un CDN sin verificación de integridad)
const CHART_JS = path.join(path.dirname(require.resolve('chart.js')), 'chart.umd.min.js');
app.get('/vendor/chart.umd.min.js', (req, res) => res.sendFile(CHART_JS));

// Archivos subidos públicos (fotos de perfil, imágenes de noticias, actas).
// - Nunca se listan carpetas ni se sirve uploads/privado.
// - Los adjuntos antiguos del censo (subidos antes de existir uploads/privado)
//   se bloquean aquí: solo se ven mediante el enlace firmado de la API.
// - CSP "sandbox" + nosniff: un archivo malicioso no puede ejecutar scripts.
app.use('/uploads', async (req, res, next) => {
    // Se decodifica y normaliza igual que lo hará express.static, para que
    // variantes como %70rivado, //privado o nombres con espacios no evadan el filtro.
    let ruta;
    try {
        ruta = path.posix.normalize(decodeURIComponent(req.path));
    } catch {
        return res.status(400).end();
    }
    if (/^\/+privado(\/|$)/i.test(ruta) || ruta.includes('..')) return res.status(404).end();
    try {
        const { rows } = await pool.query(
            'SELECT 1 FROM censo_archivos WHERE archivo_url = $1 LIMIT 1',
            ['/uploads' + ruta.replace(/^\/+/, '/')]
        );
        if (rows.length) return res.status(404).end();
    } catch (err) {
        return next(err);
    }
    cabecerasArchivoSubido(res, ruta);
    next();
}, express.static(UPLOADS_DIR, { index: false, dotfiles: 'deny' }));

// ─── Rutas API ─────────────────────────────────────────────
app.use('/api', require('./routes/auth'));
app.use('/api/afiliados', require('./routes/afiliados'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/noticias', require('./routes/noticias'));
app.use('/api/comunidad', require('./routes/comunidad'));
app.use('/api/censo', require('./routes/censo'));

// Ruta liviana para servicios de "mantener despierto" (cron-job.org, UptimeRobot).
// No consulta la base de datos, así Neon puede apagarse cuando nadie usa el sitio.
app.get('/api/ping', (req, res) => res.type('text').send('ok'));

app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ estado: 'ok', database: 'conectada' });
    } catch (err) {
        console.error('Error de salud de PostgreSQL:', err.message);
        res.status(503).json({ estado: 'error', database: 'no disponible' });
    }
});

// ─── Rutas HTML ────────────────────────────────────────────
const pagina = (archivo) => (req, res) => res.sendFile(path.join(FRONTEND_DIR, archivo));
app.get('/', pagina('index.html'));
app.get('/login', pagina('pages/login.html'));
app.get('/registro', pagina('pages/registro.html'));
app.get('/recuperar', pagina('pages/recuperar.html'));
app.get('/restablecer', pagina('pages/restablecer.html'));
app.get('/usuario', pagina('pages/usuario.html'));
app.get('/verificar/:cedula', pagina('pages/verificar.html'));
app.get('/panel-jac-2024', pagina('pages/admin.html'));
app.get('/gestionar-censo', pagina('pages/censo-admin.html'));

// ─── 404 ───────────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((req, res) => res.status(404).sendFile(path.join(FRONTEND_DIR, 'index.html')));

// ─── Manejador global de errores ────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    if (err && err.name === 'MulterError') {
        return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE'
            ? 'El archivo supera el tamaño máximo permitido.'
            : 'Error al subir el archivo.' });
    }
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'La información enviada es demasiado grande.' });
    }
    if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Formato de datos inválido.' });
    }
    if (err && err.status && err.status < 500) {
        return res.status(err.status).json({ error: err.message });
    }
    console.error('Error no controlado:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
});

// ─── Iniciar servidor ──────────────────────────────────────
const servidor = app.listen(PORT, () => {
    console.log('\nJAC Honduras, Cauca - Sistema de Afiliados');
    console.log(`Servidor en http://localhost:${PORT} (${ES_PRODUCCION ? 'producción' : 'desarrollo'})`);
    aplicarEsquemaSiFalta(pool)
        .then(() => aplicarMigracionesIdempotentes(pool))
        .then(() => migrarAdjuntosCensoLegados(pool))
        .then(() => asegurarAdministrador(pool))
        .catch(err => console.error('Error preparando la base de datos:', err.message));
});

// Cierre ordenado (Render/Docker envían SIGTERM al redesplegar)
const cerrar = () => {
    servidor.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10000).unref();
};
process.on('SIGTERM', cerrar);
process.on('SIGINT', cerrar);

module.exports = app;
