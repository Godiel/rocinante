# 002 · Hoja de escritura — Plan

Cómo se implementa lo descrito en [`spec.md`](spec.md). Respeta la [constitución](../../constitution/tech-stack.md) y se apoya en la arquitectura de la [feature 001](../001-proyecto-editor-base/plan.md).

## Enfoque

El formato es un **dato de la obra** y sigue el mismo camino que todo lo demás. Se define en el contrato, el dominio lo valida, se guarda en el archivo con su migración y el núcleo lo anuncia a las ventanas. La interfaz solo lo aplica.

El trabajo se divide en dos partes:

- **Aplicar el formato al texto** (tipografía, cuerpo, interlineado, párrafos y capitular). Es casi todo CSS, con variables que salen del formato de la obra.
- **La vista de página**, que necesita un **paginador propio**. El paginador mide el texto en el propio navegador y lo reparte en hojas. Es la pieza difícil y se diseña para poder probarla sin navegador.

## Arquitectura de la feature

```
 Panel de formato / paso de formato al crear
        │  project.setFormat / project.create { format }
 Núcleo .NET ── valida WorkFormat ── tabla work_format (.rocinante)
        │          └─ settings.json: lastFormat (la sugerencia para la próxima obra)
        │  project.changed (todas las ventanas)
 Interfaz ── variables CSS del texto (papel continuo)
        └── vista de página: project.manuscript → paginador → hojas visibles
```

- **El formato guarda medidas explícitas.** Ancho y alto de hoja y los cuatro márgenes, en milímetros, más el nombre del tamaño (`a5`, `custom`…). Las medidas de cada tamaño de lista viven en la interfaz, que es donde se eligen. El núcleo no las repite: valida números, no catálogos. Una obra no cambia de aspecto si un día se ajustan los márgenes propuestos.
- **El paginador separa calcular de dibujar.**
  - `layout` recibe bloques, medidas y un medidor, y devuelve páginas como datos: qué trozo de qué bloque va en cada hoja y qué notas al pie lleva.
  - El medidor real usa el DOM: alto de cada bloque y cortes de línea con `Range.getClientRects`. En los tests se cambia por uno falso, así que el reparto (páginas nuevas por capítulo, viudas y huérfanas, notas al pie) se prueba en Vitest sin navegador.
  - Solo se dibujan las hojas que están a la vista (virtualización).

## Implementación

1. **Contrato (versión 5)** — `src/contracts`.
   - `WorkFormat`: tamaño, ancho y alto, márgenes, tipografía, cuerpo, interlineado, sangría, justificado y capitular.
   - `ProjectState.format` y `StartState.suggestedFormat`.
   - `project.create` acepta `format` (opcional; sin él se usa la sugerencia).
   - `project.setFormat`, que difunde `project.changed`.
   - `project.manuscript`, que devuelve los capítulos en orden con su texto, en una sola petición, para la vista de página.
   - Ejemplos válidos e inválidos de cada método.
2. **Dominio** — `Rocinante.Domain/Formats`.
   - `WorkFormat` como objeto de valor con sus límites:
     - hoja entre 70 y 300 mm por lado;
     - márgenes ≥ 0;
     - caja de texto de al menos 40 × 60 mm;
     - cuerpo de 8 a 16 pt;
     - interlineado de 1,0 a 2,0.
   - `WorkFormat.Default`: A5, EB Garamond 11 pt, interlineado 1,35, sangría, justificado y sin capitular.
   - Un formato que incumple un límite se rechaza con `DomainError` y un motivo del contrato.
3. **Persistencia** — `Rocinante.Infrastructure/Persistence`.
   - Migración `0002-work-format.sql`: tabla `work_format` `STRICT` de una sola fila, con una columna por ajuste y sus `CHECK`.
   - Las obras de la 001 reciben el formato por defecto en la propia migración.
   - `docs/format` documenta la versión 2 del esquema.
4. **Casos de uso y ajustes del escritor** — `Rocinante.Application`.
   - `ProjectUseCases`: crear con formato, `SetFormat` y `Manuscript`.
   - `WriterSettings.LastFormat` en `settings.json` se actualiza al crear una obra o al cambiar su formato, y llega a la interfaz como `suggestedFormat`.
5. **Tipografías** — `src/ui/src/design`.
   - Fontsource de Literata, Crimson Pro, Source Serif 4, Libre Baskerville y Courier Prime, más los pesos que faltan de EB Garamond. Solo los subconjuntos latino y latino extendido, en 400, 400 cursiva, 700 y 700 cursiva. Hoy la negrita se sintetiza porque falta el peso 700.
   - `design/typefaces.ts` es la única lista de tipografías: nombre visible, familia CSS y pesos.
   - Los textos de la licencia OFL se incluyen con la app.
6. **El formato en el papel continuo** — `features/editor`.
   - El formato de la obra se convierte en variables CSS (`--work-font`, `--work-size`, `--work-leading`, `--work-indent`, `--work-align`) en la vista de escritura.
   - La sangría sigue la convención de libro: no se sangra el primer párrafo tras un título o un separador.
   - La capitular usa `initial-letter`, con un respaldo flotante donde no exista.
   - Se comprueba cómo parte palabras `hyphens: auto` en WebView2 y WebKit (ver Riesgos).
