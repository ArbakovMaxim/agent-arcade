// Свои игры: файл ROM с компьютера человека. Arcade раздаёт только игры со свободными лицензиями,
// а свой файл человек подключает сам: мод хранит копию у него же, в папке данных, и никуда её не отправляет.
// Здесь нет вызовов Claude Code — чтение и запись файлов в hooks/app/library.js.

export const MINE_MAX_BYTES = 4 * 1024 * 1024 // больше за одно чтение мод не получит; игры Денди и Sega помещаются

// Мапперы, с которыми работает наш эмулятор Денди (JSNES): проверено загрузкой каждого номера
export const NES_MAPPERS = new Set([0, 1, 2, 3, 4, 5, 7, 9, 11, 28, 34, 38, 66, 71, 79, 94, 118, 119, 140, 180, 240, 241])

const ID = /^mine-[0-9a-f]{12}$/
const SHA256 = /^[0-9a-f]{64}$/

// Путь после /arcade-add: перетаскивание файла в терминал добавляет кавычки, их снимаем
export function cleanPath(args) {
  let path = String(args ?? '').trim()
  if (path.length >= 2 && ((path.startsWith('"') && path.endsWith('"')) || (path.startsWith("'") && path.endsWith("'")))) {
    path = path.slice(1, -1).trim()
  }
  return path
}

const DOOM_WAD = 'это файл Doom (WAD). Их добавляют в окне Arcade: «Игры» → «Шутеры» → «Открыть свой файл»'
const GAME_GEAR = 'это игра для Game Gear — Game Gear в Arcade не поддерживается'

export const CONSOLE_NAMES = { nes: 'Денди', sega: 'Sega Mega Drive', sms: 'Master System' }

// Что за файл: Денди (заголовок iNES), Sega Mega Drive (метка SEGA по адресу $100) или Master System
// (метка TMR SEGA; у японских картриджей метки бывает нет — тогда по расширению .sms). Game Gear Arcade не поддерживает.
export function identifyRom(bytes, path = '') {
  const head = String.fromCharCode(...bytes.subarray(0, 6))
  if (head.startsWith('PK\x03\x04') || head.startsWith('7z\xbc\xaf\x27\x1c') || head.startsWith('Rar!')) {
    return { error: 'это архив. Распакуй его и укажи путь к самому файлу игры: .nes, .md или .bin' }
  }
  if (bytes.length >= 16 && bytes[0] === 0x4e && bytes[1] === 0x45 && bytes[2] === 0x53 && bytes[3] === 0x1a) {
    const mapper = (bytes[6] >> 4) | (bytes[7] & 0xf0)
    if (!NES_MAPPERS.has(mapper)) return { error: `картридж с маппером ${mapper} наш эмулятор Денди пока не поддерживает` }
    return { console: 'nes', mapper }
  }
  // Doom: WAD бывает на десятки мегабайт — добавляется в окне Arcade
  const head4 = String.fromCharCode(...bytes.subarray(0, 4))
  if (head4 === 'IWAD' || head4 === 'PWAD') return { error: DOOM_WAD }
  const at = (offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4))
  if (bytes.length >= 0x200 && (at(0x100) === 'SEGA' || at(0x101) === 'SEGA')) return { console: 'sega' }
  for (const o of [0x7ff0, 0x3ff0, 0x1ff0]) {
    if (bytes.length >= o + 16 && String.fromCharCode(...bytes.subarray(o, o + 8)) === 'TMR SEGA') {
      const region = bytes[o + 15] >> 4
      if (region >= 5 && region <= 7) return { error: GAME_GEAR }
      return { console: 'sms' }
    }
  }
  const ext = (String(path).match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase()
  if (ext === 'gg') return { error: GAME_GEAR }
  if (ext === 'sms') return { console: 'sms' }
  return { error: 'это не похоже на игру для Денди (.nes), Sega Mega Drive (.md, .bin, .gen) или Master System (.sms)' }
}

// Название из имени файла: без папки и расширения, подчёркивания — пробелы
export function titleFromPath(path) {
  const base = String(path).split(/[\\/]/).pop() ?? ''
  const title = base.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim()
  return title.slice(0, 48) || 'Моя игра'
}

export function mineId(sha256) {
  return `mine-${sha256.slice(0, 12)}`
}

// Сохранённый список своих игр из $.store: каждая запись проверяется
export function restoreMine(saved) {
  if (!Array.isArray(saved)) return []
  return saved
    .filter((m) => m && ID.test(m.id ?? '') && SHA256.test(m.sha256 ?? '') && Object.hasOwn(CONSOLE_NAMES, m.console))
    .map((m) => ({ id: m.id, console: m.console, title: String(m.title ?? 'Моя игра').slice(0, 48), sha256: m.sha256 }))
}

export async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}
