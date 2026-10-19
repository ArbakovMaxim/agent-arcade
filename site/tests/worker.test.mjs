// Тест кода Worker'а без Cloudflare: маршруты и комната (Durable Object) на подставных объектах
import assert from 'node:assert/strict'
import worker, { Room, DoomRoom, MAX_PEERS, MAX_MESSAGE } from '../worker/index.js'

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
  // Хозяин начинает новую игру — прежние игроки отключаются
  await room.webSocketMessage(host, packet(0, 1))
  assert.ok(guest.closed && other.closed && !host.closed)
} finally {
  globalThis.Response = RealResponse
}
console.log('комнаты: все проверки прошли')
