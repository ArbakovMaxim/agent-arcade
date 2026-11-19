// Ревью по карточке (п. 37): что поменялось, пока Claude делал карточку, «Принять» и «Вернуть с комментарием». Отдельный
// файл — у каждого файла тестов свой предел времени
import { expect } from 'claude-code/testing'
import { SYNC_KEYS } from '../hooks/account.js'
import { dayKey } from '../hooks/calendar.js'
import { daySummary, restoreLog, summaryBody } from '../hooks/daylog.js'
import { columnOf, isBoard } from '../hooks/notes.js'
import { AGENT_TICK_MS, CLAIM_MS } from '../hooks/register.js'
import { cleanComment, cutDiff, lastComment, lineDiff, pickSlot, restoreDetail, restoreReviews, returnLine, reviewMark, reviewed, splitPatch, unquotePath, unreview } from '../hooks/review.js'
import { PANE, WINDOWS, stubs, start, test } from './kit.ts'

const NOTES = 'mcp__arcade__notes'
async function noteKey(ui: any, prefix: string) {
  let found: string | undefined
  const walk = (n: any) => {
    if (found || !n || typeof n !== 'object') return
    const key = n.props?.key ?? n.key
    if (typeof key === 'string' && key.startsWith(prefix)) found = key
    for (const c of n.children ?? []) walk(c)
  }
  walk(await ui.drawn())
  return found
}
async function noteInput(ui: any, prefix: string, text: string, kind?: string) {
  const key = await noteKey(ui, prefix)
  if (!key) throw new Error(`нет поля ${prefix}`)
  return ui.input({ key, text, ...(kind ? { kind } : {}) })
}

// Сессия на этом компьютере: отметки «Агентов» и папка подробностей ревью — в домашней папке
const AG_ENV = { ...WINDOWS, USERPROFILE: 'C:\\Users\\max' }
const AG_DIR = 'C:\\Users\\max\\.claude\\arcade\\agents'
const AG_ME = { sid: 'sess-me', root: 'D:\\work\\web' }
const agentSlots = (disk: Map<string, any>) =>
  [...disk.entries()].flatMap(([k, v]) => {
    const m = /[\\/]agents[\\/]s(\d+)\.json$/.exec(k)
    return m ? [{ slot: Number(m[1]), rec: JSON.parse(v) }] : []
  })
const agentFile = (putFile: any, clock: any, disk: Map<string, any>) => (slot: number, rec: any) => {
  const mine = agentSlots(disk).find((x) => x.rec.sid === AG_ME.sid)?.slot
  putFile(`${AG_DIR}\\s${slot === mine ? 32 : slot}.json`, JSON.stringify({ v: 1, sid: 'sess-x', name: 'api', path: 'D:\\work\\api', status: 'idle', since: 0, card: null, queue: null, claim: null, ...rec, at: clock.now() }))
}

