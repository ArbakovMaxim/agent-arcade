// Общие доски проектов: разбор ответов сайта Arcade и сверка копии доски в блокноте с доской на сайте. Сеть и
// опрос — в hooks/app/work.js, экран — в hooks/screens/boards.js, сама доска и её карточки — страницы блокнота
// (hooks/notes.js). Для каждой общей доски
// мод помнит, какой видел её на сайте в последний раз (основа: номер правки rev, название, колонки и когда каждая
// карточка была сверена — cards: { id: at }). Что в блокноте поменялось после основы, уходит на сайт; что поменялось на
// сайте после rev, приходит обратно. Карточку, которую здесь правили, пока шёл ответ, сайт не перезаписывает — её правка
// уйдёт следующей сверкой. Чужой текст (карточки, названия, ники) приходит с сайта — его чистят cleanTitle и cleanBody
import { count, trouble } from './account.js'
import { namesFrom } from './chats.js'
import { addPage, cleanBody, cleanCols, cleanTitle, fits, isBoard, updatePage } from './notes.js'
import { jsonFrom } from './youtube.js'

export const BOARD_ID = /^b[A-Za-z0-9_-]{16}$/
const CARD_ID = /^[a-z0-9]{1,20}$/
const COL_ID = /^[a-z0-9]{1,12}$/
const ACCOUNT_ID = /^\d{1,20}$/
export const MAX_OWNED = 3 // своих общих досок
export const MAX_MEMBERS = 20 // людей на доске вместе с хозяином
const MAX_OPS = 100 // правок в одной сверке
const OPS_CHARS = 100_000 // знаков в правках одной сверки — остальное уйдёт следующей

const id = (value) => (typeof value === 'string' || Number.isSafeInteger(value) ? String(value) : '')
const accountId = (value) => (ACCOUNT_ID.test(id(value)) ? id(value) : '')
const people = (list) => (Array.isArray(list) ? [...new Set(list.map(accountId).filter(Boolean))].slice(0, MAX_MEMBERS) : [])
const sameCols = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// id новой карточки и колонки: случайные, чтобы не совпасть с тем, что заводят друзья
const hex = () => crypto.randomUUID().replace(/-/g, '')
export const cardId = () => `c${hex().slice(0, 15)}`
export const colId = () => `k${hex().slice(0, 8)}`

// Что не так с ответом про доски: общие ошибки аккаунта (trouble) и свои — 'name' (доска без названия), 'invalid'
// (сайт не понял вопрос), 'friend' (звать можно только друзей), 'owner' (это может только хозяин), 'gone' (доски нет
// или тебя на ней нет), 'full' (на доске больше MAX_MEMBERS), 'many' (своих общих досок уже MAX_OWNED), 'nohandle'
// (сначала свой @ник), 'often' (слишком часто), 'big' (слишком большая пачка правок). Сайт без досок — 'off' или 'down'
export function boardFailure(response, data) {
  const said = data?.error
  const status = response?.status
  if (status === 400) return said === 'name' ? 'name' : 'invalid'
  if (status === 403) return said === 'owner' ? 'owner' : 'friend'
  if (status === 404) return said === 'gone' ? 'gone' : 'down'
  if (status === 409) return ['full', 'many', 'nohandle'].includes(said) ? said : 'down'
  if (status === 413) return 'big'
  if (status === 429) return said === 'often' ? 'often' : 'limit'
  return trouble(response, data)
}

// Доска из ответа: { id, name, owner, members, cols, rev }; не сходится — null
function boardFrom(b) {
  if (!b || typeof b !== 'object' || typeof b.id !== 'string' || !BOARD_ID.test(b.id)) return null
  const name = cleanTitle(b.name)
  const cols = cleanCols(b.cols)
  const owner = accountId(b.owner)
  if (!name || !cols || !owner || !Number.isSafeInteger(b.rev) || b.rev < 0) return null
  return { id: b.id, name, owner, members: people(b.members), cols, rev: b.rev }
}

// Карточка из ответа: { id, title, body, col, pos } или след удаления { id, gone: true }; не сходится — null
function cardFrom(c) {
  if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !CARD_ID.test(c.id)) return null
  if (c.gone === true) return { id: c.id, gone: true }
  const title = cleanTitle(c.title)
  if (!title || typeof c.body !== 'string' || !Number.isFinite(c.pos)) return null
  return { id: c.id, title, body: cleanBody(c.body), col: typeof c.col === 'string' && COL_ID.test(c.col) ? c.col : '', pos: c.pos }
}

// Доска из списка: { id, name, owner, rev, at }
function listedFrom(b) {
  if (!b || typeof b !== 'object' || typeof b.id !== 'string' || !BOARD_ID.test(b.id)) return null
  const name = cleanTitle(b.name)
  const owner = accountId(b.owner)
  if (!name || !owner) return null
  return { id: b.id, name, owner, rev: count(b.rev), at: Number.isFinite(b.at) ? b.at : 0 }
}

