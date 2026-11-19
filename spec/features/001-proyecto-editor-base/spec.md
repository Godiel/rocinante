# 001 · Proyecto y editor base

**Estado:** hecha

## Qué hace

Es la primera versión usable de Rocinante: abrir la app, crear una obra y escribirla.

**Al abrir la app**
- La primera vez, o si el último proyecto se cerró, aparece una **pantalla de bienvenida** con los proyectos recientes y las opciones «Nuevo proyecto» y «Abrir proyecto».
- Las demás veces se abre **directamente el último proyecto** en el punto donde se dejó: mismo capítulo y misma posición del cursor.

**El proyecto**
- Un proyecto es un único archivo `.rocinante` que contiene la obra completa.
- Por defecto se guarda en `Documentos/Rocinante`, pero el escritor puede elegir otra ubicación al crearlo o con «Guardar como».
- Se abre con «Abrir proyecto», desde la lista de recientes o con doble clic en el archivo desde el sistema operativo.

**Capítulos y fragmentos**
- La obra tiene **capítulos** en un orden y un **cajón de fragmentos**: textos sueltos y discontinuos que se escriben aparte, sin lugar fijo en la obra.
- Los capítulos y fragmentos se crean, renombran, reordenan (arrastrando), eliminan y mueven entre sí: un fragmento puede pasar a ser capítulo y viceversa.
- El **índice** es una vista aparte que se abre y cierra a voluntad. Puede quedarse **anclado** al lateral o **flotar** sobre el texto y ocultarse al volver a escribir.

**El editor**
- Se escribe sobre **papel continuo sin bordes**, con márgenes generosos y el estilo visual de la constitución (temas «papel» y «luz de vela»).
- **Desplazamiento tipo rodillo:** la línea activa se mantiene a la altura de los ojos mientras se escribe. Se puede desactivar.
- **Cursor de máquina de escribir (condicional):** forma de bloque o barra gruesa. Se intenta con un tiempo acotado; si resulta demasiado complejo o poco fiable en algún sistema, se deja el cursor normal y se avisa al autor antes de descartarlo.
- **Sin barra de herramientas fija:** al seleccionar texto aparece un menú flotante discreto. Todo el formato tiene atajos de teclado.
- **Formato disponible:** negrita, cursiva, subrayado, títulos, citas, listas, sangrías, separador de escena (florón) y notas al pie.
- **Notas en el texto:** el autor puede anclar una nota en cualquier punto o pasaje del texto: algo puntual que quiere recordar («revisar esta fecha», «aquí Antonio aún no conoce a Claudio»). La nota se ve como una marca discreta junto al texto; al pulsarla se lee y se edita. Las notas son del autor, no de la obra: no forman parte del texto ni de lo que se exporta. Si se borra el pasaje, la nota no se pierde, queda como nota suelta del documento.
- **Contador:** palabras, caracteres, párrafos y número de capítulos, del capítulo actual y de la obra entera. Aparece de forma discreta en una esquina, se atenúa mientras se escribe y se puede ocultar.

**Guardado y versiones**
- **Guardado automático:** el escritor nunca tiene que guardar. Lo escrito se guarda solo, de forma continua.
- **Versiones:** además del guardado automático, se conservan versiones de cada capítulo y fragmento. Se crean automáticamente cada cierto tiempo de trabajo y también a mano («Guardar versión», con un nombre opcional). El escritor puede ver una versión anterior, compararla con la actual y restaurarla.

## Por qué

Es la base de todo lo demás: sin un proyecto que se guarde de forma fiable y un editor cómodo, las tarjetas, el escudero y la exportación no tienen sobre qué trabajar. Es también la primera impresión del producto: debe sentirse como escribir en buen papel desde el primer minuto.

## Criterios de aceptación

**Proyecto**
- [x] Se puede crear un proyecto nuevo; por defecto se propone `Documentos/Rocinante/<nombre>.rocinante` y se puede elegir otra carpeta.
- [ ] Se puede abrir un proyecto desde la bienvenida, desde «Abrir proyecto» y con doble clic en el archivo (Windows, macOS y Linux).
  _Pendiente: abrir un archivo recibido como argumento funciona y está comprobado en Windows; la asociación de `.rocinante` con la app llega con los instaladores (012), y macOS y Linux faltan por comprobar._
