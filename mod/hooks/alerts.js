// Системные уведомления о сессиях Claude Code на этом компьютере: «ждёт тебя» (разрешение или вопрос) и «закончил
// ход». То же, что всплывашки во вкладке «Агенты», но поверх всех окон и со звуком — видно, даже когда Claude Code
// свёрнут. Что случилось за ALERT_GATHER_MS, — одним уведомлением; на весь компьютер — не чаще раза в ALERT_GAP_MS.
// Объявляет одна сессия: что уже объявлено и кто объявлял — в $.store под ALERTS_KEY (как напоминания календаря)
import { fill } from './chats.js'

export const ALERT_GATHER_MS = 6_000 // события за столько — одной пачкой
export const ALERT_GAP_MS = 30_000 // уведомления о сессиях на весь компьютер — не чаще раза в столько
export const ALERT_KEEP_MS = 3_600_000 // столько помнить, о чём уже объявляли
export const ALERT_HOLD_S = 15 // «ждёт тебя» держится дольше обычной карточки: человек мог отойти
export const ALERTS_KEY = 'agentAlerts'
// Чей повтор «ждёт тебя» звучит: { by, evs } — id повтора и о каких событиях он. Повтор начала другая сессия — мой смолкает,
// а его события она берёт к себе: на компьютере звенит одна
export const AGAIN_KEY = 'agentAlertsAgain'
const AGAIN_EVS_MAX = 20
const TOLD_MAX = 200 // столько последних объявленных помнить
const NAMES_MAX = 3 // в заголовке — столько имён сессий, остальные — числом

// Что сейчас с сессией для всплывашек и уведомлений: каждый новый вопрос — заново
export const seenOf = (r) => (r.status === 'permission' && r.ask?.kind === 'question' ? `question:${r.ask.id}` : r.status)

// О чём уведомлять: 'permission', 'question', 'done'
export const alertWhat = (r) => (r.status === 'done' ? 'done' : r.ask?.kind === 'question' ? 'question' : 'permission')

// Ключ события — одинаковый во всех сессиях: id сессии, состояние и с каких пор оно
export const alertKey = (r) => `${r.sid}|${seenOf(r)}|${r.since}`

// { by, last, told } из $.store: by — какая сессия объявляла последней, last — когда, told — ключ → когда объявлено.
// Старое и странное — забыть
export function restoreAlerts(raw, now) {
  const ok = raw && typeof raw === 'object' && !Array.isArray(raw)
  const told = {}
  if (ok && raw.told && typeof raw.told === 'object' && !Array.isArray(raw.told)) {
    for (const [key, at] of Object.entries(raw.told)) if (key.length <= 300 && Number.isFinite(at) && now - at < ALERT_KEEP_MS) told[key] = at
  }
  return { by: ok && typeof raw.by === 'string' ? raw.by : '', last: ok && Number.isFinite(raw.last) && raw.last <= now ? raw.last : 0, told: keepTold(told) }
}

// { by, evs } повтора из $.store: события { key, sid, seen, name, what } — только «ждёт тебя»; странное — забыть
export function restoreAgain(raw) {
  const ok = raw && typeof raw === 'object' && !Array.isArray(raw)
  const evs = []
  for (const ev of ok && Array.isArray(raw.evs) ? raw.evs : []) {
    if (!ev || typeof ev !== 'object' || (ev.what !== 'permission' && ev.what !== 'question')) continue
    if (!['key', 'sid', 'seen', 'name'].every((k) => typeof ev[k] === 'string' && ev[k].length <= 300)) continue
    evs.push({ key: ev.key, sid: ev.sid, seen: ev.seen, name: ev.name, what: ev.what })
  }
  return { by: ok && typeof raw.by === 'string' ? raw.by : '', evs: evs.slice(0, AGAIN_EVS_MAX) }
}

// Не больше TOLD_MAX — самые свежие
export function keepTold(told) {
  return Object.fromEntries(
    Object.entries(told)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOLD_MAX),
  )
}

const WHAT_LABEL = { permission: 'ждёт разрешения', question: 'ждёт ответа', done: 'закончил ход' }

// Текст уведомления о пачке событий { sid, name, what }: заголовок — кто ждёт (или кто закончил, если ждущих нет),
// строка — каждая сессия и что с ней. kind — 'wait' или 'done': какой звук. Пусто — null. t — перевод строки
export function alertText(events, t) {
  if (!events.length) return null
  const waiting = events.filter((e) => e.what !== 'done')
  const heads = waiting.length ? waiting : events
  const names = [...new Set(heads.map((e) => e.name))]
  const shown = names.length > NAMES_MAX ? `${names.slice(0, NAMES_MAX).join(', ')} +${names.length - NAMES_MAX}` : names.join(', ')
  const many = names.length > 1
  const head = waiting.length ? (many ? 'Ждут тебя: {0}' : 'Ждёт тебя: {0}') : many ? 'Claude закончил ход в сессиях: {0}' : 'Claude закончил ход: {0}'
  const order = [...waiting, ...events.filter((e) => e.what === 'done')]
  return { title: fill(t(head), [shown]), text: order.map((e) => `${e.name} — ${t(WHAT_LABEL[e.what])}`).join('; '), kind: waiting.length ? 'wait' : 'done' }
}
