// Arcade — пробная игровая платформа в Claude Code: вопрос «сыграть?», панель с библиотекой игр и Денди.
// Правило мода: каждый обработчик событий Claude Code только наблюдает и всегда возвращает next(e).
// Требования проверки модов: обработчик в on(...) — сама функция, а $ всегда пишется как $.ui.open(...) и т. п.
import { Controller, createNes, frameToPng, frameToQuadrants, frameToSvg, screenSize } from './nes-screen.js'
import { SITE, bundledCatalog, bundledRom, minePageUrl, pageUrl, parseCatalog, restoreCatalog, siteUrl, tabPageUrl, verifyRom } from './catalog.js'
import { DETECT_ARGV, launchCommand, notifyCommand, openUrlCommand, parseDetection, windowBounds } from './browsers.js'
import { LANGS, LANG_NAMES, detectLang, tr, translateTree } from './i18n.js'
import { CONSOLE_NAMES, MINE_MAX_BYTES, cleanPath, identifyRom, mineId, restoreMine, sha256Hex, titleFromPath } from './mine.js'
import { LOGO_SVG } from './logo.js'

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
let pendingOpen = null // адрес игры, которую откроем, когда закончится текущий инструмент агента
let interrupting = false // ход оборвал Arcade: его конец — не «агент закончил»
let catalog = bundledCatalog() // каталог: с сайта, из сохранённой копии или запас из самого мода
let platform = null // windows | mac | linux; null — пока не знаем, окно браузера не предлагаем
let remoteSurface = null // панель с игрой нарисована в Desktop или VS Code — кадры идут перерисовкой, а не blit
let holdTicks = {} // поле ввода VS Code: кнопка Денди → сколько шагов ещё держать
let bandLength = 0 // VS Code: длина текста в строке 🎮 — новые буквы считаются нажатиями, стирание нет
let bandToken = '' // VS Code: «пустое» значение строки 🎮; чередуется '' и невидимый символ, чтобы VS Code заметил сброс
let bandResetWanted = false // VS Code: после нажатия стереть набранное при следующей отрисовке
let bandId = null // VS Code: requestId полосы над вводом — чтобы попробовать поставить фокус в поле при старте игры
let bandFocusWanted = false // VS Code: игра только что открылась — попробовать один раз

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
      const about = lang !== 'ru' && g.about_en ? g.about_en : g.about
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
    if (g.net === 'doom') count = Number(data?.doom) || 0
    else if (g.net === 'heretic-dm') count = Number(data?.dm?.[g.id]) || 0 // BlasphDM
    else if (g.net === 'heretic') count = Number(data?.coop?.[g.id]) || 0 // Blasphemer по сети — кооператив
    else if (g.console === 'doom') count = Number(data?.coop?.[g.id]) || 0 // кооператив Freedoom
    else if (g.kind === 'board') count = Number(data?.board?.[g.id]) || 0 // настольные: ждут в лобби поиска соперника
    else if (['nes', 'sega', 'sms', 'psx'].includes(g.console) && g.rom?.sha256) count = Number(data?.games?.[parseInt(g.rom.sha256.slice(0, 7), 16)]) || 0
    if (count > 0) list.push({ id: g.id, title: g.title, console: g.console, coop: g.console === 'doom' && g.net !== 'doom' && g.net !== 'heretic-dm', count })
  }
  return list.sort((a, b) => b.count - a.count)
}

function waitingText() {
  return netWaiting
    .slice(0, 2)
    .map((w) => `${w.title} (${w.count})`)
    .join(', ')
}

function paneColumns() {
  return wide ? WIDE_COLUMNS : PANE_COLUMNS
}

function workedSeconds(now) {
  return Math.max(0, Math.round((now - turnStartedAt) / 1000))
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
  menu = g?.mine ? 'mine' : g?.kind === 'book' && g?.shelf ? `genre:${g.shelf}:${g.genre}` : g?.shelf ? `shelf:${g.shelf}` : g?.console ?? 'settings' // в список, откуда игру открыли
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
  if (romBase64 && nesGame !== id) {
    nes = createNes(romBase64, (f) => {
      frame = f
    })
    nesGame = id
    nes.frame()
  }
}

