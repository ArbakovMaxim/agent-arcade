// Тест кода Worker'а без Cloudflare: маршруты и комната (Durable Object) на подставных объектах
import assert from 'node:assert/strict'
import fs from 'node:fs'
import worker, { Room, DoomRoom, EjsGame, Presence, BoardRoom, Discover, Twitch, Account, Limiter, MAX_PEERS, MAX_PER_IP, MAX_MESSAGE } from '../worker/index.js'

// --- Маршруты ----------------------------------------------------------------------------------------------------
{
  const calls = []
  const env = {
    ASSETS: { fetch: async (req) => { calls.push(['assets', new URL(req.url).pathname]); return new Response('статика') } },
    ROOMS: {
      idFromName: (name) => `id:${name}`,
      get: (id) => ({ fetch: async () => { calls.push(['room', id]); return new Response('комната') } }),
    },
    DOOM: {
      idFromName: (name) => `doom:${name}`,
      get: (id) => ({ fetch: async () => { calls.push(['doom', id]); return new Response('doom') } }),
    },
  }
  const go = (path, headers = {}) => worker.fetch(new Request(`https://arcade.test${path}`, { headers }), env)
  assert.deepEqual(await (await go('/api/ping')).json(), { ok: true })
  assert.equal((await go('/net/room/плохое имя')).status, 400)
  assert.equal((await go('/net/room/lobby')).status, 426, 'без WebSocket — отказ')
  await go('/net/room/lobby', { Upgrade: 'websocket' })
  await go('/net/doom/round-1', { Upgrade: 'websocket' })
  await go('/?tab=sega')
  assert.deepEqual(calls, [['room', 'id:lobby'], ['doom', 'doom:round-1'], ['assets', '/']])
}

// --- Комната -----------------------------------------------------------------------------------------------------
class FakeSocket {
  constructor() { this.sent = []; this.attachment = null; this.closed = false }
  send(m) { if (this.closed) throw new Error('закрыт'); this.sent.push(m) }
  serializeAttachment(a) { this.attachment = a }
  deserializeAttachment() { return this.attachment }
  close() { this.closed = true }
}
const RealResponse = globalThis.Response
globalThis.WebSocketPair = class { constructor() { this[0] = new FakeSocket(); this[1] = new FakeSocket() } }
globalThis.Response = class { constructor(body, init = {}) { this.status = init.status ?? 200; this.webSocket = init.webSocket } }
try {
  const sockets = []
  const ctx = { acceptWebSocket: (ws) => sockets.push(ws), getWebSockets: () => sockets.filter((ws) => !ws.closed) }
  const room = new Room(ctx, {})
  const json = (ws, i) => JSON.parse(ws.sent[i])
  // Первый игрок: в комнате пусто
  assert.equal((await room.fetch()).status, 101)
  const a = sockets[0]
  assert.deepEqual(json(a, 0), { type: 'welcome', id: a.attachment.id, peers: [] })
  // Второй: видит первого, первый узнаёт о нём
  await room.fetch()
  const b = sockets[1]
  assert.deepEqual(json(b, 0), { type: 'welcome', id: b.attachment.id, peers: [a.attachment.id] })
  assert.deepEqual(json(a, 1), { type: 'join', id: b.attachment.id })
  // Сообщение — всем, кроме отправителя, как есть: и текст, и двоичное
  await room.webSocketMessage(a, 'кадр 42: вправо')
  assert.equal(b.sent.at(-1), 'кадр 42: вправо')
  assert.equal(a.sent.length, 2, 'себе не пересылается')
  const bytes = new Uint8Array([1, 2, 3]).buffer
  await room.webSocketMessage(b, bytes)
  assert.equal(a.sent.at(-1), bytes)
  // Слишком большое — не пересылается
  await room.webSocketMessage(a, 'x'.repeat(MAX_MESSAGE + 1))
  assert.equal(b.sent.at(-1), 'кадр 42: вправо')
  // Выход: остальные узнают
  await room.webSocketClose(a, 1000, 'пока')
  assert.deepEqual(json(b, b.sent.length - 1), { type: 'leave', id: a.attachment.id })
  // Не больше MAX_PEERS игроков
  while (ctx.getWebSockets().length < MAX_PEERS) await room.fetch()
  assert.equal((await room.fetch()).status, 409)
} finally {
  globalThis.Response = RealResponse
}
// --- Комната Doom: пакет уходит только адресату, хозяин (номер 1) начинает новую игру --------------------------
globalThis.WebSocketPair = class { constructor() { this[0] = new FakeSocket(); this[1] = new FakeSocket() } }
globalThis.Response = class { constructor(body, init = {}) { this.status = init.status ?? 200; this.webSocket = init.webSocket } }
try {
  const sockets = []
  const ctx = { acceptWebSocket: (ws) => sockets.push(ws), getWebSockets: () => sockets.filter((ws) => !ws.closed) }
  const room = new DoomRoom(ctx, {})
  const packet = (to, from, ...data) => {
    const buf = new ArrayBuffer(8 + data.length)
    const view = new DataView(buf)
    view.setUint32(0, to, true)
    view.setUint32(4, from, true)
    data.forEach((b, i) => view.setUint8(8 + i, b))
    return buf
  }
  const bytes = (buf) => Array.from(new Uint8Array(buf))
  // Хозяин входит первым и сообщает «я номер 1», потом подключаются остальные
  await room.fetch()
  const host = sockets[0]
  await room.webSocketMessage(host, packet(0, 1))
  await room.fetch()
  await room.fetch()
  const [, guest, other] = sockets
  await room.webSocketMessage(guest, packet(1, 777, 9)) // гость номер 777 пишет хозяину
  assert.deepEqual(bytes(host.sent.at(-1)), [...bytes(new Uint32Array([777]).buffer), 9], 'хозяину — [от кого][данные]')
  await room.webSocketMessage(host, packet(777, 1, 5, 6)) // хозяин отвечает гостю
  assert.deepEqual(bytes(guest.sent.at(-1)), [1, 0, 0, 0, 5, 6])
  assert.equal(other.sent.length, 0, 'третьему ничего не досталось')
  await room.webSocketMessage(guest, 'текст') // текст и обрывки — мимо
  await room.webSocketMessage(guest, new ArrayBuffer(4))
  assert.equal(host.sent.length, 1)
  // Хозяин представляется ещё раз — игроков не трогаем (они могли подключиться раньше него)…
  await room.webSocketMessage(host, packet(0, 1))
  assert.ok(!guest.closed && !other.closed && !host.closed)
  // …а второй «хозяин» выкидывает прежнего
  await room.fetch()
  const newHost = sockets.at(-1)
  await room.webSocketMessage(newHost, packet(0, 1))
  assert.ok(host.closed && !guest.closed && !newHost.closed)
} finally {
  globalThis.Response = RealResponse
}
// --- Сетевая игра EmulatorJS: комнаты одной игры ---------------------------------------------------------------
globalThis.WebSocketPair = class { constructor() { this[0] = new FakeSocket(); this[1] = new FakeSocket() } }
globalThis.Response = class {
  constructor(body, init = {}) { this.status = init.status ?? 200; this.webSocket = init.webSocket; this.body = body }
  static json(v) { const r = new this(JSON.stringify(v)); r.value = v; return r }
}
const posts = []
const presenceEnv = { PRESENCE: { idFromName: () => 'all', get: () => ({ fetch: async (url, init) => { posts.push(JSON.parse(init.body)); return {} } }) } }
try {
  const sockets = []
  const ctx = { acceptWebSocket: (ws) => sockets.push(ws), getWebSockets: () => sockets.filter((ws) => !ws.closed), waitUntil: () => {} }
  const game = new EjsGame(ctx, presenceEnv)
  const frames = (ws) => ws.sent.map((m) => JSON.parse(m))
  const say = (ws, frame) => game.webSocketMessage(ws, JSON.stringify(frame))
  await game.fetch(new Request('https://ejs/net/ejs/123'))
  await game.fetch(new Request('https://ejs/net/ejs/123'))
  const [owner, guest] = sockets
  const extra = (userid, name) => ({ domain: 'arcade', game_id: 123, room_name: 'Танки', player_name: name, userid, sessionid: 's1' })
  await say(owner, { t: 'emit', event: 'open-room', data: { extra: extra('u1', 'Макс'), maxPlayers: 2 }, id: 1 })
  assert.deepEqual(frames(owner)[0], { t: 'ack', id: 1, args: [null] })
  assert.deepEqual((await game.fetch(new Request('https://ejs/list'))).value, { s1: { room_name: 'Танки', current: 1, max: 2 } })
  assert.deepEqual(posts.at(-1), { key: 'g123', value: 1 }, 'счётчик: одна открытая комната')
  await say(guest, { t: 'emit', event: 'join-room', data: { extra: extra('u2', 'Гость') }, id: 7 })
  const joined = frames(guest).find((f) => f.t === 'ack')
  assert.equal(joined.args[0], null)
  assert.deepEqual(Object.keys(joined.args[1]), ['u1', 'u2'])
  assert.ok(frames(owner).some((f) => f.event === 'users-updated' && Object.keys(f.data).length === 2))
  assert.deepEqual(posts.at(-1), { key: 'g123', value: 0 }, 'комната полна — свободных нет')
  // Третий в комнату на двоих не попадает
  await game.fetch(new Request('https://ejs/net/ejs/123'))
  const third = sockets[2]
  await say(third, { t: 'emit', event: 'join-room', data: { extra: extra('u3', 'Третий') }, id: 2 })
  assert.deepEqual(frames(third).at(-1), { t: 'ack', id: 2, args: ['Комната заполнена'] })
  // Нажатия и куски — только своей комнате
  await say(owner, { t: 'emit', event: 'data-message', data: { 'sync-control': [{ frame: 10 }] } })
  assert.deepEqual(frames(guest).at(-1), { t: 'event', event: 'data-message', data: { 'sync-control': [{ frame: 10 }] } })
  await say(guest, { t: 'chunk', id: 'm1', i: 0, n: 2, part: '{"state":' })
  assert.deepEqual(frames(owner).at(-1), { t: 'chunk', id: 'm1', i: 0, n: 2, part: '{"state":' })
  assert.equal(third.sent.length, 1, 'чужой комнате ничего')
  // Хозяин ушёл — комната закрывается для всех
  owner.closed = true
  await game.webSocketClose(owner, 1000, '')
  assert.deepEqual(frames(guest).at(-1), { t: 'event', event: 'disconnect' })
  assert.deepEqual((await game.fetch(new Request('https://ejs/list'))).value, {})
} finally {
  globalThis.Response = RealResponse
}

