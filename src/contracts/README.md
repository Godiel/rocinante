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
| Pruebas | [`examples/`](examples/) contiene parámetros de ejemplo, válidos e inválidos, que ambos lados validan. El núcleo recorre además una sesión de escritura completa que usa todos los métodos y comprueba que cada respuesta y cada notificación reales cumplen el contrato. |

## Errores

Además de los códigos estándar de JSON-RPC, el núcleo devuelve tres códigos para los fallos esperados, con el motivo en `error.data.reason`:

| Código | Cuándo | Ejemplos de `reason` |
|---|---|---|
| `ProjectNotOpen` (-32001) | La petición necesita un proyecto abierto y no lo hay | `projectNotOpen` |
| `RuleViolated` (-32002) | Se incumple una regla del dominio | `titleRequired`, `documentIsDeleted`, `positionOutOfRange` |
| `ProjectFileProblem` (-32003) | El archivo no se puede crear o abrir | `notFound`, `notAProject`, `newerVersion`, `corrupted` |

La lista completa está en `$defs.ErrorReason`; un test del núcleo comprueba que coincide con todos los motivos que puede dar. La interfaz convierte cada motivo en un mensaje en español; el `message` en inglés es solo para los logs.

## Notificaciones

Cada método que cambia algo recibe la ventana de origen (`origin`) y lo anuncia a todas las ventanas. La ventana de origen ya muestra el cambio y puede ignorar el aviso; las demás se ponen al día. La excepción es `place.save`: cada ventana tiene su propio cursor, así que la posición se recuerda sin anunciarla.

## Cambiar el contrato

1. Edita `protocol.json` (y añade un ejemplo en `examples/` si es un método nuevo).
2. Si el cambio es incompatible, incrementa `protocolVersion`.
3. Ejecuta `npm run contracts:generate` y confirma el archivo generado.
4. CI falla si el archivo generado no está al día o si alguna capa incumple el contrato.
