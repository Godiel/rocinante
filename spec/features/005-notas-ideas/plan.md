# 005 · Notas e ideas — Plan

Cómo se implementa lo descrito en [`spec.md`](spec.md). Respeta la [constitución](../../constitution/tech-stack.md) y se apoya en las notas de la [001](../001-proyecto-editor-base/plan.md) y en las fichas de la [004](../004-elementos-obra/plan.md).

## Enfoque

Hoy una nota pertenece a un documento, tiene texto sin formato y se pide documento a documento. La 005 la convierte en una **nota de la obra**:

- puede no tener documento (idea suelta);
- su texto tiene formato;
- puede estar resuelta;
- se enlaza con fichas.

El núcleo entrega **todas las notas de la obra de una vez**, como `board.get` en la 004, y avisa de cada cambio a todas las ventanas. En la interfaz, un único estado de las notas por ventana alimenta:

- las marcas del texto;
- la pestaña Notas del panel;
- la sección Notas de la ficha.

El texto de la obra no cambia de forma. Las anclas `noteAnchor` y `notePoint` de la 001 siguen igual.

## Arquitectura de la feature

```
 Escritura
   editor ── marcas de las notas (atenuadas si están resueltas)
          ── ventanita de la 001: el texto de la nota, ahora con formato
   panel de la derecha ── pestaña Fichas (004) ── ficha ── sección Notas
                       └─ pestaña Notas ── lista · filtros · búsqueda · nota abierta
        │  notes.get / note.create / note.update / note.delete / note.restore
 Núcleo .NET ── dominio: Note (documento opcional, contenido, resuelta, fichas, apartada)
        │        └─ SQLite (.rocinante, esquema v4): note, note_element
        │  notes.changed (todas las ventanas de la obra)
 Interfaz ── estado de las notas (uno por ventana), alimentado por la notificación
```

- **Una nota** (`Note`) tiene:
  - identificador;
  - documento, o nada si es una idea suelta;
  - contenido en JSON de TipTap y, derivado de él, su texto plano para buscar y para el principio que muestra la lista;
  - si está anclada y, si lo está, su orden en el texto del documento;
  - fecha de resuelta, nula mientras está abierta;
  - las fichas enlazadas;
  - fecha de borrado, nula mientras no se ha borrado.
- **Las ideas sueltas** son notas sin documento. Las notas «del capítulo» son las de la 001 cuyo pasaje desapareció: tienen documento y no están ancladas.

## Implementación

1. **Contrato (versión 8)** — `src/contracts`.
   - `Note` pasa a ser `{ id, documentId | null, content, text, anchored, order | null, resolvedAt | null, elements: Id[], createdAt, updatedAt }`. `text` es el texto plano que el núcleo deriva de `content`.
   - Métodos:
     - `notes.get` devuelve todas las notas de la obra. Deja fuera las borradas y las de documentos en la papelera. Sustituye a `note.list`.
     - `note.create { documentId | null, content, anchored, elements?, origin }`.
     - `note.update { id, changes { content?, resolved?, elements? }, origin }`.
     - `note.delete` y `note.restore { id, origin }`: borrar aparta la nota; restaurar la devuelve.
   - La notificación `notes.changed { origin, notes, removed }` lleva solo lo que cambió, de cualquier documento.
   - Motivos de error nuevos: `noteIsDeleted` y `noteIsNotDeleted`. Se reutilizan `noteNotFound`, `noteTextRequired`, `noteTextTooLong` y `elementNotFound`.
   - Ejemplos válidos e inválidos de cada método; el escenario de `ContractTests` los usa todos.
2. **Dominio** — `Rocinante.Domain/Notes`.
   - `Note`:
     - documento opcional;
     - contenido obligatorio, que no puede quedar vacío; su texto plano tiene, como hoy, 10 000 caracteres como máximo;
     - hasta 50 fichas enlazadas, sin repetir;
     - `Resolve` y `Reopen`;
     - `Delete` y `Restore`.
   - `Reconcile` recibe además el orden de las anclas del documento. `DocumentContent` pasa a dar las anclas en el orden del texto, no como conjunto.
   - Una nota de las versiones anteriores, que solo tiene texto, se lee como un contenido de un párrafo por línea.
   - Tests de dominio al 80 % o más.
