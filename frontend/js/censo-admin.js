// js/censo-admin.js — Lógica del panel de administración del censo

const API = window.location.origin + '/api';
let censosCache = [];
const graficas = {};

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}

function authHeaders() {
    return { 'Authorization': `Bearer ${localStorage.getItem('jac_token')}` };
}

function cerrarSesion() {
    localStorage.removeItem('jac_token');
    localStorage.removeItem('jac_admin');
    window.location.href = '/login';
}

// Si el token expiró o no es de un admin, el backend responde 401/403: se cierra la sesión.
function manejarNoAutorizado(res) {
    if (res.status === 401 || res.status === 403) {
        cerrarSesion();
        return true;
    }
    return false;
}

window.addEventListener('load', () => {
    const token = localStorage.getItem('jac_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    const admin = JSON.parse(localStorage.getItem('jac_admin') || '{}');
    document.getElementById('adminNombre').textContent = `Bienvenido, ${admin.nombre || admin.usuario || 'Administrador'}`;

    cargarEstadisticas();
    cargarCensos();

    const navToggle = document.getElementById('navToggle');
    const navbarLinks = document.getElementById('navbarLinks');
    if (navToggle && navbarLinks) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navbarLinks.classList.toggle('active');
        });
    }
});

// ── Estadísticas y gráficas ──────────────────────────────
const PALETA = ['#0a4325', '#10b981', '#f59e0b', '#ec4899', '#7c3aed', '#0369a1', '#ef4444', '#64748b', '#84cc16', '#06b6d4'];
const ORDEN_EDAD = ['0-17', '18-29', '30-44', '45-59', '60+'];

async function cargarEstadisticas() {
    try {
        const res = await fetch(`${API}/censo/estadisticas`, { headers: authHeaders() });
        if (manejarNoAutorizado(res)) return;
        const stats = await res.json();

        document.getElementById('statCensoTotal').textContent = stats.total;
        document.getElementById('statHogares').textContent = stats.total_hogares;
        document.getElementById('statPromedioHogar').textContent = stats.promedio_personas_hogar || '—';
        document.getElementById('statConDiscapacidad').textContent = stats.total_con_discapacidad;

        renderizarGrafica('chartSexo', 'doughnut', stats.por_sexo.map(r => r.sexo), stats.por_sexo.map(r => r.total));

        const edadOrdenada = ORDEN_EDAD
            .map(rango => stats.por_edad.find(r => r.rango === rango))
            .filter(Boolean);
        renderizarGrafica('chartEdad', 'bar', edadOrdenada.map(r => r.rango), edadOrdenada.map(r => r.total));

        renderizarGrafica('chartCiudad', 'bar', stats.por_ciudad.map(r => r.ciudad_municipio), stats.por_ciudad.map(r => r.total));
        renderizarGrafica('chartOcupacion', 'bar', stats.por_ocupacion.map(r => r.ocupacion), stats.por_ocupacion.map(r => r.total));
        renderizarGrafica('chartNivelEducativo', 'doughnut', stats.por_nivel_educativo.map(r => r.nivel_educativo), stats.por_nivel_educativo.map(r => r.total));
        renderizarGrafica('chartNecesidad', 'bar', stats.por_necesidad.map(r => r.necesidad), stats.por_necesidad.map(r => r.total));
    } catch (err) {
        console.error('Error al cargar las estadísticas del censo:', err);
    }
}

function renderizarGrafica(canvasId, tipo, etiquetas, datos) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (graficas[canvasId]) graficas[canvasId].destroy();

    graficas[canvasId] = new Chart(ctx, {
        type: tipo,
        data: {
            labels: etiquetas,
            datasets: [{
                data: datos,
                backgroundColor: etiquetas.map((_, i) => PALETA[i % PALETA.length]),
                borderRadius: tipo === 'bar' ? 8 : 0,
                borderWidth: tipo === 'doughnut' ? 2 : 0,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: tipo === 'doughnut', position: 'bottom' }
            },
            scales: tipo === 'bar' ? { y: { beginAtZero: true, ticks: { precision: 0 } } } : undefined
        }
    });
}

// ── Filtros y tabla ───────────────────────────────────────
function filtrosActuales() {
    const params = new URLSearchParams();
    const mapa = {
        filtroNombre: 'nombre', filtroDocumento: 'documento', filtroCiudad: 'ciudad',
        filtroSexo: 'sexo', filtroOcupacion: 'ocupacion',
        filtroFechaDesde: 'fecha_desde', filtroFechaHasta: 'fecha_hasta', filtroRevision: 'estado_revision'
    };
    Object.entries(mapa).forEach(([elId, campo]) => {
        const valor = document.getElementById(elId).value.trim();
        if (valor) params.set(campo, valor);
    });
    return params.toString();
}

