// Twitch: кто из каналов сейчас в эфире. Мод присылает каналы человека (логины Twitch) — сайт отвечает, кто из них
// в эфире, и заодно — эфирами каталога Arcade (content/twitch.json). Регистрации у человека нет: свои каналы он
// хранит в моде. У сайта — приложение Twitch (секреты TWITCH_CLIENT_ID и TWITCH_CLIENT_SECRET): по ним он получает
// токен приложения и спрашивает Helix. Durable Object Twitch один на всех: токен, каналы и эфиры — в кеше, чтобы
// одинаковые вопросы разных людей не ходили в Twitch.
import CATALOG from '../content/twitch.json' with { type: 'json' }

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
export const LIVE_TTL_MS = MINUTE // эфиры
export const USER_TTL_MS = 7 * DAY // каналы, которые есть
const MISSING_TTL_MS = DAY // кого нет — вдруг заведёт канал
export const MAX_LOGINS = 50 // своих каналов в одном вопросе
// С одного адреса в сутки: вопросов, ради которых пришлось спрашивать Twitch, и новых, ещё не виданных каналов.
// Счётчики — в памяти объекта: лимит мягкий, но тому, кто шлёт запрос за запросом, памяти хватит
export const PER_IP_DAILY = { asks: 2000, logins: 300 }
const MAX_CACHED = 5000 // каналов в памяти
const FETCH_MS = 8000
export const LOGIN = /^[a-z0-9][a-z0-9_]{1,24}$/
const HELIX = 'https://api.twitch.tv/helix'
// Картинки каналов — только с CDN Twitch
const AVATAR = /^https:\/\/static-cdn\.jtvnw\.net\/[\w./%-]+$/

class KeysError extends Error {} // Twitch не принял ключи приложения
class LimitError extends Error {}

const clip = (text, max) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

// logins=a,b,c → список без повторов; что-то не так — null
export function parseLogins(text) {
  const list = String(text ?? '').toLowerCase().split(',').filter(Boolean)
  if (list.length > MAX_LOGINS || !list.every((l) => LOGIN.test(l))) return null
  return [...new Set(list)]
}

// --- Маршрут Worker'а -----------------------------------------------------------------------------------------
// /api/twitch?logins=a,b → { channels, missing, catalog }. channels — каналы из вопроса, которые есть на Twitch,
// missing — которых нет, catalog — каталог Arcade (эфиры 18+ из каталога не показываем).
// 400 — неверный вопрос, 503 — Twitch не настроен ({ error: 'off' }) или не принял ключи ({ error: 'keys' }),
// 429 — лимит адреса, 502 — Twitch не ответил
export async function twitch(request, env, url) {
  const logins = parseLogins(url.searchParams.get('logins'))
  if (!logins) return Response.json({ error: 'bad request' }, { status: 400 })
  if (!env.TWITCH || !env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) return Response.json({ error: 'off' }, { status: 503 })
  const forward = new Request(`https://twitch/?logins=${logins.join(',')}`, { headers: { 'X-IP': request.headers.get('CF-Connecting-IP') || '' } })
  return env.TWITCH.get(env.TWITCH.idFromName('all')).fetch(forward)
}

// --- Кеш ------------------------------------------------------------------------------------------------------
const today = (now) => new Date(now).toISOString().slice(0, 10)

