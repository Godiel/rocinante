# Tech stack y convenciones

Cómo está construido Rocinante y las reglas que todo el código debe respetar. Ningún plan de feature debe contradecir este documento.

> **Estado:** decisiones cerradas. Las secciones marcadas como _pendiente_ (estructura de `src/`, comandos y esquema detallado) se definen en la feature 001, que las concreta al empezar.

## Arquitectura

Rocinante es una **aplicación de escritorio instalada**. Funciona sin navegador, sin internet y sin cuenta. Por dentro tiene tres capas:

```
┌──────────────────────────────────────────────┐
│ Interfaz (HTML/CSS/TypeScript)               │  editor, tablero, ventanas
├──────────────────────────────────────────────┤
│ Núcleo (C# / .NET 10)                        │  proyectos, fichas, escudero,
│                                              │  corrección, exportación
├──────────────────────────────────────────────┤
│ Anfitrión de escritorio: Tauri 2             │  ventanas, instaladores,
│ Windows · macOS · Linux                      │  actualizaciones, permisos
└──────────────────────────────────────────────┘
```

Son dos procesos. Tauri abre las ventanas y aloja la interfaz. El núcleo .NET se ejecuta como proceso auxiliar (*sidecar*) que Tauri arranca y detiene con la app. La interfaz y el núcleo se comunican mediante un **contrato de mensajes versionado** (p. ej. JSON-RPC), definido en la feature 001.

- **Interfaz:** se dibuja con tecnología web dentro de una ventana nativa, como VS Code u Obsidian. Se eligió porque los mejores editores de texto enriquecido existen en ese ecosistema. Lo que debe responder al instante mientras se escribe (por ejemplo, marcar menciones) vive aquí.
- **Núcleo:** contiene la lógica de dominio y todo lo pesado: guardar, analizar, corregir, exportar y hablar con la IA. No depende del anfitrión, así que la versión móvil futura (MAUI Hybrid) lo reutiliza tal cual, y también la web si llega.
- **Anfitrión:** una capa fina que abre las ventanas, empaqueta la app y conecta la interfaz con el núcleo. No contiene lógica de dominio.

## Tecnologías

- **Núcleo:** C# sobre **.NET 10 LTS**. Se migrará a .NET 12 LTS cuando salga; no se usan versiones STS.
- **Anfitrión de escritorio:** **Tauri 2**, con el núcleo .NET como sidecar. Se eligió por su soporte maduro de ventanas múltiples, sus instaladores y actualizaciones firmadas incluidos, su modelo de permisos y una comunidad activa. Se descartó Photino.NET por su comunidad pequeña y porque habría que construir a mano los instaladores y las actualizaciones. El código Rust se limita a configuración y comandos puntuales: la lógica nunca va en Rust. La feature 001 empieza comprobando las ventanas múltiples y el sidecar en Windows.
- **Interfaz:** **React** con **TypeScript estricto**. Se eligió porque los mejores editores de texto enriquecido tienen integración oficial con React, por la madurez de su ecosistema para el estado compartido entre ventanas y por su valor profesional. Se descartaron Svelte y Solid porque sus integraciones con el editor dependen de la comunidad.
- **Editor:** **TipTap** (sobre ProseMirror), **solo con su núcleo y extensiones MIT**. Se eligió por su madurez, su esquema de documento estructurado (lo que se guarda siempre es válido y el núcleo .NET lo puede analizar y exportar) y por sus decoraciones, que resaltan menciones sin modificar el texto del autor. Se descartó Lexical porque es más joven, su API es menos estable y su ecosistema de extensiones es menor. La vista de página con tamaño de libro (feature 002) no existe de forma nativa en ningún editor web y se construye en el proyecto.
- **Pizarra del Tablero:** **React Flow** (`@xyflow/react`, MIT), con tarjetas y flechas propias dibujadas por la app. Se eligió por su integración nativa con React, su accesibilidad con teclado y lector de pantalla y su fluidez con cientos de tarjetas. El orden automático usa **d3-force** (ISC), fijado en una versión exacta. Ver [ADR 0010](../../docs/adr/0010-react-flow-para-el-tablero.md).
- **Formato de proyecto:** `.rocinante`, un único archivo que es **la obra completa**, no solo su texto. Por dentro es una base de datos **SQLite**, accedida desde .NET con `Microsoft.Data.Sqlite`. Se eligió por su guardado incremental e instantáneo, sus transacciones (un corte de luz no corrompe el proyecto) y sus consultas indexadas para el tablero y el escudero. Se descartó un ZIP con JSON porque obliga a reescribir el archivo entero en cada guardado y puede corromperse. El esquema está documentado en el repositorio, lleva número de versión y se migra automáticamente al abrir proyectos antiguos.
- **Tests** (una herramienta por capa):
  - **Núcleo .NET:** xUnit, Shouldly para las aserciones y NSubstitute para los dobles de prueba. Se descartan FluentAssertions (licencia comercial desde la v8) y Moq (incidente de recogida de datos en 2023).
  - **Interfaz React:** Vitest y React Testing Library, incluidas las extensiones del editor.
  - **Contrato interfaz ↔ núcleo:** un esquema JSON compartido de los mensajes, validado en TypeScript y en C#. Si un lado cambia sin el otro, CI falla.
  - **De extremo a extremo:** Playwright sobre la interfaz con el núcleo real, para los flujos completos.
  - **Rust:** `cargo test` para los comandos que existan.
  - **Cobertura:** 80 % o más de líneas y de ramas en el dominio del núcleo, medida con coverlet (MIT) y exigida en cada ejecución de los tests. En la interfaz se prueba el comportamiento, sin porcentaje obligatorio.
