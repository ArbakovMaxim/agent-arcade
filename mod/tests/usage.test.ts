// Тесты «Лимитов»: окна лимитов Claude, контекст и расходы, очередь доски после сброса лимита, всплывашки на 80 и 90%
import { expect } from 'claude-code/testing'
import { isBoard } from '../hooks/notes.js'
import { S } from '../hooks/app/state.js'
import { AGENT_TICK_MS } from '../hooks/app/agents.js'
import { ORPHANS_AFTER_MS, RESUME_AFTER_MS, USAGE_POLL_MS } from '../hooks/app/queue.js'
import { clockText, freshLimits, limitsOf, pctText, resetText, spentWindow, usdText } from '../hooks/app/usage.js'
import { HEAVY, PANE, WINDOWS, start, stubs, test } from './kit.ts'

const NOTES = 'mcp__arcade__notes'
const MIN = 60_000
const HOUR = 60 * MIN
// Четверг, 5 ноября 2026, 13:10 по местному времени
const T0 = new Date(2026, 10, 5, 13, 10).getTime()
const iso = (ms: number) => new Date(ms).toISOString()
const pad = (n: number) => String(n).padStart(2, '0')
const hm = (ms: number) => `${pad(new Date(ms).getHours())}:${pad(new Date(ms).getMinutes())}`
// Замер Claude Code ($.session.usage): окна — [вид, проценты, сброс]
const reading = (limits: [string, number, number?][], more: any = {}) => ({
  context: { tokens: 84_000, window: 200_000, percent: 42 },
  rateLimits: limits.map(([kind, percentUsed, reset]) => ({ kind, percentUsed, ...(reset ? { resetsAt: iso(reset) } : {}) })),
  cost: { usd: 1.234 },
  ...more,
})
// Замер можно менять по ходу теста: заглушка отдаёт, что лежит в box.value сейчас; Arcade спрашивает его после хода
// и раз в USAGE_POLL_MS
const usageStub = (on: any, value: any) => {
  const box = { value }
  on('session.usage', () => {
    if (box.value instanceof Error) throw box.value
    return { value: box.value }
  })
  return box
}

test('лимиты: окна из замера, кончившееся окно, время сброса, самый свежий замер', () => {
  const now = T0
  expect(limitsOf([{ kind: 'five_hour', percentUsed: 42.5, resetsAt: iso(now + 80 * MIN) }, { kind: 'spend_limit', percentUsed: 120 }, { kind: 'seven_day' }, null])).toEqual([
    { kind: 'five_hour', pct: 42.5, reset: now + 80 * MIN },
    { kind: 'spend_limit', pct: 120, reset: 0 },
  ])
  expect(limitsOf(undefined)).toEqual([])

  // Кончилось — 100% и больше, сброс ещё впереди; из нескольких — что сбросится позже: раньше Claude не ответит
  const five = { kind: 'five_hour', pct: 100, reset: now + HOUR }
  const week = { kind: 'seven_day', pct: 100.4, reset: now + 30 * HOUR }
  expect(spentWindow([five, { ...week, pct: 99.9 }], now)).toBe(five)
  expect(spentWindow([five, week], now)).toBe(week)
  expect(spentWindow([{ ...five, reset: now - 1 }], now)).toBeNull()
  expect(spentWindow([{ kind: 'spend_limit', pct: 130, reset: 0 }], now)).toEqual({ kind: 'spend_limit', pct: 130, reset: 0 })
  expect(spentWindow(undefined, now)).toBeNull()

  // Время сброса: часы; через 20 часов и дальше — с днём недели; прошло — «сбросился»
  expect(clockText(now + 80 * MIN, now)).toBe('14:30')
  expect(clockText(now + 30 * HOUR, now)).toBe('Пт 19:10')
  expect(resetText(now + 80 * MIN, now)).toBe('сбросится в 14:30 (через 1 ч 20 мин)')
  expect(resetText(now + 30 * HOUR, now)).toBe('сбросится в Пт 19:10')
  expect(resetText(now - 5 * MIN, now)).toBe('сбросился в 13:05')
  expect(resetText(0, now)).toBe('')
  expect([pctText(42.9), pctText(100.4), usdText(1.234), usdText(0)]).toEqual(['42%', '100%', '$1.23', '$0.00'])

  // Окна — из самого свежего замера, где они есть: своего или другой сессии
  const saved = S.us.me
  S.us.me = { ctx: 10, tokens: 20_000, window: 200_000, usd: 1, limits: [], at: now }
  const a = { usage: { limits: [five], at: now - MIN } }
  const b = { usage: { limits: [week], at: now - 1_000 } }
  expect(freshLimits([a, b, { usage: null }])).toBe(b.usage)
  S.us.me = { ...S.us.me, limits: [five] }
  expect(freshLimits([a, b])).toBe(S.us.me)
  S.us.me = saved
})

