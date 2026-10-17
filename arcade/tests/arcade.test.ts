import { expect, mock, test } from 'claude-code/testing'
import { encodePowerShell, gameUrl, launchCommand, parseDetection, windowBounds } from '../hooks/browsers.js'

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
const WINDOWS = { OS: 'Windows_NT', LOCALAPPDATA: 'C:\\Users\\max\\AppData\\Local' }

function stubs(on: any, { images = true, env = {}, detect = 'ok', launchExit = 0 }: any = {}) {
  const saved = new Map<string, unknown>()
  const opened: string[] = []
  const blits: any[] = []
  const launches: any[] = []
  const toasts: string[] = []
  const clock = mock.clock(on)
  mock.env(on, env)
  on('process.run', ($: any, e: any) => {
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
  on('command.register', () => ({ value: undefined }))
  on('ui.toast', ($: any, e: any) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', ($: any, e: any) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
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
  // Что Claude Code нарисовал бы сам, когда мод отдаёт отрисовку дальше
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
  return { saved, opened, blits, clock, launches, toasts }
}

async function start($: any) {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'arcade', args: '' })
}

// Где в меню живёт кнопка: игры Денди — в «Денди», проверка клавиш и выбор окна и графики — в «Настройках»
const MENU_OF: Record<string, string> = {
  'arcade-game-thwaite': 'nes',
  'arcade-game-croom': 'nes',
  'arcade-game-rfk': 'nes',
  'arcade-game-field': 'settings',
  'arcade-opener': 'settings',
  'arcade-graphics': 'settings',
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
  expect(await ui.find({ type: 'Text', text: /Скоро: эмулятор Mega Drive/ })).toBeDefined()

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

test('Thwaite в терминале с картинками: настоящие пиксели, PNG 30 раз в секунду', async ($, on) => {
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

test('Thwaite в терминале без картинок: через полсекунды сам переходит на символы', async ($, on) => {
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

test('в Desktop игры не запускаются', async ($, on) => {
  const { blits, clock } = stubs(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await go(ui, 'arcade-game-thwaite')
  expect(await ui.find({ type: 'Text', text: 'Игры пока работают только в терминале.' })).toBeDefined()
  await clock.advance(1000)
  expect(blits.length).toBe(0)
  await ui.press({ key: 'arcade-library' })
  expect(await ui.find({ key: 'arcade-game-thwaite' })).toBeDefined() // снова список игр Денди
  await ui.unmount()
})

test('через 20 секунд работы агента появляется вопрос, «Играть» открывает панель', async ($, on) => {
  const { opened, clock } = stubs(on)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.turn.start({ turnId: 't1' })
  await clock.advance(21_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /сыграть\?/ })).toBeDefined()
  await band.press({ key: 'arcade-play' })
  expect(opened).toEqual(['arcade'])
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
  expect(env.ARCADE_URL).toMatch(/^file:\/\/.*\/web\/index\.html\?game=thwaite$/)
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

test('Windows: «Играть» в вопросе открывает окно, а не панель', async ($, on) => {
  const { clock, launches, opened, toasts } = stubs(on, { env: WINDOWS })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.turn.start({ turnId: 't1' })
  await clock.advance(21_000)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await band.press({ key: 'arcade-play' })
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

  expect(gameUrl('C:\\Users\\Иван Петров\\mods\\arcade\\', 'thwaite')).toBe(
    'file:///C:/Users/%D0%98%D0%B2%D0%B0%D0%BD%20%D0%9F%D0%B5%D1%82%D1%80%D0%BE%D0%B2/mods/arcade/web/index.html?game=thwaite',
  )
  expect(gameUrl('/home/max/arcade', 'thwaite')).toBe('file:///home/max/arcade/web/index.html?game=thwaite')

  const encoded = encodePowerShell('Write-Output "Привет"')
  const bytes = Uint8Array.fromBase64(encoded)
  expect(String.fromCharCode(...Array.from({ length: bytes.length / 2 }, (_, i) => bytes[i * 2] | (bytes[i * 2 + 1] << 8)))).toBe('Write-Output "Привет"')

  const plain = launchCommand({ kind: 'browser', browser: { id: 'edge', path: 'C:\\e.exe', app: true } }, 'file:///x', null, '')
  expect(plain.env.ARCADE_ARGS).toBe('--app="file:///x" --no-first-run --no-default-browser-check')
  expect(launchCommand({ kind: 'default' }, 'file:///x', null, '').env).toEqual({ ARCADE_URL: 'file:///x' })
})

test('Concentration Room и robotfindskitten идут в панели, у каждой своя игра в эмуляторе', async ($, on) => {
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
  expect(launches[0].env.ARCADE_URL).toMatch(/\/web\/index\.html$/)
  expect(await ui.find({ type: 'Text', text: 'Arcade открыт в Google Chrome: выбирай приставку и игру.' })).toBeDefined()
  await go(ui, 'arcade-game-croom')
  expect(launches[1].env.ARCADE_URL).toMatch(/\?game=croom$/)
  await go(ui, 'arcade-game-rfk')
  expect(launches[2].env.ARCADE_URL).toMatch(/\?game=rfk$/)
  await ui.unmount()
})