function limpiarFiltros() {
    ['filtroNombre', 'filtroDocumento', 'filtroCiudad', 'filtroOcupacion', 'filtroFechaDesde', 'filtroFechaHasta']
        .forEach(id => document.getElementById(id).value = '');
    document.getElementById('filtroSexo').value = '';
    document.getElementById('filtroRevision').value = '';
    cargarCensos();
}

async function cargarCensos() {
    const contenedor = document.getElementById('contenidoTablaCenso');
    contenedor.innerHTML = `<div class="cargando"><div class="spinner"></div>Cargando censos...</div>`;

    try {
        const qs = filtrosActuales();
        const res = await fetch(`${API}/censo${qs ? '?' + qs : ''}`, { headers: authHeaders() });
        if (manejarNoAutorizado(res)) return;
        const data = await res.json();
        censosCache = data;
        renderizarTablaCenso(data);
    } catch (err) {
        contenedor.innerHTML = `<div class="cargando">❌ Error al conectar con el servidor.</div>`;
    }
}

function renderizarTablaCenso(lista) {
    const contenedor = document.getElementById('contenidoTablaCenso');

    if (lista.length === 0) {
        contenedor.innerHTML = `<div class="cargando">📋 No se encontraron censos con esos filtros.</div>`;
        return;
    }

    const filas = lista.map(c => `
        <tr>
            <td><button class="nombre-censo-link" data-accion="ver" data-id="${c.id}">${escapeHtml(c.nombres)} ${escapeHtml(c.apellidos)}</button></td>
            <td>${escapeHtml(c.numero_documento)}</td>
            <td>${escapeHtml(c.ciudad_municipio)}</td>
            <td><span class="badge badge-verde">${escapeHtml(c.sexo)}</span></td>
            <td>${escapeHtml(c.ocupacion) || '—'}</td>
            <td>${(c.total_miembros || 0) + 1}</td>
            <td><span class="badge ${c.estado_revision === 'Revisado' ? 'badge-verde' : ''}">${escapeHtml(c.estado_revision)}</span></td>
            <td>${formatFecha(c.created_at)}</td>
            <td><button class="btn btn-peligro btn-sm" data-accion="eliminar" data-id="${c.id}" data-nombre="${escapeHtml(`${c.nombres} ${c.apellidos}`)}">🗑️</button></td>
        </tr>
    `).join('');

    contenedor.innerHTML = `
        <div class="tabla-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Nombre</th><th>Documento</th><th>Ciudad / Municipio</th>
                        <th>Sexo</th><th>Ocupación</th><th>Personas</th><th>Revisión</th><th>Fecha Registro</th><th>Acciones</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>
        <p style="margin-top:12px; font-size:0.8rem; color:var(--gris);">
            Mostrando ${lista.length} registro${lista.length !== 1 ? 's' : ''}.
        </p>
    `;
}

document.getElementById('contenidoTablaCenso')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-accion]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.accion === 'ver') abrirDetalleCenso(id);
    else if (btn.dataset.accion === 'eliminar') eliminarCenso(id, btn.dataset.nombre);
});

// ── Modal Detalle / Editar ────────────────────────────────
const CAMPOS_MODAL_CENSO = {
    mcNombres: 'nombres', mcApellidos: 'apellidos', mcTipoDocumento: 'tipo_documento',
    mcNumeroDocumento: 'numero_documento', mcFechaNacimiento: 'fecha_nacimiento', mcSexo: 'sexo',
    mcEstadoCivil: 'estado_civil', mcEtnia: 'etnia', mcDiscapacidad: 'discapacidad',
    mcDireccion: 'direccion', mcBarrioVereda: 'barrio_vereda', mcCiudadMunicipio: 'ciudad_municipio',
    mcZonaVivienda: 'zona_vivienda', mcTipoVivienda: 'tipo_vivienda',
    mcPersonasHogar: 'personas_hogar', mcFamiliasHogar: 'familias_hogar',
    mcMaterialParedes: 'material_paredes', mcMaterialPiso: 'material_piso', mcMaterialTecho: 'material_techo',
    mcAccesoAgua: 'acceso_agua_potable', mcFuenteAgua: 'fuente_agua',
    mcAccesoElectricidad: 'acceso_electricidad', mcAccesoGas: 'acceso_gas',
    mcSistemaExcretas: 'sistema_excretas', mcAccesoResiduos: 'acceso_recoleccion_residuos',
    mcAccesoTelefonia: 'acceso_telefonia',
    mcPersonasAusentes: 'personas_ausentes', mcMotivoAusencia: 'motivo_ausencia',
    mcRetornoReciente: 'retorno_reciente',
    mcTelefono: 'telefono', mcCorreo: 'correo', mcNivelEducativo: 'nivel_educativo', mcOcupacion: 'ocupacion',
    mcObservaciones: 'observaciones'
};

