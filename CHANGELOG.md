# Changelog · Список изменений

## 0.18.0 — статьи и подкасты в главном меню, раздел «Читать и слушать»: темы те же, что у YouTube (три по работе агента и «Новинки и презентации»), под темой — свежие статьи из отобранных англоязычных блогов и изданий или выпуски англоязычных подкастов; статья открывается во встроенном браузере Desktop или в окне браузера, выпуск играет проигрыватель аудиокниг · articles and podcasts in the main menu, under “Read & listen”: the same topics as YouTube (three about what the agent is working on plus “Launches and keynotes”), each with fresh articles from curated English-language blogs and publications or episodes of English-language podcasts; an article opens in the Desktop built-in browser or a browser window, an episode plays in the audiobook player

- Sources: 39 article feeds (Simon Willison, InfoQ, The Cloudflare Blog, Ars Technica, Krebs on Security, the Rust, Go and Python blogs, DEV tags and more) and 17 podcasts (Software Engineering Daily, Security Now, Talk Python To Me, Darknet Diaries and more), all in English; the list lives on the site (`feeds.json`), and the mod keeps a copy for when the site is down · источники: 39 лент статей (Simon Willison, InfoQ, The Cloudflare Blog, Ars Technica, Krebs on Security, блоги Rust, Go и Python, теги DEV и другие) и 17 подкастов (Software Engineering Daily, Security Now, Talk Python To Me, Darknet Diaries и другие), все на английском; список — на сайте (`feeds.json`), у мода есть копия на случай, если сайт недоступен
- Haiku ranks what the feeds published by how well it fits the topic; if it does not answer, the freshest items from different sources are shown · Haiku расставляет свежее из лент по тому, как оно подходит к теме; не ответила — показываются самые свежие, из разных источников
- The `/read` page opens only links to the feeds’ own sites, and `/listen` plays only podcasts from the feeds; the article address goes after `#`, so it never reaches Arcade’s server · страница `/read` открывает только ссылки на сайты из лент, `/listen` играет только подкасты из лент; адрес статьи идёт после `#` и не уходит на сервер Arcade
- An episode remembers where you stopped, like an audiobook, and links to its page on the podcast’s site · выпуск запоминает место, как аудиокнига, и ведёт на свою страницу на сайте подкаста
- Desktop: articles and episodes open the way videos do — Arcade interrupts Claude once to open the link in the built-in browser, waits out a compaction, and does not interrupt twice for the same link · Desktop: статьи и выпуски открываются как видео — Arcade один раз прерывает Claude, чтобы открыть ссылку во встроенном браузере, ждёт конца сжатия контекста и не прерывает второй раз ради той же ссылки
- YouTube: no language quotas any more — English channels are the main pool, a few channels in the interface language are mixed in, and Haiku ranks every video by fit alone, whatever its language · YouTube: больше никаких квот по языкам — основа подборки английские каналы, несколько каналов на языке интерфейса идут в придачу, и Haiku оценивает каждое видео только по тому, насколько оно подходит, независимо от языка
- New strings are translated into all 13 languages · новые строки переведены на все 13 языков

## 0.17.1 — Desktop: карточки видео YouTube крупнее — название целиком, канал отдельно от даты и просмотров, начало описания (без ссылок, хештегов и таймкодов); плитки тем шире, названия больше не вылезают за рамку · Desktop: bigger YouTube video cards with the full title, the channel apart from the date and views, and the start of the description (without links, hashtags or timestamps); wider topic tiles, so titles no longer spill over the border

- Desktop: shelves of a group (“Games”: arcade, shooters, racing…) are tiles with a genre icon, like the main menu · полки группы («Игры»: аркады, шутеры, гонки…) — плитками с иконкой жанра, как главное меню
- Desktop: tile width follows the pane, so a row never runs past its edge; a long title wraps onto a second line instead of spilling over the next tile · ширина плиток — по ширине панели, ряд не вылезает за край; длинное название переносится на вторую строку, а не наезжает на соседнюю плитку
- Desktop: a long description (Go, for one) shows about three lines with “more” to expand and “less” to fold, so one tall tile no longer skews its row · длинное описание (например, у го) — около трёх строк, целиком по «ещё», «свернуть» прячет; одна высокая плитка больше не перекашивает ряд
- Desktop: pressing a game again while Claude is already opening it no longer interrupts Claude a second time; another game is asked for without interrupting; while Claude compacts its context, Arcade waits for the compaction to end instead of interrupting, however long it takes · Desktop: повторное нажатие на игру, которую Claude уже открывает, больше не прерывает его второй раз; другую игру Arcade просит открыть без прерывания; пока Claude сжимает контекст, Arcade не прерывает его, а ждёт конца сжатия, сколько бы оно ни шло

