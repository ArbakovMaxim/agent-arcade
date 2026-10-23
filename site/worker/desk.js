// Доски проектов Arcade: общие доски друзей. Durable Object Desk — один экземпляр на доску b<16 знаков>. В моде доска —
// страница блокнота, её карточки — подстраницы; общая доска лежит здесь, а мод держит у себя копию и сверяет её по
// номеру правки (rev): каждая правка — следующий номер, мод спрашивает «что поменялось после моего номера». Из двух
// правок одной карточки побеждает поздняя. Снаружи доски не видно: зовут её только экземпляры Account участников
// (worker/account.js), а она сообщает каждому о правках (/boardnote) и о том, что доски у него больше нет (/boardgone).
// Карточки хранятся на сайте как есть, без шифрования.
export const MAX_CARDS = 200 // карточек на доске
export const MAX_TITLE = 80 // знаков в названии доски и карточки
export const MAX_BODY = 20_000 // знаков в тексте карточки
export const MAX_TOTAL = 500_000 // знаков на всей доске
export const MAX_COLS = 8
export const MAX_COL = 30 // знаков в названии колонки
export const MAX_MEMBERS = 20 // людей на доске вместе с хозяином
export const MAX_OPS = 100 // правок в одном вопросе
export const KEEP_GONE = 300 // следов удалённых карточек; старые забываются пачками по TRIM — кто сверялся до них, получит доску целиком
const TRIM = 100
export const BOARD_ID = /^b[A-Za-z0-9_-]{16}$/
export const CARD_ID = /^[a-z0-9]{1,20}$/
const COL_ID = /^[a-z0-9]{1,12}$/
const ACCOUNT_ID = /^\d{1,20}$/
// Колонки новой доски; их названия — в моде, на языке человека. Своё название колонки — name
export const DEFAULT_COLS = [{ id: 'todo' }, { id: 'doing' }, { id: 'done' }]

// Название доски, карточки или колонки: одной строкой, без управляющих знаков и знаков, переворачивающих направление
// текста, не длиннее max; не строка — ''
export function cleanTitle(text, max = MAX_TITLE) {
  if (typeof text !== 'string') return ''
  const line = text.replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]+/g, ' ').replace(/\s+/g, ' ').trim()
  return [...line].slice(0, max).join('').trim()
}

// Текст карточки: переводы строк — \n, без управляющих знаков (кроме \n и табуляции); не строка — null
export function cleanBody(text) {
  return typeof text === 'string' ? text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f‪-‮⁦-⁩]/g, '') : null
}

// Колонки: от одной до MAX_COLS, id латиницей без повторов, name — если своё. Не так — null
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

// Карточка из правки put: { id, title, body, col, pos }. Колонки такой нет — первая. Не так — null
function cardFrom(raw, cols) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !CARD_ID.test(raw.id)) return null
  const title = cleanTitle(raw.title)
  const body = raw.body === undefined ? '' : cleanBody(raw.body)
  if (!title || body === null || body.length > MAX_BODY || !Number.isFinite(raw.pos)) return null
  return { id: raw.id, title, body, col: cols.some((c) => c.id === raw.col) ? raw.col : cols[0].id, pos: raw.pos }
}

const refuse = (error, status) => Response.json({ error }, { status })
const has = (members, id) => Object.hasOwn(members, id)
const ids = (list) => (Array.isArray(list) ? [...new Set(list.filter((id) => typeof id === 'string' && ACCOUNT_ID.test(id)))] : [])
const weight = (card) => card.title.length + card.body.length
const same = (a, b) => a.title === b.title && a.body === b.body && a.col === b.col && a.pos === b.pos

// Что о доске знают участники: название, хозяин, участники, колонки и номер последней правки
const summary = (meta) => ({ id: meta.id, name: meta.name, owner: meta.owner, members: Object.keys(meta.members), cols: meta.cols, rev: meta.rev })

