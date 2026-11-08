<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Logo di Arcade" align="right">

# Arcade — bacheche di attività, note, chat di squadra e giochi dentro Claude Code

[English](README.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · **Italiano** · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [한국어](README.ko.md)

> **Beta (0.39).** Tutto ciò che è descritto qui funziona e si usa ogni giorno; d’ora in poi cambiano soprattutto i dettagli. Le segnalazioni di errori sono benvenute — vedi [Feedback](#feedback).

Arcade è un plugin per [Claude Code](https://claude.com/claude-code) che lo trasforma in un piccolo spazio di lavoro: bacheche dei progetti dove Claude prende le schede una dopo l’altra, anche in più sessioni contemporaneamente; un quaderno che Claude tiene insieme a te e che tutte le sessioni aperte condividono; un calendario; e bacheche e chat condivise per la tua squadra. E per l’attesa: quando l’agente è occupato per più di 10 secondi, sopra il prompt compare un piccolo *«vuoi giocare?»*. Gioca a qualcosa — NES, Sega, PlayStation, Doom, scacchi e altro —, leggi un libro, ascolta un audiolibro o un podcast, oppure guarda un video sull’argomento su cui lavora l’agente. Arcade ti avvisa appena l’agente ha finito o ha bisogno del tuo permesso — non ti perdi niente.

Tutto il catalogo è gratuito: i giochi hanno licenze aperte, i libri e gli audiolibri sono di pubblico dominio. Puoi anche giocare online con altre persone che aspettano i loro agenti e chattare con i tuoi amici.

![Demo: una bacheca dei progetti in Claude Desktop; una scheda si apre come pagina con una checklist, Dai a Claude la passa a Claude, che spunta ogni voce, scrive il risultato sulla scheda e la sposta in Fatto](https://github.com/user-attachments/assets/c6519d8f-2bb5-4af2-9ebf-c4bfa5c144c6)

*La tua bacheca: una scheda passa a Claude con un pulsante, interfaccia in inglese. [Guarda il video di 31 secondi](https://github.com/user-attachments/assets/c9076e68-2db6-4f68-9d88-8a132ce96f6a).*

![Demo: Claude Code riceve un compito, sopra il prompt compare «vuoi giocare?», accanto alla chat gira un gioco NES e Arcade ti richiama quando l’agente ha finito; ci sono anche libri, audiolibri e articoli](https://github.com/user-attachments/assets/3d8f79ac-966f-4872-84d5-7aa91534330d)

*Mentre l’agente lavora: 31 secondi in Claude Desktop, interfaccia in inglese. [Guarda il video in 720p](https://github.com/user-attachments/assets/bbb14c28-2813-40c0-82e6-d7375ddc2253).*

## Funzionalità

- **Quaderno e bacheche dei progetti.** Pagine, sottopagine e checklist che tiene anche Claude, e bacheche con colonne e schede. *Dai a Claude* passa una pagina o una scheda a Claude: spunta ciò che è fatto e ci scrive il risultato. Una pagina o una scheda mostra il testo formattato, con i pulsanti *Modifica* e *Copia*. Tutte le sessioni aperte di Claude Code condividono il quaderno, così ognuna può prendere la propria scheda dalla stessa bacheca. Condividi una bacheca con gli amici, e tutti lavorano sulla stessa. Invia una pagina a Notion o a un’altra app, o portane una da lì, tramite i connettori di Claude; detta nella casella del prompt di Claude e sposta il testo su una pagina.
- **Claude porta avanti la tua bacheca.** *Coda per Claude* passa a Claude le schede della prima colonna una alla volta: la successiva parte quando la precedente è in *Fatto*, e una domanda di Claude o una scheda incompiuta ferma la coda. Le schede hanno scadenze che compaiono nel calendario, e su una bacheca condivisa tutti vedono chi ha preso quale scheda. Porta le issue di GitHub, Linear, Jira o di un altro tracker su una bacheca come schede e pubblica il risultato come commento, tramite i connettori di Claude. *Riepilogo del giorno* crea una pagina per lo stand-up — cosa è andato a Claude, cosa è fatto, cosa è in corso — da inviare nella chat della tua squadra.
- **Prompt.** Le richieste che scrivi di continuo diventano modelli da un clic: un clic ne manda uno a Claude, come *Dai a Claude*, e *Nella casella del prompt* ti lascia completarlo prima. Condividi una raccolta con gli amici, e tutta la squadra ha gli stessi prompt. Anche Claude salva i modelli: «salva questo come prompt in Arcade».
- **Oggi.** Il primo riquadro di *Lavoro* raccoglie in una schermata ciò che ti aspetta: le sessioni in attesa di un permesso o di una risposta (a una domanda con opzioni si risponde lì stesso), gli eventi di oggi, le schede in scadenza oggi o già scadute, le schede che hai preso sulle bacheche condivise, le chat non lette e una riga con i limiti di Claude.
- **Agenti.** *Agenti* in *Lavoro* mostra ogni sessione di Claude Code con Arcade su questo computer, per cartella: se lavora, attende il permesso, ha finito il turno o è libera, e da quanto tempo, con la sua scheda e il suo posto nella coda. Quando Claude in un’altra sessione fa una domanda con opzioni, rispondi con un pulsante direttamente nella sua scheda. Quando un’altra sessione chiede il permesso o fa una domanda, te lo dice un avviso nel tuo pannello. La coda di una bacheca può andare in più sessioni insieme, e due sessioni non ricevono la stessa scheda. Ogni scheda mostra anche il branch git e i file non committati della sessione, e avvisa quando due sessioni modificano lo stesso file.
- **Limiti.** Il riquadro *Limiti* in *Lavoro* mostra le finestre di limite di Claude — 5 ore, la settimana e il limite di spesa — con la percentuale, una barra e quando si ripristina ciascuna, oltre al contesto e al costo di questa e delle altre tue sessioni. I numeri vengono da Claude Code stesso. Se un limite finisce a metà della coda di una bacheca, un pulsante la riprende dopo il ripristino.
- **Calendario.** In Desktop, un mese di caselle dei giorni tutte della stessa misura, con un pallino del colore di ogni evento; nel terminale e in VS Code, l’elenco dei prossimi. Un evento si segna con una riga, come «fri 9:30 standup», e può ripetersi ogni giorno, nei giorni feriali, ogni settimana, mese o anno. Scegli il colore e quando ricevere il promemoria, da un elenco o con parole tue (come «45 min before» o «the day before at 20:00»); il promemoria arriva come notifica di sistema. Ci sono anche le scadenze delle schede delle bacheche. Anche Claude segna e modifica gli eventi: «segna una chiamata venerdì alle 15:00». All’ora di un evento, Arcade può dare a Claude un’attività: la coda di una bacheca, una scheda, un modello o un tuo testo.
- **Amici e chat.** Un accesso facoltativo con GitHub mantiene le impostazioni uguali su tutti i tuoi computer e ti dà un @nome; aggiungi amici con il loro nome esatto, vedi chi è online, condividi bacheche, invitali a giocare e chatta a due o in gruppo.
- **Sa cosa fa l’agente.** Quando l’agente ha finito o chiede un permesso, sul gioco compare un avviso — continua a giocare, metti in pausa o torna subito all’agente (il comportamento si sceglie nelle impostazioni). In Claude Desktop può anche chiudere la scheda che stai guardando, così la conversazione torna davanti a te.
- **Compare da solo.** Dopo 10 secondi di lavoro dell’agente, Arcade propone un gioco sopra il prompt — o più tardi, o mai, come scegli nelle impostazioni; non prende mai il focus se non lo chiedi tu.
- **Ti segue tra le sessioni.** Lascia aperto il pannello di Arcade, e ogni nuova sessione di Claude Code lo apre da sola; chiudilo a mano, e resta chiuso.
- **Un menu, sei sezioni.** *Gioca*, *Leggi e ascolta*, *Guarda*, *Social*, *Lavoro* e *Altro* — comprimi quelle che non ti servono. In alto: *Continua* l’ultimo gioco, *Cerca* e *Preferiti*. La prima volta che apri Arcade scegli quali sezioni mostrare.
- **61 giochi gratuiti** per NES (Dendy), Sega Mega Drive, Master System, PlayStation e una scheda *Giochi* con giochi arcade, sparatutto, corse, strategia, avventure e giochi da tavolo.
- **Leggi e ascolta.** Classici e audiolibri LibriVox in 30 lingue, direttamente da Project Gutenberg, Wikisource e LibriVox, più articoli ed episodi recenti di podcast sull’argomento del lavoro dell’agente.
- **Guarda.** Video recenti di YouTube sull’argomento del lavoro dell’agente, Twitch: i tuoi canali e le dirette su programmazione, tecnologia, scienza e retrogaming, e TikTok: il feed *Per te* e la ricerca sul sito stesso di TikTok, dove accedi da solo.
- **NES e Flappy Arcade direttamente in Claude Code** — nel terminale, in VS Code e in Claude Desktop. Tutto il resto si apre in una finestra del browser; in Claude Desktop, per impostazione predefinita, nel browser integrato di Claude (gli sparatutto si aprono comunque in una finestra del browser: il browser integrato non può catturare il mouse).
- **Gioco online.** Giochi per console a due in rete, deathmatch e cooperativa in Doom, scacchi, go, dama e reversi contro persone o contro il computer.
- **«Chi aspetta online».** Arcade mostra in Claude Code quando qualcuno aspetta un compagno di gioco, con un pulsante *Unisciti*.
- **Ricerca e preferiti.** Un’unica ricerca tra giochi e canali Twitch, raggruppata per sezione e genere; segna un gioco con ☆ per tenerlo in *★ Preferiti*.
- **I tuoi giochi.** Aggiungi le ROM che possiedi; restano sul tuo computer.
- **13 lingue dell’interfaccia:** English, Русский, Українська, Español, Français, Deutsch, Português, Italiano, Polski, Türkçe, 日本語, 中文, 한국어 — in base alla lingua del sistema o del browser, inglese per impostazione predefinita.

## Installazione

Richiede **Claude Code 2.1.275 o successivo**. *Limiti* richiede un Claude Code che comunichi i limiti ai plugin (verificato su 2.1.302 e 2.1.316); su uno più vecchio quella schermata lo dice, e il resto di Arcade funziona come al solito.

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

Poi riavvia Claude Code. Il marketplace scarica solo il plugin — pochi MiB, senza il sito — quindi l’aggiornamento richiede pochi secondi. Se Arcade è già installato, non devi fare nulla: il marketplace si adegua da solo al prossimo aggiornamento.

Se `/plugin update` dice *already at the latest version* ma è uscita una nuova versione di Arcade, il marketplace non si è aggiornato. Per capire perché, esegui `claude plugin marketplace update agent-arcade` in un terminale. Se dice *timed out*, concedi 10 minuti alla clonazione:

```
CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000 claude plugin marketplace update agent-arcade
```

In PowerShell: `$env:CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000; claude plugin marketplace update agent-arcade`. Poi esegui di nuovo `/plugin update arcade@agent-arcade`.

**Disinstallazione:** `/plugin uninstall arcade@agent-arcade`

## Come si usa

- **`/arcade`** apre il menu in qualsiasi momento.
- Lascia aperto il pannello, e le nuove sessioni lo aprono da sole: nel terminale all’avvio, in Desktop e VS Code quando si collegano alla sessione; la tastiera resta al prompt. Chiudilo a mano (la crocetta di chiusura o Esc), e smette di aprirsi da solo finché non lo riapri.
- Quando l’agente lavora per più di 10 secondi, sopra il prompt compare *«vuoi giocare?»*: **`1`** — gioca qui, nel pannello; **`2`** — in una finestra del browser (dove disponibile); **`3`** — non ora, poi scegli per quanto non chiedere: 5 o 10 minuti, fino al riavvio di Claude (in tutte le sessioni su questo computer) o solo questa volta. In Impostazioni → Notifiche puoi scegliere quando compare — da 10 secondi a 5 minuti — o disattivarlo.
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
| **Lavoro** | Oggi, Quaderno, Bacheca dei progetti, Prompt, Calendario, Agenti, Limiti |
| **Altro** | Finestra di Arcade, Impostazioni, 🌐 lingua, 🐞 Segnala un errore, ☕ Sostieni il progetto |

Fai clic sul titolo di una sezione per comprimerla o espanderla. Una sezione compressa mostra `▸` e quanti riquadri contiene, e *Social* mostra anche i nuovi messaggi 💬 e le richieste di amicizia 👥. Arcade ricorda quali sezioni sono compresse. Una sezione che non ti serve si può nascondere nelle **Impostazioni**: sparisce del tutto dal menu, titolo e riquadri compresi; *Altro*, con le impostazioni, resta sempre. Dopo l’accesso, l’intestazione del menu mostra il tuo @nome con gli stessi contatori.

La **ricerca** parte da due lettere e trova titolo o genere, senza badare a maiuscole e accenti. I risultati sono raggruppati per sezione e genere, per esempio *Giochi · Sparatutto*. La stella ☆ accanto a un gioco lo aggiunge ai **★ Preferiti** (fino a 100), ordinati per sezione e genere, i più recenti per primi. Libri e audiolibri hanno una ricerca tutta loro, per titolo o autore.

### Dove si apre cosa

| | NES (Dendy), Flappy Arcade | Sega, Master System, PlayStation, altri Giochi; libri, audiolibri, articoli, podcast, video |
|---|---|---|
| **Terminale** | nel pannello (grafica a pixel dove il terminale la supporta, altrimenti blocchi di testo) | finestra del browser |
| **VS Code** | nel pannello | finestra del browser |
| **Claude Desktop** | nel pannello | browser integrato di Claude o finestra del browser (a scelta nelle impostazioni); sparatutto — sempre una finestra del browser |

La finestra del browser è una finestra di Arcade separata (nel tuo browser predefinito o in quello scelto nelle impostazioni), non una scheda tra le tue solite. Le chat funzionano direttamente nel pannello, nel terminale e in Desktop; *Apri come pagina* le apre allo stesso modo sul sito. Il quaderno, le bacheche dei progetti, il calendario e gli agenti stanno nel pannello. TikTok si apre nel browser integrato di Claude in Desktop e altrove nel tuo browser predefinito, dove probabilmente hai già effettuato l’accesso.

## Quaderno e bacheche dei progetti

Entrambi sono nella sezione *Lavoro* del menu.

- **Quaderno.** Pagine e sottopagine; una riga che inizia con `# ` è un titolo, con `- ` una voce, con `- [ ] ` una voce di checklist che si spunta con un clic. Resta su questo computer — fino a 200 pagine, 20.000 caratteri per pagina.
- **Modifica e Copia.** Una pagina o una scheda mostra il testo formattato — titoli, elenchi, checklist — in Desktop e VS Code, e come righe nel terminale. *Modifica* apre al suo posto la casella di testo: Invio salva, *Annulla* scarta la modifica, e ciò che Claude o un’altra sessione cambia nel frattempo compare nella casella. *Copia* mette l’intera pagina negli appunti — nel pannello di Desktop il testo si può selezionare solo nelle caselle di inserimento, quindi questo è il modo per copiare una pagina.
- **Lo tiene anche Claude.** *Dai a Claude* passa una pagina a Claude, oppure chiedi semplicemente a Claude di annotare qualcosa in Arcade. Claude usa lo strumento `mcp__arcade__notes`, che modifica solo il quaderno e non elimina niente. Se la modifica di Claude non ti piace: *Ripristina il testo di prima della modifica di Claude*.
- **Notion e altre app** — tramite i connettori di Claude, quindi ad Arcade non servono chiavi né password: *Invia a Notion*, *In un’altra app*, *Importa da Notion o da un’altra app*. Una pagina collegata si può aggiornare nell’app o importare di nuovo da lì.
- **A voce.** Detta nella casella del prompt di Claude con la dettatura del sistema (Win+H su Windows, Fn due volte su macOS), poi premi *Prendi dalla casella del prompt di Claude* — il testo passa alla fine della pagina.
- **Bacheca dei progetti.** Colonne — *Da fare*, *In corso*, *Fatto* o le tue, fino a 8 — e schede; una scheda è una pagina del quaderno con testo e checklist. Premi una scheda per sceglierla e spostarla con le frecce, premila di nuovo per aprirla. Anche Claude può gestire una bacheca: *Dai a Claude*, oppure chiedigli di distribuire i compiti su una bacheca in Arcade.
- **Bacheche condivise.** Dopo l’accesso e con un @nome, spunta gli amici e premi *Condividi*: tutti hanno le stesse schede, colonne e nome, e le modifiche arrivano in pochi secondi. Il proprietario invita altri amici, rimuove partecipanti ed elimina la bacheca dal sito; chiunque può uscire; qualunque cosa succeda, ognuno conserva la propria copia. Fino a 3 bacheche condivise tue, 20 persone e 200 schede per bacheca.
- **Più sessioni insieme.** Tutte le sessioni aperte di Claude Code su questo computer condividono lo stesso quaderno e le sue bacheche: ciò che una sessione aggiunge, modifica o spunta, le altre lo vedono in pochi secondi, così ogni sessione può seguire la propria scheda della stessa bacheca.
- **Coda per Claude.** Su una bacheca, *Coda per Claude* dà a Claude la prima scheda della prima colonna e la sposta nella seconda colonna se la bacheca ne ha più di due. Quando Claude finisce il turno con quella scheda nell’ultima colonna, la scheda successiva parte da sola, fino a 10 schede per giro. La coda si ferma quando Claude fa una domanda, il turno viene interrotto o finisce con un errore, la scheda non è nell’ultima colonna, o mandi a Claude qualcos’altro — da lì in poi decidi tu. Una richiesta di permesso non la ferma: se viene approvata — da te o dalla modalità automatica — e la scheda è nell’ultima colonna, parte la successiva. *Ferma la coda* lascia che Claude finisca la scheda attuale senza dargli la successiva. Su una bacheca condivisa, le schede prese da altri vengono saltate. Una coda può andare in più sessioni insieme — vedi [Agenti](#agenti). Se il limite di Claude finisce a metà di una coda, la coda può riprendere dopo il ripristino — vedi [Limiti](#limiti).
- **Scadenze.** Il campo *Scadenza* di una scheda accetta «fri», «tomorrow», «20.11» o «2026-11-20». La data compare sotto la scheda sulla bacheca — in un colore di avviso quando è passata e la scheda non è fatta — e nel calendario, che te la ricorda alle 9:00 di quel giorno, a meno che la scheda non sia già nell’ultima colonna. Anche Claude imposta le scadenze.
- **Chi ha preso una scheda.** Su una bacheca condivisa, *Dai a Claude* segna la scheda come tua, e tutti vedono «in carico a @nome» sotto di essa. Se l’ha presa qualcun altro, Arcade prima te lo dice; premi di nuovo per darla comunque al tuo Claude. *Libera la scheda* la rende di nuovo libera.
- **Issue da un tracker.** Su una bacheca scegli il tracker — GitHub, Linear, Jira o *Altro tracker* — e indica da dove prendere le issue: `owner/repo`, la chiave di un team o di un progetto, oppure un link. Claude legge fino a 20 issue aperte tramite il connettore di quel tracker e aggiunge come schede quelle che non sono ancora sulla bacheca. Su una scheda così, *Risultato su* con il nome del tracker fa pubblicare a Claude un breve commento sulla issue su ciò che è stato fatto; la issue non viene chiusa e il suo stato non cambia. Arcade stesso non comunica mai con i tracker e non conserva chiavi: tutto passa dai connettori che hai aggiunto in Claude — GitHub, Linear, Atlassian per Jira, Asana, ClickUp, monday.com e altri. Senza il connettore, Claude lo dice e spiega dove aggiungerlo.
- **Riepilogo del giorno.** Il pulsante sotto le bacheche e nel quaderno crea una pagina «Riepilogo DD.MM»: cosa è andato a Claude oggi, cosa è fatto — schede spostate nell’ultima colonna, voci spuntate — e cosa è ancora in corso. Dalla a Claude, modificala o inviala in una chat.
- **Invia in una chat.** Dopo l’accesso, *Invia in una chat* pubblica qualsiasi pagina come testo in una delle tue chat recenti, mantenendo titoli e segni della checklist.

## Prompt

Un riquadro della sezione *Lavoro* del menu: i tuoi modelli di prompt, ognuno inviato a Claude con un clic.

- **Modelli.** Un modello è un nome su un pulsante e il testo che va a Claude. Scrivi un nome in *Nuovo modello*, poi il testo; Invio salva. I modelli stanno nelle raccolte: il primo finisce in *I miei prompt*, e *Nuova raccolta* ne crea un’altra. Un modello si può rinominare, modificare, spostare con *↑ Su* e *↓ Giù* ed eliminare con un secondo clic.
- **Un clic.** Premere un modello invia il suo testo a Claude così com’è, come *Dai a Claude*: subito se Claude è libero; se è occupato, il modello aspetta nella casella del prompt finché non lo invii. *Nella casella del prompt* lo aggiunge a ciò che hai già scritto lì, senza inviarlo, così puoi completarlo. Sotto ogni modello c’è la prima riga del suo testo; ✎ lo apre per modificarlo.
- **Li salva anche Claude.** Di’ «salva questo come prompt in Arcade», e Claude aggiunge un modello con lo strumento `mcp__arcade__notes`.
- **Raccolte condivise.** Dopo l’accesso e con un @nome, apri *Impostazioni della raccolta*, spunta gli amici e premi *Condividi*: tutti hanno gli stessi modelli e lo stesso nome, e le modifiche arrivano in pochi secondi. Le raccolte condivise degli amici compaiono da sole nei tuoi *Prompt*. Come per le [bacheche condivise](#quaderno-e-bacheche-dei-progetti), il proprietario invita e rimuove i partecipanti, chiunque può uscire e ognuno conserva la propria copia. Le raccolte condivise contano tra le tue 3 bacheche condivise.
- **Non sono comandi.** I modelli sono pulsanti del pannello di Arcade, non comandi di Claude Code: i comandi slash e le skill funzionano come prima. I modelli restano su questo computer insieme al quaderno e contano nelle sue 200 pagine.

## Calendario

Si trova nella sezione *Lavoro* del menu. Come il quaderno, il calendario resta su questo computer, nello spazio dei plugin di Claude Code, e lo condividono tutte le tue sessioni aperte.

- **Mese e giorno.** In Desktop, una griglia del mese fatta di caselle dei giorni della stessa misura, con le frecce e *Oggi*: in alto la data, sotto un pallino del colore di ogni evento (fino a tre, poi «+N»). Il giorno scelto ha la cornice evidenziata, oggi uno sfondo colorato. Sotto la griglia ci sono gli eventi del giorno scelto e poi *Prossimi* per i 30 giorni successivi, come schede del colore di ogni evento. Nel terminale e in VS Code è l’elenco *Prossimi*.
- **Una riga segna un evento:** «fri 9:30 standup», «tomorrow 15:00 call», «12.11 review», «2026-11-20 10:00 demo». Senza giorno va nel giorno scelto nella griglia (nel terminale, oggi); senza ora dura tutto il giorno. Le parole per i giorni si capiscono in inglese e in russo.
- **Ripeti.** Non si ripete, ogni giorno, giorni feriali, ogni settimana, ogni mese o ogni anno; il giorno dell’evento è quello in cui inizia la serie. Si può dire anche in una riga: «every friday 10:00 retro», «on weekdays 9:30 standup».
- **Colore.** Blu, verde, giallo, arancione, rosso, viola, rosa o grigio; blu di default.
- **Promemoria.** Sceglilo da un elenco: all’inizio, 5, 10, 15 o 30 minuti, 1 o 2 ore, un giorno, due giorni o una settimana prima; per un evento di tutto il giorno alle 9:00, 8:00 o 7:00 di quel giorno, il giorno prima alle 21:00, 18:00 o 9:00, due giorni o una settimana prima alle 9:00. Oppure scrivi tu l’orario, in inglese o in russo: «45 min before», «at 14:30», «the day before at 20:00» — non dopo l’inizio e non più di una settimana prima. Nell’app di Claude sul telefono, che non ha l’elenco, un pulsante passa da una scelta all’altra.
- **Notifiche.** Il promemoria arriva come notifica di sistema e come breve avviso finché è aperta almeno una sessione di Claude Code; lo mostra una sola sessione, non tutte. Uno perso mentre Claude Code era chiuso compare all’avvio successivo come *Perso*, se l’evento risale a meno di un giorno prima.
- **Anche Claude lo tiene**, con lo strumento `mcp__arcade__calendar`, che modifica solo il calendario: «segna una chiamata venerdì alle 15:00», «cosa ho domani?», «fai la demo rossa».
- **Scadenze delle schede.** Le schede delle bacheche con una scadenza compaiono nel loro giorno come eventi di tutto il giorno, *fatta* quando la scheda è nell’ultima colonna; la scadenza si cambia sulla scheda stessa.
- **In programma: un’attività per Claude.** In un evento, *Dai a Claude* sceglie cosa riceve Claude all’ora dell’evento: la coda di una bacheca, una scheda, un modello da [Prompt](#prompt) o un tuo testo; per un evento di tutto il giorno, alle 9:00. La ripetizione funziona come al solito. Anche Claude può impostarlo: «ogni giorno feriale alle 9:00 dai a Claude la coda della bacheca Rilascio».
- **Dove parte.** L’evento ricorda la cartella in cui è stato impostato; l’attività va a una sessione aperta di Claude Code in quella cartella, a una sola. Se Claude è occupato, l’attività aspetta la fine del turno. *Avvia in questa cartella* la sposta nella cartella della sessione attuale.
- **Attività perse.** Se in quella cartella non c’era nessuna sessione aperta — Claude Code era chiuso o il computer dormiva —, l’attività non parte in ritardo da sola: compare un breve avviso e, in cima al calendario, *Perso* con *Avvia ora* e *Non avviare*. Un’attività persa più di un giorno fa viene saltata in silenzio.
- **Cosa non promette.** Funziona solo finché Claude Code è aperto e il computer non dorme; Arcade non risveglia il computer né avvia Claude Code. L’attività gira nella modalità dei permessi attuale della sessione, e Arcade non dà nuovi diritti: fuori da Auto, Claude può aspettare il tuo permesso.
- **Accanto ad altri pianificatori.** Claude Code ha i suoi: `/loop` ripete un prompt nella sessione attuale, le attività pianificate di Desktop avviano una sessione con un timer, e le attività pianificate nel cloud girano anche con il tuo computer spento. La pianificazione di Arcade riguarda le tue bacheche e il tuo calendario: le attività stanno nella griglia del mese accanto ai tuoi eventi, vanno a una sessione già aperta nella cartella del progetto e funzionano allo stesso modo nel terminale, in VS Code e in Desktop.
- Per ora non si sincronizza con i calendari di Google o Apple.

## Agenti

È nella sezione *Lavoro* del menu: le sessioni di Claude Code con Arcade su questo computer, ognuna con il nome della sua cartella, la tua segnata come *questa sessione*.

- **Cosa fa ciascuna.** *Attende il permesso*, *in attesa di risposta*, *ha finito il turno*, *al lavoro* o *libera*, e da quanto tempo, con la scheda su cui lavora e il suo posto nella coda, per esempio *Coda: scheda 3 di 10*. Le sessioni che attendono il permesso vengono per prime. In Desktop ogni sessione è una scheda; nel terminale e in VS Code, una riga. Una sessione chiusa sparisce in meno di un minuto.
- **Trovala dalla cartella.** Arcade non può aprire un’altra sessione al posto tuo; il nome della cartella ti dice quale finestra o quale scheda è.
- **Rispondi da qui.** Quando Claude in un’altra sessione fa una domanda con opzioni, la sua scheda mostra la domanda e le opzioni come pulsanti. Una domanda sola parte al primo tocco; se sono più d’una, scegli le opzioni e premi *Rispondi*. Entro un secondo Claude in quella sessione riceve la risposta come se l’avessi data lì. Si vede anche una richiesta di permesso, con lo strumento e il comando, per esempio *Bash: npm test*, ma il permesso si dà solo nella sessione stessa.
- **Una coda, più sessioni.** Premi *Coda per Claude* sulla stessa bacheca in ogni sessione, e quella libera prende la scheda successiva; due sessioni non ricevono la stessa scheda. Una sessione che si unisce lo dice: *In questa bacheca c’è già una coda in corso nella sessione «api»*. Ogni sessione ferma la propria coda con le stesse regole — una domanda di Claude, una scheda incompiuta, un turno interrotto, un altro messaggio a Claude — e dà a Claude fino a 10 schede per giro. *Ferma la coda* ferma solo questa sessione; *Ferma ovunque* le ferma tutte, e ognuna finisce la scheda attuale. Sotto una scheda, la bacheca mostra chi ce l’ha: *nella sessione «api»*.
- **Stessa cartella.** Se una sessione già in coda lavora nella stessa cartella, Arcade avvisa che le due possono modificare gli stessi file, e questa sessione si unisce solo quando premi di nuovo *Coda per Claude*. È più sicuro usare una cartella separata o un git worktree.
- **Cosa è cambiato.** In una cartella git, la scheda di una sessione ha una riga come *branch landing · file modificati: 4 · non committato*, più *commit non inviati: 2* se ce ne sono; premila per vedere i file con le righe aggiunte e tolte. Quando due sessioni modificano lo stesso file, lo dicono entrambe le schede — *app.js è modificato anche dalla sessione «api»*; le sessioni nella stessa cartella condividono le modifiche, e Arcade avvisa che non si può distinguere di chi sono. La tua scheda ha *Dai a Claude: controlla le modifiche*: Claude esamina le modifiche non committate e ti dice cosa vale la pena correggere, senza fare commit, annullare o mettere nulla nello stash. Le modifiche delle altre sessioni sono solo mostrate. Ogni sessione legge git nella propria cartella all’avvio e alla fine di ogni turno — in sola lettura, senza timer e senza rete.
- **Avvisi.** Quando un’altra sessione chiede il permesso o fa una domanda, un avviso nel tuo pannello di Arcade dice *La sessione «api» attende il permesso* o *…attende una risposta a una domanda* — senza suono né notifica di sistema. Disattivalo, o attiva un avviso per un turno finito (disattivato per impostazione predefinita), in *Impostazioni → Notifiche*.
- **Nasconderne una.** La × accanto a un’altra sessione la nasconde, insieme ai suoi avvisi, finché non la riporti da *Sessioni nascoste*, in fondo; una sessione nascosta che attende il permesso o una risposta lo dice lì. Le sessioni nascoste valgono in tutte le sessioni.
- **Resta su questo computer.** Ogni sessione tiene un piccolo file in `~/.claude/arcade/agents` con la sua cartella, il suo stato e la sua scheda, la domanda o la richiesta di permesso che attende, e il suo contesto, il costo e le finestre di limite per [Limiti](#limiti); una risposta da *Agenti* arriva alla sessione come piccolo file lì accanto. In una cartella git contiene anche il branch e i nomi dei file modificati con il numero di righe. Al sito di Arcade non va nulla.

## Limiti

È nella sezione *Lavoro* del menu. I numeri vengono da Claude Code stesso, gli stessi che mostra la riga di stato: Arcade non conta nulla da sé.

- **Finestre di limite.** 5 ore, la settimana e il limite di spesa — percentuale, barra e ora del ripristino: «si ripristina alle 14:30 (tra 1 h 20 min)». La barra è blu, gialla dall’80% e rossa quando il limite è finito. Le finestre appartengono all’account e sono condivise da tutte le sue sessioni, quindi la schermata mostra la misurazione più recente tra tutte le sessioni di questo computer e da quanti minuti è stata fatta.
- **Quando non ci sono finestre.** Prima della prima risposta di Claude la schermata lo dice: *Comparirà dopo la prima risposta di Claude.* Con una chiave API o tramite un gateway le finestre non ci sono affatto — solo contesto e costo: le finestre di 5 ore e settimanale arrivano con gli abbonamenti Claude (Pro, Max, Team, Enterprise).
- **Questa sessione e le altre.** Quanto è pieno il contesto, in percentuale e in token, e il costo dall’inizio della sessione; sotto, il contesto e il costo delle altre sessioni di questo computer. Gli stessi numeri compaiono nelle loro schede in [Agenti](#agenti).
- **La coda dopo il ripristino.** Se il turno di Claude si interrompe a metà della [coda di una bacheca](#quaderno-e-bacheche-dei-progetti) e Claude Code mostra una finestra al 100%, la coda si ferma e dice quando il limite si ripristina. *Riprendere la coda dopo il ripristino alle 14:31* la riprende dalla stessa scheda un minuto dopo il ripristino; mentre aspetta — *La coda «Rilascio» riprenderà alle 14:31* e *Non riprendere*. Puoi segnare una bacheca in anticipo, e allora la sua coda riprende da sola, senza pulsante.
- **Solo con Claude Code aperto.** Solo una sessione aperta, su un computer che non dorme, può riprendere la coda. Se Claude Code era chiuso o il computer dormiva, *Limiti* lo dice: *La coda «Rilascio» non è ripresa dopo il ripristino del limite: Claude Code era chiuso o il computer dormiva*; se la sessione che aspettava è stata chiusa — *…non è partita dopo il ripristino del limite: la sessione era chiusa*. La × toglie il messaggio.
- **Un avviso all’80 e al 90%.** Quando una finestra arriva all’80%, e poi al 90%, compare un avviso nel pannello di Arcade — una volta per soglia in tutte le sessioni. Si disattiva in *Impostazioni → Notifiche*.
- **Quale Claude Code.** Non tutte le versioni di Claude Code comunicano i limiti ai plugin — verificato su 2.1.302 e 2.1.316. Se la tua non lo fa, la schermata lo dice, e il resto di Arcade funziona come al solito.

## Oggi

Il primo riquadro della sezione *Lavoro* del menu: ciò che ti aspetta, da tutto Arcade, in un’unica schermata. Non conserva nulla di suo: tutto viene da ciò che Arcade sa già.

- **In attesa di te.** Le sessioni di questo computer in attesa di un permesso o di una risposta, quella che aspetta da più tempo in cima, come in [Agenti](#agenti). A una domanda con opzioni si risponde qui stesso con un pulsante; il permesso si dà solo nella sessione stessa.
- **Nel calendario.** Gli eventi di oggi; quelli già passati sono più tenui. Premendone uno si apre nel [calendario](#calendario).
- **Scadenza.** Le schede delle bacheche in scadenza oggi o già scadute che non sono ancora nell’ultima colonna, con il nome della bacheca; premendone una si apre la scheda.
- **Le mie schede.** Le schede che hai preso sulle bacheche condivise e non ancora fatte.
- **Chat.** Le chat non lette, se hai effettuato l’accesso; premendone una si apre la chat.
- **Limiti.** Una riga da [Limiti](#limiti), per esempio *5 ore: 62%, si ripristina alle 14:30*; gialla dall’80%.

I blocchi vuoti sono nascosti; quando non aspetta nulla, la schermata dice *Per oggi è tutto.* In Desktop le sessioni sono schede; nel terminale e in VS Code tutto è a righe.

## Per le squadre

Una piccola squadra può tenere i suoi compiti in Arcade: una bacheca condivisa, e chi prende una scheda la passa al proprio Claude.

1. Tutti installano Arcade (Claude Code 2.1.275 o successivo) — vedi [Installazione](#installazione).
2. `/arcade` → **Social** → **Accedi con GitHub**: la pagina di GitHub si apre nel tuo browser; conferma lì, poi fai clic su *Sign in* nella pagina di Arcade (il suo codice deve essere lo stesso del pannello). Se non funziona, *Accedi con un codice*.
3. Prendi un @nome — il tuo nome GitHub con un clic, o uno inventato da te.
4. Aggiungetevi come amici con il @nome esatto; l’altra persona accetta.
5. **Lavoro** → crea una bacheca → spunta i compagni di squadra → **Condividi**.
6. Ti servono solo bacheche e chat? La prima volta che apri Arcade, lascia solo **Lavoro** e **Social**. Poi in **Impostazioni → Notifiche** premi **Riga «Vuoi giocare?»** finché non dice *disattivata*: mentre l’agente lavora, sopra il prompt non comparirà nulla.

Da lì in poi: apri la bacheca, scegli una scheda, **Dai a Claude**. Se Claude è libero, la scheda gli arriva subito; se è occupato, la scheda aspetta nella casella del prompt finché non la invii. Claude spunta ciò che è fatto e scrive il risultato sulla scheda, e tutti sulla bacheca lo vedono in pochi secondi — e anche chi ha preso quale scheda. Dai una scadenza a ogni scheda, e comparirà nel tuo calendario. A fine giornata, *Riepilogo del giorno* → *Invia in una chat* porta il tuo stand-up nella chat della squadra. Le chat sono in **Social**.

Usi tu stesso più sessioni di Claude Code? Premi *Coda per Claude* sulla stessa bacheca in ognuna: una sessione libera prende la scheda successiva, e **Lavoro** → **Agenti** mostra cosa fa ogni sessione.

Buono a sapersi: bacheche condivise e chat sono conservate sul sito di Arcade e non sono cifrate, quindi non metterci password o chiavi. Arcade conosce solo il nome e l’immagine del tuo profilo GitHub. Fino a 3 bacheche condivise tue, 20 persone e 200 schede per bacheca. *Elimina account* (premi due volte) fa dimenticare al sito te e le tue impostazioni.

## Account, amici e chat

L’accesso è facoltativo: senza, tutto il resto funziona come prima.

- **Accedi con GitHub** (in *Social*): la pagina di accesso di GitHub si apre nel tuo browser abituale; conferma lì, poi fai clic su *Sign in* nella pagina di Arcade — il suo codice deve essere lo stesso del pannello. Se tramite il browser non funziona, scegli *Accedi con un codice*: Arcade mostra un codice da inserire nella pagina di GitHub. Arcade conosce solo il nome e l’immagine del tuo profilo GitHub — nessuna email, nessun accesso ai repository.
- **Sincronizzazione.** Lingua, tasti, notifiche, dimensione del pannello, cosa fare del gioco quando l’agente avvisa, le opzioni del browser in Desktop, i tuoi argomenti, i canali Twitch, i preferiti, le sezioni compresse, quelle nascoste e il tuo record a Flappy Arcade diventano uguali su tutti i tuoi computer. I tuoi giochi, il browser e la modalità grafica restano per singolo computer.
- **@nome.** Usa il tuo nome GitHub con un clic o inventane uno: da 4 a 32 caratteri — lettere latine, cifre e `_`. Puoi cambiarlo fino a 5 volte al giorno.
- **Amici.** Aggiungi un amico con il suo @nome esatto: la richiesta viene accettata dall’altra parte e comparite l’uno nell’elenco dell’altro. Durante la digitazione non ci sono suggerimenti, quindi nessuno può sfogliare chi usa Arcade. Rifiutare e rimuovere avvengono in silenzio.
- **Online e inviti a giocare.** Finché il menu di Arcade è aperto, gli amici ti vedono *online*, e tu vedi loro; per non farti vedere, disattiva *Mostra agli amici che sono online* nella schermata *Amici*. *Invita* accanto a un amico propone i giochi in rete: un gioco da tavolo apre una stanza tutta vostra per due, un gioco Doom la sua lobby. Il gioco si apre subito per te; l’amico riceve una notifica e *Accetta* in cima al menu, e l’invito vale 10 minuti. Puoi invitare dove i giochi in rete si aprono in un browser: quello integrato in Desktop o una finestra del browser.
- **Chat.** A due con un amico, gruppi di amici, oppure un gruppo con tutti i tuoi amici in un clic. Scrivi direttamente nel pannello di Arcade o apri la pagina delle chat sul sito. I tuoi messaggi si possono modificare o eliminare dal menu ⋮ accanto; sul sito lo stesso menu si apre anche con il tasto destro. I messaggi sono conservati sul sito di Arcade e non sono cifrati — non scriverci password o chiavi.
- **Avatar e notifiche dei messaggi.** Scegli uno dei 24 avatar pronti in *Account* — le chat lo mostrano soltanto; senza avatar, c’è la prima lettera del tuo @nome. L’immagine di un gruppo la sceglie il suo proprietario tra gli stessi 24. La tua immagine di GitHub non viene mai mostrata agli altri. Quando un amico ti scrive, in basso a sinistra sopra tutte le finestre compare una scheda (Windows) o una notifica di sistema (macOS, Linux); un clic sulla scheda apre quella chat.
- **Esci** interrompe la sincronizzazione su questo computer; **Elimina account** (premi due volte) fa dimenticare al sito te e le tue impostazioni.

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
| **Libri** | Classici di pubblico dominio in 30 lingue: la lingua la scegli tu (all’inizio è quella dell’interfaccia). Le sezioni sono le stesse per ogni lingua: Popolari, Narrativa, Poesia, Teatro, Avventura, Gialli e altre; si cerca per titolo o autore. L’elenco arriva su richiesta da Project Gutenberg e Wikisource — Arcade non conserva libri propri; il libro aperto resta in *I miei libri* del tuo browser. Il segnalibro si mette da solo: riapri un libro e riprendi da dove avevi lasciato. Anche i tuoi file EPUB, FB2 e TXT si aprono nella finestra di Arcade |
| **Audiolibri** | Registrazioni LibriVox nelle stesse lingue e sezioni, con ricerca: ascolta online direttamente da archive.org oppure scarica un libro nel browser per ascoltarlo offline. Il lettore nella finestra di Arcade ricorda il capitolo, il punto e la velocità; anche i tuoi file MP3, M4A, M4B, OGG e Opus si aprono lì e restano nel tuo browser |
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

## I tuoi giochi

- **`/arcade-add <file>`** aggiunge una ROM NES, Mega Drive o Master System (fino a 4 MB). Il plugin ne tiene una copia in `~/.claude/arcade` e non la carica mai da nessuna parte.
- **Dischi PlayStation e WAD di Doom** (per esempio un tuo `doom.wad`) — nella finestra di Arcade: **Apri un tuo file**. Restano solo in quel browser.

Aggiungi solo file su cui hai i diritti.

## Impostazioni

Apri **Impostazioni** nella sezione *Altro* del menu `/arcade`:

- **Sezioni del menu principale** — mostra o nascondi qualsiasi sezione tranne *Altro*; una sezione nascosta sparisce del tutto dal menu finché non la riattivi qui. La stessa scelta ti viene proposta la prima volta che apri Arcade.
- **Lingua** — una delle 13 (anche direttamente nel menu: 🌐).
- **Apri i giochi** — qui nel pannello, in una finestra del browser o in un browser specifico; in Claude Desktop — nel browser integrato di Claude o in una finestra del browser.
- **Grafica** (terminale) — pixel nei terminali che mostrano immagini (kitty, Ghostty, Rio), blocchi di testo ovunque altrove.
- **Dimensione del pannello** — normale o a tutta larghezza.
- **Quando l’agente finisce** — avviso e continua a giocare, pausa con avviso, o ritorno diretto all’agente.
- **Quando l’agente chiede il permesso** — le stesse tre opzioni.
- **Quando si apre il browser** (Claude Desktop) — chiudere il menu di Arcade perché il browser abbia tutta l’altezza, o tenere il menu sopra.
- **L’agente ha finito mentre guardi** (Claude Desktop) — chiudere la scheda che Arcade ha aperto per un video, una diretta, TikTok, un articolo o un episodio, così la chat con Claude torna davanti a te, oppure avvisarti soltanto.
- **Notifiche mentre giochi in una finestra.**
- **Notifiche dei messaggi** — una scheda in basso a sinistra quando un amico scrive in una chat (su macOS e Linux, una notifica di sistema).
- **Un’altra sessione attende il permesso** e **Un’altra sessione ha finito il turno** — un avviso nel pannello di Arcade sulle altre sessioni di questo computer, senza suono (vedi [Agenti](#agenti)); il primo vale anche per una domanda ed è attivo per impostazione predefinita, il secondo no.
- **Limite di Claude all’80 e al 90%** — un avviso nel pannello di Arcade quando una finestra di limite arriva all’80% e al 90% (vedi [Limiti](#limiti)); attivo per impostazione predefinita.
- **Test dei tasti e rimappatura** (terminale).
- **Termini e privacy** — i Termini d’uso e l’Informativa sulla privacy del sito, nel tuo browser abituale.

## Cosa fa il plugin sul tuo computer

Arcade gira dentro Claude Code con l’accesso che Claude Code dà ai plugin. Tutto il suo codice è in questo repository, e `claude plugin validate ./mod` elenca ogni evento a cui si aggancia e ogni chiamata che fa. In breve:

- **Gli strumenti dell’agente.** Arcade vede quando uno strumento parte e finisce e quando l’agente chiede un permesso — così sa quando mostrare il suo avviso. Non modifica né blocca mai le chiamate agli strumenti dell’agente. Da solo approva solo tre tipi di chiamate, e solo dove Claude Code altrimenti lo chiederebbe a te: `mcp__arcade__notes`, che modifica solo il quaderno e non elimina niente; `mcp__arcade__calendar`, che modifica solo il calendario; e l’apertura di un gioco nel browser integrato di Desktop dopo che l’hai premuto nel pannello. Le tue regole di consenso e divieto valgono così come sono.
- **Interrompere l’agente.** Solo in Claude Desktop, quando apri qualcosa nel browser integrato mentre l’agente lavora: Desktop non lascia che un plugin apra il browser da solo. Arcade aspetta che lo strumento in corso finisca (dopo 10 secondi lo interrompe, ma aspetta finché sullo schermo c’è una richiesta di permesso), interrompe l’agente e chiede a Claude di aprire la pagina e tornare al lavoro. Per evitarlo, scegli una finestra del browser in *Impostazioni → Apri i giochi*.
- **La tua conversazione.** Per gli argomenti, Haiku nella tua sessione riceve la parte finale della conversazione, qualche migliaio di caratteri; questo conta nel tuo utilizzo di Claude. Il sito di Arcade non vede mai la conversazione. Arcade scrive nella casella del prompt o la invia solo quando lo chiedi tu — per esempio *Dai a Claude* nel quaderno, la scheda successiva di una *Coda per Claude* che hai avviato, o l’attività di un evento impostato con *Dai a Claude*, alla sua ora — oppure per aprire una pagina come descritto sopra.
- **Limiti.** Dopo ogni turno e ogni mezzo minuto, Arcade chiede a Claude Code la sua misurazione di limiti, contesto e costo — quello che mostra la riga di stato. Non costa nulla e non conta nel tuo utilizzo di Claude.
- **Programmi.** Il tuo browser per la finestra di Arcade (su Windows con un profilo tutto suo in `%LOCALAPPDATA%\claude-arcade`); le notifiche, compresi i promemoria del calendario — PowerShell su Windows, `osascript` su macOS, `notify-send` su Linux; un controllo di quali browser sono installati (Windows) o di quale sistema è (`uname`). Inoltre `git` in sola lettura (`rev-parse`, `status` e `diff --numstat`) nella cartella di ogni sessione, all’avvio e alla fine di ogni turno, per *Agenti*.
- **File.** Scrive solo le ROM che aggiungi con `/arcade-add`, in `~/.claude/arcade/roms`, e il piccolo contrassegno di ogni sessione per *Agenti* e *Limiti*, con le risposte inviate da lì, in `~/.claude/arcade/agents`; legge solo il file che indichi, quelle copie, quei contrassegni e i propri file. Impostazioni, quaderno, calendario e preferiti stanno nello spazio dei plugin di Claude Code.
- **Variabili d’ambiente.** Legge `HOME` o `USERPROFILE`, `LANG`, `LC_ALL`, `LC_MESSAGES`, `LOCALAPPDATA` e `OS`, e non ne cambia nessuna.
- **Rete.** Il plugin stesso comunica solo con il sito di Arcade (`agent-arcade.fefaodessa.workers.dev`), con i feed RSS dei canali YouTube e con i feed dei blog e dei podcast che mostra. Le immagini nel pannello di Desktop, come gli avatar di Twitch, si caricano direttamente da quei servizi. Giochi, libri e video li carica la pagina che apri nel browser.

## Privacy

I dettagli sono nell’[Informativa sulla privacy](https://agent-arcade.fefaodessa.workers.dev/privacy) e nei [Termini d’uso](https://agent-arcade.fefaodessa.workers.dev/terms) del sito; nel plugin si trovano in *Impostazioni → Termini e privacy*. In breve:

- Niente pubblicità, niente analisi, niente tracciamento. I giochi che includevano codice di analisi ne sono stati ripuliti (vedi il `NOTICE` di ogni gioco).
- Le tue ROM, i WAD, i libri e i file audio non lasciano mai il tuo computer o il tuo browser.
- Gli elenchi di libri e audiolibri e i libri di Project Gutenberg passano dal sito di Arcade, che li chiede a Project Gutenberg, Wikisource e archive.org e li tiene solo nella cache di Cloudflare: gli elenchi per sei ore, un libro per una settimana. Le pagine di Wikisource e le registrazioni LibriVox la finestra le carica direttamente da quei siti.
- Il gioco online passa per il server di Arcade su Cloudflare: i messaggi vengono inoltrati tra i giocatori di una stanza e non vengono conservati — tranne le mosse dei giochi da tavolo, tenute perché tu possa tornare; una partita inattiva per un mese viene eliminata.
- Gli argomenti sono proposti da Haiku nella tua sessione di Claude Code; il sito di Arcade non vede mai la tua conversazione — solo una breve query di ricerca in inglese quando usi *Il tuo argomento*. L’indirizzo di un articolo va dopo `#`, quindi non arriva mai al server di Arcade.
- La ricerca per *Il tuo argomento* passa dai YouTube API Services e i video si riproducono nel player di YouTube stesso, quindi valgono anche i [Termini di servizio di YouTube](https://www.youtube.com/t/terms) e le [Norme sulla privacy di Google](https://policies.google.com/privacy). Haiku, nella tua sessione, sceglie fino a sei video in base a titoli e brevi descrizioni; il sito di Arcade tiene i risultati di ricerca in una cache condivisa per un giorno.
- Dopo l’accesso, il sito conserva le impostazioni sincronizzate, i preferiti, il tuo @nome, gli amici, le chat e le bacheche condivise, e gli inviti a giocare per 10 minuti. Chi è online lo tiene solo in memoria, per un minuto e mezzo. La chiave di sessione viene inviata solo al sito di Arcade.
- Il quaderno e il calendario restano sul tuo computer. Le bacheche condivise sono conservate sul sito di Arcade e non sono cifrate, come le chat. Le pagine vanno a Notion o a un’altra app solo quando lo chiedi, tramite i tuoi connettori di Claude; lo stesso vale per le issue e i commenti dei tracker — Arcade non comunica mai direttamente con GitHub, Linear, Jira o altri tracker.
- *Agenti* vede le tue altre sessioni tramite piccoli file in `~/.claude/arcade/agents` — la cartella, lo stato e la scheda di ogni sessione, il testo della domanda o della richiesta di permesso che attende, con il comando, e il suo contesto, il costo e le finestre di limite. Le risposte inviate da *Agenti* stanno lì accanto. Restano su questo computer e non vanno mai al sito di Arcade; su una bacheca condivisa i tuoi amici vedono solo «in carico a @nome», come prima. In una cartella git, il file di una sessione contiene anche il suo branch e i nomi dei file modificati con il numero di righe — letti da git nella cartella di quella stessa sessione e mai inviati altrove; Arcade non fa mai commit, non annulla e non mette nulla nello stash.
- Una segnalazione di errore contiene il tuo testo, la versione di Arcade, dove è aperto, la lingua dell’interfaccia e il sistema operativo — nient’altro; senza accesso parte senza firma, e il sito non conserva alcun indirizzo.
- Alcuni giochi accedono a Internet solo se lo chiedi tu — per esempio il sondaggio facoltativo di OpenTTD e il suo pulsante *Online Content*.

## Piattaforme e stato

Arcade è in **beta**: le funzioni ci sono tutte e il lavoro continua sui dettagli — vedi il [registro delle modifiche](CHANGELOG.md).

- Provato sul campo su Windows, macOS e Linux.
- Funziona nel terminale, in VS Code e in Claude Desktop.

## Licenze

- **Giochi:** ogni gioco ha la sua licenza libera (MIT, GPL, BSD, Apache, Creative Commons e altre) — il testo della licenza e il codice sorgente stanno accanto al gioco e sono collegati dalla sua scheda.
- **Libri e audiolibri:** pubblico dominio; Arcade non li conserva — i libri arrivano da Project Gutenberg e Wikisource, le registrazioni da LibriVox (archive.org), nel momento in cui li apri.
- **Emulatori e motori:** JSNES (Apache-2.0), EmulatorJS (GPL-3.0) con i suoi core, PrBoom (GPL-2.0), doom-wasm di Cloudflare e Chocolate Doom/Heretic (GPL-2.0), OpenTTD (GPL-2.0), micropolisJS (GPL-3.0 con termini aggiuntivi), ScummVM (GPL-3.0-or-later), Stockfish (GPL-3.0) — l’avversario negli scacchi. Il core Genesis Plus GX usato per Sega e Master System è solo per uso non commerciale.
- **Dentro il plugin:** l’emulatore JSNES 2.1.0 (Apache-2.0) e tre giochi homebrew per NES da giocare offline — *Thwaite* e *Concentration Room* di Damian Yerrick (GPL-3.0-or-later) e *robotfindskitten* di Damian Yerrick dal gioco di Leonard Richardson (zlib). I giochi sono salvati come dati in `mod/hooks/roms/`; il codice sorgente (`.tar.gz`) e i testi delle licenze sono in `mod/third_party/`.
- **Il codice di Arcade** (il plugin e il sito) — **GNU AGPL-3.0** ([LICENSE](LICENSE)), © 2026 Max Arbakov. Sei libero di usarlo, studiarlo e modificarlo. Se distribuisci una versione modificata — o la fai girare come servizio online per altre persone —, devi pubblicare tutto il tuo codice sorgente con la stessa licenza e mantenere le note sul copyright. I componenti di terze parti mantengono le proprie licenze. Il logo di Arcade, che è anche l’icona del plugin, non è coperto da questa licenza: può essere usato solo per riferirsi al progetto Arcade.

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
tools/   strumenti di build: traduzioni, heretic-wasm
.github/ GitHub Actions che compilano doom-wasm, heretic-wasm, OpenTTD e ScummVM per il browser
```

- Avviare il plugin dal repository: `claude --plugin-dir ./mod`
- Test del plugin: `claude plugin validate ./mod`, poi `claude plugin test` dentro `mod/`
- Test del sito: `npm test` dentro `site/`; build: `node build.mjs`; il deploy avviene automaticamente da `main` tramite Cloudflare Workers Builds.
- Si lavora in `main`, e anche le pull request vanno lì. Il branch predefinito `plugin` è una copia di `main` senza `site/`, aggiornata da una GitHub Action a ogni push: il marketplace dei plugin scarica quello invece dell’intero repository.
- Traduzioni: `node tools/i18n/collect.mjs`, poi `node tools/i18n/check.mjs` — vedi [tools/i18n/README.md](tools/i18n/README.md).

Documentazione dettagliata (in russo): [mod/docs/README.ru.md](mod/docs/README.ru.md) — il plugin, [site/README.md](site/README.md) — il sito, l’aggiunta di giochi e il gioco in rete.
