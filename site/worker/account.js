// Аккаунты Arcade: вход через GitHub и настройки мода, общие для всех компьютеров человека. Вход — двумя путями.
// Кнопкой через сайт (web flow): мод просит вход (/api/auth/web) и открывает страницу GitHub в браузере, GitHub
// возвращает человека на /api/auth/callback, сайт спрашивает «Войти в Arcade как @…?» и показывает код для сверки с
// Claude Code, человек подтверждает (/api/auth/confirm), а мод всё это время спрашивает, вошёл ли он
// (/api/auth/web/poll). Запасной — по коду (device flow): мод просит код (/api/auth/start), человек вводит его на
// github.com/login/device, мод спрашивает, вошёл ли он (/api/auth/poll). Таких кодов GitHub выдаёт приложению не
// больше 50 в час, поэтому код — только запасной путь.
// Токен GitHub до мода не доходит: по нему сайт узнаёт номер и имя профиля и сразу забывает токен.
// Мод получает свой ключ сессии Arcade — <номер GitHub>.<случайная строка>; сайт хранит только его хеш.
// Приложение GitHub — OAuth App с включённым Device Flow; его client ID не секрет и лежит в vars (GITHUB_CLIENT_ID),
// как и адрес возврата (GITHUB_CALLBACK — тот же, что в настройках приложения); client secret — секрет сайта
// GITHUB_CLIENT_SECRET (wrangler secret put). Без секрета или адреса возврата вход кнопкой выключен — мод входит по
// коду. Почты и доступа к репозиториям Arcade не просит: scope пустой.
// Durable Object Account: экземпляр 'auth' — вход, лимиты адресов и реестр @ников, экземпляр gh:<номер GitHub> —
// аккаунт человека, его друзья, список его чатов и живые соединения его страниц чата (сами чаты — в worker/chat.js),
// список его общих досок проектов (сами доски — в worker/desk.js) и приглашения в игру от друзей; экземпляр 'online' —
// кто сейчас в сети.
import { sign, signed } from './discover.js'
import { CHAT_ID, MAX_MEMBERS, MAX_TEXT, cleanText, dmId, groupName, validPic } from './chat.js'
import { addReport, admins, askReports, cleanReport } from './reports.js'
import { BOARD_ID, MAX_MEMBERS as BOARD_MEMBERS, MAX_OPS, cleanCols, cleanTitle } from './desk.js'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
export const IDLE_MS = 365 * DAY // аккаунт, в который год не заходили, удаляется со всеми настройками
export const MAX_SESSIONS = 10 // компьютеров с входом; одиннадцатый вход выталкивает самый старый
export const SETTINGS_MAX = 16 * 1024 // настроек — не больше 16 КБ JSON
export const MAX_KEYS = 50
const MAX_BODY = 32 * 1024
const SYNC_BODY = 512 * 1024 // сверка доски везёт карточки: мод шлёт их пачками до 100 000 знаков
// С одного адреса в сутки: кодов и вопросов «вошёл ли». Код живёт 15 минут, вопрос — раз в 5 секунд: 180 на код.
// Счётчики — в памяти объекта 'auth', адрес — только меткой
export const PER_IP_DAILY = { starts: 30, polls: 1500 }
// Вход кнопкой: сколько он ждёт человека и через сколько секунд мод спрашивает снова. Код для сверки — 4 знака без
// похожих друг на друга (0 и O, 1 и I)
export const WEB_MS = 10 * MINUTE
export const WEB_INTERVAL = 3
const MARK_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const STATE = /^[A-Za-z0-9_-]{43}$/
const GH_CODE = /^[A-Za-z0-9_-]{1,100}$/
const FETCH_MS = 8000
const AGENT = 'agent-arcade' // API GitHub без User-Agent не отвечает
const TOKEN = /^(\d{1,20})\.[A-Za-z0-9_-]{43}$/
const DEVICE = /^[A-Za-z0-9_-]{8,100}$/
const USER_CODE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/
const GH_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const AVATAR = /^https:\/\/avatars\.githubusercontent\.com\/[\w./?=&%-]+$/
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/
// @ник: латиница, цифры и _, 4–32 знака, первый — буква; хранится строчными — Fefa и fefa один ник
export const HANDLE = /^[a-z][a-z0-9_]{3,31}$/
export const HANDLE_HOLD_MS = 30 * DAY // сменённый ник месяц держится за прежним хозяином: никто другой его не возьмёт
export const HANDLE_CHANGES = 5 // смен ника в сутки — чтобы не занимать чужие ники пачкой
export const TICKET_MS = 12 * 60 * MINUTE // сколько живёт подпись ника для сетевых игр
export const PICKS_PER_MINUTE = 10 // смен аватарки в минуту: каждая — запись в реестр
// Друзья: друзей вместе со своими заявками — не больше MAX_FRIENDS, заявок тебе — не больше MAX_INCOMING, заявок в
// сутки — REQUESTS_DAILY (и ник с опечаткой — тоже заявка: перебирать чужие ники незачем). Отклонённый месяц не может
// позвать снова: его заявка молча не доходит
export const MAX_FRIENDS = 100
export const MAX_INCOMING = 50
export const REQUESTS_DAILY = 20
export const DECLINE_HOLD_MS = 30 * DAY
// Чаты: сообщений в минуту, новых групп в сутки, чатов в списке человека (больше — забываются самые тихие). Билет
// чата — подпись для страницы чата на сайте: с ней можно только читать и писать в чатах, ключ сессии браузеру не нужен.
// Вид — <номер>.<до, секунды>.<начало хеша сессии>.<HMAC> на LINK_SECRET; вышел на том компьютере — билет не годен.
// Код ссылки — того же вида, но живёт CHAT_LINK_MS и годится один раз: только чтобы страница обменяла его на билет.
// Его мод кладёт в адрес страницы — адрес может попасть в просьбу к Claude, а месячный билет туда класть нельзя
export const SENDS_PER_MINUTE = 30
export const GROUPS_DAILY = 10
export const MAX_CHATS = 200
export const CHAT_TICKET_MS = 30 * DAY
export const CHAT_LINK_MS = 10 * MINUTE // пока Claude дожидается конца шага или сжатия, а человек — нажимает Enter
export const CHAT_PROTOCOL = 'arcade-chat' // подпротокол WebSocket страницы чата; второй — сам билет
const PREVIEW = 80 // знаков последнего сообщения в списке чатов
// Доски проектов: своих общих досок — не больше MAX_OWNED (больше — потом, по подписке), новых в сутки — BOARDS_DAILY,
// сверок в минуту — SYNCS_PER_MINUTE (мод сверяет открытую доску раз в несколько секунд), в списке — не больше MAX_BOARDS
export const MAX_OWNED = 3
export const BOARDS_DAILY = 10
export const SYNCS_PER_MINUTE = 60
export const MAX_BOARDS = 100
// В сети и приглашения в игру: мод, пока открыто меню, отмечается раз в полминуты и узнаёт, кто из друзей в сети и кто
// зовёт его в игру. Друг в сети, если отмечался за последние ONLINE_MS; отметок в минуту — не больше PULSES_PER_MINUTE.
// Приглашение живёт INVITE_MS, от каждого друга — последнее; звать — не чаще INVITES_PER_MINUTE
export const ONLINE_MS = 90_000
export const PULSES_PER_MINUTE = 12
export const INVITE_MS = 10 * MINUTE
export const INVITES_PER_MINUTE = 10
const GAME_ID = /^[a-z0-9][a-z0-9-]{0,39}$/
const ROOM = /^[a-z0-9]{6,16}$/
const MAX_SOCKETS = 5 // открытых страниц чата у человека
const CHAT_TICKET = /^(\d{1,20})\.(\d{10})\.([0-9a-f]{12})\.([A-Za-z0-9_-]{22})$/
const TICKET_PATHS = new Set(['/friends', '/chats', '/messages', '/unread', '/send', '/opendm', '/group', '/members', '/socket'])
const CHAT_PATHS = new Set(['/chats', '/messages', '/unread', '/send', '/opendm', '/group', '/members', '/chatticket', '/socket'])
const REPORT_PATHS = new Set(['/report', '/reports', '/closereport'])
const BOARD_PATHS = new Set(['/boards', '/boardsync', '/boardnew', '/boardmembers', '/boarddelete'])
const ACCOUNT_ID = /^\d{1,20}$/
// Ники, которыми легко выдать себя за Arcade, Claude или GitHub: сами слова и ники, где они — часть через _
const RESERVED = new Set(['administrator', 'anonymous', 'everyone', 'guest', 'help', 'helpdesk', 'info', 'moderator', 'mods', 'noreply', 'null', 'owner', 'root', 'security', 'staff', 'system', 'team', 'undefined', 'abuse', 'contact', 'postmaster', 'webmaster', 'robot', 'service', 'settings', 'account'])
const RESERVED_PARTS = ['arcade', 'admin', 'support', 'claude', 'anthropic', 'github', 'official', 'moderator', 'system']

class AppError extends Error {} // GitHub не принял приложение сайта: неверный client ID или Device Flow выключен
class LimitError extends Error {}

// Что делает адрес: метод и путь → [какой экземпляр, путь внутри объекта]
const ROUTES = {
  'POST /api/auth/start': ['auth', '/start'],
  'POST /api/auth/poll': ['auth', '/poll'],
  'POST /api/auth/web': ['auth', '/web'],
  'POST /api/auth/web/poll': ['auth', '/webpoll'],
  'GET /api/auth/callback': ['auth', '/callback'],
  'POST /api/auth/confirm': ['auth', '/confirm'],
  'POST /api/auth/logout': ['user', '/logout'],
  'GET /api/me': ['user', '/me'],
  'DELETE /api/me': ['user', '/delete'],
  'PUT /api/me/settings': ['user', '/settings'],
  'PUT /api/me/handle': ['user', '/handle'],
  'PUT /api/me/avatar': ['user', '/avatar'],
  'GET /api/me/friends': ['user', '/friends'],
  'POST /api/me/friends': ['user', '/befriend'],
  'POST /api/me/friends/accept': ['user', '/accept'],
  'POST /api/me/friends/remove': ['user', '/unfriend'],
  'GET /api/me/chats': ['user', '/chats'],
  'GET /api/me/chats/messages': ['user', '/messages'],
  'GET /api/me/chats/unread': ['user', '/unread'],
  'POST /api/me/chats/send': ['user', '/send'],
  'POST /api/me/chats/open': ['user', '/opendm'],
  'POST /api/me/chats/group': ['user', '/group'],
  'POST /api/me/chats/members': ['user', '/members'],
  'POST /api/me/chats/ticket': ['user', '/chatticket'],
  'POST /api/me/report': ['user', '/report'],
  'GET /api/me/reports': ['user', '/reports'],
  'POST /api/me/reports/close': ['user', '/closereport'],
  'GET /api/me/boards': ['user', '/boards'],
  'POST /api/me/boards/sync': ['user', '/boardsync'],
  'POST /api/me/boards/new': ['user', '/boardnew'],
  'POST /api/me/boards/members': ['user', '/boardmembers'],
  'POST /api/me/boards/delete': ['user', '/boarddelete'],
  'POST /api/me/pulse': ['user', '/pulse'],
  'POST /api/me/invite': ['user', '/invite'],
  'POST /api/me/invites/answer': ['user', '/answer'],
}
const PATHS = new Set(Object.keys(ROUTES).map((r) => r.split(' ')[1]))

