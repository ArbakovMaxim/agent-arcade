// Код сайта Arcade на Cloudflare Workers. Статику (dist/) Cloudflare отдаёт сам, без этого кода;
// сюда приходят только /api/* и /net/* — для сетевой игры.
// Комната — Durable Object: по WebSocket пересылает сообщения между игроками в ней. На комнатах будут работать
// сетевая игра EmulatorJS (Sega, Master System, PlayStation) и сетевой Doom.

export const MAX_PEERS = 8 // игроков в комнате
export const MAX_MESSAGE = 1024 * 1024 // 1 МБ — больше одно сообщение WebSocket в Workers не передаёт
const ROOM_NAME = /^[A-Za-z0-9_-]{1,64}$/
export const MAX_PER_IP = 4 // подключений с одного адреса в одну комнату: две вкладки для проверки пройдут, сотня — нет

// Ограничение частоты — «ведро жетонов» на каждый сокет: сообщения и байты в секунду с запасом на всплеск.
// Лишнее отбрасывается; кто долго превышает лимит, того комната отключает. Состояние в памяти: после «спячки»
// ведро снова полное — это нормально, «спячка» и значит, что в комнате было тихо.
export class Limiter {
  constructor({ messages, bytes, now = () => Date.now() }) {
    this.messages = messages
    this.bytes = bytes
    this.now = now
    this.buckets = new WeakMap()
  }

  // true — пропустить; false — отбросить; 'close' — отключить сокет
  allow(ws, size) {
    const t = this.now()
    let b = this.buckets.get(ws)
    if (!b) this.buckets.set(ws, (b = { m: this.messages * 2, b: this.bytes * 2, at: t, strikes: 0 }))
    const dt = Math.max(0, t - b.at) / 1000
    b.at = t
    b.m = Math.min(this.messages * 2, b.m + dt * this.messages)
    b.b = Math.min(this.bytes * 2, b.b + dt * this.bytes)
    if (b.m >= 1 && b.b >= size) {
      b.m -= 1
      b.b -= size
      b.strikes = Math.max(0, b.strikes - 0.1)
      return true
    }
    b.strikes += 1
    return b.strikes > 200 ? 'close' : false
  }
}

// Отбросить сообщение или отключить того, кто долго заваливает комнату
function limited(limiter, ws, size) {
  const verdict = limiter.allow(ws, size)
  if (verdict === 'close') {
    try {
      ws.close(1008, 'слишком много сообщений')
    } catch {
      // уже закрыт
    }
  }
  return verdict !== true
}

// С одного адреса — не больше MAX_PER_IP подключений в одну комнату
function tooManyFrom(ctx, ip) {
  if (!ip) return false
  return ctx.getWebSockets().filter((ws) => ws.deserializeAttachment()?.ip === ip).length >= MAX_PER_IP
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    // WebSocket — только со страниц нашего сайта: чужой сайт не сделает из комнат свой бесплатный сервер
    const origin = request.headers.get('Origin')
    if (url.pathname.startsWith('/net/') && request.headers.get('Upgrade') === 'websocket' && origin && origin !== url.origin) {
      return new Response('Подключение только со страниц Arcade', { status: 403 })
    }
    if (url.pathname === '/api/ping') return Response.json({ ok: true })
    // Кто сейчас ждёт в сети — для мода и окна: { doom: игроков в лобби, games: { номер игры: открытых комнат } }
    if (url.pathname === '/api/lobbies') return env.PRESENCE.get(env.PRESENCE.idFromName('all')).fetch('https://presence/get')
    // Сетевая игра EmulatorJS: список комнат игры и сокет — один Durable Object на игру
    if (url.pathname === '/net/ejs/list') {
      const game = url.searchParams.get('game_id') || ''
      if (!/^\d{1,10}$/.test(game)) return Response.json({})
      return env.EJS.get(env.EJS.idFromName(game)).fetch('https://ejs/list')
    }
    const ejs = url.pathname.match(/^\/net\/ejs\/(\d{1,10})$/)
    if (ejs) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Нужно подключение WebSocket', { status: 426 })
      return env.EJS.get(env.EJS.idFromName(ejs[1])).fetch(request)
    }
    const room = url.pathname.match(/^\/net\/(room|doom)\/([^/]+)$/)
    if (room) {
      if (!ROOM_NAME.test(room[2])) return new Response('Имя комнаты: латиница, цифры, - и _, до 64 символов', { status: 400 })
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Нужно подключение WebSocket', { status: 426 })
      const space = room[1] === 'doom' ? env.DOOM : env.ROOMS
      // Комнате передаём её имя: лобби Doom сообщает счётчику «кто ждёт», сколько в нём людей
      const forward = new Request(request, { headers: new Headers(request.headers) })
      forward.headers.set('X-Room', room[2])
      return space.get(space.idFromName(room[2])).fetch(forward)
    }
    return env.ASSETS.fetch(request)
  },
}

