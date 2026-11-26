# 009 · Escudero — Plan

Cómo se implementa lo descrito en [`spec.md`](spec.md). La constitución pone la IA en el **núcleo**: allí viven los proveedores, la clave y las propuestas. La interfaz pide, muestra y deja decidir.

## Arquitectura

```
 Interfaz ── editor: «párrafo terminado» → squire.analyze
          ── panel: pestaña Escudero (propuestas) · Ajustes del escudero
        │  squire.* / proposal.* / proposals.get           ▲ squire.changed
 Núcleo ── SquireUseCases ── cola en segundo plano, un párrafo cada vez
        │     ├─ ISquireClient: Anthropic · OpenAI y compatibles (xAI, otros) · Gemini · Ollama  (HTTP + JSON)
        │     ├─ ISecretStore: Windows (Credential Manager) · macOS (security) · Linux (secret-tool)
        │     └─ propuestas y párrafos leídos → SQLite (esquema v6)
```

- **Un párrafo** se identifica por su documento y la huella (SHA-256) de su texto: si no cambia, no se vuelve a mandar, y lo descartado de ese párrafo no vuelve.
- **La respuesta** de la IA es JSON con `elements`, `relationships` y `attributes`; el núcleo la valida y descarta lo que no encaja (nombres vacíos, relaciones con fichas que no existen ni se proponen).
- **Aceptar** una propuesta usa los casos de uso de las fichas de la 004, así que se ve en todas las ventanas como cualquier cambio.

## Implementación

1. **Contrato (versión 12)** — `squire.settings`, `squire.configure`, `squire.setKey`, `squire.forgetKey`, `squire.test`, `squire.models`, `squire.enable`, `squire.analyze`, `proposals.get`, `proposal.accept`, `proposal.dismiss` y la notificación `squire.changed`.
2. **Dominio** — `Proposal` (elemento, relación o atributo, con su pasaje) y su ciclo: pendiente, aceptada, descartada.
3. **Persistencia (esquema v6)** — `proposal`, `squire_paragraph` (párrafos leídos) y el interruptor por obra.
4. **Clave en el almacén del sistema** — `ISecretStore` con sus tres implementaciones y una en memoria para los tests.
5. **Proveedores** — `ISquireClient` con un adaptador por familia de API, el mismo encargo (prompt) y la lectura de la respuesta; tests con un `HttpMessageHandler` falso.
6. **Casos de uso y sidecar** — ajustes, prueba, cola en segundo plano y propuestas; la configuración (proveedor, modelo, dirección) en `settings.json`, la clave nunca.
7. **Ajustes del escudero** en la interfaz, con el aviso de a dónde va el texto.
8. **Párrafo terminado** en el editor: Intro o 8 segundos sin escribir en él.
9. **Pestaña Escudero**: propuestas, aceptar, corregir, descartar, ir al pasaje y el estado; contador en la barra.
10. **Pruebas de extremo a extremo** con un proveedor falso compatible con OpenAI servido por la prueba.
11. **Validación y cierre.**

## Riesgos

- **Respuestas que no son JSON** — se pide JSON y se lee con tolerancia (se busca el primer objeto); lo que no se entiende se registra sin el texto y no rompe nada.
- **El almacén del sistema en Linux** — `secret-tool` puede no estar instalado; entonces se dice al escritor cómo instalarlo y la clave no se guarda en ningún otro sitio.
- **Coste y privacidad** — el escudero está apagado por defecto, se enciende por obra con aviso, y solo manda el párrafo terminado y los nombres de las fichas.
