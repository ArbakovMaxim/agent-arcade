// Уведомления на телефон (п. 39): ответы сайта, кого звать и каким текстом, экран подключения по коду, отправка из
// «Агентов» — только имя сессии, не чаще раза в 5 минут, одна сессия на компьютере. Отдельный файл — у каждого файла
// тестов свой предел времени
import { expect } from 'claude-code/testing'
import { SITE } from '../hooks/catalog.js'
import { tr } from '../hooks/i18n.js'
import { accountUrl, parsePushCode, parsePushSend, parsePushState } from '../hooks/account.js'
import { PHONE_POLL_MS, PHONE_TEXT_MAX, PHONE_WAIT_MS, phoneDue, phoneName, phoneQueues, phoneText, queueKey, queueTold } from '../hooks/phone.js'
import { ALERT_KEEP_MS } from '../hooks/alerts.js'
import { isBoard } from '../hooks/notes.js'
import { CLAIM_MS } from '../hooks/register.js'
import { NOTES_TOOL_NAME } from '../hooks/app/state.js'
import { HEAVY, PANE, WINDOWS, drawnTexts, start, stubs, test } from './kit.ts'

const TOKEN = `583231.${'a'.repeat(43)}`
const OCTO = { id: '583231', login: 'octocat' }
const SIGNED = { account: { token: TOKEN, user: OCTO } }
const ch = (n: number) => String.fromCharCode(n)
const sent = (requests: any[], path: string, method: string) => requests.filter((r) => r.path === path && r.method === method)

// Сайт Arcade с аккаунтом и телефонами: st — сколько телефонов и когда подключили последний. answers — свои ответы по
// «МЕТОД путь»: ответ или функция запроса; undefined — ответ по умолчанию
function phoneSite(answers: Record<string, any> = {}) {
  const st = { phones: 0, last: 0 }
  const api = (path: string, request: any) => {
    const special = answers[`${request.method} ${path}`]
    const own = typeof special === 'function' ? special(request) : special
    if (own !== undefined) return own
    if (path === 'api/me') return { json: { user: OCTO, settings: {} } }
    if (path === 'api/me/settings') return { json: { settings: request.body?.settings ?? {} } }
    if (path === 'api/me/push' && request.method === 'GET') return { json: { ...st } }
    if (path === 'api/me/push' && request.method === 'DELETE') {
      st.phones = 0
      st.last = 0
      return { json: { ok: true } }
    }
    if (path === 'api/me/push/code') return { json: { code: 'ABCD-EFGH', url: `${SITE}/push`, expires: 600 } }
    if (path === 'api/me/push/send') return { json: { ok: true, delivered: st.phones, phones: st.phones } }
    return undefined
  }
  return { api, st }
}

test('account.js: ответы сайта про телефон — код, сколько телефонов, отправка', () => {
  const reply = (status: number, data: any) => ({ status, ok: status < 400, headers: {}, text: typeof data === 'string' ? data : JSON.stringify(data) })
  expect(accountUrl('pushcode')).toBe(`${SITE}/api/me/push/code`)
  expect(accountUrl('push')).toBe(`${SITE}/api/me/push`)
  expect(accountUrl('pushsend')).toBe(`${SITE}/api/me/push/send`)
  // Код: 8 знаков через дефис; срок — целые секунды, не больше часа, без срока — 10 минут
  expect(parsePushCode(reply(200, { code: 'ABCD-EFGH', url: `${SITE}/push`, expires: 600 }))).toEqual({ code: 'ABCD-EFGH', expires: 600, error: '' })
  expect(parsePushCode(reply(200, { code: 'K2M9-XY7Z' }))).toEqual({ code: 'K2M9-XY7Z', expires: 600, error: '' })
  expect(parsePushCode(reply(200, { code: 'ABCD-EFGH', expires: 99_999 }))).toMatchObject({ expires: 3600 })
  expect(parsePushCode(reply(200, { code: 'ABCD-EFGH', expires: 1.5 }))).toMatchObject({ expires: 600 })
  // Похожие знаки (0, O, 1, I), строчные, без дефиса, длиннее — не код
  for (const code of ['ABCD-EFG0', 'OBCD-EFGH', 'ABCD-EFG1', 'IBCD-EFGH', 'abcd-efgh', 'ABCDEFGH', 'ABCD-EFGHJ', 42])
    expect(parsePushCode(reply(200, { code, expires: 600 }))).toEqual({ code: '', expires: 0, error: 'down' })
  expect(parsePushCode(reply(429, { error: 'often' }))).toEqual({ code: '', expires: 0, error: 'often' })
  expect(parsePushCode(reply(429, { error: 'limit' }))).toMatchObject({ code: '', error: 'limit' })
  expect(parsePushCode(reply(401, { error: 'auth' }))).toMatchObject({ code: '', error: 'auth' })
  expect(parsePushCode(reply(502, 'bad gateway'))).toMatchObject({ code: '', error: 'down' })
  expect(parsePushCode(null)).toMatchObject({ code: '', error: 'down' })
  // Сколько телефонов и когда подключили последний; ответ «выключить все» — телефонов 0
  expect(parsePushState(reply(200, { phones: 2, last: 1_790_000_000_000 }))).toEqual({ phones: 2, last: 1_790_000_000_000, error: '' })
  expect(parsePushState(reply(200, { phones: -1, last: 'вчера' }))).toEqual({ phones: 0, last: 0, error: '' })
  expect(parsePushState(reply(200, { ok: true }))).toEqual({ phones: 0, last: 0, error: '' })
  expect(parsePushState(reply(401, { error: 'auth' }))).toEqual({ phones: 0, last: 0, error: 'auth' })
  expect(parsePushState(null)).toEqual({ phones: 0, last: 0, error: 'down' })
  // Отправка: сколько приняли и сколько телефонов осталось
  expect(parsePushSend(reply(200, { ok: true, delivered: 1, phones: 2 }))).toEqual({ delivered: 1, phones: 2, error: '' })
  expect(parsePushSend(reply(200, { ok: true, delivered: 0, phones: 0 }))).toEqual({ delivered: 0, phones: 0, error: '' })
  expect(parsePushSend(reply(400, { error: 'text' }))).toEqual({ delivered: 0, phones: 0, error: 'invalid' })
  expect(parsePushSend(reply(404, { error: 'nophone' }))).toMatchObject({ error: 'nophone' })
  expect(parsePushSend(reply(404, 'not found'))).toMatchObject({ error: 'down' })
  expect(parsePushSend(reply(429, { error: 'often' }))).toMatchObject({ error: 'often' })
  expect(parsePushSend(reply(429, { error: 'limit' }))).toMatchObject({ error: 'limit' })
  expect(parsePushSend(reply(401, {}))).toMatchObject({ error: 'auth' })
  expect(parsePushSend(null)).toMatchObject({ error: 'down' })
})

