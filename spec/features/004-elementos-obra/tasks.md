# 004 · Elementos de la obra — Tareas

Checklist derivada de [`plan.md`](plan.md). Cada bloque se cierra con sus tests en verde, y con una comprobación en la app real cuando toca la interfaz, antes de pasar al siguiente. Rama: `feature/004-elementos-obra`.

## 1. Contrato de mensajes (versión 7)
- [x] Definiciones nuevas en `protocol.json`:
  - `ElementKind`: `character | place | plot | other`;
  - `ElementSummary { id, kind, otherKind, name, aliases, position, image }`;
  - `Element`: el resumen más `attributes` y `description`;
  - `Relationship { id, from, to, kind }` y `RelationshipKind { id, forward, inverse }`;
  - `Board { elements, relationships, ownKinds, trash }`.
- [x] Métodos:
  - `board.get` y `board.move`;
  - `element.create`, `element.get`, `element.update`, `element.delete` y `element.restore`;
  - `element.readImage`, `element.setImage`, `element.removeImage` y `element.image`;
  - `relationship.create`, `relationship.update` y `relationship.delete`.
- [x] Notificación `elements.changed`, solo con lo que cambió.
- [x] Motivos de error `nameRequired`, `otherKindRequired`, `elementNotFound`, `elementIsDeleted`, `elementIsNotDeleted`, `relationshipNotFound`, `relationshipKindNotFound`, `relationshipRepeated` y `sameElement`, con sus mensajes en español en `messages.ts`.
- [x] Ejemplos válidos e inválidos de cada método.
- [x] Regenerar los tipos de TypeScript y subir `protocolVersion` a 7.

## 2. Dominio
- [x] `ElementKind` y `Element` en `Rocinante.Domain/Elements`:
  - nombre obligatorio, sin espacios a los lados, hasta 200 caracteres;
  - tipo de «otro» hasta 60 caracteres, solo con `other`;
  - hasta 50 alias, sin vacíos, y hasta 100 atributos;
  - cambiar el tipo conserva todo.
- [x] `RelationshipKind`: comunes (`builtin:<nombre>`) y propias (`own:<uuid>`), con texto de ida y vuelta, o simétricas.
- [x] `Relationship`: extremos distintos y existentes; sin duplicados exactos.
- [x] `ElementBoard`:
  - crea, cambia y mueve elementos;
  - manda a la papelera y restaura, con sus relaciones;
  - oculta las relaciones con un extremo en la papelera.
- [x] Glosario de `tech-stack.md`: `ElementKind`, `RelationshipKind` y `Other`, antes de usarlos en el código.
- [x] Tests de dominio, con la cobertura de la constitución.

## 3. Persistencia (esquema v3)
- [x] Migración `0003-elements.sql` con estas tablas:
  - `element`;
  - `element_alias` y `element_attribute`;
  - `element_image`;
  - `relationship`;
  - `relationship_kind`.
- [x] Repositorio de elementos, con cada cambio en una transacción.
- [x] Una obra v2 se abre, se migra y queda lista para tener fichas.
- [x] «Guardar como» copia las fichas, las relaciones y las imágenes.
- [x] `docs/format`: las tablas nuevas, columna a columna.
- [x] Tests de persistencia: ida y vuelta, migración desde v2, cierre forzado a mitad de un cambio.

## 4. Casos de uso y sidecar
- [x] `ElementUseCases` con los métodos del contrato; cada cambio difunde `elements.changed` con su `origin`.
- [x] Imágenes validadas por firma con `FileSignature`:
  - el archivo elegido: PNG, JPEG o WebP, hasta 30 MB;
  - lo que se guarda: WebP o JPEG, hasta 2 MB la imagen y 200 KB la miniatura.
- [x] Ningún registro lleva nombres, alias, atributos, descripciones ni rutas.
- [x] El escenario `WritingSession` usa todos los métodos y la notificación nuevos.
- [x] Tests:
  - límites y errores con su motivo;
  - imágenes falsas o demasiado grandes;
  - papelera con relaciones;
  - notificaciones a otra ventana.

## 5. Estado de las fichas en la interfaz
- [x] `useBoard`: carga `board.get` al abrir la obra y aplica `elements.changed`.
- [x] Funciones puras con sus tests:
  - búsqueda por nombre y alias sin mayúsculas ni tildes;
  - orden alfabético en español;
  - nombres y alias repetidos.
- [x] Caché de imágenes por id y versión, con `element.image` bajo demanda.
- [x] Catálogos de la interfaz: clases de relación comunes (`relationship-kinds.ts`) y atributos sugeridos por tipo.

## 6. La ficha
- [x] `ElementSheet`:
  - nombre y tipo, y nombre del tipo con «otro»;
  - alias;
  - atributos: añadir, editar, ordenar arrastrando y quitar.
- [x] Descripción con TipTap: párrafos, cursiva y negrita.
- [x] Guardado automático tras una pausa, con `pending-saves`: nada queda sin guardar al cerrar.
- [x] Imagen:
  1. elegir el archivo con el diálogo;
  2. `element.readImage`;
  3. reducirla en un `canvas` a 1600 px y una miniatura de 256 px, en WebP o en JPEG si el sistema no codifica WebP;
  4. `element.setImage`.
