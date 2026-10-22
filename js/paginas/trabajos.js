import {
  sb, $, esc, requerir, listo, fallo, redirigir, avisar, textoError,
  OFICIOS, iniciales, rating, km, hace, minutosHasta, nombreCorto, fechaVisita,
} from '../comun.js';
import { icono } from '../iconos.js';

try {
  const { user } = await requerir('profesional');
  const { data: yo } = await sb.from('profesionales_publicos').select('*').eq('id', user.id).maybeSingle();
  if (!yo) await redirigir('registro-profesional-2.html');

  $('#av').textContent = iniciales(yo);
  $('#nombre').textContent = `${yo.nombre} ${yo.apellido}`;
  $('#rating').innerHTML = rating(yo.promedio, yo.cantidad_resenas, `${yo.servicios} ${yo.servicios === 1 ? 'servicio' : 'servicios'}`);

  if (yo.estado_validacion === 'pendiente') {
    $('#avisos').innerHTML = '<div class="note"><p>Tu perfil está <b>pendiente de validación</b>. Mientras tanto no recibís pedidos. <a href="validacion-pendiente.html">Ver el estado</a></p></div>';
  } else if (yo.estado_validacion === 'rechazado') {
    $('#avisos').innerHTML = '<div class="note clay"><p>No pudimos validar tu identidad. Revisá tus documentos en <a href="cuenta.html">Mi cuenta</a>.</p></div>';
  }

  // ---------- Disponible hoy ----------

  const disp = $('#f-disp');
  disp.checked = yo.disponible_hoy;
  const textoDisp = () => {
    $('#disp-texto').textContent = disp.checked
      ? `Te llegan pedidos urgentes de tu zona (${yo.localidad}, ${yo.radio_km} km).`
      : 'Hoy no te llegan pedidos nuevos. Los clientes igual pueden elegirte desde tu perfil.';
  };
  textoDisp();
  disp.addEventListener('change', async () => {
    const { error } = await sb.rpc('set_disponible_hoy', { p_disponible: disp.checked });
    if (error) {
      disp.checked = !disp.checked;
      avisar(disp.closest('.card'), textoError(error));
    }
    textoDisp();
  });

  // ---------- Pedidos ofrecidos y en curso ----------

  async function pintar() {
    const [{ data: ofertas, error }, { data: enCurso, error: e2 }] = await Promise.all([
      sb.from('ofertas')
        .select('estado, elegido, prioridad_hasta, visible_desde, distancia_km, pedido:pedidos(id, titulo, oficio_id, localidad, estado, vence_at, modo, created_at)')
        .eq('profesional_id', user.id).in('estado', ['pendiente', 'no_disponible'])
        .gte('created_at', new Date(Date.now() - 12 * 3600000).toISOString())
        .order('created_at', { ascending: false }),
      sb.from('pedidos').select('*, cliente:perfiles!pedidos_cliente_id_fkey(id, nombre, apellido)')
        .eq('profesional_id', user.id).in('estado', ['asignado', 'confirmado'])
        .order('created_at', { ascending: false }),
    ]);
    if (error) throw error;
    if (e2) throw e2;

    const ahora = new Date();
    const vigentes = ofertas.filter((o) => o.estado === 'pendiente' && o.pedido?.estado === 'buscando' && new Date(o.pedido.vence_at) > ahora);
    const perdidas = ofertas.filter((o) => o.pedido && !vigentes.includes(o));

    $('#n-ofertas').textContent = vigentes.length ? `· ${vigentes.length} ${vigentes.length === 1 ? 'nuevo' : 'nuevos'}` : '';
    const tarjeta = (o, disponible) => {
      const p = o.pedido;
      const chips = [`<span class="chip green">${esc(OFICIOS[p.oficio_id])}</span>`];
      if (!disponible) chips.push('<span class="chip gray">Ya no está disponible</span>');
      else if (o.elegido) chips.push('<span class="chip dark">Te eligieron</span>');
      else chips.push('<span class="chip clay">Urgente</span>');
      if (disponible && o.prioridad_hasta && new Date(o.prioridad_hasta) > ahora) {
        chips.push(`<span class="chip warn">Tu prioridad · ${minutosHasta(o.prioridad_hasta)} min</span>`);
      }
      const d = o.distancia_km;
      return `<a class="card" href="${disponible ? 'oferta' : 'oferta-no-disponible'}.html?id=${p.id}">
        <div class="row wrap" style="gap:7px">${chips.join('')}<span class="ml-auto xsmall muted">${esc(hace(o.visible_desde))}</span></div>
        <p style="margin-top:8px;font-size:15px;font-weight:700;line-height:1.35">${esc(p.titulo)}</p>
        <div class="row xsmall muted" style="margin-top:6px;gap:6px">${icono.ubicacion(14)}${esc([km(d), p.localidad].filter(Boolean).join(' · '))}</div>
      </a>`;
    };
    $('#ofertas').innerHTML = [...vigentes.map((o) => tarjeta(o, true)), ...perdidas.map((o) => tarjeta(o, false))].join('')
      || `<div class="card small muted">${disp.checked
        ? 'Por ahora no hay pedidos para vos. Te avisamos acá apenas llegue uno.'
        : 'Activá "Estoy disponible hoy" para recibir pedidos urgentes.'}</div>`;

    $('#n-curso').textContent = enCurso.length ? `· ${enCurso.length}` : '';
    $('#en-curso').innerHTML = enCurso.map((p) => {
      const esperando = p.estado === 'asignado';
      const texto = esperando ? 'Esperando que el cliente te confirme' : p.visita_at ? 'Visita acordada' : 'Coordinando la visita';
      return `<a class="card" href="chat-profesional.html?id=${p.id}">
        <div class="status ${esperando ? '' : 'green'}"><span class="status-dot"></span><span class="small" style="font-weight:600">${texto}</span><span class="ml-auto xsmall muted">#${p.id}</span></div>
        <p style="margin-top:8px;font-size:14px;font-weight:700">${esc(p.titulo)}</p>
        <p class="xsmall muted" style="margin-top:3px">${esc([nombreCorto(p.cliente), p.localidad, p.visita_at && fechaVisita(p.visita_at)].filter(Boolean).join(' · '))}</p>
      </a>`;
    }).join('') || '<div class="card small muted">No tenés trabajos en curso.</div>';
  }

  await pintar();
  const refrescar = () => pintar().catch(console.error);
  sb.channel(`trabajos-${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ofertas', filter: `profesional_id=eq.${user.id}` }, refrescar)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `profesional_id=eq.${user.id}` }, refrescar)
    .subscribe();
  // Las ofertas sin prioridad se ven recién a los 5 minutos: se revisa seguido
  setInterval(refrescar, 30000);
  listo();
} catch (err) {
  fallo(err);
}