// Адрес — только меткой и только в памяти
async function ipTag(ip) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`twitch|${ip}`))
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Кто есть на Twitch — в хранилище (u:<логин> → { at, id, name, avatar } или { at, none: true }) и в памяти;
// эфиры — только в памяти: они живут минуту, писать их на диск незачем. Токен приложения — token → { value, until }
export class Twitch {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.users = new Map()
    this.live = new Map() // логин → { at, stream | null }
    this.ips = new Map()
    this.access = null
    this.queue = Promise.resolve() // обращения к Twitch — по одному: второй вопрос возьмёт ответ первого из кеша
  }

  async fetch(request) {
    const logins = parseLogins(new URL(request.url).searchParams.get('logins'))
    if (!logins) return Response.json({ error: 'bad request' }, { status: 400 })
    try {
      const run = this.queue.then(() => this.refresh(logins, request.headers.get('X-IP') || ''))
      this.queue = run.catch(() => {})
      await run
    } catch (error) {
      if (error instanceof LimitError) return Response.json({ error: 'limit' }, { status: 429 })
      if (error instanceof KeysError) return Response.json({ error: 'keys' }, { status: 503 })
      return Response.json({ error: 'upstream' }, { status: 502 })
    }
    return Response.json(this.answer(logins))
  }

  // Освежить, что устарело: кого ещё не знаем — users, у кого старый эфир — streams
  async refresh(mine, ip) {
    const now = Date.now()
    const all = [...new Set([...mine, ...CATALOG.channels.map((c) => c.login)])]
    if (this.users.size > MAX_CACHED) {
      this.users.clear()
      this.live.clear()
    }
    await this.restore(all.filter((l) => !this.users.has(l)))
    const known = (l) => {
      const u = this.users.get(l)
      return u && now - u.at < (u.none ? MISSING_TTL_MS : USER_TTL_MS)
    }
    const unknown = all.filter((l) => !known(l))
    const stale = (l) => this.users.get(l)?.id && now - (this.live.get(l)?.at ?? 0) >= LIVE_TTL_MS
    if (!unknown.length && !all.some(stale)) return
    await this.count(ip, mine.filter((l) => !known(l)).length, now)
    if (unknown.length) await this.lookup(unknown, now)
    const old = all.filter(stale)
    if (old.length) await this.streams(old, now)
  }

  async restore(logins) {
    for (let i = 0; i < logins.length; i += 100) {
      const saved = await this.ctx.storage.get(logins.slice(i, i + 100).map((l) => `u:${l}`))
      for (const [key, value] of saved) if (value) this.users.set(key.slice(2), value)
    }
  }

  async count(ip, fresh, now) {
    if (!ip) return
    const day = today(now)
    if (this.ips.size && ![...this.ips.keys()][0].startsWith(day)) this.ips.clear()
    const key = `${day}:${await ipTag(ip)}`
    const seen = this.ips.get(key) ?? { asks: 0, logins: 0 }
    if (seen.asks >= PER_IP_DAILY.asks || seen.logins + fresh > PER_IP_DAILY.logins) throw new LimitError()
    this.ips.set(key, { asks: seen.asks + 1, logins: seen.logins + fresh })
  }

  async lookup(logins, now) {
    const found = new Map()
    for (let i = 0; i < logins.length; i += 100) {
      const data = await this.helix('users', logins.slice(i, i + 100).map((l) => ['login', l]))
      for (const u of data?.data ?? []) {
        const login = String(u?.login ?? '').toLowerCase()
        if (!LOGIN.test(login) || !/^\d{1,20}$/.test(String(u.id ?? ''))) continue
        const avatar = AVATAR.test(u.profile_image_url ?? '') ? u.profile_image_url : ''
        found.set(login, { at: now, id: String(u.id), name: clip(u.display_name, 40) || login, ...(avatar ? { avatar } : {}) })
      }
    }
    for (const login of logins) {
      const user = found.get(login) ?? { at: now, none: true }
      this.users.set(login, user)
      await this.ctx.storage.put(`u:${login}`, user)
    }
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(now + DAY)
  }

  async streams(logins, now) {
    const on = new Map()
    for (let i = 0; i < logins.length; i += 100) {
      const data = await this.helix('streams', [['first', '100'], ...logins.slice(i, i + 100).map((l) => ['user_login', l])])
      for (const s of data?.data ?? []) {
        const login = String(s?.user_login ?? '').toLowerCase()
        if (s?.type !== 'live' || !LOGIN.test(login)) continue
        const since = Date.parse(s.started_at)
        on.set(login, {
          title: clip(s.title, 140),
          game: clip(s.game_name, 60),
          viewers: Number.isFinite(s.viewer_count) ? s.viewer_count : 0,
          ...(Number.isFinite(since) ? { since } : {}),
          mature: s.is_mature === true,
        })
      }
    }
    for (const login of logins) this.live.set(login, { at: now, stream: on.get(login) ?? null })
  }

  // Токен приложения: из памяти, из хранилища или новый. force — прежний Twitch не принял
  async token(force) {
    const now = Date.now()
    if (!force && !this.access) this.access = (await this.ctx.storage.get('token')) ?? null
    if (!force && this.access && this.access.until > now + MINUTE) return this.access.value
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: this.env.TWITCH_CLIENT_ID, client_secret: this.env.TWITCH_CLIENT_SECRET, grant_type: 'client_credentials' }),
      signal: AbortSignal.timeout(FETCH_MS),
    })
    if ([400, 401, 403].includes(response.status)) throw new KeysError()
    if (!response.ok) throw new Error(`token: ${response.status}`)
    const data = await response.json()
    if (typeof data?.access_token !== 'string' || !data.access_token) throw new Error('token: нет токена')
    this.access = { value: data.access_token, until: now + (Number(data.expires_in) || 3600) * 1000 }
    await this.ctx.storage.put('token', this.access)
    return this.access.value
  }

  // Вопрос к Helix; на 401 — один раз с новым токеном (старый истёк или ключи поменяли)
  async helix(path, params) {
    const url = new URL(`${HELIX}/${path}`)
    for (const [k, v] of params) url.searchParams.append(k, v)
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url, {
        headers: { 'Client-Id': this.env.TWITCH_CLIENT_ID, Authorization: `Bearer ${await this.token(attempt > 0)}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_MS),
      })
      if (response.status === 401 && attempt === 0) continue
      if (response.status === 401) throw new KeysError()
      if (!response.ok) throw new Error(`helix ${path}: ${response.status}`)
      return response.json()
    }
  }

  view(login) {
    const user = this.users.get(login)
    const stream = this.live.get(login)?.stream ?? null
    return { login, name: user.name, ...(user.avatar ? { avatar: user.avatar } : {}), live: stream }
  }

  // Ответ из кеша: свои каналы — в порядке вопроса; каталог — сначала эфиры (больше зрителей — выше), потом остальные
  answer(mine) {
    const exists = (l) => Boolean(this.users.get(l)?.id)
    const catalog = CATALOG.channels
      .filter((c) => exists(c.login) && !this.live.get(c.login)?.stream?.mature)
      .map((c, k) => ({ ...this.view(c.login), topics: c.topics, k }))
      .sort((a, b) => (b.live?.viewers ?? -1) - (a.live?.viewers ?? -1) || a.k - b.k)
      .map(({ k, ...c }) => c)
    return { channels: mine.filter(exists).map((l) => this.view(l)), missing: mine.filter((l) => this.users.get(l)?.none), catalog }
  }

  // Раз в сутки — убрать из хранилища давно не спрошенные каналы
  async alarm() {
    const now = Date.now()
    const all = await this.ctx.storage.list({ prefix: 'u:' })
    const stale = [...all].filter(([, v]) => now - (v?.at ?? 0) >= USER_TTL_MS).map(([k]) => k)
    for (let i = 0; i < stale.length; i += 128) await this.ctx.storage.delete(stale.slice(i, i + 128))
    for (const k of stale) this.users.delete(k.slice(2))
    if (all.size > stale.length) await this.ctx.storage.setAlarm(now + DAY)
  }
}
