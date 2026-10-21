import { expect, mock, test } from 'claude-code/testing'
import { encodePowerShell, launchCommand, notifyCommand, NOTIFY_SCRIPT_TEXT, parseDetection, windowBounds } from '../hooks/browsers.js'
import { SITE, bundledCatalog, pageUrl, parseCatalog, verifyRom } from '../hooks/catalog.js'
import { cleanPath, identifyRom, restoreMine, titleFromPath } from '../hooks/mine.js'
import { ownDesktopCall, workedText } from '../hooks/register.js'
import { detectLang, tr, fromEnglish, resetLocaleCache } from '../hooks/i18n.js'
import { LOCALES } from '../hooks/locales/index.js'
import { NES, Mappers } from '../hooks/vendor/jsnes.mjs'
import { installMapper28, prgBank } from '../hooks/mapper28.js'
import THWAITE_ROM from '../hooks/roms/thwaite.mjs'

// Что Claude Code передаёт хуку ui.render для панели, кроме приложения
const PANE = {
  plugin: 'arcade',
  component: 'Pane',
  requestId: 'arcade',
  viewport: { columns: 160, rows: 40 },
  props: {
    title: 'Arcade',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const BAND = {
  plugin: 'arcade',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  viewport: { columns: 160, rows: 40 },
  props: { hasSurvey: false, isWorking: true, maxRows: 3, bodyColumns: 100, scroll: { offset: 0, bodyRows: 3 }, view: {} },
} as const

// Заглушки на всё, о чём мод спрашивает Claude Code. Регистрируются до первого вызова $
// Что нашёл бы поиск браузеров на Windows: Chrome по умолчанию и Firefox, экран 1920×1040
const DETECTED = JSON.stringify({
  browsers: [
    { id: 'chrome', name: 'Google Chrome', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', app: true },
    { id: 'firefox', name: 'Firefox', path: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe', app: false },
  ],
  defaultProgId: 'ChromeHTML',
  screen: { x: 0, y: 0, width: 1920, height: 1040 },
})
// Тесты пишутся на русском интерфейсе: язык окружения — русский (без него теперь английский)
const WINDOWS = { OS: 'Windows_NT', LOCALAPPDATA: 'C:\\Users\\max\\AppData\\Local', LANG: 'ru_RU.UTF-8' }

// Каталог, который отдаёт сайт: три игры Денди (они же лежат в моде) и сколько угодно своих
const SHA = {
  thwaite: 'ee51cd9562f28195ba015d9857c6c4fc9bf67cdfb213e95f655e586b92195173',
  croom: 'c24c1aec75242d3bc80b35c15deb705d35f4cd778b22d1cf1df8b38d8dd62726',
  rfk: '0778e86400a536407fd94d10619208c06dd120d0f5f28ad79778690048dd0091',
}
function siteGame(title: string, sha: string) {
  return { console: 'nes', title, genre: 'аркада', about: `${title} с сайта`, keys: '…', rom: { url: `files/${sha}.nes`, base64: `files/${sha}.nes.b64`, sha256: sha, size: 1 } }
}
function siteCatalog(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 1,
    consoles: [
      { id: 'nes', title: 'Денди' },
      { id: 'sega', title: 'Sega', soon: 'Скоро.' },
    ],
    games: { thwaite: siteGame('Thwaite', SHA.thwaite), croom: siteGame('Concentration Room', SHA.croom), rfk: siteGame('robotfindskitten', SHA.rfk), ...extra },
  })
}

// Игра, которой нет в моде: ROM Thwaite с одним изменённым байтом, её хеш и base64
async function probeRom() {
  const bytes = Uint8Array.from(atob(THWAITE_ROM), (c) => c.charCodeAt(0))
  bytes[20000] ^= 0xff
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const sha = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
  return { sha, base64: bytes.toBase64() }
}

function stubs(on: any, { images = true, env = {}, detect = 'ok', launchExit = 0, site = siteCatalog(), files = {}, stored = {}, uname = '', disk: onDisk = {}, browser = 'deny', tabs = [], abort = false, submit = false, fill = true, draft = '', bashMs = BASH_MS }: any = {}) {
  // Диск человека: путь → байты (Uint8Array), текст или { size } для файла, который не читаем
  const disk = new Map<string, any>(Object.entries(onDisk))
  // Тестовая среда приводит путь к виду своей ОС: на Linux — /work/D:\\…, на Windows — C:\\home\\…
  // Поэтому сравниваем пути без ОС: прямые слеши, без буквы диска — и по окончанию пути
  const norm = (p: string) => String(p).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^[A-Za-z]:/, '')
  const lookup = (path: string) => disk.get(path) ?? [...disk.entries()].find(([k]) => norm(path).endsWith(norm(k)))?.[1]
  const diskFile = (path: string) => disk.get(path) ?? [...disk.entries()].find(([k]) => norm(k).endsWith(norm(path)))?.[1]
  on('fs.stat', ($: any, e: any) => {
    const v = lookup(e.path)
    if (v === undefined) return { deny: `ENOENT: ${e.path}` }
    const size = v instanceof Uint8Array ? v.length : typeof v === 'string' ? v.length : v.size
    return { value: { kind: 'file', size, mtimeMs: 0, isLink: false } }
  })
  on('fs.read', ($: any, e: any) => {
    const v = lookup(e.path)
    if (v === undefined) return { deny: `ENOENT: ${e.path}` }
    if (e.as === 'bytes') return { value: { base64: (v instanceof Uint8Array ? v : new TextEncoder().encode(String(v))).toBase64() } }
    return { value: v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v) }
  })
  on('fs.write', ($: any, e: any) => {
    disk.set(e.path, e.text)
    return { value: undefined }
  })
  const saved = new Map<string, unknown>(Object.entries(stored))
  const fetches: string[] = []
  const notifies: any[] = []
  const widths: any[] = []
  const closed: any[] = []
  const opened: string[] = []
  const blits: any[] = []
  const launches: any[] = []
  const toasts: string[] = []
  const clock = mock.clock(on)
  // Тесты пишутся на русском интерфейсе: если окружение не задаёт язык, пусть он будет русским (без него теперь — английский)
  mock.env(on, 'LANG' in env || 'LC_ALL' in env || 'LC_MESSAGES' in env ? env : { ...env, LANG: 'ru_RU.UTF-8' })
  on('process.run', ($: any, e: any) => {
    if (e.argv[0] === 'uname') return { value: { exitCode: 0, stdout: `${uname}\n`, stderr: '' } }
    if (e.init?.env?.ARCADE_TEXT || e.argv[0] === 'notify-send' || e.argv[0] === 'osascript') {
      notifies.push({ argv: e.argv, env: e.init?.env ?? {} })
      return { value: { exitCode: 0, stdout: '', stderr: '' } }
    }
    if (e.argv[0] === 'open' || e.argv[0] === 'xdg-open') {
      launches.push({ argv: e.argv, env: e.init?.env ?? {} })
      return { value: { exitCode: 0, stdout: '', stderr: '' } }
    }
    if (e.init?.env?.ARCADE_URL) {
      launches.push({ argv: e.argv, env: e.init.env })
      return { value: { exitCode: launchExit, stdout: '', stderr: launchExit ? 'Start-Process : This command cannot be run.' : '' } }
    }
    if (detect === 'fail') return { deny: 'powershell.exe not found' }
    return { value: { exitCode: 0, stdout: '\ufeff' + DETECTED + '\r\n', stderr: '' } }
  })
  on('store.get', ($: any, e: any) => ({ value: saved.get(e.key) }))
  on('store.set', ($: any, e: any) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', ($: any, e: any) => {
    saved.delete(e.key)
    return { value: undefined }
  })
  // Сайт Arcade: каталог и файлы игр; site: null — сайт недоступен
  on('http.fetch', ($: any, e: any) => {
    fetches.push(e.url)
    if (site === null) return { deny: 'getaddrinfo ENOTFOUND agent-arcade.fefaodessa.workers.dev' }
    if (e.url === `${SITE}/catalog.json`) return { value: { status: 200, ok: true, headers: {}, text: site } }
    const path = e.url.slice(SITE.length + 1)
    if (path in files) return { value: { status: 200, ok: true, headers: {}, text: files[path] } }
    return { value: { status: 404, ok: false, headers: {}, text: 'not found' } }
  })
  on('command.register', () => ({ value: undefined }))
  on('ui.toast', ($: any, e: any) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', ($: any, e: any) => {
    opened.push(e.id)
    widths.push(e.columns)
    return { value: { isPlaced: true } }
  })
  on('ui.close', ($: any, e: any) => {
    closed.push(e.id)
    return { value: undefined }
  })
  on('ui.blit', ($: any, e: any) => {
    blits.push(e)
    // Терминал без картинок отказывает показывать Image: вместо картинки там её alt
    if (!images && e.source) return { deny: 'an Image drawing its alt there: no placeholder images' }
    return { value: {} }
  })
  on('session.start', () => ({ cwd: '/work' }))
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('classic.PermissionRequest', () => ({}))
  on('classic.PostToolUse', () => ({}))
  // Встроенный браузер Desktop: в разрешении отказали (browser: 'deny'), сервер открыл ('ok') или ответил ошибкой ('error').
  // Отказ — как в авто-режиме: вкладки читать можно, остальные вызовы Arcade (с нажатием человека, consent) — нет;
  // вызовы Claude (из теста они без consent) проходят. tabs — уже открытые вкладки. mcpCalls — все вызовы инструментов
  // приложения как { server, tool, args, consent }, browserCalls — только те, что открывают страницу
  const mcpCalls: any[] = []
  const browserCalls: any[] = []
  const submits: any[] = []
  const fills: any[] = []
  const aborts: any[] = []
  // Инструмент агента, который идёт не сразу: Bash заканчивается через пару секунд по часам теста (часы теста идут
  // медленно — игровой цикл Arcade тикает каждые 33 мс, — так что минуту тест не дождался бы)
  on('tool.call', ($: any, e: any) => {
    if (e.tool === 'Bash') return clock.sleep(bashMs).then(() => ({ result: 'ok', text: 'ok' }))
    const [, server, tool] = /^mcp__(.+?)__(.+)$/.exec(e.tool) ?? []
    const { tool: _name, tool_use_id: _id, consent, ...args } = e
    const call = { server, tool, args, consent }
    mcpCalls.push(call)
    if (browser === 'deny' && consent !== undefined && tool !== 'tabs_context') return { deny: 'The auto mode classifier gave no verdict' }
    if (tool === 'tabs_context') {
      const text = `${JSON.stringify({ browserOpen: tabs.length > 0, tabs }, null, 2)}\nThe Browser pane is currently hidden.`
      return { result: text, text }
    }
    if (tool === 'preview_start' || tool === 'navigate') browserCalls.push(call)
    const answer = browser === 'deny' ? 'ok' : browser
    return answer === 'error' ? { isError: true, result: answer, text: answer } : { result: answer, text: answer }
  })
  // Ход агента, который Arcade обрывает, чтобы Claude открыл игру: оборвался (abort: true) или нет
  on('turn.abort', ($: any, e: any) => {
    aborts.push(e)
    if (!abort) throw new Error('stub: ход не прерван')
    return { value: undefined }
  })
  // Решение по разрешениям без плагинов: спросить человека
  on('tool.check', () => ({ decision: 'ask' }))
  // Просьба от мода Claude: принята (submit: true) или нет — тогда, как и без отказа в разрешении, поле ввода
  on('prompt.submit', ($: any, e: any) => {
    submits.push(e)
    return submit ? { text: e.text } : { drop: 'stub: не принята' }
  })
  on('prompt.read', () => ({ value: { text: draft, cursor: draft.length } }))
  // Поле ввода берёт текст или нет. Причину отказа ('dialog', 'no_composer') пишет только сам Claude Code:
  // из хука её не передать, мод получает отказ без причины
  on('prompt.fill', ($: any, e: any) => {
    fills.push(e)
    return { isFilled: fill }
  })
  // Что Claude Code нарисовал бы сам, когда мод отдаёт отрисовку дальше
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
  return { saved, opened, blits, clock, launches, toasts, fetches, notifies, disk, diskFile, widths, closed, mcpCalls, browserCalls, aborts, submits, fills }
}

const BASH_MS = 2_000

async function start($: any) {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'arcade', args: '' })
}

// Тесты, которые гоняют эмулятор: на медленной машине они идут в 2–3 раза дольше обычного лимита в 5 с
const HEAVY = { timeoutMs: 30_000 }

// Где в меню живёт кнопка: игры Денди — в «Денди», проверка клавиш и выбор окна и графики — в «Настройках»
const MENU_OF: Record<string, string> = {
  'arcade-game-thwaite': 'nes',
  'arcade-game-croom': 'nes',
  'arcade-game-rfk': 'nes',
  'arcade-game-field': 'settings',
  'arcade-opener': 'settings',
  'arcade-graphics': 'settings',
  'arcade-notify': 'settings',
  'arcade-assign': 'settings',
  'arcade-wide': 'settings',
  'arcade-on-done': 'settings',
  'arcade-on-permission': 'settings',
  'arcade-lang': 'settings',
}

// Дойти по меню до кнопки и нажать её
async function go(ui: any, key: string) {
  if (!(await ui.find({ key }))) {
    if (await ui.find({ key: 'arcade-back' })) await ui.press({ key: 'arcade-back' })
    if (MENU_OF[key]) await ui.press({ key: `arcade-menu-${MENU_OF[key]}` })
  }
  await ui.press({ key })
}

// Нажать клавишу над экраном игры и дать часам экрана один тик, чтобы hooks/input.js отправил сообщение
async function tap(ui: any, key: string, extra: Record<string, true> = {}) {
  await ui.key({ key, ...extra })
  await ui.advance(30)
}

test('меню: Денди и Sega, в Денди — три игры, «Назад» возвращает, настройки отдельно', async ($, on) => {
  stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Arcade' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-menu-nes' })).toMatchObject({ props: { label: 'Денди', autoFocus: true } })
  expect(await ui.find({ key: 'arcade-menu-sega' })).toMatchObject({ props: { label: 'Sega' } })
  expect(await ui.find({ type: 'Text', text: '  3 игры' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  скоро' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-thwaite' })).toBeUndefined() // игры — внутри приставки
  expect(await ui.find({ key: 'arcade-open-library' })).toBeUndefined() // окно браузера — только на Windows

  await ui.press({ key: 'arcade-menu-nes' })
  expect(await ui.find({ type: 'Text', text: 'Arcade · Денди' })).toBeDefined()
  for (const id of ['thwaite', 'croom', 'rfk']) expect(await ui.find({ key: `arcade-game-${id}` })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-thwaite' })).toMatchObject({ props: { autoFocus: true } })
  expect(await ui.find({ key: 'arcade-game-field' })).toBeUndefined()

  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-sega' })
  expect(await ui.find({ type: 'Text', text: 'Arcade · Sega' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Готовим эмулятор Mega Drive/ })).toBeDefined()

  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-menu-sega' })).toMatchObject({ props: { autoFocus: true } }) // фокус там, откуда вернулись
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ type: 'Text', text: 'Arcade · настройки' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-graphics' })).toMatchObject({ props: { label: 'Графика: авто (сейчас пиксели)' } })
  expect(await ui.find({ key: 'arcade-game-field' })).toMatchObject({ props: { label: 'Проверка клавиш' } })
  await ui.unmount()
})

test('в игре экран накрыт Client, который ловит клавиши', async ($, on) => {
  stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-game-field')
  expect(await ui.find({ type: 'Text', text: /Кликни по экрану — играть/ })).toBeDefined()
  const client = await ui.find({ key: 'arcade-input' })
  expect(client).toMatchObject({ type: 'Client', props: { width: 24, height: 8 } })
  expect(client.props.module).toMatch(/input\.js$/)
  await ui.unmount()
})

test('поле: клавиши любой раскладки через Client, удержание по автоповтору', async ($, on) => {
  stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-game-field')
  for (const key of ['w', 'ц', 'ф', 'і', 'up', 'return', '1']) await tap(ui, key)
  await tap(ui, 'D', { shift: true }) // Shift не меняет клавишу
  expect(await ui.find({ type: 'Text', text: 'Нажатия: w ц ф і up d' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Не узнаю/ })).toBeUndefined()

  // Одиночное нажатие держится 260 мс
  await ui.advance(300)
  expect(await ui.find({ type: 'Text', text: 'Зажато: —' })).toBeDefined()
  // Автоповтор: нажатия каждые 30 мс держат клавишу, после последнего — 120 мс
  for (let i = 0; i < 5; i++) await tap(ui, 's')
  expect(await ui.find({ type: 'Text', text: 'Зажато: s' })).toBeDefined()
  await ui.advance(150)
  expect(await ui.find({ type: 'Text', text: 'Зажато: —' })).toBeDefined()

  // Ctrl-сочетания не для игры
  await tap(ui, 'c', { ctrl: true })
  expect(await ui.find({ type: 'Text', text: /Не узнаю/ })).toBeUndefined()
  await ui.unmount()
})

