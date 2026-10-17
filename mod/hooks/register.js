// Arcade — пробная игровая платформа в Claude Code: вопрос «сыграть?», панель с библиотекой игр и Денди.
// Правило мода: каждый обработчик событий Claude Code только наблюдает и всегда возвращает next(e).
// Требования проверки модов: обработчик в on(...) — сама функция, а $ всегда пишется как $.ui.open(...) и т. п.
import { Controller, createNes, frameToPng, frameToQuadrants, frameToSvg, screenSize } from './nes-screen.js'
import { bundledCatalog, bundledRom, minePageUrl, pageUrl, parseCatalog, restoreCatalog, siteUrl, tabPageUrl, verifyRom } from './catalog.js'
import { DETECT_ARGV, launchCommand, notifyCommand, parseDetection, windowBounds } from './browsers.js'
import { MINE_MAX_BYTES, cleanPath, identifyRom, mineId, restoreMine, sha256Hex, titleFromPath } from './mine.js'

const PANE = 'arcade'
const INPUT = 'arcade-input' // ключ элемента Client, который ловит клавиши над экраном игры (hooks/input.js)
const ASK_AFTER_MS = 20_000 // через сколько работы агента показать вопрос; для быстрой проверки поставь 5_000
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

const ROM_CACHE_LIMIT = 8 // сколько скачанных игр держать в хранилище мода (у него предел 4 МиБ на всё)
const REMOTE_MAX_WIDTH = 768 // в Desktop и VS Code экран Денди не шире ×3
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
let view = 'library' // library или id игры (field — проверка клавиш)
let menu = 'main' // что открыто в библиотеке: main, id приставки или settings
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
let libraryNotice = '' // что случилось при последнем запуске окна
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

