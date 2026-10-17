// Arcade — пробная игровая платформа в Claude Code: вопрос «сыграть?», панель с библиотекой игр и Денди.
// Правило мода: каждый обработчик событий Claude Code только наблюдает и всегда возвращает next(e).
// Требования проверки модов: обработчик в on(...) — сама функция, а $ всегда пишется как $.ui.open(...) и т. п.
import { Controller, createNes, frameToPng, frameToQuadrants, screenSize } from './nes-screen.js'
import THWAITE_ROM from './roms/thwaite.mjs'
import CROOM_ROM from './roms/croom.mjs'
import RFK_ROM from './roms/rfk.mjs'
import { DETECT_ARGV, gameUrl, launchCommand, parseDetection, windowBounds } from './browsers.js'

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

const LAUNCH_TIMEOUT_MS = 20_000 // сколько ждать PowerShell, который ищет браузеры или открывает окно

// Меню: главное — приставки; приставка — её игры; настройки — где открывать, графика, проверка клавиш
const CONSOLES = [
  { id: 'nes', title: 'Денди' },
  { id: 'sega', title: 'Sega', soon: 'Скоро: эмулятор Mega Drive и свободные игры.' },
]

// console — в какой приставке игра; rom — игра для Денди; web — у игры есть страница для окна браузера (web/)
const GAMES = [
  { id: 'thwaite', console: 'nes', title: 'Thwaite', note: 'сбивай ракеты над городом. Damian Yerrick, GPL-3.0', rom: THWAITE_ROM, web: true },
  { id: 'croom', console: 'nes', title: 'Concentration Room', note: 'найди пару. Damian Yerrick, GPL-3.0', rom: CROOM_ROM, web: true },
  { id: 'rfk', console: 'nes', title: 'robotfindskitten', note: 'робот ищет котёнка. Damian Yerrick, zlib', rom: RFK_ROM, web: true },
  { id: 'field', console: null, title: 'Проверка клавиш', note: 'поле: видно, что нажато и что мод считает зажатым' },
]

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
let isWindows = false // окно браузера пока умеем открывать только на Windows
let profileRoot = '' // папка для отдельного профиля браузера с игрой: %LOCALAPPDATA%\claude-arcade
let detection = null // что нашёл поиск браузеров: { browsers, defaultId, screen }; null — ещё ищем
let opener = null // где открывать игры: 'window' или 'pane'; null — по умолчанию (на Windows — окно)
let browserChoice = 'default' // каким браузером: 'default' или id найденного
let libraryNotice = '' // что случилось при последнем запуске окна

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
}

// Буквы и стрелки; Enter, Tab, пробел и цифры в играх не используются — ими отвечают Claude Code
function usableKey(key) {
  return key.length === 1 ? !/^\d$/.test(key) && key !== ' ' : ARROWS.includes(key)
}

