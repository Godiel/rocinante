# 001 · Proyecto y editor base — Plan

Cómo se implementa lo descrito en [`spec.md`](spec.md). Respeta la [constitución](../../constitution/tech-stack.md).

## Enfoque

Se construye primero un **esqueleto andante**: la app más pequeña posible que atraviesa las tres capas (React → Tauri → .NET → SQLite → de vuelta a todas las ventanas). Sirve para validar las dos piezas de más riesgo, las **ventanas múltiples** y el **sidecar .NET**, antes de invertir en el resto. Si el esqueleto funciona, se crece capa a capa desde el dominio hacia la interfaz, con tests en cada paso.

## Arquitectura de la feature

```
 Ventana A (React)      Ventana B (React)
        │  invoke / eventos  │
        └─────────┬──────────┘
            Tauri (Rust)          ← relé: un único sidecar para todas las ventanas
                  │  JSON-RPC 2.0 por stdin/stdout
         Núcleo .NET (sidecar)
                  │
          proyecto.rocinante (SQLite)
```

- **Un solo sidecar por app.** Tauri lo arranca al abrir y lo detiene al cerrar. Si el sidecar cae, Tauri lo reinicia y la interfaz reintenta la operación.
- **Relé en Rust (única lógica en Rust):** reenvía las peticiones de cualquier ventana al sidecar, devuelve cada respuesta a quien la pidió (por `id`) y **difunde las notificaciones del núcleo a todas las ventanas**. Así se sincronizan las ventanas: el núcleo anuncia «capítulo X cambió» y todas se enteran.
- **Por qué stdin/stdout y no un servidor HTTP local:** ningún otro programa del equipo puede conectarse al núcleo, no hay puertos abiertos ni tokens que proteger.

## Estructura del repositorio

```
src/
├── ui/                         React + TypeScript (Vite)
│   └── src/
│       ├── app/                arranque, rutas, estado global
│       ├── features/           project/, editor/, outline/, versions/, counter/
│       ├── editor/extensions/  extensiones TipTap propias
│       ├── bridge/             cliente del contrato (habla con el relé)
│       └── design/             tokens, temas, tipografías, ornamentos
├── host/                       Tauri 2 (Rust): ventanas, relé del sidecar, permisos
├── core/                       solución .NET 10
│   ├── Rocinante.Domain/           entidades y reglas, sin dependencias
│   ├── Rocinante.Application/      casos de uso y puertos (interfaces)
│   ├── Rocinante.Infrastructure/   SQLite, archivos, logs, configuración
│   └── Rocinante.Sidecar/          punto de entrada: servidor JSON-RPC por stdio
└── contracts/                  protocol.json (fuente única) y examples/ compartidos
tests/
├── core/                       Rocinante.*.Tests (xUnit), incluidas las pruebas de contrato del núcleo
└── e2e/                        Playwright
docs/
├── adr/                        decisiones de arquitectura
└── format/                     especificación del formato .rocinante
.github/workflows/              CI
```

Los tests de la interfaz viven junto a su archivo (`Counter.tsx` + `Counter.test.tsx`); sus pruebas de contrato están en `src/ui/src/bridge/`.

## Implementación

0. **Preparar el entorno.** Ya están .NET 10 SDK, Node 24 y Visual Studio 2022 con C++. Falta **instalar Rust** (`rustup`), con permiso del autor.
1. **Esqueleto andante y validación** — `src/host`, `src/ui`, `src/core/Rocinante.Sidecar`.
   Una ventana con un editor TipTap mínimo; un botón abre una segunda ventana; lo escrito en una aparece en la otra a través del núcleo, que lo guarda en SQLite. Se mide: latencia de ida y vuelta, memoria y tamaño del sidecar publicado. **Punto de decisión:** si algo falla, se revisa la elección antes de seguir.
2. **Cimientos del repositorio** — `.editorconfig`, oxlint y Prettier (ADR 0008), `rustfmt` y Clippy, `Directory.Build.props` (nullable, advertencias como errores), workflow de CI en Windows, macOS y Linux, `LICENSE` (MIT), `README.md`, `CONTRIBUTING.md` y los primeros ADR con las decisiones de la constitución.
3. **Contrato de mensajes** — `src/contracts`.
   Esquemas JSON de cada petición, respuesta y notificación, con versión del protocolo. Los tipos TypeScript se generan a partir de los esquemas; el núcleo valida los mensajes entrantes contra los mismos esquemas. Pruebas de contrato en ambos lados.
