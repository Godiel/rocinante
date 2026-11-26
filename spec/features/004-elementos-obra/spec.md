# 004 · Elementos de la obra

**Estado:** hecha.

## Qué hace

El escritor lleva **fichas** de lo que puebla su obra: personajes, lugares, tramas y otros elementos. Las ve como **tarjetas en una pizarra**, la pestaña **Tablero**. Allí las coloca donde quiere y las une con **flechas** que dicen cómo se relacionan. Mientras escribe, consulta y edita cualquier ficha en un **panel junto al texto**. Todo se crea a mano; nada se deduce del texto en esta feature.

**Dos pestañas: Escritura y Tablero**
- La ventana de la obra tiene dos pestañas arriba: **Escritura** (lo que hay hasta ahora) y **Tablero** (la pizarra).
- **F2** alterna entre las dos. Al volver a Escritura, el texto sigue donde estaba, con el cursor en el mismo punto.
- En el modo concentración (003) las pestañas no se ven, como el resto de la interfaz.

**La ficha**
- **Nombre** (obligatorio) y **tipo**:
  - **personaje**, **lugar** o **trama**;
  - **otro**, con un nombre de tipo libre que pone el escritor: objeto, facción, época…
  - El tipo se puede cambiar después.
- **Alias:** otros nombres del elemento («el Caballero de la Triste Figura», «Alonso Quijano»).
- **Atributos:** pares nombre–valor.
  - Cada tipo trae unos pocos **sugeridos**, vacíos, que se pueden quitar:
    - personaje: edad, aspecto y carácter;
    - lugar: situación y aspecto;
    - trama: conflicto y desenlace;
    - otro: ninguno.
  - El escritor añade los suyos y los ordena.
- **Descripción:** texto con el mismo editor que la obra (párrafos, cursiva, negrita), para la historia de un personaje o el aspecto de un lugar.
- **Imagen:** una por ficha (un retrato, un mapa, una foto de referencia). Se guarda **dentro del archivo** de la obra, que así viaja completa. Se puede cambiar y quitar.
- **Relaciones** con otras fichas (ver abajo).
- Lo que se escribe en la ficha se guarda solo, como el texto de la obra.

**La pizarra (pestaña Tablero)**
- Cada ficha es una **tarjeta compacta**: su imagen pequeña si la tiene, el nombre y una marca discreta del tipo.
- Las tarjetas se colocan **libremente**: se arrastran a cualquier sitio y su posición se guarda en la obra. Una ficha nueva aparece en un hueco libre.
- La vista se **desplaza** arrastrando el fondo y se **acerca o aleja** con la rueda del ratón o el teclado. Un botón encaja todas las tarjetas en la vista.
- Se crea una ficha nueva desde la pizarra, eligiendo su tipo.
- Al abrir una tarjeta, su ficha se edita en un **panel a la derecha**, con la pizarra a la vista.
- **Flechas:**
  - Se crea una relación **arrastrando desde el borde de una tarjeta hasta otra** y eligiendo la etiqueta.
  - Cada relación es una flecha con su **etiqueta escrita**. La punta indica el sentido («Claudio → hijo de → Antonio»); las simétricas («hermano de») no tienen punta.
  - Al elegir una flecha, se puede cambiar su etiqueta o quitarla.
- **Ayudas:**
  - **Filtrar por tipo:** mostrar u ocultar personajes, lugares, tramas u otros, con sus flechas.
  - **Resaltar las relaciones de una tarjeta:** al elegirla, ella, sus flechas y las tarjetas a las que llegan quedan a la vista; el resto se atenúa.
  - **Buscar y centrar:** un buscador por nombre y alias que lleva a la tarjeta y la centra.
  - **Ordenar automáticamente:** un botón reparte las tarjetas según sus relaciones. Se puede deshacer.
- Las tarjetas y las flechas se recorren y se manejan también con el teclado.

