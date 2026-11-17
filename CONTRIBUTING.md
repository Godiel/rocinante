# Cómo contribuir a Rocinante

Gracias por tu interés. Esta guía resume cómo se trabaja en el proyecto. Las reglas completas están en la [constitución](spec/constitution/).

## Desarrollo dirigido por especificación

Rocinante sigue un flujo SDD: **primero la especificación, luego el plan, luego las tareas y solo entonces el código.**

1. Cada funcionalidad vive en `spec/features/NNN-nombre/`, con `spec.md` (qué y por qué), `plan.md` (cómo) y `tasks.md` (lista de tareas).
2. Las features se crean a partir de la plantilla en `.prompt/plantillas/feature/`.
3. Si una feature choca con la [misión](spec/constitution/mission.md) o con el [tech-stack](spec/constitution/tech-stack.md), se replantea la feature, no la constitución.

Antes de proponer algo grande, abre un *issue* para hablarlo.

## Ramas y commits

- Una rama por feature: `feature/NNN-nombre-feature`. Para correcciones: `fix/descripcion-breve`.
- Todo entra en `main` mediante *pull request*, con CI en verde.
- Commits con [Conventional Commits](https://www.conventionalcommits.org/es/), en español: `tipo(ámbito): descripción`.
  - Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`.
  - Ejemplo: `feat(editor): guardado automático tras cada pausa`.
- Mensajes claros y precisos: qué cambia y por qué. Un commit, un cambio con sentido propio.

## Estilo de código

- **Idioma:** código, comentarios y logs en inglés; documentación y commits en español.
- **Cada lenguaje sigue su estilo oficial**, comprobado automáticamente:

  | Capa | Comprobar | Corregir |
  |---|---|---|
  | Núcleo (C#) | `dotnet format src/core/Rocinante.slnx --verify-no-changes` | `dotnet format src/core/Rocinante.slnx` |
  | Interfaz (TypeScript) | `npm run lint -w @rocinante/ui` y `npm run format:check -w @rocinante/ui` | `npm run format -w @rocinante/ui` |
  | Anfitrión (Rust) | `cargo fmt --check` y `cargo clippy -- -D warnings` en `src/host` | `cargo fmt` |

- En las fronteras: JSON en `camelCase`, SQLite en `snake_case`, archivos en `kebab-case`.
- Los nombres del dominio siguen el [glosario](spec/constitution/tech-stack.md#glosario-del-dominio).

## Tests

Ninguna feature se da por terminada sin tests. Cada capa tiene los suyos (ver [tech-stack](spec/constitution/tech-stack.md#tecnologías)), y el dominio del núcleo mantiene una cobertura del 80 % o más.

## Límites que no se cruzan

- Dependencias solo con licencias compatibles con MIT.
- Ningún texto del usuario sale de su equipo sin su consentimiento explícito.
- Nada de secretos en el repositorio ni en texto plano.
- Los logs nunca contienen texto de la obra ni claves.

## Decisiones de arquitectura

Las decisiones relevantes se registran como ADR en [`docs/adr/`](docs/adr/). Si un cambio altera una decisión, añade un ADR nuevo que la sustituya; no edites los antiguos.
