import {
  sb, $, esc, param, requerir, listo, fallo, conCarga, redirigir, cargarLocalidades, distancia,
  OFICIOS, avatar, rating, estrellas, km, hace, nombreCompleto, nombreCorto, ponerTitulo,
} from '../comun.js';
import { resumenHorarios } from '../ficha.js';
import { icono } from '../iconos.js';

try {
  const { user } = await requerir('cliente');
  const id = param('id');
  const pedidoId = param('pedido');
  if (!id) await redirigir('buscar.html');

  const [{ data: pro, error }, { data: certs }, { data: horarios }, { data: resenas }, { data: dir }] = await Promise.all([
    sb.from('profesionales_publicos').select('*').eq('id', id).maybeSingle(),
    sb.from('documentos').select('nombre, entidad').eq('profesional_id', id).eq('tipo', 'certificado').eq('estado', 'verificado'),
    sb.from('horarios').select('*').eq('profesional_id', id),
    sb.from('resenas').select('puntaje, comentario, created_at, cliente:perfiles!resenas_cliente_id_fkey(nombre, apellido)')
      .eq('profesional_id', id).order('created_at', { ascending: false }).limit(20),
    sb.from('direcciones').select('localidad').eq('cliente_id', user.id).eq('principal', true).maybeSingle(),
    cargarLocalidades(),
  ]);
  if (error) throw error;
  if (!pro) await redirigir('buscar.html');

  ponerTitulo(nombreCompleto(pro));
  $('#volver').href = `buscar.html?oficio=${pro.oficios[0] || 'plomeria'}${pedidoId ? `&pedido=${pedidoId}` : ''}`;
  const d = dir ? distancia(dir.localidad, pro.localidad) : null;
  const validado = pro.estado_validacion === 'validado';

  $('#contenido').innerHTML = `
  <div>
    <div class="card">
      <div class="row" style="gap:14px">
        ${avatar(pro, 'lg')}
        <div>
          <h2 style="font-size:19px">${esc(nombreCompleto(pro))}</h2>
          <div class="small muted" style="margin-top:2px">${esc(pro.oficios.map((o) => OFICIOS[o]).join(' · '))}</div>
          <div style="margin-top:6px">${rating(pro.promedio, pro.cantidad_resenas, `${pro.servicios} ${pro.servicios === 1 ? 'servicio' : 'servicios'}`)}</div>
        </div>
      </div>
      ${pro.descripcion ? `<p class="small" style="margin-top:12px;line-height:1.5">${esc(pro.descripcion)}</p>` : ''}
      <div class="chips" style="margin-top:12px;gap:6px">
        ${pro.matriculado ? '<span class="chip">Matriculado</span>' : ''}
        ${pro.disponible_hoy ? '<span class="chip green">Disponible hoy</span>' : '<span class="chip gray">No disponible hoy</span>'}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Certificaciones</div>
      ${validado ? `<div class="row small">${icono.check()} Identidad verificada <span class="ml-auto xsmall" style="color:var(--green);font-weight:600">VERIFICADA</span></div>` : ''}
      ${(certs || []).map((c) => `<div class="row small" style="margin-top:8px">${icono.check()} ${esc(c.nombre)}${c.entidad ? ` · ${esc(c.entidad)}` : ''} <span class="ml-auto xsmall" style="color:var(--green);font-weight:600">VERIFICADA</span></div>`).join('')}
      ${!validado && !certs?.length ? '<p class="small muted">Todavía no tiene certificaciones verificadas.</p>' : ''}
    </div>
    <div class="card">
      <div class="kv">${icono.ubicacion()}<div><b>Zona:</b> ${esc(pro.localidad)} y alrededores (${pro.radio_km} km)${d != null ? ` · ${km(d)} tuyo` : ''}</div></div>
      <div class="kv">${icono.reloj()}<div><b>Horarios:</b> ${esc(resumenHorarios(horarios || []))}</div></div>
      <div class="kv">${icono.valija()}<div><b>En Ofix desde:</b> ${esc(new Date(pro.created_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }))}</div></div>
    </div>
  </div>
  <div>
    <h2 class="section-title">Reseñas <span class="muted">· ${pro.cantidad_resenas}</span></h2>
    ${(resenas || []).map((r) => `
      <div class="card">
        <div class="row"><span style="font-size:14px;font-weight:700">${esc(r.cliente ? nombreCorto(r.cliente) : 'Cliente')}</span><span class="ml-auto">${estrellas(r.puntaje, 12)}</span></div>
        ${r.comentario ? `<p class="small" style="margin-top:6px;line-height:1.5">${esc(r.comentario)}</p>` : ''}
        <div class="xsmall muted" style="margin-top:6px">${esc(hace(r.created_at))}</div>
      </div>`).join('') || '<div class="card small muted">Todavía no tiene reseñas.</div>'}
    <a class="btn btn-clay" id="btn-pedir" href="nuevo-pedido.html?profesional=${pro.id}&oficio=${pro.oficios[0] || ''}">
      ${pedidoId ? `Mandarle mi pedido a ${esc(pro.nombre)}` : 'Contarle mi problema'}
    </a>
  </div>`;

  if (pedidoId) {
    const boton = $('#btn-pedir');
    boton.addEventListener('click', async (e) => {
      e.preventDefault();
      await conCarga(boton, async () => {
        const { error: err } = await sb.rpc('elegir_profesional', { p_pedido: Number(pedidoId), p_profesional: pro.id });
        if (err) throw err;
        location.href = `pedido-esperando.html?id=${pedidoId}`;
      });
    });
  }
  listo();
} catch (err) {
  fallo(err);
}
