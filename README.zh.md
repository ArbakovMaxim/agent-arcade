<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Arcade 标志" align="right">

# Arcade — 在 Claude Code 智能体工作时，玩游戏、读书、收听和观看

[English](README.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [日本語](README.ja.md) · **中文** · [한국어](README.ko.md)

> **Beta 版（0.34）。** 这里介绍的一切都能正常使用，每天都有人在用；之后的变化主要在细节上。非常欢迎报告错误 — 见[反馈](#反馈)。

Arcade 是一个 [Claude Code](https://claude.com/claude-code) 插件，帮你打发智能体工作时的等待时间。当智能体忙碌超过 10 秒，提示符上方会出现一行小字 *“玩一会儿吗？”*。你可以玩游戏 — NES、Sega、PlayStation、Doom、国际象棋等等 — 读一本书，听有声书或播客，或者观看与智能体当前工作主题相关的视频。智能体一完成工作或需要你授权，Arcade 就会立刻告诉你，什么都不会错过。

目录中的一切都是免费的：游戏采用开放许可，书籍和有声书属于公有领域。你还可以和同样在等待智能体的其他人联网对战，并和好友聊天。

![智能体工作 11 秒后，Claude Code 提示符上方出现的“玩一会儿吗？”](docs/images/prompt.png)

## 功能

- **自动出现。** 智能体工作 10 秒后，Arcade 会在提示符上方推荐一款游戏；除非你要求，它绝不会抢走焦点。
- **了解智能体的状态。** 当智能体完成工作或请求授权时，游戏上方会出现横幅 — 继续玩、暂停，或直接返回智能体（具体行为在设置中选择）。在 Claude Desktop 中，它还可以关闭你正在观看的标签页，让对话重新回到你面前。
- **一个菜单，六个分区。** *开始游戏*、*阅读与收听*、*观看*、*社交*、*工作* 和 *更多* — 不需要的分区可以折叠。最上方是：*继续* 上一款游戏、*搜索* 和 *收藏*。第一次打开 Arcade 时，你可以选择要显示哪些分区。
- **61 款免费游戏**，涵盖 NES（Dendy）、Sega Mega Drive、Master System、PlayStation，以及包含街机、射击、竞速、策略、冒险和棋类游戏的 *游戏* 标签页。
- **阅读与收听。** 30 种语言的经典书籍和 LibriVox 有声书，直接来自 Project Gutenberg、Wikisource 和 LibriVox；还有与智能体工作主题相关的最新文章和播客节目。
- **观看。** 与智能体工作主题相关的最新 YouTube 视频，以及 Twitch：你自己的频道，和关于编程、科技、科学与复古游戏的直播。还有 TikTok：TikTok 官网上的 *“推荐”信息流* 和搜索（需要你自己登录）。
- **NES 和 Flappy Arcade 直接在 Claude Code 里运行** — 终端、VS Code 和 Claude Desktop 都可以。其他内容在浏览器窗口中打开；在 Claude Desktop 中默认使用 Claude 的内置浏览器（射击游戏仍在浏览器窗口中打开：内置浏览器无法捕获鼠标）。
- **联网对战。** 通过网络进行的双人主机游戏、Doom 死亡竞赛和合作模式，以及与真人或电脑对弈的国际象棋、围棋、跳棋和黑白棋。
- **“谁在线等待”。** 有人在等待对手时，Arcade 会在 Claude Code 中显示，并附带 *加入* 按钮。
- **好友与聊天。** 可选的 GitHub 登录让你在所有电脑上保持相同的设置，并获得一个 @用户名；通过准确的用户名添加好友，查看谁在线，邀请他们一起玩，进行一对一或群组聊天。
- **笔记本与项目看板。** 页面、子页面和清单，Claude 也能帮你记；通过 Claude 的连接器把页面发送到 Notion 或其他应用，或从那里导入；在 Claude 输入框中听写，再把文字移到页面上。带列和卡片的看板 — 与好友共享，大家就在同一块看板上协作。
- **搜索与收藏。** 一次搜索即可覆盖游戏和 Twitch 频道，结果按分区和类型分组；用 ☆ 标记游戏，即可保存到 *★ 收藏*。
- **你自己的游戏。** 添加你拥有的 ROM；它们只保存在你的电脑上。
- **13 种界面语言：** English、Русский、Українська、Español、Français、Deutsch、Português、Italiano、Polski、Türkçe、日本語、中文、한국어 — 根据系统或浏览器语言自动选择，默认英语。

## 安装

需要 **Claude Code 2.1.275 或更高版本**。

在终端中运行两条命令：先添加 Arcade 的插件市场（就是本仓库），再从中安装插件：

```
claude plugin marketplace add ArbakovMaxim/agent-arcade
claude plugin install arcade@agent-arcade
```

或者在 Claude Code 会话中：

```
/plugin marketplace add ArbakovMaxim/agent-arcade
/plugin install arcade@agent-arcade
```

插件会安装到所有会话和应用中。VS Code 扩展没有 `/plugin` 命令 — 请在终端中安装，扩展会在新对话中加载插件。

**更新：**

```
/plugin marketplace update agent-arcade
/plugin update arcade@agent-arcade
```

然后重启 Claude Code。插件市场只下载插件本身（几 MiB，不含网站），所以更新只需几秒。已经安装了 Arcade 的话无需任何操作：下次更新时插件市场会自动切换。

如果 `/plugin update` 显示 *already at the latest version*，但 Arcade 已经发布了新版本，说明插件市场没有刷新。在终端中运行 `claude plugin marketplace update agent-arcade` 可以看到原因。如果显示 *timed out*，就给克隆留出 10 分钟：

```
CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000 claude plugin marketplace update agent-arcade
```

PowerShell 中：`$env:CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000; claude plugin marketplace update agent-arcade`。然后再次运行 `/plugin update arcade@agent-arcade`。

**卸载：** `/plugin uninstall arcade@agent-arcade`

## 使用方法

- **`/arcade`** 随时打开菜单。
- 当智能体工作超过 10 秒，提示符上方会出现 *“玩一会儿吗？”*：**`1`** — 在这里（面板中）玩；**`2`** — 在浏览器窗口中（如果可用）；**`3`** — 现在不玩。
- 用方向键或 Tab 选择，Enter 打开；也可以使用鼠标。每款游戏下方都会显示操作方式。
- 当智能体完成工作或等待授权时，游戏上方会出现横幅：**返回智能体** 或 **继续玩**。

### 菜单

| 分区 | 内容 |
|---|---|
| *（最上方）* | **▶ 继续** 上一款游戏、**🔍 搜索**、**★ 收藏** |
| **开始游戏** | NES、Sega、Master System、PlayStation、游戏；有人在线等待时显示 *加入*；**我的游戏** |
| **阅读与收听** | 书籍、有声书、文章、播客 |
| **观看** | YouTube、Twitch、TikTok |
| **社交** | 好友、聊天、**使用 GitHub 登录**（登录后显示 **账户**） |
| **工作** | 笔记本、项目看板 |
| **更多** | Arcade 窗口、设置、🌐 语言、🐞 报告错误、☕ 支持本项目 |

点击分区标题即可折叠或展开。折叠的分区会显示 `▸` 和其中的磁贴数量，*社交* 还会显示新消息 💬 和好友请求 👥 的数量。Arcade 会记住你折叠了哪些分区。不需要的分区可以在 **设置** 中隐藏：它的标题和磁贴会从菜单中完全消失；包含设置的 *更多* 始终保留。登录后，菜单顶部会显示你的 @用户名和同样的计数。

**搜索** 从两个字符开始，匹配标题或类型，不区分大小写和重音符号。结果按分区和类型分组，例如 *游戏 · 射击*。游戏旁边的 ☆ 星标可将其加入 **★ 收藏**（最多 100 项），按分区和类型排列，最新添加的在前。书籍和有声书有自己的搜索，可按书名或作者查找。

### 在哪里打开

| | NES（Dendy）、Flappy Arcade | Sega、Master System、PlayStation、其他游戏；书籍、有声书、文章、播客、视频 |
|---|---|---|
| **终端** | 在面板中（终端支持时显示像素图形，否则显示文本块） | 浏览器窗口 |
| **VS Code** | 在面板中 | 浏览器窗口 |
| **Claude Desktop** | 在面板中 | Claude 的内置浏览器或浏览器窗口（在设置中选择）；射击游戏 — 始终在浏览器窗口中 |

浏览器窗口是一个独立的 Arcade 窗口（使用你的默认浏览器或在设置中选择的浏览器），不会混进你日常浏览的标签页里。聊天在终端和 Desktop 中都可以直接在面板里使用；选择 *在页面中打开* 会在网站上以同样的方式打开它们。笔记本和项目看板都在面板中。TikTok 在 Desktop 中用 Claude 的内置浏览器打开，在其他地方则用你的默认浏览器打开 — 你很可能已经在那里登录了。

## 目录

| 标签页 | 内容 |
|---|---|
| **NES（Dendy）** | 28 款自制游戏 — 平台跳跃、解谜、射击、竞速：Thwaite、Nova the Squirrel、Super Uwol、Lala the Magical 等 |
| **Sega** | 11 款 Mega Drive 游戏：Miniplanets、Tank Battle、Battle 4Tris、Pong 等 |
| **Master System** | 4 款游戏：Balloon Master、SkyHaul、Food Fighter、Escape from Monster Dimension |
| **PlayStation** | Hello Pong |
| **游戏 → 街机** | Flappy Arcade — Arcade 自己的单键游戏：可直接在面板和 Arcade 窗口中玩；每天的赛道对所有人相同，会保存你的最佳成绩 |
| **游戏 → 射击** | Freedoom Phase 1 和 2（Doom 的免费替代品）、FreeDM 死亡竞赛、Blasphemer（Heretic 的免费替代品）、BlasphDM 死亡竞赛、OpenArena（Quake III 引擎的竞技场射击游戏，与机器人对战，GPL-2.0） |
| **游戏 → 竞速** | HexGL — 未来风格的反重力竞速 |
| **游戏 → 策略** | OpenTTD — 运输大亨（GPL-2.0）；Micropolis — 1989 年经典城市建造游戏的开源代码，城市保存在浏览器中（micropolisJS，带附加条款的 GPL-3.0 和 Micropolis Public Name License）；Warzone 2100 — 即时战略游戏，有战役和对战电脑的遭遇战，单位由你自己设计，存档保存在浏览器中（GPL-2.0-or-later） |
| **游戏 → 冒险** | 在 ScummVM（GPL-3.0-or-later）中运行的四款 90 年代免费经典冒险游戏：Beneath a Steel Sky、Flight of the Amazon Queen、Lure of the Temptress 和 Nippon Safes, Inc. — 允许再分发的免费游戏数据；随时按 F5 存档 |
| **游戏 → 棋类** | 国际象棋 — 与真人或电脑（Stockfish，1–10 级）对弈，联网对局带棋钟；9×9、13×13 和 19×19 棋盘的围棋；俄罗斯跳棋、黑白棋；全部支持 *认输* |
| **书籍** | 30 种语言的公有领域经典作品——语言由你选择（默认是界面语言）。各语言的分区相同：热门、小说、诗歌、戏剧、冒险、侦探等；可按书名或作者搜索。列表按需从 Project Gutenberg 和 Wikisource 获取——Arcade 自己不存储任何书籍；打开过的书会保留在你浏览器的 *我的书籍* 中。书签自动保存：再次打开书，就会回到上次停下的地方。你自己的 EPUB、FB2 和 TXT 也可以在 Arcade 窗口中打开 |
| **有声书** | 同样语言和分区的 LibriVox 录音，并支持搜索：可以直接从 archive.org 在线收听，也可以把书下载到浏览器离线收听。Arcade 窗口中的播放器会记住章节、位置和播放速度；你自己的 MP3、M4A、M4B、OGG 和 Opus 文件也能在那里打开，并且只保留在你的浏览器中 |
| **文章** | 来自 106 个精选英语博客和媒体的最新文章 — Simon Willison、InfoQ、The Cloudflare Blog、Ars Technica、Krebs on Security 等 |
| **播客** | 65 档英语播客的最新节目 — Software Engineering Daily、Security Now、Talk Python To Me、Darknet Diaries 等；每一集都会记住你停在哪里 |
| **YouTube** | 来自 153 个精选频道的最新视频，涵盖 24 个方向，从 AI、Web 和 DevOps 到科学、太空和复古计算 |
| **Twitch** | *我的频道* — 通过名称或链接添加任意 Twitch 频道，正在直播的排在前面；*正在直播* 和 *完整目录* — 26 个精选英语频道，没有 18+ 频道；无需注册 |

每款游戏的卡片都链接到它的许可证和源代码。

**主题。** 文章、播客和 YouTube 从主题开始：Haiku 根据智能体正在做的工作推荐三个主题，再加上 *新品与发布会*。在 *自定义主题* 中，你可以用任何语言输入想看、想读或想听的内容；最近的五个主题会作为 *我的主题* 磁贴保留下来。

## 联网对战

- **主机游戏。** NES、Sega、Master System 和 PlayStation 上的双人游戏都有 **联网** 按钮：创建房间或加入别人的房间。输入通过 Arcade 的服务器逐帧同步。
- **Doom。** **FreeDM** 和 **BlasphDM** 是最多四名玩家、每轮 5 分钟的死亡竞赛大厅；**Freedoom** 和 **Blasphemer** 可以通过 **联网** 进行合作。新加入的玩家要等下一轮 — 引擎不允许中途加入正在进行的比赛。
- **棋类游戏。** *寻找对手*、通过链接 *邀请好友*，或 *人机对战*。对局保存在服务器上：走一步，回到智能体，稍后再打开链接 — 棋盘还在你离开时的样子。如果你用 @用户名登录，对手会在你的棋子颜色旁看到它。
- **谁在等待。** Arcade 每分钟检查一次是否有人在等待对手，并在 Claude Code 中显示 — 例如 *“玩一会儿吗？在线等待中：FreeDM (1)”* — 同时在菜单中显示 **加入** 按钮。

## 账户、好友和聊天

登录是可选的 — 不登录，其他一切照常可用。

- **使用 GitHub 登录**（在 *社交* 中）：GitHub 登录页会在你常用的浏览器中打开；在那里确认后，再在 Arcade 页面上点击 *Sign in* — 页面上的代码应与面板中的相同。如果通过浏览器登录不成功，请选 *用代码登录*：Arcade 显示一个代码，你在 GitHub 页面上输入它。Arcade 只会获得你的 GitHub 个人资料名称和头像 — 不会获得邮箱，也无法访问仓库。
- **同步。** 你的语言、按键、通知、面板大小、智能体发出信号时如何处理游戏、Desktop 中的浏览器选项、你的主题、Twitch 频道、收藏、折叠和隐藏的分区以及 Flappy Arcade 最佳成绩，会在你所有的电脑上保持一致。你自己的游戏、浏览器和图形模式则按电脑分别保存。
- **@用户名。** 一键使用你的 GitHub 名称，或自己起一个：4 到 32 个字符 — 拉丁字母、数字和 `_`。每天最多可以修改 5 次。
- **好友。** 通过准确的 @用户名添加好友：对方在自己那边接受请求后，你们就会出现在彼此的列表中。输入时没有任何建议，所以没人能借此浏览谁在使用 Arcade。拒绝和删除都不会通知对方。
- **在线状态与游戏邀请。** Arcade 菜单打开时，好友会看到你 *在线*，你也能看到他们；不想被看到，就在 *好友* 页面关闭 *向好友显示我在线*。好友旁边的 *邀请* 会列出联网游戏：棋类游戏会打开你们俩的专属房间，Doom 类游戏会打开它的大厅。游戏会立刻在你这边打开；好友会收到通知，并在菜单顶部看到 *接受*，邀请有效期 10 分钟。只有在联网游戏通过浏览器打开的地方才能邀请：Desktop 的内置浏览器或浏览器窗口。
- **聊天。** 与好友一对一聊天、好友群组，或一键创建包含所有好友的群组。直接在 Arcade 面板中写消息，或在网站上打开聊天页面。消息保存在 Arcade 的网站上，且没有加密 — 不要在其中写密码或密钥。
- **头像和消息通知。** 在 *账户* 中从 24 个现成头像里选一个，聊天只负责显示；没有头像时显示你的 @用户名的首字母。群组图片由群主从同样的 24 个中选择。你的 GitHub 头像永远不会展示给其他人。好友给你发消息时，左下角会在所有窗口之上弹出一张卡片（Windows），或显示系统通知（macOS、Linux）；点击卡片即可打开该聊天。
- **退出登录** 会停止这台电脑上的同步；**删除账户**（按两次）会让网站删除你和你的设置。

## 笔记本与项目看板

两者都在菜单的 *工作* 分区中。

- **笔记本。** 页面和子页面；以 `# ` 开头的行是标题，`- ` 是条目，`- [ ] ` 是清单项，按一下即可勾选。保存在这台电脑上 — 最多 200 个页面，每页最多 20,000 个字符。
- **Claude 也能记。** *交给 Claude* 会把页面交给 Claude，或者直接让 Claude 在 Arcade 里记点东西。Claude 使用 `mcp__arcade__notes` 工具，它只修改笔记本，不删除任何内容。如果不喜欢 Claude 的修改，可以按 *恢复 Claude 修改前的文字*。
- **Notion 和其他应用** — 通过 Claude 的连接器，所以 Arcade 不需要任何密钥或密码：*发送到 Notion*、*发到其他应用*、*从 Notion 或其他应用导入*。已关联的页面可以在应用中更新，也可以重新从应用导入。
- **语音。** 用系统自带的听写（Windows 上按 Win+H，macOS 上按两下 Fn）在 Claude 输入框中输入，然后按 *从 Claude 输入框取用* — 文字会移到页面末尾。
- **项目看板。** 列（*待办*、*进行中*、*已完成* 或自定义的列，最多 8 列）和卡片；卡片就是带文字和清单的笔记本页面。按一下卡片即可选中并用方向键移动，再按一次打开。Claude 也能管理看板：按 *交给 Claude*，或者让它把任务排到 Arcade 的看板上。
- **共享看板。** 用 @用户名登录后，勾选好友并按 *共享*：所有人的卡片、列和名称都一样，修改几秒内就会同步。所有者可以邀请更多好友、移除成员，并从网站上删除看板；任何人都可以退出；无论发生什么，每个人都会保留自己的一份副本。自己的共享看板最多 3 个，每块看板最多 20 人、200 张卡片。

## 你自己的游戏

- **`/arcade-add <文件>`** 添加 NES、Mega Drive 或 Master System 的 ROM（最大 4 MB）。插件会在 `~/.claude/arcade` 中保存一份副本，绝不上传。
- **PlayStation 光盘和 Doom WAD**（例如你自己拥有的 `doom.wad`） — 在 Arcade 窗口中：**打开自己的文件**。它们只保存在那个浏览器中。

请只添加你拥有相应权利的文件。

## 设置

在 `/arcade` 菜单的 *更多* 分区中打开 **设置**：

- **主菜单分区** — 显示或隐藏除 *更多* 以外的任意分区；隐藏的分区会从菜单中完全消失，直到你在这里把它恢复。第一次打开 Arcade 时也会让你做同样的选择。
- **语言** — 13 种之一（也可以直接在菜单中通过 🌐 切换）。
- **游戏打开方式** — 在这里（面板中）、在浏览器窗口中，或在指定的浏览器中；在 Claude Desktop 中 — Claude 的内置浏览器或浏览器窗口。
- **画面**（终端） — 在能显示图片的终端（kitty、Ghostty、Rio）中使用像素，其他地方使用文本块。
- **面板大小** — 普通或全宽。
- **智能体完成时** — 显示横幅并继续玩、暂停并显示横幅，或直接返回智能体。
- **智能体请求授权时** — 同样的三个选项。
- **打开浏览器时**（Claude Desktop） — 关闭 Arcade 菜单，让浏览器占满整个高度；或者把菜单保留在浏览器上方。
- **观看时智能体完成**（Claude Desktop） — 关闭 Arcade 为视频、直播、TikTok、文章或播客节目打开的标签页，让与 Claude 的对话重新回到你面前；或者只提醒你。
- **在窗口中游戏时通知。**
- **消息通知** — 好友在聊天中发消息时，左下角弹出卡片（macOS 和 Linux 上为系统通知）。
- **按键测试和按键重映射**（终端）。
- **条款与隐私** — 网站的使用条款和隐私政策，在你常用的浏览器中打开。

## 插件在你的电脑上做什么

Arcade 在 Claude Code 内部运行，拥有 Claude Code 给插件的权限。它的全部代码都在这个仓库里，`claude plugin validate ./mod` 会列出它挂接的每个事件和发出的每个调用。简单来说：

- **智能体的工具。** Arcade 能看到工具何时开始和结束、智能体何时请求授权 — 这样它才知道什么时候显示横幅。它从不修改或拦截智能体的工具调用。它自己只批准两类调用，而且只在 Claude Code 本来会询问你的时候：只修改笔记本、不删除任何内容的 `mcp__arcade__notes`，以及在你于面板中按下游戏后，在 Desktop 的内置浏览器中打开它。你的允许和拒绝规则照常生效。
- **中断智能体。** 仅在 Claude Desktop 中、智能体工作时你在内置浏览器里打开内容才会发生：Desktop 不允许插件自己打开浏览器。Arcade 会等当前工具结束（10 秒后会中断它，但只要屏幕上有授权请求就一直等），然后中断智能体，请 Claude 打开页面后继续工作。如果想避免这种情况，请在 *设置 → 游戏打开方式* 中选择浏览器窗口。
- **你的对话。** 为了推荐主题，你自己会话中的 Haiku 会收到对话的最后几千个字符；这会计入你的 Claude 用量。Arcade 的网站永远看不到对话。只有在你要求时（例如笔记本中的 *交给 Claude*），或者如上所述为了打开页面，Arcade 才会在输入框中写入或提交内容。
- **启动的程序。** 用于 Arcade 窗口的浏览器（在 Windows 上使用 `%LOCALAPPDATA%\claude-arcade` 中的独立配置文件）；通知 — Windows 上用 PowerShell，macOS 上用 `osascript`，Linux 上用 `notify-send`；检查装了哪些浏览器（Windows）或是什么系统（`uname`）。
- **文件。** 它只写入你用 `/arcade-add` 添加的 ROM，位置是 `~/.claude/arcade/roms`；只读取你指定的文件、这些副本和它自己的文件。设置、笔记本和收藏保存在 Claude Code 的插件存储中。
- **环境变量。** 读取 `HOME` 或 `USERPROFILE`、`LANG`、`LC_ALL`、`LC_MESSAGES`、`LOCALAPPDATA` 和 `OS`，不修改任何一个。
- **网络。** 插件本身只与 Arcade 的网站（`agent-arcade.fefaodessa.workers.dev`）、YouTube 频道的 RSS 订阅源，以及它展示的博客和播客的订阅源通信。Desktop 面板中的图片（例如 Twitch 头像）直接从这些服务加载。游戏、书籍和视频由你在浏览器中打开的页面加载。

## 隐私

详情见网站的[隐私政策](https://agent-arcade.fefaodessa.workers.dev/privacy)和[使用条款](https://agent-arcade.fefaodessa.workers.dev/terms)；在插件中位于 *设置 → 条款与隐私*。简而言之：

- 没有广告，没有分析，没有追踪。原本带有分析功能的游戏已将其移除（见每款游戏的 `NOTICE`）。
- 你自己的 ROM、WAD、书籍和音频文件绝不会离开你的电脑或浏览器。
- 书籍和有声书列表以及 Project Gutenberg 的书籍经由 Arcade 网站获取：网站从 Project Gutenberg、Wikisource 和 archive.org 取来，只保存在 Cloudflare 缓存中——列表六小时，书籍一周。Wikisource 页面和 LibriVox 录音由窗口直接从这些网站加载。
- 联网对战通过 Arcade 在 Cloudflare 上的服务器进行：消息只在房间内的玩家之间转发，不会保存 — 棋类游戏的走法除外，保存它们是为了让你可以回来继续；一个月无人动过的对局会被删除。
- 主题由 Haiku 在你自己的 Claude Code 会话中推荐；Arcade 的网站永远看不到你的对话 — 只有在你使用 *自定义主题* 时，才会收到一条简短的英语搜索查询。文章地址放在 `#` 之后，因此永远不会到达 Arcade 的服务器。
- *自定义主题* 的搜索经由 YouTube API Services，视频在 YouTube 自己的播放器中播放，因此 [YouTube 服务条款](https://www.youtube.com/t/terms)和 [Google 隐私权政策](https://policies.google.com/privacy)同样适用。最多 6 个视频由你自己会话中的 Haiku 根据标题和简短描述挑选；Arcade 的网站把搜索结果在共享缓存中保留一天。
- 登录后，网站会保存你同步的设置、收藏、@用户名、好友、聊天和共享看板，游戏邀请保存 10 分钟。谁在线只保存在内存中，持续一分半钟。会话密钥只发送到 Arcade 的网站。
- 笔记本保留在你的电脑上。共享看板和聊天一样保存在 Arcade 的网站上，且没有加密。只有在你要求时，页面才会通过你自己的 Claude 连接器发送到 Notion 或其他应用。
- 错误报告只包含你的文字、Arcade 版本、打开的位置、界面语言和操作系统 — 别无其他；未登录时以匿名方式发送，网站也不会保存任何地址。
- 部分游戏只有在你要求时才会访问互联网 — 例如 OpenTTD 的可选调查和它的 *Online Content* 按钮。

## 平台与状态

Arcade 处于 **beta** 阶段：功能已经齐全，工作继续集中在细节上 — 见[更新日志](CHANGELOG.md)。

- 已在 Windows、macOS 和 Linux 上实际验证。
- 可在终端、VS Code 和 Claude Desktop 中运行。

## 许可证

- **游戏：** 每款游戏都有自己的自由许可证（MIT、GPL、BSD、Apache、Creative Commons 等） — 许可证文本和源代码与游戏放在一起，并从其卡片链接。
- **书籍和有声书：** 公有领域；Arcade 不存储它们——书籍在你打开时从 Project Gutenberg 和 Wikisource 获取，录音来自 LibriVox（archive.org）。
- **模拟器和引擎：** JSNES（Apache-2.0）、EmulatorJS（GPL-3.0）及其核心、PrBoom（GPL-2.0）、Cloudflare 的 doom-wasm 和 Chocolate Doom/Heretic（GPL-2.0）、OpenTTD（GPL-2.0）、micropolisJS（带附加条款的 GPL-3.0）、ScummVM（GPL-3.0-or-later）、国际象棋电脑对手 Stockfish（GPL-3.0）。用于 Sega 和 Master System 的 Genesis Plus GX 核心仅限非商业用途。
- **Arcade 自己的代码**（插件和网站） — **GNU AGPL-3.0**（[LICENSE](LICENSE)），© 2026 Max Arbakov。你可以自由使用、研究和修改它。如果你分发修改后的版本 — 或将其作为在线服务提供给他人 — 必须以相同许可证公开你的全部源代码，并保留版权声明。第三方组件保留各自的许可证。

## 支持本项目

Arcade 是免费的。如果它让你的等待更有趣，你可以请项目喝杯咖啡 — 完全自愿：**[ko-fi.com/agentarcade](https://ko-fi.com/agentarcade)**。同样的链接也在 `/arcade` 菜单底部（*☕ 支持本项目*）和 Arcade 窗口中。Arcade 的任何功能都不依赖于此，它也绝不会打断游戏。

## 反馈

发现了错误？最快的方式是直接在 Arcade 中报告：**更多 → 🐞 报告错误**。描述出了什么问题，报告就会连同版本、运行环境、语言和操作系统一起直接发送给 Arcade 的作者。

你也可以提交 [issue](https://github.com/ArbakovMaxim/agent-arcade/issues) — 错误和想法都可以。请注明你的操作系统、Claude Code 运行环境（终端、VS Code 或 Desktop）以及游戏名称。

欢迎提交拉取请求。提交即表示你同意你的贡献以 AGPL-3.0 授权，并且作者也可以以其他条款（例如商业许可证）提供 Arcade。

## 面向开发者

```
mod/     Claude Code 插件（钩子、面板界面、测试）
site/    运行在 Cloudflare Workers 上的网站：目录、Arcade 窗口、联网房间、账户、好友、聊天、错误报告
tools/   构建辅助工具：翻译、heretic-wasm
.github/ 为浏览器构建 doom-wasm、heretic-wasm、OpenTTD 和 ScummVM 的 GitHub Actions
```

- 从仓库运行插件：`claude --plugin-dir ./mod`
- 插件测试：`claude plugin validate ./mod`，然后在 `mod/` 中运行 `claude plugin test`
- 网站测试：在 `site/` 中运行 `npm test`；构建：`node build.mjs`；通过 Cloudflare Workers Builds 从 `main` 自动部署。
- 开发在 `main` 上进行，Pull Request 也请提交到 `main`。默认分支 `plugin` 是去掉 `site/` 的 `main` 副本，每次推送时由 GitHub Action 更新：插件市场下载的是这个分支，而不是整个仓库。
- 翻译：`node tools/i18n/collect.mjs`，然后 `node tools/i18n/check.mjs` — 见 [tools/i18n/README.md](tools/i18n/README.md)。

详细文档（俄语）：[mod/README.md](mod/README.md) — 插件，[site/README.md](https://github.com/ArbakovMaxim/agent-arcade/tree/main/site/README.md) — 网站、添加游戏和联网对战。
