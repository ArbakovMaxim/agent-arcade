// Своя тема пользователя: поиск видео (YouTube), статей (Hacker News) и подкастов (Apple Podcasts).
// Мод присылает короткий английский запрос, ответ живёт в кеше — Durable Object Discover, по одному на вид поиска:
// одинаковые запросы разных людей не тратят квоту YouTube. Ссылки на статьи и подкасты подписаны секретом
// LINK_SECRET: страницы /read и /listen открывают только подписанное или то, что есть в лентах Arcade.

const HOUR = 3_600_000
const DAY = 24 * HOUR
export const KINDS = ['youtube', 'articles', 'podcasts']
export const TTL_MS = { youtube: 24 * HOUR, articles: 12 * HOUR, podcasts: 12 * HOUR }
// Поиск YouTube стоит 100 единиц из 10 000 в сутки; потолок можно поменять переменной YT_DAILY_SEARCHES
export const YT_DAILY = 90
// Новых (не из кеша) поисков с одного адреса в сутки: один человек не съест квоту за всех
export const PER_IP_DAILY = { youtube: 10, articles: 60, podcasts: 60 }
const FETCH_MS = 8000
const SINCE_DAYS = 730 // видео и статьи — за два года
const SHOW_DAYS = 400 // подкаст, который больше года молчит, не показываем
const MIN_POINTS = 20 // статья с Hacker News — только если её заметили
const MIN_EPISODES = 5 // подкаст на пару выпусков — скорее проба, чем шоу
const VIDEO_ID = /^[\w-]{11}$/
// Ссылки не на статьи: видео и соцсети
const NOT_ARTICLES = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|twitter\.com|x\.com|bsky\.app|news\.ycombinator\.com|reddit\.com)$/
// Жанры Apple Podcasts, которые не показываем: политика и взрослое
const SKIP_GENRES = new Set(['Politics', 'Government', 'News Commentary', 'Sexuality'])

// Запрос → нижний регистр, латиница, цифры и + # . -; короче двух букв — не запрос
export function normalQuery(text) {
  const q = String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim()
  return q.length >= 2 ? q : ''
}

// Только https и без логина в адресе; адрес — в том виде, в каком его вернёт new URL (так же его проверит /read)
export function httpsLink(text) {
  try {
    const url = new URL(String(text ?? ''))
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

const clip = (text, max) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

// Похоже на английский: только латиница, без ¿¡ и без россыпи букв с диакритикой (испанский, французский…).
// Язык ленты подкаста мод проверит ещё и по её <language>
export function looksEnglish(text) {
  const s = String(text ?? '')
  if (/[¿¡]/.test(s) || /(?=\p{L})\P{Script=Latin}/u.test(s)) return false
  return (s.match(/[À-ÿĀ-ž]/g) ?? []).length < 2
}

// --- Подпись ссылок: HMAC-SHA256, первые 16 байт в base64url (22 знака) ----------------------------------------
const keys = new Map()
function hmacKey(secret) {
  if (!keys.has(secret)) {
    const raw = new TextEncoder().encode(secret)
    keys.set(secret, crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']))
  }
  return keys.get(secret)
}

export async function sign(secret, payload) {
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(payload)))
  return btoa(String.fromCharCode(...mac.slice(0, 16)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function signed(secret, payload, s) {
  if (!secret || typeof s !== 'string' || s.length !== 22) return false
  const want = await sign(secret, payload)
  let diff = 0
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ s.charCodeAt(i)
  return diff === 0
}

export const readPayload = (link) => `read|${link}`
export const listenPayload = (id, name) => `listen|${id}|${name}`

// --- Источники ------------------------------------------------------------------------------------------------
class QuotaError extends Error {}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_MS), headers: { Accept: 'application/json' } })
  if (response.status === 403 && url.hostname === 'www.googleapis.com') {
    const reason = (await response.json().catch(() => null))?.error?.errors?.[0]?.reason
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw new QuotaError(reason)
  }
  if (!response.ok) throw new Error(`${url.hostname}: ${response.status}`)
  return response.json()
}

const withParams = (base, params) => {
  const url = new URL(base)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  return url
}