- **Sonido:** Web Audio, el del propio WebView, sin bibliotecas. Los sonidos incluidos van en Opus, que suena igual en WebView2, WebKit y WebKitGTK. Se preparan una vez con `scripts/ambience.mjs` (ffmpeg en el equipo del autor, no en la app), y al repositorio solo suben los archivos convertidos.
- **Fondos y sonidos propios:** el núcleo los copia a la carpeta `ambience/` de los datos de la app con un nombre `<uuid>.<ext>`. El anfitrión los sirve a la interfaz con un protocolo propio, `ambience://`, que solo entrega nombres con esa forma y de esa carpeta. Se usa en lugar del protocolo de archivos de Tauri porque su lista de rutas permitidas falla en Windows.
- **Material incluido:** solo de dominio público (CC0). Su origen está en `features/ambience/credits.ts` y la compilación lo copia a `licenses/ambience.txt`, junto a las licencias de las tipografías. Todo el material incluido pesa como máximo 15 MB, y un test lo comprueba.
- **Distribución:** instaladores para Windows, macOS y Linux (feature 012).

## Licencia

**MIT.** Todas las dependencias deben tener una licencia compatible con MIT. Las que no lo sean (GPL, licencias comerciales o de uso restringido) no se incorporan.

## Calidad (obligatoria desde la feature 001)

Rocinante es código abierto y portafolio profesional, así que la calidad es parte del producto:

- **Arquitectura:** el núcleo de dominio está separado de la infraestructura, las dependencias apuntan hacia el dominio y cada capa tiene una responsabilidad.
- **Tests:** automatizados en cada capa. Ninguna feature se da por terminada sin ellos.
- **Documentación:** README del proyecto, guía de contribución, decisiones de arquitectura registradas (ADR) y código público documentado.
- **Seguridad:** las claves de API del escudero se guardan en el almacén seguro del sistema operativo, nunca en texto plano. Ningún texto sale del equipo sin consentimiento. Las dependencias se auditan.
- **CI:** compilar, probar y analizar en Windows, macOS y Linux en cada cambio.

## Archivos / módulos clave

