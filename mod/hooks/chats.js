// Чаты с друзьями: разбор ответов сайта Arcade. Сеть, экраны и опрос — в hooks/register.js. Переписка хранится на
// сайте и не зашифрована: мод только показывает её и отправляет новые сообщения. Чужой текст (сообщения, ники,
// названия групп) приходит с сайта — здесь из него убираются управляющие знаки: терминал принял бы их за команды
import { HANDLE, count, trouble } from './account.js'
import { jsonFrom } from './youtube.js'

// Чат двоих — d<меньший номер>-<больший>, группа — g и 16 знаков
export const CHAT_ID = /^(?:d\d{1,20}-\d{1,20}|g[A-Za-z0-9_-]{16})$/
const ACCOUNT_ID = /^\d{1,20}$/
// Код ссылки для страницы чата: <номер>.<до, секунды>.<начало хеша сессии>.<подпись>
const LINK = /^\d{1,20}\.\d{10}\.[0-9a-f]{12}\.[A-Za-z0-9_-]{22}$/
export const MAX_TEXT = 2000 // знаков в сообщении
export const MAX_MEMBERS = 50 // людей в группе вместе с хозяином
export const MAX_NAME = 40 // знаков в названии группы
const MAX_MESSAGES = 300 // сообщений в одном ответе — больше сайт не отдаёт
const KINDS = ['create', 'name', 'add', 'remove', 'leave']

const id = (value) => (typeof value === 'string' || Number.isSafeInteger(value) ? String(value) : '')
const accountId = (value) => (ACCOUNT_ID.test(id(value)) ? id(value) : '')

// Текст с сайта для экрана: переводы строк — \n, табуляция — пробел, без управляющих знаков (и C1), невидимых меток
// и знаков, переворачивающих направление текста; не строка — ''
export function cleanText(text) {
  if (typeof text !== 'string') return ''
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
}

// То же одной строкой, без пробелов по краям
export const oneLine = (text) => cleanText(text).replace(/\s+/g, ' ').trim()

// Первые n знаков (не половинки суррогатных пар)
const cut = (text, n) => [...text].slice(0, n).join('')

// Что не так с ответом про чаты: общие ошибки аккаунта (trouble) и свои — 'empty' (пустое сообщение или группа без
// людей), 'long' (длиннее MAX_TEXT), 'name' (группа без названия), 'invalid' (сайт не понял вопрос), 'friend' (писать
// можно только друзьям), 'owner' (это может только хозяин группы), 'gone' (чата нет или тебя в нём нет), 'full' (в
// группе больше MAX_MEMBERS), 'nohandle' (сначала свой @ник), 'often' (слишком часто). Сайт без чатов — 'off' или 'down'
export function chatFailure(response, data) {
  const said = data?.error
  const status = response?.status
  if (status === 400) return ['empty', 'long', 'name'].includes(said) ? said : 'invalid'
  if (status === 403) return said === 'owner' ? 'owner' : 'friend'
  if (status === 404) return said === 'gone' ? 'gone' : 'down'
  if (status === 409) return said === 'full' || said === 'nohandle' ? said : 'down'
  if (status === 429) return said === 'often' ? 'often' : 'limit'
  return trouble(response, data)
}

// Сообщение без номера и времени: { f, t } — текст, { f, k, o?, n? } — служебное: 'create' — создал группу n,
// 'add' и 'remove' — добавил и убрал o, 'leave' — вышел, 'name' — назвал группу n. Не сходится — null
function bodyFrom(m, limit) {
  const f = accountId(m?.f)
  if (!f) return null
  if (typeof m.t === 'string') return { f, t: cut(cleanText(m.t), limit) }
  if (!KINDS.includes(m.k)) return null
  const o = accountId(m.o)
  const n = typeof m.n === 'string' ? cut(oneLine(m.n), MAX_NAME) : ''
  return { f, k: m.k, ...(o ? { o } : {}), ...(n ? { n } : {}) }
}

// Сообщение переписки: номер s, кто f, когда at, и текст или служебное; не сходится — null
function messageFrom(m) {
  const body = bodyFrom(m, MAX_TEXT)
  if (!body || !Number.isSafeInteger(m.s) || m.s < 0 || !Number.isFinite(m.at)) return null
  return { s: m.s, at: m.at, ...body }
}

// Ники по номерам: { номер: ник }; у удалённого аккаунта ника нет
export function namesFrom(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw)
      .slice(0, 1000)
      .filter(([k, v]) => ACCOUNT_ID.test(k) && typeof v === 'string' && HANDLE.test(v)),
  )
}

// Чат из списка: { id, kind, with (номер друга) | name (название группы), unread, at, last? } — last — последнее
// сообщение коротко; не сходится — null
function chatFrom(c) {
  if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !CHAT_ID.test(c.id)) return null
  const kind = c.id.startsWith('d') ? 'dm' : 'group'
  if (c.kind !== kind) return null
  const other = accountId(c.with)
  if (kind === 'dm' && (!other || !c.id.slice(1).split('-').includes(other))) return null
  const last = c.last && typeof c.last === 'object' ? bodyFrom(c.last, 200) : null
  return {
    id: c.id,
    kind,
    ...(kind === 'dm' ? { with: other } : { name: typeof c.name === 'string' ? cut(oneLine(c.name), MAX_NAME) : '' }),
    unread: count(c.unread),
    at: Number.isFinite(c.at) ? c.at : 0,
    ...(last ? { last: last.t !== undefined ? { ...last, t: oneLine(last.t) } : last } : {}),
  }
}

