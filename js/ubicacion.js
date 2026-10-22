// Provincia + localidad (catálogo de Georef) y ubicación exacta de las direcciones
import { sb, esc, distanciaKm } from './comun.js';

export const PROVINCIAS = [
  ['06', 'Buenos Aires'],
  ['10', 'Catamarca'],
  ['22', 'Chaco'],
  ['26', 'Chubut'],
  ['02', 'Ciudad Autónoma de Buenos Aires'],
  ['14', 'Córdoba'],
  ['18', 'Corrientes'],
  ['30', 'Entre Ríos'],
  ['34', 'Formosa'],
  ['38', 'Jujuy'],
  ['42', 'La Pampa'],
  ['46', 'La Rioja'],
  ['50', 'Mendoza'],
  ['54', 'Misiones'],
  ['58', 'Neuquén'],
  ['62', 'Río Negro'],
  ['66', 'Salta'],
  ['70', 'San Juan'],
  ['74', 'San Luis'],
  ['78', 'Santa Cruz'],
  ['82', 'Santa Fe'],
  ['86', 'Santiago del Estero'],
  ['94', 'Tierra del Fuego'],
  ['90', 'Tucumán'],
];

const COLUMNAS = 'id, nombre, departamento, provincia_id, provincia, lat, lng';
const ELEGI = 'Elegí la localidad de la lista que aparece al escribir.';

// "Zárate" y "zarate" se consideran iguales
export const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Conecta los campos de un formulario:
 *   <select name="provincia">, <input name="localidad_nombre"> con su lista de
 *   sugerencias (<ul role="listbox">) y <input type="hidden" name="localidad_id">.
 * La lista es propia y no un <datalist>: el del navegador vuelve a filtrar
 * las opciones y distingue tildes ("Zarate" no mostraba "Zárate").
 * Devuelve un objeto para leer o cargar la localidad elegida.
 */
export function selectorLocalidad(form) {
  const prov = form.elements.provincia;
  const texto = form.elements.localidad_nombre;
  const oculto = form.elements.localidad_id;

  let lista = document.getElementById(texto.getAttribute('aria-controls') || texto.getAttribute('list') || '');
  if (!lista || lista.tagName !== 'UL') {
    const ul = document.createElement('ul');
    ul.id = lista?.id || `${texto.id}-lista`;
    lista?.remove();
    texto.after(ul);
    lista = ul;
  }
  texto.removeAttribute('list');
  texto.setAttribute('role', 'combobox');
  texto.setAttribute('aria-autocomplete', 'list');
  texto.setAttribute('aria-controls', lista.id);
  texto.setAttribute('aria-expanded', 'false');
  texto.setAttribute('autocomplete', 'off');
  lista.className = 'sugerencias';
  lista.setAttribute('role', 'listbox');
  lista.hidden = true;
  texto.closest('.field')?.classList.add('combo');

  prov.innerHTML = '<option value="">Elegí la provincia</option>'
    + PROVINCIAS.map(([id, nombre]) => `<option value="${id}">${esc(nombre)}</option>`).join('');

  let resultados = [];
  let activo = -1;
  let elegida = null;
  let consulta = 0;

  // Si hay dos con el mismo nombre en la provincia se agrega el partido o departamento
  function etiqueta(l) {
    const repetida = resultados.filter((x) => x.nombre === l.nombre && x.provincia_id === l.provincia_id).length > 1;
    return repetida ? `${l.nombre} (${l.departamento})` : l.nombre;
  }

  function abrir(si) {
    lista.hidden = !si;
    texto.setAttribute('aria-expanded', String(si));
    if (!si) texto.removeAttribute('aria-activedescendant');
  }

  function pintar(mensaje) {
    if (mensaje) {
      lista.innerHTML = `<li class="vacio" role="option" aria-disabled="true">${esc(mensaje)}</li>`;
      abrir(true);
      return;
    }
    if (!resultados.length) {
      abrir(false);
      return;
    }
    lista.innerHTML = resultados.map((l, i) => `
      <li role="option" id="${lista.id}-${i}" data-i="${i}" aria-selected="${i === activo}">
        <b>${esc(l.nombre)}</b><small>${esc(`${l.departamento}, ${l.provincia}`)}</small>
      </li>`).join('');
    abrir(true);
    if (activo >= 0) {
      texto.setAttribute('aria-activedescendant', `${lista.id}-${activo}`);
      lista.children[activo]?.scrollIntoView({ block: 'nearest' });
    }
  }

  function elegir(l, { escribir = true, cerrar = true } = {}) {
    elegida = l || null;
    oculto.value = l ? l.id : '';
    if (l && prov.value !== l.provincia_id) prov.value = l.provincia_id;
    if (l && escribir) texto.value = etiqueta(l);
    texto.setCustomValidity(!l && texto.value.trim() ? ELEGI : '');
    if (cerrar) abrir(false);
    form.dispatchEvent(new CustomEvent('localidad', { detail: elegida }));
  }

  async function buscar() {
    const q = texto.value.trim();
    if (q.length < 2) {
      resultados = [];
      abrir(false);
      return;
    }
    const n = ++consulta;
    const { data, error } = await sb.rpc('buscar_localidades', { p_texto: q, p_provincia: prov.value || null });
    if (n !== consulta || error) return;
    resultados = data || [];
    activo = resultados.length ? 0 : -1;
    if (!resultados.length) {
      pintar(prov.value ? 'No encontramos esa localidad en la provincia elegida.' : 'No encontramos esa localidad.');
      return;
    }
    // Si escribió el nombre completo (con o sin tildes) y es una sola, queda elegida
    const exactas = resultados.filter((l) => sinTildes(l.nombre) === sinTildes(q));
    if (exactas.length === 1) {
      activo = resultados.indexOf(exactas[0]);
      elegir(exactas[0], { escribir: false, cerrar: false });
    }
    if (document.activeElement === texto) pintar();
  }

  let espera;
  texto.addEventListener('input', () => {
    clearTimeout(espera);
    elegir(null, { cerrar: false });
    espera = setTimeout(buscar, 180);
  });

  texto.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!resultados.length) return;
      e.preventDefault();
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      activo = lista.hidden ? Math.max(activo, 0) : (activo + paso + resultados.length) % resultados.length;
      pintar();
    } else if (e.key === 'Enter' && !lista.hidden && resultados[activo]) {
      e.preventDefault();
      elegir(resultados[activo]);
    } else if (e.key === 'Escape' && !lista.hidden) {
      e.preventDefault();
      abrir(false);
    }
  });

  // mousedown (y no click) para elegir antes de que el campo pierda el foco
  lista.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-i]');
    e.preventDefault();
    if (li) elegir(resultados[Number(li.dataset.i)]);
  });

  texto.addEventListener('focus', () => {
    if (resultados.length && !elegida) pintar();
  });

  texto.addEventListener('blur', () => {
    abrir(false);
    // Muestra el nombre bien escrito ("zarate" → "Zárate")
    if (elegida) texto.value = etiqueta(elegida);
  });

  prov.addEventListener('change', () => {
    if (elegida && elegida.provincia_id !== prov.value) {
      texto.value = '';
      resultados = [];
      elegir(null);
    } else if (!elegida && texto.value.trim().length >= 2) {
      buscar();
    }
  });

  function poner(l) {
    if (!l) return;
    prov.value = l.provincia_id;
    resultados = [l];
    activo = 0;
    elegir(l);
  }

  return {
    get valor() { return elegida; },
    poner,
    async cargar(id) {
      if (!id) return;
      const { data } = await sb.from('localidades').select(COLUMNAS).eq('id', id).maybeSingle();
      poner(data);
    },
    limpiar() {
      texto.value = '';
      resultados = [];
      elegir(null);
    },
  };
}