| Ruta | Qué hay |
|---|---|
| `src/contracts/protocol.json` | El contrato de mensajes entre interfaz y núcleo (JSON Schema, versionado). Cada método tiene ejemplos en `src/contracts/examples/`. |
| `src/core/Rocinante.Domain` | Reglas de la obra sin dependencias: `Project` (índice de capítulos, fragmentos y papelera), `Document`, `DocumentContent` y `TextStatistics`, `DocumentVersion`, `Note` y los elementos de la obra (`Elements/`: `Element`, `ElementBoard`, `Relationship`, `RelationshipKind`). |
| `src/core/Rocinante.Application` | Casos de uso (`ProjectUseCases`, `DocumentUseCases`, `VersionUseCases`, `NoteUseCases`, `ElementUseCases`, `SettingsUseCases`), el `Workspace` compartido por todas las ventanas y los puertos que implementa la infraestructura. |
| `src/core/Rocinante.Application/Settings` | Preferencias del escritor, incluido el ambiente (`Ambience`: fondo, tecleo, ambientes, atenuar y meta), y los fondos y sonidos propios (`AmbienceUseCases`, `FileSignature`). |
| `src/core/Rocinante.Infrastructure` | SQLite (`Persistence/`, con las migraciones en `Persistence/Migrations/`), `settings.json` de la app (`Settings/`) y el registro con Serilog (`Logging/`). |
| `src/core/Rocinante.Sidecar` | El proceso del núcleo: servidor JSON-RPC por stdin/stdout, validación contra el contrato y notificaciones a las ventanas. |
| `src/host/src` | Anfitrión Tauri en Rust: `relay.rs` (relé entre ventanas y núcleo), `core.rs` (arranque, reinicio y registro de problemas) y `lib.rs` (ventanas y comandos) y `ambience.rs` (el protocolo `ambience://`). |
| `src/ui/src/bridge` | Cliente tipado del contrato; `generated/protocol.ts` se genera desde `protocol.json`. |
| `src/ui/src/editor` | Extensiones propias de TipTap (cambio de escena, notas al pie, anclas de notas, sangría), el desplazamiento tipo rodillo y los guardados pendientes. |
| `src/ui/src/features` | Bienvenida, editor y vista de escritura, índice, contador, versiones, formato de la obra (`format/`) y vista de página con su paginador (`pages/`, ver [ADR 0009](../../docs/adr/0009-paginador-propio.md)). |
| `src/ui/src/features/workspace` | Las pestañas Escritura y Tablero de la ventana de la obra (F2). |
| `src/ui/src/features/elements` | Las fichas: la ficha con sus atributos, alias, imagen y descripción, el panel junto al texto (Ctrl+Mayús+E), las relaciones, la papelera y el estado compartido de la pizarra (`useBoard`). |
| `src/ui/src/features/board` | La pizarra del Tablero con React Flow: tarjetas, flechas, colocación libre, buscador, filtro por tipo y orden automático con d3-force. |
| `src/ui/src/features/focus`, `features/ambience` | Modo concentración (F11, barra mínima, meta de la sesión) y ambiente: fondos, hoja translúcida, fondos animados dibujados por código (`animated/`) y créditos. |
| `src/ui/src/audio` | Motor de sonido con Web Audio: tecleo y ambientes en bucle con fundido. |
| `src/ui/src/design` | Temas («papel», «luz de vela»), tokens CSS, ornamentos y la lista de tipografías de la obra (`typefaces.ts`). |
| `tests/core` | Tests del núcleo por capa (xUnit v3 y Shouldly), incluidas las pruebas de contrato. |
| `tests/e2e` | Pruebas de extremo a extremo y de rendimiento con Playwright: la interfaz en un navegador y el núcleo real detrás de un relé de pruebas. |
| `docs/adr`, `docs/format` | Decisiones de arquitectura y el formato `.rocinante`. |

## Comandos

Desde la raíz del repositorio:

