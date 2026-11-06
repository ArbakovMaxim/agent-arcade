// Arcade: лимиты Claude — окна подписки (5 часов, неделя, лимит расходов), заполнение контекста и расходы сессии.
// Цифры — самого Claude Code ($.session.usage: после хода и раз в полминуты): Arcade своих не считает. Окна лимитов — у
// учётной записи, общие для всех её сессий: другие сессии пишут свои замеры в отметки (agents.js), и на экране — самый
// свежий. Здесь же — что нужно очереди доски, чтобы узнать «кончился лимит» и продолжить после сброса (queue.js)
import { fill } from '../chats.js'
import { tr } from '../i18n.js'
import { S } from './state.js'
import { log } from './status.js'
import { agoText } from './agents.js'

export const WARN_AT = [90, 80] // всплывашка, когда окно лимита дошло до стольких процентов: о каждом пороге — раз
const WARNED_KEY = 'usageWarned' // в $.store: { 'вид|сброс': [порог, когда] } — о чём уже предупредили, во всех сессиях
const WARNED_KEEP_MS = 8 * 86_400_000 // предупреждения об окне без времени сброса — не дольше недели с хвостиком
export const LIMIT_LABEL = { five_hour: '5 часов', seven_day: 'Неделя', spend_limit: 'Лимит расходов' }
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

// me — последний замер этой сессии: { ctx, tokens, window, usd, limits: [{ kind, pct, reset }], at } или null; api —
// у этого Claude Code есть $.session.usage; warn — всплывашки 80 и 90% (настройка usageWarn)
S.us = { me: null, api: true, warn: true }

const t = (text) => tr(text, S.lang)
const pad = (n) => String(n).padStart(2, '0')
export const hhmm = (ms) => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Окна лимитов — коротко: вид, проценты, когда сброс (мс; 0 — неизвестно)
export function limitsOf(list) {
  return (Array.isArray(list) ? list : [])
    .filter((w) => w && typeof w.kind === 'string' && Number.isFinite(w.percentUsed))
    .map((w) => ({ kind: w.kind, pct: w.percentUsed, reset: Date.parse(w.resetsAt ?? '') || 0 }))
}

// Замер Claude Code ($.session.usage) → наш вид
function readingOf(u, at) {
  const ctx = u?.context ?? {}
  return {
    ctx: Number.isFinite(ctx.percent) ? ctx.percent : null,
    tokens: Number.isFinite(ctx.tokens) ? ctx.tokens : null,
    window: Number.isFinite(ctx.window) ? ctx.window : 0,
    usd: Number.isFinite(u?.cost?.usd) ? u.cost.usd : null,
    limits: limitsOf(u?.rateLimits),
    at,
  }
}

// Спросить Claude Code сейчас (без разбивки контекста — бесплатно). Не ответил — null, и api: false, пока не ответит
// (проверить заранее нельзя: $ пишется только вызовом, $.session.usage(...); у старого Claude Code его нет, а как он
// откажет — неизвестно). В журнал на экране не пишем: спрашиваем раз в полминуты, а что лимитов нет — экран скажет сам
export async function usageNow($) {
  try {
    const u = await $.session.usage()
    S.us.me = readingOf(u, await $.clock.now())
    S.us.api = true
    return S.us.me
  } catch {
    S.us.api = false
    return null
  }
}

// Окна лимитов для экрана: самый свежий замер, где они есть, — свой или другой сессии (others — их отметки)
export function freshLimits(others) {
  const all = [S.us.me, ...others.map((r) => r.usage)].filter((u) => Array.isArray(u?.limits) && u.limits.length)
  return all.sort((a, b) => b.at - a.at)[0] ?? null
}

// Окно, которое кончилось: 100% и больше, сброс ещё впереди; из нескольких — что сбросится позже: раньше Claude не ответит
export function spentWindow(limits, now) {
  const out = (limits ?? []).filter((w) => w.pct >= 100 && (!w.reset || w.reset > now))
  return out.sort((a, b) => b.reset - a.reset)[0] ?? null
}

// Ход кончился ошибкой API — не лимит ли это? { reset } (0 — время сброса неизвестно) или null
export async function limitHit($) {
  const now = await $.clock.now()
  const u = (await usageNow($)) ?? S.us.me
  const w = spentWindow(u?.limits, now)
  return w ? { reset: w.reset } : null
}

// Время на часах: «14:30»; через 20 часов и дальше — с днём недели: «Пт 09:00»
export const clockText = (ms, now) => (Math.abs(ms - now) >= 20 * 3_600_000 ? `${t(WEEKDAYS[new Date(ms).getDay()])} ${hhmm(ms)}` : hhmm(ms))

// «сбросится в 14:30 (через 1 ч 20 мин)»; через 20 часов и дальше — «сбросится в Пт 09:00»; уже прошло — «сбросился в 14:30»
export function resetText(reset, now) {
  if (!reset) return ''
  if (reset <= now) return fill(t('сбросился в {0}'), [clockText(reset, now)])
  if (reset - now >= 20 * 3_600_000) return fill(t('сбросится в {0}'), [clockText(reset, now)])
  return fill(t('сбросится в {0} (через {1})'), [hhmm(reset), t(agoText(reset - now))])
}

export const limitName = (kind) => (LIMIT_LABEL[kind] ? t(LIMIT_LABEL[kind]) : kind)
export const pctText = (pct) => `${Math.floor(pct)}%`
export const usdText = (usd) => `$${usd.toFixed(2)}`

// Всплывашка: окно лимита дошло до 80 или 90% — о каждом пороге каждого окна один раз во всех сессиях
export async function warnCheck($) {
  const me = S.us.me
  if (!S.us.warn || !me) return
  const hot = me.limits.map((w) => ({ w, p: WARN_AT.find((p) => w.pct >= p) })).filter((x) => x.p)
  if (!hot.length) return
  const now = await $.clock.now()
  const saved = await $.store.get(WARNED_KEY).catch(() => null)
  const warned = {}
  for (const [key, v] of Object.entries(saved && typeof saved === 'object' ? saved : {})) {
    const reset = Number(key.split('|')[1])
    if (Array.isArray(v) && !(reset && reset < now) && now - Number(v[1]) < WARNED_KEEP_MS) warned[key] = v
  }
  let fresh = false
  for (const { w, p } of hot) {
    const key = `${w.kind}|${w.reset}`
    if ((Number(warned[key]?.[0]) || 0) >= p) continue
    warned[key] = [p, now]
    fresh = true
    const when = resetText(w.reset, now)
    $.ui.toast(`${fill(t('Лимит Claude «{0}»: {1}'), [limitName(w.kind), pctText(w.pct)])}${when ? ` — ${when}` : ''}`)
  }
  if (fresh) await $.store.set(WARNED_KEY, warned).catch((err) => log(`лимиты: ${err?.message ?? err}`))
}
