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

const archivos = [
    'database.sql',
    'database_migracion_comunidad.sql',
    'database_migracion_censo.sql',
    'database_migracion_censo_vivienda.sql',
    'database_migracion_censo_hogar.sql',
    'database_migracion_recuperacion.sql',
    'database_migracion_aprobacion.sql',
];

// Migraciones idempotentes (CREATE ... IF NOT EXISTS) que se aplican en cada
// arranque, para que una base existente reciba las tablas nuevas sin borrar nada.
const MIGRACIONES_IDEMPOTENTES = ['database_migracion_recuperacion.sql', 'database_migracion_aprobacion.sql'];

async function aplicarMigracionesIdempotentes(pool) {
    const raiz = path.join(__dirname, '../../');
    for (const archivo of MIGRACIONES_IDEMPOTENTES) {
        await pool.query(fs.readFileSync(path.join(raiz, archivo), 'utf8'));
    }
}

async function aplicarEsquema(pool) {
    const raiz = path.join(__dirname, '../../');
    for (const archivo of archivos) {
        const ruta = path.join(raiz, archivo);
        const sql = fs.readFileSync(ruta, 'utf8').replace(/^CREATE DATABASE.*;$/im, '');
        console.log(`Aplicando ${archivo}...`);
        await pool.query(sql);
    }
    console.log('Esquema aplicado correctamente.');
}

// Al arrancar: si la base está vacía (no existe la tabla admin), aplica el
// esquema completo. Si ya hay tablas NO hace nada, porque los scripts SQL
// borran las tablas antes de crearlas. Así Render (sin consola en el plan
// gratuito) queda listo en el primer despliegue.
async function aplicarEsquemaSiFalta(pool) {
    const { rows } = await pool.query("SELECT to_regclass('public.admin') IS NOT NULL AS existe");
    if (rows[0].existe) return false;
    console.log('Base de datos vacía: aplicando el esquema inicial...');
    await aplicarEsquema(pool);
    return true;
}

// Mueve a uploads/privado los adjuntos del censo subidos antes de existir esa
// carpeta (guardados como /uploads/...), para que dejen de ser públicos.
async function migrarAdjuntosCensoLegados(pool) {
    const { rutaDesdeUrl, PRIVADO_DIR, nombreAleatorio } = require('../utils/archivos');
    const { rows } = await pool.query("SELECT id, archivo_url FROM censo_archivos WHERE archivo_url LIKE '/uploads/%'");
    let movidos = 0;
    for (const fila of rows) {
        const origen = rutaDesdeUrl(fila.archivo_url);
        const nombre = nombreAleatorio(path.extname(fila.archivo_url).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin');
        const destino = path.join(PRIVADO_DIR, nombre);
        try {
            if (origen && fs.existsSync(origen)) await fs.promises.rename(origen, destino);
            await pool.query('UPDATE censo_archivos SET archivo_url = $1 WHERE id = $2', ['/privado/' + nombre, fila.id]);
            movidos++;
        } catch (err) {
            console.warn(`No se pudo mover el adjunto ${fila.id}:`, err.message);
        }
    }
    if (movidos) console.log(`Adjuntos del censo protegidos: ${movidos} movidos a uploads/privado.`);
}

module.exports = { aplicarEsquema, aplicarEsquemaSiFalta, aplicarMigracionesIdempotentes, migrarAdjuntosCensoLegados };

if (require.main === module) {
    const { Pool } = require('pg');
    const { opcionesConexion } = require('../config/conexion');
    const pool = new Pool(opcionesConexion());
    aplicarEsquema(pool)
        .then(() => pool.end())
        .catch(err => {
            console.error('Error aplicando el esquema:', err.message);
            process.exit(1);
        });
}
