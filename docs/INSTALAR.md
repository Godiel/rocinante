# Instalar Rocinante

Descarga el instalador de tu sistema desde la última versión publicada, en las [Releases del repositorio](https://github.com/Godiel/rocinante/releases/latest). Rocinante no necesita nada más: ni cuenta, ni registro, ni conexión para escribir.

| Sistema | Archivo |
|---|---|
| Windows 10 y 11 | `Rocinante_x.y.z_x64-setup.exe` |
| macOS 11 o posterior (Apple Silicon e Intel) | `Rocinante_x.y.z_universal.dmg` |
| Linux (cualquier distribución) | `Rocinante_x.y.z_amd64.AppImage` |
| Debian, Ubuntu y derivadas | `Rocinante_x.y.z_amd64.deb` |

Los instaladores **aún no están firmados**: el sistema avisa de que no conoce al editor. Es normal en proyectos de código abierto. Estos son los pasos para abrirlos la primera vez.

## Windows

1. Abre `Rocinante_…-setup.exe`.
2. Si aparece «Windows protegió su PC», pulsa **Más información** y después **Ejecutar de todas formas**.
3. El instalador pone Rocinante en tu usuario, sin pedir permisos de administrador, y lo añade al menú Inicio.

Para desinstalarlo: Configuración → Aplicaciones → Rocinante → Desinstalar. Tus obras no se tocan.

## macOS

1. Abre el `.dmg` y arrastra **Rocinante** a la carpeta **Aplicaciones**.
2. La primera vez, en Aplicaciones, haz **clic derecho** (o Control + clic) sobre Rocinante y elige **Abrir**. Después, **Abrir** otra vez en el aviso.
3. Si macOS no deja abrirlo, ve a Ajustes del Sistema → Privacidad y seguridad. Abajo verás «Rocinante se ha bloqueado»: pulsa **Abrir igualmente**.

A partir de ahí se abre con un clic, como cualquier otra app.

## Linux

**AppImage** (cualquier distribución):

1. Dale permiso de ejecución: clic derecho → Propiedades → Permisos → «Permitir ejecutar como programa». O, en una terminal, `chmod +x Rocinante_*.AppImage`.
2. Ábrelo con doble clic.

**.deb** (Debian, Ubuntu y derivadas): ábrelo con el instalador de software, o en una terminal `sudo apt install ./Rocinante_*.deb`.

Para guardar las claves del escudero, Rocinante usa el almacén de claves del escritorio a través de `secret-tool` (paquete `libsecret-tools` en Debian y Ubuntu).

## Tus obras

Una obra es un archivo `.rocinante`. Con Rocinante instalado, se abre con **doble clic**. Las obras son tuyas: desinstalar Rocinante no las borra.

## Versiones nuevas

Al abrir una obra, Rocinante mira si hay una versión nueva. Si la hay, avisa en la barra: «Versión x.y.z disponible». Puedes actualizar en el momento, con la obra guardada antes y vuelta a abrir después, o dejarlo para más tarde. Las actualizaciones van firmadas con la clave del proyecto, y Rocinante no instala nada cuya firma no coincida.

Si prefieres que Rocinante no se conecte nunca por su cuenta, desmarca «Buscar versiones nuevas de Rocinante al abrir una obra» en la pantalla de inicio.
