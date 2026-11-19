# Decisiones de arquitectura (ADR)

Cada decisión relevante se registra en un archivo numerado. Las decisiones no se editan una vez aceptadas: si cambian, se añade un ADR nuevo que sustituye al anterior.

| # | Decisión | Estado |
|---|---|---|
| [0001](0001-arquitectura-en-tres-capas.md) | Arquitectura en tres capas | aceptada |
| [0002](0002-tauri-con-nucleo-sidecar.md) | Tauri 2 como anfitrión, con el núcleo como sidecar | aceptada |
| [0003](0003-react-y-typescript.md) | React con TypeScript estricto | aceptada |
| [0004](0004-tiptap-como-editor.md) | TipTap (núcleo MIT) como editor | aceptada |
| [0005](0005-sqlite-como-formato-de-proyecto.md) | SQLite como formato del proyecto | aceptada |
| [0006](0006-licencias-y-herramientas-de-test.md) | Licencia MIT y herramientas de test | aceptada |
| [0007](0007-esqueleto-andante.md) | Validación del esqueleto andante | aceptada |
| [0008](0008-oxlint-en-lugar-de-eslint.md) | oxlint en lugar de ESLint | aceptada |
| [0009](0009-paginador-propio.md) | Paginador propio para la vista de página | aceptada |

## Plantilla

```markdown
# ADR NNNN · Título

- **Estado:** propuesta | aceptada | sustituida por NNNN
- **Fecha:** AAAA-MM-DD

## Contexto
## Decisión
## Alternativas descartadas
## Consecuencias
```
