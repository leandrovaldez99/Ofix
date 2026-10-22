// Funciones que usan todas las pantallas
import { sb } from './supabase.js';

export { sb };

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const param = (nombre) => new URLSearchParams(location.search).get(nombre);

export const OFICIOS = {
  plomeria: 'Plomería',
  gas: 'Gas',
  electricidad: 'Electricidad',
  pintura: 'Pintura',
  carpinteria: 'Carpintería',
  cerrajeria: 'Cerrajería',
};

// Para textos como "Le avisamos a 3 plomeros"
export const OFICIOS_PERSONA = {
  plomeria: ['plomero', 'plomeros'],
  gas: ['gasista', 'gasistas'],
  electricidad: ['electricista', 'electricistas'],
  pintura: ['pintor', 'pintores'],
  carpinteria: ['carpintero', 'carpinteros'],
  cerrajeria: ['cerrajero', 'cerrajeros'],
};

export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// ---------- Texto ----------

export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export const iniciales = (p) => `${(p?.nombre || '?')[0]}${(p?.apellido || '')[0] || ''}`.toUpperCase();
export const nombreCompleto = (p) => (p ? `${p.nombre} ${p.apellido}` : '');
export const nombreCorto = (p) => (p ? `${p.nombre} ${(p.apellido || '')[0] || ''}.` : '');

const COLORES_AVATAR = ['', 'clay', 'ink', 'green2'];
export function colorAvatar(id = '') {
  let n = 0;
  for (const c of id) n = (n + c.charCodeAt(0)) % COLORES_AVATAR.length;
  return COLORES_AVATAR[n];
}

export function avatar(p, extra = '') {
  return `<div class="avatar ${colorAvatar(p?.id)} ${extra}" aria-hidden="true">${esc(iniciales(p))}</div>`;
}

const ESTRELLA = '<path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z"/>';

export function estrellas(puntaje, tam = 13) {
  const llenas = Math.round(Number(puntaje) || 0);
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<svg class="${i > llenas ? 'off' : ''}" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">${ESTRELLA}</svg>`;
  }
  return `<span class="stars" aria-hidden="true">${html}</span>`;
}

// "4.8 (37)" o "Sin reseñas todavía"
export function rating(promedio, cantidad, sufijo) {
  if (!cantidad) return '<div class="rating"><span>Sin reseñas todavía</span></div>';
  const texto = sufijo ? `${promedio} · ${sufijo}` : `${promedio} (${cantidad})`;
  return `<div class="rating"><span class="sr-only">${promedio} de 5 estrellas</span>${estrellas(promedio)}<span>${esc(texto)}</span></div>`;
}

export const km = (d) => (d == null ? '' : d < 1 ? 'a menos de 1 km' : `${d.toFixed(1).replace('.', ',')} km`);

// ---------- Fechas ----------

export function hace(fecha) {
  const seg = (Date.now() - new Date(fecha)) / 1000;
  if (seg < 60) return 'recién';
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
  const dias = Math.floor(seg / 86400);
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
}

export const minutosHasta = (fecha) => Math.max(0, Math.ceil((new Date(fecha) - Date.now()) / 60000));

export const hora = (f) => new Date(f).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export function diaYHora(f) {
  const d = new Date(f);
  const hoy = new Date();
  const ayer = new Date(Date.now() - 86400000);
  if (d.toDateString() === hoy.toDateString()) return `Hoy ${hora(f)}`;
  if (d.toDateString() === ayer.toDateString()) return `Ayer ${hora(f)}`;
  return `${d.toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })} ${hora(f)}`;
}

