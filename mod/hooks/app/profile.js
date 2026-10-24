// Arcade: аккаунт, ник, аватарка, синхронизация настроек, отчёты, выход и удаление.
import { openUrlCommand } from '../browsers.js'
import { LANGS } from '../i18n.js'
import { restoreMyTopics } from '../search.js'
import { restoreTwitch } from '../twitch.js'
import { HANDLE, accountUrl, normalHandle, parseAvatar, parseDone, parseHandle, parseMe, parsePoll, parseSettings, parseStart, syncPlan } from '../account.js'
import { validPic } from '../avatars.js'
import { restoreFavorites, toggleIn } from '../find.js'
import { MAX_REPORT, parseClosed, parseReportSent, parseReports, reportBody, versionFrom } from '../reports.js'
import { FAV_LIMIT, HIDEABLE, LAUNCH_TIMEOUT_MS, NO_CHATS, NO_DESKS, NO_FRIENDS, NO_REPORTS, S, SECTIONS, SIGNAL_MODES, noOnline, restoreKeymap, savedKeys } from './state.js'
import { log, windowNotice } from './status.js'
import { fetchWithin } from './watch.js'
import { withoutPics } from './talk.js'

// --- Аккаунт: вход через GitHub и настройки на всех компьютерах ------------------------------------------------------
const ACCOUNT_FETCH_MS = 15_000 // сайту самому надо спросить GitHub
const SYNC_DELAY_MS = 2_000 // настройку поменяли — на сайт через пару секунд: вдруг человек меняет ещё
export const SYNC_EVERY_MS = 30 * 60_000 // и раз в полчаса — забрать то, что поменяли на другом компьютере

// Почему вход или синхронизация не удались
export function accountNote(error) {
  if (error === 'off') return 'Вход на сайте Arcade ещё не настроен.'
  if (error === 'app') return 'GitHub не принял приложение Arcade — вход пока не работает.'
  if (error === 'limit') return 'Попыток входа с этого адреса на сегодня слишком много — попробуй завтра.'
  if (error === 'big') return 'Настройки не поместились на сайте Arcade.'
  return 'Сайт Arcade не ответил. Попробуй чуть позже.'
}

// Почему ник не взялся
export function handleNote(error, handle) {
  if (error === 'invalid') return 'Ник — от 4 до 32 знаков: латинские буквы, цифры и _, первый — буква.'
  if (error === 'reserved') return 'Такой ник взять нельзя — выбери другой.'
  if (error === 'taken') return `@${handle} уже занят — выбери другой.`
  if (error === 'often') return 'Ник сегодня меняли слишком часто — попробуй завтра.'
  return accountNote(error)
}

// Вопрос к сайту про вход, настройки, друзей и чаты; query — параметры адреса. Ключ сессии — только в заголовке и
// только своему сайту
export function accountFetch($, name, { method = 'GET', body, token, query } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const url = query ? `${accountUrl(name)}?${new URLSearchParams(query)}` : accountUrl(name)
  return fetchWithin($, url, ACCOUNT_FETCH_MS, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
}

// Настройка из $.store или с сайта → в мод. Не подходит — false, остаётся прежняя
export function applySetting(key, value) {
  if (key === 'lang') {
    if (!LANGS.includes(value)) return false
    S.lang = value
  } else if (key === 'keys') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const fine = (list) => Array.isArray(list) && list.length <= 64 && list.every((k) => typeof k === 'string' && k.length <= 30)
    S.keymap = restoreKeymap(Object.fromEntries(Object.entries(value).filter(([, list]) => fine(list))))
  } else if (key === 'notify' || key === 'wide' || key === 'keepMenu' || key === 'backOnDone' || key === 'hideOnline') {
    if (typeof value !== 'boolean') return false
    if (key === 'notify') S.osNotify = value
    else if (key === 'wide') S.wide = value
    else if (key === 'keepMenu') S.keepMenu = value
    else if (key === 'hideOnline') S.hideOnline = value
    else S.backOnDone = value
  } else if (key === 'onDone' || key === 'onPermission') {
    if (!SIGNAL_MODES.includes(value)) return false
    if (key === 'onDone') S.onDone = value
    else S.onPermission = value
  } else if (key === 'myTopics') {
    if (!Array.isArray(value)) return false
    S.myTopics = restoreMyTopics(value)
  } else if (key === 'twitchChannels') {
    if (!Array.isArray(value)) return false
    S.tw.channels = restoreTwitch(value)
  } else if (key === 'flappyBest') {
    const best = Math.floor(Number(value))
    if (!Number.isFinite(best) || best < 0) return false
    S.flappyBest = Math.max(S.flappyBest, best)
  } else if (key === 'collapsed') {
    if (!Array.isArray(value)) return false
    S.collapsed = SECTIONS.filter((id) => value.includes(id))
  } else if (key === 'hidden') {
    if (!Array.isArray(value)) return false
    S.hidden = HIDEABLE.filter((id) => value.includes(id))
  } else if (key === 'favorites') {
    const list = restoreFavorites(value, FAV_LIMIT)
    if (!list) return false
    S.favorites = list
  } else return false
  return true
}