// git папки D:\work\web: что ответить на rev-parse, status, diff и log. repo: false — папка не в git
const HEAD0 = 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0'
const gitRepo = () => {
  const g = { repo: true, head: HEAD0, status: '', numstat: '', patch: '', log: '' }
  const answer = (argv: string[]) => {
    if (!g.repo) return { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' }
    const ok = (stdout: string) => ({ exitCode: 0, stdout, stderr: '' })
    const cmd = argv[4]
    if (cmd === 'rev-parse') return argv.includes('--verify') ? ok(`${g.head}\n`) : ok('D:/work/web\n.git\n')
    if (cmd === 'status') return ok((argv.includes('-b') ? '## main\0' : '') + g.status)
    if (cmd === 'diff') return ok(argv.includes('--numstat') ? g.numstat : g.patch)
    if (cmd === 'log') return ok(g.log)
    return { exitCode: 1, stdout: '', stderr: 'unexpected' }
  }
  return { g, answer }
}

const APP_PATCH = 'diff --git a/src/app.js b/src/app.js\nindex 1111111..2222222 100644\n--- a/src/app.js\n+++ b/src/app.js\n@@ -1,2 +1,3 @@\n const a = 1\n-const b = 2\n+const b = 3\n+const c = 4\n'
const LONG_PATCH = `diff --git a/src/long.js b/src/long.js\nnew file mode 100644\n--- /dev/null\n+++ b/src/long.js\n@@ -0,0 +1,160 @@\n${Array.from({ length: 160 }, (_, i) => `+line ${i + 1}`).join('\n')}\n`

// Доска Sprint с карточками, сессия в D:\work\web с git; панель — на доске
async function setup($: any, on: any, titles: string[], extra: any = {}) {
  const { g, answer } = gitRepo()
  const kit = stubs(on, { env: AG_ENV, agents: { ...AG_ME, git: answer }, submit: true, ...extra })
  const { clock, saved, submits } = kit
  await start($)
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pages = () => saved.get('notes') as any[]
  const page = (title: string) => pages().find((p) => p.title === title)
  const board = () => pages().find(isBoard)
  const col = (title: string) => columnOf(page(title), board().board.cols)
  const card = (n: number) => submits[n].text.match(/\(id (\w+)\)/)[1]
  const done = (title: string) => $.tool.call({ tool: NOTES, action: 'move', page: page(title).id, column: 'done' })
  const turn = async (id: string, n: number, work: () => Promise<unknown>) => {
    await $.turn.start({ turnId: id, text: submits[n].text })
    await work()
    await $.turn.complete({ turnId: id, answer: '', reason: 'answer' })
    await clock.advance(10)
  }
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  // Карточка открывается вторым нажатием; уже выбранная — первым
  const openCard = async (title: string) => {
    const key = `arcade-card-${page(title).id}`
    await ui.press({ key })
    if (await ui.find({ key })) await ui.press({ key })
  }
  const toBoard = async () => {
    if (await ui.find({ key: 'arcade-back' })) await ui.press({ key: 'arcade-back' })
  }
  const reviews = () => (saved.get('cardReview') ?? {}) as any
  await $.tool.call({ tool: NOTES, action: 'create', title: 'Sprint', board: true })
  for (const title of titles) await $.tool.call({ tool: NOTES, action: 'create', title, parent: 'Sprint', ...(title === 'A' ? { text: 'Форма входа' } : {}) })
  await ui.press({ key: 'arcade-menu-boards' })
  await ui.press({ key: `arcade-desk-${board().id}` })
  return { ...kit, g, ui, pages, page, board, col, card, done, turn, text, openCard, toBoard, reviews }
}

test('ревью: сделанная карточка — файлы, +/− строк и коммиты под ней, diff по файлу; «Принять» только помечает', async ($, on) => {
  const { g, ui, clock, saved, submits, gits, putFile, diskFile, page, done, turn, text, openCard, toBoard, reviews } = await setup($, on, ['A', 'B'])
  // notes.md был изменён ещё до карточки — его считаем от тогдашней копии, а не от HEAD
  g.status = ' M notes.md\0'
  putFile('D:\\work\\web\\notes.md', 'one\ntwo\n')
  await openCard('A')
  await ui.press({ key: 'arcade-note-send' })
  expect(submits.length).toBe(1)
  const A = page('A').id

  await turn('t1', 0, async () => {
    putFile('D:\\work\\web\\notes.md', 'one\ntwo\nthree\n')
    putFile('D:\\work\\web\\src\\new.js', 'a\nb\nc\n')
    g.status = ' M notes.md\0 M src/app.js\0?? src/new.js\0'
    g.numstat = '3\t0\tnotes.md\0' + '2\t1\tsrc/app.js\0' + '160\t0\tsrc/long.js\0'
    g.patch = APP_PATCH + LONG_PATCH
    g.log = 'abc1234\tAdd login form\n'
    await done('A')
  })

  // На доске под карточкой — строка с числами: notes.md +1, app.js +2 −1, long.js +160, new.js +3
  await toBoard()
  expect(await ui.find({ key: `arcade-card-review-${A}` })).toMatchObject({ props: { label: '  файлов: 4 · +166 −1' } })
  await ui.press({ key: `arcade-card-review-${A}` })
  expect(await ui.find({ key: 'arcade-review-files' })).toMatchObject({ props: { label: '▾ файлов: 4 · +166 −1 · коммитов: 1' } })
  const files = await Promise.all([0, 1, 2, 3].map(async (i) => (await ui.find({ key: `arcade-review-file-${i}` }))?.props.label))
  expect(files).toEqual(['▸ notes.md · +1 −0', '▸ src/app.js · +2 −1', '▸ src/long.js · +160 −0', '▸ src/new.js · новый · +3'])
  expect(await text('  abc1234 Add login form')).toBeDefined()

  // diff файла — по нажатию: удалённое красным, добавленное зелёным, заголовок куска тусклым
  await ui.press({ key: 'arcade-review-file-1' })
  expect(await ui.find({ key: 'arcade-review-file-1' })).toMatchObject({ props: { label: '▾ src/app.js · +2 −1' } })
  expect(await text('-const b = 2')).toMatchObject({ props: { color: 'error' } })
  expect(await text('+const b = 3')).toMatchObject({ props: { color: 'success' } })
  expect(await text('@@ -1,2 +1,3 @@')).toMatchObject({ props: { dimColor: true } })
  // Длинный diff обрезан: 150 строк из 161
  await ui.press({ key: 'arcade-review-file-2' })
  expect(await text('… обрезано, ещё строк: 11')).toBeDefined()
  expect(await text('+line 149')).toBeDefined()
  expect(await text('+line 150')).toBeUndefined()

  // Подробности — файлом этого компьютера, числа — в $.store (с сайтом не синхронизируется)
  const detail = JSON.parse(diskFile('review\\r1.json'))
  expect(detail).toMatchObject({ v: 1, id: A, commits: ['abc1234 Add login form'] })
  expect(detail.files.map((f: any) => f.path)).toEqual(['notes.md', 'src/app.js', 'src/long.js', 'src/new.js'])
  expect(reviews()[A]).toMatchObject({ git: true, n: 4, add: 166, del: 1, commits: 1, mixed: '', slot: 1, state: '', cut: false })
  expect(SYNC_KEYS).not.toContain('cardReview')
  for (const raw of [JSON.stringify(saved.get('notes')), JSON.stringify(reviews())]) {
    expect(raw).not.toContain('const b')
    expect(raw).not.toContain('app.js')
  }

  // «Принять» — пометка в тексте карточки; ни коммита, ни отправки
  await ui.press({ key: 'arcade-review-accept' })
  expect(page('A').body).toBe('✓ Принято\n\nФорма входа')
  expect(await text('Принято. Arcade ничего не коммитит и не отправляет.')).toBeDefined()
  expect(await text('✓ принято')).toMatchObject({ props: { color: 'success' } })
  expect(await ui.find({ key: 'arcade-review-accept' })).toBeUndefined()
  expect(reviews()[A].state).toBe('accepted')
  expect((saved.get('daylog') as any[]).filter((x) => x.kind === 'accept').map((x) => [x.id, x.title, x.board])).toEqual([[A, 'A', 'Sprint']])
  await toBoard()
  expect(await text('  ✓ принято')).toBeDefined()

  // git — только чтение
  expect(gits.length).toBeGreaterThan(0)
  for (const argv of gits) {
    expect(argv[1]).toBe('--no-optional-locks')
    expect(['rev-parse', 'status', 'diff', 'log']).toContain(argv[4])
  }
  expect(submits.length).toBe(1)
  await ui.unmount()
})

test('ревью: «Вернуть с комментарием» — без комментария нельзя; карточка во «В работе», Claude получает комментарий; занят — в конце хода', async ($, on) => {
  const { g, ui, clock, saved, submits, putFile, page, col, done, turn, text, openCard, toBoard, reviews } = await setup($, on, ['A', 'B'])
  g.status = ' M notes.md\0'
  putFile('D:\\work\\web\\notes.md', 'one\ntwo\n')
  await openCard('A')
  await ui.press({ key: 'arcade-note-send' })
  const A = page('A').id
  await turn('t1', 0, async () => {
    putFile('D:\\work\\web\\notes.md', 'one\ntwo\nthree\n')
    await done('A')
  })
  expect(reviews()[A]).toMatchObject({ n: 1, add: 1, del: 0 })

  // Панель всё ещё на карточке: «Вернуть с комментарием» открывает поле; пустой комментарий не принимается
  await ui.press({ key: 'arcade-review-return' })
  await noteInput(ui, 'arcade-review-comment-', '  ')
  expect(await text('Напиши, что поправить, — без комментария не вернуть.')).toBeDefined()
  expect(col('A')).toBe('done')
  await noteInput(ui, 'arcade-review-comment-', 'Добавь тест\nна пустой пароль')
  expect(col('A')).toBe('doing')
  expect(page('A').body).toMatch(/^↩ Вернули\n\nФорма входа\n\n↩ Вернули \d\d\.\d\d \d\d:\d\d: Добавь тест на пустой пароль$/)
  // Claude свободен — карточка ушла сразу, с комментарием отдельной строкой
  expect(submits.length).toBe(2)
  expect(submits[1].text).toContain('Карточку вернули после ревью с комментарием: «Добавь тест на пустой пароль». Исправь по комментарию и снова перенеси карточку в последнюю колонку.')
  expect(reviews()[A].state).toBe('returned')
  expect((saved.get('daylog') as any[]).filter((x) => x.kind === 'return').map((x) => [x.id, x.comment])).toEqual([[A, 'Добавь тест на пустой пароль']])
  await toBoard()
  expect(await text(/^ {2}↩ вернули/)).toMatchObject({ props: { color: 'warning' } })

  // Сделал снова — числа от той же точки, что и в первый раз; прежние — строкой «До возврата»; пометка ↩ снята
  await turn('t2', 1, async () => {
    putFile('D:\\work\\web\\notes.md', 'one\ntwo\nthree\nfour\n')
    await done('A')
  })
  expect(await ui.find({ key: `arcade-card-review-${A}` })).toMatchObject({ props: { label: '  файлов: 1 · +2 −0' } })
  expect(await text(/^ {2}↩ вернули/)).toBeUndefined()
  expect(reviewMark(page('A').body)).toBe('')
  expect(lastComment(page('A').body)).toBe('Добавь тест на пустой пароль')
  await openCard('A')
  expect(await text('До возврата: файлов: 1 · +1 −0')).toBeDefined()

  // Claude занят другой карточкой — вернутую он получит в конце хода
  await toBoard()
  await openCard('B')
  await ui.press({ key: 'arcade-note-send' })
  expect(submits.length).toBe(3)
  await $.turn.start({ turnId: 't3', text: submits[2].text })
  await toBoard()
  await openCard('A')
  await ui.press({ key: 'arcade-review-return' })
  await noteInput(ui, 'arcade-review-comment-', 'Ещё раз')
  expect(await text('Вернули. Claude получит её, когда закончит ход.')).toBeDefined()
  expect(submits.length).toBe(3)
  await $.turn.complete({ turnId: 't3', answer: '', reason: 'answer' })
  await clock.advance(10)
  expect(submits.length).toBe(4)
  expect(submits[3].text).toContain(`(id ${A})`)
  expect(submits[3].text).toContain('Карточку вернули после ревью с комментарием: «Ещё раз».')
  await ui.unmount()
})

test('ревью: в очереди вернутая карточка идёт первой, потом очередь дальше', async ($, on) => {
  const { ui, clock, submits, page, col, card, done, turn, text } = await setup($, on, ['A', 'B', 'C'])
  const pressClaim = async (key: string) => {
    const pressed = ui.press({ key })
    await clock.advance(CLAIM_MS + 100)
    await pressed
  }
  await pressClaim('arcade-board-queue')
  expect(card(0)).toBe(page('A').id)
  await turn('t1', 0, () => done('A'))
  await clock.advance(CLAIM_MS + 100)
  expect(card(1)).toBe(page('B').id)

  // Пока Claude делает B, A вернули с доски — очередь даст её следующей
  await turn('t2', 1, async () => {
    await ui.press({ key: `arcade-card-review-${page('A').id}` })
    await ui.press({ key: 'arcade-review-return' })
    await noteInput(ui, 'arcade-review-comment-', 'Поправь отступы')
    expect(await text('Вернули. Очередь даст её Claude первой.')).toBeDefined()
    expect(col('A')).toBe('doing')
    await done('B')
  })
  await clock.advance(CLAIM_MS + 100)
  expect(submits.length).toBe(3)
  expect(card(2)).toBe(page('A').id)
  expect(submits[2].text).toContain('Карточку вернули после ревью с комментарием: «Поправь отступы».')
  await turn('t3', 2, () => done('A'))
  await clock.advance(CLAIM_MS + 100)
  expect(card(3)).toBe(page('C').id)
  await ui.unmount()
})

test('ревью: в той же папке работала другая сессия — «не разобрать, чьи изменения»', async ($, on) => {
  const { ui, clock, disk, putFile, page, done, turn, text, openCard, reviews } = await setup($, on, ['A'])
  const rival = agentFile(putFile, clock, disk)
  rival(5, { sid: 'sess-d', name: 'docs', path: 'D:\\work\\web', status: 'working' })
  await clock.advance(AGENT_TICK_MS)
  await openCard('A')
  await ui.press({ key: 'arcade-note-send' })
  await turn('t1', 0, () => done('A'))
  expect(reviews()[page('A').id].mixed).toBe('docs')
  expect(await text('В этой папке работала и сессия «docs» — не разобрать, чьи изменения.')).toMatchObject({ props: { color: 'warning' } })
  await ui.unmount()
})

test('ревью: папка не в git — без чисел и списка, «Принять» и «Вернуть» на месте', async ($, on) => {
  const { g, ui, page, done, turn, text, openCard, toBoard, reviews } = await setup($, on, ['A'])
  g.repo = false
  await openCard('A')
  await ui.press({ key: 'arcade-note-send' })
  await turn('t1', 0, () => done('A'))
  const A = page('A').id
  expect(reviews()[A]).toMatchObject({ git: false, n: 0, slot: 0 })
  expect(await text('Папка не в git — изменений не посчитать.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-review-files' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-review-accept' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-review-return' })).toBeDefined()
  await toBoard()
  expect(await ui.find({ key: `arcade-card-review-${A}` })).toBeUndefined()
  await ui.unmount()
})

