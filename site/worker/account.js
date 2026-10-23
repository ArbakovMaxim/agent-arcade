// Аккаунты Arcade: вход через GitHub по коду (device flow) и настройки мода, общие для всех компьютеров человека.
// Мод просит код (/api/auth/start), человек вводит его на github.com/login/device, мод спрашивает, вошёл ли он
// (/api/auth/poll). Токен GitHub до мода не доходит: по нему сайт узнаёт номер и имя профиля и сразу забывает токен.
// Мод получает свой ключ сессии Arcade — <номер GitHub>.<случайная строка>; сайт хранит только его хеш.
// Приложение GitHub — OAuth App с включённым Device Flow; его client ID не секрет и лежит в vars (GITHUB_CLIENT_ID),
// client secret сайту не нужен. Почты и доступа к репозиториям Arcade не просит: scope пустой.
// Durable Object Account: экземпляр 'auth' — вход, лимиты адресов и реестр @ников, экземпляр gh:<номер GitHub> —
// аккаунт человека и его друзья.
import { sign, signed } from './discover.js'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
export const IDLE_MS = 365 * DAY // аккаунт, в который год не заходили, удаляется со всеми настройками
export const MAX_SESSIONS = 10 // компьютеров с входом; одиннадцатый вход выталкивает самый старый
export const SETTINGS_MAX = 16 * 1024 // настроек — не больше 16 КБ JSON
export const MAX_KEYS = 50
const MAX_BODY = 32 * 1024
// С одного адреса в сутки: кодов и вопросов «вошёл ли». Код живёт 15 минут, вопрос — раз в 5 секунд: 180 на код.
// Счётчики — в памяти объекта 'auth', адрес — только меткой
export const PER_IP_DAILY = { starts: 30, polls: 1500 }
const FETCH_MS = 8000
const AGENT = 'agent-arcade' // API GitHub без User-Agent не отвечает
const TOKEN = /^(\d{1,20})\.[A-Za-z0-9_-]{43}$/
const DEVICE = /^[A-Za-z0-9_-]{8,100}$/
const USER_CODE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/
const GH_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const AVATAR = /^https:\/\/avatars\.githubusercontent\.com\/[\w./?=&%-]+$/
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/
// @ник: латиница, цифры и _, 4–32 знака, первый — буква; хранится строчными — Fefa и fefa один ник
export const HANDLE = /^[a-z][a-z0-9_]{3,31}$/
export const HANDLE_HOLD_MS = 30 * DAY // сменённый ник месяц держится за прежним хозяином: никто другой его не возьмёт
export const HANDLE_CHANGES = 5 // смен ника в сутки — чтобы не занимать чужие ники пачкой
export const TICKET_MS = 12 * 60 * MINUTE // сколько живёт подпись ника для сетевых игр
// Друзья: друзей вместе со своими заявками — не больше MAX_FRIENDS, заявок тебе — не больше MAX_INCOMING, заявок в
// сутки — REQUESTS_DAILY (и ник с опечаткой — тоже заявка: перебирать чужие ники незачем). Отклонённый месяц не может
// позвать снова: его заявка молча не доходит
export const MAX_FRIENDS = 100
export const MAX_INCOMING = 50
export const REQUESTS_DAILY = 20
export const DECLINE_HOLD_MS = 30 * DAY
const ACCOUNT_ID = /^\d{1,20}$/
// Ники, которыми легко выдать себя за Arcade, Claude или GitHub: сами слова и ники, где они — часть через _
const RESERVED = new Set(['administrator', 'anonymous', 'everyone', 'guest', 'help', 'helpdesk', 'info', 'moderator', 'mods', 'noreply', 'null', 'owner', 'root', 'security', 'staff', 'system', 'team', 'undefined', 'abuse', 'contact', 'postmaster', 'webmaster', 'robot', 'service', 'settings', 'account'])
const RESERVED_PARTS = ['arcade', 'admin', 'support', 'claude', 'anthropic', 'github', 'official', 'moderator', 'system']

class AppError extends Error {} // GitHub не принял приложение сайта: неверный client ID или Device Flow выключен
class LimitError extends Error {}