test('phone.js: кого звать — ждёт разрешения дольше 2 минут и не скрыт; имя сессии и текст уведомления', () => {
  const now = 1_000_000
  const rows = [
    { sid: 'a', name: 'api', status: 'permission', since: now - PHONE_WAIT_MS },
    { sid: 'b', name: 'docs', status: 'permission', since: now - PHONE_WAIT_MS + 1 },
    { sid: 'c', name: 'site', status: 'working', since: 0 },
    { sid: 'd', name: 'web', status: 'permission', since: 0 },
    { sid: 'e', name: 'x', status: 'permission' },
    null,
  ]
  expect(phoneDue(rows, now).map((r: any) => r.sid)).toEqual(['a', 'd'])
  expect(phoneDue(rows, now, ['d']).map((r: any) => r.sid)).toEqual(['a'])
  expect(phoneDue(undefined, now)).toEqual([])
  // Имя: без управляющих символов, разделителей строк и знаков направления; в одну строку; не длиннее 40 знаков
  expect(phoneName('api')).toBe('api')
  expect(phoneName(`  a${ch(7)}b${ch(0x2028)}c${ch(0x202e)}d${ch(10)}${ch(9)}e${ch(0x2066)}  `)).toBe('a b c d e')
  expect(phoneName('')).toBe('Claude Code')
  expect(phoneName(`${ch(0x202e)}${ch(1)} `)).toBe('Claude Code')
  expect(phoneName(undefined)).toBe('Claude Code')
  expect(phoneName('я'.repeat(50))).toBe(`${'я'.repeat(39)}…`)
  // Режет по знакам, а не по половинкам суррогатных пар
  const smile = String.fromCodePoint(0x1f600)
  expect(Array.from(phoneName(smile.repeat(45)))).toEqual([...Array(39).fill(smile), '…'])
  // Текст: одна сессия — по имени, несколько — списком без повторов
  expect(phoneText(['docs'])).toBe('Сессия «docs» ждёт тебя')
  expect(phoneText([])).toBe('Сессия «Claude Code» ждёт тебя')
  expect(phoneText(['api', ' api ', 'docs'])).toBe('Ждут тебя сессии: api, docs')
  const en = (s: string) => tr(s, 'en')
  expect(phoneText(['docs'], en)).toBe('Session “docs” is waiting for you')
  expect(phoneText(['api', 'docs'], en)).toBe('Sessions waiting for you: api, docs')
  // Не влезает в 140 знаков — сколько влезло и «+N»
  const many = Array.from({ length: 8 }, (_, i) => `${'s'.repeat(30)}${i}`)
  const text = phoneText(many)
  expect(Array.from(text).length).toBeLessThanOrEqual(PHONE_TEXT_MAX)
  expect(text).toBe(`Ждут тебя сессии: ${many.slice(0, 3).join(', ')} +5`)
})

