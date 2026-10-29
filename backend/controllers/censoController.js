// controllers/censoController.js
// Censo comunitario: cada afiliado tiene, a lo sumo, un censo propio (su hogar).
// - Un afiliado solo puede ver/editar SU propio censo y los miembros de SU hogar
//   (rutas /mio, siempre atadas a req.admin.id).
// - Solo el admin puede listar, filtrar, ver el detalle de cualquiera, editar,
//   eliminar y marcar la revisión.
const pool = require('../config/db');

const CAMPOS_CENSO = [
    // Datos personales del titular
    'nombres', 'apellidos', 'tipo_documento', 'numero_documento', 'fecha_nacimiento',
    'sexo', 'estado_civil', 'etnia', 'discapacidad',
    // Ubicación y vivienda
    'direccion', 'barrio_vereda', 'ciudad_municipio', 'zona_vivienda', 'tipo_vivienda',
    'personas_hogar', 'familias_hogar',
    // Materiales de construcción
    'material_paredes', 'material_piso', 'material_techo',
    // Servicios básicos
    'acceso_agua_potable', 'fuente_agua', 'acceso_electricidad', 'acceso_gas', 'sistema_excretas',
    'acceso_recoleccion_residuos', 'acceso_telefonia',
    // Tecnología
    'tecnologia_disponible',
    // Salud (nivel hogar)
    'acceso_servicios_salud',
    // Actividad económica familiar y movilidad
    'actividades_economicas_familia', 'personas_ausentes', 'motivo_ausencia', 'retorno_reciente',
    // Necesidades prioritarias
    'necesidades_prioritarias',
    // Contacto
    'telefono', 'correo',
    // Información socioeconómica del titular
    'nivel_educativo', 'ocupacion', 'observaciones'
];
// Columnas que además de CAMPOS_CENSO se guardan en cada INSERT/UPDATE del censo.
const CAMPOS_CENSO_COMPLETOS = [...CAMPOS_CENSO, 'autorizacion'];

function limpiarDatosCenso(body) {
    const datos = {};
    CAMPOS_CENSO.forEach(campo => {
        let valor = body[campo];
        if (typeof valor === 'string') valor = valor.trim() || null;
        if (valor === undefined || valor === '') valor = null;
        datos[campo] = valor;
    });
    // tipo_documento es NOT NULL en la BD; un NULL explícito no activa el DEFAULT de la columna.
    if (!datos.tipo_documento) datos.tipo_documento = 'Cedula de Ciudadania';
    // Autorización: reemplaza la firma física del formato en papel. Se exige explícitamente.
    datos.autorizacion = body.autorizacion === true || body.autorizacion === 'true' || body.autorizacion === 'on';
    return datos;
}

function validarCenso(datos) {
    if (!datos.nombres || !datos.apellidos || !datos.numero_documento ||
        !datos.fecha_nacimiento || !datos.sexo || !datos.ciudad_municipio) {
        return 'Nombres, apellidos, número de documento, fecha de nacimiento, sexo y ciudad/municipio son obligatorios.';
    }
    if (datos.personas_hogar !== null && (isNaN(datos.personas_hogar) || Number(datos.personas_hogar) < 1)) {
        return 'El número de personas en el hogar debe ser un número positivo.';
    }
    if (datos.familias_hogar !== null && (isNaN(datos.familias_hogar) || Number(datos.familias_hogar) < 1)) {
        return 'El número de familias en el hogar debe ser un número positivo.';
    }
    if (!datos.autorizacion) {
        return 'Debes autorizar el uso de esta información para continuar.';
    }
    return null;
}

// ════════════════════════════════════════════════════════════
// AFILIADO — Su propio censo (nunca el de otra persona)
// ════════════════════════════════════════════════════════════

// GET /censo/mio (afiliado)
const obtenerMiCenso = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM censos WHERE afiliado_id = $1', [req.admin.id]);
        res.json({ censo: result.rows[0] || null });
    } catch (err) {
        console.error('Error al obtener el censo:', err);
        res.status(500).json({ error: 'Error al obtener tu censo.' });
    }
};

