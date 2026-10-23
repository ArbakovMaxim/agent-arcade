// Аккаунт Arcade: вход через GitHub по коду и настройки, общие для всех компьютеров человека. Вход нужен только для
// этого — без него всё работает. Мод просит у сайта код (/api/auth/start), человек вводит его на
// github.com/login/device, мод спрашивает сайт, вошёл ли он (/api/auth/poll), и получает ключ сессии Arcade — токена
// GitHub мод не видит. Настройки на сайте — { ключ: { v, at } }: у каждого ключа побеждает более позднее изменение,
// у рекорда Flappy Arcade — больший счёт. Ещё у аккаунта бывает свой @ник — подпись в сетевых играх. Здесь нет вызовов
// Claude Code — сеть и хранилище в hooks/register.js. С ником можно звать друзей: заявка по точному нику, друг
// принимает её у себя.
import { siteUrl } from './catalog.js'
import { jsonFrom } from './youtube.js'

// Что из $.store общее для всех компьютеров. Свои игры, каталог, последняя игра, браузер и графика — у каждого компьютера
// свои: файлы игр, браузеры и терминал на другом компьютере другие. keepMenu — оставлять ли меню Arcade, когда
// открылся встроенный браузер Desktop, collapsed — свёрнутые разделы главного меню, favorites — избранное
export const SYNC_KEYS = ['lang', 'keys', 'notify', 'wide', 'keepMenu', 'backOnDone', 'onDone', 'onPermission', 'myTopics', 'twitchChannels', 'flappyBest', 'collapsed', 'favorites']
const TOKEN = /^(\d{1,20})\.[A-Za-z0-9_-]{43}$/
const DEVICE = /^[A-Za-z0-9_-]{8,100}$/
const USER_CODE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/
const GH_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const AVATAR = /^https:\/\/avatars\.githubusercontent\.com\/[\w./?=&%-]+$/
// @ник: латиница, цифры и _, 4–32 знака, первый — буква, строчными; подпись ника — <ник>.<до, секунды>.<HMAC сайта>
export const HANDLE = /^[a-z][a-z0-9_]{3,31}$/
const TICKET = /^([a-z][a-z0-9_]{3,31})\.\d{10}\.[A-Za-z0-9_-]{22}$/
const PATHS = { start: 'api/auth/start', poll: 'api/auth/poll', logout: 'api/auth/logout', me: 'api/me', settings: 'api/me/settings', handle: 'api/me/handle', friends: 'api/me/friends', accept: 'api/me/friends/accept', unfriend: 'api/me/friends/remove', chats: 'api/me/chats', messages: 'api/me/chats/messages', unread: 'api/me/chats/unread', send: 'api/me/chats/send', opendm: 'api/me/chats/open', group: 'api/me/chats/group', members: 'api/me/chats/members', chatticket: 'api/me/chats/ticket', report: 'api/report', myReport: 'api/me/report', reports: 'api/me/reports', closeReport: 'api/me/reports/close', boards: 'api/me/boards', boardsync: 'api/me/boards/sync', boardnew: 'api/me/boards/new', boardmembers: 'api/me/boards/members', boarddelete: 'api/me/boards/delete' }

// Адрес сайта для шага входа, настроек, ника, друзей, чатов или отчётов об ошибках: start, poll, logout, me, settings,
// handle, friends, accept, unfriend, chats, messages, unread, send, opendm, group, members, chatticket, report (без
// входа), myReport (со входом), reports, closeReport (только админу), общих досок: boards, boardsync, boardnew,
// boardmembers, boarddelete
export function accountUrl(name) {
  return siteUrl(PATHS[name])
}

// Что не так с ответом сайта: '' — всё хорошо, 'auth' — ключ сессии больше не подходит, 'limit' — лимит адреса на
// сегодня, 'off' — вход на сайте не настроен, 'app' — GitHub не принял приложение сайта, 'big' — настройки не
// поместились, 'down' — сайт или GitHub не ответили
export function trouble(response, data) {
  if (!response) return 'down'
  if (response.status === 401) return 'auth'
  if (response.status === 429) return 'limit'
  if (response.status === 413) return 'big'
  if (response.status === 503 && (data?.error === 'off' || data?.error === 'app')) return data.error
  return response.ok && data ? '' : 'down'
}

// Профиль GitHub из ответа: номер, имя и картинка (только с avatars.githubusercontent.com); не сходится — null
export function parseUser(u) {
  if (!u || typeof u !== 'object' || !/^\d{1,20}$/.test(String(u.id ?? '')) || typeof u.login !== 'string' || !GH_LOGIN.test(u.login)) return null
  return { id: String(u.id), login: u.login, ...(AVATAR.test(u.avatar ?? '') ? { avatar: u.avatar } : {}) }
}

