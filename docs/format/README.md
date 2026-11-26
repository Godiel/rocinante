# Formato `.rocinante`

Un proyecto de Rocinante es **un único archivo** que contiene la obra completa: capítulos, fragmentos, papelera, versiones y notas. Por dentro es una base de datos [SQLite 3](https://sqlite.org/fileformat.html), así que se puede abrir con cualquier herramienta de SQLite para inspeccionarla o recuperar el texto sin depender de la app.

Este documento describe la **versión 5 del esquema**. La fuente de verdad son las migraciones de [`Persistence/Migrations`](../../src/core/Rocinante.Infrastructure/Persistence/Migrations/): [`0001-initial.sql`](../../src/core/Rocinante.Infrastructure/Persistence/Migrations/0001-initial.sql), [`0002-work-format.sql`](../../src/core/Rocinante.Infrastructure/Persistence/Migrations/0002-work-format.sql), [`0003-elements.sql`](../../src/core/Rocinante.Infrastructure/Persistence/Migrations/0003-elements.sql) [`0004-notes.sql`](../../src/core/Rocinante.Infrastructure/Persistence/Migrations/0004-notes.sql) y [`0005-dismissed-names.sql`](../../src/core/Rocinante.Infrastructure/Persistence/Migrations/0005-dismissed-names.sql).

## Cómo se reconoce

- **Cabecera SQLite** con `PRAGMA application_id = 0x524F4349` (los bytes `ROCI`). Un archivo SQLite sin ese identificador no es un proyecto, aunque tenga la extensión.
- **Versión del esquema** en la tabla `meta`, clave `schema_version`.

Al abrir un archivo, el núcleo comprueba, en este orden y **sin escribir nada**:

| Comprobación | Si falla |
|---|---|
| El archivo existe | «No encontrado» |
| Es una base SQLite y su `application_id` es `ROCI` | «No es un proyecto de Rocinante» |
| `schema_version` no es mayor que la que entiende esta versión de la app | «Creado con una versión más nueva» |
| `PRAGMA integrity_check` devuelve `ok` | «Archivo dañado» |

Solo si todo pasa se activan los ajustes de abajo y se aplican las migraciones pendientes. Un archivo rechazado queda byte a byte como estaba.

## Durabilidad

- **Modo WAL** (`journal_mode = WAL`): los cambios se escriben primero en `obra.rocinante-wal` y se integran después. Si la app se cierra de golpe, al reabrir SQLite recupera el último estado confirmado y el archivo nunca queda a medias.
- **`synchronous = FULL`**: cada guardado se fuerza a disco antes de darse por hecho. Un corte de luz pierde como mucho el guardado en curso, lo que cumple el criterio de la spec de perder 2 segundos como máximo.
- **Transacciones** en toda escritura. Guardar un texto, su versión automática y sus notas va en una sola transacción: queda todo o nada.
- **Claves foráneas activas** (`foreign_keys = ON`).

Mientras el proyecto está abierto, junto al archivo pueden verse `obra.rocinante-wal` y `obra.rocinante-shm`. Son parte del funcionamiento normal y desaparecen al cerrar. Para copiar un proyecto abierto se usa «Guardar como», que hace una copia coherente con la API de copia de seguridad de SQLite.

## Convenciones

| Qué | Cómo se guarda |
|---|---|
| Identificadores | UUID v7 en texto canónico (`0190b7e2-…`). Se ordenan por fecha de creación. |
| Fechas | Entero, milisegundos Unix en UTC. |
| Booleanos | Entero `0` o `1`, con `CHECK`. |
| Enumeraciones | Texto en `snake_case` (`chapter`, `before_restore`), con `CHECK`. |
| Texto de la obra | JSON de TipTap tal como lo produce el editor (`{"type":"doc",…}`). Además de los nodos estándar, Rocinante usa `sceneBreak` (cambio de escena), `footnote` (nota al pie, con su texto en `attrs.text`, que cuenta como texto de la obra), la marca `noteAnchor` y el nodo `notePoint` (anclas de notas), y el atributo `indent` (0–4) en párrafos y títulos. |
| Nombres | Tablas y columnas en `snake_case`, en inglés. |

Todas las tablas son `STRICT`: SQLite rechaza valores del tipo equivocado.

## Tablas

### `meta`
Pares clave-valor sobre el propio archivo.

| Columna | Tipo | |
|---|---|---|
| `key` | TEXT, PK | `schema_version` |
| `value` | TEXT | Número de la última migración aplicada |

### `project`
Exactamente una fila: un archivo, un proyecto. La columna `singleton` (siempre `1`, única) impide una segunda fila.

| Columna | Tipo | |
|---|---|---|
| `id` | TEXT, PK | |
| `singleton` | INTEGER | Siempre 1 |
| `title` | TEXT | Título de la obra |
| `created_at` | INTEGER | |

### `document`
Capítulos y fragmentos. Las columnas del **índice** las gestiona `Project` y las del **texto** las gestiona `Document`, por eso reordenar no reescribe el texto y guardar un capítulo no toca el índice.

| Columna | Tipo | |
|---|---|---|
| `id` | TEXT, PK | |
| `kind` | TEXT | `chapter` o `fragment` |
| `title` | TEXT | |
| `position` | INTEGER ≥ 0 | Lugar entre los de su tipo. En la papelera, el lugar que tenía |
| `created_at` | INTEGER | |
| `deleted_at` | INTEGER, nulo | Fecha de envío a la papelera; nulo si está en la obra |
| `content` | TEXT | JSON de TipTap |
| `revision` | INTEGER ≥ 0 | Aumenta con cada cambio del texto; 0 = nunca editado |
| `updated_at` | INTEGER | Último cambio del texto |
| `words`, `characters`, `paragraphs` | INTEGER ≥ 0 | Recuentos del texto, para los totales de la obra sin leer cada capítulo |
| `active_writing_ms` | INTEGER ≥ 0 | Tiempo de escritura activa desde la última versión |
| `last_edit_at` | INTEGER, nulo | Última edición, para medir la escritura activa |
| `unversioned_changes` | INTEGER 0/1 | Si el texto difiere de la última versión |

Índice parcial `document_by_place (kind, position)` sobre los documentos fuera de la papelera.

Los totales de la obra suman solo los **capítulos fuera de la papelera**: los fragmentos no forman parte de la obra.

### `document_version`
Instantáneas completas del texto. Nunca se modifican.

| Columna | Tipo | |
|---|---|---|
| `id` | TEXT, PK | |
| `document_id` | TEXT → `document.id` | Se borran con su documento |
| `kind` | TEXT | `automatic`, `manual` o `before_restore` |
| `name` | TEXT, nulo | Nombre opcional de las versiones manuales |
| `created_at` | INTEGER | |
| `content` | TEXT | JSON de TipTap |
| `words`, `characters`, `paragraphs` | INTEGER ≥ 0 | Para listar versiones sin leer su texto |

Índice `document_version_by_document (document_id, created_at)`.

### `note`
Las notas del autor. Desde la versión 4, una nota puede pertenecer a un documento (anclada en su texto o suelta en él) o a ninguno: es una **idea suelta** de la obra. Su texto vive aquí y **nunca** dentro de `document.content`: el documento solo guarda un ancla con el atributo `noteId`: la marca `noteAnchor` sobre un pasaje o el nodo en línea `notePoint` en un punto. Así las notas no cuentan como texto de la obra ni salen en las exportaciones.

| Columna | Tipo | |
|---|---|---|
| `id` | TEXT, PK | El mismo que lleva el ancla en el texto |
| `document_id` | TEXT → `document.id`, opcional | Nulo en una idea suelta. Se borran con su documento |
| `text` | TEXT, 1–10 000 | Texto plano de la nota, una línea por párrafo: lo que se busca y lo que muestra la lista |
| `content` | TEXT, opcional | _Desde la versión 4._ El texto con formato, en JSON de TipTap (párrafos, cursiva y negrita). Nulo en una nota escrita antes de la versión 4 y no editada desde entonces: se lee como un párrafo por línea de `text` |
| `anchored` | INTEGER 0/1 | 0 si el pasaje anclado ya no está (la nota queda suelta en su documento) y siempre en una idea suelta |
| `anchor_order` | INTEGER ≥ 0, opcional | _Desde la versión 4._ Lugar del ancla entre las anclas del texto del documento, al último guardado. Solo en notas ancladas |
| `resolved_at` | INTEGER, opcional | _Desde la versión 4._ Cuándo se marcó como resuelta; nulo mientras está abierta |
| `created_at`, `updated_at` | INTEGER | |
| `deleted_at` | INTEGER, opcional | _Desde la versión 4._ Cuándo se borró. La nota queda apartada, a la espera de deshacer, y su ancla se queda escondida en el texto. Se borra de verdad la próxima vez que se abre la obra |

Índices `note_by_document (document_id, created_at)` y `note_by_creation (created_at)`.

### `note_element`
_Desde la versión 4._ Las fichas con las que está enlazada cada nota, en el orden en que el escritor las enlazó. Se borran con su nota y con su ficha; el enlace con una ficha en la papelera se conserva.

| Columna | Tipo | |
|---|---|---|
| `note_id` | TEXT → `note.id` | |
| `element_id` | TEXT → `element.id` | Con `note_id` forma la clave |
| `position` | INTEGER ≥ 0 | Orden |

Índice `note_element_by_element (element_id)`.

### `work_format`
_Desde la versión 2._ Cómo se compone la obra: la hoja del libro que será, sus márgenes y su letra. Exactamente una fila, como `project`. Las obras creadas con la versión 1 reciben al migrar el formato por defecto: A5 de novela.

| Columna | Tipo | |
|---|---|---|
| `singleton` | INTEGER, PK | Siempre 1 |
| `page_size` | TEXT | `pocket` (11 × 17 cm), `a5`, `digest` (5,5 × 8,5 in), `trade` (6 × 9 in), `a4`, `letter` o `custom`. Es solo el nombre: las medidas son las columnas siguientes |
| `page_width`, `page_height` | REAL, 70–300 | Tamaño de la hoja, en milímetros |
| `margin_top`, `margin_bottom`, `margin_inside`, `margin_outside` | REAL ≥ 0 | Márgenes en milímetros; el interior es el del lomo |
| `typeface` | TEXT | `eb_garamond`, `literata`, `crimson_pro`, `source_serif_4`, `libre_baskerville` o `courier_prime` |
| `body_size` | REAL, 8–16 | Cuerpo del texto, en puntos |
| `leading` | REAL, 1–2 | Interlineado, como múltiplo del cuerpo |
| `first_line_indent`, `justified`, `drop_cap` | INTEGER 0/1 | Sangría de primera línea, texto justificado y capitular |

Dos `CHECK` de tabla exigen que los márgenes dejen una caja de texto de al menos 40 × 60 mm.

### `element`
_Desde la versión 3._ Los elementos de la obra: personajes, lugares, tramas y otros. Cada uno es una tarjeta en la pizarra del Tablero. Las obras anteriores la reciben vacía.

| Columna | Tipo | |
|---|---|---|
| `id` | TEXT, PK | |
| `kind` | TEXT | `character`, `place`, `plot` u `other` |
| `other_kind` | TEXT, 1–60 o NULL | Qué es, con las palabras del escritor (objeto, facción…). Solo con `kind = 'other'`, y entonces es obligatorio |
| `name` | TEXT, 1–200 | |
| `description` | TEXT | JSON de TipTap, como el texto de la obra: párrafos, cursiva y negrita |
| `board_x`, `board_y` | REAL, ±1 000 000 | Dónde está su tarjeta en la pizarra |
| `last_image_version` | INTEGER ≥ 0 | Versión de la última imagen que tuvo, aunque ya no la tenga: una imagen nueva nunca repite versión. 0 si nunca tuvo |
| `created_at` | INTEGER | |
| `deleted_at` | INTEGER o NULL | En la papelera desde entonces |

### `element_alias`
_Desde la versión 3._ Otros nombres de un elemento, en el orden del escritor. Se borran con su elemento.

| Columna | Tipo | |
|---|---|---|
| `element_id` | TEXT → `element.id` | |
| `position` | INTEGER ≥ 0 | Orden; con `element_id` forma la clave |
| `alias` | TEXT, 1–200 | |

### `element_attribute`
_Desde la versión 3._ Pares nombre–valor de un elemento, en el orden del escritor. Se borran con su elemento.

| Columna | Tipo | |
|---|---|---|
| `element_id` | TEXT → `element.id` | |
| `position` | INTEGER ≥ 0 | Orden; con `element_id` forma la clave |
| `name` | TEXT, 1–100 | |
| `value` | TEXT, hasta 5000 | Puede estar vacío, como empiezan los sugeridos |

### `element_image`
_Desde la versión 3._ La imagen de un elemento, como mucho una, ya reducida por la interfaz, y la miniatura que muestra su tarjeta. Se borra con su elemento.

| Columna | Tipo | |
|---|---|---|
| `element_id` | TEXT, PK → `element.id` | |
| `version` | INTEGER ≥ 1 | La de `element.last_image_version` al guardarla |
| `image`, `thumbnail` | BLOB | La imagen (hasta 1600 px por el lado mayor) y su miniatura (256 px) |
| `image_type`, `thumbnail_type` | TEXT | `image/webp` o `image/jpeg` |

### `relationship_kind`
_Desde la versión 3._ Las clases de relación que el escritor escribió en esta obra. Las comunes («hijo de» / «padre de», «hermano de»…) no están aquí: viven en la interfaz, que puede traducirlas.

| Columna | Tipo | |
|---|---|---|
| `id` | TEXT, PK | |
| `forward` | TEXT, 1–60 | Cómo se lee desde `from_id` («escudero de») |
| `inverse` | TEXT, 1–60 o NULL | Cómo se lee desde `to_id` («señor de»). NULL si es simétrica («rival de») |

### `relationship`
_Desde la versión 3._ Dos elementos unidos por una clase. La relación de un elemento en la papelera se conserva y no se muestra hasta restaurarlo.

| Columna | Tipo | |
|---|---|---|
| `id` | TEXT, PK | |
| `from_id`, `to_id` | TEXT → `element.id` | Distintos. Se borran con sus elementos |
| `kind` | TEXT | `builtin:<nombre>` para una clase común o `own:<relationship_kind.id>` para una del escritor |

Índices `relationship_by_from (from_id)` y `relationship_by_to (to_id)`.

### `dismissed_name`
_Desde la versión 5._ Los nombres que el escritor descartó como sugerencias de fichas: Rocinante no los vuelve a sugerir en esta obra.

| Columna | Tipo | |
|---|---|---|
| `name` | TEXT, PK, 1–200 | El nombre como se compara: sus palabras sin mayúsculas ni tildes (la ñ se conserva) y separadas por un espacio |
| `dismissed_at` | INTEGER | |

Las menciones, las coincidencias y las sugerencias no se guardan: se deducen del texto y de las fichas cada vez.

## Qué no está en el archivo

La configuración del escritor (proyectos recientes, último capítulo abierto, posición del cursor, tema, preferencias, ambiente y el formato que se sugiere para la próxima obra) vive en `settings.json`, en la carpeta de datos de la app, no en el proyecto. Las copias de los fondos y sonidos propios del escritor viven junto a ella, en `ambience/`. Al compartir un `.rocinante` solo se comparte la obra.

## Migraciones

- Cada cambio del esquema es un archivo nuevo `NNNN-descripcion.sql` en `Persistence/Migrations/`, numerado sin huecos. Un archivo publicado **no se modifica nunca**.
- Al abrir un proyecto se aplican, en orden y en **una sola transacción**, las migraciones con número mayor que `schema_version`. Si una falla, el archivo queda en la versión que tenía.
- Una app más antigua no abre un proyecto con un esquema más nuevo, para no dañar datos que no entiende.
- Cada migración que cambie el formato actualiza este documento.

## Inspeccionar un proyecto

```bash
sqlite3 obra.rocinante "SELECT kind, position, title, words FROM document WHERE deleted_at IS NULL ORDER BY kind, position;"
```