**El panel de fichas junto al texto**
- En la pestaña Escritura, a la **derecha** del texto; el índice sigue a la izquierda y se pueden tener los dos abiertos.
- Se abre y se cierra con **Ctrl+Mayús+E** y con un botón de la barra de la obra.
- Arriba, un **buscador** que encuentra por nombre y por alias. Debajo, la **lista** agrupada por tipo (Personajes, Lugares, Tramas y Otros), con los grupos plegables y las fichas por orden alfabético.
- Al elegir una ficha, se abre en el mismo panel; una flecha vuelve a la lista. Es la misma ficha que en el Tablero.

**Relaciones**
- Unen dos fichas con una **etiqueta y su inversa**: si Claudio es «hijo de» Antonio, en la ficha de Antonio se lee que es «padre de» Claudio.
- Hay una lista de **parejas comunes** para elegir (hijo de / padre de, hermano de, pareja de, amigo de, enemigo de, vive en / lugar donde vive, participa en / incluye a…). Algunas son simétricas: «hermano de» se lee igual desde las dos fichas.
- El escritor puede escribir **parejas propias**, con su inversa o simétricas. Las que use quedan para elegirlas otra vez en la misma obra.
- En la ficha, las relaciones aparecen en una lista; desde cada una se salta a la otra ficha. Se crean desde la ficha o desde la pizarra.

**Crear desde el texto**
- Al seleccionar un nombre en el texto, el menú flotante ofrece **«Crear ficha»**. La ficha nace con ese nombre y se abre en el panel para elegir su tipo.
- El texto no cambia: el vínculo entre el texto y las fichas llega con la 006.

**Nombres repetidos**
- Dos fichas pueden tener el mismo nombre o alias (dos personajes llamados Juan). La ficha avisa de la coincidencia en las dos, sin impedirla.

**Borrar**
- Una ficha borrada va a la **papelera**, como los capítulos, con sus relaciones. Al restaurarla vuelve tal como estaba: relaciones y sitio en la pizarra incluidos.
- Mientras está en la papelera, ni su tarjeta ni sus flechas se ven, y sus relaciones no aparecen en las otras fichas.

**De la obra, en todas las ventanas**
- Las fichas, sus relaciones y la pizarra son parte de la obra: se guardan en el archivo `.rocinante`, entran en las copias («Guardar como») y se ven en vivo en todas las ventanas abiertas de esa obra.

## Por qué

Una novela se sostiene en lo que el escritor sabe de su mundo: quién es cada personaje, cómo es cada lugar, qué tramas siguen abiertas y quién está unido a quién. Hoy eso vive en cuadernos y en pizarras de corcho, lejos del texto. Tenerlo en una pizarra junto al manuscrito deja ver el mundo entero de un vistazo, evita contradicciones («¿de qué color tenía los ojos?») y es la base de lo que viene: las notas enlazadas (005), las menciones en el texto (006), los datos del tablero (007) y el escudero (009).

## Criterios de aceptación

**Pestañas**
- [x] La ventana de la obra tiene las pestañas Escritura y Tablero; F2 y un clic pasan de una a otra. Al volver a Escritura, el cursor sigue en el mismo sitio.

**Fichas**
- [x] Se crean fichas de personaje, lugar, trama y otro (con nombre de tipo libre). Una ficha sin nombre no se guarda y lo dice con claridad.
- [x] Cada tipo trae sus atributos sugeridos, que se pueden quitar. Se añaden, editan, ordenan y quitan atributos propios.
- [x] Se añaden y quitan alias.
- [x] La descripción admite párrafos, cursiva y negrita.
- [x] Se pone, cambia y quita una imagen. Va dentro del archivo de la obra y se sigue viendo aunque el original se borre. Un archivo que no es una imagen válida, o que es demasiado grande, se rechaza con un mensaje claro.
- [x] Cambiar el tipo de una ficha conserva todo lo escrito en ella.
- [x] Los cambios se guardan solos y sobreviven a cerrar y abrir la app, y a un cierre forzado.

