import { sb, $, esc, requerir } from '../comun.js';
import { estadoDocumento } from '../documentos.js';

const { user } = await requerir('profesional');
const { data: docs } = await sb.from('documentos').select('*').eq('profesional_id', user.id).order('created_at');

$('#docs').innerHTML = `
  <div class="row small"><span class="grow">Datos personales</span><span class="xsmall" style="font-weight:600;color:var(--green)">LISTO</span></div>
  ${(docs || []).map((d) => `<div class="row small"><span class="grow">${esc(d.nombre)}</span>${estadoDocumento(d.estado)}</div>`).join('')}`;
