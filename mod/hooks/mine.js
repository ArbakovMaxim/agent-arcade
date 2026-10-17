// Свои игры: файл ROM с компьютера человека. Arcade раздаёт только игры со свободными лицензиями,
// а свой файл человек подключает сам: мод хранит копию у него же, в папке данных, и никуда её не отправляет.
// Здесь нет вызовов Claude Code — чтение и запись файлов в hooks/register.js.

export const MINE_MAX_BYTES = 4 * 1024 * 1024 // больше за одно чтение мод не получит; игры Денди и Sega помещаются

// Мапперы, с которыми работает наш эмулятор Денди (JSNES): проверено загрузкой каждого номера
export const NES_MAPPERS = new Set([0, 1, 2, 3, 4, 5, 7, 9, 11, 34, 38, 66, 71, 79, 94, 118, 119, 140, 180, 240, 241])

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

// Что за файл: Денди (заголовок iNES) или Sega Mega Drive (метка SEGA в заголовке картриджа по адресу $100)
export function identifyRom(bytes) {
  const head = String.fromCharCode(...bytes.subarray(0, 6))
  if (head.startsWith('PK\x03\x04') || head.startsWith('7z\xbc\xaf\x27\x1c') || head.startsWith('Rar!')) {
    return { error: 'это архив. Распакуй его и укажи путь к самому файлу игры: .nes, .md или .bin' }
  }
  if (bytes.length >= 16 && bytes[0] === 0x4e && bytes[1] === 0x45 && bytes[2] === 0x53 && bytes[3] === 0x1a) {
    const mapper = (bytes[6] >> 4) | (bytes[7] & 0xf0)
    if (!NES_MAPPERS.has(mapper)) return { error: `картридж с маппером ${mapper} наш эмулятор Денди пока не поддерживает` }
    return { console: 'nes', mapper }
  }
  const at = (offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4))
  if (bytes.length >= 0x200 && (at(0x100) === 'SEGA' || at(0x101) === 'SEGA')) return { console: 'sega' }
  return { error: 'это не похоже на игру для Денди (.nes) или Sega Mega Drive (.md, .bin, .gen)' }
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
    .filter((m) => m && ID.test(m.id ?? '') && SHA256.test(m.sha256 ?? '') && (m.console === 'nes' || m.console === 'sega'))
    .map((m) => ({ id: m.id, console: m.console, title: String(m.title ?? 'Моя игра').slice(0, 48), sha256: m.sha256 }))
}

export async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}
