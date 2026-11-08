<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Arcade-Logo" align="right">

# Arcade — Aufgabenboards, Notizen, Team-Chats und Spiele direkt in Claude Code

[English](README.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Español](README.es.md) · [Français](README.fr.md) · **Deutsch** · [Português](README.pt.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [한국어](README.ko.md)

> **Beta (0.39).** Alles, was hier beschrieben ist, funktioniert und ist täglich im Einsatz; was sich jetzt noch ändert, sind vor allem Details. Fehlerberichte sind sehr willkommen — siehe [Feedback](#feedback).

Arcade ist ein Plugin für [Claude Code](https://claude.com/claude-code), das daraus einen kleinen Arbeitsplatz macht: Projektboards, deren Karten Claude eine nach der anderen abarbeitet, sogar in mehreren Sitzungen gleichzeitig; ein Notizbuch, das Claude mit dir führt und das alle offenen Sitzungen teilen; einen Kalender; und geteilte Boards und Chats für dein Team. Und für die Wartezeit: Ist der Agent länger als 10 Sekunden beschäftigt, erscheint über dem Prompt ein kleines *„spielen?“*. Spiel etwas — NES, Sega, PlayStation, Doom, Schach und mehr —, lies ein Buch, hör ein Hörbuch oder einen Podcast oder schau ein Video zum Thema, an dem der Agent arbeitet. Arcade sagt dir sofort Bescheid, wenn der Agent fertig ist oder deine Erlaubnis braucht — du verpasst nichts.

Alles im Katalog ist kostenlos: Die Spiele stehen unter offenen Lizenzen, die Bücher und Hörbücher sind gemeinfrei. Du kannst auch online mit anderen spielen, die ebenfalls auf ihre Agenten warten, und mit deinen Freunden chatten.

![Demo: ein Projektboard in Claude Desktop; eine Karte öffnet sich als Seite mit Checkliste, „An Claude geben“ übergibt sie, und Claude hakt jeden Punkt ab, schreibt das Ergebnis auf die Karte und schiebt sie nach „Erledigt“](https://github.com/user-attachments/assets/c6519d8f-2bb5-4af2-9ebf-c4bfa5c144c6)

*Dein Board: Eine Karte geht mit einem Knopf an Claude, Oberfläche auf Englisch. [31-Sekunden-Video ansehen](https://github.com/user-attachments/assets/c9076e68-2db6-4f68-9d88-8a132ce96f6a).*

![Demo: Claude Code bekommt eine Aufgabe, über dem Prompt erscheint „spielen?“, neben dem Chat läuft ein NES-Spiel, und wenn der Agent fertig ist, holt Arcade dich zurück; Bücher, Hörbücher und Artikel gibt es auch](https://github.com/user-attachments/assets/3d8f79ac-966f-4872-84d5-7aa91534330d)

*Während der Agent arbeitet: 31 Sekunden in Claude Desktop, Oberfläche auf Englisch. [Video in 720p ansehen](https://github.com/user-attachments/assets/bbb14c28-2813-40c0-82e6-d7375ddc2253).*

## Funktionen

- **Notizbuch und Projektboards.** Seiten, Unterseiten und Checklisten, die auch Claude führt, und Boards mit Spalten und Karten. *An Claude geben* übergibt Claude eine Seite oder Karte: Claude hakt Erledigtes ab und schreibt das Ergebnis dazu. Eine Seite oder Karte zeigt ihren Text formatiert, mit den Knöpfen *Bearbeiten* und *Kopieren*. Alle offenen Claude-Code-Sitzungen teilen sich das Notizbuch, so kann jede ihre eigene Karte vom selben Board nehmen. Teile ein Board mit Freunden, und alle arbeiten am selben. Schick eine Seite über Claudes Connectors an Notion oder eine andere App oder hol eine von dort; diktiere in Claudes Eingabefeld und übertrag den Text auf eine Seite.
- **Claude arbeitet dein Board ab.** *Warteschlange für Claude* gibt Claude die Karten der ersten Spalte nacheinander: Die nächste geht los, sobald die vorige in *Erledigt* ist, und eine Frage von Claude oder eine unfertige Karte stoppt die Warteschlange. Karten haben Fälligkeitsdaten, die im Kalender erscheinen, und auf einem geteilten Board sieht jeder, wer welche Karte genommen hat. Hol Issues aus GitHub, Linear, Jira oder einem anderen Tracker als Karten auf ein Board und schick das Ergebnis als Kommentar zurück — über Claudes Connectors. *Tageszusammenfassung* erstellt eine Seite fürs Standup — was an Claude ging, was erledigt ist, was in Arbeit ist — zum Senden in den Chat deines Teams.
- **Prompts.** Anfragen, die du immer wieder tippst, werden zu Vorlagen auf Knopfdruck: Ein Druck schickt eine an Claude, wie *An Claude geben*, und mit *Ins Eingabefeld* ergänzt du sie vorher noch. Teile eine Sammlung mit Freunden, und das ganze Team hat dieselben Prompts. Auch Claude speichert Vorlagen: „speichere das als Prompt in Arcade“.
- **Heute.** Die erste Kachel in *Arbeit* zeigt auf einem Bildschirm, was auf dich wartet: Sitzungen, die auf eine Erlaubnis oder eine Antwort warten (eine Frage mit Optionen beantwortest du gleich dort), die Termine von heute, Karten, die heute fällig oder überfällig sind, deine Karten auf geteilten Boards, ungelesene Chats und eine Zeile mit Claudes Limits.
- **Agenten.** *Agenten* im Bereich *Arbeit* zeigt jede Claude-Code-Sitzung mit Arcade auf diesem Computer, nach Ordner: ob sie arbeitet, auf Erlaubnis wartet, ihren Zug beendet hat oder frei ist, und wie lange schon, mit ihrer Karte und ihrem Platz in der Warteschlange. Stellt Claude in einer anderen Sitzung eine Frage mit Optionen, antwortest du per Knopf direkt in ihrer Karte. Bittet eine andere Sitzung um Erlaubnis oder stellt eine Frage, sagt dir das eine Einblendung in deinem eigenen Panel. Die Warteschlange eines Boards kann in mehreren Sitzungen gleichzeitig laufen, und zwei Sitzungen bekommen nicht dieselbe Karte. Jede Karte zeigt auch den git-Branch und die nicht committeten Dateien der Sitzung und warnt, wenn zwei Sitzungen dieselbe Datei bearbeiten.
- **Limits.** Die Kachel *Limits* im Bereich *Arbeit* zeigt Claudes Limit-Fenster — 5 Stunden, die Woche und das Ausgabenlimit — mit Prozentwert, Balken und dem Zeitpunkt, zu dem jedes zurückgesetzt wird, dazu Kontext und Kosten dieser und deiner anderen Sitzungen. Die Zahlen stammen von Claude Code selbst. Läuft ein Limit mitten in der Warteschlange eines Boards ab, setzt ein Knopf sie nach dem Reset fort.
- **Kalender.** In Desktop ein Monat aus gleich großen Tageskacheln mit einem Punkt in der Farbe jedes Termins, im Terminal und in VS Code die Liste der nächsten Termine. Ein Termin entsteht mit einer Zeile, etwa „fri 9:30 standup“, und kann sich täglich, werktags, wöchentlich, monatlich oder jährlich wiederholen. Wähle seine Farbe und wann du erinnert wirst, aus einer Liste oder in eigenen Worten (etwa „45 min before“ oder „the day before at 20:00“); die Erinnerung kommt als Systembenachrichtigung. Die Fälligkeitsdaten von Boardkarten stehen ebenfalls dort. Auch Claude trägt Termine ein und ändert sie: „trag für Freitag um 15:00 ein Telefonat ein“. Zur Zeit eines Termins kann Arcade Claude eine Aufgabe geben: die Warteschlange eines Boards, eine Karte, eine Vorlage oder deinen eigenen Text.
- **Freunde und Chats.** Eine optionale Anmeldung mit GitHub hält deine Einstellungen auf allen deinen Computern gleich und gibt dir einen @Namen; füge Freunde über ihren genauen Namen hinzu, sieh, wer online ist, teile Boards, lade sie zu einem Spiel ein und chatte zu zweit oder in Gruppen.
- **Weiß, was der Agent tut.** Wenn der Agent fertig ist oder um Erlaubnis bittet, erscheint ein Banner über dem Spiel — weiterspielen, pausieren oder direkt zurück zum Agenten (das Verhalten legst du in den Einstellungen fest). In Claude Desktop kann es auch den Tab schließen, in dem du gerade etwas ansiehst, sodass die Unterhaltung wieder vor dir ist.
- **Erscheint von selbst.** Nach 10 Sekunden Agentenarbeit bietet Arcade über dem Prompt ein Spiel an — oder später, oder nie, wie du es in den Einstellungen wählst; den Fokus nimmt es nie, außer du willst es.
- **Folgt dir von Sitzung zu Sitzung.** Lass das Arcade-Panel offen, und jede neue Claude-Code-Sitzung öffnet es von selbst; schließ es von Hand, und es bleibt zu.
- **Ein Menü, sechs Bereiche.** *Spielen*, *Lesen & hören*, *Ansehen*, *Soziales*, *Arbeit* und *Mehr* — klapp zu, was du nicht brauchst. Oben: *Fortsetzen* des letzten Spiels, *Suchen* und *Favoriten*. Beim ersten Öffnen von Arcade wählst du, welche Bereiche erscheinen.
- **61 kostenlose Spiele** für NES (Dendy), Sega Mega Drive, Master System, PlayStation und ein Tab *Spiele* mit Arcade-Spielen, Shootern, Rennspielen, Strategie, Adventures und Brettspielen.
- **Lesen und hören.** Klassiker und LibriVox-Hörbücher in 30 Sprachen, direkt von Project Gutenberg, Wikisource und LibriVox, dazu aktuelle Artikel und Podcastfolgen zum Thema der Agentenarbeit.
- **Ansehen.** Aktuelle YouTube-Videos zum Thema der Agentenarbeit, Twitch: deine eigenen Kanäle und Livestreams über Programmierung, Technik, Wissenschaft und Retro-Spiele, und TikTok: der Feed *Für dich* und die Suche direkt auf der TikTok-Website, wo du dich selbst anmeldest.
- **NES und Flappy Arcade direkt in Claude Code** — im Terminal, in VS Code und in Claude Desktop. Alles andere öffnet sich in einem Browserfenster — in Claude Desktop standardmäßig im integrierten Browser von Claude (Shooter öffnen sich trotzdem in einem Browserfenster: Der integrierte Browser kann die Maus nicht einfangen).
- **Online spielen.** Konsolenspiele zu zweit über das Netz, Deathmatch und Koop in Doom, Schach, Go, Dame und Reversi gegen Menschen oder den Computer.
- **„Wer wartet online“.** Arcade zeigt in Claude Code, wenn jemand auf einen Mitspieler wartet — mit einer Schaltfläche *Mitspielen*.
- **Suche und Favoriten.** Eine Suche über Spiele und Twitch-Kanäle, gruppiert nach Bereich und Genre; markiere ein Spiel mit ☆, um es in *★ Favoriten* zu behalten.
- **Eigene Spiele.** Füge ROMs hinzu, die du besitzt; sie bleiben auf deinem Rechner.
- **13 Sprachen für die Oberfläche:** English, Русский, Українська, Español, Français, Deutsch, Português, Italiano, Polski, Türkçe, 日本語, 中文, 한국어 — nach System- oder Browsersprache, standardmäßig Englisch.

## Installation

Erfordert **Claude Code 2.1.275 oder neuer**. *Limits* braucht ein Claude Code, das Plugins die Limits meldet (geprüft mit 2.1.302 und 2.1.316); in einem älteren sagt dieser Bildschirm das, und der Rest von Arcade funktioniert wie gewohnt.

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
- Lass das Panel offen, und neue Sitzungen öffnen es von selbst: im Terminal beim Start, in Desktop und VS Code, sobald sie sich mit der Sitzung verbinden; die Tastatur bleibt beim Prompt. Schließ es von Hand (mit dem Schließen-Kreuz oder Esc), und es öffnet sich nicht mehr von selbst, bis du es wieder öffnest.
- Arbeitet der Agent länger als 10 Sekunden, erscheint über dem Prompt *„spielen?“*: **`1`** — hier im Panel spielen; **`2`** — in einem Browserfenster (wo verfügbar); **`3`** — jetzt nicht; danach wählst du, wie lange nicht gefragt wird: 5 oder 10 Minuten, bis Claude neu startet (in allen Sitzungen auf diesem Computer) oder nur dieses Mal. Unter Einstellungen → Benachrichtigungen wählst du, wann es erscheint – von 10 Sekunden bis 5 Minuten –, oder schaltest es ganz aus.
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
| **Arbeit** | Heute, Notizbuch, Projektboard, Prompts, Kalender, Agenten, Limits |
| **Mehr** | Arcade-Fenster, Einstellungen, 🌐 Sprache, 🐞 Fehler melden, ☕ Projekt unterstützen |

Ein Klick auf den Titel eines Bereichs klappt ihn zu oder auf. Ein zugeklappter Bereich zeigt `▸` und wie viele Kacheln er enthält, *Soziales* zusätzlich neue Nachrichten 💬 und Freundschaftsanfragen 👥. Arcade merkt sich, welche Bereiche zugeklappt sind. Einen Bereich, den du nicht brauchst, kannst du in den **Einstellungen** ausblenden: Dann fehlt er im Menü ganz, samt Titel und Kacheln; *Mehr* mit den Einstellungen bleibt immer. Nach der Anmeldung zeigt der Menükopf deinen @Namen mit denselben Zählern.

Die **Suche** startet ab zwei Buchstaben und findet Titel oder Genres, ohne auf Groß-/Kleinschreibung und Akzente zu achten. Die Ergebnisse sind nach Bereich und Genre gruppiert, etwa *Spiele · Shooter*. Der Stern ☆ neben einem Spiel fügt es zu **★ Favoriten** hinzu (bis zu 100), geordnet nach Bereich und Genre, das Neueste zuerst. Bücher und Hörbücher haben ihre eigene Suche nach Titel oder Autor.

### Wo sich was öffnet

| | NES (Dendy), Flappy Arcade | Sega, Master System, PlayStation, andere Spiele; Bücher, Hörbücher, Artikel, Podcasts, Videos |
|---|---|---|
| **Terminal** | im Panel (Pixelgrafik, wo das Terminal sie unterstützt, sonst Textblöcke) | Browserfenster |
| **VS Code** | im Panel | Browserfenster |
| **Claude Desktop** | im Panel | integrierter Browser von Claude oder Browserfenster (Auswahl in den Einstellungen); Shooter — immer ein Browserfenster |

Das Browserfenster ist ein eigenes Arcade-Fenster (in deinem Standardbrowser oder dem in den Einstellungen gewählten), kein Tab zwischen deinen üblichen. Chats funktionieren direkt im Panel — im Terminal und in Desktop; *Als Seite öffnen* öffnet sie genauso auf der Website. Notizbuch, Projektboards, Kalender und Agenten laufen im Panel. TikTok öffnet sich in Desktop im integrierten Browser von Claude und anderswo in deinem Standardbrowser, wo du wahrscheinlich schon angemeldet bist.

## Notizbuch und Projektboards

Beides findest du im Bereich *Arbeit* des Menüs.

- **Notizbuch.** Seiten und Unterseiten; eine Zeile, die mit `# ` beginnt, ist eine Überschrift, mit `- ` ein Punkt, mit `- [ ] ` ein Checklistenpunkt, den du per Druck abhakst. Es wird auf diesem Computer gespeichert — bis zu 200 Seiten, 20.000 Zeichen pro Seite.
- **Bearbeiten und Kopieren.** Eine Seite oder Karte zeigt ihren Text formatiert — Überschriften, Listen, Checkliste — in Desktop und VS Code, im Terminal als Zeilen. *Bearbeiten* öffnet an ihrer Stelle das Textfeld: Enter speichert, *Abbrechen* verwirft die Änderung, und was Claude oder eine andere Sitzung inzwischen ändert, erscheint im Feld. *Kopieren* legt die ganze Seite in die Zwischenablage — im Panel von Desktop lässt sich Text nur in Eingabefeldern markieren, deshalb kopierst du eine Seite so.
- **Auch Claude führt es.** *An Claude geben* übergibt Claude eine Seite, oder bitte Claude einfach, etwas in Arcade zu notieren. Claude nutzt dafür das Werkzeug `mcp__arcade__notes`, das nur das Notizbuch ändert und nichts löscht. Gefällt dir Claudes Änderung nicht: *Text vor Claudes Änderung wiederherstellen*.
- **Notion und andere Apps** — über Claudes Connectors, Arcade braucht also keine Schlüssel oder Passwörter: *An Notion senden*, *In eine andere App*, *Aus Notion oder einer anderen App importieren*. Eine verknüpfte Seite lässt sich in der App aktualisieren oder erneut von dort importieren.
- **Per Stimme.** Diktiere mit der Diktierfunktion des Systems in Claudes Eingabefeld (Win+H unter Windows, zweimal Fn unter macOS) und drück dann *Aus Claudes Eingabefeld übernehmen* — der Text wandert ans Ende der Seite.
- **Projektboard.** Spalten — *Zu erledigen*, *In Arbeit*, *Erledigt* oder eigene, bis zu 8 — und Karten; eine Karte ist eine Notizbuchseite mit Text und Checkliste. Drück auf eine Karte, um sie zu wählen und mit den Pfeilen zu verschieben, noch einmal, um sie zu öffnen. Auch Claude kann ein Board führen: *An Claude geben*, oder bitte ihn, Aufgaben auf einem Board in Arcade zu verteilen.
- **Geteilte Boards.** Bist du mit einem @Namen angemeldet, hak Freunde an und drück *Teilen*: Alle haben dieselben Karten, Spalten und denselben Namen, und Änderungen kommen innerhalb von Sekunden an. Der Besitzer lädt weitere Freunde ein, entfernt Leute und löscht das Board von der Website; verlassen kann es jeder; was auch passiert, jeder behält seine eigene Kopie. Bis zu 3 eigene geteilte Boards, 20 Leute und 200 Karten pro Board.
- **Mehrere Sitzungen gleichzeitig.** Alle offenen Claude-Code-Sitzungen auf diesem Computer teilen sich ein Notizbuch und seine Boards: Was eine Sitzung hinzufügt, ändert oder abhakt, sehen die anderen nach wenigen Sekunden — so kann jede Sitzung ihre eigene Karte desselben Boards bearbeiten.
- **Warteschlange für Claude.** Auf einem Board gibt *Warteschlange für Claude* Claude die erste Karte der ersten Spalte und verschiebt sie in die zweite Spalte, wenn das Board mehr als zwei hat. Beendet Claude seinen Zug mit dieser Karte in der letzten Spalte, geht die nächste Karte von selbst los, bis zu 10 Karten pro Durchlauf. Die Warteschlange stoppt, wenn Claude eine Frage stellt, sein Zug unterbrochen wird oder mit einem Fehler endet, die Karte nicht in der letzten Spalte ist oder du Claude etwas anderes schickst — ab dann entscheidest du. Eine Bitte um Erlaubnis stoppt sie nicht: Ist sie erteilt — von dir oder vom Auto-Modus — und liegt die Karte in der letzten Spalte, geht die nächste los. *Warteschlange stoppen* lässt Claude die aktuelle Karte fertig machen, ohne ihm die nächste zu geben. Auf einem geteilten Board werden Karten übersprungen, die jemand anderes genommen hat. Eine Warteschlange kann in mehreren Sitzungen gleichzeitig laufen — siehe [Agenten](#agenten). Läuft Claudes Limit mitten in einer Warteschlange ab, kann sie nach dem Reset weitergehen — siehe [Limits](#limits).
- **Fälligkeitsdaten.** Das Feld *Fällig* einer Karte nimmt „fri“, „tomorrow“, „20.11“ oder „2026-11-20“. Das Datum steht auf dem Board unter der Karte — in einer Warnfarbe, sobald es vorbei und die Karte nicht erledigt ist — und im Kalender, der dich an dem Tag um 9:00 erinnert, außer die Karte ist schon in der letzten Spalte. Auch Claude setzt Fälligkeitsdaten.
- **Wer eine Karte genommen hat.** Auf einem geteilten Board markiert *An Claude geben* die Karte als deine, und alle sehen darunter „in Arbeit bei @Name“. Hat jemand anderes sie genommen, sagt Arcade das zuerst; drück noch einmal, um sie trotzdem deinem Claude zu geben. *Karte freigeben* gibt sie wieder frei.
- **Issues aus einem Tracker.** Wähl auf einem Board den Tracker — GitHub, Linear, Jira oder *Anderer Tracker* — und gib an, woher die Issues kommen: `owner/repo`, ein Team- oder Projektschlüssel oder ein Link. Claude liest über den Connector dieses Trackers bis zu 20 offene Issues und legt die, die noch nicht auf dem Board sind, als Karten an. Auf so einer Karte lässt *Ergebnis an* mit dem Namen des Trackers Claude einen kurzen Kommentar ins Issue schreiben, was erledigt wurde; das Issue schließt er nicht und ändert auch seinen Status nicht. Arcade selbst spricht nie mit Trackern und speichert keine Schlüssel: Alles läuft über die Connectors, die du in Claude hinzugefügt hast — GitHub, Linear, Atlassian für Jira, Asana, ClickUp, monday.com und andere. Fehlt der Connector, sagt Claude das und erklärt, wo man ihn hinzufügt.
- **Tageszusammenfassung.** Der Knopf unter den Boards und im Notizbuch erstellt eine Seite „Zusammenfassung TT.MM“: was heute an Claude ging, was erledigt ist — in die letzte Spalte verschobene Karten, abgehakte Punkte — und was noch in Arbeit ist. Gib sie an Claude, bearbeite sie oder schick sie in einen Chat.
- **In einen Chat senden.** Bist du angemeldet, schickt *In einen Chat senden* jede Seite als Text in einen deiner letzten Chats; Überschriften und Checklisten-Häkchen bleiben erhalten.

## Prompts

Eine Kachel im Bereich *Arbeit* des Menüs: deine eigenen Prompt-Vorlagen, jede mit einem Druck an Claude geschickt.

- **Vorlagen.** Eine Vorlage ist ein Name auf einem Knopf und der Text, der an Claude geht. Gib einen Namen in *Neue Vorlage* ein, dann den Text; Enter speichert. Vorlagen liegen in Sammlungen: Die erste kommt in *Meine Prompts*, und *Neue Sammlung* legt eine weitere an. Eine Vorlage lässt sich umbenennen, bearbeiten, mit *↑ Hoch* und *↓ Runter* verschieben und mit einem zweiten Druck löschen.
- **Ein Druck.** Ein Druck auf eine Vorlage schickt ihren Text unverändert an Claude, wie *An Claude geben*: sofort, wenn Claude frei ist; ist Claude beschäftigt, wartet die Vorlage im Eingabefeld, bis du sie sendest. *Ins Eingabefeld* fügt sie an das an, was du dort schon getippt hast, ohne zu senden, damit du sie ergänzen kannst. Unter jeder Vorlage steht die erste Zeile ihres Textes; ✎ öffnet sie zum Bearbeiten.
- **Auch Claude speichert sie.** Sag „speichere das als Prompt in Arcade“, und Claude legt mit dem Werkzeug `mcp__arcade__notes` eine Vorlage an.
- **Geteilte Sammlungen.** Bist du mit einem @Namen angemeldet, öffne *Einstellungen der Sammlung*, hak Freunde an und drück *Teilen*: Alle haben dieselben Vorlagen und denselben Namen, und Änderungen kommen innerhalb von Sekunden an. Geteilte Sammlungen deiner Freunde erscheinen von selbst in deinen *Prompts*. Wie bei [geteilten Boards](#notizbuch-und-projektboards) lädt der Besitzer Leute ein und entfernt sie, verlassen kann sie jeder, und jeder behält seine eigene Kopie. Geteilte Sammlungen zählen zu deinen 3 eigenen geteilten Boards.
- **Keine Befehle.** Vorlagen sind Knöpfe im Arcade-Panel, keine Befehle von Claude Code: Slash-Befehle und Skills funktionieren wie bisher. Vorlagen werden mit dem Notizbuch auf diesem Computer gespeichert und zählen zu seinen 200 Seiten.

## Kalender

Er liegt im Bereich *Arbeit* des Menüs. Wie das Notizbuch wird der Kalender auf diesem Computer im Plugin-Speicher von Claude Code gehalten, und alle offenen Sitzungen teilen ihn.

- **Monat und Tag.** In Desktop ein Monatsraster aus gleich großen Tageskacheln mit Pfeilen und *Heute*: oben das Datum, darunter ein Punkt in der Farbe jedes Termins (bis zu drei, danach „+N“). Der gewählte Tag hat einen hervorgehobenen Rahmen, heute einen getönten Hintergrund. Unter dem Raster stehen die Termine des gewählten Tages, dann *Demnächst* für die nächsten 30 Tage, als Karten in der Farbe des Termins. Im Terminal und in VS Code ist es die Liste *Demnächst*.
- **Eine Zeile legt einen Termin an:** „fri 9:30 standup“, „tomorrow 15:00 call“, „12.11 review“, „2026-11-20 10:00 demo“. Ohne Tag — der im Raster gewählte Tag (im Terminal heute); ohne Uhrzeit — ganztägig. Wörter für Tage werden auf Englisch und Russisch verstanden.
- **Wiederholung.** Einmalig, täglich, werktags, wöchentlich, monatlich oder jährlich; der Tag des Termins ist der Beginn der Serie. Auch eine Zeile kann das sagen: „every friday 10:00 retro“, „on weekdays 9:30 standup“.
- **Farbe.** Blau, Grün, Gelb, Orange, Rot, Lila, Rosa oder Grau; standardmäßig Blau.
- **Erinnerung.** Wähle sie aus einer Liste: zu Beginn, 5, 10, 15 oder 30 Minuten, 1 oder 2 Stunden, einen Tag, zwei Tage oder eine Woche vorher; bei einem ganztägigen Termin um 9:00, 8:00 oder 7:00 an dem Tag, am Vortag um 21:00, 18:00 oder 9:00, zwei Tage oder eine Woche vorher um 9:00. Oder schreib deine eigene Zeit, auf Englisch oder Russisch: „45 min before“, „at 14:30“, „the day before at 20:00“ — nicht später als der Beginn und nicht früher als eine Woche vorher. In der Claude-App auf dem Handy, die keine Liste hat, schaltet eine Schaltfläche der Reihe nach durch.
- **Benachrichtigungen.** Eine Erinnerung kommt als Systembenachrichtigung und als kurze Einblendung, solange irgendeine Claude-Code-Sitzung offen ist; sie zeigt eine Sitzung, nicht alle. Eine, die verpasst wurde, während Claude Code geschlossen war, erscheint beim nächsten Start als *Verpasst*, wenn der Termin weniger als einen Tag zurückliegt.
- **Claude führt ihn auch**, mit dem Werkzeug `mcp__arcade__calendar`, das nur den Kalender ändert: „trag für Freitag um 15:00 ein Telefonat ein“, „was habe ich morgen?“, „mach die Demo rot“.
- **Fälligkeitsdaten von Karten.** Boardkarten mit Fälligkeitsdatum erscheinen an ihrem Tag als ganztägige Einträge, *erledigt*, sobald die Karte in der letzten Spalte ist; ändern lässt du sie auf der Karte.
- **Geplant: eine Aufgabe für Claude.** In einem Termin wählt *An Claude geben*, was Claude zur Zeit des Termins bekommt: die Warteschlange eines Boards, eine Karte, eine Vorlage aus [Prompts](#prompts) oder deinen eigenen Text; bei einem ganztägigen Termin um 9:00. Wiederholungen funktionieren wie gewohnt. Auch Claude kann das einrichten: „gib Claude werktags um 9:00 die Warteschlange des Boards Release“.
- **Wo sie läuft.** Der Termin merkt sich den Ordner, in dem er eingerichtet wurde; die Aufgabe geht an eine offene Claude-Code-Sitzung in diesem Ordner, nur an eine. Ist Claude beschäftigt, wartet die Aufgabe, bis sein Zug endet. *In diesem Ordner starten* verlegt sie in den Ordner der aktuellen Sitzung.
- **Verpasste Aufgaben.** War in diesem Ordner keine Sitzung offen — Claude Code war geschlossen oder der Computer schlief —, startet die Aufgabe nicht nachträglich von selbst: Es kommt eine kurze Einblendung, und oben im Kalender steht *Verpasst* mit *Jetzt starten* und *Nicht starten*. Eine Aufgabe, die vor mehr als einem Tag verpasst wurde, wird stillschweigend übersprungen.
- **Was nicht versprochen wird.** Das funktioniert nur, solange Claude Code offen ist und der Computer nicht schläft; Arcade weckt den Computer nicht und startet Claude Code nicht. Die Aufgabe läuft im aktuellen Erlaubnismodus der Sitzung, und Arcade gibt keine neuen Rechte: Außerhalb von Auto kann Claude auf deine Erlaubnis warten.
- **Neben anderen Zeitplanern.** Claude Code hat eigene: `/loop` wiederholt einen Prompt in der aktuellen Sitzung, geplante Aufgaben in Desktop starten eine Sitzung per Timer, und geplante Aufgaben in der Cloud laufen sogar, wenn dein Computer aus ist. Der Zeitplan von Arcade dreht sich um deine Boards und deinen Kalender: Aufgaben stehen im Monatsraster neben deinen Terminen, gehen an eine schon offene Sitzung im Ordner des Projekts und funktionieren im Terminal, in VS Code und in Desktop gleich.
- Mit Google- oder Apple-Kalendern synchronisiert er sich noch nicht.

## Agenten

Du findest sie im Bereich *Arbeit* des Menüs: die Claude-Code-Sitzungen mit Arcade auf diesem Computer, jede nach ihrem Ordner benannt, deine als *diese Sitzung* markiert.

- **Was jede gerade tut.** *Wartet auf Erlaubnis*, *wartet auf Antwort*, *hat den Zug beendet*, *arbeitet* oder *frei* und wie lange schon, mit der Karte, an der sie sitzt, und ihrem Platz in der Warteschlange, etwa *Warteschlange: Karte 3 von 10*. Sitzungen, die auf Erlaubnis warten, kommen zuerst. In Desktop ist jede Sitzung eine Karte, im Terminal und in VS Code eine Zeile. Eine geschlossene Sitzung verschwindet in weniger als einer Minute.
- **Am Ordner erkennen.** Arcade kann keine andere Sitzung für dich öffnen; am Ordnernamen erkennst du, welches Fenster oder welcher Tab es ist.
- **Von hier antworten.** Stellt Claude in einer anderen Sitzung eine Frage mit Optionen, zeigt ihre Karte die Frage und die Optionen als Knöpfe. Eine einzelne Frage geht beim ersten Druck raus; bei mehreren wählst du die Optionen und drückst *Antworten*. Innerhalb einer Sekunde bekommt Claude in jener Sitzung die Antwort, als hättest du sie dort gegeben. Auch eine Bitte um Erlaubnis ist zu sehen, mit Werkzeug und Befehl, etwa *Bash: npm test* — erlauben kannst du aber nur in der Sitzung selbst.
- **Eine Warteschlange, mehrere Sitzungen.** Drück in jeder Sitzung auf demselben Board *Warteschlange für Claude*, und die nächste Karte nimmt die Sitzung, die gerade frei ist; zwei Sitzungen bekommen nicht dieselbe Karte. Eine Sitzung, die dazukommt, sagt das: *Auf diesem Board läuft schon eine Warteschlange in der Sitzung „api“*. Jede Sitzung stoppt ihre eigene Warteschlange nach denselben Regeln — eine Frage von Claude, eine unfertige Karte, ein unterbrochener Zug, eine andere Nachricht an Claude — und gibt Claude bis zu 10 Karten pro Durchlauf. *Warteschlange stoppen* stoppt nur diese Sitzung, *Überall stoppen* stoppt alle, und jede macht ihre aktuelle Karte fertig. Unter einer Karte zeigt das Board, wer sie hat: *in der Sitzung „api“*.
- **Derselbe Ordner.** Arbeitet eine Sitzung, die schon in der Warteschlange ist, im selben Ordner, warnt Arcade, dass beide dieselben Dateien bearbeiten können, und nimmt diese Sitzung erst dazu, wenn du noch einmal *Warteschlange für Claude* drückst. Sicherer ist ein eigener Ordner oder ein git worktree.
- **Was sich geändert hat.** In einem git-Ordner hat die Karte einer Sitzung eine Zeile wie *Branch landing · geänderte Dateien: 4 · nicht committet*, dazu *nicht gepushte Commits: 2*, wenn es welche gibt; drück darauf, und die Dateien erscheinen mit hinzugefügten und entfernten Zeilen. Ändern zwei Sitzungen dieselbe Datei, sagen es beide Karten — *app.js wird auch in der Sitzung „api“ bearbeitet*; Sitzungen im selben Ordner teilen sich ihre Änderungen, und Arcade sagt, dass sich nicht unterscheiden lässt, wessen sie sind. Deine eigene Karte hat *An Claude geben: Änderungen prüfen*: Claude sieht die nicht committeten Änderungen durch und sagt dir, was sich zu korrigieren lohnt — ohne etwas zu committen, zurückzusetzen oder in den Stash zu legen. Änderungen anderer Sitzungen werden nur angezeigt. Jede Sitzung liest git in ihrem eigenen Ordner beim Start und am Ende jedes Zugs — nur lesend, ohne Timer und ohne Netzwerk.
- **Einblendungen.** Bittet eine andere Sitzung um Erlaubnis oder stellt eine Frage, zeigt eine Einblendung in deinem eigenen Arcade-Panel *Sitzung „api“ wartet auf Erlaubnis* oder *…wartet auf eine Antwort auf eine Frage* — ohne Ton, ohne Systembenachrichtigung. Ausschalten oder eine Einblendung für einen beendeten Zug einschalten (standardmäßig aus) kannst du unter *Einstellungen → Benachrichtigungen*.
- **Eine ausblenden.** Das × neben einer anderen Sitzung blendet sie samt ihren Einblendungen aus, bis du sie unten unter *Ausgeblendete Sitzungen* zurückholst; eine ausgeblendete Sitzung, die auf Erlaubnis oder eine Antwort wartet, zeigt das dort an. Ausgeblendete Sitzungen gelten in allen Sitzungen.
- **Bleibt auf diesem Computer.** Jede Sitzung hat eine kleine Datei in `~/.claude/arcade/agents` mit ihrem Ordner, ihrem Zustand und ihrer Karte, der Frage oder Bitte um Erlaubnis, auf die sie wartet, sowie ihrem Kontext, ihren Kosten und ihren Limit-Fenstern für [Limits](#limits); eine Antwort aus *Agenten* geht als kleine Datei daneben an die Sitzung. In einem git-Ordner stehen darin auch der Branch und die Namen geänderter Dateien mit ihrer Zeilenzahl. An Arcades Website geht nichts.

## Limits

Du findest sie im Bereich *Arbeit* des Menüs. Die Zahlen stammen von Claude Code selbst, es sind dieselben, die die Statuszeile zeigt: Arcade zählt nichts selbst.

- **Limit-Fenster.** 5 Stunden, die Woche und das Ausgabenlimit — Prozentwert, Balken und Zeitpunkt des Resets: *wird um 14:30 zurückgesetzt (in 1 Std. 20 Min.)*. Der Balken ist blau, ab 80 % gelb und rot, sobald das Limit aufgebraucht ist. Limit-Fenster gehören zum Konto und gelten für alle seine Sitzungen, deshalb zeigt der Bildschirm den frischesten Messwert aller Sitzungen auf diesem Computer und vor wie vielen Minuten er gemessen wurde.
- **Wenn es keine Fenster gibt.** Vor Claudes erster Antwort sagt der Bildschirm das: *Erscheint nach Claudes erster Antwort.* Mit einem API-Schlüssel oder über ein Gateway gibt es gar keine Fenster — nur Kontext und Kosten: Das 5-Stunden- und das Wochenfenster gibt es bei Claude-Abos (Pro, Max, Team, Enterprise).
- **Diese Sitzung und die anderen.** Wie voll der Kontext ist, in Prozent und in Tokens, und die Kosten seit Sitzungsbeginn; darunter Kontext und Kosten der anderen Sitzungen auf diesem Computer. Dieselben Zahlen stehen in ihren Karten unter [Agenten](#agenten).
- **Die Warteschlange nach einem Reset.** Bricht Claudes Zug mitten in der [Warteschlange eines Boards](#notizbuch-und-projektboards) ab und zeigt Claude Code ein Fenster bei 100 %, hält die Warteschlange an und sagt, wann das Limit zurückgesetzt wird. *Warteschlange nach dem Reset um 14:31 fortsetzen* setzt sie eine Minute nach dem Reset bei derselben Karte fort; solange sie wartet, stehen dort *Die Warteschlange „Release“ geht um 14:31 weiter.* und *Nicht fortsetzen*. Du kannst ein Board vorab markieren, dann geht seine Warteschlange von selbst weiter, ohne Knopf.
- **Nur solange Claude Code offen ist.** Nur eine offene Sitzung auf einem Computer, der nicht schläft, kann die Warteschlange fortsetzen. War Claude Code geschlossen oder schlief der Computer, sagt *Limits* das: *Die Warteschlange „Release“ ist nach dem Limit-Reset nicht weitergegangen: Claude Code war geschlossen oder der Computer schlief.*; wurde die wartende Sitzung geschlossen: *…ist nach dem Limit-Reset nicht gestartet: Die Sitzung war geschlossen.* Das × entfernt den Hinweis.
- **Eine Einblendung bei 80 und 90 %.** Erreicht ein Fenster 80 % und dann 90 %, erscheint im Arcade-Panel eine Einblendung — pro Schwelle einmal für alle Sitzungen. Ausschalten kannst du sie unter *Einstellungen → Benachrichtigungen*.
- **Welches Claude Code.** Nicht jede Version von Claude Code meldet Plugins die Limits — geprüft mit 2.1.302 und 2.1.316. Meldet deine sie nicht, sagt der Bildschirm das, und der Rest von Arcade funktioniert wie gewohnt.

## Heute

Die erste Kachel im Bereich *Arbeit* des Menüs: was auf dich wartet, aus ganz Arcade, auf einem Bildschirm. Sie speichert nichts Eigenes — alles stammt aus dem, was Arcade ohnehin weiß.

- **Wartet auf dich.** Sitzungen auf diesem Computer, die auf eine Erlaubnis oder eine Antwort warten, die am längsten wartende oben, wie in [Agenten](#agenten). Eine Frage mit Optionen beantwortest du gleich hier mit einem Knopf; eine Erlaubnis gibt es nur in der Sitzung selbst.
- **Im Kalender.** Die Termine von heute; vergangene sind blasser. Ein Druck öffnet den Termin im [Kalender](#kalender).
- **Fällig.** Board-Karten, die heute fällig oder überfällig sind und noch nicht in der letzten Spalte stehen, mit dem Namen des Boards; ein Druck öffnet die Karte.
- **Meine Karten.** Karten auf geteilten Boards, die du genommen hast und die noch nicht erledigt sind.
- **Chats.** Ungelesene Chats, wenn du angemeldet bist; ein Druck öffnet den Chat.
- **Limits.** Eine Zeile aus [Limits](#limits), etwa *5 Stunden: 62%, wird um 14:30 zurückgesetzt*; ab 80 % gelb.

Leere Blöcke sind ausgeblendet; wartet nichts, sagt der Bildschirm *Für heute ist alles erledigt.* In Desktop sind die Sitzungen Karten, im Terminal und in VS Code ist alles Zeilen.

## Für Teams

Ein kleines Team kann seine Aufgaben in Arcade führen: ein geteiltes Board, und wer eine Karte nimmt, gibt sie an seinen eigenen Claude.

1. Alle installieren Arcade (Claude Code 2.1.275 oder neuer) — siehe [Installation](#installation).
2. `/arcade` → **Soziales** → **Mit GitHub anmelden**: Die GitHub-Seite öffnet sich in deinem Browser — bestätige dort und klicke dann auf der Arcade-Seite auf *Sign in* (ihr Code sollte derselbe sein wie im Panel). Klappt das nicht, nimm *Mit einem Code anmelden*.
3. Nimm einen @Namen — deinen GitHub-Namen mit einem Klick oder einen eigenen.
4. Fügt euch gegenseitig über den genauen @Namen als Freunde hinzu; die andere Person nimmt an.
5. **Arbeit** → Board anlegen → Teammitglieder anhaken → **Teilen**.
6. Nur wegen Boards und Chats hier? Behalte beim ersten Öffnen von Arcade nur **Arbeit** und **Soziales**. Drück dann unter **Einstellungen → Benachrichtigungen** auf **Zeile „Spielen?“**, bis dort *aus* steht: Während der Agent arbeitet, erscheint über dem Prompt nichts mehr.

Ab dann: Öffne das Board, wähle eine Karte, **An Claude geben**. Ist Claude frei, geht die Karte sofort an ihn; ist er beschäftigt, wartet sie im Eingabefeld, bis du sie abschickst. Claude hakt Erledigtes ab und schreibt das Ergebnis auf die Karte, und alle am Board sehen es innerhalb von Sekunden — und auch, wer welche Karte genommen hat. Gib jeder Karte ein Fälligkeitsdatum, dann erscheint sie in deinem Kalender. Am Ende des Tages bringt *Tageszusammenfassung* → *In einen Chat senden* dein Standup in den Team-Chat. Chats findest du unter **Soziales**.

Arbeitest du selbst mit mehreren Claude-Code-Sitzungen? Drück in jeder auf demselben Board *Warteschlange für Claude*: Eine freie Sitzung nimmt die nächste Karte, und **Arbeit** → **Agenten** zeigt, was jede Sitzung gerade tut.

Gut zu wissen: Geteilte Boards und Chats werden auf Arcades Website gespeichert und sind nicht verschlüsselt — halte also Passwörter und Schlüssel davon fern. Arcade erfährt nur den Namen und das Bild deines GitHub-Profils. Bis zu 3 eigene geteilte Boards, 20 Leute und 200 Karten pro Board. *Konto löschen* (zweimal drücken) lässt die Website dich und deine Einstellungen vergessen.

## Konto, Freunde und Chats

Die Anmeldung ist optional — ohne sie funktioniert alles andere wie bisher.

- **Mit GitHub anmelden** (unter *Soziales*): Die Anmeldeseite von GitHub öffnet sich in deinem normalen Browser — bestätige dort und klicke dann auf der Arcade-Seite auf *Sign in*; ihr Code sollte derselbe sein wie im Panel. Klappt es über den Browser nicht, nimm *Mit einem Code anmelden*: Arcade zeigt einen Code, den du auf der GitHub-Seite eingibst. Arcade erfährt nur den Namen und das Bild deines GitHub-Profils — keine E-Mail, kein Zugriff auf Repositories.
- **Synchronisierung.** Sprache, Tasten, Benachrichtigungen, Panelgröße, was beim Signal des Agenten mit dem Spiel passiert, die Browseroptionen in Desktop, deine Themen, Twitch-Kanäle, Favoriten, zugeklappte und ausgeblendete Bereiche und dein Flappy-Arcade-Rekord werden auf allen deinen Computern gleich. Eigene Spiele, Browser und Grafikmodus bleiben pro Computer.
- **@Name.** Übernimm deinen GitHub-Namen mit einem Klick oder denk dir einen aus: 4 bis 32 Zeichen — lateinische Buchstaben, Ziffern und `_`. Du kannst ihn bis zu 5-mal am Tag ändern.
- **Freunde.** Füge Freunde über ihren genauen @Namen hinzu: Die Anfrage wird auf der anderen Seite angenommen, und ihr erscheint gegenseitig in euren Listen. Beim Tippen gibt es keine Vorschläge, also kann niemand durchstöbern, wer Arcade nutzt. Ablehnen und Entfernen passieren still.
- **Online und Einladungen zum Spielen.** Solange das Arcade-Menü offen ist, sehen deine Freunde dich *online* und du sie; willst du unsichtbar bleiben, schalte auf dem Bildschirm *Freunde* die Option *Freunden zeigen, dass ich online bin* aus. *Einladen* neben einem Freund bietet die Netzwerkspiele an: Ein Brettspiel öffnet einen eigenen Raum für zwei, ein Doom-Spiel seine Lobby. Das Spiel öffnet sich bei dir sofort; dein Freund bekommt eine Benachrichtigung und oben im Menü *Annehmen*, und die Einladung gilt 10 Minuten. Einladen kannst du dort, wo Netzwerkspiele im Browser öffnen — im eingebauten Browser von Desktop oder in einem Browserfenster.
- **Chats.** Zu zweit mit einem Freund, Gruppen aus Freunden oder eine Gruppe mit allen deinen Freunden auf einen Klick. Schreib direkt im Arcade-Panel oder öffne die Chat-Seite auf der Website. Eigene Nachrichten kannst du über das ⋮-Menü daneben bearbeiten oder löschen; auf der Website öffnet ein Rechtsklick dasselbe Menü. Nachrichten werden auf Arcades Website gespeichert und sind nicht verschlüsselt — schreib dort keine Passwörter oder Schlüssel.
- **Avatare und Benachrichtigungen bei Nachrichten.** Wähle unter *Konto* einen von 24 fertigen Avataren — die Chats zeigen ihn nur an; ohne Avatar steht dort der erste Buchstabe deines @Namens. Das Bild einer Gruppe wählt ihr Besitzer aus denselben 24. Dein GitHub-Bild sehen andere nie. Schreibt dir ein Freund, erscheint unten links über allen Fenstern eine Karte (Windows) oder eine Systembenachrichtigung (macOS, Linux); ein Klick auf die Karte öffnet diesen Chat.
- **Abmelden** beendet die Synchronisierung auf diesem Computer; **Konto löschen** (zweimal drücken) lässt die Website dich und deine Einstellungen vergessen.

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
- **Andere Sitzung wartet auf Erlaubnis** und **Andere Sitzung hat ihren Zug beendet** — eine Einblendung im Arcade-Panel über die anderen Sitzungen auf diesem Computer, ohne Ton (siehe [Agenten](#agenten)); die erste gilt auch für eine Frage und ist standardmäßig an, die zweite aus.
- **Claude-Limit bei 80 und 90 %** — eine Einblendung im Arcade-Panel, wenn ein Limit-Fenster 80 % und 90 % erreicht (siehe [Limits](#limits)); standardmäßig an.
- **Tastentest und Tastenbelegung** (Terminal).
- **Bedingungen und Datenschutz** — Nutzungsbedingungen und Datenschutzerklärung der Website, im gewohnten Browser geöffnet.

## Was das Plugin auf deinem Computer tut

Arcade läuft in Claude Code mit dem Zugriff, den Claude Code Plugins gibt. Sein gesamter Code liegt in diesem Repository, und `claude plugin validate ./mod` listet jedes Ereignis, in das es sich einhängt, und jeden Aufruf, den es macht. Kurz gesagt:

- **Die Werkzeuge des Agenten.** Arcade sieht, wann ein Werkzeug startet und endet und wann der Agent um Erlaubnis bittet — so weiß es, wann es sein Banner zeigt. Die Werkzeugaufrufe des Agenten ändert oder blockiert es nie. Selbst erlaubt es nur drei Arten von Aufrufen, und nur dort, wo Claude Code dich sonst fragen würde: `mcp__arcade__notes`, das nur das Notizbuch ändert und nichts löscht; `mcp__arcade__calendar`, das nur den Kalender ändert; und das Öffnen eines Spiels im integrierten Browser von Desktop, nachdem du es im Panel gedrückt hast. Deine Regeln zum Erlauben und Verbieten gelten unverändert.
- **Den Agenten unterbrechen.** Nur in Claude Desktop, wenn du etwas im integrierten Browser öffnest, während der Agent arbeitet: Desktop lässt ein Plugin den Browser nicht selbst öffnen. Arcade wartet, bis das laufende Werkzeug fertig ist (nach 10 Sekunden bricht es es ab, wartet aber, solange eine Erlaubnisfrage zu sehen ist), unterbricht den Agenten und bittet Claude, die Seite zu öffnen und weiterzuarbeiten. Um das zu vermeiden, wähle in *Einstellungen → Spiele öffnen* ein Browserfenster.
- **Deine Unterhaltung.** Für Themen bekommt Haiku in deiner eigenen Sitzung das Ende der Unterhaltung, ein paar tausend Zeichen; das zählt zu deiner Claude-Nutzung. Arcades Website sieht die Unterhaltung nie. In Claudes Eingabefeld schreibt Arcade oder schickt es ab nur, wenn du darum bittest — etwa mit *An Claude geben* im Notizbuch, für die nächste Karte einer von dir gestarteten *Warteschlange für Claude* oder für die Aufgabe eines mit *An Claude geben* eingerichteten Termins zu seiner Zeit — oder um eine Seite wie oben beschrieben zu öffnen.
- **Limits.** Nach jedem Zug und jede halbe Minute fragt Arcade bei Claude Code dessen eigenen Messwert für Limits, Kontext und Kosten ab — das, was die Statuszeile zeigt. Das kostet nichts und zählt nicht zu deiner Claude-Nutzung.
- **Programme.** Dein Browser für das Arcade-Fenster (unter Windows mit eigenem Profil in `%LOCALAPPDATA%\claude-arcade`); Benachrichtigungen, darunter Kalendererinnerungen — PowerShell unter Windows, `osascript` unter macOS, `notify-send` unter Linux; eine Prüfung, welche Browser installiert sind (Windows) oder welches System es ist (`uname`). Außerdem `git`, nur lesend (`rev-parse`, `status` und `diff --numstat`), im Ordner jeder Sitzung, beim Start und am Ende jedes Zugs, für *Agenten*.
- **Dateien.** Es schreibt nur die ROMs, die du mit `/arcade-add` hinzufügst, nach `~/.claude/arcade/roms` und die kleine Markierung jeder Sitzung für *Agenten* und *Limits* samt den von dort gesendeten Antworten nach `~/.claude/arcade/agents`; es liest nur die Datei, die du nennst, diese Kopien, diese Markierungen und seine eigenen Dateien. Einstellungen, Notizbuch, Kalender und Favoriten liegen im Plugin-Speicher von Claude Code.
- **Umgebungsvariablen.** Es liest `HOME` oder `USERPROFILE`, `LANG`, `LC_ALL`, `LC_MESSAGES`, `LOCALAPPDATA` und `OS` und ändert keine davon.
- **Netzwerk.** Das Plugin selbst spricht nur mit Arcades Website (`agent-arcade.fefaodessa.workers.dev`), den RSS-Feeds von YouTube-Kanälen und den Feeds der Blogs und Podcasts, die es zeigt. Bilder im Desktop-Panel, etwa Twitch-Avatare, laden direkt von diesen Diensten. Spiele, Bücher und Videos lädt die Seite, die du im Browser öffnest.

## Datenschutz

Details stehen in der [Datenschutzerklärung](https://agent-arcade.fefaodessa.workers.dev/privacy) und den [Nutzungsbedingungen](https://agent-arcade.fefaodessa.workers.dev/terms) der Website; im Plugin findest du sie unter *Einstellungen → Bedingungen und Datenschutz*. Kurz gesagt:

- Keine Werbung, keine Analyse, kein Tracking. Spiele, die mit Analyse-Code kamen, wurden davon befreit (siehe die `NOTICE` jedes Spiels).
- Deine eigenen ROMs, WADs, Bücher und Hörbuchdateien verlassen nie deinen Rechner oder Browser.
- Listen von Büchern und Hörbüchern sowie Bücher von Project Gutenberg kommen über die Arcade-Website, die sie bei Project Gutenberg, Wikisource und archive.org abruft und nur im Cache von Cloudflare hält — Listen sechs Stunden, ein Buch eine Woche. Wikisource-Seiten und LibriVox-Aufnahmen lädt das Fenster direkt von diesen Websites.
- Online-Spiele laufen über Arcades Server auf Cloudflare: Nachrichten werden zwischen den Spielern eines Raums weitergeleitet und nicht gespeichert — außer Zügen in Brettspielen, die aufbewahrt werden, damit du zurückkommen kannst; eine Partie, die einen Monat unberührt bleibt, wird gelöscht.
- Themen schlägt Haiku in deiner eigenen Claude-Code-Sitzung vor; Arcades Website sieht deine Unterhaltung nie — nur eine kurze englische Suchanfrage, wenn du *Eigenes Thema* nutzt. Die Adresse eines Artikels steht hinter `#` und erreicht deshalb nie Arcades Server.
- Eine Suche über *Eigenes Thema* läuft über die YouTube API Services, und Videos werden im eigenen Player von YouTube abgespielt, deshalb gelten auch die [Nutzungsbedingungen von YouTube](https://www.youtube.com/t/terms) und die [Datenschutzerklärung von Google](https://policies.google.com/privacy). Bis zu sechs Videos wählt Haiku in deiner eigenen Sitzung anhand ihrer Titel und kurzen Beschreibungen aus; Arcades Website hält Suchergebnisse einen Tag lang in einem gemeinsamen Cache.
- Bist du angemeldet, speichert die Website deine synchronisierten Einstellungen, Favoriten, deinen @Namen, Freunde, Chats und geteilte Boards, dazu Einladungen zum Spielen für 10 Minuten. Wer online ist, hält sie nur im Arbeitsspeicher, anderthalb Minuten lang. Der Sitzungsschlüssel geht nur an Arcades Website.
- Notizbuch und Kalender bleiben auf deinem Computer. Geteilte Boards werden wie Chats auf Arcades Website gespeichert und sind nicht verschlüsselt. Seiten gehen nur auf deinen Wunsch an Notion oder eine andere App, und zwar über deine eigenen Claude-Connectors; Issues und Kommentare in Trackern ebenso — Arcade selbst spricht nie mit GitHub, Linear, Jira oder anderen Trackern.
- *Agenten* sieht deine anderen Sitzungen über kleine Dateien in `~/.claude/arcade/agents` — Ordner, Zustand und Karte jeder Sitzung, den Text der Frage oder Bitte um Erlaubnis, auf die sie wartet, mit dem Befehl, sowie ihren Kontext, ihre Kosten und ihre Limit-Fenster. Antworten aus *Agenten* liegen daneben. Sie bleiben auf diesem Computer und gehen nie an Arcades Website; auf einem geteilten Board sehen deine Freunde nur „in Arbeit bei @Name“, wie bisher. In einem git-Ordner enthält die Datei einer Sitzung auch ihren Branch und die Namen geänderter Dateien mit Zeilenzahl — gelesen von git im Ordner dieser Sitzung selbst und nirgendwohin gesendet; Arcade committet nie etwas, setzt nichts zurück und legt nichts in den Stash.
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
- **Im Plugin selbst:** der Emulator JSNES 2.1.0 (Apache-2.0) und drei NES-Homebrew-Spiele zum Offline-Spielen — *Thwaite* und *Concentration Room* von Damian Yerrick (GPL-3.0-or-later) sowie *robotfindskitten* von Damian Yerrick nach dem Spiel von Leonard Richardson (zlib). Die Spiele liegen als Daten in `mod/hooks/roms/`, ihr Quellcode (`.tar.gz`) und die Lizenztexte in `mod/third_party/`.
- **Arcades eigener Code** (Plugin und Website) — **GNU AGPL-3.0** ([LICENSE](LICENSE)), © 2026 Max Arbakov. Du darfst ihn frei nutzen, studieren und ändern. Wenn du eine geänderte Version verbreitest — oder sie als Online-Dienst für andere betreibst —, musst du deinen gesamten Quellcode unter derselben Lizenz veröffentlichen und die Urheberrechtshinweise beibehalten. Komponenten Dritter behalten ihre eigenen Lizenzen. Das Arcade-Logo, zugleich das Symbol des Plugins, fällt nicht unter diese Lizenz: Es darf nur verwendet werden, um auf das Projekt Arcade zu verweisen.

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

Ausführliche Dokumentation (auf Russisch): [mod/docs/README.ru.md](mod/docs/README.ru.md) — das Plugin, [site/README.md](site/README.md) — die Website, Spiele hinzufügen und Netzwerkspiel.
