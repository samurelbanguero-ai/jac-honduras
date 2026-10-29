// js/comunidad-admin.js — Lógica del panel de administrador para el módulo Comunidad
// (PQRS, Aportes, Votaciones, Eventos, Documentos, Avisos). Depende de admin.js
// para API, escapeHtml, formatFecha, mostrarAlertaDash y pedirConfirmacion.

window.addEventListener('load', () => {
    const token = localStorage.getItem('jac_token');
    if (!token) return;

    cargarPqrsAdmin();
    cargarSelectAfiliadosAporte();
    cargarAportesAdmin();
    cargarEncuestasAdmin();
    cargarEventosAdmin();
    cargarDocumentosAdmin();
    cargarAvisosAdmin();
});

function tokenAdmin() {
    return localStorage.getItem('jac_token');
}

// ══════════════════════════════════════════════════════════
// PQRS
// ══════════════════════════════════════════════════════════
async function cargarPqrsAdmin() {
    const contenedor = document.getElementById('listaPqrsAdmin');
    try {
        const res = await fetch(`${API}/comunidad/pqrs`, { headers: { 'Authorization': `Bearer ${tokenAdmin()}` } });
        const lista = await res.json();

        if (!Array.isArray(lista) || lista.length === 0) {
            contenedor.innerHTML = '<p style="color:var(--text-muted);">No hay solicitudes registradas.</p>';
            return;
        }

        contenedor.innerHTML = lista.map(p => `
            <div style="background:var(--bg-light); border:1px solid rgba(0,0,0,0.05); padding:16px; border-radius:12px; margin-bottom:12px;">
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">
                    ${escapeHtml(p.tipo)} · ${escapeHtml(p.nombres)} ${escapeHtml(p.apellidos)} (${escapeHtml(p.cedula)}) · ${formatFecha(p.fecha)}
                    <span class="estado-badge estado-${p.estado}" style="margin-left:8px;">${escapeHtml(p.estado)}</span>
                </div>
                <div style="font-weight:700; color:var(--primary-dark); margin-bottom:4px;">${escapeHtml(p.asunto)}</div>
                <div style="font-size:0.9rem; color:var(--text-main); margin-bottom:10px;">${escapeHtml(p.mensaje)}</div>
                ${p.respuesta
                    ? `<div class="pqrs-respuesta"><strong>Tu respuesta:</strong><br>${escapeHtml(p.respuesta)}</div>`
                    : `<div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <textarea id="resp-${p.id}" placeholder="Escribe tu respuesta..." style="flex:1; min-height:70px;"></textarea>
                        <button class="btn btn-primary btn-sm" data-accion="responder-pqrs" data-id="${p.id}">Responder</button>
                       </div>`}
            </div>
        `).join('');
    } catch (err) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar las solicitudes.</p>';
    }
}

document.getElementById('listaPqrsAdmin')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-accion="responder-pqrs"]');
    if (!btn) return;
    const id = btn.dataset.id;
    const textarea = document.getElementById(`resp-${id}`);
    const respuesta = textarea.value.trim();
    if (!respuesta) { alert('Escribe una respuesta antes de enviar.'); return; }

    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
        const res = await fetch(`${API}/comunidad/pqrs/${id}/responder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin()}` },
            body: JSON.stringify({ respuesta })
        });
        const data = await res.json();
        if (res.ok) {
            mostrarAlertaDash('exito', '✅ Respuesta enviada al afiliado.');
            cargarPqrsAdmin();
        } else {
            alert(data.error || 'Error al enviar la respuesta.');
            btn.disabled = false;
            btn.textContent = 'Responder';
        }
    } catch (err) {
        alert('Error de conexión con el servidor.');
        btn.disabled = false;
        btn.textContent = 'Responder';
    }
});

// ══════════════════════════════════════════════════════════
// APORTES
// ══════════════════════════════════════════════════════════
async function cargarSelectAfiliadosAporte() {
    const select = document.getElementById('apAfiliado');
    if (!select) return;
    try {
        const res = await fetch(`${API}/afiliados`, { headers: { 'Authorization': `Bearer ${tokenAdmin()}` } });
        const lista = await res.json();
        select.innerHTML = '<option value="">— Seleccionar —</option>' +
            lista.map(a => `<option value="${a.id}">${escapeHtml(a.nombres)} ${escapeHtml(a.apellidos)} — ${escapeHtml(a.cedula)}</option>`).join('');
    } catch (err) {
        // El formulario simplemente queda con el select vacío
    }
}

