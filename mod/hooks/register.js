// Arcade — пробная игровая платформа в Claude Code: вопрос «сыграть?», панель с библиотекой игр и Денди.
// Правило мода: каждый обработчик событий Claude Code только наблюдает и всегда возвращает next(e).
// Требования проверки модов: обработчик в on(...) — сама функция, а $ всегда пишется как $.ui.open(...) и т. п.
import { Controller, createNes, frameToPng, frameToQuadrants, frameToSvg, screenSize } from './nes-screen.js'
import { SITE, bundledCatalog, bundledRom, minePageUrl, pageUrl, parseCatalog, restoreCatalog, siteUrl, tabPageUrl, verifyRom } from './catalog.js'
import { DETECT_ARGV, launchCommand, notifyCommand, openUrlCommand, parseDetection, windowBounds } from './browsers.js'
import { LANGS, LANG_NAMES, detectLang, isKept, keep, tr, translateTree } from './i18n.js'
import { bundledChannels, candidates, channelsFor, clean, choose, contextFrom, feedUrl, parseChannels, parseFeed, parsePicks, parseTopics, picksPrompt, topicsPrompt, videoBlurb, videoMeta, videoStats, watchUrl, PICKS } from './youtube.js'
import { bundledFeeds, itemStats, listenUrl, parseFeeds, parseItems, readUrl, readsPrompt } from './rss.js'
import { SEARCH_SHOWS, feedLanguage, freshFound, mix, ownTopic, ownTopicPrompt, parseOwnTopic, parseSearch, plainTopic, rememberTopic, restoreMyTopics, searchUrl, showFeed } from './search.js'
import { MY_CHANNELS, TOPIC_TITLES, liveFirst, liveStatus, liveUrl, parseTwitch, rememberChannel, restoreTwitch, twitchLogin, twitchUrl } from './twitch.js'
import { CONSOLE_NAMES, MINE_MAX_BYTES, cleanPath, identifyRom, mineId, restoreMine, sha256Hex, titleFromPath } from './mine.js'
import { HANDLE, SYNC_KEYS, accountUrl, normalHandle, parseDone, parseFriends, parseHandle, parseMe, parsePoll, parseSettings, parseStart, restoreAccount, restoreStamps, suggestHandle, syncPlan } from './account.js'
import { MAX_NAME, MAX_TEXT, cleanText, describe, fill, oneLine, parseChat, parseChats, parseLink, parseMessages, parseSent, parseUnread, when } from './chats.js'
import { LOGO_SVG } from './logo.js'
import { createFlappy } from './flappy.js'

const PANE = 'arcade'
const INPUT = 'arcade-input' // ключ элемента Client, который ловит клавиши над экраном игры (hooks/input.js)
const ASK_AFTER_MS = 10_000 // через сколько работы агента показать вопрос «сыграть?»; для быстрой проверки поставь 5_000
const NOTIFY_AFTER_MS = 20_000 // «агент закончил» системным уведомлением — только если ход шёл дольше этого
const DEBUG = false // тост в начале каждого хода: видно, что мод загрузился

const PANE_COLUMNS = 104 // сколько колонок просить у Claude Code для панели сбоку от транскрипта
const PANE_ROWS = 40 // сколько строк просить, когда панель стоит над полем ввода
const UI_ROWS = 4 // строки панели вокруг экрана Денди: заголовок, подсказка, кнопки
const TICK_MS = 33 // шаг игрового цикла: 2 кадра Денди за шаг ≈ 60 кадров в секунду, на экран — 30 раз в секунду
const PIXEL_DENIES = 15 // столько отказов подряд (≈0,5 с) — и в режиме «авто» мод решает, что терминал не показывает картинки
const MAX_SYMBOL_COLUMNS = 128 // символами больше 128 колонок деталей не прибавит: квадранты уже дают 256 точек в ширину
const MAX_IMAGE_COLUMNS = 255 // предел Image; картинка масштабируется под размер

// Графика экрана Денди: настоящие пиксели (Image) там, где терминал умеет картинки, иначе символы-квадранты
const GRAPHICS = ['auto', 'pixels', 'symbols']
const GRAPHICS_LABEL = { auto: 'авто', pixels: 'пиксели', symbols: 'символы' }

// Поле для проверки ввода: «@» ходит клавишами движения
const COLS = 24
const ROWS = 8
const DEFAULT_COLOR = 0x01000000
const FLOOR_COLOR = 0x555555
const PLAYER_COLOR = 0x2e7d32

const NOTIFY_WINDOW_MS = 30 * 60_000 // уведомлять, если окно игры открывали за последние полчаса
const LAUNCH_TIMEOUT_MS = 20_000 // сколько ждать PowerShell, который ищет браузеры или открывает окно
const CUT_TOOL_MS = 10_000 // сколько ждать конца инструмента агента, прежде чем оборвать его ради игры (Desktop)

const ROM_CACHE_LIMIT = 8 // сколько скачанных игр держать в хранилище мода (у него предел 4 МиБ на всё)
const REMOTE_MAX_WIDTH = 768 // в Desktop и VS Code экран Денди не шире ×3
const WIDE_COLUMNS = 400 // «во всю ширину»: просим столько колонок — Claude Code даст, сколько позволит раскладка
const REMOTE_MAX_WIDTH_WIDE = 1536 // во всю ширину экран Денди до ×6 — если хватает и ширины, и высоты
const HOLD_TICKS_FIRST = 8 // поле ввода VS Code: кнопка держится ≈260 мс после нажатия…
const HOLD_TICKS_REPEAT = 4 // …и ≈130 мс после каждого повтора, пока идёт автоповтор

// Меню: главное — приставки; приставка — её игры; настройки — где открывать, графика, проверка клавиш.
// Приставки и игры приходят из каталога сайта; проверка клавиш — своя, только для панели.
const FIELD = { id: 'field', console: null, title: 'Проверка клавиш', note: 'поле: видно, что нажато и что мод считает зажатым' }

// Действия и клавиши по умолчанию для частых раскладок: EN (QWERTY, QWERTZ), FR (AZERTY), RU, BY, UA, и стрелки.
// Одна физическая клавиша в разных раскладках даёт разные буквы — все они ведут к одному действию.
const ACTIONS = [
  { id: 'up', label: 'вверх', dx: 0, dy: -1, nes: 'UP' },
  { id: 'left', label: 'влево', dx: -1, dy: 0, nes: 'LEFT' },
  { id: 'down', label: 'вниз', dx: 0, dy: 1, nes: 'DOWN' },
  { id: 'right', label: 'вправо', dx: 1, dy: 0, nes: 'RIGHT' },
  { id: 'a', label: 'A', nes: 'A' },
  { id: 'b', label: 'B', nes: 'B' },
  { id: 'start', label: 'Start', nes: 'START' },
  { id: 'select', label: 'Select', nes: 'SELECT' },
]
const DEFAULT_KEYS = {
  up: ['w', 'ц', 'z', 'up'],
  left: ['a', 'ф', 'q', 'left'],
  down: ['s', 'ы', 'і', 'down'],
  right: ['d', 'в', 'right'],
  a: ['k', 'л'],
  b: ['j', 'о'],
  start: ['n', 'т'],
  select: ['m', 'ь'],
}
const ARROWS = ['up', 'down', 'left', 'right']
// Японский, китайский и корейский: такие символы значат, что включён метод ввода, а не другая раскладка
const IME_CHARS = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/

// Состояние живёт в модуле и сбрасывается при перезагрузке кода; клавиши и последняя игра хранятся в $.store
let status = 'idle' // idle | working | permission | done
let turnStartedAt = 0
let windowOpenedAt = 0 // когда в последний раз открылось окно игры в браузере: оттуда Claude Code не видно
let mine = [] // свои игры: { id, console, title, sha256 }; сами файлы — копии в папке данных
let dataDir = null // ~/.claude/arcade/roms — переживает обновления плагина; null, пока не узнали домашнюю папку
let sep = '/'
let osNotify = true // системные уведомления «агент закончил» и «ждёт разрешения», пока играешь в окне
let asked = false // в этом ходе на вопрос уже ответили
let askVisible = false
let paneOpen = false
let netWaiting = [] // кто ждёт в сети: [{ id, title, count }] — из /api/lobbies сайта, раз в минуту
let lang = 'ru' // язык интерфейса: ru или en — настройка, иначе по окружению
let wide = false // панель игры во всю ширину: разговор с агентом сжимается в узкую полосу
const unfolded = new Set() // плитки Desktop, где по «ещё» показано описание целиком: ключи карточек
let agentAlert = null // пока открыта игра: 'done' — агент закончил, 'permission' — ждёт разрешения; плашка поверх игры
// Что делать с игрой в панели, когда агент закончил или ждёт разрешения — отдельно для каждого сигнала
const SIGNAL_MODES = ['notify', 'pause', 'close']
const SIGNAL_LABELS = { notify: 'плашка, игра идёт', pause: 'пауза и плашка', close: 'сразу к агенту' }
let onDone = 'notify'
let onPermission = 'pause' // агент стоит и ждёт человека — это срочнее
let paused = false // игра на паузе из-за сигнала агента: снимается «Играть дальше» или любой клавишей игры
let view = 'library' // library или id игры (field — проверка клавиш)
let menu = 'main' // что открыто в библиотеке: main, id приставки или settings
let langReturn = 'main' // куда вернуться из выбора языка: главное меню или настройки
let menuFrom = null // откуда вернулись в главное меню — туда ставим фокус
let lastGame = 'thwaite'
let played = false // во что-то уже играли (или читали, слушали) — тогда первой плиткой главного меню идёт «Продолжить»
let player = { x: 2, y: 3 }
let pressed = []
let events = []
let keymap = restoreKeymap(undefined)
let mode = 'play' // play | assign
let assignStep = 0
let notice = ''
let lastCounts = {} // сколько раз каждая клавиша была нажата по прошлому сообщению экрана игры
let heldKeys = [] // клавиши, которые экран игры сейчас считает зажатыми
let nes = null // эмулятор Денди, создаётся при запуске игры в панели
let nesGame = null // какая игра загружена в эмулятор
let frame = null // последний кадр Денди
let down = new Set() // кнопки Денди, зажатые в эмуляторе
let taps = new Set() // кнопки Денди, нажатые заново с прошлого шага
let screen = null // размер экрана Денди при последней отрисовке панели в терминале
let graphics = 'auto' // выбор человека, хранится в $.store
let pixelsFailed = false // в этой сессии терминал отказался показывать картинки
let denies = 0 // отказов показать кадр подряд
let profileRoot = '' // папка для отдельного профиля браузера с игрой: %LOCALAPPDATA%\claude-arcade
let detection = null // что нашёл поиск браузеров: { browsers, defaultId, screen }; null — ещё ищем
let opener = null // где открывать игры: 'window' или 'pane'; null — по умолчанию (на Windows — окно)
let browserChoice = 'default' // каким браузером: 'default' или id найденного
let desktopOpener = 'builtin' // в Desktop: 'builtin' — встроенный браузер приложения, 'window' — окно браузера, как в терминале
let libraryNotice = '' // что случилось при последнем запуске окна
let opening = false // игру во встроенном браузере Desktop по просьбе Arcade открывает Claude
let agentTurn = null // ход агента (главного цикла), который идёт сейчас: его id для $.turn.abort
let toolsRunning = 0 // сколько инструментов агента работает сейчас
let pendingOpen = null // адрес игры, которую откроем, когда закончится текущий инструмент агента или сжатие контекста
let interrupting = false // ход оборвал Arcade: его конец — не «агент закончил»
let asking = null // адрес, который Arcade попросил Claude открыть, а тот ещё не открыл: второй раз не прерываем
let compacting = false // Claude сжимает контекст: прерывать ход бесполезно — ждём конца сжатия
let catalog = bundledCatalog() // каталог: с сайта, из сохранённой копии или запас из самого мода
let platform = null // windows | mac | linux; null — пока не знаем, окно браузера не предлагаем
let remoteSurface = null // панель с игрой нарисована в Desktop или VS Code — кадры идут перерисовкой, а не blit
let holdTicks = {} // поле ввода VS Code: кнопка Денди → сколько шагов ещё держать
let bandLength = 0 // VS Code: длина текста в строке 🎮 — новые буквы считаются нажатиями, стирание нет
let bandToken = '' // VS Code: «пустое» значение строки 🎮; чередуется '' и невидимый символ, чтобы VS Code заметил сброс
let bandResetWanted = false // VS Code: после нажатия стереть набранное при следующей отрисовке
let bandId = null // VS Code: requestId полосы над вводом — чтобы попробовать поставить фокус в поле при старте игры
let bandFocusWanted = false // VS Code: игра только что открылась — попробовать один раз
// YouTube: темы (null — ещё не подобраны), подборка открытой темы, что сейчас грузится ('topics' | 'videos' | ''),
// заметка к подборке; request — номер последней загрузки: ответ старой загрузки, пришедший позже новой, не нужен
let yt = { topics: null, topicsAt: 0, topicsLang: '', topic: -1, videos: [], seen: new Set(), loading: '', note: '', request: 0 }
const feedCache = new Map() // id канала → { at, entries }: ленты перечитываем не чаще FEED_TTL_MS
// Статьи и подкасты: темы — общие с YouTube (yt.topics), у каждого раздела своя подборка открытой темы
const emptyReads = (request = 0) => ({ topic: -1, items: [], seen: new Set(), loading: false, note: '', request })
let reads = { articles: emptyReads(), podcasts: emptyReads() }
const rssCache = new Map() // «articles:id ленты» → { at, items }: ленты перечитываем не чаще FEED_TTL_MS
// Свои темы человека: последние, из $.store. Заметка под полем «Своя тема» — у раздела, где тему ввели; номер последнего
// разбора — ответ модели на старый ввод не нужен
let myTopics = []
let ownNote = { kind: '', text: '' }
let ownRequest = 0
const searchCache = new Map() // «youtube:запрос» → { at, found }: поиск сайта по своей теме — не чаще SEARCH_TTL_MS
// Twitch: свои каналы (из $.store), что сайт знает о каналах (логин → { name, avatar, live }), каких каналов нет на
// Twitch, каталог Arcade; at — когда спрашивали сайт, error — что ответил сайт, note — заметка под полем «Добавить
// канал»; request — номер последнего вопроса: ответ старого вопроса, пришедший позже нового, не нужен
let tw = { channels: [], info: {}, missing: new Set(), catalog: [], at: 0, loading: false, error: '', note: '', request: 0 }
// Аккаунт: вход через GitHub (session — { token, user } из $.store или null), вход по коду, который идёт сейчас (flow —
// { device, code, url, interval, until } или null), starting — просим код у сайта, заметка в меню аккаунта, идёт ли
// синхронизация (again — за время неё настройку поменяли ещё раз) и когда она последний раз удалась; confirmDelete —
// «Удалить аккаунт» нажали один раз; request — номер последнего входа: ответ старого входа не нужен. handle — @ник,
// ticket — его подпись для сетевых игр (оба с сайта, только в памяти), naming — сайт проверяет новый ник, handleNote —
// почему ник не взялся, claims — сколько раз ник сменили: ответ синхронизации, спрошенной до смены, ник не трогает;
// friends и requests — сколько друзей и заявок человеку (для плитки «Друзья»), unread — непрочитанных в чатах
let acct = { session: null, flow: null, starting: false, note: '', syncing: false, again: false, syncedAt: 0, confirmDelete: false, request: 0, handle: '', ticket: '', naming: false, handleNote: '', claims: 0, friends: 0, requests: 0, unread: 0 }
// Друзья: list — { friends, incoming, outgoing } с сайта или null, пока не спрашивали; loading — спрашиваем список,
// busy — какое действие ждёт ответа сайта, note — заметка под полем «Добавить друга» (bad — что-то не вышло);
// request — номер последнего вопроса: ответ старого вопроса не нужен
const NO_FRIENDS = { list: null, loading: false, busy: '', note: '', bad: false }
let fr = { ...NO_FRIENDS, request: 0 }
// Чаты: list — чаты с сайта (новые сверху) или null, пока не спрашивали; names — ники по номерам аккаунтов; me — свой
// номер; loading — спрашиваем список. Открытый чат: talk — его id, about — он сам с сайта (участники, хозяин группы),
// messages — переписка по порядку номеров, first — с какого номера она видна человеку, shown — сколько последних
// сообщений показать, opening — загружаем открытый чат, older — грузим более ранние, polling — спрашиваем новые.
// busy — какое действие ждёт ответа сайта,
// note — заметка (bad — что-то не вышло), picked — кого отметили для новой группы, groupName — что вписано в название,
// field — номер поля «Сообщение» (после отправки — новое, пустое), confirmLeave — «Выйти из группы» нажали один раз.
// request — номер последнего вопроса: ответ старого не нужен
const CHAT_SHOWN = 30 // сколько последних сообщений чата показывать сразу; «Раньше» — ещё столько же
const NO_CHATS = { list: null, names: {}, me: '', loading: false, talk: '', about: null, messages: [], first: 0, shown: CHAT_SHOWN, opening: false, older: false, polling: false, busy: '', note: '', bad: false, groupName: '', field: 0, confirmLeave: false }
let ch = { ...NO_CHATS, picked: new Set(), request: 0 }
let chatLink = '' // код ссылки на страницу чатов: его страница один раз обменяет на свой билет
let stamps = {} // когда человек менял синхронизируемые настройки: ключ → время; в $.store — syncAt
// Какие из SYNC_KEYS сохранены на этом компьютере: чего человек здесь не менял, то берём с сайта, а не отправляем туда
const savedKeys = new Set()
let syncTimer = null

function consoles() {
  return catalog.consoles
}

// Группы вкладок и полки: «Игры» — шутеры, гонки, стратегии, настольные
// «Поддержать проект»: ссылка из каталога сайта, пока каталога нет — запасная
const SUPPORT_URL = 'https://ko-fi.com/agentarcade'
function supportUrl() {
  return catalog.support?.url ?? SUPPORT_URL
}

// Пункты главного меню в порядке каталога: группа стоит там, где её первая приставка
function menuTabs() {
  const tabs = []
  for (const c of consoles()) {
    const g = c.group && groupsList().find((x) => x.id === c.group)
    if (!g) tabs.push(c)
    else if (!tabs.includes(g)) tabs.push(g)
  }
  return tabs
}

// --- Desktop: иконки плиток и обложки игр (картинки Svg) ---------------------------------------------------------
const ICON_COLORS = { nes: '#e5484d', sega: '#3e63dd', sms: '#30a46c', psx: '#8e4ec6', games: '#f76b15', reading: '#12a594', books: '#12a594', listening: '#d6409f', audiobooks: '#d6409f', mine: '#ffb224', settings: '#8b8d98', account: '#46a758', friends: '#e93d82', chats: '#0090ff', lang: '#0090ff', support: '#ff8b3e', library: '#6e56cf', youtube: '#ff0033', articles: '#29a383', podcasts: '#ab4aba', twitch: '#9146ff', arcade: '#f76b15', shooters: '#e5484d', racing: '#30a46c', strategy: '#3e63dd', quests: '#ffb224', board: '#12a594' }
function iconSvg(kind) {
  // Полки книг и аудиокниг (books-en, audio-mine) — иконкой своей группы
  kind = /^books-/.test(kind) ? 'books' : /^audio-/.test(kind) ? 'audiobooks' : kind
  const c = ICON_COLORS[kind] ?? '#6e56cf'
  const shapes = {
    pad: `<rect x="6" y="15" width="36" height="18" rx="9" fill="${c}"/><rect x="12" y="21" width="9" height="3" fill="#fff"/><rect x="15" y="18" width="3" height="9" fill="#fff"/><circle cx="32" cy="22" r="2.4" fill="#fff"/><circle cx="37" cy="26" r="2.4" fill="#fff"/>`,
    disc: `<circle cx="24" cy="24" r="17" fill="${c}"/><circle cx="24" cy="24" r="5" fill="#111"/><path d="M24 9a15 15 0 0 1 13 7.5" stroke="#fff" stroke-width="2.5" fill="none" opacity=".7"/>`,
    stick: `<rect x="10" y="30" width="28" height="9" rx="3" fill="${c}"/><rect x="22" y="14" width="4" height="17" fill="#ddd"/><circle cx="24" cy="13" r="6" fill="${c}"/><circle cx="33" cy="34" r="2" fill="#fff"/>`,
    book: `<path d="M8 12h14a4 4 0 0 1 4 4v22a3 3 0 0 0-3-3H8z" fill="${c}"/><path d="M40 12H26a4 4 0 0 0-4 4v22a3 3 0 0 1 3-3h15z" fill="${c}" opacity=".75"/>`,
    phones: `<path d="M10 28a14 14 0 0 1 28 0" stroke="${c}" stroke-width="4" fill="none"/><rect x="7" y="26" width="8" height="13" rx="3" fill="${c}"/><rect x="33" y="26" width="8" height="13" rx="3" fill="${c}"/>`,
    folder: `<path d="M7 14h12l4 4h18v19H7z" fill="${c}"/>`,
    gear: `<circle cx="24" cy="24" r="11" fill="none" stroke="${c}" stroke-width="7" stroke-dasharray="5 3.6"/><circle cx="24" cy="24" r="5" fill="${c}"/>`,
    person: `<circle cx="24" cy="17" r="8" fill="${c}"/><path d="M9 40a15 13 0 0 1 30 0z" fill="${c}"/>`,
    // Друзья: двое, второй — позади
    people: `<circle cx="31" cy="16" r="6" fill="${c}" opacity=".6"/><path d="M21 36a10 10 0 0 1 20 0z" fill="${c}" opacity=".6"/><circle cx="19" cy="19" r="7" fill="${c}"/><path d="M7 41a12 12 0 0 1 24 0z" fill="${c}"/>`,
    // Чаты: облачко с тремя точками
    bubble: `<path d="M9 12h30a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H22l-8 7v-7H9a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill="${c}"/><circle cx="16" cy="23.5" r="2.5" fill="#fff"/><circle cx="24" cy="23.5" r="2.5" fill="#fff"/><circle cx="32" cy="23.5" r="2.5" fill="#fff"/>`,
    globe: `<circle cx="24" cy="24" r="15" fill="none" stroke="${c}" stroke-width="3"/><ellipse cx="24" cy="24" rx="6" ry="15" fill="none" stroke="${c}" stroke-width="2.5"/><path d="M9 24h30" stroke="${c}" stroke-width="2.5"/>`,
    cup: `<path d="M10 18h22v10a9 9 0 0 1-9 9h-4a9 9 0 0 1-9-9z" fill="${c}"/><path d="M32 21h4a4 4 0 0 1 0 8h-4" stroke="${c}" stroke-width="3" fill="none"/><path d="M16 9c0 3 3 3 3 6M23 9c0 3 3 3 3 6" stroke="#ddd" stroke-width="2" fill="none"/>`,
    window: `<rect x="7" y="10" width="34" height="28" rx="4" fill="none" stroke="${c}" stroke-width="3"/><rect x="7" y="10" width="34" height="7" rx="3" fill="${c}"/><path d="M20 25l8 4-8 4z" fill="${c}"/>`,
    play: `<rect x="6" y="12" width="36" height="24" rx="8" fill="${c}"/><path d="M20 18v12l10-6z" fill="#fff"/>`,
    doc: `<path d="M13 7h15l9 9v25H13z" fill="${c}"/><path d="M28 7v9h9" fill="#fff" opacity=".35"/><path d="M18 23h14M18 28h14M18 33h10" stroke="#fff" stroke-width="2.5"/>`,
    mic: `<rect x="18" y="7" width="12" height="21" rx="6" fill="${c}"/><path d="M12 22a12 12 0 0 0 24 0" stroke="${c}" stroke-width="3" fill="none"/><path d="M24 34v7M17 41h14" stroke="${c}" stroke-width="3"/>`,
    // Трансляции: экран с антенной и точкой эфира
    tv: `<rect x="7" y="14" width="34" height="23" rx="5" fill="${c}"/><path d="M18 6l6 8 6-8" stroke="${c}" stroke-width="3" fill="none"/><circle cx="16" cy="25.5" r="3.5" fill="#fff"/><path d="M24 23h11M24 28h8" stroke="#fff" stroke-width="2.5"/>`,
    // Жанры игр: прицел, клетчатый флаг, ладья, компас, кубик
    target: `<circle cx="24" cy="24" r="13" fill="none" stroke="${c}" stroke-width="4"/><circle cx="24" cy="24" r="4" fill="${c}"/><path d="M24 5v10M24 33v10M5 24h10M33 24h10" stroke="${c}" stroke-width="3"/>`,
    flag: `<rect x="10" y="8" width="3" height="33" rx="1.5" fill="#ddd"/><rect x="13" y="9" width="26" height="18" fill="${c}"/><path d="M13 9h6.5v6H13zM26 9h6.5v6H26zM19.5 15H26v6h-6.5zM32.5 15H39v6h-6.5zM13 21h6.5v6H13zM26 21h6.5v6H26z" fill="#fff"/>`,
    rook: `<path d="M13 9h5v4h4V9h4v4h4V9h5v9l-4 4v12h4v5H13v-5h4V22l-4-4z" fill="${c}"/>`,
    compass: `<circle cx="24" cy="24" r="15" fill="none" stroke="${c}" stroke-width="3"/><path d="M24 11l5 13-5 13-5-13z" fill="${c}"/><circle cx="24" cy="24" r="2.5" fill="#fff"/>`,
    dice: `<rect x="10" y="10" width="28" height="28" rx="6" fill="${c}"/><circle cx="18" cy="18" r="3" fill="#fff"/><circle cx="24" cy="24" r="3" fill="#fff"/><circle cx="30" cy="30" r="3" fill="#fff"/>`,
  }
  const shape = { nes: 'pad', sega: 'pad', sms: 'pad', psx: 'disc', games: 'stick', reading: 'book', books: 'book', listening: 'phones', audiobooks: 'phones', mine: 'folder', settings: 'gear', account: 'person', friends: 'people', chats: 'bubble', lang: 'globe', support: 'cup', library: 'window', youtube: 'play', articles: 'doc', podcasts: 'mic', twitch: 'tv', arcade: 'stick', shooters: 'target', racing: 'flag', strategy: 'rook', quests: 'compass', board: 'dice' }[kind] ?? 'stick'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#ffffff10"/>${shapes[shape]}</svg>`
}
// Флажки плиток «Arcade · язык»: флаг 36×24, упрощённый до читаемого в 36 точках. Английский — флаг Великобритании,
// португальский — Бразилии: перевод бразильский («você», «arquivo»)
const star = (cx, cy, r, turn = 0) =>
  Array.from({ length: 10 }, (_, k) => {
    const a = ((turn - 90 + k * 36) * Math.PI) / 180
    const d = k % 2 ? r * 0.382 : r
    return `${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`
  }).join(' ')
