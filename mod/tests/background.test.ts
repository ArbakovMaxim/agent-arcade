// Тесты Arcade: агенты в фоне — главный ход Claude кончился, а субагенты и напарники, запущенные из него, ещё работают
import { expect } from 'claude-code/testing'
import { AGENT_TICK_MS } from '../hooks/app/agents.js'
import { BG_GRACE_MS } from '../hooks/app/background.js'
import { columnOf, isBoard } from '../hooks/notes.js'
import { PANE, WINDOWS, stubs, start, test } from './kit.ts'

const NOTES = 'mcp__arcade__notes'
const AG_ENV = { ...WINDOWS, USERPROFILE: 'C:\\Users\\max' }
const AG_ME = { sid: 'sess-me', root: 'D:\\work\\web' }
const DONE = 'Агент закончил — Esc, чтобы вернуться'
// Конец фоновой задачи будит Claude новым ходом — с уведомлением вместо просьбы
const WAKE = '<task-notification>\n<task-id>a1</task-id>\n<status>completed</status>\n<summary>Agent "review" completed</summary>\n</task-notification>'
// Отметка этой сессии на диске
const ownRecord = (disk: Map<string, any>) =>
  [...disk.entries()]
    .filter(([k]) => /[\\/]agents[\\/]s\d+\.json$/.test(k))
    .map(([, v]) => JSON.parse(v))
    .find((r) => r.sid === AG_ME.sid)
// Субагент кончился: его статус в списке и конец его хода
const finish = async ($: any, subagents: any[], id: string) => {
  subagents.find((a) => a.id === id).status = 'completed'
  await $.turn.complete({ turnId: `sub-${id}`, agentId: id, reason: 'answer', answer: 'done' })
}

test('фон: ход кончился, а два агента работают — «работает в фоне · агентов: 2», без «закончил»; кончился последний — «закончил» после паузы', async ($, on) => {
  const subagents: any[] = [
    { id: 'a1', status: 'running', description: 'review api' },
    { id: 'a2', status: 'pending', description: 'review web' },
    { id: 'a3', status: 'completed', description: 'old' }, // кончился раньше — не в счёт
    { id: 'a4', status: 'running', description: 'nested', parentId: 'a1' }, // вложенный — часть своего родителя
    { id: 'a5', status: 'idle', description: 'mate', teammateId: 'mate-1' }, // напарник ждёт сообщения — не работа
    { id: 'a6', status: 'running', description: 'other plugin', spawnedBy: 'other' }, // запустил другой плагин — его дело
  ]
  const { clock, disk, toasts } = stubs(on, { env: AG_ENV, agents: AG_ME, subagents })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })

  await $.turn.start({ turnId: 't1', text: 'проверь всё' })
  await clock.advance(60_000)
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'запустил агентов' })
  await clock.advance(10)
  // Claude не закончил: в шапке — «в фоне», цветом работы; ни «закончил», ни всплывашки
  expect(await text('Агент работает в фоне · агентов: 2')).toMatchObject({ props: { color: 'warning' } })
  expect(toasts).not.toContain(DONE)
  expect(await text(DONE)).toBeUndefined()

  // Отметка сессии и вкладка «Агенты»: «работает в фоне · агентов: 2», а время — с начала работы, не с конца хода
  await clock.advance(AGENT_TICK_MS)
  expect(ownRecord(disk)).toMatchObject({ status: 'background', bg: 2 })
  await ui.press({ key: 'arcade-menu-agents' })
  await clock.advance(AGENT_TICK_MS)
  expect(await text(/^web · эта сессия — работает в фоне · агентов: 2 · 1 мин$/)).toBeDefined()

  // Один кончился — агентов: 1
  await finish($, subagents, 'a1')
  await clock.advance(10)
  expect(await text(/^web · эта сессия — работает в фоне · агентов: 1 · 1 мин$/)).toBeDefined()

  // Агент в фоне спросил разрешения — «ждёт разрешения»; инструмент отработал — снова «в фоне», а не «работает»
  await ui.press({ key: 'arcade-back' })
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm test' } })
  expect(await text('Агент ждёт разрешения — Esc, чтобы ответить')).toBeDefined()
  await $.classic.PostToolUse({ tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_response: {} })
  expect(await text('Агент работает в фоне · агентов: 1')).toBeDefined()

  // Кончился последний — ещё немного ждём: вдруг Claude проснётся новым ходом
  await finish($, subagents, 'a2')
  await clock.advance(10)
  expect(toasts).not.toContain(DONE)
  await clock.advance(BG_GRACE_MS + AGENT_TICK_MS)
  // Нового хода нет — Claude закончил: шапка, всплывашка, отметка
  expect(toasts).toContain(DONE)
  expect(await text(DONE)).toBeDefined()
  await clock.advance(AGENT_TICK_MS)
  expect(ownRecord(disk)).toMatchObject({ status: 'done', bg: 0 })
  await ui.unmount()
})