// Что делает адрес: метод и путь → [какой экземпляр, путь внутри объекта]
const ROUTES = {
  'POST /api/auth/start': ['auth', '/start'],
  'POST /api/auth/poll': ['auth', '/poll'],
  'POST /api/auth/logout': ['user', '/logout'],
  'GET /api/me': ['user', '/me'],
  'DELETE /api/me': ['user', '/delete'],
  'PUT /api/me/settings': ['user', '/settings'],
  'PUT /api/me/handle': ['user', '/handle'],
  'GET /api/me/friends': ['user', '/friends'],
  'POST /api/me/friends': ['user', '/befriend'],
  'POST /api/me/friends/accept': ['user', '/accept'],
  'POST /api/me/friends/remove': ['user', '/unfriend'],
}
const PATHS = new Set(Object.keys(ROUTES).map((r) => r.split(' ')[1]))

// Номер GitHub из ключа сессии в заголовке Authorization: Bearer <ключ>; ключ не того вида — null
export function sessionId(header) {
  const m = /^Bearer (\S+)$/.exec(header ?? '')
  return m ? (TOKEN.exec(m[1])?.[1] ?? null) : null
}

// Тело запроса — не больше MAX_BODY; больше — null
async function readBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) return null
  const text = await request.text()
  return text.length > MAX_BODY ? null : text
}

// --- Маршрут Worker'а -----------------------------------------------------------------------------------------
// POST /api/auth/start → { device, code, url, interval, expires }: код для github.com/login/device
// POST /api/auth/poll { device } → { status: 'pending' | 'expired' | 'denied' } или { status: 'ok', token, user }
// GET /api/me → { user, settings, handle?, ticket?, friends?, requests? } (сколько друзей и заявок тебе),
// PUT /api/me/settings { settings } → { settings },
// PUT /api/me/handle { handle } → { handle, ticket? }, POST /api/auth/logout, DELETE /api/me — с ключом сессии.
// 401 — ключа нет или он не подходит ({ error: 'auth' }), 503 — вход не настроен ({ error: 'off' }) или GitHub не
// принял приложение ({ error: 'app' }), 429 — лимит адреса, 502 — GitHub не ответил. Ник: 400 — не того вида
// ({ error: 'invalid' }) или запрещён ({ error: 'reserved' }), 409 — занят ({ error: 'taken' }), 429 — слишком
// часто меняли ({ error: 'often' }).
// Друзья: GET /api/me/friends → { friends, incoming, outgoing } — списки { id, handle } (друзья, заявки тебе, твои
// заявки); POST /api/me/friends { handle } — заявка по точному нику, POST /api/me/friends/accept { id } — принять,
// POST /api/me/friends/remove { id } — удалить друга, отклонить заявку или отменить свою; отвечают тем же списком,
// заявка — ещё и status: 'sent' | 'friends'. 400 — ник не того вида ({ error: 'invalid' }) или свой ({ error: 'self' }),
// 404 — такого ника нет ({ error: 'nobody' }) или заявки уже нет ({ error: 'gone' }), 409 — сначала возьми свой ник
// ({ error: 'nohandle' }), друзей и заявок уже много ({ error: 'full' }) или у него слишком много заявок
// ({ error: 'busy' }), 429 — заявок за сутки много ({ error: 'often' })
export async function account(request, env, url) {
  const route = ROUTES[`${request.method} ${url.pathname}`]
  if (!route) return Response.json({ error: PATHS.has(url.pathname) ? 'method' : 'not found' }, { status: PATHS.has(url.pathname) ? 405 : 404 })
  if (!env.ACCOUNT || !env.GITHUB_CLIENT_ID) return Response.json({ error: 'off' }, { status: 503 })
  const [who, path] = route
  let name = 'auth'
  if (who === 'user') {
    const id = sessionId(request.headers.get('Authorization'))
    if (!id) return Response.json({ error: 'auth' }, { status: 401 })
    name = `gh:${id}`
  }
  const body = request.method === 'POST' || request.method === 'PUT' ? await readBody(request) : ''
  if (body === null) return Response.json({ error: 'too big' }, { status: 413 })
  const forward = new Request(`https://account${path}`, {
    method: request.method === 'GET' ? 'GET' : 'POST',
    ...(body ? { body } : {}),
    headers: { 'X-IP': request.headers.get('CF-Connecting-IP') || '', Authorization: request.headers.get('Authorization') || '' },
  })
  return env.ACCOUNT.get(env.ACCOUNT.idFromName(name)).fetch(forward)
}

