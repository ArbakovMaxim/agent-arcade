// Уведомления на телефон (п. 39): когда сессия ждёт ответа дольше 2 минут, Arcade просит сайт прислать на телефон
// «сессия такая-то ждёт тебя». Здесь — чистые функции без $: кого звать, как назвать сессию, текст уведомления.
// В тексте только имя сессии — без текста вопроса, кода и имён файлов. Отправляет одна сессия на компьютере (ведущая,
// как у всплывающих уведомлений), не чаще раза в 5 минут; сайт сам держит те же 5 минут и 30 в сутки на аккаунт.
import { fill } from './chats.js'

export const PHONE_KEY = 'phoneSent' // $.store: { by, last, told } — кто отправил последним, когда и про какие ожидания
export const PHONE_PREF = 'phonePush' // $.store: включено ли на этом компьютере (по умолчанию нет)
export const PHONE_WAIT_MS = 120_000 // сессия ждёт дольше — зовём
export const PHONE_GAP_MS = 300_000 // не чаще раза в 5 минут
export const PHONE_RETRY_MS = 60_000 // сайт не ответил — пробуем через минуту
export const PHONE_POLL_MS = 3_000 // пока показан код — раз в 3 секунды спрашиваем, подключился ли телефон
export const PHONE_TEXT_MAX = 140 // сайт больше не примет
const NAME_MAX = 40

// Управляющие символы, разделители строк и знаки направления текста — сайт такой текст не примет
const BAD = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g

// Строки «Агентов», которые ждут разрешения дольше PHONE_WAIT_MS; скрытые человеком не зовём
export function phoneDue(all, now, hidden = []) {
  return (all ?? []).filter(
    (r) => r && r.status === 'permission' && Number.isFinite(r.since) && now - r.since >= PHONE_WAIT_MS && !hidden.includes(r.sid),
  )
}

// Обрезать по кодовым точкам, а не по половинкам суррогатных пар
function cut(text, max) {
  const points = Array.from(text)
  return points.length > max ? `${points.slice(0, max - 1).join('').trimEnd()}…` : text
}

// Имя сессии для уведомления: без управляющих символов, в одну строку, не длиннее 40 знаков
export function phoneName(name) {
  const clean = String(name ?? '')
    .replace(BAD, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return clean ? cut(clean, NAME_MAX) : 'Claude Code'
}

// Текст уведомления: одна сессия — «Сессия «имя» ждёт тебя», несколько — список имён; не влезает — хвост «+N»
export function phoneText(names, t = (s) => s) {
  const list = [...new Set((names ?? []).map(phoneName))]
  if (list.length <= 1) return cut(fill(t('Сессия «{0}» ждёт тебя'), [list[0] ?? 'Claude Code']), PHONE_TEXT_MAX)
  const many = (shown, rest) => fill(t('Ждут тебя сессии: {0}'), [shown.join(', ') + (rest ? ` +${rest}` : '')])
  for (let n = list.length; n >= 1; n--) {
    const text = many(list.slice(0, n), list.length - n)
    if (Array.from(text).length <= PHONE_TEXT_MAX) return text
  }
  return cut(many(list.slice(0, 1), list.length - 1), PHONE_TEXT_MAX)
}
