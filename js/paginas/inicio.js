import {
  sb, $, esc, requerir, listo, fallo, SELECT_PEDIDO, tarjetaPedido, paginaPedidoCliente,
  OFICIOS, nombreCompleto, avatar, textoDireccion,
} from '../comun.js';

try {
  const { user, perfil } = await requerir('cliente');
  $('#saludo').textContent = `Hola, ${perfil.nombre}`;

  const [{ data: dir }, { data: pedidos, error }] = await Promise.all([
    sb.from('direcciones').select('*').eq('cliente_id', user.id).eq('principal', true).maybeSingle(),
    sb.from('pedidos').select(SELECT_PEDIDO).eq('cliente_id', user.id)
      .in('estado', ['borrador', 'buscando', 'asignado', 'confirmado', 'terminado'])
      .order('created_at', { ascending: false }),
  ]);
  if (error) throw error;

  $('#ubicacion').innerHTML = dir
    ? esc(`${dir.localidad}, ${dir.provincia}`)
    : '<a href="perfil.html">Agregá tu dirección</a>';

  const activos = pedidos.filter((p) => p.estado !== 'terminado');
  const paraCalificar = pedidos.filter((p) => p.estado === 'terminado' && !p.resena);

  let html = '<h2 class="section-title">Tu pedido activo</h2>';
  html += activos.length
    ? activos.map((p) => tarjetaPedido(p, {
      href: paginaPedidoCliente(p),
      detalle: `${OFICIOS[p.oficio_id]} · ${p.profesional ? nombreCompleto(p.profesional) : textoDireccion(p.direccion) || p.localidad}`,
    })).join('')
    : '<div class="card small muted">No tenés pedidos en curso. Publicá un problema y te contesta un profesional de tu zona.</div>';

  if (paraCalificar.length) {
    html += '<h2 class="section-title">Para calificar</h2>';
    html += paraCalificar.map((p) => `
      <a class="card row" href="calificar.html?id=${p.id}">
        ${avatar(p.profesional)}
        <div class="grow"><div style="font-weight:700;font-size:14px">${esc(nombreCompleto(p.profesional))}</div><div class="xsmall muted">${esc(p.titulo)}</div></div>
        <span class="chip clay">Calificar</span>
      </a>`).join('');
  }
  $('#activos').innerHTML = html;
  listo();
} catch (err) {
  fallo(err);
}