test('лимиты: экран — окна с полоской и временем сброса, контекст и расходы; в Desktop — полоски картинкой', async ($, on) => {
  const { clock } = stubs(on, { env: WINDOWS })
  await clock.advance(T0)
  usageStub(on, reading([['five_hour', 45.3, T0 + 80 * MIN + 30_000], ['seven_day', 85, T0 + 30 * HOUR + 30_000]]))
  await start($)
  await clock.advance(1_500)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  expect(await text('  лимиты Claude, контекст и расходы сессий')).toBeDefined()
  await ui.press({ key: 'arcade-menu-usage' })

  // Терминал — строками: имя окна, полоска клетками и проценты цветом, когда сброс
  const five = await text(`5 часов  ${'█'.repeat(9)}${'░'.repeat(11)} 45% · сбросится в 14:30 (через 1 ч 20 мин)`)
  expect(five.children[2]).toMatchObject({ props: { color: 'suggestion' }, children: [`${'█'.repeat(9)}${'░'.repeat(11)} 45%`] })
  const week = await text(`Неделя  ${'█'.repeat(17)}${'░'.repeat(3)} 85% · сбросится в Пт 19:10`)
  expect(week.children[2]).toMatchObject({ props: { color: 'warning' } })
  expect(await text('Замер — меньше минуты назад.')).toBeDefined()
  // Эта сессия: контекст и расходы — цифры самого Claude Code
  expect(await text('Контекст: 42% (84,000 из 200,000 токенов)')).toBeDefined()
  expect(await text('Расходы с начала сессии: $1.23')).toBeDefined()
  expect(await text('Цифры — самого Claude Code: Arcade своих не считает. Окна лимитов — у учётной записи, общие для всех её сессий.')).toBeDefined()
  // Досок нет — подсказка, где запускается очередь
  expect(await text('Досок пока нет — очередь для Claude запускается на доске.')).toBeDefined()

  // Desktop — полоски картинкой, цвет — по заполнению
  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await desk.find({ key: 'usage-win-seven_day' })).toMatchObject({ type: 'Box' })
  const bars = await desk.findAll({ type: 'Svg' })
  expect(bars.map((s: any) => s.props.alt)).toEqual(['45%', '85%'])
  expect(bars[1].props.source).toContain('fill="#f5a524"')
  expect(await desk.find({ type: 'Text', text: 'сбросится в Пт 19:10' })).toBeDefined()
  await desk.unmount()
  await ui.unmount()
})

test('лимиты: окон нет — до первого ответа Claude подсказка, с ключом API — только расходы', async ($, on) => {
  const { clock } = stubs(on, { env: WINDOWS })
  await clock.advance(T0)
  const usage = usageStub(on, { context: { window: 200_000 }, rateLimits: [] })
  await start($)
  await clock.advance(1_500)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  await ui.press({ key: 'arcade-menu-usage' })
  // Ещё ни одного ответа: окон нет ни у кого, контекста тоже
  expect((await ui.findAll({ type: 'Text', text: 'Появится после первого ответа Claude.' })).length).toBe(2)
  expect(await text(/ключом API/)).toBeUndefined()

  // Ответ пришёл, а окон нет — ключ API или шлюз: только контекст и расходы
  usage.value = reading([], { context: { tokens: 24_000, window: 200_000, percent: 12 }, cost: { usd: 0.5 } })
  await clock.advance(USAGE_POLL_MS)
  expect(await text('Окон лимитов нет: так бывает с ключом API или шлюзом. Окна 5 часов и недели — у подписок Claude (Pro, Max, Team, Enterprise). Расходы — ниже.')).toBeDefined()
  expect(await text('Контекст: 12% (24,000 из 200,000 токенов)')).toBeDefined()
  expect(await text('Расходы с начала сессии: $0.50')).toBeDefined()
  expect(await text('Появится после первого ответа Claude.')).toBeUndefined()

  // Claude Code замер не отдаёт (версия постарше) — так и сказать; ответил снова — снова цифры
  usage.value = new Error('unknown method')
  await clock.advance(USAGE_POLL_MS)
  expect(await text('Этот Claude Code лимитов не сообщает — нужен Claude Code новее.')).toBeDefined()
  expect(await text('Эта сессия')).toBeUndefined()
  usage.value = reading([['five_hour', 10, T0 + HOUR]])
  await clock.advance(USAGE_POLL_MS)
  expect(await text('Этот Claude Code лимитов не сообщает — нужен Claude Code новее.')).toBeUndefined()
  expect(await text(/^5 часов .* 10% · сбросится в /)).toBeDefined()
  await ui.unmount()
})

