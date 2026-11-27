# 012 · Distribución

**Estado:** hecha. Falta probar los instaladores en cada sistema, y la clave del actualizador que guarda el autor (ver los criterios).

## Qué hace

Rocinante se instala como cualquier programa: se descarga el instalador del sistema, se abre y se escribe. Sin cuenta, sin registro y sin nada más que instalar. Y avisa cuando hay una versión nueva, para actualizarse si el escritor quiere.

**Los instaladores**
- **Windows:** un instalador `.exe` que instala Rocinante **para el usuario**, sin pedir permisos de administrador, con su entrada en el menú Inicio y su desinstalador.
- **macOS:** una imagen `.dmg` **universal** (Apple Silicon e Intel): se arrastra Rocinante a Aplicaciones.
- **Linux:**
  - un **AppImage**, que funciona en casi cualquier distribución sin instalar;
  - un **`.deb`** para Debian, Ubuntu y derivadas.
- En los tres sistemas, los archivos **`.rocinante`** llevan el icono de Rocinante y **se abren con doble clic**.
- Cada instalador trae todo: la app, el núcleo, las tipografías, los fondos y los sonidos incluidos. No descarga nada al instalarse.

**Sin firma, por ahora**
- Los instaladores no van firmados, como muchos proyectos de código abierto en GitHub:
  - **Windows** avisa de «editor desconocido»: se abre con «Más información» → «Ejecutar de todas formas».
  - **macOS** lo abre la primera vez con clic derecho → «Abrir», o desde Ajustes del Sistema → Privacidad y seguridad → «Abrir igualmente».
- Una página **Instalar** del repositorio lo explica paso a paso para cada sistema.
- La CI queda **preparada para firmar**: en cuanto haya certificados, basta con guardarlos como secretos del repositorio.

**Publicar una versión**
- La versión de Rocinante está en un solo sitio. Una orden la cambia en la app, la interfaz y el núcleo a la vez.
- Al crear una etiqueta de versión (`v1.0.0`), la CI construye los instaladores de los tres sistemas y los deja en una **Release de GitHub en borrador**, con la página de cambios. El autor la revisa y la publica.

**Avisar y actualizar**
- Al abrir, Rocinante **comprueba si hay una versión nueva**, con una sola petición a GitHub, después de que la obra esté abierta para no retrasar nada.
- Si la hay, aparece un aviso discreto en la barra: «Versión 1.1 disponible». Al pulsarlo se ven sus novedades y dos opciones:
  - **«Actualizar y reiniciar»**: guarda todo, descarga la actualización, la instala y vuelve a abrir la obra;
  - **«Ahora no»**.
- La actualización está **firmada** con una clave propia del proyecto (gratuita), y Rocinante no instala nada cuya firma no coincida.
- Sin conexión no pasa nada: no hay aviso y todo funciona igual.
- En las preferencias se puede **dejar de buscar versiones nuevas**. Entonces Rocinante no se conecta nunca por su cuenta.

## Por qué

La misión es «instalar y escribir»: un escritor no tiene por qué saber qué es .NET ni una terminal. Los instaladores de cada sistema, con el doble clic en la obra, son lo último que falta para la versión 1. Y una app que se corrige y mejora tiene que poder llegar al escritor sin que la busque, siempre con su permiso.

## Decisiones

- **Sin firma por ahora**, como pidió el autor: los certificados de Windows son de pago. Hay una vía gratuita para proyectos de código abierto, SignPath Foundation, a la que el autor puede presentarse. La CI queda lista para firmar.
- **GitHub Releases en borrador**, como pidió el autor.
- **Los paquetes habituales:** `.exe` por usuario, `.dmg` universal, AppImage y `.deb`, como pidió el autor.
- **Avisar y actualizar**, como pidió el autor, con el actualizador de Tauri.
- **Tomadas sin consultar:**
  - la comprobación espera a que la obra esté abierta;
  - se puede desactivar en las preferencias;
  - la clave de firma de las actualizaciones la genera y la guarda el autor como secreto del repositorio, y nunca está en el proyecto.

## Dependencias nuevas

Hay que descargarlas: piden la aprobación del autor.

- **`tauri-plugin-updater`** (crate de Rust y paquete npm `@tauri-apps/plugin-updater`), de Tauri, con licencia MIT o Apache-2.0: comprueba, descarga, verifica la firma e instala las actualizaciones.
- **`tauri-plugin-process`** (crate y `@tauri-apps/plugin-process`), de Tauri, con licencia MIT o Apache-2.0: reinicia la app tras actualizar.
- **`tauri-apps/tauri-action`**, la acción de GitHub de Tauri para construir y publicar las Releases, con licencia MIT. Solo la usa la CI.

## Criterios de aceptación

**Instaladores**
- [x] La CI construye, a partir de una etiqueta `v*`, el `.exe` de Windows, el `.dmg` universal de macOS y el AppImage y el `.deb` de Linux, y los deja en una Release en borrador con su `latest.json`. _El empaquetado de las PR construye los cuatro paquetes en verde; la Release se probará con la primera etiqueta._
- [ ] En Windows se instala sin permisos de administrador y se desinstala desde el sistema. _Configurado (NSIS por usuario); falta instalarlo a mano._
- [ ] En los tres sistemas, un `.rocinante` se abre con doble clic en Rocinante y lleva su icono. _Configurado; falta probarlo instalado en cada sistema._
- [ ] La app instalada abre, crea una obra, escribe y exporta sin nada más instalado ni conexión. _Falta probarlo instalado en cada sistema._
- [x] La página Instalar explica cómo abrir los instaladores sin firmar en cada sistema.

**Versiones**
- [x] Una orden cambia la versión en `tauri.conf.json`, los `package.json`, `Cargo.toml` y el núcleo. La CI comprueba que coinciden.
- [ ] Al abrir, con conexión y una versión nueva publicada, aparece el aviso. «Actualizar y reiniciar» guarda, actualiza y vuelve a abrir la obra. «Ahora no» lo deja para la próxima vez. _Probado con el actualizador simulado; la prueba real necesita la clave del autor y dos Releases publicadas._
- [x] Sin conexión, o con la búsqueda desactivada, no hay petición ni aviso, y nada cambia.
- [x] Una actualización con una firma que no coincide no se instala, y se dice con calma. _El actualizador de Tauri la rechaza; probado el mensaje con el actualizador simulado._

**Calidad**
- [x] Los registros no contienen rutas ni nada de la obra. La comprobación de versión no manda nada del escritor.
- [x] Tests de la interfaz para el aviso y el diálogo, con el actualizador simulado. La CI construye los instaladores en cada PR que toque el empaquetado.

## Fuera de alcance

- **Firmar** los instaladores: queda preparado para cuando haya certificados.
- Tiendas: Microsoft Store, Mac App Store, Flathub, Snap.
- Paquetes `.msi` y `.rpm`.
- Actualizar sin preguntar al escritor.
