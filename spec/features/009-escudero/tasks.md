# 009 · Escudero — Tareas

Checklist derivada de [`plan.md`](plan.md). Rama: `feature/009-escudero`.

## 1. Contrato (versión 12)
- [x] Métodos `squire.*`, `proposals.get`, `proposal.*` y la notificación `squire.changed`, con ejemplos.

## 2. Dominio
- [x] `Proposal` y su ciclo, con tests.

## 3. Persistencia (esquema v6)
- [x] Migración con `proposal`, `squire_paragraph` y el interruptor por obra; `docs/format`.

## 4. Clave en el almacén del sistema
- [x] `ISecretStore` para Windows, macOS y Linux, y en memoria para tests.

## 5. Proveedores
- [x] Anthropic, OpenAI y compatibles (xAI, otros), Gemini y Ollama, con tests de cada uno.

## 6. Casos de uso y sidecar
- [ ] Ajustes, prueba, modelos, encendido por obra, cola en segundo plano y propuestas.

## 7. Ajustes del escudero
- [ ] Proveedor, modelo, clave, «Probar» y encender en esta obra con aviso.

## 8. Párrafo terminado
- [ ] Intro o pausa de 8 segundos manda el párrafo.

## 9. Pestaña Escudero
- [ ] Propuestas, aceptar, corregir, descartar, ir al pasaje, estado y contador.

## 10. Pruebas de extremo a extremo
- [ ] Con un proveedor falso compatible con OpenAI.
- [ ] Todo en verde en la CI.

## 11. Validación y cierre
- [ ] Criterios, `tech-stack.md`, hoja de ruta y PR.
