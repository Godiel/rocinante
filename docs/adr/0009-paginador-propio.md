# ADR 0009 · Paginador propio para la vista de página

- **Estado:** aceptada
- **Fecha:** 2026-11-19
- **Feature:** [002 · Hoja de escritura](../../spec/features/002-hoja-de-escritura/spec.md)

## Contexto

La vista de página muestra la obra entera repartida en hojas del tamaño del libro. Tiene que seguir las reglas de un libro impreso:

- cada capítulo empieza en página nueva;
- un párrafo no deja una línea sola al pie de una página ni al principio de la siguiente;
- un título no queda solo al pie;
- las notas al pie van al pie de la página donde se llaman.

Además, una obra de 150 000 palabras tiene que abrirse en menos de 2 segundos.

Los navegadores no paginan texto en pantalla: CSS Paged Media solo se aplica al imprimir. TipTap libre tampoco pagina; la paginación de TipTap es de pago y queda fuera por licencia.

## Decisión

Rocinante tiene un **paginador propio** en `src/ui/src/features/pages`, en tres partes separadas:

1. **`blocks.ts`** convierte cada capítulo en bloques HTML con el esquema del editor. Así se ve igual que al escribir, sin las anclas de las notas del autor y con las notas al pie numeradas por capítulo.
2. **`measure.ts`** pone el libro entero en una columna oculta del ancho de la caja de texto, a tamaño real y con la letra de la obra. Lee todos los bloques en una sola pasada: el navegador compone el texto una vez. Los párrafos se miden en líneas del interlineado; los títulos y separadores, como una pieza.
3. **`layout.ts`** reparte esas medidas en páginas. Es una función pura, que solo trabaja con números, y la prueban tests con medidas inventadas, sin navegador.

Cada página guarda qué líneas de qué bloque lleva y qué líneas de qué nota. Para dibujar un trozo de párrafo se dibuja el párrafo entero en una ventana del alto de esas líneas, desplazado hasta la primera. La composición del texto es la misma que se midió.

## Alternativas descartadas

- **Paged.js** (MIT): implementa CSS Paged Media con notas al pie y números de página. Su última versión es de 2023 y, al recomponer el documento con el DOM página a página, tarda varios segundos en libros largos.
- **Paginar dentro del editor:** obligaría a recalcular las páginas mientras se escribe y complicaría el editor. La spec deja la vista solo para revisar, y la edición paginada en el backlog.
- **Imprimir a PDF y mostrarlo:** depende de la impresión de cada sistema y no permite abrir la vista en la página del cursor.

## Consecuencias

- En WebView2, una obra sintética de 150 000 palabras en A5, con 40 notas al pie, se reparte en 384 páginas: 9 ms para construir los bloques, 256 ms para medirlos y 2 ms para paginar.
- Las reglas del libro (viudas y huérfanas, títulos, notas que continúan) tienen tests propios, independientes del navegador.
- WebView2 y WebKit componen el texto de forma algo distinta, así que el número de páginas puede variar un poco entre sistemas. La vista es una revisión; la exportación (011) fijará el resultado.
- El mismo reparto servirá de base para el PDF de la exportación.
