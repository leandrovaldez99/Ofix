import {
  sb, $, esc, param, requerir, listo, fallo, alConfirmar, detener, cargarPedido, escucharPedido, irAPedidoSiCambio,
  OFICIOS, OFICIOS_PERSONA, minutosHasta, resumenPedido, lineaTiempo, textoDireccion, nombreCompleto,
} from '../comun.js';
import { icono } from '../iconos.js';

try {
  await requerir('cliente');
  const id = param('id');
  let p = await cargarPedido(id);
  if (irAPedidoSiCambio(p, 'pedido-esperando')) await detener();

  $('#sub').textContent = `Pedido #${p.id} · ${OFICIOS[p.oficio_id]}`;

  const { data: ofertas } = await sb.from('ofertas')
    .select('estado, elegido, profesional:profesionales(perfil:perfiles(nombre, apellido))')
    .eq('pedido_id', p.id).eq('estado', 'pendiente');

  const [singular, plural] = OFICIOS_PERSONA[p.oficio_id];
  let explicacion;
  if (p.modo === 'elegido') {
    const elegido = ofertas?.find((o) => o.elegido)?.profesional?.perfil;
    explicacion = `Le mandamos tu pedido a <b>${esc(nombreCompleto(elegido) || 'el profesional que elegiste')}</b>. Tiene 30 minutos para aceptarlo. Te avisamos apenas responda.`;
  } else if (ofertas?.length) {
    const n = ofertas.length;
    explicacion = `Le avisamos a <b>${n} ${n === 1 ? singular : plural}</b> de tu zona que están disponibles hoy. El de mejor puntaje tiene 5 minutos de prioridad; después lo puede tomar cualquiera. Te notificamos apenas uno acepte.`;
  } else {
    explicacion = `Por ahora no hay ${plural} disponibles hoy en un radio de ${p.radio_km} km. Dejamos el pedido publicado; si nadie lo toma, vas a poder ampliar el rango o elegir vos.`;
  }

  $('#contenido').innerHTML = `
  <div>
    <div class="card">
      <div class="status"><span class="status-dot pulse"></span><span class="status-text">Buscando profesional</span></div>
      <p class="small muted" style="margin-top:8px;line-height:1.5">${explicacion}</p>
      <div class="row xsmall muted" style="margin-top:11px;gap:7px">${icono.reloj(15)}<span>El pedido vence en <b id="vence"></b></span></div>
    </div>
    <a class="btn btn-danger" href="#cancelar">Desactivar pedido</a>
  </div>
  <div>
    ${resumenPedido(p, { direccion: textoDireccion(p.direccion) })}
    ${lineaTiempo(p)}
  </div>`;

  function actualizarReloj() {
    const min = minutosHasta(p.vence_at);
    if (min <= 0) location.replace(`sin-profesionales.html?id=${p.id}`);
    $('#vence').textContent = `${min} min`;
  }
  actualizarReloj();
  setInterval(actualizarReloj, 15000);

  // Cuando un profesional acepta, se pasa sola a la pantalla siguiente
  escucharPedido(p.id, async () => {
    p = await cargarPedido(id);
    irAPedidoSiCambio(p, 'pedido-esperando');
  });

  alConfirmar('cancelar', async () => {
    const { error } = await sb.rpc('cancelar_pedido', { p_pedido: p.id });
    if (error) throw error;
    location.replace('pedidos.html');
  });
  listo();
} catch (err) {
  fallo(err);
}
