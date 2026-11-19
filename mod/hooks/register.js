// Arcade — пробная игровая платформа в Claude Code: вопрос «сыграть?», панель с библиотекой игр и Денди.
// Правило мода: каждый обработчик событий Claude Code только наблюдает и всегда возвращает next(e).
// Требования проверки модов: обработчик в on(...) — сама функция, а $ всегда пишется как $.ui.open(...) и т. п.
// Каталог плагинов Anthropic разрешает передавать $ только функции, объявленной на верхнем уровне того же файла, поэтому
// весь код, который зовёт Claude Code, — в этом файле, разделами: помощники (app/…), экраны панели (screens/…) и в конце
// подписки на события. Состояние и значки — в hooks/app/, чистые модули без $ (каталог, переводы, ленты и т. п.) — рядом, в hooks/.
import { ALERT_GAP_MS, ALERT_GATHER_MS, ALERT_HOLD_S, ALERTS_KEY, alertKey, alertText, alertWhat, keepTold, restoreAlerts, seenOf } from './alerts.js'
import { accountUrl, HANDLE, normalHandle, parseAvatar, parseDone, parseFriends, parseHandle, parseInvite, parseMe, parsePoll, parsePulse, parseSettings, parseStart, parseWeb, restoreAccount, restoreStamps, suggestHandle, SYNC_KEYS, syncPlan } from './account.js'
import { coverSvg, FLAGS, flagSvg, iconSvg, OFF_COLOR } from './app/icons.js'
import { ACTIONS, ARCADE_VERSION, ARROWS, ASK_AFTER_CHOICES, cal, CALENDAR_TOOL_NAME, CHAT_SHOWN, COLS, CUT_TOOL_MS, DEBUG, DEFAULT_COLOR, emptyBooks, emptyReads, FAV_LIMIT, feedCache, FIELD, finder, FLOOR_COLOR, GRAPHICS, GRAPHICS_LABEL, HIDEABLE, HOLD_TICKS_FIRST, HOLD_TICKS_REPEAT, IME_CHARS, INPUT, LAUNCH_TIMEOUT_MS, MAX_IMAGE_COLUMNS, MAX_SYMBOL_COLUMNS, nb, NO_CHATS, NO_DESKS, NO_FRIENDS, NO_MSG_MENU, NO_REPORTS, noOnline, NOTE_LINES, NOTES_TOOL_NAME, NOTIFY_AFTER_MS, NOTIFY_WINDOW_MS, PANE, PANE_COLUMNS, PANE_ROWS, PIXEL_DENIES, PLAYER_COLOR, PLUGIN_NAME, pr, REMOTE_MAX_WIDTH, REMOTE_MAX_WIDTH_WIDE, restoreKeymap, ROM_CACHE_LIMIT, ROWS, rssCache, S, savedKeys, searchCache, SECTION_ICONS, SECTION_NOTES, SECTION_SWITCH, SECTIONS, SIGNAL_LABELS, SIGNAL_MODES, TICK_MS, UI_ROWS, unfolded, WIDE_COLUMNS } from './app/state.js'
import { AVATAR_COUNT, avatarName, avatarSvg, letterColor, picSvg, validPic } from './avatars.js'
import { BOOK_LANGS, BOOK_SECTIONS, BOOK_SOURCES, bookLang, bookQuery, booksPath, MIN_BOOK_QUERY, parseBooks } from './books.js'
import { clipboardCommand, DETECT_ARGV, launchCommand, notifyCommand, openUrlCommand, parseDetection, windowBounds } from './browsers.js'
import { addDays, addEvent, addMonths, ALL_DAY_HOUR, applyCalendarTool, between, CALENDAR_TOOL, cardDues, colorOf, COLORS, compareEvents, dayKey, DEFAULT_COLOR as CAL_COLOR, dueReminders, dueTasks, GIVE_KEY, GIVE_KINDS, giveTargets, markAlerted, markTask, MISSED_MS, monthGrid, nextReminder, parseRemind, quickParse, REMIND_CHOICES, REMIND_CHOICES_ALL_DAY, remindAt, removeEvent, REPEATS, restoreCalendar, startOf, updateEvent, weekday } from './calendar.js'
import { bundledRom, minePageUrl, pageUrl, parseCatalog, restoreCatalog, SITE, siteUrl, tabPageUrl, verifyRom } from './catalog.js'
import { cleanText, clock, day, describe, fill, MAX_NAME, MAX_TEXT, oneLine, parseChat, parseChats, parseLink, parseMessages, parseSent, parseUnread, when } from './chats.js'
import { addLog, chatText, daySummary, noteChanges, restoreLog, summaryBody } from './daylog.js'
import { adoptBoard, applySync, cardId, colId, detachBoard, freshBase, MAX_MEMBERS, parseBoard, parseBoardDone, parseBoards, planSync, restoreDesks } from './desks.js'
import { find, FIND_LIMIT, MIN_QUERY, restoreFavorites, toggleIn } from './find.js'
import { createFlappy } from './flappy.js'
import { detectLang, isKept, keep, LANG_NAMES, LANGS, tr, translateTree } from './i18n.js'
import { LOGO_SVG } from './logo.js'
import { cleanPath, CONSOLE_NAMES, identifyRom, MINE_MAX_BYTES, mineId, restoreMine, sha256Hex, titleFromPath } from './mine.js'
import { Controller, createNes, frameToPng, frameToQuadrants, frameToSvg, screenSize } from './nes-screen.js'
import { addColumn, addPage, appendText, applyNotesTool, checkStats, cleanBody, cleanTitle, COL_NAMES, columnCards, columnOf, fits, isBoard, isProjectBoard, isPrompts, latestEdits, MAX_APP, MAX_BODY, MAX_URL, mergeText, moveCard, noteLines, NOTES_TOOL, notesOrder, PROMPT_COLS, PROMPTS_COL, rebaseNotes, removeColumn, removePage, renameColumn, restoreNotes, taskLink, toggleLine, trackerTask, updateCard, updatePage } from './notes.js'
import { avatarXaml, keepPopped, letterXaml, popupChats, popupCommand, restorePopped } from './popup.js'
import { MAX_REPORT, parseClosed, parseReports, parseReportSent, reportBody } from './reports.js'
import { bundledFeeds, itemStats, listenUrl, parseFeeds, parseItems, readsPrompt, readUrl } from './rss.js'
import { feedLanguage, freshFound, mix, ownTopic, ownTopicPrompt, parseOwnTopic, parseSearch, plainTopic, rememberTopic, restoreMyTopics, SEARCH_SHOWS, searchUrl, showFeed } from './search.js'
import { liveFirst, liveStatus, liveUrl, MY_CHANNELS, parseTwitch, rememberChannel, restoreTwitch, TOPIC_TITLES, twitchLogin, twitchUrl } from './twitch.js'
import { bundledChannels, candidates, channelsFor, choose, clean, contextFrom, feedUrl, parseChannels, parseFeed, parsePicks, parseTopics, PICKS, picksPrompt, topicsPrompt, videoBlurb, videoMeta, videoStats, watchUrl } from './youtube.js'

// ━━━━━━━━━━ app/status ━━━━━━━━━━
// Arcade: состояние агента для шапки и полосы над вводом, журнал событий, время, кто ждёт в сети.

function clockTime() {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}

export function log(text) {
  S.events = [`${clockTime()} ${text}`, ...S.events].slice(0, 6)
}

export function consoleTitle(id) {
  return S.catalog.consoles.find((c) => c.id === id)?.title ?? CONSOLE_NAMES[id] ?? id
}

const WINDOW_NOTICE_MS = 15_000

// Сообщение про окно браузера («… открыт в Google Chrome») — на время: что окно закрыли, мод узнать не может,
// и через минуту такое сообщение уже неправда. Убираем его, если за это время его не сменило другое.
export function windowNotice($, text) {
  S.libraryNotice = text
  $.clock.after(WINDOW_NOTICE_MS, () => {
    if (S.libraryNotice === text) {
      S.libraryNotice = ''
      $.ui.invalidate('ui.render')
    }
  })
}

export const LOBBIES_EVERY_MS = 60_000

// Сводка сайта «кто ждёт» → игры каталога: номер игры EmulatorJS — из хеша ROM, как в окне; Doom — лобби FreeDM
export function waitingFrom(data) {
  const list = []
  for (const g of S.catalog.games) {
    let count = 0
    let variants = []
    if (g.net === 'doom') count = Number(data?.doom) || 0
    else if (g.net === 'heretic-dm') count = Number(data?.dm?.[g.id]) || 0 // BlasphDM
    else if (g.net === 'heretic') count = Number(data?.coop?.[g.id]) || 0 // Blasphemer по сети — кооператив
    else if (g.console === 'doom') count = Number(data?.coop?.[g.id]) || 0 // кооператив Freedoom
    else if (g.kind === 'board') {
      // настольные: у каждого варианта своё лобби — «chess-7» (7 минут), «chess-0» (без таймера), «go-9» (доска 9×9)
      variants = Object.entries(data?.board ?? {})
        .filter(([k]) => k === g.id || k.startsWith(`${g.id}-`))
        .map(([k, v]) => ({ key: k.slice(g.id.length + 1), count: Number(v) || 0 }))
        .filter((v) => v.count > 0)
      count = variants.reduce((n, v) => n + v.count, 0)
    }
    else if (['nes', 'sega', 'sms', 'psx'].includes(g.console) && g.rom?.sha256) count = Number(data?.games?.[parseInt(g.rom.sha256.slice(0, 7), 16)]) || 0
    if (count > 0) list.push({ id: g.id, title: g.title, console: g.console, coop: g.console === 'doom' && g.net !== 'doom' && g.net !== 'heretic-dm', count, ...(variants.some((v) => v.key) ? { variants } : {}) })
  }
  return list.sort((a, b) => b.count - a.count)
}

// Вариант партии: го — размер доски, остальное — контроль времени в минутах (0 — без таймера)
function variantLabel(id, key) {
  if (id === 'go' && /^\d+$/.test(key)) return `${key}×${key}`
  if (key === '0') return 'без таймера'
  return /^\d+$/.test(key) ? `${key} мин` : key
}

export function waitingText() {
  return S.netWaiting
    .slice(0, 2)
    .map((w) => (w.variants ? `${w.title}: ${w.variants.map((v) => `${variantLabel(w.id, v.key)} — ${v.count}`).join(', ')}` : `${w.title} (${w.count})`))
    .join(', ')
}

export function paneColumns() {
  return S.wide ? WIDE_COLUMNS : PANE_COLUMNS
}

export function workedSeconds(now) {
  return Math.max(0, Math.round((now - S.turnStartedAt) / 1000))
}

// Длинный текст — не длиннее max знаков, по границе слова и с многоточием; короткий — как есть
export function clip(text, max) {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:\-–—|]+$/, '')}…`
}

// Сколько работает агент — по-человечески: «48 с», «2 мин 14 с», «1 ч 5 мин»
export function workedText(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return `${s} с`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return m ? `${h} ч ${m} мин` : `${h} ч`
  const rest = s % 60
  return rest ? `${m} мин ${rest} с` : `${m} мин`
}

export function statusText(now) {
  if (S.status === 'working') return `Агент работает ${workedText(workedSeconds(now))}`
  if (S.status === 'permission') return S.ask?.kind === 'question' ? 'Агент задал вопрос — Esc, чтобы ответить' : 'Агент ждёт разрешения — Esc, чтобы ответить'
  if (S.status === 'done') return 'Агент закончил — Esc, чтобы вернуться'
  if (S.status === 'background') return `Агент работает в фоне · агентов: ${S.bg.n}`
  return 'Агент свободен'
}

export function plural(n, one, few, many) {
  const tens = n % 100
  const units = n % 10
  if (tens >= 11 && tens <= 14) return many
  if (units === 1) return one
  if (units >= 2 && units <= 4) return few
  return many
}

// ━━━━━━━━━━ app/later ━━━━━━━━━━
// Arcade: «Не сейчас» у строки «сыграть?» — отложить её на 5 или 10 минут или до перезапуска Claude. Отсрочка общая для
// всех сессий этого компьютера и на сайт не уходит: файл ~/.claude/arcade/ask-later.json — { v: 1, until } (до какого
// времени) или { v: 1, launch } (до перезапуска: id запуска Claude, в котором отложили); { v: 1 } — не отложено
// (удалять файлы мод не умеет). Запуск Claude — файл ~/.claude/arcade/ask-later-run.json { v: 1, id, at }: его переписывает
// сессия, которая стартовала, когда других открытых сессий нет (по отметкам app/agents). Перезагрузка мода — не запуск

export const LATER_READ_MS = 5_000 // файлы отсрочки и запуска перечитываем не чаще — их могли поменять другие сессии
export const LATER_MINUTES = [5, 10] // на сколько минут отложить — кнопки второго шага

// dir — папка ~/.claude/arcade (null — домашней папки нет: отсрочка только в памяти этой сессии); until — до какого
// времени отложено; launch — id запуска, до конца которого отложено; current — id нынешнего запуска (из ask-later-run.json);
// readAt — когда перечитывали; reading — чтение, которое идёт сейчас; writes — растёт с каждой записью: чтение, начатое
// до записи, её не откатит
S.later = { dir: null, until: 0, launch: '', current: '', readAt: -Infinity, reading: null, writes: 0 }

const laterPath = () => `${S.later.dir}${S.sep}ask-later.json`
const launchPath = () => `${S.later.dir}${S.sep}ask-later-run.json`
const newId = (now) => `${Math.floor(now).toString(36)}${Math.random().toString(36).slice(2, 8)}`

// Прочитать файл: null — его нет, undefined — битый (его как раз пишут) — прежнее не забываем
async function readJson($, path) {
  const text = await $.fs.read(path).catch(() => null)
  if (text === null || text === undefined) return null
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' && v.v === 1 ? v : undefined
  } catch {
    return undefined
  }
}

// Папка отсрочки — из session.start, когда узнали домашнюю папку
export function startLater(home) {
  S.later = { dir: null, until: 0, launch: '', current: '', readAt: -Infinity, reading: null, writes: 0 }
  if (home) S.later.dir = [home.replace(/[\\/]+$/, ''), '.claude', 'arcade'].join(S.sep)
}

async function readLater($) {
  const L = S.later
  const writes = L.writes
  const [later, launch] = await Promise.all([readJson($, laterPath()), readJson($, launchPath())])
  if (writes !== L.writes) return
  if (later !== undefined) {
    L.until = Number(later?.until) || 0
    L.launch = typeof later?.launch === 'string' ? later.launch : ''
  }
  if (launch !== undefined) L.current = typeof launch?.id === 'string' ? launch.id : ''
}

// Отложена ли строка сейчас: файлы перечитываем не чаще LATER_READ_MS, одно чтение за раз
export async function laterOn($, now) {
  const L = S.later
  if (L.dir && now - L.readAt >= LATER_READ_MS) {
    L.readAt = now
    L.reading ??= readLater($)
      .catch((err) => log(`отсрочка «сыграть?»: ${err?.message ?? err}`))
      .finally(() => {
        L.reading = null
      })
    await L.reading
  }
  return laterUntil(now) !== 0
}

// До какого времени отложено, как знаем сейчас: время, Infinity — до перезапуска Claude, 0 — не отложено
export function laterUntil(now) {
  const L = S.later
  if (L.launch && L.launch === L.current) return Infinity
  return L.until > now ? L.until : 0
}

// Отложить: kind — минуты (LATER_MINUTES) или 'restart' — до перезапуска Claude
export async function laterSet($, kind) {
  const L = S.later
  const now = await $.clock.now()
  L.writes++
  if (kind === 'restart') {
    if (L.dir) {
      // Запуска ещё нет в файле (отметок нет или их не успели прочитать) — этот запуск и есть первый
      const launch = await readJson($, launchPath())
      if (typeof launch?.id === 'string' && launch.id) L.current = launch.id
      else if (launch === null || !L.current) {
        L.current = newId(now)
        await $.fs.write(launchPath(), JSON.stringify({ v: 1, id: L.current, at: now }))
      }
    } else L.current ||= newId(now)
    L.until = 0
    L.launch = L.current
  } else {
    L.until = now + Number(kind) * 60_000
    L.launch = ''
  }
  L.readAt = now
  if (L.dir) await $.fs.write(laterPath(), JSON.stringify(L.launch ? { v: 1, launch: L.launch } : { v: 1, until: L.until }))
}

// Вернуть строку — из настроек
export async function laterClear($) {
  const L = S.later
  L.writes++
  L.until = 0
  L.launch = ''
  L.readAt = await $.clock.now()
  if (L.dir) await $.fs.write(laterPath(), JSON.stringify({ v: 1 }))
}

// Запуск Claude — из app/agents, когда сессия впервые занимает место для отметки. first — других открытых сессий нет и
// своей свежей отметки нет (это не перезагрузка мода): Claude только что запустили — новый id запуска, и отсрочка «до
// перезапуска» кончается во всех сессиях. Иначе запуск тот же: берём его id из файла (файла нет — заводим)
export async function launchCheck($, now, first) {
  const L = S.later
  if (!L.dir) return
  try {
    const launch = first ? null : await readJson($, launchPath())
    if (typeof launch?.id === 'string' && launch.id) {
      L.current = launch.id
      return
    }
    // Битый — его пишет соседняя сессия, которая стартовала вместе с этой: её id и возьмём при следующем чтении
    if (launch === undefined) return
    L.writes++
    L.current = newId(now)
    await $.fs.write(launchPath(), JSON.stringify({ v: 1, id: L.current, at: now }))
    log('новый запуск Claude')
  } catch (err) {
    log(`запуск Claude: ${err?.message ?? err}`)
  }
}

// ━━━━━━━━━━ app/agents ━━━━━━━━━━
// Arcade: сессии Claude Code на этом компьютере — вкладка «Агенты» и очередь доски на несколько сессий. Каждая сессия
// держит отметку — маленький файл в ~/.claude/arcade/agents/: кто она, в какой папке, что делает, какую карточку взяла.
// Отметки читает только этот компьютер, на сайт они не уходят. Сессия, которая давно не обновляла отметку, — закрыта.
// Удалять файлы мод не умеет, поэтому мест (файлов) — AGENT_SLOTS, и каждое место сессия сперва занимает: пишет в него
// отметку, выжидает и перечитывает — как и карточку очереди (claimCard)

export const AGENT_TICK_MS = 2_500 // шаг: своя отметка, а когда нужно — и чужие
export const AGENT_WRITE_MS = 15_000 // ничего не поменялось — отметку всё равно обновить раз в столько
export const AGENT_READ_MS = 5_000 // вкладки нет на экране, а всплывашки включены — чужие отметки раз в столько
export const AGENT_TTL_MS = 45_000 // отметка старше — сессию закрыли или она упала: в списке её нет
export const CLAIM_MS = 1_000 // заявив место или карточку, столько выжидаем и перечитываем: не заявил ли кто раньше
export const CLAIM_TRIES = 8 // столько раз подряд проиграть заявку — и сдаться
export const DONE_HOLD_MS = 5_000 // сделанную карточку отметка держит ещё столько: другие сессии успеют увидеть её сделанной
export const AGENT_SLOTS = 32 // мест для отметок: столько сессий разом
export const HIDDEN_MAX = 64 // скрытых сессий помним не больше стольких — последних

// on — отметки работают (есть домашняя папка и id сессии); ready — место slot моё; files — что лежит в местах:
// { sig, rec, bad }; seen — какое состояние каждой чужой сессии уже видели (для всплывашек), null — ещё ни разу не читали
S.ag = null
S.agNotify = true // всплывашка «Сессия «…» ждёт разрешения» — настройка agentsNotify
S.agDone = false // всплывашка «В сессии «…» Claude закончил ход» — настройка agentsDone
S.agOs = true // о том же — системное уведомление поверх всех окон (alerts.js) — настройка agentsOs
S.agSound = true // у него звук: «ждёт тебя» и «закончил» — разные — настройка agentsSound
// pending — события для уведомления: ключ → { key, sid, seen, name, what, at }; busy — объявление в пути
S.al = { pending: new Map(), busy: false }
S.agHidden = [] // id сессий, скрытых крестиком во вкладке «Агенты»: их нет в списке и нет всплывашек о них — agentsHidden

const STATUS_ORDER = { permission: 0, done: 1, working: 2, background: 2, idle: 3 }
// background — главный ход кончился, а агенты, запущенные из него, ещё работают (app/background)
export const STATUS_LABEL = { permission: 'ждёт разрешения', done: 'закончил ход', working: 'работает', background: 'работает в фоне', idle: 'свободна' }
// Работает сам или его агенты в фоне — одна работа: «с каких пор» не сбрасывается, когда Claude просыпается от их конца
const busy = (status) => status === 'working' || status === 'background'

const base = (p) => String(p ?? '').split(/[\\/]+/).filter(Boolean).pop() ?? ''
const norm = (p) => String(p ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
export const samePath = (a, b) => Boolean(a) && norm(a) === norm(b)
const slotPath = (slot) => `${S.ag.dir}${S.sep}s${slot}.json`

// Запустить отметки — из session.start. Нет домашней папки или id сессии — их нет: очередь идёт по-старому, одна
export async function startAgents($, home) {
  const old = S.ag
  S.ag = { on: false, dir: '', sid: '', name: '', path: '', slot: 0, ready: false, status: S.status, since: 0, wrote: 0, sent: '', read: 0, sig: '', files: {}, seen: null, card: null, doneAt: 0, claim: null, joinWarn: '', chain: Promise.resolve(), taking: null, ticking: false, launched: false, look: old?.look ?? 0 }
  if (!home) return
  try {
    const ag = S.ag
    ag.sid = await $.session.id()
    const root = (await $.session.root().catch(() => '')) || (await $.session.cwd())
    const repo = await $.session.repo().catch(() => null)
    ag.path = root
    ag.name = base(root) || root
    // Сессия в git worktree: папка у неё случайная — впереди имя самого репозитория
    if (repo?.root && !samePath(repo.root, root)) ag.name = `${base(repo.root)}/${ag.name}`
    ag.dir = [home.replace(/[\\/]+$/, ''), '.claude', 'arcade', 'agents'].join(S.sep)
    ag.since = await $.clock.now()
    if (old?.card) ag.card = old.card
    ag.on = Boolean(ag.sid && ag.path)
  } catch (err) {
    S.ag.on = false
    log(`отметки сессий выключены: ${err?.message ?? err}`)
  }
}

// Записи — по одной, в том порядке, в каком их просили: поздняя отметка не обгонит раннюю
function enqueue(fn) {
  const ag = S.ag
  const chained = ag.chain.then(fn)
  ag.chain = chained.catch(() => {})
  return chained
}

// Моя отметка — как сейчас; at — когда записана
function recordOf(at) {
  const ag = S.ag
  const q = S.queue
  return {
    v: 1,
    sid: ag.sid,
    name: ag.name,
    path: ag.path,
    status: ag.status,
    bg: ag.status === 'background' ? S.bg.n : 0,
    since: ag.since,
    at,
    card: ag.card,
    queue: q ? { board: q.board, n: q.given.length, of: q.of ?? 0, started: q.started ?? 0 } : null,
    claim: ag.claim,
    ask: S.ask ?? null,
    usage: usageOf(),
    changes: ag.changes ?? null,
    look: ag.look || 0,
  }
}
// Замер лимитов и контекста этой сессии (app/usage) — для чужих «Агентов» и «Лимитов»
const usageOf = () => {
  const u = S.us?.me
  return u ? { ctx: u.ctx, usd: u.usd, limits: u.limits, at: u.at } : null
}
const bodyOf = (rec) => JSON.stringify({ ...rec, at: 0 })

// Записать свою отметку в своё место; true — записана, false — места нет
function put($) {
  return enqueue(async () => {
    const ag = S.ag
    if (!ag.on || !ag.ready) return false
    const at = await $.clock.now()
    const rec = recordOf(at)
    await $.fs.write(slotPath(ag.slot), JSON.stringify(rec))
    ag.wrote = at
    ag.sent = bodyOf(rec)
    return true
  })
}

// Разобрать отметку: пустая или битая — null (её как раз пишут, или запись оборвалась)
function parse(text) {
  if (!text) return null
  try {
    const rec = JSON.parse(text)
    return rec && typeof rec === 'object' && rec.v === 1 ? rec : null
  } catch {
    return null
  }
}
const live = (rec, now) => Boolean(rec?.sid) && !rec.left && now - rec.at < AGENT_TTL_MS

// Прочитать места. reread — каждое заново (для заявок), иначе — только поменявшиеся. Возвращает false, если какое-то
// свежее место прочитать не удалось: его как раз пишут — заявке такого чтения мало
async function readSlots($, now, reread = false) {
  const ag = S.ag
  const entries = await $.fs.list(ag.dir).catch(() => []) // папки ещё нет — никого нет
  let sure = true
  for (const ent of entries) {
    const m = /^s(\d+)\.json$/.exec(ent.name)
    const slot = m ? Number(m[1]) : 0
    if (!slot || slot > AGENT_SLOTS || ent.kind !== 'file') continue
    const sig = `${ent.mtimeMs}:${ent.size}`
    const old = ag.files[slot]
    if (!reread && old && old.sig === sig) continue
    // Своё место, пока оно моё, не перечитываем: что в нём, мы знаем
    if (!reread && ag.ready && slot === ag.slot && old) continue
    const text = await $.fs.read(slotPath(slot)).catch(() => null)
    const rec = parse(text)
    // Пусто или битое, а файл свежий — его пишут сейчас: прежнее не забываем, а заявка пусть попробует ещё раз
    if (!rec && text !== null && now - ent.mtimeMs < AGENT_TTL_MS) {
      sure = false
      ag.files[slot] = { sig: '', rec: old?.rec ?? null }
      continue
    }
    ag.files[slot] = { sig, rec }
  }
  // Моё место занял другой (я надолго замолкала, и меня сочли закрытой) — место надо искать заново
  const mine = ag.ready ? ag.files[ag.slot]?.rec : null
  if (mine && mine.sid !== ag.sid && live(mine, now)) {
    ag.ready = false
    log('отметка сессии: место заняла другая сессия, ищу новое')
  }
  ag.read = now
  return sure
}

// Другие открытые сессии: по одной на id, самая свежая отметка
function othersFrom(now) {
  const ag = S.ag
  const by = new Map()
  for (const [slot, f] of Object.entries(ag.files)) {
    const rec = f.rec
    if (!live(rec, now) || rec.sid === ag.sid || (ag.ready && Number(slot) === ag.slot)) continue
    if (!by.has(rec.sid) || by.get(rec.sid).at < rec.at) by.set(rec.sid, { ...rec, slot: Number(slot) })
  }
  return [...by.values()]
}

// Занять место для своей отметки: сначала — место, где моя отметка уже есть (перезагрузка мода), иначе — свободное
// наугад: записать, выждать CLAIM_MS и перечитать. Осталась там моя — место моё
function takeSlot($) {
  const ag = S.ag
  if (ag.taking) return ag.taking
  ag.taking = enqueue(async () => {
    if (!ag.on || ag.ready) return ag.ready
    const now = await $.clock.now()
    await readSlots($, now, true)
    const own = Object.entries(ag.files).find(([, f]) => f.rec?.sid === ag.sid && now - f.rec.at < AGENT_TTL_MS / 2)
    // Первое место этого процесса: своей свежей отметки нет (не перезагрузка мода) и других открытых сессий нет —
    // Claude только что запустили: отсрочка «сыграть?» до перезапуска кончается (app/later)
    if (!ag.launched) {
      ag.launched = true
      await launchCheck($, now, !own && !othersFrom(now).length)
    }
    if (own) {
      ag.slot = Number(own[0])
      ag.ready = true
      return true
    }
    const free = []
    for (let slot = 1; slot <= AGENT_SLOTS; slot++) {
      const f = ag.files[slot]
      if (!f || (f.sig && !live(f.rec, now))) free.push(slot)
    }
    if (!free.length) return false
    const slot = free[Math.floor(Math.random() * free.length)]
    const at = await $.clock.now()
    // Перед записью — ещё раз: место могли занять, пока мы читали остальные
    const before = await $.fs.read(slotPath(slot)).catch(() => null)
    const was = parse(before)
    if ((before && !was) || (live(was, at) && was.sid !== ag.sid)) return false
    const rec = recordOf(at)
    await $.fs.write(slotPath(slot), JSON.stringify(rec))
    // Запись шла слишком долго — выжидания уже не хватит, чтобы увидеть, кто писал вместе с нами: в другой раз
    if ((await $.clock.now()) - at > CLAIM_MS / 2) return false
    const wait = at + CLAIM_MS - (await $.clock.now())
    if (wait > 0) await $.clock.sleep(wait)
    const after = parse(await $.fs.read(slotPath(slot)).catch(() => null))
    if (after?.sid !== ag.sid || after.at !== at) return false
    ag.slot = slot
    ag.ready = true
    ag.wrote = at
    ag.sent = bodyOf(rec)
    ag.files[slot] = { sig: '', rec }
    return true
  }).finally(() => {
    ag.taking = null
  })
  return ag.taking
}

// Отметки готовы к заявкам: 'off' — отметок нет (очередь идёт одна, как раньше), true — место моё, false — не вышло
export async function agentsReady($) {
  const ag = S.ag
  if (!ag?.on) return 'off'
  if (ag.ready) return true
  return takeSlot($).catch((err) => {
    log(`отметка сессии: ${err?.message ?? err}`)
    return false
  })
}

// Шаг отметок — таймером раз в AGENT_TICK_MS: обновить свою, отпустить сделанную карточку, прочитать чужие, когда они
// нужны (вкладка «Агенты» или доска на экране, всплывашки включены), — и всплывашки о них
export async function agentsTick($) {
  const ag = S.ag
  if (!ag?.on || ag.ticking) return
  ag.ticking = true
  try {
    const now = await $.clock.now()
    // После /clear сессия та же, а id у неё новый: session.start не приходит — берём его здесь
    if (!ag.sid) {
      ag.sid = await $.session.id()
      ag.sent = ''
    }
    // Записи не уходили дольше, чем живёт отметка (компьютер спал, процесс стоял): место могли счесть свободным
    if (ag.ready && now - ag.wrote > AGENT_TTL_MS * 0.8) ag.ready = false
    if (!ag.ready) await takeSlot($)
    if (S.status !== ag.status) {
      if (!busy(S.status) || !busy(ag.status)) ag.since = now
      ag.status = S.status
    }
    holdCheck(now)
    if (ag.ready && (bodyOf(recordOf(0)) !== ag.sent || now - ag.wrote >= AGENT_WRITE_MS)) await put($)
    const shown = S.paneOpen && S.view === 'library' && (S.menu === 'agents' || S.menu === 'usage' || S.menu === 'today' || /^(boards|board:|note:)/.test(S.menu))
    if (shown || ((S.agNotify || S.agDone) && now - ag.read >= AGENT_READ_MS)) {
      await readSlots($, now)
      if (await readHidden($)) ag.sig = ''
      const others = othersFrom(now)
      const all = ag.ready ? [...others, { ...recordOf(now), slot: ag.slot }] : others
      notify($, all, now)
      alertsTick($, all, now)
      const sig = JSON.stringify(others.map((r) => [r.sid, r.name, r.status, r.bg, r.since, r.card?.id, r.queue?.n, r.queue?.of, r.ask?.kind, r.ask?.id, r.ask?.what, r.usage?.at, r.changes?.at]).sort())
      if (sig !== ag.sig) {
        ag.sig = sig
        if (shown) $.ui.invalidate('ui.render')
      }
    }
  } catch (err) {
    log(`отметка сессии: ${err?.message ?? err}`)
  } finally {
    ag.ticking = false
  }
}

// Всплывашки о других сессиях и уведомления ОС о всех (и о своей): первое чтение только запоминает, что видно; дальше —
// «ждёт разрешения» или «ждёт ответа на вопрос» (и у новой сессии тоже; каждый новый вопрос — заново) и, если
// включено, «закончил ход» у знакомой. Уведомления копятся в S.al.pending — объявит alertsTick
function notify($, all, now) {
  const ag = S.ag
  const first = !ag.seen
  const was = ag.seen ?? new Map()
  ag.seen = new Map(all.map((r) => [r.sid, seenOf(r)]))
  if (first) return
  for (const r of all) {
    const before = was.get(r.sid)
    if (before === seenOf(r) || S.agHidden.includes(r.sid)) continue
    const wait = r.status === 'permission'
    const done = r.status === 'done' && before !== undefined
    if (!wait && !done) continue
    const what = alertWhat(r)
    if (alertOn(what)) S.al.pending.set(alertKey(r), { key: alertKey(r), sid: r.sid, seen: seenOf(r), name: r.name, what, at: now })
    if (r.sid === ag.sid) continue
    if (wait && S.agNotify) $.ui.toast(fill(tr(what === 'question' ? 'Сессия «{0}» ждёт ответа на вопрос' : 'Сессия «{0}» ждёт разрешения', S.lang), [r.name]))
    else if (done && S.agDone) $.ui.toast(fill(tr('В сессии «{0}» Claude закончил ход', S.lang), [r.name]))
  }
}

// Уведомление ОС о сессиях включено: само, на этой системе есть чем показать, и то же событие включено всплывашкой
const alertOn = (what) => S.agOs && Boolean(S.platform) && (what === 'done' ? S.agDone : S.agNotify)
// Об этом событии своей сессии скажет уведомление о сессиях — старое «пока играешь в окне» молчит
const alertsCover = (what) => Boolean(S.ag?.on) && alertOn(what)

// Уйти — из session.end. /clear: процесс тот же, id сессии будет новый — место оставляем себе. Иначе — место свободно
export async function leaveAgents($, reason) {
  const ag = S.ag
  if (!ag?.on) return
  if (reason === 'clear') {
    ag.sid = ''
    ag.seen = null
    return
  }
  const slot = ag.ready ? ag.slot : 0
  // Записи, что ещё в очереди, уже ничего не напишут (on — false); пометка «ушла» — после них
  ag.on = false
  ag.ready = false
  if (slot) await enqueue(async () => $.fs.write(slotPath(slot), JSON.stringify({ v: 1, left: true, at: await $.clock.now() })))
}

// Заявить карточку очереди так, чтобы две сессии не получили одну. Сессия выбирает карточку (pick — по чужим
// отметкам), пишет заявку { card, at }, выжидает CLAIM_MS и перечитывает чужие: карточку уже держит другая или заявила
// раньше (при равенстве — у кого id меньше) — проиграла, берёт следующую. Запись заявки, которая шла дольше CLAIM_MS/2,
// не в счёт: кто заявил раньше, к перечитыванию соперника уже точно записан. io: me — мой id; now, sleep — часы;
// others(reread) — чужие отметки (null — какое-то место не прочиталось); write(claim) — записать заявку (null — снять).
// Возвращает id карточки, '' — свободных карточек нет, или null — заявки раз за разом проигрываются
export async function claimCard(io, pick) {
  for (let i = 0; i < CLAIM_TRIES; i++) {
    const at = await io.now()
    const others = await io.others(false)
    const card = pick(others ?? [])
    if (!card) return ''
    await io.write({ card, at })
    if ((await io.now()) - at > CLAIM_MS / 2) {
      await io.write(null)
      continue
    }
    const wait = at + CLAIM_MS - (await io.now())
    if (wait > 0) await io.sleep(wait)
    const after = await io.others(true)
    const lost = after === null || after.some((r) => r.card?.id === card || (r.claim?.card === card && (r.claim.at < at || (r.claim.at === at && r.sid < io.me))))
    if (lost) {
      await io.write(null)
      continue
    }
    return card
  }
  return null
}

// Взять следующую карточку очереди. pick(others) — какую (по чужим отметкам); before() — перед каждым выбором (освежить
// блокнот: карточку, которую другая сессия уже сделала, не брать); 'off' — отметок нет, решай сам; '' — свободных
// карточек нет; null — занять карточку не вышло; иначе — id карточки, уже записанной в мою отметку
export async function takeCard($, pick, before) {
  const ready = await agentsReady($)
  if (ready === 'off') return 'off'
  if (!ready) return null
  const ag = S.ag
  const io = {
    me: ag.sid,
    now: () => $.clock.now(),
    sleep: (ms) => $.clock.sleep(ms),
    others: async (reread) => {
      if (!reread && before) await before()
      const now = await $.clock.now()
      const sure = await readSlots($, now, reread)
      return reread && !sure ? null : othersFrom(now)
    },
    // Заявка не записалась (место пропало) — заявлять нельзя: соперник её не увидит
    write: async (claim) => {
      ag.claim = claim
      if (!(await put($)) && claim) throw new Error('нет места для отметки')
    },
  }
  const id = await claimCard(io, pick).catch((err) => {
    log(`заявка на карточку: ${err?.message ?? err}`)
    return null
  })
  ag.claim = null
  if (id) holdCard(id)
  await put($)
  return id
}

// Карточка у этой сессии — её видят другие сессии («у сессии «…»») и очередь их не возьмёт
export function holdCard(id) {
  const ag = S.ag
  if (!ag?.on) return
  const page = S.notes.find((p) => p.id === id)
  const board = page?.parent ? S.notes.find((p) => p.id === page.parent && isBoard(p)) : null
  ag.card = page ? { id, title: page.title, board: board?.id ?? '', boardTitle: board?.title ?? '' } : null
  ag.doneAt = 0
}
export function dropCard() {
  if (S.ag) S.ag.card = null
}

// Своя карточка удалена или сделана (в последней колонке) — она больше не у этой сессии. Сделанную держим ещё
// DONE_HOLD_MS: сессия, которая прочитала блокнот чуть раньше, видит карточку в первой колонке — пусть видит и что её
// держат, а не возьмёт снова
function holdCheck(now) {
  const ag = S.ag
  if (!ag.card) return
  const page = S.notes.find((p) => p.id === ag.card.id)
  const board = page?.parent ? S.notes.find((p) => p.id === page.parent && isBoard(p)) : null
  if (!page) ag.card = null
  else if (board && columnOf(page, board.board.cols) === board.board.cols.at(-1).id) {
    ag.doneAt ||= now
    if (now - ag.doneAt >= DONE_HOLD_MS) ag.card = null
  } else {
    ag.doneAt = 0
    if (page.title !== ag.card.title) ag.card = { ...ag.card, title: page.title }
  }
}

// Какая сессия делает карточку: { name, me } или null
export function sessionOf(id) {
  const ag = S.ag
  if (!ag?.on || !id) return null
  if (ag.card?.id === id) return { name: ag.name, me: true }
  // Чужие — как их прочитали в последний раз: пока доска на экране, это каждый шаг
  const r = othersFrom(ag.read).find((x) => x.card?.id === id)
  return r ? { name: r.name, me: false } : null
}

// Другие сессии, где идёт очередь на доске id: перечитать отметки сейчас (перед присоединением)
export async function queueMates($, id) {
  const ag = S.ag
  if (!ag?.on) return []
  const now = await $.clock.now()
  await readSlots($, now)
  return othersFrom(now).filter((r) => r.queue?.board === id)
}
// Они же — как их прочитали в последний раз: для экрана доски
export function boardMates(id) {
  const ag = S.ag
  return ag?.on ? othersFrom(ag.read).filter((r) => r.queue?.board === id) : []
}

// Другие открытые сессии — перечитать отметки сейчас
export async function readOthers($) {
  const ag = S.ag
  if (!ag?.on) return null
  const now = await $.clock.now()
  await readSlots($, now)
  return othersFrom(now)
}

// Другие открытые сессии, как их прочитали в последний раз: для «Лимитов»
export function othersNow() {
  const ag = S.ag
  return ag?.on ? othersFrom(ag.read) : []
}

// Список для вкладки «Агенты»: эта сессия и другие открытые, по порядку — ждёт разрешения, закончил ход, работает,
// свободна; в одном состоянии — дольше в нём выше
export function agentsList(now) {
  const ag = S.ag
  if (!ag) return []
  const q = S.queue
  const me = { sid: ag.sid, name: ag.name || base(ag.path), path: ag.path, status: S.status, bg: S.status === 'background' ? S.bg.n : 0, since: ag.status === S.status || (busy(ag.status) && busy(S.status)) ? ag.since : now, card: ag.card, queue: q ? { board: q.board, n: q.given.length, of: q.of ?? 0 } : null, ask: S.ask ?? null, usage: usageOf(), changes: ag.changes ?? null, me: true }
  const others = ag.on ? othersFrom(now) : []
  return [me, ...others].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.since - b.since)
}

// Скрытые сессии из $.store: только строки
export const hiddenOf = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : [])

// Скрыть другую сессию во вкладке «Агенты» (hide) или вернуть. Хранилище общее для всех сессий: перед записью —
// перечитать, чтобы не затереть, что скрыли в другой
let hiding = 0 // нажатий, которые ещё пишут в хранилище
let hiddenTurn = 0 // растёт с каждым нажатием: чтение, начатое до нажатия, его не откатит
export async function hideAgent($, sid, hide) {
  hiding++
  hiddenTurn++
  try {
    const saved = await $.store.get('agentsHidden').catch(() => undefined)
    const list = (saved === undefined ? S.agHidden : hiddenOf(saved)).filter((x) => x !== sid)
    S.agHidden = (hide ? [...list, sid] : list).slice(-HIDDEN_MAX)
    $.ui.invalidate('ui.render')
    await $.store.set('agentsHidden', S.agHidden).catch((err) => log(`скрытые сессии: ${err?.message ?? err}`))
  } finally {
    hiding--
  }
}

// Что скрыли в других сессиях — вместе с чужими отметками. true — список изменился
async function readHidden($) {
  const turn = hiddenTurn
  const saved = await $.store.get('agentsHidden').catch(() => undefined)
  if (saved === undefined || hiding || turn !== hiddenTurn) return false
  const list = hiddenOf(saved)
  if (list.join('\n') === S.agHidden.join('\n')) return false
  S.agHidden = list
  return true
}

// Сколько в состоянии: «меньше минуты», «5 мин», «2 ч 10 мин»
export function agoText(ms) {
  const min = Math.floor(Math.max(0, ms) / 60_000)
  if (min < 1) return 'меньше минуты'
  if (min < 60) return `${min} мин`
  return min % 60 ? `${Math.floor(min / 60)} ч ${min % 60} мин` : `${Math.floor(min / 60)} ч`
}

// ━━━━━━━━━━ app/desktop ━━━━━━━━━━
// Arcade: встроенный браузер Claude в Desktop.

// В Desktop окно — встроенный браузер приложения, его MCP-сервер. Его инструменты Arcade зовёт тем же путём, что
// и Claude ($.tool.call, через обычную проверку разрешений), и сам их не разрешает: решают правила человека. Не
// пропустили (в авто-режиме вызовы мода классификатор не судит) — игру открывает Claude по просьбе Arcade: его
// вызовы проверят как обычно. Просьба мода ждёт, пока Claude освободится, поэтому работающего
// агента Arcade прерывает: дожидается конца текущего инструмента (не дольше CUT_TOOL_MS — потом обрывает и его, и
// просит Claude проверить, что тот успел), обрывает ход ($.turn.abort) и сразу просит открыть игру и вернуться к
// работе. Не прервался — просьба ждёт конца хода. Не приняли просьбу или браузер ответил ошибкой —
// кладём её в поле ввода, и по Enter её выполнит Claude. Черновик в поле не стираем: просьба встаёт после него. Поле
// может и не взять текст: под вопросом Claude Code — 'dialog'; где поле рисует само приложение — 'manual', просьбу
// человек отправит сам. Игру открыл Claude — панель Arcade закрываем, как и после своего открытия.
export const BROWSER = 'mcp__Claude_Browser__'
// Боковые панели приложения: скрытую панель браузера показывает он
const SHOW_PANE = 'mcp__ccd_view__show_pane'

// Адрес, который открывает Arcade: страницы его сайта и TikTok
export function arcadeUrl(url) {
  return typeof url === 'string' && (url.startsWith(`${SITE}/`) || url.startsWith(`${TIKTOK}/`))
}

// Вызов инструмента приложения. Отказ — исключение с пометкой denied, неизвестный инструмент — исключение без неё.
// consent — что нажал человек: если решать всё же будет классификатор авто-режима, он прочтёт это как просьбу человека
async function desktopCall($, tool, args, consent) {
  const result = await $.tool.call({ tool, ...args, consent })
  if (result?.deny) throw Object.assign(new Error(result.deny), { denied: true })
  return result
}

// Ответ инструмента одной строкой — для журнала
function toolText(result) {
  return result?.text ?? (typeof result?.result === 'string' ? result.result : '')
}

// Вкладки встроенного браузера: tabs_context отвечает JSON-ом, а за ним строкой — виден ли браузер
async function browserTabs($, consent) {
  const text = toolText(await desktopCall($, `${BROWSER}tabs_context`, {}, consent))
  try {
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).tabs ?? []
  } catch {
    return []
  }
}

// Вкладка Arcade (или TikTok — origin), если она уже открыта: активная, иначе последняя
async function arcadeTab($, consent, origin = SITE) {
  const ours = (await browserTabs($, consent)).filter((t) => t.origin === origin)
  return ours.find((t) => t.isActive) ?? ours.pop() ?? null
}

// Что открыто для просмотра — видео, трансляция, TikTok, статья или выпуск: такую вкладку закроет «агент закончил»
function viewing(url) {
  return ['watch', 'live', 'read', 'listen'].some((path) => String(url).startsWith(`${SITE}/${path}`)) || String(url).startsWith(`${TIKTOK}/`)
}

// Запомнить вкладку, где Arcade только что открыл адрес (она — активная). Во вкладку, где было видео, открылась игра
// или чаты — закрывать её «агент закончил» уже не должен. turn — ход Claude, который её открыл. Настройка выключена —
// вкладки не спрашиваем: лишний вызов браузера ни к чему
async function rememberTab($, url, consent, turn = null) {
  if (!S.backOnDone || (!viewing(url) && !S.watchTab)) return
  const tab = (await browserTabs($, consent)).find((t) => t.isActive)
  if (!tab) return
  if (viewing(url)) S.watchTab = { tabId: tab.tabId, turn }
  else if (S.watchTab?.tabId === tab.tabId) S.watchTab = null
}

// Агент закончил, а человек смотрит во встроенном браузере: вкладку, которую открыл Arcade, закрываем — перед ним
// снова разговор с Claude. Последняя вкладка закрывается вместе с панелью браузера. true — закрыли
export async function closeWatchTab($) {
  const { tabId } = S.watchTab
  S.watchTab = null
  try {
    const result = await desktopCall($, `${BROWSER}tabs_close`, { tabId }, 'The agent finished its turn, and the user chose in Arcade settings to close the tab Arcade opened for watching.')
    if (!result?.isError) return true
    log(`вкладка не закрылась: ${toolText(result).slice(0, 200)}`)
  } catch (err) {
    log(`вкладка не закрылась: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  return false
}

// Адрес — во вкладку Arcade, если она уже открыта: новая вкладка на каждое нажатие упирается в предел вкладок
// браузера, а прошлые игры так и играют в фоне. Своей вкладки нет — открываем новую
async function browse($, url, tab, consent) {
  if (tab) {
    const result = await desktopCall($, `${BROWSER}navigate`, { url, tabId: tab.tabId }, consent)
    if (!result?.isError) {
      await desktopCall($, `${BROWSER}tabs_select`, { tabId: tab.tabId }, consent)
      return result
    }
  }
  return desktopCall($, `${BROWSER}preview_start`, { url }, consent)
}

// Скрытая панель браузера сама не появляется — показываем. Не вышло — игра всё равно открыта, пишем в журнал
async function showBrowser($, consent) {
  try {
    const result = await desktopCall($, SHOW_PANE, { pane: 'preview' }, consent)
    if (result?.isError) log(`панель браузера не показалась: ${toolText(result).slice(0, 200)}`)
  } catch (err) {
    log(`панель браузера не показалась: ${String(err?.message ?? err).slice(0, 200)}`)
  }
}

// Нажатие человека для вызовов инструментов приложения: если решать будет классификатор авто-режима, он прочтёт его
// как просьбу человека
function desktopConsent(url) {
  return `The user pressed a button in the Arcade pane to open ${url} in the built-in browser.`
}

async function openDesktopBrowser($, id) {
  const url = windowUrl(id)
  const consent = desktopConsent(url)
  let denied = false
  try {
    const result = await browse($, withName(url, id), await arcadeTab($, consent, url.startsWith(`${TIKTOK}/`) ? TIKTOK : SITE), consent)
    if (!result?.isError) {
      await showBrowser($, consent)
      await rememberTab($, url, consent).catch((err) => log(`вкладка не запомнилась: ${String(err?.message ?? err).slice(0, 200)}`))
      return 'opened'
    }
    log(`встроенный браузер ответил ошибкой: ${toolText(result).slice(0, 200)}`)
  } catch (err) {
    denied = err?.denied === true
    log(`встроенный браузер не открылся: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  // Отказ в разрешении — просим Claude. Сжимает он контекст — ждём конца сжатия: прерванный в это время ход не
  // обрывается, а просьбы копятся в очереди
  if (denied && S.compacting) {
    S.pendingOpen = url // откроем, когда сжатие кончится: хук session.compact в register
    return 'compacting'
  }
  // Работает — сначала прерываем, иначе просьба ждёт конца его хода. Уже открывает другую игру по просьбе Arcade —
  // второй раз не прерываем: просьба встанет следом
  if (denied && S.agentTurn && !S.asking) {
    // Идёт инструмент или Claude Code спрашивает разрешение (прерванный ход унёс бы и вопрос) — ждём
    if (S.toolsRunning > 0 || S.status === 'permission') {
      S.pendingOpen = url // прервём, когда закончится текущий инструмент: хук tool.call в register
      $.clock.after(CUT_TOOL_MS, () => cutPending($, url).catch((err) => log(`ошибка мода: ${err?.message ?? err}`)))
      return 'waiting'
    }
    return interruptAgent($, url)
  }
  return askClaude($, url, denied)
}

// Прервать ход агента и сразу попросить открыть игру и вернуться к работе; cut — оборван и идущий инструмент.
// Не прервался — просьба ждёт конца хода
async function interruptAgent($, url, cut) {
  S.pendingOpen = null
  const turnId = S.agentTurn
  if (!turnId) return askClaude($, url, true)
  S.interrupting = true
  try {
    await $.turn.abort({ turnId })
  } catch (err) {
    S.interrupting = false
    log(`ход агента не прервался: ${String(err?.message ?? err).slice(0, 200)}`)
    return askClaude($, url, true)
  }
  log(cut ? 'Arcade оборвал инструмент и ход агента' : 'Arcade прервал ход агента')
  // Об оборванном инструменте Claude больше никто не скажет: маркера прерывания нет
  const then = [
    tr('Потом вернись к работе, которую делал до этого.', S.lang),
    cut ? tr('Твой последний инструмент оборван на полпути: проверь, что он успел сделать, прежде чем продолжать.', S.lang) : null,
  ]
  const outcome = await askClaude($, url, true, then.filter(Boolean).join('\n'))
  return outcome === 'sent' ? 'interrupted' : outcome
}

// Инструмент агента идёт дольше CUT_TOOL_MS, а игра всё ждёт — обрываем и его. Пока Claude Code спрашивает
// разрешение, не обрываем: ход унёс бы и вопрос
async function cutPending($, url) {
  if (S.pendingOpen !== url || S.toolsRunning === 0 || S.status === 'permission' || !S.agentTurn || S.compacting) return
  S.pendingOpen = null
  desktopNotice($, await interruptAgent($, url, true), '', url)
}

// Текущий инструмент агента или сжатие контекста закончились, а игра ждёт — прерываем ход. Ход уже кончился сам —
// просьба уходит как обычно
export async function openPending($) {
  if (!S.pendingOpen || S.toolsRunning > 0 || S.compacting) return
  const url = S.pendingOpen
  S.pendingOpen = null
  desktopNotice($, S.agentTurn ? await interruptAgent($, url) : await askClaude($, url, true), '', url)
}

// Просьба открыть адрес — Claude: сразу (submit) или в поле ввода; then — что сделать после. Откроет — панель закроет
// хук tool.call в register
export async function askClaude($, url, submit, then) {
  const ask = [tr(`Открой во встроенном браузере: ${url}`, S.lang), then].filter(Boolean).join('\n')
  S.opening = true
  if (submit) {
    // Отмечаем до отправки: ход с просьбой может и кончиться раньше, чем ответит submit
    S.asking = url
    S.askResumes = Boolean(then)
    const sent = await $.prompt.submit({ text: ask }).catch((err) => ({ drop: String(err?.message ?? err) }))
    if (!sent.drop) return 'sent'
    S.asking = null
    log(`просьба Claude не ушла: ${sent.drop.slice(0, 200)}`)
  }
  const { text: draft } = await $.prompt.read()
  if (draft.includes(url)) return 'filled'
  const filled = await $.prompt.fill({ text: draft.trim() ? `\n${ask}` : ask, mode: 'append' })
  if (filled.isFilled) return 'filled'
  return filled.refusal === 'dialog' ? 'dialog' : 'manual'
}

// Что сказать о попытке открыть встроенный браузер; opened — если он открылся сразу
export function desktopNotice($, outcome, opened, url) {
  // Адрес для ручной просьбы не убираем через 15 секунд: его ещё надо переписать. Ожидание — пока не кончится
  // инструмент агента или сжатие, сколько бы они ни шли
  // Что открывается: видео (и трансляция), статья или выпуск (о них — «ссылка») или игра
  const page = (path) => String(url).startsWith(`${SITE}/${path}`)
  const kind = page('watch') || page('live') || String(url).startsWith(`${TIKTOK}/`) ? 'video' : page('read') || page('listen') || page('chat') ? 'link' : 'game'
  const pick = (video, link, game) => ({ video, link, game })[kind]
  if (outcome === 'manual') S.libraryNotice = `Попроси Claude открыть во встроенном браузере: ${url}`
  else if (outcome === 'waiting')
    S.libraryNotice = pick(
      'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть видео во встроенном браузере.',
      'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть ссылку во встроенном браузере.',
      'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть игру во встроенном браузере.',
    )
  else if (outcome === 'compacting')
    S.libraryNotice = pick(
      'Claude сжимает контекст — когда закончит, Arcade попросит его открыть видео во встроенном браузере.',
      'Claude сжимает контекст — когда закончит, Arcade попросит его открыть ссылку во встроенном браузере.',
      'Claude сжимает контекст — когда закончит, Arcade попросит его открыть игру во встроенном браузере.',
    )
  else if (outcome === 'asking')
    windowNotice($,
      pick(
        'Claude уже открывает это видео во встроенном браузере — подожди немного.',
        'Claude уже открывает эту ссылку во встроенном браузере — подожди немного.',
        'Claude уже открывает эту игру во встроенном браузере — подожди немного.',
      ),
    )
  else
    windowNotice($,
      outcome === 'opened'
        ? opened
        : outcome === 'interrupted'
          ? pick(
              'Arcade прервал Claude: он откроет видео во встроенном браузере и вернётся к работе.',
              'Arcade прервал Claude: он откроет ссылку во встроенном браузере и вернётся к работе.',
              'Arcade прервал Claude: он откроет игру во встроенном браузере и вернётся к работе.',
            )
          : outcome === 'sent'
            ? 'Arcade попросил Claude открыть ссылку во встроенном браузере.'
            : outcome === 'filled'
              ? 'Ссылка — в поле ввода: нажми Enter, и Claude откроет её во встроенном браузере.'
              : 'Не получилось открыть встроенный браузер: сначала ответь на вопрос Claude Code.',
    )
  $.ui.invalidate('ui.render')
}

// Открыть во встроенном браузере и сказать, что вышло; opened — что сказать, если он открылся сразу, toast — сказать
// ещё и всплывашкой (панель Arcade может быть закрыта). Из обработчика нажатия с движка 2.1.308 вызов инструмента
// идёт мимо tool.check: пока идёт нажатие, открытие только встаёт в очередь, а открывает хук нажатия (handlePress) — в
// своём теле, когда обработчик отработал, через обычную проверку разрешений
export async function desktopWindow($, id, opened, toast = false) {
  if (S.pressing) {
    S.pressOpens.push({ id, opened, toast })
    return
  }
  await openWindow($, id, opened, toast)
}

// Хук нажатия (ui.press, ui.input по Enter): next ждёт обработчик до конца, потом открываем то, что он поставил в
// очередь, — по одному, как нажимали
export async function handlePress($, e, next) {
  await lookHere($)
  S.pressing++
  try {
    return await next(e)
  } finally {
    S.pressing = Math.max(0, S.pressing - 1)
    while (S.pressOpens.length) {
      const { id, opened, toast } = S.pressOpens.shift()
      await openWindow($, id, opened, toast).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    }
  }
}

async function openWindow($, id, opened, toast) {
  // Эту же игру Claude уже открывает по просьбе Arcade или она ждёт конца инструмента или сжатия — повторное
  // нажатие только напоминает, что происходит: второй раз ход не прерываем
  const url = windowUrl(id)
  if (S.asking === url || S.pendingOpen === url) {
    desktopNotice($, S.asking === url ? 'asking' : S.compacting ? 'compacting' : 'waiting', '', url)
  } else {
    S.opening = false
    S.pendingOpen = null
    S.libraryNotice = 'Открываю встроенный браузер…'
    $.ui.invalidate('ui.render')
    const outcome = await openDesktopBrowser($, id)
    desktopNotice($, outcome, opened, url)
    // Браузер встаёт под панелью Arcade, и игре тесно — панель закрываем, если в настройках не выбрано оставлять меню.
    // Назад — /arcade или «Библиотека» на сайте
    if (outcome === 'opened' && !S.keepMenu) await $.ui.close({ id: PANE })
  }
  if (toast) await $.ui.toast(tr(S.libraryNotice, S.lang))
}

// Игру открыл Claude по просьбе Arcade: панель Arcade закрываем (или оставляем — keepMenu). Вызов Claude панель
// браузера не показывает — показываем сами (в авто-режиме может и не выйти)
export async function openedForArcade($, e) {
  S.opening = false
  S.asking = null
  await showBrowser($, desktopConsent(e.url))
  // Claude открыл вкладку и вернулся к прерванной работе — конец хода закроет её; открыл и только — не закроет
  const turn = S.askResumes ? null : S.agentTurn
  S.askResumes = false
  await rememberTab($, e.url, desktopConsent(e.url), turn).catch((err) => log(`вкладка не запомнилась: ${String(err?.message ?? err).slice(0, 200)}`))
  if (S.paneOpen && !S.keepMenu) await $.ui.close({ id: PANE })
}

// ━━━━━━━━━━ app/window ━━━━━━━━━━
// Arcade: где открываются игры, адреса страниц, подписи настроек.

export function windowMode() {
  return S.platform !== null && (S.opener ?? 'window') === 'window'
}

// Открывать ли игру окном браузера на этой поверхности. В терминале — по выбору в настройках (по умолчанию да).
// В VS Code по умолчанию игра в панели, окно — только если его выбрали явно. В Desktop Денди всегда в панели,
// остальное — по своей настройке (builtinBrowser).
export function opensWindow(surface) {
  if (!windowMode()) return false
  if (surface === 'terminal') return true
  return surface === 'vscode' && S.opener === 'window'
}

// Desktop: игра не Денди открывается во встроенном браузере приложения (desktopWindow) — по умолчанию — или окном
// браузера, как в терминале, если так выбрано в настройках. Окно — только когда ОС уже определена. Шутерам (mouse)
// нужна захваченная мышь, а встроенный браузер её не отдаёт — они идут окном и при выбранном встроенном браузере
export function builtinBrowser(surface, mouse = false) {
  return surface === 'desktop' && (!S.platform || (S.desktopOpener === 'builtin' && !mouse))
}

// Шутеры: Doom-подобные и браузерные игры, которым каталог сайта ставит mouse (OpenArena)
export function mouseGame(id) {
  const g = gameById(id)
  return g?.console === 'doom' || g?.mouse === true
}
export const MOUSE_NOTE = 'Встроенный браузер Claude не даёт игре захватить мышь, поэтому шутеры открываются окном браузера.'

export function webGame(id) {
  return gameById(id)?.web === true
}

// Чем открыть окно: выбранный браузер, браузер по умолчанию, если его узнали, или то, что открывает ссылки
function windowTarget() {
  const browsers = S.detection?.browsers ?? []
  const id = S.browserChoice === 'default' ? S.detection?.defaultId : S.browserChoice
  const browser = browsers.find((b) => b.id === id)
  return browser ? { kind: 'browser', browser } : { kind: 'default' }
}

// TikTok смотрят на его сайте: вход — человека, страницы TikTok Arcade не трогает
export const TIKTOK = 'https://www.tiktok.com'

// Команда, которая открывает окно с игрой (или с библиотекой, если id нет) на сайте Arcade.
// На Windows — выбранным браузером, отдельным окном справа; на macOS и Linux — браузером по умолчанию.
export function windowUrl(id) {
  // tiktok — лента «Для тебя», tiktok:<запрос> — поиск TikTok; язык TikTok берёт свой
  if (id === 'tiktok') return `${TIKTOK}/foryou`
  if (typeof id === 'string' && id.startsWith('tiktok:')) return `${TIKTOK}/search?q=${encodeURIComponent(id.slice(7))}`
  // chat — страница чатов на сайте: код ссылки после #, страница обменяет его на свой билет и уберёт из адреса
  if (id === 'chat') return `${SITE}/chat${S.lang === 'ru' ? '' : `?lang=${S.lang}`}#k=${S.chatLink}${S.ch.talk && (S.menu === 'chats:talk' || S.menu === 'chats:members') ? `&c=${S.ch.talk}` : ''}`
  // video:<номер> — страница просмотра с подборкой YouTube; язык она берёт сама
  if (typeof id === 'string' && id.startsWith('video:')) return watchUrl(S.yt.videos, Number(id.slice(6)) || 0, S.lang)
  // article:<номер> — переход к статье через страницу /read, episode:<номер> — выпуск подкаста на странице /listen
  if (typeof id === 'string' && id.startsWith('article:')) return readUrl(S.reads.articles.items[Number(id.slice(8)) || 0], S.lang)
  if (typeof id === 'string' && id.startsWith('episode:')) return listenUrl(S.reads.podcasts.items[Number(id.slice(8)) || 0], S.lang)
  // live:<логин> — страница /live с плеером Twitch; в списке рядом — свои каналы, если канал свой, иначе каталог
  if (typeof id === 'string' && id.startsWith('live:')) return liveUrl(twitchList(id.slice(5)), id.slice(5), S.lang)
  let url
  // tab:<вкладка> или tab:<группа>:<полка>
  if (typeof id === 'string' && id.startsWith('tab:')) url = tabPageUrl(...id.slice(4).split(':'))
  // book:<ссылка> — читалка окна, audio:<ссылка> — проигрыватель; mine:book и mine:audio — «Мои книги» и «Мои
  // аудиокниги» окна, с языком книг: на нём окно покажет свои разделы
  else if (typeof id === 'string' && id.startsWith('book:')) url = `${SITE}/?book=${encodeURIComponent(id.slice(5))}`
  else if (typeof id === 'string' && id.startsWith('audio:')) url = `${SITE}/?audio=${encodeURIComponent(id.slice(6))}`
  else if (id === 'mine:book' || id === 'mine:audio') url = `${SITE}/?tab=${id === 'mine:book' ? 'books' : 'audiobooks'}&section=mine&book-lang=${S.bk.lang}`
  // Денди по сети — та же игра в окне на EmulatorJS (FCEUmm) с его сетевой игрой
  else if (typeof id === 'string' && id.startsWith('net:')) url = `${pageUrl(id.slice(4))}&net=1`
  // Кооператив Freedoom — лобби кооператива этой игры
  else if (typeof id === 'string' && id.startsWith('coop:')) url = `${pageUrl(id.slice(5))}&net=coop`
  // room:<игра>:<код> — комната настольной игры, куда позвали друга или куда позвал друг
  else if (typeof id === 'string' && id.startsWith('room:')) {
    const [, game, code] = id.split(':')
    url = `${pageUrl(game)}&room=${code}`
  } else {
    const m = S.mine.find((x) => x.id === id)
    url = m ? minePageUrl(m) : pageUrl(id)
  }
  if (S.lang === 'ru') return url
  // Язык передаём обычным параметром, до части после # (там своя игра): окно читает язык только из строки запроса
  const at = url.includes('#') ? url.indexOf('#') : url.length
  const base = url.slice(0, at)
  return `${base}${base.includes('?') ? '&' : '?'}lang=${S.lang}${url.slice(at)}`
}

// Сетевая настольная игра: подпись @ника — после #, страница покажет ник соперникам и уберёт его из адреса. Вышли —
// пустая подпись: страница забудет прежнюю. Только в окна, которые мод открывает сам: в просьбу к Claude подпись не идёт
export function withName(url, id) {
  if (gameById(netGame(id))?.kind !== 'board') return url
  if (S.acct.ticket) return `${url}#me=${S.acct.ticket}`
  return S.acct.session ? url : `${url}#me=`
}

// Сетевая игра для окна: Денди — net:<id>, кооператив Doom — coop:<id>, настольная с комнатой — room:<id>:<код>,
// дефматч Doom — сама игра (лобби общее)
export function netWhere(id, room = '') {
  const g = gameById(id)
  if (g?.kind === 'board' && room) return `room:${id}:${room}`
  if (g?.console === 'nes') return `net:${id}`
  if (g?.console === 'doom' && g.net !== 'doom' && g.net !== 'heretic-dm') return `coop:${id}`
  return id
}

// Игра из адреса окна: net:<id>, coop:<id> или room:<id>:<код> → id
function netGame(where) {
  if (typeof where !== 'string') return where
  if (where.startsWith('net:') || where.startsWith('coop:') || where.startsWith('room:')) return where.split(':')[1]
  return where
}

// Открыть сетевую игру: во встроенном браузере Desktop (шутеры — окном) или окном браузера
export async function openNet($, surface, where) {
  const id = netGame(where)
  const title = gameById(id)?.title ?? id
  S.lastGame = id
  if (builtinBrowser(surface, mouseGame(id))) return desktopWindow($, where, `${title} открыт во встроенном браузере Claude.`)
  S.libraryNotice = 'Открываю окно…'
  $.ui.invalidate('ui.render')
  const command = windowCommand(where)
  try {
    const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
    windowNotice($, launchNotice(result, id))
    if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
  } catch (err) {
    S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
  }
  $.ui.invalidate('ui.render')
}

export function windowCommand(id) {
  const url = withName(windowUrl(id), id)
  if (S.platform === 'mac') return { argv: ['open', url], env: {} }
  if (S.platform === 'linux') return { argv: ['xdg-open', url], env: {} }
  return launchCommand(windowTarget(), url, windowBounds(S.detection?.screen ?? null), S.profileRoot)
}

// Что сказать после попытки открыть окно
export function launchNotice(result, id) {
  const title = id ? gameById(id)?.title ?? id : 'Arcade'
  if (result?.exitCode === 0) {
    const target = S.platform === 'windows' ? windowTarget() : { kind: 'default' }
    const where = target.kind === 'browser' ? target.browser.name : 'браузере по умолчанию'
    if (id === 'chat') return `Чаты открыты в ${where}.`
    if (typeof id === 'string' && id.startsWith('video:')) return `Видео открыто в ${where}.`
    if (typeof id === 'string' && id.startsWith('article:')) return `Статья открыта в ${where}.`
    if (typeof id === 'string' && id.startsWith('episode:')) return `Выпуск открыт в ${where}.`
    if (typeof id === 'string' && id.startsWith('live:')) return `Трансляция открыта в ${where}.`
    if (typeof id === 'string' && id.startsWith('book:')) return `Книга открыта в ${where}.`
    if (typeof id === 'string' && id.startsWith('audio:')) return `Аудиокнига открыта в ${where}.`
    if (id === 'mine:book') return `«Мои книги» открыты в ${where}.`
    if (id === 'mine:audio') return `«Мои аудиокниги» открыты в ${where}.`
    return id
      ? `${title} открыт в ${where}. Игра стоит на паузе, пока окно не в фокусе.`
      : `Arcade открыт в ${where}: выбирай приставку и игру.`
  }
  const reason = String(result?.stderr ?? '').trim().split('\n')[0] || `код ${result?.exitCode}`
  return `Не получилось открыть окно: ${reason}`
}

// Варианты «где открывать» по кругу: браузер по умолчанию, каждый найденный браузер, панель
export function openerOptions() {
  const browsers = S.platform === 'windows' ? S.detection?.browsers ?? [] : []
  return [
    { opener: 'window', browser: 'default' },
    ...browsers.map((b) => ({ opener: 'window', browser: b.id })),
    { opener: 'pane', browser: S.browserChoice },
  ]
}

// В Desktop: встроенный браузер приложения, окно браузера по умолчанию, окно каждого найденного браузера.
// Каким браузером открывать окно — общий выбор с терминалом
export function desktopOptions() {
  return [{ opener: 'builtin', browser: S.browserChoice }, ...openerOptions().filter((o) => o.opener === 'window')]
}

export function desktopLabel() {
  return builtinBrowser('desktop') ? 'Открывать: встроенный браузер Claude' : windowLabel()
}

export function openerLabel() {
  return windowMode() ? windowLabel() : 'Открывать: здесь, в панели'
}

function windowLabel() {
  if (S.platform !== 'windows') return 'Открывать: окно браузера по умолчанию'
  const searching = S.detection === null ? ' (ищу браузеры…)' : ''
  const browsers = S.detection?.browsers ?? []
  if (S.browserChoice !== 'default') {
    const chosen = browsers.find((b) => b.id === S.browserChoice)
    if (chosen) return `Открывать: окно ${chosen.name}${chosen.app ? '' : ' (обычное окно браузера)'}`
  }
  const fallback = browsers.find((b) => b.id === S.detection?.defaultId)
  return `Открывать: окно браузера по умолчанию${fallback ? ` (${fallback.name})` : ''}${searching}`
}

export function settingsNote(surface) {
  if (surface === 'desktop') return desktopLabel().replace('Открывать: ', 'открывать: ')
  const where = windowMode() ? openerLabel().replace('Открывать: ', 'открывать: ') : 'играть здесь, в панели'
  return windowMode() ? where : `${where} · графика: ${GRAPHICS_LABEL[S.graphics]}`
}

// Где откроется игра — для подсказки под списком игр
export function whereText() {
  if (S.platform !== 'windows') return 'в окне браузера по умолчанию'
  const browsers = S.detection?.browsers ?? []
  if (S.browserChoice !== 'default') {
    const chosen = browsers.find((b) => b.id === S.browserChoice)
    if (chosen) return chosen.app ? `в окне ${chosen.name}` : `в обычном окне ${chosen.name}`
  }
  const fallback = browsers.find((b) => b.id === S.detection?.defaultId)
  return `в окне браузера по умолчанию${fallback ? ` (${fallback.name})` : ''}`
}

// ━━━━━━━━━━ app/read ━━━━━━━━━━
// Arcade: статьи, подкасты, книги.

// --- Статьи и подкасты: те же темы, записи — из открытых RSS- и Atom-лент ---------------------------------------
// Список лент: сохранённый, если свежий, иначе с сайта; сайт не ответил — старый сохранённый или запас мода
async function feedsList($, now) {
  let stored = null
  try {
    const saved = await $.store.get('feedsList')
    stored = saved?.list ? parseFeeds(saved.list) : null
    if (stored && now - saved.at < CHANNELS_TTL_MS) return stored
    const response = await fetchWithin($, siteUrl('feeds.json'), YT_FETCH_MS)
    const fromSite = response?.ok ? parseFeeds(response.text) : null
    if (fromSite) {
      await $.store.set('feedsList', { at: now, list: fromSite })
      return fromSite
    }
  } catch (err) {
    log(`ленты статей и подкастов с сайта не получены: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  return stored ?? bundledFeeds()
}

// Записи ленты; лента не ответила — что было в прошлый раз. accept — годится ли лента по её тексту (язык шоу из поиска)
async function rssFeed($, feed, kind, now, accept = () => true) {
  const key = `${kind}:${feed.id}`
  const hit = rssCache.get(key)
  if (hit && now - hit.at < FEED_TTL_MS) return hit.items
  const response = await fetchWithin($, feed.url, YT_FETCH_MS)
  const items = response?.ok && accept(response.text) ? parseItems(response.text, feed, kind) : []
  if (items.length) rssCache.set(key, { at: now, items })
  return items.length ? items : hit?.items ?? []
}

// Найденное по своей теме для статей и подкастов → { list, error }. Статьи — с Hacker News и Medium, подписанные сайтом.
// Подкасты: поиск находит шоу, выпуски — из их лент; лента не на английском (по её <language>) не годится. Шоу нашлись,
// а ни одна лента не ответила — error 'feeds'
async function foundReads($, kind, query, now) {
  const found = await searchFor($, kind, query, now)
  if (kind === 'articles') return { ...found, list: freshFound(found.list, now, SEARCH_DAYS) }
  const shows = found.list.slice(0, SEARCH_SHOWS)
  let answered = 0
  const english = (xml) => {
    answered++
    return ['', 'en'].includes(feedLanguage(xml))
  }
  const feeds = await Promise.all(
    shows.map(async (show) => {
      const items = await rssFeed($, showFeed(show), kind, now, english)
      if (items.length) answered++
      return items.map((x) => ({ ...x, s: show.s }))
    }),
  )
  return { error: shows.length && !answered ? 'feeds' : found.error, list: candidates(feeds, '', now, 3, SHOW_DAYS) }
}

// Подборка статей или выпусков по теме: ленты темы (английские — других языков в лентах нет) → свежие кандидаты →
// haiku выбирает. Своя тема — ещё и поиск сайта по её запросу, вперемешку с лентами по направлениям темы. again —
// другая подборка: уже показанное не повторяем, пока есть из чего выбрать
export async function loadReads($, kind, key, again = false) {
  const topic = topicOf(key)
  if (!topic) return
  const was = S.reads[kind]
  const request = was.request + 1
  const seen = again && was.topic === key ? new Set([...was.seen, ...was.items.map((x) => x.id)]) : new Set()
  S.reads = { ...S.reads, [kind]: { ...was, topic: key, items: [], loading: true, note: '', request } }
  $.ui.invalidate('ui.render')
  const now = await $.clock.now()
  const articles = kind === 'articles'
  let items = []
  let note = ''
  let used = seen
  try {
    const list = await feedsList($, now)
    const byDirection = async (direction) => {
      const { en } = channelsFor({ channels: list[kind] }, direction, 'en', now)
      return candidates(await Promise.all(en.map((f) => rssFeed($, f, kind, now))), direction, now)
    }
    let found = null
    let pool
    if (topic.own) {
      const [search, ...lists] = await Promise.all([foundReads($, kind, topic.query, now), ...topic.directions.map(byDirection)])
      found = search
      pool = mix(search.list, lists.reduce((all, x) => mix(all, x, Infinity), []), Infinity)
    } else pool = await byDirection(topic.direction)
    // Всё уже показывали — начинаем круг заново
    if (pool.filter((x) => !seen.has(x.id)).length < PICKS) used = new Set()
    pool = pool.filter((x) => !used.has(x.id)).slice(0, YT_POOL)
    if (!pool.length)
      note = topic.own
        ? searchNote(found)
        : articles
        ? 'Не получилось загрузить статьи: ленты не ответили. Попробуй чуть позже.'
        : 'Не получилось загрузить выпуски: ленты не ответили. Попробуй чуть позже.'
    else {
      let ranked = []
      const answer = await $.model.complete({ model: 'haiku', ...readsPrompt(topic, pool, kind), maxTokens: 300, timeoutMs: YT_MODEL_MS })
      if (answer.isAnswered) ranked = parsePicks(answer.text, pool)
      else log(`${kind}: модель не ответила (${answer.reason})`)
      items = choose(ranked, [], pool)
    }
  } catch (err) {
    const reason = String(err?.message ?? err).slice(0, 200)
    note = articles ? `Не получилось загрузить статьи: ${reason}` : `Не получилось загрузить выпуски: ${reason}`
  }
  if (request !== S.reads[kind].request) return
  S.reads = { ...S.reads, [kind]: { ...S.reads[kind], items, seen: used, loading: false, note } }
  $.ui.invalidate('ui.render')
}

// Список книг или аудиокниг с сайта: раздел или поиск на языке книг; more — следующая страница к уже показанной.
// Сайт собирает его из Project Gutenberg, Викитеки или archive.org — ждём дольше, чем ленту
const BOOKS_FETCH_MS = 20_000
export async function loadBooks($, kind, { section = '', q = '', more = false } = {}) {
  const was = S.bk[kind]
  const request = was.request + 1
  const page = more ? was.page + 1 : 1
  const bookState = more ? { ...was, loading: true, error: '', request } : { ...emptyBooks(request), section, q, loading: true }
  S.bk = { ...S.bk, [kind]: bookState }
  $.ui.invalidate('ui.render')
  const url = siteUrl(booksPath(kind, S.bk.lang, { section: bookState.section || 'popular', q: bookState.q, page }))
  const answer = parseBooks(kind, await fetchWithin($, url, BOOKS_FETCH_MS))
  if (request !== S.bk[kind].request) return
  const cur = S.bk[kind]
  const newItems = answer.error ? [] : answer.items.filter((x) => !cur.items.some((y) => y.ref === x.ref))
  S.bk = {
    ...S.bk,
    [kind]: answer.error ? { ...cur, loading: false, error: answer.error } : { ...cur, items: [...cur.items, ...newItems], page, more: answer.more, loading: false },
  }
  if (answer.error) log(`книги: список не загрузился (${answer.error})`)
  $.ui.invalidate('ui.render')
}

// Язык книг сменили: прежние списки — на старом языке, их ответы уже не нужны
function resetBooks(code) {
  if (code !== S.bk.lang) S.bk = { lang: code, book: emptyBooks(S.bk.book.request + 1), audio: emptyBooks(S.bk.audio.request + 1) }
}
export async function setBookLang($, code) {
  resetBooks(code)
  await $.store.set('booksLang', code)
  $.ui.invalidate('ui.render')
}
// Сменили язык интерфейса: язык книг, который человек не выбирал, идёт за ним
export async function followBookLang($) {
  resetBooks(bookLang(await $.store.get('booksLang'), S.lang))
}

// ━━━━━━━━━━ app/watch ━━━━━━━━━━
// Arcade: YouTube (свои темы и поиск), Twitch, TikTok.

// --- YouTube: темы по работе агента, свежие видео из лент каналов --------------------------------------------------
export const FEED_TTL_MS = 2 * 3_600_000
export const CHANNELS_TTL_MS = 6 * 3_600_000 // список каналов с сайта — не чаще раза в 6 часов
export const TOPICS_TTL_MS = 20 * 60_000 // темы подбираем заново, если с прошлого раза работа агента ушла вперёд
export const YT_FETCH_MS = 8_000 // сколько ждать сайт и каждую ленту
export const YT_MODEL_MS = 20_000 // сколько ждать haiku
export const YT_POOL = 30 // сколько кандидатов каждого языка показывать модели
const SEARCH_TTL_MS = 3 * 3_600_000 // найденное по своей теме помним 3 часа: «Другая подборка» не тратит поиск
const SEARCH_FETCH_MS = 15_000 // поиск сайта опрашивает несколько источников — ждём дольше, чем ленту
export const SEARCH_DAYS = 730 // найденное поиском — не старше двух лет, как и на сайте
export const SHOW_DAYS = 365 // выпуски шоу из поиска — за год: нишевые подкасты выходят нечасто

// Ответ сети или null, если не пришёл за ms: у $.http.fetch своего срока нет. init — метод, заголовки и тело запроса
export function fetchWithin($, url, ms, init = undefined) {
  return new Promise((resolve) => {
    let done = false
    const finish = (value) => {
      if (done) return
      done = true
      resolve(value)
    }
    $.clock.after(ms, () => finish(null))
    const answer = init ? $.http.fetch(url, init) : $.http.fetch(url)
    answer.then(finish, () => finish(null))
  })
}

// Список каналов: сохранённый, если свежий, иначе с сайта; сайт не ответил — старый сохранённый или запас мода
async function ytChannels($, now) {
  let stored = null
  try {
    const saved = await $.store.get('ytChannels')
    stored = saved?.list ? parseChannels(saved.list) : null
    if (stored && now - saved.at < CHANNELS_TTL_MS) return stored
    const response = await fetchWithin($, siteUrl('channels.json'), YT_FETCH_MS)
    const fromSite = response?.ok ? parseChannels(response.text) : null
    if (fromSite) {
      await $.store.set('ytChannels', { at: now, list: fromSite })
      return fromSite
    }
  } catch (err) {
    log(`каналы YouTube с сайта не получены: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  return stored ?? bundledChannels()
}

// Записи ленты канала; лента не ответила — что было в прошлый раз
async function ytFeed($, id, now) {
  const hit = feedCache.get(id)
  if (hit && now - hit.at < FEED_TTL_MS) return hit.entries
  const response = await fetchWithin($, feedUrl(id), YT_FETCH_MS)
  const entries = response?.ok ? parseFeed(response.text) : []
  if (entries.length) feedCache.set(id, { at: now, entries })
  return entries.length ? entries : hit?.entries ?? []
}

// Тема по ключу меню: номер — из подобранных по работе агента, u<id> — своя тема человека
export const topicKey = (text) => (/^u[0-9a-z]+$/.test(text) ? text : Number(text))
export function topicOf(key) {
  return typeof key === 'string' ? S.myTopics.find((t) => `u${t.id}` === key) : S.yt.topics?.[key]
}

// Поиск сайта по своей теме → { list, error }; удачный ответ помним SEARCH_TTL_MS
export async function searchFor($, kind, query, now) {
  const key = `${kind}:${query.toLowerCase()}`
  const hit = searchCache.get(key)
  if (hit && now - hit.at < SEARCH_TTL_MS) return hit.found
  const found = parseSearch(kind, await fetchWithin($, searchUrl(kind, query), SEARCH_FETCH_MS))
  if (found.error) log(`поиск по своей теме (${kind}): ${found.error}`)
  else searchCache.set(key, { at: now, found })
  return found
}

// Почему по своей теме пусто: поиск на сегодня исчерпан, не ответил или ничего не нашёл
export function searchNote(found) {
  if (found?.error === 'limit') return 'Поиск по своей теме на сегодня исчерпан — попробуй завтра.'
  if (found?.error === 'feeds') return 'Подкасты по теме нашлись, но их ленты не ответили. Попробуй чуть позже.'
  if (found?.error) return 'Поиск по своей теме не ответил. Попробуй чуть позже.'
  return 'По этой теме ничего не нашлось — попробуй сказать иначе.'
}

// Своя тема: haiku делает из текста тему с английским запросом; не ответила — текст латиницей сам себе запрос.
// Тема встаёт первой в «Моих темах»; если человек всё ещё в темах раздела kind — открываем её подборку
export async function addTopic($, kind, value) {
  const text = clean(value, 200)
  const say = (note) => {
    S.ownNote = { kind, text: note }
    $.ui.invalidate('ui.render')
  }
  if (text.length < 2) return say('Напиши тему словами — например, «история Рима» или «хлеб на закваске».')
  const request = ++S.ownRequest
  say('Разбираю тему…')
  const now = await $.clock.now()
  let parsed = null
  try {
    const list = await ytChannels($, now)
    const answer = await $.model.complete({ model: 'haiku', ...ownTopicPrompt(text, S.lang, list.directions), maxTokens: 200, timeoutMs: YT_MODEL_MS })
    if (answer.isAnswered) parsed = parseOwnTopic(answer.text, list.directions)
    else log(`своя тема: модель не ответила (${answer.reason})`)
  } catch (err) {
    log(`своя тема не разобрана: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  if (request !== S.ownRequest) return
  parsed ??= plainTopic(text)
  if (!parsed) return say('Не получилось разобрать тему. Попробуй написать её по-английски.')
  if (parsed.refused) return say('Такую тему Arcade не ищет: политика и темы для взрослых — мимо. Попробуй другую.')
  const topic = ownTopic(parsed)
  S.myTopics = rememberTopic(S.myTopics, topic)
  S.ownNote = { kind: '', text: '' }
  try {
    await saveSetting($, 'myTopics', S.myTopics)
  } catch (err) {
    log(`свои темы не сохранены: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  // Человек ушёл из тем этого раздела — тема только запомнилась: подборку открытой страницы не трогаем
  const key = `u${topic.id}`
  if (S.menu !== kind) return $.ui.invalidate('ui.render')
  S.menuFrom = S.menu
  S.menu = `${kind}:${key}`
  S.libraryNotice = ''
  if (kind === 'youtube') loadVideos($, key)
  else loadReads($, kind, key)
}

// «Забыть мои темы»: список пустеет и в $.store
export async function forgetTopics($) {
  S.myTopics = []
  S.ownNote = { kind: '', text: '' }
  $.ui.invalidate('ui.render')
  try {
    await saveSetting($, 'myTopics', [])
  } catch (err) {
    log(`свои темы не стёрты: ${String(err?.message ?? err).slice(0, 200)}`)
  }
}

// --- Twitch: свои каналы и каталог Arcade ---------------------------------------------------------------------------
const TWITCH_TTL_MS = 60_000 // кто в эфире, спрашиваем сайт не чаще раза в минуту — сайт и сам помнит ответ Twitch минуту
const TWITCH_FETCH_MS = 10_000 // сколько ждать сайт: ему самому надо спросить Twitch

// Почему про эфиры не узнать: ключи Twitch у сайта неверные или их нет, лимит, сайт не ответил
export function twitchNote(error) {
  if (error === 'keys') return 'Twitch не принял ключи сайта Arcade — эфиры пока не показать.'
  if (error === 'off') return 'Twitch на сайте Arcade ещё не настроен — эфиры пока не показать.'
  if (error === 'limit') return 'Вопросы к Twitch на сегодня исчерпаны — попробуй завтра.'
  if (error) return 'Сайт Arcade не ответил про эфиры Twitch. Попробуй чуть позже.'
  return ''
}

// Что сайт сказал о каналах logins — поверх прежнего: эфиры других каналов не теряются
function rememberTwitch(logins, found) {
  for (const login of logins) {
    delete S.tw.info[login]
    S.tw.missing.delete(login)
  }
  for (const c of found.channels) S.tw.info[c.login] = c
  for (const login of found.missing) S.tw.missing.add(login)
}

// Кто в эфире: свои каналы и каталог — одним вопросом к сайту. force — «Обновить»: минуту не ждём
export async function loadTwitch($, force = false) {
  const now = await $.clock.now()
  if (S.tw.loading || (!force && !S.tw.error && S.tw.at && now - S.tw.at < TWITCH_TTL_MS)) return
  const request = ++S.tw.request
  const logins = S.tw.channels.map((c) => c.login)
  S.tw.loading = true
  $.ui.invalidate('ui.render')
  const found = parseTwitch(await fetchWithin($, twitchUrl(logins), TWITCH_FETCH_MS))
  if (request !== S.tw.request) return
  S.tw.loading = false
  S.tw.error = found.error
  if (found.error) log(`twitch: ${found.error}`)
  else {
    S.tw.at = now
    rememberTwitch(logins, found)
    S.tw.catalog = found.catalog
  }
  $.ui.invalidate('ui.render')
}

async function saveChannels($) {
  try {
    await saveSetting($, 'twitchChannels', S.tw.channels)
  } catch (err) {
    log(`каналы Twitch не сохранены: ${String(err?.message ?? err).slice(0, 200)}`)
  }
}

// «Добавить канал»: имя или ссылка на twitch.tv; сайт проверяет, что канал есть. Канал встаёт первым в «Моих каналах»
S.addingChannel = 0
export async function addChannel($, value) {
  const say = (note) => {
    S.tw.note = note
    $.ui.invalidate('ui.render')
  }
  const login = twitchLogin(value)
  if (!login) return say('Напиши имя канала Twitch или ссылку на него — например, twitch.tv/tsoding.')
  if (!S.tw.channels.some((c) => c.login === login) && S.tw.channels.length >= MY_CHANNELS) return say('Своих каналов уже 20 — сначала убери какой-нибудь.')
  const request = ++S.addingChannel
  say('Ищу канал на Twitch…')
  const found = parseTwitch(await fetchWithin($, twitchUrl([login]), TWITCH_FETCH_MS))
  if (request !== S.addingChannel) return
  if (found.error) return say(twitchNote(found.error))
  rememberTwitch([login], found)
  const channel = found.channels.find((c) => c.login === login)
  if (!channel) return say('Такого канала нет на Twitch — проверь имя.')
  S.tw.channels = rememberChannel(S.tw.channels, { login, name: channel.name })
  say(`Канал добавлен: ${channel.name}.`)
  await saveChannels($)
}

// «Убрать канал»: из «Моих каналов» и из $.store
export async function removeChannel($, login) {
  const gone = S.tw.channels.find((c) => c.login === login)
  if (!gone) return
  S.tw.channels = S.tw.channels.filter((c) => c.login !== login)
  S.tw.note = `Канал убран: ${S.tw.info[login]?.name ?? gone.name}.`
  if (!S.tw.channels.length && S.menu === 'twitch:remove') {
    S.menuFrom = S.menu
    S.menu = 'twitch'
  }
  $.ui.invalidate('ui.render')
  await saveChannels($)
}

// Каналы для списка страницы /live: свои — если канал свой, иначе каталог; порядок — как в меню
export function twitchList(login) {
  const own = liveFirst(S.tw.channels, S.tw.info).map((c) => c.login)
  return own.includes(login) ? own : S.tw.catalog.map((c) => c.login)
}

// TikTok: лента «Для тебя» или поиск по запросу. В Desktop — встроенный браузер, иначе — браузер по умолчанию: там
// человек, скорее всего, уже вошёл в TikTok
export async function openTiktok($, surface, query) {
  const id = query ? `tiktok:${query}` : 'tiktok'
  if (builtinBrowser(surface)) return desktopWindow($, id, 'TikTok открыт во встроенном браузере Claude.')
  const url = windowUrl(id)
  const command = S.platform ? openUrlCommand(S.platform, url) : null
  if (!command) {
    S.libraryNotice = `TikTok: ${url}`
    return $.ui.invalidate('ui.render')
  }
  S.libraryNotice = 'Открываю браузер…'
  $.ui.invalidate('ui.render')
  try {
    const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
    if (result?.exitCode === 0) {
      S.windowOpenedAt = await $.clock.now() // смотришь в браузере — «агент закончил» придёт системным уведомлением
      windowNotice($, 'TikTok открыт в браузере по умолчанию.')
    } else S.libraryNotice = `TikTok: ${url}`
  } catch (err) {
    S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
  }
  $.ui.invalidate('ui.render')
}

// Темы: haiku читает последнюю работу агента; работы ещё нет или модель не ответила — темы по умолчанию
export async function loadTopics($) {
  const request = ++S.yt.request
  S.yt.loading = 'topics'
  $.ui.invalidate('ui.render')
  const now = await $.clock.now()
  const list = await ytChannels($, now)
  let text = ''
  try {
    const context = contextFrom(await $.session.messages())
    if (context) {
      const answer = await $.model.complete({ model: 'haiku', ...topicsPrompt(context, S.lang, list.directions), maxTokens: 400, timeoutMs: YT_MODEL_MS })
      if (answer.isAnswered) text = answer.text
      else log(`темы YouTube: модель не ответила (${answer.reason})`)
    }
  } catch (err) {
    log(`темы YouTube не подобраны: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  if (request !== S.yt.request) return
  S.yt = { ...S.yt, topics: parseTopics(text, list.directions), topicsAt: now, topicsLang: S.lang, topic: -1, videos: [], seen: new Set(), loading: '', note: '' }
  // Темы новые — подборки статей и подкастов по старым темам не нужны, и их загрузки тоже
  S.reads = { articles: emptyReads(S.reads.articles.request + 1), podcasts: emptyReads(S.reads.podcasts.request + 1) }
  $.ui.invalidate('ui.render')
}

// Подборка по теме: ленты каналов темы → свежие кандидаты → haiku выбирает. Своя тема — ещё и поиск сайта по её
// запросу: найденное идёт к английским видео вперемешку с лентами каналов по направлениям темы. again — другая
// подборка: уже показанные видео не повторяем, пока есть из чего выбрать
export async function loadVideos($, key, again = false) {
  const topic = topicOf(key)
  if (!topic) return
  const request = ++S.yt.request
  const seen = again && S.yt.topic === key ? new Set([...S.yt.seen, ...S.yt.videos.map((v) => v.id)]) : new Set()
  S.yt = { ...S.yt, topic: key, videos: [], loading: 'videos', note: '' }
  $.ui.invalidate('ui.render')
  const now = await $.clock.now()
  let videos = []
  let note = ''
  let used = seen
  try {
    const list = await ytChannels($, now)
    const pool = async (channels, direction) => candidates(await Promise.all(channels.map((c) => ytFeed($, c.id, now))), direction, now)
    const byDirection = (direction) => {
      const { local, en } = channelsFor(list, direction, S.lang, now)
      return Promise.all([pool(local, direction), pool(en, direction)])
    }
    let found = null
    let mine = []
    let english = []
    if (topic.own) {
      const [search, ...lists] = await Promise.all([searchFor($, 'youtube', topic.query, now), ...topic.directions.map(byDirection)])
      found = search
      mine = lists.reduce((all, [l]) => mix(all, l, Infinity), [])
      english = mix(freshFound(search.list, now, SEARCH_DAYS), lists.reduce((all, [, en]) => mix(all, en, Infinity), []), Infinity)
    } else [mine, english] = await byDirection(topic.direction)
    // Всё уже показывали — начинаем круг заново
    if (mine.length + english.length - [...mine, ...english].filter((v) => seen.has(v.id)).length < PICKS) used = new Set()
    mine = mine.filter((v) => !used.has(v.id)).slice(0, YT_POOL)
    english = english.filter((v) => !used.has(v.id)).slice(0, YT_POOL)
    if (!mine.length && !english.length) note = topic.own ? searchNote(found) : 'Не получилось загрузить видео: YouTube не ответил. Попробуй чуть позже.'
    else {
      let ranked = []
      const answer = await $.model.complete({ model: 'haiku', ...picksPrompt(topic, mine, english, S.lang), maxTokens: 300, timeoutMs: YT_MODEL_MS })
      if (answer.isAnswered) ranked = parsePicks(answer.text, [...mine, ...english])
      else log(`видео YouTube: модель не ответила (${answer.reason})`)
      videos = choose(ranked, mine, english)
    }
  } catch (err) {
    note = `Не получилось загрузить видео: ${String(err?.message ?? err).slice(0, 200)}`
  }
  if (request !== S.yt.request) return
  S.yt = { ...S.yt, videos, seen: used, loading: '', note }
  $.ui.invalidate('ui.render')
}

// ━━━━━━━━━━ app/play ━━━━━━━━━━
// Arcade: Денди, Flappy, проверка клавиш, раскладка и ввод.

// Пакует строки из пар [символ, цвет] в строку для Raster — функция из документации модов
export function cellsOf(rows) {
  const numbers = rows.flat().flatMap(([char, color]) => [char.codePointAt(0), color, DEFAULT_COLOR])
  return new Uint8Array(Uint32Array.from(numbers).buffer).toBase64()
}

export function fieldRows() {
  return Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => (x === S.player.x && y === S.player.y ? ['@', PLAYER_COLOR] : ['.', FLOOR_COLOR])),
  )
}

function move(dx, dy) {
  S.player = {
    x: Math.min(COLS - 1, Math.max(0, S.player.x + dx)),
    y: Math.min(ROWS - 1, Math.max(0, S.player.y + dy)),
  }
}

export function startAssign(text) {
  S.mode = 'assign'
  S.assignStep = 0
  S.notice = text
}

function actionOf(key) {
  return ACTIONS.find((a) => S.keymap[a.id].includes(key))
}

function nesButton(id) {
  return Controller[`BUTTON_${ACTIONS.find((a) => a.id === id).nes}`]
}

// Один шаг Денди, два кадра. Повторное нажатие уже зажатой кнопки отпускает её на первый кадр,
// чтобы игра увидела новое нажатие — например, второй выстрел подряд.
export function stepNes() {
  const wanted = new Set(S.taps)
  for (const key of S.heldKeys) {
    const action = actionOf(key)
    if (action) wanted.add(action.id)
  }
  for (const [id, left] of Object.entries(S.holdTicks)) {
    if (left > 0) wanted.add(id)
    if (left <= 1) delete S.holdTicks[id]
    else S.holdTicks[id] = left - 1
  }
  for (const id of S.taps) {
    if (S.down.has(id)) {
      S.nes.buttonUp(1, nesButton(id))
      S.down.delete(id)
    }
  }
  S.taps = new Set()
  S.nes.frame()
  for (const a of ACTIONS) {
    const want = wanted.has(a.id)
    if (want && !S.down.has(a.id)) {
      S.nes.buttonDown(1, nesButton(a.id))
      S.down.add(a.id)
    }
    if (!want && S.down.has(a.id)) {
      S.nes.buttonUp(1, nesButton(a.id))
      S.down.delete(a.id)
    }
  }
  S.nes.frame()
}

export function releaseAll() {
  if (S.nes) for (const id of S.down) S.nes.buttonUp(1, nesButton(id))
  S.down = new Set()
  S.taps = new Set()
  S.heldKeys = []
  S.holdTicks = {}
}

// Текст строки 🎮 в VS Code → новая последняя буква как нажатие. Стирание (текст стал короче) — не нажатие.
// После нажатия строка стирается: при следующей отрисовке ей дают другое «пустое» значение.
export function typedFrom(value) {
  const text = value ?? ''
  const grew = text.length > S.bandLength
  S.bandLength = text.length
  if (!grew) return false
  S.bandResetWanted = true
  return bandKey(Array.from(text).at(-1).toLowerCase())
}

// Буква из строки 🎮: знакомая — нажатие с удержанием; незнакомую пропускаем — переназначение клавиш тут только мешает
function bandKey(char) {
  if (!actionOf(char)) return false
  return typeKey(char)
}

// Enter в поле над вводом — Start
export function pressStart() {
  if (!S.holdTicks.start) S.taps.add('start')
  S.holdTicks.start = HOLD_TICKS_FIRST
}

// Клавиша из поля ввода VS Code: нажатие плюс удержание, пока идёт автоповтор
function typeKey(key) {
  const save = pressKey(key)
  const action = actionOf(key)
  if (action && nesView() && S.mode === 'play') S.holdTicks[action.id] = S.holdTicks[action.id] ? HOLD_TICKS_REPEAT : HOLD_TICKS_FIRST
  return save
}

// Буквы и стрелки; Enter, Tab, пробел и цифры в играх не используются — ими отвечают Claude Code
function usableKey(key) {
  return key.length === 1 ? !/^\d$/.test(key) && key !== ' ' : ARROWS.includes(key)
}

export function toLibrary() {
  releaseAll()
  const g = gameById(S.view)
  S.menu = g?.mine ? 'mine' : g?.shelf ? `shelf:${g.shelf}` : g?.console ?? 'settings' // в список, откуда игру открыли
  S.view = 'library'
  S.mode = 'play'
  S.notice = ''
}

// Одно нажатие клавиши над экраном игры; возвращает true, когда назначение клавиш закончено и его надо сохранить
function pressKey(key) {
  if (key === 'backspace') {
    toLibrary()
    return false
  }
  if (!usableKey(key)) return false
  if (S.mode === 'assign') {
    const action = ACTIONS[S.assignStep]
    for (const a of ACTIONS) S.keymap[a.id] = S.keymap[a.id].filter((c) => c !== key)
    S.keymap[action.id] = [...S.keymap[action.id], key]
    S.assignStep += 1
    if (S.assignStep < ACTIONS.length) return false
    S.mode = 'play'
    S.notice = 'Управление сохранено.'
    return true
  }
  if (IME_CHARS.test(key)) {
    S.notice = 'Похоже, включён метод ввода (японский, китайский или корейский). Выключи его на время игры.'
    return false
  }
  const action = actionOf(key)
  if (!action) {
    startAssign(`Не узнаю клавишу «${key}». Назначим управление под твою раскладку.`)
    return false
  }
  S.notice = ''
  S.pressed = [...S.pressed, key].slice(-16)
  if (S.view === 'field' && action.dx !== undefined) move(action.dx, action.dy)
  if (nesView()) S.taps.add(action.id)
  return false
}

// Сообщение от экрана игры: что зажато сейчас и счётчики нажатий. Данные пришли из кода, поэтому проверяем их.
// Возвращает, надо ли сохранить клавиши и перерисовать панель.
export function readInput(data) {
  const held = Array.isArray(data?.held) ? data.held.filter((k) => typeof k === 'string' && usableKey(k)) : []
  const counts = data?.counts && typeof data.counts === 'object' ? data.counts : {}
  // На поле список зажатых клавиш виден, поэтому его смена — повод перерисовать; экран Денди обновляется сам
  let redraw = S.view === 'field' && held.join(' ') !== S.heldKeys.join(' ')
  S.heldKeys = held
  let save = false
  for (const [key, value] of Object.entries(counts)) {
    if (S.view === 'library') break // Backspace уже увёл в библиотеку — остальные нажатия этого сообщения не для игры
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0) continue
    const before = S.lastCounts[key] ?? 0
    const presses = n >= before ? n - before : n // экран игры создан заново — счёт пошёл с нуля
    S.lastCounts[key] = n
    if (S.paused && presses > 0 && S.view !== 'field') {
      S.paused = false
      S.agentAlert = null
      redraw = true
      continue
    }
    for (let i = 0; i < Math.min(presses, 10); i++) {
      if (pressKey(key)) save = true
      redraw = true
    }
  }
  return { save, redraw }
}

// Открывает игру в панели; romBase64 — сам ROM для игр Денди (встроенный, из кеша или скачанный)
export function launch(id, romBase64) {
  releaseAll()
  S.bandFocusWanted = true
  S.view = id
  S.lastGame = id
  S.notice = ''
  // Своя игра (Flappy Arcade) — движок с тем же устройством, что у эмулятора: кадр, шаг, кнопки
  if (gameById(id)?.engine === 'flappy' && S.nesGame !== id) {
    S.nes = createFlappy(
      (f) => {
        S.frame = f
      },
      {
        best: S.flappyBest,
        onGameOver: (score, best) => {
          if (best <= S.flappyBest) return
          S.flappyBest = best
          S.flappyDirty = true
        },
      },
    )
    S.nesGame = id
    S.nes.frame()
  } else if (romBase64 && S.nesGame !== id) {
    S.nes = createNes(romBase64, (f) => {
      S.frame = f
    })
    S.nesGame = id
    S.nes.frame()
  }
}

// Рекорд Flappy Arcade: хранится в моде, сохраняется при следующем сообщении от экрана игры
S.flappyBest = 0
S.flappyDirty = false

// Строка под экраном Flappy Arcade: что делать и счёт
export function flappyLine() {
  if (!S.nes || S.nes.state === 'ready') return 'Нажми любую кнопку — взлететь'
  if (S.nes.state === 'over') return `Удар! Счёт: ${S.nes.score} · рекорд: ${S.nes.best} — любая кнопка, ещё раз`
  return `Счёт: ${S.nes.score} · рекорд: ${S.nes.best}`
}

// Сейчас в панели игра для Денди или своя (Flappy Arcade)
export function nesView() {
  return Boolean(gameById(S.view)?.rom || gameById(S.view)?.engine)
}

// Отмечает панель открытой; саму панель открывает вызывающий код через $.ui.open
export function markPaneOpen() {
  S.asked = true
  S.askVisible = false
  S.paneOpen = true
  S.paneSeen = true
}

// Панель открывает человек (команда, нажатие): в общем $.store помним, что он держит её открытой, — новые сессии
// откроют её сами (followPane), пока он не закроет её рукой
export async function openPane($) {
  markPaneOpen()
  await $.ui.open({ id: PANE, title: 'Arcade', focus: true, closeOnEscape: true, columns: paneColumns(), rows: PANE_ROWS })
  await $.store.set('paneWanted', true)
}

// Панель оставили открытой в другой сессии — открываем и в этой, один раз и без клавиатуры: человек пришёл к агенту.
// Если панель здесь уже открывали, сама она не открывается: её мог закрыть мод (игра ушла во встроенный браузер).
// Не поместилась (узкое окно, без спроса движок её не ставит) — закрываем, невидимой не держим; попробуем при следующем
// подключении Desktop или VS Code
export async function followPane($) {
  if (S.paneSeen) return
  const wanted = (await $.store.get('paneWanted')) === true
  if (!wanted || S.paneSeen) return
  markPaneOpen()
  const opened = await $.ui.open({ id: PANE, title: 'Arcade', closeOnEscape: true, columns: paneColumns(), rows: PANE_ROWS })
  if (opened?.isPlaced === false) {
    log(`Arcade не открылась сама: ${opened.reason}`)
    await $.ui.close({ id: PANE })
    S.paneSeen = false
    return
  }
  log('Arcade открыта сама: в другой сессии её оставили открытой')
  $.ui.invalidate('ui.render')
}

// Панель закрыли. Человек (крестик, Esc) — новые сессии больше не открывают её сами. Мод (игра ушла в браузер) — открывают
export async function paneClosedBy($, origin) {
  if (origin?.kind === 'person') await $.store.set('paneWanted', false)
}

// Свободные строки под экран Денди: высота панели минус строки интерфейса вокруг экрана
export function freeRows(props) {
  const total = props.placement === 'dock' ? props.scroll?.bodyRows ?? PANE_ROWS : PANE_ROWS
  return Math.max(8, total - UI_ROWS)
}

export function pixelMode() {
  return S.graphics === 'pixels' || (S.graphics === 'auto' && !S.pixelsFailed)
}

export function graphicsLabel() {
  const effective = S.graphics === 'auto' ? ` (сейчас ${S.pixelsFailed ? 'символы' : 'пиксели'})` : ''
  return `Графика: ${GRAPHICS_LABEL[S.graphics]}${effective}`
}

// Экран Денди для Raster или Image — то, что рисуется в панели и что отправляет $.ui.blit
export function screenContent() {
  return pixelMode() ? { source: { png: frameToPng(S.frame) } } : { cells: frameToQuadrants(S.frame, S.screen.columns, S.screen.rows) }
}

// Игровой цикл Денди: таймер есть, только пока открыта панель с игрой. Раньше он тикал 30 раз в секунду всегда,
// в каждой сессии Claude, и впустую грузил процессор. Заводит его отрисовка панели (игру открыли — панель
// перерисовалась), снимает сам себя. В Desktop и VS Code кадр уходит перерисовкой панели (Svg), в терминале — $.ui.blit.
let gameLoop = null
const gameOn = () => nesView() && S.paneOpen && Boolean(S.nes)

export function runGameLoop($) {
  if (gameLoop || !gameOn()) return
  gameLoop = $.clock.every(TICK_MS, () => gameTick($))
}

async function gameTick($) {
  if (!gameOn()) {
    gameLoop?.cancel()
    gameLoop = null
    return
  }
  if (S.paused) return
  if (S.remoteSurface) {
    stepNes()
    $.ui.invalidate('ui.render')
    return
  }
  if (!S.screen) return
  stepNes()
  const pixels = pixelMode()
  let shown = false
  try {
    const result = await $.ui.blit({ requestId: PANE, key: 'arcade-screen', columns: S.screen.columns, rows: S.screen.rows, ...screenContent() })
    shown = !result?.deny
  } catch {
    // Экран ещё не нарисован, панель закрывается или терминал не показывает картинки
  }
  if (shown) {
    S.denies = 0
    return
  }
  S.denies += 1
  if (pixels && S.graphics === 'auto' && S.denies >= PIXEL_DENIES) {
    S.pixelsFailed = true
    S.denies = 0
    S.notice = 'Этот терминал не показывает картинки — рисую символами. Как получить пиксели — в README.'
    $.ui.invalidate('ui.render')
  }
}

export function first(id) {
  return S.keymap[id].find((k) => !ARROWS.includes(k)) ?? S.keymap[id][0] ?? '?'
}

// ━━━━━━━━━━ app/talk ━━━━━━━━━━
// Arcade: друзья, чаты, уведомления, «в сети» и приглашения.

// --- Друзья: взаимные заявки по точному @нику ----------------------------------------------------------------------

// Почему с друзьями не вышло
function friendsNote(error, handle) {
  if (error === 'invalid') return handleNote('invalid', handle)
  if (error === 'self') return 'Это твой ник.'
  if (error === 'nobody') return `@${handle} не найден — проверь ник.`
  if (error === 'gone') return 'Этой заявки уже нет.'
  if (error === 'nohandle') return 'Сначала возьми свой @ник.'
  if (error === 'full') return 'Друзей и твоих заявок уже слишком много — удали кого-нибудь.'
  if (error === 'busy') return `У @${handle} слишком много заявок — попробуй позже.`
  if (error === 'often') return 'Заявок сегодня слишком много — попробуй завтра.'
  return accountNote(error)
}

// Вопрос к сайту про друзей: список (без body) или действие — заявка, принять, отклонить, отменить, удалить. Пока
// действие ждёт ответа, другие не начинаются. done — заметка, если действие прошло; у заявки она — по ответу сайта
export async function friendsCall($, name, body, handle = '', done = '') {
  const session = S.acct.session
  if (!session || S.fr.busy) return
  const request = ++S.fr.request
  if (body) S.fr.busy = name
  else S.fr.loading = true
  $.ui.invalidate('ui.render')
  const answer = parseFriends(await accountFetch($, name, body ? { method: 'POST', body, token: session.token } : { token: session.token }))
  if (S.acct.session !== session || request !== S.fr.request) return
  S.fr.busy = ''
  S.fr.loading = false
  if (answer.error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (answer.error) {
    S.fr.note = friendsNote(answer.error, handle)
    S.fr.bad = true
  } else {
    S.fr.list = { friends: answer.friends, incoming: answer.incoming, outgoing: answer.outgoing }
    S.acct.friends = answer.friends.length
    S.acct.requests = answer.incoming.length
    // Список без действия: прежняя заметка об успехе остаётся, об ошибке — уходит
    if (body) S.fr.note = answer.status === 'sent' ? `Заявка отправлена: @${handle} увидит её у себя в «Друзьях».` : answer.status === 'friends' ? `Теперь вы с @${handle} друзья.` : done
    else if (S.fr.bad) S.fr.note = ''
    S.fr.bad = false
    // Удалили последнего друга — выбирать больше некого
    if (!answer.friends.length && S.menu === 'friends:remove') {
      S.menuFrom = S.menu
      S.menu = 'friends'
    }
  }
  $.ui.invalidate('ui.render')
}

// «Добавить друга»: заявка по точному @нику. Ник не того вида или свой — сразу здесь, заявку на это не тратим
export async function addFriend($, text) {
  const handle = normalHandle(text)
  if (!handle || S.fr.busy) return
  const problem = !HANDLE.test(handle) ? 'invalid' : handle === S.acct.handle ? 'self' : ''
  if (problem) {
    S.fr.note = friendsNote(problem, handle)
    S.fr.bad = true
    return $.ui.invalidate('ui.render')
  }
  await friendsCall($, 'friends', { handle }, handle)
}

// --- Чаты: с друзьями один на один и в группах ---------------------------------------------------------------------
export const CHAT_POLL_MS = 4_000 // открытый чат: новые сообщения
export const CHATS_POLL_MS = 15_000 // список чатов: новые чаты и непрочитанные
const CHAT_KEPT = 1000 // сколько сообщений открытого чата держим в памяти
export const CHAT_SPLIT = 70 // с такой ширины панели (в знаках) список чатов стоит слева от переписки, как в Telegram
// Цвета чата в Desktop и VS Code — с прозрачностью: годятся и для светлой темы, и для тёмной
export const CHAT_WALL = '#5b8fc714' // фон переписки
export const CHAT_MINE = '#3a78b540' // своё сообщение
export const CHAT_THEIRS = '#80808026' // чужое
export const CHAT_PICKED = '#3a78b533' // открытый чат в списке
export const CHAT_HOVER = '#8080801a' // строка списка под мышью

// Почему с чатами не вышло; group — создавали группу: у групп свой предел на сутки
export function chatNote(error, group = false) {
  if (error === 'often' || error === 'limit') return group ? 'Групп сегодня создано слишком много — попробуй завтра.' : 'Слишком часто — подожди минуту.'
  if (error === 'friend') return 'Писать можно только друзьям.'
  if (error === 'gone') return 'Этого чата больше нет.'
  if (error === 'long') return 'Сообщение длиннее 2000 знаков.'
  if (error === 'name') return 'Назови группу.'
  if (error === 'empty') return 'Отметь хотя бы одного друга.'
  if (error === 'nohandle') return 'Сначала возьми свой @ник.'
  if (error === 'full') return 'В группе может быть не больше 50 человек.'
  if (error === 'owner') return 'Это может только тот, кто управляет группой.'
  if (error === 'off') return 'Чаты на сайте сейчас выключены.'
  if (error === 'edit') return 'Этого сообщения уже нет.'
  return accountNote(error)
}

// Кто это в чате: @ник; ника нет — аккаунт удалён
export function chatPerson(id) {
  if (S.ch.names[id]) return `@${S.ch.names[id]}`
  if (id && id === S.ch.me && S.acct.handle) return `@${S.acct.handle}`
  return tr('удалённый аккаунт', S.lang)
}

// Название чата: с другом — его @ник, группы — её название
export const chatTitle = (chat) => (chat.kind === 'dm' ? chatPerson(chat.with) : chat.name || tr('Группа', S.lang))

// Аватарка человека: его картинка из AVATAR_COUNT; не выбрал — первая буква ника на цвете от ника, как на сайте
export function personSvg(id) {
  const handle = S.ch.names[id] || (id && id === S.ch.me ? S.acct.handle : '')
  return picSvg(S.ch.pics[id], handle || '?', handle || id)
}

// Картинка чата: с другом — его аватарка, группы — её картинка или буква названия на цвете от номера чата
export const chatSvg = (chat) => (chat.kind === 'dm' ? personSvg(chat.with) : picSvg(chat.pic, chat.name || tr('Группа', S.lang), chat.id))

// Друг в сети: по отметке «в сети» мода или по списку чатов с сайта
export const isOnline = (id) => S.ol.online.has(id) || S.ch.online.includes(id)

// Таблица аватарок без этих номеров
export const withoutPics = (pics, ids) => Object.fromEntries(Object.entries(pics).filter(([id]) => !ids.includes(id)))

// Аватарки после ответа сайта: за кого он ответил (ники в names и сам человек) — как сказал он, убранная — убрана;
// остальные — как были
const mergePics = (pics, answer) => ({ ...withoutPics(pics, [...Object.keys(answer.names), answer.me]), ...answer.pics })

// Служебное сообщение словами на языке интерфейса: шаблон переводится, ники и название группы — нет
export function serviceText(m) {
  const d = describe(m)
  const named = m.k === 'create' || m.k === 'name'
  return fill(tr(d.text, S.lang), d.values.map((v, k) => (k === 1 && named ? v : chatPerson(v))))
}

// Переписка вместе с новыми сообщениями: без повторов, по порядку номеров; поправленное заменяет прежнее, удалённое
// остаётся без текста (d) — на экран его не выводят
function mergeMessages(old, arrived) {
  const all = new Map(old.map((m) => [m.s, m]))
  for (const m of arrived) all.set(m.s, m)
  return [...all.values()].sort((a, b) => a.s - b.s)
}

// Название группы из поля: одной строкой, не длиннее MAX_NAME
const groupTitle = (text) => [...oneLine(text)].slice(0, MAX_NAME).join('')

// Вопрос к сайту про чаты, ответ разбирает parse; с body — POST. Сайт не принял ключ сессии — забываем вход. Вход
// пропал или сменился, пока ждали, — null: ответ уже не нужен
export async function chatFetch($, name, parse, { body, query } = {}) {
  const session = S.acct.session
  if (!session) return null
  const answer = parse(await accountFetch($, name, { method: body === undefined ? 'GET' : 'POST', body, query, token: session.token }))
  if (S.acct.session !== session) return null
  if (answer.error !== 'auth') return answer
  await forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  return null
}

// Список чатов; quiet — по таймеру: заметку не трогаем и перерисовываем, только если что-то поменялось
export async function loadChats($, quiet = false) {
  if (!S.acct.session || S.ch.loading) return
  S.ch.loading = true
  if (!quiet) $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'chats', parseChats)
  if (!answer) return
  S.ch.loading = false
  if (answer.error) {
    if (quiet) return
    S.ch.note = chatNote(answer.error)
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  const changed = applyChats(answer)
  if (!quiet || changed) $.ui.invalidate('ui.render')
}

// Список чатов с сайта — в мод; true — что-то поменялось
function applyChats(answer) {
  const seen = () => JSON.stringify([S.ch.list, S.ch.names, S.ch.pics, S.ch.online, S.acct.unread])
  const before = seen()
  S.ch.list = answer.chats
  S.ch.names = { ...S.ch.names, ...answer.names }
  S.ch.pics = mergePics(S.ch.pics, answer)
  S.ch.online = answer.online
  S.ch.me = answer.me
  S.acct.unread = answer.unread
  return seen() !== before
}

// Открыть чат: последние сообщения с сайта; сайт заодно отмечает их прочитанными
export async function openChat($, id) {
  if (!S.acct.session) return
  const request = ++S.ch.request
  if (S.menu !== 'chats:talk') {
    S.menuFrom = S.menu
    S.menu = 'chats:talk'
  }
  S.libraryNotice = ''
  // Поле «Сообщение» — новое: недописанное в другом чате сюда не переходит
  Object.assign(S.ch, { talk: id, about: null, messages: [], first: 0, shown: CHAT_SHOWN, opening: true, older: false, note: '', bad: false, confirmLeave: false, field: S.ch.field + 1, ...NO_MSG_MENU })
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'messages', parseMessages, { query: { chat: id } })
  if (!answer || request !== S.ch.request) return
  S.ch.opening = false
  if (answer.error) {
    S.ch.note = chatNote(answer.error)
    S.ch.bad = true
  } else {
    S.ch.me = answer.me
    S.ch.about = answer.chat
    S.ch.messages = answer.messages
    S.ch.first = answer.first
    S.ch.names = { ...S.ch.names, ...answer.names }
    S.ch.pics = mergePics(S.ch.pics, answer)
    S.acct.unread = answer.unread
    const entry = S.ch.list?.find((c) => c.id === id)
    if (entry) entry.unread = 0
    // Чата ещё нет в списке (только что создан) — список с сайта: в широкой панели он виден рядом
    else await loadChats($, true)
  }
  $.ui.invalidate('ui.render')
}

// Новые сообщения открытого чата — по таймеру, пока он на экране, и с ними поправленные и удалённые после прошлого
// раза (edits). Ошибки молча: спросим ещё раз; только если чата больше нет — заметка, и спрашивать перестаём
export async function pollChat($) {
  const id = S.ch.talk
  if (!S.acct.session || S.ch.polling || S.ch.opening || S.ch.about?.id !== id) return
  S.ch.polling = true
  const after = String(S.ch.messages.at(-1)?.s ?? 0)
  const answer = await chatFetch($, 'messages', parseMessages, { query: { chat: id, after, edits: String(S.ch.about.edits ?? 0) } })
  if (!answer) return
  S.ch.polling = false
  if (S.ch.talk !== id || S.ch.about?.id !== id) return
  if (answer.error) {
    if (answer.error !== 'gone') return
    S.ch.about = null
    S.ch.note = chatNote('gone')
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  const seen = () => JSON.stringify([S.ch.about, S.ch.messages.length, S.ch.messages.at(-1)?.s, S.ch.pics, S.acct.unread])
  const before = seen()
  // Поправленные раньше загруженных не берём: «Раньше» принесёт их уже свежими
  const start = S.ch.messages[0]?.s ?? 0
  S.ch.messages = mergeMessages(S.ch.messages, answer.messages.filter((m) => m.s >= start)).slice(-CHAT_KEPT)
  // Сообщение с правкой или открытым меню удалили в другом окне — правка и меню ни к чему
  const removed = (s) => s && S.ch.messages.find((m) => m.s === s)?.d
  if (removed(S.ch.editing)) stopEditing($)
  else if (removed(S.ch.msgMenu)) Object.assign(S.ch, { msgMenu: 0, confirmDelete: 0 })
  S.ch.about = answer.chat
  S.ch.names = { ...S.ch.names, ...answer.names }
  S.ch.pics = mergePics(S.ch.pics, answer)
  S.acct.unread = answer.unread
  if (seen() !== before) $.ui.invalidate('ui.render')
}

// Переписка на экране: удалённые сообщения не показываем
export const visibleMessages = () => S.ch.messages.filter((m) => !m.d)

// Есть ли сообщения раньше показанных: уже загруженные или ещё на сайте
export const olderShown = () => visibleMessages().length > S.ch.shown || (S.ch.messages.length > 0 && S.ch.messages.length < CHAT_KEPT && S.ch.messages[0].s > S.ch.first)

// «Раньше»: показать ещё CHAT_SHOWN сообщений; загруженные кончились — спросить у сайта более ранние
export async function olderMessages($) {
  const id = S.ch.talk
  if (visibleMessages().length > S.ch.shown) {
    S.ch.shown += CHAT_SHOWN
    return $.ui.invalidate('ui.render')
  }
  if (!S.acct.session || S.ch.older || !olderShown()) return
  S.ch.older = true
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'messages', parseMessages, { query: { chat: id, before: String(S.ch.messages[0].s) } })
  if (!answer) return
  S.ch.older = false
  if (S.ch.talk !== id) return
  if (answer.error) {
    S.ch.note = chatNote(answer.error)
    S.ch.bad = true
  } else {
    S.ch.messages = mergeMessages(answer.messages, S.ch.messages)
    S.ch.names = { ...S.ch.names, ...answer.names }
    S.ch.pics = mergePics(S.ch.pics, answer)
    S.ch.shown += CHAT_SHOWN
  }
  $.ui.invalidate('ui.render')
}

// Отправить сообщение из поля «Сообщение». Ушло — поле новое, пустое, и фокус снова в нём; нет — текст остаётся в поле
export async function sendMessage($, value) {
  const id = S.ch.talk
  const text = cleanText(value).trim()
  if (!text || !S.acct.session || S.ch.busy || S.ch.about?.id !== id) return
  if (text.length > MAX_TEXT) {
    S.ch.note = chatNote('long')
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  S.ch.busy = 'send'
  S.ch.note = ''
  S.ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'send', parseSent, { body: { chat: id, text } })
  if (!answer) return
  S.ch.busy = ''
  if (S.ch.talk !== id) return $.ui.invalidate('ui.render')
  if (answer.error) {
    S.ch.note = chatNote(answer.error)
    S.ch.bad = true
    if (answer.error === 'gone') S.ch.about = null
  } else {
    S.ch.messages = mergeMessages(S.ch.messages, [answer.msg]).slice(-CHAT_KEPT)
    // В списке чатов этот — сразу наверх и с этим сообщением, не дожидаясь таймера
    const entry = S.ch.list?.find((c) => c.id === id)
    if (entry) {
      entry.last = { f: answer.msg.f, t: oneLine(answer.msg.t) }
      entry.at = answer.msg.at
      S.ch.list = [entry, ...S.ch.list.filter((c) => c !== entry)]
    }
    freshField($)
  }
  $.ui.invalidate('ui.render')
}

// Поле внизу переписки — новое, пустое, и фокус в нём
function freshField($) {
  S.ch.field++
  const key = `arcade-chat-input-${S.ch.field}`
  $.clock.after(50, async () => {
    try {
      await $.ui.focus({ requestId: PANE, key })
    } catch {
      // панель уже закрыли или поле не на экране
    }
  })
}

// --- Своё сообщение: ⋮ — меню «Изменить» и «Удалить» ---------------------------------------------------------------

// Меню и правку — закрыть; правили — внизу снова новое, пустое поле «Сообщение»
export function stopEditing($) {
  const editing = S.ch.editing
  Object.assign(S.ch, NO_MSG_MENU)
  if (editing) freshField($)
}

// ⋮ у сообщения s: открыть его меню или закрыть
export function toggleMsgMenu(s) {
  const open = S.ch.msgMenu === s
  S.ch.msgMenu = open ? 0 : s
  S.ch.confirmDelete = 0
}

// «Изменить»: текст сообщения s — в поле внизу, править там
export function startEditing($, s) {
  S.ch.note = ''
  S.ch.bad = false
  Object.assign(S.ch, NO_MSG_MENU, { editing: s })
  freshField($)
}

// «Сохранить» правку сообщения s. Тот же текст — сайт не спрашиваем; пусто — не сохраняем
export async function editMessage($, s, value) {
  const text = cleanText(value).trim()
  const old = S.ch.messages.find((m) => m.s === s)
  if (!text || !old || old.d) return
  if (text === old.t) {
    stopEditing($)
    return $.ui.invalidate('ui.render')
  }
  if (text.length > MAX_TEXT) {
    S.ch.note = chatNote('long')
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  await changeMessage($, 'editmsg', { s, text })
}

// «Удалить» сообщение s — у всех в чате
export async function deleteMessage($, s) {
  await changeMessage($, 'delmsg', { s })
}

// Правка или удаление на сайте. Вышло — сообщение в переписке новое, меню и правка закрыты, список чатов — с сайта:
// последнее сообщение в нём могло смениться. Нет — правка остаётся в поле
async function changeMessage($, name, body) {
  const id = S.ch.talk
  if (!S.acct.session || S.ch.busy || S.ch.about?.id !== id) return
  S.ch.busy = name === 'editmsg' ? 'edit' : 'delete'
  S.ch.note = ''
  S.ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, name, parseSent, { body: { chat: id, ...body } })
  if (!answer) return
  S.ch.busy = ''
  if (S.ch.talk !== id) return $.ui.invalidate('ui.render')
  if (answer.error) {
    S.ch.note = chatNote(answer.error)
    S.ch.bad = true
    if (answer.error === 'gone') S.ch.about = null
    S.ch.confirmDelete = 0
  } else {
    S.ch.messages = mergeMessages(S.ch.messages, [answer.msg])
    // Удалили не то, что правится, — правка остаётся
    if (name === 'editmsg' || S.ch.editing === body.s) stopEditing($)
    else Object.assign(S.ch, { msgMenu: 0, confirmDelete: 0 })
    loadChats($, true).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
  }
  $.ui.invalidate('ui.render')
}

// «Написать» другу: чат двоих у пары один, сайт отдаёт его или заводит новый
export async function openDm($, friend) {
  if (!S.acct.session || S.ch.busy) return
  S.ch.busy = 'open'
  S.ch.note = ''
  S.ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'opendm', parseChat, { body: { with: friend } })
  if (!answer) return
  S.ch.busy = ''
  if (answer.error || !answer.chat) {
    S.ch.note = chatNote(answer.error || 'down')
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  await openChat($, answer.chat.id)
}

// «Создать группу» из отмеченных друзей; all — «Группа со всеми друзьями» (без своего названия — «Все друзья»)
export async function createGroup($, all = false) {
  if (!S.acct.session || S.ch.busy) return
  const friends = S.fr.list?.friends ?? []
  const members = [...S.ch.picked].filter((id) => friends.some((p) => p.id === id))
  const name = groupTitle(S.ch.groupName) || (all ? tr('Все друзья', S.lang) : '')
  const problem = all ? (friends.length ? '' : 'nobody') : !members.length ? 'empty' : !name ? 'name' : ''
  if (problem) {
    S.ch.note = problem === 'nobody' ? 'Друзей пока нет — добавь кого-нибудь по @нику.' : chatNote(problem)
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  S.ch.busy = 'group'
  S.ch.note = ''
  S.ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'group', parseChat, { body: all ? { name, all: true } : { name, members } })
  if (!answer) return
  S.ch.busy = ''
  if (answer.error || !answer.chat) {
    S.ch.note = chatNote(answer.error || 'down', true)
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  S.ch.picked = new Set()
  S.ch.groupName = ''
  S.ch.field += 1
  await openChat($, answer.chat.id)
}

// Участники и название группы: добавить, убрать, переименовать — может хозяин; выйти — любой. done — заметка, если вышло
export async function changeMembers($, body, done = '') {
  const id = S.ch.talk
  if (!S.acct.session || S.ch.busy || S.ch.about?.id !== id) return
  S.ch.busy = 'members'
  S.ch.note = ''
  S.ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'members', parseChat, { body: { chat: id, ...body } })
  if (!answer) return
  S.ch.busy = ''
  if (S.ch.talk !== id) return $.ui.invalidate('ui.render')
  if (answer.error || (!answer.left && !answer.chat)) {
    S.ch.note = chatNote(answer.error || 'down')
    S.ch.bad = true
    if (answer.error === 'gone') S.ch.about = null
  } else if (answer.left) {
    // Вышел — чата у человека больше нет: назад к списку
    Object.assign(S.ch, { talk: '', about: null, messages: [], confirmLeave: false, note: 'Ты больше не в этой группе.', bad: false })
    S.menuFrom = S.menu
    S.menu = 'chats'
    loadChats($, true).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
  } else {
    S.ch.about = answer.chat
    // Название и картинка группы — и в списке чатов: в широкой панели он виден рядом
    const entry = S.ch.list?.find((c) => c.id === answer.chat.id)
    if (entry) Object.assign(entry, { name: answer.chat.name, pic: answer.chat.pic })
    S.ch.note = done
    S.ch.field += 1
    // Служебное сообщение о перемене — в переписку сразу
    pollChat($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
  }
  $.ui.invalidate('ui.render')
}

// «Переименовать»: то же название — сайт не спрашиваем
export async function renameGroup($, value) {
  const name = groupTitle(value)
  if (!name) {
    S.ch.note = chatNote('name')
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  if (name !== S.ch.about?.name) await changeMembers($, { name }, 'Название группы изменено.')
}

// «Выйти из группы»: первое нажатие спрашивает «точно?», второе — выходит
export async function leaveGroup($) {
  if (!S.ch.confirmLeave) {
    S.ch.confirmLeave = true
    S.ch.note = ''
    return $.ui.invalidate('ui.render')
  }
  S.ch.confirmLeave = false
  await changeMembers($, { leave: true })
}

// Сколько непрочитанных — для плитки «Чаты», если сайт ещё не знает отметки «в сети»
async function checkUnread($) {
  if (!S.acct.handle) return
  const answer = await chatFetch($, 'unread', parseUnread)
  if (!answer || answer.error || answer.unread === S.acct.unread) return
  S.acct.unread = answer.unread
  $.ui.invalidate('ui.render')
}

// --- Всплывающие уведомления о сообщениях ---------------------------------------------------------------------------
// Как у мессенджеров: новое сообщение — карточка внизу слева поверх всех окон, сама прячется; клик — этот чат в панели.
// Сколько непрочитанных спрашиваем и при закрытой панели; список чатов — только когда это число поменялось
export const POPUP_POLL_MS = 20_000
const POPUP_SLOTS = 3 // столько карточек сразу, одна над другой
const POPUP_RUN_MS = 300_000 // карточка прячется сама; это — если PowerShell повис
S.msgNotify = true // всплывающие уведомления о сообщениях — настройка этого компьютера, на сайт не уходит
// session — для какого входа; seen — сколько непрочитанных было в прошлый раз; started — первый список уже видели:
// что пришло до запуска, не всплывает; waiting — карточкам не хватило места, спросить список ещё раз
const noPopups = (session = null) => ({ session, seen: -1, started: false, waiting: false })
S.pop = noPopups()
S.popBusy = false // вопрос к сайту в пути
const popSlots = new Set() // занятые места карточек: 0 — нижнее

// Чат сейчас на экране — о нём не всплываем
const chatOnScreen = (id) => S.paneOpen && S.view === 'library' && S.menu === 'chats:talk' && S.ch.talk === id

// Карточка о чате: с другом — его ник и аватарка; группа — название и картинка, перед текстом — кто написал
function popupFor(chat) {
  const service = chat.last.k !== undefined
  const text = service ? serviceText(chat.last) : chat.last.t
  const windows = S.platform === 'windows'
  if (chat.kind === 'dm') {
    const handle = S.ch.names[chat.with] || ''
    return { title: chatPerson(chat.with), text, pic: windows ? avatarXaml(S.ch.pics[chat.with], handle || '?', handle || chat.with) : '' }
  }
  const title = chatTitle(chat)
  return { title, text: service ? text : `${chatPerson(chat.last.f)}: ${text}`, pic: windows ? avatarXaml(chat.pic, title, chat.id) : '' }
}

// Раз в POPUP_POLL_MS: пришло новое — карточка. В первый раз только запоминаем, что уже есть
export async function watchMessages($) {
  const session = S.acct.session
  if (!S.msgNotify || !session || !S.acct.handle || !S.platform || S.popBusy) return
  if (S.pop.session !== session) S.pop = noPopups(session)
  S.popBusy = true
  try {
    const count = await chatFetch($, 'unread', parseUnread)
    if (!count || count.error || S.pop.session !== session) return
    if (count.unread !== S.acct.unread) {
      S.acct.unread = count.unread
      $.ui.invalidate('ui.render')
    }
    const changed = count.unread !== S.pop.seen
    S.pop.seen = count.unread
    // Непрочитанных нет — всплывать не о чем; столько же, сколько было, — нового нет
    if (count.unread === 0) Object.assign(S.pop, { started: true, waiting: false })
    if (count.unread === 0 || (S.pop.started && !changed && !S.pop.waiting)) return
    const answer = await chatFetch($, 'chats', parseChats)
    if (!answer || answer.error || S.pop.session !== session) return
    if (applyChats(answer)) $.ui.invalidate('ui.render')
    await popChats($, answer)
  } finally {
    S.popBusy = false
  }
}

// Карточки о новых сообщениях. Что всплыло, — сразу в $.store: другая сессия Claude Code о том же не всплывёт.
// Места не хватило — остальные в следующий раз
async function popChats($, answer) {
  const popped = restorePopped(await $.store.get('chatPopups'))
  const first = !S.pop.started
  Object.assign(S.pop, { started: true, waiting: false })
  const show = []
  for (const chat of popupChats(answer.chats, answer.me, popped)) {
    if (!first && !chatOnScreen(chat.id)) {
      const slot = [...Array(POPUP_SLOTS).keys()].find((n) => !popSlots.has(n) && !show.some((s) => s.slot === n))
      if (slot === undefined) {
        S.pop.waiting = true
        continue
      }
      show.push({ chat, slot })
    }
    popped[chat.id] = chat.at
  }
  await $.store.set('chatPopups', keepPopped(popped))
  for (const { chat, slot } of show) showPopup($, chat, slot)
}

// Карточка на своём месте; клик по ней — этот чат в панели. Место освободилось, а кто-то ждёт, — спрашиваем сразу
function showPopup($, chat, slot) {
  const command = popupCommand(S.platform, { ...popupFor(chat), slot })
  if (!command) return
  popSlots.add(slot)
  $.clock.after(0, async () => {
    try {
      const result = await $.process.run(command.argv, { env: command.env, timeoutMs: POPUP_RUN_MS })
      if (result.stdout.includes('open')) await openFromPopup($, chat.id)
    } catch (err) {
      log(`уведомление о сообщении не показалось: ${err?.message ?? err}`)
    } finally {
      popSlots.delete(slot)
      if (S.pop.waiting) watchMessages($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    }
  })
}

// Клик по карточке: панель Arcade на этом чате; «Назад» из него — к списку чатов
async function openFromPopup($, id) {
  if (!S.acct.session) return
  if (S.view !== 'library') toLibrary()
  S.menu = 'chats'
  S.libraryNotice = ''
  await openPane($)
  await openChat($, id)
  loadChats($, true).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
}

// --- Уведомления о сессиях -----------------------------------------------------------------------------------------
// «Ждёт тебя» и «закончил ход» — карточкой поверх всех окон и со звуком (alerts.js). Объявляет одна сессия на
// компьютере: заявка в $.store, выждать, перечитать — как напоминания календаря. Первой — та, где человек был
// последним: клик по карточке откроет «Агентов» в ней
const LOOK_MS = 10_000 // «человек здесь» в отметке обновляется не чаще раза в столько
const ALERT_DEFER_MS = 5_000 // сессия, где человека не было, объявляет на столько позже: пусть успеет та, где он был

// Человек что-то сделал в этой сессии (написал или нажал в панели) — отметить. Ошибка здесь ничего не ломает
export async function lookHere($) {
  try {
    const ag = S.ag
    if (!ag?.on) return
    const now = await $.clock.now()
    if (now - ag.look >= LOOK_MS) ag.look = now
  } catch (err) {
    log(`отметка сессии: ${err?.message ?? err}`)
  }
}

// Какую сессию человек смотрит: где он что-то делал последним. Никого — ''
const watchedOf = (all) => all.reduce((best, r) => (r.look > (best?.look ?? 0) ? r : best), null)?.sid ?? ''

// Шаг уведомлений — из agentsTick, после всплывашек: забыть, что уже неактуально (ответили, сессию скрыли или
// закрыли, уведомление выключили); копится дольше ALERT_GATHER_MS — объявить
function alertsTick($, all, now) {
  const al = S.al
  if (al.busy || !al.pending.size) return
  const by = new Map(all.map((r) => [r.sid, r]))
  for (const [key, ev] of al.pending) {
    const r = by.get(ev.sid)
    if (!r || S.agHidden.includes(ev.sid) || seenOf(r) !== ev.seen || !alertOn(ev.what)) al.pending.delete(key)
  }
  if (!al.pending.size) return
  const watched = watchedOf(all)
  const gather = ALERT_GATHER_MS + (watched && watched !== S.ag.sid ? ALERT_DEFER_MS : 0)
  const oldest = Math.min(...[...al.pending.values()].map((ev) => ev.at))
  if (now - oldest < gather) return
  al.busy = true
  $.clock.after(0, async () => {
    try {
      await announce($, watched)
    } catch (err) {
      log(`уведомление о сессиях не показалось: ${err?.message ?? err}`)
    } finally {
      al.busy = false
    }
  })
}

// Объявить накопленное: что уже объявила другая сессия — забыть; объявляли меньше ALERT_GAP_MS назад — подождать.
// Заявка: записать в $.store, выждать CAL_CLAIM_MS, перечитать — осталась моя, значит объявляю я
async function announce($, watched) {
  const al = S.al
  // Плитки могли переключить в другой сессии — объявить по тому, что выбрано сейчас
  S.agNotify = (await $.store.get('agentsNotify')) !== false
  S.agDone = (await $.store.get('agentsDone')) === true
  S.agOs = (await $.store.get('agentsOs')) !== false
  S.agSound = (await $.store.get('agentsSound')) !== false
  for (const [key, ev] of al.pending) if (!alertOn(ev.what)) al.pending.delete(key)
  const now = await $.clock.now()
  const was = restoreAlerts(await $.store.get(ALERTS_KEY), now)
  for (const key of al.pending.keys()) if (was.told[key]) al.pending.delete(key)
  // last 0 — ещё не объявляли
  if (!al.pending.size || (was.last > 0 && now - was.last < ALERT_GAP_MS)) return
  const batch = [...al.pending.values()]
  const told = { ...was.told }
  for (const ev of batch) told[ev.key] = now
  await $.store.set(ALERTS_KEY, { by: me, last: now, told: keepTold(told) })
  await $.clock.sleep(CAL_CLAIM_MS)
  const after = restoreAlerts(await $.store.get(ALERTS_KEY), await $.clock.now())
  if (after.by !== me) {
    for (const key of al.pending.keys()) if (after.told[key]) al.pending.delete(key)
    return
  }
  for (const ev of batch) al.pending.delete(ev.key)
  showAlert($, batch, watched)
}

// Карточка о пачке. Впереди окно Claude Code — без сессии, которую человек смотрит (одна она — карточки нет); это
// узнаёт сама карточка, только на Windows. Клик — окно Claude Code впереди, в панели Arcade — «Агенты»
function showAlert($, batch, watched) {
  const t = (text) => tr(text, S.lang)
  const said = alertText(batch, t)
  if (!said) return
  const rest = batch.filter((ev) => ev.sid !== watched)
  const fg = rest.length === batch.length ? undefined : (alertText(rest, t) ?? null)
  const lead = batch.find((ev) => ev.what !== 'done') ?? batch[0]
  const free = [...Array(POPUP_SLOTS).keys()].find((n) => !popSlots.has(n))
  const slot = free ?? 0
  const command = popupCommand(S.platform, {
    title: said.title,
    text: said.text,
    pic: S.platform === 'windows' ? letterXaml(lead.name, lead.sid) : '',
    slot,
    sound: S.agSound ? said.kind : 'none',
    hold: said.kind === 'wait' ? ALERT_HOLD_S : undefined,
    fg,
  })
  if (!command) return
  if (free !== undefined) popSlots.add(slot)
  $.clock.after(0, async () => {
    try {
      const result = await $.process.run(command.argv, { env: command.env, timeoutMs: POPUP_RUN_MS })
      if (result.stdout.includes('open')) await openAgents($)
    } catch (err) {
      log(`уведомление о сессиях не показалось: ${err?.message ?? err}`)
    } finally {
      if (free !== undefined) popSlots.delete(slot)
      if (S.pop.waiting) watchMessages($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    }
  })
}

// Клик по уведомлению о сессиях: панель Arcade на вкладке «Агенты»
async function openAgents($) {
  if (S.view !== 'library') toLibrary()
  S.menu = 'agents'
  S.libraryNotice = ''
  await openPane($)
}

// --- В сети и приглашения в игру ---------------------------------------------------------------------------------
const PULSE_MS = 30_000 // пока меню открыто: отметка «в сети», кто из друзей в сети и кто зовёт сыграть
export const PULSE_SOON_MS = 5_000 // отметка «при первой возможности» — не чаще этого
export const INVITE_MINUTES = 10 // сколько живёт приглашение на сайте

// Сетевые игры, в которые можно позвать друга: настольные (своя комната на двоих) и Doom (лобби игры на сайте)
export function inviteGames() {
  return games().filter((g) => g.kind === 'board' || g.console === 'doom')
}

// Отметка «в сети», пока меню открыто: заодно кто из друзей в сети, кто зовёт сыграть, непрочитанные и заявки в
// друзья. Сайт без отметки — только непрочитанные, как раньше
export async function pulse($) {
  if (!S.acct.handle || S.ol.pulsing) return
  const now = await $.clock.now()
  // Ещё не отмечались (at — 0) — сразу
  if (S.ol.at && now - S.ol.at < (S.ol.soon ? PULSE_SOON_MS : PULSE_MS)) return
  const state = S.ol
  state.pulsing = true
  state.soon = false
  state.at = now
  let answer = null
  try {
    answer = await chatFetch($, 'pulse', parsePulse, { body: S.hideOnline ? { hidden: true } : {} })
  } finally {
    state.pulsing = false
  }
  if (!answer || state !== S.ol) return
  if (answer.error) return answer.error === 'down' ? checkUnread($) : undefined
  const before = JSON.stringify([[...S.ol.online], S.ol.invites, S.acct.unread, S.acct.requests])
  const requests = S.acct.requests
  S.ol.online = new Set(answer.online)
  S.ol.invites = answer.invites.filter((i) => gameById(i.game) && !S.ol.gone.has(`${i.from}:${i.at}`))
  S.acct.unread = answer.unread
  S.acct.requests = answer.requests
  // Новое приглашение — ещё и тостом, один раз
  for (const i of S.ol.invites) {
    const key = `${i.from}:${i.at}`
    if (S.ol.told.has(key)) continue
    S.ol.told.add(key)
    await $.ui.toast(tr(`@${i.handle} зовёт сыграть: ${gameById(i.game).title}`, S.lang))
  }
  // Пришла или ушла заявка в друзья, пока открыт экран друзей, — список тоже освежаем
  if (S.menu === 'friends' && S.acct.requests !== requests) friendsCall($, 'friends')
  if (JSON.stringify([[...S.ol.online], S.ol.invites, S.acct.unread, S.acct.requests]) !== before) $.ui.invalidate('ui.render')
}

// Отметиться при первой возможности: таймер меню проверяет это каждые PULSE_SOON_MS
export function pulseSoon($) {
  S.ol.soon = true
  pulse($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
}

// Почему друга не позвали
function inviteNote(error, handle) {
  if (error === 'friend') return `@${handle} больше не в друзьях.`
  if (error === 'nohandle') return 'Сначала возьми свой @ник.'
  if (error === 'often' || error === 'limit') return 'Слишком часто — подожди минуту.'
  return accountNote(error)
}

// Позвать друга сыграть и открыть игру у себя: настольную — в новой комнате на двоих, Doom — в лобби игры
export async function inviteFriend($, surface, friend, id) {
  const g = gameById(id)
  if (!S.acct.session || S.ol.busy || !g) return
  const room = g.kind === 'board' ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : ''
  const state = S.ol
  state.busy = id
  state.note = ''
  state.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'invite', parseInvite, { body: { to: friend.id, game: id, ...(room ? { room } : {}) } })
  if (state !== S.ol) return
  S.ol.busy = ''
  if (!answer || answer.error) {
    if (answer) {
      S.ol.note = inviteNote(answer.error, friend.handle)
      S.ol.bad = true
    }
    return $.ui.invalidate('ui.render')
  }
  S.ol.note = `Приглашение для @${friend.handle} отправлено: ${g.title}. Оно действует ${INVITE_MINUTES} минут.`
  S.ol.to = null
  S.menuFrom = S.menu
  S.menu = 'friends'
  await openNet($, surface, netWhere(id, room))
}

// Ответ на приглашение: «Принять» — открыть игру друга (настольную — в его комнате), «Не сейчас» — просто убрать.
// Сайт забывает приглашение в обоих случаях
export async function answerInvite($, surface, invite, accept) {
  S.ol.gone.add(`${invite.from}:${invite.at}`)
  S.ol.invites = S.ol.invites.filter((i) => i !== invite)
  $.ui.invalidate('ui.render')
  chatFetch($, 'answer', parseInvite, { body: { from: invite.from } }).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
  if (accept) await openNet($, surface, netWhere(invite.game, invite.room))
}

// «Открыть на странице»: страница чатов на сайте — во встроенном браузере Claude или в окне браузера. Ключ сессии
// туда не идёт: сайт выдаёт код ссылки на 10 минут и на один раз, страница обменяет его на свой билет
export async function openChatPage($, surface) {
  const page = `${SITE}/chat`
  const builtin = builtinBrowser(surface)
  // Страницу чатов Claude уже открывает по просьбе Arcade или она ждёт конца шага: второй раз ход не прерываем
  const waiting = [S.asking, S.pendingOpen].find((url) => String(url ?? '').startsWith(page))
  if (builtin && waiting) return desktopNotice($, S.asking === waiting ? 'asking' : S.compacting ? 'compacting' : 'waiting', '', waiting)
  if (!S.acct.session || S.ch.busy) return
  S.ch.busy = 'page'
  S.ch.note = ''
  S.ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'chatticket', parseLink, { body: { link: true } })
  if (!answer) return
  S.ch.busy = ''
  if (answer.error) {
    S.ch.note = chatNote(answer.error)
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  S.chatLink = answer.link
  if (builtin) return desktopWindow($, 'chat', 'Чаты открыты во встроенном браузере Claude.')
  if (!S.platform) {
    S.libraryNotice = 'Окно браузера пока не открыть — попробуй через пару секунд.'
    return $.ui.invalidate('ui.render')
  }
  S.libraryNotice = 'Открываю окно…'
  $.ui.invalidate('ui.render')
  const command = windowCommand('chat')
  try {
    const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
    windowNotice($, launchNotice(result, 'chat'))
    if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
  } catch (err) {
    S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
  }
  $.ui.invalidate('ui.render')
}

// ━━━━━━━━━━ app/profile ━━━━━━━━━━
// Arcade: аккаунт, ник, аватарка, синхронизация настроек, отчёты, выход и удаление.

// --- Аккаунт: вход через GitHub и настройки на всех компьютерах ------------------------------------------------------
const ACCOUNT_FETCH_MS = 15_000 // сайту самому надо спросить GitHub
const SYNC_DELAY_MS = 2_000 // настройку поменяли — на сайт через пару секунд: вдруг человек меняет ещё
export const SYNC_EVERY_MS = 30 * 60_000 // и раз в полчаса — забрать то, что поменяли на другом компьютере

// Почему вход или синхронизация не удались
export function accountNote(error) {
  if (error === 'off') return 'Вход на сайте Arcade ещё не настроен.'
  if (error === 'app') return 'GitHub не принял приложение Arcade — вход пока не работает.'
  if (error === 'limit') return 'Попыток входа с этого адреса на сегодня слишком много — попробуй завтра.'
  if (error === 'big') return 'Настройки не поместились на сайте Arcade.'
  return 'Сайт Arcade не ответил. Попробуй чуть позже.'
}

// Почему ник не взялся
export function handleNote(error, handle) {
  if (error === 'invalid') return 'Ник — от 4 до 32 знаков: латинские буквы, цифры и _, первый — буква.'
  if (error === 'reserved') return 'Такой ник взять нельзя — выбери другой.'
  if (error === 'taken') return `@${handle} уже занят — выбери другой.`
  if (error === 'often') return 'Ник сегодня меняли слишком часто — попробуй завтра.'
  return accountNote(error)
}

// Вопрос к сайту про вход, настройки, друзей и чаты; query — параметры адреса. Ключ сессии — только в заголовке и
// только своему сайту
export function accountFetch($, name, { method = 'GET', body, token, query } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const url = query ? `${accountUrl(name)}?${new URLSearchParams(query)}` : accountUrl(name)
  return fetchWithin($, url, ACCOUNT_FETCH_MS, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
}

// Настройка из $.store или с сайта → в мод. Не подходит — false, остаётся прежняя
export function applySetting(key, value) {
  if (key === 'lang') {
    if (!LANGS.includes(value)) return false
    S.lang = value
  } else if (key === 'keys') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const fine = (list) => Array.isArray(list) && list.length <= 64 && list.every((k) => typeof k === 'string' && k.length <= 30)
    S.keymap = restoreKeymap(Object.fromEntries(Object.entries(value).filter(([, list]) => fine(list))))
  } else if (key === 'notify' || key === 'wide' || key === 'keepMenu' || key === 'backOnDone' || key === 'hideOnline') {
    if (typeof value !== 'boolean') return false
    if (key === 'notify') S.osNotify = value
    else if (key === 'wide') S.wide = value
    else if (key === 'keepMenu') S.keepMenu = value
    else if (key === 'hideOnline') S.hideOnline = value
    else S.backOnDone = value
  } else if (key === 'onDone' || key === 'onPermission') {
    if (!SIGNAL_MODES.includes(value)) return false
    if (key === 'onDone') S.onDone = value
    else S.onPermission = value
  } else if (key === 'askAfter') {
    if (!ASK_AFTER_CHOICES.includes(value)) return false
    S.askAfter = value
  } else if (key === 'myTopics') {
    if (!Array.isArray(value)) return false
    S.myTopics = restoreMyTopics(value)
  } else if (key === 'twitchChannels') {
    if (!Array.isArray(value)) return false
    S.tw.channels = restoreTwitch(value)
  } else if (key === 'flappyBest') {
    const best = Math.floor(Number(value))
    if (!Number.isFinite(best) || best < 0) return false
    S.flappyBest = Math.max(S.flappyBest, best)
  } else if (key === 'collapsed') {
    if (!Array.isArray(value)) return false
    S.collapsed = SECTIONS.filter((id) => value.includes(id))
  } else if (key === 'hidden') {
    if (!Array.isArray(value)) return false
    S.hidden = HIDEABLE.filter((id) => value.includes(id))
  } else if (key === 'favorites') {
    const list = restoreFavorites(value, FAV_LIMIT)
    if (!list) return false
    S.favorites = list
  } else return false
  return true
}

// Настройка из SYNC_KEYS, как она сейчас в моде
function settingValue(key) {
  switch (key) {
    case 'lang':
      return S.lang
    case 'keys':
      return S.keymap
    case 'notify':
      return S.osNotify
    case 'wide':
      return S.wide
    case 'keepMenu':
      return S.keepMenu
    case 'backOnDone':
      return S.backOnDone
    case 'onDone':
      return S.onDone
    case 'onPermission':
      return S.onPermission
    case 'myTopics':
      return S.myTopics
    case 'twitchChannels':
      return S.tw.channels
    case 'flappyBest':
      return S.flappyBest
    case 'collapsed':
      return S.collapsed
    case 'hidden':
      return S.hidden
    case 'favorites':
      return S.favorites
    case 'hideOnline':
      return S.hideOnline
    case 'askAfter':
      return S.askAfter
    default:
      return undefined
  }
}

// Сохранить настройку из SYNC_KEYS: в $.store, с отметкой времени, и — если вошли — через пару секунд на сайт
export async function saveSetting($, key, value) {
  const at = await $.clock.now()
  savedKeys.add(key)
  S.stamps = { ...S.stamps, [key]: at }
  await $.store.set(key, value)
  await $.store.set('syncAt', S.stamps)
  if (S.acct.session) scheduleSync($, SYNC_DELAY_MS)
}

// Свернуть или развернуть раздел главного меню
export async function toggleSection($, id) {
  S.collapsed = S.collapsed.includes(id) ? S.collapsed.filter((x) => x !== id) : SECTIONS.filter((x) => x === id || S.collapsed.includes(x))
  $.ui.invalidate('ui.render')
  await saveSetting($, 'collapsed', S.collapsed)
}

// Убрать раздел из главного меню совсем или вернуть его — из настроек
export async function toggleHidden($, id) {
  S.hidden = S.hidden.includes(id) ? S.hidden.filter((x) => x !== id) : HIDEABLE.filter((x) => x === id || S.hidden.includes(x))
  $.ui.invalidate('ui.render')
  await saveSetting($, 'hidden', S.hidden)
}

// «Готово» на приветствии: дальше — главное меню с выбранными разделами
export async function finishWelcome($) {
  S.welcomed = true
  S.menuFrom = null
  $.ui.invalidate('ui.render')
  await $.store.set('welcomed', true)
}

// Отметить игру, книгу или аудиокнигу звёздочкой — или снять отметку
export async function toggleFavorite($, id) {
  const { list, added } = toggleIn(S.favorites, id, FAV_LIMIT)
  if (added === null) {
    S.libraryNotice = `В избранном уже ${FAV_LIMIT} — сними звёздочку с чего-нибудь.`
    $.ui.invalidate('ui.render')
    return
  }
  S.favorites = list
  $.ui.invalidate('ui.render')
  await saveSetting($, 'favorites', S.favorites)
}

function scheduleSync($, ms) {
  S.syncTimer?.cancel()
  S.syncTimer = $.clock.after(ms, () => {
    S.syncTimer = null
    syncAccount($)
  })
}

// Встреча настроек этого компьютера и сайта: новое оттуда — сюда, новое отсюда — туда
export async function syncAccount($) {
  const session = S.acct.session
  if (!session) return
  if (S.acct.syncing) {
    S.acct.again = true
    return
  }
  S.acct.syncing = true
  S.acct.again = false
  $.ui.invalidate('ui.render')
  try {
    const claims = S.acct.claims
    const picks = S.acct.picks
    const me = parseMe(await accountFetch($, 'me', { token: session.token }))
    if (S.acct.session !== session) return
    if (me.error) return await syncFailed($, me.error)
    if (S.acct.claims === claims) {
      S.acct.handle = me.handle
      S.acct.ticket = me.ticket
    }
    if (S.acct.picks === picks) S.acct.pic = me.pic
    S.acct.friends = me.friends
    S.acct.requests = me.requests
    S.acct.unread = me.unread
    S.acct.role = me.role
    const now = await $.clock.now()
    if (S.acct.session !== session) return
    const renamed = me.user.id === session.user.id && JSON.stringify(me.user) !== JSON.stringify(session.user)
    if (renamed) session.user = me.user
    const local = Object.fromEntries([...savedKeys].map((key) => [key, settingValue(key)]))
    const plan = syncPlan(local, S.stamps, me.settings, now)
    const changed = []
    for (const [key, value] of Object.entries(plan.apply)) {
      if (applySetting(key, value)) {
        savedKeys.add(key)
        changed.push(key)
      } else if (savedKeys.has(key)) {
        // С сайта пришло то, чего мод не понимает: остаётся своё — и уходит на сайт поверх
        plan.stamps[key] = Math.max(now, me.settings[key].at + 1)
        plan.push[key] = { v: settingValue(key), at: plan.stamps[key] }
      }
    }
    S.stamps = plan.stamps
    if (changed.length) $.ui.invalidate('ui.render')
    if (renamed) await $.store.set('account', session)
    for (const key of changed) await $.store.set(key, settingValue(key))
    await $.store.set('syncAt', S.stamps)
    if (Object.keys(plan.push).length) {
      const sent = parseSettings(await accountFetch($, 'settings', { method: 'PUT', body: { settings: plan.push }, token: session.token }))
      if (S.acct.session !== session) return
      if (sent.error) return await syncFailed($, sent.error)
    }
    S.acct.syncedAt = now
    S.acct.note = ''
  } catch (err) {
    log(`настройки не синхронизированы: ${String(err?.message ?? err).slice(0, 200)}`)
  } finally {
    S.acct.syncing = false
    $.ui.invalidate('ui.render')
    if (S.acct.again) syncAccount($)
  }
}

async function syncFailed($, error) {
  log(`аккаунт: ${error}`)
  if (error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  S.acct.note = accountNote(error)
}

// Забыть вход на этом компьютере. Настройки остаются как есть
export async function forgetSession($, note) {
  S.acct.session = null
  S.acct.flow = null
  S.acct.starting = false
  S.acct.note = note
  S.acct.syncedAt = 0
  S.acct.confirmDelete = false
  S.acct.handle = ''
  S.acct.ticket = ''
  S.acct.naming = false
  S.acct.handleNote = ''
  S.acct.pic = null
  S.acct.picking = false
  S.acct.picNote = ''
  S.acct.friends = 0
  S.acct.requests = 0
  S.acct.unread = 0
  S.acct.role = ''
  S.acct.request++
  S.fr = { ...NO_FRIENDS, request: S.fr.request + 1 }
  S.ol = noOnline()
  S.ch = { ...NO_CHATS, picked: new Set(), request: S.ch.request + 1 }
  S.rp = { ...S.rp, ...NO_REPORTS, request: S.rp.request + 1 }
  S.dk = { ...NO_DESKS, picked: new Set(), syncing: new Set(), again: new Set() }
  S.pushTimer?.cancel()
  S.pushTimer = null
  S.chatLink = ''
  S.syncTimer?.cancel()
  S.syncTimer = null
  $.ui.invalidate('ui.render')
  try {
    await $.store.delete('account')
  } catch (err) {
    log(`вход не забыт: ${String(err?.message ?? err).slice(0, 200)}`)
  }
}

// «Войти через GitHub»: обычно — кнопкой через сайт: мод открывает страницу входа в браузере, человек пускает Arcade на
// GitHub и подтверждает вход на странице сайта. Сайт так не умеет (копия ветки, старый сайт) или не ответил — вход по
// коду: сайт просит у GitHub код, человек вводит его на странице GitHub. byCode — сразу по коду («Войти по коду» или
// вход через сайт сломался), note — заметка, с которой начать
export async function startLogin($, byCode = false, note = '') {
  if (S.acct.starting || S.acct.session || (S.acct.flow && !(byCode && S.acct.flow.web))) return
  const request = ++S.acct.request
  S.acct.flow = null
  S.acct.starting = true
  S.acct.note = note
  $.ui.invalidate('ui.render')
  if (!byCode) {
    const web = parseWeb(await accountFetch($, 'web', { method: 'POST' }))
    const now = await $.clock.now()
    if (request !== S.acct.request) return
    // Лимит попыток у обоих входов общий — по коду тоже не выйдет
    if (!web.error || web.error === 'limit') {
      S.acct.starting = false
      if (web.error) S.acct.note = accountNote(web.error)
      else {
        S.acct.flow = { web: true, state: web.state, key: web.key, mark: web.mark, url: web.url, interval: web.interval, until: now + web.expires * 1000 }
        waitLogin($, request, now)
      }
      $.ui.invalidate('ui.render')
      if (S.acct.flow) await openGithub($, web.url)
      return
    }
    log(`вход через сайт: ${web.error} — вход по коду`)
  }
  const start = parseStart(await accountFetch($, 'start', { method: 'POST' }))
  const now = await $.clock.now()
  if (request !== S.acct.request) return
  S.acct.starting = false
  if (start.error) S.acct.note = accountNote(start.error)
  else {
    S.acct.flow = { device: start.device, code: start.code, url: start.url, interval: start.interval, until: now + start.expires * 1000 }
    waitLogin($, request, now)
  }
  $.ui.invalidate('ui.render')
}

// Спрашивать сайт, вошёл ли человек, — раз в interval секунд, пока код (или вход кнопкой) жив; истечёт раньше —
// сказать сразу
function waitLogin($, request, now) {
  const flow = S.acct.flow
  const current = () => request === S.acct.request && S.acct.flow === flow
  const end = (note) => {
    S.acct.flow = null
    S.acct.note = note
    $.ui.invalidate('ui.render')
  }
  const expired = flow.web ? 'Время на вход вышло — попробуй ещё раз.' : 'Код истёк — попробуй ещё раз.'
  $.clock.after(Math.min(flow.interval * 1000, Math.max(flow.until - now, 0) + 1), async () => {
    if (!current()) return
    if ((await $.clock.now()) > flow.until) return end(expired)
    const poll = flow.web
      ? parsePoll(await accountFetch($, 'wait', { method: 'POST', body: { state: flow.state, key: flow.key } }))
      : parsePoll(await accountFetch($, 'poll', { method: 'POST', body: { device: flow.device } }))
    if (!current()) return
    if (poll.status === 'ok') return finishLogin($, poll.account)
    if (poll.status === 'expired') return end(expired)
    if (poll.status === 'denied') return end(flow.web ? 'Вход отменён.' : 'Вход отменён на GitHub.')
    // Сайт не смог обменять ответ GitHub на вход — значит, вход через сайт сломан, а по коду он может и пройти
    if (flow.web && poll.error === 'app') return startLogin($, true, 'Вход через сайт сейчас не работает — войди по коду.')
    if (['off', 'app', 'limit'].includes(poll.error)) return end(accountNote(poll.error))
    // Ждём дальше; сайт не ответил — тоже ждём, но говорим об этом
    if (poll.interval) flow.interval = poll.interval
    const note = poll.error ? accountNote(poll.error) : ''
    if (note !== S.acct.note) {
      S.acct.note = note
      $.ui.invalidate('ui.render')
    }
    waitLogin($, request, await $.clock.now())
  })
}

async function finishLogin($, account) {
  S.acct.flow = null
  S.acct.note = ''
  S.acct.session = account
  $.ui.invalidate('ui.render')
  try {
    await $.store.set('account', account)
  } catch (err) {
    log(`вход не сохранён: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  syncAccount($)
}

export function cancelLogin($) {
  S.acct.request++
  S.acct.flow = null
  S.acct.starting = false
  S.acct.note = ''
  $.ui.invalidate('ui.render')
}

// «Взять @ник» или свой ник из поля: сайт проверяет, свободен ли он, и отдаёт подпись ника для сетевых игр
export async function claimHandle($, text) {
  const session = S.acct.session
  if (!session || S.acct.naming) return
  const handle = normalHandle(text)
  if (handle === S.acct.handle) return
  if (!HANDLE.test(handle)) {
    S.acct.handleNote = handleNote('invalid', handle)
    return $.ui.invalidate('ui.render')
  }
  S.acct.naming = true
  S.acct.handleNote = ''
  $.ui.invalidate('ui.render')
  const answer = parseHandle(await accountFetch($, 'handle', { method: 'PUT', body: { handle }, token: session.token }))
  if (S.acct.session !== session) return
  S.acct.naming = false
  if (answer.error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (answer.error) S.acct.handleNote = handleNote(answer.error, handle)
  else {
    S.acct.claims++
    S.acct.handle = answer.handle
    S.acct.ticket = answer.ticket
  }
  $.ui.invalidate('ui.render')
}

// Аватарка — одна из AVATAR_COUNT картинок (n — номер, null — без неё, буква ника). Выбирается только здесь, в
// аккаунте; чаты её просто показывают
export async function pickAvatar($, n) {
  const session = S.acct.session
  if (!session || S.acct.picking || n === S.acct.pic) return
  S.acct.picking = true
  S.acct.picNote = ''
  $.ui.invalidate('ui.render')
  const answer = parseAvatar(await accountFetch($, 'avatar', { method: 'PUT', body: { pic: n }, token: session.token }))
  if (S.acct.session !== session) return
  S.acct.picking = false
  if (answer.error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (answer.error) S.acct.picNote = answer.error === 'often' || answer.error === 'limit' ? 'Аватарку меняли слишком часто — подожди минуту.' : accountNote(answer.error)
  else {
    S.acct.picks++
    S.acct.pic = answer.pic
    // В открытых чатах своя аватарка — сразу новая
    if (S.ch.me) S.ch.pics = { ...withoutPics(S.ch.pics, [S.ch.me]), ...(validPic(answer.pic) ? { [S.ch.me]: answer.pic } : {}) }
  }
  $.ui.invalidate('ui.render')
}

// --- Отчёты об ошибках: отправить может каждый, список и «Закрыть» — только админ ------------------------------------

// Почему отчёт не ушёл или список не загрузился
export function reportNote(error) {
  if (error === 'empty') return 'Напиши, что сломалось.'
  if (error === 'long') return 'Отчёт длиннее 2000 знаков — сократи его.'
  if (error === 'often') return 'Отчётов от тебя сегодня уже много — попробуй завтра.'
  if (error === 'full') return 'Сегодня отчётов пришло слишком много — попробуй завтра.'
  if (error === 'off') return 'Отчёты на сайте сейчас выключены.'
  if (error === 'admin') return 'Список отчётов — только у автора Arcade.'
  if (error === 'gone') return 'Этот отчёт уже закрыт.'
  return accountNote(error)
}

// «Отправить»: со входом — подписан аккаунтом, без входа — без подписи. К тексту — версия Arcade, где он открыт
// (surface), язык и система; больше ничего. Пустой или слишком длинный — сразу здесь, на сайт не уходит
export async function sendReport($, text, surface) {
  if (S.rp.sending) return
  const body = reportBody(text, { version: ARCADE_VERSION, surface, lang: S.lang, os: S.platform })
  const problem = !body.text ? 'empty' : body.text.length > MAX_REPORT ? 'long' : ''
  if (problem) {
    S.rp.note = reportNote(problem)
    S.rp.bad = true
    return $.ui.invalidate('ui.render')
  }
  const session = S.acct.session
  S.rp.sending = true
  S.rp.note = ''
  $.ui.invalidate('ui.render')
  const answer = parseReportSent(await accountFetch($, session ? 'myReport' : 'report', { method: 'POST', body, ...(session ? { token: session.token } : {}) }))
  S.rp.sending = false
  if (answer.error === 'auth' && session) {
    if (S.acct.session === session) await forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
    S.rp.note = 'Отчёт не ушёл — отправь его ещё раз: теперь он уйдёт без подписи.'
    S.rp.bad = true
  } else if (answer.error) {
    S.rp.note = reportNote(answer.error)
    S.rp.bad = true
  } else {
    // Отправлен — поле новое, пустое
    S.rp.field++
    S.rp.note = 'Спасибо! Отчёт отправлен.'
    S.rp.bad = false
  }
  $.ui.invalidate('ui.render')
}

// Список открытых отчётов — у админа. Сайт сказал, что ты больше не админ, — плитка пропадает
export async function loadReports($) {
  const session = S.acct.session
  if (!session || S.acct.role !== 'admin' || S.rp.loading || S.rp.busy) return
  const request = ++S.rp.request
  S.rp.loading = true
  $.ui.invalidate('ui.render')
  const answer = parseReports(await accountFetch($, 'reports', { token: session.token }))
  if (S.acct.session !== session || request !== S.rp.request) return
  S.rp.loading = false
  if (answer.error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (answer.error === 'admin') S.acct.role = ''
  if (answer.error) {
    S.rp.listNote = reportNote(answer.error)
    S.rp.listBad = true
  } else {
    S.rp.list = answer.reports
    S.rp.open = answer.open
    if (S.rp.listBad) S.rp.listNote = ''
    S.rp.listBad = false
  }
  $.ui.invalidate('ui.render')
}

// «Закрыть»: отчёт разобран — сайт удаляет его. Уже закрытый (с другого компьютера) — тоже уходит из списка
export async function closeReport($, id) {
  const session = S.acct.session
  if (!session || S.rp.loading || S.rp.busy) return
  const request = ++S.rp.request
  S.rp.busy = id
  $.ui.invalidate('ui.render')
  const answer = parseClosed(await accountFetch($, 'closeReport', { method: 'POST', body: { id }, token: session.token }))
  if (S.acct.session !== session || request !== S.rp.request) return
  S.rp.busy = 0
  if (answer.error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (answer.error === 'admin') S.acct.role = ''
  if (answer.error && answer.error !== 'gone') {
    S.rp.listNote = reportNote(answer.error)
    S.rp.listBad = true
  } else {
    S.rp.list = (S.rp.list ?? []).filter((r) => r.id !== id)
    S.rp.open = answer.error ? Math.max(S.rp.list.length, S.rp.open - 1) : answer.open
    S.rp.listNote = answer.error ? reportNote('gone') : 'Отчёт закрыт.'
    S.rp.listBad = false
  }
  $.ui.invalidate('ui.render')
}

// «Выйти»: забыть вход здесь и сказать сайту, что ключ сессии больше не нужен; что ответит сайт, неважно
export async function logout($) {
  const token = S.acct.session?.token
  if (!token) return
  await forgetSession($, 'Выход выполнен: на этом компьютере настройки больше не синхронизируются.')
  await accountFetch($, 'logout', { method: 'POST', token })
}

// «Удалить аккаунт»: первое нажатие спрашивает «точно?», второе — просит сайт забыть человека и его настройки
export async function deleteAccount($) {
  const session = S.acct.session
  if (!session) return
  if (!S.acct.confirmDelete) {
    S.acct.confirmDelete = true
    S.acct.note = ''
    return $.ui.invalidate('ui.render')
  }
  S.acct.confirmDelete = false
  S.acct.note = 'Удаляю аккаунт…'
  $.ui.invalidate('ui.render')
  const error = parseDone(await accountFetch($, 'me', { method: 'DELETE', token: session.token }))
  if (S.acct.session !== session) return
  if (error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (!error) return forgetSession($, 'Аккаунт удалён: сайт Arcade забыл тебя и твои настройки. Здесь настройки остались.')
  S.acct.note = accountNote(error)
  $.ui.invalidate('ui.render')
}

// Страница входа на GitHub или страница GitHub для кода — в обычном браузере: встроенный браузер Desktop открывает только
// страницы сайта Arcade, а на GitHub человек уже вошёл в своём браузере
export async function openGithub($, url) {
  const command = openUrlCommand(S.platform, url)
  let opened = false
  if (command) {
    try {
      opened = (await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS }))?.exitCode === 0
    } catch {
      // не открылся — адрес и так написан в меню
    }
  }
  if (opened) windowNotice($, S.acct.flow?.web ? 'Открываю вход в браузере.' : 'Открываю GitHub в браузере — введи там код.')
  else S.libraryNotice = 'Браузер не открылся — открой адрес выше сам.'
  $.ui.invalidate('ui.render')
}

// ━━━━━━━━━━ app/work ━━━━━━━━━━
// Arcade: блокнот и доски проектов.

// --- Блокнот ------------------------------------------------------------------------------------------------------
const NOTES_FULL = 'Блокнот полон — удали ненужные страницы.'
export const NOTE_TOO_LONG = 'Текст страницы длиннее 20 000 знаков — сократи его.'
const LINES_CLASH = 'Те же строки тем временем поменяли в другой сессии — осталась правка отсюда.'
export const CONNECTOR_HINT = '  Через коннекторы Claude: ключи и пароли Arcade не нужны. Нет коннектора — Claude подскажет, как подключить.'
// Голосовой ввод — диктовкой системы: она пишет в любое поле, где курсор, и в поля Arcade тоже
export const VOICE_HINT = {
  windows: '  Голосом: Win+H — диктовка Windows пишет туда, где курсор.',
  mac: '  Голосом: дважды Fn — диктовка macOS пишет туда, где курсор.',
}

// Блокнот и общие доски в $.store — одни на все открытые сессии Claude Code, а у каждой сессии — своя копия в памяти
// (S.notes, S.desks). Поэтому всякая правка — по очереди (queue) и поверх свежего блокнота: перечитать хранилище
// (readNotes), поправить, записать (saveNotes). Тогда сессия не стирает чужое: удалённая в другой сессии страница не
// вернётся, а добавленная не пропадёт. Но две сессии пишут и почти одновременно — запись одной ложится на запись
// другой. Поэтому saveNotes кладёт правку поверх того, что другая сессия успела записать, а через NOTES_CHECK_MS
// проверяет, что правка на месте (checkNotes). Блокнот и доски такими, какими их последний раз прочли или записали, —
// JSON-строкой: поменялись ли они в хранилище, видно сравнением строк
let notesJson = ''
let desksJson = ''
let deskJsons = {} // по общим доскам: share → JSON
let queue = Promise.resolve()
// Записи блокнота этой сессией за последние NOTES_CHECK_MS — что проверить: { base — блокнот до правки, mine — после,
// at — когда записан }; checkTimer — когда проверить
let writes = []
let checkTimer = null
export const NOTES_CHECK_MS = 2_000

// Работа с блокнотом: в очередь, сначала — свежий блокнот (work получает ответ readNotes). Изнутри work снова в очередь
// не вставать — очередь ждала бы сама себя
function withNotes($, work) {
  const chained = queue.then(async () => work(await readNotes($)))
  queue = chained.catch(() => {})
  return chained
}

// Блокнот и общие доски — из хранилища при старте сессии (и после /reload-plugins: модуль запускается заново)
export async function loadNotes($) {
  const rawDesks = await $.store.get('desks')
  const raw = await $.store.get('notes')
  notesJson = JSON.stringify(raw ?? null)
  S.notes = restoreNotes(raw)
  takeDesks(rawDesks)
}

// Перечитать блокнот и доски: другая сессия могла их поменять. Доски — первыми: сессии пишут блокнот раньше досок, и
// тогда у прочитанной доски её страница в блокноте уже есть. false — ничего не поменялось, true — поменялось,
// 'gone' — страницу или доску на экране удалили (экран ушёл назад, см. follow)
async function readNotes($) {
  let rawDesks, raw
  try {
    rawDesks = await $.store.get('desks')
    raw = await $.store.get('notes')
  } catch (err) {
    modError(err)
    return false
  }
  const json = JSON.stringify(raw ?? null)
  if (json === notesJson && JSON.stringify(rawDesks ?? null) === desksJson) return false
  let gone = false
  if (json !== notesJson) {
    notesJson = json
    gone = follow($, restoreNotes(raw))
  }
  takeDesks(rawDesks)
  return gone ? 'gone' : true
}

// Общие доски из хранилища. Доску, которая там не поменялась, оставляем тем же объектом: сверка с сайтом по нему видит,
// что основу, к которой придёт ответ, никто не трогал
function takeDesks(raw) {
  desksJson = JSON.stringify(raw ?? null)
  const desks = restoreDesks(raw, S.notes)
  const seen = {}
  for (const share of Object.keys(desks)) {
    seen[share] = JSON.stringify(raw[share])
    if (S.desks[share] && deskJsons[share] === seen[share]) desks[share] = S.desks[share]
  }
  deskJsons = seen
  S.desks = desks
}

// Перечитать блокнот, пока он на экране: поменялся — экран перерисуется. По таймеру — раз в NOTES_POLL_MS
export const NOTES_POLL_MS = 3_000
export function refreshNotes($) {
  return withNotes($, (moved) => moved)
}
export const notesShown = () => /^(notes|boards|prompts)$|^(note|board):/.test(S.menu)

// Записать правку блокнота: base — блокнот до неё, S.notes — после. Другая сессия, пока эта правила, записала свой —
// правка ложится поверх него (rebaseNotes). check — через NOTES_CHECK_MS проверить, что правка на месте. Только в
// очереди (withNotes)
async function saveNotes($, base, check = true) {
  const mine = S.notes
  try {
    const raw = await $.store.get('notes')
    const json = JSON.stringify(raw ?? null)
    if (json !== notesJson) {
      notesJson = json
      const lost = []
      follow($, rebaseNotes(restoreNotes(raw), base, mine, undefined, lost))
      clashNote(lost.length > 0)
    }
    notesJson = JSON.stringify(S.notes)
    await $.store.set('notes', S.notes)
  } catch (err) {
    nb.note = 'Не получилось сохранить блокнот.'
    nb.bad = true
    log(`ошибка мода: ${err?.message ?? err}`)
    return
  }
  if (!check) return
  writes.push({ base, mine, at: await $.clock.now() })
  checkLater($)
}

// Другая сессия прочла блокнот до записи этой, а записала свой после — правка этой пропала. Правки за последние
// NOTES_CHECK_MS — снова поверх свежего блокнота; страницу, которую правили уже после правки, не трогаем. Что вернула
// проверка, снова не проверяем: две сессии, поменявшие одно поле, иначе возвращали бы каждая своё без конца
function checkLater($) {
  if (checkTimer) return
  checkTimer = $.clock.after(NOTES_CHECK_MS, () => {
    checkTimer = null
    checkNotes($).catch(modError)
  })
}
export function checkNotes($) {
  return withNotes($, async () => {
    const now = await $.clock.now()
    let list = S.notes
    const lost = []
    for (const w of latestEdits(writes)) list = rebaseNotes(list, w.base, w.mine, w.at, lost)
    writes = writes.filter((w) => now - w.at < NOTES_CHECK_MS)
    if (list !== S.notes) {
      log('блокнот: другая сессия затёрла правку этой — вернул')
      const base = S.notes
      follow($, list)
      clashNote(lost.length > 0)
      await saveNotes($, base, false)
      pushBoards($)
    } else if (writes.length) checkLater($)
  })
}

// Блокнот поменялся не с экрана — в другой сессии или сверкой с сайтом (site): экран идёт за ним. Поле открытой
// страницы рисуется заново, только если её поменяли, а человек в ней ничего не набрал. Открытую страницу удалили —
// назад к доске или странице над ней, открытую доску — к списку досок, с заметкой; тогда — true
function follow($, list, site = false) {
  const old = S.notes
  const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b)
  const shown = shownBoard()
  const open = S.menu.startsWith('note:') ? S.menu.slice(5) : ''
  const board = S.menu.startsWith('board:') ? S.menu.slice(6) : ''
  const was = open ? old.find((p) => p.id === open) : null
  S.notes = list
  const now = was ? list.find((p) => p.id === open) : null
  let gone = false
  if (was && !now) {
    const up = was.parent ? list.find((p) => p.id === was.parent) : null
    const card = isBoard(old.find((p) => p.id === was.parent))
    const text = site ? 'Открытую карточку удалили на общей доске.' : card ? 'Открытую карточку удалили в другой сессии.' : 'Открытую страницу удалили в другой сессии.'
    nb.draft = null
    nb.confirm = null
    nb.focus = ''
    nb.field++
    S.menuFrom = null
    S.menu = up ? (isBoard(up) ? `board:${up.id}` : `note:${up.id}`) : 'notes'
    // Заметку — туда, где её покажут: экран доски — под доской, экран блокнота — под страницей
    const where = isBoard(up) ? S.dk : nb
    where.note = text
    where.bad = true
    gone = true
  } else if (now && !same(was, now) && nb.draft?.id !== open) nb.field++
  if (board && isBoard(shown) && !list.some((p) => p.id === board && isBoard(p))) {
    S.menuFrom = null
    S.menu = 'boards'
    S.dk.note = 'Открытую доску удалили в другой сессии.'
    S.dk.bad = true
    S.dk.confirm = ''
    gone = true
  }
  if (!same(shown, shown && list.find((p) => p.id === shown.id))) S.dk.field++
  if (S.dk.pick && !list.some((p) => p.id === S.dk.pick)) S.dk.pick = ''
  // «Промпты»: открытый на правку шаблон удалили — к списку шаблонов, с заметкой; поменяли, а человек в нём ничего не
  // набрал, — поля рисуются заново. Набор, у которого открыты настройки, удалили — к списку
  if (S.menu === 'prompts' && pr.edit) {
    const wasCard = old.find((p) => p.id === pr.edit)
    const nowCard = list.find((p) => p.id === pr.edit)
    if (!nowCard) {
      if (nb.draft?.id === pr.edit) nb.draft = null
      pr.edit = ''
      pr.confirm = ''
      pr.focus = ''
      pr.note = site ? 'Открытый шаблон удалили в общем наборе.' : 'Открытый шаблон удалили в другой сессии.'
      pr.bad = true
      pr.field++
      gone = true
    } else if (!same(wasCard, nowCard) && nb.draft?.id !== pr.edit) pr.field++
  }
  if (S.menu === 'prompts' && pr.set) {
    const nowSet = list.find((p) => p.id === pr.set && isPrompts(p))
    if (!nowSet) {
      pr.set = ''
      pr.confirm = ''
      pr.note = site ? 'Набора больше нет на сайте или тебя в нём нет — у тебя осталась своя копия.' : 'Открытый набор удалили в другой сессии.'
      pr.bad = true
      gone = true
    } else if (!same(old.find((p) => p.id === pr.set), nowSet)) pr.field++
  }
  $.ui.invalidate('ui.render')
  return gone
}

// Блокнот поменялся: поля страницы рисуются заново с новым текстом. entries — что из этого записать в итоги дня
async function notesChanged($, list, entries = []) {
  const base = S.notes
  S.notes = list
  nb.draft = null
  nb.field += 1
  $.ui.invalidate('ui.render')
  await saveNotes($, base)
  pushBoards($)
  await logDay($, entries)
}

// Итоги дня: записи — в журнал в $.store (daylog.js), один на все сессии, поверх свежего. Только в очереди (withNotes)
async function logDay($, entries) {
  if (!entries.length) return
  const raw = await $.store.get('daylog').catch(() => null)
  await $.store.set('daylog', addLog(restoreLog(raw), entries, entries[0].at)).catch(modError)
}

// Обе правки задели одни строки: осталась правка этой сессии, а человеку — заметка
function clashNote(clash) {
  if (!clash) return
  nb.note = LINES_CLASH
  nb.bad = true
}

// Набранное в поле «Текст» — в страницу (в списке list). Пока набирали, страницу поменяли не из поля (Claude, другая
// сессия): набранное — поверх её свежего текста по строкам (mergeText), и обе правки на месте; задели одни строки —
// clash. Не помещается — list: null
function withDraft(list, at) {
  const draft = nb.draft
  const page = draft && list.find((p) => p.id === draft.id)
  if (!page || draft.text === page.body) return { list }
  if (draft.text.length > MAX_BODY) return { list: null }
  const typed = cleanBody(draft.text)
  const { text, clash } = draft.from === page.body ? { text: typed, clash: false } : mergeText(page.body, draft.from, typed)
  if (text.length > MAX_BODY) return { list: null }
  return { list: updatePage(list, page.id, { body: text }, at), clash }
}

// Правка с экрана, вместе с набранным в поле «Текст»: change(list, at) → новый список или текст беды. Ложится поверх
// свежего блокнота. true — правка сделана, false — нет (заметка скажет почему), null — страницу или доску на экране
// удалили в другой сессии: правку не делаем, экран уже ушёл назад
export function editNotes($, change, saved = '') {
  return withNotes($, async (moved) => {
    if (moved === 'gone') return null
    const at = await $.clock.now()
    const { list: base, clash } = withDraft(S.notes, at)
    const editedNotes = base && change(base, at)
    const problem = !base ? NOTE_TOO_LONG : typeof editedNotes === 'string' ? editedNotes : fits(editedNotes) ? '' : NOTES_FULL
    nb.note = problem || (clash ? LINES_CLASH : saved)
    nb.bad = Boolean(problem || clash)
    if (problem) {
      $.ui.invalidate('ui.render')
      return false
    }
    if (editedNotes !== S.notes) await notesChanged($, editedNotes, noteChanges(S.notes, editedNotes, at, 'me'))
    else $.ui.invalidate('ui.render')
    return true
  })
}

// Инструмент блокнота у Claude — тоже поверх свежего блокнота: и list, и read видят правки других сессий. Набранное в поле
// «Текст» сначала уходит в страницу — правка Claude ложится поверх
export function notesTool($, input) {
  return withNotes($, async () => {
    const at = await $.clock.now()
    const draft = withDraft(S.notes, at)
    clashNote(draft.clash)
    const base = draft.list ?? S.notes
    const out = applyNotesTool(base, input, at, cardId, tr('Мои промпты', S.lang))
    if (out.changed || base !== S.notes) await notesChanged($, out.notes, [...noteChanges(S.notes, base, at, 'me'), ...noteChanges(base, out.notes, at, 'claude')])
    return out
  })
}

// Новая страница (или подстраница parent) — и сразу открыть её
export async function createPage($, title, parent = null) {
  let page = null
  const done = await editNotes($, (list, at) => {
    const made = addPage(list, { title, parent }, at)
    if (made.error) return made.error === 'empty' ? 'Впиши название страницы.' : made.error === 'parent' ? 'Открытую страницу удалили в другой сессии.' : NOTES_FULL
    page = made.page
    return made.notes
  })
  if (!done || !page) return
  nb.focus = 'add'
  S.menuFrom = S.menu
  S.menu = `note:${page.id}`
  $.ui.invalidate('ui.render')
}

// Заметки после передачи Claude: страница блокнота или просьба про другое приложение
const GIVEN = {
  page: ['Страница ушла Claude.', 'Claude занят — страница ждёт в поле ввода: отправь её, когда он освободится.', 'Не получилось отдать страницу — попробуй ещё раз, когда Claude освободится.'],
  ask: ['Просьба ушла Claude.', 'Claude занят — просьба ждёт в поле ввода: отправь её, когда он освободится.', 'Не получилось передать просьбу — попробуй ещё раз, когда Claude освободится.'],
  board: ['Доска ушла Claude.', 'Claude занят — доска ждёт в поле ввода: отправь её, когда он освободится.', 'Не получилось отдать доску — попробуй ещё раз, когда Claude освободится.'],
  prompt: ['Шаблон ушёл Claude.', 'Claude занят — шаблон ждёт в поле ввода: отправь его, когда он освободится.', 'Не получилось отдать шаблон — попробуй ещё раз, когда Claude освободится.'],
  check: ['Вывод проверки ушёл Claude.', 'Claude занят — вывод проверки ждёт в поле ввода: отправь его, когда он освободится.', 'Не получилось передать Claude вывод проверки — он на экране доски.'],
}

// Текст — Claude: сразу, если он свободен, иначе — в поле ввода, к тому, что там уже набрано. true — ушёл сразу.
// Агенты в фоне («работает в фоне») — тоже занят: Claude ещё вернётся к их работе
export async function giveClaude($, text, what) {
  const [sentNote, busyNote, failNote] = GIVEN[what]
  if (S.status === 'idle' || S.status === 'done') {
    const sent = await $.prompt.submit({ text }).catch((err) => ({ drop: String(err?.message ?? err) }))
    if (!sent.drop) {
      nb.note = sentNote
      nb.bad = false
      $.ui.invalidate('ui.render')
      return true
    }
    log(`ошибка мода: ${sent.drop.slice(0, 200)}`)
  }
  const { text: draft } = await $.prompt.read().catch(() => ({ text: '' }))
  const filled = await $.prompt.fill({ text: draft.trim() ? `\n${text}` : text, mode: 'append' }).catch(() => ({}))
  nb.note = filled.isFilled ? busyNote : failNote
  nb.bad = !filled.isFilled
  $.ui.invalidate('ui.render')
  return false
}

// Карточка общей доски: доска, её основа с сайта, мой номер аккаунта и кто взял карточку — если он ещё на доске (пока
// участников не знаем — показываем как есть)
export function cardTaker(page) {
  const board = page?.parent ? S.notes.find((p) => p.id === page.parent && isBoard(p)) : null
  const share = board?.board.share ?? ''
  const base = share ? S.desks[share] : null
  const me = S.dk.me || S.ch.me || ''
  const taken = base && page.taken && (!base.members.length || base.members.includes(page.taken)) ? page.taken : ''
  return { board, share, base, me, taken }
}

// Страницу — Claude. Карточку общей доски — ещё и пометить, что её взял я: прежде сверить доску с сайтом, и если её уже
// взял другой — сказать об этом, отдать только по второму нажатию. queued — карточку даёт очередь Claude: ей нужно
// знать, ушла ли карточка (true — ушла сразу, 'taken' — её уже взял другой, очередь берёт следующую). auto — карточку даёт
// задание по расписанию (app/schedule): взятую другим не отдаёт, тоже 'taken'
export async function sendNote($, id, queued = false, auto = false) {
  if (!(await editNotes($, (list) => list))) return false
  const start = cardTaker(S.notes.find((p) => p.id === id))
  if (start.base && start.me) await syncBoard($, start.share).catch(modError)
  let page = S.notes.find((p) => p.id === id)
  if (!page) return false
  const { board, base, me, taken } = cardTaker(page)
  if (base && me && taken !== me) {
    if (taken && (queued || auto)) return 'taken'
    if (taken && nb.take !== id) {
      nb.take = id
      nb.note = `${tr('Карточку уже взял', S.lang)} ${deskPerson(taken, base)}. ${tr('Нажми «Отдать Claude» ещё раз, чтобы всё равно отдать её своему Claude.', S.lang)}`
      nb.bad = true
      $.ui.invalidate('ui.render')
      return false
    }
    if (!(await editNotes($, (list, at) => updateCard(list, id, { taken: me }, at)))) return false
    page = S.notes.find((p) => p.id === id) ?? page
  }
  nb.take = ''
  const t = (text) => tr(text, S.lang)
  const lines = [`${t('Страница из моего блокнота Arcade')} (id ${page.id}):`, '', `# ${page.title}`, page.body, '', t('Отмечай сделанные пункты и дописывай итоги на этой странице инструментом mcp__arcade__notes.')]
  const last = board?.board.cols.at(-1)
  if (last && columnOf(page, board.board.cols) !== last.id)
    lines.push(`${t('Это карточка доски')} «${board.title}». ${t('Когда сделаешь — перенеси её в колонку')} «${colName(last)}» (${t('колонка')} ${last.id}) ${t('действием move того же инструмента.')}`)
  // Задача трекера — Claude прочитает её коннектором, если нужно больше. Комментарий в задачу — только кнопкой «Итог — в …»
  const task = trackerTask(page, Boolean(board))
  if (task) lines.push(`${t('Это задача в трекере')} ${task.app}: ${task.url} — ${t('подробности и обсуждение читай там инструментами коннектора этого трекера, если он подключён.')}`)
  if (queued) lines.push(t('Карточки идут очередью Arcade: перенесёшь эту в последнюю колонку — следующую Arcade даст сам. Нужно решение человека — не переноси, спроси.'))
  const sent = await giveClaude($, lines.join('\n'), 'page')
  // Карточку отдали этой сессии кнопкой — другие сессии видят «у сессии «…»» и очередью её не берут (очередь отмечает сама)
  if (!queued && sent && last && columnOf(page, board.board.cols) !== last.id) holdCard(page.id)
  await logGave($, page, board)
  return sent
}

// «Итог — в …» на карточке: Claude пишет комментарий в задачу карточки — в том трекере, где она
export async function trackerComment($, id) {
  if (!(await editNotes($, (list) => list))) return
  const page = S.notes.find((p) => p.id === id)
  const parent = page?.parent ? S.notes.find((p) => p.id === page.parent) : null
  const task = page && trackerTask(page, Boolean(parent && isBoard(parent)))
  if (task) await giveClaude($, trackerPrompt('comment', { page, task }), 'ask')
}

// Страницу отдали Claude — в итоги дня; не вышло отдать — нет
async function logGave($, page, board) {
  if (nb.bad) return
  await withNotes($, async () => logDay($, [{ at: await $.clock.now(), kind: 'gave', id: page.id, title: page.title, ...(board ? { board: board.title } : {}) }]))
}

// Проверка между карточками (app/check) — в итоги дня
export async function logCheck($, entry) {
  await withNotes($, async () => logDay($, [entry])).catch(modError)
}

// «Итоги дня»: страница «Итоги ДД.ММ» — что сегодня ушло Claude, что сделано и что ещё в работе (daylog.js). Сегодняшняя
// уже есть — её текст собирается заново. Потом — открыть её: оттуда итоги можно отдать Claude или отправить в чат команды
export async function makeSummary($) {
  const day = dayKey(await $.clock.now())
  const log = restoreLog(await $.store.get('daylog').catch(() => null))
  const title = `${tr('Итоги', S.lang)} ${day.slice(8)}.${day.slice(5, 7)}`
  let id = ''
  const done = await editNotes($,
    (list, at) => {
      const page = list.find((p) => !p.parent && !isBoard(p) && p.title === title)
      // Сами итоги, отданные Claude, в итоги не идут
      const sum = daySummary(page ? log.filter((x) => x.id !== page.id) : log, list, day, S.dk.me || S.ch.me || '')
      const body = summaryBody(sum, (text) => tr(text, S.lang), colName)
      if (page) {
        id = page.id
        return page.body === body ? list : updatePage(list, page.id, { body }, at)
      }
      const made = addPage(list, { title, body }, at)
      if (made.error) return NOTES_FULL
      id = made.page.id
      return made.notes
    },
    'Итоги собраны: отдай их Claude, отправь в чат или поправь.',
  )
  if (!done || !id) {
    // Не вышло — заметку туда, где её видно: под списком досок
    if (S.menu === 'boards') {
      S.dk.note = nb.note
      S.dk.bad = nb.bad
      nb.note = ''
      nb.bad = false
    }
    return $.ui.invalidate('ui.render')
  }
  nb.focus = ''
  nb.confirm = null
  S.menuFrom = S.menu
  S.menu = `note:${id}`
  $.ui.invalidate('ui.render')
}

// Страницу — в чат с друзьями или командой (chat — id чата): текстом, как пишут в чате (chatText). Заметка — под страницей
export async function pageToChat($, id, chat) {
  const page = S.notes.find((p) => p.id === id)
  if (!page || !S.acct.session || nb.sending) return
  nb.sending = chat
  nb.note = ''
  nb.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'send', parseSent, { body: { chat, text: chatText(page, MAX_TEXT) } })
  nb.sending = ''
  if (answer?.error) {
    nb.note = chatNote(answer.error)
    nb.bad = true
  } else if (answer) {
    const entry = S.ch.list?.find((c) => c.id === chat)
    nb.note = `${tr('Ушло в чат', S.lang)} ${entry ? chatTitle(entry) : ''}`.trim()
    nb.bad = false
    nb.chat = ''
  }
  $.ui.invalidate('ui.render')
}

// Отпустить карточку общей доски: её снова может взять любой
export function releaseCard($, id) {
  nb.take = ''
  return editNotes($, (list, at) => updateCard(list, id, { taken: '' }, at), 'Карточка свободна.')
}

// Просьба к Claude про другое приложение: перенести страницу туда (push), обновить её там (update), забрать текст
// оттуда (pull) или завести страницу блокнота из чужой (import). Сам Arcade ни с чем не говорит: всё делают
// коннекторы Claude (Notion, Google Docs…), ключи и пароли Arcade не нужны. Нет коннектора — Claude объяснит, как
// его подключить. Фразы — на языке интерфейса, данные (название, адрес, текст) — как есть
export function connectorPrompt(kind, { page = null, app = '', what = '' }) {
  const t = (text) => tr(text, S.lang)
  const intro = {
    push: 'Перенеси страницу из моего блокнота Arcade в другое приложение.',
    update: 'Обнови страницу в другом приложении текстом из моего блокнота Arcade.',
    pull: 'Забери текст страницы из другого приложения в мой блокнот Arcade.',
    import: 'Забери страницу из другого приложения в мой блокнот Arcade.',
  }[kind]
  const todo = {
    push: 'Создай там новую страницу с этим названием и текстом инструментами коннектора этого приложения. Потом свяжи её со страницей блокнота: mcp__arcade__notes, action link, с названием приложения и адресом новой страницы.',
    update: 'Замени текст той страницы на этот инструментами коннектора этого приложения.',
    pull: 'Прочитай ту страницу инструментами коннектора этого приложения и замени её текстом текст страницы блокнота: mcp__arcade__notes, action replace. Прежний текст останется в Arcade для отмены.',
    import: 'Найди и прочитай её инструментами коннектора (Notion, Google Docs и других). Потом создай страницу блокнота: mcp__arcade__notes, action create, с её названием и текстом, а в app и url — приложение и адрес той страницы, чтобы они остались связаны.',
  }[kind]
  const data = kind === 'import' ? [`${t('Что забрать')}: ${what}`] : [`${t('Приложение')}: ${app}`, ...(kind === 'push' ? [] : [`${t('Адрес')}: ${page.link?.url ?? ''}`]), `${t('Страница блокнота')}: ${page.id}`]
  const content = kind === 'push' || kind === 'update' ? ['', `# ${page.title}`, page.body] : []
  return [t(intro), ...data, ...content, '', t(todo), t('Нет инструментов этого приложения — ничего не делай, только объясни, как подключить его коннектор в Claude.')].join('\n')
}

// Просьба к Claude про трекер задач — тоже через коннектор, без ключей: забрать открытые задачи на доску карточками
// (import: tracker — GitHub, Linear, Jira или другой, board — доска, what — откуда, как вписал человек) или написать итог
// карточки комментарием в её задаче (comment: page — карточка, task — её задача). Уже взятые на доску задачи Claude
// пропускает — их адреса в просьбе. Задачу Claude не закрывает и статус её не меняет
export const TRACKERS = ['github', 'linear', 'jira', 'other']
export const TRACKER_NAMES = { github: 'GitHub', linear: 'Linear', jira: 'Jira', other: 'Другой трекер' }
export const TRACKER_ISSUES = 20 // задач за раз, не больше
// Трекер доски по умолчанию — тот, из которого последняя карточка-задача; задач нет — GitHub
export function boardTracker(board, notes) {
  const task = notes.filter((p) => p.parent === board.id).map((p) => trackerTask(p, true)).filter(Boolean).at(-1)
  return task ? (TRACKERS.find((k) => TRACKER_NAMES[k] === task.app) ?? 'other') : 'github'
}
export function trackerPrompt(kind, { tracker = 'github', board = null, page = null, task = null, what = '', notes = [] }) {
  const t = (text) => tr(text, S.lang)
  const none = t('Нет инструментов этого трекера — ничего не делай, только объясни, как подключить его коннектор в Claude.')
  if (kind === 'import') {
    const have = [...new Set(notes.filter((p) => p.parent === board.id).map((p) => trackerTask(p, true)?.url).filter(Boolean))]
    return [
      t('Забери задачи из трекера на доску из моего блокнота Arcade.'),
      `${t('Трекер')}: ${tracker === 'other' ? t('какой — видно из «Откуда»') : TRACKER_NAMES[tracker]}`,
      `${t('Доска')}: «${board.title}» (id ${board.id})`,
      `${t('Откуда')}: ${what}`,
      ...(have.length ? [`${t('Уже на доске')}: ${have.join(', ')}`] : []),
      '',
      `${t('Прочитай открытые задачи инструментами коннектора этого трекера — не больше')} ${TRACKER_ISSUES}. ${t('Каждую, которой ещё нет на доске, заведи карточкой: mcp__arcade__notes, action create, parent — id доски, title — название задачи, text — первой строкой «трекер: адрес задачи», дальше коротко её суть, app — название трекера, url — адрес задачи.')}`,
      none,
    ].join('\n')
  }
  return [
    t('Напиши итог по карточке из моего блокнота Arcade комментарием в её задаче в трекере.'),
    `${t('Трекер')}: ${task.app}`,
    `${t('Задача')}: ${task.url}`,
    `${t('Страница блокнота')}: ${page.id}`,
    '',
    `# ${page.title}`,
    page.body,
    '',
    t('Оставь в задаче короткий комментарий инструментами коннектора этого трекера: что сделано — по тексту и отмеченным пунктам карточки, на языке задачи. Задачу не закрывай и её статус не меняй.'),
    none,
  ].join('\n')
}

// Страница из другого приложения — в браузере по умолчанию (там человек вошёл в Notion); только https
export async function openLink($, url) {
  const command = openUrlCommand(S.platform, url)
  let opened = false
  if (command) {
    try {
      opened = (await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS }))?.exitCode === 0
    } catch {
      // не открылся — адрес и так написан на экране
    }
  }
  nb.note = opened ? 'Страница открыта в браузере.' : 'Браузер не открылся — адрес страницы написан выше.'
  nb.bad = !opened
  $.ui.invalidate('ui.render')
}

// «Копировать» на странице: буфер поверхности (терминал), не дошёл — системный буфер через программу ОС
export async function copyPage($, surface, text) {
  let copied = false
  try {
    copied = (await $.ui.copy({ text, surface }))?.isCopied === true
  } catch {
    // поверхность не умеет — дальше системный буфер
  }
  const command = copied ? null : clipboardCommand(S.platform)
  if (command) {
    try {
      copied = (await $.process.run(command.argv, { env: command.env, stdin: text, timeoutMs: LAUNCH_TIMEOUT_MS }))?.exitCode === 0
    } catch {
      // не вышло — заметка подскажет выделить текст в поле
    }
  }
  nb.note = copied ? 'Текст страницы скопирован.' : 'Не получилось скопировать — нажми «Редактировать» и выдели текст в поле.'
  nb.bad = !copied
  $.ui.invalidate('ui.render')
}

// --- Доска проектов -------------------------------------------------------------------------------------------------
// Доска — страница блокнота с колонками (board), карточки — её подстраницы с колонкой и местом: хранилище, редактор
// карточки и инструмент Claude — общие с блокнотом. Общая доска живёт и на сайте Arcade: правки уходят туда вскоре после
// правки (pushBoards), чужие приходят сверкой открытой доски по таймеру; сверка — в hooks/desks.js
export const BOARD_POLL_MS = 6_000 // сверка открытой общей доски
export const BOARDS_POLL_MS = 30_000 // список общих досок на экране «Доска проектов»
const PUSH_DELAY_MS = 1_500 // правки копятся столько, прежде чем уйти на сайт
const BOARD_SYNCS = 5 // сверок подряд, пока у доски остаются правки
const SHOWN_SETS = 5 // общих наборов, которые экран «Промпты» сверяет по таймеру
export const modError = (err) => log(`ошибка мода: ${err?.message ?? err}`)
// Название колонки: своё — как вписали, стандартное — на языке интерфейса
export const colName = (c) => c.name || tr(COL_NAMES[c.id] ?? c.id, S.lang)

// Почему с общей доской не вышло; made — при создании новой
function boardNote(error, made = false) {
  if (error === 'name') return 'Впиши название доски.'
  if (error === 'friend') return 'Звать на доску можно только друзей.'
  if (error === 'owner') return 'Это может только хозяин доски.'
  if (error === 'gone') return 'Доски больше нет на сайте или тебя на ней нет — у тебя осталась своя копия.'
  if (error === 'full') return 'На доске уже 20 человек — больше не позвать.'
  if (error === 'many') return 'Своих общих досок и наборов промптов — не больше 3. Больше — скоро по подписке.'
  if (error === 'nohandle') return 'Сначала возьми свой @ник.'
  if (error === 'often' || error === 'limit') return made ? 'Досок сегодня создано слишком много — попробуй завтра.' : 'Слишком часто — подожди минуту.'
  if (error === 'big') return 'Доска не приняла правки — их слишком много за раз.'
  if (error === 'off') return 'Общие доски на сайте сейчас выключены.'
  return accountNote(error)
}

// Общие доски — в хранилище; только в очереди (withNotes) и после блокнота
async function saveDesks($) {
  desksJson = JSON.stringify(S.desks)
  deskJsons = Object.fromEntries(Object.entries(S.desks).map(([share, base]) => [share, JSON.stringify(base)]))
  await $.store.set('desks', S.desks).catch(modError)
}

// Доску удалили из блокнота: у общей забыть и связь с сайтом
export function forgetDesk($, share) {
  return withNotes($, () => {
    delete S.desks[share]
    return saveDesks($)
  })
}

// Общие доски на экране — что сверять по таймеру: открытая доска (или доска открытой карточки), а на экране «Промпты» —
// все общие наборы шаблонов
export function shownShares() {
  if (S.menu === 'prompts') return S.notes.filter((p) => isPrompts(p) && p.board.share).map((p) => p.board.share).slice(0, SHOWN_SETS)
  const share = shownBoard()?.board.share
  return share ? [share] : []
}

// Доска на экране: открытая доска или доска открытой карточки
export function shownBoard() {
  const id = S.menu.startsWith('board:') ? S.menu.slice(6) : S.menu.startsWith('note:') ? S.menu.slice(5) : ''
  const page = id ? S.notes.find((p) => p.id === id) : null
  if (!page) return null
  if (isBoard(page)) return page
  const parent = page.parent ? S.notes.find((p) => p.id === page.parent) : null
  return isBoard(parent) ? parent : null
}

// Блокнот поменялся сверкой с сайтом: экран идёт за ним (follow), блокнот — в хранилище. Только в очереди (withNotes)
async function boardChanged($, list) {
  const base = S.notes
  follow($, list, true)
  await saveNotes($, base)
}

// Сверка общей доски share с сайтом: свои правки — туда, чужие — сюда. Пока одна сверка идёт, вторая ждёт (again);
// после сверки остались правки — ещё одна, но не больше BOARD_SYNCS подряд. names — спросить ники участников.
// Что отдать — из свежего блокнота; ответ ложится тоже на свежий. Пока ждали ответа, доску сверила другая сессия (её
// основа в хранилище другая) — ответ к старой основе бросаем: следующая сверка начнётся с новой. Если две сессии успели
// отдать одну и ту же правку, сайт примет её один раз: карточки он хранит по id
export async function syncBoard($, share, { names = false } = {}, round = 0) {
  if (S.dk.syncing.has(share)) {
    S.dk.again.add(share)
    return
  }
  if (!S.acct.session) return
  S.dk.syncing.add(share)
  S.dk.again.delete(share)
  let more = false
  try {
    const plan = await withNotes($, () => S.desks[share] && { base: S.desks[share], ...planSync(S.notes, S.desks[share]) })
    if (!plan) return
    const { base, ops, sent } = plan
    const answer = await chatFetch($, 'boardsync', parseBoard, { body: { board: share, since: base.rev, ops, ...(names || base.rev === 0 ? { names: true } : {}) } })
    if (!answer) return
    more = await withNotes($, async () => {
      if (S.desks[share] !== base) return false
      if (answer.error === 'gone') {
        await dropDesk($, share, boardNote('gone'), true)
        return false
      }
      if (answer.error) {
        S.dk.trouble = { share, text: boardNote(answer.error) }
        if (shownShares().includes(share)) $.ui.invalidate('ui.render')
        return false
      }
      const at = await $.clock.now()
      const done = applySync(S.notes, base, answer, sent, at)
      if (!done) {
        delete S.desks[share]
        await saveDesks($)
        return false
      }
      const before = JSON.stringify([base.owner, base.members, base.names, S.dk.trouble, S.dk.note])
      S.desks[share] = done.base
      if (S.dk.trouble?.share === share) S.dk.trouble = null
      if (done.refused.length) {
        S.dk.note = 'Доска на сайте полна — часть карточек осталась только у тебя.'
        S.dk.bad = true
      }
      if (done.missed) {
        S.dk.note = 'Блокнот полон — не все карточки доски поместились.'
        S.dk.bad = true
      }
      const shown = shownShares().includes(share)
      if (done.notes !== S.notes) await boardChanged($, done.notes)
      else if (shown && before !== JSON.stringify([done.base.owner, done.base.members, done.base.names, S.dk.trouble, S.dk.note])) $.ui.invalidate('ui.render')
      await saveDesks($)
      return !done.missed && planSync(S.notes, done.base).ops.length > 0
    })
  } finally {
    S.dk.syncing.delete(share)
    if ((more || S.dk.again.has(share)) && round + 1 < BOARD_SYNCS) syncBoard($, share, {}, round + 1).catch(modError)
  }
}

// Общей доски у человека больше нет (удалили, убрали его или вышел сам): в блокноте она остаётся своей
function loseBoard($, share, note, bad = false) {
  return withNotes($, () => dropDesk($, share, note, bad))
}

// То же — уже в очереди (withNotes)
async function dropDesk($, share, note, bad) {
  delete S.desks[share]
  if (S.dk.list) S.dk.list = S.dk.list.filter((b) => b.id !== share)
  if (S.dk.trouble?.share === share) S.dk.trouble = null
  const at = await $.clock.now()
  const page = S.notes.find((p) => isBoard(p) && p.board.share === share)
  S.dk.note = note
  S.dk.bad = bad
  S.dk.confirm = ''
  if (page) await boardChanged($, detachBoard(S.notes, page.id, at))
  else $.ui.invalidate('ui.render')
  await saveDesks($)
}

// Правки общих досок — на сайт вскоре после правки: несколько подряд уходят одной сверкой
export function pushBoards($) {
  if (!S.acct.session || !Object.keys(S.desks).length) return
  S.pushTimer?.cancel()
  S.pushTimer = $.clock.after(PUSH_DELAY_MS, () => {
    S.pushTimer = null
    for (const share of Object.keys(S.desks)) if (S.desks[share] && planSync(S.notes, S.desks[share]).ops.length) syncBoard($, share).catch(modError)
  })
}

// Общие доски с сайта: новые — в блокнот, доски, которых на сайте у человека больше нет, — своими. quiet — по
// таймеру: заметку не трогаем и перерисовываем, только если что-то поменялось
export async function loadBoards($, quiet = false) {
  if (!S.acct.session || S.dk.loading) return
  S.dk.loading = true
  if (!quiet) $.ui.invalidate('ui.render')
  let known, answer
  try {
    // Доски, которые были общими до вопроса: общую, которой поделились, пока ждали ответа, не трогаем
    known = await withNotes($, () => new Set([...Object.keys(S.desks), ...S.notes.filter((p) => isBoard(p) && p.board.share).map((p) => p.board.share)]))
    answer = await chatFetch($, 'boards', parseBoards)
  } finally {
    S.dk.loading = false
  }
  if (!answer) return
  if (answer.error) {
    if (quiet) return
    S.dk.note = boardNote(answer.error)
    S.dk.bad = true
    return $.ui.invalidate('ui.render')
  }
  const before = JSON.stringify([S.dk.list, S.dk.names])
  S.dk.me = answer.me
  S.dk.names = { ...S.dk.names, ...answer.names }
  S.dk.list = answer.boards
  // Новые доски — в свежий блокнот: другая сессия могла их уже завести
  const stale = await withNotes($, async () => {
    const at = await $.clock.now()
    let list = S.notes
    let full = false
    let lost = false
    for (const b of answer.boards) {
      if (S.desks[b.id] || S.dk.busy === 'share') continue
      const page = list.find((p) => isBoard(p) && p.board.share === b.id)
      if (page) {
        S.desks[b.id] = freshBase(list, page, b.owner)
        continue
      }
      const made = adoptBoard(list, b, at)
      if (made.error) {
        full = true
        continue
      }
      list = made.notes
      S.desks[b.id] = made.base
    }
    // Список целиком (не обрезан): общих досок, которых в нём нет, у человека на сайте больше нет
    if (answer.boards.length < 200) {
      const listed = new Set(answer.boards.map((b) => b.id))
      for (const share of known) {
        if (listed.has(share)) continue
        delete S.desks[share]
        const page = list.find((p) => isBoard(p) && p.board.share === share)
        if (page) list = detachBoard(list, page.id, at)
        lost = true
      }
    }
    if (full) {
      S.dk.note = 'Блокнот полон — не все общие доски поместились.'
      S.dk.bad = true
    } else if (lost) {
      S.dk.note = boardNote('gone')
      S.dk.bad = false
    }
    if (S.dk.trouble && !S.desks[S.dk.trouble.share]) S.dk.trouble = null
    if (list !== S.notes) await boardChanged($, list)
    else if (!quiet || full || lost || JSON.stringify([S.dk.list, S.dk.names]) !== before) $.ui.invalidate('ui.render')
    await saveDesks($)
    // Доски, которые поменялись на сайте или ждут своих правок, — сверить
    return answer.boards.filter((b) => S.desks[b.id] && (S.desks[b.id].rev === 0 || S.desks[b.id].rev !== b.rev || planSync(S.notes, S.desks[b.id]).ops.length))
  })
  for (const b of stale.slice(0, BOARD_SYNCS)) syncBoard($, b.id, { names: true }).catch(modError)
}

// Экран «Доска проектов» открыли: общие доски и друзья (звать на доску) — с сайта
export function boardsOpened($) {
  S.dk.note = ''
  S.dk.bad = false
  if (!S.acct.session) return
  loadBoards($).catch(modError)
  if (S.acct.handle && !S.fr.list && !S.fr.loading) friendsCall($, 'friends').catch(modError)
}

// Поделиться доской pageId с отмеченными друзьями: доска появляется на сайте, карточки уходят туда первой сверкой
export async function shareBoard($, pageId) {
  const page = S.notes.find((p) => p.id === pageId)
  if (!isBoard(page) || page.board.share || S.dk.busy) return
  if (!S.dk.picked.size) {
    S.dk.note = 'Отметь хотя бы одного друга.'
    S.dk.bad = true
    return $.ui.invalidate('ui.render')
  }
  if (S.dk.picked.size > MAX_MEMBERS - 1) {
    S.dk.note = boardNote('full')
    S.dk.bad = true
    return $.ui.invalidate('ui.render')
  }
  S.dk.busy = 'share'
  S.dk.note = ''
  S.dk.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'boardnew', parseBoard, { body: { name: page.title, cols: page.board.cols, members: [...S.dk.picked] } })
  S.dk.busy = ''
  if (!answer) return $.ui.invalidate('ui.render')
  if (answer.error) {
    S.dk.note = boardNote(answer.error, true)
    S.dk.bad = true
    return $.ui.invalidate('ui.render')
  }
  const share = answer.board.id
  const shared = await withNotes($, async () => {
    const at = await $.clock.now()
    const top = S.notes.find((p) => p.id === pageId)
    if (!isBoard(top) || top.board.share) return false
    const list = updatePage(S.notes, pageId, { board: { ...top.board, share } }, at)
    S.dk.me ||= answer.board.owner
    S.dk.names = { ...S.dk.names, ...answer.names }
    S.dk.list = [{ id: share, name: answer.board.name, owner: answer.board.owner, rev: answer.board.rev, at }, ...(S.dk.list ?? [])]
    S.dk.picked.clear()
    S.dk.note = 'Доска общая — друзья увидят её в своей «Доске проектов».'
    S.dk.bad = false
    await boardChanged($, list)
    // Карточек на сайте ещё нет: основа без них — первая сверка отдаст их все
    S.desks[share] = { ...freshBase(list, top, answer.board.owner), name: answer.board.name, cols: answer.board.cols, rev: answer.board.rev, cards: {}, members: answer.board.members, names: answer.names }
    await saveDesks($)
    return true
  })
  if (!shared) return $.ui.invalidate('ui.render')
  await syncBoard($, share, { names: true })
}

// Участники общей доски: позвать (add), убрать (remove) или выйти самому (leave); done — заметка, когда вышло
export async function boardMembers($, share, body, done) {
  const base = S.desks[share]
  if (S.dk.busy || !base) return
  S.dk.busy = body.leave ? 'leave' : body.add ? 'add' : 'remove'
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'boardmembers', parseBoardDone, { body: { board: share, ...body } })
  S.dk.busy = ''
  if (!answer) return $.ui.invalidate('ui.render')
  if (answer.error === 'gone') return loseBoard($, share, boardNote('gone'), true)
  if (answer.error) {
    S.dk.note = boardNote(answer.error)
    S.dk.bad = true
    return $.ui.invalidate('ui.render')
  }
  if (answer.left) return loseBoard($, share, 'Ты больше не на этой доске — у тебя осталась своя копия.')
  // Участники — в свежую доску: другая сессия могла её уже сверить
  await withNotes($, async () => {
    const now = S.desks[share]
    if (!now) return
    Object.assign(now, { owner: answer.board.owner, members: answer.board.members, names: { ...now.names, ...answer.names } })
    S.dk.picked.clear()
    S.dk.note = done
    S.dk.bad = false
    await saveDesks($)
  })
  $.ui.invalidate('ui.render')
}

// Хозяин удаляет общую доску с сайта, участник — выходит с неё; оба раза — после второго нажатия
export async function unshareBoard($, share) {
  const base = S.desks[share]
  if (!base || S.dk.busy) return
  if (S.dk.confirm !== `off-${share}`) {
    S.dk.confirm = `off-${share}`
    return $.ui.invalidate('ui.render')
  }
  S.dk.confirm = ''
  if (base.owner !== (S.dk.me || S.ch.me)) return boardMembers($, share, { leave: true }, '')
  S.dk.busy = 'delete'
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'boarddelete', parseBoardDone, { body: { board: share } })
  S.dk.busy = ''
  if (!answer) return $.ui.invalidate('ui.render')
  if (answer.error && answer.error !== 'gone') {
    S.dk.note = boardNote(answer.error)
    S.dk.bad = true
    return $.ui.invalidate('ui.render')
  }
  await loseBoard($, share, 'Доска удалена с сайта — у тебя и у друзей остались свои копии.')
}

// Правка доски с экрана: как в блокноте (editNotes), заметка — под доской. null — доску или карточку удалили в другой
// сессии: экран ушёл назад со своей заметкой
export async function editBoard($, change, saved = '') {
  const done = await editNotes($, change, saved)
  if (done === null) return null
  S.dk.note = nb.note
  S.dk.bad = nb.bad
  nb.note = ''
  nb.bad = false
  $.ui.invalidate('ui.render')
  return done
}

// Новая доска — и сразу открыть её, курсор — в поле новой карточки первой колонки
export async function createBoard($, title) {
  let page = null
  const done = await editBoard($, (list, at) => {
    const made = addPage(list, { title, board: {} }, at)
    if (made.error) return made.error === 'empty' ? 'Впиши название доски.' : NOTES_FULL
    page = made.page
    return made.notes
  })
  if (!done || !page) return
  S.dk.focus = `new-${page.board.cols[0].id}`
  S.menuFrom = S.menu
  S.menu = `board:${page.id}`
  $.ui.invalidate('ui.render')
}

// Новая карточка — вниз колонки col
export async function createCard($, boardId, col, title) {
  S.dk.focus = `new-${col}`
  await editBoard($, (list, at) => {
    const made = addPage(list, { title, parent: boardId, id: cardId(), col }, at)
    if (made.error) return made.error === 'empty' ? 'Впиши название карточки.' : made.error === 'parent' ? list : NOTES_FULL
    return made.notes
  })
}

// Участник доски: @ник — из доски, списка досок, чатов или друзей
export function deskPerson(id, base) {
  const handle = base?.names[id] ?? S.dk.names[id] ?? S.ch.names[id] ?? S.fr.list?.friends.find((p) => p.id === id)?.handle
  if (handle) return `@${handle}`
  if (id && id === (S.dk.me || S.ch.me) && S.acct.handle) return `@${S.acct.handle}`
  return tr('удалённый аккаунт', S.lang)
}

// Доску — Claude: колонки и карточки с id, чтобы он правил и переносил их инструментом блокнота
export async function sendBoard($, id) {
  if (!(await editBoard($, (list) => list))) return
  const board = S.notes.find((p) => p.id === id && isBoard(p))
  if (!board) return
  const t = (text) => tr(text, S.lang)
  const lines = [`${t('Доска проектов из моего блокнота Arcade')} (id ${board.id}):`, '', `# ${board.title}`]
  for (const c of board.board.cols) {
    lines.push('', `## ${colName(c)} (${t('колонка')} ${c.id})`)
    for (const card of columnCards(S.notes, board, c.id)) {
      const { done, total } = checkStats(card.body)
      lines.push(`- ${card.title} (id ${card.id})${total ? ` ☑ ${done}/${total}` : ''}`)
    }
  }
  lines.push('', t('Добавляй, правь и переноси карточки этой доски инструментом mcp__arcade__notes.'))
  await giveClaude($, lines.join('\n'), 'board')
  noteToBoard($)
}

// «Задачи из трекера»: Claude забирает открытые задачи на доску карточками; tracker — какой трекер выбран, what —
// репозиторий, ключ проекта или ссылка, как вписали
export async function importIssues($, id, tracker, what) {
  if (!(await editBoard($, (list) => list))) return
  const board = S.notes.find((p) => p.id === id && isBoard(p))
  if (!board) return
  await giveClaude($, trackerPrompt('import', { tracker, board, what, notes: S.notes }), 'ask')
  noteToBoard($)
}

// Заметка giveClaude — на экран доски
function noteToBoard($) {
  S.dk.note = nb.note
  S.dk.bad = nb.bad
  nb.note = ''
  nb.bad = false
  $.ui.invalidate('ui.render')
}

// --- Промпты --------------------------------------------------------------------------------------------------------
// Набор шаблонов — доска с одной колонкой (notes.isPrompts), шаблон — её карточка: название, текст, место. Хранилище,
// сверка общего набора с сайтом и инструмент Claude — общие с досками. Экран — screens/prompts

// Экран «Промпты» — и когда открыли страницу набора или шаблона (board:… или note:…): экран их забирает к себе
export function promptsShown() {
  if (S.menu === 'prompts') return true
  const id = S.menu.startsWith('board:') ? S.menu.slice(6) : S.menu.startsWith('note:') ? S.menu.slice(5) : ''
  const page = id ? S.notes.find((p) => p.id === id) : null
  return Boolean(page && (isPrompts(page) || (page.parent && isPrompts(S.notes.find((p) => p.id === page.parent)))))
}

// Заметки общих досок (S.dk.note) — словами про наборы, когда их показывает экран «Промпты»
const PROMPT_NOTES = {
  'Доска общая — друзья увидят её в своей «Доске проектов».': 'Набор общий — друзья увидят его в своих «Промптах».',
  'Доски больше нет на сайте или тебя на ней нет — у тебя осталась своя копия.': 'Набора больше нет на сайте или тебя в нём нет — у тебя осталась своя копия.',
  'На доске уже 20 человек — больше не позвать.': 'В наборе уже 20 человек — больше не позвать.',
  'Ты больше не на этой доске — у тебя осталась своя копия.': 'Ты больше не в этом наборе — у тебя осталась своя копия.',
  'Доска удалена с сайта — у тебя и у друзей остались свои копии.': 'Набор удалён с сайта — у тебя и у друзей остались свои копии.',
  'Звать на доску можно только друзей.': 'Звать в набор можно только друзей.',
  'Это может только хозяин доски.': 'Это может только хозяин набора.',
  'Досок сегодня создано слишком много — попробуй завтра.': 'Общих наборов сегодня создано слишком много — попробуй завтра.',
  'Доска на сайте полна — часть карточек осталась только у тебя.': 'Набор на сайте полон — часть шаблонов осталась только у тебя.',
  'Блокнот полон — не все карточки доски поместились.': 'Блокнот полон — не все шаблоны набора поместились.',
  'Доска не приняла правки — их слишком много за раз.': 'Набор не принял правки — их слишком много за раз.',
  'Общие доски на сайте сейчас выключены.': 'Общие наборы на сайте сейчас выключены.',
  'Впиши название доски.': 'Впиши название набора.',
}
export const promptNote = (text) => PROMPT_NOTES[text] ?? text

// Заметка правки или giveClaude — под шаблонами
function noteToPrompts($) {
  pr.note = nb.note
  pr.bad = nb.bad
  nb.note = ''
  nb.bad = false
  $.ui.invalidate('ui.render')
}

// Правка наборов с экрана «Промпты»: как в блокноте (editNotes), заметка — под шаблонами. null — набор или шаблон
// удалили в другой сессии: экран ушёл к списку со своей заметкой
export async function editPrompts($, change, saved = '') {
  const done = await editNotes($, change, saved)
  if (done === null) return null
  noteToPrompts($)
  return done
}

// Новый набор шаблонов; first — сразу и первый шаблон в нём (тогда он открывается на правку)
export async function createPromptSet($, title, first = '') {
  let card = null
  const done = await editPrompts($, (list, at) => {
    const made = addPage(list, { title, board: { cols: PROMPT_COLS } }, at)
    if (made.error) return made.error === 'empty' ? 'Впиши название набора.' : NOTES_FULL
    if (!first) return made.notes
    const added = addPage(made.notes, { title: first, parent: made.page.id, id: cardId(), col: PROMPTS_COL }, at)
    if (added.error) return added.error === 'empty' ? 'Впиши название шаблона.' : NOTES_FULL
    card = added.page
    return added.notes
  })
  if (!done) return
  pr.field++
  if (card) {
    pr.edit = card.id
    pr.focus = 'text'
  }
  $.ui.invalidate('ui.render')
}

// Новый шаблон — вниз набора setId, и сразу открыть его: курсор — в поле «Текст»
export async function addPrompt($, setId, title) {
  let card = null
  const done = await editPrompts($, (list, at) => {
    if (!isPrompts(list.find((p) => p.id === setId))) return 'Набор удалили в другой сессии.'
    const made = addPage(list, { title, parent: setId, id: cardId(), col: PROMPTS_COL }, at)
    if (made.error) return made.error === 'empty' ? 'Впиши название шаблона.' : NOTES_FULL
    card = made.page
    return made.notes
  })
  if (!done || !card) return
  pr.field++
  pr.edit = card.id
  pr.focus = 'text'
  $.ui.invalidate('ui.render')
}

// Шаблон с текстом — или null: пустой открывается на правку с заметкой. Набранное в поле «Текст» — сначала в шаблон
async function promptText($, id) {
  if (!(await editPrompts($, (list) => list))) return null
  const page = S.notes.find((p) => p.id === id)
  if (!page) return null
  if (page.body.trim()) return page.body
  pr.edit = id
  pr.focus = 'text'
  pr.note = 'В шаблоне пока нет текста — впиши его.'
  pr.bad = true
  $.ui.invalidate('ui.render')
  return null
}

// Шаблон — Claude, как «Дать Claude»: сразу, если он свободен, иначе — ждёт в поле ввода
export async function sendPrompt($, id) {
  const text = await promptText($, id)
  if (text === null) return
  await giveClaude($, text, 'prompt')
  noteToPrompts($)
}

// Шаблон — в поле ввода Claude, к тому, что там уже набрано, без отправки: дописать и отправить самому
export async function promptToField($, id) {
  const text = await promptText($, id)
  if (text === null) return
  const { text: draft } = await $.prompt.read().catch(() => ({ text: '' }))
  const filled = await $.prompt.fill({ text: String(draft ?? '').trim() ? `\n${text}` : text, mode: 'append' }).catch(() => ({}))
  pr.note = filled.isFilled ? 'Шаблон — в поле ввода: допиши и отправь.' : 'Не получилось вставить шаблон в поле ввода.'
  pr.bad = !filled.isFilled
  $.ui.invalidate('ui.render')
}

// ━━━━━━━━━━ app/library ━━━━━━━━━━
// Arcade: каталог игр, разделы главного меню, полки, избранное и свои игры.

export function consoles() {
  return S.catalog.consoles
}

// Группы вкладок и полки: «Игры» — шутеры, гонки, стратегии, настольные
// «Поддержать проект»: ссылка из каталога сайта, пока каталога нет — запасная
const SUPPORT_URL = 'https://ko-fi.com/agentarcade'
export function supportUrl() {
  return S.catalog.support?.url ?? SUPPORT_URL
}

// Пункты главного меню в порядке каталога: группа стоит там, где её первая приставка
export function menuTabs() {
  const tabs = []
  for (const c of consoles()) {
    const g = c.group && groupsList().find((x) => x.id === c.group)
    if (!g) tabs.push(c)
    else if (!tabs.includes(g)) tabs.push(g)
  }
  return tabs
}

// Жанр игры для заголовка раздела: перевод на язык интерфейса и с заглавной буквы («аркада» → «Аркада», «Arcade»)
export function genreLabel(genre) {
  const t = tr(genre, S.lang)
  return t.charAt(0).toLocaleUpperCase() + t.slice(1)
}

export function groupsList() {
  return S.catalog.groups ?? []
}
export function shelvesList() {
  return S.catalog.shelves ?? []
}
export function groupConsoles(groupId) {
  return consoles().filter((c) => c.group === groupId).map((c) => c.id)
}
export function shelfGames(shelfId) {
  return games().filter((g) => g.shelf === shelfId && !g.mine && consoles().some((c) => c.id === g.console && c.group))
}
// Полка как «приставка» для списка игр: заголовок, адрес вкладки окна, группа для «Назад»
export function shelfView(menuId) {
  const s = shelvesList().find((x) => `shelf:${x.id}` === menuId)
  if (!s) return null
  const g = shelfGames(s.id)[0]
  const group = consoles().find((c) => c.id === g?.console)?.group ?? groupsList()[0]?.id
  return { id: menuId, title: s.title, tab: `${group}:${s.id}`, group, list: shelfGames(s.id) }
}

// Игры каталога и проверка клавиш; note — строка под названием в меню
export function games() {
  return [
    ...S.catalog.games.map((g) => {
      // Описание: по-русски, перевод с английского или английское, если перевода на этот язык нет
      const about = S.lang === 'ru' || !g.about_en ? g.about : g.about_i18n?.[S.lang] || g.about_en
      return { ...g, note: `${tr(g.genre, S.lang)}${about ? ` — ${about}` : ''}`, web: true }
    }),
    ...S.mine.map((m) => ({
      id: m.id,
      console: m.console,
      title: m.title,
      note: `${CONSOLE_NAMES[m.console]} — твой файл, хранится только у тебя`,
      rom: { sha256: m.sha256, mine: true },
      web: true, // в окне: страница найдёт файл в браузере или один раз попросит его выбрать
      mine: true,
    })),
    FIELD,
  ]
}

export function mineFile(sha256) {
  return `${S.dataDir}${S.sep}${sha256}.b64`
}

export function gameById(id) {
  return games().find((g) => g.id === id)
}

export function consoleNote(c) {
  const count = c.group === undefined && groupsList().some((g) => g.id === c.id)
    ? games().filter((g) => groupConsoles(c.id).includes(g.console) && !g.mine).length
    : games().filter((g) => g.console === c.id && !g.mine).length
  return count ? `${count} ${plural(count, 'игра', 'игры', 'игр')}` : 'скоро'
}

// Пункт главного меню, где лежит игра или книга: группа («Игры», «Книги») или приставка без группы
export function tabOf(g) {
  const c = consoles().find((x) => x.id === g.console)
  return (c?.group && groupsList().find((x) => x.id === c.group)) || c || null
}
// Избранное: игры и книги по порядку отметки. Чего нет в каталоге (своя игра с другого компьютера) — не показываем
export function favoriteGames() {
  return S.favorites.map((id) => gameById(id)).filter((g) => g && g.id !== FIELD.id)
}
// Избранное внутри группы («Игры») или полки книг: заголовок и что в него входит. null — всё избранное
export function favoritesScope(scope) {
  const shelf = shelfView(scope)
  if (shelf) return { title: shelf.title, has: (g) => shelf.list.some((x) => x.id === g.id) }
  const group = groupsList().find((x) => x.id === scope)
  if (group) return { title: group.title, has: (g) => groupConsoles(group.id).includes(g.console) }
  return null
}

export function libraryTitle() {
  if (S.menu === 'settings') return 'Arcade · настройки'
  if (S.menu === 'lang') return 'Arcade · язык'
  if (S.menu === 'account') return 'Arcade · аккаунт'
  if (S.menu === 'friends' || S.menu.startsWith('friends:')) return 'Arcade · друзья'
  if (S.menu === 'chats' || S.menu.startsWith('chats:')) return 'Arcade · чаты'
  if (S.menu === 'report') return 'Arcade · отчёт об ошибке'
  if (S.menu === 'reports') return 'Arcade · отчёты об ошибках'
  if (S.menu === 'search') return 'Arcade · поиск'
  if (S.menu === 'favorites') return 'Arcade · избранное'
  if (S.menu.startsWith('favorites:')) return `Arcade · ★ ${favoritesScope(S.menu.slice(10))?.title ?? ''}`
  if (S.menu === 'youtube' || S.menu.startsWith('youtube:')) return 'Arcade · YouTube'
  if (S.menu === 'articles' || S.menu.startsWith('articles:')) return 'Arcade · Статьи'
  if (S.menu === 'podcasts' || S.menu.startsWith('podcasts:')) return 'Arcade · Подкасты'
  if (S.menu === 'twitch' || S.menu.startsWith('twitch:')) return 'Arcade · Twitch'
  if (S.menu === 'tiktok') return 'Arcade · TikTok'
  if (promptsShown()) return 'Arcade · промпты'
  if (S.menu === 'boards' || S.menu.startsWith('board:') || shownBoard()) return 'Arcade · доска проектов'
  if (S.menu === 'notes' || S.menu.startsWith('note:')) return 'Arcade · блокнот'
  if (S.menu === 'books' || S.menu.startsWith('books:')) return 'Arcade · Книги'
  if (S.menu === 'audiobooks' || S.menu.startsWith('audiobooks:')) return 'Arcade · Аудиокниги'
  if (S.menu === 'mine') return 'Arcade · мои игры'
  const c = consoles().find((x) => x.id === S.menu) ?? groupsList().find((x) => x.id === S.menu) ?? shelfView(S.menu)
  return c ? `Arcade · ${c.title}` : 'Arcade'
}

// Добавить свою игру: путь → сообщение для меню. Копия файла — в папку данных, запись — в «Мои игры».
// Файл никуда не отправляется. Вызывают команда /arcade-add и поле «Добавить файл» в меню.
export async function addMine($, rawPath) {
  const path = cleanPath(rawPath)
  let message
  if (!path) {
    message = 'Укажи путь к файлу: /arcade-add C:\\Games\\game.nes — или перетащи файл в терминал после команды.'
  } else if (!S.dataDir) {
    message = 'Не нашёл домашнюю папку, некуда сохранить копию игры.'
  } else {
    try {
      const stat = await $.fs.stat(path).catch(() => null)
      if (!stat) throw new Error(`файл не найден: ${path}`)
      if (stat.kind !== 'file') throw new Error('это не файл')
      if (stat.size > MINE_MAX_BYTES) {
        throw new Error('файл больше 4 МБ. Здесь добавляются игры Денди и Sega, а диски PlayStation — в окне Arcade: меню PlayStation → «Открыть в окне»')
      }
      const { base64 } = await $.fs.read(path, { as: 'bytes' })
      const bytes = Uint8Array.fromBase64(base64)
      const info = identifyRom(bytes, path)
      if (info.error) throw new Error(info.error)
      const sha = await sha256Hex(bytes)
      const title = titleFromPath(path)
      if (S.mine.some((m) => m.sha256 === sha)) {
        message = `«${title}» уже есть в «Моих играх».`
      } else {
        await $.fs.write(mineFile(sha), base64)
        S.mine = [...S.mine, { id: mineId(sha), console: info.console, title, sha256: sha }]
        await $.store.set('mine', S.mine)
        message = `Добавлено: ${title} (${CONSOLE_NAMES[info.console]}).`
      }
    } catch (err) {
      message = `Не получилось добавить: ${err?.message ?? err}`
    }
  }
  return message
}

// ━━━━━━━━━━ app/calendar ━━━━━━━━━━
// Arcade: календарь — хранилище, правки с экрана, инструмент Claude и напоминания.

// Календарь в $.store — один на все сессии, как блокнот (см. app/work): всякая правка — по очереди и поверх свежего
// календаря из хранилища. calJson — календарь, каким его последний раз прочли или записали
let calJson = ''
let calQueue = Promise.resolve()

export function calFresh($, work) {
  const chained = calQueue.then(async () => work(await readCalendar($)))
  calQueue = chained.catch(() => {})
  return chained
}

export async function loadCalendar($) {
  const raw = await $.store.get('calendar')
  calJson = JSON.stringify(raw ?? null)
  S.calendar = restoreCalendar(raw)
}

// Перечитать календарь: false — не поменялся, true — поменялся, 'gone' — открытое событие удалили (экран ушёл назад)
async function readCalendar($) {
  let raw
  try {
    raw = await $.store.get('calendar')
  } catch (err) {
    modError(err)
    return false
  }
  const json = JSON.stringify(raw ?? null)
  if (json === calJson) return false
  calJson = json
  return calFollow($, restoreCalendar(raw))
}

// Календарь поменялся в другой сессии: экран идёт за ним, напоминания — тоже. Поля открытого события рисуются заново,
// только если поменялось само событие, а не отметка о показанном напоминании
const sameEvent = (a, b) =>
  ['title', 'day', 'time', 'note', 'remind', 'color', 'repeat', 'cwd', 'missed'].every((k) => a[k] === b[k]) && JSON.stringify(a.give ?? null) === JSON.stringify(b.give ?? null)
function calFollow($, list) {
  const open = S.menu.startsWith('calendar:') ? S.menu.slice(9) : ''
  const was = open ? S.calendar.find((e) => e.id === open) : null
  const now = open ? list.find((e) => e.id === open) : null
  S.calendar = list
  let gone = false
  if (open && !now) {
    S.menuFrom = null
    S.menu = 'calendar'
    cal.note = 'Открытое событие удалили в другой сессии.'
    cal.bad = true
    cal.confirm = false
    gone = true
  } else if (was && now && !sameEvent(was, now)) cal.field += 1
  schedule($)
  $.ui.invalidate('ui.render')
  return gone ? 'gone' : true
}

// Перечитать календарь, пока он на экране, — по таймеру, как блокнот (NOTES_POLL_MS)
export function refreshCalendar($) {
  return calFresh($, (moved) => moved)
}
export const calendarShown = () => S.menu === 'calendar' || S.menu.startsWith('calendar:')

export async function calendarChanged($, list) {
  S.calendar = list
  calJson = JSON.stringify(list)
  $.ui.invalidate('ui.render')
  await $.store.set('calendar', list).catch((err) => {
    cal.note = 'Не получилось сохранить календарь.'
    cal.bad = true
    modError(err)
  })
  schedule($)
}

// Инструмент календаря у Claude — поверх свежего календаря: list видит события других сессий
export async function calendarTool($, input) {
  // Задание смотрит в блокнот (доска, карточка, шаблон) — сначала свежий блокнот: его могли поправить в другой сессии
  if (input?.give || input?.target !== undefined) await refreshNotes($).catch(() => {})
  return calFresh($, async () => {
    const at = await $.clock.now()
    const out = applyCalendarTool(S.calendar, input, at, cardDues(S.notes), { notes: S.notes, cwd: S.ag?.path ?? '' })
    if (out.changed) await calendarChanged($, out.list)
    return out
  })
}

// --- Правки с экрана -----------------------------------------------------------------------------------------------
const PROBLEMS = {
  title: 'Впиши, что за событие.',
  day: 'Такого дня нет в календаре.',
  time: 'Время пиши как 15:00.',
  remind: 'Такого напоминания нет.',
  color: 'Такого цвета нет.',
  repeat: 'Такого повтора нет.',
  full: 'Календарь полон — удали старые события.',
  missing: 'Событие удалили в другой сессии.',
  give: 'Такого задания для Claude нет.',
}

// change(list, at) → новый список или { error }. true — сделано, false — нет (заметка скажет почему), null — открытое
// событие удалили в другой сессии
function editCalendar($, change, saved = '') {
  return calFresh($, async (moved) => {
    if (moved === 'gone') return null
    const at = await $.clock.now()
    const out = change(S.calendar, at)
    if (out.error) {
      cal.note = PROBLEMS[out.error] ?? PROBLEMS.missing
      cal.bad = true
      $.ui.invalidate('ui.render')
      return false
    }
    cal.note = saved
    cal.bad = false
    await calendarChanged($, out.list ?? out)
    return true
  })
}

// Запись одной строкой: «завтра 15:00 Созвон». Без дня — день base (в Desktop — выбранный в сетке), без него — сегодня;
// экран переходит к дню события
export async function addFromScreen($, text, base = '') {
  const at = await $.clock.now()
  const today = dayKey(at)
  const parsed = quickParse(text, base || today, today)
  let made = null
  const done = await editCalendar($,
    (list, now) => {
      const out = addEvent(list, parsed, now)
      made = out.event ?? null
      return out
    },
    'Записано.',
  )
  if (!done || !made) return
  cal.day = made.day
  cal.month = made.day.slice(0, 7)
  cal.field += 1
  $.ui.invalidate('ui.render')
}

// Правка события: changes — как у updateEvent
export function editEvent($, id, changes, saved = 'Сохранено.') {
  return editCalendar($, (list, now) => updateEvent(list, id, changes, now), saved)
}

// Что предложить в выборе напоминания: готовые варианты и, если Claude поставил другое, — его тоже, по порядку
export function remindChoices(ev) {
  const base = ev.time ? REMIND_CHOICES : REMIND_CHOICES_ALL_DAY
  if (base.includes(ev.remind)) return base
  return [...base.filter((m) => m !== null && m < ev.remind), ev.remind, ...base.filter((m) => m === null || m > ev.remind)]
}
// Напоминание по кругу — где нет выбора из списка (Claude на телефоне)
export function nextRemind(ev) {
  const steps = remindChoices(ev)
  return steps[(steps.indexOf(ev.remind) + 1) % steps.length]
}

export async function deleteEvent($, id) {
  const done = await editCalendar($, (list) => (list.some((e) => e.id === id) ? removeEvent(list, id) : { error: 'missing' }), 'Событие удалено.')
  if (done === null) return
  cal.confirm = false
  S.menuFrom = null
  S.menu = 'calendar'
  $.ui.invalidate('ui.render')
}

// --- Напоминания ---------------------------------------------------------------------------------------------------
// Один таймер — до ближайшего напоминания, но не дольше RECHECK_MS: событие могли записать в сессии, которую потом
// закрыли, а часы компьютера — уйти вперёд во сне. Таймеры всех открытых сессий срабатывают разом, поэтому сессия
// помечает напоминания своей отметкой (me) и через CLAIM_MS перечитывает хранилище: показывает та, чья отметка осталась
const RECHECK_MS = 10 * 60_000
export const CAL_CLAIM_MS = 500
// Напоминание показали позже его времени больше чем на LATE_MS (Claude Code был закрыт) — «Пропущено»
export const LATE_MS = 2 * 60_000
const SHOW_MAX = 3
export const me = `s${Math.random().toString(36).slice(2, 10)}`
let timer = null
let gen = 0

// Сроки карточек досок напоминают как события на весь день (cardDues). Отметки о показанном — отдельно от календаря, в
// $.store под ключом cardAlerts: id карточки → { alerted, alertedBy }. Блокнот — из памяти сессии (S.notes): его
// перечитывают по таймеру, пока он на экране, и всякая его правка
async function cardEvents($) {
  const raw = await $.store.get('cardAlerts').catch(() => null)
  const marks = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return cardDues(S.notes)
    .filter((x) => x.remind !== null)
    .map((x) => {
      const m = marks[x.card]
      return { ...x, ...(Number.isFinite(m?.alerted) ? { alerted: m.alerted } : {}), ...(typeof m?.alertedBy === 'string' ? { alertedBy: m.alertedBy } : {}) }
    })
}
async function saveCardAlerts($, cards) {
  const marks = {}
  for (const x of cards) if (x.alerted !== undefined) marks[x.card] = { alerted: x.alerted, ...(x.alertedBy ? { alertedBy: x.alertedBy } : {}) }
  await $.store.set('cardAlerts', marks).catch(modError)
}

export function schedule($) {
  const my = ++gen
  timer?.cancel?.()
  timer = null
  planNext($, my).catch(modError)
}

// Завести таймер до ближайшего напоминания (из календаря и карточек), но не дольше RECHECK_MS; my — номер вызова schedule
async function planNext($, my) {
  const now = await $.clock.now()
  const cards = await cardEvents($)
  if (my !== gen) return
  const nextAt = nextReminder([...S.calendar, ...cards], now)
  const wait = nextAt === null ? RECHECK_MS : Math.max(0, Math.min(nextAt - now, RECHECK_MS))
  timer = $.clock.after(wait, () => {
    timer = null
    remindNow($).catch(modError)
  })
}

// Показать напоминания, которым пора, и пропущенные; давно прошедшие — отметить молча
export async function remindNow($) {
  const mine = await calFresh($, async () => {
    const now = await $.clock.now()
    const cards = await cardEvents($)
    const { due, stale } = dueReminders([...S.calendar, ...cards], now)
    if (!due.length && !stale.length) {
      schedule($)
      return []
    }
    const mark = (list) =>
      markAlerted(
        markAlerted(
          list,
          stale.map((e) => e.id),
          '',
          now,
        ),
        due.map((e) => e.id),
        me,
        now,
      )
    const touched = new Set([...due, ...stale].map((e) => e.id))
    if (cards.some((x) => touched.has(x.id))) await saveCardAlerts($, mark(cards))
    if (S.calendar.some((e) => touched.has(e.id))) await calendarChanged($, mark(S.calendar))
    else schedule($)
    return due
  })
  if (!mine.length) return
  await new Promise((done) => $.clock.after(CAL_CLAIM_MS, done))
  // Показывает та сессия, чья отметка осталась; у серии показываем тот её раз, которому было пора (из due)
  const shown = await calFresh($, async () => {
    const claimed = new Set([...S.calendar, ...(await cardEvents($))].filter((e) => e.alertedBy === me).map((e) => e.id))
    return mine.filter((x) => claimed.has(x.id))
  })
  if (shown.length) await showReminders($, shown, await $.clock.now())
}

// «сегодня», «завтра», «вчера», «06.11»
export const dayText = (day, today) =>
  day === today ? tr('сегодня', S.lang) : day === addDays(today, 1) ? tr('завтра', S.lang) : day === addDays(today, -1) ? tr('вчера', S.lang) : `${day.slice(8)}.${day.slice(5, 7)}`

// «сегодня 15:00», «завтра, весь день», «06.11 9:30»
export function whenText(ev, today) {
  const day = dayText(ev.day, today)
  return ev.time ? `${day} ${ev.time}` : `${day}, ${tr('весь день', S.lang)}`
}

async function showReminders($, events, now) {
  const today = dayKey(now)
  const line = (ev) =>
    `${now - remindAt(ev) > LATE_MS ? `${tr('Пропущено', S.lang)}: ` : ''}${ev.card ? `${tr('Срок карточки', S.lang)}: ${ev.title} — ${dayText(ev.day, today)}` : `${ev.title} — ${whenText(ev, today)}`}`
  const lines = events.slice(0, SHOW_MAX).map(line)
  if (events.length > SHOW_MAX) lines.push(`${tr('и ещё', S.lang)} ${events.length - SHOW_MAX}`)
  await $.ui.toast(`${tr('Календарь', S.lang)}: ${lines.join('; ')}`)
  notifyOs($, lines.join('\n'))
}

// Системное уведомление «Календарь Arcade» — и при закрытой панели, и когда Claude Code свёрнут
export function notifyOs($, text) {
  const command = notifyCommand(S.platform, tr('Календарь Arcade', S.lang), text)
  if (!command) return
  $.clock.after(0, async () => {
    try {
      await $.process.run(command.argv, { env: command.env, timeoutMs: 15_000 })
    } catch (err) {
      log(`уведомление не показалось: ${err?.message ?? err}`)
    }
  })
}

// ━━━━━━━━━━ app/usage ━━━━━━━━━━
// Arcade: лимиты Claude — окна подписки (5 часов, неделя, лимит расходов), заполнение контекста и расходы сессии.
// Цифры — самого Claude Code ($.session.usage: после хода и раз в полминуты): Arcade своих не считает. Окна лимитов — у
// учётной записи, общие для всех её сессий: другие сессии пишут свои замеры в отметки (app/agents), и на экране — самый
// свежий. Здесь же — что нужно очереди доски, чтобы узнать «кончился лимит» и продолжить после сброса (app/queue)

export const WARN_AT = [90, 80] // всплывашка, когда окно лимита дошло до стольких процентов: о каждом пороге — раз
const WARNED_KEY = 'usageWarned' // в $.store: { 'вид|сброс': [порог, когда] } — о чём уже предупредили, во всех сессиях
const WARNED_KEEP_MS = 8 * 86_400_000 // предупреждения об окне без времени сброса — не дольше недели с хвостиком
export const LIMIT_LABEL = { five_hour: '5 часов', seven_day: 'Неделя', spend_limit: 'Лимит расходов' }
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

// me — последний замер этой сессии: { ctx, tokens, window, usd, limits: [{ kind, pct, reset }], at } или null; api —
// у этого Claude Code есть $.session.usage; warn — всплывашки 80 и 90% (настройка usageWarn)
S.us = { me: null, api: true, warn: true }

// Перевод строки на язык интерфейса — один на весь файл: им пользуются разделы лимитов, проверки, очереди и расписания
const t = (text) => tr(text, S.lang)
const pad = (n) => String(n).padStart(2, '0')
export const hhmm = (ms) => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Окна лимитов — коротко: вид, проценты, когда сброс (мс; 0 — неизвестно)
export function limitsOf(list) {
  return (Array.isArray(list) ? list : [])
    .filter((w) => w && typeof w.kind === 'string' && Number.isFinite(w.percentUsed))
    .map((w) => ({ kind: w.kind, pct: w.percentUsed, reset: Date.parse(w.resetsAt ?? '') || 0 }))
}

// Замер Claude Code ($.session.usage) → наш вид
function readingOf(u, at) {
  const ctx = u?.context ?? {}
  return {
    ctx: Number.isFinite(ctx.percent) ? ctx.percent : null,
    tokens: Number.isFinite(ctx.tokens) ? ctx.tokens : null,
    window: Number.isFinite(ctx.window) ? ctx.window : 0,
    usd: Number.isFinite(u?.cost?.usd) ? u.cost.usd : null,
    limits: limitsOf(u?.rateLimits),
    at,
  }
}

// Спросить Claude Code сейчас (без разбивки контекста — бесплатно). Не ответил — null, и api: false, пока не ответит
// (проверить заранее нельзя: $ пишется только вызовом, $.session.usage(...); у старого Claude Code его нет, а как он
// откажет — неизвестно). В журнал на экране не пишем: спрашиваем раз в полминуты, а что лимитов нет — экран скажет сам
export async function usageNow($) {
  try {
    const u = await $.session.usage()
    S.us.me = readingOf(u, await $.clock.now())
    S.us.api = true
    return S.us.me
  } catch {
    S.us.api = false
    return null
  }
}

// Окна лимитов для экрана: самый свежий замер, где они есть, — свой или другой сессии (others — их отметки)
export function freshLimits(others) {
  const all = [S.us.me, ...others.map((r) => r.usage)].filter((u) => Array.isArray(u?.limits) && u.limits.length)
  return all.sort((a, b) => b.at - a.at)[0] ?? null
}

// Окно, которое кончилось: 100% и больше, сброс ещё впереди; из нескольких — что сбросится позже: раньше Claude не ответит
export function spentWindow(limits, now) {
  const out = (limits ?? []).filter((w) => w.pct >= 100 && (!w.reset || w.reset > now))
  return out.sort((a, b) => b.reset - a.reset)[0] ?? null
}

// Ход кончился ошибкой API — не лимит ли это? { reset } (0 — время сброса неизвестно) или null
export async function limitHit($) {
  const now = await $.clock.now()
  const u = (await usageNow($)) ?? S.us.me
  const w = spentWindow(u?.limits, now)
  return w ? { reset: w.reset } : null
}

// Время на часах: «14:30»; через 20 часов и дальше — с днём недели: «Пт 09:00»
export const clockText = (ms, now) => (Math.abs(ms - now) >= 20 * 3_600_000 ? `${t(WEEKDAYS[new Date(ms).getDay()])} ${hhmm(ms)}` : hhmm(ms))

// «сбросится в 14:30 (через 1 ч 20 мин)»; через 20 часов и дальше — «сбросится в Пт 09:00»; уже прошло — «сбросился в 14:30»
export function resetText(reset, now) {
  if (!reset) return ''
  if (reset <= now) return fill(t('сбросился в {0}'), [clockText(reset, now)])
  if (reset - now >= 20 * 3_600_000) return fill(t('сбросится в {0}'), [clockText(reset, now)])
  return fill(t('сбросится в {0} (через {1})'), [hhmm(reset), t(agoText(reset - now))])
}

export const limitName = (kind) => (LIMIT_LABEL[kind] ? t(LIMIT_LABEL[kind]) : kind)
export const pctText = (pct) => `${Math.floor(pct)}%`
export const usdText = (usd) => `$${usd.toFixed(2)}`

// Всплывашка: окно лимита дошло до 80 или 90% — о каждом пороге каждого окна один раз во всех сессиях
export async function warnCheck($) {
  const me = S.us.me
  if (!S.us.warn || !me) return
  const hot = me.limits.map((w) => ({ w, p: WARN_AT.find((p) => w.pct >= p) })).filter((x) => x.p)
  if (!hot.length) return
  const now = await $.clock.now()
  const saved = await $.store.get(WARNED_KEY).catch(() => null)
  const warned = {}
  for (const [key, v] of Object.entries(saved && typeof saved === 'object' ? saved : {})) {
    const reset = Number(key.split('|')[1])
    if (Array.isArray(v) && !(reset && reset < now) && now - Number(v[1]) < WARNED_KEEP_MS) warned[key] = v
  }
  let warnedNow = false
  for (const { w, p } of hot) {
    const key = `${w.kind}|${w.reset}`
    if ((Number(warned[key]?.[0]) || 0) >= p) continue
    warned[key] = [p, now]
    warnedNow = true
    const when = resetText(w.reset, now)
    $.ui.toast(`${fill(t('Лимит Claude «{0}»: {1}'), [limitName(w.kind), pctText(w.pct)])}${when ? ` — ${when}` : ''}`)
  }
  if (warnedNow) await $.store.set(WARNED_KEY, warned).catch((err) => log(`лимиты: ${err?.message ?? err}`))
}

// ━━━━━━━━━━ app/check ━━━━━━━━━━
// Arcade: проверка между карточками очереди. У доски — команда проверки (npm test, pytest, cargo build…), у карточки
// может быть своя. Claude закончил ход, карточка в последней колонке — очередь, прежде чем дать следующую, запускает
// команду в папке этой сессии. Код 0 — дальше; иначе карточка возвращается во вторую колонку с пометкой «проверка не
// прошла», очередь встаёт, а Claude получает хвост вывода. Команда хранится только на этом компьютере ($.store) и
// задаётся только с экрана: в блокнот и на сайт она не попадает, инструмент блокнота Claude её не видит и не меняет —
// команду с общей доски чужой человек не подложит

const KEY = 'queueCheck'
export const CHECK_MAX = 500 // знаков в команде, не больше
export const CHECK_MS = 10 * 60_000 // столько команда может идти; дольше — не прошла
const KEEP = 200 // команд досок и карточек в хранилище, не больше
const TAIL_LINES = 40 // хвост вывода для Claude
const TAIL_CHARS = 3_000
const ID = /^[a-z0-9]{1,20}$/
const FAIL = 'Проверка не прошла'

// S.qc: boards — { [id доски]: команда }, cards — { [id карточки]: своя команда }; last — { [id доски]: последний итог
// { card, title, cmd, ok, code, tail, at } }; running — идёт проверка { board, card, title, cmd }; mine — карточки, чья
// проверка не прошла в этой сессии (после перезапуска очереди их проверить снова)
S.qc = { boards: {}, cards: {}, last: {}, running: null, mine: new Set() }

// Команда — одной строкой, без пробелов по краям, не длиннее CHECK_MAX; пустая — нет команды
export const cleanCmd = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, CHECK_MAX)

function restore(raw) {
  const pick = (obj) => {
    const out = {}
    if (!obj || typeof obj !== 'object') return out
    for (const [id, cmd] of Object.entries(obj).slice(-KEEP)) {
      const c = typeof cmd === 'string' ? cleanCmd(cmd) : ''
      if (ID.test(id) && c) out[id] = c
    }
    return out
  }
  return { boards: pick(raw?.boards), cards: pick(raw?.cards) }
}

// Команды — из $.store: при старте сессии и перед каждой проверкой (другая сессия могла поменять)
export async function loadChecks($) {
  const saved = restore(await $.store.get(KEY).catch(() => null))
  S.qc.boards = saved.boards
  S.qc.cards = saved.cards
}

// Команда проверки доски (kind 'boards') или карточки ('cards'); пустая — убрать. Поверх свежего из $.store; команды
// удалённых страниц — прочь
export async function setCheck($, kind, id, value) {
  await loadChecks($)
  const cmd = cleanCmd(value)
  const list = { ...S.qc[kind] }
  if (cmd) list[id] = cmd
  else delete list[id]
  S.qc[kind] = list
  const alive = new Set(S.notes.map((p) => p.id))
  const keep = (obj) => Object.fromEntries(Object.entries(obj).filter(([x]) => alive.has(x)))
  S.qc.boards = keep(S.qc.boards)
  S.qc.cards = keep(S.qc.cards)
  $.ui.invalidate('ui.render')
  await $.store.set(KEY, { boards: S.qc.boards, cards: S.qc.cards }).catch(modError)
  log(`проверка между карточками: ${kind === 'boards' ? 'доски' : 'карточки'} ${id} — ${cmd ? 'задана' : 'убрана'}`)
  return cmd
}

// Какая команда проверит карточку: своя или доски
export const cmdFor = (card) => (card ? S.qc.cards[card.id] || S.qc.boards[card.parent] || '' : '')

// Пометка «проверка не прошла» — первой строкой текста карточки, на любом из языков Arcade (её могли поставить при
// другом языке)
const MARKS = [...new Set(LANGS.map((l) => tr(FAIL, l)))]
const isMark = (line) => line.startsWith('⚠ ') && MARKS.some((m) => line.slice(2).startsWith(m))
export const hasMark = (body) => isMark(String(body ?? '').split('\n')[0])
function unmark(body) {
  const lines = String(body ?? '').split('\n')
  if (!isMark(lines[0])) return body
  lines.shift()
  if (lines[0] === '') lines.shift()
  return lines.join('\n')
}
const marked = (body, line) => {
  const rest = unmark(body)
  return (rest ? `${line}\n\n${rest}` : line).slice(0, MAX_BODY)
}

// Вывод команды — хвостом: без цветовых кодов терминала, последние строки
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g
export function tailOf(out) {
  const text = [out?.stdout, out?.stderr]
    .map((s) => String(s ?? '').replace(ANSI, '').split(/\r?\n/).map((l) => l.split('\r').at(-1).trimEnd()).join('\n').trim())
    .filter(Boolean)
    .join('\n')
  const tail = text.split('\n').slice(-TAIL_LINES).join('\n')
  return tail.length > TAIL_CHARS ? `…${tail.slice(-TAIL_CHARS)}` : tail
}

// Запустить команду в папке сессии: без оболочки команды не разобрать, а саму команду — переменной окружения, чтобы её
// кавычки не ломали строку запуска cmd.exe. { ok, code, tail }; code: число, 'time' — время вышло, 'start' — не запустилась
async function runCheck($, cmd) {
  const windows = S.platform ? S.platform === 'windows' : (await $.env.get('OS').catch(() => '')) === 'Windows_NT'
  const argv = windows ? ['cmd.exe', '/d', '/c', '%ARCADE_CHECK%'] : ['sh', '-c', 'eval "$ARCADE_CHECK"']
  try {
    const out = await $.process.run(argv, { env: { ARCADE_CHECK: cmd }, timeoutMs: CHECK_MS })
    return { ok: out.exitCode === 0, code: out.exitCode, tail: tailOf(out) }
  } catch (err) {
    const text = String(err?.message ?? err)
    return { ok: false, code: /time/i.test(text) ? 'time' : 'start', tail: text.slice(0, 500) }
  }
}

export const codeText = (code) => (code === 'time' ? t('время вышло') : code === 'start' ? t('команда не запустилась') : `${t('код')} ${code}`)

// Снять пометку «проверка не прошла» с карточки id
async function clearMark($, id) {
  S.qc.mine.delete(id)
  await editNotes($, (list, when) => {
    const now = list.find((p) => p.id === id)
    return now && hasMark(now.body) ? updatePage(list, id, { body: unmark(now.body) }, when) : list
  })
}

// Проверить карточку id: прошла (или проверять нечем) — null; не прошла — карточка во второй колонке с пометкой, а
// ответ — { title, code, col, text }: text — для Claude. Очередь остановили, пока шла проверка, — пометка всё равно
export async function checkCard($, id) {
  await loadChecks($)
  const card = S.notes.find((p) => p.id === id)
  const board = card?.parent ? S.notes.find((p) => p.id === card.parent && isBoard(p)) : null
  const cmd = cmdFor(card)
  if (!card || !board) return null
  // Команду убрали, а пометка осталась с прошлого раза — проверять нечем, значит, и не провалено
  if (!cmd) {
    if (hasMark(card.body)) await clearMark($, id)
    return null
  }
  S.qc.running = { board: board.id, card: id, title: card.title, cmd }
  $.ui.invalidate('ui.render')
  log(`проверка между карточками: «${card.title}» — ${cmd}`)
  const res = await runCheck($, cmd)
  S.qc.running = null
  const at = await $.clock.now()
  S.qc.last[board.id] = { card: id, title: card.title, cmd, ...res, at }
  log(`проверка между карточками: «${card.title}» — ${res.ok ? 'прошла' : `не прошла (${res.code})`}`)
  await logCheck($, { at, kind: 'check', id, title: card.title, board: board.title, ok: res.ok, code: typeof res.code === 'number' ? res.code : -1, cmd, tail: res.tail.split('\n').slice(-5).join('\n').slice(-400) })
  const cols = board.board.cols
  if (res.ok) {
    await clearMark($, id)
    nb.note = ''
    nb.bad = false
    $.ui.invalidate('ui.render')
    return null
  }
  // Не прошла: во вторую колонку («В работе»; в доске из двух колонок — в первую) и пометка первой строкой
  const back = cols.length > 2 ? cols[1] : cols[0]
  const line = `⚠ ${t(FAIL)} — ${codeText(res.code)}, ${hhmm(at)}`
  await editNotes($, (list, when) => {
    const now = list.find((p) => p.id === id)
    if (!now) return list
    const moved = columnOf(now, cols) === cols.at(-1).id ? moveCard(list, id, { col: back.id }, when) : list
    return updatePage(moved, id, { body: marked(now.body, line) }, when)
  })
  S.qc.mine.add(id)
  holdCard(id)
  nb.note = ''
  nb.bad = false
  $.ui.invalidate('ui.render')
  const last = cols.at(-1)
  const fence = res.tail.includes('```') ? '~~~' : '```'
  const text = [
    `${t('Проверка между карточками не прошла')}: ${t('карточка')} «${card.title}» (id ${id}) ${t('на доске')} «${board.title}».`,
    `${t('Команда')}: ${cmd}`,
    `${t('Итог')}: ${codeText(res.code)}.`,
    '',
    `${t('Конец вывода')}:`,
    fence,
    res.tail || t('(вывода нет)'),
    fence,
    '',
    `${t('Карточка вернулась в колонку')} «${colName(back)}». ${t('Исправь, что сломалось, и снова перенеси карточку в колонку')} «${colName(last)}» (${t('колонка')} ${last.id}) ${t('действием move инструмента mcp__arcade__notes.')} ${t('Команду можно запустить и самому — как обычно, с разрешения. Очередь продолжит человек, когда запустит её снова: Arcade сначала проверит эту карточку.')}`,
  ].join('\n')
  return { title: card.title, code: res.code, col: colName(back), text }
}

// ━━━━━━━━━━ app/queue ━━━━━━━━━━
// Arcade: очередь карточек доски для Claude. Claude получает карточку первой колонки, а когда закончит ход и карточка
// уже в последней колонке — следующую. Задал вопрос, ход прервали или кончился ошибкой, карточка не доделана,
// Claude получил другую просьбу — очередь встаёт: решает человек. Запрос разрешения очередь не останавливает: пока
// человек не ответит, ход не кончится, а одобрили (человек или авто-режим) и карточка в последней колонке — можно
// дальше. Отказали — карточка обычно не доделана, и очередь встанет в конце хода. Очередь одной доски может идти в
// нескольких сессиях Claude Code: каждая свободная берёт следующую карточку, и две сессии одну карточку не получат
// (app/agents, takeCard). Кончился лимит Claude — очередь встаёт и может сама продолжиться после его сброса: с той же,
// недоделанной карточки (app/usage — откуда известно про лимит).

export const QUEUE_MAX = 10 // карточек за один запуск очереди, не больше: дальше — снова кнопкой
// Очередь сейчас: board — id доски, card — карточка у Claude, given — какие уже отданы, sent — карточка ушла, а её ход
// ещё не начался, turn — ход Claude с этой карточкой, started — когда запущена, of — сколько карточек будет в этом
// запуске (для «карточка 3 из 10»), joined — с какой сессией эта присоединилась (заметка после первой карточки), check —
// какие карточки проверить командой доски, прежде чем дать следующую (app/check)
S.queue = null
// «Остановить везде»: в $.store под этим ключом — { [id доски]: когда }; очередь, запущенная раньше, встаёт
const STOP_KEY = 'queueStop'
const STOP_KEEP_MS = 24 * 3_600_000 // старые остановки — не храним
// Очередь после сброса лимита. В $.store: RESUME_KEY — [{ sid, board, title, card, at }], очереди, которые ждут сброса
// (чтобы после перезапуска мода ждать дальше, а очередь закрытой сессии — назвать незапустившейся); ARMED_KEY — id
// досок, где очередь продолжается после сброса сама, без кнопки
const RESUME_KEY = 'queueResume'
const ARMED_KEY = 'queueArmed'
export const RESUME_AFTER_MS = 60_000 // после сброса лимита — ещё столько: счётчик успеет обнулиться
const RESUME_LATE_MS = 30 * 60_000 // сессия открылась, а время продолжить прошло давно — её закрывали: не продолжаем
const LATE_LIMIT_MS = 60_000 // очередь встала с ошибкой, а замер в течение столького показал кончившийся лимит — это он
export const ORPHANS_AFTER_MS = AGENT_TTL_MS + 5_000 // после старта — столько ждать, прежде чем звать чужую сессию закрытой
export const USAGE_POLL_MS = 30_000 // замер Claude Code спрашиваем сами раз во столько — и после каждого хода
// wait — очередь этой сессии ждёт сброса: { board, title, card, at } (at — когда продолжить); offer — то же, но пока
// предложение кнопкой; armed — доски, где без кнопки; missed — очереди, что не запустились: [{ board, title }]; err —
// последняя остановка с ошибкой (вдруг это лимит, а замер придёт чуть позже); sid — под каким id записано ожидание
S.qr = { wait: null, offer: null, armed: [], missed: [], err: null, sid: '', going: false, tick: 0, awake: 0, orphansAt: 0 }

// Свободные карточки — в первой колонке, которые очередь ещё не давала, которые не взял кто-то другой и которые не
// делает и не заявила другая сессия (others — их отметки); первая из них — следующая
function freeCards(board, others) {
  const busy = new Set(others.flatMap((r) => [r.card?.id, r.claim?.card]).filter(Boolean))
  const cards = columnCards(S.notes, board, board.board.cols[0].id)
  return cards.filter((p) => {
    if (S.queue.given.includes(p.id) || busy.has(p.id)) return false
    const { me, taken } = cardTaker(p)
    return !taken || taken === me
  })
}

// Карточка, которую Claude не доделал, когда кончился лимит, — после сброса её первой (она уже может быть во второй
// колонке). Сделана, удалена или у другой сессии — нет
function again(board, others) {
  const id = S.queue.retry
  const page = id ? S.notes.find((p) => p.id === id && p.parent === board.id) : null
  if (!page || columnOf(page, board.board.cols) === board.board.cols.at(-1).id) return ''
  if (others.some((r) => r.card?.id === id || r.claim?.card === id)) return ''
  const { me, taken } = cardTaker(page)
  return !taken || taken === me ? id : ''
}

// Остановить очередь: why — уже переведённое объяснение на экран доски и во всплывашку. Всегда false: дальше — ничего
export function stopQueue($, why, bad = true) {
  if (!S.queue) return false
  S.queue = null
  S.dk.note = why
  S.dk.bad = bad
  log(`очередь Claude: ${why}`)
  $.ui.toast(why)
  $.ui.invalidate('ui.render')
  return false
}

// Отдать Claude следующую карточку; нечего отдавать — очередь пройдена
async function giveNext($) {
  const queue = S.queue
  const board = S.notes.find((p) => p.id === queue.board && isBoard(p))
  if (!board) return stopQueue($, t('Очередь остановлена: доску удалили.'))
  if (queue.given.length >= QUEUE_MAX) return stopQueue($, `${t('Очередь пройдена: Claude сделал карточек')} — ${queue.given.length}. ${t('Запусти её снова, чтобы продолжить.')}`, false)
  if (await stoppedEverywhere($, queue)) return stopQueue($, t('Очередь остановили во всех сессиях. Claude доделает текущую карточку, следующую не получит.'), false)
  for (;;) {
    // Карточку заявляем так, чтобы её не взяла другая сессия; отметок нет (нет домашней папки) — очередь одна, как раньше.
    // Перед каждым выбором блокнот — свежий: карточку, которую другая сессия уже перенесла в последнюю колонку, не взять
    let seen = []
    const pick = (others) => {
      seen = others
      return again(board, others) || (freeCards(board, others)[0]?.id ?? '')
    }
    const id = await takeCard($, pick, () => refreshNotes($).catch(() => {}))
    if (S.queue !== queue) return
    if (id === null) return stopQueue($, t('Очередь остановлена: не получилось занять карточку так, чтобы её не взяла другая сессия. Запусти очередь снова.'))
    const card = S.notes.find((p) => p.id === (id === 'off' ? pick([]) : id))
    if (!card) break
    queue.retry = ''
    queue.card = card.id
    queue.given.push(card.id)
    // Ход начинается раньше, чем submit ответит: отметка — заранее
    queue.sent = true
    queue.of = Math.min(QUEUE_MAX, queue.given.length + freeCards(board, seen).length)
    const sent = await sendNote($, card.id, true)
    if (S.queue !== queue) return
    if (sent === 'taken') {
      dropCard()
      continue
    }
    nb.note = ''
    nb.bad = false
    if (!sent) dropCard()
    if (!sent) return stopQueue($, `${t('Очередь остановлена: не получилось отдать карточку')} «${card.title}». ${t('Если она в поле ввода — отправь её сам.')}`)
    // Отданная карточка — во вторую колонку («В работе»), если в доске их больше двух
    const cols = board.board.cols
    if (cols.length > 2) {
      const doing = cols[1].id
      await editNotes($, (list, at) => {
        const now = list.find((p) => p.id === card.id)
        return now && columnOf(now, cols) === cols[0].id ? moveCard(list, card.id, { col: doing }, at) : list
      })
      nb.note = ''
      nb.bad = false
    }
    // Присоединилась к очереди другой сессии — так и сказать, когда пошла первая карточка
    S.dk.note = queue.joined ? fill(t('Очередь на этой доске уже идёт в сессии «{0}». Эта сессия тоже будет брать карточки.'), [queue.joined]) : ''
    S.dk.bad = false
    queue.joined = ''
    $.ui.invalidate('ui.render')
    return
  }
  const first = colName(board.board.cols[0])
  stopQueue($, queue.given.length ? `${t('Очередь пройдена: в колонке')} «${first}» ${t('карточек больше нет.')}` : `${t('В колонке')} «${first}» ${t('нет карточек для Claude.')}`, !queue.given.length)
}

// Запустить очередь на доске id — кнопкой «Очередь для Claude» или сама после сброса лимита (auto): тогда retry —
// карточка, которую Claude не доделал, а о той же папке уже предупреждали, когда очередь запускали
export async function startQueue($, id, { retry = '', auto = false } = {}) {
  const say = (text) => {
    S.dk.note = text
    S.dk.bad = true
    $.ui.invalidate('ui.render')
  }
  if (S.queue) {
    const other = S.notes.find((p) => p.id === S.queue.board)
    return say(`${t('Очередь уже идёт на доске')} «${other?.title ?? ''}». ${t('Останови её там, чтобы начать здесь.')}`)
  }
  if (S.status === 'working' || S.status === 'permission' || S.status === 'background') return say(t('Claude занят — запусти очередь, когда он закончит ход.'))
  if (S.qc.running) return say(t('Идёт проверка между карточками — запусти очередь, когда она кончится.'))
  if (!(await editNotes($, (list) => list))) return
  nb.note = ''
  if (!S.notes.some((p) => p.id === id && isBoard(p))) return
  // Очередь на этой доске уже идёт в других сессиях — эта присоединяется. Сессия в той же папке может править те же
  // файлы — присоединить только по второму нажатию
  const mates = await queueMates($, id)
  const same = mates.find((r) => samePath(r.path, S.ag?.path))
  if (same && !auto && S.ag.joinWarn !== id) {
    S.ag.joinWarn = id
    return say(`${fill(t('Эта сессия в той же папке, что «{0}»: две сессии могут править одни и те же файлы. Надёжнее — отдельная папка или git worktree.'), [same.name])} ${t('Нажми «Очередь для Claude» ещё раз, чтобы всё равно присоединиться.')}`)
  }
  if (S.ag) S.ag.joinWarn = ''
  if (S.queue) return
  // Запустили сами — предложение продолжить после сброса уже ни к чему, а ожидание этой доски — тем более
  S.qr.offer = null
  S.qr.err = null
  if (!auto && S.qr.wait?.board === id) await cancelWait($, false)
  // Карточки, чья проверка не прошла, а Claude их уже снова перенёс в последнюю колонку, — сначала проверить. Чужие (их
  // проверяет своя сессия, в своей папке) — нет: свои помним с этой сессии, а одна на доске — любые с пометкой
  const board = S.notes.find((p) => p.id === id)
  const last = board.board.cols.at(-1).id
  const check = S.notes.filter((p) => p.parent === id && columnOf(p, board.board.cols) === last && hasMark(p.body) && (S.qc.mine.has(p.id) || !mates.length)).map((p) => p.id)
  S.queue = { board: id, card: '', given: [], sent: false, turn: '', started: await $.clock.now(), of: 0, joined: mates[0]?.name ?? '', retry, check }
  await queueNext($)
}

// ——— Лимит Claude кончился ———

const boardTitle = (id) => S.notes.find((p) => p.id === id)?.title ?? ''

// Очередь встала, потому что кончился лимит. w — { board, title, card }; reset — когда сбросится (0 — неизвестно).
// Доска из «продолжать после сброса» — ждём сами, иначе — предложение кнопкой на доске. Возвращает текст остановки
async function limitNote($, w, reset) {
  const now = await $.clock.now()
  const when = resetText(reset, now)
  let why = `${t('Очередь остановлена: кончился лимит Claude')}${when ? ` — ${when}` : ''}.`
  if (reset > now) {
    const planned = { board: w.board, title: w.title, card: w.card, at: reset + RESUME_AFTER_MS }
    if (S.qr.armed.includes(w.board)) {
      await waitFor($, planned)
      why += ` ${fill(t('Очередь продолжится в {0}.'), [clockText(planned.at, now)])}`
    } else S.qr.offer = planned
  }
  return why
}

// Ход с карточкой очереди кончился ошибкой API: кончился лимит — остановить с временем сброса и предложить продолжить.
// true — это лимит (очередь уже стоит)
async function limitStop($, queue) {
  const w = { board: queue.board, title: boardTitle(queue.board), card: queue.card }
  const hit = await limitHit($)
  if (S.queue !== queue) return true
  if (hit) {
    stopQueue($, await limitNote($, w, hit.reset))
    return true
  }
  // Замер мог ещё не прийти — если придёт вскоре и покажет кончившийся лимит, скажем об этом (limitLate)
  S.qr.err = { ...w, at: await $.clock.now() }
  return false
}

// Замер вскоре после того, как очередь встала с ошибкой, показал кончившийся лимит: уточнить, что это лимит
export async function limitLate($) {
  const err = S.qr.err
  if (!err || S.queue) return
  const now = await $.clock.now()
  if (now - err.at > LATE_LIMIT_MS) {
    S.qr.err = null
    return
  }
  const w = spentWindow(S.us.me?.limits, now)
  if (!w) return
  S.qr.err = null
  const why = await limitNote($, err, w.reset)
  S.dk.note = why
  S.dk.bad = true
  log(`очередь Claude: ${why}`)
  $.ui.toast(why)
  $.ui.invalidate('ui.render')
}

// Замер Claude Code — спрашиваем сами, после хода и по таймеру: события замера у Claude Code постарше нет, а хук на
// незнакомое событие не дал бы Arcade загрузиться. Окна лимитов сдвинулись — всплывашка 80 и 90% и «не лимит ли
// остановил очередь»; экран «Лимиты» или «Агенты» открыт — перерисовать
export async function usagePoll($) {
  const before = JSON.stringify(S.us.me?.limits ?? [])
  const api = S.us.api
  const u = await usageNow($)
  if (u && JSON.stringify(u.limits) !== before) {
    await warnCheck($)
    await limitLate($)
  }
  // Перерисовать — и когда Claude Code перестал или снова начал отвечать: экран скажет, что лимитов он не сообщает
  if (!u && api === S.us.api) return
  if (S.paneOpen && S.view === 'library' && (S.menu === 'usage' || S.menu === 'agents' || S.menu === 'today')) $.ui.invalidate('ui.render')
}

// Записи ожиданий из $.store: только целые
const entriesOf = (v) =>
  Array.isArray(v) ? v.filter((x) => x && typeof x.sid === 'string' && x.sid && typeof x.board === 'string' && Number.isFinite(x.at)) : []

// Своё ожидание — в $.store: список общий для всех сессий, перед записью — перечитать. Своё — и под прежним id (после
// /clear id сессии новый)
async function saveWait($) {
  const sid = (await $.session.id().catch(() => '')) || S.qr.sid
  const mine = new Set([sid, S.qr.sid].filter(Boolean))
  const list = entriesOf(await $.store.get(RESUME_KEY).catch(() => null)).filter((x) => !mine.has(x.sid))
  const w = S.qr.wait
  if (w && sid) list.push({ sid, board: w.board, title: w.title, card: w.card, at: w.at })
  S.qr.sid = sid
  await $.store.set(RESUME_KEY, list).catch((err) => log(`очередь после сброса: ${err?.message ?? err}`))
}

// Ждать сброса лимита и продолжить очередь: w — { board, title, card, at }
export async function waitFor($, w) {
  S.qr.wait = w
  S.qr.offer = null
  $.ui.invalidate('ui.render')
  await saveWait($)
}

// «Не продолжать»: ожидание снять; если сброс ещё впереди — снова предложить кнопкой (offer)
export async function cancelWait($, offer = true) {
  const w = S.qr.wait
  if (!w) return
  S.qr.wait = null
  if (offer && (await $.clock.now()) < w.at) S.qr.offer = w
  $.ui.invalidate('ui.render')
  await saveWait($)
}

// Доска id: продолжать её очередь после сброса лимита самой, без кнопки (armed) или нет. Предложение на ней — сразу в ожидание
export async function armBoard($, id, armed) {
  const saved = await $.store.get(ARMED_KEY).catch(() => undefined)
  const list = (Array.isArray(saved) ? saved.filter((x) => typeof x === 'string') : S.qr.armed).filter((x) => x !== id)
  S.qr.armed = (armed ? [...list, id] : list).slice(-64)
  $.ui.invalidate('ui.render')
  await $.store.set(ARMED_KEY, S.qr.armed).catch((err) => log(`очередь после сброса: ${err?.message ?? err}`))
  if (armed && S.qr.offer?.board === id) await waitFor($, S.qr.offer)
}

// Очередь, которая не продолжилась после сброса: сказать всплывашкой и держать заметку в «Лимитах» и на доске
function missedAdd($, w, why) {
  const text = fill(t(why), [w.title || boardTitle(w.board)])
  S.qr.missed = [...S.qr.missed.filter((m) => m.board !== w.board), { board: w.board, text }].slice(-5)
  log(`очередь после сброса: ${text}`)
  $.ui.toast(text)
  $.ui.invalidate('ui.render')
}
export function missedClear($, board) {
  S.qr.missed = board ? S.qr.missed.filter((m) => m.board !== board) : []
  $.ui.invalidate('ui.render')
}

// Старт сессии (и перезагрузка мода): доски «продолжать после сброса» и своё ожидание — из $.store
export async function resumeStart($) {
  const armed = await $.store.get(ARMED_KEY).catch(() => null)
  S.qr.armed = Array.isArray(armed) ? armed.filter((x) => typeof x === 'string') : []
  const sid = await $.session.id().catch(() => '')
  if (!sid) return
  const mine = entriesOf(await $.store.get(RESUME_KEY).catch(() => null)).find((x) => x.sid === sid)
  S.qr.sid = sid
  if (mine && !S.qr.wait) S.qr.wait = { board: mine.board, title: String(mine.title ?? ''), card: String(mine.card ?? ''), at: mine.at }
}

// Ожидания сессий, которых уже нет (закрыли до сброса лимита): их очередь не запустится — сказать здесь. Кто жив — по
// отметкам (app/agents); без отметок не узнать — молчим
async function resumeOrphans($, now) {
  const list = entriesOf(await $.store.get(RESUME_KEY).catch(() => null))
  if (!list.some((x) => now >= x.at)) return
  const others = await readOthers($)
  if (!others) return
  const live = new Set([...others.map((r) => r.sid), S.ag?.sid, S.qr.sid].filter(Boolean))
  const gone = list.filter((x) => now >= x.at && !live.has(x.sid))
  if (!gone.length) return
  const same = (a, b) => a.sid === b.sid && a.at === b.at
  const left = entriesOf(await $.store.get(RESUME_KEY).catch(() => null)).filter((x) => !gone.some((g) => same(g, x)))
  await $.store.set(RESUME_KEY, left).catch((err) => log(`очередь после сброса: ${err?.message ?? err}`))
  for (const g of gone) missedAdd($, g, 'Очередь «{0}» не запустилась после сброса лимита: сессия была закрыта.')
}

// Шаг — вместе с отметками сессий: пришло время — продолжить очередь, если Claude свободен и лимит правда сбросился.
// Сессия была закрыта или компьютер спал дольше RESUME_LATE_MS после сброса — не продолжаем: человек мог давно уйти
export async function resumeTick($) {
  if (S.qr.going) return
  S.qr.going = true
  try {
    const now = await $.clock.now()
    // Шагов долго не было (старт, сон) — отсюда считаем, сколько мы на ногах
    if (now - S.qr.tick > 30_000) S.qr.awake = now
    S.qr.tick = now
    if (now - S.qr.awake >= ORPHANS_AFTER_MS && now - S.qr.orphansAt >= 60_000) {
      S.qr.orphansAt = now
      await resumeOrphans($, now)
    }
    const w = S.qr.wait
    if (!w) return
    // После /clear id сессии новый — ожидание переписать на него, иначе другие сессии сочтут его брошенным
    if (S.ag?.sid && S.ag.sid !== S.qr.sid) await saveWait($)
    if (now < w.at) return
    if (S.qr.awake - w.at > RESUME_LATE_MS) {
      S.qr.wait = null
      await saveWait($)
      return missedAdd($, w, 'Очередь «{0}» не продолжилась после сброса лимита: Claude Code был закрыт или компьютер спал.')
    }
    if (S.queue || S.status === 'working' || S.status === 'permission' || S.status === 'background') return
    // Окно всё ещё кончилось (лимит сдвинулся, сброс другого окна) — ждать до нового сброса
    const u = await usageNow($)
    if (S.qr.wait !== w) return
    const still = spentWindow(u?.limits, now)
    if (still) {
      S.qr.wait = { ...w, at: still.reset ? still.reset + RESUME_AFTER_MS : now + 5 * 60_000 }
      $.ui.invalidate('ui.render')
      return saveWait($)
    }
    S.qr.wait = null
    await saveWait($)
    await refreshNotes($).catch(() => {})
    const title = w.title || boardTitle(w.board)
    if (!S.notes.some((p) => p.id === w.board && isBoard(p))) return missedAdd($, { ...w, title }, 'Очередь «{0}» не продолжилась после сброса лимита: доску удалили.')
    await startQueue($, w.board, { retry: w.card, auto: true })
    if (S.queue?.board === w.board) $.ui.toast(fill(t('Лимит Claude сбросился — очередь «{0}» продолжается.'), [title]))
    else missedAdd($, { ...w, title }, 'Очередь «{0}» не продолжилась после сброса лимита.')
  } catch (err) {
    log(`очередь после сброса: ${err?.message ?? err}`)
  } finally {
    S.qr.going = false
  }
}

// «Остановить везде»: эта сессия и все другие с очередью на доске id доделывают текущие карточки и новых не берут
export async function stopEverywhere($, id) {
  const now = await $.clock.now()
  const old = await $.store.get(STOP_KEY).catch(() => null)
  const stops = Object.fromEntries(Object.entries(old && typeof old === 'object' ? old : {}).filter(([, at]) => now - Number(at) < STOP_KEEP_MS))
  stops[id] = now
  await $.store.set(STOP_KEY, stops)
  const why = t('Очередь остановлена во всех сессиях: каждая доделает текущую карточку, новую не возьмёт.')
  if (S.queue?.board === id) return stopQueue($, why, false)
  S.dk.note = why
  S.dk.bad = false
  $.ui.toast(why)
  $.ui.invalidate('ui.render')
}

// Очередь этой сессии остановили во всех сессиях после её запуска
async function stoppedEverywhere($, queue) {
  const stops = await $.store.get(STOP_KEY).catch(() => null)
  return Boolean(stops && typeof stops === 'object' && Number(stops[queue.board]) > queue.started)
}

// Таймером, пока идёт очередь: её остановили в другой сессии — встать, текущую карточку Claude доделает
export async function queueStopCheck($) {
  const queue = S.queue
  if (!queue || !(await stoppedEverywhere($, queue)) || S.queue !== queue) return
  stopQueue($, t('Очередь остановили во всех сессиях. Claude доделает текущую карточку, следующую не получит.'), false)
}

// Следующая карточка очереди: после старта — сразу, после хода Claude — таймером, новым ходом (не изнутри конца прошлого)
export async function queueNext($) {
  const queue = S.queue
  if (!queue) return
  await (async () => {
    if (await checksFail($, queue)) return
    await giveNext($)
  })().catch((err) => {
    modError(err)
    stopQueue($, t('Очередь остановлена: ошибка Arcade.'))
  })
}

// Проверка между карточками: true — дальше нельзя (не прошла или очередь остановили, пока шла). Не прошла — очередь
// встаёт, а Claude получает вывод
async function checksFail($, queue) {
  while (queue.check?.length) {
    const fail = await checkCard($, queue.check.shift())
    if (S.queue !== queue) return true
    if (!fail) continue
    stopQueue($, fill(t('Проверка после «{0}» не прошла — {1}. Карточка вернулась в «{2}», вывод ушёл Claude: он исправит и перенесёт её снова, а очередь продолжится, когда ты её запустишь.'), [fail.title, codeText(fail.code), fail.col]))
    const sent = await giveClaude($, fail.text, 'check')
    if (!sent && nb.note) S.dk.note = `${S.dk.note} ${t(nb.note)}`
    nb.note = ''
    nb.bad = false
    $.ui.invalidate('ui.render')
    return true
  }
  return S.queue !== queue
}

// Кнопка «Остановить очередь»: текущую карточку Claude доделает, следующую не получит
export function endQueue($) {
  const others = S.queue ? boardMates(S.queue.board).length : 0
  stopQueue($, `${t('Очередь остановлена. Claude доделает текущую карточку, следующую не получит.')}${others ? ` ${t('В других сессиях она идёт дальше.')}` : ''}`, false)
}

// Начался ход Claude. Ход с карточкой очереди — её; продолжение без текста и ход, где Claude по просьбе Arcade открывает
// игру и работает дальше, — тоже её. wake — ход по уведомлению о фоновой задаче (кончился агент в фоне): та же работа,
// очередь не встаёт. Любой другой — человек попросил о своём: очередь встаёт
export function queueTurnStart($, e, wake = false) {
  const queue = S.queue
  if (!queue) return
  const text = e.text ?? ''
  if (queue.sent && text.includes(`(id ${queue.card})`)) {
    queue.sent = false
    queue.turn = e.turnId
    return
  }
  if (wake) {
    if (!queue.sent) queue.turn = e.turnId
    return
  }
  if (!queue.sent && (!text.trim() || S.asking)) {
    queue.turn = e.turnId
    return
  }
  stopQueue($, t('Очередь остановлена: Claude получил другую просьбу.'))
}

// Claude задал вопрос — решает человек: дальше очередь не идёт. Запрос разрешения сюда не приходит: в авто-режиме его
// часто решает классификатор, а «ждёт разрешения» мод может показать и зря — что дальше, решает конец хода
export function queueQuestion($) {
  if (!S.queue) return
  stopQueue($, t('Очередь остановлена: Claude задал вопрос. Ответь ему и запусти очередь снова.'))
}

// Ход Claude кончился — из turn.complete. Карточка очереди в последней колонке — true: следующую даст queueNext;
// нет — очередь встаёт
export async function queueTurnDone($, e) {
  const queue = S.queue
  if (!queue || queue.sent || e.turnId !== queue.turn) return false
  if (e.isAborted || e.reason === 'aborted') return stopQueue($, t('Очередь остановлена: ход Claude прервали.'))
  // Ошибка API — это может быть кончившийся лимит: тогда — когда он сбросится и как продолжить
  if (e.reason === 'error' && (await limitStop($, queue))) return false
  if (S.queue !== queue) return false
  if (e.reason !== 'answer') return stopQueue($, t('Очередь остановлена: Claude не закончил ход — ошибка или отказ.'))
  // Свежий блокнот, а в нём — правки Claude за этот ход: перенос карточки могла затереть запись другой сессии
  await checkNotes($)
  if (S.queue !== queue) return false
  const card = S.notes.find((p) => p.id === queue.card)
  const board = S.notes.find((p) => p.id === queue.board && isBoard(p))
  if (!board) return stopQueue($, t('Очередь остановлена: доску удалили.'))
  const last = board.board.cols.at(-1)
  if (!card || columnOf(card, board.board.cols) !== last.id) {
    const title = card?.title ?? ''
    return stopQueue($, `${t('Очередь стоит: Claude закончил ход, а карточка')} «${title}» ${t('не в колонке')} «${colName(last)}». ${t('Посмотри, что он ответил.')}`)
  }
  // Карточка сделана — перед следующей её проверит команда доски, если она есть (queueNext)
  queue.check = [card.id]
  return true
}

// ━━━━━━━━━━ app/schedule ━━━━━━━━━━
// Arcade: задания по расписанию — «Дать Claude» у события календаря. В своё время событие даёт Claude очередь доски,
// одну карточку, шаблон из «Промптов» или свой текст — в открытой сессии той папки, где задание дали, и только в одной.
// Claude занят — задание ждёт конца хода. Ни одной сессии этой папки не было — «Пропущено» с «Запустить сейчас»: задним
// числом само не идёт. Задание уходит обычным сообщением в режиме разрешений сессии: новых прав Arcade не даёт.
// Пропущенное говорит о себе сразу: в срок сессии его папки не было — любая запущенная сессия с Arcade показывает
// системное уведомление (одна, как напоминания). Само задание в чужой папке не идёт: там другой контекст и другие права

// Календарь из хранилища — раз в READ_MS: задание могли дать в другой сессии этой папки
const READ_MS = 30_000
// После отданного задания — пауза: ход начнётся чуть позже, чем submit ответит, а второе задание в ту же секунду не нужно
const GAP_MS = 15_000

// going — шаг идёт; read — когда календарь последний раз перечитали; gap — до каких пор не отдавать новое задание
S.sc = { going: false, read: 0, gap: 0 }

// Задание этой сессии: дано в её папке (или без папки — тогда в любой)
const mine = (ev) => Boolean(ev.give) && (!ev.cwd || samePath(ev.cwd, S.ag?.path))
const scheduleBusy = (now) => Boolean(S.queue) || S.status === 'working' || S.status === 'permission' || S.status === 'background' || now < S.sc.gap
// Задание другой папки, которое в свой срок никто не взял: прошло больше LATE_MS (сессия той папки взяла бы его сразу
// или отметила held, если Claude занят), но не больше MISSED_MS, и о нём ещё не сказали
const folder = (p) => String(p ?? '').split(/[\\/]+/).filter(Boolean).pop() || p
function lostTasks(list, now) {
  if (!S.ag?.path) return []
  const others = list.filter((e) => e.give && e.cwd && !samePath(e.cwd, S.ag.path))
  return dueTasks(others, now).filter((x) => {
    const ev = list.find((e) => e.id === x.id)
    return now - x.at > LATE_MS && now - x.at <= MISSED_MS && ev.held !== x.at && ev.warned !== x.at
  })
}

// Шаг — вместе с отметками сессий и «Очередью после сброса лимита» (resumeTick: тот же S.qr.awake — с каких пор сессия
// на ногах). Пришло время задания — взять его: отметка своей сессией, через CLAIM_MS перечитать — запускает та, чья
// отметка осталась (как напоминания)
export async function scheduleTick($) {
  if (S.sc.going) return
  S.sc.going = true
  try {
    const now = await $.clock.now()
    if (now - S.sc.read >= READ_MS) {
      S.sc.read = now
      await refreshCalendar($)
    }
    if (lostTasks(S.calendar, now).length) await warnLost($, now)
    if (!dueTasks(S.calendar.filter(mine), now).length) return
    const taken = await calFresh($, async () => {
      const before = S.calendar
      let list = before
      let dueNow = null
      const missed = []
      for (const x of dueTasks(list.filter(mine), now)) {
        const ev = list.find((e) => e.id === x.id)
        // Давно прошедшее — молча: о нём уже не скажешь ничего полезного
        if (now - x.at > MISSED_MS) {
          list = markTask(list, x.id, { fired: x.at, firedBy: undefined, held: undefined, missed: undefined })
          continue
        }
        // Вовремя: сессия была на ногах, когда пришло время, или задание уже ждало конца хода (held), или опоздали
        // меньше чем на LATE_MS (сессию открыли в ту же минуту)
        const onTime = ev.held === x.at || S.qr.awake <= x.at || now - x.at <= LATE_MS
        if (!onTime) {
          list = markTask(list, x.id, { fired: x.at, firedBy: me, held: undefined, missed: x.at })
          missed.push(x)
          continue
        }
        if (scheduleBusy(now) || dueNow) {
          if (ev.held !== x.at) list = markTask(list, x.id, { held: x.at })
          continue
        }
        dueNow = x
        list = markTask(list, x.id, { fired: x.at, firedBy: me, held: undefined, missed: undefined })
      }
      if (list !== before) await calendarChanged($, list)
      return [dueNow, ...missed].filter(Boolean)
    })
    if (!taken.length) return
    await new Promise((done) => $.clock.after(CAL_CLAIM_MS, done))
    const ours = await calFresh($, async () => taken.filter((x) => S.calendar.some((e) => e.id === x.id && e.firedBy === me && e.fired === x.at)))
    // x — раз события до отметки, missed у него прежний: пропущенный — тот, что в календаре сейчас помечен missed
    const missedNow = ours.filter((x) => S.calendar.some((e) => e.id === x.id && e.missed === x.at))
    const toRun = ours.find((x) => !missedNow.includes(x))
    // Всплывашка — всегда (человек тут, в этой сессии); системное уведомление — если о пропуске ещё не сказала сессия
    // другой папки
    const loud = []
    for (const x of missedNow) {
      const text = fill(t('Пропущено по расписанию: «{0}» — Claude Code был закрыт или компьютер спал. Запустить можно в календаре Arcade.'), [x.title])
      log(`по расписанию: ${text}`)
      $.ui.toast(text)
      if (!S.calendar.some((e) => e.id === x.id && e.warned === x.at)) loud.push(text)
    }
    if (loud.length) notifyOs($, loud.join('\n'))
    if (!toRun) return
    // Пока брали, Claude мог занять ход — тогда задание снова ждёт его конца
    if (scheduleBusy(await $.clock.now())) {
      await calFresh($, async () => calendarChanged($, markTask(S.calendar, toRun.id, { fired: toRun.at - 1, firedBy: undefined, held: toRun.at })))
      return
    }
    await runTask($, toRun)
  } catch (err) {
    log(`по расписанию: ${err?.message ?? err}`)
  } finally {
    S.sc.going = false
  }
}

// Сказать о заданиях других папок, которые в срок никто не взял: отметка своей сессией, через CLAIM_MS перечитать —
// говорит та, чья отметка осталась. Сессия той папки, когда её запустят, сама отметит пропущенное с «Запустить сейчас»
async function warnLost($, now) {
  const marked = await calFresh($, async () => {
    const lost = lostTasks(S.calendar, now)
    if (!lost.length) return []
    let list = S.calendar
    for (const x of lost) list = markTask(list, x.id, { warned: x.at, warnedBy: me })
    await calendarChanged($, list)
    return lost
  })
  if (!marked.length) return
  await new Promise((done) => $.clock.after(CAL_CLAIM_MS, done))
  const ours = await calFresh($, async () => marked.filter((x) => S.calendar.some((e) => e.id === x.id && e.warned === x.at && e.warnedBy === me)))
  if (!ours.length) return
  const lines = ours.map((x) =>
    fill(t('Пропущено по расписанию: «{0}» — в папке {1} не было запущенной сессии Claude Code. Открой сессию этой папки и нажми «Запустить сейчас» в календаре Arcade.'), [x.title, folder(x.cwd)]),
  )
  for (const text of lines) {
    log(`по расписанию: ${text}`)
    $.ui.toast(text)
  }
  notifyOs($, lines.join('\n'))
}

// Отдать задание Claude и сказать, как вышло: '' — ушло, иначе — почему нет
async function runTask($, ev) {
  S.sc.gap = (await $.clock.now()) + GAP_MS
  const why = await giveTask($, ev.give).catch((err) => {
    log(`по расписанию: ${err?.message ?? err}`)
    return t('ошибка мода')
  })
  const text = why ? fill(t('По расписанию: «{0}» — задание не ушло: {1}.'), [ev.title, why]) : fill(t('По расписанию: «{0}» — ушло Claude.'), [ev.title])
  log(text)
  $.ui.toast(text)
  $.ui.invalidate('ui.render')
  return !why
}

async function giveTask($, g) {
  // Цель смотрим в свежем блокноте: её могли поправить или удалить в другой сессии
  await editNotes($, (list) => list)
  if (g.kind === 'queue') {
    const board = S.notes.find((p) => p.id === g.board && isProjectBoard(p))
    if (!board) return t('доски больше нет')
    await startQueue($, board.id, { auto: true })
    if (S.queue?.board === board.id) return ''
    return (S.dk.note || t('очередь не запустилась')).replace(/[.\s]+$/, '')
  }
  if (g.kind === 'card') {
    const page = S.notes.find((p) => p.id === g.card && S.notes.some((b) => b.id === p.parent && isProjectBoard(b)))
    if (!page) return t('карточки больше нет')
    const sent = await sendNote($, page.id, false, true)
    if (sent === 'taken') return t('карточку уже взял другой')
    return sent ? '' : t('Claude был занят — карточка ждёт в поле ввода')
  }
  if (g.kind === 'prompt') {
    const page = S.notes.find((p) => p.id === g.prompt && S.notes.some((b) => b.id === p.parent && isPrompts(b)))
    if (!page) return t('шаблона больше нет')
    const text = (page.body ?? '').trim()
    if (!text) return t('в шаблоне нет текста')
    return (await giveClaude($, text, 'prompt')) ? '' : t('Claude был занят — шаблон ждёт в поле ввода')
  }
  return (await giveClaude($, g.text, 'ask')) ? '' : t('Claude был занят — текст ждёт в поле ввода')
}

// Пропущенные задания этой папки — для экрана календаря
export const missedTasks = () => S.calendar.filter((e) => mine(e) && Number.isFinite(e.missed))

// «Запустить сейчас» у пропущенного задания
export async function runMissed($, id) {
  const now = await $.clock.now()
  if (scheduleBusy(now)) {
    cal.note = 'Claude занят — запусти, когда он закончит ход.'
    cal.bad = true
    $.ui.invalidate('ui.render')
    return
  }
  let ev = null
  await calFresh($, async () => {
    const missedEvent = S.calendar.find((x) => x.id === id)
    if (!missedEvent?.give || !Number.isFinite(missedEvent.missed)) return
    ev = missedEvent
    await calendarChanged($, markTask(S.calendar, id, { missed: undefined }))
  })
  if (!ev) return
  const ok = await runTask($, ev)
  cal.note = ok ? 'Задание ушло Claude.' : 'Задание не ушло — что случилось, сказано во всплывашке.'
  cal.bad = !ok
  $.ui.invalidate('ui.render')
}

// «Не запускать»: пропущенное убрать, задание остаётся на следующие разы
export async function dropMissed($, id) {
  await calFresh($, async () => {
    if (!S.calendar.some((x) => x.id === id && Number.isFinite(x.missed))) return
    await calendarChanged($, markTask(S.calendar, id, { missed: undefined }))
  })
  cal.note = 'Пропущенное не запускаем.'
  cal.bad = false
  $.ui.invalidate('ui.render')
}

// ━━━━━━━━━━ app/changes ━━━━━━━━━━
// Arcade: «Что поменялось» во вкладке «Агенты» — ветка git и незакоммиченные файлы каждой сессии. git читает сама
// сессия, в своей папке: при старте и в конце каждого хода Claude — без таймера и без сети. git здесь только читает
// (--no-optional-locks: даже index.lock не пишет); Arcade ничего не коммитит, не откатывает и не прячет в stash.
// Итог уходит в отметку сессии (app/agents) — так его видят «Агенты» других сессий на этом компьютере

export const CHANGES_MAX = 40 // файлов в отметке не больше стольких — остальные только числом
const GIT_MS = 10_000 // столько ждём git: большой репозиторий, медленный диск

// running — git сейчас читается; again — пока читался, кончился ещё ход: прочитать ещё раз; open — у каких сессий
// (sid или 'me') список файлов раскрыт; note, bad — что вышло с «Дать Claude: проверить изменения»
S.chg = { running: false, again: false, open: new Set(), note: '', bad: false }

// Путь — прямыми слешами, без слеша в конце. Абсолютный ли он: /…, C:/… или //сервер/…
const slashes = (p) => String(p ?? '').trim().replace(/\\/g, '/').replace(/\/+$/, '')
const isAbsolute = (p) => /^(\/|[A-Za-z]:\/)/.test(p)
// Папку, которую git назвал относительно папки сессии (.git, ../.git), — от папки сессии; «.» и «..» — убрать
export function resolveDir(dir, from) {
  const d = slashes(dir)
  const full = isAbsolute(d) ? d : `${slashes(from)}/${d}`
  const out = []
  for (const part of full.split('/')) {
    if (part === '.' || (part === '' && out.length)) continue
    if (part === '..' && out.length > 1) out.pop()
    else out.push(part)
  }
  return out.join('/')
}
// Сравнивать папки разных сессий — без регистра: на Windows и macOS D:/Work и d:/work — одна папка
const key = (p) => slashes(p).toLowerCase()

// Первая строка git status --porcelain -b: «## ветка...origin/ветка [ahead 2, behind 1]», «## HEAD (no branch)», у ветки
// без коммитов — «## No commits yet …ветка» (у старого git — «## Initial commit …ветка»). Эти строки git не переводит
const UNBORN_HEADS = ['No commits yet ', 'Initial commit ']
export function branchOf(head) {
  // За началом строки — предлог и имя ветки: берём второе слово
  const lead = UNBORN_HEADS.find((start) => head.startsWith(start))
  if (lead) return { branch: head.slice(lead.length).split(' ')[1] ?? '', ahead: 0, fresh: true }
  if (head.startsWith('HEAD (no branch)')) return { branch: '', ahead: 0, fresh: false }
  const name = head.split(' ')[0].split('...')[0]
  return { branch: name, ahead: Number(/\[ahead (\d+)/.exec(head)?.[1] ?? 0), fresh: false }
}

// git status --porcelain=v1 -b -z: «XY путь\0»; у переименованных и скопированных за путём — ещё прежний путь. Пути —
// от корня репозитория
export function parseStatus(out) {
  const parts = String(out ?? '').split('\0')
  let head = { branch: '', ahead: 0, fresh: false }
  const files = []
  for (let i = 0; i < parts.length; i++) {
    const ent = parts[i]
    if (!ent) continue
    if (i === 0 && ent.startsWith('## ')) {
      head = branchOf(ent.slice(3))
      continue
    }
    const xy = ent.slice(0, 2)
    if (/[RC]/.test(xy)) i++
    files.push({ path: ent.slice(3), xy })
  }
  return { ...head, files }
}

// git diff --numstat -z HEAD: «добавлено\tудалено\tпуть\0»; у переименованного путь пустой, а за ним — прежний и новый.
// Двоичный файл — «-\t-». Возвращает путь → { add, del } или { bin: true }
export function parseNumstat(out) {
  const parts = String(out ?? '').split('\0')
  const map = new Map()
  for (let i = 0; i < parts.length; i++) {
    const m = /^(-|\d+)\t(-|\d+)\t([\s\S]*)$/.exec(parts[i])
    if (!m) continue
    let path = m[3]
    if (!path) {
      path = parts[i + 2] ?? ''
      i += 2
    }
    map.set(path, m[1] === '-' ? { bin: true } : { add: Number(m[1]), del: Number(m[2]) })
  }
  return map
}

// Что поменялось в папке — для отметки: { branch, ahead, top, repo, files: [{ path, add, del, state }], n, at };
// state — 'new' (git его ещё не знает), 'bin' (двоичный) или ''; add и del — null, если чисел нет. null — не git
async function readChanges($, path) {
  const git = (args) => $.process.run(['git', '--no-optional-locks', '-C', path, ...args], { timeoutMs: GIT_MS })
  const where = await git(['rev-parse', '--show-toplevel', '--git-common-dir'])
  if (where?.exitCode !== 0) return null
  const [top, common] = String(where.stdout ?? '').split(/\r?\n/).map((x) => x.trim())
  if (!top || !common) return null
  const status = await git(['status', '--porcelain=v1', '-b', '-z'])
  if (status?.exitCode !== 0) return null
  const st = parseStatus(status.stdout)
  // Числа строк — от последнего коммита; коммитов ещё нет или git не ответил — без чисел
  let nums = new Map()
  if (st.files.length && !st.fresh) {
    const diff = await git(['diff', '--numstat', '-z', 'HEAD']).catch(() => null)
    if (diff?.exitCode === 0) nums = parseNumstat(diff.stdout)
  }
  const files = st.files.slice(0, CHANGES_MAX).map((f) => {
    const num = nums.get(f.path)
    const state = f.xy === '??' ? 'new' : num?.bin ? 'bin' : ''
    return { path: f.path, add: num && !num.bin ? num.add : null, del: num && !num.bin ? num.del : null, state }
  })
  return { branch: st.branch, ahead: st.ahead, top: key(top), repo: key(resolveDir(common, path)), files, n: st.files.length, at: 0 }
}

// Прочитать, что поменялось в папке этой сессии, — при старте и в конце хода. Поменялось — в отметку (её запишет
// следующий шаг отметок) и, если «Агенты» на экране, перерисовать
export async function changesPoll($) {
  const ag = S.ag
  if (!ag?.on || !ag.path) return
  if (S.chg.running) {
    S.chg.again = true
    return
  }
  S.chg.running = true
  try {
    do {
      S.chg.again = false
      let now = null
      try {
        now = await readChanges($, ag.path)
      } catch (err) {
        // git нет или запускать его не дали — строки нет
        log(`что поменялось: ${err?.message ?? err}`)
      }
      if (S.ag !== ag) return
      const same = (now && ag.changes ? JSON.stringify({ ...now, at: 0 }) === JSON.stringify({ ...ag.changes, at: 0 }) : now === ag.changes)
      if (!same) {
        ag.changes = now ? { ...now, at: await $.clock.now() } : null
        if (S.paneOpen && S.view === 'library' && (S.menu === 'agents' || S.menu === 'today')) $.ui.invalidate('ui.render')
      }
    } while (S.chg.again)
  } finally {
    S.chg.running = false
  }
}

// «Что поменялось» из отметки сессии. Чужая отметка — из файла (и, может, от другой версии Arcade): что на неё не
// похоже, не показываем
export function changesOf(r) {
  const c = r?.changes
  if (!c || typeof c !== 'object' || !Array.isArray(c.files)) return null
  const files = c.files
    .filter((f) => typeof f?.path === 'string' && f.path)
    .slice(0, CHANGES_MAX)
    .map((f) => ({ path: f.path, add: Number.isFinite(f.add) ? f.add : null, del: Number.isFinite(f.del) ? f.del : null, state: f.state === 'new' || f.state === 'bin' ? f.state : '' }))
  const n = Number.isFinite(c.n) ? Math.max(c.n, files.length) : files.length
  const str = (x) => (typeof x === 'string' ? x : '')
  return { branch: str(c.branch), ahead: Number.isFinite(c.ahead) && c.ahead > 0 ? c.ahead : 0, top: str(c.top), repo: str(c.repo), files, n }
}

// Пересечения: какие файлы сессии r правит и другая сессия. Сессии в одной папке — одни и те же изменения: кто что
// правил, не различить. Другая папка того же репозитория (git worktree) — общие файлы. Другой репозиторий — ничего.
// Возвращает { same: [имя сессии], files: [{ path, who: [{ name, me }] }] }
export function overlapsOf(r, all) {
  const c = changesOf(r)
  const out = { same: [], files: [] }
  if (!c?.n || !c.repo) return out
  const mine = new Set(c.files.map((f) => f.path))
  const by = new Map()
  for (const o of all) {
    const oc = changesOf(o)
    if (o === r || (o.sid && o.sid === r.sid) || !oc?.n || oc.repo !== c.repo) continue
    if (oc.top === c.top) {
      out.same.push({ name: o.name, me: Boolean(o.me) })
      continue
    }
    for (const f of oc.files) {
      if (!mine.has(f.path)) continue
      if (!by.has(f.path)) by.set(f.path, [])
      by.get(f.path).push({ name: o.name, me: Boolean(o.me) })
    }
  }
  out.files = [...by.entries()].map(([path, who]) => ({ path, who }))
  return out
}

// Просьба Claude проверить незакоммиченные изменения этой сессии: только посмотреть и рассказать — ничего не менять
export function reviewPrompt() {
  return tr('Проверь незакоммиченные изменения в этой папке: посмотри git status и git diff, и новые файлы тоже. Найди ошибки, забытое и что стоит поправить — и расскажи коротко. Ничего не коммить, не откатывай и не прячь в stash. Если что-то стоит поправить — сначала скажи, что именно.', S.lang)
}

// «Дать Claude: проверить изменения» — у своей сессии. Заметка о том, ушла ли просьба, — под карточками «Агентов»
export async function reviewChanges($) {
  await giveClaude($, reviewPrompt(), 'ask')
  S.chg.note = nb.note
  S.chg.bad = nb.bad
  nb.note = ''
  nb.bad = false
  $.ui.invalidate('ui.render')
}

// ━━━━━━━━━━ app/asks ━━━━━━━━━━
// Arcade: Claude ждёт человека — разрешения на инструмент или ответа на вопрос (AskUserQuestion). Отсюда — статус
// «ждёт разрешения», уведомление, остановка очереди на вопрос и что показать в карточке вкладки «Агенты».
// Классический хук PermissionRequest на Team и Enterprise до мода не доходит: встроенная защита cc-plugin-sec-default
// идёт первой и выключает классические хуки плагинов. Поэтому запрос замечаем и сами: когда Claude вызывает инструмент,
// спрашиваем движок, как он решит ($.tool.check — только вердикт: ничего не запускает и диалога не открывает), а что
// человек ответил, узнаём из телеметрии (tool_decision) или по концу вызова. Решений мод не принимает и не меняет:
// своих хуков tool.check у него нет, телеметрию он отдаёт дальше как есть.
// На вопрос Claude можно ответить из «Агентов» другой сессии: ответ — файл a<место>.json рядом с отметками сессий;
// сессия, которая спросила, читает его, пока вопрос открыт, и отдаёт модели как ответ человека. Разрешения так не даются.

export const ANSWER_POLL_MS = 1_000 // пока вопрос открыт, файл ответа читаем раз в столько
// Сколько ждать, прежде чем «спросить» считать вопросом человеку: в авто-режиме сначала решает классификатор (обычно за
// секунду-две), в остальных режимах диалог показывается сразу. Режим узнаём из телеметрии; пока не знаем — середина
const GRACE_AUTO_MS = 20_000
const GRACE_UNKNOWN_MS = 3_000
const GRACE_MS = 700
// Вопрос Claude — не запрос разрешения: его ловит questionCall
const NOT_ASKS = new Set(['AskUserQuestion'])
const QUESTION_MAX = 300 // текст вопроса в отметке — не длиннее (для показа; ответ строится по полному)

// Чего ждёт Claude: { kind: 'permission', tool, what } или { kind: 'question', id, questions: [{ question, header,
// options: [подписи], multi }] }; null — ничего
S.ask = null
S.permMode = '' // режим разрешений сессии — из телеметрии и классических хуков
// id вызова → запрос: «спросить» ещё может решить классификатор
const waiting = new Map()
// Открытые запросы: id вызова, 'classic' (классический хук) или 'q:<id вопроса>'
const asks = new Map()
// Вызовы, о которых решение уже пришло: телеметрия может обогнать вердикт tool.check
const decided = new Set()
// Ответы на свои вопросы из своей же вкладки «Агенты»: id вопроса → выбор
const ownAnswers = new Map()
// Вкладка «Агенты»: выбранные варианты ('<сессия>:<вопрос>' → [[подписи] на каждый вопрос]) и уже отправленные ответы
const picked = new Map()
const sent = new Set()

const answerPath = (slot) => `${S.ag.dir}${S.sep}a${slot}.json`

// Claude ждёт человека: статус, плашка над игрой, уведомление; вопрос ещё и останавливает очередь. Уже ждёт — только
// новый запрос
export async function waitForPerson($, ask) {
  S.ask = ask
  const question = ask.kind === 'question'
  // Вопрос останавливает очередь, даже если статус «ждёт» уже стоит (например, от запроса разрешения рядом)
  if (question) queueQuestion($)
  if (S.status === 'permission') return $.ui.invalidate('ui.render')
  S.status = 'permission'
  S.askVisible = false
  if (S.paneOpen && S.view !== 'library') {
    S.agentAlert = question ? 'question' : 'permission'
    if (S.onPermission === 'pause') {
      S.paused = true
      releaseAll()
    }
    if (S.onPermission === 'close') await $.ui.close({ id: PANE })
  }
  log(question ? 'Claude задал вопрос' : `запрос разрешения: ${ask.tool || 'инструмент'}`)
  const now = await $.clock.now()
  // Включены уведомления о сессиях — о ней скажут они (alerts.js), второе не нужно
  const command = S.osNotify && S.windowOpenedAt && now - S.windowOpenedAt < NOTIFY_WINDOW_MS && !alertsCover(question ? 'question' : 'permission')
    ? notifyCommand(S.platform, 'Claude Code', tr(question ? 'Агент задал вопрос' : 'Агент ждёт разрешения', S.lang))
    : null
  if (command) {
    $.clock.after(0, async () => {
      try {
        await $.process.run(command.argv, { env: command.env, timeoutMs: 15_000 })
      } catch (err) {
        log(`уведомление не показалось: ${err?.message ?? err}`)
      }
    })
  }
  $.ui.invalidate('ui.render')
}

// Запрос закрыт: остались другие — показываем последний, нет — Claude снова работает
function resume($) {
  if (asks.size) {
    S.ask = [...asks.values()].at(-1)
    $.ui.invalidate('ui.render')
    return
  }
  S.ask = null
  if (S.status !== 'permission') return
  // Разрешения ждал субагент в фоне, а главный ход уже кончился — снова «в фоне», не «работает»
  S.status = S.agentTurn || !S.bg?.end ? 'working' : 'background'
  log(S.status === 'working' ? 'агент снова работает' : 'агенты снова работают в фоне')
  $.ui.invalidate('ui.render')
}

// Решение по вызову id пришло (телеметрия) или вызов кончился
export function settle($, id) {
  if (!id) return
  decided.add(id)
  if (decided.size > 64) decided.delete(decided.values().next().value)
  waiting.delete(id)
  if (!asks.delete(id)) return
  asks.delete('classic')
  resume($)
}

// Новый ход главного цикла или его конец: прежних запросов больше нет
export function asksReset() {
  waiting.clear()
  asks.clear()
  ownAnswers.clear()
  S.ask = null
}

// Что спрашивают, коротко: первая строка команды, файл или адрес
export function whatOf(input) {
  const i = input && typeof input === 'object' ? input : {}
  const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
  if (typeof i.command === 'string') return cut(i.command.trim().split('\n')[0], 80)
  const file = [i.file_path, i.notebook_path, i.path].find((x) => typeof x === 'string')
  if (file) return file.length > 60 ? `…${file.slice(-59)}` : file
  if (typeof i.url === 'string') return cut(i.url, 80)
  return ''
}

// Ключи tool.call рядом с аргументами инструмента — сам инструмент их не видит
const CALL_KEYS = ['tool', 'tool_use_id', 'consent', 'agentId', 'requestMeta']

// Claude вызывает инструмент (tool.call от движка, e — его вход): спрашиваем движок, как он решит. Запрос $.tool.check —
// только вердикт: ничего не запускает, диалога не открывает, PreToolUse и классификатор не зовёт. «Спросить» — запрос
// разрешения, если за GRACE решение не пришло
export async function callSeen($, e) {
  try {
    const id = e.tool_use_id
    if (!id || NOT_ASKS.has(e.tool) || decided.has(id)) return
    const input = { ...e }
    for (const key of CALL_KEYS) delete input[key]
    const verdict = await $.tool.check({ tool: e.tool, input })
    if (verdict?.decision === 'ask' && !decided.has(id)) {
      waiting.set(id, { kind: 'permission', tool: e.tool, what: whatOf(input) })
      const grace = S.permMode === 'auto' ? GRACE_AUTO_MS : S.permMode ? GRACE_MS : GRACE_UNKNOWN_MS
      $.clock.after(grace, async () => {
        const ask = waiting.get(id)
        if (!ask) return
        waiting.delete(id)
        asks.set(id, ask)
        await waitForPerson($, ask).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
      })
    }
  } catch (err) {
    log(`ошибка мода: ${err?.message ?? err}`)
  }
}

// Телеметрия: из решения о вызове берём только режим и id вызова
export function toolDecided($, e) {
  if (!String(e.event ?? '').endsWith('tool_decision')) return
  const a = e.attributes ?? {}
  if (typeof a.permission_mode === 'string') S.permMode = a.permission_mode
  if (typeof a.tool_use_id === 'string') settle($, a.tool_use_id)
}

// Режим разрешений из входа классического хука (Pro и Max): он есть у каждого
function modeOf(e) {
  if (typeof e?.permission_mode === 'string' && e.permission_mode) S.permMode = e.permission_mode
}

// Классический хук (Pro и Max): запрос показан человеку сейчас. Вопрос ловит questionCall
export async function classicAsk($, e) {
  modeOf(e)
  if (e.tool_name === 'AskUserQuestion') return
  const ask = { kind: 'permission', tool: e.tool_name ?? '', what: whatOf(e.tool_input) }
  asks.set('classic', ask)
  await waitForPerson($, ask)
}
// Классический запрос разрешения показан: «ждёт разрешения» по копии полей, не дожидаясь (хук сразу отдаёт событие
// дальше, решение — за человеком и Claude Code)
export function permissionShown($, tool, input, mode) {
  classicAsk($, { tool_name: tool, tool_input: input, permission_mode: mode }).catch(modError)
}
// Инструмент отработал: классический запрос закрыт (вопрос, если он открыт, — нет)
export function classicDone($, e) {
  modeOf(e)
  asks.delete('classic')
  resume($)
}
// Инструментов главного цикла больше не идёт: классический запрос тоже закрыт — в разрешении могли отказать, а тогда
// PostToolUse не будет
export function callsOver($) {
  if (asks.delete('classic')) resume($)
}

// Вопросы вызова AskUserQuestion — для отметки: текст (для показа — не длиннее QUESTION_MAX), подписи вариантов,
// можно ли несколько. Что-то не так — null: такой вопрос из «Агентов» не ответить
function questionsOf(list) {
  if (!Array.isArray(list) || !list.length) return null
  const out = []
  for (const q of list) {
    const labels = Array.isArray(q?.options) ? q.options.map((o) => o?.label) : []
    if (typeof q?.question !== 'string' || !labels.length || !labels.every((x) => typeof x === 'string' && x)) return null
    const question = q.question.length > QUESTION_MAX ? `${q.question.slice(0, QUESTION_MAX - 1)}…` : q.question
    out.push({ question, header: typeof q.header === 'string' ? q.header : '', options: labels, multi: Boolean(q.multiSelect) })
  }
  return out
}

// Ответ, собранный из выбора picks (на каждый вопрос — подписи), в том виде, в каком его даёт сам диалог:
// { [вопрос]: подпись или подписи через запятую }. Выбор не подходит к вопросам — null
export function answersOf(list, picks) {
  if (!Array.isArray(picks) || picks.length !== list.length) return null
  const out = {}
  for (const [i, q] of list.entries()) {
    const labels = q.options.map((o) => o.label)
    const chosen = picks[i]
    if (!Array.isArray(chosen) || !chosen.length || !chosen.every((x) => labels.includes(x))) return null
    if (!q.multiSelect && chosen.length > 1) return null
    out[q.question] = chosen.join(', ')
  }
  return out
}

// Ответ на вопрос id: из своей вкладки или из файла ответа, который написала другая сессия
async function answerFor($, id, list) {
  let picks = ownAnswers.get(id)
  const ag = S.ag
  if (!picks && ag?.on && ag.ready) {
    const text = await $.fs.read(answerPath(ag.slot)).catch(() => null)
    try {
      const got = text ? JSON.parse(text) : null
      if (got?.v === 1 && got.to === ag.sid && got.id === id) picks = got.picks
    } catch {}
  }
  return picks ? answersOf(list, picks) : null
}

// tool.call AskUserQuestion: вопрос — человеку, как обычно, а пока он открыт — читаем, не ответили ли из «Агентов».
// Ответили — отдаём модели этот ответ, а диалог движок снимает сам
export async function questionCall($, e, next) {
  const questions = questionsOf(e.questions)
  if (!questions) return next(e)
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const key = `q:${id}`
  const asked = next(e)
  let over = false
  const done = asked.then(() => (over = true), () => (over = true))
  asks.set(key, { kind: 'question', id, questions })
  try {
    await waitForPerson($, asks.get(key)).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    while (!over) {
      await Promise.race([done, $.clock.sleep(ANSWER_POLL_MS, { signal: next.signal }).catch(() => {})])
      if (over || next.signal?.aborted) break
      const answers = await answerFor($, id, e.questions).catch(() => null)
      if (answers) {
        log('ответ на вопрос пришёл из «Агентов»')
        return { result: { questions: e.questions, answers } }
      }
    }
    return await asked
  } finally {
    asks.delete(key)
    ownAnswers.delete(id)
    resume($)
  }
}

// --- Вкладка «Агенты» ----------------------------------------------------------------------------------------------

// Запрос сессии r — проверенный: чужая отметка могла прийти от старой версии Arcade или быть битой. null — нечего показать
export function askOf(r) {
  const a = r?.status === 'permission' ? r.ask : null
  if (!a || typeof a !== 'object') return null
  if (a.kind === 'permission') return { kind: 'permission', tool: String(a.tool ?? ''), what: String(a.what ?? '') }
  if (a.kind !== 'question' || typeof a.id !== 'string' || !Array.isArray(a.questions) || !a.questions.length) return null
  const ok = a.questions.every((q) => typeof q?.question === 'string' && Array.isArray(q.options) && q.options.length && q.options.every((x) => typeof x === 'string'))
  return ok ? { kind: 'question', id: a.id, questions: a.questions.map((q) => ({ ...q, header: String(q.header ?? ''), multi: Boolean(q.multi) })) } : null
}

const keyOf = (r, ask) => `${r.sid}:${ask.id}`
// Выбранные варианты вопроса сессии r: на каждый вопрос — подписи
export function picksOf(r, ask) {
  return picked.get(keyOf(r, ask)) ?? ask.questions.map(() => [])
}
export const isSent = (r, ask) => sent.has(keyOf(r, ask))

// Нажали вариант: один вопрос с одним ответом — ответ уходит сразу; иначе — отметить (или снять) и ждать «Ответить»
export async function pickOption($, r, ask, qi, label) {
  const picks = picksOf(r, ask).map((x) => [...x])
  const q = ask.questions[qi]
  if (!q) return
  if (ask.questions.length === 1 && !q.multi) return sendAnswer($, r, ask, [[label]])
  picks[qi] = q.multi ? (picks[qi].includes(label) ? picks[qi].filter((x) => x !== label) : [...picks[qi], label]) : [label]
  picked.set(keyOf(r, ask), picks)
  $.ui.invalidate('ui.render')
}
export const allPicked = (r, ask) => picksOf(r, ask).every((x) => x.length > 0)

// Отправить ответ сессии r: своей — сразу в память, другой — файлом в её место
export async function sendAnswer($, r, ask, picks) {
  if (r.me) ownAnswers.set(ask.id, picks)
  else {
    const slot = Number(r.slot)
    if (!S.ag?.on || !Number.isInteger(slot) || slot < 1 || slot > AGENT_SLOTS) return
    await $.fs.write(answerPath(slot), JSON.stringify({ v: 1, to: r.sid, id: ask.id, picks, at: await $.clock.now() }))
  }
  sent.add(keyOf(r, ask))
  picked.delete(keyOf(r, ask))
  log(`ответ на вопрос ушёл сессии «${r.name}»`)
  $.ui.invalidate('ui.render')
}

// ━━━━━━━━━━ app/background ━━━━━━━━━━
// Фоновые агенты: главный ход кончился, а субагенты и напарники, запущенные из него, ещё работают. Тогда сессия не
// «закончил ход», а «работает в фоне · агентов: N»: «закончил», плашка, всплывашка, уведомление и следующая карточка
// очереди — только когда в фоне никого не осталось. Фоновые команды (Bash в фоне) не считаем: о их конце мод не узнаёт

// В фоне никого не видно — ещё столько ждём: конец субагента будит Claude новым ходом (уведомление о задаче), и его
// начало не должно опоздать за «закончил»
export const BG_GRACE_MS = 5_000
// Работает или ждёт своего: pending — ещё стартует, waiting — ждёт свою фоновую работу или одобрения плана. idle —
// напарник ждёт сообщения: это не работа
const ACTIVE = new Set(['pending', 'running', 'waiting'])

// Сколько агентов главного цикла сейчас работает. Запущенные другими плагинами (spawnedBy) — их дело, вложенные
// (parentId) — часть своего родителя
export async function bgCount($) {
  const list = await $.agent.list().catch(() => [])
  return list.filter((a) => ACTIVE.has(a.status) && !a.parentId && !a.spawnedBy).length
}

// Ход Claude по уведомлению о фоновой задаче — не новая просьба, а продолжение той же работы (prompt.submit отмечает
// S.wake; на случай, если тот хук не дошёл, — и по тексту)
export const wakeText = (text) => /^\s*<task-notification>/.test(text ?? '')

// Главный ход кончился, а в фоне n агентов: «закончил» откладываем. e — конец хода для очереди; ход прервали или он
// упал — очередь решает сейчас же (стоп или ожидание лимита), ответ — когда фон кончится
export async function bgHold($, turnId, e, n) {
  let held = e
  if (e.reason !== 'answer' && S.queue) {
    await queueTurnDone($, e)
    held = null
  }
  S.status = 'background'
  S.bg = { n, zeroAt: 0, checking: false, end: { turnId, e: held } }
  log(`агент закончил ход, в фоне агентов: ${n}`)
  $.ui.invalidate('ui.render')
}

// Начался главный ход: отложенного конца больше нет. true — ход продолжает работу, которая шла в фоне
export function bgResume() {
  const going = Boolean(S.bg?.end)
  S.bg = { n: 0, zeroAt: 0, checking: false, end: null }
  return going
}

// Сессию очистили (/clear): ждать фоновых больше незачем
export function bgClear($) {
  if (!S.bg?.end) return
  S.bg = { n: 0, zeroAt: 0, checking: false, end: null }
  if (S.status === 'background') S.status = 'idle'
  $.ui.invalidate('ui.render')
}

// Пересчитать фон — шагом отметки сессии и после конца каждого субагента. Никого не осталось дольше BG_GRACE_MS, а
// новый ход не начался — Claude закончил
export async function bgCheck($) {
  const bg = S.bg
  if (!bg?.end || bg.checking) return
  bg.checking = true
  try {
    const n = await bgCount($)
    if (S.bg !== bg || !bg.end) return
    const now = await $.clock.now()
    if (n > 0) {
      bg.zeroAt = 0
      if (n !== bg.n) {
        bg.n = n
        $.ui.invalidate('ui.render')
      }
      return
    }
    if (!bg.zeroAt) bg.zeroAt = now
    if (now - bg.zeroAt < BG_GRACE_MS || S.agentTurn) return
    const { turnId, e } = bg.end
    // Пока ждали, мог прийти запрос разрешения от субагента — тогда «закончил» после него (app/asks вернёт «в фоне»)
    if (S.status !== 'background') return
    await turnDone($, turnId, e)
  } catch (err) {
    modError(err)
  } finally {
    bg.checking = false
  }
}

// Claude закончил — и в фоне никого: статус, очередь, плашка над игрой, всплывашка, уведомление ОС. e — конец хода
// для очереди (null — очередь уже решила)
export async function turnDone($, turnId, e) {
  S.bg = { n: 0, zeroAt: 0, checking: false, end: null }
  S.status = 'done'
  S.askVisible = false
  // Очередь карточек: карточка сделана — следующая уходит новым ходом, не изнутри конца этого
  if (e && S.queue && (await queueTurnDone($, e))) $.clock.after(0, () => queueNext($).catch(modError))
  if (S.paneOpen && S.view !== 'library') {
    S.agentAlert = 'done'
    if (S.onDone === 'pause') {
      S.paused = true
      releaseAll()
    }
    if (S.onDone === 'close') await $.ui.close({ id: PANE }) // панель закрывается — игра встаёт на паузу, клавиатура у Claude Code
  }
  log('агент закончил ход')
  // Смотришь во встроенном браузере — вкладку закрываем, если так выбрано: снова виден разговор. Ход, которым Claude
  // открыл её по просьбе Arcade, — не тот: его конец вкладку не закрывает. Закрыть не дали (в режиме Auto
  // классификатор не пускает вызовы мода) — хотя бы сообщаем
  const watching = Boolean(S.backOnDone && S.watchTab && S.watchTab.turn !== turnId)
  const back = watching && (await closeWatchTab($))
  if (back) await $.ui.toast(tr('Агент закончил — вкладку закрыл, перед тобой снова разговор', S.lang))
  else if (S.paneOpen) await $.ui.toast(tr('Агент закончил — Esc, чтобы вернуться', S.lang))
  else if (watching) await $.ui.toast(tr('Агент закончил — можно возвращаться', S.lang))
  // Играешь в окне браузера — Claude Code не видно: системное уведомление, если ход был долгим
  const now = await $.clock.now()
  const command = S.osNotify && S.windowOpenedAt && now - S.windowOpenedAt < NOTIFY_WINDOW_MS && now - S.turnStartedAt >= NOTIFY_AFTER_MS && !alertsCover('done')
    ? notifyCommand(S.platform, 'Claude Code', tr('Агент закончил — можно возвращаться', S.lang))
    : null
  if (command) {
    $.clock.after(0, async () => {
      try {
        await $.process.run(command.argv, { env: command.env, timeoutMs: 15_000 })
      } catch (err) {
        log(`уведомление не показалось: ${err?.message ?? err}`)
      }
    })
  }
  $.ui.invalidate('ui.render')
}

// ━━━━━━━━━━ screens/game ━━━━━━━━━━
// Arcade: экран игры в панели — Денди, Flappy или проверка клавиш.

// Что с агентом, пока идёт игра: на паузе и на плашке над экраном
const ALERT_PAUSE = { permission: 'агент ждёт разрешения', question: 'агент задал вопрос' }
const ALERT_BAR = { permission: ' Агент ждёт разрешения ', question: ' Агент задал вопрос ' }

export function gameScreen($, e, kit) {
  const { Box, Button, Image, Raster, Svg, Text, eventLines, game, header, terminal } = kit
  const libraryButton = Button({
    key: 'arcade-library',
    label: 'Библиотека',
    onPress: () => {
      toLibrary()
      $.ui.invalidate('ui.render')
    },
  })
  const moves = `${first('up')} ${first('left')} ${first('down')} ${first('right')} или стрелки`
  const legend =
    game.engine === 'flappy'
      ? `взмах — любая кнопка: ${first('up')}, ${first('a')} или ${first('b')}`
      : game.id === 'thwaite'
      ? `прицел ${moves} · огонь ${first('b')} ${first('a')} · Start ${first('start')}`
      : `движение ${moves} · A ${first('a')} · B ${first('b')} · Start ${first('start')}`
  // Назначение клавиш или сообщение мода; иначе — подсказка для этой поверхности
  const message = S.paused
    ? Text({
        color: 'warning',
        children: [`Пауза: ${ALERT_PAUSE[S.agentAlert] ?? 'агент закончил'}. Любая клавиша игры — играть дальше, Esc — к агенту`],
      })
    : S.mode === 'assign'
      ? Text({ color: 'warning', children: [`${S.notice} Нажми клавишу для «${ACTIONS[S.assignStep].label}» (${S.assignStep + 1} из ${ACTIONS.length})`] })
      : S.notice
        ? Text({ color: 'warning', children: [S.notice] })
        : game.engine === 'flappy'
          ? Text({ color: S.nes?.state === 'over' ? 'warning' : 'success', children: [flappyLine()] })
          : null

  // Desktop и VS Code: кадр Денди — PNG внутри Svg, панель перерисовывается каждый шаг игры
  if (!terminal) {
    if (!game.rom && !game.engine) {
      return Box({
        flexDirection: 'column',
        children: [header, Text({ children: ['Проверка клавиш работает только в терминале.'] }), libraryButton],
      })
    }
    // Во всю ширину картинка крупнее, но целиком помещается и по высоте панели
    const byWidth = Math.floor(((e.props.bodyColumns ?? 60) * 7.5) / 256)
    const byHeight = S.wide ? Math.floor(((e.props.scroll?.bodyRows ?? 30) * 17) / 240) : Infinity
    const scale = Math.max(1, Math.min((S.wide ? REMOTE_MAX_WIDTH_WIDE : REMOTE_MAX_WIDTH) / 256, byWidth, byHeight))
    const width = 256 * scale
    const height = 240 * scale
    const picture = Svg({ source: frameToSvg(S.frame, width, height), alt: game.title, width, height })
    // Агент закончил или ждёт разрешения, пока идёт игра: яркая плашка над экраном — её видно и во всю ширину
    const alertBar = S.agentAlert
      ? Box({
          flexDirection: 'row',
          columnGap: 2,
          children: [
            Text({
              bold: true,
              color: 'black',
              backgroundColor: S.agentAlert === 'done' ? 'green' : 'yellow',
              children: [`${ALERT_BAR[S.agentAlert] ?? ' Агент закончил '}${S.paused ? '· пауза ' : ''}`],
            }),
            Button({ key: 'arcade-to-agent', label: 'К агенту', onPress: async () => { await $.ui.close({ id: PANE }) } }),
            Button({
              key: 'arcade-alert-ok',
              label: 'Играть дальше',
              onPress: () => {
                S.agentAlert = null
                S.paused = false
                $.ui.invalidate('ui.render')
              },
            }),
          ],
        })
      : null
    // В Desktop клавиши ловит Client поверх экрана, как в терминале; в VS Code его пока нет
    if (e.surface === 'desktop') {
      return Box({
        flexDirection: 'column',
        children: [
          header,
          ...(alertBar ? [alertBar] : []),
          message ?? Text({ dimColor: true, children: ['Кликни по экрану — играть · Esc — к агенту · Backspace — библиотека'] }),
          Box({
            children: [
              picture,
              Box({
                position: 'absolute',
                top: 0,
                left: 0,
                children: [h('Client', { key: INPUT, module: './input.js', props: { focused: e.props.isFocused }, width: '100%', height: '100%' })],
              }),
            ],
          }),
          Text({ dimColor: true, children: [legend] }),
          libraryButton,
        ],
      })
    }
    // В VS Code Client пока нет. Клавиши — горячие клавиши экранных кнопок: они работают, пока панель в фокусе.
    // Поле ввода не годится: панель перерисовывается 30 раз в секунду, и поле каждый раз сбрасывается.
    // Зажатая клавиша повторяет нажатия — кнопка держится, пока идут повторы, и не отпускается между ними.
    const pad = (id, label, hotkey) =>
      Button({
        key: `arcade-pad-${id}`,
        label,
        hotkey,
        onPress: () => {
          if (!S.holdTicks[id]) S.taps.add(id)
          S.holdTicks[id] = S.holdTicks[id] ? HOLD_TICKS_REPEAT : HOLD_TICKS_FIRST
          $.ui.invalidate('ui.render')
        },
      })
    return Box({
      flexDirection: 'column',
      children: [
        header,
        ...(alertBar ? [alertBar] : []),
        message ?? Text({ dimColor: true, children: ['Клавиатура — в строке 🎮 над строкой ввода Claude · кнопки — мышью'] }),
        picture,
        Box({
          flexDirection: 'row',
          columnGap: 1,
          children: [
            pad('left', '← (A)', 'a'),
            pad('up', '↑ (W)', 'w'),
            pad('down', '↓ (S)', 's'),
            pad('right', '→ (D)', 'd'),
            pad('b', 'B (J)', 'j'),
            pad('a', 'A (K)', 'k'),
            pad('start', 'Start (N)', 'n'),
            pad('select', 'Select (M)', 'm'),
          ],
        }),
        Text({ dimColor: true, children: ['W A S D — движение · K — A · J — B · Enter или N — Start · M — Select · русская раскладка тоже подходит'] }),
        libraryButton,
      ],
    })
  }

  // Терминал: подсказка, или назначение клавиш, или сообщение мода
  const line = message ?? Text({ dimColor: true, children: ['Кликни по экрану — играть · Esc — к агенту · Backspace — библиотека'] })

  // Экран игры и Client поверх него: клики и клавиши над экраном попадают в hooks/input.js.
  // Других кнопок в игре нет, чтобы клавиатуру у экрана ничто не перехватывало.
  const withInput = (picture, columns, rows) =>
    Box({
      children: [
        picture,
        Box({
          position: 'absolute',
          top: 0,
          left: 0,
          children: [h('Client', { key: INPUT, module: './input.js', props: { focused: e.props.isFocused }, width: columns, height: rows })],
        }),
      ],
    })

  if (game.rom || game.engine) {
    const pixels = pixelMode()
    S.screen = screenSize(e.props.bodyColumns ?? 60, freeRows(e.props), pixels ? MAX_IMAGE_COLUMNS : MAX_SYMBOL_COLUMNS)
    const content = screenContent()
    const picture = pixels
      ? Image({ key: 'arcade-screen', columns: S.screen.columns, rows: S.screen.rows, alt: `${game.title} — этот терминал не показывает картинки`, ...content })
      : Raster({ key: 'arcade-screen', columns: S.screen.columns, rows: S.screen.rows, ...content })
    return Box({
      flexDirection: 'column',
      children: [header, line, withInput(picture, S.screen.columns, S.screen.rows), Text({ dimColor: true, children: [legend] })],
    })
  }

  return Box({
    flexDirection: 'column',
    children: [
      header,
      line,
      withInput(Raster({ key: 'arcade-field', columns: COLS, rows: ROWS, cells: cellsOf(fieldRows()) }), COLS, ROWS),
      Text({ dimColor: true, children: [`Нажатия: ${S.pressed.join(' ') || '—'}`] }),
      Text({ dimColor: true, children: [`Зажато: ${S.heldKeys.join(' ') || '—'}`] }),
      Text({ dimColor: true, children: [`Клавиши: ${ACTIONS.map((a) => `${a.label} ${S.keymap[a.id].join(' ')}`).join(' · ')}`] }),
      Text({ dimColor: true, children: ['Назначить заново: «Настройки» → «Назначить клавиши заново»'] }),
      Text({ children: [' '] }),
      ...eventLines,
    ],
  })
}

// ━━━━━━━━━━ screens/main ━━━━━━━━━━
// Arcade: главное меню библиотеки и приветствие первого запуска.

// Первый запуск: что есть в Arcade и какие разделы показывать. Показаны все — лишнее человек убирает нажатием,
// вернуть можно в настройках. Язык угадан по окружению — сменить его можно здесь же. Вернулись с выбора языка
// (выбрали язык — menuFrom 'main', «Назад» — 'lang') — фокус на языке, иначе на «Готово»
export function welcomeScreen($, e, kit) {
  const { Button, Text, desktop, dim, gap, hint, noticeLines, open, section, sectionSwitches, tiles } = kit
  const welcomeFocus = S.menuFrom === 'main' || S.menuFrom === 'lang' ? 'arcade-lang-main' : 'arcade-welcome-done'
  const focus = (key) => (key === welcomeFocus ? { autoFocus: true } : {})
  return [
    Text(desktop ? { size: 'heading', weight: 'semibold', children: ['Добро пожаловать в Arcade!'] } : { bold: true, children: ['Добро пожаловать в Arcade!'] }),
    Text({ wrap: 'wrap', children: ['Пока Claude работает, здесь можно играть, читать и слушать, смотреть видео, общаться с друзьями и вести заметки.'] }),
    dim('Выбери, что показывать в главном меню: нажатие убирает раздел или возвращает его.'),
    ...(desktop ? [] : [gap]),
    section('Разделы главного меню'),
    tiles(sectionSwitches(), 40),
    ...(desktop ? [] : [gap]),
    section('Язык'),
    tiles(
      [
        Button({
          key: 'arcade-lang-main',
          label: `🌐 ${LANG_NAMES[S.lang] ?? S.lang}`,
          ...focus('arcade-lang-main'),
          onPress: () => {
            S.langReturn = 'main'
            open('lang')()
          },
        }),
        dim('  язык интерфейса — 13 на выбор'),
      ],
      40,
    ),
    gap,
    Button({ key: 'arcade-welcome-done', label: 'Готово', ...(desktop ? { variant: 'primary' } : {}), ...focus('arcade-welcome-done'), onPress: () => finishWelcome($) }),
    dim('Передумаешь — разделы меняются в «Ещё → Настройки».'),
    ...noticeLines,
    ...hint,
  ]
}

// Последнее, во что играли (или что читали и слушали), — одной кнопкой: при открытии меню фокус на ней
export function mainScreen($, e, kit) {
  const { Box, Button, Text, desktop, dim, eventLines, gap, hint, inviteRows, noticeLines, now, open, playGame, tiles, windowed } = kit
  let items
  let headerExtra = []
  const lastPlayed = S.played ? gameById(S.lastGame) : null
  const tabItems = (list) =>
    list.flatMap((c) => [
      Button({
        key: `arcade-menu-${c.id}`,
        label: c.title,
        ...((S.menuFrom ?? (lastPlayed ? null : consoles()[0]?.id)) === c.id ? { autoFocus: true } : {}),
        onPress: open(c.id),
      }),
      dim(`  ${consoleNote(c)}`),
    ])
  // Книги и аудиокниги — свои экраны, не вкладки каталога. Старый каталог сайта (до 0.31) держал их в группах
  // reading и listening — в «Играть» их не показываем
  const reading = menuTabs().filter((c) => ['reading', 'books', 'listening', 'audiobooks'].includes(c.id))
  const bookTile = (id, label, note) => [Button({ key: `arcade-menu-${id}`, label, ...(S.menuFrom === id || S.menuFrom?.startsWith(`${id}:`) ? { autoFocus: true } : {}), onPress: open(id) }), dim(note)]
  // YouTube, статьи и подкасты: общие темы подбираем заново, если их нет, сменился язык или они устарели
  const openTopics = (id) => () => {
    open(id)()
    if (!S.yt.topics || S.yt.topicsLang !== S.lang || now - S.yt.topicsAt > TOPICS_TTL_MS) loadTopics($)
  }
  const topicTile = (id, label, note) => [Button({ key: `arcade-menu-${id}`, label, ...(S.menuFrom === id ? { autoFocus: true } : {}), onPress: openTopics(id) }), dim(note)]
  // Аккаунт, друзья и чаты открываются и плитками «Общения», и из шапки
  const toAccount = () => {
    S.acct.confirmDelete = false
    open('account')()
    syncAccount($)
  }
  const toFriends = () => {
    S.fr.note = ''
    S.fr.bad = false
    open('friends')()
    if (!S.acct.session) return
    if (!S.acct.syncedAt) syncAccount($)
    friendsCall($, 'friends')
    // кто из друзей в сети — сразу, не дожидаясь отметки по таймеру
    pulseSoon($)
  }
  // Непрочитанные — с сайта при синхронизации и по таймеру
  const toChats = async () => {
    S.ch.note = ''
    S.ch.bad = false
    open('chats')()
    if (!S.acct.session) return
    if (!S.acct.syncedAt) await syncAccount($)
    if (S.acct.handle) await loadChats($)
  }
  // Шапка главного меню: свой @ник — в аккаунт; непрочитанные чаты и заявки в друзья — числом, если они есть
  if (S.acct.session)
    headerExtra = [
      keep(Button({ key: 'arcade-head-account', label: S.acct.handle ? `@${S.acct.handle}` : S.acct.session.user.login, plain: true, dimColor: true, onPress: toAccount })),
      ...(S.acct.unread ? [keep(Button({ key: 'arcade-head-chats', label: `💬 ${S.acct.unread}`, plain: true, onPress: toChats }))] : []),
      ...(S.acct.requests ? [keep(Button({ key: 'arcade-head-friends', label: `👥 ${S.acct.requests}`, plain: true, onPress: toFriends }))] : []),
    ]
  // Раздел главного меню сворачивается: заголовок — кнопка ▾ / ▸, у свёрнутого — сколько в нём плиток. Что
  // свёрнуто — в настройках, со входом — на всех компьютерах. Убранного в настройках раздела нет совсем
  const foldable = (id, title, list, badge = '') => {
    if (S.hidden.includes(id)) return []
    const shut = S.collapsed.includes(id)
    const count = list.filter((x) => x?.type === 'Button').length
    const label = `${shut ? '▸' : '▾'} ${tr(title, S.lang)}${shut ? ` · ${count}${badge}` : ''}`
    const head = keep(
      Button({
        key: `arcade-fold-${id}`,
        label,
        plain: true,
        children: [Text(desktop ? { size: 'heading', weight: 'semibold', children: [label] } : { bold: true, ...(shut ? { dimColor: true } : {}), children: [label] })],
        onPress: () => toggleSection($, id),
      }),
    )
    return [desktop ? Box({ marginTop: 'lg', marginBottom: 'sm', children: [head] }) : head, ...(shut ? [] : [tiles(list)])]
  }
  const windowTiles = windowed
    ? [
        Button({
          key: 'arcade-open-library',
          label: 'Окно Arcade',
          onPress: async () => {
            if (builtinBrowser(e.surface)) return desktopWindow($, null, 'Arcade открыт во встроенном браузере Claude.')
            S.libraryNotice = 'Открываю окно…'
            $.ui.invalidate('ui.render')
            const command = windowCommand(null)
            try {
              const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
              windowNotice($, launchNotice(result, null))
              if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
            } catch (err) {
              S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
            }
            $.ui.invalidate('ui.render')
          },
        }),
        dim('  все игры и статистика в окне браузера'),
      ]
    : []
  // Кто-то ждёт в сети — можно сразу к нему
  const joinTiles =
    windowed && S.netWaiting.length
      ? [
          Button({
            key: 'arcade-net-join',
            label: `Присоединиться: ${S.netWaiting[0].title}`,
            onPress: () => openNet($, e.surface, netWhere(S.netWaiting[0].id)),
          }),
          dim(`  в сети ждут: ${waitingText()}`),
        ]
      : []
  const favCount = favoriteGames().length
  // Друг зовёт сыграть — первым делом; остальные приглашения — в «Друзьях»
  const inviteBanner =
    S.acct.session && S.ol.invites.length
      ? [...inviteRows(S.ol.invites[0], false), ...(S.ol.invites.length > 1 ? [dim(`ещё приглашений: ${S.ol.invites.length - 1} — в «Друзьях»`)] : []), gap]
      : []
  items = [
    ...inviteBanner,
    // Сверху, без заголовка: продолжить последнее, найти, избранное
    tiles([
      ...(lastPlayed
        ? [
            Button({ key: 'arcade-continue', label: '▶ Продолжить', ...(S.menuFrom ? {} : { autoFocus: true }), onPress: () => playGame(lastPlayed) }),
            dim(`  ${lastPlayed.title}`),
          ]
        : []),
      Button({
        key: 'arcade-menu-search',
        label: '🔍 Найти',
        ...(S.menuFrom === 'search' ? { autoFocus: true } : {}),
        onPress: () => {
          open('search')()
          // каналы Twitch для поиска — из каталога сайта
          if (!S.tw.at) loadTwitch($)
        },
      }),
      dim('  игры и каналы Twitch'),
      Button({ key: 'arcade-menu-favorites', label: '★ Избранное', ...(S.menuFrom === 'favorites' ? { autoFocus: true } : {}), onPress: open('favorites') }),
      dim(favCount ? `  отмечено: ${favCount}` : '  отмечай ☆ игры — они соберутся здесь'),
    ]),
    ...foldable('play', 'Играть', [
      ...tabItems(menuTabs().filter((c) => !reading.includes(c))),
      ...joinTiles,
      Button({
        key: 'arcade-menu-mine',
        label: 'Мои игры',
        ...(S.menuFrom === 'mine' ? { autoFocus: true } : {}),
        onPress: open('mine'),
      }),
      dim(`  ${S.mine.length ? `${S.mine.length} ${plural(S.mine.length, 'игра', 'игры', 'игр')}` : 'добавь свой файл ROM'}`),
    ]),
    // Книги и аудиокниги с открытых библиотек, за ними — свежие статьи и подкасты по теме работы агента
    ...foldable('read', 'Читать и слушать', [
      ...bookTile('books', 'Книги', '  классика на любом языке: разделы и поиск'),
      ...bookTile('audiobooks', 'Аудиокниги', '  LibriVox: слушать сразу или скачать'),
      ...topicTile('articles', 'Статьи', '  свежие статьи по теме работы агента'),
      ...topicTile('podcasts', 'Подкасты', '  свежие выпуски подкастов по теме работы агента'),
    ]),
    ...foldable('watch', 'Смотреть', [
      ...topicTile('youtube', 'YouTube', '  свежие видео по теме работы агента'),
      Button({
        key: 'arcade-menu-twitch',
        label: 'Twitch',
        ...(S.menuFrom === 'twitch' ? { autoFocus: true } : {}),
        onPress: () => {
          S.tw.note = ''
          open('twitch')()
          loadTwitch($)
        },
      }),
      dim('  свои каналы и эфиры о программировании, технике и ретро-играх'),
      ...topicTile('tiktok', 'TikTok', '  лента и поиск по теме работы агента; вход — твой'),
    ]),
    // Друзья, чаты и аккаунт; у свёрнутого раздела видно, что кто-то написал или зовёт в друзья
    ...foldable(
      'talk',
      'Общение',
      [
        // Друзья — плитка видна всем; без входа и без ника экран скажет, что сделать сначала
        Button({
          key: 'arcade-menu-friends',
          label: 'Друзья',
          ...(String(S.menuFrom ?? '').startsWith('friends') ? { autoFocus: true } : {}),
          onPress: toFriends,
        }),
        // Ника нет, а сайт ещё не спрашивали — может, он есть: пока без «возьми ник»
        dim(
          !S.acct.session
            ? '  по @нику: заявки и список друзей; нужен вход через GitHub'
            : !S.acct.handle
              ? S.acct.syncedAt
                ? '  сначала возьми свой @ник'
                : '  по @нику: заявки и список друзей'
              : S.acct.requests
                ? `  заявок тебе: ${S.acct.requests} · друзей: ${S.acct.friends}`
                : S.acct.friends && S.ol.online.size
                  ? `  друзей: ${S.acct.friends} · в сети: ${S.ol.online.size}`
                  : S.acct.friends
                    ? `  друзей: ${S.acct.friends}`
                    : '  позови друзей по их @нику',
        ),
        // Чаты — плитка видна всем, как «Друзья»
        Button({
          key: 'arcade-menu-chats',
          label: 'Чаты',
          ...(String(S.menuFrom ?? '').startsWith('chats') ? { autoFocus: true } : {}),
          onPress: toChats,
        }),
        dim(
          !S.acct.session
            ? '  с друзьями: один на один и группы; нужен вход через GitHub'
            : !S.acct.handle && S.acct.syncedAt
              ? '  сначала возьми свой @ник'
              : S.acct.unread
                ? `  непрочитанных: ${S.acct.unread}`
                : '  с друзьями: один на один и группы',
        ),
        // Вход — по желанию: настройки одни на всех компьютерах человека
        Button({
          key: 'arcade-menu-account',
          label: S.acct.session ? 'Аккаунт' : 'Войти через GitHub',
          ...(S.menuFrom === 'account' ? { autoFocus: true } : {}),
          onPress: toAccount,
        }),
        S.acct.session ? keep(dim(`  ${S.acct.handle ? `@${S.acct.handle} · ` : ''}GitHub: @${S.acct.session.user.login}`)) : dim('  по желанию: одни настройки на всех компьютерах и свой @ник'),
      ],
      `${S.acct.unread ? ` · 💬 ${S.acct.unread}` : ''}${S.acct.requests ? ` · 👥 ${S.acct.requests}` : ''}${S.ol.online.size ? ` · 🟢 ${S.ol.online.size}` : ''}`,
    ),
    // Работа: блокнот, доска проектов и календарь, которые ведут и человек, и Claude, и сессии Claude Code на этом компьютере
    ...foldable('work', 'Работа', [
      // «Сегодня» — первым: что ждёт человека из всех разделов разом. Чаты и общие доски — свежие с сайта
      Button({
        key: 'arcade-menu-today',
        label: 'Сегодня',
        ...(S.menuFrom === 'today' ? { autoFocus: true } : {}),
        onPress: () => {
          open('today')()
          usageNow($).then(() => $.ui.invalidate('ui.render'))
          if (S.acct.session) {
            loadChats($, true).catch(modError)
            loadBoards($, true).catch(modError)
          }
        },
      }),
      dim('  вопросы сессий, события, сроки и чаты — на одном экране'),
      Button({
        key: 'arcade-menu-notes',
        label: 'Блокнот',
        ...(S.menuFrom === 'notes' ? { autoFocus: true } : {}),
        onPress: () => {
          nb.note = ''
          nb.bad = false
          open('notes')()
        },
      }),
      dim('  страницы и чек-листы; Claude может дополнять'),
      Button({
        key: 'arcade-menu-boards',
        label: 'Доска проектов',
        ...(S.menuFrom === 'boards' ? { autoFocus: true } : {}),
        onPress: () => {
          open('boards')()
          boardsOpened($)
        },
      }),
      dim('  колонки и карточки; общие — с друзьями'),
      Button({
        key: 'arcade-menu-prompts',
        label: 'Промпты',
        ...(S.menuFrom === 'prompts' ? { autoFocus: true } : {}),
        onPress: () => {
          pr.note = ''
          pr.bad = false
          pr.edit = ''
          pr.set = ''
          pr.confirm = ''
          pr.focus = ''
          open('prompts')()
          boardsOpened($)
        },
      }),
      dim('  шаблоны в один клик; общие — с друзьями'),
      Button({
        key: 'arcade-menu-calendar',
        label: 'Календарь',
        ...(S.menuFrom === 'calendar' ? { autoFocus: true } : {}),
        onPress: () => {
          cal.note = ''
          cal.bad = false
          cal.focus = ''
          cal.month = ''
          cal.day = ''
          open('calendar')()
        },
      }),
      dim('  события и напоминания; Claude может записывать'),
      Button({
        key: 'arcade-menu-agents',
        label: 'Агенты',
        ...(S.menuFrom === 'agents' ? { autoFocus: true } : {}),
        onPress: () => {
          if (S.chg) S.chg.note = ''
          open('agents')()
        },
      }),
      dim('  сессии Claude Code на этом компьютере: что делает каждая'),
      Button({
        key: 'arcade-menu-usage',
        label: 'Лимиты',
        ...(S.menuFrom === 'usage' ? { autoFocus: true } : {}),
        onPress: () => {
          open('usage')()
          usageNow($).then(() => $.ui.invalidate('ui.render'))
        },
      }),
      dim('  лимиты Claude, контекст и расходы сессий'),
    ]),
    ...foldable('more', 'Ещё', [
      ...windowTiles,
      Button({
        key: 'arcade-menu-settings',
        label: 'Настройки',
        ...(S.menuFrom === 'settings' ? { autoFocus: true } : {}),
        onPress: open('settings'),
      }),
      dim(`  ${settingsNote(e.surface)}`),
      // Язык — прямо в главном меню: название языка на нём самом, чтобы найти его, не понимая текущего
      Button({
        key: 'arcade-lang-main',
        label: `🌐 ${LANG_NAMES[S.lang] ?? S.lang}`,
        onPress: () => {
          S.langReturn = 'main'
          open('lang')()
        },
      }),
      dim('  язык интерфейса — 13 на выбор'),
      Button({
        key: 'arcade-menu-report',
        label: '🐞 Сообщить об ошибке',
        ...(S.menuFrom === 'report' ? { autoFocus: true } : {}),
        onPress: () => {
          S.rp.note = ''
          open('report')()
        },
      }),
      dim('  что сломалось — прямо автору Arcade'),
      // Список отчётов — только админу: остальные этой плитки не видят, а сайт им список и не отдаст
      ...(S.acct.role === 'admin'
        ? [
            Button({
              key: 'arcade-menu-reports',
              label: '📋 Отчёты об ошибках',
              ...(S.menuFrom === 'reports' ? { autoFocus: true } : {}),
              onPress: () => {
                open('reports')()
                loadReports($)
              },
            }),
            dim('  видишь только ты: ты админ Arcade'),
          ]
        : []),
      // Добровольно, без напоминаний: одна строка внизу меню, ссылка открывается в обычном браузере
      Button({
        key: 'arcade-support',
        label: '☕ Поддержать проект',
        onPress: async () => {
          const url = supportUrl()
          const command = openUrlCommand(S.platform, url)
          if (!command) {
            S.libraryNotice = `Страница поддержки: ${url}`
            $.ui.invalidate('ui.render')
            return
          }
          try {
            const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
            windowNotice($, result?.exitCode === 0 ? 'Открываю страницу поддержки в браузере. Спасибо!' : `Страница поддержки: ${url}`)
          } catch {
            S.libraryNotice = `Страница поддержки: ${url}`
          }
          $.ui.invalidate('ui.render')
        },
      }),
      dim(`  добровольно, на развитие Arcade — ${supportUrl().replace(/^https:\/\//, '')}`),
    ]),
    ...noticeLines,
    ...hint,
    ...(eventLines.length ? [gap, ...eventLines] : []),
  ]
  return { items, headerExtra }
}

// ━━━━━━━━━━ screens/games ━━━━━━━━━━
// Arcade: экраны игр — поиск, избранное, свои игры, группы и полки.

// Поиск: игры — разделами по жанрам, за ними каналы Twitch. От двух букв, без регистра и диакритики: ищется в
// названии (и в его переводе), жанре и разделе. Книги ищутся в «Книгах»: их список — на сайте
export function searchScreen($, e, kit) {
  const { Box, Button, Input, back, byGenre, desktop, dim, gap, hint, noticeLines, section, tiles, watchLive } = kit
  if (!finder.shown) {
    finder.seed = finder.query
    finder.field++
    finder.shown = true
  }
  const query = finder.query.trim()
  const ready = query.length >= MIN_QUERY
  const pool = games().filter((g) => !g.mine && g.console && g.id !== FIELD.id)
  const found = ready
    ? find(pool, query, (g) => {
        const tab = tabOf(g)
        return [g.title, tr(g.title, S.lang), g.genre && genreLabel(g.genre), g.genre, tab && tab.title, tab && tr(tab.title, S.lang)]
      })
    : []
  const channels = [...S.tw.channels, ...S.tw.catalog.filter((c) => !S.tw.channels.some((x) => x.login === c.login))]
  const live = ready ? find(channels, query, (c) => [S.tw.info[c.login]?.name ?? c.name, c.login]) : []
  const shown = found.slice(0, FIND_LIMIT)
  // Канал: имя — кнопкой, ниже — в эфире ли он. Имена — как на Twitch, без перевода
  const liveTiles = live.flatMap((c) => {
    const info = S.tw.info[c.login] ?? (S.tw.catalog.includes(c) ? c : null)
    const status = tr(liveStatus(info, S.tw.missing.has(c.login), S.lang) || 'канал Twitch', S.lang)
    return [keep(Button({ key: `arcade-tw-find-${c.login}`, label: info?.name ?? c.name, onPress: () => watchLive(c.login) })), keep(dim(`  ${status}`))]
  })
  const set = (value) => {
    finder.query = value
    $.ui.invalidate('ui.render')
  }
  return [
    back,
    gap,
    Input({ key: `arcade-search-${finder.field}`, label: 'Найти', placeholder: 'название или жанр', value: finder.seed, autoFocus: true, onInput: set, onSubmit: set }),
    dim(
      !ready
        ? 'От двух букв: название или жанр. Ищу в играх и каналах Twitch.'
        : found.length || live.length
          ? `найдено: ${found.length + live.length}`
          : 'Ничего не нашлось — попробуй другое слово.',
    ),
    ...byGenre(shown, null),
    ...(found.length > shown.length ? [gap, dim(`Показаны первые ${FIND_LIMIT} — уточни запрос.`)] : []),
    ...(liveTiles.length ? [section('Twitch'), desktop ? tiles(liveTiles, 44) : Box({ flexDirection: 'column', children: liveTiles })] : []),
    ...noticeLines,
    ...hint,
  ]
}

// Избранное: всё отмеченное ☆ или только в группе («Игры») и на полке книг. Сначала — отмеченное последним
export function favoritesScreen($, e, kit) {
  const { Button, back, byGenre, dim, gap, hint, noticeLines, open } = kit
  const scopeId = S.menu.slice(10)
  const scope = favoritesScope(scopeId)
  const list = favoriteGames()
    .filter((g) => !scope || scope.has(g))
    .reverse()
  const focusId = list.some((g) => g.id === S.lastGame) ? S.lastGame : list[0]?.id
  return [
    scope ? Button({ key: 'arcade-back', label: '← Назад', onPress: open(scopeId) }) : back,
    gap,
    ...(list.length ? byGenre(list, focusId) : [dim('Пока пусто. Отмечай звёздочкой ☆ игры — они соберутся здесь.')]),
    ...noticeLines,
    ...hint,
  ]
}

// Свои игры: файлы человека. Arcade их не раздаёт — копия лежит только у него, в ~/.claude/arcade
export function mineScreen($, e, kit) {
  const { Box, Button, Input, Text, back, dim, gameButton, gap, hint, noticeLines } = kit
  const remove = (m) =>
    Button({
      key: `arcade-mine-remove-${m.id}`,
      label: 'Удалить',
      onPress: async () => {
        S.mine = S.mine.filter((x) => x.id !== m.id)
        await $.store.set('mine', S.mine)
        await $.fs.write(mineFile(m.sha256), '').catch(() => {}) // удалять файлы мод не умеет — стираем содержимое
        S.libraryNotice = `Удалено: ${m.title}.`
        $.ui.invalidate('ui.render')
      },
    })
  return [
    back,
    gap,
    ...(S.mine.length
      ? S.mine.flatMap((m, i) => {
          const g = gameById(m.id)
          return [Box({ flexDirection: 'row', columnGap: 2, children: [gameButton(g, i === 0), remove(m)] }), dim(`  ${g.note}`)]
        })
      : [Text({ children: ['Пока пусто. Добавь файл игры для Денди (.nes) или Sega Mega Drive (.md, .bin).'] })]),
    gap,
    Input({
      key: 'arcade-mine-path',
      label: 'Добавить файл',
      placeholder: 'путь к .nes, .md или .bin',
      onSubmit: async (value) => {
        S.libraryNotice = await addMine($, value)
        $.ui.invalidate('ui.render')
      },
    }),
    dim('  или командой /arcade-add путь — в терминал файл можно просто перетащить после команды'),
    dim('  Файл остаётся у тебя: мод хранит копию в ~/.claude/arcade и никуда её не отправляет.'),
    dim('  Подключай только файлы, на которые у тебя есть права.'),
    ...noticeLines,
    ...hint,
  ]
}

// Вкладка группы («Игры»): полки с играми
export function groupScreen($, e, kit) {
  const { Button, back, desktop, dim, gap, hint, noticeLines, open, tiles } = kit
  const group = groupsList().find((x) => x.id === S.menu)
  const shelvesHere = shelvesList().filter((s) => shelfGames(s.id).some((g) => groupConsoles(group.id).includes(g.console)))
  const favHere = favoriteGames().filter((g) => groupConsoles(group.id).includes(g.console)).length
  const shelfItems = [
    Button({ key: `arcade-menu-favorites-${group.id}`, label: '★ Избранное', ...(S.menuFrom === `favorites:${group.id}` ? { autoFocus: true } : {}), onPress: open(`favorites:${group.id}`) }),
    dim(favHere ? `  отмечено: ${favHere}` : '  отмечай ☆ — соберётся здесь'),
    ...shelvesHere.flatMap((s, i) => {
    const n = shelfGames(s.id).length
    return [
      Button({ key: `arcade-menu-shelf-${s.id}`, label: s.title, ...((S.menuFrom ? S.menuFrom === `shelf:${s.id}` : i === 0) ? { autoFocus: true } : {}), onPress: open(`shelf:${s.id}`) }),
      dim(`  ${n} ${plural(n, 'игра', 'игры', 'игр')}`),
    ]
  }),
  ]
  // В Desktop полки — плитками с иконкой жанра, как разделы главного меню
  return [
    back,
    gap,
    ...(desktop ? [tiles(shelfItems)] : shelfItems),
    ...noticeLines,
    ...hint,
  ]
}

export function shelfScreen($, e, kit) {
  const { Button, Text, back, dim, gameRows, gap, hint, noticeLines, open } = kit
  const shelf = shelfView(S.menu)
  const c = shelf ?? consoles().find((x) => x.id === S.menu) ?? consoles()[0]
  const list = shelf ? shelf.list : games().filter((g) => g.console === c.id && !g.mine)
  const focusId = list.some((g) => g.id === S.lastGame) ? S.lastGame : list[0]?.id
  const builtin = builtinBrowser(e.surface, list.some((g) => mouseGame(g.id)))
  const own = c.id === 'nes' || (list.length > 0 && list.every((g) => g.engine)) // Денди и свои игры (Flappy Arcade) — в панели
  return [
    shelf ? Button({ key: 'arcade-back', label: '← Назад', onPress: open(shelf.group) }) : back,
    gap,
    ...(list.length
      ? gameRows(list, focusId)
      : [Text({ children: [c.empty ?? c.soon ?? 'Здесь пока нет игр.'] })]),
    // Всё, кроме Денди и своих игр (Flappy Arcade), идёт только в окне браузера: там и свои файлы — кнопкой «Открыть свой файл»
    ...(!own
      ? S.platform || e.surface === 'desktop'
        ? [
            gap,
            Button({
              key: `arcade-open-tab-${shelf ? shelf.id.replace('shelf:', 'shelf-') : c.id}`,
              label: `Открыть ${c.title} в окне`,
              ...(!list.length ? { autoFocus: true } : {}),
              onPress: async () => {
                if (builtin) return desktopWindow($, `tab:${shelf ? shelf.tab : c.id}`, `Окно Arcade открыто на вкладке ${c.title}.`)
                const command = windowCommand(`tab:${shelf ? shelf.tab : c.id}`)
                try {
                  const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                  windowNotice($, result?.exitCode === 0 ? `Окно Arcade открыто на вкладке ${c.title}.` : launchNotice(result, null))
                  if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
                } catch (err) {
                  S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
                }
                $.ui.invalidate('ui.render')
              },
            }),
          ]
        : [gap, dim(`${c.title} идёт в окне браузера, а здесь его открыть нельзя.`)]
      : []),
    ...(list.length
      ? [gap, dim(`Игры открываются ${builtin && !own ? 'во встроенном браузере Claude' : opensWindow(e.surface) || (e.surface === 'desktop' && !own) ? whereText() : 'здесь, в панели'}.`)]
      : []),
    // Шутеры в Desktop идут окном и при выбранном встроенном браузере — объясняем почему
    ...(list.length && !builtin && builtinBrowser(e.surface)
      ? [dim(MOUSE_NOTE)]
      : []),
    ...noticeLines,
    ...hint,
  ]
}

// ━━━━━━━━━━ screens/settings ━━━━━━━━━━
// Arcade: экраны языка и настроек.

// Выбор языка: плитки, как остальное меню, в Desktop — с флажком; каждый язык подписан на самом себе, текущий
// отмечен
export function langScreen($, e, kit) {
  const { Button, gap, hint, open, tiles } = kit
  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open(S.langReturn) }),
    gap,
    tiles(
      LANGS.map((code) =>
        Button({
          key: `arcade-lang-${code}`,
          label: `${LANG_NAMES[code]}${code === S.lang ? ' ✓' : ''}`,
          ...(code === S.lang ? { autoFocus: true } : {}),
          onPress: async () => {
            S.lang = code
            S.menu = S.langReturn
            $.ui.invalidate('ui.render')
            await saveSetting($, 'lang', S.lang)
            await followBookLang($)
          },
        }),
      ),
      22,
    ),
    ...hint,
  ]
}

// Условия использования и политика конфиденциальности — страницы сайта в браузере по умолчанию; браузер не открылся
// (или его не открыть, как в VS Code без системы) — адрес строкой под настройками
export async function openLegal($, page) {
  const url = `${SITE}/${page}`
  const command = S.platform ? openUrlCommand(S.platform, url) : null
  let opened = false
  if (command) {
    try {
      opened = (await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS }))?.exitCode === 0
    } catch {
      // не открылся — покажем адрес
    }
  }
  S.libraryNotice = opened ? 'Страница открыта в браузере.' : url
  $.ui.invalidate('ui.render')
}

export function settingsScreen($, e, kit) {
  const { Button, back, dim, gameButton, gap, hint, noticeLines, open, section, sectionSwitches, tiles } = kit
  const field = FIELD
  // Настройки — плитками по группам, как главное меню. Фокус — на первой плитке, а вернулись с выбора языка — на «Язык»
  const focusKey = S.menuFrom === 'lang' || S.menuFrom === 'settings' ? 'arcade-lang' : `arcade-show-${HIDEABLE[0]}`
  const focus = (key) => (key === focusKey ? { autoFocus: true } : {})
  const group = (title, list, after = []) => (list.length ? [section(title), tiles(list, 40), ...after] : [])
  const sectionTiles = sectionSwitches(focus)
  // Desktop: встроенный браузер приложения или окно браузера; Денди там всегда в панели, графика — картинкой
  const openTiles = [
    ...(e.surface === 'desktop' && S.platform
      ? [
          Button({
            key: 'arcade-opener',
            label: desktopLabel(),
            onPress: async () => {
              const options = desktopOptions()
              const current = options.findIndex((o) =>
                builtinBrowser(e.surface) ? o.opener === 'builtin' : o.opener === 'window' && o.browser === S.browserChoice,
              )
              const nextOption = options[(current + 1) % options.length]
              S.desktopOpener = nextOption.opener
              S.browserChoice = nextOption.browser
              S.libraryNotice = ''
              $.ui.invalidate('ui.render')
              await $.store.set('desktopOpener', S.desktopOpener)
              await $.store.set('opener', { opener: S.opener, browser: S.browserChoice })
            },
          }),
          dim(
            builtinBrowser(e.surface)
              ? '  рядом с разговором; в авто-режиме игру открывает Claude — он прервётся и вернётся к работе'
              : '  игра откроется в браузере; пауза, пока окно не в фокусе; прогресс сохраняется',
          ),
        ]
      : []),
    // Desktop сам ставит встроенный браузер под панель Arcade: рядом их не поставить, поэтому — закрыть или оставить
    ...(builtinBrowser(e.surface)
      ? [
          Button({
            key: 'arcade-keep-menu',
            label: `Когда открывается браузер: ${S.keepMenu ? 'оставлять меню' : 'закрывать меню'}`,
            onPress: async () => {
              S.keepMenu = !S.keepMenu
              $.ui.invalidate('ui.render')
              await saveSetting($, 'keepMenu', S.keepMenu)
            },
          }),
          dim('  закрывать — браузер во всю высоту; оставлять — браузер встаёт под меню Arcade'),
          Button({
            key: 'arcade-back-on-done',
            label: `Агент закончил, пока смотришь: ${S.backOnDone ? 'закрыть вкладку' : 'только сообщить'}`,
            onPress: async () => {
              S.backOnDone = !S.backOnDone
              S.watchTab = null
              $.ui.invalidate('ui.render')
              await saveSetting($, 'backOnDone', S.backOnDone)
            },
          }),
          dim('  видео, TikTok, Twitch, статьи и подкасты; закрыть — вкладка закрывается, и перед тобой снова разговор с Claude'),
        ]
      : []),
    ...(e.surface !== 'desktop' && S.platform
      ? [
          Button({
            key: 'arcade-opener',
            label: openerLabel(),
            onPress: async () => {
              const options = openerOptions()
              const current = options.findIndex((o) =>
                windowMode() ? o.opener === 'window' && o.browser === S.browserChoice : o.opener === 'pane',
              )
              const nextOption = options[(current + 1) % options.length]
              S.opener = nextOption.opener
              S.browserChoice = nextOption.browser
              S.libraryNotice = ''
              $.ui.invalidate('ui.render')
              await $.store.set('opener', { opener: S.opener, browser: S.browserChoice })
            },
          }),
          dim(
            !windowMode()
              ? '  символы или пиксели — зависит от терминала'
              : S.platform === 'windows'
                ? '  окно встаёт справа от терминала; пауза, пока оно не в фокусе; прогресс сохраняется'
                : '  игра откроется в браузере; пауза, пока окно не в фокусе; прогресс сохраняется',
          ),
        ]
      : []),
    ...(windowMode() || e.surface === 'desktop'
      ? []
      : [
          Button({
            key: 'arcade-graphics',
            label: graphicsLabel(),
            onPress: async () => {
              S.graphics = GRAPHICS[(GRAPHICS.indexOf(S.graphics) + 1) % GRAPHICS.length]
              S.pixelsFailed = false // «авто» заново проверит, умеет ли терминал картинки
              S.denies = 0
              $.ui.invalidate('ui.render')
              await $.store.set('graphics', S.graphics)
            },
          }),
          dim('  пиксели — в терминалах с картинками (kitty, Ghostty, Rio), символы — везде'),
        ]),
  ]
  const paneTiles = [
    Button({
      key: 'arcade-lang',
      label: `Язык: ${LANG_NAMES[S.lang] ?? S.lang}`,
      ...focus('arcade-lang'),
      onPress: () => {
        S.langReturn = 'settings'
        open('lang')()
      },
    }),
    dim('  язык интерфейса — 13 на выбор'),
    Button({
      key: 'arcade-wide',
      label: `Размер панели: ${S.wide ? 'во всю ширину' : 'обычный'}`,
      onPress: async () => {
        S.wide = !S.wide
        $.ui.invalidate('ui.render')
        await saveSetting($, 'wide', S.wide)
        // Панель уже открыта — просим новую ширину сразу
        await $.ui.open({ id: PANE, title: 'Arcade', focus: true, closeOnEscape: true, columns: paneColumns(), rows: PANE_ROWS })
      },
    }),
    dim('  во всю ширину разговор с агентом сжимается в узкую полосу; поправить ширину можно мышью'),
  ]
  // Сигналы агента: у каждой плитки своё описание — плитка берёт только описание сразу под кнопкой
  const signalNote = '  для игры в панели Claude; в окне браузера — системное уведомление'
  const notifyTiles = [
    // Строка «сыграть?» над полем ввода: через сколько работы агента — или не показывать совсем
    Button({
      key: 'arcade-ask-after',
      label: `Строка «сыграть?»: ${S.askAfter ? `через ${workedText(S.askAfter)}` : 'выключена'}`,
      onPress: async () => {
        S.askAfter = ASK_AFTER_CHOICES[(ASK_AFTER_CHOICES.indexOf(S.askAfter) + 1) % ASK_AFTER_CHOICES.length]
        $.ui.invalidate('ui.render')
        await saveSetting($, 'askAfter', S.askAfter)
      },
    }),
    dim('  над полем ввода, когда агент работает дольше этого; выключена — Arcade открывается командой /arcade'),
    // Отложили по «Не сейчас» — до какого времени или до перезапуска Claude; нажатие возвращает строку сразу
    ...(S.askAfter && laterUntil(kit.now)
      ? [
          Button({
            key: 'arcade-ask-later-off',
            label:
              laterUntil(kit.now) === Infinity
                ? 'Строка «сыграть?» отложена до перезапуска Claude — вернуть'
                : `Строка «сыграть?» отложена до ${hhmm(laterUntil(kit.now))} — вернуть`,
            onPress: async () => {
              await laterClear($)
              $.ui.invalidate('ui.render')
            },
          }),
          dim('  отложили кнопкой «Не сейчас»; отсрочка общая для всех сессий на этом компьютере'),
        ]
      : []),
    Button({
      key: 'arcade-on-done',
      label: `Когда агент закончил: ${SIGNAL_LABELS[S.onDone]}`,
      onPress: async () => {
        S.onDone = SIGNAL_MODES[(SIGNAL_MODES.indexOf(S.onDone) + 1) % SIGNAL_MODES.length]
        $.ui.invalidate('ui.render')
        await saveSetting($, 'onDone', S.onDone)
      },
    }),
    dim(signalNote),
    Button({
      key: 'arcade-on-permission',
      label: `Когда агент ждёт разрешения: ${SIGNAL_LABELS[S.onPermission]}`,
      onPress: async () => {
        S.onPermission = SIGNAL_MODES[(SIGNAL_MODES.indexOf(S.onPermission) + 1) % SIGNAL_MODES.length]
        $.ui.invalidate('ui.render')
        await saveSetting($, 'onPermission', S.onPermission)
      },
    }),
    dim(signalNote),
    ...(S.platform
      ? [
          Button({
            key: 'arcade-notify',
            label: `Уведомления, пока играешь в окне: ${S.osNotify ? 'да' : 'нет'}`,
            onPress: async () => {
              S.osNotify = !S.osNotify
              $.ui.invalidate('ui.render')
              await saveSetting($, 'notify', S.osNotify)
            },
          }),
          dim('  системное уведомление со звуком, когда агент закончил или ждёт разрешения'),
          Button({
            key: 'arcade-msg-notify',
            label: `Уведомления о сообщениях: ${S.msgNotify ? 'да' : 'нет'}`,
            onPress: async () => {
              S.msgNotify = !S.msgNotify
              $.ui.invalidate('ui.render')
              await $.store.set('msgNotify', S.msgNotify)
            },
          }),
          dim(S.platform === 'windows' ? '  всплывают внизу слева поверх всех окон; клик открывает чат' : '  системное уведомление, когда друг пишет в чат'),
        ]
      : []),
    // Сессии Claude Code на этом компьютере (вкладка «Агенты»): о другой — всплывашка в этой панели; о любой, и о
    // своей тоже, — системное уведомление со звуком (alerts.js), если оно включено ниже
    Button({
      key: 'arcade-agents-notify',
      label: `Сессия ждёт разрешения или ответа: ${S.agNotify ? 'да' : 'нет'}`,
      onPress: async () => {
        S.agNotify = !S.agNotify
        $.ui.invalidate('ui.render')
        await $.store.set('agentsNotify', S.agNotify)
      },
    }),
    dim('  о другой сессии — всплывашка в панели Arcade; о любой — системное уведомление'),
    Button({
      key: 'arcade-agents-done',
      label: `Сессия закончила ход: ${S.agDone ? 'да' : 'нет'}`,
      onPress: async () => {
        S.agDone = !S.agDone
        $.ui.invalidate('ui.render')
        await $.store.set('agentsDone', S.agDone)
      },
    }),
    dim('  то же, когда Claude закончил ход'),
    ...(S.platform
      ? [
          Button({
            key: 'arcade-agents-os',
            label: `Системное уведомление о сессиях: ${S.agOs ? 'да' : 'нет'}`,
            onPress: async () => {
              S.agOs = !S.agOs
              if (!S.agOs) S.al.pending.clear()
              $.ui.invalidate('ui.render')
              await $.store.set('agentsOs', S.agOs)
            },
          }),
          dim(S.platform === 'windows' ? '  поверх всех окон, даже когда Claude Code свёрнут; клик поднимает окно' : '  уведомление системы, даже когда Claude Code свёрнут'),
          Button({
            key: 'arcade-agents-sound',
            label: `Звук уведомления о сессиях: ${S.agSound ? 'да' : 'нет'}`,
            onPress: async () => {
              S.agSound = !S.agSound
              $.ui.invalidate('ui.render')
              await $.store.set('agentsSound', S.agSound)
            },
          }),
          dim('  «ждёт тебя» и «закончил» звучат по-разному'),
        ]
      : []),
    // Окно лимита Claude дошло до 80 и 90% (плитка «Лимиты»): о каждом пороге — раз во всех сессиях
    Button({
      key: 'arcade-usage-warn',
      label: `Лимит Claude на 80 и 90%: ${S.us.warn ? 'да' : 'нет'}`,
      onPress: async () => {
        S.us.warn = !S.us.warn
        $.ui.invalidate('ui.render')
        await $.store.set('usageWarn', S.us.warn)
      },
    }),
    dim('  всплывашка в панели Arcade, без звука'),
  ]
  // Проверка и назначение клавиш — только в терминале: в VS Code клавиши идут через строку 🎮, в Desktop поля нет
  const keyTiles =
    e.surface === 'terminal'
      ? [
          gameButton(field, false),
          dim(`  ${field.note}`),
          Button({
            key: 'arcade-assign',
            label: 'Назначить клавиши заново',
            onPress: () => {
              launch('field')
              startAssign('Назначаем управление заново.')
              $.ui.invalidate('ui.render')
            },
          }),
          dim('  мод попросит нажать клавиши по очереди: вверх, вниз, влево, вправо, A, B, Start, Select'),
        ]
      : []
  // Правила сайта Arcade — в самом конце настроек, чтобы не мешали; их требуют правила YouTube API Services
  const legalTiles = [
    Button({ key: 'arcade-terms', label: 'Условия использования', onPress: () => openLegal($, 'terms') }),
    dim('  правила Arcade и условия YouTube'),
    Button({ key: 'arcade-privacy', label: 'Политика конфиденциальности', onPress: () => openLegal($, 'privacy') }),
    dim('  что хранит сайт Arcade, сколько и как это удалить'),
  ]
  return [
    back,
    ...group('Разделы главного меню', sectionTiles),
    dim('Убранного раздела нет в главном меню совсем; «Ещё» с настройками остаётся всегда.'),
    // Подсказка про мышь — строкой под плитками: у плитки одно описание
    ...group('Где открывать', openTiles, builtinBrowser(e.surface) ? [gap, dim(MOUSE_NOTE)] : []),
    ...group('Панель и язык', paneTiles),
    ...group('Уведомления', notifyTiles),
    ...group('Клавиши', keyTiles),
    // Свои инструменты Arcade не разрешает: проходят обычную проверку Claude Code. Как не спрашивать — только подсказка,
    // настройку пишет сам человек
    section('Разрешения Claude Code'),
    dim('Claude Code может спросить, прежде чем Claude воспользуется блокнотом или календарём Arcade.'),
    dim('Чтобы не спрашивал, добавь mcp__arcade__notes и mcp__arcade__calendar в permissions.allow в ~/.claude/settings.json. Сам Arcade эту настройку не пишет.'),
    ...group('Условия и конфиденциальность', legalTiles),
    ...noticeLines,
    ...hint,
  ]
}

// ━━━━━━━━━━ screens/profile ━━━━━━━━━━
// Arcade: экраны аккаунта и отчётов.

// Аккаунт: вошли — кто и что общее; идёт вход — код для сверки со страницей сайта или код для GitHub; иначе — зачем
// вход и что Arcade узнает
export function accountScreen($, e, kit) {
  const { Box, Button, Input, Svg, Text, back, desktop, dim, gap, hint, noticeLines, picGrid, pictures, section, tiles } = kit
  let items
  const flow = S.acct.flow
  const note = S.acct.note ? [Text({ color: 'warning', children: [S.acct.note] })] : []
  if (S.acct.session) {
    // Ника нет, а имя на GitHub подходит под правила — его можно взять одной кнопкой
    const take = S.acct.handle ? '' : suggestHandle(S.acct.session.user.login)
    items = [
      back,
      gap,
      keep(Text({ bold: true, children: [`GitHub: @${S.acct.session.user.login}`] })),
      Text({ children: [S.acct.handle ? `Твой ник: @${S.acct.handle}` : 'Ника пока нет.'] }),
      dim('Ник видят соперники в сетевых партиях настольных игр. Сменить его можно когда угодно.'),
      ...(take ? [Button({ key: 'arcade-account-take', label: `Взять @${take}`, onPress: () => claimHandle($, take) })] : []),
      Input({ key: 'arcade-account-handle', label: S.acct.handle ? 'Сменить ник' : 'Свой ник', placeholder: 'латинские буквы, цифры и _, от 4 до 32 знаков', onSubmit: (value) => claimHandle($, value) }),
      ...(S.acct.naming ? [dim('Проверяю ник…')] : S.acct.handleNote ? [Text({ color: 'warning', children: [S.acct.handleNote] })] : []),
      // Дальше — группы под заголовками, как в настройках. В Desktop отступ сверху даёт сам заголовок
      ...(desktop ? [] : [gap]),
      section('Аватарка'),
      // Аватарку выбирают только здесь; чаты на сайте, в Desktop, VS Code и терминале её только показывают.
      // Нынешняя — крупно, ниже с отступом — выбор
      Box({
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 'sm',
        marginBottom: pictures ? 'md' : 1,
        children: [
          ...(pictures ? [Svg({ source: picSvg(S.acct.pic, S.acct.handle || '?', S.acct.handle || '?'), alt: 'Аватарка', width: 56, height: 56 })] : []),
          Box({ flexDirection: 'column', flexShrink: 1, minWidth: 0, children: [dim('Её видят друзья в чатах. Без неё — первая буква ника.')] }),
        ],
      }),
      picGrid('arcade-avatar', S.acct.pic, (n) => pickAvatar($, n), 'Без аватарки', picSvg(null, S.acct.handle || '?', S.acct.handle || '?')),
      ...(S.acct.picking ? [dim('Сохраняю аватарку…')] : S.acct.picNote ? [Text({ color: 'warning', children: [S.acct.picNote] })] : []),
      ...(desktop ? [] : [gap]),
      section('Синхронизация и вход'),
      dim('Общие для всех компьютеров: язык, клавиши, уведомления, размер панели, что делать с игрой по сигналу агента, свои темы, каналы Twitch и рекорд Flappy Arcade.'),
      ...note,
      // Действия — плитками, как везде; у синхронизации в описании — как она прошла
      tiles(
        [
          Button({ key: 'arcade-account-sync', label: 'Синхронизировать сейчас', autoFocus: true, onPress: () => syncAccount($) }),
          dim(S.acct.syncing ? 'Синхронизирую…' : S.acct.syncedAt ? 'Настройки синхронизированы.' : 'Настройки ещё не синхронизированы.'),
          Button({ key: 'arcade-account-logout', label: 'Выйти', onPress: () => logout($) }),
          dim('  на этом компьютере; настройки останутся здесь как есть'),
          Button({ key: 'arcade-account-delete', label: S.acct.confirmDelete ? 'Точно удалить? Нажми ещё раз' : 'Удалить аккаунт', onPress: () => deleteAccount($) }),
          dim('  сайт Arcade забудет тебя и твои настройки; здесь всё останется'),
        ],
        40,
      ),
      ...noticeLines,
      ...hint,
    ]
  } else if (flow?.web) {
    // Вход кнопкой: страница открылась в браузере сама; код здесь — чтобы сверить его со страницей сайта
    items = [
      back,
      gap,
      Text({ children: ['Страница входа открылась в браузере: подтверди вход на GitHub, потом нажми «Войти» на странице Arcade.'] }),
      dim('Код на странице должен быть таким же:'),
      keep(desktop ? Text({ size: 'heading', weight: 'semibold', children: [flow.mark] }) : Text({ bold: true, children: [`  ${flow.mark}`] })),
      gap,
      Button({ key: 'arcade-account-github', label: 'Открыть страницу ещё раз', autoFocus: true, onPress: () => openGithub($, flow.url) }),
      dim('  если браузер не открылся или вкладку закрыли'),
      keep(dim(`  ${flow.url}`)),
      Button({ key: 'arcade-account-code', label: 'Войти по коду', onPress: () => startLogin($, true) }),
      dim('  если через браузер войти не выходит'),
      gap,
      ...(note.length ? note : [dim('Жду, когда ты войдёшь в браузере…')]),
      Button({ key: 'arcade-account-cancel', label: 'Отмена', onPress: () => cancelLogin($) }),
      ...noticeLines,
      ...hint,
    ]
  } else if (flow) {
    items = [
      back,
      gap,
      Text({ children: ['Введи этот код на странице GitHub:'] }),
      keep(desktop ? Text({ size: 'heading', weight: 'semibold', children: [flow.code] }) : Text({ bold: true, children: [`  ${flow.code}`] })),
      gap,
      Button({ key: 'arcade-account-github', label: 'Открыть страницу GitHub', autoFocus: true, onPress: () => openGithub($, flow.url) }),
      keep(dim(`  ${flow.url}`)),
      dim('  страница откроется в обычном браузере; после кода GitHub спросит, пустить ли Agent Arcade'),
      gap,
      ...(note.length ? note : [dim('Жду, когда ты подтвердишь вход на GitHub…')]),
      Button({ key: 'arcade-account-cancel', label: 'Отмена', onPress: () => cancelLogin($) }),
      ...noticeLines,
      ...hint,
    ]
  } else {
    items = [
      back,
      gap,
      dim('Вход нужен, чтобы настройки были одни на всех твоих компьютерах и чтобы взять свой @ник для сетевых игр. Без входа всё работает.'),
      dim('Arcade узнаёт только имя и картинку профиля GitHub — ни почты, ни доступа к репозиториям.'),
      ...note,
      gap,
      Button({ key: 'arcade-account-login', label: S.acct.starting ? 'Готовлю вход…' : 'Войти через GitHub', autoFocus: true, onPress: () => startLogin($) }),
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}

// Отчёт об ошибке: что сломалось — словами. Читает его только автор Arcade; к тексту — версия, где открыт Arcade,
// язык и система. Со входом отчёт подписан аккаунтом, без входа — без подписи
export function reportScreen($, e, kit) {
  const { Input, Text, back, dim, gap, hint, noticeLines } = kit
  const note = S.rp.note ? [S.rp.bad ? Text({ color: 'warning', children: [S.rp.note] }) : dim(S.rp.note)] : []
  return [
    back,
    gap,
    Text({ children: ['Что сломалось? Опиши, что ты делал и что пошло не так.'] }),
    dim('Отчёты читает только автор Arcade. Не пиши пароли, ключи и личные данные.'),
    gap,
    Input({
      key: `arcade-report-text-${S.rp.field}`,
      label: 'Отчёт',
      placeholder: 'например: шашки зависают после хода дамкой',
      rows: 4,
      autoFocus: true,
      submitLabel: tr('Отправить', S.lang),
      onSubmit: (value) => sendReport($, value, e.surface),
    }),
    ...(S.rp.sending ? [dim('Отправляю отчёт…')] : note),
    gap,
    dim('К отчёту приложится версия Arcade, где он открыт, язык интерфейса и система — больше ничего.'),
    dim(S.acct.session ? 'Со входом через GitHub отчёт подписан твоим аккаунтом.' : 'Без входа отчёт уйдёт без подписи.'),
    ...noticeLines,
    ...hint,
  ]
}

// Отчёты об ошибках — только у админа: открытые, новые сверху. Текст отчёта и подпись — как есть (keep)
export function reportsScreen($, e, kit) {
  const { Box, Button, Text, back, dim, gap, hint, noticeLines, now } = kit
  const note = S.rp.listNote ? [S.rp.listBad ? Text({ color: 'warning', children: [S.rp.listNote] }) : dim(S.rp.listNote)] : []
  const list = S.rp.list ?? []
  const signed = (r) => (r.from ? keep(dim(r.from.handle ? `@${r.from.handle}` : `GitHub #${r.from.id}`)) : dim('без подписи'))
  const about = (r) => keep(dim([`#${r.id}`, when(r.at, now), r.version, r.surface, r.lang, r.os].filter(Boolean).join(' · ')))
  const entry = (r, k) => [
    gap,
    keep(Text({ children: [r.text] })),
    Box({
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 2,
      children: [
        about(r),
        signed(r),
        Button({ key: `arcade-report-close-${r.id}`, label: S.rp.busy === r.id ? 'Закрываю…' : 'Закрыть', ...(k === 0 ? { autoFocus: true } : {}), onPress: () => closeReport($, r.id) }),
      ],
    }),
  ]
  return S.acct.role === 'admin'
      ? [
          back,
          gap,
          ...(list.length ? [Text({ children: [`Открытых отчётов: ${S.rp.open}`] })] : []),
          dim('Закрытый отчёт сайт удаляет. Здесь — последние 50, новые сверху.'),
          ...note,
          ...(list.length ? list.flatMap(entry) : [gap, dim(S.rp.list ? 'Открытых отчётов нет.' : S.rp.loading ? 'Загружаю отчёты…' : 'Список отчётов не загрузился.')]),
          gap,
          Button({ key: 'arcade-reports-refresh', label: S.rp.loading ? 'Обновляю…' : 'Обновить', ...(list.length ? {} : { autoFocus: true }), onPress: () => loadReports($) }),
          ...noticeLines,
          ...hint,
        ]
      : [back, gap, Text({ color: 'warning', children: [reportNote('admin')] }), ...noticeLines, ...hint]
}

// ━━━━━━━━━━ screens/friends ━━━━━━━━━━
// Arcade: экраны друзей и приглашения.

// Во что позвать друга: настольные — в новую комнату на двоих, Doom — в лобби игры. Игра откроется и у тебя
export function inviteScreen($, e, kit) {
  const { Button, Text, dim, gap, hint, noticeLines, open, tiles } = kit
  const to = S.ol.to
  const kindNote = (g) => (g.kind === 'board' ? '  своя комната на двоих' : g.net === 'doom' || g.net === 'heretic-dm' ? '  общее лобби deathmatch' : '  кооператив: лобби игры')
  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open('friends') }),
    gap,
    Text({ children: [`Во что позвать @${to.handle}?`] }),
    dim(`Друг увидит приглашение в Arcade, когда меню открыто, — оно действует ${INVITE_MINUTES} минут. Игра откроется и у тебя.`),
    gap,
    tiles(inviteGames().flatMap((g, k) => [Button({ key: `arcade-inv-game-${g.id}`, label: g.title, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => inviteFriend($, e.surface, to, g.id) }), dim(kindNote(g))])),
    ...(S.ol.busy ? [gap, dim('Зову…')] : S.ol.note ? [gap, S.ol.bad ? Text({ color: 'warning', children: [S.ol.note] }) : dim(S.ol.note)] : []),
    ...noticeLines,
    ...hint,
  ]
}

// Друзья: взаимные заявки по точному @нику. Без входа и без ника — что сделать сначала
export function friendsScreen($, e, kit) {
  const { Box, Button, Input, Text, back, desktop, dim, gap, hint, inviteRows, noticeLines, open, section, windowed } = kit
  let items
  const login = Button({
    key: 'arcade-friends-login',
    label: S.acct.starting ? 'Готовлю вход…' : 'Войти через GitHub',
    autoFocus: true,
    onPress: () => {
      S.acct.confirmDelete = false
      open('account')()
      startLogin($)
    },
  })
  const note = S.fr.note ? [S.fr.bad ? Text({ color: 'warning', children: [S.fr.note] }) : dim(S.fr.note)] : []
  const person = (p) => keep(Text({ children: [`@${p.handle}`] }))
  const row = (children) => Box({ flexDirection: 'row', columnGap: 2, children })
  // В Desktop кнопки в рамках друг под другом слипаются: строки — столбиком с промежутком, действия — рядом
  const stack = (key, list) => (desktop ? [Box({ key, flexDirection: 'column', rowGap: 'sm', children: list })] : list)
  const actions = (key, list) => (desktop ? [Box({ key, flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: 'sm', children: list })] : list)
  if (!S.acct.session) {
    items = [
      back,
      gap,
      dim('Друзья в Arcade — по @нику: отправь заявку, друг примет её у себя, и вы появитесь в списках друг у друга.'),
      Text({ children: ['Чтобы список друзей был доступен, войди через GitHub.'] }),
      dim('Arcade узнаёт только имя и картинку профиля GitHub — ни почты, ни доступа к репозиториям.'),
      // Вход только что пропал (сайт его не принял) — почему
      ...(S.acct.note ? [gap, Text({ color: 'warning', children: [S.acct.note] })] : []),
      gap,
      login,
      ...noticeLines,
      ...hint,
    ]
  } else if (!S.acct.handle && !S.acct.syncedAt) {
    // Сайт ещё не сказал, есть ли у человека ник
    items = [
      back,
      gap,
      ...(S.acct.syncing ? [dim('Спрашиваю сайт Arcade…')] : S.acct.note ? [Text({ color: 'warning', children: [S.acct.note] })] : []),
      gap,
      Button({ key: 'arcade-friends-sync', label: 'Обновить', autoFocus: true, onPress: () => syncAccount($) }),
      ...noticeLines,
      ...hint,
    ]
  } else if (!S.acct.handle) {
    items = [
      back,
      gap,
      Text({ children: ['Друзья находят друг друга по @нику — сначала возьми свой.'] }),
      dim('Ник видят друзья и соперники в сетевых партиях. Сменить его можно когда угодно — друзья останутся.'),
      gap,
      Button({ key: 'arcade-friends-handle', label: 'Взять @ник', autoFocus: true, onPress: open('account') }),
      ...noticeLines,
      ...hint,
    ]
  } else if (S.menu === 'friends:remove') {
    items = [
      Button({ key: 'arcade-back', label: '← Назад', onPress: open('friends') }),
      gap,
      dim('Кого удалить из друзей? Уведомления не будет; у друга ты тоже пропадёшь из списка.'),
      gap,
      ...stack(
        'fr-remove-list',
        (S.fr.list?.friends ?? []).map((p, k) =>
          keep(Button({ key: `arcade-fr-remove-${p.id}`, label: `@${p.handle}`, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => friendsCall($, 'unfriend', { id: p.id }, p.handle, `@${p.handle} больше не в друзьях.`) })),
        ),
      ),
      ...(note.length ? [gap, ...note] : []),
      ...hint,
    ]
  } else {
    const list = S.fr.list
    const friends = list?.friends ?? []
    const incoming = list?.incoming ?? []
    const outgoing = list?.outgoing ?? []
    const fromRemove = S.menuFrom === 'friends:remove'
    // Друзья — по одному в строке, кто в сети — сверху; «Позвать» — где есть окно браузера для сетевых игр
    const shown = [...friends].sort((a, b) => Number(S.ol.online.has(b.id)) - Number(S.ol.online.has(a.id)))
    const friendRow = (p) =>
      row([
        person(p),
        ...(S.ol.online.has(p.id) ? [Text({ color: 'success', children: ['в сети'] })] : []),
        ...(windowed
          ? [
              Button({
                key: `arcade-fr-invite-${p.id}`,
                label: 'Позвать',
                ...(S.menuFrom === 'friends:invite' && S.ol.to?.id === p.id ? { autoFocus: true } : {}),
                onPress: () => {
                  S.ol.to = p
                  S.ol.note = ''
                  S.ol.bad = false
                  open('friends:invite')()
                },
              }),
            ]
          : []),
      ])
    const olNote = S.ol.note ? [S.ol.bad ? Text({ color: 'warning', children: [S.ol.note] }) : dim(S.ol.note)] : []
    items = [
      back,
      gap,
      Text({ children: [`Твой ник: @${S.acct.handle}`] }),
      dim('Друзья добавляют тебя по нему, а ты их — по их @нику.'),
      gap,
      // В Desktop подпись слева сжимала поле, и подсказка в нём обрезалась: там она — в самом поле
      Input({
        key: 'arcade-friends-add',
        ...(desktop ? { placeholder: 'Добавить друга: @ник, точно как есть', submitLabel: tr('Добавить', S.lang) } : { label: 'Добавить друга', placeholder: '@ник друга, точно как есть' }),
        onSubmit: (value) => addFriend($, value),
      }),
      ...(S.fr.busy === 'friends' ? [dim('Отправляю заявку…')] : note.length ? note : [dim('Подсказок по буквам нет: заявка дойдёт, только если ник написан точно.')]),
      ...(S.ol.invites.length ? [section('Зовут сыграть'), ...S.ol.invites.flatMap((invite, k) => inviteRows(invite, k === 0 && !fromRemove))] : []),
      ...(incoming.length
        ? [
            section('Заявки тебе'),
            ...stack(
              'fr-incoming',
              incoming.map((p, k) =>
                row([
                  person(p),
                  Button({ key: `arcade-fr-accept-${p.id}`, label: 'Принять', ...(k === 0 && !fromRemove ? { autoFocus: true } : {}), onPress: () => friendsCall($, 'accept', { id: p.id }, p.handle, `Теперь вы с @${p.handle} друзья.`) }),
                  Button({ key: `arcade-fr-decline-${p.id}`, label: 'Отклонить', onPress: () => friendsCall($, 'unfriend', { id: p.id }, p.handle, `Заявка от @${p.handle} отклонена.`) }),
                ]),
              ),
            ),
          ]
        : []),
      section('Друзья'),
      ...(friends.length
        ? stack('fr-list', shown.map(friendRow))
        : [dim(list ? 'Друзей пока нет — добавь кого-нибудь по @нику.' : S.fr.loading ? 'Загружаю друзей…' : 'Список друзей не загрузился.')]),
      ...(olNote.length ? [gap, ...olNote] : []),
      ...(friends.length ? [gap, Button({ key: 'arcade-fr-remove', label: 'Удалить друга', ...(fromRemove ? { autoFocus: true } : {}), onPress: open('friends:remove') })] : []),
      ...(outgoing.length
        ? [
            section('Твои заявки'),
            ...stack(
              'fr-outgoing',
              outgoing.map((p) =>
                row([person(p), dim('ждёт ответа'), Button({ key: `arcade-fr-cancel-${p.id}`, label: 'Отменить', onPress: () => friendsCall($, 'unfriend', { id: p.id }, p.handle, `Заявка для @${p.handle} отменена.`) })]),
              ),
            ),
          ]
        : []),
      gap,
      ...actions('fr-actions', [
        // Прятаться можно: тогда друзья не видят тебя в сети, а ты их видишь
        Button({
          key: 'arcade-fr-hide',
          label: `Показывать друзьям, что я в сети: ${S.hideOnline ? 'нет' : 'да'}`,
          onPress: async () => {
            S.hideOnline = !S.hideOnline
            $.ui.invalidate('ui.render')
            await saveSetting($, 'hideOnline', S.hideOnline)
            pulseSoon($)
          },
        }),
        Button({ key: 'arcade-fr-refresh', label: S.fr.loading ? 'Обновляю…' : 'Обновить', onPress: () => friendsCall($, 'friends') }),
      ]),
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}

// ━━━━━━━━━━ screens/chats ━━━━━━━━━━
// Arcade: экран чатов.

// Чаты с друзьями: список, новый чат (с другом или группа), переписка и участники группы. Чужой текст —
// сообщения, ники, названия групп — не переводится (keep). Без входа и без ника — что сделать сначала
export function chatsScreen($, e, kit) {
  const { Box, Button, Input, Svg, Text, back, desktop, dim, gap, hint, noticeLines, now, open, picGrid, pictures, section } = kit
  let items
  const login = Button({
    key: 'arcade-chats-login',
    label: S.acct.starting ? 'Готовлю вход…' : 'Войти через GitHub',
    autoFocus: true,
    onPress: () => {
      S.acct.confirmDelete = false
      open('account')()
      startLogin($)
    },
  })
  const note = S.ch.note ? [S.ch.bad ? Text({ color: 'warning', children: [S.ch.note] }) : dim(S.ch.note)] : []
  const row = (children) => Box({ flexDirection: 'row', columnGap: 2, children })
  const wrapRow = (children) => Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, children })
  // Название чата или группы: в Desktop — заголовком
  const heading = (text) => keep(desktop ? Text({ size: 'heading', weight: 'semibold', children: [text] }) : Text({ bold: true, children: [text] }))
  const toList = Button({
    key: 'arcade-chats-back',
    label: '← Чаты',
    onPress: () => {
      S.ch.note = ''
      S.ch.bad = false
      S.ch.confirmLeave = false
      open('chats')()
      loadChats($, true).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    },
  })
  const pageButton = Button({ key: 'arcade-chats-page', label: S.ch.busy === 'page' ? 'Открываю…' : 'Открыть на странице', onPress: () => openChatPage($, e.surface) })
  const friends = S.fr.list?.friends ?? []
  // Чат как в Telegram: аватарки, «в сети», непрочитанные значком, своё справа, чужое слева, время и ✓, дни.
  // Картинки — везде, кроме терминала; там то же строение текстом
  const avatar = (source, alt, size) => Svg({ source, alt, width: size, height: size })
  const dot = () => Text({ color: 'success', children: ['●'] })
  const badge = (n) => keep(Text({ backgroundColor: 'suggestion', color: 'inverseText', weight: 'semibold', children: [` ${n} `] }))
  // Время в списке: сегодня — ЧЧ:ММ, вчера — «Вчера», раньше — дата
  const stamp = (at) => {
    const d = day(at, now)
    return d === 'Сегодня' ? clock(at) : tr(d, S.lang)
  }
  // Под названием чата: друг в сети; у группы — сколько участников и сколько из них в сети
  const status = (chat) => {
    if (chat.kind === 'dm') return isOnline(chat.with) ? [Text({ color: 'success', children: ['в сети'] })] : []
    const around = chat.members.filter((id) => id !== S.ch.me && isOnline(id)).length
    return [dim(around ? `участники: ${chat.members.length}, в сети: ${around}` : `участники: ${chat.members.length}`)]
  }
  // Как в Telegram: в широкой панели Desktop и VS Code список чатов всегда слева, а справа — переписка, новый чат
  // или участники группы. В узкой панели и в терминале — по очереди: «← Чаты» возвращает к списку
  const columns = e.viewport?.columns ?? PANE_COLUMNS
  const split = pictures && columns >= CHAT_SPLIT
  const listWidth = Math.min(40, Math.max(26, Math.floor(columns * 0.38)))
  const list = S.ch.list ?? []
  const toTalk = () => {
    S.ch.note = ''
    S.ch.bad = false
    S.ch.confirmLeave = false
    open('chats:talk')()
  }
  // Под названием чата — последнее сообщение одной строкой
  const preview = (c) => {
    const last = c.last
    if (!last) return tr('Здесь пока пусто — напиши первым.', S.lang)
    // Своё — «ты:», в группе — ник; в чате двоих чужое и так от друга. Служебное уже говорит, кто
    const who = last.t === undefined ? '' : last.f === S.ch.me ? tr('ты', S.lang) : c.kind === 'group' ? chatPerson(last.f) : ''
    const said = last.t === undefined ? serviceText(last) : who ? `${who}: ${last.t}` : last.t
    return clip(said, 120)
  }
  // Строка списка: аватарка, название, у друга в сети — ●, время последнего сообщения, под ним само сообщение
  // и непрочитанные значком. Чат, открытый справа, подсвечен и без значка; нажать на него — снова к переписке
  const chatRow = (c, focus) => {
    const title = chatTitle(c)
    const current = split && (S.menu === 'chats:talk' || S.menu === 'chats:members') && c.id === S.ch.talk
    const top = Box({
      flexDirection: 'row',
      justifyContent: 'space-between',
      columnGap: 1,
      children: [
        Box({
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: 1,
          flexShrink: 1,
          minWidth: 0,
          children: [
            keep(
              Button({
                key: `arcade-chat-open-${c.id}`,
                label: split ? clip(title, listWidth - 14) : title,
                ...(focus ? { autoFocus: true } : {}),
                onPress: () => {
                  if (!current) return openChat($, c.id)
                  if (S.menu === 'chats:members') toTalk()
                },
              }),
            ),
            ...(c.kind === 'dm' && isOnline(c.with) ? [dot()] : []),
          ],
        }),
        ...(c.at ? [keep(dim(stamp(c.at)))] : []),
      ],
    })
    const bottom = Box({
      flexDirection: 'row',
      justifyContent: 'space-between',
      columnGap: 1,
      children: [Box({ flexShrink: 1, minWidth: 0, children: [keep(Text({ dimColor: true, wrap: 'truncate-end', children: [preview(c)] }))] }), ...(c.unread && !current ? [badge(c.unread)] : [])],
    })
    return Box({
      key: `chat-row-${c.id}`,
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 'sm',
      ...(pictures ? { padding: 'xs', hover: { backgroundColor: CHAT_HOVER } } : {}),
      ...(current ? { backgroundColor: CHAT_PICKED } : {}),
      children: [...(pictures ? [avatar(chatSvg(c), title, split ? 36 : 40)] : []), Box({ flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0, children: [top, bottom] })],
    })
  }
  // Чаты строками, новые сверху; пока их нет — почему. focusId — какой чат в фокусе
  const chatRows = (focusId) =>
    list.length
      ? [Box({ flexDirection: 'column', rowGap: pictures ? 'xs' : 0, children: list.map((c) => chatRow(c, c.id === focusId)) })]
      : [
          dim(S.ch.list ? 'Чатов пока нет. Нажми «Новый чат» и выбери друга.' : S.ch.loading ? 'Загружаю чаты…' : 'Список чатов не загрузился.'),
          ...(!S.ch.list && !S.ch.loading ? [gap, Button({ key: 'arcade-chats-refresh', label: 'Обновить', onPress: () => loadChats($) })] : []),
        ]
  // «Новый чат» — главной кнопкой, где есть картинки; в фокусе — когда вернулись из него или чатов нет
  const newChat = Button({
    key: 'arcade-chat-new',
    label: 'Новый чат',
    ...(pictures ? { variant: 'primary' } : {}),
    ...(S.menu === 'chats' && (S.menuFrom === 'chats:new' || (S.ch.list && !list.length)) ? { autoFocus: true } : {}),
    onPress: () => {
      S.ch.picked = new Set()
      S.ch.groupName = ''
      S.ch.field++
      S.ch.note = ''
      S.ch.bad = false
      open('chats:new')()
      friendsCall($, 'friends')
    },
  })
  // Широкая панель: сверху top, ниже слева список — «Чаты», «Новый чат» и сами чаты, справа content
  const beside = (top, content, focusId = '') => [
    ...top,
    Box({
      flexDirection: 'row',
      columnGap: 'lg',
      children: [
        Box({
          flexDirection: 'column',
          width: listWidth,
          flexShrink: 0,
          rowGap: 'xs',
          children: [
            Box({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', columnGap: 1, children: [Text({ size: 'heading', weight: 'semibold', children: ['Чаты'] }), newChat] }),
            ...chatRows(focusId),
          ],
        }),
        Box({ flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0, children: content }),
      ],
    }),
    ...noticeLines,
    ...hint,
  ]
  // Первый заголовок экрана справа — вровень с «Чаты» слева, без отступа сверху
  const lead = (title) => (split ? Text({ size: 'heading', weight: 'semibold', children: [title] }) : section(title))
  if (!S.acct.session) {
    items = [
      back,
      gap,
      dim('Чаты в Arcade — с друзьями: переписка один на один, группы и общий чат со всеми друзьями.'),
      Text({ children: ['Чтобы писать друзьям, войди через GitHub.'] }),
      dim('Arcade узнаёт только имя и картинку профиля GitHub — ни почты, ни доступа к репозиториям.'),
      // Вход только что пропал (сайт его не принял) — почему
      ...(S.acct.note ? [gap, Text({ color: 'warning', children: [S.acct.note] })] : []),
      gap,
      login,
      ...noticeLines,
      ...hint,
    ]
  } else if (!S.acct.handle && !S.acct.syncedAt) {
    // Сайт ещё не сказал, есть ли у человека ник
    items = [
      back,
      gap,
      ...(S.acct.syncing ? [dim('Спрашиваю сайт Arcade…')] : S.acct.note ? [Text({ color: 'warning', children: [S.acct.note] })] : []),
      gap,
      Button({
        key: 'arcade-chats-sync',
        label: 'Обновить',
        autoFocus: true,
        onPress: async () => {
          await syncAccount($)
          if (S.acct.handle && !S.ch.list) await loadChats($)
        },
      }),
      ...noticeLines,
      ...hint,
    ]
  } else if (!S.acct.handle) {
    items = [
      back,
      gap,
      Text({ children: ['Писать друзьям можно, когда у тебя есть @ник — сначала возьми свой.'] }),
      dim('Ник видят друзья и соперники в сетевых партиях. Сменить его можно когда угодно — друзья останутся.'),
      gap,
      Button({ key: 'arcade-chats-handle', label: 'Взять @ник', autoFocus: true, onPress: open('account') }),
      ...noticeLines,
      ...hint,
    ]
  } else if (S.menu === 'chats:new') {
    // Новый чат: с другом — сразу, группа — отметить друзей и назвать
    const content = [
      lead('Написать'),
      ...(friends.length
        ? [
            wrapRow(
              friends.map((p, k) =>
                Box({
                  flexDirection: 'row',
                  alignItems: 'center',
                  columnGap: 1,
                  children: [
                    ...(pictures ? [avatar(picSvg(p.pic, p.handle, p.handle), `@${p.handle}`, 24)] : []),
                    keep(Button({ key: `arcade-chat-dm-${p.id}`, label: `@${p.handle}`, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => openDm($, p.id) })),
                    ...(isOnline(p.id) ? [dot()] : []),
                  ],
                }),
              ),
            ),
          ]
        : [
            dim(S.fr.list ? 'Друзей пока нет — добавь кого-нибудь по @нику.' : S.fr.loading ? 'Загружаю друзей…' : 'Список друзей не загрузился.'),
            gap,
            Button({
              key: 'arcade-chats-friends',
              label: 'Друзья',
              autoFocus: true,
              onPress: () => {
                S.fr.note = ''
                S.fr.bad = false
                open('friends')()
                friendsCall($, 'friends')
              },
            }),
          ]),
      ...(friends.length
        ? [
            section('Группа'),
            dim('Группа: отметь друзей, назови её и нажми «Создать группу».'),
            wrapRow(
              friends.map((p) =>
                keep(
                  Button({
                    key: `arcade-chat-pick-${p.id}`,
                    label: `${S.ch.picked.has(p.id) ? '☑' : '☐'} @${p.handle}`,
                    onPress: () => {
                      if (S.ch.picked.has(p.id)) S.ch.picked.delete(p.id)
                      else S.ch.picked.add(p.id)
                      S.ch.note = ''
                      S.ch.bad = false
                      $.ui.invalidate('ui.render')
                    },
                  }),
                ),
              ),
            ),
            gap,
            // Что вписано, помним сами: «Создать группу» — кнопка, а не Enter в поле
            Input({
              key: `arcade-chat-name-${S.ch.field}`,
              label: 'Название группы',
              placeholder: 'например: шахматный клуб',
              onInput: (value) => {
                S.ch.groupName = value
              },
              onSubmit: (value) => {
                S.ch.groupName = value
                return createGroup($)
              },
            }),
            row([
              Button({ key: 'arcade-chat-create', label: S.ch.busy === 'group' ? 'Создаю…' : 'Создать группу', onPress: () => createGroup($) }),
              Button({ key: 'arcade-chat-all', label: 'Группа со всеми друзьями', onPress: () => createGroup($, true) }),
            ]),
          ]
        : []),
      ...(S.ch.busy === 'open' ? [gap, dim('Открываю чат…')] : note.length ? [gap, ...note] : []),
    ]
    items = split ? beside([back, gap], content) : [toList, ...content, ...noticeLines, ...hint]
  } else if (S.menu === 'chats:talk') {
    // Переписка как в Telegram: шапка с аватаркой и «в сети», дни разделителями, своё справа, чужое слева, в группе —
    // с аватаркой и ником автора. Последние ch.shown сообщений, «Раньше» — ещё; новые приходят по таймеру
    const about = S.ch.about
    const listed = S.ch.list?.find((c) => c.id === S.ch.talk)
    const chat = about ?? listed
    const editing = S.ch.editing ? S.ch.messages.find((m) => m.s === S.ch.editing && !m.d) : undefined
    const title = chat ? chatTitle(chat) : ''
    const group = chat?.kind === 'group'
    const membersButton = Button({
      key: 'arcade-chat-members',
      label: 'Участники',
      onPress: () => {
        S.ch.note = ''
        S.ch.bad = false
        S.ch.confirmLeave = false
        open('chats:members')()
        // Хозяину — список друзей: кого добавить
        if (about.owner === S.ch.me) friendsCall($, 'friends')
      },
    })
    // Под названием: друг в сети или сколько в группе людей; у группы — ещё кнопка «Участники»
    const statusLine = [...(about ? status(about) : listed?.kind === 'dm' ? status(listed) : []), ...(about?.kind === 'group' ? [membersButton] : [])]
    const header = Box({
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 'sm',
      children: [
        ...(pictures && chat ? [avatar(chatSvg(chat), title, 40)] : []),
        Box({ flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0, children: [...(title ? [heading(title)] : []), ...(statusLine.length ? [row(statusLine)] : [])] }),
      ],
    })
    // День: «Сегодня», «Вчера» или дата — посередине; в терминале — чертой
    const dayLine = (at) => {
      const d = tr(day(at, now), S.lang)
      return Box({ flexDirection: 'row', justifyContent: 'center', ...(pictures ? { paddingY: 'sm' } : {}), children: [keep(dim(pictures ? d : `── ${d} ──`))] })
    }
    // Служебное (создал, добавил, переименовал) — посередине, тускло
    const service = (m) => Box({ flexDirection: 'row', justifyContent: 'center', paddingX: 4, children: [keep(Text({ dimColor: true, wrap: 'wrap', children: [serviceText(m)] }))] })
    // Меню своего сообщения под ним, без крупных кнопок: «Изменить» и «Удалить»; «Удалить» спрашивает ещё раз
    const redraw = (act) => () => {
      act()
      $.ui.invalidate('ui.render')
    }
    const menuButton = (key, label, act) => Button({ key, label, plain: true, onPress: redraw(act) })
    const msgMenu = (m) =>
      Box({
        flexDirection: 'row',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        columnGap: pictures ? 'md' : 2,
        children:
          S.ch.confirmDelete === m.s
            ? [dim('Удалить сообщение у всех?'), menuButton(`arcade-msg-delete-yes-${m.s}`, 'Удалить', () => deleteMessage($, m.s)), menuButton(`arcade-msg-delete-no-${m.s}`, 'Отмена', () => toggleMsgMenu(m.s))]
            : [
                menuButton(`arcade-msg-edit-${m.s}`, 'Изменить', () => startEditing($, m.s)),
                menuButton(`arcade-msg-delete-${m.s}`, 'Удалить', () => {
                  S.ch.confirmDelete = m.s
                }),
              ],
      })
    // Сообщение. Под текстом — время («изменено» — его поправили), у своего ещё ✓: дошло до сайта (прочитано ли,
    // Arcade не показывает) и ⋮ — меню. Где рисуют картинки — пузырём в рамке, своё — цветом акцента; в терминале —
    // текст и время в строку. В группе у первого сообщения подряд от одного человека — его аватарка и ник цветом от ника
    const message = (m, first, spaced) => {
      const mine = m.f === S.ch.me
      const author = group && !mine
      const at = `${m.e ? `${tr('изменено', S.lang)} ` : ''}${clock(m.at)}`
      const time = keep(Text({ dimColor: true, size: 'footnote', children: [mine ? `${at} ✓` : at] }))
      const dots = mine && about ? [keep(Button({ key: `arcade-msg-menu-${m.s}`, label: '⋮', plain: true, dimColor: true, onPress: redraw(() => toggleMsgMenu(m.s)) }))] : []
      const text = keep(Text({ wrap: 'wrap', children: [m.t] }))
      const name = author && first ? [keep(Text({ weight: 'semibold', color: letterColor(S.ch.names[m.f] || m.f), children: [chatPerson(m.f)] }))] : []
      const body = pictures
        ? Box({
            flexDirection: 'column',
            flexShrink: 1,
            minWidth: 0,
            borderStyle: 'round',
            borderColor: mine ? 'suggestion' : 'subtle',
            backgroundColor: mine ? CHAT_MINE : CHAT_THEIRS,
            paddingX: 'md',
            paddingY: 'xs',
            children: [...name, text, Box({ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', columnGap: 'sm', children: [time, ...dots] })],
          })
        : Box({ flexDirection: 'column', flexShrink: 1, minWidth: 0, children: [...name, Box({ flexDirection: 'row', columnGap: 1, children: [Box({ flexShrink: 1, minWidth: 0, children: [text] }), time, ...dots] })] })
      // Место под аватарку — у каждого чужого сообщения группы, чтобы пузыри стояли ровно; сама она — у первого
      const face = author && pictures ? [Box({ width: 5, flexShrink: 0, children: first ? [avatar(personSvg(m.f), chatPerson(m.f), 28)] : [] })] : []
      const bubble = Box({
        flexDirection: 'row',
        justifyContent: mine ? 'flex-end' : 'flex-start',
        ...(mine ? { paddingLeft: 8 } : { paddingRight: 8 }),
        // Сменился автор — отступ побольше, как в Telegram; подряд от одного человека — плотнее
        ...(pictures ? (spaced ? { marginTop: 'sm' } : {}) : name.length ? { marginTop: 1 } : {}),
        children: [...face, body],
      })
      return dots.length && S.ch.msgMenu === m.s ? Box({ flexDirection: 'column', rowGap: pictures ? 'xs' : 0, children: [bubble, msgMenu(m)] }) : bubble
    }
    // Подряд от одного человека в один день — без повторного ника и аватарки; новый день — разделитель
    const shown = visibleMessages().slice(-S.ch.shown)
    const lines = shown.flatMap((m, k) => {
      const before = shown[k - 1]
      const newDay = !before || day(before.at, now) !== day(m.at, now)
      const other = !newDay && (Boolean(before.k) || before.f !== m.f)
      return [...(newDay ? [dayLine(m.at)] : []), m.k ? service(m) : message(m, newDay || other, other)]
    })
    const area = [
      ...(olderShown() ? [Box({ flexDirection: 'row', justifyContent: 'center', children: [Button({ key: 'arcade-chat-older', label: S.ch.older ? 'Загружаю…' : 'Раньше', onPress: () => olderMessages($) })] })] : []),
      ...(S.ch.opening
        ? [dim('Загружаю переписку…')]
        : about && !shown.length
          ? [dim('Здесь пока пусто — напиши первым.')]
          : [Box({ flexDirection: 'column', rowGap: pictures ? 'xs' : 0, children: lines })]),
    ]
    const talk = [
      header,
      gap,
      // Где есть картинки — переписка на своём фоне в рамке, как обои в мессенджере
      ...(pictures ? [Box({ flexDirection: 'column', rowGap: 'sm', padding: 'md', borderStyle: 'round', borderColor: 'subtle', backgroundColor: CHAT_WALL, children: area })] : area),
      // Поле внизу: новое сообщение, а после «Изменить» — текст своего сообщения, править здесь же
      ...(about
        ? [
            gap,
            ...(editing ? [row([dim('Правка сообщения'), Button({ key: 'arcade-chat-edit-cancel', label: 'Отмена', plain: true, dimColor: true, onPress: redraw(() => stopEditing($)) })])] : []),
            Input({
              key: `arcade-chat-input-${S.ch.field}`,
              label: editing ? 'Изменить сообщение' : 'Сообщение',
              ...(editing ? { value: editing.t } : {}),
              autoFocus: true,
              submitLabel: tr(editing ? 'Сохранить' : 'Отправить', S.lang),
              onSubmit: (value) => (editing ? editMessage($, editing.s, value) : sendMessage($, value)),
            }),
            dim('Переписка не шифруется — не пиши сюда пароли и ключи.'),
          ]
        : []),
      ...(S.ch.busy === 'send' ? [dim('Отправляю…')] : S.ch.busy === 'edit' ? [dim('Сохраняю…')] : S.ch.busy === 'delete' ? [dim('Удаляю…')] : note),
      gap,
      pageButton,
    ]
    items = split ? beside([back, gap], talk) : [toList, gap, ...talk, ...noticeLines, ...hint]
  } else if (S.menu === 'chats:members') {
    // Участники группы: хозяин переименовывает, ставит картинку, добавляет друзей и убирает людей; выйти может любой
    const about = S.ch.about
    const owner = Boolean(about) && about.owner === S.ch.me
    const members = about?.members ?? []
    const others = friends.filter((p) => !members.includes(p.id))
    const current = validPic(about?.pic) ? about.pic : null
    const content = [
      Button({ key: 'arcade-back', label: '← Назад', autoFocus: true, onPress: toTalk }),
      gap,
      ...(about
        ? [
            Box({
              flexDirection: 'row',
              alignItems: 'center',
              columnGap: 'sm',
              children: [...(pictures ? [avatar(chatSvg(about), chatTitle(about), 40)] : []), Box({ flexDirection: 'column', flexShrink: 1, minWidth: 0, children: [heading(chatTitle(about)), ...status(about)] })],
            }),
          ]
        : []),
      // Подсказка в поле — нынешнее название группы, его не переводим
      ...(owner
        ? [gap, keep(Input({ key: `arcade-chat-rename-${S.ch.field}`, label: tr('Переименовать', S.lang), placeholder: about.name || tr('Название группы', S.lang), onSubmit: (value) => renameGroup($, value) }))]
        : []),
      section('Участники'),
      ...members.map((id) =>
        Box({
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: pictures ? 'sm' : 2,
          children: [
            ...(pictures ? [avatar(personSvg(id), chatPerson(id), 28)] : []),
            keep(Text({ children: [chatPerson(id)] })),
            ...(id !== S.ch.me && isOnline(id) ? [Text({ color: 'success', children: ['в сети'] })] : []),
            ...(id === about.owner ? [dim('управляет группой')] : []),
            ...(owner && id !== S.ch.me ? [Button({ key: `arcade-chat-remove-${id}`, label: 'Убрать', onPress: () => changeMembers($, { remove: [id] }, 'Участник убран.') })] : []),
          ],
        }),
      ),
      ...(owner && others.length
        ? [
            section('Добавить друзей'),
            wrapRow(others.map((p) => keep(Button({ key: `arcade-chat-add-${p.id}`, label: `+ @${p.handle}`, onPress: () => changeMembers($, { add: [p.id] }, 'Участник добавлен.') })))),
          ]
        : []),
      // Картинку группы ставит хозяин; без неё — первая буква названия
      ...(owner
        ? [
            section('Картинка группы'),
            picGrid('arcade-chat-pic', current, (n) => n !== current && changeMembers($, { pic: n }, 'Картинка группы изменена.'), 'Без картинки', picSvg(null, about.name || tr('Группа', S.lang), about.id)),
          ]
        : []),
      ...(about ? [gap, Button({ key: 'arcade-chat-leave', label: S.ch.confirmLeave ? 'Точно выйти? Нажми ещё раз' : 'Выйти из группы', onPress: () => leaveGroup($) })] : []),
      ...(S.ch.busy === 'members' ? [dim('Сохраняю…')] : note),
    ]
    // Рядом со списком «← Назад» у участников — к переписке; к главному меню — оттуда
    items = split ? beside([], content) : [...content, ...noticeLines, ...hint]
  } else {
    // Список чатов. В широкой панели справа от него — что открыть, пока чат не выбран
    const fromTalk = S.menuFrom === 'chats:talk' || S.menuFrom === 'chats:members'
    const focusId = fromTalk ? S.ch.talk : S.menuFrom === 'chats:new' ? '' : list[0]?.id
    const privacy = dim('Переписка хранится на сайте Arcade и не шифруется — не пиши туда пароли и ключи.')
    items = split
      ? beside(
          [back, gap],
          [
            Box({
              flexDirection: 'column',
              alignItems: 'center',
              paddingY: 'xl',
              borderStyle: 'round',
              borderColor: 'subtle',
              backgroundColor: CHAT_WALL,
              children: [dim('Выбери чат слева или начни новый.')],
            }),
            ...(note.length ? [gap, ...note] : []),
            gap,
            pageButton,
            gap,
            privacy,
          ],
          focusId,
        )
      : [
          back,
          gap,
          row([newChat, pageButton]),
          ...(note.length ? [gap, ...note] : []),
          section('Чаты'),
          ...chatRows(focusId),
          gap,
          privacy,
          ...noticeLines,
          ...hint,
        ]
  }
  return items
}

// ━━━━━━━━━━ screens/watch ━━━━━━━━━━
// Arcade: экраны YouTube, Twitch и TikTok.

// Темы: три по работе агента и новинки. Названия, которые придумала модель, — уже на языке интерфейса (keep)
export function youtubeScreen($, e, kit) {
  const { Box, Button, Text, back, desktop, dim, gap, hint, noticeLines, open, ownTopics, tiles } = kit
  const focus = S.menuFrom?.startsWith('youtube:') ? topicKey(S.menuFrom.slice(8)) : 0
  const topicTiles = (S.yt.topics ?? []).flatMap((t, i) => {
    const button = Button({
      key: `arcade-yt-topic-${i}`,
      label: t.title,
      ...(i === focus ? { autoFocus: true } : {}),
      onPress: () => {
        open(`youtube:${i}`)()
        if (S.yt.topic !== i || (!S.yt.videos.length && !S.yt.loading)) loadVideos($, i)
      },
    })
    return [t.fixed ? button : keep(button), dim(t.direction === 'news' ? '  презентации и обзоры обновлений' : '  по теме работы агента')]
  })
  return [
    back,
    gap,
    dim('Темы — по тому, над чем сейчас работает агент; видео — свежие, с проверенных каналов.'),
    gap,
    ...(S.yt.loading === 'topics' || !S.yt.topics
      ? [Text({ children: ['Подбираю темы…'] })]
      : [
          // Названия тем — до 40 знаков: плитки шире обычных, чтобы название чаще влезало в одну строку
          desktop ? tiles(topicTiles, 44) : Box({ flexDirection: 'column', children: topicTiles }),
          gap,
          Button({ key: 'arcade-yt-retopic', label: 'Другие темы', onPress: () => loadTopics($) }),
        ]),
    ...ownTopics('youtube', 'yt', focus, 'Напиши, что хочешь посмотреть, — Arcade найдёт свежие видео по теме.'),
    ...noticeLines,
    ...hint,
  ]
}

export function youtubeTopicScreen($, e, kit) {
  const { Box, Button, Svg, Text, desktop, dim, gap, hint, noticeLines, now, open } = kit
  const topicId = topicKey(S.menu.slice(8))
  const topic = topicOf(topicId)
  const builtin = builtinBrowser(e.surface)
  const playVideo = async (k) => {
    const id = `video:${k}`
    if (builtin) return desktopWindow($, id, 'Видео открыто во встроенном браузере Claude.')
    if (!S.platform) {
      S.libraryNotice = `Видео: https://www.youtube.com/watch?v=${S.yt.videos[k].id}`
      $.ui.invalidate('ui.render')
      return
    }
    S.libraryNotice = 'Открываю окно…'
    $.ui.invalidate('ui.render')
    const command = windowCommand(id)
    try {
      const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
      windowNotice($, launchNotice(result, id))
      if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
    } catch (err) {
      S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
    }
    $.ui.invalidate('ui.render')
  }
  // Видео — названия, каналы и описания как есть, без перевода (keep). В Desktop — крупная карточка во всю строку:
  // название, канал с датой и просмотрами, начало описания
  const videoItem = (v, k) => {
    const label = v.title.length > 100 ? `${v.title.slice(0, 99)}…` : v.title
    const button = Button({ key: `arcade-yt-video-${k}`, label, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => playVideo(k) })
    if (!desktop) return keep(Box({ flexDirection: 'column', children: [button, Text({ dimColor: true, children: [`  ${videoMeta(v, S.lang, now)}`] })] }))
    const stats = videoStats(v, S.lang, now)
    const about = videoBlurb(v)
    return keep(
      Box({
        key: `card-yt-video-${k}`,
        flexDirection: 'row',
        alignItems: 'flex-start',
        columnGap: 'md',
        borderStyle: 'round',
        borderColor: 'subtle',
        padding: 'md',
        hover: { borderColor: 'suggestion', backgroundColor: '#8080801a' },
        children: [
          Svg({ source: iconSvg('youtube'), alt: 'YouTube', width: 48, height: 48 }),
          Box({
            flexDirection: 'column',
            rowGap: 'xs',
            flexShrink: 1,
            flexGrow: 1,
            children: [
              button,
              Text({ size: 'footnote', children: [Text({ weight: 'semibold', children: [v.channel] }), ...(stats ? [Text({ dimColor: true, children: [` · ${stats}`] })] : [])] }),
              ...(about ? [Text({ size: 'footnote', dimColor: true, wrap: 'wrap', children: [about] })] : []),
            ],
          }),
        ],
      }),
    )
  }
  return [
    Button({ key: 'arcade-back', label: '← Назад', ...(S.yt.loading ? { autoFocus: true } : {}), onPress: open('youtube') }),
    gap,
    ...(topic ? [topic.fixed ? Text({ bold: true, children: [topic.title] }) : keep(Text({ bold: true, children: [topic.title] }))] : []),
    gap,
    ...(S.yt.loading === 'videos'
      ? [Text({ children: ['Подбираю видео…'] })]
      : S.yt.videos.length
        ? [Box({ flexDirection: 'column', rowGap: desktop ? 'sm' : 0, children: S.yt.videos.map(videoItem) })]
        : []),
    ...(S.yt.note ? [gap, dim(S.yt.note)] : []),
    ...(topic && !S.yt.loading ? [gap, Button({ key: 'arcade-yt-more', label: 'Другая подборка', ...(S.yt.videos.length ? {} : { autoFocus: true }), onPress: () => loadVideos($, topicId, true) })] : []),
    ...(S.yt.videos.length && (builtin || S.platform) ? [gap, dim(`Видео открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.`)] : []),
    ...noticeLines,
    ...hint,
  ]
}

// TikTok: лента «Для тебя» и поиск TikTok по темам работы агента, своим темам или любому запросу. Смотрят на
// сайте TikTok, вход — человека. Названия тем, которые придумала модель, — уже на языке интерфейса (keep)
export function tiktokScreen($, e, kit) {
  const { Box, Button, Input, Text, back, desktop, dim, gap, hint, noticeLines, section, tiles } = kit
  const builtin = builtinBrowser(e.surface)
  const search = (query) => openTiktok($, e.surface, query)
  const topicTiles = (S.yt.topics ?? []).flatMap((t, i) => {
    const button = Button({ key: `arcade-tt-topic-${i}`, label: t.title, onPress: () => search(t.fixed ? tr(t.title, S.lang) : t.title) })
    return [t.fixed ? button : keep(button), dim(t.direction === 'news' ? '  презентации и обзоры обновлений' : '  по теме работы агента')]
  })
  const ownTiles = S.myTopics.flatMap((t) => [keep(Button({ key: `arcade-tt-own-${t.id}`, label: t.title, onPress: () => search(t.title) })), dim('  своя тема')])
  const column = (list) => (desktop ? tiles(list, 44) : Box({ flexDirection: 'column', children: list }))
  return [
    back,
    gap,
    Button({ key: 'arcade-tt-feed', label: 'Лента «Для тебя»', autoFocus: true, onPress: () => search('') }),
    dim('  Войди в TikTok сам — проще всего QR-кодом из приложения на телефоне. Arcade твой вход не видит.'),
    section('Поиск по теме'),
    ...(S.yt.loading === 'topics' || !S.yt.topics ? [Text({ children: ['Подбираю темы…'] })] : [column(topicTiles)]),
    ...(ownTiles.length ? [section('Мои темы'), column(ownTiles)] : []),
    gap,
    Input({
      key: 'arcade-tt-search',
      label: 'Найти в TikTok',
      placeholder: 'что угодно: рецепты, Rust, котики…',
      onSubmit: (value) => {
        const query = clean(value, 100)
        if (query) search(query)
      },
    }),
    ...(builtin || S.platform ? [gap, dim(builtin ? 'TikTok открывается во встроенном браузере Claude.' : 'TikTok открывается в браузере по умолчанию.')] : []),
    ...noticeLines,
    ...hint,
  ]
}

// Twitch: свои каналы, кто из каталога в эфире, весь каталог по направлениям, «Убрать канал». Имена каналов,
// названия эфиров и игр — как на Twitch, без перевода (keep); подпись «в эфире…» переводим здесь
export function twitchScreen($, e, kit) {
  const { Box, Button, Input, Text, back, desktop, dim, gap, hint, noticeLines, open, section, tiles, watchLive } = kit
  let items
  const builtin = builtinBrowser(e.surface)
  const watch = watchLive
  // Плитка канала: имя — кнопкой, под ним — эфир (игра, зрители) и его название
  const channelTile = (key, c, info, missing, focus) => {
    const status = tr(liveStatus(info, missing, S.lang), S.lang)
    const note = [status, info?.live?.title].filter(Boolean).join(' — ')
    return [keep(Button({ key, label: info?.name ?? c.name, ...(focus ? { autoFocus: true } : {}), onPress: () => watch(c.login) })), keep(dim(`  ${note}`))]
  }
  const column = (list) => (desktop ? tiles(list, 44) : Box({ flexDirection: 'column', children: list }))
  const where = builtin || S.platform ? [gap, dim(`Трансляции открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.`)] : []
  const trouble = S.tw.error ? [gap, dim(twitchNote(S.tw.error))] : []
  const waiting = S.tw.loading && !S.tw.at ? [Text({ children: ['Спрашиваю Twitch, кто в эфире…'] })] : []
  const toList = Button({ key: 'arcade-back', label: '← Назад', onPress: open('twitch') })
  if (S.menu === 'twitch:catalog') {
    // Весь каталог: по направлениям, в каждом — сначала эфиры
    const groups = Object.keys(TOPIC_TITLES)
      .map((t) => [t, S.tw.catalog.filter((c) => c.topics[0] === t)])
      .filter(([, list]) => list.length)
    items = [
      toList,
      gap,
      dim('Каталог Arcade: эфиры о программировании, технике, науке и ретро-играх, по-английски. Каналы 18+ не показываем.'),
      ...waiting,
      ...groups.flatMap(([t, list], g) => [section(TOPIC_TITLES[t]), column(list.flatMap((c, k) => channelTile(`arcade-tw-cat-${c.login}`, c, c, false, g === 0 && k === 0)))]),
      ...trouble,
      ...where,
      ...noticeLines,
      ...hint,
    ]
  } else if (S.menu === 'twitch:remove') {
    items = [
      toList,
      gap,
      dim('Какой канал убрать из «Моих каналов»?'),
      gap,
      ...S.tw.channels.map((c, k) => keep(Button({ key: `arcade-tw-remove-${c.login}`, label: S.tw.info[c.login]?.name ?? c.name, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => removeChannel($, c.login) }))),
      ...(S.tw.note ? [gap, dim(S.tw.note)] : []),
      ...hint,
    ]
  } else {
    const from = S.menuFrom?.startsWith('twitch:') ? S.menuFrom : ''
    const myTiles = liveFirst(S.tw.channels, S.tw.info).flatMap((c, k) => channelTile(`arcade-tw-my-${c.login}`, c, S.tw.info[c.login], S.tw.missing.has(c.login), !from && k === 0))
    const onAir = S.tw.catalog.filter((c) => c.live).slice(0, 8)
    const airTiles = onAir.flatMap((c, k) => channelTile(`arcade-tw-cat-${c.login}`, c, c, false, !from && !myTiles.length && k === 0))
    items = [
      back,
      gap,
      dim('Свои каналы и каталог Arcade. Регистрация не нужна: свои каналы хранятся только у тебя.'),
      section('Мои каналы'),
      ...(myTiles.length ? [column(myTiles)] : [dim('Своих каналов пока нет — добавь любой канал Twitch по имени или ссылке.')]),
      gap,
      Input({ key: 'arcade-twitch-add', label: 'Добавить канал', placeholder: 'имя канала или ссылка twitch.tv/…', onSubmit: (value) => addChannel($, value) }),
      dim(S.tw.note || 'Например, tsoding или https://www.twitch.tv/tsoding'),
      ...(S.tw.channels.length ? [gap, Button({ key: 'arcade-tw-remove', label: 'Убрать канал', ...(from === 'twitch:remove' ? { autoFocus: true } : {}), onPress: open('twitch:remove') })] : []),
      section('Сейчас в эфире'),
      ...(waiting.length ? waiting : airTiles.length ? [column(airTiles)] : S.tw.error ? [] : [dim('Из каталога сейчас никто не в эфире.')]),
      gap,
      Button({ key: 'arcade-tw-catalog', label: 'Весь каталог', ...(from === 'twitch:catalog' ? { autoFocus: true } : {}), onPress: open('twitch:catalog') }),
      Button({ key: 'arcade-tw-refresh', label: S.tw.loading ? 'Обновляю…' : 'Обновить', onPress: () => loadTwitch($, true) }),
      ...trouble,
      ...where,
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}

// ━━━━━━━━━━ screens/read ━━━━━━━━━━
// Arcade: экраны статей, подкастов и книг.

// Статьи и подкасты: темы — те же, что у YouTube, подборка — своя. Названия, которые придумала модель, — уже на
// языке интерфейса (keep)
export function readsScreen($, e, kit) {
  const { Box, Button, Text, back, desktop, dim, gap, hint, noticeLines, open, ownTopics, tiles } = kit
  const kind = S.menu
  const articles = kind === 'articles'
  const short = articles ? 'ar' : 'pc'
  const focus = S.menuFrom?.startsWith(`${kind}:`) ? topicKey(S.menuFrom.slice(kind.length + 1)) : 0
  const topicTiles = (S.yt.topics ?? []).flatMap((t, i) => {
    const button = Button({
      key: `arcade-${short}-topic-${i}`,
      label: t.title,
      ...(i === focus ? { autoFocus: true } : {}),
      onPress: () => {
        open(`${kind}:${i}`)()
        const state = S.reads[kind]
        if (state.topic !== i || (!state.items.length && !state.loading)) loadReads($, kind, i)
      },
    })
    return [t.fixed ? button : keep(button), dim(t.direction === 'news' ? '  новости и обзоры обновлений' : '  по теме работы агента')]
  })
  return [
    back,
    gap,
    dim(
      articles
        ? 'Темы — по тому, над чем сейчас работает агент; статьи — свежие, из проверенных блогов и изданий на английском.'
        : 'Темы — по тому, над чем сейчас работает агент; выпуски — свежие, из проверенных подкастов на английском.',
    ),
    gap,
    ...(S.yt.loading === 'topics' || !S.yt.topics
      ? [Text({ children: ['Подбираю темы…'] })]
      : [
          desktop ? tiles(topicTiles, 44) : Box({ flexDirection: 'column', children: topicTiles }),
          gap,
          Button({ key: `arcade-${short}-retopic`, label: 'Другие темы', onPress: () => loadTopics($) }),
        ]),
    ...ownTopics(
      kind,
      short,
      focus,
      articles ? 'Напиши, о чём хочешь почитать, — Arcade найдёт свежие статьи по теме.' : 'Напиши, о чём хочешь послушать, — Arcade найдёт свежие выпуски по теме.',
    ),
    ...noticeLines,
    ...hint,
  ]
}

export function readsTopicScreen($, e, kit) {
  const { Box, Button, Svg, Text, desktop, dim, gap, hint, noticeLines, now, open } = kit
  const kind = S.menu.split(':')[0]
  const articles = kind === 'articles'
  const short = articles ? 'ar' : 'pc'
  const topicId = topicKey(S.menu.slice(kind.length + 1))
  const topic = topicOf(topicId)
  const state = S.reads[kind]
  const builtin = builtinBrowser(e.surface)
  const openItem = async (k) => {
    const id = `${articles ? 'article' : 'episode'}:${k}`
    if (builtin) return desktopWindow($, id, articles ? 'Статья открыта во встроенном браузере Claude.' : 'Выпуск открыт во встроенном браузере Claude.')
    if (!S.platform) {
      const x = S.reads[kind].items[k]
      S.libraryNotice = articles ? `Статья: ${x.link}` : `Выпуск: ${x.link || x.audio}`
      $.ui.invalidate('ui.render')
      return
    }
    S.libraryNotice = 'Открываю окно…'
    $.ui.invalidate('ui.render')
    const command = windowCommand(id)
    try {
      const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
      windowNotice($, launchNotice(result, id))
      if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
    } catch (err) {
      S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
    }
    $.ui.invalidate('ui.render')
  }
  // Записи — названия, источники и описания как есть, без перевода (keep). В Desktop — карточка во всю строку:
  // название, источник с датой (у выпуска — и длительностью), начало описания
  const entry = (x, k) => {
    const label = x.title.length > 100 ? `${x.title.slice(0, 99)}…` : x.title
    const button = Button({ key: `arcade-${short}-item-${k}`, label, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => openItem(k) })
    const stats = itemStats(x, S.lang, now)
    if (!desktop) return keep(Box({ flexDirection: 'column', children: [button, Text({ dimColor: true, children: [`  ${[x.channel, stats].filter(Boolean).join(' · ')}`] })] }))
    const about = videoBlurb(x)
    return keep(
      Box({
        key: `card-${short}-item-${k}`,
        flexDirection: 'row',
        alignItems: 'flex-start',
        columnGap: 'md',
        borderStyle: 'round',
        borderColor: 'subtle',
        padding: 'md',
        hover: { borderColor: 'suggestion', backgroundColor: '#8080801a' },
        children: [
          Svg({ source: iconSvg(kind), alt: x.channel, width: 48, height: 48 }),
          Box({
            flexDirection: 'column',
            rowGap: 'xs',
            flexShrink: 1,
            flexGrow: 1,
            children: [
              button,
              Text({ size: 'footnote', children: [Text({ weight: 'semibold', children: [x.channel] }), ...(stats ? [Text({ dimColor: true, children: [` · ${stats}`] })] : [])] }),
              ...(about ? [Text({ size: 'footnote', dimColor: true, wrap: 'wrap', children: [about] })] : []),
            ],
          }),
        ],
      }),
    )
  }
  return [
    Button({ key: 'arcade-back', label: '← Назад', ...(state.loading ? { autoFocus: true } : {}), onPress: open(kind) }),
    gap,
    ...(topic ? [topic.fixed ? Text({ bold: true, children: [topic.title] }) : keep(Text({ bold: true, children: [topic.title] }))] : []),
    gap,
    ...(state.loading
      ? [Text({ children: [articles ? 'Подбираю статьи…' : 'Подбираю выпуски…'] })]
      : state.items.length
        ? [Box({ flexDirection: 'column', rowGap: desktop ? 'sm' : 0, children: state.items.map(entry) })]
        : []),
    ...(state.note ? [gap, dim(state.note)] : []),
    ...(topic && !state.loading
      ? [gap, Button({ key: `arcade-${short}-more`, label: 'Другая подборка', ...(state.items.length ? {} : { autoFocus: true }), onPress: () => loadReads($, kind, topicId, true) })]
      : []),
    ...(state.items.length && (builtin || S.platform)
      ? [gap, dim(articles ? `Статьи открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.` : `Выпуски открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.`)]
      : []),
    ...noticeLines,
    ...hint,
  ]
}

// Книги и аудиокниги: Arcade их не хранит — список приходит с сайта (Project Gutenberg, Викитека, LibriVox) на
// языке книг, который выбирает человек. Разделы одни на все языки, поиск — по названию или автору. Книга
// открывается в окне Arcade: там читалка или проигрыватель, там же её можно скачать к себе («Мои книги»)
export function booksScreen($, e, kit) {
  const { Box, Button, Input, Text, back, desktop, dim, gap, hint, noticeLines, open, section, tiles } = kit
  let items
  const [page, screen] = S.menu.split(':')
  const kind = page === 'books' ? 'book' : 'audio'
  const short = kind === 'book' ? 'bk' : 'ab'
  const state = S.bk[kind]
  const builtin = builtinBrowser(e.surface)
  const openBook = async (id, opened) => {
    if (builtin) return desktopWindow($, id, opened)
    if (!S.platform) {
      S.libraryNotice = `Открой в браузере: ${windowUrl(id)}`
      $.ui.invalidate('ui.render')
      return
    }
    S.libraryNotice = 'Открываю окно…'
    $.ui.invalidate('ui.render')
    const command = windowCommand(id)
    try {
      const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
      windowNotice($, launchNotice(result, id))
      if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
    } catch (err) {
      S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
    }
    $.ui.invalidate('ui.render')
  }
  // В список раздела или поиска; тот же раздел уже загружен — показываем его, не загружая заново
  const toList = (what) => () => {
    open(`${page}:list`)()
    if (what.q || what.section !== state.section || state.q || (!state.items.length && !state.loading)) loadBooks($, kind, what)
  }
  if (screen === 'lang') {
    // Название языка — на нём самом (keep), выбранный — с галочкой
    items = [
      Button({ key: 'arcade-back', label: '← Назад', onPress: open(page) }),
      gap,
      dim('Книги и аудиокниги будут на этом языке. Язык интерфейса не меняется.'),
      gap,
      tiles(
        Object.entries(BOOK_LANGS).map(([code, name]) =>
          keep(
            Button({
              key: `arcade-${short}-lang-${code}`,
              label: `${name}${code === S.bk.lang ? ' ✓' : ''}`,
              ...(code === S.bk.lang ? { autoFocus: true } : {}),
              onPress: async () => {
                open(page)()
                if (code !== S.bk.lang) await setBookLang($, code)
              },
            }),
          ),
        ),
        22,
      ),
      ...hint,
    ]
  } else if (screen === 'list') {
    const opened = kind === 'book' ? 'Книга открыта во встроенном браузере Claude.' : 'Аудиокнига открыта во встроенном браузере Claude.'
    // Названия и авторы — как у источника, без перевода (keep); источник переводим («Викитека» → «Wikisource»)
    const entries = state.items.flatMap((x, k) => [
      keep(
        Button({
          key: `arcade-${short}-item-${k}`,
          label: x.title.length > 100 ? `${x.title.slice(0, 99)}…` : x.title,
          ...(k === 0 ? { autoFocus: true } : {}),
          onPress: () => openBook(`${kind}:${x.ref}`, opened),
        }),
      ),
      keep(dim(`  ${[x.author, tr(BOOK_SOURCES[x.source] ?? x.source, S.lang)].filter(Boolean).join(' · ')}`)),
    ])
    const retry = () => (S.bk[kind].items.length ? loadBooks($, kind, { more: true }) : loadBooks($, kind, { section: state.section, q: state.q }))
    items = [
      Button({ key: 'arcade-back', label: '← Назад', ...(entries.length ? {} : { autoFocus: true }), onPress: open(page) }),
      gap,
      state.q ? keep(Text({ bold: true, children: [`${tr('Поиск', S.lang)}: ${state.q}`] })) : Text({ bold: true, children: [BOOK_SECTIONS[state.section] ?? BOOK_SECTIONS.popular] }),
      keep(dim(`${tr(kind === 'book' ? 'Книги' : 'Аудиокниги', S.lang)} · ${BOOK_LANGS[S.bk.lang]}`)),
      gap,
      ...(entries.length ? [desktop ? tiles(entries, 44) : Box({ flexDirection: 'column', children: entries })] : []),
      ...(state.loading && !entries.length ? [Text({ children: ['Загружаю список…'] })] : []),
      ...(!state.loading && !state.error && !entries.length ? [Text({ children: ['Ничего не нашлось — попробуй другое слово или язык.'] })] : []),
      ...(state.error
        ? [
            gap,
            Text({ color: 'warning', children: [`Список не загрузился: ${state.error}`] }),
            Button({ key: `arcade-${short}-retry`, label: 'Ещё раз', onPress: retry }),
          ]
        : state.more
          ? [gap, Button({ key: `arcade-${short}-more`, label: state.loading ? 'Загружаю…' : 'Ещё', onPress: () => !S.bk[kind].loading && loadBooks($, kind, { more: true }) })]
          : []),
      ...(entries.length && (builtin || S.platform)
        ? [gap, dim(`${kind === 'book' ? 'Книги' : 'Аудиокниги'} открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.`)]
        : []),
      ...noticeLines,
      ...hint,
    ]
  } else {
    // Вернулись из списка раздела — фокус на этом разделе, из поиска — на поле, из языков — на языке
    const fromList = S.menuFrom === `${page}:list`
    const focusSection = S.menuFrom === `${page}:lang` || (fromList && state.q) ? null : fromList ? state.section || 'popular' : 'popular'
    const search = (value) => {
      const q = bookQuery(value)
      if (q.length < MIN_BOOK_QUERY) {
        S.libraryNotice = 'Напиши хотя бы две буквы.'
        $.ui.invalidate('ui.render')
        return
      }
      toList({ q })()
    }
    items = [
      back,
      gap,
      tiles([
        Button({ key: `arcade-${short}-lang`, label: `Язык книг: ${BOOK_LANGS[S.bk.lang]}`, ...(S.menuFrom === `${page}:lang` ? { autoFocus: true } : {}), onPress: open(`${page}:lang`) }),
        dim('  разделы и поиск — на этом языке'),
        Button({
          key: `arcade-${short}-mine`,
          label: kind === 'book' ? 'Мои книги' : 'Мои аудиокниги',
          onPress: () => openBook(`mine:${kind}`, kind === 'book' ? '«Мои книги» открыты во встроенном браузере Claude.' : '«Мои аудиокниги» открыты во встроенном браузере Claude.'),
        }),
        dim(kind === 'book' ? '  скачанные в окне Arcade — читать без интернета' : '  скачанные в окне Arcade — слушать без интернета'),
      ]),
      gap,
      Input({ key: `arcade-${short}-find`, label: 'Найти', placeholder: 'название или автор', ...(fromList && state.q ? { autoFocus: true } : {}), onSubmit: search }),
      section('Разделы'),
      tiles(
        Object.entries(BOOK_SECTIONS).map(([id, label]) =>
          Button({ key: `arcade-${short}-sec-${id}`, label, ...(id === focusSection ? { autoFocus: true } : {}), onPress: toList({ section: id }) }),
        ),
        20,
      ),
      gap,
      dim(
        kind === 'book'
          ? 'Книги — из Project Gutenberg и Викитеки, свободные от авторских прав. Arcade их не хранит: книга открывается в окне, скачать её к себе можно там же.'
          : 'Аудиокниги — из LibriVox: их читают вслух добровольцы, записи свободны. Arcade их не хранит: слушать можно сразу в окне, скачать — там же.',
      ),
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}

// ━━━━━━━━━━ screens/notes ━━━━━━━━━━
// Arcade: экран блокнота.

const CHAT_PICK = 8 // чатов в выборе «Отправить в чат» — последние по переписке

// Блокнот: список страниц с подстраницами и «Итоги дня», экран страницы — строки текста, отметки чек-листа,
// «Редактировать» (поле «Текст»), «Копировать», поля «Новый пункт» и «Название», «Отдать Claude», «Отправить в чат»,
// «Удалить». Названия и текст страниц — человека, без перевода (keep)
export function notesScreen($, e, kit) {
  const { Box, Button, Input, Markdown, Text, desktop, dim, gap, hint, noticeLines, now, open, section, tiles } = kit
  let items
  const page = S.menu.startsWith('note:') ? S.notes.find((p) => p.id === S.menu.slice(5)) : null
  if (!page && S.menu !== 'notes') S.menu = 'notes'
  if (nb.confirm && nb.confirm !== page?.id) nb.confirm = null
  if (nb.take && nb.take !== page?.id) nb.take = ''
  if (nb.chat && nb.chat !== page?.id) nb.chat = ''
  // Уйти с экрана: набранное в поле «Текст» — сначала в страницу; не поместилось — остаёмся, заметка скажет почему
  const leave = (target) => async () => {
    if (!(await editNotes($, (list) => list))) return
    // Набранное слилось с правкой другой сессии, но одни строки задели обе: заметка ушла бы вместе с экраном — тостом
    if (nb.bad) $.ui.toast(tr(nb.note, S.lang))
    nb.note = ''
    nb.bad = false
    nb.confirm = null
    nb.focus = ''
    nb.editing = ''
    open(target)()
  }
  const noteLine = nb.note ? [gap, nb.bad ? Text({ color: 'warning', children: [nb.note] }) : dim(nb.note)] : []
  const column = (list) => (desktop ? tiles(list, 44) : Box({ flexDirection: 'column', children: list }))
  // Плитка страницы: название, под ним — сколько пунктов отмечено и первая строка текста
  const pageTile = (p, focus, sub = false) => {
    const { done, total } = checkStats(p.body)
    const first = noteLines(p.body).find((l) => l.kind !== 'blank')?.text.trim() ?? ''
    const about = [total ? `☑ ${done}/${total}` : '', p.link ? `↗ ${p.link.app}` : '', clip(first, 90)].filter(Boolean).join(' · ')
    return [
      keep(Button({ key: `arcade-note-page-${p.id}`, label: sub ? `↳ ${p.title}` : p.title, ...(focus ? { autoFocus: true } : {}), onPress: leave(`note:${p.id}`) })),
      about ? keep(dim(`  ${about}`)) : dim('  пустая страница'),
    ]
  }
  if (!page) {
    // Доски и их карточки — в «Доске проектов»
    const order = notesOrder(S.notes).filter((p) => !isBoard(p) && !isBoard(S.notes.find((b) => b.id === p.parent)))
    const focusId = (order.find((p) => S.menuFrom === `note:${p.id}`) ?? order[0])?.id
    items = [
      Button({ key: 'arcade-back', label: '← Назад', onPress: leave('main') }),
      gap,
      dim('Страницы и подстраницы: заголовки «# », пункты «- », чек-листы «- [ ] ». Хранятся на этом компьютере.'),
      gap,
      Input({
        key: `arcade-note-new-${nb.field}`,
        label: 'Новая страница',
        placeholder: 'название: план на неделю, идеи, покупки…',
        submitLabel: tr('Создать', S.lang),
        ...(order.length ? {} : { autoFocus: true }),
        onSubmit: (value) => createPage($, value),
      }),
      ...noteLine,
      section('Страницы'),
      ...(order.length ? [column(order.flatMap((p) => pageTile(p, p.id === focusId, Boolean(p.parent))))] : [dim('Страниц пока нет — впиши название новой выше.')]),
      gap,
      Button({
        key: 'arcade-note-boards',
        label: 'Доска проектов',
        onPress: async () => {
          await leave('boards')()
          boardsOpened($)
        },
      }),
      dim('  доски с колонками и карточками; общие — с друзьями'),
      Button({ key: 'arcade-note-summary', label: 'Итоги дня', onPress: () => makeSummary($) }),
      dim('  страница для стендапа: что сегодня ушло Claude, что сделано и что ещё в работе'),
      gap,
      Input({
        key: `arcade-note-import-${nb.field}`,
        label: 'Забрать из Notion или другого приложения',
        placeholder: 'ссылка или название страницы',
        submitLabel: tr('Забрать', S.lang),
        onSubmit: (value) => {
          const what = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_URL)
          if (what) return giveClaude($, connectorPrompt('import', { what }), 'ask')
        },
      }),
      dim(CONNECTOR_HINT),
      gap,
      dim('Claude тоже ведёт блокнот: попроси, например, «запиши план в мой блокнот Arcade».'),
      ...noticeLines,
      ...hint,
    ]
  } else {
    const id = page.id
    const parent = page.parent ? S.notes.find((p) => p.id === page.parent) : null
    const children = S.notes.filter((p) => p.parent === id)
    // Задача трекера у карточки — итог в неё кнопкой «Итог — в …» с названием трекера
    const task = trackerTask(page, Boolean(parent && isBoard(parent)))
    const lines = noteLines(page.body)
    // Набранное в поле «Текст» — черновик страницы (nb.draft); from — текст, с которого начали набирать
    const typed = (value) => ({ id, text: String(value ?? ''), from: nb.draft?.id === id ? nb.draft.from : page.body })
    // Правка текста страницы: change(body) → новый текст, null — не помещается
    const editBody = (change, saved = '') =>
      editNotes($,
        (list, at) => {
          const now = list.find((p) => p.id === id)
          if (!now) return list
          const body = change(now.body)
          return body === null ? NOTE_TOO_LONG : body === now.body ? list : updatePage(list, id, { body }, at)
        },
        saved,
      )
    // Отметка пункта: строку ищем заново — текст мог поменяться из поля «Текст» или у Claude
    const toggle = (l) => {
      nb.focus = `line-${l.index}`
      return editBody((body) => {
        const now = noteLines(body)
        const same = now[l.index]?.kind === 'check' && now[l.index].text === l.text ? now[l.index] : now.find((x) => x.kind === 'check' && x.text === l.text)
        if (!same) return body
        nb.focus = `line-${same.index}` // фокус — за пунктом, на какой строке он теперь
        return toggleLine(body, same.index, !same.done)
      })
    }
    const lineItem = (l) => {
      if (l.kind === 'check')
        return keep(
          Button({
            key: `arcade-note-line-${l.index}`,
            label: `${l.done ? '☑' : '☐'} ${l.text}`,
            plain: true,
            ...(l.done ? { dimColor: true } : {}),
            ...(nb.focus === `line-${l.index}` ? { autoFocus: true } : {}),
            onPress: () => toggle(l),
          }),
        )
      if (l.kind === 'h1') return keep(Text(desktop ? { size: 'heading', weight: 'semibold', wrap: 'wrap', children: [l.text] } : { bold: true, wrap: 'wrap', children: [l.text] }))
      if (l.kind === 'h2') return keep(Text(desktop ? { weight: 'semibold', wrap: 'wrap', children: [l.text] } : { bold: true, wrap: 'wrap', children: [l.text] }))
      if (l.kind === 'bullet') return keep(Text({ wrap: 'wrap', children: [`• ${l.text}`] }))
      if (l.kind === 'text') return keep(Text({ wrap: 'wrap', children: [l.text] }))
      return gap
    }
    // Desktop и VS Code: строки между пунктами чек-листа — одним Markdown, как ответ Claude: заголовки, списки, абзацы
    const textBlock = (chunk) => {
      const md = []
      chunk.forEach((l, i) => {
        const nextKind = chunk[i + 1]?.kind
        if (l.kind === 'blank') md.push('')
        else if (l.kind === 'h1' || l.kind === 'h2') md.push(`${l.kind === 'h1' ? '#' : '##'} ${l.text}`)
        // После пункта списка — пустая строка, иначе следующий текст приклеится к пункту
        else if (l.kind === 'bullet') md.push(`- ${l.text}`, ...(nextKind === 'text' ? [''] : []))
        // Строка за строкой — с переносом, а не одним абзацем
        else md.push(`${l.text.trim()}${nextKind === 'text' ? '  ' : ''}`)
      })
      const text = md.join('\n').trim()
      if (!text) return [gap]
      return [...(chunk[0].kind === 'blank' ? [gap] : []), keep(Markdown({ text })), ...(chunk.at(-1).kind === 'blank' ? [gap] : [])]
    }
    const pageItems = (list) => {
      if (!Markdown) return list.map(lineItem)
      const out = []
      let chunk = []
      for (const l of [...list, null]) {
        if (l && l.kind !== 'check') {
          chunk.push(l)
          continue
        }
        if (chunk.length) out.push(...textBlock(chunk))
        chunk = []
        if (l) out.push(lineItem(l))
      }
      return out
    }
    // Просьба про другое приложение: набранное в поле «Текст» — сначала в страницу, Claude получит свежий текст
    const askApp = async (kind, app = page.link?.app ?? '') => {
      if (!(await editNotes($, (list) => list))) return
      const now = S.notes.find((p) => p.id === id)
      if (now) await giveClaude($, connectorPrompt(kind, { page: now, app }), 'ask')
    }
    // Голос: надиктованное (или набранное) в поле ввода Claude — в конец страницы, поле ввода — пустое
    const takePrompt = async () => {
      const { text } = await $.prompt.read().catch(() => ({ text: '' }))
      nb.focus = 'take'
      if (!String(text ?? '').trim()) {
        nb.note = 'Поле ввода Claude пустое — надиктуй или впиши туда текст и нажми ещё раз.'
        nb.bad = true
        $.ui.invalidate('ui.render')
        return
      }
      if (!(await editBody((body) => appendText(body, text), 'Текст из поля ввода Claude — в конце страницы.'))) return
      await $.prompt.fill({ text: '', mode: 'replace' }).catch(() => {})
    }
    const hasText = lines.some((l) => l.kind !== 'blank')
    // Карточка доски проектов: в какой она колонке и кнопки переноса — как на экране доски, кто её взял (общая доска)
    // и срок — он виден на доске и в календаре
    const today = dayKey(now)
    const { base, me, taken } = cardTaker(page)
    const takenItems = taken
      ? [
          keep(dim(`${tr('Взял', S.lang)} ${deskPerson(taken, base)}`)),
          ...(taken === me ? [Button({ key: 'arcade-note-release', label: 'Отпустить карточку', onPress: () => releaseCard($, id) })] : []),
        ]
      : []
    const done = isBoard(parent) && columnOf(page, parent.board.cols) === parent.board.cols.at(-1).id
    const dueItems = [
      Input({
        key: `arcade-note-due-${nb.field}`,
        label: 'Срок',
        value: page.due ?? '',
        placeholder: 'пт, завтра, 20.11, 2026-11-20',
        submitLabel: tr('Сохранить', S.lang),
        onSubmit: (value) => {
          const when = value.trim() ? quickParse(value, page.due || today, today) : null
          if (when && (when.title || when.time || when.repeat)) {
            nb.note = 'Не понял срок: пиши как «пт», «завтра», «20.11» или «2026-11-20».'
            nb.bad = true
            $.ui.invalidate('ui.render')
            return
          }
          if ((when?.day ?? '') === (page.due ?? '')) return
          return editNotes($, (list, at) => updateCard(list, id, { due: when?.day ?? '' }, at), when ? 'Срок поставлен — он виден и в календаре.' : 'Срок убран.')
        },
      }),
      page.due
        ? keep(
            page.due < today && !done
              ? Text({ color: 'warning', children: [`  ${tr('Срок прошёл', S.lang)}: ${dayText(page.due, today)}`] })
              : dim(`  ${tr('Срок', S.lang)}: ${dayText(page.due, today)}`),
          )
        : dim('  Пусто — без срока. Стереть и сохранить — убрать срок.'),
    ]
    // Своя проверка карточки для очереди (app/check): пусто — команда доски
    const boardCmd = isBoard(parent) ? (S.qc.boards[parent.id] ?? '') : ''
    const checkItems =
      isBoard(parent) && !isPrompts(parent)
        ? [
            keep(
              Input({
                key: `arcade-note-check-${nb.field}`,
                label: tr('Своя проверка', S.lang),
                placeholder: boardCmd ? `${tr('как у доски', S.lang)}: ${boardCmd}` : tr('у доски проверки нет', S.lang),
                value: S.qc.cards[id] ?? '',
                submitLabel: tr('Сохранить', S.lang),
                onSubmit: async (value) => {
                  const cmd = await setCheck($, 'cards', id, value)
                  nb.note = cmd ? 'Своя проверка сохранена.' : 'Своей проверки нет — как у доски.'
                  nb.bad = false
                  $.ui.invalidate('ui.render')
                },
              }),
            ),
            dim('  Очередь запустит её вместо проверки доски, когда Claude перенесёт карточку в последнюю колонку. Хранится только на этом компьютере.'),
          ]
        : []
    const cardPlace = isBoard(parent)
      ? [
          ...takenItems,
          keep(dim(`${tr('Колонка', S.lang)}: ${colName(parent.board.cols.find((c) => c.id === columnOf(page, parent.board.cols)) ?? parent.board.cols[0])}`)),
          Box({
            flexDirection: 'row',
            flexWrap: 'wrap',
            columnGap: 2,
            children: [
              ['left', '← Влево'],
              ['up', '↑ Выше'],
              ['down', '↓ Ниже'],
              ['right', 'Вправо →'],
            ].map(([where, label]) =>
              Button({
                key: `arcade-note-move-${where}`,
                label,
                ...(nb.focus === `move-${where}` ? { autoFocus: true } : {}),
                onPress: () => {
                  nb.focus = `move-${where}`
                  return editNotes($, (list, at) => moveCard(list, id, where, at))
                },
              }),
            ),
          }),
          ...dueItems,
          ...checkItems,
        ]
      : []
    // Панель Desktop не даёт выделить текст вне полей ввода: без правки текст виден и копируется кнопкой, поле «Текст» —
    // по «Редактировать», Enter в нём сохраняет и закрывает правку
    const editing = nb.editing === id
    const viewItems = [
      ...(hasText ? pageItems(lines.slice(0, NOTE_LINES)) : [dim('Страница пустая — нажми «Редактировать» или впиши пункт ниже.')]),
      ...(lines.length > NOTE_LINES ? [dim('Дальше — по «Редактировать».')] : []),
      gap,
      Box({
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 2,
        children: [
          Button({
            key: 'arcade-note-edit',
            label: 'Редактировать',
            ...(nb.focus === 'edit' ? { autoFocus: true } : {}),
            onPress: () => {
              nb.editing = id
              nb.focus = 'text'
              $.ui.invalidate('ui.render')
            },
          }),
          ...(hasText
            ? [
                Button({
                  key: 'arcade-note-copy',
                  label: 'Копировать',
                  ...(nb.focus === 'copy' ? { autoFocus: true } : {}),
                  onPress: (press) => {
                    nb.focus = 'copy'
                    return copyPage($, press?.surface ?? e.surface, page.body)
                  },
                }),
              ]
            : []),
        ],
      }),
      gap,
      Input({
        key: `arcade-note-add-${nb.field}`,
        label: 'Новый пункт',
        placeholder: 'пункт чек-листа',
        submitLabel: tr('Добавить', S.lang),
        ...(nb.focus === 'add' ? { autoFocus: true } : {}),
        onSubmit: (value) => {
          // Каждая строка — пункт чек-листа; «- » и «- [ ] » в начале не удваиваем
          const add = String(value ?? '')
            .split(/\r?\n/)
            .map((x) => x.trim().replace(/^[-*] (\[[ xX]\] ?)?/, '').trim())
            .filter(Boolean)
            .map((x) => `- [ ] ${x}`)
            .join('\n')
          if (!add) return
          nb.focus = 'add'
          return editBody((body) => appendText(body, add))
        },
      }),
      gap,
    ]
    const editItems = [
      gap,
      Input({
        key: `arcade-note-text-${nb.field}`,
        label: 'Текст',
        rows: 12,
        value: page.body,
        placeholder: '# Заголовок, - пункт, - [ ] дело',
        submitLabel: tr('Сохранить', S.lang),
        ...(nb.focus === 'text' ? { autoFocus: true } : {}),
        // Набранное — в черновик, без перерисовки: значение поля не трогаем, пока человек пишет. from — текст страницы,
        // с которого начали: его тем временем поменяли (Claude, другая сессия) — при записи обе правки сольются
        onInput: (value) => {
          nb.draft = typed(value)
        },
        onSubmit: async (value) => {
          nb.draft = typed(value)
          nb.focus = 'text'
          if (!(await editNotes($, (list) => list, 'Сохранено.'))) return
          nb.editing = ''
          nb.focus = 'edit'
          $.ui.invalidate('ui.render')
        },
      }),
      dim('Enter — сохранить; новая строка — как в поле ввода Claude.'),
      Button({
        key: 'arcade-note-cancel',
        label: 'Отмена',
        onPress: () => {
          if (nb.draft?.id === id) nb.draft = null
          nb.editing = ''
          nb.field++
          nb.focus = 'edit'
          $.ui.invalidate('ui.render')
        },
      }),
      gap,
    ]
    // «Отправить в чат»: чаты — по нажатию; их список — с сайта, если его ещё не спрашивали
    const picking = nb.chat === id && S.ch.list
    const chatItems = [
      Button({
        key: 'arcade-note-chat',
        label: picking ? 'Не отправлять в чат' : 'Отправить в чат',
        onPress: () => {
          nb.chat = picking ? '' : id
          if (nb.chat && !S.ch.list) loadChats($).then(() => $.ui.invalidate('ui.render'))
          $.ui.invalidate('ui.render')
        },
      }),
      ...(nb.chat !== id
        ? [dim('  друзьям или команде — текстом в чат Arcade')]
        : !S.ch.list
          ? [dim(S.ch.loading ? '  Спрашиваю сайт о чатах…' : '  Не получилось узнать чаты — нажми ещё раз.')]
          : !S.ch.list.length
            ? [dim('  Чатов пока нет — начни переписку в «Чатах».')]
            : [
                Box({
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  columnGap: 2,
                  children: S.ch.list
                    .slice(0, CHAT_PICK)
                    .map((c) => keep(Button({ key: `arcade-note-chat-${c.id}`, label: nb.sending === c.id ? `${tr('Отправляю', S.lang)}…` : `💬 ${chatTitle(c)}`, onPress: () => pageToChat($, id, c.id) }))),
                }),
              ]),
    ]
    items = [
      parent ? keep(Button({ key: 'arcade-back', label: `← ${parent.title}`, onPress: leave(isBoard(parent) ? `board:${parent.id}` : `note:${parent.id}`) })) : Button({ key: 'arcade-back', label: '← Назад', onPress: leave('notes') }),
      keep(section(page.title)),
      ...cardPlace,
      // Правка — поле «Текст» на месте текста; без правки — текст, чек-лист, «Редактировать», «Копировать» и новый пункт
      ...(editing ? editItems : viewItems),
      Button({ key: 'arcade-note-take', label: 'Взять из поля ввода Claude', ...(nb.focus === 'take' ? { autoFocus: true } : {}), onPress: takePrompt }),
      dim('  Перенесёт набранное или надиктованное в поле ввода Claude в конец страницы.'),
      ...(VOICE_HINT[S.platform] ? [dim(VOICE_HINT[S.platform])] : []),
      ...(parent
        ? []
        : [
            section('Подстраницы'),
            ...(children.length ? [column(children.flatMap((c) => pageTile(c, S.menuFrom === `note:${c.id}`)))] : []),
            Input({
              key: `arcade-note-sub-${nb.field}`,
              label: 'Новая подстраница',
              placeholder: 'название',
              submitLabel: tr('Создать', S.lang),
              onSubmit: (value) => createPage($, value, id),
            }),
          ]),
      gap,
      Input({
        key: `arcade-note-title-${nb.field}`,
        label: 'Название',
        value: page.title,
        submitLabel: tr('Сохранить', S.lang),
        onSubmit: (value) => {
          const title = cleanTitle(value)
          if (!title) {
            nb.note = 'Впиши название страницы.'
            nb.bad = true
            $.ui.invalidate('ui.render')
            return
          }
          return editNotes($, (list, at) => (title === page.title ? list : updatePage(list, id, { title }, at)), 'Сохранено.')
        },
      }),
      gap,
      Button({ key: 'arcade-note-send', label: 'Отдать Claude', onPress: () => sendNote($, id) }),
      dim('  Claude получит страницу и сможет отмечать пункты и дописывать её.'),
      ...(task
        ? [
            keep(Button({ key: 'arcade-note-tracker', label: `${tr('Итог — в', S.lang)} ${task.app}`, onPress: () => trackerComment($, id) })),
            dim('  Claude напишет в задачу комментарий: что сделано по карточке. Задачу не закроет и статус не поменяет.'),
          ]
        : []),
      ...(S.acct.session ? chatItems : []),
      section('Notion и другие приложения'),
      ...(page.link
        ? [
            keep(dim(`  ${tr('Связана с', S.lang)} ${page.link.app}: ${page.link.url}`)),
            // Задачу трекера текстом карточки не переписываем: итог в неё — комментарием, кнопкой выше
            ...(taskLink(page.link) || task?.url === page.link.url ? [] : [Button({ key: 'arcade-note-push', label: 'Обновить в приложении', onPress: () => askApp('update') })]),
            Button({ key: 'arcade-note-pull', label: 'Забрать из приложения', onPress: () => askApp('pull') }),
            ...(openUrlCommand(S.platform, page.link.url) ? [Button({ key: 'arcade-note-open', label: 'Открыть в браузере', onPress: () => openLink($, page.link.url) })] : []),
            Button({
              key: 'arcade-note-unlink',
              label: 'Отвязать',
              onPress: () => editNotes($, (list, at) => updatePage(list, id, { link: undefined }, at), 'Страница отвязана.'),
            }),
          ]
        : [
            Button({ key: 'arcade-note-notion', label: 'Отправить в Notion', onPress: () => askApp('push', 'Notion') }),
            Input({
              key: `arcade-note-app-${nb.field}`,
              label: 'В другое приложение',
              placeholder: 'Google Docs, Confluence, Obsidian…',
              submitLabel: tr('Отправить', S.lang),
              onSubmit: (value) => {
                const app = cleanTitle(value).slice(0, MAX_APP)
                if (app) return askApp('push', app)
              },
            }),
          ]),
      dim(CONNECTOR_HINT),
      ...(typeof page.prev === 'string'
        ? [
            Button({
              key: 'arcade-note-undo',
              label: 'Вернуть текст до правки Claude',
              onPress: () =>
                editNotes($,
                  (list, at) => {
                    const now = list.find((p) => p.id === id)
                    return typeof now?.prev === 'string' ? updatePage(list, id, { body: now.prev, prev: undefined }, at) : list
                  },
                  'Прежний текст вернулся.',
                ),
            }),
          ]
        : []),
      gap,
      Button({
        key: 'arcade-note-delete',
        label: nb.confirm === id ? 'Нажми ещё раз — удалить навсегда' : children.length ? 'Удалить страницу и подстраницы' : 'Удалить страницу',
        onPress: async () => {
          if (nb.confirm !== id) {
            nb.confirm = id
            $.ui.invalidate('ui.render')
            return
          }
          nb.confirm = null
          if (nb.draft?.id === id) nb.draft = null
          if (nb.editing === id) nb.editing = ''
          if (!(await editNotes($, (list) => removePage(list, id), 'Страница удалена.'))) return
          nb.focus = ''
          S.menuFrom = null
          S.menu = parent ? (isBoard(parent) ? `board:${parent.id}` : `note:${parent.id}`) : 'notes'
          $.ui.invalidate('ui.render')
        },
      }),
      ...noteLine,
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}

// ━━━━━━━━━━ screens/boards ━━━━━━━━━━
// Arcade: экран досок проектов.

// Доска проектов: список досок и экран доски — колонки с карточками, перенос выбранной карточки кнопками,
// колонки, общий доступ с друзьями. Карточку открывает экран страницы блокнота. Названия досок, колонок и
// карточек, ники — человека, без перевода (keep)
export function boardsScreen($, e, kit) {
  const { Box, Button, Input, Select, TILE_GAP, Text, desktop, dim, gap, hint, makeButton, noticeLines, now, open, section, tileWidth, tiles } = kit
  let items
  if (S.menu.startsWith('note:')) S.menu = `board:${S.menu.slice(5)}`
  const board = S.menu.startsWith('board:') ? S.notes.find((p) => p.id === S.menu.slice(6) && isBoard(p)) : null
  if (!board && S.menu !== 'boards') S.menu = 'boards'
  const share = board?.board.share ?? ''
  const base = share ? S.desks[share] : null
  if (S.dk.confirm && S.dk.confirm !== `delete-${board?.id}` && S.dk.confirm !== `off-${share}`) S.dk.confirm = ''
  const picked = S.dk.pick ? S.notes.find((p) => p.id === S.dk.pick && p.parent === board?.id) : null
  if (!picked) S.dk.pick = ''
  const leave = (target) => () => {
    S.dk.note = ''
    S.dk.bad = false
    S.dk.confirm = ''
    S.dk.pick = ''
    S.dk.focus = ''
    S.dk.picked.clear()
    nb.note = ''
    nb.bad = false
    nb.focus = ''
    open(target)()
  }
  const noteLine = S.dk.note ? [gap, S.dk.bad ? Text({ color: 'warning', children: [S.dk.note] }) : dim(S.dk.note)] : []
  const row = (children) => Box({ flexDirection: 'row', columnGap: 2, children })
  const wrapRow = (children) => Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: desktop ? 'sm' : 0, children })
  // В Desktop строки одной группы — с промежутком по высоте: поля и кнопки иначе слипаются
  const stack = (key, list) => (desktop ? [Box({ key, flexDirection: 'column', rowGap: 'sm', children: list })] : list)
  const strong = (text) => Text(desktop ? { weight: 'semibold', wrap: 'wrap', children: [text] } : { bold: true, children: [text] })
  const column = (list) => (desktop ? tiles(list, 44) : Box({ flexDirection: 'column', children: list }))
  const friends = S.fr.list?.friends ?? []
  const me = S.dk.me || S.ch.me
  const say = (text, bad = true) => {
    S.dk.note = text
    S.dk.bad = bad
    $.ui.invalidate('ui.render')
  }
  // Друзья галочками: кого позвать на доску
  const pickFriends = (list) =>
    wrapRow(
      list.map((p) =>
        keep(
          Button({
            key: `arcade-desk-pick-${p.id}`,
            label: `${S.dk.picked.has(p.id) ? '☑' : '☐'} @${p.handle}`,
            onPress: () => {
              if (S.dk.picked.has(p.id)) S.dk.picked.delete(p.id)
              else S.dk.picked.add(p.id)
              S.dk.note = ''
              S.dk.bad = false
              $.ui.invalidate('ui.render')
            },
          }),
        ),
      ),
    )
  if (!board) {
    const boards = notesOrder(S.notes).filter(isProjectBoard)
    const focusId = (boards.find((b) => S.menuFrom === `board:${b.id}`) ?? boards[0])?.id
    // Плитка доски: название, под ним — сколько карточек и общая ли она
    const boardTile = (b) => {
      const s = b.board.share
      const owner = s ? (S.desks[s]?.owner ?? S.dk.list?.find((x) => x.id === s)?.owner ?? '') : ''
      const shared = !s ? '' : owner && owner !== me ? `${tr('общая, хозяин', S.lang)} ${deskPerson(owner, S.desks[s])}` : tr('общая', S.lang)
      const about = [`${tr('карточек', S.lang)}: ${S.notes.filter((p) => p.parent === b.id).length}`, shared].filter(Boolean).join(' · ')
      return [
        keep(
          Button({
            key: `arcade-desk-${b.id}`,
            label: b.title,
            ...(b.id === focusId ? { autoFocus: true } : {}),
            onPress: () => {
              leave(`board:${b.id}`)()
              if (s && S.desks[s]) syncBoard($, s, { names: true }).catch(modError)
              else if (s && S.acct.session) loadBoards($).catch(modError)
            },
          }),
        ),
        keep(dim(`  ${about}`)),
      ]
    }
    items = [
      Button({ key: 'arcade-back', label: '← Назад', onPress: leave('main') }),
      gap,
      dim('Доски с колонками: «Сделать», «В работе», «Готово» или свои. Карточка — страница блокнота с текстом и чек-листом.'),
      gap,
      Input({
        key: `arcade-board-new-${nb.field}`,
        label: 'Новая доска',
        placeholder: 'название: ремонт, релиз 1.0, переезд…',
        submitLabel: tr('Создать', S.lang),
        ...(boards.length ? {} : { autoFocus: true }),
        onSubmit: (value) => createBoard($, value),
      }),
      ...noteLine,
      section('Доски'),
      ...(boards.length ? [column(boards.flatMap(boardTile))] : [dim('Досок пока нет — впиши название новой выше.')]),
      gap,
      Button({
        key: 'arcade-board-summary',
        label: 'Итоги дня',
        onPress: () => {
          S.dk.note = ''
          S.dk.bad = false
          return makeSummary($)
        },
      }),
      dim('  страница для стендапа: что сегодня ушло Claude, что сделано и что ещё в работе'),
      gap,
      dim(
        S.acct.session
          ? S.dk.loading && !S.dk.list
            ? 'Спрашиваю сайт Arcade об общих досках…'
            : 'Общие доски друзей появляются здесь сами.'
          : 'Войди через GitHub — и сможешь вести доску вместе с друзьями.',
      ),
      dim('Claude тоже ведёт доски: попроси, например, «разложи задачи релиза по доске в Arcade».'),
      ...noticeLines,
      ...hint,
    ]
  } else {
    const id = board.id
    const field = `${nb.field}-${S.dk.field}`
    const isOwner = Boolean(base && me && base.owner === me)
    // Перенос выбранной карточки: фокус остаётся на нажатой кнопке — можно жать её снова
    const move = (where) => {
      S.dk.focus = `move-${where}`
      return editBoard($, (list, at) => moveCard(list, S.dk.pick, where, at))
    }
    const focusOn = (name) => (S.dk.focus === name ? { autoFocus: true } : {})
    // «Задачи из трекера»: какой трекер — выбором из списка (где выбора нет — кнопкой по кругу), откуда — полем.
    // Выбор помнится до конца сессии; по умолчанию — трекер последней карточки-задачи доски
    const tracker = S.dk.tracker?.[id] ?? boardTracker(board, S.notes)
    const setTracker = (value) => {
      S.dk.tracker = { ...(S.dk.tracker ?? {}), [id]: value }
      S.dk.focus = 'tracker'
      S.dk.note = ''
      $.ui.invalidate('ui.render')
    }
    const trackerOptions = TRACKERS.map((k) => ({ value: k, label: tr(TRACKER_NAMES[k], S.lang) }))
    const TRACKER_FIELD = {
      github: ['owner/repo или ссылка на задачи', 'Впиши репозиторий GitHub (owner/repo) или ссылку на задачи.'],
      linear: ['ключ команды (ENG) или ссылка', 'Впиши ключ команды Linear или ссылку на задачи.'],
      jira: ['ключ проекта (PROJ) или ссылка', 'Впиши ключ проекта Jira или ссылку на задачи.'],
      other: ['ссылка или название: ClickUp, Asana…', 'Впиши ссылку на задачи или название трекера.'],
    }[tracker]
    const trackerItems = [
      Select
        ? keep(Select({ key: 'arcade-board-tracker', label: tr('Трекер', S.lang), options: trackerOptions, value: tracker, ...focusOn('tracker'), onSelect: setTracker }))
        : keep(
            Button({
              key: 'arcade-board-tracker',
              label: `${tr('Трекер', S.lang)}: ${tr(TRACKER_NAMES[tracker], S.lang)}`,
              ...focusOn('tracker'),
              onPress: () => setTracker(TRACKERS[(TRACKERS.indexOf(tracker) + 1) % TRACKERS.length]),
            }),
          ),
      Input({
        key: `arcade-board-tasks-${field}`,
        label: 'Задачи из трекера',
        placeholder: TRACKER_FIELD[0],
        submitLabel: tr('Забрать', S.lang),
        onSubmit: (value) => {
          const what = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
          if (!what) return say(TRACKER_FIELD[1])
          return importIssues($, id, tracker, what)
        },
      }),
    ]
    // Карточка: первое нажатие выбирает её, второе — открывает
    const cardButton = (c) => {
      const mark = c.id === S.dk.pick
      const label = `${mark ? '▸ ' : ''}${c.title}`
      const props = {
        key: `arcade-card-${c.id}`,
        label,
        ...(S.dk.focus === `card-${c.id}` || (!S.dk.focus && S.menuFrom === `note:${c.id}`) ? { autoFocus: true } : {}),
        onPress: () => {
          if (mark) return leave(`note:${c.id}`)()
          S.dk.pick = c.id
          S.dk.focus = `card-${c.id}`
          S.dk.note = ''
          S.dk.bad = false
          $.ui.invalidate('ui.render')
        },
      }
      return keep(desktop ? makeButton({ ...props, children: [Text({ wrap: 'wrap', children: [label] })] }) : Button(props))
    }
    // Под карточкой: сколько пунктов отмечено, срок (прошёл, а карточка не в последней колонке, — цветом беды), кто
    // её взял на общей доске, какая сессия Claude Code на этом компьютере её делает и не прошла ли она проверку очереди
    const today = dayKey(now)
    const lastCol = board.board.cols.at(-1).id
    const cardAbout = (card, col) => {
      const { done, total } = checkStats(card.body)
      const { taken } = cardTaker(card)
      const late = card.due && card.due < today && col !== lastCol
      const by = col === lastCol ? null : sessionOf(card.id)
      const session = by ? (by.me ? tr('у этой сессии', S.lang) : fill(tr('у сессии «{0}»', S.lang), [by.name])) : ''
      const failed = hasMark(card.body)
      const parts = [failed ? `⚠ ${tr('проверка не прошла', S.lang)}` : '', total ? `☑ ${done}/${total}` : '', card.due ? `📅 ${dayText(card.due, today)}` : '', taken ? `${tr('в работе у', S.lang)} ${deskPerson(taken, base)}` : '', session]
      const text = parts.filter(Boolean).join(' · ')
      if (!text) return []
      return [keep(late || failed ? Text({ color: 'warning', children: [`  ${text}`] }) : dim(`  ${text}`))]
    }
    const columnBox = (c) => {
      const cards = columnCards(S.notes, board, c.id)
      const children = [
        keep(strong(`${colName(c)} · ${cards.length}`)),
        ...cards.flatMap((card) => [cardButton(card), ...cardAbout(card, c.id)]),
        ...(cards.length ? [] : [dim('пусто')]),
        // В Desktop колонка узкая: без подписи слева поле занимает всю её ширину, подсказка — в самом поле
        Input({
          key: `arcade-card-new-${c.id}-${nb.field}`,
          ...(desktop ? { placeholder: 'Новая карточка' } : { label: 'Новая карточка', placeholder: 'что сделать' }),
          submitLabel: tr('Добавить', S.lang),
          ...focusOn(`new-${c.id}`),
          onSubmit: (value) => createCard($, id, c.id, value),
        }),
      ]
      return desktop
        ? Box({ key: `col-${c.id}`, flexDirection: 'column', rowGap: 'xs', borderStyle: 'round', borderColor: 'subtle', padding: 'sm', width: tileWidth(28), children })
        : Box({ key: `col-${c.id}`, flexDirection: 'column', borderStyle: 'round', borderDimColor: true, paddingX: 1, children })
    }
    const cols = board.board.cols.map(columnBox)
    const shareLine = !share
      ? []
      : [keep(dim(isOwner ? tr('Общая доска — ты хозяин.', S.lang) : base?.owner ? `${tr('Общая доска, хозяин', S.lang)} ${deskPerson(base.owner, base)}.` : tr('Общая доска.', S.lang)))]
    const trouble = share && S.dk.trouble?.share === share ? [Text({ color: 'warning', children: [S.dk.trouble.text] })] : []
    const pickBar = picked
      ? [
          keep(dim(`${tr('Выбрана карточка', S.lang)}: ${picked.title}`)),
          wrapRow([
            Button({ key: 'arcade-board-left', label: '← Влево', ...focusOn('move-left'), onPress: () => move('left') }),
            Button({ key: 'arcade-board-up', label: '↑ Выше', ...focusOn('move-up'), onPress: () => move('up') }),
            Button({ key: 'arcade-board-down', label: '↓ Ниже', ...focusOn('move-down'), onPress: () => move('down') }),
            Button({ key: 'arcade-board-right', label: 'Вправо →', ...focusOn('move-right'), onPress: () => move('right') }),
            Button({ key: 'arcade-board-open', label: 'Открыть', onPress: leave(`note:${picked.id}`) }),
            Button({
              key: 'arcade-board-unpick',
              label: 'Снять выбор',
              onPress: () => {
                S.dk.focus = `card-${picked.id}`
                S.dk.pick = ''
                $.ui.invalidate('ui.render')
              },
            }),
          ]),
        ]
      : [dim('Нажми на карточку, чтобы выбрать её и переносить стрелками; ещё раз — открыть.')]
    // Общий доступ: войти, взять @ник, поделиться с друзьями; у общей — участники, позвать ещё, удалить или выйти.
    // Действия — плитками с описанием, как в настройках; друзья галочками — над плиткой «Поделиться» или «Позвать»
    let shareItems
    if (!S.acct.session)
      shareItems = [
        tiles(
          [
            Button({
              key: 'arcade-board-login',
              label: S.acct.starting ? 'Готовлю вход…' : 'Войти через GitHub',
              onPress: () => {
                S.acct.confirmDelete = false
                leave('account')()
                startLogin($)
              },
            }),
            dim('Войди через GitHub — и сможешь вести доску вместе с друзьями.'),
          ],
          40,
        ),
      ]
    else if (!share && !S.acct.handle)
      shareItems = [tiles([Button({ key: 'arcade-board-handle', label: 'Взять @ник', onPress: leave('account') }), dim('Звать друзей на доску можно, когда у тебя есть @ник.')], 40)]
    else if (!share && friends.length)
      shareItems = [
        dim('Отметь друзей и нажми «Поделиться» — доска станет общей: карточки, колонки и название у всех одни.'),
        pickFriends(friends),
        tiles(
          [
            Button({ key: 'arcade-board-share', label: S.dk.busy === 'share' ? 'Делюсь…' : 'Поделиться', onPress: () => shareBoard($, id) }),
            dim('  Отмеченные друзья увидят доску у себя и смогут её вести.'),
          ],
          40,
        ),
      ]
    else if (!share)
      shareItems = [
        tiles(
          [
            Button({
              key: 'arcade-board-friends',
              label: 'Друзья',
              onPress: () => {
                S.fr.note = ''
                S.fr.bad = false
                leave('friends')()
                friendsCall($, 'friends').catch(modError)
              },
            }),
            dim(S.fr.list ? 'Друзей пока нет — добавь кого-нибудь по @нику.' : S.fr.loading ? 'Загружаю друзей…' : 'Список друзей не загрузился.'),
          ],
          40,
        ),
      ]
    else if (!base || !me) shareItems = [dim('Сверяю доску с сайтом Arcade…')]
    else {
      const others = friends.filter((p) => !base.members.includes(p.id))
      const people = [base.owner, ...base.members.filter((m) => m !== base.owner)].filter(Boolean)
      const invite = isOwner && others.length && base.members.length < MAX_MEMBERS
      shareItems = [
        ...people.map((m) =>
          m === base.owner
            ? keep(Text({ children: [`${deskPerson(m, base)} · ${tr('хозяин доски', S.lang)}`] }))
            : isOwner
              ? row([keep(Text({ children: [deskPerson(m, base)] })), Button({ key: `arcade-desk-drop-${m}`, label: 'Убрать', onPress: () => boardMembers($, share, { remove: [m] }, 'Участник убран.') })])
              : keep(Text({ children: [deskPerson(m, base)] })),
        ),
        ...(invite ? [gap, dim('Позвать ещё:'), pickFriends(others)] : []),
        gap,
        tiles(
          [
            ...(invite
              ? [
                  Button({
                    key: 'arcade-board-invite',
                    label: S.dk.busy === 'add' ? 'Зову…' : 'Позвать',
                    onPress: () => (S.dk.picked.size ? boardMembers($, share, { add: [...S.dk.picked] }, 'Друзья позваны.') : say('Отметь хотя бы одного друга.')),
                  }),
                  dim('  Отмеченные друзья увидят доску у себя и смогут её вести.'),
                ]
              : []),
            Button({
              key: 'arcade-board-off',
              label:
                S.dk.confirm === `off-${share}`
                  ? isOwner
                    ? 'Нажми ещё раз — удалить с сайта'
                    : 'Нажми ещё раз — выйти с доски'
                  : isOwner
                    ? 'Удалить с сайта'
                    : 'Выйти с доски',
              onPress: () => unshareBoard($, share),
            }),
            dim(isOwner ? '  У тебя и у друзей доска останется — каждому своя копия.' : '  У тебя останется своя копия доски, у друзей — общая.'),
          ],
          40,
        ),
      ]
    }
    // Очередь для Claude на этой доске: какую карточку он делает и сколько уже отдано
    const queued = S.queue?.board === id
    const queueCard = queued ? S.notes.find((p) => p.id === S.queue.card) : null
    const queueLine = queued && queueCard ? [keep(dim(`  ${tr('Очередь: Claude делает', S.lang)} «${queueCard.title}» · ${tr('отдано карточек', S.lang)} — ${S.queue.given.length}`))] : []
    // Очередь этой доски в других сессиях на этом компьютере: какие — по папке
    const mates = boardMates(id)
    const matesLine = mates.length ? [keep(dim(`  ${fill(tr('Очередь идёт и в других сессиях: {0}', S.lang), [mates.map((r) => `«${r.name}»`).join(', ')])}`))] : []
    // Кончился лимит Claude посреди очереди этой доски: продолжить после сброса — кнопкой, уже ждёт — когда и «Не
    // продолжать»; не продолжилась (сессию закрыли, компьютер спал) — заметка с крестиком. Здесь же — продолжать сама
    const waitHere = S.qr.wait?.board === id ? S.qr.wait : null
    const offerHere = !waitHere && S.qr.offer?.board === id && now < S.qr.offer.at ? S.qr.offer : null
    const armed = S.qr.armed.includes(id)
    const resumeTiles = [
      ...(waitHere ? [Button({ key: 'arcade-board-resume-off', label: 'Не продолжать', onPress: () => cancelWait($) }), keep(dim(`  ${fill(tr('Очередь продолжится в {0}.', S.lang), [clockText(waitHere.at, now)])}`))] : []),
      ...(offerHere
        ? [
            Button({ key: 'arcade-board-resume', label: fill(tr('Продолжить очередь после сброса в {0}', S.lang), [clockText(offerHere.at, now)]), onPress: () => waitFor($, offerHere) }),
            dim('  Claude продолжит с той же карточки, пока Claude Code открыт и компьютер не спит.'),
          ]
        : []),
      Button({ key: 'arcade-board-resume-auto', label: `Продолжать очередь после сброса лимита: ${armed ? 'да' : 'нет'}`, onPress: () => armBoard($, id, !armed) }),
      dim('  кончился лимит Claude — очередь встанет и сама продолжится после сброса'),
    ]
    // Проверка между карточками очереди (app/check): команда — только этого компьютера и задаётся только здесь; идёт —
    // какая и после какой карточки; последний итог — с концом вывода
    const running = S.qc.running?.board === id ? S.qc.running : null
    const lastCheck = running ? null : S.qc.last[id]
    const checkItems = [
      keep(
        Input({
          key: `arcade-board-check-${field}`,
          label: tr('Проверка между карточками', S.lang),
          placeholder: 'npm test',
          value: S.qc.boards[id] ?? '',
          submitLabel: tr('Сохранить', S.lang),
          onSubmit: async (value) => {
            const cmd = await setCheck($, 'boards', id, value)
            say(cmd ? 'Проверка сохранена: очередь запустит её после каждой карточки.' : 'Проверки нет: очередь не проверяет карточки.', false)
          },
        }),
      ),
      dim('  Claude перенёс карточку в последнюю колонку — очередь запускает команду в папке сессии. Код 0 — следующая карточка; иначе карточка вернётся во вторую колонку, а Claude получит конец вывода. Команда идёт без запроса разрешения, как хук Claude Code, и хранится только на этом компьютере: ни Claude, ни участники доски её не поменяют.'),
      ...(running ? [keep(dim(`  ${fill(tr('Идёт проверка после «{0}»: {1}', S.lang), [running.title, running.cmd])}`))] : []),
      ...(lastCheck
        ? [
            keep(
              lastCheck.ok
                ? dim(`  ✓ ${fill(tr('Проверка после «{0}» прошла', S.lang), [lastCheck.title])} · ${hhmm(lastCheck.at)}`)
                : Text({ color: 'warning', children: [`  ⚠ ${fill(tr('Проверка после «{0}» не прошла', S.lang), [lastCheck.title])} — ${codeText(lastCheck.code)} · ${hhmm(lastCheck.at)}`] }),
            ),
            ...(lastCheck.ok ? [] : lastCheck.tail.split('\n').slice(-5).filter(Boolean).map((l) => keep(dim(`    ${l.slice(0, 200)}`)))),
          ]
        : []),
    ]
    const missedHere = S.qr.missed.filter((m) => m.board === id)
    const missedLines = missedHere.map((m) =>
      Box({ key: `arcade-board-missed-${id}`, flexDirection: 'row', columnGap: 2, children: [keep(Text({ color: 'warning', children: [`  ${m.text}`] })), Button({ key: 'arcade-board-missed-off', label: '×', plain: true, dimColor: true, onPress: () => missedClear($, id) })] }),
    )
    // «Остановить везде» — пока очередь идёт здесь или в другой сессии
    const stopAll =
      queued || mates.length
        ? [
            Button({ key: 'arcade-board-queue-all', label: 'Остановить везде', onPress: () => stopEverywhere($, id) }),
            dim('  Все сессии доделают текущие карточки и новых не возьмут.'),
          ]
        : []
    // Удалить доску можно, пока она не общая: общую сначала удаляют с сайта или выходят с неё. Плитка — рядом
    // с «Отдать Claude»
    const deleteItems =
      share && S.acct.session
        ? []
        : [
            Button({
              key: 'arcade-board-delete',
              label: S.dk.confirm === `delete-${id}` ? 'Нажми ещё раз — удалить навсегда' : 'Удалить доску',
              onPress: async () => {
                if (S.dk.confirm !== `delete-${id}`) {
                  S.dk.confirm = `delete-${id}`
                  return $.ui.invalidate('ui.render')
                }
                S.dk.confirm = ''
                if (S.notes.some((p) => p.id === nb.draft?.id && p.parent === id)) nb.draft = null
                if (!(await editBoard($, (list) => removePage(list, id), 'Доска удалена.'))) return
                if (share) await forgetDesk($, share)
                S.dk.pick = ''
                S.dk.focus = ''
                S.menuFrom = null
                S.menu = 'boards'
                $.ui.invalidate('ui.render')
              },
            }),
            dim('  Доска удалится вместе с колонками и карточками.'),
          ]
    items = [
      Button({
        key: 'arcade-back',
        label: '← Доски',
        onPress: () => {
          leave('boards')()
          if (S.acct.session) loadBoards($, true).catch(modError)
        },
      }),
      keep(section(board.title)),
      ...shareLine,
      ...trouble,
      ...pickBar,
      desktop ? Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: TILE_GAP, rowGap: 'md', children: cols }) : Box({ flexDirection: 'column', children: cols }),
      ...noteLine,
      section('Доска'),
      Input({
        key: `arcade-board-title-${field}`,
        label: 'Название',
        value: board.title,
        submitLabel: tr('Сохранить', S.lang),
        onSubmit: (value) => {
          const title = cleanTitle(value)
          if (!title) return say('Впиши название доски.')
          return editBoard($, (list, at) => (title === board.title ? list : updatePage(list, id, { title }, at)), 'Сохранено.')
        },
      }),
      gap,
      tiles(
        [
          Button({ key: 'arcade-board-send', label: 'Отдать Claude', onPress: () => sendBoard($, id) }),
          dim('  Claude получит доску с карточками и сможет добавлять, править и переносить их.'),
          Button({ key: 'arcade-board-queue', label: queued ? 'Остановить очередь' : 'Очередь для Claude', onPress: () => (queued ? endQueue($) : startQueue($, id)) }),
          dim('  Claude по очереди берёт карточки из первой колонки: следующую — когда перенесёт прошлую в последнюю. Задаст вопрос или не доделает — очередь встанет.'),
          ...stopAll,
          ...resumeTiles,
          ...deleteItems,
        ],
        40,
      ),
      ...queueLine,
      ...matesLine,
      ...missedLines,
      gap,
      ...checkItems,
      gap,
      // Задачи трекера — карточками через коннектор Claude: Arcade с трекерами не говорит, ключи ему не нужны
      ...trackerItems,
      dim('  Claude заберёт открытые задачи карточками через коннектор трекера. Итог по карточке он напишет в задачу кнопкой «Итог — в …» на карточке.'),
      section('Колонки'),
      // В Desktop у полей колонок нет подписи слева (название и так в поле): подписи разной длины сдвигали поля
      // и кнопки вразнобой. «Убрать колонку» — в той же строке, что и поле
      ...stack('board-cols', [
        ...board.board.cols.flatMap((c) => {
          const name = keep(
            Input({
              key: `arcade-col-name-${c.id}-${field}`,
              ...(desktop ? {} : { label: colName(c) }),
              value: colName(c),
              submitLabel: tr('Сохранить', S.lang),
              onSubmit: (value) => {
                if (cleanTitle(value) === colName(c)) return
                return editBoard($,
                  (list, at) => {
                    const done = renameColumn(list, id, c.id, value, at)
                    return done.error ? 'Впиши название колонки.' : done.notes
                  },
                  'Сохранено.',
                )
              },
            }),
          )
          const drop =
            board.board.cols.length > 1
              ? [
                  Button({
                    key: `arcade-col-drop-${c.id}`,
                    label: 'Убрать колонку',
                    onPress: () =>
                      editBoard($,
                        (list, at) => {
                          const done = removeColumn(list, id, c.id, at)
                          if (done.error === 'busy') return 'В колонке есть карточки — сначала перенеси их.'
                          if (done.error === 'last') return 'Последнюю колонку не убрать.'
                          return done.error ? list : done.notes
                        },
                        'Колонка убрана.',
                      ),
                  }),
                ]
              : []
          return desktop ? [Box({ key: `col-row-${c.id}`, flexDirection: 'row', alignItems: 'center', columnGap: 'sm', children: [name, ...drop] })] : [name, ...drop]
        }),
        Input({
          key: `arcade-col-new-${field}`,
          ...(desktop ? { placeholder: 'Новая колонка' } : { label: 'Новая колонка', placeholder: 'название: проверка, на паузе…' }),
          submitLabel: tr('Добавить', S.lang),
          ...focusOn('col-new'),
          onSubmit: (value) => {
            S.dk.focus = 'col-new'
            return editBoard($, (list, at) => {
              const done = addColumn(list, id, value, colId(), at)
              return done.error === 'many' ? 'Колонок — не больше 8.' : done.error ? 'Впиши название колонки.' : done.notes
            })
          },
        }),
      ]),
      section('Общий доступ'),
      ...stack('board-share', shareItems),
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}

// ━━━━━━━━━━ screens/prompts ━━━━━━━━━━
// Arcade: экран «Промпты» — шаблоны промптов в один клик.

// «Промпты»: наборы шаблонов (доски с одной колонкой, notes.isPrompts), под каждым — его шаблоны кнопками: нажать —
// шаблон уходит Claude, как «Отдать Claude», «В поле ввода» — вставить без отправки, ✎ — открыть шаблон на правку.
// Настройки набора — название, общий доступ с друзьями (как у общей доски) и удаление. Названия и текст шаблонов,
// названия наборов и ники — человека, без перевода (keep)
export function promptsScreen($, e, kit) {
  const { Box, Button, Input, Text, desktop, dim, gap, hint, noticeLines, open, section, tiles } = kit
  // Набор или шаблон открыли страницей блокнота (board:… или note:…) — экран забирает их к себе
  if (S.menu !== 'prompts') {
    const id = S.menu.startsWith('board:') ? S.menu.slice(6) : S.menu.slice(5)
    const page = S.notes.find((p) => p.id === id)
    if (isPrompts(page)) pr.set = id
    else if (page) pr.edit = id
    S.menu = 'prompts'
  }
  const editing = pr.edit ? S.notes.find((p) => p.id === pr.edit) : null
  const parentSet = editing ? S.notes.find((p) => p.id === editing.parent) : null
  if (!editing || !isPrompts(parentSet)) pr.edit = ''
  const setPage = !pr.edit && pr.set ? S.notes.find((p) => p.id === pr.set && isPrompts(p)) : null
  if (!setPage) pr.set = ''
  const share = (pr.edit ? parentSet : setPage)?.board.share ?? ''
  if (pr.confirm && pr.confirm !== `card:${pr.edit}` && pr.confirm !== `set:${pr.set}`) pr.confirm = ''
  if (S.dk.confirm && S.dk.confirm !== `off-${share}`) S.dk.confirm = ''
  const me = S.dk.me || S.ch.me
  const friends = S.fr.list?.friends ?? []
  const refresh = () => $.ui.invalidate('ui.render')
  const focusOn = (name) => (pr.focus === name ? { autoFocus: true } : {})
  const say = (text, bad = true) => {
    pr.note = text
    pr.bad = bad
    refresh()
  }
  // Уйти с экрана: набранное в поле «Текст» шаблона — сначала в шаблон; не поместилось — остаёмся
  const leave = (target) => async () => {
    if (pr.edit && nb.draft?.id === pr.edit && !(await editPrompts($, (list) => list))) return
    if (nb.draft?.id === pr.edit) nb.draft = null
    pr.note = ''
    pr.bad = false
    pr.confirm = ''
    pr.edit = ''
    pr.set = ''
    pr.focus = ''
    S.dk.note = ''
    S.dk.bad = false
    S.dk.confirm = ''
    S.dk.picked.clear()
    open(target)()
  }
  // К списку наборов — из шаблона или настроек набора; focus — кнопка, на которой окажется фокус
  const toList = (focus) => {
    pr.edit = ''
    pr.set = ''
    pr.confirm = ''
    pr.focus = focus
    pr.field++
    S.dk.confirm = ''
    S.dk.picked.clear()
    refresh()
  }
  const noteText = (text, bad) => (bad ? Text({ color: 'warning', children: [text] }) : dim(text))
  const noteLine = [
    ...(pr.note ? [noteText(pr.note, pr.bad)] : []),
    ...(S.dk.note ? [noteText(promptNote(S.dk.note), S.dk.bad)] : []),
    ...(share && S.dk.trouble?.share === share ? [Text({ color: 'warning', children: [promptNote(S.dk.trouble.text)] })] : []),
  ]
  const notes = noteLine.length ? [gap, ...noteLine] : []
  const row = (key, children) => Box({ key, flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: desktop ? 'sm' : 0, children })
  // В Desktop строки одной группы — с промежутком по высоте: поля и кнопки иначе слипаются
  const stack = (key, list) => (desktop ? [Box({ key, flexDirection: 'column', rowGap: 'sm', children: list })] : list)
  // Общий ли набор и чей: строка под названием
  const shareAbout = (set) => {
    const s = set.board.share
    if (!s) return ''
    const owner = S.desks[s]?.owner ?? S.dk.list?.find((x) => x.id === s)?.owner ?? ''
    return owner && owner !== me ? `${tr('общий, хозяин', S.lang)} ${deskPerson(owner, S.desks[s])}` : tr('общий', S.lang)
  }
  // Первая строка текста шаблона — под его кнопкой
  const preview = (card) => {
    const first = card.body.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
    return first ? keep(dim(`  ${clip(first, 90)}`)) : dim('  текста пока нет')
  }
  let items
  if (pr.edit) {
    const card = editing
    const id = card.id
    const typed = (value) => ({ id, text: String(value ?? ''), from: nb.draft?.id === id ? nb.draft.from : card.body })
    const move = (where) => {
      pr.focus = where
      return editPrompts($, (list, at) => moveCard(list, id, where, at))
    }
    items = [
      Button({
        key: 'arcade-back',
        label: '← Промпты',
        onPress: async () => {
          if (nb.draft?.id === id && !(await editPrompts($, (list) => list))) return
          if (nb.draft?.id === id) nb.draft = null
          toList(`send-${id}`)
        },
      }),
      keep(section(card.title)),
      keep(dim(`${tr('Набор', S.lang)}: ${parentSet.title}${share ? ` · ${shareAbout(parentSet)}` : ''}`)),
      ...notes,
      gap,
      ...stack('prompt-edit', [
        Input({
          key: `arcade-prompt-title-${pr.field}`,
          label: 'Название',
          value: card.title,
          submitLabel: tr('Сохранить', S.lang),
          onSubmit: (value) => {
            const title = cleanTitle(value)
            if (!title) return say('Впиши название шаблона.')
            return editPrompts($, (list, at) => (title === card.title ? list : updatePage(list, id, { title }, at)), 'Сохранено.')
          },
        }),
        // Набранное — в черновик, без перерисовки, как в поле «Текст» страницы блокнота: при записи правка из другой
        // сессии или от друзей сольётся с набранным
        Input({
          key: `arcade-prompt-text-${pr.field}`,
          label: 'Текст',
          rows: 12,
          value: card.body,
          placeholder: 'что написать Claude: «Сделай ревью изменений: ошибки, тесты, имена»',
          submitLabel: tr('Сохранить', S.lang),
          ...focusOn('text'),
          onInput: (value) => {
            nb.draft = typed(value)
          },
          onSubmit: (value) => {
            nb.draft = typed(value)
            pr.focus = 'text'
            return editPrompts($, (list) => list, 'Сохранено.')
          },
        }),
      ]),
      dim('Enter — сохранить; новая строка — как в поле ввода Claude.'),
      gap,
      tiles(
        [
          Button({
            key: 'arcade-prompt-send',
            label: 'Отправить Claude',
            ...focusOn('send'),
            onPress: () => {
              pr.focus = 'send'
              return sendPrompt($, id)
            },
          }),
          dim('  Сразу, если Claude свободен; занят — шаблон ждёт в поле ввода.'),
          Button({
            key: 'arcade-prompt-field',
            label: 'В поле ввода',
            ...focusOn('field'),
            onPress: () => {
              pr.focus = 'field'
              return promptToField($, id)
            },
          }),
          dim('  Вставит шаблон к набранному в поле ввода, без отправки.'),
        ],
        40,
      ),
      row('prompt-move', [
        Button({ key: 'arcade-prompt-up', label: '↑ Выше', ...focusOn('up'), onPress: () => move('up') }),
        Button({ key: 'arcade-prompt-down', label: '↓ Ниже', ...focusOn('down'), onPress: () => move('down') }),
      ]),
      gap,
      tiles(
        [
          Button({
            key: 'arcade-prompt-delete',
            label: pr.confirm === `card:${id}` ? 'Нажми ещё раз — удалить шаблон' : 'Удалить шаблон',
            onPress: async () => {
              if (pr.confirm !== `card:${id}`) {
                pr.confirm = `card:${id}`
                return refresh()
              }
              pr.confirm = ''
              if (nb.draft?.id === id) nb.draft = null
              if (!(await editPrompts($, (list) => removePage(list, id), 'Шаблон удалён.'))) return
              toList(`new-${parentSet.id}`)
            },
          }),
          dim(share ? '  Шаблон удалится у всех в наборе.' : '  Шаблон удалится насовсем.'),
        ],
        40,
      ),
      ...noticeLines,
      ...hint,
    ]
  } else if (pr.set) {
    const set = setPage
    const id = set.id
    const base = share ? S.desks[share] : null
    const isOwner = Boolean(base && me && base.owner === me)
    const pickFriends = (list) =>
      row(
        'prompt-pick',
        list.map((p) =>
          keep(
            Button({
              key: `arcade-prompt-pick-${p.id}`,
              label: `${S.dk.picked.has(p.id) ? '☑' : '☐'} @${p.handle}`,
              onPress: () => {
                if (S.dk.picked.has(p.id)) S.dk.picked.delete(p.id)
                else S.dk.picked.add(p.id)
                S.dk.note = ''
                S.dk.bad = false
                refresh()
              },
            }),
          ),
        ),
      )
    // Общий доступ — как у общей доски: войти, взять @ник, поделиться с друзьями; у общего — участники, позвать ещё,
    // удалить с сайта или выйти
    let shareItems
    if (!S.acct.session)
      shareItems = [
        tiles(
          [
            Button({
              key: 'arcade-prompt-login',
              label: S.acct.starting ? 'Готовлю вход…' : 'Войти через GitHub',
              onPress: async () => {
                S.acct.confirmDelete = false
                await leave('account')()
                startLogin($)
              },
            }),
            dim('Войди через GitHub — и сможешь вести набор вместе с друзьями.'),
          ],
          40,
        ),
      ]
    else if (!share && !S.acct.handle) shareItems = [tiles([Button({ key: 'arcade-prompt-handle', label: 'Взять @ник', onPress: leave('account') }), dim('Звать друзей в набор можно, когда у тебя есть @ник.')], 40)]
    else if (!share && friends.length)
      shareItems = [
        dim('Отметь друзей и нажми «Поделиться» — набор станет общим: шаблоны и название у всех одни.'),
        pickFriends(friends),
        tiles([Button({ key: 'arcade-prompt-share', label: S.dk.busy === 'share' ? 'Делюсь…' : 'Поделиться', onPress: () => shareBoard($, id) }), dim('  Отмеченные друзья увидят набор у себя и смогут его вести.')], 40),
      ]
    else if (!share)
      shareItems = [
        tiles(
          [
            Button({
              key: 'arcade-prompt-friends',
              label: 'Друзья',
              onPress: async () => {
                S.fr.note = ''
                S.fr.bad = false
                await leave('friends')()
                friendsCall($, 'friends').catch(modError)
              },
            }),
            dim(S.fr.list ? 'Друзей пока нет — добавь кого-нибудь по @нику.' : S.fr.loading ? 'Загружаю друзей…' : 'Список друзей не загрузился.'),
          ],
          40,
        ),
      ]
    else if (!base || !me) shareItems = [dim('Сверяю набор с сайтом Arcade…')]
    else {
      const others = friends.filter((p) => !base.members.includes(p.id))
      const people = [base.owner, ...base.members.filter((m) => m !== base.owner)].filter(Boolean)
      const invite = isOwner && others.length && base.members.length < MAX_MEMBERS
      shareItems = [
        ...people.map((m) =>
          m === base.owner
            ? keep(Text({ children: [`${deskPerson(m, base)} · ${tr('хозяин набора', S.lang)}`] }))
            : isOwner
              ? row(`prompt-member-${m}`, [keep(Text({ children: [deskPerson(m, base)] })), Button({ key: `arcade-prompt-drop-${m}`, label: 'Убрать', onPress: () => boardMembers($, share, { remove: [m] }, 'Участник убран.') })])
              : keep(Text({ children: [deskPerson(m, base)] })),
        ),
        ...(invite ? [gap, dim('Позвать ещё:'), pickFriends(others)] : []),
        gap,
        tiles(
          [
            ...(invite
              ? [
                  Button({
                    key: 'arcade-prompt-invite',
                    label: S.dk.busy === 'add' ? 'Зову…' : 'Позвать',
                    onPress: () => {
                      if (S.dk.picked.size) return boardMembers($, share, { add: [...S.dk.picked] }, 'Друзья позваны.')
                      S.dk.note = 'Отметь хотя бы одного друга.'
                      S.dk.bad = true
                      refresh()
                    },
                  }),
                  dim('  Отмеченные друзья увидят набор у себя и смогут его вести.'),
                ]
              : []),
            Button({
              key: 'arcade-prompt-off',
              label:
                S.dk.confirm === `off-${share}`
                  ? isOwner
                    ? 'Нажми ещё раз — удалить с сайта'
                    : 'Нажми ещё раз — выйти из набора'
                  : isOwner
                    ? 'Удалить с сайта'
                    : 'Выйти из набора',
              onPress: () => unshareBoard($, share),
            }),
            dim(isOwner ? '  У тебя и у друзей набор останется — каждому своя копия.' : '  У тебя останется своя копия набора, у друзей — общий.'),
          ],
          40,
        ),
      ]
    }
    const shareLine = !share
      ? []
      : [keep(dim(isOwner ? tr('Общий набор — ты хозяин.', S.lang) : base?.owner ? `${tr('Общий набор, хозяин', S.lang)} ${deskPerson(base.owner, base)}.` : tr('Общий набор.', S.lang)))]
    // Удалить набор можно, пока он не общий: общий сначала удаляют с сайта или выходят из него
    const deleteItems =
      share && S.acct.session
        ? []
        : [
            gap,
            tiles(
              [
                Button({
                  key: 'arcade-prompt-set-delete',
                  label: pr.confirm === `set:${id}` ? 'Нажми ещё раз — удалить навсегда' : 'Удалить набор',
                  onPress: async () => {
                    if (pr.confirm !== `set:${id}`) {
                      pr.confirm = `set:${id}`
                      return refresh()
                    }
                    pr.confirm = ''
                    if (S.notes.some((p) => p.id === nb.draft?.id && p.parent === id)) nb.draft = null
                    if (!(await editPrompts($, (list) => removePage(list, id), 'Набор удалён.'))) return
                    if (share) await forgetDesk($, share)
                    toList('')
                  },
                }),
                dim('  Набор удалится вместе с шаблонами.'),
              ],
              40,
            ),
          ]
    items = [
      Button({ key: 'arcade-back', label: '← Промпты', onPress: () => toList(`set-${id}`) }),
      keep(section(set.title)),
      ...shareLine,
      ...notes,
      gap,
      Input({
        key: `arcade-prompt-set-title-${pr.field}`,
        label: 'Название',
        value: set.title,
        submitLabel: tr('Сохранить', S.lang),
        onSubmit: (value) => {
          const title = cleanTitle(value)
          if (!title) return say('Впиши название набора.')
          return editPrompts($, (list, at) => (title === set.title ? list : updatePage(list, id, { title }, at)), 'Сохранено.')
        },
      }),
      section('Общий доступ'),
      ...stack('prompt-share', shareItems),
      ...deleteItems,
      ...noticeLines,
      ...hint,
    ]
  } else {
    const sets = notesOrder(S.notes).filter(isPrompts)
    // Шаблон: название кнопкой — уходит Claude; рядом «В поле ввода» и ✎, ниже — первая строка текста
    const template = (card) =>
      Box({
        key: `prompt-${card.id}`,
        flexDirection: 'column',
        children: [
          row(`prompt-row-${card.id}`, [
            keep(
              Button({
                key: `arcade-prompt-${card.id}`,
                label: card.title,
                ...focusOn(`send-${card.id}`),
                onPress: () => {
                  pr.focus = `send-${card.id}`
                  return sendPrompt($, card.id)
                },
              }),
            ),
            Button({
              key: `arcade-prompt-field-${card.id}`,
              label: 'В поле ввода',
              plain: true,
              ...focusOn(`field-${card.id}`),
              onPress: () => {
                pr.focus = `field-${card.id}`
                return promptToField($, card.id)
              },
            }),
            Button({
              key: `arcade-prompt-edit-${card.id}`,
              label: '✎',
              plain: true,
              onPress: () => {
                pr.edit = card.id
                pr.confirm = ''
                pr.focus = 'text'
                pr.note = ''
                pr.bad = false
                pr.field++
                refresh()
              },
            }),
          ]),
          preview(card),
        ],
      })
    const newTemplate = (set, first) =>
      Input({
        key: `arcade-prompt-new-${set?.id ?? 'first'}-${pr.field}`,
        label: 'Новый шаблон',
        placeholder: 'название: ревью PR, тесты, коммит…',
        submitLabel: tr('Добавить', S.lang),
        ...(first || pr.focus === `new-${set?.id}` ? { autoFocus: true } : {}),
        onSubmit: (value) => (set ? addPrompt($, set.id, value) : createPromptSet($, tr('Мои промпты', S.lang), value)),
      })
    const setItems = (set) => {
      const cards = columnCards(S.notes, set, PROMPTS_COL)
      const about = [`${tr('шаблонов', S.lang)}: ${cards.length}`, shareAbout(set)].filter(Boolean).join(' · ')
      return [
        keep(section(set.title)),
        keep(dim(about)),
        ...stack(`prompt-set-${set.id}`, [
          ...cards.map(template),
          newTemplate(set, false),
          Button({
            key: `arcade-prompt-set-${set.id}`,
            label: 'Настройки набора',
            ...focusOn(`set-${set.id}`),
            onPress: () => {
              pr.set = set.id
              pr.confirm = ''
              pr.note = ''
              pr.bad = false
              pr.focus = ''
              S.dk.note = ''
              S.dk.bad = false
              pr.field++
              refresh()
              const s = set.board.share
              if (s && S.desks[s]) syncBoard($, s, { names: true }).catch(modError)
              else if (s && S.acct.session) loadBoards($).catch(modError)
            },
          }),
        ]),
      ]
    }
    items = [
      Button({ key: 'arcade-back', label: '← Назад', onPress: leave('main') }),
      gap,
      dim('Нажми на шаблон — и он уйдёт Claude, как «Отдать Claude». Claude занят — шаблон ждёт в поле ввода.'),
      ...notes,
      ...(sets.length ? sets.flatMap(setItems) : [gap, dim('Шаблонов пока нет — впиши название первого.'), newTemplate(null, true)]),
      gap,
      Input({
        key: `arcade-prompt-set-new-${pr.field}`,
        label: 'Новый набор',
        placeholder: 'название: ревью, релиз, для команды…',
        submitLabel: tr('Создать', S.lang),
        onSubmit: (value) => createPromptSet($, value),
      }),
      gap,
      dim('Шаблоны — кнопки этой панели, не команды Claude Code: слэш-команды и скиллы работают как раньше.'),
      dim('Claude тоже сохраняет шаблоны: скажи, например, «сохрани это как промпт в Arcade».'),
      dim(S.acct.session ? 'Общие наборы друзей появляются здесь сами.' : 'Войди через GitHub — и сможешь вести набор вместе с друзьями.'),
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}

// ━━━━━━━━━━ screens/agents ━━━━━━━━━━
// Arcade: экран «Агенты» — сессии Claude Code с Arcade на этом компьютере: что делает каждая, какую карточку, где очередь,
// чего ждёт. На вопрос Claude (AskUserQuestion) здесь можно ответить; разрешение на инструмент — только в самой сессии.
// Ненужную сейчас сессию можно скрыть крестиком и вернуть из «Скрытых». У каждой — что поменялось в её папке по git

// Цвет состояния: ждёт разрешения — бедой, закончил ход — успехом, работает (и в фоне) — подсказкой, свободна — серым
const STATUS_COLOR = { permission: 'error', done: 'success', working: 'suggestion', background: 'suggestion', idle: '' }
// Те же цвета для рамки и подложки карточки в Desktop
const STATUS_HEX = { permission: '#e5484d', done: '#30a46c', working: '#3e63dd', background: '#3e63dd', idle: '#8b8d98' }

// Сессии — в Desktop карточками, как события календаря, в терминале и VS Code — строками. Имена папок и названия
// карточек — человека, без перевода (keep)
export function agentsScreen($, e, kit) {
  const { Box, Button, Text, desktop, dim, gap, hint, noticeLines, now, open } = kit
  const all = agentsList(now)
  const hidden = new Set(S.agHidden)
  const list = all.filter((r) => r.me || !hidden.has(r.sid))
  const away = all.filter((r) => !r.me && hidden.has(r.sid))
  const strong = (text) => Text(desktop ? { weight: 'semibold', wrap: 'wrap', children: [text] } : { bold: true, children: [text] })
  const nameOf = (r) => (r.me ? `${r.name} · ${tr('эта сессия', S.lang)}` : r.name)
  const labelOf = (r) => (askOf(r)?.kind === 'question' ? 'ждёт ответа' : STATUS_LABEL[r.status] ?? STATUS_LABEL.idle)
  // В фоне — и сколько там агентов: главный ход кончился, а они работают
  const labelText = (r) => (r.status === 'background' && r.bg > 0 && !askOf(r) ? fill(tr('работает в фоне · агентов: {0}', S.lang), [r.bg]) : tr(labelOf(r), S.lang))
  const stateOf = (r) => `${labelText(r)} · ${tr(agoText(now - r.since), S.lang)}`
  const cardOf = (r) => (r.card ? (r.card.boardTitle ? fill(tr('«{0}» на доске «{1}»', S.lang), [r.card.title, r.card.boardTitle]) : `«${r.card.title}»`) : '')
  const queueOf = (r) => (r.queue?.of ? fill(tr('Очередь: карточка {0} из {1}', S.lang), [r.queue.n, r.queue.of]) : '')
  // Контекст и расходы — по последнему ответу Claude в той сессии (цифры Claude Code)
  const usageOf = (r) => [r.usage?.ctx != null ? fill(tr('Контекст: {0}', S.lang), [pctText(r.usage.ctx)]) : '', r.usage?.usd != null ? usdText(r.usage.usd) : ''].filter(Boolean).join(' · ')
  const status = (r) => {
    const color = STATUS_COLOR[r.status]
    return keep(Text({ ...(color ? { color } : { dimColor: true }), children: [stateOf(r)] }))
  }
  const wrapRow = (key, children) => Box({ key, flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: desktop ? 'sm' : 0, children })
  // Крестик у другой сессии — скрыть: её нет в списке и нет всплывашек о ней, пока её не вернут из «Скрытых»
  const hideButton = (r) => (r.me ? [] : [keep(Button({ key: `agents-hide-${r.sid}`, label: '×', plain: true, dimColor: true, onPress: () => hideAgent($, r.sid, true) }))])
  const asks = (r) => askLines($, kit, r)
  const changes = (r) => changesLines($, kit, r, all)
  const card = (r) => {
    const hex = STATUS_HEX[r.status] ?? STATUS_HEX.idle
    const lines = [cardOf(r), queueOf(r), usageOf(r)].filter(Boolean)
    return Box({
      key: `agents-card-${r.sid || 'me'}`,
      flexDirection: 'row',
      alignItems: 'flex-start',
      columnGap: 'sm',
      borderStyle: 'round',
      borderColor: `${hex}80`,
      backgroundColor: `${hex}14`,
      paddingX: 'sm',
      paddingY: 'xs',
      children: [
        Box({ flexDirection: 'column', alignItems: 'flex-start', rowGap: 'xs', flexGrow: 1, flexShrink: 1, minWidth: 0, children: [keep(strong(nameOf(r))), status(r), ...lines.map((x) => keep(dim(x))), ...changes(r), ...asks(r)] }),
        ...hideButton(r),
      ],
    })
  }
  const line = (r) => {
    const color = STATUS_COLOR[r.status]
    const rest = [cardOf(r), queueOf(r), usageOf(r)].filter(Boolean).join(' · ')
    const head = keep(Text({ children: [Text({ bold: true, children: [nameOf(r)] }), ' — ', Text({ ...(color ? { color } : { dimColor: true }), children: [stateOf(r)] })] }))
    return Box({
      key: `agents-line-${r.sid || 'me'}`,
      flexDirection: 'column',
      children: [
        r.me ? head : Box({ flexDirection: 'row', columnGap: 2, children: [head, ...hideButton(r)] }),
        ...(rest ? [keep(dim(`  ${rest}`))] : []),
        ...(changesOf(r) ? [Box({ key: `agents-chg-${r.sid || 'me'}`, flexDirection: 'column', paddingLeft: 2, children: changes(r) })] : []),
        ...(askOf(r) ? [Box({ key: `agents-ask-${r.sid || 'me'}`, flexDirection: 'column', paddingLeft: 2, children: asks(r) })] : []),
      ],
    })
  }
  const off = !S.ag?.on ? [gap, dim('Другие сессии здесь не видны: у этой сессии нет домашней папки.')] : []
  const others = all.length > 1 ? [] : [gap, dim('Других сессий с Arcade сейчас нет. Открой ещё одну сессию Claude Code — она появится здесь.')]
  const rows = desktop ? [Box({ key: 'agents-list', flexDirection: 'column', rowGap: 'sm', children: list.map(card) })] : list.map(line)
  // Скрытые — кнопками: нажатая возвращает сессию в список; та, что ждёт разрешения или ответа, так и подписана
  const awayLabel = (r) => (r.status === 'permission' ? `${r.name} · ${tr(labelOf(r), S.lang)}` : r.name)
  const awayRows = away.length
    ? [gap, dim('Скрытые сессии — нажми, чтобы вернуть:'), wrapRow('agents-hidden', away.map((r) => keep(Button({ key: `agents-show-${r.sid}`, label: awayLabel(r), onPress: () => hideAgent($, r.sid, false) }))))]
    : []
  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }),
    gap,
    dim('Сессии Claude Code с Arcade на этом компьютере — по папке. Закрытая сессия пропадает отсюда меньше чем за минуту. Всё это видно только на этом компьютере.'),
    gap,
    ...rows,
    ...(S.chg.note ? [gap, Text({ ...(S.chg.bad ? { color: 'warning' } : { dimColor: true }), children: [S.chg.note] })] : []),
    ...awayRows,
    ...off,
    ...others,
    gap,
    dim('Очередь доски можно запустить в нескольких сессиях: нажми «Очередь для Claude» на той же доске в каждой — свободная сессия возьмёт следующую карточку.'),
    ...noticeLines,
    ...hint,
  ]
}

// Что поменялось в папке сессии по git: строка «ветка · изменено файлов · не закоммичено» — нажатием раскрывает файлы
// с числом строк; ниже — какие файлы правит и другая сессия. У своей — «Дать Claude: проверить изменения». Не git —
// ничего. Имена веток и файлов — человека, без перевода (keep)
export function changesLines($, kit, r, all) {
  const { Box, Button, Text, dim } = kit
  const c = changesOf(r)
  if (!c) return []
  const t = (text) => tr(text, S.lang)
  const id = r.sid || 'me'
  const head = [c.branch ? fill(t('ветка {0}'), [c.branch]) : t('без ветки')]
  head.push(...(c.n ? [fill(t('изменено файлов: {0}'), [c.n]), t('не закоммичено')] : [t('изменений нет')]))
  if (c.ahead) head.push(fill(t('не отправлено коммитов: {0}'), [c.ahead]))
  if (!c.n) return [keep(dim(head.join(' · ')))]
  const open = S.chg.open.has(id)
  const toggle = () => {
    if (open) S.chg.open.delete(id)
    else S.chg.open.add(id)
    $.ui.invalidate('ui.render')
  }
  const out = [keep(Button({ key: `agents-changes-${id}`, label: `${open ? '▾' : '▸'} ${head.join(' · ')}`, plain: true, onPress: toggle }))]
  if (open) {
    const fileText = (x) => {
      if (x.state === 'new') return `${x.path} · ${t('новый файл')}`
      if (x.state === 'bin') return `${x.path} · ${t('двоичный файл')}`
      return x.add == null ? x.path : `${x.path}  +${x.add} −${x.del ?? 0}`
    }
    out.push(...c.files.map((x) => keep(dim(`  ${fileText(x)}`))))
    if (c.n > c.files.length) out.push(keep(dim(`  ${fill(t('и ещё файлов: {0}'), [c.n - c.files.length])}`)))
  }
  // Пересечения с другими сессиями — предупреждением: одни и те же файлы правят двое
  const warn = (text) => keep(Text({ color: 'warning', children: [text] }))
  const names = (who) => who.map((w) => w.name).join('», «')
  const ov = overlapsOf(r, all)
  const sameMe = ov.same.filter((w) => w.me)
  const sameOthers = ov.same.filter((w) => !w.me)
  if (sameOthers.length) out.push(warn(fill(t('Та же папка, что у сессии «{0}»: изменения общие — чьи они, не различить.'), [names(sameOthers)])))
  if (sameMe.length) out.push(warn(t('Та же папка, что у этой сессии: изменения общие — чьи они, не различить.')))
  for (const x of ov.files.slice(0, 3)) {
    const others = x.who.filter((w) => !w.me)
    if (others.length) out.push(warn(fill(t('{0} правит и сессия «{1}»'), [x.path, names(others)])))
    if (x.who.some((w) => w.me)) out.push(warn(fill(t('{0} правит и эта сессия'), [x.path])))
  }
  if (ov.files.length > 3) out.push(warn(fill(t('и ещё общих файлов: {0}'), [ov.files.length - 3])))
  if (r.me) out.push(Button({ key: 'agents-review', label: 'Дать Claude: проверить изменения', onPress: () => reviewChanges($) }))
  return out
}

// Чего ждёт сессия. Запрос разрешения — только показать: разрешают в самой сессии. Вопрос — варианты кнопками: один
// вопрос с одним ответом уходит сразу, иначе — отметить варианты и «Ответить». Вопрос и варианты — Claude, без перевода.
// prefix — начало ключей: у «Агентов» и «Сегодня» свои
export function askLines($, kit, r, prefix = 'agents') {
  const { Box, Button, Text, desktop, dim } = kit
  const wrapRow = (key, children) => Box({ key, flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: desktop ? 'sm' : 0, children })
  const ask = askOf(r)
  if (!ask) return []
  const id = r.sid || 'me'
  if (ask.kind === 'permission') {
    const what = ask.what ? `${ask.tool}: ${ask.what}` : ask.tool
    return [...(what ? [keep(dim(what))] : []), dim('Разрешение даётся только в самой сессии.')]
  }
  if (isSent(r, ask)) return [dim('Ответ отправлен — сессия получит его через секунду.')]
  const picks = picksOf(r, ask)
  const one = ask.questions.length === 1 && !ask.questions[0].multi
  return [
    ...ask.questions.flatMap((q, qi) => [
      ...(q.header ? [keep(dim(q.header))] : []),
      keep(Text({ ...(desktop ? { wrap: 'wrap' } : {}), children: [q.question] })),
      wrapRow(
        `${prefix}-q-${id}-${qi}`,
        q.options.map((label, oi) =>
          keep(Button({ key: `${prefix}-q-${id}-${qi}-${oi}`, label: `${picks[qi].includes(label) ? '✓ ' : ''}${label}`, onPress: () => pickOption($, r, ask, qi, label) })),
        ),
      ),
    ]),
    ...(!one && allPicked(r, ask) ? [Button({ key: `${prefix}-send-${id}`, label: 'Ответить', onPress: () => sendAnswer($, r, ask, picksOf(r, ask)) })] : []),
  ]
}

// ━━━━━━━━━━ screens/usage ━━━━━━━━━━
// Arcade: экран «Лимиты» — окна лимитов Claude (5 часов, неделя, лимит расходов), контекст и расходы этой и других
// сессий, очередь доски после сброса лимита. Цифры — самого Claude Code ($.session.usage): Arcade своих
// не считает. Окна — у учётной записи, общие для всех её сессий: на экране — самый свежий замер из всех сессий

// Цвет окна: до 80% — спокойный, с 80% — предупреждение, кончилось — беда
const levelOf = (pct) => (pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'suggestion')
const LEVEL_HEX = { error: '#e5484d', warning: '#f5a524', suggestion: '#3e63dd' }
const BAR_CELLS = 20

// Полоска заполнения: в Desktop — картинкой, в терминале и VS Code — клетками
const barSvg = (pct, hex) => {
  const w = Math.round(Math.min(100, Math.max(0, pct)) * 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 8"><rect width="200" height="8" rx="4" fill="#8b8d98" fill-opacity="0.25"/>${w ? `<rect width="${w}" height="8" rx="4" fill="${hex}"/>` : ''}</svg>`
}
const barCells = (pct) => {
  const n = Math.round((Math.min(100, Math.max(0, pct)) / 100) * BAR_CELLS)
  return `${'█'.repeat(n)}${'░'.repeat(BAR_CELLS - n)}`
}

export function usageScreen($, e, kit) {
  const { Box, Button, Svg, Text, desktop, dim, gap, hint, noticeLines, now, open, section } = kit
  const t = (text) => tr(text, S.lang)
  const strong = (text) => Text(desktop ? { weight: 'semibold', children: [text] } : { bold: true, children: [text] })
  const wrapRow = (key, children) => Box({ key, flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: desktop ? 'sm' : 0, children })
  const me = S.us.me
  const others = othersNow()
  const latest = freshLimits(others)

  // ——— Окна лимитов ———
  const windowRow = (w) => {
    const level = levelOf(w.pct)
    const when = resetText(w.reset, now)
    if (desktop) {
      return Box({
        key: `usage-win-${w.kind}`,
        flexDirection: 'column',
        rowGap: 'xs',
        children: [
          Box({ flexDirection: 'row', columnGap: 'sm', children: [strong(limitName(w.kind)), keep(Text({ color: level, children: [pctText(w.pct)] }))] }),
          keep(Svg({ source: barSvg(w.pct, LEVEL_HEX[level]), alt: pctText(w.pct), width: 200, height: 8 })),
          ...(when ? [keep(dim(when))] : []),
        ],
      })
    }
    return keep(
      Text({
        key: `usage-win-${w.kind}`,
        children: [Text({ bold: true, children: [limitName(w.kind)] }), '  ', Text({ color: level, children: [`${barCells(w.pct)} ${pctText(w.pct)}`] }), ...(when ? [Text({ dimColor: true, children: [` · ${when}`] })] : [])],
      }),
    )
  }
  // Окна — и из замера другой сессии, если эта их не знает. Окон нет: до первого ответа Claude их не знает никто; после
  // ответа — значит, ключ API или шлюз
  let windows
  if (latest) {
    windows = [
      desktop ? Box({ key: 'usage-wins', flexDirection: 'column', rowGap: 'md', children: latest.limits.map(windowRow) }) : Box({ key: 'usage-wins', flexDirection: 'column', children: latest.limits.map(windowRow) }),
      keep(dim(fill(t('Замер — {0} назад.'), [t(agoText(now - latest.at))]))),
    ]
  } else if (!S.us.api) windows = [dim('Этот Claude Code лимитов не сообщает — нужен Claude Code новее.')]
  else if (me && (me.ctx != null || me.tokens != null)) windows =[dim('Окон лимитов нет: так бывает с ключом API или шлюзом. Окна 5 часов и недели — у подписок Claude (Pro, Max, Team, Enterprise). Расходы — ниже.')]
  else windows = [dim('Появится после первого ответа Claude.')]

  // ——— Эта сессия ———
  const mine = []
  if (S.us.api && me) {
    if (me.ctx != null) {
      const of = me.tokens != null && me.window ? ` (${fill(t('{0} из {1} токенов'), [me.tokens.toLocaleString('en-US'), me.window.toLocaleString('en-US')])})` : ''
      const [pre, post = ''] = t('Контекст: {0}').split('{0}')
      mine.push(keep(Text({ children: [pre, Text({ color: levelOf(me.ctx), children: [pctText(me.ctx)] }), post, of] })))
    }
    if (me.usd != null) mine.push(keep(Text({ children: [fill(t('Расходы с начала сессии: {0}'), [usdText(me.usd)])] })))
  }
  if (S.us.api && !mine.length) mine.push(dim('Появится после первого ответа Claude.'))

  // ——— Другие сессии ———
  const hidden = new Set(S.agHidden ?? [])
  const rest = agentsList(now).filter((r) => !r.me && !hidden.has(r.sid))
  const usageOf = (r) =>
    [r.usage?.ctx != null ? fill(t('Контекст: {0}'), [pctText(r.usage.ctx)]) : '', r.usage?.usd != null ? usdText(r.usage.usd) : ''].filter(Boolean).join(' · ') || t('замеров ещё нет')
  const otherRows = rest.length
    ? [section('Другие сессии'), ...rest.map((r) => keep(Text({ key: `usage-other-${r.sid}`, children: [Text({ bold: true, children: [r.name] }), Text({ dimColor: true, children: [` — ${usageOf(r)}`] })] })))]
    : []

  // ——— Очередь после сброса лимита ———
  const titleOf = (id, fallback) => S.notes.find((p) => p.id === id)?.title ?? fallback ?? ''
  const queueRows = []
  const w = S.qr.wait
  if (w) {
    queueRows.push(
      keep(Text({ color: 'suggestion', children: [fill(t('Очередь «{0}» продолжится в {1}.'), [titleOf(w.board, w.title), clockText(w.at, now)])] })),
      Button({ key: 'usage-wait-cancel', label: 'Не продолжать', onPress: () => cancelWait($) }),
    )
  } else if (S.qr.offer && now < S.qr.offer.at) {
    const o = S.qr.offer
    queueRows.push(
      keep(dim(fill(t('Очередь «{0}» остановилась: кончился лимит Claude.'), [titleOf(o.board, o.title)]))),
      Button({ key: 'usage-offer', label: fill(t('Продолжить очередь после сброса в {0}'), [clockText(o.at, now)]), onPress: () => waitFor($, o) }),
    )
  }
  for (const m of S.qr.missed) {
    queueRows.push(
      Box({
        key: `usage-missed-${m.board}`,
        flexDirection: 'row',
        columnGap: 2,
        children: [keep(Text({ color: 'warning', children: [m.text] })), Button({ key: `usage-missed-off-${m.board}`, label: '×', plain: true, dimColor: true, onPress: () => missedClear($, m.board) })],
      }),
    )
  }
  const boards = S.notes.filter((p) => isProjectBoard(p))
  const armRows = boards.length
    ? [
        dim('Продолжать очередь после сброса самой, без кнопки, — на досках (нажми, чтобы отметить):'),
        wrapRow(
          'usage-armed',
          boards.map((b) => {
            const armed = S.qr.armed.includes(b.id)
            return keep(Button({ key: `usage-arm-${b.id}`, label: `${armed ? '✓ ' : ''}${b.title}`, onPress: () => armBoard($, b.id, !armed) }))
          }),
        ),
      ]
    : [dim('Досок пока нет — очередь для Claude запускается на доске.')]

  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }),
    gap,
    dim('Цифры — самого Claude Code: Arcade своих не считает. Окна лимитов — у учётной записи, общие для всех её сессий.'),
    section('Окна лимитов'),
    ...windows,
    ...(S.us.api ? [section('Эта сессия'), ...mine] : []),
    ...otherRows,
    section('Очередь после сброса лимита'),
    dim('Кончился лимит посреди очереди доски — она встанет и может продолжиться после сброса, с той же карточки. Только пока Claude Code открыт и компьютер не спит.'),
    ...(queueRows.length ? [gap, ...queueRows] : []),
    gap,
    ...armRows,
    ...noticeLines,
    ...hint,
  ]
}

// ━━━━━━━━━━ screens/today ━━━━━━━━━━
// Arcade: экран «Сегодня» — всё, что ждёт человека, на одном экране: сессии, которые ждут разрешения или ответа (на
// вопрос с вариантами — ответить прямо здесь), события календаря на сегодня, сроки карточек на сегодня и просроченные,
// мои карточки на общих досках, непрочитанные чаты и строка лимитов. Ничего своего не хранит: всё — из того, что Arcade
// уже знает (отметки сессий, блокнот, календарь, чаты, замеры лимитов). Пустые блоки скрыты

const TODAY_MAX = 8 // строк в блоке, не больше: остальное — «и ещё N» и плитка самого раздела

export function todayScreen($, e, kit) {
  const { Box, Button, Text, desktop, dim, gap, hint, noticeLines, now, open, section } = kit
  const t = (text) => tr(text, S.lang)
  const today = dayKey(now)
  const strong = (text) => Text(desktop ? { weight: 'semibold', wrap: 'wrap', children: [text] } : { bold: true, children: [text] })
  const stack = (key, list) => (desktop ? [Box({ key, flexDirection: 'column', rowGap: 'sm', alignItems: 'flex-start', children: list })] : list)
  // Больше SHOW_MAX — первые и «и ещё N» кнопкой в сам раздел
  const capped = (key, list, more) => (list.length > TODAY_MAX ? [...list.slice(0, TODAY_MAX), Button({ key: `${key}-more`, label: fill(t('и ещё {0}'), [list.length - TODAY_MAX]), plain: true, onPress: more })] : list)
  const blocks = []

  // ——— 1. Ждут тебя: сессии, которые ждут разрешения или ответа ———
  const hidden = new Set(S.agHidden ?? [])
  const waiting = agentsList(now).filter((r) => (r.me || !hidden.has(r.sid)) && (r.status === 'permission' || askOf(r)))
  if (waiting.length) {
    const nameOf = (r) => (r.me ? `${r.name} · ${t('эта сессия')}` : r.name)
    const stateOf = (r) => `${t(askOf(r)?.kind === 'question' ? 'ждёт ответа' : STATUS_LABEL.permission)} · ${t(agoText(now - r.since))}`
    const cardOf = (r) => (r.card ? (r.card.boardTitle ? fill(t('«{0}» на доске «{1}»'), [r.card.title, r.card.boardTitle]) : `«${r.card.title}»`) : '')
    const one = (r) => {
      const id = r.sid || 'me'
      const what = cardOf(r)
      const body = [keep(strong(nameOf(r))), keep(Text({ color: 'error', children: [stateOf(r)] })), ...(what ? [keep(dim(what))] : []), ...askLines($, kit, r, 'today')]
      return desktop
        ? Box({ key: `today-ask-${id}`, flexDirection: 'column', alignItems: 'flex-start', rowGap: 'xs', borderStyle: 'round', borderColor: '#e5484d80', backgroundColor: '#e5484d14', paddingX: 'sm', paddingY: 'xs', children: body })
        : Box({ key: `today-ask-${id}`, flexDirection: 'column', children: body })
    }
    blocks.push(section('Ждут тебя'), ...stack('today-asks', waiting.map(one)))
  }

  // ——— 2. В календаре: события на сегодня; прошедшие — бледнее ———
  const events = between(S.calendar, today, 1)
  if (events.length) {
    const toEvent = (x) => () => {
      Object.assign(cal, { note: '', bad: false, confirm: false, focus: '', back: '', day: '', month: '' })
      open(`calendar:${x.id}`)()
    }
    const rows = events.map((x) => {
      const past = x.time && startOf(x) < now
      const label = `${x.time || t('весь день')} · ${x.title}`
      return keep(Button({ key: `today-ev-${x.id}`, label, plain: true, ...(past ? { dimColor: true } : {}), onPress: toEvent(x) }))
    })
    blocks.push(section('В календаре'), ...stack('today-events', capped('today-events', rows, open('calendar'))))
  }

  // ——— 3. Сроки: карточки со сроком сегодня и просроченные, что не в последней колонке ———
  const dues = cardDues(S.notes).filter((x) => !x.done && x.day <= today)
  const shownCards = new Set(dues.map((x) => x.card))
  if (dues.length) {
    const rows = dues.map((x) => {
      const late = x.day < today
      const when = late ? fill(t('просрочено, срок {0}'), [dayText(x.day, today)]) : t('сегодня')
      return keep(
        Button({
          key: `today-due-${x.card}`,
          label: `${x.title} — ${x.board}`,
          plain: true,
          onPress: open(`note:${x.card}`),
          children: [Text({ children: [`${x.title} — ${x.board} · `, Text({ color: late ? 'error' : 'warning', children: [when] })] })],
        }),
      )
    })
    blocks.push(section('Сроки'), ...stack('today-dues', capped('today-dues', rows, open('calendar'))))
  }

  // ——— 4. Мои карточки: взятые мной на общих досках и не сделанные ———
  const mine = []
  for (const board of S.notes) {
    if (!isBoard(board) || !board.board.share) continue
    const last = board.board.cols.at(-1).id
    for (const card of S.notes) {
      if (card.parent !== board.id || shownCards.has(card.id) || columnOf(card, board.board.cols) === last) continue
      const { me, taken } = cardTaker(card)
      if (me && taken === me) mine.push({ card, board })
    }
  }
  if (mine.length) {
    const rows = mine.map(({ card, board }) => keep(Button({ key: `today-mine-${card.id}`, label: `${card.title} — ${board.title}`, plain: true, onPress: open(`note:${card.id}`) })))
    blocks.push(section('Мои карточки'), ...stack('today-mine', capped('today-mine', rows, open('boards'))))
  }

  // ——— 5. Чаты: непрочитанные, если человек вошёл ———
  if (S.acct.session && S.acct.unread > 0) {
    const chats = (S.ch.list ?? []).filter((c) => c.unread > 0)
    const rows = chats.length
      ? chats.map((c) => keep(Button({ key: `today-chat-${c.id}`, label: `${chatTitle(c)} · ${c.unread}`, plain: true, onPress: () => openChat($, c.id) })))
      : [keep(Button({ key: 'today-chats', label: fill(t('Непрочитанных сообщений: {0}'), [S.acct.unread]), plain: true, onPress: open('chats') }))]
    blocks.push(section('Чаты'), ...stack('today-chats', capped('today-chats', rows, open('chats'))))
  }

  // ——— 6. Лимиты: одна строка из самого свежего замера ———
  const latest = freshLimits(othersNow())
  if (latest) {
    const parts = latest.limits.map((w) => `${limitName(w.kind)}: ${pctText(w.pct)}${w.reset && w.reset > now ? `, ${fill(t('сброс в {0}'), [clockText(w.reset, now)])}` : ''}`)
    const hot = latest.limits.some((w) => w.pct >= 80)
    blocks.push(
      section('Лимиты'),
      keep(Button({ key: 'today-usage', label: parts.join(' · '), plain: true, ...(hot ? { children: [Text({ color: 'warning', children: [parts.join(' · ')] })] } : {}), onPress: open('usage') })),
    )
  }

  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }),
    gap,
    ...(blocks.length ? blocks : [dim('На сегодня всё.')]),
    ...noticeLines,
    ...hint,
  ]
}

// ━━━━━━━━━━ screens/calendar ━━━━━━━━━━
// Arcade: экран календаря.

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const CAL_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const WEEKDAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
// Цвета событий словами — в выборе цвета
const COLOR_NAMES = { blue: 'синий', green: 'зелёный', yellow: 'жёлтый', orange: 'оранжевый', red: 'красный', purple: 'фиолетовый', pink: 'розовый', gray: 'серый' }
// Повтор словами — в выборе повтора и в строках событий
const REPEAT_NAMES = { '': 'Не повторять', daily: 'Каждый день', weekdays: 'По будням', weekly: 'Каждую неделю', monthly: 'Каждый месяц', yearly: 'Каждый год' }
const repeatText = (r) => tr(REPEAT_NAMES[r ?? ''], S.lang)
// «Ближайшее»: события на UPCOMING_DAYS дней вперёд, не больше UPCOMING_MAX
const UPCOMING_DAYS = 30
const UPCOMING_MAX = 10
// Плитка дня в Desktop: семь плиток делят ширину панели поровну и ужимаются вместе с ней; цветных точек событий —
// не больше DOTS_MAX. Панель уже LIST_BELOW знаков (около 360 px) — месяц не сеткой, а списком дней
const CELL_GAP = 'xs'
const DOTS_MAX = 3
const LIST_BELOW = 44
// Сегодняшний день — с голубой подложкой, плитка под мышью — с серой
const TODAY_BG = '#3a78b526'
const HOVER_BG = '#8080801a'

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1)
const dm = (day) => `${day.slice(8)}.${day.slice(5, 7)}`
const calClock = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
const remindValue = (m) => (m === null ? 'none' : String(m))
// «Дать Claude»: что событие даёт Claude в своё время — в выборе и коротко в карточке события
const GIVE_NAMES = { none: 'Ничего', queue: 'Очередь доски', card: 'Одну карточку', prompt: 'Шаблон из «Промптов»', text: 'Свой текст' }
const GIVE_SHORT = { queue: 'очередь доски', card: 'карточка', prompt: 'шаблон', text: 'свой текст' }
const GIVE_PICK = { queue: 'Выбери доску', card: 'Выбери карточку', prompt: 'Выбери шаблон' }
const GIVE_EMPTY = {
  queue: '  Досок проектов пока нет — заведи доску в «Работе».',
  card: '  На досках проектов пока нет карточек, кроме сделанных.',
  prompt: '  Шаблонов пока нет — заведи их в «Промптах».',
}
// Когда пропущенное задание должно было пойти: «сегодня 9:00», «06.11 18:30»
const stampText = (ms, today) => {
  const d = new Date(ms)
  return `${dayText(dayKey(ms), today)} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
// Цели задания для выбора: доски проектов; карточки досок (без сделанных) — «Доска · Карточка»; шаблоны — «Набор · Шаблон»
function giveOptions(kind) {
  const list = giveTargets(S.notes, kind)
  if (kind === 'queue') return list.map((b) => ({ value: b.id, label: b.title }))
  const parent = (p) => S.notes.find((b) => b.id === p.parent)
  return list
    .filter((p) => kind !== 'card' || columnOf(p, parent(p).board.cols) !== parent(p).board.cols.at(-1).id)
    .map((p) => ({ value: p.id, label: `${parent(p).title} · ${p.title}` }))
}

// Напоминание словами. У события со временем — «за 15 мин», «за 1 ч 30 мин», «за сутки»; у события на весь день —
// часами: «в 8:00», «накануне в 21:00», «за 2 дн. в 9:00»
function remindText(ev, m = ev.remind) {
  if (m === null || m === undefined) return tr('без напоминания', S.lang)
  if (!ev.time) {
    const at = ALL_DAY_HOUR * 60 - m // минуты от полуночи дня события; накануне — меньше нуля
    const back = Math.max(0, -Math.floor(at / 1440))
    const time = calClock(at + back * 1440)
    if (!back) return tr(`в ${time}`, S.lang)
    if (back === 1) return tr(`накануне в ${time}`, S.lang)
    return tr(back === 7 ? `за неделю в ${time}` : `за ${back} дн. в ${time}`, S.lang)
  }
  if (m === 0) return tr('в начале', S.lang)
  if (m === 60) return tr('за час', S.lang)
  if (m === 1440) return tr('за сутки', S.lang)
  if (m === 10080) return tr('за неделю', S.lang)
  if (m % 1440 === 0) return tr(`за ${m / 1440} дн.`, S.lang)
  if (m < 60) return tr(`за ${m} мин`, S.lang)
  return tr(m % 60 ? `за ${Math.floor(m / 60)} ч ${m % 60} мин` : `за ${m / 60} ч`, S.lang)
}

// Календарь: в Desktop — сетка месяца плитками одного размера, события выбранного дня и «Ближайшее» карточками своего
// цвета; в терминале — только «Ближайшее». Событие открывается своим экраном (calendar:<id>): название, когда, заметка,
// цвет, напоминание, удаление. Названия и заметки — человека, без перевода (keep)
export function calendarScreen($, e, kit) {
  const { Box, Button, Input, Select, Text, desktop, dim, gap, hint, noticeLines, now, open, section } = kit
  const today = dayKey(now)
  const ev = S.menu.startsWith('calendar:') ? S.calendar.find((x) => x.id === S.menu.slice(9)) : null
  if (!ev && S.menu !== 'calendar') S.menu = 'calendar'
  if (!cal.month) cal.month = today.slice(0, 7)
  const selected = cal.day || today
  const focusOn = (name) => (cal.focus === name ? { autoFocus: true } : {})
  const say = (text, bad = true) => {
    cal.note = text
    cal.bad = bad
    $.ui.invalidate('ui.render')
  }
  const noteLine = cal.note ? [gap, cal.bad ? Text({ color: 'warning', children: [cal.note] }) : dim(cal.note)] : []
  const row = (children) => Box({ flexDirection: 'row', columnGap: 2, alignItems: 'center', children })
  const stack = (key, list) => (desktop ? [Box({ key, flexDirection: 'column', rowGap: 'sm', children: list })] : list)
  const strong = (text) => Text(desktop ? { weight: 'semibold', wrap: 'wrap', children: [text] } : { bold: true, children: [text] })
  const dot = (x, more = {}) => Text({ color: colorOf(x), ...more, children: ['●'] })
  // Серия бывает в списке несколько раз — ключ и фокус у каждого её раза свои, с днём
  const ref = (x) => (x.first ? `${x.id}-${x.day}` : x.id)
  // Открыть событие; назад — фокус на той же кнопке (cal.back — её фокус). Срок карточки доски открывает саму карточку,
  // раз серии — всю серию
  const openEvent = (x, list) => () => {
    cal.note = ''
    cal.bad = false
    cal.confirm = false
    cal.giveKind = null
    cal.focus = ''
    cal.back = `${list}-${ref(x)}`
    open(x.card ? `note:${x.card}` : `calendar:${x.id}`)()
  }

  if (ev) {
    const leave = () => {
      cal.note = ''
      cal.bad = false
      cal.confirm = false
      cal.giveKind = null
      cal.focus = cal.back || `ev-${ev.id}`
      open('calendar')()
    }
    const confirm = cal.confirm
      ? [
          gap,
          Text({ color: 'warning', children: ['Удалить событие насовсем?'] }),
          row([
            Button({ key: 'arcade-cal-delete-yes', label: 'Да, удалить', autoFocus: true, onPress: () => deleteEvent($, ev.id) }),
            Button({
              key: 'arcade-cal-delete-no',
              label: 'Отмена',
              onPress: () => {
                cal.confirm = false
                cal.focus = 'delete'
                $.ui.invalidate('ui.render')
              },
            }),
          ]),
        ]
      : []
    // Цвет — кнопками с цветным кружком; выбранный — главной кнопкой
    const color = ev.color || CAL_COLOR
    const colors = Box({
      key: 'cal-colors',
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 1,
      rowGap: 'xs',
      children: Object.keys(COLORS).map((name) =>
        keep(
          Button({
            key: `arcade-cal-color-${name}`,
            label: tr(COLOR_NAMES[name], S.lang),
            ...(name === color ? { variant: 'primary' } : {}),
            ...focusOn(`color-${name}`),
            children: [Text({ color: COLORS[name], children: ['● '] }), tr(COLOR_NAMES[name], S.lang)],
            onPress: () => {
              cal.focus = `color-${name}`
              editEvent($, ev.id, { color: name === CAL_COLOR ? '' : name }, '')
            },
          }),
        ),
      ),
    })
    // Напоминание — выбором из списка; где выбора нет (Claude на телефоне) — кнопкой по кругу
    const remindPick = Select
      ? keep(
          Select({
            key: 'arcade-cal-remind',
            label: tr('Напомнить', S.lang),
            options: remindChoices(ev).map((m) => ({ value: remindValue(m), label: remindText(ev, m) })),
            value: remindValue(ev.remind),
            ...focusOn('remind'),
            onSelect: (value) => {
              cal.focus = 'remind'
              editEvent($, ev.id, { remind: value === 'none' ? null : Number(value) }, '')
            },
          }),
        )
      : keep(
          Button({
            key: 'arcade-cal-remind',
            label: `${tr('Напомнить', S.lang)}: ${remindText(ev)}`,
            ...focusOn('remind'),
            onPress: () => {
              cal.focus = 'remind'
              editEvent($, ev.id, { remind: nextRemind(ev) }, '')
            },
          }),
        )
    // Своё время напоминания словами: «за 45 мин», «накануне в 20:00»
    const remindOwn = Input({
      key: `arcade-cal-remind-own-${cal.field}`,
      label: 'Или своё время',
      placeholder: ev.time ? 'за 45 мин, в 14:30, накануне в 20:00' : 'в 8:30, накануне в 20:00, за 3 дня в 9:00',
      submitLabel: tr('Сохранить', S.lang),
      onSubmit: async (value) => {
        const m = parseRemind(value, ev)
        if (m === undefined)
          return say(
            ev.time
              ? 'Не понял, когда напомнить: пиши как «за 45 мин», «в 14:30» или «накануне в 20:00» — не позже начала и не раньше чем за неделю.'
              : 'Не понял, когда напомнить: пиши как «в 8:30», «накануне в 20:00» или «за 3 дня в 9:00» — не позже 9:00 этого дня и не раньше чем за неделю.',
          )
        if (await editEvent($, ev.id, { remind: m })) {
          cal.field += 1
          $.ui.invalidate('ui.render')
        }
      },
    })
    // Повтор — выбором из списка, где выбора нет — кнопкой по кругу. Серия по будням с выходного дня начинается с
    // понедельника: день первого раза поменялся — поле «Когда» рисуется заново
    const repeats = ['', ...REPEATS]
    const setRepeat = async (repeat) => {
      cal.focus = 'repeat'
      const day = ev.day
      if ((await editEvent($, ev.id, { repeat }, '')) && S.calendar.find((x) => x.id === ev.id)?.day !== day) {
        cal.field += 1
        $.ui.invalidate('ui.render')
      }
    }
    const repeatPick = Select
      ? keep(
          Select({
            key: 'arcade-cal-repeat',
            label: tr('Повтор', S.lang),
            options: repeats.map((r) => ({ value: r || 'none', label: repeatText(r) })),
            value: ev.repeat || 'none',
            ...focusOn('repeat'),
            onSelect: (value) => setRepeat(value === 'none' ? '' : value),
          }),
        )
      : keep(
          Button({
            key: 'arcade-cal-repeat',
            label: `${tr('Повтор', S.lang)}: ${repeatText(ev.repeat)}`,
            ...focusOn('repeat'),
            onPress: () => setRepeat(repeats[(repeats.indexOf(ev.repeat ?? '') + 1) % repeats.length]),
          }),
        )
    // Дать Claude: вид задания — выбором из списка (где выбора нет — кнопкой по кругу); цель — вторым выбором, свой текст —
    // полем. Выбранный, но ещё не заданный вид ждёт в cal.giveKind. Задание помнит папку сессии, где его дали
    const g = ev.give ?? null
    const here = S.ag?.path ?? ''
    const kind = cal.giveKind?.id === ev.id ? cal.giveKind.kind : (g?.kind ?? 'none')
    const pick = (name, label, options, value, onSelect) =>
      Select
        ? keep(
            Select({
              key: `arcade-cal-${name}`,
              label: tr(label, S.lang),
              options,
              value,
              ...focusOn(name),
              onSelect: (v) => {
                cal.focus = name
                onSelect(v)
              },
            }),
          )
        : keep(
            Button({
              key: `arcade-cal-${name}`,
              label: `${tr(label, S.lang)}: ${options.find((o) => o.value === value)?.label ?? ''}`,
              ...focusOn(name),
              onPress: () => {
                cal.focus = name
                const real = options.filter((o) => o.value !== 'pick')
                onSelect(real[(real.findIndex((o) => o.value === value) + 1) % real.length].value)
              },
            }),
          )
    const setGive = async (newGive, saved = '') => {
      if (await editEvent($, ev.id, { give: newGive, ...(ev.cwd || !here ? {} : { cwd: here }) }, saved)) {
        cal.giveKind = null
        if (newGive.kind === 'text') cal.field += 1
        $.ui.invalidate('ui.render')
      }
    }
    const kindPick = pick(
      'give-kind',
      'Что дать',
      ['none', ...GIVE_KINDS].map((k) => ({ value: k, label: tr(GIVE_NAMES[k], S.lang) })),
      kind,
      (value) => {
        if (value === 'none') {
          cal.giveKind = null
          if (g) return editEvent($, ev.id, { give: null }, '')
        } else cal.giveKind = value === g?.kind ? null : { id: ev.id, kind: value }
        $.ui.invalidate('ui.render')
      },
    )
    const targetOf = () => {
      const options = giveOptions(kind)
      const current = g?.kind === kind ? g[GIVE_KEY[kind]] : ''
      // Цель удалили — её имя остаётся в выборе, пока не выбрана другая
      if (current && !options.some((o) => o.value === current)) options.unshift({ value: current, label: `${g.name} — ${tr('больше нет', S.lang)}` })
      if (!options.length) return [dim(GIVE_EMPTY[kind])]
      if (!current) options.unshift({ value: 'pick', label: tr(GIVE_PICK[kind], S.lang) })
      return [
        pick('give-target', GIVE_NAMES[kind], options, current || 'pick', (value) => {
          if (value === 'pick' || value === current) return
          setGive({ kind, [GIVE_KEY[kind]]: value, name: giveTargets(S.notes, kind).find((p) => p.id === value)?.title ?? '' })
        }),
      ]
    }
    const textField = Input({
      key: `arcade-cal-task-${cal.field}`,
      label: 'Текст для Claude',
      rows: 4,
      value: g?.kind === 'text' ? g.text : '',
      placeholder: 'проверь открытые PR и напиши, что горит',
      submitLabel: tr('Сохранить', S.lang),
      onSubmit: (value) => (value.trim() ? setGive({ kind: 'text', text: value }, 'Сохранено.') : say('Напиши, что дать Claude.')),
    })
    const inFolder = !ev.cwd || samePath(ev.cwd, here)
    const missedLine = Number.isFinite(ev.missed)
      ? [
          Text({ color: 'warning', children: [fill(tr('Пропущено {0}: Claude Code был закрыт или компьютер спал.', S.lang), [stampText(ev.missed, today)])] }),
          inFolder
            ? row([
                Button({ key: 'arcade-cal-run-missed', label: 'Запустить сейчас', ...focusOn('run-missed'), onPress: () => runMissed($, ev.id) }),
                Button({ key: 'arcade-cal-drop-missed', label: 'Не запускать', ...focusOn('drop-missed'), onPress: () => dropMissed($, ev.id) }),
              ])
            : dim('  Запустить можно в сессии Claude Code в папке задания.'),
        ]
      : []
    const giveBlock =
      kind === 'none'
        ? [kindPick, dim('  В своё время событие даст Claude очередь доски, одну карточку, шаблон из «Промптов» или свой текст.')]
        : [
            ...stack('cal-event-give', [kindPick, ...(kind === 'text' ? [textField] : targetOf())]),
            dim(ev.time ? '  В своё время — в запущенной сессии Claude Code в этой папке, только в одной. Claude занят — задание ждёт конца хода.' : '  В 9:00 — в запущенной сессии Claude Code в этой папке, только в одной. Claude занят — задание ждёт конца хода.'),
            ...(g && ev.cwd ? [keep(dim(`  ${tr('Папка', S.lang)}: ${ev.cwd}`))] : []),
            ...(g && ev.cwd && here && !inFolder
              ? [Button({ key: 'arcade-cal-give-here', label: 'Запускать в этой папке', ...focusOn('give-here'), onPress: () => editEvent($, ev.id, { cwd: here }) })]
              : []),
            dim('  Работает, пока открыт Claude Code и компьютер не спит. Задание идёт в режиме разрешений сессии: вне Auto Claude может ждать разрешения.'),
            ...missedLine,
          ]
    // Когда: «Завтра 15:00»; у серии — «🔁 По будням, 09:30 · первый раз сегодня»
    const when = ev.repeat ? `🔁 ${repeatText(ev.repeat)}, ${ev.time || tr('весь день', S.lang)} · ${tr('первый раз', S.lang)} ${dayText(ev.day, today)}` : cap(whenText(ev, today))
    const title = desktop ? { size: 'heading', weight: 'semibold', wrap: 'wrap' } : { bold: true }
    return [
      Button({ key: 'arcade-back', label: '← Назад', onPress: leave }),
      gap,
      keep(Box({ flexDirection: 'row', columnGap: 1, alignItems: 'center', children: [dot(ev, desktop ? { size: 'heading' } : {}), Text({ ...title, children: [ev.title] })] })),
      keep(dim(`${when}${ev.remind === null ? '' : ` · 🔔 ${remindText(ev)}`}`)),
      gap,
      ...stack('cal-event-fields', [
        Input({
          key: `arcade-cal-title-${cal.field}`,
          label: 'Название',
          value: ev.title,
          submitLabel: tr('Сохранить', S.lang),
          onSubmit: (value) => editEvent($, ev.id, { title: value }),
        }),
        // Когда — как в быстрой записи: «пт 15:00», «завтра», «2026-11-20 10:00»; без времени — на весь день
        Input({
          key: `arcade-cal-when-${cal.field}`,
          label: 'Когда',
          value: ev.time ? `${ev.day} ${ev.time}` : ev.day,
          placeholder: 'пт 15:00, завтра, 2026-11-20 10:00',
          submitLabel: tr('Сохранить', S.lang),
          onSubmit: async (value) => {
            const when = quickParse(value, ev.day, today)
            if (when.title) return say('Не понял, когда: пиши как «пт 15:00» или «2026-11-20 10:00».')
            if (await editEvent($, ev.id, { day: when.day, time: when.time, ...(when.repeat ? { repeat: when.repeat } : {}) })) {
              cal.field += 1
              $.ui.invalidate('ui.render')
            }
          },
        }),
        dim('  Без времени — на весь день.'),
        ...(ev.repeat ? [dim('  У повторяющегося события здесь — день первого раза.')] : []),
        repeatPick,
        Input({
          key: `arcade-cal-note-${cal.field}`,
          label: 'Заметка',
          rows: 4,
          value: ev.note ?? '',
          placeholder: 'ссылка на созвон, что взять, о чём спросить',
          submitLabel: tr('Сохранить', S.lang),
          onSubmit: (value) => editEvent($, ev.id, { note: value }),
        }),
      ]),
      gap,
      strong('Цвет'),
      colors,
      gap,
      strong('Напоминание'),
      ...stack('cal-event-remind', [remindPick, remindOwn]),
      dim('  Приходит системным уведомлением, пока открыт Claude Code.'),
      gap,
      strong('Дать Claude'),
      ...giveBlock,
      ...(cal.confirm
        ? []
        : [
            gap,
            Button({
              key: 'arcade-cal-delete',
              label: 'Удалить событие',
              ...focusOn('delete'),
              onPress: () => {
                cal.confirm = true
                $.ui.invalidate('ui.render')
              },
            }),
          ]),
      ...confirm,
      ...noteLine,
      ...noticeLines,
      ...hint,
    ]
  }

  // Событие кнопкой с цветным кружком: время (или «весь день») и название; в «Ближайшем» — ещё и день. Событие бывает
  // в обоих списках разом — ключи у списков свои
  const eventButton = (x, label, list) =>
    keep(Button({ key: `arcade-cal-${list}-${ref(x)}`, label, ...focusOn(`${list}-${ref(x)}`), children: [dot(x), ` ${label}`], onPress: openEvent(x, list) }))
  // В Desktop событие — карточка его цвета: название кнопкой, ниже когда и напоминание, первая строка заметки
  const eventCard = (x, when, list) => {
    const hex = colorOf(x)
    const line = (x.card ? [when, `${tr('доска', S.lang)} ${x.board}`, x.done ? tr('сделано', S.lang) : ''] : [when, x.repeat ? `🔁 ${repeatText(x.repeat)}` : '', x.remind === null ? '' : `🔔 ${remindText(x)}`, x.give ? `🤖 ${tr(GIVE_SHORT[x.give.kind], S.lang)}` : '', Number.isFinite(x.missed) ? `⚠ ${tr('пропущено', S.lang)}` : '']).filter(Boolean).join(' · ')
    const first = x.note?.split('\n')[0] ?? ''
    return Box({
      key: `cal-card-${list}-${ref(x)}`,
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: 'xs',
      borderStyle: 'round',
      borderColor: `${hex}80`,
      backgroundColor: `${hex}14`,
      paddingX: 'sm',
      paddingY: 'xs',
      hover: { borderColor: hex, backgroundColor: `${hex}26` },
      children: [
        eventButton(x, x.title, list),
        keep(dim(line)),
        ...(first ? [keep(Text({ dimColor: true, size: 'footnote', wrap: 'truncate-end', children: [first] }))] : []),
      ],
    })
  }
  // События и сроки карточек досок вместе; в «Ближайшем» — без сделанных карточек, серия — один раз, ближайшим
  const all = [...S.calendar, ...cardDues(S.notes)].sort(compareEvents)
  const dayEvents = between(all, selected, 1)
  const seen = new Set()
  const upcoming = between(all, today, UPCOMING_DAYS)
    .filter((x) => !x.done && !seen.has(x.id) && seen.add(x.id))
    .slice(0, UPCOMING_MAX)
  // Когда: «Сегодня, весь день», «Завтра 15:00»; у карточки — «Сегодня, срок карточки»
  const whenOf = (x) => cap(x.card ? `${dayText(x.day, today)}, ${tr('срок карточки', S.lang)}` : whenText(x, today))
  const addField = [
    Input({
      key: `arcade-cal-add-${cal.field}`,
      label: 'Новое событие',
      placeholder: 'завтра 15:00 Созвон',
      submitLabel: tr('Записать', S.lang),
      ...(cal.focus === 'add' || (!cal.focus && !S.calendar.length) ? { autoFocus: true } : {}),
      onSubmit: (value) => {
        cal.focus = 'add'
        return addFromScreen($, value, desktop ? selected : '')
      },
    }),
    dim(desktop ? '  День и время — словами или числами: «пт 9:30 стендап», «12.11 ревью». Без дня — на выбранный день, без времени — на весь день.' : '  День и время — словами или числами: «пт 9:30 стендап», «12.11 ревью». Без дня — на сегодня, без времени — на весь день.'),
    dim('  Цвет, напоминание и «Дать Claude» — в самом событии. Claude тоже ведёт календарь: «запиши созвон в пятницу в 15:00», «что у меня завтра?».'),
  ]
  const upcomingList = [
    section('Ближайшее'),
    ...(upcoming.length
      ? stack(
          'cal-upcoming',
          upcoming.map((x) => (desktop ? eventCard(x, whenOf(x), 'ev') : eventButton(x, `${whenOf(x)} · ${x.title}${x.repeat ? ' 🔁' : ''}${x.give ? ' 🤖' : ''}`, 'ev'))),
        )
      : [dim(S.calendar.length ? 'В ближайший месяц событий нет.' : 'Календарь пуст — запиши первое событие.')]),
  ]
  const reminders = [gap, dim('Напоминания приходят системным уведомлением, пока открыт Claude Code; пропущенные — при следующем запуске.')]
  // Пропущенные задания этой папки: Claude Code был закрыт или компьютер спал — задним числом само не идёт,
  // только по «Запустить сейчас»
  const missed = missedTasks()
  const missedBlock = missed.length
    ? [
        section('Пропущено'),
        ...stack(
          'cal-missed',
          missed.map((x) =>
            Box({
              key: `cal-missed-${x.id}`,
              flexDirection: 'column',
              rowGap: 'xs',
              children: [
                keep(Text({ ...(desktop ? { wrap: 'wrap' } : {}), children: [dot(x), ` ${x.title} · ${stampText(x.missed, today)}`] })),
                row([
                  Button({ key: `arcade-cal-run-${x.id}`, label: 'Запустить сейчас', ...focusOn(`run-${x.id}`), onPress: () => runMissed($, x.id) }),
                  Button({ key: `arcade-cal-drop-${x.id}`, label: 'Не запускать', ...focusOn(`drop-${x.id}`), onPress: () => dropMissed($, x.id) }),
                ]),
              ],
            }),
          ),
        ),
        dim('  Задание не пошло в своё время: Claude Code был закрыт или компьютер спал. Само задним числом не запускается.'),
        gap,
      ]
    : []
  if (!desktop) return [Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }), gap, ...missedBlock, ...addField, ...noteLine, ...upcomingList, ...reminders, ...noticeLines, ...hint]

  // Сетка месяца: 7 плиток одного размера в ряд, растянутых на всю ширину панели — плитка шире, чем выше. На плитке —
  // число кнопкой и цветные точки событий дня; выбранный день — в рамке цвета выбора, сегодняшний — с подложкой.
  // Боковые поля плитки заданы явно: Box с рамкой Desktop сам обводит полями pad.lg, и на узкой плитке кнопке с числом
  // не оставалось места — число обрезалось целиком. Кнопка с числом — без «пилюли» (plain): та шире самого числа и не
  // давала плиткам ужаться, ряд уезжал за край панели. Плитка ужимается до нуля, лишнее обрезается — но не ряд
  const cell = { width: 0, flexGrow: 1, minWidth: 0, overflow: 'hidden' }
  // События по дням всей сетки месяца — с разами серий
  const weeks = monthGrid(cal.month)
  const byDay = new Map()
  for (const x of between(all, weeks[0][0].day, weeks.length * 7)) byDay.set(x.day, [...(byDay.get(x.day) ?? []), x])
  const pickDay = (d) => () => {
    cal.day = d.day
    if (!d.inMonth) cal.month = d.day.slice(0, 7)
    cal.focus = `day-${d.day}`
    cal.note = ''
    $.ui.invalidate('ui.render')
  }
  const dayName = (day) =>
    `${day === today ? tr('Сегодня', S.lang) : day === addDays(today, 1) ? tr('Завтра', S.lang) : tr(WEEKDAYS_FULL[weekday(day)], S.lang)} · ${dm(day)}`
  const freeDay = (day) => dim(day < today ? 'В этот день ничего не было.' : 'Свободный день — запиши что-нибудь ниже.')
  const dayCards = (list) => list.map((x) => eventCard(x, x.card ? tr('срок карточки', S.lang) : (x.time ?? tr('весь день', S.lang)), 'dayev'))
  const dots = (list) =>
    Text({
      size: 'caption',
      children: list.length ? [...list.slice(0, DOTS_MAX).map((x) => dot(x)), ...(list.length > DOTS_MAX ? [Text({ dimColor: true, children: [`+${list.length - DOTS_MAX}`] })] : [])] : [' '],
    })
  const dayTile = (d) =>
    Box({
      key: `cal-cell-${d.day}`,
      ...cell,
      flexDirection: 'column',
      alignItems: 'center',
      rowGap: 'xs',
      paddingX: 'xs',
      paddingY: 'xs',
      borderStyle: 'round',
      borderColor: d.day === selected ? 'suggestion' : 'subtle',
      ...(d.day === today ? { backgroundColor: TODAY_BG } : {}),
      hover: { borderColor: 'suggestion', backgroundColor: HOVER_BG },
      children: [
        Button({
          key: `arcade-cal-day-${d.day}`,
          label: String(d.date),
          plain: true,
          ...(d.inMonth ? {} : { dimColor: true }),
          ...focusOn(`day-${d.day}`),
          onPress: pickDay(d),
        }),
        dots(byDay.get(d.day) ?? []),
      ],
    })
  const shift = (n, name) => () => {
    cal.month = addMonths(cal.month, n)
    cal.focus = name
    $.ui.invalidate('ui.render')
  }
  const monthTitle = `${tr(MONTHS[Number(cal.month.slice(5)) - 1], S.lang)} ${cal.month.slice(0, 4)}`
  const grid = Box({
    key: 'cal-grid',
    flexDirection: 'column',
    rowGap: CELL_GAP,
    children: [
      Box({ flexDirection: 'row', columnGap: CELL_GAP, children: CAL_WEEKDAYS.map((w) => Box({ key: `cal-wd-${w}`, ...cell, alignItems: 'center', children: [dim(w)] })) }),
      ...weeks.map((week) => Box({ key: `cal-week-${week[0].day}`, flexDirection: 'row', columnGap: CELL_GAP, children: week.map(dayTile) })),
    ],
  })
  // Узкая панель — месяц списком, как «Расписание» в календаре телефона: дни с событиями, сегодняшний и выбранный;
  // день — кнопкой, под ним карточки его событий
  const monthList = () => {
    const listed = weeks
      .flat()
      .filter((d) => d.inMonth && (byDay.has(d.day) || d.day === today || d.day === selected))
    return Box({
    key: 'cal-list',
    flexDirection: 'column',
    rowGap: 'md',
    children: listed.length
      ? listed.map((d) => {
          const cards = dayCards(byDay.get(d.day) ?? [])
          return Box({
            key: `cal-list-${d.day}`,
            flexDirection: 'column',
            rowGap: 'xs',
            children: [
              Button({ key: `arcade-cal-day-${d.day}`, label: dayName(d.day), ...(d.day === selected ? { variant: 'primary' } : {}), ...focusOn(`day-${d.day}`), onPress: pickDay(d) }),
              ...(cards.length ? [Box({ key: `cal-list-cards-${d.day}`, flexDirection: 'column', rowGap: 'sm', children: cards })] : [freeDay(d.day)]),
            ],
          })
        })
      : [dim('В этом месяце событий нет.')],
  })
  }
  const narrow = (e.viewport?.columns ?? Infinity) < LIST_BELOW
  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }),
    gap,
    ...missedBlock,
    row([
      Button({ key: 'arcade-cal-prev', label: '‹', ...focusOn('prev'), onPress: shift(-1, 'prev') }),
      keep(Text({ size: 'heading', weight: 'semibold', children: [monthTitle] })),
      Button({ key: 'arcade-cal-next', label: '›', ...focusOn('next'), onPress: shift(1, 'next') }),
      ...(cal.month === today.slice(0, 7) && selected === today
        ? []
        : [
            Button({
              key: 'arcade-cal-today',
              label: 'Сегодня',
              ...focusOn('today'),
              onPress: () => {
                cal.month = today.slice(0, 7)
                cal.day = ''
                cal.focus = `day-${today}`
                $.ui.invalidate('ui.render')
              },
            }),
          ]),
    ]),
    gap,
    ...(narrow ? [monthList()] : [grid, keep(section(dayName(selected))), ...(dayEvents.length ? stack('cal-day', dayCards(dayEvents)) : [freeDay(selected)])]),
    gap,
    ...addField,
    ...noteLine,
    ...upcomingList,
    ...reminders,
    ...noticeLines,
    ...hint,
  ]
}

// ━━━━━━━━━━ screens/pane ━━━━━━━━━━
// Arcade: панель — библиотека игр или сама игра. Шапка и общий набор кнопок здесь, разделы библиотеки — в соседних
// файлах, игра — в screens/game. Клавиши над экраном игры ловит Client (hooks/input.js) после клика по экрану, в любой раскладке.

export async function drawPane($, e) {
  const { Box, Text, Raster, Image, Button: makeButton, Svg, Input, Markdown, Select } = $.ui.resolve(e)
  // Готовая кнопка заморожена и свой onPress не отдаёт, а плитка Desktop пересобирает её с переносом названия:
  // пропсы каждой кнопки запоминаются здесь
  const buttonProps = new WeakMap()
  const Button = (props) => {
    const button = makeButton(props)
    buttonProps.set(button, props)
    return button
  }
  const now = await $.clock.now()
  const terminal = e.surface === 'terminal'
  const game = gameById(S.view)
  S.remoteSurface = terminal ? null : e.surface
  // Поле поиска рисуется заново, когда на экран поиска приходят с другого: запрос остаётся, а пока человек печатает,
  // поле то же — набранное не сбивается
  if (game || S.menu !== 'search') finder.shown = false

  // Шапка: логотип (Desktop и VS Code), название, состояние агента цветом: работает (и в фоне) — жёлтый, ждёт
  // разрешения — красный, закончил — зелёный, свободен — серый. Цвета — ключи темы: читаются и на светлой, и на тёмной
  const statusColor = S.status === 'permission' ? 'error' : S.status === 'working' || S.status === 'background' ? 'warning' : S.status === 'done' ? 'success' : 'inactive'
  const headerOf = (extra = []) => Box({
    flexDirection: 'row',
    columnGap: 2,
    alignItems: 'center',
    children: [
      // логотип — только в главном меню библиотеки в Desktop: над экраном игры он не нужен
      ...(!game && S.menu === 'main' && e.surface === 'desktop' ? [Svg({ source: LOGO_SVG, alt: 'Arcade', width: 40, height: 40 })] : []),
      e.surface === 'desktop' && !game
        ? Text({ size: 'title', weight: 'bold', children: [libraryTitle()] })
        : Text({ bold: true, children: [game ? `Arcade · ${game.title}` : libraryTitle()] }),
      // В Desktop — «таблетка» в рамке цвета состояния; в терминале и VS Code — как было
      Box({
        flexDirection: 'row',
        columnGap: 1,
        ...(e.surface === 'desktop' ? { borderStyle: 'round', borderColor: statusColor, paddingX: 'sm' } : {}),
        children: [
          Text({ color: statusColor, children: ['●'] }),
          Text({ color: statusColor, children: [statusText(now)] }),
        ],
      }),
      ...extra,
    ],
  })
  const header = headerOf()
  // Журнал агента — с подписью и только когда в нём что-то есть: одинокое «пока ничего» внизу меню выглядело обломком
  const eventLines = S.events.length
    ? [Text({ bold: true, dimColor: true, children: ['Журнал агента'] }), ...S.events.slice(0, 3).map((text) => Text({ dimColor: true, children: [text] }))]
    : []

  if (!game) {
    // ROM для игры в панели: встроенный, из кеша мода или скачанный с сайта — всегда сверяется с хешем каталога
    const obtainRom = async (g) => {
      const sha = g.rom.sha256
      if (g.rom.mine) {
        const text = await $.fs.read(mineFile(sha)).catch(() => '')
        if (await verifyRom(text, sha)) return text.trim()
        S.libraryNotice = `Файл игры «${g.title}» не найден — добавь его снова: /arcade-add путь к файлу`
        return null
      }
      const bundled = bundledRom(sha)
      if (bundled) return bundled
      const cached = await $.store.get(`rom:${sha}`)
      if (await verifyRom(cached, sha)) return cached
      S.libraryNotice = `Скачиваю ${g.title}…`
      $.ui.invalidate('ui.render')
      try {
        const response = await $.http.fetch(siteUrl(g.rom.base64))
        const text = response.ok ? response.text.trim() : ''
        if (!(await verifyRom(text, sha))) throw new Error(response.ok ? 'файл повреждён' : `сайт ответил ${response.status}`)
        const index = await $.store.get('roms')
        const keep = [...(Array.isArray(index) ? index : []).filter((x) => x !== sha), sha]
        for (const old of keep.slice(0, -ROM_CACHE_LIMIT)) await $.store.delete(`rom:${old}`)
        await $.store.set(`rom:${sha}`, text)
        await $.store.set('roms', keep.slice(-ROM_CACHE_LIMIT))
        S.libraryNotice = ''
        return text
      } catch (err) {
        S.libraryNotice = `Не получилось скачать ${g.title}: ${err?.message ?? err}`
        return null
      }
    }
    // Игра открывается в окне браузера или здесь, в панели
    const playGame = async (g) => {
      // Всё, кроме Денди и своих игр, идёт только в окне браузера (EmulatorJS на сайте): в панели показать нечем
      const sega = Boolean(g.console) && g.console !== 'nes' && !g.engine // у «Проверки клавиш» приставки нет, а своя игра (Flappy Arcade) — в панели
      if (sega && builtinBrowser(e.surface, mouseGame(g.id))) {
        S.lastGame = g.id
        S.played = true
        await desktopWindow($, g.id, `${g.title} открыт во встроенном браузере Claude.`)
        await $.store.set('lastGame', g.id)
        return
      }
      if (sega && !S.platform) {
        S.libraryNotice = `Игры ${consoleTitle(g.console)} идут в окне браузера, а здесь его открыть нельзя.`
        $.ui.invalidate('ui.render')
        return
      }
      S.lastGame = g.id
      S.played = true
      if ((opensWindow(e.surface) || sega) && g.web) {
        S.libraryNotice = 'Открываю окно…'
        $.ui.invalidate('ui.render')
        const command = windowCommand(g.id)
        try {
          const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
          windowNotice($, launchNotice(result, g.id))
          if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
        } catch (err) {
          S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
        }
      } else if (g.rom) {
        const rom = await obtainRom(g)
        if (rom) launch(g.id, rom)
      } else {
        launch(g.id)
      }
      $.ui.invalidate('ui.render')
      await $.store.set('lastGame', g.id)
    }
    const gameButton = (g, focus) =>
      Button({
        key: `arcade-game-${g.id}`,
        label: g.title,
        ...(focus ? { autoFocus: true } : {}),
        onPress: () => playGame(g),
      })
    const open = (id) => () => {
      S.menuFrom = S.menu
      S.menu = id
      S.libraryNotice = ''
      $.ui.invalidate('ui.render')
      // Блокнот, доски и календарь — свежие: их могли поправить в другой сессии Claude Code
      if (notesShown() || id === 'today') refreshNotes($).catch(modError)
      if (calendarShown() || id === 'today') refreshCalendar($).catch(modError)
    }
    const back = Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') })
    const dim = (text) => Text({ dimColor: true, children: [text] })
    const gap = Text({ children: [' '] })
    // Разделы и плитки главного меню: кнопка с подписью — в рамке; плитки рядами, в узкой панели — колонкой
    const desktop = e.surface === 'desktop'
    // Окно Arcade, сетевые игры и приглашения в них — где есть окно браузера или встроенный браузер Desktop
    const windowed = windowMode() || desktop
    // В Desktop заголовок раздела — крупно, с отступом сверху от раздела выше и снизу от своих плиток
    const section = (title) => (desktop ? Box({ marginTop: 'lg', marginBottom: 'sm', children: [Text({ size: 'heading', weight: 'semibold', children: [title] })] }) : Text({ bold: true, dimColor: true, children: [title] }))
    // Разделы главного меню — в настройках и на приветствии: убранного раздела в меню нет совсем, ни заголовка, ни плиток
    const sectionSwitches = (focus = () => ({})) =>
      HIDEABLE.flatMap((id) => [
        Button({
          key: `arcade-show-${id}`,
          label: SECTION_SWITCH[id][S.hidden.includes(id) ? 1 : 0],
          ...focus(`arcade-show-${id}`),
          onPress: () => toggleHidden($, id),
        }),
        dim(`  ${SECTION_NOTES[id]}`),
      ])
    // Картинки (аватарки, плитки) — везде, кроме терминала: там то же самое текстом
    const pictures = !terminal
    // Выбор одной из AVATAR_COUNT картинок: своя аватарка в «Аккаунте», картинка группы у её хозяина. Каждая — плитка
    // одного размера в рамке: картинка и под ней название кнопкой, длинное — в две строки; выбранная — главной кнопкой
    // и рамкой цвета выбора. Последняя — без картинки: на ней буква, как будет без аватарки (noneSvg). В терминале —
    // одни названия
    const PIC_TILE = 16 // ширина плитки в клетках: самое длинное слово названия («космонавт») встаёт целиком
    const picTile = (key, source, alt, button, selected) =>
      Box({
        key: `card-${key}`,
        flexDirection: 'column',
        alignItems: 'center',
        rowGap: 'xs',
        borderStyle: 'round',
        borderColor: selected ? 'suggestion' : 'subtle',
        padding: 'sm',
        width: PIC_TILE,
        minHeight: 6,
        overflow: 'hidden',
        hover: { borderColor: 'suggestion', backgroundColor: '#8080801a' },
        children: [keep(Svg({ source, alt, width: 40, height: 40 })), button],
      })
    const picGrid = (prefix, current, onPick, noneLabel, noneSvg) => {
      const choice = (key, label, selected, onPress) =>
        Button({ key, label, ...(selected ? { variant: 'primary' } : {}), ...(pictures ? { children: [Text({ wrap: 'wrap', children: [label] })] } : {}), onPress })
      const none = choice(`${prefix}-none`, noneLabel, !validPic(current), () => onPick(null))
      return Box({
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: pictures ? 'sm' : 2,
        rowGap: pictures ? 'sm' : 0,
        children: [
          ...Array.from({ length: AVATAR_COUNT }, (_, n) => {
            const name = avatarName(n, S.lang)
            const button = keep(choice(`${prefix}-${n}`, name, n === current, () => onPick(n)))
            return pictures ? picTile(`${prefix}-${n}`, avatarSvg(n), name, button, n === current) : button
          }),
          pictures ? picTile(`${prefix}-none`, noneSvg, noneLabel, none, !validPic(current)) : none,
        ],
      })
    }
    // Своя тема в темах YouTube, статей и подкастов: поле ввода с подсказкой или заметкой, «Мои темы» плитками и
    // «Забыть мои темы». Названия своих тем — на языке интерфейса или как их написал человек (keep)
    const ownTopics = (kind, short, focus, hintText) => {
      const myTiles = S.myTopics.flatMap((t) => {
        const key = `u${t.id}`
        const button = Button({
          key: `arcade-${short}-own-${t.id}`,
          label: t.title,
          ...(key === focus ? { autoFocus: true } : {}),
          onPress: () => {
            open(`${kind}:${key}`)()
            if (kind === 'youtube') {
              if (S.yt.topic !== key || (!S.yt.videos.length && !S.yt.loading)) loadVideos($, key)
            } else if (S.reads[kind].topic !== key || (!S.reads[kind].items.length && !S.reads[kind].loading)) loadReads($, kind, key)
          },
        })
        return [keep(button), dim('  своя тема')]
      })
      return [
        gap,
        Input({ key: `arcade-${short}-own`, label: 'Своя тема', placeholder: 'о чём угодно: история Рима, хлеб на закваске…', onSubmit: (value) => addTopic($, kind, value) }),
        dim(S.ownNote.kind === kind && S.ownNote.text ? S.ownNote.text : hintText),
        ...(myTiles.length
          ? [
              section('Мои темы'),
              desktop ? tiles(myTiles, 44) : Box({ flexDirection: 'column', children: myTiles }),
              gap,
              Button({ key: `arcade-${short}-forget`, label: 'Забыть мои темы', onPress: () => forgetTopics($) }),
            ]
          : []),
      ]
    }
    // Иконка карточки — по ключу кнопки: arcade-menu-nes → nes, arcade-game-… и «Продолжить» → обложка игры.
    // alt — подпись кнопки: картинку с пустым alt Desktop не рисует
    const iconFor = (button) => {
      const key = String(button?.key ?? button?.props?.key ?? '')
      const label = String(button?.props?.label ?? button?.label ?? '')
      const game = key.startsWith('arcade-game-') ? gameById(key.slice(12)) : key === 'arcade-continue' && S.played ? gameById(S.lastGame) : null
      if (game) return Svg({ source: coverSvg(game), alt: game.title, width: 44, height: 44 })
      // Плитка языка (arcade-lang-de) — флажком, подпись — название языка на нём самом
      const flag = /^arcade-lang-([a-z]{2})$/.exec(key)?.[1]
      if (FLAGS[flag]) return Svg({ source: flagSvg(flag), alt: LANG_NAMES[flag], width: 36, height: 36 })
      // Раздел главного меню в настройках (arcade-show-play) — иконкой его главной плитки, убранный — серой
      const shown = /^arcade-show-([a-z]+)$/.exec(key)?.[1]
      if (SECTION_ICONS[shown]) return Svg({ source: iconSvg(SECTION_ICONS[shown], S.hidden.includes(shown) ? OFF_COLOR : undefined), alt: label, width: 36, height: 36 })
      // arcade-menu-shelf-racing → racing, arcade-lang-main → lang, arcade-support → support. Язык книг — глобусом,
      // «Мои книги» — папкой, разделы книг (arcade-bk-sec-…) и аудиокниг (arcade-ab-…) — иконкой своего раздела.
      // Темы YouTube (arcade-yt-topic-…), статей (ar-) и подкастов (pc-) — иконкой раздела; их названия придумала
      // модель, в alt не ставим
      const kind = key
        .replace(/^arcade-(menu-(shelf-)?)?/, '')
        .replace(/^favorites-.+$/, 'favorites')
        .replace(/^(bk|ab)-lang(-.+)?$/, 'lang')
        .replace(/^(bk|ab)-mine$/, 'mine')
        .replace(/^bk-.+$/, 'books')
        .replace(/^ab-.+$/, 'audiobooks')
        .replace(/^lang-main$/, 'lang')
        .replace(/^open-library$/, 'library')
        .replace(/^yt-.+$/, 'youtube')
        .replace(/^ar-.+$/, 'articles')
        .replace(/^pc-.+$/, 'podcasts')
        .replace(/^tw-.+$/, 'twitch')
        .replace(/^tt-.+$/, 'tiktok')
        // Доска проектов — иконкой доски
        .replace(/^desk-.+$/, 'boards')
        // Страница блокнота — иконкой блокнота
        .replace(/^note-.+$/, 'notes')
      const alts = { youtube: 'YouTube', articles: 'Статьи', podcasts: 'Подкасты', twitch: 'Twitch' }
      return Svg({ source: iconSvg(kind), alt: alts[kind] ?? (label || kind), width: 36, height: 36 })
    }
    // Карточка: ровная ширина в клетках — плитки встают сеткой; рамка и подсветка — цветами темы, светлой и тёмной.
    // Иконка и текст прижаты к верху, лишнее обрезается рамкой, а не ложится на соседнюю плитку.
    // Блок с ключом — сам зона наведения
    const card = (children, key, width) =>
      Box({
        key: `card-${key}`,
        flexDirection: 'row',
        alignItems: 'flex-start',
        columnGap: 'sm',
        borderStyle: 'round',
        borderColor: 'subtle',
        padding: 'sm',
        width,
        overflow: 'hidden',
        hover: { borderColor: 'suggestion', backgroundColor: '#8080801a' },
        children,
      })
    // Ширина плитки — от ширины панели: в ряд встаёт столько плиток не уже min, сколько влезает, и они делят ряд поровну.
    // Запас в 4 клетки — на поля панели и полосу прокрутки
    const TILE_GAP = 2
    const tileWidth = (min) => {
      const room = Math.max(min, (e.viewport?.columns ?? PANE_COLUMNS) - 4)
      const perRow = Math.max(1, Math.floor((room + TILE_GAP) / (min + TILE_GAP)))
      return Math.floor((room - (perRow - 1) * TILE_GAP) / perRow)
    }
    const tiles = (list, min = 32) => {
      if (desktop) {
        const width = tileWidth(min)
        // Описание — около трёх строк мелкого шрифта; длиннее — обрезано, целиком по «ещё»
        const room = Math.max(60, Math.round((width - 8) * 3.6))
        const words = (t) => [...(t.children ?? t.props?.children ?? [])].join('')
        const out = []
        for (let i = 0; i < list.length; i++) {
          const x = list[i]
          if (!x || (x.type === 'Text' && words(x) === ' ')) continue
          const note = list[i + 1]
          if (x.type === 'Button') {
            const hasNote = note && note.type === 'Text' && note.props?.dimColor
            const cardKey = String(x.key ?? x.props?.key ?? i)
            // Название переносится на вторую строку, а не раздвигает плитку; подпись кнопки остаётся её именем
            const made = buttonProps.get(x)
            const title = made?.label ? makeButton({ ...made, children: [Text({ wrap: 'wrap', children: [made.label] })] }) : x
            if (title !== x && isKept(x)) keep(title)
            const body = [title]
            if (hasNote) {
              // Описание переводится здесь, до обрезки: словарь узнаёт фразу только целиком
              const raw = words(note).trim()
              const text = isKept(note) ? raw : tr(raw, S.lang)
              const long = text.length > room
              const shown = long && !unfolded.has(cardKey) ? clip(text, room) : text
              body.push(keep(Text({ size: 'footnote', dimColor: true, wrap: 'wrap', children: [shown] })))
              if (long)
                body.push(
                  Button({
                    key: `arcade-more-${cardKey}`,
                    label: unfolded.has(cardKey) ? 'свернуть' : 'ещё',
                    plain: true,
                    dimColor: true,
                    onPress: () => {
                      if (unfolded.has(cardKey)) unfolded.delete(cardKey)
                      else unfolded.add(cardKey)
                      $.ui.invalidate('ui.render')
                    },
                  }),
                )
              i++
            }
            // У игры и книги — звёздочка избранного в углу карточки
            const starred = cardKey.startsWith('arcade-game-') ? gameById(cardKey.slice(12)) : null
            const corner = starred && starred.id !== FIELD.id ? [favButton(starred)] : []
            out.push(card([iconFor(x), Box({ flexDirection: 'column', rowGap: 'xs', flexGrow: 1, flexShrink: 1, minWidth: 0, children: body }), ...corner], cardKey, width))
          } else out.push(x)
        }
        return Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: TILE_GAP, rowGap: 'md', children: out })
      }
      const out = []
      for (let i = 0; i < list.length; i++) {
        const x = list[i]
        if (!x || (x.type === 'Text' && x.props?.children?.[0] === ' ')) continue
        const note = list[i + 1]
        if (x.type === 'Button' && note && note.type === 'Text' && note.props?.dimColor) {
          out.push(Box({ flexDirection: 'column', borderStyle: 'round', borderDimColor: true, paddingX: 1, minWidth: 24, children: [x, note] }))
          i++
        } else out.push(Box({ flexDirection: 'column', borderStyle: 'round', borderDimColor: true, paddingX: 1, minWidth: 24, children: [x] }))
      }
      return Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 1, children: out })
    }
    const noticeLines = S.libraryNotice ? [gap, Text({ color: 'warning', children: [S.libraryNotice] })] : []
    // Друг зовёт сыграть: «Принять» открывает игру, «Не сейчас» убирает приглашение. Без окна браузера — подсказка
    const inviteRows = (invite, focus) => [
      Text({ bold: true, children: [`@${invite.handle} зовёт сыграть: ${gameById(invite.game)?.title ?? invite.game}`] }),
      Box({
        flexDirection: 'row',
        columnGap: 2,
        children: [
          ...(windowed
            ? [Button({ key: `arcade-inv-accept-${invite.from}`, label: 'Принять', ...(focus ? { autoFocus: true } : {}), onPress: () => answerInvite($, e.surface, invite, true) })]
            : [dim('Сетевые игры открываются в окне браузера — выбери его в настройках.')]),
          Button({ key: `arcade-inv-later-${invite.from}`, label: 'Не сейчас', onPress: () => answerInvite($, e.surface, invite, false) }),
        ],
      }),
    ]
    const hint = [gap, dim('↑ ↓ или Tab — выбрать, Enter — открыть. Можно кликнуть мышью.')]
    // Звёздочка избранного у игры или книги: ☆ — отметить, ★ — уже в избранном, нажать — снять
    const favButton = (g) => {
      const marked = S.favorites.includes(g.id)
      return keep(Button({ key: `arcade-fav-${g.id}`, label: marked ? '★' : '☆', plain: true, ...(marked ? {} : { dimColor: true }), onPress: () => toggleFavorite($, g.id) }))
    }
    // Игры или книги списком: в Desktop — плитками со звёздочкой, в терминале — строкой «название ☆», описание ниже
    const gameRows = (list, focusId) =>
      desktop
        ? [tiles(list.flatMap((g) => [gameButton(g, g.id === focusId), dim(`  ${g.note}`)]))]
        : list.flatMap((g) => [Box({ flexDirection: 'row', columnGap: 2, children: [gameButton(g, g.id === focusId), favButton(g)] }), dim(`  ${g.note}`)])
    // Найденное и избранное — разделами «Игры · Платформер», «Книги · Роман»; разделы — в порядке первой записи
    const byGenre = (list, focusId) => {
      const parts = new Map()
      for (const g of list) {
        const id = `${tabOf(g)?.id ?? ''}|${g.genre ?? ''}`
        if (!parts.has(id)) parts.set(id, { first: g, list: [] })
        parts.get(id).list.push(g)
      }
      return [...parts.values()].flatMap(({ first, list: part }) => {
        const tab = tabOf(first)
        const title = [tab && tr(tab.title, S.lang), first.genre && genreLabel(first.genre)].filter(Boolean).join(' · ')
        return [keep(section(title)), ...gameRows(part, focusId)]
      })
    }
    // Трансляция Twitch: во встроенном браузере Claude, в окне браузера или ссылкой, если окно открыть нечем
    const watchLive = async (login) => {
      const id = `live:${login}`
      if (builtinBrowser(e.surface)) return desktopWindow($, id, 'Трансляция открыта во встроенном браузере Claude.')
      if (!S.platform) {
        S.libraryNotice = `Трансляция: https://www.twitch.tv/${login}`
        $.ui.invalidate('ui.render')
        return
      }
      S.libraryNotice = 'Открываю окно…'
      $.ui.invalidate('ui.render')
      const command = windowCommand(id)
      try {
        const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
        windowNotice($, launchNotice(result, id))
        if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
      } catch (err) {
        S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
      }
      $.ui.invalidate('ui.render')
    }

    // Что из шапки и набора выше нужно экранам библиотеки
    const kit = {
      Box, Button, Input, Svg, TILE_GAP, Text, back, byGenre, desktop, dim, eventLines, gameButton, gameRows, gap, hint, inviteRows, makeButton, noticeLines,
      now, open, ownTopics, picGrid, pictures, playGame, section, sectionSwitches, tileWidth, tiles, watchLive, windowed,
      // Текст, который можно выделить и скопировать: в Desktop и VS Code — Markdown, как ответ Claude; в терминале — нет
      Markdown: terminal ? null : Markdown,
      // Выбор из списка (напоминание в календаре); на телефоне его нет
      Select: Select ?? null,
    }

    let items
    let headerExtra = []
    if (S.menu === 'lang') items = langScreen($, e, kit)
    else if (S.menu === 'account') items = accountScreen($, e, kit)
    else if (S.menu === 'report') items = reportScreen($, e, kit)
    else if (S.menu === 'reports') items = reportsScreen($, e, kit)
    else if (S.menu === 'friends:invite' && S.ol.to && S.acct.handle) items = inviteScreen($, e, kit)
    else if (S.menu === 'friends' || S.menu === 'friends:remove' || S.menu === 'friends:invite') items = friendsScreen($, e, kit)
    else if (S.menu === 'chats' || S.menu.startsWith('chats:')) items = chatsScreen($, e, kit)
    else if (S.menu === 'settings') {
      // Отсрочку «сыграть?» могли поменять в другой сессии — перечитать (не чаще раза в LATER_READ_MS)
      await laterOn($, now)
      items = settingsScreen($, e, kit)
    }
    else if (S.menu === 'youtube') items = youtubeScreen($, e, kit)
    else if (S.menu.startsWith('youtube:')) items = youtubeTopicScreen($, e, kit)
    else if (promptsShown()) items = promptsScreen($, e, kit)
    else if (S.menu === 'boards' || S.menu.startsWith('board:') || (S.menu.startsWith('note:') && isBoard(S.notes.find((p) => p.id === S.menu.slice(5))))) items = boardsScreen($, e, kit)
    else if (S.menu === 'notes' || S.menu.startsWith('note:')) items = notesScreen($, e, kit)
    else if (calendarShown()) items = calendarScreen($, e, kit)
    else if (S.menu === 'agents') items = agentsScreen($, e, kit)
    else if (S.menu === 'usage') items = usageScreen($, e, kit)
    else if (S.menu === 'today') items = todayScreen($, e, kit)
    else if (S.menu === 'tiktok') items = tiktokScreen($, e, kit)
    else if (S.menu === 'twitch' || S.menu.startsWith('twitch:')) items = twitchScreen($, e, kit)
    else if (S.menu === 'articles' || S.menu === 'podcasts') items = readsScreen($, e, kit)
    else if (S.menu.startsWith('articles:') || S.menu.startsWith('podcasts:')) items = readsTopicScreen($, e, kit)
    else if (S.menu === 'search') items = searchScreen($, e, kit)
    else if (S.menu === 'favorites' || S.menu.startsWith('favorites:')) items = favoritesScreen($, e, kit)
    else if (S.menu === 'mine') items = mineScreen($, e, kit)
    else if (groupsList().some((x) => x.id === S.menu)) items = groupScreen($, e, kit)
    else if (/^(books|audiobooks)(:(lang|list))?$/.test(S.menu)) items = booksScreen($, e, kit)
    else if (S.menu === 'main' && !S.welcomed) items = welcomeScreen($, e, kit)
    else if (S.menu !== 'main') items = shelfScreen($, e, kit)
    else ({ items, headerExtra } = mainScreen($, e, kit))
    return Box({ flexDirection: 'column', children: [headerExtra.length ? headerOf(headerExtra) : header, gap, ...items] })
  }
  return gameScreen($, e, { Box, Button, Image, Raster, Svg, Text, eventLines, game, header, terminal })
}

// ━━━━━━━━━━ подписки на события Claude Code ━━━━━━━━━━
// для тестов (tests/arcade.test.ts)

export function register(on) {
  on('session.start', async ($, e, next) => {
    try {
      // Модуль перезагрузили (/reload-plugins, обновление), а панель осталась открытой: движок её помнит, а наш флаг — нет.
      // Без этого после перезагрузки панель не закрывалась, когда Claude открывал игру во встроенном браузере
      S.paneOpen = (await $.ui.panes().catch(() => [])).some((p) => p.id === PANE)
      if (S.paneOpen) S.paneSeen = true
      // Общие настройки (SYNC_KEYS): чего в $.store нет или что не подходит — остаётся по умолчанию
      for (const key of SYNC_KEYS) if (applySetting(key, await $.store.get(key))) savedKeys.add(key)
      if (!savedKeys.has('lang')) S.lang = detectLang(await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG'))
      // Язык книг: выбранный в «Книгах», иначе язык интерфейса
      S.bk = { ...S.bk, lang: bookLang(await $.store.get('booksLang'), S.lang) }
      S.stamps = restoreStamps(await $.store.get('syncAt'))
      S.msgNotify = (await $.store.get('msgNotify')) !== false
      S.agNotify = (await $.store.get('agentsNotify')) !== false
      S.agDone = (await $.store.get('agentsDone')) === true
      S.agOs = (await $.store.get('agentsOs')) !== false
      S.agSound = (await $.store.get('agentsSound')) !== false
      S.agHidden = hiddenOf(await $.store.get('agentsHidden'))
      S.us.warn = (await $.store.get('usageWarn')) !== false
      S.acct.session = restoreAccount(await $.store.get('account'))
      S.mine = restoreMine(await $.store.get('mine'))
      await loadNotes($)
      // Команды проверки между карточками очереди — только этого компьютера (app/check)
      await loadChecks($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
      await loadCalendar($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
      const home = (await $.env.get('USERPROFILE')) || (await $.env.get('HOME'))
      if (home) {
        S.sep = home.includes('\\') ? '\\' : '/'
        S.dataDir = [home.replace(/[\\/]+$/, ''), '.claude', 'arcade', 'roms'].join(S.sep)
      }
      // «Не сейчас» у строки «сыграть?» — отсрочка файлом в ~/.claude/arcade, общая для сессий этого компьютера
      startLater(home)
      // Отметка этой сессии для вкладки «Агенты» и очереди на несколько сессий — файлом в ~/.claude/arcade/agents
      await startAgents($, home)
      // «Что поменялось» в «Агентах»: ветка и незакоммиченные файлы — git читает сейчас и в конце каждого хода, не по таймеру
      $.clock.after(0, () => changesPoll($).catch((err) => log(`что поменялось: ${err?.message ?? err}`)))
      // Очередь, которая ждала сброса лимита Claude до перезапуска, — ждёт дальше; доски «продолжать после сброса»
      await resumeStart($).catch((err) => log(`очередь после сброса: ${err?.message ?? err}`))
      S.catalog = restoreCatalog(await $.store.get('catalog')) ?? S.catalog
      const savedGame = await $.store.get('lastGame')
      S.played = games().some((g) => g.id === savedGame)
      if (S.played) S.lastGame = savedGame
      // Кто Arcade уже пользовался (играл, менял настройки, входил), приветствия не видит
      S.welcomed = (await $.store.get('welcomed')) === true || S.played || savedKeys.size > 0 || Boolean(S.acct.session)
      const savedGraphics = await $.store.get('graphics')
      if (GRAPHICS.includes(savedGraphics)) S.graphics = savedGraphics
      const savedOpener = await $.store.get('opener')
      if (savedOpener?.opener === 'window' || savedOpener?.opener === 'pane') S.opener = savedOpener.opener
      // Браузер Desktop сохраняет и без выбора терминала (opener — null)
      if (typeof savedOpener?.browser === 'string') S.browserChoice = savedOpener.browser
      if ((await $.store.get('desktopOpener')) === 'window') S.desktopOpener = 'window'
      const localAppData = await $.env.get('LOCALAPPDATA')
      S.profileRoot = localAppData ? `${localAppData}\\claude-arcade` : ''
      if ((await $.env.get('OS')) === 'Windows_NT') S.platform = 'windows'
      // Кто ждёт в сети — раз в минуту; первый раз — сразу после каталога
      const pollLobbies = async () => {
        try {
          const response = await $.http.fetch(siteUrl('api/lobbies'))
          if (!response.ok) return
          const lobbyList = waitingFrom(JSON.parse(response.text))
          if (JSON.stringify(lobbyList) !== JSON.stringify(S.netWaiting)) {
            S.netWaiting = lobbyList
            $.ui.invalidate('ui.render')
          }
        } catch {
          // сайт недоступен — показываем то, что было
        }
      }
      $.clock.after(2_000, pollLobbies)
      $.clock.every(LOBBIES_EVERY_MS, pollLobbies)
      // Настройки с других компьютеров — вскоре после старта и раз в полчаса; без входа syncAccount ничего не делает
      $.clock.after(3_000, () => syncAccount($))
      $.clock.every(SYNC_EVERY_MS, () => syncAccount($))
      // Чаты — пока панель открыта на библиотеке и человек вошёл: открытый чат спрашиваем часто, список — реже;
      // сколько непрочитанных для плитки «Чаты» приносит отметка «в сети»
      const chatsOn = () => S.paneOpen && S.acct.session && S.view === 'library'
      $.clock.every(CHAT_POLL_MS, () => {
        if (chatsOn() && S.menu === 'chats:talk') pollChat($).catch(modError)
      })
      $.clock.every(CHATS_POLL_MS, () => {
        // Список — на всех экранах чатов: в широкой панели Desktop он слева от переписки, нового чата и участников
        if (chatsOn() && (S.menu === 'chats' || S.menu.startsWith('chats:') || S.menu === 'today')) loadChats($, true).catch(modError)
      })
      // «В сети» — пока панель открыта на библиотеке: отметка раз в PULSE_MS, а когда просили — сразу
      $.clock.every(PULSE_SOON_MS, () => {
        if (chatsOn()) pulse($).catch(modError)
      })
      // Всплывающие уведомления о сообщениях — и при закрытой панели, пока они включены и человек вошёл
      $.clock.every(POPUP_POLL_MS, () => watchMessages($).catch(modError))
      // Доска проектов: открытую общую доску (на экране «Промпты» — общие наборы) сверяем с сайтом, список общих досок
      // на её экране — обновляем; свои правки, не ушедшие в прошлый раз, — на сайт вскоре после старта
      $.clock.every(BOARD_POLL_MS, () => {
        if (!chatsOn()) return
        const shares = shownShares()
        if (shares.some((share) => !S.desks[share]) || (shares.length && !S.dk.me)) loadBoards($, true).catch(modError)
        else for (const share of shares) syncBoard($, share).catch(modError)
      })
      $.clock.every(BOARDS_POLL_MS, () => {
        if (chatsOn() && /^(boards|prompts)$/.test(S.menu)) loadBoards($, true).catch(modError)
      })
      $.clock.after(4_000, () => pushBoards($))
      // Блокнот на экране — перечитываем: его могли поправить в другой сессии Claude Code
      $.clock.every(NOTES_POLL_MS, () => {
        // «Сегодня» показывает и сроки карточек, и события — перечитываем оба
        const today = S.menu === 'today'
        if (S.paneOpen && S.view === 'library' && (notesShown() || today)) refreshNotes($).catch(modError)
        if (S.paneOpen && S.view === 'library' && (calendarShown() || today)) refreshCalendar($).catch(modError)
      })
      // Отметка сессии — маленькая запись раз в несколько секунд; чужие читаем, только когда они нужны. Очередь, которую
      // остановили во всех сессиях, — тут же
      $.clock.every(AGENT_TICK_MS, async () => {
        // Главный ход кончился, а агенты в фоне — сколько их ещё и не пора ли сказать «закончил»
        await bgCheck($)
        await agentsTick($)
        if (S.queue) await queueStopCheck($).catch(modError)
        await resumeTick($)
        // Задания по расписанию — тем же шагом: «на ногах ли сессия» считает resumeTick
        await scheduleTick($).catch(modError)
      })
      // Лимиты и контекст — что Claude Code знает уже сейчас (контекст, расходы; окна лимитов — после первого ответа);
      // дальше — раз в полминуты и после каждого хода
      $.clock.after(1_000, () => usageNow($))
      $.clock.every(USAGE_POLL_MS, () => usagePoll($).catch(modError))
      // Напоминания календаря: пропущенные, пока Claude Code был закрыт, — чуть погодя после старта; дальше таймер сам
      $.clock.after(5_000, () => remindNow($).catch(modError))
      // Каталог с сайта и ОС — в фоне, чтобы не держать старт сессии
      $.clock.after(150, async () => {
        try {
          const response = await $.http.fetch(siteUrl('catalog.json'))
          const fromSite = response.ok ? parseCatalog(response.text) : null
          if (fromSite) {
            S.catalog = fromSite
            await $.store.set('catalog', { consoles: fromSite.consoles, groups: fromSite.groups, shelves: fromSite.shelves, support: fromSite.support, games: fromSite.games })
            $.ui.invalidate('ui.render')
          }
        } catch (err) {
          log(`каталог с сайта не получен: ${err?.message ?? err}`)
        }
      })
      if (!S.platform) {
        $.clock.after(100, async () => {
          try {
            const result = await $.process.run(['uname', '-s'], { timeoutMs: 5000 })
            const name = result.stdout.trim()
            if (name === 'Darwin') S.platform = 'mac'
            if (name === 'Linux') S.platform = 'linux'
            $.ui.invalidate('ui.render')
          } catch {
            // Нет uname — не macOS и не Linux; играем в панели
          }
        })
      }
      // Браузеры на Windows ищем в фоне: PowerShell стартует за полсекунды, сессию из-за него не держим
      if (S.platform === 'windows') {
        $.clock.after(100, async () => {
          try {
            const result = await $.process.run(DETECT_ARGV, { timeoutMs: LAUNCH_TIMEOUT_MS })
            S.detection = parseDetection(result.stdout)
          } catch (err) {
            S.detection = { browsers: [], defaultId: null, screen: null }
            log(`не удалось найти браузеры: ${err?.message ?? err}`)
          }
          $.ui.invalidate('ui.render')
        })
      }
      await $.command.register({ name: 'arcade', description: tr('Открыть Arcade', S.lang), immediate: true })
      // Блокнот — и инструмент Claude: читать, создавать страницы, дописывать и отмечать пункты
      await $.tool.register(NOTES_TOOL).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
      // Календарь — тоже: смотреть, записывать, переносить и удалять события
      await $.tool.register(CALENDAR_TOOL).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
      await $.command.register({
        name: 'arcade-add',
        description: tr('Arcade: добавить свою игру — файл ROM Денди или Sega', S.lang),
        argumentHint: tr('путь к файлу .nes, .md или .bin', S.lang),
        immediate: true,
      })
      // Раз в секунду: проверить порог вопроса и обновить счётчик секунд. Счётчик идёт, только пока агент работает;
      // в остальное время открытую панель перерисовываем раз в минуту — «5 мин назад» в чатах и подборках
      let quiet = 0
      $.clock.every(1000, async () => {
        const now = await $.clock.now()
        const due = () => S.status === 'working' && S.askAfter > 0 && !S.asked && !S.paneOpen && now - S.turnStartedAt >= S.askAfter * 1000
        if (due()) {
          // Строку отложили — здесь или в другой сессии этого компьютера: её нет, а показанная уходит. Отсрочка
          // кончилась посреди хода — строка появляется
          const later = await laterOn($, now)
          if (later && S.askVisible) {
            S.askVisible = false
            $.ui.invalidate('ui.render')
          } else if (!later && !S.askVisible && due()) {
            S.askStep = 'ask'
            S.askVisible = true
          }
        }
        quiet = S.paneOpen && S.status !== 'working' ? quiet + 1 : 0
        if (S.askVisible || (S.paneOpen && (quiet === 0 || quiet % 60 === 0))) $.ui.invalidate('ui.render')
      })
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    const started = await next(e)
    // Панель оставили открытой в другой сессии — открываем и здесь. Desktop и VS Code рисуют не со старта, а с session.attach
    if (e.surface && e.surface !== 'mobile') await followPane($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    return started
  })

  // Сессия закрывается: место её отметки — свободно (после /clear сессия та же, место остаётся за ней)
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') bgClear($)
    await leaveAgents($, e.reason).catch((err) => log(`отметка сессии: ${err?.message ?? err}`))
    return next(e)
  })

  // Desktop или VS Code подключился к сессии: панель, оставленную открытой в другой сессии, открываем и здесь
  on('session.attach', async ($, e, next) => {
    const attached = await next(e)
    if (e.surface === 'desktop' || e.surface === 'vscode') await followPane($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    return attached
  })

  // Уведомление о фоновой задаче (конец субагента и т. п.) будит Claude новым ходом — это не просьба человека. Только
  // смотрим: что пришло, то и уходит дальше
  on('prompt.submit', async ($, e, next) => {
    // Человек сам написал в этой сессии — он здесь: пока Claude Code впереди, уведомление о ней не всплывёт
    if (e.origin?.kind === 'composer' || e.origin?.kind === 'sdk') await lookHere($)
    if (e.origin?.kind !== 'task-notification' || e.turnId) return next(e)
    S.wake = true
    try {
      return await next(e)
    } finally {
      S.wake = false
    }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId) return next(e) // ход субагента — не ход агента: Claude как работал, так и работает
    try {
      const wake = S.wake || wakeText(e.text)
      // Claude ждал агентов в фоне и проснулся от уведомления — та же работа: время и «сыграть?» — с её начала
      const going = bgResume() && wake
      S.agentTurn = e.turnId
      S.toolsRunning = 0
      S.interrupting = false
      S.status = 'working'
      if (!going) {
        S.turnStartedAt = await $.clock.now()
        S.asked = false
      }
      S.askVisible = false
      S.agentAlert = null
      S.paused = false
      asksReset()
      queueTurnStart($, e, wake)
      log('агент начал ход')
      if (DEBUG) await $.ui.toast('arcade: агент начал ход')
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return next(e)
  })

  // Запрос разрешения — классическим хуком (Pro и Max) и по вердикту движка на вызов Claude (везде: на Team и Enterprise
  // классические хуки плагинов выключены; вердикт спрашиваем в tool.call ниже). Что дальше — в app/asks. Решение не
  // трогаем: хук отдаёт своё событие дальше как есть, а «ждёт разрешения» ставит по копии полей. Имена параметров —
  // только этого хука: каталог читает файл без областей видимости
  on('classic.PermissionRequest', async ($, askEvent, passOn) => {
    permissionShown($, askEvent.tool_name, askEvent.tool_input, askEvent.permission_mode)
    return passOn(askEvent)
  })

  on('classic.PostToolUse', async ($, e, next) => {
    try {
      classicDone($, e)
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return next(e)
  })

  // Телеметрия — только смотрим: решение о вызове (tool_decision) закрывает запрос разрешения
  on('telemetry.log', { to: 'collector' }, async ($, e, next) => {
    try {
      toolDecided($, e)
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return next(e)
  })

  // Вопрос Claude (AskUserQuestion): человеку — как обычно, а ответить можно и из «Агентов» другой сессии
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => (next.origin?.plugin === PLUGIN_NAME ? next(e) : questionCall($, e, next)))

  on('turn.complete', async ($, e, next) => {
    // Субагент закончил — агент ещё нет: «агент закончил» не про него. Но если главный ход уже кончился и ждал фона —
    // пора пересчитать, кто там остался
    if (e.agentId) {
      if (S.bg?.end) $.clock.after(0, () => bgCheck($))
      return next(e)
    }
    const turnId = S.agentTurn
    S.agentTurn = null
    S.toolsRunning = 0
    asksReset()
    // Ход оборвал Arcade, чтобы открыть игру: агент сейчас же продолжит по просьбе Arcade
    if (S.interrupting) {
      S.interrupting = false
      return next(e)
    }
    // Ход с просьбой Arcade кончился: открыл Claude игру или нет, следующее нажатие просит заново
    S.asking = null
    try {
      // Игра ждала конца инструмента, а ход кончился сам — прерывать нечего, просим как обычно
      if (S.pendingOpen) {
        const url = S.pendingOpen
        S.pendingOpen = null
        desktopNotice($, await askClaude($, url, true), '', url)
      }
      S.askVisible = false
      $.clock.after(0, () => usagePoll($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`)))
      $.clock.after(0, () => changesPoll($).catch((err) => log(`что поменялось: ${err?.message ?? err}`)))
      // Агенты, запущенные в фоне, ещё работают — Claude не закончил: «закончил» скажем, когда фон опустеет (app/background)
      const n = await bgCount($)
      if (n > 0) await bgHold($, turnId, e, n)
      else await turnDone($, turnId, e)
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return next(e)
  })

  // Сжатие контекста: пока Claude пишет сводку, прерывать ход бесполезно — он не обрывается, а просьбы Arcade копятся
  // в очереди. Игру, нажатую в это время, открываем, когда сжатие кончится. Сжатие у субагента и сводка заранее
  // (precompute: ничего не ставит, ход идёт дальше) — не то
  on('session.compact', async ($, e, next) => {
    if (e.agentId !== undefined || e.trigger === 'precompute') return next(e)
    S.compacting = true
    try {
      return await next(e)
    } finally {
      S.compacting = false
      if (S.pendingOpen) $.clock.after(0, () => openPending($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`)))
    }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      S.paneOpen = false
      S.agentAlert = null
      S.paused = false // закрытая панель и так стоит на паузе
      releaseAll() // Денди стоит на паузе, пока панель закрыта
      await paneClosedBy($, e.origin).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    }
    return next(e)
  })

  // Нажатие в Arcade — кнопка или Enter в поле: встроенный браузер открываем в теле хука, когда обработчик отработал, —
  // так вызов идёт через обычную проверку разрешений, как и раньше (handlePress, app/desktop)
  on('ui.press', async ($, e, next) => (e.plugin === PLUGIN_NAME ? handlePress($, e, next) : next(e)))
  on('ui.input', async ($, e, next) => (e.plugin === PLUGIN_NAME && e.kind === 'submit' ? handlePress($, e, next) : next(e)))

  // Инструменты блокнота и календаря разрешает, как любые другие, сам Claude Code — правилом в настройках или вопросом
  // человеку; своих решений о разрешениях у Arcade нет.
  // Вызов инструмента блокнота: поверх свежего блокнота из хранилища (его могли поправить в другой сессии), несохранённый
  // текст поля «Текст» сначала уходит в страницу — правка Claude ложится поверх. Ошибку (нет страницы, не помещается)
  // модель получает ошибкой — отказом с текстом
  // Имя — готовой строкой, как NOTES_TOOL_NAME: каталог читает подписку как есть
  on('tool.call', { tool: 'mcp__arcade__notes' }, async ($, e) => {
    const out = await notesTool($, e)
    return out.isError ? { deny: out.text } : { result: out.text }
  })

  // Вызов инструмента календаря
  // Имя — готовой строкой, как CALENDAR_TOOL_NAME
  on('tool.call', { tool: 'mcp__arcade__calendar' }, async ($, e) => {
    const out = await calendarTool($, e)
    return out.isError ? { deny: out.text } : { result: out.text }
  })

  // Инструменты агента (главного цикла; свои вызовы Arcade — нет): игру, которую надо открыть, пока агент работает,
  // открываем, когда закончится текущий — оборванный посреди инструмент может оставить работу недоделанной. Дольше
  // CUT_TOOL_MS не ждём: обрываем (cutPending). Вызов Claude (и субагента) — смотрим, не спросят ли человека (callSeen,
  // не ждём). Вызов кончился — его запрос разрешения закрыт, а когда не идёт ни одного — и классический
  on('tool.call', async ($, e, next) => {
    if (next.origin?.plugin === PLUGIN_NAME) return next(e)
    if (next.origin?.plugin === 'engine') callSeen($, e)
    if (e.agentId !== undefined) {
      try {
        return await next(e)
      } finally {
        settle($, e.tool_use_id)
      }
    }
    S.toolsRunning++
    try {
      return await next(e)
    } finally {
      S.toolsRunning = Math.max(0, S.toolsRunning - 1)
      settle($, e.tool_use_id)
      if (S.toolsRunning === 0) callsOver($)
      // Ход прерываем после того, как результат инструмента дойдёт до агента
      if (S.pendingOpen && S.toolsRunning === 0)
        $.clock.after(0, () => openPending($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`)))
    }
  })

  // Игру, которую Arcade попросил открыть Claude, открыли — браузеру нужно место. Имена инструментов — готовыми строками
  // (BROWSER + имя): каталог читает подписку как есть, а подстановку в шаблонной строке принимает за обращение к API
  on('tool.call', { tool: ['mcp__Claude_Browser__preview_start', 'mcp__Claude_Browser__navigate'] }, async ($, e, next) => {
    const result = await next(e)
    try {
      if (S.opening && arcadeUrl(e.url) && !result?.deny && !result?.isError)
        await openedForArcade($, e)
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return result
  })

  // Сообщения от экрана игры (hooks/input.js): нажатия и зажатые клавиши
  on('ui.message', async ($, e) => {
    if (e.element !== INPUT) return {}
    const { save, redraw } = readInput(e.data)
    if (redraw) $.ui.invalidate('ui.render')
    if (save) await saveSetting($, 'keys', S.keymap)
    if (S.flappyDirty) {
      S.flappyDirty = false
      await saveSetting($, 'flappyBest', S.flappyBest)
    }
    return {}
  })

  on('command.run', { command: 'arcade' }, async ($) => {
    await openPane($)
    $.ui.invalidate('ui.render')
    return {}
  })

  // /arcade-add путь: копия файла — в папку данных, запись — в «Мои игры». Файл никуда не отправляется.
  on('command.run', { command: 'arcade-add' }, async ($, e) => {
    const message = await addMine($, e.args)
    S.libraryNotice = message
    if (S.view !== 'library') toLibrary()
    S.menu = 'mine'
    await openPane($)
    $.ui.invalidate('ui.render')
    return {}
  })

  // Полоса над полем ввода: «1» — играть, «2» — не сейчас (цифра в пустом поле ввода и пауза).
  // Пока вопрос виден, полоса занята целиком: то, что рисуют там другие моды, скрыто.
  // Вопрос самого Claude Code (опрос, «включить моды?») важнее: пока он в полосе, «сыграть?» ждёт.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) =>
    translateTree(
      await (async () => {
    // VS Code: пока в панели идёт игра, клавиатура — в поле над строкой ввода. Саму панель VS Code
    // не делает фокусом, а поле в колонке чата получает клавиши. Что рисуют в полосе другие моды, остаётся ниже.
    if (!S.askVisible && e.surface === 'vscode' && S.paneOpen && nesView()) {
      const { Box, Input } = $.ui.resolve(e)
      S.bandId = e.requestId
      if (S.bandResetWanted) {
        // Значение меняется — VS Code перезаписывает поле, и набранное исчезает
        S.bandResetWanted = false
        S.bandToken = S.bandToken === '' ? '\u200b' : ''
        S.bandLength = S.bandToken.length
      }
      if (S.bandFocusWanted) {
        S.bandFocusWanted = false
        // Если полоса уже держит клавиатуру, ставим фокус в поле; если нет — VS Code откажет, и хватит одного клика
        $.clock.after(50, async () => {
          try {
            await $.ui.focus({ requestId: S.bandId, key: 'arcade-keys-band' })
          } catch {
            // отказ — обычное дело: клавиатуру отдаёт человек
          }
        })
      }
      const ours = Box({
        flexDirection: 'row',
        children: [
          Input({
            key: 'arcade-keys-band',
            label: '🎮',
            placeholder: 'кликни — и игра слушает клавиатуру: W A S D, K J, Enter',
            value: S.bandToken,
            autoFocus: true,
            onInput: async (value) => {
              const save = typedFrom(value)
              $.ui.invalidate('ui.render')
              if (save) await saveSetting($, 'keys', S.keymap)
              if (S.flappyDirty) {
                S.flappyDirty = false
                await saveSetting($, 'flappyBest', S.flappyBest)
              }
            },
            onSubmit: () => {
              pressStart()
              $.ui.invalidate('ui.render')
            },
          }),
        ],
      })
      const below = await next(e)
      return below ? Box({ flexDirection: 'column', children: [ours, below] }) : ours
    }
    // Строку выключили в настройках — здесь или на другом компьютере — она уходит сразу, не дожидаясь хода
    if (!S.askVisible || !S.askAfter || e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    // После «Не сейчас» — на сколько отложить: на 5 или 10 минут, до перезапуска Claude (во всех сессиях этого
    // компьютера) или только в этом ходе, как было раньше
    if (S.askStep === 'later') {
      const choice = (key, label, hotkey, kind) =>
        Button({
          key,
          label,
          hotkey,
          plain: true,
          onPress: async () => {
            S.asked = true
            S.askVisible = false
            $.ui.invalidate('ui.render')
            if (kind) await laterSet($, kind).catch((err) => log(`отсрочка «сыграть?»: ${err?.message ?? err}`))
          },
        })
      return Box({
        flexDirection: 'row',
        columnGap: 2,
        children: [
          Text({ children: ['Не спрашивать:'] }),
          choice('arcade-later-5', '5 мин', '1', 5),
          choice('arcade-later-10', '10 мин', '2', 10),
          choice('arcade-later-restart', 'До перезапуска Claude', '3', 'restart'),
          choice('arcade-later-now', 'Только сейчас', '4', null),
        ],
      })
    }
    const now = await $.clock.now()
    const canWindow = (S.platform !== null || e.surface === 'desktop') && webGame(S.lastGame)
    return Box({
      flexDirection: 'row',
      columnGap: 2,
      children: [
        Text({ children: [`Агент работает ${workedText(workedSeconds(now))} — сыграть?${S.netWaiting.length ? ` В сети ждут: ${waitingText()}` : ''}`] }),
        // «Здесь» — панель Claude Code: в VS Code и Desktop картинкой, в терминале символами или пикселями.
        // «В окне» — браузер: в Desktop по настройке встроенный, иначе — программа браузера, когда ОС уже определена.
        Button({
          key: 'arcade-play',
          label: canWindow ? 'Здесь' : 'Играть',
          hotkey: '1',
          plain: true,
          onPress: async () => {
            await openPane($)
            $.ui.invalidate('ui.render')
          },
        }),
        ...(canWindow
          ? [
              Button({
                key: 'arcade-play-window',
                label: 'В окне',
                hotkey: '2',
                plain: true,
                onPress: async () => {
                  S.asked = true
                  S.askVisible = false
                  if (builtinBrowser(e.surface, mouseGame(S.lastGame)))
                    return desktopWindow($, S.lastGame, `${gameById(S.lastGame)?.title ?? S.lastGame} открыт во встроенном браузере Claude.`, true)
                  const command = windowCommand(S.lastGame)
                  try {
                    const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                    windowNotice($, launchNotice(result, S.lastGame))
                    if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
                  } catch (err) {
                    S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
                  }
                  $.ui.invalidate('ui.render')
                  await $.ui.toast(tr(S.libraryNotice, S.lang))
                },
              }),
            ]
          : []),
        Button({
          key: 'arcade-later',
          label: 'Не сейчас',
          hotkey: canWindow ? '3' : '2',
          plain: true,
          // Второй шаг — на сколько отложить; не выбрали — строка уйдёт с концом хода
          onPress: () => {
            S.askStep = 'later'
            $.ui.invalidate('ui.render')
          },
        }),
      ],
    })
      })(),
      S.lang,
    ),
  )

  // Панель: библиотека игр или сама игра. Клавиши над экраном игры ловит Client (hooks/input.js)
  // после клика по экрану, в любой раскладке.
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return translateTree(await next(e), S.lang)
    const tree = await drawPane($, e)
    // Игру открыли в панели — заводим игровой цикл; когда игру закроют, он снимется сам
    runGameLoop($)
    return translateTree(tree, S.lang)
  })
}
