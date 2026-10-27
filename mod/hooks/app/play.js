// Arcade: Денди, Flappy, проверка клавиш, раскладка и ввод.
import { Controller, createNes, frameToPng, frameToQuadrants } from '../nes-screen.js'
import { createFlappy } from '../flappy.js'
import { ACTIONS, ARROWS, COLS, DEFAULT_COLOR, FLOOR_COLOR, GRAPHICS_LABEL, HOLD_TICKS_FIRST, HOLD_TICKS_REPEAT, IME_CHARS, PANE, PANE_ROWS, PLAYER_COLOR, ROWS, S, UI_ROWS } from './state.js'
import { gameById } from './library.js'
import { log, paneColumns } from './status.js'

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
    const fresh = n >= before ? n - before : n // экран игры создан заново — счёт пошёл с нуля
    S.lastCounts[key] = n
    if (S.paused && fresh > 0 && S.view !== 'field') {
      S.paused = false
      S.agentAlert = null
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

export function first(id) {
  return S.keymap[id].find((k) => !ARROWS.includes(k)) ?? S.keymap[id][0] ?? '?'
}
