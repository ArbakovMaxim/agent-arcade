// Заметки проекта из блокнота (п. 38): страница, отмеченная «Контекст для папки», — разделом системного промпта в начале
// каждой новой сессии этой папки. Отдельный файл — у каждого файла тестов свой предел времени
import { expect } from 'claude-code/testing'
import { CTX_DIRS, CTX_MAX, CTX_SECTION, approveCtx, bindCtx, ctxDir, ctxSection, ctxText, cutText, keepSnaps, markForeign, restoreCtx, restoreSnaps, unbindCtx } from '../hooks/context.js'
import { applySync, freshBase, parseBoard } from '../hooks/desks.js'
import { addPage } from '../hooks/notes.js'
import { AGENT_TICK_MS } from '../hooks/register.js'
import { PANE, WINDOWS, drawnTexts, stubs, start, test } from './kit.ts'

const NOTES = 'mcp__arcade__notes'
const ENV = { ...WINDOWS, USERPROFILE: 'C:\\Users\\max' }
const API = 'C:\\demo\\api'
const WEB = 'C:\\demo\\web'
const PAGE = { id: 'pn', title: 'Заметки api', body: 'API слушает порт 8080. База — Postgres 16.', parent: null, at: 1 }
// Привязка в $.store: папка → страница
const bound = (path: string, extra: any = {}) => ({ dirs: { [path.toLowerCase().replace(/\\/g, '/')]: { path, page: 'pn', at: 1, ...extra } } })
// Раздел Arcade в системном промпте этой сессии; нет — undefined
// В тестах сведения сессии (модель, инструменты, стиль) не подставляются — называем их сами
const MODEL = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] }
const compose = async ($: any, input: any = {}) => (await $.prompt.compose({ ...MODEL, ...input })).sections
// Под плагинами в тестах промпт никто не собирает — заглушка движка: один его раздел
const engine = (on: any) => on('prompt.compose', () => ({ sections: [{ id: 'core:intro', text: 'You are Claude Code.', scope: 'shared' }] }))
const section = async ($: any, input: any = {}) => (await compose($, input)).find((s: any) => s.id === CTX_SECTION)
const openPage = async (ui: any, id: string) => {
  await ui.press({ key: 'arcade-menu-notes' })
  await ui.press({ key: `arcade-note-page-${id}` })
}
// Со страницы — назад к списку блокнота
const backToNotes = async (ui: any) => {
  await ui.press({ key: 'arcade-back' })
  if (await ui.find({ key: 'arcade-menu-notes' })) await ui.press({ key: 'arcade-menu-notes' })
}
const shown = async (ui: any, part: string) => (await drawnTexts(ui)).some((t) => t.includes(part))

