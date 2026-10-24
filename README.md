<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Arcade logo" align="right">

# Arcade — play, read, listen and watch while your Claude Code agent works

**English** · [Русский](README.ru.md) · [Українська](README.uk.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [한국어](README.ko.md)

> **Alpha (0.26).** Arcade works and is used every day, but it's an early version: things may break, and settings or the catalog may change between updates. Bug reports are very welcome — see [Feedback](#feedback).

Arcade is a plugin for [Claude Code](https://claude.com/claude-code) that fills the wait while your agent is working. When the agent has been busy for more than 10 seconds, a small *“play?”* appears above the prompt. Play a game — NES, Sega, PlayStation, Doom, chess and more — read a book, listen to an audiobook or a podcast, or watch a video on the topic of the agent's work. Arcade tells you the moment the agent finishes or needs your permission, so you never miss it.

Everything in the catalog is free: the games are openly licensed, the books and audiobooks are in the public domain. You can also play online with other people who are waiting for their agents too, and chat with your friends.

![“play?” above the Claude Code prompt after the agent has been working for 11 seconds](docs/images/prompt.png)

## Features

- **Appears on its own.** After 10 seconds of agent work, Arcade offers a game above the prompt; it never steals focus unless you ask it to.
- **Knows what the agent is doing.** When the agent finishes or asks for permission, you get a banner over the game — keep playing, pause, or jump straight back to the agent (you choose the behaviour in settings). In Claude Desktop it can also close the tab you're watching, so the conversation is back in front of you.
- **One menu, six sections.** *Play*, *Read & listen*, *Watch*, *Social*, *Work* and *More* — fold the ones you don't need. On top: *Continue* the last game, *Search* and *Favorites*.
- **61 free games** across NES (Dendy), Sega Mega Drive, Master System, PlayStation and a *Games* tab with arcade games, shooters, racing, strategy, adventures and board games.
- **Read and listen.** Classic books and LibriVox audiobooks in 30 languages, straight from Project Gutenberg, Wikisource and LibriVox, plus fresh articles and podcast episodes on the topic of the agent's work.
- **Watch.** Fresh YouTube videos on the topic of the agent's work, Twitch: your own channels and live streams about coding, tech, science and retro games, and TikTok: the *For You* feed and search on TikTok's own site, where you sign in yourself.
- **NES and Flappy Arcade right inside Claude Code** — in the terminal, VS Code and Claude Desktop. Everything else opens in a browser window — in Claude Desktop, in Claude's built-in browser by default (shooters still open in a browser window: the built-in browser can't capture the mouse).
- **Online play.** Two-player console games over the network, Doom deathmatch and co-op, chess, Go, draughts and reversi against people or the computer.
- **“Who's waiting online”.** Arcade shows in Claude Code when someone is waiting for a partner, with a *Join* button.
- **Friends and chats.** An optional GitHub sign-in keeps your settings the same on all your computers and gives you an @handle; add friends by their exact handle, see who is online, invite them to a game, and chat one-on-one or in groups.
- **Notebook and project boards.** Pages, subpages and checklists that Claude keeps too; send a page to Notion or another app, or bring one in, through Claude's connectors; dictate into Claude's prompt box and move the text onto a page. Boards with columns and cards — share one with friends, and everyone works on the same board.
- **Search and favorites.** One search across games and Twitch channels, grouped by section and genre; mark a game with ☆ to keep it in *★ Favorites*.
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

Then restart Claude Code. The marketplace downloads only the plugin — a few MiB, without the site — so updating takes seconds. If Arcade is already installed, there's nothing to do: the marketplace switches over by itself on the next update.

If `/plugin update` says *already at the latest version* but a newer Arcade is out, the marketplace didn't refresh. Run `claude plugin marketplace update agent-arcade` in a terminal to see why. If it says *timed out*, give the clone 10 minutes:

```
CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000 claude plugin marketplace update agent-arcade
```

In PowerShell: `$env:CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000; claude plugin marketplace update agent-arcade`. Then run `/plugin update arcade@agent-arcade` again.

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
| **Watch** | YouTube, Twitch, TikTok |
| **Social** | Friends, Chats, **Sign in with GitHub** (or **Account** once you're signed in) |
| **Work** | Notebook, Project board |
| **More** | Arcade window, Settings, 🌐 language, 🐞 Report a bug, ☕ Support the project |

Press a section's title to fold or unfold it. A folded section shows `▸` and how many tiles it holds, and *Social* also shows new messages 💬 and friend requests 👥. Arcade remembers which sections you folded. A section you don't need can be hidden in **Settings**: it is gone from the menu entirely, title and tiles; *More*, which holds the settings, always stays. Signed in, the menu header shows your @handle with the same counters.

**Search** starts from two letters and matches a title or a genre, ignoring case and accents. Results are grouped by section and genre, like *Games · Shooter*. The ☆ star next to a game adds it to **★ Favorites** (up to 100), laid out by section and genre with the latest first. Books and audiobooks have their own search by title or author.

### Where things open

| | NES (Dendy), Flappy Arcade | Sega, Master System, PlayStation, other Games; books, audiobooks, articles, podcasts, videos |
|---|---|---|
| **Terminal** | in the panel (pixel graphics where the terminal supports them, otherwise text blocks) | browser window |
| **VS Code** | in the panel | browser window |
| **Claude Desktop** | in the panel | Claude's built-in browser, or a browser window (pick in settings); shooters — always a browser window |

The browser window is a separate Arcade window (your default browser or the one you pick in settings), not a tab in your everyday browsing. Chats work right in the panel in the terminal and in Desktop; *Open as a page* opens them on the site the same way. The notebook and project boards live in the panel. TikTok opens in Claude's built-in browser in Desktop and in your default browser elsewhere, where you are likely signed in already.

## The catalog

| Tab | What's inside |
|---|---|
| **NES (Dendy)** | 28 homebrew games — platformers, puzzles, shooters, racing: Thwaite, Nova the Squirrel, Super Uwol, Lala the Magical and more |
| **Sega** | 11 Mega Drive games: Miniplanets, Tank Battle, Battle 4Tris, Pong and more |
| **Master System** | 4 games: Balloon Master, SkyHaul, Food Fighter, Escape from Monster Dimension |
| **PlayStation** | Hello Pong |
| **Games → Arcade games** | Flappy Arcade — Arcade's own one-button game: plays right in the panel and in the Arcade window; the course of the day is the same for everyone, your best score is kept |
| **Games → Shooters** | Freedoom Phase 1 and 2 (free Doom replacements), FreeDM deathmatch, Blasphemer (free Heretic replacement), BlasphDM deathmatch, OpenArena — arena shooter on the Quake III engine against bots (GPL-2.0) |
| **Games → Racing** | HexGL — futuristic anti-gravity racing |
| **Games → Strategy** | OpenTTD — transport tycoon (GPL-2.0); Micropolis — the open-source code of the classic 1989 city builder, your city is saved in the browser (micropolisJS, GPL-3.0 with additional terms and the Micropolis Public Name License); Warzone 2100 — real-time strategy with a campaign and skirmish against the computer, you design your own units, saves stay in the browser (GPL-2.0-or-later) |
| **Games → Adventures** | Four free classic 90s adventures in ScummVM (GPL-3.0-or-later): Beneath a Steel Sky, Flight of the Amazon Queen, Lure of the Temptress and Nippon Safes, Inc. — freeware game data with permission to redistribute; save at any moment with F5 |
| **Games → Board games** | Chess — against people or the computer (Stockfish, levels 1–10), online with clocks; Go on 9×9, 13×13 and 19×19 boards; Russian draughts, Reversi; *Resign* in all of them |
| **Books** | Public-domain classics in 30 languages — you pick the language (it starts with the interface language). Sections are the same for every language: Popular, Fiction, Poetry, Drama, Adventure, Detective stories and more; search by title or author. The list comes from Project Gutenberg and Wikisource on demand — Arcade keeps no books of its own; a book you open stays in *My books* in your browser. The bookmark is set automatically: open a book again and you're back where you stopped. Your own EPUB, FB2 and TXT open in the Arcade window too |
| **Audiobooks** | LibriVox recordings in the same languages and sections, with search: listen online straight from archive.org, or download a book to your browser to listen offline. The player in the Arcade window remembers the chapter, the place and the speed; your own MP3, M4A, M4B, OGG and Opus files open there too and stay in your browser |
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
- **Sync.** Your language, keys, notifications, panel size, what to do with the game when the agent signals, the Desktop browser options, your topics, Twitch channels, favorites, folded and hidden sections and Flappy Arcade best become the same on all your computers. Your own games, the browser and the graphics mode stay per computer.
- **@handle.** Take your GitHub name in one click or make up your own: 4 to 32 characters — Latin letters, digits and `_`. You can change it up to 5 times a day.
- **Friends.** Add a friend by their exact @handle: they accept the request on their side, and you appear in each other's lists. There are no suggestions as you type, so nobody can browse who is on Arcade. Declining and removing are silent.
- **Online and game invitations.** While the Arcade menu is open, your friends see you as *online*, and you see them; to stay unseen, turn off *Show friends that I am online* on the *Friends* screen. *Invite* next to a friend offers the online games: a board game opens a private room for two, a Doom game its lobby. The game opens for you at once; your friend gets a notification and *Accept* at the top of the menu, and the invitation is valid for 10 minutes. You can invite where online games open in a browser — the built-in one in Desktop or a browser window.
- **Chats.** One-on-one with a friend, groups of friends, or a group with all your friends in one press. Write right in the Arcade panel or open the chats page on the site. Messages are stored on Arcade's site and are not encrypted — don't write passwords or keys there.
- **Avatars and message notifications.** Pick one of 24 ready-made avatars in *Account* — chats only show it; without one, the first letter of your @handle. A group’s owner picks its picture from the same 24. Your GitHub picture is never shown to others. When a friend writes, a card pops up in the bottom left on top of all windows (Windows) or a system notification appears (macOS, Linux); a click on the card opens that chat.
- **Sign out** stops syncing on this computer; **Delete account** (press twice) makes the site forget you and your settings.

## Notebook and project boards

Both are in the *Work* section of the menu.

- **Notebook.** Pages and subpages; a line starting with `# ` is a heading, `- ` an item, `- [ ] ` a checklist item that ticks with a press. It is kept on this computer — up to 200 pages, 20,000 characters on a page.
- **Claude keeps it too.** *Give to Claude* passes a page to Claude, or just ask Claude to write something down in Arcade. Claude uses the `mcp__arcade__notes` tool, which changes only the notebook and deletes nothing. If you don't like Claude's edit, *Restore the text from before Claude's edit*.
- **Notion and other apps** — through Claude's connectors, so Arcade needs no keys or passwords: *Send to Notion*, *To another app*, *Import from Notion or another app*. A linked page can be updated in the app or imported again from it.
- **Voice.** Dictate into Claude's prompt box with the system's own dictation (Win+H on Windows, Fn twice on macOS), then press *Take from Claude's prompt box* — the text moves to the end of the page.
- **Project board.** Columns — *To do*, *Doing*, *Done* or your own, up to 8 — and cards; a card is a notebook page with text and a checklist. Press a card to pick it and move it with the arrows, press again to open it. Claude can run a board too: *Give to Claude*, or ask it to lay out tasks on a board in Arcade.
- **Shared boards.** Signed in with a @handle, tick friends and press *Share*: everyone has the same cards, columns and name, and changes show up within seconds. The owner invites more friends, removes people and deletes the board from the site; anyone can leave; whatever happens, everyone keeps their own copy. Up to 3 shared boards of your own, 20 people and 200 cards on a board.

## Your own games

- **`/arcade-add <file>`** adds a NES, Mega Drive or Master System ROM (up to 4 MB). The plugin keeps a copy in `~/.claude/arcade` and never uploads it.
- **PlayStation discs and Doom WADs** (for example a `doom.wad` you own) — in the Arcade window: **Open your own file**. They stay in that browser only.

Only add files you have the rights to.

## Settings

Open **Settings** in the *More* section of the `/arcade` menu:

- **Main menu sections** — show or hide any section except *More*; a hidden section is gone from the menu entirely until you bring it back here.
- **Language** — one of 13 (also right in the menu: 🌐).
- **Open games** — here in the panel, in a browser window, or in a specific browser; in Claude Desktop — in Claude's built-in browser or in a browser window.
- **Graphics** (terminal) — pixels in terminals that show images (kitty, Ghostty, Rio), text blocks everywhere.
- **Panel size** — normal or full width.
- **When the agent finishes** — banner and keep playing, pause with a banner, or straight back to the agent.
- **When the agent asks for permission** — the same three options.
- **When the browser opens** (Claude Desktop) — close the Arcade menu so the browser gets the full height, or keep the menu above it.
- **Agent finished while you watch** (Claude Desktop) — close the tab Arcade opened for a video, a stream, TikTok, an article or an episode, so the chat with Claude is in front of you again, or just let you know.
- **Notifications while playing in the window.**
- **Message notifications** — a card in the bottom left when a friend writes in a chat (a system notification on macOS and Linux).
- **Key test and key remapping** (terminal).

## Privacy

- No ads, no analytics, no tracking. Games that came with analytics had it removed (see each game's `NOTICE`).
- Your own ROMs, WADs, books and audiobook files never leave your machine or browser.
- Book and audiobook lists and Project Gutenberg books come through Arcade's site, which fetches them from Project Gutenberg, Wikisource and archive.org and keeps them only in Cloudflare's cache — lists for six hours, a book for a week. Wikisource pages and LibriVox recordings the window loads straight from those sites.
- Online play goes through Arcade's server on Cloudflare: messages are relayed between players in a room and not stored — except moves of board games, which are kept so you can come back; a game untouched for a month is deleted.
- Topics are suggested by Haiku in your own Claude Code session; Arcade's site never sees your conversation — only a short English search query when you use *Your own topic*. An article's address goes after `#`, so it never reaches Arcade's server.
- Signed in, the site keeps your synced settings, favorites, @handle, friends, chats and shared boards, and game invitations for 10 minutes. Who is online it holds only in memory, for a minute and a half. The session key goes only to Arcade's site.
- The notebook stays on your computer. Shared boards are stored on Arcade's site and are not encrypted, like chats. Pages go to Notion or another app only when you ask, through your own Claude connectors.
- A bug report carries your text, the Arcade version, where it is open, the interface language and the OS — nothing else; without signing in it goes unsigned, and the site keeps no address.
- Some games can reach the internet only when you ask them to — for example OpenTTD's optional survey and its *Online Content* button.

## Platforms and status

Arcade is in **alpha** and under active development — see the [changelog](CHANGELOG.md).

- Checked live on Windows, macOS and Linux.
- Works in the terminal, in VS Code and in Claude Desktop.

## Licenses

- **Games:** every game has its own free license (MIT, GPL, BSD, Apache, Creative Commons and others) — the license text and source live next to the game and are linked from its card.
- **Books and audiobooks:** public domain; Arcade does not store them — books come from Project Gutenberg and Wikisource, recordings from LibriVox (archive.org), at the moment you open them.
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
tools/   build helpers: translations, heretic-wasm
.github/ GitHub Actions that build doom-wasm, heretic-wasm, OpenTTD and ScummVM for the browser
```

- Run the plugin from the repository: `claude --plugin-dir ./mod`
- Plugin tests: `claude plugin validate ./mod`, then `claude plugin test` in `mod/`
- Site tests: `npm test` in `site/`; build: `node build.mjs`; deploy happens automatically from `main` via Cloudflare Workers Builds.
- Work happens in `main`, and pull requests go there too. The default branch `plugin` is a copy of `main` without `site/` that a GitHub Action updates on every push: the plugin marketplace downloads it instead of the whole repository.
- Translations: `node tools/i18n/collect.mjs`, then `node tools/i18n/check.mjs` — see [tools/i18n/README.md](tools/i18n/README.md).

Detailed documentation (in Russian): [mod/README.md](mod/README.md) — the plugin, [site/README.md](site/README.md) — the site, adding games and network play.