// Комната: каждое сообщение уходит всем остальным как есть; о входе и выходе игроков — служебные сообщения.
// API со «спячкой»: пока в комнате тихо, Durable Object не тратит ресурсы.
export class Room {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
  }

  async fetch(request) {
    if (this.ctx.getWebSockets().length >= MAX_PEERS) return new Response('Комната заполнена', { status: 409 })
    const ip = request?.headers?.get('CF-Connecting-IP') || ''
    if (tooManyFrom(this.ctx, ip)) return new Response('Слишком много подключений с одного адреса', { status: 429 })
    const [client, server] = Object.values(new WebSocketPair())
    const id = crypto.randomUUID().slice(0, 8)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ id, ip, room: request?.headers?.get('X-Room') || '' })
    this.report()
    server.send(JSON.stringify({ type: 'welcome', id, peers: this.peers(server) }))
    this.broadcast(JSON.stringify({ type: 'join', id }), server)
    return new Response(null, { status: 101, webSocket: client })
  }

  peers(except) {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws !== except)
      .map((ws) => ws.deserializeAttachment()?.id)
      .filter(Boolean)
  }

  broadcast(message, except) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue
      try {
        ws.send(message)
      } catch {
        // сокет уже закрывается — его уберёт webSocketClose
      }
    }
  }

  async webSocketMessage(ws, message) {
    const size = typeof message === 'string' ? message.length : message.byteLength
    if (size > MAX_MESSAGE) return
    // Лобби и комнаты друзей — редкие сообщения: 20 в секунду и 256 КБ/с с запасом
    this.limiter ??= new Limiter({ messages: 20, bytes: 256 * 1024 })
    if (limited(this.limiter, ws, size)) return
    this.broadcast(message, ws)
  }

  async webSocketClose(ws, code, reason) {
    this.leave(ws)
    try {
      ws.close(code, reason)
    } catch {
      // уже закрыт
    }
  }

  async webSocketError(ws) {
    this.leave(ws)
  }

  leave(ws) {
    const id = ws.deserializeAttachment()?.id
    if (id) this.broadcast(JSON.stringify({ type: 'leave', id }), ws)
    this.report(ws)
  }

  // Лобби Doom — сколько людей ждёт, для счётчика «кто ждёт» (мод и окно показывают это в Claude Code)
  report(leaving) {
    const sockets = this.ctx.getWebSockets()
    const name = sockets.map((ws) => ws.deserializeAttachment()?.room).find(Boolean)
    if (name !== 'doom-lobby' || !this.env?.PRESENCE) return
    const count = sockets.filter((ws) => ws !== leaving).length
    const presence = this.env.PRESENCE.get(this.env.PRESENCE.idFromName('all'))
    this.ctx.waitUntil?.(presence.fetch('https://presence/set', { method: 'POST', body: JSON.stringify({ key: 'doom', value: count }) }).catch(() => {}))
  }
}