// --- Настройки ------------------------------------------------------------------------------------------------
// Настройки — { ключ: { v, at } }: значение и когда его поменяли. Из двух побеждает более позднее, по каждому ключу
// отдельно: язык, поменянный на одном компьютере, не затирает клавиши, поменянные на другом.
// Пришедшее проверяем: ключи — латиницей, at — число не из будущего (сутки — на расхождение часов). Не так — null
export function mergeSettings(stored, incoming, now) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return null
  const merged = { ...stored }
  for (const [key, item] of Object.entries(incoming)) {
    if (!KEY.test(key) || !item || typeof item !== 'object' || !('v' in item)) return null
    if (!Number.isFinite(item.at) || item.at < 0 || item.at > now + DAY) return null
    if (!merged[key] || item.at > merged[key].at) merged[key] = { v: item.v, at: item.at }
  }
  return Object.keys(merged).length > MAX_KEYS ? null : merged
}

// --- @ник ----------------------------------------------------------------------------------------------------
// Ник — подпись человека в сетевых играх и в друзьях (дальше — в чате). Друзья держатся за номер аккаунта, а не за
// ник, поэтому его можно менять когда угодно. Что пришло → ник строчными, без @ в начале; не строка — ''
export function normalHandle(text) {
  return typeof text === 'string' ? text.trim().replace(/^@/, '').toLowerCase() : ''
}

// Что не так с ником: 'invalid' — не того вида, 'reserved' — запрещён; подходит — null
export function handleProblem(handle) {
  if (!HANDLE.test(handle)) return 'invalid'
  if (RESERVED.has(handle) || handle.includes('anthropic') || handle.split('_').some((part) => RESERVED_PARTS.includes(part))) return 'reserved'
  return null
}

// Подпись ника для сетевых игр: мод получает её в /api/me и передаёт странице партии, комната проверяет — так в
// партии нельзя назваться чужим ником. Вид — <ник>.<до, секунды>.<HMAC> на LINK_SECRET; номера аккаунта в ней нет.
// Сменённый ник месяц не достанется другому, поэтому старая подпись, пока жива, никого не подставит
const namePayload = (handle, until) => `name|${handle}|${until}`

export async function nameTicket(secret, handle, now) {
  const until = Math.floor((now + TICKET_MS) / 1000)
  return `${handle}.${until}.${await sign(secret, namePayload(handle, until))}`
}

// Подпись верна и не истекла — ник; иначе null
export async function ticketName(secret, ticket, now) {
  const m = /^([a-z][a-z0-9_]{3,31})\.(\d{10})\.([A-Za-z0-9_-]{22})$/.exec(typeof ticket === 'string' ? ticket : '')
  if (!m || Number(m[2]) * 1000 <= now) return null
  return (await signed(secret, namePayload(m[1], m[2]), m[3])) ? m[1] : null
}

const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length
const today = (now) => new Date(now).toISOString().slice(0, 10)
const refuse = (error, status) => Response.json({ error }, { status })
const without = (map, id) => Object.fromEntries(Object.entries(map).filter(([key]) => key !== id))

