// config/seguridad.js — Comprobaciones de seguridad al arrancar el servidor.
const bcrypt = require('bcryptjs');

const ES_PRODUCCION = process.env.NODE_ENV === 'production';

// Credenciales que venían en database.sql (públicas en el repositorio).
const CONTRASENA_ADMIN_POR_DEFECTO = 'admin123';
const CEDULAS_DEMO = ['1234567890', '0987654321', '1122334455'];

// Sin un JWT_SECRET fuerte cualquiera podría firmar tokens de administrador.
function verificarConfiguracion() {
    const secreto = process.env.JWT_SECRET || '';
    if (!secreto) {
        console.error('❌ Falta JWT_SECRET en las variables de entorno. El servidor no puede arrancar.');
        process.exit(1);
    }
    if (secreto.length < 32) {
        const msg = 'JWT_SECRET es demasiado corto (mínimo 32 caracteres). Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"';
        if (ES_PRODUCCION) {
            console.error(`❌ ${msg}`);
            process.exit(1);
        }
        console.warn(`⚠️  ${msg}`);
    }
    if (!process.env.JWT_EXPIRES) process.env.JWT_EXPIRES = '1h';
}

// ADMIN_PASSWORD (p. ej. en Render) es la contraseña del administrador: al
// arrancar, si el usuario no existe se crea, y si su contraseña es distinta se
// reemplaza por esta. Así se administra la clave desde el panel del hosting,
// sin necesitar consola ni acceso a la base de datos.
async function asegurarAdministrador(pool) {
    const usuario = (process.env.ADMIN_USUARIO || 'admin').trim();
    // Se quitan espacios o saltos de línea pegados por error al inicio o al final.
    const nueva = (process.env.ADMIN_PASSWORD || '').trim();

    try {
        const { rows } = await pool.query('SELECT id, contrasena FROM admin WHERE usuario = $1', [usuario]);
        const admin = rows[0];

        if (nueva) {
            if (nueva.length < 12) {
                console.warn(`⚠️  ADMIN_PASSWORD tiene ${nueva.length} caracteres; se necesitan al menos 12. No se aplicó.`);
                return;
            }
            if (!admin) {
                const hash = await bcrypt.hash(nueva, 12);
                await pool.query('INSERT INTO admin (usuario, contrasena, nombre) VALUES ($1, $2, $3)',
                    [usuario, hash, 'Administrador JAC']);
                console.log(`✅ Administrador "${usuario}" creado con ADMIN_PASSWORD.`);
                return;
            }
            if (await bcrypt.compare(nueva, admin.contrasena)) {
                console.log(`✅ El administrador "${usuario}" ya usa la contraseña de ADMIN_PASSWORD.`);
                return;
            }
            const hash = await bcrypt.hash(nueva, 12);
            await pool.query('UPDATE admin SET contrasena = $1 WHERE id = $2', [hash, admin.id]);
            console.log(`✅ Contraseña del administrador "${usuario}" actualizada con ADMIN_PASSWORD.`);
            return;
        }

        if (!admin) {
            console.warn(`⚠️  No existe el administrador "${usuario}". Define ADMIN_PASSWORD para crearlo.`);
        } else if (await bcrypt.compare(CONTRASENA_ADMIN_POR_DEFECTO, admin.contrasena)) {
            console.warn(ES_PRODUCCION
                ? `🚫 El administrador "${usuario}" tiene la contraseña por defecto. Su inicio de sesión está BLOQUEADO hasta que definas ADMIN_PASSWORD.`
                : `⚠️  El administrador "${usuario}" usa la contraseña por defecto (solo aceptable en desarrollo).`);
        }
    } catch (err) {
        // La tabla puede no existir todavía (base recién creada sin esquema).
        console.warn('⚠️  No se pudo comprobar el administrador:', err.message);
    }
}

// En producción se bloquea cualquier inicio de sesión con credenciales públicas.
function esCredencialPublica({ tipo, identificador, contrasena }) {
    if (!ES_PRODUCCION) return false;
    if (tipo === 'admin') return contrasena === CONTRASENA_ADMIN_POR_DEFECTO;
    if (tipo === 'afiliado') return CEDULAS_DEMO.includes(identificador) && contrasena === identificador;
    return false;
}

module.exports = { ES_PRODUCCION, verificarConfiguracion, asegurarAdministrador, esCredencialPublica };