function toLibrary() {
  releaseAll()
  menu = GAMES.find((g) => g.id === view)?.console ?? 'settings' // в список той же приставки
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

function launch(id) {
  releaseAll()
  view = id
  lastGame = id
  notice = ''
  const game = GAMES.find((g) => g.id === id)
  if (game?.rom && nesGame !== id) {
    nes = createNes(game.rom, (f) => {
      frame = f
    })
    nesGame = id
    nes.frame()
  }
}

// Сейчас в панели игра для Денди
function nesView() {
  return Boolean(GAMES.find((g) => g.id === view)?.rom)
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
  return isWindows && (opener ?? 'window') === 'window'
}

function webGame(id) {
  return GAMES.find((g) => g.id === id)?.web === true
}

// Чем открыть окно: выбранный браузер, браузер по умолчанию, если его узнали, или то, что открывает ссылки
function windowTarget() {
  const browsers = detection?.browsers ?? []
  const id = browserChoice === 'default' ? detection?.defaultId : browserChoice
  const browser = browsers.find((b) => b.id === id)
  return browser ? { kind: 'browser', browser } : { kind: 'default' }
}

function windowCommand(root, id) {
  return launchCommand(windowTarget(), gameUrl(root, id), windowBounds(detection?.screen ?? null), profileRoot)
}

// Что сказать после попытки открыть окно
function launchNotice(result, id) {
  const title = id ? GAMES.find((g) => g.id === id)?.title ?? id : 'Arcade'
  if (result?.exitCode === 0) {
    const target = windowTarget()
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
  const browsers = detection?.browsers ?? []
  return [
    { opener: 'window', browser: 'default' },
    ...browsers.map((b) => ({ opener: 'window', browser: b.id })),
    { opener: 'pane', browser: browserChoice },
  ]
}

function openerLabel() {
  if (!windowMode()) return 'Открывать: здесь, в панели'
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
  const count = GAMES.filter((g) => g.console === c.id).length
  return count ? `${count} ${plural(count, 'игра', 'игры', 'игр')}` : 'скоро'
}

function settingsNote() {
  const where = windowMode() ? openerLabel().replace('Открывать: ', 'открывать: ') : 'играть здесь, в панели'
  return windowMode() ? where : `${where} · графика: ${GRAPHICS_LABEL[graphics]}`
}

function libraryTitle() {
  if (menu === 'settings') return 'Arcade · настройки'
  const c = CONSOLES.find((x) => x.id === menu)
  return c ? `Arcade · ${c.title}` : 'Arcade'
}

// Где откроется игра — для подсказки под списком игр
function whereText() {
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

export function register(on) {
  on('session.start', async ($, e, next) => {
    try {
      keymap = restoreKeymap(await $.store.get('keys'))
      const savedGame = await $.store.get('lastGame')
      if (GAMES.some((g) => g.id === savedGame)) lastGame = savedGame
      const savedGraphics = await $.store.get('graphics')
      if (GRAPHICS.includes(savedGraphics)) graphics = savedGraphics
      const savedOpener = await $.store.get('opener')
      if (savedOpener?.opener === 'window' || savedOpener?.opener === 'pane') {
        opener = savedOpener.opener
        browserChoice = typeof savedOpener.browser === 'string' ? savedOpener.browser : 'default'
      }
      isWindows = (await $.env.get('OS')) === 'Windows_NT'
      const localAppData = await $.env.get('LOCALAPPDATA')
      profileRoot = localAppData ? `${localAppData}\\claude-arcade` : ''
      // Браузеры ищем в фоне: PowerShell стартует за полсекунды, сессию из-за него не держим
      if (isWindows) {
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
      // Раз в секунду: проверить порог вопроса и обновить счётчик секунд
      $.clock.every(1000, async () => {
        const now = await $.clock.now()
        if (status === 'working' && !asked && !paneOpen && now - turnStartedAt >= ASK_AFTER_MS) {
          askVisible = true
        }
        if (askVisible || paneOpen) $.ui.invalidate('ui.render')
      })
      // Игровой цикл Денди: идёт, только пока открыта панель с Thwaite
      $.clock.every(TICK_MS, async () => {
        if (!nesView() || !paneOpen || !nes || !screen) return
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
    if (!askVisible) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const now = await $.clock.now()
    return Box({
      flexDirection: 'row',
      columnGap: 2,
      children: [
        Text({ children: [`Агент работает ${workedSeconds(now)} с — сыграть?`] }),
        Button({
          key: 'arcade-play',
          label: 'Играть',
          hotkey: '1',
          plain: true,
          onPress: async () => {
            if (windowMode() && webGame(lastGame)) {
              asked = true
              askVisible = false
              const command = windowCommand($.plugin.root, lastGame)
              try {
                const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                libraryNotice = launchNotice(result, lastGame)
              } catch (err) {
                libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
              }
              $.ui.invalidate('ui.render')
              await $.ui.toast(libraryNotice)
              return
            }
            markPaneOpen()
            await $.ui.open({ id: PANE, title: 'Arcade', focus: true, closeOnEscape: true, columns: PANE_COLUMNS, rows: PANE_ROWS })
            $.ui.invalidate('ui.render')
          },
        }),
        Button({
          key: 'arcade-later',
          label: 'Не сейчас',
          hotkey: '2',
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
    const { Box, Text, Raster, Image, Button, Client } = $.ui.resolve(e)
    const now = await $.clock.now()
    const terminal = e.surface === 'terminal'
    const game = GAMES.find((g) => g.id === view)

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
      // Игра открывается в окне браузера или здесь, в панели
      const gameButton = (g, focus) =>
        Button({
          key: `arcade-game-${g.id}`,
          label: g.title,
          ...(focus ? { autoFocus: true } : {}),
          onPress: async () => {
            lastGame = g.id
            if (windowMode() && g.web) {
              libraryNotice = 'Открываю окно…'
              $.ui.invalidate('ui.render')
              const command = windowCommand($.plugin.root, g.id)
              try {
                const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                libraryNotice = launchNotice(result, g.id)
              } catch (err) {
                libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
              }
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
        const field = GAMES.find((g) => g.id === 'field')
        items = [
          back,
          gap,
          ...(isWindows
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
                  windowMode()
                    ? '  окно встаёт справа от терминала; пауза, пока оно не в фокусе; прогресс сохраняется'
                    : '  символы или пиксели — зависит от терминала',
                ),
              ]
            : []),
          ...(windowMode()
            ? []
            : [
                Button({
                  key: 'arcade-graphics',
                  label: graphicsLabel(),
                  ...(isWindows ? {} : { autoFocus: true }),
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
          gameButton(field, false),
          dim(`  ${field.note}`),
          dim('  /arcade-keys — назначить клавиши заново'),
          ...noticeLines,
          ...hint,
        ]
      } else if (menu !== 'main') {
        const c = CONSOLES.find((x) => x.id === menu) ?? CONSOLES[0]
        const list = GAMES.filter((g) => g.console === c.id)
        const focusId = list.some((g) => g.id === lastGame) ? lastGame : list[0]?.id
        items = [
          back,
          gap,
          ...(list.length
            ? list.flatMap((g) => [gameButton(g, g.id === focusId), dim(`  ${g.note}`)])
            : [Text({ children: [c.soon ?? 'Здесь пока нет игр.'] })]),
          ...(windowMode() && list.length ? [gap, dim(`Игры открываются ${whereText()}.`)] : []),
          ...noticeLines,
          ...hint,
        ]
      } else {
        items = [
          ...CONSOLES.flatMap((c) => [
            Button({
              key: `arcade-menu-${c.id}`,
              label: c.title,
              ...((menuFrom ?? CONSOLES[0].id) === c.id ? { autoFocus: true } : {}),
              onPress: open(c.id),
            }),
            dim(`  ${consoleNote(c)}`),
          ]),
          gap,
          ...(windowMode()
            ? [
                Button({
                  key: 'arcade-open-library',
                  label: 'Окно Arcade',
                  onPress: async () => {
                    libraryNotice = 'Открываю окно…'
                    $.ui.invalidate('ui.render')
                    const command = windowCommand($.plugin.root, null)
                    try {
                      const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                      libraryNotice = launchNotice(result, null)
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

    if (!terminal) {
      return Box({
        flexDirection: 'column',
        children: [
          header,
          Text({ children: ['Игры пока работают только в терминале.'] }),
          Button({
            key: 'arcade-library',
            label: 'Библиотека',
            autoFocus: true,
            onPress: () => {
              toLibrary()
              $.ui.invalidate('ui.render')
            },
          }),
        ],
      })
    }

    // Подсказка, или назначение клавиш, или сообщение мода
    const line =
      mode === 'assign'
        ? Text({ color: 'yellow', children: [`${notice} Нажми клавишу для «${ACTIONS[assignStep].label}» (${assignStep + 1} из ${ACTIONS.length})`] })
        : notice
          ? Text({ color: 'yellow', children: [notice] })
          : Text({ dimColor: true, children: ['Кликни по экрану — играть · Esc — к агенту · Backspace — библиотека'] })

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
      const moves = `${first('up')} ${first('left')} ${first('down')} ${first('right')} или стрелки`
      const legend =
        game.id === 'thwaite'
          ? `прицел ${moves} · огонь ${first('b')} ${first('a')} · Start ${first('start')}`
          : `движение ${moves} · A ${first('a')} · B ${first('b')} · Start ${first('start')}`
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
