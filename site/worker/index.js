// Код сайта Arcade на Cloudflare Workers. Статику (dist/) Cloudflare отдаёт сам, без этого кода;
// сюда приходят только /api/* и /net/* — для сетевой игры.
// Комната — Durable Object: по WebSocket пересылает сообщения между игроками в ней. На комнатах будут работать
// сетевая игра EmulatorJS (Sega, Master System, PlayStation) и сетевой Doom.

export const MAX_PEERS = 8 // игроков в комнате
export const MAX_MESSAGE = 1024 * 1024 // 1 МБ — больше одно сообщение WebSocket в Workers не передаёт
const ROOM_NAME = /^[A-Za-z0-9_-]{1,64}$/

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/ping') return Response.json({ ok: true })
    const room = url.pathname.match(/^\/net\/room\/([^/]+)$/)
    if (room) {
      if (!ROOM_NAME.test(room[1])) return new Response('Имя комнаты: латиница, цифры, - и _, до 64 символов', { status: 400 })
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Нужно подключение WebSocket', { status: 426 })
      return env.ROOMS.get(env.ROOMS.idFromName(room[1])).fetch(request)
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

  async fetch() {
    if (this.ctx.getWebSockets().length >= MAX_PEERS) return new Response('Комната заполнена', { status: 409 })
    const [client, server] = Object.values(new WebSocketPair())
    const id = crypto.randomUUID().slice(0, 8)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ id })
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
  }
}