test('фон: агент кончился и разбудил Claude — тот же ход работы: время не с нуля, «закончил» — в конце этого хода', async ($, on) => {
  const subagents: any[] = [{ id: 'a1', status: 'running', description: 'review' }]
  const { clock, toasts } = stubs(on, { subagents })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })

  await $.turn.start({ turnId: 't1', text: 'проверь всё' })
  await clock.advance(30_000)
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'жду агента' })
  await clock.advance(10)
  expect(await text('Агент работает в фоне · агентов: 1')).toBeDefined()

  // Агент кончился, Claude проснулся от уведомления — работает дальше, счёт времени тот же
  await finish($, subagents, 'a1')
  await clock.advance(10)
  await $.turn.start({ turnId: 't2', text: WAKE })
  await clock.advance(1_000) // шапка перерисовывается раз в секунду
  expect(await text(/^Агент работает 3[01] с$/)).toBeDefined()
  // Пауза прошла, а Claude ещё работает — «закончил» не приходит
  await clock.advance(BG_GRACE_MS + AGENT_TICK_MS)
  expect(toasts).not.toContain(DONE)
  expect(await text(/^Агент работает 3\d с$/)).toBeDefined()
  // Ход кончился, в фоне никого — «закончил» сразу
  await $.turn.complete({ turnId: 't2', reason: 'answer', answer: 'всё готово' })
  await clock.advance(10)
  expect(toasts).toContain(DONE)
  expect(await text(DONE)).toBeDefined()

  // Новая просьба человека — время с нуля
  await $.turn.start({ turnId: 't3', text: 'а теперь тесты' })
  await clock.advance(1_000)
  expect(await text(/^Агент работает [01] с$/)).toBeDefined()
  await ui.unmount()
})

test('фон: очередь доски — следующая карточка, когда фон опустел; уведомление о задаче очередь не стопит; пока агенты в фоне, очередь не запустить', async ($, on) => {
  const subagents: any[] = []
  const { clock, saved, submits } = stubs(on, { env: WINDOWS, submit: true, subagents })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const pages = () => saved.get('notes') as any[]
  const page = (title: string) => pages().find((p) => p.title === title)
  const board = () => pages().find(isBoard)
  const col = (title: string) => columnOf(page(title), board().board.cols)
  const card = (n: number) => submits[n].text.match(/\(id (\w+)\)/)[1]
  const done = (title: string) => $.tool.call({ tool: NOTES, action: 'move', page: page(title).id, column: 'done' })
  const label = async () => (await ui.find({ key: 'arcade-board-queue' }))?.props.label

  await $.tool.call({ tool: NOTES, action: 'create', title: 'Sprint', board: true })
  for (const title of ['A', 'B']) await $.tool.call({ tool: NOTES, action: 'create', title, parent: 'Sprint' })
  await ui.press({ key: 'arcade-menu-boards' })
  await ui.press({ key: `arcade-desk-${board().id}` })
  await ui.press({ key: 'arcade-board-queue' })
  expect(card(0)).toBe(page('A').id)

  // Claude перенёс карточку в «Готово», но агент ещё в фоне — следующую не даём
  subagents.push({ id: 'a1', status: 'running', description: 'review' })
  await $.turn.start({ turnId: 't1', text: submits[0].text })
  await done('A')
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: '' })
  await clock.advance(10)
  expect(submits.length).toBe(1)
  expect(await label()).toBe('Остановить очередь')

  // Агент кончился и разбудил Claude — это не чужая просьба: очередь идёт; ход кончился — следующая карточка
  await finish($, subagents, 'a1')
  await $.turn.start({ turnId: 't2', text: WAKE })
  expect(await text('Очередь остановлена: Claude получил другую просьбу.')).toBeUndefined()
  expect(await label()).toBe('Остановить очередь')
  await $.turn.complete({ turnId: 't2', reason: 'answer', answer: 'агент всё проверил' })
  await clock.advance(10)
  expect(submits.length).toBe(2)
  expect(card(1)).toBe(page('B').id)
  expect(col('B')).toBe('doing')

  // Без нового хода: фон опустел — после паузы очередь решает по концу того хода
  subagents.push({ id: 'a2', status: 'running', description: 'review' })
  await $.turn.start({ turnId: 't3', text: submits[1].text })
  await done('B')
  await $.turn.complete({ turnId: 't3', reason: 'answer', answer: '' })
  await clock.advance(10)
  expect(await text('Очередь пройдена: в колонке «Сделать» карточек больше нет.')).toBeUndefined()
  await finish($, subagents, 'a2')
  await clock.advance(BG_GRACE_MS + 2 * AGENT_TICK_MS)
  expect(await text('Очередь пройдена: в колонке «Сделать» карточек больше нет.')).toBeDefined()
  expect(submits.length).toBe(2)

  // Своя просьба, агент в фоне — Claude занят: очередь не запустить
  await $.tool.call({ tool: NOTES, action: 'create', title: 'C', parent: 'Sprint' })
  subagents.push({ id: 'a3', status: 'running', description: 'review' })
  await $.turn.start({ turnId: 't4', text: 'почини тесты' })
  await $.turn.complete({ turnId: 't4', reason: 'answer', answer: '' })
  await clock.advance(10)
  await ui.press({ key: 'arcade-board-queue' })
  expect(submits.length).toBe(2)
  expect(await text('Claude занят — запусти очередь, когда он закончит ход.')).toBeDefined()
  await ui.unmount()
})
