import {
  sb, $, $$, esc, param, requerir, listo, fallo, avisar, conCarga, cargarPedido, redirigir,
  OFICIOS, avatar, rating, km, nombreCompleto, textoDireccion, ponerTitulo,
} from '../comun.js';

try {
  const { user } = await requerir('cliente');
  const pedidoId = param('pedido');
  const main = $('main');
  let localidad;
  let pedido;

  if (pedidoId) {
    // Viene de "Quiero elegir yo": el oficio queda fijo y se busca cerca de la dirección del pedido
    pedido = await cargarPedido(pedidoId);
    if (!pedido || !['borrador', 'buscando'].includes(pedido.estado)) await redirigir('pedidos.html');
    localidad = pedido.localidad;
    $$('[name=oficio]').forEach((r) => { r.checked = r.value === pedido.oficio_id; r.disabled = !r.checked; });
    $('#cerca').textContent = `Cerca de ${textoDireccion(pedido.direccion) || pedido.localidad}`;
    $('#nota').innerHTML = `<p>Elegí a quién mandarle tu pedido <b>#${pedido.id} · ${esc(pedido.titulo)}</b>. Si no querés elegir, se lo ofrecemos al primero disponible.</p>`;
    const boton = $('#btn-publicar');
    boton.textContent = 'Que lo tome el primero disponible';
    boton.addEventListener('click', async (e) => {
      e.preventDefault();
      await conCarga(boton, async () => {
        const { error } = await sb.rpc('reintentar_pedido', { p_pedido: pedido.id });
        if (error) throw error;
        location.href = `pedido-esperando.html?id=${pedido.id}`;
      });
    });
    $('.pagehead .back').href = 'pedidos.html';
  } else {
    const { data: dir } = await sb.from('direcciones').select('*').eq('cliente_id', user.id).eq('principal', true).maybeSingle();
    localidad = dir?.localidad || 'Tigre';
    $('#cerca').innerHTML = dir
      ? esc(`Cerca de ${textoDireccion(dir)}`)
      : 'Cerca de Tigre · <a href="perfil.html">agregá tu dirección</a>';
    const oficio = param('oficio');
    if (oficio && OFICIOS[oficio]) $(`[name=oficio][value="${oficio}"]`).checked = true;
  }

  async function buscar() {
    const oficio = $('[name=oficio]:checked').value;
    ponerTitulo(OFICIOS[oficio]);
    $('#titulo').textContent = OFICIOS[oficio];
    if (!pedido) $('#btn-publicar').href = `nuevo-pedido.html?oficio=${oficio}`;

    const { data, error } = await sb.rpc('buscar_profesionales', {
      p_oficio: oficio,
      p_localidad: localidad,
      p_radio: Number($('#f-rad').value),
      p_solo_hoy: $('[name=hoy]').checked,
      p_solo_matriculados: $('[name=mat]').checked,
      p_orden: $('[name=orden]:checked').value,
    });
    if (error) throw error;

    $('#sub').textContent = `${data.length} ${data.length === 1 ? 'profesional' : 'profesionales'} cerca de ${localidad}`;
    const extra = pedido ? `&pedido=${pedido.id}` : '';
    $('#lista').innerHTML = data.length ? data.map((p) => `
      <a class="card" href="profesional.html?id=${p.id}${extra}">
        <div class="row-top">
          ${avatar(p)}
          <div class="grow">
            <div style="font-size:15px;font-weight:700">${esc(nombreCompleto(p))}</div>
            <div style="margin-top:3px">${rating(p.promedio, p.cantidad_resenas)}</div>
            <div class="xsmall muted" style="margin-top:4px">${esc([km(p.distancia_km), p.localidad, ...p.oficios.map((o) => OFICIOS[o])].join(' · '))}</div>
            <div class="chips" style="margin-top:9px;gap:6px">
              ${p.matriculado ? '<span class="chip">Matriculado</span>' : ''}
              ${p.disponible_hoy ? '<span class="chip green">Disponible hoy</span>' : '<span class="chip gray">No disponible hoy</span>'}
            </div>
          </div>
        </div>
      </a>`).join('')
      : `<div class="card empty" style="grid-column:1/-1"><b>No encontramos profesionales con esos filtros</b>Probá con un radio más grande o sacá algún filtro.</div>`;
  }

  main.addEventListener('change', () => buscar().catch((err) => avisar($('#lista'), err.message)));
  await buscar();
  listo();
} catch (err) {
  fallo(err);
}