// meta — { id, name, owner, members: { номер: с какого времени на доске }, cols, rev — номер последней правки, floor —
// до какой правки следы удаления забыты, cards и size — сколько карточек и знаков в них, gone — сколько следов
// удаления, created }. Карточка c:<id> — { id, title, body, col, pos, rev, by, at }: pos — место в колонке, rev —
// номер её правки, by и at — кто и когда правил; удалённая — след { id, rev, gone: true }
export class Desk {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
  }

  async fetch(request) {
    const path = new URL(request.url).pathname
    try {
      const body = await request.json()
      if (typeof body?.board !== 'string' || !BOARD_ID.test(body.board) || typeof body.by !== 'string' || !ACCOUNT_ID.test(body.by)) return refuse('bad request', 400)
      if (path === '/open') return await this.open(body)
      const meta = await this.ctx.storage.get('meta')
      if (!meta) return refuse('gone', 404)
      if (!has(meta.members, body.by)) return refuse('member', 403)
      if (path === '/sync') return await this.sync(meta, body)
      if (path === '/members') return await this.members(meta, body)
      if (path === '/delete') return await this.remove(meta, body)
      return refuse('not found', 404)
    } catch {
      return refuse('upstream', 502)
    }
  }

  // Новая доска: хозяин — кто её завёл, он же пока единственный участник. Карточки мод досылает правками
  async open({ board, by, name, cols }) {
    if (await this.ctx.storage.get('meta')) return refuse('taken', 409)
    const title = cleanTitle(name)
    const columns = cols === undefined ? DEFAULT_COLS : cleanCols(cols)
    if (!title || !columns) return refuse('bad request', 400)
    const now = Date.now()
    const meta = { id: board, name: title, owner: by, members: { [by]: now }, cols: columns, rev: 1, floor: 0, cards: 0, size: 0, gone: 0, created: now }
    await this.ctx.storage.put('meta', meta)
    await this.notify(meta, by)
    return Response.json({ board: summary(meta), cards: [], full: true })
  }

  // Сверка: сначала правки мода (ops), потом — что поменялось после since. Правки: { put: карточка } — новая или
  // поверх прежней, { del: id } — удалить, { cols } — колонки целиком (карточки из убранной колонки мод показывает в
  // первой), { name } — название доски. Каждая — следующим номером. Карточку, которая не помещается (MAX_CARDS,
  // MAX_TOTAL), доска не берёт — её id в refused. Ответ — { board, cards, full?, refused? }: cards — поменявшиеся после
  // since (удалённые — следами); full — since нет или он старше забытых следов: это все карточки доски
  async sync(meta, { by, since, ops = [] }) {
    if (!Array.isArray(ops) || ops.length > MAX_OPS) return refuse('bad request', 400)
    const wanted = [...new Set(ops.map((op) => op?.put?.id ?? op?.del).filter((id) => typeof id === 'string' && CARD_ID.test(id)))]
    const before = wanted.length ? await this.ctx.storage.get(wanted.map((id) => `c:${id}`)) : new Map()
    const touched = new Map()
    const current = (id) => (touched.has(id) ? touched.get(id) : before.get(`c:${id}`))
    const next = { ...meta }
    const refused = []
    const now = Date.now()
    for (const op of ops) {
      if (!op || typeof op !== 'object') return refuse('bad request', 400)
      if (op.name !== undefined) {
        const name = cleanTitle(op.name)
        if (!name) return refuse('bad request', 400)
        if (name !== next.name) Object.assign(next, { name, rev: next.rev + 1 })
      } else if (op.cols !== undefined) {
        const cols = cleanCols(op.cols)
        if (!cols) return refuse('bad request', 400)
        if (JSON.stringify(cols) !== JSON.stringify(next.cols)) Object.assign(next, { cols, rev: next.rev + 1 })
      } else if (op.put !== undefined) {
        const card = cardFrom(op.put, next.cols)
        if (!card) return refuse('bad request', 400)
        const old = current(card.id)
        const live = old && !old.gone
        if (live && same(old, card)) continue
        const size = next.size - (live ? weight(old) : 0) + weight(card)
        if ((!live && next.cards >= MAX_CARDS) || size > MAX_TOTAL) {
          refused.push(card.id)
          continue
        }
        next.rev += 1
        touched.set(card.id, { ...card, rev: next.rev, by, at: now })
        Object.assign(next, { size, cards: next.cards + (live ? 0 : 1), gone: next.gone - (old?.gone ? 1 : 0) })
      } else if (typeof op.del === 'string' && CARD_ID.test(op.del)) {
        const old = current(op.del)
        if (!old || old.gone) continue
        next.rev += 1
        touched.set(op.del, { id: op.del, rev: next.rev, gone: true })
        Object.assign(next, { size: next.size - weight(old), cards: next.cards - 1, gone: next.gone + 1 })
      } else return refuse('bad request', 400)
    }
    if (next.rev !== meta.rev) {
      // Хранилище пишет не больше 128 ключей за раз: правок — не больше MAX_OPS
      await this.ctx.storage.put({ meta: next, ...Object.fromEntries([...touched].map(([id, card]) => [`c:${id}`, card])) })
      await this.prune(next)
      await this.notify(next, by)
    }
    return Response.json({ ...(await this.changes(next, since)), ...(refused.length ? { refused } : {}) })
  }

  async changes(meta, since) {
    const full = !Number.isSafeInteger(since) || since <= 0 || since < meta.floor
    if (!full && since >= meta.rev) return { board: summary(meta), cards: [] }
    const all = await this.ctx.storage.list({ prefix: 'c:' })
    const cards = [...all.values()].filter((c) => (full ? !c.gone : c.rev > since)).sort((a, b) => a.rev - b.rev)
    return { board: summary(meta), cards, ...(full ? { full: true } : {}) }
  }

  // Следов удаления больше KEEP_GONE + TRIM — самые старые забываются
  async prune(meta) {
    if (meta.gone <= KEEP_GONE + TRIM) return
    const all = await this.ctx.storage.list({ prefix: 'c:' })
    const old = [...all.values()]
      .filter((c) => c.gone)
      .sort((a, b) => a.rev - b.rev)
      .slice(0, meta.gone - KEEP_GONE)
    if (!old.length) return
    Object.assign(meta, { floor: old.at(-1).rev, gone: meta.gone - old.length })
    await this.ctx.storage.put('meta', meta)
    for (let i = 0; i < old.length; i += 128) await this.ctx.storage.delete(old.slice(i, i + 128).map((c) => `c:${c.id}`))
  }

  // Хозяин зовёт друзей и убирает участников, выйти может любой. Вышел хозяин — доска переходит к тому, кто на ней
  // дольше всех; вышли все — доски больше нет. Участникам — что доска поменялась, убранным и вышедшим — что её у них нет
  async members(meta, { by, add, remove, leave }) {
    const gone = []
    if (leave === true) {
      delete meta.members[by]
      gone.push(by)
      if (!Object.keys(meta.members).length) {
        await this.ctx.storage.deleteAll()
        await this.tellGone(meta, gone)
        return Response.json({ ok: true })
      }
      if (meta.owner === by) meta.owner = Object.entries(meta.members).sort((a, b) => a[1] - b[1])[0][0]
    } else {
      if (meta.owner !== by) return refuse('owner', 403)
      const adding = ids(add).filter((id) => !has(meta.members, id))
      const removing = ids(remove).filter((id) => id !== by && has(meta.members, id))
      if (Object.keys(meta.members).length - removing.length + adding.length > MAX_MEMBERS) return refuse('full', 409)
      if (!adding.length && !removing.length) return Response.json({ board: summary(meta) })
      for (const id of removing) {
        delete meta.members[id]
        gone.push(id)
      }
      const now = Date.now()
      for (const id of adding) meta.members[id] = now
    }
    meta.rev += 1
    await this.ctx.storage.put('meta', meta)
    await this.notify(meta, by)
    await this.tellGone(meta, gone)
    return Response.json({ board: summary(meta) })
  }

  // Удалить доску у всех — может только хозяин
  async remove(meta, { by }) {
    if (meta.owner !== by) return refuse('owner', 403)
    await this.ctx.storage.deleteAll()
    await this.tellGone(meta, Object.keys(meta.members))
    return Response.json({ ok: true })
  }

  // Каждому участнику — в его экземпляр Account: доска поменялась. Кто не ответил, узнает при следующей правке
  async notify(meta, by) {
    const about = { board: meta.id, name: meta.name, owner: meta.owner, rev: meta.rev, by }
    await Promise.allSettled(Object.keys(meta.members).map(async (id) => this.account(id, '/boardnote', about)))
  }

  async tellGone(meta, people) {
    await Promise.allSettled(people.map(async (id) => this.account(id, '/boardgone', { board: meta.id })))
  }

  account(id, path, body) {
    const space = this.env.ACCOUNT
    return space.get(space.idFromName(`gh:${id}`)).fetch(new Request(`https://account${path}`, { method: 'POST', body: JSON.stringify(body) }))
  }
}