4. **Dominio** — `Rocinante.Domain`.
   `Project`, `Chapter`, `Fragment` (ambos son documentos con tipo distinto), `DocumentVersion`. Reglas: orden de capítulos, conversión fragmento ↔ capítulo, eliminación recuperable, versiones automáticas y manuales, restaurar sin perder lo actual.
5. **Persistencia** — `Rocinante.Infrastructure`.
   Esquema SQLite v1 con migraciones, modo WAL y transacciones. Tablas iniciales: `meta` (versión del esquema), `project`, `document` (tipo, título, posición, contenido JSON de TipTap, recuentos), `document_version` y `note` (contenido, documento, ancla o suelta). Identificadores UUID v7. El esquema se documenta en `docs/format/`.
6. **Casos de uso y servidor JSON-RPC** — `Rocinante.Application`, `Rocinante.Sidecar`.
   Crear, abrir y cerrar proyecto; listar, crear, renombrar, reordenar, convertir, eliminar y restaurar documentos; guardar contenido; crear, listar, leer y restaurar versiones. Cada cambio emite una notificación.
7. **Configuración de la app** — `Rocinante.Infrastructure`.
   Proyectos recientes, último proyecto, capítulo y posición del cursor, preferencias (tema, índice anclado o flotante, contador visible), en la carpeta de datos de la app y fuera del proyecto. Apertura de un `.rocinante` recibido como argumento al arrancar.
8. **Base visual** — `src/ui/src/design`.
   Tokens de color de los temas «papel» y «luz de vela», escala tipográfica y de espaciado, EB Garamond incluida en la app, florones. Pantalla de bienvenida.
9. **Editor** — `src/ui/src/features/editor`, `src/ui/src/editor/extensions`.
   TipTap con extensiones MIT para el formato básico y extensiones propias para sangría, separador de escena (florón), notas al pie, notas ancladas, cursor de máquina de escribir y desplazamiento tipo rodillo. Menú flotante al seleccionar y atajos de teclado.
10. **Índice** — `src/ui/src/features/outline`.
    Vista anclable o flotante con capítulos y cajón de fragmentos; reordenar arrastrando y acciones de cada documento.
11. **Guardado automático y contador** — `src/ui/src/features/editor`, `counter`.
    Guardado tras una breve pausa al teclear (≤ 1 s) y al cambiar de documento o cerrar. El contador del capítulo se calcula en la interfaz; los totales de la obra salen de los recuentos que guarda el núcleo.
12. **Versiones** — `src/ui/src/features/versions`.
    Lista de versiones, vista de una versión, comparación con la actual y restauración.
13. **Errores y logs.**
    Serilog a archivo con rotación en el núcleo; los errores de la interfaz se envían al núcleo; Tauri escribe en la misma carpeta. Mensajes al usuario en español y sin jerga.
14. **Pruebas de extremo a extremo y rendimiento** — `tests/e2e`.
    Flujo «crear proyecto, escribir, cerrar, reabrir»; cierre forzado durante la escritura; obra de 150 000 palabras.
15. **Validación** contra los criterios de aceptación de `spec.md` en Windows (y en macOS y Linux vía CI).

## Decisiones

