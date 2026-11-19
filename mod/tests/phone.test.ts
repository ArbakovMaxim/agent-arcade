// Уведомления на телефон (п. 39): ответы сайта, кого звать и каким текстом, экран подключения по коду, отправка из
// «Агентов» — только имя сессии, не чаще раза в 5 минут, одна сессия на компьютере. Отдельный файл — у каждого файла
// тестов свой предел времени
import { expect } from 'claude-code/testing'
import { SITE } from '../hooks/catalog.js'
import { tr } from '../hooks/i18n.js'
import { accountUrl, parsePushCode, parsePushSend, parsePushState } from '../hooks/account.js'
import { PHONE_POLL_MS, PHONE_TEXT_MAX, PHONE_WAIT_MS, phoneDue, phoneName, phoneText } from '../hooks/phone.js'
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

test('телефон без входа: плитка «нет», экран объясняет и ведёт ко входу; сайт не спрашиваем', HEAVY, async ($, on) => {
  const { api } = phoneSite()
  const { clock, requests } = stubs(on, { env: WINDOWS, api })
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-phone' })).toMatchObject({ props: { label: 'Уведомления на телефон: нет' } })
  expect(await ui.find({ type: 'Text', text: '  когда сессия ждёт тебя дольше 2 минут; только имя сессии, без вопроса и кода' })).toBeDefined()
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
