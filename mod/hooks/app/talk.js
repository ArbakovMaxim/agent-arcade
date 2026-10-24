// Arcade: друзья, чаты, уведомления, «в сети» и приглашения.
import { SITE } from '../catalog.js'
import { tr } from '../i18n.js'
import { HANDLE, normalHandle, parseFriends, parseInvite, parsePulse } from '../account.js'
import { MAX_NAME, MAX_TEXT, cleanText, describe, fill, oneLine, parseChat, parseChats, parseLink, parseMessages, parseSent, parseUnread } from '../chats.js'
import { picSvg } from '../avatars.js'
import { avatarXaml, keepPopped, popupChats, popupCommand, restorePopped } from '../popup.js'
import { CHAT_SHOWN, LAUNCH_TIMEOUT_MS, PANE, PANE_ROWS, S } from './state.js'
import { gameById, games } from './library.js'
import { log, paneColumns, windowNotice } from './status.js'
import { markPaneOpen, toLibrary } from './play.js'
import { builtinBrowser, launchNotice, netWhere, openNet, windowCommand } from './window.js'
import { desktopNotice, desktopWindow } from './desktop.js'
import { accountFetch, accountNote, forgetSession, handleNote } from './profile.js'

// --- Друзья: взаимные заявки по точному @нику ----------------------------------------------------------------------

// Почему с друзьями не вышло
function friendsNote(error, handle) {
  if (error === 'invalid') return handleNote('invalid', handle)
  if (error === 'self') return 'Это твой ник.'
  if (error === 'nobody') return `@${handle} не найден — проверь ник.`
  if (error === 'gone') return 'Этой заявки уже нет.'
  if (error === 'nohandle') return 'Сначала возьми свой @ник.'
  if (error === 'full') return 'Друзей и твоих заявок уже слишком много — удали кого-нибудь.'
  if (error === 'busy') return `У @${handle} слишком много заявок — попробуй позже.`
  if (error === 'often') return 'Заявок сегодня слишком много — попробуй завтра.'
  return accountNote(error)
}