// POST /censo/mio (afiliado) — crea o actualiza (upsert): un solo censo por afiliado
const guardarMiCenso = async (req, res) => {
    const datos = limpiarDatosCenso(req.body);
    const errorValidacion = validarCenso(datos);
    if (errorValidacion) {
        return res.status(400).json({ error: errorValidacion });
    }

    try {
        const valores = CAMPOS_CENSO_COMPLETOS.map(c => datos[c]);
        const placeholders = CAMPOS_CENSO_COMPLETOS.map((_, i) => `$${i + 2}`).join(', ');
        const asignaciones = CAMPOS_CENSO_COMPLETOS.map(c => `${c} = EXCLUDED.${c}`).join(', ');

        const result = await pool.query(
            `INSERT INTO censos (afiliado_id, ${CAMPOS_CENSO_COMPLETOS.join(', ')})
             VALUES ($1, ${placeholders})
             ON CONFLICT (afiliado_id) DO UPDATE SET ${asignaciones}, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [req.admin.id, ...valores]
        );
        res.json({ mensaje: 'Tu censo fue guardado correctamente.', censo: result.rows[0] });
    } catch (err) {
        console.error('Error al guardar el censo:', err);
        res.status(500).json({ error: 'Error al guardar tu censo.' });
    }
};

// ════════════════════════════════════════════════════════════
// ADMIN — Listado, filtros, detalle, edición, eliminación y revisión
// ════════════════════════════════════════════════════════════

// GET /censo (admin) — columnas limitadas: el detalle sensible solo se expone al abrir uno individual
const listarCensos = async (req, res) => {
    const { nombre, documento, ciudad, sexo, ocupacion, fecha_desde, fecha_hasta, estado_revision } = req.query;
    const condiciones = [];
    const valores = [];

    if (nombre) {
        valores.push(`%${nombre.toLowerCase()}%`);
        condiciones.push(`LOWER(nombres || ' ' || apellidos) LIKE $${valores.length}`);
    }
    if (documento) {
        valores.push(`%${documento}%`);
        condiciones.push(`numero_documento LIKE $${valores.length}`);
    }
    if (ciudad) {
        valores.push(`%${ciudad.toLowerCase()}%`);
        condiciones.push(`LOWER(ciudad_municipio) LIKE $${valores.length}`);
    }
    if (sexo) {
        valores.push(sexo);
        condiciones.push(`sexo = $${valores.length}`);
    }
    if (ocupacion) {
        valores.push(`%${ocupacion.toLowerCase()}%`);
        condiciones.push(`LOWER(ocupacion) LIKE $${valores.length}`);
    }
    if (fecha_desde) {
        valores.push(fecha_desde);
        condiciones.push(`created_at::date >= $${valores.length}`);
    }
    if (fecha_hasta) {
        valores.push(fecha_hasta);
        condiciones.push(`created_at::date <= $${valores.length}`);
    }
    if (estado_revision) {
        valores.push(estado_revision);
        condiciones.push(`estado_revision = $${valores.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    try {
        const result = await pool.query(
            `SELECT id, afiliado_id, nombres, apellidos, numero_documento, sexo,
                    ciudad_municipio, ocupacion, estado_revision, created_at,
                    (SELECT COUNT(*) FROM censo_miembros_hogar m WHERE m.censo_id = censos.id AND m.vive_aqui = true)::int AS total_miembros
             FROM censos ${where}
             ORDER BY created_at DESC`,
            valores
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error al listar censos:', err);
        res.status(500).json({ error: 'Error al obtener el listado de censos.' });
    }
};

// GET /censo/estadisticas (admin)
// Las distribuciones por sexo/edad/nivel educativo/ocupación combinan al titular
// con los miembros del hogar (que sí "viven aquí"), para reflejar población real.
const obtenerEstadisticas = async (req, res) => {
    try {
        const [
            totales, porSexo, porEdad, porCiudad, porOcupacion, porNivelEducativo,
            promedioHogar, porNecesidad, conDiscapacidad
        ] = await Promise.all([
            pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM censos)::int AS total_hogares,
                    (SELECT COUNT(*) FROM censos)::int
                        + (SELECT COUNT(*) FROM censo_miembros_hogar WHERE vive_aqui = true)::int AS total_personas
            `),
            pool.query(`
                SELECT sexo, COUNT(*)::int AS total FROM (
                    SELECT sexo FROM censos
                    UNION ALL
                    SELECT sexo FROM censo_miembros_hogar WHERE vive_aqui = true
                ) todas
                GROUP BY sexo ORDER BY total DESC
            `),
            pool.query(`
                SELECT rango, COUNT(*)::int AS total FROM (
                    SELECT CASE
                        WHEN DATE_PART('year', AGE(fecha_nacimiento)) < 18 THEN '0-17'
                        WHEN DATE_PART('year', AGE(fecha_nacimiento)) < 30 THEN '18-29'
                        WHEN DATE_PART('year', AGE(fecha_nacimiento)) < 45 THEN '30-44'
                        WHEN DATE_PART('year', AGE(fecha_nacimiento)) < 60 THEN '45-59'
                        ELSE '60+'
                    END AS rango
                    FROM (
                        SELECT fecha_nacimiento FROM censos
                        UNION ALL
                        SELECT fecha_nacimiento FROM censo_miembros_hogar
                        WHERE vive_aqui = true AND fecha_nacimiento IS NOT NULL
                    ) edades
                ) sub
                GROUP BY rango
            `),
            pool.query('SELECT ciudad_municipio, COUNT(*)::int AS total FROM censos GROUP BY ciudad_municipio ORDER BY total DESC'),
            pool.query(`
                SELECT COALESCE(NULLIF(ocupacion, ''), 'No registrado') AS ocupacion, COUNT(*)::int AS total FROM (
                    SELECT ocupacion FROM censos
                    UNION ALL
                    SELECT actividad_economica AS ocupacion FROM censo_miembros_hogar
                    WHERE vive_aqui = true AND trabaja_actualmente = 'Si'
                ) todas
                GROUP BY ocupacion ORDER BY total DESC LIMIT 10
            `),
            pool.query(`
                SELECT COALESCE(NULLIF(nivel_educativo, ''), 'No registrado') AS nivel_educativo, COUNT(*)::int AS total FROM (
                    SELECT nivel_educativo FROM censos
                    UNION ALL
                    SELECT nivel_educativo FROM censo_miembros_hogar WHERE vive_aqui = true
                ) todas
                GROUP BY nivel_educativo ORDER BY total DESC
            `),
            pool.query(`
                SELECT AVG(cnt)::numeric(10,1) AS promedio FROM (
                    SELECT c.id, 1 + COUNT(m.id) FILTER (WHERE m.vive_aqui = true) AS cnt
                    FROM censos c LEFT JOIN censo_miembros_hogar m ON m.censo_id = c.id
                    GROUP BY c.id
                ) sub
            `),
            pool.query(`
                SELECT necesidad, COUNT(*)::int AS total FROM (
                    SELECT TRIM(unnest(string_to_array(necesidades_prioritarias, ','))) AS necesidad
                    FROM censos WHERE necesidades_prioritarias IS NOT NULL AND necesidades_prioritarias <> ''
                ) sub
                WHERE necesidad <> ''
                GROUP BY necesidad ORDER BY total DESC
            `),
            pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM censos WHERE discapacidad IS NOT NULL AND discapacidad NOT IN ('', 'Ninguna'))::int
                    + (SELECT COUNT(*) FROM censo_miembros_hogar WHERE vive_aqui = true AND tiene_discapacidad = 'Si')::int
                    AS total
            `)
        ]);

        res.json({
            total_hogares: totales.rows[0].total_hogares,
            total: totales.rows[0].total_personas,
            por_sexo: porSexo.rows,
            por_edad: porEdad.rows,
            por_ciudad: porCiudad.rows,
            por_ocupacion: porOcupacion.rows,
            por_nivel_educativo: porNivelEducativo.rows,
            por_necesidad: porNecesidad.rows,
            promedio_personas_hogar: Number(promedioHogar.rows[0].promedio) || 0,
            total_con_discapacidad: conDiscapacidad.rows[0].total
        });
    } catch (err) {
        console.error('Error al obtener estadísticas del censo:', err);
        res.status(500).json({ error: 'Error al obtener las estadísticas.' });
    }
};

// GET /censo/:id (admin)
const obtenerCensoPorId = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, a.cedula AS afiliado_cedula
             FROM censos c JOIN afiliados a ON a.id = c.afiliado_id
             WHERE c.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Censo no encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener el censo:', err);
        res.status(500).json({ error: 'Error al obtener el censo.' });
    }
};