// Номер GitHub из заголовка Authorization: Bearer <ключ сессии>, Chat <билет чата> или Link <код ссылки>; не того
// вида — null
export function sessionId(header) {
  const m = /^(Bearer|Chat|Link) (\S+)$/.exec(header ?? '')
  return m ? ((m[1] === 'Bearer' ? TOKEN : CHAT_TICKET).exec(m[2])?.[1] ?? null) : null
}

// Тело запроса — не больше limit; больше — null
async function readBody(request, limit) {
  if (Number(request.headers.get('Content-Length')) > limit) return null
  const text = await request.text()
  return text.length > limit ? null : text
}

// --- Маршрут Worker'а -----------------------------------------------------------------------------------------
// POST /api/auth/start → { device, code, url, interval, expires }: код для github.com/login/device
// POST /api/auth/poll { device } → { status: 'pending' | 'expired' | 'denied' } или { status: 'ok', token, user }
// POST /api/auth/web → { url, state, key, mark, interval, expires }: вход кнопкой — url — страница GitHub для браузера,
// state и key — чтобы спрашивать, вошёл ли человек (key в браузер не попадает), mark — код для сверки на странице
// сайта; POST /api/auth/web/poll { state, key } — то же, что /api/auth/poll. GET /api/auth/callback?code=&state= —
// сюда GitHub возвращает человека, POST /api/auth/confirm (форма state, nonce, answer) — он подтвердил вход или
// ответил «Это не я»: обе отвечают страницей для браузера. Без GITHUB_CLIENT_SECRET и GITHUB_CALLBACK, и не с того
// сайта, что в GITHUB_CALLBACK (копия ветки), /api/auth/web отвечает 503 ({ error: 'off' })
// GET /api/me → { user, settings, handle?, ticket?, pic?, friends?, requests?, unread?, role? } (pic — номер своей
// аватарки; сколько друзей, заявок тебе и непрочитанных сообщений; role: 'admin' — у админа),
// PUT /api/me/settings { settings } → { settings },
// PUT /api/me/handle { handle } → { handle, ticket? }, PUT /api/me/avatar { pic: 0–23 | null } → { pic? } — аватарка
// из 24 готовых (null — без неё), POST /api/auth/logout, DELETE /api/me — с ключом сессии.
// 401 — ключа нет или он не подходит ({ error: 'auth' }), 503 — вход не настроен ({ error: 'off' }) или GitHub не
// принял приложение ({ error: 'app' }), 429 — лимит адреса, 502 — GitHub не ответил. Ник: 400 — не того вида
// ({ error: 'invalid' }) или запрещён ({ error: 'reserved' }), 409 — занят ({ error: 'taken' }), 429 — слишком
// часто меняли ({ error: 'often' }). Аватарка: 400 — не номер 0–23 и не null ({ error: 'invalid' }), 429 — слишком
// часто ({ error: 'often' }).
// Друзья: GET /api/me/friends → { friends, incoming, outgoing } — списки { id, handle, pic? } (друзья, заявки тебе,
// твои заявки); POST /api/me/friends { handle } — заявка по точному нику, POST /api/me/friends/accept { id } — принять,
// POST /api/me/friends/remove { id } — удалить друга, отклонить заявку или отменить свою; отвечают тем же списком,
// заявка — ещё и status: 'sent' | 'friends'. 400 — ник не того вида ({ error: 'invalid' }) или свой ({ error: 'self' }),
// 404 — такого ника нет ({ error: 'nobody' }) или заявки уже нет ({ error: 'gone' }), 409 — сначала возьми свой ник
// ({ error: 'nohandle' }), друзей и заявок уже много ({ error: 'full' }) или у него слишком много заявок
// ({ error: 'busy' }), 429 — заявок за сутки много ({ error: 'often' })
// Чаты (worker/chat.js): GET /api/me/chats → { me, chats, names, pics?, online?, unread } — чаты, новые сверху, { id,
// kind: 'dm' | 'group', with? (друг) | name? и pic? (группа), unread, at, last? (последнее сообщение коротко) }, ники
// и номера аватарок по номерам аккаунтов и кто из друзей в сети;
// GET /api/me/chats/messages?chat=&after=&before= → { me, chat, messages, first, names, pics?, unread } — без before чат
// становится прочитанным; GET /api/me/chats/unread → { unread }; POST /api/me/chats/send { chat, text } → { msg };
// POST /api/me/chats/open { with } → { chat } — чат с другом; POST /api/me/chats/group { name, members | all: true }
// → { chat } — группа из друзей или со всеми друзьями; POST /api/me/chats/members { chat, add?, remove?, name?, pic? }
// → { chat } (pic — номер картинки группы или null) или { chat, leave: true } → { ok } — выйти; POST /api/me/chats/ticket → { ticket, until } — билет для
// страницы чата: с заголовком Authorization: Chat <билет> можно только чаты и список друзей; с телом { link: true } —
// { link, until }: код ссылки, который страница один раз обменяет на билет тем же адресом с Authorization: Link <код>. 400 — пустое ('empty')
// или длинное ('long') сообщение, пустое название ('name'), 403 — не друг ('friend') или не хозяин группы ('owner'),
// 404 — чата нет или тебя в нём нет ('gone'), 409 — в группе много людей ('full') или нет своего ника ('nohandle'),
// 429 — слишком часто ('often'), 503 — чаты выключены ('off')
// Отчёты об ошибках (worker/reports.js): POST /api/me/report { text, version?, surface?, lang?, os? } → { ok, id } —
// отчёт с подписью; GET /api/me/reports → { reports, open } и POST /api/me/reports/close { id } → { ok, open } —
// только админам ({ role: 'admin' } в /api/me), остальным 403 ({ error: 'admin' }); 503 — отчёты выключены ('off')
// Доски проектов (worker/desk.js): GET /api/me/boards → { me, boards, names } — общие доски человека, недавние сверху,
// { id, name, owner, rev, at } (rev — номер последней правки), и ники хозяев; POST /api/me/boards/new { name, cols?,
// members? } → { board, cards, full, names } — новая общая доска, сразу с друзьями; POST /api/me/boards/sync { board,
// since, ops?, names? } → { board, cards, full?, refused?, names? } — отдать правки и взять поменявшееся после since
// (правки и ответ — в worker/desk.js; names: true — с никами участников); POST /api/me/boards/members { board, add?,
// remove? } → { board, names } или { board, leave: true } → { ok }; POST /api/me/boards/delete { board } → { ok } —
// удалить доску у всех. 400 — пустое название ('name'), 403 — не друг ('friend') или не хозяин доски ('owner'), 404 —
// доски нет или тебя на ней нет ('gone'), 409 — своих общих досок уже MAX_OWNED ('many'), на доске много людей
// ('full') или нет своего ника ('nohandle'), 413 — слишком большая пачка правок, 429 — слишком часто ('often'), 503 —
// доски выключены ('off')
// В сети и приглашения: POST /api/me/pulse { hidden? } → { online, invites, unread, requests } — отметка «в сети»
// (hidden: true — не показываться друзьям, но видеть их) и что нового: номера друзей в сети, приглашения в игру
// { from, handle, game, room?, at } (новые сверху), непрочитанные сообщения и заявки в друзья; POST /api/me/invite
// { to, game, room? } → { ok } — позвать друга в сетевую игру (room — код комнаты настольной игры; у Doom лобби общее);
// POST /api/me/invites/answer { from } → { ok } — приглашение принято или отклонено, оно уходит. 403 — не друг
// ('friend'), 409 — нет своего ника ('nohandle'), 429 — слишком часто ('often')
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
  const body = request.method === 'POST' || request.method === 'PUT' ? await readBody(request, path === '/boardsync' ? SYNC_BODY : MAX_BODY) : ''
  if (body === null) return Response.json({ error: 'too big' }, { status: 413 })
  const forward = new Request(`https://account${path}${url.search}`, {
    method: request.method === 'GET' ? 'GET' : 'POST',
    ...(body ? { body } : {}),
    headers: {
      'X-IP': request.headers.get('CF-Connecting-IP') || '',
      Authorization: request.headers.get('Authorization') || '',
      // Вход кнопкой: с какого сайта спрашивают и на каком языке показать страницу браузеру
      'X-Origin': url.origin,
      'X-Lang': request.headers.get('Accept-Language') || '',
    },
  })
  return env.ACCOUNT.get(env.ACCOUNT.idFromName(name)).fetch(forward)
}

