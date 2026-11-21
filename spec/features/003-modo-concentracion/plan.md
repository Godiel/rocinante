# 003 · Modo concentración y ambiente — Plan

Cómo se implementa lo descrito en [`spec.md`](spec.md). Respeta la [constitución](../../constitution/tech-stack.md) y se apoya en la arquitectura de las features [001](../001-proyecto-editor-base/plan.md) y [002](../002-hoja-de-escritura/plan.md).

## Enfoque

El ambiente es una **preferencia del escritor**, no un dato de la obra. Sigue el camino de las preferencias de la 001:

- Se define en el contrato.
- El núcleo lo valida y lo guarda en `settings.json`.
- El núcleo lo anuncia a las ventanas con `preferences.changed`.

Casi todo el trabajo está en la interfaz, en tres piezas independientes:

- **El modo concentración:** pantalla completa, barra mínima, atenuar el resto y meta de la sesión.
- **Los fondos:** colores e imágenes con CSS, y animados dibujados en un `canvas`.
- **El sonido:** un motor propio sobre Web Audio, con tecleo y ambientes mezclados.

Los fondos y sonidos **propios** son la única parte que toca archivos. Pasan por el núcleo, que los valida y los copia a la carpeta de datos de la app. La interfaz nunca toca el sistema de archivos: solo lee esa carpeta, a través del host.

## Arquitectura de la feature

```
 Barra mínima / panel «Ambiente»
        │  preferences.update { ambience }      ambience.import { path, kind } / ambience.remove
 Núcleo .NET ── valida Ambience ── settings.json
        │          └─ <datos>/ambience/<id>.<ext>  (copias de los propios)
        │  preferences.changed / ambience.changed (todas las ventanas)
 Interfaz ── modo concentración (F11 / Esc) ── pantalla completa (host)
        ├── fondo: CSS (colores, imágenes) o canvas (animados)
        └── motor de sonido (Web Audio): tecleo + ambientes en bucle
                 └─ archivos propios por el protocolo asset del host, solo de <datos>/ambience
```

- **Un solo objeto `Ambience`** en las preferencias:
  - el fondo elegido;
  - el tecleo y su volumen;
  - los ambientes que suenan, cada uno con su nivel, más el volumen general de ambientes;
  - los dos silencios;
  - atenuar el resto;
  - la meta de la sesión.

  Los fondos y ambientes se nombran con un identificador: `builtin:<nombre>` para los incluidos y `own:<uuid>` para los propios.
- **El catálogo de lo incluido vive en la interfaz** (`features/ambience/catalog.ts`). Cada entrada lleva su nombre, su archivo y sus créditos (autor, enlace y licencia). El núcleo no repite el catálogo, igual que con los tamaños de hoja de la 002. Solo comprueba que el identificador tenga una forma válida y que un `own:` exista. Un identificador incluido que ya no existe se trata como «sin fondo» o «sin ambiente».
- **Bucles sin cortes por fundido cruzado.** Cada ambiente se reproduce como dos copias del mismo buffer que se solapan unos segundos al final del bucle. Así no se oye el salto con ningún formato, incluidos los archivos propios del escritor, aunque traigan silencio al principio o al final.
- **El tecleo sale del editor, no del teclado.** Un plugin de ProseMirror hace sonar el tecleo cuando una pulsación cambia el texto: `handleTextInput`, Intro y borrar. Así los atajos, las flechas y la composición de acentos no suenan de más. Cada tecleo tiene varias muestras, y se elige una al azar con una pequeña variación de tono para que no suene mecánico.

## Implementación

1. **Contrato (versión 6)** — `src/contracts`.
   - `Ambience`, con:
     - `background`;
     - `typing { sound, volume, muted }`;
     - `ambients [{ id, level }]`, `ambientVolume` y `ambientMuted`;
     - `dimOthers`;
     - `goal { kind: none | words | minutes, amount }`.
   - `Preferences.ambience` y `PreferencesChange.ambience`. El objeto se cambia entero: es pequeño y evita mezclas a medias.
   - `OwnAmbience { id, kind: image | sound, name }` y `StartState.ownAmbience`.
   - `ambience.import { path, kind, origin }` y `ambience.remove { id, origin }`, que difunden `ambience.changed`.
   - Motivos de error nuevos: `notAnImage`, `notASound` y `fileTooLarge`.
   - Ejemplos válidos e inválidos de cada método. El escenario de `ContractTests` usa los métodos y la notificación nuevos.
2. **Preferencias de ambiente en el núcleo** — `Rocinante.Application/Settings`.
   - `Ambience` como registro con sus límites:
     - volúmenes y niveles de 0 a 1;
     - un mismo ambiente no se repite;
     - como mucho 6 ambientes a la vez;
     - meta de 50 a 50 000 palabras o de 5 a 600 minutos.
   - `Ambience.Default`: hoja de papel, sin fondo especial, sin tecleo, sin ambientes, sin atenuar y sin meta.
   - `JsonSettingsStore` lo lee campo a campo. Un valor que ya no vale vuelve al de por defecto sin perder el resto, como en la 001.