// PUT /censo/:id (admin)
const actualizarCenso = async (req, res) => {
    const { id } = req.params;
    const datos = limpiarDatosCenso(req.body);
    const errorValidacion = validarCenso(datos);
    if (errorValidacion) {
        return res.status(400).json({ error: errorValidacion });
    }

    try {
        const valores = CAMPOS_CENSO_COMPLETOS.map(c => datos[c]);
        const asignaciones = CAMPOS_CENSO_COMPLETOS.map((c, i) => `${c} = $${i + 1}`).join(', ');

        const result = await pool.query(
            `UPDATE censos SET ${asignaciones}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${CAMPOS_CENSO_COMPLETOS.length + 1} RETURNING *`,
            [...valores, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Censo no encontrado.' });
        }
        res.json({ mensaje: 'Censo actualizado correctamente.', censo: result.rows[0] });
    } catch (err) {
        console.error('Error al actualizar el censo:', err);
        res.status(500).json({ error: 'Error al actualizar el censo.' });
    }
};

// DELETE /censo/:id (admin)
const eliminarCenso = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM censos WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Censo no encontrado.' });
        }
        res.json({ mensaje: 'Censo eliminado correctamente.' });
    } catch (err) {
        console.error('Error al eliminar el censo:', err);
        res.status(500).json({ error: 'Error al eliminar el censo.' });
    }
};

