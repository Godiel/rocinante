# 010 · Hilos del destino — Tareas

Checklist derivada de [`plan.md`](plan.md). Rama: `feature/010-hilos-destino`.

## 1. Contrato (versión 13)
- [x] `threads.get`, `threads.choose`, `milestone.*`, `milestones.changed`, los límites de las relaciones y las propuestas de hito, con ejemplos.

## 2. Dominio
- [x] `Milestone` y la búsqueda de su párrafo, los límites de una relación y `ProposedMilestone`, con tests.

## 3. Persistencia (esquema v7)
- [x] Migración con `milestone`, `thread_choice`, los límites en `relationship` y `proposal` reconstruida; `docs/format`.

## 4. Casos de uso
- [x] Hitos, anclaje al guardar, hilos, fichas elegidas, límites de las relaciones y hitos del escudero.

## 5. Sidecar
- [x] Métodos y notificaciones, en la sesión de escritura de los tests.

## 6. Pestaña Hilos
- [x] F8, capítulos y líneas, puntos, coincidencias y elegir fichas.

## 7. Puntos e hitos
- [x] Pasajes de un punto, hitos en la vista, «Marcar hito» desde el texto y desde un punto, y la vista al día al escribir.

## 8. Relaciones con fechas
- [ ] «Desde» y «hasta» en la ficha; relaciones vigentes y marcas en la vista.

## 9. Propuestas de hito
- [ ] En la pestaña Escudero: aceptar, corregir y descartar.

## 10. Pruebas de extremo a extremo y de rendimiento
- [ ] Hilos, hito, fechas de una relación y hito propuesto por un escudero falso.
- [ ] Hilos en una obra de 150 000 palabras y 300 fichas.
- [ ] Todo en verde en la CI.

## 11. Validación y cierre
- [ ] Criterios, `tech-stack.md`, hoja de ruta y PR.
