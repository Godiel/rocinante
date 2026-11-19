# 002 · Hoja de escritura

**Estado:** hecha

## Qué hace

Cada obra tiene su **formato**: el tamaño de hoja del libro que será, sus márgenes y su tipografía. El escritor lo elige al crear la obra o cuando quiera. Una **vista de página** muestra la obra maquetada como un libro para revisarla.

**El formato de la obra**
- **Tamaño de hoja:**
  - de lista: bolsillo (11 × 17 cm), A5 (14,8 × 21 cm), 5,5 × 8,5 in, 6 × 9 in, A4 y carta;
  - o **a medida**, en centímetros o en pulgadas.
- **Márgenes:** cada tamaño propone los suyos de imprenta (superior, inferior, interior y exterior), y el escritor puede escribir los que quiera.
- **Tipografía del texto:** EB Garamond, Literata, Crimson Pro, Source Serif 4, Libre Baskerville y Courier Prime (la del modo máquina de escribir). Todas tienen licencia abierta y van dentro de la app: funcionan sin internet.
- **Cuerpo e interlineado** del texto.
- **Párrafos:** sangría de primera línea o sin ella, y texto justificado o alineado a la izquierda.
- **Capitular:** letra capital decorada al empezar cada capítulo, que se puede activar o no.
- El formato es **de la obra**: se guarda en su archivo `.rocinante`, y dos obras pueden tener formatos distintos.

**Al crear una obra**
- Tras el título, un paso opcional propone el formato completo de una vez: hoja, márgenes, tipografía, cuerpo, interlineado, párrafos y capitular.
- Viene relleno con el **último formato que usó el escritor**, como sugerencia. La primera vez, con uno por defecto.
- Se puede ajustar y aceptar, o **omitir**: omitir crea la obra con esa sugerencia tal cual.

**Cambiar el formato después**
- Un panel de formato, abierto desde la barra de la obra, permite cambiar cualquier ajuste en cualquier momento.
- El texto muestra cada cambio al momento.

**Al escribir en papel continuo**
- El papel continuo usa la tipografía, el cuerpo, el interlineado, los párrafos y la capitular de la obra.
- La columna mantiene su ancho cómodo de lectura (unos 60–75 caracteres). El tamaño de hoja y los márgenes solo se ven en la vista de página.

**La vista de página**
- Se abre y se cierra con **F5**. Es una vista **para revisar**: no se escribe en ella.
- Muestra la obra entera en hojas del tamaño elegido, con sus márgenes, una debajo de otra.
- Cada capítulo empieza en **página nueva**, con su título más abajo, como en un libro impreso.
- **Números de página** en cada hoja.
- **Páginas enfrentadas:** se puede ver una página o dos lado a lado, como un libro abierto, con los márgenes interior y exterior en su sitio.
- Se abre en la página donde estaba el cursor. Al cerrarla se vuelve al mismo punto del papel continuo.
- Muestra el texto de la obra con los separadores de escena y las notas al pie, pero no las notas del autor, que no son parte de la obra.

## Por qué

Escribir un libro no es solo escribir texto: el escritor quiere ver cómo quedará impreso, con su tamaño, su letra y sus márgenes. Rocinante quiere sentirse como escribir en buen papel, y eso incluye una letra de libro elegida con cuidado. El formato de la obra es además la base de la exportación (011): lo que se elige aquí es lo que saldrá en el PDF y en el EPUB.

## Criterios de aceptación

**Formato de la obra**
- [x] Se puede elegir cualquiera de los seis tamaños de lista o uno a medida en centímetros o pulgadas. Un tamaño o un margen imposible (negativo, o márgenes que no dejan sitio al texto) se rechaza con un mensaje claro.
- [x] Cada tamaño de lista propone sus márgenes, y se pueden cambiar uno a uno.
- [x] Se puede elegir entre las seis tipografías, que se ven igual con y sin internet en Windows, macOS y Linux.
- [x] Se pueden cambiar el cuerpo, el interlineado, la sangría de primera línea, el justificado y la capitular.
- [x] El formato se guarda en el archivo de la obra: al reabrirla, o al abrirla en otro equipo, se ve igual.
- [x] Una obra creada con la feature 001 se abre con un formato por defecto, sin perder nada.

**Al crear una obra**
- [x] Tras el título se ofrece el paso de formato, relleno con el último formato usado (o con el de por defecto la primera vez).
- [x] Omitir el paso crea la obra con la sugerencia; aceptarlo, con lo elegido.
- [x] El formato elegido pasa a ser la sugerencia para la próxima obra.

**Panel de formato y papel continuo**
- [x] Desde la barra de la obra se abre el panel de formato, y cada cambio se ve en el texto al momento.
- [x] El papel continuo usa la tipografía, el cuerpo, el interlineado, los párrafos y la capitular de la obra, y conserva su ancho de columna.
- [x] Escribir sigue siendo fluido (sin retraso perceptible al teclear) con cualquier tipografía y formato, en un capítulo de 20 000 palabras.

**Vista de página**
- [x] F5 abre y cierra la vista de página; también se abre y se cierra desde la barra.
- [x] Las hojas tienen el tamaño y los márgenes de la obra, con proporciones correctas.
- [x] Cada capítulo empieza en página nueva; las páginas llevan su número.
- [x] Se puede pasar de una página a dos enfrentadas y volver; en las enfrentadas, los márgenes interior y exterior quedan a cada lado del lomo.
- [x] La vista se abre en la página del cursor; al cerrarla se vuelve al mismo punto del texto.
- [x] No se puede escribir en la vista de página. Las notas del autor no aparecen; los separadores de escena y las notas al pie sí.
- [x] En una obra de 150 000 palabras, la vista se abre en menos de 2 segundos y se desplaza con fluidez.

**Calidad**
- [x] El formato de la obra forma parte del contrato de mensajes y del esquema del archivo, con su migración, pruebas de contrato y documentación en `docs/format`.
- [x] Las tipografías nuevas tienen licencia SIL OFL, que se incluye con la app.
- [x] Tests de comportamiento de la interfaz y una prueba de extremo a extremo: elegir un formato al crear una obra, reabrirla y verlo en la vista de página.

## Fuera de alcance

- **Escribir en la vista de página** (edición paginada): en esta feature la vista es solo para revisar. Queda en el backlog.
- **Cabeceras** con el título de la obra o del capítulo. Queda en el backlog.
- **Exportar a PDF, EPUB o `.docx`** con este formato → **011 · Exportación**.
- **Modo concentración**, fondos y sonidos → **003 · Modo concentración y ambiente**.
- **Tipografía de la interfaz:** la app sigue usando EB Garamond en menús y paneles; el formato solo afecta al texto de la obra.
- **Estilos por párrafo** (otra letra para un capítulo o una cita): el formato es uno para toda la obra.
