// Registro de cliente y paso 1 del registro de profesional
import { sb, $, usuarioActual, irAInicio, ingresarConGoogle, avisar, limpiarAviso, conCarga } from '../comun.js';

const form = $('#form-registro');
const rol = form.dataset.rol;

const user = await usuarioActual();
if (user) await irAInicio(user);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  limpiarAviso(form);
  const datos = {
    rol,
    nombre: form.nombre.value.trim(),
    apellido: form.apellido.value.trim(),
    telefono: form.telefono.value.trim(),
  };
  const email = form.email.value.trim();

  await conCarga(form.querySelector('[type=submit]'), async () => {
    // Los datos quedan guardados en la cuenta; el perfil se crea al entrar por primera vez
    const { data, error } = await sb.auth.signUp({
      email,
      password: form.password.value,
      options: { data: datos, emailRedirectTo: new URL('index.html', location.href).href },
    });
    if (error) throw error;

    // Con la confirmación por correo activada, Supabase no avisa si el correo ya existe:
    // devuelve un usuario sin identidades
    if (data.user && data.user.identities?.length === 0) {
      throw new Error('User already registered');
    }
    if (data.session) {
      await irAInicio(data.user);
      return;
    }
    form.hidden = true;
    avisar(form, `Te mandamos un correo a ${email}. Abrí el enlace para confirmar tu cuenta y después ingresá.`, 'green');
  }, { error: form });
});

$('#btn-google').addEventListener('click', async (e) => {
  await conCarga(e.currentTarget, () => ingresarConGoogle(`completar-perfil.html?rol=${rol}`), { error: form });
});