test('сообщения экрана: сброс счётчиков и мусор в данных', async ($, on) => {
  stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-game-field')
  await ui.post({ held: ['w'], counts: { w: 2 } })
  await ui.post({ held: [], counts: { w: 1 } }) // экран создан заново: счёт с нуля, нажатие засчитано
  await ui.post({ held: 'w', counts: null })
  await ui.post({ held: [42], counts: { w: 'много' } })
  expect(await ui.find({ type: 'Text', text: 'Нажатия: w w w' })).toBeDefined()
  await ui.unmount()
})

test('незнакомая раскладка: назначение всех восьми кнопок и сохранение', async ($, on) => {
  const { saved } = stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-game-field')
  await tap(ui, 'σ')
  expect(await ui.find({ type: 'Text', text: /Не узнаю клавишу «σ».*«вверх» \(1 из 8\)/ })).toBeDefined()
  for (const key of ['ς', 'α', 'σ', 'δ', 'κ', 'ξ', 'ν', 'μ']) await tap(ui, key)
  expect(await ui.find({ type: 'Text', text: 'Управление сохранено.' })).toBeDefined()
  const keys = saved.get('keys') as any
  expect(keys.down).toContain('σ')
  expect(keys.start).toContain('ν')
  await ui.unmount()
})

test('Thwaite в терминале с картинками: настоящие пиксели, PNG 30 раз в секунду', HEAVY, async ($, on) => {
  const { saved, blits, clock } = stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-game-thwaite')
  expect(saved.get('lastGame')).toBe('thwaite')
  const screen = await ui.find({ key: 'arcade-screen' })
  expect(screen).toMatchObject({ type: 'Image' })
  expect(screen.props.source.png).toMatch(/^iVBORw0KGgo/) // сигнатура PNG
  expect(await ui.find({ key: 'arcade-input' })).toMatchObject({ props: { width: screen.props.columns, height: screen.props.rows } })

  await clock.advance(1000)
  expect(blits.length >= 25 && blits.length <= 31).toBe(true)
  expect(blits[0]).toMatchObject({ requestId: 'arcade', key: 'arcade-screen', columns: screen.props.columns, rows: screen.props.rows })
  expect(blits[0].source.png).toMatch(/^iVBORw0KGgo/)

  // Start пропускает заставку, кадр меняется
  await tap(ui, 'n')
  await clock.advance(300)
  await ui.advance(300)
  await clock.advance(3000)
  await tap(ui, 'т') // Start в русской раскладке
  await clock.advance(300)
  await ui.advance(300)
  await clock.advance(3000)
  expect(blits[0].source.png === blits.at(-1).source.png).toBe(false)
  expect(await ui.find({ type: 'Text', text: /не показывает картинки/ })).toBeUndefined()

  // Backspace — в библиотеку, эмулятор стоит
  await tap(ui, 'backspace')
  expect(await ui.find({ type: 'Text', text: 'Arcade · Денди' })).toBeDefined()
  const before = blits.length
  await clock.advance(1000)
  expect(blits.length).toBe(before)
  await ui.unmount()
})

test('Thwaite в терминале без картинок: через полсекунды сам переходит на символы', HEAVY, async ($, on) => {
  const { blits, clock } = stubs(on, { images: false })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-game-thwaite')
  expect(await ui.find({ key: 'arcade-screen' })).toMatchObject({ type: 'Image' })
  await clock.advance(1000)
  expect(await ui.find({ type: 'Text', text: /не показывает картинки — рисую символами/ })).toBeDefined()
  const screen = await ui.find({ key: 'arcade-screen' })
  expect(screen).toMatchObject({ type: 'Raster' })
  const count = blits.length
  await clock.advance(1000)
  expect(blits.length - count >= 25).toBe(true)
  expect(typeof blits.at(-1).cells).toBe('string')
  // В настройках видно, что «авто» сейчас рисует символами
  await tap(ui, 'backspace')
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-graphics' })).toMatchObject({ props: { label: 'Графика: авто (сейчас символы)' } })
  await ui.unmount()
})

test('переключатель графики: авто → пиксели → символы, выбор сохраняется', async ($, on) => {
  const { saved } = stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-graphics')
  expect(saved.get('graphics')).toBe('pixels')
  await go(ui, 'arcade-graphics')
  expect(saved.get('graphics')).toBe('symbols')
  expect(await ui.find({ key: 'arcade-graphics' })).toMatchObject({ props: { label: 'Графика: символы' } })
  await go(ui, 'arcade-game-thwaite')
  expect(await ui.find({ key: 'arcade-screen' })).toMatchObject({ type: 'Raster' })
  await ui.unmount()
})

test('подсказка «Кликни сюда» видна до клика и пропадает после', async ($, on) => {
  stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-game-field')
  await ui.advance(30)
  expect(await ui.find({ type: 'Text', text: /Кликни сюда, чтобы играть/, in: 'arcade-input' })).toBeDefined()
  await ui.pointer({ type: 'down', x: 3, y: 2, button: 'left' })
  await ui.pointer({ type: 'up', x: 3, y: 2, button: 'left' })
  await ui.advance(30)
  expect(await ui.find({ type: 'Text', text: /Кликни сюда, чтобы играть/, in: 'arcade-input' })).toBeUndefined()
  // После клика клавиши идут в игру
  await tap(ui, 'w')
  expect(await ui.find({ type: 'Text', text: 'Нажатия: w' })).toBeDefined()
  // Панель потеряла фокус (Esc) — подсказка возвращается
  await ui.redraw({ ...PANE.props, isFocused: false })
  await ui.advance(30)
  expect(await ui.find({ type: 'Text', text: /Кликни сюда, чтобы играть/, in: 'arcade-input' })).toBeDefined()
  await ui.unmount()
})

test('через 10 секунд работы агента появляется вопрос, «Играть» открывает панель', HEAVY, async ($, on) => {
  const { opened, clock } = stubs(on)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.turn.start({ turnId: 't1' })
  await clock.advance(9_000)
  const early = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await early.find({ type: 'Text', text: /сыграть\?/ })).toBeUndefined() // до 10 секунд — тихо
  await early.unmount()
  await clock.advance(2_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /сыграть\?/ })).toBeDefined()
  // ОС не определена — окна браузера нет, кнопка одна
  expect(await band.find({ key: 'arcade-play' })).toMatchObject({ props: { label: 'Играть', hotkey: '1' } })
  expect(await band.find({ key: 'arcade-play-window' })).toBeUndefined()
  expect(await band.find({ key: 'arcade-later' })).toMatchObject({ props: { hotkey: '2' } })
  await band.press({ key: 'arcade-play' })
  expect(opened).toEqual(['arcade'])
  await band.unmount()
})

test('пока в полосе вопрос Claude Code, «сыграть?» уступает ему место и возвращается после', HEAVY, async ($, on) => {
  const { clock } = stubs(on)
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' })
  await $.turn.start({ turnId: 't1' })
  await clock.advance(11_000)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...BAND.props, hasSurvey: true } })
  expect(await band.find({ type: 'Text', text: /сыграть\?/ })).toBeUndefined()
  expect(await band.find({ key: 'arcade-play' })).toBeUndefined() // цифры достаются вопросу Claude Code
  await band.redraw({ ...BAND.props, hasSurvey: false })
  expect(await band.find({ type: 'Text', text: /сыграть\?/ })).toBeDefined()
  await band.unmount()
})

test('запрос разрешения виден в панели, а событие уходит дальше без изменений', async ($, on) => {
  stubs(on)
  await start($)
  const answer = await $.classic.PermissionRequest({ tool_name: 'Write', tool_input: { file_path: 'notes.txt' } })
  expect(answer).toEqual({})
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /ждёт разрешения/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /запрос разрешения: Write/ })).toBeDefined()
  await ui.unmount()
})

test('Windows: браузеры ищутся в фоне, по умолчанию игра открывается окном браузера по умолчанию', async ($, on) => {
  const { clock } = stubs(on, { env: WINDOWS })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-open-library' })).toMatchObject({ props: { label: 'Окно Arcade' } })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-opener' })).toMatchObject({ props: { label: 'Открывать: окно браузера по умолчанию (ищу браузеры…)' } })
  await clock.advance(200)
  expect(await ui.find({ key: 'arcade-opener' })).toMatchObject({ props: { label: 'Открывать: окно браузера по умолчанию (Google Chrome)' } })
  expect(await ui.find({ key: 'arcade-graphics' })).toBeUndefined() // графика — только для игры в панели
  await ui.unmount()
})

test('Windows: Thwaite открывается окном Chrome справа, со своим профилем', async ($, on) => {
  const { clock, launches, blits } = stubs(on, { env: WINDOWS })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-game-thwaite')
  expect(await ui.find({ type: 'Text', text: 'Игры открываются в окне браузера по умолчанию (Google Chrome).' })).toBeDefined()
  expect(launches.length).toBe(1)
  const { argv, env } = launches[0]
  expect(argv.slice(0, 6)).toEqual(['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand'])
  expect(env.ARCADE_BROWSER).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  expect(env.ARCADE_URL).toBe(`${SITE}/?game=thwaite`)
  expect(env.ARCADE_ARGS).toContain(`--app="${env.ARCADE_URL}"`)
  expect(env.ARCADE_ARGS).toContain('--window-size=800,812 --window-position=1108,114')
  expect(env.ARCADE_ARGS).toContain('--user-data-dir="C:\\Users\\max\\AppData\\Local\\claude-arcade\\chrome"')
  expect(await ui.find({ type: 'Text', text: 'Thwaite открыт в Google Chrome. Игра стоит на паузе, пока окно не в фокусе.' })).toBeDefined()
  // Эмулятор в Claude Code не запускается: игра идёт в браузере
  await clock.advance(1000)
  expect(blits.length).toBe(0)
  expect(await ui.find({ type: 'Text', text: 'Arcade · Денди' })).toBeDefined() // остаёмся в списке игр
  await ui.unmount()
})

test('Windows: выбор по кругу — Chrome, Firefox, панель — и он сохраняется', async ($, on) => {
  const { clock, launches, saved } = stubs(on, { env: WINDOWS })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-opener')
  expect(await ui.find({ key: 'arcade-opener' })).toMatchObject({ props: { label: 'Открывать: окно Google Chrome' } })
  expect(saved.get('opener')).toEqual({ opener: 'window', browser: 'chrome' })
  await go(ui, 'arcade-opener')
  expect(await ui.find({ key: 'arcade-opener' })).toMatchObject({ props: { label: 'Открывать: окно Firefox (обычное окно браузера)' } })
  await go(ui, 'arcade-game-thwaite')
  expect(launches.at(-1).env.ARCADE_ARGS).toBe(`-new-window "${launches.at(-1).env.ARCADE_URL}"`)
  await go(ui, 'arcade-opener')
  expect(await ui.find({ key: 'arcade-opener' })).toMatchObject({ props: { label: 'Открывать: здесь, в панели' } })
  expect(saved.get('opener')).toMatchObject({ opener: 'pane' })
  expect(await ui.find({ key: 'arcade-graphics' })).toBeDefined()
  await go(ui, 'arcade-game-thwaite')
  expect(await ui.find({ key: 'arcade-screen' })).toBeDefined() // в панели, как раньше
  expect(launches.length).toBe(1)
  await ui.unmount()
})

test('Windows: в вопросе выбор — «Здесь» (1), «В окне» (2), «Не сейчас» (3); «В окне» открывает браузер', async ($, on) => {
  const { clock, launches, opened, toasts } = stubs(on, { env: WINDOWS })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.turn.start({ turnId: 't1' })
  await clock.advance(21_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ key: 'arcade-play' })).toMatchObject({ props: { label: 'Здесь', hotkey: '1' } })
  expect(await band.find({ key: 'arcade-play-window' })).toMatchObject({ props: { label: 'В окне', hotkey: '2' } })
  expect(await band.find({ key: 'arcade-later' })).toMatchObject({ props: { label: 'Не сейчас', hotkey: '3' } })
  // В Desktop «В окне» — встроенный браузер приложения
  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desktop.find({ key: 'arcade-play' })).toMatchObject({ props: { label: 'Здесь' } })
  expect(await desktop.find({ key: 'arcade-play-window' })).toMatchObject({ props: { label: 'В окне', hotkey: '2' } })
  await desktop.unmount()
  await band.press({ key: 'arcade-play-window' })
  expect(launches.length).toBe(1)
  expect(opened).toEqual([])
  expect(toasts.at(-1)).toMatch(/Thwaite открыт в Google Chrome/)
  await band.unmount()
})

test('Windows: окно не открылось — понятная ошибка', async ($, on) => {
  const { clock } = stubs(on, { env: WINDOWS, launchExit: 1 })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-game-thwaite')
  expect(await ui.find({ type: 'Text', text: 'Не получилось открыть окно: Start-Process : This command cannot be run.' })).toBeDefined()
  await ui.unmount()
})

test('Windows: поиск браузеров не удался — открываем тем, что в системе открывает ссылки', async ($, on) => {
  const { clock, launches } = stubs(on, { env: WINDOWS, detect: 'fail' })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-opener' })).toMatchObject({ props: { label: 'Открывать: окно браузера по умолчанию' } })
  await go(ui, 'arcade-game-thwaite')
  expect(launches[0].env.ARCADE_BROWSER).toBeUndefined()
  expect(launches[0].env.ARCADE_URL).toMatch(/game=thwaite$/)
  await ui.unmount()
})

test('browsers.js: разбор ответа, размер окна, адрес игры, кодировка PowerShell', () => {
  expect(parseDetection('мусор')).toEqual({ browsers: [], defaultId: null, screen: null })
  expect(parseDetection('{не json')).toEqual({ browsers: [], defaultId: null, screen: null })
  const odd = parseDetection(JSON.stringify({ browsers: { id: 'edge', path: 'C:\\e.exe' }, defaultProgId: 'MSEdgeHTM', screen: { x: 0, y: 0, width: -1, height: 5 } }))
  expect(odd).toEqual({ browsers: [{ id: 'edge', name: 'Microsoft Edge', path: 'C:\\e.exe', app: true }], defaultId: 'edge', screen: null })
  expect(parseDetection(JSON.stringify({ browsers: [{ id: 'evil', path: 'C:\\x.exe' }] })).browsers).toEqual([])

  expect(windowBounds({ x: 0, y: 0, width: 1920, height: 1040 })).toEqual({ width: 800, height: 812, x: 1108, y: 114 })
  expect(windowBounds({ x: 0, y: 0, width: 1366, height: 728 })).toEqual({ width: 544, height: 572, x: 810, y: 78 }) // ×2
  expect(windowBounds({ x: 0, y: 0, width: 3840, height: 2100 })).toMatchObject({ width: 1056 }) // не больше ×4
  expect(windowBounds(null)).toBe(null)

  expect(pageUrl('thwaite')).toBe('https://agent-arcade.fefaodessa.workers.dev/?game=thwaite')
  expect(pageUrl('robot kitten')).toBe('https://agent-arcade.fefaodessa.workers.dev/?game=robot%20kitten')
  expect(pageUrl(null)).toBe('https://agent-arcade.fefaodessa.workers.dev/')

  const encoded = encodePowerShell('Write-Output "Привет"')
  const bytes = Uint8Array.fromBase64(encoded)
  expect(String.fromCharCode(...Array.from({ length: bytes.length / 2 }, (_, i) => bytes[i * 2] | (bytes[i * 2 + 1] << 8)))).toBe('Write-Output "Привет"')

  const plain = launchCommand({ kind: 'browser', browser: { id: 'edge', path: 'C:\\e.exe', app: true } }, 'file:///x', null, '')
  expect(plain.env.ARCADE_ARGS).toBe('--app="file:///x" --no-first-run --no-default-browser-check')
  expect(launchCommand({ kind: 'default' }, 'file:///x', null, '').env).toEqual({ ARCADE_URL: 'file:///x' })
})

test('Concentration Room и robotfindskitten идут в панели, у каждой своя игра в эмуляторе', HEAVY, async ($, on) => {
  const { blits, clock } = stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-game-croom')
  expect(await ui.find({ type: 'Text', text: /Arcade · Concentration Room/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /движение w a s d или стрелки · A k · B j · Start n/ })).toBeDefined()
  await clock.advance(500)
  const croomFrame = blits.at(-1).source.png
  await tap(ui, 'backspace')
  await go(ui, 'arcade-game-rfk')
  await clock.advance(500)
  expect(blits.at(-1).source.png === croomFrame).toBe(false)
  expect(await ui.find({ type: 'Text', text: /Arcade · robotfindskitten/ })).toBeDefined()
  await ui.unmount()
})

test('Windows: «Открыть Arcade» открывает окно с библиотекой, игры — каждая по своему адресу', async ($, on) => {
  const { clock, launches } = stubs(on, { env: WINDOWS })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-open-library')
  expect(launches[0].env.ARCADE_URL).toBe(`${SITE}/`)
  expect(await ui.find({ type: 'Text', text: 'Arcade открыт в Google Chrome: выбирай приставку и игру.' })).toBeDefined()
  await go(ui, 'arcade-game-croom')
  expect(launches[1].env.ARCADE_URL).toMatch(/\?game=croom$/)
  await go(ui, 'arcade-game-rfk')
  expect(launches[2].env.ARCADE_URL).toMatch(/\?game=rfk$/)
  await ui.unmount()
})