async function registrarAporte() {
    const afiliado_id = document.getElementById('apAfiliado').value;
    const concepto = document.getElementById('apConcepto').value.trim();
    const valor = document.getElementById('apValor').value;
    const fecha = document.getElementById('apFecha').value;
    const estado = document.getElementById('apEstado').value;

    const alertaError = document.getElementById('alertaAporte');
    const alertaOk = document.getElementById('alertaAporteOk');
    alertaError.style.display = 'none';
    alertaOk.style.display = 'none';

    if (!afiliado_id || !concepto || !valor) {
        alertaError.textContent = 'Selecciona el afiliado y completa el concepto y el valor.';
        alertaError.style.display = 'block';
        return;
    }

    try {
        const res = await fetch(`${API}/comunidad/aportes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin()}` },
            body: JSON.stringify({ afiliado_id, concepto, valor, fecha: fecha || undefined, estado })
        });
        const data = await res.json();

        if (res.ok) {
            alertaOk.textContent = '✅ Aporte registrado correctamente.';
            alertaOk.style.display = 'block';
            document.getElementById('apConcepto').value = '';
            document.getElementById('apValor').value = '';
            document.getElementById('apFecha').value = '';
            cargarAportesAdmin();
        } else {
            alertaError.textContent = data.error || 'Error al registrar el aporte.';
            alertaError.style.display = 'block';
        }
    } catch (err) {
        alertaError.textContent = 'Error de conexión con el servidor.';
        alertaError.style.display = 'block';
    }
}

async function cargarAportesAdmin() {
    const contenedor = document.getElementById('listaAportesAdmin');
    const formatoCOP = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

    try {
        const res = await fetch(`${API}/comunidad/aportes`, { headers: { 'Authorization': `Bearer ${tokenAdmin()}` } });
        const lista = await res.json();

        if (!Array.isArray(lista) || lista.length === 0) {
            contenedor.innerHTML = '<p style="color:var(--text-muted);">No hay aportes registrados aún.</p>';
            return;
        }

        contenedor.innerHTML = lista.map(a => `
            <div class="aporte-fila">
                <div>
                    <strong>${escapeHtml(a.nombres)} ${escapeHtml(a.apellidos)}</strong><br>
                    <span style="font-size:0.8rem; color:var(--text-light);">${escapeHtml(a.concepto)} · ${formatFecha(a.fecha)}</span>
                </div>
                <span class="estado-badge estado-${a.estado}">${escapeHtml(a.estado)}</span>
                <span class="aporte-valor">${formatoCOP(a.valor)}</span>
            </div>
        `).join('');
    } catch (err) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar los aportes.</p>';
    }
}

// ══════════════════════════════════════════════════════════
// VOTACIONES
// ══════════════════════════════════════════════════════════
async function crearEncuestaAdmin() {
    const pregunta = document.getElementById('enPregunta').value.trim();
    const opcion_a = document.getElementById('enOpcionA').value.trim();
    const opcion_b = document.getElementById('enOpcionB').value.trim();

    const alertaError = document.getElementById('alertaEncuesta');
    const alertaOk = document.getElementById('alertaEncuestaOk');
    alertaError.style.display = 'none';
    alertaOk.style.display = 'none';

    if (!pregunta || !opcion_a || !opcion_b) {
        alertaError.textContent = 'Completa la pregunta y las dos opciones.';
        alertaError.style.display = 'block';
        return;
    }

    try {
        const res = await fetch(`${API}/comunidad/encuestas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin()}` },
            body: JSON.stringify({ pregunta, opcion_a, opcion_b })
        });
        const data = await res.json();

        if (res.ok) {
            alertaOk.textContent = '✅ Votación creada correctamente.';
            alertaOk.style.display = 'block';
            document.getElementById('enPregunta').value = '';
            document.getElementById('enOpcionA').value = '';
            document.getElementById('enOpcionB').value = '';
            cargarEncuestasAdmin();
        } else {
            alertaError.textContent = data.error || 'Error al crear la votación.';
            alertaError.style.display = 'block';
        }
    } catch (err) {
        alertaError.textContent = 'Error de conexión con el servidor.';
        alertaError.style.display = 'block';
    }
}

