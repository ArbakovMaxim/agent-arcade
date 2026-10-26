// Тест кода Worker'а без Cloudflare: маршруты и комната (Durable Object) на подставных объектах
import assert from 'node:assert/strict'
import fs from 'node:fs'
import worker, { Room, DoomRoom, EjsGame, Presence, BoardRoom, Discover, Twitch, Account, Limiter, MAX_PEERS, MAX_PER_IP, MAX_MESSAGE, ISOLATED_GAMES } from '../worker/index.js'

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

// --- Изоляция плеера (Warzone 2100) --------------------------------------------------------------------------------
{
  const env = { ASSETS: { fetch: async () => new Response('плеер', { headers: { 'Content-Type': 'text/html' } }) } }
  const go = (path) => worker.fetch(new Request(`https://arcade.test${path}`), env)
  const wz = await go('/?game=warzone2100')
  assert.equal(wz.headers.get('Cross-Origin-Opener-Policy'), 'same-origin')
  assert.equal(wz.headers.get('Cross-Origin-Embedder-Policy'), 'require-corp')
  assert.equal(wz.headers.get('Content-Type'), 'text/html', 'остальные заголовки статики — как были')
  assert.equal(await wz.text(), 'плеер')
  // Плеер с другой игрой и без игры — без изоляции: под COEP не загрузились бы внешние картинки и рамки
  for (const path of ['/?game=openttd', '/', '/?tab=web']) {
    const page = await go(path)
    assert.equal(page.headers.get('Cross-Origin-Embedder-Policy'), null, path)
    assert.equal(page.headers.get('Cross-Origin-Opener-Policy'), null, path)
  }
  // Список в коде — ровно игры с isolated: true в каталоге
  const catalog = JSON.parse(fs.readFileSync(new URL('../content/catalog.json', import.meta.url), 'utf8'))
  const games = Array.isArray(catalog) ? catalog : catalog.games
  assert.deepEqual([...ISOLATED_GAMES].sort(), games.filter((g) => g.isolated).map((g) => g.id).sort())
  // Корень должен доходить до кода: иначе Cloudflare отдал бы плеер сам, без заголовков изоляции
  const wrangler = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
  assert.match(wrangler.match(/"run_worker_first":\s*\[([^\]]*)\]/)[1], /"\/"/)
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
  // Целая комната может быть из одной сети (офис, общежитие): с одного адреса пускаем столько, сколько мест
  assert.ok(MAX_PER_IP >= MAX_PEERS, 'полная комната с одного адреса')
  for (let i = 0; i < MAX_PEERS - 1; i++) assert.equal((await room.fetch(from('1.2.3.4'))).status, 101)
  assert.equal((await room.fetch(from('5.6.7.8'))).status, 101, 'с другого — можно')
  // Потолок с одного адреса держит EmulatorJS: все комнаты игры в одном объекте, своего числа мест у него нет
  const ejsSockets = []
  const ejs = new EjsGame({ acceptWebSocket: (ws) => ejsSockets.push(ws), getWebSockets: () => ejsSockets.filter((ws) => !ws.closed), waitUntil: () => {} }, presenceEnv)
  const ejsFrom = (ip) => ({ url: 'https://ejs/net/ejs/123', headers: new Headers({ 'CF-Connecting-IP': ip }) })
  for (let i = 0; i < MAX_PER_IP; i++) assert.equal((await ejs.fetch(ejsFrom('1.2.3.4'))).status, 101)
  assert.equal((await ejs.fetch(ejsFrom('1.2.3.4'))).status, 429, 'сверх MAX_PER_IP с того же адреса — отказ')
  assert.equal((await ejs.fetch(ejsFrom('5.6.7.8'))).status, 101, 'с другого — можно')
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
  const { sessionId, mergeSettings, MAX_SESSIONS, MAX_KEYS, SETTINGS_MAX, PER_IP_DAILY, IDLE_MS, HANDLE_HOLD_MS, HANDLE_CHANGES, MAX_FRIENDS, MAX_INCOMING, REQUESTS_DAILY, DECLINE_HOLD_MS, normalHandle, handleProblem, ticketName, SENDS_PER_MINUTE, GROUPS_DAILY, MAX_CHATS, CHAT_TICKET_MS, CHAT_LINK_MS, MAX_OWNED, BOARDS_DAILY, SYNCS_PER_MINUTE, ONLINE_MS, PULSES_PER_MINUTE, INVITE_MS, INVITES_PER_MINUTE, PICKS_PER_MINUTE, WEB_MS, WEB_INTERVAL } = await import('../worker/account.js')
  const { Chat, KEEP, PAGE, MAX_TEXT, MAX_MEMBERS, MAX_NAME, AVATAR_COUNT, dmId, cleanText, groupName } = await import('../worker/chat.js')
  const { Reports, cleanReport, admins, MAX_REPORT, PER_SENDER_DAILY, DAILY, KEEP: REPORTS_KEEP } = await import('../worker/reports.js')
  const { Desk, DEFAULT_COLS, MAX_CARDS, MAX_TOTAL, MAX_TITLE, MAX_OPS, KEEP_GONE, MAX_MEMBERS: DESK_MEMBERS, cleanTitle, cleanCols } = await import('../worker/desk.js')
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
  const gh = { answers: [], user: { id: 42, login: 'octo-cat', avatar_url: 'https://avatars.githubusercontent.com/u/42?v=4', email: 'octo@example.com' }, disabled: false, down: false, revoked: [] }
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
      // Вход кнопкой: код со страницы возврата, секрет приложения и тот же адрес возврата
      if (form.has('code')) {
        assert.equal(form.get('client_secret'), 'gh-secret')
        assert.equal(form.get('redirect_uri'), 'https://arcade.test/api/auth/callback')
        const code = form.get('code')
        return Response.json(code === 'gh_code' ? { access_token: 'gho_github_token', token_type: 'bearer', scope: '' } : { error: code === 'bad_app' ? 'incorrect_client_credentials' : 'bad_verification_code' })
      }
      assert.equal(form.get('device_code'), 'dev_code_12345')
      assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:device_code')
      return Response.json(gh.answers.length ? gh.answers.shift() : { access_token: 'gho_github_token', token_type: 'bearer', scope: '' })
    }
    if (url === 'https://api.github.com/user') {
      assert.equal(init.headers.Authorization, 'Bearer gho_github_token')
      assert.ok(init.headers['User-Agent'])
      return Response.json(gh.user)
    }
    if (url === 'https://api.github.com/applications/gh-client/token') {
      assert.equal(init.method, 'DELETE')
      assert.equal(init.headers.Authorization, `Basic ${btoa('gh-client:gh-secret')}`)
      gh.revoked.push(JSON.parse(init.body).access_token)
      return new Response(null, { status: 204 })
    }
    return new Response('нет', { status: 404 })
  }
  const realNow = Date.now
  try {
    // Хранилище на экземпляр: 'auth', gh:<номер>, чаты — chat:<чат>, отчёты — reports:all и доски — desk:<доска>; у
    // Account — свои сокеты
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
          list: async ({ prefix = '' } = {}) => new Map([...store].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])),
          getAlarm: async () => storage.alarm,
          setAlarm: async (t) => {
            storage.alarm = t
          },
          deleteAlarm: async () => {
            storage.alarm = null
          },
        }
        const sockets = []
        const ctx = { storage, acceptWebSocket: (ws) => sockets.push(ws), getWebSockets: () => sockets.filter((ws) => !ws.closed) }
        const Kind = name.startsWith('chat:') ? Chat : name.startsWith('reports:') ? Reports : name.startsWith('desk:') ? Desk : Account
        objects.set(name, { store, storage, sockets, object: new Kind(ctx, env) })
      }
      return objects.get(name).object
    }
    env.ACCOUNT = { idFromName: (name) => name, get: instance }
    const go = async (method, path, { body, token, auth, ip = '10.0.0.1', withEnv = env } = {}) => {
      const headers = { 'CF-Connecting-IP': ip, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(auth ? { Authorization: auth } : {}) }
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

    // Аватарка — номер одной из AVATAR_COUNT готовых картинок или null (без неё): у себя и в реестре рядом с ником
    const avatar = (pic, token = tokens.at(-1)) => go('PUT', '/api/me/avatar', { body: { pic }, token })
    assert.deepEqual(await go('PUT', '/api/me/avatar', { body: { pic: 3 } }), { status: 401, body: { error: 'auth' } })
    assert.deepEqual(await go('GET', '/api/me/avatar', { token: tokens.at(-1) }), { status: 405, body: { error: 'method' } })
    for (const bad of [-1, AVATAR_COUNT, 1.5, '3', true, undefined]) assert.deepEqual(await avatar(bad), { status: 400, body: { error: 'invalid' } }, String(bad))
    assert.deepEqual(await go('PUT', '/api/me/avatar', { body: '{', token: tokens.at(-1) }), { status: 400, body: { error: 'invalid' } })
    assert.deepEqual(await avatar(0), { status: 200, body: { pic: 0 } }, 'ноль — тоже аватарка')
    assert.equal((await go('GET', '/api/me', { token: tokens.at(-1) })).body.pic, 0)
    assert.equal(registry.get('owner:42').pic, 0)
    assert.deepEqual(await avatar(7), { status: 200, body: { pic: 7 } })
    assert.equal(registry.get('owner:42').pic, 7)
    assert.deepEqual(await avatar(null), { status: 200, body: {} })
    assert.equal((await go('GET', '/api/me', { token: tokens.at(-1) })).body.pic, undefined)
    assert.ok(!('pic' in registry.get('owner:42')))
    assert.equal(registry.get('owner:42').handle, 'octo_more', 'ник на месте')
    // Не больше PICKS_PER_MINUTE смен в минуту
    account42.object.picks = Array(PICKS_PER_MINUTE).fill(Date.now())
    assert.deepEqual(await avatar(5), { status: 429, body: { error: 'often' } })
    assert.equal(registry.get('owner:42').pic, undefined)
    account42.object.picks = []

    // Друзья: заявка по точному нику, принять, отклонить, отменить, удалить; у 42 ник octo_more, у 7 — octo_cat
    const t42 = tokens.at(-1)
    const t7 = other.body.token
    const friendsOf = (token) => go('GET', '/api/me/friends', { token })
    const ask = (handle, token) => go('POST', '/api/me/friends', { body: { handle }, token })
    const accept = (id, token) => go('POST', '/api/me/friends/accept', { body: { id }, token })
    const unfriend = (id, token) => go('POST', '/api/me/friends/remove', { body: { id }, token })
    const circleOf = (id) => objects.get(`gh:${id}`).store.get('circle')
    const p42 = { id: '42', handle: 'octo_more' }
    const p7 = { id: '7', handle: 'octo_cat' }
    assert.deepEqual(await go('PUT', '/api/me/friends', { token: t42 }), { status: 405, body: { error: 'method' } })
    assert.deepEqual(await go('GET', '/api/me/friends'), { status: 401, body: { error: 'auth' } })
    assert.deepEqual(await go('POST', '/api/me/names', { body: { ids: ['42'] }, token: t42 }), { status: 404, body: { error: 'not found' } }, 'реестр снаружи не виден')
    assert.deepEqual(await friendsOf(t42), { status: 200, body: { friends: [], incoming: [], outgoing: [] } })
    // Без своего ника звать нельзя
    gh.user = { id: 9, login: 'third' }
    const t9 = (await enter('10.0.0.9')).body.token
    assert.deepEqual(await ask('octo_cat', t9), { status: 409, body: { error: 'nohandle' } })
    // Ник не того вида, свой, ничей
    assert.deepEqual(await ask('ab', t42), { status: 400, body: { error: 'invalid' } })
    assert.deepEqual(await go('POST', '/api/me/friends', { body: '{', token: t42 }), { status: 400, body: { error: 'invalid' } })
    assert.deepEqual(await ask(' @Octo_More ', t42), { status: 400, body: { error: 'self' } })
    assert.deepEqual(await ask('nobody_here', t42), { status: 404, body: { error: 'nobody' } })
    assert.deepEqual(await ask('octo_two', t42), { status: 404, body: { error: 'nobody' } }, 'отпущенный ник — ничей')
    // Заявка: у 42 — в «твоих заявках», у 7 — в «заявках тебе»; повтор — без второй заявки
    assert.deepEqual(await ask('OCTO_CAT', t42), { status: 200, body: { status: 'sent', friends: [], incoming: [], outgoing: [p7] } })
    assert.deepEqual((await friendsOf(t7)).body, { friends: [], incoming: [p42], outgoing: [] })
    const me7 = (await go('GET', '/api/me', { token: t7 })).body
    assert.equal(me7.requests, 1)
    assert.equal(me7.friends, undefined)
    assert.deepEqual((await ask('octo_cat', t42)).body, { status: 'sent', friends: [], incoming: [], outgoing: [p7] })
    assert.equal((await friendsOf(t7)).body.incoming.length, 1)
    // Принять: друзья с обеих сторон
    assert.deepEqual(await accept('x', t7), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await accept('9', t7), { status: 404, body: { error: 'gone' } }, 'заявки от 9 нет')
    assert.deepEqual(await accept('42', t7), { status: 200, body: { friends: [p42], incoming: [], outgoing: [] } })
    assert.deepEqual((await friendsOf(t42)).body, { friends: [p7], incoming: [], outgoing: [] })
    const counts42 = (await go('GET', '/api/me', { token: t42 })).body
    assert.equal(counts42.friends, 1)
    assert.equal(counts42.requests, undefined)
    assert.equal((await ask('octo_cat', t42)).body.status, 'friends', 'уже друзья')
    assert.equal((await accept('42', t7)).status, 200, 'принять ещё раз — ничего не меняется')
    // Сменил ник — дружба на месте, в списке новый ник
    assert.equal((await nick('octo_renamed', t42)).status, 200)
    assert.deepEqual((await friendsOf(t7)).body.friends, [{ id: '42', handle: 'octo_renamed' }])
    // Аватарка друга — в его строке списка
    assert.equal((await avatar(7, t42)).status, 200)
    assert.deepEqual((await friendsOf(t7)).body.friends, [{ id: '42', handle: 'octo_renamed', pic: 7 }])
    assert.equal((await avatar(null, t42)).status, 200)
    assert.deepEqual((await friendsOf(t7)).body.friends, [{ id: '42', handle: 'octo_renamed' }])
    assert.equal((await nick('octo_more', t42)).status, 200)

    // Отклонить — молча: у 42 заявка так и ждёт, новая заявка от 42 тихо не доходит
    assert.equal((await nick('third_one', t9)).status, 200)
    const p9 = { id: '9', handle: 'third_one' }
    assert.equal((await ask('third_one', t42)).body.status, 'sent')
    assert.deepEqual((await friendsOf(t9)).body.incoming, [p42])
    assert.deepEqual(await unfriend('42', t9), { status: 200, body: { friends: [], incoming: [], outgoing: [] } })
    assert.ok(circleOf(9).declined['42'])
    assert.deepEqual((await friendsOf(t42)).body.outgoing, [p9], 'отказ молча')
    assert.equal((await ask('third_one', t42)).body.status, 'sent')
    assert.deepEqual((await friendsOf(t9)).body.incoming, [], 'снова позвать — не доходит')
    // Передумал и позвал сам: у 42 его заявка ждала — сразу друзья, отказ забыт
    assert.deepEqual(await ask('octo_more', t9), { status: 200, body: { status: 'friends', friends: [p42], incoming: [], outgoing: [] } })
    assert.deepEqual((await friendsOf(t42)).body.friends, [p7, p9], 'друзья — по нику')
    assert.deepEqual(circleOf(9).declined, {})
    // Удалить друга — он пропадает с обеих сторон
    assert.deepEqual((await unfriend('42', t9)).body.friends, [])
    assert.deepEqual((await friendsOf(t42)).body.friends, [p7])
    // Отказ держится месяц, потом заявка снова доходит
    assert.equal((await ask('third_one', t42)).body.status, 'sent')
    await unfriend('42', t9)
    objects.get('gh:9').store.set('circle', { ...circleOf(9), declined: { 42: Date.now() - DECLINE_HOLD_MS - 1 } })
    assert.equal((await ask('third_one', t42)).body.status, 'sent')
    assert.deepEqual((await friendsOf(t9)).body.incoming, [p42])
    assert.deepEqual((await accept('42', t9)).body.friends, [p42])
    assert.deepEqual((await unfriend('9', t42)).body.friends, [p7])
    assert.deepEqual((await friendsOf(t9)).body, { friends: [], incoming: [], outgoing: [] })
    // Отменить свою заявку — у того она пропадает; отказом это не считается
    assert.deepEqual((await ask('octo_cat', t9)).body.outgoing, [p7])
    assert.deepEqual((await friendsOf(t7)).body.incoming, [p9])
    assert.deepEqual((await unfriend('7', t9)).body.outgoing, [])
    assert.deepEqual((await friendsOf(t7)).body.incoming, [])
    assert.deepEqual(circleOf(9).declined, {})
    assert.equal((await unfriend('12345', t9)).status, 200, 'чужой номер — просто список')
    assert.deepEqual(await unfriend(7, t9), { status: 400, body: { error: 'bad request' } })

    // У 7 заявок через край — «занят»; у 9 друзей через край — «полно». Номера без ника в реестре — удалённые
    // аккаунты: список их убирает
    const fakes = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(1000 + i), Date.now()]))
    objects.get('gh:7').store.set('circle', { ...circleOf(7), incoming: fakes(MAX_INCOMING) })
    assert.deepEqual(await ask('octo_cat', t9), { status: 409, body: { error: 'busy' } })
    assert.deepEqual((await friendsOf(t7)).body, { friends: [p42], incoming: [], outgoing: [] })
    assert.deepEqual(circleOf(7).incoming, {}, 'удалённые аккаунты ушли из круга')
    objects.get('gh:9').store.set('circle', { ...circleOf(9), friends: fakes(MAX_FRIENDS) })
    assert.deepEqual(await ask('octo_cat', t9), { status: 409, body: { error: 'full' } })
    assert.equal((await go('GET', '/api/me', { token: t9 })).body.friends, MAX_FRIENDS)
    assert.deepEqual((await friendsOf(t9)).body.friends, [])
    // Не больше REQUESTS_DAILY заявок в сутки, опечатки тоже считаются
    for (let i = circleOf(9).asked.length; i < REQUESTS_DAILY; i++) assert.equal((await ask(`no_one_${i}`, t9)).status, 404)
    assert.deepEqual(await ask('octo_cat', t9), { status: 429, body: { error: 'often' } })
    assert.deepEqual((await friendsOf(t7)).body.incoming, [])

    // В сети: мод отмечается, пока открыто меню; 42 и 7 — друзья, 9 — нет
    const pulse = (token, body = {}) => go('POST', '/api/me/pulse', { body, token })
    const invite = (body, token) => go('POST', '/api/me/invite', { body, token })
    const answerInvite = (from, token) => go('POST', '/api/me/invites/answer', { body: { from }, token })
    const brief7 = async () => (await pulse(t7)).body.invites.map(({ at, ...rest }) => rest)
    assert.deepEqual(await go('GET', '/api/me/pulse', { token: t42 }), { status: 405, body: { error: 'method' } })
    assert.deepEqual(await go('POST', '/api/me/pulse'), { status: 401, body: { error: 'auth' } })
    assert.deepEqual(await go('POST', '/api/me/online', { body: { id: '42', friends: [] }, token: t42 }), { status: 404, body: { error: 'not found' } }, 'отметки снаружи не видны')
    // 42 отметился первым — 7 ещё не в сети; отметился 7 — оба видят друг друга
    assert.deepEqual(await pulse(t42), { status: 200, body: { online: [], invites: [], unread: 0, requests: 0 } })
    assert.deepEqual((await pulse(t7)).body.online, ['42'])
    assert.deepEqual((await pulse(t42)).body.online, ['7'])
    assert.equal(objects.get('online').store.size, 0, 'отметки — только в памяти')
    // Дружба взаимная: у 9 в круге 42, но у 42 его нет — никто никого не видит
    const circle9 = circleOf(9)
    objects.get('gh:9').store.set('circle', { ...circle9, friends: { 42: Date.now() } })
    assert.deepEqual((await pulse(t9)).body.online, [])
    assert.deepEqual((await pulse(t42)).body.online, ['7'])
    // Прячется — друзья его не видят, а он их видит
    assert.deepEqual((await pulse(t7, { hidden: true })).body.online, ['42'])
    assert.deepEqual((await pulse(t42)).body.online, [])
    assert.deepEqual((await pulse(t7)).body.online, ['42'])
    // Не отмечался ONLINE_MS — не в сети; старые отметки убираются
    const presenceClock = Date.now
    Date.now = () => presenceClock() + ONLINE_MS
    assert.deepEqual((await pulse(t42)).body.online, [])
    assert.ok(!objects.get('online').object.seen.has('7'))

    // Позвать в игру: код комнаты — у настольных игр; у друга — от каждого друга последнее приглашение
    assert.deepEqual(await invite({ to: '7', game: 'chess', room: 'abc123def' }, t42), { status: 200, body: { ok: true } })
    assert.deepEqual(await brief7(), [{ from: '42', handle: 'octo_more', game: 'chess', room: 'abc123def' }])
    assert.equal((await invite({ to: '7', game: 'freedm' }, t42)).status, 200)
    assert.deepEqual(await brief7(), [{ from: '42', handle: 'octo_more', game: 'freedm' }])
    for (const body of [{ to: 7, game: 'chess' }, { to: '7' }, { to: '7', game: 'Chess!' }, { to: '7', game: 'chess', room: 'AB' }, { to: '7', game: 'chess', room: 1234567 }]) {
      assert.deepEqual(await invite(body, t42), { status: 400, body: { error: 'bad request' } }, JSON.stringify(body))
    }
    assert.deepEqual(await invite({ to: '9', game: 'freedm' }, t42), { status: 403, body: { error: 'friend' } })
    assert.deepEqual(await invite({ to: '42', game: 'freedm' }, t9), { status: 403, body: { error: 'friend' } }, 'у 42 он не в друзьях')
    assert.equal(objects.get('gh:42').store.get('invites'), undefined)
    objects.get('gh:9').store.set('circle', circle9)
    const handle7 = objects.get('gh:7').store.get('handle')
    objects.get('gh:7').store.delete('handle')
    assert.deepEqual(await invite({ to: '42', game: 'freedm' }, t7), { status: 409, body: { error: 'nohandle' } })
    objects.get('gh:7').store.set('handle', handle7)
    // Принял или «не сейчас» — приглашение уходит
    assert.deepEqual(await answerInvite('42', t7), { status: 200, body: { ok: true } })
    assert.deepEqual(await brief7(), [])
    assert.deepEqual(await answerInvite(42, t7), { status: 400, body: { error: 'bad request' } })
    // Приглашение живёт INVITE_MS
    assert.equal((await invite({ to: '7', game: 'go', room: 'room42go' }, t42)).status, 200)
    Date.now = () => presenceClock() + ONLINE_MS + INVITE_MS
    assert.deepEqual(await brief7(), [])
    assert.deepEqual(objects.get('gh:7').store.get('invites'), {})
    // Не больше PULSES_PER_MINUTE отметок и INVITES_PER_MINUTE приглашений в минуту
    for (let i = 0; i < PULSES_PER_MINUTE; i++) assert.equal((await pulse(t9)).status, 200)
    assert.deepEqual(await pulse(t9), { status: 429, body: { error: 'often' } })
    for (let i = 0; i < INVITES_PER_MINUTE; i++) assert.equal((await invite({ to: '7', game: 'reversi', room: `room${1000 + i}` }, t42)).status, 200)
    assert.deepEqual(await invite({ to: '7', game: 'reversi', room: 'roomlast' }, t42), { status: 429, body: { error: 'often' } })
    assert.deepEqual(await brief7(), [{ from: '42', handle: 'octo_more', game: 'reversi', room: 'room1009' }])
    await answerInvite('42', t7)
    Date.now = presenceClock

    // Чаты (worker/chat.js): без привязки CHAT — выключены
    assert.deepEqual(await go('GET', '/api/me/chats', { token: t7 }), { status: 503, body: { error: 'off' } })
    env.CHAT = { idFromName: (name) => `chat:${name}`, get: instance }
    const chatsOf = (token) => go('GET', '/api/me/chats', { token })
    const say = (chat, text, token) => go('POST', '/api/me/chats/send', { body: { chat, text }, token })
    const read = (chat, token, query = '') => go('GET', `/api/me/chats/messages?chat=${chat}${query}`, { token })
    const openWith = (id, token) => go('POST', '/api/me/chats/open', { body: { with: id }, token })
    const group = (body, token) => go('POST', '/api/me/chats/group', { body, token })
    const change = (body, token) => go('POST', '/api/me/chats/members', { body, token })
    const listOf = (id) => objects.get(`gh:${id}`).store.get('chats') ?? {}
    const brief = (chats) => chats.map(({ at, ...rest }) => rest)
    const rlo = String.fromCharCode(0x202e) // переворачивает направление текста
    assert.deepEqual([dmId('42', '7'), dmId('7', '42'), dmId('100', '99')], ['d7-42', 'd7-42', 'd99-100'])
    assert.deepEqual([cleanText(`  a\r\nb\rc\u0007${rlo} `), cleanText('\t'), cleanText(42)], ['a\nb\nc', '', ''])
    assert.deepEqual([groupName('  Клуб   по\nинтересам '), groupName('я'.repeat(MAX_NAME + 5)), groupName(null)], ['Клуб по интересам', 'я'.repeat(MAX_NAME), ''])

    // Чат двоих — только с другом; открыть ещё раз — тот же чат
    const dm = 'd7-42'
    assert.deepEqual(await openWith('12345', t42), { status: 403, body: { error: 'friend' } })
    assert.deepEqual(await openWith('42', t42), { status: 403, body: { error: 'friend' } })
    assert.deepEqual(await openWith(7, t42), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await openWith('7', t42), { status: 200, body: { chat: { id: dm, kind: 'dm', with: '7' } } })
    assert.deepEqual(await openWith('7', t42), { status: 200, body: { chat: { id: dm, kind: 'dm', with: '7' } } })
    assert.deepEqual(brief((await chatsOf(t42)).body.chats), [{ id: dm, kind: 'dm', with: '7', unread: 0 }])
    assert.deepEqual(listOf(7), {}, 'у друга чат появится с первым сообщением')

    // Сообщение — без пробелов по краям и знаков, переворачивающих текст; у друга оно непрочитанное, своё — прочитано
    const hello = await say(dm, `  Привет!\r\nКак дела? ${rlo} `, t42)
    assert.equal(hello.status, 200)
    assert.deepEqual({ ...hello.body.msg, at: 0 }, { s: 1, f: '42', t: 'Привет!\nКак дела?', at: 0 })
    const list7 = (await chatsOf(t7)).body
    assert.deepEqual(list7.me, p7)
    assert.deepEqual(brief(list7.chats), [{ id: dm, kind: 'dm', with: '42', unread: 1, last: { f: '42', t: 'Привет! Как дела?' } }])
    assert.deepEqual([list7.names, list7.unread], [{ 42: 'octo_more' }, 1])
    assert.equal((await go('GET', '/api/me', { token: t7 })).body.unread, 1)
    assert.deepEqual(await go('GET', '/api/me/chats/unread', { token: t7 }), { status: 200, body: { unread: 1 } })
    assert.equal((await chatsOf(t42)).body.unread, 0)
    // Прочитать: переписка, участники и ники; без before чат становится прочитанным
    const seen7 = (await read(dm, t7)).body
    assert.deepEqual({ ...seen7, messages: seen7.messages.map((m) => [m.s, m.f, m.t]) }, {
      me: p7, chat: { id: dm, kind: 'dm', members: ['7', '42'], last: 1, with: '42' }, messages: [[1, '42', 'Привет!\nКак дела?']], first: 1, names: { 7: 'octo_cat', 42: 'octo_more' }, unread: 0,
    })
    assert.equal((await go('GET', '/api/me', { token: t7 })).body.unread, undefined)
    // Ответ; новые — после after
    assert.equal((await say(dm, 'Отлично', t7)).body.msg.s, 2)
    assert.deepEqual((await read(dm, t42, '&after=1')).body.messages.map((m) => [m.s, m.f, m.t]), [[2, '7', 'Отлично']])
    assert.equal(listOf(42)[dm].read, 2)
    // Аватарки: своя — в me, собеседников и авторов — в pics; номер 0 — тоже аватарка
    assert.equal((await avatar(0, t7)).status, 200)
    assert.equal((await avatar(7, t42)).status, 200)
    const withPics = (await chatsOf(t7)).body
    assert.deepEqual([withPics.me, withPics.pics], [{ ...p7, pic: 0 }, { 7: 0, 42: 7 }], 'последнее в чате — от самого 7')
    const readPics = (await read(dm, t42)).body
    assert.deepEqual([readPics.me, readPics.pics], [{ ...p42, pic: 7 }, { 7: 0, 42: 7 }])
    assert.equal((await avatar(null, t7)).status, 200)
    assert.equal((await avatar(null, t42)).status, 200)
    assert.equal((await chatsOf(t7)).body.pics, undefined, 'аватарок нет — поля нет')
    // Кто из друзей в сети — в списке чатов; страница только смотрит, сама человека «в сети» не отмечает
    const marks = objects.get('online').object.seen
    marks.clear()
    assert.equal((await chatsOf(t7)).body.online, undefined, 'никого нет — поля нет')
    assert.equal(marks.size, 0)
    marks.set('42', { at: Date.now(), friends: new Set(['7']) })
    assert.deepEqual((await chatsOf(t7)).body.online, ['42'])
    assert.deepEqual([...marks.keys()], ['42'])
    marks.clear()
    // Пустое, длинное, не того вида, не друг, чужой чат
    assert.deepEqual(await say(dm, ` \n${rlo} `, t42), { status: 400, body: { error: 'empty' } })
    assert.deepEqual(await say(dm, 42, t42), { status: 400, body: { error: 'empty' } })
    assert.deepEqual(await say(dm, 'x'.repeat(MAX_TEXT + 1), t42), { status: 400, body: { error: 'long' } })
    assert.deepEqual(await say('nope', 'привет', t42), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await go('POST', '/api/me/chats/send', { body: '{', token: t42 }), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await go('GET', '/api/me/chats/send', { token: t42 }), { status: 405, body: { error: 'method' } })
    assert.deepEqual(await say('d1-2', 'привет', t42), { status: 404, body: { error: 'gone' } })
    assert.deepEqual(await say('d42-12345', 'привет', t42), { status: 403, body: { error: 'friend' } })
    assert.deepEqual(await say(dm, 'и я', t9), { status: 404, body: { error: 'gone' } }, 'в чужой чат двоих не написать')
    assert.deepEqual(await read(dm, t9), { status: 404, body: { error: 'gone' } }, 'и не прочитать')
    assert.deepEqual(await read('nope', t42), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await read(dm, t42, '&after=-1'), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await read(dm, t42, '&before=x'), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await read(`g${'x'.repeat(16)}`, t42), { status: 404, body: { error: 'gone' } })
    const dmChat = objects.get(`chat:${dm}`)
    assert.equal(dmChat.store.get('meta').last, 2, 'отказы ничего не записали')
    const taken = await dmChat.object.fetch(new Request('https://chat/open', { method: 'POST', body: JSON.stringify({ chat: dm, by: '9', kind: 'dm', members: ['7', '9'] }) }))
    assert.deepEqual([taken.status, await taken.json()], [409, { error: 'taken' }])

    // Поправить своё сообщение: новый текст и e — когда; список чатов не двигается, в нём — новый текст последнего.
    // С edits= ответ после after добавляет поправленные раньше
    const edit = (body, token) => go('POST', '/api/me/chats/edit', { body, token })
    const unsay = (body, token) => go('POST', '/api/me/chats/delete', { body, token })
    const entry42 = listOf(42)[dm]
    const fixed = await edit({ chat: dm, s: 2, text: `  Отлично!${rlo} ` }, t7)
    assert.equal(fixed.status, 200)
    assert.deepEqual({ ...fixed.body.msg, at: 0, e: 0 }, { s: 2, f: '7', t: 'Отлично!', at: 0, e: 0 })
    assert.ok(fixed.body.msg.e >= fixed.body.msg.at)
    assert.deepEqual(listOf(42)[dm], { ...entry42, p: { f: '7', t: 'Отлично!' } })
    const afterEdit = (await read(dm, t42, '&after=2&edits=0')).body
    assert.deepEqual([afterEdit.chat.edits, afterEdit.messages.map((m) => [m.s, m.t, m.e > 0])], [1, [[2, 'Отлично!', true]]])
    assert.deepEqual((await read(dm, t42, '&after=2&edits=1')).body.messages, [])
    assert.deepEqual((await read(dm, t42, '&after=2')).body.messages, [], 'без edits — только новые')
    // Чужое, служебное, нет такого, не того вида, пустое и длинное — отказ; в чужом чате — его нет
    assert.deepEqual(await edit({ chat: dm, s: 1, text: 'чужое' }, t7), { status: 409, body: { error: 'edit' } })
    assert.deepEqual(await edit({ chat: dm, s: 99, text: 'нет' }, t7), { status: 409, body: { error: 'edit' } })
    assert.deepEqual(await unsay({ chat: dm, s: 1 }, t7), { status: 409, body: { error: 'edit' } })
    assert.deepEqual(await edit({ chat: dm, s: '2', text: 'да' }, t7), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await edit({ chat: dm, s: 2, text: ' ' }, t7), { status: 400, body: { error: 'empty' } })
    assert.deepEqual(await edit({ chat: dm, s: 2, text: 'x'.repeat(MAX_TEXT + 1) }, t7), { status: 400, body: { error: 'long' } })
    assert.deepEqual(await unsay({ chat: dm, s: 2 }, t9), { status: 404, body: { error: 'gone' } })
    assert.deepEqual(await read(dm, t42, '&edits=x'), { status: 400, body: { error: 'bad request' } })
    assert.equal(dmChat.store.get('meta').edits, 1, 'отказы ничего не записали')
    // Удалить: остаётся { s, f, at, d } без текста. Удалили непрочитанное, а дальше читать нечего — чат прочитан; в
    // списке — последнее неудалённое
    assert.equal((await say(dm, 'Опечатка', t7)).body.msg.s, 3)
    assert.equal(listOf(42)[dm].last - listOf(42)[dm].read, 1)
    const gone3 = await unsay({ chat: dm, s: 3 }, t7)
    assert.deepEqual({ ...gone3.body.msg, at: 0, d: 0 }, { s: 3, f: '7', at: 0, d: 0 })
    assert.deepEqual([listOf(42)[dm].last, listOf(42)[dm].read, listOf(42)[dm].p], [3, 3, { f: '7', t: 'Отлично!' }])
    assert.equal((await unsay({ chat: dm, s: 2 }, t7)).status, 200)
    assert.deepEqual([listOf(42)[dm].p, listOf(7)[dm].p], [{ f: '42', t: 'Привет! Как дела?' }, { f: '42', t: 'Привет! Как дела?' }])
    assert.deepEqual(brief((await chatsOf(t42)).body.chats), [{ id: dm, kind: 'dm', with: '7', unread: 0, last: { f: '42', t: 'Привет! Как дела?' } }])
    assert.deepEqual((await read(dm, t42, '&after=3&edits=2')).body.messages.map((m) => [m.s, m.t, m.d > 0]), [[2, undefined, true]])
    assert.deepEqual((await read(dm, t7)).body.messages.map((m) => [m.s, m.d > 0]), [[1, false], [2, true], [3, true]])
    assert.deepEqual(await edit({ chat: dm, s: 3, text: 'вернуть' }, t7), { status: 409, body: { error: 'edit' } }, 'удалённое не поправить')
    assert.deepEqual(await unsay({ chat: dm, s: 3 }, t7), { status: 409, body: { error: 'edit' } })

    // Не больше SENDS_PER_MINUTE сообщений в минуту — правки и удаления тоже считаются
    account42.object.sends = Array(SENDS_PER_MINUTE).fill(Date.now())
    assert.deepEqual(await say(dm, 'ещё', t42), { status: 429, body: { error: 'often' } })
    assert.deepEqual(await edit({ chat: dm, s: 1, text: 'ещё' }, t42), { status: 429, body: { error: 'often' } })
    account42.object.sends = Array(SENDS_PER_MINUTE).fill(Date.now() - 60_000)
    assert.equal((await say(dm, 'ещё', t42)).body.msg.s, 4)

    // В чате хранятся последние KEEP сообщений, старые уходят пачками по 100; читать — по PAGE, раньше — с before
    const dmMeta = await dmChat.storage.get('meta')
    while (dmMeta.last <= KEEP + 100) await dmChat.object.append(dmMeta, { f: '7', t: `№${dmMeta.last + 1}` })
    assert.equal(dmChat.store.size, KEEP + 1)
    assert.deepEqual([dmMeta.first, dmMeta.last], [102, KEEP + 101])
    const page = (await read(dm, t42)).body
    assert.deepEqual([page.messages.length, page.messages[0].s, page.messages.at(-1).s, page.first], [PAGE, KEEP + 102 - PAGE, KEEP + 101, 102])
    assert.deepEqual((await read(dm, t42, '&before=112')).body.messages.map((m) => m.s), Array.from({ length: 10 }, (_, i) => 102 + i))

    // Чатов в списке больше MAX_CHATS — забывается самый тихий
    const quiet = (i) => `g${String(i).padStart(16, '0')}`
    objects.get('gh:7').store.set('chats', { ...listOf(7), ...Object.fromEntries(Array.from({ length: MAX_CHATS }, (_, i) => [quiet(i), { kind: 'group', name: 'Тихая', last: 1, read: 1, at: i + 1 }])) })
    assert.equal((await say(dm, 'Тихо тут', t42)).status, 200)
    assert.equal(Object.keys(listOf(7)).length, MAX_CHATS)
    assert.ok(listOf(7)[dm] && !listOf(7)[quiet(0)] && listOf(7)[quiet(1)])
    objects.get('gh:7').store.set('chats', { [dm]: listOf(7)[dm] })

    // Группы — из своих друзей, нужен свой ник. Теперь 9 дружит с 7 и 42
    const pair = (a, b, when) => {
      for (const [x, y] of [[a, b], [b, a]]) objects.get(`gh:${x}`).store.set('circle', { ...circleOf(x), friends: { ...circleOf(x).friends, [y]: when } })
    }
    objects.get('gh:9').store.set('circle', { ...circleOf(9), friends: {} })
    pair('9', '7', Date.now() - 2000)
    pair('9', '42', Date.now() - 1000)
    assert.deepEqual(await group({ name: ` \n${rlo}`, members: ['7'] }, t42), { status: 400, body: { error: 'name' } })
    assert.deepEqual(await group({ name: 'Клуб', members: ['7', '12345'] }, t42), { status: 403, body: { error: 'friend' } })
    assert.deepEqual(await group({ name: 'Клуб', members: [] }, t42), { status: 400, body: { error: 'empty' } })
    assert.deepEqual(await group({ name: 'Клуб', members: ['42'] }, t42), { status: 400, body: { error: 'empty' } })
    assert.deepEqual(await group({ name: 'Клуб', members: [7] }, t42), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await group({ name: 'Клуб' }, t42), { status: 400, body: { error: 'bad request' } })
    account42.store.delete('handle')
    assert.deepEqual(await group({ name: 'Клуб', members: ['7'] }, t42), { status: 409, body: { error: 'nohandle' } })
    account42.store.set('handle', 'octo_more')
    assert.equal(account42.store.get('made'), undefined, 'отказы не считаются')
    // Создал: первое сообщение — «создал», у остальных оно непрочитанное
    const created = await group({ name: '  Клуб   по\nинтересам ', members: ['7', '9', '7'] }, t42)
    const club = created.body.chat?.id
    assert.match(club, /^g[A-Za-z0-9_-]{16}$/)
    assert.deepEqual(created, { status: 200, body: { chat: { id: club, kind: 'group', name: 'Клуб по интересам', owner: '42', members: ['7', '9', '42'], last: 1 } } })
    assert.deepEqual(brief((await chatsOf(t9)).body.chats), [{ id: club, kind: 'group', name: 'Клуб по интересам', unread: 1, last: { f: '42', k: 'create', n: 'Клуб по интересам' } }])
    assert.equal(listOf(42)[club].read, 1)
    assert.equal((await say(club, 'Всем привет', t9)).body.msg.s, 2)
    assert.equal(listOf(7)[club].last, 2)
    // Менять группу может только хозяин; новое название — у всех в списке
    assert.deepEqual(await change({ chat: club, name: 'Наш' }, t9), { status: 403, body: { error: 'owner' } })
    assert.deepEqual(await change({ chat: club, name: ' ' }, t42), { status: 400, body: { error: 'name' } })
    assert.deepEqual(await change({ chat: club, add: [9] }, t42), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await change({ chat: dm, leave: true }, t42), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await change({ chat: club, add: ['12345'] }, t42), { status: 403, body: { error: 'friend' } })
    assert.deepEqual((await change({ chat: club, name: 'Клуб' }, t42)).body.chat, { id: club, kind: 'group', name: 'Клуб', owner: '42', members: ['7', '9', '42'], last: 3 })
    assert.equal(listOf(7)[club].name, 'Клуб')
    // Картинка группы — одна из AVATAR_COUNT, ставит хозяин; у всех в списке, в переписке — служебное сообщение
    assert.deepEqual(await change({ chat: club, pic: 3 }, t9), { status: 403, body: { error: 'owner' } })
    for (const bad of [-1, AVATAR_COUNT, '3', 1.5]) assert.deepEqual(await change({ chat: club, pic: bad }, t42), { status: 400, body: { error: 'bad request' } }, String(bad))
    assert.deepEqual((await change({ chat: club, pic: 3 }, t42)).body.chat, { id: club, kind: 'group', name: 'Клуб', owner: '42', members: ['7', '9', '42'], last: 4, pic: 3 })
    assert.equal(listOf(7)[club].pic, 3)
    assert.equal((await chatsOf(t9)).body.chats.find((c) => c.id === club).pic, 3)
    const pictured = (await read(club, t7)).body
    assert.deepEqual([pictured.chat.pic, { ...pictured.messages.at(-1), at: 0 }], [3, { s: 4, f: '42', k: 'pic', n: 3, at: 0 }])
    assert.equal((await change({ chat: club, pic: 3 }, t42)).body.chat.last, 4, 'та же картинка — без сообщения')
    // Убрать — null: снова буква названия
    const plain = (await change({ chat: club, pic: null }, t42)).body.chat
    assert.deepEqual([plain.pic, plain.last], [undefined, 5])
    assert.equal(listOf(7)[club].pic, undefined)
    assert.deepEqual({ ...(await read(club, t7)).body.messages.at(-1), at: 0 }, { s: 5, f: '42', k: 'pic', at: 0 })
    // Убрал — у того чата больше нет; вернул — он видит переписку с этого места. Себя хозяин не убирает
    assert.deepEqual((await change({ chat: club, remove: ['9', '42'] }, t42)).body.chat.members, ['7', '42'])
    assert.equal(listOf(9)[club], undefined)
    assert.deepEqual(await read(club, t9), { status: 404, body: { error: 'gone' } })
    assert.deepEqual(await say(club, 'А я?', t9), { status: 404, body: { error: 'gone' } })
    assert.deepEqual((await change({ chat: club, add: ['9'] }, t42)).body.chat.members, ['7', '9', '42'])
    const back9 = (await read(club, t9)).body
    assert.deepEqual([back9.first, back9.messages.map((m) => [m.s, m.f, m.k, m.o])], [7, [[7, '42', 'add', '9']]])
    // В группе не больше MAX_MEMBERS человек
    const clubChat = objects.get(`chat:${club}`)
    const crowd = Array.from({ length: MAX_MEMBERS - 3 }, (_, i) => String(2000 + i))
    for (const id of crowd) clubChat.store.get('meta').members[id] = 1
    const circle42 = circleOf(42)
    account42.store.set('circle', { ...circle42, friends: { ...circle42.friends, 11: Date.now() } })
    assert.deepEqual(await change({ chat: club, add: ['11'] }, t42), { status: 409, body: { error: 'full' } })
    account42.store.set('circle', circle42)
    for (const id of crowd) delete clubChat.store.get('meta').members[id]
    // Вышел хозяин — группа у того, кто в ней дольше; вышли все — группы нет
    assert.deepEqual(await change({ chat: club, leave: true }, t42), { status: 200, body: { ok: true } })
    assert.equal(listOf(42)[club], undefined)
    assert.deepEqual(await say(club, 'Я тут?', t42), { status: 404, body: { error: 'gone' } })
    const left = (await read(club, t7)).body
    assert.deepEqual([left.chat.owner, left.chat.members, left.messages.at(-1).f, left.messages.at(-1).k], ['7', ['7', '9'], '42', 'leave'])
    assert.deepEqual(await change({ chat: club, leave: true }, t7), { status: 200, body: { ok: true } })
    assert.equal(clubChat.store.get('meta').owner, '9')
    assert.deepEqual(await change({ chat: club, leave: true }, t9), { status: 200, body: { ok: true } })
    assert.equal(clubChat.store.size, 0)
    assert.deepEqual([listOf(7)[club], listOf(9)[club]], [undefined, undefined])
    assert.deepEqual(await change({ chat: club, leave: true }, t9), { status: 404, body: { error: 'gone' } })
    // Общий чат со всеми друзьями — all: true; групп в сутки не больше GROUPS_DAILY
    const everyone = (await group({ name: 'Все друзья', all: true }, t9)).body.chat
    const allChat = everyone.id
    assert.deepEqual(everyone, { id: allChat, kind: 'group', name: 'Все друзья', owner: '9', members: ['7', '9', '42'], last: 1 })
    objects.get('gh:9').store.set('made', Array(GROUPS_DAILY).fill(Date.now()))
    assert.deepEqual(await group({ name: 'Ещё', all: true }, t9), { status: 429, body: { error: 'often' } })

    // Билет страницы чата: на CHAT_TICKET_MS, из живой сессии, с ним — только чаты и список друзей
    const { ticket, until } = (await go('POST', '/api/me/chats/ticket', { token: t7 })).body
    assert.match(ticket, /^7\.\d{10}\.[0-9a-f]{12}\.[A-Za-z0-9_-]{22}$/)
    assert.ok(Math.abs(until * 1000 - (Date.now() + CHAT_TICKET_MS)) < 60_000)
    const [, , tPrefix, tSig] = ticket.split('.')
    const byTicket = { auth: `Chat ${ticket}` }
    for (const path of ['/api/me/chats', '/api/me/chats/unread', '/api/me/friends', `/api/me/chats/messages?chat=${dm}`]) assert.equal((await go('GET', path, byTicket)).status, 200, path)
    assert.equal((await go('POST', '/api/me/chats/send', { ...byTicket, body: { chat: dm, text: 'Со страницы' } })).status, 200)
    for (const [method, path] of [['GET', '/api/me'], ['PUT', '/api/me/settings'], ['PUT', '/api/me/handle'], ['POST', '/api/me/friends'], ['POST', '/api/me/chats/ticket'], ['POST', '/api/auth/logout'], ['DELETE', '/api/me']]) {
      assert.deepEqual(await go(method, path, byTicket), { status: 401, body: { error: 'auth' } }, path)
    }
    // Подпись испорчена, чужой номер, другой срок или сессия — нет
    for (const bad of [`7.${until}.${tPrefix}.${tSig[0] === 'A' ? 'B' : 'A'}${tSig.slice(1)}`, `42.${until}.${tPrefix}.${tSig}`, `7.${until + 1}.${tPrefix}.${tSig}`, `7.${until}.${'0'.repeat(12)}.${tSig}`]) {
      assert.deepEqual(await go('GET', '/api/me/chats', { auth: `Chat ${bad}` }), { status: 401, body: { error: 'auth' } }, bad)
    }
    // Код ссылки: ключ сессии и { link: true } — на CHAT_LINK_MS; один раз меняется на билет, больше с ним ничего нельзя
    const linkOf = async () => (await go('POST', '/api/me/chats/ticket', { token: t7, body: { link: true } })).body
    const linked = await linkOf()
    assert.match(linked.link, /^7\.\d{10}\.[0-9a-f]{12}\.[A-Za-z0-9_-]{22}$/)
    assert.equal(linked.ticket, undefined)
    // Два кода подряд — разные, хоть и в одну секунду: каждый годится один раз
    assert.notEqual((await linkOf()).link, (await linkOf()).link)
    assert.ok(Math.abs(linked.until * 1000 - (Date.now() + CHAT_LINK_MS)) < 5_000)
    // Код — не билет, билет — не код
    assert.equal((await go('GET', '/api/me/chats', { auth: `Chat ${linked.link}` })).status, 401)
    assert.equal((await go('POST', '/api/me/chats/ticket', { auth: `Link ${ticket}` })).status, 401)
    // Обмен: новый билет, годный для чатов; второй раз тот же код не годен; нового кода по коду не дают
    const traded = await go('POST', '/api/me/chats/ticket', { auth: `Link ${linked.link}` })
    assert.equal(traded.status, 200)
    assert.ok(Math.abs(traded.body.until * 1000 - (Date.now() + CHAT_TICKET_MS)) < 60_000)
    assert.equal((await go('GET', '/api/me/chats', { auth: `Chat ${traded.body.ticket}` })).status, 200)
    assert.deepEqual(await go('POST', '/api/me/chats/ticket', { auth: `Link ${linked.link}` }), { status: 401, body: { error: 'auth' } })
    const again = (await go('POST', '/api/me/chats/ticket', { auth: `Link ${(await linkOf()).link}`, body: { link: true } })).body
    assert.deepEqual([typeof again.ticket, again.link], ['string', undefined])
    // С кодом — только обмен; истёк — не годен; использованные коды забываются, когда истекут
    for (const [method, path] of [['GET', '/api/me/chats'], ['GET', '/api/me/friends'], ['POST', '/api/me/chats/send'], ['GET', '/api/me']]) {
      assert.equal((await go(method, path, { auth: `Link ${(await linkOf()).link}`, body: method === 'POST' ? { chat: dm, text: 'Нет' } : undefined })).status, 401, path)
    }
    const late = await linkOf()
    const linkClock = Date.now
    Date.now = () => late.until * 1000
    assert.equal((await go('POST', '/api/me/chats/ticket', { auth: `Link ${late.link}` })).status, 401)
    Date.now = () => late.until * 1000 + 1
    assert.equal((await go('POST', '/api/me/chats/ticket', { auth: `Link ${(await linkOf()).link}` })).status, 200)
    assert.equal(objects.get('gh:7').store.get('links').length, 1)
    Date.now = linkClock
    assert.deepEqual(await go('POST', '/api/me/chats/ticket', { token: t7, body: 'не json' }), { status: 400, body: { error: 'invalid' } })
    // Без LINK_SECRET билетов нет; истёк — тоже нет
    delete env.LINK_SECRET
    assert.deepEqual(await go('POST', '/api/me/chats/ticket', { token: t7 }), { status: 503, body: { error: 'off' } })
    assert.equal((await go('GET', '/api/me/chats', byTicket)).status, 401)
    env.LINK_SECRET = 'тестовый-секрет'
    const clock = Date.now
    Date.now = () => until * 1000
    assert.equal((await go('GET', '/api/me/chats', byTicket)).status, 401)
    Date.now = clock
    // Второй компьютер 7 — свой билет
    gh.user = { id: 7, login: 'other' }
    const t7b = (await enter('10.0.0.17')).body.token
    gh.user = { id: 9, login: 'third' }
    const ticketB = (await go('POST', '/api/me/chats/ticket', { token: t7b })).body.ticket
    assert.notEqual(ticketB.split('.')[2], tPrefix)

    // Живое соединение: WebSocket /net/chat, билет — подпротоколом. Node не создаёт ответ 101 — подменяем
    globalThis.Response = class extends RealResponse {
      constructor(body, init = {}) {
        if (init.status !== 101) super(body, init)
        else {
          super(null, { ...init, status: 200 })
          Object.defineProperty(this, 'status', { value: 101 })
          this.webSocket = init.webSocket
        }
      }
    }
    try {
      const connect = (protocols, headers = { Upgrade: 'websocket' }) =>
        worker.fetch(new Request('https://arcade.test/net/chat', { headers: { ...headers, ...(protocols ? { 'Sec-WebSocket-Protocol': protocols } : {}) } }), env)
      const box7 = objects.get('gh:7')
      assert.equal((await connect(`arcade-chat, ${ticket}`, {})).status, 426)
      assert.deepEqual([(await connect(ticket)).status, (await connect('arcade-chat')).status], [401, 401])
      assert.equal((await connect(`arcade-chat, ${ticket}`, { Upgrade: 'websocket', Origin: 'https://evil.test' })).status, 403)
      const live = await connect(`arcade-chat, ${ticket}`, { Upgrade: 'websocket', Origin: 'https://arcade.test' })
      assert.deepEqual([live.status, live.headers.get('Sec-WebSocket-Protocol'), live.webSocket instanceof FakeSocket], [101, 'arcade-chat', true])
      const first7 = box7.sockets.at(-1)
      assert.deepEqual(first7.attachment, { prefix: tPrefix, until: until * 1000 })
      // Новое сообщение — кадр сразу; на ping — pong
      assert.equal((await say(dm, 'Ты тут?', t42)).status, 200)
      const note = JSON.parse(first7.sent.at(-1))
      assert.deepEqual([note.type, note.chat, note.msg.f, note.msg.t], ['note', dm, '42', 'Ты тут?'])
      await box7.object.webSocketMessage(first7, 'ping')
      assert.equal(first7.sent.at(-1), 'pong')
      const bearer = await box7.object.fetch(new Request('https://account/socket', { headers: { Upgrade: 'websocket', Authorization: `Bearer ${t7}` } }))
      assert.equal(bearer.status, 426, 'сокет — только по билету')
      // Открытых страниц не больше пяти: шестая закрывает самую старую. Вышел на компьютере — его страницы закрыты
      for (let i = 0; i < 4; i++) assert.equal((await connect(`arcade-chat, ${ticketB}`)).status, 101)
      assert.equal((await connect(`arcade-chat, ${ticket}`)).status, 101)
      assert.ok(first7.closed)
      assert.equal(box7.object.ctx.getWebSockets().length, 5)
      assert.equal((await go('POST', '/api/auth/logout', { token: t7b })).status, 200)
      const open7 = box7.object.ctx.getWebSockets()
      assert.deepEqual(open7.map((ws) => ws.attachment.prefix), [tPrefix])
      assert.equal((await go('GET', '/api/me/chats', { auth: `Chat ${ticketB}` })).status, 401)
      // Билет истёк — со следующим сообщением соединение закрывается
      open7[0].attachment.until = Date.now() - 1
      assert.equal((await say(dm, 'Ау', t42)).status, 200)
      assert.deepEqual([open7[0].closed, open7[0].sent], [true, []])
    } finally {
      globalThis.Response = RealResponse
    }

    // Больше не друзья — чата двоих нет у обоих; общая группа остаётся
    const dm97 = dmId('9', '7')
    assert.equal((await say(dm97, 'Пока!', t9)).body.msg.s, 1)
    assert.equal(listOf(7)[dm97].last, 1)
    assert.deepEqual((await unfriend('7', t9)).body.friends, [p42])
    assert.deepEqual([objects.get(`chat:${dm97}`).store.size, listOf(7)[dm97], listOf(9)[dm97]], [0, undefined, undefined])
    assert.deepEqual(await say(dm97, 'Эй', t9), { status: 403, body: { error: 'friend' } })
    assert.deepEqual(Object.keys(objects.get(`chat:${allChat}`).store.get('meta').members), ['7', '9', '42'])

    // Отчёты об ошибках (worker/reports.js): текст без управляющих знаков, приметы — только знакомого вида
    assert.deepEqual(cleanReport({ text: '  Шашки\r\nзависли \u202e ', version: '0.25.0', surface: 'desktop', lang: 'ru', os: 'windows' }), {
      report: { text: 'Шашки\nзависли', version: '0.25.0', surface: 'desktop', lang: 'ru', os: 'windows' },
    })
    assert.deepEqual(cleanReport({ text: 'x', version: '1.2', surface: 'web', lang: 'rus', os: 'bsd', from: { id: '1' } }), { report: { text: 'x' } }, 'подпись — не из тела')
    assert.deepEqual([{ text: ' ' }, {}, null, { text: 5 }, { text: 'x'.repeat(MAX_REPORT + 1) }].map(cleanReport), [
      { error: 'empty' }, { error: 'empty' }, { error: 'empty' }, { error: 'empty' }, { error: 'long' },
    ])
    assert.deepEqual([...admins({ ADMINS: '42, 7 x 9a,,' })], ['42', '7'])
    assert.equal(admins({}).size, 0)
    // Отчёты выключены — 503; без входа — только POST
    assert.deepEqual(await go('POST', '/api/report', { body: { text: 'x' } }), { status: 503, body: { error: 'off' } })
    assert.deepEqual(await go('POST', '/api/me/report', { body: { text: 'x' }, token: t9 }), { status: 503, body: { error: 'off' } })
    env.REPORTS = { idFromName: (name) => `reports:${name}`, get: instance }
    const reportsStore = () => objects.get('reports:all').store
    const anon = (text, ip, extra = {}) => go('POST', '/api/report', { body: { text, ...extra }, ip })
    assert.deepEqual(await go('GET', '/api/report'), { status: 405, body: { error: 'method' } })
    assert.deepEqual(await anon('   ', '10.5.0.1'), { status: 400, body: { error: 'empty' } })
    assert.deepEqual(await go('POST', '/api/report', { body: 'x'.repeat(9000) }), { status: 413, body: { error: 'too big' } })
    // Без входа — без подписи, даже если её прислали; адрес не хранится
    assert.deepEqual(await anon('Doom не грузится', '10.5.0.1', { version: '0.25.0', surface: 'desktop', lang: 'ru', os: 'windows', from: { id: '9', handle: 'fake' } }), { status: 200, body: { ok: true, id: 1 } })
    const r1 = reportsStore().get('r:0000000001')
    assert.deepEqual({ ...r1, at: 0 }, { id: 1, at: 0, text: 'Doom не грузится', version: '0.25.0', surface: 'desktop', lang: 'ru', os: 'windows' })
    assert.ok(!saved().includes('10.5.0.1'))
    // Со входом — подписан номером и ником; с билетом чата — нельзя
    assert.deepEqual(await go('POST', '/api/me/report', { body: { text: 'Чат не открывается', surface: 'terminal' }, token: t42 }), { status: 200, body: { ok: true, id: 2 } })
    assert.deepEqual(reportsStore().get('r:0000000002').from, p42)
    assert.deepEqual(await go('POST', '/api/me/report', { body: { text: '' }, token: t9 }), { status: 400, body: { error: 'empty' } })
    const ticket9 = (await go('POST', '/api/me/chats/ticket', { token: t9 })).body.ticket
    assert.equal((await go('POST', '/api/me/report', { body: { text: 'x' }, auth: `Chat ${ticket9}` })).status, 401)
    // Список и закрытие — только админам; кто не админ, не видит и роли
    assert.deepEqual(await go('GET', '/api/me/reports', { token: t9 }), { status: 403, body: { error: 'admin' } })
    assert.deepEqual(await go('POST', '/api/me/reports/close', { body: { id: 1 }, token: t9 }), { status: 403, body: { error: 'admin' } })
    assert.equal((await go('GET', '/api/me', { token: t9 })).body.role, undefined)
    env.ADMINS = '9'
    assert.equal((await go('GET', '/api/me', { token: t9 })).body.role, 'admin')
    assert.equal((await go('GET', '/api/me/reports', { auth: `Chat ${ticket9}` })).status, 401, 'билет чата — не для отчётов')
    const listed = await go('GET', '/api/me/reports', { token: t9 })
    assert.deepEqual([listed.status, listed.body.reports.map((r) => r.id), listed.body.open], [200, [2, 1], 2], 'новые сверху')
    assert.deepEqual(await go('POST', '/api/me/reports/close', { body: { id: 'x' }, token: t9 }), { status: 400, body: { error: 'bad request' } })
    assert.deepEqual(await go('POST', '/api/me/reports/close', { body: { id: 1 }, token: t9 }), { status: 200, body: { ok: true, open: 1 } })
    assert.deepEqual(await go('POST', '/api/me/reports/close', { body: { id: 1 }, token: t9 }), { status: 404, body: { error: 'gone' } })
    assert.equal(reportsStore().has('r:0000000001'), false, 'закрытый удалён')
    // Лимиты суток: с одного адреса — PER_SENDER_DAILY, всем вместе — DAILY; наутро — заново
    for (let i = 1; i < PER_SENDER_DAILY; i++) assert.equal((await anon(`ещё ${i}`, '10.5.0.1')).status, 200)
    assert.deepEqual(await anon('ещё', '10.5.0.1'), { status: 429, body: { error: 'often' } })
    assert.equal((await anon('другой адрес', '10.5.0.2')).status, 200)
    for (let i = reportsStore().get('day').total; i < DAILY; i++) assert.equal((await anon('шквал', `10.6.${Math.floor(i / 200)}.${i % 200}`)).status, 200)
    assert.deepEqual(await anon('ещё', '10.7.0.1'), { status: 503, body: { error: 'full' } })
    const reportClock = Date.now
    Date.now = () => reportClock() + 86_400_000
    assert.equal((await anon('ещё', '10.5.0.1')).status, 200)
    Date.now = reportClock
    // Открытых хранится не больше KEEP: новый вытесняет самый старый
    const spare = instance('reports:keep')
    const spareStore = objects.get('reports:keep').store
    spareStore.set('meta', { seq: REPORTS_KEEP, open: Array.from({ length: REPORTS_KEEP }, (_, i) => i + 1) })
    spareStore.set('r:0000000001', { id: 1, at: 1, text: 'старый' })
    const added = await spare.fetch(new Request('https://reports/add', { method: 'POST', body: JSON.stringify({ report: { text: 'новый' }, sender: 'ip:10.0.0.1' }) }))
    assert.deepEqual(await added.json(), { ok: true, id: REPORTS_KEEP + 1 })
    assert.deepEqual([spareStore.get('meta').open.length, spareStore.get('meta').open[0], spareStore.has('r:0000000001')], [REPORTS_KEEP, 2, false])

    // Доски проектов (worker/desk.js): без привязки DESK — выключены; с билетом чата — нельзя
    assert.deepEqual(await go('GET', '/api/me/boards', { token: t42 }), { status: 503, body: { error: 'off' } })
    env.DESK = { idFromName: (name) => `desk:${name}`, get: instance }
    assert.equal((await go('GET', '/api/me/boards', { auth: `Chat ${ticket9}` })).status, 401)
    const boardsOf = (token) => go('GET', '/api/me/boards', { token })
    const newBoard = (body, token) => go('POST', '/api/me/boards/new', { body, token })
    const sync = (body, token) => go('POST', '/api/me/boards/sync', { body, token })
    const boardMembers = (body, token) => go('POST', '/api/me/boards/members', { body, token })
    const boardsListOf = (id) => objects.get(`gh:${id}`).store.get('boards') ?? {}
    const card = (id, title, col = 'todo', pos = 1, body = '') => ({ put: { id, title, body, col, pos } })
    assert.deepEqual([cleanTitle(`  План\nрелиза ${rlo} `), cleanTitle('я'.repeat(MAX_TITLE + 5)), cleanTitle(7)], ['План релиза', 'я'.repeat(MAX_TITLE), ''])
    assert.deepEqual(cleanCols([{ id: 'todo' }, { id: 'x1', name: ' Идеи ' }]), [{ id: 'todo' }, { id: 'x1', name: 'Идеи' }])
    assert.deepEqual([[], [{ id: 'a' }, { id: 'a' }], [{ id: 'A' }], [{ id: 'a', name: ' ' }], Array.from({ length: 9 }, (_, i) => ({ id: `c${i}` })), 'x'].map(cleanCols), [null, null, null, null, null, null])

    // Новая общая доска — сразу с другом; не друг — нельзя
    assert.deepEqual(await newBoard({ name: ' ' }, t42), { status: 400, body: { error: 'name' } })
    assert.deepEqual(await newBoard({ name: 'План', members: ['12345'] }, t42), { status: 403, body: { error: 'friend' } })
    const made = await newBoard({ name: 'План релиза', members: ['7', '42'] }, t42)
    const plan = made.body.board.id
    assert.match(plan, /^b[A-Za-z0-9_-]{16}$/)
    assert.deepEqual(made, { status: 200, body: { board: { id: plan, name: 'План релиза', owner: '42', members: ['7', '42'], cols: DEFAULT_COLS, rev: 2 }, cards: [], full: true, names: { 7: 'octo_cat', 42: 'octo_more' } } })
    const listed7 = await boardsOf(t7)
    assert.deepEqual([listed7.body.boards.map(({ at, ...b }) => b), listed7.body.names], [[{ id: plan, name: 'План релиза', owner: '42', rev: 2 }], { 42: 'octo_more' }])
    const deskStore = objects.get(`desk:${plan}`).store
    const deskMeta = () => deskStore.get('meta')
    const direct = (path, body) => objects.get(`desk:${plan}`).object.fetch(new Request(`https://desk${path}`, { method: 'POST', body: JSON.stringify({ board: plan, ...body }) }))
    assert.equal((await direct('/open', { by: '9', name: 'Чужая' })).status, 409, 'доска уже есть')
    assert.equal((await direct('/sync', { by: '12345', since: 0 })).status, 403, 'не участник')

    // Сверка: правки уходят, поменявшееся после since приходит; каждая правка — следующий номер
    const pushed = await sync({ board: plan, since: 2, ops: [card('pa1', 'Тесты'), card('pa2', 'Деплой', 'doing', 2, '- [ ] staging')] }, t42)
    assert.deepEqual([pushed.body.board.rev, pushed.body.cards.map((c) => [c.id, c.rev, c.col, c.by])], [4, [['pa1', 3, 'todo', '42'], ['pa2', 4, 'doing', '42']]])
    const pulled = await sync({ board: plan, since: 0, names: true }, t7)
    assert.deepEqual([pulled.body.full, pulled.body.cards.map((c) => c.title), pulled.body.names], [true, ['Тесты', 'Деплой'], { 7: 'octo_cat', 42: 'octo_more' }])
    // Перенести, удалить, новая карточка в незнакомой колонке — в первой; та же карточка ещё раз — не правка
    const moved = await sync({ board: plan, since: 4, ops: [card('pa1', 'Тесты', 'done', 1), { del: 'pa2' }, card('pa3', 'Куда?', 'nowhere', 5)] }, t7)
    assert.deepEqual(moved.body.cards.map((c) => [c.id, c.rev, c.gone ?? c.col]), [['pa1', 5, 'done'], ['pa2', 6, true], ['pa3', 7, 'todo']])
    assert.deepEqual((await sync({ board: plan, since: 7, ops: [card('pa1', 'Тесты', 'done', 1), { del: 'pa2' }, { del: 'nope' }] }, t7)).body, { board: { ...made.body.board, rev: 7 }, cards: [] })
    const back = await sync({ board: plan, since: 4 }, t42)
    assert.deepEqual([back.body.full, back.body.cards.map((c) => c.id), back.body.cards[1]], [undefined, ['pa1', 'pa2', 'pa3'], { id: 'pa2', rev: 6, gone: true }])
    // Название и колонки меняет любой участник; другие узнают о правке
    const renamed = await sync({ board: plan, since: 7, ops: [{ name: ' Релиз 1.0 ' }, { cols: [...DEFAULT_COLS, { id: 'ideas', name: 'Идеи' }] }] }, t7)
    assert.deepEqual([renamed.body.board.name, renamed.body.board.rev, renamed.body.board.cols.length], ['Релиз 1.0', 9, 4])
    assert.deepEqual([boardsListOf(42)[plan].name, boardsListOf(42)[plan].rev], ['Релиз 1.0', 9])
    for (const ops of [[{ put: { id: 'X!', title: 't', col: 'todo', pos: 1 } }], [card('ok', ' ')], [{ put: { id: 'ok', title: 't', col: 'todo', pos: 'x' } }], [{ name: '' }], [{ cols: [] }], [{ what: 1 }], 'x', Array(MAX_OPS + 1).fill({ del: 'pa1' })]) {
      assert.deepEqual(await sync({ board: plan, since: 9, ops }, t42), { status: 400, body: { error: 'bad request' } }, JSON.stringify(ops).slice(0, 60))
    }
    assert.equal(deskMeta().rev, 9, 'неверная пачка не пишет ничего')
    assert.deepEqual(await go('POST', '/api/me/boards/sync', { body: { board: plan, since: 9, ops: [card('pa9', 'x', 'todo', 1, 'x'.repeat(600 * 1024))] }, token: t42 }), { status: 413, body: { error: 'too big' } })
    // Не помещается — доска не берёт: карточек MAX_CARDS или знаков MAX_TOTAL; править старые можно
    deskStore.set('meta', { ...deskMeta(), cards: MAX_CARDS })
    const crowded = await sync({ board: plan, since: 9, ops: [card('pa4', 'Лишняя'), card('pa1', 'Тесты!', 'done', 1)] }, t42)
    assert.deepEqual([crowded.body.refused, crowded.body.cards.map((c) => c.id)], [['pa4'], ['pa1']])
    deskStore.set('meta', { ...deskMeta(), cards: 2, size: MAX_TOTAL - 5 })
    const heavy = await sync({ board: plan, since: 10, ops: [card('pa5', 'Пять!'), card('pa6', 'Шесть')] }, t42)
    assert.deepEqual([heavy.body.refused, heavy.body.cards.map((c) => c.id)], [['pa6'], ['pa5']])
    deskStore.set('meta', { ...deskMeta(), size: 16 })
    // Следов удаления больше KEEP_GONE + 100 — старые забываются; кто сверялся до них, получает доску целиком
    const before = deskMeta()
    for (let i = 0; i < KEEP_GONE + 100; i++) deskStore.set(`c:g${i}`, { id: `g${i}`, rev: before.rev + 1 + i, gone: true })
    deskStore.set('meta', { ...before, rev: before.rev + KEEP_GONE + 100, gone: before.gone + KEEP_GONE + 100 })
    const pruned = await sync({ board: plan, since: before.rev, ops: [{ del: 'pa5' }] }, t7)
    assert.deepEqual([pruned.body.full, pruned.body.cards.map((c) => c.id), deskMeta().gone, deskMeta().floor, deskStore.has('c:pa2')], [true, ['pa3', 'pa1'], KEEP_GONE, before.rev + 101, false])
    // Сверок в минуту — не больше SYNCS_PER_MINUTE
    const box7 = objects.get('gh:7').object
    for (let i = box7.syncs.length; i < SYNCS_PER_MINUTE; i++) assert.equal((await sync({ board: plan, since: deskMeta().rev }, t7)).status, 200)
    assert.deepEqual(await sync({ board: plan, since: deskMeta().rev }, t7), { status: 429, body: { error: 'often' } })
    box7.syncs = []

    // Участники: зовёт и убирает хозяин, только друзей; убранный теряет доску
    assert.deepEqual(await boardMembers({ board: plan, add: ['9'] }, t7), { status: 403, body: { error: 'friend' } })
    assert.deepEqual(await boardMembers({ board: plan, remove: ['42'] }, t7), { status: 403, body: { error: 'owner' } })
    assert.deepEqual((await boardMembers({ board: plan, add: ['9'] }, t42)).body.board.members, ['7', '9', '42'])
    assert.deepEqual((await boardsOf(t9)).body.boards.map((b) => b.id), [plan])
    assert.deepEqual((await boardMembers({ board: plan, remove: ['9'] }, t42)).body.board.members, ['7', '42'])
    assert.deepEqual([(await boardsOf(t9)).body.boards, await sync({ board: plan, since: 1 }, t9)], [[], { status: 404, body: { error: 'gone' } }])
    const fakeMembers = Object.fromEntries(Array.from({ length: DESK_MEMBERS - 2 }, (_, i) => [String(1000 + i), 1]))
    deskStore.set('meta', { ...deskMeta(), members: { ...deskMeta().members, ...fakeMembers } })
    assert.deepEqual(await boardMembers({ board: plan, add: ['9'] }, t42), { status: 409, body: { error: 'full' } })
    deskStore.set('meta', { ...deskMeta(), members: { 7: deskMeta().members[7], 42: deskMeta().members[42] } })
    // Вышел хозяин — доска у того, кто на ней дольше всех
    assert.deepEqual(await boardMembers({ board: plan, leave: true }, t42), { status: 200, body: { ok: true } })
    assert.deepEqual([deskMeta().owner, boardsListOf(7)[plan].owner, boardsListOf(42)[plan]], ['7', '7', undefined])

    // Своих общих досок — не больше MAX_OWNED, новых в сутки — не больше BOARDS_DAILY
    const twoCols = (await newBoard({ name: 'Вторая', members: ['7'], cols: [{ id: 'a', name: 'Надо' }, { id: 'b', name: 'Готово' }] }, t42)).body.board
    assert.deepEqual([twoCols.owner, twoCols.members, twoCols.cols], ['42', ['7', '42'], [{ id: 'a', name: 'Надо' }, { id: 'b', name: 'Готово' }]])
    const third = (await newBoard({ name: 'Третья' }, t42)).body.board.id
    const fourth = (await newBoard({ name: 'Четвёртая' }, t42)).body.board.id
    assert.equal(MAX_OWNED, 3)
    assert.deepEqual(await newBoard({ name: 'Пятая' }, t42), { status: 409, body: { error: 'many' } })
    objects.get('gh:7').store.set('boardsMade', Array(BOARDS_DAILY).fill(Date.now()))
    assert.deepEqual(await newBoard({ name: 'Ещё' }, t7), { status: 429, body: { error: 'often' } })
    // Удалить у всех — только хозяин
    assert.deepEqual(await go('POST', '/api/me/boards/delete', { body: { board: twoCols.id }, token: t7 }), { status: 403, body: { error: 'owner' } })
    assert.deepEqual(await go('POST', '/api/me/boards/delete', { body: { board: third }, token: t42 }), { status: 200, body: { ok: true } })
    assert.deepEqual([objects.get(`desk:${third}`).store.size, boardsListOf(42)[third]], [0, undefined])
    assert.deepEqual(await go('POST', '/api/me/boards/delete', { body: { board: third }, token: t42 }), { status: 404, body: { error: 'gone' } })

    // Удалить аккаунт — ничего не остаётся, а ник месяц держится, потом свободен
    assert.deepEqual(await go('DELETE', '/api/me', { token: tokens.at(-1) }), { status: 200, body: { ok: true } })
    assert.equal(account42.store.size, 0)
    assert.equal(account42.storage.alarm, null)
    assert.equal((await go('GET', '/api/me', { token: tokens.at(-1) })).status, 401)
    assert.equal(registry.get('owner:42'), undefined)
    assert.deepEqual(objects.get('gh:7').store.get('circle').friends, {}, 'удалённый аккаунт уходит у друзей')
    assert.deepEqual([objects.get(`chat:${dm}`).store.size, listOf(7)[dm]], [0, undefined], 'чата двоих с ним больше нет')
    assert.deepEqual(Object.keys(objects.get(`chat:${allChat}`).store.get('meta').members), ['7', '9'], 'из групп он вышел')
    assert.deepEqual([objects.get(`desk:${fourth}`).store.size, objects.get(`desk:${twoCols.id}`).store.get('meta').owner, boardsListOf(7)[twoCols.id].owner], [0, '7', '7'], 'из досок он вышел')
    assert.deepEqual([reportsStore().get('r:0000000002').text, reportsStore().get('r:0000000002').from], ['Чат не открывается', undefined], 'его отчёт — без подписи')
    delete env.ADMINS
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

    // Вход кнопкой через сайт: без секрета и адреса возврата выключен — мод войдёт по коду; копия ветки — тоже: GitHub
    // вернёт человека не на неё
    const webStart = () => go('POST', '/api/auth/web', { ip: '10.4.0.1' })
    assert.deepEqual(await webStart(), { status: 503, body: { error: 'off' } })
    env.GITHUB_CLIENT_SECRET = 'gh-secret'
    assert.deepEqual(await webStart(), { status: 503, body: { error: 'off' } }, 'без адреса возврата')
    env.GITHUB_CALLBACK = 'https://other.test/api/auth/callback'
    assert.deepEqual(await webStart(), { status: 503, body: { error: 'off' } }, 'адрес возврата — на другом сайте')
    env.GITHUB_CALLBACK = 'https://arcade.test/api/auth/callback'
    assert.deepEqual(await go('GET', '/api/auth/web'), { status: 405, body: { error: 'method' } })
    gh.user = { id: 77, login: 'web-user', avatar_url: 'https://avatars.githubusercontent.com/u/77?v=4', email: 'web@example.com' }
    const html = async (method, path, { body, lang = 'en-US,en;q=0.9' } = {}) => {
      const headers = { 'CF-Connecting-IP': '10.4.0.2', 'Accept-Language': lang, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }
      const response = await worker.fetch(new Request(`https://arcade.test${path}`, { method, headers, ...(body ? { body: new URLSearchParams(body).toString() } : {}) }), env)
      return { status: response.status, text: await response.text(), headers: response.headers }
    }
    const nonceOf = (text) => /name="nonce" value="([A-Za-z0-9_-]{43})"/.exec(text)?.[1]
    const webKeys = () => [...objects.get('auth').store.keys()].filter((k) => k.startsWith('web:'))
    const w1 = (await webStart()).body
    const authorize = new URL(w1.url)
    assert.equal(`${authorize.origin}${authorize.pathname}`, 'https://github.com/login/oauth/authorize')
    assert.deepEqual(Object.fromEntries(authorize.searchParams), { client_id: 'gh-client', redirect_uri: 'https://arcade.test/api/auth/callback', scope: '', state: w1.state })
    assert.match(w1.state, /^[A-Za-z0-9_-]{43}$/)
    assert.match(w1.key, /^[A-Za-z0-9_-]{43}$/)
    assert.ok(!w1.url.includes(w1.key), 'ключ мода в браузер не попадает')
    assert.match(w1.mark, /^[A-HJ-NP-Z2-9]{4}$/)
    assert.deepEqual([w1.interval, w1.expires], [WEB_INTERVAL, WEB_MS / 1000])
    assert.ok(!saved().includes(w1.key), 'ключ мода — только хешем')
    const wait = (flow, key = flow.key) => go('POST', '/api/auth/web/poll', { body: { state: flow.state, key }, ip: '10.4.0.1' })
    assert.deepEqual(await wait(w1), { status: 200, body: { status: 'pending' } })
    assert.deepEqual(await wait(w1, 'b'.repeat(43)), { status: 200, body: { status: 'expired' } }, 'по одному state из браузера не войти')
    assert.deepEqual(await go('POST', '/api/auth/web/poll', { body: { state: w1.state }, ip: '10.4.0.1' }), { status: 400, body: { error: 'bad request' } })

    // GitHub вернул человека: страница спрашивает, войти ли, и показывает код для сверки; токен GitHub сразу отозван
    const page1 = await html('GET', `/api/auth/callback?code=gh_code&state=${w1.state}`)
    assert.equal(page1.status, 200)
    assert.match(page1.headers.get('Content-Type'), /^text\/html/)
    assert.equal(page1.headers.get('X-Frame-Options'), 'DENY')
    assert.match(page1.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/)
    assert.equal(page1.headers.get('Referrer-Policy'), 'no-referrer')
    assert.equal(page1.headers.get('Cache-Control'), 'no-store')
    assert.ok(page1.text.includes('Sign in to Arcade as @web-user?') && page1.text.includes(w1.mark) && page1.text.includes('lang="en"'))
    assert.deepEqual(gh.revoked, ['gho_github_token'])
    assert.ok(!saved().includes('gho_github_token') && !saved().includes('web@example.com'))
    const nonce1 = nonceOf(page1.text)
    assert.ok(nonce1 && !saved().includes(nonce1), 'ключ формы — только хешем')
    assert.deepEqual(await wait(w1), { status: 200, body: { status: 'pending' } }, 'пока человек не нажал «Войти»')
    // Второй раз та же страница не открывается — знающий адрес не подтвердит чужой вход; подделанный ключ формы
    assert.equal((await html('GET', `/api/auth/callback?code=gh_code&state=${w1.state}`)).status, 400)
    assert.equal((await html('POST', '/api/auth/confirm', { body: { state: w1.state, nonce: 'c'.repeat(43), answer: 'yes' } })).status, 400)
    const yes = await html('POST', '/api/auth/confirm', { body: { state: w1.state, nonce: nonce1, answer: 'yes' } })
    assert.equal(yes.status, 200)
    assert.ok(yes.text.includes('Done'))
    assert.equal((await html('POST', '/api/auth/confirm', { body: { state: w1.state, nonce: nonce1, answer: 'yes' } })).status, 200, 'нажал дважды')
    const signedIn = await wait(w1)
    assert.equal(signedIn.body.status, 'ok')
    assert.deepEqual(signedIn.body.user, { id: '77', login: 'web-user', avatar: 'https://avatars.githubusercontent.com/u/77?v=4' })
    assert.match(signedIn.body.token, /^77\.[A-Za-z0-9_-]{43}$/)
    assert.equal((await go('GET', '/api/me', { token: signedIn.body.token })).status, 200)
    assert.deepEqual(await wait(w1), { status: 200, body: { status: 'expired' } }, 'ключ сессии выдаётся один раз')
    assert.deepEqual(webKeys(), [], 'вход забыт')

    // «Это не я» — по-русски; отказ на странице GitHub
    const w2 = (await webStart()).body
    const ru = await html('GET', `/api/auth/callback?code=gh_code&state=${w2.state}`, { lang: 'ru-RU,ru;q=0.9' })
    assert.ok(ru.text.includes('Войти в Arcade как @web-user?') && ru.text.includes('lang="ru"'))
    const no = await html('POST', '/api/auth/confirm', { body: { state: w2.state, nonce: nonceOf(ru.text), answer: 'no' }, lang: 'ru' })
    assert.ok(no.text.includes('Вход отменён'))
    assert.deepEqual(await wait(w2), { status: 200, body: { status: 'denied' } })
    const w3 = (await webStart()).body
    assert.equal((await html('GET', `/api/auth/callback?error=access_denied&state=${w3.state}`)).status, 200)
    assert.deepEqual(await wait(w3), { status: 200, body: { status: 'denied' } })

    // Старый код GitHub и чужой state — «ссылка не действует»; GitHub не принял секрет — мод узнает 'app'
    const w4 = (await webStart()).body
    assert.equal((await html('GET', `/api/auth/callback?code=old_code&state=${w4.state}`)).status, 400)
    assert.equal((await html('GET', `/api/auth/callback?code=gh_code&state=${'d'.repeat(43)}`)).status, 400)
    assert.equal((await html('GET', `/api/auth/callback?state=${w4.state}`)).status, 400)
    const broken = await html('GET', `/api/auth/callback?code=bad_app&state=${w4.state}`)
    assert.equal(broken.status, 503)
    assert.ok(broken.text.includes('sign in with a code'))
    assert.deepEqual(await wait(w4), { status: 503, body: { error: 'app' } })

    // Вход ждёт WEB_MS; брошенные убирает следующий новый вход — будильника у экземпляра 'auth' нет, его alarm()
    // удалил бы реестр ников
    const w5 = (await webStart()).body
    const w6 = (await webStart()).body
    Date.now = () => realNow() + WEB_MS + 1000
    assert.deepEqual(await wait(w5), { status: 200, body: { status: 'expired' } })
    assert.equal((await html('GET', `/api/auth/callback?code=gh_code&state=${w6.state}`)).status, 400)
    const w7 = (await webStart()).body
    assert.deepEqual(webKeys(), [`web:${w7.state}`])
    assert.equal(objects.get('auth').storage.alarm, null)
    Date.now = realNow
  } finally {
    globalThis.fetch = realFetch
    Date.now = realNow
  }
}

