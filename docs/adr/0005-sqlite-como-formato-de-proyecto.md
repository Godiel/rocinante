# ADR 0005 · SQLite como formato del proyecto `.rocinante`

- **Estado:** aceptada
- **Fecha:** 2026-11-16

## Contexto

Un archivo `.rocinante` es la obra completa: texto, personajes, relaciones, referencias, tablero, notas, versiones y datos del escudero. Se guarda de forma continua mientras se escribe, y perder una obra por un corte de luz es inaceptable.

## Decisión

Por dentro, un `.rocinante` es una base de datos **SQLite**, accedida con `Microsoft.Data.Sqlite`. El texto de cada documento se guarda en el formato JSON de TipTap. El esquema está documentado en `docs/format/`, lleva número de versión y se migra automáticamente.

## Motivos

- **Guardado incremental:** solo se escribe lo que cambia, sin reescribir la obra entera.
- **Transacciones:** un corte durante el guardado no corrompe el archivo.
- **Consultas indexadas** para el tablero y el escudero (menciones por capítulo, coincidencias, relaciones).
- Formato abierto, de dominio público y legible con herramientas libres.

## Alternativas descartadas

- **ZIP con archivos JSON** (como `.docx` o `.epub`): obliga a reescribir el archivo entero en cada guardado y puede quedar corrupto si se interrumpe.

## Consecuencias

- El archivo no se puede comparar línea a línea con git; para eso están las exportaciones a Markdown.
- Las preferencias personales y las claves de API quedan fuera del proyecto, en la configuración de la app.
