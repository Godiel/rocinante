# ADR 0002 · Tauri 2 como anfitrión, con el núcleo como sidecar

- **Estado:** aceptada
- **Fecha:** 2026-11-16

## Contexto

El anfitrión debe abrir varias ventanas sincronizadas (la pestaña Tablero se desacopla a otra pantalla), generar instaladores para los tres sistemas, actualizarse y ser ligero. Las prioridades del autor, en orden, son: ligero, reutilizable para móvil y fácil de desarrollar.

## Decisión

**Tauri 2** es el anfitrión. El núcleo .NET se ejecuta como proceso auxiliar (*sidecar*) que Tauri arranca y detiene con la app. Rust se limita a configuración, al relé entre ventanas y núcleo y a comandos puntuales; la lógica nunca va en Rust.

## Alternativas descartadas

- **Photino.NET:** integración directa con .NET, pero comunidad pequeña, ventanas múltiples poco documentadas y sin instaladores ni actualizaciones incluidos. Riesgo alto para un proyecto de largo plazo.
- **Electron:** instaladores de más de 100 MB y alto consumo de memoria.
- **Wails:** sin soporte móvil y ventanas múltiples limitadas.

## Consecuencias

- Hay dos procesos y un contrato de mensajes entre ellos.
- Se necesita Rust para compilar; los usuarios finales no lo necesitan.
- Instaladores, actualizaciones firmadas y modelo de permisos vienen de serie.
