import {
  sb, $, esc, param, requerir, listo, fallo, OFICIOS, km, hace,
} from '../comun.js';
import { icono } from '../iconos.js';

try {
  const { user } = await requerir('profesional');
  const id = Number(param('id'));
  const { data: oferta } = await sb.from('ofertas')
    .select('*, pedido:pedidos(id, titulo, oficio_id, localidad, provincia, estado, modo, profesional_id)')
    .eq('pedido_id', id).eq('profesional_id', user.id).maybeSingle();
  const p = oferta?.pedido;

  let motivo = 'Otro profesional tomó este pedido mientras tenía la prioridad. Lo recibe quien lo aceptó primero dentro de su turno.';
  if (!p) motivo = 'Este pedido ya no está disponible.';
  else if (p.estado === 'cancelado') motivo = 'El cliente canceló este pedido.';
  else if (oferta.estado === 'rechazada') motivo = 'Rechazaste este pedido o el cliente prefirió a otro profesional.';
  else if (p.estado === 'buscando') motivo = 'Pasaron los 30 minutos y la oferta venció.';

  if (p) {
    $('#titulo').textContent = `Pedido #${p.id}`;
    $('#sub').textContent = `Recibido ${hace(oferta.visible_desde)}`;
  }

  $('#contenido').innerHTML = `
    ${p ? `<div class="card">
      <div class="row wrap" style="gap:7px"><span class="chip green">${esc(OFICIOS[p.oficio_id])}</span>${oferta.elegido ? '<span class="chip dark">Te eligieron</span>' : '<span class="chip clay">Urgente</span>'}</div>
      <p style="margin-top:10px;font-size:17px;font-weight:700;font-family:var(--display)">${esc(p.titulo)}</p>
      <div class="kv" style="margin-top:10px">${icono.ubicacion()}<div class="muted">${esc([`${p.localidad}, ${p.provincia}`, oferta.distancia_km != null && `${km(oferta.distancia_km)} tuyo`].filter(Boolean).join(' · '))}</div></div>
    </div>` : ''}
    <div class="card">
      <div class="status gray"><span class="status-dot"></span><span class="status-text">Ya no está disponible</span></div>
      <p class="small muted" style="margin-top:8px;line-height:1.5">${motivo}</p>
    </div>
    <a class="btn btn-white" href="trabajos.html">Volver a mis pedidos</a>`;
  listo();
} catch (err) {
  fallo(err);
}