test('лимиты: всплывашка на 80 и 90% — о каждом пороге окна раз; в настройках выключается', async ($, on) => {
  const { clock, saved, toasts } = stubs(on, { env: WINDOWS })
  await clock.advance(T0)
  const usage = usageStub(on, reading([]))
  await start($)
  const R = T0 + 3 * HOUR
  const measure = async (pct: number, reset = R) => {
    usage.value = reading([['five_hour', pct, reset]])
    await clock.advance(USAGE_POLL_MS)
  }
  const warns = () => toasts.filter((t: string) => t.startsWith('Лимит Claude «'))
  await measure(79)
  expect(warns()).toEqual([])
  await measure(81)
  expect(warns().length).toBe(1)
  expect(warns()[0].startsWith(`Лимит Claude «5 часов»: 81% — сбросится в ${hm(R)} (через 2 ч 59 мин`)).toBe(true)
  await measure(85)
  expect(warns().length).toBe(1)
  await measure(91)
  expect(warns().length).toBe(2)
  expect(warns()[1].startsWith('Лимит Claude «5 часов»: 91% — ')).toBe(true)
  await measure(97)
  expect(warns().length).toBe(2)
  // Что уже сказано — в $.store, общем для всех сессий: другая сессия о том же окне не повторит
  expect((saved.get('usageWarned') as any)[`five_hour|${R}`][0]).toBe(90)
  // Новое окно (сброс прошёл) — снова скажем
  await measure(82, R + 5 * HOUR)
  expect(warns().length).toBe(3)

  // В настройках — выключить: больше не говорим
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect((await ui.find({ key: 'arcade-usage-warn' })).props.label).toBe('Лимит Claude на 80 и 90%: да')
  await ui.press({ key: 'arcade-usage-warn' })
  expect((await ui.find({ key: 'arcade-usage-warn' })).props.label).toBe('Лимит Claude на 80 и 90%: нет')
  expect(saved.get('usageWarn')).toBe(false)
  await measure(95, R + 5 * HOUR)
  expect(warns().length).toBe(3)
  await ui.unmount()
})

// Доска «Sprint» с карточками и очередь на ней: что отдано Claude, где карточка
async function queueBoard($: any, { saved, submits }: any, ui: any, titles: string[]) {
  const pages = () => saved.get('notes') as any[]
  const page = (title: string) => pages().find((p) => p.title === title)
  const board = () => pages().find(isBoard)
  const card = (n: number) => submits[n].text.match(/\(id (\w+)\)/)[1]
  await $.tool.call({ tool: NOTES, action: 'create', title: 'Sprint', board: true })
  for (const title of titles) await $.tool.call({ tool: NOTES, action: 'create', title, parent: 'Sprint' })
  await ui.press({ key: 'arcade-menu-boards' })
  await ui.press({ key: `arcade-desk-${board().id}` })
  return { page, board, card, done: (title: string) => $.tool.call({ tool: NOTES, action: 'move', page: page(title).id, column: 'done' }) }
}

