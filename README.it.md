<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Logo di Arcade" align="right">

# Arcade — gioca, leggi, ascolta e guarda mentre il tuo agente Claude Code lavora

[English](README.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · **Italiano** · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [한국어](README.ko.md)

> **Alpha (0.26).** Arcade funziona e si usa ogni giorno, ma è una versione iniziale: qualcosa può rompersi, e impostazioni o catalogo possono cambiare tra un aggiornamento e l’altro. Le segnalazioni di errori sono benvenute — vedi [Feedback](#feedback).

Arcade è un plugin per [Claude Code](https://claude.com/claude-code) che riempie l’attesa mentre il tuo agente lavora. Quando l’agente è occupato per più di 10 secondi, sopra il prompt compare un piccolo *«vuoi giocare?»*. Gioca a qualcosa — NES, Sega, PlayStation, Doom, scacchi e altro —, leggi un libro, ascolta un audiolibro o un podcast, oppure guarda un video sull’argomento su cui lavora l’agente. Arcade ti avvisa appena l’agente ha finito o ha bisogno del tuo permesso — non ti perdi niente.

Tutto il catalogo è gratuito: i giochi hanno licenze aperte, i libri e gli audiolibri sono di pubblico dominio. Puoi anche giocare online con altre persone che aspettano i loro agenti e chattare con i tuoi amici.

![«vuoi giocare?» sopra il prompt di Claude Code dopo 11 secondi di lavoro dell’agente](docs/images/prompt.png)

## Funzionalità

- **Compare da solo.** Dopo 10 secondi di lavoro dell’agente, Arcade propone un gioco sopra il prompt; non prende mai il focus se non lo chiedi tu.
- **Sa cosa fa l’agente.** Quando l’agente ha finito o chiede un permesso, sul gioco compare un avviso — continua a giocare, metti in pausa o torna subito all’agente (il comportamento si sceglie nelle impostazioni). In Claude Desktop può anche chiudere la scheda che stai guardando, così la conversazione torna davanti a te.
- **Un menu, sei sezioni.** *Gioca*, *Leggi e ascolta*, *Guarda*, *Social*, *Lavoro* e *Altro* — comprimi quelle che non ti servono. In alto: *Continua* l’ultimo gioco, *Cerca* e *Preferiti*.
- **61 giochi gratuiti** per NES (Dendy), Sega Mega Drive, Master System, PlayStation e una scheda *Giochi* con giochi arcade, sparatutto, corse, strategia, avventure e giochi da tavolo.
- **Leggi e ascolta.** 136 libri di pubblico dominio, audiolibri LibriVox, articoli ed episodi recenti di podcast sull’argomento del lavoro dell’agente.
- **Guarda.** Video recenti di YouTube sull’argomento del lavoro dell’agente, Twitch: i tuoi canali e le dirette su programmazione, tecnologia, scienza e retrogaming, e TikTok: il feed *Per te* e la ricerca sul sito stesso di TikTok, dove accedi da solo.
- **NES e Flappy Arcade direttamente in Claude Code** — nel terminale, in VS Code e in Claude Desktop. Tutto il resto si apre in una finestra del browser; in Claude Desktop, per impostazione predefinita, nel browser integrato di Claude (gli sparatutto si aprono comunque in una finestra del browser: il browser integrato non può catturare il mouse).
- **Gioco online.** Giochi per console a due in rete, deathmatch e cooperativa in Doom, scacchi, go, dama e reversi contro persone o contro il computer.
- **«Chi aspetta online».** Arcade mostra in Claude Code quando qualcuno aspetta un compagno di gioco, con un pulsante *Unisciti*.
- **Amici e chat.** Un accesso facoltativo con GitHub mantiene le impostazioni uguali su tutti i tuoi computer e ti dà un @nome; aggiungi amici con il loro nome esatto, vedi chi è online, invitali a giocare e chatta a due o in gruppo.
- **Quaderno e bacheche dei progetti.** Pagine, sottopagine e checklist che tiene anche Claude; invia una pagina a Notion o a un’altra app, o portane una da lì, tramite i connettori di Claude; detta nella casella del prompt di Claude e sposta il testo su una pagina. Bacheche con colonne e schede — condividine una con gli amici, e tutti lavorano sulla stessa bacheca.
- **Ricerca e preferiti.** Un’unica ricerca tra giochi, libri, audiolibri e canali Twitch, raggruppata per sezione e genere; segna qualsiasi cosa con ☆ per tenerla in *★ Preferiti*.
- **I tuoi giochi.** Aggiungi le ROM che possiedi; restano sul tuo computer.
- **13 lingue dell’interfaccia:** English, Русский, Українська, Español, Français, Deutsch, Português, Italiano, Polski, Türkçe, 日本語, 中文, 한국어 — in base alla lingua del sistema o del browser, inglese per impostazione predefinita.

## Installazione

Richiede **Claude Code 2.1.275 o successivo**.

Nel terminale, due comandi: aggiungi il marketplace di Arcade (questo repository), poi installa il plugin da lì:

```
claude plugin marketplace add ArbakovMaxim/agent-arcade
claude plugin install arcade@agent-arcade
```

Oppure dentro una sessione di Claude Code:

```
/plugin marketplace add ArbakovMaxim/agent-arcade
/plugin install arcade@agent-arcade
```

Il plugin viene installato per tutte le sessioni e le app. L’estensione di VS Code non ha il comando `/plugin`: installalo dal terminale, e l’estensione lo userà in una nuova conversazione.

**Aggiornamento:**

```
/plugin marketplace update agent-arcade
/plugin update arcade@agent-arcade
```

**Disinstallazione:** `/plugin uninstall arcade@agent-arcade`

## Come si usa

- **`/arcade`** apre il menu in qualsiasi momento.
- Quando l’agente lavora per più di 10 secondi, sopra il prompt compare *«vuoi giocare?»*: **`1`** — gioca qui, nel pannello; **`2`** — in una finestra del browser (dove disponibile); **`3`** — non ora.
- Frecce o Tab per scegliere, Invio per aprire; funziona anche il mouse. I comandi sono indicati sotto ogni gioco.
- Quando l’agente ha finito o aspetta un permesso, sul gioco compare un avviso: **Torna all’agente** o **Continua a giocare**.

### Il menu

| Sezione | Contenuto |
|---|---|
| *(in alto)* | **▶ Continua** l’ultimo gioco, **🔍 Cerca**, **★ Preferiti** |
| **Gioca** | NES, Sega, Master System, PlayStation, Giochi; *Unisciti* quando qualcuno aspetta online; **I miei giochi** |
| **Leggi e ascolta** | Libri, Audiolibri, Articoli, Podcast |
| **Guarda** | YouTube, Twitch, TikTok |
| **Social** | Amici, Chat, **Accedi con GitHub** (o **Account** dopo l’accesso) |
| **Lavoro** | Quaderno, Bacheca dei progetti |
| **Altro** | Finestra di Arcade, Impostazioni, 🌐 lingua, 🐞 Segnala un errore, ☕ Sostieni il progetto |

Fai clic sul titolo di una sezione per comprimerla o espanderla. Una sezione compressa mostra `▸` e quanti riquadri contiene, e *Social* mostra anche i nuovi messaggi 💬 e le richieste di amicizia 👥. Arcade ricorda quali sezioni sono compresse. Dopo l’accesso, l’intestazione del menu mostra il tuo @nome con gli stessi contatori.

La **ricerca** parte da due lettere e trova titolo, autore o genere, senza badare a maiuscole e accenti. I risultati sono raggruppati per sezione e genere, per esempio *Libri · Giallo* o *Giochi · Sparatutto*. La stella ☆ accanto a un gioco, libro o audiolibro lo aggiunge ai **★ Preferiti** (fino a 100), ordinati per sezione e genere, i più recenti per primi.

### Dove si apre cosa

| | NES (Dendy), Flappy Arcade | Sega, Master System, PlayStation, altri Giochi; libri, audiolibri, articoli, podcast, video |
|---|---|---|
| **Terminale** | nel pannello (grafica a pixel dove il terminale la supporta, altrimenti blocchi di testo) | finestra del browser |
| **VS Code** | nel pannello | finestra del browser |
| **Claude Desktop** | nel pannello | browser integrato di Claude o finestra del browser (a scelta nelle impostazioni); sparatutto — sempre una finestra del browser |

La finestra del browser è una finestra di Arcade separata (nel tuo browser predefinito o in quello scelto nelle impostazioni), non una scheda tra le tue solite. Le chat funzionano direttamente nel pannello, nel terminale e in Desktop; *Apri come pagina* le apre allo stesso modo sul sito. Il quaderno e le bacheche dei progetti stanno nel pannello. TikTok si apre nel browser integrato di Claude in Desktop e altrove nel tuo browser predefinito, dove probabilmente hai già effettuato l’accesso.

## Il catalogo

| Scheda | Contenuto |
|---|---|
| **NES (Dendy)** | 28 giochi homebrew — piattaforme, rompicapi, sparatutto, corse: Thwaite, Nova the Squirrel, Super Uwol, Lala the Magical e altri |
| **Sega** | 11 giochi per Mega Drive: Miniplanets, Tank Battle, Battle 4Tris, Pong e altri |
| **Master System** | 4 giochi: Balloon Master, SkyHaul, Food Fighter, Escape from Monster Dimension |
| **PlayStation** | Hello Pong |
| **Giochi → Giochi arcade** | Flappy Arcade — il gioco a un tasto di Arcade: gira direttamente nel pannello e nella finestra di Arcade; il percorso del giorno è uguale per tutti, il tuo record viene salvato |
| **Giochi → Sparatutto** | Freedoom Phase 1 e 2 (sostituti liberi di Doom), il deathmatch FreeDM, Blasphemer (sostituto libero di Heretic), il deathmatch BlasphDM, OpenArena — sparatutto arena sul motore di Quake III contro i bot (GPL-2.0) |
| **Giochi → Corse** | HexGL — corsa futuristica antigravità |
| **Giochi → Strategia** | OpenTTD — magnate dei trasporti (GPL-2.0); Micropolis — il codice aperto del classico gioco di costruzione di città del 1989, la tua città viene salvata nel browser (micropolisJS, GPL-3.0 con termini aggiuntivi e la Micropolis Public Name License); Warzone 2100 — strategia in tempo reale con campagna e schermaglia contro il computer, progetti le tue unità, i salvataggi restano nel browser (GPL-2.0-or-later) |
| **Giochi → Avventure** | Quattro avventure classiche gratuite degli anni ’90 in ScummVM (GPL-3.0-or-later): Beneath a Steel Sky, Flight of the Amazon Queen, Lure of the Temptress e Nippon Safes, Inc. — dati di gioco freeware ridistribuibili con permesso; salva in qualsiasi momento con F5 |
| **Giochi → Giochi da tavolo** | Scacchi — contro persone o il computer (Stockfish, livelli 1–10), online con orologio; go su scacchiere 9×9, 13×13 e 19×19; dama russa, reversi; *Abbandona* in tutti |
| **Libri** | 136 classici di pubblico dominio su scaffali per lingua, ordinati per genere: 98 in inglese (Austen, Dickens, Twain, Conan Doyle, Wells, Shelley, Tolstoj e Dostoevskij in traduzione…) e 38 in ucraino (Franko, Lesja Ukrajinka, Kocjubyns’kyj, Kotljarevs’kyj, Kuliš…). Il segnalibro si mette da solo: riapri un libro e riprendi da dove avevi lasciato. I tuoi file EPUB, FB2 e TXT si aprono nella finestra di Arcade |
| **Audiolibri** | Registrazioni di pubblico dominio di LibriVox su scaffali per lingua, ordinate per genere: Oscar Wilde e O. Henry in inglese, Gogol’ in ucraino. Il lettore nella finestra di Arcade ricorda dove eri arrivato; anche i tuoi file MP3, M4A, M4B, OGG e Opus si aprono lì e restano nel tuo browser |
| **Articoli** | Articoli recenti da 106 blog e testate selezionati in inglese — Simon Willison, InfoQ, The Cloudflare Blog, Ars Technica, Krebs on Security e altri |
| **Podcast** | Episodi recenti di 65 podcast in inglese — Software Engineering Daily, Security Now, Talk Python To Me, Darknet Diaries e altri; ogni episodio ricorda dove eri arrivato |
| **YouTube** | Video recenti da 153 canali selezionati in 24 ambiti, da IA, web e DevOps a scienza, spazio e retro-informatica |
| **Twitch** | *I miei canali* — qualsiasi canale Twitch per nome o link, prima quelli in diretta; *In diretta ora* e *Catalogo completo* — 26 canali selezionati in inglese, nessun canale 18+; non serve registrarsi |

La scheda di ogni gioco rimanda alla sua licenza e al suo codice sorgente.

**Argomenti.** Articoli, Podcast e YouTube partono dagli argomenti: Haiku ne propone tre su ciò a cui lavora l’agente, più *Novità e presentazioni*. In *Il tuo argomento* puoi scrivere cosa vuoi guardare, leggere o ascoltare, in qualsiasi lingua; i tuoi ultimi cinque argomenti restano come riquadri in *I miei argomenti*.

## Gioco online

- **Console.** I giochi a due per NES, Sega, Master System e PlayStation hanno un pulsante **Online**: crea una stanza o entra in quella di qualcun altro. I comandi vengono sincronizzati fotogramma per fotogramma tramite il server di Arcade.
- **Doom.** **FreeDM** e **BlasphDM** sono stanze di deathmatch con round da 5 minuti per un massimo di quattro giocatori; **Freedoom** e **Blasphemer** offrono la cooperativa tramite **Online**. Chi arriva aspetta il round successivo — il motore non permette di entrare in una partita in corso.
- **Giochi da tavolo.** *Trova un avversario*, *Invita un amico* con un link, oppure *Contro il computer*. La partita è salvata sul server: fai una mossa, torna al tuo agente, riapri il link più tardi — la scacchiera è come l’hai lasciata. Se hai effettuato l’accesso con un @nome, l’avversario lo vede accanto al tuo colore.
- **Chi aspetta.** Una volta al minuto Arcade controlla se qualcuno aspetta un compagno di gioco e lo mostra in Claude Code — per esempio *«vuoi giocare? In attesa online: FreeDM (1)»* — con un pulsante **Unisciti** nel menu.

## Account, amici e chat

L’accesso è facoltativo: senza, tutto il resto funziona come prima.

- **Accedi con GitHub** (in *Social*): Arcade mostra un codice da inserire nella pagina di GitHub nel tuo browser abituale. Arcade conosce solo il nome e l’immagine del tuo profilo GitHub — nessuna email, nessun accesso ai repository.
- **Sincronizzazione.** Lingua, tasti, notifiche, dimensione del pannello, cosa fare del gioco quando l’agente avvisa, le opzioni del browser in Desktop, i tuoi argomenti, i canali Twitch, i preferiti, le sezioni compresse e il tuo record a Flappy Arcade diventano uguali su tutti i tuoi computer. I tuoi giochi, il browser e la modalità grafica restano per singolo computer.
- **@nome.** Usa il tuo nome GitHub con un clic o inventane uno: da 4 a 32 caratteri — lettere latine, cifre e `_`. Puoi cambiarlo fino a 5 volte al giorno.
- **Amici.** Aggiungi un amico con il suo @nome esatto: la richiesta viene accettata dall’altra parte e comparite l’uno nell’elenco dell’altro. Durante la digitazione non ci sono suggerimenti, quindi nessuno può sfogliare chi usa Arcade. Rifiutare e rimuovere avvengono in silenzio.
- **Online e inviti a giocare.** Finché il menu di Arcade è aperto, gli amici ti vedono *online*, e tu vedi loro; per non farti vedere, disattiva *Mostra agli amici che sono online* nella schermata *Amici*. *Invita* accanto a un amico propone i giochi in rete: un gioco da tavolo apre una stanza tutta vostra per due, un gioco Doom la sua lobby. Il gioco si apre subito per te; l’amico riceve una notifica e *Accetta* in cima al menu, e l’invito vale 10 minuti. Puoi invitare dove i giochi in rete si aprono in un browser: quello integrato in Desktop o una finestra del browser.
- **Chat.** A due con un amico, gruppi di amici, oppure un gruppo con tutti i tuoi amici in un clic. Scrivi direttamente nel pannello di Arcade o apri la pagina delle chat sul sito. I messaggi sono conservati sul sito di Arcade e non sono cifrati — non scriverci password o chiavi.
- **Esci** interrompe la sincronizzazione su questo computer; **Elimina account** (premi due volte) fa dimenticare al sito te e le tue impostazioni.

## Quaderno e bacheche dei progetti

Entrambi sono nella sezione *Lavoro* del menu.

- **Quaderno.** Pagine e sottopagine; una riga che inizia con `# ` è un titolo, con `- ` una voce, con `- [ ] ` una voce di checklist che si spunta con un clic. Resta su questo computer — fino a 200 pagine, 20.000 caratteri per pagina.
- **Lo tiene anche Claude.** *Dai a Claude* passa una pagina a Claude, oppure chiedi semplicemente a Claude di annotare qualcosa in Arcade. Claude usa lo strumento `mcp__arcade__notes`, che modifica solo il quaderno e non elimina niente. Se la modifica di Claude non ti piace: *Ripristina il testo di prima della modifica di Claude*.
- **Notion e altre app** — tramite i connettori di Claude, quindi ad Arcade non servono chiavi né password: *Invia a Notion*, *In un’altra app*, *Importa da Notion o da un’altra app*. Una pagina collegata si può aggiornare nell’app o importare di nuovo da lì.
- **A voce.** Detta nella casella del prompt di Claude con la dettatura del sistema (Win+H su Windows, Fn due volte su macOS), poi premi *Prendi dalla casella del prompt di Claude* — il testo passa alla fine della pagina.
- **Bacheca dei progetti.** Colonne — *Da fare*, *In corso*, *Fatto* o le tue, fino a 8 — e schede; una scheda è una pagina del quaderno con testo e checklist. Premi una scheda per sceglierla e spostarla con le frecce, premila di nuovo per aprirla. Anche Claude può gestire una bacheca: *Dai a Claude*, oppure chiedigli di distribuire i compiti su una bacheca in Arcade.
- **Bacheche condivise.** Dopo l’accesso e con un @nome, spunta gli amici e premi *Condividi*: tutti hanno le stesse schede, colonne e nome, e le modifiche arrivano in pochi secondi. Il proprietario invita altri amici, rimuove partecipanti ed elimina la bacheca dal sito; chiunque può uscire; qualunque cosa succeda, ognuno conserva la propria copia. Fino a 3 bacheche condivise tue, 20 persone e 200 schede per bacheca.

## I tuoi giochi

- **`/arcade-add <file>`** aggiunge una ROM NES, Mega Drive o Master System (fino a 4 MB). Il plugin ne tiene una copia in `~/.claude/arcade` e non la carica mai da nessuna parte.
- **Dischi PlayStation e WAD di Doom** (per esempio un tuo `doom.wad`) — nella finestra di Arcade: **Apri un tuo file**. Restano solo in quel browser.

Aggiungi solo file su cui hai i diritti.

## Impostazioni

Apri **Impostazioni** nella sezione *Altro* del menu `/arcade`:

- **Lingua** — una delle 13 (anche direttamente nel menu: 🌐).
- **Apri i giochi** — qui nel pannello, in una finestra del browser o in un browser specifico; in Claude Desktop — nel browser integrato di Claude o in una finestra del browser.
- **Grafica** (terminale) — pixel nei terminali che mostrano immagini (kitty, Ghostty, Rio), blocchi di testo ovunque altrove.
- **Dimensione del pannello** — normale o a tutta larghezza.
- **Quando l’agente finisce** — avviso e continua a giocare, pausa con avviso, o ritorno diretto all’agente.
- **Quando l’agente chiede il permesso** — le stesse tre opzioni.
- **Quando si apre il browser** (Claude Desktop) — chiudere il menu di Arcade perché il browser abbia tutta l’altezza, o tenere il menu sopra.
- **L’agente ha finito mentre guardi** (Claude Desktop) — chiudere la scheda che Arcade ha aperto per un video, una diretta, TikTok, un articolo o un episodio, così la chat con Claude torna davanti a te, oppure avvisarti soltanto.
- **Notifiche mentre giochi in una finestra.**
- **Test dei tasti e rimappatura** (terminale).

## Privacy

- Niente pubblicità, niente analisi, niente tracciamento. I giochi che includevano codice di analisi ne sono stati ripuliti (vedi il `NOTICE` di ogni gioco).
- Le tue ROM, i WAD, i libri e i file audio non lasciano mai il tuo computer o il tuo browser.
- Il gioco online passa per il server di Arcade su Cloudflare: i messaggi vengono inoltrati tra i giocatori di una stanza e non vengono conservati — tranne le mosse dei giochi da tavolo, tenute perché tu possa tornare; una partita inattiva per un mese viene eliminata.
- Gli argomenti sono proposti da Haiku nella tua sessione di Claude Code; il sito di Arcade non vede mai la tua conversazione — solo una breve query di ricerca in inglese quando usi *Il tuo argomento*. L’indirizzo di un articolo va dopo `#`, quindi non arriva mai al server di Arcade.
- Dopo l’accesso, il sito conserva le impostazioni sincronizzate, i preferiti, il tuo @nome, gli amici, le chat e le bacheche condivise, e gli inviti a giocare per 10 minuti. Chi è online lo tiene solo in memoria, per un minuto e mezzo. La chiave di sessione viene inviata solo al sito di Arcade.
- Il quaderno resta sul tuo computer. Le bacheche condivise sono conservate sul sito di Arcade e non sono cifrate, come le chat. Le pagine vanno a Notion o a un’altra app solo quando lo chiedi, tramite i tuoi connettori di Claude.
- Una segnalazione di errore contiene il tuo testo, la versione di Arcade, dove è aperto, la lingua dell’interfaccia e il sistema operativo — nient’altro; senza accesso parte senza firma, e il sito non conserva alcun indirizzo.
- Alcuni giochi accedono a Internet solo se lo chiedi tu — per esempio il sondaggio facoltativo di OpenTTD e il suo pulsante *Online Content*.

## Piattaforme e stato

Arcade è in **alpha** e in sviluppo attivo — vedi il [registro delle modifiche](CHANGELOG.md).

- Provato sul campo su Windows, macOS e Linux.
- Funziona nel terminale, in VS Code e in Claude Desktop.

## Licenze

- **Giochi:** ogni gioco ha la sua licenza libera (MIT, GPL, BSD, Apache, Creative Commons e altre) — il testo della licenza e il codice sorgente stanno accanto al gioco e sono collegati dalla sua scheda.
- **Libri e audiolibri:** pubblico dominio — libri in inglese da Project Gutenberg, in ucraino da Wikisource, registrazioni da LibriVox; ogni libro ha un `LICENSE.txt` con la sua fonte.
- **Emulatori e motori:** JSNES (Apache-2.0), EmulatorJS (GPL-3.0) con i suoi core, PrBoom (GPL-2.0), doom-wasm di Cloudflare e Chocolate Doom/Heretic (GPL-2.0), OpenTTD (GPL-2.0), micropolisJS (GPL-3.0 con termini aggiuntivi), ScummVM (GPL-3.0-or-later), Stockfish (GPL-3.0) — l’avversario negli scacchi. Il core Genesis Plus GX usato per Sega e Master System è solo per uso non commerciale.
- **Il codice di Arcade** (il plugin e il sito) — **GNU AGPL-3.0** ([LICENSE](LICENSE)), © 2026 Max Arbakov. Sei libero di usarlo, studiarlo e modificarlo. Se distribuisci una versione modificata — o la fai girare come servizio online per altre persone —, devi pubblicare tutto il tuo codice sorgente con la stessa licenza e mantenere le note sul copyright. I componenti di terze parti mantengono le proprie licenze.

## Sostieni il progetto

Arcade è gratuito. Se rende più piacevoli le tue attese, puoi offrire un caffè al progetto — è del tutto facoltativo: **[ko-fi.com/agentarcade](https://ko-fi.com/agentarcade)**. Lo stesso link è in fondo al menu `/arcade` (*☕ Sostieni il progetto*) e nella finestra di Arcade. Niente in Arcade dipende da questo, e non interrompe mai una partita.

## Feedback

Hai trovato un errore? Il modo più rapido è direttamente in Arcade: **Altro → 🐞 Segnala un errore**. Descrivi cosa si è rotto, e la segnalazione arriva direttamente all’autore di Arcade con versione, ambiente, lingua e sistema operativo.

Puoi anche aprire una [issue](https://github.com/ArbakovMaxim/agent-arcade/issues) — per errori e per idee. Indica il sistema operativo, l’ambiente di Claude Code (terminale, VS Code o Desktop) e il gioco.

Le pull request sono benvenute. Inviandone una, accetti che il tuo contributo sia rilasciato sotto AGPL-3.0 e che l’autore possa offrire Arcade anche a condizioni diverse (per esempio con una licenza commerciale).

## Per sviluppatori

```
mod/     il plugin di Claude Code (hook, interfaccia del pannello, test)
site/    il sito su Cloudflare Workers: catalogo, finestra di Arcade, stanze di rete, account, amici, chat, segnalazioni di errori
tools/   strumenti di build: libri, audiolibri, traduzioni, heretic-wasm
.github/ GitHub Actions che compilano doom-wasm, heretic-wasm, OpenTTD e ScummVM per il browser
```

- Avviare il plugin dal repository: `claude --plugin-dir ./mod`
- Test del plugin: `claude plugin validate ./mod`, poi `claude plugin test` dentro `mod/`
- Test del sito: `npm test` dentro `site/`; build: `node build.mjs`; il deploy avviene automaticamente da `main` tramite Cloudflare Workers Builds.
- Libri: `node tools/books/build.mjs` scarica e ripulisce i libri del catalogo (elenco — `tools/books/books.json`).
- Traduzioni: `node tools/i18n/collect.mjs`, poi `node tools/i18n/check.mjs` — vedi [tools/i18n/README.md](tools/i18n/README.md).

Documentazione dettagliata (in russo): [mod/README.md](mod/README.md) — il plugin, [site/README.md](site/README.md) — il sito, l’aggiunta di giochi e il gioco in rete.