// Игры каталога и проверка клавиш; note — строка под названием в меню
function games() {
  return [
    ...catalog.games.map((g) => ({ ...g, note: `${g.genre} — ${g.about}`, web: true })),
    ...mine.map((m) => ({
      id: m.id,
      console: m.console,
      title: m.title,
      note: `${m.console === 'nes' ? 'Денди' : 'Sega Mega Drive'} — твой файл, хранится только у тебя`,
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

function workedSeconds(now) {
  return Math.max(0, Math.round((now - turnStartedAt) / 1000))
}

function statusText(now) {
  if (status === 'working') return `Агент работает ${workedSeconds(now)} с`
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
  menu = g?.mine ? 'mine' : g?.console ?? 'settings' // в список, откуда игру открыли
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
// В VS Code по умолчанию игра в панели, окно — только если его выбрали явно. В Desktop мод не запускает программы.
function opensWindow(surface) {
  if (!windowMode()) return false
  if (surface === 'terminal') return true
  return surface === 'vscode' && opener === 'window'
}

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
  if (typeof id === 'string' && id.startsWith('tab:')) return tabPageUrl(id.slice(4))
  const m = mine.find((x) => x.id === id)
  return m ? minePageUrl(m) : pageUrl(id)
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

// Варианты «где открывать» по кругу: браузер по умолчанию, каждый найденный браузер, панель
function openerOptions() {
  const browsers = platform === 'windows' ? detection?.browsers ?? [] : []
  return [
    { opener: 'window', browser: 'default' },
    ...browsers.map((b) => ({ opener: 'window', browser: b.id })),
    { opener: 'pane', browser: browserChoice },
  ]
}

function openerLabel() {
  if (!windowMode()) return 'Открывать: здесь, в панели'
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
  const count = games().filter((g) => g.console === c.id && !g.mine).length
  return count ? `${count} ${plural(count, 'игра', 'игры', 'игр')}` : 'скоро'
}

function settingsNote() {
  const where = windowMode() ? openerLabel().replace('Открывать: ', 'открывать: ') : 'играть здесь, в панели'
  return windowMode() ? where : `${where} · графика: ${GRAPHICS_LABEL[graphics]}`
}

function libraryTitle() {
  if (menu === 'settings') return 'Arcade · настройки'
  if (menu === 'mine') return 'Arcade · мои игры'
  const c = consoles().find((x) => x.id === menu)
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
      const info = identifyRom(bytes)
      if (info.error) throw new Error(info.error)
      const sha = await sha256Hex(bytes)
      const title = titleFromPath(path)
      if (mine.some((m) => m.sha256 === sha)) {
        message = `«${title}» уже есть в «Моих играх».`
      } else {
        await $.fs.write(mineFile(sha), base64)
        mine = [...mine, { id: mineId(sha), console: info.console, title, sha256: sha }]
        await $.store.set('mine', mine)
        message = `Добавлено: ${title} (${info.console === 'nes' ? 'Денди' : 'Sega Mega Drive'}).`
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
      if (savedOpener?.opener === 'window' || savedOpener?.opener === 'pane') {
        opener = savedOpener.opener
        browserChoice = typeof savedOpener.browser === 'string' ? savedOpener.browser : 'default'
      }
      const localAppData = await $.env.get('LOCALAPPDATA')
      profileRoot = localAppData ? `${localAppData}\\claude-arcade` : ''
      if ((await $.env.get('OS')) === 'Windows_NT') platform = 'windows'
      // Каталог с сайта и ОС — в фоне, чтобы не держать старт сессии
      $.clock.after(150, async () => {
        try {
          const response = await $.http.fetch(siteUrl('catalog.json'))
          const fresh = response.ok ? parseCatalog(response.text) : null
          if (fresh) {
            catalog = fresh
            await $.store.set('catalog', { consoles: fresh.consoles, games: fresh.games })
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
      await $.command.register({ name: 'arcade', description: 'Открыть Arcade', immediate: true })
      await $.command.register({ name: 'arcade-keys', description: 'Arcade: назначить клавиши заново', immediate: true })
      await $.command.register({
        name: 'arcade-add',
        description: 'Arcade: добавить свою игру — файл ROM Денди или Sega',
        argumentHint: 'путь к файлу .nes, .md или .bin',
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
        if (!nesView() || !paneOpen || !nes) return
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
    try {
      status = 'working'
      turnStartedAt = await $.clock.now()
      asked = false
      askVisible = false
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
      log(`запрос разрешения: ${e.tool_name ?? 'инструмент'}`)
      const now = await $.clock.now()
      const command = osNotify && windowOpenedAt && now - windowOpenedAt < NOTIFY_WINDOW_MS
        ? notifyCommand(platform, 'Claude Code', 'Агент ждёт разрешения')
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
    try {
      status = 'done'
      askVisible = false
      log('агент закончил ход')
      if (paneOpen) await $.ui.toast('Агент закончил — Esc, чтобы вернуться')
      // Играешь в окне браузера — Claude Code не видно: системное уведомление, если ход был долгим
      const now = await $.clock.now()
      const command = osNotify && windowOpenedAt && now - windowOpenedAt < NOTIFY_WINDOW_MS && now - turnStartedAt >= ASK_AFTER_MS
        ? notifyCommand(platform, 'Claude Code', 'Агент закончил — можно возвращаться')
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
      releaseAll() // Денди стоит на паузе, пока панель закрыта
    }
    return next(e)
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
    await $.ui.open({ id: PANE, title: 'Arcade', focus: true, closeOnEscape: true, columns: PANE_COLUMNS, rows: PANE_ROWS })
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
    await $.ui.open({ id: PANE, title: 'Arcade', focus: true, closeOnEscape: true, columns: PANE_COLUMNS, rows: PANE_ROWS })
    $.ui.invalidate('ui.render')
    return {}
  })

  on('command.run', { command: 'arcade-keys' }, async ($) => {
    if (view === 'library') launch('field')
    startAssign('Назначаем управление заново.')
    markPaneOpen()
    await $.ui.open({ id: PANE, title: 'Arcade', focus: true, closeOnEscape: true, columns: PANE_COLUMNS, rows: PANE_ROWS })
    $.ui.invalidate('ui.render')
    return {}
  })

  // Полоса над полем ввода: «1» — играть, «2» — не сейчас (цифра в пустом поле ввода и пауза).
  // Пока вопрос виден, полоса занята целиком: то, что рисуют там другие моды, скрыто.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
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
    if (!askVisible) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const now = await $.clock.now()
    const canWindow = platform !== null && e.surface !== 'desktop' && webGame(lastGame)
    return Box({
      flexDirection: 'row',
      columnGap: 2,
      children: [
        Text({ children: [`Агент работает ${workedSeconds(now)} с — сыграть?`] }),
        // «Здесь» — панель Claude Code: в VS Code и Desktop картинкой, в терминале символами или пикселями.
        // «В окне» — браузер; его нет в Desktop (там мод не запускает программы) и пока ОС не определена.
        Button({
          key: 'arcade-play',
          label: canWindow ? 'Здесь' : 'Играть',
          hotkey: '1',
          plain: true,
          onPress: async () => {
            markPaneOpen()
            await $.ui.open({ id: PANE, title: 'Arcade', focus: true, closeOnEscape: true, columns: PANE_COLUMNS, rows: PANE_ROWS })
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
                  const command = windowCommand(lastGame)
                  try {
                    const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                    libraryNotice = launchNotice(result, lastGame)
                    if (result?.exitCode === 0) windowOpenedAt = await $.clock.now()
                  } catch (err) {
                    libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
                  }
                  $.ui.invalidate('ui.render')
                  await $.ui.toast(libraryNotice)
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
  })

  // Панель: библиотека игр или сама игра. Клавиши над экраном игры ловит Client (hooks/input.js)
  // после клика по экрану, в любой раскладке.
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Raster, Image, Button, Client, Svg, Input } = $.ui.resolve(e)
    const now = await $.clock.now()
    const terminal = e.surface === 'terminal'
    const game = gameById(view)
    remoteSurface = terminal ? null : e.surface

    const header = Box({
      flexDirection: 'row',
      columnGap: 2,
      children: [
        Text({ bold: true, children: [game ? `Arcade · ${game.title}` : libraryTitle()] }),
        Text({ color: status === 'permission' ? 'yellow' : 'green', children: [statusText(now)] }),
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
            // Sega идёт только в окне браузера (EmulatorJS на сайте): в панели её показать нечем
            const sega = g.console === 'sega'
            if (sega && (!platform || e.surface === 'desktop')) {
              libraryNotice = 'Игры Sega идут в окне браузера, а здесь его открыть нельзя.'
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
                libraryNotice = launchNotice(result, g.id)
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
      const noticeLines = libraryNotice ? [gap, Text({ color: 'yellow', children: [libraryNotice] })] : []
      const hint = [gap, dim('↑ ↓ или Tab — выбрать, Enter — открыть. Можно кликнуть мышью.')]

      let items
      if (menu === 'settings') {
        const field = FIELD
        items = [
          back,
          gap,
          ...(platform
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
          ...(windowMode()
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
          gameButton(field, false),
          dim(`  ${field.note}`),
          dim('  /arcade-keys — назначить клавиши заново'),
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
      } else if (menu !== 'main') {
        const c = consoles().find((x) => x.id === menu) ?? consoles()[0]
        const list = games().filter((g) => g.console === c.id && !g.mine)
        const focusId = list.some((g) => g.id === lastGame) ? lastGame : list[0]?.id
        items = [
          back,
          gap,
          ...(list.length
            ? list.flatMap((g) => [gameButton(g, g.id === focusId), dim(`  ${g.note}`)])
            : [Text({ children: [c.empty ?? c.soon ?? 'Здесь пока нет игр.'] })]),
          // PlayStation идёт только в окне браузера: свои диски добавляются там, кнопкой «Открыть свой файл»
          ...(c.id === 'psx'
            ? platform && e.surface !== 'desktop'
              ? [
                  gap,
                  Button({
                    key: 'arcade-open-tab-psx',
                    label: 'Открыть PlayStation в окне',
                    autoFocus: !list.length,
                    onPress: async () => {
                      const command = windowCommand('tab:psx')
                      try {
                        const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                        libraryNotice = result?.exitCode === 0 ? 'Окно Arcade открыто на вкладке PlayStation.' : launchNotice(result, null)
                        if (result?.exitCode === 0) windowOpenedAt = await $.clock.now()
                      } catch (err) {
                        libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
                      }
                      $.ui.invalidate('ui.render')
                    },
                  }),
                ]
              : [gap, dim('PlayStation идёт в окне браузера, а здесь его открыть нельзя.')]
            : []),
          ...(list.length ? [gap, dim(`Игры открываются ${opensWindow(e.surface) ? whereText() : 'здесь, в панели'}.`)] : []),
          ...noticeLines,
          ...hint,
        ]
      } else {
        items = [
          ...consoles().flatMap((c) => [
            Button({
              key: `arcade-menu-${c.id}`,
              label: c.title,
              ...((menuFrom ?? consoles()[0]?.id) === c.id ? { autoFocus: true } : {}),
              onPress: open(c.id),
            }),
            dim(`  ${consoleNote(c)}`),
          ]),
          gap,
          ...(windowMode() && e.surface !== 'desktop'
            ? [
                Button({
                  key: 'arcade-open-library',
                  label: 'Окно Arcade',
                  onPress: async () => {
                    libraryNotice = 'Открываю окно…'
                    $.ui.invalidate('ui.render')
                    const command = windowCommand(null)
                    try {
                      const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                      libraryNotice = launchNotice(result, null)
                      if (result?.exitCode === 0) windowOpenedAt = await $.clock.now()
                    } catch (err) {
                      libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
                    }
                    $.ui.invalidate('ui.render')
                  },
                }),
                dim('  все игры и статистика в окне браузера'),
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
          dim(`  ${settingsNote()}`),
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
    const message =
      mode === 'assign'
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
      const scale = Math.max(1, Math.min(REMOTE_MAX_WIDTH / 256, Math.floor(((e.props.bodyColumns ?? 60) * 7.5) / 256)))
      const width = 256 * scale
      const height = 240 * scale
      const picture = Svg({ source: frameToSvg(frame, width, height), alt: game.title, width, height })
      // В Desktop клавиши ловит Client поверх экрана, как в терминале; в VS Code его пока нет
      if (e.surface === 'desktop') {
        return Box({
          flexDirection: 'column',
          children: [
            header,
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
          message ?? Text({ dimColor: true, children: ['Клавиатура — в поле «клавиши для игры» над строкой ввода Claude · кнопки — мышью'] }),
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
        Text({ dimColor: true, children: ['/arcade-keys — назначить клавиши'] }),
        Text({ children: [' '] }),
        ...eventLines,
      ],
    })
  })
}