// О самом чате: как в списке и ещё участники и хозяин группы
function aboutFrom(c) {
  const chat = chatFrom({ ...c, unread: 0, at: 0, last: undefined })
  if (!chat) return null
  const members = Array.isArray(c.members) ? [...new Set(c.members.map(accountId).filter(Boolean))].slice(0, MAX_MEMBERS) : []
  const { unread, at, ...about } = chat
  return { ...about, owner: accountId(c.owner), members }
}

const meFrom = (me) => accountId(me?.id)

// Ответ GET /api/me/chats → { me, chats, names, unread, error }: me — свой номер, chats — чаты, новые сверху,
// unread — сколько непрочитанных всего
export function parseChats(response) {
  const data = jsonFrom(response?.text)
  const none = (e) => ({ me: '', chats: [], names: {}, unread: 0, error: e })
  const error = chatFailure(response, data)
  if (error) return none(error)
  const me = meFrom(data.me)
  if (!me || !Array.isArray(data.chats)) return none('down')
  return { me, chats: data.chats.slice(0, 200).map(chatFrom).filter(Boolean), names: namesFrom(data.names), unread: count(data.unread), error: '' }
}

// Ответ GET /api/me/chats/messages → { me, chat, messages, first, names, unread, error }: messages — по порядку
// номеров, first — с какого номера человеку видна переписка (раньше — ничего нет)
export function parseMessages(response) {
  const data = jsonFrom(response?.text)
  const none = (e) => ({ me: '', chat: null, messages: [], first: 0, names: {}, unread: 0, error: e })
  const error = chatFailure(response, data)
  if (error) return none(error)
  const me = meFrom(data.me)
  const chat = aboutFrom(data.chat)
  if (!me || !chat || !Array.isArray(data.messages)) return none('down')
  const messages = data.messages
    .slice(-MAX_MESSAGES)
    .map(messageFrom)
    .filter(Boolean)
    .sort((a, b) => a.s - b.s)
  const first = Number.isSafeInteger(data.first) && data.first >= 0 ? data.first : 0
  return { me, chat, messages, first, names: namesFrom(data.names), unread: count(data.unread), error: '' }
}

// Ответ POST /api/me/chats/send → { msg, error }
export function parseSent(response) {
  const data = jsonFrom(response?.text)
  const error = chatFailure(response, data)
  if (error) return { msg: null, error }
  const msg = messageFrom(data.msg)
  return msg ? { msg, error: '' } : { msg: null, error: 'down' }
}

// Ответ про чат целиком — открыть чат с другом, новая группа, участники и название → { chat, left, error }; left —
// человек вышел из группы ({ ok: true }), чата у него больше нет
export function parseChat(response) {
  const data = jsonFrom(response?.text)
  const none = (e) => ({ chat: null, left: false, error: e })
  const error = chatFailure(response, data)
  if (error) return none(error)
  if (data.ok === true && data.chat === undefined) return { chat: null, left: true, error: '' }
  const chat = aboutFrom(data.chat)
  return chat ? { chat, left: false, error: '' } : none('down')
}

// Ответ GET /api/me/chats/unread → { unread, error }
export function parseUnread(response) {
  const data = jsonFrom(response?.text)
  const error = chatFailure(response, data)
  return error ? { unread: 0, error } : { unread: count(data.unread), error: '' }
}

// Ответ POST /api/me/chats/ticket с { link: true } → { link, error }: код ссылки для страницы чата
export function parseLink(response) {
  const data = jsonFrom(response?.text)
  const error = chatFailure(response, data)
  if (error) return { link: '', error }
  return typeof data.link === 'string' && LINK.test(data.link) ? { link: data.link, error: '' } : { link: '', error: 'down' }
}

// Служебное сообщение: шаблон по-русски с {0} — кто, {1} — кого или название группы, и что подставить. Шаблон
// переводится словарём целиком, подстановки — ники и название — нет
export function describe(m) {
  if (m.k === 'create') return { text: '{0} создал(а) группу «{1}»', values: [m.f, m.n ?? ''] }
  if (m.k === 'add') return { text: '{0} добавил(а) {1}', values: [m.f, m.o ?? ''] }
  if (m.k === 'remove') return { text: '{0} убрал(а) {1}', values: [m.f, m.o ?? ''] }
  if (m.k === 'leave') return { text: '{0} вышел(а) из группы', values: [m.f] }
  return { text: '{0} назвал(а) группу «{1}»', values: [m.f, m.n ?? ''] }
}

// Подставить значения вместо {0}, {1} в готовый (уже переведённый) шаблон
export function fill(template, values) {
  return String(template).replace(/\{(\d)\}/g, (all, k) => values[Number(k)] ?? all)
}

// Время сообщения: сегодня — ЧЧ:ММ, в этом году — ДД.ММ ЧЧ:ММ, раньше — ДД.ММ.ГГГГ. По местному времени компьютера
export function when(at, now) {
  const d = new Date(at)
  const today = new Date(now)
  if (!Number.isFinite(d.getTime())) return ''
  const two = (n) => String(n).padStart(2, '0')
  const time = `${two(d.getHours())}:${two(d.getMinutes())}`
  const date = `${two(d.getDate())}.${two(d.getMonth() + 1)}`
  if (d.getFullYear() !== today.getFullYear()) return `${date}.${d.getFullYear()}`
  if (d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) return time
  return `${date} ${time}`
}
