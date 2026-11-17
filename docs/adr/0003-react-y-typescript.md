# ADR 0003 · React con TypeScript estricto para la interfaz

- **Estado:** aceptada
- **Fecha:** 2026-11-16

## Contexto

La interfaz alberga el editor, el tablero y las ventanas desacoplables, que comparten estado en vivo.

## Decisión

**React** con **TypeScript en modo estricto**.

## Motivos

- Los dos mejores editores de texto enriquecido (TipTap y Lexical) tienen integración oficial con React.
- Ecosistema maduro para gestionar estado compartido.
- Es la tecnología de interfaz más demandada profesionalmente, algo relevante para un proyecto que también es portafolio.

## Alternativas descartadas

- **Svelte 5** y **Solid:** excelente rendimiento y menos código, pero sus integraciones con el editor dependen de la comunidad justo en la pieza más importante.
