<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Arcade logo" align="right">

# Arcade — play, read, listen and watch while your Claude Code agent works

**English** · [Русский](README.ru.md) · [Українська](README.uk.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [한국어](README.ko.md)

> **Alpha (0.25).** Arcade works and is used every day, but it's an early version: things may break, and settings or the catalog may change between updates. Bug reports are very welcome — see [Feedback](#feedback).

Arcade is a plugin for [Claude Code](https://claude.com/claude-code) that fills the wait while your agent is working. When the agent has been busy for more than 10 seconds, a small *“play?”* appears above the prompt. Play a game — NES, Sega, PlayStation, Doom, chess and more — read a book, listen to an audiobook or a podcast, or watch a video on the topic of the agent's work. Arcade tells you the moment the agent finishes or needs your permission, so you never miss it.

Everything in the catalog is free: the games are openly licensed, the books and audiobooks are in the public domain. You can also play online with other people who are waiting for their agents too, and chat with your friends.

![“play?” above the Claude Code prompt after the agent has been working for 11 seconds](docs/images/prompt.png)

## Features

- **Appears on its own.** After 10 seconds of agent work, Arcade offers a game above the prompt; it never steals focus unless you ask it to.
- **Knows what the agent is doing.** When the agent finishes or asks for permission, you get a banner over the game — keep playing, pause, or jump straight back to the agent (you choose the behaviour in settings).
- **One menu, five sections.** *Play*, *Read & listen*, *Watch*, *Social* and *More* — fold the ones you don't need. On top: *Continue* the last game, *Search* and *Favorites*.
- **61 free games** across NES (Dendy), Sega Mega Drive, Master System, PlayStation and a *Games* tab with arcade games, shooters, racing, strategy, adventures and board games.
- **Read and listen.** 136 public-domain books, LibriVox audiobooks, and fresh articles and podcast episodes on the topic of the agent's work.
- **Watch.** Fresh YouTube videos on the topic of the agent's work, and Twitch: your own channels and live streams about coding, tech, science and retro games.
- **NES and Flappy Arcade right inside Claude Code** — in the terminal, VS Code and Claude Desktop. Everything else opens in a browser window — in Claude Desktop, in Claude's built-in browser by default (shooters still open in a browser window: the built-in browser can't capture the mouse).
- **Online play.** Two-player console games over the network, Doom deathmatch and co-op, chess, Go, draughts and reversi against people or the computer.
- **“Who's waiting online”.** Arcade shows in Claude Code when someone is waiting for a partner, with a *Join* button.
- **Friends and chats.** An optional GitHub sign-in keeps your settings the same on all your computers and gives you an @handle; add friends by their exact handle and chat one-on-one or in groups.
- **Search and favorites.** One search across games, books, audiobooks and Twitch channels, grouped by section and genre; mark anything with ☆ to keep it in *★ Favorites*.
- **Your own games.** Add ROMs you own; they stay on your machine.
- **13 interface languages:** English, Русский, Українська, Español, Français, Deutsch, Português, Italiano, Polski, Türkçe, 日本語, 中文, 한국어 — picked from your system or browser, English by default.

## Install

Requires **Claude Code 2.1.275 or newer**.

In a terminal — two commands: add Arcade's marketplace (this repository), then install the plugin from it:

```
claude plugin marketplace add ArbakovMaxim/agent-arcade
claude plugin install arcade@agent-arcade
```

Or inside a Claude Code session:

```
/plugin marketplace add ArbakovMaxim/agent-arcade
/plugin install arcade@agent-arcade
```

The plugin is installed for all sessions and apps. The VS Code extension has no `/plugin` command — install from a terminal, and the extension picks the plugin up in a new conversation.

**Update:**

```
/plugin marketplace update agent-arcade
/plugin update arcade@agent-arcade
```

**Uninstall:** `/plugin uninstall arcade@agent-arcade`

## How to use

- **`/arcade`** opens the menu at any time.
- When the agent works for more than 10 seconds, *“play?”* appears above the prompt: **`1`** — play here, in the panel; **`2`** — in a browser window (where available); **`3`** — not now.
- Arrow keys or Tab to choose, Enter to open; the mouse works too. Game controls are shown under each game.
- When the agent finishes or waits for permission, a banner appears over the game: **Back to agent** or **Keep playing**.

### The menu

| Section | What's inside |
|---|---|
| *(on top)* | **▶ Continue** the last game, **🔍 Search**, **★ Favorites** |
| **Play** | NES, Sega, Master System, PlayStation, Games; *Join* when someone is waiting online; **My games** |
| **Read & listen** | Books, Audiobooks, Articles, Podcasts |
| **Watch** | YouTube, Twitch |
| **Social** | Friends, Chats, **Sign in with GitHub** (or **Account** once you're signed in) |
| **More** | Arcade window, Settings, 🌐 language, 🐞 Report a bug, ☕ Support the project |

Press a section's title to fold or unfold it. A folded section shows `▸` and how many tiles it holds, and *Social* also shows new messages 💬 and friend requests 👥. Arcade remembers which sections you folded. Signed in, the menu header shows your @handle with the same counters.

**Search** starts from two letters and matches a title, an author or a genre, ignoring case and accents. Results are grouped by section and genre, like *Books · Detective* or *Games · Shooter*. The ☆ star next to a game, book or audiobook adds it to **★ Favorites** (up to 100), laid out by section and genre with the latest first.

### Where things open

| | NES (Dendy), Flappy Arcade | Sega, Master System, PlayStation, other Games; books, audiobooks, articles, podcasts, videos |
|---|---|---|
| **Terminal** | in the panel (pixel graphics where the terminal supports them, otherwise text blocks) | browser window |
| **VS Code** | in the panel | browser window |
| **Claude Desktop** | in the panel | Claude's built-in browser, or a browser window (pick in settings); shooters — always a browser window |

The browser window is a separate Arcade window (your default browser or the one you pick in settings), not a tab in your everyday browsing. Chats work right in the panel in the terminal and in Desktop; *Open as a page* opens them on the site the same way.

## The catalog

| Tab | What's inside |
|---|---|
| **NES (Dendy)** | 28 homebrew games — platformers, puzzles, shooters, racing: Thwaite, Nova the Squirrel, Super Uwol, Lala the Magical and more |
| **Sega** | 11 Mega Drive games: Miniplanets, Tank Battle, Battle 4Tris, Pong and more |
| **Master System** | 4 games: Balloon Master, SkyHaul, Food Fighter, Escape from Monster Dimension |
| **PlayStation** | Hello Pong |
| **Games → Arcade games** | Flappy Arcade — Arcade's own one-button game: plays right in the panel and in the Arcade window; the course of the day is the same for everyone, your best score is kept |
| **Games → Shooters** | Freedoom Phase 1 and 2 (free Doom replacements), FreeDM deathmatch, Blasphemer (free Heretic replacement), BlasphDM deathmatch |
| **Games → Racing** | HexGL — futuristic anti-gravity racing |
| **Games → Strategy** | OpenTTD — transport tycoon (GPL-2.0); Micropolis — the open-source code of the classic 1989 city builder, your city is saved in the browser (micropolisJS, GPL-3.0 with additional terms and the Micropolis Public Name License) |
| **Games → Adventures** | Four free classic 90s adventures in ScummVM (GPL-3.0-or-later): Beneath a Steel Sky, Flight of the Amazon Queen, Lure of the Temptress and Nippon Safes, Inc. — freeware game data with permission to redistribute; save at any moment with F5 |
| **Games → Board games** | Chess — against people or the computer (Stockfish, levels 1–10), online with clocks; Go on 9×9, 13×13 and 19×19 boards; Russian draughts, Reversi; *Resign* in all of them |
| **Books** | 136 public-domain classics on language shelves, by genre: 98 in English (Austen, Dickens, Twain, Conan Doyle, Wells, Shelley, Tolstoy and Dostoyevsky in translation…) and 38 in Ukrainian (Franko, Lesya Ukrainka, Kotsiubynsky, Kotliarevsky, Kulish…). The bookmark is set automatically: open a book again and you're back where you stopped. Your own EPUB, FB2 and TXT open in the Arcade window |
| **Audiobooks** | Public-domain recordings from LibriVox on language shelves, by genre: Oscar Wilde and O. Henry in English, Gogol in Ukrainian. The player in the Arcade window remembers where you stopped; your own MP3, M4A, M4B, OGG and Opus files open there too and stay in your browser |
| **Articles** | Fresh articles from 106 curated English-language blogs and publications — Simon Willison, InfoQ, The Cloudflare Blog, Ars Technica, Krebs on Security and more |
| **Podcasts** | Fresh episodes of 65 English-language podcasts — Software Engineering Daily, Security Now, Talk Python To Me, Darknet Diaries and more; an episode remembers where you stopped |
| **YouTube** | Fresh videos from 153 curated channels across 24 directions, from AI, web and DevOps to science, space and retro computing |
| **Twitch** | *My channels* — any Twitch channel by name or link, live ones first; *Live now* and *Full catalog* — 26 curated English-language channels, no 18+ channels; no sign-up needed |

Each game's card links to its license and source code.

**Topics.** Articles, Podcasts and YouTube start with topics: Haiku suggests three about what the agent is working on, plus *Launches and keynotes*. Under *Your own topic* you can type what you want to watch, read or listen to, in any language; your last five topics stay as *My topics* tiles.

## Online play

- **Consoles.** Two-player games on NES, Sega, Master System and PlayStation have an **Online** button: create a room or join someone's. Inputs are synchronised frame by frame through Arcade's server.
- **Doom.** **FreeDM** and **BlasphDM** are deathmatch lobbies with 5-minute rounds for up to four players; **Freedoom** and **Blasphemer** have co-op via **Online**. Newcomers wait for the next round — the engine doesn't allow joining a match in progress.
- **Board games.** *Find an opponent*, *Invite a friend* by link, or *Against the computer*. The game is stored on the server: make a move, go back to your agent, open the link later — the board is where you left it. Signed in with an @handle, your opponent sees it next to your colour.
- **Who's waiting.** Once a minute Arcade checks whether anyone is waiting for a partner and shows it in Claude Code — for example *“play? Waiting online: FreeDM (1)”* — with a **Join** button in the menu.

## Account, friends and chats

Signing in is optional — without it everything else works as before.

- **Sign in with GitHub** (in *Social*): Arcade shows a code, you enter it on GitHub's page in your regular browser. Arcade learns only your GitHub profile name and picture — no email, no access to repositories.
- **Sync.** Your language, keys, notifications, panel size, what to do with the game when the agent signals, your topics, Twitch channels, favorites, folded sections and Flappy Arcade best become the same on all your computers. Your own games, the browser and the graphics mode stay per computer.
- **@handle.** Take your GitHub name in one click or make up your own: 4 to 32 characters — Latin letters, digits and `_`. You can change it up to 5 times a day.
- **Friends.** Add a friend by their exact @handle: they accept the request on their side, and you appear in each other's lists. There are no suggestions as you type, so nobody can browse who is on Arcade. Declining and removing are silent.
- **Chats.** One-on-one with a friend, groups of friends, or a group with all your friends in one press. Write right in the Arcade panel or open the chats page on the site. Messages are stored on Arcade's site and are not encrypted — don't write passwords or keys there.
- **Sign out** stops syncing on this computer; **Delete account** (press twice) makes the site forget you and your settings.

## Your own games

- **`/arcade-add <file>`** adds a NES, Mega Drive or Master System ROM (up to 4 MB). The plugin keeps a copy in `~/.claude/arcade` and never uploads it.
- **PlayStation discs and Doom WADs** (for example a `doom.wad` you own) — in the Arcade window: **Open your own file**. They stay in that browser only.

Only add files you have the rights to.

## Settings

Open **Settings** in the *More* section of the `/arcade` menu:

- **Language** — one of 13 (also right in the menu: 🌐).
- **Open games** — here in the panel, in a browser window, or in a specific browser; in Claude Desktop — in Claude's built-in browser or in a browser window.
- **Graphics** (terminal) — pixels in terminals that show images (kitty, Ghostty, Rio), text blocks everywhere.
- **Panel size** — normal or full width.
- **When the agent finishes** — banner and keep playing, pause with a banner, or straight back to the agent.
- **When the agent asks for permission** — the same three options.
- **Notifications while playing in the window.**
- **Key test and key remapping** (terminal).

## Privacy

- No ads, no analytics, no tracking. Games that came with analytics had it removed (see each game's `NOTICE`).
- Your own ROMs, WADs, books and audiobook files never leave your machine or browser.
- Online play goes through Arcade's server on Cloudflare: messages are relayed between players in a room and not stored — except moves of board games, which are kept so you can come back; a game untouched for a month is deleted.
- Topics are suggested by Haiku in your own Claude Code session; Arcade's site never sees your conversation — only a short English search query when you use *Your own topic*. An article's address goes after `#`, so it never reaches Arcade's server.
- Signed in, the site keeps your synced settings, favorites, @handle, friends and chats. The session key goes only to Arcade's site.
- A bug report carries your text, the Arcade version, where it is open, the interface language and the OS — nothing else; without signing in it goes unsigned, and the site keeps no address.
- Some games can reach the internet only when you ask them to — for example OpenTTD's optional survey and its *Online Content* button.

## Platforms and status

Arcade is in **alpha** and under active development — see the [changelog](CHANGELOG.md).

- Checked live on Windows, macOS and Linux.
- Works in the terminal, in VS Code and in Claude Desktop.

## Licenses

- **Games:** every game has its own free license (MIT, GPL, BSD, Apache, Creative Commons and others) — the license text and source live next to the game and are linked from its card.
- **Books and audiobooks:** public domain — English books from Project Gutenberg, Ukrainian ones from Wikisource, recordings from LibriVox; each book has a `LICENSE.txt` with its source.
- **Emulators and engines:** JSNES (Apache-2.0), EmulatorJS (GPL-3.0) with its cores, PrBoom (GPL-2.0), doom-wasm by Cloudflare and Chocolate Doom/Heretic (GPL-2.0), OpenTTD (GPL-2.0), micropolisJS (GPL-3.0 with additional terms), ScummVM (GPL-3.0-or-later), Stockfish (GPL-3.0) — the chess computer. The Genesis Plus GX core used for Sega and Master System is for non-commercial use only.
- **Arcade's own code** (the plugin and the site) — **GNU AGPL-3.0** ([LICENSE](LICENSE)), © 2026 Max Arbakov. You are free to use, study and change it. If you distribute a modified version — or run it as an online service for other people — you must publish your full source code under the same license and keep the copyright notices. Third-party components keep their own licenses.

## Support the project

Arcade is free. If it makes your waits more fun, you can buy the project a coffee — entirely voluntary: **[ko-fi.com/agentarcade](https://ko-fi.com/agentarcade)**. The same link is at the bottom of the `/arcade` menu (*☕ Support the project*) and in the Arcade window. Nothing in Arcade depends on it, and it never interrupts a game.

## Feedback

Found a bug? The quickest way is right in Arcade: **More → 🐞 Report a bug**. Describe what broke, and the report goes straight to the author of Arcade with the version, the surface, the language and the OS.

You can also open an [issue](https://github.com/ArbakovMaxim/agent-arcade/issues) — for bugs and for ideas. Please mention your OS, your Claude Code surface (terminal, VS Code or Desktop) and the game.

Pull requests are welcome. By sending one you agree that your contribution is licensed under AGPL-3.0 and that the author may also offer Arcade under other terms (for example, a commercial license).

## For developers

```
mod/     the Claude Code plugin (hooks, panel UI, tests)
site/    the website on Cloudflare Workers: catalog, Arcade window, network rooms, accounts, friends, chats, bug reports
tools/   build helpers: books, audiobooks, translations, heretic-wasm
.github/ GitHub Actions that build doom-wasm, heretic-wasm, OpenTTD and ScummVM for the browser
```

- Run the plugin from the repository: `claude --plugin-dir ./mod`
- Plugin tests: `claude plugin validate ./mod`, then `claude plugin test` in `mod/`
- Site tests: `npm test` in `site/`; build: `node build.mjs`; deploy happens automatically from `main` via Cloudflare Workers Builds.
- Books: `node tools/books/build.mjs` downloads and cleans the catalog books (list — `tools/books/books.json`).
- Translations: `node tools/i18n/collect.mjs`, then `node tools/i18n/check.mjs` — see [tools/i18n/README.md](tools/i18n/README.md).

Detailed documentation (in Russian): [mod/README.md](mod/README.md) — the plugin, [site/README.md](site/README.md) — the site, adding games and network play.