3. **Persistencia (esquema v4)** — `Infrastructure/Persistence`.
   - Migración `0004-notes.sql`:
     - rehace la tabla `note` para que `document_id` admita nulo, y añade `content`, `anchor_order`, `resolved_at` y `deleted_at`. SQLite no cambia la nulidad de una columna, así que se copia a una tabla nueva, como recomienda su documentación;
     - las notas existentes conservan su texto, con `content` nulo hasta que se editen;
     - añade `note_element (note_id, element_id)`, con claves foráneas que se borran en cascada con la nota y con la ficha.
   - Al abrir una obra, se borran de verdad las notas que quedaron apartadas.
   - Se comprueba que «Guardar como» copia las notas y sus enlaces, y que una obra v3 se abre sin perder ninguna nota.
   - `docs/format` describe los cambios columna a columna.
4. **Casos de uso y sidecar** — `Rocinante.Application` y `Rocinante.Sidecar`.
   - `NoteUseCases` con los métodos del contrato. Cada cambio difunde `notes.changed` con su `origin`.
   - Al guardar un documento, la reconciliación de la 001 actualiza también el orden de las anclas.
   - Mandar un documento a la papelera saca sus notas de `notes.get` y las anuncia como retiradas; restaurarlo las devuelve.
   - Las notas enlazadas a una ficha en la papelera conservan el enlace. La interfaz no lo muestra hasta que la ficha vuelve.
   - Los registros nunca llevan el texto de las notas.
5. **Estado de las notas en la interfaz** — `features/notes`.
   - `useWorkNotes`: carga `notes.get` al abrir la obra y aplica `notes.changed`. Lo comparten el editor, el panel y la ficha de la ventana, como `useBoard`.
   - El editor deja de pedir `note.list`. Toma del estado las notas de su documento.
   - Funciones puras con sus tests:
     - el orden de la lista: más recientes primero o, con un capítulo, el orden del texto;
     - los filtros, que se combinan;
     - la búsqueda sin mayúsculas ni tildes, con la normalización de `elements/search.ts`.
6. **El texto de la nota** — `features/notes` y `features/editor`.
   - `NoteEditor`: TipTap con párrafos, cursiva y negrita, las mismas extensiones que la descripción de la ficha (`description-extensions.ts`). Se guarda solo tras una pausa breve, con `pending-saves`, como la ficha.
   - La ventanita de la 001 usa `NoteEditor` para las notas; las notas al pie no cambian. La ventanita ofrece «Abrir en el panel» para resolver la nota o enlazarla.
   - Una decoración del editor atenúa las marcas de las notas resueltas y esconde las de las notas borradas. Solo se recalcula cuando cambia el conjunto de notas resueltas o borradas, no al escribir.
7. **Panel de la derecha con pestañas** — `features/workspace` y `features/elements`.
   - Un panel con las pestañas Fichas y Notas recoge el panel de la 004.
   - Ctrl+Mayús+E abre Fichas y Ctrl+Mayús+N, Notas. El atajo de la pestaña que se ve cierra el panel. Ctrl+Alt+N sigue creando una nota en el texto.
   - El botón de la barra abre y cierra el panel.
   - La pestaña y el estado abierto o cerrado se recuerdan por ventana en `sessionStorage`, como hoy el panel de fichas.
8. **La lista de notas** — `features/notes/NotesPanel.tsx`.
   - Cada nota muestra el principio de su texto, a qué está unida y sus fichas.
   - Filtros por clase, capítulo y ficha, y la búsqueda; «Ver resueltas».
   - «Nueva idea» crea una nota sin documento y la abre.
   - Una nota abierta sustituye a la lista, como la ficha en la 004. Tiene su texto, «Resuelta», sus fichas, «Ir al pasaje» y «Borrar».
   - «Ir al pasaje» cambia al documento de la nota si hace falta. El editor busca el ancla por su `noteId`, la selecciona y la lleva a la vista.