// PUT /censo/:id/revision (admin) — reemplaza la firma de "autoridad/comité" del papel
const marcarRevisionCenso = async (req, res) => {
    const { estado } = req.body;
    if (!['Pendiente', 'Revisado'].includes(estado)) {
        return res.status(400).json({ error: 'Estado de revisión inválido.' });
    }
    const esRevisado = estado === 'Revisado';
    try {
        const result = await pool.query(
            `UPDATE censos SET estado_revision = $1, revisado_por = $2, revisado_en = $3
             WHERE id = $4 RETURNING *`,
            [estado, esRevisado ? req.admin.id : null, esRevisado ? new Date() : null, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Censo no encontrado.' });
        }
        res.json({ mensaje: `Censo marcado como "${estado}".`, censo: result.rows[0] });
    } catch (err) {
        console.error('Error al actualizar la revisión del censo:', err);
        res.status(500).json({ error: 'Error al actualizar la revisión del censo.' });
    }
};

// ════════════════════════════════════════════════════════════
// MIEMBROS DEL HOGAR (todas las personas que viven en la vivienda)
// ════════════════════════════════════════════════════════════
const CAMPOS_MIEMBRO = [
    'nombre_completo', 'parentesco', 'sexo', 'fecha_nacimiento', 'estado_civil', 'vive_aqui',
    'sabe_leer_escribir', 'nivel_educativo', 'estudia_actualmente', 'institucion_educativa',
    'tiene_discapacidad', 'tipo_discapacidad', 'habla_lengua_propia', 'participa_actividades_culturales',
    'trabaja_actualmente', 'actividad_economica', 'lugar_trabajo'
];

function limpiarDatosMiembro(body) {
    const datos = {};
    CAMPOS_MIEMBRO.forEach(campo => {
        if (campo === 'vive_aqui') {
            datos[campo] = !(body[campo] === false || body[campo] === 'false' || body[campo] === '0');
            return;
        }
        let valor = body[campo];
        if (typeof valor === 'string') valor = valor.trim() || null;
        if (valor === undefined || valor === '') valor = null;
        datos[campo] = valor;
    });
    return datos;
}

function validarMiembro(datos) {
    if (!datos.nombre_completo || !datos.parentesco || !datos.sexo) {
        return 'Nombre completo, parentesco y sexo son obligatorios.';
    }
    return null;
}

// GET /censo/mio/miembros (afiliado)
const listarMisMiembrosHogar = async (req, res) => {
    try {
        const censo = await pool.query('SELECT id FROM censos WHERE afiliado_id = $1', [req.admin.id]);
        if (censo.rows.length === 0) return res.json([]);

        const result = await pool.query(
            'SELECT * FROM censo_miembros_hogar WHERE censo_id = $1 ORDER BY created_at ASC',
            [censo.rows[0].id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error al listar miembros del hogar:', err);
        res.status(500).json({ error: 'Error al obtener los miembros de tu hogar.' });
    }
};

// POST /censo/mio/miembros (afiliado) — requiere tener un censo guardado previamente
const agregarMiMiembroHogar = async (req, res) => {
    const datos = limpiarDatosMiembro(req.body);
    const errorValidacion = validarMiembro(datos);
    if (errorValidacion) {
        return res.status(400).json({ error: errorValidacion });
    }

    try {
        const censo = await pool.query('SELECT id FROM censos WHERE afiliado_id = $1', [req.admin.id]);
        if (censo.rows.length === 0) {
            return res.status(400).json({ error: 'Primero debes guardar tu censo antes de agregar miembros del hogar.' });
        }

        const valores = CAMPOS_MIEMBRO.map(c => datos[c]);
        const placeholders = CAMPOS_MIEMBRO.map((_, i) => `$${i + 2}`).join(', ');
        const result = await pool.query(
            `INSERT INTO censo_miembros_hogar (censo_id, ${CAMPOS_MIEMBRO.join(', ')})
             VALUES ($1, ${placeholders}) RETURNING *`,
            [censo.rows[0].id, ...valores]
        );
        res.status(201).json({ mensaje: 'Miembro del hogar agregado correctamente.', miembro: result.rows[0] });
    } catch (err) {
        console.error('Error al agregar miembro del hogar:', err);
        res.status(500).json({ error: 'Error al agregar el miembro del hogar.' });
    }
};

// PUT /censo/mio/miembros/:id (afiliado) — solo si el miembro pertenece a SU censo
const actualizarMiMiembroHogar = async (req, res) => {
    const datos = limpiarDatosMiembro(req.body);
    const errorValidacion = validarMiembro(datos);
    if (errorValidacion) {
        return res.status(400).json({ error: errorValidacion });
    }

    try {
        const valores = CAMPOS_MIEMBRO.map(c => datos[c]);
        const asignaciones = CAMPOS_MIEMBRO.map((c, i) => `${c} = $${i + 1}`).join(', ');
        const result = await pool.query(
            `UPDATE censo_miembros_hogar cm SET ${asignaciones}, updated_at = CURRENT_TIMESTAMP
             FROM censos c
             WHERE cm.id = $${CAMPOS_MIEMBRO.length + 1} AND cm.censo_id = c.id AND c.afiliado_id = $${CAMPOS_MIEMBRO.length + 2}
             RETURNING cm.*`,
            [...valores, req.params.id, req.admin.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Miembro no encontrado.' });
        }
        res.json({ mensaje: 'Miembro actualizado correctamente.', miembro: result.rows[0] });
    } catch (err) {
        console.error('Error al actualizar miembro del hogar:', err);
        res.status(500).json({ error: 'Error al actualizar el miembro del hogar.' });
    }
};

// DELETE /censo/mio/miembros/:id (afiliado) — solo si pertenece a SU censo
const eliminarMiMiembroHogar = async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM censo_miembros_hogar cm USING censos c
             WHERE cm.id = $1 AND cm.censo_id = c.id AND c.afiliado_id = $2
             RETURNING cm.id`,
            [req.params.id, req.admin.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Miembro no encontrado.' });
        }
        res.json({ mensaje: 'Miembro eliminado correctamente.' });
    } catch (err) {
        console.error('Error al eliminar miembro del hogar:', err);
        res.status(500).json({ error: 'Error al eliminar el miembro del hogar.' });
    }
};

// GET /censo/:id/miembros (admin) — miembros de cualquier hogar
const listarMiembrosHogarAdmin = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM censo_miembros_hogar WHERE censo_id = $1 ORDER BY created_at ASC',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error al listar miembros del hogar:', err);
        res.status(500).json({ error: 'Error al obtener los miembros del hogar.' });
    }
};

// DELETE /censo/miembros/:id (admin) — moderación: puede eliminar cualquier miembro
const eliminarMiembroHogarAdmin = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM censo_miembros_hogar WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Miembro no encontrado.' });
        }
        res.json({ mensaje: 'Miembro eliminado correctamente.' });
    } catch (err) {
        console.error('Error al eliminar miembro del hogar:', err);
        res.status(500).json({ error: 'Error al eliminar el miembro del hogar.' });
    }
};

// ════════════════════════════════════════════════════════════
// ARCHIVOS ADJUNTOS (fotos, documentos de la vivienda/censo)
// ════════════════════════════════════════════════════════════
const TIPOS_ARCHIVO_VALIDOS = ['Vivienda', 'Documento', 'Otro'];

// GET /censo/mio/archivos (afiliado)
const listarMisArchivosCenso = async (req, res) => {
    try {
        const censo = await pool.query('SELECT id FROM censos WHERE afiliado_id = $1', [req.admin.id]);
        if (censo.rows.length === 0) return res.json([]);

        const result = await pool.query(
            `SELECT id, nombre_original, archivo_url, tipo, created_at
             FROM censo_archivos WHERE censo_id = $1 ORDER BY created_at DESC`,
            [censo.rows[0].id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error al listar archivos del censo:', err);
        res.status(500).json({ error: 'Error al obtener tus archivos.' });
    }
};

// POST /censo/mio/archivos (afiliado) — requiere tener un censo guardado previamente
const subirMiArchivoCenso = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }
    try {
        const censo = await pool.query('SELECT id FROM censos WHERE afiliado_id = $1', [req.admin.id]);
        if (censo.rows.length === 0) {
            return res.status(400).json({ error: 'Primero debes guardar tu censo antes de adjuntar archivos.' });
        }

        const tipo = TIPOS_ARCHIVO_VALIDOS.includes(req.body.tipo) ? req.body.tipo : 'Otro';
        const archivo_url = '/uploads/' + req.file.filename;

        const result = await pool.query(
            `INSERT INTO censo_archivos (censo_id, nombre_original, archivo_url, tipo)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [censo.rows[0].id, req.file.originalname, archivo_url, tipo]
        );
        res.status(201).json({ mensaje: 'Archivo adjuntado correctamente.', archivo: result.rows[0] });
    } catch (err) {
        console.error('Error al subir archivo del censo:', err);
        res.status(500).json({ error: 'Error al subir el archivo.' });
    }
};

// DELETE /censo/mio/archivos/:id (afiliado) — solo si el archivo pertenece a SU censo
const eliminarMiArchivoCenso = async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM censo_archivos ca USING censos c
             WHERE ca.id = $1 AND ca.censo_id = c.id AND c.afiliado_id = $2
             RETURNING ca.id`,
            [req.params.id, req.admin.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Archivo no encontrado.' });
        }
        res.json({ mensaje: 'Archivo eliminado correctamente.' });
    } catch (err) {
        console.error('Error al eliminar archivo del censo:', err);
        res.status(500).json({ error: 'Error al eliminar el archivo.' });
    }
};

// GET /censo/:id/archivos (admin) — archivos de cualquier censo
const listarArchivosCensoAdmin = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, nombre_original, archivo_url, tipo, created_at
             FROM censo_archivos WHERE censo_id = $1 ORDER BY created_at DESC`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error al listar archivos del censo:', err);
        res.status(500).json({ error: 'Error al obtener los archivos.' });
    }
};

// DELETE /censo/archivos/:id (admin) — moderación: puede eliminar cualquier archivo
const eliminarArchivoCensoAdmin = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM censo_archivos WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Archivo no encontrado.' });
        }
        res.json({ mensaje: 'Archivo eliminado correctamente.' });
    } catch (err) {
        console.error('Error al eliminar archivo:', err);
        res.status(500).json({ error: 'Error al eliminar el archivo.' });
    }
};

module.exports = {
    obtenerMiCenso,
    guardarMiCenso,
    listarCensos,
    obtenerEstadisticas,
    obtenerCensoPorId,
    actualizarCenso,
    eliminarCenso,
    marcarRevisionCenso,
    listarMisMiembrosHogar,
    agregarMiMiembroHogar,
    actualizarMiMiembroHogar,
    eliminarMiMiembroHogar,
    listarMiembrosHogarAdmin,
    eliminarMiembroHogarAdmin,
    listarMisArchivosCenso,
    subirMiArchivoCenso,
    eliminarMiArchivoCenso,
    listarArchivosCensoAdmin,
    eliminarArchivoCensoAdmin
};
