// Íconos del boceto, para las partes que se arman con JavaScript
const svg = (tam, cuerpo, estilo = '') => `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${estilo ? ` style="${estilo}"` : ''}>${cuerpo}</svg>`;

export const icono = {
  ubicacion: (t = 16) => svg(t, '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  reloj: (t = 16) => svg(t, '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  valija: (t = 16) => svg(t, '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5h6v2.5"/><path d="M3.5 12.5h17"/>'),
  check: (t = 16) => svg(t, '<path d="M5 12.5l4.5 4.5L19 7"/>', 'color:var(--green)'),
  persona: (t = 16) => svg(t, '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.5-3.6 4-5 7-5s5.5 1.4 7 5"/>'),
  telefono: (t = 16) => svg(t, '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
  calendario: (t = 16) => svg(t, '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  foto: (t = 16) => svg(t, '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><circle cx="12" cy="12" r="3"/>'),
  info: (t = 17) => svg(t, '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'),
};