export function fechaVisita(f) {
  const d = new Date(f);
  const texto = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${texto[0].toUpperCase()}${texto.slice(1)} · ${hora(f)} h`;
}

// ---------- Distancias ----------

// Distancia en km entre dos puntos { lat, lng }
export function distanciaKm(a, b) {
  if (a?.lat == null || b?.lat == null) return null;
  const rad = (g) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// ---------- Sesión ----------

let perfilActual;

export async function usuarioActual() {
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export async function cargarPerfil(uid) {
  const { data } = await sb.from('perfiles').select('*').eq('id', uid).maybeSingle();
  return data;
}

// Crea el perfil con los datos que se guardaron al registrarse
// (cuando hubo que confirmar el correo antes de entrar)
async function crearPerfilDesdeRegistro(user) {
  const m = user.user_metadata || {};
  if (!m.rol || !m.nombre || !m.apellido) return null;
  const { error } = await sb.from('perfiles').insert({ id: user.id, rol: m.rol, nombre: m.nombre, apellido: m.apellido });
  if (error) throw error;
  if (m.telefono) await sb.from('contactos').insert({ id: user.id, telefono: m.telefono });
  return cargarPerfil(user.id);
}

// Pantalla a la que va cada usuario después de ingresar
export async function destinoInicial(user) {
  let perfil = await cargarPerfil(user.id);
  if (!perfil) perfil = await crearPerfilDesdeRegistro(user);
  if (!perfil) return 'completar-perfil.html';
  if (perfil.rol === 'cliente') return 'inicio.html';
  const { data: ficha } = await sb.from('profesionales').select('id').eq('id', user.id).maybeSingle();
  return ficha ? 'trabajos.html' : 'registro-profesional-2.html';
}

export async function irAInicio(user) {
  location.replace(await destinoInicial(user));
}

// Exige sesión y el rol indicado. Devuelve { user, perfil }.
export async function requerir(rol) {
  const user = await usuarioActual();
  if (!user) {
    location.replace('index.html');
    return new Promise(() => {});
  }
  const perfil = await cargarPerfil(user.id);
  if (!perfil || (rol && perfil.rol !== rol)) {
    await irAInicio(user);
    return new Promise(() => {});
  }
  perfilActual = perfil;
  $$('.sitebar .user').forEach((el) => { el.textContent = nombreCompleto(perfil); });
  return { user, perfil };
}

export const perfil = () => perfilActual;

export async function cerrarSesion() {
  await sb.auth.signOut();
  location.replace('index.html');
}

export async function eliminarCuenta() {
  const { error } = await sb.rpc('eliminar_cuenta');
  if (error) throw error;
  await sb.auth.signOut({ scope: 'local' });
  location.replace('index.html');
}

// Redirección del navegador a Google; vuelve a la página indicada
export async function ingresarConGoogle(volverA = 'index.html') {
  const url = new URL(volverA, location.href).href;
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: url } });
  if (error) throw error;
}

// ---------- Mensajes al usuario ----------

const ERRORES = [
  [/invalid login credentials/i, 'El correo o la contraseña no son correctos.'],
  [/email not confirmed/i, 'Todavía no confirmaste tu correo. Revisá tu casilla (y el spam).'],
  [/already registered|already exists/i, 'Ya hay una cuenta con ese correo. Ingresá desde la pantalla principal.'],
  [/password should be at least/i, 'La contraseña tiene que tener al menos 8 caracteres.'],
  [/rate limit|too many/i, 'Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.'],
  [/provider is not enabled/i, 'El ingreso con Google todavía no está activado en Supabase.'],
  [/row-level security|permission denied/i, 'No tenés permiso para hacer eso.'],
  [/failed to fetch|network/i, 'No hay conexión con el servidor. Revisá tu internet.'],
  [/same.*password|different from the old/i, 'La contraseña nueva tiene que ser distinta de la anterior.'],
];

export function textoError(err) {
  const msg = err?.message || String(err);
  for (const [re, texto] of ERRORES) if (re.test(msg)) return texto;
  return msg;
}

// Muestra un aviso arriba de un elemento (o lo actualiza si ya existe)
export function avisar(ancla, texto, tipo = 'clay') {
  let caja = ancla.parentElement.querySelector(':scope > .aviso');
  if (!caja) {
    caja = document.createElement('div');
    caja.setAttribute('role', 'alert');
    ancla.before(caja);
  }
  caja.className = `note ${tipo} aviso`;
  caja.innerHTML = `<p>${esc(texto)}</p>`;
  caja.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return caja;
}

export function limpiarAviso(ancla) {
  ancla.parentElement.querySelector(':scope > .aviso')?.remove();
}

// Deshabilita el botón mientras corre la acción y muestra el error si falla
export async function conCarga(boton, accion, { error: ancla } = {}) {
  const textoOriginal = boton?.innerHTML;
  if (boton) { boton.disabled = true; boton.setAttribute('aria-busy', 'true'); }
  try {
    return await accion();
  } catch (err) {
    console.error(err);
    avisar(ancla || boton, textoError(err));
  } finally {
    if (boton) { boton.disabled = false; boton.removeAttribute('aria-busy'); boton.innerHTML = textoOriginal; }
  }
}

// Las pantallas arrancan ocultas (body.cargando) hasta tener los datos
export function listo() {
  document.body.classList.remove('cargando');
}

export function fallo(err) {
  console.error(err);
  listo();
  const main = $('main');
  if (main) avisar(main.firstElementChild || main, `No se pudo cargar la pantalla. ${textoError(err)}`);
}

// ---------- Diálogos (se abren con un enlace a #id) ----------

export function cerrarModal() {
  location.hash = '';
}

export function abrirModal(id) {
  location.hash = id;
}

// El botón principal de un diálogo ejecuta la acción en vez de navegar
export function alConfirmar(idModal, accion) {
  const modal = document.getElementById(idModal);
  const boton = modal?.querySelector('.modal-actions .btn:last-child');
  if (!boton) return;
  boton.addEventListener('click', async (e) => {
    e.preventDefault();
    await conCarga(boton, accion, { error: modal.querySelector('.modal-body p') });
  });
}

// ---------- Pedidos ----------

export const SELECT_PEDIDO = `*,
  cliente:perfiles!pedidos_cliente_id_fkey(id, nombre, apellido),
  profesional:perfiles!pedidos_profesional_id_fkey(id, nombre, apellido),
  direccion:direcciones(calle, numero, localidad, provincia, cp, lat, lng, ubicacion_exacta),
  resena:resenas(puntaje)`;

export async function cargarPedido(id) {
  const { data, error } = await sb.from('pedidos').select(SELECT_PEDIDO).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Avisa cuando cambia el pedido (otro usuario aceptó, confirmó, etc.)
export function escucharPedido(id, alCambiar) {
  return sb.channel(`pedido-${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${id}` }, alCambiar)
    .subscribe();
}

// Lleva al cliente a la pantalla que corresponde al estado del pedido
export function irAPedidoSiCambio(p, paginaActual) {
  const destino = (p && paginaPedidoCliente(p)) || 'pedidos.html';
  if (!destino.startsWith(paginaActual)) {
    location.replace(destino);
    return true;
  }
  return false;
}

// Para cortar la carga de una pantalla después de redirigir
export const detener = () => new Promise(() => {});
export const redirigir = (url) => {
  location.replace(url);
  return detener();
};

export function paginaPedidoCliente(p) {
  if (p.estado === 'borrador') return `buscar.html?pedido=${p.id}&oficio=${p.oficio_id}`;
  if (p.estado === 'buscando') {
    return new Date(p.vence_at) > new Date() ? `pedido-esperando.html?id=${p.id}` : `sin-profesionales.html?id=${p.id}`;
  }
  if (p.estado === 'asignado') return `pedido-asignado.html?id=${p.id}`;
  if (p.estado === 'confirmado') return `chat-cliente.html?id=${p.id}`;
  if (p.estado === 'terminado' && !p.resena) return `calificar.html?id=${p.id}`;
  return null;
}

export function estadoPedido(p) {
  const vencido = p.estado === 'buscando' && new Date(p.vence_at) <= new Date();
  if (vencido) return { texto: 'Nadie lo tomó todavía', clase: '' };
  return {
    borrador: { texto: 'Elegí un profesional', clase: '' },
    buscando: { texto: 'Buscando profesional', clase: '' },
    asignado: { texto: 'Un profesional aceptó', clase: 'green' },
    confirmado: { texto: p.visita_at ? 'Visita acordada' : 'Coordinando la visita', clase: 'green' },
    terminado: { texto: p.resena ? 'Terminado y calificado' : 'Terminado · falta calificar', clase: p.resena ? 'gray' : 'green' },
    cancelado: { texto: p.confirmado_at ? 'Cancelado' : 'Desactivado', clase: 'gray' },
  }[p.estado];
}

const COLOR_ESTADO = { '': 'var(--clay)', green: 'var(--green)', gray: 'var(--muted)' };

export function tarjetaPedido(p, { href, detalle, accion }) {
  const e = estadoPedido(p);
  const tag = href ? 'a' : 'div';
  return `<${tag} class="card" ${href ? `href="${esc(href)}"` : ''}>
    <div class="status ${e.clase}"><span class="status-dot"></span><span class="small" style="font-weight:600;color:${COLOR_ESTADO[e.clase]}">${esc(e.texto)}</span><span class="ml-auto xsmall muted">${esc(hace(p.created_at))}</span></div>
    <p style="margin-top:9px;font-size:14px;font-weight:600">${esc(p.titulo)}</p>
    <p class="small muted" style="margin-top:3px">${esc(detalle)}</p>
    ${accion && !href ? (accion.href
      ? `<a class="btn btn-white btn-sm" style="margin-top:12px" href="${esc(accion.href)}">${esc(accion.texto)}</a>`
      : `<button class="btn btn-white btn-sm" style="margin-top:12px" type="button" data-accion="${esc(accion.accion)}" data-id="${p.id}">${esc(accion.texto)}</button>`) : ''}
  </${tag}>`;
}

export function resumenPedido(p, { direccion } = {}) {
  const modo = p.modo === 'primero' ? 'Primero disponible' : 'Elegido por vos';
  return `<div class="card">
    <div class="row"><span class="chip">${esc(OFICIOS[p.oficio_id])}</span><span class="chip clay">${modo}</span><span class="ml-auto xsmall muted">#${p.id}</span></div>
    <p style="margin-top:10px;font-size:15px;font-weight:700">${esc(p.titulo)}</p>
    <p class="small" style="margin-top:4px;line-height:1.5;white-space:pre-line">${esc(p.descripcion)}</p>
    <div class="kv" style="margin-top:10px"><div class="muted">${esc(direccion || p.localidad)}</div></div>
  </div>`;
}

export function textoDireccion(d) {
  return d ? `${d.calle} ${d.numero}, ${d.localidad}` : '';
}

export function lineaTiempo(p, nombrePro) {
  const pasos = [
    ['Publicado', diaYHora(p.created_at), true],
    ['Profesional asignado',
      p.asignado_at ? `${diaYHora(p.asignado_at)}${nombrePro ? ` · ${nombrePro}` : ''}` : 'El de mejor puntaje tiene prioridad; si no responde, pasa al siguiente',
      !!p.asignado_at],
    ['Visita acordada por chat', p.visita_at ? fechaVisita(p.visita_at) : 'Pónganse de acuerdo en día y hora', !!p.visita_at],
    ['Trabajo terminado', p.terminado_at ? diaYHora(p.terminado_at) : 'Lo confirman los dos', !!p.terminado_at],
    ['Calificar el servicio', 'Después de la visita', !!p.resena],
  ];
  const actual = pasos.findIndex((x) => !x[2]);
  return `<div class="card timeline" aria-label="Etapas del pedido">${pasos.map(([t, s, hecho], i) => `
    <div class="tl-step ${hecho ? 'done' : i === actual ? 'now' : ''}"><div class="tl-dot"></div><div class="tl-body"><div class="tl-title">${t}</div><div class="tl-sub">${esc(s)}</div></div></div>`).join('')}
  </div>`;
}

// ---------- Archivos ----------

export function nombreArchivo(file) {
  const limpio = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${limpio}`;
}

export async function subir(bucket, ruta, file) {
  const { error } = await sb.storage.from(bucket).upload(ruta, file, { contentType: file.type });
  if (error) throw error;
  return ruta;
}

// ---------- Encabezado ----------

export function ponerTitulo(texto) {
  document.title = `${texto} · Ofix`;
}
