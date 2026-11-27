# 013 · Pulido de la primera salida

**Estado:** propuesta.

## Qué hace

Corrige lo que el autor encontró al usar la 0.9.0 en una ventana normal. Es la base de la **0.9.1**, que servirá también para probar la primera actualización real.

**La barra de la obra cabe en cualquier ventana**
- La barra nunca se superpone: en una ventana estrecha, lo que no cabe pasa a un **menú «Más»**.
- Siempre a la vista:
  - a la izquierda, Índice, el título de la obra y las pestañas Escritura, Tablero e Hilos;
  - a la derecha, lo más usado: Fichas, Notas, Escudero y Exportar.
- En el menú «Más», en orden: Ambiente, Concentración, Páginas, Formato, Versiones, Otra ventana, el tema (Luz de vela / Papel), Rodillo, Contador, Teclas rápidas y Cerrar proyecto.
- En una ventana ancha, lo que quepa vuelve a la barra. El menú se abre y se recorre con el teclado.

**Letra que se lee**
- Los textos de la interfaz (la barra, el índice, los paneles y las etiquetas en versalitas) tienen más contraste y más cuerpo:
  - la tinta es más oscura;
  - el grosor pasa a medio (500) en versalitas y botones.
- El texto de la obra no cambia: lo decide el formato de la obra.
- Los colores siguen cumpliendo el contraste WCAG AA, comprobado por los tests, y en los dos temas.

**Una barra de ventana propia**
- La barra de título del sistema se cambia por una de Rocinante:
  - del color del papel, **algo más oscura en «papel» y algo más clara en «luz de vela»**, para que se distinga del texto;
  - con el título de la obra en versalitas.
- Se arrastra para mover la ventana. Doble clic la maximiza o la restaura.
- **Windows y Linux:** tiene sus botones propios de minimizar, maximizar y cerrar, discretos y con la tinta del tema.
- **macOS:** conserva los tres semáforos del sistema, sobre la barra propia.
- En modo concentración y en pantalla completa desaparece, como hoy.

**Escribir en un capítulo nuevo**
- Un capítulo vacío muestra su título y, en la primera línea, una invitación tenue: «Empieza a escribir…».
- **Un clic en cualquier parte de la hoja** lleva el cursor al texto: al final si se pulsa debajo del texto, o al principio si está vacío.
- Al crear un capítulo, el cursor espera en su nombre. Si se sale de él sin escribirlo, conserva «Capítulo sin título» y el cursor pasa al texto.

**Teclas rápidas (F1)**
- **F1**, o «Teclas rápidas» en el menú «Más», abre un resumen de todos los atajos agrupados:
  - las vistas (F2, F5, F6, F7, F8, F9, F11);
  - los paneles (Ctrl+Mayús+E, N e I);
  - escribir y dar formato (negrita, cursiva, títulos, nota, nota al pie, separador de escena…);
  - las versiones (Ctrl+S).
- En macOS dice ⌘ en vez de Ctrl.
- Se cierra con Escape o con F1. La lista sale de la misma tabla que usa la app, así que nunca miente.

## Por qué

La 0.9.0 se probó a pantalla completa. En una ventana normal la barra se pisaba, la letra fina y clara se perdía, la barra del sistema desentonaba y un capítulo nuevo no dejaba ver dónde escribir. Son cosas que hacen que un escritor deje la app el primer día.

## Decisiones

- **Menús agrupados**, como pidió el autor.
- **Barra de ventana propia**, del color del papel, más oscura en papel y más clara en luz de vela, como pidió el autor.
- **F1** para las teclas rápidas, como pidió el autor.
- **Tomadas sin consultar:**
  - qué queda siempre a la vista en la barra y qué va al menú «Más»;
  - el grosor 500 para la interfaz;
  - la invitación «Empieza a escribir…».

## Criterios de aceptación

- [ ] A 1024 × 640, el tamaño mínimo de la ventana, y a cualquier tamaño mayor, nada de la barra se superpone y todo se alcanza, en la barra o en «Más». El menú funciona con el teclado.
- [ ] Los textos de la interfaz usan tinta más oscura y grosor 500, y los dos temas pasan el test de contraste AA.
- [ ] La barra de ventana propia se arrastra, maximiza con doble clic, minimiza, maximiza y cierra, con el tono del tema. En macOS conserva los semáforos. En concentración no está.
- [ ] En un capítulo nuevo y vacío, un clic en cualquier parte de la hoja deja escribir, y se ve dónde.
- [ ] F1 abre las teclas rápidas, sacadas de la tabla de atajos de la app, con ⌘ en macOS.
- [ ] Tests de comportamiento para cada punto y una prueba de extremo a extremo: ventana estrecha, capítulo nuevo sin nombre, F1.
- [ ] Se publica como 0.9.1 y la 0.9.0 instalada la recibe por el actualizador.

## Fuera de alcance

- **Microsoft Store**: es una feature propia, la **014**, si el autor la aprueba (ver la investigación abajo).
- Cambiar la tipografía del texto de la obra.

## Investigación: Microsoft Store

Resumen de la documentación oficial de Microsoft y de Tauri, consultada el 2026-11-27.

- **La cuenta individual es gratuita** desde 2025, en storedeveloper.microsoft.com. Se verifica la identidad con un documento y un selfie, y está disponible en casi 200 países.
- **Hay dos caminos para publicar:**
  - **MSIX:** la Store **firma el paquete ella misma**, sin certificado de pago. Lo instala con un clic, **sin avisos de SmartScreen**, y lo actualiza sola cada 24 horas.
    - Tauri no genera MSIX: se hace con la herramienta `winapp` de Microsoft, que aún está en vista previa.
    - En esa compilación se apaga el actualizador propio, porque las actualizaciones las da la Store.
    - La versión no puede empezar por 0: la primera publicable en la Store sería la **1.0.0**.
  - **Instalador .exe:** es el camino de la guía de Tauri, pero **exige el instalador firmado con un certificado de confianza**. Sin firma está bloqueado.
- **Lo que tendrías que hacer tú:**
  - crear la cuenta y reservar el nombre «Rocinante»;
  - publicar una **política de privacidad** en una dirección pública;
  - en la ficha, declarar que hay IA generativa opcional y dar una forma de denunciar contenido inapropiado;
  - escribir notas para los revisores, con cómo probar la app con y sin clave de IA.
- **La revisión** tarda hasta 3 días hábiles.
- **Conclusión:** el camino MSIX es el único que quita los avisos en Windows sin pagar un certificado. Tiene sentido para la **1.0**, como feature 014.