// --- Открытая библиотека: списки Gutenberg, Викитеки и LibriVox, файл книги Gutenberg (worker/books.js) ------------
{
  const { LANGS, SECTIONS, bookQuery } = await import('../worker/books.js')
  // Языки и разделы — одни у сервера, мода и окна (подписи разделов — у мода и окна одинаковые)
  const mod = await import('../../mod/hooks/books.js')
  assert.deepEqual(Object.keys(mod.BOOK_LANGS), Object.keys(LANGS))
  assert.deepEqual(Object.keys(mod.BOOK_SECTIONS), Object.keys(SECTIONS))
  const vm = await import('node:vm')
  const win = {}
  vm.runInNewContext(fs.readFileSync(new URL('../web/open-library.js', import.meta.url), 'utf8'), { window: win, URLSearchParams, location: { search: '' } })
  assert.deepEqual(JSON.parse(JSON.stringify(win.ArcadeOpenLibrary.LANGS)), Object.keys(LANGS))
  assert.deepEqual(JSON.parse(JSON.stringify(win.ArcadeOpenLibrary.SECTIONS)), mod.BOOK_SECTIONS)
  for (const text of ['  Остров   сокровищ! ', "O'Brien — «Мать»", 'a'.repeat(90) + ' b', '<script>x</script>']) {
    assert.equal(mod.bookQuery(text), bookQuery(text), `поиск чистится одинаково: ${text}`)
  }

  // Источники — подставные: Gutenberg (OPDS и EPUB), Wikidata (категории разделов), Викитека (поиск по названиям и по
  // категории), archive.org (поиск LibriVox). Украинских книг у Gutenberg одна — разделы на украинском идут из Викитеки
  const asked = []
  const down = new Set()
  const once = new Set() // сбиваются на одном запросе
  const entry = (id, title, author) => `<entry><id>https://www.gutenberg.org/ebooks/${id}.opds</id><title>${title}</title><content type="text">${author}</content></entry>`
  const opds = (more) =>
    `<feed><entry><id>https://www.gutenberg.org/ebooks/search.opds/?sort_order=title</id><title>Sort Alphabetically</title></entry>` +
    entry(1342, 'Pride and Prejudice', 'Austen, Jane') +
    entry(5160, 'Ivanhoe (Finnish)', 'Scott, Walter') +
    entry(76, 'Tom &amp; Huck', 'Twain, Mark') +
    (more ? '<link rel="next" href="x"/>' : '') +
    '</feed>'
  const pages = [
    { title: 'Остров сокровищ (Стивенсон)', index: 3 },
    { title: 'Остров сокровищ (Стивенсон)/Глава I', index: 1 },
    { title: 'ВЭ/ВТ/Остров', index: 2 },
    { title: 'Остров (значения)', index: 4, pageprops: { disambiguation: '' } },
    { title: 'Шаблон:Остров', index: 5 },
    { title: 'Остров сокровищ (1883)', index: 6 },
  ]
  const sitelinks = { Q3919902: 'Категорія:Романи', Q5611832: 'Категорія:Енциклопедії' }
  const shelfPages = [
    { title: 'Захар Беркут (Франко)/Розділ I', index: 2 },
    { title: 'Кайдашева сім\'я (Нечуй-Левицький)', index: 1 },
    { title: 'Захар Беркут (Франко)', index: 3 },
    { title: 'УРЕ/Роман', index: 4 },
    { title: 'Роман (значення)', index: 5, pageprops: { disambiguation: '' } },
  ]
  const docs = [
    { identifier: 'alice_librivox', title: "Alice's Adventures in Wonderland, by Lewis Carroll", creator: ['Lewis Carroll', 'Reader'] },
    { identifier: 'bad id/../x', title: 'Чужой' },
    { identifier: 'untitled_librivox' },
  ]
  const realFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    asked.push(url)
    if (down.has(url.hostname) || once.delete(url.hostname)) return new Response('нет', { status: 503 })
    if (url.pathname === '/ebooks/search.opds/' && url.searchParams.get('query').includes('l.uk')) {
      return new Response(`<feed>${url.searchParams.has('start_index') ? '' : entry(2600, 'Кобзар', 'Шевченко, Тарас')}</feed>`)
    }
    if (url.pathname === '/ebooks/search.opds/') return new Response(opds(url.searchParams.get('start_index') !== '976'))
    if (url.pathname === '/ebooks/35.epub.noimages') return new Response(new Uint8Array([80, 75, 3, 4]))
    if (url.pathname === '/ebooks/36.epub.noimages') return new Response('xx', { headers: { 'Content-Length': String(40 * 1024 * 1024) } })
    if (url.hostname === 'www.wikidata.org') {
      const site = url.searchParams.get('sitefilter')
      const link = (id) => (site === 'ukwikisource' && sitelinks[id] ? { [site]: { site, title: sitelinks[id] } } : {})
      return Response.json({ entities: Object.fromEntries(url.searchParams.get('ids').split('|').map((id) => [id, { id, sitelinks: link(id) }])) })
    }
    if (url.hostname.endsWith('.wikisource.org') && url.searchParams.get('gsrsearch').startsWith('deepcat:')) {
      return Response.json({ query: { pages: shelfPages }, continue: { gsroffset: 50 } })
    }
    if (url.hostname.endsWith('.wikisource.org')) return Response.json({ query: { pages } })
    if (url.pathname === '/advancedsearch.php') return Response.json({ response: { numFound: 30, docs } })
    return new Response('нет', { status: 404 })
  }
  try {
    const go = (path, init) => worker.fetch(new Request(`https://arcade.test${path}`, init), {})
    // Ошибки запроса
    for (const [path, status] of [
      ['/api/books/list?lang=ru', 400],
      ['/api/books/list?kind=book&lang=xx', 400],
      ['/api/books/list?kind=book&lang=ru&section=cooking', 400],
      ['/api/books/list?kind=book&lang=ru&q=%21a%21', 400],
      ['/api/books/file?gutenberg=../1', 400],
      ['/api/books/other', 404],
    ]) {
      assert.equal((await go(path)).status, status, path)
    }
    assert.equal((await go('/api/books/list?kind=book&lang=ru', { method: 'POST' })).status, 405)
    assert.equal(asked.length, 0, 'с плохим запросом к источникам не ходим')

    // Раздел книг: Gutenberg — тема и язык, по скачиваниям; страница — сдвиг на 25; название — без приписки языка
    let r = await go('/api/books/list?kind=book&lang=ru&section=poetry&page=2')
    assert.equal(r.status, 200)
    assert.match(r.headers.get('Cache-Control'), /max-age=21600/)
    let body = await r.json()
    assert.deepEqual(body, {
      items: [
        { ref: 'gutenberg:1342', source: 'gutenberg', title: 'Pride and Prejudice', author: 'Austen, Jane' },
        { ref: 'gutenberg:5160', source: 'gutenberg', title: 'Ivanhoe', author: 'Scott, Walter' },
        { ref: 'gutenberg:76', source: 'gutenberg', title: 'Tom & Huck', author: 'Twain, Mark' },
      ],
      more: true,
    })
    assert.equal(asked.length, 1, 'у Gutenberg в разделе есть книги — Викитеку не спрашиваем')
    assert.equal(asked[0].hostname, 'www.gutenberg.org')
    assert.equal(asked[0].searchParams.get('query'), 's.poetry l.ru !cat.audio', 'без аудиозаписей Gutenberg')
    assert.equal(asked[0].searchParams.get('sort_order'), 'downloads')
    assert.equal(asked[0].searchParams.get('start_index'), '26')
    // «Популярное» — без темы; страниц не больше 40
    asked.length = 0
    body = await (await go('/api/books/list?kind=book&lang=en&page=99')).json()
    assert.equal(asked[0].searchParams.get('query'), 'l.en !cat.audio')
    assert.equal(asked[0].searchParams.get('start_index'), '976')
    assert.equal(body.more, false)

    // У Gutenberg на языке нет и страницы книг: к ним — категория раздела в Викитеке этого языка. Её название — из
    // Wikidata (первый элемент раздела, у которого оно есть), энциклопедии и словари вычитаем; книги — по числу ссылок.
    // Главы — к книге, сокращения словарей и неоднозначности — мимо
    asked.length = 0
    r = await go('/api/books/list?kind=book&lang=uk&section=fiction')
    assert.match(r.headers.get('Cache-Control'), /max-age=21600/)
    const shelfItems = [
      { ref: "wikisource:uk:Кайдашева сім'я (Нечуй-Левицький)", source: 'wikisource', title: "Кайдашева сім'я", author: 'Нечуй-Левицький' },
      { ref: 'wikisource:uk:Захар Беркут (Франко)', source: 'wikisource', title: 'Захар Беркут', author: 'Франко' },
    ]
    assert.deepEqual(await r.json(), {
      items: [{ ref: 'gutenberg:2600', source: 'gutenberg', title: 'Кобзар', author: 'Шевченко, Тарас' }, ...shelfItems],
      more: true,
    })
    assert.deepEqual(asked.map((u) => u.hostname), ['www.gutenberg.org', 'www.wikidata.org', 'uk.wikisource.org'])
    assert.equal(asked[1].searchParams.get('ids'), [...SECTIONS.fiction.wikisource, 'Q5611832', 'Q7137948'].join('|'))
    assert.equal(asked[1].searchParams.get('sitefilter'), 'ukwikisource')
    assert.equal(asked[2].searchParams.get('gsrsearch'), 'deepcat:"Романи" -deepcat:"Енциклопедії"', 'словарей в этой Викитеке нет — не вычитаем')
    assert.equal(asked[2].searchParams.get('gsrsort'), 'incoming_links_desc')
    assert.deepEqual([asked[2].searchParams.get('gsrlimit'), asked[2].searchParams.get('gsroffset')], ['50', '0'])
    // Вторая страница: у Gutenberg пусто — следующие 50 страниц Викитеки
    asked.length = 0
    body = await (await go('/api/books/list?kind=book&lang=uk&section=fiction&page=2')).json()
    assert.deepEqual(body, { items: shelfItems, more: true })
    assert.equal(asked.at(-1).searchParams.get('gsroffset'), '50')
    // Категории раздела в Викитеке языка нет — только Gutenberg
    asked.length = 0
    body = await (await go('/api/books/list?kind=book&lang=uk&section=detective')).json()
    assert.deepEqual([body.items.length, body.more], [1, false])
    assert.deepEqual(asked.map((u) => u.hostname), ['www.gutenberg.org', 'www.wikidata.org'])
    // Викитека не ответила: книги Gutenberg отдаём, но неполный список не кешируем; без книг Gutenberg — ошибка
    const stored = []
    globalThis.caches = { default: { match: async () => undefined, put: async (key) => void stored.push(key.url) } }
    down.add('uk.wikisource.org')
    r = await go('/api/books/list?kind=book&lang=uk&section=fiction')
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('Cache-Control'), 'no-store')
    assert.deepEqual((await r.json()).items.map((i) => i.ref), ['gutenberg:2600'])
    assert.equal((await go('/api/books/list?kind=book&lang=uk&section=fiction&page=2')).status, 502)
    assert.deepEqual(stored, [], 'ни неполный список, ни ошибку не кешируем')
    down.clear()
    await go('/api/books/list?kind=book&lang=uk&section=fiction')
    assert.equal(stored.length, 1, 'полный список — в кеш')
    delete globalThis.caches

    // Поиск книги: Gutenberg и Викитека того же языка; главы — к книге, словари и неоднозначности — мимо
    asked.length = 0
    body = await (await go(`/api/books/list?kind=book&lang=ru&q=${encodeURIComponent('  Остров   сокровищ! ')}`)).json()
    assert.equal(asked.find((u) => u.hostname === 'www.gutenberg.org').searchParams.get('query'), 'Остров сокровищ l.ru !cat.audio')
    const wiki = asked.find((u) => u.hostname === 'ru.wikisource.org')
    assert.equal(wiki.searchParams.get('gsrsearch'), 'Остров сокровищ')
    assert.deepEqual(body.items.slice(3), [
      { ref: 'wikisource:ru:Остров сокровищ (Стивенсон)', source: 'wikisource', title: 'Остров сокровищ', author: 'Стивенсон' },
      { ref: 'wikisource:ru:Остров сокровищ (1883)', source: 'wikisource', title: 'Остров сокровищ (1883)', author: '' },
    ])
    // Вторая страница поиска — только Gutenberg
    asked.length = 0
    await go('/api/books/list?kind=book&lang=ru&q=Остров&page=2')
    assert.deepEqual(asked.map((u) => u.hostname), ['www.gutenberg.org'])
    // Gutenberg не ответил: в поиске и в разделе хватит Викитеки (но такой список не кешируем); на второй странице
    // поиска и в разделе, где у Викитеки нет категории, — ошибка
    down.add('www.gutenberg.org')
    r = await go('/api/books/list?kind=book&lang=uk&section=fiction&page=2')
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('Cache-Control'), 'no-store')
    body = await r.json()
    assert.deepEqual([body.items.map((i) => i.title), body.more], [["Кайдашева сім'я", 'Захар Беркут'], true])
    r = await go('/api/books/list?kind=book&lang=ru&q=Остров')
    assert.equal(r.headers.get('Cache-Control'), 'no-store')
    body = await r.json()
    assert.deepEqual([body.items.length, body.more], [2, false])
    assert.equal((await go('/api/books/list?kind=book&lang=ru&q=Остров&page=2')).status, 502)
    r = await go('/api/books/list?kind=book&lang=ru&section=fiction')
    assert.equal(r.status, 502)
    assert.equal(r.headers.get('Cache-Control'), null, 'ошибку не кешируем')
    down.clear()
    // Сбой на одном запросе — источник спрашиваем второй раз, человек получает список
    asked.length = 0
    once.add('www.gutenberg.org')
    r = await go('/api/books/list?kind=book&lang=fr&section=drama')
    assert.equal(r.status, 200)
    assert.deepEqual(asked.map((u) => u.hostname), ['www.gutenberg.org', 'www.gutenberg.org'])

    // Аудиокниги: LibriVox на archive.org — язык как его пишет archive.org, раздел — темы, «, by автор» убран
    asked.length = 0
    body = await (await go('/api/books/list?kind=audio&lang=de&section=detective')).json()
    assert.equal(
      asked[0].searchParams.get('q'),
      'collection:librivoxaudio AND language:("ger" OR "deu" OR "German") AND subject:("mystery" OR "detective" OR "crime" OR "sherlock holmes")',
    )
    assert.equal(asked[0].searchParams.get('sort[]'), 'downloads desc')
    assert.deepEqual(asked[0].searchParams.getAll('fl[]'), ['identifier', 'title', 'creator'])
    assert.deepEqual(body, {
      items: [{ ref: 'librivox:alice_librivox', source: 'librivox', title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll, Reader' }],
      more: true,
    })
    // Поиск аудио — по названию и автору; дефис в начале слова — не «без этого слова»
    asked.length = 0
    body = await (await go('/api/books/list?kind=audio&lang=en&q=-Sherlock&page=2')).json()
    assert.equal(asked[0].searchParams.get('q'), 'collection:librivoxaudio AND language:("eng" OR "English") AND (title:(Sherlock) OR creator:(Sherlock))')
    assert.equal(asked[0].searchParams.get('page'), '2')
    assert.equal(body.more, false, '30 найдено — второй страницы хватит')

    // Файл книги Gutenberg: EPUB без картинок через сервер; нет книги — 404; больше 30 МБ — 413
    asked.length = 0
    r = await go('/api/books/file?gutenberg=35')
    assert.equal(r.status, 200)
    assert.equal(asked[0].href, 'https://www.gutenberg.org/ebooks/35.epub.noimages')
    assert.equal(r.headers.get('Content-Type'), 'application/epub+zip')
    assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [80, 75, 3, 4])
    assert.equal((await go('/api/books/file?gutenberg=99999')).status, 404)
    assert.equal((await go('/api/books/file?gutenberg=36')).status, 413)
    down.add('www.gutenberg.org')
    assert.equal((await go('/api/books/file?gutenberg=35')).status, 502)
  } finally {
    globalThis.fetch = realFetch
    delete globalThis.caches
  }
}

