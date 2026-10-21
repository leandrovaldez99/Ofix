// "Datos personales", cerrar sesión y eliminar cuenta: perfil del cliente y cuenta del profesional
import { sb, $, conCarga, limpiarAviso, avisar, alConfirmar, cerrarSesion, eliminarCuenta } from './comun.js';

export async function iniciarDatosPersonales(form, user, perfil, alGuardar) {
  const { data: contacto } = await sb.from('contactos').select('telefono').eq('id', user.id).maybeSingle();
  form.nombre.value = perfil.nombre;
  form.apellido.value = perfil.apellido;
  form.email.value = user.email;
  form.telefono.value = contacto?.telefono || '';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    limpiarAviso(form);
    await conCarga(form.querySelector('[type=submit]'), async () => {
      const nombre = form.nombre.value.trim();
      const apellido = form.apellido.value.trim();
      let r = await sb.from('perfiles').update({ nombre, apellido }).eq('id', user.id);
      if (r.error) throw r.error;

      const telefono = form.telefono.value.trim();
      r = await sb.from('contactos').update({ telefono }).eq('id', user.id).select();
      if (r.error) throw r.error;
      if (!r.data.length) {
        r = await sb.from('contactos').insert({ id: user.id, telefono });
        if (r.error) throw r.error;
      }

      const mensajes = ['Guardamos tus datos.'];
      const cambios = {};
      const email = form.email.value.trim();
      if (email !== user.email) cambios.email = email;
      if (form.password.value) cambios.password = form.password.value;
      if (Object.keys(cambios).length) {
        const { error } = await sb.auth.updateUser(cambios, {
          emailRedirectTo: new URL('index.html', location.href).href,
        });
        if (error) throw error;
        if (cambios.email) mensajes.push(`Para cambiar el correo, abrí el enlace que te mandamos a ${email}.`);
        if (cambios.password) mensajes.push('La contraseña nueva ya está activa.');
        form.password.value = '';
      }
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
