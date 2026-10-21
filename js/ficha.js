// Oficios, zona y horarios del profesional: paso 2 del registro y "Zona y disponibilidad"
import { sb, $$ } from './comun.js';

export async function cargarFicha(uid) {
  const [{ data: ficha }, { data: oficios }, { data: horarios }] = await Promise.all([
    sb.from('profesionales').select('*').eq('id', uid).maybeSingle(),
    sb.from('profesional_oficios').select('oficio_id').eq('profesional_id', uid),
    sb.from('horarios').select('*').eq('profesional_id', uid),
  ]);
  if (!ficha) return null;
  return { ...ficha, oficios: (oficios || []).map((o) => o.oficio_id), horarios: horarios || [] };
}

export function llenarFicha(form, ficha) {
  $$('[name=oficio]', form).forEach((c) => { c.checked = ficha.oficios.includes(c.value); });
  form.descripcion.value = ficha.descripcion || '';
  form.localidad.value = ficha.localidad;
  form.radio.value = String(ficha.radio_km);
  for (let dia = 0; dia < 7; dia++) {
    const h = ficha.horarios.find((x) => x.dia === dia);
    form[`dia-${dia}`].checked = !!h;
    if (h) {
      form[`desde-${dia}`].value = h.desde.slice(0, 5);
      form[`hasta-${dia}`].value = h.hasta.slice(0, 5);
    }
  }
}

// Devuelve los datos del formulario o lanza un error con el problema
export function leerFicha(form) {
  const oficios = $$('[name=oficio]:checked', form).map((c) => c.value);
  if (!oficios.length) throw new Error('Elegí al menos un oficio.');
  const horarios = [];
  for (let dia = 0; dia < 7; dia++) {
    if (!form[`dia-${dia}`].checked) continue;
    const desde = form[`desde-${dia}`].value;
    const hasta = form[`hasta-${dia}`].value;
    if (!desde || !hasta || desde >= hasta) {
      throw new Error('Revisá los horarios: la hora de inicio tiene que ser anterior a la de fin.');
    }
    horarios.push({ dia, desde, hasta });
  }
  return {
    oficios,
    horarios,
    descripcion: form.descripcion.value.trim() || null,
    localidad: form.localidad.value,
    radio_km: Number(form.radio.value),
  };
}

export async function guardarFicha(uid, datos, existe) {
  const ficha = { descripcion: datos.descripcion, localidad: datos.localidad, radio_km: datos.radio_km };
  const { error } = existe
    ? await sb.from('profesionales').update(ficha).eq('id', uid)
    : await sb.from('profesionales').insert({ id: uid, ...ficha });
  if (error) throw error;

  // Oficios y horarios se reemplazan enteros
  let r = await sb.from('profesional_oficios').delete().eq('profesional_id', uid);
  if (r.error) throw r.error;
  r = await sb.from('profesional_oficios').insert(datos.oficios.map((oficio_id) => ({ profesional_id: uid, oficio_id })));
  if (r.error) throw r.error;

  r = await sb.from('horarios').delete().eq('profesional_id', uid);
  if (r.error) throw r.error;
  if (datos.horarios.length) {
    r = await sb.from('horarios').insert(datos.horarios.map((h) => ({ profesional_id: uid, ...h })));
    if (r.error) throw r.error;
  }
}

// "Lun a Vie 8 a 18 · Sáb 9 a 13"
export function resumenHorarios(horarios) {
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const fmt = (t) => {
    const [h, m] = t.split(':');
    return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
  };
  const orden = [...horarios].sort((a, b) => a.dia - b.dia);
  const grupos = [];
  for (const h of orden) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.hasta === h.dia - 1 && ultimo.desde_h === h.desde && ultimo.hasta_h === h.hasta) {
      ultimo.hasta = h.dia;
    } else {
      grupos.push({ desde: h.dia, hasta: h.dia, desde_h: h.desde, hasta_h: h.hasta });
    }
  }
  if (!grupos.length) return 'Sin horarios cargados';
  return grupos.map((g) => {
    const dias = g.desde === g.hasta ? DIAS[g.desde] : `${DIAS[g.desde]} a ${DIAS[g.hasta]}`;
    return `${dias} ${fmt(g.desde_h)} a ${fmt(g.hasta_h)}`;
  }).join(' · ');
}