// Вопрос к сайту про друзей: список (без body) или действие — заявка, принять, отклонить, отменить, удалить. Пока
// действие ждёт ответа, другие не начинаются. done — заметка, если действие прошло; у заявки она — по ответу сайта
export async function friendsCall($, name, body, handle = '', done = '') {
  const session = S.acct.session
  if (!session || S.fr.busy) return
  const request = ++S.fr.request
  if (body) S.fr.busy = name
  else S.fr.loading = true
  $.ui.invalidate('ui.render')
  const answer = parseFriends(await accountFetch($, name, body ? { method: 'POST', body, token: session.token } : { token: session.token }))
  if (S.acct.session !== session || request !== S.fr.request) return
  S.fr.busy = ''
  S.fr.loading = false
  if (answer.error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (answer.error) {
    S.fr.note = friendsNote(answer.error, handle)
    S.fr.bad = true
  } else {
    S.fr.list = { friends: answer.friends, incoming: answer.incoming, outgoing: answer.outgoing }
    S.acct.friends = answer.friends.length
    S.acct.requests = answer.incoming.length
    // Список без действия: прежняя заметка об успехе остаётся, об ошибке — уходит
    if (body) S.fr.note = answer.status === 'sent' ? `Заявка отправлена: @${handle} увидит её у себя в «Друзьях».` : answer.status === 'friends' ? `Теперь вы с @${handle} друзья.` : done
    else if (S.fr.bad) S.fr.note = ''
    S.fr.bad = false
    // Удалили последнего друга — выбирать больше некого
    if (!answer.friends.length && S.menu === 'friends:remove') {
      S.menuFrom = S.menu
      S.menu = 'friends'
    }
  }
  $.ui.invalidate('ui.render')
}

// «Добавить друга»: заявка по точному @нику. Ник не того вида или свой — сразу здесь, заявку на это не тратим
export async function addFriend($, text) {
  const handle = normalHandle(text)
  if (!handle || S.fr.busy) return
  const problem = !HANDLE.test(handle) ? 'invalid' : handle === S.acct.handle ? 'self' : ''
  if (problem) {
    S.fr.note = friendsNote(problem, handle)
    S.fr.bad = true
    return $.ui.invalidate('ui.render')
  }
  await friendsCall($, 'friends', { handle }, handle)
}

// --- Чаты: с друзьями один на один и в группах ---------------------------------------------------------------------
export const CHAT_POLL_MS = 4_000 // открытый чат: новые сообщения
export const CHATS_POLL_MS = 15_000 // список чатов: новые чаты и непрочитанные
const CHAT_KEPT = 1000 // сколько сообщений открытого чата держим в памяти
export const CHAT_SPLIT = 70 // с такой ширины панели (в знаках) список чатов стоит слева от переписки, как в Telegram
// Цвета чата в Desktop и VS Code — с прозрачностью: годятся и для светлой темы, и для тёмной
export const CHAT_WALL = '#5b8fc714' // фон переписки
export const CHAT_MINE = '#3a78b540' // своё сообщение
export const CHAT_THEIRS = '#80808026' // чужое
export const CHAT_PICKED = '#3a78b533' // открытый чат в списке
export const CHAT_HOVER = '#8080801a' // строка списка под мышью

// Почему с чатами не вышло; group — создавали группу: у групп свой предел на сутки
function chatNote(error, group = false) {
  if (error === 'often' || error === 'limit') return group ? 'Групп сегодня создано слишком много — попробуй завтра.' : 'Слишком часто — подожди минуту.'
  if (error === 'friend') return 'Писать можно только друзьям.'
  if (error === 'gone') return 'Этого чата больше нет.'
  if (error === 'long') return 'Сообщение длиннее 2000 знаков.'
  if (error === 'name') return 'Назови группу.'
  if (error === 'empty') return 'Отметь хотя бы одного друга.'
  if (error === 'nohandle') return 'Сначала возьми свой @ник.'
  if (error === 'full') return 'В группе может быть не больше 50 человек.'
  if (error === 'owner') return 'Это может только тот, кто управляет группой.'
  if (error === 'off') return 'Чаты на сайте сейчас выключены.'
  return accountNote(error)
}

// Кто это в чате: @ник; ника нет — аккаунт удалён
export function chatPerson(id) {
  if (S.ch.names[id]) return `@${S.ch.names[id]}`
  if (id && id === S.ch.me && S.acct.handle) return `@${S.acct.handle}`
  return tr('удалённый аккаунт', S.lang)
}

// Название чата: с другом — его @ник, группы — её название
export const chatTitle = (chat) => (chat.kind === 'dm' ? chatPerson(chat.with) : chat.name || tr('Группа', S.lang))

// Аватарка человека: его картинка из AVATAR_COUNT; не выбрал — первая буква ника на цвете от ника, как на сайте
export function personSvg(id) {
  const handle = S.ch.names[id] || (id && id === S.ch.me ? S.acct.handle : '')
  return picSvg(S.ch.pics[id], handle || '?', handle || id)
}

// Картинка чата: с другом — его аватарка, группы — её картинка или буква названия на цвете от номера чата
export const chatSvg = (chat) => (chat.kind === 'dm' ? personSvg(chat.with) : picSvg(chat.pic, chat.name || tr('Группа', S.lang), chat.id))

// Друг в сети: по отметке «в сети» мода или по списку чатов с сайта
export const isOnline = (id) => S.ol.online.has(id) || S.ch.online.includes(id)

// Таблица аватарок без этих номеров
export const withoutPics = (pics, ids) => Object.fromEntries(Object.entries(pics).filter(([id]) => !ids.includes(id)))

// Аватарки после ответа сайта: за кого он ответил (ники в names и сам человек) — как сказал он, убранная — убрана;
// остальные — как были
const mergePics = (pics, answer) => ({ ...withoutPics(pics, [...Object.keys(answer.names), answer.me]), ...answer.pics })

// Служебное сообщение словами на языке интерфейса: шаблон переводится, ники и название группы — нет
export function serviceText(m) {
  const d = describe(m)
  const named = m.k === 'create' || m.k === 'name'
  return fill(tr(d.text, S.lang), d.values.map((v, k) => (k === 1 && named ? v : chatPerson(v))))
}

// Переписка вместе с новыми сообщениями: без повторов, по порядку номеров
function mergeMessages(old, fresh) {
  const all = new Map(old.map((m) => [m.s, m]))
  for (const m of fresh) all.set(m.s, m)
  return [...all.values()].sort((a, b) => a.s - b.s)
}

// Название группы из поля: одной строкой, не длиннее MAX_NAME
const groupTitle = (text) => [...oneLine(text)].slice(0, MAX_NAME).join('')

// Вопрос к сайту про чаты, ответ разбирает parse; с body — POST. Сайт не принял ключ сессии — забываем вход. Вход
// пропал или сменился, пока ждали, — null: ответ уже не нужен
export async function chatFetch($, name, parse, { body, query } = {}) {
  const session = S.acct.session
  if (!session) return null
  const answer = parse(await accountFetch($, name, { method: body === undefined ? 'GET' : 'POST', body, query, token: session.token }))
  if (S.acct.session !== session) return null
  if (answer.error !== 'auth') return answer
  await forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  return null
}

// Список чатов; quiet — по таймеру: заметку не трогаем и перерисовываем, только если что-то поменялось
export async function loadChats($, quiet = false) {
  if (!S.acct.session || S.ch.loading) return
  S.ch.loading = true
  if (!quiet) $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'chats', parseChats)
  if (!answer) return
  S.ch.loading = false
  if (answer.error) {
    if (quiet) return
    S.ch.note = chatNote(answer.error)
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  const changed = applyChats(answer)
  if (!quiet || changed) $.ui.invalidate('ui.render')
}

// Список чатов с сайта — в мод; true — что-то поменялось
function applyChats(answer) {
  const seen = () => JSON.stringify([S.ch.list, S.ch.names, S.ch.pics, S.ch.online, S.acct.unread])
  const before = seen()
  S.ch.list = answer.chats
  S.ch.names = { ...S.ch.names, ...answer.names }
  S.ch.pics = mergePics(S.ch.pics, answer)
  S.ch.online = answer.online
  S.ch.me = answer.me
  S.acct.unread = answer.unread
  return seen() !== before
}

// Открыть чат: последние сообщения с сайта; сайт заодно отмечает их прочитанными
export async function openChat($, id) {
  if (!S.acct.session) return
  const request = ++S.ch.request
  if (S.menu !== 'chats:talk') {
    S.menuFrom = S.menu
    S.menu = 'chats:talk'
  }
  S.libraryNotice = ''
  // Поле «Сообщение» — новое: недописанное в другом чате сюда не переходит
  Object.assign(S.ch, { talk: id, about: null, messages: [], first: 0, shown: CHAT_SHOWN, opening: true, older: false, note: '', bad: false, confirmLeave: false, field: S.ch.field + 1 })
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'messages', parseMessages, { query: { chat: id } })
  if (!answer || request !== S.ch.request) return
  S.ch.opening = false
  if (answer.error) {
    S.ch.note = chatNote(answer.error)
    S.ch.bad = true
  } else {
    S.ch.me = answer.me
    S.ch.about = answer.chat
    S.ch.messages = answer.messages
    S.ch.first = answer.first
    S.ch.names = { ...S.ch.names, ...answer.names }
    S.ch.pics = mergePics(S.ch.pics, answer)
    S.acct.unread = answer.unread
    const entry = S.ch.list?.find((c) => c.id === id)
    if (entry) entry.unread = 0
    // Чата ещё нет в списке (только что создан) — список с сайта: в широкой панели он виден рядом
    else await loadChats($, true)
  }
  $.ui.invalidate('ui.render')
}

