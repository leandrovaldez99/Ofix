import {
  sb, $, esc, param, requerir, listo, fallo, conCarga, alConfirmar, detener, cargarPedido, irAPedidoSiCambio,
  OFICIOS, avatar, rating, resumenPedido, lineaTiempo, textoDireccion, nombreCompleto,
} from '../comun.js';

try {
  await requerir('cliente');
  const p = await cargarPedido(param('id'));
  if (irAPedidoSiCambio(p, 'pedido-asignado')) await detener();

  $('#sub').textContent = `Pedido #${p.id} · ${OFICIOS[p.oficio_id]}`;
  const { data: pro } = await sb.from('profesionales_publicos').select('*').eq('id', p.profesional_id).single();

  $('#contenido').innerHTML = `
  <div>
    <div class="card">
      <div class="row" style="gap:12px">
        ${avatar(pro, 'lg')}
        <div class="grow">
          <div class="xsmall" style="font-weight:700;letter-spacing:.04em;color:var(--green)">ACEPTÓ TU PEDIDO</div>
          <div style="font-size:17px;font-weight:700;font-family:var(--display)">${esc(nombreCompleto(pro))}</div>
          <div style="margin-top:3px">${rating(pro.promedio, pro.cantidad_resenas)}</div>
          <div class="chips" style="margin-top:8px;gap:6px">
            ${pro.matriculado ? '<span class="chip">Matriculado</span>' : ''}
            <span class="chip">${pro.servicios} ${pro.servicios === 1 ? 'servicio' : 'servicios'}</span>
          </div>
        </div>
      </div>
      <a class="btn btn-ghost btn-sm" style="margin-top:12px;width:100%" href="profesional.html?id=${pro.id}">Ver perfil y reseñas</a>
    </div>
    <div class="note"><p>Si lo confirmás se abre el chat para coordinar la visita y le compartimos tu dirección exacta y tu teléfono.</p></div>
    <button class="btn btn-clay" id="btn-confirmar">Confirmar a ${esc(pro.nombre)} y abrir el chat</button>
    <a class="btn btn-white" href="#otro">Prefiero otro profesional</a>
    <p class="xsmall muted center">El trabajo y el pago los arreglan entre ustedes.</p>
  </div>
  <div>
    ${resumenPedido(p, { direccion: textoDireccion(p.direccion) })}
    ${lineaTiempo(p, nombreCompleto(pro))}
  </div>`;

  $('#btn-confirmar').addEventListener('click', async (e) => {
    await conCarga(e.currentTarget, async () => {
      const { error } = await sb.rpc('confirmar_profesional', { p_pedido: p.id });
      if (error) throw error;
      location.replace(`chat-cliente.html?id=${p.id}`);
    });
  });

  alConfirmar('otro', async () => {
    const { data: estado, error } = await sb.rpc('pedir_otro', { p_pedido: p.id });
    if (error) throw error;
    location.replace(estado === 'buscando'
      ? `pedido-esperando.html?id=${p.id}`
      : `buscar.html?pedido=${p.id}&oficio=${p.oficio_id}`);
  });
  listo();
} catch (err) {
  fallo(err);
}
