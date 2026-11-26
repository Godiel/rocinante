# 011 · Exportación

**Estado:** hecha. Quedan por comprobar a mano EPUBCheck y abrir el `.docx` en Word (ver los criterios).

## Qué hace

La obra sale de Rocinante como un libro: en **PDF**, **EPUB**, **Word (`.docx`)** o **Markdown (`.md`)**, con el formato de hoja que eligió el escritor en la 002. La exportación lee la obra, nunca la cambia.

**Qué sale**
- **Los capítulos**, en su orden, con sus títulos y sus notas al pie. Los fragmentos del cajón, las notas del autor, las fichas y los hilos no salen, como en la vista de página.
- **Portada:** el título de la obra y el nombre del autor. En EPUB se puede añadir una **imagen de portada**.
- **Página de créditos:** un texto que escribe el autor, que por defecto es «© {año} {autor}. Todos los derechos reservados.».
- **Índice** de capítulos: con números de página en PDF y en Word, y con enlaces en EPUB.
- Cada parte (portada, créditos, índice) se puede quitar al exportar.

**El autor y los datos del libro**
- Cada obra guarda **su autor** en su archivo `.rocinante`: un nombre o un seudónimo.
- También guarda el texto de **créditos** y, si la hay, la imagen de portada.
- Se escriben en el diálogo de exportación y se recuerdan para la próxima vez.

**Cada formato**
- **PDF:** un libro listo para imprimir.
  - Usa el tamaño de hoja, los márgenes (interior y exterior en páginas enfrentadas), la tipografía (incrustada), el cuerpo, el interlineado, la sangría, la justificación y la capitular de la obra.
  - Como en la vista de página, cada capítulo empieza en página nueva y cada hoja lleva su número.
- **EPUB 3:** un libro electrónico en el que el lector elige la letra. Lleva la tipografía de la obra como sugerencia, el título y el autor en sus datos, y el índice para navegar.
- **Word (`.docx`):** para enviarlo a una editorial o seguir con él en otro programa.
  - Lleva el tamaño de hoja, los márgenes, la tipografía, el cuerpo, el interlineado, la sangría y la justificación.
  - Los títulos de capítulo usan estilos de título y las notas al pie son notas al pie de Word.
- **Markdown (`.md`):** el texto limpio, con los títulos como encabezados, las cursivas y negritas como marcas y las notas al pie con la sintaxis `[^1]`.
- En los cuatro formatos se conservan la cursiva, la negrita, el subrayado (salvo en Markdown), las citas, las listas, los títulos dentro del texto y los separadores de escena.

**Exportar**
- **«Exportar»** está en la barra de la obra y se abre también con **F9**.
- El diálogo pide:
  - el formato;
  - qué partes lleva (portada, créditos, índice);
  - el autor, los créditos y la imagen de portada, si el formato es EPUB.
- Después se elige dónde guardar el archivo, con el título de la obra como nombre propuesto.
- Mientras se exporta se ve el avance. Al terminar, se puede **mostrar el archivo en su carpeta**.
- Si algo falla (no se puede escribir en la carpeta, no queda espacio), se dice con calma y la obra queda como estaba.

## Por qué

Un libro escrito tiene que poder salir: a imprenta, a un lector de libros electrónicos, a una editorial que pide Word o a otro programa. El escritor eligió con cuidado su hoja y su letra en la 002, y eso es lo que debe salir, sin volver a maquetar fuera.

## Decisiones

- **Solo los capítulos**, como pidió el autor.
- **Portada, índice y página de créditos**, como pidió el autor, y cada una se puede quitar al exportar.
- **El autor se guarda en cada obra**, como pidió el autor.
- **Tomadas sin consultar:**
  - **F9** abre la exportación (propuesta: es una función grande y F9 está libre);
  - el texto de créditos por defecto;
  - la imagen de portada solo en EPUB, porque en PDF y en Word la portada es tipográfica;
  - la exportación se hace en el núcleo, sin servicios de internet.

## Criterios de aceptación

**Contenido**
- [x] Los cuatro formatos llevan los capítulos en orden, con sus títulos, notas al pie, cursivas, negritas, citas, listas y separadores de escena, y sin los fragmentos ni las notas del autor.
- [x] La portada, los créditos y el índice salen cuando se piden y no salen cuando se quitan. El autor y los créditos se recuerdan en la obra.

**Formato**
- [x] El PDF respeta el tamaño de hoja, los márgenes enfrentados, la tipografía incrustada, el cuerpo, el interlineado, la sangría, la justificación y la capitular. Cada capítulo empieza en página nueva y las hojas van numeradas.
- [ ] El EPUB es válido para EPUB 3 (EPUBCheck sin errores), con título, autor, idioma, índice navegable y, si se eligió, imagen de portada. _Los tests comprueban la estructura que pide EPUB 3; EPUBCheck, que es un programa Java, queda por pasar a mano._
- [ ] El `.docx` se abre en Word y en LibreOffice con el tamaño de hoja, los márgenes, la tipografía, los estilos de título y las notas al pie. _Comprobado en LibreOffice; en Word, pendiente._
- [x] El `.md` se lee bien en cualquier visor de Markdown, con las notas al pie en sintaxis `[^1]`.

**Exportar**
- [x] «Exportar» y F9 abren el diálogo; se elige formato, partes y lugar, se ve el avance y al terminar se puede mostrar el archivo.
- [x] Una obra de 150 000 palabras se exporta a PDF en menos de 30 segundos, y a los demás formatos en menos de 10, sin bloquear la escritura en otras ventanas.
- [x] Si la exportación falla, se dice por qué y no queda un archivo a medias.

**Calidad**
- [x] Los métodos nuevos forman parte del contrato. El autor, los créditos y la portada se guardan en el `.rocinante` con una migración documentada.
- [x] Las dependencias nuevas tienen licencias compatibles con MIT.
- [x] Los registros no contienen el texto de la obra ni las rutas de los archivos.
- [x] Tests del núcleo para cada formato (estructura, contenido y formato), y una prueba de extremo a extremo que exporta una obra a los cuatro.

## Fuera de alcance

- **Exportar fragmentos, notas, fichas o los hilos.**
- **Imprimir** directamente desde Rocinante: se exporta a PDF y se imprime desde el lector de PDF.
- **Publicar** en tiendas o plataformas.
- **Importar** desde Word u otros formatos.
- Plantillas de maquetación distintas del formato de la obra.
