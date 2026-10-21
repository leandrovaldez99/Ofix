import { sb, $, usuarioActual, irAInicio, ingresarConGoogle, avisar, limpiarAviso, conCarga, textoError } from '../comun.js';

const form = $('#form-ingreso');

// Si ya hay sesión (o se vuelve de Google), entra directo
const user = await usuarioActual();
if (user) await irAInicio(user);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  limpiarAviso(form);
  const boton = form.querySelector('[type=submit]');
  await conCarga(boton, async () => {
    const { data, error } = await sb.auth.signInWithPassword({
      email: form.email.value.trim(),
      password: form.password.value,
    });
    if (error) throw error;
    await irAInicio(data.user);
  }, { error: form });
});

$('#btn-olvide').addEventListener('click', async (e) => {
  const email = form.email.value.trim();
  if (!email || !form.email.checkValidity()) {
    avisar(form, 'Escribí tu correo arriba y tocá de nuevo "Me olvidé la contraseña".');
    form.email.focus();
    return;
  }
  await conCarga(e.currentTarget, async () => {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: new URL('nueva-contrasena.html', location.href).href,
    });
    if (error) throw error;
    avisar(form, `Te mandamos un correo a ${email} con un enlace para elegir una contraseña nueva.`, 'green');
  }, { error: form });
});

$('#btn-google').addEventListener('click', async (e) => {
  await conCarga(e.currentTarget, () => ingresarConGoogle('index.html'), { error: form });
});

// Errores que vuelven en la dirección (por ejemplo, si se canceló el ingreso con Google)
const errorUrl = new URLSearchParams(location.search).get('error_description')
  || new URLSearchParams(location.hash.slice(1)).get('error_description');
if (errorUrl) avisar(form, textoError(errorUrl));
