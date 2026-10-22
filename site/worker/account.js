// Аккаунты Arcade: вход через GitHub по коду (device flow) и настройки мода, общие для всех компьютеров человека.
// Мод просит код (/api/auth/start), человек вводит его на github.com/login/device, мод спрашивает, вошёл ли он
// (/api/auth/poll). Токен GitHub до мода не доходит: по нему сайт узнаёт номер и имя профиля и сразу забывает токен.
// Мод получает свой ключ сессии Arcade — <номер GitHub>.<случайная строка>; сайт хранит только его хеш.
// Приложение GitHub — OAuth App с включённым Device Flow; его client ID не секрет и лежит в vars (GITHUB_CLIENT_ID),
// client secret сайту не нужен. Почты и доступа к репозиториям Arcade не просит: scope пустой.
// Durable Object Account: экземпляр 'auth' — вход и лимиты адресов, экземпляр gh:<номер GitHub> — аккаунт человека.

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
// GET /api/me → { user, settings }, PUT /api/me/settings { settings } → { settings }, POST /api/auth/logout,
// DELETE /api/me — с ключом сессии. 401 — ключа нет или он не подходит ({ error: 'auth' }), 503 — вход не настроен
// ({ error: 'off' }) или GitHub не принял приложение ({ error: 'app' }), 429 — лимит адреса, 502 — GitHub не ответил
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

const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length
const today = (now) => new Date(now).toISOString().slice(0, 10)

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomKey() {
  const raw = String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Экземпляр 'auth': коды GitHub и выдача ключей сессии; экземпляр gh:<номер> хранит user (номер, имя и картинка
// профиля), sessions (хеши ключей сессии), settings и seen — когда человек последний раз заходил
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
      const hash = await this.session(request.headers.get('Authorization'))
      if (!hash) return Response.json({ error: 'auth' }, { status: 401 })
      if (path === '/me') return await this.me()
      if (path === '/settings') return await this.saveSettings(await request.text())
      if (path === '/logout') return await this.logout(hash)
      if (path === '/delete') return await this.remove()
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
    return Response.json({ user: { id, login, ...(avatar ? { avatar } : {}) }, settings: (await this.ctx.storage.get('settings')) ?? {} })
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
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
    return Response.json({ ok: true })
  }

  // Год без входа — аккаунт удаляется; заходил — будильник переносится на год после последнего входа
  async alarm() {
    const seen = (await this.ctx.storage.get('seen')) ?? 0
    if (Date.now() - seen >= IDLE_MS) await this.ctx.storage.deleteAll()
    else await this.ctx.storage.setAlarm(seen + IDLE_MS)
  }
}
