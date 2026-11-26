# 005 · Notas e ideas

**Estado:** hecha.

## Qué hace

Amplía las notas ancladas en el texto de la 001. El escritor apunta también **ideas sueltas** de la obra, que no van a ningún pasaje, y **enlaza** cualquier nota con una o varias **fichas**. Consulta todas las notas en un **panel junto al texto**, las filtra, salta a su pasaje y marca como **resueltas** las que ya atendió, sin dejar de escribir.

**Las notas**
- Hay una sola clase de nota. Lo que cambia es a qué está unida:
  - **en el texto:** anclada a un punto o a un pasaje, como en la 001;
  - **del capítulo:** su pasaje se borró y quedó suelta en su capítulo o fragmento, como en la 001;
  - **idea suelta:** de la obra, sin capítulo ni pasaje.
- Cualquiera de ellas puede enlazarse además con **una o varias fichas**: «aquí Antonio aún no conoce a Claudio» va al pasaje, a Antonio y a Claudio.
- El texto de una nota admite **párrafos, cursiva y negrita**, como la descripción de una ficha. Las notas de obras anteriores se conservan tal cual.
- Una nota se puede marcar como **resuelta** y reabrir después. La marca de una nota resuelta se atenúa en el texto.
- Borrar una nota muestra un aviso con **Deshacer**, como al mandar una ficha a la papelera.

**El panel de la derecha: Fichas y Notas**
- El panel de fichas de la 004 pasa a tener dos pestañas: **Fichas** y **Notas**. El índice puede seguir abierto a la izquierda.
- **Ctrl+Mayús+E** abre el panel en Fichas y **Ctrl+Mayús+N** en Notas. Pulsar el atajo de la pestaña que se ve cierra el panel. El botón de la barra hace lo mismo.
- El panel recuerda en cada ventana si estaba abierto y en qué pestaña.

**La lista de notas**
- Muestra cada nota con el principio de su texto, a qué está unida (capítulo, «idea suelta») y sus fichas.
- Por defecto, las más recientes primero. Al filtrar por un capítulo, en el orden en que aparecen en el texto.
- **Filtros**, que se combinan:
  - **por clase:** en el texto, ideas sueltas o con fichas;
  - **por capítulo:** el que está abierto o uno elegido;
  - **por ficha:** las enlazadas a un personaje, lugar, trama u otro;
  - **búsqueda** de palabras en el texto de las notas, sin distinguir mayúsculas ni tildes.
- Las resueltas no se muestran salvo que se pida con «Ver resueltas».
- **«Nueva idea»** crea una idea suelta y la abre para escribirla.
- Al abrir una nota se lee y se edita en el panel. Si está en el texto, **«Ir al pasaje»** abre su capítulo y selecciona el pasaje; el panel sigue abierto.

**Enlazar con fichas**
- Desde una nota, **«Enlazar con una ficha…»** busca la ficha por nombre o alias. Cada ficha enlazada se puede quitar y abrir desde la nota.
- La ficha de un elemento tiene una sección **Notas** con las suyas. Cada una abre su nota y, si está en el texto, salta a su pasaje. **«Nueva nota»** crea allí una idea suelta ya enlazada con esa ficha.
- Una ficha en la papelera no aparece en las notas. Al restaurarla, vuelven sus enlaces.

**De la obra, en todas las ventanas**
- Las notas, sus enlaces y su estado de resueltas se guardan en el archivo `.rocinante`, entran en las copias («Guardar como») y se ven en vivo en todas las ventanas abiertas de esa obra.
- Las notas siguen sin formar parte del texto de la obra: no cuentan en el contador ni saldrán en las exportaciones.

## Por qué

Escribir una novela deja un rastro de recordatorios: dudas sobre una fecha, ideas para un capítulo que aún no existe, cosas que un personaje sabe o no sabe en cada momento. Si viven en un cuaderno aparte, se pierden o llegan tarde. Tenerlas en la obra, unidas al pasaje y a las fichas a las que se refieren, y poder repasarlas sin salir de la escritura, hace que ninguna se olvide. También prepara la 006, donde la ficha de un elemento reúne sus menciones y sus notas.

## Criterios de aceptación

**Notas**
- [x] Se crea una idea suelta desde el panel y una nota desde el texto, como en la 001. Las dos se editan con párrafos, cursiva y negrita.
- [x] Una nota se marca como resuelta y se reabre. Las resueltas se ocultan de la lista y su marca se atenúa en el texto.
- [x] Borrar una nota se puede deshacer desde el aviso.
- [x] Las notas de una obra creada con versiones anteriores se abren sin perder nada.

**Panel**
- [x] El panel de la derecha tiene las pestañas Fichas y Notas. Ctrl+Mayús+E y Ctrl+Mayús+N lo abren en cada una y lo cierran; el índice puede seguir abierto.
- [x] El panel recuerda en cada ventana si estaba abierto y en qué pestaña.
- [x] La lista ordena las notas de la más reciente a la más antigua y, al filtrar por capítulo, en el orden del texto.
- [x] Los filtros por clase, capítulo y ficha y la búsqueda se combinan. La búsqueda no distingue mayúsculas ni tildes.
- [x] «Ir al pasaje» abre el capítulo de la nota y selecciona su pasaje, con el panel abierto.
- [x] Con 500 notas y el panel abierto, escribir en la obra sigue igual de fluido.

**Fichas**
- [x] Una nota se enlaza con varias fichas y se desenlaza de cada una. Desde la nota se abre cada ficha.
- [x] La ficha muestra sus notas, salta a su pasaje y crea una nota nueva ya enlazada.
- [x] Mientras una ficha está en la papelera, no aparece en las notas. Al restaurarla, vuelven sus enlaces.

**De la obra**
- [x] Las notas, sus enlaces y su estado se ven y se actualizan en vivo en todas las ventanas de la obra.
- [x] «Guardar como» copia las notas con sus enlaces.
- [x] Las notas no cuentan en el contador de palabras.

**Calidad**
- [x] Los métodos y notificaciones nuevos forman parte del contrato de mensajes, con sus pruebas de contrato.
- [x] Los cambios del archivo `.rocinante` son una migración numerada, documentada en `docs/format`.
- [x] Los logs no contienen el texto de las notas.
- [x] Tests de dominio en el núcleo, tests de comportamiento de la interfaz y una prueba de extremo a extremo: crear una idea suelta y una nota en el texto, enlazarlas con una ficha, encontrarlas con los filtros, saltar al pasaje, resolver una y volver a abrir la obra con todo en su sitio.

## Fuera de alcance

- **Notas en la pizarra** del Tablero, como tarjetas.
- **Etiquetas** propias en las notas.
- **Imágenes o archivos** adjuntos a una nota.
- **Recordatorios** con fecha.
- **Versiones** de las notas.
- **Exportar** las notas: la exportación (011) es del texto de la obra.
- **Notas propuestas por la IA:** **009** (escudero).
- **Menciones** de las fichas en el texto y su lista en la ficha: **006**.