| Comando | Qué hace |
|---|---|
| `npm ci` | Instala las dependencias de la interfaz, de las pruebas E2E y de Tauri. |
| `npm run dev` | Arranca la app en modo desarrollo (Vite, anfitrión Tauri y núcleo). |
| `npm run core:build` | Publica el núcleo como ejecutable único en `src/host/binaries/`, donde Tauri lo busca. |
| `npm run contracts:generate` | Regenera los tipos de TypeScript desde el contrato; `contracts:check` comprueba que estén al día. |
| `npm run e2e` | Compila interfaz y núcleo y ejecuta las pruebas de extremo a extremo y de rendimiento. |
| `dotnet build src/core/Rocinante.slnx -c Release` | Compila el núcleo. |
| `dotnet test --solution src/core/Rocinante.slnx -c Release --no-build` | Tests del núcleo. |
| `dotnet format src/core/Rocinante.slnx --verify-no-changes` | Comprueba el formato del núcleo. |
| `npm test -w @rocinante/ui` | Tests de la interfaz (Vitest y Testing Library). |
| `npm run build -w @rocinante/ui` | Comprueba los tipos (`tsc -b`) y compila la interfaz. |
| `npm run lint -w @rocinante/ui`, `npm run format:check -w @rocinante/ui` | Lint (oxlint) y formato (Prettier) de la interfaz. |
| `cargo test`, `cargo clippy --all-targets -- -D warnings`, `cargo fmt --check` | Tests, análisis y formato del anfitrión, desde `src/host`. |

## Modelo de datos / dominio

Un proyecto `.rocinante` contiene todo lo que pertenece a la obra:

- **Texto** — capítulos y fragmentos con su orden, guardados en el formato JSON de TipTap (lo que ve el editor es lo que se guarda).
- **Elementos de la obra** — personajes, lugares y tramas, con sus atributos y alias.
- **Relaciones** — vínculos entre elementos (Claudio es hijo de Antonio).
- **Referencias** — cada mención de un elemento, enlazada al pasaje exacto donde aparece.
- **Tablero** — disposición de las tarjetas.
- **Notas e ideas** — pensamientos del autor, sueltos o enlazados a un pasaje o a un elemento.
- **Ajustes de la obra** — formato de hoja, tipografía y preferencias propias del proyecto.
- **Datos del escudero** — qué propuso la IA, de qué pasaje lo dedujo y si el autor lo aceptó, corrigió o descartó.

Las preferencias personales que no dependen de la obra (tema, ambiente y sonidos, proveedor de IA) se guardan en la configuración de la app, no en el proyecto. Las claves de API nunca se guardan en el proyecto.

**Esquema (versión 3).** El archivo es SQLite con `application_id` `ROCI`, modo WAL y `synchronous = FULL`. Sus tablas son `meta` (versión del esquema), `project` (una sola fila: título y fecha), `document` (capítulos y fragmentos: lugar en el índice, papelera, texto en JSON de TipTap y sus recuentos), `document_version` (versiones automáticas, a mano y «antes de restaurar»), `note` (notas del autor ancladas a un punto o pasaje, o sueltas) y, desde la versión 2 (feature 002), `work_format` (una sola fila: la hoja, los márgenes y la letra de la obra) y, desde la versión 3 (feature 004), los elementos de la obra: `element` (con su sitio en la pizarra y la papelera), `element_alias`, `element_attribute`, `element_image` (la imagen y su miniatura, dentro del archivo), `relationship_kind` (las clases de relación propias de la obra) y `relationship`. Cada cambio del esquema es una migración numerada en `src/core/Rocinante.Infrastructure/Persistence/Migrations/`. La descripción completa, columna a columna, está en [`docs/format`](../../docs/format/README.md). Las referencias a los elementos y las notas enlazadas llegarán con las features 005 y 006.

## Convenciones

### Idioma

- **Código en inglés:** identificadores, comentarios y mensajes de log.
- **Documentación en español:** README, guía de contribución, `spec/`, ADR y mensajes de commit.
- **Interfaz en español,** con los textos separados del código para poder traducirla en el futuro.

### Nombres

- **Dentro de cada lenguaje, su estilo oficial,** aplicado por formateadores automáticos y comprobado en CI:
  - **C#:** convenciones de Microsoft. `PascalCase` en tipos, métodos y propiedades; `_camelCase` en campos privados. Herramienta: `dotnet format` con `.editorconfig`.
  - **TypeScript:** `camelCase` en variables y funciones; `PascalCase` en tipos y componentes React. Herramientas: oxlint y Prettier (ver ADR 0008).
  - **Rust:** `snake_case`. Herramientas: `rustfmt` y Clippy.