## 0.17.0 — YouTube в главном меню, раздел «Смотреть»: Haiku предлагает три темы по работе агента и «Новинки и презентации», под темой — свежие видео с каналов из пула (обычно 2 на языке интерфейса и 2 английских, у новинок — 1 и 3); видео открываются на странице просмотра сайта — во встроенном браузере Desktop или в окне браузера; пока каналы на английском и русском, остальные языки — на этапе 2 · YouTube in the main menu, under “Watch”: Haiku suggests three topics about what the agent is working on plus “Launches and keynotes”; each topic gets fresh videos from curated channels (usually 2 in the interface language and 2 in English, 1 and 3 for launches); videos open on the site’s watch page, in the Desktop built-in browser or a browser window; channels cover English and Russian for now, other languages come in stage 2

## 0.16.1 — Desktop: плитки главного меню снова сеткой, а не по одной во всю ширину; рамки, подсветка и цвета статуса — от темы, светлой и тёмной; у всех плиток свои иконки; заголовки разделов не липнут к плиткам; «Шахматы», «Русские шашки», «Реверси» и «Го» переведены на все языки · Desktop: main menu tiles in a grid again; borders, hover and status colours follow the light or dark theme; every tile has its own icon; board game titles are translated into every language

## 0.16.0 — новый вид мода в Claude Desktop: карточки с иконками, обложки игр, подсветка при наведении, крупные заголовки; терминал и VS Code — как были · a new look in Claude Desktop: cards with icons, game covers, hover highlight

## 0.15.1 — Desktop: после перезагрузки мода (`/reload-plugins`, обновление) панель Arcade снова закрывается, когда Claude открыл игру во встроенном браузере, и браузер разворачивается на всё окно; правило из настроек (разрешить или запретить) Arcade больше не переписывает, и встроенная защита Claude Code не пишет об этом в чат · Desktop: after a mod reload the Arcade pane closes again once Claude opens the game in the built-in browser, which then takes the whole window; Arcade no longer rewrites allow or deny rules from settings

## 0.15.0 — «Продолжить» в главном меню мода: последняя игра (или книга, аудиокнига) — первой плиткой и с фокусом, одним нажатием; журнал агента внизу меню — с подписью «Журнал агента» и только когда в нём что-то есть, без одинокого «пока ничего» · “Continue” in the mod's main menu: the last game, book or audiobook as the first, focused tile; the agent log at the bottom is labelled and shows only when it has entries

## 0.14.1 — меню мода на всех языках: «Аудиокниги», «Мои аудиокниги», «Квесты», «Браузерные» и жанры «квест» и «градостроитель» больше не остаются по-русски · the mod menu translates audiobooks, adventures, browser games and the adventure and city builder genres into every language

## 0.14.0 — аудиокниги: своя группа с полками по языкам и жанрам, проигрыватель в окне (главы, скорость, перемотка, место запоминается), свои аудиокниги — MP3, M4A, M4B, OGG, Opus, только в браузере; первые книги LibriVox; полки языков книг и аудиокниг создаются сами; Micropolis — открытый градостроитель 1989 года; классические квесты в ScummVM · audiobooks by language and genre, your own files stay in the browser, first LibriVox titles; Micropolis city builder; classic adventure games in ScummVM

## 0.13.0 — шахматы: с компьютером на Stockfish (сила 1–10, цвет, таймер, запись ходов, PGN, вернуть ход, подсказка), по сети с часами на сервере и подбором по контролю времени, счётчики «кто какой вариант ждёт»; новая игра го: 9×9, 13×13, 19×19, с компьютером, по сети и с другом · chess with Stockfish and online clocks; new game: Go

## 0.12.0 — Flappy Arcade: своя игра прямо в панели Claude Code (терминал, Desktop, VS Code — без браузера) и в окне Arcade; одна кнопка, трасса дня одна для всех, свой рекорд · Flappy Arcade: an original game right in the Claude Code panel and in the Arcade window

