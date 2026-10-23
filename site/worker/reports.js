// Отчёты об ошибках Arcade: человек пишет из мода, что сломалось, и отчёт ложится в Durable Object Reports — один
// экземпляр 'all'. Отправить может любой: без входа — POST /api/report, со входом — POST /api/me/report, тогда отчёт
// подписан номером и @ником. Читать и закрывать отчёты могут только админы — их номера GitHub перечислены в vars
// (ADMINS); это проверяет экземпляр Account админа (worker/account.js), сам Reports снаружи не виден.
// Хранятся последние KEEP открытых отчётов; закрытый удаляется. Адрес отправителя не хранится: для лимита — только
// метка от него с солью суток, и наутро счётчики начинаются заново.
import { cleanText } from './chat.js'

export const MAX_REPORT = 2000 // знаков в отчёте
export const KEEP = 1000 // открытых отчётов хранится; больше — уходят самые старые
export const PER_SENDER_DAILY = 10 // отчётов в сутки с одного адреса или аккаунта
export const DAILY = 300 // отчётов в сутки всего: чтобы шквал не забил хранилище
export const PAGE = 50 // отчётов за один раз, новые сверху
const MAX_BODY = 8 * 1024
const SURFACES = new Set(['terminal', 'desktop', 'vscode', 'mobile'])
const SYSTEMS = new Set(['windows', 'mac', 'linux'])
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/
const LANG = /^[a-z]{2}$/
const ACCOUNT_ID = /^\d{1,20}$/

const refuse = (error, status) => Response.json({ error }, { status })
const today = (now) => new Date(now).toISOString().slice(0, 10)
const key = (id) => `r:${String(id).padStart(10, '0')}`

// Тело запроса из мода: JSON-объект; не он — {}
function parsed(text) {
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Что пришло от мода → { report: { text, version?, surface?, lang?, os? } } или { error: 'empty' | 'long' }. Текст —
// как у сообщений чата, без управляющих знаков; версия, поверхность, язык и система — только знакомого вида, иначе
// их нет. Кто отправил, решает сайт, а не тело запроса
export function cleanReport(body) {
  const text = cleanText(body?.text)
  if (!text) return { error: 'empty' }
  if (text.length > MAX_REPORT) return { error: 'long' }
  const pick = (value, ok) => (typeof value === 'string' && ok(value) ? value : null)
  const fields = {
    version: pick(body.version, (v) => VERSION.test(v)),
    surface: pick(body.surface, (v) => SURFACES.has(v)),
    lang: pick(body.lang, (v) => LANG.test(v)),
    os: pick(body.os, (v) => SYSTEMS.has(v)),
  }
  return { report: { text, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null)) } }
}

// Номера GitHub админов из vars: через запятую или пробел; чужое — мимо
export function admins(env) {
  return new Set(String(env.ADMINS ?? '').split(/[\s,]+/).filter((id) => ACCOUNT_ID.test(id)))
}

// Вопрос к экземпляру 'all'
export function askReports(env, path, body = {}) {
  return env.REPORTS.get(env.REPORTS.idFromName('all')).fetch(new Request(`https://reports${path}`, { method: 'POST', body: JSON.stringify(body) }))
}

// --- Маршрут Worker'а -----------------------------------------------------------------------------------------
// POST /api/report { text, version?, surface?, lang?, os? } → { ok, id } — отчёт без входа. 400 — пустой ('empty')
// или длинный ('long'), 405 — не POST, 413 — тело больше 8 КБ, 429 — с этого адреса за сутки много ('often'),
// 503 — отчёты выключены ('off') или за сутки их уже слишком много у всех ('full').
// Со входом — POST /api/me/report тем же телом; список — GET /api/me/reports → { reports, open }, закрыть —
// POST /api/me/reports/close { id } → { ok, open }: только админам, остальным 403 ({ error: 'admin' })
export async function report(request, env) {
  if (request.method !== 'POST') return refuse('method', 405)
  if (!env.REPORTS) return refuse('off', 503)
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) return refuse('too big', 413)
  const text = await request.text()
  if (text.length > MAX_BODY) return refuse('too big', 413)
  const clean = cleanReport(parsed(text))
  if (clean.error) return refuse(clean.error, 400)
  return addReport(env, clean.report, `ip:${request.headers.get('CF-Connecting-IP') || ''}`)
}