test('каталог с сайта: новая игра появляется в меню, копия сохраняется', async ($, on) => {
  const { clock, saved, fetches } = stubs(on, { site: siteCatalog({ probe: siteGame('Проба', 'a'.repeat(64)) }) })
  await start($)
  await clock.advance(200)
  expect(fetches[0]).toBe(`${SITE}/catalog.json`)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '  4 игры' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-nes' })
  expect(await ui.find({ key: 'arcade-game-probe' })).toMatchObject({ props: { label: 'Проба' } })
  expect(await ui.find({ type: 'Text', text: '  аркада — Проба с сайта' })).toBeDefined()
  expect((saved.get('catalog') as any).games.map((g: any) => g.id)).toEqual(['thwaite', 'croom', 'rfk', 'probe'])
  await ui.unmount()
})

test('сайт недоступен: меню из сохранённой копии, а без неё — из запаса мода', async ($, on) => {
  const copy = JSON.parse(siteCatalog({ probe: siteGame('Проба', 'b'.repeat(64)) }))
  const { clock } = stubs(on, { site: null, stored: { catalog: { consoles: copy.consoles, games: Object.entries(copy.games).map(([id, g]: any) => ({ id, ...g })) } } })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-nes' })
  expect(await ui.find({ key: 'arcade-game-probe' })).toBeDefined()
  await ui.unmount()
})

test('без сайта и без копии — три игры из запаса мода, и они играются', HEAVY, async ($, on) => {
  const { clock, blits } = stubs(on, { site: null })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '  3 игры' })).toBeDefined()
  await go(ui, 'arcade-game-rfk')
  await clock.advance(500)
  expect(blits.length > 0).toBe(true)
  await ui.unmount()
})

test('игры нет в моде: скачивается с сайта, сверяется с хешем, кешируется', HEAVY, async ($, on) => {
  const rom = await probeRom()
  const { clock, saved, fetches, blits } = stubs(on, {
    site: siteCatalog({ probe: siteGame('Проба', rom.sha) }),
    files: { [`files/${rom.sha}.nes.b64`]: rom.base64 },
  })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-nes' })
  await ui.press({ key: 'arcade-game-probe' })
  expect(fetches).toContain(`${SITE}/files/${rom.sha}.nes.b64`)
  expect(saved.get(`rom:${rom.sha}`)).toBe(rom.base64)
  expect(saved.get('roms')).toEqual([rom.sha])
  expect(await ui.find({ type: 'Text', text: /Arcade · Проба/ })).toBeDefined()
  await clock.advance(500)
  expect(blits.length > 0).toBe(true)
  // Второй раз — из кеша, без сети
  await tap(ui, 'backspace')
  const before = fetches.length
  await ui.press({ key: 'arcade-game-probe' })
  expect(fetches.length).toBe(before)
  await ui.unmount()
})

test('файл не совпал с хешем — игра не запускается, человек видит причину', async ($, on) => {
  const rom = await probeRom()
  const { clock, saved } = stubs(on, {
    site: siteCatalog({ probe: siteGame('Проба', rom.sha) }),
    files: { [`files/${rom.sha}.nes.b64`]: THWAITE_ROM },
  })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-nes' })
  await ui.press({ key: 'arcade-game-probe' })
  expect(await ui.find({ type: 'Text', text: 'Не получилось скачать Проба: файл повреждён' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Arcade · Денди' })).toBeDefined()
  expect(saved.has(`rom:${rom.sha}`)).toBe(false)
  await ui.unmount()
})

test('Desktop: экран Денди — PNG внутри Svg, клавиши — через Client', HEAVY, async ($, on) => {
  const { clock } = stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(ui, 'arcade-game-thwaite')
  const screen = await ui.find({ type: 'Svg' })
  expect(screen).toMatchObject({ type: 'Svg', props: { alt: 'Thwaite' } })
  expect(screen.props.source).toMatch(/^<svg [^>]*><image [^>]*href="data:image\/png;base64,iVBORw0KGgo/)
  expect(screen.props.source.length < 131072).toBe(true)
  expect(await ui.find({ key: 'arcade-input' })).toMatchObject({ type: 'Client' })
  const first = screen.props.source
  await tap(ui, 'n') // Start: заставка уходит
  await clock.advance(3000)
  expect((await ui.find({ type: 'Svg' })).props.source === first).toBe(false)
  await ui.press({ key: 'arcade-library' })
  expect(await ui.find({ type: 'Text', text: 'Arcade · Денди' })).toBeDefined()
  await ui.unmount()
})

test('VS Code: клавиатура — поле над строкой ввода: буквы, Enter — Start, удержание, стирание, очистка', HEAVY, async ($, on) => {
  const { clock } = stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'vscode' })
  await go(ui, 'arcade-game-thwaite')
  // В панели — картинка и кнопки для мыши, без поля и без отладки
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  expect(await ui.find({ type: 'Input' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Проверка ввода/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Клавиатура — в строке 🎮 над строкой ввода Claude · кнопки — мышью' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-pad-right' })).toMatchObject({ props: { label: '→ (D)' } })

  const band = await $.ui.mount({ ...BAND, surface: 'vscode' })
  const field = await band.find({ key: 'arcade-keys-band' })
  expect(field).toMatchObject({ type: 'Input', props: { label: '🎮', autoFocus: true } })
  expect(field.props.placeholder).toBe('кликни — и игра слушает клавиатуру: W A S D, K J, Enter')

  // Enter — Start: заставка уходит
  const first = (await ui.find({ type: 'Svg' })).props.source
  await band.input({ key: 'arcade-keys-band', text: '', kind: 'submit' })
  await clock.advance(2000)
  expect((await ui.find({ type: 'Svg' })).props.source === first).toBe(false)
  // Набор идёт поверх того «пустого» значения, которое строка показывает сейчас
  const type = async (char: string) => {
    const empty = (await band.find({ key: 'arcade-keys-band' })).props.value ?? ''
    await band.input({ key: 'arcade-keys-band', text: empty + char, kind: 'change' })
  }
  // Ещё два Start русской буквой «т» — в саму игру
  for (let i = 0; i < 2; i++) {
    await type('т')
    await clock.advance(2000)
  }
  // Автоповтор «d»: буква раз в 33 мс держит «вправо», прицел едет
  const before = (await ui.find({ type: 'Svg' })).props.source
  for (let i = 0; i < 30; i++) {
    await type('d')
    await clock.advance(33)
  }
  expect((await ui.find({ type: 'Svg' })).props.source === before).toBe(false)
  await band.unmount()
  await ui.unmount()
})

test('VS Code: строка 🎮 стирается после каждой буквы, стирание и незнакомые буквы — не нажатия', async ($, on) => {
  stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'vscode' })
  await go(ui, 'arcade-game-thwaite')
  const band = await $.ui.mount({ ...BAND, surface: 'vscode' })
  const value = async () => (await band.find({ key: 'arcade-keys-band' })).props.value
  expect(await value()).toBe('')
  // Буква — нажатие, и строка получает другое «пустое» значение: VS Code перезапишет поле
  await band.input({ key: 'arcade-keys-band', text: 'd', kind: 'change' })
  expect(await value()).toBe('\u200b')
  // Следующая буква набирается поверх него — и строка снова пустая
  await band.input({ key: 'arcade-keys-band', text: '\u200bd', kind: 'change' })
  expect(await value()).toBe('')
  // Стирание — не нажатие: строка не сбрасывается
  await band.input({ key: 'arcade-keys-band', text: 'd', kind: 'change' })
  await band.input({ key: 'arcade-keys-band', text: '', kind: 'change' })
  expect(await value()).toBe('\u200b')
  // Незнакомая буква не запускает переназначение клавиш
  await band.input({ key: 'arcade-keys-band', text: '\u200bx', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: /Не узнаю клавишу/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Нажми клавишу для/ })).toBeUndefined()
  await band.unmount()
  await ui.unmount()
})

test('VS Code на Windows: «Здесь» в вопросе открывает игру в панели, «В окне» тоже предложено', async ($, on) => {
  const { clock, launches, opened } = stubs(on, { env: WINDOWS })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.turn.start({ turnId: 't1' })
  await clock.advance(21_000)
  const band = await $.ui.mount({ ...BAND, surface: 'vscode' })
  expect(await band.find({ key: 'arcade-play-window' })).toBeDefined()
  await band.press({ key: 'arcade-play' })
  expect(launches.length).toBe(0)
  expect(opened.length).toBe(1)
  await band.unmount()
})

test('полоса над вводом с полем для клавиш — только в VS Code и только пока идёт игра', async ($, on) => {
  stubs(on)
  await start($)
  const terminalBand = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await terminalBand.find({ key: 'arcade-keys-band' })).toBeUndefined()
  await terminalBand.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'vscode' })
  const before = await $.ui.mount({ ...BAND, surface: 'vscode' })
  expect(await before.find({ key: 'arcade-keys-band' })).toBeUndefined() // в библиотеке поля нет
  await before.unmount()
  await ui.unmount()
})

test('Linux и macOS: окно игры — браузер по умолчанию с адресом сайта', async ($, on) => {
  const { clock, launches } = stubs(on, { uname: 'Linux' })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-opener' })).toMatchObject({ props: { label: 'Открывать: окно браузера по умолчанию' } })
  await go(ui, 'arcade-game-thwaite')
  expect(launches[0].argv).toEqual(['xdg-open', `${SITE}/?game=thwaite`])
  expect(await ui.find({ type: 'Text', text: 'Thwaite открыт в браузере по умолчанию. Игра стоит на паузе, пока окно не в фокусе.' })).toBeDefined()
  await ui.unmount()
})

test('catalog.js: разбор каталога сайта и проверка ROM', async () => {
  expect(parseCatalog('мусор')).toBe(null)
  expect(parseCatalog(JSON.stringify({ consoles: [], games: {} }))).toBe(null)
  const parsed = parseCatalog(siteCatalog({ bad: { console: 'snes', title: 'x', genre: 'x', about: 'x', rom: { sha256: 'a'.repeat(64), base64: 'files/x' } }, worse: { console: 'nes', title: 'x', genre: 'x', about: 'x', rom: { sha256: 'нет', base64: 'files/x' } } }))
  expect(parsed.games.map((g: any) => g.id)).toEqual(['thwaite', 'croom', 'rfk'])
  expect(parsed.consoles[1]).toEqual({ id: 'sega', title: 'Sega', soon: 'Скоро.' })
  expect(await verifyRom(THWAITE_ROM, SHA.thwaite)).toBe(true)
  expect(await verifyRom(THWAITE_ROM, SHA.croom)).toBe(false)
  expect(await verifyRom('не base64!', SHA.thwaite)).toBe(false)
  expect(await verifyRom(undefined, SHA.thwaite)).toBe(false)
})

test('VS Code на Windows: по умолчанию игра в панели, окно — только если выбрано явно', async ($, on) => {
  const { clock, launches } = stubs(on, { env: WINDOWS })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'vscode' })
  await ui.press({ key: 'arcade-menu-nes' })
  expect(await ui.find({ type: 'Text', text: 'Игры открываются здесь, в панели.' })).toBeDefined()
  await ui.press({ key: 'arcade-game-thwaite' })
  expect(launches.length).toBe(0)
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  // Явный выбор окна в настройках — и VS Code тоже открывает окно
  await ui.press({ key: 'arcade-library' })
  await go(ui, 'arcade-opener') // браузер по умолчанию → Chrome
  await go(ui, 'arcade-game-thwaite')
  expect(launches.length).toBe(1)
  await ui.unmount()
})

test('Desktop: Денди — в панели, программ браузера мод не запускает; «Окно Arcade» — во встроенном браузере', async ($, on) => {
  const { clock, launches, mcpCalls } = stubs(on, { env: WINDOWS })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'arcade-open-library' })).toMatchObject({ props: { label: 'Окно Arcade' } })
  await go(ui, 'arcade-game-thwaite')
  expect(launches.length).toBe(0)
  expect(mcpCalls).toEqual([])
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  await ui.unmount()
})

// Играешь в окне браузера → агент долго работал → закончил: системное уведомление
async function playInWindowThenTurn($: any, clock: any, ui: any, workMs: number) {
  await go(ui, 'arcade-game-thwaite')
  await $.turn.start({ turnId: 't1' })
  await clock.advance(workMs)
  await $.turn.complete({ turnId: 't1' })
  await clock.advance(50)
}

test('Windows: играешь в окне — агент закончил долгий ход — системное уведомление со звуком', async ($, on) => {
  const { clock, launches, notifies } = stubs(on, { env: WINDOWS })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await playInWindowThenTurn($, clock, ui, 25_000)
  expect(launches.length).toBe(1)
  expect(notifies.length).toBe(1)
  expect(notifies[0].argv[0]).toBe('powershell.exe')
  expect(notifies[0].env).toEqual({ ARCADE_TITLE: 'Claude Code', ARCADE_TEXT: 'Агент закончил — можно возвращаться' })
  await ui.unmount()
})

test('уведомлений нет: короткий ход, без окна игры или выключены в настройках', async ($, on) => {
  const { clock, notifies, saved } = stubs(on, { env: WINDOWS })
  await start($)
  await clock.advance(200)
  // Без окна: ход долгий, но игры в браузере не было
  await $.turn.start({ turnId: 't0' })
  await clock.advance(25_000)
  await $.turn.complete({ turnId: 't0' })
  await clock.advance(50)
  expect(notifies.length).toBe(0)
  // Короткий ход: агент ответил быстро — человек ещё смотрит в Claude Code
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await playInWindowThenTurn($, clock, ui, 5_000)
  expect(notifies.length).toBe(0)
  // Выключены в настройках
  await go(ui, 'arcade-notify')
  expect(await ui.find({ key: 'arcade-notify' })).toMatchObject({ props: { label: 'Уведомления, пока играешь в окне: нет' } })
  expect(saved.get('notify')).toBe(false)
  await playInWindowThenTurn($, clock, ui, 25_000)
  expect(notifies.length).toBe(0)
  await ui.unmount()
})

test('запрос разрешения, пока играешь в окне, — уведомление сразу', async ($, on) => {
  const { clock, notifies } = stubs(on, { env: WINDOWS })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-game-thwaite')
  await $.turn.start({ turnId: 't1' })
  await $.classic.PermissionRequest({ tool_name: 'Write', tool_input: { file_path: 'notes.txt' } })
  await clock.advance(50)
  expect(notifies.map((n) => n.env.ARCADE_TEXT)).toEqual(['Агент ждёт разрешения'])
  await ui.unmount()
})

test('Linux и macOS: уведомление через notify-send и osascript', async ($, on) => {
  const { clock, notifies } = stubs(on, { uname: 'Linux' })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await playInWindowThenTurn($, clock, ui, 25_000)
  expect(notifies[0].argv).toEqual(['notify-send', '--app-name=Claude Code', 'Claude Code', 'Агент закончил — можно возвращаться'])
  await ui.unmount()
  expect(notifyCommand('mac', 'Claude Code', 'Агент закончил').argv).toEqual([
    'osascript', '-e', 'on run argv', '-e', 'display notification (item 2 of argv) with title (item 1 of argv) sound name "Glass"', '-e', 'end run', 'Claude Code', 'Агент закончил',
  ])
  expect(notifyCommand(null, 'x', 'y')).toBe(null)
  const win = notifyCommand('windows', 'Claude Code', 'Агент «закончил»')
  expect(win.argv.at(-1)).toBe(encodePowerShell(NOTIFY_SCRIPT_TEXT))
  expect(win.env.ARCADE_TEXT).toBe('Агент «закончил»') // текст — через переменную, кавычки не ломают команду
  expect(NOTIFY_SCRIPT_TEXT).toMatch(/ShowBalloonTip/)
})

// Своя игра для тестов: изменённый Thwaite (не совпадает с играми каталога) и картридж Sega
async function myNesRom() {
  const rom = await probeRom()
  return { ...rom, bytes: Uint8Array.fromBase64(rom.base64) }
}
function mySegaRom() {
  const bytes = new Uint8Array(0x400)
  bytes.set(new TextEncoder().encode('SEGA MEGA DRIVE '), 0x100)
  return bytes
}

