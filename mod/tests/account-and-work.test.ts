// Тесты Arcade, вторая половина: аккаунт, друзья, чаты, меню и отчёты, блокнот, доски, календарь, агенты, итоги дня
import { expect } from 'claude-code/testing'
import { SITE } from '../hooks/catalog.js'
import { tr } from '../hooks/i18n.js'
import { CHAT_ID, MAX_MEMBERS, MAX_NAME, MAX_TEXT, chatFailure, cleanText, clock as chatClock, day, describe, fill, oneLine, parseChat, parseChats, parseLink, parseMessages, parseSent, parseUnread, picsFrom, when } from '../hooks/chats.js'
import { AVATAR_COUNT, avatarName, avatarSvg, initial, letterColor, letterSvg, picSvg, validPic } from '../hooks/avatars.js'
import { POPPED_KEPT, POPUP_SCRIPT_TEXT, POPUP_TEXT_MAX, POPUP_TITLE_MAX, avatarXaml, keepPopped, letterXaml, popupChats, popupCommand, restorePopped, svgToXaml } from '../hooks/popup.js'
import { FIND_LIMIT, MIN_QUERY, find, fold, queryWords, rank, restoreFavorites, toggleIn } from '../hooks/find.js'
import { MAX_REPORT, parseClosed, parseReportSent, parseReports, reportBody, versionFrom } from '../hooks/reports.js'
import { HANDLE, ROOM, SYNC_KEYS, accountUrl, normalHandle, parseDone, parseFriends, parseHandle, parseAvatar, parseInvite, parseMe, parsePoll, parsePulse, parseSettings, parseStart, parseWeb, personFrom, restoreAccount, restoreStamps, suggestHandle, syncPlan } from '../hooks/account.js'
import { COL_NAMES, DEFAULT_COLS, MAX_APP, MAX_BODY, MAX_PAGES, MAX_TOTAL, MAX_URL, addColumn, addPage, appendText, applyNotesTool, checkStats, cleanCols, cleanLink, columnCards, columnOf, findPage, fits, isBoard, issueUrl, latestEdits, mergeText, moveCard, noteLines, notesOrder, rebaseNotes, removeColumn, removePage, renameColumn, restoreNotes, toggleLine, updateCard, updatePage } from '../hooks/notes.js'
import { addDays, addEvent, addMonths, applyCalendarTool, between, cardDues, cleanDay, cleanTime, dayKey, dueReminders, markAlerted, monthGrid, nextReminder, parseRemind, quickParse, remindAt, restoreCalendar, updateEvent, weekday } from '../hooks/calendar.js'
import { nextRemind, remindChoices } from '../hooks/app/calendar.js'
import { BOARD_ID, MAX_MEMBERS as DESK_MEMBERS, MAX_OWNED, adoptBoard, applySync, boardFailure, cardId, colId, detachBoard, freshBase, parseBoard, parseBoardDone, parseBoards, planSync, restoreDesks } from '../hooks/desks.js'
import { BOARD_POLL_MS, NOTES_CHECK_MS, NOTES_POLL_MS } from '../hooks/app/work.js'
import { AGENT_READ_MS, AGENT_TICK_MS, CLAIM_MS, claimCard } from '../hooks/app/agents.js'
import { ANSWER_POLL_MS, asksReset, checkObserved, toolDecided } from '../hooks/app/asks.js'
import { S } from '../hooks/app/state.js'
import { LOG_DAYS, LOG_MAX, addLog, chatText, daySummary, noteChanges, restoreLog, summaryBody } from '../hooks/daylog.js'
import { PANE, WINDOWS, siteCatalog, stubs, start, HEAVY, go, drawnTexts, labels, test, BASH_MS } from './kit.ts'

// --- Аккаунт: вход через GitHub и настройки на всех компьютерах ---

const TOKEN = `583231.${'a'.repeat(43)}`
const OCTO = { id: '583231', login: 'octocat' }
const STARTED = { device: 'dev_code_1234', code: 'WDJB-MJHT', url: 'https://github.com/login/device', interval: 5, expires: 900 }
// Вход кнопкой: адрес страницы входа GitHub, номер входа и ключ к нему, код для сверки со страницей сайта
const WEB_STARTED = {
  url: `https://github.com/login/oauth/authorize?client_id=Ov23lihBdf0vldzRqVhv&redirect_uri=https%3A%2F%2Fagent-arcade.fefaodessa.workers.dev%2Fapi%2Fauth%2Fcallback&scope=&state=${'S'.repeat(43)}`,
  state: 'S'.repeat(43),
  key: 'K'.repeat(43),
  mark: 'AB2C',
  interval: 3,
  expires: 600,
}

// Сайт Arcade с аккаунтом: хранит настройки и сливает в них PUT. answers — свои ответы по «МЕТОД путь»: ответ или
// функция запроса; undefined — ответ по умолчанию
function accountSite(settings: Record<string, any> = {}, answers: Record<string, any> = {}) {
  const remote: Record<string, any> = { ...settings }
  const api = (path: string, request: any) => {
    const special = answers[`${request.method} ${path}`]
    const own = typeof special === 'function' ? special(request) : special
    if (own !== undefined) return own
    // Вход кнопкой по умолчанию выключен, как на сайте без секрета приложения, — мод входит по коду
    if (path === 'api/auth/web') return { status: 503, json: { error: 'off' } }
    if (path === 'api/auth/web/poll') return { json: { status: 'pending' } }
    if (path === 'api/auth/start') return { json: STARTED }
    if (path === 'api/auth/poll') return { json: { status: 'pending' } }
    if (path === 'api/auth/logout' || (path === 'api/me' && request.method === 'DELETE')) return { json: { ok: true } }
    if (path === 'api/me') return { json: { user: OCTO, settings: remote } }
    if (path === 'api/me/settings') {
      Object.assign(remote, request.body.settings)
      return { json: { settings: remote } }
    }
    return undefined
  }
  return { api, remote }
}
const sent = (requests: any[], path: string, method: string) => requests.filter((r) => r.path === path && r.method === method)

test('account.js: ответы сайта про вход и настройки, вход из хранилища, встреча настроек', () => {
  const reply = (status: number, data: any) => ({ status, ok: status < 400, headers: {}, text: typeof data === 'string' ? data : JSON.stringify(data) })
  const user = { ...OCTO, avatar: 'https://avatars.githubusercontent.com/u/583231?v=4' }
  expect(accountUrl('start')).toBe(`${SITE}/api/auth/start`)
  expect(accountUrl('settings')).toBe(`${SITE}/api/me/settings`)
  // Вход из хранилища: ключ сессии начинается с номера того же профиля; картинка — только с avatars.githubusercontent.com
  expect(restoreAccount({ token: TOKEN, user })).toEqual({ token: TOKEN, user })
  expect(restoreAccount({ token: TOKEN, user: { ...user, id: '1' } })).toBeNull()
  expect(restoreAccount({ token: '583231.short', user })).toBeNull()
  expect(restoreAccount({ token: TOKEN, user: { ...user, login: 'bad name' } })).toBeNull()
  expect(restoreAccount({ token: TOKEN, user: { ...user, avatar: 'https://evil.example/a.png' } })).toEqual({ token: TOKEN, user: OCTO })
  expect(restoreAccount(undefined)).toBeNull()
  // Начало входа: код, страница только на github.com, сроки в разумных пределах
  expect(parseStart(reply(200, STARTED))).toEqual({ ...STARTED, error: '' })
  expect(parseStart(reply(200, { ...STARTED, interval: 0.1, expires: 99_999 }))).toMatchObject({ interval: 1, expires: 3600 })
  expect(parseStart(reply(200, { ...STARTED, url: 'https://evil.example/login/device' }))).toMatchObject({ code: '', error: 'down' })
  expect(parseStart(reply(200, { ...STARTED, code: 'nope' }))).toMatchObject({ code: '', error: 'down' })
  expect(parseStart(null).error).toBe('down')
  expect(parseStart(reply(503, { error: 'off' })).error).toBe('off')
  expect(parseStart(reply(503, { error: 'app' })).error).toBe('app')
  expect(parseStart(reply(503, { error: 'other' })).error).toBe('down')
  expect(parseStart(reply(429, { error: 'limit' })).error).toBe('limit')
  expect(parseStart(reply(502, { error: 'upstream' })).error).toBe('down')
  expect(parseStart(reply(200, '<html>')).error).toBe('down')
  // Начало входа кнопкой: страница только на github.com/login/oauth/authorize, номер и ключ по 43 знака, код — 4
  expect(accountUrl('web')).toBe(`${SITE}/api/auth/web`)
  expect(accountUrl('wait')).toBe(`${SITE}/api/auth/web/poll`)
  expect(parseWeb(reply(200, WEB_STARTED))).toEqual({ ...WEB_STARTED, error: '' })
  expect(parseWeb(reply(200, { ...WEB_STARTED, interval: 0.1, expires: 99_999 }))).toMatchObject({ interval: 1, expires: 3600 })
  expect(parseWeb(reply(200, { ...WEB_STARTED, url: 'https://evil.example/login/oauth/authorize?state=x' }))).toMatchObject({ url: '', error: 'down' })
  expect(parseWeb(reply(200, { ...WEB_STARTED, url: 'https://github.com/login/device' })).error).toBe('down')
  expect(parseWeb(reply(200, { ...WEB_STARTED, url: `${WEB_STARTED.url}#x` })).error).toBe('down')
  expect(parseWeb(reply(200, { ...WEB_STARTED, state: 'short' })).error).toBe('down')
  expect(parseWeb(reply(200, { ...WEB_STARTED, key: `${'K'.repeat(42)}!` })).error).toBe('down')
  expect(parseWeb(reply(200, { ...WEB_STARTED, mark: 'ab2c' })).error).toBe('down')
  expect(parseWeb(null).error).toBe('down')
  expect(parseWeb(reply(404, 'not found')).error).toBe('down')
  expect(parseWeb(reply(503, { error: 'off' })).error).toBe('off')
  expect(parseWeb(reply(429, { error: 'limit' })).error).toBe('limit')
  // Ждём человека, GitHub просит реже, код истёк, отказ, вошёл; ключ сессии от чужого профиля — не вход
  expect(parsePoll(reply(200, { status: 'pending' }))).toEqual({ status: 'pending', interval: 0, account: null, error: '' })
  expect(parsePoll(reply(200, { status: 'pending', interval: 10 }))).toMatchObject({ status: 'pending', interval: 10 })
  expect(parsePoll(reply(200, { status: 'pending', interval: 600 })).interval).toBe(60)
  expect(parsePoll(reply(200, { status: 'expired' })).status).toBe('expired')
  expect(parsePoll(reply(200, { status: 'denied' })).status).toBe('denied')
  expect(parsePoll(reply(200, { status: 'ok', token: TOKEN, user }))).toEqual({ status: 'ok', interval: 0, account: { token: TOKEN, user }, error: '' })
  expect(parsePoll(reply(200, { status: 'ok', token: `7.${'a'.repeat(43)}`, user }))).toMatchObject({ status: '', account: null, error: 'down' })
  expect(parsePoll(reply(200, { status: 'weird' })).error).toBe('down')
  expect(parsePoll(reply(429, { error: 'limit' })).error).toBe('limit')
  // Настройки сайта: только общие ключи с отметкой времени
  const settings = { lang: { v: 'en', at: 5 }, wide: { v: true, at: 7 }, junk: { v: 1, at: 1 }, notify: { v: false }, keys: 'нет' }
  const clean = { lang: { v: 'en', at: 5 }, wide: { v: true, at: 7 } }
  expect(parseMe(reply(200, { user, settings }))).toEqual({ user, settings: clean, handle: '', ticket: '', pic: null, friends: 0, requests: 0, unread: 0, role: '', error: '' })
  expect(parseMe(reply(401, { error: 'auth' }))).toEqual({ user: null, settings: {}, handle: '', ticket: '', pic: null, friends: 0, requests: 0, unread: 0, role: '', error: 'auth' })
  // Аватарка: номер 0–23 из своих картинок; другое — нет аватарки
  expect(parseMe(reply(200, { user, pic: 5 })).pic).toBe(5)
  expect(parseMe(reply(200, { user, pic: 24 })).pic).toBeNull()
  expect(parseMe(reply(200, { user, pic: 'https://avatars.githubusercontent.com/u/1' })).pic).toBeNull()
  // Ответ про смену аватарки: сайт подтвердил номер или убрал; часто — подожди
  expect(parseAvatar(reply(200, { pic: 0 }))).toEqual({ pic: 0, error: '' })
  expect(parseAvatar(reply(200, {}))).toEqual({ pic: null, error: '' })
  expect(parseAvatar(reply(200, { pic: 99 }))).toEqual({ pic: null, error: 'down' })
  expect(parseAvatar(reply(400, { error: 'invalid' }))).toEqual({ pic: null, error: 'invalid' })
  expect(parseAvatar(reply(429, { error: 'often' })).error).toBe('often')
  expect(parseAvatar(reply(429, {})).error).toBe('limit')
  expect(parseAvatar(reply(401, { error: 'auth' })).error).toBe('auth')
  // Человек из списка друзей: номер, ник и аватарка, если выбрал
  expect(personFrom({ id: 7, handle: 'octo_pal', pic: 3 })).toEqual({ id: '7', handle: 'octo_pal', pic: 3 })
  expect(personFrom({ id: '7', handle: 'octo_pal', pic: -1 })).toEqual({ id: '7', handle: 'octo_pal' })
  expect(personFrom({ id: 'x', handle: 'octo_pal' })).toBeNull()
  expect(personFrom({ id: '7', handle: 'Bad Name' })).toBeNull()
  // Роль: только «admin» от сайта, остальное — обычный человек
  expect(parseMe(reply(200, { user, role: 'admin' })).role).toBe('admin')
  expect(parseMe(reply(200, { user, role: 'root' })).role).toBe('')
  expect(parseMe(reply(200, { user: { login: 'octocat' } })).error).toBe('down')
  expect(parseSettings(reply(200, { settings }))).toEqual({ settings: clean, error: '' })
  expect(parseSettings(reply(413, { error: 'too big' })).error).toBe('big')
  expect(parseDone(reply(200, { ok: true }))).toBe('')
  expect(parseDone(reply(401, { error: 'auth' }))).toBe('auth')
  expect(parseDone(null)).toBe('down')
  expect(restoreStamps({ lang: 5, wide: 'x', junk: 3, notify: -1, keys: 0 })).toEqual({ lang: 5 })
  expect(restoreStamps(null)).toEqual({})
  // Встреча: сайт новее — оттуда; здесь новее — туда; на сайте нет — туда; не менял здесь (нет отметки) — с сайта
  expect(SYNC_KEYS).toEqual(['lang', 'keys', 'notify', 'wide', 'keepMenu', 'backOnDone', 'onDone', 'onPermission', 'myTopics', 'twitchChannels', 'flappyBest', 'collapsed', 'hidden', 'favorites', 'hideOnline', 'askAfter'])
  expect(
    syncPlan(
      { lang: 'ru', wide: true, notify: false, onDone: 'pause' },
      { lang: 100, wide: 300, notify: 50 },
      { lang: { v: 'en', at: 200 }, wide: { v: false, at: 200 }, onDone: { v: 'notify', at: 10 }, myTopics: { v: ['rust'], at: 20 } },
      1000,
    ),
  ).toEqual({
    apply: { lang: 'en', onDone: 'notify', myTopics: ['rust'] },
    push: { wide: { v: true, at: 300 }, notify: { v: false, at: 50 } },
    stamps: { lang: 200, wide: 300, notify: 50, onDone: 10, myTopics: 20 },
  })
  // Без отметки и без сайта — туда с отметкой «сейчас»; то же значение — ничего не берём
  expect(syncPlan({ wide: true }, {}, {}, 1000)).toEqual({ apply: {}, push: { wide: { v: true, at: 1000 } }, stamps: { wide: 1000 } })
  expect(syncPlan({ lang: 'en' }, { lang: 100 }, { lang: { v: 'en', at: 200 } }, 1000)).toEqual({ apply: {}, push: {}, stamps: { lang: 200 } })
  // Рекорд Flappy Arcade: побеждает больший, и его отметка — позже сайтовой
  expect(syncPlan({ flappyBest: 30 }, { flappyBest: 900 }, { flappyBest: { v: 50, at: 5 } }, 1000)).toEqual({ apply: { flappyBest: 50 }, push: {}, stamps: { flappyBest: 5 } })
  expect(syncPlan({ flappyBest: 80 }, {}, { flappyBest: { v: 50, at: 2000 } }, 1000).push).toEqual({ flappyBest: { v: 80, at: 2001 } })
  expect(syncPlan({ flappyBest: 80 }, {}, {}, 1000).push).toEqual({ flappyBest: { v: 80, at: 1000 } })
  expect(syncPlan({ flappyBest: 50 }, { flappyBest: 3 }, { flappyBest: { v: 50, at: 7 } }, 1000)).toEqual({ apply: {}, push: {}, stamps: { flappyBest: 7 } })
})

test('аккаунт: вход через GitHub по коду — страница GitHub в браузере, сайт спрашиваем раз в interval, потом настройки', HEAVY, async ($, on) => {
  let polls = 0
  const { api, remote } = accountSite(
    { flappyBest: { v: 42, at: 1 } },
    { 'POST api/auth/poll': () => (++polls < 2 ? { json: { status: 'pending', interval: 10 } } : { json: { status: 'ok', token: TOKEN, user: OCTO } }) },
  )
  const { clock, launches, requests, saved } = stubs(on, { env: WINDOWS, api, stored: { notify: false } })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-menu-account' })).toMatchObject({ props: { label: 'Войти через GitHub' } })
  expect(await ui.find({ type: 'Text', text: '  по желанию: одни настройки на всех компьютерах и свой @ник' })).toBeDefined()
  // Без входа сайт про аккаунт не спрашиваем
  await clock.advance(3_000)
  await ui.press({ key: 'arcade-menu-account' })
  await clock.settle()
  expect(requests).toEqual([])
  expect(await ui.find({ type: 'Text', text: 'Arcade узнаёт только имя и картинку профиля GitHub — ни почты, ни доступа к репозиториям.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-account-login' })).toMatchObject({ props: { label: 'Войти через GitHub', autoFocus: true } })
  // Вход кнопкой на сайте выключен — код: сайт просит его у GitHub; человек вводит его на странице GitHub в обычном
  // браузере
  await ui.press({ key: 'arcade-account-login' })
  await clock.settle()
  expect(requests).toEqual([
    { path: 'api/auth/web', method: 'POST', headers: { Accept: 'application/json' }, body: undefined },
    { path: 'api/auth/start', method: 'POST', headers: { Accept: 'application/json' }, body: undefined },
  ])
  expect(await ui.find({ type: 'Text', text: 'Введи этот код на странице GitHub:' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  WDJB-MJHT' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  https://github.com/login/device' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Жду, когда ты подтвердишь вход на GitHub…' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-account-github' })).toMatchObject({ props: { label: 'Открыть страницу GitHub', autoFocus: true } })
  await ui.press({ key: 'arcade-account-github' })
  expect(launches.map((l: any) => l.env.ARCADE_URL)).toEqual(['https://github.com/login/device'])
  expect(await ui.find({ type: 'Text', text: 'Открываю GitHub в браузере — введи там код.' })).toBeDefined()
  // Спрашиваем раз в interval секунд; GitHub попросил реже — реже
  await clock.advance(5_000)
  expect(sent(requests, 'api/auth/poll', 'POST')).toEqual([
    { path: 'api/auth/poll', method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: { device: 'dev_code_1234' } },
  ])
  await clock.advance(5_000)
  expect(polls).toBe(1)
  await clock.advance(5_000)
  expect(polls).toBe(2)
  // Вошёл: вход сохранён; рекорд с сайта — сюда, уведомления отсюда — туда. Ключ сессии — только в заголовке
  expect(saved.get('account')).toEqual({ token: TOKEN, user: OCTO })
  expect(sent(requests, 'api/me', 'GET').map((r) => r.headers.Authorization)).toEqual([`Bearer ${TOKEN}`])
  expect(saved.get('flappyBest')).toBe(42)
  expect(remote.notify).toMatchObject({ v: false })
  expect(saved.get('syncAt')).toEqual({ notify: remote.notify.at, flappyBest: 1 })
  expect(JSON.stringify(requests.map((r) => r.body))).not.toContain(TOKEN)
  expect(await ui.find({ type: 'Text', text: 'GitHub: @octocat' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Настройки синхронизированы.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-account-sync' })).toMatchObject({ props: { label: 'Синхронизировать сейчас', autoFocus: true } })
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-menu-account' })).toMatchObject({ props: { label: 'Аккаунт', autoFocus: true } })
  expect(await ui.find({ type: 'Text', text: '  GitHub: @octocat' })).toBeDefined()
  await ui.unmount()
})

test('аккаунт: вход кнопкой через сайт — страница входа открывается сама, код для сверки, сайт спрашиваем раз в 3 секунды', HEAVY, async ($, on) => {
  let waits = 0
  const { api } = accountSite(
    {},
    {
      'POST api/auth/web': { json: WEB_STARTED },
      'POST api/auth/web/poll': () => (++waits < 2 ? { json: { status: 'pending' } } : { json: { status: 'ok', token: TOKEN, user: OCTO } }),
    },
  )
  const { clock, launches, requests, saved } = stubs(on, { env: WINDOWS, api })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-account' })
  await clock.settle()
  await ui.press({ key: 'arcade-account-login' })
  await clock.settle()
  // Сайт дал адрес входа — браузер открывается сам; кода у GitHub не просим
  expect(requests).toEqual([{ path: 'api/auth/web', method: 'POST', headers: { Accept: 'application/json' }, body: undefined }])
  expect(launches.map((l: any) => l.env.ARCADE_URL)).toEqual([WEB_STARTED.url])
  expect(await ui.find({ type: 'Text', text: 'Открываю вход в браузере.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Страница входа открылась в браузере: подтверди вход на GitHub, потом нажми «Войти» на странице Arcade.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  AB2C' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: `  ${WEB_STARTED.url}` })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Жду, когда ты войдёшь в браузере…' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-account-github' })).toMatchObject({ props: { label: 'Открыть страницу ещё раз', autoFocus: true } })
  expect(await ui.find({ key: 'arcade-account-code' })).toMatchObject({ props: { label: 'Войти по коду' } })
  // Вкладку закрыли — та же страница ещё раз
  await ui.press({ key: 'arcade-account-github' })
  expect(launches.map((l: any) => l.env.ARCADE_URL)).toEqual([WEB_STARTED.url, WEB_STARTED.url])
  // Спрашиваем раз в 3 секунды; номер входа и ключ к нему — в теле, не в адресе
  await clock.advance(3_000)
  expect(sent(requests, 'api/auth/web/poll', 'POST')).toEqual([
    { path: 'api/auth/web/poll', method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: { state: WEB_STARTED.state, key: WEB_STARTED.key } },
  ])
  await clock.advance(3_000)
  expect(waits).toBe(2)
  // Вошёл: так же, как по коду
  expect(saved.get('account')).toEqual({ token: TOKEN, user: OCTO })
  expect(sent(requests, 'api/auth/start', 'POST')).toEqual([])
  expect(sent(requests, 'api/me', 'GET').map((r) => r.headers.Authorization)).toEqual([`Bearer ${TOKEN}`])
  expect(await ui.find({ type: 'Text', text: 'GitHub: @octocat' })).toBeDefined()
  await ui.unmount()
})

test('аккаунт: вход кнопкой — «Войти по коду», сайт не смог войти — сам на код; отказ, время вышло и лимит — понятно', HEAVY, async ($, on) => {
  let webs = 0
  let waitAnswer: any = { json: { status: 'pending' } }
  const webAnswers = [{ json: WEB_STARTED }, { json: WEB_STARTED }, { json: WEB_STARTED }, { json: { ...WEB_STARTED, interval: 40, expires: 60 } }, { status: 429, json: { error: 'limit' } }]
  const { api } = accountSite({}, { 'POST api/auth/web': () => webAnswers[webs++], 'POST api/auth/web/poll': () => waitAnswer })
  const { clock, launches, requests, saved } = stubs(on, { env: WINDOWS, api })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-account' })
  await clock.settle()
  // Через браузер не выходит — «Войти по коду»: код у GitHub, сайт про вход кнопкой больше не спрашиваем
  await ui.press({ key: 'arcade-account-login' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: '  AB2C' })).toBeDefined()
  await ui.press({ key: 'arcade-account-code' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Введи этот код на странице GitHub:' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  WDJB-MJHT' })).toBeDefined()
  await clock.advance(5_000)
  expect(sent(requests, 'api/auth/web/poll', 'POST')).toEqual([])
  expect(sent(requests, 'api/auth/poll', 'POST').length).toBe(1)
  await ui.press({ key: 'arcade-account-cancel' })
  // Сайт не смог обменять ответ GitHub на вход — сам переходим на код и говорим почему
  await ui.press({ key: 'arcade-account-login' })
  await clock.settle()
  waitAnswer = { status: 503, json: { error: 'app' } }
  await clock.advance(3_000)
  expect(await ui.find({ type: 'Text', text: 'Вход через сайт сейчас не работает — войди по коду.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  WDJB-MJHT' })).toBeDefined()
  expect(sent(requests, 'api/auth/start', 'POST').length).toBe(2)
  await ui.press({ key: 'arcade-account-cancel' })
  // Человек отказался на GitHub — вход окончен
  await ui.press({ key: 'arcade-account-login' })
  await clock.settle()
  waitAnswer = { json: { status: 'denied' } }
  await clock.advance(3_000)
  expect(await ui.find({ type: 'Text', text: 'Вход отменён.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-account-login' })).toBeDefined()
  // Время на вход вышло, пока ждали: спрашивать сайт уже незачем
  waitAnswer = { json: { status: 'pending' } }
  await ui.press({ key: 'arcade-account-login' })
  await clock.settle()
  const waited = sent(requests, 'api/auth/web/poll', 'POST').length
  await clock.advance(61_000) // спросили раз на 40-й секунде, на 60-й время вышло — дальше не ждём
  expect(await ui.find({ type: 'Text', text: 'Время на вход вышло — попробуй ещё раз.' })).toBeDefined()
  expect(sent(requests, 'api/auth/web/poll', 'POST').length).toBe(waited + 1)
  // Лимит попыток у обоих входов общий — по коду не пробуем
  await ui.press({ key: 'arcade-account-login' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Попыток входа с этого адреса на сегодня слишком много — попробуй завтра.' })).toBeDefined()
  expect(sent(requests, 'api/auth/start', 'POST').length).toBe(2)
  expect(launches.length).toBe(4)
  expect(saved.has('account')).toBe(false)
  await ui.unmount()
})

test('аккаунт: настройки с другого компьютера — сюда, свои — на сайт через пару секунд; непонятное с сайта не берём; вход забыт — выходим', HEAVY, async ($, on) => {
  let gone = false
  const { api, remote } = accountSite(
    { wide: { v: false, at: 50 }, onDone: { v: 'pause', at: 60 }, twitchChannels: { v: 'нет', at: 70 }, notify: { v: 'да', at: 999_999 } },
    { 'GET api/me': () => (gone ? { status: 401, json: { error: 'auth' } } : undefined) },
  )
  const stored = { account: { token: TOKEN, user: OCTO }, wide: true, notify: false, syncAt: { wide: 100, notify: 100 } }
  const { clock, requests, saved } = stubs(on, { env: WINDOWS, api, stored })
  await start($)
  // Вскоре после старта: что новее на сайте — сюда; что новее здесь — туда; чего мод не понимает — перекрываем своим
  await clock.advance(3_200)
  expect(sent(requests, 'api/me', 'GET').length).toBe(1)
  expect(saved.get('onDone')).toBe('pause')
  expect(saved.get('twitchChannels')).toBeUndefined()
  expect(saved.get('notify')).toBe(false)
  expect(sent(requests, 'api/me/settings', 'PUT').map((r) => r.body)).toEqual([{ settings: { wide: { v: true, at: 100 }, notify: { v: false, at: 1_000_000 } } }])
  expect(remote.notify).toEqual({ v: false, at: 1_000_000 })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-on-done' })).toMatchObject({ props: { label: 'Когда агент закончил: пауза и плашка' } })
  // Поменял настройку — на сайт через пару секунд
  const before = requests.length
  await ui.press({ key: 'arcade-wide' })
  await clock.advance(1_000)
  expect(requests.length).toBe(before)
  await clock.advance(1_000)
  expect(remote.wide).toEqual({ v: false, at: (saved.get('syncAt') as any).wide })
  expect(remote.wide.at).toBeGreaterThan(100)
  // Сайт забыл вход — выходим здесь; настройки остаются
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-account' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Настройки синхронизированы.' })).toBeDefined()
  gone = true
  await ui.press({ key: 'arcade-account-sync' })
  await clock.settle()
  expect(saved.has('account')).toBe(false)
  expect(await ui.find({ type: 'Text', text: 'Вход на этом компьютере больше не действует — войди через GitHub заново.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-account-login' })).toBeDefined()
  expect([saved.get('wide'), saved.get('onDone')]).toEqual([false, 'pause'])
  await ui.unmount()
})

test('аккаунт: выйти — сайт забывает ключ; вход не настроен, лимит, отмена, сайт молчит, отказ и истёкший код — понятно', HEAVY, async ($, on) => {
  let starts = 0
  let pollAnswer: any = { json: { status: 'pending' } }
  const startAnswers = [{ status: 503, json: { error: 'off' } }, { status: 429, json: { error: 'limit' } }, undefined, undefined, { json: { ...STARTED, interval: 40, expires: 60 } }]
  const { api } = accountSite({}, { 'POST api/auth/start': () => startAnswers[starts++], 'POST api/auth/poll': () => pollAnswer })
  const { clock, requests, saved } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-account' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'GitHub: @octocat' })).toBeDefined()
  await ui.press({ key: 'arcade-account-logout' })
  await clock.settle()
  expect(sent(requests, 'api/auth/logout', 'POST').map((r) => r.headers.Authorization)).toEqual([`Bearer ${TOKEN}`])
  expect(saved.has('account')).toBe(false)
  expect(await ui.find({ type: 'Text', text: 'Выход выполнен: на этом компьютере настройки больше не синхронизируются.' })).toBeDefined()
  // Вход на сайте не настроен; попыток с адреса слишком много
  await ui.press({ key: 'arcade-account-login' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Вход на сайте Arcade ещё не настроен.' })).toBeDefined()
  await ui.press({ key: 'arcade-account-login' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Попыток входа с этого адреса на сегодня слишком много — попробуй завтра.' })).toBeDefined()
  // Отмена: сайт больше не спрашиваем
  await ui.press({ key: 'arcade-account-login' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: '  WDJB-MJHT' })).toBeDefined()
  await ui.press({ key: 'arcade-account-cancel' })
  await clock.advance(10_000)
  expect(sent(requests, 'api/auth/poll', 'POST')).toEqual([])
  expect(await ui.find({ key: 'arcade-account-login' })).toMatchObject({ props: { label: 'Войти через GitHub' } })
  // Сайт не ответил — ждём дальше и говорим об этом; человек отказался на GitHub — вход окончен
  await ui.press({ key: 'arcade-account-login' })
  await clock.settle()
  pollAnswer = null
  await clock.advance(5_000)
  expect(await ui.find({ type: 'Text', text: 'Сайт Arcade не ответил. Попробуй чуть позже.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-account-cancel' })).toBeDefined()
  pollAnswer = { json: { status: 'denied' } }
  await clock.advance(5_000)
  expect(await ui.find({ type: 'Text', text: 'Вход отменён на GitHub.' })).toBeDefined()
  expect(sent(requests, 'api/auth/poll', 'POST').length).toBe(2)
  // Код истёк, пока ждали: спрашивать сайт уже незачем
  pollAnswer = { json: { status: 'pending' } }
  await ui.press({ key: 'arcade-account-login' })
  await clock.settle()
  await clock.advance(61_000) // спросили раз на 40-й секунде, на 60-й код истёк — дальше не ждём
  expect(await ui.find({ type: 'Text', text: 'Код истёк — попробуй ещё раз.' })).toBeDefined()
  expect(sent(requests, 'api/auth/poll', 'POST').length).toBe(3)
  expect(saved.has('account')).toBe(false)
  await ui.unmount()
})

test('аккаунт: удалить — только со второго нажатия; сайт не ответил — вход остаётся; настройки здесь остаются', HEAVY, async ($, on) => {
  let deletes = 0
  const { api } = accountSite({}, { 'DELETE api/me': () => (++deletes === 1 ? { status: 502, json: { error: 'upstream' } } : undefined) })
  const { clock, requests, saved } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO }, onDone: 'close' } })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-account' })
  await clock.settle()
  await ui.press({ key: 'arcade-account-delete' })
  expect(await ui.find({ key: 'arcade-account-delete' })).toMatchObject({ props: { label: 'Точно удалить? Нажми ещё раз' } })
  expect(sent(requests, 'api/me', 'DELETE')).toEqual([])
  // Ушёл из меню — «точно?» забыто
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-account' })
  expect(await ui.find({ key: 'arcade-account-delete' })).toMatchObject({ props: { label: 'Удалить аккаунт' } })
  await ui.press({ key: 'arcade-account-delete' })
  await ui.press({ key: 'arcade-account-delete' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Сайт Arcade не ответил. Попробуй чуть позже.' })).toBeDefined()
  expect(saved.get('account')).toEqual({ token: TOKEN, user: OCTO })
  expect(await ui.find({ key: 'arcade-account-delete' })).toMatchObject({ props: { label: 'Удалить аккаунт' } })
  await ui.press({ key: 'arcade-account-delete' })
  await ui.press({ key: 'arcade-account-delete' })
  await clock.settle()
  expect(sent(requests, 'api/me', 'DELETE').map((r) => r.headers.Authorization)).toEqual([`Bearer ${TOKEN}`, `Bearer ${TOKEN}`])
  expect(saved.has('account')).toBe(false)
  expect(saved.get('onDone')).toBe('close')
  expect(await ui.find({ type: 'Text', text: 'Аккаунт удалён: сайт Arcade забыл тебя и твои настройки. Здесь настройки остались.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-account-login' })).toBeDefined()
  await ui.unmount()
})

// Подпись @ника от сайта: <ник>.<до, секунды>.<HMAC>
const ticketOf = (handle: string) => `${handle}.1790000000.${'A'.repeat(22)}`

test('account.js: @ник — правила, имя с GitHub, ответы сайта', () => {
  const reply = (status: number, data: any) => ({ status, ok: status < 400, headers: {}, text: typeof data === 'string' ? data : JSON.stringify(data) })
  // Латиница, цифры и _, 4–32 знака, первый — буква
  expect(['fefa', 'octo_cat', 'a123', 'a'.repeat(32)].every((h) => HANDLE.test(h))).toBe(true)
  expect(['abc', '1abc', '_abc', 'фефа', 'Fefa', 'fe-fa', 'a'.repeat(33)].some((h) => HANDLE.test(h))).toBe(false)
  expect(accountUrl('handle')).toBe(`${SITE}/api/me/handle`)
  // Что ввели: без @ и пробелов по краям, строчными
  expect(normalHandle('  @FeFa_1 ')).toBe('fefa_1')
  expect(normalHandle(5)).toBe('')
  // Имя с GitHub: строчными, - → _; не подходит под правила — не предлагаем
  expect(suggestHandle('Octo-Cat')).toBe('octo_cat')
  expect(suggestHandle('abc')).toBe('')
  expect(suggestHandle('1password')).toBe('')
  expect(suggestHandle(undefined)).toBe('')
  // /api/me: ник с подписью; подпись не к этому нику — без подписи; ник не того вида — нет ника
  expect(parseMe(reply(200, { user: OCTO, handle: 'octocat', ticket: ticketOf('octocat') }))).toMatchObject({ handle: 'octocat', ticket: ticketOf('octocat'), error: '' })
  expect(parseMe(reply(200, { user: OCTO, handle: 'octocat', ticket: ticketOf('someone') }))).toMatchObject({ handle: 'octocat', ticket: '' })
  expect(parseMe(reply(200, { user: OCTO, handle: 'octocat', ticket: 'octocat.17.x' }))).toMatchObject({ handle: 'octocat', ticket: '' })
  expect(parseMe(reply(200, { user: OCTO, handle: 'Bad Name', ticket: ticketOf('octocat') }))).toMatchObject({ handle: '', ticket: '' })
  // PUT /api/me/handle: взял; без подписи (у сайта нет ключа) — ник всё равно взят
  expect(parseHandle(reply(200, { handle: 'octocat', ticket: ticketOf('octocat') }))).toEqual({ handle: 'octocat', ticket: ticketOf('octocat'), error: '' })
  expect(parseHandle(reply(200, { handle: 'octocat' }))).toEqual({ handle: 'octocat', ticket: '', error: '' })
  expect(parseHandle(reply(400, { error: 'invalid' })).error).toBe('invalid')
  expect(parseHandle(reply(400, { error: 'reserved' })).error).toBe('reserved')
  expect(parseHandle(reply(409, { error: 'taken' })).error).toBe('taken')
  expect(parseHandle(reply(429, { error: 'often' })).error).toBe('often')
  expect(parseHandle(reply(401, { error: 'auth' })).error).toBe('auth')
  expect(parseHandle(reply(200, { ok: true })).error).toBe('down')
  expect(parseHandle(null)).toEqual({ handle: '', ticket: '', error: 'down' })
})

test('аккаунт: @ник — имя с GitHub одной кнопкой, свой из поля, занят — понятно; подпись ника — только в окно сетевой игры', HEAVY, async ($, on) => {
  let mine = ''
  const { api } = accountSite({}, {
    'GET api/me': () => ({ json: { user: OCTO, settings: {}, ...(mine ? { handle: mine, ticket: ticketOf(mine) } : {}) } }),
    'PUT api/me/handle': (request: any) => {
      const handle = request.body.handle
      if (handle === 'taken_one') return { status: 409, json: { error: 'taken' } }
      if (handle === 'admin_x') return { status: 400, json: { error: 'reserved' } }
      mine = handle
      return { json: { handle, ticket: ticketOf(handle) } }
    },
  })
  const site = JSON.parse(siteCatalog())
  site.consoles.push({ id: 'board', title: 'Настольные' })
  site.games.chess = { console: 'board', kind: 'board', board: 'chess', title: 'Шахматы', genre: 'стратегия', about: 'по сети', keys: '…' }
  const { clock, launches, requests } = stubs(on, { env: WINDOWS, api, site: JSON.stringify(site), stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const chess = async () => {
    await ui.press({ key: 'arcade-menu-board' })
    await ui.press({ key: 'arcade-game-chess' })
    await ui.press({ key: 'arcade-back' })
    return launches.at(-1).env.ARCADE_URL
  }
  // Вошёл, ника нет — адрес как был
  expect(await chess()).toBe(`${SITE}/?game=chess`)
  await ui.press({ key: 'arcade-menu-account' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Ника пока нет.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-account-take' })).toMatchObject({ props: { label: 'Взять @octocat' } })
  expect(await ui.find({ key: 'arcade-account-handle' })).toMatchObject({ props: { label: 'Свой ник', placeholder: 'латинские буквы, цифры и _, от 4 до 32 знаков' } })
  // Не тот вид — сайт не спрашиваем; занят и запрещён — так и говорим
  await ui.input({ key: 'arcade-account-handle', text: 'фефа', kind: 'submit' })
  expect(await ui.find({ type: 'Text', text: 'Ник — от 4 до 32 знаков: латинские буквы, цифры и _, первый — буква.' })).toBeDefined()
  expect(sent(requests, 'api/me/handle', 'PUT')).toEqual([])
  await ui.input({ key: 'arcade-account-handle', text: ' @Taken_One ', kind: 'submit' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: '@taken_one уже занят — выбери другой.' })).toBeDefined()
  await ui.input({ key: 'arcade-account-handle', text: 'admin_x', kind: 'submit' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Такой ник взять нельзя — выбери другой.' })).toBeDefined()
  // Имя с GitHub одной кнопкой: ключ сессии — в заголовке
  await ui.press({ key: 'arcade-account-take' })
  await clock.settle()
  expect(sent(requests, 'api/me/handle', 'PUT').map((r) => [r.body, r.headers.Authorization])).toEqual([
    [{ handle: 'taken_one' }, `Bearer ${TOKEN}`],
    [{ handle: 'admin_x' }, `Bearer ${TOKEN}`],
    [{ handle: 'octocat' }, `Bearer ${TOKEN}`],
  ])
  expect(await ui.find({ type: 'Text', text: 'Твой ник: @octocat' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-account-take' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-account-handle' })).toMatchObject({ props: { label: 'Сменить ник' } })
  expect(await ui.find({ type: 'Text', text: 'Такой ник взять нельзя — выбери другой.' })).toBeUndefined()
  // Тот же ник ещё раз — сайт не спрашиваем
  await ui.input({ key: 'arcade-account-handle', text: 'OctoCat', kind: 'submit' })
  expect(sent(requests, 'api/me/handle', 'PUT').length).toBe(3)
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ type: 'Text', text: '  @octocat · GitHub: @octocat' })).toBeDefined()
  // Окно сетевой игры: подпись ника — после #, на сервер она не уходит; синхронизация (меню аккаунта) ник сохраняет
  expect(await chess()).toBe(`${SITE}/?game=chess#me=${ticketOf('octocat')}`)
  const syncs = sent(requests, 'api/me', 'GET').length
  await ui.press({ key: 'arcade-menu-account' })
  await clock.settle()
  expect(sent(requests, 'api/me', 'GET').length).toBe(syncs + 1)
  await ui.press({ key: 'arcade-back' })
  expect(await chess()).toBe(`${SITE}/?game=chess#me=${ticketOf('octocat')}`)
  // Вышел — пустая подпись: страница забудет прежнюю
  await ui.press({ key: 'arcade-menu-account' })
  await clock.settle()
  await ui.press({ key: 'arcade-account-logout' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Твой ник: @octocat' })).toBeUndefined()
  await ui.press({ key: 'arcade-back' })
  expect(await chess()).toBe(`${SITE}/?game=chess#me=`)
  await ui.unmount()
})

test('аккаунт: ник с сайта — в меню, свой из поля его меняет; вход забыт — выходим', HEAVY, async ($, on) => {
  let mine = 'old_name'
  let gone = false
  const { api } = accountSite({}, {
    'GET api/me': () => ({ json: { user: OCTO, settings: {}, handle: mine, ticket: ticketOf(mine) } }),
    'PUT api/me/handle': (request: any) => {
      if (gone) return { status: 401, json: { error: 'auth' } }
      mine = request.body.handle
      return { json: { handle: mine, ticket: ticketOf(mine) } }
    },
  })
  const { clock, requests, saved } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-account' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Твой ник: @old_name' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-account-take' })).toBeUndefined()
  await ui.input({ key: 'arcade-account-handle', text: 'new_name', kind: 'submit' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Твой ник: @new_name' })).toBeDefined()
  // Сайт сказал, что вход больше не действует, — выходим
  gone = true
  await ui.input({ key: 'arcade-account-handle', text: 'third_name', kind: 'submit' })
  await clock.settle()
  expect(saved.has('account')).toBe(false)
  expect(await ui.find({ type: 'Text', text: 'Вход на этом компьютере больше не действует — войди через GitHub заново.' })).toBeDefined()
  expect(sent(requests, 'api/me/handle', 'PUT').length).toBe(2)
  await ui.unmount()
})

// --- Друзья: взаимные заявки по точному @нику ---

test('account.js: друзья — адреса, счётчики в /api/me, ответы сайта', () => {
  const reply = (status: number, data: any) => ({ status, ok: status < 400, headers: {}, text: typeof data === 'string' ? data : JSON.stringify(data) })
  expect([accountUrl('friends'), accountUrl('accept'), accountUrl('unfriend')]).toEqual([`${SITE}/api/me/friends`, `${SITE}/api/me/friends/accept`, `${SITE}/api/me/friends/remove`])
  // /api/me: сколько друзей и заявок — целое от 0, не больше 9999; нет — 0
  expect(parseMe(reply(200, { user: OCTO, friends: 3, requests: 2 }))).toMatchObject({ friends: 3, requests: 2, error: '' })
  expect(parseMe(reply(200, { user: OCTO, friends: -1, requests: 'x' }))).toMatchObject({ friends: 0, requests: 0 })
  expect(parseMe(reply(200, { user: OCTO, friends: 2.5, requests: 1e9 }))).toMatchObject({ friends: 0, requests: 9999 })
  // Списки: только { id, handle } с номером и ником как надо; status — только sent или friends
  const pal = { id: '7', handle: 'octo_pal' }
  const lists = { friends: [pal, { id: 'x', handle: 'octo_bad' }, { id: '8', handle: 'Bad Name' }, null], incoming: [{ id: 12, handle: 'asker_one' }], outgoing: [] }
  expect(parseFriends(reply(200, lists))).toEqual({ status: '', friends: [pal], incoming: [{ id: '12', handle: 'asker_one' }], outgoing: [], error: '' })
  expect(parseFriends(reply(200, { ...lists, status: 'sent' })).status).toBe('sent')
  expect(parseFriends(reply(200, { ...lists, status: 'friends' })).status).toBe('friends')
  expect(parseFriends(reply(200, { ...lists, status: 'weird' })).status).toBe('')
  expect(parseFriends(reply(200, { friends: Array.from({ length: 300 }, () => pal), incoming: [], outgoing: [] })).friends.length).toBe(200)
  expect(parseFriends(reply(200, { friends: [], incoming: [] }))).toEqual({ status: '', friends: [], incoming: [], outgoing: [], error: 'down' })
  // Ошибки: свой ник, не того вида, ничей, заявки нет, своего ника нет, полно, у того занято, часто
  expect(parseFriends(reply(400, { error: 'self' })).error).toBe('self')
  expect(parseFriends(reply(400, { error: 'invalid' })).error).toBe('invalid')
  expect(parseFriends(reply(400, { error: 'bad request' })).error).toBe('invalid')
  expect(parseFriends(reply(404, { error: 'nobody' })).error).toBe('nobody')
  expect(parseFriends(reply(404, { error: 'gone' })).error).toBe('gone')
  expect(parseFriends(reply(404, 'not found')).error).toBe('down') // сайт без друзей
  expect(['nohandle', 'full', 'busy', 'other'].map((e) => parseFriends(reply(409, { error: e })).error)).toEqual(['nohandle', 'full', 'busy', 'down'])
  expect(parseFriends(reply(429, { error: 'often' })).error).toBe('often')
  expect(parseFriends(reply(429, { error: 'limit' })).error).toBe('limit')
  expect(parseFriends(reply(401, { error: 'auth' })).error).toBe('auth')
  expect(parseFriends(null).error).toBe('down')
})

test('account.js: «в сети» и приглашения — адреса и ответы сайта', () => {
  const reply = (status: number, data: any) => ({ status, ok: status < 400, headers: {}, text: typeof data === 'string' ? data : JSON.stringify(data) })
  expect([accountUrl('pulse'), accountUrl('invite'), accountUrl('answer')]).toEqual([`${SITE}/api/me/pulse`, `${SITE}/api/me/invite`, `${SITE}/api/me/invites/answer`])
  // Комната настольной игры: 6–16 строчных латинских букв и цифр
  expect(['abcdef', 'abcdef123456', 'a'.repeat(16)].every((r) => ROOM.test(r))).toBe(true)
  expect(['abcde', 'a'.repeat(17), 'ABCDEF', 'abc-def', 'abcdef\n'].some((r) => ROOM.test(r))).toBe(false)
  // Отметка: друзья в сети — номера; приглашения — с ником, игрой и временем как надо, комната — только как надо
  const chess = { from: '12', handle: 'asker_one', game: 'chess', room: 'abcdef123456', at: 5 }
  const freedm = { from: 7, handle: 'octo_pal', game: 'freedm', at: 4 }
  const broken = [
    { ...chess, from: 'x' },
    { ...chess, handle: 'Bad Name' },
    { ...chess, game: 'Chess!' },
    { ...chess, game: 5 },
    { ...chess, room: 'ab' },
    { ...chess, room: 7 },
    { ...chess, at: 'now' },
    null,
  ]
  expect(parsePulse(reply(200, { online: ['7', 12, 'x', null], invites: [chess, freedm, ...broken], unread: 3, requests: 2 }))).toEqual({
    online: ['7', '12'],
    invites: [chess, { from: '7', handle: 'octo_pal', game: 'freedm', at: 4 }],
    unread: 3,
    requests: 2,
    error: '',
  })
  expect(parsePulse(reply(200, { online: Array.from({ length: 300 }, (_, k) => String(k)), invites: Array.from({ length: 80 }, () => chess), unread: -1, requests: 'x' }))).toMatchObject({ unread: 0, requests: 0 })
  expect(parsePulse(reply(200, { online: Array.from({ length: 300 }, (_, k) => String(k)), invites: [] })).online.length).toBe(200)
  expect(parsePulse(reply(200, { online: [], invites: Array.from({ length: 80 }, () => chess) })).invites.length).toBe(50)
  // Сайт без «в сети» (404) и ответ не того вида — 'down'; вход не действует — 'auth'
  const none = { online: [], invites: [], unread: 0, requests: 0 }
  expect(parsePulse(reply(404, 'not found'))).toEqual({ ...none, error: 'down' })
  expect(parsePulse(reply(200, { online: [] }))).toEqual({ ...none, error: 'down' })
  expect(parsePulse(reply(401, { error: 'auth' }))).toEqual({ ...none, error: 'auth' })
  expect(parsePulse(null).error).toBe('down')
  // Позвать и ответить: не друг, нет ника, часто, вход не действует
  expect(parseInvite(reply(200, { ok: true }))).toEqual({ error: '' })
  expect(parseInvite(reply(403, { error: 'friend' }))).toEqual({ error: 'friend' })
  expect(parseInvite(reply(409, { error: 'nohandle' }))).toEqual({ error: 'nohandle' })
  expect(parseInvite(reply(409, { error: 'other' }))).toEqual({ error: 'down' })
  expect(parseInvite(reply(429, { error: 'often' }))).toEqual({ error: 'often' })
  expect(parseInvite(reply(401, { error: 'auth' }))).toEqual({ error: 'auth' })
  expect(parseInvite(reply(400, { error: 'invalid' }))).toEqual({ error: 'down' })
  expect(parseInvite(null)).toEqual({ error: 'down' })
})

test('друзья без входа: плитка видна, экран зовёт войти через GitHub, сайт не спрашиваем', HEAVY, async ($, on) => {
  const { api } = accountSite()
  const { clock, requests } = stubs(on, { env: WINDOWS, api })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-menu-friends' })).toMatchObject({ props: { label: 'Друзья' } })
  expect(await ui.find({ type: 'Text', text: '  по @нику: заявки и список друзей; нужен вход через GitHub' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-friends' })
  await clock.settle()
  expect(requests).toEqual([])
  expect(await ui.find({ type: 'Text', text: 'Чтобы список друзей был доступен, войди через GitHub.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-friends-add' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-friends-login' })).toMatchObject({ props: { label: 'Войти через GitHub' } })
  // Кнопка входа — тот же вход, что в «Аккаунте»: код для страницы GitHub
  await ui.press({ key: 'arcade-friends-login' })
  await clock.settle()
  expect(sent(requests, 'api/auth/start', 'POST').length).toBe(1)
  expect(await ui.find({ type: 'Text', text: 'Введи этот код на странице GitHub:' })).toBeDefined()
  await ui.unmount()
})

test('друзья без своего ника: плитка и экран просят взять @ник, кнопка ведёт в «Аккаунт»', HEAVY, async ($, on) => {
  const { api } = accountSite()
  const { clock } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '  сначала возьми свой @ник' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-friends' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Друзья находят друг друга по @нику — сначала возьми свой.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-friends-add' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-friends-handle' })).toMatchObject({ props: { label: 'Взять @ник' } })
  await ui.press({ key: 'arcade-friends-handle' })
  expect(await ui.find({ key: 'arcade-account-take' })).toMatchObject({ props: { label: 'Взять @octocat' } })
  await ui.unmount()
})

// Сайт с друзьями octocat: people — ники по номеру аккаунта; circle — номера друзей, заявок ему и его заявок. down —
// сайт без друзей (старый), gone — вход больше не действует
function friendsSite() {
  const people: Record<string, string> = { 7: 'octo_pal', 12: 'asker_one', 15: 'asker_two', 18: 'asker_three', 21: 'new_pal', 30: 'late_one' }
  const circle: Record<string, string[]> = { friends: ['7'], incoming: ['12', '15', '18'], outgoing: [] }
  const state = { down: false, gone: false }
  const view = (status = '') => ({ json: { ...(status ? { status } : {}), ...Object.fromEntries(Object.entries(circle).map(([k, ids]) => [k, ids.map((id) => ({ id, handle: people[id] }))])) } })
  const drop = (id: string) => {
    for (const k of Object.keys(circle)) circle[k] = circle[k].filter((x) => x !== id)
  }
  const guard = (fn: (request: any) => any) => (request: any) => (state.gone ? { status: 401, json: { error: 'auth' } } : state.down ? undefined : fn(request))
  const { api } = accountSite({}, {
    'GET api/me': () => ({ json: { user: OCTO, settings: {}, handle: 'octocat', ticket: ticketOf('octocat'), ...(circle.friends.length ? { friends: circle.friends.length } : {}), ...(circle.incoming.length ? { requests: circle.incoming.length } : {}) } }),
    'GET api/me/friends': guard(() => view()),
    'POST api/me/friends': guard((request) => {
      const handle = request.body.handle
      if (handle === 'busy_one') return { status: 409, json: { error: 'busy' } }
      const id = Object.keys(people).find((k) => people[k] === handle)
      if (!id) return { status: 404, json: { error: 'nobody' } }
      if (circle.friends.includes(id)) return view('friends')
      // Тот сам звал — сразу друзья
      if (circle.incoming.includes(id)) {
        drop(id)
        circle.friends.push(id)
        return view('friends')
      }
      if (!circle.outgoing.includes(id)) circle.outgoing.push(id)
      return view('sent')
    }),
    'POST api/me/friends/accept': guard((request) => {
      if (!circle.incoming.includes(request.body.id)) return { status: 404, json: { error: 'gone' } }
      drop(request.body.id)
      circle.friends.push(request.body.id)
      return view()
    }),
    'POST api/me/friends/remove': guard((request) => {
      drop(request.body.id)
      return view()
    }),
  })
  return { api, circle, state }
}

test('друзья: заявка по точному нику, принять, отклонить, отменить, удалить; плитка считает', HEAVY, async ($, on) => {
  const { api, circle, state } = friendsSite()
  const { clock, requests, saved } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: string) => ui.find({ type: 'Text', text: t })
  const add = async (handle: string) => {
    await ui.input({ key: 'arcade-friends-add', text: handle, kind: 'submit' })
    await clock.settle()
  }
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  // Плитка: заявки и друзья — из /api/me
  expect(await text('  заявок тебе: 3 · друзей: 1')).toBeDefined()
  await press('arcade-menu-friends')
  expect(sent(requests, 'api/me/friends', 'GET').map((r) => r.headers.Authorization)).toEqual([`Bearer ${TOKEN}`])
  expect(await text('Твой ник: @octocat')).toBeDefined()
  expect(await text('Заявки тебе')).toBeDefined()
  expect(await text('@asker_one')).toBeDefined()
  expect(await ui.find({ key: 'arcade-fr-accept-12' })).toMatchObject({ props: { label: 'Принять' } })
  expect(await ui.find({ key: 'arcade-fr-decline-15' })).toMatchObject({ props: { label: 'Отклонить' } })
  expect(await text('@octo_pal')).toBeDefined()
  expect(await text('Твои заявки')).toBeUndefined()
  expect(await ui.find({ key: 'arcade-friends-add' })).toMatchObject({ props: { label: 'Добавить друга', placeholder: '@ник друга, точно как есть' } })
  expect(await text('Подсказок по буквам нет: заявка дойдёт, только если ник написан точно.')).toBeDefined()
  // Ник не того вида и свой — сразу здесь, сайт не спрашиваем
  await add('ab')
  expect(await text('Ник — от 4 до 32 знаков: латинские буквы, цифры и _, первый — буква.')).toBeDefined()
  await add(' @OctoCat ')
  expect(await text('Это твой ник.')).toBeDefined()
  expect(sent(requests, 'api/me/friends', 'POST')).toEqual([])
  // Ничей ник и у того слишком много заявок
  await add('nobody_here')
  expect(await text('@nobody_here не найден — проверь ник.')).toBeDefined()
  await add('busy_one')
  expect(await text('У @busy_one слишком много заявок — попробуй позже.')).toBeDefined()
  // Заявка: ник — строчными и без @; в «Твоих заявках» ждёт ответа, её можно отменить
  await add(' @New_Pal ')
  expect(sent(requests, 'api/me/friends', 'POST').at(-1)).toMatchObject({ body: { handle: 'new_pal' }, headers: { Authorization: `Bearer ${TOKEN}` } })
  expect(await text('Заявка отправлена: @new_pal увидит её у себя в «Друзьях».')).toBeDefined()
  expect(await text('Твои заявки')).toBeDefined()
  expect(await text('ждёт ответа')).toBeDefined()
  await press('arcade-fr-cancel-21')
  expect(sent(requests, 'api/me/friends/remove', 'POST').at(-1).body).toEqual({ id: '21' })
  expect(await text('Заявка для @new_pal отменена.')).toBeDefined()
  expect(await text('Твои заявки')).toBeUndefined()
  // Принять, отклонить; позвать того, кто звал сам, — сразу друзья
  await press('arcade-fr-accept-12')
  expect(sent(requests, 'api/me/friends/accept', 'POST').at(-1).body).toEqual({ id: '12' })
  expect(await text('Теперь вы с @asker_one друзья.')).toBeDefined()
  await press('arcade-fr-decline-15')
  expect(await text('Заявка от @asker_two отклонена.')).toBeDefined()
  await add('asker_three')
  expect(await text('Теперь вы с @asker_three друзья.')).toBeDefined()
  expect(await text('Заявки тебе')).toBeUndefined()
  expect(circle).toEqual({ friends: ['7', '12', '18'], incoming: [], outgoing: [] })
  // Плитка считает по последнему ответу
  await press('arcade-back')
  expect(await text('  друзей: 3')).toBeDefined()
  // Новая заявка видна после «Обновить»; прежняя заметка при входе на экран уходит
  circle.incoming.push('30')
  await press('arcade-menu-friends')
  expect(await text('Теперь вы с @asker_three друзья.')).toBeUndefined()
  expect(await ui.find({ key: 'arcade-fr-accept-30' })).toBeDefined()
  circle.incoming = []
  await press('arcade-fr-refresh')
  expect(await ui.find({ key: 'arcade-fr-accept-30' })).toBeUndefined()
  // Сайт без друзей: список остаётся прежний, заметка — что сайт не ответил; ответил — заметка уходит
  state.down = true
  await press('arcade-fr-refresh')
  expect(await text('Сайт Arcade не ответил. Попробуй чуть позже.')).toBeDefined()
  expect(await text('@octo_pal')).toBeDefined()
  state.down = false
  await press('arcade-fr-refresh')
  expect(await text('Сайт Arcade не ответил. Попробуй чуть позже.')).toBeUndefined()
  // Удалить: выбрать кого; удалили последнего — обратно на экран друзей
  await press('arcade-fr-remove')
  expect(await text('Кого удалить из друзей? Уведомления не будет; у друга ты тоже пропадёшь из списка.')).toBeDefined()
  await press('arcade-fr-remove-7')
  expect(await text('@octo_pal больше не в друзьях.')).toBeDefined()
  await press('arcade-fr-remove-12')
  await press('arcade-fr-remove-18')
  expect(await text('@asker_three больше не в друзьях.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-friends-add' })).toBeDefined()
  expect(await text('Друзей пока нет — добавь кого-нибудь по @нику.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-fr-remove' })).toBeUndefined()
  await press('arcade-back')
  expect(await text('  позови друзей по их @нику')).toBeDefined()
  // Вход больше не действует — забываем его; экран друзей говорит почему
  state.gone = true
  await press('arcade-menu-friends')
  expect(saved.has('account')).toBe(false)
  expect(await text('Вход на этом компьютере больше не действует — войди через GitHub заново.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-friends-login' })).toBeDefined()
  await ui.unmount()
})

test('друзья по-английски: экран, заметки и плитка без русских букв', HEAVY, async ($, on) => {
  const { api } = friendsSite()
  const { clock } = stubs(on, { env: { ...WINDOWS, LANG: 'en_US.UTF-8' }, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const cyrillic = async () => (await drawnTexts(ui)).filter((x) => /[А-Яа-яЁё]/.test(x) && x !== '🌐 Русский')
  expect(await ui.find({ key: 'arcade-menu-friends' })).toMatchObject({ props: { label: 'Friends' } })
  expect(await ui.find({ type: 'Text', text: '  requests for you: 3 · friends: 1' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-friends' })
  await clock.settle()
  await ui.input({ key: 'arcade-friends-add', text: 'new_pal', kind: 'submit' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Request sent: @new_pal will see it in their “Friends”.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-friends-add' })).toMatchObject({ props: { label: 'Add a friend', placeholder: "your friend's @handle, exactly" } })
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-fr-remove' })
  expect(await cyrillic()).toEqual([])
  await ui.unmount()
  // Desktop: подсказка в самом поле — тоже по-английски
  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await desk.press({ key: 'arcade-back' })
  expect(await desk.find({ key: 'arcade-friends-add' })).toMatchObject({ props: { placeholder: 'Add a friend: their @handle, exactly', submitLabel: 'Add' } })
  expect((await drawnTexts(desk)).filter((x) => /[А-Яа-яЁё]/.test(x) && x !== '🌐 Русский')).toEqual([])
  await desk.unmount()
})

test('Desktop: друзья — поле без подписи слева, строки и кнопки не слипаются', HEAVY, async ($, on) => {
  const { api } = friendsSite()
  const { clock } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-friends' })
  await clock.settle()
  // Подпись слева сжимала поле, и подсказка в нём обрезалась: подсказка — в самом поле
  const add = await ui.find({ key: 'arcade-friends-add' })
  expect(add).toMatchObject({ props: { placeholder: 'Добавить друга: @ник, точно как есть', submitLabel: 'Добавить' } })
  expect(add.props.label).toBeUndefined()
  await ui.input({ key: 'arcade-friends-add', text: 'new_pal', kind: 'submit' })
  await clock.settle()
  // Заявки, друзья и свои заявки — столбиком с промежутком по высоте
  const block = async (key: string, inside: string[]) => {
    const box = await ui.find({ key })
    expect(box).toMatchObject({ props: { flexDirection: 'column', rowGap: 'sm' } })
    for (const k of inside) expect(JSON.stringify(box)).toContain(k)
  }
  await block('fr-incoming', ['"arcade-fr-accept-12"', '"arcade-fr-accept-15"', '"arcade-fr-accept-18"'])
  await block('fr-list', ['@octo_pal'])
  await block('fr-outgoing', ['"arcade-fr-cancel-21"'])
  // «Показывать друзьям…» и «Обновить» — рядом, с промежутками, а не рамка к рамке
  const acts = await ui.find({ key: 'fr-actions' })
  expect(acts).toMatchObject({ props: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 'sm' } })
  for (const k of ['"arcade-fr-hide"', '"arcade-fr-refresh"']) expect(JSON.stringify(acts)).toContain(k)
  // Кого удалить — тоже столбиком с промежутком
  await ui.press({ key: 'arcade-fr-remove' })
  expect(await ui.find({ key: 'fr-remove-list' })).toMatchObject({ props: { flexDirection: 'column', rowGap: 'sm' } })
  await ui.unmount()
})

// --- В сети и приглашения в игру ---

// Сайт с друзьями octocat, отметкой «в сети» и приглашениями: live.online — кто из друзей в сети, live.invites — кто
// зовёт сыграть; live.pulse и live.invite — чем сайт отвечает (404 — сайт без «в сети», 403 — уже не друг). Ответ на
// приглашение сайт запоминает, но из отметки не убирает: мод не должен показать его снова
function onlineSite() {
  const { api: friends, circle, state } = friendsSite()
  const live = { online: ['7'], invites: [] as any[], pulse: 200, invite: 200 }
  const api = (path: string, request: any) => {
    if (path === 'api/me/pulse') return live.pulse === 404 ? undefined : { json: { online: live.online, invites: live.invites, unread: 0, requests: circle.incoming.length } }
    if (path === 'api/me/invite') return live.invite === 200 ? { json: { ok: true } } : { status: live.invite, json: { error: 'friend' } }
    if (path === 'api/me/invites/answer') return { json: { ok: true } }
    if (path === 'api/me/chats/unread') return { json: { unread: 4 } }
    return friends(path, request)
  }
  return { api, circle, state, live }
}

// Каталог с сетевыми играми: шахматы (комната на двоих) и FreeDM (общее лобби deathmatch); игры Денди позвать нельзя
function netCatalog() {
  const site = JSON.parse(siteCatalog())
  site.consoles.push({ id: 'board', title: 'Настольные' }, { id: 'doom', title: 'Doom' })
  site.games.chess = { console: 'board', kind: 'board', board: 'chess', title: 'Шахматы', genre: 'стратегия', about: 'по сети', keys: '…' }
  const sha = 'a'.repeat(64)
  site.games.freedm = { console: 'doom', net: 'doom', title: 'FreeDM', genre: 'шутер', about: 'сеть', keys: '…', rom: { url: `files/${sha}.wad`, base64: `files/${sha}.wad.b64`, sha256: sha, size: 1 } }
  return JSON.stringify(site)
}
const CHESS_INVITE = { from: '12', handle: 'asker_one', game: 'chess', room: 'abcdef123456', at: 1 }

test('в сети: отметка по таймеру, друг в сети, позвать в шахматы и FreeDM, принять, «Не сейчас», прятаться', HEAVY, async ($, on) => {
  const { api, circle, live } = onlineSite()
  circle.incoming = []
  live.invites = [CHESS_INVITE]
  // уведомления о сообщениях спрашивают непрочитанные сами, раз в 20 секунд, — здесь считаем только отметку
  const { clock, requests, launches, toasts, saved } = stubs(on, { env: WINDOWS, site: netCatalog(), api, stored: { account: { token: TOKEN, user: OCTO }, msgNotify: false } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: string | RegExp) => ui.find({ type: 'Text', text: t })
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  const pulses = () => sent(requests, 'api/me/pulse', 'POST')
  const me = `#me=${ticketOf('octocat')}`
  // Отметка — по таймеру, пока меню открыто; новое приглашение — тостом и сверху главного меню
  await clock.advance(5_000)
  await clock.settle()
  expect(pulses().map((r) => r.body)).toEqual([{}])
  expect(pulses()[0].headers.Authorization).toBe(`Bearer ${TOKEN}`)
  expect(toasts).toContain('@asker_one зовёт сыграть: Шахматы')
  expect(await text('@asker_one зовёт сыграть: Шахматы')).toBeDefined()
  expect(await ui.find({ key: 'arcade-inv-accept-12' })).toMatchObject({ props: { label: 'Принять' } })
  expect(await ui.find({ key: 'arcade-inv-later-12' })).toMatchObject({ props: { label: 'Не сейчас' } })
  expect(await text('  друзей: 1 · в сети: 1')).toBeDefined()
  // Следующая отметка — не раньше чем через 30 секунд; тост — один раз
  await clock.advance(10_000)
  await clock.settle()
  expect(pulses().length).toBe(1)
  // Друзья: кто в сети — так и написано, у друга — «Позвать»; приглашение — и здесь
  await press('arcade-menu-friends')
  expect(await text('в сети')).toBeDefined()
  expect(await text('Зовут сыграть')).toBeDefined()
  expect(await ui.find({ key: 'arcade-fr-invite-7' })).toMatchObject({ props: { label: 'Позвать' } })
  // Позвать: в какие игры — настольные и Doom; Денди — нет
  await press('arcade-fr-invite-7')
  expect(await text('Во что позвать @octo_pal?')).toBeDefined()
  expect(await text('Друг увидит приглашение в Arcade, когда меню открыто, — оно действует 10 минут. Игра откроется и у тебя.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-inv-game-chess' })).toMatchObject({ props: { label: 'Шахматы' } })
  expect(await ui.find({ key: 'arcade-inv-game-freedm' })).toMatchObject({ props: { label: 'FreeDM' } })
  expect(await ui.find({ key: 'arcade-inv-game-thwaite' })).toBeUndefined()
  expect(await text('  своя комната на двоих')).toBeDefined()
  expect(await text('  общее лобби deathmatch')).toBeDefined()
  // Шахматы: новая комната — и другу, и себе в окно; обратно на экран друзей с заметкой
  await press('arcade-inv-game-chess')
  const invite = sent(requests, 'api/me/invite', 'POST').at(-1)
  expect(invite.body).toMatchObject({ to: '7', game: 'chess' })
  expect(invite.body.room).toMatch(/^[0-9a-f]{12}$/)
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?game=chess&room=${invite.body.room}${me}`)
  expect(await text('Приглашение для @octo_pal отправлено: Шахматы. Оно действует 10 минут.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-friends-add' })).toBeDefined()
  // FreeDM: лобби общее — без комнаты
  await press('arcade-fr-invite-7')
  await press('arcade-inv-game-freedm')
  expect(sent(requests, 'api/me/invite', 'POST').at(-1).body).toEqual({ to: '7', game: 'freedm' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?game=freedm`)
  // Друг удалил из друзей — заметка, окно не открываем
  live.invite = 403
  const opened = launches.length
  await press('arcade-fr-invite-7')
  await press('arcade-inv-game-chess')
  expect(await text('@octo_pal больше не в друзьях.')).toBeDefined()
  expect(launches.length).toBe(opened)
  await press('arcade-back')
  // Принять: сайт забывает приглашение, игра открывается в комнате друга; приглашение больше не показываем
  await press('arcade-inv-accept-12')
  expect(sent(requests, 'api/me/invites/answer', 'POST').at(-1).body).toEqual({ from: '12' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/?game=chess&room=abcdef123456${me}`)
  expect(await ui.find({ key: 'arcade-inv-accept-12' })).toBeUndefined()
  // Новое приглашение — со следующей отметкой; принятое не возвращается, «Не сейчас» — убирает без окна
  live.invites = [{ from: '7', handle: 'octo_pal', game: 'freedm', at: 2 }, CHESS_INVITE]
  await clock.advance(35_000)
  await clock.settle()
  expect(toasts.filter((t) => t.startsWith('@asker_one'))).toEqual(['@asker_one зовёт сыграть: Шахматы'])
  expect(toasts).toContain('@octo_pal зовёт сыграть: FreeDM')
  expect(await ui.find({ key: 'arcade-inv-accept-12' })).toBeUndefined()
  const before = launches.length
  await press('arcade-inv-later-7')
  expect(sent(requests, 'api/me/invites/answer', 'POST').at(-1).body).toEqual({ from: '7' })
  expect(launches.length).toBe(before)
  expect(await ui.find({ key: 'arcade-inv-later-7' })).toBeUndefined()
  expect(await text('Зовут сыграть')).toBeUndefined()
  // Прятаться: настройка запоминается, отметка уходит сразу и с hidden
  expect(await ui.find({ key: 'arcade-fr-hide' })).toMatchObject({ props: { label: 'Показывать друзьям, что я в сети: да' } })
  await clock.advance(5_000)
  await press('arcade-fr-hide')
  expect(await ui.find({ key: 'arcade-fr-hide' })).toMatchObject({ props: { label: 'Показывать друзьям, что я в сети: нет' } })
  expect(saved.get('hideOnline')).toBe(true)
  expect(pulses().at(-1).body).toEqual({ hidden: true })
  // Сайт без «в сети»: непрочитанные для плитки «Чаты» — как раньше
  const unread = sent(requests, 'api/me/chats/unread', 'GET').length
  live.pulse = 404
  await clock.advance(35_000)
  await clock.settle()
  expect(sent(requests, 'api/me/chats/unread', 'GET').length).toBe(unread + 1)
  await ui.unmount()
})

test('в сети без окна браузера: «Позвать» нет, у приглашения — подсказка про окно и «Не сейчас»', HEAVY, async ($, on) => {
  const { api, live } = onlineSite()
  live.invites = [CHESS_INVITE]
  const { clock } = stubs(on, { env: WINDOWS, site: netCatalog(), api, stored: { account: { token: TOKEN, user: OCTO }, opener: { opener: 'pane' } } })
  await start($)
  await clock.advance(8_200)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '@asker_one зовёт сыграть: Шахматы' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-inv-accept-12' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Сетевые игры открываются в окне браузера — выбери его в настройках.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-inv-later-12' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-friends' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'в сети' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-fr-invite-7' })).toBeUndefined()
  await ui.unmount()
})

test('в сети по-английски: друзья, выбор игры и приглашение без русских букв', HEAVY, async ($, on) => {
  const { api, live } = onlineSite()
  live.invites = [CHESS_INVITE, { from: '7', handle: 'octo_pal', game: 'freedm', at: 2 }]
  const { clock, toasts } = stubs(on, { env: { ...WINDOWS, LANG: 'en_US.UTF-8' }, site: netCatalog(), api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const cyrillic = async () => (await drawnTexts(ui)).filter((x) => /[А-Яа-яЁё]/.test(x) && x !== '🌐 Русский')
  await clock.advance(5_000)
  await clock.settle()
  expect(toasts).toContain('@asker_one invites you to play: Chess')
  expect(await ui.find({ type: 'Text', text: '@asker_one invites you to play: Chess' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'more invitations: 1 — in “Friends”' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-menu-friends' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'online' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-fr-hide' })).toMatchObject({ props: { label: 'Show friends that I am online: on' } })
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-fr-invite-7' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'What to play with @octo_pal?' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-inv-game-freedm' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Invitation sent to @octo_pal: FreeDM. It is valid for 10 minutes.' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await ui.unmount()
})

// --- Чаты: с друзьями один на один и в группах ---

const LINK_CODE = `583231.1790000000.0123456789ab.${'A'.repeat(22)}`
const DM = 'd7-583231'
const CLUB = 'g0000000000000001'

test('chats.js: ответы сайта про чаты, чистка текста, служебные сообщения, время', () => {
  const reply = (status: number, data: any) => ({ status, ok: status < 400, headers: {}, text: typeof data === 'string' ? data : JSON.stringify(data) })
  expect([accountUrl('chats'), accountUrl('messages'), accountUrl('send'), accountUrl('editmsg'), accountUrl('delmsg'), accountUrl('opendm'), accountUrl('group'), accountUrl('members'), accountUrl('chatticket'), accountUrl('unread')]).toEqual(
    ['chats', 'chats/messages', 'chats/send', 'chats/edit', 'chats/delete', 'chats/open', 'chats/group', 'chats/members', 'chats/ticket', 'chats/unread'].map((p) => `${SITE}/api/me/${p}`),
  )
  expect([MAX_TEXT, MAX_MEMBERS, MAX_NAME]).toEqual([2000, 50, 40])
  // Номер чата: двоих — d<номер>-<номер>, группы — g и 16 знаков
  expect([DM, CLUB, 'd1-2'].every((id) => CHAT_ID.test(id))).toBe(true)
  expect(['g000000000000001', 'x1-2', 'd1', 'g000000000000000/', `${DM}\n`].some((id) => CHAT_ID.test(id))).toBe(false)
  // Чужой текст: без управляющих знаков (и C1), невидимых меток и разворота направления; \r\n — \n, табуляция — пробел
  expect(cleanText('a\r\nb\tc\u0007\u001b[31m\u009b\u200e\u202e\u2066d\u0000')).toBe('a\nb c[31md')
  expect(cleanText(5)).toBe('')
  expect(oneLine('  chess\n\n club\t ')).toBe('chess club')
  // Список: чаты как надо; у чата двоих друг — из номера чата; название группы — одной строкой; ники — только как надо
  const me = { id: '583231' }
  const dm = { id: DM, kind: 'dm', with: '7', unread: 2, at: 5, last: { f: '7', t: 'hi\u001b[2J\nthere' } }
  const club = { id: CLUB, kind: 'group', name: '  chess\nclub  ', pic: 11, unread: 0, at: 4, last: { f: '583231', k: 'create', n: 'chess club' } }
  const broken = [{ id: 'd8-9', kind: 'dm', with: '7' }, { id: 'g1', kind: 'group' }, { id: DM, kind: 'group' }, { id: DM, kind: 'dm', with: 'x' }, null, 'g0000000000000002']
  const names = { 7: 'octo_pal', 583231: 'octocat', x: 'bad_id', 9: 'Bad Name', 10: 5 }
  // Аватарки: свою сайт кладёт в me, чужие — в pics; кривые номера и картинки — мимо. В сети — только номера, без повторов
  const pics = { 7: 4, 21: 23, x: 1, 9: 24, 10: 'https://avatars.githubusercontent.com/u/10', 11: -1, 12: 1.5 }
  const online = ['7', 7, 'x', '21', null]
  expect(parseChats(reply(200, { me: { ...me, pic: 0 }, chats: [dm, club, ...broken], names, pics, online, unread: 2 }))).toEqual({
    me: '583231',
    chats: [
      { id: DM, kind: 'dm', with: '7', unread: 2, at: 5, last: { f: '7', t: 'hi[2J there' } },
      { id: CLUB, kind: 'group', name: 'chess club', pic: 11, unread: 0, at: 4, last: { f: '583231', k: 'create', n: 'chess club' } },
    ],
    names: { 7: 'octo_pal', 583231: 'octocat' },
    pics: { 7: 4, 21: 23, 583231: 0 },
    online: ['7', '21'],
    unread: 2,
    error: '',
  })
  expect(parseChats(reply(200, { me, chats: [{ ...dm, last: { f: '7', t: 'x'.repeat(500) } }] })).chats[0].last.t.length).toBe(200)
  expect(parseChats(reply(200, { chats: [] })).error).toBe('down')
  expect(parseChats(reply(200, { me, chats: 'no' })).error).toBe('down')
  expect(parseChats(reply(200, { me, chats: [{ ...club, pic: 'x' }] })).chats[0]).not.toHaveProperty('pic')
  expect(parseChats(reply(200, { me, chats: [{ ...dm, pic: 3 }] })).chats[0]).not.toHaveProperty('pic') // у чата двоих — аватарка друга, не своя
  expect(parseChats(reply(200, { me, chats: [], online: 'all' })).online).toEqual([])
  expect(parseChats(reply(401, { error: 'auth' }))).toEqual({ me: '', chats: [], names: {}, pics: {}, online: [], unread: 0, error: 'auth' })
  expect(picsFrom({ 7: 0, 8: 23, 9: 24, x: 1 })).toEqual({ 7: 0, 8: 23 })
  expect([picsFrom(null), picsFrom([1, 2]), picsFrom('7')]).toEqual([{}, {}, {}])
  expect(parseChats(reply(503, { error: 'off' })).error).toBe('off')
  expect(parseChats(reply(404, 'not found')).error).toBe('down') // сайт без чатов
  expect(parseChats(null).error).toBe('down')
  // Переписка: по порядку номеров, кривые и непонятные служебные — мимо; участники — без повторов
  const about = { id: CLUB, kind: 'group', name: 'chess club', pic: 2, owner: '583231', members: ['583231', '7', '7', 'x', 21] }
  const messages = [
    { s: 3, at: 30, f: '7', t: 'b' },
    { s: 1, at: 10, f: '583231', k: 'create', n: 'chess club' },
    { s: 2, at: 20, f: '583231', k: 'add', o: '7' },
    { s: -1, at: 1, f: '7', t: 'x' },
    { s: 4, at: 40, f: '7', k: 'dance' },
    { s: 5, at: 'x', f: '7', t: 'y' },
    { s: 6, at: 60, f: 'x', t: 'z' },
  ]
  expect(parseMessages(reply(200, { me, chat: about, messages, first: 1, names, pics: { 7: 4 }, unread: 1 }))).toEqual({
    me: '583231',
    chat: { id: CLUB, kind: 'group', name: 'chess club', pic: 2, owner: '583231', members: ['583231', '7', '21'], edits: 0 },
    messages: [
      { s: 1, at: 10, f: '583231', k: 'create', n: 'chess club' },
      { s: 2, at: 20, f: '583231', k: 'add', o: '7' },
      { s: 3, at: 30, f: '7', t: 'b' },
    ],
    first: 1,
    names: { 7: 'octo_pal', 583231: 'octocat' },
    pics: { 7: 4 },
    unread: 1,
    error: '',
  })
  expect(parseMessages(reply(200, { me, chat: { id: DM, kind: 'dm', with: '7' }, messages: [{ s: 1, at: 1, f: '7', t: 'й'.repeat(2500) }] }))).toMatchObject({
    chat: { id: DM, kind: 'dm', with: '7', owner: '', members: [] },
    first: 0,
  })
  expect(parseMessages(reply(200, { me, chat: { id: DM, kind: 'dm', with: '7' }, messages: [{ s: 1, at: 1, f: '7', t: 'й'.repeat(2500) }] })).messages[0].t.length).toBe(2000)
  expect(parseMessages(reply(200, { me, chat: { id: 'nope' }, messages: [] })).error).toBe('down')
  // Поправленное — с e (когда); удалённое — без текста, d: true; у служебного e не бывает; кривой номер правки — 0
  const changed = [
    { s: 1, at: 10, f: '7', t: 'fixed', e: 15 },
    { s: 2, at: 20, f: '583231', d: 25, t: 'secret' },
    { s: 3, at: 30, f: '7', k: 'leave', e: 35 },
    { s: 4, at: 40, f: 'x', d: 45 },
    { s: 5, at: 50, f: '7', t: 'odd', e: 'x' },
  ]
  expect(parseMessages(reply(200, { me, chat: { ...about, edits: 7 }, messages: changed }))).toMatchObject({
    chat: { edits: 7 },
    messages: [
      { s: 1, at: 10, f: '7', t: 'fixed', e: 15 },
      { s: 2, at: 20, f: '583231', d: true },
      { s: 3, at: 30, f: '7', k: 'leave' },
      { s: 5, at: 50, f: '7', t: 'odd' },
    ],
  })
  expect(parseMessages(reply(200, { me, chat: { ...about, edits: 7 }, messages: changed })).messages.map((m: any) => Object.keys(m).join())).toEqual(['s,at,f,t,e', 's,at,f,d', 's,at,f,k', 's,at,f,t'])
  expect([-1, 1.5, '3', null].map((edits) => parseMessages(reply(200, { me, chat: { ...about, edits }, messages: [] })).chat.edits)).toEqual([0, 0, 0, 0])
  // Ошибки чатов: что не так с вопросом, не друг, не хозяин, чата нет, полно, нет ника, часто
  const failures = [
    [400, 'empty', 'empty'], [400, 'long', 'long'], [400, 'name', 'name'], [400, 'bad request', 'invalid'],
    [403, 'friend', 'friend'], [403, 'owner', 'owner'], [403, 'other', 'friend'],
    [404, 'gone', 'gone'], [404, 'other', 'down'],
    [409, 'full', 'full'], [409, 'nohandle', 'nohandle'], [409, 'edit', 'edit'], [409, 'other', 'down'],
    [429, 'often', 'often'], [429, 'limit', 'limit'],
    [401, 'auth', 'auth'], [503, 'off', 'off'], [500, 'boom', 'down'],
  ]
  expect(failures.map(([status, error]) => chatFailure(reply(status as number, { error }), { error }))).toEqual(failures.map(([, , want]) => want))
  expect(chatFailure(null, null)).toBe('down')
  expect(chatFailure(reply(200, { ok: true }), { ok: true })).toBe('')
  expect(parseMessages(reply(404, { error: 'gone' })).error).toBe('gone')
  // Отправка, чат целиком, вышел из группы, непрочитанные, код ссылки на страницу
  expect(parseSent(reply(200, { msg: { s: 9, at: 1, f: '583231', t: 'hi' } }))).toEqual({ msg: { s: 9, at: 1, f: '583231', t: 'hi' }, error: '' })
  expect(parseSent(reply(200, { msg: { s: 9 } }))).toEqual({ msg: null, error: 'down' })
  expect(parseSent(reply(200, { msg: { s: 9, at: 1, f: '583231', t: 'hi!', e: 2 } }))).toEqual({ msg: { s: 9, at: 1, f: '583231', t: 'hi!', e: 2 }, error: '' })
  expect(parseSent(reply(200, { msg: { s: 9, at: 1, f: '583231', d: 2 } }))).toEqual({ msg: { s: 9, at: 1, f: '583231', d: true }, error: '' })
  expect(parseSent(reply(409, { error: 'edit' }))).toEqual({ msg: null, error: 'edit' })
  expect(parseSent(reply(403, { error: 'friend' }))).toEqual({ msg: null, error: 'friend' })
  expect(parseChat(reply(200, { chat: about }))).toMatchObject({ chat: { id: CLUB, owner: '583231' }, left: false, error: '' })
  expect(parseChat(reply(200, { ok: true }))).toEqual({ chat: null, left: true, error: '' })
  expect(parseChat(reply(200, { chat: { id: 'bad' } }))).toEqual({ chat: null, left: false, error: 'down' })
  expect(parseChat(reply(403, { error: 'owner' })).error).toBe('owner')
  expect(parseUnread(reply(200, { unread: 3 }))).toEqual({ unread: 3, error: '' })
  expect(parseUnread(reply(200, { unread: -2 }))).toEqual({ unread: 0, error: '' })
  expect(parseUnread(reply(401, { error: 'auth' }))).toEqual({ unread: 0, error: 'auth' })
  expect(parseLink(reply(200, { link: LINK_CODE }))).toEqual({ link: LINK_CODE, error: '' })
  expect(parseLink(reply(200, { link: `${LINK_CODE}#x` }))).toEqual({ link: '', error: 'down' })
  expect(parseLink(reply(200, { link: TOKEN }))).toEqual({ link: '', error: 'down' })
  expect(parseLink(reply(429, { error: 'often' })).error).toBe('often')
  // Служебные: шаблон переводится целиком, ники и название группы — нет
  expect(describe({ f: '1', k: 'create', n: 'club' })).toEqual({ text: '{0} создал(а) группу «{1}»', values: ['1', 'club'] })
  expect(describe({ f: '1', k: 'add', o: '2' })).toEqual({ text: '{0} добавил(а) {1}', values: ['1', '2'] })
  expect(describe({ f: '1', k: 'remove', o: '2' })).toEqual({ text: '{0} убрал(а) {1}', values: ['1', '2'] })
  expect(describe({ f: '1', k: 'leave' })).toEqual({ text: '{0} вышел(а) из группы', values: ['1'] })
  expect(describe({ f: '1', k: 'name', n: 'club' })).toEqual({ text: '{0} назвал(а) группу «{1}»', values: ['1', 'club'] })
  expect(fill(tr('{0} создал(а) группу «{1}»', 'en'), ['@octocat', 'Все друзья'])).toBe('@octocat created the group “Все друзья”')
  expect(fill(tr('{0} убрал(а) {1}', 'de'), ['@a', '@b'])).toBe('@a hat @b entfernt')
  expect(fill('{0} and {2}', ['x'])).toBe('x and {2}')
  // Время по часам компьютера: сегодня — ЧЧ:ММ, в этом году — с датой, раньше — только дата
  const now = new Date(2026, 9, 23, 18, 30).getTime()
  expect(when(new Date(2026, 9, 23, 9, 5).getTime(), now)).toBe('09:05')
  expect(when(new Date(2026, 2, 1, 14, 0).getTime(), now)).toBe('01.03 14:00')
  expect(when(new Date(2026, 9, 22, 23, 59).getTime(), now)).toBe('22.10 23:59')
  expect(when(new Date(2025, 11, 31, 23, 59).getTime(), now)).toBe('31.12.2025')
  expect(when(NaN, now)).toBe('')
  // Часы у пузыря и разделители дней в переписке
  expect(chatClock(new Date(2026, 9, 23, 9, 5).getTime())).toBe('09:05')
  expect(chatClock(NaN)).toBe('')
  expect(day(new Date(2026, 9, 23, 0, 1).getTime(), now)).toBe('Сегодня')
  expect(day(new Date(2026, 9, 22, 23, 59).getTime(), now)).toBe('Вчера')
  expect(day(new Date(2026, 9, 1, 12).getTime(), now)).toBe('01.10')
  expect(day(new Date(2025, 9, 22, 12).getTime(), now)).toBe('22.10.2025')
  expect(day(new Date(2026, 0, 1, 12).getTime(), new Date(2026, 0, 2, 9).getTime())).toBe('Вчера')
  expect(day(new Date(2025, 11, 31, 12).getTime(), new Date(2026, 0, 1, 9).getTime())).toBe('Вчера')
  expect(day(NaN, now)).toBe('')
})

// Сайт с чатами octocat (583231): друзья octo_pal (7) и new_pal (21); чат с octo_pal (два непрочитанных) и группа
// «club», которой управляет octo_pal. Вопросы с ?chat=… сайт разбирает по пути без них. state.unfriended — octo_pal
// больше не друг: писать ему нельзя; state.gone — вход больше не действует. Аватарка у octo_pal — 4, в сети — он;
// своя — state.pic (PUT api/me/avatar), state.avatarBusy — сайт отвечает «часто». change(чат, s, текст | null) —
// сообщение поправили или удалили (null); номер правки — c.edits, какие сообщения когда — c.changed
function chatsSite({ pulse = false } = {}) {
  const ME = OCTO.id
  const names: Record<string, string> = { [ME]: 'octocat', 7: 'octo_pal', 21: 'new_pal' }
  const friends = ['7', '21']
  const T = Date.UTC(2026, 9, 23, 12)
  const chats: any[] = [
    {
      id: DM,
      kind: 'dm',
      with: '7',
      members: [ME, '7'],
      messages: [
        { s: 1, at: T, f: ME, t: 'ready?' },
        { s: 2, at: T + 60_000, f: '7', t: 'almost' },
        { s: 3, at: T + 120_000, f: '7', t: 'hi! a game tonight?' },
      ],
      unread: 2,
    },
    { id: CLUB, kind: 'group', name: 'club', owner: '7', members: ['7', ME], messages: [{ s: 1, at: T - 60_000, f: '7', k: 'create', n: 'club' }], unread: 0 },
  ]
  let groups = 1
  const state = { gone: false, unfriended: false, pic: null as number | null, avatarBusy: false }
  const pics = () => ({ 7: 4, ...(state.pic === null ? {} : { [ME]: state.pic }) })
  const online = ['7']
  const myself = () => ({ id: ME, ...(state.pic === null ? {} : { pic: state.pic }) })
  const mine = () => chats.filter((c) => c.members.includes(ME))
  const find = (id: string) => mine().find((c) => c.id === id)
  const total = () => mine().reduce((n, c) => n + c.unread, 0)
  const about = (c: any) => ({ id: c.id, kind: c.kind, ...(c.kind === 'dm' ? { with: c.with } : { name: c.name, owner: c.owner, ...(c.pic === undefined ? {} : { pic: c.pic }) }), members: c.members, ...(c.edits ? { edits: c.edits } : {}) })
  const at = (c: any) => c.messages.at(-1)?.at ?? 0
  const last = (c: any) => c.messages.filter((m: any) => !m.d).at(-1)
  const change = (c: any, s: number, text: string | null) => {
    const i = c.messages.findIndex((m: any) => m.s === s)
    const old = c.messages[i]
    c.messages[i] = text === null ? { s, f: old.f, at: old.at, d: T + 7_200_000 } : { ...old, t: text, e: T + 7_200_000 }
    c.edits = (c.edits ?? 0) + 1
    c.changed = [...(c.changed ?? []).filter(([, n]: number[]) => n !== s), [c.edits, s]]
    return c.messages[i]
  }
  const post = (c: any, m: any) => {
    const msg = { s: (c.messages.at(-1)?.s ?? 0) + 1, at: T + 3_600_000, ...m }
    c.messages.push(msg)
    return msg
  }
  const gone = { status: 404, json: { error: 'gone' } }
  const guard = (fn: (request: any) => any) => (request: any) => (state.gone ? { status: 401, json: { error: 'auth' } } : fn(request))
  const routes: Record<string, (request: any) => any> = {
    'GET api/me': () => ({ json: { user: OCTO, settings: {}, handle: 'octocat', ticket: ticketOf('octocat'), ...(state.pic === null ? {} : { pic: state.pic }), friends: friends.length, unread: total() } }),
    'PUT api/me/avatar': guard(({ body }) => {
      if (state.avatarBusy) return { status: 429, json: { error: 'often' } }
      if (body.pic !== null && !validPic(body.pic)) return { status: 400, json: { error: 'invalid' } }
      state.pic = body.pic
      return { json: body.pic === null ? {} : { pic: body.pic } }
    }),
    'GET api/me/friends': guard(() => ({ json: { friends: friends.map((id) => ({ id, handle: names[id] })), incoming: [], outgoing: [] } })),
    'GET api/me/chats': guard(() => ({
      json: {
        me: myself(),
        chats: mine()
          .sort((a, b) => at(b) - at(a))
          .map((c) => ({ ...about(c), unread: c.unread, at: at(c), ...(last(c) ? { last: last(c) } : {}) })),
        names,
        pics: pics(),
        online,
        unread: total(),
      },
    })),
    // Открыл переписку — прочитал её
    'GET api/me/chats/messages': guard(({ query }) => {
      const c = find(query.chat)
      if (!c) return gone
      c.unread = 0
      const after = query.after ? Number(query.after) : 0
      const before = query.before ? Number(query.before) : Infinity
      // edits — номер правки, которую мод уже видел: поправленные и удалённые после неё приходят и раньше after
      const edited = query.edits && !query.before ? (c.changed ?? []).filter(([v]: number[]) => v > Number(query.edits)).map(([, s]: number[]) => s) : []
      return { json: { me: myself(), chat: about(c), messages: c.messages.filter((m: any) => (m.s > after || edited.includes(m.s)) && m.s < before), first: 1, names, pics: pics(), unread: total() } }
    }),
    'POST api/me/chats/edit': guard(({ body }) => {
      const c = find(body.chat)
      if (!c) return gone
      const old = c.messages.find((m: any) => m.s === body.s)
      if (old?.f !== ME || typeof old.t !== 'string') return { status: 409, json: { error: 'edit' } }
      return { json: { msg: change(c, body.s, body.text) } }
    }),
    'POST api/me/chats/delete': guard(({ body }) => {
      const c = find(body.chat)
      if (!c) return gone
      const old = c.messages.find((m: any) => m.s === body.s)
      if (old?.f !== ME || typeof old.t !== 'string') return { status: 409, json: { error: 'edit' } }
      return { json: { msg: change(c, body.s, null) } }
    }),
    'POST api/me/chats/send': guard(({ body }) => {
      const c = find(body.chat)
      if (!c) return gone
      if (state.unfriended && c.kind === 'dm') return { status: 403, json: { error: 'friend' } }
      return { json: { msg: post(c, { f: ME, t: body.text }) } }
    }),
    'POST api/me/chats/open': guard(({ body }) => {
      if (!friends.includes(body.with)) return { status: 403, json: { error: 'friend' } }
      const id = `d${[body.with, ME].sort((a, b) => Number(a) - Number(b)).join('-')}`
      let c = chats.find((x) => x.id === id)
      if (!c) chats.push((c = { id, kind: 'dm', with: body.with, members: [ME, body.with], messages: [], unread: 0 }))
      return { json: { chat: about(c) } }
    }),
    'POST api/me/chats/group': guard(({ body }) => {
      const c = { id: `g${String(++groups).padStart(16, '0')}`, kind: 'group', name: body.name, owner: ME, members: [ME, ...(body.all ? friends : body.members)], messages: [], unread: 0 }
      post(c, { f: ME, k: 'create', n: body.name })
      chats.push(c)
      return { json: { chat: about(c) } }
    }),
    'POST api/me/chats/members': guard(({ body }) => {
      const c = find(body.chat)
      if (!c || c.kind !== 'group') return gone
      if (body.leave) {
        c.members = c.members.filter((id: string) => id !== ME)
        post(c, { f: ME, k: 'leave' })
        return { json: { ok: true } }
      }
      if (c.owner !== ME) return { status: 403, json: { error: 'owner' } }
      for (const id of body.add ?? []) {
        c.members.push(id)
        post(c, { f: ME, k: 'add', o: id })
      }
      for (const id of body.remove ?? []) {
        c.members = c.members.filter((x: string) => x !== id)
        post(c, { f: ME, k: 'remove', o: id })
      }
      if (body.name) {
        c.name = body.name
        post(c, { f: ME, k: 'name', n: body.name })
      }
      if (body.pic !== undefined) {
        if (body.pic === null) delete c.pic
        else c.pic = body.pic
        post(c, { f: ME, k: 'pic', ...(body.pic === null ? {} : { n: body.pic }) })
      }
      return { json: { chat: about(c) } }
    }),
    'POST api/me/chats/ticket': guard(({ body }) => (body?.link === true ? { json: { link: LINK_CODE } } : { status: 400, json: { error: 'invalid' } })),
    'GET api/me/chats/unread': guard(() => ({ json: { unread: total() } })),
  }
  // pulse — сайт знает отметку «в сети» и сам приносит непрочитанные; без неё мод спрашивает их по-старому
  if (pulse) routes['POST api/me/pulse'] = guard(() => ({ json: { online, invites: [], unread: total(), requests: 0 } }))
  const { api: account } = accountSite()
  const api = (path: string, request: any) => {
    const [bare, query = ''] = path.split('?')
    const route = routes[`${request.method} ${bare}`]
    return route ? route({ ...request, query: Object.fromEntries(new URLSearchParams(query)) }) : account(bare, request)
  }
  return { api, chats, state, post, change }
}

test('чаты без входа: плитка видна, экран зовёт войти через GitHub, сайт не спрашиваем', HEAVY, async ($, on) => {
  const { api } = accountSite()
  const { clock, requests } = stubs(on, { env: WINDOWS, api })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-menu-chats' })).toMatchObject({ props: { label: 'Чаты' } })
  expect(await ui.find({ type: 'Text', text: '  с друзьями: один на один и группы; нужен вход через GitHub' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-chats' })
  await clock.settle()
  expect(requests).toEqual([])
  expect(await ui.find({ type: 'Text', text: 'Чтобы писать друзьям, войди через GitHub.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-chat-new' })).toBeUndefined()
  await ui.press({ key: 'arcade-chats-login' })
  await clock.settle()
  expect(sent(requests, 'api/auth/start', 'POST').length).toBe(1)
  expect(await ui.find({ type: 'Text', text: 'Введи этот код на странице GitHub:' })).toBeDefined()
  await ui.unmount()
})

test('чаты без своего ника: экран просит взять @ник, список чатов не спрашиваем', HEAVY, async ($, on) => {
  const { api } = accountSite()
  const { clock, requests } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-chats' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Писать друзьям можно, когда у тебя есть @ник — сначала возьми свой.' })).toBeDefined()
  expect(requests.filter((r) => r.path.startsWith('api/me/chats'))).toEqual([])
  await ui.press({ key: 'arcade-chats-handle' })
  expect(await ui.find({ key: 'arcade-account-take' })).toMatchObject({ props: { label: 'Взять @octocat' } })
  await ui.unmount()
})

test('чаты: список, переписка, отправка, новые сообщения по таймеру, чат с другом, страница по коду ссылки', HEAVY, async ($, on) => {
  const { api, chats, state, post } = chatsSite()
  const { clock, requests, saved, launches } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  const T = Date.UTC(2026, 9, 23, 12)
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: string | RegExp) => ui.find({ type: 'Text', text: t })
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  // Поле «Сообщение» на экране одно; его номер меняется после каждой отправки
  const write = async (value: string) => {
    const field = await ui.find({ type: 'Input' })
    await ui.input({ key: field!.key!, text: value, kind: 'submit' })
    await clock.settle()
  }
  const messages = () => requests.filter((r) => r.path.startsWith('api/me/chats/messages?'))
  // Плитка: сколько непрочитанных — из /api/me
  expect(await text('  непрочитанных: 2')).toBeDefined()
  await press('arcade-menu-chats')
  expect(sent(requests, 'api/me/chats', 'GET').map((r) => r.headers.Authorization)).toEqual([`Bearer ${TOKEN}`])
  // Список: новые сверху, у чата — непрочитанные значком, под названием — последнее сообщение; служебное — словами;
  // друг в сети — ●
  expect(await ui.find({ key: `arcade-chat-open-${DM}` })).toMatchObject({ props: { label: '@octo_pal' } })
  expect(await ui.find({ key: `arcade-chat-open-${CLUB}` })).toMatchObject({ props: { label: 'club' } })
  expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.key).filter((k: string) => k.startsWith('arcade-chat-open-'))).toEqual([`arcade-chat-open-${DM}`, `arcade-chat-open-${CLUB}`])
  expect(await text(/^ 2 $/)).toBeDefined()
  expect(await text(/^●$/)).toBeDefined()
  expect(await text(/^hi! a game tonight\?$/)).toBeDefined()
  expect(await text(/^@octo_pal создал\(а\) группу «club»$/)).toBeDefined()
  expect(await text('Переписка хранится на сайте Arcade и не шифруется — не пиши туда пароли и ключи.')).toBeDefined()
  // Переписка: сайт отмечает прочитанным; под своим — время и ✓ (дошло до сайта), под чужим — только время; в шапке —
  // друг в сети
  await press(`arcade-chat-open-${DM}`)
  expect(messages().at(-1).path).toBe(`api/me/chats/messages?chat=${DM}`)
  expect(await text('hi! a game tonight?')).toBeDefined()
  expect(await text('ready?')).toBeDefined()
  expect(await text(new RegExp(`^${chatClock(T)} ✓$`))).toBeDefined()
  expect(await text(new RegExp(`^${chatClock(T + 120_000)}$`))).toBeDefined()
  expect(await text(/^в сети$/)).toBeDefined()
  expect(await text(/^── (Сегодня|Вчера|\d\d\.\d\d(\.\d{4})?) ──$/)).toBeDefined()
  expect(await ui.find({ type: 'Input' })).toMatchObject({ props: { label: 'Сообщение', submitLabel: 'Отправить' } })
  expect(await text('Переписка не шифруется — не пиши сюда пароли и ключи.')).toBeDefined()
  // Отправить: без пробелов по краям; поле — новое
  const before = (await ui.find({ type: 'Input' }))!.key
  await write('  sure, chess at 8  ')
  expect(sent(requests, 'api/me/chats/send', 'POST').at(-1)).toMatchObject({ body: { chat: DM, text: 'sure, chess at 8' }, headers: { Authorization: `Bearer ${TOKEN}` } })
  expect(await text('sure, chess at 8')).toBeDefined()
  expect((await ui.find({ type: 'Input' }))!.key).not.toBe(before)
  // Пустое не уходит, длинное — заметка здесь же
  await write('   ')
  await write('x'.repeat(2001))
  expect(sent(requests, 'api/me/chats/send', 'POST').length).toBe(1)
  expect(await text('Сообщение длиннее 2000 знаков.')).toBeDefined()
  // Новое от друга — по таймеру, только после последнего показанного
  post(chats[0], { f: '7', t: 'see you there' })
  await clock.advance(4_000)
  await clock.settle()
  expect(messages().at(-1).path).toBe(`api/me/chats/messages?chat=${DM}&after=4&edits=0`)
  expect(await text('see you there')).toBeDefined()
  // Больше не друг — писать нельзя
  state.unfriended = true
  await write('still there?')
  expect(await text('Писать можно только друзьям.')).toBeDefined()
  state.unfriended = false
  // Назад к списку: непрочитанных больше нет; последнее своё — с «ты:»
  await press('arcade-chats-back')
  expect(await ui.find({ key: `arcade-chat-open-${DM}` })).toMatchObject({ props: { label: '@octo_pal' } })
  expect(await text(/^ \d+ $/)).toBeUndefined()
  expect(await text(/^see you there$/)).toBeDefined()
  await press('arcade-back')
  expect(await text('  с друзьями: один на один и группы')).toBeDefined()
  // Новый чат с другом: сайт заводит его, переписка пустая
  await press('arcade-menu-chats')
  await press('arcade-chat-new')
  expect(sent(requests, 'api/me/friends', 'GET').length).toBe(1)
  expect(await ui.find({ key: 'arcade-chat-dm-7' })).toMatchObject({ props: { label: '@octo_pal' } })
  await press('arcade-chat-dm-21')
  expect(sent(requests, 'api/me/chats/open', 'POST').at(-1).body).toEqual({ with: '21' })
  expect(await text('@new_pal')).toBeDefined()
  expect(await text('Здесь пока пусто — напиши первым.')).toBeDefined()
  // «Открыть на странице»: сайт выдаёт код ссылки, ключ сессии в адрес не идёт; открытый чат — тоже в адресе
  await press('arcade-chats-page')
  expect(sent(requests, 'api/me/chats/ticket', 'POST').at(-1).body).toEqual({ link: true })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/chat#k=${LINK_CODE}&c=d21-583231`)
  expect(launches.at(-1).env.ARCADE_URL).not.toContain(TOKEN)
  expect(await text(/^Чаты открыты в /)).toBeDefined()
  // Вход больше не действует — забываем его; экран чатов зовёт войти
  state.gone = true
  await press('arcade-chats-back')
  expect(saved.has('account')).toBe(false)
  expect(await text('Вход на этом компьютере больше не действует — войди через GitHub заново.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-chats-login' })).toBeDefined()
  await ui.unmount()
})

test('чаты: у своего сообщения ⋮ — изменить и удалить у всех; правки и удаления друга приходят по таймеру', HEAVY, async ($, on) => {
  const { api, chats, change } = chatsSite()
  const { clock, requests } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  const T = Date.UTC(2026, 9, 23, 12)
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: string | RegExp) => ui.find({ type: 'Text', text: t })
  const key = (k: string) => ui.find({ key: k })
  const press = async (k: string) => {
    await ui.press({ key: k })
    await clock.settle()
  }
  const field = () => ui.find({ type: 'Input' })
  const write = async (value: string) => {
    await ui.input({ key: (await field())!.key!, text: value, kind: 'submit' })
    await clock.settle()
  }
  const edits = () => sent(requests, 'api/me/chats/edit', 'POST')
  const deletes = () => sent(requests, 'api/me/chats/delete', 'POST')
  await press('arcade-menu-chats')
  await press(`arcade-chat-open-${DM}`)
  // ⋮ — только у своих сообщений, тонкой кнопкой; меню закрыто, пока ⋮ не нажали, второй раз — закрывает
  expect(await key('arcade-msg-menu-1')).toMatchObject({ props: { label: '⋮', plain: true, dimColor: true } })
  expect([await key('arcade-msg-menu-2'), await key('arcade-msg-menu-3'), await key('arcade-msg-edit-1')]).toEqual([undefined, undefined, undefined])
  await press('arcade-msg-menu-1')
  expect(await key('arcade-msg-edit-1')).toMatchObject({ props: { label: 'Изменить', plain: true } })
  expect(await key('arcade-msg-delete-1')).toMatchObject({ props: { label: 'Удалить', plain: true } })
  await press('arcade-msg-menu-1')
  expect(await key('arcade-msg-edit-1')).toBeUndefined()
  // «Изменить»: текст — в поле внизу, кнопка — «Сохранить»; тот же текст — сайт не спрашиваем, поле снова для нового
  await press('arcade-msg-menu-1')
  await press('arcade-msg-edit-1')
  expect(await key('arcade-msg-edit-1')).toBeUndefined()
  expect(await field()).toMatchObject({ props: { label: 'Изменить сообщение', value: 'ready?', submitLabel: 'Сохранить' } })
  expect(await text('Правка сообщения')).toBeDefined()
  await write('ready?')
  expect(edits()).toEqual([])
  expect(await field()).toMatchObject({ props: { label: 'Сообщение', submitLabel: 'Отправить' } })
  expect((await field())!.props.value).toBeUndefined()
  expect(await text('Правка сообщения')).toBeUndefined()
  // Поправить: без пробелов по краям; у сообщения — «изменено»; список чатов — с сайта
  await press('arcade-msg-menu-1')
  await press('arcade-msg-edit-1')
  const lists = sent(requests, 'api/me/chats', 'GET').length
  await write('  ready at 8?  ')
  expect(edits()).toHaveLength(1)
  expect(edits()[0]).toMatchObject({ body: { chat: DM, s: 1, text: 'ready at 8?' }, headers: { Authorization: `Bearer ${TOKEN}` } })
  expect(await text('ready at 8?')).toBeDefined()
  expect(await text('ready?')).toBeUndefined()
  expect(await text(new RegExp(`^изменено ${chatClock(T)} ✓$`))).toBeDefined()
  expect(await field()).toMatchObject({ props: { label: 'Сообщение' } })
  expect(sent(requests, 'api/me/chats', 'GET').length).toBe(lists + 1)
  // Правку можно бросить: «Отмена» — поле снова для нового сообщения, сайт не спрашиваем
  await press('arcade-msg-menu-1')
  await press('arcade-msg-edit-1')
  await press('arcade-chat-edit-cancel')
  expect(await field()).toMatchObject({ props: { label: 'Сообщение' } })
  expect(edits()).toHaveLength(1)
  // «Удалить» спрашивает ещё раз; «Отмена» — сообщение на месте
  await write('one more')
  await press('arcade-msg-menu-4')
  await press('arcade-msg-delete-4')
  expect(await text('Удалить сообщение у всех?')).toBeDefined()
  expect(deletes()).toEqual([])
  await press('arcade-msg-delete-no-4')
  expect(await text('Удалить сообщение у всех?')).toBeUndefined()
  expect(await key('arcade-msg-delete-4')).toBeUndefined()
  expect(await text('one more')).toBeDefined()
  // Удалить у всех: сообщения больше нет на экране, ⋮ у него тоже
  await press('arcade-msg-menu-4')
  await press('arcade-msg-delete-4')
  await press('arcade-msg-delete-yes-4')
  expect(deletes()).toHaveLength(1)
  expect(deletes()[0]).toMatchObject({ body: { chat: DM, s: 4 } })
  expect(await text('one more')).toBeUndefined()
  expect(await key('arcade-msg-menu-4')).toBeUndefined()
  expect(await text('ready at 8?')).toBeDefined()
  // Друг поправил одно и удалил другое — по таймеру, вместе с номером правки, которую мод уже видел
  change(chats[0], 3, 'hi! a game at 9?')
  change(chats[0], 2, null)
  await clock.advance(4_000)
  await clock.settle()
  expect(requests.some((r) => r.path.startsWith(`api/me/chats/messages?chat=${DM}&after=4&edits=`))).toBe(true)
  expect(await text('hi! a game at 9?')).toBeDefined()
  expect(await text(new RegExp(`^изменено ${chatClock(T + 120_000)}$`))).toBeDefined()
  expect(await text('almost')).toBeUndefined()
  await clock.advance(4_000)
  await clock.settle()
  expect(requests.filter((r) => r.path.startsWith('api/me/chats/messages?')).at(-1).path).toBe(`api/me/chats/messages?chat=${DM}&after=4&edits=4`)
  // Своё сообщение удалили в другом окне, пока оно правилось: сайт отказал — заметка; таймер закрывает правку
  await press('arcade-msg-menu-1')
  await press('arcade-msg-edit-1')
  change(chats[0], 1, null)
  await write('ready at 9?')
  expect(edits()).toHaveLength(2)
  expect(await text('Этого сообщения уже нет.')).toBeDefined()
  expect(await field()).toMatchObject({ props: { label: 'Изменить сообщение' } })
  await clock.advance(4_000)
  await clock.settle()
  expect(await field()).toMatchObject({ props: { label: 'Сообщение' } })
  expect(await text('ready at 8?')).toBeUndefined()
  // В списке чатов последнее — последнее неудалённое
  await press('arcade-chats-back')
  expect(await text(/^hi! a game at 9\?$/)).toBeDefined()
  await ui.unmount()
})

test('чаты: группа из отмеченных друзей, участники, название, выйти, группа со всеми друзьями', HEAVY, async ($, on) => {
  const { api, chats } = chatsSite()
  const { clock, requests } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: string | RegExp) => ui.find({ type: 'Text', text: t })
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  const field = async () => (await ui.find({ type: 'Input' }))!.key!
  const members = () => sent(requests, 'api/me/chats/members', 'POST').map((r) => r.body)
  await press('arcade-menu-chats')
  await press('arcade-chat-new')
  // Сначала — отметить друзей и назвать группу; без этого сайт не спрашиваем
  await press('arcade-chat-create')
  expect(await text('Отметь хотя бы одного друга.')).toBeDefined()
  await press('arcade-chat-pick-7')
  expect(await ui.find({ key: 'arcade-chat-pick-7' })).toMatchObject({ props: { label: '☑ @octo_pal' } })
  expect(await ui.find({ key: 'arcade-chat-pick-21' })).toMatchObject({ props: { label: '☐ @new_pal' } })
  await press('arcade-chat-create')
  expect(await text('Назови группу.')).toBeDefined()
  expect(sent(requests, 'api/me/chats/group', 'POST')).toEqual([])
  await ui.input({ key: await field(), text: '  chess\nclub  ', kind: 'change' })
  await press('arcade-chat-create')
  expect(sent(requests, 'api/me/chats/group', 'POST').at(-1).body).toEqual({ name: 'chess club', members: ['7'] })
  const group = chats.at(-1).id
  expect(await text('chess club')).toBeDefined()
  expect(await text('участники: 2')).toBeDefined()
  expect(await text('@octocat создал(а) группу «chess club»')).toBeDefined()
  // Участники: хозяин добавляет друзей, убирает людей и переименовывает
  await press('arcade-chat-members')
  expect(await text('Участники')).toBeDefined()
  expect(await text('управляет группой')).toBeDefined()
  expect(await ui.find({ key: 'arcade-chat-remove-7' })).toMatchObject({ props: { label: 'Убрать' } })
  expect(await ui.find({ key: 'arcade-chat-remove-583231' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-chat-add-21' })).toMatchObject({ props: { label: '+ @new_pal' } })
  await press('arcade-chat-add-21')
  expect(members().at(-1)).toEqual({ chat: group, add: ['21'] })
  expect(await text('Участник добавлен.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-chat-add-21' })).toBeUndefined()
  await press('arcade-chat-remove-7')
  expect(members().at(-1)).toEqual({ chat: group, remove: ['7'] })
  expect(await text('Участник убран.')).toBeDefined()
  expect(await ui.find({ type: 'Input' })).toMatchObject({ props: { label: 'Переименовать', placeholder: 'chess club' } })
  await ui.input({ key: await field(), text: 'chess club', kind: 'submit' })
  await clock.settle()
  expect(members().length).toBe(2) // то же название — сайт не спрашиваем
  await ui.input({ key: await field(), text: 'club 2', kind: 'submit' })
  await clock.settle()
  expect(members().at(-1)).toEqual({ chat: group, name: 'club 2' })
  expect(await text('Название группы изменено.')).toBeDefined()
  // В переписке — что было, словами
  await press('arcade-back')
  expect(await text('club 2')).toBeDefined()
  expect(await text('@octocat добавил(а) @new_pal')).toBeDefined()
  expect(await text('@octocat убрал(а) @octo_pal')).toBeDefined()
  expect(await text('@octocat назвал(а) группу «club 2»')).toBeDefined()
  // Чужая группа: управлять нельзя, выйти — со второго нажатия
  await press('arcade-chats-back')
  await press(`arcade-chat-open-${CLUB}`)
  await press('arcade-chat-members')
  expect(await ui.find({ type: 'Input' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-chat-remove-7' })).toBeUndefined()
  await press('arcade-chat-leave')
  expect(await ui.find({ key: 'arcade-chat-leave' })).toMatchObject({ props: { label: 'Точно выйти? Нажми ещё раз' } })
  expect(members().length).toBe(3)
  await press('arcade-chat-leave')
  expect(members().at(-1)).toEqual({ chat: CLUB, leave: true })
  expect(await text('Ты больше не в этой группе.')).toBeDefined()
  expect(await ui.find({ key: `arcade-chat-open-${CLUB}` })).toBeUndefined()
  // Группа со всеми друзьями: название — «Все друзья», если своего не вписали
  await press('arcade-chat-new')
  await press('arcade-chat-all')
  expect(sent(requests, 'api/me/chats/group', 'POST').at(-1).body).toEqual({ name: 'Все друзья', all: true })
  expect(await text('Все друзья')).toBeDefined()
  expect(await text('участники: 3')).toBeDefined()
  await ui.unmount()
})

test('Desktop: чаты открываются на странице во встроенном браузере Claude, панель Arcade уступает место', HEAVY, async ($, on) => {
  const { api } = chatsSite()
  const { clock, browserCalls, closed, launches } = stubs(on, { api, browser: 'ok', stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-chats' })
  await clock.settle()
  expect(await ui.find({ key: `arcade-chat-open-${DM}` })).toMatchObject({ props: { label: '@octo_pal' } })
  // Картинки: у друга — его аватарка, у группы без картинки — буква названия
  const sources = (await ui.findAll({ type: 'Svg' })).map((s: any) => s.props.source)
  expect(sources).toContain(avatarSvg(4))
  expect(sources).toContain(letterSvg('club', CLUB))
  await ui.press({ key: 'arcade-chats-page' })
  await clock.settle()
  expect(browserCalls.length).toBe(1)
  expect(browserCalls[0]).toMatchObject({ server: 'Claude_Browser', tool: 'preview_start', args: { url: `${SITE}/chat#k=${LINK_CODE}` } })
  expect(closed).toEqual(['arcade'])
  expect(launches.length).toBe(0)
  expect(await ui.find({ type: 'Text', text: 'Чаты открыты во встроенном браузере Claude.' })).toBeDefined()
  await ui.unmount()
})

test('Desktop, широкая панель: список чатов слева не пропадает, переписка, новый чат и участники — справа; узкая — по очереди', HEAVY, async ($, on) => {
  const { api } = chatsSite()
  const { clock } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = (t: string | RegExp) => ui.find({ type: 'Text', text: t })
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  const picked = async (id: string) => (await ui.find({ key: `chat-row-${id}` }))!.props.backgroundColor
  await press('arcade-menu-chats')
  // Чат не выбран: слева список и «Новый чат» главной кнопкой, справа — подсказка
  expect(await text('Выбери чат слева или начни новый.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-chat-new' })).toMatchObject({ props: { variant: 'primary' } })
  expect(await text(' 2 ')).toBeDefined()
  // Открыл чат с другом — список на месте, «← Чаты» не нужна; открытый подсвечен, его непрочитанные прочитаны
  await press(`arcade-chat-open-${DM}`)
  expect(await ui.find({ type: 'Input' })).toMatchObject({ props: { label: 'Сообщение' } })
  expect(await ui.find({ key: 'arcade-chats-back' })).toBeUndefined()
  expect(await ui.find({ key: `arcade-chat-open-${CLUB}` })).toBeDefined()
  expect(await picked(DM)).toBeDefined()
  expect(await picked(CLUB)).toBeUndefined()
  expect(await text(' 2 ')).toBeUndefined()
  // Отправил — в списке слева сразу «ты: …»
  await ui.input({ key: (await ui.find({ type: 'Input' }))!.key!, text: 'see you at 8', kind: 'submit' })
  await clock.settle()
  expect(await text(/^ты: see you at 8$/)).toBeDefined()
  // Другой чат — прямо из списка; участники группы — тоже справа, а нажать на открытый чат — снова к переписке
  await press(`arcade-chat-open-${CLUB}`)
  expect(await picked(CLUB)).toBeDefined()
  expect(await picked(DM)).toBeUndefined()
  await press('arcade-chat-members')
  expect(await text(/^управляет группой$/)).toBeDefined()
  expect(await ui.find({ key: `arcade-chat-open-${DM}` })).toBeDefined()
  await press(`arcade-chat-open-${CLUB}`)
  expect(await ui.find({ key: 'arcade-chat-members' })).toBeDefined()
  // «Новый чат» — справа, список остаётся; «← Назад» — в главное меню
  await press('arcade-chat-new')
  expect(await ui.find({ key: 'arcade-chat-dm-21' })).toBeDefined()
  expect(await ui.find({ key: `arcade-chat-open-${DM}` })).toBeDefined()
  await press('arcade-back')
  expect(await ui.find({ key: 'arcade-menu-chats' })).toBeDefined()
  await ui.unmount()
  // Узкая панель — как раньше, по очереди: в переписке списка нет, «← Чаты» — к нему
  const narrow = await $.ui.mount({ ...PANE, surface: 'desktop', viewport: { columns: 60, rows: 40 } })
  await narrow.press({ key: 'arcade-menu-chats' })
  await clock.settle()
  expect(await narrow.find({ type: 'Text', text: 'Выбери чат слева или начни новый.' })).toBeUndefined()
  await narrow.press({ key: `arcade-chat-open-${DM}` })
  await clock.settle()
  expect(await narrow.find({ key: 'arcade-chats-back' })).toBeDefined()
  expect(await narrow.find({ key: `arcade-chat-open-${CLUB}` })).toBeUndefined()
  await narrow.unmount()
})

test('чаты по-английски: экраны, служебные сообщения и плитка без русских букв', HEAVY, async ($, on) => {
  const { api } = chatsSite()
  const { clock, requests, launches } = stubs(on, { env: { ...WINDOWS, LANG: 'en_US.UTF-8' }, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const cyrillic = async () => (await drawnTexts(ui)).filter((x) => /[А-Яа-яЁё]/.test(x) && x !== '🌐 Русский')
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  expect(await ui.find({ key: 'arcade-menu-chats' })).toMatchObject({ props: { label: 'Chats' } })
  expect(await ui.find({ type: 'Text', text: '  unread: 2' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await press('arcade-menu-chats')
  expect(await ui.find({ type: 'Text', text: /^@octo_pal created the group “club”$/ })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await press(`arcade-chat-open-${DM}`)
  expect(await ui.find({ type: 'Input' })).toMatchObject({ props: { label: 'Message', submitLabel: 'Send' } })
  expect(await cyrillic()).toEqual([])
  // Меню своего сообщения, правка, «изменено» и вопрос перед удалением
  await press('arcade-msg-menu-1')
  expect(await ui.find({ key: 'arcade-msg-edit-1' })).toMatchObject({ props: { label: 'Edit' } })
  expect(await ui.find({ key: 'arcade-msg-delete-1' })).toMatchObject({ props: { label: 'Delete' } })
  await press('arcade-msg-edit-1')
  expect(await ui.find({ type: 'Input' })).toMatchObject({ props: { label: 'Edit message', submitLabel: 'Save' } })
  expect(await ui.find({ type: 'Text', text: 'Editing a message' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  const field = await ui.find({ type: 'Input' })
  await ui.input({ key: field!.key!, text: 'ready!', kind: 'submit' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: /^edited \d\d:\d\d ✓$/ })).toBeDefined()
  await press('arcade-msg-menu-1')
  await press('arcade-msg-delete-1')
  expect(await ui.find({ type: 'Text', text: 'Delete the message for everyone?' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-msg-delete-no-1' })).toMatchObject({ props: { label: 'Cancel' } })
  expect(await cyrillic()).toEqual([])
  await press('arcade-msg-delete-no-1')
  await press('arcade-chats-page')
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/chat?lang=en#k=${LINK_CODE}&c=${DM}`)
  expect(await cyrillic()).toEqual([])
  await press('arcade-chats-back')
  await press('arcade-chat-new')
  expect(await cyrillic()).toEqual([])
  await press('arcade-chat-all')
  expect(sent(requests, 'api/me/chats/group', 'POST').at(-1).body).toEqual({ name: 'All friends', all: true })
  expect(await ui.find({ type: 'Text', text: '@octocat created the group “All friends”' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'members: 3' })).toBeDefined()
  await press('arcade-chat-members')
  expect(await cyrillic()).toEqual([])
  await ui.unmount()
})

test('avatars.js: 24 картинки, номер — целое 0–23, буква и цвет от ника, подписи на двух языках', () => {
  expect(AVATAR_COUNT).toBe(24)
  expect([0, 23].every(validPic)).toBe(true)
  expect([-1, 24, 1.5, '3', null, undefined, NaN].some(validPic)).toBe(false)
  // Каждая — свой SVG-документ в круге, без скриптов и ссылок наружу
  const all = Array.from({ length: AVATAR_COUNT }, (_, n) => avatarSvg(n))
  expect(new Set(all).size).toBe(AVATAR_COUNT)
  for (const svg of all) {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"')).toBe(true)
    expect(svg).not.toMatch(/<script|href=|on\w+=/i)
  }
  expect(avatarSvg(99)).toBe(avatarSvg(0))
  // Буква: без @, заглавная; нет букв — «?»; разметка в нике не ломает картинку
  expect([initial('@octocat'), initial('  fefa'), initial(''), initial(null), initial('😀x')]).toEqual(['O', 'F', '?', '?', '😀'])
  expect(letterColor('octocat')).toBe(letterColor('octocat'))
  expect(letterColor('octocat')).toMatch(/^#[0-9A-F]{6}$/)
  expect(letterSvg('<b>&"x')).toContain('>&#60;</text>')
  expect(letterSvg('<b>&"x')).not.toContain('<b>')
  expect(picSvg(5, 'octocat', 'octocat')).toBe(avatarSvg(5))
  expect(picSvg(null, 'octocat', 'octocat')).toBe(letterSvg('octocat'))
  expect(picSvg(24, 'club', CLUB)).toBe(letterSvg('club', CLUB))
  expect([avatarName(0, 'ru'), avatarName(0, 'en'), avatarName(0, 'de'), avatarName(24, 'ru')]).toEqual(['кот', 'cat', 'cat', ''])
  expect(Array.from({ length: AVATAR_COUNT }, (_, n) => avatarName(n, 'en')).every(Boolean)).toBe(true)
})

test('popup.js: карточка о сообщении — XAML аватарок, команда для Windows, macOS и Linux, о чём уже всплывало', () => {
  // Все 24 переводятся в XAML; непонятное в SVG — null, тогда буква
  for (let n = 0; n < AVATAR_COUNT; n++) expect(svgToXaml(avatarSvg(n))).toMatch(/^<Viewbox|^<Grid|^<Canvas/)
  expect(svgToXaml('<svg><script>x</script></svg>')).toBeNull()
  expect(svgToXaml('<svg><image href="x"/></svg>')).toBeNull()
  expect(avatarXaml(3, 'octo_pal')).toBe(svgToXaml(avatarSvg(3)))
  expect(avatarXaml(null, 'octo_pal')).toBe(letterXaml('octo_pal'))
  expect(letterXaml('<x>&"', 'g1')).toContain('Text="&#60;"')
  expect(letterXaml('club', CLUB)).toContain(`Fill="${letterColor(CLUB)}"`)
  // Windows: своё окно поверх всех, текст — через переменные окружения, не в команде
  const win = popupCommand('windows', { title: '@octo_pal', text: 'hi\u0007 there', pic: letterXaml('octo_pal'), slot: 1 })!
  expect(win.argv.slice(0, 2)).toEqual(['powershell.exe', '-NoProfile'])
  expect(win.argv.join(' ')).not.toContain('octo_pal')
  expect(win.env).toEqual({ ARCADE_POPUP_TITLE: '@octo_pal', ARCADE_POPUP_TEXT: 'hi  there', ARCADE_POPUP_PIC: letterXaml('octo_pal'), ARCADE_POPUP_SLOT: '1' })
  expect(POPUP_SCRIPT_TEXT).toContain('Topmost')
  expect(POPUP_SCRIPT_TEXT).toContain('$env:ARCADE_POPUP_TITLE')
  // Длинное — обрезано с «…»
  const long = popupCommand('windows', { title: 'x'.repeat(200), text: 'й'.repeat(500) })!
  expect([...long.env.ARCADE_POPUP_TITLE].length).toBe(POPUP_TITLE_MAX)
  expect([...long.env.ARCADE_POPUP_TEXT].length).toBe(POPUP_TEXT_MAX)
  expect(long.env.ARCADE_POPUP_TEXT.endsWith('…')).toBe(true)
  expect(long.env.ARCADE_POPUP_SLOT).toBe('0')
  // macOS и Linux — системное уведомление от имени Arcade, текст — отдельными аргументами
  expect(popupCommand('mac', { title: '@octo_pal', text: 'hi' })).toEqual({
    argv: ['osascript', '-e', 'on run argv', '-e', 'display notification (item 2 of argv) with title (item 1 of argv) subtitle "Arcade" sound name "Glass"', '-e', 'end run', '@octo_pal', 'hi'],
    env: {},
  })
  expect(popupCommand('linux', { title: 'club', text: '@octo_pal: hi' })).toEqual({ argv: ['notify-send', '--app-name=Arcade', 'club', '@octo_pal: hi'], env: {} })
  expect(popupCommand('', { title: 'x', text: 'y' })).toBeNull()
  // О чём уже всплывало: только номера чатов и время; не больше POPPED_KEPT — самые свежие
  expect(restorePopped({ [DM]: 5, [CLUB]: 'x', nope: 1 })).toEqual({ [DM]: 5 })
  expect([restorePopped(null), restorePopped([1]), restorePopped('x')]).toEqual([{}, {}, {}])
  const many = Object.fromEntries(Array.from({ length: POPPED_KEPT + 20 }, (_, k) => [`g${String(k).padStart(16, '0')}`, k]))
  const kept = keepPopped(many)
  expect(Object.keys(kept).length).toBe(POPPED_KEPT)
  expect(Math.min(...Object.values(kept))).toBe(20)
  // Пора всплыть: непрочитанное, последнее — не своё и новее того, о котором всплывало; по порядку прихода
  const list = [
    { id: 'd1-2', unread: 1, at: 30, last: { f: '2', t: 'a' } },
    { id: 'd1-3', unread: 1, at: 10, last: { f: '3', t: 'b' } },
    { id: 'd1-4', unread: 0, at: 40, last: { f: '4', t: 'c' } },
    { id: 'd1-5', unread: 1, at: 50, last: { f: '1', t: 'mine' } },
    { id: 'd1-6', unread: 2, at: 20, last: { f: '6', t: 'old' } },
    { id: 'd1-7', unread: 1, at: 60 },
  ]
  expect(popupChats(list, '1', { 'd1-6': 20 }).map((c: any) => c.id)).toEqual(['d1-3', 'd1-2'])
})

test('аватарка: выбирают только в «Аккаунте» — номер уходит на сайт; чаты её только показывают', HEAVY, async ($, on) => {
  const { api, state } = chatsSite()
  const { clock, requests } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  const avatars = () => sent(requests, 'api/me/avatar', 'PUT')
  await press('arcade-menu-account')
  // 24 картинки с подписями и «Без аватарки»; пока не выбрал — отмечено «без», рядом с «Аватарка» — буква ника
  expect(await ui.find({ type: 'Text', text: /^Аватарка$/ })).toBeDefined()
  expect(await ui.find({ key: 'arcade-avatar-0' })).toMatchObject({ props: { label: 'кот' } })
  expect(await ui.find({ key: 'arcade-avatar-23' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-avatar-24' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-avatar-none' })).toMatchObject({ props: { label: 'Без аватарки', variant: 'primary' } })
  expect((await ui.findAll({ type: 'Svg' })).map((s: any) => s.props.source)).toContain(letterSvg('octocat'))
  // Выбрал — номер на сайт с ключом сессии; та же ещё раз — сайт не спрашиваем
  await press('arcade-avatar-5')
  expect(avatars().map((r) => [r.body, r.headers.Authorization])).toEqual([[{ pic: 5 }, `Bearer ${TOKEN}`]])
  expect(await ui.find({ key: 'arcade-avatar-5' })).toMatchObject({ props: { variant: 'primary' } })
  expect((await ui.find({ key: 'arcade-avatar-none' }))!.props.variant).toBeUndefined()
  await press('arcade-avatar-5')
  expect(avatars().length).toBe(1)
  // Сайт: «слишком часто» — так и говорим, выбранная остаётся
  state.avatarBusy = true
  await press('arcade-avatar-6')
  expect(await ui.find({ type: 'Text', text: 'Аватарку меняли слишком часто — подожди минуту.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-avatar-5' })).toMatchObject({ props: { variant: 'primary' } })
  state.avatarBusy = false
  // Чаты: своей аватарки там не выбрать, а показывается она — у себя среди участников группы
  await press('arcade-back')
  await press('arcade-menu-chats')
  expect((await ui.findAll({})).some((x: any) => x.key?.startsWith('arcade-avatar-'))).toBe(false)
  await press(`arcade-chat-open-${CLUB}`)
  await press('arcade-chat-members')
  expect((await ui.findAll({ type: 'Svg' })).map((s: any) => s.props.source)).toEqual(expect.arrayContaining([avatarSvg(5), avatarSvg(4)]))
  expect((await ui.findAll({})).some((x: any) => x.key?.startsWith('arcade-avatar-'))).toBe(false)
  // Не хозяин группы — и её картинку не выбрать
  expect(await ui.find({ key: 'arcade-chat-pic-0' })).toBeUndefined()
  expect(avatars().length).toBe(2)
  await ui.unmount()
})

test('Desktop: аккаунт — аватарки плитками одного размера, подписи в две строки; синхронизация, выход и удаление — карточками', HEAVY, async ($, on) => {
  const { api } = chatsSite()
  const { clock } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-account' })
  await clock.settle()
  // Группы под заголовками, как в настройках
  for (const title of ['Аватарка', 'Синхронизация и вход']) expect(await ui.find({ type: 'Text', text: title })).toMatchObject({ props: { size: 'heading' } })
  // Каждая аватарка и «Без аватарки» — плитка в рамке одного размера; выбранная — в рамке цвета выбора
  const frames = (await ui.findAll({})).filter((x: any) => /^card-arcade-avatar-/.test(x.key ?? ''))
  expect(frames.length).toBe(25)
  expect(new Set(frames.map((x: any) => `${x.props.borderStyle} ${x.props.width}×${x.props.minHeight}`))).toEqual(new Set(['round 16×6']))
  expect(await ui.find({ key: 'card-arcade-avatar-none' })).toMatchObject({ props: { borderColor: 'suggestion' } })
  expect(await ui.find({ key: 'card-arcade-avatar-5' })).toMatchObject({ props: { borderColor: 'subtle' } })
  // На «Без аватарки» — буква ника, как будет без неё
  expect(JSON.stringify(await ui.find({ key: 'card-arcade-avatar-none' }))).toContain(JSON.stringify(letterSvg('octocat')))
  // Длинное название переносится внутри плитки, а не раздвигает её
  const bun = JSON.stringify(await ui.find({ key: 'card-arcade-avatar-13' }))
  expect(bun).toContain('"wrap":"wrap"')
  expect(bun).toContain('девушка с пучком')
  await ui.press({ key: 'arcade-avatar-5' })
  await clock.settle()
  expect(await ui.find({ key: 'card-arcade-avatar-5' })).toMatchObject({ props: { borderColor: 'suggestion' } })
  expect(await ui.find({ key: 'card-arcade-avatar-none' })).toMatchObject({ props: { borderColor: 'subtle' } })
  // Синхронизировать, выйти и удалить — карточки со своими иконками и описанием, как в меню
  const cards = ['arcade-account-sync', 'arcade-account-logout', 'arcade-account-delete'].map(async (key) => JSON.stringify(await ui.find({ key: `card-${key}` })))
  const [sync, logout, remove] = await Promise.all(cards)
  expect(sync).toContain('"alt":"Синхронизировать сейчас"')
  expect(sync).toContain('Настройки синхронизированы.')
  expect(logout).toContain('на этом компьютере; настройки останутся здесь как есть')
  expect(remove).toContain('сайт Arcade забудет тебя и твои настройки; здесь всё останется')
  // Иконка — первая картинка карточки; у трёх они разные, а не джойстик по умолчанию
  const icon = (card: string) => /"source":"((?:[^"\\]|\\.)*)"/.exec(card)![1]
  expect(new Set([sync, logout, remove].map(icon)).size).toBe(3)
  expect(await ui.find({ key: 'arcade-account-sync' })).toMatchObject({ props: { autoFocus: true } })
  await ui.unmount()
  // В VS Code — те же плитки аватарок с переносом подписи
  const code = await $.ui.mount({ ...PANE, surface: 'vscode' })
  expect(await code.find({ key: 'card-arcade-avatar-13' })).toMatchObject({ props: { width: 16 } })
  expect(JSON.stringify(await code.find({ key: 'arcade-avatar-13' }))).toContain('"wrap":"wrap"')
  await code.unmount()
})

test('картинка группы: ставит и убирает только хозяин, в переписке — служебной строкой', HEAVY, async ($, on) => {
  const { api, chats } = chatsSite()
  const { clock, requests } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = (t: string | RegExp) => ui.find({ type: 'Text', text: t })
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  const members = () => sent(requests, 'api/me/chats/members', 'POST').map((r) => r.body)
  // Своя группа: создал — хозяин
  await press('arcade-menu-chats')
  await press('arcade-chat-new')
  await press('arcade-chat-pick-7')
  await ui.input({ key: (await ui.find({ type: 'Input' }))!.key!, text: 'club 2', kind: 'change' })
  await press('arcade-chat-create')
  const group = chats.at(-1).id
  await press('arcade-chat-members')
  expect(await text(/^Картинка группы$/)).toBeDefined()
  expect(await ui.find({ key: 'arcade-chat-pic-none' })).toMatchObject({ props: { label: 'Без картинки', variant: 'primary' } })
  // Картинки группы — те же плитки в рамках, что у аватарок
  expect(await ui.find({ key: 'card-arcade-chat-pic-3' })).toMatchObject({ props: { borderStyle: 'round', width: 16 } })
  expect(JSON.stringify(await ui.find({ key: 'card-arcade-chat-pic-none' }))).toContain('"alt":"Без картинки"')
  await press('arcade-chat-pic-3')
  expect(members().at(-1)).toEqual({ chat: group, pic: 3 })
  expect(await text('Картинка группы изменена.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-chat-pic-3' })).toMatchObject({ props: { variant: 'primary' } })
  // Та же ещё раз — сайт не спрашиваем; «Без картинки» — убрать
  await press('arcade-chat-pic-3')
  expect(members().length).toBe(1)
  await press('arcade-chat-pic-none')
  expect(members().at(-1)).toEqual({ chat: group, pic: null })
  expect(await ui.find({ key: 'arcade-chat-pic-none' })).toMatchObject({ props: { variant: 'primary' } })
  await press('arcade-back')
  expect(await text(/^@octocat сменил\(а\) картинку группы$/)).toBeDefined()
  expect(await text(/^@octocat убрал\(а\) картинку группы$/)).toBeDefined()
  // Группа с картинкой — она в шапке и в списке; чужая группа — картинку не выбрать
  await press('arcade-chat-members')
  await press('arcade-chat-pic-7')
  await press('arcade-back')
  expect((await ui.findAll({ type: 'Svg' })).map((s: any) => s.props.source)).toContain(avatarSvg(7))
  await ui.input({ key: (await ui.find({ type: 'Input' }))!.key!, text: 'hi all', kind: 'submit' })
  await clock.settle()
  // В списке слева от переписки: картинка группы, под названием своё — с «ты:»
  expect(await ui.find({ key: 'arcade-chats-back' })).toBeUndefined()
  expect((await ui.findAll({ type: 'Svg' })).filter((s: any) => s.props.source === avatarSvg(7)).length).toBe(2)
  expect(await text(/^ты: hi all$/)).toBeDefined()
  await press(`arcade-chat-open-${CLUB}`)
  await press('arcade-chat-members')
  expect(await ui.find({ key: 'arcade-chat-pic-0' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-chat-pic-none' })).toBeUndefined()
  expect(members().length).toBe(3)
  await ui.unmount()
})

test('уведомления о сообщениях: первый раз — только запомнить, новое — карточка, клик открывает чат; открытый чат и уже всплывшее — нет; выключаются в «Настройках»', HEAVY, async ($, on) => {
  const { api, chats, post } = chatsSite({ pulse: true })
  const T = Date.UTC(2026, 9, 23, 12)
  let answer = ''
  const { clock, requests, popups, saved, opened } = stubs(on, { env: WINDOWS, api, popupAnswer: () => answer, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  // Наблюдатель — раз в 20 с; карточка запускается следующим тиком часов
  const poll = async () => {
    await clock.advance(20_000)
    await clock.settle()
    await clock.advance(1)
    await clock.settle()
  }
  const lists = () => sent(requests, 'api/me/chats', 'GET').length
  const counts = () => sent(requests, 'api/me/chats/unread', 'GET').length
  const say = (k: number, at: number, t: string) => {
    post(chats[k], { at, f: '7', t })
    chats[k].unread++
  }
  // Первый раз: два непрочитанных уже были — запомнить, не всплывать
  await poll()
  expect(counts()).toBe(1)
  expect(lists()).toBe(1)
  expect(popups).toEqual([])
  expect(saved.get('chatPopups')).toEqual({ [DM]: T + 120_000 })
  // Столько же непрочитанных — список чатов не спрашиваем
  await poll()
  expect(counts()).toBe(2)
  expect(lists()).toBe(1)
  // Новое в группе — карточка: название группы, ник автора и текст, буква названия; места — снизу вверх
  say(1, T + 7_200_000, 'who is in for chess?')
  await poll()
  expect(popups.length).toBe(1)
  expect(popups[0].env).toEqual({ ARCADE_POPUP_TITLE: 'club', ARCADE_POPUP_TEXT: '@octo_pal: who is in for chess?', ARCADE_POPUP_PIC: letterXaml('club', CLUB), ARCADE_POPUP_SLOT: '0' })
  expect(popups[0].argv[0]).toBe('powershell.exe')
  expect(saved.get('chatPopups')).toEqual({ [DM]: T + 120_000, [CLUB]: T + 7_200_000 })
  // Новое от друга — его ник и аватарка; клик по карточке открывает панель на этом чате
  answer = 'open'
  say(0, T + 7_300_000, 'are you there?')
  await poll()
  expect(popups.length).toBe(2)
  expect(popups[1].env).toMatchObject({ ARCADE_POPUP_TITLE: '@octo_pal', ARCADE_POPUP_TEXT: 'are you there?', ARCADE_POPUP_PIC: avatarXaml(4, 'octo_pal') })
  expect(opened.at(-1)).toBe('arcade')
  expect(sent(requests, `api/me/chats/messages?chat=${DM}`, 'GET').length).toBe(1)
  answer = ''
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^are you there\?$/ })).toBeDefined()
  expect(await ui.find({ type: 'Input' })).toMatchObject({ props: { label: 'Сообщение' } })
  // Чат открыт на экране — о нём не всплываем
  say(0, T + 7_400_000, 'hello?')
  await poll()
  expect(popups.length).toBe(2)
  // Уже всплыло в другой сессии Claude Code ($.store) — не повторяем
  saved.set('chatPopups', { ...(saved.get('chatPopups') as any), [CLUB]: T + 7_500_000 })
  say(1, T + 7_500_000, 'anyone?')
  await poll()
  expect(popups.length).toBe(2)
  // Выключил в «Настройках» — карточек нет
  await ui.press({ key: 'arcade-chats-back' })
  await clock.settle()
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-msg-notify' })).toMatchObject({ props: { label: 'Уведомления о сообщениях: да' } })
  expect(await ui.find({ type: 'Text', text: '  всплывают внизу слева поверх всех окон; клик открывает чат' })).toBeDefined()
  await ui.press({ key: 'arcade-msg-notify' })
  expect(await ui.find({ key: 'arcade-msg-notify' })).toMatchObject({ props: { label: 'Уведомления о сообщениях: нет' } })
  expect(saved.get('msgNotify')).toBe(false)
  await ui.unmount()
  say(1, T + 7_600_000, 'last call')
  await poll()
  expect(popups.length).toBe(2)
})

test('уведомления о сообщениях: выключенные с прошлого раза так и остаются — сайт о непрочитанных не спрашиваем', HEAVY, async ($, on) => {
  const { api } = chatsSite({ pulse: true })
  const { clock, requests, popups } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO }, msgNotify: false } })
  await start($)
  await clock.advance(3_200)
  await clock.advance(60_000)
  await clock.settle()
  expect(sent(requests, 'api/me/chats/unread', 'GET')).toEqual([])
  expect(popups).toEqual([])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-msg-notify' })).toMatchObject({ props: { label: 'Уведомления о сообщениях: нет' } })
  await ui.unmount()
})

test('уведомления о сообщениях по-английски и на Linux: системное уведомление от имени Arcade', HEAVY, async ($, on) => {
  const { api, chats, post } = chatsSite()
  const { clock, popups } = stubs(on, { env: { LANG: 'en_US.UTF-8' }, uname: 'Linux', api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  await clock.advance(20_000)
  await clock.settle()
  post(chats[1], { at: Date.UTC(2026, 9, 23, 15), f: '7', t: 'chess?' })
  chats[1].unread = 1
  await clock.advance(20_000)
  await clock.settle()
  await clock.advance(1)
  await clock.settle()
  expect(popups.map((p) => p.argv)).toEqual([['notify-send', '--app-name=Arcade', 'club', '@octo_pal: chess?']])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-msg-notify' })).toMatchObject({ props: { label: 'Message notifications: on' } })
  expect(await ui.find({ type: 'Text', text: 'a system notification when a friend writes in a chat' })).toBeDefined()
  await ui.unmount()
})

// --- 0.25: разделы главного меню, поиск и избранное ---

test('find.js: без регистра и диакритики, сначала совпадения в начале названия; избранное — без повторов и не больше лимита', () => {
  expect(fold('Шерлок ÉCOLE Ёлка')).toBe('шерлок ecole елка')
  expect(queryWords('  Шерлок, Холмс! ')).toEqual(['шерлок', 'холмс'])
  expect(queryWords(' , ')).toEqual([])
  expect(rank(['Sherlock Holmes', 'Arthur Conan Doyle'], 'sher')).toBe(0)
  expect(rank(['The Adventures of Sherlock Holmes'], 'sherlock holmes')).toBe(1)
  expect(rank(['Holmes and Sherlock'], 'sherlock holmes')).toBe(2)
  expect(rank(['Emma', 'Jane Austen', 'роман'], 'austen')).toBe(3)
  expect(rank(['Emma', 'Jane Austen'], 'emma tolstoy')).toBe(-1) // найтись должно каждое слово
  expect(rank(['Ёжик в тумане'], 'ежик')).toBe(0)
  expect(rank(['Emma'], '  ')).toBe(-1)
  const list = [{ t: 'The Sherlock' }, { t: 'Doyle', a: 'sherlock fan' }, { t: 'Sherlock' }, { t: 'Emma' }]
  expect(find(list, 'sherlock', (x: any) => [x.t, x.a]).map((x: any) => x.t)).toEqual(['Sherlock', 'The Sherlock', 'Doyle'])
  expect([MIN_QUERY, FIND_LIMIT]).toEqual([2, 60])
  // Избранное из хранилища и с сайта: только похожее на id, без повторов, последние limit
  expect(restoreFavorites(['a', 'b', 'a', '../x', 5, 'c'], 2)).toEqual(['b', 'c'])
  expect(restoreFavorites('a', 2)).toBeNull()
  expect(toggleIn(['a'], 'a', 2)).toEqual({ list: [], added: false })
  expect(toggleIn(['a'], 'b', 2)).toEqual({ list: ['a', 'b'], added: true })
  expect(toggleIn(['a', 'b'], 'c', 2)).toEqual({ list: ['a', 'b'], added: null })
})

test('главное меню: разделы сворачиваются, у свёрнутого — число плиток и новое в «Общении»; свёрнутое помнится и уходит на сайт', HEAVY, async ($, on) => {
  const me = { user: OCTO, settings: {}, handle: 'octocat', ticket: ticketOf('octocat'), friends: 2, requests: 1, unread: 3 }
  const { api, remote } = accountSite({}, { 'GET api/me': () => ({ json: me }) })
  const { clock, saved } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  for (const [id, title] of [['play', 'Играть'], ['read', 'Читать и слушать'], ['watch', 'Смотреть'], ['talk', 'Общение'], ['more', 'Ещё']])
    expect(await ui.find({ key: `arcade-fold-${id}` })).toMatchObject({ props: { label: `▾ ${title}` } })
  expect(await ui.find({ key: 'arcade-menu-search' })).toMatchObject({ props: { label: '🔍 Найти' } })
  expect(await ui.find({ key: 'arcade-menu-favorites' })).toMatchObject({ props: { label: '★ Избранное' } })
  // Шапка: свой @ник, непрочитанные и заявки в друзья
  expect(await ui.find({ key: 'arcade-head-account' })).toMatchObject({ props: { label: '@octocat' } })
  expect(await ui.find({ key: 'arcade-head-chats' })).toMatchObject({ props: { label: '💬 3' } })
  expect(await ui.find({ key: 'arcade-head-friends' })).toMatchObject({ props: { label: '👥 1' } })
  // Свернули «Общение»: плиток не видно, в заголовке — сколько их и что нового
  await ui.press({ key: 'arcade-fold-talk' })
  expect(await ui.find({ key: 'arcade-fold-talk' })).toMatchObject({ props: { label: '▸ Общение · 3 · 💬 3 · 👥 1' } })
  expect(await ui.find({ key: 'arcade-menu-friends' })).toBeUndefined()
  expect(saved.get('collapsed')).toEqual(['talk'])
  await ui.press({ key: 'arcade-fold-play' })
  expect(saved.get('collapsed')).toEqual(['play', 'talk'])
  expect(await ui.find({ key: 'arcade-menu-nes' })).toBeUndefined()
  // На сайт — через пару секунд, как другие настройки
  await clock.advance(2_000)
  await clock.settle()
  expect(remote.collapsed).toMatchObject({ v: ['play', 'talk'] })
  await ui.press({ key: 'arcade-fold-play' })
  expect(await ui.find({ key: 'arcade-menu-nes' })).toBeDefined()
  expect(saved.get('collapsed')).toEqual(['talk'])
  // @ник в шапке ведёт в аккаунт
  await ui.press({ key: 'arcade-head-account' })
  expect(await ui.find({ type: 'Text', text: 'Arcade · аккаунт' })).toBeDefined()
  await ui.unmount()
})

test('главное меню: свёрнутое с прошлого раза так и остаётся; непонятное в настройке не берём', async ($, on) => {
  stubs(on, { stored: { collapsed: ['more', 'junk', 'read'] } })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-fold-read' })).toMatchObject({ props: { label: expect.stringMatching(/^▸ Читать и слушать · \d+$/) } })
  expect(await ui.find({ key: 'arcade-fold-more' })).toMatchObject({ props: { label: '▸ Ещё · 4' } }) // настройки, язык, отчёт об ошибке, поддержка
  expect(await ui.find({ key: 'arcade-menu-settings' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-menu-nes' })).toBeDefined()
  await ui.unmount()
})

test('настройки: раздел убирается из главного меню целиком и возвращается; убранное помнится и уходит на сайт', HEAVY, async ($, on) => {
  const me = { user: OCTO, settings: {}, handle: 'octocat', ticket: ticketOf('octocat'), friends: 0, requests: 0, unread: 0 }
  const { api, remote } = accountSite({}, { 'GET api/me': () => ({ json: me }) })
  const { clock, saved } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  // Разделы — первая группа настроек, фокус на первом; «Ещё» не убрать: в нём сами настройки
  expect(await ui.find({ type: 'Text', text: 'Разделы главного меню' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-show-play' })).toMatchObject({ props: { label: 'Играть: показан', autoFocus: true } })
  for (const id of ['read', 'watch', 'talk', 'work']) expect(await ui.find({ key: `arcade-show-${id}` })).toBeDefined()
  expect(await ui.find({ key: 'arcade-show-more' })).toBeUndefined()
  await ui.press({ key: 'arcade-show-work' })
  await ui.press({ key: 'arcade-show-play' })
  expect(await ui.find({ key: 'arcade-show-play' })).toMatchObject({ props: { label: 'Играть: скрыт' } })
  expect(saved.get('hidden')).toEqual(['play', 'work']) // в порядке меню, а не нажатий
  // На сайт — через пару секунд, как другие настройки
  await clock.advance(2_000)
  await clock.settle()
  expect(remote.hidden).toMatchObject({ v: ['play', 'work'] })
  // В главном меню убранного нет совсем: ни заголовка, ни плиток; остальное на месте
  await ui.press({ key: 'arcade-back' })
  for (const key of ['arcade-fold-play', 'arcade-menu-nes', 'arcade-fold-work', 'arcade-menu-notes', 'arcade-menu-boards']) expect(await ui.find({ key })).toBeUndefined()
  for (const key of ['arcade-fold-read', 'arcade-fold-watch', 'arcade-menu-twitch', 'arcade-fold-talk', 'arcade-menu-settings', 'arcade-menu-search'])
    expect(await ui.find({ key })).toBeDefined()
  // Вернули — раздел снова в меню
  await ui.press({ key: 'arcade-menu-settings' })
  await ui.press({ key: 'arcade-show-play' })
  expect(await ui.find({ key: 'arcade-show-play' })).toMatchObject({ props: { label: 'Играть: показан' } })
  expect(saved.get('hidden')).toEqual(['work'])
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-menu-nes' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-menu-notes' })).toBeUndefined()
  await ui.unmount()
})

test('главное меню: убранное с прошлого раза так и убрано; «Ещё» не убирается, непонятное в настройке не берём', async ($, on) => {
  stubs(on, { stored: { hidden: ['more', 'junk', 'watch'] } })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-fold-watch' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-menu-twitch' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-fold-more' })).toMatchObject({ props: { label: '▾ Ещё' } })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-show-watch' })).toMatchObject({ props: { label: 'Смотреть: скрыт' } })
  expect(await ui.find({ key: 'arcade-show-read' })).toMatchObject({ props: { label: 'Читать и слушать: показан' } })
  await ui.unmount()
})

test('Desktop: настройки — плитки с иконками под заголовками групп; у убранного раздела иконка серая', async ($, on) => {
  const { clock } = stubs(on, { env: WINDOWS, browser: 'ok', stored: { hidden: ['talk'] } })
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' })
  await clock.advance(300)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-settings' })
  for (const title of ['Разделы главного меню', 'Где открывать', 'Панель и язык', 'Уведомления'])
    expect(await ui.find({ type: 'Text', text: title })).toMatchObject({ props: { size: 'heading' } })
  expect(await ui.find({ type: 'Text', text: 'Клавиши' })).toBeUndefined() // в Desktop поля клавиш нет
  expect(await ui.find({ key: 'arcade-show-play' })).toMatchObject({ props: { autoFocus: true } })
  // Плитка раздела — с той же иконкой, что в главном меню, и описанием раздела
  const play = JSON.stringify(await ui.find({ key: 'card-arcade-show-play' }))
  expect(play).toContain('"alt":"Играть: показан"')
  expect(play).toContain('приставки, игры в браузере и твои ROM')
  expect(play).not.toContain('#8b8d98')
  expect(JSON.stringify(await ui.find({ key: 'card-arcade-show-talk' }))).toContain('#8b8d98')
  // У настроек свои иконки, а не джойстик по умолчанию
  for (const key of ['arcade-opener', 'arcade-keep-menu', 'arcade-back-on-done', 'arcade-wide', 'arcade-ask-after', 'arcade-on-done', 'arcade-on-permission', 'arcade-notify', 'arcade-msg-notify'])
    expect(JSON.stringify(await ui.find({ key: `card-${key}` }))).toContain('"alt"')
  // Условия — документом, конфиденциальность — замком
  expect(JSON.stringify(await ui.find({ key: 'card-arcade-terms' }))).toContain('M13 7h15l9 9v25H13z')
  expect(JSON.stringify(await ui.find({ key: 'card-arcade-privacy' }))).toContain('M16 21v-5a8 8 0 0 1 16 0v5')
  expect(JSON.stringify(await ui.find({ key: 'card-arcade-lang' }))).toContain('<ellipse')
  // Вернулись с выбора языка — фокус на «Язык»
  await ui.press({ key: 'arcade-lang' })
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-lang' })).toMatchObject({ props: { autoFocus: true } })
  expect((await ui.find({ key: 'arcade-show-play' })).props.autoFocus).toBeUndefined()
  await ui.unmount()
})

// Правила сайта для YouTube API Services: последняя группа настроек, страницы — в обычном браузере; не открылся — адрес
test('настройки: «Условия и конфиденциальность» открывают /terms и /privacy сайта в обычном браузере', async ($, on) => {
  const { clock, launches } = stubs(on, { env: WINDOWS })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(300)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ type: 'Text', text: 'Условия и конфиденциальность' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  что хранит сайт Arcade, сколько и как это удалить' })).toBeDefined()
  await ui.press({ key: 'arcade-terms' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/terms`)
  expect(await ui.find({ type: 'Text', text: 'Страница открыта в браузере.' })).toBeDefined()
  await ui.press({ key: 'arcade-privacy' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(`${SITE}/privacy`)
  await ui.unmount()
})

test('настройки: браузер не открыл политику конфиденциальности — адрес строкой под настройками', async ($, on) => {
  const { clock } = stubs(on, { env: WINDOWS, launchExit: 1 })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(300)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  await ui.press({ key: 'arcade-privacy' })
  expect(await ui.find({ type: 'Text', text: `${SITE}/privacy` })).toBeDefined()
  await ui.unmount()
})

test('первый запуск: приветствие с разделами вместо меню; убранное и «Готово» помнятся', async ($, on) => {
  const { saved } = stubs(on, { stored: { welcomed: undefined } })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // Вместо главного меню — приветствие: все разделы показаны, фокус на «Готово»
  expect(await ui.find({ type: 'Text', text: 'Добро пожаловать в Arcade!' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-menu-nes' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-welcome-done' })).toMatchObject({ props: { label: 'Готово', autoFocus: true } })
  for (const id of ['play', 'read', 'watch', 'talk', 'work']) expect((await ui.find({ key: `arcade-show-${id}` })).props.label).toMatch(/: показан$/)
  expect(await ui.find({ key: 'arcade-show-more' })).toBeUndefined()
  // Нажатие убирает раздел и сразу сохраняет, как в настройках
  await ui.press({ key: 'arcade-show-work' })
  await ui.press({ key: 'arcade-show-watch' })
  expect(await ui.find({ key: 'arcade-show-watch' })).toMatchObject({ props: { label: 'Смотреть: скрыт' } })
  expect(saved.get('hidden')).toEqual(['watch', 'work'])
  expect(saved.get('welcomed')).toBeUndefined()
  // «Готово» — главное меню без убранного; приветствие больше не показывается
  await ui.press({ key: 'arcade-welcome-done' })
  expect(saved.get('welcomed')).toBe(true)
  expect(await ui.find({ type: 'Text', text: 'Добро пожаловать в Arcade!' })).toBeUndefined()
  for (const key of ['arcade-menu-nes', 'arcade-fold-read', 'arcade-fold-talk', 'arcade-menu-settings']) expect(await ui.find({ key })).toBeDefined()
  for (const key of ['arcade-fold-watch', 'arcade-menu-twitch', 'arcade-fold-work', 'arcade-menu-notes']) expect(await ui.find({ key })).toBeUndefined()
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-show-watch' })).toMatchObject({ props: { label: 'Смотреть: скрыт' } })
  await ui.unmount()
})

// Кто уже пользовался Arcade (играл, менял настройки, входил), приветствия не видит — сразу главное меню
for (const [who, stored] of [['играл', { lastGame: 'thwaite' }], ['менял настройки', { hidden: ['read'] }], ['входил', { account: { token: TOKEN, user: OCTO } }]] as const) {
  test(`первый запуск: уже ${who} — приветствия нет`, HEAVY, async ($, on) => {
    const { saved } = stubs(on, { stored: { welcomed: undefined, ...stored } })
    await start($)
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ key: 'arcade-welcome-done' })).toBeUndefined()
    expect(await ui.find({ key: 'arcade-menu-settings' })).toBeDefined()
    expect(saved.get('welcomed')).toBeUndefined()
    await ui.unmount()
  })
}

test('первый запуск: язык меняется прямо на приветствии, фокус возвращается на него', async ($, on) => {
  const { saved } = stubs(on, { stored: { welcomed: undefined } })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-lang-main' })).toMatchObject({ props: { label: '🌐 Русский' } })
  await ui.press({ key: 'arcade-lang-main' })
  await ui.press({ key: 'arcade-lang-en' })
  // Снова приветствие — уже по-английски, фокус на языке
  expect(await ui.find({ type: 'Text', text: 'Welcome to Arcade!' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Language' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-lang-main' })).toMatchObject({ props: { label: '🌐 English', autoFocus: true } })
  expect(await ui.find({ key: 'arcade-welcome-done' })).toMatchObject({ props: { label: 'Done' } })
  expect((await ui.find({ key: 'arcade-welcome-done' })).props.autoFocus).toBeUndefined()
  expect(await ui.find({ key: 'arcade-show-play' })).toMatchObject({ props: { label: 'Play: shown' } })
  expect(saved.get('lang')).toBe('en')
  // «Назад» с выбора языка — тоже на приветствие
  await ui.press({ key: 'arcade-lang-main' })
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-lang-main' })).toMatchObject({ props: { autoFocus: true } })
  await ui.unmount()
})

test('Desktop: приветствие — плитки разделов с иконками, «Готово» главной кнопкой', async ($, on) => {
  const { clock } = stubs(on, { env: WINDOWS, browser: 'ok', stored: { welcomed: undefined } })
  await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' })
  await clock.advance(300)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Добро пожаловать в Arcade!' })).toMatchObject({ props: { size: 'heading' } })
  for (const title of ['Разделы главного меню', 'Язык']) expect(await ui.find({ type: 'Text', text: title })).toMatchObject({ props: { size: 'heading' } })
  const play = JSON.stringify(await ui.find({ key: 'card-arcade-show-play' }))
  expect(play).toContain('"alt":"Играть: показан"')
  expect(play).toContain('приставки, игры в браузере и твои ROM')
  await ui.press({ key: 'arcade-show-talk' })
  expect(JSON.stringify(await ui.find({ key: 'card-arcade-show-talk' }))).toContain('#8b8d98')
  expect(JSON.stringify(await ui.find({ key: 'card-arcade-lang-main' }))).toContain('"alt"')
  expect(await ui.find({ key: 'arcade-welcome-done' })).toMatchObject({ props: { variant: 'primary', autoFocus: true } })
  await ui.press({ key: 'arcade-welcome-done' })
  expect(await ui.find({ key: 'arcade-menu-nes' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-fold-talk' })).toBeUndefined()
  await ui.unmount()
})

test('настройки на английском: разделы и группы переведены', async ($, on) => {
  stubs(on, { env: { LANG: 'en_US.UTF-8' }, uname: 'Linux', stored: { hidden: ['read'] } })
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-fold-read' })).toBeUndefined()
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ type: 'Text', text: 'Main menu sections' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-show-read' })).toMatchObject({ props: { label: 'Read & listen: hidden' } })
  expect(await ui.find({ key: 'arcade-show-play' })).toMatchObject({ props: { label: 'Play: shown' } })
  expect(await ui.find({ type: 'Text', text: /consoles, browser games and your ROMs/ })).toBeDefined()
  await ui.unmount()
})

// Каталог с группами «Игры» и «Квесты»: шутер, два детективных квеста и головоломка
function libraryCatalog() {
  const site = JSON.parse(siteCatalog())
  site.consoles.push({ id: 'doom', title: 'Шутеры', group: 'games' }, { id: 'quests', title: 'Квесты', group: 'quests' })
  site.groups = [{ id: 'games', title: 'Игры' }, { id: 'quests', title: 'Квесты' }]
  site.shelves = [{ id: 'shooters', title: 'Шутеры' }, { id: 'quests', title: 'Квесты' }]
  const sha = 'e'.repeat(64)
  site.games.freedm = { console: 'doom', net: 'doom', shelf: 'shooters', title: 'FreeDM', genre: 'шутер', about: 'сеть', about_en: 'online', keys: '…', rom: { url: `files/${sha}.wad`, base64: `files/${sha}.wad.b64`, sha256: sha, size: 1 } }
  const web = (title: string, genre: string, about: string) => ({ console: 'quests', kind: 'web', shelf: 'quests', title, genre, about, keys: '…' })
  site.games.hound = web('The Hound of the Baskervilles', 'квест', 'Sherlock Holmes')
  site.games.study = web('A Study in Scarlet', 'квест', 'Sherlock Holmes')
  site.games.emma = web('Émma', 'головоломка', 'Tiles')
  return JSON.stringify(site)
}

test('поиск: от двух букв, без регистра и диакритики, по названию и жанру — разделами; каналы Twitch; ☆ прямо в найденном', async ($, on) => {
  const { clock, saved } = stubs(on, { env: WINDOWS, site: libraryCatalog(), stored: { twitchChannels: [{ login: 'tsoding', name: 'Tsoding' }] } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(2_500)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const short = 'От двух букв: название или жанр. Ищу в играх и каналах Twitch.'
  await ui.press({ key: 'arcade-menu-search' })
  expect(await ui.find({ type: 'Text', text: 'Arcade · поиск' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-search-1' })).toMatchObject({ props: { label: 'Найти', value: '', autoFocus: true } })
  expect(await ui.find({ type: 'Text', text: short })).toBeDefined()
  await ui.input({ key: 'arcade-search-1', text: 'd', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: short })).toBeDefined()
  // Без регистра: квест — под «Квесты · Квест»
  await ui.input({ key: 'arcade-search-1', text: 'SCARLET', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: 'найдено: 1' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Квесты · Квест' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-study' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-hound' })).toBeUndefined()
  // Без диакритики; слова — в любом порядке
  await ui.input({ key: 'arcade-search-1', text: 'emma', kind: 'change' })
  expect(await ui.find({ key: 'arcade-game-emma' })).toBeDefined()
  await ui.input({ key: 'arcade-search-1', text: 'baskervilles hound', kind: 'change' })
  expect(await ui.find({ key: 'arcade-game-hound' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-study' })).toBeUndefined()
  // Жанр; у каждой группы — свой раздел
  await ui.input({ key: 'arcade-search-1', text: 'шутер', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: 'Игры · Шутер' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-freedm' })).toBeDefined()
  await ui.input({ key: 'arcade-search-1', text: 'головол', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: 'Квесты · Головоломка' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-emma' })).toBeDefined()
  // Каналы Twitch — свои и из каталога сайта
  await ui.input({ key: 'arcade-search-1', text: 'tsod', kind: 'change' })
  expect(await ui.find({ key: 'arcade-tw-find-tsoding' })).toMatchObject({ props: { label: 'Tsoding' } })
  expect(await ui.find({ type: 'Text', text: 'найдено: 1' })).toBeDefined()
  await ui.input({ key: 'arcade-search-1', text: 'zzz', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: 'Ничего не нашлось — попробуй другое слово.' })).toBeDefined()
  // ☆ в найденном — сразу в избранное
  await ui.input({ key: 'arcade-search-1', text: 'scarlet', kind: 'change' })
  expect(await ui.find({ key: 'arcade-fav-study' })).toMatchObject({ props: { label: '☆' } })
  await ui.press({ key: 'arcade-fav-study' })
  expect(await ui.find({ key: 'arcade-fav-study' })).toMatchObject({ props: { label: '★' } })
  expect(saved.get('favorites')).toEqual(['study'])
  // Вернулись в меню и снова в поиск — запрос остался
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-menu-search' })).toMatchObject({ props: { autoFocus: true } })
  expect(await ui.find({ type: 'Text', text: '  отмечено: 1' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-search' })
  expect(await ui.find({ key: 'arcade-search-2' })).toMatchObject({ props: { value: 'scarlet' } })
  expect(await ui.find({ key: 'arcade-game-study' })).toBeDefined()
  await ui.unmount()
})

test('избранное: ☆ у игр, «★ Избранное» в группе, всё отмеченное — разделами; не больше 100', async ($, on) => {
  const gone = Array.from({ length: 97 }, (_, i) => `gone-${i}`) // отмечено на другом компьютере, а в каталоге этого нет
  const { clock, saved } = stubs(on, { env: WINDOWS, site: libraryCatalog(), stored: { favorites: [...gone, 'freedm'] } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(2_500)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const order = async (...labels: string[]) => {
    const texts = await drawnTexts(ui)
    return labels.map((x) => texts.indexOf(x))
  }
  expect(await ui.find({ type: 'Text', text: '  отмечено: 1' })).toBeDefined()
  // Квесты: «★ Избранное» — первой плиткой группы
  await ui.press({ key: 'arcade-menu-quests' })
  expect(await ui.find({ key: 'arcade-menu-favorites-quests' })).toMatchObject({ props: { label: '★ Избранное' } })
  expect(await ui.find({ type: 'Text', text: '  отмечай ☆ — соберётся здесь' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-shelf-quests' })
  await ui.press({ key: 'arcade-fav-hound' })
  await ui.press({ key: 'arcade-fav-study' })
  expect(await ui.find({ key: 'arcade-fav-hound' })).toMatchObject({ props: { label: '★' } })
  expect((saved.get('favorites') as string[]).slice(-3)).toEqual(['freedm', 'hound', 'study'])
  // Сотая отметка — последняя
  await ui.press({ key: 'arcade-fav-emma' })
  expect(await ui.find({ type: 'Text', text: 'В избранном уже 100 — сними звёздочку с чего-нибудь.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-fav-emma' })).toMatchObject({ props: { label: '☆' } })
  expect((saved.get('favorites') as string[]).length).toBe(100)
  // Избранное группы: только её игры, отмеченное последним — первым
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ type: 'Text', text: '  отмечено: 2' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-favorites-quests' })
  expect(await ui.find({ type: 'Text', text: 'Arcade · ★ Квесты' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-freedm' })).toBeUndefined()
  const [study, hound] = await order('A Study in Scarlet', 'The Hound of the Baskervilles')
  expect(study).toBeGreaterThan(-1)
  expect(hound).toBeGreaterThan(study)
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-menu-favorites-quests' })).toMatchObject({ props: { autoFocus: true } })
  // Группа «Игры»: своё избранное
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-games' })
  expect(await ui.find({ type: 'Text', text: '  отмечено: 1' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-favorites-games' })
  expect(await ui.find({ type: 'Text', text: 'Arcade · ★ Игры' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-freedm' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-game-hound' })).toBeUndefined()
  // Всё избранное: разделы по порядку отметки; сняли звёздочку — пропало
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-favorites' })
  expect(await ui.find({ type: 'Text', text: 'Arcade · избранное' })).toBeDefined()
  const [quests, shooters] = await order('Квесты · Квест', 'Игры · Шутер')
  expect(quests).toBeGreaterThan(-1)
  expect(shooters).toBeGreaterThan(quests)
  await ui.press({ key: 'arcade-fav-study' })
  expect(await ui.find({ key: 'arcade-game-study' })).toBeUndefined()
  expect((saved.get('favorites') as string[]).slice(-2)).toEqual(['freedm', 'hound'])
  await ui.unmount()
})

test('избранное пустое — подсказка; поиск и избранное по-английски — без русских букв', async ($, on) => {
  const { clock } = stubs(on, { env: { ...WINDOWS, LANG: 'en_US.UTF-8' }, site: libraryCatalog() })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(2_500)
  await $.command.run({ command: 'arcade', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const cyrillic = async () => (await drawnTexts(ui)).filter((x) => /[А-Яа-яЁё]/.test(x) && x !== '🌐 Русский')
  expect(await ui.find({ key: 'arcade-fold-talk' })).toMatchObject({ props: { label: '▾ Social' } })
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-menu-favorites' })
  expect(await ui.find({ type: 'Text', text: 'Nothing here yet. Mark games with the ☆ star — they gather here.' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-search' })
  expect(await cyrillic()).toEqual([])
  await ui.input({ key: 'arcade-search-1', text: 'baskervilles', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: 'Adventures · Adventure' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'found: 1' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-fav-hound' })
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-favorites' })
  expect(await ui.find({ type: 'Text', text: 'Arcade · favorites' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-quests' })
  await ui.press({ key: 'arcade-menu-favorites-quests' })
  expect(await ui.find({ type: 'Text', text: 'Arcade · ★ Adventures' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await ui.unmount()
})

// --- 0.25: отчёты об ошибках ---

test('reports.js: тело отчёта, версия из plugin.json, роль в /api/me, ответы сайта про отчёты и список', () => {
  const reply = (status: number, data: any) => ({ status, ok: status < 400, headers: {}, text: typeof data === 'string' ? data : JSON.stringify(data) })
  expect([accountUrl('report'), accountUrl('myReport'), accountUrl('reports'), accountUrl('closeReport')]).toEqual([`${SITE}/api/report`, `${SITE}/api/me/report`, `${SITE}/api/me/reports`, `${SITE}/api/me/reports/close`])
  // Роль — только admin; остальное и ошибки — ''
  expect(parseMe(reply(200, { user: OCTO, role: 'admin' }))).toMatchObject({ role: 'admin', error: '' })
  expect(parseMe(reply(200, { user: OCTO, role: 'root' })).role).toBe('')
  expect(parseMe(reply(401, { error: 'auth' })).role).toBe('')
  // Версия мода — из его plugin.json, только вида 0.25.0
  expect(versionFrom('{"name":"arcade","version":"0.25.0"}')).toBe('0.25.0')
  expect(['{"version":"0.25"}', '{"version":25}', 'not json', undefined].map(versionFrom)).toEqual(['', '', '', ''])
  // Тело: без управляющих знаков и пробелов по краям; приметы — только знакомого вида
  expect(reportBody('  Шашки\r\nзависли ‮ ', { version: '0.25.0', surface: 'desktop', lang: 'ru', os: 'windows' })).toEqual({ text: 'Шашки\nзависли', version: '0.25.0', surface: 'desktop', lang: 'ru', os: 'windows' })
  expect(reportBody('x', { version: '1.2', surface: 'web', lang: 'rus', os: null })).toEqual({ text: 'x' })
  expect(reportBody(undefined, {})).toEqual({ text: '' })
  // Отправка: номер отчёта; пустой, длинный, часто, у всех слишком много, выключено, ключ не действует
  expect(parseReportSent(reply(200, { ok: true, id: 7 }))).toEqual({ id: 7, error: '' })
  expect(parseReportSent(reply(200, { ok: true }))).toEqual({ id: 0, error: 'down' })
  expect(['empty', 'long', 'bad request'].map((e) => parseReportSent(reply(400, { error: e })).error)).toEqual(['empty', 'long', 'down'])
  expect(parseReportSent(reply(413, { error: 'too big' })).error).toBe('long')
  expect(parseReportSent(reply(429, { error: 'often' })).error).toBe('often')
  expect(['full', 'off', 'other'].map((e) => parseReportSent(reply(503, { error: e })).error)).toEqual(['full', 'off', 'down'])
  expect(parseReportSent(reply(401, { error: 'auth' })).error).toBe('auth')
  expect(parseReportSent(reply(404, 'not found')).error).toBe('down') // сайт без отчётов
  expect(parseReportSent(null).error).toBe('down')
  // Список: как пришёл (новые сверху), не больше 50; кривые — мимо; текст без управляющих знаков и не длиннее MAX_REPORT
  const signed = { id: 2, at: 2000, text: 'Чат\u001b не открывается', surface: 'terminal', from: { id: '583231', handle: 'octocat' } }
  const anon = { id: 1, at: 1000, text: 'Doom', version: '0.25.0', lang: 'ru', os: 'windows', from: { id: 'x' } }
  const bad = [null, { id: 0, at: 1, text: 'x' }, { id: 3, at: 'x', text: 'x' }, { id: 4, at: 1, text: ' \u0007 ' }]
  expect(parseReports(reply(200, { reports: [signed, ...bad, anon], open: 9 }))).toEqual({
    reports: [
      { id: 2, at: 2000, text: 'Чат не открывается', surface: 'terminal', from: { id: '583231', handle: 'octocat' } },
      { id: 1, at: 1000, text: 'Doom', version: '0.25.0', lang: 'ru', os: 'windows' },
    ],
    open: 9,
    error: '',
  })
  expect(parseReports(reply(200, { reports: [{ ...signed, from: { id: '7', handle: 'Bad Name' } }] })).reports[0].from).toEqual({ id: '7' })
  expect(parseReports(reply(200, { reports: [{ ...signed, text: 'я'.repeat(MAX_REPORT + 5) }] }))).toMatchObject({ open: 1 })
  expect(parseReports(reply(200, { reports: [{ ...signed, text: 'я'.repeat(MAX_REPORT + 5) }] })).reports[0].text.length).toBe(MAX_REPORT)
  expect(parseReports(reply(200, { reports: Array.from({ length: 80 }, (_, i) => ({ ...signed, id: i + 1 })), open: 80 })).reports.length).toBe(50)
  expect(parseReports(reply(200, { open: 1 }))).toEqual({ reports: [], open: 0, error: 'down' })
  expect(parseReports(reply(403, { error: 'admin' })).error).toBe('admin')
  expect(parseReports(reply(503, { error: 'off' })).error).toBe('off')
  // Закрыть: сколько открытых осталось; уже закрыт, не админ, ключ не действует
  expect(parseClosed(reply(200, { ok: true, open: 4 }))).toEqual({ open: 4, error: '' })
  expect([[404, 'gone'], [403, 'admin'], [401, 'auth'], [404, 'x']].map(([s, e]) => parseClosed(reply(s as number, { error: e })).error)).toEqual(['gone', 'admin', 'auth', 'down'])
})

test('отчёт об ошибке без входа: плитка в «Ещё» у всех, списка нет; пустой и длинный — сразу здесь; ушёл без подписи с версией, языком и системой', HEAVY, async ($, on) => {
  let answer: any = { json: { ok: true, id: 7 } }
  const { api } = accountSite({}, { 'POST api/report': () => answer })
  const { clock, requests } = stubs(on, { env: WINDOWS, api, disk: { '.claude-plugin/plugin.json': '{"name":"arcade","version":"0.25.0"}' } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: string) => ui.find({ type: 'Text', text: t })
  const report = async (key: string, value: string) => {
    await ui.input({ key, text: value, kind: 'submit' })
    await clock.settle()
  }
  expect(await ui.find({ key: 'arcade-menu-report' })).toMatchObject({ props: { label: '🐞 Сообщить об ошибке' } })
  expect(await text('  что сломалось — прямо автору Arcade')).toBeDefined()
  expect(await ui.find({ key: 'arcade-menu-reports' })).toBeUndefined()
  await ui.press({ key: 'arcade-menu-report' })
  await clock.settle()
  expect(await text('Arcade · отчёт об ошибке')).toBeDefined()
  expect(await ui.find({ key: 'arcade-report-text-0' })).toMatchObject({ props: { label: 'Отчёт', rows: 4, submitLabel: 'Отправить', autoFocus: true } })
  expect(await text('Без входа отчёт уйдёт без подписи.')).toBeDefined()
  // Пустой и длиннее 2000 знаков — сразу здесь, на сайт не уходит
  await report('arcade-report-text-0', '   ')
  expect(await text('Напиши, что сломалось.')).toBeDefined()
  await report('arcade-report-text-0', 'я'.repeat(MAX_REPORT + 1))
  expect(await text('Отчёт длиннее 2000 знаков — сократи его.')).toBeDefined()
  expect(sent(requests, 'api/report', 'POST')).toEqual([])
  // Ушёл: без ключа, с версией из plugin.json, языком и системой; поле — новое, пустое
  await report('arcade-report-text-0', '  Шашки зависают после хода дамкой‮ ')
  const [first] = sent(requests, 'api/report', 'POST')
  expect(first.body).toEqual({ text: 'Шашки зависают после хода дамкой', version: '0.25.0', surface: 'terminal', lang: 'ru', os: 'windows' })
  expect(first.headers.Authorization).toBeUndefined()
  expect(await text('Спасибо! Отчёт отправлен.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-report-text-0' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-report-text-1' })).toBeDefined()
  // Часто — понятно, поле то же
  answer = { status: 429, json: { error: 'often' } }
  await report('arcade-report-text-1', 'ещё один')
  expect(await text('Отчётов от тебя сегодня уже много — попробуй завтра.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-report-text-1' })).toBeDefined()
  // Отчёты на сайте выключены
  answer = { status: 503, json: { error: 'off' } }
  await report('arcade-report-text-1', 'ещё один')
  expect(await text('Отчёты на сайте сейчас выключены.')).toBeDefined()
  // Назад — фокус на плитке отчёта
  await ui.press({ key: 'arcade-back' })
  await clock.settle()
  expect(await ui.find({ key: 'arcade-menu-report' })).toMatchObject({ props: { autoFocus: true } })
  await ui.unmount()
})

test('отчёт об ошибке со входом: подписан аккаунтом — на api/me/report; вход забыт — отправить ещё раз, уже без подписи; списка нет', HEAVY, async ($, on) => {
  let signed: any = { json: { ok: true, id: 3 } }
  const { api } = accountSite({}, { 'POST api/me/report': () => signed, 'POST api/report': { json: { ok: true, id: 4 } } })
  const { clock, requests, saved } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: string) => ui.find({ type: 'Text', text: t })
  const report = async (key: string, value: string) => {
    await ui.input({ key, text: value, kind: 'submit' })
    await clock.settle()
  }
  // Вошёл, но не админ: отправить можно, плитки списка нет
  expect(await ui.find({ key: 'arcade-menu-reports' })).toBeUndefined()
  await ui.press({ key: 'arcade-menu-report' })
  await clock.settle()
  expect(await text('Со входом через GitHub отчёт подписан твоим аккаунтом.')).toBeDefined()
  await report('arcade-report-text-0', 'Чат не открывается')
  const [mine] = sent(requests, 'api/me/report', 'POST')
  expect(mine.headers.Authorization).toBe(`Bearer ${TOKEN}`)
  expect(mine.body).toEqual({ text: 'Чат не открывается', surface: 'terminal', lang: 'ru', os: 'windows' })
  expect(await text('Спасибо! Отчёт отправлен.')).toBeDefined()
  // Ключ на сайте больше не действует: вход забыт, отчёт — ещё раз, теперь без подписи
  signed = { status: 401, json: { error: 'auth' } }
  await report('arcade-report-text-1', 'Шашки зависают')
  expect(await text('Отчёт не ушёл — отправь его ещё раз: теперь он уйдёт без подписи.')).toBeDefined()
  expect(await text('Без входа отчёт уйдёт без подписи.')).toBeDefined()
  expect(saved.get('account')).toBeUndefined()
  await report('arcade-report-text-1', 'Шашки зависают')
  expect(sent(requests, 'api/report', 'POST').map((r) => [r.body.text, r.headers.Authorization])).toEqual([['Шашки зависают', undefined]])
  expect(await text('Спасибо! Отчёт отправлен.')).toBeDefined()
  await ui.unmount()
})

// Сайт с отчётами: открытые — новые сверху; admin — ты админ (так говорят и /api/me, и список)
function reportsSite() {
  const state = {
    admin: true,
    reports: [
      { id: 2, at: Date.UTC(2026, 9, 20, 9, 30), text: 'Чат не открывается', surface: 'terminal', from: { id: '583231', handle: 'octocat' } },
      { id: 1, at: Date.UTC(2026, 9, 19, 18, 5), text: 'Doom не грузится', version: '0.25.0', surface: 'desktop', lang: 'ru', os: 'windows' },
    ] as any[],
  }
  const { api } = accountSite(
    {},
    {
      'GET api/me': () => ({ json: { user: OCTO, settings: {}, ...(state.admin ? { role: 'admin' } : {}) } }),
      'GET api/me/reports': () => (state.admin ? { json: { reports: state.reports, open: state.reports.length } } : { status: 403, json: { error: 'admin' } }),
      'POST api/me/reports/close': (request: any) => {
        if (!state.admin) return { status: 403, json: { error: 'admin' } }
        if (!state.reports.some((r) => r.id === request.body.id)) return { status: 404, json: { error: 'gone' } }
        state.reports = state.reports.filter((r) => r.id !== request.body.id)
        return { json: { ok: true, open: state.reports.length } }
      },
    },
  )
  return { api, state }
}

test('отчёты об ошибках — только админу: плитка, список новых сверху, «Закрыть»; закрытый в другом месте — уходит; сайт сказал «не админ» — плитки нет', HEAVY, async ($, on) => {
  const { api, state } = reportsSite()
  const { clock, requests } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: string | RegExp) => ui.find({ type: 'Text', text: t })
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  expect(await ui.find({ key: 'arcade-menu-reports' })).toMatchObject({ props: { label: '📋 Отчёты об ошибках' } })
  expect(await text('  видишь только ты: ты админ Arcade')).toBeDefined()
  await press('arcade-menu-reports')
  expect(sent(requests, 'api/me/reports', 'GET').map((r) => r.headers.Authorization)).toEqual([`Bearer ${TOKEN}`])
  expect(await text('Arcade · отчёты об ошибках')).toBeDefined()
  expect(await text('Открытых отчётов: 2')).toBeDefined()
  expect(await text('Чат не открывается')).toBeDefined()
  expect(await text('@octocat')).toBeDefined()
  expect(await text(/^#1 · .+ · 0\.25\.0 · desktop · ru · windows$/)).toBeDefined()
  expect(await text('без подписи')).toBeDefined()
  expect(await ui.find({ key: 'arcade-report-close-2' })).toMatchObject({ props: { label: 'Закрыть', autoFocus: true } })
  // «Закрыть» — сайт удаляет, из списка уходит
  await press('arcade-report-close-2')
  expect(sent(requests, 'api/me/reports/close', 'POST').map((r) => r.body)).toEqual([{ id: 2 }])
  expect(await ui.find({ key: 'arcade-report-close-2' })).toBeUndefined()
  expect(await text('Отчёт закрыт.')).toBeDefined()
  expect(await text('Открытых отчётов: 1')).toBeDefined()
  // Закрыт с другого компьютера — тоже уходит из списка
  state.reports = []
  await press('arcade-report-close-1')
  expect(await text('Этот отчёт уже закрыт.')).toBeDefined()
  expect(await text('Открытых отчётов нет.')).toBeDefined()
  expect(await text(/^Открытых отчётов: /)).toBeUndefined()
  // Сайт больше не считает тебя админом — списка не показываем, плитки нет
  state.admin = false
  await press('arcade-reports-refresh')
  expect(sent(requests, 'api/me/reports', 'GET').length).toBe(2)
  expect(await text('Список отчётов — только у автора Arcade.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-reports-refresh' })).toBeUndefined()
  await press('arcade-back')
  expect(await ui.find({ key: 'arcade-menu-reports' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-menu-report' })).toBeDefined()
  await ui.unmount()
})

test('отчёты по-английски: экран отчёта, список у админа и плитки без русских букв', HEAVY, async ($, on) => {
  const { api, state } = reportsSite()
  state.reports = [
    { id: 5, at: Date.UTC(2026, 9, 20, 9, 30), text: 'Chess freezes after castling', surface: 'desktop', from: { id: '583231' } },
    { id: 4, at: Date.UTC(2026, 9, 19, 18, 5), text: 'Doom is black', os: 'mac' },
  ]
  const { clock } = stubs(on, { env: { ...WINDOWS, LANG: 'en_US.UTF-8' }, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const cyrillic = async () => (await drawnTexts(ui)).filter((x) => /[А-Яа-яЁё]/.test(x) && x !== '🌐 Русский')
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  expect(await ui.find({ key: 'arcade-menu-report' })).toMatchObject({ props: { label: '🐞 Report a bug' } })
  expect(await ui.find({ key: 'arcade-menu-reports' })).toMatchObject({ props: { label: '📋 Bug reports' } })
  expect(await cyrillic()).toEqual([])
  await press('arcade-menu-report')
  expect(await ui.find({ key: 'arcade-report-text-0' })).toMatchObject({ props: { label: 'Report', submitLabel: 'Send' } })
  expect(await cyrillic()).toEqual([])
  await ui.input({ key: 'arcade-report-text-0', text: ' ', kind: 'submit' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Describe what broke.' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await press('arcade-back')
  await press('arcade-menu-reports')
  expect(await ui.find({ type: 'Text', text: 'Open reports: 2' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'GitHub #583231' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await press('arcade-report-close-5')
  expect(await ui.find({ type: 'Text', text: 'Report closed.' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await ui.unmount()
})

// Блокнот: страницы — в $.store мода; Claude ведёт его инструментом mcp__arcade__notes
const NOTES = 'mcp__arcade__notes'

// Ключ поля блокнота по началу: номер в конце растёт, когда страница меняется не из этих полей
async function noteKey(ui: any, prefix: string) {
  let found: string | undefined
  const walk = (n: any) => {
    if (found || !n || typeof n !== 'object') return
    const key = n.props?.key ?? n.key
    if (typeof key === 'string' && key.startsWith(prefix)) found = key
    for (const c of n.children ?? []) walk(c)
  }
  walk(await ui.drawn())
  return found
}

// Поле блокнота по началу ключа: найти и ввести (по умолчанию — Enter)
async function noteInput(ui: any, prefix: string, text: string, kind?: string) {
  const key = await noteKey(ui, prefix)
  if (!key) throw new Error(`нет поля ${prefix}`)
  return ui.input({ key, text, ...(kind ? { kind } : {}) })
}

test('блокнот: хранилище, страницы и подстраницы, строки и чек-листы', () => {
  // Что не сходится — мимо; подстраница без своей страницы — тоже
  expect(restoreNotes(null)).toEqual([])
  expect(
    restoreNotes([
      { id: 'a', title: ' План ', body: 'x\r\ny', parent: null, at: 5 },
      { id: 'b', title: 'Сирота', body: '', parent: 'zz' },
      { id: 'A!', title: 'x', body: '' },
      { id: 'c', title: '  ', body: '' },
      { id: 'a', title: 'дубль', body: '' },
      { id: 'd', title: 'Под', body: '', parent: 'a' },
    ]),
  ).toEqual([
    { id: 'a', title: 'План', body: 'x\ny', parent: null, at: 5 },
    { id: 'd', title: 'Под', body: '', parent: 'a', at: 0 },
  ])

  // Новая — первой; id из времени, занят — с номером; подстраница — только под страницей верхнего уровня
  let made: any = addPage([], { title: '  План  на неделю ' }, 1000)
  expect(made.page).toEqual({ id: 'prs', title: 'План на неделю', body: '', parent: null, at: 1000 })
  made = addPage(made.notes, { title: 'Покупки', parent: 'prs' }, 1000)
  expect(made.page).toMatchObject({ id: 'prs1', parent: 'prs' })
  const list = made.notes
  expect(list.map((p: any) => p.id)).toEqual(['prs1', 'prs'])
  expect(notesOrder(list).map((p: any) => p.title)).toEqual(['План на неделю', 'Покупки'])
  expect(addPage(list, { title: 'Глубже', parent: 'prs1' }, 1)).toEqual({ error: 'parent' })
  expect(addPage(list, { title: ' \n ' }, 1)).toEqual({ error: 'empty' })
  const full = Array.from({ length: MAX_PAGES }, (_, i) => ({ id: `p${i}`, title: 't', body: '', parent: null, at: 0 }))
  expect(addPage(full, { title: 'ещё' }, 1)).toEqual({ error: 'full' })
  expect(fits([{ id: 'a', title: 't', body: 'x'.repeat(MAX_TOTAL), parent: null, at: 0 }])).toBe(false)
  expect(removePage(list, 'prs')).toEqual([])
  expect(removePage(list, 'prs1').map((p: any) => p.id)).toEqual(['prs'])
  expect(findPage(list, ' покупки ')?.id).toBe('prs1')
  expect(findPage(list, 'prs')?.title).toBe('План на неделю')
  expect(findPage(list, ' ')).toBeNull()

  // Строки: заголовки, пункты чек-листа (и с отступом), пункты списка, текст и пустые
  const body = '# Неделя\n### Пн\n- [ ] тесты\n  - [x] ревью\n* молоко\n\nпросто текст'
  expect(noteLines(body).map((l: any) => [l.kind, l.text, l.done ?? null])).toEqual([
    ['h1', 'Неделя', null],
    ['h2', 'Пн', null],
    ['check', 'тесты', false],
    ['check', 'ревью', true],
    ['bullet', 'молоко', null],
    ['blank', '', null],
    ['text', 'просто текст', null],
  ])
  expect(checkStats(body)).toEqual({ done: 1, total: 2 })
  expect(toggleLine(body, 2).split('\n')[2]).toBe('- [x] тесты')
  expect(toggleLine(body, 3, false).split('\n')[3]).toBe('  - [ ] ревью')
  expect(toggleLine(body, 3, true)).toBe(body)
  expect(toggleLine(body, 4)).toBe(body)

  // Дописать в конец: пустые строки по краям — прочь, пробелы — не дописываем, длиннее предела — null
  expect(appendText('a', '\n\nb\n')).toBe('a\nb')
  expect(appendText('a\n', 'b')).toBe('a\nb')
  expect(appendText('', 'b')).toBe('b')
  expect(appendText('a', '  \n ')).toBe('a')
  expect(appendText('x'.repeat(MAX_BODY - 1), 'yy')).toBeNull()
})

test('блокнот: инструмент Claude — список, страница, новая страница, дописать, отметить; удалять не умеет', () => {
  let notes: any[] = []
  const call = (input: any, at = 2000) => {
    const out = applyNotesTool(notes, input, at)
    notes = out.notes
    return out
  }
  expect(call({ action: 'list' })).toEqual({ notes: [], text: 'The notebook is empty.' })
  expect(call({ action: 'create', title: 'Release', text: '- [ ] tests\n- [ ] changelog' })).toMatchObject({ text: 'Created page p1jk: Release.', changed: true })
  expect(call({ action: 'create', title: 'Notes', parent: 'release' }).text).toBe('Created page p1jk1: Notes (under Release).')
  expect(call({ action: 'create', title: 'Deep', parent: 'Notes' })).toMatchObject({ isError: true, text: '"Notes" is a subpage; subpages can only go under top-level pages.' })
  expect(call({ action: 'create', title: 'X', parent: 'nope' }).text).toBe('No page "nope" to put the new page under.')
  expect(call({ action: 'create', title: ' ' }).text).toBe('The page needs a title.')
  expect(call({ action: 'create', title: 'Big', text: 'x'.repeat(MAX_BODY + 1) }).text).toBe('The text is too long: up to 20000 characters.')
  expect(call({ action: 'list' }).text).toBe('Notebook pages:\n- p1jk: Release (0/2 done)\n  - p1jk1: Notes')

  // Пункт — по номеру с единицы или по части текста; несколько совпадений — список пунктов
  expect(call({ action: 'check', page: 'Release', item: '2' }).text).toBe('Ticked: changelog.')
  expect(call({ action: 'check', page: 'Release', item: 'TEST' }).text).toBe('Ticked: tests.')
  expect(call({ action: 'check', page: 'Release', item: 'tests', done: false }).text).toBe('Unticked: tests.')
  expect(call({ action: 'append', page: 'p1jk', text: '- [ ] tag\n- [ ] test page' })).toMatchObject({ text: 'Added to Release.', changed: true })
  expect(call({ action: 'check', page: 'Release', item: 'test' })).toMatchObject({
    isError: true,
    text: '"test" matches several items. Items:\n1. [ ] tests\n2. [x] changelog\n3. [ ] tag\n4. [ ] test page',
  })
  expect(call({ action: 'check', page: 'Release', item: '9' }).text).toMatch(/^No item "9"\. Items:\n1\. \[ \] tests/)
  expect(call({ action: 'check', page: 'Notes', item: '1' }).text).toBe('Notes has no checklist items.')

  expect(call({ action: 'read', page: 'Release' }).text).toBe('Page p1jk: Release\n\n- [ ] tests\n- [x] changelog\n- [ ] tag\n- [ ] test page\n\nSubpages:\n- p1jk1: Notes')
  expect(call({ action: 'read', page: 'Notes' }).text).toBe('Page p1jk1: Notes (under Release)\n\n(empty)')
  expect(call({ action: 'read', page: 'Nope' })).toMatchObject({ isError: true, text: 'No page "Nope". Use action list to see the pages.' })
  expect(call({ action: 'append', page: 'Notes', text: ' ' })).toMatchObject({ isError: true, text: 'Nothing to add: text is empty.' })
  expect(call({ action: 'append', page: 'Release', text: 'x'.repeat(MAX_BODY) }).text).toBe('The page would be over 20000 characters.')
  expect(call({ action: 'delete', page: 'Release' })).toMatchObject({ isError: true, text: 'Unknown action: use list, read, create, append, check, replace, link, move or due.' })
  expect(notes.map((p) => p.id)).toEqual(['p1jk1', 'p1jk'])
})


test('доска проектов: колонки и карточки — места, перенос, колонки; хранилище помнит доску', () => {
  // Доска — страница верхнего уровня с колонками; карточки — её подстраницы с колонкой и местом
  const made: any = addPage([], { title: 'Проект', board: {} }, 1000)
  expect(made.page).toEqual({ id: 'prs', title: 'Проект', body: '', parent: null, at: 1000, board: { cols: DEFAULT_COLS } })
  expect(DEFAULT_COLS.map((c) => COL_NAMES[c.id as keyof typeof COL_NAMES])).toEqual(['Сделать', 'В работе', 'Готово'])
  expect([isBoard(made.page), isBoard({ ...made.page, parent: 'x' }), isBoard({ id: 'a', title: 'a', body: '', parent: null })]).toEqual([true, false, false])
  let notes = made.notes
  // В колонку по id (нет такой — в первую), под последнюю карточку
  for (const [title, id, col] of [['a', 'ca', 'todo'], ['b', 'cb', 'todo'], ['c', 'cc', 'doing'], ['d', 'cd', 'nope']]) notes = addPage(notes, { title, parent: 'prs', id, col }, 1001).notes
  const board = () => notes.find((p: any) => p.id === 'prs')
  const titles = (col: string) => columnCards(notes, board(), col).map((p: any) => p.title)
  expect([titles('todo'), titles('doing'), titles('done')]).toEqual([['a', 'b', 'd'], ['c'], []])
  expect(notes.find((p: any) => p.id === 'cd')).toMatchObject({ col: 'todo', pos: 2 })
  expect(columnOf({ col: 'gone' }, board().board.cols)).toBe('todo')
  expect(notesOrder(notes).map((p: any) => p.title)).toEqual(['Проект', 'a', 'b', 'd', 'c'])
  // id занят — свой из времени
  expect(addPage(notes, { title: 'e', parent: 'prs', id: 'ca' }, 1000).page.id).toBe('prs1')

  // Вверх и вниз — посередине между соседями; с края — как было; влево и вправо — вниз соседней колонки
  notes = moveCard(notes, 'cb', 'up', 2000)
  expect(titles('todo')).toEqual(['b', 'a', 'd'])
  expect(notes.find((p: any) => p.id === 'cb')).toMatchObject({ pos: -1, at: 2000 })
  notes = moveCard(notes, 'cb', 'down', 2001)
  expect([titles('todo'), notes.find((p: any) => p.id === 'cb').pos]).toEqual([['a', 'b', 'd'], 1])
  expect(moveCard(notes, 'ca', 'up', 2002)).toBe(notes)
  expect(moveCard(notes, 'prs', 'down', 2002)).toBe(notes)
  notes = moveCard(notes, 'cc', 'left', 2003)
  expect([titles('todo'), titles('doing')]).toEqual([['a', 'b', 'd', 'c'], []])
  expect(moveCard(notes, 'cc', 'left', 2004)).toBe(notes)
  notes = moveCard(notes, 'cd', { col: 'done' }, 2005)
  expect(notes.find((p: any) => p.id === 'cd')).toMatchObject({ col: 'done', pos: 0 })
  // Середины нет — колонка нумеруется заново, правятся только сдвинутые
  let same: any = addPage([], { title: 'Same', board: {} }, 1).notes
  for (const id of ['x', 'y', 'z']) same = addPage(same, { title: id, parent: 'p1', id, pos: 0 }, 2).notes
  same = moveCard(same, 'z', 'up', 3)
  expect(columnCards(same, same.find((p: any) => p.id === 'p1'), 'todo').map((p: any) => [p.id, p.pos, p.at])).toEqual([
    ['x', 0, 2],
    ['z', 1, 3],
    ['y', 2, 3],
  ])

  // Колонки: своя — в конец; пустое название, занятый id и девятая — нельзя; переименовать; убрать — только пустую и не последнюю
  notes = addColumn(notes, 'prs', '  Проверка ', 'k1', 3000).notes
  expect(board().board.cols).toEqual([...DEFAULT_COLS, { id: 'k1', name: 'Проверка' }])
  expect([addColumn(notes, 'prs', '  ', 'k2', 1), addColumn(notes, 'prs', 'X', 'todo', 1), addColumn(notes, 'ca', 'X', 'k2', 1)]).toEqual([{ error: 'empty' }, { error: 'empty' }, { error: 'empty' }])
  let full = notes
  for (const n of [2, 3, 4, 5]) full = addColumn(full, 'prs', `K${n}`, `k${n}`, 1).notes
  expect(addColumn(full, 'prs', 'K9', 'k9', 1)).toEqual({ error: 'many' })
  notes = renameColumn(notes, 'prs', 'done', 'x'.repeat(40), 3001).notes
  expect(board().board.cols[2]).toEqual({ id: 'done', name: 'x'.repeat(30) })
  expect(renameColumn(notes, 'prs', 'done', ' ', 1)).toEqual({ error: 'empty' })
  expect(removeColumn(notes, 'prs', 'todo', 1)).toEqual({ error: 'busy' })
  notes = removeColumn(notes, 'prs', 'k1', 3002).notes
  notes = removeColumn(notes, 'prs', 'doing', 3003).notes
  expect(board().board.cols.map((c: any) => c.id)).toEqual(['todo', 'done'])
  let one: any = addPage([], { title: 'One', board: { cols: [{ id: 'a' }] } }, 1).notes
  expect(removeColumn(one, 'p1', 'a', 2)).toEqual({ error: 'last' })

  // Колонки из хранилища и с сайта: от одной до восьми, id латиницей без повторов, название — непустое
  expect(cleanCols([{ id: 'todo' }, { id: 'k1', name: '  Q\n ' }])).toEqual([{ id: 'todo' }, { id: 'k1', name: 'Q' }])
  expect([cleanCols([]), cleanCols([{ id: 'a' }, { id: 'a' }]), cleanCols([{ id: 'A' }]), cleanCols([{ id: 'a', name: ' ' }]), cleanCols(Array.from({ length: 9 }, (_, i) => ({ id: `c${i}` }))), cleanCols('x')]).toEqual([
    null,
    null,
    null,
    null,
    null,
    null,
  ])

  // Хранилище: доска с колонками и номером на сайте; у карточки нет колонки — первая, нет места — 0; у подстраницы обычной страницы их нет
  const SHARED = 'b' + 'Q'.repeat(16)
  expect(
    restoreNotes([
      { id: 'b1', title: 'Доска', body: '', parent: null, at: 1, board: { cols: [{ id: 'k1', name: 'Одна' }, { id: 'k2' }], share: SHARED } },
      { id: 'b2', title: 'Кривая', body: '', parent: null, at: 1, board: { cols: [{ id: 'A' }], share: 'nope' } },
      { id: 'c1', title: 'Карточка', body: '', parent: 'b1', at: 2, col: 'k2', pos: 1.5 },
      { id: 'c2', title: 'Без места', body: '', parent: 'b1', at: 2, col: 'gone' },
      { id: 'p1', title: 'Страница', body: '', parent: null, at: 1 },
      { id: 'p2', title: 'Под', body: '', parent: 'p1', at: 1, col: 'todo', pos: 3 },
    ]),
  ).toEqual([
    { id: 'b1', title: 'Доска', body: '', parent: null, at: 1, board: { cols: [{ id: 'k1', name: 'Одна' }, { id: 'k2' }], share: SHARED } },
    { id: 'b2', title: 'Кривая', body: '', parent: null, at: 1, board: { cols: DEFAULT_COLS } },
    { id: 'c1', title: 'Карточка', body: '', parent: 'b1', at: 2, col: 'k2', pos: 1.5 },
    { id: 'c2', title: 'Без места', body: '', parent: 'b1', at: 2, col: 'k1', pos: 0 },
    { id: 'p1', title: 'Страница', body: '', parent: null, at: 1 },
    { id: 'p2', title: 'Под', body: '', parent: 'p1', at: 1 },
  ])
})

test('доска проектов: инструмент Claude — доска, карточка в колонку, перенос, список и чтение', () => {
  let notes: any[] = []
  let made = 0
  const call = (input: any, at = 3000) => {
    const out = applyNotesTool(notes, input, at, () => `c${++made}`)
    notes = out.notes
    return out
  }
  expect(call({ action: 'create', title: 'Sprint', board: true })).toMatchObject({ text: 'Created board p2bc: Sprint (a board with columns To do, Doing, Done).', changed: true })
  expect(call({ action: 'create', title: 'Login', parent: 'Sprint' }).text).toBe('Created card c1: Login (card on Sprint, column To do).')
  // Колонка — по id, английскому или русскому названию, без регистра
  expect(call({ action: 'create', title: 'Tests', parent: 'p2bc', column: 'в работе' }).text).toBe('Created card c2: Tests (card on Sprint, column Doing).')
  expect(call({ action: 'create', title: 'X', parent: 'Sprint', column: 'later' })).toMatchObject({ isError: true, text: 'No column "later" on Sprint. Columns: "To do", "Doing", "Done".' })
  expect(call({ action: 'create', title: 'Inner', parent: 'Sprint', board: true })).toMatchObject({ isError: true, text: 'A board is a top-level page: create it without parent.' })
  expect(call({ action: 'list' }).text).toBe('Notebook pages:\n- p2bc: Sprint [board: To do, Doing, Done]\n  - c1: Login (To do)\n  - c2: Tests (Doing)')

  expect(call({ action: 'move', page: 'Login', column: 'DONE' })).toMatchObject({ text: 'Moved Login to Done.', changed: true })
  expect(notes.find((p) => p.id === 'c1')).toMatchObject({ col: 'done', pos: 0 })
  expect(call({ action: 'move', page: 'c1', column: 'done' })).toEqual({ notes, text: 'Login is already in Done.' })
  expect(call({ action: 'move', page: 'Sprint', column: 'done' })).toMatchObject({ isError: true, text: 'Sprint is not a card on a board.' })
  expect(call({ action: 'move', page: 'Login', column: 'nope' }).text).toBe('No column "nope" on Sprint. Columns: "To do", "Doing", "Done".')
  expect(call({ action: 'read', page: 'Sprint' }).text).toBe('Board p2bc: Sprint\n\n## To do\n(no cards)\n\n## Doing\n- c2: Tests\n\n## Done\n- c1: Login')
  expect(call({ action: 'read', page: 'Login' }).text).toBe('Page c1: Login (card on board Sprint, column Done)\n\n(empty)')

  // Общая доска со своей колонкой — так и в списке
  notes = updatePage(notes, 'p2bc', { board: { cols: [{ id: 'todo' }, { id: 'doing' }, { id: 'done', name: 'Shipped' }], share: 'b' + 'Q'.repeat(16) } }, 3001)
  expect(call({ action: 'list' }).text).toBe('Notebook pages:\n- p2bc: Sprint [board, shared with friends: To do, Doing, Shipped]\n  - c2: Tests (Doing)\n  - c1: Login (Shipped)')
  expect(call({ action: 'read', page: 'Sprint' }).text.split('\n')[0]).toBe('Board p2bc: Sprint (shared with friends)')
  expect(call({ action: 'move', page: 'Tests', column: 'shipped' }).text).toBe('Moved Tests to Shipped.')
})

test('карточки доски: срок и кто взял — инструмент Claude, сверка с сайтом, календарь', () => {
  // Только то, что сходится: настоящий день и номер аккаунта
  let notes: any = addPage([], { title: 'Sprint', board: {} }, 10).notes
  notes = addPage(notes, { title: 'Login', parent: 'pa', id: 'c1', due: '2026-11-05', taken: '583231' }, 11).notes
  notes = addPage(notes, { title: 'Tests', parent: 'pa', id: 'c2', due: '2026-02-30', taken: '@max' }, 11).notes
  notes = addPage(notes, { title: 'Page', id: 'p9', due: '2026-11-05' }, 11).notes
  expect(notes.find((p: any) => p.id === 'c1')).toMatchObject({ due: '2026-11-05', taken: '583231' })
  expect([notes.find((p: any) => p.id === 'c2'), notes.find((p: any) => p.id === 'p9')].map((p: any) => [p.due, p.taken])).toEqual([[undefined, undefined], [undefined, undefined]])
  // Переживают $.store; у подстраницы обычной страницы их нет
  const stored = JSON.parse(JSON.stringify([...notes, { id: 'p9a', title: 'Sub', body: '', parent: 'p9', at: 1, due: '2026-11-05', taken: '7' }]))
  const restored = restoreNotes(stored)
  expect(restored.find((p: any) => p.id === 'c1')).toMatchObject({ due: '2026-11-05', taken: '583231' })
  expect(restored.find((p: any) => p.id === 'p9a')).not.toHaveProperty('due')

  // updateCard: пустое — убрать, неверное — не трогать, не карточка — блокнот как был
  expect(updateCard(notes, 'c1', { taken: '' }, 20).find((p: any) => p.id === 'c1')).not.toHaveProperty('taken')
  expect(updateCard(notes, 'c1', { due: '2026-11-31' }, 20)).toBe(notes)
  expect(updateCard(notes, 'c1', { due: '2026-11-05' }, 20)).toBe(notes)
  expect(updateCard(notes, 'p9', { due: '2026-11-06' }, 20)).toBe(notes)
  expect(updateCard(notes, 'c2', { due: '2026-11-06', taken: '7' }, 20).find((p: any) => p.id === 'c2')).toMatchObject({ due: '2026-11-06', taken: '7', at: 20 })

  // Инструмент Claude: срок при создании и действием due; виден в списке и при чтении
  let made = 0
  const call = (input: any) => {
    const out = applyNotesTool(notes, input, 30, () => `c${++made + 2}`)
    notes = out.notes
    return out
  }
  expect(call({ action: 'create', title: 'Docs', parent: 'Sprint', due: '2026-11-03' }).text).toBe('Created card c3: Docs (card on Sprint, column To do, due 2026-11-03).')
  expect(call({ action: 'create', title: 'Bad', parent: 'Sprint', due: 'пт' })).toMatchObject({ isError: true, text: 'due must be a real date as YYYY-MM-DD, or "" to remove it.' })
  expect(call({ action: 'create', title: 'Bad', due: '2026-11-03' })).toMatchObject({ isError: true })
  expect(call({ action: 'due', page: 'Tests', due: '2026-11-04' })).toMatchObject({ text: 'Tests is due 2026-11-04.', changed: true })
  expect(call({ action: 'due', page: 'Tests', due: '2026-11-04' }).text).toBe('Tests is already due 2026-11-04.')
  expect(call({ action: 'due', page: 'Page', due: '2026-11-04' })).toMatchObject({ isError: true, text: 'Page is not a card on a board; only cards have a due date.' })
  expect(call({ action: 'due', page: 'Docs', due: '' })).toMatchObject({ text: 'Removed the due date of Docs.', changed: true })
  expect(call({ action: 'list' }).text).toBe('Notebook pages:\n- p9: Page\n- pa: Sprint [board: To do, Doing, Done]\n  - c1: Login (To do) (due 2026-11-05)\n  - c2: Tests (To do) (due 2026-11-04)\n  - c3: Docs (To do)')
  expect(call({ action: 'read', page: 'Login' }).text.split('\n')[0]).toBe('Page c1: Login (card on board Sprint, column To do, due 2026-11-05)')

  // Сверка: срок и кто взял уходят на сайт (null — нет) и приходят оттуда
  const B = 'b' + 'Q'.repeat(16)
  notes = updatePage(notes, 'pa', { board: { ...notes.find((p: any) => p.id === 'pa').board, share: B } }, 40)
  const base: any = { ...freshBase(notes, notes.find((p: any) => p.id === 'pa'), '583231'), rev: 1 }
  notes = updateCard(notes, 'c3', { due: '2026-11-09' }, 41)
  notes = updateCard(notes, 'c1', { taken: '' }, 41)
  expect(planSync(notes, base).ops).toEqual([
    { put: { id: 'c3', title: 'Docs', body: '', col: 'todo', pos: 2, taken: null, due: '2026-11-09' } },
    { put: { id: 'c1', title: 'Login', body: '', col: 'todo', pos: 0, taken: null, due: '2026-11-05' } },
  ])
  const answer = parseBoard({
    status: 200,
    ok: true,
    headers: {},
    text: JSON.stringify({
      board: { id: B, name: 'Sprint', owner: '583231', members: ['583231', '7'], cols: DEFAULT_COLS, rev: 5 },
      cards: [
        { id: 'c2', title: 'Tests', body: '', col: 'todo', pos: 1, due: null, taken: '7' },
        { id: 'c4', title: 'New', body: '', col: 'doing', pos: 0, due: '2026-11-02', taken: 'nobody' },
      ],
    }),
  })
  const out: any = applySync(notes, base, answer, { puts: {}, dels: [] }, 50)
  expect(out.changed).toEqual(['c2', 'c4'])
  expect(out.notes.find((p: any) => p.id === 'c2')).toMatchObject({ taken: '7', at: 50 })
  expect(out.notes.find((p: any) => p.id === 'c2')).not.toHaveProperty('due')
  expect(out.notes.find((p: any) => p.id === 'c4')).toMatchObject({ due: '2026-11-02', col: 'doing' })
  expect(out.notes.find((p: any) => p.id === 'c4')).not.toHaveProperty('taken')
  notes = out.notes

  // Календарь: сроки — события на весь день, сделанная карточка (последняя колонка) не напоминает
  notes = moveCard(notes, 'c1', { col: 'done' }, 60)
  const dues = cardDues(notes)
  expect(dues.map((x: any) => [x.id, x.day, x.remind, !!x.done])).toEqual([
    ['card-c4', '2026-11-02', 0, false],
    ['card-c1', '2026-11-05', null, true],
    ['card-c3', '2026-11-09', 0, false],
  ])
  expect(dues[0]).toMatchObject({ card: 'c4', board: 'Sprint', title: 'New' })
  const nine = new Date(2026, 10, 2, 9, 1).getTime()
  expect(dueReminders(dues, nine).due.map((x: any) => x.id)).toEqual(['card-c4'])
  expect(dueReminders(dues, nine - 2 * 60_000).due).toEqual([])
  expect(applyCalendarTool([], { action: 'list' }, T0, dues).text).toBe(
    'Today is Mon 2026-11-02, 12:00 local time.\nNo events from 2026-11-02 to 2026-11-08. The calendar is empty.\n' +
      'Board cards due from 2026-11-02 to 2026-11-08 (change them with the notes tool, action due):\n' +
      '- 2026-11-02: New (card c4 on board Sprint)\n- 2026-11-05: Login (card c1 on board Sprint, done)',
  )
})

test('итоги дня: журнал — что ушло Claude и что сделано, страница «Итоги» и текст для чата', () => {
  const hour = (time: string, day = '2026-11-02') => at(day, time)
  // Журнал из $.store: чужое и сломанное — прочь
  expect(
    restoreLog([
      { at: 1, kind: 'gave', id: 'p1', title: 'Релиз' },
      { at: 2, kind: 'done', id: 'c1', title: 'Логин', board: 'Sprint', by: 'claude' },
      { at: 3, kind: 'checked', id: 'p1', title: 'Релиз', n: 0, by: 'кто-то' },
      { at: 4, kind: 'deleted', id: 'p1', title: 'x' },
      { at: 5, kind: 'gave', id: 'P!', title: 'x' },
      { at: 6, kind: 'gave', id: 'p2', title: '' },
      null,
    ]),
  ).toEqual([
    { at: 1, kind: 'gave', id: 'p1', title: 'Релиз' },
    { at: 2, kind: 'done', id: 'c1', title: 'Логин', board: 'Sprint', by: 'claude' },
    { at: 3, kind: 'checked', id: 'p1', title: 'Релиз', n: 1 },
  ])
  expect(restoreLog('x')).toEqual([])
  // Старше двух недель — прочь; записей — не больше LOG_MAX
  const old = { at: hour('09:00') - LOG_DAYS * 86_400_000 - 1, kind: 'gave', id: 'p0', title: 'Старое' }
  expect(addLog([old], [{ at: hour('09:00'), kind: 'gave', id: 'p1', title: 'Релиз' }], hour('09:00')).map((x: any) => x.id)).toEqual(['p1'])
  const kept = [old]
  expect(addLog(kept, [], 0)).toBe(kept)
  expect(addLog([], Array.from({ length: LOG_MAX + 3 }, (_, i) => ({ at: 10 + i, kind: 'gave', id: `p${i}`, title: 'x' })), 10).length).toBe(LOG_MAX)

  // Что поменялось: карточка — в последнюю колонку своей доски, пункты чек-листа отмечены
  let notes: any = addPage([], { title: 'Sprint', board: {} }, 10).notes
  for (const [id, title, col] of [['c1', 'Логин', 'todo'], ['c2', 'Тесты', 'doing'], ['c3', 'Тег', 'todo'], ['c4', 'Пост', 'todo']]) notes = addPage(notes, { title, parent: 'pa', id, col }, 11).notes
  notes = addPage(notes, { title: 'Релиз', id: 'p9', body: '- [ ] тег\n- [ ] заметки\n- [ ] пост' }, 11).notes
  const t1 = hour('10:00')
  let next = moveCard(notes, 'c1', { col: 'done' }, t1)
  next = updatePage(next, 'p9', { body: '- [x] тег\n- [x] заметки\n- [ ] пост' }, t1)
  expect(noteChanges(notes, next, t1, 'me')).toEqual([
    { at: t1, kind: 'checked', id: 'p9', title: 'Релиз', by: 'me', n: 2 },
    { at: t1, kind: 'done', id: 'c1', title: 'Логин', board: 'Sprint', by: 'me' },
  ])
  // Перенос не в последнюю колонку, снятые отметки и новые страницы — не в итоги
  expect(noteChanges(next, moveCard(next, 'c1', { col: 'doing' }, t1), t1, 'me')).toEqual([])
  expect(noteChanges(next, notes, t1, 'me')).toEqual([])
  expect(noteChanges([], next, t1, 'me')).toEqual([])
  notes = next

  // Итоги дня: отданное сегодня, сделанное (кто — последним), отмеченное и что в работе
  const log = [
    { at: hour('09:00'), kind: 'gave', id: 'p9', title: 'Релиз' },
    { at: hour('09:30'), kind: 'gave', id: 'c3', title: 'Тег', board: 'Sprint' },
    { at: hour('10:00'), kind: 'done', id: 'c1', title: 'Логин', board: 'Sprint', by: 'me' },
    { at: hour('10:00'), kind: 'checked', id: 'p9', title: 'Релиз', by: 'me', n: 2 },
    { at: hour('11:00'), kind: 'done', id: 'c1', title: 'Логин', board: 'Sprint', by: 'claude' },
    { at: hour('18:00', '2026-11-01'), kind: 'gave', id: 'c4', title: 'Пост', board: 'Sprint' },
    { at: hour('18:00', '2026-11-01'), kind: 'checked', id: 'p9', title: 'Релиз', n: 1 },
    { at: hour('11:30'), kind: 'done', id: 'c8', title: 'Удалённая', board: 'Старая' },
  ]
  const sum: any = daySummary(log, notes, '2026-11-02')
  expect(sum.gave).toEqual([
    { id: 'p9', title: 'Релиз', board: '' },
    { id: 'c3', title: 'Тег', board: 'Sprint' },
  ])
  expect(sum.done.map((x: any) => [x.id, x.title, x.board, x.by])).toEqual([
    ['c1', 'Логин', 'Sprint', 'claude'],
    ['c8', 'Удалённая', 'Старая', 'me'],
  ])
  expect(sum.checked.map((x: any) => [x.id, x.n])).toEqual([['p9', 2]])
  // На своей доске в работе — средние колонки и отданное Claude; страница — пока в чек-листе есть пункты
  expect(sum.doing.map((x: any) => [x.title, x.board, x.col?.id ?? '', x.left ?? 0])).toEqual([
    ['Релиз', '', '', 1],
    ['Тег', 'Sprint', 'todo', 0],
    ['Пост', 'Sprint', 'todo', 0],
    ['Тесты', 'Sprint', 'doing', 0],
  ])
  // Отмеченных сейчас меньше, чем в журнале, — сколько есть; ни одного — не в итоги
  const unticked = updatePage(notes, 'p9', { body: '- [x] тег\n- [ ] заметки\n- [ ] пост' }, t1)
  expect(daySummary(log, unticked, '2026-11-02').checked.map((x: any) => x.n)).toEqual([1])
  expect(daySummary(log, updatePage(notes, 'p9', { body: 'всё' }, t1), '2026-11-02').checked).toEqual([])
  // Общая доска: в работе — только взятое мной и отданное моему Claude
  const shared = updateCard(updatePage(notes, 'pa', { board: { cols: DEFAULT_COLS, share: 'b' + 'Q'.repeat(16) } }, t1), 'c4', { taken: '583231' }, t1)
  expect(daySummary(log.slice(0, 5), shared, '2026-11-02', '583231').doing.map((x: any) => x.title)).toEqual(['Релиз', 'Тег', 'Пост'])

  // Текст страницы: разделы, доска и колонка — словами; пустой раздел — «Пусто.»
  const t = (text: string) => text
  const name = (c: any) => COL_NAMES[c.id as keyof typeof COL_NAMES]
  const body = summaryBody(sum, t, name)
  expect(body).toBe(
    [
      '## Отдано Claude',
      '- Релиз',
      '- Тег · доска «Sprint»',
      '',
      '## Сделано',
      '- ✓ Логин · доска «Sprint» · Claude',
      '- ✓ Удалённая · доска «Старая»',
      '- Релиз: отмечено пунктов — 2',
      '',
      '## В работе',
      '- Релиз: осталось пунктов — 1',
      '- Тег · доска «Sprint», колонка «Сделать»',
      '- Пост · доска «Sprint», колонка «Сделать»',
      '- Тесты · доска «Sprint», колонка «В работе»',
    ].join('\n'),
  )
  expect(summaryBody({ gave: [], done: [], checked: [], doing: [] }, t, name)).toBe('## Отдано Claude\nПусто.\n\n## Сделано\nПусто.\n\n## В работе\nПусто.')

  // В чат — текстом: заголовки с двоеточием, чек-лист значками, длинное — обрезано
  expect(chatText({ title: 'Итоги 02.11', body }, MAX_TEXT).split('\n').slice(0, 5)).toEqual(['Итоги 02.11', '', 'Отдано Claude:', '- Релиз', '- Тег · доска «Sprint»'])
  expect(chatText({ title: 'План', body: '## Шаги:\n- [x] тег\n  * [X] заметки\n- [ ] пост\n\n\n\nконец' }, MAX_TEXT)).toBe('План\n\nШаги:\n✓ тег\n  ✓ заметки\n☐ пост\n\nконец')
  expect(chatText({ title: 'A', body: 'x'.repeat(50) }, 10)).toBe('A\n\nxxxxxx…')
})

test('desks.js: ответы сайта про доски, основа из $.store, сверка — что уходит и что приходит', () => {
  const reply = (status: number, data: any) => ({ status, ok: status < 400, headers: {}, text: typeof data === 'string' ? data : JSON.stringify(data) })
  const B1 = 'b' + 'Q'.repeat(16)
  const B2 = 'b' + 'W'.repeat(16)
  expect([BOARD_ID.test(B1), BOARD_ID.test('bQQQ'), BOARD_ID.test(`${B1}\n`)]).toEqual([true, false, false])
  expect([cardId(), colId()].map((x) => /^c[0-9a-f]{15}$|^k[0-9a-f]{8}$/.test(x))).toEqual([true, true])
  expect([MAX_OWNED, DESK_MEMBERS]).toEqual([3, 20])

  // Ошибки сайта — понятным словом
  const fails: [number, any][] = [[400, { error: 'name' }], [400, {}], [403, { error: 'owner' }], [403, { error: 'friend' }], [404, { error: 'gone' }], [404, {}], [409, { error: 'many' }], [409, { error: 'x' }], [413, {}], [429, { error: 'often' }], [429, {}], [401, {}], [503, { error: 'off' }]]
  expect(fails.map(([s, d]) => boardFailure(reply(s, d), d))).toEqual(['name', 'invalid', 'owner', 'friend', 'gone', 'down', 'many', 'down', 'big', 'often', 'limit', 'auth', 'off'])
  expect(boardFailure(null, null)).toBe('down')

  // Список: доски как надо, ники — только как надо
  const listed = { id: B1, name: '  Проект\n', owner: 7, rev: 4, at: 50 }
  expect(parseBoards(reply(200, { me: { id: 583231 }, boards: [listed, { ...listed, id: 'bad' }, { ...listed, owner: 'x' }, { ...listed, id: B2, name: ' ', rev: -1 }], names: { 7: 'octo_pal', x: 'bad' } }))).toEqual({
    me: '583231',
    boards: [{ id: B1, name: 'Проект', owner: '7', rev: 4, at: 50 }],
    names: { 7: 'octo_pal' },
    error: '',
  })
  expect(parseBoards(reply(200, { boards: [] })).error).toBe('down')
  expect(parseBoards(reply(401, {})).error).toBe('auth')

  // Сверка: доска, карточки (и след удаления), что доска не взяла; чужой текст — чистим
  const board = { id: B1, name: 'Проект', owner: '7', members: ['7', 583231, '7', 'x'], cols: [{ id: 'todo' }, { id: 'k1', name: 'Своя' }], rev: 9 }
  const cards = [
    { id: 'c1', title: 'one\u001b[2J', body: 'a\r\nb', col: 'k1', pos: 1.5 },
    { id: 'c2', gone: true },
    { id: 'C!', title: 'x', body: '', col: 'todo', pos: 0 },
    { id: 'c3', title: ' ', body: '', col: 'todo', pos: 0 },
    { id: 'c4', title: 'four', body: '', col: 'BAD', pos: 2 },
  ]
  expect(parseBoard(reply(200, { board, cards, full: true, refused: ['c9', 'BAD!'], names: { 7: 'octo_pal' } }))).toEqual({
    board: { id: B1, name: 'Проект', owner: '7', members: ['7', '583231'], cols: [{ id: 'todo' }, { id: 'k1', name: 'Своя' }], rev: 9 },
    cards: [
      { id: 'c1', title: 'one [2J', body: 'a\nb', col: 'k1', pos: 1.5 },
      { id: 'c2', gone: true },
      { id: 'c4', title: 'four', body: '', col: '', pos: 2 },
    ],
    full: true,
    refused: ['c9'],
    names: { 7: 'octo_pal' },
    error: '',
  })
  expect(parseBoard(reply(200, { board: { ...board, cols: [] }, cards: [] })).error).toBe('down')
  expect(parseBoard(reply(409, { error: 'many' }))).toEqual({ board: null, cards: [], full: false, refused: [], names: {}, error: 'many' })
  expect(parseBoardDone(reply(200, { ok: true }))).toEqual({ board: null, left: true, names: {}, error: '' })
  expect(parseBoardDone(reply(200, { board, names: { 21: 'new_pal' } }))).toMatchObject({ board: { id: B1, rev: 9 }, left: false, names: { 21: 'new_pal' }, error: '' })
  expect(parseBoardDone(reply(403, { error: 'owner' })).error).toBe('owner')

  // Основа: только что взятая доска — rev 0, карточки блокнота считаются сверенными
  let notes: any = addPage([], { title: 'Проект', board: { share: B1 } }, 10).notes
  for (const [id, title] of [['c1', 'one'], ['c2', 'two'], ['c3', 'three']]) notes = addPage(notes, { title, parent: 'pa', id }, 11).notes
  let base: any = { ...freshBase(notes, notes.find((p: any) => p.id === 'pa'), '7'), rev: 4 }
  expect(base).toEqual({ page: 'pa', rev: 4, name: 'Проект', cols: DEFAULT_COLS, owner: '7', members: [], names: {}, cards: { c1: 11, c2: 11, c3: 11 }, held: {} })
  expect(planSync(notes, base)).toEqual({ ops: [], sent: { puts: {}, dels: [] } })

  // Здесь: название, колонка, правка, удаление, новая карточка — уходят по порядку
  notes = updatePage(notes, 'pa', { title: 'Проект X' }, 12)
  notes = renameColumn(notes, 'pa', 'done', 'Сдано', 12).notes
  notes = updatePage(notes, 'c1', { body: 'текст' }, 13)
  notes = removePage(notes, 'c2')
  notes = addPage(notes, { title: 'four', parent: 'pa', id: 'c4' }, 14).notes
  const cols = [{ id: 'todo' }, { id: 'doing' }, { id: 'done', name: 'Сдано' }]
  const plan = planSync(notes, base)
  expect(plan).toEqual({
    ops: [{ name: 'Проект X' }, { cols }, { del: 'c2' }, { put: { id: 'c4', title: 'four', body: '', col: 'todo', pos: 3, taken: null, due: null } }, { put: { id: 'c1', title: 'one', body: 'текст', col: 'todo', pos: 0, taken: null, due: null } }],
    sent: { name: 'Проект X', cols, puts: { c4: 14, c1: 13 }, dels: ['c2'] },
  })

  // Ответ: чужая правка и новая карточка — в блокнот; c1 поправили, пока шла сверка, — не трогаем; c4 доска не взяла
  notes = updatePage(notes, 'c1', { body: 'ещё' }, 16)
  const answer = parseBoard(
    reply(200, {
      board: { id: B1, name: 'Проект X', owner: '7', members: ['7', '583231'], cols, rev: 9 },
      cards: [
        { id: 'c3', title: 'three!', body: '', col: 'doing', pos: 0 },
        { id: 'c5', title: 'five', body: 'x', col: 'done', pos: 0 },
        { id: 'c1', title: 'one', body: 'текст', col: 'todo', pos: 0 },
      ],
      refused: ['c4'],
      names: { 7: 'octo_pal' },
    }),
  )
  let out: any = applySync(notes, base, answer, plan.sent, 20)
  expect(out).toMatchObject({ refused: ['c4'], missed: false, changed: ['c3', 'c5'] })
  expect(out.base).toEqual({ page: 'pa', rev: 9, name: 'Проект X', cols, owner: '7', members: ['7', '583231'], names: { 7: 'octo_pal' }, cards: { c1: 13, c3: 20, c5: 20 }, held: { c4: 14 } })
  notes = out.notes
  base = out.base
  expect(notes.find((p: any) => p.id === 'c3')).toMatchObject({ title: 'three!', col: 'doing', at: 20 })
  expect(notes.find((p: any) => p.id === 'c5')).toMatchObject({ title: 'five', body: 'x', parent: 'pa', col: 'done', pos: 0 })
  expect(notes.find((p: any) => p.id === 'c1').body).toBe('ещё')
  // Следующая сверка: c1 — снова; c4, которую доска не взяла, — только когда её снова поправят
  expect(planSync(notes, base).ops).toEqual([{ put: { id: 'c1', title: 'one', body: 'ещё', col: 'todo', pos: 0, taken: null, due: null } }])
  expect(planSync(updatePage(notes, 'c4', { body: '!' }, 21), base).ops.map((op: any) => op.put.id)).toEqual(['c4', 'c1'])

  // На сайте: c3 удалили, доску переименовали — здесь название не трогали, значит как на сайте
  const none = { puts: {}, dels: [] }
  out = applySync(notes, base, parseBoard(reply(200, { board: { ...answer.board, name: 'Проект Y', rev: 10 }, cards: [{ id: 'c3', gone: true }] })), none, 22)
  expect([out.changed, out.base.rev, out.base.name, out.notes.find((p: any) => p.id === 'pa').title, out.notes.some((p: any) => p.id === 'c3')]).toEqual([['c3'], 10, 'Проект Y', 'Проект Y', false])
  // Доска целиком: сверенной карточки на сайте нет — нет и здесь; поправленная здесь и несверенная — остаются
  out = applySync(out.notes, out.base, parseBoard(reply(200, { board: { ...answer.board, name: 'Проект Y', rev: 11 }, cards: [], full: true })), none, 23)
  expect([out.changed, out.notes.filter((p: any) => p.parent === 'pa').map((p: any) => p.id), out.base.cards]).toEqual([['c5'], ['c4', 'c1'], {}])
  // Доски в блокноте уже нет — ничего
  expect(applySync(removePage(notes, 'pa'), base, answer, none, 24)).toBeNull()

  // Основы переживают $.store; доски, которой нет в блокноте или она не общая, — нет
  const saved = JSON.parse(JSON.stringify({ [B1]: { ...base, members: ['7', 'x', '7'], cards: { ...base.cards, 'BAD!': 1 } }, [B2]: { ...base, page: 'nope' }, bad: base }))
  expect(restoreDesks(saved, notes)).toEqual({ [B1]: { ...base, members: ['7'] } })
  expect(restoreDesks(saved, detachBoard(notes, 'pa', 30))).toEqual({})
  expect([restoreDesks(null, notes), restoreDesks([], notes)]).toEqual([{}, {}])

  // Доска больше не общая — остаётся своей; чужая из списка — новая доска без карточек и её основа
  expect(detachBoard(notes, 'pa', 30).find((p: any) => p.id === 'pa').board).toEqual({ cols })
  const plain = addPage([], { title: 'Своя', board: {} }, 1).notes
  expect(detachBoard(plain, 'p1', 2)).toBe(plain)
  const adopted: any = adoptBoard([], { id: B2, name: 'Общая', owner: '21', rev: 3, at: 0 }, 50)
  expect(adopted.page).toEqual({ id: 'p1e', title: 'Общая', body: '', parent: null, at: 50, board: { cols: DEFAULT_COLS, share: B2 } })
  expect(adopted.base).toEqual({ page: 'p1e', rev: 0, name: 'Общая', cols: DEFAULT_COLS, owner: '21', members: [], names: {}, cards: {}, held: {} })
  const fullNotes = Array.from({ length: MAX_PAGES }, (_, i) => ({ id: `p${i}`, title: 't', body: '', parent: null, at: 0 }))
  expect(adoptBoard(fullNotes, { id: B2, name: 'Общая', owner: '21', rev: 3, at: 0 }, 50)).toEqual({ error: 'full' })
})

test('блокнот: «Работа» → «Блокнот», страница с чек-листом, текст, подстраница, название и удаление вторым нажатием', async ($, on) => {
  const { clock, saved } = stubs(on)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const pages = () => saved.get('notes') as any[]
  expect(await ui.find({ key: 'arcade-fold-work' })).toMatchObject({ props: { label: '▾ Работа' } })
  expect(await text('  страницы и чек-листы; Claude может дополнять')).toBeDefined()
  await ui.press({ key: 'arcade-menu-notes' })
  expect(await text('Arcade · блокнот')).toBeDefined()
  expect(await text('Страниц пока нет — впиши название новой выше.')).toBeDefined()
  expect(await ui.find({ key: await noteKey(ui, 'arcade-note-new-') })).toMatchObject({ props: { label: 'Новая страница', submitLabel: 'Создать', autoFocus: true } })

  // Новая страница открывается сразу, фокус — в «Новый пункт»
  await noteInput(ui, 'arcade-note-new-', '  План на неделю ')
  const id = pages()[0].id
  expect(pages()).toMatchObject([{ id, title: 'План на неделю', body: '', parent: null }])
  expect(await text('План на неделю')).toBeDefined()
  expect(await text('Страница пустая — нажми «Редактировать» или впиши пункт ниже.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-note-edit' })).toMatchObject({ props: { label: 'Редактировать' } })
  expect(await ui.find({ key: 'arcade-note-copy' })).toBeUndefined()
  expect(await ui.find({ key: await noteKey(ui, 'arcade-note-add-') })).toMatchObject({ props: { label: 'Новый пункт', submitLabel: 'Добавить', autoFocus: true } })

  // Каждая строка — пункт чек-листа, «- » и «- [ ] » не удваиваются
  await noteInput(ui, 'arcade-note-add-', 'тесты\n- [ ] ревью\n- молоко\n ')
  expect(pages()[0].body).toBe('- [ ] тесты\n- [ ] ревью\n- [ ] молоко')
  expect(await labels(ui, 'arcade-note-line-', 4)).toEqual(['☐ тесты', '☐ ревью', '☐ молоко', undefined])
  await ui.press({ key: 'arcade-note-line-0' })
  expect(await ui.find({ key: 'arcade-note-line-0' })).toMatchObject({ props: { label: '☑ тесты', dimColor: true, autoFocus: true } })
  expect(pages()[0].body).toBe('- [x] тесты\n- [ ] ревью\n- [ ] молоко')

  // Поля «Текст» нет, пока не нажата «Редактировать»: тогда оно — на месте текста и чек-листа, фокус в нём
  expect(await ui.find({ key: 'arcade-note-copy' })).toMatchObject({ props: { label: 'Копировать' } })
  expect(await noteKey(ui, 'arcade-note-text-')).toBeUndefined()
  await ui.press({ key: 'arcade-note-edit' })
  expect(await ui.find({ key: await noteKey(ui, 'arcade-note-text-') })).toMatchObject({ props: { label: 'Текст', value: '- [x] тесты\n- [ ] ревью\n- [ ] молоко', submitLabel: 'Сохранить', autoFocus: true } })
  expect(await ui.find({ key: 'arcade-note-line-0' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-note-edit' })).toBeUndefined()
  // «Отмена» — набранное пропадает, страница как была, фокус — на «Редактировать»
  await noteInput(ui, 'arcade-note-text-', '# Неделя', 'change')
  await ui.press({ key: 'arcade-note-cancel' })
  expect(pages()[0].body).toBe('- [x] тесты\n- [ ] ревью\n- [ ] молоко')
  expect(await noteKey(ui, 'arcade-note-text-')).toBeUndefined()
  expect(await ui.find({ key: 'arcade-note-edit' })).toMatchObject({ props: { autoFocus: true } })
  expect(await ui.find({ key: 'arcade-note-line-0' })).toMatchObject({ props: { label: '☑ тесты' } })
  // Enter — сохранить и закрыть правку
  await ui.press({ key: 'arcade-note-edit' })
  expect(await ui.find({ key: await noteKey(ui, 'arcade-note-text-') })).toMatchObject({ props: { value: '- [x] тесты\n- [ ] ревью\n- [ ] молоко' } })
  await noteInput(ui, 'arcade-note-text-', '# Неделя\n- [ ] тесты\n- [ ] ревью\n\n* созвон в пятницу')
  expect(await text('Сохранено.')).toBeDefined()
  expect(await noteKey(ui, 'arcade-note-text-')).toBeUndefined()
  expect(await ui.find({ key: 'arcade-note-edit' })).toMatchObject({ props: { autoFocus: true } })
  expect(await ui.find({ key: 'arcade-note-line-1' })).toMatchObject({ props: { label: '☐ тесты' } })
  expect(await text('• созвон в пятницу')).toBeDefined()
  expect(pages()[0].body).toBe('# Неделя\n- [ ] тесты\n- [ ] ревью\n\n* созвон в пятницу')

  // Название: пустое — нельзя
  await noteInput(ui, 'arcade-note-title-', '   ')
  expect(await text('Впиши название страницы.')).toBeDefined()
  expect(pages()[0].title).toBe('План на неделю')
  await noteInput(ui, 'arcade-note-title-', 'Неделя 43')
  expect(pages()[0].title).toBe('Неделя 43')
  expect(await text('Неделя 43')).toBeDefined()

  // Подстраница: своей «Подстраницы» у неё нет, «Назад» — к странице
  expect(await ui.find({ key: 'arcade-note-delete' })).toMatchObject({ props: { label: 'Удалить страницу' } })
  await noteInput(ui, 'arcade-note-sub-', 'Покупки')
  const sub = pages().find((p) => p.parent === id)
  expect(sub).toMatchObject({ title: 'Покупки', body: '' })
  expect(await ui.find({ key: 'arcade-back' })).toMatchObject({ props: { label: '← Неделя 43' } })
  expect(await noteKey(ui, 'arcade-note-sub-')).toBeUndefined()
  expect(await text('Подстраницы')).toBeUndefined()
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: `arcade-note-page-${sub.id}` })).toMatchObject({ props: { label: 'Покупки', autoFocus: true } })

  // Список: страница, под ней подстрочка — сколько отмечено и первая строка; подстраница — со стрелкой
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: `arcade-note-page-${id}` })).toMatchObject({ props: { label: 'Неделя 43', autoFocus: true } })
  expect(await text('  ☑ 0/2 · Неделя')).toBeDefined()
  expect(await ui.find({ key: `arcade-note-page-${sub.id}` })).toMatchObject({ props: { label: '↳ Покупки' } })
  expect(await text('  пустая страница')).toBeDefined()

  // Удаление — вторым нажатием, вместе с подстраницами; уход со страницы отменяет первое нажатие
  await ui.press({ key: `arcade-note-page-${id}` })
  expect(await ui.find({ key: 'arcade-note-delete' })).toMatchObject({ props: { label: 'Удалить страницу и подстраницы' } })
  await ui.press({ key: 'arcade-note-delete' })
  expect(await ui.find({ key: 'arcade-note-delete' })).toMatchObject({ props: { label: 'Нажми ещё раз — удалить навсегда' } })
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: `arcade-note-page-${id}` })
  expect(await ui.find({ key: 'arcade-note-delete' })).toMatchObject({ props: { label: 'Удалить страницу и подстраницы' } })
  await ui.press({ key: 'arcade-note-delete' })
  await ui.press({ key: 'arcade-note-delete' })
  expect(pages()).toEqual([])
  expect(await text('Страница удалена.')).toBeDefined()
  expect(await text('Страниц пока нет — впиши название новой выше.')).toBeDefined()
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-menu-notes' })).toMatchObject({ props: { autoFocus: true } })
  await ui.unmount()
})

test('доска проектов: «Работа» → доска, карточки, выбор и перенос, карточка-страница, колонки, Claude и удаление', async ($, on) => {
  const { clock, saved, submits } = stubs(on, { submit: true })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const pages = () => saved.get('notes') as any[]
  const titles = (col: string) => columnCards(pages(), pages().find(isBoard), col).map((p: any) => p.title)
  expect(await text('  колонки и карточки; общие — с друзьями')).toBeDefined()
  await ui.press({ key: 'arcade-menu-boards' })
  expect(await text('Arcade · доска проектов')).toBeDefined()
  expect(await text('Досок пока нет — впиши название новой выше.')).toBeDefined()
  expect(await text('Войди через GitHub — и сможешь вести доску вместе с друзьями.')).toBeDefined()
  expect(await ui.find({ key: await noteKey(ui, 'arcade-board-new-') })).toMatchObject({ props: { label: 'Новая доска', submitLabel: 'Создать', autoFocus: true } })

  // Новая доска открывается сразу: три колонки, курсор — в «Новой карточке» первой
  await noteInput(ui, 'arcade-board-new-', '  Релиз 1.0 ')
  const id = pages()[0].id
  expect(pages()).toEqual([{ id, title: 'Релиз 1.0', body: '', parent: null, at: expect.any(Number), board: { cols: DEFAULT_COLS } }])
  expect(await text('Релиз 1.0')).toBeDefined()
  for (const t of ['Сделать · 0', 'В работе · 0', 'Готово · 0']) expect(await text(t)).toBeDefined()
  expect(await ui.find({ key: await noteKey(ui, 'arcade-card-new-todo-') })).toMatchObject({ props: { label: 'Новая карточка', submitLabel: 'Добавить', autoFocus: true } })
  expect(await text('Нажми на карточку, чтобы выбрать её и переносить стрелками; ещё раз — открыть.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-board-login' })).toMatchObject({ props: { label: 'Войти через GitHub' } })

  // Карточки — вниз своей колонки; курсор остаётся в поле этой колонки
  await noteInput(ui, 'arcade-card-new-todo-', 'Логин')
  await noteInput(ui, 'arcade-card-new-todo-', 'Тесты')
  await noteInput(ui, 'arcade-card-new-doing-', 'Тег')
  expect(await ui.find({ key: await noteKey(ui, 'arcade-card-new-doing-') })).toMatchObject({ props: { autoFocus: true } })
  const card = (title: string) => pages().find((p) => p.title === title).id
  const [login, tests, tag] = ['Логин', 'Тесты', 'Тег'].map(card)
  expect(pages().find((p) => p.id === login)).toMatchObject({ parent: id, col: 'todo', pos: 0 })
  expect(login).toMatch(/^c[0-9a-f]{15}$/)
  expect([titles('todo'), titles('doing')]).toEqual([['Логин', 'Тесты'], ['Тег']])
  expect(await text('Сделать · 2')).toBeDefined()

  // Первое нажатие выбирает карточку, стрелки переносят её; фокус — на нажатой стрелке
  await ui.press({ key: `arcade-card-${login}` })
  expect(await ui.find({ key: `arcade-card-${login}` })).toMatchObject({ props: { label: '▸ Логин', autoFocus: true } })
  expect(await text('Выбрана карточка: Логин')).toBeDefined()
  await ui.press({ key: 'arcade-board-right' })
  expect(titles('doing')).toEqual(['Тег', 'Логин'])
  expect(await ui.find({ key: 'arcade-board-right' })).toMatchObject({ props: { label: 'Вправо →', autoFocus: true } })
  await ui.press({ key: 'arcade-board-up' })
  expect(titles('doing')).toEqual(['Логин', 'Тег'])
  await ui.press({ key: 'arcade-board-up' })
  expect(titles('doing')).toEqual(['Логин', 'Тег'])
  await ui.press({ key: 'arcade-board-unpick' })
  expect(await ui.find({ key: `arcade-card-${login}` })).toMatchObject({ props: { label: 'Логин', autoFocus: true } })
  expect(await text('Нажми на карточку, чтобы выбрать её и переносить стрелками; ещё раз — открыть.')).toBeDefined()

  // Второе нажатие открывает карточку — страницу блокнота: колонка и перенос — и здесь, «Назад» — к доске
  await ui.press({ key: `arcade-card-${login}` })
  await ui.press({ key: `arcade-card-${login}` })
  expect(await ui.find({ key: 'arcade-back' })).toMatchObject({ props: { label: '← Релиз 1.0' } })
  expect(await text('Колонка: В работе')).toBeDefined()
  for (const [where, label] of [['left', '← Влево'], ['up', '↑ Выше'], ['down', '↓ Ниже'], ['right', 'Вправо →']]) expect(await ui.find({ key: `arcade-note-move-${where}` })).toMatchObject({ props: { label } })
  expect(await noteKey(ui, 'arcade-note-sub-')).toBeUndefined()
  await noteInput(ui, 'arcade-note-add-', 'кнопка входа')
  await ui.press({ key: 'arcade-note-move-right' })
  expect(await text('Колонка: Готово')).toBeDefined()
  expect(await ui.find({ key: 'arcade-note-move-right' })).toMatchObject({ props: { autoFocus: true } })
  expect(pages().find((p) => p.id === login)).toMatchObject({ col: 'done', body: '- [ ] кнопка входа' })
  await ui.press({ key: 'arcade-back' })
  expect(await text('Arcade · доска проектов')).toBeDefined()
  expect(await ui.find({ key: `arcade-card-${login}` })).toMatchObject({ props: { label: 'Логин', autoFocus: true } })
  expect(await text('  ☑ 0/1')).toBeDefined()
  expect(await text('Готово · 1')).toBeDefined()

  // Колонки: новая — в конец, своё название, с карточками не убрать
  await noteInput(ui, 'arcade-col-new-', 'Проверка')
  const extra = pages().find(isBoard).board.cols[3]
  expect(extra).toEqual({ id: expect.stringMatching(/^k[0-9a-f]{8}$/), name: 'Проверка' })
  expect(await text('Проверка · 0')).toBeDefined()
  expect(await ui.find({ key: await noteKey(ui, 'arcade-col-new-') })).toMatchObject({ props: { label: 'Новая колонка', autoFocus: true } })
  await noteInput(ui, 'arcade-col-name-doing-', 'Идёт')
  expect(await text('Идёт · 1')).toBeDefined()
  expect(await text('Сохранено.')).toBeDefined()
  await ui.press({ key: 'arcade-col-drop-doing' })
  expect(await text('В колонке есть карточки — сначала перенеси их.')).toMatchObject({ props: { color: 'warning' } })
  await ui.press({ key: `arcade-col-drop-${extra.id}` })
  expect(await text('Колонка убрана.')).toBeDefined()
  expect(pages().find(isBoard).board.cols).toEqual([{ id: 'todo' }, { id: 'doing', name: 'Идёт' }, { id: 'done' }])
  await noteInput(ui, 'arcade-board-title-', '  ')
  expect(await text('Впиши название доски.')).toBeDefined()
  await noteInput(ui, 'arcade-board-title-', 'Релиз 1.1')
  expect(await text('Релиз 1.1')).toBeDefined()

  // Доска — Claude: колонки и карточки с id, чтобы он вёл их инструментом блокнота
  await ui.press({ key: 'arcade-board-send' })
  expect(submits.map((s) => s.text)).toEqual([
    [
      `Доска проектов из моего блокнота Arcade (id ${id}):`,
      '',
      '# Релиз 1.1',
      '',
      '## Сделать (колонка todo)',
      `- Тесты (id ${tests})`,
      '',
      '## Идёт (колонка doing)',
      `- Тег (id ${tag})`,
      '',
      '## Готово (колонка done)',
      `- Логин (id ${login}) ☑ 0/1`,
      '',
      `Добавляй, правь и переноси карточки этой доски инструментом ${NOTES}.`,
    ].join('\n'),
  ])
  expect(await text('Доска ушла Claude.')).toBeDefined()

  // Список досок: плитка с числом карточек; в блокноте досок и карточек нет — туда ведёт «Доска проектов»
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: `arcade-desk-${id}` })).toMatchObject({ props: { label: 'Релиз 1.1', autoFocus: true } })
  expect(await text('  карточек: 3')).toBeDefined()
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-menu-boards' })).toMatchObject({ props: { autoFocus: true } })
  await ui.press({ key: 'arcade-menu-notes' })
  expect(await text('Страниц пока нет — впиши название новой выше.')).toBeDefined()
  expect(await ui.find({ key: `arcade-note-page-${id}` })).toBeUndefined()
  await ui.press({ key: 'arcade-note-boards' })
  expect(await text('Arcade · доска проектов')).toBeDefined()

  // Удаление — вторым нажатием, вместе с карточками
  await ui.press({ key: `arcade-desk-${id}` })
  await ui.press({ key: 'arcade-board-delete' })
  expect(await ui.find({ key: 'arcade-board-delete' })).toMatchObject({ props: { label: 'Нажми ещё раз — удалить навсегда' } })
  await ui.press({ key: 'arcade-board-delete' })
  expect(pages()).toEqual([])
  expect(await text('Доска удалена.')).toBeDefined()
  expect(await text('Досок пока нет — впиши название новой выше.')).toBeDefined()
  await ui.unmount()
})

test('Desktop: доска — «Новая карточка» без подписи слева, колонки ровными строками, действия — карточками с иконками', async ($, on) => {
  const { clock, saved } = stubs(on)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const pages = () => saved.get('notes') as any[]
  await ui.press({ key: 'arcade-menu-boards' })
  await noteInput(ui, 'arcade-board-new-', 'Релиз')
  // В узкой колонке подпись слева сжимала поле до пары букв: подсказка — в самом поле
  const cardNew = await ui.find({ key: await noteKey(ui, 'arcade-card-new-todo-') })
  expect(cardNew).toMatchObject({ props: { placeholder: 'Новая карточка', submitLabel: 'Добавить', autoFocus: true } })
  expect(cardNew.props.label).toBeUndefined()
  await noteInput(ui, 'arcade-card-new-todo-', 'Логин')
  expect(pages().find((p) => p.title === 'Логин')).toMatchObject({ col: 'todo' })
  // Колонки: поле без подписи и «Убрать колонку» — в одной строке, поля встают ровно друг под другом
  for (const col of ['todo', 'doing', 'done']) {
    const line = await ui.find({ key: `col-row-${col}` })
    expect(line).toMatchObject({ props: { flexDirection: 'row' } })
    expect(JSON.stringify(line)).toContain(`"arcade-col-drop-${col}"`)
    const name = await ui.find({ key: await noteKey(ui, `arcade-col-name-${col}-`) })
    expect(name.props.label).toBeUndefined()
  }
  const colNew = await ui.find({ key: await noteKey(ui, 'arcade-col-new-') })
  expect(colNew).toMatchObject({ props: { placeholder: 'Новая колонка' } })
  expect(colNew.props.label).toBeUndefined()
  // Строки колонок и «Общий доступ» не слипаются: между ними промежуток по высоте
  const cols = await ui.find({ key: 'board-cols' })
  expect(cols).toMatchObject({ props: { flexDirection: 'column', rowGap: 'sm' } })
  for (const key of ['col-row-todo', 'col-row-done', await noteKey(ui, 'arcade-col-new-')]) expect(JSON.stringify(cols)).toContain(`"${key}"`)
  const shareBlock = await ui.find({ key: 'board-share' })
  expect(shareBlock).toMatchObject({ props: { flexDirection: 'column', rowGap: 'sm' } })
  expect(JSON.stringify(shareBlock)).toContain('"card-arcade-board-login"')
  // «Отдать Claude», «Удалить доску» и «Войти через GitHub» — карточки со своими иконками и описанием
  const [send, remove, login] = await Promise.all(['arcade-board-send', 'arcade-board-delete', 'arcade-board-login'].map(async (key) => JSON.stringify(await ui.find({ key: `card-${key}` }))))
  expect(send).toContain('Claude получит доску с карточками и сможет добавлять, править и переносить их.')
  expect(remove).toContain('Доска удалится вместе с колонками и карточками.')
  expect(login).toContain('Войди через GitHub — и сможешь вести доску вместе с друзьями.')
  const icon = (card: string) => /"source":"((?:[^"\\]|\\.)*)"/.exec(card)![1]
  expect(new Set([send, remove, login].map(icon)).size).toBe(3)
  // Плитка удаления жмётся как кнопка: второе нажатие удаляет доску
  await ui.press({ key: 'arcade-board-delete' })
  expect(await ui.find({ key: 'arcade-board-delete' })).toMatchObject({ props: { label: 'Нажми ещё раз — удалить навсегда' } })
  await ui.press({ key: 'arcade-board-delete' })
  expect(pages()).toEqual([])
  await ui.unmount()
})

// Сайт с общими досками octocat поверх chatsSite (друзья octo_pal 7 и new_pal 21). Карточка помнит номер правки доски
// (r): сверка отдаёт поменявшиеся после since по порядку, удалённые — следами { id, gone }; since 0 — доску целиком.
// board() заводит доску на сайте, put() — правка карточки за друга
function boardsSite() {
  const site = chatsSite()
  const ME = OCTO.id
  const names: Record<string, string> = { [ME]: 'octocat', 7: 'octo_pal', 21: 'new_pal' }
  const boards: Record<string, any> = {}
  let made = 0
  const about = (b: any) => ({ id: b.id, name: b.name, owner: b.owner, members: b.members, cols: b.cols, rev: b.rev })
  const put = (b: any, c: any) => {
    b.cards[c.id] = { ...c, r: ++b.rev }
  }
  const board = (name: string, owner: string, members: string[], cards: any[] = [], cols: any[] = DEFAULT_COLS) => {
    const b = { id: `b${String(++made).padStart(16, '0')}`, name, owner, members, cols, rev: 1, cards: {} as Record<string, any> }
    boards[b.id] = b
    for (const c of cards) put(b, c)
    return b
  }
  const changed = (b: any, since: number) =>
    Object.values(b.cards)
      .filter((c: any) => c.r > since && !(since === 0 && c.gone))
      .sort((x: any, y: any) => x.r - y.r)
      .map(({ r, ...c }: any) => c)
  const gone = { status: 404, json: { error: 'gone' } }
  const mine = (id: string) => (boards[id]?.members.includes(ME) ? boards[id] : null)
  const routes: Record<string, (request: any) => any> = {
    'GET api/me/boards': () => ({
      json: { me: { id: ME }, boards: Object.values(boards).filter((b) => b.members.includes(ME)).map((b) => ({ id: b.id, name: b.name, owner: b.owner, rev: b.rev, at: 0 })), names },
    }),
    'POST api/me/boards/new': ({ body }) => {
      if (body.members.some((m: string) => !['7', '21'].includes(m))) return { status: 403, json: { error: 'friend' } }
      return { json: { board: about(board(body.name, ME, [ME, ...body.members], [], body.cols)), cards: [], full: true, names } }
    },
    'POST api/me/boards/sync': ({ body }) => {
      const b = mine(body.board)
      if (!b) return gone
      for (const op of body.ops) {
        if (op.name) b.name = op.name
        if (op.cols) b.cols = op.cols
        if (op.name || op.cols) b.rev++
        if (op.del) b.cards[op.del] = { id: op.del, gone: true, r: ++b.rev }
        if (op.put) put(b, op.put)
      }
      return { json: { board: about(b), cards: changed(b, body.since), ...(body.since === 0 ? { full: true } : {}), ...(body.names ? { names } : {}) } }
    },
    'POST api/me/boards/members': ({ body }) => {
      const b = mine(body.board)
      if (!b) return gone
      if (body.leave) {
        b.members = b.members.filter((m: string) => m !== ME)
        return { json: { ok: true } }
      }
      if (b.owner !== ME) return { status: 403, json: { error: 'owner' } }
      b.members = [...b.members.filter((m: string) => !(body.remove ?? []).includes(m)), ...(body.add ?? [])]
      b.rev++
      return { json: { board: about(b), names } }
    },
    'POST api/me/boards/delete': ({ body }) => {
      const b = mine(body.board)
      if (!b) return gone
      if (b.owner !== ME) return { status: 403, json: { error: 'owner' } }
      delete boards[b.id]
      return { json: { ok: true } }
    },
  }
  const api = (path: string, request: any) => {
    const route = routes[`${request.method} ${path}`]
    return route ? route(request) : site.api(path, request)
  }
  return { api, boards, board, put }
}

test('доска проектов с друзьями: поделиться, правки уходят и приходят, позвать и убрать, удалить с сайта, чужие доски', HEAVY, async ($, on) => {
  const { api, boards, board, put } = boardsSite()
  const { clock, requests, saved } = stubs(on, { env: WINDOWS, api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  // Мимо отправки правок после старта (4 с): дальше правки уходят по своему таймеру
  await clock.advance(4_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const pages = () => saved.get('notes') as any[]
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  const write = async (prefix: string, value: string) => {
    await noteInput(ui, prefix, value)
    await clock.settle()
  }
  await press('arcade-menu-boards')
  expect(sent(requests, 'api/me/boards', 'GET').length).toBe(1)
  expect(await text('Общие доски друзей появляются здесь сами.')).toBeDefined()
  await write('arcade-board-new-', 'Релиз')
  const id = pages()[0].id
  await write('arcade-card-new-todo-', 'Логин')
  const login = pages().find((p) => p.title === 'Логин').id

  // Поделиться: отметить друзей галочками; без отметок — заметка
  expect(await text('Отметь друзей и нажми «Поделиться» — доска станет общей: карточки, колонки и название у всех одни.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-desk-pick-7' })).toMatchObject({ props: { label: '☐ @octo_pal' } })
  await press('arcade-board-share')
  expect(await text('Отметь хотя бы одного друга.')).toMatchObject({ props: { color: 'warning' } })
  await press('arcade-desk-pick-7')
  expect(await ui.find({ key: 'arcade-desk-pick-7' })).toMatchObject({ props: { label: '☑ @octo_pal' } })
  await press('arcade-board-share')
  expect(sent(requests, 'api/me/boards/new', 'POST').map((r) => r.body)).toEqual([{ name: 'Релиз', cols: DEFAULT_COLS, members: ['7'] }])
  const share = pages().find(isBoard).board.share
  expect(share).toMatch(BOARD_ID)
  // Карточки уходят первой сверкой
  expect(sent(requests, 'api/me/boards/sync', 'POST')[0].body).toEqual({ board: share, since: 1, ops: [{ put: { id: login, title: 'Логин', body: '', col: 'todo', pos: 0, taken: null, due: null } }], names: true })
  expect(Object.values(boards[share].cards).map((c: any) => c.title)).toEqual(['Логин'])
  expect(await text('Доска общая — друзья увидят её в своей «Доске проектов».')).toBeDefined()
  expect(await text('Общая доска — ты хозяин.')).toBeDefined()
  expect(await text('@octocat · хозяин доски')).toBeDefined()
  expect(await ui.find({ key: 'arcade-desk-drop-7' })).toMatchObject({ props: { label: 'Убрать' } })
  expect(await ui.find({ key: 'arcade-desk-pick-7' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-desk-pick-21' })).toMatchObject({ props: { label: '☐ @new_pal' } })
  expect(await ui.find({ key: 'arcade-board-off' })).toMatchObject({ props: { label: 'Удалить с сайта' } })
  expect(await ui.find({ key: 'arcade-board-delete' })).toBeUndefined()

  // Правка уходит на сайт не сразу, а чуть погодя — несколько правок одной сверкой
  await write('arcade-card-new-todo-', 'Тесты')
  await write('arcade-card-new-todo-', 'Тег')
  expect(Object.keys(boards[share].cards).length).toBe(1)
  const syncs = sent(requests, 'api/me/boards/sync', 'POST').length
  await clock.advance(1_500)
  await clock.settle()
  expect(sent(requests, 'api/me/boards/sync', 'POST').length).toBe(syncs + 1)
  expect(Object.values(boards[share].cards).map((c: any) => c.title).sort()).toEqual(['Логин', 'Тег', 'Тесты'])

  // Правки друга приходят сверкой открытой доски: карточка, новая карточка, название колонки
  const b = boards[share]
  put(b, { ...b.cards[login], title: 'Логин через GitHub', col: 'doing' })
  put(b, { id: 'cpal1', title: 'Ревью', body: '- [x] код\n- [ ] тесты', col: 'done', pos: 0 })
  b.cols = [{ id: 'todo' }, { id: 'doing' }, { id: 'done', name: 'Сдано' }]
  b.rev++
  await clock.advance(6_000)
  await clock.settle()
  expect(pages().find((p) => p.id === login)).toMatchObject({ title: 'Логин через GitHub', col: 'doing' })
  expect(await text('В работе · 1')).toBeDefined()
  expect(await text('Сдано · 1')).toBeDefined()
  expect(await ui.find({ key: 'arcade-card-cpal1' })).toMatchObject({ props: { label: 'Ревью' } })
  expect(await text('  ☑ 1/2')).toBeDefined()

  // Позвать ещё одного и убрать первого
  await press('arcade-board-invite')
  expect(await text('Отметь хотя бы одного друга.')).toBeDefined()
  await press('arcade-desk-pick-21')
  await press('arcade-board-invite')
  expect(sent(requests, 'api/me/boards/members', 'POST').map((r) => r.body)).toEqual([{ board: share, add: ['21'] }])
  expect(await text('Друзья позваны.')).toBeDefined()
  expect(await text('@new_pal')).toBeDefined()
  await press('arcade-desk-drop-7')
  expect(await text('Участник убран.')).toBeDefined()
  expect(boards[share].members).toEqual([OCTO.id, '21'])
  expect(await ui.find({ key: 'arcade-desk-pick-7' })).toMatchObject({ props: { label: '☐ @octo_pal' } })

  // Удалить с сайта — вторым нажатием; у себя доска остаётся своей
  await press('arcade-board-off')
  expect(await ui.find({ key: 'arcade-board-off' })).toMatchObject({ props: { label: 'Нажми ещё раз — удалить с сайта' } })
  expect(sent(requests, 'api/me/boards/delete', 'POST').length).toBe(0)
  await press('arcade-board-off')
  expect(sent(requests, 'api/me/boards/delete', 'POST').map((r) => r.body)).toEqual([{ board: share }])
  expect(boards[share]).toBeUndefined()
  expect(await text('Доска удалена с сайта — у тебя и у друзей остались свои копии.')).toBeDefined()
  expect(pages().find(isBoard).board).toEqual({ cols: [{ id: 'todo' }, { id: 'doing' }, { id: 'done', name: 'Сдано' }] })
  expect(pages().filter((p) => p.parent === id).length).toBe(4)
  expect(await ui.find({ key: 'arcade-board-delete' })).toMatchObject({ props: { label: 'Удалить доску' } })
  expect(await ui.find({ key: 'arcade-board-share' })).toBeDefined()

  // Доски друзей сами появляются в «Доске проектов» вместе с карточками
  const plan = board('План друга', '7', ['7', OCTO.id], [
    { id: 'cpal2', title: 'Смета', body: '', col: 'todo', pos: 0 },
    { id: 'cpal3', title: 'Закупка', body: '', col: 'doing', pos: 0 },
  ])
  const old = board('Старый план', '7', ['7', OCTO.id], [{ id: 'cpal4', title: 'Черновик', body: '', col: 'todo', pos: 0 }])
  await press('arcade-back')
  const pageOf = (title: string) => pages().find((p) => p.title === title && isBoard(p))
  expect([pageOf('План друга')?.board.share, pageOf('Старый план')?.board.share]).toEqual([plan.id, old.id])
  expect(await ui.find({ key: `arcade-desk-${pageOf('План друга').id}` })).toMatchObject({ props: { label: 'План друга' } })
  expect(await text('  карточек: 2 · общая, хозяин @octo_pal')).toBeDefined()
  expect(await text('  карточек: 1 · общая, хозяин @octo_pal')).toBeDefined()
  expect(await text('  карточек: 4')).toBeDefined()

  // Друг убрал с доски — по таймеру списка она становится своей
  old.members = ['7']
  await clock.advance(30_000)
  await clock.settle()
  expect(pageOf('Старый план').board.share).toBeUndefined()
  expect(await text('  карточек: 1')).toBeDefined()
  expect(await text('Доски больше нет на сайте или тебя на ней нет — у тебя осталась своя копия.')).toBeDefined()

  // Чужая доска: хозяин — друг, убирать и звать нельзя; выйти — вторым нажатием, копия остаётся
  await press(`arcade-desk-${pageOf('План друга').id}`)
  expect(await text('Общая доска, хозяин @octo_pal.')).toBeDefined()
  expect(await text('@octo_pal · хозяин доски')).toBeDefined()
  expect(await text('@octocat')).toBeDefined()
  expect(await ui.find({ key: 'arcade-card-cpal2' })).toMatchObject({ props: { label: 'Смета' } })
  expect(await ui.find({ key: 'arcade-board-invite' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-board-delete' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-board-off' })).toMatchObject({ props: { label: 'Выйти с доски' } })
  await press('arcade-board-off')
  await press('arcade-board-off')
  expect(sent(requests, 'api/me/boards/members', 'POST').at(-1).body).toEqual({ board: plan.id, leave: true })
  expect(plan.members).toEqual(['7'])
  expect(await text('Ты больше не на этой доске — у тебя осталась своя копия.')).toBeDefined()
  expect(pageOf('План друга').board.share).toBeUndefined()
  expect(pages().filter((p) => p.parent === pageOf('План друга').id).map((p) => p.title).sort()).toEqual(['Закупка', 'Смета'])
  await ui.unmount()
})

test('блокнот: «Отдать Claude» — сразу, если Claude свободен; занят — страница ждёт в поле ввода', async ($, on) => {
  const { clock, submits, fills } = stubs(on, { submit: true, draft: 'и ещё' })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-notes' })
  await noteInput(ui, 'arcade-note-new-', 'Релиз')
  await noteInput(ui, 'arcade-note-add-', 'тег')
  // Несохранённое в «Тексте» уходит вместе со страницей
  await ui.press({ key: 'arcade-note-edit' })
  await noteInput(ui, 'arcade-note-text-', '- [ ] тег\n- [ ] заметки', 'change')
  await ui.press({ key: 'arcade-note-send' })
  const page = `# Релиз\n- [ ] тег\n- [ ] заметки\n\nОтмечай сделанные пункты и дописывай итоги на этой странице инструментом ${NOTES}.`
  expect(submits.length).toBe(1)
  expect(submits[0].text).toMatch(/^Страница из моего блокнота Arcade \(id p\w+\):\n\n/)
  expect(submits[0].text.endsWith(page)).toBe(true)
  expect(await ui.find({ type: 'Text', text: 'Страница ушла Claude.' })).toBeDefined()
  expect(fills.length).toBe(0)

  // Claude занят — к тому, что уже набрано в поле ввода, с новой строки
  await $.turn.start({ turnId: 't1', text: 'почини тесты' })
  await ui.press({ key: 'arcade-note-send' })
  expect(submits.length).toBe(1)
  expect(fills.length).toBe(1)
  expect(fills[0]).toMatchObject({ mode: 'append' })
  expect(fills[0].text.startsWith('\nСтраница из моего блокнота Arcade')).toBe(true)
  expect(await ui.find({ type: 'Text', text: 'Claude занят — страница ждёт в поле ввода: отправь её, когда он освободится.' })).toBeDefined()
  await ui.unmount()
})

test('блокнот: поле ввода не взяло страницу — так и говорим', async ($, on) => {
  const { clock, submits, fills } = stubs(on, { submit: false, fill: false })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-notes' })
  await noteInput(ui, 'arcade-note-new-', 'Релиз')
  await ui.press({ key: 'arcade-note-send' })
  expect(submits.length).toBe(1)
  expect(fills.length).toBe(1)
  expect(fills[0].text.startsWith('Страница из моего блокнота Arcade')).toBe(true)
  expect(await ui.find({ type: 'Text', text: 'Не получилось отдать страницу — попробуй ещё раз, когда Claude освободится.' })).toMatchObject({ props: { color: 'warning' } })
  await ui.unmount()
})

test('итоги дня: кнопка в блокноте и под досками — страница «Итоги» с тем, что ушло Claude и сделано; ещё раз — та же страница заново', async ($, on) => {
  const { clock, saved, submits } = stubs(on, { submit: true })
  await clock.advance(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pages = () => saved.get('notes') as any[]
  await ui.press({ key: 'arcade-menu-notes' })
  expect(await ui.find({ key: 'arcade-note-summary' })).toMatchObject({ props: { label: 'Итоги дня' } })
  expect(await ui.find({ type: 'Text', text: '  страница для стендапа: что сегодня ушло Claude, что сделано и что ещё в работе' })).toBeDefined()

  // Страницу — Claude, он отмечает пункт; доску ведёт он же: одну карточку — в «Готово»
  await noteInput(ui, 'arcade-note-new-', 'Релиз')
  await noteInput(ui, 'arcade-note-add-', 'тег')
  await noteInput(ui, 'arcade-note-add-', 'заметки')
  await ui.press({ key: 'arcade-note-send' })
  expect(submits.length).toBe(1)
  await $.tool.call({ tool: NOTES, action: 'check', page: 'Релиз', item: 'тег' })
  await $.tool.call({ tool: NOTES, action: 'create', title: 'Sprint', board: true })
  await $.tool.call({ tool: NOTES, action: 'create', title: 'Логин', parent: 'Sprint' })
  await $.tool.call({ tool: NOTES, action: 'create', title: 'Тесты', parent: 'Sprint', column: 'doing' })
  await $.tool.call({ tool: NOTES, action: 'move', page: 'Логин', column: 'done' })
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-note-summary' })
  const sum = pages().find((p) => p.title === 'Итоги 02.11')
  expect(sum).toMatchObject({ parent: null })
  expect(sum.body).toBe(
    [
      '## Отдано Claude',
      '- Релиз',
      '',
      '## Сделано',
      '- ✓ Логин · доска «Sprint» · Claude',
      '- Релиз: отмечено пунктов — 1 · Claude',
      '',
      '## В работе',
      '- Тесты · доска «Sprint», колонка «В работе»',
      '- Релиз: осталось пунктов — 1',
    ].join('\n'),
  )
  // Открыта сама страница: её можно отдать Claude или поправить
  expect(await ui.find({ type: 'Text', text: 'Итоги собраны: отдай их Claude, отправь в чат или поправь.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-note-send' })).toBeDefined()
  // Без входа отправлять в чат некуда — кнопки нет
  expect(await ui.find({ key: 'arcade-note-chat' })).toBeUndefined()
  await ui.press({ key: 'arcade-note-send' })
  expect(submits.length).toBe(2)

  // Ещё раз — из списка досок: та же страница, текст заново; сами итоги, отданные Claude, — не в итоги
  await $.tool.call({ tool: NOTES, action: 'check', page: 'Релиз', item: 'заметки' })
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-note-summary' })).toBeDefined()
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-boards' })
  expect(await ui.find({ key: 'arcade-board-summary' })).toMatchObject({ props: { label: 'Итоги дня' } })
  const count = pages().length
  await ui.press({ key: 'arcade-board-summary' })
  expect(pages().length).toBe(count)
  expect(pages().find((p) => p.id === sum.id).body).toBe(
    [
      '## Отдано Claude',
      '- Релиз',
      '',
      '## Сделано',
      '- ✓ Логин · доска «Sprint» · Claude',
      '- Релиз: отмечено пунктов — 2 · Claude',
      '',
      '## В работе',
      '- Тесты · доска «Sprint», колонка «В работе»',
    ].join('\n'),
  )
  expect(await ui.find({ type: 'Text', text: 'Итоги собраны: отдай их Claude, отправь в чат или поправь.' })).toBeDefined()
  // Журнал — в $.store мода: его видят и другие сессии
  expect((saved.get('daylog') as any[]).map((x) => [x.kind, x.title, x.by ?? ''])).toEqual([
    ['gave', 'Релиз', ''],
    ['checked', 'Релиз', 'claude'],
    ['done', 'Логин', 'claude'],
    ['gave', 'Итоги 02.11', ''],
    ['checked', 'Релиз', 'claude'],
  ])
  await ui.unmount()
})

test('блокнот: «Отправить в чат» — страница текстом в чат с друзьями или командой', async ($, on) => {
  const { api, chats, state } = chatsSite()
  const { clock, requests } = stubs(on, { api, stored: { account: { token: TOKEN, user: OCTO } } })
  await start($)
  await clock.advance(3_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: string) => ui.find({ type: 'Text', text: t })
  await ui.press({ key: 'arcade-menu-notes' })
  await noteInput(ui, 'arcade-note-new-', 'План')
  await noteInput(ui, 'arcade-note-add-', 'тег')
  expect(await ui.find({ key: 'arcade-note-chat' })).toMatchObject({ props: { label: 'Отправить в чат' } })
  expect(await text('  друзьям или команде — текстом в чат Arcade')).toBeDefined()

  // Нажал — список чатов с сайта, кнопкой на каждый
  await ui.press({ key: 'arcade-note-chat' })
  await clock.settle()
  expect(await ui.find({ key: 'arcade-note-chat' })).toMatchObject({ props: { label: 'Не отправлять в чат' } })
  expect(await ui.find({ key: `arcade-note-chat-${DM}` })).toMatchObject({ props: { label: '💬 @octo_pal' } })
  expect(await ui.find({ key: `arcade-note-chat-${CLUB}` })).toMatchObject({ props: { label: '💬 club' } })
  await ui.press({ key: `arcade-note-chat-${CLUB}` })
  await clock.settle()
  expect(sent(requests, 'api/me/chats/send', 'POST').map((r) => r.body)).toEqual([{ chat: CLUB, text: 'План\n\n☐ тег' }])
  expect(chats.find((c) => c.id === CLUB).messages.at(-1)).toMatchObject({ t: 'План\n\n☐ тег' })
  expect(await text('Ушло в чат club')).toBeDefined()
  expect(await ui.find({ key: `arcade-note-chat-${DM}` })).toBeUndefined()

  // Сайт отказал — так и говорим, выбор чата остаётся
  state.unfriended = true
  await ui.press({ key: 'arcade-note-chat' })
  await ui.press({ key: `arcade-note-chat-${DM}` })
  await clock.settle()
  expect(await text('Писать можно только друзьям.')).toMatchObject({ props: { color: 'warning' } })
  expect(await ui.find({ key: `arcade-note-chat-${DM}` })).toBeDefined()
  // Нажал ещё раз — передумал
  await ui.press({ key: 'arcade-note-chat' })
  expect(await ui.find({ key: `arcade-note-chat-${DM}` })).toBeUndefined()
  await ui.unmount()
})

test('блокнот: Claude ведёт его инструментом mcp__arcade__notes — без вопроса человеку, правка ложится поверх набранного', async ($, on) => {
  const { clock, saved, registered } = stubs(on)
  await start($)
  await clock.advance(200)
  expect(registered.map((t) => [t.name, t.isDeferred])).toEqual([['notes', true], ['calendar', true]])
  expect(await $.tool.check({ tool: NOTES, input: { action: 'list' } })).toMatchObject({ decision: 'allow' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-notes' })
  const made: any = await $.tool.call({ tool: NOTES, action: 'create', title: 'План', text: '- [ ] тесты\n- [ ] ревью' })
  const id = /^Created page (p\w+): План\.$/.exec(made.result)?.[1]
  expect(id).toBeDefined()
  // Экран рисуется заново: новая страница в списке
  expect(await ui.find({ key: `arcade-note-page-${id}` })).toMatchObject({ props: { label: 'План' } })
  expect(await ui.find({ type: 'Text', text: '  ☑ 0/2 · тесты' })).toBeDefined()

  // Человек пишет в «Текст», Claude отмечает пункт — набранное не пропадает
  await ui.press({ key: `arcade-note-page-${id}` })
  await ui.press({ key: 'arcade-note-edit' })
  await noteInput(ui, 'arcade-note-text-', '- [ ] тесты\n- [ ] ревью\n- [ ] деплой', 'change')
  expect(await $.tool.call({ tool: NOTES, action: 'check', page: 'план', item: 'деплой' })).toMatchObject({ result: 'Ticked: деплой.' })
  expect((saved.get('notes') as any[])[0].body).toBe('- [ ] тесты\n- [ ] ревью\n- [x] деплой')
  // Правка не закрылась: в поле — текст с отметкой Claude
  expect(await ui.find({ key: await noteKey(ui, 'arcade-note-text-') })).toMatchObject({ props: { value: '- [ ] тесты\n- [ ] ревью\n- [x] деплой' } })
  await ui.press({ key: 'arcade-note-cancel' })
  expect(await ui.find({ key: 'arcade-note-line-2' })).toMatchObject({ props: { label: '☑ деплой' } })
  await $.tool.call({ tool: NOTES, action: 'append', page: id, text: '- итог: всё зелёное' })
  expect(await ui.find({ type: 'Text', text: '• итог: всё зелёное' })).toBeDefined()

  // Ошибка — модели ошибкой, блокнот как был
  expect(await $.tool.call({ tool: NOTES, action: 'read', page: 'нет такой' })).toMatchObject({ deny: 'No page "нет такой". Use action list to see the pages.' })
  expect((saved.get('notes') as any[]).length).toBe(1)
  await ui.unmount()
})

test('блокнот: из $.store — после перезапуска; Desktop — текст страницы Markdown-ом', async ($, on) => {
  const body = '# Цели\n## Пн\n- [x] тесты\nтекст\nещё строка\n* пункт\nпосле списка\n\n    абзац\n'
  const stored = { notes: [{ id: 'pa', title: 'Неделя', body, parent: null, at: 1 }], keepMenu: true }
  const { clock } = stubs(on, { stored })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-notes' })
  expect(await ui.find({ key: 'arcade-note-page-pa' })).toMatchObject({ props: { label: 'Неделя', autoFocus: true } })
  await ui.press({ key: 'arcade-note-page-pa' })
  // Строки между пунктами чек-листа — одним блоком: строка за строкой с переносом, после списка — новый абзац, отступ — не код
  expect((await ui.findAll({ type: 'Markdown' })).map((m: any) => m.props.text)).toEqual(['# Цели\n## Пн', 'текст  \nещё строка\n- пункт\n\nпосле списка\n\nабзац'])
  expect(await ui.find({ key: 'arcade-note-line-2' })).toMatchObject({ props: { label: '☑ тесты', dimColor: true } })
  expect(await ui.find({ type: 'Text', text: 'текст' })).toBeUndefined()
  await ui.unmount()

  // В терминале Markdown-а нет — строки, как были
  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await term.find({ type: 'Markdown' })).toBeUndefined()
  expect(await term.find({ type: 'Text', text: '• пункт' })).toBeDefined()
  await term.unmount()
})

test('блокнот: «Копировать» — буфер поверхности, не дошёл — системный; не вышло — подсказать «Редактировать»', async ($, on) => {
  const body = '# Пост\nтекст «в кавычках» ✓\n- [ ] пункт'
  const stored = { notes: [{ id: 'pa', title: 'Пост', body, parent: null, at: 1 }], keepMenu: true }
  const { clock, clipboard } = stubs(on, { env: WINDOWS, stored })
  // Буфер поверхности: Desktop пока не берёт текст
  const copies: any[] = []
  let surfaceTakes = false
  on('ui.copy', ($: any, e: any) => {
    copies.push({ text: e.text, surface: e.surface })
    return { value: surfaceTakes ? { isCopied: true } : { isCopied: false, reason: 'no-clipboard' } }
  })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  await ui.press({ key: 'arcade-menu-notes' })
  await ui.press({ key: 'arcade-note-page-pa' })

  // Desktop не взял — текст во входном потоке PowerShell, в командной строке его нет
  await ui.press({ key: 'arcade-note-copy' })
  expect(copies).toEqual([{ text: body, surface: 'desktop' }])
  expect(clipboard.calls.length).toBe(1)
  expect(clipboard.calls[0].argv[0]).toBe('powershell.exe')
  expect(clipboard.calls[0].stdin).toBe(body)
  expect(clipboard.calls[0].argv.join(' ')).not.toContain('Пост')
  expect(await text('Текст страницы скопирован.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-note-copy' })).toMatchObject({ props: { autoFocus: true } })

  // Поверхность взяла — системный буфер не нужен
  surfaceTakes = true
  await ui.press({ key: 'arcade-note-copy' })
  expect(copies.length).toBe(2)
  expect(clipboard.calls.length).toBe(1)

  // Ни там, ни там — подсказка выделить текст в поле
  surfaceTakes = false
  clipboard.exit = 1
  await ui.press({ key: 'arcade-note-copy' })
  expect(await text('Не получилось скопировать — нажми «Редактировать» и выдели текст в поле.')).toMatchObject({ props: { color: 'warning' } })
  await ui.unmount()
})

// Другая сессия Claude Code правит то же хранилище: своей копией, не задевая того, что держит мод
function elsewhere(saved: Map<string, unknown>, key: string, change: (value: any) => any) {
  saved.set(key, change(JSON.parse(JSON.stringify(saved.get(key) ?? null))))
}

test('блокнот в двух сессиях: инструмент Claude правит свежий блокнот — чужие страницы не пропадают и не возвращаются', async ($, on) => {
  const stored = { notes: [{ id: 'pk', title: 'Купить', body: '- [ ] хлеб', parent: null, at: 1 }] }
  const { clock, saved } = stubs(on, { stored })
  await start($)
  await clock.advance(200)
  const pages = () => saved.get('notes') as any[]
  const page = (id: string) => pages().find((p) => p.id === id)

  // A заводит доску — B видит её в list сразу, без перезапуска; страница B ложится рядом
  elsewhere(saved, 'notes', (list) => [{ id: 'pt', title: 'Тест A', body: '', parent: null, at: 2, board: { cols: DEFAULT_COLS } }, ...list])
  expect(((await $.tool.call({ tool: NOTES, action: 'list' })) as any).result).toContain('- pt: Тест A [board: To do, Doing, Done]')
  expect(await $.tool.call({ tool: NOTES, action: 'create', title: 'Из B' })).toMatchObject({ result: expect.stringMatching(/^Created page p\w+: Из B\.$/) })
  expect(pages().map((p) => p.title).sort()).toEqual(['Из B', 'Купить', 'Тест A'])

  // A удаляет страницу — правка B её не возвращает, и read её уже не находит
  elsewhere(saved, 'notes', (list) => list.filter((p: any) => p.id !== 'pk'))
  await $.tool.call({ tool: NOTES, action: 'append', page: 'Из B', text: '- [ ] шаг' })
  expect(page('pk')).toBeUndefined()
  expect(await $.tool.call({ tool: NOTES, action: 'read', page: 'pk' })).toMatchObject({ deny: 'No page "pk". Use action list to see the pages.' })

  // Разные страницы: A переименовывает доску и заводит карточку, B — свою карточку и отметку — на месте всё
  elsewhere(saved, 'notes', (list) => [...list.map((p: any) => (p.id === 'pt' ? { ...p, title: 'Тест A2', at: 3 } : p)), { id: 'ca', title: 'От A', body: '', parent: 'pt', at: 3, col: 'todo', pos: 0 }])
  expect(await $.tool.call({ tool: NOTES, action: 'create', parent: 'pt', title: 'От B' })).toMatchObject({ result: expect.stringMatching(/^Created card c\w+: От B \(card on Тест A2, column To do\)\.$/) })
  expect(await $.tool.call({ tool: NOTES, action: 'check', page: 'Из B', item: 'шаг' })).toMatchObject({ result: 'Ticked: шаг.' })
  expect(columnCards(pages(), page('pt'), 'todo').map((p: any) => p.title)).toEqual(['От A', 'От B'])
  expect(page('pt').title).toBe('Тест A2')

  // Одна страница: B читает правку A и дописывает поверх неё; последняя правка остаётся, другие страницы не тронуты
  const mine = pages().find((p) => p.title === 'Из B').id
  elsewhere(saved, 'notes', (list) => list.map((p: any) => (p.id === mine ? { ...p, body: '- [ ] от A', at: 4 } : p)))
  expect(((await $.tool.call({ tool: NOTES, action: 'read', page: mine })) as any).result).toContain('- [ ] от A')
  await $.tool.call({ tool: NOTES, action: 'append', page: mine, text: '- [ ] от B' })
  expect(page(mine).body).toBe('- [ ] от A\n- [ ] от B')
  expect(pages().map((p) => p.title).sort()).toEqual(['Из B', 'От A', 'От B', 'Тест A2'])
})

test('блокнот в двух сессиях: экран перечитывает хранилище, набранное — в свою страницу, удалённая страница — назад с заметкой', async ($, on) => {
  const stored = {
    notes: [
      { id: 'pa', title: 'Альфа', body: '- [ ] один', parent: null, at: 1 },
      { id: 'pb', title: 'Бета', body: '', parent: null, at: 1 },
    ],
  }
  const { clock, saved, toasts } = stubs(on, { stored })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const pages = () => saved.get('notes') as any[]
  const page = (id: string) => pages().find((p) => p.id === id)
  const field = async () => (await ui.find({ key: await noteKey(ui, 'arcade-note-text-') }))?.props.value
  const tick = async () => {
    await clock.advance(NOTES_POLL_MS)
    await clock.settle()
  }
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  await press('arcade-menu-notes')

  // Страница из A появляется на экране B со следующим тиком
  elsewhere(saved, 'notes', (list) => [{ id: 'pc', title: 'Гамма', body: '', parent: null, at: 2 }, ...list])
  expect(await ui.find({ key: 'arcade-note-page-pc' })).toBeUndefined()
  await tick()
  expect(await ui.find({ key: 'arcade-note-page-pc' })).toMatchObject({ props: { label: 'Гамма' } })

  // B набирает текст в «Альфе», A тем временем правит «Бету»: поле B не рисуется заново, набранное — в свою страницу
  await press('arcade-note-page-pa')
  await press('arcade-note-edit')
  await noteInput(ui, 'arcade-note-text-', '- [ ] один\n- [ ] два', 'change')
  const key = await noteKey(ui, 'arcade-note-text-')
  elsewhere(saved, 'notes', (list) => list.map((p: any) => (p.id === 'pb' ? { ...p, body: 'от A', at: 3 } : p)))
  await tick()
  expect(await noteKey(ui, 'arcade-note-text-')).toBe(key)
  await press('arcade-back')
  expect([page('pa').body, page('pb').body, page('pc')?.title]).toEqual(['- [ ] один\n- [ ] два', 'от A', 'Гамма'])

  // Открытую страницу без набранного A поправил — поле рисуется с новым текстом
  await press('arcade-note-page-pb')
  await press('arcade-note-edit')
  elsewhere(saved, 'notes', (list) => list.map((p: any) => (p.id === 'pb' ? { ...p, body: '- [ ] от A\n- [ ] ещё', at: 4 } : p)))
  await tick()
  expect(await field()).toBe('- [ ] от A\n- [ ] ещё')
  // В B набран текст, а Claude в A тем временем отметил пункт той же страницы: после Enter на месте и то и другое
  const typedKey = await noteKey(ui, 'arcade-note-text-')
  await noteInput(ui, 'arcade-note-text-', '- [ ] от A\n- [ ] ещё\n- [ ] от B', 'change')
  elsewhere(saved, 'notes', (list) => list.map((p: any) => (p.id === 'pb' ? { ...p, body: '- [x] от A\n- [ ] ещё', at: 5 } : p)))
  await tick()
  expect(await noteKey(ui, 'arcade-note-text-')).toBe(typedKey)
  await noteInput(ui, 'arcade-note-text-', '- [ ] от A\n- [ ] ещё\n- [ ] от B')
  await clock.settle()
  expect(page('pb').body).toBe('- [x] от A\n- [ ] ещё\n- [ ] от B')
  expect(await text('Сохранено.')).toBeDefined()
  // Набранное и правка A задели одну строку — остаётся набранное, а не молча: заметка под страницей.
  // A правит уже после записи B — время страницы позже
  await press('arcade-note-edit')
  await noteInput(ui, 'arcade-note-text-', '- [x] от A\n- [ ] ещё, от B\n- [ ] от B', 'change')
  elsewhere(saved, 'notes', (list) => list.map((p: any) => (p.id === 'pb' ? { ...p, body: '- [x] от A\n- [x] ещё\n- [ ] от B\nот A снова', at: clock.now() + 1 } : p)))
  await tick()
  await noteInput(ui, 'arcade-note-text-', '- [x] от A\n- [ ] ещё, от B\n- [ ] от B')
  await clock.settle()
  expect(page('pb').body).toBe('- [x] от A\n- [ ] ещё, от B\n- [ ] от B\nот A снова')
  expect(await text('Те же строки тем временем поменяли в другой сессии — осталась правка отсюда.')).toMatchObject({ props: { color: 'warning' } })
  // То же, а набранное уходит со страницы кнопкой «Назад» — заметка тостом
  await press('arcade-note-edit')
  await noteInput(ui, 'arcade-note-text-', 'от B', 'change')
  elsewhere(saved, 'notes', (list) => list.map((p: any) => (p.id === 'pb' ? { ...p, body: 'от A', at: clock.now() + 1 } : p)))
  await tick()
  await press('arcade-back')
  expect([page('pa').body, page('pb').body]).toEqual(['- [ ] один\n- [ ] два', 'от B'])
  expect(toasts).toEqual(['Те же строки тем временем поменяли в другой сессии — осталась правка отсюда.'])

  // Открытую страницу удалили в A — со следующим тиком B уходит к списку с заметкой, страница не возвращается
  await press('arcade-note-page-pc')
  elsewhere(saved, 'notes', (list) => list.filter((p: any) => p.id !== 'pc'))
  await tick()
  expect(await text('Открытую страницу удалили в другой сессии.')).toMatchObject({ props: { color: 'warning' } })
  expect(await ui.find({ key: 'arcade-note-page-pa' })).toBeDefined()
  expect(page('pc')).toBeUndefined()

  // Удалили до тика, а B правит её — правка не делается, B уходит к списку
  await press('arcade-note-page-pb')
  elsewhere(saved, 'notes', (list) => list.filter((p: any) => p.id !== 'pb'))
  await noteInput(ui, 'arcade-note-add-', 'пункт')
  await clock.settle()
  expect(await text('Открытую страницу удалили в другой сессии.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-note-page-pa' })).toBeDefined()
  expect(pages().map((p) => p.id)).toEqual(['pa'])
  await ui.unmount()
})

test('rebaseNotes: правка одной сессии поверх записи другой — свои поля, чужие страницы и строки на месте', () => {
  const board = { id: 'pb', title: 'Лендинг', body: '', parent: null, at: 1, board: { cols: DEFAULT_COLS } }
  const card = (id: string, body: string, col = 'doing', at = 1) => ({ id, title: id, body, parent: 'pb', at, col, pos: 0 })
  const base = [board, card('ca', '- [ ] design\n- [ ] copy'), card('cb', '- [ ] design\n- [ ] copy'), card('cc', '')]
  // Эта сессия отметила пункт в ca и перенесла её в done, удалила cc и завела новую; другая — отметила пункт в cb
  const mine = [card('cn', '', 'todo', 5), board, card('ca', '- [x] design\n- [ ] copy', 'done', 5), base[2]]
  const cur = [board, base[1], card('cb', '- [x] design\n- [ ] copy', 'doing', 4), base[3]]
  const out = rebaseNotes(cur, base, mine)
  expect(out.map((p: any) => p.id)).toEqual(['cn', 'pb', 'ca', 'cb'])
  expect(out[2]).toMatchObject({ body: '- [x] design\n- [ ] copy', col: 'done', at: 5 })
  expect(out[3]).toBe(cur[2])
  // Уже на месте — тот же блокнот
  expect(rebaseNotes(out, base, mine)).toBe(out)
  // Проверка позже (since): страницу, которую правили после неё, не трогаем; удалённую — тоже
  const later = [board, card('ca', '- [ ] design\n- [ ] copy', 'doing', 9), base[2], card('cc', 'новое', 'doing', 9)]
  expect(rebaseNotes(later, base, mine, 6).map((p: any) => p.id)).toEqual(['cn', 'pb', 'ca', 'cb', 'cc'])
  expect(rebaseNotes(later, base, mine, 6)[2]).toBe(later[1])
  // Карточку завели на доске, которую другая сессия удалила, — не остаётся
  expect(rebaseNotes([], base, mine)).toEqual([])
  // Эта сессия отметила пункт, потом сняла: проверка обеих правок отметку не возвращает
  const w1 = { base, mine: [board, card('ca', '- [x] design\n- [ ] copy', 'doing', 5), base[2], base[3]], at: 5 }
  const w2 = { base: w1.mine, mine: [board, card('ca', '- [ ] design\n- [ ] copy', 'doing', 6), base[2], base[3]], at: 6 }
  let list: any[] = base
  for (const w of latestEdits([w1, w2])) list = rebaseNotes(list, w.base, w.mine, w.at)
  expect(list).toBe(base)

  // Один текст правили обе: разные пункты — по строкам; дописали в конец, а выше отметили — и то и другое;
  // дописали обе — сначала чужое; одну строку — побеждает эта, а clash говорит, что чужая правка там пропала
  expect(mergeText('- [x] a\n- [ ] b', '- [ ] a\n- [ ] b', '- [ ] a\n- [x] b')).toEqual({ text: '- [x] a\n- [x] b', clash: false })
  expect(mergeText('- [ ] a\n- [x] b', '- [ ] a\n- [ ] b', '- [ ] a\n- [ ] b\nResult: done')).toEqual({ text: '- [ ] a\n- [x] b\nResult: done', clash: false })
  expect(mergeText('a\nот A', 'a', 'a\nот B')).toEqual({ text: 'a\nот A\nот B', clash: false })
  expect(mergeText('a\nb2\nc', 'a\nb\nc', 'a\nb3\nc\nd')).toEqual({ text: 'a\nb3\nc\nd', clash: true })
  // Поправили сверху и дописали снизу, а между ними другая отметила пункт — все три правки
  expect(mergeText('top\n- [x] mid\nend', 'top\n- [ ] mid\nend', 'TOP\n- [ ] mid\nend\nmore')).toEqual({ text: 'TOP\n- [x] mid\nend\nmore', clash: false })
  // Текст кончался переводом строки, и обе дописали по строке — обе на месте; одну и ту же правку сделали обе — не беда
  expect(mergeText('a\nResult: done', 'a\n', 'a\nот B')).toEqual({ text: 'a\nResult: done\nот B', clash: false })
  expect(mergeText('a\n- [x] b', 'a\n- [ ] b', 'a\n- [x] b')).toEqual({ text: 'a\n- [x] b', clash: false })
  // Страницы, где задели одни строки, — в lost
  const lost: string[] = []
  rebaseNotes([board, card('ca', '- [ ] design\n- [x] copy')], [board, base[1]], [board, card('ca', '- [ ] design\n- [ ] copy, B')], undefined, lost)
  expect(lost).toEqual(['ca'])
  // Сверка: другая сессия записала свой блокнот поверх правки этой и отметила пункт прямо над дописанной строкой —
  // правка на месте, второй раз строка не встаёт; затёрла — строка возвращается
  const added = [board, card('ca', '- [ ] design\n- [ ] copy\nот B', 'doing', 2)]
  const over = [board, card('ca', '- [ ] design\n- [x] copy\nот B\nот A', 'doing', 2)]
  expect(rebaseNotes(over, base.slice(0, 2), added, 3)).toBe(over)
  const lostLine = [board, card('ca', '- [ ] design\n- [x] copy', 'doing', 2)]
  expect(rebaseNotes(lostLine, base.slice(0, 2), added, 3)[1].body).toBe('- [ ] design\n- [x] copy\nот B')
})

// Другая сессия записывает свой блокнот сразу после того, как эта прочла хранилище: эта правит уже не свежий
function writeAfterRead({ saved, meanwhile }: any, change: (value: any) => any) {
  meanwhile.store = (step: string, key: string) => {
    if (step !== 'get' || key !== 'notes') return
    meanwhile.store = undefined
    elsewhere(saved, 'notes', change)
  }
}
// Другая сессия прочла блокнот до записи этой, а свой записала после: запись этой затёрта
function staleWrite({ saved, meanwhile }: any, change: (value: any) => any) {
  let before: any = null
  meanwhile.store = (step: string, key: string) => {
    if (key !== 'notes') return
    if (step === 'before') before = JSON.parse(JSON.stringify(saved.get('notes') ?? null))
    if (step !== 'set') return
    meanwhile.store = undefined
    saved.set('notes', change(before))
  }
}

test('блокнот в двух сессиях: правят почти одновременно — ни отметка, ни строка, ни перенос карточки не пропадают', async ($, on) => {
  const stored = {
    notes: [
      { id: 'pb', title: 'Landing page', body: '', parent: null, at: 1, board: { cols: DEFAULT_COLS } },
      { id: 'ca', title: 'pricing', body: '- [ ] design\n- [ ] copy', parent: 'pb', at: 1, col: 'doing', pos: 0 },
      { id: 'cb', title: 'timeline', body: '- [ ] design\n- [ ] copy', parent: 'pb', at: 1, col: 'doing', pos: 1 },
    ],
  }
  const stub = stubs(on, { stored })
  const { clock, saved } = stub
  await start($)
  await clock.advance(200)
  const page = (id: string) => (saved.get('notes') as any[]).find((p) => p.id === id)
  const tick = (id: string, item: string) => (list: any) => list.map((p: any) => (p.id === id ? { ...p, body: p.body.replace(`- [ ] ${item}`, `- [x] ${item}`), at: clock.now() } : p))
  const check = async () => {
    await clock.advance(NOTES_CHECK_MS)
    await clock.settle()
  }

  // Другая сессия отметила пункт в timeline, пока эта отмечала в pricing: обе отметки на месте
  writeAfterRead(stub, tick('cb', 'design'))
  expect(await $.tool.call({ tool: NOTES, action: 'check', page: 'ca', item: 'design' })).toMatchObject({ result: 'Ticked: design.' })
  expect([page('ca').body, page('cb').body]).toEqual(['- [x] design\n- [ ] copy', '- [x] design\n- [ ] copy'])

  // Одна карточка: там отметили пункт, здесь дописали итог — и отметка, и строка
  writeAfterRead(stub, tick('ca', 'copy'))
  await $.tool.call({ tool: NOTES, action: 'append', page: 'ca', text: 'Result: done' })
  expect(page('ca').body).toBe('- [x] design\n- [x] copy\nResult: done')

  // Запись другой сессии легла поверх: та прочла блокнот до переноса pricing в Done. Перенос пропал — через
  // NOTES_CHECK_MS эта сессия возвращает его, чужая отметка остаётся
  staleWrite(stub, tick('cb', 'copy'))
  await $.tool.call({ tool: NOTES, action: 'move', page: 'ca', column: 'done' })
  expect([page('ca').col, page('cb').body]).toEqual(['doing', '- [x] design\n- [x] copy'])
  await check()
  expect([page('ca').col, page('ca').body, page('cb').body]).toEqual(['done', '- [x] design\n- [x] copy\nResult: done', '- [x] design\n- [x] copy'])

  // Правку, сделанную уже после записи, проверка не трогает: pricing вернули в «В работе» — там она и остаётся
  await $.tool.call({ tool: NOTES, action: 'append', page: 'cb', text: 'Result: done' })
  await clock.advance(100)
  elsewhere(saved, 'notes', (list) => list.map((p: any) => (p.id === 'ca' ? { ...p, col: 'doing', at: clock.now() } : p)))
  await check()
  await check()
  expect([page('ca').col, page('cb').body]).toEqual(['doing', '- [x] design\n- [x] copy\nResult: done'])
})

test('доска проектов в двух сессиях: правки поверх свежего блокнота, удалённые карточка и доска — назад с заметкой', async ($, on) => {
  const stored = {
    notes: [
      { id: 'pd', title: 'Релиз', body: '', parent: null, at: 1, board: { cols: DEFAULT_COLS } },
      { id: 'c1', title: 'Логин', body: '', parent: 'pd', at: 1, col: 'todo', pos: 0 },
      { id: 'c2', title: 'Тесты', body: '', parent: 'pd', at: 1, col: 'todo', pos: 1 },
    ],
  }
  const { clock, saved } = stubs(on, { stored })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const pages = () => saved.get('notes') as any[]
  const titles = (col: string) => columnCards(pages(), pages().find(isBoard), col).map((p: any) => p.title)
  const tick = async () => {
    await clock.advance(NOTES_POLL_MS)
    await clock.settle()
  }
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  await press('arcade-menu-boards')
  await press('arcade-desk-pd')

  // Карточка из A появляется на доске B со следующим тиком; карточка B ложится рядом
  elsewhere(saved, 'notes', (list) => [...list, { id: 'ca', title: 'От A', body: '', parent: 'pd', at: 2, col: 'doing', pos: 0 }])
  await tick()
  expect(await ui.find({ key: 'arcade-card-ca' })).toMatchObject({ props: { label: 'От A' } })
  await noteInput(ui, 'arcade-card-new-todo-', 'От B')
  await clock.settle()
  expect([titles('todo'), titles('doing')]).toEqual([['Логин', 'Тесты', 'От B'], ['От A']])

  // Открытую карточку удалили в A — назад к доске с заметкой
  await press('arcade-card-c1')
  await press('arcade-card-c1')
  expect(await ui.find({ key: 'arcade-note-edit' })).toBeDefined()
  elsewhere(saved, 'notes', (list) => list.filter((p: any) => p.id !== 'c1'))
  await tick()
  expect(await text('Открытую карточку удалили в другой сессии.')).toMatchObject({ props: { color: 'warning' } })
  expect(await ui.find({ key: 'arcade-card-c2' })).toBeDefined()
  expect(titles('todo')).toEqual(['Тесты', 'От B'])

  // Открытую доску удалили в A — к списку досок с заметкой
  elsewhere(saved, 'notes', (list) => list.filter((p: any) => p.id !== 'pd' && p.parent !== 'pd'))
  await tick()
  expect(await text('Открытую доску удалили в другой сессии.')).toMatchObject({ props: { color: 'warning' } })
  expect(await text('Досок пока нет — впиши название новой выше.')).toBeDefined()
  expect(pages()).toEqual([])
  await ui.unmount()
})

test('общая доска в двух сессиях: сверка — поверх свежих блокнота и досок, на сайте без дублей и потерь', HEAVY, async ($, on) => {
  const site = boardsSite()
  const b = site.board('Релиз', OCTO.id, [OCTO.id, '7'], [{ id: 'c1', title: 'Логин', body: '', col: 'todo', pos: 0 }])
  const share = b.id
  // Пока сверка B ждёт ответа, A успевает сверить ту же доску
  let meanwhile: (() => void) | null = null
  const api = (path: string, request: any) => {
    const run = path === 'api/me/boards/sync' ? meanwhile : null
    meanwhile = run ? null : meanwhile
    run?.()
    return site.api(path, request)
  }
  const stored = {
    account: { token: TOKEN, user: OCTO },
    notes: [
      { id: 'pd', title: 'Релиз', body: '', parent: null, at: 1, board: { cols: DEFAULT_COLS, share } },
      { id: 'c1', title: 'Логин', body: '', parent: 'pd', at: 1, col: 'todo', pos: 0 },
    ],
    desks: { [share]: { page: 'pd', rev: b.rev, name: 'Релиз', cols: DEFAULT_COLS, owner: OCTO.id, members: [OCTO.id, '7'], names: {}, cards: { c1: 1 }, held: {} } },
  }
  const { clock, requests, saved } = stubs(on, { env: WINDOWS, api, stored })
  await start($)
  await clock.advance(4_200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pages = () => saved.get('notes') as any[]
  const cards = () => pages().filter((p) => p.parent === 'pd').map((p) => p.title).sort()
  const onSite = () => Object.values(b.cards).filter((c: any) => !c.gone).map((c: any) => c.title).sort()
  const syncs = () => sent(requests, 'api/me/boards/sync', 'POST').map((r) => r.body)
  const puts = (id: string) => syncs().flatMap((s) => s.ops).filter((op: any) => op.put?.id === id).length
  const press = async (key: string) => {
    await ui.press({ key })
    await clock.settle()
  }
  const settle = async (ms: number) => {
    await clock.advance(ms)
    await clock.settle()
  }
  // A сверил свою карточку: она на сайте, в блокноте и в основе доски — блокнот пишется раньше досок
  const syncedInA = (id: string, title: string, at: number) => {
    site.put(b, { id, title, body: '', col: 'doing', pos: at })
    elsewhere(saved, 'notes', (list) => [...list, { id, title, body: '', parent: 'pd', at, col: 'doing', pos: at }])
    elsewhere(saved, 'desks', (desks) => ({ ...desks, [share]: { ...desks[share], rev: b.rev, cards: { ...desks[share].cards, [id]: at } } }))
  }
  await press('arcade-menu-boards')
  await press('arcade-desk-pd')
  expect(syncs().at(-1)).toMatchObject({ board: share, since: b.rev, ops: [] })

  // A сверил карточку, B завёл свою: B отдаёт сайту только свою, карточка A — у B один раз
  syncedInA('ca', 'От A', 5)
  await noteInput(ui, 'arcade-card-new-todo-', 'От B')
  await settle(1_500)
  const mine = pages().find((p) => p.title === 'От B').id
  expect(puts(mine)).toBe(1)
  expect(puts('ca')).toBe(0)
  expect(cards()).toEqual(['Логин', 'От A', 'От B'])
  expect(onSite()).toEqual(['Логин', 'От A', 'От B'])
  expect(await ui.find({ key: 'arcade-card-ca' })).toMatchObject({ props: { label: 'От A' } })
  expect((saved.get('desks') as any)[share]).toMatchObject({ rev: b.rev, cards: { c1: 1, ca: 5, [mine]: expect.any(Number) } })

  // Сверка B и сверка A — одновременно: ответ B к старой основе брошен, основа A цела, следующая сверка доделывает
  meanwhile = () => syncedInA('ca2', 'Ещё от A', 7)
  await noteInput(ui, 'arcade-card-new-todo-', 'Ещё от B')
  await settle(1_500)
  const mine2 = pages().find((p) => p.title === 'Ещё от B').id
  expect(meanwhile).toBeNull()
  expect((saved.get('desks') as any)[share].cards).toMatchObject({ ca2: 7 })
  await settle(BOARD_POLL_MS)
  expect(puts('ca2')).toBe(0)
  expect(cards()).toEqual(['Ещё от A', 'Ещё от B', 'Логин', 'От A', 'От B'])
  expect(onSite()).toEqual(['Ещё от A', 'Ещё от B', 'Логин', 'От A', 'От B'])
  expect((saved.get('desks') as any)[share]).toMatchObject({ rev: b.rev, cards: { ca2: 7, [mine2]: expect.any(Number) } })

  // A удалил доску с сайта: у B она со следующим тиком своя, и правка B не возвращает её связь с сайтом
  delete site.boards[share]
  elsewhere(saved, 'notes', (list) => list.map((p: any) => (p.id === 'pd' ? { ...p, board: { cols: DEFAULT_COLS }, at: 9 } : p)))
  elsewhere(saved, 'desks', () => ({}))
  await settle(NOTES_POLL_MS)
  const count = syncs().length
  await noteInput(ui, 'arcade-card-new-todo-', 'Своя')
  await settle(BOARD_POLL_MS)
  expect(syncs().length).toBe(count)
  expect(saved.get('desks')).toEqual({})
  expect(pages().find(isBoard).board).toEqual({ cols: DEFAULT_COLS })
  expect(cards()).toContain('Своя')
  await ui.unmount()
})

test('блокнот по-английски: экраны без русских букв, названия страниц — как написал человек', async ($, on) => {
  const { clock } = stubs(on, { env: { ...WINDOWS, LANG: 'en_US.UTF-8' }, submit: true })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const cyrillic = async () => (await drawnTexts(ui)).filter((x) => /[А-Яа-яЁё]/.test(x) && x !== '🌐 Русский' && !x.includes('Покупки'))
  expect(await ui.find({ key: 'arcade-fold-work' })).toMatchObject({ props: { label: '▾ Work' } })
  expect(await ui.find({ key: 'arcade-menu-notes' })).toMatchObject({ props: { label: 'Notebook' } })
  await ui.press({ key: 'arcade-menu-notes' })
  expect(await ui.find({ type: 'Text', text: 'Arcade · notebook' })).toBeDefined()
  expect(await ui.find({ key: await noteKey(ui, 'arcade-note-new-') })).toMatchObject({ props: { label: 'New page', submitLabel: 'Create' } })
  expect(await cyrillic()).toEqual([])
  await noteInput(ui, 'arcade-note-new-', 'Weekly plan')
  expect(await ui.find({ key: await noteKey(ui, 'arcade-note-add-') })).toMatchObject({ props: { label: 'New item', submitLabel: 'Add' } })
  expect(await ui.find({ key: 'arcade-note-edit' })).toMatchObject({ props: { label: 'Edit' } })
  await ui.press({ key: 'arcade-note-edit' })
  expect(await ui.find({ key: await noteKey(ui, 'arcade-note-text-') })).toMatchObject({ props: { label: 'Text', submitLabel: 'Save' } })
  expect(await ui.find({ key: 'arcade-note-cancel' })).toMatchObject({ props: { label: 'Cancel' } })
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-note-cancel' })
  await noteInput(ui, 'arcade-note-add-', 'tests')
  expect(await ui.find({ key: 'arcade-note-copy' })).toMatchObject({ props: { label: 'Copy' } })
  await noteInput(ui, 'arcade-note-sub-', 'Покупки')
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-note-send' })
  expect(await ui.find({ type: 'Text', text: 'The page went to Claude.' })).toBeDefined()
  await ui.press({ key: 'arcade-note-delete' })
  expect(await ui.find({ key: 'arcade-note-delete' })).toMatchObject({ props: { label: 'Press again — delete for good' } })
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ type: 'Text', text: '  ☑ 0/1 · tests' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await ui.unmount()
})

test('блокнот: связь с другими приложениями — link, create с app и url; replace хранит прежний текст для отмены', () => {
  // Связь: название приложения и полный адрес со схемой; пробелы в адресе, без схемы, слишком длинный — нет
  expect(cleanLink(' Notion ', ' https://www.notion.so/Plan-abc ')).toEqual({ app: 'Notion', url: 'https://www.notion.so/Plan-abc' })
  expect(cleanLink('Obsidian', 'obsidian://open?vault=w&file=Plan')).toEqual({ app: 'Obsidian', url: 'obsidian://open?vault=w&file=Plan' })
  expect(cleanLink('Google   Docs', 'https://docs.google.com/d/1')?.app).toBe('Google Docs')
  expect(cleanLink('x'.repeat(60), 'https://x.io')?.app).toBe('x'.repeat(MAX_APP))
  expect(cleanLink(' ', 'https://x.io')).toBeNull()
  expect(cleanLink('Notion', 'notion.so/plan')).toBeNull()
  expect(cleanLink('Notion', 'javascript:alert(1)')).toBeNull()
  expect(cleanLink('Notion', 'https://x.io/a b')).toBeNull()
  expect(cleanLink('Notion', `https://x.io/${'a'.repeat(MAX_URL)}`)).toBeNull()

  // Из $.store: связь и прежний текст — если сходятся; прежний текст считается в объём блокнота
  expect(
    restoreNotes([
      { id: 'a', title: 'План', body: 'новый', parent: null, at: 1, link: { app: 'Notion', url: 'https://www.notion.so/p' }, prev: 'старый\r\nтекст' },
      { id: 'b', title: 'Связь', body: '', parent: null, at: 2, link: { app: 'Notion', url: 'javascript:alert(1)' }, prev: 5 },
    ]),
  ).toEqual([
    { id: 'a', title: 'План', body: 'новый', parent: null, at: 1, link: { app: 'Notion', url: 'https://www.notion.so/p' }, prev: 'старый\nтекст' },
    { id: 'b', title: 'Связь', body: '', parent: null, at: 2 },
  ])
  expect(fits([{ id: 'a', title: 't', body: '', prev: 'x'.repeat(MAX_TOTAL), parent: null, at: 0 }])).toBe(false)

  let notes: any[] = []
  const call = (input: any, at = 2000) => {
    const out = applyNotesTool(notes, input, at)
    notes = out.notes
    return out
  }
  const BAD_LINK = 'A link needs app (e.g. Notion, up to 40 characters) and url: the full address of the page in that app, like https://…, up to 500 characters.'
  expect(call({ action: 'create', title: 'Plan', text: '- [ ] tests', app: 'Notion', url: 'https://www.notion.so/Plan-1' })).toMatchObject({ text: 'Created page p1jk: Plan, linked to Notion.', changed: true })
  expect(notes[0].link).toEqual({ app: 'Notion', url: 'https://www.notion.so/Plan-1' })
  expect(call({ action: 'create', title: 'Bad', url: 'https://x.io' })).toMatchObject({ isError: true, text: BAD_LINK })
  expect(notes.length).toBe(1)
  expect(call({ action: 'create', title: 'Draft' }).text).toBe('Created page p1jk1: Draft.')
  expect(call({ action: 'list' }).text).toBe('Notebook pages:\n- p1jk1: Draft\n- p1jk: Plan (0/1 done) [Notion]')
  expect(call({ action: 'read', page: 'plan' }).text).toBe('Page p1jk: Plan\nLinked to Notion: https://www.notion.so/Plan-1\n\n- [ ] tests')

  expect(call({ action: 'link', page: 'Draft', app: 'Google Docs', url: 'https://docs.google.com/document/d/1' })).toMatchObject({ text: 'Linked Draft to Google Docs: https://docs.google.com/document/d/1.', changed: true })
  expect(call({ action: 'link', page: 'Draft', app: 'Notion' })).toMatchObject({ isError: true, text: BAD_LINK })
  expect(findPage(notes, 'Draft')?.link).toEqual({ app: 'Google Docs', url: 'https://docs.google.com/document/d/1' })

  // Замена: прежний текст — в prev, для отмены человеком; тот же текст — ничего не меняет
  expect(call({ action: 'replace', page: 'Plan' })).toMatchObject({ isError: true, text: 'Give the new text of the page in text.' })
  expect(call({ action: 'replace', page: 'Plan', text: 'x'.repeat(MAX_BODY + 1) }).text).toBe('The text is too long: up to 20000 characters.')
  expect(call({ action: 'replace', page: 'Plan', text: '- [x] tests\r\n- [ ] deploy' })).toMatchObject({ text: 'Replaced the text of Plan. The user can undo it in Arcade.', changed: true })
  expect(findPage(notes, 'Plan')).toMatchObject({ body: '- [x] tests\n- [ ] deploy', prev: '- [ ] tests' })
  const same = call({ action: 'replace', page: 'Plan', text: '- [x] tests\n- [ ] deploy' })
  expect(same).toMatchObject({ text: 'Plan already has this text.' })
  expect(same.changed).toBeUndefined()
  expect(call({ action: 'replace', page: 'Plan', text: 'v3' }).changed).toBe(true)
  expect(findPage(notes, 'Plan')).toMatchObject({ body: 'v3', prev: '- [x] tests\n- [ ] deploy' })
})

test('блокнот: Notion и другие приложения — просьбы Claude через его коннекторы, связь, браузер, отмена правки Claude', async ($, on) => {
  const { clock, saved, submits, fills, launches } = stubs(on, { env: WINDOWS, submit: true })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const pages = () => saved.get('notes') as any[]
  const NO_TOOLS = 'Нет инструментов этого приложения — ничего не делай, только объясни, как подключить его коннектор в Claude.'
  const URL = 'https://www.notion.so/Plan-abc'
  await ui.press({ key: 'arcade-menu-notes' })

  // Забрать из приложения: Arcade только передаёт просьбу — страницу заводит Claude, своим коннектором и нашим инструментом
  expect(await ui.find({ key: await noteKey(ui, 'arcade-note-import-') })).toMatchObject({ props: { label: 'Забрать из Notion или другого приложения', submitLabel: 'Забрать' } })
  expect(await text('  Через коннекторы Claude: ключи и пароли Arcade не нужны. Нет коннектора — Claude подскажет, как подключить.')).toBeDefined()
  await noteInput(ui, 'arcade-note-import-', '   ')
  expect(submits.length).toBe(0)
  await noteInput(ui, 'arcade-note-import-', ` ${URL} \n`)
  expect(submits[0].text).toBe(
    [
      'Забери страницу из другого приложения в мой блокнот Arcade.',
      `Что забрать: ${URL}`,
      '',
      'Найди и прочитай её инструментами коннектора (Notion, Google Docs и других). Потом создай страницу блокнота: mcp__arcade__notes, action create, с её названием и текстом, а в app и url — приложение и адрес той страницы, чтобы они остались связаны.',
      NO_TOOLS,
    ].join('\n'),
  )
  expect(await text('Просьба ушла Claude.')).toBeDefined()
  const made: any = await $.tool.call({ tool: NOTES, action: 'create', title: 'План', text: '- [ ] тесты', app: 'Notion', url: URL })
  const id = /^Created page (p\w+): План, linked to Notion\.$/.exec(made.result)?.[1]
  expect(id).toBeDefined()
  expect(await text('  ☑ 0/1 · ↗ Notion · тесты')).toBeDefined()

  // Связанная страница: адрес, «Обновить», «Забрать», «Открыть в браузере», «Отвязать»; «Отправить» — нет
  await ui.press({ key: `arcade-note-page-${id}` })
  expect(await text('Notion и другие приложения')).toBeDefined()
  expect(await text(`  Связана с Notion: ${URL}`)).toBeDefined()
  expect(await ui.find({ key: 'arcade-note-push' })).toMatchObject({ props: { label: 'Обновить в приложении' } })
  expect(await ui.find({ key: 'arcade-note-pull' })).toMatchObject({ props: { label: 'Забрать из приложения' } })
  expect(await ui.find({ key: 'arcade-note-open' })).toMatchObject({ props: { label: 'Открыть в браузере' } })
  expect(await ui.find({ key: 'arcade-note-unlink' })).toMatchObject({ props: { label: 'Отвязать' } })
  expect(await ui.find({ key: 'arcade-note-notion' })).toBeUndefined()
  expect(await noteKey(ui, 'arcade-note-app-')).toBeUndefined()

  // Обновить там: набранное в «Тексте» сначала ложится в страницу — Claude получает свежий текст
  await ui.press({ key: 'arcade-note-edit' })
  await noteInput(ui, 'arcade-note-text-', '- [ ] тесты\n- [ ] ревью', 'change')
  await ui.press({ key: 'arcade-note-push' })
  expect(pages()[0].body).toBe('- [ ] тесты\n- [ ] ревью')
  expect(submits[1].text).toBe(
    [
      'Обнови страницу в другом приложении текстом из моего блокнота Arcade.',
      'Приложение: Notion',
      `Адрес: ${URL}`,
      `Страница блокнота: ${id}`,
      '',
      '# План',
      '- [ ] тесты\n- [ ] ревью',
      '',
      'Замени текст той страницы на этот инструментами коннектора этого приложения.',
      NO_TOOLS,
    ].join('\n'),
  )

  // Забрать оттуда: Claude заменяет текст страницы, прежний остаётся — кнопка возвращает его
  await ui.press({ key: 'arcade-note-pull' })
  expect(submits[2].text).toBe(
    [
      'Забери текст страницы из другого приложения в мой блокнот Arcade.',
      'Приложение: Notion',
      `Адрес: ${URL}`,
      `Страница блокнота: ${id}`,
      '',
      'Прочитай ту страницу инструментами коннектора этого приложения и замени её текстом текст страницы блокнота: mcp__arcade__notes, action replace. Прежний текст останется в Arcade для отмены.',
      NO_TOOLS,
    ].join('\n'),
  )
  expect(await ui.find({ key: 'arcade-note-undo' })).toBeUndefined()
  expect(await $.tool.call({ tool: NOTES, action: 'replace', page: id, text: '- [x] тесты\n- [ ] деплой' })).toMatchObject({ result: 'Replaced the text of План. The user can undo it in Arcade.' })
  expect(await ui.find({ key: await noteKey(ui, 'arcade-note-text-') })).toMatchObject({ props: { value: '- [x] тесты\n- [ ] деплой' } })
  await ui.press({ key: 'arcade-note-cancel' })
  expect(await ui.find({ key: 'arcade-note-line-1' })).toMatchObject({ props: { label: '☐ деплой' } })
  expect(await ui.find({ key: 'arcade-note-undo' })).toMatchObject({ props: { label: 'Вернуть текст до правки Claude' } })
  await ui.press({ key: 'arcade-note-undo' })
  expect(pages()[0].body).toBe('- [ ] тесты\n- [ ] ревью')
  expect(pages()[0].prev).toBeUndefined()
  expect(await text('Прежний текст вернулся.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-note-undo' })).toBeUndefined()

  // Открыть в браузере — браузером по умолчанию, только https
  await ui.press({ key: 'arcade-note-open' })
  expect(launches.at(-1).env.ARCADE_URL).toBe(URL)
  expect(await text('Страница открыта в браузере.')).toBeDefined()
  expect(await $.tool.call({ tool: NOTES, action: 'link', page: id, app: 'Obsidian', url: 'obsidian://open?file=plan' })).toMatchObject({ result: 'Linked План to Obsidian: obsidian://open?file=plan.' })
  expect(await text('  Связана с Obsidian: obsidian://open?file=plan')).toBeDefined()
  expect(await ui.find({ key: 'arcade-note-open' })).toBeUndefined()

  // Отвязать: снова «Отправить в Notion» и поле для другого приложения
  await ui.press({ key: 'arcade-note-unlink' })
  expect(pages()[0].link).toBeUndefined()
  expect(await text('Страница отвязана.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-note-push' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-note-notion' })).toMatchObject({ props: { label: 'Отправить в Notion' } })
  expect(await ui.find({ key: await noteKey(ui, 'arcade-note-app-') })).toMatchObject({ props: { label: 'В другое приложение', submitLabel: 'Отправить' } })
  await ui.press({ key: 'arcade-note-notion' })
  expect(submits[3].text).toBe(
    [
      'Перенеси страницу из моего блокнота Arcade в другое приложение.',
      'Приложение: Notion',
      `Страница блокнота: ${id}`,
      '',
      '# План',
      '- [ ] тесты\n- [ ] ревью',
      '',
      'Создай там новую страницу с этим названием и текстом инструментами коннектора этого приложения. Потом свяжи её со страницей блокнота: mcp__arcade__notes, action link, с названием приложения и адресом новой страницы.',
      NO_TOOLS,
    ].join('\n'),
  )
  await noteInput(ui, 'arcade-note-app-', '  ')
  expect(submits.length).toBe(4)
  await noteInput(ui, 'arcade-note-app-', ' Google   Docs ')
  expect(submits[4].text.split('\n').slice(0, 2)).toEqual(['Перенеси страницу из моего блокнота Arcade в другое приложение.', 'Приложение: Google Docs'])

  // Claude занят — просьба ждёт в поле ввода
  await $.turn.start({ turnId: 't1', text: 'почини тесты' })
  await ui.press({ key: 'arcade-note-notion' })
  expect(submits.length).toBe(5)
  expect(fills.at(-1)).toMatchObject({ mode: 'append' })
  expect(fills.at(-1).text.startsWith('Перенеси страницу из моего блокнота Arcade в другое приложение.')).toBe(true)
  expect(await text('Claude занят — просьба ждёт в поле ввода: отправь её, когда он освободится.')).toBeDefined()
  await ui.unmount()
})

test('доска: задачи из GitHub — Claude забирает их карточками через коннектор, итог карточки — комментарием в задачу', async ($, on) => {
  const { clock, saved, submits } = stubs(on, { env: WINDOWS, submit: true })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const pages = () => saved.get('notes') as any[]
  const NO_GITHUB = 'Нет инструментов GitHub — ничего не делай, только объясни, как подключить коннектор GitHub в Claude.'
  const ISSUE = 'https://github.com/octo/app/issues/7'
  const OLD = 'https://github.com/octo/app/issues/3'
  // Задача карточки: из связи, иначе из текста; список задач и чужие адреса — не задача
  expect(issueUrl({ body: 'см. https://github.com/octo/app/pull/12#discussion и ещё' })).toBe('https://github.com/octo/app/pull/12')
  expect(issueUrl({ link: { app: 'GitHub', url: `${ISSUE}#issuecomment-1` }, body: OLD })).toBe(ISSUE)
  expect(issueUrl({ link: { app: 'Notion', url: 'https://notion.so/x' }, body: 'нет' })).toBe('')
  expect(issueUrl({ body: 'https://github.com/octo/app/issues' })).toBe('')

  await $.tool.call({ tool: NOTES, action: 'create', title: 'Sprint', board: true })
  await $.tool.call({ tool: NOTES, action: 'create', title: 'Старая', parent: 'Sprint', text: `${OLD}\n- [ ] x` })
  await $.tool.call({ tool: NOTES, action: 'create', title: 'Своя', parent: 'Sprint' })
  const board = pages().find(isBoard)
  await ui.press({ key: 'arcade-menu-boards' })
  await ui.press({ key: `arcade-desk-${board.id}` })

  // Поле на доске: Arcade только передаёт просьбу — задачи читает и карточки заводит Claude
  expect(await ui.find({ key: await noteKey(ui, 'arcade-board-github-') })).toMatchObject({ props: { label: 'Задачи из GitHub', placeholder: 'owner/repo или ссылка на задачи', submitLabel: 'Забрать' } })
  expect(await text('  Claude заберёт открытые задачи карточками через коннектор GitHub. Итог по карточке он напишет в задачу кнопкой «Итог — в GitHub» на карточке.')).toBeDefined()
  await noteInput(ui, 'arcade-board-github-', '   ')
  expect(submits.length).toBe(0)
  expect(await text('Впиши репозиторий GitHub (owner/repo) или ссылку на задачи.')).toMatchObject({ props: { color: 'warning' } })
  await noteInput(ui, 'arcade-board-github-', ' octo/app \n label:bug ')
  expect(submits[0].text).toBe(
    [
      'Забери задачи из GitHub на доску из моего блокнота Arcade.',
      `Доска: «Sprint» (id ${board.id})`,
      'Откуда: octo/app label:bug',
      `Уже на доске: ${OLD}`,
      '',
      'Прочитай открытые задачи (issues) инструментами коннектора GitHub — не больше 20. Каждую, которой ещё нет на доске, заведи карточкой: mcp__arcade__notes, action create, parent — id доски, title — название задачи, text — адрес задачи и коротко её суть, app — GitHub, url — адрес задачи.',
      NO_GITHUB,
    ].join('\n'),
  )
  expect(await text('Просьба ушла Claude.')).toBeDefined()

  // Claude заводит карточку задачи, связанную с ней
  const body = `${ISSUE}\nКнопка входа молчит.\n- [x] найти причину`
  await $.tool.call({ tool: NOTES, action: 'create', title: 'Падает вход', parent: 'Sprint', text: body, app: 'GitHub', url: ISSUE })
  const card = pages().find((p) => p.title === 'Падает вход')
  await ui.press({ key: `arcade-card-${card.id}` })
  await ui.press({ key: `arcade-card-${card.id}` })
  expect(await ui.find({ key: 'arcade-note-github' })).toMatchObject({ props: { label: 'Итог — в GitHub' } })
  expect(await text('  Claude напишет в задачу GitHub комментарий: что сделано по карточке. Задачу не закроет.')).toBeDefined()
  // Задачу текстом карточки не переписываем: «Обновить в приложении» нет
  expect(await text(`  Связана с GitHub: ${ISSUE}`)).toBeDefined()
  expect(await ui.find({ key: 'arcade-note-push' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-note-pull' })).toBeDefined()

  // «Отдать Claude» — с адресом задачи; комментарий в задачу — только кнопкой
  await ui.press({ key: 'arcade-note-send' })
  expect(submits[1].text.split('\n').slice(-2)).toEqual([
    'Это карточка доски «Sprint». Когда сделаешь — перенеси её в колонку «Готово» (колонка done) действием move того же инструмента.',
    `Это задача GitHub: ${ISSUE} — подробности, обсуждение и код читай там инструментами коннектора GitHub, если он подключён.`,
  ])
  await ui.press({ key: 'arcade-note-github' })
  expect(submits[2].text).toBe(
    [
      'Напиши итог по карточке из моего блокнота Arcade комментарием в её задаче GitHub.',
      `Задача: ${ISSUE}`,
      `Страница блокнота: ${card.id}`,
      '',
      '# Падает вход',
      body,
      '',
      'Оставь в задаче короткий комментарий инструментами коннектора GitHub: что сделано — по тексту и отмеченным пунктам карточки, на языке задачи. Задачу не закрывай, если об этом не просят.',
      NO_GITHUB,
    ].join('\n'),
  )
  expect(await text('Просьба ушла Claude.')).toBeDefined()

  // Карточка без задачи — без кнопки; в следующей просьбе «Уже на доске» — обе задачи
  await ui.press({ key: 'arcade-back' })
  const own = pages().find((p) => p.title === 'Своя')
  await ui.press({ key: `arcade-card-${own.id}` })
  await ui.press({ key: `arcade-card-${own.id}` })
  expect(await ui.find({ key: 'arcade-note-github' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-note-push' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-note-notion' })).toBeDefined()
  await ui.press({ key: 'arcade-back' })
  await noteInput(ui, 'arcade-board-github-', 'https://github.com/octo/app/issues')
  const have = submits[3].text.split('\n')[3]
  expect(have.startsWith('Уже на доске: ')).toBe(true)
  expect(have.slice('Уже на доске: '.length).split(', ').sort()).toEqual([OLD, ISSUE].sort())
  await ui.unmount()
})

test('доска: очередь для Claude — карточки по одной; вопрос, прерывание, чужая просьба и недоделанная карточка её останавливают, запрос разрешения — нет', async ($, on) => {
  const { clock, saved, submits, toasts } = stubs(on, { env: WINDOWS, submit: true })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const pages = () => saved.get('notes') as any[]
  const page = (title: string) => pages().find((p) => p.title === title)
  const board = () => pages().find(isBoard)
  const col = (title: string) => columnOf(page(title), board().board.cols)
  const QUEUE = 'Карточки идут очередью Arcade: перенесёшь эту в последнюю колонку — следующую Arcade даст сам. Нужно решение человека — не переноси, спроси.'
  const card = (n: number) => submits[n].text.match(/\(id (\w+)\)/)[1]
  const done = (title: string) => $.tool.call({ tool: NOTES, action: 'move', page: page(title).id, column: 'done' })
  const turn = async (id: string, n: number, work: () => Promise<unknown>, end: any = { reason: 'answer' }) => {
    await $.turn.start({ turnId: id, text: submits[n].text })
    await work()
    await $.turn.complete({ turnId: id, answer: '', ...end })
    await clock.advance(10)
  }
  const label = async () => (await ui.find({ key: 'arcade-board-queue' }))?.props.label

  await $.tool.call({ tool: NOTES, action: 'create', title: 'Sprint', board: true })
  for (const title of ['A', 'B', 'C']) await $.tool.call({ tool: NOTES, action: 'create', title, parent: 'Sprint' })
  await ui.press({ key: 'arcade-menu-boards' })
  await ui.press({ key: `arcade-desk-${board().id}` })
  expect(await label()).toBe('Очередь для Claude')
  expect(await text('  Claude по очереди берёт карточки из первой колонки: следующую — когда перенесёт прошлую в последнюю. Задаст вопрос или не доделает — очередь встанет.')).toBeDefined()

  // Первая карточка — Claude и в «В работе»; на экране — что он делает
  await ui.press({ key: 'arcade-board-queue' })
  expect(card(0)).toBe(page('A').id)
  expect(submits[0].text.split('\n').at(-1)).toBe(QUEUE)
  expect(col('A')).toBe('doing')
  expect(await label()).toBe('Остановить очередь')
  expect(await text('  Очередь: Claude делает «A» · отдано карточек — 1')).toBeDefined()

  // Claude перенёс карточку в «Готово» и закончил ход — следующая уходит сама
  await turn('t1', 0, () => done('A'))
  expect(submits.length).toBe(2)
  expect(card(1)).toBe(page('B').id)
  expect(col('B')).toBe('doing')
  expect(await text('  Очередь: Claude делает «B» · отдано карточек — 2')).toBeDefined()

  // Ход кончился, а карточка не в «Готово» — очередь стоит, решает человек
  await turn('t2', 1, async () => {})
  expect(submits.length).toBe(2)
  const stuck = 'Очередь стоит: Claude закончил ход, а карточка «B» не в колонке «Готово». Посмотри, что он ответил.'
  expect(await text(stuck)).toMatchObject({ props: { color: 'warning' } })
  expect(toasts).toContain(stuck)
  expect(await label()).toBe('Очередь для Claude')

  // Снова — из первой колонки: B уже в работе, дальше C. Claude спросил разрешения — очередь не встаёт: одобрили
  // (человек или авто-режим), карточка в «Готово» — следующая уходит сама
  for (const title of ['D', 'E']) await $.tool.call({ tool: NOTES, action: 'create', title, parent: 'Sprint' })
  await ui.press({ key: 'arcade-board-queue' })
  expect(card(2)).toBe(page('C').id)
  await turn('t3', 2, async () => {
    await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm test' } })
    expect(await label()).toBe('Остановить очередь')
    await done('C')
  })
  expect(submits.length).toBe(4)
  expect(card(3)).toBe(page('D').id)

  // Ход прервали — стоп
  await turn('t4', 3, () => done('D'), { reason: 'aborted', isAborted: true })
  expect(submits.length).toBe(4)
  expect(await text('Очередь остановлена: ход Claude прервали.')).toBeDefined()

  // Claude получил другую просьбу — стоп; пока он занят, очередь не запустить
  await ui.press({ key: 'arcade-board-queue' })
  expect(card(4)).toBe(page('E').id)
  await $.turn.start({ turnId: 't5', text: 'почини тесты' })
  expect(await text('Очередь остановлена: Claude получил другую просьбу.')).toBeDefined()
  await ui.press({ key: 'arcade-board-queue' })
  expect(submits.length).toBe(5)
  expect(await text('Claude занят — запусти очередь, когда он закончит ход.')).toBeDefined()
  await $.turn.complete({ turnId: 't5', reason: 'answer', answer: '' })
  await clock.advance(10)

  // В первой колонке пусто — нечего отдавать
  await ui.press({ key: 'arcade-board-queue' })
  expect(submits.length).toBe(5)
  expect(await text('В колонке «Сделать» нет карточек для Claude.')).toMatchObject({ props: { color: 'warning' } })

  // «Остановить очередь»: текущую Claude доделает, следующую не получит
  for (const title of ['F', 'G']) await $.tool.call({ tool: NOTES, action: 'create', title, parent: 'Sprint' })
  await ui.press({ key: 'arcade-board-queue' })
  expect(card(5)).toBe(page('F').id)
  await ui.press({ key: 'arcade-board-queue' })
  expect(await text('Очередь остановлена. Claude доделает текущую карточку, следующую не получит.')).toMatchObject({ props: { dimColor: true } })
  await turn('t6', 5, () => done('F'))
  expect(submits.length).toBe(6)

  // Последняя карточка сделана — очередь пройдена
  await ui.press({ key: 'arcade-board-queue' })
  expect(card(6)).toBe(page('G').id)
  await turn('t7', 6, () => done('G'))
  expect(submits.length).toBe(7)
  expect(await text('Очередь пройдена: в колонке «Сделать» карточек больше нет.')).toMatchObject({ props: { dimColor: true } })

  // В разрешении отказали — Claude не доделал карточку: очередь встаёт в конце хода
  for (const title of ['H', 'I']) await $.tool.call({ tool: NOTES, action: 'create', title, parent: 'Sprint' })
  await ui.press({ key: 'arcade-board-queue' })
  expect(card(7)).toBe(page('H').id)
  await turn('t8', 7, () => $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm -rf build' } }))
  expect(submits.length).toBe(8)
  expect(await text('Очередь стоит: Claude закончил ход, а карточка «H» не в колонке «Готово». Посмотри, что он ответил.')).toMatchObject({ props: { color: 'warning' } })

  // Claude задал вопрос — очередь встаёт сразу: он ждёт человека
  await ui.press({ key: 'arcade-board-queue' })
  expect(card(8)).toBe(page('I').id)
  const questions = [{ question: 'Какой цвет кнопки?', header: 'Цвет', options: [{ label: 'Синий', description: '' }, { label: 'Зелёный', description: '' }], multiSelect: false }]
  await turn('t9', 8, async () => {
    await $.tool.call({ tool: 'AskUserQuestion', questions })
    expect(await text('Очередь остановлена: Claude задал вопрос. Ответь ему и запусти очередь снова.')).toMatchObject({ props: { color: 'warning' } })
    await done('I')
  })
  expect(submits.length).toBe(9)
})

test('доска: очередь в двух сессиях — перенос карточки в «Готово» затёрла другая сессия, очередь не встаёт', async ($, on) => {
  const stub = stubs(on, { env: WINDOWS, submit: true })
  const { clock, saved, submits, toasts } = stub
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pages = () => saved.get('notes') as any[]
  const page = (title: string) => pages().find((p) => p.title === title)
  const board = () => pages().find(isBoard)
  const col = (title: string) => columnOf(page(title), board().board.cols)
  const card = (n: number) => submits[n].text.match(/\(id (\w+)\)/)[1]

  await $.tool.call({ tool: NOTES, action: 'create', title: 'Sprint', board: true })
  for (const title of ['A', 'B', 'C']) await $.tool.call({ tool: NOTES, action: 'create', title, parent: 'Sprint' })
  await ui.press({ key: 'arcade-menu-boards' })
  await ui.press({ key: `arcade-desk-${board().id}` })
  await ui.press({ key: 'arcade-board-queue' })
  expect(card(0)).toBe(page('A').id)

  // Claude перенёс A в «Готово», а другая сессия, прочитав блокнот раньше, записала поверх свою правку C
  await $.turn.start({ turnId: 't1', text: submits[0].text })
  staleWrite(stub, (list) => list.map((p: any) => (p.title === 'C' ? { ...p, body: 'от другой сессии', at: clock.now() } : p)))
  await $.tool.call({ tool: NOTES, action: 'move', page: page('A').id, column: 'done' })
  expect(col('A')).toBe('doing')
  await $.turn.complete({ turnId: 't1', answer: '', reason: 'answer' })
  await clock.advance(10)

  // Конец хода сверяет правки: A — в «Готово», правка C на месте, следующая — B
  expect([col('A'), page('C').body]).toEqual(['done', 'от другой сессии'])
  expect(submits.length).toBe(2)
  expect(card(1)).toBe(page('B').id)
  expect(toasts.filter((t: string) => t.startsWith('Очередь стоит'))).toEqual([])
  await ui.unmount()
})

// Вкладка «Агенты» и очередь доски на несколько сессий. Отметки сессий лежат в домашней папке — USERPROFILE задан
const AG_ENV = { ...WINDOWS, USERPROFILE: 'C:\\Users\\max' }
const AG_DIR = 'C:\\Users\\max\\.claude\\arcade\\agents'
const AG_ME = { sid: 'sess-me', root: 'D:\\work\\web' }
// Отметки сессий на диске: место → отметка
const agentSlots = (disk: Map<string, any>) =>
  [...disk.entries()].flatMap(([k, v]) => {
    const m = /[\\/]agents[\\/]s(\d+)\.json$/.exec(k)
    return m ? [{ slot: Number(m[1]), rec: JSON.parse(v) }] : []
  })
// Отметка этой сессии
const ownRecord = (disk: Map<string, any>) => agentSlots(disk).find((x) => x.rec.sid === AG_ME.sid)?.rec
// Отметка другой сессии в месте slot — как её пишет Arcade той сессии; записана сейчас по часам теста. Место эта
// сессия заняла наугад: если это оно — соперник пишет в последнее
const agentFile = (putFile: any, clock: any, disk: Map<string, any>) => (slot: number, rec: any) => {
  const mine = agentSlots(disk).find((x) => x.rec.sid === AG_ME.sid)?.slot
  putFile(`${AG_DIR}\\s${slot === mine ? 32 : slot}.json`, JSON.stringify({ v: 1, sid: 'sess-x', name: 'api', path: 'D:\\work\\api', status: 'idle', since: 0, card: null, queue: null, claim: null, ...rec, at: clock.now() }))
}
const boxKeys = async (ui: any, prefix: string) => (await ui.findAll({ type: 'Box' })).map((b: any) => b.key).filter((k: any) => typeof k === 'string' && k.startsWith(prefix))

test('агенты: сессии на этом компьютере — ждёт разрешения, работает, свободна; эта отмечена; Desktop — карточки, терминал — строки; закрытая пропадает', async ($, on) => {
  const { clock, disk, putFile } = stubs(on, { env: AG_ENV, agents: AG_ME })
  const rival = agentFile(putFile, clock, disk)
  const api = { sid: 'sess-a', name: 'api', status: 'working', since: -125 * 60_000, card: { id: 'c1', title: 'Вход', board: 'b1', boardTitle: 'Спринт' }, queue: { board: 'b1', n: 3, of: 10, started: 0 } }
  const docs = { sid: 'sess-b', name: 'docs', path: 'D:\\work\\docs', status: 'permission', since: -5 * 60_000 }
  rival(3, api)
  rival(9, docs)
  rival(12, { sid: 'sess-c', name: 'site', path: 'D:\\work\\site', status: 'idle', since: -60 * 60_000 })
  // Эта сессия ушла — место свободно
  putFile(`${AG_DIR}\\s20.json`, JSON.stringify({ v: 1, left: true, at: 0 }))
  await start($)
  await clock.advance(4_000)
  // Эта сессия заняла место и записала отметку: id, папка, состояние; карточки и очереди нет
  expect(ownRecord(disk)).toMatchObject({ v: 1, sid: 'sess-me', name: 'web', path: 'D:\\work\\web', status: 'idle', card: null, queue: null, claim: null })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '  сессии Claude Code на этом компьютере: что делает каждая' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-agents' })
  await clock.advance(AGENT_TICK_MS)
  // Терминал — строками, по порядку: ждёт разрешения, работает, свободна; в одном состоянии — дольше в нём выше
  expect(await boxKeys(ui, 'agents-line-')).toEqual(['agents-line-sess-b', 'agents-line-sess-a', 'agents-line-sess-c', 'agents-line-sess-me'])
  // Строка: имя жирным, состояние — его цветом; под ней карточка и очередь
  expect(await ui.find({ type: 'Text', text: 'docs — ждёт разрешения · 5 мин' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ждёт разрешения · 5 мин$/ })).toMatchObject({ props: { color: 'error' } })
  expect(await ui.find({ type: 'Text', text: /^api — работает · 2 ч 5 мин$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^работает · 2 ч 5 мин$/ })).toMatchObject({ props: { color: 'suggestion' } })
  expect(await ui.find({ type: 'Text', text: /^ {2}«Вход» на доске «Спринт» · Очередь: карточка 3 из 10$/ })).toMatchObject({ props: { dimColor: true } })
  expect(await ui.find({ type: 'Text', text: /^site — свободна · 1 ч$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^web · эта сессия — свободна · меньше минуты$/ })).toBeDefined()
  expect(JSON.stringify(await ui.drawn())).not.toContain('Открыть')
  // Desktop — карточками, как события календаря: рамка и подложка цветом состояния
  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await boxKeys(desk, 'agents-card-')).toEqual(['agents-card-sess-b', 'agents-card-sess-a', 'agents-card-sess-c', 'agents-card-sess-me'])
  expect(await desk.find({ key: 'agents-card-sess-b' })).toMatchObject({ props: { borderStyle: 'round', borderColor: '#e5484d80' } })
  expect(await boxKeys(desk, 'agents-line-')).toEqual([])
  await desk.unmount()

  // «site» закрыли — отметку больше не обновляют: меньше чем через минуту её нет. Остальные обновляют свои
  await clock.advance(30_000)
  rival(3, api)
  rival(9, docs)
  await clock.advance(16_000)
  expect(await boxKeys(ui, 'agents-line-')).toEqual(['agents-line-sess-b', 'agents-line-sess-a', 'agents-line-sess-me'])
  // Свою отметку эта сессия всё это время обновляла
  expect(ownRecord(disk).at).toBeGreaterThan(30_000)
  await ui.unmount()
})

test('агенты: очередь доски в нескольких сессиях — присоединиться, взять свободную карточку, «у сессии», остановить здесь и везде', async ($, on) => {
  const { clock, saved, submits, toasts, disk, putFile } = stubs(on, { env: AG_ENV, agents: AG_ME, submit: true })
  const rival = agentFile(putFile, clock, disk)
  await start($)
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const pages = () => saved.get('notes') as any[]
  const page = (title: string) => pages().find((p) => p.title === title)
  const board = () => pages().find(isBoard)
  const card = (n: number) => submits[n].text.match(/\(id (\w+)\)/)[1]
  const label = async () => (await ui.find({ key: 'arcade-board-queue' }))?.props.label
  // Нажатие, после которого Arcade заявляет карточку и выжидает CLAIM_MS
  const pressClaim = async (key: string) => {
    const pressed = ui.press({ key })
    await clock.advance(CLAIM_MS + 100)
    await pressed
  }
  await $.tool.call({ tool: NOTES, action: 'create', title: 'Sprint', board: true })
  for (const title of ['A', 'B', 'C', 'D']) await $.tool.call({ tool: NOTES, action: 'create', title, parent: 'Sprint' })
  const id = board().id
  // В сессии «api» очередь этой доски уже идёт — она делает A; сессия «docs» только что заявила B
  rival(3, { sid: 'sess-a', name: 'api', status: 'working', card: { id: page('A').id, title: 'A', board: id, boardTitle: 'Sprint' }, queue: { board: id, n: 1, of: 4, started: 0 } })
  rival(9, { sid: 'sess-b', name: 'docs', path: 'D:\\work\\docs', status: 'idle', claim: { card: page('B').id, at: clock.now() } })
  await ui.press({ key: 'arcade-menu-boards' })
  await ui.press({ key: `arcade-desk-${id}` })
  await clock.advance(AGENT_TICK_MS)
  expect(await text('  у сессии «api»')).toBeDefined()
  expect(await text('  Очередь идёт и в других сессиях: «api»')).toBeDefined()
  expect(await ui.find({ key: 'arcade-board-queue-all' })).toMatchObject({ props: { label: 'Остановить везде' } })

  // Нажал «Очередь для Claude» — эта сессия присоединилась: A у «api», B заявила «docs» — ей C
  await pressClaim('arcade-board-queue')
  expect(submits.length).toBe(1)
  expect(card(0)).toBe(page('C').id)
  expect(await text('Очередь на этой доске уже идёт в сессии «api». Эта сессия тоже будет брать карточки.')).toBeDefined()
  expect(await text('  у этой сессии')).toBeDefined()
  await clock.advance(AGENT_TICK_MS)
  expect(ownRecord(disk)).toMatchObject({ card: { id: page('C').id, title: 'C', board: id, boardTitle: 'Sprint' }, queue: { board: id, n: 1, of: 2 }, claim: null })

  // «Остановить очередь» — только здесь: в «api» она идёт дальше
  await ui.press({ key: 'arcade-board-queue' })
  expect(await text('Очередь остановлена. Claude доделает текущую карточку, следующую не получит. В других сессиях она идёт дальше.')).toBeDefined()
  expect(await label()).toBe('Очередь для Claude')
  expect(saved.get('queueStop')).toBeUndefined()

  // Снова: C в работе, A у «api», B заявлена — следующая D. «Остановить везде» нажали в другой сессии — эта встаёт
  // на следующем шаге, текущую карточку Claude доделает
  await pressClaim('arcade-board-queue')
  expect(card(1)).toBe(page('D').id)
  saved.set('queueStop', { [id]: clock.now() })
  await clock.advance(AGENT_TICK_MS)
  const stopped = 'Очередь остановили во всех сессиях. Claude доделает текущую карточку, следующую не получит.'
  expect(await text(stopped)).toBeDefined()
  expect(toasts).toContain(stopped)
  expect(await label()).toBe('Очередь для Claude')

  // Запущенная после этого очередь идёт; «Остановить везде» здесь — метка в общем хранилище, её видят все сессии
  await $.tool.call({ tool: NOTES, action: 'create', title: 'E', parent: 'Sprint' })
  await pressClaim('arcade-board-queue')
  expect(card(2)).toBe(page('E').id)
  expect(await label()).toBe('Остановить очередь')
  await ui.press({ key: 'arcade-board-queue-all' })
  expect(saved.get('queueStop')).toEqual({ [id]: clock.now() })
  expect(await text('Очередь остановлена во всех сессиях: каждая доделает текущую карточку, новую не возьмёт.')).toBeDefined()
  expect(await label()).toBe('Очередь для Claude')
  expect(submits.length).toBe(3)
  await ui.unmount()
})

test('агенты: сессия в той же папке — сначала предупреждение, присоединиться только вторым нажатием', async ($, on) => {
  const { clock, saved, submits, disk, putFile } = stubs(on, { env: AG_ENV, agents: AG_ME, submit: true })
  const rival = agentFile(putFile, clock, disk)
  await start($)
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pages = () => saved.get('notes') as any[]
  const page = (title: string) => pages().find((p) => p.title === title)
  await $.tool.call({ tool: NOTES, action: 'create', title: 'Sprint', board: true })
  for (const title of ['A', 'B']) await $.tool.call({ tool: NOTES, action: 'create', title, parent: 'Sprint' })
  const id = pages().find(isBoard).id
  // Та же папка, записанная иначе: другие слеши, регистр и слеш в конце
  rival(5, { sid: 'sess-w', name: 'web', path: 'd:/Work/web/', status: 'working', card: { id: page('A').id, title: 'A', board: id, boardTitle: 'Sprint' }, queue: { board: id, n: 1, of: 2, started: 0 } })
  await ui.press({ key: 'arcade-menu-boards' })
  await ui.press({ key: `arcade-desk-${id}` })
  await ui.press({ key: 'arcade-board-queue' })
  expect(submits.length).toBe(0)
  expect(await ui.find({ type: 'Text', text: 'Эта сессия в той же папке, что «web»: две сессии могут править одни и те же файлы. Надёжнее — отдельная папка или git worktree. Нажми «Очередь для Claude» ещё раз, чтобы всё равно присоединиться.' })).toMatchObject({ props: { color: 'warning' } })
  const pressed = ui.press({ key: 'arcade-board-queue' })
  await clock.advance(CLAIM_MS + 100)
  await pressed
  expect(submits.length).toBe(1)
  expect(submits[0].text).toContain(`(id ${page('B').id})`)
  await ui.unmount()
})

test('агенты: две сессии заявили одну карточку — берёт заявившая раньше, при равенстве — с меньшим id; эта берёт следующую', async ($, on) => {
  const { clock, saved, submits, disk, putFile } = stubs(on, { env: AG_ENV, agents: AG_ME, submit: true })
  const rival = agentFile(putFile, clock, disk)
  await start($)
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const pages = () => saved.get('notes') as any[]
  const page = (title: string) => pages().find((p) => p.title === title)
  await $.tool.call({ tool: NOTES, action: 'create', title: 'Sprint', board: true })
  for (const title of ['A', 'B', 'C', 'D']) await $.tool.call({ tool: NOTES, action: 'create', title, parent: 'Sprint' })
  await ui.press({ key: 'arcade-menu-boards' })
  await ui.press({ key: `arcade-desk-${pages().find(isBoard).id}` })

  // Эта сессия заявила A и выжидает; «api» заявила A на миг раньше — A у неё, этой — B
  let pressed = ui.press({ key: 'arcade-board-queue' })
  await clock.settle()
  const first = ownRecord(disk).claim
  expect(first.card).toBe(page('A').id)
  rival(4, { sid: 'sess-z', name: 'api', status: 'working', claim: { card: first.card, at: first.at - 1 } })
  await clock.advance(CLAIM_MS + 100)
  expect(ownRecord(disk).claim.card).toBe(page('B').id)
  await clock.advance(CLAIM_MS + 100)
  await pressed
  expect(submits.length).toBe(1)
  expect(submits[0].text).toContain(`(id ${page('B').id})`)
  expect(ownRecord(disk)).toMatchObject({ card: { id: page('B').id }, claim: null })

  // Заявили C в одно время — берёт сессия с меньшим id: 'sess-a' < 'sess-me'; этой — D
  await ui.press({ key: 'arcade-board-queue' })
  pressed = ui.press({ key: 'arcade-board-queue' })
  await clock.settle()
  const second = ownRecord(disk).claim
  expect(second.card).toBe(page('C').id)
  rival(6, { sid: 'sess-a', name: 'docs', path: 'D:\\work\\docs', status: 'working', claim: { card: second.card, at: second.at } })
  await clock.advance(CLAIM_MS + 100)
  await clock.advance(CLAIM_MS + 100)
  await pressed
  expect(submits.length).toBe(2)
  expect(submits[1].text).toContain(`(id ${page('D').id})`)
  await ui.unmount()
})

test('агенты: заявки наперегонки — при любых задержках записи и чтения две сессии одну карточку не получают', async () => {
  // Генератор случайных чисел с зерном: каждый прогон повторяется
  const random = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  // Сколько раз заявку снимали — проиграна или записывалась слишком долго: прогоны и правда сталкивают заявки
  let dropped = 0
  for (let seed = 1; seed <= 40; seed++) {
    const rand = random(seed)
    // Свои часы: ожидания по порядку времени; между ними — всё, что уже может идти
    let now = 0
    let order = 0
    const timers: any[] = []
    const sleep = (ms: number) => new Promise<void>((resolve) => timers.push({ at: now + ms, order: order++, resolve }))
    const lag = () => sleep(Math.floor(rand() * 160)) // запись или чтение — до 320 мс: заявка иногда дольше CLAIM_MS / 2
    // Доска в две колонки: карточка уходит из первой, только когда сделана
    const todo = new Set(['c1', 'c2', 'c3', 'c4', 'c5', 'c6'])
    const records = new Map<string, any>()
    const won: string[] = []
    const run = async (sid: string) => {
      const write = async (claim: any) => {
        if (!claim) dropped++
        await lag()
        records.get(sid).claim = claim
        await lag()
      }
      records.set(sid, { sid, card: null, claim: null })
      const given = new Set<string>()
      // Нечётные прогоны — все начинают в одно время: заявки с равным временем
      await sleep(seed % 2 ? 0 : Math.floor(rand() * 60))
      for (;;) {
        const io = {
          me: sid,
          now: async () => now,
          sleep,
          others: async () => {
            await lag()
            const list = [...records.values()].filter((r) => r.sid !== sid).map((r) => JSON.parse(JSON.stringify(r)))
            await lag()
            return list
          },
          write,
        }
        const id = await claimCard(io, (others: any[]) => {
          const busy = new Set(others.flatMap((r) => [r.card?.id, r.claim?.card]))
          return [...todo].find((c) => !busy.has(c) && !given.has(c)) ?? ''
        })
        // Проиграла заявки CLAIM_TRIES раз подряд — как человек, снова «Очередь для Claude»
        if (id === null) continue
        if (!id) return
        won.push(id)
        given.add(id)
        // Взятая карточка — в отметке одной записью с пустой заявкой; Claude её делает и переносит в последнюю колонку
        await lag()
        Object.assign(records.get(sid), { card: { id }, claim: null })
        await sleep(Math.floor(rand() * 3_000))
        todo.delete(id)
        records.get(sid).card = null
      }
    }
    let finished = false
    Promise.all(['sess-a', 'sess-b', 'sess-c', 'sess-d'].map(run)).then(() => {
      finished = true
    })
    for (let step = 0; step < 50_000 && !finished; step++) {
      for (let i = 0; i < 100; i++) await Promise.resolve()
      timers.sort((a, b) => a.at - b.at || a.order - b.order)
      const next = timers.shift()
      if (!next) continue
      now = next.at
      next.resolve()
    }
    expect(finished).toBe(true)
    // Ни одна карточка не досталась двум сессиям, и все сделаны
    expect(won.length).toBe(new Set(won).size)
    expect(new Set(won).size).toBe(6)
  }
  expect(dropped).toBeGreaterThan(40)
})

test('агенты: другая сессия ждёт разрешения — всплывашка в своей панели, без звука и системного уведомления; в «Настройках» — выключить, «закончил ход» — включить', async ($, on) => {
  const { clock, saved, toasts, notifies, popups, disk, putFile } = stubs(on, { env: AG_ENV, agents: AG_ME })
  const rival = agentFile(putFile, clock, disk)
  const docs = { sid: 'sess-b', name: 'docs', path: 'D:\\work\\docs', status: 'working' }
  const state = async (status: string) => {
    rival(9, { ...docs, status })
    await clock.advance(AGENT_READ_MS + AGENT_TICK_MS)
  }
  const about = () => toasts.filter((t) => t.includes('«docs»'))
  rival(9, docs)
  await start($)
  // Первое чтение только запоминает, что видно
  await clock.advance(10_000)
  expect(about()).toEqual([])
  await state('permission')
  expect(about()).toEqual(['Сессия «docs» ждёт разрешения'])
  expect(notifies).toEqual([])
  expect(popups).toEqual([])
  // «Закончил ход» — по умолчанию без всплывашки
  await state('done')
  expect(about()).toEqual(['Сессия «docs» ждёт разрешения'])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-agents-notify' })).toMatchObject({ props: { label: 'Другая сессия ждёт разрешения: да' } })
  expect(await ui.find({ key: 'arcade-agents-done' })).toMatchObject({ props: { label: 'Другая сессия закончила ход: нет' } })
  await ui.press({ key: 'arcade-agents-notify' })
  await ui.press({ key: 'arcade-agents-done' })
  expect(await ui.find({ key: 'arcade-agents-notify' })).toMatchObject({ props: { label: 'Другая сессия ждёт разрешения: нет' } })
  expect(await ui.find({ key: 'arcade-agents-done' })).toMatchObject({ props: { label: 'Другая сессия закончила ход: да' } })
  expect(saved.get('agentsNotify')).toBe(false)
  expect(saved.get('agentsDone')).toBe(true)
  await state('working')
  await state('permission')
  await state('done')
  expect(about()).toEqual(['Сессия «docs» ждёт разрешения', 'В сессии «docs» Claude закончил ход'])
  await ui.unmount()
})

test('агенты: крестик скрывает другую сессию — её нет в списке и всплывашек о ней нет; «Скрытые» возвращают; помнится в хранилище, скрытое в другой сессии видно сразу', async ($, on) => {
  const { clock, saved, toasts, disk, putFile } = stubs(on, { env: AG_ENV, agents: AG_ME, stored: { agentsHidden: ['sess-c'] } })
  const rival = agentFile(putFile, clock, disk)
  const api = { sid: 'sess-a', name: 'api', path: 'D:\\work\\api', status: 'working', since: -60_000 }
  const docs = { sid: 'sess-b', name: 'docs', path: 'D:\\work\\docs', status: 'idle', since: -60_000 }
  const site = { sid: 'sess-c', name: 'site', path: 'D:\\work\\site', status: 'idle', since: -60_000 }
  const marks = (over: any = {}) => {
    rival(3, { ...api, ...over.api })
    rival(9, { ...docs, ...over.docs })
    rival(12, { ...site, ...over.site })
  }
  marks()
  await start($)
  await clock.advance(10_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-agents' })
  await clock.advance(AGENT_TICK_MS)
  // «site» скрыли раньше — её нет в списке, она в «Скрытых»; у этой сессии крестика нет
  expect(await boxKeys(ui, 'agents-card-')).toEqual(['agents-card-sess-a', 'agents-card-sess-b', 'agents-card-sess-me'])
  expect(await ui.find({ key: 'agents-hide-sess-a' })).toMatchObject({ props: { label: '×', plain: true } })
  expect(await ui.find({ key: 'agents-hide-sess-me' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Скрытые сессии — нажми, чтобы вернуть:' })).toBeDefined()
  expect(await ui.find({ key: 'agents-show-sess-c' })).toMatchObject({ props: { label: 'site' } })

  // Крестик у «api»: её нет в списке, она в «Скрытых»; запомнено вместе с тем, что скрыли раньше
  await ui.press({ key: 'agents-hide-sess-a' })
  expect(await boxKeys(ui, 'agents-card-')).toEqual(['agents-card-sess-b', 'agents-card-sess-me'])
  expect(saved.get('agentsHidden')).toEqual(['sess-c', 'sess-a'])
  // Скрытая ждёт разрешения — всплывашки нет, а в «Скрытых» она так и подписана
  marks({ api: { status: 'permission', ask: { kind: 'permission', tool: 'Bash', what: 'npm test' } }, docs: { status: 'permission' } })
  await clock.advance(AGENT_READ_MS + AGENT_TICK_MS)
  expect(toasts.filter((t) => t.startsWith('Сессия «'))).toEqual(['Сессия «docs» ждёт разрешения'])
  expect(await ui.find({ key: 'agents-show-sess-a' })).toMatchObject({ props: { label: 'api · ждёт разрешения' } })
  // Терминал: крестик — рядом с именем другой сессии, у своей его нет
  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await boxKeys(term, 'agents-line-')).toEqual(['agents-line-sess-b', 'agents-line-sess-me'])
  expect(await term.find({ key: 'agents-hide-sess-b' })).toBeDefined()
  await term.unmount()

  // Вернуть «site» — она снова в списке; «api» остаётся скрытой
  await ui.press({ key: 'agents-show-sess-c' })
  expect(await boxKeys(ui, 'agents-card-')).toEqual(['agents-card-sess-b', 'agents-card-sess-c', 'agents-card-sess-me'])
  expect(saved.get('agentsHidden')).toEqual(['sess-a'])
  await ui.press({ key: 'agents-show-sess-a' })
  expect(saved.get('agentsHidden')).toEqual([])
  expect(await ui.find({ type: 'Text', text: 'Скрытые сессии — нажми, чтобы вернуть:' })).toBeUndefined()

  // «docs» скрыли в другой сессии — здесь она уходит в «Скрытые» со следующим чтением отметок, без перезапуска
  saved.set('agentsHidden', ['sess-b'])
  await clock.advance(AGENT_TICK_MS)
  expect(await boxKeys(ui, 'agents-card-')).toEqual(['agents-card-sess-a', 'agents-card-sess-c', 'agents-card-sess-me'])
  expect(await ui.find({ key: 'agents-show-sess-b' })).toMatchObject({ props: { label: 'docs · ждёт разрешения' } })
  await ui.unmount()
})

test('агенты: вопрос Claude этой сессии — в её отметке; ответ из «Агентов» другой сессии модель получает как ответ человека, чужой или неверный — нет; ответить можно и из своей вкладки', HEAVY, async ($, on) => {
  const { clock, disk, putFile } = stubs(on, { env: AG_ENV, agents: AG_ME, questionMs: 60_000 })
  await start($)
  await clock.advance(4_000)
  const questions = [{ question: 'Какую базу взять?', header: 'База', options: [{ label: 'Postgres', description: '' }, { label: 'SQLite', description: 'проще' }], multiSelect: false }]
  const ask = () => {
    const got = { out: 'pending' as any }
    $.tool.call({ tool: 'AskUserQuestion', questions }).then((r: any) => (got.out = r))
    return got
  }
  const first = ask()
  await clock.advance(AGENT_TICK_MS)
  const rec = ownRecord(disk)
  expect(rec).toMatchObject({ status: 'permission', ask: { kind: 'question', questions: [{ question: 'Какую базу взять?', header: 'База', options: ['Postgres', 'SQLite'], multi: false }] } })
  const slot = agentSlots(disk).find((x) => x.rec.sid === AG_ME.sid)!.slot
  const answer = (body: any) => putFile(`${AG_DIR}\\a${slot}.json`, JSON.stringify({ v: 1, to: AG_ME.sid, id: rec.ask.id, picks: [['SQLite']], at: clock.now(), ...body }))
  // Ответ другой сессии, на другой вопрос, вариант не из списка, два варианта там, где можно один, — не ответ
  for (const wrong of [{ to: 'sess-x' }, { id: 'other' }, { picks: [['MySQL']] }, { picks: [['Postgres', 'SQLite']] }, { picks: [] }, { v: 2 }]) {
    answer(wrong)
    await clock.advance(ANSWER_POLL_MS * 2)
  }
  expect(first.out).toBe('pending')
  answer({})
  await clock.advance(ANSWER_POLL_MS)
  expect(first.out).toEqual({ result: { questions, answers: { 'Какую базу взять?': 'SQLite' } } })
  await clock.advance(AGENT_TICK_MS)
  expect(ownRecord(disk)).toMatchObject({ status: 'working', ask: null })

  // Свой вопрос — кнопками в своей строке вкладки
  const second = ask()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-agents' })
  expect(await ui.find({ key: 'agents-ask-sess-me' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^web · эта сессия — ждёт ответа · / })).toBeDefined()
  expect(await ui.find({ key: 'agents-q-sess-me-0-0' })).toMatchObject({ props: { label: 'Postgres' } })
  await ui.press({ key: 'agents-q-sess-me-0-0' })
  await clock.advance(ANSWER_POLL_MS)
  expect(second.out).toEqual({ result: { questions, answers: { 'Какую базу взять?': 'Postgres' } } })
  expect(await ui.find({ key: 'agents-ask-sess-me' })).toBeUndefined()
  await ui.unmount()
})

test('агенты: вопрос другой сессии — ответить кнопками в её карточке, ответ уходит файлом в её место; запрос разрешения — только текст, разрешают в самой сессии', async ($, on) => {
  const { clock, disk, putFile, toasts } = stubs(on, { env: AG_ENV, agents: AG_ME })
  const rival = agentFile(putFile, clock, disk)
  const one = { kind: 'question', id: 'q1', questions: [{ question: 'Какую базу взять?', header: 'База', options: ['Postgres', 'SQLite'], multi: false }] }
  const two = {
    kind: 'question',
    id: 'q2',
    questions: [
      { question: 'Что проверить?', header: '', options: ['Тесты', 'Линтер', 'Типы'], multi: true },
      { question: 'Куда выложить?', header: 'Ветка', options: ['main', 'dev'], multi: false },
    ],
  }
  const docs = { sid: 'sess-b', name: 'docs', path: 'D:\\work\\docs', status: 'working', since: -60_000 }
  const site = { sid: 'sess-c', name: 'site', path: 'D:\\work\\site', status: 'permission', since: -2 * 60_000, ask: { kind: 'permission', tool: 'Bash', what: 'npm test' } }
  const api = { sid: 'sess-a', name: 'api', status: 'permission', since: -3 * 60_000, ask: two }
  // Отметки соперников — до старта: места ровно эти
  rival(9, docs)
  rival(12, site)
  rival(3, api)
  await start($)
  // Первое чтение только запоминает, что видно
  await clock.advance(10_000)
  rival(9, { ...docs, status: 'permission', ask: one })
  rival(12, site)
  rival(3, api)
  await clock.advance(AGENT_READ_MS + AGENT_TICK_MS)
  expect(toasts.filter((t) => t.includes('«docs»'))).toEqual(['Сессия «docs» ждёт ответа на вопрос'])

  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await term.press({ key: 'arcade-menu-agents' })
  await term.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const label = async (key: string) => (await ui.find({ key }))?.props?.label
  expect(await boxKeys(ui, 'agents-card-')).toEqual(['agents-card-sess-a', 'agents-card-sess-c', 'agents-card-sess-b', 'agents-card-sess-me'])
  expect(await text(/^ждёт ответа · 1 мин$/)).toBeDefined()
  // Запрос разрешения: что просят — и где отвечать; кнопок нет
  expect(await text('Bash: npm test')).toBeDefined()
  expect(await text('Разрешение даётся только в самой сессии.')).toBeDefined()
  expect(JSON.stringify((await ui.find({ key: 'agents-card-sess-c' }))?.props)).not.toContain('agents-q-')
  // Один вопрос с одним ответом: нажал вариант — ответ ушёл
  expect(await text('База')).toBeDefined()
  expect(await text('Какую базу взять?')).toBeDefined()
  expect([await label('agents-q-sess-b-0-0'), await label('agents-q-sess-b-0-1')]).toEqual(['Postgres', 'SQLite'])
  expect(await ui.find({ key: 'agents-send-sess-b' })).toBeUndefined()
  await ui.press({ key: 'agents-q-sess-b-0-1' })
  expect(JSON.parse(disk.get(`${AG_DIR}\\a9.json`))).toMatchObject({ v: 1, to: 'sess-b', id: 'q1', picks: [['SQLite']] })
  expect(await text('Ответ отправлен — сессия получит его через секунду.')).toBeDefined()
  expect(await ui.find({ key: 'agents-q-sess-b-0-0' })).toBeUndefined()

  // Несколько вопросов: отметить варианты (где можно несколько — снять повторным нажатием), потом «Ответить»
  await ui.press({ key: 'agents-q-sess-a-0-0' })
  await ui.press({ key: 'agents-q-sess-a-0-2' })
  await ui.press({ key: 'agents-q-sess-a-0-0' })
  await ui.press({ key: 'agents-q-sess-a-0-0' })
  expect([await label('agents-q-sess-a-0-0'), await label('agents-q-sess-a-0-1'), await label('agents-q-sess-a-0-2')]).toEqual(['✓ Тесты', 'Линтер', '✓ Типы'])
  expect(await ui.find({ key: 'agents-send-sess-a' })).toBeUndefined()
  await ui.press({ key: 'agents-q-sess-a-1-0' })
  await ui.press({ key: 'agents-q-sess-a-1-1' })
  expect([await label('agents-q-sess-a-1-0'), await label('agents-q-sess-a-1-1')]).toEqual(['main', '✓ dev'])
  expect(disk.has(`${AG_DIR}\\a3.json`)).toBe(false)
  expect(await label('agents-send-sess-a')).toBe('Ответить')
  await ui.press({ key: 'agents-send-sess-a' })
  expect(JSON.parse(disk.get(`${AG_DIR}\\a3.json`))).toMatchObject({ v: 1, to: 'sess-a', id: 'q2', picks: [['Типы', 'Тесты'], ['dev']] })
  expect(await ui.find({ key: 'agents-send-sess-a' })).toBeUndefined()
  await ui.unmount()
})

// Свой $ и свои часы: проверка tool.check в тесте не знает, кого спросить (approver), — через движок её не вызвать.
// Модули теста — отдельная от мода копия: состояние S здесь своё
test('запрос разрешения без классического хука (Team): «спросить» у вызова Claude — через паузу «ждёт разрешения», решение из телеметрии — снова работает; вердикт не меняется', async () => {
  let now = 0
  const timers: { at: number; fn: () => any }[] = []
  const $: any = {
    clock: { now: async () => now, after: (ms: number, fn: () => any) => void timers.push({ at: now + ms, fn }) },
    ui: { invalidate: () => {}, close: async () => {} },
    process: { run: async () => ({}) },
  }
  const advance = async (ms: number) => {
    now += ms
    for (const t of timers.filter((x) => x.at <= now).sort((a, b) => a.at - b.at)) {
      timers.splice(timers.indexOf(t), 1)
      await t.fn()
    }
  }
  const engine = (verdict: any, plugin = 'engine') => Object.assign(async () => verdict, { origin: { plugin, tier: 'core' } })
  const call = (id: string, more: any = {}) => ({ tool: 'Bash', input: { command: 'npm test\nnpm run lint' }, tool_use_id: id, approver: 'person', ...more })
  const check = (id: string, more: any = {}) => checkObserved($, call(id, more), engine({ decision: 'ask' }))
  // Решение по вызову — в телеметрии; из неё берём только id вызова и режим
  const decided = (id: string, mode = 'default') =>
    toolDecided($, { to: 'collector', event: 'claude_code.tool_decision', attributes: { tool_use_id: id, permission_mode: mode, decision: 'accept', source: 'user_temporary' } })
  const waits = () => S.status === 'permission'
  asksReset()
  S.status = 'working'
  S.permMode = ''

  // Вердикт уходит тем же объектом. Режим ещё неизвестен — ждём 3 с: вдруг решит классификатор
  const verdict = { decision: 'ask' }
  expect(await checkObserved($, call('toolu_1'), engine(verdict))).toBe(verdict)
  await advance(2_900)
  expect(waits()).toBe(false)
  await advance(200)
  expect(waits()).toBe(true)
  expect(S.ask).toEqual({ kind: 'permission', tool: 'Bash', what: 'npm test' })
  expect(S.events[0]).toMatch(/запрос разрешения: Bash$/)
  decided('toolu_1')
  expect([S.status, S.ask, S.permMode]).toEqual(['working', null, 'default'])
  expect(S.events[0]).toMatch(/агент снова работает$/)

  // Режим известен и не авто — диалог сразу, ждём меньше секунды
  await check('toolu_2')
  await advance(600)
  expect(waits()).toBe(false)
  await advance(200)
  expect(waits()).toBe(true)
  decided('toolu_2', 'auto')
  expect(waits()).toBe(false)
  // Авто: классификатор решил раньше 20 с — человека не ждали
  await check('toolu_3')
  await advance(19_000)
  decided('toolu_3', 'auto')
  await advance(2_000)
  expect(waits()).toBe(false)
  // Два запроса сразу (субагенты): виден последний; ответили на него — виден первый, на оба — снова работает
  await check('toolu_10')
  await check('toolu_11', { tool: 'Write', input: { file_path: 'D:\work\web\notes.txt' } })
  await advance(20_000)
  expect(S.ask).toEqual({ kind: 'permission', tool: 'Write', what: 'D:\work\web\notes.txt' })
  decided('toolu_11', 'auto')
  expect([S.status, S.ask?.tool]).toEqual(['permission', 'Bash'])
  decided('toolu_10', 'auto')
  expect([S.status, S.ask]).toEqual(['working', null])
  // Телеметрия обогнала вердикт — запроса нет
  decided('toolu_4', 'auto')
  await check('toolu_4')
  // Спросить некого, вызов без id, вопрос, вызов мода, «можно» — тоже нет
  await check('toolu_5', { approver: undefined })
  await check('')
  await check('toolu_6', { tool: 'AskUserQuestion' })
  await checkObserved($, call('toolu_7'), engine({ decision: 'ask' }, 'arcade'))
  await checkObserved($, call('toolu_8'), engine({ decision: 'allow' }))
  await advance(21_000)
  expect(waits()).toBe(false)
  expect(timers).toEqual([])
  // Другие события телеметрии не трогают ничего
  toolDecided($, { to: 'collector', event: 'claude_code.api_request', attributes: { permission_mode: 'plan' } })
  expect(S.permMode).toBe('auto')
  asksReset()
  S.status = 'idle'
  S.permMode = ''
})

test('в разрешении отказали — статус «ждёт разрешения» не висит до конца хода', async ($, on) => {
  const { clock, disk } = stubs(on, { env: AG_ENV, agents: AG_ME, deny: (e: any) => e.tool === 'Bash' && e.tool_use_id })
  await start($)
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // Запрос разрешения показан (классический хук), человек отказал: PostToolUse не будет. Тестовая среда 2.1.302 отказ
  // не соблюдает и пускает вызов к заглушке Bash — тогда он идёт BASH_MS по часам теста, но PostToolUse нет и там
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm test' } })
  const call = $.tool.call({ tool: 'Bash', command: 'npm test' })
  await clock.advance(BASH_MS)
  await call
  expect(await ui.find({ type: 'Text', text: /запрос разрешения: Bash/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /ждёт разрешения/ })).toBeUndefined()
  await clock.advance(AGENT_TICK_MS)
  expect(ownRecord(disk)).toMatchObject({ status: 'working', ask: null })
  await ui.unmount()
})

test('блокнот: голос — диктовка системы; «Взять из поля ввода Claude» переносит набранное там в конец страницы', async ($, on) => {
  const { clock, saved, fills } = stubs(on, { env: WINDOWS, draft: 'купить молоко\nпозвонить маме\n' })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  await ui.press({ key: 'arcade-menu-notes' })
  await noteInput(ui, 'arcade-note-new-', 'Дела')
  await noteInput(ui, 'arcade-note-add-', 'тесты')
  expect(await text('  Голосом: Win+H — диктовка Windows пишет туда, где курсор.')).toBeDefined()
  expect(await text('  Голосом: дважды Fn — диктовка macOS пишет туда, где курсор.')).toBeUndefined()
  expect(await ui.find({ key: 'arcade-note-take' })).toMatchObject({ props: { label: 'Взять из поля ввода Claude' } })
  await ui.press({ key: 'arcade-note-take' })
  expect((saved.get('notes') as any[])[0].body).toBe('- [ ] тесты\nкупить молоко\nпозвонить маме')
  // Поле ввода Claude после переноса — пустое
  expect(fills.map((x: any) => [x.text, x.mode])).toEqual([['', 'replace']])
  expect(await text('Текст из поля ввода Claude — в конце страницы.')).toBeDefined()
  expect(await text('купить молоко')).toBeDefined()
  expect(await ui.find({ key: 'arcade-note-take' })).toMatchObject({ props: { autoFocus: true } })
  await ui.unmount()
})

test('блокнот: голос на macOS — подсказка про Fn; поле ввода Claude пустое — так и говорим, страница как была', async ($, on) => {
  const { clock, saved, fills } = stubs(on, { uname: 'Darwin' })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  await ui.press({ key: 'arcade-menu-notes' })
  await noteInput(ui, 'arcade-note-new-', 'Дела')
  expect(await text('  Голосом: дважды Fn — диктовка macOS пишет туда, где курсор.')).toBeDefined()
  expect(await text('  Голосом: Win+H — диктовка Windows пишет туда, где курсор.')).toBeUndefined()
  await ui.press({ key: 'arcade-note-take' })
  expect(await text('Поле ввода Claude пустое — надиктуй или впиши туда текст и нажми ещё раз.')).toMatchObject({ props: { color: 'warning' } })
  expect((saved.get('notes') as any[])[0].body).toBe('')
  expect(fills.length).toBe(0)
  await ui.unmount()
})

test('блокнот по-английски: Notion, другие приложения и голос — экраны без русских букв, просьбы Claude по-английски', async ($, on) => {
  const { clock, saved, submits } = stubs(on, { env: { ...WINDOWS, LANG: 'en_US.UTF-8' }, submit: true })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const cyrillic = async () => (await drawnTexts(ui)).filter((x) => /[А-Яа-яЁё]/.test(x) && x !== '🌐 Русский')
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const NO_TOOLS = 'If you have no tools for that app, do nothing else — just explain how to connect its connector in Claude.'
  await ui.press({ key: 'arcade-menu-notes' })
  expect(await ui.find({ key: await noteKey(ui, 'arcade-note-import-') })).toMatchObject({ props: { label: 'Import from Notion or another app', placeholder: 'link or page title', submitLabel: 'Import' } })
  expect(await text("  Through Claude's connectors: Arcade needs no keys or passwords. No connector — Claude will tell you how to connect one.")).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await noteInput(ui, 'arcade-note-import-', 'Roadmap')
  expect(submits[0].text.split('\n').slice(0, 2)).toEqual(['Bring a page from another app into my Arcade notebook.', 'What to bring: Roadmap'])
  expect(submits[0].text.endsWith(NO_TOOLS)).toBe(true)
  expect(await text('The request went to Claude.')).toBeDefined()

  await noteInput(ui, 'arcade-note-new-', 'Weekly plan')
  const id = (saved.get('notes') as any[])[0].id
  expect(await ui.find({ key: 'arcade-note-take' })).toMatchObject({ props: { label: "Take from Claude's prompt box" } })
  expect(await text("  Moves what you typed or dictated in Claude's prompt box to the end of the page.")).toBeDefined()
  expect(await text('  By voice: Win+H — Windows dictation types where the cursor is.')).toBeDefined()
  expect(await text('Notion and other apps')).toBeDefined()
  expect(await ui.find({ key: 'arcade-note-notion' })).toMatchObject({ props: { label: 'Send to Notion' } })
  expect(await ui.find({ key: await noteKey(ui, 'arcade-note-app-') })).toMatchObject({ props: { label: 'To another app', submitLabel: 'Send' } })
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-note-take' })
  expect(await text("Claude's prompt box is empty — dictate or type text there and press again.")).toBeDefined()
  await ui.press({ key: 'arcade-note-notion' })
  expect(submits[1].text.split('\n').slice(0, 5)).toEqual(['Move a page from my Arcade notebook to another app.', 'App: Notion', `Notebook page: ${id}`, '', '# Weekly plan'])
  expect(submits[1].text.endsWith(NO_TOOLS)).toBe(true)

  // Claude связал страницу и заменил текст: всё вокруг — по-английски
  await $.tool.call({ tool: NOTES, action: 'link', page: 'Weekly plan', app: 'Notion', url: 'https://www.notion.so/Weekly-1' })
  await $.tool.call({ tool: NOTES, action: 'replace', page: 'Weekly plan', text: '- [ ] tests' })
  expect(await text('  Linked to Notion: https://www.notion.so/Weekly-1')).toBeDefined()
  expect(await ui.find({ key: 'arcade-note-push' })).toMatchObject({ props: { label: 'Update in the app' } })
  expect(await ui.find({ key: 'arcade-note-pull' })).toMatchObject({ props: { label: 'Import from the app' } })
  expect(await ui.find({ key: 'arcade-note-open' })).toMatchObject({ props: { label: 'Open in browser' } })
  expect(await ui.find({ key: 'arcade-note-unlink' })).toMatchObject({ props: { label: 'Unlink' } })
  expect(await ui.find({ key: 'arcade-note-undo' })).toMatchObject({ props: { label: "Restore the text from before Claude's edit" } })
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-note-pull' })
  expect(submits[2].text.split('\n').slice(0, 4)).toEqual(['Bring the text of a page from another app into my Arcade notebook.', 'App: Notion', 'Address: https://www.notion.so/Weekly-1', `Notebook page: ${id}`])
  await ui.press({ key: 'arcade-note-push' })
  expect(submits[3].text.split('\n')[0]).toBe('Update a page in another app with the text from my Arcade notebook.')
  await ui.press({ key: 'arcade-note-open' })
  expect(await text('The page is open in the browser.')).toBeDefined()
  await ui.press({ key: 'arcade-note-undo' })
  expect(await text('The previous text is back.')).toBeDefined()
  await ui.press({ key: 'arcade-note-unlink' })
  expect(await text('The page is unlinked.')).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await ui.unmount()
})

// Календарь: события — в $.store мода (ключ calendar); Claude ведёт его инструментом mcp__arcade__calendar.
// Часы тестов начинаются с 1970 года — календарные тесты сначала переводят их на понедельник 2 ноября 2026, 12:00
const CAL = 'mcp__arcade__calendar'
const T0 = new Date(2026, 10, 2, 12, 0).getTime()
const at = (day: string, time = '00:00') => new Date(`${day}T${time}:00`).getTime()

test('календарь: дни, быстрая запись, сетка месяца', () => {
  expect([dayKey(T0), weekday('2026-11-02'), weekday('2026-11-08'), addDays('2026-12-31', 1), addMonths('2026-12', 1), addMonths('2026-01', -1)]).toEqual(['2026-11-02', 0, 6, '2027-01-01', '2027-01', '2025-12'])
  expect([cleanDay('2026-02-29'), cleanDay('2028-02-29'), cleanDay('2026-13-01'), cleanDay(' 2026-11-20 '), cleanDay('20.11.2026')]).toEqual(['', '2028-02-29', '', '2026-11-20', ''])
  expect([cleanTime('9:05'), cleanTime('09:05'), cleanTime('24:00'), cleanTime('12.11'), cleanTime('')]).toEqual(['09:05', '09:05', '', '', ''])

  // День и время — где угодно в строке, остальное — название; без дня — день base, без времени — весь день
  const today = '2026-11-02'
  expect(quickParse('завтра 15:00 Созвон', today)).toEqual({ title: 'Созвон', day: '2026-11-03', time: '15:00' })
  expect(quickParse('пт в 9:30 стендап', today)).toEqual({ title: 'стендап', day: '2026-11-06', time: '09:30' })
  expect(quickParse('Tomorrow at 9:05 standup', today)).toEqual({ title: 'standup', day: '2026-11-03', time: '09:05' })
  expect(quickParse('Созвон 2026-11-20 10:00', today)).toEqual({ title: 'Созвон', day: '2026-11-20', time: '10:00' })
  expect(quickParse('12.11 Ревью', today)).toEqual({ title: 'Ревью', day: '2026-11-12', time: '' })
  // Число, которое в этом году уже прошло, — в следующем; понедельник в понедельник — сегодня
  expect(quickParse('01.11 Ревью', today).day).toBe('2027-11-01')
  expect(quickParse('пн отчёт', today)).toEqual({ title: 'отчёт', day: today, time: '' })
  expect(quickParse('Отчёт', '2026-11-12', today)).toEqual({ title: 'Отчёт', day: '2026-11-12', time: '' })
  expect(quickParse('в 25:00 праздник', today)).toEqual({ title: 'в 25:00 праздник', day: today, time: '' })

  // Недели с понедельника, дни соседних месяцев — по краям
  const nov = monthGrid('2026-11')
  expect(nov.length).toBe(6)
  expect(nov.every((w) => w.length === 7)).toBe(true)
  expect(nov[0][0]).toEqual({ day: '2026-10-26', date: 26, inMonth: false })
  expect(nov[0][6]).toEqual({ day: '2026-11-01', date: 1, inMonth: true })
  expect(nov[5].map((d) => d.date)).toEqual([30, 1, 2, 3, 4, 5, 6])
  expect(monthGrid('2026-06').map((w) => w[0].day)).toEqual(['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29'])
})

test('календарь: хранилище, правки и напоминания', () => {
  // Что не сходится — мимо; события на весь день — первыми в своём дне
  expect(restoreCalendar(null)).toEqual([])
  expect(
    restoreCalendar([
      { id: 'e1', title: ' Созвон ', day: '2026-11-03', time: '9:00', remind: 15, at: 5, alerted: 7, alertedBy: 'sx' },
      { id: 'e2', title: 'Нет такого дня', day: '2026-02-30' },
      { id: 'E!', title: 'Плохой id', day: '2026-11-03' },
      { id: 'e1', title: 'Дубль', day: '2026-11-03' },
      { id: 'e3', title: 'Весь день', day: '2026-11-03', remind: -5, note: '  ссылка  ' },
      { id: 'e4', title: 'Плохое время', day: '2026-11-01', time: '25:00' },
      { id: 'e5', title: '  ', day: '2026-11-01' },
    ]),
  ).toEqual([
    { id: 'e3', title: 'Весь день', day: '2026-11-03', remind: null, at: 0, note: 'ссылка' },
    { id: 'e1', title: 'Созвон', day: '2026-11-03', time: '09:00', remind: 15, at: 5, alerted: 7, alertedBy: 'sx' },
  ])

  // Новое событие: за 15 минут, на весь день — в 9:00; id — от времени, занятый — с номером
  const one: any = addEvent([], { title: 'Созвон', day: '2026-11-03', time: '15:00' }, T0)
  expect(one.event).toEqual({ id: `e${T0.toString(36)}`, title: 'Созвон', day: '2026-11-03', time: '15:00', remind: 15, at: T0 })
  const two: any = addEvent(one.list, { title: 'Отчёт', day: '2026-11-03', note: 'итоги\r\nнедели' }, T0)
  expect(two.event).toMatchObject({ id: `e${T0.toString(36)}1`, remind: 0, note: 'итоги\nнедели' })
  expect(two.list.map((e: any) => e.title)).toEqual(['Отчёт', 'Созвон'])
  expect([addEvent([], { title: ' ', day: '2026-11-03' }, T0), addEvent([], { title: 'x', day: '2026-02-30' }, T0), addEvent([], { title: 'x', day: '2026-11-03', time: '25:00' }, T0), addEvent([], { title: 'x', day: '2026-11-03', remind: -1 }, T0)]).toEqual([{ error: 'title' }, { error: 'day' }, { error: 'time' }, { error: 'remind' }])
  // Напоминание, время которого уже прошло, когда событие записали, — не пропущенное: его не покажут
  const soon: any = addEvent([], { title: 'Скоро', day: '2026-11-02', time: '12:10' }, T0).event
  expect(soon.alerted).toBe(at('2026-11-02', '11:55'))
  expect(dueReminders([soon], T0)).toEqual({ due: [], stale: [] })

  // Правка: только переданное; time '' — на весь день, и напоминание снова впереди
  const id = one.event.id
  const moved: any = updateEvent(two.list, id, { time: '', note: 'ссылка' }, T0)
  expect(moved.event).toEqual({ id, title: 'Созвон', day: '2026-11-03', remind: 15, at: T0, note: 'ссылка' })
  expect(remindAt(moved.event)).toBe(at('2026-11-03', '08:45'))
  expect([updateEvent(two.list, 'enope', { title: 'x' }, T0), updateEvent(two.list, id, { time: '9' }, T0), updateEvent(two.list, id, { remind: 99999 }, T0)]).toEqual([{ error: 'missing' }, { error: 'time' }, { error: 'remind' }])
  expect((updateEvent(two.list, id, { remind: null }, T0) as any).event.remind).toBe(null)

  // Пора: due — показать (пропущенные — если событие было не раньше суток назад), stale — отметить молча
  const list = restoreCalendar([
    { id: 'ea', title: 'Сейчас', day: '2026-11-02', time: '12:10', remind: 10 },
    { id: 'eb', title: 'Утром', day: '2026-11-02', time: '10:00', remind: 15 },
    { id: 'ec', title: 'Давно', day: '2026-10-20', remind: 0 },
    { id: 'ed', title: 'Позже', day: '2026-11-02', time: '18:00', remind: 30 },
    { id: 'ee', title: 'Без', day: '2026-11-02', time: '11:00', remind: null },
  ])
  const due = dueReminders(list, T0)
  expect([due.due.map((e: any) => e.id), due.stale.map((e: any) => e.id)]).toEqual([['eb', 'ea'], ['ec']])
  const marked = markAlerted(markAlerted(list, ['ec']), ['ea', 'eb'], 'sme')
  expect(marked.find((e: any) => e.id === 'ea')).toMatchObject({ alerted: at('2026-11-02', '12:00'), alertedBy: 'sme' })
  expect(marked.find((e: any) => e.id === 'ec')).toMatchObject({ alerted: at('2026-10-20', '09:00') })
  expect(marked.find((e: any) => e.id === 'ec').alertedBy).toBeUndefined()
  expect(dueReminders(marked, T0)).toEqual({ due: [], stale: [] })
  expect(nextReminder(marked, T0)).toBe(at('2026-11-02', '17:30'))
  expect(nextReminder([], T0)).toBe(null)

  // Цвет: название из набора; без цвета — синий, в событии не хранится
  expect(restoreCalendar([{ id: 'e1', title: 'a', day: '2026-11-03', color: 'red' }, { id: 'e2', title: 'b', day: '2026-11-03', color: 'teal' }]).map((e: any) => e.color)).toEqual(['red', undefined])
  const red: any = addEvent([], { title: 'Ревью', day: '2026-11-03', color: 'red' }, T0)
  expect(red.event.color).toBe('red')
  expect(addEvent([], { title: 'x', day: '2026-11-03', color: 'teal' }, T0)).toEqual({ error: 'color' })
  expect((updateEvent(red.list, red.event.id, { color: 'green' }, T0) as any).event.color).toBe('green')
  expect('color' in (updateEvent(red.list, red.event.id, { color: '' }, T0) as any).event).toBe(false)
  expect(updateEvent(red.list, red.event.id, { color: '#ff0000' }, T0)).toEqual({ error: 'color' })
})

test('календарь: своё напоминание словами, выбор из списка', () => {
  // Минуты до начала; у события на весь день — до 9:00 этого дня. Позже начала, раньше чем за неделю, непонятное — undefined
  const call = { time: '15:00' }
  const allDay = {}
  const cases: [string, number | null | undefined, number | null | undefined][] = [
    ['за 45 мин', 45, 45],
    ['за 1 ч 30 мин', 90, 90],
    ['за час', 60, 60],
    ['за полчаса', 30, 30],
    ['1,5 ч', 90, 90],
    ['15', 15, 15],
    ['в начале', 0, 0],
    ['в 14:30', 30, undefined],
    ['в 8:30', 390, 30],
    ['накануне в 20:00', 1140, 780],
    ['за 2 дня в 18:00', 2700, 2340],
    ['2 hours before', 120, 120],
    ['the day before at 20:00', 1140, 780],
    ['нет', null, null],
    ['в 16:00', undefined, undefined],
    ['за 8 дней', undefined, undefined],
    ['за 2 часа в 18:00', undefined, undefined],
    ['когда-нибудь', undefined, undefined],
    ['', undefined, undefined],
  ]
  expect(cases.map(([text]) => [text, parseRemind(text, call), parseRemind(text, allDay)])).toEqual(cases)

  // Выбор: готовые варианты; своё значение встаёт по порядку
  expect(remindChoices({ time: '15:00', remind: 15 })).toEqual([0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080, null])
  expect(remindChoices({ time: '15:00', remind: 45 })).toEqual([0, 5, 10, 15, 30, 45, 60, 120, 1440, 2880, 10080, null])
  expect(remindChoices({ remind: 780 })).toEqual([0, 60, 120, 720, 780, 900, 1440, 2880, 10080, null])
  // Где выбора нет — по кругу
  expect([nextRemind({ time: '15:00', remind: 45 }), nextRemind({ time: '15:00', remind: null }), nextRemind({ remind: 0 }), nextRemind({ remind: 10080 })]).toEqual([60, 0, 60, null])
})

test('календарь: инструмент Claude — ответы по-английски, с сегодняшним днём', () => {
  const head = 'Today is Mon 2026-11-02, 12:00 local time.'
  expect(applyCalendarTool([], { action: 'list' }, T0)).toEqual({ list: [], text: `${head}\nNo events from 2026-11-02 to 2026-11-08. The calendar is empty.` })
  const added: any = applyCalendarTool([], { action: 'add', title: 'Созвон', day: '2026-11-03', time: '15:00' }, T0)
  const id = `e${T0.toString(36)}`
  expect(added).toMatchObject({ text: `${head}\nAdded:\n- ${id}: Tue 2026-11-03 15:00 — Созвон (reminder 15 min before)`, changed: true })
  let list = added.list
  const day: any = applyCalendarTool(list, { action: 'add', title: 'Отпуск', day: '2026-11-20', remind: 1440 }, T0 + 1)
  expect(day.text.endsWith('Fri 2026-11-20 all day — Отпуск (reminder 1 d before 9:00)')).toBe(true)
  list = day.list
  expect(applyCalendarTool(list, { action: 'list' }, T0).text).toBe(`${head}\nEvents from 2026-11-02 to 2026-11-08:\n- ${id}: Tue 2026-11-03 15:00 — Созвон (reminder 15 min before)`)
  expect(applyCalendarTool(list, { action: 'list', day: '2026-11-15', days: 7 }, T0).text.split('\n')[1]).toBe('Events from 2026-11-15 to 2026-11-21:')
  expect(applyCalendarTool(list, { action: 'list', day: '2026-12-01' }, T0).text).toBe(`${head}\nNo events from 2026-12-01 to 2026-12-07.`)

  // Правка — по id или точному названию без учёта регистра; меняется только переданное
  const upd: any = applyCalendarTool(list, { action: 'update', event: 'созвон', remind: 60, note: 'ссылка\nвторая строка' }, T0)
  expect(upd.text).toBe(`${head}\nUpdated:\n- ${id}: Tue 2026-11-03 15:00 — Созвон (reminder 1 h before)\n  note: ссылка / вторая строка`)
  list = upd.list
  expect(applyCalendarTool(list, { action: 'update', event: id, remind: -1, time: '' }, T0).text.split('\n')[2]).toBe(`- ${id}: Tue 2026-11-03 all day — Созвон (no reminder)`)
  expect(applyCalendarTool(list, { action: 'update', event: id, remind: 0 }, T0).text.split('\n')[2]).toBe(`- ${id}: Tue 2026-11-03 15:00 — Созвон (reminder at the start)`)
  const red: any = applyCalendarTool(list, { action: 'update', event: id, color: 'red' }, T0)
  expect(red.text.split('\n')[2]).toBe(`- ${id}: Tue 2026-11-03 15:00 — Созвон (reminder 1 h before, red)`)
  expect(red.list.find((e: any) => e.id === id).color).toBe('red')
  expect(applyCalendarTool(red.list, { action: 'update', event: id, color: '' }, T0).text.split('\n')[2]).toBe(`- ${id}: Tue 2026-11-03 15:00 — Созвон (reminder 1 h before)`)

  // Ошибки — с подсказкой, что делать; календарь не меняется
  const fails: any[] = [
    applyCalendarTool(list, { action: 'add', title: 'x', day: '2026-11-03', time: '3pm' }, T0),
    applyCalendarTool(list, { action: 'add', title: 'x', day: 'tomorrow' }, T0),
    applyCalendarTool(list, { action: 'update', event: id }, T0),
    applyCalendarTool(list, { action: 'add', title: 'x', day: '2026-11-03', color: 'teal' }, T0),
    applyCalendarTool(list, { action: 'remove', event: 'Ужин' }, T0),
    applyCalendarTool(list, { action: 'list', days: 0 }, T0),
    applyCalendarTool(list, { action: 'move' }, T0),
  ]
  expect(fails.every((f) => f.isError && f.list === list && f.text.startsWith(`${head}\n`))).toBe(true)
  expect(fails.map((f) => f.text.split('\n')[1])).toEqual([
    'time must be HH:MM, 24-hour, e.g. 15:00, or empty for all day.',
    'day must be a real date as YYYY-MM-DD.',
    'Nothing to change: pass title, day, time, note, remind, color or repeat.',
    'color is one of blue, green, yellow, orange, red, purple, pink, gray, or "" for the default.',
    'No event "Ужин". Use list to see the events and their ids.',
    'days is 1 to 92.',
    'Unknown action: use list, add, update or remove.',
  ])
  const twin = applyCalendarTool(list, { action: 'add', title: 'Созвон', day: '2026-11-04', time: '10:00' }, T0 + 2).list
  expect(applyCalendarTool(twin, { action: 'remove', event: 'Созвон' }, T0).text.split('\n')[1]).toBe(`Several events are called "Созвон": ${id} (Tue 2026-11-03 15:00), e${(T0 + 2).toString(36)} (Wed 2026-11-04 10:00). Pass the id.`)

  const gone: any = applyCalendarTool(list, { action: 'remove', event: id }, T0)
  expect(gone).toMatchObject({ text: `${head}\nRemoved: Созвон (Tue 2026-11-03 15:00).`, changed: true })
  expect(gone.list.map((e: any) => e.title)).toEqual(['Отпуск'])
})

test('календарь: повторяющиеся события — правила, быстрая запись, напоминания серии', () => {
  // Быстрая запись: повтор — словами; одно слово «Daily» — часть названия, а не повтор
  expect(quickParse('каждый будний день 9:30 стендап', '2026-11-02')).toEqual({ title: 'стендап', day: '2026-11-02', time: '09:30', repeat: 'weekdays' })
  expect(quickParse('каждую пятницу ревью', '2026-11-02')).toEqual({ title: 'ревью', day: '2026-11-06', time: '', repeat: 'weekly' })
  expect(quickParse('по пятницам 15:00 ретро', '2026-11-02')).toEqual({ title: 'ретро', day: '2026-11-06', time: '15:00', repeat: 'weekly' })
  expect(quickParse('every weekday 9:30 standup', '2026-11-02')).toEqual({ title: 'standup', day: '2026-11-02', time: '09:30', repeat: 'weekdays' })
  expect(quickParse('ежемесячно 10.11 счёт', '2026-11-02')).toEqual({ title: 'счёт', day: '2026-11-10', time: '', repeat: 'monthly' })
  expect(quickParse('Daily standup', '2026-11-02')).toEqual({ title: 'Daily standup', day: '2026-11-02', time: '' })

  // Серия — одно событие; по дням — каждым своим разом, с днём первого раза (first)
  let list: any[] = []
  const series = (title: string, day: string, repeat: string, n: number) => {
    const out: any = addEvent(list, { title, day, repeat }, T0 + n)
    list = out.list
    return out.event
  }
  const daily = series('Зарядка', '2026-11-02', 'daily', 1)
  // По будням с субботы — с понедельника
  expect(series('Стендап', '2026-11-07', 'weekdays', 2)).toMatchObject({ day: '2026-11-09', repeat: 'weekdays' })
  series('Ревью', '2026-11-06', 'weekly', 3)
  series('Счёт', '2026-10-31', 'monthly', 4)
  series('День рождения', '2026-11-03', 'yearly', 5)
  const on = (title: string, from: string, days: number) => between(list, from, days).filter((x: any) => x.title === title).map((x: any) => x.day)
  expect(on('Зарядка', '2026-11-01', 4)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04'])
  expect(on('Стендап', '2026-11-07', 9)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'])
  expect(on('Ревью', '2026-11-01', 21)).toEqual(['2026-11-06', '2026-11-13', '2026-11-20'])
  // 31-го — только в месяцах, где оно есть
  expect(on('Счёт', '2026-10-01', 92)).toEqual(['2026-10-31', '2026-12-31'])
  expect(on('День рождения', '2026-11-01', 400)).toEqual(['2026-11-03', '2027-11-03'])
  expect(between(list, '2026-11-04', 1).find((x: any) => x.title === 'Зарядка')).toMatchObject({ id: daily.id, day: '2026-11-04', first: '2026-11-02', repeat: 'daily' })
  // Повтор меняют и снимают; непонятный — ошибка; из хранилища непонятный повтор не берётся
  expect(updateEvent(list, daily.id, { repeat: 'hourly' }, T0)).toEqual({ error: 'repeat' })
  expect(addEvent(list, { title: 'x', day: '2026-11-02', repeat: 'hourly' }, T0)).toEqual({ error: 'repeat' })
  expect('repeat' in (updateEvent(list, daily.id, { repeat: '' }, T0) as any).event).toBe(false)
  expect((updateEvent(list, daily.id, { repeat: 'weekdays', day: '2026-11-08' }, T0) as any).event).toMatchObject({ day: '2026-11-09', repeat: 'weekdays' })
  expect(restoreCalendar([
    { id: 'e1', title: 'a', day: '2026-11-02', remind: 0, at: 0, repeat: 'weekly' },
    { id: 'e2', title: 'b', day: '2026-11-02', remind: 0, at: 0, repeat: 'hourly' },
  ]).map((e: any) => e.repeat)).toEqual(['weekly', undefined])

  // Напоминания серии — каждый раз свои. Записали в 12:00 — сегодняшнее уже прошло, его не показываем
  const made: any = addEvent([], { title: 'Стендап', day: '2026-11-02', time: '09:30', remind: 10, repeat: 'weekdays' }, T0)
  const id = made.event.id
  expect(made.event.alerted).toBe(at('2026-11-02', '09:20'))
  let s = made.list
  expect(dueReminders(s, T0)).toEqual({ due: [], stale: [] })
  expect(nextReminder(s, T0)).toBe(at('2026-11-03', '09:20'))
  // Во вторник — вторничный раз; показанный помечен его временем и больше не приходит
  const tue = at('2026-11-03', '09:21')
  expect(dueReminders(s, tue).due).toMatchObject([{ id, day: '2026-11-03', first: '2026-11-02', time: '09:30' }])
  s = markAlerted(s, [id], 'sme', tue)
  expect(s[0]).toMatchObject({ day: '2026-11-02', alerted: at('2026-11-03', '09:20'), alertedBy: 'sme' })
  expect(dueReminders(s, tue)).toEqual({ due: [], stale: [] })
  expect(nextReminder(s, tue)).toBe(at('2026-11-04', '09:20'))
  // Claude Code был закрыт до четверга — пропущенным приходит только последний раз
  expect(dueReminders(s, at('2026-11-05', '09:40')).due.map((x: any) => x.day)).toEqual(['2026-11-05'])
  // После пятничного — следующий в понедельник
  const fri = at('2026-11-06', '09:25')
  expect(nextReminder(markAlerted(s, [id], 'sme', fri), fri)).toBe(at('2026-11-09', '09:20'))

  // Инструмент Claude: повтор — полем repeat; в списке — каждый раз серии
  const head = 'Today is Mon 2026-11-02, 12:00 local time.'
  const added: any = applyCalendarTool([], { action: 'add', title: 'Стендап', day: '2026-11-02', time: '09:30', repeat: 'weekdays' }, T0)
  const sid = `e${T0.toString(36)}`
  expect(added.text).toBe(`${head}\nAdded:\n- ${sid}: Mon 2026-11-02 09:30 — Стендап (repeats every weekday from 2026-11-02, reminder 15 min before)`)
  const listed = applyCalendarTool(added.list, { action: 'list', day: '2026-11-05', days: 4 }, T0).text.split('\n').slice(2)
  expect(listed).toEqual([
    `- ${sid}: Thu 2026-11-05 09:30 — Стендап (repeats every weekday from 2026-11-02, reminder 15 min before)`,
    `- ${sid}: Fri 2026-11-06 09:30 — Стендап (repeats every weekday from 2026-11-02, reminder 15 min before)`,
  ])
  const weekly: any = applyCalendarTool(added.list, { action: 'update', event: sid, repeat: 'weekly', day: '2026-11-06' }, T0)
  expect(weekly.text.split('\n')[2]).toBe(`- ${sid}: Fri 2026-11-06 09:30 — Стендап (repeats every Fri from 2026-11-06, reminder 15 min before)`)
  expect(applyCalendarTool(weekly.list, { action: 'update', event: sid, repeat: '' }, T0).text.split('\n')[2]).toBe(`- ${sid}: Fri 2026-11-06 09:30 — Стендап (reminder 15 min before)`)
  const bad: any = applyCalendarTool(added.list, { action: 'add', title: 'x', day: '2026-11-02', repeat: 'hourly' }, T0)
  expect([bad.isError, bad.text.split('\n')[1]]).toEqual([true, 'repeat is one of daily, weekdays, weekly, monthly, yearly, or "" to stop repeating.'])
})

test('календарь: Claude ведёт его инструментом mcp__arcade__calendar без вопроса человеку, экран идёт следом', async ($, on) => {
  const { clock, saved, registered } = stubs(on)
  await clock.advance(T0)
  await start($)
  await clock.advance(200)
  expect(registered.find((t: any) => t.name === 'calendar')).toMatchObject({ isDeferred: true })
  expect(await $.tool.check({ tool: CAL, input: { action: 'list' } })).toMatchObject({ decision: 'allow' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-calendar' })
  expect(await ui.find({ type: 'Text', text: 'Календарь пуст — запиши первое событие.' })).toBeDefined()

  const made: any = await $.tool.call({ tool: CAL, action: 'add', title: 'Созвон', day: '2026-11-03', time: '15:00' })
  const id = /Added:\n- (e[a-z0-9]+): Tue 2026-11-03 15:00 — Созвон \(reminder 15 min before\)$/.exec(made.result)?.[1]
  expect(id).toBeDefined()
  expect(saved.get('calendar')).toMatchObject([{ id, title: 'Созвон', day: '2026-11-03', time: '15:00', remind: 15 }])
  // Экран рисуется заново: событие в «Ближайшем»
  expect(await ui.find({ key: `arcade-cal-ev-${id}` })).toMatchObject({ props: { label: 'Завтра 15:00 · Созвон' } })
  // Событие записали в другой сессии — list его видит
  saved.set('calendar', [...(saved.get('calendar') as any[]), { id: 'e1', title: 'Ревью', day: '2026-11-04', remind: 0, at: 0 }])
  const listed: any = await $.tool.call({ tool: CAL, action: 'list' })
  expect(listed.result.split('\n').slice(1)).toEqual(['Events from 2026-11-02 to 2026-11-08:', `- ${id}: Tue 2026-11-03 15:00 — Созвон (reminder 15 min before)`, '- e1: Wed 2026-11-04 all day — Ревью (reminder at 9:00)'])
  expect(await ui.find({ key: 'arcade-cal-ev-e1' })).toMatchObject({ props: { label: '04.11, весь день · Ревью' } })
  // Ошибка — отказом, с подсказкой для Claude
  const missing: any = await $.tool.call({ tool: CAL, action: 'remove', event: 'Ужин' })
  expect(missing.deny).toContain('No event "Ужин"')
  await $.tool.call({ tool: CAL, action: 'remove', event: 'Ревью' })
  expect(await ui.find({ key: 'arcade-cal-ev-e1' })).toBeUndefined()
  expect((saved.get('calendar') as any[]).map((e) => e.id)).toEqual([id])
  await ui.unmount()
})

test('календарь в терминале: быстрая запись, событие, напоминание, цвет, перенос и удаление', async ($, on) => {
  const { clock, saved } = stubs(on)
  await clock.advance(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-calendar' })
  const text = (t: string) => ui.find({ type: 'Text', text: t })
  const events = () => saved.get('calendar') as any[]

  await noteInput(ui, 'arcade-cal-add-', 'завтра 15:00 Созвон')
  expect(await text('Записано.')).toBeDefined()
  // Без дня в терминале — на сегодня, а не на день прошлой записи
  await noteInput(ui, 'arcade-cal-add-', 'Отчёт')
  expect(events().map((e) => [e.title, e.day, e.time, e.remind])).toEqual([
    ['Отчёт', '2026-11-02', undefined, 0],
    ['Созвон', '2026-11-03', '15:00', 15],
  ])
  const [report, call] = events().map((e) => e.id)
  expect(await ui.find({ key: `arcade-cal-ev-${report}` })).toMatchObject({ props: { label: 'Сегодня, весь день · Отчёт' } })
  expect(await ui.find({ key: `arcade-cal-ev-${call}` })).toMatchObject({ props: { label: 'Завтра 15:00 · Созвон' } })
  await noteInput(ui, 'arcade-cal-add-', 'завтра 16:00')
  expect(await text('Впиши, что за событие.')).toMatchObject({ props: { color: 'warning' } })
  expect(events().length).toBe(2)

  // Событие: напоминание — выбором из списка
  await ui.press({ key: `arcade-cal-ev-${call}` })
  const remind = () => ui.find({ key: 'arcade-cal-remind' })
  const options = async () => (await remind()).props.options.map((o: any) => o.label)
  expect(await remind()).toMatchObject({ props: { label: 'Напомнить', value: '15' } })
  expect(await options()).toEqual(['в начале', 'за 5 мин', 'за 10 мин', 'за 15 мин', 'за 30 мин', 'за час', 'за 2 ч', 'за сутки', 'за 2 дн.', 'за неделю', 'без напоминания'])
  expect(await text('Завтра 15:00 · 🔔 за 15 мин')).toBeDefined()
  await ui.select({ key: 'arcade-cal-remind', value: '30' })
  expect(events().find((e) => e.id === call).remind).toBe(30)
  expect(await remind()).toMatchObject({ props: { value: '30', autoFocus: true } })
  // Своё время словами — встаёт в список; позже начала — предупреждение, напоминание не меняется
  await noteInput(ui, 'arcade-cal-remind-own-', 'за 1 ч 30 мин')
  expect(events().find((e) => e.id === call).remind).toBe(90)
  expect(await remind()).toMatchObject({ props: { value: '90' } })
  expect((await options()).slice(5, 8)).toEqual(['за час', 'за 1 ч 30 мин', 'за 2 ч'])
  await noteInput(ui, 'arcade-cal-remind-own-', 'в 16:00')
  expect(await text('Не понял, когда напомнить: пиши как «за 45 мин», «в 14:30» или «накануне в 20:00» — не позже начала и не раньше чем за неделю.')).toMatchObject({ props: { color: 'warning' } })
  expect(events().find((e) => e.id === call).remind).toBe(90)
  await ui.select({ key: 'arcade-cal-remind', value: 'none' })
  expect(events().find((e) => e.id === call).remind).toBe(null)
  expect(await text('Завтра 15:00')).toBeDefined()
  await ui.select({ key: 'arcade-cal-remind', value: '60' })
  expect(events().find((e) => e.id === call).remind).toBe(60)

  // Цвет — кнопками; синий по умолчанию и в событии не хранится
  expect(await ui.find({ key: 'arcade-cal-color-blue' })).toMatchObject({ props: { label: 'синий', variant: 'primary' } })
  await ui.press({ key: 'arcade-cal-color-red' })
  expect(events().find((e) => e.id === call).color).toBe('red')
  expect(await ui.find({ key: 'arcade-cal-color-red' })).toMatchObject({ props: { variant: 'primary', autoFocus: true } })
  expect((await ui.find({ key: 'arcade-cal-color-blue' })).props.variant).toBeUndefined()
  await ui.press({ key: 'arcade-cal-color-blue' })
  expect('color' in events().find((e) => e.id === call)).toBe(false)
  await ui.press({ key: 'arcade-cal-color-green' })
  expect(events().find((e) => e.id === call).color).toBe('green')
  // Когда — как в быстрой записи; непонятное — предупреждение, событие не меняется
  await noteInput(ui, 'arcade-cal-when-', 'пт 9:30')
  expect(events().find((e) => e.id === call)).toMatchObject({ day: '2026-11-06', time: '09:30' })
  expect(await text('06.11 09:30')).toBeDefined()
  await noteInput(ui, 'arcade-cal-when-', 'когда-нибудь')
  expect(await text('Не понял, когда: пиши как «пт 15:00» или «2026-11-20 10:00».')).toMatchObject({ props: { color: 'warning' } })
  expect(events().find((e) => e.id === call)).toMatchObject({ day: '2026-11-06', time: '09:30' })
  await noteInput(ui, 'arcade-cal-note-', 'ссылка на встречу')
  expect(events().find((e) => e.id === call).note).toBe('ссылка на встречу')
  await noteInput(ui, 'arcade-cal-title-', 'Созвон с командой')
  expect(await text('Сохранено.')).toBeDefined()

  // Удаление — с подтверждением; «Отмена» возвращает фокус на кнопку
  await ui.press({ key: 'arcade-cal-delete' })
  expect(await text('Удалить событие насовсем?')).toBeDefined()
  await ui.press({ key: 'arcade-cal-delete-no' })
  expect(await text('Удалить событие насовсем?')).toBeUndefined()
  expect(await ui.find({ key: 'arcade-cal-delete' })).toMatchObject({ props: { autoFocus: true } })
  await ui.press({ key: 'arcade-cal-delete' })
  await ui.press({ key: 'arcade-cal-delete-yes' })
  expect(await text('Событие удалено.')).toBeDefined()
  expect(events().map((e) => e.title)).toEqual(['Отчёт'])
  expect(await ui.find({ key: `arcade-cal-ev-${call}` })).toBeUndefined()

  // У события на весь день — часами: в 9:00 этого дня, накануне вечером, за неделю
  await ui.press({ key: `arcade-cal-ev-${report}` })
  expect(await remind()).toMatchObject({ props: { value: '0' } })
  expect(await options()).toEqual(['в 9:00', 'в 8:00', 'в 7:00', 'накануне в 21:00', 'накануне в 18:00', 'накануне в 9:00', 'за 2 дн. в 9:00', 'за неделю в 9:00', 'без напоминания'])
  await noteInput(ui, 'arcade-cal-remind-own-', 'накануне в 20:00')
  expect(events().find((e) => e.id === report).remind).toBe(780)
  expect(await text('Сегодня, весь день · 🔔 накануне в 20:00')).toBeDefined()
  await noteInput(ui, 'arcade-cal-remind-own-', 'в 10:00')
  expect(await text('Не понял, когда напомнить: пиши как «в 8:30», «накануне в 20:00» или «за 3 дня в 9:00» — не позже 9:00 этого дня и не раньше чем за неделю.')).toMatchObject({ props: { color: 'warning' } })
  await ui.select({ key: 'arcade-cal-remind', value: '1440' })
  expect(events().find((e) => e.id === report).remind).toBe(1440)
  // Назад — фокус на том же событии
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: `arcade-cal-ev-${report}` })).toMatchObject({ props: { autoFocus: true } })
  await ui.unmount()
})

test('календарь в Desktop: сетка месяца, события дня, запись на выбранный день', async ($, on) => {
  const { clock, saved } = stubs(on, { stored: { calendar: [{ id: 'e1', title: 'Ревью', day: '2026-11-12', time: '10:00', remind: 15, at: 0, color: 'green' }] } })
  await clock.advance(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-calendar' })
  const text = (t: string) => ui.find({ type: 'Text', text: t })
  // Цветные точки событий на плитке дня
  const dots = async (day: string) => {
    const found: string[] = []
    const walk = (n: any) => {
      if (!n || typeof n !== 'object') return
      if (n.props?.color && (n.children ?? []).includes('●')) found.push(n.props.color)
      for (const c of n.children ?? []) walk(c)
    }
    walk(await ui.find({ key: `cal-cell-${day}` }))
    return found
  }

  expect(await text('Ноябрь 2026')).toBeDefined()
  expect(await ui.find({ key: 'arcade-cal-day-2026-11-02' })).toMatchObject({ props: { label: '2', plain: true } })
  expect(await ui.find({ key: 'arcade-cal-day-2026-11-12' })).toMatchObject({ props: { label: '12' } })
  expect(await ui.find({ key: 'arcade-cal-day-2026-10-26' })).toMatchObject({ props: { label: '26', dimColor: true } })
  // Плитки одного размера, растянуты на ширину панели и ужимаются с ней до нуля — ряд не уезжает за край; боковые поля
  // заданы — иначе Desktop даёт рамке поля pad.lg и число на узкой плитке обрезается. Число — без «пилюли» (plain),
  // выбранный день — в рамке цвета выбора, на дне с событием — точка его цвета
  const tiles = await Promise.all(['2026-11-02', '2026-11-12', '2026-10-26'].map((day) => ui.find({ key: `cal-cell-${day}` })))
  expect(new Set(tiles.map((t: any) => `${t.props.width} ${t.props.flexGrow} ${t.props.minWidth} ${t.props.overflow} ${t.props.paddingX}`))).toEqual(new Set(['0 1 0 hidden xs']))
  expect(await ui.find({ key: 'cal-wd-Пн' })).toMatchObject({ props: { width: 0, flexGrow: 1, minWidth: 0, overflow: 'hidden' } })
  expect(await ui.find({ key: 'cal-list' })).toBeUndefined()
  expect(tiles.map((t: any) => t.props.borderColor)).toEqual(['suggestion', 'subtle', 'subtle'])
  expect([await dots('2026-11-12'), await dots('2026-11-02')]).toEqual([['#22A06B'], []])
  expect(await ui.find({ key: 'arcade-cal-today' })).toBeUndefined()
  expect(await text('Сегодня · 02.11')).toBeDefined()
  expect(await text('Свободный день — запиши что-нибудь ниже.')).toBeDefined()
  // «Ближайшее» — карточками цвета события: название кнопкой, ниже когда и напоминание
  expect(await ui.find({ key: 'arcade-cal-ev-e1' })).toMatchObject({ props: { label: 'Ревью' } })
  expect(await ui.find({ key: 'cal-card-ev-e1' })).toMatchObject({ props: { borderColor: '#22A06B80' } })
  expect(await text('12.11 10:00 · 🔔 за 15 мин')).toBeDefined()

  // Выбранный день: его события; запись без дня ложится на него
  await ui.press({ key: 'arcade-cal-day-2026-11-12' })
  expect(await text('Четверг · 12.11')).toBeDefined()
  expect(await ui.find({ key: 'arcade-cal-dayev-e1' })).toMatchObject({ props: { label: 'Ревью' } })
  expect(await text('10:00 · 🔔 за 15 мин')).toBeDefined()
  expect((await ui.find({ key: 'cal-cell-2026-11-12' })).props.borderColor).toBe('suggestion')
  expect(await ui.find({ key: 'arcade-cal-day-2026-11-12' })).toMatchObject({ props: { plain: true, autoFocus: true } })
  expect(await ui.find({ key: 'arcade-cal-today' })).toBeDefined()
  await noteInput(ui, 'arcade-cal-add-', '16:00 Демо')
  const demo = (saved.get('calendar') as any[]).find((e) => e.title === 'Демо')
  expect(demo).toMatchObject({ day: '2026-11-12', time: '16:00' })
  expect(await ui.find({ key: `arcade-cal-dayev-${demo.id}` })).toMatchObject({ props: { label: 'Демо' } })
  expect(await dots('2026-11-12')).toEqual(['#22A06B', '#3B82F6'])
  // Запись с днём — экран переходит к нему
  await noteInput(ui, 'arcade-cal-add-', '03.12 Релиз')
  expect(await text('Декабрь 2026')).toBeDefined()
  expect(await text('Четверг · 03.12')).toBeDefined()
  expect(await ui.find({ key: 'arcade-cal-day-2026-12-03' })).toMatchObject({ props: { label: '3' } })
  expect((await ui.find({ key: 'cal-cell-2026-12-03' })).props.borderColor).toBe('suggestion')

  // Листать месяцы; «Сегодня» — назад к сегодняшнему дню
  await ui.press({ key: 'arcade-cal-prev' })
  expect(await text('Ноябрь 2026')).toBeDefined()
  expect(await ui.find({ key: 'arcade-cal-prev' })).toMatchObject({ props: { autoFocus: true } })
  await ui.press({ key: 'arcade-cal-prev' })
  expect(await text('Октябрь 2026')).toBeDefined()
  await ui.press({ key: 'arcade-cal-today' })
  expect(await text('Ноябрь 2026')).toBeDefined()
  expect(await ui.find({ key: 'arcade-cal-day-2026-11-02' })).toMatchObject({ props: { autoFocus: true } })
  expect((await ui.find({ key: 'cal-cell-2026-11-02' })).props.borderColor).toBe('suggestion')
  expect(await ui.find({ key: 'arcade-cal-today' })).toBeUndefined()
  // День соседнего месяца — открывает его месяц
  await ui.press({ key: 'arcade-cal-day-2026-10-26' })
  expect(await text('Октябрь 2026')).toBeDefined()
  await ui.unmount()
})

test('календарь в узкой панели Desktop: месяц списком дней вместо сетки', async ($, on) => {
  const { clock } = stubs(on, {
    stored: {
      calendar: [
        { id: 'e1', title: 'Ревью', day: '2026-11-12', time: '10:00', remind: 15, at: 0, color: 'green' },
        { id: 'e2', title: 'Отпуск', day: '2026-11-20', remind: null, at: 0 },
      ],
    },
  })
  await clock.advance(T0)
  await start($)
  await clock.advance(200)
  // На границе — ещё сетка
  const wide = await $.ui.mount({ ...PANE, surface: 'desktop', viewport: { columns: 44, rows: 40 } })
  await wide.press({ key: 'arcade-menu-calendar' })
  expect(await wide.find({ key: 'cal-grid' })).toBeDefined()
  expect(await wide.find({ key: 'cal-list' })).toBeUndefined()
  await wide.unmount()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', viewport: { columns: 43, rows: 40 } })
  const text = (t: string) => ui.find({ type: 'Text', text: t })
  expect(await ui.find({ key: 'cal-grid' })).toBeUndefined()
  // В списке — сегодняшний день (он же выбранный) и дни с событиями; день — кнопкой, под ним его события
  const days = async () => ((await ui.find({ key: 'cal-list' })).children ?? []).map((c: any) => c.props.key)
  expect(await days()).toEqual(['cal-list-2026-11-02', 'cal-list-2026-11-12', 'cal-list-2026-11-20'])
  expect(await ui.find({ key: 'arcade-cal-day-2026-11-02' })).toMatchObject({ props: { label: 'Сегодня · 02.11', variant: 'primary' } })
  expect(await text('Свободный день — запиши что-нибудь ниже.')).toBeDefined()
  expect(await ui.find({ key: 'arcade-cal-day-2026-11-12' })).toMatchObject({ props: { label: 'Четверг · 12.11' } })
  expect(await ui.find({ key: 'arcade-cal-dayev-e1' })).toMatchObject({ props: { label: 'Ревью' } })
  expect(await ui.find({ key: 'arcade-cal-dayev-e2' })).toMatchObject({ props: { label: 'Отпуск' } })
  expect(await ui.find({ key: 'arcade-cal-day-2026-11-05' })).toBeUndefined()
  // Выбрать день — он в рамке выбора; запись без дня ложится на него
  await ui.press({ key: 'arcade-cal-day-2026-11-12' })
  expect(await ui.find({ key: 'arcade-cal-day-2026-11-12' })).toMatchObject({ props: { variant: 'primary', autoFocus: true } })
  expect((await ui.find({ key: 'arcade-cal-day-2026-11-02' })).props.variant).toBeUndefined()
  // Месяц без событий, сегодняшнего и выбранного дня
  await ui.press({ key: 'arcade-cal-prev' })
  expect(await text('Октябрь 2026')).toBeDefined()
  expect(await text('В этом месяце событий нет.')).toBeDefined()
  await ui.unmount()
})

test('календарь: напоминания — тостом и системным уведомлением, пропущенные — при запуске', HEAVY, async ($, on) => {
  const { clock, saved, toasts, notifies } = stubs(on, {
    env: WINDOWS,
    stored: {
      calendar: [
        { id: 'e1', title: 'Созвон', day: '2026-11-02', time: '12:02', remind: 1, at: 0 },
        { id: 'e2', title: 'Стендап', day: '2026-11-02', time: '10:00', remind: 15, at: 0 },
        { id: 'e3', title: 'Старое', day: '2026-10-20', remind: 0, at: 0 },
      ],
    },
  })
  await clock.advance(T0)
  await start($)
  const shown = () => toasts.filter((t) => t.startsWith('Календарь'))
  const sent = () => notifies.filter((n) => n.env.ARCADE_TITLE === 'Календарь Arcade').map((n) => n.env.ARCADE_TEXT)
  // Чуть погодя после старта — пропущенное; давнее — отмечено молча
  await clock.advance(6_000)
  expect(shown()).toEqual(['Календарь: Пропущено: Стендап — сегодня 10:00'])
  expect(sent()).toEqual(['Пропущено: Стендап — сегодня 10:00'])
  expect(notifies.find((n) => n.env.ARCADE_TITLE === 'Календарь Arcade').argv[0]).toBe('powershell.exe')
  const events = () => saved.get('calendar') as any[]
  expect(events().find((e) => e.id === 'e3')).toMatchObject({ alerted: at('2026-10-20', '09:00') })
  expect(events().find((e) => e.id === 'e3').alertedBy).toBeUndefined()
  expect(events().find((e) => e.id === 'e2')).toMatchObject({ alerted: at('2026-11-02', '09:45') })
  // В своё время — без «Пропущено»; дважды одно и то же не показывается
  await clock.advance(60_000)
  expect(shown()).toEqual(['Календарь: Пропущено: Стендап — сегодня 10:00', 'Календарь: Созвон — сегодня 12:02'])
  expect(sent()).toEqual(['Пропущено: Стендап — сегодня 10:00', 'Созвон — сегодня 12:02'])
  await clock.advance(11 * 60_000)
  expect(shown().length).toBe(2)
})

test('календарь: напоминание показывает одна сессия из всех открытых', HEAVY, async ($, on) => {
  const { clock, saved, toasts } = stubs(on, { env: WINDOWS, stored: { calendar: [{ id: 'e2', title: 'Стендап', day: '2026-11-02', time: '11:50', remind: 15, at: 0 }] } })
  await clock.advance(T0)
  await start($)
  // Таймер сработал — сессия пометила напоминание своей отметкой; пока она ждёт, другая сессия пометила его своей
  await clock.advance(5_200)
  const mine = (saved.get('calendar') as any[])[0]
  expect(mine.alertedBy).toMatch(/^s[a-z0-9]+$/)
  saved.set('calendar', [{ ...mine, alertedBy: 'sother' }])
  await clock.advance(1_000)
  expect(toasts.filter((t) => t.startsWith('Календарь'))).toEqual([])
})

test('календарь в Desktop: повтор — в быстрой записи и выбором в событии, серия на каждом своём дне', async ($, on) => {
  const { clock, saved } = stubs(on)
  await clock.advance(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-calendar' })
  const text = (t: string) => ui.find({ type: 'Text', text: t })
  const events = () => saved.get('calendar') as any[]
  const hasDot = async (day: string) => JSON.stringify(await ui.find({ key: `cal-cell-${day}` })).includes('●')

  await noteInput(ui, 'arcade-cal-add-', 'каждый будний день 9:30 стендап')
  const id = events()[0].id
  expect(events()[0]).toMatchObject({ title: 'стендап', day: '2026-11-02', time: '09:30', repeat: 'weekdays' })
  // В сетке — на каждом будне, в выходные — нет
  expect(await Promise.all(['2026-11-02', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-30'].map(hasDot))).toEqual([true, true, false, false, true])
  expect(await ui.find({ key: `arcade-cal-dayev-${id}-2026-11-02` })).toMatchObject({ props: { label: 'стендап' } })
  expect(await text('09:30 · 🔁 По будням · 🔔 за 15 мин')).toBeDefined()
  // «Ближайшее» — серия один раз, ближайшим разом
  expect(await ui.find({ key: `arcade-cal-ev-${id}-2026-11-02` })).toBeDefined()
  expect(await ui.find({ key: `arcade-cal-ev-${id}-2026-11-03` })).toBeUndefined()
  expect(await text('Сегодня 09:30 · 🔁 По будням · 🔔 за 15 мин')).toBeDefined()

  // Раз серии открывает всю серию: повтор — выбором из списка
  await ui.press({ key: 'arcade-cal-day-2026-11-05' })
  await ui.press({ key: `arcade-cal-dayev-${id}-2026-11-05` })
  expect(await text('🔁 По будням, 09:30 · первый раз сегодня · 🔔 за 15 мин')).toBeDefined()
  expect(await text('  У повторяющегося события здесь — день первого раза.')).toBeDefined()
  const repeat = () => ui.find({ key: 'arcade-cal-repeat' })
  expect(await repeat()).toMatchObject({ props: { label: 'Повтор', value: 'weekdays' } })
  expect((await repeat()).props.options.map((o: any) => o.label)).toEqual(['Не повторять', 'Каждый день', 'По будням', 'Каждую неделю', 'Каждый месяц', 'Каждый год'])
  await ui.select({ key: 'arcade-cal-repeat', value: 'weekly' })
  expect(events()[0].repeat).toBe('weekly')
  expect(await repeat()).toMatchObject({ props: { value: 'weekly', autoFocus: true } })
  expect(await text('🔁 Каждую неделю, 09:30 · первый раз сегодня · 🔔 за 15 мин')).toBeDefined()
  await ui.select({ key: 'arcade-cal-repeat', value: 'none' })
  expect('repeat' in events()[0]).toBe(false)
  expect(await text('Сегодня 09:30 · 🔔 за 15 мин')).toBeDefined()
  expect(await text('  У повторяющегося события здесь — день первого раза.')).toBeUndefined()
  // «Когда» понимает повтор; серия с воскресенья — с понедельника
  await noteInput(ui, 'arcade-cal-when-', 'по будням 10:00')
  expect(events()[0]).toMatchObject({ day: '2026-11-02', time: '10:00', repeat: 'weekdays' })
  await noteInput(ui, 'arcade-cal-when-', '2026-11-01 11:00')
  expect(events()[0]).toMatchObject({ day: '2026-11-02', time: '11:00', repeat: 'weekdays' })
  expect(await ui.find({ key: await noteKey(ui, 'arcade-cal-when-') })).toMatchObject({ props: { value: '2026-11-02 11:00' } })
  // Назад — фокус на том же разе серии
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: `arcade-cal-dayev-${id}-2026-11-05` })).toMatchObject({ props: { autoFocus: true } })
  await ui.unmount()

  // В терминале серия помечена 🔁
  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await term.find({ key: `arcade-cal-ev-${id}-2026-11-02` })).toMatchObject({ props: { label: 'Сегодня 11:00 · стендап 🔁' } })
  await term.unmount()
})

test('календарь: серия с прошлой недели напоминает сегодняшним разом', HEAVY, async ($, on) => {
  const { clock, saved, toasts } = stubs(on, { env: WINDOWS, stored: { calendar: [{ id: 'e1', title: 'Стендап', day: '2026-10-26', time: '12:02', remind: 1, at: 0, repeat: 'weekdays' }] } })
  await clock.advance(T0)
  await start($)
  const shown = () => toasts.filter((t) => t.startsWith('Календарь'))
  await clock.advance(66_000)
  expect(shown()).toEqual(['Календарь: Стендап — сегодня 12:02'])
  expect((saved.get('calendar') as any[])[0]).toMatchObject({ day: '2026-10-26', alerted: at('2026-11-02', '12:01') })
})

test('календарь по-английски: экраны без русского, названия событий — как есть', async ($, on) => {
  const { clock } = stubs(on, { env: { LANG: 'en_US.UTF-8' }, stored: { calendar: [{ id: 'e1', title: 'Review', day: '2026-11-12', time: '10:00', remind: 15, at: 0 }] } })
  await clock.advance(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const cyrillic = async () => (await drawnTexts(ui)).filter((x) => /[А-Яа-яЁё]/.test(x) && x !== '🌐 Русский')
  expect(await ui.find({ key: 'arcade-menu-calendar' })).toMatchObject({ props: { label: 'Calendar' } })
  await ui.press({ key: 'arcade-menu-calendar' })
  expect(await cyrillic()).toEqual([])
  expect(await ui.find({ type: 'Text', text: 'November 2026' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-cal-ev-e1' })).toMatchObject({ props: { label: 'Review' } })
  expect(await ui.find({ type: 'Text', text: '12.11 10:00 · 🔔 15 min before' })).toBeDefined()
  await ui.press({ key: 'arcade-cal-day-2026-11-12' })
  expect(await cyrillic()).toEqual([])
  expect(await ui.find({ type: 'Text', text: 'Thursday · 12.11' })).toBeDefined()
  await ui.press({ key: 'arcade-cal-dayev-e1' })
  expect(await cyrillic()).toEqual([])
  const remind: any = await ui.find({ key: 'arcade-cal-remind' })
  expect(remind).toMatchObject({ props: { label: 'Remind', value: '15' } })
  const labels = remind.props.options.map((o: any) => o.label)
  expect(labels.filter((x: string) => /[А-Яа-яЁё]/.test(x))).toEqual([])
  expect([labels[0], labels[3], labels[5], labels[9], labels[10]]).toEqual(['at the start', '15 min before', '1 hour before', '1 week before', 'no reminder'])
  expect(await ui.find({ key: 'arcade-cal-color-red' })).toMatchObject({ props: { label: 'red' } })
  await noteInput(ui, 'arcade-cal-remind-own-', 'someday')
  expect(await cyrillic()).toEqual([])
  expect(await ui.find({ type: 'Text', text: "Couldn't tell when to remind: write it like “45 min before”, “at 14:30” or “the day before at 20:00” — no later than the start and no earlier than a week before." })).toBeDefined()
  await noteInput(ui, 'arcade-cal-remind-own-', 'the day before at 20:00')
  expect(await ui.find({ key: 'arcade-cal-remind' })).toMatchObject({ props: { value: '840' } })
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-cal-delete' })
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-cal-delete-yes' })
  expect(await cyrillic()).toEqual([])
  expect(await ui.find({ type: 'Text', text: 'Event deleted.' })).toBeDefined()
  await ui.unmount()
  // В терминале — тоже
  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await drawnTexts(term)).filter((x) => /[А-Яа-яЁё]/.test(x) && x !== '🌐 Русский')).toEqual([])
  expect(await term.find({ type: 'Text', text: 'The calendar is empty — add the first event.' })).toBeDefined()
  await term.unmount()
})