// Настройка из SYNC_KEYS, как она сейчас в моде
function settingValue(key) {
  return { lang: S.lang, keys: S.keymap, notify: S.osNotify, wide: S.wide, keepMenu: S.keepMenu, backOnDone: S.backOnDone, onDone: S.onDone, onPermission: S.onPermission, myTopics: S.myTopics, twitchChannels: S.tw.channels, flappyBest: S.flappyBest, collapsed: S.collapsed, hidden: S.hidden, favorites: S.favorites, hideOnline: S.hideOnline }[key]
}

// Сохранить настройку из SYNC_KEYS: в $.store, с отметкой времени, и — если вошли — через пару секунд на сайт
export async function saveSetting($, key, value) {
  const at = await $.clock.now()
  savedKeys.add(key)
  S.stamps = { ...S.stamps, [key]: at }
  await $.store.set(key, value)
  await $.store.set('syncAt', S.stamps)
  if (S.acct.session) scheduleSync($, SYNC_DELAY_MS)
}

// Свернуть или развернуть раздел главного меню
export async function toggleSection($, id) {
  S.collapsed = S.collapsed.includes(id) ? S.collapsed.filter((x) => x !== id) : SECTIONS.filter((x) => x === id || S.collapsed.includes(x))
  $.ui.invalidate('ui.render')
  await saveSetting($, 'collapsed', S.collapsed)
}

// Убрать раздел из главного меню совсем или вернуть его — из настроек
export async function toggleHidden($, id) {
  S.hidden = S.hidden.includes(id) ? S.hidden.filter((x) => x !== id) : HIDEABLE.filter((x) => x === id || S.hidden.includes(x))
  $.ui.invalidate('ui.render')
  await saveSetting($, 'hidden', S.hidden)
}

// «Готово» на приветствии: дальше — главное меню с выбранными разделами
export async function finishWelcome($) {
  S.welcomed = true
  S.menuFrom = null
  $.ui.invalidate('ui.render')
  await $.store.set('welcomed', true)
}

// Отметить игру, книгу или аудиокнигу звёздочкой — или снять отметку
export async function toggleFavorite($, id) {
  const { list, added } = toggleIn(S.favorites, id, FAV_LIMIT)
  if (added === null) {
    S.libraryNotice = `В избранном уже ${FAV_LIMIT} — сними звёздочку с чего-нибудь.`
    $.ui.invalidate('ui.render')
    return
  }
  S.favorites = list
  $.ui.invalidate('ui.render')
  await saveSetting($, 'favorites', S.favorites)
}

function scheduleSync($, ms) {
  S.syncTimer?.cancel()
  S.syncTimer = $.clock.after(ms, () => {
    S.syncTimer = null
    syncAccount($)
  })
}