test('свои игры: /arcade-add с путём в кавычках — копия в ~/.claude/arcade, игра в «Моих играх» и идёт в панели', HEAVY, async ($, on) => {
  const rom = await myNesRom()
  const { clock, saved, diskFile, blits } = stubs(on, { env: { HOME: '/home/max' }, disk: { '/home/max/Игры/My_Game.nes': rom.bytes } })
  await start($)
  await $.command.run({ command: 'arcade-add', args: '"/home/max/Игры/My_Game.nes"' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Arcade · мои игры' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Добавлено: My Game (Денди).' })).toBeDefined()
  const id = `mine-${rom.sha.slice(0, 12)}`
  expect(await ui.find({ key: `arcade-game-${id}` })).toMatchObject({ props: { label: 'My Game' } })
  expect(diskFile(`/home/max/.claude/arcade/roms/${rom.sha}.b64`)).toBe(rom.base64)
  expect(saved.get('mine')).toEqual([{ id, console: 'nes', title: 'My Game', sha256: rom.sha }])
  // Каталог Денди — без своих игр, они в «Моих играх»
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ type: 'Text', text: '  1 игра' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  3 игры' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-nes' })
  expect(await ui.find({ key: `arcade-game-${id}` })).toBeUndefined()
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-mine' })
  await ui.press({ key: `arcade-game-${id}` })
  expect(await ui.find({ type: 'Text', text: /Arcade · My Game/ })).toBeDefined()
  await clock.advance(500)
  expect(blits.length > 0).toBe(true)
  await tap(ui, 'backspace') // из своей игры — обратно в «Мои игры»
  expect(await ui.find({ type: 'Text', text: 'Arcade · мои игры' })).toBeDefined()
  await ui.unmount()
})

test('свои игры: понятные ошибки — нет пути, нет файла, больше 4 МБ, не игра, маппер, повтор', async ($, on) => {
  const rom = await myNesRom()
  const mapper6 = rom.bytes.slice()
  mapper6[6] = (mapper6[6] & 0x0f) | 0x60
  const { disk } = stubs(on, {
    env: { HOME: '/home/max' },
    disk: { '/g/a.nes': rom.bytes, '/g/big.bin': { size: 5_000_000 }, '/g/notes.txt': 'просто текст', '/g/m6.nes': mapper6 },
  })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const add = async (args: string) => {
    await $.command.run({ command: 'arcade-add', args })
    return (await ui.find({ type: 'Text', text: /^(Добавлено|Не получилось|Укажи|«)/ }))?.children?.join?.('') ?? (await ui.drawn())
  }
  await $.command.run({ command: 'arcade-add', args: '   ' })
  expect(await ui.find({ type: 'Text', text: /^Укажи путь к файлу/ })).toBeDefined()
  await $.command.run({ command: 'arcade-add', args: '/g/nope.nes' })
  expect(await ui.find({ type: 'Text', text: 'Не получилось добавить: файл не найден: /g/nope.nes' })).toBeDefined()
  await $.command.run({ command: 'arcade-add', args: '/g/big.bin' })
  expect(await ui.find({ type: 'Text', text: /^Не получилось добавить: файл больше 4 МБ\. Здесь добавляются игры Денди и Sega, а диски PlayStation — в окне Arcade/ })).toBeDefined()
  await $.command.run({ command: 'arcade-add', args: '/g/notes.txt' })
  expect(await ui.find({ type: 'Text', text: /не похоже на игру для Денди/ })).toBeDefined()
  await $.command.run({ command: 'arcade-add', args: '/g/m6.nes' })
  expect(await ui.find({ type: 'Text', text: /маппером 6 наш эмулятор Денди пока не поддерживает/ })).toBeDefined()
  await $.command.run({ command: 'arcade-add', args: '/g/a.nes' })
  await $.command.run({ command: 'arcade-add', args: '/g/a.nes' })
  expect(await ui.find({ type: 'Text', text: '«a» уже есть в «Моих играх».' })).toBeDefined()
  expect([...disk.keys()].filter((k) => k.endsWith('.b64')).length).toBe(1)
  void add
  await ui.unmount()
})

test('свои игры: Sega узнаётся, в панели — честное сообщение; удаление стирает копию', async ($, on) => {
  const { diskFile, saved } = stubs(on, { env: { HOME: '/home/max' }, disk: { '/g/Sonic Clone.md': mySegaRom() } })
  await start($)
  await $.command.run({ command: 'arcade-add', args: '/g/Sonic Clone.md' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Добавлено: Sonic Clone (Sega Mega Drive).' })).toBeDefined()
  const [entry] = saved.get('mine') as any[]
  expect(entry.console).toBe('sega')
  await ui.press({ key: `arcade-game-${entry.id}` })
  expect(await ui.find({ type: 'Text', text: 'Игры Sega идут в окне браузера, а здесь его открыть нельзя.' })).toBeDefined() // ОС не определена
  await ui.press({ key: `arcade-mine-remove-${entry.id}` })
  expect(saved.get('mine')).toEqual([])
  expect(diskFile(`/home/max/.claude/arcade/roms/${entry.sha256}.b64`)).toBe('')
  expect(await ui.find({ type: 'Text', text: /^Пока пусто/ })).toBeDefined()
  await ui.unmount()
})

test('свои игры на Windows: папка данных в профиле, поле «Добавить файл» в меню вызывает ту же команду', async ($, on) => {
  const rom = await myNesRom()
  const { diskFile } = stubs(on, { env: { ...WINDOWS, USERPROFILE: 'C:\\Users\\Иван' }, disk: { 'D:\\Игры\\Моя игра.nes': rom.bytes } })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-mine' })
  expect(await ui.find({ type: 'Text', text: /^Пока пусто/ })).toBeDefined()
  await ui.input({ key: 'arcade-mine-path', text: '"D:\\Игры\\Моя игра.nes"', kind: 'submit' })
  expect(await ui.find({ type: 'Text', text: 'Добавлено: Моя игра (Денди).' })).toBeDefined()
  expect(diskFile(`C:\\Users\\Иван\\.claude\\arcade\\roms\\${rom.sha}.b64`)).toBe(rom.base64) // папка данных — в профиле
  await ui.unmount()
})

test('mine.js: путь, тип файла, название и проверка сохранённого списка', async () => {
  expect(cleanPath('  "C:\\Игры\\a b.nes"  ')).toBe('C:\\Игры\\a b.nes')
  expect(cleanPath("'/home/x/a.nes'")).toBe('/home/x/a.nes')
  expect(cleanPath(undefined)).toBe('')
  expect(titleFromPath('C:\\Games\\Super_Game_(USA).nes')).toBe('Super Game (USA)')
  expect(titleFromPath('/x/.nes')).toBe('Моя игра')
  expect(identifyRom(new Uint8Array(10)).error).toMatch(/не похоже/)
  expect(identifyRom(new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 0, 0, 0])).error).toBe('это архив. Распакуй его и укажи путь к самому файлу игры: .nes, .md или .bin')
  expect(identifyRom(new TextEncoder().encode('Rar!\x1a\x07\x00 ……')).error).toMatch(/^это архив/)
  expect(identifyRom(mySegaRom())).toEqual({ console: 'sega' })
  const rom = await myNesRom()
  expect(identifyRom(rom.bytes)).toEqual({ console: 'nes', mapper: 0 })
  expect(restoreMine([{ id: 'mine-0123456789ab', console: 'nes', title: 'A', sha256: 'a'.repeat(64) }, { id: 'evil', console: 'nes', sha256: 'b'.repeat(64) }, null, 5])).toEqual([
    { id: 'mine-0123456789ab', console: 'nes', title: 'A', sha256: 'a'.repeat(64) },
  ])
  expect(restoreMine('мусор')).toEqual([])
})

// Игра Sega в каталоге сайта: идёт только в окне браузера (EmulatorJS на сайте)
function segaCatalog() {
  const sha = 'c'.repeat(64)
  return siteCatalog({ miniplanets: { console: 'sega', title: 'Miniplanets', genre: 'платформер', about: 'планеты', keys: '…', rom: { url: `files/${sha}.bin`, base64: `files/${sha}.bin.b64`, sha256: sha, size: 1 } } })
}

test('Sega из каталога: в VS Code на Windows открывается окном, хотя по умолчанию там панель', async ($, on) => {
  const { clock, launches } = stubs(on, { env: WINDOWS, site: segaCatalog() })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'vscode' })
  await ui.press({ key: 'arcade-menu-sega' })
  expect(await ui.find({ key: 'arcade-game-miniplanets' })).toMatchObject({ props: { label: 'Miniplanets' } })
  await ui.press({ key: 'arcade-game-miniplanets' })
  expect(launches.length).toBe(1)
  expect(launches[0].env.ARCADE_URL).toBe(`${SITE}/?game=miniplanets`)
  await ui.unmount()
})

test('Sega из каталога: в терминале без определённой ОС — понятное сообщение вместо окна', async ($, on) => {
  const { clock, launches } = stubs(on, { site: segaCatalog() })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-menu-sega')
  await ui.press({ key: 'arcade-game-miniplanets' })
  expect(await ui.find({ type: 'Text', text: 'Игры Sega идут в окне браузера, а здесь его открыть нельзя.' })).toBeDefined()
  await ui.unmount()
  expect(launches.length).toBe(0)
})

test('Desktop: игра Sega — во встроенном браузере приложения, мод сам просит его сервер', async ($, on) => {
  const { clock, launches, mcpCalls, browserCalls, fills, saved, closed } = stubs(on, { site: segaCatalog(), browser: 'ok' })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(ui, 'arcade-menu-sega')
  expect(await ui.find({ type: 'Text', text: 'Игры открываются во встроенном браузере Claude.' })).toBeDefined()
  await ui.press({ key: 'arcade-game-miniplanets' })
  expect(browserCalls.length).toBe(1)
  expect(browserCalls[0]).toMatchObject({ server: 'Claude_Browser', tool: 'preview_start', args: { url: `${SITE}/?game=miniplanets` } })
  expect(mcpCalls.map((c) => c.tool)).toEqual(['tabs_context', 'preview_start', 'show_pane'])
  expect(mcpCalls[2]).toMatchObject({ server: 'ccd_view', args: { pane: 'preview' } })
  // Каждый вызов несёт нажатие человека — на случай, если решать будет классификатор авто-режима
  const consent = `The user pressed a button in the Arcade pane to open ${SITE}/?game=miniplanets in the built-in browser.`
  expect(mcpCalls.map((c) => c.consent)).toEqual([consent, consent, consent])
  expect(closed).toEqual(['arcade']) // браузер встаёт на место панели Arcade
  expect(fills).toEqual([])
  expect(launches.length).toBe(0)
  expect(await ui.find({ type: 'Text', text: 'Miniplanets открыт во встроенном браузере Claude.' })).toBeDefined()
  expect(saved.get('lastGame')).toBe('miniplanets')
  await clock.advance(15_000) // сообщение уходит, как после окна
  expect(await ui.find({ type: 'Text', text: 'Miniplanets открыт во встроенном браузере Claude.' })).toBeUndefined()
  await ui.unmount()
})

test('Desktop: в настройках — встроенный браузер или окно браузера; окно открывается, как в терминале', async ($, on) => {
  const { clock, launches, mcpCalls, saved } = stubs(on, { env: WINDOWS, site: segaCatalog(), browser: 'ok' })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: '  открывать: встроенный браузер Claude' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-opener' })).toMatchObject({ props: { label: 'Открывать: встроенный браузер Claude' } })
  expect(await ui.find({ key: 'arcade-graphics' })).toBeUndefined() // Денди в Desktop — картинкой
  await ui.press({ key: 'arcade-opener' })
  expect(await ui.find({ key: 'arcade-opener' })).toMatchObject({ props: { label: 'Открывать: окно браузера по умолчанию (Google Chrome)' } })
  expect(saved.get('desktopOpener')).toBe('window')
  expect(saved.get('opener')).toEqual({ opener: null, browser: 'default' }) // выбор терминала не трогаем
  await go(ui, 'arcade-menu-sega')
  expect(await ui.find({ type: 'Text', text: 'Игры открываются в окне браузера по умолчанию (Google Chrome).' })).toBeDefined()
  await ui.press({ key: 'arcade-game-miniplanets' })
  expect(launches.length).toBe(1)
  expect(launches[0].env.ARCADE_URL).toBe(`${SITE}/?game=miniplanets`)
  expect(mcpCalls).toEqual([])
  // Денди и в окне браузера Desktop — здесь, в панели
  await go(ui, 'arcade-menu-nes')
  expect(await ui.find({ type: 'Text', text: 'Игры открываются здесь, в панели.' })).toBeDefined()
  // По кругу: окно Chrome, окно Firefox и снова встроенный браузер
  await go(ui, 'arcade-opener')
  expect(await ui.find({ key: 'arcade-opener' })).toMatchObject({ props: { label: 'Открывать: окно Google Chrome' } })
  await ui.press({ key: 'arcade-opener' })
  expect(await ui.find({ key: 'arcade-opener' })).toMatchObject({ props: { label: 'Открывать: окно Firefox (обычное окно браузера)' } })
  expect(saved.get('opener')).toEqual({ opener: null, browser: 'firefox' })
  await ui.press({ key: 'arcade-opener' })
  expect(await ui.find({ key: 'arcade-opener' })).toMatchObject({ props: { label: 'Открывать: встроенный браузер Claude' } })
  expect(saved.get('desktopOpener')).toBe('builtin')
  await ui.unmount()
})

test('Desktop: окно браузера выбрано в прошлый раз — «Окно Arcade» и «В окне» открывают его', async ($, on) => {
  // Каталог и последняя игра — из прошлого сеанса, как в жизни
  const copy = JSON.parse(segaCatalog())
  const catalog = { consoles: copy.consoles, games: Object.entries(copy.games).map(([id, g]: any) => ({ id, ...g })) }
  const { clock, launches, mcpCalls } = stubs(on, { env: WINDOWS, site: segaCatalog(), browser: 'ok', stored: { desktopOpener: 'window', lastGame: 'miniplanets', catalog } })
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' })
  await $.turn.start({ turnId: 't1' })
  await clock.advance(21_000)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await band.press({ key: 'arcade-play-window' })
  expect(launches.length).toBe(1)
  expect(launches[0].env.ARCADE_URL).toBe(`${SITE}/?game=miniplanets`)
  await band.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-open-library' })
  expect(launches.length).toBe(2)
  expect(launches[1].env.ARCADE_URL).toBe(`${SITE}/`)
  expect(mcpCalls).toEqual([])
  await ui.unmount()
})

// Полки «Шутеры» и «Гонки»: FreeDM просит захваченную мышь, HexGL — нет
function shooterCatalog() {
  const site = JSON.parse(siteCatalog())
  site.consoles.push({ id: 'doom', title: 'Шутеры', group: 'games' }, { id: 'web', title: 'Браузерные', group: 'games' })
  site.groups = [{ id: 'games', title: 'Игры' }]
  site.shelves = [{ id: 'shooters', title: 'Шутеры' }, { id: 'racing', title: 'Гонки' }]
  const sha = 'e'.repeat(64)
  site.games.freedm = { console: 'doom', net: 'doom', shelf: 'shooters', title: 'FreeDM', genre: 'шутер', about: 'сеть', keys: '…', rom: { url: `files/${sha}.wad`, base64: `files/${sha}.wad.b64`, sha256: sha, size: 1 } }
  site.games.hexgl = { console: 'web', kind: 'web', shelf: 'racing', page: 'web-games/hexgl/', title: 'HexGL', genre: 'гонки', about: 'гонки', keys: '…' }
  return JSON.stringify(site)
}
const MOUSE_NOTE = 'Встроенный браузер Claude не даёт игре захватить мышь, поэтому шутеры открываются окном браузера.'

