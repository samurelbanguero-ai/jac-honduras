// js/admin.js — Lógica del panel de administrador

const API = window.location.origin + '/api';
let todosAfiliados = [];

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}

// ── Al cargar: verificar sesión ──────────────────────────
// El login vive en /login (formulario único); si no hay sesión de admin
// válida, se redirige ahí en vez de mostrar un formulario aparte aquí.
window.addEventListener('load', () => {
    const token = localStorage.getItem('jac_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    mostrarDashboard();
    cargarAfiliados();
    cargarNoticiasAdmin();

    // Mobile menu toggle
    const navToggle = document.getElementById('navToggle');
    const navbarLinks = document.getElementById('navbarLinks');
    if (navToggle && navbarLinks) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navbarLinks.classList.toggle('active');
        });
    }
});

// ── CERRAR SESIÓN ────────────────────────────────────────
function cerrarSesion() {
    localStorage.removeItem('jac_token');
    localStorage.removeItem('jac_admin');
    window.location.href = '/login';
}

// ── MOSTRAR DASHBOARD ────────────────────────────────────
function mostrarDashboard() {
    document.getElementById('vistaDashboard').style.display = '';
    document.getElementById('btnCerrarSesion').style.display = 'inline-flex';

    const admin = JSON.parse(localStorage.getItem('jac_admin') || '{}');
    document.getElementById('adminNombre').textContent =
        `Bienvenido, ${admin.nombre || admin.usuario || 'Administrador'}`;
}

// ── CARGAR AFILIADOS ─────────────────────────────────────
async function cargarAfiliados() {
    const token = localStorage.getItem('jac_token');
    if (!token) return;

    const contenedor = document.getElementById('contenidoTabla');
    contenedor.innerHTML = `<div class="cargando"><div class="spinner"></div>Cargando afiliados...</div>`;

    try {
        const res = await fetch(`${API}/afiliados`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) {
            cerrarSesion();
            return;
        }

        const data = await res.json();
        todosAfiliados = data;
        actualizarEstadisticas(data);
        renderizarTabla(data);

    } catch (err) {
        contenedor.innerHTML = `<div class="cargando">❌ Error al conectar con el servidor.</div>`;
    }
}

// ── ESTADÍSTICAS ─────────────────────────────────────────
function actualizarEstadisticas(lista) {
    document.getElementById('statTotal').textContent = lista.length;
    document.getElementById('statMasc').textContent = lista.filter(a => a.genero === 'Masculino').length;
    document.getElementById('statFem').textContent = lista.filter(a => a.genero === 'Femenino').length;
    document.getElementById('statOtros').textContent = lista.filter(a => !['Masculino','Femenino'].includes(a.genero)).length;
}

// ── RENDERIZAR TABLA ─────────────────────────────────────
function renderizarTabla(lista) {
    const contenedor = document.getElementById('contenidoTabla');

    if (lista.length === 0) {
        contenedor.innerHTML = `<div class="cargando">📋 No hay afiliados registrados aún.</div>`;
        return;
    }

    const filas = lista.map(a => `
        <tr>
            <td><strong>${escapeHtml(a.nombres)} ${escapeHtml(a.apellidos)}</strong></td>
            <td>${escapeHtml(a.cedula)}</td>
            <td><span class="badge badge-verde">${escapeHtml(a.genero)}</span></td>
            <td>${escapeHtml(a.etnia) || '—'}</td>
            <td>${escapeHtml(a.telefono) || '—'}</td>
            <td>${escapeHtml(a.correo) || '—'}</td>
            <td>${formatFecha(a.fecha_afiliacion)}</td>
            <td>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn btn-editar btn-sm" data-accion="editar" data-id="${a.id}">✏️ Editar</button>
                    <button class="btn btn-sm" style="background:var(--bg-light); color:var(--primary-dark); border:1px solid rgba(13,92,53,0.15);" data-accion="resetear" data-id="${a.id}" data-nombre="${escapeHtml(`${a.nombres} ${a.apellidos}`)}">🔑 Resetear</button>
                    <button class="btn btn-peligro btn-sm" data-accion="eliminar" data-id="${a.id}" data-nombre="${escapeHtml(`${a.nombres} ${a.apellidos}`)}">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');

    contenedor.innerHTML = `
        <div class="tabla-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Nombre Completo</th>
                        <th>Cédula</th>
                        <th>Género</th>
                        <th>Etnia</th>
                        <th>Teléfono</th>
                        <th>Correo</th>
                        <th>Afiliación</th>
                        <th>Acciones</th>
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

// Delegación de eventos: evita construir JS dinámico con datos del usuario (XSS)
document.getElementById('contenidoTabla')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-accion]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.accion === 'editar') abrirEditar(id);
    else if (btn.dataset.accion === 'eliminar') eliminarAfiliado(id, btn.dataset.nombre);
    else if (btn.dataset.accion === 'resetear') abrirModalResetPass(id, btn.dataset.nombre);
});

