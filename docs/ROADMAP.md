# Arcade — roadmap · план

Ideas and next steps, roughly in order. Nothing here is a promise.
Идеи и следующие шаги, примерно по порядку. Это не обещания.

## Next · дальше

- **Read right in the Claude Code panel** — the second half of books: a reader in the pane (terminal, VS Code, Desktop), your own FB2/TXT via `/arcade-add`, bookmarks in the pane.
  **Чтение прямо в панели Claude Code** — вторая часть книг: читалка в панели, свои FB2 и TXT через `/arcade-add`, закладки в панели.
- **A link instead of the Arcade window in Desktop and VS Code** — the app opens the game in the default browser itself: no browser detection, no per-OS launch commands. The Arcade window stays as an option in “Open games”; the terminal keeps the window.
  **Ссылка вместо окна Arcade в Desktop и VS Code** — игру открывает само приложение в браузере по умолчанию: без поиска браузеров и команд под каждую систему. Окно Arcade остаётся вариантом в «Где открывать игры», в терминале — как сейчас.
- **Live check on macOS and Linux** · **живая проверка на macOS и Linux**.

## Waiting for Claude Code · ждём от Claude Code

- **Open a page in Claude Desktop's built-in browser.** Today a plugin can only draw a pane or open an external browser (`Link` opens outside the app). A method like `$.ui.browse(url)` would let Arcade open games inside Desktop — one click, no OS-specific code. To request at https://github.com/anthropics/claude-code/issues (draft in the project chat, 2026-10-20).
  **Открыть страницу во встроенном браузере Claude Desktop.** Сейчас плагин может только нарисовать панель или открыть внешний браузер (`Link` открывается вне приложения). Метод вроде `$.ui.browse(url)` позволил бы открывать игры внутри Desktop. Запрос — в issues Claude Code.

## Later · потом

- **Audiobooks** — LibriVox (public domain) via R2 storage, your own MP3/M4B, pause on agent signals · **аудиокниги** — LibriVox через хранилище R2, свои MP3 и M4B, пауза по сигналу агента.
- **Bookmark sync** between the pane, the window and devices via a sync code, no account · **синхронизация закладок** между панелью, окном и устройствами по коду, без регистрации.
- **OpenArena with bots** — ~400 MB of data (R2) and a WebSocket bridge for UDP · **OpenArena с ботами** — данные около 400 МБ (R2) и мост WebSocket для UDP.
- **Own domain** instead of `*.workers.dev` · **свой домен**.
- **More books** — fix the ones the quality check rejects (for example Leaves of Grass) · **ещё книги** — починить те, что не прошли проверку качества.
- **Small chapter flaws** — long chapters split into parts by size (Heart of Darkness, The Republic, Walden, Arabian Nights, Portrait of the Artist ch. V, The Canterbury Tales, Andersen's Snow Queen; «Хмари», «Fata morgana», «Людина», «Boa constrictor», «Подорож ученого доктора Леонардо»), the title page as its own chapter (The Lost World, The Prince and the Pauper, The Canterbury Tales) or at the start of the text (Andersen; «Співомовки», «Москаль-чарівник»), and a few more: «CHAPTERXXVII» without a space in Pride and Prejudice, no PART in The Brothers Karamazov, untitled prologue parts and repeated headings in The Moonstone, chapters without numbers in Journey to the Centre of the Earth, a single chapter in The Yellow Wallpaper, the act heading repeated at the end of each act in «Глитай або ж Павук» · **мелочи в главах** — длинные главы разбиты на части по объёму, титул отдельной главой или в начале текста и ещё несколько мелочей у тех же книг.
- Shevchenko (Kobzar) and the 12 skipped Ukrainian books — find clean editions · Шевченко („Кобзар“) и 12 пропущенных украинских книг — найти чистые издания