7. **Panel de formato** — `features/format`.
   - Hoja a la derecha, como la de versiones (solo una hoja abierta a la vez), con un botón «Formato» en la barra.
   - Campos agrupados: hoja y márgenes, letra, párrafos.
   - Cada cambio se envía al momento y el texto lo refleja; los valores imposibles se marcan en el propio campo.
   - Tamaño a medida en cm o pulgadas; internamente siempre milímetros.
8. **Paso de formato al crear** — `features/welcome`.
   - Tras el título, el mismo formulario del panel, relleno con `suggestedFormat`.
   - «Crear con este formato» y «Omitir». Omitir crea la obra con la sugerencia tal cual.
9. **Paginador** — `features/pages/layout.ts`.
   - `layout(blocks, format, measure)` hace lo siguiente:
     - empieza cada capítulo en página nueva;
     - si un bloque no cabe, lo corta por líneas y evita dejar una sola línea a cada lado del corte (viudas y huérfanas);
     - nunca deja un título solo al pie;
     - reserva el sitio de cada nota al pie en la página de su llamada, y continúa la nota en la siguiente si no cabe entera.
   - El resultado guarda las posiciones de ProseMirror de cada trozo, para encontrar la página de cualquier punto del texto.
   - Tests con un medidor falso.
10. **Vista de página** — `features/pages`.
    - F5 y un botón de la barra la abren y la cierran; Escape también la cierra.
    - Se pide `project.manuscript` y se genera el HTML de cada capítulo con las mismas extensiones del editor. Así se ve igual, pero sin poder escribir y sin las anclas de las notas del autor.
    - Las hojas se dibujan a tamaño real en milímetros, escaladas para caber en la ventana, una o dos enfrentadas.
    - Solo se dibujan las que están a la vista. Se abre en la página del cursor y, al cerrarla, el papel continuo sigue donde estaba.
11. **Pruebas de extremo a extremo y rendimiento** — `tests/e2e`.
    - Elegir un formato al crear una obra, reabrirla, verlo en el texto y en la vista de página.
    - La vista de página de una obra de 150 000 palabras se abre en menos de 2 s.
    - Escribir con el formato aplicado sigue con p95 < 50 ms.
12. **Validación y cierre.**
    - Criterios de `spec.md`.
    - `tech-stack.md` (tipografías y esquema).
    - ADR del paginador.
    - Pull request a `main` con la CI en verde.
    - Hoja de ruta.

## Decisiones

- **Paginador propio** — Paged.js (MIT) implementa el estándar de medios paginados, pero su última versión es de 2023 y con libros largos tarda varios segundos. Uno propio cumple los 2 s porque mide por bloques y solo corta por líneas en los límites de página. También coloca las notas al pie como queremos y servirá de base para el PDF de la exportación (011). Se registra en un ADR.
- **Vista solo para revisar** — la paginación se calcula sobre HTML estático, no sobre el editor. El editor no paga el coste de paginar al teclear, y la edición paginada queda en el backlog.
- **Medidas en milímetros y cuerpo en puntos** — son las unidades de imprenta y las que entiende CSS (`mm`, `pt`). Centímetros y pulgadas son solo cómo se escriben en el formulario.
- **El formato es una fila, no un JSON** — una tabla `STRICT` con una columna por ajuste deja que SQLite rechace valores imposibles y que cualquiera lea el formato con una herramienta de SQLite, como el resto del archivo.
- **La sugerencia es del escritor, el formato de la obra** — `lastFormat` vive en `settings.json` porque es una costumbre de quien escribe; el formato elegido se guarda dentro de la obra.
- **Por defecto, A5 de novela** — A5 con márgenes de imprenta, EB Garamond de 11 pt, interlineado 1,35, sangría, justificado y sin capitular, como pidió el autor.
- **La interfaz no cambia de letra** — menús y paneles siguen en EB Garamond; el formato solo toca el texto de la obra.

## Riesgos

- **Partición de palabras en WebView2** — `hyphens: auto` en español depende de diccionarios que WebView2 quizá no trae sin conexión. Sin partir palabras, el justificado deja huecos grandes. Se comprueba al empezar el paso 6, en Windows, macOS y Linux. Si falla, se buscan patrones de partición con licencia compatible y se consulta al autor antes de añadirlos.
- **Rendimiento del paginador** — 150 000 palabras son unas 500 páginas A5. Las medidas se hacen por lotes en un contenedor fuera de pantalla, con un solo cálculo de diseño por lote, y solo se dibujan las hojas visibles. La prueba de rendimiento lo vigila en la CI.
- **Notas al pie largas** — una nota que no cabe en su página continúa en la siguiente. Es la convención de imprenta, pero complica el reparto. Se cubre con tests del paginador con el medidor falso.
- **Diferencias entre motores** — WebView2 y WebKit miden el texto de forma un poco distinta, así que el número de páginas puede variar entre sistemas. La vista es una revisión, no la maqueta final: la exportación (011) fijará el resultado.
- **Tamaño de la app** — cinco familias nuevas, con cuatro estilos y dos subconjuntos cada una, suman unos 2–3 MB de woff2. Es aceptable en escritorio, y se cargan solo los subconjuntos latinos.