// Полосы поровну: сверху вниз или слева направо
const stripes = (colors, vertical = false) =>
  colors.map((c, i) => (vertical ? `<rect x="${(36 / colors.length) * i}" width="${36 / colors.length}" height="24" fill="${c}"/>` : `<rect y="${(24 / colors.length) * i}" width="36" height="${24 / colors.length}" fill="${c}"/>`)).join('')
// Триграмма флага Кореи: три черты, 1 — сплошная, 0 — с разрывом
const trigram = (x, y, angle, bars) =>
  `<g transform="translate(${x} ${y}) rotate(${angle})" fill="#000">${bars.map((solid, k) => (solid ? `<rect x="-2.5" y="${k * 1.6 - 2.1}" width="5" height="1"/>` : `<rect x="-2.5" y="${k * 1.6 - 2.1}" width="2.1" height="1"/><rect x=".4" y="${k * 1.6 - 2.1}" width="2.1" height="1"/>`)).join('')}</g>`
const FLAGS = {
  en: `<rect width="36" height="24" fill="#012169"/><path d="M0 0l36 24M36 0L0 24" stroke="#fff" stroke-width="4.8"/><path d="M0 0l36 24M36 0L0 24" stroke="#c8102e" stroke-width="1.6"/><path d="M18 0v24M0 12h36" stroke="#fff" stroke-width="8"/><path d="M18 0v24M0 12h36" stroke="#c8102e" stroke-width="4.8"/>`,
  ru: stripes(['#fff', '#0039a6', '#d52b1e']),
  uk: stripes(['#0057b7', '#ffd700']),
  es: `<rect width="36" height="24" fill="#aa151b"/><rect y="6" width="36" height="12" fill="#f1bf00"/>`,
  fr: stripes(['#002395', '#fff', '#ed2939'], true),
  de: stripes(['#000', '#dd0000', '#ffce00']),
  pt: `<rect width="36" height="24" fill="#009c3b"/><path d="M18 3l15 9-15 9-15-9z" fill="#ffdf00"/><circle cx="18" cy="12" r="5.2" fill="#002776"/><path d="M13 11a9 9 0 0 1 9.9 2.6" stroke="#fff" stroke-width=".9" fill="none"/>`,
  it: stripes(['#009246', '#fff', '#ce2b37'], true),
  pl: stripes(['#fff', '#dc143c']),
  tr: `<rect width="36" height="24" fill="#e30a17"/><circle cx="13" cy="12" r="6" fill="#fff"/><circle cx="14.5" cy="12" r="4.8" fill="#e30a17"/><polygon points="${star(21.2, 12, 3, -90)}" fill="#fff"/>`,
  ja: `<rect width="36" height="24" fill="#fff"/><circle cx="18" cy="12" r="7.2" fill="#bc002d"/>`,
  zh: `<rect width="36" height="24" fill="#de2910"/>${[[6, 6, 3.6], [12, 2.4, 1.2], [14.4, 4.8, 1.2], [14.4, 8.4, 1.2], [12, 10.8, 1.2]].map(([x, y, r]) => `<polygon points="${star(x, y, r)}" fill="#ffde00"/>`).join('')}`,
  ko: `<rect width="36" height="24" fill="#fff"/><g transform="rotate(33.7 18 12)"><circle cx="18" cy="12" r="6" fill="#0047a0"/><path d="M12 12a6 6 0 0 1 12 0z" fill="#cd2e3a"/><circle cx="15" cy="12" r="3" fill="#cd2e3a"/><circle cx="21" cy="12" r="3" fill="#0047a0"/></g>${trigram(9.7, 6.4, 123.7, [1, 1, 1])}${trigram(26.3, 6.4, 56.3, [0, 1, 0])}${trigram(9.7, 17.6, 56.3, [1, 0, 1])}${trigram(26.3, 17.6, 123.7, [0, 0, 0])}`,
}
// Флаг — во вложенном svg: он обрезает всё, что вылезло за края (диагонали британского флага); тонкая рамка видна
// у белых флагов и на светлой теме, и на тёмной
function flagSvg(code) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#ffffff10"/><svg x="6" y="12" width="36" height="24" viewBox="0 0 36 24">${FLAGS[code]}</svg><rect x="6.5" y="12.5" width="35" height="23" fill="none" stroke="#8080804d"/></svg>`
}
// Обложка игры или книги: цвет от названия, крупные буквы
function coverSvg(g) {
  let h = 0
  for (const ch of g.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const hue = h % 360
  const letters = String(tr(g.title, lang)).replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},62%,52%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},70%,32%)"/></linearGradient></defs><rect width="56" height="56" rx="10" fill="url(#g)"/><text x="28" y="35" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="#fff" text-anchor="middle">${esc(letters)}</text></svg>`
}

// Жанр книги для плитки и заголовка: перевод на язык интерфейса и с заглавной буквы («роман» → «Роман», «Novel»)
function genreLabel(genre) {
  const t = tr(genre, lang)
  return t.charAt(0).toLocaleUpperCase() + t.slice(1)
}

function groupsList() {
  return catalog.groups ?? []
}
function shelvesList() {
  return catalog.shelves ?? []
}
function groupConsoles(groupId) {
  return consoles().filter((c) => c.group === groupId).map((c) => c.id)
}
function shelfGames(shelfId) {
  return games().filter((g) => g.shelf === shelfId && !g.mine && consoles().some((c) => c.id === g.console && c.group))
}
// Полка как «приставка» для списка игр: заголовок, адрес вкладки окна, группа для «Назад»
function shelfView(menuId) {
  const s = shelvesList().find((x) => `shelf:${x.id}` === menuId)
  if (!s) return null
  const g = shelfGames(s.id)[0]
  const group = consoles().find((c) => c.id === g?.console)?.group ?? groupsList()[0]?.id
  return { id: menuId, title: s.title, tab: `${group}:${s.id}`, group, list: shelfGames(s.id) }
}