// --- Счётчик «кто ждёт» и лобби Doom --------------------------------------------------------------------------
{
  const store = new Map()
  const ctx = { storage: { put: async (k, v) => store.set(k, v), delete: async (k) => store.delete(k), list: async () => new Map(store) } }
  const presence = new Presence(ctx, {})
  const set = (key, value) => presence.fetch(new Request('https://presence/set', { method: 'POST', body: JSON.stringify({ key, value }) }))
  await set('doom', 2)
  await set('g123', 1)
  await set('g9', 0)
  assert.equal((await set('лишнее', 1)).status, 400)
  await set('coop-freedoom-1', 2)
  assert.deepEqual(await (await presence.fetch(new Request('https://presence/get'))).json(), { doom: 2, games: { 123: 1 }, coop: { 'freedoom-1': 2 }, board: {}, dm: {} })
  await set('doom', 0)
  assert.deepEqual(await (await presence.fetch(new Request('https://presence/get'))).json(), { doom: 0, games: { 123: 1 }, coop: { 'freedoom-1': 2 }, board: {}, dm: {} })
}
globalThis.WebSocketPair = class { constructor() { this[0] = new FakeSocket(); this[1] = new FakeSocket() } }
globalThis.Response = class { constructor(body, init = {}) { this.status = init.status ?? 200; this.webSocket = init.webSocket } }
try {
  posts.length = 0
  const sockets = []
  const ctx = { acceptWebSocket: (ws) => sockets.push(ws), getWebSockets: () => sockets.filter((ws) => !ws.closed), waitUntil: () => {} }
  const lobby = new Room(ctx, presenceEnv)
  const req = { headers: new Headers({ 'X-Room': 'doom-lobby' }) }
  await lobby.fetch(req)
  await lobby.fetch(req)
  assert.deepEqual(posts.at(-1), { key: 'doom', value: 2 }, 'лобби Doom: двое ждут')
  sockets[0].closed = true
  await lobby.webSocketClose(sockets[0], 1000, '')
  assert.deepEqual(posts.at(-1), { key: 'doom', value: 1 })
  // Лобби кооператива — по имени комнаты
  posts.length = 0
  const coopSockets = []
  const coopLobby = new Room({ acceptWebSocket: (ws) => coopSockets.push(ws), getWebSockets: () => coopSockets, waitUntil: () => {} }, presenceEnv)
  await coopLobby.fetch({ headers: new Headers({ 'X-Room': 'coop-freedoom-1' }) })
  assert.deepEqual(posts.at(-1), { key: 'coop-freedoom-1', value: 1 })
  // Лобби BlasphDM — по имени комнаты
  posts.length = 0
  const dmSockets = []
  const dmLobby = new Room({ acceptWebSocket: (ws) => dmSockets.push(ws), getWebSockets: () => dmSockets, waitUntil: () => {} }, presenceEnv)
  await dmLobby.fetch({ headers: new Headers({ 'X-Room': 'dm-blasphdm' }) })
  assert.deepEqual(posts.at(-1), { key: 'dm-blasphdm', value: 1 })
  // Обычная комната счётчику не пишет
  posts.length = 0
  const other = new Room({ acceptWebSocket: () => {}, getWebSockets: () => [], waitUntil: () => {} }, presenceEnv)
  await other.fetch({ headers: new Headers({ 'X-Room': 'friends' }) })
  assert.equal(posts.length, 0)
} finally {
  globalThis.Response = RealResponse
}
// --- Ограничения: частота сообщений, подключения с одного адреса, чужие сайты -------------------------------------
{
  let now = 0
  const limiter = new Limiter({ messages: 10, bytes: 1000, now: () => now })
  const ws = {}
  let passed = 0
  for (let i = 0; i < 30; i++) if (limiter.allow(ws, 10) === true) passed++
  assert.equal(passed, 20, 'всплеск — двойной запас, остальное отбрасывается')
  now += 1000
  passed = 0
  for (let i = 0; i < 30; i++) if (limiter.allow(ws, 10) === true) passed++
  assert.equal(passed, 10, 'за секунду ведро пополнилось на лимит')
  assert.equal(limiter.allow({}, 5000), false, 'слишком большое для ведра — отброшено')
  let verdict
  for (let i = 0; i < 300; i++) verdict = limiter.allow(ws, 10)
  assert.equal(verdict, 'close', 'долгий поток — отключить')
}
globalThis.WebSocketPair = class { constructor() { this[0] = new FakeSocket(); this[1] = new FakeSocket() } }
globalThis.Response = class { constructor(body, init = {}) { this.status = init.status ?? 200; this.webSocket = init.webSocket } }
try {
  const sockets = []
  const ctx = { acceptWebSocket: (ws) => sockets.push(ws), getWebSockets: () => sockets.filter((ws) => !ws.closed), waitUntil: () => {} }
  const room = new Room(ctx, {})
  const from = (ip) => ({ headers: new Headers({ 'CF-Connecting-IP': ip }) })
  for (let i = 0; i < MAX_PER_IP; i++) assert.equal((await room.fetch(from('1.2.3.4'))).status, 101)
  assert.equal((await room.fetch(from('1.2.3.4'))).status, 429, 'пятое с того же адреса — отказ')
  assert.equal((await room.fetch(from('5.6.7.8'))).status, 101, 'с другого — можно')
  // Заваливающий сообщениями перестаёт доходить до остальных
  const [spammer, listener] = sockets
  const before = listener.sent.length
  for (let i = 0; i < 200; i++) await room.webSocketMessage(spammer, 'спам')
  const got = listener.sent.length - before
  assert.ok(got >= 40 && got <= 41, `дошло ${got} — всплеск, остальное отброшено`)
} finally {
  globalThis.Response = RealResponse
}
{
  const env = { ASSETS: { fetch: async () => new Response('статика') }, ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('комната') }) } }
  const ws = (origin) => worker.fetch(new Request('https://arcade.test/net/room/lobby', { headers: { Upgrade: 'websocket', ...(origin ? { Origin: origin } : {}) } }), env)
  assert.equal((await ws('https://evil.example')).status, 403, 'с чужого сайта — нельзя')
  assert.equal(await (await ws('https://arcade.test')).text(), 'комната', 'со своего — можно')
  assert.equal(await (await ws()).text(), 'комната', 'без Origin (не браузер) — можно')
}
// --- Партия настольной игры: места, очерёдность, сохранение, новая партия, удаление ------------------------------
globalThis.WebSocketPair = class { constructor() { this[0] = new FakeSocket(); this[1] = new FakeSocket() } }
globalThis.Response = class { constructor(body, init = {}) { this.status = init.status ?? 200; this.webSocket = init.webSocket } }
try {
  const store = new Map()
  let alarm = null
  const storage = { get: async (k) => structuredClone(store.get(k)), put: async (k, v) => store.set(k, structuredClone(v)), deleteAll: async () => store.clear(), setAlarm: async (t) => { alarm = t } }
  const sockets = []
  const ctx = { storage, acceptWebSocket: (ws) => sockets.push(ws), getWebSockets: () => sockets.filter((ws) => !ws.closed) }
  let room = new BoardRoom(ctx, {})
  const say = (ws, m) => room.webSocketMessage(ws, JSON.stringify(m))
  const last = (ws) => JSON.parse(ws.sent.at(-1))
  for (let i = 0; i < 3; i++) await room.fetch({ headers: new Headers() })
  const [a, b, watcher] = sockets
  await say(a, { type: 'hello', token: 'tokenaaaa1', game: 'reversi' })
  assert.deepEqual(last(a), { type: 'state', game: 'reversi', seat: 0, seats: 1, moves: [] })
  await say(b, { type: 'hello', token: 'tokenbbbb2', game: 'chess' })
  assert.equal(last(b).seat, 1)
  assert.equal(last(b).game, 'reversi', 'игра комнаты — та, что задал первый')
  assert.deepEqual(last(a), { type: 'seats', seats: 2 })
  await say(watcher, { type: 'hello', token: 'tokencccc3' })
  assert.equal(last(watcher).seat, -1, 'третий — зритель')
  // Очерёдность: ходит сторона 0, потом 1; чужой ход — возврат позиции
  await say(b, { type: 'move', ply: 0, move: [2, 3] })
  assert.equal(last(b).type, 'state')
  await say(a, { type: 'move', ply: 0, move: [2, 3] })
  for (const ws of [a, b, watcher]) assert.deepEqual(last(ws), { type: 'move', ply: 0, move: [2, 3] })
  await say(watcher, { type: 'move', ply: 1, move: [2, 2] })
  assert.equal(last(watcher).type, 'state', 'зритель не ходит')
  assert.ok(alarm > Date.now(), 'партия удалится сама, если её долго не трогать')
  // Комната перезапустилась — партия на месте, а игрок по своему жетону — на своём месте
  room = new BoardRoom(ctx, {})
  await room.fetch({ headers: new Headers() })
  const back = sockets.at(-1)
  await room.webSocketMessage(back, JSON.stringify({ type: 'hello', token: 'tokenbbbb2' }))
  assert.deepEqual(last(back), { type: 'state', game: 'reversi', seat: 1, seats: 2, moves: [[2, 3]] })
  // Новая партия — стороны меняются местами
  await room.webSocketMessage(back, JSON.stringify({ type: 'reset' }))
  assert.equal(last(back).seat, 0)
  assert.deepEqual(last(back).moves, [])
  // Сдаться: зритель не может; игрок — итог всем, ход после сдачи не принимается, новая партия — без итога
  await say(watcher, { type: 'resign' })
  assert.equal(last(back).result, undefined, 'зритель не сдаётся за игроков')
  await say(a, { type: 'resign' })
  for (const ws of [a, back, watcher]) assert.deepEqual(last(ws).result, { loser: 1, reason: 'resign' })
  await say(back, { type: 'move', ply: 0, move: [2, 3] })
  assert.deepEqual(last(back).moves, [], 'после сдачи ход не принимается')
  await say(back, { type: 'reset' })
  assert.equal(last(back).result, undefined, 'новая партия — без итога')
  await room.alarm()
  assert.equal(store.size, 0)
  // Часы: контроль задаёт первый; идут, когда сели двое; ход вычитает время; «флажок» — только по часам сервера
  room = new BoardRoom(ctx, {})
  for (let i = 0; i < 2; i++) await room.fetch({ headers: new Headers() })
  const [w, bl] = sockets.slice(-2)
  await room.webSocketMessage(w, JSON.stringify({ type: 'hello', token: 'tokenwhite1', game: 'chess', control: 1 }))
  assert.equal(last(w).control, 1)
  assert.equal(last(w).clock, undefined, 'один игрок — часы стоят')
  await room.webSocketMessage(bl, JSON.stringify({ type: 'hello', token: 'tokenblack2', game: 'chess', control: 600 }))
  assert.equal(last(bl).control, 1, 'контроль — тот, что задал первый')
  assert.deepEqual(last(bl).clock.left, [1000, 1000])
  await room.webSocketMessage(w, JSON.stringify({ type: 'flag' }))
  assert.equal(last(w).result, undefined, 'рано: у белых ещё есть время')
  await room.webSocketMessage(w, JSON.stringify({ type: 'move', ply: 0, move: 'e4' }))
  assert.ok(last(w).clock.left[0] <= 1000 && last(w).clock.left[0] > 0, 'ход вычел время белых')
  await new Promise((r) => setTimeout(r, 1100))
  await room.webSocketMessage(w, JSON.stringify({ type: 'flag' }))
  assert.deepEqual(last(w).result, { loser: 1, reason: 'time' }, 'у чёрных вышло время')
  await room.webSocketMessage(bl, JSON.stringify({ type: 'move', ply: 1, move: 'e5' }))
  assert.deepEqual(last(bl).moves, ['e4'], 'после конца партии ход не принимается')
  // Ники: верная подпись сайта — ник у своего места; чужая, истёкшая или подменённая — без ника; у зрителя ника нет;
  // новая партия — ники уходят вместе с местами
  const { nameTicket, TICKET_MS } = await import('../worker/account.js')
  const secret = 'тестовый-секрет'
  for (const ws of sockets) ws.closed = true
  store.clear()
  room = new BoardRoom(ctx, { LINK_SECRET: secret })
  for (let i = 0; i < 3; i++) await room.fetch({ headers: new Headers() })
  const [p1, p2, p3] = sockets.slice(-3)
  const hello = (ws, token, me) => room.webSocketMessage(ws, JSON.stringify({ type: 'hello', token, game: 'checkers', me }))
  const fefa = await nameTicket(secret, 'fefa', Date.now())
  assert.match(fefa, /^fefa\.\d{10}\.[A-Za-z0-9_-]{22}$/)
  await hello(p1, 'tokenname01', fefa)
  assert.deepEqual(last(p1).names, ['fefa'])
  await hello(p2, 'tokenname02', await nameTicket('чужой-секрет', 'octo', Date.now()))
  assert.deepEqual(last(p2).names, ['fefa', null], 'подпись не сайта — без ника')
  assert.deepEqual(last(p1), { type: 'seats', seats: 2, names: ['fefa', null] })
  await hello(p2, 'tokenname02', await nameTicket(secret, 'octo', Date.now() - TICKET_MS))
  assert.deepEqual(last(p2).names, ['fefa', null], 'подпись истекла')
  await hello(p2, 'tokenname02', fefa.replace('fefa', 'octo'))
  assert.deepEqual(last(p2).names, ['fefa', null], 'ник в подписи подменён')
  await hello(p2, 'tokenname02', await nameTicket(secret, 'octo', Date.now()))
  assert.deepEqual(last(p1), { type: 'seats', seats: 2, names: ['fefa', 'octo'] })
  await hello(p3, 'tokenname03', await nameTicket(secret, 'watcher', Date.now()))
  assert.deepEqual(last(p3).names, ['fefa', 'octo'], 'зритель места не занимает — и ника тоже')
  await hello(p1, 'tokenname01')
  assert.deepEqual(last(p1).names, ['fefa', 'octo'], 'вернулся без подписи — ник прежний')
  await room.webSocketMessage(p1, JSON.stringify({ type: 'reset' }))
  assert.equal(last(p1).seat, 1)
  assert.deepEqual(last(p1).names, ['octo', 'fefa'])
  assert.ok(!JSON.stringify(p3.sent).includes('tokenname01'), 'жетоны мест в окна не уходят')
} finally {
  globalThis.Response = RealResponse
}
// --- Своя тема: поиск с кешем, лимитами и подписанными ссылками (worker/discover.js) ------------------------------
{
  const { normalQuery, looksEnglish, isoSeconds, PER_IP_DAILY } = await import('../worker/discover.js')
  assert.equal(normalQuery('  Rust  Embedded!! '), 'rust embedded')
  assert.equal(normalQuery('C++ & C#'), 'c++ c#')
  assert.equal(normalQuery('я'), '', 'не латиница — не запрос')
  assert.equal(normalQuery('x'.repeat(200)).length, 80)
  assert.deepEqual(['Pokémon tips', '¿Cuántos usuarios?', 'Équipe générale', 'Привет', 'Rust 🚀'].map(looksEnglish), [true, false, false, false, true])
  assert.deepEqual(['PT1H2M3S', 'PT45S', 'P0D', 'нет'].map(isoSeconds), [3723, 45, 0, 0])

  const now = Date.now()
  const sec = (days) => Math.floor((now - days * 86_400_000) / 1000)
  const iso = (days) => new Date(now - days * 86_400_000).toISOString()
  const asked = []
  let down = false
  let quota = false
  const medium = `<rss><channel><title>Medium</title>
    <item><title><![CDATA[Rust on tiny chips]]></title><link>https://medium.com/@ann/rust-chips-1a2b?source=rss------embedded_rust-5</link><pubDate>${new Date(now - 3_600_000).toUTCString()}</pubDate></item>
    <item><title><![CDATA[¿Rust en producción?]]></title><link>https://medium.com/@luis/rust-es-9f?source=rss</link><pubDate>${new Date(now).toUTCString()}</pubDate></item>
  </channel></rss>`
  const replies = {
    'hn.algolia.com': () => ({
      hits: [
        { title: 'Embedded Rust in production', url: 'https://blog.example.com/rust', created_at_i: sec(2), points: 120 },
        { title: 'A talk', url: 'https://www.youtube.com/watch?v=abcdefghijk', created_at_i: sec(3), points: 50 },
        { title: 'Plain http', url: 'http://plain.example.com/', created_at_i: sec(3), points: 50 },
        { title: 'Paper', url: 'https://arxiv.org/pdf/2401.1.pdf', created_at_i: sec(3), points: 50 },
        { title: 'Embedded Rust in production', url: 'https://blog.example.com/rust', created_at_i: sec(2), points: 120 },
        { title: 'Ask HN: no link', created_at_i: sec(1), points: 90 },
      ],
    }),
    'medium.com': () => medium,
    'itunes.apple.com': () => ({
      results: [
        { collectionId: 111, collectionName: 'Rustacean Station', feedUrl: 'https://rustacean-station.org/podcast.rss', releaseDate: iso(10), trackCount: 150, primaryGenreName: 'Technology' },
        { collectionId: 222, collectionName: 'Old Show', feedUrl: 'https://old.example.com/rss', releaseDate: iso(900), trackCount: 40, primaryGenreName: 'Technology' },
        { collectionId: 333, collectionName: 'Loud Show', feedUrl: 'https://loud.example.com/rss', releaseDate: iso(5), trackCount: 40, collectionExplicitness: 'explicit' },
        { collectionId: 444, collectionName: 'Daily Debate', feedUrl: 'https://debate.example.com/rss', releaseDate: iso(1), trackCount: 400, primaryGenreName: 'News', genres: ['News', 'Politics'] },
        { collectionId: 555, collectionName: 'Two Episodes', feedUrl: 'https://two.example.com/rss', releaseDate: iso(1), trackCount: 2 },
        { collectionId: 666, collectionName: 'Embedded FM', feedUrl: 'http://embedded.fm/episodes?format=rss', releaseDate: iso(7), trackCount: 500, primaryGenreName: 'Technology' },
        { collectionId: 777, collectionName: 'Message à caractère informatique', feedUrl: 'https://fr.example.com/rss', releaseDate: iso(7), trackCount: 90 },
      ],
    }),
    'www.googleapis.com': (url) => {
      if (quota) return new Response(JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded' }] } }), { status: 403 })
      if (url.pathname.endsWith('/search')) return { items: ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd', 'eeeeeeeeeee'].map((videoId) => ({ id: { videoId } })) }
      const video = (id, duration, extra = {}) => ({
        id,
        snippet: { title: `Video ${id}`, channelTitle: 'Chan', publishedAt: iso(20), description: 'About it', liveBroadcastContent: 'none', ...extra },
        contentDetails: { duration },
        statistics: { viewCount: '1234' },
      })
      return {
        items: [
          video('bbbbbbbbbbb', 'PT45S'),
          video('aaaaaaaaaaa', 'PT12M5S', { defaultAudioLanguage: 'en-US' }),
          video('ccccccccccc', 'PT0S', { liveBroadcastContent: 'live' }),
          video('ddddddddddd', 'PT20M', { defaultAudioLanguage: 'ru' }),
          video('eeeeeeeeeee', 'PT2M30S', { title: 'Quick tip #shorts' }),
        ],
      }
    },
  }
  const realFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    asked.push(url)
    if (down) throw new Error('сеть недоступна')
    const body = replies[url.hostname]?.(url)
    if (body === undefined) return new Response('нет', { status: 404 })
    if (body instanceof Response) return body
    return typeof body === 'string' ? new Response(body) : Response.json(body)
  }
  try {
    // Хранилище Durable Object в памяти; по одному объекту на вид поиска, как idFromName(kind)
    const objects = new Map()
    const env = { LINK_SECRET: 'тестовый-секрет', YOUTUBE_KEY: 'yt-key', YT_DAILY_SEARCHES: '2' }
    env.DISCOVER = {
      idFromName: (name) => name,
      get: (kind) => {
        if (!objects.has(kind)) {
          const store = new Map()
          const storage = {
            alarm: null,
            get: async (k) => store.get(k),
            put: async (k, v) => void store.set(k, structuredClone(v)),
            delete: async (keys) => {
              for (const k of [].concat(keys)) store.delete(k)
            },
            list: async () => new Map(store),
            getAlarm: async () => storage.alarm,
            setAlarm: async (t) => {
              storage.alarm = t
            },
          }
          objects.set(kind, { store, storage, object: new Discover({ storage }, env) })
        }
        return objects.get(kind).object
      },
    }
    const go = (path, ip = '10.0.0.1', withEnv = env) => worker.fetch(new Request(`https://arcade.test${path}`, { headers: { 'CF-Connecting-IP': ip } }), withEnv)
    const find = async (kind, q, ip) => {
      const response = await go(`/api/discover?kind=${kind}&q=${encodeURIComponent(q)}`, ip)
      return { status: response.status, body: await response.json() }
    }

    // Неверный запрос и выключенный поиск
    assert.equal((await find('films', 'rust')).status, 400)
    assert.equal((await find('articles', 'я')).status, 400)
    assert.equal((await go('/api/discover?kind=articles&q=rust', '1.1.1.1', { ...env, LINK_SECRET: '' })).status, 503, 'без секрета поиска нет')
    assert.equal((await go('/api/discover?kind=youtube&q=rust', '1.1.1.1', { ...env, YOUTUBE_KEY: '' })).status, 503, 'без ключа нет поиска YouTube')
    assert.equal(asked.length, 0)

    // Статьи: HN и Medium вперемешку; видео, http, PDF, не английское, повтор и запись без ссылки — мимо
    const ar = await find('articles', 'Embedded Rust')
    assert.equal(ar.status, 200)
    assert.deepEqual(ar.body.items.map((i) => i.link), ['https://blog.example.com/rust', 'https://medium.com/@ann/rust-chips-1a2b'])
    assert.deepEqual(ar.body.items.map((i) => i.source), ['blog.example.com', 'medium.com'])
    assert.equal(ar.body.items[0].points, 120)
    assert.ok(ar.body.items.every((i) => /^[\w-]{22}$/.test(i.s)), 'каждая ссылка подписана')
    assert.deepEqual(asked.filter((u) => u.hostname === 'medium.com').map((u) => u.pathname), ['/feed/tag/embedded-rust', '/feed/tag/embedded'], 'мало по всему запросу — ещё по первому слову')
    // Подпись проверяет /api/verify: чужая ссылка или подпись от другой ссылки — нет
    const check = async (query) => (await (await go(`/api/verify?${query}`)).json()).ok
    const [first] = ar.body.items
    assert.equal(await check(`kind=read&u=${encodeURIComponent(first.link)}&s=${first.s}`), true)
    assert.equal(await check(`kind=read&u=${encodeURIComponent('https://evil.test/')}&s=${first.s}`), false)
    assert.equal(await check(`kind=read&u=${encodeURIComponent(first.link)}&s=${'A'.repeat(22)}`), false)
    assert.equal(await check(`kind=read&u=${encodeURIComponent(first.link)}`), false)
    // Повтор того же запроса (в другом виде) — из кеша, без источников
    const before = asked.length
    assert.deepEqual((await find('articles', 'embedded   RUST', '10.0.0.2')).body, ar.body)
    assert.equal(asked.length, before, 'из кеша')
    // Одинаковые запросы одновременно — один поиск
    const [x, y] = await Promise.all([find('articles', 'zig', '10.0.0.3'), find('articles', 'zig', '10.0.0.4')])
    assert.deepEqual(x, y)
    assert.equal(asked.filter((u) => u.hostname === 'hn.algolia.com' && u.searchParams.get('query') === 'zig').length, 1)

    // Источники не ответили — 502, и это не кешируется
    down = true
    assert.deepEqual(await find('articles', 'go generics'), { status: 502, body: { error: 'upstream' } })
    down = false
    assert.equal((await find('articles', 'go generics')).status, 200)

    // Подкасты: только живые шоу без explicit, политики, проб на пару выпусков и не английских; http-ленту — по https
    const pc = await find('podcasts', 'embedded rust')
    assert.deepEqual(pc.body.shows.map((s) => [s.id, s.name, s.url]), [
      ['it111', 'Rustacean Station', 'https://rustacean-station.org/podcast.rss'],
      ['it666', 'Embedded FM', 'https://embedded.fm/episodes?format=rss'],
    ])
    const show = pc.body.shows[0]
    assert.equal(await check(`kind=listen&f=${show.id}&n=${encodeURIComponent(show.name)}&s=${show.s}`), true)
    assert.equal(await check(`kind=listen&f=${show.id}&n=${encodeURIComponent('Other Show')}&s=${show.s}`), false, 'подпись — на номер и название вместе')
    assert.equal(await check(`kind=listen&f=se-daily&n=x&s=${show.s}`), false)

    // YouTube: без Shorts, трансляций и озвучки не на английском
    const yt = await find('youtube', 'rust embedded')
    assert.equal(yt.status, 200)
    assert.deepEqual(yt.body.videos.map((v) => [v.id, v.seconds, v.views]), [['aaaaaaaaaaa', 725, 1234]])
    const search = asked.find((u) => u.pathname.endsWith('/youtube/v3/search'))
    assert.equal(search.searchParams.get('safeSearch'), 'strict')
    assert.equal(search.searchParams.get('relevanceLanguage'), 'en')
    // Потолок поисков в сутки (здесь 2): третий новый запрос — 429 без обращения к YouTube
    assert.equal((await find('youtube', 'zig comptime', '10.0.0.5')).status, 200)
    const calls = asked.length
    assert.deepEqual(await find('youtube', 'wasm', '10.0.0.6'), { status: 429, body: { error: 'quota' } })
    assert.equal(asked.length, calls)
    assert.equal((await find('youtube', 'rust embedded', '10.0.0.6')).status, 200, 'кеш работает и без квоты')
    // YouTube сказал «квота кончилась» — до конца суток не спрашиваем
    const day = new Date().toISOString().slice(0, 10)
    objects.get('youtube').store.set(`day:${day}`, 0)
    quota = true
    assert.equal((await find('youtube', 'ocaml', '10.0.0.7')).status, 429)
    assert.equal(objects.get('youtube').store.get(`day:${day}`), 2)
    quota = false

    // Один адрес — не больше PER_IP_DAILY новых поисков в сутки; адрес хранится только меткой
    for (let i = 1; i < PER_IP_DAILY.podcasts; i++) assert.equal((await find('podcasts', `topic ${i}`, '10.9.9.9')).status, 200)
    assert.equal((await find('podcasts', 'last one', '10.9.9.9')).status, 200)
    assert.deepEqual(await find('podcasts', 'one more', '10.9.9.9'), { status: 429, body: { error: 'limit' } })
    assert.equal((await find('podcasts', 'one more', '10.8.8.8')).status, 200, 'другой адрес — можно')
    assert.ok([...objects.get('podcasts').store.keys()].every((k) => !k.includes('10.9.9.9')))

    // Будильник убирает старые ответы и счётчики прошлых суток
    const { store, storage, object } = objects.get('articles')
    assert.ok(storage.alarm > now, 'уборка назначена')
    store.set('q:stale', { at: now - 3 * 86_400_000, data: {} })
    store.set('ip:2000-01-01:abc', 3)
    await object.alarm()
    assert.ok(!store.has('q:stale') && !store.has('ip:2000-01-01:abc'))
    assert.ok(store.has('q:embedded rust'), 'свежие ответы остаются')
  } finally {
    globalThis.fetch = realFetch
  }
}

// --- Twitch: кто в эфире, с кешем, токеном приложения и лимитом адреса (worker/twitch.js) -------------------------
{
  const { parseLogins, PER_IP_DAILY, USER_TTL_MS } = await import('../worker/twitch.js')
  const CATALOG = JSON.parse(fs.readFileSync(new URL('../content/twitch.json', import.meta.url), 'utf8'))
  assert.deepEqual(parseLogins('Tsoding,teej_dv,tsoding'), ['tsoding', 'teej_dv'])
  assert.deepEqual(parseLogins(''), [])
  assert.equal(parseLogins('bad name'), null)
  assert.equal(parseLogins('x'), null, 'логин Twitch — от двух знаков')
  assert.equal(parseLogins(Array.from({ length: 51 }, (_, i) => `user${i}`).join(',')), null)

  const missing = new Set(['ghost_user', CATALOG.channels.at(-1).login])
  const live = { theprimeagen: 9000, tsoding: 500, vedal987: 20000, myfriend: 10 }
  const asked = []
  const tokens = []
  const flags = { keys: false, expire: 0, down: false }
  const realFetch = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input))
    asked.push(url)
    if (flags.down) return new Response('нет', { status: 500 })
    if (url.hostname === 'id.twitch.tv') {
      if (flags.keys) return Response.json({ status: 400, message: 'invalid client secret' }, { status: 400 })
      assert.equal(new URLSearchParams(init.body).get('grant_type'), 'client_credentials')
      tokens.push(`tok${tokens.length + 1}`)
      return Response.json({ access_token: tokens.at(-1), expires_in: 5_000_000, token_type: 'bearer' })
    }
    assert.equal(url.hostname, 'api.twitch.tv')
    assert.equal(init.headers['Client-Id'], 'twitch-id')
    assert.equal(init.headers.Authorization, `Bearer ${tokens.at(-1)}`)
    if (flags.expire > 0) {
      flags.expire--
      return new Response('{}', { status: 401 })
    }
    if (url.pathname === '/helix/users') {
      const data = url.searchParams.getAll('login').filter((l) => !missing.has(l)).map((login, k) => ({
        id: String(1000 + k),
        login,
        display_name: login === 'myfriend' ? 'MyFriend' : login,
        profile_image_url: login === 'myfriend' ? 'https://evil.test/me.png' : `https://static-cdn.jtvnw.net/jtv_user_pictures/${login}-300x300.png`,
      }))
      return Response.json({ data })
    }
    if (url.pathname === '/helix/streams') {
      assert.equal(url.searchParams.get('first'), '100')
      const data = url.searchParams.getAll('user_login').filter((l) => l in live).map((l) => ({
        user_login: l, type: 'live', title: `  ${l}   is live  `, game_name: 'Software and Game Development', viewer_count: live[l], started_at: '2026-10-22T10:00:00Z', is_mature: l === 'vedal987',
      }))
      return Response.json({ data })
    }
    return new Response('нет', { status: 404 })
  }
  const realNow = Date.now
  try {
    const store = new Map()
    const storage = {
      alarm: null,
      get: async (k) => (Array.isArray(k) ? new Map(k.filter((x) => store.has(x)).map((x) => [x, store.get(x)])) : store.get(k)),
      put: async (k, v) => void store.set(k, structuredClone(v)),
      delete: async (keys) => {
        for (const k of [].concat(keys)) store.delete(k)
      },
      list: async ({ prefix = '' } = {}) => new Map([...store].filter(([k]) => k.startsWith(prefix))),
      getAlarm: async () => storage.alarm,
      setAlarm: async (t) => {
        storage.alarm = t
      },
    }
    const env = { TWITCH_CLIENT_ID: 'twitch-id', TWITCH_CLIENT_SECRET: 'twitch-secret' }
    let object = new Twitch({ storage }, env)
    env.TWITCH = { idFromName: (name) => name, get: () => object }
    const go = async (logins, ip = '10.0.0.1', withEnv = env) => {
      const response = await worker.fetch(new Request(`https://arcade.test/api/twitch?logins=${logins}`, { headers: { 'CF-Connecting-IP': ip } }), withEnv)
      return { status: response.status, body: await response.json() }
    }

    // Неверный вопрос и Twitch не настроен
    assert.equal((await go('bad%20name')).status, 400)
    assert.deepEqual(await go('tsoding', '1.1.1.1', { ...env, TWITCH_CLIENT_SECRET: '' }), { status: 503, body: { error: 'off' } })
    assert.equal(asked.length, 0)

    // Первый вопрос: токен, каналы одним вопросом users, эфиры одним вопросом streams
    const first = await go('myfriend,ghost_user')
    assert.equal(first.status, 200)
    assert.deepEqual(tokens, ['tok1'])
    assert.deepEqual(asked.map((u) => u.pathname), ['/oauth2/token', '/helix/users', '/helix/streams'])
    assert.deepEqual(first.body.channels, [
      { login: 'myfriend', name: 'MyFriend', live: { title: 'myfriend is live', game: 'Software and Game Development', viewers: 10, since: Date.parse('2026-10-22T10:00:00Z'), mature: false } },
    ], 'картинка не с CDN Twitch — без неё')
    assert.deepEqual(first.body.missing, ['ghost_user'])
    // Каталог: сначала эфиры (больше зрителей — выше), эфир 18+ и канал, которого нет, — мимо
    const catalog = first.body.catalog
    assert.deepEqual(catalog.slice(0, 2).map((c) => [c.login, c.live.viewers]), [['theprimeagen', 9000], ['tsoding', 500]])
    assert.ok(!catalog.some((c) => c.login === 'vedal987' || missing.has(c.login)))
    assert.equal(catalog.length, CATALOG.channels.length - 2)
    assert.deepEqual(catalog.slice(2).map((c) => c.login), CATALOG.channels.map((c) => c.login).filter((l) => !['theprimeagen', 'tsoding', 'vedal987'].includes(l) && !missing.has(l)))
    assert.ok(catalog.every((c) => c.topics.length && (c.live === null || c.live.viewers > 0)))
    assert.match(catalog[0].avatar, /^https:\/\/static-cdn\.jtvnw\.net\//)

    // Те же каналы с другого адреса в ту же минуту — из кеша, Twitch не спрашиваем
    assert.deepEqual(await go('ghost_user,myfriend', '10.0.0.2'), { status: 200, body: first.body })
    assert.equal(asked.length, 3)
    // Через минуту — только эфиры; каналы и токен — из кеша
    Date.now = () => realNow() + 61_000
    live.myfriend = 0
    delete live.tsoding
    const later = await go('myfriend')
    assert.deepEqual(asked.slice(3).map((u) => u.pathname), ['/helix/streams'])
    assert.equal(later.body.channels[0].live.viewers, 0)
    assert.equal(later.body.catalog.find((c) => c.login === 'tsoding').live, null)

    // Новый объект (Cloudflare усыпил прежний) — каналы и токен из хранилища
    object = new Twitch({ storage }, env)
    Date.now = () => realNow() + 122_000
    await go('myfriend')
    assert.deepEqual(asked.slice(4).map((u) => u.pathname), ['/helix/streams'])
    assert.deepEqual(tokens, ['tok1'])

    // Токен перестал подходить — один раз берём новый, и дальше как обычно
    Date.now = () => realNow() + 183_000
    flags.expire = 1
    assert.equal((await go('myfriend')).status, 200)
    assert.deepEqual(tokens, ['tok1', 'tok2'])
    // И новый не подходит — ключи приложения неверные
    Date.now = () => realNow() + 244_000
    flags.expire = 2
    assert.deepEqual(await go('myfriend'), { status: 503, body: { error: 'keys' } })
    flags.keys = true
    object.access = null
    store.delete('token')
    Date.now = () => realNow() + 305_000
    assert.deepEqual(await go('myfriend'), { status: 503, body: { error: 'keys' } })
    flags.keys = false
    flags.expire = 0
    // Twitch не ответил — 502, а следующий вопрос снова идёт в Twitch
    flags.down = true
    assert.deepEqual(await go('myfriend'), { status: 502, body: { error: 'upstream' } })
    flags.down = false
    assert.equal((await go('myfriend')).status, 200)

    // С одного адреса — не больше PER_IP_DAILY.logins новых каналов в сутки; адрес не хранится
    const batch = (n) => Array.from({ length: 50 }, (_, i) => `spam${n}_${i}`).join(',')
    for (let n = 0; n < PER_IP_DAILY.logins / 50; n++) assert.equal((await go(batch(n), '10.9.9.9')).status, 200)
    assert.deepEqual(await go(batch(99), '10.9.9.9'), { status: 429, body: { error: 'limit' } })
    assert.equal((await go(batch(99), '10.8.8.8')).status, 200, 'другой адрес — можно')
    assert.equal((await go(batch(0), '10.9.9.9')).status, 200, 'уже известные каналы — не новые')
    assert.ok([...store.keys()].every((k) => !k.includes('10.9.9.9')))

    // Будильник раз в сутки убирает каналы, о которых давно не спрашивали
    assert.ok(storage.alarm > realNow(), 'уборка назначена')
    store.set('u:old_channel', { at: realNow() - USER_TTL_MS - 1, id: '1', name: 'old' })
    await object.alarm()
    assert.ok(!store.has('u:old_channel'))
    assert.ok(store.has('u:myfriend') && store.has('u:ghost_user') && store.has('token'))
  } finally {
    globalThis.fetch = realFetch
    Date.now = realNow
  }
}