// Живое соединение страницы чата: WebSocket на /net/chat. Своих заголовков браузер WebSocket не даёт, поэтому билет
// чата едет подпротоколом: ['arcade-chat', <билет>]. Приходят кадры { type: 'note', chat, msg } — в чате новое
// сообщение — и { type: 'gone', chat } — чата больше нет; на 'ping' — 'pong'
export async function chatSocket(request, env) {
  if (request.headers.get('Upgrade') !== 'websocket') return new Response('Нужно подключение WebSocket', { status: 426 })
  if (!env.ACCOUNT || !env.CHAT) return Response.json({ error: 'off' }, { status: 503 })
  const offered = (request.headers.get('Sec-WebSocket-Protocol') ?? '').split(',').map((p) => p.trim())
  const ticket = offered.find((p) => CHAT_TICKET.test(p))
  if (!offered.includes(CHAT_PROTOCOL) || !ticket) return Response.json({ error: 'auth' }, { status: 401 })
  const forward = new Request('https://account/socket', {
    headers: { Upgrade: 'websocket', Authorization: `Chat ${ticket}`, 'X-IP': request.headers.get('CF-Connecting-IP') || '' },
  })
  return env.ACCOUNT.get(env.ACCOUNT.idFromName(`gh:${CHAT_TICKET.exec(ticket)[1]}`)).fetch(forward)
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

// --- @ник ----------------------------------------------------------------------------------------------------
// Ник — подпись человека в сетевых играх и в друзьях (дальше — в чате). Друзья держатся за номер аккаунта, а не за
// ник, поэтому его можно менять когда угодно. Что пришло → ник строчными, без @ в начале; не строка — ''
export function normalHandle(text) {
  return typeof text === 'string' ? text.trim().replace(/^@/, '').toLowerCase() : ''
}

// Что не так с ником: 'invalid' — не того вида, 'reserved' — запрещён; подходит — null
export function handleProblem(handle) {
  if (!HANDLE.test(handle)) return 'invalid'
  if (RESERVED.has(handle) || handle.includes('anthropic') || handle.split('_').some((part) => RESERVED_PARTS.includes(part))) return 'reserved'
  return null
}

// Подпись ника для сетевых игр: мод получает её в /api/me и передаёт странице партии, комната проверяет — так в
// партии нельзя назваться чужим ником. Вид — <ник>.<до, секунды>.<HMAC> на LINK_SECRET; номера аккаунта в ней нет.
// Сменённый ник месяц не достанется другому, поэтому старая подпись, пока жива, никого не подставит
const namePayload = (handle, until) => `name|${handle}|${until}`

export async function nameTicket(secret, handle, now) {
  const until = Math.floor((now + TICKET_MS) / 1000)
  return `${handle}.${until}.${await sign(secret, namePayload(handle, until))}`
}

// Подпись верна и не истекла — ник; иначе null
export async function ticketName(secret, ticket, now) {
  const m = /^([a-z][a-z0-9_]{3,31})\.(\d{10})\.([A-Za-z0-9_-]{22})$/.exec(typeof ticket === 'string' ? ticket : '')
  if (!m || Number(m[2]) * 1000 <= now) return null
  return (await signed(secret, namePayload(m[1], m[2]), m[3])) ? m[1] : null
}

const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length
const today = (now) => new Date(now).toISOString().slice(0, 10)
const refuse = (error, status) => Response.json({ error }, { status })
const without = (map, id) => Object.fromEntries(Object.entries(map).filter(([key]) => key !== id))
const chatPayload = (id, until, prefix) => `chat|${id}|${until}|${prefix}`
const linkPayload = (id, until, prefix) => `link|${id}|${until}|${prefix}`
const unreadOf = (chats) => Object.values(chats).reduce((sum, c) => sum + Math.max(0, c.last - c.read), 0)
const gameInvite = (game, room) => typeof game === 'string' && GAME_ID.test(game) && (room === undefined || (typeof room === 'string' && ROOM.test(room)))

// Последнее сообщение для списка чатов: начало текста одной строкой или служебное целиком
function preview(msg) {
  if (typeof msg.t === 'string') return { f: msg.f, t: [...msg.t.replace(/\s+/g, ' ')].slice(0, PREVIEW).join('') }
  return { f: msg.f, k: msg.k, ...(msg.o ? { o: msg.o } : {}), ...(msg.n !== undefined ? { n: msg.n } : {}) }
}

// Чатов в списке больше MAX_CHATS — забываются самые тихие, кроме keep. Забытая группа вернётся со следующим
// сообщением в ней
function trimmed(chats, keep) {
  const ids = Object.keys(chats)
  if (ids.length <= MAX_CHATS) return chats
  const quiet = new Set(ids.filter((id) => id !== keep).sort((a, b) => chats[a].at - chats[b].at).slice(0, ids.length - MAX_CHATS))
  return Object.fromEntries(Object.entries(chats).filter(([id]) => !quiet.has(id)))
}

// Тело запроса из мода: JSON-объект; не он — {}
function parsed(text) {
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

// Круг после того, как id стал другом: из заявок он уходит
const befriended = (circle, id, now) => ({
  ...circle,
  friends: { ...circle.friends, [id]: now },
  incoming: without(circle.incoming, id),
  outgoing: without(circle.outgoing, id),
  declined: without(circle.declined, id),
})

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomKey() {
  const raw = String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Код для сверки: тот же, что мод показывает в Claude Code
function markCode() {
  return [...crypto.getRandomValues(new Uint8Array(4))].map((b) => MARK_CHARS[b % MARK_CHARS.length]).join('')
}

// --- Страницы входа кнопкой ----------------------------------------------------------------------------------
// Их видит человек в браузере после GitHub. По-русски — если браузер просит русский, иначе по-английски
const PAGE_TEXT = {
  en: {
    title: 'Arcade — sign in',
    ask: (login) => `Sign in to Arcade as @${login}?`,
    mark: 'The code in Claude Code should be the same:',
    warn: 'If you didn’t start signing in to Arcade in Claude Code, click “It wasn’t me”: someone may be trying to get into your account.',
    yes: 'Sign in',
    no: 'It wasn’t me',
    done: 'Done — head back to Claude Code.',
    cancelled: 'Sign-in cancelled. You can close this page.',
    stale: 'This sign-in link no longer works — maybe you have already signed in. If not, start signing in again in Claude Code.',
    broken: 'Signing in through the site isn’t working right now. Go back to Claude Code and sign in with a code.',
  },
  ru: {
    title: 'Arcade — вход',
    ask: (login) => `Войти в Arcade как @${login}?`,
    mark: 'Код в Claude Code должен быть таким же:',
    warn: 'Если вход в Arcade в Claude Code начинал не ты, нажми «Это не я»: кто-то пытается войти в твой аккаунт.',
    yes: 'Войти',
    no: 'Это не я',
    done: 'Готово — возвращайся в Claude Code.',
    cancelled: 'Вход отменён. Эту страницу можно закрыть.',
    stale: 'Эта ссылка для входа больше не действует — возможно, ты уже вошёл. Если нет, начни вход в Claude Code заново.',
    broken: 'Вход через сайт сейчас не работает. Вернись в Claude Code и войди по коду.',
  },
}
const pageText = (lang) => (/^ru\b/i.test(lang.trim()) ? PAGE_TEXT.ru : PAGE_TEXT.en)
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// Страница для браузера: несколько слов и, может быть, форма. Чужой сайт не встроит её в рамку — кнопку «Войти» не
// подсунуть под чужую; адрес с кодом GitHub не уходит дальше по ссылкам, страница не кешируется
function page(t, body, status = 200) {
  const lang = t === PAGE_TEXT.ru ? 'ru' : 'en'
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(t.title)}</title><style>
:root{color-scheme:light dark;--bg:#f6f5f2;--card:#fff;--text:#1d1c1a;--dim:#6b6862;--accent:#c96442;--line:#e3e0da}
@media (prefers-color-scheme:dark){:root{--bg:#1c1b19;--card:#262522;--text:#ecebe7;--dim:#a19e97;--line:#3a3834}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{box-sizing:border-box;width:min(440px,100% - 32px);background:var(--card);border:1px solid var(--line);border-radius:14px;padding:28px}
h1{font-size:20px;margin:0 0 12px}p{margin:0 0 12px}.dim{color:var(--dim);font-size:14px}
.mark{font:600 28px/1.2 ui-monospace,Consolas,monospace;letter-spacing:.2em;margin:4px 0 16px}
form{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}button{font:inherit;border-radius:9px;padding:9px 18px;cursor:pointer;border:1px solid var(--line);background:transparent;color:var(--text)}
button.yes{background:var(--accent);border-color:var(--accent);color:#fff}
</style></head><body><main>${body}</main></body></html>`
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  })
}
const note = (t, text, status) => page(t, `<h1>Arcade</h1><p>${escapeHtml(text)}</p>`, status)

// Экземпляр 'auth': коды GitHub, выдача ключей сессии и реестр ников — handle:<ник> → { id, until? } (чей ник и, если
// его отпустили, до какого времени он ещё держится за прежним хозяином) и owner:<номер> → { handle?, changes, pic? }
// (ник человека, когда его меняли, и номер аватарки). Экземпляр gh:<номер> хранит user (номер, имя и картинка профиля
// GitHub — её другим не показываем), sessions (хеши ключей сессии), settings, handle, pic (номер аватарки), seen —
// когда человек последний раз заходил, circle — его друзей и заявки, chats — его чаты и made — когда он создавал группы
// за последние сутки, boards — его общие доски и boardsMade — когда он их заводил, invites — приглашения в игру от
// друзей. Экземпляр 'online' помнит отметки «в сети» только в памяти.
// Отчёты об ошибках — в своём объекте (worker/reports.js)
export class Account {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.ips = new Map()
    this.sends = [] // когда человек писал в чаты за последнюю минуту
    this.syncs = [] // когда он сверял доски за последнюю минуту
    this.pulses = [] // когда мод отмечался «в сети» за последнюю минуту
    this.calls = [] // когда он звал друзей в игру за последнюю минуту
    this.picks = [] // когда он менял аватарку за последнюю минуту
    this.seen = new Map() // экземпляр 'online': номер → { at, friends } — когда отмечался и кого числит в друзьях
    this.pruned = 0
    // На 'ping' страницы чата отвечает сама платформа: объект ради этого не просыпается
    if (typeof WebSocketRequestResponsePair === 'function') ctx.setWebSocketAutoResponse?.(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  async fetch(request) {
    const url = new URL(request.url)
    const path = url.pathname
    const ip = request.headers.get('X-IP') || ''
    try {
      if (path === '/start') return await this.start(ip)
      if (path === '/poll') return await this.poll(await request.text(), ip)
      if (path === '/web') return await this.webStart(ip, request.headers.get('X-Origin') || '')
      if (path === '/webpoll') return await this.webPoll(await request.text(), ip)
      if (path === '/callback') return await this.callback(url.searchParams, request.headers.get('X-Lang') || '')
      if (path === '/confirm') return await this.confirm(await request.text(), request.headers.get('X-Lang') || '')
      if (path === '/login') return await this.login(await request.json())
      if (path === '/claim') return await this.claim(await request.json())
      if (path === '/release') return await this.release(await request.json())
      if (path === '/pic') return await this.savePic(await request.json())
      if (path === '/lookup') return await this.lookup(await request.json())
      if (path === '/names') return await this.names(await request.json())
      // От экземпляров других людей: заявка, ответ на свою заявку, «забудь меня»
      if (path === '/incoming') return await this.incoming(await request.json())
      if (path === '/accepted') return await this.accepted(await request.json())
      if (path === '/drop') return await this.drop(await request.json())
      // От чатов: в чате новое сообщение, чата больше нет
      if (path === '/chatnote') return await this.chatnote(await request.json())
      if (path === '/chatgone') return await this.chatgone(await request.json())
      // От досок: доска поменялась, доски у него больше нет
      if (path === '/boardnote') return await this.boardnote(await request.json())
      if (path === '/boardgone') return await this.boardgone(await request.json())
      // Отметка «в сети» (в экземпляре 'online') и приглашение в игру от друга
      if (path === '/online') return this.online(await request.json())
      if (path === '/invited') return await this.invited(await request.json())
      // С билетом чата — только чаты и список друзей, с кодом ссылки — только обменять его на билет
      const who = await this.session(request.headers.get('Authorization'))
      if (!who || (who.ticket && !TICKET_PATHS.has(path)) || (who.link && path !== '/chatticket')) return Response.json({ error: 'auth' }, { status: 401 })
      if (path === '/me') return await this.me()
      if (path === '/settings') return await this.saveSettings(await request.text())
      if (path === '/handle') return await this.setHandle(await request.text())
      if (path === '/avatar') return await this.setAvatar(await request.text())
      if (path === '/logout') return await this.logout(who.hash)
      if (path === '/delete') return await this.remove()
      if (path === '/friends') return await this.list()
      if (path === '/befriend') return await this.befriend(await request.text())
      if (path === '/accept') return await this.accept(await request.text())
      if (path === '/unfriend') return await this.unfriend(await request.text())
      if (REPORT_PATHS.has(path) && !this.env.REPORTS) return refuse('off', 503)
      if (path === '/report') return await this.sendReport(await request.text())
      if (path === '/reports') return await this.reportList()
      if (path === '/closereport') return await this.closeReport(await request.text())
      if (CHAT_PATHS.has(path) && !this.env.CHAT) return refuse('off', 503)
      if (path === '/chats') return await this.chatList()
      if (path === '/messages') return await this.messages(url.searchParams)
      if (path === '/unread') return Response.json({ unread: unreadOf(await this.chats()) })
      if (path === '/send') return await this.send(await request.text())
      if (path === '/opendm') return await this.openDm(await request.text())
      if (path === '/group') return await this.makeGroup(await request.text())
      if (path === '/members') return await this.changeMembers(await request.text())
      if (path === '/chatticket') return await this.issueTicket(who, await request.text())
      if (path === '/socket') return this.socket(request, who)
      if (BOARD_PATHS.has(path) && !this.env.DESK) return refuse('off', 503)
      if (path === '/boards') return await this.boardList()
      if (path === '/boardsync') return await this.syncBoard(await request.text())
      if (path === '/boardnew') return await this.makeBoard(await request.text())
      if (path === '/boardmembers') return await this.boardMembers(await request.text())
      if (path === '/boarddelete') return await this.deleteBoard(await request.text())
      if (path === '/pulse') return await this.pulse(await request.text())
      if (path === '/invite') return await this.invite(await request.text())
      if (path === '/answer') return await this.answer(await request.text())
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
    return Response.json({ status: 'ok', token: await this.signIn(user), user })
  }

  // Ключ сессии Arcade от экземпляра человека
  async signIn(user) {
    const space = this.env.ACCOUNT
    const answer = await space.get(space.idFromName(`gh:${user.id}`)).fetch(new Request('https://account/login', { method: 'POST', body: JSON.stringify(user) }))
    return (await answer.json()).token
  }

  // --- Вход кнопкой ---------------------------------------------------------------------------------------------
  // Вход ждёт в web:<state> → { key, mark, until } (key — хеш ключа мода), после GitHub — ещё user и nonce (хеш
  // ключа формы на странице), потом confirmed, denied или broken. Будильник экземпляру 'auth' ставить нельзя: alarm()
  // удалил бы реестр ников, — поэтому старые входы убирает следующий новый.
  // Включён, если есть секрет и адрес возврата и мод спрашивает тот сайт, куда GitHub вернёт человека
  webReady(origin) {
    const back = this.env.GITHUB_CALLBACK
    if (!this.env.GITHUB_CLIENT_SECRET || typeof back !== 'string' || !back.startsWith('https://')) return false
    try {
      return new URL(back).origin === origin
    } catch {
      return false
    }
  }

  async webStart(ip, origin) {
    if (!this.webReady(origin)) return refuse('off', 503)
    await this.count(ip, 'starts')
    const now = Date.now()
    const old = [...(await this.ctx.storage.list({ prefix: 'web:', limit: 500 }))].filter(([, v]) => !(v?.until > now)).map(([k]) => k)
    if (old.length) await this.ctx.storage.delete(old.slice(0, 128))
    const state = randomKey()
    const key = randomKey()
    const mark = markCode()
    await this.ctx.storage.put(`web:${state}`, { key: await sha256(key), mark, until: now + WEB_MS })
    const query = new URLSearchParams({ client_id: this.env.GITHUB_CLIENT_ID, redirect_uri: this.env.GITHUB_CALLBACK, scope: '', state })
    return Response.json({ url: `https://github.com/login/oauth/authorize?${query}`, state, key, mark, interval: WEB_INTERVAL, expires: WEB_MS / 1000 })
  }

  // Вход, который ещё ждёт; истёк — забываем
  async webEntry(state) {
    if (typeof state !== 'string' || !STATE.test(state)) return null
    const entry = await this.ctx.storage.get(`web:${state}`)
    if (entry && entry.until > Date.now()) return entry
    if (entry) await this.ctx.storage.delete(`web:${state}`)
    return null
  }

  async webPoll(text, ip) {
    const { state, key } = parsed(text)
    if (typeof state !== 'string' || !STATE.test(state) || typeof key !== 'string' || !STATE.test(key)) return refuse('bad request', 400)
    await this.count(ip, 'polls')
    const entry = await this.webEntry(state)
    // Чужой ключ — как будто входа нет: по одному state, который был в браузере, не войти
    if (!entry || entry.key !== (await sha256(key))) return Response.json({ status: 'expired' })
    if (!entry.confirmed && !entry.denied && !entry.broken) return Response.json({ status: 'pending' })
    await this.ctx.storage.delete(`web:${state}`)
    if (entry.denied) return Response.json({ status: 'denied' })
    if (entry.broken) return refuse('app', 503)
    return Response.json({ status: 'ok', token: await this.signIn(entry.user), user: entry.user })
  }

  // GitHub вернул человека: код GitHub — в токен, токен — в профиль, и спросить «Войти в Arcade как @…?». Второй раз с
  // тем же state страница не открывается: иначе знающий адрес подтвердил бы чужой вход
  async callback(params, lang) {
    const t = pageText(lang)
    const state = params.get('state') ?? ''
    const entry = await this.webEntry(state)
    if (!entry || entry.user || entry.denied || entry.broken) return note(t, t.stale, 400)
    if (params.get('error') === 'access_denied') {
      await this.ctx.storage.put(`web:${state}`, { ...entry, denied: true })
      return note(t, t.cancelled)
    }
    const code = params.get('code') ?? ''
    if (!GH_CODE.test(code)) return note(t, t.stale, 400)
    let user
    try {
      const data = await this.github('https://github.com/login/oauth/access_token', { client_secret: this.env.GITHUB_CLIENT_SECRET, code, redirect_uri: this.env.GITHUB_CALLBACK })
      if (typeof data.access_token !== 'string' || !data.access_token) return note(t, t.stale, 400)
      user = await this.githubUser(data.access_token)
      await this.revoke(data.access_token)
    } catch (error) {
      if (!(error instanceof AppError)) return note(t, t.broken, 502)
      await this.ctx.storage.put(`web:${state}`, { ...entry, broken: true })
      return note(t, t.broken, 503)
    }
    const fresh = await this.webEntry(state)
    if (!fresh || fresh.user || fresh.denied || fresh.broken) return note(t, t.stale, 400)
    const nonce = randomKey()
    await this.ctx.storage.put(`web:${state}`, { ...fresh, user, nonce: await sha256(nonce) })
    const hidden = (name, value) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`
    return page(t, `<h1>${escapeHtml(t.ask(user.login))}</h1><p class="dim">${escapeHtml(t.mark)}</p><p class="mark">${escapeHtml(fresh.mark)}</p>`
      + `<p class="dim">${escapeHtml(t.warn)}</p><form method="post" action="/api/auth/confirm">${hidden('state', state)}${hidden('nonce', nonce)}`
      + `<button class="yes" name="answer" value="yes">${escapeHtml(t.yes)}</button><button name="answer" value="no">${escapeHtml(t.no)}</button></form>`)
  }

  // Ответ со страницы «Войти в Arcade как @…?»: войти — мод при следующем вопросе получит ключ сессии; «Это не я» —
  // вход отменён
  async confirm(text, lang) {
    const t = pageText(lang)
    const form = new URLSearchParams(text)
    const state = form.get('state') ?? ''
    const nonce = form.get('nonce') ?? ''
    const entry = await this.webEntry(state)
    if (!entry?.nonce || !STATE.test(nonce) || entry.nonce !== (await sha256(nonce)) || entry.denied) return note(t, t.stale, 400)
    if (entry.confirmed) return note(t, t.done)
    const yes = form.get('answer') === 'yes'
    await this.ctx.storage.put(`web:${state}`, { ...entry, ...(yes ? { confirmed: true } : { denied: true }) })
    return note(t, yes ? t.done : t.cancelled)
  }

  // Токен GitHub от входа кнопкой больше не нужен — отзываем его сразу; не вышло — не беда, он нигде не сохранён
  async revoke(token) {
    try {
      await fetch(`https://api.github.com/applications/${this.env.GITHUB_CLIENT_ID}/token`, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${btoa(`${this.env.GITHUB_CLIENT_ID}:${this.env.GITHUB_CLIENT_SECRET}`)}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': AGENT,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ access_token: token }),
        signal: AbortSignal.timeout(FETCH_MS),
      })
    } catch {
      // GitHub не ответил
    }
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

  // Кто спрашивает: ключ сессии подходит — { hash } (его хеш), билет чата — { hash, ticket } (хеш сессии, из которой
  // его выдали, и до какого времени он годен), код ссылки — { hash, link: true }; не подходит — null. Заодно раз в
  // сутки отмечаем, что человек заходил
  async session(header) {
    const m = /^(Bearer|Chat|Link) (\S+)$/.exec(header ?? '')
    if (!m) return null
    const sessions = (await this.ctx.storage.get('sessions')) ?? []
    let who = null
    if (m[1] === 'Chat') who = await this.ticketSession(m[2], sessions)
    else if (m[1] === 'Link') who = await this.linkSession(m[2], sessions)
    else if (TOKEN.test(m[2])) {
      const hash = await sha256(m[2])
      if (sessions.some((s) => s.hash === hash)) who = { hash }
    }
    if (!who) return null
    const now = Date.now()
    if (now - ((await this.ctx.storage.get('seen')) ?? 0) >= DAY) {
      await this.ctx.storage.put('seen', now)
      await this.ctx.storage.setAlarm(now + IDLE_MS)
    }
    return who
  }

  // Билет чата: подпись верна, не истёк, выдан этому человеку, и сессия, из которой его выдали, ещё жива
  async ticketSession(ticket, sessions, payload = chatPayload) {
    const m = CHAT_TICKET.exec(ticket)
    const secret = this.env.LINK_SECRET
    if (!m || !secret || Number(m[2]) * 1000 <= Date.now() || m[1] !== (await this.myId())) return null
    if (!(await signed(secret, payload(m[1], m[2], m[3]), m[4]))) return null
    const session = sessions.find((s) => s.hash.startsWith(m[3]))
    return session ? { hash: session.hash, ticket: Number(m[2]) * 1000 } : null
  }

  // Код ссылки — как билет, но со своей подписью и один раз: использованные помним, пока они не истекли
  async linkSession(code, sessions) {
    const who = await this.ticketSession(code, sessions, linkPayload)
    if (!who) return null
    const now = Date.now()
    const used = ((await this.ctx.storage.get('links')) ?? []).filter((l) => l.until > now)
    if (used.some((l) => l.code === code)) return null
    await this.ctx.storage.put('links', [...used, { code, until: who.ticket }])
    return { hash: who.hash, link: true }
  }

  async myId() {
    return ((await this.ctx.storage.get('user')) ?? {}).id
  }

  async me() {
    const { id, login, avatar } = (await this.ctx.storage.get('user')) ?? {}
    const handle = await this.ctx.storage.get('handle')
    const pic = await this.ctx.storage.get('pic')
    const circle = await this.circle()
    const friends = Object.keys(circle.friends).length
    const requests = Object.keys(circle.incoming).filter((other) => !circle.friends[other]).length
    const unread = unreadOf(await this.chats())
    return Response.json({
      user: { id, login, ...(avatar ? { avatar } : {}) },
      settings: (await this.ctx.storage.get('settings')) ?? {},
      ...(await this.named(handle)),
      ...(validPic(pic) ? { pic } : {}),
      ...(friends ? { friends } : {}),
      ...(requests ? { requests } : {}),
      ...(unread ? { unread } : {}),
      ...(admins(this.env).has(id) ? { role: 'admin' } : {}),
    })
  }

  // Ник и его подпись для ответа; без ника — ничего, без LINK_SECRET — ник без подписи
  async named(handle) {
    if (!handle) return {}
    const secret = this.env.LINK_SECRET
    return { handle, ...(secret ? { ticket: await nameTicket(secret, handle, Date.now()) } : {}) }
  }

  // Вопрос к реестру ников в экземпляре 'auth'
  registry(path, body) {
    const space = this.env.ACCOUNT
    return space.get(space.idFromName('auth')).fetch(new Request(`https://account${path}`, { method: 'POST', body: JSON.stringify(body) }))
  }

  // Взять ник: проверить вид, спросить реестр, запомнить у себя
  async setHandle(text) {
    let handle = ''
    try {
      handle = normalHandle(JSON.parse(text)?.handle)
    } catch {
      // не JSON — ник пустой, ниже ответим 400
    }
    const problem = handleProblem(handle)
    if (problem) return Response.json({ error: problem }, { status: 400 })
    const { id } = (await this.ctx.storage.get('user')) ?? {}
    const answer = await this.registry('/claim', { id, handle })
    if (!answer.ok) return answer
    await this.ctx.storage.put('handle', handle)
    return Response.json(await this.named(handle))
  }

  // Аватарка — номер одной из 24 готовых картинок или null (без неё): в реестр, чтобы её видели друзья, и к себе
  async setAvatar(text) {
    const pic = parsed(text).pic
    if (pic !== null && !validPic(pic)) return refuse('invalid', 400)
    const now = Date.now()
    this.picks = this.picks.filter((t) => now - t < MINUTE)
    if (this.picks.length >= PICKS_PER_MINUTE) return refuse('often', 429)
    this.picks.push(now)
    const { id } = (await this.ctx.storage.get('user')) ?? {}
    const answer = await this.registry('/pic', { id, pic })
    if (!answer.ok) throw new Error(`registry: ${answer.status}`)
    if (pic === null) await this.ctx.storage.delete('pic')
    else await this.ctx.storage.put('pic', pic)
    return Response.json(pic === null ? {} : { pic })
  }

  // Реестр: ник свободен, держится за этим же человеком или его месяц прошёл — ник его; прежний ник держится месяц
  async claim({ id, handle }) {
    const now = Date.now()
    const owner = (await this.ctx.storage.get(`owner:${id}`)) ?? { changes: [] }
    if (owner.handle === handle) return Response.json({ handle })
    const record = await this.ctx.storage.get(`handle:${handle}`)
    const held = record && record.id !== id && !(record.until <= now)
    if (held) return Response.json({ error: 'taken' }, { status: 409 })
    const changes = owner.changes.filter((t) => now - t < DAY)
    if (changes.length >= HANDLE_CHANGES) return Response.json({ error: 'often' }, { status: 429 })
    await this.ctx.storage.put({
      [`handle:${handle}`]: { id },
      [`owner:${id}`]: { ...owner, handle, changes: [...changes, now] },
      ...(owner.handle ? { [`handle:${owner.handle}`]: { id, until: now + HANDLE_HOLD_MS } } : {}),
    })
    return Response.json({ handle })
  }

  // Реестр: аккаунт удалён — его ник держится месяц, потом свободен
  async release({ id }) {
    const owner = await this.ctx.storage.get(`owner:${id}`)
    if (owner?.handle) await this.ctx.storage.put(`handle:${owner.handle}`, { id, until: Date.now() + HANDLE_HOLD_MS })
    await this.ctx.storage.delete(`owner:${id}`)
    return Response.json({ ok: true })
  }

  // Реестр: номер аватарки человека рядом с его ником; null — без аватарки
  async savePic({ id, pic }) {
    if (typeof id !== 'string' || !ACCOUNT_ID.test(id) || (pic !== null && !validPic(pic))) return refuse('bad request', 400)
    const owner = { ...((await this.ctx.storage.get(`owner:${id}`)) ?? { changes: [] }), pic }
    if (pic === null) delete owner.pic
    await this.ctx.storage.put(`owner:${id}`, owner)
    return Response.json({ ok: true })
  }

  // Реестр: чей это ник сейчас. Сменённый или отпущенный ник, пока держится за прежним хозяином, — ничей
  async lookup({ handle }) {
    const record = typeof handle === 'string' && HANDLE.test(handle) ? await this.ctx.storage.get(`handle:${handle}`) : null
    if (!record || record.until) return refuse('nobody', 404)
    return Response.json({ id: record.id })
  }

  // Реестр: ники и номера аватарок по номерам — для списка друзей; у удалённого аккаунта ника нет. Хранилище отдаёт
  // не больше 128 ключей за раз
  async names({ ids }) {
    if (!Array.isArray(ids) || ids.length > MAX_FRIENDS + MAX_INCOMING || !ids.every((id) => typeof id === 'string' && ACCOUNT_ID.test(id))) return refuse('bad request', 400)
    const names = {}
    const pics = {}
    for (let i = 0; i < ids.length; i += 128) {
      const owners = await this.ctx.storage.get(ids.slice(i, i + 128).map((id) => `owner:${id}`))
      for (const [key, owner] of owners) {
        if (!owner?.handle) continue
        const id = key.slice('owner:'.length)
        names[id] = owner.handle
        if (validPic(owner.pic)) pics[id] = owner.pic
      }
    }
    return Response.json({ names, pics })
  }

  // --- Друзья ---------------------------------------------------------------------------------------------------
  // Круг человека — circle: friends, incoming (заявки ему) и outgoing (его заявки) — { номер: когда }, declined — кого
  // и когда он отклонил, asked — когда он звал в друзья за последние сутки. Друзья держатся за номер аккаунта, ники для
  // списка — из реестра. Дружба взаимная: каждая сторона хранит свой круг, экземпляры сообщают друг другу о заявках
  async circle() {
    const circle = (await this.ctx.storage.get('circle')) ?? {}
    return { friends: circle.friends ?? {}, incoming: circle.incoming ?? {}, outgoing: circle.outgoing ?? {}, declined: circle.declined ?? {}, asked: circle.asked ?? [] }
  }

  // Сохранить круг; старые отказы и заявки старше суток не храним
  async saveCircle(circle, now) {
    const declined = Object.fromEntries(Object.entries(circle.declined).filter(([, at]) => now - at < DECLINE_HOLD_MS))
    await this.ctx.storage.put('circle', { ...circle, declined, asked: circle.asked.filter((at) => now - at < DAY) })
  }

  // Вопрос к экземпляру другого человека
  person(id, path, body) {
    const space = this.env.ACCOUNT
    return space.get(space.idFromName(`gh:${id}`)).fetch(new Request(`https://account${path}`, { method: 'POST', body: JSON.stringify(body) }))
  }

  // Списки с никами: друзья — по нику, заявки — по времени. Кто сразу и друг, и в заявках — только друг. Номер без
  // ника в реестре — аккаунт удалён: он уходит из круга
  async list(status) {
    let circle = await this.circle()
    const ids = [...new Set([...Object.keys(circle.friends), ...Object.keys(circle.incoming), ...Object.keys(circle.outgoing)])]
    let names = {}
    let pics = {}
    if (ids.length) {
      const answer = await this.registry('/names', { ids })
      if (!answer.ok) throw new Error(`registry: ${answer.status}`)
      const found = await answer.json()
      names = found.names ?? {}
      pics = found.pics ?? {}
    }
    const gone = ids.filter((id) => !names[id])
    if (gone.length) {
      circle = await this.circle()
      for (const id of gone) circle = { ...circle, friends: without(circle.friends, id), incoming: without(circle.incoming, id), outgoing: without(circle.outgoing, id) }
      await this.saveCircle(circle, Date.now())
    }
    const people = (map, skip) =>
      Object.entries(map)
        .filter(([id]) => names[id] && !skip.some((other) => other[id]))
        .sort((a, b) => a[1] - b[1])
        .map(([id]) => ({ id, handle: names[id], ...(validPic(pics[id]) ? { pic: pics[id] } : {}) }))
    const friends = people(circle.friends, []).sort((a, b) => a.handle.localeCompare(b.handle))
    return Response.json({ ...(status ? { status } : {}), friends, incoming: people(circle.incoming, [circle.friends]), outgoing: people(circle.outgoing, [circle.friends, circle.incoming]) })
  }

  // Позвать в друзья по точному нику. Он уже звал тебя — это согласие, сразу друзья
  async befriend(text) {
    const handle = normalHandle(parsed(text).handle)
    if (!HANDLE.test(handle)) return refuse('invalid', 400)
    const mine = await this.ctx.storage.get('handle')
    if (!mine) return refuse('nohandle', 409)
    if (handle === mine) return refuse('self', 400)
    const { id: me } = (await this.ctx.storage.get('user')) ?? {}
    const now = Date.now()
    let circle = await this.circle()
    const asked = circle.asked.filter((at) => now - at < DAY)
    if (asked.length >= REQUESTS_DAILY) return refuse('often', 429)
    await this.saveCircle({ ...circle, asked: [...asked, now] }, now)
    const found = await this.registry('/lookup', { handle })
    if (found.status === 404) return refuse('nobody', 404)
    if (!found.ok) throw new Error(`registry: ${found.status}`)
    const { id } = await found.json()
    if (id === me) return refuse('self', 400)
    circle = await this.circle()
    if (circle.friends[id]) return this.list('friends')
    if (circle.incoming[id]) return this.welcome(id, me, 'friends')
    if (!circle.outgoing[id] && Object.keys(circle.friends).length + Object.keys(circle.outgoing).length >= MAX_FRIENDS) return refuse('full', 409)
    const answer = await this.person(id, '/incoming', { id: me })
    if (answer.status === 404) return refuse('nobody', 404)
    if (!answer.ok) throw new Error(`friend: ${answer.status}`)
    const { status } = await answer.json()
    if (status === 'full') return refuse('busy', 409)
    circle = await this.circle()
    const made = status === 'friends'
    await this.saveCircle(made ? befriended(circle, id, now) : { ...circle, outgoing: { ...circle.outgoing, [id]: now }, declined: without(circle.declined, id) }, now)
    return this.list(made ? 'friends' : 'sent')
  }

  async accept(text) {
    const { id } = parsed(text)
    if (typeof id !== 'string' || !ACCOUNT_ID.test(id)) return refuse('bad request', 400)
    const { id: me } = (await this.ctx.storage.get('user')) ?? {}
    return this.welcome(id, me)
  }

  // Принять заявку id: он узнаёт об этом, оба — друзья. Он её уже отменил или удалил аккаунт — заявки нет
  async welcome(id, me, status) {
    const now = Date.now()
    let circle = await this.circle()
    if (circle.friends[id]) return this.list(status)
    if (!circle.incoming[id]) return refuse('gone', 404)
    if (Object.keys(circle.friends).length + Object.keys(circle.outgoing).length >= MAX_FRIENDS) return refuse('full', 409)
    const answer = await this.person(id, '/accepted', { id: me })
    if (answer.status === 404) {
      circle = await this.circle()
      await this.saveCircle({ ...circle, incoming: without(circle.incoming, id) }, now)
      return refuse('gone', 404)
    }
    if (!answer.ok) throw new Error(`friend: ${answer.status}`)
    await this.saveCircle(befriended(await this.circle(), id, now), now)
    return this.list(status)
  }

  // Удалить друга или отменить свою заявку — он забывает тебя; отклонить заявку — молча: у того, кто звал, она так
  // и ждёт ответа, а снова позвать он сможет через месяц
  async unfriend(text) {
    const { id } = parsed(text)
    if (typeof id !== 'string' || !ACCOUNT_ID.test(id)) return refuse('bad request', 400)
    const { id: me } = (await this.ctx.storage.get('user')) ?? {}
    let circle = await this.circle()
    const friend = Boolean(circle.friends[id])
    if (friend || circle.outgoing[id]) {
      const answer = await this.person(id, '/drop', { id: me })
      if (!answer.ok && answer.status !== 404) throw new Error(`friend: ${answer.status}`)
    }
    const now = Date.now()
    circle = await this.circle()
    const declined = circle.incoming[id] && !circle.friends[id] ? { ...circle.declined, [id]: now } : circle.declined
    await this.saveCircle({ ...circle, friends: without(circle.friends, id), incoming: without(circle.incoming, id), outgoing: without(circle.outgoing, id), declined }, now)
    // Больше не друзья — чата двоих больше нет у обоих; общие группы остаются
    if (friend && this.env.CHAT) await this.chat(dmId(me, id), '/close', {}).catch(() => null)
    return this.list()
  }

  // Заявка от id: 'friends' — уже друзья или этот человек сам звал id (тогда друзья теперь), 'sent' — заявка ждёт
  // ответа, 'full' — заявок слишком много. Аккаунта здесь нет — 404, и ничего не записываем
  async incoming({ id }) {
    if (typeof id !== 'string' || !ACCOUNT_ID.test(id) || !(await this.ctx.storage.get('user'))) return refuse('nobody', 404)
    const now = Date.now()
    const circle = await this.circle()
    if (circle.friends[id]) return Response.json({ status: 'friends' })
    if (circle.outgoing[id]) {
      await this.saveCircle(befriended(circle, id, now), now)
      return Response.json({ status: 'friends' })
    }
    if (circle.incoming[id] || circle.declined[id] > now - DECLINE_HOLD_MS) return Response.json({ status: 'sent' })
    if (Object.keys(circle.incoming).length >= MAX_INCOMING) return Response.json({ status: 'full' })
    await this.saveCircle({ ...circle, incoming: { ...circle.incoming, [id]: now } }, now)
    return Response.json({ status: 'sent' })
  }

  // id принял заявку этого человека — друзья. Заявки уже нет — 404
  async accepted({ id }) {
    const circle = await this.circle()
    if (circle.friends[id]) return Response.json({ ok: true })
    if (typeof id !== 'string' || !circle.outgoing[id] || !(await this.ctx.storage.get('user'))) return refuse('gone', 404)
    const now = Date.now()
    await this.saveCircle(befriended(circle, id, now), now)
    return Response.json({ ok: true })
  }

  // id удалил этого человека из друзей, отменил заявку или удалил аккаунт: забыть id. Нечего забывать — не пишем
  async drop({ id }) {
    const circle = await this.circle()
    if (typeof id !== 'string' || !(circle.friends[id] || circle.incoming[id] || circle.outgoing[id])) return Response.json({ ok: true })
    const now = Date.now()
    await this.saveCircle({ ...circle, friends: without(circle.friends, id), incoming: without(circle.incoming, id), outgoing: without(circle.outgoing, id) }, now)
    return Response.json({ ok: true })
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

  // Выйти на этом компьютере: забыть его ключ сессии; билеты чата из этой сессии больше не годны
  async logout(hash) {
    const sessions = (await this.ctx.storage.get('sessions')) ?? []
    await this.ctx.storage.put('sessions', sessions.filter((s) => s.hash !== hash))
    this.closeSockets(hash.slice(0, 12))
    return Response.json({ ok: true })
  }

  // Удалить аккаунт: всё, что о человеке знает сайт
  async remove() {
    await this.forget()
    this.closeSockets()
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
    return Response.json({ ok: true })
  }

  // Год без входа — аккаунт удаляется; заходил — будильник переносится на год после последнего входа
  async alarm() {
    const seen = (await this.ctx.storage.get('seen')) ?? 0
    if (Date.now() - seen >= IDLE_MS) {
      await this.forget()
      await this.ctx.storage.deleteAll()
    } else await this.ctx.storage.setAlarm(seen + IDLE_MS)
  }

  // Перед удалением аккаунта — закрыть его чаты двоих и выйти из групп и досок, убрать его у друзей и у тех, с кем были
  // заявки, и отпустить ник в реестре. Кто не ответил, уберёт его сам: у номера в реестре больше нет ника
  async forget() {
    const { id } = (await this.ctx.storage.get('user')) ?? {}
    if (!id) return
    const circle = await this.circle()
    if (this.env.CHAT) {
      const chats = Object.keys(await this.chats())
      const dms = new Set([...Object.keys(circle.friends).map((other) => dmId(id, other)), ...chats.filter((chat) => chat.startsWith('d'))])
      const groups = chats.filter((chat) => chat.startsWith('g'))
      await Promise.allSettled([...[...dms].map((chat) => this.chat(chat, '/close', {})), ...groups.map((chat) => this.chat(chat, '/members', { leave: true }))])
    }
    if (this.env.DESK) await Promise.allSettled(Object.keys(await this.boards()).map((board) => this.desk(board, '/members', { leave: true })))
    const others = new Set([...Object.keys(circle.friends), ...Object.keys(circle.incoming), ...Object.keys(circle.outgoing)])
    await Promise.allSettled([...others].map((other) => this.person(other, '/drop', { id })))
    if ((await this.ctx.storage.get('handle')) || (await this.ctx.storage.get('pic')) !== undefined) {
      const answer = await this.registry('/release', { id })
      if (!answer.ok) throw new Error(`registry: ${answer.status}`)
    }
    if (this.env.REPORTS) {
      const answer = await askReports(this.env, '/forget', { id })
      if (!answer.ok) throw new Error(`reports: ${answer.status}`)
    }
  }

  // Отчёт об ошибке со входом: подписан номером и @ником, лимит — на аккаунт, а не на адрес
  async sendReport(text) {
    const clean = cleanReport(parsed(text))
    if (clean.error) return refuse(clean.error, 400)
    const from = await this.whoami()
    return addReport(this.env, { ...clean.report, from }, `gh:${from.id}`)
  }

  // Список и закрытие отчётов — только админам
  async reportList() {
    if (!admins(this.env).has(await this.myId())) return refuse('admin', 403)
    return askReports(this.env, '/list')
  }

  async closeReport(text) {
    if (!admins(this.env).has(await this.myId())) return refuse('admin', 403)
    const { id } = parsed(text)
    if (!Number.isSafeInteger(id) || id < 1) return refuse('bad request', 400)
    return askReports(this.env, '/close', { id })
  }

  // --- Чаты -----------------------------------------------------------------------------------------------------
  // Список чатов человека — chats: { чат: { kind, with? (с кем чат двоих), name? и pic? (название и картинка группы),
  // last (номер последнего сообщения), read (до какого прочитано), at (когда было последнее), p? (оно само, коротко) } }. Сами
  // переписки — в объектах Chat; они сообщают сюда о каждом новом сообщении, отсюда — открытым страницам чата
  async chats() {
    return (await this.ctx.storage.get('chats')) ?? {}
  }

  // Вопрос к чату от имени этого человека
  async chat(id, path, body) {
    const space = this.env.CHAT
    const by = await this.myId()
    return space.get(space.idFromName(id)).fetch(new Request(`https://chat${path}`, { method: 'POST', body: JSON.stringify({ ...body, chat: id, by }) }))
  }

  // Ники и номера аватарок по номерам — из реестра, пачками; у удалённого аккаунта ника нет
  async people(list) {
    const ids = [...new Set(list.filter((id) => typeof id === 'string' && ACCOUNT_ID.test(id)))]
    const names = {}
    const pics = {}
    for (let i = 0; i < ids.length; i += MAX_FRIENDS + MAX_INCOMING) {
      const answer = await this.registry('/names', { ids: ids.slice(i, i + MAX_FRIENDS + MAX_INCOMING) })
      if (!answer.ok) throw new Error(`registry: ${answer.status}`)
      const found = await answer.json()
      Object.assign(names, found.names ?? {})
      Object.assign(pics, found.pics ?? {})
    }
    return { names, pics }
  }

  // Только ники
  async handles(list) {
    return (await this.people(list)).names
  }

  // Кто я: номер и ник — странице чата и окну, чтобы отличать свои сообщения; чатам — ещё и аватарка
  async whoami(withPic = false) {
    const handle = await this.ctx.storage.get('handle')
    const pic = withPic ? await this.ctx.storage.get('pic') : undefined
    return { id: await this.myId(), ...(handle ? { handle } : {}), ...(validPic(pic) ? { pic } : {}) }
  }

  // Чат сообщает о новом сообщении. Чата ещё нет в списке — появляется, непрочитанное — с этого сообщения; своё
  // сообщение сразу прочитано. Аккаунта уже нет — 404, и ничего не записываем
  async chatnote({ chat, kind, with: other, name, pic, msg }) {
    const me = await this.myId()
    if (!me) return refuse('nobody', 404)
    if (typeof chat !== 'string' || !CHAT_ID.test(chat) || !['dm', 'group'].includes(kind) || !Number.isSafeInteger(msg?.s)) return refuse('bad request', 400)
    const chats = await this.chats()
    const entry = { ...(chats[chat] ?? { last: 0, read: msg.s - 1, at: 0 }), kind, ...(typeof other === 'string' ? { with: other } : {}), ...(typeof name === 'string' ? { name } : {}) }
    // Картинка группы приходит с каждым сообщением: её нет — значит, её убрали
    if (kind === 'group' && validPic(pic)) entry.pic = pic
    else delete entry.pic
    if (msg.s >= entry.last) Object.assign(entry, { last: msg.s, at: msg.at, p: preview(msg) })
    if (msg.f === me) entry.read = Math.max(entry.read, msg.s)
    await this.ctx.storage.put('chats', trimmed({ ...chats, [chat]: entry }, chat))
    await this.push({ type: 'note', chat, msg })
    return Response.json({ ok: true })
  }

  // Чата больше нет: друзья расстались, его убрали из группы, он вышел или удалил аккаунт
  async chatgone({ chat }) {
    if (typeof chat !== 'string' || !CHAT_ID.test(chat)) return refuse('bad request', 400)
    await this.lose(chat)
    await this.push({ type: 'gone', chat })
    return Response.json({ ok: true })
  }

  // Убрать чат из списка
  async lose(chat) {
    const chats = await this.chats()
    if (chats[chat]) await this.ctx.storage.put('chats', without(chats, chat))
  }

  // Чаты, новые сверху, с никами и аватарками собеседников и авторов последних сообщений и с тем, кто из друзей в
  // сети. Страница чата только смотрит, кто в сети: сама она человека «в сети» не отмечает — это делает мод
  async chatList() {
    const chats = await this.chats()
    const list = Object.entries(chats)
      .sort((a, b) => b[1].at - a[1].at)
      .map(([id, c]) => ({ id, kind: c.kind, ...(c.with ? { with: c.with } : {}), ...(c.name ? { name: c.name } : {}), ...(validPic(c.pic) ? { pic: c.pic } : {}), unread: Math.max(0, c.last - c.read), at: c.at, ...(c.p ? { last: c.p } : {}) }))
    const { names, pics } = await this.people(list.flatMap((c) => [c.with, c.last?.f, c.last?.o]))
    const online = await this.onlineFriends(Object.keys((await this.circle()).friends), { peek: true }).catch(() => [])
    return Response.json({
      me: await this.whoami(true),
      chats: list,
      names,
      ...(Object.keys(pics).length ? { pics } : {}),
      ...(online.length ? { online } : {}),
      unread: unreadOf(chats),
    })
  }

  // Переписка: последние сообщения, раньше before или новые после after. Без before чат становится прочитанным, а
  // если его не было в списке (друг открыл чат, но ещё не писал) — появляется
  async messages(params) {
    const chat = params.get('chat') ?? ''
    const [after, before] = ['after', 'before'].map((key) => (params.has(key) ? Number(params.get(key)) : undefined))
    if (!CHAT_ID.test(chat) || ![after, before].every((n) => n === undefined || (Number.isSafeInteger(n) && n >= 0))) return refuse('bad request', 400)
    const answer = await this.chat(chat, '/history', { after, before })
    if (answer.status === 403 || answer.status === 404) {
      await this.lose(chat)
      return refuse('gone', 404)
    }
    if (!answer.ok) throw new Error(`chat: ${answer.status}`)
    const { chat: about, messages, first } = await answer.json()
    const me = await this.whoami(true)
    const other = about.kind === 'dm' ? about.members.find((id) => id !== me.id) : undefined
    let chats = await this.chats()
    const entry = chats[chat]
    const pic = validPic(about.pic) ? about.pic : undefined
    if (before === undefined && (!entry || entry.read < about.last || (about.name && entry.name !== about.name) || (about.kind === 'group' && entry.pic !== pic))) {
      const last = messages.at(-1)
      const fresh = entry ?? { kind: about.kind, ...(other ? { with: other } : {}), at: last?.at ?? Date.now(), ...(last ? { p: preview(last) } : {}) }
      const next = { ...fresh, ...(about.name ? { name: about.name } : {}), last: Math.max(fresh.last ?? 0, about.last), read: about.last }
      if (pic === undefined) delete next.pic
      else next.pic = pic
      chats = trimmed({ ...chats, [chat]: next }, chat)
      await this.ctx.storage.put('chats', chats)
    }
    const { names, pics } = await this.people([...about.members, ...messages.flatMap((m) => [m.f, m.o])])
    return Response.json({ me, chat: { ...about, ...(other ? { with: other } : {}) }, messages, first, names, ...(Object.keys(pics).length ? { pics } : {}), unread: unreadOf(chats) })
  }

  // Написать в чат. В чат двоих — только другу; чата ещё нет — открывается
  async send(text) {
    const { chat, text: raw } = parsed(text)
    if (typeof chat !== 'string' || !CHAT_ID.test(chat)) return refuse('bad request', 400)
    const message = cleanText(raw)
    if (!message) return refuse('empty', 400)
    if (message.length > MAX_TEXT) return refuse('long', 400)
    const now = Date.now()
    this.sends = this.sends.filter((at) => now - at < MINUTE)
    if (this.sends.length >= SENDS_PER_MINUTE) return refuse('often', 429)
    this.sends.push(now)
    const me = await this.myId()
    let other = null
    if (chat.startsWith('d')) {
      other = chat.slice(1).split('-').find((id) => id !== me) ?? null
      if (!other || dmId(me, other) !== chat) return refuse('gone', 404)
      if (!(await this.circle()).friends[other]) return refuse('friend', 403)
    }
    let answer = await this.chat(chat, '/post', { text: message })
    if (answer.status === 404 && other) {
      const opened = await this.chat(chat, '/open', { kind: 'dm', members: [me, other] })
      if (opened.ok) answer = await this.chat(chat, '/post', { text: message })
    }
    if (answer.status === 403 || answer.status === 404) {
      await this.lose(chat)
      return refuse('gone', 404)
    }
    if (!answer.ok) throw new Error(`chat: ${answer.status}`)
    return Response.json({ msg: (await answer.json()).msg })
  }

  // Открыть чат с другом: тот же, что был, или новый
  async openDm(text) {
    const { with: other } = parsed(text)
    if (typeof other !== 'string' || !ACCOUNT_ID.test(other)) return refuse('bad request', 400)
    const me = await this.myId()
    if (other === me || !(await this.circle()).friends[other]) return refuse('friend', 403)
    const chat = dmId(me, other)
    const answer = await this.chat(chat, '/open', { kind: 'dm', members: [me, other] })
    if (!answer.ok) throw new Error(`chat: ${answer.status}`)
    const { chat: about } = await answer.json()
    const chats = await this.chats()
    if (!chats[chat]) await this.ctx.storage.put('chats', trimmed({ ...chats, [chat]: { kind: 'dm', with: other, last: about.last, read: about.last, at: Date.now() } }, chat))
    return Response.json({ chat: { id: chat, kind: 'dm', with: other } })
  }

  // Новая группа из друзей или со всеми друзьями сразу (all — первые MAX_MEMBERS - 1 по времени дружбы). Хозяин — кто
  // создал; нужен свой ник: по нему участники видят, кто их позвал
  async makeGroup(text) {
    const body = parsed(text)
    const name = groupName(body.name)
    if (!name) return refuse('name', 400)
    if (!(await this.ctx.storage.get('handle'))) return refuse('nohandle', 409)
    const me = await this.myId()
    const circle = await this.circle()
    let people
    if (body.all === true) {
      people = Object.entries(circle.friends)
        .sort((a, b) => a[1] - b[1])
        .map(([id]) => id)
        .slice(0, MAX_MEMBERS - 1)
    } else {
      if (!Array.isArray(body.members) || !body.members.every((id) => typeof id === 'string' && ACCOUNT_ID.test(id))) return refuse('bad request', 400)
      people = [...new Set(body.members)].filter((id) => id !== me)
      if (people.some((id) => !circle.friends[id])) return refuse('friend', 403)
      if (people.length > MAX_MEMBERS - 1) return refuse('full', 409)
    }
    if (!people.length) return refuse('empty', 400)
    const now = Date.now()
    const made = ((await this.ctx.storage.get('made')) ?? []).filter((at) => now - at < DAY)
    if (made.length >= GROUPS_DAILY) return refuse('often', 429)
    await this.ctx.storage.put('made', [...made, now])
    const chat = `g${randomKey().slice(0, 16)}`
    const answer = await this.chat(chat, '/open', { kind: 'group', members: [me, ...people], name })
    if (!answer.ok) throw new Error(`chat: ${answer.status}`)
    return Response.json({ chat: (await answer.json()).chat })
  }

  // Группа: хозяин добавляет друзей, убирает участников, переименовывает её и ставит картинку (номер или null — без
  // неё); выйти может любой
  async changeMembers(text) {
    const body = parsed(text)
    const chat = body.chat
    if (typeof chat !== 'string' || !CHAT_ID.test(chat) || !chat.startsWith('g')) return refuse('bad request', 400)
    let change = { leave: true }
    if (body.leave !== true) {
      const list = (value) => (value === undefined ? [] : Array.isArray(value) && value.every((id) => typeof id === 'string' && ACCOUNT_ID.test(id)) ? value : null)
      const [add, remove] = [list(body.add), list(body.remove)]
      if (!add || !remove) return refuse('bad request', 400)
      if (add.length) {
        const circle = await this.circle()
        if (add.some((id) => !circle.friends[id])) return refuse('friend', 403)
      }
      const name = body.name === undefined ? '' : groupName(body.name)
      if (body.name !== undefined && !name) return refuse('name', 400)
      if (body.pic !== undefined && body.pic !== null && !validPic(body.pic)) return refuse('bad request', 400)
      change = { add, remove, ...(name ? { name } : {}), ...(body.pic !== undefined ? { pic: body.pic } : {}) }
    }
    const answer = await this.chat(chat, '/members', change)
    const data = await answer.json().catch(() => ({}))
    if (data.error === 'owner' || data.error === 'full') return refuse(data.error, answer.status)
    if (answer.status === 403 || answer.status === 404) {
      await this.lose(chat)
      return refuse('gone', 404)
    }
    if (!answer.ok) throw new Error(`chat: ${answer.status}`)
    if (change.leave) {
      await this.lose(chat)
      return Response.json({ ok: true })
    }
    return Response.json({ chat: data.chat })
  }

  // --- Доски проектов ---------------------------------------------------------------------------------------------
  // Список общих досок человека — boards: { доска: { name, owner, rev (номер последней правки), at (когда она была) } }.
  // Сами доски — в объектах Desk; они сообщают сюда о каждой правке. Карточки мод сверяет с доской сам
  async boards() {
    return (await this.ctx.storage.get('boards')) ?? {}
  }

  // Вопрос к доске от имени этого человека
  async desk(id, path, body) {
    const space = this.env.DESK
    const by = await this.myId()
    return space.get(space.idFromName(id)).fetch(new Request(`https://desk${path}`, { method: 'POST', body: JSON.stringify({ ...body, board: id, by }) }))
  }

  // Запомнить, что доска знает о себе, если это новее
  async keepBoard(about) {
    const boards = await this.boards()
    const old = boards[about.id]
    if (old && old.rev >= about.rev && old.name === about.name && old.owner === about.owner) return
    if (!old && Object.keys(boards).length >= MAX_BOARDS) return
    const rev = Math.max(old?.rev ?? 0, about.rev)
    await this.ctx.storage.put('boards', { ...boards, [about.id]: { name: about.name, owner: about.owner, rev, at: rev > (old?.rev ?? 0) ? Date.now() : old.at } })
  }

  async loseBoard(id) {
    const boards = await this.boards()
    if (boards[id]) await this.ctx.storage.put('boards', without(boards, id))
  }

  // Доска сообщает о правке: в списке новый номер, название и хозяин. Аккаунта уже нет — 404
  async boardnote({ board, name, owner, rev }) {
    if (!(await this.myId())) return refuse('nobody', 404)
    if (typeof board !== 'string' || !BOARD_ID.test(board) || typeof name !== 'string' || typeof owner !== 'string' || !Number.isSafeInteger(rev)) return refuse('bad request', 400)
    await this.keepBoard({ id: board, name, owner, rev })
    return Response.json({ ok: true })
  }

  // Доски больше нет: её удалили, его убрали или он вышел
  async boardgone({ board }) {
    if (typeof board !== 'string' || !BOARD_ID.test(board)) return refuse('bad request', 400)
    await this.loseBoard(board)
    return Response.json({ ok: true })
  }

  async boardList() {
    const boards = await this.boards()
    const list = Object.entries(boards)
      .sort((a, b) => b[1].at - a[1].at)
      .map(([id, b]) => ({ id, name: b.name, owner: b.owner, rev: b.rev, at: b.at }))
    const names = list.length ? await this.handles(list.map((b) => b.owner)) : {}
    return Response.json({ me: await this.whoami(), boards: list, names })
  }

  // Друзья для доски: номера без повторов и без себя, только друзья. Не так — ответ с отказом
  async friendsOnly(value, me) {
    if (value === undefined) return []
    if (!Array.isArray(value) || !value.every((id) => typeof id === 'string' && ACCOUNT_ID.test(id))) return refuse('bad request', 400)
    const people = [...new Set(value)].filter((id) => id !== me)
    if (!people.length) return people
    const circle = await this.circle()
    return people.some((id) => !circle.friends[id]) ? refuse('friend', 403) : people
  }

  // Новая общая доска; хозяин — кто завёл, сразу можно позвать друзей. Нужен свой ник: по нему видно, кто позвал.
  // Своих общих досок — не больше MAX_OWNED
  async makeBoard(text) {
    const body = parsed(text)
    const name = cleanTitle(body.name)
    if (!name) return refuse('name', 400)
    const cols = body.cols === undefined ? undefined : cleanCols(body.cols)
    if (cols === null) return refuse('bad request', 400)
    if (!(await this.ctx.storage.get('handle'))) return refuse('nohandle', 409)
    const me = await this.myId()
    const people = await this.friendsOnly(body.members, me)
    if (people instanceof Response) return people
    if (people.length > BOARD_MEMBERS - 1) return refuse('full', 409)
    if (Object.values(await this.boards()).filter((b) => b.owner === me).length >= MAX_OWNED) return refuse('many', 409)
    const now = Date.now()
    const made = ((await this.ctx.storage.get('boardsMade')) ?? []).filter((at) => now - at < DAY)
    if (made.length >= BOARDS_DAILY) return refuse('often', 429)
    await this.ctx.storage.put('boardsMade', [...made, now])
    const board = `b${randomKey().slice(0, 16)}`
    const opened = await this.desk(board, '/open', { name, ...(cols ? { cols } : {}) })
    if (!opened.ok) throw new Error(`desk: ${opened.status}`)
    let data = await opened.json()
    if (people.length) {
      const added = await this.desk(board, '/members', { add: people })
      if (added.ok) data = { ...data, board: (await added.json()).board }
    }
    await this.keepBoard(data.board)
    return Response.json({ ...data, names: await this.handles(data.board.members) })
  }

  // Сверка с доской: отдать правки и взять поменявшееся. Доски нет или его на ней нет — она уходит из списка
  async syncBoard(text) {
    const { board, since, ops, names } = parsed(text)
    if (typeof board !== 'string' || !BOARD_ID.test(board) || (ops !== undefined && (!Array.isArray(ops) || ops.length > MAX_OPS))) return refuse('bad request', 400)
    const now = Date.now()
    this.syncs = this.syncs.filter((at) => now - at < MINUTE)
    if (this.syncs.length >= SYNCS_PER_MINUTE) return refuse('often', 429)
    this.syncs.push(now)
    const answer = await this.desk(board, '/sync', { since, ops: ops ?? [] })
    if (answer.status === 403 || answer.status === 404) {
      await this.loseBoard(board)
      return refuse('gone', 404)
    }
    if (answer.status === 400) return refuse('bad request', 400)
    if (!answer.ok) throw new Error(`desk: ${answer.status}`)
    const data = await answer.json()
    await this.keepBoard(data.board)
    return Response.json(names === true ? { ...data, names: await this.handles(data.board.members) } : data)
  }

  // Участники доски: хозяин зовёт друзей и убирает людей; выйти может любой
  async boardMembers(text) {
    const body = parsed(text)
    const board = body.board
    if (typeof board !== 'string' || !BOARD_ID.test(board)) return refuse('bad request', 400)
    let change = { leave: true }
    if (body.leave !== true) {
      const me = await this.myId()
      const add = await this.friendsOnly(body.add, me)
      if (add instanceof Response) return add
      const remove = body.remove === undefined ? [] : body.remove
      if (!Array.isArray(remove) || !remove.every((id) => typeof id === 'string' && ACCOUNT_ID.test(id))) return refuse('bad request', 400)
      change = { add, remove }
    }
    const answer = await this.desk(board, '/members', change)
    const data = await answer.json().catch(() => ({}))
    if (data.error === 'owner' || data.error === 'full') return refuse(data.error, answer.status)
    if (answer.status === 403 || answer.status === 404) {
      await this.loseBoard(board)
      return refuse('gone', 404)
    }
    if (!answer.ok) throw new Error(`desk: ${answer.status}`)
    if (change.leave) {
      await this.loseBoard(board)
      return Response.json({ ok: true })
    }
    await this.keepBoard(data.board)
    return Response.json({ board: data.board, names: await this.handles(data.board.members) })
  }

  // Удалить доску у всех — только хозяин
  async deleteBoard(text) {
    const { board } = parsed(text)
    if (typeof board !== 'string' || !BOARD_ID.test(board)) return refuse('bad request', 400)
    const answer = await this.desk(board, '/delete', {})
    const data = await answer.json().catch(() => ({}))
    if (data.error === 'owner') return refuse('owner', 403)
    if (answer.status === 403 || answer.status === 404) {
      await this.loseBoard(board)
      return refuse('gone', 404)
    }
    if (!answer.ok) throw new Error(`desk: ${answer.status}`)
    await this.loseBoard(board)
    return Response.json({ ok: true })
  }

  // --- В сети и приглашения в игру -------------------------------------------------------------------------------
  // Экземпляр 'online': отметка человека id с его друзьями. Отметки живут только в памяти: объект уснул — они пропали и
  // за полминуты соберутся снова. Друг в сети, если отмечался за последние ONLINE_MS и сам числит id в друзьях: дружба
  // взаимная, и тот, кто удалил человека, его больше не видит. hidden — сам не показывается, но других видит; peek —
  // только посмотреть, свою отметку не трогать (страница чата)
  online({ id, hidden, peek, friends }) {
    if (typeof id !== 'string' || !ACCOUNT_ID.test(id) || !Array.isArray(friends) || friends.length > MAX_FRIENDS || !friends.every((other) => typeof other === 'string')) return refuse('bad request', 400)
    const now = Date.now()
    if (now - this.pruned >= ONLINE_MS) {
      for (const [other, mark] of this.seen) if (now - mark.at >= ONLINE_MS) this.seen.delete(other)
      this.pruned = now
    }
    if (peek !== true) {
      if (hidden === true) this.seen.delete(id)
      else this.seen.set(id, { at: now, friends: new Set(friends) })
    }
    const online = friends.filter((other) => {
      const mark = this.seen.get(other)
      return mark && now - mark.at < ONLINE_MS && mark.friends.has(id)
    })
    return Response.json({ online })
  }

  // Приглашения человеку — invites: { от кого: { handle, game, room?, at } }; старше INVITE_MS — забываются
  async invites(now) {
    const all = (await this.ctx.storage.get('invites')) ?? {}
    const live = Object.fromEntries(Object.entries(all).filter(([, invite]) => now - invite.at < INVITE_MS))
    if (Object.keys(live).length < Object.keys(all).length) await this.ctx.storage.put('invites', live)
    return live
  }

  // Кто из друзей в сети — у экземпляра 'online'; fields — hidden или peek. Без друзей его не спрашиваем: показываться
  // некому
  async onlineFriends(friends, fields) {
    if (!friends.length) return []
    const space = this.env.ACCOUNT
    const body = JSON.stringify({ id: await this.myId(), ...fields, friends })
    const answer = await space.get(space.idFromName('online')).fetch(new Request('https://account/online', { method: 'POST', body }))
    if (!answer.ok) throw new Error(`online: ${answer.status}`)
    return (await answer.json()).online ?? []
  }

  // Отметка мода: человек в сети (или прячется). Ответ — кто из друзей в сети, кто из них зовёт в игру, сколько
  // непрочитанных сообщений и заявок в друзья. Без друзей экземпляр 'online' не спрашиваем: показываться некому
  async pulse(text) {
    const now = Date.now()
    this.pulses = this.pulses.filter((at) => now - at < MINUTE)
    if (this.pulses.length >= PULSES_PER_MINUTE) return refuse('often', 429)
    this.pulses.push(now)
    const circle = await this.circle()
    const online = await this.onlineFriends(Object.keys(circle.friends), { hidden: parsed(text).hidden === true })
    const invites = Object.entries(await this.invites(now))
      .filter(([from]) => circle.friends[from])
      .sort((a, b) => b[1].at - a[1].at)
      .map(([from, invite]) => ({ from, ...invite }))
    const requests = Object.keys(circle.incoming).filter((other) => !circle.friends[other]).length
    return Response.json({ online, invites, unread: unreadOf(await this.chats()), requests })
  }

  // Позвать друга в сетевую игру: game — игра каталога, room — код комнаты настольной игры (у Doom лобби общее, кода
  // нет). Нужен свой ник: по нему друг видит, кто зовёт
  async invite(text) {
    const { to, game, room } = parsed(text)
    if (typeof to !== 'string' || !ACCOUNT_ID.test(to) || !gameInvite(game, room)) return refuse('bad request', 400)
    const handle = await this.ctx.storage.get('handle')
    if (!handle) return refuse('nohandle', 409)
    if (!(await this.circle()).friends[to]) return refuse('friend', 403)
    const now = Date.now()
    this.calls = this.calls.filter((at) => now - at < MINUTE)
    if (this.calls.length >= INVITES_PER_MINUTE) return refuse('often', 429)
    this.calls.push(now)
    const answer = await this.person(to, '/invited', { id: await this.myId(), handle, game, ...(room ? { room } : {}) })
    if (answer.status === 403 || answer.status === 404) return refuse('friend', 403)
    if (!answer.ok) throw new Error(`friend: ${answer.status}`)
    return Response.json({ ok: true })
  }

  // Приглашение от друга id: от каждого друга — последнее. Не друг или аккаунта уже нет — отказ, ничего не записываем
  async invited({ id, handle, game, room }) {
    if (!(await this.myId())) return refuse('nobody', 404)
    if (typeof id !== 'string' || !(await this.circle()).friends[id]) return refuse('friend', 403)
    if (typeof handle !== 'string' || !HANDLE.test(handle) || !gameInvite(game, room)) return refuse('bad request', 400)
    const now = Date.now()
    await this.ctx.storage.put('invites', { ...(await this.invites(now)), [id]: { handle, game, ...(room ? { room } : {}), at: now } })
    return Response.json({ ok: true })
  }

  // Ответ на приглашение — принял или «не сейчас»: оно уходит
  async answer(text) {
    const { from } = parsed(text)
    if (typeof from !== 'string' || !ACCOUNT_ID.test(from)) return refuse('bad request', 400)
    const invites = await this.invites(Date.now())
    if (invites[from]) await this.ctx.storage.put('invites', without(invites, from))
    return Response.json({ ok: true })
  }

  // Билет для страницы чата: мод открывает её, не отдавая браузеру ключ сессии. С ключом сессии и { link: true } —
  // код ссылки; по коду ссылки — всегда билет, новый код им не взять
  async issueTicket(who, text) {
    const secret = this.env.LINK_SECRET
    if (!secret) return refuse('off', 503)
    let link = false
    try {
      link = !who.link && JSON.parse(text || '{}')?.link === true
    } catch {
      return refuse('invalid', 400)
    }
    const id = await this.myId()
    let until = Math.floor((Date.now() + (link ? CHAT_LINK_MS : CHAT_TICKET_MS)) / 1000)
    // Два кода за одну секунду вышли бы одинаковыми, а код годится один раз — каждый следующий живёт хоть на секунду дольше
    if (link) {
      until = Math.max(until, ((await this.ctx.storage.get('linkUntil')) ?? 0) + 1)
      await this.ctx.storage.put('linkUntil', until)
    }
    const prefix = who.hash.slice(0, 12)
    const code = `${id}.${until}.${prefix}.${await sign(secret, (link ? linkPayload : chatPayload)(id, until, prefix))}`
    return Response.json(link ? { link: code, until } : { ticket: code, until })
  }

  // Живое соединение страницы чата — только по билету. Открытых больше MAX_SOCKETS — самые старые закрываются
  socket(request, who) {
    if (!who.ticket || request.headers.get('Upgrade') !== 'websocket') return Response.json({ error: 'upgrade' }, { status: 426 })
    const open = this.ctx.getWebSockets()
    for (const ws of open.slice(0, Math.max(0, open.length - MAX_SOCKETS + 1))) {
      try {
        ws.close(4000, 'replaced')
      } catch {
        // уже закрыт
      }
    }
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ prefix: who.hash.slice(0, 12), until: who.ticket })
    return new Response(null, { status: 101, webSocket: client, headers: { 'Sec-WebSocket-Protocol': CHAT_PROTOCOL } })
  }

  // Кадр всем открытым страницам чата. Билет истёк или на том компьютере вышли — соединение закрывается (4001):
  // странице нужен новый билет
  async push(frame) {
    const sockets = this.ctx.getWebSockets?.() ?? []
    if (!sockets.length) return
    const now = Date.now()
    const sessions = (await this.ctx.storage.get('sessions')) ?? []
    const text = JSON.stringify(frame)
    for (const ws of sockets) {
      const { prefix, until } = ws.deserializeAttachment() ?? {}
      try {
        if (until > now && sessions.some((s) => s.hash.startsWith(prefix))) ws.send(text)
        else ws.close(4001, 'auth')
      } catch {
        // уже закрыт
      }
    }
  }

  // Закрыть живые соединения страниц чата: из одной сессии (prefix — начало её хеша) или все
  closeSockets(prefix) {
    for (const ws of this.ctx.getWebSockets?.() ?? []) {
      if (prefix && ws.deserializeAttachment()?.prefix !== prefix) continue
      try {
        ws.close(4001, 'auth')
      } catch {
        // уже закрыт
      }
    }
  }

  // Страница пишет в сокет только 'ping' (обычно на него отвечает сама платформа)
  async webSocketMessage(ws, message) {
    if (message !== 'ping') return
    try {
      ws.send('pong')
    } catch {
      // уже закрыт
    }
  }

  async webSocketClose(ws, code, reason) {
    try {
      ws.close(code, reason)
    } catch {
      // уже закрыт
    }
  }

  async webSocketError() {}
}
