// Chat del pedido, para el cliente (chat-cliente.html) y el profesional (chat-profesional.html)
import {
  sb, $, esc, param, requerir, listo, fallo, alConfirmar, cerrarModal, detener, redirigir,
  cargarPedido, escucharPedido, paginaPedidoCliente, avisar, textoError,
  OFICIOS, iniciales, colorAvatar, nombreCompleto, nombreCorto, diaYHora, hora, fechaVisita, textoDireccion,
} from '../comun.js';
import { icono } from '../iconos.js';

try {
  const composer = $('#composer');
  const rol = composer.dataset.rol;
  const esCliente = rol === 'cliente';
  const { user } = await requerir(rol);
  const id = param('id');

  let p = await cargarPedido(id);
  if (!p) await redirigir(esCliente ? 'pedidos.html' : 'trabajos.html');
  if (esCliente && ['borrador', 'buscando', 'asignado'].includes(p.estado)) await redirigir(paginaPedidoCliente(p));
  if (!esCliente && p.profesional_id !== user.id) await redirigir(`oferta-no-disponible.html?id=${p.id}`);

  const otro = () => (esCliente ? p.profesional : p.cliente);
  let contacto = null;

  // ---------- Encabezado y datos de contacto ----------

  async function cargarContacto() {
    if (esCliente || !['confirmado', 'terminado'].includes(p.estado)) return;
    const { data } = await sb.from('contactos').select('telefono').eq('id', p.cliente_id).maybeSingle();
    contacto = data;
  }

  function pintarEncabezado() {
    const o = otro();
    const av = $('#av');
    av.textContent = iniciales(o);
    av.className = `avatar sm ${colorAvatar(o?.id)}`;
    $('#nombre').textContent = esCliente ? nombreCompleto(o) : nombreCorto(o);
    $('#sub').textContent = `Pedido #${p.id} · ${OFICIOS[p.oficio_id]}`;
    if (esCliente) $('#ver-perfil').href = `profesional.html?id=${p.profesional_id}`;
    document.title = `Chat con ${o?.nombre || ''} · Ofix`;
  }

  function pintarArriba() {
    let html = '';
    if (!esCliente && ['confirmado', 'terminado'].includes(p.estado)) {
      html += `<div class="card">
        <div class="card-title">Datos del cliente</div>
        <div class="kv">${icono.persona()}<div>${esc(nombreCompleto(p.cliente))}</div></div>
        <div class="kv">${icono.ubicacion()}<div>${esc(textoDireccion(p.direccion) || p.localidad)}</div></div>
        ${contacto ? `<div class="kv">${icono.telefono()}<div><a href="tel:${esc(contacto.telefono.replace(/[^\d+]/g, ''))}">${esc(contacto.telefono)}</a></div></div>` : ''}
        <p class="xsmall muted" style="margin-top:10px">Usá estos datos solo para este trabajo.</p>
      </div>`;
    }
    if (p.estado === 'asignado') {
      html += `<div class="note green"><p><b>Esperando que ${esc(p.cliente.nombre)} te confirme.</b> Cuando lo haga se abre el chat y te compartimos su dirección y su teléfono.</p></div>`;
    }
    if (p.estado === 'terminado') {
      html += `<div class="note green"><p><b>Trabajo terminado.</b> ${esCliente
        ? (p.resena ? 'Gracias por calificar el servicio.' : `<a href="calificar.html?id=${p.id}">Calificá a ${esc(p.profesional?.nombre)}</a> para ayudar a otros clientes.`)
        : 'El cliente ya puede calificar el servicio.'}</p></div>`;
    }
    if (p.estado === 'cancelado') {
      const quien = p.cancelado_por === user.id ? 'Cancelaste' : `${esc(otro()?.nombre || 'La otra parte')} canceló`;
      html += `<div class="note clay"><p><b>${quien} este trabajo.</b> El chat quedó cerrado.${esCliente ? ` <a href="nuevo-pedido.html?repetir=${p.id}">Publicar el pedido de nuevo</a>` : ''}</p></div>`;
    }
    $('#arriba').innerHTML = html;
  }

  function pintarPills() {
    const nombreOtro = otro()?.nombre || '';
    let html = '';
    if (p.asignado_at) {
      html += `<div class="sys-pill">${esCliente ? `${esc(nombreOtro)} aceptó tu pedido` : 'Aceptaste este pedido'} · ${esc(diaYHora(p.asignado_at).toLowerCase())}</div>`;
    }
    if (p.confirmado_at) {
      html += `<div class="sys-pill">${esCliente
        ? `Tu dirección exacta y tu teléfono ya son visibles para ${esc(nombreOtro)}`
        : `${esc(nombreOtro)} te confirmó · ${esc(diaYHora(p.confirmado_at).toLowerCase())}`}</div>`;
    }
    $('#pills').innerHTML = html;
    $('#visita-card').innerHTML = p.visita_at ? `<div class="visit-card">
      <div class="vc-title">${icono.calendario()}Visita acordada</div>
      <div style="font-size:14px;margin-top:6px">${esc(fechaVisita(p.visita_at))}</div>
      <div class="xsmall muted" style="margin-top:3px">${esc(textoDireccion(p.direccion) || p.localidad)}</div>
    </div>` : '';
  }

  function pintarAcciones() {
    const abierto = p.estado === 'confirmado';
    composer.querySelector('input').disabled = !abierto;
    composer.querySelector('button').disabled = !abierto;
    composer.querySelector('input').placeholder = abierto ? 'Escribí un mensaje' : 'El chat no está abierto';
    if (!abierto) {
      $('#acciones').innerHTML = '';
      return;
    }
    const yaMarque = esCliente ? p.terminado_cliente : p.terminado_profesional;
    const otroMarco = esCliente ? p.terminado_profesional : p.terminado_cliente;
    $('#acciones').innerHTML = `
      ${otroMarco && !yaMarque ? `<div class="note green"><p>${esc(otro()?.nombre)} marcó el trabajo como terminado. Confirmalo vos también para cerrarlo.</p></div>` : ''}
      <div class="btn-row wrap">
        <a class="btn btn-white btn-sm" href="#visita">${esCliente ? 'Cambiar la visita' : 'Proponer otra fecha'}</a>
        ${yaMarque
          ? `<button class="btn btn-white btn-sm" disabled>Esperando que ${esc(otro()?.nombre)} confirme</button>`
          : '<a class="btn btn-green btn-sm" href="#terminado">Marcar trabajo terminado</a>'}
      </div>
      <a class="link-btn center" href="#cancelar-trabajo">Cancelar el trabajo</a>`;
    if (!p.visita_at) $('#acciones a[href="#visita"]').textContent = 'Fijar la visita';
  }

  function pintar() {
    pintarEncabezado();
    pintarArriba();
    pintarPills();
    pintarAcciones();
  }

  // ---------- Mensajes ----------

  const vistos = new Set();
  function agregarMensaje(m) {
    if (vistos.has(m.id)) return;
    vistos.add(m.id);
    const mio = m.autor_id === user.id;
    $('#mensajes').insertAdjacentHTML('beforeend', `<div class="bubble ${mio ? 'mine' : 'theirs'}">${mio ? '<span class="sr-only">Vos: </span>' : ''}${esc(m.texto)}<time>${esc(hora(m.created_at))}</time></div>`);
  }
  const alFinal = () => window.scrollTo({ top: document.body.scrollHeight });

  await cargarContacto();
  pintar();
  const { data: mensajes } = await sb.from('mensajes').select('*').eq('pedido_id', p.id).order('created_at');
  (mensajes || []).forEach(agregarMensaje);

  sb.channel(`mensajes-${p.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `pedido_id=eq.${p.id}` }, ({ new: m }) => {
      agregarMensaje(m);
      alFinal();
    })
    .subscribe();

  escucharPedido(p.id, async () => {
    p = await cargarPedido(id);
    await cargarContacto();
    pintar();
  });

  composer.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = composer.querySelector('input');
    const texto = input.value.trim();
    if (!texto) return;
    input.value = '';
    const { data, error } = await sb.from('mensajes').insert({ pedido_id: p.id, texto }).select().single();
    if (error) {
      input.value = texto;
      avisar($('#acciones'), textoError(error));
      return;
    }
    agregarMensaje(data);
    alFinal();
  });

  // ---------- Diálogos ----------

  window.addEventListener('hashchange', () => {
    if (location.hash !== '#visita') return;
    const base = p.visita_at ? new Date(p.visita_at) : new Date(Date.now() + 86400000);
    const local = new Date(base.getTime() - base.getTimezoneOffset() * 60000).toISOString();
    $('#v-fecha').value = local.slice(0, 10);
    if (p.visita_at) $('#v-hora').value = local.slice(11, 16);
  });

  alConfirmar('visita', async () => {
    const fecha = $('#v-fecha').value;
    const horaVisita = $('#v-hora').value;
    if (!fecha || !horaVisita) throw new Error('Elegí el día y la hora.');
    const { error } = await sb.rpc('fijar_visita', { p_pedido: p.id, p_fecha: new Date(`${fecha}T${horaVisita}`).toISOString() });
    if (error) throw error;
    p = await cargarPedido(id);
    pintar();
    cerrarModal();
  });

  alConfirmar('terminado', async () => {
    const { data: estado, error } = await sb.rpc('marcar_terminado', { p_pedido: p.id });
    if (error) throw error;
    if (estado === 'terminado' && esCliente) {
      location.replace(`calificar.html?id=${p.id}`);
      await detener();
    }
    p = await cargarPedido(id);
    pintar();
    cerrarModal();
  });

  alConfirmar('cancelar-trabajo', async () => {
    const { error } = await sb.rpc('cancelar_pedido', { p_pedido: p.id });
    if (error) throw error;
    location.replace(esCliente ? 'pedidos.html' : 'trabajos.html');
  });

  listo();
  alFinal();
} catch (err) {
  fallo(err);
}