// Встреча настроек этого компьютера и сайта: новое оттуда — сюда, новое отсюда — туда
export async function syncAccount($) {
  const session = S.acct.session
  if (!session) return
  if (S.acct.syncing) {
    S.acct.again = true
    return
  }
  S.acct.syncing = true
  S.acct.again = false
  $.ui.invalidate('ui.render')
  try {
    const claims = S.acct.claims
    const picks = S.acct.picks
    const me = parseMe(await accountFetch($, 'me', { token: session.token }))
    if (S.acct.session !== session) return
    if (me.error) return await syncFailed($, me.error)
    if (S.acct.claims === claims) {
      S.acct.handle = me.handle
      S.acct.ticket = me.ticket
    }
    if (S.acct.picks === picks) S.acct.pic = me.pic
    S.acct.friends = me.friends
    S.acct.requests = me.requests
    S.acct.unread = me.unread
    S.acct.role = me.role
    const now = await $.clock.now()
    if (S.acct.session !== session) return
    const renamed = me.user.id === session.user.id && JSON.stringify(me.user) !== JSON.stringify(session.user)
    if (renamed) session.user = me.user
    const local = Object.fromEntries([...savedKeys].map((key) => [key, settingValue(key)]))
    const plan = syncPlan(local, S.stamps, me.settings, now)
    const changed = []
    for (const [key, value] of Object.entries(plan.apply)) {
      if (applySetting(key, value)) {
        savedKeys.add(key)
        changed.push(key)
      } else if (savedKeys.has(key)) {
        // С сайта пришло то, чего мод не понимает: остаётся своё — и уходит на сайт поверх
        plan.stamps[key] = Math.max(now, me.settings[key].at + 1)
        plan.push[key] = { v: settingValue(key), at: plan.stamps[key] }
      }
    }
    S.stamps = plan.stamps
    if (changed.length) $.ui.invalidate('ui.render')
    if (renamed) await $.store.set('account', session)
    for (const key of changed) await $.store.set(key, settingValue(key))
    await $.store.set('syncAt', S.stamps)
    if (Object.keys(plan.push).length) {
      const sent = parseSettings(await accountFetch($, 'settings', { method: 'PUT', body: { settings: plan.push }, token: session.token }))
      if (S.acct.session !== session) return
      if (sent.error) return await syncFailed($, sent.error)
    }
    S.acct.syncedAt = now
    S.acct.note = ''
  } catch (err) {
    log(`настройки не синхронизированы: ${String(err?.message ?? err).slice(0, 200)}`)
  } finally {
    S.acct.syncing = false
    $.ui.invalidate('ui.render')
    if (S.acct.again) syncAccount($)
  }
}