// Положить отчёт; sender — от кого он для лимита: ip:<адрес> или gh:<номер>
export function addReport(env, report, sender) {
  return askReports(env, '/add', { report, sender })
}

// Хранит meta — { seq: номер последнего отчёта, open: номера открытых по порядку }, r:<номер> — сам отчёт { id, at,
// text, version?, surface?, lang?, os?, from?: { id, handle? } } и day — счётчики суток { day, salt, total, senders }
export class Reports {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
  }

  async fetch(request) {
    const path = new URL(request.url).pathname
    try {
      const body = await request.json()
      if (path === '/add') return await this.add(body)
      if (path === '/list') return await this.list()
      if (path === '/close') return await this.close(body)
      if (path === '/forget') return await this.forget(body)
      return refuse('not found', 404)
    } catch {
      return refuse('upstream', 502)
    }
  }

  async meta() {
    return (await this.ctx.storage.get('meta')) ?? { seq: 0, open: [] }
  }

  // Новый отчёт — следующим номером. Лимиты — на сутки: отправителю PER_SENDER_DAILY, всем вместе DAILY
  async add({ report, sender }) {
    const now = Date.now()
    let day = (await this.ctx.storage.get('day')) ?? {}
    if (day.day !== today(now)) day = { day: today(now), salt: crypto.randomUUID(), total: 0, senders: {} }
    if (day.total >= DAILY) return refuse('full', 503)
    const tag = (await sha256(`${day.salt}|${sender}`)).slice(0, 16)
    if ((day.senders[tag] ?? 0) >= PER_SENDER_DAILY) return refuse('often', 429)
    day.total += 1
    day.senders[tag] = (day.senders[tag] ?? 0) + 1
    const meta = await this.meta()
    meta.seq += 1
    const id = meta.seq
    meta.open = [...meta.open, id]
    const old = meta.open.length > KEEP ? meta.open.splice(0, meta.open.length - KEEP) : []
    await this.ctx.storage.put({ meta, day, [key(id)]: { id, at: now, ...report } })
    // Хранилище удаляет не больше 128 ключей за раз
    for (let i = 0; i < old.length; i += 128) await this.ctx.storage.delete(old.slice(i, i + 128).map(key))
    return Response.json({ ok: true, id })
  }

  // Открытые отчёты, новые сверху, — последние PAGE; open — сколько открытых всего
  async list() {
    const meta = await this.meta()
    const ids = meta.open.slice(-PAGE).reverse()
    const found = ids.length ? await this.ctx.storage.get(ids.map(key)) : new Map()
    return Response.json({ reports: ids.map((id) => found.get(key(id))).filter(Boolean), open: meta.open.length })
  }

  // Закрыть — значит удалить: разобранный отчёт больше не нужен
  async close({ id }) {
    const meta = await this.meta()
    if (!meta.open.includes(id)) return refuse('gone', 404)
    meta.open = meta.open.filter((n) => n !== id)
    await this.ctx.storage.put('meta', meta)
    await this.ctx.storage.delete(key(id))
    return Response.json({ ok: true, open: meta.open.length })
  }

  // Аккаунт удалён: его отчёты остаются, но без подписи
  async forget({ id }) {
    if (typeof id !== 'string' || !ACCOUNT_ID.test(id)) return refuse('bad request', 400)
    const { open } = await this.meta()
    for (let i = 0; i < open.length; i += 128) {
      const found = await this.ctx.storage.get(open.slice(i, i + 128).map(key))
      const signed = [...found].filter(([, r]) => r.from?.id === id)
      if (signed.length) await this.ctx.storage.put(Object.fromEntries(signed.map(([k, { from, ...rest }]) => [k, rest])))
    }
    return Response.json({ ok: true })
  }
}
