# ADR 0008 · oxlint en lugar de ESLint para la interfaz

- **Estado:** aceptada
- **Fecha:** 2026-11-16
- **Modifica:** [`tech-stack.md`](../../spec/constitution/tech-stack.md), que preveía ESLint.

## Contexto

La interfaz usa TypeScript 7, la versión nativa del compilador. `typescript-eslint`, imprescindible para usar ESLint con TypeScript, solo admite TypeScript hasta la 6.0.

## Decisión

Se usa **oxlint** como linter, junto a Prettier para el formato. Es compatible con las reglas habituales de ESLint (React, hooks, imports, TypeScript), tiene licencia MIT y es mucho más rápido. En CI se ejecuta con `--deny-warnings`.

## Alternativas descartadas

- **Bajar a TypeScript 6** solo para poder usar ESLint: renuncia al compilador actual por una herramienta auxiliar.

## Consecuencias

- Las reglas que dependen de información de tipos no están disponibles por ahora. El modo estricto de TypeScript (`strict`, `noUncheckedIndexedAccess`) cubre buena parte de esos casos.
- Se reevaluará cuando `typescript-eslint` admita TypeScript 7.
