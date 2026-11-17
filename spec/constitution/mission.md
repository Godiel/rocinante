# Misión

## Qué construimos

**Rocinante es un entorno de texto para escritores.** Es una aplicación de escritorio que se instala y funciona sin cuenta, sin licencia y sin conexión. Además de escribir, ayuda a no perder el hilo de lo escrito: personajes, escenarios y tramas.

Piezas principales:

1. **Editor** — el lugar donde se escribe. Admite textos sueltos, capítulos y fragmentos discontinuos que luego se ordenan.
2. **Proyecto** — un archivo propio de Rocinante que es la obra completa: los textos, los elementos de la obra (personajes, escenarios, tramas), las relaciones entre ellos y las notas e ideas del autor.
3. **Tablero de tarjetas** — tarjetas flotantes con los elementos de la obra. El tablero se puede separar de la ventana principal y llevar a otra pantalla. Cada tarjeta muestra dónde aparece su elemento en el texto, cuántas veces y con quién se relaciona. Los «hilos del destino» muestran el recorrido de un personaje a lo largo de la historia, y la tarjeta se actualiza conforme se escribe.

   El tablero funciona siempre, con o sin IA:
   - **Sin IA:** el escritor crea las fichas y sus relaciones a mano. Rocinante cuenta en tiempo real las menciones de cada nombre registrado y de sus alias, muestra en qué capítulos y pasajes aparece y señala qué elementos coinciden en un mismo párrafo. También sugiere como posibles personajes o lugares los nombres propios que se repiten y aún no tienen ficha.
   - **Con IA (escudero):** además crea las fichas, deduce las relaciones y anota los atributos a partir del propio texto.
4. **Concentración** — modo de pantalla completa que deja solo el texto, con fondos y ambientes relajantes opcionales.
5. **Corrección** — revisión de ortografía, gramática y puntuación que nunca reescribe el estilo del autor.
6. **Escudero (asistente opcional)** — el escritor conecta la IA que prefiera: un proveedor en la nube con su propia clave de API o un modelo local que corre en su equipo, sin internet. Al terminar cada párrafo, el escudero lo analiza en segundo plano y mantiene al día los elementos de la obra sin que el autor tenga que anotar nada. Nunca interrumpe ni pide confirmación mientras se escribe. Lo que hace:
   - **Detecta entidades**: si un párrafo habla de Antonio, Antonio pasa a ser un personaje. Lo mismo ocurre con ciudades, lugares y paisajes.
   - **Vincula relaciones**: si el texto dice que Antonio tiene un hijo llamado Claudio, Claudio queda creado y vinculado a Antonio como hijo.
   - **Anota atributos**: si Antonio es pelirrojo, ese dato se añade a su ficha, junto al pasaje donde aparece.

   Todo lo que propone el escudero es visible y editable, y el escritor puede corregirlo o descartarlo.

## Para quién

- **Escritores y escritores en potencia** que trabajan solos en obras de ficción o en textos largos y fragmentados, y necesitan orientarse dentro de su propia historia.
- **El autor del proyecto** es el primer usuario: escritor y usuario de Word y Google Docs que quiere una herramienta propia, local y sin licencias.
- Más adelante, cualquiera que redacte (redactores, publicistas, estudiantes) y busque una alternativa a Word y Google Docs.

## Principios

- **Instalar y escribir** — un instalador para cada sistema operativo y nada más: sin cuenta, sin registro, sin conexión obligatoria.
- **Los textos son del escritor** — todo se guarda en su equipo, en archivos que él controla. Ninguna función esencial depende de un servidor.
- **La IA es opcional y la elige el escritor** — Rocinante funciona completo sin IA. Si el escritor conecta una, usa su propio proveedor y su propia clave, y el texto solo sale del equipo hacia ese proveedor y con su consentimiento explícito. Rocinante no tiene servidor intermedio.
- **La herramienta sirve al texto** — el tablero, la analítica y la corrección acompañan sin interrumpir. El editor siempre es lo primero.
- **Se respeta la voz del autor** — la corrección señala errores de ortografía, gramática y signos, y el escritor decide. Nunca se reescribe ni se sugiere estilo.
- **Oficio, no artificio** — interfaz sobria y cuidada, de inspiración quijotesca (tipografía, papel, grabado). Nada de la estética genérica de las apps de IA. El código es de calidad profesional porque el proyecto es de código abierto y se muestra como portafolio.

## Qué NO es

- **No es una red social** — no hay perfiles, seguidores, comentarios públicos ni feed.
- **No es una plataforma de publicación** — Rocinante no publica ni distribuye obras. Como mucho exporta archivos.
- **No es un asistente que escribe por ti** — la IA lee para organizar (personajes, lugares, relaciones, atributos) y nunca escribe en el texto del autor: no genera prosa, no continúa historias ni cambia el estilo.
- **No es un servicio en la nube** — al menos en esta etapa. La sincronización y la colaboración quedan para el futuro (ver roadmap).

## Más adelante (fuera del alcance inicial)

- Versión web y móvil que se comuniquen con la de escritorio.
- Nube de pago opcional para sincronizar entre dispositivos.
- Colaboración entre autores.
