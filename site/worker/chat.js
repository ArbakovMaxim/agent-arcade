// Чаты Arcade: переписка с другом один на один и группы друзей. Durable Object Chat — один экземпляр на чат:
// d<номер>-<номер> — двое друзей (меньший номер первым), g<16 знаков> — группа. Чат хранит участников и последние KEEP
// сообщений. Снаружи его не видно: зовут его только экземпляры Account участников (worker/account.js), а он сообщает
// каждому из них о новом сообщении (/chatnote) — так у каждого свой список чатов с непрочитанными.
// Сообщения хранятся на сайте как есть, без шифрования.
export const MAX_TEXT = 2000 // знаков в сообщении
export const MAX_MEMBERS = 50 // людей в группе вместе с хозяином
export const MAX_NAME = 40 // знаков в названии группы
export const KEEP = 1000 // сообщений в чате хранится; старые уходят пачками по TRIM
export const PAGE = 50 // сообщений за один раз
const TRIM = 100
export const CHAT_ID = /^(?:d\d{1,20}-\d{1,20}|g[A-Za-z0-9_-]{16})$/
const ACCOUNT_ID = /^\d{1,20}$/

// Чат двоих: меньший номер первым — у обоих один и тот же
export function dmId(a, b) {
  const [x, y] = [a, b].sort((p, q) => p.length - q.length || (p < q ? -1 : p > q ? 1 : 0))
  return `d${x}-${y}`
}

// Текст сообщения: переводы строк — \n, без управляющих знаков (кроме \n и табуляции) и знаков, переворачивающих
// направление текста, без пробелов по краям; не строка — ''
export function cleanText(text) {
  if (typeof text !== 'string') return ''
  return text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim()
}

// Название группы: одной строкой, не длиннее MAX_NAME знаков; не строка — ''
export function groupName(text) {
  return [...cleanText(text).replace(/\s+/g, ' ')].slice(0, MAX_NAME).join('').trim()
}

const refuse = (error, status) => Response.json({ error }, { status })
const has = (members, id) => Object.hasOwn(members, id)
const ids = (list) => (Array.isArray(list) ? [...new Set(list.filter((id) => typeof id === 'string' && ACCOUNT_ID.test(id)))] : [])

// Что о чате знают участники: участники, хозяин и название группы, номер последнего сообщения
const summary = (meta) => ({
  id: meta.id,
  kind: meta.kind,
  ...(meta.name ? { name: meta.name } : {}),
  ...(meta.owner ? { owner: meta.owner } : {}),
  members: Object.keys(meta.members),
  last: meta.last,
})