// --- Аккаунт: вход через GitHub по коду, ключи сессии и настройки (worker/account.js) -----------------------------
{
  const { sessionId, mergeSettings, MAX_SESSIONS, MAX_KEYS, SETTINGS_MAX, PER_IP_DAILY, IDLE_MS, HANDLE_HOLD_MS, HANDLE_CHANGES, normalHandle, handleProblem, ticketName } = await import('../worker/account.js')
  const KEY = 'a'.repeat(43)
  assert.equal(sessionId(`Bearer 42.${KEY}`), '42')
  assert.equal(sessionId(`Bearer 42.${KEY}x`), null)
  assert.equal(sessionId(`42.${KEY}`), null)
  assert.equal(sessionId(`Bearer x.${KEY}`), null)
  assert.equal(sessionId(null), null)

  // Настройки: по каждому ключу побеждает более позднее
  const now0 = Date.UTC(2026, 9, 22)
  const stored = { lang: { v: 'ru', at: 100 }, wide: { v: true, at: 300 } }
  assert.deepEqual(mergeSettings(stored, { lang: { v: 'en', at: 200 }, wide: { v: false, at: 200 }, keys: { v: null, at: 5 } }, now0), {
    lang: { v: 'en', at: 200 }, wide: { v: true, at: 300 }, keys: { v: null, at: 5 },
  })
  assert.deepEqual(stored, { lang: { v: 'ru', at: 100 }, wide: { v: true, at: 300 } }, 'хранимое не меняется')
  assert.equal(mergeSettings({}, { 'bad key': { v: 1, at: 1 } }, now0), null)
  assert.equal(mergeSettings({}, { __proto__x: { v: 1, at: 1 } }, now0), null)
  assert.equal(mergeSettings({}, { lang: { at: 1 } }, now0), null, 'без значения')
  assert.equal(mergeSettings({}, { lang: { v: 'en', at: -1 } }, now0), null)
  assert.equal(mergeSettings({}, { lang: { v: 'en', at: '5' } }, now0), null)
  assert.equal(mergeSettings({}, { lang: { v: 'en', at: now0 + 2 * 86_400_000 } }, now0), null, 'из будущего')
  assert.ok(mergeSettings({}, { lang: { v: 'en', at: now0 + 3_600_000 } }, now0), 'час вперёд — расхождение часов')
  assert.equal(mergeSettings({}, [], now0), null)
  assert.equal(mergeSettings({}, null, now0), null)
  const many = Object.fromEntries(Array.from({ length: MAX_KEYS + 1 }, (_, i) => [`k${i}`, { v: i, at: 1 }]))
  assert.equal(mergeSettings({}, many, now0), null)

  // @ник: строчными и без @; латиница, цифры и _, 4–32 знака с буквы; слова Arcade, Claude, GitHub — запрещены
  assert.deepEqual([' @Fefa ', 'OCTO_cat', '@@x', 42, null].map(normalHandle), ['fefa', 'octo_cat', '@x', '', ''])
  assert.deepEqual(['fefa', 'a_1_b', 'x'.repeat(32), 'Fefa', 'abc', '1abc', 'ab-cd', 'фефа', 'x'.repeat(33), ''].map(handleProblem), [null, null, null, 'invalid', 'invalid', 'invalid', 'invalid', 'invalid', 'invalid', 'invalid'])
  assert.deepEqual(['admin', 'arcade_team', 'the_claude', 'github', 'my_anthropic', 'anthropics', 'root', 'support_bot'].map(handleProblem), Array(8).fill('reserved'))
  assert.deepEqual(['arcadefan', 'claudette', 'rooted'].map(handleProblem), [null, null, null], 'слово внутри другого — можно')

  // GitHub — подставной: коды, ответы на «вошёл ли» по очереди и профиль
  const asked = []
  const gh = { answers: [], user: { id: 42, login: 'octo-cat', avatar_url: 'https://avatars.githubusercontent.com/u/42?v=4', email: 'octo@example.com' }, disabled: false, down: false }
  const realFetch = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input)
    asked.push(url)
    if (gh.down) return new Response('<html>нет</html>', { status: 502 })
    if (url === 'https://github.com/login/device/code') {
      const form = new URLSearchParams(init.body)
      assert.equal(init.method, 'POST')
      assert.equal(init.headers.Accept, 'application/json')
      assert.equal(form.get('client_id'), 'gh-client')
      assert.equal(form.get('scope'), '', 'ни почты, ни репозиториев')
      if (gh.disabled) return Response.json({ error: 'device_flow_disabled' }, { status: 400 })
      return Response.json({ device_code: 'dev_code_12345', user_code: 'ABCD-1234', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 })
    }
    if (url === 'https://github.com/login/oauth/access_token') {
      const form = new URLSearchParams(init.body)
      assert.equal(form.get('client_id'), 'gh-client')
      assert.equal(form.get('device_code'), 'dev_code_12345')
      assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:device_code')
      return Response.json(gh.answers.length ? gh.answers.shift() : { access_token: 'gho_github_token', token_type: 'bearer', scope: '' })
    }
    if (url === 'https://api.github.com/user') {
      assert.equal(init.headers.Authorization, 'Bearer gho_github_token')
      assert.ok(init.headers['User-Agent'])
      return Response.json(gh.user)
    }
    return new Response('нет', { status: 404 })
  }
  const realNow = Date.now
  try {
    // Хранилище на экземпляр: 'auth' и gh:<номер>
    const objects = new Map()
    const env = { GITHUB_CLIENT_ID: 'gh-client' }
    const instance = (name) => {
      if (!objects.has(name)) {
        const store = new Map()
        const storage = {
          alarm: null,
          get: async (k) => (Array.isArray(k) ? new Map(k.filter((x) => store.has(x)).map((x) => [x, store.get(x)])) : structuredClone(store.get(k))),
          put: async (k, v) => {
            for (const [a, b] of typeof k === 'object' ? Object.entries(k) : [[k, v]]) store.set(a, structuredClone(b))
          },
          delete: async (keys) => {
            for (const k of [].concat(keys)) store.delete(k)
          },
          deleteAll: async () => store.clear(),
          getAlarm: async () => storage.alarm,
          setAlarm: async (t) => {
            storage.alarm = t
          },
          deleteAlarm: async () => {
            storage.alarm = null
          },
        }
        objects.set(name, { store, storage, object: new Account({ storage }, env) })
      }
      return objects.get(name).object
    }
    env.ACCOUNT = { idFromName: (name) => name, get: instance }
    const go = async (method, path, { body, token, ip = '10.0.0.1', withEnv = env } = {}) => {
      const headers = { 'CF-Connecting-IP': ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      const init = { method, headers, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) }
      const response = await worker.fetch(new Request(`https://arcade.test${path}`, init), withEnv)
      return { status: response.status, body: await response.json() }
    }
    const enter = async (ip) => {
      assert.equal((await go('POST', '/api/auth/start', { ip })).status, 200)
      return go('POST', '/api/auth/poll', { body: { device: 'dev_code_12345' }, ip })
    }

    // Маршруты: чужой путь, не тот метод, вход не настроен, нет ключа
    assert.deepEqual(await go('GET', '/api/auth/nope'), { status: 404, body: { error: 'not found' } })
    assert.deepEqual(await go('GET', '/api/auth/start'), { status: 405, body: { error: 'method' } })
    assert.deepEqual(await go('POST', '/api/me'), { status: 405, body: { error: 'method' } })
    assert.deepEqual(await go('POST', '/api/auth/start', { withEnv: { ...env, GITHUB_CLIENT_ID: '' } }), { status: 503, body: { error: 'off' } })
    assert.deepEqual(await go('GET', '/api/me', { withEnv: { GITHUB_CLIENT_ID: 'gh-client' } }), { status: 503, body: { error: 'off' } })
    assert.deepEqual(await go('GET', '/api/me'), { status: 401, body: { error: 'auth' } })
    assert.deepEqual(await go('GET', '/api/me', { token: 'not-a-key' }), { status: 401, body: { error: 'auth' } })
    assert.equal(asked.length, 0)
    assert.equal(objects.size, 0, 'без ключа объекты не будятся')

    // Код для github.com/login/device
    assert.deepEqual(await go('POST', '/api/auth/start'), {
      status: 200, body: { device: 'dev_code_12345', code: 'ABCD-1234', url: 'https://github.com/login/device', interval: 5, expires: 900 },
    })
    // Пока человек не ввёл код — ждём; GitHub просит реже — новый интервал; отказ и истёкший код
    gh.answers.push({ error: 'authorization_pending' }, { error: 'slow_down', interval: 10 }, { error: 'access_denied' }, { error: 'expired_token' })
    const poll = (body = { device: 'dev_code_12345' }) => go('POST', '/api/auth/poll', { body })
    assert.deepEqual(await poll(), { status: 200, body: { status: 'pending' } })
    assert.deepEqual(await poll(), { status: 200, body: { status: 'pending', interval: 10 } })
    assert.deepEqual(await poll(), { status: 200, body: { status: 'denied' } })
    assert.deepEqual(await poll(), { status: 200, body: { status: 'expired' } })
    assert.deepEqual(await poll({ device: 'x' }), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await go('POST', '/api/auth/poll', { body: 'не json' }), { status: 400, body: { error: 'bad request' } })

    // Вошёл: свой ключ сессии; почта профиля и токен GitHub не сохраняются нигде
    const first = await poll()
    assert.equal(first.status, 200)
    assert.equal(first.body.status, 'ok')
    assert.deepEqual(first.body.user, { id: '42', login: 'octo-cat', avatar: 'https://avatars.githubusercontent.com/u/42?v=4' })
    const token1 = first.body.token
    assert.match(token1, /^42\.[A-Za-z0-9_-]{43}$/)
    const account42 = objects.get('gh:42')
    const saved = () => JSON.stringify([...objects.values()].map((o) => [...o.store]))
    assert.ok(!saved().includes('gho_github_token') && !saved().includes('octo@example.com'))
    assert.ok(!saved().includes(token1.split('.')[1]), 'ключ сессии — только хешем')
    assert.equal(account42.store.get('sessions').length, 1)
    assert.ok(account42.storage.alarm > Date.now() + IDLE_MS - 60_000, 'уборка через год')
    assert.equal(objects.get('auth').store.size, 0, 'экземпляр входа ничего не хранит')

    // Профиль и настройки
    assert.deepEqual(await go('GET', '/api/me', { token: token1 }), { status: 200, body: { user: first.body.user, settings: {} } })
    const at = Date.now()
    const put = (settings, token = token1) => go('PUT', '/api/me/settings', { body: { settings }, token })
    assert.deepEqual(await put({ lang: { v: 'en', at }, keys: { v: { up: 'w' }, at } }), {
      status: 200, body: { settings: { lang: { v: 'en', at }, keys: { v: { up: 'w' }, at } } },
    })
    // Второй компьютер: свой ключ, те же настройки; его старое значение не затирает новое
    const token2 = (await enter('10.0.0.2')).body.token
    assert.notEqual(token2, token1)
    const second = await put({ lang: { v: 'de', at: at - 1000 }, wide: { v: true, at: at + 5 } }, token2)
    assert.deepEqual(second.body.settings, { lang: { v: 'en', at }, keys: { v: { up: 'w' }, at }, wide: { v: true, at: at + 5 } })
    assert.deepEqual((await go('GET', '/api/me', { token: token1 })).body.settings, second.body.settings)
    // Неверные и слишком большие настройки
    assert.deepEqual(await put({ 'no such': { v: 1, at } }), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await go('PUT', '/api/me/settings', { body: '{', token: token1 }), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await put({ big: { v: 'x'.repeat(SETTINGS_MAX), at } }), { status: 413, body: { error: 'too big' } })
    assert.deepEqual(await put({ big: { v: 'x'.repeat(40 * 1024), at } }), { status: 413, body: { error: 'too big' } })
    assert.ok(!('big' in account42.store.get('settings')))

    // Ключ с чужим номером или выдуманный — 401
    assert.deepEqual(await go('GET', '/api/me', { token: `43.${token1.split('.')[1]}` }), { status: 401, body: { error: 'auth' } })
    assert.deepEqual(await go('GET', '/api/me', { token: `42.${KEY}` }), { status: 401, body: { error: 'auth' } })

    // Через двое суток: отметка «заходил» и уборка сдвигаются
    const seen = account42.store.get('seen')
    Date.now = () => realNow() + 2 * 86_400_000
    assert.equal((await go('GET', '/api/me', { token: token1 })).status, 200)
    assert.ok(account42.store.get('seen') > seen + 86_400_000)
    assert.ok(account42.storage.alarm > account42.store.get('seen') + IDLE_MS - 1)

    // Выйти на одном компьютере — другой остаётся
    assert.deepEqual(await go('POST', '/api/auth/logout', { token: token1 }), { status: 200, body: { ok: true } })
    assert.equal((await go('GET', '/api/me', { token: token1 })).status, 401)
    assert.equal((await go('GET', '/api/me', { token: token2 })).status, 200)

    // Больше MAX_SESSIONS компьютеров — самый старый вход выталкивается
    const tokens = [token2]
    for (let i = 0; i < MAX_SESSIONS; i++) tokens.push((await enter(`10.1.0.${i}`)).body.token)
    assert.equal(account42.store.get('sessions').length, MAX_SESSIONS)
    assert.equal((await go('GET', '/api/me', { token: tokens[0] })).status, 401)
    assert.equal((await go('GET', '/api/me', { token: tokens.at(-1) })).status, 200)

    // Картинка профиля не с CDN GitHub — без неё
    gh.user = { id: 7, login: 'other', avatar_url: 'https://evil.test/a.png' }
    const other = await enter('10.0.0.7')
    assert.deepEqual(other.body.user, { id: '7', login: 'other' })
    assert.deepEqual((await go('GET', '/api/me', { token: other.body.token })).body, { user: { id: '7', login: 'other' }, settings: {} })

    // @ник: сайт проверяет вид и запреты, ник один на весь сайт, без разницы в регистре; с LINK_SECRET — подпись
    // для сетевых игр
    env.LINK_SECRET = 'тестовый-секрет'
    const nick = (handle, token = tokens.at(-1)) => go('PUT', '/api/me/handle', { body: { handle }, token })
    assert.deepEqual(await nick('ab'), { status: 400, body: { error: 'invalid' } })
    assert.deepEqual(await nick(42), { status: 400, body: { error: 'invalid' } })
    assert.deepEqual(await go('PUT', '/api/me/handle', { body: '{', token: tokens.at(-1) }), { status: 400, body: { error: 'invalid' } })
    assert.deepEqual(await nick('claude_fan'), { status: 400, body: { error: 'reserved' } })
    assert.deepEqual(await go('PUT', '/api/me/handle', { body: { handle: 'octo_cat' } }), { status: 401, body: { error: 'auth' } })
    const named = await nick(' @Octo_Cat ')
    assert.equal(named.status, 200)
    assert.equal(named.body.handle, 'octo_cat')
    assert.equal(await ticketName(env.LINK_SECRET, named.body.ticket, Date.now()), 'octo_cat')
    const me42 = (await go('GET', '/api/me', { token: tokens.at(-1) })).body
    assert.equal(me42.handle, 'octo_cat')
    assert.equal(await ticketName(env.LINK_SECRET, me42.ticket, Date.now()), 'octo_cat')
    assert.equal(await ticketName('чужой', me42.ticket, Date.now()), null)
    const registry = objects.get('auth').store
    assert.deepEqual(registry.get('handle:octo_cat'), { id: '42' })
    assert.deepEqual(await nick('OCTO_CAT', other.body.token), { status: 409, body: { error: 'taken' } }, 'чужой ник, хоть и другими буквами')
    assert.equal((await nick('octo_cat')).status, 200, 'свой ник ещё раз — не смена')
    assert.equal(registry.get('owner:42').changes.length, 1)
    // Смена: прежний ник месяц держится за хозяином — чужому нельзя, хозяину можно вернуть
    assert.equal((await nick('octo_two')).body.handle, 'octo_two')
    assert.ok(registry.get('handle:octo_cat').until > Date.now() + HANDLE_HOLD_MS - 60_000)
    assert.deepEqual(await nick('octo_cat', other.body.token), { status: 409, body: { error: 'taken' } })
    assert.equal((await nick('octo_cat')).status, 200)
    assert.deepEqual(registry.get('handle:octo_cat'), { id: '42' })
    // Не больше HANDLE_CHANGES смен в сутки
    for (let i = registry.get('owner:42').changes.length; i < HANDLE_CHANGES; i++) assert.equal((await nick(`octo_${i}x`)).status, 200)
    assert.deepEqual(await nick('octo_more'), { status: 429, body: { error: 'often' } })
    // Через месяц: отпущенные ники свободны, смены — снова можно
    Date.now = () => realNow() + 2 * 86_400_000 + HANDLE_HOLD_MS + 1000
    assert.equal((await nick('octo_cat', other.body.token)).status, 200)
    assert.equal((await nick('octo_more')).status, 200)
    assert.equal((await go('GET', '/api/me', { token: other.body.token })).body.handle, 'octo_cat')

    // Удалить аккаунт — ничего не остаётся, а ник месяц держится, потом свободен
    assert.deepEqual(await go('DELETE', '/api/me', { token: tokens.at(-1) }), { status: 200, body: { ok: true } })
    assert.equal(account42.store.size, 0)
    assert.equal(account42.storage.alarm, null)
    assert.equal((await go('GET', '/api/me', { token: tokens.at(-1) })).status, 401)
    assert.equal(registry.get('owner:42'), undefined)
    assert.deepEqual(await nick('octo_more', other.body.token), { status: 409, body: { error: 'taken' } })
    Date.now = () => realNow() + 2 * 86_400_000 + 2 * HANDLE_HOLD_MS + 2000
    assert.equal((await nick('octo_more', other.body.token)).status, 200)
    delete env.LINK_SECRET

    // Будильник: год без входа — аккаунт удаляется, заходил — уборка переносится
    const account7 = objects.get('gh:7')
    await account7.object.alarm()
    assert.ok(account7.store.size > 0)
    assert.equal(account7.storage.alarm, account7.store.get('seen') + IDLE_MS)
    Date.now = () => account7.store.get('seen') + IDLE_MS
    await account7.object.alarm()
    assert.equal(account7.store.size, 0)
    Date.now = realNow

    // GitHub не принял приложение, GitHub не ответил
    gh.disabled = true
    assert.deepEqual(await go('POST', '/api/auth/start', { ip: '10.3.0.1' }), { status: 503, body: { error: 'app' } })
    gh.disabled = false
    gh.down = true
    assert.deepEqual(await go('POST', '/api/auth/start', { ip: '10.3.0.1' }), { status: 502, body: { error: 'upstream' } })
    assert.deepEqual(await go('POST', '/api/auth/poll', { body: { device: 'dev_code_12345' }, ip: '10.3.0.1' }), { status: 502, body: { error: 'upstream' } })
    gh.down = false

    // С одного адреса — не больше PER_IP_DAILY.starts кодов в сутки; адрес не хранится даже в памяти
    for (let i = 0; i < PER_IP_DAILY.starts; i++) assert.equal((await go('POST', '/api/auth/start', { ip: '10.9.9.9' })).status, 200)
    assert.deepEqual(await go('POST', '/api/auth/start', { ip: '10.9.9.9' }), { status: 429, body: { error: 'limit' } })
    assert.equal((await go('POST', '/api/auth/start', { ip: '10.8.8.8' })).status, 200, 'другой адрес — можно')
    assert.ok([...objects.get('auth').object.ips.keys()].every((k) => !k.includes('10.9.9.9')))
    assert.ok(!saved().includes('10.9.9.9'))
  } finally {
    globalThis.fetch = realFetch
    Date.now = realNow
  }
}

console.log('комнаты: все проверки прошли')