// Игры каталога и проверка клавиш; note — строка под названием в меню
function games() {
  return [
    ...catalog.games.map((g) => {
      // Описание: по-русски, перевод с английского или английское, если перевода на этот язык нет
      const about = lang === 'ru' || !g.about_en ? g.about : g.about_i18n?.[lang] || g.about_en
      return { ...g, note: `${g.author ? `${g.author} · ` : ''}${tr(g.genre, lang)}${about ? ` — ${about}` : ''}`, web: true }
    }),
    ...mine.map((m) => ({
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

function mineFile(sha256) {
  return `${dataDir}${sep}${sha256}.b64`
}

function gameById(id) {
  return games().find((g) => g.id === id)
}

function clockTime() {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}

function log(text) {
  events = [`${clockTime()} ${text}`, ...events].slice(0, 6)
}

function consoleTitle(id) {
  return catalog.consoles.find((c) => c.id === id)?.title ?? CONSOLE_NAMES[id] ?? id
}

const WINDOW_NOTICE_MS = 15_000

// Сообщение про окно браузера («… открыт в Google Chrome») — на время: что окно закрыли, мод узнать не может,
// и через минуту такое сообщение уже неправда. Убираем его, если за это время его не сменило другое.
function windowNotice($, text) {
  libraryNotice = text
  $.clock.after(WINDOW_NOTICE_MS, () => {
    if (libraryNotice === text) {
      libraryNotice = ''
      $.ui.invalidate('ui.render')
    }
  })
}

const LOBBIES_EVERY_MS = 60_000

// Сводка сайта «кто ждёт» → игры каталога: номер игры EmulatorJS — из хеша ROM, как в окне; Doom — лобби FreeDM
function waitingFrom(data) {
  const list = []
  for (const g of catalog.games) {
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

function waitingText() {
  return netWaiting
    .slice(0, 2)
    .map((w) => (w.variants ? `${w.title}: ${w.variants.map((v) => `${variantLabel(w.id, v.key)} — ${v.count}`).join(', ')}` : `${w.title} (${w.count})`))
    .join(', ')
}

function paneColumns() {
  return wide ? WIDE_COLUMNS : PANE_COLUMNS
}

function workedSeconds(now) {
  return Math.max(0, Math.round((now - turnStartedAt) / 1000))
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

function statusText(now) {
  if (status === 'working') return `Агент работает ${workedText(workedSeconds(now))}`
  if (status === 'permission') return 'Агент ждёт разрешения — Esc, чтобы ответить'
  if (status === 'done') return 'Агент закончил — Esc, чтобы вернуться'
  return 'Агент свободен'
}

// Пакует строки из пар [символ, цвет] в строку для Raster — функция из документации модов
function cellsOf(rows) {
  const numbers = rows.flat().flatMap(([char, color]) => [char.codePointAt(0), color, DEFAULT_COLOR])
  return new Uint8Array(Uint32Array.from(numbers).buffer).toBase64()
}

function fieldRows() {
  return Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => (x === player.x && y === player.y ? ['@', PLAYER_COLOR] : ['.', FLOOR_COLOR])),
  )
}

function move(dx, dy) {
  player = {
    x: Math.min(COLS - 1, Math.max(0, player.x + dx)),
    y: Math.min(ROWS - 1, Math.max(0, player.y + dy)),
  }
}

// Берёт сохранённые клавиши; для действий, которых в сохранении нет, — клавиши по умолчанию
function restoreKeymap(saved) {
  return Object.fromEntries(
    ACTIONS.map((a) => [a.id, Array.isArray(saved?.[a.id]) ? saved[a.id] : [...DEFAULT_KEYS[a.id]]]),
  )
}

function startAssign(text) {
  mode = 'assign'
  assignStep = 0
  notice = text
}

function actionOf(key) {
  return ACTIONS.find((a) => keymap[a.id].includes(key))
}

function nesButton(id) {
  return Controller[`BUTTON_${ACTIONS.find((a) => a.id === id).nes}`]
}

// Один шаг Денди, два кадра. Повторное нажатие уже зажатой кнопки отпускает её на первый кадр,
// чтобы игра увидела новое нажатие — например, второй выстрел подряд.
function stepNes() {
  const wanted = new Set(taps)
  for (const key of heldKeys) {
    const action = actionOf(key)
    if (action) wanted.add(action.id)
  }
  for (const [id, left] of Object.entries(holdTicks)) {
    if (left > 0) wanted.add(id)
    if (left <= 1) delete holdTicks[id]
    else holdTicks[id] = left - 1
  }
  for (const id of taps) {
    if (down.has(id)) {
      nes.buttonUp(1, nesButton(id))
      down.delete(id)
    }
  }
  taps = new Set()
  nes.frame()
  for (const a of ACTIONS) {
    const want = wanted.has(a.id)
    if (want && !down.has(a.id)) {
      nes.buttonDown(1, nesButton(a.id))
      down.add(a.id)
    }
    if (!want && down.has(a.id)) {
      nes.buttonUp(1, nesButton(a.id))
      down.delete(a.id)
    }
  }
  nes.frame()
}

function releaseAll() {
  if (nes) for (const id of down) nes.buttonUp(1, nesButton(id))
  down = new Set()
  taps = new Set()
  heldKeys = []
  holdTicks = {}
}

// Текст строки 🎮 в VS Code → новая последняя буква как нажатие. Стирание (текст стал короче) — не нажатие.
// После нажатия строка стирается: при следующей отрисовке ей дают другое «пустое» значение.
function typedFrom(value) {
  const text = value ?? ''
  const grew = text.length > bandLength
  bandLength = text.length
  if (!grew) return false
  bandResetWanted = true
  return bandKey(Array.from(text).at(-1).toLowerCase())
}

// Буква из строки 🎮: знакомая — нажатие с удержанием; незнакомую пропускаем — переназначение клавиш тут только мешает
function bandKey(char) {
  if (!actionOf(char)) return false
  return typeKey(char)
}

// Enter в поле над вводом — Start
function pressStart() {
  if (!holdTicks.start) taps.add('start')
  holdTicks.start = HOLD_TICKS_FIRST
}

// Клавиша из поля ввода VS Code: нажатие плюс удержание, пока идёт автоповтор
function typeKey(key) {
  const save = pressKey(key)
  const action = actionOf(key)
  if (action && nesView() && mode === 'play') holdTicks[action.id] = holdTicks[action.id] ? HOLD_TICKS_REPEAT : HOLD_TICKS_FIRST
  return save
}

// Буквы и стрелки; Enter, Tab, пробел и цифры в играх не используются — ими отвечают Claude Code
function usableKey(key) {
  return key.length === 1 ? !/^\d$/.test(key) && key !== ' ' : ARROWS.includes(key)
}

function toLibrary() {
  releaseAll()
  const g = gameById(view)
  menu = g?.mine ? 'mine' : (g?.kind === 'book' || g?.kind === 'audio') && g?.shelf ? `genre:${g.shelf}:${g.genre}` : g?.shelf ? `shelf:${g.shelf}` : g?.console ?? 'settings' // в список, откуда игру открыли
  view = 'library'
  mode = 'play'
  notice = ''
}

// Одно нажатие клавиши над экраном игры; возвращает true, когда назначение клавиш закончено и его надо сохранить
function pressKey(key) {
  if (key === 'backspace') {
    toLibrary()
    return false
  }
  if (!usableKey(key)) return false
  if (mode === 'assign') {
    const action = ACTIONS[assignStep]
    for (const a of ACTIONS) keymap[a.id] = keymap[a.id].filter((c) => c !== key)
    keymap[action.id] = [...keymap[action.id], key]
    assignStep += 1
    if (assignStep < ACTIONS.length) return false
    mode = 'play'
    notice = 'Управление сохранено.'
    return true
  }
  if (IME_CHARS.test(key)) {
    notice = 'Похоже, включён метод ввода (японский, китайский или корейский). Выключи его на время игры.'
    return false
  }
  const action = actionOf(key)
  if (!action) {
    startAssign(`Не узнаю клавишу «${key}». Назначим управление под твою раскладку.`)
    return false
  }
  notice = ''
  pressed = [...pressed, key].slice(-16)
  if (view === 'field' && action.dx !== undefined) move(action.dx, action.dy)
  if (nesView()) taps.add(action.id)
  return false
}

// Сообщение от экрана игры: что зажато сейчас и счётчики нажатий. Данные пришли из кода, поэтому проверяем их.
// Возвращает, надо ли сохранить клавиши и перерисовать панель.
function readInput(data) {
  const held = Array.isArray(data?.held) ? data.held.filter((k) => typeof k === 'string' && usableKey(k)) : []
  const counts = data?.counts && typeof data.counts === 'object' ? data.counts : {}
  // На поле список зажатых клавиш виден, поэтому его смена — повод перерисовать; экран Денди обновляется сам
  let redraw = view === 'field' && held.join(' ') !== heldKeys.join(' ')
  heldKeys = held
  let save = false
  for (const [key, value] of Object.entries(counts)) {
    if (view === 'library') break // Backspace уже увёл в библиотеку — остальные нажатия этого сообщения не для игры
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0) continue
    const before = lastCounts[key] ?? 0
    const fresh = n >= before ? n - before : n // экран игры создан заново — счёт пошёл с нуля
    lastCounts[key] = n
    if (paused && fresh > 0 && view !== 'field') {
      paused = false
      agentAlert = null
      redraw = true
      continue
    }
    for (let i = 0; i < Math.min(fresh, 10); i++) {
      if (pressKey(key)) save = true
      redraw = true
    }
  }
  return { save, redraw }
}

// Открывает игру в панели; romBase64 — сам ROM для игр Денди (встроенный, из кеша или скачанный)
function launch(id, romBase64) {
  releaseAll()
  bandFocusWanted = true
  view = id
  lastGame = id
  notice = ''
  // Своя игра (Flappy Arcade) — движок с тем же устройством, что у эмулятора: кадр, шаг, кнопки
  if (gameById(id)?.engine === 'flappy' && nesGame !== id) {
    nes = createFlappy(
      (f) => {
        frame = f
      },
      {
        best: flappyBest,
        onGameOver: (score, best) => {
          if (best <= flappyBest) return
          flappyBest = best
          flappyDirty = true
        },
      },
    )
    nesGame = id
    nes.frame()
  } else if (romBase64 && nesGame !== id) {
    nes = createNes(romBase64, (f) => {
      frame = f
    })
    nesGame = id
    nes.frame()
  }
}

// Рекорд Flappy Arcade: хранится в моде, сохраняется при следующем сообщении от экрана игры
let flappyBest = 0
let flappyDirty = false

// Строка под экраном Flappy Arcade: что делать и счёт
function flappyLine() {
  if (!nes || nes.state === 'ready') return 'Нажми любую кнопку — взлететь'
  if (nes.state === 'over') return `Удар! Счёт: ${nes.score} · рекорд: ${nes.best} — любая кнопка, ещё раз`
  return `Счёт: ${nes.score} · рекорд: ${nes.best}`
}

// Сейчас в панели игра для Денди или своя (Flappy Arcade)
function nesView() {
  return Boolean(gameById(view)?.rom || gameById(view)?.engine)
}

// Отмечает панель открытой; саму панель открывает вызывающий код через $.ui.open
function markPaneOpen() {
  asked = true
  askVisible = false
  paneOpen = true
}

// Свободные строки под экран Денди: высота панели минус строки интерфейса вокруг экрана
function freeRows(props) {
  const total = props.placement === 'dock' ? props.scroll?.bodyRows ?? PANE_ROWS : PANE_ROWS
  return Math.max(8, total - UI_ROWS)
}

function pixelMode() {
  return graphics === 'pixels' || (graphics === 'auto' && !pixelsFailed)
}

function graphicsLabel() {
  const effective = graphics === 'auto' ? ` (сейчас ${pixelsFailed ? 'символы' : 'пиксели'})` : ''
  return `Графика: ${GRAPHICS_LABEL[graphics]}${effective}`
}

// Экран Денди для Raster или Image — то, что рисуется в панели и что отправляет $.ui.blit
function screenContent() {
  return pixelMode() ? { source: { png: frameToPng(frame) } } : { cells: frameToQuadrants(frame, screen.columns, screen.rows) }
}

function windowMode() {
  return platform !== null && (opener ?? 'window') === 'window'
}

// Открывать ли игру окном браузера на этой поверхности. В терминале — по выбору в настройках (по умолчанию да).
// В VS Code по умолчанию игра в панели, окно — только если его выбрали явно. В Desktop Денди всегда в панели,
// остальное — по своей настройке (builtinBrowser).
function opensWindow(surface) {
  if (!windowMode()) return false
  if (surface === 'terminal') return true
  return surface === 'vscode' && opener === 'window'
}

// Desktop: игра не Денди открывается во встроенном браузере приложения (desktopWindow) — по умолчанию — или окном
// браузера, как в терминале, если так выбрано в настройках. Окно — только когда ОС уже определена. Шутерам (mouse)
// нужна захваченная мышь, а встроенный браузер её не отдаёт — они идут окном и при выбранном встроенном браузере
function builtinBrowser(surface, mouse = false) {
  return surface === 'desktop' && (!platform || (desktopOpener === 'builtin' && !mouse))
}

function mouseGame(id) {
  return gameById(id)?.console === 'doom'
}
const MOUSE_NOTE = 'Встроенный браузер Claude не даёт игре захватить мышь, поэтому шутеры открываются окном браузера.'

function webGame(id) {
  return gameById(id)?.web === true
}

// Чем открыть окно: выбранный браузер, браузер по умолчанию, если его узнали, или то, что открывает ссылки
function windowTarget() {
  const browsers = detection?.browsers ?? []
  const id = browserChoice === 'default' ? detection?.defaultId : browserChoice
  const browser = browsers.find((b) => b.id === id)
  return browser ? { kind: 'browser', browser } : { kind: 'default' }
}

// Команда, которая открывает окно с игрой (или с библиотекой, если id нет) на сайте Arcade.
// На Windows — выбранным браузером, отдельным окном справа; на macOS и Linux — браузером по умолчанию.
function windowUrl(id) {
  // chat — страница чатов на сайте: код ссылки после #, страница обменяет его на свой билет и уберёт из адреса
  if (id === 'chat') return `${SITE}/chat${lang === 'ru' ? '' : `?lang=${lang}`}#k=${chatLink}${ch.talk && (menu === 'chats:talk' || menu === 'chats:members') ? `&c=${ch.talk}` : ''}`
  // video:<номер> — страница просмотра с подборкой YouTube; язык она берёт сама
  if (typeof id === 'string' && id.startsWith('video:')) return watchUrl(yt.videos, Number(id.slice(6)) || 0, lang)
  // article:<номер> — переход к статье через страницу /read, episode:<номер> — выпуск подкаста на странице /listen
  if (typeof id === 'string' && id.startsWith('article:')) return readUrl(reads.articles.items[Number(id.slice(8)) || 0], lang)
  if (typeof id === 'string' && id.startsWith('episode:')) return listenUrl(reads.podcasts.items[Number(id.slice(8)) || 0], lang)
  // live:<логин> — страница /live с плеером Twitch; в списке рядом — свои каналы, если канал свой, иначе каталог
  if (typeof id === 'string' && id.startsWith('live:')) return liveUrl(twitchList(id.slice(5)), id.slice(5), lang)
  let url
  // tab:<вкладка> или tab:<группа>:<полка>
  if (typeof id === 'string' && id.startsWith('tab:')) url = tabPageUrl(...id.slice(4).split(':'))
  // Денди по сети — та же игра в окне на EmulatorJS (FCEUmm) с его сетевой игрой
  else if (typeof id === 'string' && id.startsWith('net:')) url = `${pageUrl(id.slice(4))}&net=1`
  // Кооператив Freedoom — лобби кооператива этой игры
  else if (typeof id === 'string' && id.startsWith('coop:')) url = `${pageUrl(id.slice(5))}&net=coop`
  else {
    const m = mine.find((x) => x.id === id)
    url = m ? minePageUrl(m) : pageUrl(id)
  }
  if (lang === 'ru') return url
  // Язык передаём в адресе: после # — если своя игра там, иначе обычным параметром
  if (url.includes('#')) return `${url}&lang=${lang}`
  return url.includes('?') ? `${url}&lang=${lang}` : `${url}?lang=${lang}`
}

// Сетевая настольная игра: подпись @ника — после #, страница покажет ник соперникам и уберёт его из адреса. Вышли —
// пустая подпись: страница забудет прежнюю. Только в окна, которые мод открывает сам: в просьбу к Claude подпись не идёт
function withName(url, id) {
  if (gameById(id)?.kind !== 'board') return url
  if (acct.ticket) return `${url}#me=${acct.ticket}`
  return acct.session ? url : `${url}#me=`
}

function windowCommand(id) {
  const url = withName(windowUrl(id), id)
  if (platform === 'mac') return { argv: ['open', url], env: {} }
  if (platform === 'linux') return { argv: ['xdg-open', url], env: {} }
  return launchCommand(windowTarget(), url, windowBounds(detection?.screen ?? null), profileRoot)
}

// Что сказать после попытки открыть окно
function launchNotice(result, id) {
  const title = id ? gameById(id)?.title ?? id : 'Arcade'
  if (result?.exitCode === 0) {
    const target = platform === 'windows' ? windowTarget() : { kind: 'default' }
    const where = target.kind === 'browser' ? target.browser.name : 'браузере по умолчанию'
    if (id === 'chat') return `Чаты открыты в ${where}.`
    if (typeof id === 'string' && id.startsWith('video:')) return `Видео открыто в ${where}.`
    if (typeof id === 'string' && id.startsWith('article:')) return `Статья открыта в ${where}.`
    if (typeof id === 'string' && id.startsWith('episode:')) return `Выпуск открыт в ${where}.`
    if (typeof id === 'string' && id.startsWith('live:')) return `Трансляция открыта в ${where}.`
    return id
      ? `${title} открыт в ${where}. Игра стоит на паузе, пока окно не в фокусе.`
      : `Arcade открыт в ${where}: выбирай приставку и игру.`
  }
  const reason = String(result?.stderr ?? '').trim().split('\n')[0] || `код ${result?.exitCode}`
  return `Не получилось открыть окно: ${reason}`
}

// В Desktop окно — встроенный браузер приложения, его MCP-сервер. Его инструменты Arcade зовёт тем же путём, что
// и Claude ($.tool.call, через проверку разрешений), и свои вызовы разрешает сам — хук tool.check в register:
// прямой $.mcp.call авто-режим не пропускал, просил ведь не человек. В авто-режиме не выходит и так: вызовы мода
// классификатор не судит, а разрешение мода движок там не слушает (как и субагента мода) — тогда игру открывает Claude
// по просьбе Arcade: его вызовы классификатор оценит. Просьба мода ждёт, пока Claude освободится, поэтому работающего
// агента Arcade прерывает: дожидается конца текущего инструмента (не дольше CUT_TOOL_MS — потом обрывает и его, и
// просит Claude проверить, что тот успел), обрывает ход ($.turn.abort) и сразу просит открыть игру и вернуться к
// работе. Не прервался — просьба ждёт конца хода. Не приняли просьбу или браузер ответил ошибкой —
// кладём её в поле ввода, и по Enter её выполнит Claude. Черновик в поле не стираем: просьба встаёт после него. Поле
// может и не взять текст: под вопросом Claude Code — 'dialog'; где поле рисует само приложение — 'manual', просьбу
// человек отправит сам. Игру открыл Claude — панель Arcade закрываем, как и после своего открытия.
const BROWSER = 'mcp__Claude_Browser__'
// Боковые панели приложения: скрытую панель браузера показывает он
const SHOW_PANE = 'mcp__ccd_view__show_pane'
// Инструменты приложения, которые Arcade зовёт сам
const DESKTOP_TOOLS = [`${BROWSER}tabs_context`, `${BROWSER}navigate`, `${BROWSER}tabs_select`, `${BROWSER}preview_start`, SHOW_PANE]

// Вызов, который Arcade разрешает себе без вопроса: вкладки браузера, адрес только на сайте Arcade, панель браузера
export function ownDesktopCall(tool, input) {
  if (tool === `${BROWSER}tabs_context` || tool === `${BROWSER}tabs_select`) return true
  if (tool === `${BROWSER}navigate` || tool === `${BROWSER}preview_start`) return typeof input?.url === 'string' && input.url.startsWith(`${SITE}/`)
  return tool === SHOW_PANE && input?.pane === 'preview'
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

// Вкладка Arcade, если она уже открыта: активная, иначе последняя
async function arcadeTab($, consent) {
  const ours = (await browserTabs($, consent)).filter((t) => t.origin === SITE)
  return ours.find((t) => t.isActive) ?? ours.pop() ?? null
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
    const result = await browse($, withName(url, id), await arcadeTab($, consent), consent)
    if (!result?.isError) {
      await showBrowser($, consent)
      return 'opened'
    }
    log(`встроенный браузер ответил ошибкой: ${toolText(result).slice(0, 200)}`)
  } catch (err) {
    denied = err?.denied === true
    log(`встроенный браузер не открылся: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  // Отказ в разрешении — просим Claude. Сжимает он контекст — ждём конца сжатия: прерванный в это время ход не
  // обрывается, а просьбы копятся в очереди
  if (denied && compacting) {
    pendingOpen = url // откроем, когда сжатие кончится: хук session.compact в register
    return 'compacting'
  }
  // Работает — сначала прерываем, иначе просьба ждёт конца его хода. Уже открывает другую игру по просьбе Arcade —
  // второй раз не прерываем: просьба встанет следом
  if (denied && agentTurn && !asking) {
    // Идёт инструмент или Claude Code спрашивает разрешение (прерванный ход унёс бы и вопрос) — ждём
    if (toolsRunning > 0 || status === 'permission') {
      pendingOpen = url // прервём, когда закончится текущий инструмент: хук tool.call в register
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
  pendingOpen = null
  const turnId = agentTurn
  if (!turnId) return askClaude($, url, true)
  interrupting = true
  try {
    await $.turn.abort({ turnId })
  } catch (err) {
    interrupting = false
    log(`ход агента не прервался: ${String(err?.message ?? err).slice(0, 200)}`)
    return askClaude($, url, true)
  }
  log(cut ? 'Arcade оборвал инструмент и ход агента' : 'Arcade прервал ход агента')
  // Об оборванном инструменте Claude больше никто не скажет: маркера прерывания нет
  const then = [
    tr('Потом вернись к работе, которую делал до этого.', lang),
    cut ? tr('Твой последний инструмент оборван на полпути: проверь, что он успел сделать, прежде чем продолжать.', lang) : null,
  ]
  const outcome = await askClaude($, url, true, then.filter(Boolean).join('\n'))
  return outcome === 'sent' ? 'interrupted' : outcome
}

// Инструмент агента идёт дольше CUT_TOOL_MS, а игра всё ждёт — обрываем и его. Пока Claude Code спрашивает
// разрешение, не обрываем: ход унёс бы и вопрос
async function cutPending($, url) {
  if (pendingOpen !== url || toolsRunning === 0 || status === 'permission' || !agentTurn || compacting) return
  pendingOpen = null
  desktopNotice($, await interruptAgent($, url, true), '', url)
}

// Текущий инструмент агента или сжатие контекста закончились, а игра ждёт — прерываем ход. Ход уже кончился сам —
// просьба уходит как обычно
async function openPending($) {
  if (!pendingOpen || toolsRunning > 0 || compacting) return
  const url = pendingOpen
  pendingOpen = null
  desktopNotice($, agentTurn ? await interruptAgent($, url) : await askClaude($, url, true), '', url)
}

// Просьба открыть адрес — Claude: сразу (submit) или в поле ввода; then — что сделать после. Откроет — панель закроет
// хук tool.call в register
async function askClaude($, url, submit, then) {
  const ask = [tr(`Открой во встроенном браузере: ${url}`, lang), then].filter(Boolean).join('\n')
  opening = true
  if (submit) {
    // Отмечаем до отправки: ход с просьбой может и кончиться раньше, чем ответит submit
    asking = url
    const sent = await $.prompt.submit({ text: ask }).catch((err) => ({ drop: String(err?.message ?? err) }))
    if (!sent.drop) return 'sent'
    asking = null
    log(`просьба Claude не ушла: ${sent.drop.slice(0, 200)}`)
  }
  const { text: draft } = await $.prompt.read()
  if (draft.includes(url)) return 'filled'
  const filled = await $.prompt.fill({ text: draft.trim() ? `\n${ask}` : ask, mode: 'append' })
  if (filled.isFilled) return 'filled'
  return filled.refusal === 'dialog' ? 'dialog' : 'manual'
}

// Что сказать о попытке открыть встроенный браузер; opened — если он открылся сразу
function desktopNotice($, outcome, opened, url) {
  // Адрес для ручной просьбы не убираем через 15 секунд: его ещё надо переписать. Ожидание — пока не кончится
  // инструмент агента или сжатие, сколько бы они ни шли
  // Что открывается: видео (и трансляция), статья или выпуск (о них — «ссылка») или игра
  const page = (path) => String(url).startsWith(`${SITE}/${path}`)
  const kind = page('watch') || page('live') ? 'video' : page('read') || page('listen') || page('chat') ? 'link' : 'game'
  const pick = (video, link, game) => ({ video, link, game })[kind]
  if (outcome === 'manual') libraryNotice = `Попроси Claude открыть во встроенном браузере: ${url}`
  else if (outcome === 'waiting')
    libraryNotice = pick(
      'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть видео во встроенном браузере.',
      'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть ссылку во встроенном браузере.',
      'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть игру во встроенном браузере.',
    )
  else if (outcome === 'compacting')
    libraryNotice = pick(
      'Claude сжимает контекст — когда закончит, Arcade попросит его открыть видео во встроенном браузере.',
      'Claude сжимает контекст — когда закончит, Arcade попросит его открыть ссылку во встроенном браузере.',
      'Claude сжимает контекст — когда закончит, Arcade попросит его открыть игру во встроенном браузере.',
    )
  else if (outcome === 'asking')
    windowNotice(
      $,
      pick(
        'Claude уже открывает это видео во встроенном браузере — подожди немного.',
        'Claude уже открывает эту ссылку во встроенном браузере — подожди немного.',
        'Claude уже открывает эту игру во встроенном браузере — подожди немного.',
      ),
    )
  else
    windowNotice(
      $,
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

// Открыть во встроенном браузере и сказать, что вышло; opened — что сказать, если он открылся сразу
async function desktopWindow($, id, opened) {
  // Эту же игру Claude уже открывает по просьбе Arcade или она ждёт конца инструмента или сжатия — повторное
  // нажатие только напоминает, что происходит: второй раз ход не прерываем
  const url = windowUrl(id)
  if (asking === url || pendingOpen === url) {
    desktopNotice($, asking === url ? 'asking' : compacting ? 'compacting' : 'waiting', '', url)
    return
  }
  opening = false
  pendingOpen = null
  libraryNotice = 'Открываю встроенный браузер…'
  $.ui.invalidate('ui.render')
  const outcome = await openDesktopBrowser($, id)
  desktopNotice($, outcome, opened, url)
  // Браузер встаёт под панелью Arcade, и игре тесно — панель закрываем. Назад — /arcade или «Библиотека» на сайте
  if (outcome === 'opened') await $.ui.close({ id: PANE })
}

// Игру открыл Claude по просьбе Arcade: панель Arcade закрываем. Вызов Claude панель браузера не показывает —
// показываем сами (в авто-режиме может и не выйти)
async function openedForArcade($, e) {
  opening = false
  asking = null
  await showBrowser($, desktopConsent(e.url))
  if (paneOpen) await $.ui.close({ id: PANE })
}

// --- YouTube: темы по работе агента, свежие видео из лент каналов --------------------------------------------------
const FEED_TTL_MS = 2 * 3_600_000
const CHANNELS_TTL_MS = 6 * 3_600_000 // список каналов с сайта — не чаще раза в 6 часов
const TOPICS_TTL_MS = 20 * 60_000 // темы подбираем заново, если с прошлого раза работа агента ушла вперёд
const YT_FETCH_MS = 8_000 // сколько ждать сайт и каждую ленту
const YT_MODEL_MS = 20_000 // сколько ждать haiku
const YT_POOL = 30 // сколько кандидатов каждого языка показывать модели
const SEARCH_TTL_MS = 3 * 3_600_000 // найденное по своей теме помним 3 часа: «Другая подборка» не тратит поиск
const SEARCH_FETCH_MS = 15_000 // поиск сайта опрашивает несколько источников — ждём дольше, чем ленту
const SEARCH_DAYS = 730 // найденное поиском — не старше двух лет, как и на сайте
const SHOW_DAYS = 365 // выпуски шоу из поиска — за год: нишевые подкасты выходят нечасто

// Ответ сети или null, если не пришёл за ms: у $.http.fetch своего срока нет. init — метод, заголовки и тело запроса
function fetchWithin($, url, ms, init = undefined) {
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
    const fresh = response?.ok ? parseChannels(response.text) : null
    if (fresh) {
      await $.store.set('ytChannels', { at: now, list: fresh })
      return fresh
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
const topicKey = (text) => (/^u[0-9a-z]+$/.test(text) ? text : Number(text))
function topicOf(key) {
  return typeof key === 'string' ? myTopics.find((t) => `u${t.id}` === key) : yt.topics?.[key]
}

// Поиск сайта по своей теме → { list, error }; удачный ответ помним SEARCH_TTL_MS
async function searchFor($, kind, query, now) {
  const key = `${kind}:${query.toLowerCase()}`
  const hit = searchCache.get(key)
  if (hit && now - hit.at < SEARCH_TTL_MS) return hit.found
  const found = parseSearch(kind, await fetchWithin($, searchUrl(kind, query), SEARCH_FETCH_MS))
  if (found.error) log(`поиск по своей теме (${kind}): ${found.error}`)
  else searchCache.set(key, { at: now, found })
  return found
}

// Почему по своей теме пусто: поиск на сегодня исчерпан, не ответил или ничего не нашёл
function searchNote(found) {
  if (found?.error === 'limit') return 'Поиск по своей теме на сегодня исчерпан — попробуй завтра.'
  if (found?.error === 'feeds') return 'Подкасты по теме нашлись, но их ленты не ответили. Попробуй чуть позже.'
  if (found?.error) return 'Поиск по своей теме не ответил. Попробуй чуть позже.'
  return 'По этой теме ничего не нашлось — попробуй сказать иначе.'
}

// Своя тема: haiku делает из текста тему с английским запросом; не ответила — текст латиницей сам себе запрос.
// Тема встаёт первой в «Моих темах»; если человек всё ещё в темах раздела kind — открываем её подборку
async function addTopic($, kind, value) {
  const text = clean(value, 200)
  const say = (note) => {
    ownNote = { kind, text: note }
    $.ui.invalidate('ui.render')
  }
  if (text.length < 2) return say('Напиши тему словами — например, «история Рима» или «хлеб на закваске».')
  const request = ++ownRequest
  say('Разбираю тему…')
  const now = await $.clock.now()
  let parsed = null
  try {
    const list = await ytChannels($, now)
    const answer = await $.model.complete({ model: 'haiku', ...ownTopicPrompt(text, lang, list.directions), maxTokens: 200, timeoutMs: YT_MODEL_MS })
    if (answer.isAnswered) parsed = parseOwnTopic(answer.text, list.directions)
    else log(`своя тема: модель не ответила (${answer.reason})`)
  } catch (err) {
    log(`своя тема не разобрана: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  if (request !== ownRequest) return
  parsed ??= plainTopic(text)
  if (!parsed) return say('Не получилось разобрать тему. Попробуй написать её по-английски.')
  if (parsed.refused) return say('Такую тему Arcade не ищет: политика и темы для взрослых — мимо. Попробуй другую.')
  const topic = ownTopic(parsed)
  myTopics = rememberTopic(myTopics, topic)
  ownNote = { kind: '', text: '' }
  try {
    await saveSetting($, 'myTopics', myTopics)
  } catch (err) {
    log(`свои темы не сохранены: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  // Человек ушёл из тем этого раздела — тема только запомнилась: подборку открытой страницы не трогаем
  const key = `u${topic.id}`
  if (menu !== kind) return $.ui.invalidate('ui.render')
  menuFrom = menu
  menu = `${kind}:${key}`
  libraryNotice = ''
  if (kind === 'youtube') loadVideos($, key)
  else loadReads($, kind, key)
}

// «Забыть мои темы»: список пустеет и в $.store
async function forgetTopics($) {
  myTopics = []
  ownNote = { kind: '', text: '' }
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
function twitchNote(error) {
  if (error === 'keys') return 'Twitch не принял ключи сайта Arcade — эфиры пока не показать.'
  if (error === 'off') return 'Twitch на сайте Arcade ещё не настроен — эфиры пока не показать.'
  if (error === 'limit') return 'Вопросы к Twitch на сегодня исчерпаны — попробуй завтра.'
  if (error) return 'Сайт Arcade не ответил про эфиры Twitch. Попробуй чуть позже.'
  return ''
}

// Что сайт сказал о каналах logins — поверх прежнего: эфиры других каналов не теряются
function rememberTwitch(logins, found) {
  for (const login of logins) {
    delete tw.info[login]
    tw.missing.delete(login)
  }
  for (const c of found.channels) tw.info[c.login] = c
  for (const login of found.missing) tw.missing.add(login)
}

// Кто в эфире: свои каналы и каталог — одним вопросом к сайту. force — «Обновить»: минуту не ждём
async function loadTwitch($, force = false) {
  const now = await $.clock.now()
  if (tw.loading || (!force && !tw.error && tw.at && now - tw.at < TWITCH_TTL_MS)) return
  const request = ++tw.request
  const logins = tw.channels.map((c) => c.login)
  tw.loading = true
  $.ui.invalidate('ui.render')
  const found = parseTwitch(await fetchWithin($, twitchUrl(logins), TWITCH_FETCH_MS))
  if (request !== tw.request) return
  tw.loading = false
  tw.error = found.error
  if (found.error) log(`twitch: ${found.error}`)
  else {
    tw.at = now
    rememberTwitch(logins, found)
    tw.catalog = found.catalog
  }
  $.ui.invalidate('ui.render')
}

async function saveChannels($) {
  try {
    await saveSetting($, 'twitchChannels', tw.channels)
  } catch (err) {
    log(`каналы Twitch не сохранены: ${String(err?.message ?? err).slice(0, 200)}`)
  }
}

// «Добавить канал»: имя или ссылка на twitch.tv; сайт проверяет, что канал есть. Канал встаёт первым в «Моих каналах»
let addingChannel = 0
async function addChannel($, value) {
  const say = (note) => {
    tw.note = note
    $.ui.invalidate('ui.render')
  }
  const login = twitchLogin(value)
  if (!login) return say('Напиши имя канала Twitch или ссылку на него — например, twitch.tv/tsoding.')
  if (!tw.channels.some((c) => c.login === login) && tw.channels.length >= MY_CHANNELS) return say('Своих каналов уже 20 — сначала убери какой-нибудь.')
  const request = ++addingChannel
  say('Ищу канал на Twitch…')
  const found = parseTwitch(await fetchWithin($, twitchUrl([login]), TWITCH_FETCH_MS))
  if (request !== addingChannel) return
  if (found.error) return say(twitchNote(found.error))
  rememberTwitch([login], found)
  const channel = found.channels.find((c) => c.login === login)
  if (!channel) return say('Такого канала нет на Twitch — проверь имя.')
  tw.channels = rememberChannel(tw.channels, { login, name: channel.name })
  say(`Канал добавлен: ${channel.name}.`)
  await saveChannels($)
}

// «Убрать канал»: из «Моих каналов» и из $.store
async function removeChannel($, login) {
  const gone = tw.channels.find((c) => c.login === login)
  if (!gone) return
  tw.channels = tw.channels.filter((c) => c.login !== login)
  tw.note = `Канал убран: ${tw.info[login]?.name ?? gone.name}.`
  if (!tw.channels.length && menu === 'twitch:remove') {
    menuFrom = menu
    menu = 'twitch'
  }
  $.ui.invalidate('ui.render')
  await saveChannels($)
}

// Каналы для списка страницы /live: свои — если канал свой, иначе каталог; порядок — как в меню
function twitchList(login) {
  const own = liveFirst(tw.channels, tw.info).map((c) => c.login)
  return own.includes(login) ? own : tw.catalog.map((c) => c.login)
}

// --- Аккаунт: вход через GitHub и настройки на всех компьютерах ------------------------------------------------------
const ACCOUNT_FETCH_MS = 15_000 // сайту самому надо спросить GitHub
const SYNC_DELAY_MS = 2_000 // настройку поменяли — на сайт через пару секунд: вдруг человек меняет ещё
const SYNC_EVERY_MS = 30 * 60_000 // и раз в полчаса — забрать то, что поменяли на другом компьютере

// Почему вход или синхронизация не удались
function accountNote(error) {
  if (error === 'off') return 'Вход на сайте Arcade ещё не настроен.'
  if (error === 'app') return 'GitHub не принял приложение Arcade — вход пока не работает.'
  if (error === 'limit') return 'Попыток входа с этого адреса на сегодня слишком много — попробуй завтра.'
  if (error === 'big') return 'Настройки не поместились на сайте Arcade.'
  return 'Сайт Arcade не ответил. Попробуй чуть позже.'
}

// Почему ник не взялся
function handleNote(error, handle) {
  if (error === 'invalid') return 'Ник — от 4 до 32 знаков: латинские буквы, цифры и _, первый — буква.'
  if (error === 'reserved') return 'Такой ник взять нельзя — выбери другой.'
  if (error === 'taken') return `@${handle} уже занят — выбери другой.`
  if (error === 'often') return 'Ник сегодня меняли слишком часто — попробуй завтра.'
  return accountNote(error)
}

// Вопрос к сайту про вход, настройки, друзей и чаты; query — параметры адреса. Ключ сессии — только в заголовке и
// только своему сайту
function accountFetch($, name, { method = 'GET', body, token, query } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const url = query ? `${accountUrl(name)}?${new URLSearchParams(query)}` : accountUrl(name)
  return fetchWithin($, url, ACCOUNT_FETCH_MS, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
}

// Настройка из $.store или с сайта → в мод. Не подходит — false, остаётся прежняя
function applySetting(key, value) {
  if (key === 'lang') {
    if (!LANGS.includes(value)) return false
    lang = value
  } else if (key === 'keys') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const fine = (list) => Array.isArray(list) && list.length <= 64 && list.every((k) => typeof k === 'string' && k.length <= 30)
    keymap = restoreKeymap(Object.fromEntries(Object.entries(value).filter(([, list]) => fine(list))))
  } else if (key === 'notify' || key === 'wide') {
    if (typeof value !== 'boolean') return false
    if (key === 'notify') osNotify = value
    else wide = value
  } else if (key === 'onDone' || key === 'onPermission') {
    if (!SIGNAL_MODES.includes(value)) return false
    if (key === 'onDone') onDone = value
    else onPermission = value
  } else if (key === 'myTopics') {
    if (!Array.isArray(value)) return false
    myTopics = restoreMyTopics(value)
  } else if (key === 'twitchChannels') {
    if (!Array.isArray(value)) return false
    tw.channels = restoreTwitch(value)
  } else if (key === 'flappyBest') {
    const best = Math.floor(Number(value))
    if (!Number.isFinite(best) || best < 0) return false
    flappyBest = Math.max(flappyBest, best)
  } else return false
  return true
}

// Настройка из SYNC_KEYS, как она сейчас в моде
function settingValue(key) {
  return { lang, keys: keymap, notify: osNotify, wide, onDone, onPermission, myTopics, twitchChannels: tw.channels, flappyBest }[key]
}

// Сохранить настройку из SYNC_KEYS: в $.store, с отметкой времени, и — если вошли — через пару секунд на сайт
async function saveSetting($, key, value) {
  const at = await $.clock.now()
  savedKeys.add(key)
  stamps = { ...stamps, [key]: at }
  await $.store.set(key, value)
  await $.store.set('syncAt', stamps)
  if (acct.session) scheduleSync($, SYNC_DELAY_MS)
}

function scheduleSync($, ms) {
  syncTimer?.cancel()
  syncTimer = $.clock.after(ms, () => {
    syncTimer = null
    syncAccount($)
  })
}

// Встреча настроек этого компьютера и сайта: новое оттуда — сюда, новое отсюда — туда
async function syncAccount($) {
  const session = acct.session
  if (!session) return
  if (acct.syncing) {
    acct.again = true
    return
  }
  acct.syncing = true
  acct.again = false
  $.ui.invalidate('ui.render')
  try {
    const claims = acct.claims
    const me = parseMe(await accountFetch($, 'me', { token: session.token }))
    if (acct.session !== session) return
    if (me.error) return await syncFailed($, me.error)
    if (acct.claims === claims) {
      acct.handle = me.handle
      acct.ticket = me.ticket
    }
    acct.friends = me.friends
    acct.requests = me.requests
    acct.unread = me.unread
    const now = await $.clock.now()
    if (acct.session !== session) return
    const renamed = me.user.id === session.user.id && JSON.stringify(me.user) !== JSON.stringify(session.user)
    if (renamed) session.user = me.user
    const local = Object.fromEntries([...savedKeys].map((key) => [key, settingValue(key)]))
    const plan = syncPlan(local, stamps, me.settings, now)
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
    stamps = plan.stamps
    if (changed.length) $.ui.invalidate('ui.render')
    if (renamed) await $.store.set('account', session)
    for (const key of changed) await $.store.set(key, settingValue(key))
    await $.store.set('syncAt', stamps)
    if (Object.keys(plan.push).length) {
      const sent = parseSettings(await accountFetch($, 'settings', { method: 'PUT', body: { settings: plan.push }, token: session.token }))
      if (acct.session !== session) return
      if (sent.error) return await syncFailed($, sent.error)
    }
    acct.syncedAt = now
    acct.note = ''
  } catch (err) {
    log(`настройки не синхронизированы: ${String(err?.message ?? err).slice(0, 200)}`)
  } finally {
    acct.syncing = false
    $.ui.invalidate('ui.render')
    if (acct.again) syncAccount($)
  }
}

async function syncFailed($, error) {
  log(`аккаунт: ${error}`)
  if (error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  acct.note = accountNote(error)
}

// Забыть вход на этом компьютере. Настройки остаются как есть
async function forgetSession($, note) {
  acct.session = null
  acct.flow = null
  acct.starting = false
  acct.note = note
  acct.syncedAt = 0
  acct.confirmDelete = false
  acct.handle = ''
  acct.ticket = ''
  acct.naming = false
  acct.handleNote = ''
  acct.friends = 0
  acct.requests = 0
  acct.unread = 0
  acct.request++
  fr = { ...NO_FRIENDS, request: fr.request + 1 }
  ch = { ...NO_CHATS, picked: new Set(), request: ch.request + 1 }
  chatLink = ''
  syncTimer?.cancel()
  syncTimer = null
  $.ui.invalidate('ui.render')
  try {
    await $.store.delete('account')
  } catch (err) {
    log(`вход не забыт: ${String(err?.message ?? err).slice(0, 200)}`)
  }
}

// «Войти через GitHub»: сайт просит у GitHub код, человек вводит его на странице GitHub
async function startLogin($) {
  if (acct.starting || acct.flow || acct.session) return
  const request = ++acct.request
  acct.starting = true
  acct.note = ''
  $.ui.invalidate('ui.render')
  const start = parseStart(await accountFetch($, 'start', { method: 'POST' }))
  const now = await $.clock.now()
  if (request !== acct.request) return
  acct.starting = false
  if (start.error) acct.note = accountNote(start.error)
  else {
    acct.flow = { device: start.device, code: start.code, url: start.url, interval: start.interval, until: now + start.expires * 1000 }
    waitLogin($, request, now)
  }
  $.ui.invalidate('ui.render')
}

// Спрашивать сайт, вошёл ли человек, — раз в interval секунд, пока код жив; истечёт раньше — сказать сразу
function waitLogin($, request, now) {
  const flow = acct.flow
  const current = () => request === acct.request && acct.flow === flow
  const end = (note) => {
    acct.flow = null
    acct.note = note
    $.ui.invalidate('ui.render')
  }
  $.clock.after(Math.min(flow.interval * 1000, Math.max(flow.until - now, 0) + 1), async () => {
    if (!current()) return
    if ((await $.clock.now()) > flow.until) return end('Код истёк — попробуй ещё раз.')
    const poll = parsePoll(await accountFetch($, 'poll', { method: 'POST', body: { device: flow.device } }))
    if (!current()) return
    if (poll.status === 'ok') return finishLogin($, poll.account)
    if (poll.status === 'expired') return end('Код истёк — попробуй ещё раз.')
    if (poll.status === 'denied') return end('Вход отменён на GitHub.')
    if (['off', 'app', 'limit'].includes(poll.error)) return end(accountNote(poll.error))
    // Ждём дальше; сайт не ответил — тоже ждём, но говорим об этом
    if (poll.interval) flow.interval = poll.interval
    const note = poll.error ? accountNote(poll.error) : ''
    if (note !== acct.note) {
      acct.note = note
      $.ui.invalidate('ui.render')
    }
    waitLogin($, request, await $.clock.now())
  })
}

async function finishLogin($, account) {
  acct.flow = null
  acct.note = ''
  acct.session = account
  $.ui.invalidate('ui.render')
  try {
    await $.store.set('account', account)
  } catch (err) {
    log(`вход не сохранён: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  syncAccount($)
}

function cancelLogin($) {
  acct.request++
  acct.flow = null
  acct.starting = false
  acct.note = ''
  $.ui.invalidate('ui.render')
}

// «Взять @ник» или свой ник из поля: сайт проверяет, свободен ли он, и отдаёт подпись ника для сетевых игр
async function claimHandle($, text) {
  const session = acct.session
  if (!session || acct.naming) return
  const handle = normalHandle(text)
  if (handle === acct.handle) return
  if (!HANDLE.test(handle)) {
    acct.handleNote = handleNote('invalid', handle)
    return $.ui.invalidate('ui.render')
  }
  acct.naming = true
  acct.handleNote = ''
  $.ui.invalidate('ui.render')
  const answer = parseHandle(await accountFetch($, 'handle', { method: 'PUT', body: { handle }, token: session.token }))
  if (acct.session !== session) return
  acct.naming = false
  if (answer.error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (answer.error) acct.handleNote = handleNote(answer.error, handle)
  else {
    acct.claims++
    acct.handle = answer.handle
    acct.ticket = answer.ticket
  }
  $.ui.invalidate('ui.render')
}

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
async function friendsCall($, name, body, handle = '', done = '') {
  const session = acct.session
  if (!session || fr.busy) return
  const request = ++fr.request
  if (body) fr.busy = name
  else fr.loading = true
  $.ui.invalidate('ui.render')
  const answer = parseFriends(await accountFetch($, name, body ? { method: 'POST', body, token: session.token } : { token: session.token }))
  if (acct.session !== session || request !== fr.request) return
  fr.busy = ''
  fr.loading = false
  if (answer.error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (answer.error) {
    fr.note = friendsNote(answer.error, handle)
    fr.bad = true
  } else {
    fr.list = { friends: answer.friends, incoming: answer.incoming, outgoing: answer.outgoing }
    acct.friends = answer.friends.length
    acct.requests = answer.incoming.length
    // Список без действия: прежняя заметка об успехе остаётся, об ошибке — уходит
    if (body) fr.note = answer.status === 'sent' ? `Заявка отправлена: @${handle} увидит её у себя в «Друзьях».` : answer.status === 'friends' ? `Теперь вы с @${handle} друзья.` : done
    else if (fr.bad) fr.note = ''
    fr.bad = false
    // Удалили последнего друга — выбирать больше некого
    if (!answer.friends.length && menu === 'friends:remove') {
      menuFrom = menu
      menu = 'friends'
    }
  }
  $.ui.invalidate('ui.render')
}

// «Добавить друга»: заявка по точному @нику. Ник не того вида или свой — сразу здесь, заявку на это не тратим
async function addFriend($, text) {
  const handle = normalHandle(text)
  if (!handle || fr.busy) return
  const problem = !HANDLE.test(handle) ? 'invalid' : handle === acct.handle ? 'self' : ''
  if (problem) {
    fr.note = friendsNote(problem, handle)
    fr.bad = true
    return $.ui.invalidate('ui.render')
  }
  await friendsCall($, 'friends', { handle }, handle)
}

// --- Чаты: с друзьями один на один и в группах ---------------------------------------------------------------------
const CHAT_POLL_MS = 4_000 // открытый чат: новые сообщения
const CHATS_POLL_MS = 15_000 // список чатов: новые чаты и непрочитанные
const UNREAD_POLL_MS = 60_000 // в остальной библиотеке — сколько непрочитанных, для плитки «Чаты»
const CHAT_KEPT = 1000 // сколько сообщений открытого чата держим в памяти

// Почему с чатами не вышло; group — создавали группу: у групп свой предел на сутки
function chatNote(error, group = false) {
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
  return accountNote(error)
}

// Кто это в чате: @ник; ника нет — аккаунт удалён
function chatPerson(id) {
  if (ch.names[id]) return `@${ch.names[id]}`
  if (id && id === ch.me && acct.handle) return `@${acct.handle}`
  return tr('удалённый аккаунт', lang)
}

// Название чата: с другом — его @ник, группы — её название
const chatTitle = (chat) => (chat.kind === 'dm' ? chatPerson(chat.with) : chat.name || tr('Группа', lang))

// Служебное сообщение словами на языке интерфейса: шаблон переводится, ники и название группы — нет
function serviceText(m) {
  const d = describe(m)
  const named = m.k === 'create' || m.k === 'name'
  return fill(tr(d.text, lang), d.values.map((v, k) => (k === 1 && named ? v : chatPerson(v))))
}

// Переписка вместе с новыми сообщениями: без повторов, по порядку номеров
function mergeMessages(old, fresh) {
  const all = new Map(old.map((m) => [m.s, m]))
  for (const m of fresh) all.set(m.s, m)
  return [...all.values()].sort((a, b) => a.s - b.s)
}

// Название группы из поля: одной строкой, не длиннее MAX_NAME
const groupTitle = (text) => [...oneLine(text)].slice(0, MAX_NAME).join('')

// Вопрос к сайту про чаты, ответ разбирает parse; с body — POST. Сайт не принял ключ сессии — забываем вход. Вход
// пропал или сменился, пока ждали, — null: ответ уже не нужен
async function chatFetch($, name, parse, { body, query } = {}) {
  const session = acct.session
  if (!session) return null
  const answer = parse(await accountFetch($, name, { method: body === undefined ? 'GET' : 'POST', body, query, token: session.token }))
  if (acct.session !== session) return null
  if (answer.error !== 'auth') return answer
  await forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  return null
}

// Список чатов; quiet — по таймеру: заметку не трогаем и перерисовываем, только если что-то поменялось
async function loadChats($, quiet = false) {
  if (!acct.session || ch.loading) return
  ch.loading = true
  if (!quiet) $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'chats', parseChats)
  if (!answer) return
  ch.loading = false
  if (answer.error) {
    if (quiet) return
    ch.note = chatNote(answer.error)
    ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  const before = JSON.stringify([ch.list, ch.names, acct.unread])
  ch.list = answer.chats
  ch.names = { ...ch.names, ...answer.names }
  ch.me = answer.me
  acct.unread = answer.unread
  if (!quiet || JSON.stringify([ch.list, ch.names, acct.unread]) !== before) $.ui.invalidate('ui.render')
}

// Открыть чат: последние сообщения с сайта; сайт заодно отмечает их прочитанными
async function openChat($, id) {
  if (!acct.session) return
  const request = ++ch.request
  if (menu !== 'chats:talk') {
    menuFrom = menu
    menu = 'chats:talk'
  }
  libraryNotice = ''
  // Поле «Сообщение» — новое: недописанное в другом чате сюда не переходит
  Object.assign(ch, { talk: id, about: null, messages: [], first: 0, shown: CHAT_SHOWN, opening: true, older: false, note: '', bad: false, confirmLeave: false, field: ch.field + 1 })
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'messages', parseMessages, { query: { chat: id } })
  if (!answer || request !== ch.request) return
  ch.opening = false
  if (answer.error) {
    ch.note = chatNote(answer.error)
    ch.bad = true
  } else {
    ch.me = answer.me
    ch.about = answer.chat
    ch.messages = answer.messages
    ch.first = answer.first
    ch.names = { ...ch.names, ...answer.names }
    acct.unread = answer.unread
    const entry = ch.list?.find((c) => c.id === id)
    if (entry) entry.unread = 0
  }
  $.ui.invalidate('ui.render')
}

// Новые сообщения открытого чата — по таймеру, пока он на экране. Ошибки молча: спросим ещё раз; только если чата
// больше нет — заметка, и спрашивать перестаём
async function pollChat($) {
  const id = ch.talk
  if (!acct.session || ch.polling || ch.opening || ch.about?.id !== id) return
  ch.polling = true
  const after = String(ch.messages.at(-1)?.s ?? 0)
  const answer = await chatFetch($, 'messages', parseMessages, { query: { chat: id, after } })
  if (!answer) return
  ch.polling = false
  if (ch.talk !== id || ch.about?.id !== id) return
  if (answer.error) {
    if (answer.error !== 'gone') return
    ch.about = null
    ch.note = chatNote('gone')
    ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  const before = JSON.stringify([ch.about, ch.messages.length, ch.messages.at(-1)?.s, acct.unread])
  ch.messages = mergeMessages(ch.messages, answer.messages).slice(-CHAT_KEPT)
  ch.about = answer.chat
  ch.names = { ...ch.names, ...answer.names }
  acct.unread = answer.unread
  if (JSON.stringify([ch.about, ch.messages.length, ch.messages.at(-1)?.s, acct.unread]) !== before) $.ui.invalidate('ui.render')
}

// Есть ли сообщения раньше показанных: уже загруженные или ещё на сайте
const olderShown = () => ch.messages.length > ch.shown || (ch.messages.length > 0 && ch.messages.length < CHAT_KEPT && ch.messages[0].s > ch.first)

// «Раньше»: показать ещё CHAT_SHOWN сообщений; загруженные кончились — спросить у сайта более ранние
async function olderMessages($) {
  const id = ch.talk
  if (ch.messages.length > ch.shown) {
    ch.shown += CHAT_SHOWN
    return $.ui.invalidate('ui.render')
  }
  if (!acct.session || ch.older || !olderShown()) return
  ch.older = true
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'messages', parseMessages, { query: { chat: id, before: String(ch.messages[0].s) } })
  if (!answer) return
  ch.older = false
  if (ch.talk !== id) return
  if (answer.error) {
    ch.note = chatNote(answer.error)
    ch.bad = true
  } else {
    ch.messages = mergeMessages(answer.messages, ch.messages)
    ch.names = { ...ch.names, ...answer.names }
    ch.shown += CHAT_SHOWN
  }
  $.ui.invalidate('ui.render')
}

// Отправить сообщение из поля «Сообщение». Ушло — поле новое, пустое, и фокус снова в нём; нет — текст остаётся в поле
async function sendMessage($, value) {
  const id = ch.talk
  const text = cleanText(value).trim()
  if (!text || !acct.session || ch.busy || ch.about?.id !== id) return
  if (text.length > MAX_TEXT) {
    ch.note = chatNote('long')
    ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  ch.busy = 'send'
  ch.note = ''
  ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'send', parseSent, { body: { chat: id, text } })
  if (!answer) return
  ch.busy = ''
  if (ch.talk !== id) return $.ui.invalidate('ui.render')
  if (answer.error) {
    ch.note = chatNote(answer.error)
    ch.bad = true
    if (answer.error === 'gone') ch.about = null
  } else {
    ch.messages = mergeMessages(ch.messages, [answer.msg]).slice(-CHAT_KEPT)
    ch.field++
    const key = `arcade-chat-input-${ch.field}`
    $.clock.after(50, async () => {
      try {
        await $.ui.focus({ requestId: PANE, key })
      } catch {
        // панель уже закрыли или поле не на экране
      }
    })
  }
  $.ui.invalidate('ui.render')
}

// «Написать» другу: чат двоих у пары один, сайт отдаёт его или заводит новый
async function openDm($, friend) {
  if (!acct.session || ch.busy) return
  ch.busy = 'open'
  ch.note = ''
  ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'opendm', parseChat, { body: { with: friend } })
  if (!answer) return
  ch.busy = ''
  if (answer.error || !answer.chat) {
    ch.note = chatNote(answer.error || 'down')
    ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  await openChat($, answer.chat.id)
}

// «Создать группу» из отмеченных друзей; all — «Группа со всеми друзьями» (без своего названия — «Все друзья»)
async function createGroup($, all = false) {
  if (!acct.session || ch.busy) return
  const friends = fr.list?.friends ?? []
  const members = [...ch.picked].filter((id) => friends.some((p) => p.id === id))
  const name = groupTitle(ch.groupName) || (all ? tr('Все друзья', lang) : '')
  const problem = all ? (friends.length ? '' : 'nobody') : !members.length ? 'empty' : !name ? 'name' : ''
  if (problem) {
    ch.note = problem === 'nobody' ? 'Друзей пока нет — добавь кого-нибудь по @нику.' : chatNote(problem)
    ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  ch.busy = 'group'
  ch.note = ''
  ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'group', parseChat, { body: all ? { name, all: true } : { name, members } })
  if (!answer) return
  ch.busy = ''
  if (answer.error || !answer.chat) {
    ch.note = chatNote(answer.error || 'down', true)
    ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  ch.picked = new Set()
  ch.groupName = ''
  ch.field++
  await openChat($, answer.chat.id)
}

// Участники и название группы: добавить, убрать, переименовать — может хозяин; выйти — любой. done — заметка, если вышло
async function changeMembers($, body, done = '') {
  const id = ch.talk
  if (!acct.session || ch.busy || ch.about?.id !== id) return
  ch.busy = 'members'
  ch.note = ''
  ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'members', parseChat, { body: { chat: id, ...body } })
  if (!answer) return
  ch.busy = ''
  if (ch.talk !== id) return $.ui.invalidate('ui.render')
  if (answer.error || (!answer.left && !answer.chat)) {
    ch.note = chatNote(answer.error || 'down')
    ch.bad = true
    if (answer.error === 'gone') ch.about = null
  } else if (answer.left) {
    // Вышел — чата у человека больше нет: назад к списку
    Object.assign(ch, { talk: '', about: null, messages: [], confirmLeave: false, note: 'Ты больше не в этой группе.', bad: false })
    menuFrom = menu
    menu = 'chats'
    loadChats($, true).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
  } else {
    ch.about = answer.chat
    ch.note = done
    ch.field++
    // Служебное сообщение о перемене — в переписку сразу
    pollChat($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
  }
  $.ui.invalidate('ui.render')
}

// «Переименовать»: то же название — сайт не спрашиваем
async function renameGroup($, value) {
  const name = groupTitle(value)
  if (!name) {
    ch.note = chatNote('name')
    ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  if (name !== ch.about?.name) await changeMembers($, { name }, 'Название группы изменено.')
}

// «Выйти из группы»: первое нажатие спрашивает «точно?», второе — выходит
async function leaveGroup($) {
  if (!ch.confirmLeave) {
    ch.confirmLeave = true
    ch.note = ''
    return $.ui.invalidate('ui.render')
  }
  ch.confirmLeave = false
  await changeMembers($, { leave: true })
}

// Сколько непрочитанных — для плитки «Чаты», пока сами чаты не открыты
async function checkUnread($) {
  if (!acct.handle) return
  const answer = await chatFetch($, 'unread', parseUnread)
  if (!answer || answer.error || answer.unread === acct.unread) return
  acct.unread = answer.unread
  $.ui.invalidate('ui.render')
}

// «Открыть на странице»: страница чатов на сайте — во встроенном браузере Claude или в окне браузера. Ключ сессии
// туда не идёт: сайт выдаёт код ссылки на 10 минут и на один раз, страница обменяет его на свой билет
async function openChatPage($, surface) {
  const page = `${SITE}/chat`
  const builtin = builtinBrowser(surface)
  // Страницу чатов Claude уже открывает по просьбе Arcade или она ждёт конца шага: второй раз ход не прерываем
  const waiting = [asking, pendingOpen].find((url) => String(url ?? '').startsWith(page))
  if (builtin && waiting) return desktopNotice($, asking === waiting ? 'asking' : compacting ? 'compacting' : 'waiting', '', waiting)
  if (!acct.session || ch.busy) return
  ch.busy = 'page'
  ch.note = ''
  ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'chatticket', parseLink, { body: { link: true } })
  if (!answer) return
  ch.busy = ''
  if (answer.error) {
    ch.note = chatNote(answer.error)
    ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  chatLink = answer.link
  if (builtin) return desktopWindow($, 'chat', 'Чаты открыты во встроенном браузере Claude.')
  if (!platform) {
    libraryNotice = 'Окно браузера пока не открыть — попробуй через пару секунд.'
    return $.ui.invalidate('ui.render')
  }
  libraryNotice = 'Открываю окно…'
  $.ui.invalidate('ui.render')
  const command = windowCommand('chat')
  try {
    const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
    windowNotice($, launchNotice(result, 'chat'))
    if (result?.exitCode === 0) windowOpenedAt = await $.clock.now()
  } catch (err) {
    libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
  }
  $.ui.invalidate('ui.render')
}

// «Выйти»: забыть вход здесь и сказать сайту, что ключ сессии больше не нужен; что ответит сайт, неважно
async function logout($) {
  const token = acct.session?.token
  if (!token) return
  await forgetSession($, 'Выход выполнен: на этом компьютере настройки больше не синхронизируются.')
  await accountFetch($, 'logout', { method: 'POST', token })
}

// «Удалить аккаунт»: первое нажатие спрашивает «точно?», второе — просит сайт забыть человека и его настройки
async function deleteAccount($) {
  const session = acct.session
  if (!session) return
  if (!acct.confirmDelete) {
    acct.confirmDelete = true
    acct.note = ''
    return $.ui.invalidate('ui.render')
  }
  acct.confirmDelete = false
  acct.note = 'Удаляю аккаунт…'
  $.ui.invalidate('ui.render')
  const error = parseDone(await accountFetch($, 'me', { method: 'DELETE', token: session.token }))
  if (acct.session !== session) return
  if (error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (!error) return forgetSession($, 'Аккаунт удалён: сайт Arcade забыл тебя и твои настройки. Здесь настройки остались.')
  acct.note = accountNote(error)
  $.ui.invalidate('ui.render')
}

// Страница GitHub для кода — в обычном браузере: встроенный браузер Desktop открывает только страницы сайта Arcade
async function openGithub($, url) {
  const command = openUrlCommand(platform, url)
  let opened = false
  if (command) {
    try {
      opened = (await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS }))?.exitCode === 0
    } catch {
      // не открылся — адрес и так написан в меню
    }
  }
  if (opened) windowNotice($, 'Открываю GitHub в браузере — введи там код.')
  else libraryNotice = 'Браузер не открылся — открой адрес выше сам.'
  $.ui.invalidate('ui.render')
}

// Темы: haiku читает последнюю работу агента; работы ещё нет или модель не ответила — темы по умолчанию
async function loadTopics($) {
  const request = ++yt.request
  yt.loading = 'topics'
  $.ui.invalidate('ui.render')
  const now = await $.clock.now()
  const list = await ytChannels($, now)
  let text = ''
  try {
    const context = contextFrom(await $.session.messages())
    if (context) {
      const answer = await $.model.complete({ model: 'haiku', ...topicsPrompt(context, lang, list.directions), maxTokens: 400, timeoutMs: YT_MODEL_MS })
      if (answer.isAnswered) text = answer.text
      else log(`темы YouTube: модель не ответила (${answer.reason})`)
    }
  } catch (err) {
    log(`темы YouTube не подобраны: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  if (request !== yt.request) return
  yt = { ...yt, topics: parseTopics(text, list.directions), topicsAt: now, topicsLang: lang, topic: -1, videos: [], seen: new Set(), loading: '', note: '' }
  // Темы новые — подборки статей и подкастов по старым темам не нужны, и их загрузки тоже
  reads = { articles: emptyReads(reads.articles.request + 1), podcasts: emptyReads(reads.podcasts.request + 1) }
  $.ui.invalidate('ui.render')
}

// Подборка по теме: ленты каналов темы → свежие кандидаты → haiku выбирает. Своя тема — ещё и поиск сайта по её
// запросу: найденное идёт к английским видео вперемешку с лентами каналов по направлениям темы. again — другая
// подборка: уже показанные видео не повторяем, пока есть из чего выбрать
async function loadVideos($, key, again = false) {
  const topic = topicOf(key)
  if (!topic) return
  const request = ++yt.request
  const seen = again && yt.topic === key ? new Set([...yt.seen, ...yt.videos.map((v) => v.id)]) : new Set()
  yt = { ...yt, topic: key, videos: [], loading: 'videos', note: '' }
  $.ui.invalidate('ui.render')
  const now = await $.clock.now()
  let videos = []
  let note = ''
  let used = seen
  try {
    const list = await ytChannels($, now)
    const pool = async (channels, direction) => candidates(await Promise.all(channels.map((c) => ytFeed($, c.id, now))), direction, now)
    const byDirection = (direction) => {
      const { local, en } = channelsFor(list, direction, lang, now)
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
      const answer = await $.model.complete({ model: 'haiku', ...picksPrompt(topic, mine, english, lang), maxTokens: 300, timeoutMs: YT_MODEL_MS })
      if (answer.isAnswered) ranked = parsePicks(answer.text, [...mine, ...english])
      else log(`видео YouTube: модель не ответила (${answer.reason})`)
      videos = choose(ranked, mine, english)
    }
  } catch (err) {
    note = `Не получилось загрузить видео: ${String(err?.message ?? err).slice(0, 200)}`
  }
  if (request !== yt.request) return
  yt = { ...yt, videos, seen: used, loading: '', note }
  $.ui.invalidate('ui.render')
}

// --- Статьи и подкасты: те же темы, записи — из открытых RSS- и Atom-лент ---------------------------------------
// Список лент: сохранённый, если свежий, иначе с сайта; сайт не ответил — старый сохранённый или запас мода
async function feedsList($, now) {
  let stored = null
  try {
    const saved = await $.store.get('feedsList')
    stored = saved?.list ? parseFeeds(saved.list) : null
    if (stored && now - saved.at < CHANNELS_TTL_MS) return stored
    const response = await fetchWithin($, siteUrl('feeds.json'), YT_FETCH_MS)
    const fresh = response?.ok ? parseFeeds(response.text) : null
    if (fresh) {
      await $.store.set('feedsList', { at: now, list: fresh })
      return fresh
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
async function loadReads($, kind, key, again = false) {
  const topic = topicOf(key)
  if (!topic) return
  const was = reads[kind]
  const request = was.request + 1
  const seen = again && was.topic === key ? new Set([...was.seen, ...was.items.map((x) => x.id)]) : new Set()
  reads = { ...reads, [kind]: { ...was, topic: key, items: [], loading: true, note: '', request } }
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
  if (request !== reads[kind].request) return
  reads = { ...reads, [kind]: { ...reads[kind], items, seen: used, loading: false, note } }
  $.ui.invalidate('ui.render')
}

// Варианты «где открывать» по кругу: браузер по умолчанию, каждый найденный браузер, панель
function openerOptions() {
  const browsers = platform === 'windows' ? detection?.browsers ?? [] : []
  return [
    { opener: 'window', browser: 'default' },
    ...browsers.map((b) => ({ opener: 'window', browser: b.id })),
    { opener: 'pane', browser: browserChoice },
  ]
}

// В Desktop: встроенный браузер приложения, окно браузера по умолчанию, окно каждого найденного браузера.
// Каким браузером открывать окно — общий выбор с терминалом
function desktopOptions() {
  return [{ opener: 'builtin', browser: browserChoice }, ...openerOptions().filter((o) => o.opener === 'window')]
}

function desktopLabel() {
  return builtinBrowser('desktop') ? 'Открывать: встроенный браузер Claude' : windowLabel()
}

function openerLabel() {
  return windowMode() ? windowLabel() : 'Открывать: здесь, в панели'
}

function windowLabel() {
  if (platform !== 'windows') return 'Открывать: окно браузера по умолчанию'
  const searching = detection === null ? ' (ищу браузеры…)' : ''
  const browsers = detection?.browsers ?? []
  if (browserChoice !== 'default') {
    const chosen = browsers.find((b) => b.id === browserChoice)
    if (chosen) return `Открывать: окно ${chosen.name}${chosen.app ? '' : ' (обычное окно браузера)'}`
  }
  const fallback = browsers.find((b) => b.id === detection?.defaultId)
  return `Открывать: окно браузера по умолчанию${fallback ? ` (${fallback.name})` : ''}${searching}`
}

function plural(n, one, few, many) {
  const tens = n % 100
  const units = n % 10
  if (tens >= 11 && tens <= 14) return many
  if (units === 1) return one
  if (units >= 2 && units <= 4) return few
  return many
}

function consoleNote(c) {
  const count = c.group === undefined && groupsList().some((g) => g.id === c.id)
    ? games().filter((g) => groupConsoles(c.id).includes(g.console) && !g.mine).length
    : games().filter((g) => g.console === c.id && !g.mine).length
  // У книг — «136 книг», а не «136 игр»
  const list = c.group === undefined && groupsList().some((g) => g.id === c.id) ? games().filter((g) => groupConsoles(c.id).includes(g.console) && !g.mine) : games().filter((g) => g.console === c.id && !g.mine)
  const audio = list.length > 0 && list.every((g) => ['audio', 'audio-mine'].includes(g.kind))
  const books = list.length > 0 && list.every((g) => ['book', 'audio', 'audio-mine'].includes(g.kind)) // книги и аудиокниги
  return count ? `${count} ${audio ? plural(count, 'аудиокнига', 'аудиокниги', 'аудиокниг') : books ? plural(count, 'книга', 'книги', 'книг') : plural(count, 'игра', 'игры', 'игр')}` : 'скоро'
}

function settingsNote(surface) {
  if (surface === 'desktop') return desktopLabel().replace('Открывать: ', 'открывать: ')
  const where = windowMode() ? openerLabel().replace('Открывать: ', 'открывать: ') : 'играть здесь, в панели'
  return windowMode() ? where : `${where} · графика: ${GRAPHICS_LABEL[graphics]}`
}

function libraryTitle() {
  if (menu === 'settings') return 'Arcade · настройки'
  if (menu === 'lang') return 'Arcade · язык'
  if (menu === 'account') return 'Arcade · аккаунт'
  if (menu === 'friends' || menu.startsWith('friends:')) return 'Arcade · друзья'
  if (menu === 'chats' || menu.startsWith('chats:')) return 'Arcade · чаты'
  if (menu === 'youtube' || menu.startsWith('youtube:')) return 'Arcade · YouTube'
  if (menu === 'articles' || menu.startsWith('articles:')) return 'Arcade · Статьи'
  if (menu === 'podcasts' || menu.startsWith('podcasts:')) return 'Arcade · Подкасты'
  if (menu === 'twitch' || menu.startsWith('twitch:')) return 'Arcade · Twitch'
  if (menu.startsWith('genre:')) return `Arcade · ${shelfView(`shelf:${menu.split(':')[1]}`)?.title ?? ''} · ${genreLabel(menu.split(':').slice(2).join(':'))}`
  if (menu === 'mine') return 'Arcade · мои игры'
  const c = consoles().find((x) => x.id === menu) ?? groupsList().find((x) => x.id === menu) ?? shelfView(menu)
  return c ? `Arcade · ${c.title}` : 'Arcade'
}

// Где откроется игра — для подсказки под списком игр
function whereText() {
  if (platform !== 'windows') return 'в окне браузера по умолчанию'
  const browsers = detection?.browsers ?? []
  if (browserChoice !== 'default') {
    const chosen = browsers.find((b) => b.id === browserChoice)
    if (chosen) return chosen.app ? `в окне ${chosen.name}` : `в обычном окне ${chosen.name}`
  }
  const fallback = browsers.find((b) => b.id === detection?.defaultId)
  return `в окне браузера по умолчанию${fallback ? ` (${fallback.name})` : ''}`
}

function first(id) {
  return keymap[id].find((k) => !ARROWS.includes(k)) ?? keymap[id][0] ?? '?'
}

// Добавить свою игру: путь → сообщение для меню. Копия файла — в папку данных, запись — в «Мои игры».
// Файл никуда не отправляется. Вызывают команда /arcade-add и поле «Добавить файл» в меню.
async function addMine($, rawPath) {
  const path = cleanPath(rawPath)
  let message
  if (!path) {
    message = 'Укажи путь к файлу: /arcade-add C:\\Games\\game.nes — или перетащи файл в терминал после команды.'
  } else if (!dataDir) {
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
      if (mine.some((m) => m.sha256 === sha)) {
        message = `«${title}» уже есть в «Моих играх».`
      } else {
        await $.fs.write(mineFile(sha), base64)
        mine = [...mine, { id: mineId(sha), console: info.console, title, sha256: sha }]
        await $.store.set('mine', mine)
        message = `Добавлено: ${title} (${CONSOLE_NAMES[info.console]}).`
      }
    } catch (err) {
      message = `Не получилось добавить: ${err?.message ?? err}`
    }
  }
  return message
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    try {
      // Модуль перезагрузили (/reload-plugins, обновление), а панель осталась открытой: движок её помнит, а наш флаг — нет.
      // Без этого после перезагрузки панель не закрывалась, когда Claude открывал игру во встроенном браузере
      paneOpen = (await $.ui.panes().catch(() => [])).some((p) => p.id === PANE)
      // Общие настройки (SYNC_KEYS): чего в $.store нет или что не подходит — остаётся по умолчанию
      for (const key of SYNC_KEYS) if (applySetting(key, await $.store.get(key))) savedKeys.add(key)
      if (!savedKeys.has('lang')) lang = detectLang(await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG'))
      stamps = restoreStamps(await $.store.get('syncAt'))
      acct.session = restoreAccount(await $.store.get('account'))
      mine = restoreMine(await $.store.get('mine'))
      const home = (await $.env.get('USERPROFILE')) || (await $.env.get('HOME'))
      if (home) {
        sep = home.includes('\\') ? '\\' : '/'
        dataDir = [home.replace(/[\\/]+$/, ''), '.claude', 'arcade', 'roms'].join(sep)
      }
      catalog = restoreCatalog(await $.store.get('catalog')) ?? catalog
      const savedGame = await $.store.get('lastGame')
      played = games().some((g) => g.id === savedGame)
      if (played) lastGame = savedGame
      const savedGraphics = await $.store.get('graphics')
      if (GRAPHICS.includes(savedGraphics)) graphics = savedGraphics
      const savedOpener = await $.store.get('opener')
      if (savedOpener?.opener === 'window' || savedOpener?.opener === 'pane') opener = savedOpener.opener
      // Браузер Desktop сохраняет и без выбора терминала (opener — null)
      if (typeof savedOpener?.browser === 'string') browserChoice = savedOpener.browser
      if ((await $.store.get('desktopOpener')) === 'window') desktopOpener = 'window'
      const localAppData = await $.env.get('LOCALAPPDATA')
      profileRoot = localAppData ? `${localAppData}\\claude-arcade` : ''
      if ((await $.env.get('OS')) === 'Windows_NT') platform = 'windows'
      // Кто ждёт в сети — раз в минуту; первый раз — сразу после каталога
      const pollLobbies = async () => {
        try {
          const response = await $.http.fetch(siteUrl('api/lobbies'))
          if (!response.ok) return
          const fresh = waitingFrom(JSON.parse(response.text))
          if (JSON.stringify(fresh) !== JSON.stringify(netWaiting)) {
            netWaiting = fresh
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
      // Чаты — пока панель открыта на библиотеке и человек вошёл: открытый чат спрашиваем часто, список — реже, в
      // остальной библиотеке — только сколько непрочитанных, для плитки «Чаты»
      const chatsOn = () => paneOpen && acct.session && view === 'library'
      const chatError = (err) => log(`ошибка мода: ${err?.message ?? err}`)
      $.clock.every(CHAT_POLL_MS, () => {
        if (chatsOn() && menu === 'chats:talk') pollChat($).catch(chatError)
      })
      $.clock.every(CHATS_POLL_MS, () => {
        if (chatsOn() && menu === 'chats') loadChats($, true).catch(chatError)
      })
      $.clock.every(UNREAD_POLL_MS, () => {
        if (chatsOn() && !menu.startsWith('chats')) checkUnread($).catch(chatError)
      })
      // Каталог с сайта и ОС — в фоне, чтобы не держать старт сессии
      $.clock.after(150, async () => {
        try {
          const response = await $.http.fetch(siteUrl('catalog.json'))
          const fresh = response.ok ? parseCatalog(response.text) : null
          if (fresh) {
            catalog = fresh
            await $.store.set('catalog', { consoles: fresh.consoles, groups: fresh.groups, shelves: fresh.shelves, support: fresh.support, games: fresh.games })
            $.ui.invalidate('ui.render')
          }
        } catch (err) {
          log(`каталог с сайта не получен: ${err?.message ?? err}`)
        }
      })
      if (!platform) {
        $.clock.after(100, async () => {
          try {
            const result = await $.process.run(['uname', '-s'], { timeoutMs: 5000 })
            const name = result.stdout.trim()
            if (name === 'Darwin') platform = 'mac'
            if (name === 'Linux') platform = 'linux'
            $.ui.invalidate('ui.render')
          } catch {
            // Нет uname — не macOS и не Linux; играем в панели
          }
        })
      }
      // Браузеры на Windows ищем в фоне: PowerShell стартует за полсекунды, сессию из-за него не держим
      if (platform === 'windows') {
        $.clock.after(100, async () => {
          try {
            const result = await $.process.run(DETECT_ARGV, { timeoutMs: LAUNCH_TIMEOUT_MS })
            detection = parseDetection(result.stdout)
          } catch (err) {
            detection = { browsers: [], defaultId: null, screen: null }
            log(`не удалось найти браузеры: ${err?.message ?? err}`)
          }
          $.ui.invalidate('ui.render')
        })
      }
      await $.command.register({ name: 'arcade', description: tr('Открыть Arcade', lang), immediate: true })
      await $.command.register({
        name: 'arcade-add',
        description: tr('Arcade: добавить свою игру — файл ROM Денди или Sega', lang),
        argumentHint: tr('путь к файлу .nes, .md или .bin', lang),
        immediate: true,
      })
      // Раз в секунду: проверить порог вопроса и обновить счётчик секунд
      $.clock.every(1000, async () => {
        const now = await $.clock.now()
        if (status === 'working' && !asked && !paneOpen && now - turnStartedAt >= ASK_AFTER_MS) {
          askVisible = true
        }
        if (askVisible || paneOpen) $.ui.invalidate('ui.render')
      })
      // Игровой цикл Денди: идёт, только пока открыта панель с игрой.
      // В Desktop и VS Code кадр уходит перерисовкой панели (Svg), в терминале — через $.ui.blit.
      $.clock.every(TICK_MS, async () => {
        if (!nesView() || !paneOpen || !nes || paused) return
        if (remoteSurface) {
          stepNes()
          $.ui.invalidate('ui.render')
          return
        }
        if (!screen) return
        stepNes()
        const pixels = pixelMode()
        let shown = false
        try {
          const result = await $.ui.blit({ requestId: PANE, key: 'arcade-screen', columns: screen.columns, rows: screen.rows, ...screenContent() })
          shown = !result?.deny
        } catch {
          // Экран ещё не нарисован, панель закрывается или терминал не показывает картинки
        }
        if (shown) {
          denies = 0
          return
        }
        denies += 1
        if (pixels && graphics === 'auto' && denies >= PIXEL_DENIES) {
          pixelsFailed = true
          denies = 0
          notice = 'Этот терминал не показывает картинки — рисую символами. Как получить пиксели — в README.'
          $.ui.invalidate('ui.render')
        }
      })
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId) return next(e) // ход субагента — не ход агента: Claude как работал, так и работает
    try {
      agentTurn = e.turnId
      toolsRunning = 0
      interrupting = false
      status = 'working'
      turnStartedAt = await $.clock.now()
      asked = false
      askVisible = false
      agentAlert = null
      paused = false
      log('агент начал ход')
      if (DEBUG) await $.ui.toast('arcade: агент начал ход')
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    try {
      status = 'permission'
      askVisible = false
      if (paneOpen && view !== 'library') {
        agentAlert = 'permission'
        if (onPermission === 'pause') {
          paused = true
          releaseAll()
        }
        if (onPermission === 'close') await $.ui.close({ id: PANE })
      }
      log(`запрос разрешения: ${e.tool_name ?? 'инструмент'}`)
      const now = await $.clock.now()
      const command = osNotify && windowOpenedAt && now - windowOpenedAt < NOTIFY_WINDOW_MS
        ? notifyCommand(platform, 'Claude Code', tr('Агент ждёт разрешения', lang))
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
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return next(e)
  })

  on('classic.PostToolUse', async ($, e, next) => {
    try {
      if (status === 'permission') {
        status = 'working'
        log('агент снова работает')
        $.ui.invalidate('ui.render')
      }
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e) // субагент закончил — агент ещё нет: «агент закончил» не про него
    agentTurn = null
    toolsRunning = 0
    // Ход оборвал Arcade, чтобы открыть игру: агент сейчас же продолжит по просьбе Arcade
    if (interrupting) {
      interrupting = false
      return next(e)
    }
    // Ход с просьбой Arcade кончился: открыл Claude игру или нет, следующее нажатие просит заново
    asking = null
    try {
      // Игра ждала конца инструмента, а ход кончился сам — прерывать нечего, просим как обычно
      if (pendingOpen) {
        const url = pendingOpen
        pendingOpen = null
        desktopNotice($, await askClaude($, url, true), '', url)
      }
      status = 'done'
      askVisible = false
      if (paneOpen && view !== 'library') {
        agentAlert = 'done'
        if (onDone === 'pause') {
          paused = true
          releaseAll()
        }
        if (onDone === 'close') await $.ui.close({ id: PANE }) // панель закрывается — игра встаёт на паузу, клавиатура у Claude Code
      }
      log('агент закончил ход')
      if (paneOpen) await $.ui.toast(tr('Агент закончил — Esc, чтобы вернуться', lang))
      // Играешь в окне браузера — Claude Code не видно: системное уведомление, если ход был долгим
      const now = await $.clock.now()
      const command = osNotify && windowOpenedAt && now - windowOpenedAt < NOTIFY_WINDOW_MS && now - turnStartedAt >= NOTIFY_AFTER_MS
        ? notifyCommand(platform, 'Claude Code', tr('Агент закончил — можно возвращаться', lang))
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
    compacting = true
    try {
      return await next(e)
    } finally {
      compacting = false
      if (pendingOpen) $.clock.after(0, () => openPending($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`)))
    }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      paneOpen = false
      agentAlert = null
      paused = false // закрытая панель и так стоит на паузе
      releaseAll() // Денди стоит на паузе, пока панель закрыта
    }
    return next(e)
  })

  // Встроенный браузер Desktop по нажатию в панели: свои вызовы Arcade разрешает сам, иначе авто-режим отдаёт их
  // классификатору, и тот отказывает — просил не человек словами. Только вызовы самого Arcade и только то, что
  // пропускает ownDesktopCall; эти же инструменты у Claude решаются как обычно. Разрешаем только то, о чём спросили бы
  // человека: правило в настройках (разрешить или запретить) отдаём как есть — встроенная защита Claude Code
  // (cc-plugin-sec-default, на Team и Enterprise) переписанное модом правило считает обходом и пишет об этом в чат
  on('tool.check', { tool: DESKTOP_TOOLS }, async ($, e, next) => {
    if (next.origin.plugin !== $.plugin.name || !ownDesktopCall(e.tool, e.input)) return next(e)
    const decided = await next(e)
    if (decided?.decision !== 'ask') return decided
    return { decision: 'allow', reason: 'Arcade открывает игру во встроенном браузере по нажатию в своей панели' }
  })

  // Инструменты агента (главного цикла; свои вызовы Arcade — нет): игру, которую надо открыть, пока агент работает,
  // открываем, когда закончится текущий — оборванный посреди инструмент может оставить работу недоделанной. Дольше
  // CUT_TOOL_MS не ждём: обрываем (cutPending)
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined || next.origin?.plugin === $.plugin.name) return next(e)
    toolsRunning++
    try {
      return await next(e)
    } finally {
      toolsRunning = Math.max(0, toolsRunning - 1)
      // Ход прерываем после того, как результат инструмента дойдёт до агента
      if (pendingOpen && toolsRunning === 0)
        $.clock.after(0, () => openPending($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`)))
    }
  })

  // Игру, которую Arcade попросил открыть Claude, открыли — браузеру нужно место
  on('tool.call', { tool: [`${BROWSER}preview_start`, `${BROWSER}navigate`] }, async ($, e, next) => {
    const result = await next(e)
    try {
      if (opening && typeof e.url === 'string' && e.url.startsWith(`${SITE}/`) && !result?.deny && !result?.isError)
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
    if (save) await saveSetting($, 'keys', keymap)
    if (flappyDirty) {
      flappyDirty = false
      await saveSetting($, 'flappyBest', flappyBest)
    }
    return {}
  })

  on('command.run', { command: 'arcade' }, async ($) => {
    markPaneOpen()
    await $.ui.open({ id: PANE, title: 'Arcade', focus: true, closeOnEscape: true, columns: paneColumns(), rows: PANE_ROWS })
    $.ui.invalidate('ui.render')
    return {}
  })

  // /arcade-add путь: копия файла — в папку данных, запись — в «Мои игры». Файл никуда не отправляется.
  on('command.run', { command: 'arcade-add' }, async ($, e) => {
    const message = await addMine($, e.args)
    libraryNotice = message
    if (view !== 'library') toLibrary()
    menu = 'mine'
    markPaneOpen()
    await $.ui.open({ id: PANE, title: 'Arcade', focus: true, closeOnEscape: true, columns: paneColumns(), rows: PANE_ROWS })
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
    if (!askVisible && e.surface === 'vscode' && paneOpen && nesView()) {
      const { Box, Input } = $.ui.resolve(e)
      bandId = e.requestId
      if (bandResetWanted) {
        // Значение меняется — VS Code перезаписывает поле, и набранное исчезает
        bandResetWanted = false
        bandToken = bandToken === '' ? '\u200b' : ''
        bandLength = bandToken.length
      }
      if (bandFocusWanted) {
        bandFocusWanted = false
        // Если полоса уже держит клавиатуру, ставим фокус в поле; если нет — VS Code откажет, и хватит одного клика
        $.clock.after(50, async () => {
          try {
            await $.ui.focus({ requestId: bandId, key: 'arcade-keys-band' })
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
            value: bandToken,
            autoFocus: true,
            onInput: async (value) => {
              const save = typedFrom(value)
              $.ui.invalidate('ui.render')
              if (save) await saveSetting($, 'keys', keymap)
              if (flappyDirty) {
                flappyDirty = false
                await saveSetting($, 'flappyBest', flappyBest)
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
    if (!askVisible || e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const now = await $.clock.now()
    const canWindow = (platform !== null || e.surface === 'desktop') && webGame(lastGame)
    return Box({
      flexDirection: 'row',
      columnGap: 2,
      children: [
        Text({ children: [`Агент работает ${workedText(workedSeconds(now))} — сыграть?${netWaiting.length ? ` В сети ждут: ${waitingText()}` : ''}`] }),
        // «Здесь» — панель Claude Code: в VS Code и Desktop картинкой, в терминале символами или пикселями.
        // «В окне» — браузер: в Desktop по настройке встроенный, иначе — программа браузера, когда ОС уже определена.
        Button({
          key: 'arcade-play',
          label: canWindow ? 'Здесь' : 'Играть',
          hotkey: '1',
          plain: true,
          onPress: async () => {
            markPaneOpen()
            await $.ui.open({ id: PANE, title: 'Arcade', focus: true, closeOnEscape: true, columns: paneColumns(), rows: PANE_ROWS })
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
                  asked = true
                  askVisible = false
                  if (builtinBrowser(e.surface, mouseGame(lastGame))) {
                    await desktopWindow($, lastGame, `${gameById(lastGame)?.title ?? lastGame} открыт во встроенном браузере Claude.`)
                    await $.ui.toast(tr(libraryNotice, lang))
                    return
                  }
                  const command = windowCommand(lastGame)
                  try {
                    const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                    windowNotice($, launchNotice(result, lastGame))
                    if (result?.exitCode === 0) windowOpenedAt = await $.clock.now()
                  } catch (err) {
                    libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
                  }
                  $.ui.invalidate('ui.render')
                  await $.ui.toast(tr(libraryNotice, lang))
                },
              }),
            ]
          : []),
        Button({
          key: 'arcade-later',
          label: 'Не сейчас',
          hotkey: canWindow ? '3' : '2',
          plain: true,
          onPress: () => {
            asked = true
            askVisible = false
            $.ui.invalidate('ui.render')
          },
        }),
      ],
    })
      })(),
      lang,
    ),
  )

  // Панель: библиотека игр или сама игра. Клавиши над экраном игры ловит Client (hooks/input.js)
  // после клика по экрану, в любой раскладке.
  on('ui.render', { component: 'Pane' }, async ($, e, next) =>
    translateTree(
      await (async () => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Raster, Image, Button: makeButton, Client, Svg, Input } = $.ui.resolve(e)
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
    const game = gameById(view)
    remoteSurface = terminal ? null : e.surface

    // Шапка: логотип (Desktop и VS Code), название, состояние агента цветом: работает — жёлтый, ждёт разрешения —
    // красный, закончил — зелёный, свободен — серый. Цвета — ключи темы: читаются и на светлой, и на тёмной
    const statusColor = status === 'permission' ? 'error' : status === 'working' ? 'warning' : status === 'done' ? 'success' : 'inactive'
    const header = Box({
      flexDirection: 'row',
      columnGap: 2,
      alignItems: 'center',
      children: [
        // логотип — только в главном меню библиотеки в Desktop: над экраном игры он не нужен
        ...(!game && menu === 'main' && e.surface === 'desktop' ? [Svg({ source: LOGO_SVG, alt: 'Arcade', width: 40, height: 40 })] : []),
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
      ],
    })
    // Журнал агента — с подписью и только когда в нём что-то есть: одинокое «пока ничего» внизу меню выглядело обломком
    const eventLines = events.length
      ? [Text({ bold: true, dimColor: true, children: ['Журнал агента'] }), ...events.slice(0, 3).map((text) => Text({ dimColor: true, children: [text] }))]
      : []

    if (!game) {
      // ROM для игры в панели: встроенный, из кеша мода или скачанный с сайта — всегда сверяется с хешем каталога
      const obtainRom = async (g) => {
        const sha = g.rom.sha256
        if (g.rom.mine) {
          const text = await $.fs.read(mineFile(sha)).catch(() => '')
          if (await verifyRom(text, sha)) return text.trim()
          libraryNotice = `Файл игры «${g.title}» не найден — добавь его снова: /arcade-add путь к файлу`
          return null
        }
        const bundled = bundledRom(sha)
        if (bundled) return bundled
        const cached = await $.store.get(`rom:${sha}`)
        if (await verifyRom(cached, sha)) return cached
        libraryNotice = `Скачиваю ${g.title}…`
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
          libraryNotice = ''
          return text
        } catch (err) {
          libraryNotice = `Не получилось скачать ${g.title}: ${err?.message ?? err}`
          return null
        }
      }
      // Игра открывается в окне браузера или здесь, в панели
      const playGame = async (g) => {
        // Всё, кроме Денди и своих игр, идёт только в окне браузера (EmulatorJS на сайте): в панели показать нечем
        const sega = Boolean(g.console) && g.console !== 'nes' && !g.engine // у «Проверки клавиш» приставки нет, а своя игра (Flappy Arcade) — в панели
        if (sega && builtinBrowser(e.surface, mouseGame(g.id))) {
          lastGame = g.id
          played = true
          await desktopWindow($, g.id, `${g.title} открыт во встроенном браузере Claude.`)
          await $.store.set('lastGame', g.id)
          return
        }
        if (sega && !platform) {
          libraryNotice = `Игры ${consoleTitle(g.console)} идут в окне браузера, а здесь его открыть нельзя.`
          $.ui.invalidate('ui.render')
          return
        }
        lastGame = g.id
        played = true
        if ((opensWindow(e.surface) || sega) && g.web) {
          libraryNotice = 'Открываю окно…'
          $.ui.invalidate('ui.render')
          const command = windowCommand(g.id)
          try {
            const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
            windowNotice($, launchNotice(result, g.id))
            if (result?.exitCode === 0) windowOpenedAt = await $.clock.now()
          } catch (err) {
            libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
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
        menuFrom = menu
        menu = id
        libraryNotice = ''
        $.ui.invalidate('ui.render')
      }
      const back = Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') })
      const dim = (text) => Text({ dimColor: true, children: [text] })
      const gap = Text({ children: [' '] })
      // Разделы и плитки главного меню: кнопка с подписью — в рамке; плитки рядами, в узкой панели — колонкой
      const desktop = e.surface === 'desktop'
      // В Desktop заголовок раздела — крупно, с отступом сверху от раздела выше и снизу от своих плиток
      const section = (title) => (desktop ? Box({ marginTop: 'lg', marginBottom: 'sm', children: [Text({ size: 'heading', weight: 'semibold', children: [title] })] }) : Text({ bold: true, dimColor: true, children: [title] }))
      // Своя тема в темах YouTube, статей и подкастов: поле ввода с подсказкой или заметкой, «Мои темы» плитками и
      // «Забыть мои темы». Названия своих тем — на языке интерфейса или как их написал человек (keep)
      const ownTopics = (kind, short, focus, hintText) => {
        const myTiles = myTopics.flatMap((t) => {
          const key = `u${t.id}`
          const button = Button({
            key: `arcade-${short}-own-${t.id}`,
            label: t.title,
            ...(key === focus ? { autoFocus: true } : {}),
            onPress: () => {
              open(`${kind}:${key}`)()
              if (kind === 'youtube') {
                if (yt.topic !== key || (!yt.videos.length && !yt.loading)) loadVideos($, key)
              } else if (reads[kind].topic !== key || (!reads[kind].items.length && !reads[kind].loading)) loadReads($, kind, key)
            },
          })
          return [keep(button), dim('  своя тема')]
        })
        return [
          gap,
          Input({ key: `arcade-${short}-own`, label: 'Своя тема', placeholder: 'о чём угодно: история Рима, хлеб на закваске…', onSubmit: (value) => addTopic($, kind, value) }),
          dim(ownNote.kind === kind && ownNote.text ? ownNote.text : hintText),
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
        const game = key.startsWith('arcade-game-') ? gameById(key.slice(12)) : key === 'arcade-continue' && played ? gameById(lastGame) : null
        if (game) return Svg({ source: coverSvg(game), alt: game.title, width: 44, height: 44 })
        // Плитка языка (arcade-lang-de) — флажком, подпись — название языка на нём самом
        const flag = /^arcade-lang-([a-z]{2})$/.exec(key)?.[1]
        if (FLAGS[flag]) return Svg({ source: flagSvg(flag), alt: LANG_NAMES[flag], width: 36, height: 36 })
        // arcade-menu-shelf-books → books, arcade-lang-main → lang, arcade-support → support; жанр — иконкой своей полки
        // Темы YouTube (arcade-yt-topic-…), статей (ar-) и подкастов (pc-) — иконкой раздела; их названия придумала
        // модель, в alt не ставим
        const kind = key
          .replace(/^arcade-(menu-(shelf-)?)?/, '')
          .replace(/^genre-\d+$/, String(menu).split(':')[1] ?? '')
          .replace(/^lang-main$/, 'lang')
          .replace(/^open-library$/, 'library')
          .replace(/^yt-.+$/, 'youtube')
          .replace(/^ar-.+$/, 'articles')
          .replace(/^pc-.+$/, 'podcasts')
          .replace(/^tw-.+$/, 'twitch')
          // Чат с другом — иконкой человека, группа — людей
          .replace(/^chat-open-d.+$/, 'account')
          .replace(/^chat-open-g.+$/, 'friends')
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
                const text = isKept(note) ? raw : tr(raw, lang)
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
              out.push(card([iconFor(x), Box({ flexDirection: 'column', rowGap: 'xs', flexGrow: 1, flexShrink: 1, minWidth: 0, children: body })], cardKey, width))
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
      const noticeLines = libraryNotice ? [gap, Text({ color: 'warning', children: [libraryNotice] })] : []
      const hint = [gap, dim('↑ ↓ или Tab — выбрать, Enter — открыть. Можно кликнуть мышью.')]

      let items
      if (menu === 'lang') {
        // Выбор языка: плитки, как остальное меню, в Desktop — с флажком; каждый язык подписан на самом себе, текущий
        // отмечен
        items = [
          Button({ key: 'arcade-back', label: '← Назад', onPress: open(langReturn) }),
          gap,
          tiles(
            LANGS.map((code) =>
              Button({
                key: `arcade-lang-${code}`,
                label: `${LANG_NAMES[code]}${code === lang ? ' ✓' : ''}`,
                ...(code === lang ? { autoFocus: true } : {}),
                onPress: async () => {
                  lang = code
                  menu = langReturn
                  $.ui.invalidate('ui.render')
                  await saveSetting($, 'lang', lang)
                },
              }),
            ),
            22,
          ),
          ...hint,
        ]
      } else if (menu === 'account') {
        // Аккаунт: вошли — кто и что общее; идёт вход — код для GitHub; иначе — зачем вход и что Arcade узнает
        const flow = acct.flow
        const note = acct.note ? [Text({ color: 'warning', children: [acct.note] })] : []
        if (acct.session) {
          // Ника нет, а имя на GitHub подходит под правила — его можно взять одной кнопкой
          const take = acct.handle ? '' : suggestHandle(acct.session.user.login)
          items = [
            back,
            gap,
            keep(Text({ bold: true, children: [`GitHub: @${acct.session.user.login}`] })),
            Text({ children: [acct.handle ? `Твой ник: @${acct.handle}` : 'Ника пока нет.'] }),
            dim('Ник видят соперники в сетевых партиях настольных игр. Сменить его можно когда угодно.'),
            ...(take ? [Button({ key: 'arcade-account-take', label: `Взять @${take}`, onPress: () => claimHandle($, take) })] : []),
            Input({ key: 'arcade-account-handle', label: acct.handle ? 'Сменить ник' : 'Свой ник', placeholder: 'латинские буквы, цифры и _, от 4 до 32 знаков', onSubmit: (value) => claimHandle($, value) }),
            ...(acct.naming ? [dim('Проверяю ник…')] : acct.handleNote ? [Text({ color: 'warning', children: [acct.handleNote] })] : []),
            gap,
            dim('Общие для всех компьютеров: язык, клавиши, уведомления, размер панели, что делать с игрой по сигналу агента, свои темы, каналы Twitch и рекорд Flappy Arcade.'),
            dim(acct.syncing ? 'Синхронизирую…' : acct.syncedAt ? 'Настройки синхронизированы.' : 'Настройки ещё не синхронизированы.'),
            ...note,
            gap,
            Button({ key: 'arcade-account-sync', label: 'Синхронизировать сейчас', autoFocus: true, onPress: () => syncAccount($) }),
            Button({ key: 'arcade-account-logout', label: 'Выйти', onPress: () => logout($) }),
            dim('  на этом компьютере; настройки останутся здесь как есть'),
            Button({ key: 'arcade-account-delete', label: acct.confirmDelete ? 'Точно удалить? Нажми ещё раз' : 'Удалить аккаунт', onPress: () => deleteAccount($) }),
            dim('  сайт Arcade забудет тебя и твои настройки; здесь всё останется'),
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
            Button({ key: 'arcade-account-login', label: acct.starting ? 'Прошу код у GitHub…' : 'Войти через GitHub', autoFocus: true, onPress: () => startLogin($) }),
            ...noticeLines,
            ...hint,
          ]
        }
      } else if (menu === 'friends' || menu === 'friends:remove') {
        // Друзья: взаимные заявки по точному @нику. Без входа и без ника — что сделать сначала
        const login = Button({
          key: 'arcade-friends-login',
          label: acct.starting ? 'Прошу код у GitHub…' : 'Войти через GitHub',
          autoFocus: true,
          onPress: () => {
            acct.confirmDelete = false
            open('account')()
            startLogin($)
          },
        })
        const note = fr.note ? [fr.bad ? Text({ color: 'warning', children: [fr.note] }) : dim(fr.note)] : []
        const person = (p) => keep(Text({ children: [`@${p.handle}`] }))
        const row = (children) => Box({ flexDirection: 'row', columnGap: 2, children })
        if (!acct.session) {
          items = [
            back,
            gap,
            dim('Друзья в Arcade — по @нику: отправь заявку, друг примет её у себя, и вы появитесь в списках друг у друга.'),
            Text({ children: ['Чтобы список друзей был доступен, войди через GitHub.'] }),
            dim('Arcade узнаёт только имя и картинку профиля GitHub — ни почты, ни доступа к репозиториям.'),
            // Вход только что пропал (сайт его не принял) — почему
            ...(acct.note ? [gap, Text({ color: 'warning', children: [acct.note] })] : []),
            gap,
            login,
            ...noticeLines,
            ...hint,
          ]
        } else if (!acct.handle && !acct.syncedAt) {
          // Сайт ещё не сказал, есть ли у человека ник
          items = [
            back,
            gap,
            ...(acct.syncing ? [dim('Спрашиваю сайт Arcade…')] : acct.note ? [Text({ color: 'warning', children: [acct.note] })] : []),
            gap,
            Button({ key: 'arcade-friends-sync', label: 'Обновить', autoFocus: true, onPress: () => syncAccount($) }),
            ...noticeLines,
            ...hint,
          ]
        } else if (!acct.handle) {
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
        } else if (menu === 'friends:remove') {
          items = [
            Button({ key: 'arcade-back', label: '← Назад', onPress: open('friends') }),
            gap,
            dim('Кого удалить из друзей? Уведомления не будет; у друга ты тоже пропадёшь из списка.'),
            gap,
            ...(fr.list?.friends ?? []).map((p, k) =>
              keep(Button({ key: `arcade-fr-remove-${p.id}`, label: `@${p.handle}`, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => friendsCall($, 'unfriend', { id: p.id }, p.handle, `@${p.handle} больше не в друзьях.`) })),
            ),
            ...(note.length ? [gap, ...note] : []),
            ...hint,
          ]
        } else {
          const list = fr.list
          const friends = list?.friends ?? []
          const incoming = list?.incoming ?? []
          const outgoing = list?.outgoing ?? []
          const fromRemove = menuFrom === 'friends:remove'
          items = [
            back,
            gap,
            Text({ children: [`Твой ник: @${acct.handle}`] }),
            dim('Друзья добавляют тебя по нему, а ты их — по их @нику.'),
            gap,
            Input({ key: 'arcade-friends-add', label: 'Добавить друга', placeholder: '@ник друга, точно как есть', onSubmit: (value) => addFriend($, value) }),
            ...(fr.busy === 'friends' ? [dim('Отправляю заявку…')] : note.length ? note : [dim('Подсказок по буквам нет: заявка дойдёт, только если ник написан точно.')]),
            ...(incoming.length
              ? [
                  section('Заявки тебе'),
                  ...incoming.map((p, k) =>
                    row([
                      person(p),
                      Button({ key: `arcade-fr-accept-${p.id}`, label: 'Принять', ...(k === 0 && !fromRemove ? { autoFocus: true } : {}), onPress: () => friendsCall($, 'accept', { id: p.id }, p.handle, `Теперь вы с @${p.handle} друзья.`) }),
                      Button({ key: `arcade-fr-decline-${p.id}`, label: 'Отклонить', onPress: () => friendsCall($, 'unfriend', { id: p.id }, p.handle, `Заявка от @${p.handle} отклонена.`) }),
                    ]),
                  ),
                ]
              : []),
            section('Друзья'),
            ...(friends.length
              ? [Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 3, children: friends.map(person) })]
              : [dim(list ? 'Друзей пока нет — добавь кого-нибудь по @нику.' : fr.loading ? 'Загружаю друзей…' : 'Список друзей не загрузился.')]),
            ...(friends.length ? [gap, Button({ key: 'arcade-fr-remove', label: 'Удалить друга', ...(fromRemove ? { autoFocus: true } : {}), onPress: open('friends:remove') })] : []),
            ...(outgoing.length
              ? [
                  section('Твои заявки'),
                  ...outgoing.map((p) =>
                    row([person(p), dim('ждёт ответа'), Button({ key: `arcade-fr-cancel-${p.id}`, label: 'Отменить', onPress: () => friendsCall($, 'unfriend', { id: p.id }, p.handle, `Заявка для @${p.handle} отменена.`) })]),
                  ),
                ]
              : []),
            gap,
            Button({ key: 'arcade-fr-refresh', label: fr.loading ? 'Обновляю…' : 'Обновить', onPress: () => friendsCall($, 'friends') }),
            ...noticeLines,
            ...hint,
          ]
        }
      } else if (menu === 'chats' || menu.startsWith('chats:')) {
        // Чаты с друзьями: список, новый чат (с другом или группа), переписка и участники группы. Чужой текст —
        // сообщения, ники, названия групп — не переводится (keep). Без входа и без ника — что сделать сначала
        const login = Button({
          key: 'arcade-chats-login',
          label: acct.starting ? 'Прошу код у GitHub…' : 'Войти через GitHub',
          autoFocus: true,
          onPress: () => {
            acct.confirmDelete = false
            open('account')()
            startLogin($)
          },
        })
        const note = ch.note ? [ch.bad ? Text({ color: 'warning', children: [ch.note] }) : dim(ch.note)] : []
        const row = (children) => Box({ flexDirection: 'row', columnGap: 2, children })
        const wrapRow = (children) => Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, children })
        // Название чата или группы: в Desktop — заголовком
        const heading = (text) => keep(desktop ? Text({ size: 'heading', weight: 'semibold', children: [text] }) : Text({ bold: true, children: [text] }))
        const toList = Button({
          key: 'arcade-chats-back',
          label: '← Чаты',
          onPress: () => {
            ch.note = ''
            ch.bad = false
            ch.confirmLeave = false
            open('chats')()
            loadChats($, true).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
          },
        })
        const pageButton = Button({ key: 'arcade-chats-page', label: ch.busy === 'page' ? 'Открываю…' : 'Открыть на странице', onPress: () => openChatPage($, e.surface) })
        const friends = fr.list?.friends ?? []
        if (!acct.session) {
          items = [
            back,
            gap,
            dim('Чаты в Arcade — с друзьями: переписка один на один, группы и общий чат со всеми друзьями.'),
            Text({ children: ['Чтобы писать друзьям, войди через GitHub.'] }),
            dim('Arcade узнаёт только имя и картинку профиля GitHub — ни почты, ни доступа к репозиториям.'),
            // Вход только что пропал (сайт его не принял) — почему
            ...(acct.note ? [gap, Text({ color: 'warning', children: [acct.note] })] : []),
            gap,
            login,
            ...noticeLines,
            ...hint,
          ]
        } else if (!acct.handle && !acct.syncedAt) {
          // Сайт ещё не сказал, есть ли у человека ник
          items = [
            back,
            gap,
            ...(acct.syncing ? [dim('Спрашиваю сайт Arcade…')] : acct.note ? [Text({ color: 'warning', children: [acct.note] })] : []),
            gap,
            Button({
              key: 'arcade-chats-sync',
              label: 'Обновить',
              autoFocus: true,
              onPress: async () => {
                await syncAccount($)
                if (acct.handle && !ch.list) await loadChats($)
              },
            }),
            ...noticeLines,
            ...hint,
          ]
        } else if (!acct.handle) {
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
        } else if (menu === 'chats:new') {
          // Новый чат: с другом — сразу, группа — отметить друзей и назвать
          items = [
            toList,
            section('Написать'),
            ...(friends.length
              ? [wrapRow(friends.map((p, k) => keep(Button({ key: `arcade-chat-dm-${p.id}`, label: `@${p.handle}`, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => openDm($, p.id) }))))]
              : [
                  dim(fr.list ? 'Друзей пока нет — добавь кого-нибудь по @нику.' : fr.loading ? 'Загружаю друзей…' : 'Список друзей не загрузился.'),
                  gap,
                  Button({
                    key: 'arcade-chats-friends',
                    label: 'Друзья',
                    autoFocus: true,
                    onPress: () => {
                      fr.note = ''
                      fr.bad = false
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
                          label: `${ch.picked.has(p.id) ? '☑' : '☐'} @${p.handle}`,
                          onPress: () => {
                            if (ch.picked.has(p.id)) ch.picked.delete(p.id)
                            else ch.picked.add(p.id)
                            ch.note = ''
                            ch.bad = false
                            $.ui.invalidate('ui.render')
                          },
                        }),
                      ),
                    ),
                  ),
                  gap,
                  // Что вписано, помним сами: «Создать группу» — кнопка, а не Enter в поле
                  Input({
                    key: `arcade-chat-name-${ch.field}`,
                    label: 'Название группы',
                    placeholder: 'например: шахматный клуб',
                    onInput: (value) => {
                      ch.groupName = value
                    },
                    onSubmit: (value) => {
                      ch.groupName = value
                      return createGroup($)
                    },
                  }),
                  row([
                    Button({ key: 'arcade-chat-create', label: ch.busy === 'group' ? 'Создаю…' : 'Создать группу', onPress: () => createGroup($) }),
                    Button({ key: 'arcade-chat-all', label: 'Группа со всеми друзьями', onPress: () => createGroup($, true) }),
                  ]),
                ]
              : []),
            ...(ch.busy === 'open' ? [gap, dim('Открываю чат…')] : note.length ? [gap, ...note] : []),
            ...noticeLines,
            ...hint,
          ]
        } else if (menu === 'chats:talk') {
          // Переписка: последние ch.shown сообщений, «Раньше» — ещё; новые приходят по таймеру
          const about = ch.about
          const listed = ch.list?.find((c) => c.id === ch.talk)
          const title = about ? chatTitle(about) : listed ? chatTitle(listed) : ''
          const line = (m) => {
            const time = keep(dim(when(m.at, now)))
            if (m.k) return row([time, Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: [keep(Text({ dimColor: true, wrap: 'wrap', children: [serviceText(m)] }))] })])
            return Box({
              flexDirection: 'row',
              columnGap: 1,
              children: [
                time,
                keep(Text({ bold: true, ...(m.f === ch.me ? { color: 'suggestion' } : {}), children: [chatPerson(m.f)] })),
                Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: [keep(Text({ wrap: 'wrap', children: [m.t] }))] }),
              ],
            })
          }
          items = [
            toList,
            gap,
            ...(title ? [heading(title)] : []),
            ...(about?.kind === 'group'
              ? [
                  row([
                    dim(`участники: ${about.members.length}`),
                    Button({
                      key: 'arcade-chat-members',
                      label: 'Участники',
                      onPress: () => {
                        ch.note = ''
                        ch.bad = false
                        ch.confirmLeave = false
                        open('chats:members')()
                        // Хозяину — список друзей: кого добавить
                        if (about.owner === ch.me) friendsCall($, 'friends')
                      },
                    }),
                  ]),
                ]
              : []),
            gap,
            ...(olderShown() ? [Button({ key: 'arcade-chat-older', label: ch.older ? 'Загружаю…' : 'Раньше', onPress: () => olderMessages($) })] : []),
            ...(ch.opening ? [dim('Загружаю переписку…')] : about && !ch.messages.length ? [dim('Здесь пока пусто — напиши первым.')] : ch.messages.slice(-ch.shown).map(line)),
            ...(about ? [gap, Input({ key: `arcade-chat-input-${ch.field}`, label: 'Сообщение', autoFocus: true, submitLabel: tr('Отправить', lang), onSubmit: (value) => sendMessage($, value) })] : []),
            ...(ch.busy === 'send' ? [dim('Отправляю…')] : note),
            gap,
            pageButton,
            ...noticeLines,
            ...hint,
          ]
        } else if (menu === 'chats:members') {
          // Участники группы: хозяин переименовывает, добавляет друзей и убирает людей; выйти может любой
          const about = ch.about
          const owner = Boolean(about) && about.owner === ch.me
          const members = about?.members ?? []
          const others = friends.filter((p) => !members.includes(p.id))
          items = [
            Button({
              key: 'arcade-back',
              label: '← Назад',
              autoFocus: true,
              onPress: () => {
                ch.note = ''
                ch.bad = false
                ch.confirmLeave = false
                open('chats:talk')()
              },
            }),
            gap,
            ...(about ? [heading(chatTitle(about))] : []),
            // Подсказка в поле — нынешнее название группы, его не переводим
            ...(owner
              ? [gap, keep(Input({ key: `arcade-chat-rename-${ch.field}`, label: tr('Переименовать', lang), placeholder: about.name || tr('Название группы', lang), onSubmit: (value) => renameGroup($, value) }))]
              : []),
            section('Участники'),
            ...members.map((id) =>
              row([
                keep(Text({ children: [chatPerson(id)] })),
                ...(id === about.owner ? [dim('управляет группой')] : []),
                ...(owner && id !== ch.me ? [Button({ key: `arcade-chat-remove-${id}`, label: 'Убрать', onPress: () => changeMembers($, { remove: [id] }, 'Участник убран.') })] : []),
              ]),
            ),
            ...(owner && others.length
              ? [
                  section('Добавить друзей'),
                  wrapRow(others.map((p) => keep(Button({ key: `arcade-chat-add-${p.id}`, label: `+ @${p.handle}`, onPress: () => changeMembers($, { add: [p.id] }, 'Участник добавлен.') })))),
                ]
              : []),
            ...(about ? [gap, Button({ key: 'arcade-chat-leave', label: ch.confirmLeave ? 'Точно выйти? Нажми ещё раз' : 'Выйти из группы', onPress: () => leaveGroup($) })] : []),
            ...(ch.busy === 'members' ? [dim('Сохраняю…')] : note),
            ...noticeLines,
            ...hint,
          ]
        } else {
          // Список чатов: новые сверху, у каждого — последнее сообщение и непрочитанные
          const list = ch.list ?? []
          const fromTalk = menuFrom === 'chats:talk' || menuFrom === 'chats:members'
          const focusId = fromTalk ? ch.talk : menuFrom === 'chats:new' ? '' : list[0]?.id
          const preview = (c) => {
            const last = c.last
            if (!last) return tr('Здесь пока пусто — напиши первым.', lang)
            // Своё — «ты:», в группе — ник; в чате двоих чужое и так от друга. Служебное уже говорит, кто
            const who = last.t === undefined ? '' : last.f === ch.me ? tr('ты', lang) : c.kind === 'group' ? chatPerson(last.f) : ''
            const said = last.t === undefined ? serviceText(last) : who ? `${who}: ${last.t}` : last.t
            return clip(`${c.at ? `${when(c.at, now)} · ` : ''}${said}`, 120)
          }
          const chatTiles = list.flatMap((c) => [
            keep(
              Button({
                key: `arcade-chat-open-${c.id}`,
                label: `${chatTitle(c)}${c.unread ? ` (${c.unread})` : ''}`,
                ...(c.id === focusId ? { autoFocus: true } : {}),
                onPress: () => openChat($, c.id),
              }),
            ),
            keep(dim(`  ${preview(c)}`)),
          ])
          items = [
            back,
            gap,
            row([
              Button({
                key: 'arcade-chat-new',
                label: 'Новый чат',
                ...(menuFrom === 'chats:new' || (ch.list && !list.length) ? { autoFocus: true } : {}),
                onPress: () => {
                  ch.picked = new Set()
                  ch.groupName = ''
                  ch.field++
                  ch.note = ''
                  ch.bad = false
                  open('chats:new')()
                  friendsCall($, 'friends')
                },
              }),
              pageButton,
            ]),
            ...(note.length ? [gap, ...note] : []),
            section('Чаты'),
            ...(list.length
              ? [desktop ? tiles(chatTiles, 44) : Box({ flexDirection: 'column', children: chatTiles })]
              : [dim(ch.list ? 'Чатов пока нет. Нажми «Новый чат» и выбери друга.' : ch.loading ? 'Загружаю чаты…' : 'Список чатов не загрузился.')]),
            ...(!ch.list && !ch.loading ? [gap, Button({ key: 'arcade-chats-refresh', label: 'Обновить', onPress: () => loadChats($) })] : []),
            gap,
            dim('Переписка хранится на сайте Arcade и не шифруется — не пиши туда пароли и ключи.'),
            ...noticeLines,
            ...hint,
          ]
        }
      } else if (menu === 'settings') {
        const field = FIELD
        items = [
          back,
          gap,
          // Desktop: встроенный браузер приложения или окно браузера; Денди там всегда в панели, графика — картинкой
          ...(e.surface === 'desktop' && platform
            ? [
                Button({
                  key: 'arcade-opener',
                  label: desktopLabel(),
                  autoFocus: true,
                  onPress: async () => {
                    const options = desktopOptions()
                    const current = options.findIndex((o) =>
                      builtinBrowser(e.surface) ? o.opener === 'builtin' : o.opener === 'window' && o.browser === browserChoice,
                    )
                    const nextOption = options[(current + 1) % options.length]
                    desktopOpener = nextOption.opener
                    browserChoice = nextOption.browser
                    libraryNotice = ''
                    $.ui.invalidate('ui.render')
                    await $.store.set('desktopOpener', desktopOpener)
                    await $.store.set('opener', { opener, browser: browserChoice })
                  },
                }),
                dim(
                  builtinBrowser(e.surface)
                    ? '  рядом с разговором; в авто-режиме игру открывает Claude — он прервётся и вернётся к работе'
                    : '  игра откроется в браузере; пауза, пока окно не в фокусе; прогресс сохраняется',
                ),
                ...(builtinBrowser(e.surface) ? [dim(`  ${MOUSE_NOTE}`)] : []),
              ]
            : []),
          ...(e.surface !== 'desktop' && platform
            ? [
                Button({
                  key: 'arcade-opener',
                  label: openerLabel(),
                  autoFocus: true,
                  onPress: async () => {
                    const options = openerOptions()
                    const current = options.findIndex((o) =>
                      windowMode() ? o.opener === 'window' && o.browser === browserChoice : o.opener === 'pane',
                    )
                    const nextOption = options[(current + 1) % options.length]
                    opener = nextOption.opener
                    browserChoice = nextOption.browser
                    libraryNotice = ''
                    $.ui.invalidate('ui.render')
                    await $.store.set('opener', { opener, browser: browserChoice })
                  },
                }),
                dim(
                  !windowMode()
                    ? '  символы или пиксели — зависит от терминала'
                    : platform === 'windows'
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
                  ...(platform ? {} : { autoFocus: true }),
                  onPress: async () => {
                    graphics = GRAPHICS[(GRAPHICS.indexOf(graphics) + 1) % GRAPHICS.length]
                    pixelsFailed = false // «авто» заново проверит, умеет ли терминал картинки
                    denies = 0
                    $.ui.invalidate('ui.render')
                    await $.store.set('graphics', graphics)
                  },
                }),
                dim('  пиксели — в терминалах с картинками (kitty, Ghostty, Rio), символы — везде'),
              ]),
          Button({
            key: 'arcade-lang',
            label: `Язык: ${LANG_NAMES[lang] ?? lang}`,
            onPress: () => {
              langReturn = 'settings'
              open('lang')()
            },
          }),
          Button({
            key: 'arcade-wide',
            label: `Размер панели: ${wide ? 'во всю ширину' : 'обычный'}`,
            onPress: async () => {
              wide = !wide
              $.ui.invalidate('ui.render')
              await saveSetting($, 'wide', wide)
              // Панель уже открыта — просим новую ширину сразу
              await $.ui.open({ id: PANE, title: 'Arcade', focus: true, closeOnEscape: true, columns: paneColumns(), rows: PANE_ROWS })
            },
          }),
          dim('  во всю ширину разговор с агентом сжимается в узкую полосу; поправить ширину можно мышью'),
          Button({
            key: 'arcade-on-done',
            label: `Когда агент закончил: ${SIGNAL_LABELS[onDone]}`,
            onPress: async () => {
              onDone = SIGNAL_MODES[(SIGNAL_MODES.indexOf(onDone) + 1) % SIGNAL_MODES.length]
              $.ui.invalidate('ui.render')
              await saveSetting($, 'onDone', onDone)
            },
          }),
          Button({
            key: 'arcade-on-permission',
            label: `Когда агент ждёт разрешения: ${SIGNAL_LABELS[onPermission]}`,
            onPress: async () => {
              onPermission = SIGNAL_MODES[(SIGNAL_MODES.indexOf(onPermission) + 1) % SIGNAL_MODES.length]
              $.ui.invalidate('ui.render')
              await saveSetting($, 'onPermission', onPermission)
            },
          }),
          dim('  для игры в панели Claude; в окне браузера — системное уведомление'),
          ...(platform
            ? [
                Button({
                  key: 'arcade-notify',
                  label: `Уведомления, пока играешь в окне: ${osNotify ? 'да' : 'нет'}`,
                  onPress: async () => {
                    osNotify = !osNotify
                    $.ui.invalidate('ui.render')
                    await saveSetting($, 'notify', osNotify)
                  },
                }),
                dim('  системное уведомление со звуком, когда агент закончил или ждёт разрешения'),
              ]
            : []),
          // Проверка и назначение клавиш — только в терминале: в VS Code клавиши идут через строку 🎮, в Desktop поля нет
          ...(e.surface === 'terminal'
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
            : []),
          ...noticeLines,
          ...hint,
        ]
      } else if (menu === 'youtube') {
        // Темы: три по работе агента и новинки. Названия, которые придумала модель, — уже на языке интерфейса (keep)
        const focus = menuFrom?.startsWith('youtube:') ? topicKey(menuFrom.slice(8)) : 0
        const topicTiles = (yt.topics ?? []).flatMap((t, i) => {
          const button = Button({
            key: `arcade-yt-topic-${i}`,
            label: t.title,
            ...(i === focus ? { autoFocus: true } : {}),
            onPress: () => {
              open(`youtube:${i}`)()
              if (yt.topic !== i || (!yt.videos.length && !yt.loading)) loadVideos($, i)
            },
          })
          return [t.fixed ? button : keep(button), dim(t.direction === 'news' ? '  презентации и обзоры обновлений' : '  по теме работы агента')]
        })
        items = [
          back,
          gap,
          dim('Темы — по тому, над чем сейчас работает агент; видео — свежие, с проверенных каналов.'),
          gap,
          ...(yt.loading === 'topics' || !yt.topics
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
      } else if (menu.startsWith('youtube:')) {
        const topicId = topicKey(menu.slice(8))
        const topic = topicOf(topicId)
        const builtin = builtinBrowser(e.surface)
        const playVideo = async (k) => {
          const id = `video:${k}`
          if (builtin) return desktopWindow($, id, 'Видео открыто во встроенном браузере Claude.')
          if (!platform) {
            libraryNotice = `Видео: https://www.youtube.com/watch?v=${yt.videos[k].id}`
            $.ui.invalidate('ui.render')
            return
          }
          libraryNotice = 'Открываю окно…'
          $.ui.invalidate('ui.render')
          const command = windowCommand(id)
          try {
            const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
            windowNotice($, launchNotice(result, id))
            if (result?.exitCode === 0) windowOpenedAt = await $.clock.now()
          } catch (err) {
            libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
          }
          $.ui.invalidate('ui.render')
        }
        // Видео — названия, каналы и описания как есть, без перевода (keep). В Desktop — крупная карточка во всю строку:
        // название, канал с датой и просмотрами, начало описания
        const videoItem = (v, k) => {
          const label = v.title.length > 100 ? `${v.title.slice(0, 99)}…` : v.title
          const button = Button({ key: `arcade-yt-video-${k}`, label, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => playVideo(k) })
          if (!desktop) return keep(Box({ flexDirection: 'column', children: [button, Text({ dimColor: true, children: [`  ${videoMeta(v, lang, now)}`] })] }))
          const stats = videoStats(v, lang, now)
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
        items = [
          Button({ key: 'arcade-back', label: '← Назад', ...(yt.loading ? { autoFocus: true } : {}), onPress: open('youtube') }),
          gap,
          ...(topic ? [topic.fixed ? Text({ bold: true, children: [topic.title] }) : keep(Text({ bold: true, children: [topic.title] }))] : []),
          gap,
          ...(yt.loading === 'videos'
            ? [Text({ children: ['Подбираю видео…'] })]
            : yt.videos.length
              ? [Box({ flexDirection: 'column', rowGap: desktop ? 'sm' : 0, children: yt.videos.map(videoItem) })]
              : []),
          ...(yt.note ? [gap, dim(yt.note)] : []),
          ...(topic && !yt.loading ? [gap, Button({ key: 'arcade-yt-more', label: 'Другая подборка', ...(yt.videos.length ? {} : { autoFocus: true }), onPress: () => loadVideos($, topicId, true) })] : []),
          ...(yt.videos.length && (builtin || platform) ? [gap, dim(`Видео открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.`)] : []),
          ...noticeLines,
          ...hint,
        ]
      } else if (menu === 'twitch' || menu.startsWith('twitch:')) {
        // Twitch: свои каналы, кто из каталога в эфире, весь каталог по направлениям, «Убрать канал». Имена каналов,
        // названия эфиров и игр — как на Twitch, без перевода (keep); подпись «в эфире…» переводим здесь
        const builtin = builtinBrowser(e.surface)
        const watch = async (login) => {
          const id = `live:${login}`
          if (builtin) return desktopWindow($, id, 'Трансляция открыта во встроенном браузере Claude.')
          if (!platform) {
            libraryNotice = `Трансляция: https://www.twitch.tv/${login}`
            $.ui.invalidate('ui.render')
            return
          }
          libraryNotice = 'Открываю окно…'
          $.ui.invalidate('ui.render')
          const command = windowCommand(id)
          try {
            const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
            windowNotice($, launchNotice(result, id))
            if (result?.exitCode === 0) windowOpenedAt = await $.clock.now()
          } catch (err) {
            libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
          }
          $.ui.invalidate('ui.render')
        }
        // Плитка канала: имя — кнопкой, под ним — эфир (игра, зрители) и его название
        const channelTile = (key, c, info, missing, focus) => {
          const status = tr(liveStatus(info, missing, lang), lang)
          const note = [status, info?.live?.title].filter(Boolean).join(' — ')
          return [keep(Button({ key, label: info?.name ?? c.name, ...(focus ? { autoFocus: true } : {}), onPress: () => watch(c.login) })), keep(dim(`  ${note}`))]
        }
        const column = (list) => (desktop ? tiles(list, 44) : Box({ flexDirection: 'column', children: list }))
        const where = builtin || platform ? [gap, dim(`Трансляции открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.`)] : []
        const trouble = tw.error ? [gap, dim(twitchNote(tw.error))] : []
        const waiting = tw.loading && !tw.at ? [Text({ children: ['Спрашиваю Twitch, кто в эфире…'] })] : []
        const toList = Button({ key: 'arcade-back', label: '← Назад', onPress: open('twitch') })
        if (menu === 'twitch:catalog') {
          // Весь каталог: по направлениям, в каждом — сначала эфиры
          const groups = Object.keys(TOPIC_TITLES)
            .map((t) => [t, tw.catalog.filter((c) => c.topics[0] === t)])
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
        } else if (menu === 'twitch:remove') {
          items = [
            toList,
            gap,
            dim('Какой канал убрать из «Моих каналов»?'),
            gap,
            ...tw.channels.map((c, k) => keep(Button({ key: `arcade-tw-remove-${c.login}`, label: tw.info[c.login]?.name ?? c.name, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => removeChannel($, c.login) }))),
            ...(tw.note ? [gap, dim(tw.note)] : []),
            ...hint,
          ]
        } else {
          const from = menuFrom?.startsWith('twitch:') ? menuFrom : ''
          const myTiles = liveFirst(tw.channels, tw.info).flatMap((c, k) => channelTile(`arcade-tw-my-${c.login}`, c, tw.info[c.login], tw.missing.has(c.login), !from && k === 0))
          const onAir = tw.catalog.filter((c) => c.live).slice(0, 8)
          const airTiles = onAir.flatMap((c, k) => channelTile(`arcade-tw-cat-${c.login}`, c, c, false, !from && !myTiles.length && k === 0))
          items = [
            back,
            gap,
            dim('Свои каналы и каталог Arcade. Регистрация не нужна: свои каналы хранятся только у тебя.'),
            section('Мои каналы'),
            ...(myTiles.length ? [column(myTiles)] : [dim('Своих каналов пока нет — добавь любой канал Twitch по имени или ссылке.')]),
            gap,
            Input({ key: 'arcade-twitch-add', label: 'Добавить канал', placeholder: 'имя канала или ссылка twitch.tv/…', onSubmit: (value) => addChannel($, value) }),
            dim(tw.note || 'Например, tsoding или https://www.twitch.tv/tsoding'),
            ...(tw.channels.length ? [gap, Button({ key: 'arcade-tw-remove', label: 'Убрать канал', ...(from === 'twitch:remove' ? { autoFocus: true } : {}), onPress: open('twitch:remove') })] : []),
            section('Сейчас в эфире'),
            ...(waiting.length ? waiting : airTiles.length ? [column(airTiles)] : tw.error ? [] : [dim('Из каталога сейчас никто не в эфире.')]),
            gap,
            Button({ key: 'arcade-tw-catalog', label: 'Весь каталог', ...(from === 'twitch:catalog' ? { autoFocus: true } : {}), onPress: open('twitch:catalog') }),
            Button({ key: 'arcade-tw-refresh', label: tw.loading ? 'Обновляю…' : 'Обновить', onPress: () => loadTwitch($, true) }),
            ...trouble,
            ...where,
            ...noticeLines,
            ...hint,
          ]
        }
      } else if (menu === 'articles' || menu === 'podcasts') {
        // Статьи и подкасты: темы — те же, что у YouTube, подборка — своя. Названия, которые придумала модель, — уже на
        // языке интерфейса (keep)
        const kind = menu
        const articles = kind === 'articles'
        const short = articles ? 'ar' : 'pc'
        const focus = menuFrom?.startsWith(`${kind}:`) ? topicKey(menuFrom.slice(kind.length + 1)) : 0
        const topicTiles = (yt.topics ?? []).flatMap((t, i) => {
          const button = Button({
            key: `arcade-${short}-topic-${i}`,
            label: t.title,
            ...(i === focus ? { autoFocus: true } : {}),
            onPress: () => {
              open(`${kind}:${i}`)()
              const state = reads[kind]
              if (state.topic !== i || (!state.items.length && !state.loading)) loadReads($, kind, i)
            },
          })
          return [t.fixed ? button : keep(button), dim(t.direction === 'news' ? '  новости и обзоры обновлений' : '  по теме работы агента')]
        })
        items = [
          back,
          gap,
          dim(
            articles
              ? 'Темы — по тому, над чем сейчас работает агент; статьи — свежие, из проверенных блогов и изданий на английском.'
              : 'Темы — по тому, над чем сейчас работает агент; выпуски — свежие, из проверенных подкастов на английском.',
          ),
          gap,
          ...(yt.loading === 'topics' || !yt.topics
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
      } else if (menu.startsWith('articles:') || menu.startsWith('podcasts:')) {
        const kind = menu.split(':')[0]
        const articles = kind === 'articles'
        const short = articles ? 'ar' : 'pc'
        const topicId = topicKey(menu.slice(kind.length + 1))
        const topic = topicOf(topicId)
        const state = reads[kind]
        const builtin = builtinBrowser(e.surface)
        const openItem = async (k) => {
          const id = `${articles ? 'article' : 'episode'}:${k}`
          if (builtin) return desktopWindow($, id, articles ? 'Статья открыта во встроенном браузере Claude.' : 'Выпуск открыт во встроенном браузере Claude.')
          if (!platform) {
            const x = reads[kind].items[k]
            libraryNotice = articles ? `Статья: ${x.link}` : `Выпуск: ${x.link || x.audio}`
            $.ui.invalidate('ui.render')
            return
          }
          libraryNotice = 'Открываю окно…'
          $.ui.invalidate('ui.render')
          const command = windowCommand(id)
          try {
            const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
            windowNotice($, launchNotice(result, id))
            if (result?.exitCode === 0) windowOpenedAt = await $.clock.now()
          } catch (err) {
            libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
          }
          $.ui.invalidate('ui.render')
        }
        // Записи — названия, источники и описания как есть, без перевода (keep). В Desktop — карточка во всю строку:
        // название, источник с датой (у выпуска — и длительностью), начало описания
        const entry = (x, k) => {
          const label = x.title.length > 100 ? `${x.title.slice(0, 99)}…` : x.title
          const button = Button({ key: `arcade-${short}-item-${k}`, label, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => openItem(k) })
          const stats = itemStats(x, lang, now)
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
        items = [
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
          ...(state.items.length && (builtin || platform)
            ? [gap, dim(articles ? `Статьи открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.` : `Выпуски открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.`)]
            : []),
          ...noticeLines,
          ...hint,
        ]
      } else if (menu === 'mine') {
        // Свои игры: файлы человека. Arcade их не раздаёт — копия лежит только у него, в ~/.claude/arcade
        const remove = (m) =>
          Button({
            key: `arcade-mine-remove-${m.id}`,
            label: 'Удалить',
            onPress: async () => {
              mine = mine.filter((x) => x.id !== m.id)
              await $.store.set('mine', mine)
              await $.fs.write(mineFile(m.sha256), '').catch(() => {}) // удалять файлы мод не умеет — стираем содержимое
              libraryNotice = `Удалено: ${m.title}.`
              $.ui.invalidate('ui.render')
            },
          })
        items = [
          back,
          gap,
          ...(mine.length
            ? mine.flatMap((m, i) => {
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
              libraryNotice = await addMine($, value)
              $.ui.invalidate('ui.render')
            },
          }),
          dim('  или командой /arcade-add путь — в терминал файл можно просто перетащить после команды'),
          dim('  Файл остаётся у тебя: мод хранит копию в ~/.claude/arcade и никуда её не отправляет.'),
          dim('  Подключай только файлы, на которые у тебя есть права.'),
          ...noticeLines,
          ...hint,
        ]
      } else if (groupsList().some((x) => x.id === menu)) {
        // Вкладка группы («Игры»): полки с играми
        const group = groupsList().find((x) => x.id === menu)
        const shelvesHere = shelvesList().filter((s) => shelfGames(s.id).some((g) => groupConsoles(group.id).includes(g.console)))
        const shelfItems = shelvesHere.flatMap((s, i) => {
          const n = shelfGames(s.id).length
          return [
            Button({ key: `arcade-menu-shelf-${s.id}`, label: s.title, ...((menuFrom ? menuFrom === `shelf:${s.id}` : i === 0) ? { autoFocus: true } : {}), onPress: open(`shelf:${s.id}`) }),
            dim(`  ${n} ${shelfGames(s.id).every((g) => g.kind === 'book') ? plural(n, 'книга', 'книги', 'книг') : shelfGames(s.id).every((g) => ['audio', 'audio-mine'].includes(g.kind)) ? plural(n, 'аудиокнига', 'аудиокниги', 'аудиокниг') : plural(n, 'игра', 'игры', 'игр')}`),
          ]
        })
        // В Desktop полки — плитками с иконкой жанра, как разделы главного меню
        items = [
          back,
          gap,
          ...(desktop ? [tiles(shelfItems)] : shelfItems),
          ...noticeLines,
          ...hint,
        ]
      } else if (menu.startsWith('genre:') || (shelfView(menu) && shelfView(menu).list.length && (shelfView(menu).list.every((g) => g.kind === 'book') || shelfView(menu).list.every((g) => g.kind === 'audio')))) {
        // Книги: на полке языка — плитки жанров («Роман · 26 книг»); в жанре — его книги. «Назад» — к жанрам, потом к языкам
        const inGenre = menu.startsWith('genre:')
        const shelfMenu = inGenre ? `shelf:${menu.split(':')[1]}` : menu
        const shelf = shelfView(shelfMenu)
        const genre = inGenre ? menu.split(':').slice(2).join(':') : null
        const books = shelf ? shelf.list : []
        if (!inGenre) {
          const genres = [...new Set(books.map((g) => g.genre))]
          items = [
            Button({ key: 'arcade-back', label: '← Назад', onPress: open(shelf.group) }),
            gap,
            tiles(
              genres.flatMap((g, i) => {
                const n = books.filter((b) => b.genre === g).length
                const audio = books.every((b) => b.kind === 'audio')
                return [
                  Button({ key: `arcade-genre-${i}`, label: genreLabel(g), ...((menuFrom ? menuFrom === `genre:${shelfMenu.slice(6)}:${g}` : i === 0) ? { autoFocus: true } : {}), onPress: open(`genre:${shelfMenu.slice(6)}:${g}`) }),
                  dim(`  ${n} ${audio ? plural(n, 'аудиокнига', 'аудиокниги', 'аудиокниг') : plural(n, 'книга', 'книги', 'книг')}`),
                ]
              }),
            ),
            ...noticeLines,
            ...hint,
          ]
        } else {
          const list = books.filter((g) => g.genre === genre)
          const focusId = list.some((g) => g.id === lastGame) ? lastGame : list[0]?.id
          items = [
            Button({ key: 'arcade-back', label: '← Назад', onPress: open(shelfMenu) }),
            gap,
            ...(desktop ? [tiles(list.flatMap((g) => [gameButton(g, g.id === focusId), dim(`  ${g.note}`)]))] : list.flatMap((g) => [gameButton(g, g.id === focusId), dim(`  ${g.note}`)])),
            ...noticeLines,
            ...hint,
          ]
        }
      } else if (menu !== 'main') {
        const shelf = shelfView(menu)
        const c = shelf ?? consoles().find((x) => x.id === menu) ?? consoles()[0]
        const list = shelf ? shelf.list : games().filter((g) => g.console === c.id && !g.mine)
        const focusId = list.some((g) => g.id === lastGame) ? lastGame : list[0]?.id
        const builtin = builtinBrowser(e.surface, list.some((g) => mouseGame(g.id)))
        const own = c.id === 'nes' || (list.length > 0 && list.every((g) => g.engine)) // Денди и свои игры (Flappy Arcade) — в панели
        items = [
          shelf ? Button({ key: 'arcade-back', label: '← Назад', onPress: open(shelf.group) }) : back,
          gap,
          ...(list.length
            ? desktop ? [tiles(list.flatMap((g) => [gameButton(g, g.id === focusId), dim(`  ${g.note}`)]))] : list.flatMap((g) => [gameButton(g, g.id === focusId), dim(`  ${g.note}`)])
            : [Text({ children: [c.empty ?? c.soon ?? 'Здесь пока нет игр.'] })]),
          // Всё, кроме Денди и своих игр (Flappy Arcade), идёт только в окне браузера: там и свои файлы — кнопкой «Открыть свой файл»
          ...(!own
            ? platform || e.surface === 'desktop'
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
                        if (result?.exitCode === 0) windowOpenedAt = await $.clock.now()
                      } catch (err) {
                        libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
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
      } else {
        // Последнее, во что играли (или что читали и слушали), — одной кнопкой: при открытии меню фокус на ней
        const resume = played ? gameById(lastGame) : null
        const tabItems = (list) =>
          list.flatMap((c) => [
            Button({
              key: `arcade-menu-${c.id}`,
              label: c.title,
              ...((menuFrom ?? (resume ? null : consoles()[0]?.id)) === c.id ? { autoFocus: true } : {}),
              onPress: open(c.id),
            }),
            dim(`  ${consoleNote(c)}`),
          ])
        const reading = menuTabs().filter((c) => ['reading', 'books', 'listening', 'audiobooks'].includes(c.id))
        // YouTube, статьи и подкасты: общие темы подбираем заново, если их нет, сменился язык или они устарели
        const openTopics = (id) => () => {
          open(id)()
          if (!yt.topics || yt.topicsLang !== lang || now - yt.topicsAt > TOPICS_TTL_MS) loadTopics($)
        }
        const topicTile = (id, label, note) => [Button({ key: `arcade-menu-${id}`, label, ...(menuFrom === id ? { autoFocus: true } : {}), onPress: openTopics(id) }), dim(note)]
        items = [
          section('Играть'),
          tiles([
            ...(resume
              ? [
                  Button({ key: 'arcade-continue', label: '▶ Продолжить', ...(menuFrom ? {} : { autoFocus: true }), onPress: () => playGame(resume) }),
                  dim(`  ${resume.title}`),
                ]
              : []),
            ...tabItems(menuTabs().filter((c) => !reading.includes(c))),
          ]),
          // Книги и аудиокниги из каталога, за ними — свежие статьи и подкасты по теме работы агента
          section('Читать и слушать'),
          tiles([
            ...tabItems(reading),
            ...topicTile('articles', 'Статьи', '  свежие статьи по теме работы агента'),
            ...topicTile('podcasts', 'Подкасты', '  свежие выпуски подкастов по теме работы агента'),
          ]),
          section('Смотреть'),
          tiles([
            ...topicTile('youtube', 'YouTube', '  свежие видео по теме работы агента'),
            Button({
              key: 'arcade-menu-twitch',
              label: 'Twitch',
              ...(menuFrom === 'twitch' ? { autoFocus: true } : {}),
              onPress: () => {
                tw.note = ''
                open('twitch')()
                loadTwitch($)
              },
            }),
            dim('  свои каналы и эфиры о программировании, технике и ретро-играх'),
          ]),
          section('Ещё'),
          tiles([
          ...(windowMode() || e.surface === 'desktop'
            ? [
                Button({
                  key: 'arcade-open-library',
                  label: 'Окно Arcade',
                  onPress: async () => {
                    if (builtinBrowser(e.surface)) return desktopWindow($, null, 'Arcade открыт во встроенном браузере Claude.')
                    libraryNotice = 'Открываю окно…'
                    $.ui.invalidate('ui.render')
                    const command = windowCommand(null)
                    try {
                      const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                      windowNotice($, launchNotice(result, null))
                      if (result?.exitCode === 0) windowOpenedAt = await $.clock.now()
                    } catch (err) {
                      libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
                    }
                    $.ui.invalidate('ui.render')
                  },
                }),
                dim('  все игры и статистика в окне браузера'),
                // Кто-то ждёт в сети — можно сразу к нему
                ...(netWaiting.length
                  ? [
                      Button({
                        key: 'arcade-net-join',
                        label: `Присоединиться: ${netWaiting[0].title}`,
                        onPress: async () => {
                          const target = netWaiting[0]
                          lastGame = target.id
                          const where = target.console === 'nes' ? `net:${target.id}` : target.coop ? `coop:${target.id}` : target.id
                          if (builtinBrowser(e.surface, mouseGame(target.id))) return desktopWindow($, where, `${target.title} открыт во встроенном браузере Claude.`)
                          libraryNotice = 'Открываю окно…'
                          $.ui.invalidate('ui.render')
                          const command = windowCommand(where)
                          try {
                            const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                            windowNotice($, launchNotice(result, target.id))
                            if (result?.exitCode === 0) windowOpenedAt = await $.clock.now()
                          } catch (err) {
                            libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
                          }
                          $.ui.invalidate('ui.render')
                        },
                      }),
                      dim(`  в сети ждут: ${waitingText()}`),
                    ]
                  : []),
              ]
            : []),
          Button({
            key: 'arcade-menu-mine',
            label: 'Мои игры',
            ...(menuFrom === 'mine' ? { autoFocus: true } : {}),
            onPress: open('mine'),
          }),
          dim(`  ${mine.length ? `${mine.length} ${plural(mine.length, 'игра', 'игры', 'игр')}` : 'добавь свой файл ROM'}`),
          Button({
            key: 'arcade-menu-settings',
            label: 'Настройки',
            ...(menuFrom === 'settings' ? { autoFocus: true } : {}),
            onPress: open('settings'),
          }),
          dim(`  ${settingsNote(e.surface)}`),
          // Вход — по желанию: настройки одни на всех компьютерах человека
          Button({
            key: 'arcade-menu-account',
            label: acct.session ? 'Аккаунт' : 'Войти через GitHub',
            ...(menuFrom === 'account' ? { autoFocus: true } : {}),
            onPress: () => {
              acct.confirmDelete = false
              open('account')()
              syncAccount($)
            },
          }),
          acct.session ? keep(dim(`  ${acct.handle ? `@${acct.handle} · ` : ''}GitHub: @${acct.session.user.login}`)) : dim('  по желанию: одни настройки на всех компьютерах и свой @ник'),
          // Друзья — плитка видна всем; без входа и без ника экран скажет, что сделать сначала
          Button({
            key: 'arcade-menu-friends',
            label: 'Друзья',
            ...(menuFrom === 'friends' || menuFrom === 'friends:remove' ? { autoFocus: true } : {}),
            onPress: () => {
              fr.note = ''
              fr.bad = false
              open('friends')()
              if (!acct.session) return
              if (!acct.syncedAt) syncAccount($)
              friendsCall($, 'friends')
            },
          }),
          // Ника нет, а сайт ещё не спрашивали — может, он есть: пока без «возьми ник»
          dim(
            !acct.session
              ? '  по @нику: заявки и список друзей; нужен вход через GitHub'
              : !acct.handle
                ? acct.syncedAt
                  ? '  сначала возьми свой @ник'
                  : '  по @нику: заявки и список друзей'
                : acct.requests
                  ? `  заявок тебе: ${acct.requests} · друзей: ${acct.friends}`
                  : acct.friends
                    ? `  друзей: ${acct.friends}`
                    : '  позови друзей по их @нику',
          ),
          // Чаты — плитка видна всем, как «Друзья»; непрочитанные — с сайта при синхронизации и по таймеру
          Button({
            key: 'arcade-menu-chats',
            label: 'Чаты',
            ...(String(menuFrom ?? '').startsWith('chats') ? { autoFocus: true } : {}),
            onPress: async () => {
              ch.note = ''
              ch.bad = false
              open('chats')()
              if (!acct.session) return
              if (!acct.syncedAt) await syncAccount($)
              if (acct.handle) await loadChats($)
            },
          }),
          dim(
            !acct.session
              ? '  с друзьями: один на один и группы; нужен вход через GitHub'
              : !acct.handle && acct.syncedAt
                ? '  сначала возьми свой @ник'
                : acct.unread
                  ? `  непрочитанных: ${acct.unread}`
                  : '  с друзьями: один на один и группы',
          ),
          // Язык — прямо в главном меню: название языка на нём самом, чтобы найти его, не понимая текущего
          Button({
            key: 'arcade-lang-main',
            label: `🌐 ${LANG_NAMES[lang] ?? lang}`,
            onPress: () => {
              langReturn = 'main'
              open('lang')()
            },
          }),
          dim('  язык интерфейса — 13 на выбор'),
          // Добровольно, без напоминаний: одна строка внизу меню, ссылка открывается в обычном браузере
          Button({
            key: 'arcade-support',
            label: '☕ Поддержать проект',
            onPress: async () => {
              const url = supportUrl()
              const command = openUrlCommand(platform, url)
              if (!command) {
                libraryNotice = `Страница поддержки: ${url}`
                $.ui.invalidate('ui.render')
                return
              }
              try {
                const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                windowNotice($, result?.exitCode === 0 ? 'Открываю страницу поддержки в браузере. Спасибо!' : `Страница поддержки: ${url}`)
              } catch {
                libraryNotice = `Страница поддержки: ${url}`
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
      }
      return Box({ flexDirection: 'column', children: [header, gap, ...items] })
    }

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
    const message = paused
      ? Text({
          color: 'warning',
          children: [`Пауза: ${agentAlert === 'permission' ? 'агент ждёт разрешения' : 'агент закончил'}. Любая клавиша игры — играть дальше, Esc — к агенту`],
        })
      : mode === 'assign'
        ? Text({ color: 'warning', children: [`${notice} Нажми клавишу для «${ACTIONS[assignStep].label}» (${assignStep + 1} из ${ACTIONS.length})`] })
        : notice
          ? Text({ color: 'warning', children: [notice] })
          : game.engine === 'flappy'
            ? Text({ color: nes?.state === 'over' ? 'warning' : 'success', children: [flappyLine()] })
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
      const byHeight = wide ? Math.floor(((e.props.scroll?.bodyRows ?? 30) * 17) / 240) : Infinity
      const scale = Math.max(1, Math.min((wide ? REMOTE_MAX_WIDTH_WIDE : REMOTE_MAX_WIDTH) / 256, byWidth, byHeight))
      const width = 256 * scale
      const height = 240 * scale
      const picture = Svg({ source: frameToSvg(frame, width, height), alt: game.title, width, height })
      // Агент закончил или ждёт разрешения, пока идёт игра: яркая плашка над экраном — её видно и во всю ширину
      const alertBar = agentAlert
        ? Box({
            flexDirection: 'row',
            columnGap: 2,
            children: [
              Text({
                bold: true,
                color: 'black',
                backgroundColor: agentAlert === 'permission' ? 'yellow' : 'green',
                children: [`${agentAlert === 'permission' ? ' Агент ждёт разрешения ' : ' Агент закончил '}${paused ? '· пауза ' : ''}`],
              }),
              Button({ key: 'arcade-to-agent', label: 'К агенту', onPress: async () => { await $.ui.close({ id: PANE }) } }),
              Button({
                key: 'arcade-alert-ok',
                label: 'Играть дальше',
                onPress: () => {
                  agentAlert = null
                  paused = false
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
                  children: [Client({ key: INPUT, module: './input.js', props: { focused: e.props.isFocused }, width: '100%', height: '100%' })],
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
            if (!holdTicks[id]) taps.add(id)
            holdTicks[id] = holdTicks[id] ? HOLD_TICKS_REPEAT : HOLD_TICKS_FIRST
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
            children: [Client({ key: INPUT, module: './input.js', props: { focused: e.props.isFocused }, width: columns, height: rows })],
          }),
        ],
      })

    if (game.rom || game.engine) {
      const pixels = pixelMode()
      screen = screenSize(e.props.bodyColumns ?? 60, freeRows(e.props), pixels ? MAX_IMAGE_COLUMNS : MAX_SYMBOL_COLUMNS)
      const content = screenContent()
      const picture = pixels
        ? Image({ key: 'arcade-screen', columns: screen.columns, rows: screen.rows, alt: `${game.title} — этот терминал не показывает картинки`, ...content })
        : Raster({ key: 'arcade-screen', columns: screen.columns, rows: screen.rows, ...content })
      return Box({
        flexDirection: 'column',
        children: [header, line, withInput(picture, screen.columns, screen.rows), Text({ dimColor: true, children: [legend] })],
      })
    }

    return Box({
      flexDirection: 'column',
      children: [
        header,
        line,
        withInput(Raster({ key: 'arcade-field', columns: COLS, rows: ROWS, cells: cellsOf(fieldRows()) }), COLS, ROWS),
        Text({ dimColor: true, children: [`Нажатия: ${pressed.join(' ') || '—'}`] }),
        Text({ dimColor: true, children: [`Зажато: ${heldKeys.join(' ') || '—'}`] }),
        Text({ dimColor: true, children: [`Клавиши: ${ACTIONS.map((a) => `${a.label} ${keymap[a.id].join(' ')}`).join(' · ')}`] }),
        Text({ dimColor: true, children: ['Назначить заново: «Настройки» → «Назначить клавиши заново»'] }),
        Text({ children: [' '] }),
        ...eventLines,
      ],
    })
      })(),
      lang,
    ),
  )
}