// Тело запроса из мода: JSON-объект; не он — {}
function parsed(text) {
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

// Круг после того, как id стал другом: из заявок он уходит
const befriended = (circle, id, now) => ({
  ...circle,
  friends: { ...circle.friends, [id]: now },
  incoming: without(circle.incoming, id),
  outgoing: without(circle.outgoing, id),
  declined: without(circle.declined, id),
})

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomKey() {
  const raw = String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Экземпляр 'auth': коды GitHub, выдача ключей сессии и реестр ников — handle:<ник> → { id, until? } (чей ник и, если
// его отпустили, до какого времени он ещё держится за прежним хозяином) и owner:<номер> → { handle, changes } (ник
// человека и когда его меняли). Экземпляр gh:<номер> хранит user (номер, имя и картинка профиля), sessions (хеши
// ключей сессии), settings, handle, seen — когда человек последний раз заходил, и circle — его друзей и заявки
export class Account {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.ips = new Map()
  }

  async fetch(request) {
    const path = new URL(request.url).pathname
    const ip = request.headers.get('X-IP') || ''
    try {
      if (path === '/start') return await this.start(ip)
      if (path === '/poll') return await this.poll(await request.text(), ip)
      if (path === '/login') return await this.login(await request.json())
      if (path === '/claim') return await this.claim(await request.json())
      if (path === '/release') return await this.release(await request.json())
      if (path === '/lookup') return await this.lookup(await request.json())
      if (path === '/names') return await this.names(await request.json())
      // От экземпляров других людей: заявка, ответ на свою заявку, «забудь меня»
      if (path === '/incoming') return await this.incoming(await request.json())
      if (path === '/accepted') return await this.accepted(await request.json())
      if (path === '/drop') return await this.drop(await request.json())
      const hash = await this.session(request.headers.get('Authorization'))
      if (!hash) return Response.json({ error: 'auth' }, { status: 401 })
      if (path === '/me') return await this.me()
      if (path === '/settings') return await this.saveSettings(await request.text())
      if (path === '/handle') return await this.setHandle(await request.text())
      if (path === '/logout') return await this.logout(hash)
      if (path === '/delete') return await this.remove()
      if (path === '/friends') return await this.list()
      if (path === '/befriend') return await this.befriend(await request.text())
      if (path === '/accept') return await this.accept(await request.text())
      if (path === '/unfriend') return await this.unfriend(await request.text())
      return Response.json({ error: 'not found' }, { status: 404 })
    } catch (error) {
      if (error instanceof LimitError) return Response.json({ error: 'limit' }, { status: 429 })
      if (error instanceof AppError) return Response.json({ error: 'app' }, { status: 503 })
      return Response.json({ error: 'upstream' }, { status: 502 })
    }
  }

  async count(ip, kind) {
    if (!ip) return
    const day = today(Date.now())
    if (this.ips.size && ![...this.ips.keys()][0].startsWith(day)) this.ips.clear()
    const digest = await sha256(`account|${ip}`)
    const key = `${day}:${digest.slice(0, 16)}`
    const seen = this.ips.get(key) ?? { starts: 0, polls: 0 }
    if (seen[kind] >= PER_IP_DAILY[kind]) throw new LimitError()
    this.ips.set(key, { ...seen, [kind]: seen[kind] + 1 })
  }

  // Вопрос к github.com: форма в теле, ответ — JSON (с ошибкой — тоже)
  async github(url, params) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'User-Agent': AGENT },
      body: new URLSearchParams({ client_id: this.env.GITHUB_CLIENT_ID, ...params }),
      signal: AbortSignal.timeout(FETCH_MS),
    })
    const data = await response.json().catch(() => null)
    if (['device_flow_disabled', 'incorrect_client_credentials', 'unauthorized_client'].includes(data?.error)) throw new AppError()
    if (!data || (!response.ok && !data.error)) throw new Error(`github: ${response.status}`)
    return data
  }

  async start(ip) {
    await this.count(ip, 'starts')
    const data = await this.github('https://github.com/login/device/code', { scope: '' })
    const url = String(data.verification_uri ?? '')
    if (!DEVICE.test(data.device_code ?? '') || !USER_CODE.test(data.user_code ?? '') || !url.startsWith('https://github.com/')) throw new Error('github: странный код')
    return Response.json({
      device: data.device_code,
      code: data.user_code,
      url,
      interval: Math.min(Math.max(Number(data.interval) || 5, 1), 60),
      expires: Math.min(Math.max(Number(data.expires_in) || 900, 60), 3600),
    })
  }

  async poll(text, ip) {
    let device = null
    try {
      device = JSON.parse(text)?.device
    } catch {
      // не JSON — ниже ответим 400
    }
    if (typeof device !== 'string' || !DEVICE.test(device)) return Response.json({ error: 'bad request' }, { status: 400 })
    await this.count(ip, 'polls')
    const data = await this.github('https://github.com/login/oauth/access_token', { device_code: device, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' })
    if (data.error === 'authorization_pending') return Response.json({ status: 'pending' })
    if (data.error === 'slow_down') return Response.json({ status: 'pending', ...(Number(data.interval) > 0 ? { interval: Math.min(Number(data.interval), 60) } : {}) })
    if (data.error === 'expired_token' || data.error === 'incorrect_device_code') return Response.json({ status: 'expired' })
    if (data.error === 'access_denied') return Response.json({ status: 'denied' })
    if (typeof data.access_token !== 'string' || !data.access_token) throw new Error(`github: ${data.error ?? 'нет токена'}`)
    const user = await this.githubUser(data.access_token)
    // Токен GitHub больше не нужен: он нигде не сохраняется и через 8 часов истечёт сам
    const space = this.env.ACCOUNT
    const answer = await space.get(space.idFromName(`gh:${user.id}`)).fetch(new Request('https://account/login', { method: 'POST', body: JSON.stringify(user) }))
    const { token } = await answer.json()
    return Response.json({ status: 'ok', token, user })
  }

  // Кто вошёл: номер, имя и картинка профиля GitHub
  async githubUser(token) {
    const response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': AGENT, 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(FETCH_MS),
    })
    if (!response.ok) throw new Error(`github user: ${response.status}`)
    const data = await response.json()
    if (!Number.isSafeInteger(data?.id) || data.id <= 0 || !GH_LOGIN.test(data.login ?? '')) throw new Error('github user: странный ответ')
    return { id: String(data.id), login: data.login, ...(AVATAR.test(data.avatar_url ?? '') ? { avatar: data.avatar_url } : {}) }
  }

  // Новый вход — новый ключ сессии; сайт хранит только его хеш
  async login(user) {
    const now = Date.now()
    const token = `${user.id}.${randomKey()}`
    const old = await this.ctx.storage.get('user')
    const sessions = ((await this.ctx.storage.get('sessions')) ?? []).slice(-(MAX_SESSIONS - 1))
    sessions.push({ hash: await sha256(token), at: now })
    await this.ctx.storage.put({ user: { ...user, created: old?.created ?? now }, sessions, seen: now })
    await this.ctx.storage.setAlarm(now + IDLE_MS)
    return Response.json({ token })
  }

  // Ключ сессии подходит — его хеш; заодно раз в сутки отмечаем, что человек заходил
  async session(header) {
    const m = /^Bearer (\S+)$/.exec(header ?? '')
    if (!m || !TOKEN.test(m[1])) return null
    const hash = await sha256(m[1])
    const sessions = (await this.ctx.storage.get('sessions')) ?? []
    if (!sessions.some((s) => s.hash === hash)) return null
    const now = Date.now()
    if (now - ((await this.ctx.storage.get('seen')) ?? 0) >= DAY) {
      await this.ctx.storage.put('seen', now)
      await this.ctx.storage.setAlarm(now + IDLE_MS)
    }
    return hash
  }

  async me() {
    const { id, login, avatar } = (await this.ctx.storage.get('user')) ?? {}
    const handle = await this.ctx.storage.get('handle')
    const circle = await this.circle()
    const friends = Object.keys(circle.friends).length
    const requests = Object.keys(circle.incoming).filter((other) => !circle.friends[other]).length
    return Response.json({
      user: { id, login, ...(avatar ? { avatar } : {}) },
      settings: (await this.ctx.storage.get('settings')) ?? {},
      ...(await this.named(handle)),
      ...(friends ? { friends } : {}),
      ...(requests ? { requests } : {}),
    })
  }

  // Ник и его подпись для ответа; без ника — ничего, без LINK_SECRET — ник без подписи
  async named(handle) {
    if (!handle) return {}
    const secret = this.env.LINK_SECRET
    return { handle, ...(secret ? { ticket: await nameTicket(secret, handle, Date.now()) } : {}) }
  }

  // Вопрос к реестру ников в экземпляре 'auth'
  registry(path, body) {
    const space = this.env.ACCOUNT
    return space.get(space.idFromName('auth')).fetch(new Request(`https://account${path}`, { method: 'POST', body: JSON.stringify(body) }))
  }

  // Взять ник: проверить вид, спросить реестр, запомнить у себя
  async setHandle(text) {
    let handle = ''
    try {
      handle = normalHandle(JSON.parse(text)?.handle)
    } catch {
      // не JSON — ник пустой, ниже ответим 400
    }
    const problem = handleProblem(handle)
    if (problem) return Response.json({ error: problem }, { status: 400 })
    const { id } = (await this.ctx.storage.get('user')) ?? {}
    const answer = await this.registry('/claim', { id, handle })
    if (!answer.ok) return answer
    await this.ctx.storage.put('handle', handle)
    return Response.json(await this.named(handle))
  }

  // Реестр: ник свободен, держится за этим же человеком или его месяц прошёл — ник его; прежний ник держится месяц
  async claim({ id, handle }) {
    const now = Date.now()
    const owner = (await this.ctx.storage.get(`owner:${id}`)) ?? { changes: [] }
    if (owner.handle === handle) return Response.json({ handle })
    const record = await this.ctx.storage.get(`handle:${handle}`)
    const held = record && record.id !== id && !(record.until <= now)
    if (held) return Response.json({ error: 'taken' }, { status: 409 })
    const changes = owner.changes.filter((t) => now - t < DAY)
    if (changes.length >= HANDLE_CHANGES) return Response.json({ error: 'often' }, { status: 429 })
    await this.ctx.storage.put({
      [`handle:${handle}`]: { id },
      [`owner:${id}`]: { handle, changes: [...changes, now] },
      ...(owner.handle ? { [`handle:${owner.handle}`]: { id, until: now + HANDLE_HOLD_MS } } : {}),
    })
    return Response.json({ handle })
  }

  // Реестр: аккаунт удалён — его ник держится месяц, потом свободен
  async release({ id }) {
    const owner = await this.ctx.storage.get(`owner:${id}`)
    if (owner?.handle) await this.ctx.storage.put(`handle:${owner.handle}`, { id, until: Date.now() + HANDLE_HOLD_MS })
    await this.ctx.storage.delete(`owner:${id}`)
    return Response.json({ ok: true })
  }

  // Реестр: чей это ник сейчас. Сменённый или отпущенный ник, пока держится за прежним хозяином, — ничей
  async lookup({ handle }) {
    const record = typeof handle === 'string' && HANDLE.test(handle) ? await this.ctx.storage.get(`handle:${handle}`) : null
    if (!record || record.until) return refuse('nobody', 404)
    return Response.json({ id: record.id })
  }

  // Реестр: ники по номерам — для списка друзей; у удалённого аккаунта ника нет. Хранилище отдаёт не больше 128
  // ключей за раз
  async names({ ids }) {
    if (!Array.isArray(ids) || ids.length > MAX_FRIENDS + MAX_INCOMING || !ids.every((id) => typeof id === 'string' && ACCOUNT_ID.test(id))) return refuse('bad request', 400)
    const names = {}
    for (let i = 0; i < ids.length; i += 128) {
      const owners = await this.ctx.storage.get(ids.slice(i, i + 128).map((id) => `owner:${id}`))
      for (const [key, owner] of owners) if (owner?.handle) names[key.slice('owner:'.length)] = owner.handle
    }
    return Response.json({ names })
  }

  // --- Друзья ---------------------------------------------------------------------------------------------------
  // Круг человека — circle: friends, incoming (заявки ему) и outgoing (его заявки) — { номер: когда }, declined — кого
  // и когда он отклонил, asked — когда он звал в друзья за последние сутки. Друзья держатся за номер аккаунта, ники для
  // списка — из реестра. Дружба взаимная: каждая сторона хранит свой круг, экземпляры сообщают друг другу о заявках
  async circle() {
    const circle = (await this.ctx.storage.get('circle')) ?? {}
    return { friends: circle.friends ?? {}, incoming: circle.incoming ?? {}, outgoing: circle.outgoing ?? {}, declined: circle.declined ?? {}, asked: circle.asked ?? [] }
  }

  // Сохранить круг; старые отказы и заявки старше суток не храним
  async saveCircle(circle, now) {
    const declined = Object.fromEntries(Object.entries(circle.declined).filter(([, at]) => now - at < DECLINE_HOLD_MS))
    await this.ctx.storage.put('circle', { ...circle, declined, asked: circle.asked.filter((at) => now - at < DAY) })
  }

  // Вопрос к экземпляру другого человека
  person(id, path, body) {
    const space = this.env.ACCOUNT
    return space.get(space.idFromName(`gh:${id}`)).fetch(new Request(`https://account${path}`, { method: 'POST', body: JSON.stringify(body) }))
  }

  // Списки с никами: друзья — по нику, заявки — по времени. Кто сразу и друг, и в заявках — только друг. Номер без
  // ника в реестре — аккаунт удалён: он уходит из круга
  async list(status) {
    let circle = await this.circle()
    const ids = [...new Set([...Object.keys(circle.friends), ...Object.keys(circle.incoming), ...Object.keys(circle.outgoing)])]
    let names = {}
    if (ids.length) {
      const answer = await this.registry('/names', { ids })
      if (!answer.ok) throw new Error(`registry: ${answer.status}`)
      names = (await answer.json()).names ?? {}
    }
    const gone = ids.filter((id) => !names[id])
    if (gone.length) {
      circle = await this.circle()
      for (const id of gone) circle = { ...circle, friends: without(circle.friends, id), incoming: without(circle.incoming, id), outgoing: without(circle.outgoing, id) }
      await this.saveCircle(circle, Date.now())
    }
    const people = (map, skip) =>
      Object.entries(map)
        .filter(([id]) => names[id] && !skip.some((other) => other[id]))
        .sort((a, b) => a[1] - b[1])
        .map(([id]) => ({ id, handle: names[id] }))
    const friends = people(circle.friends, []).sort((a, b) => a.handle.localeCompare(b.handle))
    return Response.json({ ...(status ? { status } : {}), friends, incoming: people(circle.incoming, [circle.friends]), outgoing: people(circle.outgoing, [circle.friends, circle.incoming]) })
  }

  // Позвать в друзья по точному нику. Он уже звал тебя — это согласие, сразу друзья
  async befriend(text) {
    const handle = normalHandle(parsed(text).handle)
    if (!HANDLE.test(handle)) return refuse('invalid', 400)
    const mine = await this.ctx.storage.get('handle')
    if (!mine) return refuse('nohandle', 409)
    if (handle === mine) return refuse('self', 400)
    const { id: me } = (await this.ctx.storage.get('user')) ?? {}
    const now = Date.now()
    let circle = await this.circle()
    const asked = circle.asked.filter((at) => now - at < DAY)
    if (asked.length >= REQUESTS_DAILY) return refuse('often', 429)
    await this.saveCircle({ ...circle, asked: [...asked, now] }, now)
    const found = await this.registry('/lookup', { handle })
    if (found.status === 404) return refuse('nobody', 404)
    if (!found.ok) throw new Error(`registry: ${found.status}`)
    const { id } = await found.json()
    if (id === me) return refuse('self', 400)
    circle = await this.circle()
    if (circle.friends[id]) return this.list('friends')
    if (circle.incoming[id]) return this.welcome(id, me, 'friends')
    if (!circle.outgoing[id] && Object.keys(circle.friends).length + Object.keys(circle.outgoing).length >= MAX_FRIENDS) return refuse('full', 409)
    const answer = await this.person(id, '/incoming', { id: me })
    if (answer.status === 404) return refuse('nobody', 404)
    if (!answer.ok) throw new Error(`friend: ${answer.status}`)
    const { status } = await answer.json()
    if (status === 'full') return refuse('busy', 409)
    circle = await this.circle()
    const made = status === 'friends'
    await this.saveCircle(made ? befriended(circle, id, now) : { ...circle, outgoing: { ...circle.outgoing, [id]: now }, declined: without(circle.declined, id) }, now)
    return this.list(made ? 'friends' : 'sent')
  }

  async accept(text) {
    const { id } = parsed(text)
    if (typeof id !== 'string' || !ACCOUNT_ID.test(id)) return refuse('bad request', 400)
    const { id: me } = (await this.ctx.storage.get('user')) ?? {}
    return this.welcome(id, me)
  }

  // Принять заявку id: он узнаёт об этом, оба — друзья. Он её уже отменил или удалил аккаунт — заявки нет
  async welcome(id, me, status) {
    const now = Date.now()
    let circle = await this.circle()
    if (circle.friends[id]) return this.list(status)
    if (!circle.incoming[id]) return refuse('gone', 404)
    if (Object.keys(circle.friends).length + Object.keys(circle.outgoing).length >= MAX_FRIENDS) return refuse('full', 409)
    const answer = await this.person(id, '/accepted', { id: me })
    if (answer.status === 404) {
      circle = await this.circle()
      await this.saveCircle({ ...circle, incoming: without(circle.incoming, id) }, now)
      return refuse('gone', 404)
    }
    if (!answer.ok) throw new Error(`friend: ${answer.status}`)
    await this.saveCircle(befriended(await this.circle(), id, now), now)
    return this.list(status)
  }

  // Удалить друга или отменить свою заявку — он забывает тебя; отклонить заявку — молча: у того, кто звал, она так
  // и ждёт ответа, а снова позвать он сможет через месяц
  async unfriend(text) {
    const { id } = parsed(text)
    if (typeof id !== 'string' || !ACCOUNT_ID.test(id)) return refuse('bad request', 400)
    const { id: me } = (await this.ctx.storage.get('user')) ?? {}
    let circle = await this.circle()
    if (circle.friends[id] || circle.outgoing[id]) {
      const answer = await this.person(id, '/drop', { id: me })
      if (!answer.ok && answer.status !== 404) throw new Error(`friend: ${answer.status}`)
    }
    const now = Date.now()
    circle = await this.circle()
    const declined = circle.incoming[id] && !circle.friends[id] ? { ...circle.declined, [id]: now } : circle.declined
    await this.saveCircle({ ...circle, friends: without(circle.friends, id), incoming: without(circle.incoming, id), outgoing: without(circle.outgoing, id), declined }, now)
    return this.list()
  }

  // Заявка от id: 'friends' — уже друзья или этот человек сам звал id (тогда друзья теперь), 'sent' — заявка ждёт
  // ответа, 'full' — заявок слишком много. Аккаунта здесь нет — 404, и ничего не записываем
  async incoming({ id }) {
    if (typeof id !== 'string' || !ACCOUNT_ID.test(id) || !(await this.ctx.storage.get('user'))) return refuse('nobody', 404)
    const now = Date.now()
    const circle = await this.circle()
    if (circle.friends[id]) return Response.json({ status: 'friends' })
    if (circle.outgoing[id]) {
      await this.saveCircle(befriended(circle, id, now), now)
      return Response.json({ status: 'friends' })
    }
    if (circle.incoming[id] || circle.declined[id] > now - DECLINE_HOLD_MS) return Response.json({ status: 'sent' })
    if (Object.keys(circle.incoming).length >= MAX_INCOMING) return Response.json({ status: 'full' })
    await this.saveCircle({ ...circle, incoming: { ...circle.incoming, [id]: now } }, now)
    return Response.json({ status: 'sent' })
  }

  // id принял заявку этого человека — друзья. Заявки уже нет — 404
  async accepted({ id }) {
    const circle = await this.circle()
    if (circle.friends[id]) return Response.json({ ok: true })
    if (typeof id !== 'string' || !circle.outgoing[id] || !(await this.ctx.storage.get('user'))) return refuse('gone', 404)
    const now = Date.now()
    await this.saveCircle(befriended(circle, id, now), now)
    return Response.json({ ok: true })
  }

  // id удалил этого человека из друзей, отменил заявку или удалил аккаунт: забыть id. Нечего забывать — не пишем
  async drop({ id }) {
    const circle = await this.circle()
    if (typeof id !== 'string' || !(circle.friends[id] || circle.incoming[id] || circle.outgoing[id])) return Response.json({ ok: true })
    const now = Date.now()
    await this.saveCircle({ ...circle, friends: without(circle.friends, id), incoming: without(circle.incoming, id), outgoing: without(circle.outgoing, id) }, now)
    return Response.json({ ok: true })
  }

  async saveSettings(text) {
    let incoming = null
    try {
      incoming = JSON.parse(text)?.settings
    } catch {
      // не JSON — ниже ответим 400
    }
    const merged = mergeSettings((await this.ctx.storage.get('settings')) ?? {}, incoming, Date.now())
    if (!merged) return Response.json({ error: 'bad request' }, { status: 400 })
    if (bytes(merged) > SETTINGS_MAX) return Response.json({ error: 'too big' }, { status: 413 })
    await this.ctx.storage.put('settings', merged)
    return Response.json({ settings: merged })
  }

  // Выйти на этом компьютере: забыть его ключ сессии
  async logout(hash) {
    const sessions = (await this.ctx.storage.get('sessions')) ?? []
    await this.ctx.storage.put('sessions', sessions.filter((s) => s.hash !== hash))
    return Response.json({ ok: true })
  }

  // Удалить аккаунт: всё, что о человеке знает сайт
  async remove() {
    await this.forget()
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
    return Response.json({ ok: true })
  }

  // Год без входа — аккаунт удаляется; заходил — будильник переносится на год после последнего входа
  async alarm() {
    const seen = (await this.ctx.storage.get('seen')) ?? 0
    if (Date.now() - seen >= IDLE_MS) {
      await this.forget()
      await this.ctx.storage.deleteAll()
    } else await this.ctx.storage.setAlarm(seen + IDLE_MS)
  }

  // Перед удалением аккаунта — убрать его у друзей и у тех, с кем были заявки, и отпустить ник в реестре. Кто не
  // ответил, уберёт его сам: у номера в реестре больше нет ника
  async forget() {
    const { id } = (await this.ctx.storage.get('user')) ?? {}
    if (!id) return
    const circle = await this.circle()
    const others = new Set([...Object.keys(circle.friends), ...Object.keys(circle.incoming), ...Object.keys(circle.outgoing)])
    await Promise.allSettled([...others].map((other) => this.person(other, '/drop', { id })))
    if (await this.ctx.storage.get('handle')) {
      const answer = await this.registry('/release', { id })
      if (!answer.ok) throw new Error(`registry: ${answer.status}`)
    }
  }
}
