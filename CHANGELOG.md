# Changelog · Список изменений

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
