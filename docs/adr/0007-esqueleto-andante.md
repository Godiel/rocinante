# ADR 0007 · Validación del esqueleto andante

- **Estado:** aceptada
- **Fecha:** 2026-11-16
- **Feature:** [001 · Proyecto y editor base](../../spec/features/001-proyecto-editor-base/plan.md), paso 1

## Contexto

La constitución eligió Tauri 2 como anfitrión, con el núcleo .NET 10 como proceso auxiliar (*sidecar*), y React con TipTap para la interfaz. Las dos piezas de más riesgo eran:

1. que varias ventanas compartan el mismo proyecto en vivo, y
2. que el sidecar .NET se comunique con la interfaz de forma rápida y fiable.

Antes de construir el resto se validaron con un esqueleto andante: dos ventanas con un editor TipTap mínimo. Lo escrito en una pasa por el núcleo, se guarda en SQLite y aparece en la otra.

## Qué se construyó

- `src/core/Rocinante.Sidecar` — servidor JSON-RPC 2.0 por stdin/stdout con `system.ping`, `document.get` y `document.save`. Guarda en SQLite (WAL, transacciones) y emite la notificación `document.changed`.
- `src/host` — Tauri 2. Un relé en Rust arranca un único sidecar, asigna un `id` a cada petición, devuelve cada respuesta a quien la pidió y difunde las notificaciones a todas las ventanas.
- `src/ui` — React + TypeScript + TipTap. Guarda tras 300 ms de pausa y aplica los cambios que llegan de otras ventanas.
- `scripts/build-core.mjs` — publica el núcleo como ejecutable autocontenido de un solo archivo para el sistema actual.

## Resultados (Windows 11, x64)

| Medida | Resultado |
|---|---|
| Sincronización ventana A → B | ✅ |
| Sincronización ventana B → A | ✅ |
| Persistencia en SQLite | ✅ (la revisión se conserva entre arranques) |
| Latencia de ida y vuelta interfaz → núcleo → interfaz (50 muestras, compilación de desarrollo) | mediana **1,7 ms**, p95 **2,4 ms** |
| Memoria privada con dos ventanas (modo desarrollo) | **≈ 249 MB** en total: webview 229 MB, núcleo 11 MB, anfitrión 8 MB |
| Tamaño del núcleo publicado (autocontenido y recortado) | **15,8 MB** (74 MB sin recortar) |
| Tamaño del anfitrión (release) | **11,2 MB** |
| Estimación del instalador | ≈ 27 MB sin comprimir, antes de recursos (tipografías, sonidos) |

La latencia queda muy por debajo de lo perceptible (≈ 16 ms es un fotograma). La memoria está dominada por el webview del sistema y es la habitual de cualquier app con interfaz web. Se medirá de nuevo en compilación de producción.

## Problemas encontrados y cómo se resolvieron

1. **El sidecar no se encontraba en desarrollo.** Las versiones recientes de Cargo cambiaron la estructura de su carpeta de compilación (`build/<paquete>/<hash>/out`) y `tauri-build` copia el sidecar un nivel más abajo de lo debido. Se resolvió con una copia explícita en `src/host/build.rs`, documentada. Los instaladores no se ven afectados. Hay que revisarlo cuando `tauri-build` lo corrija.
2. **La segunda ventana no se abría.** En Windows, crear una ventana desde un comando síncrono de Tauri se bloquea. El comando `open_window` es asíncrono.
3. **El núcleo se cerraba al arrancar.** Al publicar en un solo archivo, la librería nativa de SQLite quedaba fuera. Se publica con `IncludeNativeLibrariesForSelfExtract`. Además se activó el recorte (`PublishTrimmed`), que bajó el núcleo de 74 a 15,8 MB.

## Decisión

La arquitectura de la constitución **se confirma**: Tauri 2 + relé Rust + sidecar .NET por stdio + React/TipTap. Se puede continuar con el resto del plan de la feature 001.

## Pendiente (ya previsto en el plan)

- Si el núcleo se cae, el relé debe fallar las peticiones pendientes y reiniciarlo (paso 13). Hoy una petición en curso se quedaría esperando.
- El contrato de mensajes con esquemas y pruebas sustituirá a los mensajes escritos a mano (paso 3).
- Medir en macOS y Linux cuando exista CI (paso 2).
- Repetir las mediciones de memoria y tamaño con compilación de producción e instalador real.
