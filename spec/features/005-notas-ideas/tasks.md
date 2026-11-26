# 005 · Notas e ideas — Tareas

Checklist derivada de [`plan.md`](plan.md). Cada bloque se cierra con sus tests en verde, y con una comprobación en la app real cuando toca la interfaz, antes de pasar al siguiente. Rama: `feature/005-notas-ideas`.

## 1. Contrato de mensajes (versión 8)
- [ ] `Note` pasa a `{ id, documentId | null, content, text, anchored, order | null, resolvedAt | null, elements, createdAt, updatedAt }`.
- [ ] Métodos:
  - `notes.get`, que sustituye a `note.list`;
  - `note.create { documentId | null, content, anchored, elements?, origin }`;
  - `note.update { id, changes { content?, resolved?, elements? }, origin }`;
  - `note.delete` y `note.restore`.
- [ ] Notificación `notes.changed { origin, notes, removed }`, solo con lo que cambió.
- [ ] Motivos de error `noteIsDeleted` y `noteIsNotDeleted`, con sus mensajes en español en `messages.ts`.
- [ ] Ejemplos válidos e inválidos de cada método.
- [ ] Regenerar los tipos de TypeScript y subir `protocolVersion` a 8.

## 2. Dominio
- [ ] `Note` en `Rocinante.Domain/Notes`:
  - documento opcional;
  - contenido obligatorio y no vacío; su texto plano, de 10 000 caracteres como máximo;
  - hasta 50 fichas enlazadas, sin repetir;
  - `Resolve` y `Reopen`, `Delete` y `Restore`.
- [ ] Una nota antigua, solo con texto, se lee como un párrafo por línea.
- [ ] `DocumentContent` da las anclas en el orden del texto; `Reconcile` guarda el orden de cada nota.
- [ ] Glosario de `tech-stack.md`: idea suelta y nota resuelta, antes de usarlos en el código.
- [ ] Tests de dominio, con la cobertura de la constitución.

## 3. Persistencia (esquema v4)
- [ ] Migración `0004-notes.sql`:
  - `note` rehecha, con `document_id` opcional, `content`, `anchor_order`, `resolved_at` y `deleted_at`;
  - `note_element`, en cascada con la nota y con la ficha.
- [ ] Repositorio de notas para la obra entera, con cada cambio en una transacción.
- [ ] Al abrir la obra se borran de verdad las notas apartadas.
- [ ] Una obra v3 con notas ancladas, sueltas y largas se abre sin perder ninguna.
- [ ] «Guardar como» copia las notas y sus enlaces.
- [ ] `docs/format`: los cambios, columna a columna.
- [ ] Tests de persistencia: ida y vuelta, migración desde v3, cierre forzado a mitad de un cambio.

## 4. Casos de uso y sidecar
- [ ] `NoteUseCases` con los métodos del contrato; cada cambio difunde `notes.changed` con su `origin`.
- [ ] Guardar un documento actualiza el orden de las anclas, además de la reconciliación de la 001.
- [ ] Las notas de un documento en la papelera salen de `notes.get` y vuelven al restaurarlo.
- [ ] Los enlaces con una ficha en la papelera se conservan.
- [ ] Ningún registro lleva el texto de las notas.
- [ ] El escenario `WritingSession` usa todos los métodos y la notificación nuevos.
- [ ] Tests:
  - límites y errores con su motivo;
  - resolver, reabrir, borrar y restaurar;
  - notas de documentos en la papelera;
  - otra ventana recibe cada cambio.

## 5. Estado de las notas en la interfaz
- [ ] `features/notes/useWorkNotes`: carga `notes.get` y aplica `notes.changed`. Lo comparten el editor, el panel y la ficha.
- [ ] El editor toma del estado las notas de su documento; desaparece `useNotes`.
- [ ] Funciones puras con sus tests:
  - el orden: más recientes primero o, con un capítulo, el orden del texto;
  - los filtros por clase, capítulo y ficha, combinados;
  - la búsqueda sin mayúsculas ni tildes.

