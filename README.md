# Rocinante

**Un entorno de texto para escritores.** Se instala y se escribe: sin cuenta, sin licencia y sin conexión.

Rocinante es una aplicación de escritorio para Windows, macOS y Linux. Además de un editor cuidado, ayuda a no perder el hilo de la propia obra: personajes, lugares, tramas y las relaciones entre ellos, en un tablero de tarjetas que se actualiza mientras se escribe.

> **Estado:** versión 1 casi lista. El avance está en el [roadmap](spec/constitution/roadmap.md).

## Instalar

Descarga el instalador de tu sistema desde las [Releases](https://github.com/Godiel/rocinante/releases/latest). La página [Instalar](docs/INSTALAR.md) explica cómo abrirlo la primera vez, porque los instaladores aún no están firmados.

## Qué hace

- **Papel sin bordes** con tipografía de libro, cursor de máquina de escribir y modo concentración.
- **Proyectos `.rocinante`:** un archivo que es la obra completa, con capítulos, fragmentos sueltos, notas, versiones, personajes y relaciones.
- **Tablero de tarjetas** que se puede llevar a otra pantalla.
- **Escudero:** un asistente opcional con la IA que el escritor elija, incluidos modelos locales, que lee para organizar y nunca escribe por él.
- **Exportación** a `.docx`, PDF, EPUB y Markdown.

Los detalles están en la [misión](spec/constitution/mission.md).

## Arquitectura

```
Interfaz   React + TypeScript + TipTap      src/ui
Anfitrión  Tauri 2 (Rust)                   src/host
Núcleo     C# / .NET 10 + SQLite            src/core
```

El anfitrión abre las ventanas y hace de relé: un único proceso del núcleo atiende a todas las ventanas mediante JSON-RPC por entrada y salida estándar, sin puertos abiertos. Las decisiones y su porqué están en [`tech-stack.md`](spec/constitution/tech-stack.md) y en [`docs/adr/`](docs/adr/).

## Desarrollo

Requisitos: [.NET 10 SDK](https://dotnet.microsoft.com/download), [Node.js 24](https://nodejs.org/), [Rust](https://rustup.rs/) y los [requisitos de Tauri](https://v2.tauri.app/start/prerequisites/) de cada sistema.

```bash
npm install
npm run dev
```

`npm run dev` publica el núcleo, arranca la interfaz y abre la app. `npm run build` construye el instalador de este sistema.

**Publicar una versión:** `npm run version:set -- 1.2.0` la cambia en todas partes; se hace commit, se crea la etiqueta `v1.2.0` y se sube. La CI construye los instaladores y los deja en una Release en borrador. Las actualizaciones se firman con la clave del proyecto, que vive en los secretos `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` del repositorio. La [guía de contribución](CONTRIBUTING.md) explica cómo se trabaja en el proyecto.

## Licencia

[MIT](LICENSE).
