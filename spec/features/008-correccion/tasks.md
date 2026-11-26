# 008 · Corrección — Tareas

Checklist derivada de [`plan.md`](plan.md). Rama: `feature/008-correccion`.

## 1. Contrato (versión 11)
- [x] `dictionary.get`, `dictionary.add`, `dictionary.remove`, `dictionary.changed` y `Preferences.correctionVisible`.

## 2. Núcleo
- [x] Diccionario propio en `settings.json`, con límites y tests; logs sin palabras.

## 3. Reglas de puntuación
- [ ] Una función por regla, con casos que marcan y casos correctos que no.

## 4. Ortografía
- [ ] Worker con nspell y `dictionary-es`; caché de respuestas; palabras que no se miran.

## 5. Marcas en el editor
- [ ] Decoración incremental; F7 y modo concentración.

## 6. La ventanita
- [ ] Sugerencias, arreglos, «Añadir al diccionario» e «Ignorar», con deshacer.

## 7. Licencia
- [ ] `licenses/dictionary-es.txt` en la compilación.

## 8. Pruebas de extremo a extremo y rendimiento
- [ ] El recorrido de la spec y el p95 con el diccionario cargado.
- [ ] Todo en verde en la CI.

## 9. Validación y cierre
- [ ] Criterios, `tech-stack.md`, hoja de ruta y PR.
