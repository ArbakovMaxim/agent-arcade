// Уведомления на телефон (п. 39): когда сессия ждёт ответа дольше 2 минут, Arcade просит сайт прислать на телефон
// «сессия такая-то ждёт тебя». Здесь — чистые функции без $: кого звать, как назвать сессию, текст уведомления.
// Ещё — «очередь на доске такой-то закончилась» или «остановилась», если 2 минуты после этого человек ничего не делал.
// В тексте только имя сессии и название доски — без текста вопроса, карточек, кода и имён файлов. Отправляет одна сессия
// на компьютере (ведущая, как у всплывающих уведомлений), не чаще раза в 5 минут; сайт сам держит те же 5 минут и 30 в
// сутки на аккаунт.
import { ALERT_KEEP_MS } from './alerts.js'
import { fill } from './chats.js'

export const PHONE_KEY = 'phoneSent' // $.store: { by, last, told } — кто отправил последним, когда и про какие ожидания
export const PHONE_PREF = 'phonePush' // $.store: включено ли на этом компьютере (по умолчанию нет)
export const PHONE_WAIT_MS = 120_000 // сессия ждёт дольше — зовём
export const PHONE_GAP_MS = 300_000 // не чаще раза в 5 минут
export const PHONE_RETRY_MS = 60_000 // сайт не ответил — пробуем через минуту
export const PHONE_POLL_MS = 3_000 // пока показан код — раз в 3 секунды спрашиваем, подключился ли телефон
export const PHONE_TEXT_MAX = 140 // сайт больше не примет
const NAME_MAX = 40
const BOARD_MAX = 200 // ключ «queue|доска» в отправленных — не длиннее 300

// Управляющие символы, разделители строк и знаки направления текста — сайт такой текст не примет
const BAD = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g

// Строки «Агентов», которые ждут разрешения дольше PHONE_WAIT_MS; скрытые человеком не зовём
export function phoneDue(all, now, hidden = []) {
  return (all ?? []).filter(
    (r) => r && r.status === 'permission' && Number.isFinite(r.since) && now - r.since >= PHONE_WAIT_MS && !hidden.includes(r.sid),
  )
}

// Почему очередь остановилась — только из этого списка (п. 39.1): кончился лимит, ошибка или отказ, карточка не в
// последней колонке, проверка не прошла, доску удалили. Ни текста Claude, ни названий карточек
export const QUEUE_WHY = {
  limit: 'кончился лимит Claude',
  error: 'ошибка',
  column: 'карточка не в последней колонке',
  check: 'проверка не прошла',
  deleted: 'доску удалили',
}
const COUNT_MAX = 999

// Конец очереди из отметки сессии: { board, title, kind: 'done' | 'stop', at, n, why, until } — n: сколько карточек
// сделано (у 'done'), why: причина из QUEUE_WHY (у 'stop'), until: когда сбросится лимит (у why 'limit', 0 — неизвестно).
// Чужие отметки — сырой JSON, странное — null или пустое поле
function queueEnd(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const { board, title, kind, at, n, why, until } = raw
  if (typeof board !== 'string' || !board || board.length > BOARD_MAX) return null
  if (kind !== 'done' && kind !== 'stop') return null
  if (!Number.isFinite(at) || at <= 0) return null
  const stop = kind === 'stop'
  const reason = stop && typeof why === 'string' && Object.hasOwn(QUEUE_WHY, why) ? why : ''
  return {
    board,
    title: typeof title === 'string' ? title.slice(0, BOARD_MAX) : '',
    kind,
    at,
    n: !stop && Number.isInteger(n) && n > 0 ? Math.min(n, COUNT_MAX) : 0,
    why: reason,
    until: reason === 'limit' && Number.isFinite(until) && until > 0 ? until : 0,
  }
}

// Ключ сообщённого конца очереди — по доске: несколько сессий на одной доске — одно уведомление
export const queueKey = (q) => `queue|${q.board}`

// Об этом конце очереди уже сообщили: told — когда сообщали о доске (или undefined). Сообщили раньше конца — это новый
// запуск очереди на той же доске, о нём сообщить снова
export const queueTold = (told, q) => Number.isFinite(told) && told >= q.at

