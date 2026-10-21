import { sb, $, esc, requerir, listo, fallo, avatar, nombreCorto, hora, diaYHora } from '../comun.js';

try {
  const { user } = await requerir('profesional');

  async function pintar() {
    const { data: pedidos, error } = await sb.from('pedidos')
      .select('id, titulo, estado, created_at, cliente:perfiles!pedidos_cliente_id_fkey(id, nombre, apellido)')
      .eq('profesional_id', user.id).in('estado', ['asignado', 'confirmado', 'terminado'])
      .order('created_at', { ascending: false }).limit(50);
    if (error) throw error;

    // Último mensaje de cada conversación
    const ultimos = {};
    if (pedidos.length) {
      const { data: mensajes } = await sb.from('mensajes').select('pedido_id, autor_id, texto, created_at')
        .in('pedido_id', pedidos.map((p) => p.id)).order('created_at', { ascending: false }).limit(500);
      for (const m of mensajes || []) ultimos[m.pedido_id] ??= m;
    }
    const fecha = (p) => ultimos[p.id]?.created_at || p.created_at;
    pedidos.sort((a, b) => new Date(fecha(b)) - new Date(fecha(a)));

    $('#lista').innerHTML = pedidos.map((p) => {
      const m = ultimos[p.id];
      const nuevo = m && m.autor_id !== user.id && p.estado === 'confirmado';
      const cuando = m ? (new Date(m.created_at).toDateString() === new Date().toDateString() ? hora(m.created_at) : diaYHora(m.created_at).split(' ')[0]) : '';
      const vista = m ? m.texto : p.estado === 'asignado' ? 'Esperando que te confirme' : 'Todavía no hay mensajes';
      return `<a class="card row" href="chat-profesional.html?id=${p.id}" style="gap:12px">
        ${avatar(p.cliente, 'sm')}
        <div class="grow">
          <div class="row"><span style="font-weight:700;font-size:14px">${esc(nombreCorto(p.cliente))}</span><span class="ml-auto xsmall muted">${esc(cuando)}</span></div>
          <div class="xsmall muted">#${p.id} · ${esc(p.titulo)}${p.estado === 'terminado' ? ' · terminado' : ''}</div>
          <div class="small" style="margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${nuevo ? 'font-weight:600' : 'color:var(--muted)'}">${esc(vista)}</div>
        </div>${nuevo ? '<span class="status-dot" style="background:var(--accent)" aria-label="Último mensaje del cliente"></span>' : ''}
      </a>`;
    }).join('') || '<div class="card empty" style="grid-column:1/-1"><b>Todavía no tenés conversaciones</b>Cuando un cliente te confirme un pedido, el chat aparece acá.</div>';
  }

  await pintar();
  sb.channel(`chats-${user.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, () => pintar().catch(console.error))
    .subscribe();
  listo();
} catch (err) {
  fallo(err);
}