- **Relé Rust con un único sidecar** — las ventanas no hablan con el núcleo por su cuenta. Así hay un solo proceso con el archivo abierto, sin conflictos de escritura, y la sincronización entre ventanas sale gratis de las notificaciones. Se descartó un sidecar por ventana (varios procesos escribiendo el mismo SQLite) y un servidor HTTP local (expone un puerto).
- **JSON-RPC 2.0 delimitado por líneas** — estándar simple, sin dependencias pesadas, fácil de probar y de depurar. Se descartó gRPC por su complejidad en este escenario.
- **Contenido como JSON de TipTap por documento** — lo que guarda el núcleo es exactamente lo que edita la interfaz, sin conversiones con pérdida. El núcleo lo recorre para contar y, más adelante, analizar y exportar.
- **Guardado de documento completo tras una pausa** — más simple y robusto que enviar cada pulsación. Un capítulo de 20 000 palabras pesa unos cientos de KB, que SQLite escribe en milisegundos. Si las mediciones del paso 1 o del 14 lo desaconsejan, se pasa a cambios incrementales.
- **Notas ancladas fuera del texto** — en el documento solo hay una marca con el identificador de la nota; su contenido vive en la tabla `note`. Así la nota no se cuela en el texto, en el contador ni en las exportaciones, y si se borra el pasaje la nota sigue existiendo y pasa a ser suelta. Es la misma tabla que usará la feature 005 para las ideas sueltas.
- **Versiones como instantáneas completas** — sencillas y fiables de restaurar. Automáticas cada 10 minutos de escritura activa, si hubo cambios, más las manuales. El espacio no es un problema a la escala de una novela; si lo fuera, se comprimen.
- **Índice y texto separados en el dominio** — `Project` guarda solo el índice (tipo, título, posición y papelera de cada documento) y `Document` guarda el texto con su historial. Reordenar, convertir o borrar no carga la obra entera, y guardar un capítulo no toca el índice. Ambos viven en la misma fila de `document`; cada uno usa sus columnas.
- **Mover es también convertir** — una sola operación coloca un documento en una lista y una posición. Arrastrar un fragmento entre los capítulos lo convierte en capítulo, sin tocar su texto.
- **Tiempo de escritura activa** — solo cuenta el tiempo entre dos guardados separados por 2 minutos o menos. Dejar un capítulo abierto toda la noche no crea una versión por la mañana.
- **Notas que se reconcilian en los dos sentidos** — al guardar, cada nota se marca anclada o suelta según su ancla esté o no en el texto. Si el autor deshace el borrado del pasaje, la nota vuelve a anclarse.
- **Recuentos en el núcleo** — palabras (tramos con alguna letra o cifra, separados por espacios o rayas de diálogo), caracteres tal como los ve el lector (espacios incluidos) y párrafos no vacíos. Las notas no cuentan porque su texto no está en el documento.
- **El archivo se identifica por dentro** — `PRAGMA application_id` con los bytes `ROCI` distingue un proyecto de cualquier otra base SQLite, aunque alguien le cambie la extensión.
- **El núcleo arranca sin proyecto** — la interfaz crea o abre uno. Un único `Workspace` guarda la sesión del archivo y el índice en memoria para todas las ventanas; si un cambio del índice falla, se recarga del archivo para que la memoria nunca se aparte de lo guardado.
- **Guardar un texto arrastra lo que trae consigo** — en una sola transacción se guardan el texto, la versión automática si tocaba y las notas que se anclan o se sueltan.
- **«Guardar como» sigue en la copia** — como en los procesadores de texto: se escribe la copia y se continúa trabajando sobre ella; el original queda como estaba.
- **Fallos esperados con motivo** — las reglas incumplidas y los archivos que no se pueden abrir vuelven con un código propio y un `reason` del contrato; la interfaz los convierte en mensajes en español. Solo lo inesperado es un error interno y va al log.
- **Configuración de la app fuera del proyecto** — la posición del cursor y las preferencias son del escritor, no de la obra (constitución, «Modelo de datos»). Viven en `settings.json`, en la carpeta de datos de la app, que el anfitrión pasa al núcleo con `--data-dir`. Se escribe en un archivo temporal que luego sustituye al anterior; un archivo ilegible se aparta y la app arranca con los valores por defecto, porque perder las preferencias nunca debe impedir escribir.
- **Qué se abre al arrancar** — el archivo con el que se lanzó la app (doble clic, `--open`) y, si no hay, el proyecto que quedó abierto al salir. Cerrar el proyecto a mano significa empezar en la bienvenida. Si el proyecto no se puede abrir, la ventana recibe el motivo y muestra la bienvenida, y el proyecto deja de reabrirse.
- **Los colores viven en TypeScript** — `design/themes.ts` es la única fuente: la app los aplica como variables CSS y el test de contraste comprueba esos mismos valores, así que no pueden separarse. Tamaños y espaciado son variables CSS derivadas de una línea del texto (19 px × 1,6).
- **Sin ilustraciones genéricas** — las pantallas vacías llevan florón y filete; la ilustración de grabado (Rocinante, un molino) espera a tener un dibujo propio.
- **Dos clases de ancla** — un pasaje lleva la marca `noteAnchor` y un punto el nodo `notePoint`; una marca no puede ocupar un punto vacío y TipTap no admite dos extensiones con el mismo nombre. El núcleo reconoce ambas.
- **Notas al pie en el propio nodo** — el texto va en `attrs.text` del nodo `footnote`; la numeración sale de un contador CSS, así que sigue el orden del texto sin guardarse. El núcleo cuenta sus palabras como parte de la obra.
- **Cursor de máquina como capa propia** — los navegadores no permiten cambiar la forma del cursor de texto: se dibuja una barra gruesa sobre el texto y el cursor real se vuelve transparente. Al seleccionar, al perder el foco o mientras un método de entrada (IME) compone, se devuelve el cursor del sistema.
- **Atajos: teclas F para las funciones grandes** — las teclas F quedan reservadas para las vistas principales que vendrán (tableros y similares). Las herramientas de texto usan combinaciones (Ctrl+B, Ctrl+Alt+N…) y el índice se abre y cierra con Ctrl+Mayús+I. En la versión de desarrollo ese atajo también abre las herramientas del navegador; la versión publicada no las incluye.
- **Índice anclado o flotante** — anclado ocupa una columna a la izquierda del texto; flotante es una hoja sobre el texto que se retira en cuanto el escritor vuelve a él. El modo es una preferencia; estar abierto o cerrado es de cada ventana y no se guarda.
- **Arrastrar sin perder el teclado** — dnd-kit mueve los documentos con el puntero desde toda la fila y con el teclado desde un asa (Espacio, flechas, Espacio), con avisos en español para lectores de pantalla. El índice muestra el nuevo orden mientras se arrastra y solo al soltar se lo comunica al núcleo.
- **Eliminar: confirmar, deshacer y papelera** — se confirma en la propia fila, un aviso ofrece deshacer durante 8 segundos y después lo eliminado sigue en la papelera, al pie del índice, para restaurarlo.
- **Nada pendiente se pierde al cambiar de documento** — lo escrito en el último momento espera la pausa para guardarse; cambiar de documento, enviarlo a la papelera o cerrar el proyecto lo guardan antes.
- **Guardar al cerrar la ventana** — la ventana espera a que se guarde lo pendiente y solo entonces se cierra; para eso puede destruirse a sí misma (permiso `core:window:allow-destroy`). Un guardado que falla no se descarta: se reintenta a los 5 segundos o con la siguiente tecla, siempre con el texto más reciente.
- **El contador habla poco** — una línea abajo a la derecha (palabras del documento y de la obra) que se despliega en una tabla al pasar el ratón o al pulsarla. Se atenúa mientras se escribe y vuelve un momento después, solo con CSS. Del guardado solo dice algo si tarda más de un segundo o si falla; un fallo se ve aunque el contador esté oculto. La obra son los capítulos: los fragmentos y la papelera no cuentan.
- **Versiones en una hoja a la derecha** — el índice queda a la izquierda y las versiones a la derecha, con F6 (la primera tecla F asignada) y Ctrl+S, que por costumbre guarda una versión con nombre. Una versión se ve en lugar de la página, sin desmontar el editor, así que al volver el texto sigue como estaba.
- **Comparar como correcciones a lápiz** — se compara palabra por palabra el texto de lectura (párrafos y títulos, separadores como «* * *» y notas al pie entre corchetes) con jsdiff: lo añadido después, subrayado; lo quitado, tachado en rúbrica. El formato no entra en la comparación; para verlo, la versión se lee tal cual con el editor en solo lectura.
- **Restaurar nunca pierde** — se confirma, se guarda antes lo pendiente y el núcleo guarda el texto de ese momento como versión «Antes de restaurar», desde la que se puede volver.
- **Un solo registro** — el núcleo escribe con Serilog en `logs/rocinante-AAAAMMDD.log`, dentro de la carpeta de datos de la app: un archivo por día, 5 MB como mucho y dos semanas guardadas. La interfaz y el anfitrión escriben en él a través del núcleo (`diagnostics.report`, protocolo v4), marcados como `interface` o `host`. Cada línea va a disco al momento, para que una caída no se lleve las últimas.
- **Nunca el texto de la obra** — los errores dicen qué falló y dónde. Antes de enviar uno, la interfaz quita todo lo que va entre comillas (los editores citan el contenido con el que tropiezan) y recorta mensaje y traza. El núcleo ya solo registra identificadores, rutas y códigos.
- **El núcleo se levanta solo** — si el proceso cae, el anfitrión responde a las peticiones que esperaban con `CoreUnavailable`, arranca otro núcleo y avisa a las ventanas (`core://restarted`): la primera en pedirlo reabre el proyecto con `app.start` y cada una guarda lo pendiente. Lo escrito sigue en el editor mientras tanto. Si cae más de tres veces en un minuto se deja de intentar (`core://failed`): la ventana lo dice sobre la página, que sigue ahí para copiar lo que no se haya guardado, y lo que el anfitrión no pudo registrar va a `logs/rocinante-host.log`.
- **Una ventana en blanco se recarga una vez** — en desarrollo, tras matar la app, WebView2 a veces no carga un módulo y la interfaz no llega a arrancar. Un guion pequeño (`public/boot-check.js`) recarga una sola vez la ventana que sigue vacía a los 5 segundos, y la interfaz lo anota en el registro. Una ventana que se rompe al dibujarse muestra una salida (volver a cargar, abrir la carpeta de registros) en lugar de quedarse en blanco.
- **Bibliotecas de la interfaz:** Vite (empaquetado), Zustand (estado global), dnd-kit (arrastrar en el índice), jsdiff (comparar versiones), Fontsource (EB Garamond empaquetada, OFL) y el plugin de diálogos de Tauri (abrir archivo y elegir carpeta con los diálogos del sistema). Para los tests, Testing Library sobre jsdom. Todas MIT, BSD u OFL, ligeras y maduras.
- **Pruebas E2E sin Tauri** — Playwright no controla bien la ventana nativa en los tres sistemas. Las pruebas E2E cargan la interfaz en un navegador con un relé de pruebas (Node) que habla con el **sidecar real**. Así se prueban interfaz y núcleo de verdad; el relé Rust tiene sus propios tests y una prueba de humo.
- **El navegador de las pruebas es el del sistema** — Playwright usa Edge en Windows (el mismo motor que WebView2) y Chrome en macOS y Linux, que ya están instalados en las máquinas de CI: no se descarga ningún navegador. Un guion (`tests/e2e/support/tauri-shim.js`) ocupa el lugar de Tauri en la página: las peticiones van al relé, las notificaciones llegan por eventos del servidor y los diálogos del sistema responden lo que la prueba elige. La interfaz no cambia para probarse.
- **Escribir sin pausa también guarda** — el guardado espera una pausa de 300 ms, pero nunca más de un segundo desde el primer cambio sin guardar. Quien escribe sin parar pierde, si todo se corta, menos de dos segundos. Lo comprueba la prueba de cierre forzado, que mata núcleo y ventana a la vez y revisa el archivo con `PRAGMA integrity_check`.
- **«Sin retraso» es p95 < 50 ms** — la prueba de rendimiento escribe en mitad de un capítulo de 20 000 palabras, dentro de una obra de 150 000, y mide cada pulsación desde que ocurre hasta el fotograma siguiente. En Windows: mediana de unos 3 ms y p95 de unos 6 ms.
- **Un solo paquete de interfaz** — la app lee su código del disco, no de la red, así que el paquete de TipTap y React (unos 800 kB) no se divide. El aviso de Vite sube a 1000 kB para que un crecimiento grande se siga notando.

