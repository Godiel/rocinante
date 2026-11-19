# ADR 0001 · Arquitectura en tres capas

- **Estado:** aceptada
- **Fecha:** 2026-11-16

## Contexto

Rocinante es una app de escritorio instalada, para Windows, macOS y Linux, que en el futuro tendrá versión móvil y quizá web. El autor domina C#/.NET. La pieza central es un editor de texto enriquecido de calidad, y los mejores editores de ese tipo existen en el ecosistema web.

## Decisión

La aplicación se divide en tres capas:

- **Interfaz** (HTML/CSS/TypeScript), dibujada dentro de una ventana nativa. Contiene lo que debe responder al instante mientras se escribe.
- **Núcleo** (C# / .NET 10 LTS). Contiene la lógica de dominio y todo lo pesado: guardar, analizar, corregir, exportar y hablar con la IA. No depende del anfitrión.
- **Anfitrión** de escritorio, una capa fina que abre las ventanas, empaqueta la app y conecta la interfaz con el núcleo. No contiene lógica de dominio.

Se usa .NET 10 LTS y se migrará a .NET 12 LTS; no se usan versiones STS.

## Consecuencias

- El núcleo se reutiliza tal cual en el móvil (MAUI Hybrid) y, si llega, en la web (ASP.NET Core).
- Hay dos lenguajes principales y un contrato entre ellos que hay que mantener y probar.
- Se descartó una app 100 % .NET (Avalonia, WPF) porque obligaría a construir el editor casi desde cero.