test('лимиты: очередь встала на лимите — время сброса и кнопка; после сброса продолжается с той же карточки', HEAVY, async ($, on) => {
  const stub = stubs(on, { env: WINDOWS, submit: true })
  const { clock, submits, toasts } = stub
  await clock.advance(T0)
  const usage = usageStub(on, reading([['five_hour', 60, T0 + 2 * HOUR]]))
  await start($)
  await clock.advance(1_500)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const { page, card } = await queueBoard($, stub, ui, ['A', 'B'])
  expect((await ui.find({ key: 'arcade-board-resume-auto' })).props.label).toBe('Продолжать очередь после сброса лимита: нет')
  await ui.press({ key: 'arcade-board-queue' })
  expect(card(0)).toBe(page('A').id)

  // Посреди карточки кончился лимит: ход — с ошибкой API, а замер говорит «100%» и когда сброс
  const R = clock.now() + 10 * MIN + 30_000
  usage.value = reading([['five_hour', 100, R]])
  await $.turn.start({ turnId: 't1', text: submits[0].text })
  await $.turn.complete({ turnId: 't1', answer: '', reason: 'error' })
  await clock.advance(10)
  const stop = `Очередь остановлена: кончился лимит Claude — сбросится в ${hm(R)} (через 10 мин).`
  expect(await text(stop)).toMatchObject({ props: { color: 'warning' } })
  expect(toasts).toContain(stop)
  // Продолжить после сброса — одной кнопкой; «Не продолжать» снова даёт кнопку
  const at = hm(R + RESUME_AFTER_MS)
  expect((await ui.find({ key: 'arcade-board-resume' })).props.label).toBe(`Продолжить очередь после сброса в ${at}`)
  await ui.press({ key: 'arcade-board-resume' })
  expect(await text(`  Очередь продолжится в ${at}.`)).toBeDefined()
  expect(await ui.find({ key: 'arcade-board-resume' })).toBeUndefined()
  await ui.press({ key: 'arcade-board-resume-off' })
  expect(await text(`  Очередь продолжится в ${at}.`)).toBeUndefined()
  await ui.press({ key: 'arcade-board-resume' })

  // То же — в «Лимитах»: когда продолжится и «Не продолжать»
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-usage' })
  expect(await text(`Очередь «Sprint» продолжится в ${at}.`)).toBeDefined()
  expect(await ui.find({ key: 'usage-wait-cancel' })).toBeDefined()

  // До сброса — ничего; сбросился — та же карточка снова у Claude
  await clock.set(R)
  expect(submits.length).toBe(1)
  usage.value = reading([['five_hour', 2, R + 5 * HOUR]])
  await clock.set(R + RESUME_AFTER_MS + 2 * AGENT_TICK_MS)
  expect(submits.length).toBe(2)
  expect(card(1)).toBe(page('A').id)
  expect(toasts).toContain('Лимит Claude сбросился — очередь «Sprint» продолжается.')
  expect(await text(/продолжится в/)).toBeUndefined()
  await ui.unmount()
})

