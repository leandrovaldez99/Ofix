import {
  sb, $, $$, esc, param, requerir, listo, fallo, conCarga, avisar, limpiarAviso,
  OFICIOS, textoDireccion, nombreArchivo, subir, nombreCompleto,
} from '../comun.js';
import { selectorLocalidad, botonMiUbicacion, guardarDireccion } from '../ubicacion.js';

try {
  const { user } = await requerir('cliente');
  const form = $('#form-pedido');
  const selDir = $('#f-dir');
  const nuevaDir = $('#nueva-dir');

  const oficio = param('oficio');
  if (oficio && OFICIOS[oficio]) $(`[name=oficio][value="${oficio}"]`).checked = true;

  // Pedido directo a un profesional elegido desde su perfil
  const proId = param('profesional');
  let pro = null;
  if (proId) {
    const { data } = await sb.from('profesionales_publicos').select('id, nombre, apellido, oficios').eq('id', proId).maybeSingle();
    pro = data;
  }
  if (pro) {
    $('#modos').hidden = true;
    $('#modo-pro').hidden = false;
    $('#btn-pro').textContent = `Enviarle el pedido a ${pro.nombre}`;
    $('.pagehead .sub').textContent = `Para ${nombreCompleto(pro)}`;
    $('.pagehead .back').href = `profesional.html?id=${pro.id}`;
    // Solo los oficios que ofrece
    $$('[name=oficio]').forEach((r) => { r.closest('label').hidden = !pro.oficios.includes(r.value); });
    if (!pro.oficios.includes($('[name=oficio]:checked').value)) $(`[name=oficio][value="${pro.oficios[0]}"]`).checked = true;
  }

  const { data: direcciones } = await sb.from('direcciones').select('*').eq('cliente_id', user.id)
    .order('principal', { ascending: false }).order('created_at');
  selDir.innerHTML = direcciones.map((d) => `<option value="${d.id}">${esc(textoDireccion(d))}</option>`).join('')
    + '<option value="nueva">Otra dirección…</option>';

  // Partir de un pedido desactivado o cancelado:
  //   ?reactivar=ID → se reactiva ese mismo pedido (mismo número)
  //   ?repetir=ID   → se publica una copia (cuando ya había un profesional confirmado)
  const reactivarId = param('reactivar');
  const repetirId = param('repetir');
  let original = null;
  let reactivando = false;
  let fotosOriginal = [];
  const fotosQuitadas = new Set();
  if ((reactivarId || repetirId) && !pro) {
    const { data } = await sb.from('pedidos').select('id, oficio_id, titulo, descripcion, direccion_id, estado, confirmado_at')
      .eq('id', reactivarId || repetirId).eq('cliente_id', user.id).maybeSingle();
    original = data;
    reactivando = !!(reactivarId && data?.estado === 'cancelado' && !data.confirmado_at);
  }
  if (original) {
    if (OFICIOS[original.oficio_id]) $(`[name=oficio][value="${original.oficio_id}"]`).checked = true;
    form.titulo.value = original.titulo;
    form.descripcion.value = original.descripcion;
    if (direcciones.some((d) => d.id === original.direccion_id)) selDir.value = String(original.direccion_id);
    const { data: archivos } = await sb.storage.from('pedidos').list(String(original.id));
    fotosOriginal = (archivos || []).filter((a) => a.id);
    const n = fotosOriginal.length;
    const textoFotos = n === 1 ? 'la foto' : `las ${n} fotos`;
    const fotosNota = n ? ` Más abajo están ${textoFotos} que habías subido: podés quitar alguna o agregar otras.` : '';
    const nota = reactivando
      ? `<b>Estás reactivando tu pedido #${original.id}.</b> Revisá los datos, cambiá lo que haga falta y elegí cómo encontrar al profesional.${fotosNota}`
      : `<b>Copiamos los datos de tu pedido #${original.id}.</b> Revisalos, cambiá lo que quieras y publicalo.${fotosNota}`;
    form.insertAdjacentHTML('afterbegin', `<div class="note green"><p>${nota}</p></div>`);
    $('.pagehead .sub').textContent = reactivando ? `Reactivar pedido #${original.id}` : `Copia del pedido #${original.id}`;

    // Fotos del pedido, con la opción de quitarlas (se aplica al publicar)
    if (n) {
      const cont = $('#fotos-actuales');
      const { data: firmadas } = await sb.storage.from('pedidos')
        .createSignedUrls(fotosOriginal.map((f) => `${original.id}/${f.name}`), 3600);
      cont.innerHTML = fotosOriginal.map((f, i) => `
        <div class="foto-item" data-nombre="${esc(f.name)}">
          <img src="${esc(firmadas?.[i]?.signedUrl || '')}" alt="Foto ${i + 1} del pedido">
          <button type="button" aria-pressed="false">Quitar</button>
        </div>`).join('');
      cont.hidden = false;
      cont.addEventListener('click', (e) => {
        const boton = e.target.closest('button');
        if (!boton) return;
        const item = boton.closest('.foto-item');
        const quitarla = !fotosQuitadas.has(item.dataset.nombre);
        if (quitarla) fotosQuitadas.add(item.dataset.nombre);
        else fotosQuitadas.delete(item.dataset.nombre);
        item.classList.toggle('quitada', quitarla);
        boton.textContent = quitarla ? 'Volver a agregar' : 'Quitar';
        boton.setAttribute('aria-pressed', String(quitarla));
      });
    }
    $('.pagehead .back').href = 'pedidos.html';
  }

  const selector = selectorLocalidad(form);
  let gps = null;
  botonMiUbicacion($('#btn-ubicacion'), selector, (punto, l, err) => {
    gps = punto;
    if (err) avisar($('#btn-ubicacion'), err.message);
    else limpiarAviso($('#btn-ubicacion'));
  });

  function mostrarNuevaDir() {
    const nueva = selDir.value === 'nueva';
    nuevaDir.hidden = !nueva;
    form.calle.required = nueva;
    form.numero.required = nueva;
    form.provincia.required = nueva;
    form.localidad_nombre.required = nueva;
  }
  selDir.addEventListener('change', mostrarNuevaDir);
  mostrarNuevaDir();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    limpiarAviso(form.querySelector('.note'));
    const modo = e.submitter?.value || 'primero';

    await conCarga(e.submitter, async () => {
      let direccion = Number(selDir.value);
      if (selDir.value === 'nueva') {
        const data = await guardarDireccion({
          calle: form.calle.value.trim(),
          numero: form.numero.value.trim(),
          cp: form.cp.value.trim(),
          localidad: selector.valor,
          gps,
        });
        direccion = data.id;
        // Si algo falla después, al reintentar no se vuelve a crear
        selDir.insertAdjacentHTML('afterbegin', `<option value="${data.id}">${esc(textoDireccion(data))}</option>`);
        selDir.value = String(data.id);
        mostrarNuevaDir();
      }

      const datos = {
        p_oficio: $('[name=oficio]:checked').value,
        p_titulo: form.titulo.value.trim(),
        p_descripcion: form.descripcion.value.trim(),
        p_direccion: direccion,
        p_modo: modo === 'primero' ? 'primero' : 'elegido',
      };
      let id;
      if (reactivando) {
        const { error } = await sb.rpc('reactivar_pedido', { p_pedido: original.id, ...datos });
        if (error) throw error;
        id = original.id;
        if (fotosQuitadas.size) {
          const { error: errFotos } = await sb.storage.from('pedidos').remove([...fotosQuitadas].map((n) => `${id}/${n}`));
          if (errFotos) console.error(errFotos);
        }
      } else {
        const { data, error } = await sb.rpc('publicar_pedido', { ...datos, p_profesional: modo === 'profesional' ? pro.id : null });
        if (error) throw error;
        id = data;
        // En una copia, las fotos del pedido anterior pasan al nuevo
        if (original) {
          for (const f of fotosOriginal.filter((x) => !fotosQuitadas.has(x.name))) {
            const { error: errCopia } = await sb.storage.from('pedidos').copy(`${original.id}/${f.name}`, `${id}/${f.name}`);
            if (errCopia) console.error(errCopia);
          }
        }
      }

      // Las fotos se suben en la carpeta del pedido
      for (const file of form.fotos.files) {
        try {
          await subir('pedidos', `${id}/${nombreArchivo(file)}`, file);
        } catch (err) {
          console.error(err);
        }
      }

      location.href = modo === 'elegir'
        ? `buscar.html?pedido=${id}&oficio=${$('[name=oficio]:checked').value}`
        : `pedido-esperando.html?id=${id}`;
    }, { error: form.querySelector('.note') });
  });

  listo();
} catch (err) {
  fallo(err);
}
