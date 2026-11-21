# 003 · Modo concentración y ambiente — Tareas

Checklist derivada de [`plan.md`](plan.md). Cada bloque se cierra con sus tests en verde, y con una comprobación en la app real cuando toca la interfaz, antes de pasar al siguiente. Rama: `feature/003-modo-concentracion`.

## 1. Contrato de mensajes (versión 6)
- [x] `Ambience` en `protocol.json`, con estos campos:
  - `background`;
  - `typing { sound, volume, muted }`;
  - `ambients [{ id, level }]`;
  - `ambientVolume` y `ambientMuted`;
  - `dimOthers`;
  - `goal { kind, amount }`.
- [x] `Preferences.ambience` y `PreferencesChange.ambience`.
- [x] `OwnAmbience { id, kind, name }` y `StartState.ownAmbience`.
- [x] `ambience.import` y `ambience.remove`, que difunden `ambience.changed`.
- [x] Motivos de error `notAnImage`, `notASound` y `fileTooLarge`, con sus mensajes en español en `messages.ts`.
- [x] Ejemplos válidos e inválidos de cada método.
- [x] Regenerar los tipos de TypeScript y subir `protocolVersion` a 6.

## 2. Preferencias de ambiente en el núcleo
- [x] `Ambience` en `Rocinante.Application/Settings`, con sus límites:
  - volúmenes y niveles de 0 a 1;
  - ningún ambiente repetido;
  - como mucho 6 a la vez;
  - meta de 50 a 50 000 palabras o de 5 a 600 minutos;
  - identificadores `builtin:<nombre>` u `own:<uuid>`.
- [x] `Ambience.Default`, que forma parte de `Preferences.Default`.
- [x] `JsonSettingsStore` lee el ambiente campo a campo. Un valor inválido vuelve al de por defecto sin perder el resto.
- [x] `preferences.update` con `ambience`. El escenario `WritingSession` lo usa.
- [x] Tests del núcleo: límites, ida y vuelta, valores rotos en el archivo y un `settings.json` de la 002 sin ambiente.

## 3. Fondos y sonidos propios en el núcleo
- [x] `AmbienceUseCases.Import(path, kind)`:
  - comprueba la firma del archivo: PNG, JPEG o WebP para imágenes; Ogg, MP3, WAV o FLAC para sonidos;
  - comprueba el tamaño: 30 MB por imagen y 100 MB por sonido;
  - hace una copia atómica en `<datos>/ambience/<uuid>.<ext>`.
- [x] La lista de los propios se guarda en `settings.json`, con el nombre del archivo original.
- [x] `Remove(id)` borra la copia y deja de usarla en las preferencias.
- [x] Al arrancar se limpia:
  - se quitan de la lista las copias que faltan;
  - se borran los archivos huérfanos.
- [x] Ningún registro lleva el nombre ni la ruta de los archivos del escritor.
- [x] Métodos JSON-RPC y notificación `ambience.changed`. El escenario de contrato los usa.
- [x] Tests:
  - firmas válidas y falsas;
  - archivos demasiado grandes;
  - original borrado tras importar;
  - quitar un propio que estaba en uso;
  - limpieza al arrancar.

## 4. Host
- [x] Permiso `core:window:allow-set-fullscreen` en `capabilities/default.json`.
- [x] Protocolo propio `ambience://` en el host: sirve solo las copias de la carpeta `ambience` por su nombre exacto (`<uuid>.<ext>`). Sustituye al protocolo `asset` de Tauri, cuya regla de rutas fallaba en Windows con archivos ya existentes (bloque 11).
- [x] Relay de pruebas: servir `/ambience/` desde la carpeta de datos; `convertFileSrc` en el shim.
- [x] `cargo fmt`, `clippy` y `test` en verde.

## 5. Modo concentración
- [x] `features/focus`: F11 entra y sale; Esc sale, salvo con un menú del editor abierto, que se cierra primero.
- [x] Botón en la barra de la obra para entrar.
- [x] Pantalla completa con la ventana. Se esconden el índice, la barra y las hojas, en la misma vista y con el mismo editor.
- [x] Salir de la pantalla completa desde el sistema también sale del modo.
- [x] Barra mínima:
  - aparece con el ratón en el borde superior;
  - se esconde al escribir y tras unos segundos sin el ratón encima;
  - muestra el contador y tiene un botón para salir.
- [x] Al salir, el cursor y el desplazamiento siguen donde estaban.
- [x] Atajo F11 en `features/focus/shortcuts.ts`. En el modo, F5, F6 y el índice no abren nada, y Ctrl+S guarda una versión sin abrir la hoja.
- [x] Tests de comportamiento y comprobación en la app real.

## 6. Fondos fijos y hoja translúcida
- [x] Catálogo `features/ambience/catalog.ts`: el papel y cinco colores y degradados, cada uno con su versión de noche. Las imágenes incluidas llegan en el bloque 12; las propias, en el 11.
- [x] Hoja translúcida por tema. Un test de Vitest comprueba el contraste WCAG AA sobre fondo blanco y sobre fondo negro.
- [x] Un identificador que ya no existe se muestra como el fondo por defecto.
- [x] Panel «Ambiente» en una hoja a la derecha, abierto desde la barra de la obra y desde la barra mínima. Solo hay una hoja abierta a la vez.
- [x] Tests de comportamiento y comprobación en la app real con los dos temas.