test('ревью: построчный diff, обрезка, разбор git diff', async () => {
  expect(lineDiff('one\ntwo\n', 'one\ntwo\nthree\n')).toEqual({ text: '@@ -1,2 +1,3 @@\n one\n two\n+three', add: 1, del: 0 })
  const L = Array.from({ length: 20 }, (_, i) => `L${i + 1}`)
  const M = L.map((s) => (s === 'L2' ? 'X2' : s === 'L18' ? 'X18' : s))
  expect(lineDiff(`${L.join('\n')}\n`, `${M.join('\n')}\n`)).toEqual({ text: '@@ -1,5 +1,5 @@\n L1\n-L2\n+X2\n L3\n L4\n L5\n@@ -15,6 +15,6 @@\n L15\n L16\n L17\n-L18\n+X18\n L19\n L20', add: 2, del: 2 })
  expect(lineDiff('a\nb\n', '')).toEqual({ text: '@@ -1,2 +0,0 @@\n-a\n-b', add: 0, del: 2 })
  expect(lineDiff('', 'a\nb\nc\n')).toEqual({ text: '@@ -0,0 +1,3 @@\n+a\n+b\n+c', add: 3, del: 0 })
  expect(lineDiff('x\n', 'x\n')).toEqual({ text: '', add: 0, del: 0 })

  expect(cutDiff('')).toEqual({ text: '', cut: 0 })
  expect(cutDiff(Array.from({ length: 200 }, (_, i) => `+${i}`).join('\n')).cut).toBe(50)
  const wide = cutDiff(Array.from({ length: 20 }, () => 'x'.repeat(1000)).join('\n'))
  expect([wide.text.split('\n').length, wide.cut]).toEqual([11, 9])

  const parts = splitPatch(APP_PATCH + LONG_PATCH)
  expect([...parts.keys()]).toEqual(['src/app.js', 'src/long.js'])
  expect(parts.get('src/app.js')).toEqual({ diff: '@@ -1,2 +1,3 @@\n const a = 1\n-const b = 2\n+const b = 3\n+const c = 4', bin: false })
  expect(parts.get('src/long.js')!.diff.split('\n')[0]).toBe('@@ -0,0 +1,160 @@')
  expect([...splitPatch('diff --git a/img.png b/img.png\nindex 1..2 100644\nBinary files a/img.png and b/img.png differ\n')]).toEqual([['img.png', { diff: '', bin: true }]])
  expect([...splitPatch('diff --git "a/\\303\\244.txt" "b/\\303\\244.txt"\nindex 1..2 100644\n--- "a/\\303\\244.txt"\n+++ "b/\\303\\244.txt"\n@@ -1 +1 @@\n-a\n+b\n').keys()]).toEqual(['ä.txt'])
  expect(unquotePath('"a/\\303\\244.txt"')).toBe('a/ä.txt')
  expect(unquotePath('src/app.js')).toBe('src/app.js')
})

