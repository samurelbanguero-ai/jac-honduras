// config/db.js - Conexión a PostgreSQL
const { Pool } = require('pg');
const { opcionesConexion } = require('./conexion');

const pool = new Pool(opcionesConexion());

// Un error en una conexión ociosa (p. ej. Neon se apagó) no debe tumbar el servidor.
pool.on('error', (err) => console.warn('Conexión a PostgreSQL cerrada:', err.message));

// Verificar conexión al iniciar
pool.query('SELECT 1')
    .then(() => console.log('✅ Conectado a PostgreSQL'))
    .catch((err) => console.error('❌ Error conectando a PostgreSQL:', err.message));

module.exports = pool;
