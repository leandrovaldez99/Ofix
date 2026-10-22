import { sb, $, requerir, cerrarSesion, conCarga, avisar, limpiarAviso, nombreArchivo, subir } from '../comun.js';
import { cargarFicha, llenarFicha, leerFicha, guardarFicha } from '../ficha.js';
import { selectorLocalidad, botonMiUbicacion } from '../ubicacion.js';

const form = $('#form-ficha');
const { user } = await requerir('profesional');
const selector = selectorLocalidad(form);
botonMiUbicacion($('#btn-ubicacion'), selector, (punto, l, err) => {
  if (err) avisar($('#btn-ubicacion'), err.message);
  else limpiarAviso($('#btn-ubicacion'));
});

const ficha = await cargarFicha(user.id);
const { data: dni } = await sb.from('documentos').select('id').eq('profesional_id', user.id).eq('tipo', 'dni').limit(1);
if (ficha && dni?.length) location.replace('trabajos.html');
// Si ya guardó la ficha pero faltó el DNI, se completa lo que había
if (ficha) await llenarFicha(form, ficha, selector);
let existe = !!ficha;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  limpiarAviso(form);
  await conCarga(form.querySelector('[type=submit]'), async () => {
    const datos = leerFicha(form);
    await guardarFicha(user.id, datos, existe);
    existe = true;

    const archivoDni = form.dni.files[0];
    const ruta = await subir('documentos', `${user.id}/${nombreArchivo(archivoDni)}`, archivoDni);
    let r = await sb.from('documentos').insert({ tipo: 'dni', nombre: 'Identidad (DNI)', archivo: ruta });
    if (r.error) throw r.error;

    for (const file of form.certificados.files) {
      const rutaCert = await subir('documentos', `${user.id}/${nombreArchivo(file)}`, file);
      r = await sb.from('documentos').insert({
        tipo: 'certificado',
        nombre: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
        archivo: rutaCert,
      });
      if (r.error) throw r.error;
    }
    location.replace('validacion-pendiente.html');
  }, { error: form.querySelector('[type=submit]') });
});

$('#btn-salir').addEventListener('click', cerrarSesion);
