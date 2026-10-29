// js/registro.js — Lógica del formulario de registro de afiliados

const API = window.location.origin + '/api';

// ── Establecer fecha de hoy como afiliación por defecto ──
document.getElementById('fecha_afiliacion').value = new Date().toISOString().split('T')[0];

// ── Validaciones de campos ───────────────────────────────
const validaciones = {
    nombres: (v) => v.trim().length >= 2,
    apellidos: (v) => v.trim().length >= 2,
    cedula: (v) => /^\d{6,12}$/.test(v.trim()),
    fecha_expedicion: (v) => v !== '',
    genero: (v) => v !== '',
    fecha_afiliacion: (v) => v !== '',
    correo: (v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
};

function validarCampo(id) {
    const el = document.getElementById(id);
    const fn = validaciones[id];
    if (!fn) return true;

    const valido = fn(el.value);
    el.classList.toggle('error', !valido);

    const errEl = document.getElementById('err-' + id);
    if (errEl) errEl.classList.toggle('visible', !valido);

    return valido;
}

function validarTodo() {
    const campos = ['nombres', 'apellidos', 'cedula', 'fecha_expedicion', 'genero', 'fecha_afiliacion', 'correo'];
    let valido = true;
    campos.forEach(c => { if (!validarCampo(c)) valido = false; });
    return valido;
}

// Validación en tiempo real al salir de cada campo
['nombres', 'apellidos', 'cedula', 'fecha_expedicion', 'genero', 'fecha_afiliacion', 'correo']
    .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('blur', () => validarCampo(id));
    });

// ── Envío del formulario ─────────────────────────────────
document.getElementById('formAfiliado').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validarTodo()) return;

    const btn = document.getElementById('btnRegistrar');
    btn.disabled = true;
    btn.textContent = 'Registrando...';

    const datos = {
        nombres: document.getElementById('nombres').value.trim(),
        apellidos: document.getElementById('apellidos').value.trim(),
        cedula: document.getElementById('cedula').value.trim(),
        fecha_expedicion: document.getElementById('fecha_expedicion').value,
        genero: document.getElementById('genero').value,
        etnia: document.getElementById('etnia').value,
        discapacidad: document.getElementById('discapacidad').value,
        fecha_afiliacion: document.getElementById('fecha_afiliacion').value,
        telefono: document.getElementById('telefono').value.trim(),
        correo: document.getElementById('correo').value.trim(),
    };

    try {
        const res = await fetch(`${API}/afiliados`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        const json = await res.json();

        if (!res.ok) {
            mostrarError(json.error || 'Error al registrar.');
        } else {
            document.getElementById('formAfiliado').reset();
            document.getElementById('fecha_afiliacion').value = new Date().toISOString().split('T')[0];
            ocultarError();
            abrirModal();
        }
    } catch (err) {
        mostrarError('No se pudo conectar al servidor. Verifica que el backend esté corriendo.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🌿</span> Registrarme como Afiliado';
    }
});

// ── Modal ───────────────────────────────────────────────
function abrirModal() {
    document.getElementById('modalExito').classList.add('activo');
}

function cerrarModal() {
    document.getElementById('modalExito').classList.remove('activo');
}

// Cerrar modal al hacer clic fuera
document.getElementById('modalExito').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalExito')) cerrarModal();
});

// ── Alertas ──────────────────────────────────────────────
function mostrarError(msg) {
    const el = document.getElementById('alertaError');
    document.getElementById('mensajeError').textContent = msg;
    el.classList.add('visible');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function ocultarError() {
    document.getElementById('alertaError').classList.remove('visible');
}