**Pizarra**
- [x] Cada ficha se ve como una tarjeta con su imagen, su nombre y su tipo.
- [x] Las tarjetas se arrastran a cualquier sitio y su posición se recuerda al cerrar y abrir la obra. Una ficha nueva no tapa a otra.
- [x] La vista se desplaza, se acerca, se aleja y encaja todas las tarjetas.
- [x] Arrastrar de una tarjeta a otra crea una relación con la etiqueta elegida. La flecha muestra la etiqueta y el sentido; las simétricas no tienen punta. Una flecha se puede editar y quitar.
- [x] El filtro por tipo oculta y muestra tarjetas con sus flechas.
- [x] Al elegir una tarjeta, ella, sus flechas y sus tarjetas relacionadas quedan resaltadas y el resto atenuado.
- [x] El buscador encuentra por nombre y por alias, sin distinguir mayúsculas ni tildes, y centra la tarjeta.
- [x] «Ordenar automáticamente» reparte las tarjetas sin que se solapen y se puede deshacer.
- [x] Al abrir una tarjeta, su ficha se edita en el panel de la derecha con la pizarra a la vista.
- [x] La pizarra se usa con el teclado: recorrer tarjetas, abrirlas, moverlas y relacionarlas.
- [x] Con 300 tarjetas y 600 flechas, arrastrar una tarjeta, desplazar y acercar la vista se mueven con fluidez.

**Panel junto al texto**
- [x] Ctrl+Mayús+E y el botón de la barra abren y cierran el panel de fichas a la derecha del texto. El índice puede seguir abierto a la izquierda.
- [x] La lista agrupa las fichas por tipo, en orden alfabético, con grupos plegables. El buscador encuentra por nombre y por alias.
- [x] Con el panel abierto, escribir en la obra sigue igual de fluido.

**Relaciones**
- [x] Se relacionan dos fichas con una pareja común o propia, desde la ficha o desde la pizarra, y cada ficha muestra la etiqueta que le toca. Las simétricas se leen igual desde las dos.
- [x] Desde una relación de la ficha se abre la otra ficha.
- [x] Una pareja propia queda disponible para otras relaciones de la misma obra.

**Desde el texto, repetidos y papelera**
- [x] Con un nombre seleccionado, «Crear ficha» del menú flotante crea la ficha con ese nombre y la abre en el panel. El texto no cambia.
- [x] Dos fichas con el mismo nombre o alias se permiten, y las dos avisan de la coincidencia.
- [x] Una ficha borrada va a la papelera y se restaura con sus relaciones y su sitio en la pizarra. Mientras está en la papelera, no aparece en la pizarra, en la lista ni en las relaciones de otras fichas.

**De la obra**
- [x] Las fichas, las relaciones y la pizarra se ven y se actualizan en vivo en todas las ventanas de la obra.
- [x] «Guardar como» copia las fichas con sus imágenes y la pizarra.
- [x] Una obra creada con versiones anteriores se abre sin perder nada y queda lista para tener fichas.

**Calidad**
- [x] Los métodos y notificaciones nuevos forman parte del contrato de mensajes, con sus pruebas de contrato.
- [x] Los cambios del archivo `.rocinante` son una migración numerada, documentada en `docs/format`.
- [x] Los logs no contienen nombres, alias, atributos, descripciones ni imágenes de las fichas.
- [x] Tests de dominio en el núcleo, tests de comportamiento de la interfaz y una prueba de extremo a extremo: crear un personaje y un lugar en la pizarra, unirlos con una flecha, crear una ficha desde el texto, borrarla y restaurarla, y volver a abrir la obra con todo en su sitio.

## Fuera de alcance

- **Datos del texto en el tablero:** número de menciones, capítulos y pasajes de cada elemento, coincidencias en un mismo párrafo y sugerencias de nombres sin ficha. Llegan con la **007**, que se apoya en las menciones de la **006**.
- **Separar el Tablero en su propia ventana** y volver a acoplarlo: **007**.
- **Menciones en el texto:** **006**.
- **Notas enlazadas** a una ficha: **005**.
- **Fichas deducidas por la IA:** **009** (escudero).
- **Elementos de dibujo libres** en la pizarra (notas adhesivas, zonas, textos sueltos, flechas sin relación).
- **Tipos propios** con sus propios atributos sugeridos e icono: «otro» con nombre libre cubre esta feature.
- **Varias imágenes** por ficha.
- **Versiones** de las fichas, como las de los capítulos.
- **Exportar** las fichas o la pizarra: la exportación (011) es del texto de la obra.
