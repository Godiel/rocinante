# ADR 0004 · TipTap (núcleo MIT) como editor

- **Estado:** aceptada
- **Fecha:** 2026-11-16

## Contexto

El editor es el corazón del producto: menciones enlazadas a fichas, notas ancladas, vista de página y, en el futuro, colaboración.

## Decisión

**TipTap**, sobre ProseMirror, usando **solo su núcleo y extensiones con licencia MIT**. Nunca se usan las extensiones «Pro» ni TipTap Cloud.

## Motivos

- ProseMirror lleva casi una década en producción a gran escala.
- Su **esquema** garantiza que el documento guardado siempre es válido, de modo que el núcleo .NET puede analizarlo y exportarlo con fiabilidad.
- Sus **decoraciones** resaltan menciones sin modificar el texto del autor, algo clave para que el escudero nunca escriba en la obra.
- Soporte maduro de colaboración con Yjs para el futuro.

## Alternativas descartadas

- **Lexical:** muy buen rendimiento, pero más joven, con una API que todavía cambia y un ecosistema de extensiones menor.

## Consecuencias

- La paginación con tamaño de libro (feature 002), las notas al pie y las notas ancladas se construyen en el proyecto: no existen como extensiones MIT maduras.
