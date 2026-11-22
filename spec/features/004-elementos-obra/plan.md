# 004 · Elementos de la obra — Plan

Cómo se implementa lo descrito en [`spec.md`](spec.md). Respeta la [constitución](../../constitution/tech-stack.md) y se apoya en la arquitectura de las features [001](../001-proyecto-editor-base/plan.md), [002](../002-hoja-de-escritura/plan.md) y [003](../003-modo-concentracion/plan.md).

## Enfoque

Las fichas son **datos de la obra**, como los capítulos y las notas. Siguen el mismo camino que ellos:

- El dominio del núcleo define sus reglas.
- SQLite las guarda en el archivo `.rocinante`, con una migración nueva.
- El contrato las expone.
- El núcleo avisa a todas las ventanas de cada cambio.

En la interfaz hay tres piezas que comparten un mismo estado de las fichas:

- **La ficha:** el formulario de un elemento, igual en el panel de la Escritura y en el del Tablero.
- **El panel junto al texto:** lista, buscador y ficha, a la derecha del editor.
- **La pizarra:** la pestaña Tablero, construida con React Flow.

La pizarra no se carga hasta que se abre el Tablero por primera vez, para que abrir una obra y escribir no paguen su peso.

## Arquitectura de la feature

```
 Pestaña Escritura                         Pestaña Tablero (F2)
   editor ── «Crear ficha» (menú flotante)   pizarra (React Flow, carga diferida)
   panel de fichas (Ctrl+Mayús+E)              tarjetas · flechas · filtros · buscar · ordenar (d3-force)
        └──────────── ficha (formulario compartido) ────────────┘
                              │  element.* / relationship.* / board.move
 Núcleo .NET ── dominio: Element, Relationship, RelationshipKind
        │        └─ SQLite (.rocinante, esquema v3): element, element_alias, element_attribute,
        │                                         element_image, relationship, relationship_kind
        │  elements.changed (todas las ventanas de la obra)
 Interfaz ── estado de las fichas (uno por ventana), alimentado por la notificación
```

- **Un elemento** (`Element`) tiene:
  - identificador;
  - tipo (`character`, `place`, `plot` u `other`) y, si es `other`, el nombre del tipo;
  - nombre, alias y atributos (lista ordenada de nombre–valor);
  - descripción en JSON de TipTap, como el texto de la obra;
  - imagen opcional;
  - posición en la pizarra;
  - fecha de papelera, nula mientras está en la obra.
- **Una relación** (`Relationship`) une dos elementos en un sentido, de `from` a `to`, con una clase de relación (`RelationshipKind`). La clase dice cómo se lee desde cada lado.
- **Las clases comunes viven en la interfaz** (`features/elements/relationship-kinds.ts`), con su texto en español: «hijo de» / «padre de», «hermano de» (simétrica)… Se nombran `builtin:<nombre>`, como los fondos de la 003. El núcleo solo comprueba la forma del identificador. Las **propias** son de la obra: se guardan en `relationship_kind` con su texto de ida, su texto de vuelta (o nada, si es simétrica) y se nombran `own:<uuid>`.
- **Los atributos sugeridos también viven en la interfaz.** Al crear una ficha, la interfaz manda los atributos vacíos de su tipo; para el núcleo son atributos como cualquier otro.

## Implementación

