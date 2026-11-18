# Formato `.rocinante`

Un proyecto de Rocinante es **un único archivo** que contiene la obra completa: capítulos, fragmentos, papelera, versiones y notas. Por dentro es una base de datos [SQLite 3](https://sqlite.org/fileformat.html), así que se puede abrir con cualquier herramienta de SQLite para inspeccionarla o recuperar el texto sin depender de la app.

Este documento describe la **versión 1 del esquema**. La fuente de verdad es [`0001-initial.sql`](../../src/core/Rocinante.Infrastructure/Persistence/Migrations/0001-initial.sql).

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
Notas del autor sobre un documento. Su texto vive aquí y **nunca** dentro de `document.content`: el documento solo guarda un ancla con el atributo `noteId`: la marca `noteAnchor` sobre un pasaje o el nodo en línea `notePoint` en un punto. Así las notas no cuentan como texto de la obra ni salen en las exportaciones.

| Columna | Tipo | |
|---|---|---|
| `id` | TEXT, PK | El mismo que lleva el ancla en el texto |
| `document_id` | TEXT → `document.id` | Se borran con su documento |
| `text` | TEXT | |
| `anchored` | INTEGER 0/1 | 0 si el pasaje anclado ya no está: la nota queda suelta |
| `created_at`, `updated_at` | INTEGER | |

Índice `note_by_document (document_id, created_at)`.

## Qué no está en el archivo

La configuración del escritor (proyectos recientes, último capítulo abierto, posición del cursor, tema, preferencias) vive en `settings.json`, en la carpeta de datos de la app, no en el proyecto. Al compartir un `.rocinante` solo se comparte la obra.

## Migraciones

- Cada cambio del esquema es un archivo nuevo `NNNN-descripcion.sql` en `Persistence/Migrations/`, numerado sin huecos. Un archivo publicado **no se modifica nunca**.
- Al abrir un proyecto se aplican, en orden y en **una sola transacción**, las migraciones con número mayor que `schema_version`. Si una falla, el archivo queda en la versión que tenía.
- Una app más antigua no abre un proyecto con un esquema más nuevo, para no dañar datos que no entiende.
- Cada migración que cambie el formato actualiza este documento.

## Inspeccionar un proyecto

```bash
sqlite3 obra.rocinante "SELECT kind, position, title, words FROM document WHERE deleted_at IS NULL ORDER BY kind, position;"
```
