// Каталог игр: что мод берёт с сайта Arcade (catalog.json), что лежит в нём самом на случай без интернета,
// и как проверяется скачанная игра. Здесь нет вызовов Claude Code — сеть и хранилище в hooks/register.js.
import THWAITE_ROM from './roms/thwaite.mjs'
import CROOM_ROM from './roms/croom.mjs'
import RFK_ROM from './roms/rfk.mjs'

// Сайт Arcade: окно, каталог и файлы игр (репозиторий agent-arcade, папка site/)
export const SITE = 'https://agent-arcade.fefaodessa.workers.dev'

const ID = /^[a-z0-9-]+$/
const SHA256 = /^[0-9a-f]{64}$/

// Игры, которые лежат в самом моде: по хешу мод узнаёт их в каталоге и не скачивает
const BUNDLED_ROMS = {
  ee51cd9562f28195ba015d9857c6c4fc9bf67cdfb213e95f655e586b92195173: THWAITE_ROM,
  c24c1aec75242d3bc80b35c15deb705d35f4cd778b22d1cf1df8b38d8dd62726: CROOM_ROM,
  '0778e86400a536407fd94d10619208c06dd120d0f5f28ad79778690048dd0091': RFK_ROM,
}

// Каталог на случай, когда сайт недоступен и сохранённой копии нет: то же, что на сайте, без файлов для окна
export function bundledCatalog() {
  return {
    source: 'bundled',
    consoles: [
      { id: 'nes', title: 'Денди' },
      { id: 'sega', title: 'Sega', soon: 'Готовим эмулятор Mega Drive и подбираем свободные игры.' },
    ],
    games: [
      game('thwaite', 'Thwaite', 'аркада', 'Ракеты падают на город — сбивай их фейерверками, пока дома целы.', 'ee51cd9562f28195ba015d9857c6c4fc9bf67cdfb213e95f655e586b92195173'),
      game('croom', 'Concentration Room', 'найди пару', 'Переворачивай карточки и находи пары — одному, вдвоём или против компьютера.', 'c24c1aec75242d3bc80b35c15deb705d35f4cd778b22d1cf1df8b38d8dd62726'),
      game('rfk', 'robotfindskitten', 'без спешки', 'Робот ищет котёнка среди странных предметов. Ни врагов, ни таймера.', '0778e86400a536407fd94d10619208c06dd120d0f5f28ad79778690048dd0091'),
    ],
  }
}

function game(id, title, genre, about, sha256) {
  return { id, console: 'nes', title, genre, about, rom: { sha256, base64: `files/${sha256}.nes.b64` } }
}

// catalog.json с сайта → { source: 'site', consoles, games }, или null, если ответ не похож на каталог.
// Ответ пришёл по сети, поэтому каждое поле проверяется; игры с ошибками просто пропускаются.
export function parseCatalog(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!data || !Array.isArray(data.consoles) || !data.games || typeof data.games !== 'object') return null
  const consoles = data.consoles
    .filter((c) => c && ID.test(c.id ?? '') && typeof c.title === 'string' && c.title)
    .map((c) => ({
      id: c.id,
      title: c.title,
      ...(typeof c.soon === 'string' ? { soon: c.soon } : {}),
      ...(typeof c.empty === 'string' ? { empty: c.empty.slice(0, 200) } : {}),
    }))
  const ids = new Set(consoles.map((c) => c.id))
  const games = []
  for (const [id, g] of Object.entries(data.games)) {
    if (!ID.test(id) || !g || !ids.has(g.console)) continue
    if (![g.title, g.genre, g.about].every((s) => typeof s === 'string' && s)) continue
    const rom = g.rom ?? {}
    if (!SHA256.test(rom.sha256 ?? '') || typeof rom.base64 !== 'string' || !rom.base64.startsWith('files/')) continue
    games.push({ id, console: g.console, title: g.title, genre: g.genre, about: g.about, rom: { sha256: rom.sha256, base64: rom.base64 } })
  }
  if (!consoles.length) return null
  return { source: 'site', consoles, games }
}

// Сохранённая копия каталога из $.store; та же проверка, что и для ответа сайта
export function restoreCatalog(saved) {
  if (!saved || typeof saved !== 'object') return null
  const parsed = parseCatalog(JSON.stringify({ consoles: saved.consoles, games: Object.fromEntries((saved.games ?? []).map((g) => [g.id, g])) }))
  return parsed ? { ...parsed, source: 'cache' } : null
}

// ROM, который есть в самом моде, или null
export function bundledRom(sha256) {
  return BUNDLED_ROMS[sha256] ?? null
}

export function siteUrl(path) {
  return `${SITE}/${path}`
}

// Страница игры на сайте или библиотека, если игра не указана
export function pageUrl(gameId) {
  return gameId ? `${SITE}/?game=${encodeURIComponent(gameId)}` : `${SITE}/`
}

// Окно со своей игрой из «Моих игр»: страница найдёт её в браузере или один раз попросит выбрать файл и сверит хеш
export function minePageUrl(m) {
  return `${SITE}/?mine=${encodeURIComponent(m.id)}&console=${encodeURIComponent(m.console)}&sha=${m.sha256}&title=${encodeURIComponent(m.title)}`
}

// Окно на вкладке приставки (например, PlayStation — свои диски добавляются там)
export function tabPageUrl(consoleId) {
  return `${SITE}/?tab=${encodeURIComponent(consoleId)}`
}

// Проверяет скачанную игру: base64 → байты → SHA-256 совпадает с каталогом
export async function verifyRom(base64, sha256) {
  if (typeof base64 !== 'string' || !base64) return false
  let bytes
  try {
    bytes = Uint8Array.from(atob(base64.trim()), (c) => c.charCodeAt(0))
  } catch {
    return false
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('') === sha256
}
