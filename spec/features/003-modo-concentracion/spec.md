# 003 · Modo concentración y ambiente

**Estado:** hecha. Quedan dos materiales por incluir y una comprobación (ver «Pendiente»).

## Qué hace

Un **modo concentración** deja la pantalla con solo el texto, sobre un fondo relajante. El escritor puede acompañar la escritura con **sonidos**: el tecleo de una máquina de escribir u otro, y ambientes de fondo como la lluvia o una chimenea. Todo es opcional: se activa, se elige y se ajusta su volumen.

**El modo concentración**
- Se entra y se sale con **F11**. **Esc** también sale; si hay un menú abierto en el editor, Esc lo cierra primero. También se entra desde un botón de la barra de la obra.
- La ventana pasa a pantalla completa y solo queda el texto. No hay índice, barra ni paneles.
- Al llevar el ratón al borde superior aparece una **barra mínima**: contador de palabras, meta de la sesión, ambiente y salir. Se esconde sola al volver a escribir o al apartar el ratón.
- Al salir, todo vuelve a como estaba, con el cursor en el mismo punto.

**Fondos**
- Solo se ven en el modo concentración.
- Hay tres tipos:
  - **colores y degradados** suaves y cálidos;
  - **imágenes** fijas: paisajes o interiores tranquilos;
  - **animados sutiles:** lluvia en un cristal, una vela que parpadea o nubes lentas.
- El texto se escribe sobre una **hoja translúcida**: una columna de papel algo transparente sobre el fondo. Se lee siempre bien con cualquier fondo y en los dos temas.
- Si el sistema pide **reducir el movimiento**, los fondos animados se quedan quietos.

**Sonidos**
- Se pueden usar **siempre**: al escribir en el modo concentración y fuera de él.
- **Tecleo:** cada pulsación que escribe en el texto suena. Las teclas de atajo y las flechas no suenan. Hay tres tecleos:
  - **máquina de escribir**, con campanilla y retorno de carro al pulsar Intro;
  - **teclado mecánico**;
  - **pluma sobre papel**.
- **Ambientes de fondo:** lluvia, chimenea, café y campo. Suenan en bucle, sin cortes. Se pueden **mezclar varios a la vez**, cada uno con su propio nivel.
- **Volumen:** un control para el tecleo y otro general para los ambientes, cada uno con su silencio.
- Los sonidos paran al cerrar la obra.

**Ayudas de concentración**
- **Atenuar el resto:** solo el párrafo donde se escribe tiene toda su tinta; el resto queda tenue. Se activa o no.
- **Meta de la sesión:** palabras nuevas («500 palabras») o tiempo de escritura («45 minutos»).
  - Se ve un progreso discreto en la barra mínima.
  - Al cumplirla aparece un aviso suave, sin sonido brusco y sin sacar al escritor del texto.
  - La sesión empieza al entrar en el modo concentración y termina al salir.

**Fondos y sonidos propios**
- El escritor puede añadir sus propias **imágenes** como fondo y sus propios **sonidos** como ambiente.
- Rocinante guarda una copia en su carpeta de datos: si el original se mueve o se borra, sigue funcionando.
- Los propios se pueden quitar.

**Del escritor, no de la obra**
- El fondo, los sonidos, los volúmenes, las ayudas y la meta son del escritor: se guardan en la configuración de la app, como el tema, y valen para todas las obras.

## Por qué

Escribir pide entrar en la historia y quedarse en ella. Una pantalla sin nada más que el texto, un fondo tranquilo y un sonido que acompaña ayudan a concentrarse. El tecleo de una máquina de escribir cuenta que se está avanzando, y la lluvia tapa el ruido de alrededor. Es lo que hace que Rocinante se sienta como un lugar para escribir y no solo como un programa.

## Criterios de aceptación