// ── RESETEAR CONTRASEÑA (cuando el afiliado la olvidó y no puede entrar) ──
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const esOculta = input.type === 'password';
    input.type = esOculta ? 'text' : 'password';
    btn.textContent = esOculta ? '🙈' : '👁';
}

function abrirModalResetPass(id, nombre) {
    document.getElementById('resetPassId').value = id;
    document.getElementById('resetPassNombre').textContent = nombre;
    document.getElementById('resetPassNueva').value = '';
    document.getElementById('resetPassNueva').type = 'password';
    document.getElementById('alertaResetPass').style.display = 'none';
    document.getElementById('modalResetPass').style.display = 'flex';
}

function cerrarModalResetPass() {
    document.getElementById('modalResetPass').style.display = 'none';
}

// Cerrar al hacer clic fuera
document.getElementById('modalResetPass')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalResetPass')) cerrarModalResetPass();
});

async function confirmarResetearContrasena() {
    const id = document.getElementById('resetPassId').value;
    const nombre = document.getElementById('resetPassNombre').textContent;
    const nueva = document.getElementById('resetPassNueva').value;
    const alerta = document.getElementById('alertaResetPass');

    if (nueva.length < 6) {
        alerta.textContent = 'La contraseña debe tener al menos 6 caracteres.';
        alerta.style.display = 'block';
        return;
    }

    const btn = document.getElementById('btnConfirmarReset');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const token = localStorage.getItem('jac_token');
    try {
        const res = await fetch(`${API}/afiliados/${id}/contrasena`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ contrasena_nueva: nueva })
        });
        const json = await res.json();

        if (res.ok) {
            cerrarModalResetPass();
            mostrarAlertaDash('exito', `✅ Contraseña de "${nombre}" reestablecida correctamente.`);
        } else {
            alerta.textContent = json.error || 'Error al reestablecer la contraseña.';
            alerta.style.display = 'block';
        }
    } catch (err) {
        alerta.textContent = 'Error de conexión al servidor.';
        alerta.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Nueva Contraseña';
    }
}

// ── BUSCADOR ─────────────────────────────────────────────
function filtrarTabla() {
    const q = document.getElementById('buscador').value.toLowerCase();
    const filtrados = todosAfiliados.filter(a =>
        `${a.nombres} ${a.apellidos}`.toLowerCase().includes(q) ||
        a.cedula.includes(q) ||
        (a.correo || '').toLowerCase().includes(q)
    );
    renderizarTabla(filtrados);
}

// ── CONFIRMACIÓN GENÉRICA (reemplaza confirm() nativo) ────
let _confirmCallback = null;

