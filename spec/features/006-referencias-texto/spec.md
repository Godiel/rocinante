# 006 · Referencias en el texto

**Estado:** en especificación

## Qué hace

Une el texto y las fichas en los dos sentidos. Mientras se escribe, Rocinante **reconoce** en el texto los nombres y alias de las fichas y los marca con discreción; al pasar el ratón por una mención aparece la **ficha en pequeño**. En la ficha, una sección **En el texto** reúne todas sus **menciones**: cuántas hay, en qué capítulos, cuál es la primera y cada pasaje, con salto directo a él. Todo funciona sin IA: lo que cuenta es lo que el escritor llamó así en sus fichas.

**Qué se reconoce**
- El **nombre** y los **alias** de cada ficha que está en la obra (no las de la papelera).
- Como **palabras enteras**: «Ana» no se reconoce dentro de «Mañana».
- Sin distinguir **mayúsculas ni tildes**: «QUIJANO», «quijano» y «Quijáno» son la misma mención.
- Si dos nombres se solapan, gana el **más largo**: en «Don Quijote de la Mancha» cuenta la ficha «Don Quijote de la Mancha», no «La Mancha».
- Un nombre o alias de una sola letra no se busca.
- Se busca en capítulos y fragmentos, títulos incluidos. No en las notas al pie ni en las notas del autor.
- Si dos fichas comparten un nombre (dos personajes llamados Juan), la mención es de las dos.

**En el editor**
- Cada mención lleva una **marca discreta**: un subrayado fino en rojo de rúbrica, que no cambia el texto ni se exporta.
- Al pasar el ratón por una mención aparece la **ficha en pequeño**: imagen, nombre, tipo, sus primeros atributos y «Abrir la ficha», que la abre en el panel de la derecha. Si la mención es de varias fichas, se ven todas.
- Las marcas se pueden **ocultar**: «Marcar menciones» en la pestaña Fichas del panel. Se recuerda para todas las obras. En el modo concentración no se ven nunca.
- Las marcas siguen al texto mientras se escribe: un nombre recién tecleado se marca, y uno borrado deja de estarlo.

**En la ficha: «En el texto»**
- **Cuántas menciones** tiene en la obra y en **cuántos capítulos**.
- Su **primera aparición**: el capítulo y el pasaje.
- Las menciones **por capítulo**, en el orden del índice. Cada una con un trozo del texto alrededor y el nombre resaltado. Pulsarla abre ese capítulo y selecciona la mención, con el panel abierto.
- Se pone al día al guardar el texto o cambiar nombres y alias, también lo que se escribe en otra ventana.

## Por qué

Las fichas valen más cuando están unidas al texto. Ver de un vistazo dónde aparece un personaje, cuándo apareció por primera vez y cuánto pesa en cada capítulo ayuda a revisar la historia y a evitar contradicciones. Y poder consultar una ficha sin dejar de escribir, solo pasando el ratón por un nombre, mantiene el mundo de la obra a mano. Es la base de los datos del Tablero (007) y de los hilos del destino (010).

## Decisiones tomadas sin consultar

El autor pidió avanzar sin detenerse; estas decisiones de alcance se tomaron con criterio conservador y se pueden revisar:

- El reconocimiento es **automático**, por nombre y alias, sin marcar nada a mano. Es lo que fija la misión: «cuenta en tiempo real las menciones de cada nombre registrado y de sus alias».
- Las marcas **se ven por defecto** y se ocultan con una casilla, no con un atajo nuevo: las teclas F están reservadas para funciones grandes.
- No se reconocen **formas derivadas** (plurales, femeninos, «Quijotes»): solo el nombre y los alias tal como están en la ficha. Quien quiera otra forma la añade como alias.

## Criterios de aceptación

**Reconocimiento**
- [ ] Se reconocen el nombre y los alias de las fichas en la obra, como palabras enteras, sin distinguir mayúsculas ni tildes; gana el más largo y no se buscan los de una letra.
- [ ] Las fichas de la papelera no se reconocen; al restaurarlas, sí.
- [ ] Interfaz y núcleo reconocen exactamente lo mismo: comparten un juego de casos de prueba.

**Editor**
- [ ] Las menciones se marcan con un subrayado fino que no cambia el texto, el contador ni el archivo.
- [ ] Al pasar el ratón por una mención aparece la ficha en pequeño, y «Abrir la ficha» la abre en el panel. Una mención de varias fichas las muestra todas.
- [ ] Un nombre tecleado se marca y uno borrado deja de estarlo, sin esperar a guardar.
- [ ] «Marcar menciones» oculta y muestra las marcas, se recuerda y no hay marcas en el modo concentración.
- [ ] Con 300 fichas y un capítulo de 20 000 palabras, escribir mantiene el p95 de la 001.

**Ficha**
- [ ] «En el texto» muestra el total de menciones, el número de capítulos, la primera aparición y las menciones por capítulo con su trozo de texto.
- [ ] Pulsar una mención abre su capítulo y la selecciona, con el panel abierto.
- [ ] La sección se pone al día al guardar el texto o cambiar nombres y alias, también desde otra ventana.

**Calidad**
- [ ] Los métodos nuevos forman parte del contrato de mensajes, con sus pruebas de contrato.
- [ ] Los logs no contienen nombres, alias ni trozos del texto.
- [ ] Tests de dominio en el núcleo, tests de comportamiento de la interfaz y una prueba de extremo a extremo: escribir un nombre y verlo marcado, ver la ficha al pasar el ratón, ver las menciones en la ficha y saltar a una.

## Fuera de alcance

- **Contar menciones en las tarjetas** del Tablero, coincidencias en un mismo párrafo y **sugerencias** de nombres sin ficha: **007**.
- **Formas derivadas** de los nombres (plurales, femeninos, diminutivos).
- **Marcar a mano** una mención o desmarcar una concreta.
- **Pronombres** y menciones indirectas («el hidalgo»), salvo que sean un alias: **009** (escudero).
- **Menciones en las notas** del autor y en las notas al pie.
