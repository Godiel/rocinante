# 011 · Exportación — Plan

Cómo se implementa lo descrito en [`spec.md`](spec.md). La exportación vive en el **núcleo**, que tiene la obra entera y no depende de la ventana. La interfaz pide, muestra el avance y elige dónde guardar.

## Arquitectura

```
 Interfaz ── diálogo Exportar (F9) → diálogo del sistema para guardar → export.run
        │  book.* / export.run            ▲ export.progress
 Núcleo ── ExportUseCases
        │     ├─ Book: los capítulos de la obra como libro (bloques, marcas, notas al pie), desde DocumentContent
        │     ├─ MarkdownWriter · EpubWriter · DocxWriter · PdfWriter (Export/)
        │     │      └─ PDF: WOFF → TrueType, medidas de la fuente, composición de líneas y páginas
        │     └─ autor, créditos y portada → SQLite (esquema v8)
```

- **Un solo modelo para los cuatro formatos.** `Book` lee los capítulos y sus notas al pie, y sabe la portada, los créditos y el índice. Cada escritor solo traduce ese modelo.
- **Sin dependencias nuevas**, como en la 009. Los cuatro formatos se escriben a mano:
  - EPUB y `.docx` son XML dentro de un ZIP, con `System.IO.Compression`;
  - el `.md` es texto;
  - el PDF lo compone el núcleo, porque las bibliotecas de PDF para .NET con licencia compatible con MIT obligan igualmente a componer las líneas, y la composición es lo que tiene que parecerse a la vista de página.
- **Las tipografías.** Las de la obra vienen en WOFF en los paquetes `@fontsource`, con licencia OFL. Se copian en el núcleo (latin y latin-ext, regular, cursiva, negrita y negrita cursiva) con sus licencias. Para el PDF y el EPUB, el núcleo pasa el WOFF a TrueType, descomprimiendo cada tabla. Cada carácter usa la fuente del subconjunto que lo tiene.
- **El PDF:**
  - partición de líneas voraz, con justificación por espacios y la primera línea sangrada;
  - márgenes interior y exterior según la página sea par o impar;
  - cada capítulo en página nueva, con su título bajado, y la capitular;
  - las notas al pie al final de la página donde se citan, y el número de página centrado abajo.
  - Las fuentes se incrustan enteras (son subconjuntos pequeños), con codificación Identity-H y `ToUnicode` para que el texto se pueda copiar y buscar.
- **Escritura segura.** Cada formato se escribe en un archivo temporal junto al destino, que se renombra al terminar. Si algo falla, no queda nada a medias.
- **Avance.** Cada escritor avisa al terminar cada capítulo con `export.progress`. La exportación corre fuera del candado de las peticiones: lee primero la obra, con el candado, y escribe después, sin él.

## Implementación

1. **Contrato (versión 14):**
   - `book.get` y `book.update` (autor y créditos);
   - `book.setCover` y `book.removeCover` (la imagen de portada, reducida por la interfaz como la de las fichas);
   - `export.run` (formato, partes y ruta) y la notificación `export.progress`.
2. **Dominio:** `BookDetails` (autor, créditos, portada) y `Book`, con su lectura desde el contenido de los capítulos.
3. **Persistencia (esquema v8):** la tabla `book` y `docs/format`.
4. **Escritores:** Markdown, EPUB, Word y PDF, con sus fuentes y sus tests.
5. **Casos de uso y sidecar:** datos del libro, exportación con avance y escritura segura.
6. **Interfaz:**
   - el diálogo Exportar, con F9 y el botón de la barra;
   - el formato y las partes;
   - el autor, los créditos y la portada;
   - el diálogo del sistema para guardar;
   - el avance y «Mostrar en la carpeta».
7. **Pruebas de extremo a extremo y de rendimiento:** exportar una obra a los cuatro formatos y una de 150 000 palabras a PDF.
8. **Validación y cierre.**

## Riesgos

- **Componer un PDF** es el trabajo más grande. Se limita a lo que la obra usa:
  - párrafos, títulos, citas, listas y separadores de escena;
  - cursiva, negrita y subrayado;
  - notas al pie y capitular.

  Sin partición silábica: el texto justificado reparte el espacio entre palabras, como en la vista de página. Los tests comparan los cortes de página con los de la vista de página en casos sencillos.
- **EPUBCheck** es un programa Java que no está en el proyecto. Los tests comprueban la estructura que pide EPUB 3:
  - `mimetype` primero y sin comprimir;
  - `container.xml`, el OPF, el documento de navegación y XHTML bien formado.

  Pasar EPUBCheck se comprueba a mano, o en la CI si el autor aprueba instalarlo.
- **El índice de Word** usa un campo TOC que Word actualiza al abrir el archivo (`updateFields`). LibreOffice lo actualiza al pedirlo. El índice del PDF lleva sus números porque el núcleo compone las páginas.