function marcarGrupoCheckboxModal(grupoId, valorGuardado) {
    const seleccionadas = new Set((valorGuardado || '').split(',').map(v => v.trim()).filter(Boolean));
    document.querySelectorAll(`#${grupoId} input[type="checkbox"]`).forEach(chk => {
        chk.checked = seleccionadas.has(chk.value);
    });
}

function leerGrupoCheckboxModal(grupoId) {
    return Array.from(document.querySelectorAll(`#${grupoId} input[type="checkbox"]:checked`))
        .map(chk => chk.value)
        .join(', ') || null;
}

async function abrirDetalleCenso(id) {
    try {
        const res = await fetch(`${API}/censo/${id}`, { headers: authHeaders() });
        if (manejarNoAutorizado(res)) return;
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'No se pudo cargar el censo.');
            return;
        }
        const censo = await res.json();

        document.getElementById('mcId').value = censo.id;
        Object.entries(CAMPOS_MODAL_CENSO).forEach(([elId, campo]) => {
            const el = document.getElementById(elId);
            let valor = censo[campo];
            if (campo === 'fecha_nacimiento' && valor) valor = valor.split('T')[0];
            el.value = valor ?? '';
        });
        marcarGrupoCheckboxModal('mcTecnologiaGrupo', censo.tecnologia_disponible);
        marcarGrupoCheckboxModal('mcSaludGrupo', censo.acceso_servicios_salud);
        marcarGrupoCheckboxModal('mcActividadesGrupo', censo.actividades_economicas_familia);
        marcarGrupoCheckboxModal('mcNecesidadesGrupo', censo.necesidades_prioritarias);

        document.getElementById('mcAutorizacion').value = censo.autorizacion ? 'true' : 'false';
        document.getElementById('mcAutorizacionTexto').textContent = censo.autorizacion ? 'Sí' : 'No';
        actualizarBadgeRevision(censo.estado_revision);

        document.getElementById('btnEliminarCensoModal').dataset.nombre = `${censo.nombres} ${censo.apellidos}`;

        document.getElementById('modalCenso').style.display = 'flex';
        cargarArchivosCensoModal(censo.id);
        cargarMiembrosHogarModal(censo.id);
    } catch (err) {
        alert('Error de conexión con el servidor.');
    }
}

// ── Autorización y revisión ───────────────────────────────
function actualizarBadgeRevision(estado) {
    const badge = document.getElementById('mcEstadoRevisionBadge');
    const btn = document.getElementById('btnToggleRevision');
    badge.textContent = estado;
    badge.className = `badge ${estado === 'Revisado' ? 'badge-verde' : ''}`;
    if (estado === 'Revisado') {
        btn.textContent = 'Marcar como Pendiente';
        btn.style.background = 'var(--bg-light)';
        btn.style.color = 'var(--primary-dark)';
    } else {
        btn.textContent = 'Marcar como Revisado';
        btn.style.background = 'var(--accent)';
        btn.style.color = '#fff';
    }
    btn.dataset.estadoActual = estado;
}

async function alternarRevisionCenso() {
    const id = document.getElementById('mcId').value;
    const estadoActual = document.getElementById('btnToggleRevision').dataset.estadoActual;
    const nuevoEstado = estadoActual === 'Revisado' ? 'Pendiente' : 'Revisado';

    try {
        const res = await fetch(`${API}/censo/${id}/revision`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ estado: nuevoEstado })
        });
        if (manejarNoAutorizado(res)) return;
        const json = await res.json();
        if (!res.ok) {
            alert(json.error || 'No se pudo actualizar la revisión.');
            return;
        }
        actualizarBadgeRevision(nuevoEstado);
        cargarCensos();
    } catch (err) {
        alert('Error de conexión con el servidor.');
    }
}