// Новые сообщения открытого чата — по таймеру, пока он на экране. Ошибки молча: спросим ещё раз; только если чата
// больше нет — заметка, и спрашивать перестаём
export async function pollChat($) {
  const id = S.ch.talk
  if (!S.acct.session || S.ch.polling || S.ch.opening || S.ch.about?.id !== id) return
  S.ch.polling = true
  const after = String(S.ch.messages.at(-1)?.s ?? 0)
  const answer = await chatFetch($, 'messages', parseMessages, { query: { chat: id, after } })
  if (!answer) return
  S.ch.polling = false
  if (S.ch.talk !== id || S.ch.about?.id !== id) return
  if (answer.error) {
    if (answer.error !== 'gone') return
    S.ch.about = null
    S.ch.note = chatNote('gone')
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  const seen = () => JSON.stringify([S.ch.about, S.ch.messages.length, S.ch.messages.at(-1)?.s, S.ch.pics, S.acct.unread])
  const before = seen()
  S.ch.messages = mergeMessages(S.ch.messages, answer.messages).slice(-CHAT_KEPT)
  S.ch.about = answer.chat
  S.ch.names = { ...S.ch.names, ...answer.names }
  S.ch.pics = mergePics(S.ch.pics, answer)
  S.acct.unread = answer.unread
  if (seen() !== before) $.ui.invalidate('ui.render')
}

// Есть ли сообщения раньше показанных: уже загруженные или ещё на сайте
export const olderShown = () => S.ch.messages.length > S.ch.shown || (S.ch.messages.length > 0 && S.ch.messages.length < CHAT_KEPT && S.ch.messages[0].s > S.ch.first)

// «Раньше»: показать ещё CHAT_SHOWN сообщений; загруженные кончились — спросить у сайта более ранние
export async function olderMessages($) {
  const id = S.ch.talk
  if (S.ch.messages.length > S.ch.shown) {
    S.ch.shown += CHAT_SHOWN
    return $.ui.invalidate('ui.render')
  }
  if (!S.acct.session || S.ch.older || !olderShown()) return
  S.ch.older = true
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'messages', parseMessages, { query: { chat: id, before: String(S.ch.messages[0].s) } })
  if (!answer) return
  S.ch.older = false
  if (S.ch.talk !== id) return
  if (answer.error) {
    S.ch.note = chatNote(answer.error)
    S.ch.bad = true
  } else {
    S.ch.messages = mergeMessages(answer.messages, S.ch.messages)
    S.ch.names = { ...S.ch.names, ...answer.names }
    S.ch.pics = mergePics(S.ch.pics, answer)
    S.ch.shown += CHAT_SHOWN
  }
  $.ui.invalidate('ui.render')
}