// PT1H2M3S → секунды
export function isoSeconds(text) {
  const m = String(text ?? '').match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/)
  return m ? (Number(m[1]) || 0) * 86400 + (Number(m[2]) || 0) * 3600 + (Number(m[3]) || 0) * 60 + (Number(m[4]) || 0) : 0
}

// Видео: поиск (100 единиц квоты) и подробности найденного (1 единица) — без Shorts, трансляций, видео 18+ и
// с озвучкой не на английском. Ответ — в том же виде, что видео из лент каналов у мода
async function youtube(q, env, now) {
  const key = env.YOUTUBE_KEY
  const found = await getJson(
    withParams('https://www.googleapis.com/youtube/v3/search', {
      part: 'snippet', type: 'video', q, maxResults: 25, relevanceLanguage: 'en', safeSearch: 'strict',
      videoEmbeddable: 'true', publishedAfter: new Date(now - SINCE_DAYS * DAY).toISOString(), key,
    }),
  )
  const ids = [...new Set((found.items ?? []).map((i) => i?.id?.videoId).filter((id) => VIDEO_ID.test(id || '')))]
  if (!ids.length) return { videos: [] }
  const details = await getJson(
    withParams('https://www.googleapis.com/youtube/v3/videos', { part: 'snippet,contentDetails,statistics', id: ids.join(','), key }),
  )
  const byId = new Map((details.items ?? []).map((v) => [v.id, v]))
  const videos = []
  for (const id of ids) {
    const v = byId.get(id)
    const s = v?.snippet
    if (!s) continue
    const seconds = isoSeconds(v.contentDetails?.duration)
    const about = clip(s.description, 300)
    const short = seconds < 60 || (seconds <= 180 && /#shorts?\b/i.test(`${s.title} ${s.description}`))
    const lang = s.defaultAudioLanguage || s.defaultLanguage || ''
    const published = Date.parse(s.publishedAt)
    if (short || s.liveBroadcastContent !== 'none' || (lang && !/^en\b/i.test(lang)) || !looksEnglish(s.title)) continue
    if (v.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted' || !Number.isFinite(published)) continue
    const views = Number(v.statistics?.viewCount)
    videos.push({ id, title: clip(s.title, 200), channel: clip(s.channelTitle, 80), published, ...(Number.isFinite(views) ? { views } : {}), about, seconds })
  }
  return { videos }
}

// Статья — если ссылка https, не на видео или соцсеть и не PDF
function article(title, link, published, extra = {}) {
  const href = httpsLink(link)
  if (!href || !title || !Number.isFinite(published) || !looksEnglish(title)) return null
  const url = new URL(href)
  if (NOT_ARTICLES.test(url.hostname) || /\.pdf$/i.test(url.pathname)) return null
  return { title: clip(title, 200), link: href, source: url.hostname.replace(/^www\./, ''), published, ...extra }
}

// Истории Hacker News со ссылкой и хотя бы MIN_POINTS очков — по технике находится много, по остальному мало
async function hackerNews(q, now) {
  const data = await getJson(
    withParams('https://hn.algolia.com/api/v1/search', {
      query: q, tags: 'story', hitsPerPage: 40,
      numericFilters: `created_at_i>${Math.floor((now - SINCE_DAYS * DAY) / 1000)},points>=${MIN_POINTS}`,
    }),
  )
  return (data.hits ?? []).map((hit) => article(hit?.title, hit?.url, Number(hit?.created_at_i) * 1000, { points: Number(hit?.points) || 0 })).filter(Boolean)
}

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }
const xmlText = (raw) =>
  String(raw ?? '')
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, e) => ENTITY[e])

