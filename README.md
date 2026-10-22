# Ofix

Appweb para conectar clientes con profesionales de oficios (plomeros, gasistas, electricistas, pintores, carpinteros y cerrajeros), con calificaciones de clientes reales.

Proyecto de Ocampo, Bárbara M.; Romero, Benjamín H. y Valdez, Leandro J.

La app está hecha con HTML, CSS y JavaScript sin frameworks, y usa [Supabase](https://supabase.com) como base de datos, para el inicio de sesión (correo y contraseña o Google), los archivos (DNI, certificados y fotos de los pedidos) y el chat en tiempo real.

## Cómo correrla

La app tiene que abrirse desde un servidor local, no con doble clic en el archivo: el navegador bloquea los módulos de JavaScript y el ingreso con Google en direcciones `file://`.

- Con VS Code: instalar la extensión **Live Server**, clic derecho en `index.html` → *Open with Live Server* (abre `http://127.0.0.1:5500`).
- O desde una terminal en la carpeta del proyecto: `python -m http.server 5500` y abrir `http://127.0.0.1:5500`.

## Configurar Supabase (una sola vez)

El proyecto de Supabase se llama **ofix** (región São Paulo). La conexión está en `js/supabase.js`; la clave que figura ahí es la pública (*publishable*) y puede estar en el código: lo que protege los datos son las reglas de seguridad de la base (RLS).

1. **Crear las tablas.** En el panel de Supabase, *SQL Editor* → *New query*, pegar y ejecutar, en orden, los archivos de `supabase/migrations/`:
   1. `20261021000000_esquema_inicial.sql`: tablas, seguridad y flujo de pedidos.
   2. `20261021120000_localidades_y_ubicaciones.sql`: carga las localidades de todo el país (las descarga de `supabase/datos/localidades.json` en este repo, así que el archivo tiene que estar subido a GitHub) y agrega las coordenadas de direcciones, profesionales y pedidos.
   3. `20261022000000_reactivar_pedido.sql` y `20261022010000_reactivar_con_modo.sql`: reactivar un pedido desactivado.
2. **Direcciones permitidas.** *Authentication* → *URL Configuration*:
   - *Site URL*: `http://127.0.0.1:5500`
   - *Redirect URLs*: agregar `http://127.0.0.1:5500/**` y `http://localhost:5500/**` (y la dirección donde se publique la app, si se sube a internet).
3. **Confirmación de correo (opcional).** Por defecto Supabase pide confirmar el correo antes de entrar y solo manda unos pocos mails por hora. Para probar más rápido: *Authentication* → *Sign In / Providers* → *Email* → desactivar *Confirm email*.
4. **Ingreso con Google.**
   1. En [Google Cloud Console](https://console.cloud.google.com/) crear un proyecto, configurar la *pantalla de consentimiento de OAuth* (tipo *Externo*) y después *Credenciales* → *Crear credenciales* → *ID de cliente de OAuth* → *Aplicación web*.
   2. En *URI de redireccionamiento autorizados* poner `https://tfbuydlfzrsktqypudht.supabase.co/auth/v1/callback`.
   3. Copiar el *ID de cliente* y el *Secreto*, y pegarlos en Supabase: *Authentication* → *Sign In / Providers* → *Google* → activar y guardar.
5. **Aprobar profesionales.** Un profesional nuevo queda *pendiente de validación* y no recibe pedidos. No hay panel de administración: se aprueba corriendo `supabase/validar-profesional.sql` en el SQL Editor (cambiando el correo). Ahí también se ven los documentos que subió.

Para probar el flujo completo hacen falta dos cuentas: una de cliente y una de profesional (aprobado y con "Estoy disponible hoy" activado), por ejemplo en dos navegadores distintos o una en ventana privada.

## Cómo funciona

- **Pedidos.** Al publicar con "Que lo tome el primero disponible", la base busca profesionales validados del oficio, disponibles hoy y dentro del radio. La distancia se mide desde la dirección del cliente hasta la localidad base de cada profesional. El de mejor puntaje (calificaciones, trabajos hechos y cercanía) lo ve primero y tiene 5 minutos de prioridad; después lo ven todos. El pedido vence a los 30 minutos. Con "Quiero elegir yo" el pedido se guarda y el cliente elige de la lista.
- **Desactivar y reactivar.** El cliente puede desactivar un pedido mientras busca profesional y reactivarlo después desde *Mis pedidos*: se abre la pantalla de publicar con sus datos, se elige de nuevo entre "primero disponible" y "elegir yo", y se reactiva el mismo pedido (mismo número), sin crear una copia. Si se cancela un trabajo que ya tenía un profesional confirmado, se publica de nuevo como pedido nuevo.
- **Localidades y direcciones.** Se puede elegir cualquier localidad del país: primero la provincia y después la localidad, escribiendo y eligiendo de la lista (salen del catálogo oficial Georef, guardado en `supabase/datos/localidades.json`). Al guardar una dirección, el navegador busca sus coordenadas exactas con la [API Georef](https://www.argentina.gob.ar/georef); si no encuentra la altura, se usa el centro de la localidad. "Usar mi ubicación actual" completa la localidad con el GPS del celular.
- **Privacidad.** El teléfono y la dirección exacta del cliente solo los ve el profesional confirmado, y lo controla la base de datos, no la página.
- **Chat.** Se abre cuando el cliente confirma al profesional. Los mensajes y los cambios de estado del pedido llegan en tiempo real.
- **Calificaciones.** El trabajo se cierra cuando los dos lo marcan como terminado; ahí el cliente puede calificar.

### Archivos

| Carpeta | Contenido |
| --- | --- |
| `js/supabase.js` | Conexión con Supabase |
| `js/comun.js` | Sesión, formato de fechas y distancias, mensajes de error y piezas que comparten las pantallas |
| `js/ubicacion.js` | Selector de provincia y localidad, ubicación exacta de direcciones y "Usar mi ubicación" |
| `js/ficha.js`, `js/datos-personales.js`, `js/documentos.js`, `js/iconos.js` | Partes compartidas entre algunas pantallas |
| `js/paginas/` | Un archivo por pantalla |
| `supabase/migrations/` | Tablas, reglas de seguridad y funciones del flujo de pedidos |
| `supabase/datos/localidades.json` | Localidades de Argentina con provincia y coordenadas (Georef) |
| `supabase/validar-profesional.sql` | Consulta para aprobar profesionales |

## Flujos

**Cliente**

`index` → `inicio` → `buscar` → `profesional` → `nuevo-pedido` → `pedido-esperando` → `pedido-asignado` → `chat-cliente` → `calificar`

- Desde `nuevo-pedido` se elige entre "Que lo tome el primero disponible" (va a `pedido-esperando`) o "Quiero elegir yo" (va a `buscar`).
- `pedido-esperando` pasa sola a `pedido-asignado` cuando un profesional acepta, o a `sin-profesionales` si nadie acepta en 30 minutos.

**Profesional**

`index` → `registro-profesional` → `registro-profesional-2` → `validacion-pendiente` → `trabajos` → `oferta` → `chat-profesional`

- `oferta-no-disponible` muestra el caso de un pedido que ya tomó otro profesional.
- `cuenta` y `disponibilidad` son la configuración del profesional.


## Pantallas

| Archivo | Pantalla | Caso de uso |
| --- | --- | --- |
| `index.html` | Ingresar con correo o con Google | |
| `completar-perfil.html` | Primer ingreso con Google: rol, nombre y teléfono | |
| `nueva-contrasena.html` | Elegir contraseña nueva (desde el mail de "Me olvidé la contraseña") | |
| `registro-cliente.html` | Crear cuenta como cliente | CU1 |
| `registro-profesional.html` | Registro de profesional, paso 1: datos | CU2 |
| `registro-profesional-2.html` | Registro de profesional, paso 2: oficios, zona, horarios, DNI y certificados | CU2 |
| `validacion-pendiente.html` | Perfil pendiente de validación | CU2 |
| `inicio.html` | Inicio del cliente | |
| `buscar.html` | Buscar profesionales con filtros | CU4 |
| `profesional.html` | Perfil público del profesional y reseñas | |
| `nuevo-pedido.html` | Publicar un problema | CU3 / CU4 |
| `pedido-esperando.html` | Buscando profesional | CU3 |
| `sin-profesionales.html` | Nadie tomó el pedido: reintentar, ampliar rango o elegir | CU3 (A3) |
| `pedido-asignado.html` | Un profesional aceptó: confirmarlo o pedir otro | |
| `chat-cliente.html` | Chat con el profesional y visita acordada | |
| `calificar.html` | Calificar el servicio con estrellas y comentario | CU7 |
| `pedidos.html` | Historial de pedidos del cliente | |
| `perfil.html` | Datos personales, direcciones y eliminar cuenta | |
| `trabajos.html` | Pedidos para vos y disponibilidad del día | |
| `oferta.html` | Aceptar o rechazar un pedido, con prioridad | CU5 / CU6 |
| `oferta-no-disponible.html` | Pedido ya tomado por otro profesional | CU6 (A2) |
| `chat-profesional.html` | Chat con el cliente y datos de contacto | |
| `chats.html` | Lista de conversaciones del profesional | |
| `cuenta.html` | Perfil, validación, certificados, reseñas y datos | |
| `disponibilidad.html` | Oficios, zona, radio y horarios | |
| `css/styles.css` | Estilos de todas las pantallas | |

No hay medios de pago: el trabajo y el cobro se arreglan entre cliente y profesional, fuera de la app.
