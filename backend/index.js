// index.js - Servidor principal JAC Honduras, Cauca
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares ───────────────────────────────────────────
// El frontend se sirve desde este mismo servidor (mismo origen), así que
// por defecto no se habilita CORS. Solo se activa si se define CORS_ORIGIN
// en .env (por ejemplo, para servir el frontend desde otro dominio/puerto).
if (process.env.CORS_ORIGIN) {
    app.use(cors({ origin: process.env.CORS_ORIGIN }));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Límite de intentos para endpoints de login (protección contra fuerza bruta)
const limiteLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(['/api/login', '/api/admin/login', '/api/afiliados/login'], limiteLogin);

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Rutas API ─────────────────────────────────────────────
app.use('/api', require('./routes/auth'));
app.use('/api/afiliados', require('./routes/afiliados'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/noticias', require('./routes/noticias'));
app.use('/api/comunidad', require('./routes/comunidad'));
app.use('/api/censo', require('./routes/censo'));

// ─── Rutas HTML ────────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/login.html'));
});

app.get('/registro', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/registro.html'));
});

app.get('/usuario', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/usuario.html'));
});

app.get('/verificar/:cedula', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/verificar.html'));
});

app.get('/panel-jac-2024', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/admin.html'));
});

app.get('/gestionar-censo', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/censo-admin.html'));
});

// ─── Migración temporal de esquema (solo activa si MIGRATE_TOKEN está
// definida; pensada para usarse una vez al desplegar por primera vez y
// luego quitar esta ruta y la variable de entorno) ───────────────────
if (process.env.MIGRATE_TOKEN) {
    app.post('/api/_migrate', async (req, res) => {
        if (req.headers['x-migrate-token'] !== process.env.MIGRATE_TOKEN) {
            return res.status(403).json({ error: 'forbidden' });
        }
        try {
            const pool = require('./config/db');
            const { aplicarEsquema } = require('./scripts/migrate');
            await aplicarEsquema(pool);
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });
}

// ─── 404 para rutas de API no encontradas ───────────────────
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada.' });
});

// ─── Manejador global de errores ────────────────────────────
app.use((err, req, res, next) => {
    if (err && err.name === 'MulterError') {
        return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE'
            ? 'El archivo supera el tamaño máximo permitido (5 MB).'
            : 'Error al subir el archivo.' });
    }
    if (err && err.status) {
        return res.status(err.status).json({ error: err.message });
    }
    if (err) {
        console.error('Error no controlado:', err);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
    next();
});

// ─── Iniciar servidor ──────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🌿 JAC Honduras, Cauca - Sistema de Afiliados`);
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📋 API disponible en http://localhost:${PORT}/api`);
});