test('phone.js: конец очереди — после 2 минут тишины, не старше часа; одна строка на доску, «остановилась» важнее; текст — название доски, число карточек или причина из списка', () => {
  const now = 10_000_000
  const at = now - PHONE_WAIT_MS
  const end = (more: any = {}) => ({ board: 'b1', title: 'Sprint', kind: 'done', at, n: 0, why: '', until: 0, ...more })
  const row = (sid: string, qend: any, more: any = {}) => ({ sid, name: sid, status: 'done', since: at, qend, ...more })
  // Ровно 2 минуты после конца — пора; раньше, скрытая сессия, работает или ждёт — нет
  expect(phoneQueues([row('a', end()), null], now)).toEqual([end()])
  expect(phoneQueues([row('a', end({ kind: 'stop' }), { status: 'idle' })], now)).toEqual([end({ kind: 'stop' })])
  expect(phoneQueues([row('a', end())], now - 1)).toEqual([])
  expect(phoneQueues([row('a', end())], now, ['a'])).toEqual([])
  for (const status of ['working', 'permission', 'background']) expect(phoneQueues([row('a', end(), { status })], now)).toEqual([])
  expect(phoneQueues(undefined, now)).toEqual([])
  // 2 минуты — от позднего из конца очереди и смены статуса; старше часа — уже не сообщаем
  expect(phoneQueues([row('a', end(), { since: at + 1 })], now)).toEqual([])
  expect(phoneQueues([row('a', end({ at: now - ALERT_KEEP_MS }), { since: 0 })], now)).toEqual([])
  expect(phoneQueues([row('a', end({ at: now - ALERT_KEEP_MS + 1 }), { since: 0 })], now)).toHaveLength(1)
  // Чужие отметки — сырой JSON: странное мимо; название не строка — пустое, длинное — обрезано
  for (const qend of [null, 'b1', [], end({ kind: 'x' }), end({ at: 0 }), end({ at: Number.NaN }), end({ board: '' }), end({ board: 7 }), end({ board: 'b'.repeat(201) })])
    expect(phoneQueues([row('a', qend)], now)).toEqual([])
  expect(phoneQueues([row('a', end({ board: 'b'.repeat(200), title: 42 }))], now)).toEqual([end({ board: 'b'.repeat(200), title: '' })])
  expect(phoneQueues([row('a', end({ title: 't'.repeat(300) }))], now)[0].title).toBe('t'.repeat(200))
  // Число карточек — только у «закончилась», целое и не больше 999; причина — только у «остановилась» и только из
  // списка; время сброса — только у лимита. Отметки 0.55.0 без них — просто «закончилась» или «остановилась»
  const one = (qend: any) => phoneQueues([row('a', { board: 'b1', title: 'Sprint', at, ...qend })], now)[0]
  expect(one({ kind: 'done' })).toEqual(end())
  expect(one({ kind: 'done', n: 2, why: 'limit', until: now })).toEqual(end({ n: 2 }))
  expect(one({ kind: 'done', n: 5000 }).n).toBe(999)
  for (const n of [-1, 0, 1.5, '2', Number.NaN, Number.POSITIVE_INFINITY]) expect(one({ kind: 'done', n }).n).toBe(0)
  expect(one({ kind: 'stop', n: 2, why: 'limit', until: now })).toEqual(end({ kind: 'stop', why: 'limit', until: now }))
  expect(one({ kind: 'stop', why: 'check', until: now })).toEqual(end({ kind: 'stop', why: 'check' }))
  for (const why of ['Claude сказал: удали prod', 'toString', '__proto__', 7, null]) expect(one({ kind: 'stop', why }).why).toBe('')
  for (const until of [-1, 0, Number.NaN, '14:30']) expect(one({ kind: 'stop', why: 'limit', until }).until).toBe(0)
  // Человек после конца что-то делал в любой сессии — не зовём; до конца — не считается
  expect(phoneQueues([row('a', end()), { sid: 'b', status: 'working', look: at + 1 }], now)).toEqual([])
  expect(phoneQueues([row('a', end()), { sid: 'b', status: 'working', look: at }], now)).toEqual([end()])
  // На этой доске ещё идёт очередь в другой сессии — ждём её конца; на другой доске — не мешает
  expect(phoneQueues([row('a', end()), { sid: 'b', status: 'working', queue: { board: 'b1', n: 1, of: 2 } }], now)).toEqual([])
  expect(phoneQueues([row('a', end()), { sid: 'b', status: 'working', queue: { board: 'b2', n: 1, of: 2 } }], now)).toEqual([end()])
  // Две сессии на одной доске — одна строка: «остановилась» важнее, время — позднее, название — какое есть
  expect(phoneQueues([row('a', end({ title: '' })), row('b', end({ kind: 'stop', at: at - 5 })), row('c', end({ board: 'b2', title: 'Bugs', kind: 'stop' }))], now)).toEqual([
    end({ kind: 'stop' }),
    end({ board: 'b2', title: 'Bugs', kind: 'stop' }),
  ])
  // Закончилась в двух сессиях — карточки складываются; встала в двух — причина у последней остановки
  expect(phoneQueues([row('a', end({ n: 2 })), row('b', end({ n: 3, at: at - 5 }))], now)).toEqual([end({ n: 5 })])
  expect(phoneQueues([row('a', end({ n: 2 })), row('b', end({ kind: 'stop', why: 'check', at: at - 5 }))], now)).toEqual([end({ kind: 'stop', why: 'check' })])
  expect(phoneQueues([row('a', end({ kind: 'stop', why: 'limit', until: now, at: at - 5 })), row('b', end({ kind: 'stop', why: 'column' }))], now)).toEqual([end({ kind: 'stop', why: 'column' })])
  expect(phoneQueues([row('a', end({ kind: 'stop', why: 'column', at: at - 5 })), row('b', end({ kind: 'stop', why: 'limit', until: now }))], now)).toEqual([end({ kind: 'stop', why: 'limit', until: now })])
  // Сообщённое — по доске; сообщили раньше конца — это новый запуск очереди, о нём сообщить снова
  expect(queueKey(end())).toBe('queue|b1')
  expect(queueTold(undefined, end())).toBe(false)
  expect(queueTold(at - 1, end())).toBe(false)
  expect(queueTold(at, end())).toBe(true)
  expect(queueTold(at + 60_000, end())).toBe(true)

  // Текст: только название доски и что случилось; вместе с ждущими сессиями — через точку
  expect(phoneText([], undefined, [{ title: 'Sprint', kind: 'done' }])).toBe('Очередь на доске «Sprint» закончилась')
  expect(phoneText(['api'], undefined, [{ title: 'Sprint', kind: 'stop' }])).toBe('Сессия «api» ждёт тебя. Очередь на доске «Sprint» остановилась')
  expect(phoneText([], undefined, [{ title: ` Sp${ch(10)}r${ch(0x202e)}int `, kind: 'done' }, { title: '', kind: 'stop' }])).toBe(
    'Очередь на доске «Sp r int» закончилась. Очередь на доске «без названия» остановилась',
  )
  const en = (s: string) => tr(s, 'en')
  expect(phoneText([], en, [{ title: 'Sprint', kind: 'done' }, { title: '', kind: 'stop' }])).toBe('Queue on board “Sprint” finished. Queue on board “untitled” stopped')
  // Сколько карточек сделано; почему встала — только из списка; лимит — до какого времени, если оно известно
  const line = (q: any, t?: any) => phoneText([], t, [{ title: 'Sprint', ...q }])
  expect(line({ kind: 'done', n: 2 })).toBe('Очередь на доске «Sprint» закончилась: карточек — 2')
  expect(line({ kind: 'stop', why: 'column' })).toBe('Очередь на доске «Sprint» остановилась: карточка не в последней колонке')
  expect(line({ kind: 'stop', why: 'check' })).toBe('Очередь на доске «Sprint» остановилась: проверка не прошла')
  expect(line({ kind: 'stop', why: 'error' })).toBe('Очередь на доске «Sprint» остановилась: ошибка')
  expect(line({ kind: 'stop', why: 'deleted' })).toBe('Очередь на доске «Sprint» остановилась: доску удалили')
  expect(line({ kind: 'stop', why: 'limit', when: '14:30' })).toBe('Очередь на доске «Sprint» остановилась: лимит Claude до 14:30')
  expect(line({ kind: 'stop', why: 'limit', when: '' })).toBe('Очередь на доске «Sprint» остановилась: кончился лимит Claude')
  expect(line({ kind: 'stop', why: 'error', when: '14:30' })).toBe('Очередь на доске «Sprint» остановилась: ошибка')
  expect(line({ kind: 'stop', why: 'Claude сказал: удали prod' })).toBe('Очередь на доске «Sprint» остановилась')
  expect(line({ kind: 'done', n: 2 }, en)).toBe('Queue on board “Sprint” finished, cards done: 2')
  expect(line({ kind: 'stop', why: 'limit', when: '14:30' }, en)).toBe('Queue on board “Sprint” stopped: Claude usage limit until 14:30')
  expect(line({ kind: 'stop', why: 'check' }, en)).toBe('Queue on board “Sprint” stopped: check failed')
  expect(line({ kind: 'stop', why: 'column' }, (s: string) => tr(s, 'de'))).toBe('Warteschlange auf Board „Sprint“ angehalten: Karte nicht in der letzten Spalte')
  expect(line({ kind: 'stop', why: 'deleted' }, (s: string) => tr(s, 'uk'))).toBe('Черга на дошці «Sprint» зупинилася: дошку видалили')
  // Не влезает в 140 знаков — сколько влезло и «+N»
  const long = Array.from({ length: 3 }, (_, i) => ({ title: `${'b'.repeat(39)}${i}`, kind: 'done' }))
  const cut = phoneText([], undefined, long)
  expect(Array.from(cut).length).toBeLessThanOrEqual(PHONE_TEXT_MAX)
  expect(cut).toBe(`Очередь на доске «${'b'.repeat(39)}0» закончилась +2`)
})