## 7. Fondos animados
- [x] Lluvia en un cristal, vela y nubes en `canvas`, a 30 fotogramas por segundo como mucho.
- [x] El dibujo es una función pura de estado y tiempo, con tests sin navegador.
- [x] Se pausan con la ventana oculta.
- [x] Con `prefers-reduced-motion: reduce` se quedan quietos.
- [x] Comprobación en la app real: escribir con un fondo animado sigue siendo fluido.

## 8. Motor de sonido y tecleo
- [x] `src/ui/src/audio`:
  - un `AudioContext` único, creado cuando el tecleo empieza a sonar y activado con la primera pulsación;
  - una cadena de ganancias para el tecleo y otra para los ambientes.
- [x] Plugin de ProseMirror que hace sonar el tecleo con texto, Intro y borrar; los atajos, las flechas y las teclas muertas no suenan.
- [x] Varias muestras por tecleo, elegidas al azar, con una pequeña variación de tono.
- [x] La máquina de escribir suena a retorno de carro con Intro y tiene su campanilla.
- [x] Muestras de prueba generadas con ffmpeg (`scripts/placeholder-sounds.mjs`) hasta el bloque 12.
- [x] El panel «Ambiente» elige el tecleo, su volumen y su silencio.
- [x] Tests con un `AudioContext` falso: qué pulsaciones suenan y con qué volumen.

## 9. Ambientes de fondo
- [x] Bucle con fundido cruzado de dos copias del buffer.
- [x] Mezcla de varios ambientes, cada uno con su nivel.
- [x] Volumen general y silencio, con rampas de 100 ms.
- [x] Los sonidos paran con un fundido al cerrar la obra. Solo suenan en la ventana principal: cada ventana tiene su propio audio, y dos tocarían la lluvia dos veces.
- [x] El panel «Ambiente» muestra cada ambiente con su nivel.
- [x] Tests con un `AudioContext` falso y comprobación de oído en la app real.

## 10. Atenuar el resto y meta de la sesión
- [x] Decoración de ProseMirror en el bloque del cursor; el CSS atenúa el resto solo en el modo concentración.
- [x] Meta de palabras nuevas, sin bajar de cero al borrar, o de minutos en el modo con la ventana visible.
- [x] Progreso en la barra mínima y aviso discreto al cumplirla.
- [x] La meta se elige en el panel «Ambiente».
- [x] Tests de comportamiento: cuenta de palabras, de minutos con un reloj falso y aviso.

## 11. Fondos y sonidos propios en la interfaz
- [x] «Añadir imagen» y «Añadir sonido» con el diálogo del sistema, con los filtros de tipo; la ruta va a `ambience.import`.
- [x] Los propios aparecen en el panel con su nombre y un botón para quitarlos.
- [x] Errores con su mensaje en español. Un sonido que no se puede decodificar se avisa y no suena.
- [x] Tests de comportamiento y comprobación en la app real con una imagen y un sonido propios.

## 12. Fondos y sonidos incluidos
- [x] Proponer al autor una lista CC0, con enlace, autor, licencia y tamaño de cada archivo. **Descargar solo lo aprobado.**
  - 3 tecleos: máquina de escribir, teclado mecánico y lápiz (no hay grabación CC0 de pluma);
  - 4 ambientes: lluvia, chimenea, café y campo;
  - las imágenes de los fondos.
- [x] `scripts/ambience.mjs` con ffmpeg:
  - recorta y normaliza el volumen;
  - convierte los ambientes a Opus (1–2 min), los tecleos a muestras cortas y las imágenes a WebP de 2560 px.
- [x] Al repo solo suben los archivos convertidos.
- [x] Créditos en `features/ambience/credits.ts` y `licenses/ambience.txt` generado por un plugin de Vite.
- [x] Test: cada entrada tiene su archivo y sus créditos, y el total no pasa de 15 MB.
- [x] Comprobar que Opus se decodifica en WebView2.
- [ ] Revisar la CI de macOS y de Linux (ver Riesgos del plan).
- [ ] Café: grabación CC0 de Freesound, que pide cuenta para descargar (lo descarga el autor).
- [ ] Imágenes: tres paisajes de Beruete en dominio público; Wikimedia limitó la descarga automática (lo descarga el autor).

## 13. Pruebas de extremo a extremo y rendimiento
- [ ] El recorrido completo:
  - F11;
  - elegir fondo y ambiente;
  - escribir con tecleo;
  - Esc;
  - cerrar y abrir la app con todo recordado.
- [ ] Importar un fondo propio, borrar el original y comprobar que sigue.
- [ ] Escribir con tecleo y fondo animado: p95 < 50 ms, o 150 ms en la CI de macOS.
- [ ] El tecleo se programa en menos de 20 ms desde la pulsación, medido con un `AudioContext` instrumentado.
- [ ] Todo en verde en los tres sistemas en la CI.

## 14. Validación y cierre
- [ ] Repasar los criterios de `spec.md` y marcar solo lo comprobado.
- [ ] `tech-stack.md`: audio, protocolo `ambience://` y créditos del material incluido.
- [ ] Pull request a `main` con la CI en verde.
- [ ] Hoja de ruta: la 003 pasa a «Hecho» al fusionar.