async function cargarEncuestasAdmin() {
    const contenedor = document.getElementById('listaEncuestasAdmin');
    try {
        const res = await fetch(`${API}/comunidad/encuestas`, { headers: { 'Authorization': `Bearer ${tokenAdmin()}` } });
        const lista = await res.json();

        if (!Array.isArray(lista) || lista.length === 0) {
            contenedor.innerHTML = '<p style="color:var(--text-muted);">No hay votaciones creadas aún.</p>';
            return;
        }

        contenedor.innerHTML = lista.map(e => {
            const total = e.total_votos || 0;
            const pctA = total ? Math.round((e.votos_a / total) * 100) : 0;
            const pctB = total ? Math.round((e.votos_b / total) * 100) : 0;
            return `
            <div class="encuesta-card ${e.activa ? '' : 'encuesta-cerrada'}">
                <div class="encuesta-pregunta">${escapeHtml(e.pregunta)}</div>
                <div class="encuesta-resultado">
                    <div class="encuesta-resultado-fila"><span>${escapeHtml(e.opcion_a)}</span><span>${pctA}% (${e.votos_a})</span></div>
                    <div class="encuesta-barra-fondo"><div class="encuesta-barra" style="width:${pctA}%;"></div></div>
                    <div class="encuesta-resultado-fila"><span>${escapeHtml(e.opcion_b)}</span><span>${pctB}% (${e.votos_b})</span></div>
                    <div class="encuesta-barra-fondo"><div class="encuesta-barra" style="width:${pctB}%;"></div></div>
                </div>
                <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; align-items:center;">
                    <span class="encuesta-meta" style="margin:0;">${e.activa ? '🟢 Abierta' : '🔴 Cerrada'} · ${total} voto${total !== 1 ? 's' : ''}</span>
                    ${e.activa ? `<button class="btn btn-sm" style="background:var(--bg-light); color:var(--primary-dark); border:1px solid rgba(13,92,53,0.15);" data-accion="cerrar-encuesta" data-id="${e.id}">🔒 Cerrar Votación</button>` : ''}
                    <button class="btn btn-peligro btn-sm" data-accion="eliminar-encuesta" data-id="${e.id}" data-pregunta="${escapeHtml(e.pregunta)}">🗑️ Eliminar</button>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar las votaciones.</p>';
    }
}

document.getElementById('listaEncuestasAdmin')?.addEventListener('click', (e) => {
    const cerrarBtn = e.target.closest('button[data-accion="cerrar-encuesta"]');
    const eliminarBtn = e.target.closest('button[data-accion="eliminar-encuesta"]');

    if (cerrarBtn) {
        pedirConfirmacion('¿Cerrar esta votación? Los afiliados ya no podrán votar.', async () => {
            await fetch(`${API}/comunidad/encuestas/${cerrarBtn.dataset.id}/cerrar`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${tokenAdmin()}` }
            });
            mostrarAlertaDash('exito', '✅ Votación cerrada.');
            cargarEncuestasAdmin();
        }, { titulo: '🔒 Confirmar Cierre de Votación', textoBoton: '🔒 Sí, Cerrar' });
    } else if (eliminarBtn) {
        pedirConfirmacion(`¿Eliminar la votación "${eliminarBtn.dataset.pregunta}"? Esta acción no se puede deshacer.`, async () => {
            await fetch(`${API}/comunidad/encuestas/${eliminarBtn.dataset.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${tokenAdmin()}` }
            });
            mostrarAlertaDash('exito', '✅ Votación eliminada.');
            cargarEncuestasAdmin();
        });
    }
});

// ══════════════════════════════════════════════════════════
// EVENTOS / CONVITES
// ══════════════════════════════════════════════════════════
async function crearEventoAdmin() {
    const titulo = document.getElementById('evTitulo').value.trim();
    const fecha = document.getElementById('evFecha').value;
    const lugar = document.getElementById('evLugar').value.trim();
    const descripcion = document.getElementById('evDescripcion').value.trim();

    const alertaError = document.getElementById('alertaEvento');
    const alertaOk = document.getElementById('alertaEventoOk');
    alertaError.style.display = 'none';
    alertaOk.style.display = 'none';

    if (!titulo || !fecha) {
        alertaError.textContent = 'El título y la fecha son obligatorios.';
        alertaError.style.display = 'block';
        return;
    }

    try {
        const res = await fetch(`${API}/comunidad/eventos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin()}` },
            body: JSON.stringify({ titulo, fecha, lugar, descripcion })
        });
        const data = await res.json();

        if (res.ok) {
            alertaOk.textContent = '✅ Evento programado correctamente.';
            alertaOk.style.display = 'block';
            document.getElementById('evTitulo').value = '';
            document.getElementById('evFecha').value = '';
            document.getElementById('evLugar').value = '';
            document.getElementById('evDescripcion').value = '';
            cargarEventosAdmin();
        } else {
            alertaError.textContent = data.error || 'Error al programar el evento.';
            alertaError.style.display = 'block';
        }
    } catch (err) {
        alertaError.textContent = 'Error de conexión con el servidor.';
        alertaError.style.display = 'block';
    }
}