// Очереди, о конце которых пора сообщить: сессия не скрыта, после конца ничего не делает (не работает и не ждёт — ожидание
// зовёт phoneDue), прошло PHONE_WAIT_MS, но не больше ALERT_KEEP_MS, человек с тех пор ни в одной сессии ничего не делал
// (look) и на этой доске больше нигде не идёт очередь. Одна доска — одна строка: «остановилась» важнее «закончилась»,
// причина — у последней остановки, карточки сессий, где очередь закончилась, складываются
export function phoneQueues(all, now, hidden = []) {
  const rows = (all ?? []).filter(Boolean)
  const by = new Map()
  for (const r of rows) {
    const q = queueEnd(r.qend)
    if (!q || hidden.includes(r.sid) || (r.status !== 'done' && r.status !== 'idle')) continue
    const since = Number.isFinite(r.since) ? Math.max(q.at, r.since) : q.at
    if (now - since < PHONE_WAIT_MS || now - q.at >= ALERT_KEEP_MS) continue
    if (rows.some((o) => (Number.isFinite(o.look) && o.look > q.at) || o.queue?.board === q.board)) continue
    const had = by.get(q.board)
    if (!had) {
      by.set(q.board, q)
      continue
    }
    const stop = [had, q].filter((x) => x.kind === 'stop').sort((a, b) => b.at - a.at)[0]
    by.set(q.board, {
      board: q.board,
      title: had.title || q.title,
      kind: stop ? 'stop' : 'done',
      at: Math.max(had.at, q.at),
      n: stop ? 0 : Math.min(had.n + q.n, COUNT_MAX),
      why: stop?.why ?? '',
      until: stop?.until ?? 0,
    })
  }
  return [...by.values()]
}

// Обрезать по кодовым точкам, а не по половинкам суррогатных пар
function cut(text, max) {
  const points = Array.from(text)
  return points.length > max ? `${points.slice(0, max - 1).join('').trimEnd()}…` : text
}

// Имя сессии или доски для уведомления: без управляющих символов, в одну строку, не длиннее 40 знаков
export function phoneName(name, none = 'Claude Code') {
  const clean = String(name ?? '')
    .replace(BAD, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return clean ? cut(clean, NAME_MAX) : none
}

// Ждущие сессии: одна — «Сессия «имя» ждёт тебя», несколько — список имён; не влезает — хвост «+N»
function waitText(list, t) {
  if (list.length <= 1) return cut(fill(t('Сессия «{0}» ждёт тебя'), [list[0] ?? 'Claude Code']), PHONE_TEXT_MAX)
  const many = (shown, rest) => fill(t('Ждут тебя сессии: {0}'), [shown.join(', ') + (rest ? ` +${rest}` : '')])
  for (let n = list.length; n >= 1; n--) {
    const text = many(list.slice(0, n), list.length - n)
    if (Array.from(text).length <= PHONE_TEXT_MAX) return text
  }
  return cut(many(list.slice(0, 1), list.length - 1), PHONE_TEXT_MAX)
}

// Строка о конце очереди: «…закончилась: карточек — 2», «…остановилась: проверка не прошла», для лимита —
// «…остановилась: лимит Claude до 14:30» (when — время сброса на часах, его готовит сессия; '' — неизвестно или прошло)
function queueLine(q, t) {
  const args = [phoneName(q.title, t('без названия'))]
  if (q.kind === 'done') return q.n > 0 ? fill(t('Очередь на доске «{0}» закончилась: карточек — {1}'), [...args, q.n]) : fill(t('Очередь на доске «{0}» закончилась'), args)
  const why = q.why === 'limit' && q.when ? fill(t('лимит Claude до {0}'), [q.when]) : Object.hasOwn(QUEUE_WHY, q.why) ? t(QUEUE_WHY[q.why]) : ''
  return why ? fill(t('Очередь на доске «{0}» остановилась: {1}'), [...args, why]) : fill(t('Очередь на доске «{0}» остановилась'), args)
}

// Текст уведомления: ждущие сессии (names) и концы очередей (queues — { title, kind, n, why, when }) через точку; не
// влезает — хвост «+N» из того, что не влезло
export function phoneText(names, t = (s) => s, queues = []) {
  const list = [...new Set((names ?? []).map((n) => phoneName(n)))]
  const parts = list.length || !queues.length ? [waitText(list, t)] : []
  for (const q of queues ?? []) parts.push(queueLine(q, t))
  for (let n = parts.length; n >= 1; n--) {
    const rest = parts.length - n
    const text = parts.slice(0, n).join('. ') + (rest ? ` +${rest}` : '')
    if (Array.from(text).length <= PHONE_TEXT_MAX) return text
  }
  return cut(parts[0], PHONE_TEXT_MAX)
}
