// Замена socket.io для сетевой игры EmulatorJS. Сборка кладёт этот файл под именем emulatorjs/src/socket.io.min.js,
// поэтому EmulatorJS вызывает наш io(url): тот же интерфейс on/emit с ответами, но через обычный WebSocket к нашему
// Durable Object (/net/ejs/<номер игры>) — без чужого сервера netplay.emulatorjs.org.
// Двоичные данные (сохранение игры при выравнивании) идут в base64; сообщения больше 512 КБ — кусками,
// потому что одно сообщение WebSocket в Cloudflare Workers ограничено 1 МБ.
;(function () {
  'use strict'

  const CHUNK = 512 * 1024

  function toB64(bytes) {
    let s = ''
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    return btoa(s)
  }
  function fromB64(text) {
    const s = atob(text)
    const out = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
    return out
  }

  // Uint8Array и ArrayBuffer — в { __b64 }, и обратно
  function pack(v) {
    // Проверки, которые не зависят от того, в каком окне создан массив
    if (ArrayBuffer.isView(v)) return { __b64: toB64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) }
    if (Object.prototype.toString.call(v) === '[object ArrayBuffer]') return { __b64: toB64(new Uint8Array(v)) }
    if (Array.isArray(v)) return v.map(pack)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pack(x)]))
    return v
  }
  function revive(v) {
    if (v && typeof v === 'object' && typeof v.__b64 === 'string') return fromB64(v.__b64)
    if (Array.isArray(v)) return v.map(revive)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]))
    return v
  }

  function io(url) {
    const base = String(url).replace(/^http/, 'ws').replace(/\/+$/, '')
    const ws = new WebSocket(`${base}/${window.EJS_gameID}`)
    const handlers = {}
    const acks = {}
    const parts = {}
    let seq = 0
    const fire = (event, ...args) => (handlers[event] || []).forEach((fn) => fn(...args))
    const send = (frame) => ws.readyState === 1 && ws.send(typeof frame === 'string' ? frame : JSON.stringify(frame))

    ws.addEventListener('open', () => fire('connect'))
    ws.addEventListener('close', () => fire('disconnect'))
    ws.addEventListener('message', (e) => {
      let frame
      try {
        frame = JSON.parse(e.data)
      } catch {
        return
      }
      if (frame.t === 'ack') {
        const fn = acks[frame.id]
        delete acks[frame.id]
        if (fn) fn(...revive(frame.args || []))
      } else if (frame.t === 'event') fire(frame.event, revive(frame.data))
      else if (frame.t === 'chunk') {
        const got = (parts[frame.id] ||= [])
        got[frame.i] = frame.part
        if (got.filter((x) => x !== undefined).length === frame.n) {
          delete parts[frame.id]
          try {
            fire('data-message', revive(JSON.parse(got.join(''))))
          } catch {
            // битое сообщение — пропускаем
          }
        }
      }
    })

    return {
      on(event, fn) {
        ;(handlers[event] ||= []).push(fn)
      },
      emit(event, data, ack) {
        const id = ack ? ++seq : 0
        if (ack) acks[id] = ack
        const packed = pack(data)
        const text = JSON.stringify(packed)
        if (event === 'data-message' && text.length > CHUNK) {
          const msg = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
          const n = Math.ceil(text.length / CHUNK)
          for (let i = 0; i < n; i++) send({ t: 'chunk', id: msg, i, n, part: text.slice(i * CHUNK, (i + 1) * CHUNK) })
        } else send({ t: 'emit', event, data: packed, id })
      },
      disconnect() {
        ws.close()
      },
      close() {
        ws.close()
      },
      get connected() {
        return ws.readyState === 1
      },
    }
  }

  window.io = io
})()