3. **Fondos y sonidos propios en el núcleo** — `Rocinante.Application` e `Infrastructure`.
   - `AmbienceUseCases.Import(path, kind)`:
     - comprueba el tipo por su firma (PNG, JPEG o WebP para imágenes; Ogg, MP3, WAV o FLAC para sonidos), no por la extensión;
     - comprueba el tamaño: hasta 30 MB por imagen y 100 MB por sonido;
     - copia el archivo a `<datos>/ambience/<uuid>.<ext>` con escritura atómica;
     - lo anota en `settings.json` con el nombre del archivo original.
   - `Remove(id)` borra la copia. Si el fondo o algún ambiente elegido lo usaba, las preferencias dejan de usarlo.
   - Al arrancar, las copias que faltan se quitan de la lista y los archivos huérfanos se borran.
   - Los registros nunca llevan el nombre ni la ruta de los archivos del escritor.
4. **Host** — `src/host`.
   - Permiso `core:window:allow-set-fullscreen` para el modo concentración.
   - Protocolo `asset` de Tauri, con el alcance limitado a la carpeta `ambience` de los datos de la app: la interfaz puede leer esas copias y nada más. El host concede ese alcance al arrancar, después de crear la carpeta, porque en Windows la regla escrita en `tauri.conf.json` no coincide con la ruta real.
   - En las pruebas de extremo a extremo, el relay sirve esa carpeta en `/ambience/` y el shim implementa `convertFileSrc`.
5. **Modo concentración** — `features/focus`.
   - F11 entra y sale; Esc sale si el editor no tiene un menú abierto que cerrar; hay un botón en la barra de la obra.
   - Pone la ventana en pantalla completa y esconde el índice, la barra y las hojas. Al salir lo devuelve todo como estaba, con el editor y el cursor intactos: es la misma vista con otra clase, no otro editor.
   - La barra mínima aparece con el ratón en el borde superior y se esconde al escribir o tras unos segundos sin el ratón encima.
   - Si el escritor sale de la pantalla completa con el sistema, también sale del modo.
6. **Fondos fijos y hoja translúcida** — `features/ambience`.
   - Catálogo de fondos con colores y degradados en CSS, e imágenes WebP.
   - La hoja translúcida tiene un color y una opacidad por tema. Se calculan para que el texto cumpla WCAG AA sobre el peor caso: fondo blanco puro y fondo negro puro bajo la hoja. Un test de Vitest lo comprueba con la fórmula de contraste.
   - Panel «Ambiente» en una hoja a la derecha, como las de versiones y formato. Se abre desde la barra de la obra y desde la barra mínima.
7. **Fondos animados** — `features/ambience/animated`.
   - Lluvia en un cristal, vela y nubes, dibujados en un `canvas` sobre un fondo fijo con `requestAnimationFrame`, a 30 fotogramas por segundo como mucho.
   - Se pausan con la ventana oculta y se quedan en su primer fotograma con `prefers-reduced-motion: reduce`.
   - El dibujo de cada fondo es una función pura de un estado y un tiempo, para probarla sin navegador.
8. **Motor de sonido y tecleo** — `src/ui/src/audio`.
   - Un `AudioContext` único que se crea con la primera pulsación del escritor, como exigen los navegadores.
   - Cadena de ganancias: tecleo → volumen de tecleo → salida; cada ambiente → su nivel → volumen de ambientes → salida.
   - Plugin de ProseMirror que hace sonar el tecleo. La máquina de escribir suena a retorno de carro con Intro y tiene una campanilla al acercarse al final de una línea larga.
   - Las muestras se decodifican una vez, al elegir el tecleo, y quedan en memoria.
9. **Ambientes de fondo** — `src/ui/src/audio`.
   - Bucles con fundido cruzado, mezcla de varios ambientes, cambios de nivel suaves (rampas de 100 ms) y silencio.
   - Al cerrar la obra se paran con un fundido corto.
   - El panel «Ambiente» muestra cada ambiente con su nivel y los dos volúmenes.
10. **Atenuar el resto y meta de la sesión** — `features/focus`.
    - Una decoración de ProseMirror marca el bloque del cursor; el CSS atenúa los demás solo en el modo concentración.
    - La meta cuenta las palabras nuevas desde que se entró en el modo, sin bajar de cero si se borra, o los minutos dentro del modo con la ventana visible.
    - El progreso se ve en la barra mínima, y un aviso discreto aparece al cumplirla. La sesión vive solo en la interfaz: no se guarda.
