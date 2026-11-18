# Contrato interfaz ↔ núcleo

[`protocol.json`](protocol.json) es la **fuente única** del protocolo JSON-RPC 2.0 entre la interfaz y el núcleo .NET. Define:

- `protocolVersion`: se incrementa con cada cambio incompatible.
- `methods`: cada petición con el esquema de sus `params` (o `null` si no tiene) y de su `result`.
- `notifications`: los avisos que el núcleo envía a todas las ventanas.
- `errorCodes`: los códigos de error que puede devolver el núcleo.
- `$defs`: tipos compartidos a los que se refieren los esquemas con `#/$defs/...`.

Todos los esquemas siguen JSON Schema 2020-12.

## Cómo se usa

| Lado | Qué hace con el contrato |
|---|---|
| Interfaz | `npm run contracts:generate` genera `src/ui/src/bridge/generated/protocol.ts`, y el cliente del relé solo acepta métodos y parámetros definidos aquí. |
| Núcleo | Lleva `protocol.json` incrustado y valida los `params` de cada petición antes de atenderla. |
| Pruebas | [`examples/`](examples/) contiene mensajes de ejemplo que ambos lados validan; el núcleo comprueba además que sus respuestas y notificaciones reales cumplen el contrato. |

## Cambiar el contrato

1. Edita `protocol.json` (y añade un ejemplo en `examples/` si es un método nuevo).
2. Si el cambio es incompatible, incrementa `protocolVersion`.
3. Ejecuta `npm run contracts:generate` y confirma el archivo generado.
4. CI falla si el archivo generado no está al día o si alguna capa incumple el contrato.