test('Desktop: шутеры — окном браузера и при встроенном браузере (там мышь не захватывается), остальное — во встроенном', async ($, on) => {
  const { clock, launches, mcpCalls } = stubs(on, { env: WINDOWS, site: shooterCatalog(), browser: 'ok' })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-games' })
  await ui.press({ key: 'arcade-menu-shelf-shooters' })
  expect(await ui.find({ type: 'Text', text: 'Игры открываются в окне браузера по умолчанию (Google Chrome).' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: MOUSE_NOTE })).toBeDefined()
  await ui.press({ key: 'arcade-game-freedm' })
  expect(launches.length).toBe(1)
  expect(launches[0].env.ARCADE_URL).toBe(`${SITE}/?game=freedm`)
  await ui.press({ key: 'arcade-open-tab-shelf-shooters' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?tab=games&shelf=shooters`)
  expect(mcpCalls).toEqual([])
  // Гонки мышь не захватывают — встроенный браузер, без пометки
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-shelf-racing' })
  expect(await ui.find({ type: 'Text', text: 'Игры открываются во встроенном браузере Claude.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: MOUSE_NOTE })).toBeUndefined()
  await ui.press({ key: 'arcade-game-hexgl' })
  expect(mcpCalls.map((c) => c.tool)).toEqual(['tabs_context', 'preview_start', 'show_pane'])
  expect(launches.length).toBe(2)
  await ui.unmount()
})

test('Desktop: «В окне» на плашке для шутера — окно браузера; без ОС шутер всё же во встроенном браузере', async ($, on) => {
  const copy = JSON.parse(shooterCatalog())
  const catalog = { consoles: copy.consoles, groups: copy.groups, shelves: copy.shelves, games: Object.entries(copy.games).map(([id, g]: any) => ({ id, ...g })) }
  const { clock, launches, mcpCalls } = stubs(on, { env: WINDOWS, site: shooterCatalog(), browser: 'ok', stored: { lastGame: 'freedm', catalog } })
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' })
  await $.turn.start({ turnId: 't1' })
  await clock.advance(21_000)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await band.press({ key: 'arcade-play-window' })
  expect(launches.length).toBe(1)
  expect(launches[0].env.ARCADE_URL).toBe(`${SITE}/?game=freedm`)
  expect(mcpCalls).toEqual([])
  await band.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-opener' })).toMatchObject({ props: { label: 'Открывать: встроенный браузер Claude' } })
  expect(await ui.find({ type: 'Text', text: `  ${MOUSE_NOTE}` })).toBeDefined()
  await ui.unmount()
})

test('Desktop без определённой ОС: шутер — во встроенном браузере, окна нет', async ($, on) => {
  const { clock, launches, mcpCalls } = stubs(on, { site: shooterCatalog(), browser: 'ok' })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-games' })
  await ui.press({ key: 'arcade-menu-shelf-shooters' })
  expect(await ui.find({ type: 'Text', text: 'Игры открываются во встроенном браузере Claude.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: MOUSE_NOTE })).toBeUndefined()
  await ui.press({ key: 'arcade-game-freedm' })
  expect(mcpCalls.map((c) => c.tool)).toEqual(['tabs_context', 'preview_start', 'show_pane'])
  expect(launches.length).toBe(0)
  await ui.unmount()
})

test('Desktop: вкладка Arcade уже открыта — игра открывается в ней, новой вкладки нет', async ($, on) => {
  const tabs = [
    { tabId: 'seed', origin: 'https://example.com', isActive: true },
    { tabId: 'tab-1', origin: SITE, isActive: false },
    { tabId: 'tab-2', origin: SITE, isActive: false },
  ]
  const { clock, mcpCalls, fills } = stubs(on, { site: segaCatalog(), browser: 'ok', tabs })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(ui, 'arcade-menu-sega')
  await ui.press({ key: 'arcade-game-miniplanets' })
  expect(mcpCalls.map((c) => c.tool)).toEqual(['tabs_context', 'navigate', 'tabs_select', 'show_pane'])
  expect(mcpCalls[1]).toMatchObject({ server: 'Claude_Browser', args: { url: `${SITE}/?game=miniplanets`, tabId: 'tab-2' } })
  expect(mcpCalls[2]).toMatchObject({ args: { tabId: 'tab-2' } })
  expect(fills).toEqual([])
  expect(await ui.find({ type: 'Text', text: 'Miniplanets открыт во встроенном браузере Claude.' })).toBeDefined()
  await ui.unmount()
})

test('Desktop: свои вызовы браузера Arcade разрешает только на своём сайте и только инструментам браузера', () => {
  expect(ownDesktopCall('mcp__Claude_Browser__preview_start', { url: `${SITE}/?game=miniplanets` })).toBe(true)
  expect(ownDesktopCall('mcp__Claude_Browser__navigate', { url: `${SITE}/`, tabId: 'tab-1' })).toBe(true)
  expect(ownDesktopCall('mcp__Claude_Browser__tabs_context', {})).toBe(true)
  expect(ownDesktopCall('mcp__Claude_Browser__tabs_select', { tabId: 'tab-1' })).toBe(true)
  expect(ownDesktopCall('mcp__ccd_view__show_pane', { pane: 'preview' })).toBe(true)
  // Чужой сайт, сайт с похожим началом, другая панель, другой инструмент — нет
  expect(ownDesktopCall('mcp__Claude_Browser__preview_start', { url: 'https://example.com/' })).toBe(false)
  expect(ownDesktopCall('mcp__Claude_Browser__navigate', { url: `${SITE}.example.com/` })).toBe(false)
  expect(ownDesktopCall('mcp__Claude_Browser__preview_start', {})).toBe(false)
  expect(ownDesktopCall('mcp__ccd_view__show_pane', { pane: 'terminal' })).toBe(false)
  expect(ownDesktopCall('mcp__Claude_Browser__javascript_tool', { text: '1' })).toBe(false)
  expect(ownDesktopCall('Bash', { command: 'ls' })).toBe(false)
})

test('Desktop: те же инструменты браузера у Claude Arcade не разрешает — решение остаётся обычным', async ($, on) => {
  const { clock } = stubs(on)
  await start($)
  await clock.advance(200)
  // Вызов из теста идёт от движка, как вызов самого Claude; вызов от Arcade тест поднять не может
  const { decision } = await $.tool.check({ tool: 'mcp__Claude_Browser__preview_start', input: { url: `${SITE}/?game=miniplanets` } })
  expect(decision).toBe('ask')
})

const BACK_TO_WORK = 'Потом вернись к работе, которую делал до этого.'

test('Desktop: авто-режим не пускает мод к браузеру, агент работает — Arcade прерывает ход, Claude открывает игру и возвращается к работе', async ($, on) => {
  const { clock, mcpCalls, aborts, submits, fills, closed, toasts } = stubs(on, { site: segaCatalog(), abort: true, submit: true })
  await start($)
  await clock.advance(200)
  await $.turn.start({ turnId: 't1', text: 'почини тесты' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const url = `${SITE}/?game=miniplanets`
  // Claude открывает сайт Arcade сам по себе — панель Arcade остаётся
  await $.tool.call({ tool: 'mcp__Claude_Browser__preview_start', url: `${SITE}/` })
  expect(closed).toEqual([])
  mcpCalls.length = 0
  await go(ui, 'arcade-menu-sega')
  await ui.press({ key: 'arcade-game-miniplanets' })
  expect(mcpCalls.map((c) => c.tool)).toEqual(['tabs_context', 'preview_start'])
  expect(aborts).toEqual([{ turnId: 't1' }])
  expect(submits.length).toBe(1)
  expect(submits[0]).toMatchObject({ text: `Открой во встроенном браузере: ${url}\n${BACK_TO_WORK}`, origin: { kind: 'plugin' } })
  expect(fills).toEqual([])
  expect(closed).toEqual([]) // пока игра не открылась, панель остаётся с подсказкой
  expect(await ui.find({ type: 'Text', text: 'Arcade прервал Claude: он откроет игру во встроенном браузере и вернётся к работе.' })).toBeDefined()
  // Оборванный ход — не «агент закончил»: Claude сейчас же продолжит
  await $.turn.complete({ turnId: 't1', reason: 'aborted', answer: '' })
  expect(toasts).not.toContain('Агент закончил — Esc, чтобы вернуться')
  // Игра открылась — панель Arcade закрывается, браузеру нужно место
  await $.turn.start({ turnId: 't2', text: submits[0].text })
  await $.tool.call({ tool: 'mcp__Claude_Browser__preview_start', url })
  expect(closed).toEqual(['arcade'])
  await ui.unmount()
})

test('Desktop: агент выполняет инструмент — Arcade ждёт его конца и только потом прерывает ход', async ($, on) => {
  const { clock, aborts, submits } = stubs(on, { site: segaCatalog(), abort: true, submit: true })
  await start($)
  await clock.advance(200)
  await $.turn.start({ turnId: 't1', text: 'почини тесты' })
  const running = $.tool.call({ tool: 'Bash', command: 'npm test' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(ui, 'arcade-menu-sega')
  await ui.press({ key: 'arcade-game-miniplanets' })
  expect(aborts).toEqual([])
  expect(submits).toEqual([])
  const waiting = 'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть игру во встроенном браузере.'
  expect(await ui.find({ type: 'Text', text: waiting })).toBeDefined()
  await clock.advance(BASH_MS / 2) // инструмент ещё идёт — сообщение не пропадает
  expect(await ui.find({ type: 'Text', text: waiting })).toBeDefined()
  expect(aborts).toEqual([])
  await clock.advance(BASH_MS / 2)
  await running
  await clock.settle()
  expect(aborts).toEqual([{ turnId: 't1' }])
  expect(submits[0]).toMatchObject({ text: `Открой во встроенном браузере: ${SITE}/?game=miniplanets\n${BACK_TO_WORK}` })
  expect(await ui.find({ type: 'Text', text: 'Arcade прервал Claude: он откроет игру во встроенном браузере и вернётся к работе.' })).toBeDefined()
  await ui.unmount()
})

test('Desktop: инструмент агента идёт дольше 10 секунд — Arcade обрывает его и просит Claude проверить, что тот успел', async ($, on) => {
  const { clock, aborts, submits } = stubs(on, { site: segaCatalog(), abort: true, submit: true, bashMs: 11_000 })
  await start($)
  await clock.advance(200)
  await $.turn.start({ turnId: 't1', text: 'почини тесты' })
  const running = $.tool.call({ tool: 'Bash', command: 'npm run build' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(ui, 'arcade-menu-sega')
  await ui.press({ key: 'arcade-game-miniplanets' })
  await clock.advance(9_000)
  expect(aborts).toEqual([])
  await clock.advance(1_000)
  await clock.settle()
  expect(aborts).toEqual([{ turnId: 't1' }])
  const cut = 'Твой последний инструмент оборван на полпути: проверь, что он успел сделать, прежде чем продолжать.'
  expect(submits[0]).toMatchObject({ text: `Открой во встроенном браузере: ${SITE}/?game=miniplanets\n${BACK_TO_WORK}\n${cut}` })
  expect(await ui.find({ type: 'Text', text: 'Arcade прервал Claude: он откроет игру во встроенном браузере и вернётся к работе.' })).toBeDefined()
  // Инструмент кончился уже после обрыва — второй раз не прерываем
  await clock.advance(1_000)
  await running
  await clock.settle()
  expect(aborts.length).toBe(1)
  expect(submits.length).toBe(1)
  await ui.unmount()
})

test('Desktop: игра ждала конца инструмента, а ход кончился сам — прерывать нечего, просьба уходит как обычно', async ($, on) => {
  const { clock, aborts, submits } = stubs(on, { site: segaCatalog(), abort: true, submit: true })
  await start($)
  await clock.advance(200)
  await $.turn.start({ turnId: 't1', text: 'почини тесты' })
  const running = $.tool.call({ tool: 'Bash', command: 'npm test' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(ui, 'arcade-menu-sega')
  await ui.press({ key: 'arcade-game-miniplanets' })
  await $.turn.complete({ turnId: 't1', reason: 'aborted', answer: '' }) // человек нажал Esc
  expect(submits.length).toBe(1)
  expect(submits[0]).toMatchObject({ text: `Открой во встроенном браузере: ${SITE}/?game=miniplanets` })
  await clock.advance(BASH_MS)
  await running
  await clock.settle()
  expect(aborts).toEqual([])
  expect(submits.length).toBe(1)
  expect(await ui.find({ type: 'Text', text: 'Arcade попросил Claude открыть ссылку во встроенном браузере.' })).toBeDefined()
  await ui.unmount()
})

test('Desktop: ход агента не прервался — просьба ждёт конца хода', async ($, on) => {
  const { clock, aborts, submits, fills } = stubs(on, { site: segaCatalog(), submit: true })
  await start($)
  await clock.advance(200)
  await $.turn.start({ turnId: 't1', text: 'почини тесты' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(ui, 'arcade-menu-sega')
  await ui.press({ key: 'arcade-game-miniplanets' })
  expect(aborts).toEqual([{ turnId: 't1' }])
  expect(submits.length).toBe(1)
  expect(submits[0]).toMatchObject({ text: `Открой во встроенном браузере: ${SITE}/?game=miniplanets` })
  expect(fills).toEqual([])
  expect(await ui.find({ type: 'Text', text: 'Arcade попросил Claude открыть ссылку во встроенном браузере.' })).toBeDefined()
  await ui.unmount()
})

test('Desktop: Claude Code спрашивает разрешение — ход не прерываем, ждём конца инструмента', async ($, on) => {
  const { clock, aborts, submits } = stubs(on, { site: segaCatalog(), abort: true, submit: true })
  await start($)
  await clock.advance(200)
  await $.turn.start({ turnId: 't1', text: 'почини тесты' })
  await $.classic.PermissionRequest({ tool_name: 'Bash' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(ui, 'arcade-menu-sega')
  await ui.press({ key: 'arcade-game-miniplanets' })
  expect(aborts).toEqual([])
  expect(submits).toEqual([])
  await ui.unmount()
})

test('Desktop: работает субагент, а не агент — его ход Arcade не прерывает, «агент закончил» про него не пишет', async ($, on) => {
  const { clock, aborts, submits, closed, toasts } = stubs(on, { site: segaCatalog(), abort: true, submit: true })
  await start($)
  await clock.advance(200)
  await $.turn.start({ turnId: 's1', agentId: 'explore-1', text: 'find it' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(ui, 'arcade-menu-sega')
  await ui.press({ key: 'arcade-game-miniplanets' })
  expect(aborts).toEqual([])
  expect(submits[0]).toMatchObject({ text: `Открой во встроенном браузере: ${SITE}/?game=miniplanets` })
  await $.turn.complete({ turnId: 's1', agentId: 'explore-1', answer: 'found it' })
  expect(submits.length).toBe(1)
  expect(closed).toEqual([])
  expect(toasts).not.toContain('Агент закончил — Esc, чтобы вернуться')
  await ui.unmount()
})

test('Desktop: Claude открыл игру по просьбе Arcade — Arcade пробует показать браузер и закрывает панель', async ($, on) => {
  const { clock, mcpCalls, submits, closed } = stubs(on, { site: segaCatalog(), submit: true })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(ui, 'arcade-menu-sega')
  await ui.press({ key: 'arcade-game-miniplanets' })
  expect(submits.length).toBe(1)
  expect(closed).toEqual([])
  await $.tool.call({ tool: 'mcp__Claude_Browser__navigate', url: `${SITE}/?game=miniplanets`, tabId: 'tab-1' })
  expect(mcpCalls.at(-1)).toMatchObject({ tool: 'show_pane', args: { pane: 'preview' } })
  expect(closed).toEqual(['arcade'])
  await ui.unmount()
})

test('Desktop: агент свободен — просьба с адресом сразу уходит Claude, прерывать нечего', async ($, on) => {
  const { clock, mcpCalls, aborts, submits, fills, closed } = stubs(on, { site: segaCatalog(), abort: true, submit: true, draft: 'поправь тесты' })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(ui, 'arcade-menu-sega')
  await ui.press({ key: 'arcade-game-miniplanets' })
  expect(mcpCalls.map((c) => c.tool)).toEqual(['tabs_context', 'preview_start'])
  expect(aborts).toEqual([])
  expect(submits.length).toBe(1)
  expect(submits[0]).toMatchObject({ text: `Открой во встроенном браузере: ${SITE}/?game=miniplanets`, origin: { kind: 'plugin' } })
  expect(fills).toEqual([]) // черновик в поле не трогаем
  expect(closed).toEqual([]) // браузер откроет Claude, когда ответит — панель пока остаётся с подсказкой
  expect(await ui.find({ type: 'Text', text: 'Arcade попросил Claude открыть ссылку во встроенном браузере.' })).toBeDefined()
  await ui.unmount()
})

test('Desktop: просьбу Claude не приняли — она встаёт в поле ввода после черновика', async ($, on) => {
  const { clock, mcpCalls, submits, fills, closed } = stubs(on, { site: segaCatalog(), draft: 'поправь тесты' })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(ui, 'arcade-menu-sega')
  await ui.press({ key: 'arcade-game-miniplanets' })
  expect(mcpCalls.map((c) => c.tool)).toEqual(['tabs_context', 'preview_start'])
  expect(submits.length).toBe(1)
  expect(closed).toEqual([]) // браузер не открылся — панель остаётся с подсказкой
  expect(fills.length).toBe(1)
  expect(fills[0]).toMatchObject({ text: `\nОткрой во встроенном браузере: ${SITE}/?game=miniplanets`, mode: 'append' })
  expect(await ui.find({ type: 'Text', text: 'Ссылка — в поле ввода: нажми Enter, и Claude откроет её во встроенном браузере.' })).toBeDefined()
  await ui.unmount()
})

test('Desktop: сервер браузера ответил ошибкой — Claude не просим, просьба в поле ввода, в пустом поле без пустой строки', async ($, on) => {
  const { clock, browserCalls, submits, fills } = stubs(on, { browser: 'error', submit: true })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-open-library' })
  expect(browserCalls[0]).toMatchObject({ args: { url: `${SITE}/` } })
  expect(submits).toEqual([])
  expect(fills.length).toBe(1)
  expect(fills[0]).toMatchObject({ text: `Открой во встроенном браузере: ${SITE}/`, mode: 'append' })
  expect(await ui.find({ type: 'Text', text: 'Ссылка — в поле ввода: нажми Enter, и Claude откроет её во встроенном браузере.' })).toBeDefined()
  await ui.unmount()
})

test('Desktop: ссылка уже в поле ввода — второй раз её не дописываем', async ($, on) => {
  const { clock, fills } = stubs(on, { draft: `Открой во встроенном браузере: ${SITE}/` })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-open-library' })
  expect(fills).toEqual([])
  expect(await ui.find({ type: 'Text', text: 'Ссылка — в поле ввода: нажми Enter, и Claude откроет её во встроенном браузере.' })).toBeDefined()
  await ui.unmount()
})

test('Desktop: поле ввода не взяло просьбу, а почему — неизвестно: просьба с адресом остаётся на экране, пока её не перепишут', async ($, on) => {
  const { clock, fills } = stubs(on, { fill: false })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-open-library' })
  expect(fills.length).toBe(1)
  const ask = `Попроси Claude открыть во встроенном браузере: ${SITE}/`
  expect(await ui.find({ type: 'Text', text: ask })).toBeDefined()
  await clock.advance(20_000)
  expect(await ui.find({ type: 'Text', text: ask })).toBeDefined()
  await ui.unmount()
})

test('Desktop: «В окне» в вопросе над вводом — встроенный браузер, итог — тостом', async ($, on) => {
  const { clock, mcpCalls, fills, toasts } = stubs(on)
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' })
  await $.turn.start({ turnId: 't1' })
  await clock.advance(21_000)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await band.press({ key: 'arcade-play-window' })
  expect(mcpCalls[0]).toMatchObject({ server: 'Claude_Browser', tool: 'tabs_context' })
  expect(fills[0]).toMatchObject({ text: `Открой во встроенном браузере: ${SITE}/?game=thwaite` })
  expect(toasts.at(-1)).toBe('Ссылка — в поле ввода: нажми Enter, и Claude откроет её во встроенном браузере.')
  expect(await band.find({ key: 'arcade-play-window' })).toBeUndefined() // вопрос ушёл
  await band.unmount()
})

test('Desktop по-английски: просьба в поле ввода и сообщения — на языке интерфейса, адрес — с языком', async ($, on) => {
  const { clock, fills } = stubs(on, { env: { LANG: 'en_US.UTF-8' } })
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' })
  await clock.advance(200)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-open-library' })
  expect(fills[0]).toMatchObject({ text: `Open in the built-in browser: ${SITE}/?lang=en` })
  expect(await ui.find({ type: 'Text', text: 'The link is in the prompt box: press Enter, and Claude will open it in the built-in browser.' })).toBeDefined()
  await ui.unmount()
  expect(tr('Miniplanets открыт во встроенном браузере Claude.', 'en')).toBe("Miniplanets is open in Claude's built-in browser.")
  expect(tr('Arcade попросил Claude открыть ссылку во встроенном браузере.', 'en')).toBe('Arcade asked Claude to open the link in the built-in browser.')
  expect(tr('Arcade прервал Claude: он откроет игру во встроенном браузере и вернётся к работе.', 'en')).toBe('Arcade interrupted Claude: it will open the game in the built-in browser and get back to work.')
  expect(tr(BACK_TO_WORK, 'en')).toBe('Then get back to the work you were doing before.')
  expect(tr(BACK_TO_WORK, 'de')).not.toMatch(/[А-Яа-яЁё]/)
  expect(tr(`Попроси Claude открыть во встроенном браузере: ${SITE}/`, 'en')).toBe(`Ask Claude to open this in the built-in browser: ${SITE}/`)
  expect(tr('Не получилось открыть встроенный браузер: сначала ответь на вопрос Claude Code.', 'de')).not.toMatch(/[А-Яа-яЁё]/)
})

test('свои игры в окне: Sega из «Моих игр» на Windows открывается окном с адресом #mine=…&sha=… (не уходит на сервер)', async ($, on) => {
  const bytes = mySegaRom()
  const { clock, launches, saved } = stubs(on, { env: { ...WINDOWS, USERPROFILE: 'C:\\Users\\Иван' }, disk: { 'D:\\Игры\\Sonic Clone.md': bytes } })
  await start($)
  await clock.advance(200)
  await $.command.run({ command: 'arcade-add', args: 'D:\\Игры\\Sonic Clone.md' })
  const ui = await $.ui.mount({ ...PANE, surface: 'vscode' })
  const [entry] = saved.get('mine') as any[]
  await ui.press({ key: `arcade-game-${entry.id}` })
  expect(launches.length).toBe(1)
  expect(launches[0].env.ARCADE_URL).toBe(`${SITE}/#mine=${entry.id}&console=sega&sha=${entry.sha256}&title=Sonic%20Clone`)
  await ui.unmount()
})

test('PlayStation в меню мода: подсказка из каталога и кнопка «Открыть PlayStation в окне»', async ($, on) => {
  const withPsx = JSON.parse(siteCatalog())
  withPsx.consoles.push({ id: 'psx', title: 'PlayStation', empty: 'Свободных игр для PlayStation пока нет. Открой свой диск.' })
  const { clock, launches, fills } = stubs(on, { env: WINDOWS, site: JSON.stringify(withPsx) })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-psx' })
  expect(await ui.find({ type: 'Text', text: 'Свободных игр для PlayStation пока нет. Открой свой диск.' })).toBeDefined()
  await ui.press({ key: 'arcade-open-tab-psx' })
  expect(launches.length).toBe(1)
  expect(launches[0].env.ARCADE_URL).toBe(`${SITE}/?tab=psx`)
  expect(await ui.find({ type: 'Text', text: 'Окно Arcade открыто на вкладке PlayStation.' })).toBeDefined()
  await ui.unmount()
  // В Desktop вкладка открывается во встроенном браузере приложения
  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(desk, 'arcade-menu-psx')
  await desk.press({ key: 'arcade-open-tab-psx' })
  expect(launches.length).toBe(1)
  expect(fills[0]).toMatchObject({ text: `Открой во встроенном браузере: ${SITE}/?tab=psx` })
  await desk.unmount()
})

test('PlayStation из каталога: игра в терминале на Windows открывается окном ?game=…', async ($, on) => {
  const withPsx = JSON.parse(siteCatalog())
  withPsx.consoles.push({ id: 'psx', title: 'PlayStation' })
  const sha = 'd'.repeat(64)
  withPsx.games['psx-demo'] = { console: 'psx', title: 'PSX Demo', genre: 'аркада', about: 'проверка', keys: '…', rom: { url: `files/${sha}.zip`, base64: `files/${sha}.zip.b64`, sha256: sha, size: 1 } }
  const { clock, launches, fills } = stubs(on, { env: WINDOWS, site: JSON.stringify(withPsx) })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-psx' })
  expect(await ui.find({ key: 'arcade-game-psx-demo' })).toMatchObject({ props: { label: 'PSX Demo' } })
  expect(await ui.find({ key: 'arcade-open-tab-psx' })).toBeDefined() // и кнопка для своих дисков
  await ui.press({ key: 'arcade-game-psx-demo' })
  expect(launches.length).toBe(1)
  expect(launches[0].env.ARCADE_URL).toBe(`${SITE}/?game=psx-demo`)
  await ui.unmount()
  // В Desktop — встроенный браузер приложения
  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(desk, 'arcade-menu-psx')
  await desk.press({ key: 'arcade-game-psx-demo' })
  expect(launches.length).toBe(1)
  expect(fills[0]).toMatchObject({ text: `Открой во встроенном браузере: ${SITE}/?game=psx-demo` })
  await desk.unmount()
})

test('время работы агента — секунды, минуты и часы: в вопросе и в шапке панели', async ($, on) => {
  expect([0, 48, 59, 60, 134, 600, 3599, 3600, 3900, 7260].map(workedText)).toEqual([
    '0 с', '48 с', '59 с', '1 мин', '2 мин 14 с', '10 мин', '59 мин 59 с', '1 ч', '1 ч 5 мин', '2 ч 1 мин',
  ])
  const { clock } = stubs(on)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' }) // без панели: иначе вопроса не будет
  await $.turn.start({ turnId: 't1' })
  await clock.advance(134_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: 'Агент работает 2 мин 14 с — сыграть?' })).toBeDefined()
  await band.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Агент работает 2 мин 14 с' })).toBeDefined()
  await ui.unmount()
})

