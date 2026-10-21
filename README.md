<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Arcade logo" align="right">

# Arcade — games while your Claude Code agent works

**English** · [Русский](README.ru.md)

> **Alpha (0.9.0).** Arcade works and is used every day, but it's an early version: things may break, and settings or the catalog may change between updates. Bug reports are very welcome — see [Feedback](#feedback).

Arcade is a plugin for [Claude Code](https://claude.com/claude-code) that fills the wait while your agent is working. When the agent has been busy for more than 10 seconds, a small *“play?”* appears above the prompt. Pick a game — NES, Sega, PlayStation, Doom, chess and more — and Arcade tells you the moment the agent finishes or needs your permission, so you never miss it.

Every game in the catalog is free and openly licensed. You can also play online with other people who are waiting for their agents too.

![“play?” above the Claude Code prompt after the agent has been working for 11 seconds](docs/images/prompt.png)

## Features

- **Appears on its own.** After 10 seconds of agent work, Arcade offers a game above the prompt; it never steals focus unless you ask it to.
- **Knows what the agent is doing.** When the agent finishes or asks for permission, you get a banner over the game — keep playing, pause, or jump straight back to the agent (you choose the behaviour in settings).
- **54 free games** across NES (Dendy), Sega Mega Drive, Master System, PlayStation and a *Games* tab with shooters, racing, strategy and board games.
- **NES right inside Claude Code** — in the terminal, VS Code and Claude Desktop. Everything else opens in a browser window — in Claude Desktop, in Claude's built-in browser by default (shooters still open in a browser window: the built-in browser can't capture the mouse).
- **Online play.** Two-player console games over the network, Doom deathmatch and co-op, chess, draughts and reversi against people or the computer.
- **“Who's waiting online”.** Arcade shows in Claude Code when someone is waiting for a partner, with a *Join* button.
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

- **`/arcade`** opens the menu at any time. **🌐** in the menu opens the list of languages, each written in its own language.
- When the agent works for more than 10 seconds, *“play?”* appears above the prompt: **`1`** — play here, in the panel; **`2`** — in a browser window (where available); **`3`** — not now.
- Arrow keys or Tab to choose, Enter to open; the mouse works too. Game controls are shown under each game.
- When the agent finishes or waits for permission, a banner appears over the game: **Back to agent** or **Keep playing**.

### Where games run

| | NES (Dendy) | Sega, Master System, PlayStation, Games |
|---|---|---|
| **Terminal** | in the panel (pixel graphics where the terminal supports them, otherwise text blocks) | browser window |
| **VS Code** | in the panel | browser window |
| **Claude Desktop** | in the panel | Claude's built-in browser, or a browser window (pick in settings); shooters — always a browser window |

The browser window is a separate Arcade window (your default browser or the one you pick in settings), not a tab in your everyday browsing.

## The catalog

| Tab | What's inside |
|---|---|
| **NES (Dendy)** | 28 homebrew games — platformers, puzzles, shooters, racing: Thwaite, Nova the Squirrel, Super Uwol, Lala the Magical and more |
| **Sega** | 11 Mega Drive games: Miniplanets, Tank Battle, Battle 4Tris, Pong and more |
| **Master System** | 4 games: Balloon Master, SkyHaul, Food Fighter, Escape from Monster Dimension |
| **PlayStation** | Hello Pong |
| **Games → Shooters** | Freedoom Phase 1 and 2 (free Doom replacements), FreeDM deathmatch, Blasphemer (free Heretic replacement), BlasphDM deathmatch |
| **Games → Racing** | HexGL — futuristic anti-gravity racing |
| **Games → Strategy** | OpenTTD — transport tycoon |
| **Games → Board games** | Chess, Russian draughts, Reversi |
| **Books** | 136 public-domain classics: 98 in English (Austen, Dickens, Twain, Conan Doyle, Wells, Shelley, Tolstoy and Dostoyevsky in translation…) and 38 in Ukrainian (Franko, Lesya Ukrainka, Kotsiubynsky, Kotliarevsky, Kulish…). The bookmark is set automatically: open a book again and you're back where you stopped. Your own EPUB, FB2 and TXT open in the Arcade window |

Each game's card links to its license and source code.

## Online play

