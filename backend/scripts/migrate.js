// scripts/migrate.js - Carga el esquema inicial en una base de datos NUEVA.
//
// ADVERTENCIA: cada script SQL hace "DROP TABLE ... CASCADE" antes de crear
// la tabla, así que esto NUNCA debe correrse contra una base de datos que ya
// tenga datos reales (los borraría). Pensado para ejecutarse una sola vez,
// justo después de crear la base de datos (p. ej. en Render).
//
// Uso: npm run migrate   (lee las mismas DB_* / DB_SSL de .env)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const archivos = [
    'database.sql',
    'database_migracion_comunidad.sql',
    'database_migracion_censo.sql',
    'database_migracion_censo_vivienda.sql',
    'database_migracion_censo_hogar.sql',
];

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
    const raiz = path.join(__dirname, '../../');
    for (const archivo of archivos) {
        const ruta = path.join(raiz, archivo);
        const sql = fs.readFileSync(ruta, 'utf8').replace(/^CREATE DATABASE.*;$/im, '');
        console.log(`Aplicando ${archivo}...`);
        await pool.query(sql);
    }
    console.log('Esquema aplicado correctamente.');
    await pool.end();
}

main().catch(err => {
    console.error('Error aplicando el esquema:', err.message);
    process.exit(1);
});
