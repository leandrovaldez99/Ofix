import {
  sb, $, esc, requerir, listo, fallo, redirigir, conCarga, avisar, nombreArchivo, subir,
  OFICIOS, iniciales, rating, estrellas, hace, nombreCompleto, nombreCorto,
} from '../comun.js';
import { resumenHorarios } from '../ficha.js';
import { estadoDocumento } from '../documentos.js';
import { iniciarDatosPersonales, iniciarCuenta } from '../datos-personales.js';

try {
  const { user, perfil } = await requerir('profesional');
  const [{ data: yo }, { data: horarios }, { data: resenas }] = await Promise.all([
    sb.from('profesionales_publicos').select('*').eq('id', user.id).maybeSingle(),
    sb.from('horarios').select('*').eq('profesional_id', user.id),
    sb.from('resenas').select('puntaje, comentario, created_at, cliente:perfiles!resenas_cliente_id_fkey(nombre, apellido)')
      .eq('profesional_id', user.id).order('created_at', { ascending: false }).limit(20),
  ]);
  if (!yo) await redirigir('registro-profesional-2.html');

  const pintarNombre = (p) => {
    $('#av').textContent = iniciales(p);
    $('#nombre').textContent = nombreCompleto(p);
    $('.sitebar .user').textContent = nombreCompleto(p);
  };
  pintarNombre(perfil);
  $('#oficios').textContent = yo.oficios.map((o) => OFICIOS[o]).join(' · ');
  $('#rating').innerHTML = rating(yo.promedio, yo.cantidad_resenas, `${yo.servicios} ${yo.servicios === 1 ? 'servicio' : 'servicios'}`);
  $('#estado').innerHTML = {
    validado: '<span class="chip green">Perfil validado</span>',
    pendiente: '<span class="chip warn">Pendiente de validación</span>',
    rechazado: '<span class="chip clay">Validación rechazada</span>',
  }[yo.estado_validacion];
  $('#zona').textContent = `${yo.localidad} · ${yo.radio_km} km · ${resumenHorarios(horarios || [])}`;

  // ---------- Documentos ----------

  async function pintarDocs() {
    const { data: docs } = await sb.from('documentos').select('*').eq('profesional_id', user.id).order('created_at');
    $('#docs').innerHTML = (docs || []).map((d) => `
      <div class="row small"><span class="grow">${esc(d.nombre)}${d.entidad ? ` · ${esc(d.entidad)}` : ''}</span>${estadoDocumento(d.estado)}</div>`).join('')
      || '<p class="small muted">Todavía no subiste documentos.</p>';
  }
  await pintarDocs();

  const formCert = $('#form-cert');
  formCert.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!formCert.reportValidity()) return;
    await conCarga(formCert.querySelector('[type=submit]'), async () => {
      const file = formCert.archivo.files[0];
      const ruta = await subir('documentos', `${user.id}/${nombreArchivo(file)}`, file);
      const { error } = await sb.from('documentos').insert({
        tipo: 'certificado',
        nombre: formCert['cert-nombre'].value.trim(),
        entidad: formCert['cert-entidad'].value.trim() || null,
        archivo: ruta,
      });
      if (error) throw error;
      formCert.reset();
      formCert.closest('details').open = false;
      await pintarDocs();
      avisar($('#docs'), 'Lo recibimos. Te avisamos cuando esté revisado.', 'green');
    }, { error: formCert });
  });

  // ---------- Reseñas ----------

  $('#resenas').innerHTML = `<h2 class="section-title">Mis reseñas <span class="muted">· ${yo.cantidad_resenas}</span></h2>
    ${(resenas || []).map((r) => `
      <div class="card">
        <div class="row"><b class="small">${esc(r.cliente ? nombreCorto(r.cliente) : 'Cliente')}</b><span class="ml-auto">${estrellas(r.puntaje, 12)}</span></div>
        ${r.comentario ? `<p class="small" style="margin-top:6px">${esc(r.comentario)}</p>` : ''}
        <div class="xsmall muted" style="margin-top:5px">${esc(hace(r.created_at))}</div>
      </div>`).join('') || '<div class="card small muted">Cuando termines un trabajo, el cliente te puede calificar.</div>'}`;

  await iniciarDatosPersonales($('#form-datos'), user, perfil, pintarNombre);
  iniciarCuenta();
  listo();
} catch (err) {
  fallo(err);
}
