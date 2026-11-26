# 006 · Referencias en el texto — Plan

Cómo se implementa lo descrito en [`spec.md`](spec.md). Respeta la [constitución](../../constitution/tech-stack.md) y se apoya en las fichas de la [004](../004-elementos-obra/plan.md) y en las notas de la [005](../005-notas-ideas/plan.md).

## Enfoque

Reconocer menciones es buscar nombres en el texto, y se hace en dos sitios por dos razones distintas:

- **En la interfaz, al escribir.** Las marcas tienen que seguir al cursor letra a letra, sin esperar al núcleo. La constitución lo dice así: lo que responde al instante mientras se escribe vive en la interfaz.
- **En el núcleo, para la ficha.** «En el texto» necesita todos los capítulos, no solo el abierto. El núcleo ya tiene todo el texto; lo recorre cuando se le pide y guarda el resultado en memoria hasta que cambia un texto o una ficha.

Los dos lados siguen **las mismas reglas**, escritas dos veces (TypeScript y C#) y comprobadas con **el mismo juego de casos**, como el contrato de mensajes. Una mención se identifica por su documento y su **número de orden** entre las menciones de esa ficha en ese documento: así el salto no depende de posiciones de ProseMirror, que el núcleo no conoce.

No hay cambio en el archivo `.rocinante`: las menciones se deducen del texto y de las fichas, que ya están guardados.

## Arquitectura de la feature

```
 Escritura
   editor ── decoración «mentions» (marcas, recalculadas solo en los párrafos que cambian)
          └─ ficha en pequeño al pasar el ratón ── «Abrir la ficha»
   panel ── pestaña Fichas ── «Marcar menciones»
                          └─ ficha ── «En el texto» ── salto a una mención
        │  element.references { id }
 Núcleo .NET ── dominio: MentionFinder (las reglas), ElementReferences
        │        └─ caché por revisión de cada documento y versión de las fichas
 src/contracts/mentions.json ── casos compartidos por las dos implementaciones
```

## Implementación

1. **Reglas compartidas** — `src/contracts/mentions.json`.
   - Casos: texto, nombres de las fichas y menciones esperadas (ficha, inicio y longitud en el texto).
   - Cubren palabras enteras, mayúsculas, tildes, solapes (gana el más largo), nombres de una letra, nombres repetidos, guiones de diálogo y signos de puntuación.
   - Las palabras son secuencias de letras y números de Unicode; la comparación pliega mayúsculas y tildes (NFD sin marcas diacríticas, minúsculas).
2. **Contrato (versión 9)** — `src/contracts`.
   - `element.references { id }` devuelve `{ total, chapters, first, documents: [{ documentId, mentions: [{ ordinal, before, text, after }] }] }`. `first` es `{ documentId, ordinal }` o nulo; los documentos van en el orden del índice.
   - `Preferences` gana `mentionsVisible` (por defecto, sí).
   - Ejemplos válidos e inválidos; el escenario de `ContractTests` usa el método nuevo.
3. **Dominio** — `Rocinante.Domain/Elements`.
   - `MentionFinder`: a partir de los nombres y alias de las fichas en la obra, encuentra las menciones en un texto, con las reglas compartidas.
   - `DocumentContent` da los textos de sus bloques en orden (los mismos que cuenta).
   - Tests de dominio con los casos de `mentions.json`, al 80 % o más.
4. **Casos de uso y sidecar** — `Rocinante.Application`.
   - `ElementUseCases.References(id)`: recorre los documentos de la obra en el orden del índice y devuelve las menciones con un trozo de unas 60 letras a cada lado.
   - Caché en memoria por documento (su revisión) y por versión de las fichas; se vacía al cerrar la obra.
   - `Preferences.MentionsVisible` en la configuración de la app.
   - Los registros nunca llevan nombres ni trozos del texto.
5. **Reconocer en la interfaz** — `features/mentions`.
   - `findMentions(text, names)`: las mismas reglas, con los casos de `mentions.json` en sus tests.
   - Un índice de nombres plegados, rehecho solo cuando cambian las fichas.
6. **Marcas en el editor** — `editor/extensions/mentions.ts`.
   - Una decoración de ProseMirror con las menciones del documento. Al escribir solo se vuelven a buscar los bloques que tocó la transacción; el resto se desplaza.
   - Se rehace entera cuando cambian los nombres de las fichas.
   - Cada marca lleva los ids de sus fichas en un atributo, para la ficha en pequeño.
   - «Marcar menciones» y el modo concentración la apagan sin recalcular nada.
7. **Ficha en pequeño** — `features/mentions/MentionCard.tsx`.
   - Aparece al pasar el ratón por una marca, tras una pausa breve, y se va al salir de ella y de la tarjeta.
   - Imagen, nombre, tipo, los tres primeros atributos con valor y «Abrir la ficha». Varias fichas, una debajo de otra.
8. **«En el texto» en la ficha** — `features/elements`.
   - Pide `element.references` al abrir la ficha y cada vez que llega `document.changed` o `elements.changed`, con una pausa.
   - Total, capítulos, primera aparición y menciones por capítulo con su trozo.
   - El salto usa el mismo camino que «Ir al pasaje» de la 005: abre el documento y el editor selecciona la mención con ese número de orden.
9. **Pruebas de extremo a extremo y rendimiento** — `tests/e2e`.
   - El recorrido de la spec: escribir un nombre y verlo marcado, la ficha en pequeño, «En el texto» y el salto a una mención.
   - Escribir en un capítulo de 20 000 palabras con 300 fichas y las marcas visibles mantiene el p95 de la 001.
10. **Validación y cierre.**
    - Criterios de `spec.md`, marcando solo lo comprobado.
    - `tech-stack.md`: los módulos nuevos y el glosario (mención).
    - Pull request a `main` con `gh`, con la CI en verde en los tres sistemas.
    - Hoja de ruta: la 006 pasa a «Hecho» al fusionar.

## Decisiones

- **Las menciones no se guardan** — se deducen del texto y de las fichas. Guardarlas obligaría a mantenerlas al día en cada guardado y en cada cambio de nombre, y el archivo tendría dos verdades. Si la 007 necesita consultas que no quepan en memoria, se guardarán entonces, con su migración.
- **Número de orden en vez de posiciones** — el núcleo cuenta en el JSON del texto y el editor en ProseMirror. Contar las menciones de una ficha en un documento da el mismo número en los dos lados, porque siguen las mismas reglas.
- **Reglas escritas dos veces y un solo juego de casos** — compartir código entre TypeScript y C# no es posible sin añadir una dependencia; un juego de casos común, como el del contrato, mantiene los dos lados iguales.

## Riesgos

- **Rendimiento al escribir** — buscar 300 nombres en cada pulsación en un capítulo de 20 000 palabras sería lento. Solo se buscan los bloques que cambian, con un índice de nombres por su primera palabra plegada. La prueba de rendimiento lo mide.
- **Diferencias entre los dos lados** — Unicode tiene casos raros (ligaduras, letras combinadas). Los casos compartidos cubren los del español; lo demás se trata igual en los dos lados porque ambos usan NFD.
- **Ruido en el texto** — un nombre corriente («Luna», «Paz») marcaría muchas palabras. La casilla «Marcar menciones» y no buscar nombres de una letra lo limitan; reconocer solo nombres propios queda para el escudero (009).
