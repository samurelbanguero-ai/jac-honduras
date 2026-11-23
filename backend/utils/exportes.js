// utils/exportes.js — Descargas para el administrador:
//  - Excel con la lista de afiliados.
//  - Excel del censo (hogares, miembros del hogar y resumen).
//  - Ficha individual del censo en PDF, lista para imprimir o archivar.
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const VERDE = '0A4325';
const VERDE_CLARO = 'E7EFE9';
const DORADO = 'D4AF37';
const LOGO = path.join(__dirname, '../../frontend/img/logo.png');

// ── Etiquetas legibles de cada campo ───────────────────────
const SECCIONES_CENSO = [
    ['Datos personales', [
        ['nombres', 'Nombres'], ['apellidos', 'Apellidos'], ['tipo_documento', 'Tipo de documento'],
        ['numero_documento', 'Número de documento'], ['fecha_nacimiento', 'Fecha de nacimiento'], ['sexo', 'Sexo'],
        ['estado_civil', 'Estado civil'], ['etnia', 'Grupo étnico'], ['discapacidad', 'Discapacidad'],
    ]],
    ['Ubicación y vivienda', [
        ['direccion', 'Dirección'], ['barrio_vereda', 'Barrio / vereda'], ['ciudad_municipio', 'Ciudad / municipio'],
        ['zona_vivienda', 'Zona'], ['tipo_vivienda', 'Tipo de vivienda'], ['personas_hogar', 'Personas en el hogar'],
        ['familias_hogar', 'Familias en el hogar'],
    ]],
    ['Materiales de construcción', [
        ['material_paredes', 'Paredes'], ['material_piso', 'Piso'], ['material_techo', 'Techo'],
    ]],
    ['Servicios básicos y tecnología', [
        ['acceso_agua_potable', 'Agua potable'], ['fuente_agua', 'Fuente de agua'], ['acceso_electricidad', 'Electricidad'],
        ['acceso_gas', 'Gas'], ['sistema_excretas', 'Sistema de excretas'], ['acceso_recoleccion_residuos', 'Recolección de basuras'],
        ['acceso_telefonia', 'Telefonía'], ['tecnologia_disponible', 'Tecnología disponible'],
    ]],
    ['Salud, actividad económica y movilidad', [
        ['acceso_servicios_salud', 'Servicios de salud'], ['actividades_economicas_familia', 'Actividades económicas de la familia'],
        ['personas_ausentes', 'Personas ausentes'], ['motivo_ausencia', 'Motivo de ausencia'], ['retorno_reciente', 'Retorno reciente'],
    ]],
    ['Necesidades prioritarias', [['necesidades_prioritarias', 'Necesidades prioritarias']]],
    ['Contacto', [['telefono', 'Teléfono'], ['correo', 'Correo']]],
    ['Información socioeconómica', [
        ['nivel_educativo', 'Nivel educativo'], ['ocupacion', 'Ocupación'], ['observaciones', 'Observaciones'],
    ]],
];

const CAMPOS_MIEMBRO = [
    ['nombre_completo', 'Nombre completo'], ['parentesco', 'Parentesco'], ['sexo', 'Sexo'],
    ['fecha_nacimiento', 'Fecha de nacimiento'], ['estado_civil', 'Estado civil'], ['vive_aqui', 'Vive en el hogar'],
    ['sabe_leer_escribir', 'Sabe leer y escribir'], ['nivel_educativo', 'Nivel educativo'],
    ['estudia_actualmente', 'Estudia actualmente'], ['institucion_educativa', 'Institución educativa'],
    ['tiene_discapacidad', 'Tiene discapacidad'], ['tipo_discapacidad', 'Tipo de discapacidad'],
    ['habla_lengua_propia', 'Habla lengua propia'], ['participa_actividades_culturales', 'Actividades culturales'],
    ['trabaja_actualmente', 'Trabaja actualmente'], ['actividad_economica', 'Actividad económica'], ['lugar_trabajo', 'Lugar de trabajo'],
];

const COLUMNAS_AFILIADO = [
    ['nombres', 'Nombres', 22], ['apellidos', 'Apellidos', 22], ['cedula', 'Cédula', 14],
    ['fecha_expedicion', 'Fecha de expedición', 14], ['genero', 'Género', 14], ['etnia', 'Grupo étnico', 16],
    ['discapacidad', 'Discapacidad', 16], ['telefono', 'Teléfono', 15], ['correo', 'Correo', 28],
    ['fecha_afiliacion', 'Fecha de afiliación', 14], ['tiene_censo', 'Censo diligenciado', 12],
];

// ── Utilidades ─────────────────────────────────────────────
function formatoFecha(valor) {
    if (!valor) return '';
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' });
}

function valorLegible(campo, valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
    if (campo.startsWith('fecha') || valor instanceof Date) return formatoFecha(valor);
    return String(valor);
}