// ── Miembros del hogar (vista y moderación del admin) ─────
async function cargarMiembrosHogarModal(censoId) {
    const contenedor = document.getElementById('mcListaMiembros');
    contenedor.innerHTML = `<div class="cargando"><div class="spinner"></div>Cargando miembros...</div>`;

    try {
        const res = await fetch(`${API}/censo/${censoId}/miembros`, { headers: authHeaders() });
        if (manejarNoAutorizado(res)) return;
        const lista = await res.json();
        renderizarMiembrosHogarModal(lista);
    } catch (err) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar los miembros del hogar.</p>';
    }
}

function calcularEdadModal(fechaNacimiento) {
    if (!fechaNacimiento) return '—';
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad;
}

function renderizarMiembrosHogarModal(lista) {
    const contenedor = document.getElementById('mcListaMiembros');
    if (!Array.isArray(lista) || lista.length === 0) {
        contenedor.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">No hay miembros adicionales registrados en este hogar.</p>';
        return;
    }

    contenedor.innerHTML = lista.map(m => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:10px 0; border-bottom:1px solid var(--glass-border);">
            <div>
                <strong>${escapeHtml(m.nombre_completo)}</strong>
                <div style="font-size:0.78rem; color:var(--text-muted);">${escapeHtml(m.parentesco)} · ${escapeHtml(m.sexo)} · ${calcularEdadModal(m.fecha_nacimiento)} años${m.vive_aqui === false ? ' · No vive aquí actualmente' : ''}</div>
            </div>
            <button class="btn btn-peligro btn-sm" data-id="${m.id}">🗑️ Eliminar</button>
        </div>
    `).join('');
}

document.getElementById('mcListaMiembros')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    eliminarMiembroHogarModal(Number(btn.dataset.id));
});

function eliminarMiembroHogarModal(miembroId) {
    pedirConfirmacion('¿Eliminar a esta persona del hogar? Esta acción no se puede deshacer.', async () => {
        const censoId = document.getElementById('mcId').value;
        try {
            const res = await fetch(`${API}/censo/miembros/${miembroId}`, { method: 'DELETE', headers: authHeaders() });
            if (manejarNoAutorizado(res)) return;
            const json = await res.json();
            if (!res.ok) {
                alert(json.error || 'No se pudo eliminar el miembro del hogar.');
                return;
            }
            cargarMiembrosHogarModal(censoId);
            cargarEstadisticas();
        } catch (err) {
            alert('Error de conexión con el servidor.');
        }
    });
}

// ── Archivos adjuntos (vista y moderación del admin) ─────────
async function cargarArchivosCensoModal(censoId) {
    const contenedor = document.getElementById('mcListaArchivos');
    contenedor.innerHTML = `<div class="cargando"><div class="spinner"></div>Cargando archivos...</div>`;

    try {
        const res = await fetch(`${API}/censo/${censoId}/archivos`, { headers: authHeaders() });
        if (manejarNoAutorizado(res)) return;
        const lista = await res.json();
        renderizarArchivosCensoModal(lista);
    } catch (err) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar los archivos.</p>';
    }
}

function renderizarArchivosCensoModal(lista) {
    const contenedor = document.getElementById('mcListaArchivos');
    if (!Array.isArray(lista) || lista.length === 0) {
        contenedor.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Esta persona no ha adjuntado archivos.</p>';
        return;
    }

    contenedor.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:12px;">
            ${lista.map(a => {
                const esImagen = /\.(jpg|jpeg|png|gif|webp)$/i.test(a.archivo_url);
                const previsualizacion = esImagen
                    ? `<img src="${escapeHtml(a.archivo_url)}" alt="${escapeHtml(a.nombre_original || '')}" style="width:100%; height:90px; object-fit:cover; border-radius:8px 8px 0 0;">`
                    : `<div style="width:100%; height:90px; display:flex; align-items:center; justify-content:center; font-size:1.8rem; background:var(--bg-light); border-radius:8px 8px 0 0;">📄</div>`;
                return `
                    <div style="border:1px solid rgba(0,0,0,0.08); border-radius:8px; overflow:hidden; background:#fff;">
                        <a href="${escapeHtml(a.archivo_url)}" target="_blank" rel="noopener">${previsualizacion}</a>
                        <div style="padding:6px 8px;">
                            <div style="font-size:0.72rem; color:var(--text-muted);">${escapeHtml(a.tipo)}</div>
                            <button class="btn btn-peligro btn-sm" style="margin-top:4px; width:100%; padding:5px 8px; font-size:0.72rem;" data-id="${a.id}">🗑️ Eliminar</button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

document.getElementById('mcListaArchivos')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    eliminarArchivoCensoModal(Number(btn.dataset.id));
});