async function cargarEventosAdmin() {
    const contenedor = document.getElementById('listaEventosAdmin');
    try {
        const res = await fetch(`${API}/comunidad/eventos`, { headers: { 'Authorization': `Bearer ${tokenAdmin()}` } });
        const lista = await res.json();

        if (!Array.isArray(lista) || lista.length === 0) {
            contenedor.innerHTML = '<p style="color:var(--text-muted);">No hay eventos programados.</p>';
            return;
        }

        contenedor.innerHTML = lista.map(e => `
            <div class="evento-item">
                <h3>${escapeHtml(e.titulo)}</h3>
                <div class="meta">📅 ${escapeHtml(new Date(e.fecha).toLocaleString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}
                    ${e.lugar ? ' · 📍 ' + escapeHtml(e.lugar) : ''} · 🙋 ${e.total_inscritos} inscrito${e.total_inscritos !== 1 ? 's' : ''}
                </div>
                ${e.descripcion ? `<p>${escapeHtml(e.descripcion)}</p>` : ''}
                <button class="btn btn-peligro btn-sm" data-accion="eliminar-evento" data-id="${e.id}" data-titulo="${escapeHtml(e.titulo)}">🗑️ Eliminar</button>
            </div>
        `).join('');
    } catch (err) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar los eventos.</p>';
    }
}

document.getElementById('listaEventosAdmin')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-accion="eliminar-evento"]');
    if (!btn) return;
    pedirConfirmacion(`¿Eliminar el evento "${btn.dataset.titulo}"? Esta acción no se puede deshacer.`, async () => {
        await fetch(`${API}/comunidad/eventos/${btn.dataset.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${tokenAdmin()}` }
        });
        mostrarAlertaDash('exito', '✅ Evento eliminado.');
        cargarEventosAdmin();
    });
});

// ══════════════════════════════════════════════════════════
// DOCUMENTOS / ACTAS
// ══════════════════════════════════════════════════════════
async function subirDocumentoAdmin() {
    const nombre = document.getElementById('docNombre').value.trim();
    const tipo = document.getElementById('docTipo').value;
    const archivoInput = document.getElementById('docArchivo');

    const alertaError = document.getElementById('alertaDocumento');
    const alertaOk = document.getElementById('alertaDocumentoOk');
    alertaError.style.display = 'none';
    alertaOk.style.display = 'none';

    if (!nombre || !archivoInput.files || !archivoInput.files[0]) {
        alertaError.textContent = 'El nombre y el archivo PDF son obligatorios.';
        alertaError.style.display = 'block';
        return;
    }

    const formData = new FormData();
    formData.append('nombre', nombre);
    formData.append('tipo', tipo);
    formData.append('archivo', archivoInput.files[0]);

    try {
        const res = await fetch(`${API}/comunidad/documentos`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenAdmin()}` },
            body: formData
        });
        const data = await res.json();

        if (res.ok) {
            alertaOk.textContent = '✅ Documento subido correctamente.';
            alertaOk.style.display = 'block';
            document.getElementById('docNombre').value = '';
            archivoInput.value = '';
            cargarDocumentosAdmin();
        } else {
            alertaError.textContent = data.error || 'Error al subir el documento.';
            alertaError.style.display = 'block';
        }
    } catch (err) {
        alertaError.textContent = 'Error de conexión con el servidor.';
        alertaError.style.display = 'block';
    }
}

async function cargarDocumentosAdmin() {
    const contenedor = document.getElementById('listaDocumentosAdmin');
    try {
        const res = await fetch(`${API}/comunidad/documentos`, { headers: { 'Authorization': `Bearer ${tokenAdmin()}` } });
        const lista = await res.json();

        if (!Array.isArray(lista) || lista.length === 0) {
            contenedor.innerHTML = '<p style="color:var(--text-muted);">No hay documentos publicados aún.</p>';
            return;
        }

        contenedor.innerHTML = lista.map(d => `
            <div class="documento-item">
                <div>
                    <div class="nombre">📄 ${escapeHtml(d.nombre)}</div>
                    <div class="meta">${escapeHtml(d.tipo)} · ${formatFecha(d.fecha)}</div>
                </div>
                <div style="display:flex; gap:8px;">
                    <a class="btn btn-sm" style="background:var(--bg-light); color:var(--primary-dark); border:1px solid rgba(13,92,53,0.15);" href="${escapeHtml(d.archivo_url)}" target="_blank" rel="noopener">👁 Ver</a>
                    <button class="btn btn-peligro btn-sm" data-accion="eliminar-documento" data-id="${d.id}" data-nombre="${escapeHtml(d.nombre)}">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar los documentos.</p>';
    }
}

