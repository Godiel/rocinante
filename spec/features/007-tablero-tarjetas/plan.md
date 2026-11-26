# 007 · Tablero de tarjetas — Plan

Cómo se implementa lo descrito en [`spec.md`](spec.md). Se apoya en la pizarra de la [004](../004-elementos-obra/plan.md) y en las menciones de la [006](../006-referencias-texto/plan.md).

## Enfoque

Todo lo que la 007 cuenta sale de lo que la 006 ya sabe encontrar. El índice de menciones del núcleo, que recorre cada documento una vez por revisión, guarda ahora también **en qué párrafo** cae cada mención. De ahí salen:

- las menciones y capítulos de **todas** las tarjetas de una vez;
- las **coincidencias**: dos fichas con menciones en el mismo párrafo.

Las **sugerencias** son otro recorrido de los mismos párrafos, con su propia regla, y lo descartado se guarda en el archivo de la obra.

**Separar el Tablero** es abrir otra ventana de la obra, como «Otra ventana», con una etiqueta que empieza por `board-`. La interfaz lee la etiqueta y, en esa ventana, solo muestra la pizarra. Las ventanas de una obra se avisan de que el Tablero está separado o acoplado con un `BroadcastChannel`, que comparten porque son el mismo origen; no hace falta pasar por el núcleo.

## Implementación

1. **Contrato (versión 10)** — `src/contracts`.
   - `board.mentions` devuelve `{ elements: [{ id, total, chapters }] }` para las fichas de la obra.
   - `element.references` gana `together: [{ elementId, paragraphs }]`, de más a menos.
   - `suggestions.get` devuelve `[{ name, count }]`; `suggestion.dismiss { name, origin }` difunde `suggestions.changed { origin }`.
2. **Dominio** — `Rocinante.Domain/Elements`.
   - `NameSuggester`: los nombres propios de unos párrafos según la regla de la spec, con sus veces.
   - Tests con casos de español: inicio de frase, diálogo, nombres compuestos, conectores, signos.
3. **Persistencia (esquema v5)** — migración `0005-dismissed-names.sql` con `dismissed_name (name)`, plegado como las menciones. «Guardar como» lo copia; `docs/format` lo describe.
4. **Casos de uso y sidecar** — `Rocinante.Application`.
   - El índice de menciones guarda el párrafo de cada una; `BoardMentions()` y las coincidencias de `References()` salen de él.
   - `Suggestions()` y `DismissSuggestion()`; la caché por revisión de cada documento sirve también aquí.
5. **Números en las tarjetas** — `features/board`: `useBoardMentions` pide `board.mentions` al abrir el Tablero y tras cada cambio del texto o de las fichas, con una pausa; la tarjeta muestra la línea.
6. **Coincidencias** — sección «Coincide con» en la ficha; en la pizarra, al elegir una tarjeta, las que coinciden no se atenúan.
7. **Sugerencias** — sección plegable en la pestaña Fichas, con «Crear ficha» y «Descartar».
8. **Separar el Tablero** — anfitrión: `open_window` acepta `board`; interfaz: la ventana `board-…` solo muestra el Tablero, con «Acoplar»; la de la obra muestra dónde está y «Traerlo aquí».
9. **Pruebas de extremo a extremo y rendimiento** — el recorrido de la spec y `board.mentions` con 300 fichas en 150 000 palabras por debajo de 1 segundo.
10. **Validación y cierre** — criterios, `tech-stack.md`, PR y hoja de ruta.

## Decisiones

- **Un solo recorrido del texto** — menciones, coincidencias y números de las tarjetas salen del mismo índice, que ya se guarda por revisión. Escribir en un capítulo solo obliga a recorrer ese capítulo de nuevo.
- **Lo descartado, en la obra** — es una decisión del escritor sobre su texto, como las fichas, y viaja con el archivo.
- **`BroadcastChannel` para separar y acoplar** — es un asunto entre ventanas, no de la obra; el núcleo no tiene por qué saberlo.

## Riesgos

- **Sugerencias ruidosas** — una regla sencilla acierta mucho pero no siempre («Capítulo», «Dios»). «Descartar» es para siempre en la obra; con el uso, el ruido baja.
- **Una ventana sin cerrar bien** — si la ventana del Tablero se cierra de golpe, la de la obra podría creer que sigue separada. La ventana del Tablero avisa también al cerrarse (`pagehide`), y «Traerlo aquí» siempre está disponible.