1. **Contrato (versión 7)** — `src/contracts`.
   - Definiciones:
     - `ElementKind`: `character | place | plot | other`.
     - `ElementSummary { id, kind, otherKind, name, aliases, position { x, y }, image: null | { version } }`: lo que necesitan la lista y la pizarra.
     - `Element`: el resumen más `attributes [{ name, value }]` y `description` (JSON de TipTap).
     - `Relationship { id, from, to, kind }` y `RelationshipKind { id, forward, inverse | null }`.
     - `Board { elements: ElementSummary[], relationships, ownKinds, trash: ElementSummary[] }`.
   - Métodos:
     - `board.get` devuelve todo lo anterior de una vez.
     - `element.create { kind, otherKind?, name, attributes?, position?, origin }`.
     - `element.get { id }`.
     - `element.update { id, changes, origin }`: `changes` lleva solo lo que cambia (nombre, tipo, alias, atributos o descripción).
     - `element.delete` y `element.restore { id, origin }`.
     - `element.readImage { path }` lee y valida un archivo elegido por el escritor y devuelve sus bytes en base64 (ver bloque 6).
     - `element.setImage { id, image, thumbnail, origin }` y `element.removeImage { id, origin }`.
     - `element.image { id, size: full | thumbnail }` devuelve los bytes guardados.
     - `board.move { positions [{ id, x, y }], origin }`, en lote: arrastrar una o reordenar todas es la misma llamada.
     - `relationship.create { from, to, kind | newKind { forward, inverse }, origin }`, `relationship.update { id, kind, origin }` y `relationship.delete { id, origin }`.
   - Notificación `elements.changed { origin, elements, removed, relationships, removedRelationships, ownKinds }`, con solo lo que cambió. `removed` incluye lo que va a la papelera.
   - Motivos de error nuevos: `elementNotFound`, `relationshipNotFound`, `relationshipKindNotFound`, `nameRequired` y `sameElement` (una relación de una ficha consigo misma). Se reutilizan `notAnImage` y `fileTooLarge` de la 003.
   - Ejemplos válidos e inválidos de cada método; el escenario de `ContractTests` usa todos.
2. **Dominio** — `Rocinante.Domain/Elements`.
   - `Element`:
     - nombre obligatorio, sin espacios a los lados, hasta 200 caracteres; el tipo de `other`, hasta 60;
     - hasta 50 alias y 100 atributos, sin alias vacíos;
     - cambiar el tipo conserva todo.
   - `Relationship`: `from` y `to` distintos y existentes; una misma pareja de fichas puede tener varias relaciones, pero no dos iguales (mismos extremos y clase).
   - `RelationshipKind` propia: texto de ida obligatorio, hasta 60 caracteres. Si la inversa falta, es simétrica.
   - `ElementBoard`, el agregado: los elementos, su papelera, las relaciones y las clases propias. Al mandar un elemento a la papelera, sus relaciones quedan apartadas con él y vuelven al restaurarlo. Una relación con un extremo en la papelera no se ve.
   - Tests de dominio al 80 % o más, como exige la constitución.
3. **Persistencia (esquema v3)** — `Infrastructure/Persistence`.
   - Migración `0003-elements.sql`:
     - `element` (con `board_x`, `board_y` y `deleted_at`);
     - `element_alias` y `element_attribute`, con su orden;
     - `element_image` (imagen y miniatura como BLOB, y una versión que cambia con cada imagen);
     - `relationship`, con claves foráneas a `element`;
     - `relationship_kind`, las propias.
   - Las obras v2 se migran al abrirlas, como en la 002.
   - Repositorio de elementos con escrituras en transacción.
   - Se comprueba que «Guardar como» copia las tablas nuevas, imágenes incluidas.
   - `docs/format` describe las tablas nuevas columna a columna.
4. **Casos de uso y sidecar** — `Rocinante.Application` y `Rocinante.Sidecar`.
   - `ElementUseCases`, con los métodos del contrato. Cada cambio difunde `elements.changed` con su `origin`.
   - Las imágenes se validan por su firma con `FileSignature` (de la 003):
     - el archivo elegido: PNG, JPEG o WebP, hasta 30 MB;
     - lo que se guarda: WebP o JPEG, hasta 2 MB la imagen y 200 KB la miniatura.
   - Los registros nunca llevan nombres, alias, atributos, descripciones ni rutas.
5. **Estado de las fichas en la interfaz** — `features/elements`.
   - `useBoard`: carga `board.get` al abrir la obra y aplica `elements.changed`. Lo comparten el panel, la ficha y la pizarra de la ventana.
   - Búsqueda por nombre y alias sin mayúsculas ni tildes (normalización NFD), y detección de nombres repetidos, en funciones puras con sus tests.
   - Las imágenes se piden con `element.image` cuando hacen falta y se guardan en una caché por id y versión.
