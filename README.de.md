<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Arcade-Logo" align="right">

# Arcade — spielen, lesen, hören und schauen, während dein Claude-Code-Agent arbeitet

[English](README.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Español](README.es.md) · [Français](README.fr.md) · **Deutsch** · [Português](README.pt.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [한국어](README.ko.md)

> **Beta (0.33).** Alles, was hier beschrieben ist, funktioniert und ist täglich im Einsatz; was sich jetzt noch ändert, sind vor allem Details. Fehlerberichte sind sehr willkommen — siehe [Feedback](#feedback).

Arcade ist ein Plugin für [Claude Code](https://claude.com/claude-code), das die Wartezeit füllt, während dein Agent arbeitet. Ist der Agent länger als 10 Sekunden beschäftigt, erscheint über dem Prompt ein kleines *„spielen?“*. Spiel etwas — NES, Sega, PlayStation, Doom, Schach und mehr —, lies ein Buch, hör ein Hörbuch oder einen Podcast oder schau ein Video zum Thema, an dem der Agent arbeitet. Arcade sagt dir sofort Bescheid, wenn der Agent fertig ist oder deine Erlaubnis braucht — du verpasst nichts.

Alles im Katalog ist kostenlos: Die Spiele stehen unter offenen Lizenzen, die Bücher und Hörbücher sind gemeinfrei. Du kannst auch online mit anderen spielen, die ebenfalls auf ihre Agenten warten, und mit deinen Freunden chatten.

![„spielen?“ über dem Prompt von Claude Code, nachdem der Agent 11 Sekunden gearbeitet hat](docs/images/prompt.png)

## Funktionen

- **Erscheint von selbst.** Nach 10 Sekunden Agentenarbeit bietet Arcade über dem Prompt ein Spiel an; den Fokus nimmt es nie, außer du willst es.
- **Weiß, was der Agent tut.** Wenn der Agent fertig ist oder um Erlaubnis bittet, erscheint ein Banner über dem Spiel — weiterspielen, pausieren oder direkt zurück zum Agenten (das Verhalten legst du in den Einstellungen fest). In Claude Desktop kann es auch den Tab schließen, in dem du gerade etwas ansiehst, sodass die Unterhaltung wieder vor dir ist.
- **Ein Menü, sechs Bereiche.** *Spielen*, *Lesen & hören*, *Ansehen*, *Soziales*, *Arbeit* und *Mehr* — klapp zu, was du nicht brauchst. Oben: *Fortsetzen* des letzten Spiels, *Suchen* und *Favoriten*. Beim ersten Öffnen von Arcade wählst du, welche Bereiche erscheinen.
- **61 kostenlose Spiele** für NES (Dendy), Sega Mega Drive, Master System, PlayStation und ein Tab *Spiele* mit Arcade-Spielen, Shootern, Rennspielen, Strategie, Adventures und Brettspielen.
- **Lesen und hören.** Klassiker und LibriVox-Hörbücher in 30 Sprachen, direkt von Project Gutenberg, Wikisource und LibriVox, dazu aktuelle Artikel und Podcastfolgen zum Thema der Agentenarbeit.
- **Ansehen.** Aktuelle YouTube-Videos zum Thema der Agentenarbeit, Twitch: deine eigenen Kanäle und Livestreams über Programmierung, Technik, Wissenschaft und Retro-Spiele, und TikTok: der Feed *Für dich* und die Suche direkt auf der TikTok-Website, wo du dich selbst anmeldest.
- **NES und Flappy Arcade direkt in Claude Code** — im Terminal, in VS Code und in Claude Desktop. Alles andere öffnet sich in einem Browserfenster — in Claude Desktop standardmäßig im integrierten Browser von Claude (Shooter öffnen sich trotzdem in einem Browserfenster: Der integrierte Browser kann die Maus nicht einfangen).
- **Online spielen.** Konsolenspiele zu zweit über das Netz, Deathmatch und Koop in Doom, Schach, Go, Dame und Reversi gegen Menschen oder den Computer.
- **„Wer wartet online“.** Arcade zeigt in Claude Code, wenn jemand auf einen Mitspieler wartet — mit einer Schaltfläche *Mitspielen*.
- **Freunde und Chats.** Eine optionale Anmeldung mit GitHub hält deine Einstellungen auf allen deinen Computern gleich und gibt dir einen @Namen; füge Freunde über ihren genauen Namen hinzu, sieh, wer online ist, lade sie zu einem Spiel ein und chatte zu zweit oder in Gruppen.
- **Notizbuch und Projektboards.** Seiten, Unterseiten und Checklisten, die auch Claude führt; schick eine Seite über Claudes Connectors an Notion oder eine andere App oder hol eine von dort; diktiere in Claudes Eingabefeld und übertrag den Text auf eine Seite. Boards mit Spalten und Karten — teile eines mit Freunden, und alle arbeiten am selben Board.
- **Suche und Favoriten.** Eine Suche über Spiele und Twitch-Kanäle, gruppiert nach Bereich und Genre; markiere ein Spiel mit ☆, um es in *★ Favoriten* zu behalten.
- **Eigene Spiele.** Füge ROMs hinzu, die du besitzt; sie bleiben auf deinem Rechner.
- **13 Sprachen für die Oberfläche:** English, Русский, Українська, Español, Français, Deutsch, Português, Italiano, Polski, Türkçe, 日本語, 中文, 한국어 — nach System- oder Browsersprache, standardmäßig Englisch.

## Installation

Erfordert **Claude Code 2.1.275 oder neuer**.

Im Terminal — zwei Befehle: Füge den Marketplace von Arcade (dieses Repository) hinzu und installiere dann das Plugin daraus:

```
claude plugin marketplace add ArbakovMaxim/agent-arcade
claude plugin install arcade@agent-arcade
```

Oder innerhalb einer Claude-Code-Sitzung:

```
/plugin marketplace add ArbakovMaxim/agent-arcade
/plugin install arcade@agent-arcade
```

Das Plugin wird für alle Sitzungen und Apps installiert. Die VS-Code-Erweiterung hat keinen Befehl `/plugin` — installiere es im Terminal, und die Erweiterung übernimmt das Plugin in einer neuen Unterhaltung.

**Aktualisieren:**

```
/plugin marketplace update agent-arcade
/plugin update arcade@agent-arcade
```

Starte danach Claude Code neu. Der Marketplace lädt nur das Plugin herunter — ein paar MiB, ohne die Website —, deshalb dauert ein Update nur Sekunden. Ist Arcade schon installiert, musst du nichts tun: Der Marketplace stellt beim nächsten Update von selbst um.

Meldet `/plugin update` *already at the latest version*, obwohl eine neuere Arcade-Version erschienen ist, wurde der Marketplace nicht aktualisiert. Warum, zeigt `claude plugin marketplace update agent-arcade` im Terminal. Steht dort *timed out*, gib dem Klonen 10 Minuten:

```
CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000 claude plugin marketplace update agent-arcade
```

In PowerShell: `$env:CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000; claude plugin marketplace update agent-arcade`. Führe danach `/plugin update arcade@agent-arcade` noch einmal aus.

**Deinstallieren:** `/plugin uninstall arcade@agent-arcade`

## Bedienung

- **`/arcade`** öffnet das Menü jederzeit.
- Arbeitet der Agent länger als 10 Sekunden, erscheint über dem Prompt *„spielen?“*: **`1`** — hier im Panel spielen; **`2`** — in einem Browserfenster (wo verfügbar); **`3`** — jetzt nicht.
- Pfeiltasten oder Tab zum Auswählen, Enter zum Öffnen; die Maus funktioniert auch. Die Steuerung steht unter jedem Spiel.
- Wenn der Agent fertig ist oder auf Erlaubnis wartet, erscheint ein Banner über dem Spiel: **Zurück zum Agenten** oder **Weiterspielen**.

### Das Menü

| Bereich | Inhalt |
|---|---|
| *(oben)* | **▶ Fortsetzen** des letzten Spiels, **🔍 Suchen**, **★ Favoriten** |
| **Spielen** | NES, Sega, Master System, PlayStation, Spiele; *Mitspielen*, wenn jemand online wartet; **Meine Spiele** |
| **Lesen & hören** | Bücher, Hörbücher, Artikel, Podcasts |
| **Ansehen** | YouTube, Twitch, TikTok |
| **Soziales** | Freunde, Chats, **Mit GitHub anmelden** (oder **Konto** nach der Anmeldung) |
| **Arbeit** | Notizbuch, Projektboard |
| **Mehr** | Arcade-Fenster, Einstellungen, 🌐 Sprache, 🐞 Fehler melden, ☕ Projekt unterstützen |

Ein Klick auf den Titel eines Bereichs klappt ihn zu oder auf. Ein zugeklappter Bereich zeigt `▸` und wie viele Kacheln er enthält, *Soziales* zusätzlich neue Nachrichten 💬 und Freundschaftsanfragen 👥. Arcade merkt sich, welche Bereiche zugeklappt sind. Einen Bereich, den du nicht brauchst, kannst du in den **Einstellungen** ausblenden: Dann fehlt er im Menü ganz, samt Titel und Kacheln; *Mehr* mit den Einstellungen bleibt immer. Nach der Anmeldung zeigt der Menükopf deinen @Namen mit denselben Zählern.

Die **Suche** startet ab zwei Buchstaben und findet Titel oder Genres, ohne auf Groß-/Kleinschreibung und Akzente zu achten. Die Ergebnisse sind nach Bereich und Genre gruppiert, etwa *Spiele · Shooter*. Der Stern ☆ neben einem Spiel fügt es zu **★ Favoriten** hinzu (bis zu 100), geordnet nach Bereich und Genre, das Neueste zuerst. Bücher und Hörbücher haben ihre eigene Suche nach Titel oder Autor.

### Wo sich was öffnet

| | NES (Dendy), Flappy Arcade | Sega, Master System, PlayStation, andere Spiele; Bücher, Hörbücher, Artikel, Podcasts, Videos |
|---|---|---|
| **Terminal** | im Panel (Pixelgrafik, wo das Terminal sie unterstützt, sonst Textblöcke) | Browserfenster |
| **VS Code** | im Panel | Browserfenster |
| **Claude Desktop** | im Panel | integrierter Browser von Claude oder Browserfenster (Auswahl in den Einstellungen); Shooter — immer ein Browserfenster |

Das Browserfenster ist ein eigenes Arcade-Fenster (in deinem Standardbrowser oder dem in den Einstellungen gewählten), kein Tab zwischen deinen üblichen. Chats funktionieren direkt im Panel — im Terminal und in Desktop; *Als Seite öffnen* öffnet sie genauso auf der Website. Notizbuch und Projektboards laufen im Panel. TikTok öffnet sich in Desktop im integrierten Browser von Claude und anderswo in deinem Standardbrowser, wo du wahrscheinlich schon angemeldet bist.

## Der Katalog

| Tab | Inhalt |
|---|---|
| **NES (Dendy)** | 28 Homebrew-Spiele — Plattformer, Puzzles, Shooter, Rennspiele: Thwaite, Nova the Squirrel, Super Uwol, Lala the Magical und mehr |
| **Sega** | 11 Mega-Drive-Spiele: Miniplanets, Tank Battle, Battle 4Tris, Pong und mehr |
| **Master System** | 4 Spiele: Balloon Master, SkyHaul, Food Fighter, Escape from Monster Dimension |
| **PlayStation** | Hello Pong |
| **Spiele → Arcade-Spiele** | Flappy Arcade — Arcades eigenes Ein-Knopf-Spiel: läuft direkt im Panel und im Arcade-Fenster; die Strecke des Tages ist für alle gleich, dein Rekord wird gespeichert |
| **Spiele → Shooter** | Freedoom Phase 1 und 2 (freier Doom-Ersatz), FreeDM-Deathmatch, Blasphemer (freier Heretic-Ersatz), BlasphDM-Deathmatch, OpenArena — Arena-Shooter auf der Quake-III-Engine gegen Bots (GPL-2.0) |
| **Spiele → Rennspiele** | HexGL — futuristisches Antigravitationsrennen |
| **Spiele → Strategie** | OpenTTD — Transport-Tycoon (GPL-2.0); Micropolis — der offene Quellcode des klassischen Städtebauspiels von 1989, deine Stadt wird im Browser gespeichert (micropolisJS, GPL-3.0 mit zusätzlichen Bedingungen und der Micropolis Public Name License); Warzone 2100 — Echtzeitstrategie mit Kampagne und Gefecht gegen den Computer, deine Einheiten entwirfst du selbst, Spielstände bleiben im Browser (GPL-2.0-or-later) |
| **Spiele → Adventures** | Vier kostenlose klassische Adventures der 90er in ScummVM (GPL-3.0-or-later): Beneath a Steel Sky, Flight of the Amazon Queen, Lure of the Temptress und Nippon Safes, Inc. — Freeware-Spieldaten mit Erlaubnis zur Weitergabe; speichern jederzeit mit F5 |
| **Spiele → Brettspiele** | Schach — gegen Menschen oder den Computer (Stockfish, Stufen 1–10), online mit Uhr; Go auf 9×9-, 13×13- und 19×19-Brettern; russische Dame, Reversi; *Aufgeben* überall |
| **Bücher** | Gemeinfreie Klassiker in 30 Sprachen — die Sprache wählst du selbst (zuerst die Sprache der Oberfläche). Die Bereiche sind in jeder Sprache gleich: Beliebt, Belletristik, Lyrik, Dramen, Abenteuer, Krimis und weitere; gesucht wird nach Titel oder Autor. Die Liste kommt bei Bedarf von Project Gutenberg und Wikisource — Arcade speichert selbst keine Bücher; ein geöffnetes Buch bleibt unter *Meine Bücher* in deinem Browser. Das Lesezeichen setzt sich von selbst: Öffne ein Buch erneut, und du bist wieder an der Stelle, an der du aufgehört hast. Eigene EPUB-, FB2- und TXT-Dateien öffnen sich ebenfalls im Arcade-Fenster |
| **Hörbücher** | LibriVox-Aufnahmen in denselben Sprachen und Bereichen, mit Suche: online direkt von archive.org hören oder ein Buch in den Browser laden und offline hören. Der Player im Arcade-Fenster merkt sich Kapitel, Stelle und Tempo; deine eigenen MP3-, M4A-, M4B-, OGG- und Opus-Dateien öffnen sich dort ebenfalls und bleiben in deinem Browser |
| **Artikel** | Aktuelle Artikel aus 106 ausgewählten englischsprachigen Blogs und Publikationen — Simon Willison, InfoQ, The Cloudflare Blog, Ars Technica, Krebs on Security und mehr |
| **Podcasts** | Aktuelle Folgen von 65 englischsprachigen Podcasts — Software Engineering Daily, Security Now, Talk Python To Me, Darknet Diaries und mehr; jede Folge merkt sich, wo du aufgehört hast |
| **YouTube** | Aktuelle Videos aus 153 ausgewählten Kanälen in 24 Richtungen, von KI, Web und DevOps bis Wissenschaft, Raumfahrt und Retro-Computing |
| **Twitch** | *Meine Kanäle* — jeder Twitch-Kanal per Name oder Link, Live-Kanäle zuerst; *Jetzt live* und *Gesamter Katalog* — 26 ausgewählte englischsprachige Kanäle, keine 18+-Kanäle; keine Registrierung nötig |

Die Karte jedes Spiels verlinkt seine Lizenz und seinen Quellcode.

**Themen.** Artikel, Podcasts und YouTube beginnen mit Themen: Haiku schlägt drei zu dem vor, woran der Agent arbeitet, dazu *Neuheiten und Präsentationen*. Unter *Eigenes Thema* kannst du in jeder Sprache eingeben, was du sehen, lesen oder hören willst; deine letzten fünf Themen bleiben als Kacheln unter *Meine Themen*.

## Online spielen

- **Konsolen.** Zwei-Spieler-Spiele für NES, Sega, Master System und PlayStation haben eine Schaltfläche **Online**: Erstelle einen Raum oder tritt dem eines anderen bei. Die Eingaben werden Bild für Bild über Arcades Server synchronisiert.
- **Doom.** **FreeDM** und **BlasphDM** sind Deathmatch-Lobbys mit 5-Minuten-Runden für bis zu vier Spieler; **Freedoom** und **Blasphemer** bieten Koop über **Online**. Neue Spieler warten auf die nächste Runde — die Engine erlaubt keinen Einstieg in ein laufendes Match.
- **Brettspiele.** *Gegner finden*, *Freund einladen* per Link oder *Gegen den Computer*. Die Partie wird auf dem Server gespeichert: Zieh, geh zurück zu deinem Agenten, öffne den Link später — das Brett ist, wie du es verlassen hast. Bist du mit einem @Namen angemeldet, sieht dein Gegner ihn neben deiner Farbe.
- **Wer wartet.** Einmal pro Minute prüft Arcade, ob jemand auf einen Mitspieler wartet, und zeigt es in Claude Code — zum Beispiel *„spielen? Mitspieler warten online: FreeDM (1)“* — mit einer Schaltfläche **Mitspielen** im Menü.

## Konto, Freunde und Chats

Die Anmeldung ist optional — ohne sie funktioniert alles andere wie bisher.

- **Mit GitHub anmelden** (unter *Soziales*): Arcade zeigt einen Code, den du auf der GitHub-Seite in deinem normalen Browser eingibst. Arcade erfährt nur den Namen und das Bild deines GitHub-Profils — keine E-Mail, kein Zugriff auf Repositories.
- **Synchronisierung.** Sprache, Tasten, Benachrichtigungen, Panelgröße, was beim Signal des Agenten mit dem Spiel passiert, die Browseroptionen in Desktop, deine Themen, Twitch-Kanäle, Favoriten, zugeklappte und ausgeblendete Bereiche und dein Flappy-Arcade-Rekord werden auf allen deinen Computern gleich. Eigene Spiele, Browser und Grafikmodus bleiben pro Computer.
- **@Name.** Übernimm deinen GitHub-Namen mit einem Klick oder denk dir einen aus: 4 bis 32 Zeichen — lateinische Buchstaben, Ziffern und `_`. Du kannst ihn bis zu 5-mal am Tag ändern.
- **Freunde.** Füge Freunde über ihren genauen @Namen hinzu: Die Anfrage wird auf der anderen Seite angenommen, und ihr erscheint gegenseitig in euren Listen. Beim Tippen gibt es keine Vorschläge, also kann niemand durchstöbern, wer Arcade nutzt. Ablehnen und Entfernen passieren still.
- **Online und Einladungen zum Spielen.** Solange das Arcade-Menü offen ist, sehen deine Freunde dich *online* und du sie; willst du unsichtbar bleiben, schalte auf dem Bildschirm *Freunde* die Option *Freunden zeigen, dass ich online bin* aus. *Einladen* neben einem Freund bietet die Netzwerkspiele an: Ein Brettspiel öffnet einen eigenen Raum für zwei, ein Doom-Spiel seine Lobby. Das Spiel öffnet sich bei dir sofort; dein Freund bekommt eine Benachrichtigung und oben im Menü *Annehmen*, und die Einladung gilt 10 Minuten. Einladen kannst du dort, wo Netzwerkspiele im Browser öffnen — im eingebauten Browser von Desktop oder in einem Browserfenster.
- **Chats.** Zu zweit mit einem Freund, Gruppen aus Freunden oder eine Gruppe mit allen deinen Freunden auf einen Klick. Schreib direkt im Arcade-Panel oder öffne die Chat-Seite auf der Website. Nachrichten werden auf Arcades Website gespeichert und sind nicht verschlüsselt — schreib dort keine Passwörter oder Schlüssel.
- **Avatare und Benachrichtigungen bei Nachrichten.** Wähle unter *Konto* einen von 24 fertigen Avataren — die Chats zeigen ihn nur an; ohne Avatar steht dort der erste Buchstabe deines @Namens. Das Bild einer Gruppe wählt ihr Besitzer aus denselben 24. Dein GitHub-Bild sehen andere nie. Schreibt dir ein Freund, erscheint unten links über allen Fenstern eine Karte (Windows) oder eine Systembenachrichtigung (macOS, Linux); ein Klick auf die Karte öffnet diesen Chat.
- **Abmelden** beendet die Synchronisierung auf diesem Computer; **Konto löschen** (zweimal drücken) lässt die Website dich und deine Einstellungen vergessen.

## Notizbuch und Projektboards

Beides findest du im Bereich *Arbeit* des Menüs.

- **Notizbuch.** Seiten und Unterseiten; eine Zeile, die mit `# ` beginnt, ist eine Überschrift, mit `- ` ein Punkt, mit `- [ ] ` ein Checklistenpunkt, den du per Druck abhakst. Es wird auf diesem Computer gespeichert — bis zu 200 Seiten, 20.000 Zeichen pro Seite.
- **Auch Claude führt es.** *An Claude geben* übergibt Claude eine Seite, oder bitte Claude einfach, etwas in Arcade zu notieren. Claude nutzt dafür das Werkzeug `mcp__arcade__notes`, das nur das Notizbuch ändert und nichts löscht. Gefällt dir Claudes Änderung nicht: *Text vor Claudes Änderung wiederherstellen*.
- **Notion und andere Apps** — über Claudes Connectors, Arcade braucht also keine Schlüssel oder Passwörter: *An Notion senden*, *In eine andere App*, *Aus Notion oder einer anderen App importieren*. Eine verknüpfte Seite lässt sich in der App aktualisieren oder erneut von dort importieren.
- **Per Stimme.** Diktiere mit der Diktierfunktion des Systems in Claudes Eingabefeld (Win+H unter Windows, zweimal Fn unter macOS) und drück dann *Aus Claudes Eingabefeld übernehmen* — der Text wandert ans Ende der Seite.
- **Projektboard.** Spalten — *Zu erledigen*, *In Arbeit*, *Erledigt* oder eigene, bis zu 8 — und Karten; eine Karte ist eine Notizbuchseite mit Text und Checkliste. Drück auf eine Karte, um sie zu wählen und mit den Pfeilen zu verschieben, noch einmal, um sie zu öffnen. Auch Claude kann ein Board führen: *An Claude geben*, oder bitte ihn, Aufgaben auf einem Board in Arcade zu verteilen.
- **Geteilte Boards.** Bist du mit einem @Namen angemeldet, hak Freunde an und drück *Teilen*: Alle haben dieselben Karten, Spalten und denselben Namen, und Änderungen kommen innerhalb von Sekunden an. Der Besitzer lädt weitere Freunde ein, entfernt Leute und löscht das Board von der Website; verlassen kann es jeder; was auch passiert, jeder behält seine eigene Kopie. Bis zu 3 eigene geteilte Boards, 20 Leute und 200 Karten pro Board.

## Eigene Spiele

- **`/arcade-add <Datei>`** fügt ein NES-, Mega-Drive- oder Master-System-ROM hinzu (bis 4 MB). Das Plugin legt eine Kopie in `~/.claude/arcade` ab und lädt sie nie hoch.
- **PlayStation-Discs und Doom-WADs** (zum Beispiel eine eigene `doom.wad`) — im Arcade-Fenster: **Eigene Datei öffnen**. Sie bleiben nur in diesem Browser.

Füge nur Dateien hinzu, an denen du die Rechte hast.

## Einstellungen

Öffne **Einstellungen** im Bereich *Mehr* des Menüs `/arcade`:

- **Bereiche des Hauptmenüs** — jeden Bereich außer *Mehr* zeigen oder ausblenden; ein ausgeblendeter Bereich fehlt im Menü ganz, bis du ihn hier zurückholst. Dieselbe Wahl bietet Arcade beim ersten Öffnen an.
- **Sprache** — eine von 13 (auch direkt im Menü: 🌐).
- **Spiele öffnen** — hier im Panel, in einem Browserfenster oder in einem bestimmten Browser; in Claude Desktop — im integrierten Browser von Claude oder in einem Browserfenster.
- **Grafik** (Terminal) — Pixel in Terminals, die Bilder anzeigen (kitty, Ghostty, Rio), sonst überall Textblöcke.
- **Panelgröße** — normal oder volle Breite.
- **Wenn der Agent fertig ist** — Banner und weiterspielen, Pause mit Banner oder direkt zurück zum Agenten.
- **Wenn der Agent um Erlaubnis bittet** — dieselben drei Optionen.
- **Wenn der Browser aufgeht** (Claude Desktop) — das Arcade-Menü schließen, damit der Browser die volle Höhe bekommt, oder das Menü darüber behalten.
- **Agent fertig, während du schaust** (Claude Desktop) — den Tab schließen, den Arcade für ein Video, einen Stream, TikTok, einen Artikel oder eine Folge geöffnet hat, damit der Chat mit Claude wieder vor dir ist, oder nur Bescheid geben.
- **Benachrichtigungen beim Spielen im Fenster.**
- **Benachrichtigungen bei Nachrichten** — eine Karte unten links, wenn ein Freund im Chat schreibt (unter macOS und Linux eine Systembenachrichtigung).
- **Tastentest und Tastenbelegung** (Terminal).

## Was das Plugin auf deinem Computer tut

Arcade läuft in Claude Code mit dem Zugriff, den Claude Code Plugins gibt. Sein gesamter Code liegt in diesem Repository, und `claude plugin validate ./mod` listet jedes Ereignis, in das es sich einhängt, und jeden Aufruf, den es macht. Kurz gesagt:

- **Die Werkzeuge des Agenten.** Arcade sieht, wann ein Werkzeug startet und endet und wann der Agent um Erlaubnis bittet — so weiß es, wann es sein Banner zeigt. Die Werkzeugaufrufe des Agenten ändert oder blockiert es nie. Selbst erlaubt es nur zwei Arten von Aufrufen, und nur dort, wo Claude Code dich sonst fragen würde: `mcp__arcade__notes`, das nur das Notizbuch ändert und nichts löscht, und das Öffnen eines Spiels im integrierten Browser von Desktop, nachdem du es im Panel gedrückt hast. Deine Regeln zum Erlauben und Verbieten gelten unverändert.
- **Den Agenten unterbrechen.** Nur in Claude Desktop, wenn du etwas im integrierten Browser öffnest, während der Agent arbeitet: Desktop lässt ein Plugin den Browser nicht selbst öffnen. Arcade wartet, bis das laufende Werkzeug fertig ist (nach 10 Sekunden bricht es es ab, wartet aber, solange eine Erlaubnisfrage zu sehen ist), unterbricht den Agenten und bittet Claude, die Seite zu öffnen und weiterzuarbeiten. Um das zu vermeiden, wähle in *Einstellungen → Spiele öffnen* ein Browserfenster.
- **Deine Unterhaltung.** Für Themen bekommt Haiku in deiner eigenen Sitzung das Ende der Unterhaltung, ein paar tausend Zeichen; das zählt zu deiner Claude-Nutzung. Arcades Website sieht die Unterhaltung nie. In Claudes Eingabefeld schreibt Arcade oder schickt es ab nur, wenn du darum bittest — etwa mit *An Claude geben* im Notizbuch — oder um eine Seite wie oben beschrieben zu öffnen.
- **Programme.** Dein Browser für das Arcade-Fenster (unter Windows mit eigenem Profil in `%LOCALAPPDATA%\claude-arcade`); Benachrichtigungen — PowerShell unter Windows, `osascript` unter macOS, `notify-send` unter Linux; eine Prüfung, welche Browser installiert sind (Windows) oder welches System es ist (`uname`).
- **Dateien.** Es schreibt nur die ROMs, die du mit `/arcade-add` hinzufügst, nach `~/.claude/arcade/roms` und liest nur die Datei, die du nennst, diese Kopien und seine eigenen Dateien. Einstellungen, Notizbuch und Favoriten liegen im Plugin-Speicher von Claude Code.
- **Umgebungsvariablen.** Es liest `HOME` oder `USERPROFILE`, `LANG`, `LC_ALL`, `LC_MESSAGES`, `LOCALAPPDATA` und `OS` und ändert keine davon.
- **Netzwerk.** Das Plugin selbst spricht nur mit Arcades Website (`agent-arcade.fefaodessa.workers.dev`), den RSS-Feeds von YouTube-Kanälen und den Feeds der Blogs und Podcasts, die es zeigt. Bilder im Desktop-Panel, etwa Twitch-Avatare, laden direkt von diesen Diensten. Spiele, Bücher und Videos lädt die Seite, die du im Browser öffnest.

## Datenschutz

- Keine Werbung, keine Analyse, kein Tracking. Spiele, die mit Analyse-Code kamen, wurden davon befreit (siehe die `NOTICE` jedes Spiels).
- Deine eigenen ROMs, WADs, Bücher und Hörbuchdateien verlassen nie deinen Rechner oder Browser.
- Listen von Büchern und Hörbüchern sowie Bücher von Project Gutenberg kommen über die Arcade-Website, die sie bei Project Gutenberg, Wikisource und archive.org abruft und nur im Cache von Cloudflare hält — Listen sechs Stunden, ein Buch eine Woche. Wikisource-Seiten und LibriVox-Aufnahmen lädt das Fenster direkt von diesen Websites.
- Online-Spiele laufen über Arcades Server auf Cloudflare: Nachrichten werden zwischen den Spielern eines Raums weitergeleitet und nicht gespeichert — außer Zügen in Brettspielen, die aufbewahrt werden, damit du zurückkommen kannst; eine Partie, die einen Monat unberührt bleibt, wird gelöscht.
- Themen schlägt Haiku in deiner eigenen Claude-Code-Sitzung vor; Arcades Website sieht deine Unterhaltung nie — nur eine kurze englische Suchanfrage, wenn du *Eigenes Thema* nutzt. Die Adresse eines Artikels steht hinter `#` und erreicht deshalb nie Arcades Server.
- Bist du angemeldet, speichert die Website deine synchronisierten Einstellungen, Favoriten, deinen @Namen, Freunde, Chats und geteilte Boards, dazu Einladungen zum Spielen für 10 Minuten. Wer online ist, hält sie nur im Arbeitsspeicher, anderthalb Minuten lang. Der Sitzungsschlüssel geht nur an Arcades Website.
- Das Notizbuch bleibt auf deinem Computer. Geteilte Boards werden wie Chats auf Arcades Website gespeichert und sind nicht verschlüsselt. Seiten gehen nur auf deinen Wunsch an Notion oder eine andere App, und zwar über deine eigenen Claude-Connectors.
- Ein Fehlerbericht enthält deinen Text, die Arcade-Version, wo Arcade geöffnet ist, die Oberflächensprache und das Betriebssystem — sonst nichts; ohne Anmeldung geht er unsigniert raus, und die Website speichert keine Adresse.
- Manche Spiele gehen nur ins Internet, wenn du es willst — zum Beispiel die optionale Umfrage von OpenTTD und seine Schaltfläche *Online Content*.

## Plattformen und Status

Arcade ist in der **Beta**: Die Funktionen stehen, die Arbeit geht an den Details weiter — siehe das [Änderungsprotokoll](CHANGELOG.md).

- Live getestet unter Windows, macOS und Linux.
- Läuft im Terminal, in VS Code und in Claude Desktop.

## Lizenzen

- **Spiele:** Jedes Spiel hat seine eigene freie Lizenz (MIT, GPL, BSD, Apache, Creative Commons und andere) — Lizenztext und Quellcode liegen neben dem Spiel und sind von seiner Karte aus verlinkt.
- **Bücher und Hörbücher:** gemeinfrei; Arcade speichert sie nicht — Bücher kommen von Project Gutenberg und Wikisource, Aufnahmen von LibriVox (archive.org), und zwar in dem Moment, in dem du sie öffnest.
- **Emulatoren und Engines:** JSNES (Apache-2.0), EmulatorJS (GPL-3.0) mit seinen Cores, PrBoom (GPL-2.0), doom-wasm von Cloudflare und Chocolate Doom/Heretic (GPL-2.0), OpenTTD (GPL-2.0), micropolisJS (GPL-3.0 mit zusätzlichen Bedingungen), ScummVM (GPL-3.0-or-later), Stockfish (GPL-3.0) — der Schachcomputer. Der für Sega und Master System genutzte Core Genesis Plus GX ist nur für nichtkommerzielle Nutzung.
- **Arcades eigener Code** (Plugin und Website) — **GNU AGPL-3.0** ([LICENSE](LICENSE)), © 2026 Max Arbakov. Du darfst ihn frei nutzen, studieren und ändern. Wenn du eine geänderte Version verbreitest — oder sie als Online-Dienst für andere betreibst —, musst du deinen gesamten Quellcode unter derselben Lizenz veröffentlichen und die Urheberrechtshinweise beibehalten. Komponenten Dritter behalten ihre eigenen Lizenzen.

## Projekt unterstützen

Arcade ist kostenlos. Wenn es deine Wartezeiten unterhaltsamer macht, kannst du dem Projekt einen Kaffee spendieren — ganz freiwillig: **[ko-fi.com/agentarcade](https://ko-fi.com/agentarcade)**. Derselbe Link steht unten im Menü `/arcade` (*☕ Projekt unterstützen*) und im Arcade-Fenster. Nichts in Arcade hängt davon ab, und es unterbricht nie ein Spiel.

## Feedback

Einen Fehler gefunden? Am schnellsten geht es direkt in Arcade: **Mehr → 🐞 Fehler melden**. Beschreib, was kaputtgegangen ist, und der Bericht geht direkt an den Autor von Arcade — mit Version, Umgebung, Sprache und Betriebssystem.

Du kannst auch ein [Issue](https://github.com/ArbakovMaxim/agent-arcade/issues) eröffnen — für Fehler und für Ideen. Nenn bitte dein Betriebssystem, deine Claude-Code-Umgebung (Terminal, VS Code oder Desktop) und das Spiel.

Pull Requests sind willkommen. Mit dem Einreichen stimmst du zu, dass dein Beitrag unter AGPL-3.0 lizenziert wird und dass der Autor Arcade auch unter anderen Bedingungen anbieten darf (zum Beispiel unter einer kommerziellen Lizenz).

## Für Entwickler

```
mod/     das Claude-Code-Plugin (Hooks, Panel-Oberfläche, Tests)
site/    die Website auf Cloudflare Workers: Katalog, Arcade-Fenster, Netzwerkräume, Konten, Freunde, Chats, Fehlerberichte
tools/   Build-Helfer: Übersetzungen, heretic-wasm
.github/ GitHub Actions, die doom-wasm, heretic-wasm, OpenTTD und ScummVM für den Browser bauen
```

- Plugin aus dem Repository starten: `claude --plugin-dir ./mod`
- Plugin-Tests: `claude plugin validate ./mod`, dann `claude plugin test` in `mod/`
- Website-Tests: `npm test` in `site/`; Build: `node build.mjs`; das Deployment läuft automatisch aus `main` über Cloudflare Workers Builds.
- Gearbeitet wird in `main`, Pull Requests bitte auch dorthin. Der Standard-Branch `plugin` ist eine Kopie von `main` ohne `site/`, die eine GitHub Action bei jedem Push aktualisiert: Der Plugin-Marketplace lädt ihn statt des ganzen Repositorys.
- Übersetzungen: `node tools/i18n/collect.mjs`, dann `node tools/i18n/check.mjs` — siehe [tools/i18n/README.md](tools/i18n/README.md).

Ausführliche Dokumentation (auf Russisch): [mod/README.md](mod/README.md) — das Plugin, [site/README.md](https://github.com/ArbakovMaxim/agent-arcade/tree/main/site/README.md) — die Website, Spiele hinzufügen und Netzwerkspiel.