test('телефон без входа: плитка «нет», экран объясняет и ведёт ко входу; сайт не спрашиваем', HEAVY, async ($, on) => {
  const { api } = phoneSite()
  const { clock, requests } = stubs(on, { env: WINDOWS, api })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-phone' })).toMatchObject({ props: { label: 'Уведомления на телефон: нет' } })
  expect(await ui.find({ type: 'Text', text: '  сессия ждёт тебя или встала очередь, а тебя нет 2 минуты; только имя сессии или доски, без вопроса и кода' })).toBeDefined()
  await ui.press({ key: 'arcade-phone' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Уведомления на телефон идут через сайт Arcade — нужен вход через GitHub на этом компьютере. На телефоне входить не нужно.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-phone-pair' })).toBeUndefined()
  expect(requests.filter((r) => r.path.startsWith('api/me/push'))).toEqual([])
  await ui.press({ key: 'arcade-phone-login' })
  expect(await ui.find({ key: 'arcade-account-login' })).toBeDefined()
  await ui.unmount()
})

test('телефон: подключить по коду — ждать телефон, подключился — включено; отправлять отсюда; выключить на всех; часто, истёк, отмена', HEAVY, async ($, on) => {
  let codeAnswer: any
  const { api, st } = phoneSite({ 'POST api/me/push/code': () => codeAnswer })
  const { clock, requests, saved } = stubs(on, { env: WINDOWS, api, stored: SIGNED })
  const gets = () => sent(requests, 'api/me/push', 'GET').length
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-phone' })).toMatchObject({ props: { label: 'Уведомления на телефон: нет' } })
  // По умолчанию выключено и сайт не спрашиваем, пока экран не открыт
  expect(gets()).toBe(0)
  expect(saved.has('phonePush')).toBe(false)
  await ui.press({ key: 'arcade-phone' })
  await clock.settle()
  expect(sent(requests, 'api/me/push', 'GET').map((r) => r.headers.Authorization)).toEqual([`Bearer ${TOKEN}`])
  expect(await ui.find({ type: 'Text', text: 'Телефон ещё не подключён.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-phone-on' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-phone-off' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-phone-pair' })).toMatchObject({ props: { label: 'Подключить телефон' } })

  // Код: адрес страницы, код, до каких пор живёт; телефон ещё не ввёл — спрашиваем сайт раз в 3 с
  await ui.press({ key: 'arcade-phone-pair' })
  await clock.settle()
  expect(sent(requests, 'api/me/push/code', 'POST').map((r) => [r.headers.Authorization, r.body])).toEqual([[`Bearer ${TOKEN}`, undefined]])
  expect(await ui.find({ type: 'Text', text: 'На телефоне открой адрес и введи там код:' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: `  ${SITE}/push` })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  ABCD-EFGH' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ {2}код живёт до [0-9]{2}:[0-9]{2}$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Жду, когда телефон подключится…' })).toBeDefined()
  const before = gets()
  await clock.advance(PHONE_POLL_MS * 2)
  expect(gets()).toBe(before + 2)
  expect(await ui.find({ key: 'arcade-phone-cancel' })).toBeDefined()
  // Телефон ввёл код — подключено и включено на этом компьютере
  st.phones = 1
  st.last = 1_790_000_000_000
  await clock.advance(PHONE_POLL_MS)
  expect(await ui.find({ type: 'Text', text: 'Телефон подключён — уведомления пойдут на него.' })).toBeDefined()
  expect(saved.get('phonePush')).toBe(true)
  expect(await ui.find({ type: 'Text', text: 'Подключено телефонов: 1' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-phone-on' })).toMatchObject({ props: { label: 'Отправлять с этого компьютера: да' } })
  expect(await ui.find({ key: 'arcade-phone-pair' })).toMatchObject({ props: { label: 'Подключить ещё телефон' } })
  // Код больше не спрашиваем
  const after = gets()
  await clock.advance(PHONE_POLL_MS * 3)
  expect(gets()).toBe(after)

  // Отправлять с этого компьютера — нет, снова да; плитка в «Настройках» — так же
  await ui.press({ key: 'arcade-phone-on' })
  expect(saved.get('phonePush')).toBe(false)
  expect(await ui.find({ key: 'arcade-phone-on' })).toMatchObject({ props: { label: 'Отправлять с этого компьютера: нет' } })
  await ui.press({ key: 'arcade-back' })
  expect(await ui.find({ key: 'arcade-phone' })).toMatchObject({ props: { label: 'Уведомления на телефон: нет' } })
  await ui.press({ key: 'arcade-phone' })
  await ui.press({ key: 'arcade-phone-on' })
  expect(saved.get('phonePush')).toBe(true)

  // Выключить на всех телефонах: сайт забывает телефоны, здесь выключено
  await ui.press({ key: 'arcade-phone-off' })
  await clock.settle()
  expect(sent(requests, 'api/me/push', 'DELETE').map((r) => r.headers.Authorization)).toEqual([`Bearer ${TOKEN}`])
  expect(saved.get('phonePush')).toBe(false)
  expect(await ui.find({ type: 'Text', text: 'Уведомления выключены на всех телефонах.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Телефон ещё не подключён.' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-phone-on' })).toBeUndefined()

  // Кодов сегодня слишком много
  codeAnswer = { status: 429, json: { error: 'often' } }
  await ui.press({ key: 'arcade-phone-pair' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Кодов сегодня было слишком много — попробуй завтра.' })).toMatchObject({ props: { color: 'warning' } })
  expect(await ui.find({ key: 'arcade-phone-cancel' })).toBeUndefined()

  // Код истёк, а телефон так и не подключился — код убран
  codeAnswer = { json: { code: 'K2M9-XY7Z', expires: 30 } }
  await ui.press({ key: 'arcade-phone-pair' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: '  K2M9-XY7Z' })).toBeDefined()
  await clock.advance(33_000)
  expect(await ui.find({ type: 'Text', text: 'Код истёк — возьми новый.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  K2M9-XY7Z' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-phone-pair' })).toBeDefined()
  const expired = gets()
  await clock.advance(PHONE_POLL_MS * 3)
  expect(gets()).toBe(expired)

  // Отмена: код убран, сайт больше не спрашиваем
  codeAnswer = undefined
  await ui.press({ key: 'arcade-phone-pair' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: '  ABCD-EFGH' })).toBeDefined()
  await ui.press({ key: 'arcade-phone-cancel' })
  const cancelled = gets()
  await clock.advance(PHONE_POLL_MS * 3)
  expect(gets()).toBe(cancelled)
  expect(await ui.find({ type: 'Text', text: '  ABCD-EFGH' })).toBeUndefined()
  expect(saved.get('phonePush')).toBe(false)
  await ui.unmount()
})

test('телефон по-английски: плитка, экран и код без русских букв', HEAVY, async ($, on) => {
  const { api, st } = phoneSite()
  st.phones = 2
  st.last = 1_790_000_000_000
  const { clock } = stubs(on, { env: { ...WINDOWS, LANG: 'en_US.UTF-8' }, api, stored: SIGNED })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const cyrillic = async () => (await drawnTexts(ui)).filter((x) => /[А-Яа-яЁё]/.test(x) && x !== '🌐 Русский')
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-phone' })).toMatchObject({ props: { label: 'Phone notifications: off' } })
  await ui.press({ key: 'arcade-phone' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Phones connected: 2' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-phone-on' })).toMatchObject({ props: { label: 'Send from this computer: off' } })
  expect(await ui.find({ key: 'arcade-phone-pair' })).toMatchObject({ props: { label: 'Connect another phone' } })
  expect(await ui.find({ key: 'arcade-phone-off' })).toMatchObject({ props: { label: 'Turn off on all phones' } })
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-phone-pair' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'On your phone, open this address and enter the code there:' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ {2}the code is valid until [0-9]{2}:[0-9]{2}$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Waiting for the phone to connect…' })).toBeDefined()
  expect(await cyrillic()).toEqual([])
  await ui.press({ key: 'arcade-phone-cancel' })
  await ui.unmount()
})

// Другие сессии на этом компьютере: отметки «Агентов» лежат в домашней папке (место → отметка); обновляются, пока
// идёт время
const AG_ENV = { ...WINDOWS, USERPROFILE: 'C:\\Users\\max' }
const AG_DIR = 'C:\\Users\\max\\.claude\\arcade\\agents'
const AG_ME = { sid: 'sess-me', root: 'D:\\work\\web' }
const agentSlots = (disk: Map<string, any>) =>
  [...disk.entries()].flatMap(([k, v]) => {
    const m = /[\\/]agents[\\/]s([0-9]+)[.]json$/.exec(k)
    return m ? [{ slot: Number(m[1]), rec: JSON.parse(v) }] : []
  })
function rivals(putFile: any, clock: any, disk: Map<string, any>, list: Record<string, any>) {
  const put = (slot: number, rec: any) => {
    const mine = agentSlots(disk).find((x) => x.rec.sid === AG_ME.sid)?.slot
    putFile(`${AG_DIR}\\s${slot === mine ? 32 : slot}.json`, JSON.stringify({ v: 1, path: 'D:\\work\\api', since: 0, card: null, queue: null, claim: null, ...rec, at: clock.now() }))
  }
  const marks = () => {
    for (const r of Object.values(list)) put(r.slot, r)
  }
  return {
    marks,
    live: async (ms: number) => {
      for (let left = ms; left > 0; left -= 5_000) {
        marks()
        await clock.advance(Math.min(5_000, left))
      }
    },
    set: (name: string, status: string, more: any = {}) => {
      list[name] = { ...list[name], status, since: clock.now(), ...more }
    },
  }
}
const phoneList = () => ({
  api: { slot: 3, sid: 'sess-a', name: 'api', status: 'working' },
  docs: { slot: 9, sid: 'sess-b', name: 'docs', path: 'D:\\work\\docs', status: 'working' },
})

test('телефон: сессия ждёт дольше 2 минут — на телефон только имя, без вопроса; о ней — раз; следующая — не раньше чем через 5 минут', HEAVY, async ($, on) => {
  const { api, st } = phoneSite()
  st.phones = 1
  const { clock, requests, saved, disk, putFile } = stubs(on, { env: AG_ENV, agents: AG_ME, api, stored: { ...SIGNED, phonePush: true, agentsNotify: false } })
  const { marks, live, set } = rivals(putFile, clock, disk, phoneList())
  const sends = () => sent(requests, 'api/me/push/send', 'POST')
  marks()
  await start($)
  await live(10_000)
  // «docs» ждёт разрешения на команду — пока меньше 2 минут, телефону ничего
  set('docs', 'permission', { ask: { kind: 'permission', tool: 'Bash', what: 'npm test -- secret.spec.ts' } })
  await live(100_000)
  expect(sends()).toEqual([])
  await live(30_000)
  expect(sends().map((r) => [r.headers.Authorization, r.body])).toEqual([[`Bearer ${TOKEN}`, { text: 'Сессия «docs» ждёт тебя' }]])
  expect(JSON.stringify(sends())).not.toContain('npm')
  // Отправленное помнится для всех сессий этого компьютера
  const told = saved.get('phoneSent')
  expect(told).toMatchObject({ last: expect.any(Number) })
  expect(Object.keys(told.told).filter((k) => k.startsWith('sess-b|')).length).toBe(1)
  // «docs» ждёт дальше — второй раз не зовём
  await live(60_000)
  expect(sends().length).toBe(1)
  // «api» тоже ждёт: 2 минуты прошли, а 5 минут с прошлого уведомления — нет; потом — только о «api»
  set('api', 'permission')
  await live(130_000)
  expect(sends().length).toBe(1)
  await live(150_000)
  expect(sends().map((r) => r.body.text)).toEqual(['Сессия «docs» ждёт тебя', 'Сессия «api» ждёт тебя'])
  const gap = saved.get('phoneSent').last - told.last
  expect(gap).toBeGreaterThanOrEqual(5 * 60_000)
})

test('телефон: сайт молчит — через минуту ещё раз; «часто» — вернуть и ждать 5 минут; телефонов нет — выключить и сказать', HEAVY, async ($, on) => {
  let answer: any = null
  const { api, st } = phoneSite({ 'POST api/me/push/send': () => answer })
  st.phones = 1
  const { clock, requests, saved, toasts, disk, putFile } = stubs(on, { env: AG_ENV, agents: AG_ME, api, stored: { ...SIGNED, phonePush: true, agentsNotify: false } })
  const { marks, live, set } = rivals(putFile, clock, disk, phoneList())
  const sends = () => sent(requests, 'api/me/push/send', 'POST')
  const toldDocs = () => Object.keys(saved.get('phoneSent')?.told ?? {}).some((k) => k.startsWith('sess-b|'))
  marks()
  await start($)
  await live(10_000)
  set('docs', 'permission')
  // Сайт не ответил — «docs» не считается отправленной, через минуту ещё раз
  await live(130_000)
  expect(sends().length).toBe(1)
  expect(toldDocs()).toBe(false)
  answer = { status: 429, json: { error: 'often' } }
  await live(60_000)
  expect(sends().length).toBe(2)
  expect(toldDocs()).toBe(false)
  // «Часто» — 5 минут не пробуем
  answer = undefined
  await live(240_000)
  expect(sends().length).toBe(2)
  await live(70_000)
  expect(sends().map((r) => r.body.text)).toEqual(Array(3).fill('Сессия «docs» ждёт тебя'))
  expect(toldDocs()).toBe(true)
  expect(saved.get('phonePush')).toBe(true)
  // Телефонов у аккаунта больше нет — выключить здесь и сказать человеку; дальше не отправляем
  answer = { status: 404, json: { error: 'nophone' } }
  set('api', 'permission')
  await live(310_000)
  expect(sends().length).toBe(4)
  expect(saved.get('phonePush')).toBe(false)
  expect(toasts).toContain('Телефонов для уведомлений Arcade больше нет — подключи телефон заново в настройках Arcade.')
  set('docs', 'working')
  set('docs', 'permission')
  await live(200_000)
  expect(sends().length).toBe(4)
})

test('телефон: очередь другой сессии встала — через 2 минуты только название доски; пока на доске идёт очередь — ждём; две сессии — одно уведомление', HEAVY, async ($, on) => {
  const { api, st } = phoneSite()
  st.phones = 1
  const { clock, requests, saved, disk, putFile } = stubs(on, { env: AG_ENV, agents: AG_ME, api, stored: { ...SIGNED, phonePush: true, agentsNotify: false } })
  const { marks, live, set } = rivals(putFile, clock, disk, phoneList())
  const sends = () => sent(requests, 'api/me/push/send', 'POST')
  marks()
  await start($)
  await live(10_000)
  // «docs» встала на доске b1 с ошибкой, а «api» на той же доске ещё делает карточку — ждём
  set('api', 'working', { queue: { board: 'b1', n: 2, of: 3, started: clock.now() }, card: { id: 'c2', title: 'Секретная карточка', board: 'b1', boardTitle: 'Sprint' } })
  set('docs', 'done', { qend: { board: 'b1', title: 'Sprint', kind: 'stop', why: 'error', at: clock.now() } })
  await live(200_000)
  expect(sends()).toEqual([])
  // «api» прошла ту же очередь: доска свободна, а «docs» стоит дольше 2 минут — сразу одно уведомление о доске
  set('api', 'done', { queue: null, card: null, qend: { board: 'b1', title: 'Sprint', kind: 'done', n: 2, at: clock.now() } })
  await live(10_000)
  expect(sends().map((r) => [r.headers.Authorization, r.body])).toEqual([[`Bearer ${TOKEN}`, { text: 'Очередь на доске «Sprint» остановилась: ошибка' }]])
  expect(JSON.stringify(sends())).not.toContain('Секретная')
  expect(saved.get('phoneSent').told['queue|b1']).toEqual(expect.any(Number))
  // Конец в «api» — та же доска раньше уведомления: о нём уже сообщили, второй раз не зовём
  await live(400_000)
  expect(sends().length).toBe(1)
  // Очередь на доске запустили снова, и в обеих сессиях она кончилась — через 2 минуты одно новое уведомление
  set('api', 'done', { qend: { board: 'b1', title: 'Sprint', kind: 'done', n: 2, at: clock.now() } })
  set('docs', 'done', { qend: { board: 'b1', title: 'Sprint', kind: 'done', n: 1, at: clock.now() } })
  await live(100_000)
  expect(sends().length).toBe(1)
  await live(30_000)
  expect(sends().map((r) => r.body.text)).toEqual(['Очередь на доске «Sprint» остановилась: ошибка', 'Очередь на доске «Sprint» закончилась: карточек — 3'])
  await live(400_000)
  expect(sends().length).toBe(2)
  // Встала на лимите — время сброса на часах этого компьютера; время уже прошло — без него
  const hm = (ms: number) => [new Date(ms).getHours(), new Date(ms).getMinutes()].map((n) => String(n).padStart(2, '0')).join(':')
  const reset = clock.now() + 3 * 3_600_000
  set('docs', 'done', { qend: { board: 'b1', title: 'Sprint', kind: 'stop', why: 'limit', until: reset, at: clock.now() } })
  await live(400_000)
  expect(sends().map((r) => r.body.text).at(-1)).toBe(`Очередь на доске «Sprint» остановилась: лимит Claude до ${hm(reset)}`)
  set('docs', 'done', { qend: { board: 'b1', title: 'Sprint', kind: 'stop', why: 'limit', until: clock.now() - 1_000, at: clock.now() } })
  await live(400_000)
  expect(sends().map((r) => r.body.text).at(-1)).toBe('Очередь на доске «Sprint» остановилась: кончился лимит Claude')
  expect(sends().length).toBe(4)
})

test('телефон: своя очередь пройдена или встала, человека 2 минуты нет — название доски; прервал ход или нажал что-то в Arcade — молчим', HEAVY, async ($, on) => {
  const { api, st } = phoneSite()
  st.phones = 1
  const { clock, requests, saved, submits } = stubs(on, { env: AG_ENV, agents: AG_ME, submit: true, api, stored: { ...SIGNED, phonePush: true, agentsNotify: false } })
  const sends = () => sent(requests, 'api/me/push/send', 'POST')
  const wait = async (ms: number) => {
    for (let left = ms; left > 0; left -= 10_000) await clock.advance(Math.min(10_000, left))
  }
  await start($)
  await clock.advance(4_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = (t: any) => ui.find({ type: 'Text', text: t })
  const pages = () => saved.get('notes') as any[]
  const page = (title: string) => pages().find((p) => p.title === title)
  const board = () => pages().find(isBoard)
  const label = async () => (await ui.find({ key: 'arcade-board-queue' }))?.props.label
  const add = (title: string) => $.tool.call({ tool: NOTES_TOOL_NAME, action: 'create', title, parent: 'Sprint' })
  // Запустить очередь: Arcade заявляет карточку и выжидает CLAIM_MS
  const queue = async () => {
    const pressed = ui.press({ key: 'arcade-board-queue' })
    await clock.advance(CLAIM_MS + 100)
    await pressed
  }
  // Ход Claude по выданной карточке: 'done' — перенёс её в «Готово», 'left' — закончил, не перенеся, 'aborted' — прервали
  let turns = 0
  const turn = async (title: string, how: string) => {
    const turnId = `t${++turns}`
    await $.turn.start({ turnId, text: submits[submits.length - 1].text })
    if (how === 'done') await $.tool.call({ tool: NOTES_TOOL_NAME, action: 'move', page: page(title).id, column: 'done' })
    await $.turn.complete({ turnId, reason: how === 'aborted' ? 'aborted' : 'answer', answer: '' })
    await clock.advance(10)
  }
  await $.tool.call({ tool: NOTES_TOOL_NAME, action: 'create', title: 'Sprint', board: true })
  await add('Карточка про пароли')
  await ui.press({ key: 'arcade-menu-boards' })
  await ui.press({ key: `arcade-desk-${board().id}` })
  await queue()
  expect(submits.length).toBe(1)

  // Пройдена, и 2 минуты никто ничего не делал — на телефон название доски, без карточек
  await turn('Карточка про пароли', 'done')
  expect(await text('Очередь пройдена: в колонке «Сделать» карточек больше нет.')).toBeDefined()
  await wait(100_000)
  expect(sends()).toEqual([])
  await wait(30_000)
  expect(sends().map((r) => [r.headers.Authorization, r.body])).toEqual([[`Bearer ${TOKEN}`, { text: 'Очередь на доске «Sprint» закончилась: карточек — 1' }]])
  expect(JSON.stringify(sends())).not.toContain('пароли')
  await wait(60_000)
  expect(sends().length).toBe(1)

  // Человек прервал ход — очередь встала по его воле: не сообщаем
  await add('B')
  await queue()
  expect(submits.length).toBe(2)
  await turn('B', 'aborted')
  expect(await text('Очередь остановлена: ход Claude прервали.')).toBeDefined()
  await wait(400_000)
  expect(sends().length).toBe(1)

  // Claude закончил, не перенеся карточку, — очередь встала сама; но человек через минуту нажал что-то в Arcade — он здесь
  await add('C')
  await queue()
  expect(submits.length).toBe(3)
  await turn('C', 'left')
  expect(await text(/^Очередь стоит: Claude закончил ход, а карточка «C»/)).toBeDefined()
  await wait(60_000)
  await ui.press({ key: 'arcade-back' })
  await wait(200_000)
  expect(sends().length).toBe(1)

  // Снова встала, человека нет — «остановилась»
  await ui.press({ key: `arcade-desk-${board().id}` })
  await add('D')
  await queue()
  expect(submits.length).toBe(4)
  await turn('D', 'left')
  expect(await label()).toBe('Очередь для Claude')
  await wait(130_000)
  expect(sends().map((r) => r.body.text)).toEqual(['Очередь на доске «Sprint» закончилась: карточек — 1', 'Очередь на доске «Sprint» остановилась: карточка не в последней колонке'])

  // Пока Claude делал карточку, доску удалили не в Arcade этого компьютера (на сайте, в другом месте) — «доску удалили»,
  // название — сохранённое при запуске очереди
  await add('E')
  await queue()
  expect(submits.length).toBe(5)
  const gone = board().id
  await $.turn.start({ turnId: 'gone', text: submits[4].text })
  saved.set(
    'notes',
    pages().filter((p) => p.id !== gone && p.parent !== gone),
  )
  await $.turn.complete({ turnId: 'gone', reason: 'answer', answer: '' })
  await clock.advance(10)
  expect(board()).toBeUndefined()
  await wait(400_000)
  expect(sends().map((r) => r.body.text)).toEqual([
    'Очередь на доске «Sprint» закончилась: карточек — 1',
    'Очередь на доске «Sprint» остановилась: карточка не в последней колонке',
    'Очередь на доске «Sprint» остановилась: доску удалили',
  ])

  // Доску удалил сам человек кнопкой в Arcade — он здесь и знает: молчим
  await $.tool.call({ tool: NOTES_TOOL_NAME, action: 'create', title: 'Sprint', board: true })
  await add('F')
  if (!(await ui.find({ key: `arcade-desk-${board().id}` }))) await ui.press({ key: 'arcade-back' })
  await ui.press({ key: `arcade-desk-${board().id}` })
  await queue()
  expect(submits.length).toBe(6)
  await $.turn.start({ turnId: 'mine', text: submits[5].text })
  await ui.press({ key: 'arcade-board-delete' })
  await ui.press({ key: 'arcade-board-delete' })
  expect(board()).toBeUndefined()
  await $.turn.complete({ turnId: 'mine', reason: 'answer', answer: '' })
  await clock.advance(10)
  await wait(400_000)
  expect(sends().length).toBe(3)
  expect(JSON.stringify(sends())).not.toMatch(/«[A-F]»|пароли/)
  await ui.unmount()
})
