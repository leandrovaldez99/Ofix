import {
  sb, $, $$, esc, param, requerir, listo, fallo, conCarga, limpiarAviso,
  OFICIOS, textoDireccion, nombreArchivo, subir, nombreCompleto,
} from '../comun.js';

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

  function mostrarNuevaDir() {
    const nueva = selDir.value === 'nueva';
    nuevaDir.hidden = !nueva;
    form.calle.required = nueva;
    form.numero.required = nueva;
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
        const { data, error } = await sb.from('direcciones').insert({
          calle: form.calle.value.trim(),
          numero: form.numero.value.trim(),
          localidad: form.localidad.value,
          cp: form.cp.value.trim() || null,
        }).select('id').single();
        if (error) throw error;
        direccion = data.id;
        // Si algo falla después, al reintentar no se vuelve a crear
        selDir.insertAdjacentHTML('afterbegin', `<option value="${data.id}">${esc(`${form.calle.value} ${form.numero.value}, ${form.localidad.value}`)}</option>`);
        selDir.value = String(data.id);
        mostrarNuevaDir();
      }

      const { data: id, error } = await sb.rpc('publicar_pedido', {
        p_oficio: $('[name=oficio]:checked').value,
        p_titulo: form.titulo.value.trim(),
        p_descripcion: form.descripcion.value.trim(),
        p_direccion: direccion,
        p_modo: modo === 'primero' ? 'primero' : 'elegido',
        p_profesional: modo === 'profesional' ? pro.id : null,
      });
      if (error) throw error;

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