// Ответ GET /api/me/boards → { me, boards, names, error }: me — свой номер, boards — общие доски, недавние сверху,
// names — ники хозяев
export function parseBoards(response) {
  const data = jsonFrom(response?.text)
  const none = (e) => ({ me: '', boards: [], names: {}, error: e })
  const error = boardFailure(response, data)
  if (error) return none(error)
  const me = accountId(data.me?.id)
  if (!me || !Array.isArray(data.boards)) return none('down')
  return { me, boards: data.boards.slice(0, 200).map(listedFrom).filter(Boolean), names: namesFrom(data.names), error: '' }
}

// Ответ сверки и новой доски → { board, cards, full, refused, names, error }: cards — поменявшиеся после since по
// порядку правок; full — это все карточки доски; refused — карточки, которые доска не взяла (не поместились)
export function parseBoard(response) {
  const data = jsonFrom(response?.text)
  const none = (e) => ({ board: null, cards: [], full: false, refused: [], names: {}, error: e })
  const error = boardFailure(response, data)
  if (error) return none(error)
  const board = boardFrom(data.board)
  if (!board || !Array.isArray(data.cards)) return none('down')
  const refused = Array.isArray(data.refused) ? data.refused.filter((x) => typeof x === 'string' && CARD_ID.test(x)) : []
  return { board, cards: data.cards.slice(0, 2000).map(cardFrom).filter(Boolean), full: data.full === true, refused, names: namesFrom(data.names), error: '' }
}

// Ответ про участников и удаление доски → { board, left, names, error }; left — доски у человека больше нет
// (вышел или удалил)
export function parseBoardDone(response) {
  const data = jsonFrom(response?.text)
  const none = (e) => ({ board: null, left: false, names: {}, error: e })
  const error = boardFailure(response, data)
  if (error) return none(error)
  if (data.ok === true && data.board === undefined) return { board: null, left: true, names: {}, error: '' }
  const board = boardFrom(data.board)
  return board ? { board, left: false, names: namesFrom(data.names), error: '' } : none('down')
}

// Основа доски, которую ещё не сверяли (только что взята с сайта или основа потерялась): rev 0 — сайт отдаст доску
// целиком, а карточки блокнота считаются сверенными — где они расходятся с сайтом, победит сайт
export function freshBase(notes, page, owner = '') {
  const cards = notes.filter((p) => p.parent === page.id)
  return { page: page.id, rev: 0, name: page.title, cols: page.board.cols, owner, members: [], names: {}, cards: Object.fromEntries(cards.map((c) => [c.id, c.at])), held: {} }
}

const ats = (raw) =>
  raw && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.fromEntries(
        Object.entries(raw)
          .filter(([k, at]) => CARD_ID.test(k) && Number.isFinite(at))
          .slice(0, 1000),
      )
    : {}

// Основы общих досок из $.store: { номер доски: основа }. Остаются только доски, которые есть в блокноте
export function restoreDesks(saved, notes) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
  const out = {}
  for (const [share, b] of Object.entries(saved)) {
    if (!BOARD_ID.test(share) || !b || typeof b !== 'object') continue
    const page = notes.find((p) => p.id === b.page && isBoard(p) && p.board.share === share)
    if (!page) continue
    out[share] = {
      page: page.id,
      rev: Number.isSafeInteger(b.rev) && b.rev >= 0 ? b.rev : 0,
      name: typeof b.name === 'string' ? b.name : page.title,
      cols: cleanCols(b.cols) ?? page.board.cols,
      owner: accountId(b.owner),
      members: people(b.members),
      names: namesFrom(b.names),
      cards: ats(b.cards),
      held: ats(b.held),
    }
  }
  return out
}

// Что отдать сайту: { ops, sent } — правки по порядку (название, колонки, удалённые карточки, новые и поправленные) и
// что именно ушло (sent: { name?, cols?, puts: { id: at }, dels }), чтобы после ответа сдвинуть основу. Карточку,
// которую доска не взяла (held), не шлём, пока её снова не поправят
export function planSync(notes, base) {
  const ops = []
  const sent = { puts: {}, dels: [] }
  const page = notes.find((p) => p.id === base.page && isBoard(p))
  if (!page) return { ops, sent }
  let chars = 0
  const add = (op) => {
    const size = JSON.stringify(op).length
    if (ops.length >= MAX_OPS || chars + size > OPS_CHARS) return false
    ops.push(op)
    chars += size
    return true
  }
  if (page.title !== base.name && add({ name: page.title })) sent.name = page.title
  if (!sameCols(page.board.cols, base.cols) && add({ cols: page.board.cols })) sent.cols = page.board.cols
  const cards = notes.filter((p) => p.parent === page.id)
  const here = new Set(cards.map((c) => c.id))
  for (const cid of Object.keys(base.cards)) if (!here.has(cid) && add({ del: cid })) sent.dels.push(cid)
  for (const c of cards) {
    if (c.at === base.cards[c.id] || c.at === base.held[c.id]) continue
    if (add({ put: { id: c.id, title: c.title, body: c.body, col: c.col, pos: c.pos } })) sent.puts[c.id] = c.at
  }
  return { ops, sent }
}

