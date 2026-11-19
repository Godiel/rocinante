# ADR 0006 · Licencia MIT y herramientas de test

- **Estado:** aceptada
- **Fecha:** 2026-11-16

## Decisión

- Rocinante se publica con licencia **MIT**.
- Toda dependencia debe tener una licencia compatible con MIT (MIT, BSD, Apache 2.0, ISC, dominio público, SIL OFL para tipografías). No se incorporan dependencias GPL, comerciales o de uso restringido.
- Herramientas de test por capa:
  - **Núcleo:** xUnit, Shouldly y NSubstitute.
  - **Interfaz:** Vitest y React Testing Library.
  - **Contrato:** esquemas JSON compartidos, validados en ambos lados.
  - **Extremo a extremo:** Playwright con el núcleo real.
  - **Anfitrión:** `cargo test`.

## Alternativas descartadas

- **FluentAssertions:** licencia comercial desde la versión 8.
- **Moq:** en 2023 incluyó un componente que recogía datos de los desarrolladores. Se evita en un proyecto que presume de privacidad.

## Consecuencias

- Antes de añadir una dependencia se revisa su licencia.
- La cobertura del dominio del núcleo debe ser del 80 % o más de líneas y de ramas. La mide coverlet (MIT) y el proyecto de tests la exige en cada ejecución, en local y en CI.