// ---------- Ubicación del dispositivo ----------

export function posicionActual() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu navegador no permite compartir la ubicación. Elegí la localidad de la lista.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy }),
      () => reject(new Error('No pudimos obtener tu ubicación. Revisá el permiso del navegador o elegí la localidad de la lista.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

export async function localidadCercana(punto) {
  const { data, error } = await sb.rpc('localidad_cercana', { p_lat: punto.lat, p_lng: punto.lng });
  if (error) throw error;
  return data?.[0] || null;
}

// ---------- Ubicación exacta de una dirección ----------

const GEOREF = 'https://apis.datos.gob.ar/georef/api/direcciones';
const MAX_KM = 40; // más lejos que esto del centro de la localidad, no la tomamos

/**
 * Busca las coordenadas de "calle altura" dentro del partido o departamento
 * de la localidad, con el servicio Georef del Estado. Devuelve { lat, lng } o
 * null si no la encuentra (en ese caso se usa el centro de la localidad).
 */
export async function ubicarDireccion({ calle, numero, localidad }) {
  if (!localidad) return null;
  const params = new URLSearchParams({
    direccion: `${calle} ${numero}`,
    departamento: localidad.id.slice(0, 5),
    max: '5',
  });
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), 7000);
  try {
    const r = await fetch(`${GEOREF}?${params}`, { signal: corte.signal });
    if (!r.ok) return null;
    const { direcciones = [] } = await r.json();
    const puntos = direcciones
      .map((d) => d.ubicacion)
      .filter((u) => u && u.lat != null && u.lon != null)
      .map((u) => ({ lat: u.lat, lng: u.lon }))
      .filter((p) => distanciaKm(p, localidad) <= MAX_KM)
      .sort((a, b) => distanciaKm(a, localidad) - distanciaKm(b, localidad));
    return puntos[0] || null;
  } catch {
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Botón "Usar mi ubicación actual" de los formularios de dirección: completa
 * provincia y localidad, y guarda el punto por si Georef no encuentra la altura.
 */
export function botonMiUbicacion(boton, selector, alUbicar) {
  boton.addEventListener('click', async () => {
    const original = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Buscando tu ubicación…';
    try {
      const punto = await posicionActual();
      const l = await localidadCercana(punto);
      if (!l) throw new Error('No encontramos una localidad cerca de tu ubicación.');
      selector.poner(l);
      alUbicar?.(punto, l);
    } catch (err) {
      alUbicar?.(null, null, err);
    } finally {
      boton.disabled = false;
      boton.textContent = original;
    }
  });
}

/**
 * Guarda una dirección nueva del cliente con sus coordenadas.
 * gps: el punto de "Usar mi ubicación", si lo usó en este formulario.
 * Devuelve la fila guardada.
 */
export async function guardarDireccion({ calle, numero, cp, localidad, gps }) {
  if (!localidad) throw new Error(ELEGI);
  let punto = await ubicarDireccion({ calle, numero, localidad });
  if (!punto && gps && distanciaKm(gps, localidad) <= MAX_KM) punto = { lat: gps.lat, lng: gps.lng };
  const { data, error } = await sb.from('direcciones').insert({
    calle, numero, cp: cp || null,
    localidad_id: localidad.id,
    lat: punto?.lat ?? null,
    lng: punto?.lng ?? null,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export function avisoUbicacion(dir) {
  return dir.ubicacion_exacta
    ? 'Guardamos la dirección y la ubicamos en el mapa: las distancias a los profesionales son exactas.'
    : `Guardamos la dirección. No encontramos la altura exacta, así que las distancias se calculan desde el centro de ${dir.localidad}.`;
}