// Ответ сверки — в блокнот: → { notes, base, refused, missed, changed } или null (доски в блокноте уже нет). Правки,
// что ушли (sent), становятся основой; поменявшееся на сайте ложится в блокнот, кроме карточек, которые здесь
// поправили после того, как ушла сверка. missed — не всё поместилось в блокнот: номер правки остаётся прежним, чтобы
// следующая сверка взяла пропущенное снова. changed — id карточек, которые поменял сайт
export function applySync(notes, base, answer, sent, now) {
  let list = notes
  const page = list.find((p) => p.id === base.page && isBoard(p))
  if (!page) return null
  const refused = new Set(answer.refused)
  const cards = { ...base.cards }
  // Удаление освобождает место — карточки, которые доска не взяла, можно попробовать снова
  const held = sent.dels.length ? {} : { ...base.held }
  for (const cid of sent.dels) delete cards[cid]
  for (const [cid, at] of Object.entries(sent.puts)) {
    if (refused.has(cid)) held[cid] = at
    else {
      cards[cid] = at
      delete held[cid]
    }
  }
  const dirty = (p) => p.at !== cards[p.id] && p.at !== held[p.id]
  const changed = new Set()
  const seen = new Set()
  let missed = false
  for (const card of answer.cards) {
    seen.add(card.id)
    const mine = list.find((p) => p.id === card.id)
    if (card.gone) {
      // Удалили на сайте; здесь её поправили — она вернётся на доску следующей сверкой
      if (mine?.parent === page.id && !dirty(mine)) {
        list = list.filter((p) => p.id !== card.id)
        changed.add(card.id)
      }
      delete cards[card.id]
      delete held[card.id]
      continue
    }
    // id занят другой страницей; карточку здесь поправили; здесь её удалили — удаление уйдёт следующей сверкой
    if ((mine && mine.parent !== page.id) || (mine && dirty(mine)) || (!mine && Object.hasOwn(cards, card.id))) continue
    if (mine) {
      if (mine.title !== card.title || mine.body !== card.body || mine.col !== card.col || mine.pos !== card.pos) {
        list = updatePage(list, card.id, { title: card.title, body: card.body, col: card.col, pos: card.pos }, now)
        changed.add(card.id)
      }
      cards[card.id] = list.find((p) => p.id === card.id).at
      continue
    }
    const made = addPage(list, { title: card.title, body: card.body, parent: page.id, id: card.id, col: card.col, pos: card.pos }, now)
    if (made.error || made.page.id !== card.id || !fits(made.notes)) {
      missed = true
      continue
    }
    list = made.notes
    cards[card.id] = made.page.at
    changed.add(card.id)
  }
  // Доска целиком: сверенных карточек, которых на сайте больше нет, нет и здесь
  if (answer.full) {
    for (const p of list.filter((x) => x.parent === page.id && !seen.has(x.id) && Object.hasOwn(cards, x.id) && !dirty(x))) {
      list = list.filter((x) => x.id !== p.id)
      changed.add(p.id)
    }
    for (const cid of Object.keys(cards)) if (!seen.has(cid)) delete cards[cid]
  }
  // Название и колонки: здесь не трогали после сверки — как на сайте
  const board = answer.board
  let name = sent.name ?? base.name
  let cols = sent.cols ?? base.cols
  const top = list.find((p) => p.id === page.id)
  const change = {}
  if (top.title === name) {
    if (board.name !== top.title) change.title = board.name
    name = board.name
  }
  if (sameCols(top.board.cols, cols)) {
    if (!sameCols(board.cols, top.board.cols)) change.board = { ...top.board, cols: board.cols }
    cols = board.cols
  }
  if (Object.keys(change).length) list = updatePage(list, page.id, change, now)
  const next = {
    ...base,
    rev: missed ? base.rev : board.rev,
    name,
    cols,
    owner: board.owner,
    members: board.members,
    names: { ...base.names, ...answer.names },
    cards,
    held,
  }
  return { notes: list, base: next, refused: [...refused], missed, changed: [...changed] }
}

// Доска больше не общая (удалили, убрали или вышел): в блокноте остаётся своей
export function detachBoard(notes, pageId, now) {
  const page = notes.find((p) => p.id === pageId && isBoard(p))
  if (!page?.board.share) return notes
  return updatePage(notes, pageId, { board: { cols: page.board.cols } }, now)
}

// Общая доска с сайта, которой нет в блокноте: новая доска без карточек (их и колонки принесёт первая сверка) и её
// основа. Не поместилась — { error }
export function adoptBoard(notes, listed, now) {
  const made = addPage(notes, { title: listed.name, board: { share: listed.id } }, now)
  if (made.error) return made
  if (!fits(made.notes)) return { error: 'full' }
  return { notes: made.notes, page: made.page, base: freshBase(made.notes, made.page, listed.owner) }
}
