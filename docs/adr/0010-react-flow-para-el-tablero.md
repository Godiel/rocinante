# ADR 0010 · React Flow para el Tablero

- **Estado:** aceptada
- **Fecha:** 2026-11-25
- **Feature:** [004 · Elementos de la obra](../../spec/features/004-elementos-obra/spec.md)

## Contexto

La pestaña Tablero es una pizarra. Cada ficha es una tarjeta que se coloca libremente, y cada relación, una flecha con su etiqueta. Tiene que:

- desplazarse, acercarse, alejarse y encajar todas las tarjetas;
- arrastrar tarjetas y unirlas arrastrando de una a otra;
- usarse con el teclado y con un lector de pantalla;
- moverse con fluidez con 300 tarjetas y 600 flechas;
- verse con el estilo de Rocinante: papel, tinta y nada de sombras ni colores saturados.

Además, «Ordenar automáticamente» reparte las tarjetas sin que se solapen. Una red de personajes no es un árbol, así que no sirve una disposición por niveles.

Hacer todo esto a mano es mucho trabajo y difícil de dejar fino: el desplazamiento y el zoom, el arrastre, las conexiones, dibujar solo lo visible y la accesibilidad.

## Decisión

- La pizarra usa **React Flow** (`@xyflow/react`, MIT). Las tarjetas son un nodo propio (`ElementCard`) y las flechas, una arista propia (`RelationArrow`). Las flechas van de borde a borde de las tarjetas y se curvan cuando hay varias entre las mismas dos. Solo se usa la hoja de estilos base de React Flow; todo lo visible usa los tokens de la app.
- El orden automático usa **d3-force** (ISC), fijado en la versión exacta 3.0.0. Las fuerzas acercan a las fichas relacionadas. Después, una pasada propia separa los rectángulos que aún se tocan. El resultado es siempre el mismo para la misma pizarra.
- La pizarra se carga en diferido: React Flow y d3-force solo se descargan al abrir el Tablero.
- Cada tarjeta y cada flecha conservan su identidad mientras no cambie lo que muestran. Los manejadores que recibe React Flow son estables. Así, arrastrar una tarjeta solo vuelve a dibujar esa tarjeta y sus flechas.

## Alternativas descartadas

- **Una pizarra propia**, como el paginador de la 002 ([ADR 0009](0009-paginador-propio.md)): tendría sentido si no existiera nada. React Flow existe, está muy mantenido y resuelve lo difícil.
- **tldraw:** su licencia no es compatible con MIT.
- **dagre** para ordenar: está pensado para jerarquías.
- **elkjs** para ordenar: su licencia EPL no es compatible con MIT.

## Consecuencias

- Las dependencias nuevas son MIT (`@xyflow/react`, `@xyflow/system` y sus dependencias pequeñas) e ISC (d3-force y los módulos de d3 que React Flow usa). `npm audit signatures` las verifica.
- La pizarra pesa unos 207 kB, en un trozo aparte que no retrasa abrir una obra ni escribir.
- Con 300 tarjetas y 600 flechas en WebView2, el p95 de fotograma es de 20,9 ms al arrastrar una tarjeta, 7,1 ms al desplazar y 7,1 ms al acercar y alejar la vista. En la CI, que no tiene tarjeta gráfica, el límite es de 150 ms. Allí la prueba solo detecta si la pizarra se vuelve mucho más lenta.
- Las actualizaciones de React Flow pueden cambiar su API. El archivo de bloqueo fija la versión exacta, y cada subida se prueba con tests de comportamiento y de extremo a extremo antes de subirla.
- La pestaña separable en su propia ventana (007) seguirá usando la misma pizarra.