- [x] Cambiar y quitar la imagen.
- [x] Aviso de nombre repetido, con enlace a la otra ficha.
- [x] Los atajos de la obra (Ctrl+S, F5, F6, F11) no actúan desde la descripción, y los de la descripción no tocan el texto.
- [x] Tests de comportamiento de la ficha.
- [x] Comprobar en la app real: junto con el panel del bloque 7, que es donde se ve la ficha.

## 7. Panel junto al texto
- [x] `ElementsPanel` a la derecha del editor.
- [x] Ctrl+Mayús+E y un botón de la barra de la obra lo abren y cierran; se recuerda por ventana.
- [x] Buscador y lista agrupada por tipo, plegable y en orden alfabético. La ficha sustituye a la lista y una flecha vuelve.
- [x] «Crear ficha» en el menú flotante del editor: crea la ficha con el texto seleccionado y la abre en el panel.
- [x] Tests de comportamiento del panel y del menú flotante.
- [x] Comprobar en la app real, con el índice abierto a la vez.

## 8. Pestañas Escritura y Tablero
- [x] Dos pestañas en `features/workspace`; F2 alterna.
- [x] La Escritura se oculta sin desmontarse: el cursor y el desplazamiento siguen donde estaban.
- [x] El Tablero se carga con `import()` la primera vez.
- [x] En el modo concentración, las pestañas no se ven y F2 no hace nada.
- [x] Tests de comportamiento.
- [x] Comprobar en la app real.

## 9. Pizarra
- [x] Añadir `@xyflow/react` (MIT), tras revisar su licencia y las de sus dependencias.
- [x] Nodo de tarjeta con miniatura, nombre y marca del tipo, y estilos con los tokens de la app.
- [x] Arrastrar guarda la posición con `board.move` al soltar.
- [x] Desplazar, acercar, alejar y encajar todo. Al abrir, encaja todas las tarjetas.
- [x] Crear ficha desde la pizarra, en un hueco libre junto al centro de la vista.
- [x] Abrir una tarjeta muestra su ficha en el panel derecho del Tablero.
- [x] Tests de comportamiento.
- [x] Comprobar en la app real.

## 10. Flechas y relaciones
- [x] Arrastrar de una tarjeta a otra abre el selector de clase: comunes, propias y «Nueva…».
- [x] Arista propia: etiqueta en el centro, punta según el sentido y sin punta en las simétricas; varias entre las mismas fichas se curvan.
- [x] Elegir una flecha permite cambiar su clase o quitarla.
- [x] En la ficha:
  - lista de relaciones con la etiqueta desde ese lado;
  - crear relaciones con un buscador de fichas;
  - saltar a la otra ficha.
- [x] Una pareja propia queda para otras relaciones de la obra.
- [x] Tests de comportamiento.
- [x] Comprobar en la app real.

## 11. Ayudas de la pizarra
- [x] Filtro por tipo, que oculta tarjetas y sus flechas.
- [x] Resaltar las relaciones de la tarjeta elegida y atenuar el resto.
- [x] Buscar y centrar.
- [x] Ordenar automáticamente con `d3-force` (ISC):
  - iteraciones fijas y arranque fijo;
  - sin solapes;
  - un solo `board.move`;
  - «Deshacer».
- [x] Teclado:
  - tabular entre tarjetas e Intro para abrirlas;
  - flechas para moverlas, con Mayús para pasos grandes.
- [x] Tests: el orden automático es repetible y no solapa; el resto, tests de comportamiento.
- [x] Comprobar en la app real.

## 12. Papelera y repetidos
- [ ] Borrar desde la ficha o la tarjeta manda a la papelera, con el aviso de deshacer (`UndoNotice`).
- [ ] La papelera de fichas está al final de la lista del panel.
- [ ] Restaurar devuelve la tarjeta a su sitio y sus flechas.
- [ ] Los avisos de nombre repetido aparecen en las dos fichas.
- [ ] Tests de comportamiento.
- [ ] Comprobar en la app real.

## 13. Pruebas de extremo a extremo y rendimiento
- [ ] El recorrido de la spec:
  - crear un personaje y un lugar en la pizarra;
  - unirlos con una flecha;
  - crear una ficha desde el texto;
  - borrarla y restaurarla;
  - cerrar y abrir la obra con todo en su sitio.
- [ ] Otra ventana de la misma obra ve los cambios en vivo.
- [ ] Pizarra con 300 tarjetas y 600 flechas: arrastrar y desplazar con un p95 de fotograma por debajo de 50 ms (150 ms en la CI de macOS).
- [ ] Escribir con el panel de fichas abierto mantiene el p95 de la 001.
- [ ] Todo en verde en los tres sistemas en la CI.

## 14. Validación y cierre
- [ ] Repasar los criterios de `spec.md` y marcar solo lo comprobado.
- [ ] `tech-stack.md`: React Flow y d3-force, el esquema v3 y los módulos nuevos.
- [ ] ADR 0010: React Flow para el Tablero.
- [ ] Pull request a `main` con `gh`, con la CI en verde.
- [ ] Hoja de ruta: la 004 pasa a «Hecho» al fusionar.
