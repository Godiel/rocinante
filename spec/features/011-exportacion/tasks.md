# 011 · Exportación — Tareas

Checklist derivada de [`plan.md`](plan.md). Rama: `feature/011-exportacion`.

## 1. Contrato (versión 14)
- [x] `book.*`, `export.run` y `export.progress`, con ejemplos.

## 2. Dominio
- [x] `BookDetails` y `Book` leído de los capítulos, con tests.

## 3. Persistencia (esquema v8)
- [x] Tabla `book` y `docs/format`.

## 4. Escritores
- [x] Markdown.
- [x] EPUB 3.
- [x] Word (`.docx`).
- [x] PDF: fuentes WOFF → TrueType, composición y escritura.

## 5. Casos de uso y sidecar
- [x] Datos del libro, exportación con avance y escritura segura, en la sesión de escritura de los tests.

## 6. Interfaz
- [x] Diálogo Exportar con F9, formato, partes, autor, créditos, portada, guardar, avance y «Mostrar en la carpeta».

## 7. Pruebas de extremo a extremo y de rendimiento
- [x] Una obra exportada a los cuatro formatos.
- [x] Una obra de 150 000 palabras a PDF y a los demás formatos.
- [ ] Todo en verde en la CI.

## 8. Validación y cierre
- [x] Criterios, `tech-stack.md`, hoja de ruta y PR.
