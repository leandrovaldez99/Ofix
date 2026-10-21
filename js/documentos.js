// Etiqueta de estado de un documento (DNI o certificado)
export function estadoDocumento(estado) {
  if (estado === 'verificado') return '<span class="xsmall" style="font-weight:600;color:var(--green)">VERIFICADA</span>';
  if (estado === 'rechazado') return '<span class="xsmall" style="font-weight:600;color:#A3260F">RECHAZADA</span>';
  return '<span class="xsmall muted" style="font-weight:600">EN REVISIÓN</span>';
}
