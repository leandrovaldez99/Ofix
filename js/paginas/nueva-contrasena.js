// Se llega desde el enlace del correo "Me olvidé la contraseña"
import { sb, $, usuarioActual, irAInicio, conCarga, avisar } from '../comun.js';

const form = $('#form-clave');
const user = await usuarioActual();
if (!user) {
  form.hidden = true;
  avisar(form, 'El enlace venció o ya se usó. Volvé a pedir uno desde la pantalla de ingreso.');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  await conCarga(form.querySelector('[type=submit]'), async () => {
    const { error } = await sb.auth.updateUser({ password: form.password.value });
    if (error) throw error;
    await irAInicio(user);
  }, { error: form });
});