async function eliminarArchivoCensoModal(archivoId) {
    pedirConfirmacion('¿Eliminar este archivo adjunto? Esta acción no se puede deshacer.', async () => {
        const censoId = document.getElementById('mcId').value;
        try {
            const res = await fetch(`${API}/censo/archivos/${archivoId}`, { method: 'DELETE', headers: authHeaders() });
            if (manejarNoAutorizado(res)) return;
            const json = await res.json();
            if (!res.ok) {
                alert(json.error || 'No se pudo eliminar el archivo.');
                return;
            }
            cargarArchivosCensoModal(censoId);
        } catch (err) {
            alert('Error de conexión con el servidor.');
        }
    });
}

function cerrarModalCenso() {
    document.getElementById('modalCenso').style.display = 'none';
}

document.getElementById('modalCenso')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalCenso')) cerrarModalCenso();
});

async function guardarCensoModal() {
    const id = document.getElementById('mcId').value;
    const datos = {};
    Object.entries(CAMPOS_MODAL_CENSO).forEach(([elId, campo]) => {
        datos[campo] = document.getElementById(elId).value.trim() || null;
    });
    datos.tecnologia_disponible = leerGrupoCheckboxModal('mcTecnologiaGrupo');
    datos.acceso_servicios_salud = leerGrupoCheckboxModal('mcSaludGrupo');
    datos.actividades_economicas_familia = leerGrupoCheckboxModal('mcActividadesGrupo');
    datos.necesidades_prioritarias = leerGrupoCheckboxModal('mcNecesidadesGrupo');
    // La autorización la otorgó el titular al crear el censo; el admin no la retira al editar.
    datos.autorizacion = document.getElementById('mcAutorizacion').value === 'true';

    if (!datos.nombres || !datos.apellidos || !datos.numero_documento || !datos.fecha_nacimiento || !datos.sexo || !datos.ciudad_municipio) {
        alert('Completa los campos obligatorios: nombres, apellidos, documento, fecha de nacimiento, sexo y ciudad/municipio.');
        return;
    }

    try {
        const res = await fetch(`${API}/censo/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(datos)
        });
        if (manejarNoAutorizado(res)) return;
        const json = await res.json();

        if (!res.ok) {
            alert(json.error || 'Error al actualizar el censo.');
            return;
        }
        cerrarModalCenso();
        cargarCensos();
        cargarEstadisticas();
    } catch (err) {
        alert('Error de conexión con el servidor.');
    }
}

document.getElementById('btnEliminarCensoModal')?.addEventListener('click', () => {
    const id = Number(document.getElementById('mcId').value);
    const nombre = document.getElementById('btnEliminarCensoModal').dataset.nombre;
    cerrarModalCenso();
    eliminarCenso(id, nombre);
});

// ── Confirmación genérica (eliminar) ──────────────────────
let _confirmCallback = null;

function pedirConfirmacion(mensaje, callback) {
    document.getElementById('msgConfirmar').textContent = mensaje;
    _confirmCallback = callback;
    document.getElementById('modalConfirmar').style.display = 'flex';
}

function cerrarModalConfirmar() {
    document.getElementById('modalConfirmar').style.display = 'none';
    _confirmCallback = null;
}

document.getElementById('btnConfirmarEliminar')?.addEventListener('click', () => {
    const callback = _confirmCallback;
    cerrarModalConfirmar();
    if (callback) callback();
});

document.getElementById('modalConfirmar')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalConfirmar')) cerrarModalConfirmar();
});

function eliminarCenso(id, nombre) {
    pedirConfirmacion(`¿Eliminar el censo de "${nombre}"? Esta acción no se puede deshacer.`, async () => {
        try {
            const res = await fetch(`${API}/censo/${id}`, { method: 'DELETE', headers: authHeaders() });
            if (manejarNoAutorizado(res)) return;
            const json = await res.json();

            if (!res.ok) {
                alert(json.error || 'Error al eliminar el censo.');
                return;
            }
            cargarCensos();
            cargarEstadisticas();
        } catch (err) {
            alert('Error de conexión con el servidor.');
        }
    });
}

// ── Utilidades ───────────────────────────────────────────
function formatFecha(fecha) {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}