test('ревью: пометки ✓/↩ в тексте карточки, комментарий, итоги и подробности из хранилища', async () => {
  expect(reviewed('Форма', 'accepted', 'ru', 1000)).toBe('✓ Принято\n\nФорма')
  expect(reviewed('✓ Принято\n\nФорма', 'returned', 'ru', 1000)).toBe('↩ Вернули\n\nФорма')
  expect(reviewed('Form', 'accepted', 'en', 1000)).toBe('✓ Accepted\n\nForm')
  expect(reviewMark('✓ Accepted\n\nForm')).toBe('accepted')
  expect(unreview('✓ Принято\n\nФорма')).toBe('Форма')
  // Пометку ищем только в первых строках
  expect(reviewMark('a\nb\nc\n✓ Принято')).toBe('')

  expect(cleanComment('  a\n  b \r\n c  ')).toBe('a b c')
  expect(cleanComment('x'.repeat(600)).length).toBe(500)
  expect(returnLine('ru', '19.11 18:05', 'добавь тест')).toBe('↩ Вернули 19.11 18:05: добавь тест')
  expect(lastComment('↩ Вернули\n\nФорма\n\n↩ Вернули 18.11 10:00: первое\n↩ Вернули 19.11 18:05: второе')).toBe('второе')
  expect(lastComment('↩ Вернули')).toBe('')

  expect(restoreReviews({ 'BAD!': { at: 1 }, c1: { at: NaN }, c2: { at: 5, slot: 99, state: 'weird', prev: { n: 1, add: 2, del: 3 } } })).toEqual({
    c2: { at: 5, git: true, n: 0, add: 0, del: 0, commits: 0, mixed: '', top: '', slot: 0, prev: { n: 1, add: 2, del: 3, commits: 0 }, state: '', cut: false },
  })
  expect([pickSlot({}, 'a'), pickSlot({ a: { slot: 3, at: 1 } } as any, 'a'), pickSlot({ x: { slot: 1, at: 1 } } as any, 'a')]).toEqual([1, 3, 2])
  // Все места заняты — самое старое
  const all = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`c${i + 1}`, { slot: i + 1, at: 100 - (i + 1) }]))
  expect(pickSlot(all as any, 'new')).toBe(40)
  expect(restoreDetail({ id: 'c1', at: 7, files: [null, { path: 'a.js', add: 1, del: -2, state: 'zzz', diff: '+x' }, { path: 5 }], commits: ['abc x', 7] }, 'c1')).toEqual({
    id: 'c1',
    at: 7,
    files: [{ path: 'a.js', add: 1, del: 0, state: '', diff: '+x', cut: 0 }],
    more: 0,
    commits: ['abc x'],
  })
  expect(restoreDetail({ id: 'c1', files: [] }, 'c2')).toBeNull()
})