- **En las fronteras, un único estilo común:**
  - **Mensajes interfaz ↔ núcleo (JSON):** `camelCase`.
  - **Tablas y columnas de SQLite:** `snake_case`.
  - **Archivos y carpetas:** `kebab-case`, salvo donde el lenguaje exija otra cosa (los archivos C# se llaman como su clase).
- **Una sola terminología:** cada concepto se nombra igual en C#, TypeScript, JSON y SQLite, según el glosario.

### Glosario del dominio

| Concepto | Nombre en código |
|---|---|
| Proyecto (la obra completa) | `Project` |
| Documento (capítulo o fragmento) | `Document` |
| Capítulo | `Chapter` |
| Fragmento suelto | `Fragment` |
| Elemento de la obra | `Element` |
| Personaje | `Character` |
| Lugar | `Place` |
| Trama | `Plot` |
| Otro elemento (objeto, facción, época…, con el nombre que le da el escritor) | `Other` |
| Tipo de elemento (personaje, lugar, trama u otro) | `ElementKind` |
| Atributo | `Attribute` |
| Alias | `Alias` |
| Relación | `Relationship` |
| Clase de relación («hijo de» / «padre de») | `RelationshipKind` |
| Posición de una tarjeta en el tablero | `BoardPosition` |
| Referencia (mención en el texto) | `Reference` |
| Nota o idea del autor (anclada en el texto o suelta) | `Note` |
| Nota al pie (parte del texto de la obra) | `Footnote` |
| Versión de un documento | `DocumentVersion` |
| Tablero | `Board` |
| Tarjeta | `Card` |
| Escudero | `Squire` |
| Propuesta del escudero | `Suggestion` |
| Hilo del destino | `FateThread` (no `Thread`, que choca con `System.Threading.Thread` de .NET) |

_El glosario crece con cada feature. Un concepto nuevo se añade aquí antes de usarlo en el código._

### Ramas y commits

- **Una rama por feature:** `feature/NNN-nombre-feature`, por ejemplo `feature/001-proyecto-editor-base`. Al terminar se abre un pull request a `main`, que solo se fusiona con CI en verde. Nunca se sube directamente a `main`.
- **Commits con [Conventional Commits](https://www.conventionalcommits.org/):** `tipo(ámbito): descripción`, por ejemplo `feat(editor): guardado automático cada párrafo`. Los tipos son `feat`, `fix`, `docs`, `test`, `refactor`, `chore` y `ci`.
- **Mensajes entendibles y precisos:** dicen qué cambia y por qué, en una línea clara y con detalle en el cuerpo si hace falta. Un commit = un cambio con sentido propio.
- **Sin menciones a herramientas de IA:** ni en los mensajes, ni en coautorías (`Co-Authored-By`), ni en las descripciones de los pull requests.

### Errores y logs

- **Todo error queda registrado en un log.** Cada capa (interfaz, núcleo y anfitrión) escribe en un registro común, con fecha, nivel (información, aviso, error), módulo y detalle técnico.
- **Los logs se guardan en local,** en la carpeta de datos de la app, con rotación para que no crezcan sin límite. Desde la app hay una opción para abrir esa carpeta y adjuntarla al reportar un fallo.
- **Los logs nunca contienen el texto de la obra ni claves de API.** Se registra *qué* falló, no *qué* estaba escribiendo el autor.
- **El usuario ve un mensaje claro** en español, sin jerga técnica, que le dice qué pasó y qué puede hacer. El detalle técnico va al log.
- **Ningún error puede perder trabajo:** ante un fallo, lo escrito se conserva antes que cualquier otra cosa.
- **Herramientas:** `Microsoft.Extensions.Logging` con Serilog hacia archivo en el núcleo; la interfaz y Tauri envían sus errores al mismo registro.

## Estilo visual

**Idea rectora: un libro pulcro impreso en buen papel.** Minimalista, cálido y silencioso. El Quijote está presente de forma sutil, en el oficio tipográfico y en algún detalle, nunca como decorado.

### Superficie de escritura

- **Papel sin bordes:** la zona de escritura no está delimitada por cajas ni marcos. Es como escribir en una hoja enorme, con márgenes generosos y una columna de texto de ancho cómodo de lectura (unos 60–75 caracteres por línea).
- **La vista de página** con tamaño de libro (feature 002) es un modo opcional para maquetar y revisar; la escritura por defecto es en papel continuo.
- **Cursor de máquina de escribir**, en forma y en movimiento:
  - **Forma:** un bloque o una barra gruesa que parpadea con suavidad, como la marca de una máquina de escribir, en lugar de la línea fina habitual. El diseño exacto se define en la feature 001.
  - **Movimiento:** la línea que se escribe se mantiene fija a la altura de los ojos y es el papel el que sube, como el rodillo de una máquina (*typewriter scrolling*). Se puede desactivar.
- **La interfaz se retira mientras se escribe:** menús y paneles se atenúan o se ocultan al teclear y reaparecen al mover el ratón.

### Color

Pocos colores, todos cálidos, como papel y tinta. Se definen como tokens (variables) y ningún componente usa colores sueltos.

- **Tema claro, «papel»:** fondo de papel marfil (no blanco puro ni amarillento), texto de tinta casi negra y cálida.
- **Tema oscuro, «luz de vela»:** fondo oscuro cálido (no gris azulado), texto color pergamino con contraste suficiente para escribir horas.
- **Un único acento: rojo de rúbrica,** como el de los títulos y capitulares de los libros antiguos. Se usa con mucha moderación: selección, elemento activo, menciones.
- **Contraste:** el texto cumple WCAG AA como mínimo en ambos temas.

### Tipografía

Todas con licencias abiertas (SIL OFL), incluidas en la app y sin depender de internet.

- **Texto de la obra:** serifas de libro, elegidas en el formato de cada obra: EB Garamond (la de por defecto), Literata, Crimson Pro, Source Serif 4 y Libre Baskerville. Van dentro de la app en latino y latino extendido, en redonda, cursiva y negrita, y la compilación copia su licencia OFL a `licenses/`.
- **Interfaz:** la misma familia serif, en tamaños pequeños, versalitas y cursivas, para que la app entera parezca un libro y no un programa.
- **Modo máquina de escribir:** Courier Prime, como opción del texto.
- **Detalles tipográficos:** comillas españolas («»), rayas de diálogo (—), ligaduras y numerales de estilo antiguo donde la fuente los tenga.

### Toque quijotesco (sutil)

- Ornamentos tipográficos clásicos (florones, filetes) como separadores de escenas y en pantallas vacías.
- Capitular opcional al inicio de cada capítulo.
- Pantallas vacías con una pequeña ilustración de línea al estilo de grabado (Rocinante, un molino).
- Icono de la app: un dibujo de línea, sobrio y reconocible.

### Lo que nunca se hace

Esta lista excluye la estética genérica de las apps de IA:

- Ni degradados, ni brillos, ni neón, ni efecto cristal.
- Ni morados, ni azules eléctricos, ni colores saturados.
- Ni emojis como iconos, ni iconos genéricos sin coherencia.
- Ni esquinas muy redondeadas (como máximo 2–4 px), ni sombras marcadas.
- Ni animaciones llamativas: el movimiento es breve, discreto y solo cuando informa de algo.
- Ni tarjetas dentro de tarjetas, ni rellenos de espacio sin propósito.

### Layout

- **Escritorio primero:** ventanas desde 1024 px de ancho; las ventanas desacopladas (p. ej. el Tablero) se adaptan a cualquier tamaño.
- **Retícula y espaciado** con una escala fija, derivada del tamaño del texto, para que todo respire con el mismo ritmo.

## Límites duros

- No se publica nada en GitHub ni se conecta el repositorio remoto hasta que el autor lo indique.
- No se incorporan dependencias con licencias incompatibles con MIT.
- No se usan extensiones de pago de TipTap («Pro») ni ningún servicio de TipTap Cloud.
- No se envía texto del usuario a ningún servicio sin su consentimiento explícito.
- No se guardan secretos (claves, tokens) en el repositorio ni en texto plano.
