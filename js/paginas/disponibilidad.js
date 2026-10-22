import { sb, $, requerir, listo, fallo, redirigir, conCarga, limpiarAviso, avisar, textoError } from '../comun.js';
import { cargarFicha, llenarFicha, leerFicha, guardarFicha } from '../ficha.js';
import { selectorLocalidad, botonMiUbicacion } from '../ubicacion.js';

try {
  const { user } = await requerir('profesional');
  const form = $('#form-ficha');
  const ficha = await cargarFicha(user.id);
  if (!ficha) await redirigir('registro-profesional-2.html');
  const selector = selectorLocalidad(form);
  await llenarFicha(form, ficha, selector);
  botonMiUbicacion($('#btn-ubicacion'), selector, (punto, l, err) => {
    if (err) avisar($('#btn-ubicacion'), err.message);
    else limpiarAviso($('#btn-ubicacion'));
  });

  const { data: yo } = await sb.from('profesionales_publicos').select('disponible_hoy').eq('id', user.id).single();
  const hoy = $('#f-hoy');
  hoy.checked = yo.disponible_hoy;
  hoy.addEventListener('change', async () => {
    const { error } = await sb.rpc('set_disponible_hoy', { p_disponible: hoy.checked });
    if (error) {
      hoy.checked = !hoy.checked;
      avisar(hoy.closest('.card'), textoError(error));
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    limpiarAviso(form.querySelector('[type=submit]'));
    await conCarga(form.querySelector('[type=submit]'), async () => {
      await guardarFicha(user.id, leerFicha(form), true);
      location.href = 'cuenta.html';
    });
  });
  listo();
} catch (err) {
  fallo(err);
}