test('ревью: «Итоги дня» — сколько принято и вернули; последнее слово по карточке главное', async () => {
  const at = (h: number) => new Date(2026, 10, 19, h).getTime()
  const day = dayKey(at(10))
  const log = restoreLog([
    { at: at(9), kind: 'done', id: 'c1', title: 'Логин', board: 'Sprint' },
    { at: at(10), kind: 'accept', id: 'c1', title: 'Логин', board: 'Sprint' },
    { at: at(9), kind: 'done', id: 'c2', title: 'Тег', board: 'Sprint' },
    { at: at(11), kind: 'return', id: 'c2', title: 'Тег', board: 'Sprint', comment: 'добавь тест' },
    { at: at(12), kind: 'return', id: 'c3', title: 'Мост', board: 'Sprint', comment: 'x' },
    { at: at(13), kind: 'accept', id: 'c3', title: 'Мост', board: 'Sprint' },
  ])
  expect(log.find((x: any) => x.kind === 'return')?.comment).toBe('добавь тест')
  const sum = daySummary(log, [], day, '')
  expect(sum.accepted.map((x: any) => x.id)).toEqual(['c1', 'c3'])
  expect(sum.returned).toEqual([{ id: 'c2', title: 'Тег', board: 'Sprint', comment: 'добавь тест' }])
  // Вернули после «сделано» — уже не сделана
  expect(sum.done.map((x: any) => x.id)).toEqual(['c1'])
  const t = (text: string) => text
  expect(summaryBody(sum, t, (c: any) => c.id).split('\n\n').at(-1)).toBe('## Ревью карточек\nПринято — 2, вернули — 1.\n- ✓ Логин · доска «Sprint»\n- ✓ Мост · доска «Sprint»\n- ↩ Тег · доска «Sprint»: добавь тест')
})
