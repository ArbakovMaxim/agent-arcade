// Arcade: итоги дня — журнал того, что ушло Claude и что сделано в блокноте, и текст страницы «Итоги» из него.
import { dayKey } from './calendar.js'
import { checkStats, columnOf, isBoard, isPrompts, notesOrder } from './notes.js'

export const LOG_DAYS = 14 // сколько дней журнал помнит: «в работе» — и то, что отдали Claude за это время
export const LOG_MAX = 500 // записей в журнале, не больше
const DAY_MS = 86_400_000
const ID = /^[a-z0-9]{1,20}$/ // как у страниц блокнота

// Запись журнала { at, kind, id, title, board?, by?, n? }:
//   gave — страницу или карточку отдали Claude;
//   done — карточку перенесли в последнюю колонку доски (by: claude — его инструментом блокнота, me — с экрана);
//   checked — на странице отметили n пунктов чек-листа (by — так же);
//   check — очередь проверила карточку командой доски: ok — прошла, code — код выхода (-1 — время вышло или не
//   запустилась), cmd — команда, tail — последние строки вывода.
// title и board — названия на тот момент: страницу могли потом удалить
const KINDS = ['gave', 'done', 'checked', 'check']
export function restoreLog(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const x of raw.slice(-LOG_MAX)) {
    if (!x || !KINDS.includes(x.kind) || !Number.isFinite(x.at) || typeof x.id !== 'string' || !ID.test(x.id) || typeof x.title !== 'string' || !x.title) continue
    const entry = { at: x.at, kind: x.kind, id: x.id, title: x.title.slice(0, 80) }
    if (typeof x.board === 'string' && x.board) entry.board = x.board.slice(0, 80)
    if (x.by === 'claude' || x.by === 'me') entry.by = x.by
    if (x.kind === 'checked') entry.n = Number.isInteger(x.n) && x.n > 0 ? x.n : 1
    if (x.kind === 'check') {
      entry.ok = x.ok === true
      entry.code = Number.isInteger(x.code) ? x.code : -1
      entry.cmd = typeof x.cmd === 'string' ? x.cmd.slice(0, 200) : ''
      entry.tail = typeof x.tail === 'string' ? x.tail.split('\n').slice(-5).join('\n').slice(-400) : ''
    }
    out.push(entry)
  }
  return out
}

// Новые записи к журналу; старше LOG_DAYS — прочь
export function addLog(log, entries, now) {
  if (!entries.length) return log
  const from = now - LOG_DAYS * DAY_MS
  return [...log, ...entries].filter((x) => x.at >= from).slice(-LOG_MAX)
}

// Что поменялось в блокноте для итогов: карточки, ушедшие в последнюю колонку своей доски, и отмеченные пункты
// чек-листов. by — кто правил: claude или me
export function noteChanges(before, after, at, by) {
  const old = new Map(before.map((p) => [p.id, p]))
  const boards = new Map(after.filter(isBoard).map((b) => [b.id, b]))
  const out = []
  for (const p of after) {
    const was = old.get(p.id)
    if (!was || isBoard(p)) continue
    const board = p.parent ? boards.get(p.parent) : null
    if (isPrompts(board)) continue
    const where = board ? { board: board.title } : {}
    if (board) {
      const cols = board.board.cols
      const last = cols.at(-1).id
      if (columnOf(p, cols) === last && columnOf(was, cols) !== last) out.push({ at, kind: 'done', id: p.id, title: p.title, ...where, by })
    }
    const n = checkStats(p.body).done - checkStats(was.body).done
    if (n > 0) out.push({ at, kind: 'checked', id: p.id, title: p.title, ...where, by, n })
  }
  return out
}