// Комната сетевого Doom: пакеты doom-wasm идут не всем, а конкретному игроку.
// Пакет клиента: [кому: uint32][от кого: uint32][данные]; адресату уходит [от кого][данные].
// Хозяин игры — номер 1; его первый пакет «кому 0» начинает новую игру, прежних игроков комната отключает.
// По образцу маршрутизатора Cloudflare doom-workers (BSD-3-Clause, © 2021 Cloudflare), на API со «спячкой».
export class DoomRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
  }

  async fetch(request) {
    if (this.ctx.getWebSockets().length >= MAX_PEERS) return new Response('Комната заполнена', { status: 409 })
    const ip = request?.headers?.get('CF-Connecting-IP') || ''
    if (tooManyFrom(this.ctx, ip)) return new Response('Слишком много подключений с одного адреса', { status: 429 })
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ uid: null, ip })
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws, message) {
    if (typeof message === 'string' || message.byteLength < 8 || message.byteLength > MAX_MESSAGE) return
    // Doom шлёт десятки пакетов в секунду на каждого игрока: 400 в секунду и 512 КБ/с с запасом
    this.limiter ??= new Limiter({ messages: 400, bytes: 512 * 1024 })
    if (limited(this.limiter, ws, message.byteLength)) return
    const head = new DataView(message)
    const to = head.getUint32(0, true)
    const from = head.getUint32(4, true)
    if (from === 1 && to === 0) {
      // Хозяин начинает игру: отключаем только прежнего хозяина. Игроков не трогаем — они могли подключиться раньше
      // него, а у каждого раунда Arcade своя новая комната, старых сессий в ней не бывает
      for (const other of this.ctx.getWebSockets()) {
        if (other !== ws && other.deserializeAttachment()?.uid === 1) {
          try {
            other.close(1011, 'новая игра')
          } catch {
            // уже закрыт
          }
        }
      }
    }
    if (ws.deserializeAttachment()?.uid !== from) ws.serializeAttachment({ ...ws.deserializeAttachment(), uid: from })
    const target = this.ctx.getWebSockets().find((other) => other !== ws && other.deserializeAttachment()?.uid === to)
    if (target) {
      try {
        target.send(message.slice(4))
      } catch {
        // адресат отключается
      }
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


// Сетевая игра EmulatorJS (Sega, Master System, PlayStation): один Durable Object на игру.
// Окно говорит с ним через нашу замену socket.io (web/netplay-io.js): кадры JSON — { t: 'emit', event, data, id },
// ответы — { t: 'ack', id, args }, события — { t: 'event', event, data }; большие сообщения (сохранение игры
// при выравнивании) — кусками { t: 'chunk', … }, комната пересылает их как есть. Состав комнат живёт прямо
// на сокетах (serializeAttachment), поэтому «спячка» его не теряет.
export class EjsGame {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
  }

  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/list') return Response.json(this.rooms())
    const game = url.pathname.split('/').pop()
    const ip = request.headers.get('CF-Connecting-IP') || ''
    if (tooManyFrom(this.ctx, ip)) return new Response('Слишком много подключений с одного адреса', { status: 429 })
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ game, ip })
    return new Response(null, { status: 101, webSocket: client })
  }

  members(sessionid) {
    return this.ctx.getWebSockets().filter((ws) => ws.deserializeAttachment()?.sessionid === sessionid)
  }

  // Открытые комнаты — в том виде, в каком их ждёт EmulatorJS
  rooms() {
    const list = {}
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment()
      if (!a?.owner) continue
      list[a.sessionid] = { room_name: a.room_name, current: this.members(a.sessionid).length, max: a.max }
    }
    return list
  }

  users(sessionid) {
    return Object.fromEntries(this.members(sessionid).map((ws) => [ws.deserializeAttachment().userid, ws.deserializeAttachment().extra]))
  }

  send(ws, frame) {
    try {
      ws.send(typeof frame === 'string' ? frame : JSON.stringify(frame))
    } catch {
      // сокет закрывается
    }
  }

  toOthers(ws, sessionid, frame) {
    for (const other of this.members(sessionid)) if (other !== ws) this.send(other, frame)
  }

  usersUpdated(sessionid) {
    const users = this.users(sessionid)
    for (const ws of this.members(sessionid)) this.send(ws, { t: 'event', event: 'users-updated', data: users })
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE) return
    // Нажатия идут по кадру — до 60 в секунду; сохранение при выравнивании — всплеск в несколько мегабайт кусками
    this.limiter ??= new Limiter({ messages: 150, bytes: 2 * 1024 * 1024 })
    if (limited(this.limiter, ws, message.length)) return
    let frame
    try {
      frame = JSON.parse(message)
    } catch {
      return
    }
    const me = ws.deserializeAttachment() || {}
    const ack = (...args) => frame.id && this.send(ws, { t: 'ack', id: frame.id, args })
    if (frame.t === 'chunk') {
      if (me.sessionid) this.toOthers(ws, me.sessionid, message)
      return
    }
    if (frame.t !== 'emit') return
    const extra = frame.data?.extra || {}
    const id = (v) => typeof v === 'string' && /^[\w-]{1,64}$/.test(v)
    if (frame.event === 'open-room') {
      if (!id(extra.sessionid) || !id(extra.userid)) return ack('Неверные данные комнаты')
      if (this.members(extra.sessionid).length) return ack('Такая комната уже есть')
      const max = Math.min(4, Math.max(2, Number(frame.data.maxPlayers) || 2))
      ws.serializeAttachment({ ...me, sessionid: extra.sessionid, userid: extra.userid, extra: clean(extra), owner: true, max, room_name: String(extra.room_name || 'Arcade').slice(0, 40) })
      ack(null)
      this.usersUpdated(extra.sessionid)
      this.report()
    } else if (frame.event === 'join-room') {
      if (!id(extra.sessionid) || !id(extra.userid)) return ack('Неверные данные комнаты')
      const owner = this.members(extra.sessionid).find((o) => o.deserializeAttachment().owner)
      if (!owner) return ack('Комната не найдена')
      const { max } = owner.deserializeAttachment()
      if (this.members(extra.sessionid).length >= max) return ack('Комната заполнена')
      ws.serializeAttachment({ ...me, sessionid: extra.sessionid, userid: extra.userid, extra: clean(extra), owner: false, max })
      ack(null, this.users(extra.sessionid))
      this.usersUpdated(extra.sessionid)
      this.report()
    } else if (frame.event === 'data-message' && me.sessionid) {
      this.toOthers(ws, me.sessionid, { t: 'event', event: 'data-message', data: frame.data })
    }
  }

  async webSocketClose(ws, code, reason) {
    this.gone(ws)
    try {
      ws.close(code, reason)
    } catch {
      // уже закрыт
    }
  }

  async webSocketError(ws) {
    this.gone(ws)
  }

  // Ушёл хозяин — комната закрывается для всех; ушёл игрок — остальным новый состав
  gone(ws) {
    const me = ws.deserializeAttachment() || {}
    ws.serializeAttachment({ game: me.game, ip: me.ip })
    if (!me.sessionid) return
    if (me.owner) {
      for (const other of this.members(me.sessionid)) {
        this.send(other, { t: 'event', event: 'disconnect' })
        other.serializeAttachment({ game: other.deserializeAttachment().game, ip: other.deserializeAttachment().ip })
      }
    } else this.usersUpdated(me.sessionid)
    this.report(me.game)
  }

  // Счётчик «кто ждёт»: открытые комнаты этой игры, где есть свободное место
  report(game) {
    if (!this.env?.PRESENCE) return
    const name = game || this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment()?.game).find(Boolean)
    if (!name) return
    const open = Object.values(this.rooms()).filter((r) => r.current < r.max).length
    const presence = this.env.PRESENCE.get(this.env.PRESENCE.idFromName('all'))
    this.ctx.waitUntil?.(presence.fetch('https://presence/set', { method: 'POST', body: JSON.stringify({ key: `g${name}`, value: open }) }).catch(() => {}))
  }
}

// Из данных игрока храним только имя и служебные номера
function clean(extra) {
  return {
    domain: String(extra.domain || '').slice(0, 100),
    game_id: extra.game_id,
    room_name: String(extra.room_name || '').slice(0, 40),
    player_name: String(extra.player_name || 'Игрок').slice(0, 30),
    userid: extra.userid,
    sessionid: extra.sessionid,
  }
}

// Счётчик «кто ждёт»: лобби Doom и комнаты игр сообщают сюда, сколько людей ждёт; /api/lobbies отдаёт сводку.
// Числа лежат в хранилище Durable Object (SQLite), «спячка» их не теряет.
export class Presence {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
  }

  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/set' && request.method === 'POST') {
      const { key, value } = await request.json()
      if (!/^(doom|g\d{1,10})$/.test(key || '')) return new Response('Неверный ключ', { status: 400 })
      if (Number(value) > 0) await this.ctx.storage.put(key, Math.min(99, Number(value)))
      else await this.ctx.storage.delete(key)
      return Response.json({ ok: true })
    }
    const all = await this.ctx.storage.list()
    const games = {}
    for (const [key, value] of all) if (key.startsWith('g')) games[key.slice(1)] = value
    return Response.json({ doom: all.get('doom') || 0, games })
  }
}
