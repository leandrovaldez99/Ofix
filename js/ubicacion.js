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

/**
 * Conecta los campos de un formulario:
 *   <select name="provincia">, <input name="localidad_nombre" list="…"> con su <datalist>
 *   y <input type="hidden" name="localidad_id">.
 * Devuelve un objeto para leer o cargar la localidad elegida.
 */
export function selectorLocalidad(form) {
  const prov = form.elements.provincia;
  const texto = form.elements.localidad_nombre;
  const oculto = form.elements.localidad_id;
  const lista = document.getElementById(texto.getAttribute('list'));

  prov.innerHTML = '<option value="">Elegí la provincia</option>'
    + PROVINCIAS.map(([id, nombre]) => `<option value="${id}">${esc(nombre)}</option>`).join('');

  let opciones = new Map(); // texto visible → localidad
  let elegida = null;
  let consulta = 0;

  // Si hay dos con el mismo nombre se agrega el partido o departamento
  function etiquetas(localidades) {
    const cuenta = {};
    for (const l of localidades) cuenta[l.nombre] = (cuenta[l.nombre] || 0) + 1;
    return localidades.map((l) => [
      cuenta[l.nombre] > 1 ? `${l.nombre} (${l.departamento}, ${l.provincia})` : l.nombre,
      l,
    ]);
  }

  function pintarOpciones(localidades) {
    opciones = new Map(etiquetas(localidades));
    lista.innerHTML = [...opciones].map(([valor, l]) => (
      `<option value="${esc(valor)}" label="${esc(`${l.departamento}, ${l.provincia}`)}"></option>`
    )).join('');
  }

  function elegir(l) {
    elegida = l || null;
    oculto.value = l ? l.id : '';
    if (l && prov.value !== l.provincia_id) prov.value = l.provincia_id;
    texto.setCustomValidity(!l && texto.value.trim() ? ELEGI : '');
    form.dispatchEvent(new CustomEvent('localidad', { detail: elegida }));
  }

  async function buscar() {
    const q = texto.value.trim();
    if (opciones.has(texto.value)) return elegir(opciones.get(texto.value));
    elegir(null);
    if (q.length < 2) {
      lista.innerHTML = '';
      return;
    }
    const n = ++consulta;
    const { data, error } = await sb.rpc('buscar_localidades', { p_texto: q, p_provincia: prov.value || null });
    if (n !== consulta || error) return;
    pintarOpciones(data);
    if (opciones.has(texto.value)) elegir(opciones.get(texto.value));
    // Si escribió el nombre completo y hay una sola coincidencia, se elige sola
    else if (data.length === 1 && data[0].nombre.toLowerCase() === q.toLowerCase()) {
      texto.value = data[0].nombre;
      pintarOpciones(data);
      elegir(data[0]);
    }
  }

  let espera;
  texto.addEventListener('input', () => {
    clearTimeout(espera);
    if (opciones.has(texto.value)) return elegir(opciones.get(texto.value));
    espera = setTimeout(buscar, 200);
  });
  texto.addEventListener('change', buscar);

  prov.addEventListener('change', () => {
    if (elegida && elegida.provincia_id !== prov.value) {
      texto.value = '';
      lista.innerHTML = '';
      opciones = new Map();
      elegir(null);
    }
  });

  function poner(l) {
    if (!l) return;
    prov.value = l.provincia_id;
    pintarOpciones([l]);
    texto.value = [...opciones.keys()][0];
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
      lista.innerHTML = '';
      opciones = new Map();
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