// Fechas como fecha real de Excel (se pueden ordenar y filtrar)
function valorCelda(campo, valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
    if (campo.startsWith('fecha') || campo === 'created_at' || campo === 'updated_at' || campo === 'revisado_en') {
        const d = new Date(valor);
        return Number.isNaN(d.getTime()) ? String(valor) : d;
    }
    if (typeof valor === 'number') return valor;
    return String(valor);
}

function hojaConTabla(libro, nombre, columnas, filas) {
    const hoja = libro.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
    hoja.columns = columnas.map(([key, header, width]) => ({ key, header, width: width || Math.max(12, header.length + 2) }));
    filas.forEach(f => hoja.addRow(Object.fromEntries(columnas.map(([key]) => [key, valorCelda(key, f[key])]))));

    const encabezado = hoja.getRow(1);
    encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + VERDE } };
    encabezado.alignment = { vertical: 'middle', wrapText: true };
    encabezado.height = 30;
    hoja.columns.forEach(col => {
        if (/^fecha|created_at|updated_at|revisado_en/.test(col.key)) col.numFmt = 'dd/mm/yyyy';
    });
    if (filas.length) {
        hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
    }
    return hoja;
}

function nuevoLibro() {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'JAC Honduras, Cauca';
    libro.created = new Date();
    return libro;
}

// ── Excel de afiliados ─────────────────────────────────────
async function excelAfiliados(afiliados) {
    const libro = nuevoLibro();
    hojaConTabla(libro, 'Afiliados', COLUMNAS_AFILIADO, afiliados);
    return libro.xlsx.writeBuffer();
}

// ── Excel del censo ────────────────────────────────────────
async function excelCenso({ hogares, miembros, filtros }) {
    const libro = nuevoLibro();

    // Resumen
    const resumen = libro.addWorksheet('Resumen');
    resumen.columns = [{ width: 38 }, { width: 18 }];
    const personas = hogares.length + miembros.filter(m => m.vive_aqui).length;
    const filasResumen = [
        ['Censo comunitario — JAC Honduras, Cauca'],
        [`Generado el ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`],
        [filtros ? `Filtros aplicados: ${filtros}` : 'Sin filtros: todos los hogares'],
        [],
        ['Hogares censados', hogares.length],
        ['Personas (titulares + miembros que viven en el hogar)', personas],
        ['Censos revisados', hogares.filter(h => h.estado_revision === 'Revisado').length],
        ['Censos pendientes de revisión', hogares.filter(h => h.estado_revision !== 'Revisado').length],
    ];
    filasResumen.forEach(f => resumen.addRow(f));
    resumen.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF' + VERDE } };
    resumen.getRow(2).font = { italic: true, color: { argb: 'FF4A5A50' } };
    resumen.getRow(3).font = { italic: true, color: { argb: 'FF4A5A50' } };
    for (let i = 5; i <= 8; i++) resumen.getRow(i).getCell(2).font = { bold: true };
    resumen.addRow([]);
    resumen.addRow(['Información personal y confidencial. Uso exclusivo de la Junta de Acción Comunal.']).font = { italic: true, color: { argb: 'FF8A6D12' } };

    // Hogares: una fila por censo con todos los campos
    const columnasHogar = [
        ['id', 'N.º censo', 9],
        ['afiliado_cedula', 'Cédula del afiliado', 16],
        ...SECCIONES_CENSO.flatMap(([, campos]) => campos.map(([k, l]) => [k, l, Math.min(40, Math.max(14, l.length + 2))])),
        ['autorizacion', 'Autorizó uso de datos', 12],
        ['estado_revision', 'Estado de revisión', 14],
        ['revisado_en', 'Fecha de revisión', 14],
        ['created_at', 'Fecha de registro', 14],
        ['updated_at', 'Última actualización', 14],
    ];
    hojaConTabla(libro, 'Hogares', columnasHogar, hogares);

    // Miembros
    const columnasMiembro = [
        ['censo_id', 'N.º censo', 9],
        ['titular', 'Titular del hogar', 26],
        ...CAMPOS_MIEMBRO.map(([k, l]) => [k, l, Math.max(14, l.length + 2)]),
    ];
    hojaConTabla(libro, 'Miembros del hogar', columnasMiembro, miembros);

    return libro.xlsx.writeBuffer();
}