// Вход из $.store: { token, user } или null. Ключ сессии начинается с номера профиля — чужой профиль не подставить
export function restoreAccount(saved) {
  const m = TOKEN.exec(typeof saved?.token === 'string' ? saved.token : '')
  const user = parseUser(saved?.user)
  return m && user && user.id === m[1] ? { token: saved.token, user } : null
}

// Ответ /api/auth/start → { device, code, url, interval, expires, error }: код для страницы GitHub, через сколько
// секунд спрашивать снова и сколько секунд код живёт
export function parseStart(response) {
  const data = jsonFrom(response?.text)
  const error = trouble(response, data)
  const none = (e) => ({ device: '', code: '', url: '', interval: 5, expires: 0, error: e })
  if (error) return none(error)
  const url = String(data.url ?? '')
  if (!DEVICE.test(data.device ?? '') || !USER_CODE.test(data.code ?? '') || !/^https:\/\/github\.com\/[\w/-]*$/.test(url)) return none('down')
  const interval = Math.min(Math.max(Number(data.interval) || 5, 1), 60)
  const expires = Math.min(Math.max(Number(data.expires) || 900, 60), 3600)
  return { device: data.device, code: data.code, url, interval, expires, error: '' }
}

// Ответ /api/auth/poll → { status, interval, account, error }. status — 'pending' (ждём человека), 'ok' (вошёл:
// account — { token, user }), 'expired' (код истёк), 'denied' (человек отказался) или '' при ошибке; interval —
// новый срок между вопросами, если GitHub попросил спрашивать реже
export function parsePoll(response) {
  const data = jsonFrom(response?.text)
  const error = trouble(response, data)
  const none = (e) => ({ status: '', interval: 0, account: null, error: e })
  if (error) return none(error)
  if (data.status === 'pending') return { status: 'pending', interval: Math.min(Number(data.interval) > 0 ? Number(data.interval) : 0, 60), account: null, error: '' }
  if (data.status === 'expired' || data.status === 'denied') return { status: data.status, interval: 0, account: null, error: '' }
  const account = data.status === 'ok' ? restoreAccount({ token: data.token, user: data.user }) : null
  return account ? { status: 'ok', interval: 0, account, error: '' } : none('down')
}

// Настройки из ответа сайта: только ключи SYNC_KEYS с отметкой времени
function settingsFrom(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const key of SYNC_KEYS) {
    const item = raw[key]
    if (item && typeof item === 'object' && 'v' in item && Number.isFinite(item.at) && item.at >= 0) out[key] = { v: item.v, at: item.at }
  }
  return out
}

// Ник и его подпись из ответа сайта: { handle, ticket }; ника нет — ''; подпись не к этому нику — без подписи
function handleFrom(data) {
  const handle = HANDLE.test(data?.handle ?? '') ? data.handle : ''
  const m = TICKET.exec(typeof data?.ticket === 'string' ? data.ticket : '')
  return { handle, ticket: handle && m?.[1] === handle ? data.ticket : '' }
}

// Сколько друзей, заявок или непрочитанных: целое от 0
export const count = (n) => (Number.isInteger(n) && n > 0 ? Math.min(n, 9999) : 0)

// Ответ /api/me → { user, settings, handle, ticket, friends, requests, unread, role, error }: friends — сколько друзей,
// requests — сколько заявок ждут ответа человека, unread — сколько непрочитанных сообщений во всех чатах, role —
// 'admin' у админа (ему видны отчёты об ошибках), у остальных ''
export function parseMe(response) {
  const data = jsonFrom(response?.text)
  const error = trouble(response, data)
  const none = (e) => ({ user: null, settings: {}, handle: '', ticket: '', friends: 0, requests: 0, unread: 0, role: '', error: e })
  if (error) return none(error)
  const user = parseUser(data.user)
  return user ? { user, settings: settingsFrom(data.settings), ...handleFrom(data), friends: count(data.friends), requests: count(data.requests), unread: count(data.unread), role: data.role === 'admin' ? 'admin' : '', error: '' } : none('down')
}

// Что человек ввёл как ник → ник строчными, без @ и пробелов по краям
export function normalHandle(text) {
  return typeof text === 'string' ? text.trim().replace(/^@/, '').toLowerCase() : ''
}

// Ник, который предложить из имени на GitHub: строчными, - → _; не подходит под правила ника — ''
export function suggestHandle(login) {
  const handle = typeof login === 'string' ? login.toLowerCase().replace(/-/g, '_') : ''
  return HANDLE.test(handle) ? handle : ''
}

// Ответ PUT /api/me/handle → { handle, ticket, error }. error, кроме общих: 'invalid' — ник не того вида, 'reserved' —
// запрещён, 'taken' — занят, 'often' — ник меняли слишком часто
export function parseHandle(response) {
  const data = jsonFrom(response?.text)
  const none = (e) => ({ handle: '', ticket: '', error: e })
  if (response?.status === 400) return none(data?.error === 'reserved' ? 'reserved' : 'invalid')
  if (response?.status === 409) return none('taken')
  if (response?.status === 429) return none('often')
  const error = trouble(response, data)
  if (error) return none(error)
  const named = handleFrom(data)
  return named.handle ? { ...named, error: '' } : none('down')
}