document.getElementById('listaDocumentosAdmin')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-accion="eliminar-documento"]');
    if (!btn) return;
    pedirConfirmacion(`¿Eliminar el documento "${btn.dataset.nombre}"? Esta acción no se puede deshacer.`, async () => {
        await fetch(`${API}/comunidad/documentos/${btn.dataset.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${tokenAdmin()}` }
        });
        mostrarAlertaDash('exito', '✅ Documento eliminado.');
        cargarDocumentosAdmin();
    });
});

// ══════════════════════════════════════════════════════════
// AVISOS URGENTES (NOTIFICACIONES)
// ══════════════════════════════════════════════════════════
async function crearAvisoAdmin() {
    const titulo = document.getElementById('avTitulo').value.trim();
    const mensaje = document.getElementById('avMensaje').value.trim();

    const alertaError = document.getElementById('alertaAviso');
    const alertaOk = document.getElementById('alertaAvisoOk');
    alertaError.style.display = 'none';
    alertaOk.style.display = 'none';

    if (!titulo || !mensaje) {
        alertaError.textContent = 'El título y el mensaje son obligatorios.';
        alertaError.style.display = 'block';
        return;
    }

    try {
        const res = await fetch(`${API}/comunidad/notificaciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin()}` },
            body: JSON.stringify({ titulo, mensaje })
        });
        const data = await res.json();

        if (res.ok) {
            alertaOk.textContent = '✅ Aviso enviado a la comunidad.';
            alertaOk.style.display = 'block';
            document.getElementById('avTitulo').value = '';
            document.getElementById('avMensaje').value = '';
            cargarAvisosAdmin();
        } else {
            alertaError.textContent = data.error || 'Error al enviar el aviso.';
            alertaError.style.display = 'block';
        }
    } catch (err) {
        alertaError.textContent = 'Error de conexión con el servidor.';
        alertaError.style.display = 'block';
    }
}

async function cargarAvisosAdmin() {
    const contenedor = document.getElementById('listaAvisosAdmin');
    try {
        const res = await fetch(`${API}/comunidad/notificaciones`, { headers: { 'Authorization': `Bearer ${tokenAdmin()}` } });
        const lista = await res.json();

        if (!Array.isArray(lista) || lista.length === 0) {
            contenedor.innerHTML = '<p style="color:var(--text-muted);">No hay avisos enviados aún.</p>';
            return;
        }

        contenedor.innerHTML = lista.map(a => `
            <div style="background:var(--bg-light); border:1px solid rgba(0,0,0,0.05); padding:16px; border-radius:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; gap:12px;">
                <div>
                    <h3 style="color:var(--primary-dark); font-size:1.05rem; margin-bottom:4px;">${escapeHtml(a.titulo)}</h3>
                    <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:4px;">${escapeHtml(a.mensaje)}</p>
                    <span style="font-size:0.78rem; color:var(--text-light);">${formatFecha(a.fecha)}</span>
                </div>
                <button class="btn btn-peligro btn-sm" data-accion="eliminar-aviso" data-id="${a.id}" data-titulo="${escapeHtml(a.titulo)}">🗑️</button>
            </div>
        `).join('');
    } catch (err) {
        contenedor.innerHTML = '<p style="color:red;">Error al cargar los avisos.</p>';
    }
}

document.getElementById('listaAvisosAdmin')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-accion="eliminar-aviso"]');
    if (!btn) return;
    pedirConfirmacion(`¿Eliminar el aviso "${btn.dataset.titulo}"? Esta acción no se puede deshacer.`, async () => {
        await fetch(`${API}/comunidad/notificaciones/${btn.dataset.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${tokenAdmin()}` }
        });
        mostrarAlertaDash('exito', '✅ Aviso eliminado.');
        cargarAvisosAdmin();
    });
});
