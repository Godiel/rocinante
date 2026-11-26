# 010 · Hilos del destino

**Estado:** propuesta.

## Qué hace

Los **hilos del destino** muestran el recorrido de cada personaje a lo largo de la historia: dónde aparece, qué le ocurre y cómo cambian sus relaciones. Funcionan siempre sin IA; con el escudero encendido, este además propone lo que le ocurre.

**La vista Hilos**
- Una pestaña propia, **Hilos**, junto al texto y al Tablero, que se abre con **F8**.
- Los **capítulos** van en horizontal, en el orden de la obra. Cada personaje elegido es **una línea** que los recorre.
- En cada capítulo donde aparece, su línea tiene un **punto**, más grande cuantas más veces se le nombra. Donde no aparece, la línea sigue tenue: el personaje no está, pero su historia continúa.
- Cuando dos personajes elegidos **coinciden en un mismo párrafo**, sus puntos de ese capítulo se unen.
- Sobre la línea se ven los **hitos**: lo que le ocurre al personaje, con una frase corta.
- Arriba se eligen los personajes que se muestran. Al principio son los cinco más nombrados. Se pueden añadir los demás tipos de ficha, como lugares u objetos, que también tienen recorrido.
- Al tocar un punto se abre su lista de pasajes, igual que en la ficha. Al tocar un hito se ve su frase y su pasaje. Desde los dos se puede **ir al pasaje**.
- Mientras se escribe, la vista **se actualiza** con lo que el texto dice.

**Hitos**
- Un **hito** es algo que le ocurre a una ficha en un pasaje: «muere su padre», «llega a Madrid», «descubre la carta».
- Para marcarlo, el escritor elige un pasaje en el texto y la ficha, y escribe la frase. También puede hacerlo desde un punto de la vista Hilos.
- Un hito se puede **corregir** o **borrar**. Pertenece a su pasaje: si el párrafo cambia, el hito lo sigue; si el párrafo desaparece, el hito queda en su capítulo marcado como «sin pasaje», para que el escritor decida qué hacer con él.
- Con el escudero encendido, en cada párrafo que lee puede **proponer hitos**. Se aceptan, se corrigen o se descartan como las demás propuestas, y nada entra en la obra sin aceptarlo.

**Relaciones que cambian**
- Una relación puede tener un capítulo de **inicio** y uno de **fin**: «amigos» del capítulo 1 al 7 y «enemigos» desde el 8. Si no se indica, vale para toda la obra, como hasta ahora.
- Se indican en la ficha, al crear o editar la relación.
- En la vista Hilos, al elegir un capítulo, se ve qué relaciones están **vigentes**. Donde una relación empieza o termina, el hilo lo señala.
- En el Tablero, las flechas siguen mostrando todas las relaciones de la obra.

## Por qué

Una novela larga se escribe durante meses, y es fácil perder la pista de un personaje: cuándo se le vio por última vez, qué sabe ya, con quién está enfrentado en este capítulo. Los hilos lo muestran de un vistazo a partir del propio texto, y lo que el texto no puede decir lo pone el escritor (los hitos y cuándo cambia cada relación) o lo propone el escudero.

## Decisiones

- **Una vista propia**, como pidió el autor, con los capítulos en horizontal y una línea por personaje.
- **Hitos a mano y propuestos por el escudero**, como pidió el autor. Las propuestas siguen las reglas de la 009.
- **Relaciones con capítulo de inicio y de fin**, como pidió el autor. Sin indicarlo, valen para toda la obra.
- **Tomadas sin consultar:**
  - la vista se abre con F8;
  - al principio se muestran los cinco personajes más nombrados;
  - un hito pertenece a un párrafo y lo sigue cuando cambia;
  - la vista no se separa en su propia ventana: eso queda para más adelante.

## Criterios de aceptación

**Vista Hilos**
- [ ] F8 abre la pestaña Hilos: capítulos en orden y una línea por cada ficha elegida, con puntos donde aparece, de tamaño según las menciones.
- [ ] Los puntos de dos fichas que coinciden en un párrafo del mismo capítulo se ven unidos.
- [ ] Se eligen las fichas que se muestran. Al principio son los cinco personajes más nombrados, y la elección se recuerda en la obra.
- [ ] Un punto abre sus pasajes y un hito su frase. Desde los dos se va al pasaje.
- [ ] Al escribir, la vista se actualiza sin recargarla.

**Hitos**
- [ ] Se marca un hito sobre un pasaje del texto o desde la vista Hilos; se corrige y se borra.
- [ ] El hito sigue a su párrafo cuando este cambia. Si el párrafo desaparece, el hito queda marcado «sin pasaje» en su capítulo.
- [ ] Con el escudero encendido, se proponen hitos que se aceptan, se corrigen o se descartan. Lo descartado no vuelve para ese pasaje.

**Relaciones**
- [ ] Una relación admite un capítulo de inicio y uno de fin, opcionales. Las que ya existen valen para toda la obra.
- [ ] En la vista Hilos, al elegir un capítulo, se ven las relaciones vigentes. Donde una empieza o termina, el hilo lo señala.

**Calidad**
- [ ] Los métodos nuevos forman parte del contrato, y los hitos y las fechas de las relaciones se guardan en el `.rocinante` con una migración documentada.
- [ ] Los registros no contienen el texto de los hitos ni los nombres de las fichas.
- [ ] Con una obra de 150 000 palabras y 300 fichas, la vista Hilos se abre en menos de un segundo y escribir con ella abierta sigue el ritmo del tecleo.
- [ ] Tests del núcleo y de comportamiento, y una prueba de extremo a extremo: abrir Hilos, marcar un hito, poner fechas a una relación y aceptar un hito propuesto por un escudero falso.

## Fuera de alcance

- **Separar la vista Hilos** en su propia ventana.
- Una **línea de tiempo interna** de la historia (fechas del mundo de la novela, saltos atrás): los hilos siguen el orden de los capítulos.
- **Exportar** la vista como imagen: entra en la **011**, si hace falta.