11. **Fondos y sonidos propios en la interfaz** — `features/ambience`.
    - «Añadir imagen» y «Añadir sonido» abren el diálogo del sistema; la ruta va al núcleo con `ambience.import`.
    - Los propios aparecen en el panel junto a los incluidos, con su nombre y un botón para quitarlos.
    - Los errores (`notAnImage`, `notASound`, `fileTooLarge`) se muestran con su mensaje en español.
12. **Fondos y sonidos incluidos** — `src/ui/public/ambience`.
    - Te propongo una lista de grabaciones e imágenes CC0, con enlace, autor, licencia y tamaño. Descargo solo lo que apruebes.
    - Un script (`scripts/ambience.mjs`, con ffmpeg) recorta los originales y los convierte:
      - ambientes de 1–2 min en Opus, unos 1,5 MB cada uno;
      - muestras de tecleo cortas;
      - imágenes WebP de unos 300 KB a 2560 px.
    - Solo se suben al repo los archivos convertidos.
    - El catálogo lleva los créditos. Un plugin de Vite genera `licenses/ambience.txt`, como con las tipografías.
    - Un test comprueba que cada entrada tiene su archivo y sus créditos, y que el total no pasa de 15 MB.
    - Hasta este bloque, el desarrollo usa sonidos de prueba generados con ffmpeg.
13. **Pruebas de extremo a extremo y rendimiento** — `tests/e2e`.
    - El recorrido de la spec:
      - entrar con F11;
      - elegir un fondo y un ambiente;
      - escribir con tecleo;
      - salir con Esc;
      - cerrar y abrir la app con todo recordado.
    - Importar un fondo propio, borrar el original y comprobar que sigue.
    - Escribir con tecleo y un fondo animado mantiene el p95 por debajo de 50 ms (150 ms en la CI de macOS, como en la 001).
    - El tecleo se programa en menos de 20 ms desde la pulsación: se mide con un `AudioContext` instrumentado.
14. **Validación y cierre.**
    - Criterios de `spec.md`.
    - `tech-stack.md`: audio, protocolo asset y créditos.
    - Pull request a `main` con la CI en verde.
    - Hoja de ruta.

## Decisiones

- **Preferencias del escritor, en `settings.json`** — el tema y los sonidos son costumbres de quien escribe; la constitución ya lo fija así. Ningún archivo `.rocinante` cambia de esquema en esta feature.
- **Web Audio y no `<audio>`** — Web Audio programa cada sonido con poca latencia, mezcla y hace fundidos sin cortes. La etiqueta `<audio>` tiene retrasos variables y huecos en los bucles.
- **El tecleo depende de lo que cambia, no de la tecla** — así no suenan los atajos ni las teclas muertas de los acentos, y encaja con cómo ya cuenta palabras el editor.
- **Animados por código** — un `canvas` sobre un fondo fijo pesa casi nada, se pausa y respeta «reducir el movimiento». Un vídeo en bucle pesaría de 5 a 20 MB y cargaría la tarjeta gráfica mientras se escribe.
- **Los propios se copian** — la copia en la carpeta de datos hace que un fondo no se rompa al mover el original. El protocolo `asset` solo puede leer esa carpeta.
- **El núcleo valida por firma** — la extensión puede mentir. Se leen los primeros bytes, y el navegador decodifica el resto. Si un sonido con firma válida no se puede decodificar, la interfaz lo dice y no suena.
- **Material CC0, unos 15 MB en total** — de dominio público, compatible con MIT y sin obligación de atribución. Aun así, se acredita a cada autor por cortesía.
- **Opus para lo incluido** — da la mejor calidad por tamaño. Con el fundido cruzado, el relleno del códec al principio y al final no importa.
- **La meta es de la sesión** — empieza y termina con el modo concentración y no se guarda. Las metas diarias o de la obra y su historial quedan en el backlog.

## Riesgos

- **Opus en WebKit** — WebView2 y WebKitGTK (con GStreamer) decodifican Opus. El WebKit de macOS lo hace en versiones recientes; en las antiguas puede fallar. Si la CI o una prueba en macOS lo muestran, lo incluido pasa a AAC en `.m4a`, que siempre decodifica, y el resto no cambia.
- **Latencia del sonido en Linux** — WebKitGTK puede tener más latencia de audio que WebView2. Se mide en la CI de Linux. Si hace falta, se baja `latencyHint` a `interactive`.
- **Pantalla completa en macOS** — la pantalla completa nativa de macOS abre otro espacio con animación. Tauri la expone igual, pero el paso al modo es menos instantáneo. Es aceptable.
- **Rendimiento con el fondo animado** — el `canvas` va en su propia capa, detrás de la hoja, y limitado a 30 fotogramas por segundo. La prueba de rendimiento escribe con un fondo animado activo.
- **Encontrar buen material CC0** — puede que algún ambiente no tenga una grabación CC0 de calidad. En ese caso te propongo otro ambiente parecido antes de cambiar la lista de la spec.
