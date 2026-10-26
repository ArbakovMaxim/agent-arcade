<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Logo Arcade" align="right">

# Arcade — graj, czytaj, słuchaj i oglądaj, gdy twój agent Claude Code pracuje

[English](README.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · **Polski** · [Türkçe](README.tr.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [한국어](README.ko.md)

> **Beta (0.35).** Wszystko, co tu opisano, działa i jest używane na co dzień; teraz zmieniają się głównie szczegóły. Zgłoszenia błędów są bardzo mile widziane — zobacz [Opinie](#opinie).

Arcade to wtyczka do [Claude Code](https://claude.com/claude-code), która wypełnia czekanie, gdy twój agent pracuje. Kiedy agent jest zajęty dłużej niż 10 sekund, nad promptem pojawia się małe *„zagrasz?”*. Zagraj w coś — NES, Sega, PlayStation, Doom, szachy i więcej — przeczytaj książkę, posłuchaj audiobooka lub podcastu albo obejrzyj film na temat, nad którym pracuje agent. Arcade daje znać, gdy tylko agent skończy albo będzie potrzebować twojej zgody — nic cię nie ominie.

Cały katalog jest darmowy: gry mają otwarte licencje, książki i audiobooki należą do domeny publicznej. Możesz też grać online z innymi osobami, które czekają na swoich agentów, i rozmawiać ze znajomymi.

![„zagrasz?” nad promptem Claude Code po 11 sekundach pracy agenta](docs/images/prompt.png)

## Funkcje

- **Pojawia się sam.** Po 10 sekundach pracy agenta Arcade proponuje grę nad promptem; nigdy nie przejmuje fokusu, jeśli o to nie poprosisz.
- **Wie, co robi agent.** Gdy agent skończy lub poprosi o zgodę, nad grą pojawia się baner — graj dalej, zatrzymaj grę albo wróć prosto do agenta (zachowanie wybierasz w ustawieniach). W Claude Desktop Arcade może też zamknąć kartę, w której coś oglądasz, żeby rozmowa znów była przed tobą.
- **Jedno menu, sześć sekcji.** *Graj*, *Czytaj i słuchaj*, *Oglądaj*, *Społeczność*, *Praca* i *Więcej* — zwiń te, których nie potrzebujesz. Na górze: *Kontynuuj* ostatnią grę, *Szukaj* i *Ulubione*. Przy pierwszym otwarciu Arcade wybierasz, które sekcje pokazywać.
- **61 darmowych gier** na NES (Dendy), Sega Mega Drive, Master System, PlayStation oraz karta *Gry* z grami zręcznościowymi, strzelankami, wyścigami, strategiami, przygodówkami i grami planszowymi.
- **Czytaj i słuchaj.** Klasyka i audiobooki z LibriVox w 30 językach, prosto z Project Gutenberg, Wikiźródeł i LibriVox, a do tego świeże artykuły i odcinki podcastów na temat pracy agenta.
- **Oglądaj.** Świeże filmy z YouTube na temat pracy agenta, Twitch: twoje własne kanały i transmisje na żywo o programowaniu, technologii, nauce i grach retro, a także TikTok: kanał *Dla Ciebie* i wyszukiwanie na stronie samego TikToka, gdzie logujesz się samodzielnie.
- **NES i Flappy Arcade bezpośrednio w Claude Code** — w terminalu, w VS Code i w Claude Desktop. Wszystko inne otwiera się w oknie przeglądarki; w Claude Desktop domyślnie we wbudowanej przeglądarce Claude (strzelanki i tak otwierają się w oknie przeglądarki: wbudowana przeglądarka nie potrafi przechwycić myszy).
- **Gra online.** Gry konsolowe we dwoje przez sieć, deathmatch i kooperacja w Doomie, szachy, go, warcaby i reversi z ludźmi lub z komputerem.
- **„Kto czeka online”.** Arcade pokazuje w Claude Code, gdy ktoś czeka na partnera do gry — z przyciskiem *Dołącz*.
- **Znajomi i czaty.** Opcjonalne logowanie przez GitHub utrzymuje te same ustawienia na wszystkich twoich komputerach i daje ci @nick; dodawaj znajomych po dokładnym nicku, sprawdzaj, kto jest online, zapraszaj do gry i rozmawiaj we dwoje lub w grupach.
- **Notatnik i tablice projektów.** Strony, podstrony i listy kontrolne, które prowadzi też Claude; wyślij stronę do Notion lub innej aplikacji albo sprowadź ją stamtąd przez konektory Claude; podyktuj tekst w polu wpisywania Claude i przenieś go na stronę. Tablice z kolumnami i kartami — udostępnij tablicę znajomym, a wszyscy pracują na tej samej.
- **Wyszukiwanie i ulubione.** Jedno wyszukiwanie w grach i kanałach Twitcha, pogrupowane według sekcji i gatunku; oznacz grę gwiazdką ☆, aby trzymać ją w *★ Ulubione*.
- **Własne gry.** Dodaj ROM-y, które posiadasz; zostają na twoim komputerze.
- **13 języków interfejsu:** English, Русский, Українська, Español, Français, Deutsch, Português, Italiano, Polski, Türkçe, 日本語, 中文, 한국어 — według języka systemu lub przeglądarki, domyślnie angielski.

## Instalacja

Wymaga **Claude Code 2.1.275 lub nowszego**.

W terminalu dwa polecenia: dodaj marketplace Arcade (to repozytorium), a potem zainstaluj z niego wtyczkę:

```
claude plugin marketplace add ArbakovMaxim/agent-arcade
claude plugin install arcade@agent-arcade
```

Albo w sesji Claude Code:

```
/plugin marketplace add ArbakovMaxim/agent-arcade
/plugin install arcade@agent-arcade
```

Wtyczka instaluje się dla wszystkich sesji i aplikacji. Rozszerzenie VS Code nie ma polecenia `/plugin` — zainstaluj ją z terminala, a rozszerzenie podchwyci ją w nowej rozmowie.

**Aktualizacja:**

```
/plugin marketplace update agent-arcade
/plugin update arcade@agent-arcade
```

Potem uruchom ponownie Claude Code. Marketplace pobiera tylko wtyczkę — kilka MiB, bez strony Arcade — więc aktualizacja trwa kilka sekund. Jeśli Arcade jest już zainstalowany, nic nie musisz robić: przy następnej aktualizacji marketplace przełączy się sam.

Jeśli `/plugin update` pisze *already at the latest version*, a wyszła już nowsza wersja Arcade, marketplace się nie odświeżył. Dlaczego — pokaże `claude plugin marketplace update agent-arcade` w terminalu. Jeśli widzisz *timed out*, daj klonowaniu 10 minut:

```
CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000 claude plugin marketplace update agent-arcade
```

W PowerShell: `$env:CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000; claude plugin marketplace update agent-arcade`. Potem jeszcze raz uruchom `/plugin update arcade@agent-arcade`.

**Odinstalowanie:** `/plugin uninstall arcade@agent-arcade`

## Jak używać

- **`/arcade`** otwiera menu w dowolnej chwili.
- Gdy agent pracuje dłużej niż 10 sekund, nad promptem pojawia się *„zagrasz?”*: **`1`** — graj tutaj, w panelu; **`2`** — w oknie przeglądarki (tam, gdzie to możliwe); **`3`** — nie teraz. W Ustawienia → Powiadomienia możesz wybrać, kiedy się pojawia — od 10 sekund do 5 minut — albo je wyłączyć.
- Strzałki lub Tab do wyboru, Enter do otwarcia; mysz też działa. Sterowanie jest opisane pod każdą grą.
- Gdy agent skończy lub czeka na zgodę, nad grą pojawia się baner: **Wróć do agenta** albo **Graj dalej**.

### Menu

| Sekcja | Co zawiera |
|---|---|
| *(na górze)* | **▶ Kontynuuj** ostatnią grę, **🔍 Szukaj**, **★ Ulubione** |
| **Graj** | NES, Sega, Master System, PlayStation, Gry; *Dołącz*, gdy ktoś czeka online; **Moje gry** |
| **Czytaj i słuchaj** | Książki, Audiobooki, Artykuły, Podcasty |
| **Oglądaj** | YouTube, Twitch, TikTok |
| **Społeczność** | Znajomi, Czaty, **Zaloguj się przez GitHub** (albo **Konto** po zalogowaniu) |
| **Praca** | Notatnik, Tablica projektów |
| **Więcej** | Okno Arcade, Ustawienia, 🌐 język, 🐞 Zgłoś błąd, ☕ Wesprzyj projekt |

Kliknij tytuł sekcji, aby ją zwinąć lub rozwinąć. Zwinięta sekcja pokazuje `▸` i liczbę kafelków w środku, a *Społeczność* także nowe wiadomości 💬 i zaproszenia do znajomych 👥. Arcade pamięta, które sekcje są zwinięte. Niepotrzebną sekcję można ukryć w **Ustawieniach**: znika wtedy z menu całkowicie, razem z tytułem i kafelkami; *Więcej* z ustawieniami zostaje zawsze. Po zalogowaniu nagłówek menu pokazuje twój @nick z tymi samymi licznikami.

**Wyszukiwanie** rusza od dwóch liter i znajduje tytuł lub gatunek, bez względu na wielkość liter i znaki diakrytyczne. Wyniki są pogrupowane według sekcji i gatunku, na przykład *Gry · Strzelanki*. Gwiazdka ☆ przy grze dodaje ją do **★ Ulubione** (do 100), uporządkowanych według sekcji i gatunku, najnowsze na początku. Książki i audiobooki mają własne wyszukiwanie, po tytule lub autorze.

### Gdzie co się otwiera

| | NES (Dendy), Flappy Arcade | Sega, Master System, PlayStation, pozostałe Gry; książki, audiobooki, artykuły, podcasty, filmy |
|---|---|---|
| **Terminal** | w panelu (grafika pikselowa, gdzie terminal ją obsługuje, w przeciwnym razie bloki tekstu) | okno przeglądarki |
| **VS Code** | w panelu | okno przeglądarki |
| **Claude Desktop** | w panelu | wbudowana przeglądarka Claude lub okno przeglądarki (wybór w ustawieniach); strzelanki — zawsze okno przeglądarki |

Okno przeglądarki to osobne okno Arcade (w domyślnej przeglądarce lub tej wybranej w ustawieniach), a nie karta między twoimi zwykłymi. Czaty działają bezpośrednio w panelu — w terminalu i w Desktop; *Otwórz jako stronę* otwiera je tak samo na stronie. Notatnik i tablice projektów działają w panelu. TikTok otwiera się w Desktop we wbudowanej przeglądarce Claude, a gdzie indziej — w domyślnej przeglądarce, w której najpewniej masz już zalogowane konto.

## Katalog

| Karta | Co zawiera |
|---|---|
| **NES (Dendy)** | 28 gier homebrew — platformówki, łamigłówki, strzelanki, wyścigi: Thwaite, Nova the Squirrel, Super Uwol, Lala the Magical i inne |
| **Sega** | 11 gier na Mega Drive: Miniplanets, Tank Battle, Battle 4Tris, Pong i inne |
| **Master System** | 4 gry: Balloon Master, SkyHaul, Food Fighter, Escape from Monster Dimension |
| **PlayStation** | Hello Pong |
| **Gry → Gry zręcznościowe** | Flappy Arcade — własna gra Arcade na jeden przycisk: działa bezpośrednio w panelu i w oknie Arcade; trasa dnia jest dla wszystkich ta sama, a twój rekord się zapisuje |
| **Gry → Strzelanki** | Freedoom Phase 1 i 2 (wolne zamienniki Dooma), deathmatch FreeDM, Blasphemer (wolny zamiennik Heretica), deathmatch BlasphDM, OpenArena — strzelanka arenowa na silniku Quake III przeciwko botom (GPL-2.0) |
| **Gry → Wyścigi** | HexGL — futurystyczne wyścigi antygrawitacyjne |
| **Gry → Strategie** | OpenTTD — potentat transportowy (GPL-2.0); Micropolis — otwarty kod klasycznej gry o budowie miasta z 1989 roku, twoje miasto zapisuje się w przeglądarce (micropolisJS, GPL-3.0 z dodatkowymi warunkami i Micropolis Public Name License); Warzone 2100 — strategia czasu rzeczywistego z kampanią i potyczką z komputerem, własne jednostki projektujesz sam, zapisy zostają w przeglądarce (GPL-2.0-or-later) |
| **Gry → Przygodówki** | Cztery darmowe klasyczne przygodówki z lat 90. w ScummVM (GPL-3.0-or-later): Beneath a Steel Sky, Flight of the Amazon Queen, Lure of the Temptress i Nippon Safes, Inc. — dane gier freeware, które wolno rozpowszechniać za zgodą; zapis w dowolnej chwili klawiszem F5 |
| **Gry → Gry planszowe** | Szachy — z ludźmi lub komputerem (Stockfish, poziomy 1–10), online z zegarem; go na planszach 9×9, 13×13 i 19×19; warcaby rosyjskie, reversi; *Poddaj się* wszędzie |
| **Książki** | Klasyka z domeny publicznej w 30 językach — język wybierasz według uznania (na początku to język interfejsu). Sekcje są te same w każdym języku: Popularne, Proza, Poezja, Dramaty, Przygodowe, Kryminały i inne; szukasz po tytule lub autorze. Lista przychodzi na żądanie z Project Gutenberg i Wikiźródeł — Arcade nie przechowuje własnych książek; otwarta książka zostaje w *Moje książki* twojej przeglądarki. Zakładka ustawia się sama: otwórz książkę ponownie, a wrócisz do miejsca, w którym była przerwa. Twoje własne pliki EPUB, FB2 i TXT też otwierają się w oknie Arcade |
| **Audiobooki** | Nagrania LibriVox w tych samych językach i sekcjach, z wyszukiwaniem: słuchaj online prosto z archive.org albo pobierz książkę do przeglądarki, aby słuchać offline. Odtwarzacz w oknie Arcade pamięta rozdział, miejsce i tempo; twoje pliki MP3, M4A, M4B, OGG i Opus też się tam otwierają i zostają w twojej przeglądarce |
| **Artykuły** | Świeże artykuły ze 106 wybranych anglojęzycznych blogów i serwisów — Simon Willison, InfoQ, The Cloudflare Blog, Ars Technica, Krebs on Security i inne |
| **Podcasty** | Świeże odcinki 65 anglojęzycznych podcastów — Software Engineering Daily, Security Now, Talk Python To Me, Darknet Diaries i inne; każdy odcinek pamięta miejsce przerwania |
| **YouTube** | Świeże filmy ze 153 wybranych kanałów w 24 dziedzinach, od AI, weba i DevOps po naukę, kosmos i retro-komputery |
| **Twitch** | *Moje kanały* — dowolny kanał Twitcha po nazwie lub linku, najpierw te nadające na żywo; *Teraz na żywo* i *Cały katalog* — 26 wybranych kanałów anglojęzycznych, bez kanałów 18+; rejestracja niepotrzebna |

Karta każdej gry prowadzi do jej licencji i kodu źródłowego.

**Tematy.** Artykuły, Podcasty i YouTube zaczynają się od tematów: Haiku proponuje trzy związane z tym, nad czym pracuje agent, plus *Nowości i prezentacje*. W *Własny temat* możesz wpisać, co chcesz obejrzeć, przeczytać lub posłuchać, w dowolnym języku; pięć ostatnich tematów zostaje jako kafelki w *Moje tematy*.

## Gra online

- **Konsole.** Gry dla dwóch osób na NES, Sega, Master System i PlayStation mają przycisk **Online**: utwórz pokój lub dołącz do cudzego. Sterowanie jest synchronizowane klatka po klatce przez serwer Arcade.
- **Doom.** **FreeDM** i **BlasphDM** to poczekalnie deathmatchu z 5-minutowymi rundami dla maksymalnie czterech graczy; **Freedoom** i **Blasphemer** oferują kooperację przez **Online**. Nowe osoby czekają na następną rundę — silnik nie pozwala dołączyć do trwającego meczu.
- **Gry planszowe.** *Znajdź przeciwnika*, *Zaproś znajomego* linkiem albo *Z komputerem*. Partia zapisuje się na serwerze: wykonaj ruch, wróć do agenta, otwórz link później — plansza będzie taka, jaką zostawiono. Po zalogowaniu z @nickiem przeciwnik widzi go obok twojego koloru.
- **Kto czeka.** Raz na minutę Arcade sprawdza, czy ktoś czeka na partnera do gry, i pokazuje to w Claude Code — na przykład *„zagrasz? Czekają online: FreeDM (1)”* — z przyciskiem **Dołącz** w menu.

## Konto, znajomi i czaty

Logowanie jest opcjonalne — bez niego wszystko inne działa jak dotąd.

- **Zaloguj się przez GitHub** (w *Społeczność*): strona logowania GitHuba otwiera się w twojej zwykłej przeglądarce; potwierdź tam, a potem kliknij *Sign in* na stronie Arcade — jej kod powinien być taki sam jak w panelu. Jeśli przez przeglądarkę nie wychodzi, wybierz *Zaloguj się kodem*: Arcade pokazuje kod, który wpisujesz na stronie GitHuba. Arcade poznaje tylko nazwę i zdjęcie twojego profilu GitHub — bez e-maila, bez dostępu do repozytoriów.
- **Synchronizacja.** Język, klawisze, powiadomienia, rozmiar panelu, co robić z grą, gdy agent da znać, ustawienia przeglądarki w Desktop, twoje tematy, kanały Twitcha, ulubione, zwinięte i ukryte sekcje i rekord we Flappy Arcade stają się takie same na wszystkich twoich komputerach. Własne gry, przeglądarka i tryb grafiki pozostają osobne dla każdego komputera.
- **@nick.** Weź swoją nazwę z GitHuba jednym kliknięciem albo wymyśl własną: od 4 do 32 znaków — litery łacińskie, cyfry i `_`. Możesz ją zmieniać do 5 razy dziennie.
- **Znajomi.** Dodaj znajomą osobę po dokładnym @nicku: zaproszenie zostaje przyjęte po drugiej stronie i pojawiacie się nawzajem na swoich listach. Podczas wpisywania nie ma podpowiedzi, więc nikt nie przejrzy, kto korzysta z Arcade. Odrzucanie i usuwanie odbywa się po cichu.
- **Online i zaproszenia do gry.** Dopóki menu Arcade jest otwarte, znajomi widzą cię *online*, a ty ich; żeby się nie pokazywać, wyłącz *Pokazuj znajomym, że jestem online* na ekranie *Znajomi*. *Zaproś* obok znajomej osoby proponuje gry sieciowe: gra planszowa otwiera własny pokój dla dwojga, gra z rodziny Doom — swoje lobby. Gra od razu otwiera się u ciebie; znajoma osoba dostaje powiadomienie i *Przyjmij* na górze menu, a zaproszenie jest ważne przez 10 minut. Zapraszać można tam, gdzie gry sieciowe otwierają się w przeglądarce — wbudowanej w Desktop albo w oknie przeglądarki.
- **Czaty.** We dwoje ze znajomą osobą, grupy znajomych albo grupa ze wszystkimi znajomymi jednym kliknięciem. Pisz bezpośrednio w panelu Arcade albo otwórz stronę czatów w serwisie. Wiadomości są przechowywane na stronie Arcade i nie są szyfrowane — nie wpisuj w nich haseł ani kluczy.
- **Awatary i powiadomienia o wiadomościach.** Wybierz jeden z 24 gotowych awatarów w *Koncie* — czaty tylko go pokazują; bez awatara widać pierwszą literę twojego @nicka. Obrazek grupy wybiera osoba, która nią zarządza, spośród tych samych 24. Twojego obrazka z GitHuba inni nigdy nie widzą. Gdy znajoma osoba do ciebie pisze, w lewym dolnym rogu nad wszystkimi oknami pojawia się karta (Windows) albo powiadomienie systemowe (macOS, Linux); kliknięcie karty otwiera ten czat.
- **Wyloguj się** zatrzymuje synchronizację na tym komputerze; **Usuń konto** (naciśnij dwa razy) sprawia, że strona zapomina twoje konto i ustawienia.

## Notatnik i tablice projektów

Oba są w sekcji *Praca* menu.

- **Notatnik.** Strony i podstrony; wiersz zaczynający się od `# ` to nagłówek, od `- ` — punkt, od `- [ ] ` — punkt listy kontrolnej, który odhacza się naciśnięciem. Notatnik jest przechowywany na tym komputerze — do 200 stron, 20 000 znaków na stronę.
- **Claude też go prowadzi.** *Wyślij do Claude* przekazuje stronę Claude, albo po prostu poproś Claude, żeby coś zapisał w Arcade. Claude używa narzędzia `mcp__arcade__notes`, które zmienia tylko notatnik i niczego nie usuwa. Jeśli zmiana Claude ci się nie podoba — *Przywróć tekst sprzed zmiany Claude*.
- **Notion i inne aplikacje** — przez konektory Claude, więc Arcade nie potrzebuje kluczy ani haseł: *Wyślij do Notion*, *Do innej aplikacji*, *Importuj z Notion lub innej aplikacji*. Połączoną stronę można zaktualizować w aplikacji albo ponownie z niej zaimportować.
- **Głosem.** Podyktuj tekst w polu wpisywania Claude systemowym dyktowaniem (Win+H w Windows, dwa razy Fn w macOS), a potem naciśnij *Weź z pola wpisywania Claude* — tekst trafi na koniec strony.
- **Tablica projektów.** Kolumny — *Do zrobienia*, *W toku*, *Gotowe* albo własne, do 8 — i karty; karta to strona notatnika z tekstem i listą kontrolną. Naciśnij kartę, aby ją wybrać i przenosić strzałkami, a jeszcze raz — aby ją otworzyć. Claude też może prowadzić tablicę: *Wyślij do Claude* albo poproś go, żeby rozłożył zadania na tablicy w Arcade.
- **Wspólne tablice.** Po zalogowaniu z @nickiem zaznacz znajomych i naciśnij *Udostępnij*: wszyscy mają te same karty, kolumny i nazwę, a zmiany docierają w ciągu kilku sekund. Właściciel zaprasza kolejnych znajomych, usuwa uczestników i kasuje tablicę ze strony Arcade; opuścić ją może każdy; cokolwiek się stanie, każdy zachowuje własną kopię. Do 3 własnych wspólnych tablic, do 20 osób i 200 kart na tablicy.

## Własne gry

- **`/arcade-add <plik>`** dodaje ROM na NES, Mega Drive lub Master System (do 4 MB). Wtyczka trzyma kopię w `~/.claude/arcade` i nigdzie jej nie wysyła.
- **Płyty PlayStation i WAD-y Dooma** (na przykład własny `doom.wad`) — w oknie Arcade: **Otwórz własny plik**. Zostają tylko w tej przeglądarce.

Dodawaj tylko pliki, do których masz prawa.

## Ustawienia

Otwórz **Ustawienia** w sekcji *Więcej* menu `/arcade`:

- **Działy menu głównego** — pokaż lub ukryj dowolną sekcję oprócz *Więcej*; ukrytej sekcji w ogóle nie ma w menu, dopóki jej tu nie przywrócisz. Ten sam wybór Arcade proponuje przy pierwszym otwarciu.
- **Język** — jeden z 13 (także bezpośrednio w menu: 🌐).
- **Otwieranie gier** — tutaj w panelu, w oknie przeglądarki lub w konkretnej przeglądarce; w Claude Desktop — we wbudowanej przeglądarce Claude lub w oknie przeglądarki.
- **Grafika** (terminal) — piksele w terminalach, które wyświetlają obrazy (kitty, Ghostty, Rio), wszędzie indziej bloki tekstu.
- **Rozmiar panelu** — zwykły lub na całą szerokość.
- **Gdy agent skończy** — baner i dalsza gra, pauza z banerem albo od razu powrót do agenta.
- **Gdy agent poprosi o zgodę** — te same trzy opcje.
- **Gdy otwiera się przeglądarka** (Claude Desktop) — zamykanie menu Arcade, żeby przeglądarka miała całą wysokość, albo pozostawienie menu nad nią.
- **Agent skończył, gdy oglądasz** (Claude Desktop) — zamknięcie karty, którą Arcade otworzył dla filmu, transmisji, TikToka, artykułu lub odcinka, żeby czat z Claude znów był przed tobą, albo tylko powiadomienie.
- **Powiadomienia podczas gry w oknie.**
- **Powiadomienia o wiadomościach** — karta w lewym dolnym rogu, gdy znajoma osoba pisze na czacie (w macOS i Linuksie — powiadomienie systemowe).
- **Test klawiszy i zmiana przypisań** (terminal).
- **Warunki i prywatność** — Warunki korzystania i Polityka prywatności strony, w twojej zwykłej przeglądarce.

## Co wtyczka robi na twoim komputerze

Arcade działa wewnątrz Claude Code z takim dostępem, jaki Claude Code daje wtyczkom. Cały jego kod jest w tym repozytorium, a `claude plugin validate ./mod` wymienia każde zdarzenie, pod które się podpina, i każde wywołanie, które robi. W skrócie:

- **Narzędzia agenta.** Arcade widzi, kiedy narzędzie się zaczyna i kończy oraz kiedy agent prosi o zgodę — tak wie, kiedy pokazać baner. Nigdy nie zmienia ani nie blokuje wywołań narzędzi agenta. Sam zatwierdza tylko dwa rodzaje wywołań i tylko tam, gdzie Claude Code inaczej zapytałby ciebie: `mcp__arcade__notes`, które zmienia tylko notatnik i niczego nie usuwa, oraz otwarcie gry we wbudowanej przeglądarce Desktop po tym, jak naciśniesz ją w panelu. Twoje reguły zezwalania i odmowy działają bez zmian.
- **Przerwanie agenta.** Tylko w Claude Desktop, gdy otwierasz coś we wbudowanej przeglądarce, kiedy agent pracuje: Desktop nie pozwala wtyczce samej otworzyć przeglądarki. Arcade czeka, aż skończy się bieżące narzędzie (po 10 sekundach je przerywa, ale czeka, dopóki na ekranie jest pytanie o zgodę), przerywa agenta i prosi Claude, żeby otworzył stronę i wrócił do pracy. Żeby tego uniknąć, wybierz okno przeglądarki w *Ustawienia → Otwieranie gier*.
- **Twoja rozmowa.** Do tematów Haiku w twojej własnej sesji dostaje końcówkę rozmowy, kilka tysięcy znaków; to wlicza się do twojego użycia Claude. Strona Arcade nigdy nie widzi rozmowy. Arcade pisze w polu wpisywania Claude lub je wysyła tylko na twoją prośbę — na przykład *Wyślij do Claude* w notatniku — albo żeby otworzyć stronę, jak opisano wyżej.
- **Programy.** Twoja przeglądarka dla okna Arcade (w Windows z osobnym profilem w `%LOCALAPPDATA%\claude-arcade`); powiadomienia — PowerShell w Windows, `osascript` w macOS, `notify-send` w Linuksie; sprawdzenie, jakie przeglądarki są zainstalowane (Windows) albo jaki to system (`uname`).
- **Pliki.** Zapisuje tylko ROM-y, które dodajesz przez `/arcade-add`, w `~/.claude/arcade/roms`, i czyta tylko wskazany przez ciebie plik, te kopie i własne pliki. Ustawienia, notatnik i ulubione są w magazynie wtyczek Claude Code.
- **Zmienne środowiskowe.** Czyta `HOME` lub `USERPROFILE`, `LANG`, `LC_ALL`, `LC_MESSAGES`, `LOCALAPPDATA` i `OS`; żadnej nie zmienia.
- **Sieć.** Sama wtyczka łączy się tylko ze stroną Arcade (`agent-arcade.fefaodessa.workers.dev`), z feedami RSS kanałów YouTube oraz blogów i podcastów, które pokazuje. Obrazki w panelu Desktop, na przykład awatary Twitcha, ładują się prosto z tych serwisów. Gry, książki i filmy ładuje strona otwarta w przeglądarce.

## Prywatność

Szczegóły są w [Polityce prywatności](https://agent-arcade.fefaodessa.workers.dev/privacy) i [Warunkach korzystania](https://agent-arcade.fefaodessa.workers.dev/terms) strony; we wtyczce znajdziesz je w *Ustawienia → Warunki i prywatność*. W skrócie:

- Bez reklam, bez analityki, bez śledzenia. Gry, które przyszły z kodem analitycznym, zostały z niego oczyszczone (zobacz `NOTICE` każdej gry).
- Twoje ROM-y, WAD-y, książki i pliki audio nigdy nie opuszczają twojego komputera ani przeglądarki.
- Listy książek i audiobooków oraz książki z Project Gutenberg idą przez stronę Arcade, która pobiera je z Project Gutenberg, Wikiźródeł i archive.org i trzyma tylko w pamięci podręcznej Cloudflare — listy przez sześć godzin, książkę przez tydzień. Strony Wikiźródeł i nagrania LibriVox okno pobiera prosto z tych serwisów.
- Gra online idzie przez serwer Arcade na Cloudflare: wiadomości są przekazywane między graczami w pokoju i nie są przechowywane — z wyjątkiem ruchów w grach planszowych, które zostają, żeby można było wrócić; partia nieruszana przez miesiąc jest usuwana.
- Tematy proponuje Haiku w twojej własnej sesji Claude Code; strona Arcade nigdy nie widzi twojej rozmowy — tylko krótkie angielskie zapytanie wyszukiwania, gdy używasz *Własny temat*. Adres artykułu stoi po `#`, więc nigdy nie trafia na serwer Arcade.
- Wyszukiwanie w *Własny temat* idzie przez YouTube API Services, a filmy odtwarza odtwarzacz samego YouTube, więc obowiązują też [Warunki korzystania z YouTube](https://www.youtube.com/t/terms) i [Polityka prywatności Google](https://policies.google.com/privacy). Do sześciu filmów wybiera Haiku w twojej własnej sesji — na podstawie tytułów i krótkich opisów; strona Arcade trzyma wyniki wyszukiwania we wspólnej pamięci podręcznej przez dobę.
- Po zalogowaniu strona przechowuje twoje zsynchronizowane ustawienia, ulubione, @nick, znajomych, czaty i wspólne tablice, a zaproszenia do gry — przez 10 minut. Kto jest online, trzyma tylko w pamięci, przez półtorej minuty. Klucz sesji jest wysyłany tylko do strony Arcade.
- Notatnik zostaje na twoim komputerze. Wspólne tablice są przechowywane na stronie Arcade i nie są szyfrowane — tak jak czaty. Strony notatnika trafiają do Notion lub innej aplikacji tylko wtedy, gdy o to poprosisz, przez twoje własne konektory Claude.
- Zgłoszenie błędu zawiera twój tekst, wersję Arcade, miejsce, w którym jest otwarty, język interfejsu i system operacyjny — nic więcej; bez logowania idzie bez podpisu, a strona nie przechowuje żadnego adresu.
- Niektóre gry łączą się z internetem tylko na twoje życzenie — na przykład opcjonalna ankieta OpenTTD i jego przycisk *Online Content*.

## Platformy i status

Arcade jest w wersji **beta**: funkcje są na miejscu, a praca trwa nad szczegółami — zobacz [dziennik zmian](CHANGELOG.md).

- Sprawdzony w praktyce na Windows, macOS i Linux.
- Działa w terminalu, w VS Code i w Claude Desktop.

## Licencje

- **Gry:** każda gra ma własną wolną licencję (MIT, GPL, BSD, Apache, Creative Commons i inne) — tekst licencji i kod źródłowy leżą obok gry, a link do nich jest na jej karcie.
- **Książki i audiobooki:** domena publiczna; Arcade ich nie przechowuje — książki przychodzą z Project Gutenberg i Wikiźródeł, nagrania z LibriVox (archive.org), w chwili, gdy je otwierasz.
- **Emulatory i silniki:** JSNES (Apache-2.0), EmulatorJS (GPL-3.0) z rdzeniami, PrBoom (GPL-2.0), doom-wasm od Cloudflare i Chocolate Doom/Heretic (GPL-2.0), OpenTTD (GPL-2.0), micropolisJS (GPL-3.0 z dodatkowymi warunkami), ScummVM (GPL-3.0-or-later), Stockfish (GPL-3.0) — przeciwnik w szachach. Rdzeń Genesis Plus GX używany dla Sega i Master System jest przeznaczony tylko do użytku niekomercyjnego.
- **Własny kod Arcade** (wtyczka i strona) — **GNU AGPL-3.0** ([LICENSE](LICENSE)), © 2026 Max Arbakov. Możesz go swobodnie używać, badać i zmieniać. Jeśli rozpowszechniasz zmienioną wersję — albo uruchamiasz ją jako usługę online dla innych osób — musisz opublikować cały swój kod źródłowy na tej samej licencji i zachować informacje o prawach autorskich. Komponenty zewnętrzne zachowują własne licencje.

## Wesprzyj projekt

Arcade jest darmowy. Jeśli umila ci czekanie, możesz postawić projektowi kawę — całkowicie dobrowolnie: **[ko-fi.com/agentarcade](https://ko-fi.com/agentarcade)**. Ten sam link jest na dole menu `/arcade` (*☕ Wesprzyj projekt*) i w oknie Arcade. Nic w Arcade od tego nie zależy i nigdy nie przerywa to gry.

## Opinie

Coś nie działa? Najszybciej zgłosisz błąd bezpośrednio w Arcade: **Więcej → 🐞 Zgłoś błąd**. Opisz, co się zepsuło, a zgłoszenie trafi prosto do autora Arcade razem z wersją, środowiskiem, językiem i systemem operacyjnym.

Możesz też otworzyć [issue](https://github.com/ArbakovMaxim/agent-arcade/issues) — z błędami i z pomysłami. Podaj system operacyjny, środowisko Claude Code (terminal, VS Code lub Desktop) i grę.

Pull requesty są mile widziane. Wysyłając taki, zgadzasz się, że twój wkład będzie objęty licencją AGPL-3.0 i że autor może też oferować Arcade na innych warunkach (na przykład na licencji komercyjnej).

## Dla programistów

```
mod/     wtyczka Claude Code (hooki, interfejs panelu, testy)
site/    strona na Cloudflare Workers: katalog, okno Arcade, pokoje sieciowe, konta, znajomi, czaty, zgłoszenia błędów
tools/   narzędzia do budowania: tłumaczenia, heretic-wasm
.github/ GitHub Actions, które budują doom-wasm, heretic-wasm, OpenTTD i ScummVM dla przeglądarki
```

- Uruchomienie wtyczki z repozytorium: `claude --plugin-dir ./mod`
- Testy wtyczki: `claude plugin validate ./mod`, potem `claude plugin test` w `mod/`
- Testy strony: `npm test` w `site/`; build: `node build.mjs`; wdrożenie odbywa się automatycznie z `main` przez Cloudflare Workers Builds.
- Prace toczą się w `main` i tam też kieruj pull requesty. Domyślna gałąź `plugin` to kopia `main` bez `site/`, którą GitHub Action aktualizuje przy każdym pushu: marketplace wtyczek pobiera ją zamiast całego repozytorium.
- Tłumaczenia: `node tools/i18n/collect.mjs`, potem `node tools/i18n/check.mjs` — zobacz [tools/i18n/README.md](tools/i18n/README.md).

Szczegółowa dokumentacja (po rosyjsku): [mod/README.md](mod/README.md) — wtyczka, [site/README.md](site/README.md) — strona, dodawanie gier i gra sieciowa.