test('назначение клавиш — кнопкой в «Настройках» терминала, а не отдельной командой /arcade-keys', async ($, on) => {
  stubs(on)
  await start($)
  // В VS Code клавиши идут через строку 🎮 — проверки и назначения в «Настройках» нет
  const vs = await $.ui.mount({ ...PANE, surface: 'vscode' })
  await vs.press({ key: 'arcade-menu-settings' })
  expect(await vs.find({ key: 'arcade-assign' })).toBeUndefined()
  expect(await vs.find({ key: 'arcade-game-field' })).toBeUndefined()
  await vs.press({ key: 'arcade-back' })
  await vs.unmount()
  // В терминале — проверка клавиш и кнопка «Назначить клавиши заново»
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-game-field' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-assign' })).toMatchObject({ props: { label: 'Назначить клавиши заново' } })
  await ui.press({ key: 'arcade-assign' })
  expect(await ui.find({ type: 'Text', text: /Arcade · Проверка клавиш/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Назначаем управление заново/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Назначить заново: «Настройки» → «Назначить клавиши заново»' })).toBeDefined()
  await ui.unmount()
  // Команды /arcade-keys больше нет
  let missing = false
  try {
    await $.command.run({ command: 'arcade-keys', args: '' })
  } catch {
    missing = true
  }
  expect(missing).toBe(true)
})

test('во всю ширину: настройка запоминается, панель просит ширину сразу, картинка крупнее, но целиком по высоте', HEAVY, async ($, on) => {
  const { saved, widths } = stubs(on)
  await start($)
  expect(widths.at(-1)).toBe(104) // обычная панель
  const big = { ...PANE, surface: 'vscode', props: { ...PANE.props, bodyColumns: 300, scroll: { offset: 0, bodyRows: 80 } } }
  // Обычный размер: экран Денди не шире ×3
  let ui = await $.ui.mount(big)
  await go(ui, 'arcade-game-thwaite')
  expect((await ui.find({ type: 'Svg' })).props.width).toBe(768)
  await ui.press({ key: 'arcade-library' }) // обратно в библиотеку
  await ui.unmount()
  // Во всю ширину
  ui = await $.ui.mount({ ...PANE, surface: 'vscode' })
  await go(ui, 'arcade-wide')
  expect(await ui.find({ key: 'arcade-wide' })).toMatchObject({ props: { label: 'Размер панели: во всю ширину' } })
  expect(saved.get('wide')).toBe(true)
  expect(widths.at(-1)).toBe(400)
  await ui.unmount()
  ui = await $.ui.mount(big)
  await go(ui, 'arcade-game-thwaite')
  // 300 колонок дали бы ×8, но 80 строк по высоте — только ×5: экран целиком виден
  expect((await ui.find({ type: 'Svg' })).props.width).toBe(1280)
  await ui.unmount()
})

test('плашка поверх игры: «Агент закончил» и «Агент ждёт разрешения», кнопки «Играть дальше» и «К агенту»', HEAVY, async ($, on) => {
  const { closed } = stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'vscode' })
  await go(ui, 'arcade-game-thwaite')
  expect(await ui.find({ key: 'arcade-alert-ok' })).toBeUndefined()
  await $.turn.start({ turnId: 't1' })
  await $.turn.complete({ turnId: 't1' })
  expect(await ui.find({ type: 'Text', text: ' Агент закончил ' })).toBeDefined()
  await ui.press({ key: 'arcade-alert-ok' }) // играть дальше — плашка уходит
  expect(await ui.find({ type: 'Text', text: ' Агент закончил ' })).toBeUndefined()
  await $.turn.start({ turnId: 't2' })
  await $.classic.PermissionRequest({ tool_name: 'Write', tool_input: { file_path: 'notes.txt' } })
  expect(await ui.find({ type: 'Text', text: ' Агент ждёт разрешения ' })).toBeDefined()
  await ui.press({ key: 'arcade-to-agent' }) // к агенту — панель закрывается
  expect(closed).toContain('arcade')
  await ui.unmount()
})

test('сигналы агента: настройки «Когда агент закончил» и «…ждёт разрешения» переключаются по кругу и запоминаются', async ($, on) => {
  const { saved } = stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-on-done') // мягко → пауза
  expect(await ui.find({ key: 'arcade-on-done' })).toMatchObject({ props: { label: 'Когда агент закончил: пауза и плашка' } })
  expect(saved.get('onDone')).toBe('pause')
  await ui.press({ key: 'arcade-on-done' })
  expect(await ui.find({ key: 'arcade-on-done' })).toMatchObject({ props: { label: 'Когда агент закончил: сразу к агенту' } })
  await ui.press({ key: 'arcade-on-done' })
  expect(saved.get('onDone')).toBe('notify')
  expect(await ui.find({ key: 'arcade-on-permission' })).toMatchObject({ props: { label: 'Когда агент ждёт разрешения: пауза и плашка' } })
  await ui.unmount()
})

test('сигналы агента в VS Code: «закончил» — игра идёт, «ждёт разрешения» — пауза до «Играть дальше»', HEAVY, async ($, on) => {
  const { clock } = stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'vscode' })
  await go(ui, 'arcade-game-thwaite')
  const frame = async () => (await ui.find({ type: 'Svg' })).props.source
  // Игра идёт, если Start меняет экран
  const runs = async () => {
    const before = await frame()
    await ui.press({ key: 'arcade-pad-start' })
    await clock.advance(2000)
    return (await frame()) !== before
  }
  await clock.advance(1000)
  await $.turn.start({ turnId: 't1' })
  await $.turn.complete({ turnId: 't1' })
  expect(await ui.find({ type: 'Text', text: ' Агент закончил ' })).toBeDefined()
  expect(await runs()).toBe(true) // мягко: игра идёт под плашкой
  await $.turn.start({ turnId: 't2' })
  await $.classic.PermissionRequest({ tool_name: 'Write', tool_input: { file_path: 'notes.txt' } })
  expect(await ui.find({ type: 'Text', text: ' Агент ждёт разрешения · пауза ' })).toBeDefined()
  expect(await runs()).toBe(false) // пауза: экран стоит даже после Start
  await ui.press({ key: 'arcade-alert-ok' })
  expect(await ui.find({ key: 'arcade-alert-ok' })).toBeUndefined()
  expect(await runs()).toBe(true) // «Играть дальше» — игра пошла
  await ui.unmount()
})

test('сигналы агента: «сразу к агенту» закрывает панель; в терминале пауза видна и снимается клавишей игры', HEAVY, async ($, on) => {
  const { clock, closed, blits } = stubs(on, { stored: { onDone: 'close' } })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-game-thwaite')
  await clock.advance(500)
  // «Ждёт разрешения» по умолчанию — пауза: кадры не уходят, над экраном сказано почему
  await $.turn.start({ turnId: 't1' })
  await $.classic.PermissionRequest({ tool_name: 'Write', tool_input: { file_path: 'notes.txt' } })
  expect(await ui.find({ type: 'Text', text: /^Пауза: агент ждёт разрешения\. Любая клавиша игры — играть дальше/ })).toBeDefined()
  const frozen = blits.length
  await clock.advance(500)
  expect(blits.length).toBe(frozen)
  await tap(ui, 'd') // любая клавиша игры — дальше
  await clock.advance(500)
  expect(blits.length > frozen).toBe(true)
  expect(await ui.find({ type: 'Text', text: /^Пауза:/ })).toBeUndefined()
  // «Закончил» с настройкой «сразу к агенту» — панель закрывается
  await $.turn.complete({ turnId: 't1' })
  expect(closed).toContain('arcade')
  await ui.unmount()
})

// Картридж с меткой TMR SEGA и кодом региона: 4 — Master System, 6 — Game Gear (Game Gear Arcade не поддерживает)
function tmrRom(region: number) {
  const bytes = new Uint8Array(0x8000)
  bytes.set(new TextEncoder().encode('TMR SEGA'), 0x7ff0)
  bytes[0x7fff] = region << 4
  return bytes
}