test('контекст папки: привязка, обрезка, чужая правка, снимки — чистые части', async () => {
  // Папка сессии: worktree — папка репозитория; подпапка репозитория и папка без git — она сама
  expect(ctxDir(API, '')).toBe(API)
  expect(ctxDir(`${API}\\.claude\\worktrees\\fix-1`, API)).toBe(API)
  expect(ctxDir('C:\\tmp\\wt-1', API)).toBe(API)
  expect(ctxDir(`${API}\\src`, API)).toBe(`${API}\\src`)
  expect(ctxDir('', API)).toBe('')

  // У папки одна страница; ключ — без регистра, слешей и косой черты в конце
  let ctx: any = bindCtx({ dirs: {} }, API, 'pa', 1)
  expect(ctx).toEqual({ dirs: { 'c:/demo/api': { path: API, page: 'pa', at: 1 } } })
  ctx = bindCtx(ctx, 'c:\\Demo\\API\\', 'pb', 2)
  expect(Object.values(ctx.dirs)).toEqual([{ path: 'c:\\Demo\\API\\', page: 'pb', at: 2 }])
  ctx = bindCtx(bindCtx({ dirs: {} }, API, 'pa', 1), WEB, 'pb', 2)
  expect(unbindCtx(ctx, API)).toEqual({ dirs: { 'c:/demo/web': { path: WEB, page: 'pb', at: 2 } } })
  // Из $.store — только то, что сходится; папок не больше CTX_DIRS, старые уходят
  expect(restoreCtx({ dirs: { a: { path: API, page: 'BAD!', at: 1 }, b: { path: 7, page: 'pa' }, c: { path: WEB, page: 'pc' } } })).toEqual({ dirs: { 'c:/demo/web': { path: WEB, page: 'pc', at: 0 } } })
  expect(restoreCtx(null)).toEqual({ dirs: {} })
  const many = Object.fromEntries(Array.from({ length: CTX_DIRS + 5 }, (_, i) => [`k${i}`, { path: `C:\\p${i}`, page: 'pa', at: i }]))
  const kept = restoreCtx({ dirs: many })
  expect([Object.keys(kept.dirs).length, kept.dirs['c:/p0'], kept.dirs[`c:/p${CTX_DIRS + 4}`]?.at]).toEqual([CTX_DIRS, undefined, CTX_DIRS + 4])

  // Чужая правка: в контекст идёт прежняя версия; ждала уже — остаётся та, что человек брал последней
  let held: any = markForeign(ctx, 'pa', { title: 'План', body: 'v1' }, '583231')
  expect(held.dirs['c:/demo/api']).toEqual({ path: API, page: 'pa', at: 1, ok: { title: 'План', body: 'v1' }, by: '583231' })
  expect(held.dirs['c:/demo/web']).toEqual(ctx.dirs['c:/demo/web'])
  held = markForeign(held, 'pa', { title: 'План', body: 'v2' }, 'not an id!')
  expect(held.dirs['c:/demo/api']).toMatchObject({ ok: { body: 'v1' }, by: '' })
  expect(markForeign(ctx, 'zz', { title: '', body: '' }, '1')).toBe(ctx)
  expect(restoreCtx(JSON.parse(JSON.stringify(held)))).toEqual(held)
  const page = { id: 'pa', title: 'План v3', body: 'v3' }
  expect(ctxText(held.dirs['c:/demo/api'], page)).toEqual({ title: 'План', text: 'v1', cut: false, pending: true })
  // «Взять эту версию» — со следующей сессии страница как есть; новая отметка — тоже согласие на текущую версию
  const taken: any = approveCtx(held, 'pa')
  expect(taken.dirs['c:/demo/api']).toEqual({ path: API, page: 'pa', at: 1 })
  expect(ctxText(taken.dirs['c:/demo/api'], page)).toEqual({ title: 'План v3', text: 'v3', cut: false, pending: false })
  expect(bindCtx(held, API, 'pa', 5).dirs['c:/demo/api']).toEqual({ path: API, page: 'pa', at: 5 })

  // Длиннее CTX_MAX — начало, по границе строки
  const lines = Array.from({ length: 300 }, (_, i) => `строка ${i} ${'x'.repeat(30)}`).join('\n')
  const cut = cutText(lines)
  expect([cut.cut, cut.text.length <= CTX_MAX, cut.text.length > CTX_MAX / 2, lines.startsWith(cut.text), lines[cut.text.length]]).toEqual([true, true, true, true, '\n'])
  expect(cutText('a'.repeat(CTX_MAX + 10))).toEqual({ text: 'a'.repeat(CTX_MAX), cut: true })
  expect(cutText('коротко')).toEqual({ text: 'коротко', cut: false })

  // Раздел: заголовок, подсказка «только дописывать», текст страницы между метками; обрезанной — предупреждение
  const snap = { dir: API, page: 'pa', title: 'Заметки api', text: 'Порт 8080', cut: true, at: 1 }
  const text = ctxSection(snap)
  expect(text.split('\n')[0]).toBe('# Project notes from the Arcade notebook')
  expect(text).toContain('Page "Заметки api" (id pa):\n--- page start ---\nПорт 8080\n--- page end ---')
  expect(text).toContain('action "append", page "pa"). Only append: never replace or delete text on this page.')
  expect(text).toContain(`The page is longer than ${CTX_MAX} characters`)
  expect(ctxSection({ ...snap, cut: false })).not.toContain('longer than')

  // Снимки по сессиям: только сходящиеся; не больше 20, своя остаётся всегда
  expect(restoreSnaps({ a: snap, b: { none: true, at: 2 }, c: { ...snap, page: 'BAD!' }, d: { ...snap, text: 'y'.repeat(CTX_MAX + 1) }, e: { none: true } })).toEqual({ a: snap, b: { none: true, at: 2 } })
  let snaps: any = {}
  for (let i = 0; i < 25; i++) snaps = keepSnaps(snaps, `s${i}`, { none: true, at: i })
  expect([Object.keys(snaps).length, 's0' in snaps, 's24' in snaps]).toEqual([20, false, true])
  expect('old' in keepSnaps(snaps, 'old', { none: true, at: -1 })).toBe(true)

  // Сверка общей доски: кто правил карточку последним (номер аккаунта; нет — '')
  const B1 = 'b' + 'Q'.repeat(16)
  let notes: any = addPage([], { title: 'Проект', board: { share: B1 } }, 10).notes
  notes = addPage(notes, { title: 'one', parent: 'pa', id: 'c1' }, 11).notes
  const base = freshBase(notes, notes.find((p: any) => p.id === 'pa'), '7')
  const cols = [{ id: 'todo' }, { id: 'doing' }, { id: 'done' }]
  const reply = { status: 200, ok: true, headers: {}, text: JSON.stringify({ board: { id: B1, name: 'Проект', owner: '7', members: ['7', '583231'], cols, rev: 2 }, cards: [{ id: 'c1', title: 'one', body: 'новое', col: 'todo', pos: 0, by: '583231' }, { id: 'c2', title: 'two', body: '', col: 'todo', pos: 1 }] }) }
  const out: any = applySync(notes, base, parseBoard(reply), { puts: {}, dels: [] }, 20)
  expect([out.changed, out.editors]).toEqual([['c1', 'c2'], { c1: '583231', c2: '' }])
})