// Доска проектов: два мода (их блокноты и сверка — mod/hooks/notes.js и desks.js) сверяются через настоящую Desk
{
  const { Desk } = await import('../worker/desk.js')
  const notesM = await import('../../mod/hooks/notes.js')
  const desks = await import('../../mod/hooks/desks.js')
  const mem = new Map()
  const storage = {
    get: async (k) => (Array.isArray(k) ? new Map(k.filter((x) => mem.has(x)).map((x) => [x, structuredClone(mem.get(x))])) : structuredClone(mem.get(k))),
    put: async (k, v) => {
      for (const [a, b] of typeof k === 'object' ? Object.entries(k) : [[k, v]]) mem.set(a, structuredClone(b))
    },
    list: async ({ prefix = '' } = {}) => new Map([...mem].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])),
    delete: async (keys) => {
      for (const k of [].concat(keys)) mem.delete(k)
    },
    deleteAll: async () => mem.clear(),
  }
  const desk = new Desk({ storage }, { ACCOUNT: { idFromName: (name) => name, get: () => ({ fetch: async () => Response.json({ ok: true }) }) } })
  const call = async (path, body) => {
    const r = await desk.fetch(new Request(`https://desk${path}`, { method: 'POST', body: JSON.stringify(body) }))
    return { status: r.status, ok: r.ok, text: await r.text() }
  }
  const BOARD = 'bAAAAAAAAAAAAAAAA'
  let clock = 1000
  const tick = () => ++clock
  const sync = async (notes, base, who) => {
    const { ops, sent } = desks.planSync(notes, base)
    const answer = desks.parseBoard(await call('/sync', { board: BOARD, by: who, since: base.rev, ops }))
    assert.equal(answer.error, '')
    return { ops, ...desks.applySync(notes, base, answer, sent, tick()) }
  }
  const cardOf = (notes, id) => notes.find((p) => p.id === id)

  // A заводит доску с двумя карточками и делится с B: карточки уходят первой сверкой
  let A = notesM.addPage([], { title: 'Проект', board: {} }, tick()).notes
  const boardA = A[0].id
  A = notesM.addPage(A, { title: 'one', parent: boardA, id: 'c1' }, tick()).notes
  A = notesM.addPage(A, { title: 'two', parent: boardA, id: 'c2' }, tick()).notes
  const opened = desks.parseBoard(await call('/open', { board: BOARD, by: '1', name: 'Проект' }))
  assert.equal((await call('/members', { board: BOARD, by: '1', add: ['2'] })).status, 200)
  A = notesM.updatePage(A, boardA, { board: { ...A.find((p) => p.id === boardA).board, share: BOARD } }, tick())
  let baseA = { ...desks.freshBase(A, A.find((p) => p.id === boardA), '1'), rev: opened.board.rev, cards: {} }
  let r = await sync(A, baseA, '1')
  ;[A, baseA] = [r.notes, r.base]
  assert.equal(r.ops.length, 2, 'A отдал две карточки')

  // B берёт доску из списка — карточки приходят первой сверкой
  const adopted = desks.adoptBoard([], { id: BOARD, name: 'Проект', owner: '1', rev: 0, at: 0 }, tick())
  let [B, baseB] = [adopted.notes, adopted.base]
  const boardB = adopted.page.id
  r = await sync(B, baseB, '2')
  ;[B, baseB] = [r.notes, r.base]
  assert.deepEqual(notesM.columnCards(B, cardOf(B, boardB), 'todo').map((p) => p.title), ['one', 'two'], 'B получил карточки по порядку')

  // B переносит одну и правит другую, A переименовывает колонку — каждый видит правки другого
  B = notesM.moveCard(B, 'c1', 'right', tick())
  B = notesM.updatePage(B, 'c2', { body: 'от B' }, tick())
  A = notesM.renameColumn(A, boardA, 'done', 'Сдано', tick()).notes
  r = await sync(B, baseB, '2')
  ;[B, baseB] = [r.notes, r.base]
  r = await sync(A, baseA, '1')
  ;[A, baseA] = [r.notes, r.base]
  assert.deepEqual([cardOf(A, 'c1').col, cardOf(A, 'c2').body], ['doing', 'от B'], 'A видит правки B')
  r = await sync(B, baseB, '2')
  ;[B, baseB] = [r.notes, r.base]
  assert.equal(cardOf(B, boardB).board.cols[2].name, 'Сдано', 'B видит колонку A')

  // Одновременно: A удаляет c2, B правит её — правка B возвращает карточку
  A = notesM.removePage(A, 'c2')
  B = notesM.updatePage(B, 'c2', { body: 'снова B' }, tick())
  r = await sync(A, baseA, '1')
  ;[A, baseA] = [r.notes, r.base]
  r = await sync(B, baseB, '2')
  ;[B, baseB] = [r.notes, r.base]
  assert.ok(cardOf(B, 'c2'), 'у B карточка осталась: он её правил')
  r = await sync(A, baseA, '1')
  ;[A, baseA] = [r.notes, r.base]
  assert.equal(cardOf(A, 'c2')?.body, 'снова B', 'к A карточка вернулась')

  // Правка, пока шёл ответ: сайт её не перезаписывает, она уходит следующей сверкой и побеждает у обоих
  {
    const { ops, sent } = desks.planSync(B, baseB)
    const answer = desks.parseBoard(await call('/sync', { board: BOARD, by: '2', since: baseB.rev, ops }))
    A = notesM.updatePage(A, 'c1', { title: 'one от A' }, tick())
    B = notesM.updatePage(B, 'c1', { title: 'one от B' }, tick())
    r = desks.applySync(B, baseB, answer, sent, tick())
    ;[B, baseB] = [r.notes, r.base]
  }
  r = await sync(A, baseA, '1')
  ;[A, baseA] = [r.notes, r.base]
  r = await sync(B, baseB, '2')
  ;[B, baseB] = [r.notes, r.base]
  r = await sync(A, baseA, '1')
  ;[A, baseA] = [r.notes, r.base]
  assert.deepEqual([cardOf(A, 'c1').title, cardOf(B, 'c1').title], ['one от B', 'one от B'], 'поздняя правка победила у обоих')

  // Основа потерялась: B сверяется с нуля — где расходятся, побеждает сайт; несверенная карточка уходит на сайт
  B = notesM.addPage(B, { title: 'local', parent: boardB, id: 'c9' }, tick()).notes
  const lost = { ...desks.freshBase(B, cardOf(B, boardB), '1'), cards: Object.fromEntries(B.filter((p) => p.parent === boardB && p.id !== 'c9').map((p) => [p.id, p.at])) }
  r = await sync(B, lost, '2')
  ;[B, baseB] = [r.notes, r.base]
  r = await sync(A, baseA, '1')
  ;[A, baseA] = [r.notes, r.base]
  assert.equal(cardOf(A, 'c9')?.title, 'local', 'карточка B дошла до A')
  assert.deepEqual(
    notesM.notesOrder(A).map((p) => p.title),
    notesM.notesOrder(B).map((p) => p.title),
    'доски у A и B одинаковые',
  )

  // Основа и блокнот переживают $.store
  const restored = desks.restoreDesks(JSON.parse(JSON.stringify({ [BOARD]: baseB })), notesM.restoreNotes(JSON.parse(JSON.stringify(B))))
  assert.deepEqual([restored[BOARD]?.rev, restored[BOARD]?.page], [baseB.rev, boardB], 'основа переживает $.store')
}

console.log('комнаты: все проверки прошли')
