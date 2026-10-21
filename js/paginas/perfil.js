import {
  sb, $, esc, requerir, listo, fallo, conCarga, avisar, iniciales, colorAvatar, nombreCompleto,
} from '../comun.js';
import { iniciarDatosPersonales, iniciarCuenta } from '../datos-personales.js';
import { icono } from '../iconos.js';

try {
  const { user, perfil } = await requerir('cliente');

  function pintarTarjeta(p) {
    const av = $('#av');
    av.textContent = iniciales(p);
    av.className = `avatar lg ${colorAvatar(p.id)}`;
    $('#nombre').textContent = nombreCompleto(p);
    $('.sitebar .user').textContent = nombreCompleto(p);
  }
  pintarTarjeta(perfil);
  $('#email').textContent = user.email;
  $('#desde').textContent = `Cliente desde ${new Date(perfil.created_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`;

  // ---------- Direcciones ----------

  const lista = $('#direcciones');
  async function pintarDirecciones() {
    const { data, error } = await sb.from('direcciones').select('*').eq('cliente_id', user.id)
      .order('principal', { ascending: false }).order('created_at');
    if (error) throw error;
    lista.innerHTML = data.length ? data.map((d, i) => `
      <div class="row" style="min-height:58px;${i ? 'border-top:1px solid var(--line)' : ''}">
        <span class="muted">${icono.ubicacion(18)}</span>
        <div class="grow small"><div style="font-weight:600">${esc(`${d.calle} ${d.numero}`)}</div><div class="xsmall muted">${esc(d.localidad)}${d.cp ? ` · CP ${esc(d.cp)}` : ''}</div></div>
        ${d.principal
          ? '<span class="chip green">Principal</span>'
          : `<button class="link-btn" data-principal="${d.id}">Hacer principal</button><button class="link-btn" data-borrar="${d.id}">Quitar</button>`}
      </div>`).join('')
      : '<p class="small muted" style="padding:12px 0">Todavía no cargaste ninguna dirección.</p>';
  }
  await pintarDirecciones();

  lista.addEventListener('click', async (e) => {
    const boton = e.target.closest('button');
    if (!boton) return;
    await conCarga(boton, async () => {
      const r = boton.dataset.principal
        ? await sb.from('direcciones').update({ principal: true }).eq('id', boton.dataset.principal)
        : await sb.from('direcciones').delete().eq('id', boton.dataset.borrar);
      if (r.error) throw r.error;
      await pintarDirecciones();
    }, { error: lista });
  });

  const formDir = $('#form-dir');
  formDir.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!formDir.reportValidity()) return;
    await conCarga(formDir.querySelector('[type=submit]'), async () => {
      const { error } = await sb.from('direcciones').insert({
        calle: formDir.calle.value.trim(),
        numero: formDir.numero.value.trim(),
        localidad: formDir.localidad.value,
        cp: formDir.cp.value.trim() || null,
      });
      if (error) throw error;
      formDir.reset();
      formDir.closest('details').open = false;
      await pintarDirecciones();
      avisar(lista, 'Guardamos la dirección.', 'green');
    }, { error: formDir });
  });

  await iniciarDatosPersonales($('#form-datos'), user, perfil, pintarTarjeta);
  iniciarCuenta();
  listo();
} catch (err) {
  fallo(err);
}
