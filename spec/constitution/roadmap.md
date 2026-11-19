# Roadmap

Orden y estado de las features. Cada entrada apunta a su carpeta en `features/`, que se crea al empezarla. Las features se abordan de una en una y en este orden: cada una se apoya en las anteriores.

## Hecho ✅

- **001 · Proyecto y editor base** — [spec](../features/001-proyecto-editor-base/spec.md). Falta comprobar el doble clic en el archivo en macOS y Linux, que llega con los instaladores (012).

## Versión 1 — «Primera salida» 🔜

Es lo mínimo para que Rocinante sea usable a diario: escribir, organizar la obra y entregarla. Sin plazo; se avanza al ritmo del autor.

La app tiene dos pestañas principales:

- **Escritura** — la interfaz completa y sin distracciones: el editor, la hoja y el formato.
- **Tablero** — las tarjetas de los elementos de la obra.

Las pestañas se pueden arrastrar fuera de la ventana principal para convertirlas en una ventana propia, que se mueve a otra pantalla y se vuelve a acoplar cuando se quiera. Ambas ventanas muestran el mismo proyecto en vivo: lo que se escribe en una se refleja al momento en la otra.

1. **001 · Proyecto y editor base** — crear, abrir y guardar proyectos `.rocinante`. Dentro de un proyecto hay capítulos y un cajón de fragmentos sueltos, que se reordenan desde un índice anclable. El editor es papel sin bordes con cursor de máquina de escribir y menú flotante de formato (incluidas sangrías y notas al pie), notas ancladas en cualquier punto del texto, contador, guardado automático y versiones. _(Hecha.)_
2. **002 · Hoja de escritura** — formatos de hoja con tamaños de libro (bolsillo, A5, 6×9 in, A4, carta…), márgenes y vista de página. Incluye una colección de tipografías abiertas pensadas para leer y escribir. _(En revisión: [spec](../features/002-hoja-de-escritura/spec.md); pasa a «Hecho» cuando el pull request entre en `main`.)_
3. **003 · Modo concentración y ambiente** — pantalla completa con solo el texto. Fondos relajantes y sonidos de tecleo opcionales: cada pulsación suena, por ejemplo, como una máquina de escribir. Se activan, se eligen y se ajusta su volumen.
4. **004 · Elementos de la obra** — fichas de personajes, lugares y tramas creadas a mano, con atributos, alias y relaciones entre ellas.
5. **005 · Notas e ideas** — amplía las notas ancladas en el texto de la 001: ideas sueltas del proyecto, notas enlazadas a un elemento de la obra y una vista con todas las notas para consultarlas, filtrarlas y saltar a su pasaje sin salir de la escritura.
6. **006 · Referencias en el texto** — el vínculo entre el texto y las tarjetas, en ambos sentidos. En el editor, las menciones de un elemento se reconocen y, al pasar el cursor, muestran su ficha. En la tarjeta aparecen todas sus referencias en el texto (cada pasaje donde se menciona, con salto directo a él), sus metadatos (atributos, alias, primera aparición, capítulos) y sus notas.
7. **007 · Tablero de tarjetas** — la pestaña Tablero. Muestra las tarjetas con número de menciones, capítulos y pasajes donde aparece cada elemento, coincidencias en un mismo párrafo y sugerencias de nombres propios sin ficha. La pestaña se puede separar en su propia ventana, llevar a otra pantalla y volver a acoplar. Todo funciona sin IA.
8. **008 · Corrección** — ortografía, gramática y puntuación en local, sin reescribir el estilo del autor.
9. **009 · Escudero** — conexión con un proveedor de IA en la nube (con la clave del usuario) o con un modelo local. Analiza cada párrafo en segundo plano al terminarlo y crea fichas, relaciones y atributos.
10. **010 · Hilos del destino** — el recorrido de cada personaje a lo largo de la historia: dónde aparece, qué le ocurre y cómo cambian sus relaciones.
11. **011 · Exportación** — `.docx`, PDF, EPUB y `.md`, respetando el formato de hoja elegido.
12. **012 · Distribución** — instaladores para Windows, macOS y Linux. Instalar y escribir, sin nada más.

## Backlog / ideas 💡

Ideas futuras, ni comprometidas ni ordenadas.

- **Escribir en la vista de página** — edición paginada, con los saltos de página a la vista mientras se escribe (la 002 la deja solo para revisar).
- **Cabeceras** — título de la obra y del capítulo en lo alto de las páginas de la vista de página y de la exportación.
- **Versión web** — la misma experiencia en el navegador.
- **Versión móvil** — para leer, consultar el tablero y escribir notas rápidas.
- **Nube de pago opcional** — sincronización entre escritorio, web y móvil.
- **Colaboración** — coautores, editores y correctores sobre el mismo proyecto.

> Cada feature nueva se crea como `features/NNN-nombre-feature/` con `spec.md`, `plan.md` y `tasks.md`, copiados de `.prompt/plantillas/feature/`, antes de tocar código.