test('контекст папки: новая сессия в C:\\demo\\api получает страницу; правка посреди сессии раздел не меняет', async ($, on) => {
  const agents = { sid: 'sess-1', root: API }
  const { clock, saved } = stubs(on, { env: ENV, agents, stored: { notes: [PAGE], ctx: bound(API) } })
  engine(on)
  await start($)
  await clock.advance(200)
  const first = await section($)
  expect(first).toMatchObject({ id: CTX_SECTION, scope: 'session' })
  expect(first.text).toContain('--- page start ---\nAPI слушает порт 8080. База — Postgres 16.\n--- page end ---')
  expect(first.text).not.toContain('longer than')
  // Раздел — последним, после разделов Claude Code
  expect((await compose($)).at(-1).id).toBe(CTX_SECTION)
  // --bare — без раздела
  expect(await section($, { traits: ['bare'] })).toBeUndefined()

  // Claude дописал решение посреди сессии: раздел тот же — кеш промпта цел; снимок — в $.store (после /reload-plugins тот же)
  await $.tool.call({ tool: NOTES, action: 'append', page: 'pn', text: 'Деплой по пятницам — нельзя.' })
  expect((saved.get('notes') as any[])[0].body).toContain('Деплой по пятницам — нельзя.')
  expect((await section($)).text).toBe(first.text)
  expect(Object.keys(saved.get('ctxsnap') as any)).toEqual(['sess-1'])

  // В «Агентах» у сессии — страница контекста
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-agents' })
  await clock.advance(AGENT_TICK_MS)
  expect(await shown(ui, 'Контекст из блокнота: «Заметки api»')).toBe(true)
  await ui.unmount()

  // Новая сессия (после /clear id тоже новый) — уже с правкой
  agents.sid = 'sess-2'
  expect((await section($)).text).toContain('Деплой по пятницам — нельзя.')
  expect(Object.keys(saved.get('ctxsnap') as any).sort()).toEqual(['sess-1', 'sess-2'])
})

test('контекст папки: сессия в C:\\demo\\web раздела не получает; отметка — со следующей сессии, снятая — без раздела', async ($, on) => {
  const agents = { sid: 'sess-w1', root: WEB }
  const { clock, saved } = stubs(on, { env: ENV, agents, stored: { notes: [PAGE], ctx: bound(API) } })
  engine(on)
  await start($)
  await clock.advance(200)
  expect(await section($)).toBeUndefined()
  expect((saved.get('ctxsnap') as any)['sess-w1']).toMatchObject({ none: true })

  // На странице: переключатель для папки этой сессии и к какой ещё папке страница привязана
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await openPage(ui, 'pn')
  expect(await ui.find({ key: 'arcade-note-ctx' })).toMatchObject({ props: { label: '☐ Контекст для папки: web' } })
  expect(await shown(ui, 'Новые сессии в этой папке получат текст страницы в начале.')).toBe(true)
  expect(await shown(ui, 'Контекст и для папок: api')).toBe(true)
  await ui.press({ key: 'arcade-note-ctx' })
  expect((saved.get('ctx') as any).dirs['c:/demo/web']).toMatchObject({ path: WEB, page: 'pn' })
  expect((saved.get('ctx') as any).dirs['c:/demo/api']).toMatchObject({ path: API, page: 'pn' })
  expect(await ui.find({ key: 'arcade-note-ctx' })).toMatchObject({ props: { label: '☑ Контекст для папки: web' } })
  // Посреди этой сессии раздел не появляется — только в следующей
  expect(await section($)).toBeUndefined()
  agents.sid = 'sess-w2'
  expect((await section($)).text).toContain('API слушает порт 8080.')

  // Другая страница для той же папки — подсказка, что отметка заменит прежнюю
  await $.tool.call({ tool: NOTES, action: 'create', title: 'Черновик', text: 'идеи' })
  const draft = (saved.get('notes') as any[]).find((p) => p.title === 'Черновик')
  await backToNotes(ui)
  await ui.press({ key: `arcade-note-page-${draft.id}` })
  expect(await ui.find({ key: 'arcade-note-ctx' })).toMatchObject({ props: { label: '☐ Контекст для папки: web' } })
  expect(await shown(ui, 'Сейчас у папки другая страница: «Заметки api» — отметка заменит её.')).toBe(true)

  // Сняли отметку — в новой сессии раздела нет; у api привязка осталась
  await backToNotes(ui)
  await ui.press({ key: 'arcade-note-page-pn' })
  await ui.press({ key: 'arcade-note-ctx' })
  expect((saved.get('ctx') as any).dirs['c:/demo/web']).toBeUndefined()
  expect((saved.get('ctx') as any).dirs['c:/demo/api']).toBeDefined()
  agents.sid = 'sess-w3'
  expect(await section($)).toBeUndefined()
  await ui.unmount()
})