6. **La ficha** — `features/elements/ElementSheet.tsx`.
   - Nombre, tipo (y nombre del tipo si es «otro»), alias, atributos (añadir, editar, arrastrar para ordenar con `@dnd-kit`, como el índice, y quitar), descripción, imagen y relaciones.
   - La descripción usa TipTap con párrafos, cursiva y negrita, nada más.
   - Los cambios se guardan solos tras una pausa breve, con las mismas garantías que el texto (`editor/pending-saves.ts`): nada queda sin guardar al cerrar.
   - Imagen:
     1. El diálogo del sistema elige el archivo.
     2. `element.readImage` lo valida y devuelve sus bytes.
     3. La interfaz lo decodifica con `createImageBitmap`, lo reduce en un `canvas` a 1600 px por el lado mayor y a 256 px para la miniatura, y lo codifica en WebP (o JPEG donde el sistema no codifique WebP).
     4. `element.setImage` lo guarda.
   - Aviso de nombre repetido, con enlace a la otra ficha.
7. **Panel junto al texto** — `features/elements/ElementsPanel.tsx`.
   - A la derecha del editor; Ctrl+Mayús+E y un botón de la barra de la obra lo abren y cierran. Su estado abierto o cerrado se recuerda por ventana, como el del índice.
   - Buscador y lista agrupada por tipo, plegable, en orden alfabético con `Intl.Collator("es")`. Una ficha abierta sustituye a la lista; una flecha vuelve.
   - «Crear ficha» en el menú flotante del editor: crea la ficha con el texto seleccionado (recortado, en una línea) y la abre en el panel para elegir el tipo.
8. **Pestañas Escritura y Tablero** — `features/workspace`.
   - Dos pestañas arriba; F2 alterna.
   - La Escritura se oculta, no se desmonta: el editor, el cursor y el desplazamiento siguen donde estaban.
   - El Tablero se carga con `import()` la primera vez que se abre.
   - En el modo concentración, F2 no hace nada y las pestañas no se ven.
9. **Pizarra** — `features/board`.
   - React Flow con un nodo propio para la tarjeta (miniatura, nombre y marca del tipo) y estilos con los tokens de la app. Se quitan los adornos por defecto que choquen con el estilo visual: sombras, esquinas redondeadas y colores saturados.
   - Arrastrar tarjetas guarda su posición con `board.move` al soltar.
   - Desplazar, acercar, alejar y encajar todo vienen de React Flow. La vista no se guarda: al abrir el Tablero, encaja todas las tarjetas.
   - Crear ficha desde la pizarra: aparece en un hueco libre junto al centro de la vista, buscado en espiral.
   - Al abrir una tarjeta, la ficha se edita en un panel a la derecha del Tablero.
10. **Flechas y relaciones** — `features/board` y `features/elements`.
    - Arrastrar desde el borde de una tarjeta a otra abre un selector de clase: las comunes, las propias de la obra y «Nueva…» para escribir una pareja.
    - Una arista propia de React Flow dibuja la flecha con su etiqueta en el centro. Las simétricas no tienen punta. Varias relaciones entre las mismas fichas se curvan para no solaparse.
    - Elegir una flecha permite cambiar su clase o quitarla.
    - En la ficha, la lista de relaciones muestra la etiqueta desde ese lado («padre de Claudio»), permite crear relaciones con un buscador de fichas y salta a la otra ficha.
11. **Ayudas de la pizarra** — `features/board`.
    - Filtro por tipo: oculta tarjetas y sus flechas.
    - Resaltar: al elegir una tarjeta, se atenúa todo lo que no sea ella, sus flechas y sus vecinas.
    - Buscar y centrar: el buscador de nombres y alias lleva a la tarjeta con `setCenter`.
    - Ordenar automáticamente con `d3-force`:
      - atracción por relación, repulsión entre tarjetas y colisión con el tamaño de la tarjeta;
      - iteraciones fijas y sin animación, con un arranque fijo para que el resultado se repita;
      - el resultado va en un solo `board.move`.
      - «Deshacer» guarda las posiciones anteriores y las devuelve con otro `board.move`.
    - Teclado:
      - tabular entre tarjetas e Intro para abrirlas;
      - flechas para moverlas (Mayús para pasos grandes);
      - las relaciones, desde la ficha.
12. **Papelera y repetidos** — `features/elements` y `features/board`.
    - Borrar desde la ficha o desde la tarjeta manda a la papelera, con el aviso de deshacer del índice (`UndoNotice`).
    - La papelera de fichas está al final de la lista del panel; restaurar devuelve la tarjeta a su sitio y sus flechas.