// Сейчас в панели игра для Денди
function nesView() {
  return Boolean(gameById(view)?.rom)
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

function windowCommand(id) {
  const url = windowUrl(id)
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
    const result = await browse($, url, await arcadeTab($, consent), consent)
    if (!result?.isError) {
      await showBrowser($, consent)
      return 'opened'
    }
    log(`встроенный браузер ответил ошибкой: ${toolText(result).slice(0, 200)}`)
  } catch (err) {
    denied = err?.denied === true
    log(`встроенный браузер не открылся: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  // Отказ в разрешении — просим Claude; работает он — сначала прерываем, иначе просьба ждёт конца его хода
  if (denied && agentTurn) {
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
  if (pendingOpen !== url || toolsRunning === 0 || status === 'permission' || !agentTurn) return
  pendingOpen = null
  desktopNotice($, await interruptAgent($, url, true), '', url)
}

// Текущий инструмент агента закончился, а игра ждёт — прерываем ход. Ход уже кончился сам — просьба уходит как обычно
async function openPending($) {
  if (!pendingOpen || toolsRunning > 0) return
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
    const sent = await $.prompt.submit({ text: ask }).catch((err) => ({ drop: String(err?.message ?? err) }))
    if (!sent.drop) return 'sent'
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
  // инструмент агента, сколько бы он ни шёл
  if (outcome === 'manual') libraryNotice = `Попроси Claude открыть во встроенном браузере: ${url}`
  else if (outcome === 'waiting') libraryNotice = 'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть игру во встроенном браузере.'
  else
    windowNotice(
      $,
      outcome === 'opened'
        ? opened
        : outcome === 'interrupted'
          ? 'Arcade прервал Claude: он откроет игру во встроенном браузере и вернётся к работе.'
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
  opening = false
  pendingOpen = null
  libraryNotice = 'Открываю встроенный браузер…'
  $.ui.invalidate('ui.render')
  const outcome = await openDesktopBrowser($, id)
  desktopNotice($, outcome, opened, windowUrl(id))
  // Браузер встаёт под панелью Arcade, и игре тесно — панель закрываем. Назад — /arcade или «Библиотека» на сайте
  if (outcome === 'opened') await $.ui.close({ id: PANE })
}

// Игру открыл Claude по просьбе Arcade: панель Arcade закрываем. Вызов Claude панель браузера не показывает —
// показываем сами (в авто-режиме может и не выйти)
async function openedForArcade($, e) {
  opening = false
  await showBrowser($, desktopConsent(e.url))
  if (paneOpen) await $.ui.close({ id: PANE })
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
  const books = list.length > 0 && list.every((g) => g.kind === 'book')
  return count ? `${count} ${books ? plural(count, 'книга', 'книги', 'книг') : plural(count, 'игра', 'игры', 'игр')}` : 'скоро'
}

function settingsNote(surface) {
  if (surface === 'desktop') return desktopLabel().replace('Открывать: ', 'открывать: ')
  const where = windowMode() ? openerLabel().replace('Открывать: ', 'открывать: ') : 'играть здесь, в панели'
  return windowMode() ? where : `${where} · графика: ${GRAPHICS_LABEL[graphics]}`
}

function libraryTitle() {
  if (menu === 'settings') return 'Arcade · настройки'
  if (menu === 'lang') return 'Arcade · язык'
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
      keymap = restoreKeymap(await $.store.get('keys'))
      osNotify = (await $.store.get('notify')) !== false
      wide = (await $.store.get('wide')) === true
      const storedLang = await $.store.get('lang')
      lang = LANGS.includes(storedLang) ? storedLang : detectLang(await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG'))
      const storedDone = await $.store.get('onDone')
      const storedPermission = await $.store.get('onPermission')
      if (SIGNAL_MODES.includes(storedDone)) onDone = storedDone
      if (SIGNAL_MODES.includes(storedPermission)) onPermission = storedPermission
      mine = restoreMine(await $.store.get('mine'))
      const home = (await $.env.get('USERPROFILE')) || (await $.env.get('HOME'))
      if (home) {
        sep = home.includes('\\') ? '\\' : '/'
        dataDir = [home.replace(/[\\/]+$/, ''), '.claude', 'arcade', 'roms'].join(sep)
      }
      catalog = restoreCatalog(await $.store.get('catalog')) ?? catalog
      const savedGame = await $.store.get('lastGame')
      if (games().some((g) => g.id === savedGame)) lastGame = savedGame
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
  // пропускает ownDesktopCall; эти же инструменты у Claude решаются как обычно
  on('tool.check', { tool: DESKTOP_TOOLS }, async ($, e, next) => {
    if (next.origin.plugin === $.plugin.name && ownDesktopCall(e.tool, e.input))
      return { decision: 'allow', reason: 'Arcade открывает игру во встроенном браузере по нажатию в своей панели' }
    return next(e)
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
    if (save) await $.store.set('keys', keymap)
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
              if (save) await $.store.set('keys', keymap)
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
    const { Box, Text, Raster, Image, Button, Client, Svg, Input } = $.ui.resolve(e)
    const now = await $.clock.now()
    const terminal = e.surface === 'terminal'
    const game = gameById(view)
    remoteSurface = terminal ? null : e.surface

    // Шапка: логотип (Desktop и VS Code), название, состояние агента цветом: работает — жёлтый, ждёт разрешения —
    // красный, закончил — зелёный, свободен — серый
    const statusColor = status === 'permission' ? 'red' : status === 'working' ? 'yellow' : status === 'done' ? 'green' : 'gray'
    const header = Box({
      flexDirection: 'row',
      columnGap: 2,
      alignItems: 'center',
      children: [
        // логотип — только в главном меню библиотеки в Desktop: над экраном игры он не нужен
        ...(!game && menu === 'main' && e.surface === 'desktop' ? [Svg({ source: LOGO_SVG, alt: 'Arcade', width: 28, height: 28 })] : []),
        Text({ bold: true, children: [game ? `Arcade · ${game.title}` : libraryTitle()] }),
        Box({
          flexDirection: 'row',
          columnGap: 1,
          children: [
            Text({ color: statusColor, children: ['●'] }),
            Text({ color: statusColor, children: [statusText(now)] }),
          ],
        }),
      ],
    })
    const eventLines = (events.length ? events : ['пока ничего']).slice(0, 3).map((text) => Text({ dimColor: true, children: [text] }))

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
      const gameButton = (g, focus) =>
        Button({
          key: `arcade-game-${g.id}`,
          label: g.title,
          ...(focus ? { autoFocus: true } : {}),
          onPress: async () => {
            // Всё, кроме Денди, идёт только в окне браузера (EmulatorJS на сайте): в панели показать нечем
            const sega = Boolean(g.console) && g.console !== 'nes' // у «Проверки клавиш» приставки нет — она в панели
            if (sega && builtinBrowser(e.surface, mouseGame(g.id))) {
              lastGame = g.id
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
          },
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
      const section = (title) => Text({ bold: true, dimColor: true, children: [title] })
      const tiles = (list) => {
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
      const noticeLines = libraryNotice ? [gap, Text({ color: 'yellow', children: [libraryNotice] })] : []
      const hint = [gap, dim('↑ ↓ или Tab — выбрать, Enter — открыть. Можно кликнуть мышью.')]

      let items
      if (menu === 'lang') {
        // Выбор языка: каждый подписан на самом себе, текущий отмечен
        items = [
          Button({ key: 'arcade-back', label: '← Назад', onPress: open(langReturn) }),
          gap,
          ...LANGS.map((code) =>
            Button({
              key: `arcade-lang-${code}`,
              label: `${LANG_NAMES[code]}${code === lang ? ' ✓' : ''}`,
              ...(code === lang ? { autoFocus: true } : {}),
              onPress: async () => {
                lang = code
                menu = langReturn
                $.ui.invalidate('ui.render')
                await $.store.set('lang', lang)
              },
            }),
          ),
          ...hint,
        ]
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
              await $.store.set('wide', wide)
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
              await $.store.set('onDone', onDone)
            },
          }),
          Button({
            key: 'arcade-on-permission',
            label: `Когда агент ждёт разрешения: ${SIGNAL_LABELS[onPermission]}`,
            onPress: async () => {
              onPermission = SIGNAL_MODES[(SIGNAL_MODES.indexOf(onPermission) + 1) % SIGNAL_MODES.length]
              $.ui.invalidate('ui.render')
              await $.store.set('onPermission', onPermission)
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
                    await $.store.set('notify', osNotify)
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
        items = [
          back,
          gap,
          ...shelvesHere.flatMap((s, i) => {
            const n = shelfGames(s.id).length
            return [
              Button({ key: `arcade-menu-shelf-${s.id}`, label: s.title, ...((menuFrom ? menuFrom === `shelf:${s.id}` : i === 0) ? { autoFocus: true } : {}), onPress: open(`shelf:${s.id}`) }),
              dim(`  ${n} ${shelfGames(s.id).every((g) => g.kind === 'book') ? plural(n, 'книга', 'книги', 'книг') : plural(n, 'игра', 'игры', 'игр')}`),
            ]
          }),
          ...noticeLines,
          ...hint,
        ]
      } else if (menu.startsWith('genre:') || (shelfView(menu) && shelfView(menu).list.length && shelfView(menu).list.every((g) => g.kind === 'book'))) {
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
                return [
                  Button({ key: `arcade-genre-${i}`, label: genreLabel(g), ...((menuFrom ? menuFrom === `genre:${shelfMenu.slice(6)}:${g}` : i === 0) ? { autoFocus: true } : {}), onPress: open(`genre:${shelfMenu.slice(6)}:${g}`) }),
                  dim(`  ${n} ${plural(n, 'книга', 'книги', 'книг')}`),
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
            ...list.flatMap((g) => [gameButton(g, g.id === focusId), dim(`  ${g.note}`)]),
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
        items = [
          shelf ? Button({ key: 'arcade-back', label: '← Назад', onPress: open(shelf.group) }) : back,
          gap,
          ...(list.length
            ? list.flatMap((g) => [gameButton(g, g.id === focusId), dim(`  ${g.note}`)])
            : [Text({ children: [c.empty ?? c.soon ?? 'Здесь пока нет игр.'] })]),
          // Всё, кроме Денди, идёт только в окне браузера: там и свои файлы — кнопкой «Открыть свой файл»
          ...(c.id !== 'nes'
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
            ? [gap, dim(`Игры открываются ${builtin && c.id !== 'nes' ? 'во встроенном браузере Claude' : opensWindow(e.surface) || (e.surface === 'desktop' && c.id !== 'nes') ? whereText() : 'здесь, в панели'}.`)]
            : []),
          // Шутеры в Desktop идут окном и при выбранном встроенном браузере — объясняем почему
          ...(list.length && !builtin && builtinBrowser(e.surface)
            ? [dim(MOUSE_NOTE)]
            : []),
          ...noticeLines,
          ...hint,
        ]
      } else {
        const tabItems = (list) =>
          list.flatMap((c) => [
            Button({
              key: `arcade-menu-${c.id}`,
              label: c.title,
              ...((menuFrom ?? consoles()[0]?.id) === c.id ? { autoFocus: true } : {}),
              onPress: open(c.id),
            }),
            dim(`  ${consoleNote(c)}`),
          ])
        const reading = menuTabs().filter((c) => c.id === 'reading' || c.id === 'books')
        items = [
          section('Играть'),
          tiles(tabItems(menuTabs().filter((c) => !reading.includes(c)))),
          ...(reading.length ? [section('Читать'), tiles(tabItems(reading))] : []),
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
          gap,
          ...eventLines,
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
      game.id === 'thwaite'
        ? `прицел ${moves} · огонь ${first('b')} ${first('a')} · Start ${first('start')}`
        : `движение ${moves} · A ${first('a')} · B ${first('b')} · Start ${first('start')}`
    // Назначение клавиш или сообщение мода; иначе — подсказка для этой поверхности
    const message = paused
      ? Text({
          color: 'yellow',
          children: [`Пауза: ${agentAlert === 'permission' ? 'агент ждёт разрешения' : 'агент закончил'}. Любая клавиша игры — играть дальше, Esc — к агенту`],
        })
      : mode === 'assign'
        ? Text({ color: 'yellow', children: [`${notice} Нажми клавишу для «${ACTIONS[assignStep].label}» (${assignStep + 1} из ${ACTIONS.length})`] })
        : notice
          ? Text({ color: 'yellow', children: [notice] })
          : null

    // Desktop и VS Code: кадр Денди — PNG внутри Svg, панель перерисовывается каждый шаг игры
    if (!terminal) {
      if (!game.rom) {
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

    if (game.rom) {
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