function pedirConfirmacion(mensaje, callback, opciones) {
    const { titulo = '⚠️ Confirmar Eliminación', textoBoton = '🗑️ Sí, Eliminar' } = opciones || {};
    document.getElementById('tituloConfirmar').textContent = titulo;
    document.getElementById('btnConfirmarEliminar').textContent = textoBoton;
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

// ── ELIMINAR ─────────────────────────────────────────────
function eliminarAfiliado(id, nombre) {
    pedirConfirmacion(`¿Estás seguro de eliminar a "${nombre}"? Esta acción no se puede deshacer.`, async () => {
        const token = localStorage.getItem('jac_token');

        try {
            const res = await fetch(`${API}/afiliados/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const json = await res.json();

            if (!res.ok) {
                mostrarAlertaDash('error', json.error || 'Error al eliminar.');
            } else {
                mostrarAlertaDash('exito', `✅ "${nombre}" fue eliminado correctamente.`);
                cargarAfiliados();
            }
        } catch (err) {
            mostrarAlertaDash('error', 'Error de conexión al servidor.');
        }
    });
}

// ── EDITAR — Abrir modal ──────────────────────────────────
function abrirEditar(id) {
    const a = todosAfiliados.find(x => x.id === id);
    if (!a) return;

    document.getElementById('editId').value = a.id;
    document.getElementById('editNombres').value = a.nombres;
    document.getElementById('editApellidos').value = a.apellidos;
    document.getElementById('editCedula').value = a.cedula;
    document.getElementById('editFechaExp').value = a.fecha_expedicion?.split('T')[0] || '';
    document.getElementById('editGenero').value = a.genero;
    document.getElementById('editEtnia').value = a.etnia || '';
    document.getElementById('editDiscapacidad').value = a.discapacidad || 'Ninguna';
    document.getElementById('editFechaAfil').value = a.fecha_afiliacion?.split('T')[0] || '';
    document.getElementById('editTelefono').value = a.telefono || '';
    document.getElementById('editCorreo').value = a.correo || '';

    document.getElementById('modalEditar').style.display = 'flex';
}

function cerrarModalEditar() {
    document.getElementById('modalEditar').style.display = 'none';
}

// Cerrar al hacer clic fuera
document.getElementById('modalEditar')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalEditar')) cerrarModalEditar();
});

// ── EDITAR — Guardar ──────────────────────────────────────
async function guardarEdicion() {
    const id = document.getElementById('editId').value;
    const token = localStorage.getItem('jac_token');

    const datos = {
        nombres: document.getElementById('editNombres').value.trim(),
        apellidos: document.getElementById('editApellidos').value.trim(),
        cedula: document.getElementById('editCedula').value.trim(),
        fecha_expedicion: document.getElementById('editFechaExp').value,
        genero: document.getElementById('editGenero').value,
        etnia: document.getElementById('editEtnia').value,
        discapacidad: document.getElementById('editDiscapacidad').value,
        fecha_afiliacion: document.getElementById('editFechaAfil').value,
        telefono: document.getElementById('editTelefono').value.trim(),
        correo: document.getElementById('editCorreo').value.trim(),
    };

    if (!datos.nombres || !datos.apellidos || !datos.cedula || !datos.fecha_expedicion || !datos.genero || !datos.fecha_afiliacion) {
        alert('Por favor completa los campos obligatorios.');
        return;
    }

    try {
        const res = await fetch(`${API}/afiliados/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(datos)
        });

        const json = await res.json();

        if (!res.ok) {
            alert(json.error || 'Error al actualizar.');
        } else {
            cerrarModalEditar();
            mostrarAlertaDash('exito', '✅ Afiliado actualizado correctamente.');
            cargarAfiliados();
        }
    } catch (err) {
        alert('Error de conexión al servidor.');
    }
}

// ── Utilidades ───────────────────────────────────────────
function formatFecha(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function mostrarAlertaDash(tipo, msg) {
    const el = document.getElementById('alertaDash');
    document.getElementById('msgDash').textContent = msg;
    el.className = `alert alert-${tipo === 'exito' ? 'success' : 'error'}`;
    el.style.display = 'flex';
    setTimeout(() => el.style.display = 'none', 4000);
}
// ── REGISTRAR DESDE EL PANEL ADMIN ───────────────────────
function usarCedulaComoContrasena() {
    document.getElementById('aContrasena').value = document.getElementById('aCedula').value.trim();
}

async function registrarDesdeAdmin() {
    const token = localStorage.getItem('jac_token');

    const datos = {
        nombres:          document.getElementById('aNombres').value.trim(),
        apellidos:        document.getElementById('aApellidos').value.trim(),
        cedula:           document.getElementById('aCedula').value.trim(),
        contrasena:       document.getElementById('aContrasena').value,
        fecha_expedicion: document.getElementById('aFechaExp').value,
        genero:           document.getElementById('aGenero').value,
        etnia:            document.getElementById('aEtnia').value,
        discapacidad:     document.getElementById('aDiscapacidad').value,
        fecha_afiliacion: document.getElementById('aFechaAfil').value,
        telefono:         document.getElementById('aTelefono').value.trim(),
        correo:           document.getElementById('aCorreo').value.trim(),
    };

    if (!datos.nombres || !datos.apellidos || !datos.cedula || !datos.contrasena || !datos.fecha_expedicion || !datos.genero || !datos.fecha_afiliacion) {
        document.getElementById('msgFormAdmin').textContent = 'Completa los campos obligatorios.';
        document.getElementById('alertaFormAdmin').style.display = 'flex';
        document.getElementById('alertaFormAdminOk').style.display = 'none';
        return;
    }

    if (datos.contrasena.length < 6) {
        document.getElementById('msgFormAdmin').textContent = 'La contraseña debe tener al menos 6 caracteres.';
        document.getElementById('alertaFormAdmin').style.display = 'flex';
        document.getElementById('alertaFormAdminOk').style.display = 'none';
        return;
    }

    try {
        const res = await fetch(`${API}/afiliados`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        const json = await res.json();

        if (!res.ok) {
            document.getElementById('msgFormAdmin').textContent = json.error || 'Error al registrar.';
            document.getElementById('alertaFormAdmin').style.display = 'flex';
            document.getElementById('alertaFormAdminOk').style.display = 'none';
        } else {
            // Limpiar campos
            ['aNombres','aApellidos','aCedula','aContrasena','aFechaExp','aGenero',
             'aEtnia','aDiscapacidad','aFechaAfil','aTelefono','aCorreo']
            .forEach(id => {
                const el = document.getElementById(id);
                if (el.tagName === 'SELECT') el.selectedIndex = 0;
                else el.value = '';
            });
            document.getElementById('alertaFormAdmin').style.display = 'none';
            document.getElementById('msgFormAdminOk').textContent = `✅ ${datos.nombres} ${datos.apellidos} registrado correctamente.`;
            document.getElementById('alertaFormAdminOk').style.display = 'flex';
            setTimeout(() => document.getElementById('alertaFormAdminOk').style.display = 'none', 4000);
            cargarAfiliados(); // Actualiza la tabla automáticamente
        }
    } catch (err) {
        document.getElementById('msgFormAdmin').textContent = 'Error de conexión con el servidor.';
        document.getElementById('alertaFormAdmin').style.display = 'flex';
    }
}

// ── PUBLICAR NOTICIA ─────────────────────────────────────
async function publicarNoticia() {
    const titulo = document.getElementById('nTitulo').value.trim();
    const imagenInput = document.getElementById('nImagen');
    const contenido = document.getElementById('nContenido').value.trim();
    
    const alertaError = document.getElementById('alertaNoticia');
    const alertaOk = document.getElementById('alertaNoticiaOk');
    alertaError.style.display = 'none';
    alertaOk.style.display = 'none';

    if (!titulo || !contenido) {
        alertaError.textContent = 'El título y el contenido son obligatorios.';
        alertaError.style.display = 'block';
        return;
    }

    const token = localStorage.getItem('jac_token');
    const btn = document.getElementById('btnNoticia');
    btn.disabled = true;
    btn.textContent = 'Publicando...';

    const soloAfiliados = document.getElementById('nSoloAfiliados').checked;

    const formData = new FormData();
    formData.append('titulo', titulo);
    formData.append('contenido', contenido);
    formData.append('solo_afiliados', soloAfiliados);

    if (imagenInput.files && imagenInput.files[0]) {
        formData.append('imagen', imagenInput.files[0]);
    }

    try {
        const res = await fetch(`${API}/noticias`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        const data = await res.json();
        
        if (res.ok) {
            let mensajeNotificacion = '';
            if (data.notificacion?.enviado) {
                mensajeNotificacion = ` 📧 Se notificó por correo a ${data.notificacion.destinatarios} afiliado${data.notificacion.destinatarios !== 1 ? 's' : ''}.`;
            } else if (data.notificacion?.motivo === 'smtp_no_configurado') {
                mensajeNotificacion = ' (Correo no configurado: revisa SMTP_* en backend/.env si quieres notificar por email.)';
            }
            alertaOk.textContent = '✅ Noticia publicada exitosamente.' + mensajeNotificacion;
            alertaOk.style.display = 'block';
            document.getElementById('nTitulo').value = '';
            document.getElementById('nImagen').value = '';
            document.getElementById('nContenido').value = '';
            document.getElementById('nSoloAfiliados').checked = false;
            setTimeout(() => alertaOk.style.display = 'none', 6000);
            cargarNoticiasAdmin(); // Actualizar lista
        } else {
            alertaError.textContent = data.error || 'Error al publicar noticia.';
            alertaError.style.display = 'block';
        }
    } catch (error) {
        alertaError.textContent = 'Error de conexión al servidor.';
        alertaError.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Publicar Ahora';
    }
}

// ── GESTIONAR NOTICIAS ──────────────────────────────────
async function cargarNoticiasAdmin() {
    const contenedor = document.getElementById('listaNoticiasAdmin');
    contenedor.innerHTML = `<div class="cargando"><div class="spinner"></div>Cargando noticias...</div>`;
    
    try {
        const token = localStorage.getItem('jac_token');
        const res = await fetch(`${API}/noticias`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const noticias = await res.json();

        if (noticias.length === 0) {
            contenedor.innerHTML = `<p style="color:var(--text-muted); font-size:0.95rem;">No hay noticias publicadas.</p>`;
            return;
        }

        const html = noticias.map(n => `
            <div style="background:var(--bg-light); border:1px solid rgba(0,0,0,0.05); padding:16px; border-radius:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h3 style="color:var(--primary-dark); font-size:1.1rem; margin-bottom:4px;">
                        ${escapeHtml(n.titulo)}
                        ${n.solo_afiliados ? '<span class="badge badge-verde" style="font-size:0.7rem; margin-left:6px;">Solo afiliados</span>' : ''}
                    </h3>
                    <span style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(new Date(n.fecha_publicacion).toLocaleDateString('es-CO'))}</span>
                </div>
                <button class="btn btn-peligro btn-sm" data-accion="eliminar-noticia" data-id="${n.id}" data-titulo="${escapeHtml(n.titulo)}">🗑️ Eliminar</button>
            </div>
        `).join('');

        contenedor.innerHTML = html;
    } catch (err) {
        contenedor.innerHTML = `<p style="color:red;">Error al cargar noticias.</p>`;
    }
}

document.getElementById('listaNoticiasAdmin')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-accion="eliminar-noticia"]');
    if (!btn) return;
    eliminarNoticiaAdmin(Number(btn.dataset.id), btn.dataset.titulo);
});

function eliminarNoticiaAdmin(id, titulo) {
    pedirConfirmacion(`¿Eliminar la noticia: "${titulo}"? Esta acción no se puede deshacer.`, async () => {
        const token = localStorage.getItem('jac_token');
        const alerta = document.getElementById('alertaEliminarOk');

        try {
            const res = await fetch(`${API}/noticias/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();

            if (res.ok) {
                alerta.className = 'alert alert-success';
                alerta.textContent = '✅ Noticia eliminada exitosamente.';
                alerta.style.display = 'block';
                setTimeout(() => alerta.style.display = 'none', 3000);
                cargarNoticiasAdmin();
            } else {
                alerta.className = 'alert alert-error';
                alerta.textContent = json.error || 'Error al eliminar la noticia.';
                alerta.style.display = 'block';
            }
        } catch (err) {
            alerta.className = 'alert alert-error';
            alerta.textContent = 'Error de conexión con el servidor.';
            alerta.style.display = 'block';
        }
    });
}