// Свежие статьи Medium по тегу — на любую тему: тег из всего запроса, а если там пусто — из первого слова.
// Лента короткая (10 записей), разбор дешёвый; адрес — без хвоста ?source=rss…
async function medium(q) {
  const slug = q.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const first = q.split(' ')[0].replace(/[^a-z0-9]+/g, '')
  const tags = [slug, ...(first.length >= 3 && first !== slug ? [first] : [])]
  const out = []
  let answered = false
  for (const tag of tags) {
    if (!tag || out.length >= 5) break
    const response = await fetch(`https://medium.com/feed/tag/${tag}`, { signal: AbortSignal.timeout(FETCH_MS), headers: { Accept: 'application/rss+xml' } })
    if (!response.ok) continue
    answered = true
    const xml = (await response.text()).slice(0, 400_000)
    for (const chunk of xml.split('<item>').slice(1, 11)) {
      const link = httpsLink(xmlText(chunk.match(/<link>([\s\S]*?)<\/link>/)?.[1]).trim())
      if (!link) continue
      const url = new URL(link)
      url.search = ''
      url.hash = ''
      const title = xmlText(chunk.match(/<title>([\s\S]*?)<\/title>/)?.[1])
      const item = article(title, url.href, Date.parse(xmlText(chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1])))
      if (item) out.push(item)
    }
  }
  if (!answered) throw new Error('medium: no answer')
  return out
}

// Статьи: Hacker News и Medium вперемешку; каждая ссылка подписана для /read
async function articles(q, env, now) {
  const [hn, md] = await Promise.allSettled([hackerNews(q, now), medium(q)])
  if (hn.status === 'rejected' && md.status === 'rejected') throw hn.reason
  const lists = [hn.value ?? [], md.value ?? []]
  const items = []
  const seen = new Set()
  for (let i = 0; i < 40 && items.length < 30; i++) {
    for (const item of lists.map((list) => list[i])) {
      if (!item || seen.has(item.link) || items.length >= 30) continue
      seen.add(item.link)
      items.push({ ...item, s: await sign(env.LINK_SECRET, readPayload(item.link)) })
    }
  }
  return { items }
}