// Итоги дня day («ГГГГ-ММ-ДД») по журналу и блокноту сейчас: gave — что отдали Claude, done — какие карточки
// закончены, checked — где сколько пунктов отмечено, checks — проверки между карточками (последняя у карточки), doing —
// что ещё в работе. Названия — нынешние, если страница
// жива. me — мой номер аккаунта: на общей доске в работе только то, что взял я или отдал своему Claude
export function daySummary(log, notes, day, me = '') {
  const pages = new Map(notes.map((p) => [p.id, p]))
  const today = log.filter((x) => dayKey(x.at) === day)
  const item = (x) => {
    const p = pages.get(x.id)
    const board = p?.parent ? pages.get(p.parent) : null
    return { id: x.id, title: p?.title ?? x.title, board: isBoard(board) ? board.title : p ? '' : (x.board ?? '') }
  }
  // По одной записи на страницу: у «сделано» — кто сделал последним, у отмеченных — сколько всего, но не больше,
  // чем отмечено сейчас (пункт могли снять и отметить снова)
  const once = (kind) => {
    const seen = new Map()
    for (const x of today.filter((e) => e.kind === kind)) seen.set(x.id, { ...item(x), by: x.by ?? 'me', n: (seen.get(x.id)?.n ?? 0) + (x.n ?? 0) })
    return [...seen.values()]
  }
  const gave = once('gave').map(({ id, title, board }) => ({ id, title, board }))
  const checks = once('check').map((x) => {
    const last = today.filter((e) => e.kind === 'check' && e.id === x.id).at(-1)
    return { id: x.id, title: x.title, board: x.board, ok: last.ok, code: last.code, cmd: last.cmd, tail: last.tail, at: last.at }
  })
  // Карточка не прошла проверку позже, чем её перенесли в последнюю колонку, — она не сделана
  const failed = new Map(checks.filter((x) => !x.ok).map((x) => [x.id, x.at]))
  const doneAt = (id) => today.filter((e) => e.kind === 'done' && e.id === id).at(-1)?.at ?? 0
  const done = once('done').filter((x) => !(failed.get(x.id) >= doneAt(x.id)))
  const finished = new Set(done.map((x) => x.id))
  const checked = once('checked')
    .filter((x) => !finished.has(x.id))
    .map((x) => {
      const p = pages.get(x.id)
      return p ? { ...x, n: Math.min(x.n, checkStats(p.body).done) } : x
    })
    .filter((x) => x.n > 0)
  const given = new Set(log.filter((x) => x.kind === 'gave').map((x) => x.id))
  const doing = []
  for (const p of notesOrder(notes)) {
    const board = p.parent ? pages.get(p.parent) : null
    if (isBoard(p) || isPrompts(board)) continue
    if (isBoard(board)) {
      const cols = board.board.cols
      const col = columnOf(p, cols)
      if (col === cols.at(-1).id) continue
      const mine = given.has(p.id) || (me && p.taken === me) || (!board.board.share && col !== cols[0].id)
      if (mine) doing.push({ id: p.id, title: p.title, board: board.title, col: cols.find((c) => c.id === col) })
    } else if (given.has(p.id)) {
      const { done: ticked, total } = checkStats(p.body)
      if (total && ticked < total) doing.push({ id: p.id, title: p.title, board: '', left: total - ticked })
    }
  }
  return { gave, done, checked, checks: checks.map(({ at, ...x }) => x), doing }
}

// Текст страницы «Итоги» — разделами; t — перевод фразы, colName — название колонки. Названия страниц — как есть
export function summaryBody(sum, t, colName) {
  const on = (x) => (x.board ? ` · ${t('доска')} «${x.board}»` : '')
  const who = (x) => (x.by === 'claude' ? ' · Claude' : '')
  const part = (title, lines) => [`## ${t(title)}`, ...(lines.length ? lines : [t('Пусто.')]), '']
  // Проверки между карточками — разделом, только когда они были
  const checks = sum.checks ?? []
  const checkLines = checks.map((x) =>
    [
      `- ${x.ok ? '✓' : '✗'} ${x.title}${on(x)}: \`${x.cmd}\`${x.ok ? '' : ` — ${x.code >= 0 ? `${t('код')} ${x.code}` : t('время вышло или команда не запустилась')}`}`,
      ...(x.ok || !x.tail ? [] : x.tail.split('\n').map((l) => `    ${l}`)),
    ].join('\n'),
  )
  return [
    ...part(
      'Отдано Claude',
      sum.gave.map((x) => `- ${x.title}${on(x)}`),
    ),
    ...part('Сделано', [
      ...sum.done.map((x) => `- ✓ ${x.title}${on(x)}${who(x)}`),
      ...sum.checked.map((x) => `- ${x.title}${on(x)}: ${t('отмечено пунктов')} — ${x.n}${who(x)}`),
    ]),
    ...part(
      'В работе',
      sum.doing.map((x) => `- ${x.title}${on(x)}${x.col ? `, ${t('колонка')} «${colName(x.col)}»` : ''}${x.left ? `: ${t('осталось пунктов')} — ${x.left}` : ''}`),
    ),
    ...(checkLines.length ? part('Проверки между карточками', checkLines) : []),
  ]
    .join('\n')
    .trimEnd()
}

// Страницу — в чат: заголовки — строкой с двоеточием, чек-лист — значками. Не длиннее max знаков
export function chatText(page, max) {
  const lines = page.body.split('\n').map((l) =>
    l
      .replace(/^#{1,6}\s+(.*?):?\s*$/, '$1:')
      .replace(/^(\s*)[-*]\s+\[[xX]\]\s+/, '$1✓ ')
      .replace(/^(\s*)[-*]\s+\[ \]\s+/, '$1☐ '),
  )
  const text = [page.title, '', ...lines].join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const chars = [...text]
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text
}
