// Блокнот Arcade: страницы и подстраницы (два уровня), текст в духе Markdown — заголовки «# », пункты «- »,
// чек-листы «- [ ] » и «- [x] ». Хранится в $.store мода (ключ notes); Claude читает и дополняет блокнот
// инструментом mcp__arcade__notes — его ответы для модели, поэтому по-английски. Здесь нет вызовов Claude Code —
// хранилище, экраны и инструмент в hooks/register.js. Связь с Notion и другими приложениями — через коннекторы Claude:
// страница помнит, с чем связана (link: { app, url }), и текст до последней замены от Claude (prev) — для отмены.
// Доска проектов — тоже страница блокнота: с колонками (board: { cols, share? }), а её карточки — подстраницы с
// колонкой и местом в ней (col, pos). Общую доску (share — её номер на сайте) мод сверяет с друзьями: hooks/desks.js.

export const MAX_PAGES = 200
export const MAX_TITLE = 80
export const MAX_BODY = 20_000
// Весь блокнот — не больше полумиллиона знаков: $.store мода вмещает 4 МиБ на всё, там же каталог и настройки
export const MAX_TOTAL = 500_000
export const MAX_APP = 40
export const MAX_URL = 500
const ID = /^[a-z0-9]{1,20}$/
const CHECK = /^(\s*)[-*] \[( |x|X)\] ?(.*)$/
const BULLET = /^\s*[-*] (.*)$/
const HEAD = /^(#{1,3}) +(.*)$/
export const MAX_COLS = 8
export const MAX_COL = 30 // знаков в названии колонки
const COL_ID = /^[a-z0-9]{1,12}$/
export const SHARE_ID = /^b[A-Za-z0-9_-]{16}$/
// Колонки новой доски. Названия по умолчанию: на экране — по-русски (переводы — в i18n.js), для Claude — по-английски
export const DEFAULT_COLS = [{ id: 'todo' }, { id: 'doing' }, { id: 'done' }]
export const COL_NAMES = { todo: 'Сделать', doing: 'В работе', done: 'Готово' }
const COL_EN = { todo: 'To do', doing: 'Doing', done: 'Done' }

// Название — одной строкой, не длиннее max знаков; текст — с переводами строк. Без управляющих символов и знаков,
// переворачивающих направление текста: карточки общей доски пишут и друзья
export function cleanTitle(text, max = MAX_TITLE) {
  const line = String(text ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return [...line].slice(0, max).join('').trim()
}
export const cleanBody = (text) =>
  String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .slice(0, MAX_BODY)

// Связь с приложением: название и адрес страницы там (схема://…); не сходится — null
export function cleanLink(app, url) {
  const name = cleanTitle(app).slice(0, MAX_APP)
  const href = String(url ?? '').trim()
  if (!name || href.length > MAX_URL || !/^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(href)) return null
  return { app: name, url: href }
}

// Колонки доски: от одной до MAX_COLS, id латиницей без повторов, name — если своё (как на сайте). Не так — null
export function cleanCols(list) {
  if (!Array.isArray(list) || !list.length || list.length > MAX_COLS) return null
  const out = []
  for (const c of list) {
    if (!c || typeof c.id !== 'string' || !COL_ID.test(c.id) || out.some((x) => x.id === c.id)) return null
    const name = c.name === undefined ? '' : cleanTitle(c.name, MAX_COL)
    if (c.name !== undefined && !name) return null
    out.push(name ? { id: c.id, name } : { id: c.id })
  }
  return out
}

export const isBoard = (page) => Boolean(page && !page.parent && page.board)
// Колонка карточки; такой колонки на доске нет (её убрали) — первая
export const columnOf = (card, cols) => (cols.some((c) => c.id === card.col) ? card.col : cols[0].id)
// Карточки колонки сверху вниз
export function columnCards(notes, board, col) {
  return notes
    .filter((p) => p.parent === board.id && columnOf(p, board.board.cols) === col)
    .sort((a, b) => a.pos - b.pos || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
const boardCards = (notes, board) => board.board.cols.flatMap((c) => columnCards(notes, board, c.id))
// Место под последней карточкой колонки
const nextPos = (cards) => (cards.length ? Math.floor(Math.max(...cards.map((c) => c.pos))) + 1 : 0)
const boardFrom = (raw) => {
  const board = { cols: cleanCols(raw?.cols) ?? DEFAULT_COLS }
  if (typeof raw?.share === 'string' && SHARE_ID.test(raw.share)) board.share = raw.share
  return board
}

// Блокнот из $.store: что не сходится — пропускаем; подстраница без своей страницы — тоже
export function restoreNotes(saved) {
  if (!Array.isArray(saved)) return []
  const out = []
  const ids = new Set()
  for (const p of saved) {
    if (out.length >= MAX_PAGES) break
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !ID.test(p.id) || ids.has(p.id)) continue
    const title = cleanTitle(p.title)
    if (!title || typeof p.body !== 'string') continue
    const parent = typeof p.parent === 'string' ? p.parent : null
    ids.add(p.id)
    const page = { id: p.id, title, body: cleanBody(p.body), parent, at: Number.isFinite(p.at) ? p.at : 0 }
    const link = p.link && cleanLink(p.link.app, p.link.url)
    if (link) page.link = link
    if (typeof p.prev === 'string') page.prev = cleanBody(p.prev)
    if (!parent && p.board && typeof p.board === 'object') page.board = boardFrom(p.board)
    if (parent) Object.assign(page, { col: p.col, pos: p.pos })
    out.push(page)
  }
  const top = new Set(out.filter((p) => !p.parent).map((p) => p.id))
  const boards = new Map(out.filter((p) => p.board).map((p) => [p.id, p.board.cols]))
  // Карточке доски — колонка и место; у подстраницы обычной страницы их нет
  return out
    .filter((p) => !p.parent || top.has(p.parent))
    .map((p) => {
      if (!p.parent) return p
      const { col, pos, ...page } = p
      const cols = boards.get(p.parent)
      if (!cols) return page
      return { ...page, col: typeof col === 'string' && cols.some((c) => c.id === col) ? col : cols[0].id, pos: Number.isFinite(pos) ? pos : 0 }
    })
}

// Сколько знаков в блокноте; fits — блокнот после правки ещё помещается
export const notesSize = (notes) => notes.reduce((n, p) => n + p.title.length + p.body.length + (p.prev?.length ?? 0) + (p.link?.url.length ?? 0), 0)
export const fits = (notes) => notesSize(notes) <= MAX_TOTAL

// Порядок на экране: страница, под ней её подстраницы; карточки доски — по колонкам сверху вниз
export function notesOrder(notes) {
  return notes.filter((p) => !p.parent).flatMap((p) => [p, ...(p.board ? boardCards(notes, p) : notes.filter((c) => c.parent === p.id))])
}

// Новая страница — первой (подстраница — первой среди подстраниц своей). Карточка доски — в колонку col (нет такой —
// в первую), на место pos или под последнюю. Новая доска — board: { cols?, share? }. id — свой, если свободен (карточки
// общей доски приходят со своими). Не вышло — { error }
export function addPage(notes, { title, body = '', parent = null, id: wanted, col, pos, board }, now) {
  const name = cleanTitle(title)
  if (!name) return { error: 'empty' }
  if (notes.length >= MAX_PAGES) return { error: 'full' }
  const top = parent ? notes.find((p) => p.id === parent && !p.parent) : null
  if (parent && !top) return { error: 'parent' }
  let id = typeof wanted === 'string' && ID.test(wanted) && !notes.some((p) => p.id === wanted) ? wanted : ''
  if (!id) {
    const base = `p${Math.max(0, Math.floor(now)).toString(36)}`
    id = base
    for (let n = 1; notes.some((p) => p.id === id); n++) id = `${base}${n.toString(36)}`
  }
  const page = { id, title: name, body: cleanBody(body), parent: parent || null, at: now }
  if (top?.board) {
    page.col = columnOf({ col }, top.board.cols)
    page.pos = Number.isFinite(pos) ? pos : nextPos(columnCards(notes, top, page.col))
  } else if (!parent && board) page.board = boardFrom(board)
  return { notes: [page, ...notes], page }
}

// Перенести карточку: 'left' / 'right' или { col } — вниз другой колонки, 'up' / 'down' — на место в своей. Место —
// посередине между соседями, чтобы правка у друзей трогала одну карточку; середины не нашлось — колонка нумеруется
// заново. Некуда — блокнот как был
export function moveCard(notes, id, where, now) {
  const card = notes.find((p) => p.id === id)
  const board = card && notes.find((p) => p.id === card.parent && p.board)
  if (!board) return notes
  const cols = board.board.cols
  const here = columnOf(card, cols)
  const at = cols.findIndex((c) => c.id === here)
  if (where === 'left' || where === 'right' || typeof where?.col === 'string') {
    const to = typeof where?.col === 'string' ? where.col : cols[at + (where === 'left' ? -1 : 1)]?.id
    if (!to || to === here || !cols.some((c) => c.id === to)) return notes
    return updatePage(notes, id, { col: to, pos: nextPos(columnCards(notes, board, to)) }, now)
  }
  if (where !== 'up' && where !== 'down') return notes
  const list = columnCards(notes, board, here)
  const i = list.findIndex((p) => p.id === id)
  const j = where === 'up' ? i - 1 : i + 1
  if (j < 0 || j >= list.length) return notes
  const beyond = list[where === 'up' ? j - 1 : j + 1]
  const pos = beyond ? (list[j].pos + beyond.pos) / 2 : list[j].pos + (where === 'up' ? -1 : 1)
  if (Number.isFinite(pos) && pos !== list[j].pos && pos !== beyond?.pos) return updatePage(notes, id, { col: here, pos }, now)
  const order = list.map((p) => p.id)
  ;[order[i], order[j]] = [order[j], order[i]]
  const place = new Map(order.map((cid, n) => [cid, n]))
  return notes.map((p) => (place.has(p.id) && (p.pos !== place.get(p.id) || p.col !== here) ? { ...p, col: here, pos: place.get(p.id), at: now } : p))
}

// Колонки доски: добавить в конец (id — новый, латиницей), переименовать, убрать пустую (последнюю не убрать).
// Не вышло — { error: 'empty' | 'many' | 'busy' | 'last' }
const withCols = (notes, board, cols, now) => ({ notes: updatePage(notes, board.id, { board: { ...board.board, cols } }, now) })
const boardOf = (notes, id) => notes.find((p) => p.id === id && isBoard(p))
export function addColumn(notes, boardId, name, colId, now) {
  const board = boardOf(notes, boardId)
  const title = cleanTitle(name, MAX_COL)
  if (!board || !title || !COL_ID.test(colId) || board.board.cols.some((c) => c.id === colId)) return { error: 'empty' }
  if (board.board.cols.length >= MAX_COLS) return { error: 'many' }
  return withCols(notes, board, [...board.board.cols, { id: colId, name: title }], now)
}
export function renameColumn(notes, boardId, colId, name, now) {
  const board = boardOf(notes, boardId)
  const title = cleanTitle(name, MAX_COL)
  if (!board || !title) return { error: 'empty' }
  return withCols(notes, board, board.board.cols.map((c) => (c.id === colId ? { id: c.id, name: title } : c)), now)
}
export function removeColumn(notes, boardId, colId, now) {
  const board = boardOf(notes, boardId)
  if (!board) return { error: 'empty' }
  if (board.board.cols.length <= 1) return { error: 'last' }
  if (columnCards(notes, board, colId).length) return { error: 'busy' }
  return withCols(notes, board, board.board.cols.filter((c) => c.id !== colId), now)
}

// Страница и её подстраницы — прочь
export const removePage = (notes, id) => notes.filter((p) => p.id !== id && p.parent !== id)

export const updatePage = (notes, id, change, now) => notes.map((p) => (p.id === id ? { ...p, ...change, at: now } : p))

// Строки текста для экрана: заголовок, пункт чек-листа, пункт списка, текст или пустая; index — номер строки в тексте
export function noteLines(body) {
  return String(body ?? '')
    .split('\n')
    .map((line, index) => {
      const check = CHECK.exec(line)
      if (check) return { kind: 'check', text: check[3], done: check[2] !== ' ', index }
      const head = HEAD.exec(line)
      if (head) return { kind: head[1].length === 1 ? 'h1' : 'h2', text: head[2], index }
      const bullet = BULLET.exec(line)
      if (bullet) return { kind: 'bullet', text: bullet[1], index }
      return { kind: line.trim() ? 'text' : 'blank', text: line, index }
    })
}

// Отметить пункт чек-листа в строке index (done не задан — переключить)
export function toggleLine(body, index, done) {
  const lines = String(body ?? '').split('\n')
  const check = CHECK.exec(lines[index] ?? '')
  if (!check) return body
  const mark = (done ?? check[2] === ' ') ? 'x' : ' '
  lines[index] = `${check[1]}- [${mark}] ${check[3]}`
  return lines.join('\n')
}

export function checkStats(body) {
  const checks = noteLines(body).filter((l) => l.kind === 'check')
  return { done: checks.filter((l) => l.done).length, total: checks.length }
}

// Дописать в конец; не помещается — null
export function appendText(body, text) {
  const add = cleanBody(text).replace(/^\n+|\n+$/g, '')
  if (!add.trim()) return body
  const out = body && !body.endsWith('\n') ? `${body}\n${add}` : `${body}${add}`
  return out.length > MAX_BODY ? null : out
}

// Страница по id или по названию без регистра
export function findPage(notes, ref) {
  const key = String(ref ?? '').trim()
  if (!key) return null
  return notes.find((p) => p.id === key) ?? notes.find((p) => p.title.toLowerCase() === key.toLowerCase()) ?? null
}

const statsLabel = (body) => {
  const { done, total } = checkStats(body)
  return total ? ` (${done}/${total} done)` : ''
}
const linkLabel = (page) => (page.link ? ` [${page.link.app}]` : '')
// Название колонки для Claude: своё или английское по умолчанию
const colLabel = (col) => col.name ?? COL_EN[col.id] ?? col.id
const boardLabel = (page) => (page.board ? ` [board${page.board.share ? ', shared with friends' : ''}: ${page.board.cols.map(colLabel).join(', ')}]` : '')
// Колонка по id, своему названию или названию по умолчанию (по-английски или по-русски), без регистра
function findColumn(cols, ref) {
  const key = String(ref ?? '').trim().toLowerCase()
  if (!key) return null
  return cols.find((c) => c.id === key) ?? cols.find((c) => [colLabel(c), COL_NAMES[c.id]].some((n) => n && n.toLowerCase() === key)) ?? null
}
const columnList = (cols) => cols.map((c) => `"${colLabel(c)}"`).join(', ')

// Описание и схема инструмента для модели
export const NOTES_TOOL = {
  name: 'notes',
  description:
    "The user's Arcade notebook: pages with subpages, Markdown text and checklists (\"- [ ] item\"). " +
    'Use it when the user asks to note, plan or track something in their notebook, or sends you a note from it. ' +
    'Actions: list (pages with ids), read (one page), create (a page, or a subpage with parent), ' +
    'append (add lines to the end of a page), check (tick a checklist item by its number or text; done: false unticks), ' +
    'replace (the whole text of a page, e.g. with the text of the linked page from another app; the previous text is kept for the user to undo), ' +
    'link (connect a page to its copy in another app such as Notion: app and url of that page; create takes app and url too). ' +
    'Other apps are reached with their own connector tools, never from here. ' +
    'A project board is a page with columns (create with board: true makes one with To do, Doing, Done); its cards are its subpages: ' +
    'create a card with parent set to the board and column, move it with move (page and column); read a board to see its columns and cards. ' +
    'A board shared with friends syncs with them, so cards may change between calls. ' +
    'Pages are found by id or exact title. Nothing is deleted here: the user deletes pages in Arcade.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'read', 'create', 'append', 'check', 'replace', 'link', 'move'] },
      page: { type: 'string', description: 'Page id or exact title (read, append, check, replace, link, move)' },
      title: { type: 'string', description: `New page title, up to ${MAX_TITLE} characters (create)` },
      parent: { type: 'string', description: 'Id or title of a top-level page or board to put the new page or card under (create)' },
      board: { type: 'boolean', description: 'create: true makes a project board with columns To do, Doing, Done' },
      column: { type: 'string', description: 'Board column name or id: where a new card goes (create, default the first column) or moves to (move)' },
      text: { type: 'string', description: 'Markdown lines: the new page text (create, replace) or lines to add (append)' },
      item: { type: 'string', description: 'Checklist item: its number from 1, or a part of its text (check)' },
      done: { type: 'boolean', description: 'check: true ticks (default), false unticks' },
      app: { type: 'string', description: `Name of the other app, e.g. Notion, up to ${MAX_APP} characters (link, create)` },
      url: { type: 'string', description: 'Address of the page in that app, e.g. https://www.notion.so/… (link, create)' },
    },
    required: ['action'],
  },
  isDeferred: true,
}

// Вызов инструмента: → { notes, text, isError?, changed? }. notes — блокнот после вызова; makeId — id новой карточки
// доски (у общей доски id карточек случайные, чтобы не совпасть с карточками друзей)
export function applyNotesTool(notes, input, now, makeId) {
  const fail = (text) => ({ notes, text, isError: true })
  const action = input?.action
  if (action === 'list') {
    if (!notes.length) return { notes, text: 'The notebook is empty.' }
    const column = (p) => {
      const board = p.parent && notes.find((b) => b.id === p.parent && b.board)
      return board ? ` (${colLabel(board.board.cols.find((c) => c.id === columnOf(p, board.board.cols)))})` : ''
    }
    const lines = notesOrder(notes).map((p) => `${p.parent ? '  - ' : '- '}${p.id}: ${p.title}${boardLabel(p)}${column(p)}${statsLabel(p.body)}${linkLabel(p)}`)
    return { notes, text: `Notebook pages:\n${lines.join('\n')}` }
  }
  if (action === 'create') {
    const parent = input.parent ? findPage(notes, input.parent) : null
    if (input.parent && !parent) return fail(`No page "${clip(input.parent)}" to put the new page under.`)
    if (parent?.parent) return fail(`"${parent.title}" is a subpage; subpages can only go under top-level pages.`)
    if (String(input.text ?? '').length > MAX_BODY) return fail(`The text is too long: up to ${MAX_BODY} characters.`)
    const link = input.app || input.url ? cleanLink(input.app, input.url) : null
    if ((input.app || input.url) && !link) return fail(BAD_LINK)
    if (input.board && parent) return fail('A board is a top-level page: create it without parent.')
    let col
    if (parent?.board) {
      col = input.column ? findColumn(parent.board.cols, input.column)?.id : parent.board.cols[0].id
      if (!col) return fail(`No column "${clip(input.column)}" on ${parent.title}. Columns: ${columnList(parent.board.cols)}.`)
    }
    const fresh = { title: input.title, body: input.text ?? '', parent: parent?.id ?? null }
    if (parent?.board) Object.assign(fresh, { col, id: makeId?.() })
    if (input.board) fresh.board = {}
    const made = addPage(notes, fresh, now)
    if (made.error === 'empty') return fail('The page needs a title.')
    if (made.error === 'full') return fail(NOTEBOOK_FULL)
    const list = link ? updatePage(made.notes, made.page.id, { link }, now) : made.notes
    if (!fits(list)) return fail(NOTEBOOK_FULL)
    const linked = link ? `, linked to ${link.app}` : ''
    const where = parent?.board
      ? ` (card on ${parent.title}, column ${colLabel(parent.board.cols.find((c) => c.id === col))})`
      : parent
        ? ` (under ${parent.title})`
        : made.page.board
          ? ' (a board with columns To do, Doing, Done)'
          : ''
    return { notes: list, text: `Created ${made.page.board ? 'board' : parent?.board ? 'card' : 'page'} ${made.page.id}: ${made.page.title}${where}${linked}.`, changed: true }
  }
  const page = findPage(notes, input?.page)
  if (['read', 'append', 'check', 'replace', 'link', 'move'].includes(action)) {
    if (!page) return fail(`No page "${clip(input?.page)}". Use action list to see the pages.`)
  }
  if (action === 'read') {
    const parent = page.parent ? notes.find((p) => p.id === page.parent) : null
    const children = notes.filter((p) => p.parent === page.id)
    const linked = page.link ? `\nLinked to ${page.link.app}: ${page.link.url}` : ''
    const under = parent?.board
      ? ` (card on board ${parent.title}, column ${colLabel(parent.board.cols.find((c) => c.id === columnOf(page, parent.board.cols)))})`
      : parent
        ? ` (under ${parent.title})`
        : ''
    if (page.board) {
      const shared = page.board.share ? ' (shared with friends)' : ''
      const cols = page.board.cols.map((c) => {
        const cards = columnCards(notes, page, c.id)
        return `## ${colLabel(c)}\n${cards.length ? cards.map((p) => `- ${p.id}: ${p.title}${statsLabel(p.body)}`).join('\n') : '(no cards)'}`
      })
      return { notes, text: `Board ${page.id}: ${page.title}${shared}${linked}${page.body ? `\n\n${page.body}` : ''}\n\n${cols.join('\n\n')}` }
    }
    const head = `Page ${page.id}: ${page.title}${under}${linked}`
    const subs = children.length ? `\n\nSubpages:\n${children.map((c) => `- ${c.id}: ${c.title}`).join('\n')}` : ''
    return { notes, text: `${head}\n\n${page.body || '(empty)'}${subs}` }
  }
  if (action === 'append') {
    const body = appendText(page.body, input.text)
    if (body === null) return fail(`The page would be over ${MAX_BODY} characters.`)
    if (body === page.body) return fail('Nothing to add: text is empty.')
    const next = updatePage(notes, page.id, { body }, now)
    if (!fits(next)) return fail(NOTEBOOK_FULL)
    return { notes: next, text: `Added to ${page.title}.`, changed: true }
  }
  if (action === 'check') {
    const checks = noteLines(page.body).filter((l) => l.kind === 'check')
    if (!checks.length) return fail(`${page.title} has no checklist items.`)
    const want = String(input.item ?? '').trim()
    const number = /^\d+$/.test(want) ? Number(want) : 0
    const found = number ? checks[number - 1] : checks.filter((l) => want && l.text.toLowerCase().includes(want.toLowerCase()))
    const line = Array.isArray(found) ? (found.length === 1 ? found[0] : null) : found
    if (!line) {
      const list = checks.map((l, i) => `${i + 1}. [${l.done ? 'x' : ' '}] ${l.text}`).join('\n')
      const why = Array.isArray(found) && found.length > 1 ? `"${clip(want)}" matches several items` : `No item "${clip(want)}"`
      return fail(`${why}. Items:\n${list}`)
    }
    const done = input.done !== false
    const body = toggleLine(page.body, line.index, done)
    return { notes: updatePage(notes, page.id, { body }, now), text: `${done ? 'Ticked' : 'Unticked'}: ${line.text}.`, changed: true }
  }
  if (action === 'replace') {
    if (typeof input.text !== 'string') return fail('Give the new text of the page in text.')
    if (input.text.length > MAX_BODY) return fail(`The text is too long: up to ${MAX_BODY} characters.`)
    const body = cleanBody(input.text)
    if (body === page.body) return { notes, text: `${page.title} already has this text.` }
    const next = updatePage(notes, page.id, { body, prev: page.body }, now)
    if (!fits(next)) return fail(NOTEBOOK_FULL)
    return { notes: next, text: `Replaced the text of ${page.title}. The user can undo it in Arcade.`, changed: true }
  }
  if (action === 'link') {
    const link = cleanLink(input.app, input.url)
    if (!link) return fail(BAD_LINK)
    const next = updatePage(notes, page.id, { link }, now)
    if (!fits(next)) return fail(NOTEBOOK_FULL)
    return { notes: next, text: `Linked ${page.title} to ${link.app}: ${link.url}.`, changed: true }
  }
  if (action === 'move') {
    const board = page.parent ? notes.find((p) => p.id === page.parent && p.board) : null
    if (!board) return fail(`${page.title} is not a card on a board.`)
    const col = findColumn(board.board.cols, input.column)
    if (!col) return fail(`No column "${clip(input.column)}" on ${board.title}. Columns: ${columnList(board.board.cols)}.`)
    if (col.id === columnOf(page, board.board.cols)) return { notes, text: `${page.title} is already in ${colLabel(col)}.` }
    return { notes: moveCard(notes, page.id, { col: col.id }, now), text: `Moved ${page.title} to ${colLabel(col)}.`, changed: true }
  }
  return fail('Unknown action: use list, read, create, append, check, replace, link or move.')
}

const clip = (text) => String(text ?? '').slice(0, 80)
const NOTEBOOK_FULL = 'The notebook is full. Ask the user to delete pages they do not need.'
const BAD_LINK = `A link needs app (e.g. Notion, up to ${MAX_APP} characters) and url: the full address of the page in that app, like https://…, up to ${MAX_URL} characters.`
