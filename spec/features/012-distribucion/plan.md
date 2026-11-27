# 012 · Distribución — Plan

Cómo se implementa lo descrito en [`spec.md`](spec.md). Tauri construye los instaladores de cada sistema; la 012 los configura, añade el actualizador y automatiza la publicación.

## Arquitectura

```
 etiqueta v1.2.0 ──▶ release.yml (Windows · macOS · Linux)
                       ├─ npm run core:build (núcleo .NET por sistema; en macOS, x64 + arm64 unidos con lipo)
                       ├─ tauri-action: .exe (NSIS, por usuario) · .dmg universal · AppImage · .deb
                       └─ Release en borrador + latest.json firmado (actualizador)

 App ── al abrir la obra: check() del actualizador ──▶ aviso en la barra ──▶ «Actualizar y reiniciar»
     ── macOS: RunEvent::Opened(.rocinante) ──▶ evento a la ventana ──▶ project.open
```

- **Una sola versión:** `scripts/version.mjs <x.y.z>` la escribe en `tauri.conf.json`, los `package.json`, `Cargo.toml` y `Directory.Build.props`. `--check` comprueba que coinciden, y la CI lo ejecuta.
- **El núcleo universal:** `build-core.mjs` acepta un destino (`--target universal-apple-darwin`). En macOS publica las dos arquitecturas y las une con `lipo`, como pide Tauri para un sidecar universal.
- **La asociación de archivos:** `bundle.fileAssociations` con la extensión `rocinante` y su icono.
  - En Windows y Linux el archivo llega como argumento, y ya se abre (001).
  - En macOS llega con `RunEvent::Opened`: el anfitrión lo pasa a la ventana principal como evento y la interfaz lo abre con `project.open`.
- **El actualizador:**
  - `tauri-plugin-updater` con la clave pública del proyecto en `tauri.conf.json` y `latest.json` en la última Release;
  - `tauri-plugin-process` para reiniciar.
  - La comprobación la hace la interfaz cuando la obra está abierta, si la preferencia `checkForUpdates` lo permite. Esa preferencia va en el contrato v15.
- **La firma:** el flujo de Release lee los secretos `TAURI_SIGNING_PRIVATE_KEY` y su contraseña, para firmar las actualizaciones. Los de Windows y Apple quedan comentados, para cuando los haya.

## Implementación

1. **Versión única:** el script, su comprobación en la CI y la versión `0.9.0` como primera publicable.
2. **Paquetes:**
   - NSIS por usuario, `.dmg`, AppImage y `.deb`;
   - la asociación `.rocinante` y la apertura en macOS;
   - el núcleo universal.
3. **Actualizador:**
   - los plugins y sus permisos;
   - el contrato v15 (`checkForUpdates`);
   - el aviso en la barra y el diálogo, y la preferencia.
4. **Publicar:** `release.yml` con `tauri-action`, y un trabajo de empaquetado en la CI para las PR que tocan el anfitrión o el empaquetado.
5. **Página Instalar** (`docs/INSTALAR.md`), README y cierre.

## Riesgos

- **Construir en macOS universal** exige los dos destinos de Rust y del núcleo; se prueba en la CI, porque aquí no hay Mac.
- **La clave del actualizador** la genera el autor (`npx tauri signer generate`). Hasta que la clave pública esté en la configuración, el actualizador no se activa: la app lo comprueba y no busca versiones.
- **Probar la actualización de verdad** exige dos Releases publicadas. Los tests simulan el actualizador; la primera prueba real será la de la 0.9.0 a la siguiente.