// Отправить сообщение из поля «Сообщение». Ушло — поле новое, пустое, и фокус снова в нём; нет — текст остаётся в поле
export async function sendMessage($, value) {
  const id = S.ch.talk
  const text = cleanText(value).trim()
  if (!text || !S.acct.session || S.ch.busy || S.ch.about?.id !== id) return
  if (text.length > MAX_TEXT) {
    S.ch.note = chatNote('long')
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  S.ch.busy = 'send'
  S.ch.note = ''
  S.ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'send', parseSent, { body: { chat: id, text } })
  if (!answer) return
  S.ch.busy = ''
  if (S.ch.talk !== id) return $.ui.invalidate('ui.render')
  if (answer.error) {
    S.ch.note = chatNote(answer.error)
    S.ch.bad = true
    if (answer.error === 'gone') S.ch.about = null
  } else {
    S.ch.messages = mergeMessages(S.ch.messages, [answer.msg]).slice(-CHAT_KEPT)
    // В списке чатов этот — сразу наверх и с этим сообщением, не дожидаясь таймера
    const entry = S.ch.list?.find((c) => c.id === id)
    if (entry) {
      entry.last = { f: answer.msg.f, t: oneLine(answer.msg.t) }
      entry.at = answer.msg.at
      S.ch.list = [entry, ...S.ch.list.filter((c) => c !== entry)]
    }
    S.ch.field++
    const key = `arcade-chat-input-${S.ch.field}`
    $.clock.after(50, async () => {
      try {
        await $.ui.focus({ requestId: PANE, key })
      } catch {
        // панель уже закрыли или поле не на экране
      }
    })
  }
  $.ui.invalidate('ui.render')
}

