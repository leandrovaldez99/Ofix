// "Datos personales", cerrar sesión y eliminar cuenta: perfil del cliente y cuenta del profesional
import { sb, $, conCarga, limpiarAviso, avisar, alConfirmar, cerrarSesion, eliminarCuenta } from './comun.js';

export async function iniciarDatosPersonales(form, user, perfil, alGuardar) {
  const { data: contacto } = await sb.from('contactos').select('telefono').eq('id', user.id).maybeSingle();
  const CAMPOS = ['nombre', 'apellido', 'email', 'telefono'];
  let actuales = {
    nombre: perfil.nombre,
    apellido: perfil.apellido,
    email: user.email,
    telefono: contacto?.telefono || '',
  };
  const acciones = form.querySelector('#acciones-datos');
  const btnPassword = form.querySelector('#btn-cambiar-password');
  const bloquesPassword = [...form.querySelectorAll('[data-password]')];

  function cerrarEdicion() {
    for (const campo of CAMPOS) {
      form[campo].value = actuales[campo];
      form[campo].readOnly = true;
      form[campo].closest('.campo-editable').classList.remove('editando');
    }
    bloquesPassword.forEach((b) => { b.hidden = true; });
    form.password.value = '';
    form.password2.value = '';
    form.password.required = false;
    form.password2.required = false;
    form.password2.setCustomValidity('');
    btnPassword.hidden = false;
    acciones.hidden = true;
  }
  cerrarEdicion();

  // El lápiz habilita solo ese campo
  form.addEventListener('click', (e) => {
    const lapiz = e.target.closest('[data-editar]');
    if (!lapiz) return;
    const input = form[lapiz.dataset.editar];
    input.readOnly = false;
    lapiz.closest('.campo-editable').classList.add('editando');
    acciones.hidden = false;
    input.focus();
    input.select();
  });

  btnPassword.addEventListener('click', () => {
    bloquesPassword.forEach((b) => { b.hidden = false; });
    form.password.required = true;
    form.password2.required = true;
    btnPassword.hidden = true;
    acciones.hidden = false;
    form.password.focus();
  });
  form.password2.addEventListener('input', () => form.password2.setCustomValidity(''));
  form.password.addEventListener('input', () => form.password2.setCustomValidity(''));

  form.querySelector('#btn-cancelar-datos').addEventListener('click', () => {
    limpiarAviso(form);
    cerrarEdicion();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cambiaPassword = !bloquesPassword[0].hidden;
    if (cambiaPassword && form.password.value !== form.password2.value) {
      form.password2.setCustomValidity('Las contraseñas no coinciden.');
    }
    if (!form.reportValidity()) return;
    limpiarAviso(form);
    await conCarga(form.querySelector('[type=submit]'), async () => {
      const nombre = form.nombre.value.trim();
      const apellido = form.apellido.value.trim();
      if (nombre !== actuales.nombre || apellido !== actuales.apellido) {
        const r = await sb.from('perfiles').update({ nombre, apellido }).eq('id', user.id);
        if (r.error) throw r.error;
      }

      const telefono = form.telefono.value.trim();
      if (telefono !== actuales.telefono) {
        let r = await sb.from('contactos').update({ telefono }).eq('id', user.id).select();
        if (r.error) throw r.error;
        if (!r.data.length) {
          r = await sb.from('contactos').insert({ id: user.id, telefono });
          if (r.error) throw r.error;
        }
      }

      const mensajes = ['Guardamos tus datos.'];
      const cambios = {};
      const email = form.email.value.trim();
      if (email !== user.email) cambios.email = email;
      if (cambiaPassword) cambios.password = form.password.value;
      if (Object.keys(cambios).length) {
        const { error } = await sb.auth.updateUser(cambios, {
          emailRedirectTo: new URL('index.html', location.href).href,
        });
        if (error) throw error;
        if (cambios.email) mensajes.push(`Para cambiar el correo, abrí el enlace que te mandamos a ${email}.`);
        if (cambios.password) mensajes.push('La contraseña nueva ya está activa.');
      }

      // El correo cambia recién cuando se confirma desde el mail
      actuales = { nombre, apellido, telefono, email: user.email };
      cerrarEdicion();
      alGuardar?.({ ...perfil, nombre, apellido });
      avisar(form, mensajes.join(' '), 'green');
    }, { error: form });
  });
}

export function iniciarCuenta() {
  $('#btn-salir')?.addEventListener('click', (e) => {
    e.preventDefault();
    cerrarSesion();
  });
  alConfirmar('eliminar', eliminarCuenta);
}
