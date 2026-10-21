import {
  sb, $, param, requerir, listo, fallo, conCarga, redirigir, cargarPedido,
  OFICIOS, iniciales, colorAvatar, nombreCompleto,
} from '../comun.js';

try {
  await requerir('cliente');
  const p = await cargarPedido(param('id'));
  if (!p || p.estado !== 'terminado' || p.resena) await redirigir('pedidos.html');

  const pro = p.profesional;
  const av = $('#av');
  av.textContent = iniciales(pro);
  av.className = `avatar ${colorAvatar(pro?.id)}`;
  $('#nombre').textContent = nombreCompleto(pro);
  const cuando = p.visita_at || p.terminado_at;
  $('#detalle').textContent = `${OFICIOS[p.oficio_id]} · ${p.visita_at ? 'visita' : 'terminado'} del ${new Date(cuando).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })}`;

  const form = $('#form-calificar');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    await conCarga(form.querySelector('[type=submit]'), async () => {
      const { error } = await sb.rpc('calificar', {
        p_pedido: p.id,
        p_puntaje: Number(form.puntaje.value),
        p_comentario: form.comentario.value,
      });
      if (error) throw error;
      location.replace('pedidos.html');
    });
  });
  listo();
} catch (err) {
  fallo(err);
}
