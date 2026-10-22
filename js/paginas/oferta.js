import {
  sb, $, esc, param, requerir, listo, fallo, conCarga, alConfirmar, redirigir,
  OFICIOS, km, hace, minutosHasta, diaYHora, nombreCorto,
} from '../comun.js';
import { icono } from '../iconos.js';

try {
  const { user } = await requerir('profesional');
  const id = Number(param('id'));

  const { data: oferta } = await sb.from('ofertas')
    .select('*, pedido:pedidos(*, cliente:perfiles!pedidos_cliente_id_fkey(nombre, apellido))')
    .eq('pedido_id', id).eq('profesional_id', user.id).maybeSingle();
  const p = oferta?.pedido;
  if (!p) await redirigir('trabajos.html');
  if (oferta.estado === 'aceptada') await redirigir(`chat-profesional.html?id=${id}`);
  if (oferta.estado !== 'pendiente' || p.estado !== 'buscando' || new Date(p.vence_at) <= new Date()) {
    await redirigir(`oferta-no-disponible.html?id=${id}`);
  }

  $('#titulo').textContent = `Pedido #${p.id}`;
  $('#sub').textContent = `Recibido ${hace(oferta.visible_desde)}`;

  // Fotos que adjuntó el cliente
  const { data: archivos } = await sb.storage.from('pedidos').list(String(p.id));
  let fotos = [];
  if (archivos?.length) {
    const { data } = await sb.storage.from('pedidos').createSignedUrls(archivos.map((a) => `${p.id}/${a.name}`), 3600);
    fotos = (data || []).filter((f) => f.signedUrl);
  }

  const conPrioridad = oferta.prioridad_hasta && new Date(oferta.prioridad_hasta) > new Date();
  const nota = oferta.elegido
    ? `<b>${esc(p.cliente.nombre)} te eligió a vos.</b> Nadie más ve este pedido.`
    : conPrioridad
      ? `<b>Tenés prioridad por ${minutosHasta(oferta.prioridad_hasta)} minutos.</b> Sos el profesional con mejor puntaje para este pedido. Después se lo ofrecemos también a los demás.`
      : '<b>Lo pueden tomar otros profesionales.</b> Lo recibe el primero que acepte.';

  $('#contenido').innerHTML = `
  <div>
    <div class="card">
      <div class="row wrap" style="gap:7px"><span class="chip green">${esc(OFICIOS[p.oficio_id])}</span>${oferta.elegido ? '<span class="chip dark">Te eligieron</span>' : '<span class="chip clay">Urgente</span>'}</div>
      <p style="margin-top:10px;font-size:17px;font-weight:700;font-family:var(--display)">${esc(p.titulo)}</p>
      <p class="small" style="margin-top:6px;line-height:1.5;white-space:pre-line">${esc(p.descripcion)}</p>
      ${fotos.length ? `<div class="kv" style="margin-top:10px">${icono.foto()}<div class="muted">${fotos.length} ${fotos.length === 1 ? 'foto adjunta' : 'fotos adjuntas'}</div></div>
        <div class="fotos">${fotos.map((f) => `<a href="${esc(f.signedUrl)}" target="_blank" rel="noopener"><img src="${esc(f.signedUrl)}" alt="Foto del problema"></a>`).join('')}</div>` : ''}
    </div>
    <div class="card">
      <div class="kv">${icono.ubicacion()}<div><b>Zona:</b> ${esc([`${p.localidad}, ${p.provincia}`, oferta.distancia_km != null && `${km(oferta.distancia_km)} tuyo`].filter(Boolean).join(' · '))}<div class="xsmall muted" style="margin-top:2px">La dirección exacta se muestra cuando el cliente te confirma</div></div></div>
      <div class="kv">${icono.persona()}<div><b>Cliente:</b> ${esc(nombreCorto(p.cliente))}</div></div>
      <div class="kv">${icono.reloj()}<div><b>Publicado:</b> ${esc(diaYHora(p.created_at))}</div></div>
    </div>
  </div>
  <div>
    <div class="note green"><p>${nota}</p></div>
    <div class="row xsmall muted" style="gap:7px">${icono.reloj(15)}<span>La oferta vence en <b>${minutosHasta(p.vence_at)} min</b></span></div>
    <button class="btn btn-green" id="btn-aceptar">Aceptar el trabajo</button>
    <a class="btn btn-white" href="#rechazar">No puedo tomarlo</a>
    <p class="xsmall muted center">Al aceptar, el cliente te confirma y se abre el chat para acordar la visita.</p>
  </div>`;

  $('#btn-aceptar').addEventListener('click', async (e) => {
    await conCarga(e.currentTarget, async () => {
      const { data: ok, error } = await sb.rpc('aceptar_oferta', { p_pedido: p.id });
      if (error) throw error;
      location.replace(ok ? `chat-profesional.html?id=${p.id}` : `oferta-no-disponible.html?id=${p.id}`);
    });
  });

  alConfirmar('rechazar', async () => {
    const { error } = await sb.rpc('rechazar_oferta', { p_pedido: p.id });
    if (error) throw error;
    location.replace('trabajos.html');
  });
  listo();
} catch (err) {
  fallo(err);
}