// Человек из списка друзей: { id, handle } — номер аккаунта и ник; не сходится — null
export function personFrom(p) {
  return p && typeof p === 'object' && /^\d{1,20}$/.test(String(p.id ?? '')) && HANDLE.test(p.handle ?? '') ? { id: String(p.id), handle: p.handle } : null
}

// Ответ про друзей (список, заявка, принять, удалить) → { status, friends, incoming, outgoing, error }. Списки — из
// { id, handle }: друзья, заявки человеку и его заявки. status заявки — 'sent' (отправлена) или 'friends' (уже друзья:
// тот звал сам). error, кроме общих: 'invalid' — ник не того вида, 'self' — свой ник, 'nobody' — ник ничей, 'gone' —
// заявки уже нет, 'nohandle' — у человека нет ника, 'full' — друзей и заявок слишком много, 'busy' — у того слишком
// много заявок, 'often' — заявок сегодня слишком много. Сайт без друзей отвечает 404 — это 'down'
export function parseFriends(response) {
  const data = jsonFrom(response?.text)
  const none = (e) => ({ status: '', friends: [], incoming: [], outgoing: [], error: e })
  const said = data?.error
  if (response?.status === 400) return none(said === 'self' ? 'self' : 'invalid')
  if (response?.status === 404) return none(said === 'nobody' || said === 'gone' ? said : 'down')
  if (response?.status === 409) return none(['nohandle', 'full', 'busy'].includes(said) ? said : 'down')
  if (response?.status === 429) return none(said === 'often' ? 'often' : 'limit')
  const error = trouble(response, data)
  if (error) return none(error)
  const list = (raw) => (Array.isArray(raw) ? raw.slice(0, 200).map(personFrom).filter(Boolean) : null)
  const friends = list(data.friends)
  const incoming = list(data.incoming)
  const outgoing = list(data.outgoing)
  if (!friends || !incoming || !outgoing) return none('down')
  return { status: data.status === 'sent' || data.status === 'friends' ? data.status : '', friends, incoming, outgoing, error: '' }
}

// Ответ PUT /api/me/settings → { settings, error }: settings — всё, что теперь на сайте
export function parseSettings(response) {
  const data = jsonFrom(response?.text)
  const error = trouble(response, data)
  return error ? { settings: {}, error } : { settings: settingsFrom(data.settings), error: '' }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Встреча настроек мода и сайта. local — что сохранено в моде ({ ключ: значение }; чего человек не менял, там нет),
// stamps — когда человек менял каждый ключ ({ ключ: время }; до первого входа отметок может не быть), remote —
// настройки сайта. → { apply, push, stamps }: apply — что взять с сайта ({ ключ: значение }), push — что отправить
// сайту ({ ключ: { v, at } }), stamps — новые отметки. Побеждает более позднее изменение; ключ, которого на сайте
// нет, уходит туда; у рекорда Flappy Arcade побеждает больший счёт
export function syncPlan(local, stamps, remote, now) {
  const apply = {}
  const push = {}
  const next = {}
  for (const key of SYNC_KEYS) {
    const r = remote[key]
    const at = Number.isFinite(stamps?.[key]) ? stamps[key] : 0
    const has = local[key] !== undefined
    if (at) next[key] = at
    if (key === 'flappyBest') {
      const mineBest = Number.isFinite(local[key]) ? local[key] : 0
      const theirs = Number.isFinite(r?.v) ? r.v : 0
      if (theirs > mineBest) apply[key] = theirs
      if (theirs > mineBest || (r && theirs === mineBest)) next[key] = r.at
      else if (mineBest > theirs) {
        // Больший счёт должен победить и по времени: отметка позже сайтовой
        next[key] = Math.max(now, (r?.at ?? 0) + 1)
        push[key] = { v: mineBest, at: next[key] }
      }
      continue
    }
    if (r && r.at > at) {
      if (!has || !same(r.v, local[key])) apply[key] = r.v
      next[key] = r.at
    } else if (has && (!r || at > r.at)) {
      next[key] = at || now
      push[key] = { v: local[key], at: next[key] }
    }
  }
  return { apply, push, stamps: next }
}

// Отметки времени из $.store: только SYNC_KEYS и только числа
export function restoreStamps(saved) {
  const out = {}
  if (!saved || typeof saved !== 'object') return out
  for (const key of SYNC_KEYS) if (Number.isFinite(saved[key]) && saved[key] > 0) out[key] = saved[key]
  return out
}

// Ответ выхода или удаления аккаунта → '' (сделано) или ошибка, как у остальных ответов
export function parseDone(response) {
  return trouble(response, jsonFrom(response?.text))
}
