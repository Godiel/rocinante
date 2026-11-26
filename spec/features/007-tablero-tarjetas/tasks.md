# 007 · Tablero de tarjetas — Tareas

Checklist derivada de [`plan.md`](plan.md). Cada bloque se cierra con sus tests en verde, y con una comprobación en un navegador real cuando toca la interfaz, antes de pasar al siguiente. Rama: `feature/007-tablero-tarjetas`.

## 1. Contrato de mensajes (versión 10)
- [ ] `board.mentions`, `together` en `element.references`, `suggestions.get`, `suggestion.dismiss` y `suggestions.changed`.
- [ ] Ejemplos válidos e inválidos; tipos de TypeScript regenerados.

## 2. Dominio
- [ ] `NameSuggester` con la regla de la spec.
- [ ] Tests con casos de español.

## 3. Persistencia (esquema v5)
- [ ] Migración `0005-dismissed-names.sql`; repositorio de lo descartado.
- [ ] Una obra v4 se abre sin perder nada; «Guardar como» lo copia.
- [ ] `docs/format` al día.

## 4. Casos de uso y sidecar
- [ ] El índice de menciones guarda el párrafo de cada una.
- [ ] `BoardMentions`, coincidencias en `References`, `Suggestions` y `DismissSuggestion`.
- [ ] El escenario `WritingSession` usa los métodos nuevos.

## 5. Números en las tarjetas
- [ ] `useBoardMentions` y la línea de la tarjeta.
- [ ] Tests y comprobación en un navegador real.

## 6. Coincidencias
- [ ] «Coincide con» en la ficha.
- [ ] Al elegir una tarjeta, las que coinciden siguen a la vista.
- [ ] Tests y comprobación en un navegador real.

## 7. Sugerencias
- [ ] Sección plegable en la pestaña Fichas, con «Crear ficha» y «Descartar».
- [ ] Tests y comprobación en un navegador real.

## 8. Separar el Tablero
- [ ] `open_window` del anfitrión acepta `board`.
- [ ] Ventana del Tablero con «Acoplar»; la de la obra con «Traerlo aquí».
- [ ] Tests y comprobación en un navegador real.

## 9. Pruebas de extremo a extremo y rendimiento
- [ ] El recorrido de la spec.
- [ ] `board.mentions` con 300 fichas en 150 000 palabras por debajo de 1 segundo.
- [ ] Todo en verde en los tres sistemas en la CI.

## 10. Validación y cierre
- [ ] Repasar los criterios de `spec.md` y marcar solo lo comprobado.
- [ ] `tech-stack.md`: el esquema v5 y los módulos nuevos.
- [ ] Pull request a `main` con `gh`, con la CI en verde.
- [ ] Hoja de ruta: la 007 pasa a «Hecho» al fusionar.