- [x] La primera vez se muestra la bienvenida; las siguientes se abre el último proyecto en el mismo capítulo y posición del cursor.
- [x] Si el último proyecto ya no existe o no se puede abrir, se muestra la bienvenida con un mensaje claro, sin errores técnicos.
- [x] Abrir un archivo que no es un `.rocinante` válido muestra un mensaje claro y no daña el archivo.

**Capítulos y fragmentos**
- [x] Se pueden crear, renombrar, reordenar arrastrando y eliminar capítulos y fragmentos.
- [x] Un fragmento se puede convertir en capítulo y un capítulo en fragmento sin perder su texto.
- [x] Eliminar un capítulo o fragmento pide confirmación y se puede deshacer.
- [x] El índice se abre y cierra con un atajo de teclado y puede quedar anclado o flotante; la preferencia se recuerda.

**Editor**
- [x] El texto se escribe sobre papel sin bordes, con el ancho de columna y los márgenes de la constitución, en ambos temas.
- [x] El desplazamiento tipo rodillo mantiene la línea activa a la altura de los ojos; se puede desactivar.
- [x] El cursor tiene forma de máquina de escribir **o** el autor ha decidido descartarlo tras conocer el motivo.
- [x] Al seleccionar texto aparece el menú flotante; al deseleccionar desaparece.
- [x] Negrita, cursiva, subrayado, títulos, citas, listas, sangrías, separador de escena y notas al pie funcionan con el menú y con atajos.
- [x] Se puede anclar una nota en un punto o en un pasaje seleccionado, verla con su marca discreta, editarla y eliminarla.
- [x] Las notas no alteran el texto de la obra ni el contador.
- [x] Si se borra el pasaje donde estaba anclada, la nota se conserva como nota suelta del documento.
- [x] Deshacer y rehacer funcionan para todo cambio de texto y formato.
- [x] El contador muestra palabras, caracteres, párrafos y capítulos del capítulo actual y de la obra, y se actualiza mientras se escribe. Está en una esquina, se atenúa al escribir y se puede ocultar.
- [x] Escribir sigue siendo fluido (sin retraso perceptible al teclear) en un capítulo de 20 000 palabras y en una obra de 150 000 palabras.

**Guardado y versiones**
- [x] Todo cambio queda guardado en menos de 2 segundos sin ninguna acción del escritor.
- [x] Si la app se cierra de golpe (proceso terminado o corte de luz simulado), al reabrir el proyecto se pierde como máximo lo escrito en los últimos 2 segundos y el archivo nunca queda corrupto.
- [x] Se crean versiones automáticas periódicas y se puede guardar una versión a mano con nombre.
- [x] Se puede ver una versión anterior, compararla con la actual y restaurarla; restaurar crea a su vez una versión de lo que había, para que nada se pierda.

**Calidad (constitución)**
- [x] La interfaz y el núcleo se comunican mediante el contrato de mensajes versionado, con pruebas de contrato en ambos lados.
- [x] El esquema SQLite del proyecto está documentado, versionado y tiene migraciones.
- [x] Tests del dominio del núcleo con cobertura ≥ 80 %; tests de comportamiento de la interfaz; un test de extremo a extremo de «crear proyecto, escribir, cerrar, reabrir».
- [x] Los errores quedan en el log local sin incluir texto de la obra.
- [x] CI compila y prueba en Windows, macOS y Linux.

## Fuera de alcance

- Vista de página con tamaño de libro, márgenes configurables y elección de tipografía → **002 · Hoja de escritura**.
- Modo concentración, fondos y sonidos de tecleo → **003 · Modo concentración y ambiente**.
- Ideas sueltas del proyecto, notas enlazadas a personajes o lugares y la vista de todas las notas → **005 · Notas e ideas**.
- Personajes, lugares, tablero y escudero → **004** en adelante.
- Exportación a otros formatos → **011 · Exportación**.
- Instaladores y actualizaciones automáticas → **012 · Distribución**. En la 001 la app se ejecuta en modo desarrollo.