// meta — { id, kind: 'dm' | 'group', name?, owner?, members: { номер: с какого сообщения он видит переписку },
// first, last — номера самого старого и последнего сообщения, created }. Сообщение m:<номер> — { s, f, t, at }:
// номер, кто написал, текст, когда; служебное — { s, f, k, o?, n?, at }: 'create' — создал группу n, 'add' и
// 'remove' — добавил и убрал o, 'leave' — вышел, 'name' — назвал группу n
export class Chat {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
  }

  async fetch(request) {
    const path = new URL(request.url).pathname
    try {
      const body = await request.json()
      if (typeof body?.chat !== 'string' || !CHAT_ID.test(body.chat) || typeof body.by !== 'string' || !ACCOUNT_ID.test(body.by)) return refuse('bad request', 400)
      if (path === '/open') return await this.open(body)
      const meta = await this.ctx.storage.get('meta')
      if (!meta) return refuse('gone', 404)
      if (!has(meta.members, body.by)) return refuse('member', 403)
      if (path === '/post') return await this.post(meta, body)
      if (path === '/history') return await this.history(meta, body)
      if (path === '/members') return await this.members(meta, body)
      if (path === '/close') return await this.close(meta)
      return refuse('not found', 404)
    } catch {
      return refuse('upstream', 502)
    }
  }

  // Открыть чат: чат двоих — если его ещё нет, иначе тот же; группу — новую, с первым служебным сообщением «создал»
  async open({ chat, by, kind, members, name }) {
    const meta = await this.ctx.storage.get('meta')
    if (meta) return meta.kind === 'dm' && has(meta.members, by) ? Response.json({ chat: summary(meta) }) : refuse('taken', 409)
    const people = ids(members)
    if (!Array.isArray(members) || people.length !== members.length || !people.includes(by)) return refuse('bad request', 400)
    const dm = kind === 'dm' && people.length === 2 && dmId(...people) === chat
    const group = kind === 'group' && chat.startsWith('g') && people.length >= 2 && people.length <= MAX_MEMBERS && typeof name === 'string' && name !== ''
    if (!dm && !group) return refuse('bad request', 400)
    const fresh = { id: chat, kind, members: Object.fromEntries(people.map((id) => [id, 1])), first: 1, last: 0, created: Date.now(), ...(group ? { name, owner: by } : {}) }
    if (dm) await this.ctx.storage.put('meta', fresh)
    else await this.notify(fresh, await this.append(fresh, { f: by, k: 'create', n: name }))
    return Response.json({ chat: summary(fresh) })
  }

  // Новое сообщение — следующим номером. Хранится не больше KEEP: набралось на TRIM больше — старые удаляются
  async append(meta, fields) {
    meta.last += 1
    const msg = { s: meta.last, ...fields, at: Date.now() }
    const old = []
    if (meta.last - meta.first + 1 > KEEP + TRIM) {
      const first = meta.last - KEEP + 1
      for (let s = meta.first; s < first; s++) old.push(`m:${s}`)
      meta.first = first
    }
    await this.ctx.storage.put({ meta, [`m:${msg.s}`]: msg })
    // Хранилище удаляет не больше 128 ключей за раз
    for (let i = 0; i < old.length; i += 128) await this.ctx.storage.delete(old.slice(i, i + 128))
    return msg
  }

  async post(meta, { by, text }) {
    if (typeof text !== 'string' || !text || text.length > MAX_TEXT) return refuse('bad request', 400)
    const msg = await this.append(meta, { f: by, t: text })
    await this.notify(meta, msg)
    return Response.json({ msg })
  }

  // Сообщения: последние PAGE, PAGE до before или новые после after (из них — не больше последних PAGE). Кого
  // добавили в группу, видит переписку с сообщения о том, что его добавили
  async history(meta, { by, after, before }) {
    const from = Math.max(meta.first, meta.members[by])
    const hi = Number.isSafeInteger(before) ? Math.min(before - 1, meta.last) : meta.last
    let lo = Math.max(from, hi - PAGE + 1)
    if (Number.isSafeInteger(after) && !Number.isSafeInteger(before)) lo = Math.max(lo, after + 1)
    const keys = []
    for (let s = lo; s <= hi; s++) keys.push(`m:${s}`)
    const found = keys.length ? await this.ctx.storage.get(keys) : new Map()
    const messages = [...found.values()].sort((a, b) => a.s - b.s)
    return Response.json({ chat: summary(meta), messages, first: from })
  }

  // Группа: хозяин добавляет и убирает участников и меняет название, выйти может любой. Вышел хозяин — группа
  // переходит к тому, кто в ней дольше всех; вышли все — группы больше нет. Участникам — одно уведомление с последним
  // служебным сообщением, убранным и вышедшим — что чата у них больше нет
  async members(meta, { by, add, remove, name, leave }) {
    if (meta.kind !== 'group') return refuse('bad request', 400)
    const gone = []
    let msg = null
    if (leave === true) {
      delete meta.members[by]
      gone.push(by)
      if (!Object.keys(meta.members).length) {
        await this.ctx.storage.deleteAll()
        await this.tellGone(meta, gone)
        return Response.json({ ok: true })
      }
      if (meta.owner === by) meta.owner = Object.entries(meta.members).sort((a, b) => a[1] - b[1])[0][0]
      msg = await this.append(meta, { f: by, k: 'leave' })
    } else {
      if (meta.owner !== by) return refuse('owner', 403)
      const adding = ids(add).filter((id) => !has(meta.members, id))
      const removing = ids(remove).filter((id) => id !== by && has(meta.members, id))
      if (Object.keys(meta.members).length - removing.length + adding.length > MAX_MEMBERS) return refuse('full', 409)
      if (typeof name === 'string' && name && name !== meta.name) {
        meta.name = name
        msg = await this.append(meta, { f: by, k: 'name', n: name })
      }
      for (const id of removing) {
        delete meta.members[id]
        gone.push(id)
        msg = await this.append(meta, { f: by, k: 'remove', o: id })
      }
      for (const id of adding) {
        meta.members[id] = meta.last + 1
        msg = await this.append(meta, { f: by, k: 'add', o: id })
      }
    }
    if (msg) await this.notify(meta, msg)
    await this.tellGone(meta, gone)
    return Response.json({ chat: summary(meta) })
  }

  // Чат двоих закрывается, когда они больше не друзья или один удалил аккаунт: переписка удаляется у обоих
  async close(meta) {
    if (meta.kind !== 'dm') return refuse('bad request', 400)
    await this.ctx.storage.deleteAll()
    await this.tellGone(meta, Object.keys(meta.members))
    return Response.json({ ok: true })
  }

  // Каждому участнику — в его экземпляр Account: в чате новое сообщение. Кто не ответил, узнает при следующем
  async notify(meta, msg) {
    const people = Object.keys(meta.members)
    const about = (id) => (meta.kind === 'dm' ? { with: people.find((other) => other !== id) } : { name: meta.name })
    await Promise.allSettled(people.map(async (id) => this.account(id, '/chatnote', { chat: meta.id, kind: meta.kind, ...about(id), msg })))
  }

  async tellGone(meta, people) {
    await Promise.allSettled(people.map(async (id) => this.account(id, '/chatgone', { chat: meta.id })))
  }

  account(id, path, body) {
    const space = this.env.ACCOUNT
    return space.get(space.idFromName(`gh:${id}`)).fetch(new Request(`https://account${path}`, { method: 'POST', body: JSON.stringify(body) }))
  }
}