test('Master System: мод узнаёт картриджи, свои игры добавляются, игры каталога — в окне; Game Gear — понятный отказ', async ($, on) => {
  expect(identifyRom(tmrRom(4))).toEqual({ console: 'sms' })
  expect(identifyRom(tmrRom(6)).error).toBe('это игра для Game Gear — Game Gear в Arcade не поддерживается')
  expect(identifyRom(new Uint8Array(0x8000), 'C:\\Игры\\japan.gg').error).toMatch(/Game Gear в Arcade не поддерживается/)
  expect(identifyRom(new Uint8Array(0x8000), 'C:\\Игры\\japan.sms')).toEqual({ console: 'sms' }) // без метки — по расширению
  expect(identifyRom(new Uint8Array(0x8000), 'x.bin').error).toMatch(/или Master System \(\.sms\)$/)
  const site = JSON.parse(siteCatalog())
  site.consoles.push({ id: 'sms', title: 'Master System' })
  const sha = 'f'.repeat(64)
  site.games.skyhaul = { console: 'sms', title: 'SkyHaul', genre: 'шутер', about: 'шутер', keys: '…', rom: { url: `files/${sha}.sms`, base64: `files/${sha}.sms.b64`, sha256: sha, size: 1 } }
  const { clock, launches } = stubs(on, { env: { ...WINDOWS, USERPROFILE: 'C:\\Users\\Иван' }, site: JSON.stringify(site), disk: { 'D:\\Игры\\Моя.sms': tmrRom(4) } })
  await start($)
  await clock.advance(300)
  await $.command.run({ command: 'arcade-add', args: 'D:\\Игры\\Моя.sms' })
  const ui = await $.ui.mount({ ...PANE, surface: 'vscode' })
  expect(await ui.find({ type: 'Text', text: 'Добавлено: Моя (Master System).' })).toBeDefined()
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-sms' })
  await ui.press({ key: 'arcade-game-skyhaul' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?game=skyhaul`)
  await ui.press({ key: 'arcade-back' })
  await ui.unmount()
})

// Маппер 28 (Action 53): эталон NESdev — [режим $80, внешний $81, внутренний $01, банк на $8000, банк на $C000]
const A53_CASES = [[0, 0, 0, 0, 1], [0, 0, 1, 0, 1], [0, 0, 5, 0, 1], [0, 0, 15, 0, 1], [0, 3, 0, 6, 7], [0, 3, 1, 6, 7], [0, 3, 5, 6, 7], [0, 3, 15, 6, 7], [0, 42, 0, 84, 85], [0, 42, 1, 84, 85], [0, 42, 5, 84, 85], [0, 42, 15, 84, 85], [8, 0, 0, 0, 0], [8, 0, 1, 0, 1], [8, 0, 5, 0, 1], [8, 0, 15, 0, 1], [8, 3, 0, 6, 6], [8, 3, 1, 6, 7], [8, 3, 5, 6, 7], [8, 3, 15, 6, 7], [8, 42, 0, 84, 84], [8, 42, 1, 84, 85], [8, 42, 5, 84, 85], [8, 42, 15, 84, 85], [12, 0, 0, 0, 1], [12, 0, 1, 1, 1], [12, 0, 5, 1, 1], [12, 0, 15, 1, 1], [12, 3, 0, 6, 7], [12, 3, 1, 7, 7], [12, 3, 5, 7, 7], [12, 3, 15, 7, 7], [12, 42, 0, 84, 85], [12, 42, 1, 85, 85], [12, 42, 5, 85, 85], [12, 42, 15, 85, 85], [16, 0, 0, 0, 1], [16, 0, 1, 2, 3], [16, 0, 5, 2, 3], [16, 0, 15, 2, 3], [16, 3, 0, 4, 5], [16, 3, 1, 6, 7], [16, 3, 5, 6, 7], [16, 3, 15, 6, 7], [16, 42, 0, 84, 85], [16, 42, 1, 86, 87], [16, 42, 5, 86, 87], [16, 42, 15, 86, 87], [24, 0, 0, 0, 0], [24, 0, 1, 0, 1], [24, 0, 5, 0, 1], [24, 0, 15, 0, 3], [24, 3, 0, 6, 4], [24, 3, 1, 6, 5], [24, 3, 5, 6, 5], [24, 3, 15, 6, 7], [24, 42, 0, 84, 84], [24, 42, 1, 84, 85], [24, 42, 5, 84, 85], [24, 42, 15, 84, 87], [28, 0, 0, 0, 1], [28, 0, 1, 1, 1], [28, 0, 5, 1, 1], [28, 0, 15, 3, 1], [28, 3, 0, 4, 7], [28, 3, 1, 5, 7], [28, 3, 5, 5, 7], [28, 3, 15, 7, 7], [28, 42, 0, 84, 85], [28, 42, 1, 85, 85], [28, 42, 5, 85, 85], [28, 42, 15, 87, 85], [32, 0, 0, 0, 1], [32, 0, 1, 2, 3], [32, 0, 5, 2, 3], [32, 0, 15, 6, 7], [32, 3, 0, 0, 1], [32, 3, 1, 2, 3], [32, 3, 5, 2, 3], [32, 3, 15, 6, 7], [32, 42, 0, 80, 81], [32, 42, 1, 82, 83], [32, 42, 5, 82, 83], [32, 42, 15, 86, 87], [40, 0, 0, 0, 0], [40, 0, 1, 0, 1], [40, 0, 5, 0, 5], [40, 0, 15, 0, 7], [40, 3, 0, 6, 0], [40, 3, 1, 6, 1], [40, 3, 5, 6, 5], [40, 3, 15, 6, 7], [40, 42, 0, 84, 80], [40, 42, 1, 84, 81], [40, 42, 5, 84, 85], [40, 42, 15, 84, 87], [44, 0, 0, 0, 1], [44, 0, 1, 1, 1], [44, 0, 5, 5, 1], [44, 0, 15, 7, 1], [44, 3, 0, 0, 7], [44, 3, 1, 1, 7], [44, 3, 5, 5, 7], [44, 3, 15, 7, 7], [44, 42, 0, 80, 85], [44, 42, 1, 81, 85], [44, 42, 5, 85, 85], [44, 42, 15, 87, 85], [48, 0, 0, 0, 1], [48, 0, 1, 2, 3], [48, 0, 5, 10, 11], [48, 0, 15, 14, 15], [48, 3, 0, 0, 1], [48, 3, 1, 2, 3], [48, 3, 5, 10, 11], [48, 3, 15, 14, 15], [48, 42, 0, 80, 81], [48, 42, 1, 82, 83], [48, 42, 5, 90, 91], [48, 42, 15, 94, 95], [56, 0, 0, 0, 0], [56, 0, 1, 0, 1], [56, 0, 5, 0, 5], [56, 0, 15, 0, 15], [56, 3, 0, 6, 0], [56, 3, 1, 6, 1], [56, 3, 5, 6, 5], [56, 3, 15, 6, 15], [56, 42, 0, 84, 80], [56, 42, 1, 84, 81], [56, 42, 5, 84, 85], [56, 42, 15, 84, 95], [60, 0, 0, 0, 1], [60, 0, 1, 1, 1], [60, 0, 5, 5, 1], [60, 0, 15, 15, 1], [60, 3, 0, 0, 7], [60, 3, 1, 1, 7], [60, 3, 5, 5, 7], [60, 3, 15, 15, 7], [60, 42, 0, 80, 85], [60, 42, 1, 81, 85], [60, 42, 5, 85, 85], [60, 42, 15, 95, 85]]

test('маппер 28: формула банков совпадает с эталоном NESdev во всех 144 случаях', async () => {
  for (const [mode, outer, inner, lo, hi] of A53_CASES) {
    expect([prgBank(0, mode, outer, inner), prgBank(1, mode, outer, inner)]).toEqual([lo, hi])
  }
})

test('маппер 28 в JSNES: банки ПЗУ, 32 КБ CHR RAM и отражения', async () => {
  installMapper28(Mappers)
  // Синтетический картридж: 512 КБ ПЗУ (32 банка по 16 КБ), CHR RAM, маппер 28; в начале каждого банка — его номер
  const banks = 32
  const rom = new Uint8Array(16 + banks * 16384)
  rom.set([0x4e, 0x45, 0x53, 0x1a, banks, 0, (28 & 0x0f) << 4, 28 & 0xf0], 0)
  for (let b = 0; b < banks; b++) rom[16 + b * 16384] = b
  const nes = new NES({ onFrame() {}, emulateSound: false })
  nes.loadROM(Array.from(rom, (x) => String.fromCharCode(x)).join(''))
  const mem = nes.cpu.mem
  expect(mem[0xc000]).toBe(31) // при включении на $C000 — последний банк
  const reg = (select: number, value: number) => {
    nes.mmap.write(0x5000, select)
    nes.mmap.write(0x8000, value)
  }
  // Режимы и банки — ровно как в эталоне
  for (const [mode, outer, inner, lo, hi] of A53_CASES.filter((c) => c[1] !== 0x2a)) {
    reg(0x80, mode)
    reg(0x81, outer)
    reg(0x01, inner)
    expect([mem[0x8000], mem[0xc000]]).toEqual([lo % banks, hi % banks])
  }
  // CHR RAM: четыре банка по 8 КБ, содержимое сохраняется при переключении
  reg(0x80, 0x02) // вертикальное отражение, чтобы не мешало
  const ppu = nes.ppu
  ppu.vramMem[0] = 0xaa
  ppu.vramMem[8191] = 0x55
  reg(0x00, 1)
  expect([ppu.vramMem[0], ppu.vramMem[8191]]).toEqual([0, 0]) // банк 1 пустой
  ppu.vramMem[0] = 0x11
  reg(0x00, 0)
  expect([ppu.vramMem[0], ppu.vramMem[8191]]).toEqual([0xaa, 0x55]) // банк 0 вернулся
  reg(0x00, 1)
  expect(ppu.vramMem[0]).toBe(0x11)
  // Отражения: вертикальное, горизонтальное и одноэкранное — бит 4 записи в $00 выбирает экран
  expect(ppu.currentMirroring).toBe(nes.rom.VERTICAL_MIRRORING)
  reg(0x80, 0x03)
  expect(ppu.currentMirroring).toBe(nes.rom.HORIZONTAL_MIRRORING)
  reg(0x80, 0x00)
  expect(ppu.currentMirroring).toBe(nes.rom.SINGLESCREEN_MIRRORING)
  reg(0x00, 0x10)
  expect(ppu.currentMirroring).toBe(nes.rom.SINGLESCREEN_MIRRORING2)
  // «Свои игры» принимают маппер 28
  expect(identifyRom(rom)).toEqual({ console: 'nes', mapper: 28 })
})

// Все строки дерева интерфейса — чтобы проверить, что перевод ничего не пропустил
async function drawnTexts(ui: any) {
  const texts: string[] = []
  const walk = (n: any) => {
    if (n == null) return
    if (typeof n === 'string') return texts.push(n)
    if (n.props?.label) texts.push(n.props.label)
    if (n.props?.placeholder) texts.push(n.props.placeholder)
    for (const c of n.children ?? []) walk(c)
  }
  walk(await ui.drawn())
  return texts
}

test('язык: по окружению, правила с подстановками', async () => {
  // Свой язык, если он есть среди 13; C/POSIX и неизвестный — английский; без подсказок — английский
  expect([detectLang('ru_RU.UTF-8'), detectLang('uk_UA'), detectLang('en_US.UTF-8'), detectLang(undefined, 'de_DE'), detectLang(), detectLang('C.UTF-8', 'zh_CN'), detectLang('sw_KE')]).toEqual(['ru', 'uk', 'en', 'de', 'en', 'zh', 'en'])
  expect(tr('Агент работает 2 мин 14 с — сыграть?', 'en')).toBe('Agent has been working for 2 min 14 s — play?')
  expect(tr('  3 игры', 'en')).toBe('  3 games')
  expect(tr('Добавлено: Моя (Денди).', 'en')).toBe('Added: Моя (NES).')
  expect(tr('Когда агент закончил: пауза и плашка', 'en')).toBe('When the agent finishes: pause and banner')
  expect(tr('Настройки', 'ru')).toBe('Настройки')
  // Группы и полки каталога приходят с сайта по-русски — и в кнопках, и в заголовке, и внутри фраз
  expect(['Книги', 'Игры', 'Шутеры', 'Arcade · Книги', 'Открыть Шутеры в окне'].map((s) => tr(s, 'en'))).toEqual(['Books', 'Games', 'Shooters', 'Arcade · Books', 'Open Shooters in a window'])
  expect(tr('Arcade · Книги', 'de')).toBe('Arcade · Bücher')
})

test('английский интерфейс: главное меню без русских букв, вопрос над вводом, переключатель, окно на том же языке', async ($, on) => {
  const { clock, launches, saved } = stubs(on, { env: { ...WINDOWS, LANG: 'en_US.UTF-8' } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(300)
  await $.turn.start({ turnId: 't1' })
  await clock.advance(134_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: 'Agent has been working for 2 min 14 s — play?' })).toBeDefined()
  expect(await band.find({ key: 'arcade-play' })).toMatchObject({ props: { label: 'Here' } })
  expect(await band.find({ key: 'arcade-later' })).toMatchObject({ props: { label: 'Not now' } })
  await band.unmount()
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // Единственное исключение — кнопка «🌐 Русский»: название языка пишется на нём самом
  const cyrillic = (await drawnTexts(ui)).filter((x) => /[А-Яа-яЁё]/.test(x) && x !== '🌐 Русский')
  expect(cyrillic).toEqual([])
  expect(await ui.find({ key: 'arcade-menu-settings' })).toMatchObject({ props: { label: 'Settings' } })
  expect(await ui.find({ key: 'arcade-lang-main' })).toMatchObject({ props: { label: '🌐 English' } })
  // Игра в окне — адрес с языком
  await go(ui, 'arcade-game-thwaite')
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?game=thwaite&lang=en`)
  // Выбор языка в настройках: обратно на русский и запоминается
  await go(ui, 'arcade-lang')
  await ui.press({ key: 'arcade-lang-ru' })
  expect(await ui.find({ key: 'arcade-lang' })).toMatchObject({ props: { label: 'Язык: Русский' } })
  expect(saved.get('lang')).toBe('ru')
  expect(await ui.find({ key: 'arcade-back' })).toMatchObject({ props: { label: '← Назад' } })
  await ui.unmount()
})

test('английские описания игр в меню мода: жанр и описание по-английски, и в запасном каталоге тоже', async ($, on) => {
  const site = JSON.parse(siteCatalog())
  site.games.thwaite.about_en = 'Missiles are falling on the town — shoot them down with fireworks while the houses still stand.'
  const { clock } = stubs(on, { env: { LANG: 'en_US.UTF-8' }, site: JSON.stringify(site) })
  await start($)
  await clock.advance(300)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-nes' })
  expect(await ui.find({ type: 'Text', text: '  arcade — Missiles are falling on the town — shoot them down with fireworks while the houses still stand.' })).toBeDefined()
  await ui.unmount()
  // Запасной каталог мода — тоже с английскими описаниями
  expect(bundledCatalog().games.every((g: any) => typeof g.about_en === 'string' && !/[А-Яа-яЁё]/.test(g.about_en))).toBe(true)
})

test('сообщение «… открыт в Google Chrome» само уходит через 15 секунд: закрытие окна мод увидеть не может', async ($, on) => {
  const { clock, launches } = stubs(on, { env: WINDOWS })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(ui, 'arcade-game-thwaite')
  expect(launches.length).toBe(1)
  expect(await ui.find({ type: 'Text', text: /открыт в .+\. Игра стоит на паузе, пока окно не в фокусе\./ })).toBeDefined()
  await clock.advance(14_000)
  expect(await ui.find({ type: 'Text', text: /открыт в / })).toBeDefined() // ещё видно
  await clock.advance(2_000)
  expect(await ui.find({ type: 'Text', text: /открыт в / })).toBeUndefined() // ушло само
  await ui.unmount()
})

test('Doom: мод узнаёт WAD и подсказывает добавить его в окне', async () => {
  const wad = new TextEncoder().encode('IWAD' + '\0'.repeat(64))
  expect(identifyRom(wad).error).toBe('это файл Doom (WAD). Их добавляют в окне Arcade: «Игры» → «Шутеры» → «Открыть свой файл»')
  expect(identifyRom(new TextEncoder().encode('PWAD' + '\0'.repeat(64))).error).toMatch(/^это файл Doom/)
  expect(tr('Не получилось добавить: это файл Doom (WAD). Их добавляют в окне Arcade: «Игры» → «Шутеры» → «Открыть свой файл»', 'en')).toMatch(/^Could not add it: this is a Doom file \(WAD\)/)
})

test('кто ждёт в сети: мод спрашивает сайт, пишет об этом в вопросе и даёт «Присоединиться»', async ($, on) => {
  const site = JSON.parse(siteCatalog())
  site.consoles.push({ id: 'doom', title: 'Doom' })
  const sha = 'a'.repeat(64)
  site.games.freedm = { console: 'doom', net: 'doom', title: 'FreeDM', genre: 'шутер', about: 'сеть', keys: '…', rom: { url: `files/${sha}.wad`, base64: `files/${sha}.wad.b64`, sha256: sha, size: 1 } }
  const { clock, launches } = stubs(on, { env: WINDOWS, site: JSON.stringify(site), files: { 'api/lobbies': JSON.stringify({ doom: 2, games: {} }) } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(2_500)
  await $.turn.start({ turnId: 't1' })
  await clock.advance(11_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /— сыграть\? В сети ждут: FreeDM \(2\)$/ })).toBeDefined()
  await band.unmount()
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-net-join' })).toMatchObject({ props: { label: 'Присоединиться: FreeDM' } })
  expect(await ui.find({ type: 'Text', text: '  в сети ждут: FreeDM (2)' })).toBeDefined()
  await ui.press({ key: 'arcade-net-join' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?game=freedm`)
  await ui.unmount()
})

test('кто ждёт в сети и Денди: игры Денди тоже в сводке, «Присоединиться» открывает сетевой режим ?net=1', async ($, on) => {
  const site = JSON.parse(siteCatalog())
  const thwaite = site.games.thwaite
  const netId = parseInt(thwaite.rom.sha256.slice(0, 7), 16)
  const { clock, launches } = stubs(on, { env: WINDOWS, site: JSON.stringify(site), files: { 'api/lobbies': JSON.stringify({ doom: 0, games: { [netId]: 1 } }) } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(2_500)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-net-join' })).toMatchObject({ props: { label: `Присоединиться: ${thwaite.title}` } })
  await ui.press({ key: 'arcade-net-join' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?game=thwaite&net=1`)
  await ui.unmount()
})

test('кто ждёт в сети и кооператив Freedoom: «Присоединиться» открывает лобби кооператива ?net=coop', async ($, on) => {
  const site = JSON.parse(siteCatalog())
  site.consoles.push({ id: 'doom', title: 'Doom' })
  const sha = 'b'.repeat(64)
  site.games['freedoom-1'] = { console: 'doom', title: 'Freedoom: Phase 1', genre: 'шутер', about: 'кооп', keys: '…', rom: { url: `files/${sha}.zip`, base64: `files/${sha}.zip.b64`, sha256: sha, size: 1 } }
  const { clock, launches } = stubs(on, { env: WINDOWS, site: JSON.stringify(site), files: { 'api/lobbies': JSON.stringify({ doom: 0, games: {}, coop: { 'freedoom-1': 1 } }) } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(2_500)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-net-join' })).toMatchObject({ props: { label: 'Присоединиться: Freedoom: Phase 1' } })
  await ui.press({ key: 'arcade-net-join' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?game=freedoom-1&net=coop`)
  await ui.unmount()
})

test('настольные игры: мод знает их без ROM, открывает в окне, «кто ждёт» ведёт в шахматы', async ($, on) => {
  const site = JSON.parse(siteCatalog())
  site.consoles.push({ id: 'board', title: 'Настольные' })
  site.games.chess = { console: 'board', kind: 'board', board: 'chess', title: 'Шахматы', genre: 'стратегия', about: 'по сети', keys: '…' }
  expect(parseCatalog(JSON.stringify(site)).games.find((g: any) => g.id === 'chess')).toMatchObject({ console: 'board', kind: 'board', title: 'Шахматы' })
  const withWeb = { ...site, consoles: [...site.consoles, { id: 'web', title: 'Браузерные' }], games: { ...site.games, hexgl: { console: 'web', kind: 'web', page: 'web-games/hexgl/index.html', title: 'HexGL', genre: 'гонки', about: 'гонки', keys: '…' } } }
  expect(parseCatalog(JSON.stringify(withWeb)).games.find((g: any) => g.id === 'hexgl')).toMatchObject({ console: 'web', kind: 'web', title: 'HexGL' })
  const { clock, launches } = stubs(on, { env: WINDOWS, site: JSON.stringify(site), files: { 'api/lobbies': JSON.stringify({ doom: 0, games: {}, board: { chess: 1 } }) } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(2_500)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-net-join' })).toMatchObject({ props: { label: 'Присоединиться: Шахматы' } })
  await ui.press({ key: 'arcade-net-join' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?game=chess`)
  await ui.press({ key: 'arcade-menu-board' })
  await ui.press({ key: 'arcade-game-chess' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?game=chess`)
  await ui.unmount()
})

test('кто ждёт в сети и Blasphemer: BlasphDM ведёт в своё лобби, Blasphemer — в кооператив', async ($, on) => {
  const site = JSON.parse(siteCatalog())
  site.consoles.push({ id: 'doom', title: 'Doom' })
  const sha = (c: string) => c.repeat(64)
  site.games.blasphemer = { console: 'doom', engine: 'heretic', net: 'heretic', title: 'Blasphemer', genre: 'шутер', about: 'фэнтези', keys: '…', rom: { url: `files/${sha('c')}.wad`, base64: `files/${sha('c')}.wad.b64`, sha256: sha('c'), size: 1 } }
  site.games.blasphdm = { console: 'doom', engine: 'heretic', net: 'heretic-dm', title: 'BlasphDM', genre: 'шутер', about: 'дезматч', keys: '…', rom: { url: `files/${sha('d')}.wad`, base64: `files/${sha('d')}.wad.b64`, sha256: sha('d'), size: 1 } }
  const { clock, launches } = stubs(on, { env: WINDOWS, site: JSON.stringify(site), files: { 'api/lobbies': JSON.stringify({ doom: 0, games: {}, coop: { blasphemer: 1 }, dm: { blasphdm: 2 } }) } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(2_500)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-net-join' })).toMatchObject({ props: { label: 'Присоединиться: BlasphDM' } })
  expect(await ui.find({ type: 'Text', text: '  в сети ждут: BlasphDM (2), Blasphemer (1)' })).toBeDefined()
  await ui.press({ key: 'arcade-net-join' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?game=blasphdm`)
  await ui.unmount()
})

test('вкладка «Игры»: в главном меню одна группа, внутри — полки, в полке — её игры; «Назад» — к полкам', async ($, on) => {
  const site = JSON.parse(siteCatalog())
  site.consoles.push({ id: 'doom', title: 'Шутеры', group: 'games' }, { id: 'web', title: 'Браузерные', group: 'games' })
  site.groups = [{ id: 'games', title: 'Игры' }]
  site.shelves = [{ id: 'shooters', title: 'Шутеры' }, { id: 'racing', title: 'Гонки' }, { id: 'strategy', title: 'Стратегии' }]
  const sha = 'e'.repeat(64)
  site.games.freedm = { console: 'doom', net: 'doom', shelf: 'shooters', title: 'FreeDM', genre: 'шутер', about: 'сеть', keys: '…', rom: { url: `files/${sha}.wad`, base64: `files/${sha}.wad.b64`, sha256: sha, size: 1 } }
  site.games.hexgl = { console: 'web', kind: 'web', shelf: 'racing', page: 'web-games/hexgl/', title: 'HexGL', genre: 'гонки', about: 'гонки', keys: '…' }
  const parsed = parseCatalog(JSON.stringify(site))
  expect(parsed.groups).toEqual([{ id: 'games', title: 'Игры' }])
  expect(parsed.games.find((g: any) => g.id === 'hexgl').shelf).toBe('racing')
  const { clock, launches } = stubs(on, { env: WINDOWS, site: JSON.stringify(site) })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(2_500)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-menu-games' })).toMatchObject({ props: { label: 'Игры' } })
  expect(await ui.find({ type: 'Text', text: '  2 игры' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-menu-doom' })).toBeUndefined()
  await ui.press({ key: 'arcade-menu-games' })
  expect(await ui.find({ key: 'arcade-menu-shelf-shooters' })).toMatchObject({ props: { label: 'Шутеры' } })
  expect(await ui.find({ key: 'arcade-menu-shelf-racing' })).toMatchObject({ props: { label: 'Гонки' } })
  expect(await ui.find({ key: 'arcade-menu-shelf-strategy' })).toBeUndefined() // пустые полки не показываем
  await ui.press({ key: 'arcade-menu-shelf-racing' })
  expect(await ui.find({ key: 'arcade-game-hexgl' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-freedm' })).toBeUndefined()
  await ui.press({ key: 'arcade-open-tab-shelf-racing' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?tab=games&shelf=racing`)
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-menu-shelf-racing' })).toBeDefined() // вернулись к полкам
  await ui.unmount()
})

test('«Поддержать проект»: внизу главного меню, ссылка из каталога сайта открывается в обычном браузере', async ($, on) => {
  const site = JSON.parse(siteCatalog())
  site.support = { url: 'https://ko-fi.com/agentarcade', title: 'Ko-fi' }
  expect(parseCatalog(JSON.stringify(site)).support).toEqual({ url: 'https://ko-fi.com/agentarcade' })
  expect(parseCatalog(JSON.stringify({ ...site, support: { url: 'javascript:alert(1)' } })).support).toBeUndefined()
  const { clock, launches } = stubs(on, { env: WINDOWS, site: JSON.stringify(site) })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(2_500)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-support' })).toMatchObject({ props: { label: '☕ Поддержать проект' } })
  expect(await ui.find({ type: 'Text', text: '  добровольно, на развитие Arcade — ko-fi.com/agentarcade' })).toBeDefined()
  await ui.press({ key: 'arcade-support' })
  expect(launches.at(-1).env.ARCADE_URL).toBe('https://ko-fi.com/agentarcade')
  expect(launches.at(-1).argv[0]).toBe('powershell.exe')
  await ui.unmount()
})

test('язык прямо в главном меню: список из 13 языков, каждый на самом себе; выбор запоминается, «Назад» — обратно', async ($, on) => {
  const { clock, saved } = stubs(on, { env: { ...WINDOWS, LANG: 'ru_RU.UTF-8' } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(300)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-lang-main' })).toMatchObject({ props: { label: '🌐 Русский' } })
  await ui.press({ key: 'arcade-lang-main' })
  for (const [code, name] of [['en', 'English'], ['uk', 'Українська'], ['es', 'Español'], ['ja', '日本語'], ['zh', '中文'], ['ko', '한국어']]) {
    expect(await ui.find({ key: `arcade-lang-${code}` })).toMatchObject({ props: { label: name } })
  }
  expect(await ui.find({ key: 'arcade-lang-ru' })).toMatchObject({ props: { label: 'Русский ✓', autoFocus: true } })
  await ui.press({ key: 'arcade-lang-en' })
  expect(await ui.find({ key: 'arcade-menu-settings' })).toMatchObject({ props: { label: 'Settings' } })
  expect(await ui.find({ key: 'arcade-lang-main' })).toMatchObject({ props: { label: '🌐 English' } })
  expect(saved.get('lang')).toBe('en')
  // Испанский без перевода — пока по-английски, но выбран и запомнен
  await ui.press({ key: 'arcade-lang-main' })
  await ui.press({ key: 'arcade-lang-es' })
  expect(saved.get('lang')).toBe('es')
  expect(await ui.find({ key: 'arcade-lang-main' })).toMatchObject({ props: { label: '🌐 Español' } })
  // Из настроек — туда же, «Назад» возвращает в настройки
  await ui.press({ key: 'arcade-menu-settings' })
  await ui.press({ key: 'arcade-lang' })
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-lang' })).toBeDefined()
  await ui.unmount()
})

test('книги: мод знает книги каталога, «Книги» — после «Игр», книга открывается в окне', async ($, on) => {
  const site = JSON.parse(siteCatalog())
  site.consoles.push({ id: 'doom', title: 'Шутеры', group: 'games' }, { id: 'books', title: 'Книги' })
  site.groups = [{ id: 'games', title: 'Игры' }]
  site.shelves = [{ id: 'shooters', title: 'Шутеры' }]
  const sha = 'f'.repeat(64)
  site.games.freedm = { console: 'doom', net: 'doom', shelf: 'shooters', title: 'FreeDM', genre: 'шутер', about: 'сеть', keys: '…', rom: { url: `files/${sha}.wad`, base64: `files/${sha}.wad.b64`, sha256: sha, size: 1 } }
  site.games.mumu = { console: 'books', kind: 'book', text: 'books/mumu/book.json', title: 'Муму', author: 'Иван Тургенев', genre: 'рассказ', about: 'Герасим и его собака.', keys: '…' }
  site.games.bad = { console: 'books', kind: 'book', text: '../secret.json', title: 'Плохая', author: 'x', genre: 'x', about: 'x', keys: '…' }
  site.games.kobzar = { console: 'books', kind: 'book', text: 'books/kobzar/book.json', title: 'Кобзар', author: 'Тарас Шевченко', genre: 'поэзия', about: '', keys: '…' }
  const parsed = parseCatalog(JSON.stringify(site))
  expect(parsed.games.find((g: any) => g.id === 'mumu')).toMatchObject({ kind: 'book', author: 'Иван Тургенев', text: 'books/mumu/book.json' })
  expect(parsed.games.find((g: any) => g.id === 'bad')).toBeUndefined() // путь к тексту — только books/<id>/book.json
  const { clock, launches } = stubs(on, { env: WINDOWS, site: JSON.stringify(site) })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(2_500)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const labels = (await drawnTexts(ui)).filter((x) => ['Денди', 'Игры', 'Книги'].includes(x))
  expect(labels).toEqual(['Денди', 'Игры', 'Книги'])
  await ui.press({ key: 'arcade-menu-books' })
  expect(await ui.find({ type: 'Text', text: '  Иван Тургенев · рассказ — Герасим и его собака.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  Тарас Шевченко · поэзия' })).toBeDefined() // без описания — без висящего тире
  await ui.press({ key: 'arcade-game-mumu' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?game=mumu`)
  await ui.unmount()
})

test('другие языки — поверх английского: точная фраза, шаблон с подстановкой внутри, форма числа, откат на английский', async () => {
  const saved = LOCALES.de
  LOCALES.de = {
    exact: { Settings: 'Einstellungen' },
    templates: { 'Agent has been working for {0} — play?': 'Der Agent arbeitet seit {0} — spielen?', '{0} s': '{0} Sek.', '{0} games': '{0#one=# Spiel;other=# Spiele}', '{0} game': '{0#one=# Spiel;other=# Spiele}' },
    words: [],
  }
  resetLocaleCache()
  try {
    expect(tr('Настройки', 'de')).toBe('Einstellungen')
    expect(tr('Агент работает 11 с — сыграть?', 'de')).toBe('Der Agent arbeitet seit 11 Sek. — spielen?')
    expect(tr('28 игр', 'de')).toBe('28 Spiele')
    expect(tr('1 игра', 'de')).toBe('1 Spiel')
    expect(fromEnglish('Something new', 'de')).toBe('Something new') // нет в переводе — по-английски
    expect(tr('Настройки', 'ru')).toBe('Настройки')
  } finally {
    LOCALES.de = saved
    resetLocaleCache()
  }
})

test('книги по языкам и жанрам: «Книги» → полка-язык → книги под разделителями жанров', async ($, on) => {
  const site = JSON.parse(siteCatalog())
  site.consoles.push({ id: 'books', title: 'Книги', group: 'reading' })
  site.groups = [{ id: 'reading', title: 'Книги' }]
  site.shelves = [{ id: 'books-en', title: 'English' }, { id: 'books-uk', title: 'Українська' }]
  const book = (id, title, genre, lang) => ({ console: 'books', kind: 'book', shelf: `books-${lang}`, text: `books/${id}/book.json`, title, author: 'Автор', genre, about: '', keys: '…' })
  site.games.emma = book('emma', 'Emma', 'роман', 'en')
  site.games.dracula = book('dracula', 'Dracula', 'ужасы', 'en')
  site.games.jane = book('jane', 'Jane Eyre', 'роман', 'en')
  site.games.khmary = book('khmary', 'Хмари', 'роман', 'uk')
  const { clock } = stubs(on, { env: WINDOWS, site: JSON.stringify(site) })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(2_500)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '  4 книги' })).toBeDefined() // у книг — «книги», а не «игры»
  expect(await ui.find({ type: 'Text', text: '  язык интерфейса — 13 на выбор' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  4 книги' })).toBeDefined() // у книг — «книги», а не «игры»
  expect(await ui.find({ type: 'Text', text: '  язык интерфейса — 13 на выбор' })).toBeDefined()
  expect(tr('136 книг', 'en')).toBe('136 books')
  await ui.press({ key: 'arcade-menu-reading' })
  expect(await ui.find({ key: 'arcade-menu-shelf-books-en' })).toMatchObject({ props: { label: 'English' } })
  expect(await ui.find({ key: 'arcade-menu-shelf-books-uk' })).toMatchObject({ props: { label: 'Українська' } })
  expect(await ui.find({ type: 'Text', text: '  3 книги' })).toBeDefined() // у полки языка — «книги», а не «игры»
  await ui.press({ key: 'arcade-menu-shelf-books-en' })
  // на полке — плитки жанров с числом книг, жанр с заглавной буквы
  expect(await ui.find({ key: 'arcade-genre-0' })).toMatchObject({ props: { label: 'Роман' } })
  expect(await ui.find({ key: 'arcade-genre-1' })).toMatchObject({ props: { label: 'Ужасы' } })
  expect(await ui.find({ type: 'Text', text: '  2 книги' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-emma' })).toBeUndefined() // книги — уже внутри жанра
  await ui.press({ key: 'arcade-genre-0' })
  expect(await ui.find({ key: 'arcade-game-emma' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-jane' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-dracula' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-game-khmary' })).toBeUndefined()
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-genre-1' })).toBeDefined() // «Назад» — к жанрам
  await ui.unmount()
})

test('дизайн главного меню: разделы «Играть» и «Ещё», плитки в рамках — кнопка с подписью вместе, значок агента цветом', async ($, on) => {
  const { clock } = stubs(on, { env: WINDOWS })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(300)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Играть' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Ещё' })).toBeDefined()
  const tile = await ui.find({ type: 'Box', props: { borderStyle: 'round' } })
  expect(tile).toBeDefined()
  // в первой плитке — кнопка Денди и её подпись
  const inside = JSON.stringify(tile)
  expect(inside).toContain('arcade-menu-nes')
  expect(inside).toMatch(/игр/)
  expect(await ui.find({ type: 'Text', text: '●' })).toBeDefined()
  await ui.unmount()
})

