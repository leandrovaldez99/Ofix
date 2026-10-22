"""
Pone una marca de versión a los estilos y a los archivos JS de todas las
páginas, para que el navegador no siga usando los de antes después de
publicar un cambio (GitHub Pages los deja guardados hasta 10 minutos).

Uso, desde la carpeta del proyecto y antes de hacer commit:
    python herramientas/versionar.py
"""
import datetime
import json
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parent.parent
VERSION = datetime.datetime.now().strftime("%Y%m%d%H%M")

archivos_js = sorted(p.relative_to(RAIZ).as_posix() for p in (RAIZ / "js").rglob("*.js"))
mapa = {f"./{js}": f"./{js}?v={VERSION}" for js in archivos_js}
importmap = '<script type="importmap">' + json.dumps({"imports": mapa}, ensure_ascii=False) + "</script>\n"

cambiadas = 0
for pagina in sorted(RAIZ.glob("*.html")):
    texto = pagina.read_text(encoding="utf-8")
    nuevo = re.sub(r'css/styles\.css(\?v=[^"]*)?"', f'css/styles.css?v={VERSION}"', texto)
    nuevo = re.sub(r'(<script type="module" src="js/[^"?]+\.js)(\?v=[^"]*)?"', rf'\1?v={VERSION}"', nuevo)
    nuevo = re.sub(r'<script type="importmap">.*?</script>\n?', "", nuevo, flags=re.S)
    i = nuevo.find('<script type="module"')
    if i >= 0:
        nuevo = nuevo[:i] + importmap + nuevo[i:]
    if nuevo != texto:
        pagina.write_text(nuevo, encoding="utf-8")
        cambiadas += 1

print(f"Versión {VERSION}: {cambiadas} páginas actualizadas, {len(archivos_js)} archivos JS.")