13. **Pruebas de extremo a extremo y rendimiento** — `tests/e2e`.
    - El recorrido de la spec:
      - crear un personaje y un lugar en la pizarra;
      - unirlos con una flecha;
      - crear una ficha desde el texto;
      - borrarla y restaurarla;
      - cerrar y abrir la obra con todo en su sitio.
    - Otra ventana de la misma obra ve los cambios en vivo.
    - Pizarra con 300 tarjetas y 600 flechas: arrastrar una tarjeta y desplazar la vista con un p95 de fotograma por debajo de 50 ms (150 ms en la CI de macOS, como en la 001).
    - Escribir con el panel de fichas abierto mantiene el p95 de la 001.
14. **Validación y cierre.**
    - Criterios de `spec.md`, marcando solo lo comprobado.
    - `tech-stack.md`: React Flow y d3-force, el esquema v3, los módulos nuevos y el glosario (`ElementKind`, `RelationshipKind`, `Other`).
    - ADR 0010: React Flow para el Tablero.
    - Pull request a `main` con `gh`, con la CI en verde en los tres sistemas.
    - Hoja de ruta: la 004 pasa a «Hecho» al fusionar.

## Decisiones

- **Las fichas son de la obra, en SQLite** — la constitución ya lo fija: el `.rocinante` es la obra completa. Una tabla por concepto permite consultas indexadas, que la 006 y la 007 van a necesitar.
- **React Flow para la pizarra** — `@xyflow/react`, MIT. Trae resuelto lo difícil y probado: desplazar y acercar, arrastrar, conectar, dibujar solo lo visible y el manejo con teclado. Hacerla a mano, como el paginador de la 002, tendría sentido si nada existiera; aquí existe y está muy mantenida. Se descarta tldraw por su licencia, que no es compatible con MIT.
- **d3-force para ordenar** — licencia ISC. Una red de personajes no es un árbol: las fuerzas agrupan a quienes se relacionan, y eso se lee mejor que unas filas por niveles. Se descartan dagre (pensado para jerarquías) y elkjs (licencia EPL, no compatible con MIT).
- **La interfaz reduce las imágenes** — el navegador ya sabe decodificar y reducir imágenes. Así no entra ninguna librería nativa en el núcleo. El núcleo sigue validando por firma y por tamaño lo que recibe y lo que guarda.
- **Imagen y miniatura guardadas** — la pizarra muestra cientos de miniaturas; decodificar cientos de imágenes grandes la haría lenta.
- **Clases de relación comunes en la interfaz** — sus textos son de la interfaz, que debe poder traducirse. A la obra solo van los identificadores y las clases propias, que sí son texto del escritor.
- **Un solo `board.move` en lote** — arrastrar una tarjeta, ordenar todas o deshacer son la misma operación y cuestan una transacción.
- **La vista de la pizarra no se guarda** — encajar todo al abrir es predecible y evita guardar un dato que cambia sin parar.
- **Pizarra en carga diferida** — React Flow y d3-force solo se cargan al abrir el Tablero, así que abrir una obra y escribir no se vuelven más lentos.

## Riesgos

- **Rendimiento de la pizarra con muchas tarjetas** — React Flow solo dibuja lo visible (`onlyRenderVisibleElements`), las tarjetas son componentes simples y memorizados, y las miniaturas son pequeñas. La prueba de rendimiento lo mide con 300 tarjetas y 600 flechas en los tres sistemas.
- **WebP en WebKit** — el `canvas` de WebKit (macOS y Linux) puede no codificar WebP y devolver PNG. La interfaz comprueba el tipo devuelto y usa JPEG en ese caso. El núcleo acepta los dos.
- **Imágenes grandes por el canal de mensajes** — un archivo de 30 MB son unos 40 MB en base64 en una sola línea JSON-RPC. Ocurre solo al elegir la imagen, y el relé ya maneja líneas largas. Si resulta lento, la alternativa es servir el original por un protocolo del host, como `ambience://` en la 003.
- **Estilo de React Flow** — sus estilos por defecto no son los de Rocinante. Se parte de su hoja base mínima y todo lo visible usa los tokens de la app.
- **El editor de la descripción junto al de la obra** — dos instancias de TipTap en la misma ventana. Los atajos de la obra (Ctrl+S, F5, F6, F11) no deben actuar sobre la ficha, ni los de la ficha sobre el texto. Hay tests de comportamiento para comprobarlo.