// «Написать» другу: чат двоих у пары один, сайт отдаёт его или заводит новый
export async function openDm($, friend) {
  if (!S.acct.session || S.ch.busy) return
  S.ch.busy = 'open'
  S.ch.note = ''
  S.ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'opendm', parseChat, { body: { with: friend } })
  if (!answer) return
  S.ch.busy = ''
  if (answer.error || !answer.chat) {
    S.ch.note = chatNote(answer.error || 'down')
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  await openChat($, answer.chat.id)
}

// «Создать группу» из отмеченных друзей; all — «Группа со всеми друзьями» (без своего названия — «Все друзья»)
export async function createGroup($, all = false) {
  if (!S.acct.session || S.ch.busy) return
  const friends = S.fr.list?.friends ?? []
  const members = [...S.ch.picked].filter((id) => friends.some((p) => p.id === id))
  const name = groupTitle(S.ch.groupName) || (all ? tr('Все друзья', S.lang) : '')
  const problem = all ? (friends.length ? '' : 'nobody') : !members.length ? 'empty' : !name ? 'name' : ''
  if (problem) {
    S.ch.note = problem === 'nobody' ? 'Друзей пока нет — добавь кого-нибудь по @нику.' : chatNote(problem)
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  S.ch.busy = 'group'
  S.ch.note = ''
  S.ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'group', parseChat, { body: all ? { name, all: true } : { name, members } })
  if (!answer) return
  S.ch.busy = ''
  if (answer.error || !answer.chat) {
    S.ch.note = chatNote(answer.error || 'down', true)
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  S.ch.picked = new Set()
  S.ch.groupName = ''
  S.ch.field++
  await openChat($, answer.chat.id)
}

// Участники и название группы: добавить, убрать, переименовать — может хозяин; выйти — любой. done — заметка, если вышло
export async function changeMembers($, body, done = '') {
  const id = S.ch.talk
  if (!S.acct.session || S.ch.busy || S.ch.about?.id !== id) return
  S.ch.busy = 'members'
  S.ch.note = ''
  S.ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'members', parseChat, { body: { chat: id, ...body } })
  if (!answer) return
  S.ch.busy = ''
  if (S.ch.talk !== id) return $.ui.invalidate('ui.render')
  if (answer.error || (!answer.left && !answer.chat)) {
    S.ch.note = chatNote(answer.error || 'down')
    S.ch.bad = true
    if (answer.error === 'gone') S.ch.about = null
  } else if (answer.left) {
    // Вышел — чата у человека больше нет: назад к списку
    Object.assign(S.ch, { talk: '', about: null, messages: [], confirmLeave: false, note: 'Ты больше не в этой группе.', bad: false })
    S.menuFrom = S.menu
    S.menu = 'chats'
    loadChats($, true).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
  } else {
    S.ch.about = answer.chat
    // Название и картинка группы — и в списке чатов: в широкой панели он виден рядом
    const entry = S.ch.list?.find((c) => c.id === answer.chat.id)
    if (entry) Object.assign(entry, { name: answer.chat.name, pic: answer.chat.pic })
    S.ch.note = done
    S.ch.field++
    // Служебное сообщение о перемене — в переписку сразу
    pollChat($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
  }
  $.ui.invalidate('ui.render')
}

// «Переименовать»: то же название — сайт не спрашиваем
export async function renameGroup($, value) {
  const name = groupTitle(value)
  if (!name) {
    S.ch.note = chatNote('name')
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  if (name !== S.ch.about?.name) await changeMembers($, { name }, 'Название группы изменено.')
}

// «Выйти из группы»: первое нажатие спрашивает «точно?», второе — выходит
export async function leaveGroup($) {
  if (!S.ch.confirmLeave) {
    S.ch.confirmLeave = true
    S.ch.note = ''
    return $.ui.invalidate('ui.render')
  }
  S.ch.confirmLeave = false
  await changeMembers($, { leave: true })
}

// Сколько непрочитанных — для плитки «Чаты», если сайт ещё не знает отметки «в сети»
async function checkUnread($) {
  if (!S.acct.handle) return
  const answer = await chatFetch($, 'unread', parseUnread)
  if (!answer || answer.error || answer.unread === S.acct.unread) return
  S.acct.unread = answer.unread
  $.ui.invalidate('ui.render')
}

// --- Всплывающие уведомления о сообщениях ---------------------------------------------------------------------------
// Как у мессенджеров: новое сообщение — карточка внизу слева поверх всех окон, сама прячется; клик — этот чат в панели.
// Сколько непрочитанных спрашиваем и при закрытой панели; список чатов — только когда это число поменялось
export const POPUP_POLL_MS = 20_000
const POPUP_SLOTS = 3 // столько карточек сразу, одна над другой
const POPUP_RUN_MS = 300_000 // карточка прячется сама; это — если PowerShell повис
S.msgNotify = true // всплывающие уведомления о сообщениях — настройка этого компьютера, на сайт не уходит
// session — для какого входа; seen — сколько непрочитанных было в прошлый раз; started — первый список уже видели:
// что пришло до запуска, не всплывает; waiting — карточкам не хватило места, спросить список ещё раз
const noPopups = (session = null) => ({ session, seen: -1, started: false, waiting: false })
S.pop = noPopups()
S.popBusy = false // вопрос к сайту в пути
const popSlots = new Set() // занятые места карточек: 0 — нижнее

// Чат сейчас на экране — о нём не всплываем
const chatOnScreen = (id) => S.paneOpen && S.view === 'library' && S.menu === 'chats:talk' && S.ch.talk === id

// Карточка о чате: с другом — его ник и аватарка; группа — название и картинка, перед текстом — кто написал
function popupFor(chat) {
  const service = chat.last.k !== undefined
  const text = service ? serviceText(chat.last) : chat.last.t
  const windows = S.platform === 'windows'
  if (chat.kind === 'dm') {
    const handle = S.ch.names[chat.with] || ''
    return { title: chatPerson(chat.with), text, pic: windows ? avatarXaml(S.ch.pics[chat.with], handle || '?', handle || chat.with) : '' }
  }
  const title = chatTitle(chat)
  return { title, text: service ? text : `${chatPerson(chat.last.f)}: ${text}`, pic: windows ? avatarXaml(chat.pic, title, chat.id) : '' }
}

// Раз в POPUP_POLL_MS: пришло новое — карточка. В первый раз только запоминаем, что уже есть
export async function watchMessages($) {
  const session = S.acct.session
  if (!S.msgNotify || !session || !S.acct.handle || !S.platform || S.popBusy) return
  if (S.pop.session !== session) S.pop = noPopups(session)
  S.popBusy = true
  try {
    const count = await chatFetch($, 'unread', parseUnread)
    if (!count || count.error || S.pop.session !== session) return
    if (count.unread !== S.acct.unread) {
      S.acct.unread = count.unread
      $.ui.invalidate('ui.render')
    }
    const changed = count.unread !== S.pop.seen
    S.pop.seen = count.unread
    // Непрочитанных нет — всплывать не о чем; столько же, сколько было, — нового нет
    if (count.unread === 0) Object.assign(S.pop, { started: true, waiting: false })
    if (count.unread === 0 || (S.pop.started && !changed && !S.pop.waiting)) return
    const answer = await chatFetch($, 'chats', parseChats)
    if (!answer || answer.error || S.pop.session !== session) return
    if (applyChats(answer)) $.ui.invalidate('ui.render')
    await popChats($, answer)
  } finally {
    S.popBusy = false
  }
}

// Карточки о новых сообщениях. Что всплыло, — сразу в $.store: другая сессия Claude Code о том же не всплывёт.
// Места не хватило — остальные в следующий раз
async function popChats($, answer) {
  const popped = restorePopped(await $.store.get('chatPopups'))
  const first = !S.pop.started
  Object.assign(S.pop, { started: true, waiting: false })
  const show = []
  for (const chat of popupChats(answer.chats, answer.me, popped)) {
    if (!first && !chatOnScreen(chat.id)) {
      const slot = [...Array(POPUP_SLOTS).keys()].find((n) => !popSlots.has(n) && !show.some((s) => s.slot === n))
      if (slot === undefined) {
        S.pop.waiting = true
        continue
      }
      show.push({ chat, slot })
    }
    popped[chat.id] = chat.at
  }
  await $.store.set('chatPopups', keepPopped(popped))
  for (const { chat, slot } of show) showPopup($, chat, slot)
}

// Карточка на своём месте; клик по ней — этот чат в панели. Место освободилось, а кто-то ждёт, — спрашиваем сразу
function showPopup($, chat, slot) {
  const command = popupCommand(S.platform, { ...popupFor(chat), slot })
  if (!command) return
  popSlots.add(slot)
  $.clock.after(0, async () => {
    try {
      const result = await $.process.run(command.argv, { env: command.env, timeoutMs: POPUP_RUN_MS })
      if (result.stdout.includes('open')) await openFromPopup($, chat.id)
    } catch (err) {
      log(`уведомление о сообщении не показалось: ${err?.message ?? err}`)
    } finally {
      popSlots.delete(slot)
      if (S.pop.waiting) watchMessages($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    }
  })
}

// Клик по карточке: панель Arcade на этом чате; «Назад» из него — к списку чатов
async function openFromPopup($, id) {
  if (!S.acct.session) return
  if (S.view !== 'library') toLibrary()
  S.menu = 'chats'
  S.libraryNotice = ''
  markPaneOpen()
  await $.ui.open({ id: PANE, title: 'Arcade', focus: true, closeOnEscape: true, columns: paneColumns(), rows: PANE_ROWS })
  await openChat($, id)
  loadChats($, true).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
}

// --- В сети и приглашения в игру ---------------------------------------------------------------------------------
const PULSE_MS = 30_000 // пока меню открыто: отметка «в сети», кто из друзей в сети и кто зовёт сыграть
export const PULSE_SOON_MS = 5_000 // отметка «при первой возможности» — не чаще этого
export const INVITE_MINUTES = 10 // сколько живёт приглашение на сайте

// Сетевые игры, в которые можно позвать друга: настольные (своя комната на двоих) и Doom (лобби игры на сайте)
export function inviteGames() {
  return games().filter((g) => g.kind === 'board' || g.console === 'doom')
}

// Отметка «в сети», пока меню открыто: заодно кто из друзей в сети, кто зовёт сыграть, непрочитанные и заявки в
// друзья. Сайт без отметки — только непрочитанные, как раньше
export async function pulse($) {
  if (!S.acct.handle || S.ol.pulsing) return
  const now = await $.clock.now()
  // Ещё не отмечались (at — 0) — сразу
  if (S.ol.at && now - S.ol.at < (S.ol.soon ? PULSE_SOON_MS : PULSE_MS)) return
  const state = S.ol
  state.pulsing = true
  state.soon = false
  state.at = now
  let answer = null
  try {
    answer = await chatFetch($, 'pulse', parsePulse, { body: S.hideOnline ? { hidden: true } : {} })
  } finally {
    state.pulsing = false
  }
  if (!answer || state !== S.ol) return
  if (answer.error) return answer.error === 'down' ? checkUnread($) : undefined
  const before = JSON.stringify([[...S.ol.online], S.ol.invites, S.acct.unread, S.acct.requests])
  const requests = S.acct.requests
  S.ol.online = new Set(answer.online)
  S.ol.invites = answer.invites.filter((i) => gameById(i.game) && !S.ol.gone.has(`${i.from}:${i.at}`))
  S.acct.unread = answer.unread
  S.acct.requests = answer.requests
  // Новое приглашение — ещё и тостом, один раз
  for (const i of S.ol.invites) {
    const key = `${i.from}:${i.at}`
    if (S.ol.told.has(key)) continue
    S.ol.told.add(key)
    await $.ui.toast(tr(`@${i.handle} зовёт сыграть: ${gameById(i.game).title}`, S.lang))
  }
  // Пришла или ушла заявка в друзья, пока открыт экран друзей, — список тоже освежаем
  if (S.menu === 'friends' && S.acct.requests !== requests) friendsCall($, 'friends')
  if (JSON.stringify([[...S.ol.online], S.ol.invites, S.acct.unread, S.acct.requests]) !== before) $.ui.invalidate('ui.render')
}

// Отметиться при первой возможности: таймер меню проверяет это каждые PULSE_SOON_MS
export function pulseSoon($) {
  S.ol.soon = true
  pulse($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
}

// Почему друга не позвали
function inviteNote(error, handle) {
  if (error === 'friend') return `@${handle} больше не в друзьях.`
  if (error === 'nohandle') return 'Сначала возьми свой @ник.'
  if (error === 'often' || error === 'limit') return 'Слишком часто — подожди минуту.'
  return accountNote(error)
}

// Позвать друга сыграть и открыть игру у себя: настольную — в новой комнате на двоих, Doom — в лобби игры
export async function inviteFriend($, surface, friend, id) {
  const g = gameById(id)
  if (!S.acct.session || S.ol.busy || !g) return
  const room = g.kind === 'board' ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : ''
  const state = S.ol
  state.busy = id
  state.note = ''
  state.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'invite', parseInvite, { body: { to: friend.id, game: id, ...(room ? { room } : {}) } })
  if (state !== S.ol) return
  S.ol.busy = ''
  if (!answer || answer.error) {
    if (answer) {
      S.ol.note = inviteNote(answer.error, friend.handle)
      S.ol.bad = true
    }
    return $.ui.invalidate('ui.render')
  }
  S.ol.note = `Приглашение для @${friend.handle} отправлено: ${g.title}. Оно действует ${INVITE_MINUTES} минут.`
  S.ol.to = null
  S.menuFrom = S.menu
  S.menu = 'friends'
  await openNet($, surface, netWhere(id, room))
}

// Ответ на приглашение: «Принять» — открыть игру друга (настольную — в его комнате), «Не сейчас» — просто убрать.
// Сайт забывает приглашение в обоих случаях
export async function answerInvite($, surface, invite, accept) {
  S.ol.gone.add(`${invite.from}:${invite.at}`)
  S.ol.invites = S.ol.invites.filter((i) => i !== invite)
  $.ui.invalidate('ui.render')
  chatFetch($, 'answer', parseInvite, { body: { from: invite.from } }).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
  if (accept) await openNet($, surface, netWhere(invite.game, invite.room))
}

// «Открыть на странице»: страница чатов на сайте — во встроенном браузере Claude или в окне браузера. Ключ сессии
// туда не идёт: сайт выдаёт код ссылки на 10 минут и на один раз, страница обменяет его на свой билет
export async function openChatPage($, surface) {
  const page = `${SITE}/chat`
  const builtin = builtinBrowser(surface)
  // Страницу чатов Claude уже открывает по просьбе Arcade или она ждёт конца шага: второй раз ход не прерываем
  const waiting = [S.asking, S.pendingOpen].find((url) => String(url ?? '').startsWith(page))
  if (builtin && waiting) return desktopNotice($, S.asking === waiting ? 'asking' : S.compacting ? 'compacting' : 'waiting', '', waiting)
  if (!S.acct.session || S.ch.busy) return
  S.ch.busy = 'page'
  S.ch.note = ''
  S.ch.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'chatticket', parseLink, { body: { link: true } })
  if (!answer) return
  S.ch.busy = ''
  if (answer.error) {
    S.ch.note = chatNote(answer.error)
    S.ch.bad = true
    return $.ui.invalidate('ui.render')
  }
  S.chatLink = answer.link
  if (builtin) return desktopWindow($, 'chat', 'Чаты открыты во встроенном браузере Claude.')
  if (!S.platform) {
    S.libraryNotice = 'Окно браузера пока не открыть — попробуй через пару секунд.'
    return $.ui.invalidate('ui.render')
  }
  S.libraryNotice = 'Открываю окно…'
  $.ui.invalidate('ui.render')
  const command = windowCommand('chat')
  try {
    const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
    windowNotice($, launchNotice(result, 'chat'))
    if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
  } catch (err) {
    S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
  }
  $.ui.invalidate('ui.render')
}
