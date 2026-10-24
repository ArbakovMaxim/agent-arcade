<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Logotipo de Arcade" align="right">

# Arcade — juega, lee, escucha y mira mientras tu agente de Claude Code trabaja

[English](README.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · **Español** · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [한국어](README.ko.md)

> **Alfa (0.26).** Arcade funciona y se usa a diario, pero es una versión temprana: algo puede fallar, y los ajustes o el catálogo pueden cambiar entre actualizaciones. Los informes de errores son muy bienvenidos — consulta [Comentarios](#comentarios).

Arcade es un plugin para [Claude Code](https://claude.com/claude-code) que llena la espera mientras tu agente trabaja. Cuando el agente lleva más de 10 segundos ocupado, aparece un pequeño *«¿jugamos?»* sobre el prompt. Juega a algo — NES, Sega, PlayStation, Doom, ajedrez y más —, lee un libro, escucha un audiolibro o un podcast, o mira un vídeo sobre el tema en el que trabaja el agente. Arcade te avisa en el momento en que el agente termina o necesita tu permiso, así que nunca te lo pierdes.

Todo el catálogo es gratuito: los juegos tienen licencias abiertas y los libros y audiolibros son de dominio público. También puedes jugar en línea con otras personas que esperan a sus agentes y chatear con tus amigos.

![«¿jugamos?» sobre el prompt de Claude Code tras 11 segundos de trabajo del agente](docs/images/prompt.png)

## Funciones

- **Aparece solo.** Tras 10 segundos de trabajo del agente, Arcade ofrece un juego sobre el prompt; nunca roba el foco a menos que se lo pidas.
- **Sabe lo que hace el agente.** Cuando el agente termina o pide permiso, aparece un aviso sobre el juego — sigue jugando, pausa o vuelve directamente al agente (el comportamiento se elige en los ajustes). En Claude Desktop también puede cerrar la pestaña que estás viendo, para que vuelvas a tener la conversación delante.
- **Un menú, seis secciones.** *Jugar*, *Leer y escuchar*, *Ver*, *Social*, *Trabajo* y *Más* — pliega las que no necesites. Arriba: *Continuar* el último juego, *Buscar* y *Favoritos*.
- **61 juegos gratuitos** de NES (Dendy), Sega Mega Drive, Master System, PlayStation y una pestaña *Juegos* con juegos arcade, de disparos, carreras, estrategia, aventuras y juegos de mesa.
- **Lee y escucha.** 136 libros de dominio público, audiolibros de LibriVox y artículos y episodios de podcast recientes sobre el tema del trabajo del agente.
- **Mira.** Vídeos recientes de YouTube sobre el tema del trabajo del agente, Twitch: tus propios canales y directos sobre programación, tecnología, ciencia y juegos retro, y TikTok: el feed *Para ti* y la búsqueda en el propio sitio de TikTok, donde inicias sesión tú mismo.
- **NES y Flappy Arcade dentro de Claude Code** — en la terminal, VS Code y Claude Desktop. Todo lo demás se abre en una ventana del navegador; en Claude Desktop, por defecto en el navegador integrado de Claude (los juegos de disparos siguen abriéndose en una ventana del navegador: el navegador integrado no puede capturar el ratón).
- **Juego en línea.** Juegos de consola para dos por red, deathmatch y cooperativo en Doom, ajedrez, go, damas y reversi contra personas o contra la máquina.
- **«Quién espera en línea».** Arcade muestra en Claude Code cuando alguien espera compañero, con un botón *Unirse*.
- **Amigos y chats.** Un inicio de sesión opcional con GitHub mantiene tus ajustes iguales en todos tus ordenadores y te da un @alias; añade amigos por su alias exacto, mira quién está en línea, invítalos a jugar y chatea en privado o en grupos.
- **Cuaderno y tableros de proyectos.** Páginas, subpáginas y listas de tareas que también lleva Claude; envía una página a Notion u otra aplicación, o trae una desde allí, mediante los conectores de Claude; dicta en el cuadro de mensaje de Claude y pasa el texto a una página. Tableros con columnas y tarjetas — comparte uno con tus amigos y todos trabajáis en el mismo tablero.
- **Búsqueda y favoritos.** Una sola búsqueda en juegos, libros, audiolibros y canales de Twitch, agrupada por sección y género; marca cualquier cosa con ☆ para guardarla en *★ Favoritos*.
- **Tus propios juegos.** Añade las ROM que tengas; se quedan en tu equipo.
- **13 idiomas de interfaz:** English, Русский, Українська, Español, Français, Deutsch, Português, Italiano, Polski, Türkçe, 日本語, 中文, 한국어 — según el idioma del sistema o del navegador, inglés por defecto.

## Instalación

Requiere **Claude Code 2.1.275 o posterior**.

En una terminal, dos comandos: añade el marketplace de Arcade (este repositorio) y luego instala el plugin desde él:

```
claude plugin marketplace add ArbakovMaxim/agent-arcade
claude plugin install arcade@agent-arcade
```

O dentro de una sesión de Claude Code:

```
/plugin marketplace add ArbakovMaxim/agent-arcade
/plugin install arcade@agent-arcade
```

El plugin se instala para todas las sesiones y aplicaciones. La extensión de VS Code no tiene el comando `/plugin`: instálalo desde una terminal y la extensión lo cargará en una conversación nueva.

**Actualizar:**

```
/plugin marketplace update agent-arcade
/plugin update arcade@agent-arcade
```

Después reinicia Claude Code. El marketplace descarga solo el plugin —unos pocos MiB, sin el sitio web—, así que actualizar lleva segundos. Si ya tienes Arcade instalado, no tienes que hacer nada: el marketplace se cambia solo en la próxima actualización.

Si `/plugin update` dice *already at the latest version* pero ya salió una versión nueva de Arcade, el marketplace no se actualizó. Para ver por qué, ejecuta `claude plugin marketplace update agent-arcade` en una terminal. Si dice *timed out*, dale 10 minutos a la clonación:

```
CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000 claude plugin marketplace update agent-arcade
```

En PowerShell: `$env:CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000; claude plugin marketplace update agent-arcade`. Luego vuelve a ejecutar `/plugin update arcade@agent-arcade`.

**Desinstalar:** `/plugin uninstall arcade@agent-arcade`

## Cómo se usa

- **`/arcade`** abre el menú en cualquier momento.
- Cuando el agente trabaja más de 10 segundos, aparece *«¿jugamos?»* sobre el prompt: **`1`** — jugar aquí, en el panel; **`2`** — en una ventana del navegador (si está disponible); **`3`** — ahora no.
- Flechas o Tab para elegir, Enter para abrir; el ratón también funciona. Los controles se muestran bajo cada juego.
- Cuando el agente termina o espera permiso, aparece un aviso sobre el juego: **Volver al agente** o **Seguir jugando**.

### El menú

| Sección | Qué contiene |
|---|---|
| *(arriba)* | **▶ Continuar** el último juego, **🔍 Buscar**, **★ Favoritos** |
| **Jugar** | NES, Sega, Master System, PlayStation, Juegos; *Unirse* cuando alguien espera en línea; **Mis juegos** |
| **Leer y escuchar** | Libros, Audiolibros, Artículos, Podcasts |
| **Ver** | YouTube, Twitch, TikTok |
| **Social** | Amigos, Chats, **Iniciar sesión con GitHub** (o **Cuenta** una vez iniciada la sesión) |
| **Trabajo** | Cuaderno, Tablero de proyectos |
| **Más** | Ventana de Arcade, Ajustes, 🌐 idioma, 🐞 Informar de un error, ☕ Apoya el proyecto |

Pulsa el título de una sección para plegarla o desplegarla. Una sección plegada muestra `▸` y cuántos elementos contiene, y *Social* muestra además los mensajes nuevos 💬 y las solicitudes de amistad 👥. Arcade recuerda qué secciones has plegado. Con la sesión iniciada, la cabecera del menú muestra tu @alias con los mismos contadores.

La **búsqueda** empieza a partir de dos letras y encuentra un título, un autor o un género, sin distinguir mayúsculas ni acentos. Los resultados se agrupan por sección y género, como *Libros · Policíaca* o *Juegos · Disparos*. La estrella ☆ junto a un juego, libro o audiolibro lo añade a **★ Favoritos** (hasta 100), ordenados por sección y género, con lo más reciente primero.

### Dónde se abre cada cosa

| | NES (Dendy), Flappy Arcade | Sega, Master System, PlayStation, otros Juegos; libros, audiolibros, artículos, podcasts, vídeos |
|---|---|---|
| **Terminal** | en el panel (gráficos de píxeles si la terminal los admite; si no, bloques de texto) | ventana del navegador |
| **VS Code** | en el panel | ventana del navegador |
| **Claude Desktop** | en el panel | navegador integrado de Claude o ventana del navegador (se elige en los ajustes); juegos de disparos — siempre en una ventana del navegador |

La ventana del navegador es una ventana de Arcade aparte (tu navegador predeterminado o el que elijas en los ajustes), no una pestaña más entre las tuyas. Los chats funcionan directamente en el panel, en la terminal y en Desktop; *Abrir como página* los abre igual en el sitio web. El cuaderno y los tableros de proyectos viven en el panel. TikTok se abre en el navegador integrado de Claude en Desktop y, en los demás entornos, en tu navegador predeterminado, donde probablemente ya tengas la sesión iniciada.

## El catálogo

| Pestaña | Qué contiene |
|---|---|
| **NES (Dendy)** | 28 juegos homebrew — plataformas, puzles, disparos, carreras: Thwaite, Nova the Squirrel, Super Uwol, Lala the Magical y más |
| **Sega** | 11 juegos de Mega Drive: Miniplanets, Tank Battle, Battle 4Tris, Pong y más |
| **Master System** | 4 juegos: Balloon Master, SkyHaul, Food Fighter, Escape from Monster Dimension |
| **PlayStation** | Hello Pong |
| **Juegos → Juegos arcade** | Flappy Arcade — el juego de un solo botón propio de Arcade: se juega directamente en el panel y en la ventana de Arcade; el recorrido del día es el mismo para todos y tu mejor puntuación se guarda |
| **Juegos → Disparos** | Freedoom Phase 1 y 2 (sustitutos libres de Doom), deathmatch FreeDM, Blasphemer (sustituto libre de Heretic), deathmatch BlasphDM, OpenArena — shooter de arena con el motor de Quake III contra bots (GPL-2.0) |
| **Juegos → Carreras** | HexGL — carreras futuristas antigravedad |
| **Juegos → Estrategia** | OpenTTD — magnate del transporte (GPL-2.0); Micropolis — el código abierto del clásico constructor de ciudades de 1989, tu ciudad se guarda en el navegador (micropolisJS, GPL-3.0 con términos adicionales y la Micropolis Public Name License); Warzone 2100 — estrategia en tiempo real con campaña y escaramuza contra el ordenador, diseñas tus propias unidades, las partidas guardadas se quedan en el navegador (GPL-2.0-or-later) |
| **Juegos → Aventuras** | Cuatro aventuras clásicas gratuitas de los 90 en ScummVM (GPL-3.0-or-later): Beneath a Steel Sky, Flight of the Amazon Queen, Lure of the Temptress y Nippon Safes, Inc. — datos de juego freeware con permiso de redistribución; guarda en cualquier momento con F5 |
| **Juegos → Juegos de mesa** | Ajedrez — contra personas o contra la máquina (Stockfish, niveles 1–10), en línea con reloj; go en tableros de 9×9, 13×13 y 19×19; damas rusas, reversi; *Rendirse* en todos |
| **Libros** | 136 clásicos de dominio público en estanterías por idioma y género: 98 en inglés (Austen, Dickens, Twain, Conan Doyle, Wells, Shelley, Tolstói y Dostoievski traducidos…) y 38 en ucraniano (Franko, Lesia Ukraínka, Kotsiubynski, Kotliarevski, Kulish…). El marcador se pone solo: abre de nuevo un libro y volverás donde lo dejaste. Tus EPUB, FB2 y TXT se abren en la ventana de Arcade |
| **Audiolibros** | Grabaciones de dominio público de LibriVox en estanterías por idioma y género: Oscar Wilde y O. Henry en inglés, Gógol en ucraniano. El reproductor de la ventana de Arcade recuerda dónde lo dejaste; tus archivos MP3, M4A, M4B, OGG y Opus también se abren ahí y se quedan en tu navegador |
| **Artículos** | Artículos recientes de 106 blogs y publicaciones en inglés seleccionados — Simon Willison, InfoQ, The Cloudflare Blog, Ars Technica, Krebs on Security y más |
| **Podcasts** | Episodios recientes de 65 podcasts en inglés — Software Engineering Daily, Security Now, Talk Python To Me, Darknet Diaries y más; cada episodio recuerda dónde lo dejaste |
| **YouTube** | Vídeos recientes de 153 canales seleccionados en 24 áreas, de IA, web y DevOps a ciencia, espacio y retroinformática |
| **Twitch** | *Mis canales* — cualquier canal de Twitch por nombre o enlace, primero los que están en directo; *En directo ahora* y *Catálogo completo* — 26 canales en inglés seleccionados, sin canales para mayores de 18; no hace falta registrarse |

La ficha de cada juego enlaza a su licencia y su código fuente.

**Temas.** Artículos, Podcasts y YouTube empiezan por temas: Haiku sugiere tres sobre aquello en lo que trabaja el agente, más *Novedades y presentaciones*. En *Tu propio tema* puedes escribir qué quieres ver, leer o escuchar, en cualquier idioma; tus cinco últimos temas se quedan como fichas en *Mis temas*.

## Juego en línea

- **Consolas.** Los juegos para dos jugadores de NES, Sega, Master System y PlayStation tienen un botón **En línea**: crea una sala o únete a la de otra persona. Las pulsaciones se sincronizan fotograma a fotograma a través del servidor de Arcade.
- **Doom.** **FreeDM** y **BlasphDM** son salas de deathmatch con rondas de 5 minutos para hasta cuatro jugadores; **Freedoom** y **Blasphemer** tienen cooperativo mediante **En línea**. Quien llega espera a la siguiente ronda: el motor no permite unirse a una partida en curso.
- **Juegos de mesa.** *Buscar rival*, *Invitar a un amigo* con un enlace o *Contra la máquina*. La partida se guarda en el servidor: haz un movimiento, vuelve con tu agente, abre el enlace más tarde — el tablero está donde lo dejaste. Con la sesión iniciada y un @alias, tu rival lo ve junto a tu color.
- **Quién espera.** Una vez por minuto, Arcade comprueba si alguien espera compañero y lo muestra en Claude Code — por ejemplo, *«¿jugamos? Esperando en línea: FreeDM (1)»* — con un botón **Unirse** en el menú.

## Cuenta, amigos y chats

Iniciar sesión es opcional: sin ello, todo lo demás funciona igual que antes.

- **Iniciar sesión con GitHub** (en *Social*): Arcade muestra un código y lo introduces en la página de GitHub en tu navegador habitual. Arcade solo conoce el nombre y la imagen de tu perfil de GitHub — sin correo ni acceso a repositorios.
- **Sincronización.** Tu idioma, teclas, notificaciones, tamaño del panel, qué hacer con el juego cuando el agente avisa, las opciones del navegador de Desktop, tus temas, canales de Twitch, favoritos, secciones plegadas y récord de Flappy Arcade pasan a ser iguales en todos tus ordenadores. Tus propios juegos, el navegador y el modo gráfico se quedan en cada ordenador.
- **@alias.** Toma tu nombre de GitHub con un clic o inventa uno: de 4 a 32 caracteres — letras latinas, dígitos y `_`. Puedes cambiarlo hasta 5 veces al día.
- **Amigos.** Añade a alguien por su @alias exacto: esa persona acepta la solicitud en su lado y aparecéis en la lista del otro. No hay sugerencias al escribir, así que nadie puede curiosear quién usa Arcade. Rechazar y eliminar son silenciosos.
- **En línea e invitaciones a jugar.** Mientras el menú de Arcade está abierto, tus amigos te ven *en línea*, y tú a ellos; para no aparecer, desactiva *Mostrar a mis amigos que estoy en línea* en la pantalla *Amigos*. *Invitar* junto a un amigo ofrece los juegos en red: un juego de mesa abre una sala propia para dos, un juego de Doom su lobby. El juego se abre para ti al momento; tu amigo recibe un aviso y *Aceptar* arriba del menú, y la invitación vale 10 minutos. Puedes invitar donde los juegos en red se abren en un navegador: el integrado de Desktop o una ventana del navegador.
- **Chats.** En privado con un amigo, grupos de amigos o un grupo con todos tus amigos de una vez. Escribe directamente en el panel de Arcade o abre la página de chats en el sitio web. Los mensajes se guardan en el sitio de Arcade y no están cifrados — no escribas ahí contraseñas ni claves.
- **Avatares y notificaciones de mensajes.** Elige uno de 24 avatares listos en *Cuenta* — los chats solo lo muestran; sin avatar, aparece la primera letra de tu @alias. La imagen de un grupo la elige su dueño entre los mismos 24. Tu imagen de GitHub nunca se muestra a otros. Cuando un amigo te escribe, aparece una tarjeta abajo a la izquierda sobre todas las ventanas (Windows) o una notificación del sistema (macOS, Linux); un clic en la tarjeta abre ese chat.
- **Cerrar sesión** detiene la sincronización en este ordenador; **Eliminar cuenta** (pulsa dos veces) hace que el sitio olvide tu cuenta y tus ajustes.

## Cuaderno y tableros de proyectos

Ambos están en la sección *Trabajo* del menú.

- **Cuaderno.** Páginas y subpáginas; una línea que empieza por `# ` es un título, por `- ` un elemento y por `- [ ] ` un elemento de lista de tareas que se marca con una pulsación. Se guarda en este ordenador — hasta 200 páginas y 20 000 caracteres por página.
- **Claude también lo lleva.** *Dar a Claude* le pasa una página a Claude, o simplemente pídele a Claude que anote algo en Arcade. Claude usa la herramienta `mcp__arcade__notes`, que solo cambia el cuaderno y no borra nada. Si no te gusta la edición de Claude: *Restaurar el texto de antes de la edición de Claude*.
- **Notion y otras aplicaciones** — mediante los conectores de Claude, así que Arcade no necesita claves ni contraseñas: *Enviar a Notion*, *A otra aplicación*, *Importar de Notion u otra aplicación*. Una página vinculada se puede actualizar en la aplicación o volver a importar desde ella.
- **Voz.** Dicta en el cuadro de mensaje de Claude con el dictado del propio sistema (Win+H en Windows, Fn dos veces en macOS) y pulsa *Tomar del cuadro de mensaje de Claude* — el texto pasa al final de la página.
- **Tablero de proyectos.** Columnas — *Por hacer*, *En curso*, *Hecho* o las tuyas, hasta 8 — y tarjetas; una tarjeta es una página del cuaderno con texto y lista de tareas. Pulsa una tarjeta para elegirla y moverla con las flechas; pulsa otra vez para abrirla. Claude también puede llevar un tablero: *Dar a Claude*, o pídele que reparta tareas en un tablero de Arcade.
- **Tableros compartidos.** Con la sesión iniciada y un @alias, marca a tus amigos y pulsa *Compartir*: todos tienen las mismas tarjetas, columnas y nombre, y los cambios llegan en segundos. El dueño invita a más amigos, quita participantes y elimina el tablero del sitio; cualquiera puede salir; pase lo que pase, cada uno conserva su propia copia. Hasta 3 tableros compartidos propios, 20 personas y 200 tarjetas por tablero.

## Tus propios juegos

- **`/arcade-add <archivo>`** añade una ROM de NES, Mega Drive o Master System (hasta 4 MB). El plugin guarda una copia en `~/.claude/arcade` y nunca la sube a ningún sitio.
- **Discos de PlayStation y WAD de Doom** (por ejemplo, un `doom.wad` que tengas) — en la ventana de Arcade: **Abrir tu propio archivo**. Se quedan solo en ese navegador.

Añade únicamente archivos sobre los que tengas derechos.

## Ajustes

Abre **Ajustes** en la sección *Más* del menú `/arcade`:

- **Idioma** — uno de 13 (también directamente en el menú: 🌐).
- **Dónde abrir los juegos** — aquí en el panel, en una ventana del navegador o en un navegador concreto; en Claude Desktop — en el navegador integrado de Claude o en una ventana del navegador.
- **Gráficos** (terminal) — píxeles en las terminales que muestran imágenes (kitty, Ghostty, Rio), bloques de texto en las demás.
- **Tamaño del panel** — normal o a todo el ancho.
- **Cuando el agente termine** — aviso y seguir jugando, pausa con aviso, o volver directamente al agente.
- **Cuando el agente pida permiso** — las mismas tres opciones.
- **Al abrirse el navegador** (Claude Desktop) — cerrar el menú de Arcade para que el navegador tenga toda la altura, o dejar el menú encima.
- **El agente terminó mientras miras** (Claude Desktop) — cerrar la pestaña que Arcade abrió para un vídeo, un directo, TikTok, un artículo o un episodio, para que vuelvas a tener delante el chat con Claude, o solo avisarte.
- **Notificaciones al jugar en una ventana.**
- **Notificaciones de mensajes** — una tarjeta abajo a la izquierda cuando un amigo escribe en un chat (en macOS y Linux, una notificación del sistema).
- **Prueba de teclas y reasignación de teclas** (terminal).

## Privacidad

- Sin anuncios, sin analítica, sin rastreo. A los juegos que venían con analítica se les ha quitado (consulta el `NOTICE` de cada juego).
- Tus ROM, WAD, libros y archivos de audiolibro nunca salen de tu equipo ni de tu navegador.
- El juego en línea pasa por el servidor de Arcade en Cloudflare: los mensajes se retransmiten entre los jugadores de una sala y no se guardan — salvo los movimientos de los juegos de mesa, que se guardan para que puedas volver; una partida sin tocar durante un mes se elimina.
- Los temas los sugiere Haiku en tu propia sesión de Claude Code; el sitio de Arcade nunca ve tu conversación — solo una breve consulta de búsqueda en inglés cuando usas *Tu propio tema*. La dirección de un artículo va después de `#`, así que nunca llega al servidor de Arcade.
- Con la sesión iniciada, el sitio guarda tus ajustes sincronizados, favoritos, @alias, amigos, chats y tableros compartidos, y las invitaciones a jugar durante 10 minutos. Quién está en línea solo lo guarda en memoria, un minuto y medio. La clave de sesión solo va al sitio de Arcade.
- El cuaderno se queda en tu ordenador. Los tableros compartidos se guardan en el sitio de Arcade y no están cifrados, como los chats. Las páginas van a Notion u otra aplicación solo cuando lo pides, mediante tus propios conectores de Claude.
- Un informe de error lleva tu texto, la versión de Arcade, dónde está abierto, el idioma de la interfaz y el sistema operativo — nada más; sin iniciar sesión se envía sin firma, y el sitio no guarda direcciones.
- Algunos juegos solo se conectan a internet cuando se lo pides — por ejemplo, la encuesta opcional de OpenTTD y su botón *Online Content*.

## Plataformas y estado

Arcade está en **alfa** y en desarrollo activo — consulta el [registro de cambios](CHANGELOG.md).

- Probado en vivo en Windows, macOS y Linux.
- Funciona en la terminal, en VS Code y en Claude Desktop.

## Licencias

- **Juegos:** cada juego tiene su propia licencia libre (MIT, GPL, BSD, Apache, Creative Commons y otras) — el texto de la licencia y el código fuente están junto al juego y enlazados desde su ficha.
- **Libros y audiolibros:** dominio público — los libros en inglés vienen de Project Gutenberg, los ucranianos de Wikisource y las grabaciones de LibriVox; cada libro tiene un `LICENSE.txt` con su origen.
- **Emuladores y motores:** JSNES (Apache-2.0), EmulatorJS (GPL-3.0) con sus núcleos, PrBoom (GPL-2.0), doom-wasm de Cloudflare y Chocolate Doom/Heretic (GPL-2.0), OpenTTD (GPL-2.0), micropolisJS (GPL-3.0 con términos adicionales), ScummVM (GPL-3.0-or-later), Stockfish (GPL-3.0) — el rival de ajedrez. El núcleo Genesis Plus GX que se usa para Sega y Master System es solo para uso no comercial.
- **El código propio de Arcade** (el plugin y el sitio web) — **GNU AGPL-3.0** ([LICENSE](LICENSE)), © 2026 Max Arbakov. Puedes usarlo, estudiarlo y modificarlo libremente. Si distribuyes una versión modificada — o la ofreces como servicio en línea a otras personas —, debes publicar todo tu código fuente bajo la misma licencia y conservar los avisos de copyright. Los componentes de terceros mantienen sus propias licencias.

## Apoya el proyecto

Arcade es gratuito. Si hace más amenas tus esperas, puedes invitar al proyecto a un café — totalmente voluntario: **[ko-fi.com/agentarcade](https://ko-fi.com/agentarcade)**. El mismo enlace está al final del menú `/arcade` (*☕ Apoya el proyecto*) y en la ventana de Arcade. Nada en Arcade depende de ello, y nunca interrumpe una partida.

## Comentarios

¿Has encontrado un error? Lo más rápido es hacerlo desde Arcade: **Más → 🐞 Informar de un error**. Describe qué falló y el informe llegará directamente al autor de Arcade con la versión, el entorno, el idioma y el sistema operativo.

También puedes abrir un [issue](https://github.com/ArbakovMaxim/agent-arcade/issues), para errores y para ideas. Indica tu sistema operativo, tu entorno de Claude Code (terminal, VS Code o Desktop) y el juego.

Los pull requests son bienvenidos. Al enviar uno, aceptas que tu contribución se licencia bajo AGPL-3.0 y que el autor también puede ofrecer Arcade bajo otros términos (por ejemplo, una licencia comercial).

## Para desarrolladores

```
mod/     el plugin de Claude Code (hooks, interfaz del panel, tests)
site/    el sitio web en Cloudflare Workers: catálogo, ventana de Arcade, salas en red, cuentas, amigos, chats, informes de errores
tools/   utilidades de compilación: libros, audiolibros, traducciones, heretic-wasm
.github/ GitHub Actions que compilan doom-wasm, heretic-wasm, OpenTTD y ScummVM para el navegador
```

- Ejecutar el plugin desde el repositorio: `claude --plugin-dir ./mod`
- Tests del plugin: `claude plugin validate ./mod` y luego `claude plugin test` en `mod/`
- Tests del sitio: `npm test` en `site/`; compilación: `node build.mjs`; el despliegue se hace automáticamente desde `main` con Cloudflare Workers Builds.
- El trabajo se hace en `main`, y los pull requests también van ahí. La rama por defecto `plugin` es una copia de `main` sin `site/` que una GitHub Action actualiza en cada push: el marketplace de plugins descarga esa rama y no todo el repositorio.
- Libros: `node tools/books/build.mjs` descarga y limpia los libros del catálogo (lista — `tools/books/books.json`).
- Traducciones: `node tools/i18n/collect.mjs` y luego `node tools/i18n/check.mjs` — consulta [tools/i18n/README.md](tools/i18n/README.md).

Documentación detallada (en ruso): [mod/README.md](mod/README.md) — el plugin, [site/README.md](https://github.com/ArbakovMaxim/agent-arcade/tree/main/site/README.md) — el sitio web, cómo añadir juegos y el juego en red.
