# Ofix

Appweb para conectar clientes con profesionales de oficios (plomeros, gasistas, electricistas, pintores, carpinteros y cerrajeros), con calificaciones de clientes reales.

Proyecto de Ocampo, Bárbara M.; Romero, Benjamín H. y Valdez, Leandro J.

Esta versión son **solo las pantallas, conectadas entre sí**. Es HTML y CSS, sin JavaScript ni base de datos: los datos que se ven son de ejemplo y los botones llevan a la pantalla que sigue en el flujo. Se abre `index.html` en el navegador.

## Flujos

**Cliente**

`index` → `inicio` → `buscar` → `profesional` → `nuevo-pedido` → `pedido-esperando` → `pedido-asignado` → `chat-cliente` → `calificar`

- Desde `nuevo-pedido` se elige entre "Que lo tome el primero disponible" (va a `pedido-esperando`) o "Quiero elegir yo" (va a `buscar`).
- En `pedido-esperando` hay una caja punteada **Boceto** con los dos caminos posibles: un profesional acepta (`pedido-asignado`) o nadie acepta en 30 minutos (`sin-profesionales`).

**Profesional**

`index` → `registro-profesional` → `registro-profesional-2` → `validacion-pendiente` → `trabajos` → `oferta` → `chat-profesional`

- `oferta-no-disponible` muestra el caso de un pedido que ya tomó otro profesional.
- `cuenta` y `disponibilidad` son la configuración del profesional.

En la pantalla de ingreso hay accesos directos para entrar como cliente o como profesional.

## Pantallas

| Archivo | Pantalla | Caso de uso |
| --- | --- | --- |
| `index.html` | Ingresar | |
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

## Cómo funcionan las partes interactivas sin JavaScript

- **Formularios**: al enviarlos van a la pantalla siguiente (atributo `action`). Los campos obligatorios usan la validación propia del navegador (`required`, `type="email"`, `minlength`).
- **Chips de filtros y oficios**: son `radio` o `checkbox` ocultos dentro de un `<label class="chip">`. El CSS los pinta cuando están marcados.
- **Estrellas de calificación**: son `radio` y se pintan con CSS.
- **Interruptor "disponible hoy"**: es un `checkbox` con estilo.
- **Diálogos de confirmación** (cancelar pedido, rechazar, eliminar cuenta): son bloques `<div class="modal" id="...">` que se abren con un enlace a `#id` y se cierran con un enlace a `#`.
- **Agregar dirección o certificado**: usan `<details>` para mostrar el formulario.
