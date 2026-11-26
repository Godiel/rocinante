# 009 · Escudero

**Estado:** en especificación

## Qué hace

El **escudero** es un asistente opcional. El escritor conecta la IA que prefiera: un proveedor en la nube con **su propia clave**, o un **modelo local** en su equipo con **Ollama**, sin internet. Cuando el escritor termina un párrafo, el escudero lo lee en segundo plano y **propone** lo que deduce: fichas nuevas, relaciones entre fichas y atributos. **Nada entra en la obra hasta que el escritor lo acepta.** El escudero nunca interrumpe ni cambia el texto.

**Conectar una IA**
- En **Ajustes del escudero** el escritor elige el proveedor:
  - **en la nube:** Anthropic (Claude), OpenAI, Google (Gemini), xAI (Grok) o cualquier servicio **compatible con OpenAI** (con su dirección);
  - **local:** **Ollama**, que el escritor instala por su cuenta; Rocinante usa su dirección local y la lista de modelos que tiene.
- Escribe su **clave de API** (no hace falta con Ollama) y elige el **modelo**. «Probar» comprueba que funciona.
- La clave se guarda en el **almacén de credenciales del sistema** (Windows, macOS o Linux), nunca en la obra ni en la configuración de la app. Se puede borrar.
- El escudero está **apagado** hasta que el escritor lo enciende, y lo enciende **para cada obra**: el texto de una obra solo sale del equipo con su permiso explícito. Con un proveedor en la nube, antes de encenderlo se dice claramente que el texto irá a ese proveedor.

**Lo que hace mientras se escribe**
- Al terminar un párrafo (Intro, o tras una pausa larga en él), lo manda al proveedor junto con los nombres de las fichas de la obra.
- La IA responde con lo que deduce de ese párrafo:
  - **elementos** que aparecen y no tienen ficha («Claudio», personaje);
  - **relaciones** («Claudio es hijo de Antonio»);
  - **atributos** («Antonio: pelirrojo»).
- Cada cosa deducida es una **propuesta**, con el **pasaje** del que sale. Nunca hay ventanas ni avisos que interrumpan: solo un contador discreto en la barra («Escudero · 3»).
- Un párrafo ya leído no se vuelve a mandar si no cambia.

**Revisar las propuestas**
- La pestaña **Escudero** del panel de la derecha, junto a Fichas y Notas, lista las propuestas pendientes, las más recientes primero, con su pasaje.
- Cada propuesta se **acepta** (se crea la ficha, la relación o el atributo, como si lo hubiera hecho el escritor), se **corrige** antes de aceptarla (el nombre, el tipo, la clase de relación o el valor) o se **descarta**.
- «Ir al pasaje» lleva al párrafo de donde salió.
- Lo descartado no se vuelve a proponer para ese pasaje.

## Por qué

Llevar las fichas a mano es trabajo que distrae de escribir. El escudero lo hace por detrás, a partir del propio texto, y deja al escritor la última palabra. Como la IA la elige el escritor y la clave es suya, nadie más que el proveedor que él elige ve su texto, y con un modelo local nadie.

## Decisiones

- **Solo propuestas**, como pidió el autor: nada entra en la obra sin aceptarlo.
- **Proveedores:** Anthropic, OpenAI, Google Gemini, xAI Grok, compatible con OpenAI y Ollama local, como pidió el autor. Grok entra por la API compatible con OpenAI con su dirección puesta.
- **La clave, en el almacén del sistema**, como pidió el autor. Para no añadir dependencias, el núcleo usa lo que trae cada sistema: el Administrador de credenciales de Windows, la orden `security` de macOS y `secret-tool` de Linux.
- **Tomadas sin consultar:** el escudero se enciende por obra; el párrafo se manda al pulsar Intro o tras 8 segundos sin escribir en él; las llamadas salen del núcleo, sin dependencias de SDK, con HTTP y JSON.

## Criterios de aceptación

**Conexión**
- [ ] Se elige proveedor y modelo, se guarda la clave en el almacén del sistema y «Probar» dice si funciona, con un mensaje claro si no.
- [ ] Con Ollama se listan los modelos instalados; si Ollama no responde, se explica cómo instalarlo y arrancarlo.
- [ ] La clave nunca aparece en la obra, en `settings.json` ni en los registros.
- [ ] El escudero está apagado por defecto y se enciende por obra, con el aviso de a dónde irá el texto.

**Propuestas**
- [ ] Al terminar un párrafo, el escudero propone elementos, relaciones y atributos, cada uno con su pasaje, sin interrumpir.
- [ ] Aceptar crea lo propuesto; corregir y aceptar crea lo corregido; descartar lo quita y no vuelve para ese pasaje.
- [ ] Un párrafo sin cambios no se vuelve a mandar.
- [ ] Si el proveedor falla o no hay conexión, se dice con calma en la pestaña Escudero y la escritura sigue igual.

**Calidad**
- [ ] Los métodos nuevos forman parte del contrato; las propuestas se guardan en el `.rocinante` con una migración documentada.
- [ ] Los registros no contienen el texto, las propuestas ni la clave.
- [ ] Tests del núcleo con un proveedor falso, tests de comportamiento y una prueba de extremo a extremo con un proveedor falso local: conectar, escribir un párrafo, aceptar, corregir y descartar propuestas.

## Fuera de alcance

- **Hilos del destino:** **010**.
- **Corrección o reescritura** con IA: el escudero no toca el estilo.
- **Descargar o gestionar modelos** de Ollama desde Rocinante.
- **Analizar la obra entera** de una vez (solo párrafo a párrafo, mientras se escribe).
- Pago o cuentas: el escritor usa su propia clave.
