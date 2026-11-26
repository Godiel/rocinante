# 007 · Tablero de tarjetas

**Estado:** en especificación

## Qué hace

Completa la pizarra de la 004 con lo que sale del texto, sin IA. Cada **tarjeta** dice cuántas veces aparece su elemento y en cuántos capítulos. Cada **ficha** dice con qué otras **coincide en un mismo párrafo**. Rocinante **sugiere** como posibles fichas los nombres propios que se repiten en el texto y aún no tienen ficha. Y el **Tablero** se puede **separar** en su propia ventana, llevarla a otra pantalla y volver a acoplarla.

**En las tarjetas**
- Debajo del tipo, una línea discreta: «12 menciones · 3 capítulos», o «Sin menciones».
- Se pone al día al guardar el texto o cambiar nombres y alias, también lo que se escribe en otra ventana.

**Coincidencias**
- La ficha tiene una sección **Coincide con**: las otras fichas que aparecen en los mismos párrafos, de más a menos párrafos compartidos, con el número. Pulsar una abre su ficha.
- En la pizarra, al elegir una tarjeta, las que coinciden con ella en algún párrafo quedan a la vista junto con sus relaciones; el resto se atenúa, como en la 004.

**Sugerencias de fichas**
- La pestaña Fichas tiene una sección plegable **Sugerencias**, como la papelera, con los nombres propios que se repiten y no son el nombre ni el alias de ninguna ficha: «Dulcinea (7 veces)».
- Un **nombre propio** es una palabra con mayúscula inicial que no empieza una frase, o varias seguidas unidas por «de», «del», «la», «las», «los» o «y» («Sancho Panza», «Don Quijote de la Mancha»). Cuenta si aparece **al menos 3 veces** dentro de una frase.
- **«Crear ficha»** la crea como personaje con ese nombre y la abre para elegir su tipo. **«Descartar»** la quita de las sugerencias para siempre en esta obra.
- Se muestran como mucho 20, las más repetidas primero.

**Separar el Tablero**
- En el Tablero, **«Separar»** lo abre en su propia ventana, que se mueve a otra pantalla como cualquier ventana. La ventana de la obra vuelve a la Escritura.
- Mientras está separado, la pestaña Tablero de la ventana de la obra dice «El Tablero está en otra ventana» y ofrece **«Traerlo aquí»**.
- **«Acoplar»** en la ventana del Tablero, o cerrarla, lo devuelve a la ventana de la obra, que muestra el Tablero.
- La ventana del Tablero tiene la pizarra y la ficha a su derecha, sin la Escritura.

## Por qué

La pizarra de la 004 muestra lo que el escritor sabe de su mundo; con la 007 muestra también lo que dice su texto: quién pesa más en la historia, quién aparece con quién y qué personajes andan por el texto sin ficha todavía. Separar el Tablero en otra pantalla deja ver la pizarra y escribir a la vez, como un corcho junto al escritorio.

## Decisiones tomadas sin consultar

El autor pidió avanzar sin detenerse; estas decisiones de alcance se tomaron con criterio conservador y se pueden revisar:

- Las coincidencias cuentan **párrafos**, no frases ni escenas: es lo que dice la misión («qué elementos coinciden en un mismo párrafo»).
- Las sugerencias se hacen con una **regla sencilla y predecible** (mayúscula dentro de la frase, al menos 3 veces), no con un diccionario ni con IA. Las palabras que empiezan frase no cuentan, para no sugerir «Entonces» o «Luego». Lo que la regla no acierte se descarta y no vuelve.
- La ficha creada desde una sugerencia nace como **personaje**; el tipo se cambia en la ficha, como al crearla desde el texto en la 004.
- Separar el Tablero es **una ventana por obra**: no se abren dos Tableros separados a la vez.

## Criterios de aceptación

**Tarjetas y coincidencias**
- [ ] Cada tarjeta muestra sus menciones y capítulos, o «Sin menciones», y se pone al día con el texto y las fichas.
- [ ] La ficha muestra «Coincide con» ordenado por párrafos compartidos, y abre la otra ficha.
- [ ] Al elegir una tarjeta, las que coinciden con ella siguen a la vista.

**Sugerencias**
- [ ] Se sugieren los nombres propios repetidos al menos 3 veces dentro de una frase que no son nombre ni alias de una ficha; no las palabras que solo empiezan frase.
- [ ] Los nombres de varias palabras unidos por «de», «del», «la», «las», «los» o «y» se sugieren enteros.
- [ ] «Crear ficha» crea la ficha y la sugerencia desaparece; «Descartar» la quita para siempre en esta obra, también tras cerrar y abrir.

**Separar el Tablero**
- [ ] «Separar» abre el Tablero en su propia ventana y la de la obra vuelve a la Escritura, con su pestaña Tablero diciendo dónde está.
- [ ] «Acoplar», cerrar la ventana o «Traerlo aquí» lo devuelven a la ventana de la obra.
- [ ] Lo que se cambia en la ventana del Tablero se ve al momento en la de la obra, y al revés.

**Calidad**
- [ ] Los métodos nuevos forman parte del contrato de mensajes, con sus pruebas de contrato.
- [ ] Los cambios del archivo `.rocinante` son una migración numerada, documentada en `docs/format`.
- [ ] Los logs no contienen nombres ni trozos del texto.
- [ ] Con 300 fichas y una obra de 150 000 palabras, las menciones de todas las tarjetas llegan en menos de 1 segundo.
- [ ] Tests de dominio, de comportamiento de la interfaz y una prueba de extremo a extremo: ver los números en las tarjetas, una coincidencia, crear una ficha desde una sugerencia y descartar otra, y separar y acoplar el Tablero.

## Fuera de alcance

- **Hilos del destino** (el recorrido de un personaje por la historia): **010**.
- **Sugerencias con IA**, relaciones deducidas y atributos: **009** (escudero).
- **Gráficos** de apariciones por capítulo.
- Separar otras pestañas (la Escritura ya se abre en otra ventana con «Otra ventana»).