test('лимиты: доска «продолжать самой» — без кнопки; замер после конца хода уточняет остановку; сброс неизвестен — без кнопки', HEAVY, async ($, on) => {
  const stub = stubs(on, { env: WINDOWS, submit: true })
  const { clock, saved, submits, toasts } = stub
  await clock.advance(T0)
  const usage = usageStub(on, reading([['five_hour', 60, T0 + 2 * HOUR]]))
  await start($)
  await clock.advance(1_500)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const { board, page, card } = await queueBoard($, stub, ui, ['A', 'B'])
  // Отметить заранее: кончится лимит — очередь продолжится сама
  await ui.press({ key: 'arcade-board-resume-auto' })
  expect((await ui.find({ key: 'arcade-board-resume-auto' })).props.label).toBe('Продолжать очередь после сброса лимита: да')
  expect(saved.get('queueArmed')).toEqual([board().id])
  await ui.press({ key: 'arcade-board-queue' })

  // Ход кончился ошибкой, а замер ещё старый — остановка как при ошибке
  await $.turn.start({ turnId: 't1', text: submits[0].text })
  await $.turn.complete({ turnId: 't1', answer: '', reason: 'error' })
  await clock.advance(10)
  expect(await text('Очередь остановлена: Claude не закончил ход — ошибка или отказ.')).toBeDefined()
  // Следующий замер (через полминуты): окно кончилось — это был лимит, и очередь ждёт сброса сама
  const R = clock.now() + 3 * MIN
  usage.value = reading([['five_hour', 100, R]])
  await clock.advance(USAGE_POLL_MS)
  const at = hm(R + RESUME_AFTER_MS)
  const stop = `Очередь остановлена: кончился лимит Claude — сбросится в ${hm(R)} (через 2 мин). Очередь продолжится в ${at}.`
  expect(await text(stop)).toMatchObject({ props: { color: 'warning' } })
  expect(toasts).toContain(stop)
  expect(await ui.find({ key: 'arcade-board-resume' })).toBeUndefined()
  expect(await text(`  Очередь продолжится в ${at}.`)).toBeDefined()

  usage.value = reading([['five_hour', 1, R + 5 * HOUR]])
  await clock.set(R + RESUME_AFTER_MS + 2 * AGENT_TICK_MS)
  expect(submits.length).toBe(2)
  expect(card(1)).toBe(page('A').id)

  // Окно кончилось, а когда сброс — Claude Code не сказал: остановка без времени сброса и без кнопки
  usage.value = reading([['five_hour', 100]])
  await $.turn.start({ turnId: 't2', text: submits[1].text })
  await $.turn.complete({ turnId: 't2', answer: '', reason: 'error' })
  await clock.advance(10)
  expect(await text('Очередь остановлена: кончился лимит Claude.')).toMatchObject({ props: { color: 'warning' } })
  expect(await ui.find({ key: 'arcade-board-resume' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-board-resume-off' })).toBeUndefined()
  await ui.unmount()
})

// Сессии на этом компьютере: отметки — в домашней папке
const AG_ENV = { ...WINDOWS, USERPROFILE: 'C:\\Users\\max' }
const AG_DIR = 'C:\\Users\\max\\.claude\\arcade\\agents'
const AG_ME = { sid: 'sess-me', root: 'D:\\work\\web' }

test('лимиты: очередь не продолжилась — сессию закрыли до сброса или компьютер спал; заметка с крестиком', HEAVY, async ($, on) => {
  const { clock, saved, toasts } = stubs(on, {
    env: AG_ENV,
    agents: AG_ME,
    stored: {
      queueResume: [
        { sid: 'sess-me', board: 'b1', title: 'Sprint', card: 'c1', at: T0 - 2 * HOUR },
        { sid: 'sess-gone', board: 'b2', title: 'Release', card: 'c2', at: T0 - MIN },
      ],
    },
  })
  await clock.advance(T0)
  usageStub(on, reading([]))
  await start($)
  // Своё ожидание прошло давно — Claude Code был закрыт или компьютер спал: не продолжаем, говорим (первый шаг занят
  // отметкой сессии — смотрим через пару шагов)
  await clock.advance(3 * AGENT_TICK_MS)
  const slept = 'Очередь «Sprint» не продолжилась после сброса лимита: Claude Code был закрыт или компьютер спал.'
  expect(toasts).toContain(slept)
  // Чужое ожидание: той сессии нет среди живых — её очередь не запустится
  await clock.advance(ORPHANS_AFTER_MS + AGENT_TICK_MS)
  const closed = 'Очередь «Release» не запустилась после сброса лимита: сессия была закрыта.'
  expect(toasts).toContain(closed)
  expect(saved.get('queueResume')).toEqual([])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-usage' })
  expect(await ui.find({ type: 'Text', text: slept })).toMatchObject({ props: { color: 'warning' } })
  expect(await ui.find({ type: 'Text', text: closed })).toBeDefined()
  await ui.press({ key: 'usage-missed-off-b2' })
  expect(await ui.find({ type: 'Text', text: closed })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: slept })).toBeDefined()
  await ui.unmount()
})

test('лимиты: замеры других сессий — в «Лимитах» и «Агентах»; окна — из самого свежего', async ($, on) => {
  const { clock, putFile } = stubs(on, { env: AG_ENV, agents: AG_ME })
  await clock.advance(T0)
  usageStub(on, { context: { window: 200_000 }, rateLimits: [] })
  const R = T0 + 40 * HOUR + 30_000
  putFile(
    `${AG_DIR}\\s3.json`,
    JSON.stringify({ v: 1, sid: 'sess-a', name: 'api', path: 'D:\\work\\api', status: 'idle', since: T0, card: null, queue: null, claim: null, usage: { ctx: 63, usd: 2.5, limits: [{ kind: 'seven_day', pct: 91, reset: R }], at: T0 }, at: T0 }),
  )
  await start($)
  await clock.advance(1_500)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  await ui.press({ key: 'arcade-menu-usage' })
  await clock.advance(AGENT_TICK_MS)
  // У этой сессии ответов ещё не было — окна из замера «api»
  expect(await text(`Неделя  ${'█'.repeat(18)}${'░'.repeat(2)} 91% · сбросится в ${clockText(R, clock.now())}`)).toBeDefined()
  expect(await text('Появится после первого ответа Claude.')).toBeDefined()
  expect(await text('api — Контекст: 63% · $2.50')).toBeDefined()
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-agents' })
  await clock.advance(AGENT_TICK_MS)
  expect(await text(/Контекст: 63% · \$2\.50/)).toBeDefined()
  await ui.unmount()
})