## 0.11.1 — жанры книг: в моде — плитками на полке языка, в окне — рядом под полками; у полок «Книг» — «книг», а не «игр» · book genres as tiles in the panel and a genre row in the window

- The panel now translates “Books”, “Games” and the shelf names · в панели переведены «Книги», «Игры» и названия полок
- Checked live on macOS and Linux · проверено вживую на macOS и Linux

## 0.11.0 — книги на полках-языках, внутри — по жанрам; новый вид главного меню мода: разделы «Играть», «Читать», «Ещё», плитки, цветной значок агента, логотип в Desktop · books on language shelves by genre; a new main menu: sections, tiles, a coloured agent badge, the logo in Desktop

## 0.10.1 — книги: жанры на всех языках, прогресс чтения в библиотеке; описания игр по-английски на всех языках, кроме русского

## 0.10.0 — books and 13 languages · книги и 13 языков

- **Books · книги**: 136 public-domain books — 98 in English (Project Gutenberg) and 38 in Ukrainian (Ukrainian Wikisource); a reader in the Arcade window with contents, font size, light and dark theme; the bookmark is set automatically; your own EPUB, FB2 and TXT · 136 книг из общественного достояния — 98 на английском (Project Gutenberg) и 38 на украинском (украинская Викитека); читалка в окне Arcade с оглавлением, размером шрифта, светлой и тёмной темой; закладка ставится сама; свои EPUB, FB2 и TXT.
- **13 languages · 13 языков**: English, Русский, Українська, Español, Français, Deutsch, Português, Italiano, Polski, Türkçe, 日本語, 中文, 한국어 — from the system or browser language, English by default; a language list in the `/arcade` menu and in the window · по языку системы или браузера, по умолчанию английский; список языков в меню `/arcade` и в окне.
- Reading right in the Claude Code panel is coming next · чтение прямо в панели Claude Code — следующим шагом.

## 0.9.0-alpha — 2026-10-19

First public alpha · первая публичная альфа-версия.

**Games · игры** — 54 free games with open licenses: NES (Dendy) 28, Sega Mega Drive 11, Master System 4, PlayStation 1, and the *Games* tab — shooters (Freedoom, FreeDM, Blasphemer, BlasphDM), racing (HexGL), strategy (OpenTTD), board games (chess, Russian draughts, reversi).
54 бесплатные игры под открытыми лицензиями: Денди — 28, Sega Mega Drive — 11, Master System — 4, PlayStation — 1, и вкладка «Игры» — шутеры, гонки, стратегии и настольные.

**In Claude Code · в Claude Code**
- *“play?”* above the prompt after 10 seconds of agent work · «сыграть?» над строкой ввода после 10 секунд работы агента.
- NES right in the panel (terminal, VS Code, Desktop); everything else in a browser window · Денди прямо в панели, остальное — в окне браузера.
- Banner when the agent finishes or asks for permission: keep playing, pause, or back to the agent · плашка, когда агент закончил или ждёт разрешения.
- Russian and English, with a 🌐 switch in the main menu · русский и английский, переключатель 🌐 в главном меню.
- Your own ROMs: `/arcade-add`; PlayStation discs and Doom WADs in the window · свои игры.

**Online · по сети**
- Two-player console games online (EmulatorJS netplay through Arcade's server) · игры приставок на двоих по сети.
- Doom: FreeDM and BlasphDM deathmatch rounds, Freedoom and Blasphemer co-op · Doom: раунды deathmatch и кооператив.
- Board games: find an opponent, invite by link, or play the computer; games are kept on the server · настольные: соперник, приглашение по ссылке или компьютер; партия хранится на сервере.
- “Who's waiting online” right in Claude Code · «кто ждёт в сети» прямо в Claude Code.

**Also · ещё**
- License: GNU AGPL-3.0 · лицензия GNU AGPL-3.0.
- Voluntary support on Ko-fi: https://ko-fi.com/agentarcade · добровольная поддержка на Ko-fi.

**Known limitations · известные ограничения**
- macOS and Linux are covered by tests but not yet tested live · macOS и Linux покрыты тестами, но вживую ещё не проверены.
- Doom and Heretic network matches can't be joined mid-round — newcomers wait for the next one · в идущий раунд Doom войти нельзя — ждут следующий.
- OpenTTD is single-player for now · OpenTTD пока только одиночный.