// ── Ficha individual en PDF ────────────────────────────────
function fichaCensoPdf({ censo, miembros, totalAdjuntos }) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'LETTER', margins: { top: 50, bottom: 50, left: 50, right: 50 }, bufferPages: true,
            info: { Title: `Ficha de censo — ${censo.nombres} ${censo.apellidos}`, Author: 'JAC Honduras, Cauca' } });
        const partes = [];
        doc.on('data', p => partes.push(p));
        doc.on('end', () => resolve(Buffer.concat(partes)));
        doc.on('error', reject);

        const ancho = doc.page.width - 100;
        const izquierda = 50;

        // Encabezado
        if (fs.existsSync(LOGO)) {
            try { doc.image(LOGO, izquierda, 42, { width: 46 }); } catch { /* logo opcional */ }
        }
        doc.fillColor('#' + VERDE).font('Helvetica-Bold').fontSize(15)
            .text('Junta de Acción Comunal de Honduras, Cauca', izquierda + 58, 48, { width: ancho - 58 });
        doc.fillColor('#4A5A50').font('Helvetica').fontSize(10)
            .text(`Ficha de censo familiar N.º ${censo.id}`, izquierda + 58, 68, { width: ancho - 58 });
        doc.moveTo(izquierda, 100).lineTo(izquierda + ancho, 100).lineWidth(2).strokeColor('#' + DORADO).stroke();

        doc.y = 112;
        doc.fillColor('#16241C').font('Helvetica-Bold').fontSize(16)
            .text(`${censo.nombres || ''} ${censo.apellidos || ''}`.trim(), izquierda);
        doc.font('Helvetica').fontSize(10).fillColor('#4A5A50')
            .text(`${censo.tipo_documento || 'Documento'} ${censo.numero_documento || ''}   ·   Registrado: ${formatoFecha(censo.created_at)}   ·   Revisión: ${censo.estado_revision || 'Pendiente'}`);
        doc.moveDown(0.8);

        const asegurarEspacio = (alto) => {
            if (doc.y + alto > doc.page.height - 60) doc.addPage();
        };

        const titulo = (texto) => {
            asegurarEspacio(40);
            doc.moveDown(0.4);
            const y = doc.y;
            doc.rect(izquierda, y, ancho, 20).fill('#' + VERDE_CLARO);
            doc.fillColor('#' + VERDE).font('Helvetica-Bold').fontSize(10.5).text(texto, izquierda + 8, y + 5);
            doc.y = y + 26;
        };

        // Campos en dos columnas
        const campos = (pares) => {
            const colAncho = (ancho - 16) / 2;
            for (let i = 0; i < pares.length; i += 2) {
                const fila = pares.slice(i, i + 2);
                const altos = fila.map(([etq, val]) =>
                    doc.font('Helvetica').fontSize(10).heightOfString(val || '—', { width: colAncho }) + 14);
                const alto = Math.max(...altos);
                asegurarEspacio(alto + 4);
                const y = doc.y;
                fila.forEach(([etq, val], j) => {
                    const x = izquierda + j * (colAncho + 16);
                    doc.fillColor('#78867D').font('Helvetica').fontSize(8).text(etq, x, y, { width: colAncho });
                    doc.fillColor('#16241C').font('Helvetica').fontSize(10).text(val || '—', x, y + 11, { width: colAncho });
                });
                doc.y = y + alto + 4;
            }
        };

        SECCIONES_CENSO.forEach(([seccion, lista]) => {
            titulo(seccion);
            campos(lista.map(([k, l]) => [l, valorLegible(k, censo[k])]));
        });

        titulo(`Miembros del hogar (${miembros.length})`);
        if (!miembros.length) {
            doc.fillColor('#4A5A50').font('Helvetica').fontSize(10).text('No hay miembros registrados además del titular.', izquierda);
        }
        miembros.forEach((m, i) => {
            asegurarEspacio(60);
            doc.fillColor('#16241C').font('Helvetica-Bold').fontSize(10.5)
                .text(`${i + 1}. ${m.nombre_completo || ''} — ${m.parentesco || ''}`, izquierda);
            doc.moveDown(0.2);
            campos(CAMPOS_MIEMBRO.filter(([k]) => !['nombre_completo', 'parentesco'].includes(k))
                .map(([k, l]) => [l, valorLegible(k, m[k])])
                .filter(([, v]) => v));
            doc.moveDown(0.3);
        });

        titulo('Autorización y revisión');
        campos([
            ['Autorizó el uso de la información', censo.autorizacion ? 'Sí' : 'No'],
            ['Archivos adjuntos', `${totalAdjuntos} (se consultan en el panel)`],
            ['Estado de revisión', censo.estado_revision || 'Pendiente'],
            ['Fecha de revisión', formatoFecha(censo.revisado_en)],
        ]);

        // Pie de página en todas las hojas
        const rango = doc.bufferedPageRange();
        for (let i = 0; i < rango.count; i++) {
            doc.switchToPage(i);
            const yPie = doc.page.height - 38;
            doc.page.margins.bottom = 0;
            doc.fillColor('#78867D').font('Helvetica').fontSize(8)
                .text('Información personal y confidencial. Uso exclusivo de la Junta de Acción Comunal de Honduras, Cauca.',
                    izquierda, yPie, { width: ancho - 80, lineBreak: false })
                .text(`Página ${i + 1} de ${rango.count}`, izquierda + ancho - 80, yPie, { width: 80, align: 'right', lineBreak: false });
        }
        doc.end();
    });
}

function nombreArchivo(base, ext) {
    const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    return `${base}-${fecha}.${ext}`;
}

module.exports = { excelAfiliados, excelCenso, fichaCensoPdf, nombreArchivo };