test('контекст папки: страница длиннее 8000 знаков — в раздел только начало, на странице предупреждение', async ($, on) => {
  const long = Array.from({ length: 400 }, (_, i) => `Решение ${i}: ${'подробности '.repeat(3)}`).join('\n')
  const agents = { sid: 'sess-l', root: API }
  const { clock } = stubs(on, { env: ENV, agents, stored: { notes: [{ ...PAGE, body: long }], ctx: bound(API) } })
  engine(on)
  await start($)
  await clock.advance(200)
  const s = await section($)
  expect(s.text).toContain('Решение 0:')
  expect(s.text).not.toContain('Решение 399:')
  expect(s.text).toContain(`The page is longer than ${CTX_MAX} characters: only its beginning is above.`)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await openPage(ui, 'pn')
  expect(await ui.find({ key: 'arcade-note-ctx' })).toMatchObject({ props: { label: '☑ Контекст для папки: api' } })
  expect(await ui.find({ type: 'Text', text: `Страница длиннее ${CTX_MAX} знаков: в контекст пойдёт только начало.` })).toMatchObject({ props: { color: 'warning' } })
  await ui.unmount()
})

test('контекст папки: чужая правка общей страницы — в раздел прежняя версия, пока человек не возьмёт новую', async ($, on) => {
  const agents = { sid: 'sess-f1', root: API }
  const ctx = bound(API, { ok: { title: 'Заметки api', body: 'API слушает порт 3000.' }, by: '' })
  const { clock, saved } = stubs(on, { env: ENV, agents, stored: { notes: [PAGE], ctx } })
  engine(on)
  await start($)
  await clock.advance(200)
  const s = await section($)
  expect(s.text).toContain('API слушает порт 3000.')
  expect(s.text).not.toContain('8080')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await openPage(ui, 'pn')
  expect(await ui.find({ type: 'Text', text: 'Изменено другим участником — в контекст пока идёт прежняя версия.' })).toMatchObject({ props: { color: 'warning' } })
  expect(await ui.find({ key: 'arcade-note-ctx-take' })).toMatchObject({ props: { label: 'Взять эту версию в контекст' } })
  await ui.press({ key: 'arcade-note-ctx-take' })
  expect((saved.get('ctx') as any).dirs['c:/demo/api']).toEqual({ path: API, page: 'pn', at: 1 })
  expect(await ui.find({ key: 'arcade-note-ctx-take' })).toBeUndefined()
  // Эта сессия — с прежней версией до конца; новая — с правкой
  expect((await section($)).text).toContain('порт 3000.')
  agents.sid = 'sess-f2'
  expect((await section($)).text).toContain('порт 8080.')
  await ui.unmount()
})

test('контекст папки: без отметки в промпте ничего; у карточки доски переключатель есть, у самой доски нет', async ($, on) => {
  const agents = { sid: 'sess-n', root: API }
  const board = { id: 'pb', title: 'Спринт', body: '', parent: null, at: 2, board: { cols: [{ id: 'todo' }, { id: 'doing' }, { id: 'done' }] } }
  const card = { id: 'cb', title: 'Логин', body: 'Вход через GitHub.', parent: 'pb', at: 3, col: 'todo', pos: 0 }
  const { clock, saved } = stubs(on, { env: ENV, agents, stored: { notes: [PAGE, board, card] } })
  engine(on)
  await start($)
  await clock.advance(200)
  expect(await section($)).toBeUndefined()
  expect(saved.get('ctx')).toBeUndefined()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-boards' })
  await ui.press({ key: 'arcade-desk-pb' })
  await clock.advance(200)
  expect(await ui.find({ key: 'arcade-note-ctx' })).toBeUndefined()
  // Первое нажатие выбирает карточку, второе — открывает
  await ui.press({ key: 'arcade-card-cb' })
  await ui.press({ key: 'arcade-card-cb' })
  await clock.advance(200)
  expect(await ui.find({ key: 'arcade-note-ctx' })).toMatchObject({ props: { label: '☐ Контекст для папки: api' } })
  await ui.press({ key: 'arcade-note-ctx' })
  expect((saved.get('ctx') as any).dirs['c:/demo/api']).toMatchObject({ path: API, page: 'cb' })
  agents.sid = 'sess-n2'
  expect((await section($)).text).toContain('Page "Логин" (id cb):\n--- page start ---\nВход через GitHub.\n--- page end ---')
  await ui.unmount()
})