## Riesgos

- **Rust nuevo para el autor** — se limita al relé y a la configuración de ventanas; cada pieza de Rust se documenta y tiene tests.
- **Cursor de bloque** — los navegadores no permiten cambiar la forma del cursor de texto, así que hay que dibujarlo como una capa propia sincronizada con la selección. Se intenta con un tiempo acotado en el paso 9. Si da problemas (saltos, retraso, fallos con IME o en algún sistema), se deja el cursor normal y **se avisa al autor**, que decide. El desplazamiento tipo rodillo es independiente y no tiene este riesgo.
- **Notas al pie** — no hay una extensión MIT madura en TipTap. Se construye una propia: una marca en el texto con su contenido asociado, numeración automática.
- **Webviews distintos por sistema** (WebView2 en Windows, WebKit en macOS y Linux) — diferencias de rendimiento y de tipografía. CI en los tres sistemas desde el paso 2, y la prueba de rendimiento se ejecuta en todos.
- **Doble clic en el archivo** — que el sistema operativo asocie `.rocinante` con la app requiere instalarla, y los instaladores son la feature 012. En la 001 se implementa la apertura de un archivo recibido como argumento; la asociación se registra y prueba con un instalador de desarrollo, y su forma definitiva queda en la 012.
- **Corrupción del archivo** — modo WAL con `synchronous = FULL` (cada guardado llega a disco antes de confirmarse), transacciones en toda escritura, prueba automatizada de cierre forzado y comprobación de integridad al abrir. Un archivo que no pasa las comprobaciones no se modifica.
