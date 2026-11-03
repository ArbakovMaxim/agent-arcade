// Общие помощники тестов Arcade: заглушки движка (stubs), панель и полоса, меню (go, tap) и обход дерева интерфейса.
// Тесты разнесены по двум файлам: у claude plugin test на файл — 600 с
import { mock, test as one, type TestRest } from 'claude-code/testing'
import { SITE } from '../hooks/catalog.js'
import THWAITE_ROM from '../hooks/roms/thwaite.mjs'

// Что Claude Code передаёт хуку ui.render для панели, кроме приложения
export const PANE = {
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

export const BAND = {
  plugin: 'arcade',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  viewport: { columns: 160, rows: 40 },
  props: { hasSurvey: false, isWorking: true, maxRows: 3, bodyColumns: 100, scroll: { offset: 0, bodyRows: 3 }, view: {} },
} as const

// Заглушки на всё, о чём мод спрашивает Claude Code. Регистрируются до первого вызова $
// Что нашёл бы поиск браузеров на Windows: Chrome по умолчанию и Firefox, экран 1920×1040
export const DETECTED = JSON.stringify({
  browsers: [
    { id: 'chrome', name: 'Google Chrome', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', app: true },
    { id: 'firefox', name: 'Firefox', path: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe', app: false },
  ],
  defaultProgId: 'ChromeHTML',
  screen: { x: 0, y: 0, width: 1920, height: 1040 },
})
// Тесты пишутся на русском интерфейсе: язык окружения — русский (без него теперь английский)
export const WINDOWS = { OS: 'Windows_NT', LOCALAPPDATA: 'C:\\Users\\max\\AppData\\Local', LANG: 'ru_RU.UTF-8' }

// Каталог, который отдаёт сайт: три игры Денди (они же лежат в моде) и сколько угодно своих
export const SHA = {
  thwaite: 'ee51cd9562f28195ba015d9857c6c4fc9bf67cdfb213e95f655e586b92195173',
  croom: 'c24c1aec75242d3bc80b35c15deb705d35f4cd778b22d1cf1df8b38d8dd62726',
  rfk: '0778e86400a536407fd94d10619208c06dd120d0f5f28ad79778690048dd0091',
}
export function siteGame(title: string, sha: string) {
  return { console: 'nes', title, genre: 'аркада', about: `${title} с сайта`, keys: '…', rom: { url: `files/${sha}.nes`, base64: `files/${sha}.nes.b64`, sha256: sha, size: 1 } }
}
export function siteCatalog(extra: Record<string, unknown> = {}) {
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
export async function probeRom() {
  const bytes = Uint8Array.from(atob(THWAITE_ROM), (c) => c.charCodeAt(0))
  bytes[20000] ^= 0xff
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const sha = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
  return { sha, base64: bytes.toBase64() }
}

export function stubs(on: any, { images = true, env = {}, detect = 'ok', launchExit = 0, site = siteCatalog(), files = {}, stored = {}, uname = '', disk: onDisk = {}, browser = 'deny', tabs = [], abort = false, submit = false, fill = true, draft = '', bashMs = BASH_MS, panes, placed = () => true, web = {}, api, popupAnswer = '', agents, ask, deny, questionMs = 0 }: any = {}) {
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
  // Когда файл записан — для списка папки (fs.list); seq — чтобы две записи в одно время различались
  const mtimes = new Map<string, number>()
  let seq = 0
  const touch = (path: string) => mtimes.set(path, clock.now() + (++seq % 1000) / 1000)
  on('fs.write', ($: any, e: any) => {
    disk.set(e.path, e.text)
    touch(e.path)
    return { value: undefined }
  })
  // Сессия Claude Code для вкладки «Агенты» (agents: { sid, root, repo }): её id, папка и список файлов на диске. Без
  // agents этих вызовов нет — отметки сессий выключены, очередь идёт одна, как раньше
  if (agents) {
    on('session.id', () => ({ value: agents.sid }))
    on('session.root', () => ({ value: agents.root }))
    on('session.cwd', () => ({ value: agents.root }))
    on('session.repo', () => ({ value: agents.repo ?? null }))
    on('fs.list', ($: any, e: any) => {
      const dir = norm(e.path).replace(/\/$/, '')
      const value = [...disk.entries()]
        .filter(([k]) => norm(k).startsWith(`${dir}/`) && !norm(k).slice(dir.length + 1).includes('/'))
        .map(([k, v]) => ({ name: norm(k).slice(dir.length + 1), kind: 'file', size: typeof v === 'string' ? v.length : (v?.length ?? v?.size ?? 0), mtimeMs: mtimes.get(k) ?? 0, isLink: false }))
      return { value }
    })
  }
  // Положить файл на диск «другой программой» (другой сессией Claude Code): со временем записи, как от fs.write
  const putFile = (path: string, text: string) => {
    disk.set(path, text)
    touch(path)
  }
  // Приветствие первого запуска уже закрыто — тесты сразу видят главное меню; его тесты передают welcomed: undefined
  const saved = new Map<string, unknown>(Object.entries({ welcomed: true, ...stored }))
  const fetches: string[] = []
  const requests: any[] = []
  const notifies: any[] = []
  const popups: any[] = [] // карточки о сообщениях
  const widths: any[] = []
  const closed: any[] = []
  const opened: string[] = []
  const opens: any[] = [] // всё, с чем мод открывал панель
  const blits: any[] = []
  const launches: any[] = []
  const toasts: string[] = []
  const clipboard = { exit: 0, calls: [] as any[] } // системный буфер обмена: чем программа закончит и что ей дали
  const clock = mock.clock(on)
  // Тесты пишутся на русском интерфейсе: если окружение не задаёт язык, пусть он будет русским (без него теперь — английский)
  mock.env(on, 'LANG' in env || 'LC_ALL' in env || 'LC_MESSAGES' in env ? env : { ...env, LANG: 'ru_RU.UTF-8' })
  on('process.run', ($: any, e: any) => {
    if (e.argv[0] === 'uname') return { value: { exitCode: 0, stdout: `${uname}\n`, stderr: '' } }
    // Системный буфер обмена: текст — во входном потоке программы
    if (e.init?.stdin !== undefined) {
      clipboard.calls.push({ argv: e.argv, env: e.init.env ?? {}, stdin: e.init.stdin })
      return { value: { exitCode: clipboard.exit, stdout: '', stderr: '' } }
    }
    // Карточка о сообщении: Windows — PowerShell с ARCADE_POPUP_*, Linux и macOS — уведомление от имени Arcade.
    // Ответ — что напечатала карточка: 'open' — по ней кликнули
    if (e.init?.env?.ARCADE_POPUP_TITLE !== undefined || e.argv.includes('--app-name=Arcade') || e.argv.some((a: string) => a.includes('subtitle "Arcade"'))) {
      popups.push({ argv: e.argv, env: e.init?.env ?? {} })
      return { value: { exitCode: 0, stdout: typeof popupAnswer === 'function' ? popupAnswer() : popupAnswer, stderr: '' } }
    }
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
  // Другая сессия между чтением и записью этой: meanwhile.store(шаг, ключ) — после чтения ('get'), перед записью
  // ('before') и после неё ('set')
  const meanwhile: { store?: (step: string, key: string) => void } = {}
  on('store.get', ($: any, e: any) => {
    const value = saved.get(e.key)
    meanwhile.store?.('get', e.key)
    return { value }
  })
  on('store.set', ($: any, e: any) => {
    meanwhile.store?.('before', e.key)
    saved.set(e.key, e.value)
    meanwhile.store?.('set', e.key)
    return { value: undefined }
  })
  on('store.delete', ($: any, e: any) => {
    saved.delete(e.key)
    return { value: undefined }
  })
  // Сайт Arcade: каталог и файлы игр; site: null — сайт недоступен
  on('http.fetch', ($: any, e: any) => {
    fetches.push(e.url)
    // Другие сайты (ленты YouTube): адрес → текст ответа
    if (e.url in web) return { value: { status: 200, ok: true, headers: {}, text: web[e.url] } }
    if (site === null) return { deny: 'getaddrinfo ENOTFOUND agent-arcade.fefaodessa.workers.dev' }
    if (e.url === `${SITE}/catalog.json`) return { value: { status: 200, ok: true, headers: {}, text: site } }
    const path = e.url.slice(SITE.length + 1)
    // Вход, аккаунт и отчёты об ошибках (api/auth/…, api/me…, api/report): api(путь, запрос) → { status, json }; запросы — в requests
    if (api && /^api\/(auth|me|report)\b/.test(path)) {
      const request = { path, method: e.init?.method ?? 'GET', headers: e.init?.headers ?? {}, body: e.init?.body === undefined ? undefined : JSON.parse(e.init.body) }
      requests.push(request)
      const answer = api(path, request)
      if (answer === null) return { deny: 'socket hang up' }
      if (answer) return { value: { status: answer.status ?? 200, ok: (answer.status ?? 200) < 400, headers: {}, text: JSON.stringify(answer.json) } }
    }
    if (path in files) return { value: { status: 200, ok: true, headers: {}, text: files[path] } }
    return { value: { status: 404, ok: false, headers: {}, text: 'not found' } }
  })
  on('command.register', () => ({ value: undefined }))
  // Инструменты мода для Claude (блокнот): Claude Code их принимает; registered — что мод зарегистрировал
  const registered: any[] = []
  on('tool.register', ($: any, e: any) => {
    registered.push(e)
    return { value: { tool: `mcp__arcade__${e.name}` } }
  })
  on('ui.toast', ($: any, e: any) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', ($: any, e: any) => {
    opened.push(e.id)
    widths.push(e.columns)
    opens.push(e)
    // Не поместилась: без спроса движок ставит панель только в широком окне (placed — да или нет на каждое открытие)
    return { value: placed() ? { isPlaced: true } : { isPlaced: false, reason: 'unasked: 144 columns, 100 now' } }
  })
  on('ui.close', ($: any, e: any) => {
    closed.push(e.id)
    return { value: undefined }
  })
  // Панели мода, которые движок помнит открытыми: остаются и после перезагрузки модуля
  if (panes) on('ui.panes', () => ({ value: panes }))
  on('ui.blit', ($: any, e: any) => {
    blits.push(e)
    // Терминал без картинок отказывает показывать Image: вместо картинки там её alt
    if (!images && e.source) return { deny: 'an Image drawing its alt there: no placeholder images' }
    return { value: {} }
  })
  on('session.start', () => ({ cwd: '/work' }))
  on('session.attach', ($: any, e: any) => ({ clientId: e.clientId }))
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
    // Вопрос Claude (AskUserQuestion) человек не отвечает questionMs по часам теста — потом диалог закрыт без ответа
    if (e.tool === 'AskUserQuestion' && questionMs) return clock.sleep(questionMs).then(() => ({ result: { questions: e.questions, answers: {} } }))
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
  // Решение по разрешениям без плагинов: спросить человека. Вызов самого Claude (из теста он идёт от движка) человек
  // разрешил: тест говорит «Claude открыл игру». Вопрос без вызова ($.tool.check) и вызовы мода — «спросить»; вызовы
  // Claude, которые выбрал тест (ask), — тоже. В вызовах, которые тест выбрал в deny, человек отказал
  on('tool.check', ($: any, e: any, next: any) => {
    if (deny?.(e)) return { decision: 'deny' }
    return { decision: ask?.(e) || !(e.tool_use_id && next?.origin?.plugin === 'engine') ? 'ask' : 'allow' }
  })
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
  return { saved, meanwhile, opened, opens, blits, clock, launches, toasts, fetches, requests, notifies, popups, disk, diskFile, putFile, widths, closed, mcpCalls, browserCalls, aborts, submits, fills, registered, clipboard }
}

export const BASH_MS = 2_000

export async function start($: any) {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'arcade', args: '' })
}

// Тесты, которые гоняют эмулятор или долго ждут по часам при открытой панели: на медленной машине и когда файлы тестов идут разом они идут в 2–3 раза дольше обычного лимита
export const HEAVY = { timeoutMs: 30_000 }

// test с лимитом 15 с вместо 5: почти каждый тест запускает весь мод, а когда файлы тестов идут разом на занятой машине, это 5–8 с
export function test(name: string, ...rest: TestRest) {
  if (rest.length === 1) one(name, { timeoutMs: 15_000 }, rest[0])
  else one(name, { timeoutMs: 15_000, ...rest[0] }, rest[1])
}

// Где в меню живёт кнопка: игры Денди — в «Денди», проверка клавиш и выбор окна и графики — в «Настройках»
export const MENU_OF: Record<string, string> = {
  'arcade-game-thwaite': 'nes',
  'arcade-game-croom': 'nes',
  'arcade-game-rfk': 'nes',
  'arcade-game-field': 'settings',
  'arcade-opener': 'settings',
  'arcade-graphics': 'settings',
  'arcade-notify': 'settings',
  'arcade-assign': 'settings',
  'arcade-wide': 'settings',
  'arcade-ask-after': 'settings',
  'arcade-on-done': 'settings',
  'arcade-on-permission': 'settings',
  'arcade-lang': 'settings',
  'arcade-show-play': 'settings',
  'arcade-show-read': 'settings',
  'arcade-show-watch': 'settings',
  'arcade-show-talk': 'settings',
  'arcade-show-work': 'settings',
}

// Дойти по меню до кнопки и нажать её
export async function go(ui: any, key: string) {
  if (!(await ui.find({ key }))) {
    if (await ui.find({ key: 'arcade-back' })) await ui.press({ key: 'arcade-back' })
    if (MENU_OF[key]) await ui.press({ key: `arcade-menu-${MENU_OF[key]}` })
  }
  await ui.press({ key })
}

// Нажать клавишу над экраном игры и дать часам экрана один тик, чтобы hooks/input.js отправил сообщение
export async function tap(ui: any, key: string, extra: Record<string, true> = {}) {
  await ui.key({ key, ...extra })
  await ui.advance(30)
}


// Все строки дерева интерфейса — чтобы проверить, что перевод ничего не пропустил
export async function drawnTexts(ui: any) {
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

// Подписи кнопок с ключами prefix0, prefix1, …: undefined — такой кнопки нет
export async function labels(ui: any, prefix: string, count: number) {
  const out = []
  for (let i = 0; i < count; i++) out.push((await ui.find({ key: `${prefix}${i}` }))?.props.label)
  return out
}