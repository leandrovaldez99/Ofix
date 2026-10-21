// Primer ingreso sin perfil (por ejemplo, con Google): rol, nombre y teléfono
import { sb, $, param, usuarioActual, cargarPerfil, irAInicio, cerrarSesion, conCarga, limpiarAviso } from '../comun.js';

const form = $('#form-perfil');
const user = await usuarioActual();
if (!user) location.replace('index.html');
else if (await cargarPerfil(user.id)) await irAInicio(user);

// Datos que trae Google
const m = user?.user_metadata || {};
const partes = (m.full_name || m.name || '').trim().split(/\s+/);
form.nombre.value = m.nombre || m.given_name || partes[0] || '';
form.apellido.value = m.apellido || m.family_name || partes.slice(1).join(' ') || '';
form.telefono.value = m.telefono || '';
const rol = param('rol') || m.rol;
if (rol) form.querySelector(`[name=rol][value="${rol === 'profesional' ? 'profesional' : 'cliente'}"]`).checked = true;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  limpiarAviso(form);
  await conCarga(form.querySelector('[type=submit]'), async () => {
    const { error } = await sb.from('perfiles').insert({
      id: user.id,
      rol: form.rol.value,
      nombre: form.nombre.value.trim(),
      apellido: form.apellido.value.trim(),
    });
    if (error) throw error;
    const { error: e2 } = await sb.from('contactos').insert({ id: user.id, telefono: form.telefono.value.trim() });
    if (e2) throw e2;
    await irAInicio(user);
  }, { error: form });
});

$('#btn-salir').addEventListener('click', cerrarSesion);
