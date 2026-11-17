# spec/ — Spec Driven Development de Rocinante

> Rocinante se desarrolla dirigido por especificación (SDD): primero se escribe la spec, luego el plan, luego las tareas, y solo entonces se toca el código.
>
> **Cómo se usa:** la `constitution/` se rellena una vez al arrancar. Cada feature nueva se crea en `features/NNN-nombre-feature/` copiando la plantilla de `.prompt/plantillas/feature/`. Hay que sustituir todo lo que esté entre `<…>` y borrar las notas en _cursiva_.

## Estructura

```
spec/
├── constitution/            ← reglas estables del proyecto (cambian poco)
│   ├── mission.md           ← qué construimos y para quién
│   ├── tech-stack.md        ← tecnologías, convenciones y límites
│   └── roadmap.md           ← orden de las features
└── features/                ← una carpeta por feature
    └── NNN-nombre-feature/
        ├── spec.md          ← qué hace + criterios de aceptación
        ├── plan.md          ← cómo se implementa
        └── tasks.md         ← checklist de tareas
src/                         ← Implementación del sistema
.prompt/                     ← Instrucciones para el agente
.github/                     ← Automatización y CI/CD
```

_La constitución puede ser un único archivo si el proyecto es pequeño; cada feature también puede ser un único archivo. Divídelo cuando crezca._

## Flujo para una feature nueva

1. Crear `features/NNN-nombre-feature/` con el siguiente número libre (`001`, `002`, …), copiando `.prompt/plantillas/feature/`.
2. Escribir `spec.md`: qué hace, por qué y criterios de aceptación medibles.
3. Escribir `plan.md`: enfoque técnico y decisiones, respetando `constitution/tech-stack.md`.
4. Desglosar en `tasks.md` y marcar el progreso.
5. Implementar y validar (build/tests/lint o lo que defina la constitución).
6. Actualizar `constitution/roadmap.md` (mover la feature a "Hecho").

> La constitución manda: si una feature choca con `mission.md` o `tech-stack.md`, se replantea la feature, no la constitución.
