# 001 · Proyecto y editor base — Tareas

Checklist derivada de [`plan.md`](plan.md). Cada bloque se cierra con sus tests en verde antes de pasar al siguiente. Rama: `feature/001-proyecto-editor-base`.

## 0. Entorno
- [x] Instalar Rust con `rustup` (con permiso del autor) y comprobar `cargo`, `rustc`, `rustfmt` y `clippy`.
- [x] Comprobar .NET 10 SDK, Node 24 y las herramientas C++ de Visual Studio.
- [x] `git init` local y rama `feature/001-proyecto-editor-base` (sin remoto hasta que el autor lo indique).

## 1. Esqueleto andante (punto de decisión)
- [x] Crear `src/host` (Tauri 2) y `src/ui` (React + TypeScript + Vite) y comprobar que la ventana arranca.
- [x] Crear `src/core/Rocinante.Sidecar` con un servidor JSON-RPC por stdio que responde a `ping`.
- [x] Relé en Rust: arrancar el sidecar, enrutar peticiones por `id` y difundir notificaciones a todas las ventanas.
- [x] Editor TipTap mínimo; abrir una segunda ventana; lo escrito en una aparece en la otra pasando por el núcleo y SQLite.
- [x] Medir latencia de ida y vuelta, memoria y tamaño del sidecar publicado; anotar resultados en un ADR.
- [x] **Revisar con el autor** los resultados antes de seguir.

## 2. Cimientos del repositorio
- [x] `.editorconfig`, `Directory.Build.props` (nullable, advertencias como errores) y analizadores .NET.
- [x] oxlint, Prettier y TypeScript estricto en `src/ui`; `rustfmt` y Clippy en `src/host`.
- [x] Workflow de CI: compilar, formatear, analizar y probar en Windows, macOS y Linux.
- [x] `LICENSE` (MIT), `README.md` y `CONTRIBUTING.md` en español.
- [x] ADR iniciales en `docs/adr/`: arquitectura en tres capas, Tauri + sidecar, React, TipTap, SQLite, licencias.

## 3. Contrato de mensajes
- [x] Definir en `src/contracts` el sobre JSON-RPC y la versión del protocolo.
- [x] Esquemas de los métodos y notificaciones existentes (`system.*`, `document.*` del esqueleto). Los de proyecto, documentos, versiones y notas se añaden al contrato junto a su caso de uso en el bloque 6, siempre antes que el código.
- [x] Generar tipos TypeScript desde los esquemas (`npm run contracts:generate`; CI comprueba que estén al día).
- [x] Validar en el núcleo los mensajes entrantes contra los esquemas.
- [x] Pruebas de contrato en TypeScript y en C#, con ejemplos compartidos en `src/contracts/examples/`.

## 4. Dominio
- [ ] `Project`, `Document` (`Chapter` / `Fragment`), `DocumentVersion` y `Note`.
- [ ] Reglas: orden de capítulos, conversión fragmento ↔ capítulo, eliminación recuperable.
- [ ] Reglas de versiones: automática cada 10 min de escritura con cambios, manual con nombre, restaurar guarda antes lo actual.
- [ ] Reglas de notas: anclada o suelta; pasa a suelta si desaparece su pasaje.
- [ ] Tests del dominio con cobertura ≥ 80 %.

## 5. Persistencia
- [ ] Esquema SQLite v1: `meta`, `project`, `document`, `document_version`, `note`.
- [ ] Sistema de migraciones versionado y comprobación de integridad al abrir.
- [ ] Modo WAL y transacciones en toda escritura; identificadores UUID v7.
- [ ] Repositorios con tests contra SQLite real (archivo temporal).
- [ ] Documentar el formato en `docs/format/`.

## 6. Casos de uso y servidor
- [ ] Proyecto: crear, abrir, cerrar, guardar como.
- [ ] Documentos: listar, crear, renombrar, reordenar, convertir, eliminar, restaurar, guardar contenido.
- [ ] Versiones: crear, listar, leer, restaurar.
- [ ] Notas: crear, editar, eliminar, listar por documento.
- [ ] Notificación por cada cambio; tests de cada caso de uso.

## 7. Configuración de la app
- [ ] Proyectos recientes, último proyecto, documento y posición del cursor.
- [ ] Preferencias: tema, índice anclado o flotante, contador visible, desplazamiento tipo rodillo.
- [ ] Abrir un `.rocinante` recibido como argumento al arrancar.

## 8. Base visual
- [ ] Tokens de color de «papel» y «luz de vela», con contraste WCAG AA comprobado.
- [ ] Escalas tipográfica y de espaciado; EB Garamond incluida en la app.
- [ ] Florones y ornamentos en SVG.
- [ ] Pantalla de bienvenida (recientes, nuevo, abrir).

## 9. Editor
- [ ] Papel sin bordes con ancho de columna y márgenes de la constitución.
- [ ] Formato: negrita, cursiva, subrayado, títulos, citas, listas.
- [ ] Extensiones propias: sangría, separador de escena, notas al pie.
- [ ] Notas ancladas: crear en punto o pasaje, marca discreta, ver, editar y eliminar.
- [ ] Menú flotante al seleccionar y atajos de teclado.
- [ ] Desplazamiento tipo rodillo, desactivable.
- [ ] Cursor de máquina de escribir con tiempo acotado; **si da problemas, avisar al autor** antes de descartarlo.
- [ ] Tests de las extensiones propias.

## 10. Índice
- [ ] Vista con capítulos y cajón de fragmentos, anclable o flotante, con atajo para abrir y cerrar.
- [ ] Reordenar arrastrando; crear, renombrar, convertir y eliminar con confirmación y deshacer.

## 11. Guardado automático y contador
- [ ] Guardado tras ≤ 1 s de pausa, al cambiar de documento y al cerrar.
- [ ] Indicador discreto de estado de guardado.
- [ ] Contador de palabras, caracteres, párrafos y capítulos (documento y obra), en una esquina, atenuado al escribir y ocultable.

## 12. Versiones
- [ ] Lista de versiones de un documento; guardar versión manual con nombre.
- [ ] Ver una versión, compararla con la actual y restaurarla.

## 13. Errores y logs
- [ ] Serilog a archivo con rotación en la carpeta de datos de la app.
- [ ] Errores de la interfaz y de Tauri al mismo registro; nunca texto de la obra ni claves.
- [ ] Mensajes de error claros en español; opción para abrir la carpeta de logs.
- [ ] Reinicio automático del sidecar si cae, sin perder lo escrito.

## 14. Pruebas de extremo a extremo y rendimiento
- [ ] Relé de pruebas (Node) que conecta la interfaz en navegador con el sidecar real.
- [ ] E2E: crear proyecto, escribir, cerrar y reabrir.
- [ ] E2E: cierre forzado durante la escritura, pérdida ≤ 2 s y archivo íntegro.
- [ ] Rendimiento: capítulo de 20 000 palabras y obra de 150 000 sin retraso al teclear.

## 15. Cierre
- [ ] Completar en `tech-stack.md` las secciones «Archivos / módulos clave», «Comandos» y el esquema de datos.
- [ ] Validar contra los criterios de aceptación de [`spec.md`](spec.md) y marcarlos.
- [ ] Pull request a `main` con CI en verde.
- [ ] Mover la feature a «Hecho» en [`roadmap.md`](../../constitution/roadmap.md).
