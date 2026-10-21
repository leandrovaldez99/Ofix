import {
  sb, $, requerir, listo, fallo, SELECT_PEDIDO, tarjetaPedido, paginaPedidoCliente,
  OFICIOS, nombreCompleto, textoDireccion,
} from '../comun.js';

try {
  const { user } = await requerir('cliente');
  const { data: pedidos, error } = await sb.from('pedidos').select(SELECT_PEDIDO)
    .eq('cliente_id', user.id).order('created_at', { ascending: false });
  if (error) throw error;

  const grupos = [
    ['En curso', pedidos.filter((p) => ['borrador', 'buscando', 'asignado', 'confirmado'].includes(p.estado))],
    ['Para calificar', pedidos.filter((p) => p.estado === 'terminado' && !p.resena)],
    ['Anteriores', pedidos.filter((p) => p.estado === 'cancelado' || (p.estado === 'terminado' && p.resena))],
  ];

  const detalle = (p) => {
    const quien = p.profesional ? nombreCompleto(p.profesional) : textoDireccion(p.direccion) || p.localidad;
    return `${OFICIOS[p.oficio_id]} · ${quien}`;
  };

  $('#listas').innerHTML = pedidos.length
    ? grupos.filter(([, lista]) => lista.length).map(([titulo, lista]) => `
      <h2 class="section-title">${titulo} <span class="muted">· ${lista.length}</span></h2>
      <div class="list-grid two">${lista.map((p) => tarjetaPedido(p, { href: paginaPedidoCliente(p), detalle: detalle(p) })).join('')}</div>`).join('')
    : '<div class="card empty"><b>Todavía no publicaste ningún pedido</b>Contá qué necesitás y te contesta un profesional de tu zona.</div>';
  listo();
} catch (err) {
  fallo(err);
}
