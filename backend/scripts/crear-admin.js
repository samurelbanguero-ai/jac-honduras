// scripts/crear-admin.js — Crea un administrador o cambia su contraseña.
//
// Uso:  npm run crear-admin -- <usuario> "<contraseña de al menos 12 caracteres>" ["Nombre visible"]
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function main() {
    const [usuario, contrasena, nombre = 'Administrador JAC'] = process.argv.slice(2);
    if (!usuario || !contrasena) {
        console.error('Uso: npm run crear-admin -- <usuario> "<contraseña>" ["Nombre"]');
        process.exit(1);
    }
    if (contrasena.length < 12) {
        console.error('La contraseña debe tener al menos 12 caracteres.');
        process.exit(1);
    }

    const { opcionesConexion } = require('../config/conexion');
    const pool = new Pool(opcionesConexion());

    const hash = await bcrypt.hash(contrasena, 12);
    const { rows } = await pool.query(
        `INSERT INTO admin (usuario, contrasena, nombre) VALUES ($1, $2, $3)
         ON CONFLICT (usuario) DO UPDATE SET contrasena = EXCLUDED.contrasena, nombre = EXCLUDED.nombre
         RETURNING (xmax = 0) AS creado`,
        [usuario, hash, nombre]
    );
    console.log(rows[0].creado ? `Administrador "${usuario}" creado.` : `Contraseña de "${usuario}" actualizada.`);
    await pool.end();
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
