import {
  sb, $, param, requerir, listo, fallo, conCarga, alConfirmar, detener, cargarPedido, irAPedidoSiCambio,
  OFICIOS, OFICIOS_PERSONA, resumenPedido, textoDireccion,
} from '../comun.js';

try {
  await requerir('cliente');
  const p = await cargarPedido(param('id'));
  if (irAPedidoSiCambio(p, 'sin-profesionales')) await detener();

  $('#sub').textContent = `Pedido #${p.id} · ${OFICIOS[p.oficio_id]}`;
  const plural = OFICIOS_PERSONA[p.oficio_id][1];
  const radioNuevo = Math.min(p.radio_km + 5, 50);

  $('#contenido').innerHTML = `
  <div>
    <div class="card">
      <div class="status"><span class="status-dot"></span><span class="status-text">Nadie tomó el pedido todavía</span></div>
      <p class="small muted" style="margin-top:8px;line-height:1.5">No encontramos ${plural} disponibles que acepten en un radio de <b>${p.radio_km} km</b> en los últimos 30 minutos. ¿Qué querés hacer?</p>
    </div>
    <button class="btn btn-clay" id="btn-reintentar">Volver a intentar</button>
    ${radioNuevo > p.radio_km ? `<button class="btn btn-white" id="btn-ampliar">Ampliar el rango a ${radioNuevo} km</button>` : ''}
    <a class="btn btn-white" href="buscar.html?pedido=${p.id}&oficio=${p.oficio_id}">Elegir yo un profesional</a>
    <a class="link-btn center" href="#cancelar">Desactivar pedido</a>
  </div>
  <div>${resumenPedido(p, { direccion: textoDireccion(p.direccion) })}</div>`;

  async function reintentar(boton, radio) {
    await conCarga(boton, async () => {
      const { error } = await sb.rpc('reintentar_pedido', { p_pedido: p.id, p_radio: radio ?? null });
      if (error) throw error;
      location.replace(`pedido-esperando.html?id=${p.id}`);
    });
  }
  $('#btn-reintentar').addEventListener('click', (e) => reintentar(e.currentTarget));
  $('#btn-ampliar')?.addEventListener('click', (e) => reintentar(e.currentTarget, radioNuevo));

  alConfirmar('cancelar', async () => {
    const { error } = await sb.rpc('cancelar_pedido', { p_pedido: p.id });
    if (error) throw error;
    location.replace('pedidos.html');
  });
  listo();
} catch (err) {
  fallo(err);
}