// Подкасты: шоу из Apple Podcasts без пометки explicit, живые (выпуск за SHOW_DAYS); ленты выпусков мод читает сам.
// Подпись шоу (номер и название) — пропуск для /listen
async function podcasts(q, env, now) {
  const data = await getJson(
    withParams('https://itunes.apple.com/search', { media: 'podcast', entity: 'podcast', term: q, country: 'US', lang: 'en_us', explicit: 'No', limit: 25 }),
  )
  const shows = []
  for (const r of data.results ?? []) {
    const feed = httpsLink(String(r?.feedUrl ?? '').replace(/^http:\/\//i, 'https://'))
    const name = clip(r?.collectionName, 80)
    const latest = Date.parse(r?.releaseDate)
    const genres = [r?.primaryGenreName, ...(Array.isArray(r?.genres) ? r.genres : [])]
    if (!/^\d{1,12}$/.test(String(r?.collectionId ?? '')) || !feed || !name || !looksEnglish(name) || r.collectionExplicitness === 'explicit') continue
    if (!(Number(r.trackCount) >= MIN_EPISODES)) continue
    if (!Number.isFinite(latest) || now - latest > SHOW_DAYS * DAY || genres.some((g) => SKIP_GENRES.has(g))) continue
    const id = `it${r.collectionId}`
    shows.push({ id, name, url: feed, latest, s: await sign(env.LINK_SECRET, listenPayload(id, name)) })
    if (shows.length >= 12) break
  }
  return { shows }
}

const SEARCH = { youtube, articles, podcasts }

// --- Маршруты Worker'а ----------------------------------------------------------------------------------------
// /api/discover?kind=youtube|articles|podcasts&q=<запрос> → { videos } | { items } | { shows }.
// 400 — неверный запрос, 503 — поиск не настроен (нет секрета или ключа), 429 — квота или лимит адреса, 502 — источник не ответил
export async function discover(request, env, url) {
  const kind = url.searchParams.get('kind') || ''
  const q = normalQuery(url.searchParams.get('q'))
  if (!KINDS.includes(kind) || !q) return Response.json({ error: 'bad request' }, { status: 400 })
  if (!env.DISCOVER || !env.LINK_SECRET || (kind === 'youtube' && !env.YOUTUBE_KEY)) return Response.json({ error: 'off' }, { status: 503 })
  const forward = new Request(`https://discover/?kind=${kind}&q=${encodeURIComponent(q)}`, {
    headers: { 'X-IP': request.headers.get('CF-Connecting-IP') || '' },
  })
  return env.DISCOVER.get(env.DISCOVER.idFromName(kind)).fetch(forward)
}

// /api/verify?kind=read&u=<статья>&s=<подпись> или ?kind=listen&f=<шоу>&n=<название>&s=<подпись> → { ok }
export async function verify(env, url) {
  const p = url.searchParams
  let payload = null
  if (p.get('kind') === 'read') {
    const link = httpsLink(p.get('u'))
    if (link) payload = readPayload(link)
  } else if (p.get('kind') === 'listen' && /^it\d{1,12}$/.test(p.get('f') || '')) {
    payload = listenPayload(p.get('f'), p.get('n') || '')
  }
  const ok = Boolean(payload) && (await signed(env.LINK_SECRET, payload, p.get('s') || ''))
  return Response.json({ ok })
}

// --- Кеш и лимиты ---------------------------------------------------------------------------------------------
const today = (now) => new Date(now).toISOString().slice(0, 10)

// Адрес хранится только как метка (хеш с секретом) и только до конца суток
async function ipTag(ip, secret) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}|${ip}`))
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Один Durable Object на вид поиска (idFromName(kind)): ответы по запросам q:<запрос> → { at, data },
// счётчики суток day:<дата> (поиски YouTube) и ip:<дата>:<метка>. Устаревшее удаляет будильник
export class Discover {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.pending = new Map()
  }

  async fetch(request) {
    const url = new URL(request.url)
    const kind = url.searchParams.get('kind')
    const q = normalQuery(url.searchParams.get('q'))
    if (!KINDS.includes(kind) || !q) return Response.json({ error: 'bad request' }, { status: 400 })
    const key = `q:${q}`
    // Одинаковый запрос уже ищется — ждём его ответ, а не ищем второй раз
    if (!this.pending.has(key)) {
      const run = this.run(kind, q, key, request.headers.get('X-IP') || '').finally(() => this.pending.delete(key))
      this.pending.set(key, run)
    }
    const { status, body } = await this.pending.get(key)
    return Response.json(body, { status })
  }

  async run(kind, q, key, ip) {
    const storage = this.ctx.storage
    const now = Date.now()
    const hit = await storage.get(key)
    if (hit && now - hit.at < TTL_MS[kind]) return { status: 200, body: hit.data }
    const day = today(now)
    const who = ip ? `ip:${day}:${await ipTag(ip, this.env.LINK_SECRET || '')}` : ''
    const mine = (who && (await storage.get(who))) || 0
    if (mine >= PER_IP_DAILY[kind]) return { status: 429, body: { error: 'limit' } }
    const cap = Number(this.env.YT_DAILY_SEARCHES) || YT_DAILY
    const used = kind === 'youtube' ? (await storage.get(`day:${day}`)) || 0 : 0
    if (used >= cap) return { status: 429, body: { error: 'quota' } }
    // Счётчики — до запроса: пока ждём источник, сюда могут прийти другие запросы
    if (kind === 'youtube') await storage.put(`day:${day}`, used + 1)
    if (who) await storage.put(who, mine + 1)
    await this.cleanLater(now)
    let data
    try {
      data = await SEARCH[kind](q, this.env, now)
    } catch (error) {
      if (error instanceof QuotaError) {
        await storage.put(`day:${day}`, cap)
        return { status: 429, body: { error: 'quota' } }
      }
      return { status: 502, body: { error: 'upstream' } }
    }
    await storage.put(key, { at: now, data })
    return { status: 200, body: data }
  }

  async cleanLater(now) {
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(now + 6 * HOUR)
  }

  async alarm() {
    const now = Date.now()
    const day = today(now)
    const ttl = Math.max(...Object.values(TTL_MS))
    const all = await this.ctx.storage.list()
    const stale = [...all].filter(([k, v]) => (k.startsWith('q:') ? now - (v?.at ?? 0) >= ttl : !k.includes(`:${day}`))).map(([k]) => k)
    for (let i = 0; i < stale.length; i += 128) await this.ctx.storage.delete(stale.slice(i, i + 128))
    if (all.size > stale.length) await this.ctx.storage.setAlarm(now + 6 * HOUR)
  }
}
