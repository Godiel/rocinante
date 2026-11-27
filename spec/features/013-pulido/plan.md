# 013 · Pulido de la primera salida — Plan

Cómo se implementa lo descrito en [`spec.md`](spec.md). Todo es interfaz y anfitrión: el núcleo no cambia.

## Implementación

1. **Una tabla de atajos** (`features/shortcuts/table.ts`): cada atajo con sus teclas, qué hace y su grupo. Los comprobadores de teclas que ya existen siguen siendo la fuente de cada tecla; la tabla los nombra para mostrarlos, y un test comprueba que coinciden.
2. **Teclas rápidas (F1):** un diálogo que lee la tabla y escribe ⌘ o Ctrl según el sistema.
3. **La barra de la obra:** los botones se reparten entre la barra y el menú «Más» según el ancho. Cada botón tiene una prioridad; un `ResizeObserver` mide la barra y deja en ella los que caben. El menú es un botón con `aria-haspopup` y una lista navegable con las flechas.
4. **Letra legible:** el peso 500 de la tipografía de la interfaz, una tinta secundaria más oscura en los dos temas (`themes.ts`), y el test de contraste al día.
5. **Barra de ventana propia:**
   - `decorations: false` en Windows y Linux, `titleBarStyle: "Overlay"` en macOS, también en las ventanas que se abren después;
   - un componente `TitleBar` con la zona de arrastre (`data-tauri-drag-region`) y los botones, que usan los permisos de ventana de Tauri;
   - el color sale de un token nuevo, `--color-titlebar`.
6. **Escribir en un capítulo vacío:** la invitación como marcador de TipTap (la extensión `Placeholder`, MIT, ya incluida en `@tiptap/extensions`), y un clic en la hoja que lleva el foco al editor. Al salir del nombre de un capítulo nuevo, el foco pasa al texto.
7. **Pruebas de extremo a extremo**, la 0.9.1 y su publicación.
