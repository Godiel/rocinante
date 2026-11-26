# 008 · Corrección

**Estado:** hecha.

## Qué hace

Rocinante **revisa la ortografía y la puntuación** mientras se escribe, en local y sin internet. Marca con discreción lo que parece un error y, al pulsarlo, **propone** cómo arreglarlo. **Nunca cambia el texto por su cuenta**: solo cambia lo que el escritor elige. No toca el estilo: no hay sugerencias de redacción.

**Ortografía**
- Las palabras que no están en el diccionario de español se subrayan con una línea ondulada fina.
- No se marcan: los nombres y alias de las fichas, las palabras del **diccionario propio** del escritor, las que llevan números, las siglas en mayúsculas («ADSL») ni las palabras de una letra.
- Al pulsar una palabra marcada aparece una ventanita con hasta cinco **sugerencias**; elegir una la cambia. También ofrece **«Añadir al diccionario»**, que la acepta en todas las obras, e **«Ignorar»**, que deja de marcarla en esta sesión.

**Puntuación** (reglas propias del español)
- Signos de **apertura sin cierre** o de cierre sin apertura en el mismo párrafo: «¿» sin «?», «¡» sin «!».
- **Espacio antes** de una coma, un punto, punto y coma, dos puntos o un signo de cierre.
- **Falta de espacio después** de una coma, un punto y coma o dos puntos seguidos de una letra.
- **Espacios dobles** entre palabras.
- **Minúscula después de punto**, al empezar la frase siguiente.
- **Guion en vez de raya** al empezar un diálogo («- Ven» en lugar de «—Ven»).
- Cada marca explica el problema y, cuando hay un arreglo claro, lo ofrece con un botón.

**Encender y apagar**
- **F7** muestra u oculta las marcas de corrección. Se recuerda para todas las obras.
- En el modo concentración no hay marcas.
- El diccionario se carga en segundo plano: abrir una obra y escribir no esperan por él.

## Por qué

Un manuscrito con erratas cansa a quien lo lee y distrae a quien lo revisa. Tener la corrección dentro del editor, en local y sin que nada cambie solo, deja al escritor revisar cuando quiere y como quiere, sin mandar su texto a ningún servicio.

## Decisiones tomadas sin consultar

- El diccionario es el de **LibreOffice** para español (`dictionary-es`), con el motor **nspell**, como eligió el autor: ligero y sin Java. No hay corrección gramatical profunda; las reglas de puntuación son propias y sencillas.
- El **diccionario propio** es del escritor, no de la obra: vale para todas sus obras y se guarda en la configuración de la app, como el tema.
- **F7** enciende y apaga la corrección: es la tecla de ortografía en los procesadores de texto, y las teclas F son para funciones grandes.

## Criterios de aceptación

**Ortografía**
- [x] Se subrayan las palabras que no están en el diccionario; no los nombres de las fichas, las del diccionario propio, las siglas, las que llevan números ni las de una letra.
- [x] Al pulsar una palabra marcada se ven hasta cinco sugerencias, y elegir una la cambia, con deshacer.
- [x] «Añadir al diccionario» la acepta en todas las obras y ventanas, también tras cerrar y abrir; «Ignorar» deja de marcarla en la sesión.

**Puntuación**
- [x] Cada regla de la spec marca su caso y explica el problema; los arreglos claros se aplican con un botón.
- [x] Ninguna regla marca un texto correcto de diálogo y puntuación española (casos de prueba).

**General**
- [x] F7 muestra y oculta las marcas y se recuerda; no hay marcas en el modo concentración.
- [x] Nada cambia el texto sin que el escritor lo elija.
- [x] Abrir una obra no espera al diccionario; con él cargado, escribir en un capítulo de 20 000 palabras mantiene el p95 de la 001.
- [x] La licencia del diccionario va con la app, en `licenses/`.
- [x] Los métodos nuevos forman parte del contrato; los logs no contienen palabras del escritor.
- [x] Tests de dominio, de comportamiento y una prueba de extremo a extremo: una errata marcada y corregida, una palabra añadida al diccionario, un signo sin cerrar y F7.

## Fuera de alcance

- **Gramática** a fondo (concordancias, tiempos verbales) y **estilo**: no se reescribe al autor.
- **Otros idiomas.**
- **Corrección con IA:** **009** (escudero).
- Revisar las notas del autor y las notas al pie.
