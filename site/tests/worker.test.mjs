// Тест кода Worker'а без Cloudflare: маршруты и комната (Durable Object) на подставных объектах
import assert from 'node:assert/strict'
import worker, { Room, DoomRoom, EjsGame, Presence, BoardRoom, Limiter, MAX_PEERS, MAX_PER_IP, MAX_MESSAGE } from '../worker/index.js'

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
  await room.alarm()
  assert.equal(store.size, 0)
} finally {
  globalThis.Response = RealResponse
}
console.log('комнаты: все проверки прошли')
