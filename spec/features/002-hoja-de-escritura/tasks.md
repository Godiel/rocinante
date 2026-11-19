# 002 · Hoja de escritura — Tareas

Checklist derivada de [`plan.md`](plan.md). Cada bloque se cierra con sus tests en verde, y con una comprobación en la app real cuando toca la interfaz, antes de pasar al siguiente. Rama: `feature/002-hoja-de-escritura`.

## 1. Contrato de mensajes (versión 5)
- [ ] `WorkFormat` en `protocol.json`: tamaño (`pocket`, `a5`, `digest`, `trade`, `a4`, `letter`, `custom`), ancho y alto, cuatro márgenes, tipografía, cuerpo, interlineado, sangría, justificado y capitular.
- [ ] `ProjectState.format`, `StartState.suggestedFormat` y `format` opcional en `project.create`.
- [ ] `project.setFormat` (difunde `project.changed`) y `project.manuscript` (capítulos en orden con su texto).
- [ ] Motivos de error nuevos para un formato imposible; ejemplos válidos e inválidos de cada método.
- [ ] Regenerar los tipos de TypeScript y subir `protocolVersion` a 5.

## 2. Dominio
- [ ] `WorkFormat` en `Rocinante.Domain/Formats`, con sus límites: hoja de 70 a 300 mm, márgenes ≥ 0, caja de texto mínima de 40 × 60 mm, cuerpo de 8 a 16 pt e interlineado de 1,0 a 2,0.
- [ ] `WorkFormat.Default`: A5 de novela.
- [ ] `Project` lleva su formato; cambiarlo valida antes de aceptar.
- [ ] Tests del dominio, con cobertura ≥ 80 %.

## 3. Persistencia
- [ ] Migración `0002-work-format.sql`: tabla `work_format` `STRICT` de una fila, con `CHECK` por columna.
- [ ] Las obras creadas con la 001 reciben el formato por defecto al migrar, sin perder nada.
- [ ] Leer y guardar el formato en `ProjectRepository`; `Manuscript` en `DocumentRepository`.
- [ ] Tests: migración de un archivo de la versión 1, ida y vuelta del formato y rechazo de valores imposibles.
- [ ] `docs/format`: versión 2 del esquema.

## 4. Casos de uso y ajustes del escritor
- [ ] `ProjectUseCases`: crear con formato (o con la sugerencia), `SetFormat` y `Manuscript`.
- [ ] `WriterSettings.LastFormat` en `settings.json`, actualizado al crear o cambiar el formato; `suggestedFormat` en `app.start`.
- [ ] Métodos JSON-RPC y notificaciones; el escenario `WritingSession` de las pruebas de contrato los usa todos.

## 5. Tipografías
- [ ] Añadir Fontsource de Literata, Crimson Pro, Source Serif 4, Libre Baskerville y Courier Prime, y EB Garamond 700. Solo los subconjuntos latino y latino extendido, en 400, 400 cursiva, 700 y 700 cursiva.
- [ ] `design/typefaces.ts` como lista única de tipografías.
- [ ] Incluir los textos de la licencia OFL con la app.
- [ ] Comprobar que las seis se ven sin internet y medir cuánto crece la app.

## 6. El formato en el papel continuo
- [ ] Comprobar `hyphens: auto` en español en WebView2 y WebKit. **Si no parte palabras, consultar al autor** antes de añadir patrones.
- [ ] Variables CSS del formato en la vista de escritura: letra, cuerpo, interlineado, sangría y justificado.
- [ ] Sangría al estilo de libro: no se sangra el primer párrafo tras un título o un separador.
- [ ] Capitular con `initial-letter` y respaldo flotante.
- [ ] La columna conserva su ancho de 60–75 caracteres con cualquier cuerpo.
- [ ] Tests de comportamiento y comprobación en la app real con las seis tipografías y los dos temas.

## 7. Panel de formato
- [ ] Hoja a la derecha con botón «Formato» en la barra; solo una hoja abierta a la vez (formato o versiones).
- [ ] Grupos: hoja y márgenes (lista o a medida, cm o pulgadas), letra (tipografía, cuerpo, interlineado), párrafos (sangría, justificado, capitular).
- [ ] Cada cambio se envía y se ve al momento; los valores imposibles se marcan en su campo con un mensaje en español.
- [ ] Elegir un tamaño de lista propone sus márgenes.
- [ ] Accesible con teclado y lector de pantalla; tests de comportamiento.

## 8. Paso de formato al crear
- [ ] Tras el título, el formulario del panel relleno con `suggestedFormat`.
- [ ] «Crear con este formato» y «Omitir».
- [ ] Tests de comportamiento.

## 9. Paginador
- [ ] `features/pages/layout.ts`: `layout(blocks, format, measure)` devuelve páginas como datos, con las posiciones de ProseMirror de cada trozo.
- [ ] Capítulo en página nueva, título del capítulo más abajo, ningún título solo al pie, viudas y huérfanas.
- [ ] Notas al pie al pie de la página de su llamada, que continúan en la siguiente si no caben.
- [ ] Medidor real con el DOM (alto por bloques, cortes de línea con `Range.getClientRects`) en un contenedor fuera de pantalla.
- [ ] Tests del reparto con un medidor falso.
- [ ] ADR del paginador propio.

## 10. Vista de página
- [ ] F5, botón de la barra y Escape la abren o la cierran.
- [ ] `project.manuscript` → HTML estático con las extensiones del editor, sin las anclas de las notas del autor.
- [ ] Hojas a tamaño real en milímetros, escaladas a la ventana; una página o dos enfrentadas.
- [ ] Números de página; solo se dibujan las hojas visibles.
- [ ] Se abre en la página del cursor; al cerrarla, el papel continuo sigue donde estaba.
- [ ] Tests de comportamiento y comprobación en la app real.

## 11. Pruebas de extremo a extremo y rendimiento
- [ ] E2E: elegir un formato al crear una obra, reabrirla y verlo en el texto y en la vista de página.
- [ ] Rendimiento: la vista de página de una obra de 150 000 palabras se abre en menos de 2 s.
- [ ] Rendimiento: escribir con el formato aplicado sigue con p95 < 50 ms.

## 12. Cierre
- [ ] `tech-stack.md`: tipografías incluidas y esquema versión 2.
- [ ] Validar contra los criterios de aceptación de [`spec.md`](spec.md) y marcarlos.
- [ ] Pull request a `main` con CI en verde.
- [ ] Mover la feature a «Hecho» en [`roadmap.md`](../../constitution/roadmap.md).
