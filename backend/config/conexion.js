// config/conexion.js — Opciones de conexión a PostgreSQL (sin abrir conexiones).
// Acepta DATABASE_URL (Neon, Supabase, Render...) o las variables DB_* por separado.
require('dotenv').config();

function opcionesConexion() {
    // Neon y la mayoría de Postgres administrados exigen SSL; en local no.
    const usaSsl = process.env.DB_SSL === 'true' || /sslmode=require/.test(process.env.DATABASE_URL || '');
    const base = {
        ssl: usaSsl ? { rejectUnauthorized: false } : false,
        max: Number(process.env.DB_POOL_MAX || 5),
        // Cierra conexiones ociosas para que Neon pueda apagarse y no gaste horas de cómputo.
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 15000, // Neon tarda unos segundos en despertar
    };
    if (process.env.DATABASE_URL) {
        // pg interpretaría sslmode=require como verificación estricta; se maneja arriba.
        const url = new URL(process.env.DATABASE_URL);
        url.searchParams.delete('sslmode');
        url.searchParams.delete('channel_binding');
        return { ...base, connectionString: url.toString() };
    }
    return {
        ...base,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    };
}

module.exports = { opcionesConexion };
