# Changelog · Список изменений

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
