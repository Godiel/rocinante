# 012 · Distribución — Tareas

Checklist derivada de [`plan.md`](plan.md). Rama: `feature/012-distribucion`.

## 1. Versión única
- [x] `scripts/version.mjs` con `--check`, en la CI.

## 2. Paquetes
- [x] NSIS por usuario, `.dmg` universal, AppImage y `.deb`.
- [x] Asociación `.rocinante` y apertura en macOS.
- [x] Núcleo universal para macOS.

## 3. Actualizador
- [ ] Plugins, permisos y clave pública.
- [ ] Contrato v15: `checkForUpdates`.
- [ ] Aviso en la barra, diálogo y preferencia, con tests.

## 4. Publicar
- [ ] `release.yml` con Release en borrador y `latest.json`.
- [ ] Empaquetado en la CI para las PR que lo tocan.

## 5. Cierre
- [ ] Página Instalar, README, criterios, `tech-stack.md`, hoja de ruta y PR.
- [ ] Todo en verde en la CI.