9. **Enlazar con fichas** — `features/notes` y `features/elements`.
   - En la nota, «Enlazar con una ficha…» usa el buscador de fichas de la 004. Cada ficha enlazada se quita con × y se abre en la pestaña Fichas.
   - La ficha tiene una sección **Notas**, entre las relaciones y la descripción. Lista sus notas y «Nueva nota» crea una idea suelta ya enlazada.
10. **Borrar y deshacer** — `features/notes`.
    - Borrar llama a `note.delete` y muestra el aviso con Deshacer (`UndoNotice`), que llama a `note.restore`.
    - El ancla de una nota borrada se queda en el texto, escondida. Así, al deshacer, la marca vuelve a su sitio sin tocar el texto.
11. **Pruebas de extremo a extremo y rendimiento** — `tests/e2e`.
    - El recorrido de la spec:
      - crear una idea suelta y una nota en el texto;
      - enlazarlas con una ficha;
      - encontrarlas con los filtros;
      - saltar al pasaje;
      - resolver una;
      - volver a abrir la obra con todo en su sitio.
    - Otra ventana de la misma obra ve los cambios en vivo.
    - Escribir con 500 notas y el panel de notas abierto mantiene el p95 de la 001.
12. **Validación y cierre.**
    - Criterios de `spec.md`, marcando solo lo comprobado.
    - `tech-stack.md`: el esquema v4, los módulos nuevos y el glosario (idea suelta, nota resuelta).
    - Pull request a `main` con `gh`, con la CI en verde en los tres sistemas.
    - Hoja de ruta: la 005 pasa a «Hecho» al fusionar.

## Decisiones

- **Una sola clase de nota** — una idea suelta, una nota del capítulo y una nota en el texto son la misma cosa con distinto anclaje. Así una idea puede anclarse después, en la 006 o más adelante, sin convertir nada.
- **Todas las notas de una vez** — con unos cientos de notas por obra, una lista completa cuesta poco y deja filtrar, buscar y ordenar en la interfaz sin esperar al núcleo, como las fichas.
- **El texto plano lo deriva el núcleo** — sirve para buscar y para el principio que muestra la lista. Como lo calcula el núcleo, la interfaz no tiene que recorrer cada contenido al escribir en el buscador.
- **El orden de las anclas, guardado** — el núcleo ya recorre el texto al guardar para reconciliar las notas. Guardar en ese momento el orden de cada ancla permite ordenar por capítulo sin leer los capítulos.
- **Borrar es apartar** — la nota borrada se queda en el archivo hasta que se vuelve a abrir la obra, y su ancla se queda en el texto, escondida. Deshacer la devuelve sin tocar el texto ni el historial del editor.
- **Las notas antiguas se convierten al editarse** — la migración no toca su texto. El dominio las lee como párrafos, y se guardan con formato la primera vez que se editan.

## Riesgos

- **Rehacer la tabla `note`** — copiar una tabla en una migración puede perder datos si algo falla a medias. Va en una transacción, como todas las migraciones, y un test abre una obra v3 con notas ancladas, sueltas y largas y comprueba que no falta ninguna.
- **Tres editores TipTap en una ventana** — el de la obra, el de la ficha y el de la nota. Los atajos de la obra no deben actuar en la nota (se marca con `data-own-keys`, como la ficha), y hay tests de comportamiento para comprobarlo.
- **«Ir al pasaje» en otro capítulo** — el ancla solo se puede buscar cuando el editor del otro capítulo ya está montado. El salto queda pendiente hasta que lo esté, como la vuelta al cursor al cambiar de pestaña en la 004.
- **El panel crece** — hoy el de fichas ya tiene lista, ficha y papelera. Las pestañas comparten el marco, y cada una carga solo lo suyo para que escribir siga igual de fluido; la prueba de rendimiento lo mide con 500 notas.