- **Consoles.** Two-player games on NES, Sega, Master System and PlayStation have an **Online** button: create a room or join someone's. Inputs are synchronised frame by frame through Arcade's server.
- **Doom.** **FreeDM** and **BlasphDM** are deathmatch lobbies with 5-minute rounds for up to four players; **Freedoom** and **Blasphemer** have co-op via **Online**. Newcomers wait for the next round — the engine doesn't allow joining a match in progress.
- **Board games.** *Find an opponent*, *Invite a friend* by link, or *Against the computer*. The game is stored on the server: make a move, go back to your agent, open the link later — the board is where you left it.
- **Who's waiting.** Once a minute Arcade checks whether anyone is waiting for a partner and shows it in Claude Code — for example *“play? Waiting online: FreeDM (1)”* — with a **Join** button in the menu.

## Your own games

- **`/arcade-add <file>`** adds a NES, Mega Drive or Master System ROM (up to 4 MB). The plugin keeps a copy in `~/.claude/arcade` and never uploads it.
- **PlayStation discs and Doom WADs** (for example a `doom.wad` you own) — in the Arcade window: **Open your own file**. They stay in that browser only.

Only add files you have the rights to.

## Settings

Open **Settings** in the `/arcade` menu:

- **Language** — one of 13 (also right in the main menu: 🌐).
- **Open games** — here in the panel, in a browser window, or in a specific browser; in Claude Desktop — in Claude's built-in browser or in a browser window.
- **Panel size** — normal or full width.
- **When the agent finishes** — banner and keep playing, pause with a banner, or straight back to the agent.
- **When the agent asks for permission** — the same three options.
- **Notifications while playing in the window.**
- **Key test and key remapping** (terminal).

## Privacy

- No ads, no analytics, no tracking. Games that came with analytics had it removed (see each game's `NOTICE`).
- Your own ROMs and WADs never leave your machine or browser.
- Online play goes through Arcade's server on Cloudflare: messages are relayed between players in a room and not stored — except moves of board games, which are kept so you can come back; a game untouched for a month is deleted.
- Some games can reach the internet only when you ask them to — for example OpenTTD's optional survey and its *Online Content* button.

## Platforms and status

Arcade is in **alpha** and under active development — see the [changelog](CHANGELOG.md).

- Checked live on Windows, macOS and Linux · проверено вживую на Windows, macOS и Linux

## Licenses

- **Games:** every game has its own free license (MIT, GPL, BSD, Apache, Creative Commons and others) — the license text and source live next to the game and are linked from its card.
- **Emulators and engines:** JSNES (Apache-2.0), EmulatorJS (GPL-3.0) with its cores, PrBoom (GPL-2.0), doom-wasm by Cloudflare and Chocolate Doom/Heretic (GPL-2.0), OpenTTD (GPL-2.0). The Genesis Plus GX core used for Sega and Master System is for non-commercial use only.
- **Arcade's own code** (the plugin and the site) — **GNU AGPL-3.0** ([LICENSE](LICENSE)), © 2026 Max Arbakov. You are free to use, study and change it. If you distribute a modified version — or run it as an online service for other people — you must publish your full source code under the same license and keep the copyright notices. Third-party components keep their own licenses.

## Support the project

Arcade is free. If it makes your waits more fun, you can buy the project a coffee — entirely voluntary: **[ko-fi.com/agentarcade](https://ko-fi.com/agentarcade)**. The same link is at the bottom of the `/arcade` menu (*☕ Support the project*) and in the Arcade window. Nothing in Arcade depends on it, and it never interrupts a game.

## Feedback

Found a bug or have an idea? Open an [issue](https://github.com/ArbakovMaxim/agent-arcade/issues). Please mention your OS, your Claude Code surface (terminal, VS Code or Desktop) and the game.

Pull requests are welcome. By sending one you agree that your contribution is licensed under AGPL-3.0 and that the author may also offer Arcade under other terms (for example, a commercial license).

## For developers

```
mod/     the Claude Code plugin (hooks, panel UI, tests)
site/    the website on Cloudflare Workers: catalog, Arcade window, network rooms
tools/   build helpers (heretic-wasm)
.github/ GitHub Actions that build doom-wasm, heretic-wasm and OpenTTD for the browser
```

- Run the plugin from the repository: `claude --plugin-dir ./mod`
- Plugin tests: `claude plugin validate ./mod`, then `claude plugin test` in `mod/`
- Site tests: `npm test` in `site/`; build: `node build.mjs`; deploy happens automatically from `main` via Cloudflare Workers Builds.
- Books: `node tools/books/build.mjs` downloads and cleans the catalog books (list — `tools/books/books.json`).
- Translations: `node tools/i18n/collect.mjs`, then `node tools/i18n/check.mjs` — see [tools/i18n/README.md](tools/i18n/README.md).

Detailed documentation (in Russian): [mod/README.md](mod/README.md) — the plugin, [site/README.md](site/README.md) — the site, adding games and network play.
