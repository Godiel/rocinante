# 006 · Referencias en el texto — Tareas

Checklist derivada de [`plan.md`](plan.md). Cada bloque se cierra con sus tests en verde, y con una comprobación en la app real cuando toca la interfaz, antes de pasar al siguiente. Rama: `feature/006-referencias-texto`.

## 1. Reglas compartidas
- [x] `src/contracts/mentions.json` con los casos: palabras enteras, mayúsculas y tildes, solapes, nombres de una letra, nombres repetidos, diálogo y puntuación.
- [x] Descritas en el README de `src/contracts`.

## 2. Contrato de mensajes (versión 9)
- [x] `element.references { id }` con `total`, `chapters`, `first` y las menciones por documento con su trozo de texto.
- [x] `Preferences.mentionsVisible`.
- [x] Ejemplos válidos e inválidos; tipos de TypeScript regenerados.

## 3. Dominio
- [x] `MentionFinder` con las reglas compartidas.
- [x] `DocumentContent` da los textos de sus bloques en orden.
- [x] Glosario de `tech-stack.md`: mención.
- [x] Tests con los casos de `mentions.json`, con la cobertura de la constitución.

## 4. Casos de uso y sidecar
- [ ] `ElementUseCases.References`, en el orden del índice, con trozos de texto.
- [ ] Caché por revisión de cada documento y versión de las fichas.
- [ ] `Preferences.MentionsVisible`.
- [ ] Ningún registro lleva nombres ni trozos del texto.
- [ ] El escenario `WritingSession` usa el método nuevo.

## 5. Reconocer en la interfaz
- [ ] `features/mentions/findMentions` con los casos de `mentions.json`.
- [ ] Índice de nombres plegados, rehecho solo cuando cambian las fichas.

## 6. Marcas en el editor
- [ ] Decoración de las menciones; al escribir solo se buscan los bloques tocados.
- [ ] Se rehace al cambiar los nombres; se apaga con «Marcar menciones» y en el modo concentración.
- [ ] Tests de comportamiento y comprobación en la app real.

## 7. Ficha en pequeño
- [ ] Aparece al pasar el ratón por una mención y se va al salir; varias fichas a la vez.
- [ ] «Abrir la ficha» la abre en el panel.
- [ ] Tests de comportamiento y comprobación en la app real.

## 8. «En el texto» en la ficha
- [ ] Total, capítulos, primera aparición y menciones por capítulo con su trozo.
- [ ] El salto abre el capítulo y selecciona la mención.
- [ ] Se pone al día con los cambios del texto y de las fichas, también desde otra ventana.
- [ ] «Marcar menciones» en la pestaña Fichas.
- [ ] Tests de comportamiento y comprobación en la app real.

## 9. Pruebas de extremo a extremo y rendimiento
- [ ] El recorrido de la spec.
- [ ] Escribir con 300 fichas y las marcas visibles mantiene el p95 de la 001.
- [ ] Todo en verde en los tres sistemas en la CI.

## 10. Validación y cierre
- [ ] Repasar los criterios de `spec.md` y marcar solo lo comprobado.
- [ ] `tech-stack.md`: los módulos nuevos y el glosario.
- [ ] Pull request a `main` con `gh`, con la CI en verde.
- [ ] Hoja de ruta: la 006 pasa a «Hecho» al fusionar.
