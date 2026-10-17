// Денди в панели: эмулятор JSNES (Apache-2.0, third_party/jsnes) и перевод кадра в символы терминала.
// Здесь нет вызовов Claude Code — только расчёты, поэтому модуль можно проверять отдельно.
import { NES, Controller } from './vendor/jsnes.mjs'

export { Controller }

const WIDTH = 256
const HEIGHT = 240
// Квадранты: символ делится на 2×2, у каждого символа два цвета — для закрашенных четвертей и для фона.
// Индекс — какие четверти закрашены: левая верхняя 1, правая верхняя 2, левая нижняя 4, правая нижняя 8.
const QUADRANTS = [0x20, 0x2598, 0x259d, 0x2580, 0x2596, 0x258c, 0x259e, 0x259b, 0x2597, 0x259a, 0x2590, 0x259c, 0x2584, 0x2599, 0x259f, 0x2588]

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// base64 → байты, без atob и Buffer
export function fromBase64(text) {
  const clean = text.replace(/=+$/, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let bits = 0
  let value = 0
  let i = 0
  for (const ch of clean) {
    value = ((value << 6) | ALPHABET.indexOf(ch)) & 0xffffff
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[i++] = (value >> bits) & 0xff
    }
  }
  return out
}

// Эмулятор без звука: терминал звук не играет, а так дешевле для процессора
export function createNes(romBase64, onFrame) {
  const nes = new NES({ onFrame, emulateSound: false })
  nes.loadROM(fromBase64(romBase64))
  return nes
}

// Сколько символов занимает экран: по ширине панели и по свободной высоте, с пропорциями 256×240.
// Символу примерно вдвое выше, чем он широкий, поэтому строк вдвое меньше, чем по пропорции.
export function screenSize(bodyColumns, freeRows, maxColumns) {
  const byWidth = Math.min(bodyColumns, maxColumns)
  const byHeight = Math.floor((freeRows * 2 * WIDTH) / HEIGHT)
  const columns = Math.max(16, Math.min(byWidth, byHeight))
  const rows = Math.round((columns * HEIGHT) / WIDTH / 2)
  return { columns, rows }
}

// Кадр Денди (0xBBGGRR на пиксель) → ячейки Raster из квадрантов: на символ четыре «пикселя» и два цвета
export function frameToQuadrants(frame, columns, rows) {
  const cells = new Uint32Array(columns * rows * 3)
  const sx = WIDTH / (columns * 2)
  const sy = HEIGHT / (rows * 2)
  const quarter = [0, 0, 0, 0]
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < columns; cx++) {
      for (let q = 0; q < 4; q++) {
        quarter[q] = frame ? average(frame, (cx * 2 + (q & 1)) * sx, (cy * 2 + (q >> 1)) * sy, sx, sy) : 0
      }
      const [char, fg, bg] = splitQuarters(quarter)
      const i = (cy * columns + cx) * 3
      cells[i] = char
      cells[i + 1] = fg
      cells[i + 2] = bg
    }
  }
  return new Uint8Array(cells.buffer).toBase64()
}

// Четыре цвета → символ и два цвета: самые непохожие два цвета делят четверти между собой
function splitQuarters(c) {
  let a = 0
  let b = 0
  let far = -1
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const d = distance(c[i], c[j])
      if (d > far) {
        far = d
        a = i
        b = j
      }
    }
  }
  if (far === 0) return [0x20, c[0], c[0]] // все четыре одного цвета
  let bits = 0
  const fg = []
  const bg = []
  for (let i = 0; i < 4; i++) {
    if (distance(c[i], c[a]) <= distance(c[i], c[b])) {
      bits |= 1 << i
      fg.push(c[i])
    } else {
      bg.push(c[i])
    }
  }
  return [QUADRANTS[bits], mean(fg), mean(bg)]
}

function distance(x, y) {
  const r = ((x >> 16) & 0xff) - ((y >> 16) & 0xff)
  const g = ((x >> 8) & 0xff) - ((y >> 8) & 0xff)
  const b = (x & 0xff) - (y & 0xff)
  return r * r + g * g + b * b
}

function mean(colors) {
  let r = 0
  let g = 0
  let b = 0
  for (const c of colors) {
    r += (c >> 16) & 0xff
    g += (c >> 8) & 0xff
    b += c & 0xff
  }
  const n = colors.length
  return (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n)
}

// Кадр Денди → PNG с палитрой, base64, для Image. На Денди меньше 64 цветов на экране, поэтому пиксель —
// один байт палитры, и кадр весит около 60 КБ вместо 245 КБ в RGBA. Сжатия нет: блок deflate «как есть».
export function frameToPng(frame) {
  const stride = WIDTH + 1 // байт фильтра в начале каждой строки
  const raw = new Uint8Array(HEIGHT * stride)
  const palette = new Map()
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const color = frame ? frame[y * WIDTH + x] & 0xffffff : 0
      let index = palette.get(color)
      if (index === undefined) {
        index = Math.min(palette.size, 255)
        if (palette.size < 256) palette.set(color, index)
      }
      raw[y * stride + 1 + x] = index
    }
  }
  const plte = new Uint8Array(palette.size * 3)
  for (const [color, index] of palette) {
    plte[index * 3] = color & 0xff
    plte[index * 3 + 1] = (color >> 8) & 0xff
    plte[index * 3 + 2] = (color >> 16) & 0xff
  }
  // zlib: заголовок, один последний блок deflate без сжатия (кадр меньше 65 535 байт), Adler-32
  const idat = new Uint8Array(2 + 5 + raw.length + 4)
  idat.set([0x78, 0x01, 0x01, raw.length & 0xff, raw.length >> 8, ~raw.length & 0xff, (~raw.length >> 8) & 0xff])
  idat.set(raw, 7)
  writeU32(idat, 7 + raw.length, adler32(raw))

  const header = new Uint8Array(13)
  writeU32(header, 0, WIDTH)
  writeU32(header, 4, HEIGHT)
  header.set([8, 3, 0, 0, 0], 8) // 8 бит на пиксель, палитра, deflate, без фильтров, без чересстрочности
  const parts = [
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk('IHDR', header),
    chunk('PLTE', plte),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ]
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    png.set(part, offset)
    offset += part.length
  }
  return png.toBase64()
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length)
  writeU32(out, 0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  writeU32(out, 8 + data.length, crc32(out, 4, 8 + data.length))
  return out
}

function writeU32(bytes, at, value) {
  bytes[at] = (value >>> 24) & 0xff
  bytes[at + 1] = (value >>> 16) & 0xff
  bytes[at + 2] = (value >>> 8) & 0xff
  bytes[at + 3] = value & 0xff
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes, start, end) {
  let c = 0xffffffff
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function adler32(bytes) {
  let a = 1
  let b = 0
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

// Средний цвет прямоугольника кадра
function average(frame, x0, y0, w, h) {
  const x1 = Math.min(WIDTH, Math.max(Math.floor(x0) + 1, Math.round(x0 + w)))
  const y1 = Math.min(HEIGHT, Math.max(Math.floor(y0) + 1, Math.round(y0 + h)))
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let y = Math.floor(y0); y < y1; y++) {
    for (let x = Math.floor(x0); x < x1; x++) {
      const c = frame[y * WIDTH + x]
      r += c & 0xff
      g += (c >> 8) & 0xff
      b += (c >> 16) & 0xff
      n++
    }
  }
  return (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n)
}
