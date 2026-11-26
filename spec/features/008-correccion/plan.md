# 008 · Corrección — Plan

Cómo se implementa lo descrito en [`spec.md`](spec.md). Se apoya en las marcas del editor de la [006](../006-referencias-texto/plan.md).

## Enfoque

La corrección responde mientras se escribe, así que vive en la **interfaz**, como las menciones. El núcleo solo guarda el **diccionario propio** del escritor en la configuración de la app y avisa a las ventanas cuando cambia.

- **Ortografía:** `nspell` con el diccionario de `dictionary-es` corre en un **Web Worker**, porque leer el diccionario tarda y no debe frenar el editor. El editor pregunta por las palabras que aún no conoce y guarda la respuesta; las marcas se rehacen cuando llegan.
- **Puntuación:** funciones puras, una por regla, sobre el texto de cada párrafo.
- **Marcas:** una decoración del editor, como las menciones, que al escribir solo vuelve a mirar los párrafos tocados.

## Implementación

1. **Contrato (versión 11)** — `dictionary.get`, `dictionary.add { word, origin }`, `dictionary.remove { word, origin }` y la notificación `dictionary.changed { words, origin }`; `Preferences.correctionVisible`.
2. **Núcleo** — el diccionario propio en `settings.json` (palabras únicas, ordenadas, hasta 5000 de hasta 60 letras), con casos de uso y sus tests; los registros no llevan palabras.
3. **Reglas de puntuación** — `features/correction/punctuation.ts`, con casos de español correcto que no deben marcarse.
4. **Ortografía** — `features/correction/spelling.worker.ts` con nspell; `spelling.ts` habla con él, guarda las respuestas y decide qué palabras no se miran (fichas, diccionario propio, siglas, números, una letra).
5. **Marcas en el editor** — `editor/extensions/correction.ts`, incremental; F7 y el modo concentración las apagan.
6. **La ventanita** — sugerencias, arreglo de puntuación, «Añadir al diccionario» e «Ignorar»; cambiar el texto pasa por una transacción del editor, con deshacer.
7. **Licencia** — `licenses/dictionary-es.txt` en la compilación, como las tipografías.
8. **Pruebas de extremo a extremo y rendimiento.**
9. **Validación y cierre.**

## Decisiones

- **En la interfaz y en un Worker** — subrayar letra a letra no puede esperar al núcleo, y cargar el diccionario no puede parar el editor.
- **Diccionario propio en la app** — las palabras del escritor valen para todas sus obras.

## Riesgos

- **Carga del diccionario** — nspell con el español tarda en construirse. Va en un Worker y la app funciona sin él hasta que llega.
- **Falsos positivos** — un diccionario general no conoce los nombres de la obra; por eso se excluyen las fichas y existe el diccionario propio.