## 6. El texto de la nota
- [ ] `NoteEditor`: párrafos, cursiva y negrita, con las extensiones de la descripción de la ficha; marcado con `data-own-keys`.
- [ ] Se guarda solo tras una pausa, con `pending-saves`: nada queda sin guardar al cerrar.
- [ ] La ventanita de la 001 usa `NoteEditor` para las notas y ofrece «Abrir en el panel». Las notas al pie no cambian.
- [ ] Una decoración atenúa las marcas de las notas resueltas y esconde las de las borradas; no se recalcula al escribir.
- [ ] Tests de comportamiento, incluidos los atajos de la obra, que no actúan dentro de la nota.
- [ ] Comprobación en la app real.

## 7. Panel de la derecha con pestañas
- [ ] Un panel con las pestañas Fichas y Notas recoge el panel de la 004.
- [ ] Ctrl+Mayús+E abre Fichas y Ctrl+Mayús+N, Notas; el atajo de la pestaña que se ve cierra el panel.
- [ ] El botón de la barra abre y cierra el panel.
- [ ] La pestaña y el estado abierto o cerrado se recuerdan por ventana.
- [ ] El índice puede seguir abierto a la izquierda.
- [ ] Tests de comportamiento y comprobación en la app real.

## 8. La lista de notas
- [ ] Cada nota con el principio de su texto, a qué está unida y sus fichas.
- [ ] Filtros por clase, capítulo y ficha, búsqueda y «Ver resueltas».
- [ ] «Nueva idea» crea una nota sin documento y la abre.
- [ ] La nota abierta sustituye a la lista, con su texto, «Resuelta», sus fichas, «Ir al pasaje» y «Borrar»; una flecha y Esc vuelven.
- [ ] «Ir al pasaje» cambia de documento si hace falta, selecciona el ancla y la lleva a la vista, con el panel abierto.
- [ ] Mensaje cuando no hay notas o ningún filtro encuentra nada.
- [ ] Tests de comportamiento y comprobación en la app real.

## 9. Enlazar con fichas
- [ ] «Enlazar con una ficha…» en la nota, con el buscador de fichas de la 004.
- [ ] Cada ficha enlazada se quita con × y se abre en la pestaña Fichas.
- [ ] La ficha tiene una sección Notas con las suyas y «Nueva nota», que crea una idea suelta ya enlazada.
- [ ] Las fichas en la papelera no aparecen en las notas.
- [ ] Tests de comportamiento y comprobación en la app real.

## 10. Borrar y deshacer
- [ ] «Borrar» llama a `note.delete` y muestra el aviso con Deshacer, que llama a `note.restore`.
- [ ] El ancla de la nota borrada se queda escondida en el texto; al deshacer, la marca vuelve a su sitio.
- [ ] Tests de comportamiento y comprobación en la app real.

## 11. Pruebas de extremo a extremo y rendimiento
- [ ] El recorrido de la spec:
  - crear una idea suelta y una nota en el texto;
  - enlazarlas con una ficha;
  - encontrarlas con los filtros;
  - saltar al pasaje;
  - resolver una;
  - volver a abrir la obra con todo en su sitio.
- [ ] Otra ventana de la misma obra ve los cambios en vivo.
- [ ] Escribir con 500 notas y el panel de notas abierto mantiene el p95 de la 001.
- [ ] Todo en verde en los tres sistemas en la CI.

## 12. Validación y cierre
- [ ] Repasar los criterios de `spec.md` y marcar solo lo comprobado.
- [ ] `tech-stack.md`: el esquema v4, los módulos nuevos y el glosario.
- [ ] Pull request a `main` con `gh`, con la CI en verde.
- [ ] Hoja de ruta: la 005 pasa a «Hecho» al fusionar.