async function syncFailed($, error) {
  log(`аккаунт: ${error}`)
  if (error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  S.acct.note = accountNote(error)
}

// Забыть вход на этом компьютере. Настройки остаются как есть
export async function forgetSession($, note) {
  S.acct.session = null
  S.acct.flow = null
  S.acct.starting = false
  S.acct.note = note
  S.acct.syncedAt = 0
  S.acct.confirmDelete = false
  S.acct.handle = ''
  S.acct.ticket = ''
  S.acct.naming = false
  S.acct.handleNote = ''
  S.acct.pic = null
  S.acct.picking = false
  S.acct.picNote = ''
  S.acct.friends = 0
  S.acct.requests = 0
  S.acct.unread = 0
  S.acct.role = ''
  S.acct.request++
  S.fr = { ...NO_FRIENDS, request: S.fr.request + 1 }
  S.ol = noOnline()
  S.ch = { ...NO_CHATS, picked: new Set(), request: S.ch.request + 1 }
  S.rp = { ...S.rp, ...NO_REPORTS, request: S.rp.request + 1 }
  S.dk = { ...NO_DESKS, picked: new Set(), syncing: new Set(), again: new Set() }
  S.pushTimer?.cancel()
  S.pushTimer = null
  S.chatLink = ''
  S.syncTimer?.cancel()
  S.syncTimer = null
  $.ui.invalidate('ui.render')
  try {
    await $.store.delete('account')
  } catch (err) {
    log(`вход не забыт: ${String(err?.message ?? err).slice(0, 200)}`)
  }
}

// «Войти через GitHub»: сайт просит у GitHub код, человек вводит его на странице GitHub
export async function startLogin($) {
  if (S.acct.starting || S.acct.flow || S.acct.session) return
  const request = ++S.acct.request
  S.acct.starting = true
  S.acct.note = ''
  $.ui.invalidate('ui.render')
  const start = parseStart(await accountFetch($, 'start', { method: 'POST' }))
  const now = await $.clock.now()
  if (request !== S.acct.request) return
  S.acct.starting = false
  if (start.error) S.acct.note = accountNote(start.error)
  else {
    S.acct.flow = { device: start.device, code: start.code, url: start.url, interval: start.interval, until: now + start.expires * 1000 }
    waitLogin($, request, now)
  }
  $.ui.invalidate('ui.render')
}

// Спрашивать сайт, вошёл ли человек, — раз в interval секунд, пока код жив; истечёт раньше — сказать сразу
function waitLogin($, request, now) {
  const flow = S.acct.flow
  const current = () => request === S.acct.request && S.acct.flow === flow
  const end = (note) => {
    S.acct.flow = null
    S.acct.note = note
    $.ui.invalidate('ui.render')
  }
  $.clock.after(Math.min(flow.interval * 1000, Math.max(flow.until - now, 0) + 1), async () => {
    if (!current()) return
    if ((await $.clock.now()) > flow.until) return end('Код истёк — попробуй ещё раз.')
    const poll = parsePoll(await accountFetch($, 'poll', { method: 'POST', body: { device: flow.device } }))
    if (!current()) return
    if (poll.status === 'ok') return finishLogin($, poll.account)
    if (poll.status === 'expired') return end('Код истёк — попробуй ещё раз.')
    if (poll.status === 'denied') return end('Вход отменён на GitHub.')
    if (['off', 'app', 'limit'].includes(poll.error)) return end(accountNote(poll.error))
    // Ждём дальше; сайт не ответил — тоже ждём, но говорим об этом
    if (poll.interval) flow.interval = poll.interval
    const note = poll.error ? accountNote(poll.error) : ''
    if (note !== S.acct.note) {
      S.acct.note = note
      $.ui.invalidate('ui.render')
    }
    waitLogin($, request, await $.clock.now())
  })
}

async function finishLogin($, account) {
  S.acct.flow = null
  S.acct.note = ''
  S.acct.session = account
  $.ui.invalidate('ui.render')
  try {
    await $.store.set('account', account)
  } catch (err) {
    log(`вход не сохранён: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  syncAccount($)
}

export function cancelLogin($) {
  S.acct.request++
  S.acct.flow = null
  S.acct.starting = false
  S.acct.note = ''
  $.ui.invalidate('ui.render')
}

// «Взять @ник» или свой ник из поля: сайт проверяет, свободен ли он, и отдаёт подпись ника для сетевых игр
export async function claimHandle($, text) {
  const session = S.acct.session
  if (!session || S.acct.naming) return
  const handle = normalHandle(text)
  if (handle === S.acct.handle) return
  if (!HANDLE.test(handle)) {
    S.acct.handleNote = handleNote('invalid', handle)
    return $.ui.invalidate('ui.render')
  }
  S.acct.naming = true
  S.acct.handleNote = ''
  $.ui.invalidate('ui.render')
  const answer = parseHandle(await accountFetch($, 'handle', { method: 'PUT', body: { handle }, token: session.token }))
  if (S.acct.session !== session) return
  S.acct.naming = false
  if (answer.error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (answer.error) S.acct.handleNote = handleNote(answer.error, handle)
  else {
    S.acct.claims++
    S.acct.handle = answer.handle
    S.acct.ticket = answer.ticket
  }
  $.ui.invalidate('ui.render')
}

// Аватарка — одна из AVATAR_COUNT картинок (n — номер, null — без неё, буква ника). Выбирается только здесь, в
// аккаунте; чаты её просто показывают
export async function pickAvatar($, n) {
  const session = S.acct.session
  if (!session || S.acct.picking || n === S.acct.pic) return
  S.acct.picking = true
  S.acct.picNote = ''
  $.ui.invalidate('ui.render')
  const answer = parseAvatar(await accountFetch($, 'avatar', { method: 'PUT', body: { pic: n }, token: session.token }))
  if (S.acct.session !== session) return
  S.acct.picking = false
  if (answer.error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (answer.error) S.acct.picNote = answer.error === 'often' || answer.error === 'limit' ? 'Аватарку меняли слишком часто — подожди минуту.' : accountNote(answer.error)
  else {
    S.acct.picks++
    S.acct.pic = answer.pic
    // В открытых чатах своя аватарка — сразу новая
    if (S.ch.me) S.ch.pics = { ...withoutPics(S.ch.pics, [S.ch.me]), ...(validPic(answer.pic) ? { [S.ch.me]: answer.pic } : {}) }
  }
  $.ui.invalidate('ui.render')
}

// --- Отчёты об ошибках: отправить может каждый, список и «Закрыть» — только админ ------------------------------------

// Почему отчёт не ушёл или список не загрузился
export function reportNote(error) {
  if (error === 'empty') return 'Напиши, что сломалось.'
  if (error === 'long') return 'Отчёт длиннее 2000 знаков — сократи его.'
  if (error === 'often') return 'Отчётов от тебя сегодня уже много — попробуй завтра.'
  if (error === 'full') return 'Сегодня отчётов пришло слишком много — попробуй завтра.'
  if (error === 'off') return 'Отчёты на сайте сейчас выключены.'
  if (error === 'admin') return 'Список отчётов — только у автора Arcade.'
  if (error === 'gone') return 'Этот отчёт уже закрыт.'
  return accountNote(error)
}

// Версия мода — из его plugin.json, один раз
async function arcadeVersion($) {
  if (S.modVersion === null) S.modVersion = versionFrom(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`).catch(() => ''))
  return S.modVersion
}

// «Отправить»: со входом — подписан аккаунтом, без входа — без подписи. К тексту — версия Arcade, где он открыт
// (surface), язык и система; больше ничего. Пустой или слишком длинный — сразу здесь, на сайт не уходит
export async function sendReport($, text, surface) {
  if (S.rp.sending) return
  const body = reportBody(text, { version: await arcadeVersion($), surface, lang: S.lang, os: S.platform })
  const problem = !body.text ? 'empty' : body.text.length > MAX_REPORT ? 'long' : ''
  if (problem) {
    S.rp.note = reportNote(problem)
    S.rp.bad = true
    return $.ui.invalidate('ui.render')
  }
  const session = S.acct.session
  S.rp.sending = true
  S.rp.note = ''
  $.ui.invalidate('ui.render')
  const answer = parseReportSent(await accountFetch($, session ? 'myReport' : 'report', { method: 'POST', body, ...(session ? { token: session.token } : {}) }))
  S.rp.sending = false
  if (answer.error === 'auth' && session) {
    if (S.acct.session === session) await forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
    S.rp.note = 'Отчёт не ушёл — отправь его ещё раз: теперь он уйдёт без подписи.'
    S.rp.bad = true
  } else if (answer.error) {
    S.rp.note = reportNote(answer.error)
    S.rp.bad = true
  } else {
    // Отправлен — поле новое, пустое
    S.rp.field++
    S.rp.note = 'Спасибо! Отчёт отправлен.'
    S.rp.bad = false
  }
  $.ui.invalidate('ui.render')
}

// Список открытых отчётов — у админа. Сайт сказал, что ты больше не админ, — плитка пропадает
export async function loadReports($) {
  const session = S.acct.session
  if (!session || S.acct.role !== 'admin' || S.rp.loading || S.rp.busy) return
  const request = ++S.rp.request
  S.rp.loading = true
  $.ui.invalidate('ui.render')
  const answer = parseReports(await accountFetch($, 'reports', { token: session.token }))
  if (S.acct.session !== session || request !== S.rp.request) return
  S.rp.loading = false
  if (answer.error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (answer.error === 'admin') S.acct.role = ''
  if (answer.error) {
    S.rp.listNote = reportNote(answer.error)
    S.rp.listBad = true
  } else {
    S.rp.list = answer.reports
    S.rp.open = answer.open
    if (S.rp.listBad) S.rp.listNote = ''
    S.rp.listBad = false
  }
  $.ui.invalidate('ui.render')
}

// «Закрыть»: отчёт разобран — сайт удаляет его. Уже закрытый (с другого компьютера) — тоже уходит из списка
export async function closeReport($, id) {
  const session = S.acct.session
  if (!session || S.rp.loading || S.rp.busy) return
  const request = ++S.rp.request
  S.rp.busy = id
  $.ui.invalidate('ui.render')
  const answer = parseClosed(await accountFetch($, 'closeReport', { method: 'POST', body: { id }, token: session.token }))
  if (S.acct.session !== session || request !== S.rp.request) return
  S.rp.busy = 0
  if (answer.error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (answer.error === 'admin') S.acct.role = ''
  if (answer.error && answer.error !== 'gone') {
    S.rp.listNote = reportNote(answer.error)
    S.rp.listBad = true
  } else {
    S.rp.list = (S.rp.list ?? []).filter((r) => r.id !== id)
    S.rp.open = answer.error ? Math.max(S.rp.list.length, S.rp.open - 1) : answer.open
    S.rp.listNote = answer.error ? reportNote('gone') : 'Отчёт закрыт.'
    S.rp.listBad = false
  }
  $.ui.invalidate('ui.render')
}

// «Выйти»: забыть вход здесь и сказать сайту, что ключ сессии больше не нужен; что ответит сайт, неважно
export async function logout($) {
  const token = S.acct.session?.token
  if (!token) return
  await forgetSession($, 'Выход выполнен: на этом компьютере настройки больше не синхронизируются.')
  await accountFetch($, 'logout', { method: 'POST', token })
}

// «Удалить аккаунт»: первое нажатие спрашивает «точно?», второе — просит сайт забыть человека и его настройки
export async function deleteAccount($) {
  const session = S.acct.session
  if (!session) return
  if (!S.acct.confirmDelete) {
    S.acct.confirmDelete = true
    S.acct.note = ''
    return $.ui.invalidate('ui.render')
  }
  S.acct.confirmDelete = false
  S.acct.note = 'Удаляю аккаунт…'
  $.ui.invalidate('ui.render')
  const error = parseDone(await accountFetch($, 'me', { method: 'DELETE', token: session.token }))
  if (S.acct.session !== session) return
  if (error === 'auth') return forgetSession($, 'Вход на этом компьютере больше не действует — войди через GitHub заново.')
  if (!error) return forgetSession($, 'Аккаунт удалён: сайт Arcade забыл тебя и твои настройки. Здесь настройки остались.')
  S.acct.note = accountNote(error)
  $.ui.invalidate('ui.render')
}

// Страница GitHub для кода — в обычном браузере: встроенный браузер Desktop открывает только страницы сайта Arcade
export async function openGithub($, url) {
  const command = openUrlCommand(S.platform, url)
  let opened = false
  if (command) {
    try {
      opened = (await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS }))?.exitCode === 0
    } catch {
      // не открылся — адрес и так написан в меню
    }
  }
  if (opened) windowNotice($, 'Открываю GitHub в браузере — введи там код.')
  else S.libraryNotice = 'Браузер не открылся — открой адрес выше сам.'
  $.ui.invalidate('ui.render')
}
