# 010 · Hilos del destino — Plan

Cómo se implementa lo descrito en [`spec.md`](spec.md). Lo que el texto dice (apariciones y coincidencias) ya lo sabe el índice de menciones de la 007; la 010 lo cuenta **capítulo a capítulo** y añade lo que el texto no puede decir: los **hitos** y el capítulo de **inicio y fin** de cada relación.

## Arquitectura

```
 Interfaz ── pestaña Hilos (F8): capítulos × fichas elegidas, en SVG
          ── texto: «Marcar hito» en el párrafo del cursor
          ── ficha: «desde» y «hasta» en cada relación
          ── Escudero: propuestas de hito
        │  threads.get / threads.choose / milestone.* / relationship.*      ▲ milestones.changed, elements.changed
 Núcleo ── ThreadUseCases
        │     ├─ ReferenceIndex (007): menciones por documento y párrafo, en caché por revisión
        │     ├─ Milestone: ficha, capítulo, párrafo (texto y posición), frase
        │     └─ hitos, fechas de las relaciones y fichas elegidas → SQLite (esquema v7)
```

- **El hilo de una ficha** son sus menciones contadas por capítulo. Dos fichas **coinciden** en un capítulo cuando se las nombra en un mismo párrafo. Solo cuentan los capítulos: los fragmentos del cajón no tienen lugar en la historia.
- **Un hito pertenece a un párrafo.** Guarda su texto y su posición en el documento. Cada vez que se guarda el documento, el núcleo vuelve a buscar el párrafo:
  1. primero el mismo texto;
  2. si no lo encuentra, el párrafo más parecido (palabras en común), con preferencia por el más cercano a su posición.

  Así sigue al párrafo cambio a cambio. Si ningún párrafo se parece lo bastante, el hito queda **sin pasaje**, en su capítulo.
- **Una relación** gana dos campos opcionales, `starts` y `ends`, que son capítulos. Sin ellos vale para toda la obra. Si un capítulo se borra, ese límite deja de contar.
- **Las propuestas de hito** son un cuarto tipo de propuesta de la 009, `milestone`, con la ficha y la frase. Al aceptarlas, el hito se crea en el párrafo del que salen.

## Implementación

1. **Contrato (versión 13):**
   - `threads.get`: capítulos, hilos de las fichas elegidas, coincidencias y hitos;
   - `threads.choose`: las fichas que se muestran;
   - `milestone.create`, `milestone.update` y `milestone.delete`, y la notificación `milestones.changed`;
   - `starts` y `ends` en `relationship.create`, `relationship.update` y `Relationship`;
   - el tipo `milestone` en `Proposal`.
2. **Dominio:**
   - `Milestone`, con su párrafo y la búsqueda del párrafo que lo sigue;
   - los límites de una relación, con el inicio antes del fin;
   - `ProposedMilestone`.
3. **Persistencia (esquema v7):**
   - tablas `milestone` y `thread_choice`;
   - `starts_at` y `ends_at` en `relationship`;
   - la tabla `proposal` reconstruida para admitir `milestone`;
   - `docs/format`.
4. **Casos de uso:**
   - hitos;
   - volver a anclar los hitos al guardar un documento;
   - `threads.get` sobre el índice de menciones;
   - fichas elegidas, por defecto los cinco personajes más nombrados;
   - límites de las relaciones;
   - el escudero pide hitos y se aceptan.
5. **Sidecar:** métodos y notificaciones.
6. **Pestaña Hilos:** F8, los capítulos y las líneas, puntos según las menciones, coincidencias y elegir las fichas.
7. **Puntos e hitos:**
   - un punto abre sus pasajes, con «Ir al pasaje» y «Marcar hito»;
   - un hito abre su frase, para corregirlo o borrarlo;
   - «Marcar hito» desde el texto;
   - la vista se actualiza al escribir.
8. **Relaciones con fechas:** «desde» y «hasta» en la ficha, y en la vista Hilos el capítulo elegido con sus relaciones vigentes y las marcas de inicio y fin.
9. **Propuestas de hito** en la pestaña Escudero.
10. **Pruebas de extremo a extremo y de rendimiento.**
11. **Validación y cierre.**

## Riesgos

- **Rendimiento con obras largas.** `threads.get` reutiliza la caché del índice de menciones, que solo relee los documentos que cambiaron. La interfaz pide los hilos de las fichas elegidas, no los de todas, y lo hace con una pausa breve tras escribir.
- **Seguir un párrafo que se reescribe.** Volver a anclar en cada guardado (cada pocos segundos) hace que cada cambio sea pequeño. Si el escritor reescribe el párrafo entero de golpe, el hito queda «sin pasaje», nunca en un párrafo que no es el suyo.
- **Migrar `proposal`.** SQLite no deja cambiar un `CHECK`, así que la tabla se copia en una nueva dentro de la misma transacción de la migración, con una prueba que abre una obra v6 con propuestas.