**Modo concentración**
- [x] F11 entra y sale del modo concentración; Esc sale; el botón de la barra entra. Con un menú del editor abierto, Esc lo cierra sin salir.
- [ ] En el modo concentración la ventana ocupa toda la pantalla y solo se ve el texto, en Windows, macOS y Linux. _(Comprobado en Windows; en macOS y Linux, con los instaladores de la 012.)_
- [x] La barra mínima aparece al llevar el ratón arriba y se esconde al escribir. Desde ella se ve el contador y la meta, se cambia el ambiente y se sale.
- [x] Al salir se vuelve a la vista de escritura con el cursor en el mismo sitio y sin perder nada de lo escrito.

**Fondos**
- [ ] Se puede elegir entre los fondos incluidos: colores y degradados, imágenes y animados. _(Faltan las imágenes incluidas; las propias sí funcionan.)_
- [x] El texto sobre la hoja translúcida cumple WCAG AA con cualquier fondo incluido y en los dos temas.
- [x] Con «reducir el movimiento» activado en el sistema, los fondos animados no se mueven.
- [x] Un fondo animado no hace que escribir sea menos fluido.

**Sonidos**
- [x] Cada pulsación que escribe suena con el tecleo elegido, sin retraso perceptible. Los atajos y las flechas no suenan. Con la máquina de escribir, Intro suena a retorno de carro.
- [x] Los ambientes suenan en bucle sin cortes. Se pueden mezclar varios, cada uno con su nivel.
- [x] El volumen del tecleo y el de los ambientes se ajustan y se silencian por separado.
- [x] Los sonidos funcionan dentro y fuera del modo concentración, y paran al cerrar la obra.
- [x] Con el tecleo activo, escribir sigue igual de fluido que sin él.

**Ayudas**
- [x] «Atenuar el resto» deja con toda su tinta solo el párrafo del cursor.
- [x] Se puede poner una meta de palabras o de minutos. Su progreso se ve en la barra mínima y, al cumplirla, aparece un aviso suave.

**Propios y preferencias**
- [x] Se puede añadir una imagen propia como fondo y un sonido propio como ambiente. Siguen funcionando aunque el original se borre, y se pueden quitar.
- [x] Un archivo que no es una imagen o un sonido válido se rechaza con un mensaje claro.
- [x] El fondo, los sonidos, los volúmenes, las ayudas y la meta se recuerdan al cerrar y abrir la app, y son los mismos en todas las obras.

**Calidad**
- [x] Las preferencias nuevas forman parte del contrato de mensajes, con sus pruebas de contrato.
- [ ] Todos los fondos y sonidos incluidos son de dominio público (CC0). Su origen consta en un archivo de créditos que va con la app. _(Todo lo incluido es CC0 y consta en los créditos, salvo el café, que aún es un sonido provisional generado por el proyecto.)_
- [x] Todo funciona sin internet.
- [x] Tests de comportamiento de la interfaz y una prueba de extremo a extremo: entrar en el modo concentración, elegir un fondo y un ambiente, escribir, salir y volver a abrir la app con todo recordado.

## Pendiente

La feature se fusionó en `main` con la CI en verde en Windows, macOS y Linux. Quedan:

- **Imágenes incluidas:** tres paisajes de Beruete en dominio público. Wikimedia limitó la descarga automática; las descarga el autor.
- **Café:** una grabación CC0 de Freesound, que pide cuenta para descargar. Hasta entonces suena un sonido provisional generado por el proyecto.
- **Pantalla completa en macOS y Linux:** se comprueba en la app real con los instaladores (012).

## Fuera de alcance

- **Estadísticas de sesiones** y metas diarias o de la obra (historial de palabras por día, rachas). Queda en el backlog.
- **Colección amplia** de fondos y sonidos: se incluyen pocos y cuidados, unos 3 tecleos, 4 ambientes y 6 fondos.
- **Sonidos propios de tecleo:** lo propio es solo para fondos y ambientes.
- **Fondos fuera del modo concentración:** la vista normal de escritura mantiene su papel.
- **Música** o listas de reproducción.
